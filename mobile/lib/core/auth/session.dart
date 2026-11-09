import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../clock.dart';
import '../models/auth_result.dart';
import '../models/user.dart';
import 'session_api.dart';
import 'session_store.dart';
import 'token_refresher.dart';

sealed class SessionState {
  const SessionState();
}

/// Reading stored tokens at launch.
final class SessionRestoring extends SessionState {
  const SessionRestoring();
}

final class SignedOut extends SessionState {
  const SignedOut();
}

final class SignedIn extends SessionState {
  const SignedIn(this.user, {this.justRegistered = false});
  final User user;

  /// Set right after sign-up: the router sends the user to confirm their email (it owns
  /// all post-sign-in navigation, see core/router/redirect.dart).
  final bool justRegistered;
}

/// Who is signed in. Screens call these methods; tokens never leave the auth layer.
class SessionController extends Notifier<SessionState> {
  SessionApi get _api => ref.read(sessionApiProvider);
  SessionStore get _store => ref.read(sessionStoreProvider);

  @override
  SessionState build() {
    final sub = ref.read(tokenRefresherProvider).events.listen(_onTokenEvent);
    ref.onDispose(sub.cancel);
    Future.microtask(_restore);
    return const SessionRestoring();
  }

  void _onTokenEvent(TokenEvent e) {
    switch (e) {
      case TokensRefreshed(:final user):
        if (state case SignedIn(:final justRegistered)) state = SignedIn(user, justRegistered: justRegistered);
      case SessionEnded():
        if (state is SignedIn) state = const SignedOut();
    }
  }

  Future<void> _restore() async {
    if (await _store.readTokens() == null) {
      state = const SignedOut();
      return;
    }
    try {
      final user = await _api.me();
      await _store.saveUser(user);
      state = SignedIn(user);
    } on ApiException {
      // The token refresher is the judge: if the server refused the session (revoked,
      // blocked) it has already cleared the store. Anything else (offline, 5xx, a 401 we
      // couldn't renew because the network dropped) keeps the last known user.
      await _fromStore();
    }
  }

  Future<void> _fromStore() async {
    final cached = await _store.readTokens() == null ? null : await _store.readUser();
    state = cached == null ? const SignedOut() : SignedIn(cached);
  }

  Future<void> login(String email, String password) async =>
      _signIn(await _api.login(email: email.trim(), password: password));

  Future<void> registerSeeker({
    required String email,
    required String password,
    required String fullName,
    required String locale,
  }) async => _signIn(
    await _api.registerSeeker(email: email.trim(), password: password, fullName: fullName.trim(), locale: locale),
    justRegistered: true,
  );

  Future<void> _signIn(AuthResult res, {bool justRegistered = false}) async {
    await _store.save(Tokens.received(res, ref.read(clockProvider)()), res.user);
    state = SignedIn(res.user, justRegistered: justRegistered);
  }

  /// The post-sign-up detour is done (the code screen opened): later navigation is normal.
  void acknowledgeRegistration() {
    if (state case SignedIn(:final user, justRegistered: true)) state = SignedIn(user);
  }

  /// After a verification or profile change the API returns the fresh user.
  Future<void> updateUser(User user) async {
    await _store.saveUser(user);
    if (state is SignedIn) state = SignedIn(user);
  }

  /// Signs this device out. The server call is best effort: the local session ends anyway.
  Future<void> logout() async {
    final tokens = await _store.readTokens();
    if (tokens != null) {
      try {
        await _api.logout(tokens.refreshToken);
      } on ApiException {
        // Already revoked or offline; the refresh token is dropped below either way.
      }
    }
    await _end();
  }

  /// Revokes every session of this account, then signs this device out.
  Future<void> logoutAll() async {
    await _api.logoutAll();
    await _end();
  }

  Future<void> _end() async {
    await _store.clear();
    state = const SignedOut();
  }
}

final sessionProvider = NotifierProvider<SessionController, SessionState>(SessionController.new);

/// The signed-in user, or null.
final currentUserProvider = Provider<User?>(
  (ref) => switch (ref.watch(sessionProvider)) {
    SignedIn(:final user) => user,
    _ => null,
  },
);
