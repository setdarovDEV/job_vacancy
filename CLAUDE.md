# jobvacancy.uz — instructions for Claude Code

Monorepo: `backend/` (Go 1.27, chi, pgx+sqlc, Postgres 18, Redis, River, MinIO), `web/` (React 19,
React Router 8 SSR, Vite 8, Tailwind v4), `nginx/` (deploy), `docs/` (PLAN, DESIGN, TZ).

## Source of truth
- Work plan and acceptance criteria: `docs/TZ.md`. Implement tasks with `/jobvacancy:tz-task <ID>`
  and don't close a task without evidence for every ✅ line.
- UI standard: the `premium-ui` skill (Samarkand Glass + Liquid Glass). Always follow it for
  anything under `web/app`. Redesign screens with `/jobvacancy:redesign <target>`.
- Backend standard: the `fast-backend` skill for anything under `backend/`.

## Commands
```bash
make setup && make api && make worker && make web      # local stack (see README)
cd web && pnpm typecheck && pnpm build                  # web checks
node --experimental-strip-types --no-warnings web/test/i18n-keys.mjs
make -C backend sqlc && make -C backend test && (cd backend && go vet ./...)
make api-types                                          # after changing backend/api/openapi.yaml
```

## Rules of thumb
- Strings in 4 locales (`web/app/shared/i18n/messages/{uz,uz-Cyrl,ru,en}.ts`), uz.ts is typed source.
- Tokens only in UI; after each edit the plugin hook reports raw colors, `dark:`, arbitrary
  sizes/radii/shadows — fix what it reports before moving on.
- Keyset pagination, no N+1, every query indexed, deadlines on every request path.
- OpenAPI first; web types are generated and checked in CI.
- Small commits: `TZ <ID>: <summary>`. After UI work, ask the `ui-reviewer` agent to review.
- Reply to the user in Uzbek (Latin) unless they write in another language.
