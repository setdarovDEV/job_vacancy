import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_providers.dart';
import '../models/application.dart';

abstract interface class ApplicationApi {
  Future<Application> apply({required String vacancySlug, required ApplyInput input});
  Future<Page<Application>> myApplications({String? status, String? cursor, int limit = 20});
  Future<Application> detail(String id);
  Future<Application> withdraw(String id);
}

class HttpApplicationApi implements ApplicationApi {
  HttpApplicationApi(this._api);
  final ApiClient _api;

  static final _application = decodeObject(Application.fromJson);

  @override
  Future<Application> apply({required String vacancySlug, required ApplyInput input}) => _api.post(
    '/vacancies/$vacancySlug/applications',
    decode: _application,
    body: input.toJson(),
  );

  @override
  Future<Page<Application>> myApplications({String? status, String? cursor, int limit = 20}) => _api.getPage(
    '/me/applications',
    item: (json) => _application(json),
    query: {if (status != null) 'status': status, if (cursor != null) 'cursor': cursor, 'limit': limit},
  );

  @override
  Future<Application> detail(String id) => _api.get('/applications/$id', decode: _application);

  @override
  Future<Application> withdraw(String id) => _api.post('/applications/$id/withdraw', decode: _application);
}

final applicationApiProvider = Provider<ApplicationApi>((ref) => HttpApplicationApi(ref.watch(apiClientProvider)));
