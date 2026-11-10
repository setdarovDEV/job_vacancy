import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:uuid/uuid.dart';

import '../../../core/api/file_api.dart';
import '../data/api/chat_api.dart';
import '../data/api/chat_socket.dart';
import '../data/models/message.dart';
import '../data/repositories/chat_repository.dart';
import 'conversations_controller.dart';

class MessagesState {
  MessagesState({
    this.items = const [],
    this.hasMore = true,
    this.isLoadingMore = false,
    this.readUpTo = 0,
  });

  final List<Message> items;
  final bool hasMore;
  final bool isLoadingMore;
  final int readUpTo;

  MessagesState copyWith({
    List<Message>? items,
    bool? hasMore,
    bool? isLoadingMore,
    int? readUpTo,
  }) => MessagesState(
    items: items ?? this.items,
    hasMore: hasMore ?? this.hasMore,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    readUpTo: readUpTo ?? this.readUpTo,
  );
}

final messagesStateProvider = StateProvider.family<MessagesState, String>((ref, _) => MessagesState());

/// Per-conversation controller. The provider keeps the controller alive as long
/// as something watches the corresponding messages state.
class MessagesController {
  MessagesController(this._ref, this._conversationId);

  final Ref _ref;
  final String _conversationId;

  ChatRepository get _repo => _ref.read(chatRepositoryProvider);
  ChatSocketService get _socket => _ref.read(chatSocketServiceProvider);
  StateController<MessagesState> get _state => _ref.read(messagesStateProvider(_conversationId).notifier);

  StreamSubscription<ChatRawEvent>? _sub;

  void init() {
    _sub?.cancel().ignore();
    _sub = _socket.events.listen(_onEvent);
    _ref.onDispose(() => _sub?.cancel().ignore());
    loadInitial();
  }

  Future<void> loadInitial() async {
    _setState(_state.state.copyWith(isLoadingMore: true));
    try {
      final page = await _repo.messages(_conversationId, limit: 30);
      final readUpTo = await _fetchReadUpTo();
      _setState(MessagesState(
        items: page.items,
        hasMore: page.hasMore,
        readUpTo: readUpTo,
        isLoadingMore: false,
      ));
    } on Exception catch (_) {
      _setState(_state.state.copyWith(isLoadingMore: false));
      rethrow;
    }
  }

  Future<void> refresh() async {
    await loadInitial();
  }

  Future<void> loadMore() async {
    final value = _state.state;
    if (!value.hasMore || value.isLoadingMore || value.items.isEmpty) return;
    _setState(value.copyWith(isLoadingMore: true));
    try {
      final oldest = value.items.lastOrNull;
      final page = await _repo.messages(_conversationId, before: oldest?.id, limit: 30);
      _setState(value.copyWith(
        items: [...value.items, ...page.items],
        hasMore: page.hasMore,
        isLoadingMore: false,
      ));
    } on Exception catch (_) {
      _setState(value.copyWith(isLoadingMore: false));
      rethrow;
    }
  }

  Future<Message?> send(SendMessageInput input) async {
    final value = _state.state;
    final optimistic = Message(
      id: 0,
      conversationId: _conversationId,
      kind: input.kind,
      body: input.body ?? '',
      location: input.location,
      clientId: input.clientId,
      createdAt: DateTime.now(),
      pending: true,
    );
    _setState(value.copyWith(items: [optimistic, ...value.items]));
    try {
      final sent = await _repo.sendMessage(_conversationId, input);
      final items = [...value.items];
      final index = items.indexWhere((m) => m.clientId == input.clientId && m.pending);
      if (index >= 0) {
        items[index] = sent;
      } else {
        items.insert(0, sent);
      }
      _setState(value.copyWith(items: items));
      _ref.read(conversationsControllerProvider.notifier).patchLastMessage(_conversationId, sent);
      return sent;
    } on Exception {
      final items = [...value.items];
      final index = items.indexWhere((m) => m.clientId == input.clientId && m.pending);
      if (index >= 0) {
        items[index] = items[index].copyWith(pending: false, failed: true);
      }
      _setState(value.copyWith(items: items));
      return null;
    }
  }

  /// Uploads a file (image, voice, generic file) and sends the matching message.
  Future<Message?> sendFileMessage({
    required MessageKind kind,
    required Uint8List bytes,
    required String contentType,
    String? name,
    String? caption,
  }) async {
    final purpose = switch (kind) {
      MessageKind.image => FilePurpose.chatImage,
      MessageKind.voice => FilePurpose.chatVoice,
      _ => FilePurpose.chatFile,
    };
    final fileApi = _ref.read(fileApiProvider);
    final instructions = await fileApi.createUpload(
      purpose: purpose,
      contentType: contentType,
      size: bytes.length,
      name: name,
    );
    await fileApi.uploadBytes(
      url: instructions.url,
      fields: instructions.fields,
      bytes: bytes,
      name: name ?? 'file',
    );
    final uploaded = await fileApi.complete(instructions.fileId);
    final input = SendMessageInput(
      clientId: const Uuid().v4(),
      kind: kind,
      body: caption,
      fileId: uploaded.id,
    );
    return send(input);
  }

  /// Sends a location message without a file upload.
  Future<Message?> sendLocation({required double lat, required double lng, String? name}) async {
    final input = SendMessageInput(
      clientId: const Uuid().v4(),
      kind: MessageKind.location,
      body: name,
      location: MessageLocation(lat: lat, lng: lng, name: name),
    );
    return send(input);
  }

  Future<void> markRead(int messageId) async {
    final value = _state.state;
    if (messageId <= value.readUpTo) return;
    _setState(value.copyWith(readUpTo: messageId));
    _socket.read(_conversationId, messageId);
    try {
      await _repo.markRead(_conversationId, messageId);
    } on Exception {
      // Best effort; the socket frame already moved the local marker.
    }
  }

  void retry(Message message) {
    if (!message.failed || message.clientId.isEmpty) return;
    final input = SendMessageInput(
      clientId: message.clientId,
      kind: message.kind,
      body: message.body,
      location: message.location,
    );
    send(input).ignore();
  }

  Future<int> _fetchReadUpTo() async {
    try {
      final conv = await _repo.conversation(_conversationId);
      return conv.readUpTo;
    } on Exception {
      return 0;
    }
  }

  void _setState(MessagesState value) => _state.state = value;

  void _onEvent(ChatRawEvent event) {
    final type = event['type'] as String?;
    final data = event['data'] as Map<String, Object?>?;
    if (data == null) return;
    switch (type) {
      case 'message.new':
        try {
          final message = Message.fromJson(data);
          if (message.conversationId != _conversationId) return;
          final value = _state.state;
          final existing = value.items.indexWhere((m) => m.clientId == message.clientId && m.id == 0);
          if (existing >= 0) {
            final items = [...value.items]..[existing] = message;
            _setState(value.copyWith(items: items));
          } else if (!value.items.any((m) => m.id == message.id)) {
            _setState(value.copyWith(items: [message, ...value.items]));
          }
        } on Exception {
          // Ignore malformed events.
        }
      case 'message.read':
        final conversationId = data['conversation_id'] as String?;
        final messageId = (data['message_id'] as num?)?.toInt();
        if (conversationId == _conversationId && messageId != null) {
          _setState(_state.state.copyWith(readUpTo: messageId));
        }
    }
  }
}

final messagesControllerProvider = Provider.family<MessagesController, String>((ref, id) {
  final controller = MessagesController(ref, id);
  controller.init();
  return controller;
});
