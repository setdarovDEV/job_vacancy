import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/resume.dart';
import '../data/repositories/resume_repository.dart';

class ResumeEditController extends AsyncNotifier<ResumeDetail?> {
  ResumeRepository get _repo => ref.read(resumeRepositoryProvider);

  @override
  Future<ResumeDetail?> build() async => null;

  Future<ResumeDetail?> save({String? id, required ResumeInput input}) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      if (id != null) {
        return _repo.update(id, input);
      } else {
        return _repo.create(input);
      }
    });
    return state.value;
  }
}

final resumeEditControllerProvider = AsyncNotifierProvider<ResumeEditController, ResumeDetail?>(
  ResumeEditController.new,
);
