import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/l10n.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/form_widgets.dart';
import '../../core/widgets/submit.dart';
import 'data/account_api.dart';
import 'data/account_controller.dart';
import 'validators.dart';
import 'widgets/auth_form.dart';
import 'widgets/auth_scaffold.dart';

/// Phone confirmation: the code arrives in Telegram's "Verification Codes" chat. In the
/// API's test mode the code comes back in the response and is shown and filled in.
class VerifyPhoneScreen extends ConsumerStatefulWidget {
  const VerifyPhoneScreen({super.key});

  @override
  ConsumerState<VerifyPhoneScreen> createState() => _VerifyPhoneScreenState();
}

class _VerifyPhoneScreenState extends ConsumerState<VerifyPhoneScreen> with SubmitState {
  final _phone = TextEditingController(text: '+998 ');
  final _code = TextEditingController();
  PhoneCodeSent? _sent;

  @override
  Set<String> get shownFields => _sent == null ? const {'phone'} : const {'code'};

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  void _send() => submit(() async {
    final sent = await ref.read(accountControllerProvider).sendPhoneCode(_phone.text);
    setState(() {
      _sent = sent;
      if (sent.devCode != null) _code.text = sent.devCode!;
    });
  });

  void _verify() => submit(() async {
    await ref.read(accountControllerProvider).verifyPhone(_code.text);
    if (!mounted) return;
    showMessage(context, context.l10n.settingsPhoneVerified);
    context.pop();
  });

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.colors;
    final v = Validators(ErrorTexts.of(context));
    final sent = _sent;
    return AuthScaffold(
      title: l.appPhoneTitle,
      subtitle: l.settingsPhoneHint,
      children: [
        AuthForm(
          formKey: formKey,
          error: formError,
          children: sent == null
              ? [
                  AppTextField(
                    key: const Key('phone-input'),
                    label: l.settingsPhone,
                    controller: _phone,
                    validator: v.phone,
                    serverError: fieldErrors['phone'],
                    keyboardType: TextInputType.phone,
                    autofillHints: const [AutofillHints.telephoneNumber],
                    onSubmitted: (_) => _send(),
                  ),
                  PrimaryButton(
                    key: const Key('phone-send'),
                    label: l.settingsSendTelegramCode,
                    loading: pending,
                    onPressed: _send,
                  ),
                ]
              : [
                  if (sent.devCode != null)
                    Container(
                      padding: const EdgeInsets.all(AppSpace.md),
                      decoration: BoxDecoration(
                        color: c.zafaronSoft,
                        borderRadius: BorderRadius.circular(AppRadii.control),
                        border: Border.all(color: c.zafaron.withValues(alpha: 0.5)),
                      ),
                      child: Text('${l.settingsDevCode} ${sent.devCode}', style: context.text.bodyMedium),
                    )
                  else
                    Text(l.settingsPhoneCodeSent(sent.phone), style: context.text.bodyMedium?.copyWith(color: c.ink2)),
                  CodeInput(
                    controller: _code,
                    label: l.authCode,
                    error: fieldErrors['code'],
                    onCompleted: (_) => _verify(),
                  ),
                  PrimaryButton(
                    key: const Key('phone-verify'),
                    label: l.authVerifySubmit,
                    loading: pending,
                    onPressed: _verify,
                  ),
                  TextButton(onPressed: () => setState(() => _sent = null), child: Text(l.commonBack)),
                ],
        ),
      ],
    );
  }
}
