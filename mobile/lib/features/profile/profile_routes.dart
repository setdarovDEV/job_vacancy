import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import 'profile_screen.dart';

final GoRoute profileRoute = GoRoute(path: Routes.profile, builder: (_, _) => const ProfileScreen());
