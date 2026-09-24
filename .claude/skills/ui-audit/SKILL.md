---
name: ui-audit
description: Audit jobvacancy.uz web UI (a route, component or the whole app) against the Samarkand Glass standard and produce a prioritized fix list without changing code. Invoke as /jobvacancy:ui-audit <target>.
argument-hint: <route | component | "all">
disable-model-invocation: true
---

# UI audit: $ARGUMENTS

Do not edit files. Read the `premium-ui` skill and its `polish-checklist.md`, then inspect the
target's files (for `all`: every route in `web/app/routes.ts` and `web/app/shared/ui/*`).

Also run the static scan (the same check the plugin hook uses). The script is `scripts/check-ui.mjs`
two folders above this SKILL.md (in the installed plugin); find it with Glob
`**/jobvacancy/scripts/check-ui.mjs` or `.claude/scripts/check-ui.mjs`:
```bash
node <path-to>/check-ui.mjs --scan web/app
```
Baseline at plugin creation (2026-09-24): 119 files, 133 violations (tracking 41, font-size 31,
radius 28, shadow 18, white/black 11, raw blur 4) + 15 outline-none warnings.

Output a report in this shape (Uzbek if the user writes Uzbek, otherwise English):

1. **Score** per area 0–5: Tokens · Material (glass) · States · Responsive · Accessibility ·
   i18n · Performance · SEO.
2. **Findings** table: `#`, severity (P0 broken / P1 visibly cheap or inaccessible / P2 polish),
   file:line, what's wrong, the fix (component/recipe to use), effort (S/M/L).
3. **Duplicated patterns** that should become shared components, with occurrence counts.
4. **Quick wins** (≤ 30 min each) and **the recommended order** for `/jobvacancy:redesign`.

Every finding must cite a file and line you actually read. No speculative findings.
