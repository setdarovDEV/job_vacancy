import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mime/mime.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:uuid/uuid.dart';

import '../../../../core/auth/session.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/tokens.dart';
import '../../data/api/chat_api.dart';
import '../../data/api/chat_socket.dart';
import '../../data/models/conversation.dart';
import '../../data/models/message.dart';
import '../../providers/conversation_provider.dart';
import '../../providers/messages_controller.dart';
import '../widgets/attachment_bottom_sheet.dart';
import '../widgets/message_bubble.dart';

class ChatScreen extends ConsumerWidget {
  const ChatScreen({super.key, required this.conversationId});
  final String conversationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversationAsync = ref.watch(conversationProvider(conversationId));
    return conversationAsync.when(
      data: (conversation) => _ChatBody(conversation: conversation),
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: _ErrorBody(error: e, onRetry: () => ref.invalidate(conversationProvider(conversationId))),
      ),
    );
  }
}

class _ChatBody extends ConsumerStatefulWidget {
  const _ChatBody({required this.conversation});
  final Conversation conversation;

  @override
  ConsumerState<_ChatBody> createState() => _ChatBodyState();
}

class _ChatBodyState extends ConsumerState<_ChatBody> {
  final _scrollController = ScrollController();
  final _inputController = TextEditingController();
  final _record = AudioRecorder();
  bool _isNearBottom = true;
  bool _typing = false;
  Timer? _typingClearTimer;
  StreamSubscription<ChatRawEvent>? _typingSub;
  bool _isRecording = false;
  Timer? _typingThrottle;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _initMessages();
    _listenTyping();
  }

  void _initMessages() {
    ref.read(messagesControllerProvider(widget.conversation.id));
    WidgetsBinding.instance.addPostFrameCallback((_) => _markReadIfNeeded());
  }

  void _listenTyping() {
    final socket = ref.read(chatSocketServiceProvider);
    _typingSub = socket.events.listen((event) {
      final type = event['type'] as String?;
      final data = event['data'] as Map<String, Object?>?;
      if (type == 'typing' && data?['conversation_id'] == widget.conversation.id) {
        setState(() => _typing = true);
        _typingClearTimer?.cancel();
        _typingClearTimer = Timer(const Duration(seconds: 3), () {
          if (mounted) setState(() => _typing = false);
        });
      }
    });
  }

  void _onScroll() {
    _isNearBottom = _scrollController.position.pixels <= 100;
  }

  void _markReadIfNeeded() {
    final state = ref.read(messagesStateProvider(widget.conversation.id));
    final latest = state.items.firstOrNull;
    if (latest != null && latest.sender != null) {
      ref.read(messagesControllerProvider(widget.conversation.id)).markRead(latest.id);
    }
  }

  void _maybeSendTyping() {
    if (_typingThrottle != null) return;
    ref.read(chatSocketServiceProvider).typing(widget.conversation.id);
    _typingThrottle = Timer(const Duration(seconds: 2), () => _typingThrottle = null);
  }

  Future<void> _sendText() async {
    final text = _inputController.text.trim();
    if (text.isEmpty) return;
    _inputController.clear();
    await _sendMessage(
      SendMessageInput(clientId: const Uuid().v4(), kind: MessageKind.text, body: text),
    );
  }

  Future<void> _sendMessage(SendMessageInput input) async {
    await ref.read(messagesControllerProvider(widget.conversation.id)).send(input);
    if (_isNearBottom) {
      unawaited(_scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      ));
    }
  }

  Future<void> _pickAttachment() async {
    final choice = await showModalBottomSheet<AttachmentChoice>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => const AttachmentBottomSheet(),
    );
    switch (choice) {
      case AttachmentChoice.gallery:
        await _pickImage(ImageSource.gallery);
      case AttachmentChoice.camera:
        await _pickImage(ImageSource.camera);
      case AttachmentChoice.file:
        await _pickFile();
      case AttachmentChoice.location:
        await _sendCurrentLocation();
      case null:
        break;
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: source, imageQuality: 85);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    final name = file.name;
    final mime = lookupMimeType(name) ?? 'image/jpeg';
    if (!mounted) return;
    await ref.read(messagesControllerProvider(widget.conversation.id)).sendFileMessage(
      kind: MessageKind.image,
      bytes: bytes,
      contentType: mime,
      name: name,
    );
    _scrollToBottom();
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(withData: true);
    final file = result?.files.single;
    if (file == null || file.bytes == null) return;
    final name = file.name;
    final mime = lookupMimeType(name) ?? 'application/octet-stream';
    await ref.read(messagesControllerProvider(widget.conversation.id)).sendFileMessage(
      kind: MessageKind.file,
      bytes: file.bytes!,
      contentType: mime,
      name: name,
    );
    _scrollToBottom();
  }

  Future<void> _sendCurrentLocation() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (mounted) _showSnack(context.l10n.chatLocationServiceDisabled);
      return;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      if (mounted) _showSnack(context.l10n.chatLocationPermissionDenied);
      return;
    }
    final position = await Geolocator.getCurrentPosition();
    await ref.read(messagesControllerProvider(widget.conversation.id)).sendLocation(
      lat: position.latitude,
      lng: position.longitude,
    );
    _scrollToBottom();
  }

  Future<void> _toggleRecording() async {
    if (_isRecording) {
      await _stopRecording();
    } else {
      await _startRecording();
    }
  }

  Future<void> _startRecording() async {
    final hasPermission = await _record.hasPermission();
    if (!hasPermission) {
      if (mounted) _showSnack(context.l10n.chatMicrophonePermissionDenied);
      return;
    }
    final path = '${(await getTemporaryDirectory()).path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _record.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
    setState(() => _isRecording = true);
  }

  Future<void> _stopRecording() async {
    final path = await _record.stop();
    setState(() => _isRecording = false);
    if (path == null) return;
    final file = File(path);
    if (!await file.exists()) return;
    final bytes = await file.readAsBytes();
    await ref.read(messagesControllerProvider(widget.conversation.id)).sendFileMessage(
      kind: MessageKind.voice,
      bytes: bytes,
      contentType: 'audio/m4a',
      name: 'voice_message.m4a',
    );
    _scrollToBottom();
  }

  void _scrollToBottom() {
    if (_isNearBottom) {
      unawaited(_scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      ));
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _inputController.dispose();
    _typingClearTimer?.cancel();
    _typingThrottle?.cancel();
    _typingSub?.cancel();
    _record.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final user = ref.watch(currentUserProvider);
    final myId = user?.id ?? '';
    final name = widget.conversation.counterpartName(myId);
    final avatar = widget.conversation.counterpartAvatar(myId);
    final messagesState = ref.watch(messagesStateProvider(widget.conversation.id));

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: Row(
          children: [
            CircleAvatar(
              radius: 16,
              backgroundImage: avatar != null ? NetworkImage(avatar) : null,
              child: avatar == null ? Text(name.isEmpty ? '?' : name[0].toUpperCase()) : null,
            ),
            const SizedBox(width: AppSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: context.text.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (_typing)
                    Text(l.chatTyping, style: context.text.bodySmall?.copyWith(color: context.colors.firuza)),
                ],
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _MessageList(
              conversationId: widget.conversation.id,
              state: messagesState,
              myId: myId,
              scrollController: _scrollController,
            ),
          ),
          _Composer(
            controller: _inputController,
            isRecording: _isRecording,
            onSend: _sendText,
            onAttachment: _pickAttachment,
            onToggleRecord: _toggleRecording,
            onTextChanged: (_) => _maybeSendTyping(),
          ),
        ],
      ),
    );
  }
}

class _MessageList extends ConsumerWidget {
  const _MessageList({
    required this.conversationId,
    required this.state,
    required this.myId,
    required this.scrollController,
  });

  final String conversationId;
  final MessagesState state;
  final String myId;
  final ScrollController scrollController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    if (state.items.isEmpty && !state.isLoadingMore) {
      return Center(child: Text(l.chatEmpty, style: context.text.bodyLarge?.copyWith(color: context.colors.ink2)));
    }
    return ListView.builder(
      controller: scrollController,
      reverse: true,
      padding: const EdgeInsets.fromLTRB(AppSpace.lg, AppSpace.sm, AppSpace.lg, AppSpace.lg),
      itemCount: state.items.length + (state.hasMore || state.isLoadingMore ? 1 : 0),
      itemBuilder: (_, i) {
        if (i == state.items.length) {
          if (!state.isLoadingMore) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              ref.read(messagesControllerProvider(conversationId)).loadMore();
            });
          }
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpace.lg),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        final message = state.items[i];
        final isMe = message.sender == null;
        return MessageBubble(
          message: message,
          isMe: isMe,
          read: isMe && message.id <= state.readUpTo,
          onRetry: message.failed
              ? () => ref.read(messagesControllerProvider(conversationId)).retry(message)
              : null,
        );
      },
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.isRecording,
    required this.onSend,
    required this.onAttachment,
    required this.onToggleRecord,
    required this.onTextChanged,
  });

  final TextEditingController controller;
  final bool isRecording;
  final VoidCallback onSend;
  final VoidCallback onAttachment;
  final VoidCallback onToggleRecord;
  final ValueChanged<String> onTextChanged;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final c = context.colors;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpace.lg, AppSpace.sm, AppSpace.lg, AppSpace.lg),
        child: Row(
          children: [
            IconButton.outlined(
              onPressed: onAttachment,
              icon: const Icon(Icons.add),
            ),
            const SizedBox(width: AppSpace.sm),
            Expanded(
              child: isRecording
                  ? Container(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpace.md, vertical: AppSpace.md),
                      decoration: BoxDecoration(
                        color: c.anorSoft,
                        borderRadius: BorderRadius.circular(AppRadii.control),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.mic, color: c.anor),
                          const SizedBox(width: AppSpace.sm),
                          Text(l.chatRecording, style: context.text.bodyMedium?.copyWith(color: c.anor)),
                        ],
                      ),
                    )
                  : TextField(
                      controller: controller,
                      minLines: 1,
                      maxLines: 5,
                      textInputAction: TextInputAction.newline,
                      onChanged: onTextChanged,
                      decoration: InputDecoration(
                        hintText: l.chatInputHint,
                        filled: true,
                        fillColor: c.surface,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadii.control),
                          borderSide: BorderSide.none,
                        ),
                      ),
                      onSubmitted: (_) => onSend(),
                    ),
            ),
            const SizedBox(width: AppSpace.sm),
            IconButton.outlined(
              onPressed: onToggleRecord,
              icon: Icon(isRecording ? Icons.stop : Icons.mic),
            ),
            const SizedBox(width: AppSpace.sm),
            IconButton.filled(
              onPressed: onSend,
              icon: const Icon(Icons.send),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(ErrorTexts.of(context).message(error) ?? l.errorsInternalError, textAlign: TextAlign.center),
            const SizedBox(height: AppSpace.lg),
            FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: Text(l.commonRetry)),
          ],
        ),
      ),
    );
  }
}
