import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/l10n.dart';
import '../../core/router/routes.dart';
import 'shell.dart';

final GoRoute splashRoute = GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen());

GoRoute _soon(String path, String Function(AppLocalizations l) title, IconData icon) => GoRoute(
  path: path,
  builder: (c, _) => ComingSoonScreen(title: title(c.l10n), icon: icon),
);

// Placeholders until 9B–9D replace them with their own feature routes.
final GoRoute jobsRoute = _soon(Routes.jobs, (l) => l.navVacancies, Icons.work_outline);
final GoRoute savedRoute = _soon(Routes.saved, (l) => l.navSaved, Icons.bookmark_border);
final GoRoute applicationsRoute = _soon(Routes.applications, (l) => l.navApplications, Icons.description_outlined);
final GoRoute messagesRoute = _soon(Routes.messages, (l) => l.navMessages, Icons.chat_bubble_outline);
