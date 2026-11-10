import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/chat_socket.dart';
import '../data/models/conversation.dart';
import '../data/models/message.dart';
import '../data/repositories/chat_repository.dart';

class ConversationsState {
  ConversationsState({
    required this.items,
    this.nextCursor,
    this.hasMore = true,
    this.isLoadingMore = false,
  });

  final List<Conversation> items;
  final String? nextCursor;
  final bool hasMore;
  final bool isLoadingMore;

  ConversationsState copyWith({
    List<Conversation>? items,
    String? nextCursor,
    bool? hasMore,
    bool? isLoadingMore,
  }) => ConversationsState(
    items: items ?? this.items,
    nextCursor: nextCursor ?? this.nextCursor,
    hasMore: hasMore ?? this.hasMore,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
  );
}

class ConversationsController extends AsyncNotifier<ConversationsState> {
  ChatRepository get _repo => ref.read(chatRepositoryProvider);
  ChatSocketService get _socket => ref.read(chatSocketServiceProvider);
  StreamSubscription<ChatRawEvent>? _sub;

  @override
  Future<ConversationsState> build() async {
    await _sub?.cancel();
    _sub = _socket.events.listen(_onEvent);
    ref.onDispose(() => _sub?.cancel());
    final page = await _repo.conversations();
    return ConversationsState(
      items: page.items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final page = await _repo.conversations();
      return ConversationsState(items: page.items, nextCursor: page.nextCursor, hasMore: page.hasMore);
    });
  }

  Future<void> loadMore() async {
    final value = state.value;
    if (value == null || !value.hasMore || value.isLoadingMore || state.isLoading) return;
    state = AsyncData(value.copyWith(isLoadingMore: true));
    try {
      final page = await _repo.conversations(cursor: value.nextCursor);
      state = AsyncData(
        value.copyWith(
          items: [...value.items, ...page.items],
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          isLoadingMore: false,
        ),
      );
    } catch (e, st) {
      state = AsyncError(e, st);
    }
  }

  void patchLastMessage(String conversationId, Message message) {
    final value = state.value;
    if (value == null) return;
    final index = value.items.indexWhere((c) => c.id == conversationId);
    if (index < 0) {
      // A brand new conversation; refresh the list to pick it up.
      unawaited(refresh());
      return;
    }
    final updated = value.items[index].copyWith(
      lastMessage: message,
      lastMessageAt: message.createdAt,
      unread: message.sender == null ? value.items[index].unread + 1 : value.items[index].unread,
    );
    final newItems = [...value.items]..[index] = updated;
    // Move updated conversation to the top.
    newItems.removeAt(index);
    newItems.insert(0, updated);
    state = AsyncData(value.copyWith(items: newItems));
  }

  void patchRead(String conversationId, int messageId) {
    final value = state.value;
    if (value == null) return;
    final index = value.items.indexWhere((c) => c.id == conversationId);
    if (index < 0) return;
    final conv = value.items[index];
    if (messageId >= conv.readUpTo) {
      final updated = conv.copyWith(readUpTo: messageId, unread: 0);
      final items = [...value.items]..[index] = updated;
      state = AsyncData(value.copyWith(items: items));
    }
  }

  void _onEvent(ChatRawEvent event) {
    final type = event['type'] as String?;
    final data = event['data'] as Map<String, Object?>?;
    if (data == null) return;
    switch (type) {
      case 'message.new':
        try {
          final message = Message.fromJson(data);
          patchLastMessage(message.conversationId, message);
        } on Exception {
          // Ignore malformed realtime events.
        }
      case 'message.read':
        final conversationId = data['conversation_id'] as String?;
        final messageId = (data['message_id'] as num?)?.toInt();
        if (conversationId != null && messageId != null) patchRead(conversationId, messageId);
    }
  }
}

final conversationsControllerProvider = AsyncNotifierProvider<ConversationsController, ConversationsState>(
  ConversationsController.new,
);
