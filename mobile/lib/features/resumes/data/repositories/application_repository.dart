import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../api/application_api.dart';
import '../models/application.dart';

class ApplicationRepository {
  ApplicationRepository(this._api);
  final ApplicationApi _api;

  Future<Application> apply({required String vacancySlug, required ApplyInput input}) =>
      _api.apply(vacancySlug: vacancySlug, input: input);

  Future<Page<Application>> myApplications({String? status, String? cursor, int limit = 20}) =>
      _api.myApplications(status: status, cursor: cursor, limit: limit);

  Future<Application> detail(String id) => _api.detail(id);
  Future<Application> withdraw(String id) => _api.withdraw(id);
}

final applicationRepositoryProvider = Provider<ApplicationRepository>(
  (ref) => ApplicationRepository(ref.watch(applicationApiProvider)),
);
