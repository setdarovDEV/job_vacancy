import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_providers.dart';
import '../models/conversation.dart';
import '../models/message.dart';

class SendMessageInput {
  SendMessageInput({
    required this.clientId,
    required this.kind,
    this.body,
    this.fileId,
    this.location,
  });

  final String clientId;
  final MessageKind kind;
  final String? body;
  final String? fileId;
  final MessageLocation? location;

  Map<String, Object?> toJson() => {
    'client_id': clientId,
    'kind': kind.apiValue,
    if (body != null && body!.isNotEmpty) 'body': body,
    if (fileId != null) 'file_id': fileId,
    if (location != null)
      'location': {'lat': location!.lat, 'lng': location!.lng, if (location!.name != null) 'name': location!.name},
  };
}

abstract interface class ChatApi {
  Future<({String ticket, int expiresIn})> ticket();
  Future<Page<Conversation>> conversations({String? cursor, int limit = 20});
  Future<Conversation> conversation(String id);
  Future<Conversation> openApplicationConversation(String applicationId);
  Future<Page<Message>> messages(String conversationId, {int? before, int? after, int limit = 30});
  Future<Message> sendMessage(String conversationId, SendMessageInput input);
  Future<void> markRead(String conversationId, int messageId);
  Future<int> unreadCount();
}

class HttpChatApi implements ChatApi {
  HttpChatApi(this._api);
  final ApiClient _api;

  static final _conversation = decodeObject(Conversation.fromJson);
  static final _message = decodeObject(Message.fromJson);

  @override
  Future<({String ticket, int expiresIn})> ticket() async {
    final data = await _api.post<Map<String, Object?>>(
      '/ws/ticket',
      decode: decodeObject((d) => d),
    );
    return (
      ticket: data['ticket'] as String,
      expiresIn: (data['expires_in'] as num?)?.toInt() ?? 30,
    );
  }

  @override
  Future<Page<Conversation>> conversations({String? cursor, int limit = 20}) => _api.getPage(
    '/conversations',
    item: (json) => _conversation(json),
    query: {if (cursor != null) 'cursor': cursor, 'limit': limit},
  );

  @override
  Future<Conversation> conversation(String id) => _api.get('/conversations/$id', decode: _conversation);

  @override
  Future<Conversation> openApplicationConversation(String applicationId) => _api.post(
    '/applications/$applicationId/conversation',
    decode: _conversation,
  );

  @override
  Future<Page<Message>> messages(String conversationId, {int? before, int? after, int limit = 30}) => _api.getPage(
    '/conversations/$conversationId/messages',
    item: (json) => _message(json),
    query: {if (before != null) 'before': before, if (after != null) 'after': after, 'limit': limit},
  );

  @override
  Future<Message> sendMessage(String conversationId, SendMessageInput input) => _api.post(
    '/conversations/$conversationId/messages',
    decode: _message,
    body: input.toJson(),
  );

  @override
  Future<void> markRead(String conversationId, int messageId) => _api.postVoid(
    '/conversations/$conversationId/read',
    body: {'message_id': messageId},
  );

  @override
  Future<int> unreadCount() async {
    final data = await _api.get<Map<String, Object?>>(
      '/conversations/unread-count',
      decode: decodeObject((d) => d),
    );
    return (data['conversations'] as num?)?.toInt() ?? 0;
  }
}

final chatApiProvider = Provider<ChatApi>((ref) => HttpChatApi(ref.watch(apiClientProvider)));
