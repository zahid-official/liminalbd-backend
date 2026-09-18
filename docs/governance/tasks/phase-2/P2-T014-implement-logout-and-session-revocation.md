# Task: P2-T014 - Implement Logout and Session Revocation

> **Canonical Status:** `✅ Done` (tracked authoritatively in parent phase file)  
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-AUTH-008` (`FR-AUTH-008.1` – `FR-AUTH-008.3`), `FR-AUTH-009` (`FR-AUTH-009.1` – `FR-AUTH-009.3`)  
> **ERD Reference:** `Session`, `User`  
> **Dependencies:** `P2-T008` (✅), `P2-T010` (✅)  
> **Planning Gate:** Draft Plan → Human Approval → `🔄 In progress`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T014`
- **Objective:** Provide secure session invalidation mechanisms behind the authentication guard (`authGuard`) allowing authenticated users to log out of their current session or revoke all active sessions across all devices, ensuring cookie invalidation and immediate rejection of subsequent requests.
- **PRD Alignment:**
  - `FR-AUTH-008.1`: System must invalidate the current session on logout so it can no longer be used for authenticated requests.
  - `FR-AUTH-008.2`: System must support logout from all devices (revoking all active sessions belonging to the user, including the current session).
  - `FR-AUTH-008.3`: Revoked sessions must no longer authorize protected requests (subsequent requests using a revoked session return HTTP 401 Unauthorized).
  - `FR-AUTH-009.1` – `FR-AUTH-009.3`: Maintain session lifecycle via Better Auth, returning secure cookie attributes (`httpOnly`, `SameSite: "lax"`, path-scoped, `Max-Age=0` on logout).
- **Decisions & Blockers:**
  - `P2-B001`: Public API endpoints designated as `POST /api/v1/auth/logout` and `POST /api/v1/auth/logout-all`.
  - `DEC-014`: Identity context is resolved by `authGuard` and attached to `res.locals.user` and `res.locals.session`.
  - `DEC-021`: Standardized JSON envelope using `sendResponse`.

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Current Session Logout (`POST /api/v1/auth/logout`):**
   - Protected by `authGuard` (requires valid active session).
   - Invokes Better Auth `auth.api.revokeSession({ body: { token: sessionToken }, headers })` to invalidate the active session in PostgreSQL and `auth.api.signOut({ headers, returnHeaders: true })` to generate cookie clearance headers.
   - Forwards `set-cookie` header (`better-auth.session_token=; Max-Age=0...`) to client.
   - Returns standardized success response: `{ success: true, message: "Successfully logged out.", data: null }`.
   - Replay prevention: subsequent requests using the invalidated session token are rejected with `401 Unauthorized` (`PUBLIC_ERROR_CODES.UNAUTHORIZED`).

2. **All Sessions Revocation (`POST /api/v1/auth/logout-all`):**
   - Protected by `authGuard` (requires valid active session).
   - Invokes Better Auth `auth.api.revokeSessions({ headers })` and `auth.api.signOut({ headers, returnHeaders: true })` to delete every active session belonging to `res.locals.user.id` from PostgreSQL.
   - Forwards cookie clearance header to client.
   - Returns standardized success response: `{ success: true, message: "Successfully logged out from all devices.", data: null }`.
   - Replay prevention: every active session for that user (both the current session and any secondary sessions) receives `401 Unauthorized` on subsequent requests.

3. **Tenant & Identity Isolation:**
   - A user cannot revoke sessions belonging to any other user. Only sessions belonging to the authenticated actor (`res.locals.user.id`) are revoked.
   - Revoking sessions for User A does not alter or disrupt active sessions for User B.

### Out of Scope

- Unauthenticated session termination (handled naturally as 401 by `authGuard`).
- Administrative revocation of another user's sessions (`P2-T026: Implement Customer Account Lifecycle Management`).
- Periodic cleanup of expired sessions (managed by database/cron lifecycle).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :--- | :--- | :--- |
| `FR-AUTH-008.1`: Logout invalidates current session and clears session cookie | Step 2, 3 | Executable test verifying session deleted from DB, `set-cookie` clears token, and 200 response returned |
| `FR-AUTH-008.2`: Logout-all revokes every active session for user across all devices | Step 2, 3 | Executable test creating 2+ active sessions for a user, calling `/logout-all`, and verifying all sessions deleted from DB |
| `FR-AUTH-008.3`: Revoked sessions receive HTTP 401 on later protected requests | Step 4 | Executable test confirming replay of revoked tokens on `/api/v1/auth/change-password` or other guarded routes returns 401 UNAUTHORIZED |
| Tenant Isolation: User A cannot revoke User B's sessions | Step 4 | Executable test confirming User A's `/logout-all` leaves User B's active sessions completely intact |
| Security: Unauthenticated requests to `/logout` or `/logout-all` rejected | Step 4 | Executable test confirming missing/invalid session receives 401 UNAUTHORIZED from `authGuard` |

---

## 3. Verified Current Codebase State

_Findings from read-only repository inspection before writing code:_

- **Authentication Guard (`src/app/middleware/authGuard.ts`):**
  - Reliably authenticates the caller via Better Auth session token.
  - Injects `res.locals.user` and `res.locals.session`.
  - Rejects missing, expired, or invalid sessions with `401 Unauthorized`.
- **Better Auth APIs (`src/app/config/auth.ts`):**
  - Exposes `auth.api.signOut({ headers, returnHeaders: true })` for current session invalidation and cookie clearing.
  - Exposes `auth.api.revokeSessions({ headers })` for revoking all active sessions for the user.
- **Service Layer Pattern (`src/app/modules/auth/auth.service.ts`):**
  - Uses `fromNodeHeaders(req.headers)` to construct standard Fetch API `Headers` for Better Auth operations.
  - Standardized pattern: `setCookies: authHeaders?.getSetCookie() ?? []`.
- **Controller Layer Pattern (`src/app/modules/auth/auth.controller.ts`):**
  - Uses `catchAsync`, forwards `res.setHeader("set-cookie", result.setCookies)`, and returns `sendResponse`.
- **Route Mounting (`src/app/modules/auth/auth.routes.ts`):**
  - Mounts routes under `/api/v1/auth`.

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  `Route (authGuard) → Controller → Service → Better Auth API (revokeSession / revokeSessions / signOut) → PostgreSQL (Prisma adapter)`

- **Data / Schema Impact:**
  - No database migration required.
  - Operates on the existing `session` table mapped by Prisma / Better Auth adapter.

- **Public API / Contract Impact:**
  - `POST /api/v1/auth/logout`:
    - Headers: `Cookie: better-auth.session_token=...`
    - Body: empty `{}`
    - Response: `200 OK`, `Set-Cookie: better-auth.session_token=; Max-Age=0...`
    - Envelope: `{ success: true, message: "Successfully logged out.", data: null }`
  - `POST /api/v1/auth/logout-all`:
    - Headers: `Cookie: better-auth.session_token=...`
    - Body: empty `{}`
    - Response: `200 OK`, `Set-Cookie: better-auth.session_token=; Max-Age=0...`
    - Envelope: `{ success: true, message: "Successfully logged out from all devices.", data: null }`

- **Security & Authorization Considerations:**
  - Both endpoints are strictly guarded by `authGuard`.
  - The user ID is authoritatively derived from `res.locals.session.userId` / `headers` — never accepted as a client parameter, completely eliminating identity spoofing or cross-tenant session termination.

---

## 5. Affected Files & Directives

| Action | File Path | Responsibility |
| :--- | :--- | :--- |
| `[MODIFY]` | `src/app/modules/auth/auth.service.ts` | Add `logout` and `logoutAll` service methods using Better Auth API and standardized cookie extraction. |
| `[MODIFY]` | `src/app/modules/auth/auth.controller.ts` | Add `logout` and `logoutAll` controller handlers with cookie forwarding and `sendResponse`. |
| `[MODIFY]` | `src/app/modules/auth/auth.routes.ts` | Mount `POST /logout` and `POST /logout-all` with `authGuard`. |
| `[NEW]` | `docs/governance/tasks/phase-2/P2-T014-implement-logout-and-session-revocation.md` | Task execution plan and review evidence artifact. |

---

## 6. Step-by-Step Execution Plan

1. **Step 1 (Planning Gate):**
   - Submit JIT task plan for human review and approval.
   - Once approved, update canonical status to `🔄 In progress` in task file and phase file.

2. **Step 2 (Service Layer):**
   - In `src/app/modules/auth/auth.service.ts`:
     - Implement `logout(sessionToken: string, headers: Headers)`:
       - Calls `auth.api.revokeSession({ body: { token: sessionToken }, headers })` to enforce authoritative DB deletion and propagate errors.
       - Calls `auth.api.signOut({ headers, returnHeaders: true })` to generate cookie clearance headers.
       - Extracts `setCookies: authHeaders?.getSetCookie() ?? []`.
       - Returns `{ message: "Successfully logged out.", setCookies }`.
     - Implement `logoutAll(headers: Headers)`:
       - Calls `auth.api.revokeSessions({ headers })`.
       - Calls `auth.api.signOut({ headers, returnHeaders: true })` to guarantee cookie clearance headers.
       - Extracts `setCookies`.
       - Returns `{ message: "Successfully logged out from all devices.", setCookies }`.

3. **Step 3 (Controller & Route Configuration):**
   - In `src/app/modules/auth/auth.controller.ts`:
     - Implement `logout` and `logoutAll` handlers using `catchAsync`, forwarding `setCookies` headers, and returning standard JSON envelope.
   - In `src/app/modules/auth/auth.routes.ts`:
     - Mount `router.post("/logout", authGuard, AuthController.logout)`.
     - Mount `router.post("/logout-all", authGuard, AuthController.logoutAll)`.

4. **Step 4 (Automated Verification):**
   - Create and run `scratch/verify_p2_t014.ts` covering:
     - Unauthenticated access to `/logout` and `/logout-all` (expect 401).
     - Single session `/logout` (session deleted from DB, cookie cleared, subsequent protected request returns 401).
     - Multi-session `/logout-all` (all sessions for user deleted from DB, all sessions fail replay with 401).
     - Cross-user session safety (User A logout does not affect User B).
   - Clean up scratch test script.
   - Run `pnpm tsc --noEmit` and `pnpm lint`.

5. **Step 5 (Review & Governance Finalization):**
   - Populate Implementation Evidence (Section 10) in task file.
   - Mark task `🕵️ Awaiting human review`.
   - Present evidence to reviewer.
   - Upon explicit approval (`✅ Done`), finalize records in phase file, `MEMORY.md`, and roadmap.

---

## 7. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :--- | :--- | :--- | :--- |
| Acceptance criteria | `Yes` | `scratch/verify_p2_t014.ts` (5 scenarios, multiple assertions) | `PASS` |
| Type check / build | `Yes` | `pnpm tsc --noEmit` | `PASS` |
| Lint | `Yes` | `pnpm lint` | `PASS` |
| Tests | `Yes` | Executable verification script against local server & DB | `PASS` |
| Migration / data integrity | `No` | No schema changes required | `N/A` |
| Manual verification | `Yes` | Session table inspection & replay attack check | `PASS` |

---

## 8. Assumptions & Blockers

- **Active Blockers:**
  - `P2-B001`: Endpoints `POST /api/v1/auth/logout` and `POST /api/v1/auth/logout-all` conform to approved RESTful standards.
- **Design Assumptions Awaiting Approval:**
  - None.

---

## 9. Plan Review

| Field | Value |
| :---- | :---- |
| Outcome | `Approved` |
| Reviewed by | Zahidul Islam |
| Reviewed on | `2026-09-18` |
| Notes | Approved JIT plan for logout and session revocation endpoints. |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `src/app/modules/auth/auth.service.ts`: Added `logout(sessionToken, headers)` (invoking `auth.api.revokeSession` for authoritative DB deletion and `auth.api.signOut` for cookie cleanup, returning `setCookies`) and `logoutAll(headers)` (invoking `auth.api.revokeSessions` and `auth.api.signOut`, returning `setCookies`).
  - `src/app/modules/auth/auth.controller.ts`: Added `logout` and `logoutAll` controller handlers with server-verified session token forwarding (`res.locals.session.token`), cookie forwarding, and standardized response envelope.
  - `src/app/modules/auth/auth.routes.ts`: Mounted `POST /api/v1/auth/logout` and `POST /api/v1/auth/logout-all` behind `authGuard`.
- **Migration Created:** None required (reuses existing Better Auth `session` table).
- **Test / Verification Output:**
  - `scratch/verify_p2_t014.ts`: All 5 scenarios executed and passed with exit code 0 against local dev server and PostgreSQL:
    - Scenario 1: Unauthenticated access to `/logout` and `/logout-all` rejected with 401 Unauthorized (`pass: true`).
    - Scenario 2: Single-session logout `/logout` successfully revokes active session from database, emits cookie clearance headers (`better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`), and blocks token replay with 401 Unauthorized (`pass: true`).
    - Scenario 3: Multi-session logout-all `/logout-all` revokes all active sessions for that user across all devices from database (0 remaining sessions in DB), emits cookie clearance headers, and blocks replay on all previous sessions with 401 Unauthorized (`pass: true`).
    - Scenario 4: Cross-user session isolation confirmed — User A calling `/logout-all` leaves User B's active sessions completely intact and operational (`pass: true`).
    - Scenario 5: Database failure resilience during logout verified — simulated session deletion failure properly bubbles up (throwing Internal Server Error), prevents false-positive 200 OK responses, leaves the active DB session intact, and normal logout succeeds when database recovers (`pass: true`).
  - `pnpm tsc --noEmit`: Exited with code 0 (zero errors).
  - `pnpm lint`: Exited with code 0 (zero errors / zero warnings).
- **Deviations from Original Plan:** None.
- **Remaining Concerns / Follow-ups:** None. Ready for human review and task closure.

---

## 11. Final Review & Approval

| Field | Value |
| :---- | :---- |
| Outcome | `Approved` |
| Reviewed by | Zahidul Islam |
| Reviewed on | `2026-09-18` |
| Notes | Verified logout and logout-all endpoints, cookie invalidation headers, complete DB session revocation across multiple sessions, replay protection with 401 Unauthorized, and tenant isolation. Approved task closure. |

