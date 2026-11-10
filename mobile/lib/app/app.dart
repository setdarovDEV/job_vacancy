import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/l10n/l10n.dart';
import '../core/notifications/push_notification_service.dart';
import '../core/preferences.dart';
import '../core/theme/app_theme.dart';
import 'push_token_registrar.dart';
import 'router.dart';

class JobVacancyApp extends ConsumerWidget {
  const JobVacancyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chosen = ref.watch(languageProvider);
    // Keep push token registration alive for the lifetime of the app.
    ref.watch(pushTokenRegistrarProvider);
    unawaited(ref.read(pushNotificationServiceProvider).initialize());
    return MaterialApp.router(
      title: 'Job Vacancy',
      debugShowCheckedModeBanner: false,
      routerConfig: ref.watch(routerProvider),
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: ref.watch(themeModeProvider),
      locale: chosen?.locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      // Same fallback as the API: Uzbek (Latin) for languages the app doesn't speak.
      localeResolutionCallback: (device, _) => AppLanguage.forDevice(device ?? const Locale('uz')).locale,
    );
  }
}
