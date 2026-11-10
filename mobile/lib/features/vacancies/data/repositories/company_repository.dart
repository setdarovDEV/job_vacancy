import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../api/company_api.dart';
import '../models/company.dart';
import '../models/vacancy.dart';

class CompanyRepository {
  CompanyRepository(this._api);
  final CompanyApi _api;

  Future<Company> detail(String slug) => _api.detail(slug);
  Future<Page<VacancyCard>> vacancies(String slug, {String? cursor, int limit = 20}) =>
      _api.vacancies(slug, cursor: cursor, limit: limit);
}

final companyRepositoryProvider = Provider<CompanyRepository>(
  (ref) => CompanyRepository(ref.watch(companyApiProvider)),
);
