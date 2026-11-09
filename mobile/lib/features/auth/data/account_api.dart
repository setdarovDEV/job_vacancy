import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/models/user.dart';

/// Phone code request answer. [devCode] is set only in the API's test mode (no Telegram
/// gateway configured, never in production): the app shows and fills it.
typedef PhoneCodeSent = ({String phone, int expiresIn, String? devCode});

/// Contact confirmation and password reset.
abstract interface class AccountApi {
  Future<void> sendEmailCode();
  Future<User> verifyEmail(String code);
  Future<PhoneCodeSent> sendPhoneCode(String phone);
  Future<User> verifyPhone(String code);
  Future<void> forgotPassword(String email);
  Future<void> resetPassword({required String email, required String code, required String password});
}

class HttpAccountApi implements AccountApi {
  HttpAccountApi(this._api);
  final ApiClient _api;

  static final _user = decodeObject(User.fromJson);

  @override
  Future<void> sendEmailCode() => _api.postVoid('/auth/email/send-code');

  @override
  Future<User> verifyEmail(String code) => _api.post('/auth/email/verify', body: {'code': code}, decode: _user);

  @override
  Future<PhoneCodeSent> sendPhoneCode(String phone) => _api.post(
    '/auth/phone/send-code',
    body: {'phone': phone},
    decode: decodeObject(
      (d) => (
        phone: d['phone'] as String? ?? phone,
        expiresIn: (d['expires_in'] as num?)?.toInt() ?? 0,
        devCode: d['dev_code'] as String?,
      ),
    ),
  );

  @override
  Future<User> verifyPhone(String code) => _api.post('/auth/phone/verify', body: {'code': code}, decode: _user);

  @override
  Future<void> forgotPassword(String email) =>
      _api.postVoid('/auth/password/forgot', body: {'email': email}, anonymous: true);

  @override
  Future<void> resetPassword({required String email, required String code, required String password}) => _api.postVoid(
    '/auth/password/reset',
    body: {'email': email, 'code': code, 'password': password},
    anonymous: true,
  );
}

final accountApiProvider = Provider<AccountApi>((ref) => HttpAccountApi(ref.watch(apiClientProvider)));
