import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_providers.dart';
import '../models/saved_search.dart';

abstract interface class SavedSearchApi {
  Future<List<SavedSearch>> list();
  Future<SavedSearch> create({required String name, required String params, bool notify = false});
  Future<SavedSearch> update(String id, {String? name, bool? notify});
  Future<void> delete(String id);
}

class HttpSavedSearchApi implements SavedSearchApi {
  HttpSavedSearchApi(this._api);
  final ApiClient _api;

  static final _savedSearch = decodeObject(SavedSearch.fromJson);

  @override
  Future<List<SavedSearch>> list() => _api.get(
    '/me/saved-searches',
    decode: (data) => (data as List<Object?>).map((e) => _savedSearch(e as Map<String, Object?>)).toList(),
  );

  @override
  Future<SavedSearch> create({required String name, required String params, bool notify = false}) => _api.post(
    '/me/saved-searches',
    body: {'name': name, 'params': params, 'notify': notify},
    decode: _savedSearch,
  );

  @override
  Future<SavedSearch> update(String id, {String? name, bool? notify}) => _api.put(
    '/me/saved-searches/$id',
    body: {if (name != null) 'name': name, if (notify != null) 'notify': notify},
    decode: _savedSearch,
  );

  @override
  Future<void> delete(String id) => _api.deleteVoid('/me/saved-searches/$id');
}

final savedSearchApiProvider = Provider<SavedSearchApi>((ref) => HttpSavedSearchApi(ref.watch(apiClientProvider)));
