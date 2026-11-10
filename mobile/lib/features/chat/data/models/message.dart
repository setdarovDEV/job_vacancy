import 'package:freezed_annotation/freezed_annotation.dart';

import 'chat_file.dart';
import 'person.dart';

part 'message.freezed.dart';
part 'message.g.dart';

@JsonEnum()
enum MessageKind {
  @JsonValue('text') text,
  @JsonValue('image') image,
  @JsonValue('file') file,
  @JsonValue('voice') voice,
  @JsonValue('location') location,
  @JsonValue('system') system;

  String get apiValue => switch (this) {
    text => 'text',
    image => 'image',
    file => 'file',
    voice => 'voice',
    location => 'location',
    system => 'system',
  };
}

@freezed
abstract class MessageLocation with _$MessageLocation {
  const factory MessageLocation({
    required double lat,
    required double lng,
    String? name,
  }) = _MessageLocation;

  const MessageLocation._();

  factory MessageLocation.fromJson(Map<String, Object?> json) => _$MessageLocationFromJson(json);
}

@freezed
abstract class Message with _$Message {
  const factory Message({
    required int id,
    required String conversationId,
    Person? sender,
    required MessageKind kind,
    @Default('') String body,
    ChatFile? file,
    MessageLocation? location,
    required String clientId,
    required DateTime createdAt,
    @Default(false) bool deleted,

    /// Client-only: message is still being sent.
    @Default(false) bool pending,

    /// Client-only: sending failed.
    @Default(false) bool failed,
  }) = _Message;

  const Message._();

  factory Message.fromJson(Map<String, Object?> json) => _$MessageFromJson(json);

  bool get isMine => sender != null; // The backend only returns a sender for messages from the other side.
}
