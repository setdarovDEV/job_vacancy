import 'package:flutter_test/flutter_test.dart';
import 'package:jobvacancy/core/l10n/gen/app_localizations_en.dart';
import 'package:jobvacancy/core/l10n/l10n.dart';
import 'package:jobvacancy/features/auth/validators.dart';

void main() {
  final v = Validators(ErrorTexts(AppLocalizationsEn(), 'en'));

  test('password follows the API rule: a letter and a digit', () {
    expect(v.password('Secret123'), isNull);
    expect(v.password('Сирли123'), isNull); // non-ASCII letters count
    expect(v.password('short1'), isNotNull);
    expect(v.password('onlyletters'), isNotNull);
    expect(v.password('12345678'), isNotNull);
  });

  test('password length is counted in UTF-8 bytes, 8–72, like the server (API-047)', () {
    expect(Validators.isStrongPassword('Ўзбе1'), isTrue, reason: '5 characters, 9 bytes');
    expect(Validators.isStrongPassword('Ўзб1'), isFalse, reason: '4 characters, 7 bytes');
    expect(Validators.isStrongPassword('a1${'ў' * 35}'), isTrue, reason: 'exactly 72 bytes');
    expect(Validators.isStrongPassword('a1${'ў' * 36}'), isFalse, reason: '74 bytes, though only 38 characters');
    expect(v.password('short1'), v.texts.ruleText('password'), reason: 'same rule name as the server');
    expect(v.password('a1${'x' * 71}'), v.texts.ruleText('password'));
  });

  test('email, name, code, phone', () {
    expect(v.email(' a@b.uz '), isNull);
    expect(v.email('a@b'), isNotNull);
    expect(v.fullName('A'), isNotNull);
    expect(v.fullName('Ali Valiyev'), isNull);
    expect(v.code('12345'), isNotNull);
    expect(v.code('123456'), isNull);
    expect(v.phone('+998 90 123 45 67'), isNull);
    expect(v.phone('+998 '), isNotNull);
    expect(v.phone('+7 900 1234567'), isNotNull);
  });
}
