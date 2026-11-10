import 'package:jobvacancy/core/api/api_client.dart';
import 'package:jobvacancy/core/api/api_exception.dart';
import 'package:jobvacancy/core/auth/refresh_api.dart';
import 'package:jobvacancy/core/auth/session_api.dart';
import 'package:jobvacancy/core/models/auth_result.dart';
import 'package:jobvacancy/core/models/user.dart';
import 'package:jobvacancy/core/notifications/local_notification_service.dart';
import 'package:jobvacancy/core/notifications/push_notification_service.dart';
import 'package:jobvacancy/features/auth/data/account_api.dart';
import 'package:jobvacancy/features/notifications/data/api/notifications_api.dart';
import 'package:jobvacancy/features/notifications/data/models/notification.dart';

User testUser({UserRole role = UserRole.seeker, bool emailVerified = false, bool phoneVerified = false}) => User(
  id: 'u1',
  fullName: 'Aziza Karimova',
  role: role,
  locale: 'uz',
  email: 'aziza@example.com',
  emailVerified: emailVerified,
  phoneVerified: phoneVerified,
);

AuthResult authResult(User user, {String access = 'access-1', String refresh = 'refresh-1', int expiresIn = 900}) =>
    AuthResult(
      user: user,
      accessToken: access,
      accessTokenExpiresAt: DateTime.now().add(Duration(seconds: expiresIn)),
      accessTokenExpiresIn: expiresIn,
      refreshToken: refresh,
    );

/// One recorder shared by the fakes, so tests can assert the order of calls.
class Calls {
  final list = <String>[];
  void add(String c) => list.add(c);
}

class FakeSessionApi implements SessionApi {
  FakeSessionApi(this.calls);
  final Calls calls;
  User user = testUser();
  ApiException? loginError, registerError, meError;

  @override
  Future<AuthResult> login({required String email, required String password}) async {
    calls.add('login $email');
    if (loginError != null) throw loginError!;
    return authResult(user);
  }

  @override
  Future<AuthResult> registerSeeker({
    required String email,
    required String password,
    required String fullName,
    required String locale,
  }) async {
    calls.add('register $email $fullName $locale');
    if (registerError != null) throw registerError!;
    user = user.copyWith(email: email, fullName: fullName);
    return authResult(user);
  }

  @override
  Future<User> me() async {
    calls.add('me');
    if (meError != null) throw meError!;
    return user;
  }

  @override
  Future<void> logout(String refreshToken) async => calls.add('logout');
  @override
  Future<void> logoutAll() async => calls.add('logoutAll');
}

class FakeAccountApi implements AccountApi {
  FakeAccountApi(this.calls, this.session);
  final Calls calls;
  final FakeSessionApi session;
  String validCode = '123456';

  @override
  Future<User> verifyEmail(String code) async {
    calls.add('verifyEmail $code');
    if (code != validCode) throw const ApiFailure(status: 422, code: 'code_invalid');
    return session.user = session.user.copyWith(emailVerified: true);
  }

  @override
  Future<void> sendEmailCode() async => calls.add('sendEmailCode');
  @override
  Future<void> forgotPassword(String email) async => calls.add('forgot $email');
  @override
  Future<void> resetPassword({required String email, required String code, required String password}) async =>
      calls.add('reset');
  @override
  Future<PhoneCodeSent> sendPhoneCode(String phone) async =>
      (phone: '+998901234567', expiresIn: 300, devCode: '654321');
  @override
  Future<User> verifyPhone(String code) async => session.user = session.user.copyWith(phoneVerified: true);
}

/// Answers refresh exchanges from a queue of results (an [ApiException] is thrown).
class FakeRefreshApi implements RefreshApi {
  final answers = <Object>[];
  final sent = <String>[];
  Duration delay = const Duration(milliseconds: 10);

  @override
  Future<AuthResult> exchange(String refreshToken) async {
    sent.add(refreshToken);
    await Future<void>.delayed(delay);
    final a = answers.isEmpty ? authResult(testUser(), access: 'new', refresh: 'r-new') : answers.removeAt(0);
    if (a is ApiException) throw a;
    return a as AuthResult;
  }
}

/// No-op notifications API for widget tests.
class FakeNotificationsApi implements NotificationsApi {
  final Calls calls;
  FakeNotificationsApi(this.calls);

  @override
  Future<Page<AppNotification>> list({bool? unread, String? cursor, int limit = 20}) async =>
      const Page<AppNotification>([], null, meta: {'has_more': false});

  @override
  Future<int> unreadCount() async => 0;

  @override
  Future<void> markRead({List<int>? ids}) async => calls.add('markRead $ids');

  @override
  Future<void> registerDeviceToken({required String token, required String platform}) async =>
      calls.add('registerDeviceToken $token $platform');

  @override
  Future<void> deleteDeviceToken(String token) async => calls.add('deleteDeviceToken $token');
}

/// No-op local notification service for widget tests.
class FakeLocalNotificationService implements LocalNotificationService {
  @override
  Future<void> initialize() async {}

  @override
  Future<void> show(PushMessage message) async {}
}
