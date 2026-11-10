// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'application.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ApplicationEvent _$ApplicationEventFromJson(Map<String, dynamic> json) =>
    _ApplicationEvent(
      from: $enumDecodeNullable(_$ApplicationStatusEnumMap, json['from']),
      to: $enumDecode(_$ApplicationStatusEnumMap, json['to']),
      note: json['note'] as String?,
      at: DateTime.parse(json['at'] as String),
    );

Map<String, dynamic> _$ApplicationEventToJson(_ApplicationEvent instance) =>
    <String, dynamic>{
      'from': _$ApplicationStatusEnumMap[instance.from],
      'to': _$ApplicationStatusEnumMap[instance.to]!,
      'note': instance.note,
      'at': instance.at.toIso8601String(),
    };

const _$ApplicationStatusEnumMap = {
  ApplicationStatus.sent: 'sent',
  ApplicationStatus.viewed: 'viewed',
  ApplicationStatus.invited: 'invited',
  ApplicationStatus.interview: 'interview',
  ApplicationStatus.hired: 'hired',
  ApplicationStatus.rejected: 'rejected',
  ApplicationStatus.withdrawn: 'withdrawn',
};

_Application _$ApplicationFromJson(Map<String, dynamic> json) => _Application(
  id: json['id'] as String,
  vacancyId: json['vacancy_id'] as String,
  resumeId: json['resume_id'] as String,
  status: $enumDecode(_$ApplicationStatusEnumMap, json['status']),
  source: $enumDecode(_$ApplicationSourceEnumMap, json['source']),
  coverLetter: json['cover_letter'] as String?,
  viewedAt: json['viewed_at'] == null
      ? null
      : DateTime.parse(json['viewed_at'] as String),
  statusChangedAt: DateTime.parse(json['status_changed_at'] as String),
  createdAt: DateTime.parse(json['created_at'] as String),
  vacancy: VacancyCard.fromJson(json['vacancy'] as Map<String, dynamic>),
  events:
      (json['events'] as List<dynamic>?)
          ?.map((e) => ApplicationEvent.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$ApplicationToJson(_Application instance) =>
    <String, dynamic>{
      'id': instance.id,
      'vacancy_id': instance.vacancyId,
      'resume_id': instance.resumeId,
      'status': _$ApplicationStatusEnumMap[instance.status]!,
      'source': _$ApplicationSourceEnumMap[instance.source]!,
      'cover_letter': instance.coverLetter,
      'viewed_at': instance.viewedAt?.toIso8601String(),
      'status_changed_at': instance.statusChangedAt.toIso8601String(),
      'created_at': instance.createdAt.toIso8601String(),
      'vacancy': instance.vacancy.toJson(),
      'events': instance.events.map((e) => e.toJson()).toList(),
    };

const _$ApplicationSourceEnumMap = {
  ApplicationSource.apply: 'apply',
  ApplicationSource.invite: 'invite',
};
