import 'dart:io';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'push_notification_service.dart';

/// Displays local system notifications from FCM foreground messages.
class LocalNotificationService {
  LocalNotificationService() {
    _plugin = FlutterLocalNotificationsPlugin();
  }

  late final FlutterLocalNotificationsPlugin _plugin;

  static const _androidChannelId = 'jobvacancy_default_channel';
  static const _androidChannelName = 'Job Vacancy';
  static const _androidChannelDesc = 'Notifications from employers and the platform';

  Future<void> initialize() async {
    if (!Platform.isAndroid && !Platform.isIOS && !Platform.isMacOS) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const darwinSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: darwinSettings,
      macOS: darwinSettings,
    );
    await _plugin.initialize(settings: initSettings);

    if (Platform.isAndroid) {
      final channel = AndroidNotificationChannel(
        _androidChannelId,
        _androidChannelName,
        description: _androidChannelDesc,
        importance: Importance.high,
      );
      await _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
  }

  Future<void> show(PushMessage message) async {
    final title = message.title ?? 'Job Vacancy';
    final body = message.body ?? '';
    if (title.isEmpty && body.isEmpty) return;

    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        _androidChannelId,
        _androidChannelName,
        channelDescription: _androidChannelDesc,
        importance: Importance.high,
        priority: Priority.high,
      ),
      iOS: DarwinNotificationDetails(),
      macOS: DarwinNotificationDetails(),
    );
    await _plugin.show(
      id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title: title,
      body: body,
      notificationDetails: details,
      payload: Uri.encodeComponent(message.data.toString()),
    );
  }
}

final localNotificationServiceProvider = Provider<LocalNotificationService>(
  (_) => LocalNotificationService(),
);
