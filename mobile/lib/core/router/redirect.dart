import '../auth/session.dart';
import 'routes.dart';

/// Where a navigation to [location] should go instead, or null to allow it.
///
/// - while the stored session is being read, everything waits on the splash screen;
/// - employers and admins get a notice (v1 of the app is for job seekers);
/// - this function owns where a user lands after signing in or up: screens only change the
///   session, never navigate afterwards;
/// - signed-in users skip the sign-in screens; signed-out users can't open account-only
///   screens, and see the welcome screen once on their first launch.
String? appRedirect({required SessionState session, required bool onboarded, required String location}) {
  if (session is SessionRestoring) return location == Routes.splash ? null : Routes.splash;
  final path = Uri.parse(location).path;
  switch (session) {
    case SignedIn(:final user, :final justRegistered):
      if (!user.isSeeker) return path == Routes.employer ? null : Routes.employer;
      if (path == Routes.employer || path == Routes.splash || Routes.signedOutOnly.contains(path)) {
        // A fresh sign-up confirms the email first (the code is already on its way).
        return justRegistered && !user.hasConfirmedContact ? Routes.verifyEmail : Routes.jobs;
      }
      return null;
    case SignedOut():
      if (Routes.signedInOnly.contains(path)) return path == Routes.employer ? Routes.jobs : Routes.login;
      if (path == Routes.splash) return onboarded ? Routes.jobs : Routes.welcome;
      if (!onboarded && !Routes.signedOutOnly.contains(path)) return Routes.welcome;
      return null;
    case SessionRestoring():
      return Routes.splash;
  }
}
