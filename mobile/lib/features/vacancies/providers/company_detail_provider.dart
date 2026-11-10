import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/company.dart';
import '../data/repositories/company_repository.dart';

final companyDetailProvider = FutureProvider.family<Company, String>((ref, slug) async {
  return ref.watch(companyRepositoryProvider).detail(slug);
});
