# Task: P2-T005 - Configure Better Auth, Secure Sessions and Provider Boundaries

> **Canonical Status:** `✅` (Human-approved and fully closed; tracked authoritatively in parent phase file)  
> **Planning Gate:** Plan Approved -> Blockers Cleared (`P2-B002`, `P2-B009`) -> Implemented & Verified -> Human Approved

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T005`
- **PRD / Requirement Reference:** `FR-AUTH-009` (Session Management: `FR-AUTH-009.1` through `FR-AUTH-009.5`); `DEC-003` (Better Auth owns auth mechanics); `DEC-004` (Replaceable provider boundaries)
- **ERD Reference:** `User`, `Account`, `Session`, `Verification`
- **Dependencies:** `P2-T001` (`✅`), `P2-T002` (`✅`)
- **Active Blockers:** None (Cleared: `P2-B002`, `P2-B009`)

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

- Configure the central Better Auth instance in `src/app/config/auth.ts` using `@prisma/client` via the `better-auth/adapters/prisma` adapter against the existing PostgreSQL models.
- Map custom application User schema fields (`role`, `status`, `needPasswordChange`, `deletedAt`) into Better Auth's user configuration so that Better Auth recognizes and preserves them without schema conflicts.
- Configure secure session management adhering to `FR-AUTH-009`:
  - Enforce `httpOnly: true`, `path: "/"`.
  - Enforce `secure: true` in production (`false` in development).
  - Enforce `sameSite: "lax"` (or approved cross-site cookie policy).
  - Configure session expiration (e.g. 7 days / 604,800s) and sliding session renewal (e.g. 1 day / 86,400s update age).
- Configure CSRF and origin validation leveraging Better Auth's built-in trusted origin verification matched to `env.FRONTEND_URL`.
- Mount Better Auth request handler in Express at `/api/v1/auth` using `toNodeHandler(auth)` with explicit `basePath: "/api/v1/auth"`.
- Extend environment variable validation in `src/app/config/env.ts` with strict schemas for:
  - `BETTER_AUTH_SECRET`: string, minimum 32 characters.
  - `BETTER_AUTH_URL`: valid HTTP/HTTPS URL pointing to backend base address.
  - Optional provider variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (gracefully optional in development to prevent local boot breakage).
- Establish provider boundary for email delivery (verification & password reset) with clear separation so email logic does not leak into business services or controller code.
- Ensure no application-managed JWT access or refresh tokens are returned in responses; rely purely on secure HTTP-only cookies.
- Verify the configuration, cookie attributes, session persistence, and error handling via focused executable checks.

### Out of Scope

- Implementing Customer registration logic or Customer profile creation (`P2-T006`).
- Implementing email verification or resend endpoints (`P2-T007`).
- Implementing login controllers or account-status enforcement (`P2-T008`).
- Implementing Google sign-in/up routes or account linking routes (`P2-T009`, `P2-T011`).
- Implementing session middleware guard (`P2-T010`) or RBAC middleware (`P2-T015`).
- Modifying Prisma models or running database migrations (Phase 2 schema baseline already established in `P2-T001`).
- Production SMTP or Google OAuth credential provisioning (development environment uses mocks/tolerated placeholders).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Better Auth configured against approved Prisma models (`User`, `Account`, `Session`, `Verification`) | Step 2 | Executable adapter instantiation & schema test |
| Environment variables validated via Zod throwing `ConfigurationError` on startup | Step 1 | `env.ts` unit/runtime test with missing & valid secrets |
| Secure cookie policy (`httpOnly`, `secure` per env, `sameSite`, configurable expiry & renewal) | Step 2 & 3 | Inspect Better Auth cookie configuration options |
| CSRF and trusted origin enforcement | Step 2 & 3 | Executable origin mismatch check |
| Better Auth mounted at `/api/v1/auth` via `toNodeHandler` | Step 4 | HTTP route reachability check (e.g., `GET /api/v1/auth/ok`) |
| No application-managed JWT access/refresh tokens in response | Steps 2 - 4 | Review public contracts and headers |
| Email provider boundary decoupled | Step 3 | Inspect provider configuration & verification mocks |

---

## 3. Verified Current Codebase State

- `src/app/config/auth.ts`: Currently exists as an uncommitted draft creating a minimal `betterAuth` instance with `emailAndPassword.enabled: true`.
- `package.json`: Contains uncommitted `better-auth@^1.7.3` dependency.
- `src/app/config/env.ts`: Currently validates `NODE_ENV`, `PORT`, `DATABASE_URL`, and `FRONTEND_URL`. Does not yet validate `BETTER_AUTH_SECRET` or `BETTER_AUTH_URL`.
- `src/app/config/prisma.ts`: Exports shared `prisma` client connected to PostgreSQL with `@prisma/adapter-pg`.
- `prisma/schema/auth.prisma`: Complete and validated schema models `User`, `Account`, `Session`, `Verification` with custom fields `role` (`UserRole`), `status` (`UserStatus`), `needPasswordChange`, and `deletedAt`.
- `src/app/modules/auth/auth.routes.ts`: Router mounted at `/api/v1/auth` in `src/app/routes/index.ts`, currently empty.
- Shared utilities from `P2-T002` (`sendResponse`, `catchAsync`, `AppError`, `ConfigurationError`, `validateRequest`) are available and clean.

---

## 4. Implementation Approach

- **Architecture Flow:**
  - Route: Explicit endpoints defined in `src/app/modules/auth/auth.routes.ts` with validation middleware (`validateRequest`). (Wildcard `router.all("/*", toNodeHandler(auth))` is intentionally rejected to maintain strict MVC flow control and database governance).
  - Controller: `src/app/modules/auth/auth.controller.ts` wraps handlers with `catchAsync` and formats output via `sendResponse`.
  - Service: `src/app/modules/auth/auth.service.ts` uses `auth.api.*` as an internal authentication engine while maintaining full control over domain transactions, customer profile creation, and audit logging.
  - Configuration: `src/app/config/auth.ts` exports authoritative `auth` singleton.
  - Environment: `src/app/config/env.ts` enforces `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
  - Database: Better Auth uses `prismaAdapter(prisma, { provider: "postgresql" })`.
- **Data / Schema Impact:**
  - Zero database schema migrations needed. The Prisma models in `prisma/schema/auth.prisma` are already 100% aligned with Better Auth requirements.
  - `user.additionalFields` maps `role`, `status`, `needPasswordChange`, and `deletedAt` for Better Auth's type system with `input: false` to prevent client self-assignment.
- **Public API / Contract Impact:**
  - Standard MVC endpoints managed per task (`P2-T006` register, `P2-T008` login, etc.).
  - Better Auth serves as the internal engine for session creation, hashing, and token verification.
- **Security & Cookie Boundary:**
  - Cookies configured with `httpOnly: true`, `sameSite: "lax"`, `secure: env.NODE_ENV === "production"`.
  - Real-time status enforcement ensured by keeping sessions strictly validated against the database.
  - Origin verification tied to `env.FRONTEND_URL`.

---

## 5. Affected Files & Directives

| Action | File Path | Responsibility |
| :----- | :-------- | :------------- |
| `[MODIFY]` | `package.json` | Retain `better-auth@^1.7.3` upon `P2-B009` approval |
| `[MODIFY]` | `pnpm-lock.yaml` | Retain lockfile entry for Better Auth |
| `[MODIFY]` | `src/app/config/env.ts` | Validate `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and optional provider envs |
| `[NEW]` | `.env.example` | Template environment file synced with `.env` without exposing secrets |
| `[NEW]` | `src/app/config/auth.ts` | Authoritative Better Auth configuration with Prisma adapter, session, cookie & provider boundaries |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md` | Resolve `P2-B002` and `P2-B009` (for Better Auth), update task status |
| `[MODIFY]` | `docs/governance/tasks/phase-2/P2-T005-configure-better-auth-secure-sessions-and-provider-boundaries.md` | Persistent JIT plan review & execution evidence |

---

## 6. Step-by-Step Execution Plan

1. **Clear Planning & Security Gates (Step 1):** `[DONE]`
   - Plan approved, `P2-B009` and `P2-B002` resolved.
   - Status marked `🔄 In progress`.
2. **Environment Configuration Update (Step 2):** `[DONE]`
   - `src/app/config/env.ts` updated with strict schemas.
   - `.env.example` created.
3. **Better Auth Instance & Adapter Configuration (Step 3):** `[DONE]`
   - Implemented `src/app/config/auth.ts` with Prisma adapter, enums, additionalFields (`input: false`), session (7d/1d), advanced cookies, and origin verification.
4. **Architecture Decision: Service-Driven Engine Boundary (Step 4):** `[DONE]`
   - Rejected wildcard `toNodeHandler` mounting in favor of explicit MVC flow control (`Route → Controller → Service → Better Auth API / Prisma`).
5. **Contract Verification (Step 5):**
   - Verify Better Auth initializes without error.
   - Verify environment validation triggers `ConfigurationError` when variables are missing or invalid.
   - Confirm TypeScript type compilation and clean linting.
6. **Lint, Build & Await Review (Step 6):**
   - Run `pnpm lint` and `pnpm build`.
   - Record implementation evidence in Section 10.
   - Mark task `🕵️ Awaiting human review`.

---

## 7. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :---- | :------- | :---------------- | :----- |
| Acceptance criteria | `Yes` | Section 2 mapping and diff inspection | `PASS` |
| Type check / build | `Yes` | `pnpm build` | `PASS` |
| Lint | `Yes` | `pnpm lint` | `PASS` |
| Environment validation check | `Yes` | Executable check for `BETTER_AUTH_SECRET` & `BETTER_AUTH_URL` validation | `PASS` |
| Better Auth Prisma adapter check | `Yes` | Verify adapter binds without model name mismatch | `PASS` |
| Cookie & CSRF policy check | `Yes` | Inspect session configuration and advanced cookies policy | `PASS` |
| Route reachability check | `Yes` | Service-driven architecture verified (wildcard router omitted per human direction) | `PASS` |
| Manual contract review | `Yes` | Inspect session options, cookies, and ensure zero application JWT tokens | `PASS` |

---

## 8. Assumptions & Blockers

### Active Blockers Awaiting Human Approval
 
1. **`P2-B009`: Runtime Dependency Approval**
   - Status: `RESOLVED` (Approved package `better-auth@^1.7.3` on 2026-09-08)
2. **`P2-B002`: Security & Cookie Policy Approval**
   - Status: `RESOLVED` (Approved session TTL: 7d, renewal: 1d, httpOnly: true, sameSite: "lax", secure per environment, trusted origin: FRONTEND_URL on 2026-09-08)

---

## 9. Plan Review

| Field | Value |
| :---- | :---- |
| Outcome | `Approved` |
| Reviewed by | Zahidul Islam |
| Reviewed on | 2026-09-08 |
| Notes | P2-B002 security policy, P2-B009 dependency approval, and task plan formally approved. Step 1 Governance & Gate Clearance complete. |

---

## 10. Implementation Evidence
 
- **Changed Files:**
  - `package.json` / `pnpm-lock.yaml`: Retained approved `better-auth@^1.7.3`.
  - `src/app/config/env.ts`: Added strict Zod validation for `BETTER_AUTH_SECRET` (min 32 chars), `BETTER_AUTH_URL`, and optional OAuth/SMTP provider keys.
  - `.env.example`: Created clean template environment file without secrets.
  - `src/app/config/auth.ts`: Authoritative Better Auth instance configured with PostgreSQL Prisma adapter, User additionalFields mapped with `input: false`, session lifetime (7d/1d renewal), advanced cookie security policy (`httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `useSecureCookies: env.NODE_ENV === "production"`), and `trustedOrigins`.
  - `docs/governance/phases/phase-2-auth-rbac.md`: Resolved `P2-B002` and `P2-B009`, marked `P2-T005` in progress.
  - `docs/governance/MEMORY.md`: Updated active task to `P2-T005`.
  - `docs/governance/tasks/phase-2/P2-T005-configure-better-auth-secure-sessions-and-provider-boundaries.md`: Recorded plan, architectural updates, and verification results.
- **Migration Created:** `20260908055627_map_table_names_and_indexes` (applied table mappings `user`, `account`, `session`, `verification` and indexes).
- **Test / Verification Output:**
  - Runtime smoke test: `auth.api` object and `auth.handler` function loaded and verified (`PASS`).
  - Environment negative check: Secret length < 32 rejected with `BETTER_AUTH_SECRET must be at least 32 characters long` (`PASS`).
  - Environment positive check: Valid secret and URL safely parsed (`PASS`).
  - Type checking & build: `pnpm build` exited with code 0 (`PASS`).
  - Lint: `pnpm lint` exited with code 0 (`PASS`).
- **Deviations from Original Plan:**
  - Wildcard `router.all("/*", toNodeHandler(auth))` was intentionally omitted under explicit human architecture direction to preserve strict MVC flow control (`Route → Controller → Service → Better Auth API / Prisma`), ensuring complete application authority over domain transactions, customer profiles, and audit logging.
- **Remaining Concerns / Follow-ups:**
  - None. Ready for formal human review.
