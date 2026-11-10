import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/saved_search_api.dart';
import '../models/saved_search.dart';

class SavedSearchRepository {
  SavedSearchRepository(this._api);
  final SavedSearchApi _api;

  Future<List<SavedSearch>> list() => _api.list();
  Future<SavedSearch> create({required String name, required String params, bool notify = false}) =>
      _api.create(name: name, params: params, notify: notify);
  Future<SavedSearch> update(String id, {String? name, bool? notify}) => _api.update(id, name: name, notify: notify);
  Future<void> delete(String id) => _api.delete(id);
}

final savedSearchRepositoryProvider = Provider<SavedSearchRepository>(
  (ref) => SavedSearchRepository(ref.watch(savedSearchApiProvider)),
);
