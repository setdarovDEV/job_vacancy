import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../api/vacancy_api.dart';
import '../models/vacancy.dart';

class VacancyRepository {
  VacancyRepository(this._api);
  final VacancyApi _api;

  Future<Page<VacancyCard>> search(VacancySearchParams params, {String? cursor, int limit = 20}) =>
      _api.search(params, cursor: cursor, limit: limit);

  Future<VacancyDetail> detail(String slug) => _api.detail(slug);
  Future<void> save(String slug) => _api.save(slug);
  Future<void> unsave(String slug) => _api.unsave(slug);
  Future<Page<VacancyCard>> saved({String? cursor, int limit = 20}) => _api.saved(cursor: cursor, limit: limit);
  Future<List<String>> savedIds() => _api.savedIds();
}

final vacancyRepositoryProvider = Provider<VacancyRepository>(
  (ref) => VacancyRepository(ref.watch(vacancyApiProvider)),
);
