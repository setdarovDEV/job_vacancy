// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_User _$UserFromJson(Map<String, dynamic> json) => _User(
  id: json['id'] as String,
  fullName: json['full_name'] as String,
  role: $enumDecode(_$UserRoleEnumMap, json['role'], unknownValue: UserRole.unknown),
  locale: json['locale'] as String,
  email: json['email'] as String?,
  emailVerified: json['email_verified'] as bool? ?? false,
  phone: json['phone'] as String?,
  phoneVerified: json['phone_verified'] as bool? ?? false,
  avatarUrl: json['avatar_url'] as String?,
  hasPassword: json['has_password'] as bool? ?? false,
  googleLinked: json['google_linked'] as bool? ?? false,
  createdAt: json['created_at'] == null ? null : DateTime.parse(json['created_at'] as String),
);

Map<String, dynamic> _$UserToJson(_User instance) => <String, dynamic>{
  'id': instance.id,
  'full_name': instance.fullName,
  'role': _$UserRoleEnumMap[instance.role]!,
  'locale': instance.locale,
  'email': instance.email,
  'email_verified': instance.emailVerified,
  'phone': instance.phone,
  'phone_verified': instance.phoneVerified,
  'avatar_url': instance.avatarUrl,
  'has_password': instance.hasPassword,
  'google_linked': instance.googleLinked,
  'created_at': instance.createdAt?.toIso8601String(),
};

const _$UserRoleEnumMap = {
  UserRole.seeker: 'seeker',
  UserRole.employer: 'employer',
  UserRole.admin: 'admin',
  UserRole.unknown: 'unknown',
};
