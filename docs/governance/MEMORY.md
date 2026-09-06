# Memory: Current State of Truth

> Read after `AGENTS.md` at the start of every AI session.
> Keep this as a concise, verified current-state snapshot, not a history log.

**Last verified:** 2026-09-06

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
  - [tasks/\_template.md](tasks/_template.md)
- Phase 1, Foundation: `COMPLETE` (retrospective record established at [phases/phase-1-foundation.md](phases/phase-1-foundation.md)).
- Phase 2, Authentication & RBAC: `ACTIVE / READY` (execution plan approved at [phases/phase-2-auth-rbac.md](phases/phase-2-auth-rbac.md)). `P2-B009` resolved for Zod (`zod@^4.5.4` approved); `P2-T002` is `🔄 In progress`.
- No future phase has approved implementation scope.
- Active task: `P2-T002` (`🔄 In progress`).

## 2. Current Codebase State

- Backend uses Express 5, TypeScript 6, Prisma 7, PostgreSQL and pnpm with ESM and NodeNext resolution.
- Application includes CORS, body/cookie parsing, a root health endpoint, `/api/v1` routing, not-found handling and global error handling.
- Environment loading requires `NODE_ENV`, `PORT`, `DATABASE_URL` and `FRONTEND_URL`.
- Prisma Client uses the PostgreSQL adapter.
- Server lifecycle handling includes startup errors, shutdown signals, unhandled rejections and uncaught exceptions.
- `/api/v1/auth` is mounted, but it currently has no endpoints; its controller and service are empty.
- `Dockerfile` and `.dockerignore` are intentionally absent; Docker configuration is deferred under `DEC-012`.

## 3. Known Gaps and Blockers

- Better Auth is not configured; dependencies remain subject to `P2-B009` under `P2-T005`.
- Docker, Jest and Winston are intentionally deferred to project-completion tooling work under `DEC-013`; former Phase 2 IDs `P2-T003` and `P2-T004` are retired.
- Authentication, sessions, RBAC, ownership and account-status enforcement are not implemented.
- The test script is an approved temporary failing placeholder under `DEC-013`; current tasks use documented executable/manual verification.
- No shared response helper is currently available.
- Current error responses use `errorSources` and may expose raw error/stack data in development; this has not yet been reconciled with `03-CODING-STANDARDS.md`.
- Server lifecycle logging currently uses `console.*` under a file-level ESLint disable as the temporary baseline accepted by `DEC-013`.
- `prisma.config.ts` uses the directory-based `prisma/schema` root with models partitioned across `schema.prisma`, `auth.prisma`, `profiles.prisma` and `audit.prisma`.
- First canonical Phase 2 migration `20260906064109_init_phase_2` is applied and verified under `P2-T001`. Generated Prisma Client is created at `src/generated/prisma` and intentionally ignored by Git.

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

| Check                 | Result                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm build`          | `PASS` on 2026-09-05                                                                         |
| `pnpm lint`           | `PASS` on 2026-09-05                                                                         |
| Automated tests       | `NOT RUN`: Jest is deferred under `DEC-013`                                                  |
| Database / migrations | `PASS` on 2026-09-06: canonical migration `20260906064109_init_phase_2` applied and verified |

## 7. Next Action

- Review the prepared `P2-T002` JIT plan, approve its public contracts and exact `zod@^4.5.4` dependency, and resolve `P2-B009` for this task.
- Keep `P2-T002` as `🔲` and Phase 2 as `ACTIVE / BLOCKED` until those approvals are recorded. Then restore `ACTIVE / READY`, mark only `P2-T002` as `🔄`, and implement it under [05-TASK-WORKFLOW.md](05-TASK-WORKFLOW.md).
- If a task is already `🔄` or `🕵️`, resume or resolve it before selecting another.

## 8. Maintenance Rule

- Update this file only after human-approved task closure or an approved governance-state change.
- Replace stale facts in place; do not append a chronological diary.
- Keep durable decisions in [DECISIONS.md](DECISIONS.md) and task execution state in phase files under `docs/governance/phases/`.
- Record verified current state only, never assumptions or unapproved plans.
