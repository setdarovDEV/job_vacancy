/// Where anything that talks to the API gets an access token: the HTTP client today, the
/// chat WebSocket (9D) later. Implementations share one refresh, so two clients never
/// rotate the refresh token at the same time.
abstract interface class AccessTokenSource {
  /// A token to send now (renewed first if it is about to expire), or null when signed
  /// out. Offline, the old token is returned and the server's 401 decides.
  Future<String?> current();

  /// The server refused [rejected]: a new token, or null when the session is over.
  /// Throws [NetworkFailure] when offline (the session is kept).
  Future<String?> renew({required String rejected});
}
