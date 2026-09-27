# Task: P2-T030 - Implement Dedicated Administrative Login Operation

> **Canonical Status:** `✅ Done`  
> **Planning Gate:** Draft Plan → Human Approval → `🔄 In Progress` → Implementation & Verification Complete → `🕵️ Awaiting human review` → `✅ Done`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T030`
- **PRD / Requirement Reference:** `FR-AUTH-005` (Email/Password Login), `FR-RBAC-006` (Account Status Enforcement), `DEC-020` (Dedicated Customer Authentication Boundary and Separation of Administrative Login Portals)
- **ERD Reference:** `User` (`role`, `status`, `deletedAt`), `Session`, `Account`
- **Dependencies:** `P2-T008` (`✅ Done`), `P2-T018` (`✅ Done`)
- **Active Blockers:** None

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Dedicated Administrative Login Route:**
   - Expose endpoint `POST /api/v1/auth/admin/login`.
   - Validate request payload (`email`, `password`) using existing `AuthValidation.loginWithCredentialsSchema` via `validateRequest`.
2. **Administrative Role Verification & Session Issuance:**
   - Authenticate credentials via Better Auth internal API (`auth.api.signInEmail`).
   - Restrict access strictly to privileged roles: `ADMIN` and `SUPER_ADMIN`.
   - If a user with `CUSTOMER` role attempts to authenticate via this portal, revoke the generated session immediately and reject with `403 Forbidden` (`PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS`, "Access denied. This login portal is reserved for administrators.").
3. **Account Status & Security Enforcement:**
   - Centralized session hooks in `src/app/config/auth.ts` automatically enforce:
     - Anti-enumeration generic 401 for soft-deleted accounts (`deletedAt !== null`).
     - 403 Forbidden for `SUSPENDED` or `DEACTIVATED` accounts.
   - Return standardized 200 OK JSON envelope via `sendResponse` with sanitized profile (`id`, `name`, `email`, `emailVerified`, `role`, `status`).
   - Forward session cookies (`set-cookie` header) to the client.
4. **Automated Unit & Integration Testing:**
   - Unit tests covering controller and service methods for successful admin login, successful super admin login, rejection of customer role (403), invalid credentials (401), and suspended admin (403).
   - Integration / route tests verifying the endpoint end-to-end.

### Out of Scope

- Social login (Google OAuth) for administrators (strictly prohibited per `DEC-020`).
- Super Admin seeding / initial database bootstrap (handled in Topic B / next task).
- Modifying public customer login behavior at `POST /api/v1/auth/login`.

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| `POST /api/v1/auth/admin/login` validates credentials schema | Step 1 & 2 | Unit tests for controller & route schema validation |
| Allows `ADMIN` and `SUPER_ADMIN` to authenticate and receive session cookies | Step 3 & 4 | Unit & Integration tests |
| Rejects `CUSTOMER` role with 403 `FORBIDDEN_ROLE_ACCESS` and revokes session | Step 3 & 4 | Unit & Integration tests |
| All checks pass (`pnpm build`, `pnpm lint`, `pnpm test`) | Step 5 | CLI execution |

---

## 3. Verified Current Codebase State

- **Current Behavior / Gaps:** `POST /api/v1/auth/login` is strictly reserved for `CUSTOMER` role (rejects `ADMIN`/`SUPER_ADMIN` with 403 per `DEC-020`). There is currently no endpoint allowing administrators to establish an authenticated session.
- **Existing Code Patterns to Follow:**
  - Route: `src/app/modules/auth/auth.routes.ts`
  - Controller: `src/app/modules/auth/auth.controller.ts` (`loginWithCredentials`)
  - Service: `src/app/modules/auth/auth.service.ts` (`loginWithCredentials`)
  - Validation: `AuthValidation.loginWithCredentialsSchema`

---

## 4. Implementation Approach

- **Architecture Flow:** `Route -> Controller -> Service -> Better Auth (auth.api.signInEmail)`
- **Data / Schema Impact:** None. Uses existing `User`, `Account`, `Session` Prisma models.
- **Public API / Contract Impact:** New endpoint `POST /api/v1/auth/admin/login`.
- **Security & Authorization:**
  - Strictly credential-based (no OAuth).
  - Validates `role === ADMIN || role === SUPER_ADMIN`.
  - Immediate session cleanup on role mismatch.

---

| Action | File Path | Responsibility |
| :----- | :-------- | :------------- |
| `[MODIFY]` | `src/app/errors/errorCodes.ts` | Add `PASSWORD_CHANGE_REQUIRED` error code. |
| `[MODIFY]` | `src/app/middleware/rbacGuard.ts` | Enforce `needPasswordChange: true` blocking administrative routes with 403. |
| `[MODIFY]` | `src/app/modules/auth/auth.service.ts` | Add `loginAdminWithCredentials` asserting administrative roles; add role defense in `unlinkGoogleAccount`. |
| `[MODIFY]` | `src/app/modules/auth/auth.controller.ts` | Add `loginAdminWithCredentials` controller handler; pass `user.role` to `unlinkGoogleAccount`. |
| `[MODIFY]` | `src/app/modules/auth/auth.routes.ts` | Mount `POST /admin/login` with `loginWithCredentialsSchema`. |
| `[MODIFY]` | `tests/unit/middleware/rbacGuard.test.ts` | Add unit test for `needPasswordChange: true` 403 rejection. |
| `[MODIFY]` | `tests/unit/modules/auth/auth.service.test.ts` | Add unit tests for `loginAdminWithCredentials` and `unlinkGoogleAccount` admin rejection. |
| `[MODIFY]` | `tests/unit/modules/auth/auth.controller.test.ts` | Add unit tests for `loginAdminWithCredentials` and `unlinkGoogle` role forwarding. |
| `[MODIFY]` | `tests/unit/modules/auth/auth.routes.test.ts` | Update route count to 15 and test `POST /admin/login`. |
| `[MODIFY]` | `tests/integration/phase2.security.test.ts` | Add integration tests for `POST /api/v1/auth/admin/login`, unlink rejection, and `needPasswordChange`. |

---

## 6. Step-by-Step Execution Plan

1. **Step 1:** Implement `loginAdminWithCredentials` in `src/app/modules/auth/auth.service.ts`.
2. **Step 2:** Implement `loginAdminWithCredentials` handler in `src/app/modules/auth/auth.controller.ts`.
3. **Step 3:** Register `POST /admin/login` in `src/app/modules/auth/auth.routes.ts`.
4. **Step 4:** Enforce `needPasswordChange` in `rbacGuard` and add defense-in-depth role check in `unlinkGoogleAccount`.
5. **Step 5:** Add comprehensive unit and integration tests across middleware, service, controller, routes, and security suites.
6. **Step 6:** Run `pnpm lint`, `pnpm build`, and `pnpm test` to ensure 100% test pass and zero regressions.

---

## 7. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :---- | :------- | :---------------- | :----- |
| Acceptance criteria | `Yes` | Automated unit & integration tests | `PASS` |
| Type check / build | `Yes` | `pnpm build` | `PASS` |
| Lint | `Yes` | `pnpm lint` | `PASS` |
| Tests | `Yes` | `pnpm test` (671/671 passed across 40 test files) | `PASS` |
| Migration / data integrity | `No` | No schema changes | `N/A` |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None.
- **Design Assumptions:** Administrative login uses the same credentials schema (`email`, `password`) as customer login.

---

## 9. Plan Review

- **Status:** `✅ Done - Approved and Closed by Human Reviewer`
