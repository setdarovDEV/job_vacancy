# Job Vacancy — loyiha rejasi

> Kelishilgan reja va qarorlar. Holat: `[x]` tayyor · `[~]` jarayonda · `[ ]` navbatda.

## 1. Mahsulot

Har qanday soha bo'yicha ish va ishchi topish platformasi. Rollar:

- **Ish izlovchi:** rezyume, qidiruv, ariza, chat, ogohlantirishlar, AI yordamchilar
- **Ish beruvchi:** kompaniya, vakansiya, nomzod qidirish, arizalar kanbani, chat, AI saralash
- **Admin:** moderatsiya, shikoyatlar, kataloglar, statistika

## 2. Qabul qilingan qarorlar

| Mavzu | Qaror |
|---|---|
| Tillar | o'zbek (lotin), o'zbek (kirill), rus, ingliz. Backend faqat xato **kodi** qaytaradi, tarjimani klient qiladi |
| SEO | Ochiq sahifalar SSR (React Router v7 framework mode, Vite) + JobPosting schema.org |
| Login | Email + parol (SMTP), Google. Telefon **Telegram Gateway API** orqali tasdiqlanadi ("Verification Codes" chati) |
| To'lov | Payme/Click keyinroq ulanadi. UI'da joyi bor, **"Tez kunda"** belgisi bilan |
| Chat | Matn, fayl, rasm, ovozli xabar, lokatsiya (OpenStreetMap) |
| Server | VPS + Docker Compose, domen **jobvacancy.uz**, hamma deploy narsalari `nginx/` papkada |
| Brend | Loyiha oxirida logo/brend uchun AI prompt yoziladi |
| AI | Pullik funksiyalar (kredit + obuna). Asosiy qismlar tayyor bo'lgach qo'shiladi, sxema hozirdan tayyorlanadi |

## 3. Arxitektura

```
Web/Mobile ─► NGINX (SSL, brotli, rate limit)
                ├─ /        → web (SSR + static)
                ├─ /api/*   → Go API ×N ──► PostgreSQL 18
                ├─ /ws      → Go WebSocket   └► Redis (kesh, pub/sub, OTP, rate limit)
                └─ /media/* → MinIO (S3)
              Go Worker (River, Postgres'dagi navbat): email, push, PDF, AI, tozalash
```

**Modulli monolit:** `backend/internal/modules/<modul>/{handler,service,...}.go`, SQL `db/queries` → sqlc.

### Backend asosiy qoidalari
- ORM yo'q: **sqlc + pgx**, prepared statement'lar keshlanadi
- ID'lar **UUIDv7** (Postgres 18 `uuidv7()`), vaqt bo'yicha tartiblangani uchun indeks tez ishlaydi
- Ro'yxatlar faqat **cursor (keyset) pagination** bilan, `OFFSET` ishlatilmaydi
- Og'ir ishlar faqat worker'da bajariladi (River, tranzaksiya bilan birga navbatga qo'yish mumkin)
- Access JWT 15 daqiqa, refresh token har safar almashtiriladi (rotation). O'g'irlangan token qayta ishlatilsa, sessiya bekor qilinadi
- Web: refresh token HttpOnly cookie'da (`/api/v1/auth`), mobil: `X-Client-Type` header'i va JSON body orqali
- Xatolar formati: `{"error":{"code","message","fields"}}`. Muvaffaqiyatli javob: `{"data":...}`

## 4. AI funksiyalari (keyingi bosqich)

| Kim uchun | Funksiya |
|---|---|
| Ish beruvchi | ⭐ AI nomzod saralash (ball + sabab), tabiiy tilda nomzod qidirish, vakansiyani 4 tilda yozish, suhbat savollari |
| Ish izlovchi | ⭐ AI suhbat mashqi, rezyumeni vakansiyaga moslashtirish + cover letter, PDF/rasmdan rezyume, karyera maslahatchisi (platforma ma'lumotlari asosida) |
| Platforma | Firibgar vakansiyalarni aniqlash, avtomatik kategoriya/ko'nikma ajratish, tarjima |

Texnik yondashuv: Anthropic Go SDK, structured outputs, streaming, prompt caching (saralashda vakansiya matni keshlanadi), Batch API (kechki vazifalar 50% arzon), pgvector (semantik moslik). Hisob-kitob jadvallari: `ai_wallets`, `ai_transactions`, `ai_usage_logs`. Rezyume matni AI'ga buyruq sifatida emas, faqat ma'lumot sifatida beriladi (prompt injection'dan himoya).

## 5. Bosqichlar

- [x] **0. Poydevor:** monorepo, dev infra (`nginx/docker-compose.dev.yml`), Makefile, CI, git
- [x] **1. Backend yadrosi:** config, log, Postgres, Redis, migratsiyalar, River, middleware, metrikalar
  - [x] Auth: ro'yxatdan o'tish, login, Google, refresh rotation, logout, sessiyalar
  - [x] Email tasdiqlash va parol tiklash (SMTP + 4 tilda shablon), telefonni Telegram orqali tasdiqlash
- [x] **2. Kataloglar + kompaniya + vakansiya**
  - [x] Kataloglar: 20 ta soha / 79 ta yo'nalish, 14 ta hudud, 60 ta ko'nikma (4 tilda), xotirada kesh + ETag
  - [x] Kompaniyalar: profil, jamoa (owner/admin/recruiter), admin tasdig'i (verified)
  - [x] Vakansiyalar: draft → moderatsiya → e'lon (30 kun) → arxiv/muddati tugagan, filtrlar, cursor
  - [x] Ko'rishlar soni: Redis'da yig'iladi, har daqiqada DB'ga yoziladi (bir kishi 1 soatda 1 marta hisoblanadi)
  - [x] 206 ta tuman va viloyatga bo'ysunuvchi shahar rasmiy SOATO klassifikatoridan (stat.uz, 2022-04-20 tahriri) 4 tilda: `ctl import-districts` (idempotent), `/catalog/regions/{region}/districts`. Inglizcha nomlar va 2022 yildan keyingi o'zgarishlar odam tomonidan tekshirilishi kerak (`backend/db/data/districts.csv` sarlavhasi)
- [x] **3. Qidiruv**
  - [x] Lotin/kirill/rus matnlar bitta ko'rinishga normallashadi (`pkg/translit`): "дастурчи" = "dasturchi"
  - [x] Yengil o'zak ajratish + prefiks qidiruv (`pkg/searchq`): "dasturchilar", "продажам"
  - [x] Og'irliklar: sarlavha > ko'nikma/kompaniya > soha/hudud nomlari > tavsif; featured va yangilik bonusi
  - [x] Xato yozilganda trigram fallback ("fluter" → Flutter), `meta.fuzzy`
  - [x] Alohida `vacancy_search` indeks jadvali: top-N ID'lar u yerda tanlanadi, faqat N ta qator join qilinadi
  - [x] Redis kesh (30 s) + singleflight, suggest (5 daq), mashhur qidiruvlar
  - [x] 100k vakansiyada o'lchandi: eng keng so'rov ~47 ms, filtrli 30–45 ms, keshdan 2–3 ms
- [x] **4. Rezyume + arizalar**
  - [x] Rezyume konstruktori: tajriba, ta'lim, ko'nikmalar, tillar; 5 tagacha rezyume; tajriba oylari (ustma-ust ishlar bir marta)
  - [x] Ko'rinish: public / applied_only / hidden; kontaktlar faqat ariza yuborilgan kompaniyaga
  - [x] Nomzod qidiruvi (ish beruvchi): `resume_search` indeks jadvali, FTS + filtrlar (tajriba, til, maosh, format, ko'chish)
  - [x] PDF eksport (4 tilda sarlavhalar, Noto Sans, OFL)
  - [x] Arizalar: topshirish, taklif (invite), kanban statuslari, tarix, ichki izohlar, qaytarib olish
  - [x] Saqlangan vakansiyalar (bookmark)
- [x] **5. Fayllar + chat + bildirishnomalar**
  - [x] Fayllar: presigned POST (hajm S3'da cheklanadi), yuklangandan keyin kontent tekshiruvi, public/private bucket'lar
  - [x] Bildirishnomalar: ilova ichida + real-time, email (4 tilda), Telegram bot (deep link, webhook), push tokenlar
  - [x] Chat: arizaga bog'langan suhbatlar, matn/rasm/fayl/ovoz/lokatsiya, idempotent yuborish, o'qildi, yozmoqda, o'chirish
  - [x] WebSocket hub: bir martalik ticket, Redis pub/sub (ko'p instance), onlayn holat (ZSET), sekin klientni uzish
  - [x] Oflayn foydalanuvchiga chat bildirishnomasi (suhbat boshiga 10 daqiqada 1 marta)
  - [x] Saqlangan qidiruvlar + yangi vakansiya ogohlantirishlari (30 daqiqada, SKIP LOCKED)
  - [ ] FCM (Firebase) ulash: mobil bosqichda, hozir log'ga yoziladi
- [x] **6. Web: dizayn tizimi** ([DESIGN.md](DESIGN.md))
  - [x] React Router v8 (SSR) + Vite 8 + Tailwind v4, API turlari OpenAPI'dan generatsiya qilinadi
  - [x] Token'lar (lojuvard/firuza/za'faron/anor), yorug'/qorong'i/avtomatik, miltillashsiz
  - [x] Unbounded + Onest (self-host, kirill va o'zbek harflari), major third shkalasi
  - [x] UI kit: Button, Field/Input/Textarea, Select, Chip, Badge, Avatar, Switch/Checkbox/Radio, Dialog/Sheet,
        Menu, Popover, Tooltip, Tabs, Toast, Skeleton, EmptyState; header/footer, til va mavzu almashtirgichlar
  - [x] 4 til URL prefiks bilan, o'z tarjimon (plural), pul/maosh/nisbiy vaqt formatlash
  - [x] Bosh sahifa hero'si (girih naqshi, qidiruv), `/ui` ko'rgazma sahifasi
  - [x] Bosh sahifa JS+CSS 145 KB gzip; 19 ta brauzer testi (Playwright), hydration xatosiz
- [x] **7. Web: sahifalar**
  - [x] Vakansiyalar: SSR qidiruv, filtrlar (desktop yon panel, mobil sheet), URL'da holat, "yana ko'rsatish", saqlash (yurakcha), qidiruvni saqlash
  - [x] Vakansiya sahifasi: JSON-LD JobPosting, ariza oynasi (rezyume tanlash + xat), ulashish, xavfsiz markdown
  - [x] Kompaniyalar katalogi va kompaniya sahifasi, ish beruvchilar sahifasi (tariflar va AI "Tez kunda")
  - [x] Statik sahifalar (loyiha haqida, aloqa, maxfiylik, shartlar) — matn serverda, bundle'ga kirmaydi; `sitemap.xml` (hreflang bilan)
  - [x] Ish izlovchi kabineti: sozlamalar (rasm, telefon Telegram orqali, bildirishnomalar + Telegram ulash, parol, qurilmalar),
        rezyumelar + konstruktor + PDF, arizalar (holat tarixi, qaytarib olish), saqlanganlar, saqlangan qidiruvlar, bildirishnomalar
  - [x] Ish beruvchi paneli: vakansiyalar (statuslar bo'yicha), kompaniya profili + logo + jamoa, vakansiya formasi,
        arizalar kanbani (drag & drop, mobil uchun ustun tablari), ariza sahifasi (rezyume, bosqich, ichki izoh), nomzodlar qidiruvi + taklif
  - [x] Chat: WebSocket (ticket, qayta ulanish, oflayn paytdagi xabarlarni olish), matn/rasm/fayl/ovoz/lokatsiya, yozmoqda, o'qildi, onlayn holat, o'chirish
  - [x] Header'dagi badge'lar real vaqtda yangilanadi
  - [x] Tekshiruv: 42 ta brauzer tekshiruvi (`web/test/*.mjs`), production'da 11 sahifa sekin 4G'da LCP < 0,9 s, CLS < 0,1, hydration xatosiz;
        bosh sahifa JS 145 KB + CSS 15 KB gzip; `test/i18n-keys.mjs` 4 tildagi kalitlarni tekshiradi
- [~] **8. Admin panel** — API tayyor (TZ FN-01): foydalanuvchi qidirish va bloklash, kompaniyani bloklash, ko'nikmalar moderatsiyasi (tasdiqlash, birlashtirish), "TOP" muddati bilan, shikoyatlar navbati, statistika, har bir amal `admin_audit_log`da; UI (PG-15) navbatda
  - [x] Shikoyatlar (FN-02), akkauntni o'chirish (FN-03), muddat tugashi bildirishnomalari va qayta e'lon (FN-04), jamoaga taklif rozilik bilan (FN-05), ro'yxatdan o'tishda rozilik (FN-08, backend), onlayn holat maxfiyligi (SEC-05)
- [ ] **9. Mobile (Flutter)**
- [ ] **10. AI moduli + kreditlar** (to'lov "Tez kunda")
- [ ] **11. Deploy:** nginx conf, SSL, prod compose, CI/CD, monitoring, backup
  - Postgres: `random_page_cost=1.1` (SSD) majburiy, aks holda keng qidiruvlar GIN indeksni chetlab o'tadi
  - Nginx: `/api/v1/ws` uchun `Upgrade`/`Connection` header'lari va uzoq `proxy_read_timeout`; `/media` → MinIO public bucket (`X-Content-Type-Options: nosniff`)
  - `ctl telegram-webhook https://jobvacancy.uz/api/v1/telegram/webhook`
- [ ] **12. Test + optimizatsiya:** integratsion testlar, Playwright, k6 yuklama testi
- [ ] **13. Brend prompti**

## 6. Tezlik maqsadlari

| Qism | Maqsad |
|---|---|
| API | o'qish so'rovlari p95 < 50 ms, keshdan olinganda < 10 ms |
| Web | LCP < 2 s, boshlang'ich JS < 150 KB gzip |
| Mobile | barqaror 60 fps |
| Animatsiya | faqat `transform`/`opacity`, `prefers-reduced-motion` hurmat qilinadi |
