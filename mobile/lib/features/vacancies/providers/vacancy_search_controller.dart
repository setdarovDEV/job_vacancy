import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api/vacancy_api.dart';
import '../data/models/vacancy.dart';
import '../data/repositories/vacancy_repository.dart';

class VacancySearchState {
  VacancySearchState({
    required this.params,
    required this.items,
    this.nextCursor,
    this.hasMore = true,
    this.total,
    this.totalCapped = false,
    this.fuzzy = false,
    this.isLoadingMore = false,
  });

  final VacancySearchParams params;
  final List<VacancyCard> items;
  final String? nextCursor;
  final bool hasMore;
  final int? total;
  final bool totalCapped;
  final bool fuzzy;
  final bool isLoadingMore;

  VacancySearchState copyWith({
    VacancySearchParams? params,
    List<VacancyCard>? items,
    String? nextCursor,
    bool? hasMore,
    int? total,
    bool? totalCapped,
    bool? fuzzy,
    bool? isLoadingMore,
  }) => VacancySearchState(
    params: params ?? this.params,
    items: items ?? this.items,
    nextCursor: nextCursor ?? this.nextCursor,
    hasMore: hasMore ?? this.hasMore,
    total: total ?? this.total,
    totalCapped: totalCapped ?? this.totalCapped,
    fuzzy: fuzzy ?? this.fuzzy,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
  );
}

class VacancySearchController extends AsyncNotifier<VacancySearchState> {
  VacancyRepository get _repo => ref.read(vacancyRepositoryProvider);

  @override
  Future<VacancySearchState> build() async {
    final page = await _repo.search(const VacancySearchParams());
    return VacancySearchState(
      params: const VacancySearchParams(),
      items: page.items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    );
  }

  Future<void> applyParams(VacancySearchParams params) async {
    if (state case AsyncData(:final value)) {
      if (value.params == params) return;
    }
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final page = await _repo.search(params);
      return VacancySearchState(
        params: params,
        items: page.items,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      );
    });
  }

  Future<void> setQuery(String q) async {
    final current = state.value?.params ?? const VacancySearchParams();
    await applyParams(current.copyWith(q: q, sort: q.isEmpty ? null : current.sort));
  }

  Future<void> loadMore() async {
    final value = state.value;
    if (value == null || !value.hasMore || value.isLoadingMore || state.isLoading) return;

    state = AsyncData(value.copyWith(isLoadingMore: true));
    try {
      final page = await _repo.search(value.params, cursor: value.nextCursor);
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
    await applyParams(value?.params ?? const VacancySearchParams());
  }
}

final vacancySearchControllerProvider = AsyncNotifierProvider<VacancySearchController, VacancySearchState>(
  VacancySearchController.new,
);
