import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/l10n.dart';
import '../../core/preferences.dart';
import '../../core/router/routes.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/backdrop.dart';
import '../../core/widgets/logo.dart';

class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    Future<void> go(String route) async {
      await ref.read(onboardedProvider.notifier).done();
      if (context.mounted) context.go(route);
    }

    return Scaffold(
      body: Backdrop(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpace.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Align(alignment: Alignment.centerLeft, child: Logo(size: 26)),
                    ),
                    TextButton(
                      key: const Key('welcome-skip'),
                      onPressed: () => go(Routes.jobs),
                      child: Text(l.appSkip),
                    ),
                  ],
                ),
                const Spacer(),
                const Align(alignment: Alignment.centerLeft, child: LogoMark(size: 56)),
                const SizedBox(height: AppSpace.xl),
                Text(l.appWelcomeTitle, style: context.text.displayMedium),
                const SizedBox(height: AppSpace.md),
                Text(l.appWelcomeBody, style: context.text.bodyLarge?.copyWith(color: context.colors.ink2)),
                const Spacer(),
                FilledButton(
                  key: const Key('welcome-register'),
                  onPressed: () => go(Routes.register),
                  child: Text(l.navSignUp),
                ),
                const SizedBox(height: AppSpace.md),
                OutlinedButton(
                  key: const Key('welcome-login'),
                  onPressed: () => go(Routes.login),
                  child: Text(l.navSignIn),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
