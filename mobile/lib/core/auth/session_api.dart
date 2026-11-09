import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_providers.dart';
import '../models/auth_result.dart';
import '../models/user.dart';

/// Endpoints that start, read or end a session. Account actions (verification, password
/// reset) live with their feature (features/auth/data).
abstract interface class SessionApi {
  /// v1 of the app signs up job seekers only.
  Future<AuthResult> registerSeeker({
    required String email,
    required String password,
    required String fullName,
    required String locale,
  });
  Future<AuthResult> login({required String email, required String password});
  Future<User> me();

  /// Revokes the session that owns [refreshToken]; works without a valid access token.
  Future<void> logout(String refreshToken);
  Future<void> logoutAll();
}

class HttpSessionApi implements SessionApi {
  HttpSessionApi(this._api);
  final ApiClient _api;

  static final _auth = decodeObject(AuthResult.fromJson);

  @override
  Future<AuthResult> registerSeeker({
    required String email,
    required String password,
    required String fullName,
    required String locale,
  }) => _api.post(
    '/auth/register',
    body: {'email': email, 'password': password, 'full_name': fullName, 'role': 'seeker', 'locale': locale},
    decode: _auth,
    anonymous: true,
  );

  @override
  Future<AuthResult> login({required String email, required String password}) =>
      _api.post('/auth/login', body: {'email': email, 'password': password}, decode: _auth, anonymous: true);

  @override
  Future<User> me() => _api.get('/me', decode: decodeObject(User.fromJson));

  @override
  Future<void> logout(String refreshToken) =>
      _api.postVoid('/auth/logout', body: {'refresh_token': refreshToken}, anonymous: true);

  @override
  Future<void> logoutAll() => _api.postVoid('/auth/logout-all');
}

final sessionApiProvider = Provider<SessionApi>((ref) => HttpSessionApi(ref.watch(apiClientProvider)));
