import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/resume_api.dart';
import '../models/resume.dart';

class ResumeRepository {
  ResumeRepository(this._api);
  final ResumeApi _api;

  Future<List<ResumeCard>> listMyResumes() => _api.listMyResumes();
  Future<ResumeDetail> create(ResumeInput input) => _api.create(input);
  Future<ResumeDetail> detail(String id) => _api.detail(id);
  Future<ResumeDetail> update(String id, ResumeInput input) => _api.update(id, input);
  Future<void> delete(String id) => _api.delete(id);
  Future<ResumeDetail> setVisibility(String id, ResumeVisibility visibility) =>
      _api.setVisibility(id, visibility);
  Future<List<int>> pdf(String id, {String? lang}) => _api.pdf(id, lang: lang);
}

final resumeRepositoryProvider = Provider<ResumeRepository>(
  (ref) => ResumeRepository(ref.watch(resumeApiProvider)),
);
