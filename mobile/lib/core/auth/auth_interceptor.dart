import 'package:dio/dio.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import 'access_token_source.dart';

/// Adds the access token, and after a 401 asks [tokens] for a new one and retries the
/// request once. It knows nothing about refresh tokens or storage.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({required this.dio, required this.tokens});

  final Dio dio;
  final AccessTokenSource tokens;

  static const _retried = 'jv.retried';

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.extra[ApiClient.anonymousKey] == true) return handler.next(options);
    final token = await tokens.current();
    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final req = err.requestOptions;
    final sent = (req.headers['Authorization'] as String?)?.replaceFirst('Bearer ', '');
    if (err.response?.statusCode != 401 || sent == null || req.extra[_retried] == true) return handler.next(err);
    try {
      final token = await tokens.renew(rejected: sent);
      if (token == null) return handler.next(err);
      final retry = req.copyWith(
        headers: {...req.headers, 'Authorization': 'Bearer $token'},
        extra: {...req.extra, _retried: true},
      );
      handler.resolve(await dio.fetch<Object?>(retry));
    } on DioException catch (e) {
      handler.next(e);
    } on ApiException catch (e) {
      // Couldn't renew (offline, server error): report that, not the 401, so callers
      // don't take a stale token for a lost session.
      handler.reject(DioException(requestOptions: req, error: e, response: err.response));
    }
  }
}
