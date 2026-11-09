import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../l10n/l10n.dart';

/// Form submission state shared by every form screen: a spinner while the call runs,
/// one message for the whole form, and per-field messages from the API's `fields`.
mixin SubmitState<T extends StatefulWidget> on State<T> {
  final formKey = GlobalKey<FormState>();
  bool pending = false;
  String? formError;
  Map<String, String> fieldErrors = const {};

  /// JSON fields this form renders inputs for. A validation error about any other field is
  /// summarised above the form so it isn't lost.
  Set<String> get shownFields => const {};

  /// Validates the form, runs [action], and maps an [ApiException] to messages.
  /// [onError] may handle a failure itself (return true) instead.
  Future<void> submit(Future<void> Function() action, {bool Function(ApiException e)? onError}) async {
    FocusScope.of(context).unfocus();
    setState(() {
      formError = null;
      fieldErrors = const {};
    });
    if (!(formKey.currentState?.validate() ?? true)) return;
    setState(() => pending = true);
    try {
      await action();
    } on ApiException catch (e) {
      if (!mounted || (onError?.call(e) ?? false)) return;
      final texts = ErrorTexts.of(context);
      setState(() {
        formError = texts.message(e, shownFields: shownFields);
        fieldErrors = texts.fields(e);
      });
      formKey.currentState?.validate(); // show the server's field messages
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }
}

/// A failure outside a form (a button in a list, a background action): shown as a snackbar.
void showApiError(BuildContext context, Object error) {
  final text = ErrorTexts.of(context).message(error) ?? context.l10n.errorsInternalError;
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
}

void showMessage(BuildContext context, String text) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
