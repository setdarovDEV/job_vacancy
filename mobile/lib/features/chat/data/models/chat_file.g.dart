// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'chat_file.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ChatFile _$ChatFileFromJson(Map<String, dynamic> json) => _ChatFile(
  id: json['id'] as String,
  contentType: json['content_type'] as String,
  size: (json['size'] as num).toInt(),
  name: json['name'] as String,
  url: json['url'] as String?,
  meta: json['meta'] as Map<String, dynamic>?,
);

Map<String, dynamic> _$ChatFileToJson(_ChatFile instance) => <String, dynamic>{
  'id': instance.id,
  'content_type': instance.contentType,
  'size': instance.size,
  'name': instance.name,
  'url': instance.url,
  'meta': instance.meta,
};
