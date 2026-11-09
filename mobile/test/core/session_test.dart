import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jobvacancy/core/api/api_client.dart';
import 'package:jobvacancy/core/api/api_exception.dart';
import 'package:jobvacancy/core/auth/auth_interceptor.dart';
import 'package:jobvacancy/core/auth/refresh_api.dart';
import 'package:jobvacancy/core/auth/session.dart';
import 'package:jobvacancy/core/auth/session_api.dart';
import 'package:jobvacancy/core/auth/session_store.dart';
import 'package:jobvacancy/core/auth/token_refresher.dart';
import 'package:jobvacancy/core/models/auth_result.dart';
import 'package:jobvacancy/core/router/redirect.dart';
import 'package:jobvacancy/core/router/routes.dart';

import '../support/fakes.dart';

/// The API refuses every access token with 401, so the interceptor has to renew.
class _Refuses implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<List<int>>? b, Future<void>? c) async => ResponseBody.fromString(
    jsonEncode({
      'error': {'code': 'unauthorized'},
    }),
    401,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  @override
  void close({bool force = false}) {}
}

MemorySessionStore signedInStore() {
  final r = authResult(testUser());
  return MemorySessionStore()
    ..tokens = Tokens.received(r, DateTime.now())
    ..user = r.user;
}

/// The real session stack (controller → HttpSessionApi → ApiClient → AuthInterceptor →
/// TokenRefresher) against an API that answers 401 and a scripted refresh endpoint.
ProviderContainer realStack(MemorySessionStore store, FakeRefreshApi refresh) => ProviderContainer(
  overrides: [
    sessionStoreProvider.overrideWithValue(store),
    refreshApiProvider.overrideWithValue(refresh),
    sessionApiProvider.overrideWith((ref) {
      final dio = Dio(BaseOptions(baseUrl: 'http://api.test'))..httpClientAdapter = _Refuses();
      dio.interceptors.add(AuthInterceptor(dio: dio, tokens: ref.watch(accessTokenSourceProvider)));
      return HttpSessionApi(ApiClient(dio));
    }),
  ],
);

ProviderContainer withFakeApi(FakeSessionApi api, MemorySessionStore store, [FakeRefreshApi? refresh]) =>
    ProviderContainer(
      overrides: [
        sessionApiProvider.overrideWithValue(api),
        sessionStoreProvider.overrideWithValue(store),
        refreshApiProvider.overrideWithValue(refresh ?? FakeRefreshApi()),
      ],
    );

Future<SessionState> settle(ProviderContainer c) async {
  c.read(sessionProvider);
  for (var i = 0; i < 50 && c.read(sessionProvider) is SessionRestoring; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 5));
  }
  return c.read(sessionProvider);
}

void main() {
  group('launch (API-049)', () {
    test('offline during the launch refresh keeps the cached session', () async {
      final store = signedInStore();
      final c = realStack(store, FakeRefreshApi()..answers.add(const NetworkFailure()));
      addTearDown(c.dispose);
      expect(await settle(c), isA<SignedIn>());
      expect(store.tokens, isNotNull);
    });

    test('a refused refresh at launch signs out', () async {
      final store = signedInStore();
      final c = realStack(
        store,
        FakeRefreshApi()..answers.add(const ApiFailure(status: 401, code: 'invalid_refresh_token')),
      );
      addTearDown(c.dispose);
      expect(await settle(c), isA<SignedOut>());
      expect(store.tokens, isNull);
    });

    test('a blocked account (refresh answers 403 account_blocked) signs out', () async {
      final store = signedInStore();
      final c = realStack(store, FakeRefreshApi()..answers.add(const ApiFailure(status: 403, code: 'account_blocked')));
      addTearDown(c.dispose);
      expect(await settle(c), isA<SignedOut>());
    });

    test('a server error at launch keeps the cached session', () async {
      final api = FakeSessionApi(Calls())..meError = const ApiFailure(status: 503, code: 'internal_error');
      final c = withFakeApi(api, signedInStore());
      addTearDown(c.dispose);
      expect(await settle(c), isA<SignedIn>());
    });
  });

  test('a refresh carries the fresh user into the session (OO-042)', () async {
    final refresh = FakeRefreshApi()
      ..answers.add(authResult(testUser(phoneVerified: true), access: 'n', refresh: 'r-n'));
    final c = withFakeApi(FakeSessionApi(Calls()), signedInStore(), refresh);
    addTearDown(c.dispose);
    await settle(c);
    expect(c.read(currentUserProvider)?.phoneVerified, isFalse);
    await c.read(tokenRefresherProvider).refresh();
    await Future<void>.delayed(Duration.zero);
    expect(c.read(currentUserProvider)?.phoneVerified, isTrue);
  });

  test('a refused refresh later signs the session out', () async {
    final refresh = FakeRefreshApi()..answers.add(const ApiFailure(status: 401, code: 'invalid_refresh_token'));
    final c = withFakeApi(FakeSessionApi(Calls()), signedInStore(), refresh);
    addTearDown(c.dispose);
    await settle(c);
    await c.read(tokenRefresherProvider).refresh();
    await Future<void>.delayed(Duration.zero);
    expect(c.read(sessionProvider), isA<SignedOut>());
  });

  test('the sign-up detour happens once: acknowledged, later sign-in screens go home (OO-045)', () async {
    final c = withFakeApi(FakeSessionApi(Calls()), MemorySessionStore());
    addTearDown(c.dispose);
    await settle(c);
    await c
        .read(sessionProvider.notifier)
        .registerSeeker(email: 'a@b.uz', password: 'Secret123', fullName: 'Ali', locale: 'uz');
    String? go(String to) => appRedirect(session: c.read(sessionProvider), onboarded: true, location: to);
    expect(go(Routes.register), Routes.verifyEmail);
    c.read(sessionProvider.notifier).acknowledgeRegistration(); // the code screen opened
    expect(go(Routes.login), Routes.jobs, reason: 'skipping the code must not loop back to it');
  });
}
