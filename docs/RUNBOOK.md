# Runbook: jobvacancy.uz production

> Bu hujjat serverni ko'tarish, deploy, rollback, backup'dan tiklash va tez-tez uchraydigan
> nosozliklarni bartaraf etish uchun. Buyruqlar repo ildizidan (`/opt/jobvacancy`) ishga
> tushiriladi. TZ: OPS-01, OPS-02, OPS-03, OPS-08 (va OPS-09 asosi).

## 1. Tuzilma

```
Cloudflare (DNS, WAF, kesh) ─► app-1: nginx :80 :443/tcp :443/udp (yagona ochiq port)
                                  ├─ /            → web-1, web-2 (react-router-serve, Node 22)
                                  ├─ /api/, /ws   → api-1, api-2 (Go)
                                  ├─ /media/      → MinIO jv-public (faqat o'qish)
                                  └─ /jv-public/, /jv-private/ → MinIO S3 API (presigned yuklash)
                               worker (River) · redis-cache (allkeys-lru) · redis-state (noeviction + AOF)
                               MinIO · certbot · pg-backup
db-1 (yoki shu server): PostgreSQL 18 + wal-g → offsite S3
```

| Fayl | Nima |
|---|---|
| `nginx/docker-compose.prod.yml` | prod stek; `nginx/docker-compose.staging.yml` staging uchun ustiga qo'shiladi |
| `.env.production.example`, `.env.staging.example` | sozlamalar shabloni (har bir o'zgaruvchi izohlangan) |
| `nginx/nginx.conf`, `nginx/conf.d/`, `nginx/snippets/` | nginx (image ichiga "pishiriladi") |
| `nginx/postgres/` | Postgres image: `postgresql.conf`, wal-g skriptlari, `anonymize.sql` |
| `nginx/scripts/` | `deploy.sh`, `rollback.sh`, `restore.sh`, `staging-refresh.sh`, `cert.sh` |
| `nginx/.deploy/<env>/` | serverdagi holat: joriy/oldingi reliz, restore point, mashqlar jurnali |

Image'lar: `ghcr.io/setdarovdev/jobvacancy-{backend,web,nginx,postgres}`. backend va web tegi
= reliz (`sha-<commit>`), nginx va postgres tegi = fayllari hash'i (`nginx/scripts/image-tags.sh`):
ular faqat o'z fayllari o'zgarganda yangilanadi, shuning uchun oddiy deploy nginx va Postgres'ni
qayta ishga tushirmaydi.

## 2. Toza serverga o'rnatish (OPS-01)

Server: Ubuntu 24.04, 4 vCPU / 8 GB, NVMe. Joylashuv FN-08 (yurist xulosasi) bo'yicha tanlanadi.

```bash
# 1) Docker + compose plugin (v2.20+), foydalanuvchi va firewall
curl -fsSL https://get.docker.com | sh
adduser --disabled-password deploy && usermod -aG docker deploy
ufw default deny incoming && ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable
# Docker e'lon qilgan portlar ufw'ni chetlab o'tadi: shuning uchun compose'da faqat nginx
# tashqariga ochiq, qolganlari 127.0.0.1 da yoki umuman ochilmagan.

# 2) Kod va sozlamalar
git clone https://github.com/setdarovDEV/job_vacancy /opt/jobvacancy && cd /opt/jobvacancy
cp .env.production.example .env.production && chmod 600 .env.production
$EDITOR .env.production        # har bir change-me ni to'ldiring (yonida generatsiya buyrug'i bor)
make prod-config                # sintaksis tekshiruvi

# 3) GHCR'dan o'qish (paketlar private bo'lsa): read:packages huquqli token
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin

# 4) Sertifikat va birinchi deploy
make cert                       # Let's Encrypt (Cloudflare DNS-01 yoki HTTP-01)
make deploy TAG=sha-<commit>    # CI qurgan tag; registry bo'lmasa: make deploy BUILD=1

# 5) Ilova sozlamalari
make ctl ARGS="telegram-webhook https://jobvacancy.uz/api/v1/telegram/webhook"
make ctl ARGS="set-role admin@jobvacancy.uz admin"
make backup-status              # birinchi to'liq backup pg-backup ishga tushishi bilan olinadi
```

**Cloudflare:** SSL/TLS rejimi **Full (strict)**; Always Use HTTPS yoqilgan; Rocket Loader,
Email Obfuscation va Automatic Web Analytics beacon **o'chirilgan** (CSP ularni bloklaydi);
HTTP/3 yoqilgan. Origin faqat Cloudflare'dan kelsin desangiz, ufw'da 80/443 ni
`nginx/snippets/cloudflare-real-ip.conf` dagi diapazonlarga cheklang.

**Ikki serverli variant (TZ topologiyasi):** db-1 da `.env.production` ichida
`COMPOSE_PROFILES=db,backup`, `DB_PUBLISH=<db-1 private IP>:5432` va
`docker compose --env-file .env.production -f nginx/docker-compose.prod.yml up -d postgres pg-backup`.
app-1 da `COMPOSE_PROFILES=` (bo'sh), `DB_HOST=<db-1 private IP>`, keyin `make deploy`.

## 3. Deploy va rollback

```bash
git fetch && git checkout --force <commit>   # CI buni o'zi qiladi
make deploy TAG=sha-<commit>
```

`deploy.sh` tartibi (OPS-06): image'lar → infratuzilma (`--no-recreate`: Postgres, Redis, MinIO
hech qachon qayta yaratilmaydi) → **restore point** (`pg_create_restore_point`) → `migrate up` →
api-1, api-2 → web-1, web-2 (har biri avval nginx'da drenaj qilinadi: `jv-upstream down`, keyin
qayta yaratiladi, `/readyz` 200 bo'lgach qaytariladi) → worker → nginx/certbot/pg-backup →
smoke test (`/`, `/vacancies`, `/api/v1/catalog/regions`). Migratsiya yiqilsa hech narsa qayta
ishga tushmaydi, eski reliz ishlashda davom etadi.

```bash
make rollback                   # oldingi reliz (migratsiyasiz: ular additive)
make restore NAME=<restore point>   # migratsiyaning o'zini qaytarish kerak bo'lsa (§5)
cat nginx/.deploy/production/history   # qaysi reliz qachon chiqqan
```

nginx image'i o'zgargan deploy'da nginx konteyneri qayta yaratiladi (1–2 soniya ulanishlar
uziladi, deploy buni ogohlantiradi). Bunday deploy'larni kam trafikli vaqtga qo'ying.

## 4. Staging (OPS-08)

`staging.jobvacancy.uz` — prod stekining kichik nusxasi (2 vCPU / 4 GB, alohida VPS):
`.env.staging` (`APP_ENV=staging`) + `docker-compose.staging.yml`. Farqlar: `X-Robots-Tag:
noindex` va `Disallow: /` (nginx host nomi bo'yicha), ixtiyoriy basic auth
(`STAGING_BASIC_AUTH`), barcha email Mailpit'da (`ssh -L 8025:127.0.0.1:8025 staging`),
Telegram tokenlari bo'sh, o'z backup'i yo'q.

- `main` ga har bir push staging'ga avtomatik chiqadi; PR'ga **`staging`** yorlig'ini qo'ysangiz,
  o'sha PR staging'ga chiqadi (`.github/workflows/deploy.yml`).
- `make staging-refresh` — prod'ning oxirgi backup'ini staging'ga tiklaydi, `anonymize.sql` bilan
  shaxsiy ma'lumotlarni almashtiradi (ism, email, telefon, Google/Telegram, sessiyalar, chat
  matnlari, xatlar, fayl nomlari, lokatsiya), navbatdagi job'larni o'chiradi. Hamma parollar
  `Secret123`. Bu bir vaqtning o'zida **oylik tiklash mashqi** (§6).
- Shaxsiy ma'lumotli yangi jadval qo'shilsa, uni `nginx/postgres/anonymize.sql` ga qo'shing.

## 5. Backup va tiklash (OPS-03)

**Qanday ishlaydi:** Postgres har bir WAL segmentini `archive_command` (wal-g) orqali offsite
S3'ga yuboradi, `archive_timeout=60` — bo'sh vaqtda ham ko'pi bilan 1 daqiqada. `pg-backup`
har kuni 21:00 UTC (02:00 Toshkent) to'liq backup oladi va 14 ta to'liq backup'ni saqlaydi
(= 14 kunlik PITR oynasi). Hammasi libsodium bilan klient tomonda shifrlangan
(`BACKUP_ENCRYPTION_KEY`), siqilgan (zstd). **Shifrlash kalitining nusxasi parol menejerida
va offline'da bo'lishi shart** — usiz backup'lar yaroqsiz.

```bash
make backup-status    # eng yangi backup yoshi + pg_stat_archiver (failed_count 0, lag < 2 min)
make backup           # hozir to'liq backup (masalan, katta migratsiyadan oldin)
```

Alertlar: `BACKUP_HEARTBEAT_URL` (healthchecks.io) har backup'dan keyin ping oladi, xatoda
`/fail`; pg-backup healthcheck'i 26 soatdan eski backup'da "unhealthy" bo'ladi;
`pg_stat_archiver.failed_count` o'sishi — WAL arxivi ishlamayapti (monitoring, OPS-04).

**Tiklash (PITR):**

```bash
make restore                                  # arxivdagi eng oxirgi holat
make restore TIME="2026-09-24 14:05:00+05"    # shu vaqtgacha
make restore NAME=deploy_sha_abc_20260924T090000Z   # deploy oldidagi restore point
```

`restore.sh`: backup'ni **yangi volume**ga tiklaydi va WAL'ni nishongacha o'ynatadi (jonli
baza bu vaqtda ishlashda davom etadi), keyin domen nomini yozib tasdiqlashni so'raydi, api va
worker'ni to'xtatadi (nginx 503 qaytaradi), Postgres'ni yangi volume'ga o'tkazadi
(`PGDATA_VOLUME` env faylga yoziladi), ilovani qayta yoqadi va yangi timeline'da to'liq
backup oladi. Eski volume o'chirilmaydi (`docker volume rm` qo'lda).

Qo'lda (skriptsiz) tiklash: `RESTORE_VOLUME=<yangi> docker compose ... run --rm pg-restore
--time "..." --start --check`, keyin `PGDATA_VOLUME=<yangi>` bilan `up -d postgres`.

## 6. Oylik tiklash mashqi

Har oyning birinchi dushanbasi staging'da:

1. `make staging-refresh` — skript oxirida `DRILL ... restore Ns, total Ns` va oxirgi prod
   commit vaqtini chiqaradi; natija `nginx/.deploy/staging/drills` ga yoziladi.
2. Staging'da login (`seeker@demo.uz` yoki istalgan `user-…@staging.invalid` / `Secret123`),
   vakansiya qidiruvi, bitta ariza va chat xabari tekshiriladi.
3. Qabul: tiklash ≤ 1 soat (RTO), ma'lumotlar yoshi ≤ 5 daqiqa (RPO; yuklama ostida).
4. Natijani quyidagi jadvalga yozing.

| Sana | Kim | Backup hajmi | Tiklash | Jami | Oxirgi commit yoshi | Izoh |
|---|---|---|---|---|---|---|
| 2026-09-24 | Claude (lokal, PG16 + MinIO) | 157 MB DB → 52 MB | 4–6 s | — | 61 s (`archive_timeout` 60 s) | PITR vaqt nishoni: nishondan keyingi yozuvlar yo'q, oldingilari bor — tekshirildi |

Mahalliy mashq tezligi (~40 MB/s siqilgan) bo'yicha 20 GB baza + bir kunlik WAL taxminan
10–20 daqiqada tiklanadi; haqiqiy raqam offsite S3 tezligiga bog'liq, shuning uchun mashq
staging'da, haqiqiy backup bilan o'tkaziladi.

## 7. Sertifikatlar

`make cert` birinchi sertifikatni oladi: `CLOUDFLARE_API_TOKEN` bo'lsa DNS-01 (Cloudflare
proksisi ortida ham, DNS hali serverga qaramasa ham ishlaydi), aks holda HTTP-01 (80-port).
`certbot` konteyneri kuniga 2 marta `certbot renew` qiladi, nginx har 6 soatda `jv-reload`
qiladi (`nginx -t` o'tmasa yuklamaydi). Sertifikat bo'lmaganda nginx o'zi imzolagan vaqtinchalik
sertifikat bilan ishga tushadi (log: `jv-tls: ... placeholder`).

```bash
docker compose ... exec nginx sh -c 'openssl x509 -in /etc/nginx/tls/fullchain.pem -noout -subject -enddate'
docker compose ... run --rm --entrypoint certbot certbot renew --force-renewal && docker compose ... exec nginx jv-reload
```

OCSP stapling yo'q: Let's Encrypt 2025 yilda OCSP'ni to'xtatgan. SSL Labs A+ uchun: TLS 1.2/1.3,
faqat ECDHE shifrlar, HSTS 2 yil + preload (`snippets/ssl.conf`, `security-headers.conf`).
Cloudflare proksisi yoqilgan bo'lsa SSL Labs Cloudflare'ning edge'ini baholaydi.
HSTS `includeSubDomains; preload` bilan yuboriladi: hstspreload.org'ga faqat barcha
subdomenlar (staging, pochta va h.k.) HTTPS'da ishlayotganiga ishonch hosil qilgandan keyin
yuboring — ro'yxatdan chiqish oylab davom etadi.

## 8. Haqiqiy IP va limitlar (SEC-02)

nginx `CF-Connecting-IP` ni faqat Cloudflare diapazonlaridan qabul qiladi
(`snippets/cloudflare-real-ip.conf`, har kuni host cron'i `update-cloudflare-ips` bilan
yangilanadi). API'ga `X-Real-IP` va `X-Forwarded-For` **qayta yoziladi** (klient yuborgani
tashlanadi), API esa ularni faqat front tarmog'idan (`HTTP_TRUSTED_PROXIES`) qabul qiladi.
nginx limitlari: `/api/` 30 r/s + burst 60 (IP bo'yicha), SSR sahifalar 20 r/s + burst 80,
S3'ga yuklash 5 r/s, WebSocket IP'ga 300 ta ulanish (CGNAT).

## 9. Nosozliklar

**Sayt sekin.**
1. nginx log (JSON, bir qator = bir so'rov):
   `docker compose --env-file .env.production -f nginx/docker-compose.prod.yml logs --no-log-prefix --since 15m nginx | grep '^{' | jq -c 'select(.rt > 0.5)'` — `urt`
   (upstream vaqti) va `cache` (HIT/MISS/BYPASS). `rt` katta, `urt` kichik → tarmoq/klient.
2. API: `http_request_duration_seconds` (route bo'yicha, `:9091/metrics`), log'dagi `took`,
   `request_id` bilan nginx log'iga bog'lanadi.
3. Postgres: sekin so'rovlar va rejalar log'da (`log_min_duration_statement` va `auto_explain`
   200 ms), eng og'irlari:
   `psql -U postgres -d jobvacancy -c "select calls, round(mean_exec_time::numeric,1) ms, left(query,120) from pg_stat_statements order by total_exec_time desc limit 15"`.
4. Qulflar: `select pid, wait_event_type, state, now()-query_start, left(query,80) from pg_stat_activity where state <> 'idle' order by 4 desc;`
5. Pool: `pgxpool_*` metrikalari; Postgres `max_connections=200` ≥ api 2×20 + worker 35 + zaxira.

**502/503.** `make ps-prod` — qaysi konteyner unhealthy; `docker compose ... exec nginx
jv-upstream status` — drenajda qolib ketgan instance bo'lsa `jv-upstream up api-1`. API 503
JSON (`service_unavailable`) — hamma api instance'lar ishlamayapti.

**Disk to'lmoqda.**
`df -h; docker system df`. Tez-tez sabablar: `pg_wal` o'syapti (arxiv ishlamayapti →
`make backup-status`, S3 kalitlari/tarmoq), eski image'lar (`docker image prune -a
--filter until=168h`), eski DB volume'lari restore'dan keyin (`docker volume ls`), konteyner
log'lari (json-file 5×20 MB bilan cheklangan), nginx keshi (`max_size` 1 GB + 2 GB).
`pg_wal` ni **hech qachon qo'lda o'chirmang**.

**Redis yiqildi.** `redis-cache` — faqat kesh: API keshsiz ishlaydi (sekinroq), qayta ishga
tushiring. `redis-state` — rate limit, OTP kodlar, token revocation, WS ticket, presence:
yiqilsa login/WS ishlamaydi. `docker compose ... up -d redis-state`; AOF'dan tiklanadi.
`maxmemory` ga yetsa (noeviction) yozishlar xato beradi: `redis-cli info memory`, keyin
`REDIS_STATE_MAXMEMORY` ni oshiring.

**Postgres ishga tushmayapti.** `make logs-production s=postgres`. Ma'lumotlar buzilgan bo'lsa —
§5 bo'yicha yangi volume'ga tiklash (eski volume tegmaydi).

**WebSocket.** `/api/v1/ws` `proxy_read_timeout 1h`. nginx reload'da eski worker'lar WS'ni 30 s
(`worker_shutdown_timeout`) ushlab turadi, keyin yopadi; klient qayta ulanadi va o'tkazib
yuborilgan xabarlarni oladi.

## 10. CI/CD sozlamalari

`.github/workflows/deploy.yml`: `infra-lint` (compose config, shellcheck, `nginx -t`, Postgres
image'i prod config bilan ishga tushadi, migratsiyalar superuser bo'lmagan rol bilan up/down/up)
→ `images` (4 ta image, GHCR, BuildKit kesh) → `deploy-staging` → `deploy-production`.

Repo sozlamalari: **variables** `STAGING_HOST`, `PRODUCTION_HOST`, `DEPLOY_USER` (deploy),
`DEPLOY_PATH` (/opt/jobvacancy), `VITE_GOOGLE_CLIENT_ID`; **secrets** `STAGING_SSH_KEY`,
`STAGING_KNOWN_HOSTS`, `PRODUCTION_SSH_KEY`, `PRODUCTION_KNOWN_HOSTS` (`ssh-keyscan <host>`);
**environments** `staging`, `production` (production'ga "Required reviewers"). Prod deploy:
Actions → deploy → Run workflow → production.

## 11. Sirlar va rotatsiya

- JWT: joriy juftlikni `JWT_PREVIOUS_SECRET/JWT_PREVIOUS_KID` ga o'tkazing, yangi
  `JWT_SECRET/JWT_KID` qo'ying, `make deploy`; 15 daqiqadan keyin previous'ni tozalang.
- MinIO ilova foydalanuvchisi (`S3_ACCESS_KEY`) faqat `jv-public`/`jv-private` ga ega
  (`minio-init` har deploy'da yangilaydi); root kalitlari API'ga berilmaydi.
- `.env.production` 600 huquq bilan, repoga tushmaydi (`.gitignore`).
- MinIO community image'lari endi chiqarilmaydi: compose oxirgi hotfix build'ni digest bilan
  mahkamlaydi. Yangilash rejasi: manba koddan build yoki S3-mos muqobil (SeaweedFS, Garage).
