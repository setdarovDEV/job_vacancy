import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jobvacancy/app/app.dart';
import 'package:jobvacancy/core/auth/refresh_api.dart';
import 'package:jobvacancy/core/auth/session_api.dart';
import 'package:jobvacancy/core/auth/session_store.dart';
import 'package:jobvacancy/core/notifications/local_notification_service.dart';
import 'package:jobvacancy/core/notifications/push_notification_service.dart';
import 'package:jobvacancy/core/preferences.dart';
import 'package:jobvacancy/features/auth/data/account_api.dart';
import 'package:jobvacancy/features/notifications/data/api/notifications_api.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fakes.dart';

/// The fake backend of a widget test.
class FakeBackend {
  final calls = Calls();
  late final session = FakeSessionApi(calls);
  late final account = FakeAccountApi(calls, session);
  final refresh = FakeRefreshApi();
  final store = MemorySessionStore();
  late final notifications = FakeNotificationsApi(calls);
}

/// Pumps the whole app (router, screens, session) against [b], in Uzbek, with the
/// welcome screen already seen unless [onboarded] is false.
Future<void> pumpApp(WidgetTester tester, FakeBackend b, {bool onboarded = true}) async {
  SharedPreferences.setMockInitialValues({'jv.language': 'uz', 'jv.onboarded': onboarded});
  FlutterSecureStorage.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  tester.view.physicalSize = const Size(1080, 2340);
  tester.view.devicePixelRatio = 2.75;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        sessionStoreProvider.overrideWithValue(b.store),
        sessionApiProvider.overrideWithValue(b.session),
        accountApiProvider.overrideWithValue(b.account),
        refreshApiProvider.overrideWithValue(b.refresh),
        pushNotificationServiceProvider.overrideWithValue(NoopPushNotificationService()),
        localNotificationServiceProvider.overrideWithValue(FakeLocalNotificationService()),
        notificationsApiProvider.overrideWithValue(b.notifications),
      ],
      child: const JobVacancyApp(),
    ),
  );
  await tester.pumpAndSettle();
}
