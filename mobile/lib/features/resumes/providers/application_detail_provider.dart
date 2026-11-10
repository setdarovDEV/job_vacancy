import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/application.dart';
import '../data/repositories/application_repository.dart';

final applicationDetailProvider = FutureProvider.family<Application, String>((ref, id) async {
  return ref.watch(applicationRepositoryProvider).detail(id);
});
