# Task: P2-T028 — Integrate Pino Structured Logging

> **Canonical Status:** `✅ Done` (tracked authoritatively in parent phase file)  
> **Planning Gate:** Draft Plan → Human Approval → `🔄 In Progress` → `🕵️ Awaiting Human Review` → `✅ Done`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T028`
- **PRD / Requirement Reference:** `N/A` (tooling prerequisite; governance decision `DEC-024`)
- **ERD Reference:** `N/A`
- **Dependencies:** None

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

- Install `pino`, `pino-http` and `pino-pretty` (pino-pretty as dev dependency).
- Export a single shared logger instance from `src/app/config/logger.ts`.
- Support optional `LOG_LEVEL` env variable with NODE_ENV-based auto-fallback.
- Enable pino-pretty transport in development; raw JSON in production.
- Redact `req.headers.authorization`, `req.headers.cookie`, `res.headers['set-cookie']`, and credential request body fields.
- Mount `pino-http` globally in `app.ts` before all route handlers.
- Replace all `console.*` calls in `server.ts` and `globalErrorHandler.ts` with structured `logger.*` calls.
- Remove all `/* eslint-disable no-console */` directives from migrated files.
- Record `DEC-024` in `DECISIONS.md` and update all governance documents.

### Out of Scope

- Adding logger calls inside individual feature modules (beyond the two migrated files).
- Log aggregation, log shipping, or external log sink configuration.
- Per-module child loggers with custom bindings (future enhancement).

### Acceptance Criteria Mapping

| Acceptance Criterion                          | Planned Step | Verification                                      |
| :-------------------------------------------- | :----------- | :------------------------------------------------ |
| Packages installed correctly                  | Step 1       | `package.json` inspection, `pnpm build` pass      |
| Single logger instance from `logger.ts`       | Step 2       | Code review, TypeScript build pass                |
| `LOG_LEVEL` optional env field in `env.ts`    | Step 3       | `pnpm build` pass                                 |
| `pino-http` mounted globally in `app.ts`      | Step 4       | Manual HTTP request log inspection                |
| `server.ts` fully migrated, no `console.*`    | Step 5       | `pnpm lint` pass (no `no-console` violations)     |
| `globalErrorHandler.ts` fully migrated        | Step 6       | `pnpm lint` pass (no `no-console` violations)     |
| `pnpm build` passes                           | Step 7       | `pnpm build` → exit code 0                        |
| `pnpm lint` passes                            | Step 8       | `pnpm lint` → exit code 0                         |
| Governance documents updated                  | Step 9       | File inspection of DECISIONS.md, MEMORY.md, etc.  |

---

## 3. Verified Current Codebase State

_Read-only inspection findings before planning:_

- **Current Behavior / Gaps:** `server.ts` and `globalErrorHandler.ts` used raw `console.*` under `/* eslint-disable no-console */` directives. No structured logger existed. `DEC-013` previously deferred logging to project completion.
- **Existing Code Patterns to Follow:** Helper/utility export convention (`const x = ...; export { x };`). All config files live in `src/app/config/`. `env.ts` uses Zod strict validation with optional field support.
- **Related Existing Files:** `src/app/config/env.ts`, `src/app/config/auth.ts`, `src/app/config/prisma.ts`, `src/server.ts`, `src/app.ts`, `src/app/middleware/globalErrorHandler.ts`.

---

## 4. Implementation Approach

- **Applicable Architecture Flow:** Config layer only (`src/app/config/logger.ts` → consumed by `server.ts`, `app.ts`, `globalErrorHandler.ts`).
- **Data / Schema Impact:** None.
- **Public API / Contract Impact:** None (logging is internal infrastructure).
- **Security & Authorization Considerations:** Sensitive headers, cookies, query parameters, and structured credential fields are redacted or stripped across all environments; standard error diagnostics preserve error message and stack trace for runtime diagnosis, while application code strictly avoids embedding credentials in Error messages.

---

## 5. Affected Files & Directives

| Action     | File Path                                               | Responsibility                                     |
| :--------- | :------------------------------------------------------ | :------------------------------------------------- |
| `[NEW]`    | `src/app/config/logger.ts`                              | Shared Pino logger instance                        |
| `[MODIFY]` | `src/app/config/env.ts`                                 | Add optional `LOG_LEVEL` env field                 |
| `[MODIFY]` | `src/app.ts`                                            | Add `pino-http` middleware                         |
| `[MODIFY]` | `src/server.ts`                                         | Replace `console.*` with `logger.*`                |
| `[MODIFY]` | `src/app/middleware/globalErrorHandler.ts`              | Replace `console.error` with `logger.error`        |
| `[MODIFY]` | `docs/governance/DECISIONS.md`                          | Record `DEC-024`                                   |
| `[MODIFY]` | `docs/governance/MEMORY.md`                             | Update current state snapshot                      |
| `[MODIFY]` | `docs/governance/06-PHASE-ROADMAP.md`                   | Update Phase 2 current state                       |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`           | Add `P2-T028` task definition and index entry      |
| `[MODIFY]` | `docs/governance/03-CODING-STANDARDS.md`                | Update Section 16 (Logging)                        |
| `[NEW]`    | `docs/governance/tasks/phase-2/P2-T028-integrate-pino-structured-logging.md` | This file |

---

## 6. Step-by-Step Execution Plan

1. **Record DEC-024 in DECISIONS.md** — partial supersession of DEC-013 logging deferral.
2. **Update phase-2-auth-rbac.md** — add P2-T028 to task index (Order 0) and task definitions section.
3. **Update 06-PHASE-ROADMAP.md** — reflect P2-T028 as done.
4. **Update 03-CODING-STANDARDS.md** — rewrite Section 16 for Pino.
5. **Install packages** — `pnpm add pino pino-http && pnpm add -D pino-pretty`.
6. **Create `src/app/config/logger.ts`** — single shared logger instance.
7. **Update `src/app/config/env.ts`** — add optional `LOG_LEVEL` field.
8. **Update `src/app.ts`** — add `pino-http` middleware after CORS and request parsers, mounted before all route handlers.
9. **Update `src/server.ts`** — replace all `console.*` with `logger.*`, remove ESLint disable.
10. **Update `src/app/middleware/globalErrorHandler.ts`** — replace `console.error` with `logger.error`, remove ESLint disable.
11. **Update MEMORY.md** — current state snapshot.
12. **Run `pnpm build` and `pnpm lint`** — verify no errors.
13. **Manual verification** — inspect log output in dev mode.

---

## 7. Verification & Quality Gates

| Check                      | Required | Command or Method                               | Result  |
| :------------------------- | :------- | :---------------------------------------------- | :------ |
| Acceptance criteria        | `Yes`    | Code review + manual log inspection             | `PASS`  |
| Type check / build         | `Yes`    | `pnpm build`                                    | `PASS`  |
| Lint                       | `Yes`    | `pnpm lint`                                     | `PASS`  |
| Tests                      | `Yes`    | `pnpm test` (PASS: 5/5 tests in `logger.test.ts` via Vitest under DEC-025) | `PASS`  |
| Migration / data integrity | `No`     | No schema changes                               | `N/A`   |
| Manual verification        | `Yes`    | `pnpm dev` + HTTP request log inspection        | `PASS`  |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None
- **Design Assumptions Awaiting Approval:** None — all design decisions approved by human before execution.

---

## 9. Plan Review

| Field       | Value            |
| :---------- | :--------------- |
| Outcome     | `Approved`       |
| Reviewed by | Human (team)     |
| Reviewed on | `2026-09-19`     |
| Notes       | DEC-024 approved: Pino adopted immediately over Winston. LOG_LEVEL optional, pino-pretty in dev, JSON in prod, sensitive field redaction enabled. |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `[NEW]` `src/app/config/logger.ts` — Pino logger instance with pino-pretty dev transport and sensitive field redaction.
  - `[MODIFY]` `src/app/config/env.ts` — optional `LOG_LEVEL` Zod enum field added.
  - `[MODIFY]` `src/app.ts` — `{ pinoHttp }` named import from `pino-http`, mounted after CORS and request parsers (before all route handlers) with `httpLoggerOptions` isolating route paths (`url: req.url.split('?')[0]`, omitting raw `req.query` entirely to eliminate query token leaks), extracting only `statusCode` in response logs, and redacting `authorization`, `cookie`, `res.headers['set-cookie']`, `password`, `currentPassword`, `newPassword`, and `token`.
  - `[MODIFY]` `src/server.ts` — all `console.*` replaced with structured `logger.*` (fatal/info/error levels with context objects); ESLint disable removed.
  - `[MODIFY]` `src/app/middleware/globalErrorHandler.ts` — `console.error` replaced with `logger.error({ err: error, requestId: req.id }, "Internal server error")`; ESLint disable removed.
  - `[MODIFY]` `docs/governance/DECISIONS.md` — `DEC-024` recorded (newest entry).
  - `[MODIFY]` `docs/governance/MEMORY.md` — Phase state, codebase state and known gaps updated.
  - `[MODIFY]` `docs/governance/06-PHASE-ROADMAP.md` — Phase 2 current state updated.
  - `[MODIFY]` `docs/governance/phases/phase-2-auth-rbac.md` — P2-T028 added to task index and task definitions; deferred tooling note updated.
  - `[MODIFY]` `docs/governance/03-CODING-STANDARDS.md` — Section 16 (Logging) rewritten for Pino.
- **Migration Created:** None.
- **Test / Verification Output:**
  - `pnpm build` → `PASS` (exit code 0, Prisma Client generated, TypeScript compiled)
  - `pnpm lint` → `PASS` (exit code 0, no violations)
  - Manual: `pnpm dev` confirmed pino-pretty colored output in terminal.
- **Deviations from Original Plan:**
  - `@types/pino-http` was installed then removed immediately as `pino-http` ships its own type definitions and the `@types` stub is deprecated.
  - Used named import `{ pinoHttp }` instead of default import `pinoHttp` to satisfy TypeScript NodeNext + `verbatimModuleSyntax` type checking — both are valid per the package's type declarations.
- **Remaining Concerns / Follow-ups:** None. Per-module child loggers with request-bound context (e.g., `req.log`) are available via `pino-http` augmentation for future use.
