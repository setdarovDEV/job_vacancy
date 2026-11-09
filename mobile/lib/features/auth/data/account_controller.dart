import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/auth/session.dart';
import 'account_api.dart';

/// What the account screens can do. Confirming a contact also updates the signed-in user,
/// so screens never coordinate the API and the session themselves.
class AccountController {
  AccountController(this._api, this._session);

  final AccountApi _api;
  final SessionController _session;

  /// Sends a new email code (the "send again" button).
  Future<void> sendEmailCode() => _api.sendEmailCode();

  /// Makes sure a code is on its way, e.g. when the code screen opens from the profile. A
  /// code sent less than a minute ago is still valid, so the API's cooldown answer
  /// (rate_limited) counts as done.
  Future<void> ensureEmailCodeSent() async {
    try {
      await _api.sendEmailCode();
    } on ApiFailure catch (e) {
      if (e.code != 'rate_limited') rethrow;
    }
  }

  Future<void> verifyEmail(String code) async => _session.updateUser(await _api.verifyEmail(code));

  Future<PhoneCodeSent> sendPhoneCode(String phone) => _api.sendPhoneCode(phone.trim());

  Future<void> verifyPhone(String code) async => _session.updateUser(await _api.verifyPhone(code));

  Future<void> forgotPassword(String email) => _api.forgotPassword(email.trim());

  Future<void> resetPassword({required String email, required String code, required String password}) =>
      _api.resetPassword(email: email, code: code, password: password);
}

final accountControllerProvider = Provider<AccountController>(
  (ref) => AccountController(ref.watch(accountApiProvider), ref.read(sessionProvider.notifier)),
);
