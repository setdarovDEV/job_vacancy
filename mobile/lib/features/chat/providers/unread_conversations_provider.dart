import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/chat_socket.dart';
import '../data/repositories/chat_repository.dart';

class UnreadConversationsNotifier extends AsyncNotifier<int> {
  ChatRepository get _repo => ref.read(chatRepositoryProvider);
  ChatSocketService get _socket => ref.read(chatSocketServiceProvider);
  StreamSubscription<ChatRawEvent>? _sub;

  @override
  Future<int> build() async {
    await _sub?.cancel();
    _sub = _socket.events.listen(_onEvent);
    ref.onDispose(() => _sub?.cancel());
    return _repo.unreadCount();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_repo.unreadCount);
  }

  void _onEvent(ChatRawEvent event) {
    final type = event['type'] as String?;
    if (type == 'message.new' || type == 'message.read') {
      unawaited(refresh());
    }
  }
}

final unreadConversationsProvider = AsyncNotifierProvider<UnreadConversationsNotifier, int>(
  UnreadConversationsNotifier.new,
);
