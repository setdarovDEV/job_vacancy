import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/l10n.dart';
import '../../core/router/routes.dart';
import '../../core/widgets/form_widgets.dart';
import '../../core/widgets/submit.dart';
import 'data/account_controller.dart';
import 'validators.dart';
import 'widgets/auth_form.dart';
import 'widgets/auth_scaffold.dart';
import 'widgets/resend_button.dart';

/// Step 1: ask for a reset code by email. The API answers the same whether or not the
/// address has an account, so the next step always opens.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> with SubmitState {
  final _email = TextEditingController();

  @override
  Set<String> get shownFields => const {'email'};

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  void _submit() => submit(() async {
    final email = _email.text.trim();
    await ref.read(accountControllerProvider).forgotPassword(email);
    if (mounted) unawaited(context.push(Uri(path: Routes.reset, queryParameters: {'email': email}).toString()));
  });

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final v = Validators(ErrorTexts.of(context));
    return AuthScaffold(
      title: l.authForgotTitle,
      subtitle: l.authForgotBody,
      children: [
        AuthForm(
          formKey: formKey,
          error: formError,
          children: [
            AppTextField(
              key: const Key('forgot-email'),
              label: l.formEmail,
              controller: _email,
              validator: v.email,
              serverError: fieldErrors['email'],
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              onSubmitted: (_) => _submit(),
            ),
            PrimaryButton(label: l.authSendCode, loading: pending, onPressed: _submit),
          ],
        ),
      ],
    );
  }
}

/// Step 2: the emailed code and a new password. Every session of the account is closed.
class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key, required this.email});
  final String email;

  @override
  ConsumerState<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> with SubmitState {
  final _code = TextEditingController();
  final _password = TextEditingController();

  @override
  Set<String> get shownFields => const {'code', 'password'};

  @override
  void dispose() {
    _code.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() => submit(() async {
    await ref
        .read(accountControllerProvider)
        .resetPassword(email: widget.email, code: _code.text, password: _password.text);
    if (!mounted) return;
    showMessage(context, context.l10n.authResetDone);
    context.go(Routes.login);
  });

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final v = Validators(ErrorTexts.of(context));
    return AuthScaffold(
      title: l.authResetTitle,
      subtitle: l.authResetBody(widget.email),
      children: [
        AuthForm(
          formKey: formKey,
          error: formError,
          children: [
            CodeInput(controller: _code, label: l.authCode, error: fieldErrors['code']),
            AppTextField(
              label: l.authNewPassword,
              helper: l.authPasswordHint,
              controller: _password,
              validator: v.password,
              serverError: fieldErrors['password'],
              obscure: true,
              autofillHints: const [AutofillHints.newPassword],
              onSubmitted: (_) => _submit(),
            ),
            PrimaryButton(label: l.authResetSubmit, loading: pending, onPressed: _submit),
            ResendButton(onResend: () => ref.read(accountControllerProvider).forgotPassword(widget.email)),
          ],
        ),
      ],
    );
  }
}
