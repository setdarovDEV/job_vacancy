# Launch settings

Integrations added for launch. Every one is **off until its variable is set**, so local
development needs none of them. Values live in `nginx/.env` on the server.

## Backend (api and worker containers)

| Variable | Default | What it does |
|---|---|---|
| `HTTP_TRUST_PROXY` | `false` | Read the visitor address from `X-Forwarded-For`. Only hops from loopback/private peers are trusted (Caddy and the web container); the right-most public address wins, so a forged left entry is ignored. Must be `true` behind Caddy, or every visitor shares one rate-limit bucket. |
| `ADMIN_2FA_REQUIRED` | `true` | Administrators must turn on two-factor sign-in (TOTP) before `/admin` answers (otherwise 403 `two_factor_setup_required`, and the web shows enrollment). The API refuses to start with `false` when `APP_ENV=production`. Local `.env` sets `false` so e2e suites can sign admins in with a password. |
| `TOTP_ENC_KEY` | derived from `JWT_SECRET` | ≥32 bytes. Encrypts TOTP secrets at rest (AES-256-GCM, HKDF). If unset, a key is derived from `JWT_SECRET`, so rotating `JWT_SECRET` then disables everyone's 2FA; set this separately in production and keep it stable. |
| `TURNSTILE_SECRET_KEY` | — | Cloudflare Turnstile secret. When set, web requests to register, login, forgot password, feedback and reports need a valid `X-Turnstile-Token`. |
| `FEEDBACK_TELEGRAM_CHAT_ID` | — | Team chat that gets each new feedback message. Needs `TELEGRAM_BOT_TOKEN`, and the bot must be a member of the chat (group ids are negative). |
| `SENTRY_DSN` | — | Backend errors to Sentry: every error-level log (unhandled API errors → 500, recovered panics, failing jobs). Request data, headers, cookies and attributes such as password/token/email/phone/code are never sent. |
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
  spoofable, so those requests share a stricter per-IP budget instead (10 per 10 minutes per
  address across the guarded endpoints). Trade-off: a bot claiming to be the app gets 10 tries per
  10 minutes per IP rather than none.
- **Fail closed:** if Cloudflare can't be reached the API answers 503 `captcha_unavailable`.
- **Local testing:** Cloudflare's test keys — site key `1x00000000000000000000AA` with secret
  `1x0000000000000000000000000000000AA` always pass (`2x0000000000000000000000000000000AA` always
  fails). Leave both unset for normal development.

## Admin 2FA

- Enroll: Settings → "Ikki bosqichli kirish" (admins only), or the enrollment screen `/admin`
  shows while it's required. Scan the QR (or type the key), confirm a code, save the 10
  recovery codes (shown once; copy or download as .txt).
- Sign-in with 2FA on: password (or Google) → 202 with a challenge (5 min, 5 attempts) → code
  or recovery code at `POST /auth/two-factor/verify`. Wrong codes are also limited per user
  (10 per 15 min). Codes can't be replayed.
- Regenerate codes / turn off: password (if the account has one) + a current code.
- Lost phone and codes: an operator can clear it in the database
  (`DELETE FROM user_totp WHERE user_id = …; DELETE FROM user_recovery_codes WHERE user_id = …`).
- `bin/ctl totp <secret>` prints the current code (refuses in production); used by e2e tests.

## Feedback

Footer → "Fikr bildirish": category (bug / idea / other), message, optional contact; the page URL
and, when signed in, the account are attached. 5 per hour per IP. Admins read and mark them
handled in `/admin/feedback`; the overview shows the unhandled count.
