import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/http.dart';
import '../models/auth_result.dart';

/// POST /auth/refresh: exchanges a refresh token for a new pair (it rotates).
abstract interface class RefreshApi {
  Future<AuthResult> exchange(String refreshToken);
}

class HttpRefreshApi implements RefreshApi {
  HttpRefreshApi(this._api);
  final ApiClient _api;

  @override
  Future<AuthResult> exchange(String refreshToken) => _api.post(
    '/auth/refresh',
    body: {'refresh_token': refreshToken},
    decode: decodeObject(AuthResult.fromJson),
    anonymous: true,
  );
}

final refreshApiProvider = Provider<RefreshApi>((ref) => HttpRefreshApi(ref.watch(bareApiClientProvider)));
