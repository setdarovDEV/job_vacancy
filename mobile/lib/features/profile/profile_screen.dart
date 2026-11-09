import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/l10n/l10n.dart';
import '../../core/models/user.dart';
import '../../core/preferences.dart';
import '../../core/auth/session.dart';
import '../../core/router/routes.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/submit.dart';

/// Profile tab: who is signed in, contact confirmation, language, theme, sign out.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final user = ref.watch(currentUserProvider);
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: Text(l.navProfile)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(AppSpace.lg, AppSpace.sm, AppSpace.lg, 120),
        children: [
          if (user == null) const _GuestCard() else _UserCard(user: user),
          const SizedBox(height: AppSpace.lg),
          const _PreferencesCard(),
          if (user != null) ...[const SizedBox(height: AppSpace.lg), const _SignOutCard()],
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: Column(
      children: [
        for (var i = 0; i < children.length; i++) ...[if (i > 0) const Divider(indent: 16), children[i]],
      ],
    ),
  );
}

class _GuestCard extends StatelessWidget {
  const _GuestCard();

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l.authLoginTitle, style: context.text.headlineSmall),
            const SizedBox(height: AppSpace.xs),
            Text(l.authLoginSubtitle, style: context.text.bodyMedium?.copyWith(color: context.colors.ink2)),
            const SizedBox(height: AppSpace.lg),
            FilledButton(
              key: const Key('profile-sign-in'),
              onPressed: () => context.push(Routes.login),
              child: Text(l.navSignIn),
            ),
            const SizedBox(height: AppSpace.sm),
            OutlinedButton(onPressed: () => context.push(Routes.register), child: Text(l.navSignUp)),
          ],
        ),
      ),
    );
  }
}

class _UserCard extends StatelessWidget {
  const _UserCard({required this.user});
  final User user;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.colors;
    final initials = user.fullName
        .trim()
        .split(RegExp(r'\s+'))
        .take(2)
        .map((w) => w.isEmpty ? '' : w[0].toUpperCase())
        .join();
    Widget status(bool ok, VoidCallback onVerify) => ok
        ? Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.verified, size: 18, color: c.firuza),
              const SizedBox(width: 4),
              Text(l.commonVerified, style: context.text.labelMedium?.copyWith(color: c.firuzaInk)),
            ],
          )
        : TextButton(onPressed: onVerify, child: Text(l.settingsVerify));
    return _Section(
      children: [
        Padding(
          padding: const EdgeInsets.all(AppSpace.lg),
          child: Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: c.lapisSoft,
                child: Text(initials, style: context.text.titleMedium?.copyWith(color: c.lapisInk)),
              ),
              const SizedBox(width: AppSpace.md),
              Expanded(
                child: Text(
                  user.fullName,
                  style: context.text.titleLarge,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
        ListTile(
          leading: const Icon(Icons.mail_outline),
          title: Text(user.email ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis),
          subtitle: Text(l.formEmail),
          trailing: user.email == null
              ? null
              : status(user.emailVerified, () => context.push(Routes.verifyEmailAndSend)),
        ),
        ListTile(
          leading: const Icon(Icons.phone_outlined),
          title: Text(user.phone ?? '—'),
          subtitle: Text(l.settingsPhone),
          trailing: status(user.phoneVerified, () => context.push(Routes.verifyPhone)),
        ),
      ],
    );
  }
}

class _PreferencesCard extends ConsumerWidget {
  const _PreferencesCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = ref.watch(effectiveLanguageProvider);
    final mode = ref.watch(themeModeProvider);
    final modeLabel = switch (mode) {
      ThemeMode.light => l.themeLight,
      ThemeMode.dark => l.themeDark,
      ThemeMode.system => l.themeSystem,
    };
    return _Section(
      children: [
        ListTile(
          key: const Key('profile-language'),
          leading: const Icon(Icons.translate),
          title: Text(l.languageLabel),
          trailing: Text(lang.nativeName),
          onTap: () => _pick<AppLanguage?>(
            context,
            title: l.languageLabel,
            current: ref.read(languageProvider),
            options: [(null, l.themeSystem), for (final a in AppLanguage.values) (a, a.nativeName)],
            onPick: ref.read(languageProvider.notifier).set,
          ),
        ),
        ListTile(
          key: const Key('profile-theme'),
          leading: const Icon(Icons.contrast),
          title: Text(l.themeLabel),
          trailing: Text(modeLabel),
          onTap: () => _pick<ThemeMode>(
            context,
            title: l.themeLabel,
            current: mode,
            options: [
              (ThemeMode.system, l.themeSystem),
              (ThemeMode.light, l.themeLight),
              (ThemeMode.dark, l.themeDark),
            ],
            onPick: ref.read(themeModeProvider.notifier).set,
          ),
        ),
      ],
    );
  }

  static void _pick<T>(
    BuildContext context, {
    required String title,
    required T current,
    required List<(T, String)> options,
    required Future<void> Function(T) onPick,
  }) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet))),
      builder: (sheet) => SafeArea(
        child: RadioGroup<T>(
          groupValue: current,
          onChanged: (v) {
            onPick(v as T);
            Navigator.pop(sheet);
          },
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpace.sm),
                child: Text(title, style: sheet.text.headlineSmall),
              ),
              for (final (value, label) in options) RadioListTile<T>(value: value, title: Text(label)),
            ],
          ),
        ),
      ),
    );
  }
}

class _SignOutCard extends ConsumerWidget {
  const _SignOutCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final c = context.colors;
    return _Section(
      children: [
        ListTile(
          key: const Key('profile-sign-out'),
          leading: Icon(Icons.logout, color: c.anorInk),
          title: Text(l.navSignOut, style: TextStyle(color: c.anorInk)),
          onTap: () => ref.read(sessionProvider.notifier).logout(),
        ),
        ListTile(
          leading: const Icon(Icons.devices_other),
          title: Text(l.appSignOutAll),
          onTap: () async {
            final ok = await showDialog<bool>(
              context: context,
              builder: (d) => AlertDialog(
                title: Text(l.appSignOutAll),
                content: Text(l.settingsSessionsHint),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(d, false), child: Text(l.commonCancel)),
                  FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(l.appSignOutAll)),
                ],
              ),
            );
            if (ok != true) return;
            try {
              await ref.read(sessionProvider.notifier).logoutAll();
            } on ApiException catch (e) {
              if (context.mounted) showApiError(context, e);
            }
          },
        ),
      ],
    );
  }
}
