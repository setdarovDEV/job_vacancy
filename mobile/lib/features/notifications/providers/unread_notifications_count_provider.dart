import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/notifications_api.dart';

class UnreadNotificationsCountNotifier extends AsyncNotifier<int> {
  NotificationsApi get _api => ref.read(notificationsApiProvider);

  @override
  Future<int> build() => _api.unreadCount();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_api.unreadCount);
  }
}

final unreadNotificationsCountProvider = AsyncNotifierProvider<UnreadNotificationsCountNotifier, int>(
  UnreadNotificationsCountNotifier.new,
);
