import 'package:flutter_test/flutter_test.dart';
import 'package:jobvacancy/core/auth/session.dart';
import 'package:jobvacancy/core/models/user.dart';
import 'package:jobvacancy/core/router/redirect.dart';
import 'package:jobvacancy/core/router/routes.dart';

import '../support/fakes.dart';

void main() {
  String? go(SessionState s, String to, {bool onboarded = true}) =>
      appRedirect(session: s, onboarded: onboarded, location: to);

  test('everything waits on the splash while the session is restored', () {
    expect(go(const SessionRestoring(), Routes.jobs), Routes.splash);
    expect(go(const SessionRestoring(), Routes.splash), isNull);
  });

  test('signed out: welcome once, then browsing; account screens need sign-in', () {
    expect(go(const SignedOut(), Routes.splash, onboarded: false), Routes.welcome);
    expect(go(const SignedOut(), Routes.jobs, onboarded: false), Routes.welcome);
    expect(go(const SignedOut(), Routes.login, onboarded: false), isNull);
    expect(go(const SignedOut(), Routes.splash), Routes.jobs);
    expect(go(const SignedOut(), Routes.jobs), isNull);
    expect(go(const SignedOut(), Routes.verifyEmail), Routes.login);
    expect(go(const SignedOut(), Routes.employer), Routes.jobs);
  });

  test('signed-in seekers skip the sign-in screens', () {
    final s = SignedIn(testUser());
    expect(go(s, Routes.login), Routes.jobs);
    expect(go(s, '${Routes.reset}?email=a@b.uz'), Routes.jobs);
    expect(go(s, Routes.verifyEmail), isNull);
    expect(go(s, Routes.profile), isNull);
    expect(go(s, Routes.employer), Routes.jobs);
  });

  test('the redirect owns post-sign-up navigation: a fresh sign-up confirms the email first', () {
    expect(go(SignedIn(testUser(), justRegistered: true), Routes.register), Routes.verifyEmail);
    expect(go(SignedIn(testUser(emailVerified: true), justRegistered: true), Routes.register), Routes.jobs);
    expect(go(SignedIn(testUser()), Routes.login), Routes.jobs, reason: 'login goes home');
  });

  test('employers and admins only see the website notice', () {
    for (final role in [UserRole.employer, UserRole.admin, UserRole.unknown]) {
      final s = SignedIn(testUser(role: role));
      expect(go(s, Routes.jobs), Routes.employer);
      expect(go(s, Routes.employer), isNull);
    }
  });
}
