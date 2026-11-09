/// What a failed API call means for the app. Screens turn these into text with
/// `ErrorTexts` (core/l10n) and never look at HTTP details themselves.
sealed class ApiException implements Exception {
  const ApiException();
}

/// The server answered with its error envelope:
/// `{"error": {"code", "message", "fields"?, "retry_after"?}}`.
final class ApiFailure extends ApiException {
  const ApiFailure({
    required this.status,
    required this.code,
    this.message = '',
    this.fields = const {},
    this.retryAfter,
  });

  /// Builds a failure from a response body; anything that isn't the envelope becomes
  /// `internal_error` so callers always get a code.
  factory ApiFailure.fromBody(int status, Object? body) {
    final error = body is Map ? body['error'] : null;
    if (error is! Map) return ApiFailure(status: status, code: 'internal_error');
    final fields = error['fields'];
    return ApiFailure(
      status: status,
      code: error['code'] as String? ?? 'internal_error',
      message: error['message'] as String? ?? '',
      fields: fields is Map ? fields.map((k, v) => MapEntry('$k', '$v')) : const {},
      retryAfter: (error['retry_after'] as num?)?.toInt(),
    );
  }

  final int status;
  final String code;
  final String message;

  /// JSON field → failing rule, e.g. `{"password": "password", "skills[2]": "max=50"}`.
  final Map<String, String> fields;

  /// Seconds to wait, for `rate_limited`.
  final int? retryAfter;

  bool get isValidation => code == 'validation_failed';

  @override
  String toString() => 'ApiFailure($status $code $fields)';
}

/// No usable answer: offline, DNS, timeout, TLS.
final class NetworkFailure extends ApiException {
  const NetworkFailure([this.cause]);
  final Object? cause;

  @override
  String toString() => 'NetworkFailure($cause)';
}

/// A 2xx answer that isn't what the API returns: a captive portal's HTML page, a proxy, or
/// a response shape this build doesn't understand.
final class DecodeFailure extends ApiException {
  const DecodeFailure(this.reason);
  final Object reason;

  @override
  String toString() => 'DecodeFailure($reason)';
}
