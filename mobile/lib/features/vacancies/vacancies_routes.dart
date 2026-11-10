import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import 'presentation/screens/company_detail_screen.dart';
import 'presentation/screens/jobs_screen.dart';
import 'presentation/screens/saved_screen.dart';
import 'presentation/screens/vacancy_detail_screen.dart';

final GoRoute jobsRoute = GoRoute(path: Routes.jobs, builder: (_, __) => const JobsScreen());

final GoRoute savedRoute = GoRoute(path: Routes.saved, builder: (_, __) => const SavedScreen());

final List<GoRoute> vacancyTopRoutes = [
  GoRoute(
    path: '${Routes.vacancy}/:slug',
    builder: (_, s) => VacancyDetailScreen(slug: s.pathParameters['slug']!),
  ),
  GoRoute(
    path: '${Routes.company}/:slug',
    builder: (_, s) => CompanyDetailScreen(slug: s.pathParameters['slug']!),
  ),
];
