import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_interceptor.dart';
import '../auth/token_refresher.dart';
import '../config/app_config.dart';
import '../preferences.dart';
import 'api_client.dart';
import 'http.dart';

/// The authenticated client every feature uses: client headers, access token, and one
/// refresh-and-retry on 401 through the shared token source.
final apiClientProvider = Provider<ApiClient>((ref) {
  final dio = createDio(ref.watch(appConfigProvider), () => ref.read(effectiveLanguageProvider).tag);
  dio.interceptors.add(AuthInterceptor(dio: dio, tokens: ref.watch(accessTokenSourceProvider)));
  return ApiClient(dio);
});
