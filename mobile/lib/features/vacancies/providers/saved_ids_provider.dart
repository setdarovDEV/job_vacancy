import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/repositories/vacancy_repository.dart';

final savedVacancyIdsProvider = FutureProvider<Set<String>>((ref) async {
  final ids = await ref.watch(vacancyRepositoryProvider).savedIds();
  return ids.toSet();
});
