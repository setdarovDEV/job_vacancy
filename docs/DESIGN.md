# Job Vacancy — dizayn tizimi

Jonli namunalar: `make web` → http://localhost:5180/ui (faqat dev rejimda).
Token'lar: [`web/app/styles/app.css`](../web/app/styles/app.css). Komponentlar: [`web/app/shared/ui`](../web/app/shared/ui).

## G'oya

Platforma O'zbekiston bo'ylab hamma kasb egalari uchun: kassirdan dasturchigacha. Dizayn tinch va ishonchli, lekin
shablon emas. Identitet Samarqand koshinlaridan olingan, bezak sifatida emas, tizim sifatida.

**Bitta jasur element:** bosh sahifadagi girih (8 qirrali yulduz) naqshi. U sahifa ochilganda bir marta diagonal
bo'ylab paydo bo'ladi (bitta CSS mask animatsiyasi). Qolgan hamma joy sokin.

## Ranglar

| Token | Yorug' | Qorong'i | Ma'nosi |
|---|---|---|---|
| `paper` | #F5F7FB | #0D1226 | sahifa foni (sovuq oq, krem emas) |
| `surface` | #FFFFFF | #141A33 | panel, input |
| `ink` / `ink-2` / `ink-3` | #151A33 / #4B5272 / #6B7191 | #EDF0FA / #AAB1CE / #8A91B2 | matn darajalari |
| `lapis` (lojuvard) | #1B3A8C | #8EA7FF | brend, asosiy tugma, havola |
| `firuza` | #0E9F96 | #2BC4B8 | maosh, "tasdiqlangan", muvaffaqiyat |
| `zafaron` | #F0B429 | #F5C451 | TOP, "Tez kunda" |
| `anor` | #D1344B | #FF6B7D | faqat xatolar va o'chirish |

Qoidalar:
- Komponentlarda `dark:` yoki xom rang yo'q, faqat token. Qorong'i rejim bitta faylda boshqariladi.
- Mavzu cookie'da saqlanadi (`jv_theme`), server birinchi baytdanoq to'g'ri rangni beradi, miltillash bo'lmaydi.
  "Avtomatik" rejimda tizim sozlamasiga amal qilinadi.
- Avatar ranglarida anor ishlatilmaydi (anor = xato).

## Tipografiya

- **Unbounded**: sarlavhalar va katta raqamlar (maosh). Keng, geometrik, xarakterli.
- **Onest**: hamma matn.
- Ikkalasi ham lotin, kirill va ў қ ғ ҳ ʻ harflarini qo'llaydi. Self-host qilinadi, `unicode-range` subset'lari
  bilan: brauzer faqat kerakli qismni yuklaydi.
- Shkala: major third (1.25), 16px asos: 12.8 · 14 · 16 · 20 · 25 · 31 · 39 · 49 · 61.
- Sarlavhalar `text-wrap: balance`, matn qatori ≤ 65–75 belgi. Raqamlar `.num` (tabular).

## Shakl va joy

- Radiuslar ierarxiyasi: control 12px → panel 18px → sheet 24px, chiplar to'liq yumaloq.
- Kartochkalar soyasiz, chegara (`line`) bilan. Soya faqat suzuvchi elementlarda (`shadow-pop`: dialog, popover).
- Ro'yxatlar "SaaS card kit" emas, bitta panel ichidagi qatorlar (hairline bilan ajratilgan).

## Harakat

- Foydalanuvchi harakatiga javob beradi: ochilish, tanlash, tasdiqlash. Har bir bo'limda fade-up bo'lmaydi.
- Radix va popover holatlari CSS animatsiyalari bilan (`anim-*`, `@starting-style`), main thread'ni band qilmaydi.
- Motion faqat layout animatsiyalari uchun (tab ko'rsatkichi, toast) va o'sha komponentlar ichida lazy yuklanadi.
- `prefers-reduced-motion`: hamma animatsiya bir zumda.

## Til

- URL: `/` (o'zbek lotin), `/uz-cyrl/…`, `/ru/…`, `/en/…`. Har bir til alohida URL (SEO).
- Tarjimalar `web/app/shared/i18n/messages/*.ts`, `uz.ts` asosiy manba; boshqa tillar TypeScript orqali tekshiriladi.
- Ko'plik shakllari (`hours_one/few/many/other`) `Intl.PluralRules` bilan. Nisbiy vaqt va kasr ajratgich o'zimizniki,
  chunki brauzerlarning `Intl`'ida o'zbek tili ma'lumotlari hamma joyda yo'q.
- Pul: "15–25 mln so'm", "4,5 mln so'mdan", "Kelishiladi".

## Tezlik byudjeti

- Bosh sahifa: JS+CSS ≤ 150 KB gzip (hozir 145 KB, shundan ~100 KB React + React Router). CI yadro bo'laklar (React, router, root, CSS) 120 KB'dan oshsa to'xtaydi (hozir 104 KB).
- Kutubxona tanlovi: i18next o'rniga 1 KB'lik o'z tarjimonimiz; til/mavzu menyulari native Popover API;
  hudud tanlash native `<select>`; mobil menyu, toast, tooltip va Motion faqat kerak bo'lganda yuklanadi.
