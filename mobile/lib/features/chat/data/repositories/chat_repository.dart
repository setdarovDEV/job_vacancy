import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../api/chat_api.dart';
import '../models/conversation.dart';
import '../models/message.dart';

class ChatRepository {
  ChatRepository(this._api);
  final ChatApi _api;

  Future<Page<Conversation>> conversations({String? cursor, int limit = 20}) =>
      _api.conversations(cursor: cursor, limit: limit);

  Future<Conversation> conversation(String id) => _api.conversation(id);

  Future<Conversation> openApplicationConversation(String applicationId) =>
      _api.openApplicationConversation(applicationId);

  Future<Page<Message>> messages(String conversationId, {int? before, int? after, int limit = 30}) =>
      _api.messages(conversationId, before: before, after: after, limit: limit);

  Future<Message> sendMessage(String conversationId, SendMessageInput input) =>
      _api.sendMessage(conversationId, input);

  Future<void> markRead(String conversationId, int messageId) => _api.markRead(conversationId, messageId);

  Future<int> unreadCount() => _api.unreadCount();
}

final chatRepositoryProvider = Provider<ChatRepository>((ref) => ChatRepository(ref.watch(chatApiProvider)));
