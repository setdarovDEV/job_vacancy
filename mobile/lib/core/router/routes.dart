/// Every path in the app, so screens never spell them out.
abstract final class Routes {
  static const splash = '/splash';
  static const welcome = '/welcome';
  static const login = '/login';
  static const register = '/register';
  static const forgot = '/forgot';
  static const reset = '/reset'; // ?email=
  static const verifyEmail = '/verify-email';

  /// The code entry, requesting a new code on open (from the profile).
  static const verifyEmailAndSend = '$verifyEmail?send=1';
  static const verifyPhone = '/verify-phone';
  static const employer = '/employer';

  static const jobs = '/jobs';
  static const saved = '/saved';
  static const applications = '/applications';
  static const messages = '/messages';
  static const profile = '/profile';

  /// Screens for signed-out visitors; a signed-in user is sent home from them.
  static const signedOutOnly = {welcome, login, register, forgot, reset};

  /// Screens that need a signed-in user.
  static const signedInOnly = {verifyEmail, verifyPhone, employer};
}
