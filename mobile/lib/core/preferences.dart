import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'l10n/gen/app_localizations.dart';

/// Overridden in main() with the loaded instance, so reads are synchronous.
final sharedPreferencesProvider = Provider<SharedPreferences>((_) => throw UnimplementedError('override in main'));

/// The four app languages and the tags the API uses for them.
enum AppLanguage {
  uz(Locale('uz'), 'uz', "O'zbekcha"),
  uzCyrl(Locale.fromSubtags(languageCode: 'uz', scriptCode: 'Cyrl'), 'uz-Cyrl', 'Ўзбекча'),
  ru(Locale('ru'), 'ru', 'Русский'),
  en(Locale('en'), 'en', 'English');

  const AppLanguage(this.locale, this.tag, this.nativeName);
  final Locale locale;
  final String tag;
  final String nativeName;

  static AppLanguage? byTag(String? tag) => values.where((l) => l.tag == tag).firstOrNull;

  /// Best match for a device locale; Uzbek is the default for everything else.
  static AppLanguage forDevice(Locale device) {
    if (device.languageCode == 'uz') return device.scriptCode == 'Cyrl' ? uzCyrl : uz;
    return values.where((l) => l.locale.languageCode == device.languageCode).firstOrNull ?? uz;
  }
}

/// Chosen language; null follows the device.
class LanguageController extends Notifier<AppLanguage?> {
  static const _key = 'jv.language';

  @override
  AppLanguage? build() => AppLanguage.byTag(ref.read(sharedPreferencesProvider).getString(_key));

  Future<void> set(AppLanguage? lang) async {
    final prefs = ref.read(sharedPreferencesProvider);
    lang == null ? await prefs.remove(_key) : await prefs.setString(_key, lang.tag);
    state = lang;
  }
}

final languageProvider = NotifierProvider<LanguageController, AppLanguage?>(LanguageController.new);

/// The device's locale, updated when the user changes it in system settings.
class DeviceLocaleController extends Notifier<Locale> with WidgetsBindingObserver {
  @override
  Locale build() {
    final binding = WidgetsBinding.instance..addObserver(this);
    ref.onDispose(() => binding.removeObserver(this));
    return binding.platformDispatcher.locale;
  }

  @override
  void didChangeLocales(List<Locale>? locales) {
    if (locales != null && locales.isNotEmpty) state = locales.first;
  }
}

final deviceLocaleProvider = NotifierProvider<DeviceLocaleController, Locale>(DeviceLocaleController.new);

/// The language in effect (UI and the API's Accept-Language): the user's choice, else the
/// device's.
final effectiveLanguageProvider = Provider<AppLanguage>(
  (ref) => ref.watch(languageProvider) ?? AppLanguage.forDevice(ref.watch(deviceLocaleProvider)),
);

class ThemeModeController extends Notifier<ThemeMode> {
  static const _key = 'jv.theme';

  @override
  ThemeMode build() => switch (ref.read(sharedPreferencesProvider).getString(_key)) {
    'light' => ThemeMode.light,
    'dark' => ThemeMode.dark,
    _ => ThemeMode.system,
  };

  Future<void> set(ThemeMode mode) async {
    await ref.read(sharedPreferencesProvider).setString(_key, mode.name);
    state = mode;
  }
}

final themeModeProvider = NotifierProvider<ThemeModeController, ThemeMode>(ThemeModeController.new);

/// Supported locales in the order the generated delegate expects.
const supportedLocales = AppLocalizations.supportedLocales;

/// Whether the welcome screen was seen; signed-out first launches start there.
class OnboardingController extends Notifier<bool> {
  static const _key = 'jv.onboarded';

  @override
  bool build() => ref.read(sharedPreferencesProvider).getBool(_key) ?? false;

  Future<void> done() async {
    await ref.read(sharedPreferencesProvider).setBool(_key, true);
    state = true;
  }
}

final onboardedProvider = NotifierProvider<OnboardingController, bool>(OnboardingController.new);
