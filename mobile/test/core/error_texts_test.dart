import 'package:flutter_test/flutter_test.dart';
import 'package:jobvacancy/core/api/api_exception.dart';
import 'package:jobvacancy/core/l10n/gen/app_localizations_en.dart';
import 'package:jobvacancy/core/l10n/gen/app_localizations_uz.dart';
import 'package:jobvacancy/core/l10n/l10n.dart';

void main() {
  final uz = ErrorTexts(AppLocalizationsUz(), 'uz');
  final en = ErrorTexts(AppLocalizationsEn(), 'en');

  test('field rules use the web wording, with parameters', () {
    final f = uz.fields(
      const ApiFailure(status: 422, code: 'validation_failed', fields: {'password': 'min=8', 'email': 'email'}),
    );
    expect(f['password'], 'Kamida 8 ta belgi');
    expect(f['email'], "Email manzili noto'g'ri");
  });

  test('on list fields min/max count items; element errors also show under the list', () {
    final f = en.fields(const ApiFailure(status: 422, code: 'validation_failed', fields: {'skills': 'max=20'}));
    expect(f['skills'], 'At most 20 items');
    final g = en.fields(const ApiFailure(status: 422, code: 'validation_failed', fields: {'skills[3]': 'max=50'}));
    expect(g['skills[3]'], 'At most 50 characters');
    expect(g['skills'], 'At most 50 characters');
  });

  test('whole-form messages: API codes, rate limit, network, unknown', () {
    expect(uz.message(const ApiFailure(status: 401, code: 'invalid_credentials')), isNot(uz.l10n.errorsInternalError));
    expect(en.message(const ApiFailure(status: 429, code: 'rate_limited', retryAfter: 30)), contains('30'));
    expect(en.message(const NetworkFailure()), en.l10n.errorsNetwork);
    expect(en.message(const ApiFailure(status: 500, code: 'something_new')), en.l10n.errorsInternalError);
    expect(en.message(const DecodeFailure('html')), en.l10n.errorsInternalError);
  });

  test('a validation error about a field the form does not show is summarised', () {
    const e = ApiFailure(status: 422, code: 'validation_failed', fields: {'email': 'unique'});
    expect(en.message(e, shownFields: {'email', 'password'}), isNull);
    expect(en.message(e, shownFields: {'password'}), en.l10n.appCheckFields);
  });

  test('element errors mark their field as a list even when it is not known in advance', () {
    final f = en.fields(
      const ApiFailure(status: 422, code: 'validation_failed', fields: {'tags': 'max=5', 'tags[0]': 'max=30'}),
    );
    expect(f['tags'], 'At most 5 items');
    expect(f['tags[0]'], 'At most 30 characters');
  });
}
