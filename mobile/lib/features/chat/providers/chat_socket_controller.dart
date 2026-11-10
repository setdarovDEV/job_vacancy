import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/session.dart';
import '../data/api/chat_socket.dart';

/// Keeps the WebSocket alive while the user is signed in.
class ChatSocketController extends AsyncNotifier<void> {
  ChatSocketService get _service => ref.read(chatSocketServiceProvider);

  @override
  Future<void> build() async {
    _onSession(ref.read(sessionProvider));
    ref.listen<SessionState>(sessionProvider, (_, next) => _onSession(next));
    return;
  }

  void _onSession(SessionState session) {
    if (session is SignedIn) {
      _service.connect();
    } else {
      _service.disconnect();
    }
  }
}

final chatSocketControllerProvider = AsyncNotifierProvider<ChatSocketController, void>(ChatSocketController.new);
