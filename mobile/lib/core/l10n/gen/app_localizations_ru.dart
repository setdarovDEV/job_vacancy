// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Russian (`ru`).
class AppLocalizationsRu extends AppLocalizations {
  AppLocalizationsRu([String locale = 'ru']) : super(locale);

  @override
  String get accountCandidates => 'Поиск кандидатов';

  @override
  String get accountDashboard => 'Кабинет';

  @override
  String get accountMenu => 'Меню аккаунта';

  @override
  String get accountMyResumes => 'Мои резюме';

  @override
  String get accountMyVacancies => 'Мои вакансии';

  @override
  String get accountNotifications => 'Уведомления';

  @override
  String get accountSearches => 'Сохранённые поиски';

  @override
  String get accountSettings => 'Настройки';

  @override
  String get appCheckFields => 'Проверьте отмеченные поля.';

  @override
  String get appComingSoonBody => 'Этот раздел появится в следующем обновлении.';

  @override
  String get appComingSoonTitle => 'Скоро';

  @override
  String get appEmployerBody =>
      'Первая версия приложения — для соискателей. Чтобы размещать вакансии и смотреть отклики, используйте сайт jobvacancy.uz.';

  @override
  String get appEmployerTitle => 'Инструменты работодателя — на сайте';

  @override
  String get appGetStarted => 'Начать';

  @override
  String get appPhoneTitle => 'Подтверждение телефона';

  @override
  String get appSignOutAll => 'Выйти на всех устройствах';

  @override
  String get appSkip => 'Пропустить';

  @override
  String get appUnverified => 'Не подтверждён';

  @override
  String get appWelcomeBody => 'От Ташкента до Нукуса, от кассира до программиста. Вакансии обновляются каждый день.';

  @override
  String get appWelcomeTitle => 'Работа и сотрудники в одном месте';

  @override
  String get authAgree => 'Создавая аккаунт, вы соглашаетесь с условиями использования и политикой конфиденциальности.';

  @override
  String get authCode => 'Код подтверждения';

  @override
  String get authCodeSent => 'Новый код отправлен';

  @override
  String get authForgot => 'Забыли пароль?';

  @override
  String get authForgotBody => 'Введите email — пришлём код для сброса.';

  @override
  String get authForgotTitle => 'Восстановление пароля';

  @override
  String get authFullName => 'Имя и фамилия';

  @override
  String get authGoogle => 'Продолжить с Google';

  @override
  String get authHaveAccount => 'Уже есть аккаунт?';

  @override
  String get authLater => 'Позже';

  @override
  String get authLoginSubtitle => 'Здесь ваши отклики, сообщения и сохранённые вакансии.';

  @override
  String get authLoginTitle => 'Вход';

  @override
  String get authNewPassword => 'Новый пароль';

  @override
  String get authNoAccount => 'Нет аккаунта?';

  @override
  String get authOr => 'или';

  @override
  String get authPasswordHint => 'Минимум 8 символов, с буквой и цифрой';

  @override
  String get authRegisterSubtitle => 'Создать аккаунт — минута.';

  @override
  String get authRegisterTitle => 'Регистрация';

  @override
  String get authResend => 'Отправить код ещё раз';

  @override
  String authResendIn(String s) {
    return 'Повторно через $s с';
  }

  @override
  String authResetBody(String email) {
    return 'Введите код из письма на $email и новый пароль.';
  }

  @override
  String get authResetDone => 'Пароль обновлён. Войдите с новым паролем.';

  @override
  String get authResetSubmit => 'Сохранить пароль';

  @override
  String get authResetTitle => 'Новый пароль';

  @override
  String get authRoleEmployer => 'Ищу сотрудников';

  @override
  String get authRoleEmployerHint => 'Размещайте вакансии и находите кандидатов';

  @override
  String get authRoleQuestion => 'Для чего вам аккаунт?';

  @override
  String get authRoleSeeker => 'Ищу работу';

  @override
  String get authRoleSeekerHint => 'Создайте резюме и откликайтесь';

  @override
  String get authSendCode => 'Отправить код';

  @override
  String get authSignedOut => 'Вы вышли из аккаунта';

  @override
  String get authSubmitLogin => 'Войти';

  @override
  String get authSubmitRegister => 'Создать аккаунт';

  @override
  String get authVerified => 'Email подтверждён';

  @override
  String authVerifyBody(String email) {
    return 'Мы отправили 6-значный код на $email. Код действует 15 минут.';
  }

  @override
  String get authVerifySubmit => 'Подтвердить';

  @override
  String get authVerifyTitle => 'Подтвердите email';

  @override
  String authWelcome(String name) {
    return 'Добро пожаловать, $name!';
  }

  @override
  String get brandName => 'Job Vacancy';

  @override
  String get brandTagline => 'Работа и сотрудники в Узбекистане';

  @override
  String get commonApply => 'Откликнуться';

  @override
  String get commonBack => 'Назад';

  @override
  String get commonCancel => 'Отмена';

  @override
  String get commonClear => 'Сбросить';

  @override
  String get commonClose => 'Закрыть';

  @override
  String get commonDelete => 'Удалить';

  @override
  String get commonDone => 'Готово';

  @override
  String get commonEdit => 'Изменить';

  @override
  String get commonFeatured => 'TOP';

  @override
  String get commonFilters => 'Фильтры';

  @override
  String get commonLoading => 'Загрузка';

  @override
  String get commonMore => 'Ещё';

  @override
  String get commonNoResults => 'Ничего не найдено';

  @override
  String get commonOpen => 'Открыть';

  @override
  String get commonOptional => 'необязательно';

  @override
  String get commonRetry => 'Повторить';

  @override
  String get commonSave => 'Сохранить';

  @override
  String get commonSaved => 'Сохранено';

  @override
  String get commonSearch => 'Поиск';

  @override
  String get commonShowAll => 'Показать все';

  @override
  String get commonSoon => 'Скоро';

  @override
  String get commonVerified => 'Проверена';

  @override
  String get errorsInternalError => 'На сервере произошла ошибка. Попробуйте чуть позже.';

  @override
  String get errorsNetwork => 'Нет связи с сервером. Проверьте интернет и попробуйте снова.';

  @override
  String get errorsNotFound => 'Страница не найдена';

  @override
  String get errorsNotFoundBody => 'Ссылка устарела или в адресе ошибка.';

  @override
  String errorsRateLimited(String seconds) {
    return 'Слишком много запросов. Попробуйте через $seconds с.';
  }

  @override
  String get errorsToHome => 'На главную';

  @override
  String get errorsUnauthorized => 'Войдите, чтобы продолжить.';

  @override
  String get formEmail => 'Email';

  @override
  String get formHidePassword => 'Скрыть пароль';

  @override
  String get formPassword => 'Пароль';

  @override
  String get formShowPassword => 'Показать пароль';

  @override
  String get languageLabel => 'Язык';

  @override
  String get navApplications => 'Мои отклики';

  @override
  String get navCandidates => 'Кандидаты';

  @override
  String get navCompanies => 'Компании';

  @override
  String get navForEmployers => 'Работодателям';

  @override
  String get navMenu => 'Меню';

  @override
  String get navMessages => 'Сообщения';

  @override
  String get navPostVacancy => 'Разместить вакансию';

  @override
  String get navProfile => 'Профиль';

  @override
  String get navSaved => 'Избранное';

  @override
  String get navSignIn => 'Войти';

  @override
  String get navSignOut => 'Выйти';

  @override
  String get navSignUp => 'Регистрация';

  @override
  String get navSkipToContent => 'Перейти к содержимому';

  @override
  String get navVacancies => 'Вакансии';

  @override
  String get settingsByEmail => 'Email';

  @override
  String get settingsByEmailHint => 'Статусы откликов, приглашения и новые вакансии';

  @override
  String get settingsByTelegram => 'Telegram';

  @override
  String get settingsChangePassword => 'Сменить пароль';

  @override
  String get settingsChangePhoto => 'Сменить фото';

  @override
  String get settingsContacts => 'Контакты';

  @override
  String get settingsContactsHint => 'Чтобы откликаться, нужен подтверждённый email или телефон.';

  @override
  String get settingsCurrentPassword => 'Текущий пароль';

  @override
  String get settingsDevCode => 'Тестовый режим: Telegram не подключён, код показан здесь и подставлен автоматически:';

  @override
  String get settingsLanguage => 'Язык уведомлений';

  @override
  String get settingsLanguageHint => 'На этом языке будут приходить письма и сообщения в Telegram.';

  @override
  String get settingsNotifyHint => 'Куда присылать новые отклики, приглашения и сообщения.';

  @override
  String get settingsPassword => 'Пароль';

  @override
  String get settingsPasswordChanged => 'Пароль изменён';

  @override
  String get settingsPasswordHint => 'После смены пароля сеансы на других устройствах завершатся.';

  @override
  String get settingsPasswordNone => 'Вы входите через Google. Задайте пароль, чтобы входить и по email.';

  @override
  String get settingsPhone => 'Номер телефона';

  @override
  String settingsPhoneCodeSent(String phone) {
    return 'Отправили код на $phone через Telegram.';
  }

  @override
  String get settingsPhoneHint => 'Код придёт не по SMS, а в чат «Verification Codes» в Telegram.';

  @override
  String get settingsPhoneVerified => 'Номер телефона подтверждён';

  @override
  String get settingsProfile => 'Профиль';

  @override
  String get settingsProfileHint => 'Работодатели видят ваше имя и фото.';

  @override
  String get settingsSendTelegramCode => 'Получить код в Telegram';

  @override
  String get settingsSessions => 'Устройства';

  @override
  String get settingsSessionsHint => 'Устройства, с которых входили в аккаунт. Удалите незнакомые.';

  @override
  String get settingsSignOutDevice => 'Выйти на этом устройстве';

  @override
  String get settingsSignOutOthers => 'Выйти на всех других устройствах';

  @override
  String get settingsTelegramLink => 'Подключить Telegram';

  @override
  String get settingsTelegramLinked => 'Telegram подключён';

  @override
  String get settingsTelegramOff => 'Сначала подключите Telegram';

  @override
  String settingsTelegramOn(String bot) {
    return 'через бота $bot';
  }

  @override
  String get settingsTelegramUnlink => 'Отключить Telegram';

  @override
  String get settingsTelegramWaiting => 'Нажмите «Start» в Telegram…';

  @override
  String get settingsThisDevice => 'Это устройство';

  @override
  String get settingsUploadFailed => 'Не удалось загрузить фото. Попробуйте ещё раз.';

  @override
  String get settingsUploadPhoto => 'Загрузить фото';

  @override
  String get settingsVerify => 'Подтвердить';

  @override
  String get themeDark => 'Тёмная';

  @override
  String get themeLabel => 'Тема';

  @override
  String get themeLight => 'Светлая';

  @override
  String get themeSystem => 'Авто';
}
