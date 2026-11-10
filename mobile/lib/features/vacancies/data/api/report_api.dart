import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_providers.dart';
import '../models/report.dart';

abstract interface class ReportApi {
  Future<Report> report({
    required String targetType,
    required String targetId,
    required ReportReason reason,
    String? comment,
  });
}

class HttpReportApi implements ReportApi {
  HttpReportApi(this._api);
  final ApiClient _api;

  static final _report = decodeObject(Report.fromJson);

  @override
  Future<Report> report({
    required String targetType,
    required String targetId,
    required ReportReason reason,
    String? comment,
  }) => _api.post(
    '/reports',
    body: {
      'target_type': targetType,
      'target_id': targetId,
      'reason': reason.apiValue,
      if (comment != null && comment.isNotEmpty) 'comment': comment,
    },
    decode: _report,
  );
}

final reportApiProvider = Provider<ReportApi>((ref) => HttpReportApi(ref.watch(apiClientProvider)));
