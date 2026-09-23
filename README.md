# Job Vacancy · jobvacancy.uz

Har qanday soha bo'yicha ish va ishchi topish platformasi: vakansiya va rezyume qidirish,
arizalar, real-time chat, AI yordamchilar.

| Qism | Texnologiya | Papka |
|---|---|---|
| Backend | Go 1.27, chi, pgx + sqlc, River, Redis | [`backend/`](backend) |
| Web | React 19 + Vite + TypeScript (SSR) | [`web/`](web) |
| Mobile | Flutter | [`mobile/`](mobile) |
| Database | PostgreSQL 18 | [`backend/db/`](backend/db) |
| Deploy | Nginx, Docker Compose, SSL, monitoring | [`nginx/`](nginx) |

To'liq reja va arxitektura: [`docs/PLAN.md`](docs/PLAN.md). Dizayn tizimi: [`docs/DESIGN.md`](docs/DESIGN.md). API shartnomasi: [`backend/api/openapi.yaml`](backend/api/openapi.yaml).

## Tez boshlash

Kerak: Go 1.27+, Docker, Node 22+, Flutter.

```bash
make setup     # Postgres, Redis, MinIO, Mailpit + .env + migratsiyalar
make api       # API  → http://localhost:8090
make worker    # fon vazifalar (email yuborish va h.k.) — alohida terminalda
make web       # sayt → http://localhost:5180
```

| Servis | Manzil |
|---|---|
| Sayt (web) | http://localhost:5180 · dizayn tizimi: http://localhost:5180/ui |
| API | http://localhost:8090 (`/healthz`, `/readyz`) |
| Mailpit (kelgan xatlar) | http://localhost:8025 |
| MinIO konsol | http://localhost:9201 (jobvacancy / jobvacancy-secret) |
| PostgreSQL | `localhost:5440` (jobvacancy / jobvacancy) |
| Redis | `localhost:6390` |
| Prometheus metrikalar | http://127.0.0.1:9091/metrics |

Dev rejimida Telegram tokeni bo'lmasa, telefon tasdiqlash kodi API logida chiqadi
(`DEV: telegram verification code`).

## Foydali buyruqlar

```bash
make help                          # hamma buyruqlar
make -C backend sqlc               # db/queries/*.sql dan Go kod yaratish
make -C backend migration name=add_vacancies
make -C backend test
make psql                          # dev bazaga ulanish
make -C backend set-role email=siz@mail.uz role=admin   # admin tayinlash
```

E2E testlar: [`backend/test/e2e/`](backend/test/e2e).

### Demo hisoblar va brauzer testlari

```bash
cd backend && ./test/e2e/seed_demo.sh      # seeker@demo.uz / hr@demo.uz, parol Secret123
cd web
node test/browser-smoke.mjs                # dizayn tizimi, til/mavzu (dev server kerak)
node test/shots-c.mjs                      # ochiq sahifalar: qidiruv, filtrlar, vakansiya, kompaniyalar
node test/shots-d.mjs                      # ish izlovchi kabineti
node test/shots-e.mjs                      # ish beruvchi paneli, kanban drag & drop
IMG=rasm.png node test/shots-f.mjs         # ikki foydalanuvchi o'rtasida real vaqtli chat
node --experimental-strip-types test/i18n-keys.mjs   # tarjima kalitlari
pnpm build && PORT=5190 pnpm start &  WEB=http://localhost:5190 node test/prod-check.mjs   # SSR + Web Vitals
```

`SHOTS=papka` skrinshotlarni o'sha yerga saqlaydi.
