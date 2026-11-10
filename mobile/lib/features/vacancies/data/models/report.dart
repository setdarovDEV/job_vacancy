import 'package:freezed_annotation/freezed_annotation.dart';

part 'report.freezed.dart';
part 'report.g.dart';

@JsonEnum()
enum ReportReason {
  @JsonValue('fraud') fraud,
  @JsonValue('misleading') misleading,
  @JsonValue('offensive') offensive,
  @JsonValue('spam') spam,
  @JsonValue('other') other;

  String get apiValue => switch (this) {
    fraud => 'fraud',
    misleading => 'misleading',
    offensive => 'offensive',
    spam => 'spam',
    other => 'other',
  };
}

@freezed
abstract class Report with _$Report {
  const factory Report({
    required String id,
    required String targetType,
    required String targetId,
    required ReportReason reason,
    String? comment,
    required String status,
    required DateTime createdAt,
  }) = _Report;

  const Report._();

  factory Report.fromJson(Map<String, Object?> json) => _$ReportFromJson(json);
}
