# Task: P2-T012 - Implement Password Reset

> **Canonical Status:** `✅ Done`  
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-AUTH-006` (`FR-AUTH-006.1` – `FR-AUTH-006.7`)  
> **ERD Reference:** `User`, `Account`, `Session`, `Verification`  
> **Dependencies:** `P2-T005` (✅), `P2-T007` (✅)  
> **Planning Gate:** Plan Approved → `🔄 In Progress`

---

## 1. Context & Traceability

- **Objective:** Provide a secure, non-enumerating Better Auth password-reset flow via the SMTP email boundary, ensuring time-limited single-use token validation, session invalidation, and password policy enforcement.
- **PRD Alignment:**
  - `FR-AUTH-006.1`: Password reset can be initiated using registered email address through Better Auth.
  - `FR-AUTH-006.2`: Send a secure, time-limited, and single-use password reset link.
  - `FR-AUTH-006.3`: Prevent user enumeration: registered and unregistered email addresses receive the identical generic reset response.
  - `FR-AUTH-006.4`: Password and credential management handled securely by Better Auth.
  - `FR-AUTH-006.5`: Successful password reset invalidates all existing sessions (`revokeSessionsOnPasswordReset: true`).
  - `FR-AUTH-006.6`: Google-only accounts must not reveal account existence or force password reset; if initiated, user receives guidance or generic response without leaking status.
  - `FR-AUTH-006.7`: Password reset requests must be rate-limited (enforced at reverse proxy boundary per `DEC-019`).
- **Decisions & Blockers:**
  - `P2-B001`: Endpoints approved as `POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password`.
  - `P2-B005`: All active sessions invalidated on password reset via `revokeSessionsOnPasswordReset: true`.

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Better Auth Password Reset Configuration (`src/app/config/auth.ts`):**
   - Enable `emailAndPassword.sendResetPassword` callback.
   - Configure `resetPasswordTokenExpiresIn: 60 * 15` (15 minutes token lifetime).
   - Configure `revokeSessionsOnPasswordReset: true` to revoke all active sessions on successful password reset (`FR-AUTH-006.5`).
   - Deliver branded password reset email via `AuthMailer.sendPasswordResetLink`.
2. **Branded Email Template & Mailer:**
   - Create `ResetPasswordEmail.tsx` template under `src/app/shared/email/templates/` using React Email and luxury studio design.
   - Add `sendPasswordResetLink` method to `AuthMailer` (`src/app/shared/email/mailers/auth.mailer.ts`).
3. **Validation Schemas (`src/app/modules/auth/auth.validation.ts`):**
   - `forgotPasswordSchema`: validates `email` (standard email format) and optional `redirectTo` string.
   - `resetPasswordSchema`: validates `token` (non-empty string) and `newPassword` (satisfying system password policy: min 8, max 100, uppercase, lowercase, number, special char).
4. **Service Methods (`src/app/modules/auth/auth.service.ts`):**
   - `forgotPassword(payload, headers)`:
     - Resolves frontend reset callback URL from `payload.redirectTo`.
     - Calls `auth.api.requestPasswordReset`.
     - Returns constant generic response message regardless of user existence or provider setup (`FR-AUTH-006.3`).
   - `resetPassword(payload, headers)`:
     - Calls `auth.api.resetPassword({ body: { token: payload.token, newPassword: payload.newPassword }, headers })`.
     - Clears any existing cookies if returned, and returns standardized success response.
5. **Controller & Routes (`src/app/modules/auth/auth.controller.ts`, `auth.routes.ts`):**
   - Implement `forgotPassword` and `resetPassword` controller handlers.
   - Mount public routes:
     - `POST /api/v1/auth/forgot-password`
     - `POST /api/v1/auth/reset-password`

### Out of Scope

- Authenticated password change or setting initial password for Google-only users (`P2-T013`).
- Full logout / session revocation endpoint (`P2-T014`).
- Client UI reset-password page implementation (frontend responsibility).

---

## 3. Read-Only Inspection Summary (Pre-Implementation Baseline Snapshot)

- `src/app/config/auth.ts`: `emailAndPassword.enabled: true`. Currently lacks `sendResetPassword` callback and `revokeSessionsOnPasswordReset`.
- `src/app/shared/email/mailers/auth.mailer.ts`: already contains `sendVerificationOtp`. Can cleanly add `sendPasswordResetLink`.
- `src/app/shared/email/templates/`: contains `VerificationEmail.tsx`. Can establish matching `ResetPasswordEmail.tsx`.
- `src/app/modules/auth/auth.routes.ts`: currently mounts register, verification OTP, login, and Google endpoints.

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  `Route → validateRequest → Controller → Service → Better Auth API / AuthMailer → SMTP / PostgreSQL`
- **Anti-Enumeration Contract:**
  Regardless of whether the email exists in DB, whether it has an unverified status, or whether it only has a Google account, the endpoint returns:
  ```json
  {
    "success": true,
    "message": "If an account with that email exists, password reset instructions have been sent.",
    "data": null
  }
  ```
- **Reset Token Execution:**
  Submitting valid token + valid password resets credentials in DB and revokes all active sessions for that user.

---

## 5. Affected Files & Directives

| Action | File Path | Responsibility |
| :----- | :-------- | :------------- |
| `[NEW]` | `src/app/shared/email/templates/ResetPasswordEmail.tsx` | React Email template for password reset link |
| `[MODIFY]` | `src/app/shared/email/mailers/auth.mailer.ts` | Add `sendPasswordResetLink` method |
| `[MODIFY]` | `src/app/config/auth.ts` | Configure `sendResetPassword`, `resetPasswordTokenExpiresIn`, and `revokeSessionsOnPasswordReset` |
| `[MODIFY]` | `src/app/modules/auth/auth.validation.ts` | Add `forgotPasswordSchema` and `resetPasswordSchema` |
| `[MODIFY]` | `src/app/modules/auth/auth.service.ts` | Implement `forgotPassword` and `resetPassword` |
| `[MODIFY]` | `src/app/modules/auth/auth.controller.ts` | Add `forgotPassword` and `resetPassword` controller handlers |
| `[MODIFY]` | `src/app/modules/auth/auth.routes.ts` | Mount `/forgot-password` and `/reset-password` routes |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md` | Track `P2-T012` progress (`🔲` → `🔄` → `✅`) |
| `[NEW]` | `docs/governance/tasks/phase-2/P2-T012-implement-password-reset.md` | JIT task plan and execution evidence |

---

## 6. Step-by-Step Execution Plan

1. **Step 1: Plan Review & Gate Transition:**
   - Present JIT plan to human supervisor.
   - Upon explicit approval, update `P2-T012` status to `🔄 In progress` in task file and parent phase file.
2. **Step 2: Email Template & Mailer Setup:**
   - Create `ResetPasswordEmail.tsx` and integrate into `AuthMailer.sendPasswordResetLink`.
3. **Step 3: Better Auth Configuration & Validation Schemas:**
   - Update `auth.ts` with `sendResetPassword`, `resetPasswordTokenExpiresIn`, and `revokeSessionsOnPasswordReset`.
   - Add Zod validation schemas (`forgotPasswordSchema`, `resetPasswordSchema`) in `auth.validation.ts`.
4. **Step 4: Service & Controller Implementation:**
   - Implement `AuthService.forgotPassword` and `AuthService.resetPassword`.
   - Implement `AuthController.forgotPassword` and `AuthController.resetPassword`.
   - Mount routes in `auth.routes.ts`.
5. **Step 5: Comprehensive Automated Verification:**
   - Verify non-enumeration: nonexistent email returns 200 generic message.
   - Verify email dispatch for registered credential user.
   - Verify reset token consumption updates password.
   - Verify old password no longer works, new password authenticates.
   - Verify existing sessions are revoked on password reset.
   - Verify token is single-use and invalid/expired token returns 400.
6. **Step 6: Quality Gates & Task Closure:**
   - Run `pnpm exec tsc --noEmit` and `pnpm lint`.
   - Record evidence in JIT file, submit for human review (`🕵️`), and upon approval finalize closure (`✅ Done`).

---

## 7. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :---- | :------- | :---------------- | :----- |
| Acceptance criteria | `Yes` | Verify all acceptance criteria under `FR-AUTH-006` | `PASS` |
| Type check / build | `Yes` | `pnpm exec tsc --noEmit` | `PASS` |
| Lint | `Yes` | `pnpm lint` | `PASS` |
| Non-enumeration check | `Yes` | Verify unregistered email returns 200 generic message | `PASS` |
| Token reset check | `Yes` | Verify valid token resets password and allows login | `PASS` |
| Session revocation check | `Yes` | Verify previous active session is revoked after reset | `PASS` |
| Single-use check | `Yes` | Verify reused token returns error | `PASS` |

---

## 8. Assumptions & Blockers

- **Active Blockers:** `P2-B001` (endpoint paths approved as `/forgot-password` and `/reset-password`), `P2-B005` (session revocation approved via `revokeSessionsOnPasswordReset: true`).
- **Design Assumptions:**
  - Token validity is 15 minutes.
  - Reset link points to frontend `/reset-password?token=...` or custom `redirectTo`.

---

## 9. Plan Review

| Field | Value |
| :---- | :---- |
| Outcome | `Approved` |
| Reviewed by | Zahidul Islam |
| Reviewed on | `2026-09-15` |
| Notes | Approved task breakdown, endpoints (/forgot-password and /reset-password), session revocation policy, and 6-step execution plan for P2-T012. |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `src/app/shared/email/templates/ResetPasswordEmail.tsx`: Luxury studio branded React Email template for password reset link delivery.
  - `src/app/shared/email/mailers/auth.mailer.ts`: Added `sendPasswordResetLink` mailer method.
  - `src/app/config/auth.ts`: Configured `emailAndPassword.sendResetPassword` callback (with immediate dangling token invalidation for ineligible accounts via `prisma.verification.deleteMany`), `resetPasswordTokenExpiresIn: 60 * 15` (15m lifetime), `revokeSessionsOnPasswordReset: true` for automatic session revocation, and `onPasswordReset` hook to reset `needPasswordChange: false`.
  - `src/app/modules/auth/auth.validation.ts`: Added `forgotPasswordSchema` and `resetPasswordSchema` with inferred types `ForgotPasswordInput` and `ResetPasswordInput`.
  - `src/app/modules/auth/auth.service.ts`: Implemented `forgotPassword` and `resetPassword` service methods with anti-enumeration protection and cookie pass-through.
  - `src/app/modules/auth/auth.controller.ts`: Implemented `forgotPassword` and `resetPassword` controller handlers.
  - `src/app/modules/auth/auth.routes.ts`: Mounted `POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password`.
- **Migration Created:** None required (reuses existing Better Auth `verification`, `user`, and `account` schemas).
- **Test / Verification Output:**
  - `pnpm test`: 330/330 unit tests pass across 24 test files with 100% statement, branch, function, and line coverage on `auth.validation.ts`, `auth.mailer.ts`, `config/auth.ts`, `auth.service.ts`, and `auth.controller.ts`.
  - **Vitest Unit Test Suite Expansion (`P2-T012`):**
    - `tests/unit/modules/auth/auth.validation.test.ts` (76 tests): Thorough boundary, whitespace trimming, type defense (`number`, `boolean`, `array`, `object`), email length limit (>255 chars), token validation (empty after trim, max 256 chars), and password complexity assertions across `forgotPasswordSchema` and `resetPasswordSchema`.
    - `tests/unit/shared/email/mailers/auth.mailer.test.ts` (4 tests): Verifies `sendPasswordResetLink` template rendering with `ResetPasswordEmail`, correct subject and plain-text fallback, and upstream dispatch error propagation.
    - `tests/unit/config/auth.test.ts` (35 tests): Verifies `emailAndPassword.sendResetPassword` callback token invalidation for non-existent users, soft-deleted users, suspended accounts, and passwordless OAuth accounts; explicit vs fallback user name dispatch; 15-minute token expiration (`resetPasswordTokenExpiresIn: 900`); session revocation (`revokeSessionsOnPasswordReset: true`); and `onPasswordReset` flag clearance.
    - `tests/unit/modules/auth/auth.service.test.ts` (54 tests): Verifies `forgotPassword` custom callback URL resolution, default `/reset-password` fallback, constant generic response, and `resetPassword` success message, session cookies extraction, undefined/empty cookie handling, and Better Auth API error propagation.
    - `tests/unit/modules/auth/auth.controller.test.ts` (38 tests): Verifies `forgotPassword` and `resetPassword` request context parsing, standard 200 response envelopes, empty cookie bypass, negative `res.setHeader` assertions on failure and cookie omission, and `catchAsync` error forwarding.
    - `tests/unit/modules/auth/auth.routes.test.ts` (15 tests): Verifies `POST /forgot-password` and `POST /reset-password` route configurations and method exclusivity against `get`, `put`, and `delete`.
  - `pnpm exec tsx scratch/verify_p2_t012.ts`: All 8 integration test scenarios passed with exit code 0:
    - Case 1: Non-existent email forgot-password ➔ 200 OK generic message, 0 email dispatched (`pass: true`)
    - Case 2: Google-only user forgot-password ➔ 200 OK generic message, 0 email dispatched (`pass: true`)
    - Case 3: Weak password rejected by policy ➔ 400 Bad Request `VALIDATION_ERROR` (`pass: true`)
    - Case 4: Valid customer reset initiation ➔ 200 OK, reset link dispatched to mailer (`pass: true`)
    - Case 5: Active session established before reset ➔ 200 OK with session cookie (`pass: true`)
    - Case 6: Password reset using token ➔ 200 OK, password updated, `needPasswordChange` cleared (`pass: true`)
    - Case 7: Credential Authentication check ➔ Old password returns 401 `INVALID_CREDENTIALS`, new password returns 200 OK (`pass: true`)
    - Case 8: Security controls ➔ Pre-reset session rejected with 401 `UNAUTHORIZED` (revoked), reused token rejected with 400 Bad Request (`pass: true`)
  - `pnpm tsc --project tsconfig.test.json --noEmit`: 0 errors.
  - `pnpm lint`: 0 errors / 0 warnings.
- **Deviations from Original Plan:** None. Implemented strictly according to PRD `FR-AUTH-006`, ERD, and governance guidelines.
- **Remaining Concerns / Follow-ups:**
  - Password-reset email delivery currently runs synchronously within the request lifecycle. A durable background task runner is recommended for a future infrastructure phase to remove SMTP-dependent response-time differences and provide reliable delivery retries.

---

## 11. Final Review & Approval

| Field | Value |
| :---- | :---- |
| Outcome | `Approved` |
| Reviewed by | Zahidul Islam |
| Reviewed on | `2026-09-16` |
| Notes | Implementation verified across all 8 test cases, including anti-enumeration, password policy enforcement, token reset, session revocation, and single-use token prevention. Task officially approved and marked Done. |

