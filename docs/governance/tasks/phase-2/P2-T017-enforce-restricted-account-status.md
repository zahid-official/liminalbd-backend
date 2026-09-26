# Task: P2-T017 - Enforce Restricted Account Status Across Protected Access

> **Canonical Status:** `✅ Done`  
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-RBAC-006` (`FR-RBAC-006.1`, `FR-RBAC-006.2`, `FR-RBAC-006.3`, `FR-RBAC-006.4`)  
> **ERD Reference:** `User` model, `UserStatus` enum, `Session` model, `AuditLog` model (`prisma/schema/auth.prisma`, `prisma/schema/audit.prisma`)  
> **Dependencies:** `P2-T010` (✅), `P2-T015` (✅), `P2-T016` (✅)

---

## 1. Context & Traceability

- **Objective:** Prevent suspended, deactivated, and soft-deleted accounts from accessing protected resources behind `authGuard`, ensure restricting an account immediately and atomically invalidates all active sessions in PostgreSQL, emit compliant audit log events via `AuditService` for every status mutation, and provide reusable query filters for excluding restricted and soft-deleted accounts from active operations.
- **PRD Alignment:**
  - `FR-RBAC-006.1`: System must enforce account status during authentication and authorization (suspended and deactivated accounts receive HTTP 403 Forbidden; soft-deleted accounts receive HTTP 401 Unauthorized under anti-enumeration).
  - `FR-RBAC-006.2`: Restricting an account (`SUSPENDED`, `DEACTIVATED`, or `deletedAt`) must atomically invalidate all active sessions.
  - `FR-RBAC-006.3`: Account status changes must be auditable (actor, target, previous status, new status, action, and timestamp are recorded via `AuditService`).
  - `FR-RBAC-006.4`: Soft-deleted accounts must be excluded from normal system operations and active-user queries.

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **`authGuard` Status Enforcement (`src/app/middleware/authGuard.ts`):**
   - Inspect `sessionData.user.status` after session validation:
     - If `status === UserStatus.SUSPENDED`, throw `AppError(status.FORBIDDEN, PUBLIC_ERROR_CODES.ACCOUNT_SUSPENDED, "Your account has been suspended. Please contact support.")`.
     - If `status === UserStatus.DEACTIVATED`, throw `AppError(status.FORBIDDEN, PUBLIC_ERROR_CODES.ACCOUNT_DEACTIVATED, "Your account is deactivated. Please contact support.")`.
     - Preserve existing `sessionData.user.deletedAt` check throwing `HTTP 401 Unauthorized` (`PUBLIC_ERROR_CODES.UNAUTHORIZED`) for anti-enumeration per `DEC-018`.
2. **Account Status Contracts & Types (`src/app/shared/account/account.interface.ts`):**
   - Define strongly-typed interfaces:
     - `UpdateUserStatusInput`: `actorId?: string | null`, `targetUserId: string`, `newStatus: UserStatus`, `reason?: string`, `tx?: Prisma.TransactionClient`.
     - `SoftDeleteUserInput`: `actorId?: string | null`, `targetUserId: string`, `reason?: string`, `tx?: Prisma.TransactionClient`.
3. **Account Status & Invalidation Service (`src/app/shared/account/account.service.ts`):**
   - Provide `AccountService.updateStatus(input)`:
     - Validate target user exists.
     - Atomically update `User.status` in PostgreSQL.
     - When transitioning to a restricted status (`SUSPENDED` or `DEACTIVATED`), atomically delete all active sessions for that user (`tx.session.deleteMany({ where: { userId: targetUserId } })`).
     - Atomically record audit log via `AuditService.record()`:
       - `SUSPENDED` -> `AuditAction.SUSPEND`
       - `DEACTIVATED` -> `AuditAction.DEACTIVATE`
       - `ACTIVE` -> `AuditAction.REACTIVATE`
   - Provide `AccountService.softDelete(input)`:
     - Validate target user exists and is not already soft-deleted.
     - Atomically set `deletedAt = new Date()` on `User`.
     - Atomically delete all active sessions (`tx.session.deleteMany({ where: { userId: targetUserId } })`).
     - Atomically record audit log via `AuditService.record({ action: AuditAction.SOFT_DELETE, ... })`.
   - Provide standardized query filters:
     - `activeUserFilter: { deletedAt: null, status: UserStatus.ACTIVE }`
     - `nonDeletedUserFilter: { deletedAt: null }`
4. **Automated Unit Testing:**
   - Update `tests/unit/middleware/authGuard.test.ts` to assert 403 rejection for `SUSPENDED` and `DEACTIVATED` accounts.
   - Create `tests/unit/shared/account/account.service.test.ts` covering:
     - Status updates to `SUSPENDED` with atomic session deletion and `AuditAction.SUSPEND`.
     - Status updates to `DEACTIVATED` with atomic session deletion and `AuditAction.DEACTIVATE`.
     - Status updates to `ACTIVE` (reactivation) without session deletion and `AuditAction.REACTIVATE`.
     - Soft deletion with timestamp assignment, session invalidation, and `AuditAction.SOFT_DELETE`.
     - Standalone client fallback and custom transactional client (`tx`) delegation.
     - Error paths: non-existent target user rejection (`USER_NOT_FOUND`), already deleted rejection, and database failure propagation.
     - 100% statement, branch, function, and line coverage.

### Out of Scope

- Administrative HTTP routes and controllers for managing roles and accounts (`P2-T018`, `P2-T019`, `P2-T020`).
- Customer self-service account deletion endpoint (`P2-T026`).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Apply status checks during authentication and protected authorization | Step 4 | Unit test in `authGuard.test.ts` asserting 403 for `SUSPENDED` and `DEACTIVATED` |
| Ensure restricting an account invalidates active sessions | Step 5 | Unit test in `account.service.test.ts` asserting `session.deleteMany` call |
| Exclude soft-deleted users from normal active-user queries | Step 5 | Exported query filter helper verified in unit tests |
| Preserve business records and avoid physical deletion | Step 5 | Soft delete updates `deletedAt` without calling `user.delete()` |
| Produce required audit events and cover every restricted status | Step 5 | Unit tests asserting `AuditService.record` calls with correct actions |

---

## 3. Verified Current Codebase State

_Read-only inspection findings before execution:_

- **Current Behavior / Gaps:**
  - Login authentication in `src/app/config/auth.ts` already rejects suspended, deactivated, and deleted accounts.
  - However, protected requests in `src/app/middleware/authGuard.ts` only check `sessionData.user.deletedAt`, allowing suspended or deactivated users with active cookies to access protected resources until their session expires.
  - No reusable service currently coordinates status mutation, session revocation, and audit logging into a single atomic boundary.
- **Existing Code Patterns to Follow:**
  - `AuditService.record()` from `src/app/shared/audit/audit.service.ts` supports dual execution (`tx` or standalone `prisma`).
  - Error responses follow `AppError` and `PUBLIC_ERROR_CODES` (`ACCOUNT_SUSPENDED`, `ACCOUNT_DEACTIVATED`, `USER_NOT_FOUND`).
  - Middleware is wrapped with `catchAsync`.
- **Related Existing Files:**
  - `src/app/middleware/authGuard.ts`
  - `src/app/config/auth.ts`
  - `src/app/errors/errorCodes.ts`
  - `src/app/shared/audit/audit.service.ts`
  - `prisma/schema/auth.prisma`
  - `prisma/schema/audit.prisma`

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  - `Request → authGuard (inspects user.status & deletedAt) → next() or AppError(403/401)`
  - `Caller (Admin Service / Customer Service) → AccountService.updateStatus / softDelete → [tx | prisma].user.update + session.deleteMany + AuditService.record`
- **Session Revocation Invariant:**
  - Whenever account status becomes `SUSPENDED`, `DEACTIVATED`, or `deletedAt` is set, `session.deleteMany({ where: { userId } })` is executed atomically inside the transaction.
- **Audit Invariant:**
  - Every status change emits an audit entry with `entityType: AuditEntityType.USER`, `previousValue: { status }`, `newValue: { status }`, and optional `metadata: { reason }`.

---

## 5. Affected Files & Directives

| Action     | File Path                                                             | Responsibility                                                  |
| :--------- | :-------------------------------------------------------------------- | :-------------------------------------------------------------- |
| `[MODIFY]` | `src/app/middleware/authGuard.ts`                                     | Enforce `UserStatus.SUSPENDED` and `DEACTIVATED` with HTTP 403  |
| `[NEW]`    | `src/app/shared/account/account.interface.ts`                         | Input contracts for status mutation and soft deletion           |
| `[NEW]`    | `src/app/shared/account/account.service.ts`                           | Reusable status mutation, session revocation, and audit logging |
| `[MODIFY]` | `tests/unit/middleware/authGuard.test.ts`                             | Add unit tests for `SUSPENDED` and `DEACTIVATED` rejection      |
| `[NEW]`    | `tests/unit/shared/account/account.service.test.ts`                   | 100% coverage unit tests for AccountService                     |
| `[NEW]`    | `docs/governance/tasks/phase-2/P2-T017-enforce-restricted-account-status.md` | Persistent JIT task plan and evidence record            |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`                         | Update task 16 status `🔄 In progress` then `✅ Done`            |
| `[MODIFY]` | `docs/governance/MEMORY.md`                                           | Update current-state memory upon task completion                |

---

## 6. Step-by-Step Execution Plan

1. **Step 3 (Approval & Status Update):** Obtain human approval of this JIT plan, update task status to `🔄 In progress` in task file and phase file (`phase-2-auth-rbac.md`).
2. **Step 4 (`authGuard` Status Enforcement):** Update `src/app/middleware/authGuard.ts` to inspect `sessionData.user.status` and throw `HTTP 403 Forbidden` (`ACCOUNT_SUSPENDED` or `ACCOUNT_DEACTIVATED`).
3. **Step 5 (Account Status Service & Invalidation):** Create `src/app/shared/account/account.interface.ts` and `src/app/shared/account/account.service.ts` implementing `updateStatus`, `softDelete`, and query filters with atomic session revocation and audit logging.
4. **Step 6 (Automated Unit Tests):** Update `tests/unit/middleware/authGuard.test.ts` and create `tests/unit/shared/account/account.service.test.ts` covering all branches and error cases.
5. **Step 7 (Quality Gates & Polish):** Execute `pnpm test`, `pnpm test:coverage tests/unit/shared/account/account.service.test.ts`, `pnpm tsc --project tsconfig.test.json --noEmit`, `pnpm lint`, and `git diff --check`.
6. **Step 8 (Review Preparation):** Complete Section 7 (Verification & Quality Gates) and Section 10 (Implementation Evidence) in this task file, update phase file status to `🕵️ Awaiting human review`, and present evidence.
7. **Step 9 (Final Approval & Closure):** Upon human approval, mark `✅ Done` in task file and phase file, update `MEMORY.md`, and present Git commit command.

---

## 7. Verification & Quality Gates

| Check                      | Required | Command or Method                                       | Result |
| :------------------------- | :------- | :------------------------------------------------------ | :----- |
| Acceptance criteria        | `Yes`    | Code review + unit test suite verification              | `PASS` |
| Type check / build         | `Yes`    | `pnpm tsc --project tsconfig.test.json --noEmit` + build| `PASS` |
| Lint                       | `Yes`    | `pnpm lint`                                             | `PASS` |
| Tests                      | `Yes`    | `pnpm test` (400 passed across 30 files, 100% coverage) | `PASS` |
| Migration / data integrity | `No`     | Uses existing Prisma schema models and enums            | `N/A`  |
| Manual verification        | `No`     | Replaced by exhaustive unit test suites                 | `N/A`  |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None.
- **Design Assumptions Awaiting Approval:**
  - Account status service placed under `src/app/shared/account/` as a shared cross-cutting boundary consumed by both admin and customer modules.
  - Soft deletion assigns `deletedAt: new Date()` without physical deletion, preserving all business records (orders, inquiries, quotes).

---

## 9. Plan Review

| Field       | Value                                                              |
| :---------- | :----------------------------------------------------------------- |
| Outcome     | `Approved`                                                         |
| Reviewed by | `Zahid (Human Lead)`                                               |
| Reviewed on | `2026-09-21`                                                       |
| Notes       | `JIT plan approved by human lead. Proceeding with stepwise execution.` |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `src/app/middleware/authGuard.ts`: Enforced `UserStatus.SUSPENDED` and `UserStatus.DEACTIVATED` rejection with HTTP 403 Forbidden (`ACCOUNT_SUSPENDED`, `ACCOUNT_DEACTIVATED`).
  - `src/app/shared/account/account.interface.ts`: Defined `UpdateUserStatusInput` and `SoftDeleteUserInput` contracts.
  - `src/app/shared/account/account.service.ts`: Implemented `AccountService` (`updateStatus`, `softDelete`) with atomic session deletion (`tx.session.deleteMany`), audit logging via `AuditService.record`, redundant status transition protection (400 `VALIDATION_ERROR`), and exported standard query filters (`activeUserFilter`, `nonDeletedUserFilter`).
  - `tests/unit/middleware/authGuard.test.ts`: Added unit tests asserting 403 rejection for `SUSPENDED` and `DEACTIVATED` account statuses (12 passed, 100% coverage).
  - `tests/unit/shared/account/account.service.test.ts`: Created comprehensive unit test suite covering status mutations, session invalidation, soft-delete, audit trails, error bubbling, and query filters (15 passed, 100% coverage).
- **Migration Created:** None (uses existing Prisma schema and enums).
- **Test / Verification Output:**
  - `pnpm test`: 400 passed across 30 test files.
  - Coverage: 100% statements, branches, functions, and lines on both `authGuard.ts` and `account.service.ts`.
  - `pnpm tsc --project tsconfig.test.json --noEmit`: 0 errors.
  - `pnpm lint`: 0 errors.
  - `git diff --check`: 0 whitespace issues.
- **Deviations from Original Plan:**
  - Standardized naming from `accountStatus.service.ts` to `account.service.ts` and `AccountStatusService` to `AccountService` to match the established directory pattern (`src/app/shared/audit/audit.service.ts` and `src/app/shared/email/email.service.ts`).
  - Added redundant status transition check throwing `400 VALIDATION_ERROR` when user is already in the requested status.
  - Typed `activeUserFilter` and `nonDeletedUserFilter` with explicit `Prisma.UserWhereInput`.
- **Remaining Concerns / Follow-ups:** None.
