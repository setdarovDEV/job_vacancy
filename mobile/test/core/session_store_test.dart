import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jobvacancy/core/auth/session_store.dart';
import 'package:jobvacancy/core/models/auth_result.dart';

import '../support/fakes.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('secure store keeps tokens and user across reads, and clears both', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final s = SecureSessionStore();
    final t = Tokens(accessToken: 'a', accessTokenExpiresAt: DateTime.utc(2030), refreshToken: 'r');
    await s.save(t, testUser());
    expect(await s.readTokens(), t);
    expect((await s.readUser())?.fullName, 'Aziza Karimova');
    await s.clear();
    expect(await s.readTokens(), isNull);
    expect(await s.readUser(), isNull);
  });

  test('unreadable data from an older build is dropped instead of crashing', () async {
    FlutterSecureStorage.setMockInitialValues({'jv.tokens': '{"not":"tokens"}'});
    final s = SecureSessionStore();
    expect(await s.readTokens(), isNull);
    expect(await const FlutterSecureStorage().read(key: 'jv.tokens'), isNull);
  });
}
