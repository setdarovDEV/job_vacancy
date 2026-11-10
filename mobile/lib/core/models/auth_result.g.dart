// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_AuthResult _$AuthResultFromJson(Map<String, dynamic> json) => _AuthResult(
  user: User.fromJson(json['user'] as Map<String, dynamic>),
  accessToken: json['access_token'] as String,
  accessTokenExpiresAt: DateTime.parse(
    json['access_token_expires_at'] as String,
  ),
  accessTokenExpiresIn: (json['access_token_expires_in'] as num?)?.toInt(),
  refreshToken: json['refresh_token'] as String,
  refreshTokenExpiresAt: json['refresh_token_expires_at'] == null
      ? null
      : DateTime.parse(json['refresh_token_expires_at'] as String),
  isNewUser: json['is_new_user'] as bool? ?? false,
);

Map<String, dynamic> _$AuthResultToJson(
  _AuthResult instance,
) => <String, dynamic>{
  'user': instance.user.toJson(),
  'access_token': instance.accessToken,
  'access_token_expires_at': instance.accessTokenExpiresAt.toIso8601String(),
  'access_token_expires_in': instance.accessTokenExpiresIn,
  'refresh_token': instance.refreshToken,
  'refresh_token_expires_at': instance.refreshTokenExpiresAt?.toIso8601String(),
  'is_new_user': instance.isNewUser,
};

_Tokens _$TokensFromJson(Map<String, dynamic> json) => _Tokens(
  accessToken: json['access_token'] as String,
  accessTokenExpiresAt: DateTime.parse(
    json['access_token_expires_at'] as String,
  ),
  refreshToken: json['refresh_token'] as String,
);

Map<String, dynamic> _$TokensToJson(_Tokens instance) => <String, dynamic>{
  'access_token': instance.accessToken,
  'access_token_expires_at': instance.accessTokenExpiresAt.toIso8601String(),
  'refresh_token': instance.refreshToken,
};
