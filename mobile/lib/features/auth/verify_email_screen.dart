import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/session.dart';
import '../../core/l10n/l10n.dart';
import '../../core/router/routes.dart';
import '../../core/widgets/form_widgets.dart';
import '../../core/widgets/submit.dart';
import 'data/account_controller.dart';
import 'widgets/auth_form.dart';
import 'widgets/auth_scaffold.dart';
import 'widgets/resend_button.dart';

/// Six-digit email code. Reached right after sign-up (the code is already on its way) and
/// from the profile with [sendOnOpen] (a new code is requested when the screen opens).
class VerifyEmailScreen extends ConsumerStatefulWidget {
  const VerifyEmailScreen({super.key, this.sendOnOpen = false});
  final bool sendOnOpen;

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> with SubmitState {
  final _code = TextEditingController();

  @override
  Set<String> get shownFields => const {'code'};

  @override
  void initState() {
    super.initState();
    // The post-sign-up redirect brought the user here; from now on navigation is normal,
    // even if they skip the code ("Keyinroq").
    WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(sessionProvider.notifier).acknowledgeRegistration());
    if (widget.sendOnOpen) {
      ref.read(accountControllerProvider).ensureEmailCodeSent().catchError((Object e) {
        if (mounted) setState(() => formError = ErrorTexts.of(context).message(e));
      });
    }
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  void _submit() => submit(() async {
    await ref.read(accountControllerProvider).verifyEmail(_code.text);
    if (!mounted) return;
    showMessage(context, context.l10n.authVerified);
    _leave();
  });

  void _leave() => context.canPop() ? context.pop() : context.go(Routes.jobs);

  Future<void> _resend() async {
    try {
      await ref.read(accountControllerProvider).sendEmailCode();
      if (mounted) showMessage(context, context.l10n.authCodeSent);
    } on ApiException catch (e) {
      if (mounted) setState(() => formError = ErrorTexts.of(context).message(e));
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final email = ref.watch(currentUserProvider)?.email ?? '';
    return AuthScaffold(
      title: l.authVerifyTitle,
      subtitle: l.authVerifyBody(email),
      showBack: false,
      children: [
        AuthForm(
          formKey: formKey,
          error: formError,
          children: [
            CodeInput(controller: _code, label: l.authCode, error: fieldErrors['code'], onCompleted: (_) => _submit()),
            PrimaryButton(
              key: const Key('verify-submit'),
              label: l.authVerifySubmit,
              loading: pending,
              onPressed: _submit,
            ),
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                ResendButton(onResend: _resend),
                TextButton(key: const Key('verify-later'), onPressed: _leave, child: Text(l.authLater)),
              ],
            ),
          ],
        ),
      ],
    );
  }
}
