---
name: redesign
description: Redesign one page, route or shared component of jobvacancy.uz to the Samarkand Glass premium standard (Liquid Glass). Invoke as /jobvacancy:redesign <route-or-component>, e.g. "/vacancies", "home", "Button", "employer dashboard".
argument-hint: <route | component | "all">
disable-model-invocation: true
---

# Redesign: $ARGUMENTS

Target: bring **$ARGUMENTS** to the premium Samarkand Glass standard with zero regressions.

1. **Load the system.** Invoke/read the `premium-ui` skill and the references it points to
   (`app.css`, `liquid-glass.md`, `components.md`, `pages.md`, `motion-and-states.md`,
   `polish-checklist.md`). If `web/app/styles/app.css` lacks `--glass-panel`, stop and do TZ task
   UI-01 (token migration) first, then continue.
2. **Map the target.** Resolve `$ARGUMENTS` to files (routes in `web/app/routes.ts`, components in
   `web/app/shared/ui`). If it is `all`, follow the TZ order: shell (header/footer/tab bar) →
   shared components → home → vacancies → vacancy → auth → companies/company → employers →
   account → employer → chat → static/404. Do one target per commit.
3. **Audit before editing** (write it down in your reply, briefly): current structure, states
   present/missing, token violations, duplicated patterns, a11y issues, mobile issues — compared
   with the recipe in `pages.md`/`components.md`.
4. **Plan** the new structure per breakpoint (360 / 768 / 1280) and per state (loading, empty,
   error, success). Name the shared components you will reuse or extract.
5. **Implement:** shared primitives first (with `/ui` showcase entries), then the page. Keep data
   loading, URLs, analytics and API calls behaviorally identical unless the TZ says otherwise.
   Add i18n keys to all 4 locales.
6. **Verify:** `cd web && pnpm typecheck && pnpm build`, i18n key test, bundle budget, relevant
   Playwright script(s) in `web/test/` if the stack is running, screenshots at 390 & 1360 px in
   light and dark when a browser is available.
7. **Polish pass:** walk `polish-checklist.md` item by item; fix misses.
8. **Hand off:** summary of changes, screenshots paths, checklist result, follow-ups. Suggest the
   `ui-reviewer` agent for an independent review of the diff.
