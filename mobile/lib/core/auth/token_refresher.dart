import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../clock.dart';
import '../models/auth_result.dart';
import '../models/user.dart';
import 'access_token_source.dart';
import 'refresh_api.dart';
import 'session_store.dart';

/// Something the session layer must know about after a refresh.
sealed class TokenEvent {
  const TokenEvent();
}

/// New tokens were stored; the API sent the current user along.
final class TokensRefreshed extends TokenEvent {
  const TokensRefreshed(this.user);
  final User user;
}

/// The server refused the session; the stored tokens were cleared.
final class SessionEnded extends TokenEvent {
  const SessionEnded();
}

/// The one place refresh tokens are exchanged. Refresh tokens rotate on every use, so all
/// callers (HTTP client, sockets) share a single in-flight exchange: a second exchange with
/// the old token would look like token theft.
class TokenRefresher implements AccessTokenSource {
  TokenRefresher({
    required this.store,
    required this.api,
    Clock? clock,
    this.raceRetryDelay = const Duration(milliseconds: 300),
  }) : _clock = clock ?? DateTime.now;

  final SessionStore store;
  final RefreshApi api;
  final Clock _clock;

  /// Pause before retrying after `refresh_race`.
  final Duration raceRetryDelay;

  final _events = StreamController<TokenEvent>.broadcast();
  Stream<TokenEvent> get events => _events.stream;

  Future<Tokens?>? _inflight;

  /// Whether a refresh failure means the server is done with this session. Only these
  /// answers sign the user out; anything else (offline, 5xx, a 403 such as
  /// verification_required elsewhere) keeps the session.
  static bool refusesSession(ApiFailure e) =>
      e.code == 'invalid_refresh_token' || e.code == 'account_blocked' || (e.status == 401 && e.code != 'refresh_race');

  @override
  Future<String?> current() async {
    final t = await store.readTokens();
    if (t == null) return null;
    if (!t.expiresSoon(_clock())) return t.accessToken;
    try {
      return (await refresh())?.accessToken;
    } on ApiException {
      // Offline, 5xx, an odd body: send the old token; a 401 then goes through renew().
      return t.accessToken;
    }
  }

  @override
  Future<String?> renew({required String rejected}) async {
    final t = await store.readTokens();
    if (t == null) return null;
    // Another request already rotated the tokens while this one was in flight.
    if (t.accessToken != rejected) return t.accessToken;
    return (await refresh())?.accessToken;
  }

  /// New tokens, or null when the session is over. Network failures are rethrown: being
  /// offline doesn't sign anyone out.
  Future<Tokens?> refresh() => _inflight ??= _run().whenComplete(() => _inflight = null);

  Future<Tokens?> _run() async {
    final sent = await store.readTokens();
    if (sent == null) return null;
    try {
      return await _accept(await api.exchange(sent.refreshToken));
    } on ApiFailure catch (e) {
      if (e.code == 'refresh_race') return _afterRace(sent.refreshToken);
      if (refusesSession(e)) return _endIfStillHolding(sent.refreshToken);
      rethrow;
    }
  }

  /// The server rotated this token for a parallel request. If someone stored the newer
  /// tokens meanwhile, use them; otherwise retry once with what we hold.
  Future<Tokens?> _afterRace(String sent) async {
    final stored = await store.readTokens();
    if (stored != null && stored.refreshToken != sent) return stored;
    await Future<void>.delayed(raceRetryDelay);
    final retry = await store.readTokens() ?? stored;
    if (retry == null) return null;
    try {
      return await _accept(await api.exchange(retry.refreshToken));
    } on ApiFailure catch (e) {
      if (refusesSession(e)) return _endIfStillHolding(retry.refreshToken);
      rethrow;
    }
  }

  /// Compare-and-clear: only end the session if the store still holds the refused token
  /// (a sign-in may have replaced it meanwhile).
  Future<Tokens?> _endIfStillHolding(String refused) async {
    final stored = await store.readTokens();
    if (stored == null || stored.refreshToken != refused) return stored;
    await store.clear();
    _events.add(const SessionEnded());
    return null;
  }

  Future<Tokens> _accept(AuthResult res) async {
    final next = Tokens.received(res, _clock());
    await store.save(next, res.user);
    _events.add(TokensRefreshed(res.user));
    return next;
  }

  Future<void> dispose() => _events.close();
}

final tokenRefresherProvider = Provider<TokenRefresher>((ref) {
  final r = TokenRefresher(
    store: ref.watch(sessionStoreProvider),
    api: ref.watch(refreshApiProvider),
    clock: ref.watch(clockProvider),
  );
  ref.onDispose(r.dispose);
  return r;
});

/// The token source for anything that talks to the API.
final accessTokenSourceProvider = Provider<AccessTokenSource>((ref) => ref.watch(tokenRefresherProvider));
