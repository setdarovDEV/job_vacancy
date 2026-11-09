import 'package:flutter/material.dart';

import '../../../core/widgets/form_widgets.dart';
import 'auth_scaffold.dart';

/// The form part of every sign-in screen: the form key, autofill group, the form-level
/// error and evenly spaced rows. Screens pass only their fields and buttons.
class AuthForm extends StatelessWidget {
  const AuthForm({super.key, required this.formKey, required this.error, required this.children});

  final GlobalKey<FormState> formKey;
  final String? error;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Form(
    key: formKey,
    child: AutofillGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (error != null) ...[FormErrorBanner(error), gap],
          for (var i = 0; i < children.length; i++) ...[if (i > 0) gap, children[i]],
        ],
      ),
    ),
  );
}
