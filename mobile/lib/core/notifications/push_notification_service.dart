import 'dart:async';
import 'dart:developer';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// A push message normalized across FCM and other backends.
class PushMessage {
  const PushMessage({this.title, this.body, required this.data});
  final String? title;
  final String? body;
  final Map<String, String> data;
}

/// Abstract push service. The app talks to this; the concrete backend (FCM, no-op)
/// is swapped by the provider.
abstract interface class PushNotificationService {
  /// One-time setup: request permissions, configure handlers, etc.
  Future<void> initialize();

  /// Registers this device for push notifications.
  Future<void> register();

  /// Unregisters this device from push notifications.
  Future<void> unregister();

  /// New registration tokens (or refreshed tokens). Listeners should send them to
  /// the backend (`POST /me/devices`).
  Stream<String> get onRegistered;

  /// The device was unregistered; listeners should delete the token from the backend.
  Stream<String> get onUnregistered;

  /// Messages received while the app is in the foreground.
  Stream<PushMessage> get foregroundMessages;
}

/// No-op implementation used until Firebase config files are added.
class NoopPushNotificationService implements PushNotificationService {
  final _registered = StreamController<String>.broadcast();
  final _unregistered = StreamController<String>.broadcast();

  @override
  Future<void> initialize() async {
    log('Push notifications are disabled (no Firebase config).');
  }

  @override
  Future<void> register() async {}

  @override
  Future<void> unregister() async {}

  @override
  Stream<String> get onRegistered => _registered.stream;

  @override
  Stream<String> get onUnregistered => _unregistered.stream;

  @override
  Stream<PushMessage> get foregroundMessages => const Stream<PushMessage>.empty();
}

/// FCM-backed implementation. Enable by overriding [pushNotificationServiceProvider]
/// with this class once `google-services.json` / `GoogleService-Info.plist` are in place.
class FirebasePushNotificationService implements PushNotificationService {
  FirebasePushNotificationService({FirebaseMessaging? messaging}) : _messaging = messaging ?? FirebaseMessaging.instance;

  final FirebaseMessaging _messaging;
  final _registered = StreamController<String>.broadcast();
  final _unregistered = StreamController<String>.broadcast();
  final _messages = StreamController<PushMessage>.broadcast();

  @override
  Future<void> initialize() async {
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
      if (!kIsWeb && (Platform.isIOS || Platform.isMacOS)) {
        await _messaging.requestPermission(alert: true, badge: true, sound: true);
      }
      FirebaseMessaging.onMessage.listen((message) {
        _messages.add(_toPushMessage(message));
      });
      _messaging.onRegistered.listen(_registered.add);
      _messaging.onUnregistered.listen(_unregistered.add);
    } on Exception catch (e, st) {
      log('Firebase push initialization failed; push is disabled.', error: e, stackTrace: st);
    }
  }

  @override
  Future<void> register() async {
    try {
      await _messaging.register();
    } on Exception catch (e, st) {
      log('FCM registration failed.', error: e, stackTrace: st);
    }
  }

  @override
  Future<void> unregister() async {
    try {
      await _messaging.unregister();
    } on Exception catch (e, st) {
      log('FCM unregister failed.', error: e, stackTrace: st);
    }
  }

  @override
  Stream<String> get onRegistered => _registered.stream;

  @override
  Stream<String> get onUnregistered => _unregistered.stream;

  @override
  Stream<PushMessage> get foregroundMessages => _messages.stream;

  PushMessage _toPushMessage(RemoteMessage message) => PushMessage(
    title: message.notification?.title,
    body: message.notification?.body,
    data: message.data.map((k, v) => MapEntry(k, v?.toString() ?? '')),
  );
}

/// Default provider now uses Firebase. In tests or environments without Firebase
/// config, override this with [NoopPushNotificationService].
final pushNotificationServiceProvider = Provider<PushNotificationService>(
  (_) => FirebasePushNotificationService(),
);
