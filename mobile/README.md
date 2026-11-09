# Job Vacancy · mobil ilova (Flutter)

Ish izlovchilar uchun Android va iOS ilova. Birinchi versiya faqat ish izlovchilar uchun:
ish beruvchi kirsa, sayt vositalariga yo'naltiriladi.

| | |
|---|---|
| Flutter | 3.35 (Dart 3.9), `/opt/flutter` |
| Ilova ID | `uz.jobvacancy.app` |
| Holat | Riverpod 3 · go_router 17 · dio 5 · freezed |
| Tillar | uz (asosiy), uz-Cyrl, ru, en — matnlar web ilovadan olinadi |

## Ishga tushirish

Backend ishlab turgan bo'lishi kerak (`make up`, `make api`, ildiz README'ga qarang).

```bash
cd mobile
flutter pub get
flutter run                                   # Android emulator: API = http://10.0.2.2:8090/api/v1
flutter run --dart-define=API_BASE_URL=https://jobvacancy.uz/api/v1
```

API manzili `--dart-define=API_BASE_URL=...` bilan beriladi. Berilmasa:
- Android emulator: `http://10.0.2.2:8090/api/v1` (emulator uchun host kompyuter);
- iOS simulator: `http://localhost:8090/api/v1`.

Debug build'larda shu dev manzillarga HTTP ruxsat etilgan
(`android/app/src/debug/res/xml/network_security_config.xml`, iOS `NSAllowsLocalNetworking`).
Release build faqat HTTPS bilan ishlaydi.

Emulatorni ekransiz ishga tushirish:

```bash
~/Android/Sdk/emulator/emulator -avd Pixel_10_Pro -no-window -no-audio -no-snapshot-save &
adb wait-for-device
```

## Tuzilma

```
lib/
  app/          JobVacancyApp, router (feature route'larini yig'adi; core va features'ni biladigan yagona joy)
  core/         features/ yoki app/ ni hech qachon import qilmaydi (tool/check_imports.py tekshiradi)
    api/        ApiClient (envelope → model / ApiException, Page<T>, upload), http.dart, apiClientProvider
    auth/       AccessTokenSource, TokenRefresher (yagona refresh), AuthInterceptor, SessionApi,
                SessionController (+ sessionProvider), SessionStore
    config/     AppConfig (dart-define)
    l10n/       ARB fayllar, generatsiya qilingan kod, ErrorTexts (API xato kodlari)
    models/     User (UserRole), AuthResult, Tokens (freezed)
    router/     Routes, appRedirect (sof funksiya: kirgandan keyin qayerga borishni u hal qiladi)
    theme/      AppColors (web token'lari), AppTheme (Unbounded + Onest)
    widgets/    Logo, Backdrop/GlassBar, forma elementlari, SubmitState, showApiError
  features/
    auth/       ekranlar, auth_routes.dart, data/ (AccountApi + AccountController: tasdiqlash, parol)
    home/       pastki navigatsiya, home_routes.dart, "Tez kunda" bo'limlari (9B–9D)
    profile/    profil, til, mavzu, chiqish
```

Provider'lar o'zi yaratadigan narsa yonida e'lon qilinadi; fayllar orasida import sikli yo'q.

**Sessiya.** Mobil klientlar `X-Client-Type: android|ios` yuboradi. API refresh token'ni cookie
o'rniga javob tanasida qaytaradi. Token'lar va oxirgi ma'lum foydalanuvchi `flutter_secure_storage`
da saqlanadi (Keychain / Android Keystore).
- Refresh token har ishlatilganda aylanadi, shuning uchun HTTP klient ham, keyinchalik WebSocket
  ham bitta `TokenRefresher` (`AccessTokenSource`) orqali token oladi: bir vaqtdagi 401'lar bitta
  refresh'ni kutadi.
- `refresh_race`: yangi token saqlangan bo'lsa o'shani oladi, aks holda bir marta qayta urinadi.
- Rad etilgan refresh (401/403) faqat do'konda hali o'sha token turgan bo'lsa sessiyani yopadi.
- Javob yo'qolsa, API 30 soniya ichida eski token bilan yangi juft beradi (mobil uchun).
- Muddat `access_token_expires_in` va qurilmaning o'z soati bilan hisoblanadi.
- Internet bo'lmasa sessiya yopilmaydi.

**Dizayn.** Ranglar, radiuslar va shriftlar web dizayn tizimidan (`docs/DESIGN.md`). Kartochkalar
shaffof emas (60 fps uchun), blur faqat ustida kontent aylanadigan panellarda (pastki navigatsiya).
Shriftlar (OFL) `assets/fonts/` da.

## Tarjimalar

Matnlar web ilovaning xabar fayllaridan generatsiya qilinadi, shunda ikkala ilova bir xil
gapiradi. Faqat ilovaga kerak matnlar `tool/gen_l10n_from_web.py` ichidagi `MOBILE` da.

```bash
node --experimental-strip-types tool/dump_web_messages.mjs /tmp/msgs
python3 -I tool/gen_l10n_from_web.py /tmp/msgs
flutter gen-l10n
```

## Kod generatsiyasi

```bash
dart run build_runner build --delete-conflicting-outputs   # freezed / json_serializable
```

Generatsiya qilingan fayllar (`*.freezed.dart`, `*.g.dart`, `lib/core/l10n/gen/`) repoda saqlanadi.

## Tekshiruvlar

```bash
flutter analyze
python3 -I tool/check_imports.py   # core → features importi va sikllar yo'qligi
flutter test                       # unit + widget testlar (soxta API bilan)
SHOTS=/tmp/mobile-shots flutter drive \
  --driver=test_driver/integration_test.dart \
  --target=integration_test/sign_up_test.dart -d emulator-5554
```

Integratsion test haqiqiy dev API'da ishlaydi: yangi ish izlovchini ro'yxatdan o'tkazadi,
email kodini Mailpit'dan (`http://10.0.2.2:8025`) oladi, ilovaga kiradi, mavzuni almashtiradi va
chiqadi. Skrinshotlar `$SHOTS` ga saqlanadi. Rate-limit'ga duch kelsangiz:
`docker exec jobvacancy-dev-redis-1 sh -c "redis-cli --scan --pattern 'rl:*' | xargs -r redis-cli del"`.

## Build

```bash
flutter build apk --release        # yoki --split-per-abi (har biri ~20 MB)
flutter build ipa                  # faqat macOS'da
```

Release imzo kaliti hali sozlanmagan (Flutter shabloni debug kalitni ishlatadi).
