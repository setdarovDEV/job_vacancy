import 'package:freezed_annotation/freezed_annotation.dart';

import 'message.dart';
import 'person.dart';

part 'conversation.freezed.dart';
part 'conversation.g.dart';

@freezed
abstract class ConversationVacancy with _$ConversationVacancy {
  const factory ConversationVacancy({
    required String id,
    required String title,
  }) = _ConversationVacancy;

  const ConversationVacancy._();

  factory ConversationVacancy.fromJson(Map<String, Object?> json) => _$ConversationVacancyFromJson(json);
}

@freezed
abstract class ConversationCompany with _$ConversationCompany {
  const factory ConversationCompany({
    required String id,
    required String name,
    required String slug,
    String? logoUrl,
  }) = _ConversationCompany;

  const ConversationCompany._();

  factory ConversationCompany.fromJson(Map<String, Object?> json) => _$ConversationCompanyFromJson(json);
}

@freezed
abstract class Conversation with _$Conversation {
  const factory Conversation({
    required String id,
    required String applicationId,
    required ConversationVacancy vacancy,
    required ConversationCompany company,
    required Person seeker,
    required String side,
    Message? lastMessage,
    DateTime? lastMessageAt,
    @Default(0) int unread,
    @Default(0) int readUpTo,
    required DateTime createdAt,
  }) = _Conversation;

  const Conversation._();

  factory Conversation.fromJson(Map<String, Object?> json) => _$ConversationFromJson(json);

  String counterpartName(String myUserId) =>
      side == 'seeker' ? company.name : seeker.fullName;

  String? counterpartAvatar(String myUserId) =>
      side == 'seeker' ? company.logoUrl : seeker.avatarUrl;
}
