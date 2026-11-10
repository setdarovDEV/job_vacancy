import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_providers.dart';
import '../models/category.dart';
import '../models/region.dart';
import '../models/skill.dart';

abstract interface class CatalogApi {
  Future<List<Category>> categories();
  Future<List<Region>> regions();
  Future<List<Skill>> skills({String? q, int? limit});
}

class HttpCatalogApi implements CatalogApi {
  HttpCatalogApi(this._api);
  final ApiClient _api;

  static final _category = decodeObject(Category.fromJson);
  static final _region = decodeObject(Region.fromJson);
  static final _skill = decodeObject(Skill.fromJson);

  @override
  Future<List<Category>> categories() => _api.get(
    '/catalog/categories',
    decode: (data) => (data as List<Object?>).map((e) => _category(e)).toList(),
  );

  @override
  Future<List<Region>> regions() => _api.get(
    '/catalog/regions',
    decode: (data) => (data as List<Object?>).map((e) => _region(e)).toList(),
  );

  @override
  Future<List<Skill>> skills({String? q, int? limit}) => _api.get(
    '/catalog/skills',
    query: {if (q != null && q.isNotEmpty) 'q': q, if (limit != null) 'limit': limit},
    decode: (data) => (data as List<Object?>).map((e) => _skill(e)).toList(),
  );
}

final catalogApiProvider = Provider<CatalogApi>((ref) => HttpCatalogApi(ref.watch(apiClientProvider)));
