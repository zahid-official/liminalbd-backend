# Task: P2-T013 - Implement Change or Set Password

> **Canonical Status:** `🔄 In progress`  
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-AUTH-007` (`FR-AUTH-007.1` – `FR-AUTH-007.5`)  
> **ERD Reference:** `User`, `Account`, `Session`  
> **Dependencies:** `P2-T008` (✅), `P2-T010` (✅)  
> **Planning Gate:** Draft Plan → Human Approval → `🔄 In progress`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T013`
- **Objective:** Allow authenticated users to securely change their existing password or set an initial password for Google-only accounts behind the session authentication guard (`authGuard`), verifying current credentials where applicable and preserving linked OAuth accounts.
- **PRD Alignment:**
  - `FR-AUTH-007.1`: Users with an existing password credential must confirm their current password before changing it; incorrect current password returns `HTTP 400 Bad Request`.
  - `FR-AUTH-007.2`: Enforce the configured password policy (minimum 8 characters, maximum 100 characters, uppercase, lowercase, number, special character).
  - `FR-AUTH-007.3`: Users without a password credential (e.g., Google-only signups) can set an application password through the supported flow.
  - `FR-AUTH-007.4`: Adding or changing a password must strictly preserve other linked authentication methods (e.g., linked Google account remains active).
  - `FR-AUTH-007.5`: Password changes must follow session security policy (optionally revoking other active sessions while preserving the current authenticated session).
- **Decisions & Blockers:**
  - `P2-B001`: Public API endpoints approved as `POST /api/v1/auth/change-password` and `POST /api/v1/auth/set-password`.
  - `P2-B005`: Session security policy on password change defaults to revoking other sessions (`revokeOtherSessions: true`) while maintaining current session continuity.

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Change Password Endpoint (`POST /api/v1/auth/change-password`):**
   - Protected by `authGuard`.
   - Validates `currentPassword` (non-empty string), `newPassword` (using shared `passwordSchema`), and optional `revokeOtherSessions` (boolean, default `true`).
   - Rejects incorrect current password with `HTTP 400 Bad Request`.
   - Rejects weak or non-compliant new password with `HTTP 400 Bad Request` (`VALIDATION_ERROR`).
   - Resets `needPasswordChange: false` on the User record upon successful update.
   - Forwards updated session cookies if returned by Better Auth.
2. **Set Initial Password Endpoint (`POST /api/v1/auth/set-password`):**
   - Protected by `authGuard`.
   - Specifically dedicated to authenticated accounts that currently have no password credential (e.g., Google OAuth users).
   - Validates `newPassword` (using shared `passwordSchema`).
   - Rejects users who already have an existing password with `HTTP 400 Bad Request` (preventing bypass of current password verification).
   - Preserves existing Google account linking in the `account` table (`FR-AUTH-007.4`).
   - Resets `needPasswordChange: false` on the User record upon successful password creation.
3. **Error Code Mapping (`src/app/errors/handleBetterAuthError.ts`):**
   - Ensure Better Auth `INVALID_PASSWORD` error code maps to `HTTP 400 Bad Request` with `PUBLIC_ERROR_CODES.INVALID_CREDENTIALS` and clear message: `"Incorrect current password"`.
   - Ensure Better Auth `PASSWORD_ALREADY_SET` or related errors map to `HTTP 400 Bad Request`.

### Out of Scope

- Unauthenticated password reset via email OTP / link (`P2-T012` - already Done).
- Session logout or revoking all sessions without password change (`P2-T014`).
- Administrative password reset on behalf of another user (`P2-T019`).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :--- | :--- | :--- |
| `FR-AUTH-007.1`: Current password required & verified for existing password accounts; incorrect value returns 400 | Step 3, 4 | Executable test verifying wrong current password returns 400 |
| `FR-AUTH-007.2`: Password policy enforced on new password | Step 2 | Executable test verifying weak new password returns 400 VALIDATION_ERROR |
| `FR-AUTH-007.3`: Google-only users can set an initial password | Step 3, 4 | Executable test verifying Google user successfully sets password and can subsequently log in with email/password |
| `FR-AUTH-007.4`: Linked Google accounts preserved | Step 3, 4 | Executable test verifying Google account remains linked after password change/set |
| `FR-AUTH-007.5`: Session security policy applied (revoke other sessions) | Step 3, 4 | Executable test verifying other active sessions are revoked while current session continues |

---

## 3. Verified Current Codebase State

- `src/app/middleware/authGuard.ts`: Injects `res.locals.user` and `res.locals.session` (`AuthUser`, `AuthSession` from `src/app/modules/auth/auth.interface.ts` per `DEC-022`).
- `src/app/validations/common.validation.ts`: Provides centralized `passwordSchema` (min 8, max 100, regex complexity).
- `src/app/config/auth.ts`: Better Auth configured with `emailAndPassword.enabled: true`. Better Auth API exposes `auth.api.changePassword` and `auth.api.setPassword`.
- `src/app/modules/auth/auth.service.ts`: Exposes authentication workflows; uses `fromNodeHeaders` and `resolveCallbackURL`.
- `src/app/modules/auth/auth.controller.ts`: Uses `catchAsync`, `sendResponse`, and header cookie forwarding.
- `src/app/modules/auth/auth.routes.ts`: Router mounting authentication endpoints with `authGuard` protection.

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  `Route (authGuard) → validateRequest → Controller → Service → Better Auth API / Prisma → PostgreSQL`
- **Change Password Logic:**
  1. Controller reads validated `currentPassword`, `newPassword`, `revokeOtherSessions` from `res.locals.validated.body`.
  2. Service calls `auth.api.changePassword({ body: { currentPassword, newPassword, revokeOtherSessions: revokeOtherSessions ?? true }, headers })`.
  3. If successful, clear `needPasswordChange: false` on the User record.
  4. Returns standardized success message and forwards updated session cookies if emitted.
- **Set Password Logic:**
  1. Service checks if user already has an active password credential (`account.findFirst({ where: { userId, providerId: "credential", password: { not: null } } })`).
  2. If a password credential already exists, throw `AppError(400, PUBLIC_ERROR_CODES.CONFLICT, "A password has already been set for this account. Please use change password.")`.
  3. Otherwise, calls `auth.api.setPassword({ body: { newPassword }, headers })`.
  4. Clears `needPasswordChange: false` on the User record.
  5. Returns standardized success message.

---

## 5. Affected Files & Directives

| Action | File Path | Responsibility |
| :----- | :-------- | :------------- |
| `[MODIFY]` | `src/app/modules/auth/auth.validation.ts` | Define `changePasswordSchema` and `setPasswordSchema` |
| `[MODIFY]` | `src/app/modules/auth/auth.service.ts` | Implement `changePassword` and `setPassword` service methods |
| `[MODIFY]` | `src/app/modules/auth/auth.controller.ts` | Implement `changePassword` and `setPassword` controller handlers |
| `[MODIFY]` | `src/app/modules/auth/auth.routes.ts` | Mount `POST /change-password` and `POST /set-password` behind `authGuard` |
| `[MODIFY]` | `src/app/errors/handleBetterAuthError.ts` | Map Better Auth password errors to HTTP 400 per PRD |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md` | Track `P2-T013` progress (`🔲` → `🔄` → `✅`) |
| `[NEW]` | `docs/governance/tasks/phase-2/P2-T013-implement-change-or-set-password.md` | JIT task plan and execution evidence |

---

## 6. Step-by-Step Execution Plan

1. **Step 1: JIT Task Plan Review & Planning Gate Transition:**
   - Present JIT plan to human reviewer.
   - Upon explicit approval, transition `P2-T013` to `🔄 In progress` in parent phase file and task file.
2. **Step 2: Validation Schemas (`auth.validation.ts`):**
   - Add `changePasswordSchema` (`currentPassword`, `newPassword`, `revokeOtherSessions`).
   - Add `setPasswordSchema` (`newPassword`).
   - Export inferred types `ChangePasswordInput` and `SetPasswordInput`.
3. **Step 3: Service Layer Implementation (`auth.service.ts`):**
   - Implement `AuthService.changePassword` with Better Auth `changePassword` and `needPasswordChange` cleanup.
   - Implement `AuthService.setPassword` with existing credential check, Better Auth `setPassword`, and `needPasswordChange` cleanup.
4. **Step 4: Controller & Routes Integration (`auth.controller.ts`, `auth.routes.ts`):**
   - Implement `AuthController.changePassword` and `AuthController.setPassword`.
   - Mount `POST /api/v1/auth/change-password` and `POST /api/v1/auth/set-password` with `authGuard` and `validateRequest`.
5. **Step 5: Unified Verification Cycle:**
   - Run automated test script covering:
     1. Unauthenticated requests rejected with 401.
     2. Weak new password rejected with 400 VALIDATION_ERROR.
     3. Incorrect current password rejected with 400.
     4. Correct current password successfully changes password (200) and clears `needPasswordChange`.
     5. Old password rejected (401), new password authenticates (200).
     6. Other sessions revoked when `revokeOtherSessions: true`.
     7. Google-only user sets initial password successfully (200), preserving Google account linking.
     8. User with existing password calling `/set-password` rejected with 400.
   - Run `pnpm exec tsc --noEmit` and `pnpm lint`.
   - Record implementation evidence in Section 10 of JIT task file.
   - Clean up scratch test script.
6. **Step 6: Human Review & Task Closure:**
   - Transition to `🕵️ Awaiting human review`, present review evidence, and wait for human approval.
   - Upon approval, mark `✅ Done`, update `MEMORY.md`, and propose git commit message.

---

## 7. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :---- | :------- | :---------------- | :----- |
| Acceptance criteria | `Yes` | Verify all acceptance criteria under `FR-AUTH-007` | `NOT RUN` |
| Type check / build | `Yes` | `pnpm exec tsc --noEmit` | `NOT RUN` |
| Lint | `Yes` | `pnpm lint` | `NOT RUN` |
| Unauthenticated check | `Yes` | Verify missing/invalid session returns 401 | `NOT RUN` |
| Wrong current password | `Yes` | Verify incorrect current password returns 400 | `NOT RUN` |
| Password policy check | `Yes` | Verify weak new password returns 400 | `NOT RUN` |
| Change password flow | `Yes` | Verify valid change password allows login with new credentials | `NOT RUN` |
| Google user set password | `Yes` | Verify Google user sets password while preserving Google account | `NOT RUN` |
| Set password guard | `Yes` | Verify user with existing password cannot call set-password | `NOT RUN` |

---

## 8. Assumptions & Blockers

- **Active Blockers:** `P2-B001` (endpoints approved as `/change-password` and `/set-password`), `P2-B005` (session security policy approved as `revokeOtherSessions: true` by default).
- **Design Assumptions:**
  - Authenticated session is preserved for the current client device after password change.

---

## 9. Plan Review

| Field | Value |
| :---- | :---- |
| Outcome | `Approved` |
| Reviewed by | Zahidul Islam |
| Reviewed on | `2026-09-17` |
| Notes | Approved JIT plan and execution steps for change-password and set-password flows. |

---

## 10. Implementation Evidence

_To be populated during Step 5 after implementation and verification._
