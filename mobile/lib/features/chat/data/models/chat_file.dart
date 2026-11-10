import 'package:freezed_annotation/freezed_annotation.dart';

part 'chat_file.freezed.dart';
part 'chat_file.g.dart';

@freezed
abstract class ChatFile with _$ChatFile {
  const factory ChatFile({
    required String id,
    required String contentType,
    required int size,
    required String name,
    String? url,
    Map<String, Object?>? meta,
  }) = _ChatFile;

  const ChatFile._();

  factory ChatFile.fromJson(Map<String, Object?> json) => _$ChatFileFromJson(json);

  bool get isImage => contentType.startsWith('image/');
  bool get isVoice => contentType.startsWith('audio/');
}
