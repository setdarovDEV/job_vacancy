import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/saved_search.dart';
import '../data/repositories/saved_search_repository.dart';

class SavedSearchesController extends AsyncNotifier<List<SavedSearch>> {
  SavedSearchRepository get _repo => ref.read(savedSearchRepositoryProvider);

  @override
  Future<List<SavedSearch>> build() async => _repo.list();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_repo.list);
  }

  Future<void> create({required String name, required String params, bool notify = false}) async {
    await _repo.create(name: name, params: params, notify: notify);
    await refresh();
  }

  Future<void> updateSearch(String id, {String? name, bool? notify}) async {
    await _repo.update(id, name: name, notify: notify);
    await refresh();
  }

  Future<void> delete(String id) async {
    await _repo.delete(id);
    await refresh();
  }
}

final savedSearchesControllerProvider = AsyncNotifierProvider<SavedSearchesController, List<SavedSearch>>(
  SavedSearchesController.new,
);
