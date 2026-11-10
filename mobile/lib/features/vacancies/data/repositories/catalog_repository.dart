import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/catalog_api.dart';
import '../models/category.dart';
import '../models/region.dart';
import '../models/skill.dart';

/// Thin wrapper around [CatalogApi]. Caching could be added here later.
class CatalogRepository {
  CatalogRepository(this._api);
  final CatalogApi _api;

  Future<List<Category>> categories() => _api.categories();
  Future<List<Region>> regions() => _api.regions();
  Future<List<Skill>> skills({String? q, int? limit}) => _api.skills(q: q, limit: limit);
}

final catalogRepositoryProvider = Provider<CatalogRepository>(
  (ref) => CatalogRepository(ref.watch(catalogApiProvider)),
);
