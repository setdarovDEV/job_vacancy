# Runbook: jobvacancy.uz production

> Bu hujjat serverni ko'tarish, deploy, rollback, backup'dan tiklash, monitoring va tez-tez
> uchraydigan nosozliklarni bartaraf etish uchun. Buyruqlar repo ildizidan (`/opt/jobvacancy`)
> ishga tushiriladi. TZ: OPS-01…OPS-09, SEC-08, QA-02.

## 0. Nosozlik bo'lganda: birinchi 15 daqiqa

1. **Alert qayerdan keldi?** Telegram xabarida alert nomi, `env` va `Runbook:` havolasi bor
   (§9 dagi bo'limga olib boradi). Tashqi tekshiruv (§10.6) ham xabar yuborsa, server yoki
   tarmoq butunlay ishlamayapti.
2. **Holat:** `make ps-prod` (qaysi konteyner unhealthy), `make monitoring-ps`.
3. **Grafana** (`ssh -L 3000:127.0.0.1:3000 deploy@app-1`, http://localhost:3000):
   *jobvacancy · RED* — xatolar va kechikish qaysi route'da; *USE* — CPU, xotira, disk,
   Postgres, Redis, River; *Business* — moderatsiya navbati, ro'yxatdan o'tishlar.
4. **So'nggi deploy aybdormi?** `tail -3 nginx/.deploy/production/history`. Muammo deploy'dan
   keyin boshlangan bo'lsa — darhol `make rollback` (yoki GitHub → Actions → deploy → Run
   workflow → `action: rollback`), keyin sababini qidiring.
5. **Xatoning o'zi:** GlitchTip (`ssh -L 8000:127.0.0.1:8000`, http://localhost:8000) — stack
   trace va request id; `make logs-production s=api-1 | grep <request id>`.
6. Hal bo'lgach: nima bo'ldi, qancha davom etdi, nima o'zgardi — qisqa yozuv (postmortem)
   va kerak bo'lsa alert/runbook'ni yangilang.

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

## 3. Deploy va rollback (OPS-06)

Odatiy yo'l — GitHub Actions (`.github/workflows/deploy.yml`):

| Hodisa | Nima bo'ladi |
|---|---|
| `main` ga push | infra lint → 4 ta image (BuildKit kesh, versiya va commit image ichida) → GHCR → **staging'ga avtomatik deploy** |
| PR + `staging` yorlig'i | o'sha PR staging'ga chiqadi |
| Actions → deploy → Run workflow → `production`, `deploy` | **production** — `production` environment reviewer'lari tasdiqlagach |
| Actions → deploy → Run workflow → `rollback` | tanlangan muhitda oldingi reliz (production tasdiq bilan) |

Staging deploy paytida CI runner'dan `k6/zero-downtime.js` (10 so'rov/s: API, SSR sahifalar)
fonda ishlaydi va **bitta 5xx yoki ulanish xatosi bo'lsa job qizil bo'ladi**. Server ichida ham
`deploy.sh` rolling davomida nginx orqali har 200 ms da so'rov yuboradi va natijani chiqaradi:
`availability probe: 1843 requests during the rolling restart, 0 errors` (staging'da
`DEPLOY_PROBE_STRICT=1` — xato bo'lsa deploy qizil).

Qo'lda (serverda):

```bash
git fetch && git checkout --force <commit>   # CI buni o'zi qiladi
make deploy TAG=sha-<commit>
```

`deploy.sh` tartibi: image'lar → infratuzilma (`--no-recreate`: Postgres, Redis, MinIO hech
qachon qayta yaratilmaydi) → **restore point** (`pg_create_restore_point`) → `migrate up` →
monitoring grant'lari (`nginx/postgres/monitoring.sql`) → api-1, api-2 → web-1, web-2 (har biri
avval nginx'da drenaj qilinadi: `jv-upstream down`, keyin qayta yaratiladi, `/readyz` 200
bo'lgach qaytariladi) → worker → nginx/certbot/pg-backup → smoke test (`/`, `/vacancies`,
`/api/v1/catalog/regions`) → monitoring sinxronlanadi (ishlayotgan bo'lsa). Migratsiya yiqilsa
hech narsa qayta ishga tushmaydi, eski reliz ishlashda davom etadi.

**Rollback — bitta buyruq:**

```bash
make rollback                          # oldingi reliz: uning image'lari va commit'i, migratsiyasiz
cat nginx/.deploy/production/history   # qaysi reliz qachon chiqqan (commit bilan)
make restore NAME=<restore point>      # migratsiyaning o'zini qaytarish kerak bo'lsa (§5)
```

`rollback.sh` oldingi relizning commit'ini `history` dan topib checkout qiladi (compose va
konfiglar o'sha relizniki bo'ladi; `ROLLBACK_KEEP_TREE=1` — joriy checkout qoladi), keyin xuddi
deploy kabi rolling qiladi, migratsiyalarsiz (ular additive: eski kod yangi sxemada ishlaydi).
Ikkinchi marta `make rollback` yana oldinga qaytaradi (previous ↔ current).

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

Har bir alert'ning `runbook` havolasi shu bo'limlardan biriga olib keladi.

### 9.1 Sayt sekin yoki 5xx

Alertlar: `ApiHigh5xxRate`, `ApiLatencyP95High`, `DbPoolSaturated`, `HostCpuHigh`,
`HostMemoryLow`, `PostgresConnectionsHigh`, `PostgresLongTransaction`, `ContainerOomKilled`.

1. **Qayerda?** Grafana → *RED*: "5xx by route", "Slowest routes (p95)", "Requests per API
   instance" (bitta instance tekis chiziq bo'lsa — drenajda yoki o'lik). Hammasi sekinmi yoki
   bitta route'mi?
2. **Kod xatosi** (5xx bitta route'da): GlitchTip'da shu vaqtdagi xato → request id →
   `make logs-production s=api-1 | grep <request id>`. Deploy'dan keyin boshlangan bo'lsa —
   `make rollback`.
3. **Resurs:** Grafana → *USE*: CPU/xotira (host va har bir servis), "DB pool in use", "DB pool
   acquire wait p95" (> 1 ms — so'rovlar ulanish kutyapti), Redis.
4. **nginx log** (JSON, bir qator = bir so'rov):
   `docker compose --env-file .env.production -f nginx/docker-compose.prod.yml logs --no-log-prefix --since 15m nginx | grep '^{' | jq -c 'select(.rt > 0.5)'` — `urt`
   (upstream vaqti) va `cache` (HIT/MISS/BYPASS). `rt` katta, `urt` kichik → tarmoq/klient.
5. **Postgres:** Grafana → *USE* → "Heaviest queries (pg_stat_statements)"; sekin so'rovlar va
   rejalar log'da (`log_min_duration_statement` va `auto_explain` 200 ms). Qo'lda:
   `psql -U postgres -d jobvacancy -c "select calls, round(mean_exec_time::numeric,1) ms, left(query,120) from pg_stat_statements order by total_exec_time desc limit 15"`.
6. **Qulflar va uzun tranzaksiyalar:**
   `select pid, wait_event_type, state, now()-xact_start, left(query,80) from pg_stat_activity where state <> 'idle' order by 4 desc;`
   — kerak bo'lsa `select pg_terminate_backend(<pid>);`.
7. **Pool byudjeti:** Postgres `max_connections=200` ≥ api 2×20 + worker 35 + exporterlar + zaxira.
   Pool to'lgan bo'lsa avval sekin so'rovni toping, `DB_MAX_CONNS` ni oshirish — oxirgi chora.
8. **OOM:** `ContainerOomKilled` — servisning xotira limiti (`docker-compose.prod.yml`) yoki
   leak; Grafana → *USE* → "Memory by service" trendini ko'ring.

### 9.2 502/503

Alertlar: `ApiInstanceDown`, `WorkerDown`, `SiteProbeFailed`, `SitePublicProbeFailed`,
`NginxDown`.

`make ps-prod` — qaysi konteyner unhealthy; `make logs-production s=api-1`.
`docker compose ... exec nginx jv-upstream status` — drenajda qolib ketgan instance bo'lsa
`jv-upstream up api-1`. API 503 JSON (`service_unavailable`) — hamma api instance'lar
ishlamayapti. Faqat `SitePublicProbeFailed` (origin probe yashil) — muammo Cloudflare, DNS
yoki firewall'da: Cloudflare dashboard, `dig jobvacancy.uz`, `ufw status`. `WorkerDown` —
email, bildirishnoma va ogohlantirishlar navbatda qoladi (§9.7), sayt ishlaydi.

### 9.3 Disk to'lmoqda

Alertlar: `DiskSpaceLow` (> 80 %), `DiskSpaceCritical` (> 90 %), `DiskWillFillIn24h`.

`df -h; docker system df`. Tez-tez sabablar:
- `pg_wal` o'syapti — WAL arxivi ishlamayapti (`WalArchiveFailing` ham keladi) →
  `make backup-status`, S3 kalitlari/tarmoq. **`pg_wal` ni hech qachon qo'lda o'chirmang.**
- eski image'lar: `docker image prune -a --filter until=168h`;
- restore'dan keyin qolgan eski DB volume'lari: `docker volume ls` (ishonch hosil qilib `rm`);
- Prometheus ma'lumotlari: `PROMETHEUS_RETENTION_SIZE` (8 GB) bilan cheklangan;
- konteyner log'lari json-file 5×20 MB bilan cheklangan; nginx keshi `max_size` 1 GB + 2 GB;
- MinIO (foydalanuvchi fayllari) — Grafana'da MinIO disk; o'sish tabiiy bo'lsa diskni kengaytiring.

### 9.4 Redis yiqildi

Alertlar: `RedisDown`, `RedisStateMemoryHigh`.

- `redis-state` (noeviction + AOF): rate limit, OTP kodlar, token revocation, WS ticket,
  presence, pub/sub, keshlar (API hozircha bitta `REDIS_URL` ishlatadi). Yiqilsa login, kodlar,
  chat real-time ishlamaydi. `docker compose ... up -d redis-state` — AOF'dan tiklanadi.
  `maxmemory` ga yetsa (noeviction) yozishlar xato beradi: `docker compose ... exec redis-state
  redis-cli info memory`, katta kalitlar: `redis-cli --bigkeys`; keyin `REDIS_STATE_MAXMEMORY`
  ni oshiring va `make deploy`.
- `redis-cache` (allkeys-lru, disposable): hozircha API'ning keshlari ham redis-state'da;
  `REDIS_CACHE_URL` ga o'tkazilgach, bu instance yiqilsa sayt faqat sekinlashadi.

### 9.5 WebSocket

`/api/v1/ws` `proxy_read_timeout 1h`. nginx reload'da eski worker'lar WS'ni 30 s
(`worker_shutdown_timeout`) ushlab turadi, keyin yopadi; klient qayta ulanadi va o'tkazib
yuborilgan xabarlarni oladi. Ulanishlar soni: Grafana → *RED* → "nginx connections".

### 9.6 Postgres ishga tushmayapti

Alertlar: `PostgresDown`, `ReplicationLagging`.

`make logs-production s=postgres`. Disk to'lganmi (§9.3)? Ma'lumotlar buzilgan bo'lsa — §5
bo'yicha yangi volume'ga tiklash (eski volume tegmaydi).

### 9.7 Navbat (River)

Alertlar: `RiverQueueBacklog` (> 1000), `RiverQueueStuck` (eng eski ish > 10 daq),
`RiverJobsDiscarded`.

1. Worker tirikmi: `make ps-prod`, `make logs-production s=worker` (`WorkerDown` ham keladi).
2. Grafana → *USE* → "River jobs waiting / running", "River jobs finalized (5 m)": qaysi
   `kind` ko'p yoki xato bilan tugayapti.
3. Qaysi ish yiqilyapti va nima uchun:
   `psql -U postgres -d jobvacancy -c "select kind, state, count(*) from river_job where state in ('retryable','discarded') group by 1, 2 order by 3 desc"`,
   oxirgi xatolar: `... -c "select id, kind, attempt, errors[array_length(errors, 1)]->>'error' from river_job where state = 'retryable' order by id desc limit 10"`.
4. Tashqi servis (SMTP, Telegram) ishlamasa ishlar `retryable` bo'lib qayta uriniladi; servis
   tiklangach navbat o'zi tozalanadi. Worker sekin bo'lsa — `WORKER_DEFAULT_WORKERS` ni oshiring
   (DB pool byudjetini hisobga oling).

### 9.8 Ilova xatolari (GlitchTip)

Yangi xato GlitchTip'da issue bo'lib paydo bo'ladi (Go: panic va 5xx, worker xatolari; web:
brauzer xatolari source map bilan). Issue'dagi `request_id` bo'yicha log'ni toping. Release
(`sha-<commit>`) qaysi deploy'da boshlanganini ko'rsatadi.

## 10. Monitoring va alertlar (OPS-04, OPS-05)

`monitoring/docker-compose.monitoring.yml` — ilova stekidan alohida compose loyihasi
(`jobvacancy-monitoring`), o'sha `.env.production` ni o'qiydi va ilovaning `front`/`back`
tarmoqlariga ulanadi. UI'lar faqat `127.0.0.1` da: SSH tunnel orqali.

| Komponent | Nima uchun |
|---|---|
| Prometheus (15 kun, 8 GB) | API/worker metrikalari, exporterlar, alert qoidalari (`monitoring/prometheus/rules`) |
| Alertmanager | hamma alert → bitta Telegram chat; critical 10 s ichida, har soatda takror |
| Grafana | *RED*, *USE*, *Business* dashboard'lari (`monitoring/grafana/dashboards`, generator: `generate-dashboards.py`) |
| node-exporter, cAdvisor | host va har bir konteyner (CPU, xotira, disk, OOM) |
| postgres-exporter, sql-exporter | Postgres statistikasi, WAL arxivi; River navbati, moderatsiya, ro'yxatdan o'tish, backup'lar (`monitoring/sql-exporter/*.collector.yml`) |
| redis-exporter, nginx-exporter | ikkala Redis; nginx ulanishlari |
| blackbox-exporter | sayt nginx orqali (origin, sertifikat muddati) va Cloudflare orqali |
| GlitchTip | Go va web xatolari (Sentry protokoli) |

### 10.1 Birinchi ishga tushirish

1. `.env.production` da monitoring bo'limini to'ldiring (`MONITORING_DB_PASSWORD`,
   `GRAFANA_ADMIN_PASSWORD`, `ALERT_TELEGRAM_*`, `GLITCHTIP_*`), keyin `make deploy` (monitoring
   roli paroli va grant'lar qo'llanadi).
2. Telegram: @BotFather'da bot yarating, on-call guruhga qo'shing, guruhga bitta xabar yozing,
   `https://api.telegram.org/bot<token>/getUpdates` dan `chat.id` ni (manfiy son) oling.
3. `ufw allow from 10.250.30.0/24 to 10.250.30.1 port 9100 proto tcp` (node-exporter host
   tarmog'ida, faqat monitoring tarmog'i shlyuzida tinglaydi).
4. `make monitoring-up` → `make alert-drill` (Telegram'ga test alert keladi, vaqti chiqadi).
5. GlitchTip: `make glitchtip-admin` → http://localhost:8000 → organizatsiya `jobvacancy`,
   loyihalar `go` va `web`. DSN'larni `.env.production` ga yozing:
   `SENTRY_DSN=http://<key>@glitchtip:8000/<go id>` (ichki tarmoq),
   `VITE_SENTRY_DSN=https://<key>@jobvacancy.uz/errors/<web id>` (nginx `/errors/` orqali, same
   origin; faqat ingest endpoint'lari ochiq, 2 so'rov/s IP'ga) va GitHub variable
   `VITE_SENTRY_DSN`; source map uchun GitHub secret `GLITCHTIP_AUTH_TOKEN` + variable
   `GLITCHTIP_URL`. `make deploy`.
6. healthchecks.io'da "period 1 min, grace 5 min" check → `ALERT_WATCHDOG_URL`: Alertmanager
   har daqiqada ping yuboradi, to'xtasa (monitoring o'lgan) — tashqaridan xabar keladi.

Ikki serverli variantda db-1 da faqat node-exporter kerak
(`docker compose -p jobvacancy-monitoring ... up -d node-exporter` shu faylning o'zi bilan),
app-1 da `NODE_EXPORTER_EXTRA_TARGETS=<db-1 private IP>:9100`.

### 10.2 Alertlar

| Alert | Chegara | Bo'lim |
|---|---|---|
| ApiHigh5xxRate | 5xx > 1 % (≥ 3 ta), 1 daq | §9.1 |
| ApiLatencyP95High | p95 > 200 ms, 5 daq | §9.1 |
| ApiInstanceDown / WorkerDown | scrape yo'q 1 / 2 daq | §9.2 |
| SiteProbeFailed / SitePublicProbeFailed | origin 1 daq / Cloudflare 3 daq | §9.2 |
| DiskSpaceLow / Critical / WillFillIn24h | > 80 % / > 90 % / 24 soatda to'ladi | §9.3 |
| WalArchiveFailing / WalArchiveStalled | arxiv xatosi / 15 daq arxiv yo'q | §5 |
| BackupFailed / BackupTooOld / BackupNeverRecorded | oxirgi backup xato / > 26 soat / umuman yo'q | §5 |
| ReplicationLagging | replika > 60 s orqada | §9.6 |
| RiverQueueBacklog / RiverQueueStuck / RiverJobsDiscarded | > 1000 / > 10 daq / ≥ 10 soatiga | §9.7 |
| CertificateExpiresSoon / VerySoon | < 14 / < 5 kun | §7 |
| RedisDown / RedisStateMemoryHigh | 1 daq / > 85 % maxmemory | §9.4 |
| PostgresDown, DbPoolSaturated, PostgresConnectionsHigh, PostgresLongTransaction, HostCpuHigh, HostMemoryLow, ContainerOomKilled, NginxDown, ExporterDown | — | §9 |

Qoidalar `promtool test rules` bilan sinovdan o'tadi (`monitoring/prometheus/tests`,
`make monitoring-lint`, CI). Qoida yoki dashboard o'zgargach: `make deploy` (yoki
`make monitoring-reload`) — konfiglar checkout'dan o'qiladi.

### 10.3 Alert mashqi (launch checklist: "sun'iy xatoda alert ≤ 2 daqiqa")

```bash
make alert-drill       # sintetik critical alert → Telegram (marshrut va bot tekshiruvi)
make alert-drill-api   # api-2 nginx'da drenaj qilinadi va to'xtatiladi (api-1 xizmat qiladi),
                       # ApiInstanceDown vaqti o'lchanadi, api-2 qaytariladi
```

Byudjet: scrape 15 s + baholash 15 s + `for: 1m` + group_wait 10 s ≈ 1 daq 40 s. Mahalliy
mashq (2026-09-24, haqiqiy Prometheus + Alertmanager, Telegram API mock): sun'iy 5xx
boshlanganidan **104 s** da `ApiHigh5xxRate`, instance o'chirilganidan **73 s** da
`ApiInstanceDown` Telegram'ga yetdi.

### 10.4 Metrikalar qayerdan

API `:9091/metrics`, worker `:9092/metrics` (faqat back tarmog'ida, nginx orqali emas):
`http_requests_total{route,method,status}`, `http_request_duration_seconds`, `db_pool_*`,
`redis_pool_*`, `respcache_*`. River va biznes metrikalari SQL orqali (`jv_*`), monitoring roli
faqat kerakli ustunlarni o'qiydi (ism, email, telefon, matn yo'q). Backup natijalari
`jv_ops.backup_runs` jadvalida (pg-backup yozadi).

### 10.5 GlitchTip

Ingest: brauzer → `https://<sayt>/errors/api/<id>/envelope/` → nginx → `glitchtip:8000`
(GlitchTip ishlamasa nginx 204 qaytaradi — xato hisobotlari yo'qoladi, sayt ta'sirlanmaydi).
Hodisalar 30 kun saqlanadi. Yangi foydalanuvchi: `make glitchtip-admin` yoki UI'dan taklif.

### 10.6 Tashqi uptime

Server ichidagi monitoring server o'lganini ko'ra olmaydi. Shuning uchun:
- **UptimeRobot yoki Better Stack** (1 daqiqalik tekshiruv): `https://jobvacancy.uz/` va
  `https://jobvacancy.uz/api/v1/catalog/regions`, xabar Telegram guruhga;
- `.github/workflows/uptime.yml` — har 10 daqiqada GitHub tarmog'idan sayt, API va sertifikat
  (variable `PUBLIC_URL`, secrets `UPTIME_TELEGRAM_BOT_TOKEN`, `UPTIME_TELEGRAM_CHAT_ID`);
- Alertmanager Watchdog → healthchecks.io (§10.1-6): monitoring o'lsa ham xabar keladi.

## 11. CI/CD sozlamalari

Workflow'lar: `backend.yml` (vet, test -race, sqlc diff, migratsiyalar up/down/up), `web.yml`
(API tiplari, typecheck, i18n, build, bundle byudjeti), `security.yml` (§13), `e2e.yml` (§14),
`deploy.yml` (§3), `uptime.yml` (§10.6).

`deploy.yml`: `infra-lint` (compose config, shellcheck, `nginx -t`, Postgres image'i prod config
bilan ishga tushadi, migratsiyalar superuser bo'lmagan rol bilan up/down/up, monitoring lint)
→ `images` (4 ta image, GHCR, BuildKit kesh, `VERSION`/`COMMIT` ldflags va OCI label'lar; web
source map'lari GlitchTip'ga yuklanib image'dan o'chiriladi) → `deploy-staging` (k6 fonda) →
`deploy-production` → `rollback`.

Repo sozlamalari: **variables** `STAGING_HOST`, `PRODUCTION_HOST`, `DEPLOY_USER` (deploy),
`DEPLOY_PATH` (/opt/jobvacancy), `VITE_GOOGLE_CLIENT_ID`, `VITE_SENTRY_DSN`, `GLITCHTIP_URL`,
`STAGING_URL`, `PUBLIC_URL`; **secrets** `STAGING_SSH_KEY`, `STAGING_KNOWN_HOSTS`,
`PRODUCTION_SSH_KEY`, `PRODUCTION_KNOWN_HOSTS` (`ssh-keyscan <host>`), `GLITCHTIP_AUTH_TOKEN`,
`STAGING_BASIC_AUTH` (`user:parol`, staging basic auth bo'lsa k6 uchun),
`UPTIME_TELEGRAM_BOT_TOKEN`, `UPTIME_TELEGRAM_CHAT_ID`; **environments** `staging`,
`production` (production'ga "Required reviewers").

**Branch protection (main):** PR majburiy, quyidagi check'lar yashil bo'lmasa merge yo'q:
`backend / test`, `web / build`, `security / govulncheck`, `security / pnpm-audit`,
`security / gitleaks`, `security / pins`, `e2e / browser`, `deploy / infra-lint`,
`deploy / images`. "Require branches to be up to date" yoqilgan.

## 12. Sirlar va rotatsiya

- JWT: joriy juftlikni `JWT_PREVIOUS_SECRET/JWT_PREVIOUS_KID` ga o'tkazing, yangi
  `JWT_SECRET/JWT_KID` qo'ying, `make deploy`; 15 daqiqadan keyin previous'ni tozalang.
- MinIO ilova foydalanuvchisi (`S3_ACCESS_KEY`) faqat `jv-public`/`jv-private` ga ega
  (`minio-init` har deploy'da yangilaydi); root kalitlari API'ga berilmaydi.
- `.env.production` 600 huquq bilan, repoga tushmaydi (`.gitignore`).
- MinIO community image'lari endi chiqarilmaydi: compose oxirgi hotfix build'ni digest bilan
  mahkamlaydi. Yangilash rejasi: manba koddan build yoki S3-mos muqobil (SeaweedFS, Garage).
- Monitoring: `GRAFANA_ADMIN_PASSWORD`, `ALERT_TELEGRAM_BOT_TOKEN`, `GLITCHTIP_SECRET_KEY` —
  `.env.production` da o'zgartiring va `make monitoring-up`. `MONITORING_DB_PASSWORD` —
  o'zgartirgach `make deploy` (rol paroli yangilanadi), keyin `make monitoring-up`.

## 13. Xavfsizlik tekshiruvlari (SEC-08)

`security.yml` har PR, `main` va har dushanba ishlaydi (yangi zaifliklar o'zgarmagan kodda ham
paydo bo'ladi):

| Job | Nima | Qizil bo'lsa |
|---|---|---|
| govulncheck | Go zaifliklari, faqat kodimiz chaqiradiganlari | modulni yangilang (`go get <mod>@<fix>`), `go mod tidy` |
| pnpm-audit | web production dependency'lari | `pnpm update <paket>` yoki `pnpm.overrides` |
| gitleaks | PR commit'lari va ishchi daraxtda sirlar | sirni **darhol almashtiring** (tarixdan o'chirish yetmaydi), keyin commit'ni tozalang; fixture bo'lsa `.gitleaks.toml` ga tor istisno |
| pins | image'lar digest bilan, action'lar commit SHA bilan (`nginx/scripts/check-pins.sh`) | tag + digest'ni birga yozing |

Dependabot (`.github/dependabot.yml`) haftada bir Go, npm, Actions, Dockerfile va compose
image'lari uchun guruhlangan PR ochadi; ular ham shu check'lardan o'tadi. Mahalliy:
`make security`, `make check-pins`.

## 14. E2E testlar (QA-02)

`e2e.yml`: production image'lari (api, worker, web) + Postgres 18, Redis, MinIO, Mailpit
`e2e/docker-compose.e2e.yml` da, `e2e/seed.sh` (demo akkauntlar, vakansiyalar e'lon qilinadi),
keyin:
- `e2e/a11y.mjs` — axe (WCAG 2.2 AA) ochiq sahifalarda 4 tilda va kabinet sahifalarida,
  yorug' **va** qorong'i mavzuda; **serious/critical = 0** talab qilinadi. Til smoke'i: HTTP 200,
  `<html lang>`, `<title>`, hreflang, ekranda tarjima qilinmagan kalit yo'q, konsolda xato yo'q,
  sahifa matni tillar orasida farq qiladi;
- mavjud `web/test/*.mjs` (browser-smoke, select, pickers, shots-c…f — Vite dev server'da,
  prod-check — production build'da).

Skrinshotlar va `a11y.json` — `e2e-reports` artifact'ida. Mahalliy:

```bash
make e2e-up && make e2e-seed && make e2e-a11y    # http://localhost:8080
make e2e-down
```
