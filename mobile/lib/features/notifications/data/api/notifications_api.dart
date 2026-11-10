import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_providers.dart';
import '../models/notification.dart';

abstract interface class NotificationsApi {
  Future<Page<AppNotification>> list({bool? unread, String? cursor, int limit = 20});
  Future<int> unreadCount();
  Future<void> markRead({List<int>? ids});
  Future<void> registerDeviceToken({required String token, required String platform});
  Future<void> deleteDeviceToken(String token);
}

class HttpNotificationsApi implements NotificationsApi {
  HttpNotificationsApi(this._api);
  final ApiClient _api;

  static final _notification = decodeObject(AppNotification.fromJson);

  @override
  Future<Page<AppNotification>> list({bool? unread, String? cursor, int limit = 20}) => _api.getPage(
    '/me/notifications',
    item: (json) => _notification(json),
    query: {
      if (unread != null) 'unread': unread,
      if (cursor != null) 'cursor': cursor,
      'limit': limit,
    },
  );

  @override
  Future<int> unreadCount() async {
    final data = await _api.get<Map<String, Object?>>(
      '/me/notifications/unread-count',
      decode: decodeObject((d) => d),
    );
    return (data['unread'] as num?)?.toInt() ?? 0;
  }

  @override
  Future<void> markRead({List<int>? ids}) => _api.postVoid(
    '/me/notifications/read',
    body: {'ids': ids ?? []},
  );

  @override
  Future<void> registerDeviceToken({required String token, required String platform}) => _api.postVoid(
    '/me/devices',
    body: {'token': token, 'platform': platform},
  );

  @override
  Future<void> deleteDeviceToken(String token) => _api.deleteVoid('/me/devices/$token');
}

final notificationsApiProvider = Provider<NotificationsApi>((ref) => HttpNotificationsApi(ref.watch(apiClientProvider)));
