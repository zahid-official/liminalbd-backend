# Memory: Current State of Truth

> Read after `AGENTS.md` at the start of every AI session.
> Keep this as a concise, verified current-state snapshot, not a history log.

**Last verified:** 2026-09-05

## 1. Governance and Phase State

- Canonical governance lives under `docs/governance/`.
- Finalized governance files:
  - [01-PROJECT-CONTEXT.md](01-PROJECT-CONTEXT.md)
  - [02-ARCHITECTURE.md](02-ARCHITECTURE.md)
  - [03-CODING-STANDARDS.md](03-CODING-STANDARDS.md)
  - [04-RULES.md](04-RULES.md)
  - [05-TASK-WORKFLOW.md](05-TASK-WORKFLOW.md)
  - [06-PHASE-ROADMAP.md](06-PHASE-ROADMAP.md)
  - [DECISIONS.md](DECISIONS.md)
  - [MEMORY.md](MEMORY.md)
- Phase 1, Foundation: `COMPLETE`.
- Phase 2, Authentication & RBAC: `ACTIVE` and `BLOCKED` until its phase task breakdown is created and human-approved.
- No future phase has approved implementation scope.
- No approved phase task is currently recorded as `🔄` or `🕵️`.

## 2. Current Codebase State

- Backend uses Express 5, TypeScript 6, Prisma 7, PostgreSQL and pnpm with ESM and NodeNext resolution.
- Application includes CORS, body/cookie parsing, a root health endpoint, `/api/v1` routing, not-found handling and global error handling.
- Environment loading requires `NODE_ENV`, `PORT`, `DATABASE_URL` and `FRONTEND_URL`.
- Prisma Client uses the PostgreSQL adapter.
- Server lifecycle handling includes startup errors, shutdown signals, unhandled rejections and uncaught exceptions.
- `/api/v1/auth` is mounted, but it currently has no endpoints; its controller and service are empty.

## 3. Known Gaps and Blockers

- Better Auth, Zod, Winston and Jest are not yet installed or configured.
- Authentication, sessions, RBAC, ownership and account-status enforcement are not implemented.
- The test script is currently a failing placeholder.
- No shared response helper is currently available.
- Current error responses use `errorSources` and may expose raw error/stack data in development; this has not yet been reconciled with `03-CODING-STANDARDS.md`.
- Server lifecycle logging currently uses `console.*` under a file-level ESLint disable.
- `prisma/schema.prisma` currently defines no models or enums, while the initial migration creates legacy `User` and `Post` tables.
- Whether the initial migration has been applied to a database is unverified.

These are verified observations only. They do not authorize fixes outside an approved task.

## 4. Established Patterns

- Architecture: `Route → Middleware → Controller → Service → Repository → Prisma → PostgreSQL`.
- Module structure is responsibility-driven, not file-count-driven.
- `*.interface.ts` and `*.types.ts` are optional.
- Reuse Prisma-generated types, inputs and enums when they already satisfy the required contract.
- Create custom interfaces or types only when a real application-level contract is needed.
- New files follow `03-CODING-STANDARDS.md`; existing files are not renamed solely for stylistic cleanup.
- Better Auth owns authentication/session mechanics; application code owns RBAC, authorization, ownership, account status and business rules.
- Shared infrastructure: `src/app/utils/` for stateless reusable helpers (e.g., `catchAsync`, `sendResponse`), `src/app/shared/` for cross-cutting constants and domain contracts.
- Shared validation, errors, response helpers and logging should be reused rather than recreated per module.

## 5. Security and Data State

- Approved roles are exactly `SUPER_ADMIN`, `ADMIN`, `CUSTOMER`.
- Public registration must create `CUSTOMER`; privileged roles require approved authorized flows.
- Authorization, ownership and account-status restrictions are enforced server-side.
- Secrets remain in approved configuration and are never logged or committed.
- Soft deletion is used only where required by the approved data model.
- Generated Prisma output must not be hand-edited.
- Applied migration history must not be rewritten outside an approved workflow.

## 6. Verification Snapshot

| Check                 | Result                                                             |
| --------------------- | ------------------------------------------------------------------ |
| `pnpm build`          | `PASS` on 2026-09-05                                               |
| `pnpm lint`           | `PASS` on 2026-09-05                                               |
| Automated tests       | `NOT RUN`: test script is a failing placeholder                    |
| Database / migrations | `NOT RUN`: database environment and migration state are unverified |

## 7. Next Action

- Create and review `docs/governance/phases/phase-2-auth-rbac.md`.
- Keep Phase 2 `ACTIVE/BLOCKED` until the phase task breakdown, acceptance criteria, dependencies and exclusions are human-approved.
- Once Phase 2 is `READY`, select exactly one eligible task and follow [05-TASK-WORKFLOW.md](05-TASK-WORKFLOW.md).
- If a task is already `🔄` or `🕵️`, resume or resolve it before selecting another.

## 8. Maintenance Rule

- Update this file only after human-approved task closure or an approved governance-state change.
- Replace stale facts in place; do not append a chronological diary.
- Keep durable decisions in [DECISIONS.md](DECISIONS.md) and task execution state in phase files under `docs/governance/phases/`.
- Record verified current state only, never assumptions or unapproved plans.
