import 'package:freezed_annotation/freezed_annotation.dart';

import 'user.dart';

part 'auth_result.freezed.dart';
part 'auth_result.g.dart';

/// Answer of register / login / refresh for mobile clients (refresh token in the body).
@freezed
abstract class AuthResult with _$AuthResult {
  const factory AuthResult({
    required User user,
    required String accessToken,
    required DateTime accessTokenExpiresAt,

    /// Seconds until expiry, measured by the server: the device clock may be wrong, so the
    /// app schedules refreshes from this (see [Tokens.received]).
    int? accessTokenExpiresIn,
    required String refreshToken,
    DateTime? refreshTokenExpiresAt,
    @Default(false) bool isNewUser,
  }) = _AuthResult;

  factory AuthResult.fromJson(Map<String, Object?> json) => _$AuthResultFromJson(json);
}

/// What we keep in secure storage between launches.
@freezed
abstract class Tokens with _$Tokens {
  const factory Tokens({
    required String accessToken,

    /// On the device's clock, so comparing it with the device's `now` is meaningful.
    required DateTime accessTokenExpiresAt,
    required String refreshToken,
  }) = _Tokens;

  const Tokens._();

  factory Tokens.fromJson(Map<String, Object?> json) => _$TokensFromJson(json);

  /// Tokens from an auth answer received at [now] (device clock). The server's absolute
  /// timestamp is only a fallback for servers that don't send `access_token_expires_in`.
  factory Tokens.received(AuthResult r, DateTime now) => Tokens(
    accessToken: r.accessToken,
    accessTokenExpiresAt: r.accessTokenExpiresIn != null
        ? now.add(Duration(seconds: r.accessTokenExpiresIn!))
        : r.accessTokenExpiresAt,
    refreshToken: r.refreshToken,
  );

  /// Refresh a little early so a request doesn't leave with a token about to expire.
  bool expiresSoon(DateTime now) => !now.isBefore(accessTokenExpiresAt.subtract(const Duration(seconds: 30)));
}
