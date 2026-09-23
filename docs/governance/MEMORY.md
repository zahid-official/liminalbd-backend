# Memory: Current State of Truth

> Read after `AGENTS.md` at the start of every AI session.
> Keep this as a concise, verified current-state snapshot, not a history log.

**Last verified:** 2026-09-23

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
- Phase 2, Authentication & RBAC: `ACTIVE / READY` (execution plan approved at [phases/phase-2-auth-rbac.md](phases/phase-2-auth-rbac.md)). `P2-T029`, `P2-T028`, `P2-T001`, `P2-T002`, `P2-T005`, `P2-T006`, `P2-T007`, `P2-T008`, `P2-T009`, `P2-T010`, `P2-T011`, `P2-T012`, `P2-T013`, `P2-T014`, `P2-T015`, `P2-T016`, `P2-T017`, `P2-T018`, and `P2-T019` are `✅ Done`.
- Active task in progress: `P2-T020` (Enforce and audit Admin restrictions on privileged accounts - `🔄 In progress`).

## 2. Current Codebase State

- Backend uses Express 5, TypeScript 6, Prisma 7, PostgreSQL and pnpm with ESM and NodeNext resolution.
- Application includes CORS, body/cookie parsing, standardized root health endpoint (`sendResponse`), `/api/v1` routing, not-found handling (`notFoundErrorHandler`) and sanitized centralized error handling (`globalErrorHandler`).
- Shared response helper `sendResponse`, async controller wrapper `catchAsync`, and safe origin redirect `resolveCallbackURL` are established under `src/app/utils/` (`DEC-021`).
- Shared primitive Zod validation schemas (`emailSchema`, `passwordSchema`) are centralized under `src/app/validations/common.validation.ts` (`DEC-021`).
- Typed error system (`AppError`, `ConfigurationError`, public error codes, `handleBetterAuthError`, `handlePrismaError`) and source-qualified Zod validation middleware (`validateRequest`, `res.locals.validated`) are established under `src/app/errors/` and `src/app/middleware/`.
- Environment loading enforces strict validation via Zod under `src/app/config/env.ts` requiring `NODE_ENV`, `PORT`, `DATABASE_URL` and `FRONTEND_URL`.
- Prisma Client uses the PostgreSQL adapter (`@prisma/adapter-pg`) with configured `transactionOptions` (`maxWait: 10000`, `timeout: 20000`) in `src/app/config/prisma.ts` for reliable remote PostgreSQL transaction execution.
- Server lifecycle handling includes startup errors, shutdown signals, unhandled rejections and uncaught exceptions.
- Better Auth is configured behind internal application boundary (`src/app/config/auth.ts`) with custom database adapter, secure session configuration (`P2-T005`), and `emailOTP` plugin with 15-minute `cookieCache` (`P2-T007`).
- Public customer registration is established in the dedicated `customer` module (`src/app/modules/customer/`), mounted at `POST /api/v1/customers/register` (pluralized per `DEC-027`, superseding `/api/v1/customer/register` from `P2-T006`/`DEC-021`) with strict Zod validation, Better Auth user creation, automated `Customer` record creation via centralized `databaseHooks.user.create.after`, duplicate check, and privilege escalation prevention.
- Email verification and OTP subsystem is established (`P2-T007`): standalone universal transport `sendEmail` (`src/app/shared/email/email.service.ts`) logs and rethrows dispatch failures for caller awareness; branded React Email OTP template `VerificationEmail.tsx`, dedicated `AuthMailer` (`src/app/shared/email/mailers/auth.mailer.ts`), and endpoints `POST /api/v1/auth/send-verification-otp` (`requestEmailVerification`) and `POST /api/v1/auth/verify-email-otp` (`confirmEmailVerification`). In Better Auth authentication flows, email callbacks are executed via `runInBackgroundOrAwait` which safely absorbs background transport errors to preserve OWASP Anti-Enumeration on password resets (`FR-AUTH-006`) and allow resilient user creation on registration with subsequent OTP resend recovery (`FR-AUTH-004.3`).
- Credential login is implemented at `POST /api/v1/auth/login` (`P2-T008`) and Google OAuth at `POST /api/v1/auth/login/google` (`P2-T009`); per `DEC-020`, both routes are dedicated exclusively to customer authentication (`role: CUSTOMER`), with centralized session-hook status guards (`deletedAt` anti-enumeration per `DEC-018`, `SUSPENDED`, `DEACTIVATED`), privileged role rejection (`FORBIDDEN_ROLE_ACCESS`), deterministic compound-state precedence, secure cookie transport, flat sanitized user response, and network rate limiting delegated to reverse proxy (`DEC-019`). Administrative authentication will be handled via dedicated admin endpoints in Workstream C.
- Reusable session authentication middleware guard (`authGuard`) is established under `src/app/middleware/authGuard.ts` (`P2-T010`), enforcing `HTTP 401 Unauthorized` (`PUBLIC_ERROR_CODES.UNAUTHORIZED`) on missing, expired, revoked, or soft-deleted user sessions via authoritative cookie cache bypass (`disableCookieCache: true`), and injecting server-verified identity context exclusively into `res.locals.user` and `res.locals.session` (`AuthUser`, `AuthSession` from `src/app/modules/auth/auth.interface.ts`), preserving request immutability per `DEC-014` with ambient TypeScript augmentations in `src/app/interfaces/express.d.ts`.
- Google account linking and unlinking (`P2-T011`) is implemented at `POST /api/v1/auth/link/google` and `POST /api/v1/auth/unlink/google`, protected by `authGuard`; enforces customer portal boundaries (`DEC-020`, 403 `FORBIDDEN_ROLE_ACCESS`), two-tier duplicate account protection with database-level composite unique constraints (`DEC-023`, `@@unique([providerId, accountId])`, `@@unique([userId, providerId])`), non-linked account detection (400 `ACCOUNT_NOT_LINKED`), and prevents removal of the sole authentication method per `FR-AUTH-003.4` (422 `CANNOT_UNLINK_SOLE_METHOD`) while strictly preserving user roles.
- Password reset flow (`P2-T012`) is established at `POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password` via Better Auth; enforces anti-enumeration (constant generic response for non-existent and Google-only accounts), branded HTML reset email delivery (`AuthMailer.sendPasswordResetLink`), 15-minute single-use token expiration, password policy validation, session revocation on password reset (`revokeSessionsOnPasswordReset: true`), and resets `needPasswordChange` to `false`.
- Change and set password endpoints (`P2-T013`) are established at `POST /api/v1/auth/change-password` and `POST /api/v1/auth/set-password` protected by `authGuard`; enforces centralized password policy (`passwordSchema`), rejects current password reuse via schema `.refine()`, protects against enumeration via generic 401 `INVALID_CREDENTIALS` on incorrect current password per OWASP standards, resets `needPasswordChange` to `false`, revokes secondary active sessions by default, prevents duplicate password initialization on credentialed accounts, and strictly preserves linked Google OAuth accounts.
- Logout and session revocation endpoints (`P2-T014`) are established at `POST /api/v1/auth/logout` and `POST /api/v1/auth/logout-all` protected by `authGuard`; single-session logout invalidates the active session in PostgreSQL and clears cookies via `Max-Age=0` headers; multi-session logout-all atomically revokes every active session for the user across all devices, clears local cookies, guarantees `401 Unauthorized` rejection on subsequent replayed requests, and strictly maintains cross-user session isolation.
- Reusable role-based access control middleware guard (`rbacGuard`) is established under `src/app/middleware/rbacGuard.ts` (`P2-T015`), enforcing compile-time non-empty role arguments (`...allowedRoles: [UserRole, ...UserRole[]]`), server-derived role authorization strictly from authenticated identity context (`res.locals.user.role`), defense-in-depth `HTTP 401 Unauthorized` for unauthenticated requests, and `HTTP 403 Forbidden` (`PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS`) for unauthorized roles while ignoring client-supplied role claims.
- Reusable audit log application boundary (`AuditService`) is established under `src/app/shared/audit/audit.service.ts` (`P2-T016`), supporting dual execution: atomic transaction client (`tx?: Prisma.TransactionClient`) or fallback to default `prisma` client, recursive defense-in-depth redaction (`sanitizePayload`) normalizing snake_case and kebab-case keys to redact sensitive fields (`password`, `token`, `secret`, `apiKey`, etc.), safe Prisma JSON normalization (`toPrismaJson`), and strongly typed contract `CreateAuditLogInput` with autocomplete-enabled `AuditMetadata` in `src/app/shared/audit/audit.interface.ts`.
- Account status enforcement across protected access and reusable account lifecycle management is established (`P2-T017`, `FR-RBAC-006`): `authGuard` (`src/app/middleware/authGuard.ts`) enforces `HTTP 403 Forbidden` (`ACCOUNT_SUSPENDED`, `ACCOUNT_DEACTIVATED`) on restricted accounts while preserving anti-enumeration on soft-deleted accounts (`401 Unauthorized` per `DEC-018`); reusable `AccountService` (`src/app/shared/account/account.service.ts`) coordinates atomic user status mutations (`updateStatus`) and soft-deletion (`softDelete`) with automatic session invalidation in PostgreSQL (`tx.session.deleteMany({ where: { userId } })`), structured audit logging via `AuditService.record`, redundant status transition protection (400 `VALIDATION_ERROR`), and standard query filters (`activeUserFilter`, `nonDeletedUserFilter`) typed explicitly with `Prisma.UserWhereInput`.
- Administrative creation of Admin accounts is established (`P2-T018`, `FR-RBAC-003.1`, `FR-ADMIN-001`): dedicated `admin` module (`src/app/modules/admin/`) mounted at `POST /api/v1/admins` (pluralized per `DEC-027`, superseding `/api/v1/admin/admins`), protected by `authGuard` and `rbacGuard(UserRole.SUPER_ADMIN)` rejecting unauthenticated calls (`401 Unauthorized`) and unauthorized roles (`403 Forbidden`); strict Zod input validation (`createAdminSchema`) enforcing RFC-compliant lowercase email, 8-100 char complex password, name length, and stripping privileged client fields (`role`, `status`, `needPasswordChange`); duplicate email check returning 409 `USER_ALREADY_EXISTS`; atomic transaction provisioning via `prisma.$transaction` (or caller `tx`) creating `User` (`role: ADMIN`, `status: ACTIVE`, `emailVerified: true`, `needPasswordChange: true`), `Account` (`providerId: "credential"`, `accountId: userId`, timing-safe `hashPassword`), linked `Admin` profile, and immutable audit log entry via `AuditService.record` (`action: CREATE`, `entityType: ADMIN`); returning HTTP 201 Created with symmetrical, sanitized user and admin profile metadata.
- Privileged profile, role, and status management for Admin accounts is established (`P2-T019`, `FR-RBAC-003.2`–`FR-RBAC-003.7`, `FR-ADMIN-002`, `DEC-026`, `DEC-027`): mounted at `PATCH /api/v1/admins/:id`, protected by `authGuard` and `rbacGuard(UserRole.SUPER_ADMIN)`; validates UUID `:id` param and partial body fields (`role`, `status`), rejecting empty payloads and non-privileged roles; verifies target account exists, is not soft-deleted, and has privileged role (`ADMIN` or `SUPER_ADMIN`, returning 404 `USER_NOT_FOUND` otherwise); prevents Super Admin self-role mutation and self-lockout (400 `VALIDATION_ERROR`); executes inside `prisma.$transaction` (or caller `tx`); atomically invalidates active sessions in PostgreSQL upon `SUSPENDED` or `DEACTIVATED` transitions (`tx.session.deleteMany`); captures granular semantic audit actions (`ROLE_CHANGE`, `SUSPEND`, `DEACTIVATE`, `REACTIVATE`, or `UPDATE`) via `AuditService.record` with previous and new values; and returns HTTP 200 OK with sanitized user and admin profile metadata.
- Pino structured logging is established (`P2-T028`, `DEC-024`): single shared logger instance in `src/app/config/logger.ts`, `pino-http` middleware mounted in `app.ts` (after parsers, before routes) for HTTP request logging with route-path isolation (`url: req.url.split('?')[0]`, omitting raw `req.query` entirely to eliminate query token leaks across mixed-case parameter names and nested URLs) and sensitive field redaction (`authorization`, `cookie`, `res.headers['set-cookie']`, `password`, `token`, `secret`), `server.ts` and `globalErrorHandler.ts` migrated from `console.*` to structured `logger.*` calls (with `requestId: req.id` correlation on internal server errors). Development uses pino-pretty; production emits raw JSON. Log level controlled via optional `LOG_LEVEL` env variable.
- Vitest testing infrastructure is established (`P2-T029`, `DEC-025`): Vitest 3 with `environment: node`, `globals: false` (explicit imports), `@vitest/coverage-v8` for V8 coverage, `supertest` for HTTP integration tests. Tests live under mirrored `tests/unit/` (`config/`, `errors/`, `middleware/`, `modules/`, `utils/`, `validations/`) and `tests/integration/` hierarchies with exact 1:1 basename alignment (`<filename>.test.ts`). Logger is globally mocked in `tests/setup.ts` using an authentic silent Pino instance (`pino({ level: 'silent' })`). `pnpm test` runs `vitest run` (419/419 tests passing across 34 test files); `pnpm test:watch` runs interactive mode; `pnpm test:coverage` generates V8 coverage report (100% statement, branch, function, and line coverage across all P2-T002, P2-T005, P2-T006, P2-T007, P2-T008, P2-T009, P2-T010, P2-T011, P2-T012, P2-T013, P2-T014, P2-T015, P2-T016, P2-T017, and P2-T018 modules, plus protected routes, redirect resolution utilities, and 100% statement coverage with verified real output redaction for logger). Jest is permanently dropped.
- `Dockerfile` and `.dockerignore` are intentionally absent; Docker configuration is deferred under `DEC-012`.

## 3. Known Gaps and Blockers

- Docker is intentionally deferred to project-completion tooling work under `DEC-013`; former Phase 2 IDs `P2-T003` and `P2-T004` are retired. Winston is permanently dropped; Pino is now the active logger under `DEC-024`. Jest is permanently dropped; Vitest is now the active test framework under `DEC-025`.
- RBAC, administrative authorization, customer/admin profile management, password lifecycle and OAuth linking remain to be implemented in upcoming tasks.
- Server lifecycle logging previously used `console.*` under a file-level ESLint disable — this is now fully replaced by Pino (`DEC-024`, `P2-T028`).
- The `pnpm test` script is now active: `vitest run` executes all tests under `tests/`. The old `echo "Error: no test specified"` placeholder is removed.
- `prisma.config.ts` uses the directory-based `prisma/schema` root with models partitioned across `schema.prisma`, `auth.prisma`, `profiles.prisma` and `audit.prisma`.
- Canonical Phase 2 baseline migration `20260912090148_init` is applied and verified under `DEC-015`. Generated Prisma Client is created at `src/generated/prisma` and intentionally ignored by Git.

These are verified observations only. They do not authorize fixes outside an approved task.

## 4. Key Decisions Log (Reference)

- Default flow: Route -> Controller -> Service -> Repository -> Prisma.
- No direct Prisma calls in routes, controllers or unrelated services.
- Prisma 7 driver adapter pattern is established (`DEC-011`).
- Explicit imports only; no global test types or undeclared dependencies.
- `*.interface.ts` and `*.types.ts` are optional.
- Reuse Prisma-generated types, inputs and enums when they already satisfy the required contract.
- Create custom interfaces or types only when a real application-level contract is needed.
- New files follow `03-CODING-STANDARDS.md`; existing files are not renamed solely for stylistic cleanup.
- Better Auth owns authentication/session mechanics; application code owns RBAC, authorization, ownership, account status and business rules.
- Shared infrastructure: `src/app/utils/` for stateless reusable helpers (e.g., `catchAsync`, `sendResponse`, `resolveCallbackURL`), `src/app/validations/` for primitive cross-cutting validation schemas (`common.validation.ts`), and `src/app/shared/` for cross-cutting constants and domain contracts.
- Shared validation, errors, response helpers and logging should be reused rather than recreated per module.

## 5. Security and Data State

- Approved roles are exactly `SUPER_ADMIN`, `ADMIN`, `CUSTOMER`.
- User status values are exactly `ACTIVE`, `SUSPENDED`, `DEACTIVATED`.
- Hard deletes are strictly forbidden on business entities.
- Soft-deleted users are treated as non-existent for authentication/authorization.
- Session model includes mandatory token hash for fast secure lookup.
- Audit logs capture actor, action, target and timestamp.
- Logging invariants: HTTP request access logging isolates route paths (`url.split('?')[0]`) and omits raw query objects, sensitive headers and cookies; response access logging captures status code only; credential fields in request payloads are redacted with `[REDACTED]`; standard runtime errors capture error message and stack trace for diagnostic observability, and application logic strictly avoids embedding user credentials in Error messages.

## 6. Project Health Dashboard

| Check                 | Result                                                                                |
| --------------------- | ------------------------------------------------------------------------------------- |
| `pnpm build`          | `PASS` on 2026-09-20                                                                  |
| `pnpm lint`           | `PASS` on 2026-09-23                                                                  |
| Automated tests       | `PASS` on 2026-09-23: 456/456 tests pass across 35 test files via Vitest (`DEC-025`), 100% coverage on P2-T002, P2-T005, P2-T006, P2-T007, P2-T008, P2-T009, P2-T010, P2-T011, P2-T012, P2-T013, P2-T014, P2-T015, P2-T016, P2-T017, P2-T018, & P2-T019 modules, router registry, and protected routes |
| Database / migrations | `PASS` on 2026-09-12: canonical migration `20260912090148_init` applied and verified |

## 7. Next Action

- Resume and complete the active task: `P2-T020` (Enforce and audit Admin restrictions on privileged accounts - `🔄 In progress`).
- Execute Step 4 (Service layer enforcement), Step 5 (Automated unit tests), Step 6 (Quality gates), and Step 7 (Review preparation).
- Do not select or start any other task until `P2-T020` is formally approved and marked `✅ Done`.

## 8. Maintenance Rule

- Update this file only after human-approved task closure or an approved governance-state change.
- Replace stale facts in place; do not append a chronological diary.
- Keep durable decisions in [DECISIONS.md](DECISIONS.md) and task execution state in phase files under `docs/governance/phases/`.
- Record verified current state only, never assumptions or unapproved plans.
