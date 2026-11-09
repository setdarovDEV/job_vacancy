import 'dart:io' show Platform;

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Build-time settings. Override with `--dart-define=API_BASE_URL=https://jobvacancy.uz/api/v1`.
class AppConfig {
  const AppConfig({required this.apiBaseUrl, required this.clientType});

  static const _apiOverride = String.fromEnvironment('API_BASE_URL');

  /// Without an override the app talks to the dev API on the host machine: 10.0.2.2 from
  /// the Android emulator, localhost from the iOS simulator.
  factory AppConfig.fromEnvironment() {
    final ios = Platform.isIOS;
    final api = _apiOverride.isNotEmpty ? _apiOverride : 'http://${ios ? 'localhost' : '10.0.2.2'}:8090/api/v1';
    return AppConfig(apiBaseUrl: api, clientType: ios ? 'ios' : 'android');
  }

  final String apiBaseUrl;

  /// Sent as X-Client-Type: the API then returns refresh tokens in the body, not a cookie.
  final String clientType;
}

final appConfigProvider = Provider<AppConfig>((_) => AppConfig.fromEnvironment());
