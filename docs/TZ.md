# Texnik topshiriq (TZ): jobvacancy.uz — Premium dizayn (Liquid Glass) va MVP production

| | |
|---|---|
| Versiya | 1.0 · 2026-09-24 |
| Loyiha | Job Vacancy · jobvacancy.uz (ish izlovchi ↔ ish beruvchi platformasi) |
| Stek | Web: React 19 + React Router 8 (SSR) + Vite 8 + Tailwind v4 · Backend: Go 1.27, chi, pgx + sqlc, PostgreSQL 18, Redis, River, MinIO |
| Ijrochi | Claude Code + `jobvacancy` plagini (skill'lar: `premium-ui`, `fast-backend`, `redesign`, `ui-audit`, `tz-task`; agent: `ui-reviewer`) |
| Maqsad | 1) Butun UI'ni premium "Samarkand Glass" (Liquid Glass) dizayniga o'tkazish; 2) backendni maksimal tezlashtirish; 3) loyihani MVP holatida production'ga chiqarish |

> **Qanday ishlatiladi.** Bu fayl `docs/TZ.md` ga qo'yiladi. Har bir vazifaning ID'si bor
> (`UI-01`, `BE-04`…). Claude Code'da: `/jobvacancy:tz-task UI-01`. Vazifa faqat barcha ✅
> qabul mezonlari isbotlanganda (buyruq natijasi, test, o'lchov, skrinshot) yopiladi.
> Holat belgilari: `[ ]` navbatda · `[~]` jarayonda · `[x]` tayyor.
> Ustuvorlik: **P0** — ishga tushirishni to'xtatadi · **P1** — MVP uchun kerak · **P2** — MVP'dan keyin.

---

## 1. Hozirgi holat (2026-09-24 auditi xulosasi)

Loyiha "bazaviy" emas: arxitektura puxta, asosiy funksiyalar tayyor. Muammolar dizayn sifati,
bir nechta tezlik "tor joylari" va production infratuzilmasining yo'qligida.

**Tayyor:** auth (email/parol, Google, refresh rotation, sessiyalar, email/telefon tasdiqlash),
kataloglar, kompaniyalar va jamoa, vakansiya hayot sikli (draft → moderatsiya → e'lon → arxiv),
qidiruv (translit + FTS + trigram fallback, Redis kesh), rezyume konstruktori + PDF, arizalar +
kanban, chat (WebSocket, fayl/ovoz/lokatsiya), bildirishnomalar (ilova, email, Telegram),
saqlangan qidiruvlar + ogohlantirishlar, 4 til, SSR, JSON-LD, sitemap.

**Asosiy kamchiliklar:**

| Soha | Topilgan holat |
|---|---|
| Dizayn | Bosh sahifa faqat hero'dan iborat. Panel stili 41 joyda qo'lda takrorlangan. 4 xil qidiruv paneli, 3 xil pul maydoni, 13 xil "orqaga" havolasi bor. Statik skaner **133 ta token buzilishini** topdi: harf oralig'i 41, shrift o'lchami 31, radius 28, soya 18, oq/qora 11, blur 4. Bundan tashqari 15 ta ko'rinmas focus. |
| Holatlar | Ko'p shaxsiy sahifada xatolik holati yo'q: skeleton cheksiz aylanadi yoki xato "bo'sh" deb ko'rsatiladi (`resumes`, `searches`, `settings`, `dashboard`, `applications`, `saved`, `notifications`, kanban). |
| A11y | Hero qidiruvi va Tabs'da focus ko'rinmaydi. Dark rejimda danger tugma kontrasti 2.74:1. Kanban'da drag faqat sichqoncha bilan ishlaydi (touch yo'q), "Ko'chirish" menyusida `aria-live` yo'q. Chatda o'chirish faqat hover bilan chiqadi. |
| Mobil | `safe-area` ishlatilmagan. Toast'lar Apply panelini yopib qo'yadi. Nomzodlar filtrida mobil sheet yo'q. |
| Front tezlik | Har bir filtr bosilganda root loader katalog va tarjimalarni qayta yuklaydi. SSR HTML'da `Cache-Control` yo'q. Shriftlar preload qilinmagan. |
| Backend tezlik | Chat ro'yxatida N+1, cheksiz kesh map. Kompaniyalar katalogi OFFSET va har qator uchun COUNT ishlatadi. Vakansiya sahifasida kesh ham, ETag ham yo'q. Siqish (gzip/brotli) yo'q, `statement_timeout` yo'q. 10 ta indeks yetishmaydi (ilova A.1). |
| Xavfsizlik | nginx ortida `HTTP_TRUST_PROXY=false`, shuning uchun hamma bitta IP bo'lib qoladi va limitlar buziladi. Prod'da default sirlar qabul qilinadi. Xavfsizlik header'lari yo'q. WS sessiya bekor qilinganda ham yopilmaydi. Istalgan foydalanuvchi boshqalarning onlayn holatini ko'ra oladi. |
| Infra | `nginx/` da faqat dev compose bor. Prod compose, SSL, backup, monitoring va CI/CD deploy yo'q. |
| Funksiya | Admin panel UI yo'q. Bloklash, shikoyatlar va akkauntni o'chirish yo'q. Kompaniyaga a'zo qo'shish uchun uning roziligi so'ralmaydi. ~200 tuman import qilinmagan. |

---

## 2. MVP doirasi

### 2.1 MVP'ga kiradi
- Ish izlovchi: ro'yxatdan o'tish/kirish, rezyume (konstruktor, PDF, ko'rinish), vakansiya qidirish
  va filtrlash, saqlash, ariza, arizalar holati, chat, bildirishnomalar (ilova + email + Telegram),
  saqlangan qidiruv ogohlantirishlari, sozlamalar, akkauntni o'chirish.
- Ish beruvchi: kompaniya profili (logo, muqova), jamoa (taklifni qabul qilish bilan), vakansiya
  yaratish/tahrirlash/moderatsiyaga yuborish/arxivlash/qayta e'lon qilish, arizalar kanbani,
  nomzodlar qidiruvi va taklif, chat, dashboard (KPI).
- Admin: moderatsiya navbati, kompaniyani tasdiqlash, shikoyatlar, foydalanuvchi va kompaniyani
  bloklash, ko'nikmalarni moderatsiya qilish, "TOP" belgilash, oddiy statistika.
- Premium Liquid Glass UI: 4 til, yorug' va qorong'i mavzu, 360px'dan boshlab.
- Production infra: nginx + SSL, prod compose, backup + PITR, monitoring + alertlar, CI/CD, staging.

### 2.2 MVP'ga kirmaydi (P2, keyingi bosqich)
AI funksiyalari (PLAN §4), to'lovlar (Payme/Click, UI'da "Tez kunda" qoladi), Flutter mobil ilova,
FCM push, kompaniya sharhlari, kategoriya×shahar landing sahifalari (SEO-02), Redis Cluster.

### 2.3 Rollar va asosiy foydalanuvchi yo'llari (UAT shu bo'yicha tekshiriladi)
1. **Ish izlovchi:** bosh sahifa → qidiruv → filtrlar → vakansiya → ro'yxatdan o'tish (Google) →
   rezyume yaratish → ariza → chat → holat o'zgargani haqida bildirishnoma.
2. **Ish beruvchi:** ro'yxatdan o'tish → kompaniya → logo → vakansiya → moderatsiya → e'lon →
   ariza keladi → kanbanda bosqich o'zgartiriladi → chat → taklif.
3. **Admin:** moderatsiya navbati → tasdiqlash yoki rad etish (sabab bilan) → shikoyatni ko'rib
   chiqish → bloklash.

---

## 3. Nofunksional talablar (maqsad ko'rsatkichlar)

| Ko'rsatkich | Maqsad | Qanday o'lchanadi |
|---|---|---|
| API o'qish p95 (server ichida) | < 50 ms; keshdan < 10 ms | Prometheus `http_request_duration_seconds`, k6 |
| API yozish p95 | < 150 ms (PDF, yuklash bundan mustasno) | k6 |
| Yuklama | 300 RPS aralash trafik: p95 < 100 ms, xato < 0.1%, CPU < 70% | k6 `k6/mvp.js` (QA-03) |
| WebSocket | Har bir API instance'da 5 000 ulanish, xabar yetkazish p95 < 150 ms | k6 ws scenariy |
| Web LCP (p75, 4G) | ≤ 2.0 s | `test/prod-check.mjs` + RUM |
| INP / CLS | ≤ 200 ms / ≤ 0.05 | RUM (web-vitals) |
| SSR TTFB (anonim, keshlangan) | ≤ 300 ms p75 | nginx log `$upstream_response_time` |
| JS byudjet | Yadro ≤ 120 KB gzip (CI), bosh sahifa JS+CSS ≤ 150 KB | CI |
| Mavjudlik | 99.5% oylik | Uptime monitoring (tashqi) |
| RPO / RTO | ≤ 5 daqiqa / ≤ 1 soat | WAL arxiv + tiklash mashqi |
| A11y | WCAG 2.2 AA (kontrast, klaviatura, focus) | axe (QA-02) + qo'lda |
| Qurilma | 360px dan, Android Chrome 2 yil oldingi versiyagacha, iOS Safari 16+ | Playwright + real qurilma |

---

## 4. Dizayn: "Samarkand Glass" (Premium + Liquid Glass)

**G'oya.** Samarqand koshinlaridan olingan identitet saqlanadi: lojuvard brend rangi, firuza
ijobiy signallar uchun, za'faron TOP va "Tez kunda" uchun, anor faqat xatolar uchun, belgi esa
girih yulduzi. Bunga **Liquid Glass** materiali qo'shiladi: suzuvchi va "chrome" qatlamlar
(header, pastki tab bar, dialoglar, popover'lar, hero qidiruvi) shaffof shishadan bo'ladi.
Ularda blur, to'yinganlik, yorug'lik tushadigan 1px "linza qirrasi" va yuqori qismida yaltirash
bor. Orqa fonda brend ranglaridan yumshoq "aurora" nuri turadi. **Kontent** (vakansiyalar,
formalar, rezyume, matn) esa har doim qattiq, o'qilishi yuqori sirtlarda qoladi. Aynan shu
muvozanat dizaynni premium qiladi.

To'liq spetsifikatsiya plagin ichida: `skills/premium-ui/` (`app.css` token fayli,
`liquid-glass.md`, `components.md`, `pages.md`, `motion-and-states.md`, `polish-checklist.md`).
Jonli namuna: `samarkand-glass-preview.html` (yorug'/qorong'i va to'liq/lite/o'chiq shisha
rejimlarini almashtirish mumkin).

**Asosiy qarorlar:**

| Qism | Qaror |
|---|---|
| Ranglar | Har bir token bitta joyda: `light-dark(yorug', qorong'i)`. Eski brauzerlar uchun `@supports` fallback bor. Dark palitra ikki marta takrorlanmaydi. |
| Kontrast (hisoblangan) | ink ≥ 15:1, ink-2 ≥ 7.4:1, ink-3 ≥ 5.3:1 (ikkala mavzuda). Input chegarasi ≥ 3:1. `on-anor` va `on-lapis` ≥ 5.6:1. |
| Shisha darajalari | `glass-bar`/`glass-chrome` (0.74–0.78, matn faqat ink/ink-2), `glass-panel` (0.80, ink-3 ≥ 14px), `glass-sheet` (0.88, barcha matn darajalari) |
| Tezlik darajalari | `html[data-glass=full|lite|off]`. Kuchsiz qurilma, Save-Data yoki `prefers-reduced-transparency` bo'lsa avtomatik `lite` yoki `off` bo'ladi. Sozlamalarda qo'lda tanlash ham mumkin. |
| Tipografiya | Unbounded sarlavhalar va katta raqamlar uchun, Onest matn uchun. Shkala major third bo'yicha, ikkita UI qadami qo'shilgan (`md` 15px, `lead` 17px). Tasodifiy o'lchamlar taqiqlanadi. |
| Radius | control 14 → panel 22 → sheet 28 → pill |
| Soya | `shadow-1..4`, ink rangiga bo'yalgan. Oq-qora soya ishlatilmaydi. |
| Harakat | `--ease-spring` (`linear()` prujina), 120/200/320/520 ms. Faqat transform va opacity animatsiya qilinadi. View Transitions ishlatiladi. |

### 4.1 Vazifalar: dizayn tizimi (UI)

#### [ ] UI-01 · Token qatlamiga o'tish (Samarkand Glass) · P0
- `web/app/styles/app.css` → plagindagi `references/app.css` asosida yangilanadi. Eski token
  nomlari saqlanadi, shuning uchun komponentlar buzilmaydi.
- `root.tsx`:
  - `<head>` ga yangi inline glass boot skripti qo'yiladi (`liquid-glass.md`). Hozir theme uchun
    inline skript yo'q: mavzu serverda `jv_theme` cookie'sidan chiziladi, `data-theme` qiymati
    `light`, `dark` yoki yo'q (tizim). Skript `jv_glass` cookie'sini hurmat qiladi va `<html>`
    ga `suppressHydrationWarning` qo'shiladi.
  - `theme-color` meta tanlangan mavzuga qarab chiqadi.
  - `<link rel="preload">` Onest va Unbounded'ning lotin woff2 subset'lari uchun qo'shiladi.
  - Metrikasi mos fallback shrift (`size-adjust`) qo'shiladi.
- `jv_glass` cookie loader'da `jv_theme` kabi o'qiladi.
- ✅ `pnpm typecheck && pnpm build` o'tadi, CI byudjetlari saqlanadi.
- ✅ Barcha mavjud sahifalar yorug' va qorong'i rejimda buzilmaydi: `test/shots-c/d/e.mjs`
  skrinshotlari "oldin/keyin" solishtiriladi.
- ✅ `check-ui.mjs --scan web/app/styles` 0 buzilish ko'rsatadi (fallback kalitlari mos).
- ✅ `data-glass=off/lite/full` va `prefers-reduced-transparency` ishlashi skrinshot bilan isbotlanadi.
- ✅ `web/test/prod-check.mjs` chegaralari TZ §3 ga moslanadi: LCP 2.5 s → 2.0 s, CLS 0.1 → 0.05.

#### [ ] UI-02 · Umumiy primitivlar · P0
`Card` (+header/body/footer, interactive, glass), `StatCard`, `Callout`, `ErrorState`, `ConfirmDialog`,
`BackLink`, `Breadcrumbs` (+JSON-LD), `SelectableCard`, `Timeline`, `SegmentedControl`, `FilterChip`,
`Kbd`, `AvatarGroup`. Button'ga `glass` varianti va `shape="pill"` qo'shiladi, `danger` esa `text-on-anor`
ga o'tkaziladi. Badge `rounded-pill` bo'ladi. Hammasi `components.md` bo'yicha.
- ✅ Takrorlar olib tashlanadi: `rounded-panel border border-line bg-surface` qo'lda 0 marta
  qoladi (grep), 4 ta confirm dialog nusxasi va 13 ta back link nusxasi yo'qoladi.
- ✅ Har biri `/ui` sahifasida barcha variant va holatlari bilan, yorug' va qorong'i rejimda ko'rsatiladi.

#### [ ] UI-03 · Forma primitivlari va validatsiya UX · P0
`field-shell` hamma input'da ishlatiladi (13 ta qo'lda yozilgan focus nusxasi o'chiriladi).
Yangi komponentlar: `MoneyInput` (3 nusxa o'rniga), `SalaryRange` (dan ≤ gacha), `PhoneInput`
(+998 maskasi, E.164 formatida saqlanadi), belgilar hisoblagichli `Textarea`, `FileDropzone`
(drag & drop, preview, progress), `Stepper`.
- 422 xatodan keyin birinchi xato maydonga focus va scroll bo'ladi.
- Blur paytida inline validatsiya ishlaydi.
- Uzun tahrirlagichlarda `useBlocker` ogohlantiradi.
- ✅ Vakansiya formasida maosh "dan > gacha" bo'lsa, yuborishdan oldin xato ko'rsatiladi.
- ✅ Hamma uzun maydonlarda hisoblagich bor.
- ✅ Klaviatura bilan butun forma to'ldiriladi (Playwright).

#### [ ] UI-04 · Overlay'lar Liquid Glass'ga · P0
Dialog, Sheet (mobil: tutqich, pastga surib yopish, sticky footer `pb-safe`), Popover, Menu,
Select paneli, Toast (amal tugmasi, info ikonasi, mobilda tab bar ustida), Tooltip (bitta
provider) — hammasi `glass-sheet` bo'ladi. Bare Select'ga focus stili qo'shiladi. Popover
tizimi bittaga birlashtiriladi.
- ✅ Esc yopadi, focus trigger'ga qaytadi, fon scroll qilinmaydi (Playwright).
- ✅ Bir vaqtda ≤ 4 ta blur qatlami ko'rinadi.

#### [ ] UI-05 · Shell: header, mobil tab bar, navigatsiya progressi, footer · P0
- Header `glass-bar`: navigatsiya "pill"lari, CTA "Vakansiya joylash", ⌘K qidiruv tugmasi.
- `MobileTabBar` (< md): rolga qarab elementlar, badge'lar, `pb-safe`.
- `NavigationProgress` `useNavigation` asosida ishlaydi.
- Footer qayta quriladi: kategoriya va shahar havolalari (SEO), Telegram bot, ijtimoiy tarmoqlar, tillar.
- `private.tsx` dagi SSR spinneri layout shaklidagi skeleton'ga almashtiriladi.
- ✅ 360px'da gorizontal scroll yo'q.
- ✅ Tab bar kontentni yopmaydi.
- ✅ Private sahifa yuklanganda CLS < 0.05.

#### [ ] UI-06 · To'rt holat hamma joyda · P0
Har bir ro'yxat va widget'da loading (kontent shaklidagi skeleton), empty, error (retry bilan)
va success holatlari bo'ladi. Majburiy fayllar: `account/resumes`, `searches`, `settings`
(bildirishnomalar, sessiyalar), `employer/company` (a'zolar), `dashboard`, `applications`, `saved`,
`notifications`, kanban ustunlari, `companies`, `company`.
- ✅ API'ni o'chirib test qilinganda hech bir sahifada cheksiz skeleton qolmaydi, xato "bo'sh"
  deb ko'rsatilmaydi (Playwright route abort).

#### [ ] UI-07 · Harakat va o'tishlar · P1
- Ro'yxatdan batafsil sahifaga View Transition (sarlavha va logo).
- Birinchi chizishda ro'yxat `anim-enter` bilan paydo bo'ladi.
- "Imzo" o'zaro ta'sirlar `motion-and-states.md` bo'yicha qilinadi.
- ✅ `prefers-reduced-motion` yoqilganda animatsiya yo'q.
- ✅ INP ≤ 200 ms.

#### [ ] UI-08 · Kirish imkoniyati va kontrast · P0
- Tuzatiladi:
  - hero va Tabs focus'i;
  - VacancyRow focus halqasi;
  - chatdagi faqat hover bilan chiqadigan amallar (long-press va kontekst menyu qo'shiladi);
  - kanban: pointer events bilan drag (touch va long-press ham ishlaydi); mavjud "Ko'chirish…"
    menyusiga `aria-live` e'lonlari qo'shiladi;
  - mobil ustun tanlagich `tablist`/`tabpanel` va strelka tugmalari bilan;
  - `span`'dagi aria-label'lar.
- ✅ axe: yorug' va qorong'i rejimda 0 ta serious/critical (QA-02).
- ✅ Kanban faqat klaviatura bilan boshqariladi (Playwright).

#### [ ] UI-09 · `/ui` ko'rgazmasi va vizual regressiya · P1
- `/ui` barcha komponentlar va token swatch'larini ko'rsatadi (hozir yetishmayotgan
  `*-ink`, `line-strong`, `*-soft` ham).
- Playwright skrinshotlari (390 va 1360 px, yorug' va qorong'i) `test/visual/` ga tushadi,
  CI'da pikseldagi farq tekshiriladi.

#### [ ] UI-10 · Eski stillarni tozalash · P1
- ✅ `check-ui.mjs --scan web/app` → **0 buzilish** (hozir 133). `jv-ui-ignore` faqat izoh bilan
  asoslangan istisnolarda ishlatiladi.
- ✅ `docs/DESIGN.md` yangi tizimga moslab qayta yoziladi.

### 4.2 Vazifalar: sahifalar (PG)
Har bir sahifa `/jobvacancy:redesign <sahifa>` bilan `pages.md` retsepti bo'yicha qilinadi va
`ui-reviewer` agenti tekshiradi. Umumiy ✅ har bir PG uchun:
- `polish-checklist.md` to'liq bajarilgan;
- 360/390/768/1280/1440 px, yorug' va qorong'i rejim skrinshotlari bor;
- 4 tilda ishlaydi;
- `prod-check.mjs` o'tadi.

| ID | Sahifa | Asosiy talablar | P |
|---|---|---|---|
| PG-01 | Bosh sahifa `/` | Hero'da aurora, girih, shisha qidiruv (suggest bilan) va statistika. Kategoriyalar to'ri, yangi/TOP vakansiyalar, top kompaniyalar, "ikki yo'l" (izlovchi/ish beruvchi), shaharlar, Telegram bot CTA. WebSite SearchAction JSON-LD. | P0 |
| PG-02 | Vakansiyalar `/vacancies` | Qo'llangan filtrlar chip qatori va "Tozalash". Mobilda sticky glass filtr paneli va sheet ("N ta natija" tugmasi). Filtr o'zgarganda eski natija xiralashtirilib ko'rsatiladi. Suggest, fuzzy Callout, EmptyState tavsiyalar bilan. | P0 |
| PG-03 | Vakansiya `/vacancies/:slug` | Breadcrumbs, maosh bloki, faktlar to'ri, muddati tugash sanasi. Mobilda sticky glass Apply paneli. Ulashish, o'xshash vakansiyalar, "Shikoyat qilish". RichText uchun prose stili. Muvaffaqiyat animatsiyasi. | P0 |
| PG-04 | Auth | Desktopda split layout (aurora va ishonch bloki), shisha karta, Google birinchi turadi, parol kuchi ko'rsatkichi, katta CodeInput. | P0 |
| PG-05 | Kompaniyalar va kompaniya | Raqamli pagination, filtrlar. Muqova yoki aurora fallback. Tabs: Vakansiyalar va Haqida. Organization JSON-LD. | P1 |
| PG-06 | Ish beruvchilarga | Hero'da haqiqiy UI skrinshoti, afzalliklar, 3 qadam, tariflar ("Tez kunda"), FAQ Accordion, CTA. | P1 |
| PG-07 | Izlovchi kabineti | Sidebar'da profil to'liqligi ko'rsatkichi. Sozlamalar bo'limlari: ko'rinish (mavzu, til, shisha), xavfsizlik, akkauntni o'chirish. Arizalar, saqlanganlar (undo), qidiruvlar, bildirishnomalar (kunlar bo'yicha guruhlangan). | P0 |
| PG-08 | Rezyume tahrirlagich | Stepper, jonli preview, avtosaqlash va "Saqlandi" belgisi, `useBlocker`, sticky glass saqlash paneli. | P0 |
| PG-09 | Ish beruvchi dashboard va kompaniya | KPI StatCard'lar, "E'tibor talab qiladi" ro'yxati, vakansiyalar DataTable'i, onboarding checklist. Kompaniya: FileDropzone (logo, muqova), jonli preview, jamoa. | P0 |
| PG-10 | Vakansiya tahrirlagich | Stepper, SalaryRange, tavsif uchun hisoblagich va markdown toolbar, ommaviy sahifa bilan bir xil preview. | P0 |
| PG-11 | Kanban va ariza | Touch drag (long-press), klaviatura yo'li, `aria-live`. Mobilda SegmentedControl va swipe. Ariza sahifasi: ResumeView va aside (bosqich, izoh avtosaqlash bilan, tarix). | P0 |
| PG-12 | Nomzodlar | Mobil filtr sheet (hozir yo'q), DataTable (mobilda kartalarga aylanadi), Invite. | P1 |
| PG-13 | Chat | Mobilda sayt header'i yo'q, thread header `glass-bar`, composer `glass-chrome pb-safe`. Bubble'lar tokenlarda. Emoji o'rniga lucide ikonalar. Long-press amallar. | P0 |
| PG-14 | Statik, 404, ommaviy rezyume | `container-prose`, huquqiy sahifalar uchun TOC. 404'da qidiruv. Error boundary'da request id ko'rsatiladi. | P1 |
| PG-15 | Admin panel UI | FN-01 bo'yicha: zich, klaviaturaga qulay DataTable'lar. | P0 |

---

## 5. Frontend tezligi (FE)

#### [ ] FE-01 · Root `shouldRevalidate` · P0
Katalog va tarjimalar faqat til o'zgarganda yoki mutatsiyadan keyin qayta yuklanadi, search
params o'zgarganda yuklanmaydi.
- ✅ `/vacancies` da filtr bosilganda tarmoqda root loader so'rovi yo'q (Playwright network log).

#### [ ] FE-02 · SSR HTML kesh header'lari · P1
Anonim ommaviy sahifalarda `headers()` → `Cache-Control: public, s-maxage=30,
stale-while-revalidate=120`. SSR HTML hozir `jv_theme` (mavzu) va `jv_auth=1` (sessiya
belgisi) cookie'lariga bog'liq (`root.tsx`). Shuning uchun:
- nginx kesh kaliti `$cookie_jv_theme$cookie_jv_glass` ni o'z ichiga oladi;
- `jv_auth=1` bo'lsa kesh chetlab o'tiladi (OPS-02).
- **Muhim:** vakansiya ko'rishlari hozir `GET /vacancies/{id}` ichida hisoblanadi: login
  qilganlar user id bo'yicha, anonimlar IP bo'yicha (`vacancy/service.go`). SSR loader bu so'rovni
  serverdan yuboradi, `TRUST_PROXY=false` bo'lgani uchun esa hamma anonim ko'rishlar web serverning
  bitta IP'siga yig'iladi. Kesh qo'shilsa, ular butunlay yo'qoladi. Shuning uchun hisoblash hydration'dan
  keyin brauzerdan yuboriladigan `POST /vacancies/{id}/view` beacon'iga ko'chiriladi (botlar
  tabiiy ravishda filtrlanadi), GET esa hech narsa yozmaydi (BE-05 bilan birga).
- ✅ Keshlangan bosh sahifa TTFB ≤ 50 ms (nginx).
- ✅ Keshlangan vakansiya sahifasi ochilganda ham ko'rishlar soni oshadi (e2e).
- ✅ Qorong'i mavzudagi foydalanuvchiga hech qachon yorug' keshlangan HTML berilmaydi.

#### [ ] FE-03 · Shriftlar · P1
Lotin subset'lari preload qilinadi. `font-display: swap` va fallback `size-adjust` qo'shiladi.
Unbounded faqat 500–600 og'irlikda qoladi (static subset yoki `wght` diapazoni cheklanadi).
- ✅ Shrift almashishidan CLS 0.

#### [ ] FE-04 · Rasmlar · P1
BE-14 o'lchamlaridan `srcset`/`sizes` quriladi. Hamma `<img>` da `width`/`height` bo'ladi.
Fold'dan pastdagi rasmlar `loading="lazy"`. Muqova uchun LQIP (blur placeholder) ishlatiladi.
- ✅ Kompaniya sahifasida LCP rasmi ≤ 60 KB.

#### [ ] FE-05 · Prefetch va o'tishlar · P1
Ro'yxatdan batafsil sahifaga havolalar `prefetch="intent"` bilan. Chat va kabinet kodi
hover/pointerdown paytida oldindan yuklanadi.

#### [ ] FE-06 · Real foydalanuvchi metrikalari (RUM) · P1
`web-vitals` (~2 KB) → `navigator.sendBeacon('/api/v1/rum')` → Prometheus gistogrammalari
(BE tomoni 1 ta endpoint). Grafana'da LCP, INP va CLS p75 marshrutlar bo'yicha ko'rinadi.

---

## 6. Backend tezligi (BE)

Umumiy qoida: har bir BE vazifasi "oldin/keyin" o'lchov bilan yopiladi (p95, SQL so'rovlar
soni, `EXPLAIN (ANALYZE, BUFFERS)`). Test ma'lumoti: `seed_demo.sh` va `ctl` orqali
100k vakansiya, 50k rezyume, 200k ariza, 1M xabar generatsiyasi (QA-03).

#### [ ] BE-01 · Muddatlar (deadline) va kontekst · P0
- API va worker pullari uchun `RuntimeParams` → `statement_timeout=5s`,
  `idle_in_transaction_session_timeout=10s`, `lock_timeout=3s`. **`migrate` va `ctl` bu cheklovlarsiz
  ishlaydi** (ular ham `postgres.NewPool` dan foydalanadi, shuning uchun parametr pool config
  orqali beriladi). Aks holda `CREATE INDEX CONCURRENTLY` va backfill'lar uzilib qoladi.
- So'rov timeout middleware'i: standart 8s. `/ws`, PDF va fayl yuklash uchun istisno.
- `vacancy/handler.go` list: singleflight loader birinchi so'rov kontekstini emas, alohida
  kontekst (`context.WithoutCancel` + 3s timeout) ishlatadi.
- ✅ Test: birinchi klient uzilsa ham kutayotgan boshqa so'rovlar muvaffaqiyatli javob oladi.
- ✅ `pg_sleep(10)` bilan qilingan so'rov 5s'da uziladi.

#### [ ] BE-02 · Yetishmayotgan indekslar · P0
Yangi migratsiya `-- +goose NO TRANSACTION` bilan va `CREATE INDEX CONCURRENTLY` orqali
yoziladi (ilova A.1).
- ✅ Har bir tegishli so'rovning `EXPLAIN`'ida Seq Scan yoki Sort yo'q.
- ✅ CI'da up/down/up o'tadi.

#### [ ] BE-03 · Kompaniyalar katalogi: hisoblagich + keyset · P0
`companies.open_vacancies int` ustuni qo'shiladi va vakansiya statusi o'zgarganda tranzaksiya
ichida yangilanadi (servisda yoki trigger bilan). Indeks:
`((verified_at IS NOT NULL) DESC, open_vacancies DESC, name, id) WHERE status = 'active'`. Cursor pagination ishlatiladi, UI'da raqamli sahifalar uchun `total` alohida
keshlanadi.
- ✅ 10k kompaniyada p95 < 15 ms.
- ✅ OFFSET kodda qolmaydi (grep).

#### [ ] BE-04 · Chat ro'yxati: N+1 va cheksiz kesh · P0
- `participants()` sahifadagi barcha suhbatlar uchun bitta so'rov bilan olinadi.
- Kesh `expirable.LRU` (10k element, 30s TTL) bo'ladi.
- `ListConversations` `UNION ALL` bilan qayta yoziladi: seeker tarmog'i + company tarmog'i,
  har biri o'z indeksi va LIMIT bilan.
- O'qilmagan xabarlar soni denormalizatsiya qilinadi: `conversation_reads.unread_count`
  yoki Redis hash; xabar yuborilganda +1, o'qilganda 0.
- ✅ 1 sahifa (30 suhbat) uchun ≤ 4 ta SQL so'rov (testda sanaladi).
- ✅ `unread-count` p95 < 5 ms.

#### [ ] BE-05 · Javob keshi: baytlar, ETag, SWR · P0
Vakansiyalar ro'yxati, vakansiya batafsil sahifasi, kompaniya, suggest va popular uchun:
- tayyor JSON baytlari keshlanadi (ixtiyoriy ravishda gzip qilingan holda), struct emas;
- `ETag` (hash) qo'yiladi, `If-None-Match` kelsa 304 qaytadi;
- TTL ±20% jitter bilan;
- stale-while-revalidate: eskirgan javob beriladi, orqada yangilanadi;
- Redis lock orqali bir nechta instance'da faqat bitta instance yangilaydi;
- yozish (publish, update, archive, expire, verify, block) invalidatsiya qiladi.

Vakansiya detail: keshlangan DTO. Ko'rishlar hisobi GET'dan ajratilib, `POST
/vacancies/{id}/view` beacon'iga o'tkaziladi (FE-02, Lua dedupe saqlanadi). Anonimlar uchun
`Cache-Control: public, max-age=60`. Login qilgan foydalanuvchiga xos maydonlar (hozir yo'q,
kerak bo'lsa `is_saved`, `has_applied`) keshlangan javobga qo'shilmaydi, alohida kichik
endpoint'dan olinadi.
- ✅ Keshdan detail va list p95 < 5 ms.
- ✅ Takroriy so'rovda 304 qaytadi.
- ✅ Tahrirlangan vakansiya muallifga darhol ko'rinadi (`jv_auth=1` bo'lsa nginx keshi chetlab
  o'tiladi, API keshi invalidatsiya qilinadi), anonimlarga esa ≤ 60 s ichida.

#### [ ] BE-06 · Siqish · P0
nginx'da brotli va gzip (OPS-02). Go tomonda `middleware.Compress(5)` faqat nginx'siz
(dev/staging) holat uchun. Oldindan siqilgan kesh baytlari `Content-Encoding` bilan beriladi.
- ✅ `/api/v1/vacancies` javobi ≥ 70% kichrayadi.

#### [ ] BE-07 · Ulanish pullari va metrikalar · P0
- API va worker uchun alohida env: `DB_MAX_CONNS` (API 20, worker 35).
- River `MaxWorkers`: critical 10, default 20. Worker puli = worker'lar soni + ~5 (River'ning
  o'zi ham ulanish ishlatadi: job olish, LISTEN, leader election).
- `pgxpool.Stat()` → Prometheus (acquired, idle, wait count/duration).
- Redis pool metrikalari qo'shiladi.
- Postgres `max_connections=200`: instance'lar × pul hajmi hisoblanib tekshiriladi.
- ✅ 300 RPS yuklamada pool uchun kutish p95 < 1 ms.

#### [ ] BE-08 · Bildirishnomalar: tranzaksion va aqlli fan-out · P1
- `InsertManyTx` biznes tranzaksiyasi ichida chaqiriladi.
- Faqat foydalanuvchida mavjud kanallar uchun job yaratiladi (Telegram ulangan, qurilma bor,
  email yoqilgan).
- Redis publish pipeline qilinadi.
- `notifyOffline` bitta `Presence(ids)` chaqiruvi bilan ishlaydi.
- ✅ Crash testida (commit'dan keyin process o'ldirilganda) bildirishnoma yo'qolmaydi.
- ✅ Kanali yo'q foydalanuvchi uchun job yaratilmaydi.

#### [ ] BE-09 · Redis'ga murojaatlar sonini kamaytirish · P1
IP limiti, user limiti va revocation EXISTS bitta Lua skriptida birlashtiriladi (1 ta murojaat).
Presence pipeline qilinadi.
- ✅ Autentifikatsiyali so'rovda Redis'ga ≤ 1 ta murojaat qilinadi (middleware'dan oldin).

#### [ ] BE-10 · Hisoblagichlar va `updated_at` · P1
- `set_updated_at` trigger'i `WHEN` sharti bilan cheklanadi: faqat hisoblagich bo'lmagan
  ustunlar o'zgarganda ishlaydi. Alternativa: `vacancy_stats` yon jadvali.
- `vacancies` uchun `fillfactor=90` (HOT update uchun).
- Ko'rishlarni hisoblashda bot filtri (`isbot` ro'yxati Go'da) qo'llanadi.
- ✅ Ko'rishlar flush qilinganda `updated_at` o'zgarmaydi.

#### [ ] BE-11 · Qidiruv optimizatsiyasi va xato tuzatish · P0
- **Bug:** saqlangan qidiruv ogohlantirishlarida fuzzy fallback o'chiriladi (hozir foydalanuvchiga
  noto'g'ri mos kelgan vakansiyalar haqida xabar boradi), `count` ham hisoblanmaydi.
  Bir xil `params` guruhlanib bitta so'rov bilan tekshiriladi.
- Umumiy son (`total`) alohida kalit bilan uzoqroq TTL (120s) da keshlanadi.
- `vacancy_search` jadvaliga asl sarlavha ustuni qo'shiladi: suggest join'siz ishlaydi,
  namunalar 500 ta bilan cheklanadi.
- Popular qidiruvlar natija bergan so'rovlarni allaqachon yozadi (`vacancy/handler.go`). Bunga
  qo'shimcha ravishda faqat 3+ turli IP'dan kelgan va stop-so'z filtridan o'tgan so'rovlar
  ko'rsatiladi (SEC-07).
- ✅ Suggest (keshsiz) p95 < 15 ms.
- ✅ Ogohlantirishlarda fuzzy natija yo'q (unit test).

#### [ ] BE-12 · Yozish yo'llarini batch qilish · P1
- Ariza berish: ketma-ket 12–15 ta murojaat → ≤ 5 ta (bitta tranzaksiya, CTE yoki batch).
- Rezyume bo'limlari `unnest` orqali yoziladi.
- `ChangePassword` barcha sessiyalarni bitta `UPDATE` bilan bekor qiladi.
- Argon2 uchun semaphore (CPU soni × 2).
- ✅ Ariza berish p95 < 80 ms.

#### [ ] BE-13 · PDF · P1
Shriftlar bir marta parse qilinadi (`sync.Once`). PDF MinIO'da `resume_id + updated_at + lang`
kaliti bilan keshlanadi. Foydalanuvchiga daqiqasiga 10 ta limit qo'yiladi.
- ✅ Takroriy PDF so'rovi < 30 ms (keshdan).

#### [ ] BE-14 · Rasmlarni qayta ishlash · P1
Avatar, logo va muqova worker'da WebP formatiga o'giriladi: 64/128/256 px (muqova 1280/640).
EXIF olib tashlanadi. Eski fayllar o'chiriladi. DTO'da `*_urls` o'lchamlari qaytadi (FE-04 shunga tayanadi).
- ✅ Yangi avatar yuklanganidan 5s ichida o'lchamlari tayyor bo'ladi.
- ✅ GPS EXIF qolmaydi.

#### [ ] BE-15 · WebSocket barqarorligi · P1
- Hub fan-out'da global mutex o'rniga shard'langan lock ishlatiladi.
- Shutdown'da ulanishlar close kodi bilan yopiladi (klient qayta ulanadi).
- Sessiya revoke qilinganda WS yopiladi: ticket'ga `sid` bog'lanadi, `rt:revoke` kanali tinglanadi.
- ✅ Rolling deploy paytida xabarlar yo'qolmaydi: klient qayta ulanadi va o'tkazib yuborilgan
  xabarlarni oladi (e2e `chat.sh`).

---

## 7. Funksional to'ldirishlar MVP uchun (FN)

#### [ ] FN-01 · Admin panel (API + UI) · P0
- Endpoint'lar:
  - foydalanuvchilarni qidirish va bloklash (sessiyalar revoke qilinadi, vakansiyalar
    unpublish qilinadi);
  - kompaniyani bloklash;
  - ko'nikmalar moderatsiyasi (`is_verified`, birlashtirish);
  - `is_featured` belgilash (muddati bilan);
  - shikoyatlar navbati;
  - statistika: kunlik ro'yxatdan o'tish, vakansiya, ariza.
- UI: `/admin` (PG-15).
- Har bir admin amali `admin_audit_log` jadvaliga yoziladi.
- ✅ Admin bo'lmagan foydalanuvchi uchun 403 (integratsion test).
- ✅ Bloklangan kompaniya vakansiyalari qidiruvdan 1 daqiqa ichida yo'qoladi.

#### [ ] FN-02 · Vakansiyaga shikoyat · P0
`reports` jadvali (obyekt, sabab enum, izoh, holat). Rate limit: kuniga 10 ta. Bitta vakansiyaga
N ta shikoyat tushsa, u avtomatik moderatsiyaga qaytadi.
- ✅ Admin shikoyatni ko'rib, "hal qilindi" deb yopadi.

#### [ ] FN-03 · Akkauntni o'chirish · P0
Parol yoki qayta autentifikatsiya bilan tasdiqlanadi. `status=deleted` qo'yiladi, shaxsiy
ma'lumotlar anonimlashtiriladi (ism, email, telefon, fayllar), rezyume o'chiriladi, sessiyalar
revoke qilinadi. Arizalar ish beruvchida "O'chirilgan foydalanuvchi" bo'lib qoladi. Kompaniya
egasi avval egalikni boshqa a'zoga o'tkazishi kerak.
- ✅ E2E: o'chirilgandan keyin login ishlamaydi, email qayta ro'yxatdan o'tish uchun bo'shaydi.

#### [ ] FN-04 · Vakansiya muddati · P1
Muddat tugashiga 3 kun qolganda va tugaganda ish beruvchiga bildirishnoma yuboriladi.
"Qayta e'lon qilish" (moderatsiyasiz, agar vakansiya o'zgarmagan bo'lsa) qo'shiladi.

#### [ ] FN-05 · Jamoaga taklif rozilik bilan · P0
Kompaniyaga a'zo qo'shish endi taklif sifatida ishlaydi: `company_invites` jadvali, email va
ilova ichidagi bildirishnoma, qabul qilish yoki rad etish, muddat 7 kun. Hozirgi to'g'ridan-to'g'ri
qo'shish olib tashlanadi.
- ✅ Taklif qilingan odam qabul qilmaguncha kompaniya ma'lumotlarini ko'ra olmaydi.

#### [ ] FN-06 · Tumanlar (SOATO) · P1
~200 tuman rasmiy klassifikatordan 4 tilda import qilinadi (`ctl import-districts`, idempotent).
- ✅ Filtrda viloyat tanlanganda tumanlar chiqadi.

#### [ ] FN-07 · Analitika · P1
O'z serverida Umami (cookie'siz) ishlaydi. Voqealar: qidiruv, vakansiya ochish, ariza boshlash
va yuborish, ro'yxatdan o'tish, vakansiya e'lon qilish. Voronka dashboard'i tuziladi.

#### [ ] FN-08 · Huquqiy talablar · P0
- Ro'yxatdan o'tishda shaxsiy ma'lumotlarni qayta ishlashga rozilik belgisi qo'yiladi
  (versiyasi va vaqti saqlanadi).
- Maxfiylik siyosati va shartlar sahifalari yangilanadi.
- Cookie xabari chiqariladi.
- **Yurist bilan tekshiriladi:**
  - "Shaxsga doir ma'lumotlar to'g'risida"gi qonun (ZRU-547). 2026 yil mart oyida
    ma'lumotlarni mahalliylashtirish talablari yumshatilgan, lekin aniq shartlar
    (chet elda saqlash, transchegaraviy uzatish, operator reyestri) ishga tushirishdan oldin
    tasdiqlanishi kerak.
  - Server joylashuvi shunga qarab tanlanadi (OPS-01).

---

## 8. Xavfsizlik (SEC)

| ID | Talab | ✅ Qabul | P |
|---|---|---|---|
| SEC-01 | Prod konfiguratsiya validatsiyasi (`AUTH_COOKIE_SECURE` va JWT uzunligi allaqachon tekshiriladi). `APP_ENV=production` bo'lsa qo'shimcha rad etiladi: default `TELEGRAM_WEBHOOK_SECRET`, S3 kalitlari `jobvacancy`, `SMTP_TLS=none`, `HTTP_TRUST_PROXY=false` (nginx ortida). Prod'da `godotenv` o'chiriladi. JWT uchun `kid` va 2 ta kalitli rotatsiya. | Noto'g'ri konfiguratsiya bilan API start olmaydi (unit test) | P0 |
| SEC-02 | Haqiqiy IP: nginx `real_ip` Cloudflare'ning rasmiy IP diapazonlari bilan. nginx klient yuborgan `X-Real-IP` ni `$remote_addr` bilan **qayta yozadi**, `X-Forwarded-For` ga ishonilmaydi. API'da `TRUST_PROXY=true` va faqat nginx subnet'iga ishoniladi (aks holda klient o'z IP'sini soxtalashtirib limitlardan qochadi) | Rate limit har bir klient uchun alohida ishlaydi (test) | P0 |
| SEC-03 | Xavfsizlik header'lari (nginx + SSR): HSTS (preload), CSP (nonce bilan, Google GIS va media domeni ruxsat etilgan), `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`, `Permissions-Policy` | securityheaders.com'da A+ | P0 |
| SEC-04 | Rate limitlar CGNAT'ga mos: `/auth/refresh` alohida va yumshoq limit (IP'ga 120/daq). Login uchun qat'iy lock o'rniga progressiv kechikish va 5 urinishdan keyin captcha (Cloudflare Turnstile). Email bo'yicha lock boshqa odamni bloklab qo'ya olmaydi. | Bitta IP ortidagi 50 foydalanuvchi normal ishlaydi (k6) | P0 |
| SEC-05 | WS: sessiya revoke qilinganda ulanish yopiladi (BE-15). Presence faqat umumiy suhbati bor foydalanuvchilarga ko'rinadi. Sozlamalarda "onlayn holatni yashirish" qo'shiladi. | Begona user presence so'rovi 403 qaytaradi | P0 |
| SEC-06 | Fayllar: rasmlar qayta kodlanadi (BE-14), EXIF tozalanadi, eski avatar va logolar o'chiriladi. ClamAV skaneri worker'da (P1). | Test fayllar | P1 |
| SEC-07 | Ommaviy "mashhur qidiruvlar" spamdan himoyalanadi (BE-11). Moderatsiya: admin so'zni yashira oladi. | Spam so'rovlar ro'yxatga tushmaydi | P1 |
| SEC-08 | CI: `govulncheck`, `pnpm audit --prod`, `gitleaks`, Dependabot. Docker image'lari digest bilan pin qilinadi. | CI qizil bo'lsa merge qilinmaydi | P0 |
| SEC-09 | Maxfiy ma'lumotlar log'ga tushmaydi (token, kod, parol, to'liq telefon va email maskalanadi). IP log'lari 30 kun saqlanadi. | Log namunasi tekshiriladi | P1 |

---

## 9. Infratuzilma va deploy (OPS)

**Maqsadli topologiya (MVP):**
```
Cloudflare (DNS, WAF, DDoS; statik kesh) ─► app-1 VPS (4 vCPU / 8 GB):
   nginx (TLS 1.3, HTTP/2+3, brotli, micro-cache, real_ip, rate limit)
     ├─ /            → web ×2 (react-router-serve, Node 22)
     ├─ /api/, /ws   → api ×2 (Go)
     └─ /media/      → MinIO public bucket
   worker ×1 (River) · redis-cache (allkeys-lru) · redis-state (noeviction, AOF) · MinIO
db-1 VPS (4 vCPU / 8 GB, NVMe): PostgreSQL 18 + WAL archiving (wal-g → offsite S3)
monitoring: Prometheus + Grafana + Alertmanager (→ Telegram) + Loki (ixtiyoriy) + GlitchTip
```

| ID | Talab | ✅ Qabul | P |
|---|---|---|---|
| OPS-01 | `nginx/docker-compose.prod.yml`: yuqoridagi servislar, healthcheck'lar, resurs limitlari, `restart: unless-stopped`, faqat nginx tashqariga ochiq. Ikki xil Redis (kesh va holat). `.env.production.example`. Server joylashuvi FN-08 xulosasi bo'yicha tanlanadi. | Toza serverda `make deploy` bilan ko'tariladi | P0 |
| OPS-02 | `nginx/nginx.conf` (ilova A.2): SSL (Let's Encrypt, avtomatik yangilash), HTTP→HTTPS, brotli va gzip, `/assets` 1 yil immutable, SSR micro-cache (anonim, 30s, `proxy_cache_use_stale updating`), WS upgrade (`proxy_read_timeout 1h`), `/media` nosniff, `client_max_body_size`, limit zonalari, `real_ip` | SSL Labs A+, WS ishlaydi, kesh HIT header'i ko'rinadi | P0 |
| OPS-03 | Postgres: SSD uchun tuning (`random_page_cost=1.1`, `shared_buffers=2GB`, `effective_cache_size=6GB`, `work_mem=16MB`, `max_connections=200`), `pg_stat_statements`, `auto_explain` (>200ms). **Backup:** wal-g bilan to'liq kunlik va uzluksiz WAL, offsite S3, 14 kun saqlanadi. **Oyiga bir marta tiklash mashqi.** | Staging'ga PITR tiklash ≤ 1 soat, RPO ≤ 5 daq | P0 |
| OPS-04 | Monitoring: node, postgres, redis va nginx exporter'lari, API va worker metrikalari (BE-07, River queue depth/latency, kesh hit rate, WS ulanishlar). Grafana dashboard'lari (RED, USE, biznes). Alertlar (Telegram): 5xx > 1%, p95 > 200 ms 5 daqiqa davomida, disk > 80%, replikatsiya yoki backup muvaffaqiyatsiz, River navbati > 1000, sertifikat < 14 kun. Tashqi uptime monitoring. | Sun'iy xatoda alert ≤ 2 daqiqada keladi | P0 |
| OPS-05 | Xatolarni kuzatish: GlitchTip (Sentry protokoli) Go va web uchun, source map'lar bilan. Worker'ga health va metrics endpoint qo'shiladi. | Frontend va backend xatosi GlitchTip'da ko'rinadi | P1 |
| OPS-06 | CI/CD: GitHub Actions → image'lar (ko'p bosqichli build, BuildKit kesh, versiya va commit ldflags bilan) → GHCR → staging'ga avtomatik deploy → prod'ga qo'lda tasdiq bilan. Tartib: backup nuqtasi → `migrate up` → api rolling (health gate) → web → worker. Bir buyruq bilan rollback. | Deploy davomida 5xx yo'q (k6 fonda ishlab turadi) | P0 |
| OPS-07 | Graceful shutdown: API WS ulanishlarini yopadi (BE-15). Worker `Stop` → timeout bo'lsa `StopAndCancel`. `/readyz` MinIO'ni ham tekshiradi. Docker healthcheck'lar (distroless uchun `/app/api healthcheck` subcommand). | Rolling restart paytida job'lar yo'qolmaydi | P0 |
| OPS-08 | Staging muhiti (prod'ning kichik nusxasi, anonimlashtirilgan seed). `robots: noindex`. | Har bir PR staging'da tekshiriladi | P1 |
| OPS-09 | Runbook (`docs/RUNBOOK.md`): deploy, rollback, backup'dan tiklash, sertifikat, disk to'lishi, Redis yiqilishi, "sayt sekin" diagnostikasi. | Yangi odam runbook bo'yicha tiklay oladi | P1 |

---

## 10. Sifat va testlar (QA)

| ID | Talab | ✅ Qabul | P |
|---|---|---|---|
| QA-01 | Backend integratsion testlari (haqiqiy Postgres, testcontainers yoki CI service). Qamrov: servislar, avtorizatsiya matritsasi (kim nimani ko'radi va o'zgartiradi), list endpoint'larda SQL so'rovlar soni, migratsiyalar. Hozir faqat 167 qator unit test bor. | Kritik yo'llar qoplangan, CI'da ishlaydi | P0 |
| QA-02 | Playwright CI'da: docker compose stek + seed, mavjud `web/test/*.mjs` CI'ga ko'chiriladi, axe (yorug' va qorong'i), 4 til bo'yicha smoke | CI yashil, axe'da 0 serious | P0 |
| QA-03 | Yuklama testi `k6/`: aralash scenariy (60% list/search, 20% detail, 10% auth, 10% yozish), WS scenariy, 100k vakansiyali ma'lumot generatori (`ctl seed-load`). Chegaralar §3 bo'yicha. | Staging'da hisobot (p95, xatolar, CPU) | P0 |
| QA-04 | Vizual regressiya (UI-09) | CI'da diff | P1 |
| QA-05 | UAT: §2.3 yo'llari 4 tilda, 3 real qurilmada (arzon Android, iPhone, desktop) | Imzolangan checklist | P0 |

---

## 11. SEO

| ID | Talab | P |
|---|---|---|
| SEO-01 | Sitemap index va bo'laklari (vakansiyalar `lastmod` bilan, ≤ 50k URL), `robots.txt`, canonical va hreflang. JobPosting Google talablari bo'yicha: `datePosted`, `validThrough`, `employmentType`, `hiringOrganization` (logo bilan), `jobLocation`, `baseSalary`, `directApply`. Muddati tugagan vakansiya 410 yoki `noindex` qaytaradi. Google Search Console va Yandex Webmaster ulanadi. | P0 |
| SEO-02 | Landing sahifalar "kasb × shahar" (`/vacancies/toshkent/buxgalter`), unikal H1 va matn bilan | P2 |
| SEO-03 | OG rasmlar: sayt uchun umumiy rasm va har bir vakansiya uchun dinamik rasm (worker'da SVG→PNG, keshlanadi) | P1 |

---

## 12. Bosqichlar (sprintlar)

Har bir sprint oxirida staging demo o'tkaziladi va sprint vazifalarining ✅ mezonlari tekshiriladi.

| Sprint | Muddat | Vazifalar |
|---|---|---|
| 0 · Poydevor | 3 kun | UI-01, SEC-01, SEC-02, BE-01, BE-02, BE-07, FE-01, SEC-08, SEC-09, OPS-02 (qoralama) |
| 1 · Dizayn tizimi | 1 hafta | UI-02, UI-03, UI-04, UI-05, UI-06, UI-08, FE-03 |
| 2 · Ommaviy sahifalar va tezlik | 1 hafta | PG-01…PG-06, BE-05, BE-06, BE-11, FE-02, FE-05, SEO-01 |
| 3 · Kabinetlar | 1 hafta | PG-07…PG-13, BE-03, BE-04, BE-08, BE-12, BE-14, FE-04 |
| 4 · MVP funksiyalari va xavfsizlik | 1 hafta | FN-01…FN-06, FN-08, PG-15, SEC-03…SEC-07, BE-09, BE-10, BE-13, BE-15, UI-07 |
| 5 · Production | 1 hafta | OPS-01…OPS-09, QA-01…QA-05, UI-09, UI-10, FE-06, FN-07, SEO-03, PG-14 |
| Launch | 1 kun | §13 checklist'i, DNS, soft-launch (yopiq beta 100 ta kompaniya) → ochiq launch |

Jami ~6 hafta. Parallel ishlash mumkin: bitta sessiya UI/PG bilan, ikkinchisi BE/OPS bilan
shug'ullanadi.

---

## 13. Definition of Done va launch checklist

**Har bir vazifa uchun DoD:**
- barcha ✅ bajarilgan va isbotlangan;
- `pnpm typecheck && pnpm build`, `make -C backend test`, `go vet` o'tadi;
- i18n kalitlari 4 tilda;
- `check-ui.mjs` o'zgargan fayllarda 0 buzilish;
- `ui-reviewer` (UI vazifalari uchun) APPROVE bergan;
- OpenAPI va web tiplari sinxron;
- `docs/` yangilangan.

**Launch checklist (hammasi ✅ bo'lishi shart):**
- [ ] Barcha P0 vazifalar yopilgan
- [ ] k6: 300 RPS, o'qish p95 < 100 ms, yozish p95 < 150 ms, xato < 0.1% (staging, prod'ga teng resurslar)
- [ ] `prod-check.mjs`: 11 sahifa, LCP ≤ 2.0 s, CLS ≤ 0.05; axe 0 serious
- [ ] Backup'dan tiklash mashqi muvaffaqiyatli (sanasi yozilgan)
- [ ] Alertlar Telegram'ga keladi (sun'iy test)
- [ ] SSL Labs A+, securityheaders A+
- [ ] Huquqiy: rozilik, maxfiylik siyosati, shartlar, yurist xulosasi (FN-08)
- [ ] Telegram webhook o'rnatilgan (`ctl telegram-webhook`), SMTP (SPF, DKIM, DMARC) sozlangan, spamga tushmaydi
- [ ] Google OAuth prod client, Search Console, sitemap yuborilgan
- [ ] Admin hisoblari 2FA bilan (TOTP, P1 — kamida kuchli parol va IP allowlist)
- [ ] Runbook tayyor, on-call kelishilgan

---

## Ilova A.1 · BE-02 indeks migratsiyasi (qoralama)

```sql
-- +goose NO TRANSACTION
-- +goose Up
CREATE INDEX CONCURRENTLY IF NOT EXISTS applications_resume_idx      ON applications (resume_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS applications_vacancy_new_idx ON applications (vacancy_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_file_idx            ON messages (file_id) WHERE file_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS saved_vacancies_vacancy_idx  ON saved_vacancies (vacancy_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_reads_user_idx  ON conversation_reads (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS conversations_vacancy_idx    ON conversations (vacancy_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS application_events_actor_idx ON application_events (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancies_company_pub_idx    ON vacancies (company_id, published_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancies_district_pub_idx   ON vacancies (district_id, published_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX CONCURRENTLY IF NOT EXISTS user_sessions_expires_idx    ON user_sessions (expires_at);

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS applications_resume_idx;
DROP INDEX CONCURRENTLY IF EXISTS applications_vacancy_new_idx;
DROP INDEX CONCURRENTLY IF EXISTS messages_file_idx;
DROP INDEX CONCURRENTLY IF EXISTS saved_vacancies_vacancy_idx;
DROP INDEX CONCURRENTLY IF EXISTS conversation_reads_user_idx;
DROP INDEX CONCURRENTLY IF EXISTS conversations_vacancy_idx;
DROP INDEX CONCURRENTLY IF EXISTS application_events_actor_idx;
DROP INDEX CONCURRENTLY IF EXISTS vacancies_company_pub_idx;
DROP INDEX CONCURRENTLY IF EXISTS vacancies_district_pub_idx;
DROP INDEX CONCURRENTLY IF EXISTS user_sessions_expires_idx;
```
Agar `CONCURRENTLY` build yiqilsa, INVALID indeks qoladi va `IF NOT EXISTS` uni o'tkazib
yuboradi: bunday holatda uni `DROP` qilib, migratsiyani qayta ishga tushiring. Keyin `ANALYZE` ishga tushiriladi va har bir so'rovning `EXPLAIN (ANALYZE, BUFFERS)` natijasi PR'ga
qo'shiladi. `vacancies_company_idx (company_id, created_at DESC)` endi ishlatilmasa, alohida
migratsiyada o'chiriladi.

## Ilova A.2 · nginx asosiy qismlari (OPS-02 qoralamasi)

```nginx
# /etc/nginx/conf.d/jobvacancy.conf (asosiy qismlar)
limit_req_zone $binary_remote_addr zone=api:20m rate=30r/s;
proxy_cache_path /var/cache/nginx/ssr levels=1:2 keys_zone=ssr:50m max_size=1g inactive=10m use_temp_path=off;
map $http_cookie $no_ssr_cache { default 0; "~(^|;\s*)jv_auth=1" 1; }   # root.tsx hasSession
upstream api { least_conn; server api-1:8090; server api-2:8090; keepalive 64; }
upstream web { least_conn; server web-1:3000; server web-2:3000; keepalive 32; }

server {
  listen 443 ssl; listen 443 quic reuseport; http2 on;
  server_name jobvacancy.uz;
  ssl_protocols TLSv1.3 TLSv1.2; ssl_session_cache shared:SSL:20m;
  # Diqqat: location ichida o'z add_header'i bo'lsa, server darajasidagilar meros qilinmaydi.
  # Shuning uchun xavfsizlik header'lari snippet'da turadi va har bir location'ga include qilinadi:
  #   snippets/security-headers.conf: Alt-Svc, HSTS, nosniff, Referrer-Policy, Permissions-Policy, CSP
  include snippets/security-headers.conf;
  brotli on; brotli_comp_level 5; brotli_types application/json text/css application/javascript image/svg+xml;
  gzip on; gzip_comp_level 5; gzip_types application/json text/css application/javascript image/svg+xml;
  include snippets/cloudflare-real-ip.conf;   # set_real_ip_from <Cloudflare IPv4/IPv6 diapazonlari>;
  real_ip_header CF-Connecting-IP;             # (ro'yxat cloudflare.com/ips'dan cron bilan yangilanadi)

  location /assets/ { proxy_pass http://web; expires 1y; include snippets/security-headers.conf;
    add_header Cache-Control "public, immutable"; }
  location /api/v1/ws { proxy_pass http://api; proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_read_timeout 1h; }
  location /api/ { limit_req zone=api burst=60 nodelay; proxy_pass http://api;
    proxy_http_version 1.1; proxy_set_header Connection "";
    proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $remote_addr; }   # klient qiymatini qayta yozadi
  location /media/ { proxy_pass http://minio:9000/jv-public/; expires 30d; include snippets/security-headers.conf; }
  location / {
    proxy_pass http://web; proxy_http_version 1.1; proxy_set_header Connection "";
    proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $remote_addr;   # SSR forwardHeaders uchun
    proxy_cache ssr; proxy_cache_bypass $no_ssr_cache; proxy_no_cache $no_ssr_cache;
    proxy_cache_key "$scheme$host$request_uri|$cookie_jv_theme|$cookie_jv_glass";   # HTML mavzuga bog'liq
    proxy_cache_valid 200 30s; proxy_cache_use_stale updating error timeout; proxy_cache_lock on;
    include snippets/security-headers.conf; add_header X-Cache $upstream_cache_status;
  }
}
```

## Ilova A.3 · k6 chegaralari (QA-03)

```js
export const options = {
  scenarios: {
    browse: { executor: "ramping-arrival-rate", startRate: 20, timeUnit: "1s",
      stages: [{ target: 300, duration: "5m" }, { target: 300, duration: "10m" }], preAllocatedVUs: 400 },
  },
  thresholds: {
    http_req_failed: ["rate<0.001"],
    "http_req_duration{kind:read}": ["p(95)<100"],
    "http_req_duration{kind:write}": ["p(95)<150"],
  },
};
```

## Ilova B · Claude Code bilan ishlash tartibi

1. Plaginni o'rnating (paketdagi `README.md`). `TZ.md` ni `docs/TZ.md` ga, `CLAUDE.md`
   parchasini repo ildiziga qo'ying.
2. Avval audit o'tkazing: `/jobvacancy:ui-audit all` (asosiy holatni yozib oladi).
3. Sprint tartibida ishlang: `/jobvacancy:tz-task UI-01`, keyin `SEC-01`, va hokazo. UI sahifalari uchun:
   `/jobvacancy:redesign /vacancies`.
4. Har bir UI PR'dan keyin: "use the ui-reviewer agent to review this diff".
5. Hook har bir tahrirda token qoidalarini tekshiradi. Vaqtincha yumshatish uchun
   `JV_UI_CHECK=warn`, o'chirish uchun `JV_UI_CHECK=off`.
