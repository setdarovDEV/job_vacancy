import 'dart:async';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/auth/session.dart';
import '../core/notifications/local_notification_service.dart';
import '../core/notifications/push_notification_service.dart';
import '../features/notifications/data/api/notifications_api.dart';

/// Watches the signed-in state and push token lifecycle and keeps the backend
/// device-token list in sync (`POST /me/devices`, `DELETE /me/devices/{token}`).
class PushTokenRegistrar extends AsyncNotifier<void> {
  NotificationsApi get _api => ref.read(notificationsApiProvider);
  PushNotificationService get _push => ref.read(pushNotificationServiceProvider);
  LocalNotificationService get _local => ref.read(localNotificationServiceProvider);
  StreamSubscription<String>? _tokenSub;
  StreamSubscription<PushMessage>? _messageSub;
  String? _lastToken;

  @override
  Future<void> build() async {
    await _local.initialize();

    await _tokenSub?.cancel();
    _tokenSub = _push.onRegistered.listen((token) {
      _lastToken = token;
      unawaited(_register(token));
    });

    await _messageSub?.cancel();
    _messageSub = _push.foregroundMessages.listen((message) async {
      await _local.show(message);
    });

    ref.onDispose(() {
      _tokenSub?.cancel().ignore();
      _messageSub?.cancel().ignore();
    });

    final session = ref.read(sessionProvider);
    if (session is SignedIn) {
      await _push.initialize();
      await _push.register();
    }

    ref.listen<SessionState>(sessionProvider, (_, next) async {
      if (next is SignedIn) {
        await _push.initialize();
        await _push.register();
      } else {
        final token = _lastToken;
        _lastToken = null;
        if (token != null && token.isNotEmpty) {
          await _delete(token);
        }
        await _push.unregister();
      }
    });
  }

  Future<void> _register(String token) async {
    if (token.isEmpty) return;
    final session = ref.read(sessionProvider);
    if (session is! SignedIn) return;
    try {
      await _api.registerDeviceToken(
        token: token,
        platform: Platform.isIOS ? 'ios' : 'android',
      );
    } on Exception {
      // Best effort; FCM will retry on next token refresh.
    }
  }

  Future<void> _delete(String token) async {
    try {
      await _api.deleteDeviceToken(token);
    } on Exception {
      // Best effort.
    }
  }
}

final pushTokenRegistrarProvider = AsyncNotifierProvider<PushTokenRegistrar, void>(
  PushTokenRegistrar.new,
);
