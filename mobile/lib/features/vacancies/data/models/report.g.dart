// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'report.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Report _$ReportFromJson(Map<String, dynamic> json) => _Report(
  id: json['id'] as String,
  targetType: json['target_type'] as String,
  targetId: json['target_id'] as String,
  reason: $enumDecode(_$ReportReasonEnumMap, json['reason']),
  comment: json['comment'] as String?,
  status: json['status'] as String,
  createdAt: DateTime.parse(json['created_at'] as String),
);

Map<String, dynamic> _$ReportToJson(_Report instance) => <String, dynamic>{
  'id': instance.id,
  'target_type': instance.targetType,
  'target_id': instance.targetId,
  'reason': _$ReportReasonEnumMap[instance.reason]!,
  'comment': instance.comment,
  'status': instance.status,
  'created_at': instance.createdAt.toIso8601String(),
};

const _$ReportReasonEnumMap = {
  ReportReason.fraud: 'fraud',
  ReportReason.misleading: 'misleading',
  ReportReason.offensive: 'offensive',
  ReportReason.spam: 'spam',
  ReportReason.other: 'other',
};
