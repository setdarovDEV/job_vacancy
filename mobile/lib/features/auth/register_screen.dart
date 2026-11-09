import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/session.dart';
import '../../core/l10n/l10n.dart';
import '../../core/router/routes.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/form_widgets.dart';
import '../../core/widgets/submit.dart';
import 'validators.dart';
import 'widgets/auth_form.dart';
import 'widgets/auth_scaffold.dart';

/// Job-seeker sign-up (employers register on the website in v1). The API emails a
/// six-digit code right away; the router then opens the code entry.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> with SubmitState {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();

  @override
  Set<String> get shownFields => const {'full_name', 'email', 'password'};

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() => submit(
    () => ref
        .read(sessionProvider.notifier)
        .registerSeeker(
          email: _email.text,
          password: _password.text,
          fullName: _name.text,
          locale: context.languageTag,
        ),
  );

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final v = Validators(ErrorTexts.of(context));
    return AuthScaffold(
      title: l.authRegisterTitle,
      subtitle: l.authRegisterSubtitle,
      children: [
        AuthForm(
          formKey: formKey,
          error: formError,
          children: [
            AppTextField(
              key: const Key('register-name'),
              label: l.authFullName,
              controller: _name,
              validator: v.fullName,
              serverError: fieldErrors['full_name'],
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.name],
            ),
            AppTextField(
              key: const Key('register-email'),
              label: l.formEmail,
              controller: _email,
              validator: v.email,
              serverError: fieldErrors['email'],
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
            ),
            AppTextField(
              key: const Key('register-password'),
              label: l.formPassword,
              helper: l.authPasswordHint,
              controller: _password,
              validator: v.password,
              serverError: fieldErrors['password'],
              obscure: true,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.newPassword],
              onSubmitted: (_) => _submit(),
            ),
            PrimaryButton(
              key: const Key('register-submit'),
              label: l.authSubmitRegister,
              loading: pending,
              onPressed: _submit,
            ),
            Text(
              l.authAgree,
              style: context.text.bodySmall?.copyWith(color: context.colors.ink3),
              textAlign: TextAlign.center,
            ),
            Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(l.authHaveAccount),
                TextButton(onPressed: () => context.go(Routes.login), child: Text(l.navSignIn)),
              ],
            ),
          ],
        ),
      ],
    );
  }
}
