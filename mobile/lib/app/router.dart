import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/session.dart';
import '../core/preferences.dart';
import '../core/router/redirect.dart';
import '../core/router/routes.dart';
import '../features/auth/auth_routes.dart';
import '../features/chat/chat_routes.dart' show chatRoutes, messagesRoute;
import '../features/home/home_routes.dart';
import '../features/home/shell.dart';
import '../features/notifications/notifications_routes.dart';
import '../features/profile/profile_routes.dart';
import '../features/resumes/resumes_routes.dart' show applicationsRoute, resumeRoutes;
import '../features/vacancies/vacancies_routes.dart';

/// The app's navigation: features contribute their routes, the redirect rules live in
/// core/router, and this is the only place that knows both.
final routerProvider = Provider<GoRouter>((ref) {
  // go_router re-runs its redirect when this ticks: on sign-in, sign-out, onboarding.
  final refresh = ValueNotifier(0);
  ref
    ..listen(sessionProvider, (_, _) => refresh.value++)
    ..listen(onboardedProvider, (_, _) => refresh.value++)
    ..onDispose(refresh.dispose);

  StatefulShellBranch branch(GoRoute route) => StatefulShellBranch(routes: [route]);

  return GoRouter(
    initialLocation: Routes.splash,
    refreshListenable: refresh,
    redirect: (_, state) => appRedirect(
      session: ref.read(sessionProvider),
      onboarded: ref.read(onboardedProvider),
      location: state.uri.toString(),
    ),
    routes: [
      splashRoute,
      ...authRoutes,
      ...vacancyTopRoutes,
      ...resumeRoutes,
      ...chatRoutes,
      ...notificationsRoutes,
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => AppShell(shell: shell),
        branches: [jobsRoute, savedRoute, applicationsRoute, messagesRoute, profileRoute].map(branch).toList(),
      ),
    ],
  );
});
