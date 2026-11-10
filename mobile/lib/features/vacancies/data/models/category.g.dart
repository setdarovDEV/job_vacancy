// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'category.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Category _$CategoryFromJson(Map<String, dynamic> json) => _Category(
  id: (json['id'] as num).toInt(),
  slug: json['slug'] as String,
  name: Names.fromJson(json['name'] as Map<String, dynamic>),
  icon: json['icon'] as String?,
  children:
      (json['children'] as List<dynamic>?)
          ?.map((e) => Category.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$CategoryToJson(_Category instance) => <String, dynamic>{
  'id': instance.id,
  'slug': instance.slug,
  'name': instance.name.toJson(),
  'icon': instance.icon,
  'children': instance.children.map((e) => e.toJson()).toList(),
};
