import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import 'employer_notice_screen.dart';
import 'login_screen.dart';
import 'password_reset_screens.dart';
import 'register_screen.dart';
import 'verify_email_screen.dart';
import 'verify_phone_screen.dart';
import 'welcome_screen.dart';

/// Sign-in, sign-up and account confirmation screens (outside the tab shell).
final List<RouteBase> authRoutes = [
  GoRoute(path: Routes.welcome, builder: (_, _) => const WelcomeScreen()),
  GoRoute(path: Routes.login, builder: (_, _) => const LoginScreen()),
  GoRoute(path: Routes.register, builder: (_, _) => const RegisterScreen()),
  GoRoute(path: Routes.forgot, builder: (_, _) => const ForgotPasswordScreen()),
  GoRoute(
    path: Routes.reset,
    builder: (_, s) => ResetPasswordScreen(email: s.uri.queryParameters['email'] ?? ''),
  ),
  GoRoute(
    path: Routes.verifyEmail,
    builder: (_, s) => VerifyEmailScreen(sendOnOpen: s.uri.queryParameters['send'] == '1'),
  ),
  GoRoute(path: Routes.verifyPhone, builder: (_, _) => const VerifyPhoneScreen()),
  GoRoute(path: Routes.employer, builder: (_, _) => const EmployerNoticeScreen()),
];
