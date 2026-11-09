import 'package:flutter/widgets.dart';

import '../api/api_exception.dart';
import 'codes.g.dart';
import 'gen/app_localizations.dart';

export 'gen/app_localizations.dart';

extension L10nX on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);

  /// The API tag of the language this widget renders in (uz, uz-Cyrl, ru, en).
  String get languageTag {
    final l = Localizations.localeOf(this);
    return l.languageCode == 'uz' && l.scriptCode == 'Cyrl' ? 'uz-Cyrl' : l.languageCode;
  }
}

/// Turns API failures into text, the same way the web app does (web/app/shared/api/errors.ts).
class ErrorTexts {
  ErrorTexts(this.l10n, this.languageTag);

  factory ErrorTexts.of(BuildContext context) => ErrorTexts(context.l10n, context.languageTag);

  final AppLocalizations l10n;
  final String languageTag;

  /// Array fields of the API's request bodies. A min/max rule on them counts items, not
  /// characters. A field is also treated as a list when the error has `field[i]` entries.
  static const knownListFields = {'skills', 'languages', 'experience', 'education', 'ids'};

  /// One message for the whole failure (above a form or in a snackbar).
  ///
  /// For validation failures the field messages belong next to the inputs, so this is null
  /// unless the error names a field the form doesn't show ([shownFields]); then it says to
  /// check the form instead of failing silently.
  String? message(Object error, {Set<String> shownFields = const {}}) => switch (error) {
    NetworkFailure() => l10n.errorsNetwork,
    ApiFailure(isValidation: true, :final fields) =>
      fields.keys.map(_listOf).every(shownFields.contains) && fields.isNotEmpty ? null : l10n.appCheckFields,
    ApiFailure(code: 'rate_limited', :final retryAfter) => l10n.errorsRateLimited('${retryAfter ?? 60}'),
    ApiFailure(:final code) => apiErrorTexts[languageTag]?[code] ?? l10n.errorsInternalError,
    DecodeFailure() => l10n.errorsInternalError,
    _ => l10n.errorsInternalError,
  };

  /// Per-field messages keyed by JSON field name; "skills[3]" is mirrored onto "skills".
  Map<String, String> fields(Object error) {
    if (error is! ApiFailure) return const {};
    final lists = {
      ...knownListFields,
      for (final f in error.fields.keys)
        if (_listOf(f) != f) _listOf(f),
    };
    final out = <String, String>{};
    for (final MapEntry(key: field, value: rule) in error.fields.entries) {
      out[field] = ruleText(rule, list: lists.contains(field));
      final list = _listOf(field);
      if (list != field) out.putIfAbsent(list, () => out[field]!);
    }
    return out;
  }

  /// Text for one validation rule such as "required", "min=8", "oneof=a b".
  String ruleText(String rule, {bool list = false}) {
    final eq = rule.indexOf('=');
    var name = eq < 0 ? rule : rule.substring(0, eq);
    final param = eq < 0 ? '' : rule.substring(eq + 1);
    if (list && (name == 'max' || name == 'min')) name = '${name}_items';
    final texts = validationTexts[languageTag] ?? validationTexts['uz']!;
    final text = texts[name] ?? texts['invalid']!;
    return text.replaceAll('{{n}}', param);
  }

  static String _listOf(String field) => field.replaceFirst(RegExp(r'\[\d+\]$'), '');
}
