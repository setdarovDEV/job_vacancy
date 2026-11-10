import 'package:freezed_annotation/freezed_annotation.dart';

part 'notification.freezed.dart';
part 'notification.g.dart';

@freezed
abstract class AppNotification with _$AppNotification {
  const factory AppNotification({
    required int id,
    required String type,
    @Default({}) Map<String, Object?> payload,
    DateTime? readAt,
    required DateTime createdAt,
  }) = _AppNotification;

  const AppNotification._();

  factory AppNotification.fromJson(Map<String, Object?> json) => _$AppNotificationFromJson(json);

  bool get isUnread => readAt == null;
}
