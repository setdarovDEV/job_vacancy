import 'package:freezed_annotation/freezed_annotation.dart';

import '../../../vacancies/data/models/skill.dart';
import '../../../vacancies/data/models/vacancy.dart';

part 'resume.freezed.dart';
part 'resume.g.dart';

@JsonEnum()
enum ResumeVisibility {
  @JsonValue('public') public,
  @JsonValue('applied_only') appliedOnly,
  @JsonValue('hidden') hidden;

  String get apiValue => switch (this) {
    public => 'public',
    appliedOnly => 'applied_only',
    hidden => 'hidden',
  };
}

@JsonEnum()
enum ResumeEducationLevel {
  @JsonValue('secondary') secondary,
  @JsonValue('vocational') vocational,
  @JsonValue('incomplete_higher') incompleteHigher,
  @JsonValue('bachelor') bachelor,
  @JsonValue('master') master,
  @JsonValue('phd') phd;

  String get apiValue => switch (this) {
    secondary => 'secondary',
    vocational => 'vocational',
    incompleteHigher => 'incomplete_higher',
    bachelor => 'bachelor',
    master => 'master',
    phd => 'phd',
  };
}

@JsonEnum()
enum ResumeLanguageLevel {
  @JsonValue('a1') a1,
  @JsonValue('a2') a2,
  @JsonValue('b1') b1,
  @JsonValue('b2') b2,
  @JsonValue('c1') c1,
  @JsonValue('c2') c2,
  @JsonValue('native') native;

  String get apiValue => switch (this) {
    a1 => 'a1',
    a2 => 'a2',
    b1 => 'b1',
    b2 => 'b2',
    c1 => 'c1',
    c2 => 'c2',
    native => 'native',
  };
}

@freezed
abstract class ResumePerson with _$ResumePerson {
  const factory ResumePerson({
    required String id,
    required String fullName,
    String? avatarUrl,
  }) = _ResumePerson;

  const ResumePerson._();

  factory ResumePerson.fromJson(Map<String, Object?> json) => _$ResumePersonFromJson(json);
}

@freezed
abstract class ResumeSalary with _$ResumeSalary {
  const factory ResumeSalary({
    required int amount,
    @Default('UZS') String currency,
  }) = _ResumeSalary;

  const ResumeSalary._();

  factory ResumeSalary.fromJson(Map<String, Object?> json) => _$ResumeSalaryFromJson(json);

  String formatted() => '$amount $currency';
}

@freezed
abstract class ResumeLastJob with _$ResumeLastJob {
  const factory ResumeLastJob({
    required String position,
    required String company,
    @Default(false) bool current,
  }) = _ResumeLastJob;

  const ResumeLastJob._();

  factory ResumeLastJob.fromJson(Map<String, Object?> json) => _$ResumeLastJobFromJson(json);
}

@freezed
abstract class ResumeExperience with _$ResumeExperience {
  const factory ResumeExperience({
    required String company,
    required String position,
    required String start,
    String? end,
    String? description,
  }) = _ResumeExperience;

  const ResumeExperience._();

  factory ResumeExperience.fromJson(Map<String, Object?> json) => _$ResumeExperienceFromJson(json);
}

@freezed
abstract class ResumeEducation with _$ResumeEducation {
  const factory ResumeEducation({
    required String institution,
    required ResumeEducationLevel level,
    String? field,
    int? startYear,
    int? endYear,
  }) = _ResumeEducation;

  const ResumeEducation._();

  factory ResumeEducation.fromJson(Map<String, Object?> json) => _$ResumeEducationFromJson(json);
}

@freezed
abstract class ResumeLanguage with _$ResumeLanguage {
  const factory ResumeLanguage({
    required String language,
    required ResumeLanguageLevel level,
  }) = _ResumeLanguage;

  const ResumeLanguage._();

  factory ResumeLanguage.fromJson(Map<String, Object?> json) => _$ResumeLanguageFromJson(json);
}

@freezed
abstract class ResumeContacts with _$ResumeContacts {
  const factory ResumeContacts({
    String? email,
    String? phone,
  }) = _ResumeContacts;

  const ResumeContacts._();

  factory ResumeContacts.fromJson(Map<String, Object?> json) => _$ResumeContactsFromJson(json);
}

/// Resume as it appears in lists (search, my resumes).
@freezed
abstract class ResumeCard with _$ResumeCard {
  const factory ResumeCard({
    required String id,
    required String title,
    required ResumePerson person,
    int? categoryId,
    int? regionId,
    @Default(false) bool relocate,
    @Default(0) int experienceMonths,
    ResumeSalary? desiredSalary,
    ResumeLastJob? lastJob,
    @Default([]) List<Skill> skills,
    @Default(ResumeVisibility.hidden) ResumeVisibility visibility,
    required DateTime updatedAt,
  }) = _ResumeCard;

  const ResumeCard._();

  factory ResumeCard.fromJson(Map<String, Object?> json) => _$ResumeCardFromJson(json);
}

/// Full resume page.
@freezed
abstract class ResumeDetail with _$ResumeDetail {
  const factory ResumeDetail({
    required String id,
    required String title,
    required ResumePerson person,
    int? categoryId,
    int? regionId,
    @Default(false) bool relocate,
    @Default(0) int experienceMonths,
    ResumeSalary? desiredSalary,
    ResumeLastJob? lastJob,
    @Default([]) List<Skill> skills,
    @Default(ResumeVisibility.hidden) ResumeVisibility visibility,
    required DateTime updatedAt,
    String? about,
    @Default([]) List<EmploymentType> employmentTypes,
    @Default([]) List<WorkFormat> workFormats,
    @Default([]) List<ResumeExperience> experiences,
    @Default([]) List<ResumeEducation> educations,
    @Default([]) List<ResumeLanguage> languages,
    ResumeContacts? contacts,
    @Default(false) bool isOwner,
  }) = _ResumeDetail;

  const ResumeDetail._();

  factory ResumeDetail.fromJson(Map<String, Object?> json) => _$ResumeDetailFromJson(json);
}

/// Body for creating or replacing a resume.
@freezed
abstract class ResumeInput with _$ResumeInput {
  const factory ResumeInput({
    required String title,
    String? about,
    int? categoryId,
    int? regionId,
    @Default(false) bool relocate,
    int? desiredSalary,
    @Default('UZS') String currency,
    @Default([]) List<EmploymentType> employmentTypes,
    @Default([]) List<WorkFormat> workFormats,
    @Default(ResumeVisibility.hidden) ResumeVisibility visibility,
    @Default([]) List<ResumeExperience> experiences,
    @Default([]) List<ResumeEducation> educations,
    @Default([]) List<String> skills,
    @Default([]) List<ResumeLanguage> languages,
  }) = _ResumeInput;

  const ResumeInput._();

  factory ResumeInput.fromJson(Map<String, Object?> json) => _$ResumeInputFromJson(json);

  /// Builds an input from an existing detail, so the editor can start filled.
  factory ResumeInput.fromDetail(ResumeDetail detail) => ResumeInput(
    title: detail.title,
    about: detail.about,
    categoryId: detail.categoryId,
    regionId: detail.regionId,
    relocate: detail.relocate,
    desiredSalary: detail.desiredSalary?.amount,
    currency: detail.desiredSalary?.currency ?? 'UZS',
    employmentTypes: detail.employmentTypes,
    workFormats: detail.workFormats,
    visibility: detail.visibility,
    experiences: detail.experiences,
    educations: detail.educations,
    skills: detail.skills.map((s) => s.name).toList(),
    languages: detail.languages,
  );
}
