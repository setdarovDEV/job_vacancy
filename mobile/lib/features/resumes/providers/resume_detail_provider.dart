import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/resume.dart';
import '../data/repositories/resume_repository.dart';

final resumeDetailProvider = FutureProvider.family<ResumeDetail, String>((ref, id) async {
  return ref.watch(resumeRepositoryProvider).detail(id);
});
