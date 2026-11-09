import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jobvacancy/core/api/api_client.dart';
import 'package:jobvacancy/core/api/api_exception.dart';
import 'package:jobvacancy/core/models/user.dart';

/// Serves one canned response.
class _Canned implements HttpClientAdapter {
  _Canned(this.status, this.body, {this.contentType = Headers.jsonContentType});
  final int status;
  final String body;
  final String contentType;

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<List<int>>? b, Future<void>? c) async => ResponseBody.fromString(
    body,
    status,
    headers: {
      Headers.contentTypeHeader: [contentType],
    },
  );

  @override
  void close({bool force = false}) {}
}

ApiClient client(int status, Object body, {String contentType = Headers.jsonContentType}) => ApiClient(
  Dio(BaseOptions(baseUrl: 'http://api.test'))
    ..httpClientAdapter = _Canned(status, body is String ? body : jsonEncode(body), contentType: contentType),
);

void main() {
  group('ApiFailure.fromBody', () {
    test('reads code, message, fields and retry_after', () {
      final f = ApiFailure.fromBody(422, {
        'error': {
          'code': 'validation_failed',
          'message': 'bad',
          'fields': {'email': 'email', 'skills[2]': 'max=50'},
          'retry_after': 12,
        },
      });
      expect(f.code, 'validation_failed');
      expect(f.isValidation, isTrue);
      expect(f.fields, {'email': 'email', 'skills[2]': 'max=50'});
      expect(f.retryAfter, 12);
    });

    test('anything that is not the envelope becomes internal_error', () {
      expect(ApiFailure.fromBody(502, '<html>bad gateway</html>').code, 'internal_error');
    });
  });

  group('ApiClient', () {
    test('decodes data with the given decoder', () async {
      final api = client(200, {
        'data': {'id': 'u1', 'full_name': 'A', 'role': 'seeker', 'locale': 'uz'},
      });
      final u = await api.get('/me', decode: decodeObject(User.fromJson));
      expect(u.role, UserRole.seeker);
    });

    test('an unknown role decodes as unknown instead of failing', () async {
      final api = client(200, {
        'data': {'id': 'u1', 'full_name': 'A', 'role': 'moderator', 'locale': 'uz'},
      });
      expect((await api.get('/me', decode: decodeObject(User.fromJson))).role, UserRole.unknown);
    });

    test('a captive-portal HTML page on 200 is a DecodeFailure', () async {
      final api = client(200, '<html>Wi-Fi login</html>', contentType: 'text/html');
      await expectLater(api.get('/me', decode: decodeObject(User.fromJson)), throwsA(isA<DecodeFailure>()));
    });

    test('a wrong shape inside the envelope is a DecodeFailure, not a TypeError', () async {
      final api = client(200, {'data': 'not an object'});
      await expectLater(api.get('/me', decode: decodeObject(User.fromJson)), throwsA(isA<DecodeFailure>()));
      final missing = client(200, {
        'data': {'id': 'u1'},
      });
      await expectLater(missing.get('/me', decode: decodeObject(User.fromJson)), throwsA(isA<DecodeFailure>()));
    });

    test('204 returns null; error envelopes become ApiFailure', () async {
      await client(204, '').postVoid('/auth/logout');
      await expectLater(
        client(409, {
          'error': {'code': 'already_reported'},
        }).postVoid('/reports'),
        throwsA(isA<ApiFailure>().having((e) => e.code, 'code', 'already_reported')),
      );
    });

    test('pages carry the next cursor', () async {
      final api = client(200, {
        'data': [
          {'n': 1},
          {'n': 2},
        ],
        'meta': {'next_cursor': 'abc'},
      });
      final page = await api.getPage('/items', item: (j) => j['n']! as int);
      expect(page.items, [1, 2]);
      expect(page.nextCursor, 'abc');
      expect(page.hasMore, isTrue);
    });

    test('no response at all is a NetworkFailure', () {
      final req = RequestOptions(path: '/x');
      expect(
        ApiClient.failureFrom(DioException(requestOptions: req, type: DioExceptionType.connectionError)),
        isA<NetworkFailure>(),
      );
    });
  });
}
