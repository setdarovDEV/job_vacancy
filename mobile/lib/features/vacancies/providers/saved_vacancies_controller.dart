import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/vacancy.dart';
import '../data/repositories/vacancy_repository.dart';

class SavedVacanciesController extends AsyncNotifier<List<VacancyCard>> {
  VacancyRepository get _repo => ref.read(vacancyRepositoryProvider);

  @override
  Future<List<VacancyCard>> build() async {
    final page = await _repo.saved();
    return page.items;
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final page = await _repo.saved();
      return page.items;
    });
  }
}

final savedVacanciesControllerProvider = AsyncNotifierProvider<SavedVacanciesController, List<VacancyCard>>(
  SavedVacanciesController.new,
);
