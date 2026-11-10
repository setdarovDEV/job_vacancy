import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/application.dart';
import '../data/repositories/application_repository.dart';

class MyApplicationsState {
  MyApplicationsState({
    required this.items,
    this.nextCursor,
    this.hasMore = true,
    this.status,
    this.isLoadingMore = false,
  });

  final List<Application> items;
  final String? nextCursor;
  final bool hasMore;
  final ApplicationStatus? status;
  final bool isLoadingMore;

  MyApplicationsState copyWith({
    List<Application>? items,
    String? nextCursor,
    bool? hasMore,
    ApplicationStatus? status,
    bool? isLoadingMore,
  }) => MyApplicationsState(
    items: items ?? this.items,
    nextCursor: nextCursor ?? this.nextCursor,
    hasMore: hasMore ?? this.hasMore,
    status: status ?? this.status,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
  );
}

class MyApplicationsController extends AsyncNotifier<MyApplicationsState> {
  ApplicationRepository get _repo => ref.read(applicationRepositoryProvider);

  @override
  Future<MyApplicationsState> build() async {
    final page = await _repo.myApplications();
    return MyApplicationsState(
      items: page.items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    );
  }

  Future<void> applyStatus(ApplicationStatus? status) async {
    if (state case AsyncData(:final value)) {
      if (value.status == status) return;
    }
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final page = await _repo.myApplications(status: status?.apiValue);
      return MyApplicationsState(
        items: page.items,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        status: status,
      );
    });
  }

  Future<void> loadMore() async {
    final value = state.value;
    if (value == null || !value.hasMore || value.isLoadingMore || state.isLoading) return;

    state = AsyncData(value.copyWith(isLoadingMore: true));
    try {
      final page = await _repo.myApplications(
        status: value.status?.apiValue,
        cursor: value.nextCursor,
      );
      state = AsyncData(
        value.copyWith(
          items: [...value.items, ...page.items],
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          isLoadingMore: false,
        ),
      );
    } catch (e, st) {
      state = AsyncError(e, st);
    }
  }

  Future<void> refresh() async {
    final value = state.value;
    await applyStatus(value?.status);
  }

  /// Updates a single application in the cached list after a mutation (e.g. withdraw).
  void patch(Application updated) {
    final value = state.value;
    if (value == null) return;
    state = AsyncData(
      value.copyWith(
        items: value.items.map((a) => a.id == updated.id ? updated : a).toList(),
      ),
    );
  }
}

final myApplicationsControllerProvider = AsyncNotifierProvider<MyApplicationsController, MyApplicationsState>(
  MyApplicationsController.new,
);
