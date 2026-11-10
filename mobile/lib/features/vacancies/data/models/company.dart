import 'package:freezed_annotation/freezed_annotation.dart';

part 'company.freezed.dart';
part 'company.g.dart';

enum CompanySize {
  @JsonValue('1-10') one10,
  @JsonValue('11-50') eleven50,
  @JsonValue('51-200') fiftyOne200,
  @JsonValue('201-500') twoHundredOne500,
  @JsonValue('501-1000') fiveHundredOne1000,
  @JsonValue('1000+') thousandPlus,
}

/// Public company profile summary shown on vacancy cards.
@freezed
abstract class CompanySummary with _$CompanySummary {
  const factory CompanySummary({
    required String id,
    required String name,
    required String slug,
    String? logoUrl,
    @Default(false) bool verified,
  }) = _CompanySummary;

  const CompanySummary._();

  factory CompanySummary.fromJson(Map<String, Object?> json) => _$CompanySummaryFromJson(json);
}

/// Full public company profile.
@freezed
abstract class Company with _$Company {
  const factory Company({
    required String id,
    required String slug,
    required String name,
    String? logoUrl,
    String? coverUrl,
    @Default(false) bool verified,
    required DateTime createdAt,
    String? about,
    int? industryId,
    @JsonKey(unknownEnumValue: CompanySize.one10) CompanySize? size,
    String? website,
    String? email,
    String? phone,
    int? regionId,
    String? address,
    int? foundedYear,
    int? openVacancies,
  }) = _Company;

  const Company._();

  factory Company.fromJson(Map<String, Object?> json) => _$CompanyFromJson(json);
}
