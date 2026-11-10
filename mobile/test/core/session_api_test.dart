import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jobvacancy/core/api/api_client.dart';
import 'package:jobvacancy/core/api/api_exception.dart';
import 'package:jobvacancy/core/auth/session_api.dart';
import 'package:jobvacancy/core/l10n/codes.g.dart';

class _Canned implements HttpClientAdapter {
  _Canned(this.status, this.body);
  final int status;
  final Object body;

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<List<int>>? b, Future<void>? c) async =>
      ResponseBody.fromString(jsonEncode(body), status, headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      });

  @override
  void close({bool force = false}) {}
}

SessionApi api(int status, Object body) => HttpSessionApi(
  ApiClient(Dio(BaseOptions(baseUrl: 'http://api.test'))..httpClientAdapter = _Canned(status, body)),
);

void main() {
  test('a 202 two-factor challenge on login is a clear failure, not a decode error (API-058)', () async {
    final s = api(202, {
      'data': {'two_factor_required': true, 'challenge_token': 'x', 'expires_in': 300},
    });
    await expectLater(
      s.login(email: 'admin@demo.uz', password: 'Secret123'),
      throwsA(isA<ApiFailure>().having((f) => f.code, 'code', twoFactorWebOnly).having((f) => f.status, 'status', 202)),
    );
  });

  test('every locale explains it', () {
    for (final tag in ['uz', 'uz-Cyrl', 'ru', 'en']) {
      expect(apiErrorTexts[tag]?[twoFactorWebOnly], isNotEmpty, reason: tag);
    }
  });
}
