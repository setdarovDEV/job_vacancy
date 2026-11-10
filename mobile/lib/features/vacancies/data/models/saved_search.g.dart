// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'saved_search.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_SavedSearch _$SavedSearchFromJson(Map<String, dynamic> json) => _SavedSearch(
  id: json['id'] as String,
  name: json['name'] as String,
  params: json['params'] as String,
  notify: json['notify'] as bool? ?? false,
  createdAt: DateTime.parse(json['created_at'] as String),
);

Map<String, dynamic> _$SavedSearchToJson(_SavedSearch instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'params': instance.params,
      'notify': instance.notify,
      'created_at': instance.createdAt.toIso8601String(),
    };
