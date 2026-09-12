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
   - Forward session cookies (`session_token`) via Express response headers so browser/client automatically receives httpOnly secure cookie.
2. **Account Status Enforcement (`FR-RBAC-006.1`):**
   - Check account eligibility before establishing/returning session:
     - If user is soft-deleted (`deletedAt !== null`): reject with `401 Unauthorized` (`ACCOUNT_DELETED` / generic credential rejection to avoid enumeration).
     - If user is suspended (`status === SUSPENDED`): reject with `403 Forbidden` (`ACCOUNT_SUSPENDED`, sanitized message).
     - If user is deactivated (`status === DEACTIVATED`): reject with `403 Forbidden` (`ACCOUNT_DEACTIVATED`, sanitized message).
     - If email is not verified (`emailVerified === false`): reject with `403 Forbidden` / `400 Bad Request` (`EMAIL_NOT_VERIFIED`).
3. **Invalid Credential Protection:**
   - Reject invalid password or non-existent email with `401 Unauthorized` (`INVALID_CREDENTIALS`), without leaking whether the email exists.
4. **Sanitized User Response Envelope:**
   - Return authenticated user profile data (id, name, email, role, status, emailVerified) using standardized `sendResponse`.
   - Never expose password hash, internal credentials, or sensitive token strings in the response body (session is maintained solely through secure httpOnly cookies).

### Out of Scope

- Application-managed JWT tokens in response body (maintain session exclusively through secure cookies per `DEC-003` & `DEC-014`).
- Google OAuth login (handled separately in `P2-T009`).
- Administrative status alteration endpoints (handled in `P2-T019`).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Validate email and password inputs | Step 2 | Reject missing or malformed inputs with 400 |
| Reject invalid credentials without detail leakage | Step 3 & 4 | HTTP 401 with `INVALID_CREDENTIALS` |
| Reject unverified user accounts | Step 3 & 4 | HTTP 403 with `EMAIL_NOT_VERIFIED` |
| Reject suspended and deactivated accounts | Step 3 & 4 | HTTP 403 with status-specific public error codes |
| Reject soft-deleted accounts | Step 3 & 4 | HTTP 401 / 403 preventing access |
| Issue session cookie and sanitized response | Step 3 & 5 | Verify `Set-Cookie` header and 200 JSON envelope |

---

## 3. Verified Current Codebase State

- `src/app/modules/auth/auth.validation.ts`: contains strict `loginSchema` validating `email` and `password`.
- `src/app/errors/errorCodes.ts`: defines `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, and `ACCOUNT_DEACTIVATED`.
- `src/app/modules/auth/auth.service.ts`: implements `loginWithCredentials` orchestrating pre-auth status checks and Better Auth `signInEmail`.
- `src/app/modules/auth/auth.controller.ts`: implements `loginWithCredentials` forwarding `set-cookie` header and sending sanitized 200 JSON envelope.
- `src/app/modules/auth/auth.routes.ts`: mounts `POST /login` with `validateRequest(AuthValidation.loginSchema)`.

---

## 4. Architectural & Governance Alignment

- **Layered Architecture:** Controller depends only on Service; Service coordinates Prisma and Better Auth internal API.
- **Session Architecture:** Strictly cookie-only session issuance (`session_token`) via `res.setHeader("set-cookie", ...)`. No raw tokens in JSON.
- **Error Resolution:** Centralized handling via `handleBetterAuthError` and `handlePrismaError` caught at `globalErrorHandler`.
- **Naming Standard:** Method names adhere to verb-first domain standard `loginWithCredentials`.

---

## 5. Affected Files & Directives

| Action | File Path | Responsibility |
| :----- | :-------- | :------------- |
| `[MODIFY]` | `src/app/modules/auth/auth.validation.ts` | Added `loginSchema` and exported `LoginInput` |
| `[MODIFY]` | `src/app/errors/errorCodes.ts` | Added public machine error codes for login and account states |
| `[MODIFY]` | `src/app/modules/auth/auth.service.ts` | Added `loginWithCredentials` method with pre-auth guards and session issuance |
| `[MODIFY]` | `src/app/modules/auth/auth.controller.ts` | Added `loginWithCredentials` handler with cookie forwarding |
| `[MODIFY]` | `src/app/modules/auth/auth.routes.ts` | Mounted `POST /login` endpoint with validation middleware |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md` | Track task progress and status |
| `[MODIFY]` | `docs/governance/tasks/phase-2/P2-T008-implement-login-with-account-status-and-rate-limit-enforcement.md` | Persistent JIT task plan and verification evidence |

---

## 6. Step-by-Step Execution Plan

1. **Gate 1: Review & Human Approval:**
   - Approved `POST /api/v1/auth/login` and marked `P2-T008` as `🔄 In progress`.
2. **Step 2: Error Registry & Zod Validation:**
   - Added required error codes to `PUBLIC_ERROR_CODES`.
   - Created `loginSchema` and exported `LoginInput`.
3. **Step 3: Service Implementation:**
   - Implemented `loginWithCredentials` with pre-auth status checks and Better Auth `signInEmail`.
4. **Step 4: Controller & Route Mounting:**
   - Implemented controller handler with cookie forwarding and mounted `POST /login` route.
5. **Step 5: Verification & Quality Gates:**
   - Verified input validation, invalid credentials, unverified email, suspended/deactivated status, and successful session cookie issuance.
   - Passed `pnpm lint` and `pnpm build`.
6. **Gate 2: Human Review & Closure:**
   - Record implementation evidence and mark `🕵️ Awaiting human review`.

---

## 7. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :---- | :------- | :---------------- | :----- |
| Acceptance criteria | `Yes` | PRD FR-AUTH-005 & FR-RBAC-006.1 inspection | `PASS` |
| Type check / build | `Yes` | `pnpm build` | `PASS` |
| Lint | `Yes` | `pnpm lint` | `PASS` |
| Input validation check | `Yes` | Empty body returns 400 with `VALIDATION_ERROR` | `PASS` |
| Invalid credential rejection | `Yes` | Non-existent user or wrong password returns 401 `INVALID_CREDENTIALS` | `PASS` |
| Unverified account rejection | `Yes` | Returns 403 `EMAIL_NOT_VERIFIED` | `PASS` |
| Restricted account rejection | `Yes` | Returns 403 for `ACCOUNT_SUSPENDED` and `ACCOUNT_DEACTIVATED` | `PASS` |
| Soft-deleted account rejection | `Yes` | Returns 401 `INVALID_CREDENTIALS` preventing enumeration | `PASS` |
| Valid credential login | `Yes` | Returns 200 OK + sets `better-auth.session_token` cookie + sanitized user profile | `PASS` |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None (`P2-B001` resolved for `POST /api/v1/auth/login`).
- **Assumptions:** Session is communicated exclusively via secure httpOnly cookies adhering to `DEC-003` and `DEC-014`.

---

## 9. Plan Review

| Field | Value |
| :---- | :---- |
| Outcome | `Approved` |
| Reviewed by | Zahidul Islam |
| Reviewed on | 2026-09-12 |
| Notes | Approved endpoint POST /api/v1/auth/login, credential-based authentication naming standard, and pre-auth account status checks. |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `src/app/errors/errorCodes.ts` (added `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_DEACTIVATED`)
  - `src/app/modules/auth/auth.validation.ts` (added `loginSchema`, `LoginInput`)
  - `src/app/modules/auth/auth.service.ts` (added `loginWithCredentials` with pre-auth anti-enumeration, verification, and status guards)
  - `src/app/modules/auth/auth.controller.ts` (added `loginWithCredentials` with `fromNodeHeaders` and `res.setHeader("set-cookie", ...)`)
  - `src/app/modules/auth/auth.routes.ts` (mounted `POST /login` with `validateRequest(AuthValidation.loginSchema)`)
  - `src/app/errors/handlePrismaError.ts` (hardened P2002 field extraction and connection error mapping)
  - `src/app/middleware/globalErrorHandler.ts` (propagate field errors)
  - `docs/governance/07-TECHNOLOGY-INTEGRATIONS-GUIDE.md` (authoritative Prisma and Better Auth documentation)
- **Test / Verification Output:**
  - `pnpm lint`: Passed (0 errors, 0 warnings).
  - `pnpm build`: Passed (`tsc` completed with 0 errors).
  - Executable Contract Checks:
    1. Validation Gate: POST `{}` -> HTTP 400 (`VALIDATION_ERROR`, missing email and password fields).
    2. Missing User Gate: POST non-existent user -> HTTP 401 (`INVALID_CREDENTIALS`, "Invalid email or password").
    3. Wrong Password Gate: POST valid email with wrong password -> HTTP 401 (`INVALID_CREDENTIALS`).
    4. Unverified Email Gate: POST unverified email -> HTTP 403 (`EMAIL_NOT_VERIFIED`, "Please verify your email before logging in").
    5. Suspended Account Gate: POST suspended user -> HTTP 403 (`ACCOUNT_SUSPENDED`).
    6. Deactivated Account Gate: POST deactivated user -> HTTP 403 (`ACCOUNT_DEACTIVATED`).
    7. Soft-Deleted Account Gate: POST user with `deletedAt !== null` -> HTTP 401 (`INVALID_CREDENTIALS`, anti-enumeration check).
    8. Happy Path (Login Success): POST valid credentials on active verified account -> HTTP 200 OK, `Set-Cookie` header present (`better-auth.session_token=...; HttpOnly; SameSite=Lax; Path=/`), sanitized user payload returned (`id`, `name`, `email`, `emailVerified: true`, `role: "CUSTOMER"`, `status: "ACTIVE"`).
- **Deviations from Original Plan:**
  - Method name in Service and Controller refined from generic `login` to domain-specific `loginWithCredentials` to establish clean symmetry with upcoming social authentication (`loginWithGoogle`).
- **Remaining Concerns / Follow-ups:** None. All acceptance criteria fully met. Ready for human closure review.
