import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/vacancy.dart';
import '../data/repositories/vacancy_repository.dart';

final vacancyDetailProvider = FutureProvider.family<VacancyDetail, String>((ref, slug) async {
  return ref.watch(vacancyRepositoryProvider).detail(slug);
});
