---
name: tz-task
description: Implement one task from the jobvacancy.uz technical specification (docs/TZ.md) by its ID, e.g. /jobvacancy:tz-task UI-01 or /jobvacancy:tz-task BE-04, meeting every acceptance criterion.
argument-hint: <TASK-ID> [TASK-ID…]
disable-model-invocation: true
---

# TZ task: $ARGUMENTS

1. Open `docs/TZ.md` (if missing, ask the user to copy `TZ.md` from the plugin package into
   `docs/`). Find the section for **$ARGUMENTS**. Read its goal, requirements, acceptance criteria
   (✅ lines) and dependencies. If a dependency task isn't done (check git log and the code),
   say so and do the dependency first or stop and ask.
2. Load the matching skill: UI-*/PG-*/FE-* → `premium-ui`; BE-*/SEC-*/OPS-* → `fast-backend`;
   FN-*/QA-*/SEO-* touch both sides → load both and follow each for its part of the code.
3. Write a short plan: files to touch, migrations, API contract changes, i18n keys, tests.
4. Implement in small, reviewable steps. Keep behavior outside the task unchanged.
5. Prove every acceptance criterion: run the command, test, measurement or screenshot that shows
   it. Paste the evidence (numbers, test names) in the final report as a checklist.
6. Update `docs/TZ.md` status for the task (`[ ]` → `[x]`, with date) and `docs/PLAN.md` if a
   stage changes. Commit with message `TZ <ID>: <summary>`.
7. If something in the TZ is wrong or impossible, don't silently deviate: explain, propose the
   alternative, and mark the task `[~]` with a note.
