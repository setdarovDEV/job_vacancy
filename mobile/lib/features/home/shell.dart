import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/cookie_consent.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/backdrop.dart';
import '../../features/chat/providers/chat_socket_controller.dart';
import '../../features/chat/providers/unread_conversations_provider.dart';

/// Bottom-navigation shell. Each tab keeps its own navigation stack (StatefulShellRoute).
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    // Keep the socket alive while the tab shell is visible.
    ref.watch(chatSocketControllerProvider);
    final unreadAsync = ref.watch(unreadConversationsProvider);
    final unread = unreadAsync.value ?? 0;
    final tabs = [
      (Icons.work_outline, Icons.work, l.navVacancies, 0),
      (Icons.bookmark_border, Icons.bookmark, l.navSaved, 0),
      (Icons.description_outlined, Icons.description, l.navApplications, 0),
      (Icons.chat_bubble_outline, Icons.chat_bubble, l.navMessages, unread),
      (Icons.person_outline, Icons.person, l.navProfile, 0),
    ];
    return Scaffold(
      extendBody: true,
      backgroundColor: Colors.transparent,
      body: Stack(children: [Backdrop(child: shell), const CookieConsentBanner()]),
      bottomNavigationBar: GlassBar(
        child: NavigationBar(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
          destinations: [
            for (final (icon, selected, label, count) in tabs)
              NavigationDestination(
                icon: Badge(
                  isLabelVisible: count > 0,
                  label: Text('$count'),
                  child: Icon(icon),
                ),
                selectedIcon: Icon(selected),
                label: label,
              ),
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
