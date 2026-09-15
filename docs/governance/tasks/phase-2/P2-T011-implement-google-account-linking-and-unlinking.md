# Task: P2-T011 - Implement Google Account Linking and Unlinking

> **Canonical Status:** `🔄 In progress`  
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-AUTH-003` (`FR-AUTH-003.1` – `FR-AUTH-003.6`)  
> **ERD Reference:** `Account`, `User`  
> **Dependencies:** `P2-T009` (✅), `P2-T010` (✅)

---

## 1. Context & Traceability

- **Objective:** Allow authenticated users to manage their Google authentication method safely behind the authentication guard (`authGuard`), preventing sole authentication method removal (`HTTP 422`), preventing duplicate cross-account linking (`HTTP 409`), and enforcing customer-only portal boundaries per `DEC-020` (`HTTP 403`).
- **PRD Alignment:**
  - `FR-AUTH-003.1`: System must allow an authenticated user to link a Google account.
  - `FR-AUTH-003.2`: System must prevent unauthorized account linking (requires active authenticated session; already linked Google accounts cannot be linked again).
  - `FR-AUTH-003.3`: System must allow users to unlink a linked Google account when another valid authentication method remains.
  - `FR-AUTH-003.4`: System must prevent removal of the user's only authentication method (returns `HTTP 422 Unprocessable Entity`).
  - `FR-AUTH-003.5`: Sensitive authentication changes require valid session authentication assurance.
  - `FR-AUTH-003.6`: Account linking or unlinking must never modify the user's application role (`role` remains unchanged).
- **Decisions Alignment:**
  - `DEC-020`: Public customer authentication boundaries apply. Administrative accounts (`ADMIN`, `SUPER_ADMIN`) cannot link or use Google authentication. Any administrative user attempting to link Google receives `HTTP 403 Forbidden` (`FORBIDDEN_ROLE_ACCESS`).

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Initiate Google Account Linking (`POST /api/v1/auth/link/google`):**
   - Protected by `authGuard` (`P2-T010`).
   - Validate that authenticated user has `CUSTOMER` role (`DEC-020`); reject `ADMIN` / `SUPER_ADMIN` with `HTTP 403 Forbidden` (`FORBIDDEN_ROLE_ACCESS`).
   - Check if the user already has a linked Google account (`prisma.account`); if so, reject with `HTTP 409 Conflict` (`PUBLIC_ERROR_CODES.ACCOUNT_ALREADY_LINKED`).
   - Call Better Auth `auth.api.linkSocialAccount` with provider `"google"` and optional client `callbackURL` (with fallback to default frontend profile/settings URL).
   - Return redirect authorization URL or payload to client.
2. **Google Account Unlinking (`POST /api/v1/auth/unlink/google`):**
   - Protected by `authGuard` (`P2-T010`).
   - Verify user currently has a linked Google account. If not linked, reject with `HTTP 400 Bad Request` (`PUBLIC_ERROR_CODES.ACCOUNT_NOT_LINKED`).
   - Check remaining authentication methods: inspect `prisma.account` for the user. If Google is the user's sole authentication method (e.g. no password / credential account exists), reject with `HTTP 422 Unprocessable Entity` (`PUBLIC_ERROR_CODES.CANNOT_UNLINK_SOLE_METHOD`).
   - If another authentication method exists (e.g. password set), safely unlink/delete the Google `Account` record.
   - Return standardized success response (`HTTP 200 OK`).
3. **Public Error Codes Registration (`src/app/errors/errorCodes.ts`):**
   - Register `ACCOUNT_ALREADY_LINKED`, `ACCOUNT_NOT_LINKED`, and `CANNOT_UNLINK_SOLE_METHOD`.
4. **Zod Validation (`src/app/modules/auth/auth.validation.ts`):**
   - Define validation schema for link request query/body (e.g. `callbackURL` parameter).

### Out of Scope

- Password reset flow (`P2-T012`).
- Setting a password for Google-only users (`P2-T013`).
- Logout and session revocation (`P2-T014`).
- Additional third-party OAuth providers beyond Google (GitHub, Facebook, etc.).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Require active session for linking and unlinking | Step 4 | Request without cookie returns `401 Unauthorized` |
| Allow authenticated customer to initiate Google linking | Step 3, Step 5 | Programmatic check verifying link response returns redirect URL with Google OAuth parameters |
| Reject linking if user already has Google linked | Step 3, Step 5 | Request to link Google when already linked returns `409 Conflict` (`ACCOUNT_ALREADY_LINKED`) |
| Reject linking attempt by administrative roles (`DEC-020`) | Step 3, Step 5 | Admin session attempting link returns `403 Forbidden` (`FORBIDDEN_ROLE_ACCESS`) |
| Unlink Google account when alternative auth method exists | Step 3, Step 5 | User with password + Google successfully unlinks Google (returns `200 OK`, Google account removed from DB) |
| Prevent removal of sole authentication method (`FR-AUTH-003.4`) | Step 3, Step 5 | User with only Google auth attempting unlink returns `422 Unprocessable Entity` (`CANNOT_UNLINK_SOLE_METHOD`) |
| Preserve user role across linking/unlinking operations | Step 3, Step 5 | Verify `user.role` remains intact in database before and after link/unlink |

---

## 3. Verified Current Codebase State

- `src/app/middleware/authGuard.ts`: verified and operational; attaches `req.user`, `req.session`, `res.locals.user`, `res.locals.session`.
- `src/app/config/auth.ts`:
  - `accountLinking.enabled: true` and `trustedProviders: ["google"]`.
  - `databaseHooks.account.create.before`: blocks administrative accounts from linking Google (`FORBIDDEN_ROLE_ACCESS`).
- `src/app/modules/auth/auth.controller.ts` & `auth.service.ts`: handles customer registration, OTP verification, credential login, and Google OAuth login. Account link/unlink endpoints are not yet implemented.
- `prisma/schema/auth.prisma`: `Account` model stores `providerId` (`"credential"` or `"google"`), `userId`, `accountId`.

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  `Route → authGuard → validateRequest → Controller → Service → Better Auth / Prisma → PostgreSQL`
- **Error Codes:**
  - `ACCOUNT_ALREADY_LINKED: "ACCOUNT_ALREADY_LINKED"` (HTTP 409)
  - `ACCOUNT_NOT_LINKED: "ACCOUNT_NOT_LINKED"` (HTTP 400)
  - `CANNOT_UNLINK_SOLE_METHOD: "CANNOT_UNLINK_SOLE_METHOD"` (HTTP 422)
- **Service Logic (`AuthService.ts`):**
  - `linkGoogleAccount(userId, role, callbackURL, headers)`:
    - Check role !== CUSTOMER ➔ throw `FORBIDDEN_ROLE_ACCESS`.
    - Check if Google account exists for `userId` ➔ throw `ACCOUNT_ALREADY_LINKED`.
    - Call `auth.api.linkSocialAccount({ body: { provider: "google", callbackURL }, headers })`.
  - `unlinkGoogleAccount(userId, role)`:
    - Query `prisma.account.findMany({ where: { userId } })`.
    - Find google account. If not found ➔ throw `ACCOUNT_NOT_LINKED`.
    - If total accounts === 1 or no credential account exists ➔ throw `CANNOT_UNLINK_SOLE_METHOD` (HTTP 422).
    - Delete google account record: `prisma.account.delete({ where: { id: googleAccount.id } })`.
    - Return clean success response.

---

## 5. Affected Files & Directives

| Action | File Path | Responsibility |
| :----- | :-------- | :------------- |
| `[MODIFY]` | `src/app/errors/errorCodes.ts` | Register `ACCOUNT_ALREADY_LINKED`, `ACCOUNT_NOT_LINKED`, `CANNOT_UNLINK_SOLE_METHOD` |
| `[MODIFY]` | `src/app/modules/auth/auth.validation.ts` | Define Zod schemas for account linking parameters |
| `[MODIFY]` | `src/app/modules/auth/auth.service.ts` | Implement `linkGoogleAccount` and `unlinkGoogleAccount` |
| `[MODIFY]` | `src/app/modules/auth/auth.controller.ts` | Implement controller handlers for link and unlink endpoints |
| `[MODIFY]` | `src/app/modules/auth/auth.routes.ts` | Mount `POST /api/v1/auth/link/google` and `POST /api/v1/auth/unlink/google` behind `authGuard` |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md` | Track `P2-T011` progress (`🔲` → `🔄` → `✅`) |
| `[NEW]` | `docs/governance/tasks/phase-2/P2-T011-implement-google-account-linking-and-unlinking.md` | Persistent JIT task plan and evidence |

---

## 6. Step-by-Step Execution Plan

1. **Step 1: Plan Review & Gate Transition:**
   - Review JIT plan with human supervisor.
   - Upon approval, transition `P2-T011` to `🔄 In progress` in parent phase file.
2. **Step 2: Error Codes & Validation Schemas:**
   - Add new error codes to `src/app/errors/errorCodes.ts`.
   - Add validation schemas to `src/app/modules/auth/auth.validation.ts`.
3. **Step 3: Service Layer Implementation:**
   - Implement `linkGoogleAccount` and `unlinkGoogleAccount` in `src/app/modules/auth/auth.service.ts`.
4. **Step 4: Controller & Route Integration:**
   - Implement controller handlers in `src/app/modules/auth/auth.controller.ts`.
   - Mount routes in `src/app/modules/auth/auth.routes.ts` with `authGuard`.
5. **Step 5: Comprehensive Verification:**
   - Run automated verification testing all acceptance criteria:
     1. Unauthenticated request rejected (401).
     2. Admin user linking rejected with 403 (`DEC-020`).
     3. User already linked to Google rejected with 409.
     4. Sole authentication method unlinking rejected with 422.
     5. Account with password successfully unlinks Google (200).
     6. User role remains unchanged throughout.
6. **Step 6: Code Quality & Governance Closure:**
   - Run `pnpm exec tsc --noEmit` and `pnpm lint`.
   - Record implementation evidence and test results in JIT task file.
   - Submit for human review (`🕵️ Awaiting human review`).
   - Upon approval, mark `✅ Done` and update `MEMORY.md`.

---

## 7. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :---- | :------- | :---------------- | :----- |
| Acceptance criteria | `Yes` | Verify all 6 acceptance criteria under `P2-T011` | `NOT RUN` |
| Type check / build | `Yes` | `pnpm exec tsc --noEmit` | `NOT RUN` |
| Lint | `Yes` | `pnpm lint` | `NOT RUN` |
| Unauthenticated check | `Yes` | Verify request without session cookie returns 401 | `NOT RUN` |
| Admin role block check | `Yes` | Verify admin user cannot link Google (403) | `NOT RUN` |
| Already linked conflict check | `Yes` | Verify linking existing Google account returns 409 | `NOT RUN` |
| Sole method 422 check | `Yes` | Verify unlinking sole auth method returns 422 | `NOT RUN` |
| Valid unlink check | `Yes` | Verify user with password can unlink Google (200) | `NOT RUN` |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None. `P2-B001`, `P2-B003`, and `P2-B005` were resolved in preceding foundation and auth tasks (`P2-T008`, `P2-T009`, `P2-T010`).
- **Design Assumptions:**
  - Unlinking removes the Google provider record from `Account` table, preventing future Google sign-in unless re-linked, while retaining the customer profile and user entity.
  - Per `FR-AUTH-003.4`, a user cannot unlink Google if they do not have a password or alternative credential method.

---

## 9. Plan Review

| Field | Value |
| :---- | :---- |
| Outcome | `Approved` |
| Reviewed by | Zahidul Islam |
| Reviewed on | `2026-09-15` |
| Notes | Approved task breakdown and execution approach for Google account linking and unlinking with 422 sole-method prevention and DEC-020 role enforcement. |

---

## 10. Implementation Evidence

_To be completed after code execution and before marking awaiting human review:_

- **Changed Files:**
- **Migration Created:** None required.
- **Test / Verification Output:**
- **Deviations from Original Plan:**
- **Remaining Concerns / Follow-ups:**
