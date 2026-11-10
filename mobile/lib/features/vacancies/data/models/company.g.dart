// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'company.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_CompanySummary _$CompanySummaryFromJson(Map<String, dynamic> json) =>
    _CompanySummary(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      logoUrl: json['logo_url'] as String?,
      verified: json['verified'] as bool? ?? false,
    );

Map<String, dynamic> _$CompanySummaryToJson(_CompanySummary instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'slug': instance.slug,
      'logo_url': instance.logoUrl,
      'verified': instance.verified,
    };

_Company _$CompanyFromJson(Map<String, dynamic> json) => _Company(
  id: json['id'] as String,
  slug: json['slug'] as String,
  name: json['name'] as String,
  logoUrl: json['logo_url'] as String?,
  coverUrl: json['cover_url'] as String?,
  verified: json['verified'] as bool? ?? false,
  createdAt: DateTime.parse(json['created_at'] as String),
  about: json['about'] as String?,
  industryId: (json['industry_id'] as num?)?.toInt(),
  size: $enumDecodeNullable(
    _$CompanySizeEnumMap,
    json['size'],
    unknownValue: CompanySize.one10,
  ),
  website: json['website'] as String?,
  email: json['email'] as String?,
  phone: json['phone'] as String?,
  regionId: (json['region_id'] as num?)?.toInt(),
  address: json['address'] as String?,
  foundedYear: (json['founded_year'] as num?)?.toInt(),
  openVacancies: (json['open_vacancies'] as num?)?.toInt(),
);

Map<String, dynamic> _$CompanyToJson(_Company instance) => <String, dynamic>{
  'id': instance.id,
  'slug': instance.slug,
  'name': instance.name,
  'logo_url': instance.logoUrl,
  'cover_url': instance.coverUrl,
  'verified': instance.verified,
  'created_at': instance.createdAt.toIso8601String(),
  'about': instance.about,
  'industry_id': instance.industryId,
  'size': _$CompanySizeEnumMap[instance.size],
  'website': instance.website,
  'email': instance.email,
  'phone': instance.phone,
  'region_id': instance.regionId,
  'address': instance.address,
  'founded_year': instance.foundedYear,
  'open_vacancies': instance.openVacancies,
};

const _$CompanySizeEnumMap = {
  CompanySize.one10: '1-10',
  CompanySize.eleven50: '11-50',
  CompanySize.fiftyOne200: '51-200',
  CompanySize.twoHundredOne500: '201-500',
  CompanySize.fiveHundredOne1000: '501-1000',
  CompanySize.thousandPlus: '1000+',
};
