import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jobvacancy/core/api/api_exception.dart';
import 'package:jobvacancy/core/models/auth_result.dart';
import 'package:jobvacancy/core/models/user.dart';
import 'package:jobvacancy/features/auth/employer_notice_screen.dart';
import 'package:jobvacancy/features/auth/login_screen.dart';
import 'package:jobvacancy/features/auth/verify_email_screen.dart';
import 'package:jobvacancy/features/auth/welcome_screen.dart';
import 'package:jobvacancy/features/home/shell.dart';

import '../support/app_harness.dart';
import '../support/fakes.dart';

Future<void> enter(WidgetTester t, String key, String text) async {
  await t.enterText(find.descendant(of: find.byKey(Key(key)), matching: find.byType(TextFormField)), text);
}

Future<void> tap(WidgetTester t, String key) async {
  await t.ensureVisible(find.byKey(Key(key)));
  await t.tap(find.byKey(Key(key)));
  await t.pumpAndSettle();
}

Future<void> signIn(WidgetTester t) async {
  await tap(t, 'welcome-login');
  await enter(t, 'login-email', 'aziza@example.com');
  await enter(t, 'login-password', 'Secret123');
  await tap(t, 'login-submit');
}

void main() {
  testWidgets('first launch shows the welcome screen; skipping opens the app as a guest', (t) async {
    await pumpApp(t, FakeBackend(), onboarded: false);
    expect(find.byType(WelcomeScreen), findsOneWidget);
    await tap(t, 'welcome-skip');
    expect(find.byType(AppShell), findsOneWidget);
  });

  testWidgets('login: empty form is caught before any request', (t) async {
    final b = FakeBackend();
    await pumpApp(t, b, onboarded: false);
    await tap(t, 'welcome-login');
    expect(find.byType(LoginScreen), findsOneWidget);
    await tap(t, 'login-submit');
    expect(find.text("Bu maydonni to'ldiring"), findsNWidgets(2));
    expect(b.calls.list, isEmpty);
  });

  testWidgets('login: a wrong password shows the API message above the form', (t) async {
    final b = FakeBackend();
    b.session.loginError = const ApiFailure(status: 401, code: 'invalid_credentials');
    await pumpApp(t, b, onboarded: false);
    await signIn(t);
    expect(b.calls.list, ['login aziza@example.com']);
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.byIcon(Icons.error_outline), findsOneWidget);
  });

  testWidgets('login: success lands a seeker in the app and stores the session', (t) async {
    final b = FakeBackend();
    await pumpApp(t, b, onboarded: false);
    await signIn(t);
    expect(find.byType(AppShell), findsOneWidget);
    expect(b.store.tokens?.refreshToken, 'refresh-1');
  });

  testWidgets('an employer who signs in sees the website notice and can sign out', (t) async {
    final b = FakeBackend();
    b.session.user = testUser(role: UserRole.employer);
    await pumpApp(t, b, onboarded: false);
    await signIn(t);
    expect(find.byType(EmployerNoticeScreen), findsOneWidget);
    await tap(t, 'employer-sign-out');
    expect(b.calls.list.last, 'logout');
    expect(find.byType(EmployerNoticeScreen), findsNothing);
  });

  testWidgets('register: server field errors show under the field', (t) async {
    final b = FakeBackend();
    b.session.registerError = const ApiFailure(status: 409, code: 'validation_failed', fields: {'email': 'unique'});
    await pumpApp(t, b, onboarded: false);
    await tap(t, 'welcome-register');
    await enter(t, 'register-name', 'Aziza Karimova');
    await enter(t, 'register-email', 'taken@example.com');
    await enter(t, 'register-password', 'Secret123');
    await tap(t, 'register-submit');
    expect(find.text('Takrorlanmasligi kerak'), findsOneWidget);
    expect(find.byIcon(Icons.error_outline), findsNothing, reason: 'the error is shown at its field');
  });

  testWidgets('register → the router opens the code entry → app', (t) async {
    final b = FakeBackend();
    await pumpApp(t, b, onboarded: false);
    await tap(t, 'welcome-register');
    await enter(t, 'register-name', 'Aziza Karimova');
    await enter(t, 'register-email', 'new@example.com');
    await enter(t, 'register-password', 'weak');
    await tap(t, 'register-submit');
    expect(b.calls.list, isEmpty, reason: 'weak password is refused locally');
    await enter(t, 'register-password', 'Secret123');
    await tap(t, 'register-submit');
    expect(b.calls.list.single, 'register new@example.com Aziza Karimova uz');
    expect(find.byType(VerifyEmailScreen), findsOneWidget);

    await t.enterText(find.byKey(const Key('code-input')), '000000'); // completes → submits
    await t.pumpAndSettle();
    expect(find.byType(VerifyEmailScreen), findsOneWidget, reason: 'wrong code stays');
    await t.enterText(find.byKey(const Key('code-input')), '123456');
    await t.pumpAndSettle();
    expect(b.calls.list, contains('verifyEmail 123456'));
    expect(find.byType(AppShell), findsOneWidget);
    await t.pump(const Duration(seconds: 61)); // let the resend countdown timer finish
  });

  testWidgets('a stored session is restored at launch', (t) async {
    final b = FakeBackend();
    final r = authResult(testUser());
    b.store
      ..tokens = Tokens.received(r, DateTime.now())
      ..user = r.user;
    await pumpApp(t, b);
    expect(find.byType(AppShell), findsOneWidget);
    expect(b.calls.list, ['me']);
  });
}
