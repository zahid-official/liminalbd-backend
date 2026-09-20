# Task: P2-T008 - Implement Login with Account-Status and Rate-Limit Enforcement

> **Canonical Status:** `✅ Done`  
> **Planning Gate:** Draft Plan → Human Approval → Blocker Clearance (`P2-B001`) → `🔄 In progress` → Implementation & Verification Complete → `🕵️ Awaiting human review` → `✅ Done`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T008`
- **PRD / Requirement Reference:** `FR-AUTH-005` (Email/Password Login), `FR-RBAC-006.1` (Account Status Enforcement)
- **ERD Reference:** `User` (`status`, `deletedAt`, `emailVerified`), `Session`, `Account`
- **Dependencies:** `P2-T005` (`✅ Done`), `P2-T006` (`✅ Done`), `P2-T007` (`✅ Done`)
- **Active Blockers:** None (`P2-B001` resolved for `POST /api/v1/auth/login`)

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Email/Password Login Flow (`FR-AUTH-005`):**
   - Expose endpoint `POST /api/v1/auth/login`.
   - Validate payload (`email`, `password`) via Zod schema using `validateRequest`.
   - Execute authentication via Better Auth internal API (`auth.api.signInEmail`).
   - Forward session cookies (`session_token`, `session_data`) via Express response headers so browser/client automatically receives httpOnly secure cookies.
2. **Account Status Enforcement (`FR-RBAC-006.1`):**
   - Check account eligibility before establishing/returning session:
     - If user is soft-deleted (`deletedAt !== null`): reject with `401 Unauthorized` (`INVALID_CREDENTIALS` per `DEC-018` to prevent account enumeration).
     - If user is suspended (`status === SUSPENDED`): reject with `403 Forbidden` (`ACCOUNT_SUSPENDED`, sanitized message).
     - If user is deactivated (`status === DEACTIVATED`): reject with `403 Forbidden` (`ACCOUNT_DEACTIVATED`, sanitized message).
     - If email is not verified (`emailVerified === false`): reject with `403 Forbidden` (`EMAIL_NOT_VERIFIED`).
3. **Invalid Credential Protection:**
   - Reject invalid password or non-existent email with `401 Unauthorized` (`INVALID_CREDENTIALS`), without leaking whether the email exists.
4. **Sanitized User Response Envelope:**
   - Return authenticated user profile data (id, name, email, role, status, emailVerified) using standardized `sendResponse`.
   - Never expose password hash, internal credentials, or sensitive token strings in the response body (session is maintained solely through secure httpOnly cookies).

### Compound-State Precedence Rules

When an account exhibits multiple overlapping state conditions (e.g. invalid credentials, unverified email, suspended status, and/or soft-deleted timestamp), evaluation proceeds through a deterministic, security-first sequence:

1. **Priority 1: Invalid Credentials (HTTP 401 `INVALID_CREDENTIALS`):**  
   Evaluated first during Better Auth credential verification. Any incorrect password or non-existent email receives generic 401 rejection with timing-equalized dummy password hashing, preventing attacker reconnaissance into account existence or internal state.
2. **Priority 2: Soft-Deleted Account (HTTP 401 `INVALID_CREDENTIALS`):**  
   Evaluated at the session creation boundary (`databaseHooks.session.create.before`). If `deletedAt !== null`, session persistence is aborted and generic 401 `INVALID_CREDENTIALS` is returned (anti-enumeration per `DEC-018`). This takes precedence over verification or suspension state so deleted accounts are treated strictly as non-existent and reveal no lifecycle telemetry.
3. **Priority 3: Administrative Sanction (HTTP 403 `ACCOUNT_SUSPENDED` / `ACCOUNT_DEACTIVATED`):**  
   Evaluated at the session creation boundary immediately after the soft-delete check. If `status === SUSPENDED` or `DEACTIVATED`, session write is aborted and status-specific 403 forbidden is returned. Administrative moderation takes precedence over email verification (prompting an unverified suspended user to verify their email would be misleading and contradictory).
4. **Priority 4: Unverified Email (HTTP 403 `EMAIL_NOT_VERIFIED`):**  
   Evaluated at the session creation boundary after confirming valid credentials, non-deleted state, and active administrative standing. If `!emailVerified`, session write is aborted with 403 `EMAIL_NOT_VERIFIED`, instructing the user to verify their email before session issuance.
5. **Priority 5: Active Verified Success (HTTP 200 OK):**  
   Session and secure httpOnly cookies are established and returned in the shared envelope.

### Out of Scope

- Application-managed JWT tokens in response body (maintain session exclusively through secure cookies per `DEC-003` & `DEC-014`).
- Google OAuth login (handled separately in `P2-T009`).
- Administrative status alteration endpoints (handled in `P2-T019`).
- Node process in-memory IP rate limiting (network-level DoS protection and distributed IP rate limiting are formally designated for the Reverse Proxy / API Gateway / Cloudflare infrastructure boundary per `DEC-019`).

### Acceptance Criteria Mapping

| Acceptance Criterion                              | Planned Step         | Verification                                                                  |
| :------------------------------------------------ | :------------------- | :---------------------------------------------------------------------------- |
| Validate email and password inputs                | Step 2               | Reject missing or malformed inputs with 400                                   |
| Reject invalid credentials without detail leakage | Step 3 & 4           | HTTP 401 with `INVALID_CREDENTIALS` (timing-equalized via dummy password hash) |
| Reject unverified user accounts                   | Step 3 & 4           | HTTP 403 with `EMAIL_NOT_VERIFIED`                                            |
| Reject suspended and deactivated accounts         | Step 3 & 4           | HTTP 403 with status-specific public error codes                              |
| Reject soft-deleted accounts                      | Step 3 & 4           | HTTP 401 `INVALID_CREDENTIALS` preventing enumeration                         |
| Issue session cookies and sanitized response      | Step 3 & 5           | Verify `Set-Cookie` headers and 200 JSON envelope                             |
| Rate-limit repeated failed attempts               | Out of Scope / Infra | Delegated to Reverse Proxy (Nginx / Cloudflare) infrastructure per `DEC-019` |

---

## 3. Verified Current Codebase State

- `src/app/modules/auth/auth.validation.ts`: contains strict `loginWithCredentialsSchema` validating `email` and `password`.
- `src/app/errors/errorCodes.ts`: defines `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, and `ACCOUNT_DEACTIVATED`.
- `src/app/modules/auth/auth.service.ts`: implements `loginWithCredentials` delegating directly to Better Auth `signInEmail` with session cookies extraction, while account status guards are enforced centrally via `databaseHooks.session.create.before`.
- `src/app/modules/auth/auth.controller.ts`: implements `loginWithCredentials` forwarding `Set-Cookie` headers and sending sanitized 200 JSON envelope.
- `src/app/modules/auth/auth.routes.ts`: mounts `POST /login` with `validateRequest(AuthValidation.loginWithCredentialsSchema)`.

---

## 4. Architectural & Governance Alignment

- **Layered Architecture:** Controller depends only on Service; Service coordinates Prisma and Better Auth internal API.
- **Session Architecture:** Strictly cookie-only session issuance (`session_token`, `session_data`) via `res.setHeader("set-cookie", ...)`. No raw tokens in JSON.
- **Error Resolution:** Centralized handling via `handleBetterAuthError` and `handlePrismaError` caught at `globalErrorHandler`.
- **Naming Standard:** Method names adhere to verb-first domain standard `loginWithCredentials`.

---

## 5. Affected Files & Directives

| Action     | File Path                                                                                                 | Responsibility                                                                                                      |
| :--------- | :-------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `[MODIFY]` | `src/app/config/auth.ts`                                                                                  | Configured `databaseHooks.session.create.before` to enforce `deletedAt`, `SUSPENDED`, and `DEACTIVATED` checks      |
| `[MODIFY]` | `src/app/errors/handleBetterAuthError.ts`                                                                 | Added error mapping for `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_DEACTIVATED`, and `INVALID_CREDENTIALS` |
| `[MODIFY]` | `src/app/modules/auth/auth.validation.ts`                                                                 | Added `loginWithCredentialsSchema` and exported `LoginWithCredentialsInput`                                                        |
| `[MODIFY]` | `src/app/errors/errorCodes.ts`                                                                            | Added public machine error codes for login and account states                                                       |
| `[MODIFY]` | `src/app/modules/auth/auth.service.ts`                                                                    | Implemented `loginWithCredentials` delegating directly to `auth.api.signInEmail` with timing-equalized protection  |
| `[MODIFY]` | `src/app/modules/auth/auth.controller.ts`                                                                 | Added `loginWithCredentials` handler with `getSetCookie()` cookie forwarding                                        |
| `[MODIFY]` | `src/app/modules/auth/auth.routes.ts`                                                                     | Mounted `POST /login` endpoint with validation middleware                                                           |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`                                                             | Track task progress and status                                                                                      |
| `[MODIFY]` | `docs/governance/tasks/phase-2/P2-T008-implement-login-with-account-status-and-rate-limit-enforcement.md` | Persistent JIT task plan and verification evidence                                                                  |

---

## 6. Step-by-Step Execution Plan

1. **Gate 1: Review & Human Approval:**
   - Approved `POST /api/v1/auth/login` and marked `P2-T008` as `🔄 In progress`.
2. **Step 2: Error Registry & Zod Validation:**
   - Added required error codes to `PUBLIC_ERROR_CODES`.
   - Created `loginWithCredentialsSchema` and exported `LoginWithCredentialsInput`.
3. **Step 3: Service & Hook Architecture:**
   - Enforced account status (`deletedAt`, `SUSPENDED`, `DEACTIVATED`) via Better Auth `databaseHooks.session.create.before` right before session persistence.
   - Refactored `loginWithCredentials` in `auth.service.ts` to directly invoke `auth.api.signInEmail`, eliminating premature pre-auth database lookups and user enumeration.
4. **Step 4: Controller & Route Mounting:**
   - Implemented controller handler with multi-cookie array forwarding (`getSetCookie()`) and mounted `POST /login` route.
5. **Step 5: Verification & Quality Gates:**
   - Verified input validation, invalid credentials, unverified email, suspended/deactivated status, and successful session cookies issuance across all 8 security test scenarios.
   - Passed `pnpm lint` and `pnpm exec tsc --noEmit`.
6. **Gate 2: Human Review & Closure:**
   - Record implementation evidence and mark `✅ Done`.

---

## 7. Verification & Quality Gates

| Check                          | Required | Command or Method                                                                                                          | Result      |
| :----------------------------- | :------- | :------------------------------------------------------------------------------------------------------------------------- | :---------- |
| Acceptance criteria            | `Yes`    | PRD FR-AUTH-005 & FR-RBAC-006.1 inspection                                                                                 | `PASS`      |
| Type check / build             | `Yes`    | `pnpm exec tsc --noEmit`                                                                                                   | `PASS`      |
| Lint                           | `Yes`    | `pnpm lint`                                                                                                                | `PASS`      |
| Automated unit tests           | `Yes`    | `pnpm test`                                                                                                                | `PASS` (100% coverage across all P2-T008 modules) |
| Input validation check         | `Yes`    | Empty body returns 400 with `VALIDATION_ERROR`                                                                             | `PASS`      |
| Invalid credential rejection   | `Yes`    | Non-existent user or wrong password returns 401 `INVALID_CREDENTIALS` (timing-equalized via Better Auth dummy password hash) | `PASS`      |
| Unverified account rejection   | `Yes`    | Returns 403 `EMAIL_NOT_VERIFIED` only upon correct password                                                | `PASS`      |
| Restricted account rejection   | `Yes`    | Returns 403 for `ACCOUNT_SUSPENDED` and `ACCOUNT_DEACTIVATED` only upon correct password                   | `PASS`      |
| Soft-deleted account rejection | `Yes`    | Returns 401 `INVALID_CREDENTIALS` preventing account enumeration                                           | `PASS`      |
| Valid credential login         | `Yes`    | Returns 200 OK + sets session cookies + sanitized user profile                                             | `PASS`      |
| Network / IP Rate Limiting     | `No`     | Formally delegated to Reverse Proxy (Nginx) / Cloudflare infrastructure boundary per `DEC-019` | `DELEGATED` |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None (`P2-B001` resolved for `POST /api/v1/auth/login`).
- **Assumptions:** Session is communicated exclusively via secure httpOnly cookies adhering to `DEC-003` and `DEC-014`. Distributed IP rate limiting (e.g., 5 requests/min per IP on `/api/v1/auth/login`) is designated for the API Gateway / Reverse Proxy (Nginx / Cloudflare) infrastructure layer per `DEC-019` to avoid brittle single-process in-memory limits in multi-instance environments.

---

## 9. Plan Review

| Field       | Value                                                                                                                                         |
| :---------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome     | `Approved`                                                                                                                                    |
| Reviewed by | Zahidul Islam                                                                                                                                 |
| Reviewed on | 2026-09-12                                                                                                                                    |
| Notes       | Approved endpoint POST /api/v1/auth/login, credential-based authentication naming standard, and centralized hook-based account status guards. |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `src/app/config/auth.ts` (configured `databaseHooks.session.create.before` to enforce status guards before session write; verified via `tests/unit/config/auth.test.ts` — 29 tests, 100% coverage)
  - `src/app/errors/handleBetterAuthError.ts` (added mappings for `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_DEACTIVATED`, `INVALID_CREDENTIALS`; verified via `tests/unit/errors/handleBetterAuthError.test.ts` — 9 tests, 100% coverage)
  - `src/app/errors/errorCodes.ts` (added `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_DEACTIVATED`)
  - `src/app/modules/auth/auth.validation.ts` (added `loginWithCredentialsSchema`, `LoginWithCredentialsInput`; verified via `tests/unit/modules/auth/auth.validation.test.ts` — 58 tests, 100% coverage)
  - `src/app/modules/auth/auth.service.ts` (implemented `loginWithCredentials` delegating directly to `auth.api.signInEmail` with cookie forwarding; verified via `tests/unit/modules/auth/auth.service.test.ts` — 27 tests, 100% statements/funcs/lines)
  - `src/app/modules/auth/auth.controller.ts` (implemented `loginWithCredentials` with `fromNodeHeaders` and `authHeaders.getSetCookie()`; verified via `tests/unit/modules/auth/auth.controller.test.ts` — 19 tests, 100% coverage)
  - `src/app/modules/auth/auth.routes.ts` (mounted `POST /login` with `validateRequest(AuthValidation.loginWithCredentialsSchema)`; verified via `tests/unit/modules/auth/auth.routes.test.ts` — 15 tests, 100% coverage)
  - `docs/governance/tasks/phase-2/P2-T008-implement-login-with-account-status-and-rate-limit-enforcement.md` (updated implementation evidence and architectural design)
- **Test / Verification Output:**
  - `pnpm lint`: Passed (0 errors, 0 warnings).
  - `pnpm exec tsc --noEmit`: Passed (`tsc` completed with 0 errors).
  - `pnpm test`: Passed (250/250 tests passing across 23 test files).
  - Executable Contract Checks (All 9 scenarios verified):
    1. Validation Gate: POST `{}` -> HTTP 400 (`VALIDATION_ERROR`, missing email and password fields).
    2. Missing User Gate: POST non-existent user -> HTTP 401 (`INVALID_CREDENTIALS`, timing-equalized via Better Auth dummy password hash applied).
    3. Wrong Password on Unverified User: POST unverified email with wrong password -> HTTP 401 (`INVALID_CREDENTIALS`, account state not leaked).
    4. Unverified Email Gate: POST unverified email with correct password -> HTTP 403 (`EMAIL_NOT_VERIFIED`, "Please verify your email before logging in").
    5. Suspended Account Gate: POST suspended user with correct password -> HTTP 403 (`ACCOUNT_SUSPENDED`).
    6. Suspended Account Gate (Wrong Password): POST suspended user with wrong password -> HTTP 401 (`INVALID_CREDENTIALS`, status not leaked).
    7. Deactivated Account Gate: POST deactivated user with correct password -> HTTP 403 (`ACCOUNT_DEACTIVATED`).
    8. Soft-Deleted Account Gate: POST user with `deletedAt !== null` (including compound states where user is simultaneously unverified and suspended) -> HTTP 401 (`INVALID_CREDENTIALS`, anti-enumeration per `DEC-018`).
    9. Happy Path (Login Success): POST valid credentials on active verified account -> HTTP 200 OK, `Set-Cookie` headers present (`session_token`, cookie cache), sanitized user payload returned directly under `data` (`{ id, name, email, emailVerified: true, role: "CUSTOMER", status: "ACTIVE" }`) for strict endpoint symmetry with `registerCustomer` and `verifyEmailOtp`.
- **Deviations from Original Plan:**
  - Refactored from service-level pre-auth status checking to Better Auth `databaseHooks.session.create.before` to ensure timing-equalized credential rejection for nonexistent users and prevent leaking account existence or state on wrong passwords.
  - Multi-cookie support improved by adopting `authHeaders.getSetCookie()` returning `string[]` to prevent illegal comma-folding under RFC 6265.
  - Centralized IP rate limiting is formally designated for the API gateway / reverse proxy infrastructure tier per `DEC-019` rather than brittle in-memory Node process limits.
- **Remaining Concerns / Follow-ups:**
  - **Infrastructure Follow-up:** Configure Nginx/Cloudflare rate-limiting policy per `DEC-019` (e.g. 5 failed requests/min per IP on `POST /api/v1/auth/login` returning HTTP 429) during deployment infrastructure setup.
  - All application-level authentication, credential protection, and account-status criteria are fully met and verified. Ready for human closure review.
