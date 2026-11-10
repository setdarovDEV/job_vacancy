import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_providers.dart';
import '../models/resume.dart';

abstract interface class ResumeApi {
  Future<List<ResumeCard>> listMyResumes();
  Future<ResumeDetail> create(ResumeInput input);
  Future<ResumeDetail> detail(String id);
  Future<ResumeDetail> update(String id, ResumeInput input);
  Future<void> delete(String id);
  Future<ResumeDetail> setVisibility(String id, ResumeVisibility visibility);

  /// PDF bytes for the given resume; [lang] defaults to the current UI locale.
  Future<List<int>> pdf(String id, {String? lang});
}

class HttpResumeApi implements ResumeApi {
  HttpResumeApi(this._api);
  final ApiClient _api;

  static final _card = decodeObject(ResumeCard.fromJson);
  static final _detail = decodeObject(ResumeDetail.fromJson);

  @override
  Future<List<ResumeCard>> listMyResumes() => _api.get(
    '/me/resumes',
    decode: (data) => (data as List<Object?>).map((e) => _card(e as Map<String, Object?>)).toList(),
  );

  @override
  Future<ResumeDetail> create(ResumeInput input) =>
      _api.post('/resumes', decode: _detail, body: input.toJson());

  @override
  Future<ResumeDetail> detail(String id) => _api.get('/resumes/$id', decode: _detail);

  @override
  Future<ResumeDetail> update(String id, ResumeInput input) =>
      _api.put('/resumes/$id', decode: _detail, body: input.toJson());

  @override
  Future<void> delete(String id) => _api.deleteVoid('/resumes/$id');

  @override
  Future<ResumeDetail> setVisibility(String id, ResumeVisibility visibility) => _api.put(
    '/resumes/$id/visibility',
    decode: _detail,
    body: {'visibility': visibility.apiValue},
  );

  @override
  Future<List<int>> pdf(String id, {String? lang}) async {
    try {
      final res = await _api.dio.get<List<int>>(
        '/resumes/$id/pdf',
        queryParameters: {if (lang != null) 'lang': lang},
        options: Options(responseType: ResponseType.bytes),
      );
      return res.data ?? const [];
    } on DioException catch (e) {
      throw ApiClient.failureFrom(e);
    }
  }
}

final resumeApiProvider = Provider<ResumeApi>((ref) => HttpResumeApi(ref.watch(apiClientProvider)));
