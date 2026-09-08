# Task: P2-T005 - Configure Better Auth, Secure Sessions and Provider Boundaries

> **Canonical Status:** `🔄` (tracked authoritatively in the parent phase file)  
> **Planning Gate:** Plan Approved -> Blockers Cleared (`P2-B002`, `P2-B009`) -> `🔄 In Progress`

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
  - Route: `/api/v1/auth/*` -> Better Auth Node Handler (`toNodeHandler(auth)`).
  - Configuration: `src/app/config/auth.ts` exports `auth` singleton.
  - Environment: `src/app/config/env.ts` enforces `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
  - Database: Better Auth uses `prismaAdapter(prisma, { provider: "postgresql" })`.
- **Data / Schema Impact:**
  - Zero database schema migrations needed. The Prisma models in `prisma/schema/auth.prisma` are already 100% aligned with Better Auth requirements.
  - `user.additionalFields` will define `role`, `status`, `needPasswordChange`, and `deletedAt` for Better Auth's type system.
- **Public API / Contract Impact:**
  - Better Auth endpoints mounted under `/api/v1/auth/*`.
  - Requests set/clear session cookies matching the approved security policy.
- **Security & Cookie Boundary:**
  - Cookies configured with `httpOnly: true`, `sameSite: "lax"`, `secure: env.NODE_ENV === "production"`.
  - Secret key minimum length 32 chars validated at startup via `ConfigurationError`.
  - Origin verification tied to `env.FRONTEND_URL`.

---

## 5. Affected Files & Directives

| Action | File Path | Responsibility |
| :----- | :-------- | :------------- |
| `[MODIFY]` | `package.json` | Retain `better-auth@^1.7.3` upon `P2-B009` approval |
| `[MODIFY]` | `pnpm-lock.yaml` | Retain lockfile entry for Better Auth |
| `[MODIFY]` | `src/app/config/env.ts` | Validate `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and optional provider envs |
| `[NEW]` | `src/app/config/auth.ts` | Authoritative Better Auth configuration with Prisma adapter, session, cookie & provider boundaries |
| `[MODIFY]` | `src/app.ts` or `src/app/modules/auth/auth.routes.ts` | Mount `toNodeHandler(auth)` at `/api/v1/auth` |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md` | Resolve `P2-B002` and `P2-B009` (for Better Auth), update task status |
| `[MODIFY]` | `docs/governance/tasks/phase-2/P2-T005-configure-better-auth-secure-sessions-and-provider-boundaries.md` | Persistent JIT plan review & execution evidence |

---

## 6. Step-by-Step Execution Plan

1. **Clear Planning & Security Gates (Step 1):**
   - Obtain human approval for this plan.
   - Resolve `P2-B009` (approving `better-auth@^1.7.3`) and `P2-B002` (approving cookie attributes, session TTL, renewal, and CSRF policy).
   - Mark `P2-T005` as `🔄 In progress` in the parent phase file.
2. **Environment Configuration Update (Step 2):**
   - Update `src/app/config/env.ts` to validate `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and optional Google/SMTP configuration with Zod.
   - Update `.env.example` (and notify user regarding local `.env`).
3. **Better Auth Instance & Adapter Configuration (Step 3):**
   - Implement `src/app/config/auth.ts` configuring:
     - `database: prismaAdapter(prisma, { provider: "postgresql" })`
     - `user.additionalFields` for `role`, `status`, `needPasswordChange`, `deletedAt`
     - `session` options: `expiresIn: 60 * 60 * 24 * 7` (7 days), `updateAge: 60 * 60 * 24` (1 day sliding window), `cookieCache`
     - `advanced.cookies`: `httpOnly: true`, `sameSite: "lax"`, `secure: env.NODE_ENV === "production"`, `path: "/"`
     - `trustedOrigins: [env.FRONTEND_URL]`
     - `basePath: "/api/v1/auth"`
     - `emailAndPassword: { enabled: true }`
     - Provider boundary stubs for Google and Email verification.
4. **Mount Handler in Express (Step 4):**
   - Mount Better Auth handler in `src/app/modules/auth/auth.routes.ts` or `src/app.ts` via `toNodeHandler(auth)`.
5. **Contract Verification (Step 5):**
   - Execute runtime contract checks:
     - Verify Better Auth initializes without throwing schema or configuration errors.
     - Verify environment validation triggers `ConfigurationError` if `BETTER_AUTH_SECRET` is missing or short (< 32 chars).
     - Verify endpoint responds on `/api/v1/auth/ok` or `/api/v1/auth/session`.
     - Confirm absence of leaked secrets or application JWTs.
6. **Lint, Build & Await Review (Step 6):**
   - Run `pnpm lint` and `pnpm build`.
   - Record implementation evidence in Section 10.
   - Mark task `🕵️ Awaiting human review`.

---

## 7. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :---- | :------- | :---------------- | :----- |
| Acceptance criteria | `Yes` | Section 2 mapping and diff inspection | `NOT RUN` |
| Type check / build | `Yes` | `pnpm build` | `NOT RUN` |
| Lint | `Yes` | `pnpm lint` | `NOT RUN` |
| Environment validation check | `Yes` | Executable check for `BETTER_AUTH_SECRET` & `BETTER_AUTH_URL` validation | `NOT RUN` |
| Better Auth Prisma adapter check | `Yes` | Verify adapter binds without model name mismatch | `NOT RUN` |
| Cookie & CSRF policy check | `Yes` | Inspect generated response headers for `Set-Cookie` attributes | `NOT RUN` |
| Route reachability check | `Yes` | HTTP request to mounted `/api/v1/auth` handler | `NOT RUN` |
| Manual contract review | `Yes` | Inspect session response, cookies, and ensure zero application JWT tokens | `NOT RUN` |

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

_To be completed after code execution and before marking awaiting human review:_

- **Changed Files:** Pending
- **Migration Created:** None expected
- **Test / Verification Output:** Pending
- **Deviations from Original Plan:** Pending
- **Remaining Concerns / Follow-ups:** Pending
