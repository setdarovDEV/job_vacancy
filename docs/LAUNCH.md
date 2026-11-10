# Launch settings

Integrations added for launch. Every one is **off until its variable is set**, so local
development needs none of them. Values live in `nginx/.env` on the server.

## Backend (api and worker containers)

| Variable | Default | What it does |
|---|---|---|
| `HTTP_TRUST_PROXY` | `false` | Read the visitor address from `X-Forwarded-For`. Only hops from loopback/private peers are trusted (Caddy and the web container); the right-most public address wins, so a forged left entry is ignored. Must be `true` behind Caddy, or every visitor shares one rate-limit bucket. |
| `ADMIN_2FA_REQUIRED` | `true` | Administrators must turn on two-factor sign-in (TOTP) before `/admin` answers (otherwise 403 `two_factor_setup_required`, and the web shows enrollment). The API refuses to start with `false` when `APP_ENV=production`. Local `.env` sets `false` so e2e suites can sign admins in with a password. |
| `TOTP_ENC_KEY` | — | ≥32 bytes, **required in production and must differ from `JWT_SECRET`** (the API refuses to start otherwise). Encrypts TOTP secrets at rest (AES-256-GCM, HKDF). Keep it stable: changing it disables everyone's 2FA. Development falls back to a key derived from `JWT_SECRET`, with a warning. Generate: `openssl rand -base64 48`. |
| `TURNSTILE_SECRET_KEY` | — | Cloudflare Turnstile secret. When set, web requests to register, login, forgot password, feedback and reports need a valid `X-Turnstile-Token`. Production logs a warning at startup while it is unset. |
| `TURNSTILE_HOSTNAME` | host of `WEB_URL` | Host the token must have been solved on (siteverify `hostname`); a token from another site using the same key is refused. `*` turns the check off (needed with Cloudflare's test keys, which answer `example.com`). |
| `FEEDBACK_TELEGRAM_CHAT_ID` | — | Team chat that gets each new feedback message. Needs `TELEGRAM_BOT_TOKEN`, on **both api and worker** (the API queues a job, the worker sends it with retries); the bot must be a member of the chat (group ids are negative). |
| `SENTRY_DSN` | — | Backend errors to Sentry: every error-level log (unhandled API errors → 500, recovered panics, failing jobs). Sent: the masked message, the error type and masked text (emails, phone numbers, IPs replaced) and an allow-list of attributes (request_id, method, path, status, job, stack…). Never request data, headers, cookies or user fields. |
| `SENTRY_RELEASE` | — | Release tag on Sentry events; set it to the image tag (`IMAGE_TAG`). `APP_ENV` is the environment. |

## Web container

The web server reads these at request time (root loader → browser), so one image serves every
environment. Full list the web container needs:

| Variable | Status | What it does |
|---|---|---|
| `API_URL` | existing | API base for server-side rendering (`http://api:8090/api/v1`). |
| `SITE_NOINDEX` | existing | `1` hides the site from search engines. |
| `TURNSTILE_SITE_KEY` | new | Turnstile site key; shows the widget on the forms above. Set together with the backend's `TURNSTILE_SECRET_KEY`. |
| `SENTRY_DSN_WEB` | new | Browser errors to Sentry (a separate project from the API). The SDK is a lazy chunk, loaded only when this is set. |
| `SENTRY_RELEASE` | new | Same image tag as the backend. |
| `SENTRY_ENVIRONMENT` | new, optional | Defaults to `NODE_ENV` (`production`). |
| `GA4_ID` | new | Google Analytics 4 measurement id (`G-…`). Loaded only after the visitor clicks "accept all" in the cookie banner; "Cookie settings" in the footer withdraws consent, which stops sending and deletes the `_ga` cookies. Page views are sent on every client-side navigation. |

The server compose file (`deploy/docker-compose.server.yml`) passes only `API_URL` and
`SITE_NOINDEX` to the web service today; the new variables have to be added there.

## Turnstile details

- **Where:** register, login, forgot password, feedback, reports. Not on Google sign-in (Google's
  token already proves a person), refresh, logout or the 2FA step.
- **Login:** always, not "after N failures". With the managed widget in `interaction-only` mode
  most visitors never see a challenge, and a failure counter would need per-account state that an
  attacker rotating accounts sidesteps anyway; password guessing is also limited per IP (30/min).
- **Mobile apps** (`X-Client-Type: android|ios`) have no widget and skip the check. That header is
  spoofable, so each endpoint gives app requests its own per-IP backstop, on top of the limits
  everyone gets. Trade-off: a bot claiming to be the app is held by these limits instead of a
  CAPTCHA.

  | Endpoint | Everyone | App requests, extra per-IP backstop |
  |---|---|---|
  | `POST /auth/login` | 30/min per IP; 10 per 15 min per email | 20 per 10 min |
  | `POST /auth/register` | 30/min per IP; 5 per hour per email | 10 per hour |
  | `POST /auth/password/forgot` | 30/min per IP; 5 per hour per email (also for unknown addresses) | 10 per hour |
  | `POST /feedback` | 5 per hour per IP | 5 per hour |
  | `POST /reports` | 10 per hour per user | 30 per hour |
- **Hostname:** tokens must come from `TURNSTILE_HOSTNAME` (default: the `WEB_URL` host).
- **Fail closed:** if Cloudflare can't be reached the API answers 503 `captcha_unavailable`.
- **Local testing:** Cloudflare's test keys — site key `1x00000000000000000000AA` with secret
  `1x0000000000000000000000000000000AA` always pass (`2x0000000000000000000000000000000AA` always
  fails); set `TURNSTILE_HOSTNAME=*` with them. Leave all unset for normal development.

## Admin 2FA

- Enroll: Settings → "Ikki bosqichli kirish" (admins only), or the enrollment screen `/admin`
  shows while it's required. Scan the QR (or type the key), confirm a code, save the 10
  recovery codes (shown once; copy or download as .txt). Confirming signs out every other
  session of the account; the current one counts as verified.
- Sign-in with 2FA on: password (or Google) → 202 with a challenge (5 min, 5 attempts) → code
  or recovery code (exactly one) at `POST /auth/two-factor/verify`. Codes can't be replayed.
- **Per session:** a session remembers that it proved the second factor (`user_sessions.mfa_at`,
  kept across refreshes). With 2FA on, `/admin` needs such a session (else 403
  `two_factor_session_required`, the web offers "sign in again"); a session from before 2FA was
  turned on never qualifies.
- Regenerate codes / turn off: password (if the account has one) plus a code **or a recovery
  code** (lost phone: turn it off with a recovery code, then enroll again). Any failure answers
  `reauth_failed`; wrong passwords and codes share one budget per user (10 per 15 minutes, then
  429), counted before checking so parallel guesses can't exceed it. Turning off signs out the
  account's other sessions.
- Mobile app: an account with 2FA gets a clear "administrators sign in on the website" message.

### Operator commands (on the server)

```bash
# on the server (the api image ships /app/ctl)
cd /opt/jobvacancy
ctl() { IMAGE_TAG=$(cat deploy/.image-tag) docker compose -p jobvacancy \
  -f nginx/docker-compose.prod.yml -f deploy/docker-compose.server.yml \
  run --rm --no-deps --entrypoint /app/ctl api "$@"; }

ctl two-factor enroll admin@demo.uz           # first enrollment
ctl two-factor enroll admin@demo.uz --force   # replace an existing one
ctl two-factor reset admin@demo.uz            # lost phone and recovery codes

# locally: ./bin/ctl two-factor enroll you@example.com
```

- `enroll` (admins only) turns 2FA on without the app round trip and prints, once, to stdout:
  the `otpauth://` URI (make a QR: `qrencode -t ANSIUTF8 '<uri>'`, or paste the key into the
  app) and 10 recovery codes. It refuses when 2FA is already on unless `--force`, which replaces
  the secret and the codes. Hand the output over privately and don't keep it.
- `reset` turns 2FA off and deletes the recovery codes.
- Both sign the user out of every session and write a JSON audit line to stderr
  (`audit: two-factor …`, user id, email, operator from `$SUDO_USER`/`$USER`); the secret is
  never logged.
- `ctl totp <secret>` prints the current code (refuses in production); used by e2e tests.

## Feedback

Footer → "Fikr bildirish": category (bug / idea / other), message (5–2000 characters after
trimming), optional contact; the page URL and, when signed in, the account are attached. The URL
is kept only when it is an absolute http(s) link on the `WEB_URL` host, otherwise stored as null;
the admin queue links it only when it is on the same origin. 5 per hour per IP. Admins read and mark them
handled in `/admin/feedback`; the overview shows the unhandled count.
