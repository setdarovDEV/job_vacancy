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

  /// No description provided for @applicationContactNotVerified.
  ///
  /// In uz, this message translates to:
  /// **'Aloqani tasdiqlang'**
  String get applicationContactNotVerified;

  /// No description provided for @applicationContactNotVerifiedHint.
  ///
  /// In uz, this message translates to:
  /// **'Ariza yuborish uchun email yoki telefon raqamingizni tasdiqlang'**
  String get applicationContactNotVerifiedHint;

  /// No description provided for @applicationCoverLetter.
  ///
  /// In uz, this message translates to:
  /// **'Shaxsiy xat'**
  String get applicationCoverLetter;

  /// No description provided for @applicationHistory.
  ///
  /// In uz, this message translates to:
  /// **'Holat tarixi'**
  String get applicationHistory;

  /// No description provided for @applicationSelectResume.
  ///
  /// In uz, this message translates to:
  /// **'Rezyumeni tanlang'**
  String get applicationSelectResume;

  /// No description provided for @applicationStatusHired.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qilindi'**
  String get applicationStatusHired;

  /// No description provided for @applicationStatusInterview.
  ///
  /// In uz, this message translates to:
  /// **'Suhbat'**
  String get applicationStatusInterview;

  /// No description provided for @applicationStatusInvited.
  ///
  /// In uz, this message translates to:
  /// **'Taklif'**
  String get applicationStatusInvited;

  /// No description provided for @applicationStatusRejected.
  ///
  /// In uz, this message translates to:
  /// **'Rad etildi'**
  String get applicationStatusRejected;

  /// No description provided for @applicationStatusSent.
  ///
  /// In uz, this message translates to:
  /// **'Yuborildi'**
  String get applicationStatusSent;

  /// No description provided for @applicationStatusViewed.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'rildi'**
  String get applicationStatusViewed;

  /// No description provided for @applicationStatusWithdrawn.
  ///
  /// In uz, this message translates to:
  /// **'Qaytarib olingan'**
  String get applicationStatusWithdrawn;

  /// No description provided for @applicationSubmitted.
  ///
  /// In uz, this message translates to:
  /// **'Ariza yuborildi'**
  String get applicationSubmitted;

  /// No description provided for @applicationWithdrawBody.
  ///
  /// In uz, this message translates to:
  /// **'Bu arizani qaytarib olmoqchimisiz?'**
  String get applicationWithdrawBody;

  /// No description provided for @applicationWithdrawTitle.
  ///
  /// In uz, this message translates to:
  /// **'Arizani qaytarib olish'**
  String get applicationWithdrawTitle;

  /// No description provided for @applicationWithdrawn.
  ///
  /// In uz, this message translates to:
  /// **'Ariza qaytarib olindi'**
  String get applicationWithdrawn;

  /// No description provided for @applicationsEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hali ariza yubormagansiz'**
  String get applicationsEmpty;

  /// No description provided for @chatAttachCamera.
  ///
  /// In uz, this message translates to:
  /// **'Kamera'**
  String get chatAttachCamera;

  /// No description provided for @chatAttachFile.
  ///
  /// In uz, this message translates to:
  /// **'Fayl'**
  String get chatAttachFile;

  /// No description provided for @chatAttachGallery.
  ///
  /// In uz, this message translates to:
  /// **'Galereya'**
  String get chatAttachGallery;

  /// No description provided for @chatAttachLocation.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuv'**
  String get chatAttachLocation;

  /// No description provided for @chatAttachTitle.
  ///
  /// In uz, this message translates to:
  /// **'Qo‘shish'**
  String get chatAttachTitle;

  /// No description provided for @chatEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hali xabar yo‘q'**
  String get chatEmpty;

  /// No description provided for @chatErrorSend.
  ///
  /// In uz, this message translates to:
  /// **'Xabarni yuborib bo‘lmadi. Qayta urinib ko‘ring.'**
  String get chatErrorSend;

  /// No description provided for @chatFile.
  ///
  /// In uz, this message translates to:
  /// **'Fayl'**
  String get chatFile;

  /// No description provided for @chatImage.
  ///
  /// In uz, this message translates to:
  /// **'Rasm'**
  String get chatImage;

  /// No description provided for @chatInputHint.
  ///
  /// In uz, this message translates to:
  /// **'Xabar yozing…'**
  String get chatInputHint;

  /// No description provided for @chatLoadOlder.
  ///
  /// In uz, this message translates to:
  /// **'Avvalgi xabarlarni yuklash'**
  String get chatLoadOlder;

  /// No description provided for @chatLocation.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuv'**
  String get chatLocation;

  /// No description provided for @chatLocationSoon.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuvni ulashish tez kunda ishga tushadi.'**
  String get chatLocationSoon;

  /// No description provided for @chatMessageDeleted.
  ///
  /// In uz, this message translates to:
  /// **'Xabar o‘chirildi'**
  String get chatMessageDeleted;

  /// No description provided for @chatNoOlder.
  ///
  /// In uz, this message translates to:
  /// **'Avvalgi xabarlar yo‘q'**
  String get chatNoOlder;

  /// No description provided for @chatOpenMap.
  ///
  /// In uz, this message translates to:
  /// **'Xaritada ochish'**
  String get chatOpenMap;

  /// No description provided for @chatSend.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get chatSend;

  /// No description provided for @chatTyping.
  ///
  /// In uz, this message translates to:
  /// **'yozmoqda…'**
  String get chatTyping;

  /// No description provided for @chatUnread.
  ///
  /// In uz, this message translates to:
  /// **'O‘qilmagan'**
  String get chatUnread;

  /// No description provided for @chatVoice.
  ///
  /// In uz, this message translates to:
  /// **'Ovozli xabar'**
  String get chatVoice;

  /// No description provided for @chatDeleted.
  ///
  /// In uz, this message translates to:
  /// **'O\'chirilgan'**
  String get chatDeleted;

  /// No description provided for @chatNoMessages.
  ///
  /// In uz, this message translates to:
  /// **'Hali suhbat boshlanmagan'**
  String get chatNoMessages;

  /// No description provided for @chatRecording.
  ///
  /// In uz, this message translates to:
  /// **'Ovoz yozilmoqda...'**
  String get chatRecording;

  /// No description provided for @chatLocationServiceDisabled.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuv xizmati o\'chiq'**
  String get chatLocationServiceDisabled;

  /// No description provided for @chatLocationPermissionDenied.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuv ruxsati berilmagan'**
  String get chatLocationPermissionDenied;

  /// No description provided for @chatMicrophonePermissionDenied.
  ///
  /// In uz, this message translates to:
  /// **'Mikrofon ruxsati berilmagan'**
  String get chatMicrophonePermissionDenied;

  /// No description provided for @applyCoverLetterHint.
  ///
  /// In uz, this message translates to:
  /// **'Nima uchun bu vakansiya sizga mos'**
  String get applyCoverLetterHint;

  /// No description provided for @applyCreateResume.
  ///
  /// In uz, this message translates to:
  /// **'Rezyume yaratish'**
  String get applyCreateResume;

  /// No description provided for @applyNoResumes.
  ///
  /// In uz, this message translates to:
  /// **'Ariza yuborish uchun rezyume kerak'**
  String get applyNoResumes;

  /// No description provided for @applySubmit.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get applySubmit;

  /// No description provided for @applyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ariza yuborish'**
  String get applyTitle;

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

  /// No description provided for @commonAll.
  ///
  /// In uz, this message translates to:
  /// **'Barchasi'**
  String get commonAll;

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

  /// No description provided for @commonDownload.
  ///
  /// In uz, this message translates to:
  /// **'Yuklab olish'**
  String get commonDownload;

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

  /// No description provided for @commonWithdraw.
  ///
  /// In uz, this message translates to:
  /// **'Qaytarib olish'**
  String get commonWithdraw;

  /// No description provided for @companyAbout.
  ///
  /// In uz, this message translates to:
  /// **'Kompaniya haqida'**
  String get companyAbout;

  /// No description provided for @companyFounded.
  ///
  /// In uz, this message translates to:
  /// **'Tashkil etilgan'**
  String get companyFounded;

  /// No description provided for @companySize.
  ///
  /// In uz, this message translates to:
  /// **'Xodimlar soni'**
  String get companySize;

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

  /// No description provided for @filterCategory.
  ///
  /// In uz, this message translates to:
  /// **'Kategoriya'**
  String get filterCategory;

  /// No description provided for @filterDistrict.
  ///
  /// In uz, this message translates to:
  /// **'Tuman'**
  String get filterDistrict;

  /// No description provided for @filterEmploymentType.
  ///
  /// In uz, this message translates to:
  /// **'Bandlik turi'**
  String get filterEmploymentType;

  /// No description provided for @filterExperience.
  ///
  /// In uz, this message translates to:
  /// **'Tajriba'**
  String get filterExperience;

  /// No description provided for @filterRegion.
  ///
  /// In uz, this message translates to:
  /// **'Hudud'**
  String get filterRegion;

  /// No description provided for @filterSalary.
  ///
  /// In uz, this message translates to:
  /// **'Ish haqi'**
  String get filterSalary;

  /// No description provided for @filterSalaryFrom.
  ///
  /// In uz, this message translates to:
  /// **'Dan'**
  String get filterSalaryFrom;

  /// No description provided for @filterSchedule.
  ///
  /// In uz, this message translates to:
  /// **'Ish jadvali'**
  String get filterSchedule;

  /// No description provided for @filterSort.
  ///
  /// In uz, this message translates to:
  /// **'Saralash'**
  String get filterSort;

  /// No description provided for @filterWithSalary.
  ///
  /// In uz, this message translates to:
  /// **'Faqat ish haqi ko\'rsatilgan'**
  String get filterWithSalary;

  /// No description provided for @filterWorkFormat.
  ///
  /// In uz, this message translates to:
  /// **'Ish shakli'**
  String get filterWorkFormat;

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

  /// No description provided for @notificationsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get notificationsTitle;

  /// No description provided for @notificationsEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hali bildirishnoma yo\'q'**
  String get notificationsEmpty;

  /// No description provided for @notificationsMarkAllRead.
  ///
  /// In uz, this message translates to:
  /// **'Hammasini o\'qilgan deb belgilash'**
  String get notificationsMarkAllRead;

  /// No description provided for @notificationApplicationNew.
  ///
  /// In uz, this message translates to:
  /// **'Yangi ariza'**
  String get notificationApplicationNew;

  /// No description provided for @notificationApplicationStatus.
  ///
  /// In uz, this message translates to:
  /// **'Ariza holati o\'zgardi'**
  String get notificationApplicationStatus;

  /// No description provided for @notificationApplicationInvited.
  ///
  /// In uz, this message translates to:
  /// **'Siz taklif qilindingiz'**
  String get notificationApplicationInvited;

  /// No description provided for @notificationVacancyApproved.
  ///
  /// In uz, this message translates to:
  /// **'Vakansiya tasdiqlandi'**
  String get notificationVacancyApproved;

  /// No description provided for @notificationVacancyRejected.
  ///
  /// In uz, this message translates to:
  /// **'Vakansiya rad etildi'**
  String get notificationVacancyRejected;

  /// No description provided for @notificationVacancyTakenDown.
  ///
  /// In uz, this message translates to:
  /// **'Vakansiya olib tashlandi'**
  String get notificationVacancyTakenDown;

  /// No description provided for @notificationSearchAlert.
  ///
  /// In uz, this message translates to:
  /// **'Qidiruvingiz bo\'yicha yangi vakansiyalar'**
  String get notificationSearchAlert;

  /// No description provided for @notificationReportResolved.
  ///
  /// In uz, this message translates to:
  /// **'Shikoyat ko\'rib chiqildi'**
  String get notificationReportResolved;

  /// No description provided for @notificationReportDismissed.
  ///
  /// In uz, this message translates to:
  /// **'Shikoyat rad etildi'**
  String get notificationReportDismissed;

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

  /// No description provided for @reportComment.
  ///
  /// In uz, this message translates to:
  /// **'Izoh'**
  String get reportComment;

  /// No description provided for @reportCommentHint.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa sabab bo\'lsa, iltimos, tavsiflab bering'**
  String get reportCommentHint;

  /// No description provided for @reportReasonFraud.
  ///
  /// In uz, this message translates to:
  /// **'Firibgarlik'**
  String get reportReasonFraud;

  /// No description provided for @reportReasonMisleading.
  ///
  /// In uz, this message translates to:
  /// **'Noto\'g\'ri ma\'lumot'**
  String get reportReasonMisleading;

  /// No description provided for @reportReasonOffensive.
  ///
  /// In uz, this message translates to:
  /// **'Haqoratli yoki noqonuniy'**
  String get reportReasonOffensive;

  /// No description provided for @reportReasonOther.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa'**
  String get reportReasonOther;

  /// No description provided for @reportReasonSpam.
  ///
  /// In uz, this message translates to:
  /// **'Spam'**
  String get reportReasonSpam;

  /// No description provided for @reportSent.
  ///
  /// In uz, this message translates to:
  /// **'Shikoyat yuborildi'**
  String get reportSent;

  /// No description provided for @reportSubmit.
  ///
  /// In uz, this message translates to:
  /// **'Shikoyat qilish'**
  String get reportSubmit;

  /// No description provided for @reportTitle.
  ///
  /// In uz, this message translates to:
  /// **'Shikoyat qilish'**
  String get reportTitle;

  /// No description provided for @resumeAbout.
  ///
  /// In uz, this message translates to:
  /// **'O\'zingiz haqingizda'**
  String get resumeAbout;

  /// No description provided for @resumeAboutHint.
  ///
  /// In uz, this message translates to:
  /// **'Qisqacha tajriba va maqsadlaringiz haqida yozing'**
  String get resumeAboutHint;

  /// No description provided for @resumeAddEducation.
  ///
  /// In uz, this message translates to:
  /// **'Ta\'lim qo\'shish'**
  String get resumeAddEducation;

  /// No description provided for @resumeAddExperience.
  ///
  /// In uz, this message translates to:
  /// **'Ish tajribasi qo\'shish'**
  String get resumeAddExperience;

  /// No description provided for @resumeAddLanguage.
  ///
  /// In uz, this message translates to:
  /// **'Til qo\'shish'**
  String get resumeAddLanguage;

  /// No description provided for @resumeChangeVisibility.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'rinishni o\'zgartirish'**
  String get resumeChangeVisibility;

  /// No description provided for @resumeCreateFirst.
  ///
  /// In uz, this message translates to:
  /// **'Birinchi rezyume yaratish'**
  String get resumeCreateFirst;

  /// No description provided for @resumeCurrency.
  ///
  /// In uz, this message translates to:
  /// **'Valyuta'**
  String get resumeCurrency;

  /// No description provided for @resumeDeleteBody.
  ///
  /// In uz, this message translates to:
  /// **'Bu rezyumeni o\'chirmoqchimisiz?'**
  String get resumeDeleteBody;

  /// No description provided for @resumeDeleteTitle.
  ///
  /// In uz, this message translates to:
  /// **'Rezyumeni o\'chirish'**
  String get resumeDeleteTitle;

  /// No description provided for @resumeEditEducation.
  ///
  /// In uz, this message translates to:
  /// **'Ta\'limni tahrirlash'**
  String get resumeEditEducation;

  /// No description provided for @resumeEditExperience.
  ///
  /// In uz, this message translates to:
  /// **'Tajribani tahrirlash'**
  String get resumeEditExperience;

  /// No description provided for @resumeEditResume.
  ///
  /// In uz, this message translates to:
  /// **'Rezyumeni tahrirlash'**
  String get resumeEditResume;

  /// No description provided for @resumeEducationEndYear.
  ///
  /// In uz, this message translates to:
  /// **'Tugatgan yil'**
  String get resumeEducationEndYear;

  /// No description provided for @resumeEducationField.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'nalish'**
  String get resumeEducationField;

  /// No description provided for @resumeEducationInstitution.
  ///
  /// In uz, this message translates to:
  /// **'O\'quv yurti'**
  String get resumeEducationInstitution;

  /// No description provided for @resumeEducationLevel.
  ///
  /// In uz, this message translates to:
  /// **'Ta\'lim darajasi'**
  String get resumeEducationLevel;

  /// No description provided for @resumeEducationLevelBachelor.
  ///
  /// In uz, this message translates to:
  /// **'Bakalavr'**
  String get resumeEducationLevelBachelor;

  /// No description provided for @resumeEducationLevelIncompleteHigher.
  ///
  /// In uz, this message translates to:
  /// **'Tugallanmagan oliy'**
  String get resumeEducationLevelIncompleteHigher;

  /// No description provided for @resumeEducationLevelMaster.
  ///
  /// In uz, this message translates to:
  /// **'Magistr'**
  String get resumeEducationLevelMaster;

  /// No description provided for @resumeEducationLevelPhd.
  ///
  /// In uz, this message translates to:
  /// **'PhD'**
  String get resumeEducationLevelPhd;

  /// No description provided for @resumeEducationLevelSecondary.
  ///
  /// In uz, this message translates to:
  /// **'O\'rta'**
  String get resumeEducationLevelSecondary;

  /// No description provided for @resumeEducationLevelVocational.
  ///
  /// In uz, this message translates to:
  /// **'O\'rta maxsus'**
  String get resumeEducationLevelVocational;

  /// No description provided for @resumeEducationStartYear.
  ///
  /// In uz, this message translates to:
  /// **'Boshlagan yil'**
  String get resumeEducationStartYear;

  /// No description provided for @resumeEducations.
  ///
  /// In uz, this message translates to:
  /// **'Ta\'lim'**
  String get resumeEducations;

  /// No description provided for @resumeEmploymentTypes.
  ///
  /// In uz, this message translates to:
  /// **'Bandlik turlari'**
  String get resumeEmploymentTypes;

  /// No description provided for @resumeExperienceCompany.
  ///
  /// In uz, this message translates to:
  /// **'Kompaniya'**
  String get resumeExperienceCompany;

  /// No description provided for @resumeExperienceCurrent.
  ///
  /// In uz, this message translates to:
  /// **'Hozirgi ish joyi'**
  String get resumeExperienceCurrent;

  /// No description provided for @resumeExperienceDescription.
  ///
  /// In uz, this message translates to:
  /// **'Vazifalar'**
  String get resumeExperienceDescription;

  /// No description provided for @resumeExperienceEnd.
  ///
  /// In uz, this message translates to:
  /// **'Tugash'**
  String get resumeExperienceEnd;

  /// No description provided for @resumeExperiencePosition.
  ///
  /// In uz, this message translates to:
  /// **'Lavozim'**
  String get resumeExperiencePosition;

  /// No description provided for @resumeExperienceStart.
  ///
  /// In uz, this message translates to:
  /// **'Boshlash'**
  String get resumeExperienceStart;

  /// No description provided for @resumeExperiences.
  ///
  /// In uz, this message translates to:
  /// **'Ish tajribasi'**
  String get resumeExperiences;

  /// No description provided for @resumeLanguageCode.
  ///
  /// In uz, this message translates to:
  /// **'Til kodi'**
  String get resumeLanguageCode;

  /// No description provided for @resumeLanguageLevel.
  ///
  /// In uz, this message translates to:
  /// **'Daraja'**
  String get resumeLanguageLevel;

  /// No description provided for @resumeLanguageLevelA1.
  ///
  /// In uz, this message translates to:
  /// **'A1 — Boshlang\'ich'**
  String get resumeLanguageLevelA1;

  /// No description provided for @resumeLanguageLevelA2.
  ///
  /// In uz, this message translates to:
  /// **'A2 — O\'rta-boshlang\'ich'**
  String get resumeLanguageLevelA2;

  /// No description provided for @resumeLanguageLevelB1.
  ///
  /// In uz, this message translates to:
  /// **'B1 — O\'rta'**
  String get resumeLanguageLevelB1;

  /// No description provided for @resumeLanguageLevelB2.
  ///
  /// In uz, this message translates to:
  /// **'B2 — O\'rtadan yuqori'**
  String get resumeLanguageLevelB2;

  /// No description provided for @resumeLanguageLevelC1.
  ///
  /// In uz, this message translates to:
  /// **'C1 — Yuqori'**
  String get resumeLanguageLevelC1;

  /// No description provided for @resumeLanguageLevelC2.
  ///
  /// In uz, this message translates to:
  /// **'C2 — Ega bo\'luvchi'**
  String get resumeLanguageLevelC2;

  /// No description provided for @resumeLanguageLevelNative.
  ///
  /// In uz, this message translates to:
  /// **'Ona tili'**
  String get resumeLanguageLevelNative;

  /// No description provided for @resumeLanguages.
  ///
  /// In uz, this message translates to:
  /// **'Tillar'**
  String get resumeLanguages;

  /// No description provided for @resumeMaxSkills.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'pi bilan 30 ta ko\'nikma kiritish mumkin'**
  String get resumeMaxSkills;

  /// No description provided for @resumeMyResumes.
  ///
  /// In uz, this message translates to:
  /// **'Rezyumelarim'**
  String get resumeMyResumes;

  /// No description provided for @resumeNewResume.
  ///
  /// In uz, this message translates to:
  /// **'Yangi rezyume'**
  String get resumeNewResume;

  /// No description provided for @resumeNoEducations.
  ///
  /// In uz, this message translates to:
  /// **'Hali ta\'lim qo\'shilmagan'**
  String get resumeNoEducations;

  /// No description provided for @resumeNoExperiences.
  ///
  /// In uz, this message translates to:
  /// **'Hali ish tajribasi qo\'shilmagan'**
  String get resumeNoExperiences;

  /// No description provided for @resumeNoLanguages.
  ///
  /// In uz, this message translates to:
  /// **'Hali til qo\'shilmagan'**
  String get resumeNoLanguages;

  /// No description provided for @resumeNoResumes.
  ///
  /// In uz, this message translates to:
  /// **'Hali rezyume yo\'q'**
  String get resumeNoResumes;

  /// No description provided for @resumeNoResumesHint.
  ///
  /// In uz, this message translates to:
  /// **'Birinchi rezyumeni yarating va vakansiyalarga ariza yuboring'**
  String get resumeNoResumesHint;

  /// No description provided for @resumeRelocate.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'chishga tayyorman'**
  String get resumeRelocate;

  /// No description provided for @resumeSalary.
  ///
  /// In uz, this message translates to:
  /// **'Kutilayotgan ish haqi'**
  String get resumeSalary;

  /// No description provided for @resumeSkills.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'nikmalar'**
  String get resumeSkills;

  /// No description provided for @resumeSkillsHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan, Flutter, ingliz tili'**
  String get resumeSkillsHint;

  /// No description provided for @resumeTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kutilayotgan lavozim'**
  String get resumeTitle;

  /// No description provided for @resumeUpdated.
  ///
  /// In uz, this message translates to:
  /// **'Rezyume saqlandi'**
  String get resumeUpdated;

  /// No description provided for @resumeVisibilityAppliedOnly.
  ///
  /// In uz, this message translates to:
  /// **'Faqat ariza yuborilgan kompaniyalar'**
  String get resumeVisibilityAppliedOnly;

  /// No description provided for @resumeVisibilityHidden.
  ///
  /// In uz, this message translates to:
  /// **'Faqat men uchun'**
  String get resumeVisibilityHidden;

  /// No description provided for @resumeVisibilityHintAppliedOnly.
  ///
  /// In uz, this message translates to:
  /// **'Siz ariza yuborgan kompaniyalar ko\'radi'**
  String get resumeVisibilityHintAppliedOnly;

  /// No description provided for @resumeVisibilityHintHidden.
  ///
  /// In uz, this message translates to:
  /// **'Hech kim qidiruvda ko\'rmaydi'**
  String get resumeVisibilityHintHidden;

  /// No description provided for @resumeVisibilityHintPublic.
  ///
  /// In uz, this message translates to:
  /// **'Ish beruvchilar qidiruvda ko\'radi'**
  String get resumeVisibilityHintPublic;

  /// No description provided for @resumeVisibilityLabel.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'rinish'**
  String get resumeVisibilityLabel;

  /// No description provided for @resumeVisibilityPublic.
  ///
  /// In uz, this message translates to:
  /// **'Ommaviy'**
  String get resumeVisibilityPublic;

  /// No description provided for @resumeWorkFormats.
  ///
  /// In uz, this message translates to:
  /// **'Ish shakllari'**
  String get resumeWorkFormats;

  /// No description provided for @savedGuestBody.
  ///
  /// In uz, this message translates to:
  /// **'Kirish va qiziqarli vakansiyalarni saqlab qo\'ying.'**
  String get savedGuestBody;

  /// No description provided for @savedGuestTitle.
  ///
  /// In uz, this message translates to:
  /// **'Saqlangan vakansiyalar'**
  String get savedGuestTitle;

  /// No description provided for @savedSearchCreated.
  ///
  /// In uz, this message translates to:
  /// **'Qidiruv saqlandi'**
  String get savedSearchCreated;

  /// No description provided for @savedSearchDeleteBody.
  ///
  /// In uz, this message translates to:
  /// **'Bu saqlangan qidiruvni o\'chirmoqchimisiz?'**
  String get savedSearchDeleteBody;

  /// No description provided for @savedSearchDeleteTitle.
  ///
  /// In uz, this message translates to:
  /// **'Qidiruvni o\'chirish'**
  String get savedSearchDeleteTitle;

  /// No description provided for @savedSearchName.
  ///
  /// In uz, this message translates to:
  /// **'Nomi'**
  String get savedSearchName;

  /// No description provided for @savedSearchNameHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan, Dasturchi Toshkent'**
  String get savedSearchNameHint;

  /// No description provided for @savedSearchNotify.
  ///
  /// In uz, this message translates to:
  /// **'Yangi vakansiyalar haqida xabar berilsin'**
  String get savedSearchNotify;

  /// No description provided for @savedSearchTitle.
  ///
  /// In uz, this message translates to:
  /// **'Qidiruvni saqlash'**
  String get savedSearchTitle;

  /// No description provided for @savedSearchesEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hali saqlangan qidiruv yo\'q'**
  String get savedSearchesEmpty;

  /// No description provided for @savedSearchesTitle.
  ///
  /// In uz, this message translates to:
  /// **'Saqlangan qidiruvlar'**
  String get savedSearchesTitle;

  /// No description provided for @savedVacanciesEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hali saqlangan vakansiya yo\'q'**
  String get savedVacanciesEmpty;

  /// No description provided for @savedVacanciesTitle.
  ///
  /// In uz, this message translates to:
  /// **'Saqlangan vakansiyalar'**
  String get savedVacanciesTitle;

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

  /// No description provided for @sortNewest.
  ///
  /// In uz, this message translates to:
  /// **'Eng yangi'**
  String get sortNewest;

  /// No description provided for @sortRelevance.
  ///
  /// In uz, this message translates to:
  /// **'Moslik'**
  String get sortRelevance;

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

  /// No description provided for @vacancyAddress.
  ///
  /// In uz, this message translates to:
  /// **'Manzil'**
  String get vacancyAddress;

  /// No description provided for @vacancyApplications.
  ///
  /// In uz, this message translates to:
  /// **'Arizalar'**
  String get vacancyApplications;

  /// No description provided for @vacancyApplySoon.
  ///
  /// In uz, this message translates to:
  /// **'Ariza yuborish tez kunda ishga tushadi'**
  String get vacancyApplySoon;

  /// No description provided for @vacancyDescription.
  ///
  /// In uz, this message translates to:
  /// **'Vakansiya tavsifi'**
  String get vacancyDescription;

  /// No description provided for @vacancyEmploymentType.
  ///
  /// In uz, this message translates to:
  /// **'Bandlik turi'**
  String get vacancyEmploymentType;

  /// No description provided for @vacancyExp1_3.
  ///
  /// In uz, this message translates to:
  /// **'1-3 yil'**
  String get vacancyExp1_3;

  /// No description provided for @vacancyExp3_6.
  ///
  /// In uz, this message translates to:
  /// **'3-6 yil'**
  String get vacancyExp3_6;

  /// No description provided for @vacancyExp6Plus.
  ///
  /// In uz, this message translates to:
  /// **'6 yildan ortiq'**
  String get vacancyExp6Plus;

  /// No description provided for @vacancyExpNone.
  ///
  /// In uz, this message translates to:
  /// **'Tajribasiz'**
  String get vacancyExpNone;

  /// No description provided for @vacancyExperience.
  ///
  /// In uz, this message translates to:
  /// **'Tajriba'**
  String get vacancyExperience;

  /// No description provided for @vacancyFullTime.
  ///
  /// In uz, this message translates to:
  /// **'To\'liq stavka'**
  String get vacancyFullTime;

  /// No description provided for @vacancyHybrid.
  ///
  /// In uz, this message translates to:
  /// **'Gibrid'**
  String get vacancyHybrid;

  /// No description provided for @vacancyInternship.
  ///
  /// In uz, this message translates to:
  /// **'Amaliyot'**
  String get vacancyInternship;

  /// No description provided for @vacancyNegotiable.
  ///
  /// In uz, this message translates to:
  /// **'Kelishiladi'**
  String get vacancyNegotiable;

  /// No description provided for @vacancyOffice.
  ///
  /// In uz, this message translates to:
  /// **'Ofis'**
  String get vacancyOffice;

  /// No description provided for @vacancyOpenVacancies.
  ///
  /// In uz, this message translates to:
  /// **'Ochiq vakansiyalar'**
  String get vacancyOpenVacancies;

  /// No description provided for @vacancyPartTime.
  ///
  /// In uz, this message translates to:
  /// **'Yarim stavka'**
  String get vacancyPartTime;

  /// No description provided for @vacancyProject.
  ///
  /// In uz, this message translates to:
  /// **'Loyiha'**
  String get vacancyProject;

  /// No description provided for @vacancyRemote.
  ///
  /// In uz, this message translates to:
  /// **'Uydan'**
  String get vacancyRemote;

  /// No description provided for @vacancyReport.
  ///
  /// In uz, this message translates to:
  /// **'Shikoyat qilish'**
  String get vacancyReport;

  /// No description provided for @vacancySalary.
  ///
  /// In uz, this message translates to:
  /// **'Ish haqi'**
  String get vacancySalary;

  /// No description provided for @vacancySchedule.
  ///
  /// In uz, this message translates to:
  /// **'Ish jadvali'**
  String get vacancySchedule;

  /// No description provided for @vacancyScheduleFlexible.
  ///
  /// In uz, this message translates to:
  /// **'Moslashuvchan'**
  String get vacancyScheduleFlexible;

  /// No description provided for @vacancyScheduleFullDay.
  ///
  /// In uz, this message translates to:
  /// **'To\'liq kun'**
  String get vacancyScheduleFullDay;

  /// No description provided for @vacancyScheduleRotation.
  ///
  /// In uz, this message translates to:
  /// **'Shift'**
  String get vacancyScheduleRotation;

  /// No description provided for @vacancyScheduleShift.
  ///
  /// In uz, this message translates to:
  /// **'Smena'**
  String get vacancyScheduleShift;

  /// No description provided for @vacancyShare.
  ///
  /// In uz, this message translates to:
  /// **'Ulashish'**
  String get vacancyShare;

  /// No description provided for @vacancySkills.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'nikmalar'**
  String get vacancySkills;

  /// No description provided for @vacancyViews.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'rishlar'**
  String get vacancyViews;

  /// No description provided for @vacancyVolunteer.
  ///
  /// In uz, this message translates to:
  /// **'Volontyor'**
  String get vacancyVolunteer;

  /// No description provided for @vacancyWorkFormat.
  ///
  /// In uz, this message translates to:
  /// **'Ish shakli'**
  String get vacancyWorkFormat;

  /// No description provided for @cookieBannerTitle.
  ///
  /// In uz, this message translates to:
  /// **'Cookie\'lardan foydalanamiz'**
  String get cookieBannerTitle;

  /// No description provided for @cookieBannerBody.
  ///
  /// In uz, this message translates to:
  /// **'Saytimiz ishlashi, xavfsizligi va qulayligi uchun cookie va shunga o\'xshash texnologiyalardan foydalanamiz.'**
  String get cookieBannerBody;

  /// No description provided for @cookieBannerPolicy.
  ///
  /// In uz, this message translates to:
  /// **'Cookie siyosati'**
  String get cookieBannerPolicy;

  /// No description provided for @cookieBannerAcceptAll.
  ///
  /// In uz, this message translates to:
  /// **'Roziman'**
  String get cookieBannerAcceptAll;

  /// No description provided for @cookieBannerEssentialOnly.
  ///
  /// In uz, this message translates to:
  /// **'Faqat zaruriy'**
  String get cookieBannerEssentialOnly;

  /// No description provided for @profileLegal.
  ///
  /// In uz, this message translates to:
  /// **'Huquqiy ma\'lumot'**
  String get profileLegal;

  /// No description provided for @profilePrivacyPolicy.
  ///
  /// In uz, this message translates to:
  /// **'Maxfiylik siyosati'**
  String get profilePrivacyPolicy;

  /// No description provided for @profileTermsOfUse.
  ///
  /// In uz, this message translates to:
  /// **'Foydalanish shartlari'**
  String get profileTermsOfUse;

  /// No description provided for @profileCookiePolicy.
  ///
  /// In uz, this message translates to:
  /// **'Cookie siyosati'**
  String get profileCookiePolicy;

  /// No description provided for @profilePublicOffer.
  ///
  /// In uz, this message translates to:
  /// **'Ommaviy oferta'**
  String get profilePublicOffer;

  /// No description provided for @profileContentRules.
  ///
  /// In uz, this message translates to:
  /// **'Kontent qoidalari'**
  String get profileContentRules;
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
