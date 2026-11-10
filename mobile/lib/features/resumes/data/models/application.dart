import 'package:freezed_annotation/freezed_annotation.dart';

import '../../../vacancies/data/models/vacancy.dart';

part 'application.freezed.dart';
part 'application.g.dart';

@JsonEnum()
enum ApplicationStatus {
  @JsonValue('sent') sent,
  @JsonValue('viewed') viewed,
  @JsonValue('invited') invited,
  @JsonValue('interview') interview,
  @JsonValue('hired') hired,
  @JsonValue('rejected') rejected,
  @JsonValue('withdrawn') withdrawn;

  String get apiValue => switch (this) {
    sent => 'sent',
    viewed => 'viewed',
    invited => 'invited',
    interview => 'interview',
    hired => 'hired',
    rejected => 'rejected',
    withdrawn => 'withdrawn',
  };
}

@JsonEnum()
enum ApplicationSource {
  @JsonValue('apply') apply,
  @JsonValue('invite') invite;
}

@freezed
abstract class ApplicationEvent with _$ApplicationEvent {
  const factory ApplicationEvent({
    ApplicationStatus? from,
    required ApplicationStatus to,
    String? note,
    required DateTime at,
  }) = _ApplicationEvent;

  const ApplicationEvent._();

  factory ApplicationEvent.fromJson(Map<String, Object?> json) => _$ApplicationEventFromJson(json);
}

@freezed
abstract class Application with _$Application {
  const factory Application({
    required String id,
    required String vacancyId,
    required String resumeId,
    required ApplicationStatus status,
    required ApplicationSource source,
    String? coverLetter,
    DateTime? viewedAt,
    required DateTime statusChangedAt,
    required DateTime createdAt,
    required VacancyCard vacancy,
    @Default([]) List<ApplicationEvent> events,
  }) = _Application;

  const Application._();

  factory Application.fromJson(Map<String, Object?> json) => _$ApplicationFromJson(json);
}

/// Body for applying to a vacancy.
class ApplyInput {
  ApplyInput({required this.resumeId, this.coverLetter});

  final String resumeId;
  final String? coverLetter;

  Map<String, Object?> toJson() => {
    'resume_id': resumeId,
    if (coverLetter != null && coverLetter!.isNotEmpty) 'cover_letter': coverLetter,
  };
}
