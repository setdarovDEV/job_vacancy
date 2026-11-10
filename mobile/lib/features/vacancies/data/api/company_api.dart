import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_providers.dart';
import '../models/company.dart';
import '../models/vacancy.dart';

abstract interface class CompanyApi {
  Future<Company> detail(String slug);
  Future<Page<VacancyCard>> vacancies(String slug, {String? cursor, int limit = 20});
}

class HttpCompanyApi implements CompanyApi {
  HttpCompanyApi(this._api);
  final ApiClient _api;

  static final _company = decodeObject(Company.fromJson);
  static final _card = decodeObject(VacancyCard.fromJson);

  @override
  Future<Company> detail(String slug) => _api.get('/companies/$slug', decode: _company);

  @override
  Future<Page<VacancyCard>> vacancies(String slug, {String? cursor, int limit = 20}) => _api.getPage(
    '/companies/$slug/vacancies',
    item: (json) => _card(json),
    query: {if (cursor != null) 'cursor': cursor, 'limit': limit},
  );
}

final companyApiProvider = Provider<CompanyApi>((ref) => HttpCompanyApi(ref.watch(apiClientProvider)));
