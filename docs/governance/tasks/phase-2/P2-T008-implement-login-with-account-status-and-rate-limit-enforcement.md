# Task: P2-T008 - Implement Login with Account-Status and Rate-Limit Enforcement

> **Canonical Status:** `🔄 In progress`  
> **Planning Gate:** Draft Plan → Human Approval → Blocker Clearance (`P2-B001`) → `🔄 In progress`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T008`
- **PRD / Requirement Reference:** `FR-AUTH-005` (Email/Password Login), `FR-RBAC-006.1` (Account Status Enforcement)
- **ERD Reference:** `User` (`status`, `deletedAt`, `emailVerified`), `Session`, `Account`
- **Dependencies:** `P2-T005` (`✅ Done`), `P2-T006` (`✅ Done`), `P2-T007` (`✅ Done`)
- **Active Blockers:** `P2-B001` (Public API: Approval of endpoint `POST /api/v1/auth/login`)

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

- `src/app/config/auth.ts`: Better Auth configured with `emailAndPassword` (`requireEmailVerification: true`), 7-day session, 15-minute `cookieCache`, and `emailOTP` plugin.
- `src/app/modules/auth/auth.validation.ts`: Contains schemas for registration and OTP verification.
- `src/app/modules/auth/auth.service.ts`: Contains customer registration, OTP dispatch, and OTP verification.
- `src/app/errors/errorCodes.ts`: Central error code registry.

---

## 4. Implementation Approach

`Route → validateRequest(loginSchema) → Controller → Service → Better Auth API / Prisma Status Check`

1. **Error Codes Update (`src/app/errors/errorCodes.ts`):**
   - Add `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_DEACTIVATED`, `ACCOUNT_DELETED`.
2. **Zod Validation (`src/app/modules/auth/auth.validation.ts`):**
   - Add `loginSchema` validating `email` and `password` (required string).
   - Export inferred type `LoginInput`.
3. **Auth Service (`src/app/modules/auth/auth.service.ts`):**
   - Implement `login(payload, req, res)` or `login(payload)`:
     - Check pre-auth account status in database (soft-delete, suspended, deactivated, emailVerified).
     - Invoke `auth.api.signInEmail`.
     - Return sanitized user details while ensuring cookies are set on Express response.
4. **Auth Controller & Routes (`auth.controller.ts`, `auth.routes.ts`):**
   - Controller handler `login` wrapping service in `catchAsync`.
   - Mount `POST /api/v1/auth/login` with `validateRequest(AuthValidation.loginSchema)`.

---

## 5. Affected Files & Directives

| Action | File Path | Responsibility |
| :----- | :-------- | :------------- |
| `[MODIFY]` | `src/app/errors/errorCodes.ts` | Add login and account-status error codes |
| `[MODIFY]` | `src/app/modules/auth/auth.validation.ts` | Add `loginSchema` and `LoginInput` type |
| `[MODIFY]` | `src/app/modules/auth/auth.service.ts` | Implement `login` service method |
| `[MODIFY]` | `src/app/modules/auth/auth.controller.ts` | Implement `login` controller handler |
| `[MODIFY]` | `src/app/modules/auth/auth.routes.ts` | Mount `POST /api/v1/auth/login` endpoint |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md` | Update `P2-T008` index and resolve blocker |
| `[MODIFY]` | `docs/governance/tasks/phase-2/P2-T008-implement-login-with-account-status-and-rate-limit-enforcement.md` | JIT task plan & evidence |

---

## 6. Step-by-Step Execution Plan

1. **Gate 1: Review & Human Approval:**
   - Submit this plan for human review and resolve `P2-B001` for `POST /api/v1/auth/login`.
   - Once approved, mark `P2-T008` as `🔄 In progress`.
2. **Step 2: Error Registry & Zod Validation:**
   - Add required error codes to `PUBLIC_ERROR_CODES`.
   - Create `loginSchema` and export `LoginInput`.
3. **Step 3: Service Implementation:**
   - Implement `login` with status checks and Better Auth invocation.
4. **Step 4: Controller & Route Mounting:**
   - Implement controller handler and mount route with validation middleware.
5. **Step 5: Verification & Quality Gates:**
   - Verify active user login -> receives session cookie and user profile.
   - Verify invalid password -> receives 401 `INVALID_CREDENTIALS`.
   - Verify unverified user -> receives 403 `EMAIL_NOT_VERIFIED`.
   - Verify suspended/deactivated user -> receives 403 forbidden.
   - Run `pnpm lint` and `pnpm build`.
6. **Gate 2: Human Review & Closure:**
   - Record implementation evidence and mark `🕵️ Awaiting human review`.

---

## 7. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :---- | :------- | :---------------- | :----- |
| Acceptance criteria | `Yes` | PRD FR-AUTH-005 & FR-RBAC-006.1 inspection | `NOT RUN` |
| Type check / build | `Yes` | `pnpm build` | `NOT RUN` |
| Lint | `Yes` | `pnpm lint` | `NOT RUN` |
| Valid credential login | `Yes` | Returns 200 + sets session cookie | `NOT RUN` |
| Invalid credential rejection | `Yes` | Returns 401 `INVALID_CREDENTIALS` | `NOT RUN` |
| Unverified account rejection | `Yes` | Returns 403 `EMAIL_NOT_VERIFIED` | `NOT RUN` |
| Restricted account rejection | `Yes` | Returns 403 for SUSPENDED / DEACTIVATED | `NOT RUN` |

---

## 8. Assumptions & Blockers

- **Active Blockers:** `P2-B001` (Endpoint approval for `POST /api/v1/auth/login`).
- **Assumptions:** Session is communicated exclusively via secure httpOnly cookies adhering to `DEC-003` and `DEC-014`.

---

## 9. Plan Review

| Field | Value |
| :---- | :---- |
| Outcome | `Pending` |
| Reviewed by | Zahidul Islam |
| Reviewed on | Pending |
| Notes | Awaiting human approval before marking in progress |

---

## 10. Implementation Evidence

_To be completed after code execution and before marking awaiting human review._
