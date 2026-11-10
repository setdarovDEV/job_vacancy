import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import 'shell.dart';

final GoRoute splashRoute = GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen());
