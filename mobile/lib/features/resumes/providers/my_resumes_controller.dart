import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/resume.dart';
import '../data/repositories/resume_repository.dart';

class MyResumesController extends AsyncNotifier<List<ResumeCard>> {
  ResumeRepository get _repo => ref.read(resumeRepositoryProvider);

  @override
  Future<List<ResumeCard>> build() => _repo.listMyResumes();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_repo.listMyResumes);
  }

  Future<void> delete(String id) async {
    final value = state.value;
    if (value == null) return;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await _repo.delete(id);
      return value.where((r) => r.id != id).toList();
    });
  }

  Future<void> setVisibility(String id, ResumeVisibility visibility) async {
    final value = state.value;
    if (value == null) return;
    state = await AsyncValue.guard(() async {
      final updated = await _repo.setVisibility(id, visibility);
      return value.map((r) => r.id == id ? _replaceCard(r, updated) : r).toList();
    });
  }

  static ResumeCard _replaceCard(ResumeCard old, ResumeDetail detail) => old.copyWith(
    title: detail.title,
    categoryId: detail.categoryId,
    regionId: detail.regionId,
    relocate: detail.relocate,
    desiredSalary: detail.desiredSalary,
    skills: detail.skills,
    visibility: detail.visibility,
    updatedAt: detail.updatedAt,
  );
}

final myResumesControllerProvider = AsyncNotifierProvider<MyResumesController, List<ResumeCard>>(
  MyResumesController.new,
);
