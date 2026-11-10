import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../../../../core/config/app_config.dart';
import 'chat_api.dart';

/// Raw realtime event from the server. Controllers parse the type/data shape.
typedef ChatRawEvent = Map<String, Object?>;

/// Manages the WebSocket connection: ticket, reconnect with backoff, ping, and
/// fan-out of server events. The service is safe to create without connecting.
class ChatSocketService {
  ChatSocketService(this._api, this._config);

  final ChatApi _api;
  final AppConfig _config;

  final _events = StreamController<ChatRawEvent>.broadcast();
  final _online = StreamController<bool>.broadcast();

  WebSocketChannel? _channel;
  Timer? _reconnectTimer;
  Timer? _pingTimer;
  bool _wanted = false;
  int _attempt = 0;
  List<String> _watchedUserIds = [];

  Stream<ChatRawEvent> get events => _events.stream;
  Stream<bool> get online => _online.stream;

  void connect() {
    _wanted = true;
    if (_channel != null || _reconnectTimer != null) return;
    _open();
  }

  void disconnect() {
    _wanted = false;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _stopPing();
    _channel?.sink.close(1000);
    _channel = null;
  }

  void reconnectNow() {
    if (!_wanted) return;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _channel?.sink.close(1000);
    _channel = null;
    _open();
  }

  void send(Map<String, Object?> frame) {
    final channel = _channel;
    if (channel == null) return;
    try {
      channel.sink.add(jsonEncode(frame));
    } on Exception {
      // Ignore; the connection will reconnect if needed.
    }
  }

  void ping() => send({'type': 'ping'});

  void typing(String conversationId) => send({'type': 'typing', 'conversation_id': conversationId});

  void read(String conversationId, int messageId) =>
      send({'type': 'read', 'conversation_id': conversationId, 'message_id': messageId});

  void watchPresence(List<String> userIds) {
    _watchedUserIds = List.unmodifiable(userIds);
    send({'type': 'watch_presence', 'user_ids': _watchedUserIds});
  }

  Future<void> _open() async {
    _reconnectTimer = null;
    String? ticket;
    try {
      final res = await _api.ticket();
      ticket = res.ticket;
    } on Exception {
      ticket = null;
    }
    if (!_wanted) return;
    if (ticket == null) {
      _scheduleReconnect();
      return;
    }
    final wsUrl = _wsUrl(ticket);
    if (wsUrl == null) {
      _scheduleReconnect();
      return;
    }
    try {
      final channel = WebSocketChannel.connect(wsUrl);
      _channel = channel;
      channel.ready.then((_) {
        _attempt = 0;
        _online.add(true);
        _startPing();
        if (_watchedUserIds.isNotEmpty) {
          watchPresence(_watchedUserIds);
        }
      }).ignore();
      channel.stream.listen(
        (raw) {
          try {
            final event = jsonDecode(raw as String) as Map<String, Object?>;
            _events.add(event);
          } on Exception {
            // Ignore malformed frames.
          }
        },
        onDone: _onClose,
        onError: (_) => _onClose(),
      );
    } on Exception {
      _scheduleReconnect();
    }
  }

  void _onClose() {
    _stopPing();
    if (_channel == null) return;
    _channel = null;
    _online.add(false);
    if (_wanted) _scheduleReconnect();
  }

  void _scheduleReconnect() {
    if (_reconnectTimer != null || !_wanted) return;
    final delay = Duration(milliseconds: min(30000, 1000 * (1 << _attempt)) + Random().nextInt(1000));
    _attempt = min(_attempt + 1, 6);
    _reconnectTimer = Timer(delay, _open);
  }

  void _startPing() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 25), (_) => ping());
  }

  void _stopPing() {
    _pingTimer?.cancel();
    _pingTimer = null;
  }

  Uri? _wsUrl(String ticket) {
    try {
      final base = Uri.parse(_config.apiBaseUrl);
      final scheme = base.scheme == 'https' ? 'wss' : 'ws';
      final pathSegments = List<String>.from(base.pathSegments)..removeLast();
      final path = '${pathSegments.isEmpty ? "" : "/${pathSegments.join("/")}"}/ws';
      return Uri(scheme: scheme, host: base.host, port: base.port == 0 ? null : base.port, path: path, queryParameters: {'ticket': ticket});
    } on Exception {
      return null;
    }
  }
}

final chatSocketServiceProvider = Provider<ChatSocketService>((ref) {
  final service = ChatSocketService(ref.watch(chatApiProvider), ref.watch(appConfigProvider));
  ref.onDispose(service.disconnect);
  return service;
});
