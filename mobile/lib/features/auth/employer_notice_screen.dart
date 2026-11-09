import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/l10n/l10n.dart';
import '../../core/auth/session.dart';
import 'widgets/auth_scaffold.dart';

/// v1 of the app is for job seekers; employers and admins are pointed to the website.
class EmployerNoticeScreen extends ConsumerWidget {
  const EmployerNoticeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    return AuthScaffold(
      title: l.appEmployerTitle,
      subtitle: l.appEmployerBody,
      showBack: false,
      children: [
        OutlinedButton(
          key: const Key('employer-sign-out'),
          onPressed: () => ref.read(sessionProvider.notifier).logout(),
          child: Text(l.navSignOut),
        ),
      ],
    );
  }
}
