import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/session.dart';
import '../../core/l10n/l10n.dart';
import '../../core/router/routes.dart';
import '../../core/widgets/form_widgets.dart';
import '../../core/widgets/submit.dart';
import 'validators.dart';
import 'widgets/auth_form.dart';
import 'widgets/auth_scaffold.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> with SubmitState {
  final _email = TextEditingController();
  final _password = TextEditingController();

  @override
  Set<String> get shownFields => const {'email', 'password'};

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  // Where the user lands next is the router's decision (core/router/redirect.dart).
  void _submit() => submit(() => ref.read(sessionProvider.notifier).login(_email.text, _password.text));

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final v = Validators(ErrorTexts.of(context));
    return AuthScaffold(
      title: l.authLoginTitle,
      subtitle: l.authLoginSubtitle,
      children: [
        AuthForm(
          formKey: formKey,
          error: formError,
          children: [
            AppTextField(
              key: const Key('login-email'),
              label: l.formEmail,
              controller: _email,
              validator: v.email,
              serverError: fieldErrors['email'],
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AppTextField(
                  key: const Key('login-password'),
                  label: l.formPassword,
                  controller: _password,
                  validator: v.required,
                  serverError: fieldErrors['password'],
                  obscure: true,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.password],
                  onSubmitted: (_) => _submit(),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(onPressed: () => context.push(Routes.forgot), child: Text(l.authForgot)),
                ),
              ],
            ),
            PrimaryButton(
              key: const Key('login-submit'),
              label: l.authSubmitLogin,
              loading: pending,
              onPressed: _submit,
            ),
            Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(l.authNoAccount),
                TextButton(onPressed: () => context.go(Routes.register), child: Text(l.navSignUp)),
              ],
            ),
          ],
        ),
      ],
    );
  }
}
