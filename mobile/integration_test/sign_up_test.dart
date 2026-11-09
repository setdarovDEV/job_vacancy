import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:jobvacancy/app/app.dart';
import 'package:jobvacancy/core/preferences.dart';
import 'package:jobvacancy/features/auth/verify_email_screen.dart';
import 'package:jobvacancy/features/home/shell.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// End to end against the real dev API on the host (10.0.2.2:8090 from the emulator):
/// sign up as a new job seeker, enter the code from Mailpit, land in the app, switch the
/// theme. Run with `flutter drive` (see README) so screenshots are saved.
const mailpit = String.fromEnvironment('MAILPIT_URL', defaultValue: 'http://10.0.2.2:8025');

Future<String> emailCode(String to) async {
  final http = HttpClient();
  try {
    for (var attempt = 0; attempt < 20; attempt++) {
      await Future<void>.delayed(const Duration(milliseconds: 750));
      final search = await (await http.getUrl(Uri.parse('$mailpit/api/v1/search?query=to:$to'))).close();
      final found = jsonDecode(await utf8.decodeStream(search)) as Map<String, Object?>;
      final messages = found['messages'] as List? ?? const [];
      if (messages.isEmpty) continue;
      final id = (messages.first as Map)['ID'];
      final msg = await (await http.getUrl(Uri.parse('$mailpit/api/v1/message/$id'))).close();
      final text = (jsonDecode(await utf8.decodeStream(msg)) as Map)['Text'] as String;
      final code = RegExp(r'\b\d{6}\b').firstMatch(text)?.group(0);
      if (code != null) return code;
    }
    throw StateError('no code for $to in Mailpit');
  } finally {
    http.close();
  }
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  var surfaceConverted = false;
  Future<void> shot(WidgetTester t, String name) async {
    await t.pumpAndSettle();
    // Android renders to a surface the test can't read until it is converted (once per run).
    if (Platform.isAndroid && !surfaceConverted) {
      await binding.convertFlutterSurfaceToImage();
      surfaceConverted = true;
      await t.pumpAndSettle();
    }
    await binding.takeScreenshot(name);
  }

  Future<void> field(WidgetTester t, String key, String text) async {
    await t.enterText(find.descendant(of: find.byKey(Key(key)), matching: find.byType(TextFormField)), text);
    await t.pump();
  }

  Future<void> tap(WidgetTester t, Finder f) async {
    await t.ensureVisible(f);
    await t.pumpAndSettle();
    await t.tap(f);
    await t.pumpAndSettle(const Duration(milliseconds: 300));
  }

  Future<void> waitFor(WidgetTester t, Finder f, {Duration timeout = const Duration(seconds: 20)}) async {
    final end = DateTime.now().add(timeout);
    while (f.evaluate().isEmpty) {
      if (DateTime.now().isAfter(end)) throw TestFailure('timed out waiting for $f');
      await t.pump(const Duration(milliseconds: 200));
    }
    await t.pumpAndSettle();
  }

  testWidgets('a new job seeker signs up, confirms the email and lands in the app', (t) async {
    // Start from a clean install state.
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    await prefs.setString('jv.language', 'uz');
    await const FlutterSecureStorage().deleteAll();

    await t.pumpWidget(
      ProviderScope(overrides: [sharedPreferencesProvider.overrideWithValue(prefs)], child: const JobVacancyApp()),
    );
    await waitFor(t, find.byKey(const Key('welcome-register')));
    await shot(t, 'm-welcome-light');

    await tap(t, find.byKey(const Key('welcome-register')));
    final email = 'mobile${DateTime.now().millisecondsSinceEpoch}@example.com';
    await field(t, 'register-name', 'Mobil Sinov');
    await field(t, 'register-email', email);
    await field(t, 'register-password', 'Secret123');
    FocusManager.instance.primaryFocus?.unfocus();
    await shot(t, 'm-register-light');
    await tap(t, find.byKey(const Key('register-submit')));

    await waitFor(t, find.byType(VerifyEmailScreen));
    final code = await emailCode(email);
    await t.enterText(find.byKey(const Key('code-input')), code);
    await t.pump();
    await shot(t, 'm-verify-light');
    await waitFor(t, find.byType(AppShell));

    await tap(t, find.text('Profil').last);
    await waitFor(t, find.text('Mobil Sinov'));
    expect(find.byIcon(Icons.verified), findsOneWidget, reason: 'email shows as confirmed');
    await shot(t, 'm-profile-light');

    await tap(t, find.byKey(const Key('profile-theme')));
    await tap(t, find.text("Qorong'i").last);
    await shot(t, 'm-profile-dark');
    await tap(t, find.text('Vakansiyalar').last);
    await shot(t, 'm-jobs-dark');

    await tap(t, find.text('Profil').last);
    await tap(t, find.byKey(const Key('profile-sign-out')));
    await waitFor(t, find.byKey(const Key('profile-sign-in')));
    await shot(t, 'm-signed-out-dark');
  });
}
