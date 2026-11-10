import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import 'presentation/screens/notifications_screen.dart';

final GoRoute notificationsRoute = GoRoute(
  path: Routes.notifications,
  builder: (_, __) => const NotificationsScreen(),
);

final List<RouteBase> notificationsRoutes = [notificationsRoute];
