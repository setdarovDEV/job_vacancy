// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'conversation.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ConversationVacancy _$ConversationVacancyFromJson(Map<String, dynamic> json) =>
    _ConversationVacancy(
      id: json['id'] as String,
      title: json['title'] as String,
    );

Map<String, dynamic> _$ConversationVacancyToJson(
  _ConversationVacancy instance,
) => <String, dynamic>{'id': instance.id, 'title': instance.title};

_ConversationCompany _$ConversationCompanyFromJson(Map<String, dynamic> json) =>
    _ConversationCompany(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      logoUrl: json['logo_url'] as String?,
    );

Map<String, dynamic> _$ConversationCompanyToJson(
  _ConversationCompany instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'slug': instance.slug,
  'logo_url': instance.logoUrl,
};

_Conversation _$ConversationFromJson(Map<String, dynamic> json) =>
    _Conversation(
      id: json['id'] as String,
      applicationId: json['application_id'] as String,
      vacancy: ConversationVacancy.fromJson(
        json['vacancy'] as Map<String, dynamic>,
      ),
      company: ConversationCompany.fromJson(
        json['company'] as Map<String, dynamic>,
      ),
      seeker: Person.fromJson(json['seeker'] as Map<String, dynamic>),
      side: json['side'] as String,
      lastMessage: json['last_message'] == null
          ? null
          : Message.fromJson(json['last_message'] as Map<String, dynamic>),
      lastMessageAt: json['last_message_at'] == null
          ? null
          : DateTime.parse(json['last_message_at'] as String),
      unread: (json['unread'] as num?)?.toInt() ?? 0,
      readUpTo: (json['read_up_to'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(json['created_at'] as String),
    );

Map<String, dynamic> _$ConversationToJson(_Conversation instance) =>
    <String, dynamic>{
      'id': instance.id,
      'application_id': instance.applicationId,
      'vacancy': instance.vacancy.toJson(),
      'company': instance.company.toJson(),
      'seeker': instance.seeker.toJson(),
      'side': instance.side,
      'last_message': instance.lastMessage?.toJson(),
      'last_message_at': instance.lastMessageAt?.toIso8601String(),
      'unread': instance.unread,
      'read_up_to': instance.readUpTo,
      'created_at': instance.createdAt.toIso8601String(),
    };
