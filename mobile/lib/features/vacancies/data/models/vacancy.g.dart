// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'vacancy.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Salary _$SalaryFromJson(Map<String, dynamic> json) => _Salary(
  min: (json['min'] as num?)?.toInt(),
  max: (json['max'] as num?)?.toInt(),
  currency: json['currency'] as String? ?? 'UZS',
);

Map<String, dynamic> _$SalaryToJson(_Salary instance) => <String, dynamic>{
  'min': instance.min,
  'max': instance.max,
  'currency': instance.currency,
};

_VacancyCard _$VacancyCardFromJson(Map<String, dynamic> json) => _VacancyCard(
  id: json['id'] as String,
  slug: json['slug'] as String,
  title: json['title'] as String,
  company: CompanySummary.fromJson(json['company'] as Map<String, dynamic>),
  categoryId: (json['category_id'] as num).toInt(),
  regionId: (json['region_id'] as num).toInt(),
  districtId: (json['district_id'] as num?)?.toInt(),
  salary: json['salary'] == null
      ? null
      : Salary.fromJson(json['salary'] as Map<String, dynamic>),
  employmentType: $enumDecode(_$EmploymentTypeEnumMap, json['employment_type']),
  workFormat: $enumDecode(_$WorkFormatEnumMap, json['work_format']),
  experience: $enumDecode(_$ExperienceEnumMap, json['experience']),
  schedule: $enumDecode(_$ScheduleEnumMap, json['schedule']),
  skills:
      (json['skills'] as List<dynamic>?)
          ?.map((e) => Skill.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  isFeatured: json['is_featured'] as bool? ?? false,
  status: $enumDecode(_$VacancyStatusEnumMap, json['status']),
  viewsCount: (json['views_count'] as num?)?.toInt() ?? 0,
  applicationsCount: (json['applications_count'] as num?)?.toInt() ?? 0,
  publishedAt: json['published_at'] == null
      ? null
      : DateTime.parse(json['published_at'] as String),
  expiresAt: json['expires_at'] == null
      ? null
      : DateTime.parse(json['expires_at'] as String),
  createdAt: DateTime.parse(json['created_at'] as String),
);

Map<String, dynamic> _$VacancyCardToJson(_VacancyCard instance) =>
    <String, dynamic>{
      'id': instance.id,
      'slug': instance.slug,
      'title': instance.title,
      'company': instance.company.toJson(),
      'category_id': instance.categoryId,
      'region_id': instance.regionId,
      'district_id': instance.districtId,
      'salary': instance.salary?.toJson(),
      'employment_type': _$EmploymentTypeEnumMap[instance.employmentType]!,
      'work_format': _$WorkFormatEnumMap[instance.workFormat]!,
      'experience': _$ExperienceEnumMap[instance.experience]!,
      'schedule': _$ScheduleEnumMap[instance.schedule]!,
      'skills': instance.skills.map((e) => e.toJson()).toList(),
      'is_featured': instance.isFeatured,
      'status': _$VacancyStatusEnumMap[instance.status]!,
      'views_count': instance.viewsCount,
      'applications_count': instance.applicationsCount,
      'published_at': instance.publishedAt?.toIso8601String(),
      'expires_at': instance.expiresAt?.toIso8601String(),
      'created_at': instance.createdAt.toIso8601String(),
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

const _$ExperienceEnumMap = {
  Experience.none: 'none',
  Experience.oneToThree: '1_3',
  Experience.threeToSix: '3_6',
  Experience.sixPlus: '6_plus',
};

const _$ScheduleEnumMap = {
  Schedule.fullDay: 'full_day',
  Schedule.shift: 'shift',
  Schedule.flexible: 'flexible',
  Schedule.rotation: 'rotation',
};

const _$VacancyStatusEnumMap = {
  VacancyStatus.draft: 'draft',
  VacancyStatus.moderation: 'moderation',
  VacancyStatus.published: 'published',
  VacancyStatus.rejected: 'rejected',
  VacancyStatus.archived: 'archived',
  VacancyStatus.expired: 'expired',
};

_VacancyDetail _$VacancyDetailFromJson(Map<String, dynamic> json) =>
    _VacancyDetail(
      id: json['id'] as String,
      slug: json['slug'] as String,
      title: json['title'] as String,
      company: CompanySummary.fromJson(json['company'] as Map<String, dynamic>),
      categoryId: (json['category_id'] as num).toInt(),
      regionId: (json['region_id'] as num).toInt(),
      districtId: (json['district_id'] as num?)?.toInt(),
      salary: json['salary'] == null
          ? null
          : Salary.fromJson(json['salary'] as Map<String, dynamic>),
      employmentType: $enumDecode(
        _$EmploymentTypeEnumMap,
        json['employment_type'],
      ),
      workFormat: $enumDecode(_$WorkFormatEnumMap, json['work_format']),
      experience: $enumDecode(_$ExperienceEnumMap, json['experience']),
      schedule: $enumDecode(_$ScheduleEnumMap, json['schedule']),
      skills:
          (json['skills'] as List<dynamic>?)
              ?.map((e) => Skill.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      isFeatured: json['is_featured'] as bool? ?? false,
      status: $enumDecode(_$VacancyStatusEnumMap, json['status']),
      viewsCount: (json['views_count'] as num?)?.toInt() ?? 0,
      applicationsCount: (json['applications_count'] as num?)?.toInt() ?? 0,
      publishedAt: json['published_at'] == null
          ? null
          : DateTime.parse(json['published_at'] as String),
      expiresAt: json['expires_at'] == null
          ? null
          : DateTime.parse(json['expires_at'] as String),
      createdAt: DateTime.parse(json['created_at'] as String),
      description: json['description'] as String,
      address: json['address'] as String?,
      updatedAt: DateTime.parse(json['updated_at'] as String),
      canEdit: json['can_edit'] as bool? ?? false,
      rejectReason: json['reject_reason'] as String?,
      submittedAt: json['submitted_at'] == null
          ? null
          : DateTime.parse(json['submitted_at'] as String),
    );

Map<String, dynamic> _$VacancyDetailToJson(_VacancyDetail instance) =>
    <String, dynamic>{
      'id': instance.id,
      'slug': instance.slug,
      'title': instance.title,
      'company': instance.company.toJson(),
      'category_id': instance.categoryId,
      'region_id': instance.regionId,
      'district_id': instance.districtId,
      'salary': instance.salary?.toJson(),
      'employment_type': _$EmploymentTypeEnumMap[instance.employmentType]!,
      'work_format': _$WorkFormatEnumMap[instance.workFormat]!,
      'experience': _$ExperienceEnumMap[instance.experience]!,
      'schedule': _$ScheduleEnumMap[instance.schedule]!,
      'skills': instance.skills.map((e) => e.toJson()).toList(),
      'is_featured': instance.isFeatured,
      'status': _$VacancyStatusEnumMap[instance.status]!,
      'views_count': instance.viewsCount,
      'applications_count': instance.applicationsCount,
      'published_at': instance.publishedAt?.toIso8601String(),
      'expires_at': instance.expiresAt?.toIso8601String(),
      'created_at': instance.createdAt.toIso8601String(),
      'description': instance.description,
      'address': instance.address,
      'updated_at': instance.updatedAt.toIso8601String(),
      'can_edit': instance.canEdit,
      'reject_reason': instance.rejectReason,
      'submitted_at': instance.submittedAt?.toIso8601String(),
    };
