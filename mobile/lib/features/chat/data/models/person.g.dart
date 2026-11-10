// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'person.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Person _$PersonFromJson(Map<String, dynamic> json) => _Person(
  id: json['id'] as String,
  fullName: json['full_name'] as String,
  avatarUrl: json['avatar_url'] as String?,
);

Map<String, dynamic> _$PersonToJson(_Person instance) => <String, dynamic>{
  'id': instance.id,
  'full_name': instance.fullName,
  'avatar_url': instance.avatarUrl,
};
