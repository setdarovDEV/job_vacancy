// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'region.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Region _$RegionFromJson(Map<String, dynamic> json) => _Region(
  id: (json['id'] as num).toInt(),
  slug: json['slug'] as String,
  kind: $enumDecode(_$RegionKindEnumMap, json['kind']),
  name: Names.fromJson(json['name'] as Map<String, dynamic>),
  children:
      (json['children'] as List<dynamic>?)
          ?.map((e) => Region.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$RegionToJson(_Region instance) => <String, dynamic>{
  'id': instance.id,
  'slug': instance.slug,
  'kind': _$RegionKindEnumMap[instance.kind]!,
  'name': instance.name.toJson(),
  'children': instance.children.map((e) => e.toJson()).toList(),
};

const _$RegionKindEnumMap = {
  RegionKind.region: 'region',
  RegionKind.city: 'city',
  RegionKind.district: 'district',
};
