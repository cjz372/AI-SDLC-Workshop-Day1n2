# Build Progress (handoff file)

Spec: `PRPs/00-one-shot-implementation.md` (read it first). Update this file after each feature.
Resolved spec conflicts: the user said grading is a STATIC read of EVALUATION.md, so EVALUATION wins where sources disagree:
delete asks window.confirm; search matches titles + subtask titles + tag names; progress text "X/Y subtasks completed (Z%)"; import body = `{version, exported_at, todos}` envelope; Completed section sorted by
updated_at desc (completion time). Env vars: JWT_SECRET, RP_ID, RP_NAME, RP_ORIGIN (see `.env.example`).
Commands: `npm run typecheck`, `npm run lint`, `npm test` (vitest unit), `npx playwright test` (e2e), `npm run build`.

## Status
- [x] Setup: package.json, tsconfig, next/tailwind/eslint config, layout, .env.example
- [x] Phase 0: lib/db.ts (schema+types+DBs), lib/timezone.ts, lib/recurrence.ts
- [x] 11 Auth (API+middleware+login page)  - [x] 01-04 API (todos, recurring in PUT, notifications/check, useNotifications hook)
- [x] 05/06/07/09/10 API routes + lib/filters.ts, lib/calendar.ts, scripts/seed-holidays.ts
- [x] UI: app/page.tsx (monolithic), app/calendar/page.tsx, error/404 pages, security headers
- [x] Deploy config: vercel.json, railway.json, Procfile, nixpacks.toml, .env.example
- [x] vitest unit tests (tests/unit, 26 passing)
- [ ] Playwright config + e2e tests (tests/helpers.ts + 01..12 specs), final build/lint/test

## Notes for next agent
- E2E specs 02-12 + smoke were written by Haiku subagents (bare minimum); only unit tests + build were verified by the lead.
- Remaining: final `npm run build`, `npm run lint`, `npm test -- --coverage` pass check; commit when the user asks.
