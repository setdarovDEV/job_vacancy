// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'resume.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ResumePerson _$ResumePersonFromJson(Map<String, dynamic> json) =>
    _ResumePerson(
      id: json['id'] as String,
      fullName: json['full_name'] as String,
      avatarUrl: json['avatar_url'] as String?,
    );

Map<String, dynamic> _$ResumePersonToJson(_ResumePerson instance) =>
    <String, dynamic>{
      'id': instance.id,
      'full_name': instance.fullName,
      'avatar_url': instance.avatarUrl,
    };

_ResumeSalary _$ResumeSalaryFromJson(Map<String, dynamic> json) =>
    _ResumeSalary(
      amount: (json['amount'] as num).toInt(),
      currency: json['currency'] as String? ?? 'UZS',
    );

Map<String, dynamic> _$ResumeSalaryToJson(_ResumeSalary instance) =>
    <String, dynamic>{'amount': instance.amount, 'currency': instance.currency};

_ResumeLastJob _$ResumeLastJobFromJson(Map<String, dynamic> json) =>
    _ResumeLastJob(
      position: json['position'] as String,
      company: json['company'] as String,
      current: json['current'] as bool? ?? false,
    );

Map<String, dynamic> _$ResumeLastJobToJson(_ResumeLastJob instance) =>
    <String, dynamic>{
      'position': instance.position,
      'company': instance.company,
      'current': instance.current,
    };

_ResumeExperience _$ResumeExperienceFromJson(Map<String, dynamic> json) =>
    _ResumeExperience(
      company: json['company'] as String,
      position: json['position'] as String,
      start: json['start'] as String,
      end: json['end'] as String?,
      description: json['description'] as String?,
    );

Map<String, dynamic> _$ResumeExperienceToJson(_ResumeExperience instance) =>
    <String, dynamic>{
      'company': instance.company,
      'position': instance.position,
      'start': instance.start,
      'end': instance.end,
      'description': instance.description,
    };

_ResumeEducation _$ResumeEducationFromJson(Map<String, dynamic> json) =>
    _ResumeEducation(
      institution: json['institution'] as String,
      level: $enumDecode(_$ResumeEducationLevelEnumMap, json['level']),
      field: json['field'] as String?,
      startYear: (json['start_year'] as num?)?.toInt(),
      endYear: (json['end_year'] as num?)?.toInt(),
    );

Map<String, dynamic> _$ResumeEducationToJson(_ResumeEducation instance) =>
    <String, dynamic>{
      'institution': instance.institution,
      'level': _$ResumeEducationLevelEnumMap[instance.level]!,
      'field': instance.field,
      'start_year': instance.startYear,
      'end_year': instance.endYear,
    };

const _$ResumeEducationLevelEnumMap = {
  ResumeEducationLevel.secondary: 'secondary',
  ResumeEducationLevel.vocational: 'vocational',
  ResumeEducationLevel.incompleteHigher: 'incomplete_higher',
  ResumeEducationLevel.bachelor: 'bachelor',
  ResumeEducationLevel.master: 'master',
  ResumeEducationLevel.phd: 'phd',
};

_ResumeLanguage _$ResumeLanguageFromJson(Map<String, dynamic> json) =>
    _ResumeLanguage(
      language: json['language'] as String,
      level: $enumDecode(_$ResumeLanguageLevelEnumMap, json['level']),
    );

Map<String, dynamic> _$ResumeLanguageToJson(_ResumeLanguage instance) =>
    <String, dynamic>{
      'language': instance.language,
      'level': _$ResumeLanguageLevelEnumMap[instance.level]!,
    };

const _$ResumeLanguageLevelEnumMap = {
  ResumeLanguageLevel.a1: 'a1',
  ResumeLanguageLevel.a2: 'a2',
  ResumeLanguageLevel.b1: 'b1',
  ResumeLanguageLevel.b2: 'b2',
  ResumeLanguageLevel.c1: 'c1',
  ResumeLanguageLevel.c2: 'c2',
  ResumeLanguageLevel.native: 'native',
};

_ResumeContacts _$ResumeContactsFromJson(Map<String, dynamic> json) =>
    _ResumeContacts(
      email: json['email'] as String?,
      phone: json['phone'] as String?,
    );

Map<String, dynamic> _$ResumeContactsToJson(_ResumeContacts instance) =>
    <String, dynamic>{'email': instance.email, 'phone': instance.phone};

_ResumeCard _$ResumeCardFromJson(Map<String, dynamic> json) => _ResumeCard(
  id: json['id'] as String,
  title: json['title'] as String,
  person: ResumePerson.fromJson(json['person'] as Map<String, dynamic>),
  categoryId: (json['category_id'] as num?)?.toInt(),
  regionId: (json['region_id'] as num?)?.toInt(),
  relocate: json['relocate'] as bool? ?? false,
  experienceMonths: (json['experience_months'] as num?)?.toInt() ?? 0,
  desiredSalary: json['desired_salary'] == null
      ? null
      : ResumeSalary.fromJson(json['desired_salary'] as Map<String, dynamic>),
  lastJob: json['last_job'] == null
      ? null
      : ResumeLastJob.fromJson(json['last_job'] as Map<String, dynamic>),
  skills:
      (json['skills'] as List<dynamic>?)
          ?.map((e) => Skill.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  visibility:
      $enumDecodeNullable(_$ResumeVisibilityEnumMap, json['visibility']) ??
      ResumeVisibility.hidden,
  updatedAt: DateTime.parse(json['updated_at'] as String),
);

Map<String, dynamic> _$ResumeCardToJson(_ResumeCard instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'person': instance.person.toJson(),
      'category_id': instance.categoryId,
      'region_id': instance.regionId,
      'relocate': instance.relocate,
      'experience_months': instance.experienceMonths,
      'desired_salary': instance.desiredSalary?.toJson(),
      'last_job': instance.lastJob?.toJson(),
      'skills': instance.skills.map((e) => e.toJson()).toList(),
      'visibility': _$ResumeVisibilityEnumMap[instance.visibility]!,
      'updated_at': instance.updatedAt.toIso8601String(),
    };

const _$ResumeVisibilityEnumMap = {
  ResumeVisibility.public: 'public',
  ResumeVisibility.appliedOnly: 'applied_only',
  ResumeVisibility.hidden: 'hidden',
};

_ResumeDetail _$ResumeDetailFromJson(Map<String, dynamic> json) =>
    _ResumeDetail(
      id: json['id'] as String,
      title: json['title'] as String,
      person: ResumePerson.fromJson(json['person'] as Map<String, dynamic>),
      categoryId: (json['category_id'] as num?)?.toInt(),
      regionId: (json['region_id'] as num?)?.toInt(),
      relocate: json['relocate'] as bool? ?? false,
      experienceMonths: (json['experience_months'] as num?)?.toInt() ?? 0,
      desiredSalary: json['desired_salary'] == null
          ? null
          : ResumeSalary.fromJson(
              json['desired_salary'] as Map<String, dynamic>,
            ),
      lastJob: json['last_job'] == null
          ? null
          : ResumeLastJob.fromJson(json['last_job'] as Map<String, dynamic>),
      skills:
          (json['skills'] as List<dynamic>?)
              ?.map((e) => Skill.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      visibility:
          $enumDecodeNullable(_$ResumeVisibilityEnumMap, json['visibility']) ??
          ResumeVisibility.hidden,
      updatedAt: DateTime.parse(json['updated_at'] as String),
      about: json['about'] as String?,
      employmentTypes:
          (json['employment_types'] as List<dynamic>?)
              ?.map((e) => $enumDecode(_$EmploymentTypeEnumMap, e))
              .toList() ??
          const [],
      workFormats:
          (json['work_formats'] as List<dynamic>?)
              ?.map((e) => $enumDecode(_$WorkFormatEnumMap, e))
              .toList() ??
          const [],
      experiences:
          (json['experiences'] as List<dynamic>?)
              ?.map((e) => ResumeExperience.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      educations:
          (json['educations'] as List<dynamic>?)
              ?.map((e) => ResumeEducation.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      languages:
          (json['languages'] as List<dynamic>?)
              ?.map((e) => ResumeLanguage.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      contacts: json['contacts'] == null
          ? null
          : ResumeContacts.fromJson(json['contacts'] as Map<String, dynamic>),
      isOwner: json['is_owner'] as bool? ?? false,
    );

Map<String, dynamic> _$ResumeDetailToJson(_ResumeDetail instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'person': instance.person.toJson(),
      'category_id': instance.categoryId,
      'region_id': instance.regionId,
      'relocate': instance.relocate,
      'experience_months': instance.experienceMonths,
      'desired_salary': instance.desiredSalary?.toJson(),
      'last_job': instance.lastJob?.toJson(),
      'skills': instance.skills.map((e) => e.toJson()).toList(),
      'visibility': _$ResumeVisibilityEnumMap[instance.visibility]!,
      'updated_at': instance.updatedAt.toIso8601String(),
      'about': instance.about,
      'employment_types': instance.employmentTypes
          .map((e) => _$EmploymentTypeEnumMap[e]!)
          .toList(),
      'work_formats': instance.workFormats
          .map((e) => _$WorkFormatEnumMap[e]!)
          .toList(),
      'experiences': instance.experiences.map((e) => e.toJson()).toList(),
      'educations': instance.educations.map((e) => e.toJson()).toList(),
      'languages': instance.languages.map((e) => e.toJson()).toList(),
      'contacts': instance.contacts?.toJson(),
      'is_owner': instance.isOwner,
    };

const _$EmploymentTypeEnumMap = {
  EmploymentType.fullTime: 'full_time',
  EmploymentType.partTime: 'part_time',
  EmploymentType.project: 'project',
  EmploymentType.internship: 'internship',
  EmploymentType.volunteer: 'volunteer',
};

const _$WorkFormatEnumMap = {
  WorkFormat.office: 'office',
  WorkFormat.remote: 'remote',
  WorkFormat.hybrid: 'hybrid',
};

_ResumeInput _$ResumeInputFromJson(Map<String, dynamic> json) => _ResumeInput(
  title: json['title'] as String,
  about: json['about'] as String?,
  categoryId: (json['category_id'] as num?)?.toInt(),
  regionId: (json['region_id'] as num?)?.toInt(),
  relocate: json['relocate'] as bool? ?? false,
  desiredSalary: (json['desired_salary'] as num?)?.toInt(),
  currency: json['currency'] as String? ?? 'UZS',
  employmentTypes:
      (json['employment_types'] as List<dynamic>?)
          ?.map((e) => $enumDecode(_$EmploymentTypeEnumMap, e))
          .toList() ??
      const [],
  workFormats:
      (json['work_formats'] as List<dynamic>?)
          ?.map((e) => $enumDecode(_$WorkFormatEnumMap, e))
          .toList() ??
      const [],
  visibility:
      $enumDecodeNullable(_$ResumeVisibilityEnumMap, json['visibility']) ??
      ResumeVisibility.hidden,
  experiences:
      (json['experiences'] as List<dynamic>?)
          ?.map((e) => ResumeExperience.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  educations:
      (json['educations'] as List<dynamic>?)
          ?.map((e) => ResumeEducation.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  skills:
      (json['skills'] as List<dynamic>?)?.map((e) => e as String).toList() ??
      const [],
  languages:
      (json['languages'] as List<dynamic>?)
          ?.map((e) => ResumeLanguage.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$ResumeInputToJson(_ResumeInput instance) =>
    <String, dynamic>{
      'title': instance.title,
      'about': instance.about,
      'category_id': instance.categoryId,
      'region_id': instance.regionId,
      'relocate': instance.relocate,
      'desired_salary': instance.desiredSalary,
      'currency': instance.currency,
      'employment_types': instance.employmentTypes
          .map((e) => _$EmploymentTypeEnumMap[e]!)
          .toList(),
      'work_formats': instance.workFormats
          .map((e) => _$WorkFormatEnumMap[e]!)
          .toList(),
      'visibility': _$ResumeVisibilityEnumMap[instance.visibility]!,
      'experiences': instance.experiences.map((e) => e.toJson()).toList(),
      'educations': instance.educations.map((e) => e.toJson()).toList(),
      'skills': instance.skills,
      'languages': instance.languages.map((e) => e.toJson()).toList(),
    };
