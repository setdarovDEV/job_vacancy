import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n/l10n.dart';
import '../theme/tokens.dart';

/// Text field with a label above it and an optional server-side error.
class AppTextField extends StatefulWidget {
  const AppTextField({
    super.key,
    required this.label,
    this.controller,
    this.validator,
    this.serverError,
    this.hint,
    this.helper,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.obscure = false,
    this.onSubmitted,
    this.enabled = true,
    this.inputFormatters,
  });

  final String label;
  final TextEditingController? controller;
  final String? Function(String?)? validator;

  /// Message from the API's `fields` for this input; cleared when the user edits it.
  final String? serverError;
  final String? hint;
  final String? helper;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final bool obscure;
  final ValueChanged<String>? onSubmitted;
  final bool enabled;
  final List<TextInputFormatter>? inputFormatters;

  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  late bool _hidden = widget.obscure;
  String? _shownServerError;

  @override
  void didUpdateWidget(AppTextField old) {
    super.didUpdateWidget(old);
    if (widget.serverError != old.serverError) _shownServerError = widget.serverError;
  }

  @override
  void initState() {
    super.initState();
    _shownServerError = widget.serverError;
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: context.text.titleSmall),
        const SizedBox(height: 6),
        TextFormField(
          controller: widget.controller,
          enabled: widget.enabled,
          obscureText: _hidden,
          keyboardType: widget.keyboardType,
          textInputAction: widget.textInputAction,
          autofillHints: widget.autofillHints,
          inputFormatters: widget.inputFormatters,
          onFieldSubmitted: widget.onSubmitted,
          autovalidateMode: AutovalidateMode.onUserInteraction,
          onChanged: (_) {
            if (_shownServerError != null) setState(() => _shownServerError = null);
          },
          validator: (v) => widget.validator?.call(v) ?? _shownServerError,
          decoration: InputDecoration(
            hintText: widget.hint,
            helperText: widget.helper,
            helperMaxLines: 2,
            errorMaxLines: 3,
            suffixIcon: widget.obscure
                ? IconButton(
                    tooltip: _hidden ? l.formShowPassword : l.formHidePassword,
                    icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                    onPressed: () => setState(() => _hidden = !_hidden),
                  )
                : null,
          ),
        ),
      ],
    );
  }
}

/// A failure that belongs to the whole form (wrong password, rate limit, offline…).
class FormErrorBanner extends StatelessWidget {
  const FormErrorBanner(this.message, {super.key});
  final String? message;

  @override
  Widget build(BuildContext context) {
    final m = message;
    if (m == null) return const SizedBox.shrink();
    final c = context.colors;
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: c.anorSoft, borderRadius: BorderRadius.circular(AppRadii.control)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.error_outline, size: 18, color: c.anorInk),
            const SizedBox(width: 10),
            Expanded(
              child: Text(m, style: context.text.bodyMedium?.copyWith(color: c.anorInk)),
            ),
          ],
        ),
      ),
    );
  }
}

/// Primary action with an inline spinner while [loading].
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({super.key, required this.label, required this.onPressed, this.loading = false});

  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) => FilledButton(
    onPressed: loading ? null : onPressed,
    child: loading
        ? SizedBox.square(
            dimension: 20,
            child: CircularProgressIndicator(strokeWidth: 2.2, color: context.colors.onLapis),
          )
        : Text(label),
  );
}

/// Six-digit code entry: one real text field (so paste and SMS/email autofill work)
/// drawn as six boxes.
class CodeInput extends StatefulWidget {
  const CodeInput({super.key, required this.controller, required this.label, this.onCompleted, this.error});

  final TextEditingController controller;
  final String label;
  final ValueChanged<String>? onCompleted;
  final String? error;

  static const length = 6;

  @override
  State<CodeInput> createState() => _CodeInputState();
}

class _CodeInputState extends State<CodeInput> {
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_changed);
    _focus.addListener(() => setState(() {}));
  }

  void _changed() {
    setState(() {});
    final v = widget.controller.text;
    if (v.length == CodeInput.length) widget.onCompleted?.call(v);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_changed);
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final value = widget.controller.text;
    return Semantics(
      label: widget.label,
      textField: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _focus.requestFocus,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                // Invisible but focusable: it receives typing, paste and autofill.
                Opacity(
                  opacity: 0,
                  child: TextField(
                    key: const Key('code-input'),
                    controller: widget.controller,
                    focusNode: _focus,
                    autofocus: true,
                    keyboardType: TextInputType.number,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    maxLength: CodeInput.length,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(counterText: ''),
                  ),
                ),
                Row(
                  children: [
                    for (var i = 0; i < CodeInput.length; i++) ...[
                      if (i > 0) const SizedBox(width: 8),
                      Expanded(
                        child: AspectRatio(
                          aspectRatio: 0.86,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: c.surface,
                              borderRadius: BorderRadius.circular(AppRadii.control),
                              border: Border.all(
                                color: widget.error != null
                                    ? c.anor
                                    : (_focus.hasFocus && i == value.length.clamp(0, CodeInput.length - 1))
                                    ? c.lapis
                                    : c.lineStrong,
                                width: _focus.hasFocus && i == value.length ? 1.5 : 1,
                              ),
                            ),
                            child: Center(
                              child: Text(i < value.length ? value[i] : '', style: context.text.displaySmall),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
            if (widget.error != null) ...[
              const SizedBox(height: 6),
              Text(widget.error!, style: context.text.bodySmall?.copyWith(color: c.anorInk)),
            ],
          ],
        ),
      ),
    );
  }
}
