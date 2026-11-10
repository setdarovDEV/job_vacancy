import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/l10n.dart';
import '../../core/router/routes.dart';
import 'presentation/screens/applications_screen.dart';
import 'presentation/widgets/apply_sheet.dart';
import 'presentation/screens/resume_editor_screen.dart';
import 'presentation/screens/resumes_screen.dart';

final GoRoute applicationsRoute = GoRoute(
  path: Routes.applications,
  builder: (_, __) => const ApplicationsScreen(),
);

final List<GoRoute> resumeRoutes = [
  applicationsRoute,
  GoRoute(path: Routes.resumes, builder: (_, __) => const ResumesScreen()),
  GoRoute(path: Routes.resumeNew, builder: (_, __) => const ResumeEditorScreen()),
  GoRoute(
    path: Routes.resumeEdit(':id'),
    builder: (_, s) => ResumeEditorScreen(id: s.pathParameters['id']),
  ),
  GoRoute(
    path: '${Routes.apply}/:slug',
    builder: (c, s) => Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: Text(c.l10n.applyTitle)),
      body: ApplySheet(vacancySlug: s.pathParameters['slug']!),
    ),
  ),
];
