import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ru.dart';
import 'app_localizations_uz.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'gen/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale) : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates = <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('ru'),
    Locale('uz'),
    Locale.fromSubtags(languageCode: 'uz', scriptCode: 'Cyrl'),
  ];

  /// No description provided for @accountCandidates.
  ///
  /// In uz, this message translates to:
  /// **'Nomzodlar qidirish'**
  String get accountCandidates;

  /// No description provided for @accountDashboard.
  ///
  /// In uz, this message translates to:
  /// **'Kabinet'**
  String get accountDashboard;

  /// No description provided for @accountMenu.
  ///
  /// In uz, this message translates to:
  /// **'Hisob menyusi'**
  String get accountMenu;

  /// No description provided for @accountMyResumes.
  ///
  /// In uz, this message translates to:
  /// **'Rezyumelarim'**
  String get accountMyResumes;

  /// No description provided for @accountMyVacancies.
  ///
  /// In uz, this message translates to:
  /// **'Vakansiyalarim'**
  String get accountMyVacancies;

  /// No description provided for @accountNotifications.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get accountNotifications;

  /// No description provided for @accountSearches.
  ///
  /// In uz, this message translates to:
  /// **'Saqlangan qidiruvlar'**
  String get accountSearches;

  /// No description provided for @accountSettings.
  ///
  /// In uz, this message translates to:
  /// **'Sozlamalar'**
  String get accountSettings;

  /// No description provided for @appCheckFields.
  ///
  /// In uz, this message translates to:
  /// **'Belgilangan maydonlarni tekshiring.'**
  String get appCheckFields;

  /// No description provided for @appComingSoonBody.
  ///
  /// In uz, this message translates to:
  /// **'Bu bo\'lim ilovaning keyingi yangilanishida chiqadi.'**
  String get appComingSoonBody;

  /// No description provided for @appComingSoonTitle.
  ///
  /// In uz, this message translates to:
  /// **'Tez kunda'**
  String get appComingSoonTitle;

  /// No description provided for @appEmployerBody.
  ///
  /// In uz, this message translates to:
  /// **'Ilovaning birinchi versiyasi ish izlovchilar uchun. Vakansiya joylash va arizalarni ko\'rish uchun jobvacancy.uz saytidan foydalaning.'**
  String get appEmployerBody;

  /// No description provided for @appEmployerTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ish beruvchi vositalari saytda'**
  String get appEmployerTitle;

  /// No description provided for @appGetStarted.
  ///
  /// In uz, this message translates to:
  /// **'Boshlash'**
  String get appGetStarted;

  /// No description provided for @appPhoneTitle.
  ///
  /// In uz, this message translates to:
  /// **'Telefonni tasdiqlash'**
  String get appPhoneTitle;

  /// No description provided for @appSignOutAll.
  ///
  /// In uz, this message translates to:
  /// **'Hamma qurilmalardan chiqish'**
  String get appSignOutAll;

  /// No description provided for @appSkip.
  ///
  /// In uz, this message translates to:
  /// **'O\'tkazib yuborish'**
  String get appSkip;

  /// No description provided for @appUnverified.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlanmagan'**
  String get appUnverified;

  /// No description provided for @appWelcomeBody.
  ///
  /// In uz, this message translates to:
  /// **'Toshkentdan Nukusgacha, kassirdan dasturchigacha. Vakansiyalar har kuni yangilanadi.'**
  String get appWelcomeBody;

  /// No description provided for @appWelcomeTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ish va xodimlar bir joyda'**
  String get appWelcomeTitle;

  /// No description provided for @authAgree.
  ///
  /// In uz, this message translates to:
  /// **'Hisob ochib, foydalanish shartlari va maxfiylik siyosatiga rozilik bildirasiz.'**
  String get authAgree;

  /// No description provided for @authCode.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash kodi'**
  String get authCode;

  /// No description provided for @authCodeSent.
  ///
  /// In uz, this message translates to:
  /// **'Yangi kod yuborildi'**
  String get authCodeSent;

  /// No description provided for @authForgot.
  ///
  /// In uz, this message translates to:
  /// **'Parolni unutdingizmi?'**
  String get authForgot;

  /// No description provided for @authForgotBody.
  ///
  /// In uz, this message translates to:
  /// **'Emailingizni kiriting, tiklash kodini yuboramiz.'**
  String get authForgotBody;

  /// No description provided for @authForgotTitle.
  ///
  /// In uz, this message translates to:
  /// **'Parolni tiklash'**
  String get authForgotTitle;

  /// No description provided for @authFullName.
  ///
  /// In uz, this message translates to:
  /// **'Ism va familiya'**
  String get authFullName;

  /// No description provided for @authGoogle.
  ///
  /// In uz, this message translates to:
  /// **'Google orqali davom etish'**
  String get authGoogle;

  /// No description provided for @authHaveAccount.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingiz bormi?'**
  String get authHaveAccount;

  /// No description provided for @authLater.
  ///
  /// In uz, this message translates to:
  /// **'Keyinroq'**
  String get authLater;

  /// No description provided for @authLoginSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Arizalar, xabarlar va saqlangan vakansiyalar shu yerda.'**
  String get authLoginSubtitle;

  /// No description provided for @authLoginTitle.
  ///
  /// In uz, this message translates to:
  /// **'Tizimga kirish'**
  String get authLoginTitle;

  /// No description provided for @authNewPassword.
  ///
  /// In uz, this message translates to:
  /// **'Yangi parol'**
  String get authNewPassword;

  /// No description provided for @authNoAccount.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingiz yo\'qmi?'**
  String get authNoAccount;

  /// No description provided for @authOr.
  ///
  /// In uz, this message translates to:
  /// **'yoki'**
  String get authOr;

  /// No description provided for @authPasswordHint.
  ///
  /// In uz, this message translates to:
  /// **'Kamida 8 belgi, harf va raqam bilan'**
  String get authPasswordHint;

  /// No description provided for @authRegisterSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Hisob ochish bir daqiqa oladi.'**
  String get authRegisterSubtitle;

  /// No description provided for @authRegisterTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ro\'yxatdan o\'tish'**
  String get authRegisterTitle;

  /// No description provided for @authResend.
  ///
  /// In uz, this message translates to:
  /// **'Kodni qayta yuborish'**
  String get authResend;

  /// No description provided for @authResendIn.
  ///
  /// In uz, this message translates to:
  /// **'Qayta yuborish: {s} s'**
  String authResendIn(String s);

  /// No description provided for @authResetBody.
  ///
  /// In uz, this message translates to:
  /// **'{email} manziliga yuborilgan kodni va yangi parolni kiriting.'**
  String authResetBody(String email);

  /// No description provided for @authResetDone.
  ///
  /// In uz, this message translates to:
  /// **'Parol yangilandi. Yangi parol bilan kiring.'**
  String get authResetDone;

  /// No description provided for @authResetSubmit.
  ///
  /// In uz, this message translates to:
  /// **'Parolni saqlash'**
  String get authResetSubmit;

  /// No description provided for @authResetTitle.
  ///
  /// In uz, this message translates to:
  /// **'Yangi parol o\'rnating'**
  String get authResetTitle;

  /// No description provided for @authRoleEmployer.
  ///
  /// In uz, this message translates to:
  /// **'Xodim qidiryapman'**
  String get authRoleEmployer;

  /// No description provided for @authRoleEmployerHint.
  ///
  /// In uz, this message translates to:
  /// **'Vakansiya joylang, nomzod toping'**
  String get authRoleEmployerHint;

  /// No description provided for @authRoleQuestion.
  ///
  /// In uz, this message translates to:
  /// **'Nima uchun kerak?'**
  String get authRoleQuestion;

  /// No description provided for @authRoleSeeker.
  ///
  /// In uz, this message translates to:
  /// **'Ish qidiryapman'**
  String get authRoleSeeker;

  /// No description provided for @authRoleSeekerHint.
  ///
  /// In uz, this message translates to:
  /// **'Rezyume yarating, ariza yuboring'**
  String get authRoleSeekerHint;

  /// No description provided for @authSendCode.
  ///
  /// In uz, this message translates to:
  /// **'Kod yuborish'**
  String get authSendCode;

  /// No description provided for @authSignedOut.
  ///
  /// In uz, this message translates to:
  /// **'Tizimdan chiqdingiz'**
  String get authSignedOut;

  /// No description provided for @authSubmitLogin.
  ///
  /// In uz, this message translates to:
  /// **'Kirish'**
  String get authSubmitLogin;

  /// No description provided for @authSubmitRegister.
  ///
  /// In uz, this message translates to:
  /// **'Hisob ochish'**
  String get authSubmitRegister;

  /// No description provided for @authVerified.
  ///
  /// In uz, this message translates to:
  /// **'Email tasdiqlandi'**
  String get authVerified;

  /// No description provided for @authVerifyBody.
  ///
  /// In uz, this message translates to:
  /// **'{email} manziliga 6 xonali kod yubordik. Kod 15 daqiqa amal qiladi.'**
  String authVerifyBody(String email);

  /// No description provided for @authVerifySubmit.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash'**
  String get authVerifySubmit;

  /// No description provided for @authVerifyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Emailingizni tasdiqlang'**
  String get authVerifyTitle;

  /// No description provided for @authWelcome.
  ///
  /// In uz, this message translates to:
  /// **'Xush kelibsiz, {name}!'**
  String authWelcome(String name);

  /// No description provided for @brandName.
  ///
  /// In uz, this message translates to:
  /// **'Job Vacancy'**
  String get brandName;

  /// No description provided for @brandTagline.
  ///
  /// In uz, this message translates to:
  /// **'O\'zbekistondagi ishlar va xodimlar'**
  String get brandTagline;

  /// No description provided for @commonApply.
  ///
  /// In uz, this message translates to:
  /// **'Ariza yuborish'**
  String get commonApply;

  /// No description provided for @commonBack.
  ///
  /// In uz, this message translates to:
  /// **'Orqaga'**
  String get commonBack;

  /// No description provided for @commonCancel.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get commonCancel;

  /// No description provided for @commonClear.
  ///
  /// In uz, this message translates to:
  /// **'Tozalash'**
  String get commonClear;

  /// No description provided for @commonClose.
  ///
  /// In uz, this message translates to:
  /// **'Yopish'**
  String get commonClose;

  /// No description provided for @commonDelete.
  ///
  /// In uz, this message translates to:
  /// **'O\'chirish'**
  String get commonDelete;

  /// No description provided for @commonDone.
  ///
  /// In uz, this message translates to:
  /// **'Tayyor'**
  String get commonDone;

  /// No description provided for @commonEdit.
  ///
  /// In uz, this message translates to:
  /// **'Tahrirlash'**
  String get commonEdit;

  /// No description provided for @commonFeatured.
  ///
  /// In uz, this message translates to:
  /// **'TOP'**
  String get commonFeatured;

  /// No description provided for @commonFilters.
  ///
  /// In uz, this message translates to:
  /// **'Filtrlar'**
  String get commonFilters;

  /// No description provided for @commonLoading.
  ///
  /// In uz, this message translates to:
  /// **'Yuklanmoqda'**
  String get commonLoading;

  /// No description provided for @commonMore.
  ///
  /// In uz, this message translates to:
  /// **'Yana'**
  String get commonMore;

  /// No description provided for @commonNoResults.
  ///
  /// In uz, this message translates to:
  /// **'Hech narsa topilmadi'**
  String get commonNoResults;

  /// No description provided for @commonOpen.
  ///
  /// In uz, this message translates to:
  /// **'Ochish'**
  String get commonOpen;

  /// No description provided for @commonOptional.
  ///
  /// In uz, this message translates to:
  /// **'ixtiyoriy'**
  String get commonOptional;

  /// No description provided for @commonRetry.
  ///
  /// In uz, this message translates to:
  /// **'Qayta urinish'**
  String get commonRetry;

  /// No description provided for @commonSave.
  ///
  /// In uz, this message translates to:
  /// **'Saqlash'**
  String get commonSave;

  /// No description provided for @commonSaved.
  ///
  /// In uz, this message translates to:
  /// **'Saqlandi'**
  String get commonSaved;

  /// No description provided for @commonSearch.
  ///
  /// In uz, this message translates to:
  /// **'Qidirish'**
  String get commonSearch;

  /// No description provided for @commonShowAll.
  ///
  /// In uz, this message translates to:
  /// **'Hammasini ko\'rish'**
  String get commonShowAll;

  /// No description provided for @commonSoon.
  ///
  /// In uz, this message translates to:
  /// **'Tez kunda'**
  String get commonSoon;

  /// No description provided for @commonVerified.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlangan'**
  String get commonVerified;

  /// No description provided for @errorsInternalError.
  ///
  /// In uz, this message translates to:
  /// **'Serverda xatolik yuz berdi. Birozdan keyin qayta urinib ko\'ring.'**
  String get errorsInternalError;

  /// No description provided for @errorsNetwork.
  ///
  /// In uz, this message translates to:
  /// **'Server bilan aloqa yo\'q. Internetni tekshirib, qayta urinib ko\'ring.'**
  String get errorsNetwork;

  /// No description provided for @errorsNotFound.
  ///
  /// In uz, this message translates to:
  /// **'Sahifa topilmadi'**
  String get errorsNotFound;

  /// No description provided for @errorsNotFoundBody.
  ///
  /// In uz, this message translates to:
  /// **'Havola eskirgan yoki manzilda xato bor.'**
  String get errorsNotFoundBody;

  /// No description provided for @errorsRateLimited.
  ///
  /// In uz, this message translates to:
  /// **'So\'rovlar juda ko\'p. {seconds} soniyadan keyin qayta urinib ko\'ring.'**
  String errorsRateLimited(String seconds);

  /// No description provided for @errorsToHome.
  ///
  /// In uz, this message translates to:
  /// **'Bosh sahifaga'**
  String get errorsToHome;

  /// No description provided for @errorsUnauthorized.
  ///
  /// In uz, this message translates to:
  /// **'Davom etish uchun tizimga kiring.'**
  String get errorsUnauthorized;

  /// No description provided for @formEmail.
  ///
  /// In uz, this message translates to:
  /// **'Email'**
  String get formEmail;

  /// No description provided for @formHidePassword.
  ///
  /// In uz, this message translates to:
  /// **'Parolni yashirish'**
  String get formHidePassword;

  /// No description provided for @formPassword.
  ///
  /// In uz, this message translates to:
  /// **'Parol'**
  String get formPassword;

  /// No description provided for @formShowPassword.
  ///
  /// In uz, this message translates to:
  /// **'Parolni ko\'rsatish'**
  String get formShowPassword;

  /// No description provided for @languageLabel.
  ///
  /// In uz, this message translates to:
  /// **'Til'**
  String get languageLabel;

  /// No description provided for @navApplications.
  ///
  /// In uz, this message translates to:
  /// **'Arizalarim'**
  String get navApplications;

  /// No description provided for @navCandidates.
  ///
  /// In uz, this message translates to:
  /// **'Nomzodlar'**
  String get navCandidates;

  /// No description provided for @navCompanies.
  ///
  /// In uz, this message translates to:
  /// **'Kompaniyalar'**
  String get navCompanies;

  /// No description provided for @navForEmployers.
  ///
  /// In uz, this message translates to:
  /// **'Ish beruvchilarga'**
  String get navForEmployers;

  /// No description provided for @navMenu.
  ///
  /// In uz, this message translates to:
  /// **'Menyu'**
  String get navMenu;

  /// No description provided for @navMessages.
  ///
  /// In uz, this message translates to:
  /// **'Xabarlar'**
  String get navMessages;

  /// No description provided for @navPostVacancy.
  ///
  /// In uz, this message translates to:
  /// **'Vakansiya joylash'**
  String get navPostVacancy;

  /// No description provided for @navProfile.
  ///
  /// In uz, this message translates to:
  /// **'Profil'**
  String get navProfile;

  /// No description provided for @navSaved.
  ///
  /// In uz, this message translates to:
  /// **'Saqlanganlar'**
  String get navSaved;

  /// No description provided for @navSignIn.
  ///
  /// In uz, this message translates to:
  /// **'Kirish'**
  String get navSignIn;

  /// No description provided for @navSignOut.
  ///
  /// In uz, this message translates to:
  /// **'Chiqish'**
  String get navSignOut;

  /// No description provided for @navSignUp.
  ///
  /// In uz, this message translates to:
  /// **'Ro\'yxatdan o\'tish'**
  String get navSignUp;

  /// No description provided for @navSkipToContent.
  ///
  /// In uz, this message translates to:
  /// **'Asosiy qismga o\'tish'**
  String get navSkipToContent;

  /// No description provided for @navVacancies.
  ///
  /// In uz, this message translates to:
  /// **'Vakansiyalar'**
  String get navVacancies;

  /// No description provided for @settingsByEmail.
  ///
  /// In uz, this message translates to:
  /// **'Email'**
  String get settingsByEmail;

  /// No description provided for @settingsByEmailHint.
  ///
  /// In uz, this message translates to:
  /// **'Arizalar holati, takliflar va yangi vakansiyalar'**
  String get settingsByEmailHint;

  /// No description provided for @settingsByTelegram.
  ///
  /// In uz, this message translates to:
  /// **'Telegram'**
  String get settingsByTelegram;

  /// No description provided for @settingsChangePassword.
  ///
  /// In uz, this message translates to:
  /// **'Parolni o\'zgartirish'**
  String get settingsChangePassword;

  /// No description provided for @settingsChangePhoto.
  ///
  /// In uz, this message translates to:
  /// **'Rasmni almashtirish'**
  String get settingsChangePhoto;

  /// No description provided for @settingsContacts.
  ///
  /// In uz, this message translates to:
  /// **'Aloqa'**
  String get settingsContacts;

  /// No description provided for @settingsContactsHint.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlangan email yoki telefon ariza yuborish uchun kerak.'**
  String get settingsContactsHint;

  /// No description provided for @settingsCurrentPassword.
  ///
  /// In uz, this message translates to:
  /// **'Joriy parol'**
  String get settingsCurrentPassword;

  /// No description provided for @settingsDevCode.
  ///
  /// In uz, this message translates to:
  /// **'Test rejimi: Telegram ulanmagan, kod shu yerda ko\'rsatiladi va avtomatik yozildi:'**
  String get settingsDevCode;

  /// No description provided for @settingsLanguage.
  ///
  /// In uz, this message translates to:
  /// **'Xabarlar tili'**
  String get settingsLanguage;

  /// No description provided for @settingsLanguageHint.
  ///
  /// In uz, this message translates to:
  /// **'Email va Telegram xabarlari shu tilda keladi.'**
  String get settingsLanguageHint;

  /// No description provided for @settingsNotifyHint.
  ///
  /// In uz, this message translates to:
  /// **'Yangi arizalar, taklif va xabarlar qayerga kelsin.'**
  String get settingsNotifyHint;

  /// No description provided for @settingsPassword.
  ///
  /// In uz, this message translates to:
  /// **'Parol'**
  String get settingsPassword;

  /// No description provided for @settingsPasswordChanged.
  ///
  /// In uz, this message translates to:
  /// **'Parol o\'zgartirildi'**
  String get settingsPasswordChanged;

  /// No description provided for @settingsPasswordHint.
  ///
  /// In uz, this message translates to:
  /// **'Parol o\'zgarsa, boshqa qurilmalardagi seanslar yopiladi.'**
  String get settingsPasswordHint;

  /// No description provided for @settingsPasswordNone.
  ///
  /// In uz, this message translates to:
  /// **'Siz Google orqali kirasiz. Email bilan ham kirish uchun parol o\'rnating.'**
  String get settingsPasswordNone;

  /// No description provided for @settingsPhone.
  ///
  /// In uz, this message translates to:
  /// **'Telefon raqami'**
  String get settingsPhone;

  /// No description provided for @settingsPhoneCodeSent.
  ///
  /// In uz, this message translates to:
  /// **'{phone} raqamiga Telegram orqali kod yubordik.'**
  String settingsPhoneCodeSent(String phone);

  /// No description provided for @settingsPhoneHint.
  ///
  /// In uz, this message translates to:
  /// **'Kod SMS emas, Telegram\'dagi «Verification Codes» chatiga keladi.'**
  String get settingsPhoneHint;

  /// No description provided for @settingsPhoneVerified.
  ///
  /// In uz, this message translates to:
  /// **'Telefon raqami tasdiqlandi'**
  String get settingsPhoneVerified;

  /// No description provided for @settingsProfile.
  ///
  /// In uz, this message translates to:
  /// **'Profil'**
  String get settingsProfile;

  /// No description provided for @settingsProfileHint.
  ///
  /// In uz, this message translates to:
  /// **'Ish beruvchilar ismingiz va rasmingizni ko\'radi.'**
  String get settingsProfileHint;

  /// No description provided for @settingsSendTelegramCode.
  ///
  /// In uz, this message translates to:
  /// **'Telegram orqali kod olish'**
  String get settingsSendTelegramCode;

  /// No description provided for @settingsSessions.
  ///
  /// In uz, this message translates to:
  /// **'Qurilmalar'**
  String get settingsSessions;

  /// No description provided for @settingsSessionsHint.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingizga kirilgan qurilmalar. Tanimaganingizni o\'chiring.'**
  String get settingsSessionsHint;

  /// No description provided for @settingsSignOutDevice.
  ///
  /// In uz, this message translates to:
  /// **'Shu qurilmadan chiqish'**
  String get settingsSignOutDevice;

  /// No description provided for @settingsSignOutOthers.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa barcha qurilmalardan chiqish'**
  String get settingsSignOutOthers;

  /// No description provided for @settingsTelegramLink.
  ///
  /// In uz, this message translates to:
  /// **'Telegram\'ni ulash'**
  String get settingsTelegramLink;

  /// No description provided for @settingsTelegramLinked.
  ///
  /// In uz, this message translates to:
  /// **'Telegram ulandi'**
  String get settingsTelegramLinked;

  /// No description provided for @settingsTelegramOff.
  ///
  /// In uz, this message translates to:
  /// **'Avval Telegram\'ni ulang'**
  String get settingsTelegramOff;

  /// No description provided for @settingsTelegramOn.
  ///
  /// In uz, this message translates to:
  /// **'{bot} boti orqali'**
  String settingsTelegramOn(String bot);

  /// No description provided for @settingsTelegramUnlink.
  ///
  /// In uz, this message translates to:
  /// **'Telegram\'ni uzish'**
  String get settingsTelegramUnlink;

  /// No description provided for @settingsTelegramWaiting.
  ///
  /// In uz, this message translates to:
  /// **'Telegram\'da «Start» ni bosing…'**
  String get settingsTelegramWaiting;

  /// No description provided for @settingsThisDevice.
  ///
  /// In uz, this message translates to:
  /// **'Shu qurilma'**
  String get settingsThisDevice;

  /// No description provided for @settingsUploadFailed.
  ///
  /// In uz, this message translates to:
  /// **'Rasmni yuklab bo\'lmadi. Qayta urinib ko\'ring.'**
  String get settingsUploadFailed;

  /// No description provided for @settingsUploadPhoto.
  ///
  /// In uz, this message translates to:
  /// **'Rasm yuklash'**
  String get settingsUploadPhoto;

  /// No description provided for @settingsVerify.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash'**
  String get settingsVerify;

  /// No description provided for @themeDark.
  ///
  /// In uz, this message translates to:
  /// **'Qorong\'i'**
  String get themeDark;

  /// No description provided for @themeLabel.
  ///
  /// In uz, this message translates to:
  /// **'Mavzu'**
  String get themeLabel;

  /// No description provided for @themeLight.
  ///
  /// In uz, this message translates to:
  /// **'Yorug\''**
  String get themeLight;

  /// No description provided for @themeSystem.
  ///
  /// In uz, this message translates to:
  /// **'Avtomatik'**
  String get themeSystem;
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>['en', 'ru', 'uz'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when language+script codes are specified.
  switch (locale.languageCode) {
    case 'uz':
      {
        switch (locale.scriptCode) {
          case 'Cyrl':
            return AppLocalizationsUzCyrl();
        }
        break;
      }
  }

  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'ru':
      return AppLocalizationsRu();
    case 'uz':
      return AppLocalizationsUz();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
