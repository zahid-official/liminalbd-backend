# Memory: Current State of Truth

> Read after `AGENTS.md` at the start of every AI session.
> Keep this as a concise, verified current-state snapshot, not a history log.

**Last verified:** 2026-09-16

## 1. Governance and Phase State

- Canonical governance lives under `docs/governance/`.
- Finalized governance files:
  - [01-PROJECT-CONTEXT.md](01-PROJECT-CONTEXT.md)
  - [02-ARCHITECTURE.md](02-ARCHITECTURE.md)
  - [03-CODING-STANDARDS.md](03-CODING-STANDARDS.md)
  - [04-RULES.md](04-RULES.md)
  - [05-TASK-WORKFLOW.md](05-TASK-WORKFLOW.md)
  - [06-PHASE-ROADMAP.md](06-PHASE-ROADMAP.md)
  - [07-TECHNOLOGY-INTEGRATIONS-GUIDE.md](07-TECHNOLOGY-INTEGRATIONS-GUIDE.md)
  - [DECISIONS.md](DECISIONS.md)
  - [MEMORY.md](MEMORY.md)
  - [tasks/\_template.md](tasks/_template.md)
- Phase 1, Foundation: `COMPLETE` (retrospective record established at [phases/phase-1-foundation.md](phases/phase-1-foundation.md)).
- Phase 2, Authentication & RBAC: `ACTIVE / READY` (execution plan approved at [phases/phase-2-auth-rbac.md](phases/phase-2-auth-rbac.md)). `P2-T001`, `P2-T002`, `P2-T005`, `P2-T006`, `P2-T007`, `P2-T008`, `P2-T009`, `P2-T010`, `P2-T011`, and `P2-T012` are `✅ Done`.
- No future phase has approved implementation scope.
- Next eligible candidates: `P2-T013` (Change or set password), `P2-T014` (Logout and session revocation), or `P2-T015` (RBAC guard).

## 2. Current Codebase State

- Backend uses Express 5, TypeScript 6, Prisma 7, PostgreSQL and pnpm with ESM and NodeNext resolution.
- Application includes CORS, body/cookie parsing, standardized root health endpoint (`sendResponse`), `/api/v1` routing, not-found handling (`notFoundErrorHandler`) and sanitized centralized error handling (`globalErrorHandler`).
- Shared response helper `sendResponse`, async controller wrapper `catchAsync`, compensating rollback `rollbackOrphanUser`, and safe origin redirect `resolveCallbackURL` are established under `src/app/utils/` (`DEC-021`).
- Shared primitive Zod validation schemas (`emailSchema`, `passwordSchema`) are centralized under `src/app/validations/common.validation.ts` (`DEC-021`).
- Typed error system (`AppError`, `ConfigurationError`, public error codes, `handleBetterAuthError`, `handlePrismaError`) and source-qualified Zod validation middleware (`validateRequest`, `res.locals.validated`) are established under `src/app/errors/` and `src/app/middleware/`.
- Environment loading enforces strict validation via Zod under `src/app/config/env.ts` requiring `NODE_ENV`, `PORT`, `DATABASE_URL` and `FRONTEND_URL`.
- Prisma Client uses the PostgreSQL adapter (`@prisma/adapter-pg`) with configured `transactionOptions` (`maxWait: 10000`, `timeout: 20000`) in `src/app/config/prisma.ts` for reliable remote PostgreSQL transaction execution.
- Server lifecycle handling includes startup errors, shutdown signals, unhandled rejections and uncaught exceptions.
- Better Auth is configured behind internal application boundary (`src/app/config/auth.ts`) with custom database adapter, secure session configuration (`P2-T005`), and `emailOTP` plugin with 15-minute `cookieCache` (`P2-T007`).
- Public customer registration is established in the dedicated `customer` module (`src/app/modules/customer/`) at `POST /api/v1/customers/register` (`P2-T006`, `DEC-021`) with strict Zod validation, Better Auth user creation, atomic/compensated `Customer` record linkage, duplicate check, and privilege escalation prevention.
- Email verification and OTP subsystem is established (`P2-T007`): standalone universal transport `sendEmail` (`src/app/shared/email/email.service.ts`), branded React Email OTP template `VerificationEmail.tsx`, dedicated `AuthMailer` (`src/app/shared/email/mailers/auth.mailer.ts`), and endpoints `POST /api/v1/auth/send-verification-otp` and `POST /api/v1/auth/verify-email-otp`.
- Credential login is implemented at `POST /api/v1/auth/login` (`P2-T008`) and Google OAuth at `POST /api/v1/auth/login/google` (`P2-T009`); per `DEC-020`, both routes are dedicated exclusively to customer authentication (`role: CUSTOMER`), with centralized session-hook status guards (`deletedAt` anti-enumeration per `DEC-018`, `SUSPENDED`, `DEACTIVATED`), privileged role rejection (`FORBIDDEN_ROLE_ACCESS`), deterministic compound-state precedence, secure cookie transport, flat sanitized user response, and network rate limiting delegated to reverse proxy (`DEC-019`). Administrative authentication will be handled via dedicated admin endpoints in Workstream C.
- Reusable session authentication middleware guard (`authGuard`) is established under `src/app/middleware/authGuard.ts` (`P2-T010`), enforcing `HTTP 401 Unauthorized` (`PUBLIC_ERROR_CODES.UNAUTHORIZED`) on missing, expired, revoked, or soft-deleted user sessions, and injecting server-verified identity context into `req.user`, `req.session`, `res.locals.user`, and `res.locals.session`, with ambient TypeScript augmentations in `src/app/interfaces/express.d.ts`.
- Google account linking and unlinking (`P2-T011`) is implemented at `POST /api/v1/auth/link/google` and `POST /api/v1/auth/unlink/google`, protected by `authGuard`; enforces customer portal boundaries (`DEC-020`, 403 `FORBIDDEN_ROLE_ACCESS`), duplicate account detection (409 `ACCOUNT_ALREADY_LINKED`), non-linked account detection (400 `ACCOUNT_NOT_LINKED`), and prevents removal of the sole authentication method per `FR-AUTH-003.4` (422 `CANNOT_UNLINK_SOLE_METHOD`) while strictly preserving user roles.
- Password reset flow (`P2-T012`) is established at `POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password` via Better Auth; enforces anti-enumeration (constant generic response for non-existent and Google-only accounts), branded HTML reset email delivery (`AuthMailer.sendPasswordResetLink`), 15-minute single-use token expiration, password policy validation, session revocation on password reset (`revokeSessionsOnPasswordReset: true`), and resets `needPasswordChange` to `false`.
- `Dockerfile` and `.dockerignore` are intentionally absent; Docker configuration is deferred under `DEC-012`.

## 3. Known Gaps and Blockers

- Docker, Jest and Winston are intentionally deferred to project-completion tooling work under `DEC-013`; former Phase 2 IDs `P2-T003` and `P2-T004` are retired.
- RBAC, administrative authorization, customer/admin profile management, password lifecycle and OAuth linking remain to be implemented in upcoming tasks.
- The test script is an approved temporary failing placeholder under `DEC-013`; current tasks use documented executable/manual verification.
- Server lifecycle logging currently uses `console.*` under a file-level ESLint disable as the temporary baseline accepted by `DEC-013`.
- `prisma.config.ts` uses the directory-based `prisma/schema` root with models partitioned across `schema.prisma`, `auth.prisma`, `profiles.prisma` and `audit.prisma`.
- Canonical Phase 2 baseline migration `20260912090148_init` is applied and verified under `DEC-015`. Generated Prisma Client is created at `src/generated/prisma` and intentionally ignored by Git.

These are verified observations only. They do not authorize fixes outside an approved task.

## 4. Established Patterns

- Architecture: `Route → Middleware → Controller → Service → Repository → Prisma → PostgreSQL`.
- Module structure is responsibility-driven, not file-count-driven.
- `*.interface.ts` and `*.types.ts` are optional.
- Reuse Prisma-generated types, inputs and enums when they already satisfy the required contract.
- Create custom interfaces or types only when a real application-level contract is needed.
- New files follow `03-CODING-STANDARDS.md`; existing files are not renamed solely for stylistic cleanup.
- Better Auth owns authentication/session mechanics; application code owns RBAC, authorization, ownership, account status and business rules.
- Shared infrastructure: `src/app/utils/` for stateless reusable helpers (e.g., `catchAsync`, `sendResponse`, `rollbackOrphanUser`, `resolveCallbackURL`), `src/app/validations/` for primitive cross-cutting validation schemas (`common.validation.ts`), and `src/app/shared/` for cross-cutting constants and domain contracts.
- Shared validation, errors, response helpers and logging should be reused rather than recreated per module.

## 5. Security and Data State

- Approved roles are exactly `SUPER_ADMIN`, `ADMIN`, `CUSTOMER`.
- Public registration must create `CUSTOMER`; privileged roles require approved authorized flows.
- Security Invariant: Authorization, resource ownership and account restrictions must strictly be enforced server-side; currently enforced at authentication boundary (registration role protection in `P2-T006`, account status checks in `P2-T008`), server-derived session guard (`authGuard` in `P2-T010`), while RBAC authorization (`P2-T015`) and resource ownership (`P2-T022`) remain to be implemented in upcoming tasks.
- Secrets remain in approved configuration and are never logged or committed.
- Soft deletion is used only where required by the approved data model.
- Generated Prisma output must not be hand-edited.
- Applied migration history must not be rewritten outside an approved workflow.

## 6. Verification Snapshot

| Check                 | Result                                                                                |
| --------------------- | ------------------------------------------------------------------------------------- |
| `pnpm build`          | `PASS` on 2026-09-16                                                                  |
| `pnpm lint`           | `PASS` on 2026-09-16                                                                  |
| Automated tests       | `NOT RUN`: Jest is deferred under `DEC-013`                                           |
| Database / migrations | `PASS` on 2026-09-12: canonical migration `20260912090148_init` applied and verified |

## 7. Next Action

- Select the next planning candidate from Phase 2 task index (e.g., `P2-T013`, `P2-T014`, or `P2-T015`).
- Perform read-only inspection, prepare JIT task plan, resolve prerequisites, and submit for human approval.
- Mark task as `🔄 In progress` only after explicit human approval.
- If a task is already `🔄` or `🕵️`, resume or resolve it before selecting another.

## 8. Maintenance Rule

- Update this file only after human-approved task closure or an approved governance-state change.
- Replace stale facts in place; do not append a chronological diary.
- Keep durable decisions in [DECISIONS.md](DECISIONS.md) and task execution state in phase files under `docs/governance/phases/`.
- Record verified current state only, never assumptions or unapproved plans.
