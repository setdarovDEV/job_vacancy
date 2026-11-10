import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/report_api.dart';
import '../models/report.dart';

class ReportRepository {
  ReportRepository(this._api);
  final ReportApi _api;

  Future<Report> report({
    required String targetType,
    required String targetId,
    required ReportReason reason,
    String? comment,
  }) => _api.report(targetType: targetType, targetId: targetId, reason: reason, comment: comment);
}

final reportRepositoryProvider = Provider<ReportRepository>(
  (ref) => ReportRepository(ref.watch(reportApiProvider)),
);
