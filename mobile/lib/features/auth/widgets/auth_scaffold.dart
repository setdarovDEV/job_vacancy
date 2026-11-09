import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';
import '../../../core/widgets/backdrop.dart';
import '../../../core/widgets/logo.dart';

/// Layout of the sign-in screens: tinted backdrop, logo, title, subtitle, content.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({super.key, required this.title, this.subtitle, required this.children, this.showBack = true});

  final String title;
  final String? subtitle;
  final List<Widget> children;
  final bool showBack;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: showBack ? AppBar() : null,
    extendBodyBehindAppBar: true,
    body: Backdrop(
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(AppSpace.xl, AppSpace.xxl, AppSpace.xl, AppSpace.xl),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Align(alignment: Alignment.centerLeft, child: Logo(size: 26)),
                  const SizedBox(height: AppSpace.xl),
                  Text(title, style: context.text.displaySmall),
                  if (subtitle != null) ...[
                    const SizedBox(height: AppSpace.sm),
                    Text(subtitle!, style: context.text.bodyLarge?.copyWith(color: context.colors.ink2)),
                  ],
                  const SizedBox(height: AppSpace.xl),
                  ...children,
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/// Vertical gap between form rows.
const gap = SizedBox(height: AppSpace.lg);
