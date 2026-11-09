import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jobvacancy/core/api/api_client.dart';
import 'package:jobvacancy/core/api/api_exception.dart';
import 'package:jobvacancy/core/auth/auth_interceptor.dart';
import 'package:jobvacancy/core/auth/session_store.dart';
import 'package:jobvacancy/core/auth/token_refresher.dart';
import 'package:jobvacancy/core/models/auth_result.dart';

import '../support/fakes.dart';

Tokens tokens(String access, {Duration ttl = const Duration(minutes: 15)}) =>
    Tokens(accessToken: access, accessTokenExpiresAt: DateTime.now().add(ttl), refreshToken: 'r-$access');

/// Answers 401 to any token except [valid], and records the Authorization headers seen.
class _Server implements HttpClientAdapter {
  String valid = 'new';
  final seen = <String?>[];

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<List<int>>? body, Future<void>? cancel) async {
    final auth = o.headers['Authorization'] as String?;
    seen.add(auth);
    await Future<void>.delayed(const Duration(milliseconds: 5));
    final ok = auth == 'Bearer $valid';
    return ResponseBody.fromString(
      jsonEncode(
        ok
            ? {
                'data': {'ok': true},
              }
            : {
                'error': {'code': 'unauthorized'},
              },
      ),
      ok ? 200 : 401,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

const race = ApiFailure(status: 401, code: 'refresh_race');
const invalid = ApiFailure(status: 401, code: 'invalid_refresh_token');
const blocked = ApiFailure(status: 403, code: 'account_blocked');

void main() {
  late MemorySessionStore store;
  late FakeRefreshApi api;
  late TokenRefresher r;
  late List<TokenEvent> events;

  setUp(() {
    store = MemorySessionStore()..tokens = tokens('old');
    api = FakeRefreshApi();
    r = TokenRefresher(store: store, api: api, raceRetryDelay: const Duration(milliseconds: 5));
    events = [];
    r.events.listen(events.add);
  });

  group('TokenRefresher', () {
    test('concurrent callers share one exchange (refresh tokens rotate)', () async {
      final results = await Future.wait([r.refresh(), r.refresh(), r.refresh()]);
      expect(api.sent, ['r-old']);
      expect(results.map((t) => t?.accessToken), everyElement('new'));
      expect(store.tokens?.refreshToken, 'r-new');
      await r.refresh(); // a later call starts a new exchange
      expect(api.sent, hasLength(2));
    });

    test('the refreshed user is announced to the session layer', () async {
      api.answers.add(authResult(testUser(emailVerified: true), access: 'new', refresh: 'r-new'));
      await r.refresh();
      await Future<void>.delayed(Duration.zero);
      expect(events.single, isA<TokensRefreshed>().having((e) => e.user.emailVerified, 'verified', isTrue));
    });

    test('refresh_race: newer tokens stored meanwhile are used without another exchange', () async {
      api.answers.add(race);
      api.delay = Duration.zero;
      final f = r.refresh();
      store.tokens = tokens('other'); // a parallel sign-in stored newer tokens
      expect((await f)?.accessToken, 'other');
      expect(api.sent, ['r-old']);
    });

    test('refresh_race with nothing newer: retries once after a pause', () async {
      api.answers
        ..add(race)
        ..add(authResult(testUser(), access: 'second', refresh: 'r-second'));
      expect((await r.refresh())?.accessToken, 'second');
      expect(api.sent, ['r-old', 'r-old']);
      expect(events.whereType<SessionEnded>(), isEmpty);
    });

    test('a refused refresh token ends the session (401 and 403)', () async {
      for (final refusal in [invalid, blocked]) {
        store.tokens = tokens('old');
        api.answers.add(refusal);
        expect(await r.refresh(), isNull);
        expect(store.tokens, isNull);
      }
      await Future<void>.delayed(Duration.zero);
      expect(events.whereType<SessionEnded>(), hasLength(2));
    });

    test('compare-and-clear: a refusal for an old token keeps tokens stored meanwhile', () async {
      api.answers.add(invalid);
      final f = r.refresh();
      store.tokens = tokens('signed-in-again');
      expect((await f)?.accessToken, 'signed-in-again');
      expect(store.tokens?.accessToken, 'signed-in-again');
      expect(events.whereType<SessionEnded>(), isEmpty);
    });

    test('being offline keeps the session', () async {
      api.answers.add(const NetworkFailure());
      await expectLater(r.refresh(), throwsA(isA<NetworkFailure>()));
      expect(store.tokens?.accessToken, 'old');
      store.tokens = tokens('old', ttl: const Duration(seconds: 5)); // due for renewal
      api.answers.add(const NetworkFailure());
      expect(await r.current(), 'old', reason: 'offline: send the old token and let the server decide');
    });
  });

  group('which refresh answers end the session (API-050)', () {
    test('only refusals of the session itself', () {
      expect(TokenRefresher.refusesSession(invalid), isTrue);
      expect(TokenRefresher.refusesSession(blocked), isTrue);
      expect(TokenRefresher.refusesSession(const ApiFailure(status: 401, code: 'unauthorized')), isTrue);
      expect(TokenRefresher.refusesSession(race), isFalse);
      expect(TokenRefresher.refusesSession(const ApiFailure(status: 403, code: 'verification_required')), isFalse);
      expect(TokenRefresher.refusesSession(const ApiFailure(status: 503, code: 'internal_error')), isFalse);
    });

    test('a 403 that is not about the session keeps the tokens', () async {
      api.answers.add(const ApiFailure(status: 403, code: 'verification_required'));
      await expectLater(r.refresh(), throwsA(isA<ApiFailure>()));
      expect(store.tokens?.accessToken, 'old');
    });

    test('proactive refresh failing with 5xx or an odd body sends the old token (CA-035)', () async {
      for (final failure in [const ApiFailure(status: 503, code: 'internal_error'), const DecodeFailure('html')]) {
        store.tokens = tokens('old', ttl: const Duration(seconds: 5));
        api.answers.add(failure);
        expect(await r.current(), 'old');
        expect(store.tokens?.accessToken, 'old');
      }
    });
  });

  group('token expiry uses the device clock (API-043)', () {
    test('expires_in is measured from receipt, not the server timestamp', () {
      final deviceNow = DateTime.utc(2030, 1, 1, 12);
      // The server's clock is 2 hours ahead of the device: its timestamp would look 2 hours
      // in the future (or past) to the device, but expires_in is clock-independent.
      final res = AuthResult(
        user: testUser(),
        accessToken: 'a',
        accessTokenExpiresAt: deviceNow.add(const Duration(hours: 2, minutes: 15)),
        accessTokenExpiresIn: 900,
        refreshToken: 'r',
      );
      final t = Tokens.received(res, deviceNow);
      expect(t.accessTokenExpiresAt, deviceNow.add(const Duration(minutes: 15)));
      expect(t.expiresSoon(deviceNow.add(const Duration(minutes: 10))), isFalse);
      expect(t.expiresSoon(deviceNow.add(const Duration(minutes: 14, seconds: 40))), isTrue);
    });

    test('a skewed device clock still refreshes on time', () async {
      var now = DateTime.utc(2030, 1, 1, 12);
      final s = MemorySessionStore()
        ..tokens = Tokens.received(authResult(testUser(), access: 'a', refresh: 'r-a'), now);
      final skewed = TokenRefresher(store: s, api: FakeRefreshApi(), clock: () => now);
      expect(await skewed.current(), 'a');
      now = now.add(const Duration(minutes: 14, seconds: 45));
      expect(await skewed.current(), 'new');
    });
  });

  group('AuthInterceptor', () {
    late _Server server;
    late Dio dio;

    setUp(() {
      server = _Server();
      dio = Dio(BaseOptions(baseUrl: 'http://api.test'))..httpClientAdapter = server;
      dio.interceptors.add(AuthInterceptor(dio: dio, tokens: r));
    });

    test('a 401 refreshes once and retries with the new token', () async {
      expect((await dio.get<Object?>('/me')).data, {
        'data': {'ok': true},
      });
      expect(server.seen, ['Bearer old', 'Bearer new']);
      expect(api.sent, hasLength(1));
    });

    test('parallel 401s trigger a single refresh', () async {
      await Future.wait([for (var i = 0; i < 4; i++) dio.get<Object?>('/me')]);
      expect(api.sent, hasLength(1));
      expect(server.seen.where((h) => h == 'Bearer new'), hasLength(4));
    });

    test('a token close to expiry is refreshed before the request leaves', () async {
      store.tokens = tokens('old', ttl: const Duration(seconds: 5));
      await dio.get<Object?>('/me');
      expect(server.seen, ['Bearer new']);
    });

    test('when the session cannot be renewed the 401 surfaces and the session ends', () async {
      api.answers.add(invalid);
      await expectLater(
        dio.get<Object?>('/me'),
        throwsA(isA<DioException>().having((e) => e.response?.statusCode, 'status', 401)),
      );
      expect(store.tokens, isNull);
      await Future<void>.delayed(Duration.zero);
      expect(events.whereType<SessionEnded>(), hasLength(1));
    });

    test('offline during the renew surfaces as NetworkFailure, not as the 401 (API-049)', () async {
      api.answers.add(const NetworkFailure());
      final client = ApiClient(dio);
      await expectLater(client.get('/me', decode: (d) => d), throwsA(isA<NetworkFailure>()));
      expect(store.tokens?.accessToken, 'old', reason: 'the session is kept');
    });

    test('anonymous requests carry no token', () async {
      server.valid = 'none';
      await expectLater(
        dio.post<Object?>('/auth/login', options: Options(extra: {ApiClient.anonymousKey: true})),
        throwsA(isA<DioException>()),
      );
      expect(server.seen, [null]);
    });
  });
}
