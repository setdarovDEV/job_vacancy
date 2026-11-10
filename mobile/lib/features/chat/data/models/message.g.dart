// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'message.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_MessageLocation _$MessageLocationFromJson(Map<String, dynamic> json) =>
    _MessageLocation(
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      name: json['name'] as String?,
    );

Map<String, dynamic> _$MessageLocationToJson(_MessageLocation instance) =>
    <String, dynamic>{
      'lat': instance.lat,
      'lng': instance.lng,
      'name': instance.name,
    };

_Message _$MessageFromJson(Map<String, dynamic> json) => _Message(
  id: (json['id'] as num).toInt(),
  conversationId: json['conversation_id'] as String,
  sender: json['sender'] == null
      ? null
      : Person.fromJson(json['sender'] as Map<String, dynamic>),
  kind: $enumDecode(_$MessageKindEnumMap, json['kind']),
  body: json['body'] as String? ?? '',
  file: json['file'] == null
      ? null
      : ChatFile.fromJson(json['file'] as Map<String, dynamic>),
  location: json['location'] == null
      ? null
      : MessageLocation.fromJson(json['location'] as Map<String, dynamic>),
  clientId: json['client_id'] as String,
  createdAt: DateTime.parse(json['created_at'] as String),
  deleted: json['deleted'] as bool? ?? false,
  pending: json['pending'] as bool? ?? false,
  failed: json['failed'] as bool? ?? false,
);

Map<String, dynamic> _$MessageToJson(_Message instance) => <String, dynamic>{
  'id': instance.id,
  'conversation_id': instance.conversationId,
  'sender': instance.sender?.toJson(),
  'kind': _$MessageKindEnumMap[instance.kind]!,
  'body': instance.body,
  'file': instance.file?.toJson(),
  'location': instance.location?.toJson(),
  'client_id': instance.clientId,
  'created_at': instance.createdAt.toIso8601String(),
  'deleted': instance.deleted,
  'pending': instance.pending,
  'failed': instance.failed,
};

const _$MessageKindEnumMap = {
  MessageKind.text: 'text',
  MessageKind.image: 'image',
  MessageKind.file: 'file',
  MessageKind.voice: 'voice',
  MessageKind.location: 'location',
  MessageKind.system: 'system',
};
