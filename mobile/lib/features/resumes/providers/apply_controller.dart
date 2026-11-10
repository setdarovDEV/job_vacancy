import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/application.dart';
import '../data/repositories/application_repository.dart';

class ApplyController extends AsyncNotifier<Application?> {
  ApplicationRepository get _repo => ref.read(applicationRepositoryProvider);

  @override
  Future<Application?> build() async => null;

  Future<Application?> apply({required String vacancySlug, required String resumeId, String? coverLetter}) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      return _repo.apply(vacancySlug: vacancySlug, input: ApplyInput(resumeId: resumeId, coverLetter: coverLetter));
    });
    return state.value;
  }
}

final applyControllerProvider = AsyncNotifierProvider<ApplyController, Application?>(
  ApplyController.new,
);
