import 'package:freezed_annotation/freezed_annotation.dart';

import 'company.dart';
import 'skill.dart';

part 'vacancy.freezed.dart';
part 'vacancy.g.dart';

@JsonEnum()
enum EmploymentType {
  @JsonValue('full_time') fullTime,
  @JsonValue('part_time') partTime,
  @JsonValue('project') project,
  @JsonValue('internship') internship,
  @JsonValue('volunteer') volunteer;

  String get apiValue => switch (this) {
    fullTime => 'full_time',
    partTime => 'part_time',
    project => 'project',
    internship => 'internship',
    volunteer => 'volunteer',
  };
}

@JsonEnum()
enum WorkFormat {
  @JsonValue('office') office,
  @JsonValue('remote') remote,
  @JsonValue('hybrid') hybrid;

  String get apiValue => switch (this) { office => 'office', remote => 'remote', hybrid => 'hybrid' };
}

@JsonEnum()
enum Experience {
  @JsonValue('none') none,
  @JsonValue('1_3') oneToThree,
  @JsonValue('3_6') threeToSix,
  @JsonValue('6_plus') sixPlus;

  String get apiValue => switch (this) {
    none => 'none',
    oneToThree => '1_3',
    threeToSix => '3_6',
    sixPlus => '6_plus',
  };
}

@JsonEnum()
enum Schedule {
  @JsonValue('full_day') fullDay,
  @JsonValue('shift') shift,
  @JsonValue('flexible') flexible,
  @JsonValue('rotation') rotation;

  String get apiValue => switch (this) {
    fullDay => 'full_day',
    shift => 'shift',
    flexible => 'flexible',
    rotation => 'rotation',
  };
}

@JsonEnum()
enum VacancyStatus {
  draft,
  moderation,
  published,
  rejected,
  archived,
  expired;
}

@freezed
abstract class Salary with _$Salary {
  const factory Salary({
    int? min,
    int? max,
    @Default('UZS') String currency,
  }) = _Salary;

  const Salary._();

  factory Salary.fromJson(Map<String, Object?> json) => _$SalaryFromJson(json);

  bool get isNegotiable => min == null && max == null;

  String formatted() {
    if (isNegotiable) return '';
    final from = min?.toString();
    final to = max?.toString();
    if (from != null && to != null) return '$from – $to $currency';
    return '${from ?? to} $currency';
  }
}

/// Vacancy as it appears in lists.
@freezed
abstract class VacancyCard with _$VacancyCard {
  const factory VacancyCard({
    required String id,
    required String slug,
    required String title,
    required CompanySummary company,
    required int categoryId,
    required int regionId,
    int? districtId,
    Salary? salary,
    required EmploymentType employmentType,
    required WorkFormat workFormat,
    required Experience experience,
    required Schedule schedule,
    @Default([]) List<Skill> skills,
    @Default(false) bool isFeatured,
    required VacancyStatus status,
    @Default(0) int viewsCount,
    @Default(0) int applicationsCount,
    DateTime? publishedAt,
    DateTime? expiresAt,
    required DateTime createdAt,
  }) = _VacancyCard;

  const VacancyCard._();

  factory VacancyCard.fromJson(Map<String, Object?> json) => _$VacancyCardFromJson(json);
}

/// Full vacancy page.
@freezed
abstract class VacancyDetail with _$VacancyDetail {
  const factory VacancyDetail({
    required String id,
    required String slug,
    required String title,
    required CompanySummary company,
    required int categoryId,
    required int regionId,
    int? districtId,
    Salary? salary,
    required EmploymentType employmentType,
    required WorkFormat workFormat,
    required Experience experience,
    required Schedule schedule,
    @Default([]) List<Skill> skills,
    @Default(false) bool isFeatured,
    required VacancyStatus status,
    @Default(0) int viewsCount,
    @Default(0) int applicationsCount,
    DateTime? publishedAt,
    DateTime? expiresAt,
    required DateTime createdAt,
    required String description,
    String? address,
    required DateTime updatedAt,
    @Default(false) bool canEdit,
    String? rejectReason,
    DateTime? submittedAt,
  }) = _VacancyDetail;

  const VacancyDetail._();

  factory VacancyDetail.fromJson(Map<String, Object?> json) => _$VacancyDetailFromJson(json);
}
