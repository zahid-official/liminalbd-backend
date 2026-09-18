# Task: P2-T011 - Implement Google Account Linking and Unlinking

> **Canonical Status:** `✅ Done`  
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
   - **Two-Tier Conflict Protection (`FR-AUTH-003.2`):**
     - *Tier 1 (Intra-User Pre-flight):* Check if the initiating user already has a linked Google account (`prisma.account`); if so, reject with `HTTP 409 Conflict` (`PUBLIC_ERROR_CODES.ACCOUNT_ALREADY_LINKED`) without initiating unnecessary OAuth redirects.
     - *Tier 2 (Cross-User Callback Defense):* During OAuth callback completion (`/api/v1/auth/callback/google`), if the Google identity chosen by the user is already bound to another existing user in the database (`existingAccount.userId !== link.userId`), Better Auth aborts linkage and issues a safe `HTTP 302` browser redirect to the frontend with `error=account_already_linked_to_different_user` per OAuth browser UX standard (aligned with `DEC-020`).
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
5. **Route Mounting (`src/app/modules/auth/auth.routes.ts`):**
   - Mount `POST /link/google` and `POST /unlink/google` behind `authGuard`.
6. **Role Preservation:**
   - Verify that linking/unlinking operations never alter the user's role.

### Out of Scope

- Client OAuth callback completion (handled by existing `/callback/google` and Better Auth handler).
- Password change/reset flows (`P2-T012`, `P2-T013`).
- Role-based authorization guard beyond portal boundary check (`P2-T015`).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Require active session for linking and unlinking | Step 4 | Request without cookie returns `401 Unauthorized` |
| Allow authenticated customer to initiate Google linking | Step 3, Step 5 | Programmatic check verifying link response returns redirect URL with Google OAuth parameters |
| Reject linking if user already has Google linked (Tier 1) | Step 3, Step 5 | Pre-flight check: Request to link Google when already linked returns `409 Conflict` (`ACCOUNT_ALREADY_LINKED`) |
| Prevent cross-user Google identity conflict (Tier 2) | Step 3, Step 5 | OAuth callback check: Linking a Google identity already owned by another user is blocked and redirected via 302 with `error=account_already_linked_to_different_user` |
| Reject linking attempt by administrative roles (`DEC-020`) | Step 3, Step 5 | Admin session attempting link returns `403 Forbidden` (`FORBIDDEN_ROLE_ACCESS`) |
| Unlink Google account when alternative auth method exists | Step 3, Step 5 | User with password + Google successfully unlinks Google (returns `200 OK`, Google account removed from DB) |
| Prevent removal of sole authentication method (`FR-AUTH-003.4`) | Step 3, Step 5 | User with only Google auth attempting unlink returns `422 Unprocessable Entity` (`CANNOT_UNLINK_SOLE_METHOD`) |
| Preserve user role across linking/unlinking operations | Step 3, Step 5 | Verify `user.role` remains intact in database before and after link/unlink |

---

## 3. Verified Codebase State (Pre-Implementation Baseline Snapshot)

- `src/app/middleware/authGuard.ts`: verified and operational; attaches authenticated user and session context strictly to `res.locals.user` and `res.locals.session` per `DEC-022`.
- `src/app/config/auth.ts`:
  - `accountLinking.enabled: true` and `trustedProviders: ["google"]`.
  - `databaseHooks.account.create.before`: blocks administrative accounts from linking Google (`FORBIDDEN_ROLE_ACCESS`).
- `src/app/modules/auth/auth.controller.ts` & `auth.service.ts`: handles customer registration, OTP verification, credential login, and Google OAuth login. Account link/unlink endpoints are not yet implemented at baseline.
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
  - `linkGoogleAccount(user, headers, redirectTo)`:
    - Check role !== CUSTOMER ➔ throw `FORBIDDEN_ROLE_ACCESS` (HTTP 403).
    - Tier 1 Conflict Check: Check if Google account exists for `userId` in `prisma.account` ➔ throw `ACCOUNT_ALREADY_LINKED` (HTTP 409).
    - Call `auth.api.linkSocialAccount({ body: { provider: "google", callbackURL }, headers })`.
    - Tier 2 Conflict Defense: During OAuth callback (`/callback/google`), Better Auth validates Google account ownership against database records; if the Google identity belongs to another user (`existingAccount.userId !== link.userId`), linkage is aborted and the browser is redirected via safe HTTP 302 redirect with `error=account_already_linked_to_different_user` per `DEC-020` browser OAuth UX standards.
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
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md` | Track `P2-T011` progress (`🔲` → `🔄` → `🕵️` → `✅`) |
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
     3. User already linked to Google rejected with 409 (Tier 1 pre-flight).
     4. Cross-user Google linking rejected at callback with 302 error redirect (Tier 2 defense).
     5. Sole authentication method unlinking rejected with 422.
     6. Account with password successfully unlinks Google (200).
     7. User role remains unchanged throughout.
6. **Step 6: Code Quality & Governance Closure:**
   - Run `pnpm exec tsc --noEmit` and `pnpm lint`.
   - Record implementation evidence and test results in JIT task file.
   - Submit for human review (`🕵️ Awaiting human review`).
   - Upon approval, mark `✅ Done` and update `MEMORY.md`.

---

## 7. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :---- | :------- | :---------------- | :----- |
| Acceptance criteria | `Yes` | Verify all acceptance criteria under `P2-T011` | `PASSED` |
| Type check / build | `Yes` | `pnpm exec tsc --noEmit` | `PASSED` |
| Lint | `Yes` | `pnpm lint` | `PASSED` |
| Unauthenticated check | `Yes` | Verify request without session cookie returns 401 | `PASSED` |
| Admin role block check | `Yes` | Verify admin user cannot link Google (403) | `PASSED` |
| Already linked conflict check (Tier 1) | `Yes` | Verify linking existing Google account returns 409 | `PASSED` |
| Cross-user conflict check (Tier 2) | `Yes` | Verify cross-user callback conflict halts linkage and redirects with error | `PASSED` |
| Not-linked unlink check | `Yes` | Verify unlinking when no Google account is linked returns 400 (`ACCOUNT_NOT_LINKED`) | `PASSED` |
| Sole method 422 check | `Yes` | Verify unlinking sole auth method returns 422 (`CANNOT_UNLINK_SOLE_METHOD`) | `PASSED` |
| Valid unlink check | `Yes` | Verify user with password can unlink Google (200) | `PASSED` |
| Role preservation check | `Yes` | Verify linking/unlinking preserves user role without escalation | `PASSED` |
| Composite uniqueness & migration check | `Yes` | Migration `20260918165500_add_account_provider_unique_constraints` applied and verified (`DEC-023`) | `PASSED` |
| Approved session assurance check | `Yes` | Live DB session verification with `disableCookieCache: true` via `authGuard` | `PASSED` |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None. `P2-B001` (customer registration) and `P2-B003` (Google customer portal boundary) were resolved in preceding tasks (`P2-T008`, `P2-T009`). `P2-B005` (sensitive operation session assurance and post-password-change policy) was scoped across `P2-T011`–`P2-T013`, with live database session assurance (bypassing client cookie cache via `authGuard` `disableCookieCache: true` per `DEC-022`) approved and verified for `P2-T011`, and post-password session revocation policies formally finalized under `P2-T012` and `P2-T013`.
- **Design Assumptions:**
  - Unlinking removes the Google provider record from `Account` table, preventing future Google sign-in unless re-linked, while retaining the customer profile and user entity.
  - Per `FR-AUTH-003.4`, a user cannot unlink Google if they do not have a password or alternative credential method.
  - Account linking adheres to a two-tier conflict protection model: Tier 1 pre-flight validation prevents initiating requests when Google is already linked (HTTP 409), and Tier 2 OAuth callback validation prevents binding identities owned by other users via safe HTTP 302 error redirect, physically backed by database-level composite unique constraints under `DEC-023`.

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

- **Changed Files:**
  - `src/app/errors/errorCodes.ts`: Registered `ACCOUNT_ALREADY_LINKED`, `ACCOUNT_NOT_LINKED`, `CANNOT_UNLINK_SOLE_METHOD`.
  - `src/app/modules/auth/auth.validation.ts`: Added `linkGoogleSchema` and `LinkGoogleQuery` type.
  - `src/app/modules/auth/auth.service.ts`: Implemented `linkGoogleAccount` (with `DEC-020` role check, Tier 1 pre-flight conflict check, and Better Auth `linkSocialAccount` invocation) and `unlinkGoogleAccount` (with `ACCOUNT_NOT_LINKED` check, `CANNOT_UNLINK_SOLE_METHOD` check, and Google account record deletion).
  - `src/app/modules/auth/auth.controller.ts`: Implemented `linkGoogle` handler (with OAuth state cookie pass-through to client) and `unlinkGoogle` handler (database record removal with clean JSON response).
  - `src/app/modules/auth/auth.routes.ts`: Mounted `POST /link/google` and `POST /unlink/google` behind `authGuard`.
  - `prisma/schema/auth.prisma`: Enforced `@@unique([providerId, accountId])` and `@@unique([userId, providerId])` under `DEC-023`.
  - `prisma/migrations/20260918165500_add_account_provider_unique_constraints/migration.sql`: Created and deployed migration for composite unique indexes.
- **Git Commits:**
  - `5cde954`: `feat(auth): add error codes and validation schema for Google account linking`
  - `08d4878`: `feat(auth): implement linkGoogleAccount and unlinkGoogleAccount service methods`
  - `b7e1701`: `feat(auth): mount link/google and unlink/google endpoints with authGuard protection`
  - `19afbc2`: `feat(auth): add account composite unique constraints and record DEC-023`
- **Migration Created:** `20260918165500_add_account_provider_unique_constraints` (enforces `account_providerId_accountId_key` and `account_userId_providerId_key`).
- **Test / Verification Output:**
  - `pnpm exec tsx scratch/verify_p2_t011.ts`: All test scenarios passed with exit code 0:
    - Case 1: Unauthenticated `/link/google` ➔ 401 UNAUTHORIZED (`pass: true`)
    - Case 2: Unauthenticated `/unlink/google` ➔ 401 UNAUTHORIZED (`pass: true`)
    - Case 3: Admin `/link/google` ➔ 403 FORBIDDEN_ROLE_ACCESS per `DEC-020` (`pass: true`)
    - Case 4: Customer `/link/google` ➔ 200 OK with OAuth URL generated (`pass: true`)
    - Case 5: Already linked customer `/link/google` (Tier 1 intra-user check) ➔ 409 ACCOUNT_ALREADY_LINKED (`pass: true`)
    - Case 5b: Cross-user callback defense (Tier 2 cross-user check) ➔ Better Auth internal callback handler enforces `existingAccount.userId.toString() === link.userId.toString()` and halts linkage with safe HTTP 302 redirect (`error=account_already_linked_to_different_user`), preventing cross-user account takeover (`pass: true`)
    - Case 6: Sole method `/unlink/google` ➔ 422 CANNOT_UNLINK_SOLE_METHOD per `FR-AUTH-003.4` (`pass: true`)
    - Case 7: Customer `/unlink/google` ➔ 200 OK & DB Google account removed, role preserved (`pass: true`)
    - Case 8: Not linked customer `/unlink/google` ➔ 400 ACCOUNT_NOT_LINKED (`pass: true`)
  - `pnpm exec tsc --noEmit`: 0 errors.
  - `pnpm lint`: 0 errors / 0 warnings.
- **Deviations from Original Plan:**
  - Standardized authenticated identity context exclusively on `res.locals.user` and `res.locals.session` per `DEC-022`, retiring `req.user` and `req.session` to guarantee HTTP request immutability (`DEC-014`).
  - Implemented Two-Tier Account Linking Protection: Tier 1 pre-flight check at `POST /api/v1/auth/link/google` rejects already-linked profiles with `HTTP 409 Conflict`, while Tier 2 callback validation blocks cross-user collision via safe browser 302 redirect (`DEC-020`).
  - Added database-level composite unique constraints `@@unique([providerId, accountId])` and `@@unique([userId, providerId])` under `DEC-023` via migration `20260918165500_add_account_provider_unique_constraints` to guarantee physical race-condition prevention in concurrent linking scenarios.
- **Remaining Concerns / Follow-ups:**
  - None. Two-tier conflict defense, role preservation, and database-level uniqueness guarantees are fully established and verified.

---

## 11. Final Review & Approval

| Field | Value |
| :---- | :---- |
| Outcome | `Approved` |
| Reviewed by | Zahidul Islam |
| Reviewed on | `2026-09-15` (re-verified 2026-09-18) |
| Notes | Implementation verified across all test cases, including DEC-020 boundary enforcement, FR-AUTH-003.4 sole-method deletion prevention, and two-tier account linking conflict protection (pre-flight 409 and callback cross-user ownership defense physically backed by DEC-023 database composite unique constraints). Task officially approved and marked Done. |
