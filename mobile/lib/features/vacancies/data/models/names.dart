import 'package:freezed_annotation/freezed_annotation.dart';

part 'names.freezed.dart';
part 'names.g.dart';

/// Localized name with four language variants. The API always sends all four.
@freezed
abstract class Names with _$Names {
  const factory Names({
    required String uz,
    @JsonKey(name: 'uz-Cyrl') required String uzCyrl,
    required String ru,
    required String en,
  }) = _Names;

  const Names._();

  factory Names.fromJson(Map<String, Object?> json) => _$NamesFromJson(json);

  /// Pick the variant for [languageTag] (`uz`, `uz-Cyrl`, `ru`, `en`), falling back to
  /// `uz` and then the first available value.
  String forLanguage(String languageTag) {
    final map = {'uz': uz, 'uz-Cyrl': uzCyrl, 'ru': ru, 'en': en};
    return map[languageTag] ?? map['uz'] ?? map.values.first;
  }
}
