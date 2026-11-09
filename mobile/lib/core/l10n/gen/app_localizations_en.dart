// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get accountCandidates => 'Find candidates';

  @override
  String get accountDashboard => 'Dashboard';

  @override
  String get accountMenu => 'Account menu';

  @override
  String get accountMyResumes => 'My resumes';

  @override
  String get accountMyVacancies => 'My jobs';

  @override
  String get accountNotifications => 'Notifications';

  @override
  String get accountSearches => 'Saved searches';

  @override
  String get accountSettings => 'Settings';

  @override
  String get appCheckFields => 'Check the highlighted fields.';

  @override
  String get appComingSoonBody => 'This section arrives in the next update.';

  @override
  String get appComingSoonTitle => 'Coming soon';

  @override
  String get appEmployerBody =>
      'The first version of the app is for job seekers. To post jobs and review applications, use jobvacancy.uz.';

  @override
  String get appEmployerTitle => 'Employer tools are on the website';

  @override
  String get appGetStarted => 'Get started';

  @override
  String get appPhoneTitle => 'Confirm your phone';

  @override
  String get appSignOutAll => 'Sign out everywhere';

  @override
  String get appSkip => 'Skip';

  @override
  String get appUnverified => 'Not confirmed';

  @override
  String get appWelcomeBody => 'From Tashkent to Nukus, from cashier to developer. New jobs every day.';

  @override
  String get appWelcomeTitle => 'Jobs and people in one place';

  @override
  String get authAgree => 'By creating an account you accept the terms of use and privacy policy.';

  @override
  String get authCode => 'Confirmation code';

  @override
  String get authCodeSent => 'A new code is on its way';

  @override
  String get authForgot => 'Forgot your password?';

  @override
  String get authForgotBody => 'Enter your email and we\'ll send a reset code.';

  @override
  String get authForgotTitle => 'Reset your password';

  @override
  String get authFullName => 'Full name';

  @override
  String get authGoogle => 'Continue with Google';

  @override
  String get authHaveAccount => 'Already have an account?';

  @override
  String get authLater => 'Later';

  @override
  String get authLoginSubtitle => 'Your applications, messages and saved jobs are here.';

  @override
  String get authLoginTitle => 'Sign in';

  @override
  String get authNewPassword => 'New password';

  @override
  String get authNoAccount => 'No account yet?';

  @override
  String get authOr => 'or';

  @override
  String get authPasswordHint => 'At least 8 characters, with a letter and a digit';

  @override
  String get authRegisterSubtitle => 'It takes a minute.';

  @override
  String get authRegisterTitle => 'Create an account';

  @override
  String get authResend => 'Resend code';

  @override
  String authResendIn(String s) {
    return 'Resend in $s s';
  }

  @override
  String authResetBody(String email) {
    return 'Enter the code we sent to $email and a new password.';
  }

  @override
  String get authResetDone => 'Password updated. Sign in with the new one.';

  @override
  String get authResetSubmit => 'Save password';

  @override
  String get authResetTitle => 'Set a new password';

  @override
  String get authRoleEmployer => 'I\'m hiring';

  @override
  String get authRoleEmployerHint => 'Post jobs and find candidates';

  @override
  String get authRoleQuestion => 'What brings you here?';

  @override
  String get authRoleSeeker => 'I\'m looking for a job';

  @override
  String get authRoleSeekerHint => 'Build a resume and apply';

  @override
  String get authSendCode => 'Send code';

  @override
  String get authSignedOut => 'You\'re signed out';

  @override
  String get authSubmitLogin => 'Sign in';

  @override
  String get authSubmitRegister => 'Create account';

  @override
  String get authVerified => 'Email confirmed';

  @override
  String authVerifyBody(String email) {
    return 'We sent a 6-digit code to $email. It\'s valid for 15 minutes.';
  }

  @override
  String get authVerifySubmit => 'Confirm';

  @override
  String get authVerifyTitle => 'Confirm your email';

  @override
  String authWelcome(String name) {
    return 'Welcome, $name!';
  }

  @override
  String get brandName => 'Job Vacancy';

  @override
  String get brandTagline => 'Jobs and people in Uzbekistan';

  @override
  String get commonApply => 'Apply';

  @override
  String get commonBack => 'Back';

  @override
  String get commonCancel => 'Cancel';

  @override
  String get commonClear => 'Clear';

  @override
  String get commonClose => 'Close';

  @override
  String get commonDelete => 'Delete';

  @override
  String get commonDone => 'Done';

  @override
  String get commonEdit => 'Edit';

  @override
  String get commonFeatured => 'TOP';

  @override
  String get commonFilters => 'Filters';

  @override
  String get commonLoading => 'Loading';

  @override
  String get commonMore => 'More';

  @override
  String get commonNoResults => 'Nothing found';

  @override
  String get commonOpen => 'Open';

  @override
  String get commonOptional => 'optional';

  @override
  String get commonRetry => 'Try again';

  @override
  String get commonSave => 'Save';

  @override
  String get commonSaved => 'Saved';

  @override
  String get commonSearch => 'Search';

  @override
  String get commonShowAll => 'Show all';

  @override
  String get commonSoon => 'Coming soon';

  @override
  String get commonVerified => 'Verified';

  @override
  String get errorsInternalError => 'Something went wrong on the server. Try again in a moment.';

  @override
  String get errorsNetwork => 'Can\'t reach the server. Check your connection and try again.';

  @override
  String get errorsNotFound => 'Page not found';

  @override
  String get errorsNotFoundBody => 'The link is out of date or the address has a typo.';

  @override
  String errorsRateLimited(String seconds) {
    return 'Too many requests. Try again in $seconds s.';
  }

  @override
  String get errorsToHome => 'Go to the home page';

  @override
  String get errorsUnauthorized => 'Sign in to continue.';

  @override
  String get formEmail => 'Email';

  @override
  String get formHidePassword => 'Hide password';

  @override
  String get formPassword => 'Password';

  @override
  String get formShowPassword => 'Show password';

  @override
  String get languageLabel => 'Language';

  @override
  String get navApplications => 'My applications';

  @override
  String get navCandidates => 'Candidates';

  @override
  String get navCompanies => 'Companies';

  @override
  String get navForEmployers => 'For employers';

  @override
  String get navMenu => 'Menu';

  @override
  String get navMessages => 'Messages';

  @override
  String get navPostVacancy => 'Post a job';

  @override
  String get navProfile => 'Profile';

  @override
  String get navSaved => 'Saved';

  @override
  String get navSignIn => 'Sign in';

  @override
  String get navSignOut => 'Sign out';

  @override
  String get navSignUp => 'Sign up';

  @override
  String get navSkipToContent => 'Skip to content';

  @override
  String get navVacancies => 'Jobs';

  @override
  String get settingsByEmail => 'Email';

  @override
  String get settingsByEmailHint => 'Application updates, invitations and new jobs';

  @override
  String get settingsByTelegram => 'Telegram';

  @override
  String get settingsChangePassword => 'Change password';

  @override
  String get settingsChangePhoto => 'Change photo';

  @override
  String get settingsContacts => 'Contacts';

  @override
  String get settingsContactsHint => 'You need a verified email or phone to apply.';

  @override
  String get settingsCurrentPassword => 'Current password';

  @override
  String get settingsDevCode => 'Test mode: Telegram isn\'t connected, so the code is shown here and filled in:';

  @override
  String get settingsLanguage => 'Notification language';

  @override
  String get settingsLanguageHint => 'Emails and Telegram messages arrive in this language.';

  @override
  String get settingsNotifyHint => 'Where new applications, invitations and messages should reach you.';

  @override
  String get settingsPassword => 'Password';

  @override
  String get settingsPasswordChanged => 'Password changed';

  @override
  String get settingsPasswordHint => 'Changing it signs you out on your other devices.';

  @override
  String get settingsPasswordNone => 'You sign in with Google. Set a password to sign in with email too.';

  @override
  String get settingsPhone => 'Phone number';

  @override
  String settingsPhoneCodeSent(String phone) {
    return 'We sent a code to $phone via Telegram.';
  }

  @override
  String get settingsPhoneHint => 'The code comes to the \"Verification Codes\" chat in Telegram, not by SMS.';

  @override
  String get settingsPhoneVerified => 'Phone number verified';

  @override
  String get settingsProfile => 'Profile';

  @override
  String get settingsProfileHint => 'Employers see your name and photo.';

  @override
  String get settingsSendTelegramCode => 'Get a code in Telegram';

  @override
  String get settingsSessions => 'Devices';

  @override
  String get settingsSessionsHint => 'Devices signed in to your account. Remove any you don\'t recognize.';

  @override
  String get settingsSignOutDevice => 'Sign out this device';

  @override
  String get settingsSignOutOthers => 'Sign out all other devices';

  @override
  String get settingsTelegramLink => 'Connect Telegram';

  @override
  String get settingsTelegramLinked => 'Telegram connected';

  @override
  String get settingsTelegramOff => 'Connect Telegram first';

  @override
  String settingsTelegramOn(String bot) {
    return 'via the $bot bot';
  }

  @override
  String get settingsTelegramUnlink => 'Disconnect Telegram';

  @override
  String get settingsTelegramWaiting => 'Press \"Start\" in Telegram…';

  @override
  String get settingsThisDevice => 'This device';

  @override
  String get settingsUploadFailed => 'Couldn\'t upload the photo. Try again.';

  @override
  String get settingsUploadPhoto => 'Upload photo';

  @override
  String get settingsVerify => 'Verify';

  @override
  String get themeDark => 'Dark';

  @override
  String get themeLabel => 'Theme';

  @override
  String get themeLight => 'Light';

  @override
  String get themeSystem => 'Auto';
}
