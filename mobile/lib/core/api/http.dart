import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../preferences.dart';
import 'api_client.dart';

/// Headers every request carries.
class ClientHeadersInterceptor extends Interceptor {
  ClientHeadersInterceptor({required this.clientType, required this.languageTag});

  final String clientType;

  /// Current app language as the API names it (uz, uz-Cyrl, ru, en).
  final String Function() languageTag;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers['X-Client-Type'] = clientType;
    options.headers['Accept-Language'] = languageTag();
    handler.next(options);
  }
}

/// A Dio with the base URL, timeouts and client headers, but no authentication.
Dio createDio(AppConfig cfg, String Function() languageTag) => Dio(
  BaseOptions(
    baseUrl: cfg.apiBaseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 20),
    contentType: 'application/json',
    responseType: ResponseType.json,
  ),
)..interceptors.add(ClientHeadersInterceptor(clientType: cfg.clientType, languageTag: languageTag));

/// Client without the auth interceptor, for the token refresh itself (which must never
/// trigger another refresh).
final bareApiClientProvider = Provider<ApiClient>((ref) {
  final cfg = ref.watch(appConfigProvider);
  return ApiClient(createDio(cfg, () => ref.read(effectiveLanguageProvider).tag));
});
