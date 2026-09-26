# Task: P2-T010 - Implement Session and Authentication Middleware Guard

> **Canonical Status:** `✅ Done`  
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-AUTH-009`  
> **ERD Reference:** `Session`, `User`  
> **Dependencies:** `P2-T005` (✅), `P2-T008` (✅)

---

## 1. Context & Traceability

- **Objective:** Establish a reusable, server-side session-validation middleware guard (`authGuard`) that verifies Better Auth session cookies on protected endpoints, blocks unauthenticated or revoked sessions with `HTTP 401 Unauthorized`, and attaches trusted, server-derived identity context (`user` and `session`) to the request lifecycle.
- **PRD Alignment:**
  - `FR-AUTH-009.1`: Protected routes require an active, validated session.
  - `FR-AUTH-009.2`: Missing, invalid, expired, or revoked sessions are rejected with `HTTP 401 Unauthorized`.
  - `FR-AUTH-009.3`: Authenticated identity is resolved from server-side database records, never from client-provided headers or body payloads.
  - `FR-AUTH-009.4`: Session revocation takes effect immediately across all guarded endpoints.

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Reusable Authentication Middleware (`src/app/middleware/authGuard.ts`):**
   - Intercept requests on protected routes and extract session headers using `fromNodeHeaders(req.headers)`.
   - Validate session status against Better Auth (`auth.api.getSession`).
   - If session is missing, invalid, or expired, reject immediately with `HTTP 401 Unauthorized` (`PUBLIC_ERROR_CODES.UNAUTHORIZED`).
   - If session has been revoked from the database (`prisma.session`), reject with `HTTP 401 Unauthorized`.
   - Intercept soft-deleted users (`deletedAt !== null`) and reject with `HTTP 401 Unauthorized` per anti-enumeration and session invalidation rules.
2. **Server-Derived Identity Context Injection:**
   - Attach validated user and session data strictly to `res.locals.user` and `res.locals.session` per `DEC-022` (Request Immutability).
   - Strictly prohibit and ignore any client-supplied identity claims (such as `x-user-id`, `x-user-role`, or `req.body.userId`).
3. **Type Safety & Express Augmentation (`src/app/interfaces/express.d.ts`):**
   - Augment `Express.Locals` to provide full type safety for `user` and `session` across downstream middlewares and controllers.
4. **Error System Integration (`src/app/errors/errorCodes.ts`):**
   - Register `UNAUTHORIZED: "UNAUTHORIZED"` in `PUBLIC_ERROR_CODES`.

### Out of Scope

- Role-based authorization / RBAC checks (e.g., verifying `ADMIN` vs `CUSTOMER`), which is strictly dedicated to task `P2-T015`.
- Google account linking and unlinking (`P2-T011`).
- Logout and session revocation endpoints (`P2-T014`).
- Restricted account status transitions (e.g. audit-logged admin suspensions), which belongs to `P2-T017`.

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Require valid Better Auth session cookie and return 401 when absent, expired, or invalid | Step 4 | Programmatic runtime check sending requests with no cookie, malformed cookie, and expired cookie |
| Attach server-derived identity context to response locals | Step 3, Step 4 | Type check and runtime verification inspecting `res.locals.user` and `res.locals.session` in downstream handler |
| Ensure revoked sessions cannot bypass the guard (immediate revocation enforcement) | Step 4 | Runtime test revoking session directly in DB and confirming immediate 401 on next guarded request even when full cookie cache (`session_data`) is replayed |
| Never trust client-supplied headers or body for identity | Step 4 | Runtime check injecting spoofed `x-user-id` header and confirming identity is derived strictly from DB session |
| Soft-deleted user session interception | Step 4 | Runtime check verifying soft-deleted user session returns 401 even when full cookie cache (`session_data`) is replayed |

---

## 3. Verified Current Codebase State

- `src/app/interfaces/express.d.ts`: augmented `Express.Locals` with `user` and `session` properties per `DEC-022`.
- `src/app/errors/errorCodes.ts`: defines `UNAUTHORIZED: "UNAUTHORIZED"` in `PUBLIC_ERROR_CODES`.
- `src/app/config/auth.ts`: Better Auth is initialized with Prisma adapter and secure session configuration. `auth.api.getSession` is fully operational.
- `src/app/middleware/authGuard.ts`: implements reusable `authGuard` using `catchAsync`, `fromNodeHeaders`, and Better Auth session inspection with authoritative cookie cache bypass (`disableCookieCache: true`).
- `src/app/config/prisma.ts`: configured `transactionOptions` with `maxWait: 10000` and `timeout: 20000` to ensure remote PostgreSQL transactions execute reliably.

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  `Route → authGuard Middleware → Controller`
- **Middleware Logic (`authGuard.ts`):**
  ```typescript
  export const authGuard = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const headers = fromNodeHeaders(req.headers);
    const sessionData = await auth.api.getSession({
      headers,
      query: {
        disableCookieCache: true,
      },
    });

    if (
      !sessionData?.session ||
      !sessionData?.user ||
      sessionData.user.deletedAt
    ) {
      throw new AppError(
        status.UNAUTHORIZED,
        PUBLIC_ERROR_CODES.UNAUTHORIZED,
        "Authentication required. Please sign in.",
      );
    }

    res.locals.user = sessionData.user;
    res.locals.session = sessionData.session;

    next();
  });
  ```
- **Type Augmentation (`express.d.ts`):**
  Augment `Express.Locals` with authenticated `User` and `Session` types (`AuthUser`, `AuthSession` per `DEC-022`).
- **Error Code Registration (`errorCodes.ts`):**
  Add `UNAUTHORIZED: "UNAUTHORIZED"` to `PUBLIC_ERROR_CODES`.

---

## 5. Affected Files & Directives

| Action | File Path | Responsibility |
| :----- | :-------- | :------------- |
| `[NEW]` | `src/app/middleware/authGuard.ts` | Reusable session-verification Express middleware with authoritative cookie cache bypass |
| `[MODIFY]` | `src/app/interfaces/express.d.ts` | Augment `Express.Locals` with `user` and `session` per `DEC-022` |
| `[MODIFY]` | `src/app/errors/errorCodes.ts` | Add `UNAUTHORIZED` error code |
| `[MODIFY]` | `src/app/config/prisma.ts` | Configure PrismaClient transactionOptions for remote DB stability |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md` | Track `P2-T010` progress (`🔲` → `🔄` → `🕵️` → `✅`) |
| `[MODIFY]` | `docs/governance/tasks/phase-2/P2-T010-implement-session-and-authentication-middleware-guard.md` | Persistent JIT task plan and evidence |

---

## 6. Step-by-Step Execution Plan

1. **Step 1: Plan Approval & Gate Transition:**
   - Submit JIT task plan to user for review.
   - Upon approval, transition `P2-T010` to `🔄 In progress` in parent phase file.
2. **Step 2: Error Code & Type Declarations:**
   - Add `UNAUTHORIZED` to `src/app/errors/errorCodes.ts`.
   - Update `src/app/interfaces/express.d.ts` to include `user` and `session` on `Express.Locals` (standardized on `res.locals` per `DEC-022`).
3. **Step 3: Implement `authGuard` Middleware:**
   - Create `src/app/middleware/authGuard.ts`.
   - Extract session from Better Auth via `fromNodeHeaders(req.headers)` with `query: { disableCookieCache: true }` to bypass client-side cached `session_data` cookies and enforce authoritative DB checks.
   - Enforce 401 on missing, expired, revoked, or soft-deleted user sessions.
   - Attach validated `user` and `session` strictly to `res.locals.user` and `res.locals.session` per `DEC-022`.
4. **Step 4: Comprehensive Verification:**
   - Run verification checks for:
     1. Unauthenticated request (no cookie) ➔ `401 UNAUTHORIZED`.
     2. Malformed/invalid session token ➔ `401 UNAUTHORIZED`.
     3. Expired session token ➔ `401 UNAUTHORIZED`.
     4. Revoked session (deleted from DB, full cookie header replayed) ➔ `401 UNAUTHORIZED`.
     5. Valid active session ➔ `200 OK` with server-derived `res.locals.user` and `res.locals.session`.
     6. Client header spoofing resistance (spoofed `x-user-id` ignored).
     7. Soft-deleted user session (full cookie header replayed) ➔ `401 UNAUTHORIZED`.
5. **Step 5: Code Quality & Closure:**
   - Run `pnpm exec tsc --noEmit` and `pnpm lint`.
   - Record test evidence in task file.
   - Mark task `🕵️ Awaiting human review`, present evidence, and await approval.

---

## 7. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :---- | :------- | :---------------- | :----- |
| Acceptance criteria | `Yes` | Verify all 5 acceptance criteria under `P2-T010` | `PASSED` |
| Type check / build | `Yes` | `pnpm exec tsc --noEmit` | `PASSED` (0 errors) |
| Lint | `Yes` | `pnpm lint` | `PASSED` (0 errors) |
| Missing session check | `Yes` | Verify request without session cookie returns 401 | `PASSED` (401 UNAUTHORIZED) |
| Invalid/expired session check | `Yes` | Verify invalid/expired cookie returns 401 | `PASSED` (401 UNAUTHORIZED) |
| Revoked session check | `Yes` | Verify session deleted from DB fails validation immediately (401) even when replaying cached `session_data` cookie | `PASSED` (401 UNAUTHORIZED) |
| Valid session identity injection | `Yes` | Verify valid session attaches server-derived `user` & `session` | `PASSED` (200 OK, res.locals.user & res.locals.session attached) |
| Anti-spoofing check | `Yes` | Verify client-supplied identity headers are ignored | `PASSED` (server DB identity preserved) |
| Soft-deleted user check | `Yes` | Verify soft-deleted user fails validation immediately (401) even with cached `session_data` | `PASSED` (401 UNAUTHORIZED) |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None.
- **Design Assumptions:**
  - `authGuard` attaches the full authenticated user entity (`UserRole`, `UserStatus`, `email`, `name`, `id`, etc.) and session entity to `res.locals` per `DEC-022` (Request Immutability), enabling downstream controllers and future RBAC guard (`P2-T015`) to consume identity context seamlessly.
  - `disableCookieCache: true` is supplied to `auth.api.getSession` so that all protected endpoints guarded by `authGuard` unconditionally validate revocation status and `deletedAt` against live database records.

---

## 9. Plan Review

| Field | Value |
| :---- | :---- |
| Outcome | `Approved` |
| Reviewed by | Zahidul Islam |
| Reviewed on | `2026-09-15` |
| Notes | Approved plan to implement reusable session and authentication middleware guard (authGuard) with 401 on missing/revoked/invalid sessions and server-derived identity injection on res.locals. |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `src/app/middleware/authGuard.ts` (created/updated) — Reusable session-verification Express middleware with Better Auth header extraction, authoritative cookie cache bypass (`disableCookieCache: true`), session validation, soft-delete filtering, and `res.locals` identity injection (`res.locals.user`, `res.locals.session`).
  - `src/app/interfaces/express.d.ts` (modified) — Ambient Express namespace extension for `user` and `session` on `Express.Locals` per `DEC-022`.
  - `src/app/errors/errorCodes.ts` (modified) — Added `UNAUTHORIZED: "UNAUTHORIZED"` to `PUBLIC_ERROR_CODES`.
  - `src/app/config/prisma.ts` (modified) — Added `transactionOptions: { maxWait: 10000, timeout: 20000 }` to `PrismaClient` to handle remote PostgreSQL interactive transaction connection latencies smoothly.
- **Migration Created:** None required.
- **Test / Verification Output:**
  Programmatic verification executed across comprehensive scenarios:
  1. `Case 1: No Cookie -> 401 UNAUTHORIZED` (Status: 401, Code: UNAUTHORIZED, Message: "Authentication required. Please sign in.")
  2. `Case 2: Invalid Cookie -> 401 UNAUTHORIZED` (Status: 401, Code: UNAUTHORIZED)
  3. `Case 3: Expired Session -> 401 UNAUTHORIZED` (Status: 401, Code: UNAUTHORIZED)
  4. `Case 4: Valid Session -> 200 OK & Attached Identity` (Status: 200, UserId: matches DB user, Role: CUSTOMER, `res.locals.user` & `res.locals.session` attached)
  5. `Case 5: Anti-Spoofing -> Server Identity Preserved` (Status: 200, Spoofed x-user-id / x-user-role ignored, server DB identity preserved)
  6. `Case 6: Revoked Session -> 401 UNAUTHORIZED` (Status: 401, Code: UNAUTHORIZED immediately after deletion from DB, replaying full Cookie header containing cached `session_data`)
  7. `Case 7: Soft-Deleted User -> 401 UNAUTHORIZED` (Status: 401, Code: UNAUTHORIZED for user with deletedAt timestamp, replaying full Cookie header containing cached `session_data`)
- **Unit Testing Expansion (Vitest):**
  - Dedicated unit test suite established at `tests/unit/middleware/authGuard.test.ts` (10/10 tests passed) achieving 100% statement, branch, function, and line coverage on `src/app/middleware/authGuard.ts`:
    1. `Session Validation & Rejection Scenarios (401 UNAUTHORIZED)`: Missing sessionData (null), missing session object, missing user object, and soft-deleted user (`deletedAt !== null`) all reject with 401 UNAUTHORIZED (`PUBLIC_ERROR_CODES.UNAUTHORIZED`).
    2. `Successful Authentication & Identity Context Injection (Happy Path)`: Verifies header extraction, enforcement of `query: { disableCookieCache: true }` to bypass cookie caching, faithful attachment of `res.locals.user` and `res.locals.session`, argument-free `next()` dispatch, and role-agnostic authentication of administrative user sessions without premature filtering.
    3. `Security & Request Immutability Boundaries (DEC-022)`: Rejects client-injected claims (`x-user-id`, `x-user-role`, `req.body`), guarantees `req.user` and `req.session` are untouched, and preserves pre-existing `res.locals` properties.
    4. `Unexpected Error Handling (catchAsync)`: Verifies unexpected database/network errors and internal `AppError` exceptions thrown during `getSession` are caught and safely forwarded to `next(err)`.
  - Total repository suite test count: 276 passed across 24 test files.
- **Deviations from Original Plan:**
  - Added `transactionOptions: { maxWait: 10000, timeout: 20000 }` to `PrismaClient` in `src/app/config/prisma.ts` to ensure remote Prisma Postgres (`db.prisma.io:5432`) connections do not prematurely time out during interactive transactions.
  - Standardized context injection exclusively on `res.locals.user` and `res.locals.session` per `DEC-022`, retiring `req.user` / `req.session` to guarantee HTTP request immutability (`DEC-014`).
  - Added `query: { disableCookieCache: true }` in `authGuard.ts` to bypass Better Auth 1.7.3 cookie caching on protected routes, ensuring database-backed revocation (`FR-AUTH-009.4`) and soft-delete detection are immediately effective.
- **Remaining Concerns / Follow-ups:**
  - None. Reusable `authGuard` is ready for downstream endpoints and future RBAC guard (`P2-T015`).

---

## 11. Completion Review

| Field | Value |
| :---- | :---- |
| Outcome | `Approved` |
| Reviewed by | Zahidul Islam |
| Reviewed on | `2026-09-15` (re-verified 2026-09-18) |
| Notes | Verified and approved implementation of authGuard middleware, Express Locals type augmentations per DEC-022, authoritative cookie cache bypass for immediate session revocation, and comprehensive verification suite. Closed as Done. |

