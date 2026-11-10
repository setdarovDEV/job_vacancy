import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/conversation.dart';
import '../data/repositories/chat_repository.dart';

final conversationProvider = FutureProvider.family<Conversation, String>((ref, id) async {
  return ref.watch(chatRepositoryProvider).conversation(id);
});
