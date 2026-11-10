import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/notifications_api.dart';
import '../data/models/notification.dart';

class NotificationsState {
  NotificationsState({
    required this.items,
    this.nextCursor,
    this.hasMore = true,
    this.isLoadingMore = false,
  });

  final List<AppNotification> items;
  final String? nextCursor;
  final bool hasMore;
  final bool isLoadingMore;

  NotificationsState copyWith({
    List<AppNotification>? items,
    String? nextCursor,
    bool? hasMore,
    bool? isLoadingMore,
  }) => NotificationsState(
    items: items ?? this.items,
    nextCursor: nextCursor ?? this.nextCursor,
    hasMore: hasMore ?? this.hasMore,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
  );
}

class NotificationsController extends AsyncNotifier<NotificationsState> {
  NotificationsApi get _api => ref.read(notificationsApiProvider);

  @override
  Future<NotificationsState> build() async {
    final page = await _api.list();
    return NotificationsState(
      items: page.items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final page = await _api.list();
      return NotificationsState(items: page.items, nextCursor: page.nextCursor, hasMore: page.hasMore);
    });
  }

  Future<void> loadMore() async {
    final value = state.value;
    if (value == null || !value.hasMore || value.isLoadingMore || state.isLoading) return;
    state = AsyncData(value.copyWith(isLoadingMore: true));
    try {
      final page = await _api.list(cursor: value.nextCursor);
      state = AsyncData(value.copyWith(
        items: [...value.items, ...page.items],
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        isLoadingMore: false,
      ));
    } catch (e, st) {
      state = AsyncError(e, st);
    }
  }

  Future<void> markRead(int id) async {
    final value = state.value;
    if (value == null) return;
    final index = value.items.indexWhere((n) => n.id == id);
    if (index < 0 || !value.items[index].isUnread) return;
    final items = [...value.items];
    items[index] = items[index].copyWith(readAt: DateTime.now());
    state = AsyncData(value.copyWith(items: items));
    try {
      await _api.markRead(ids: [id]);
    } on Exception {
      // Best effort; revert not needed for a read marker.
    }
  }

  Future<void> markAllRead() async {
    final value = state.value;
    if (value == null) return;
    final now = DateTime.now();
    final items = value.items.map((n) => n.copyWith(readAt: now)).toList();
    state = AsyncData(value.copyWith(items: items));
    try {
      await _api.markRead();
    } on Exception {
      // Best effort.
    }
  }
}

final notificationsControllerProvider = AsyncNotifierProvider<NotificationsController, NotificationsState>(
  NotificationsController.new,
);
