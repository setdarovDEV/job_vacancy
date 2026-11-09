import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/l10n.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/backdrop.dart';

/// Bottom-navigation shell. Each tab keeps its own navigation stack (StatefulShellRoute).
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final tabs = [
      (Icons.work_outline, Icons.work, l.navVacancies),
      (Icons.bookmark_border, Icons.bookmark, l.navSaved),
      (Icons.description_outlined, Icons.description, l.navApplications),
      (Icons.chat_bubble_outline, Icons.chat_bubble, l.navMessages),
      (Icons.person_outline, Icons.person, l.navProfile),
    ];
    return Scaffold(
      extendBody: true,
      backgroundColor: Colors.transparent,
      body: Backdrop(child: shell),
      bottomNavigationBar: GlassBar(
        child: NavigationBar(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
          destinations: [
            for (final (icon, selected, label) in tabs)
              NavigationDestination(icon: Icon(icon), selectedIcon: Icon(selected), label: label),
          ],
        ),
      ),
    );
  }
}

/// Tabs that arrive in the next updates (9B–9D).
class ComingSoonScreen extends StatelessWidget {
  const ComingSoonScreen({super.key, required this.title, required this.icon});
  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpace.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(color: c.lapisSoft, borderRadius: BorderRadius.circular(AppRadii.panel)),
                child: Icon(icon, size: 30, color: c.lapisInk),
              ),
              const SizedBox(height: AppSpace.lg),
              Text(l.appComingSoonTitle, style: context.text.headlineMedium),
              const SizedBox(height: AppSpace.sm),
              Text(
                l.appComingSoonBody,
                textAlign: TextAlign.center,
                style: context.text.bodyMedium?.copyWith(color: c.ink2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: CircularProgressIndicator()));
}
