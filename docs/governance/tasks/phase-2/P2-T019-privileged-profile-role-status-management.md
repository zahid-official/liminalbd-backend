# Task: P2-T019 - Implement Privileged Profile, Role and Status Management

> **Canonical Status:** `✅ Done`
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-RBAC-003.2` through `FR-RBAC-003.7`, `FR-ADMIN-002` (`FR-ADMIN-002.1`, `FR-ADMIN-002.2`, `FR-ADMIN-002.3`, `FR-ADMIN-002.4`, `FR-ADMIN-002.5`), `FR-RBAC-006.2`  
> **ERD Reference:** `User` model, `Admin` model, `Session` model, `AuditLog` model (`prisma/schema/auth.prisma`, `prisma/schema/profiles.prisma`, `prisma/schema/audit.prisma`)  
> **Dependencies:** `P2-T018` (✅)  
> **Blockers:** `P2-B001` (Endpoint paths & contracts), `P2-B004` (Admin credential & creation flow)  

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T019`
- **PRD / Requirement Reference:**
  - `FR-ADMIN-002.1`: Only Super Admin can update another Admin's permitted profile information (`name`, `contactNumber`, `address`).
  - `FR-ADMIN-002.2`: Only Super Admin can modify an Admin's role according to role transition rules (`FR-RBAC-003`).
  - `FR-ADMIN-002.3`: Admin cannot modify another Admin or any Super Admin account (`HTTP 403 Forbidden`).
  - `FR-ADMIN-002.4`: Super Admin can manage an Admin account's status (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`); suspending/deactivating revokes active sessions.
  - `FR-ADMIN-002.5`: Admin account changes must be auditable with previous and new values.
  - `FR-RBAC-003.3`: Super Admin can promote an Admin to Super Admin (`ADMIN → SUPER_ADMIN`).
  - `FR-RBAC-003.4`: Super Admin can demote another Super Admin to Admin (`SUPER_ADMIN → ADMIN`).
  - `FR-RBAC-003.6`: Super Admin cannot modify their own role (self-role mutation rejected).
  - `FR-RBAC-003.7`: Super Admin role changes must be atomic and auditable.
  - `FR-RBAC-006.2`: Restricting an account must atomically invalidate active sessions.
- **ERD Reference:** `User` model, `Admin` model, `Session` model, `AuditLog` model (`prisma/schema/auth.prisma`, `prisma/schema/profiles.prisma`, `prisma/schema/audit.prisma`).
- **Dependencies:** `P2-T018` (✅ Super Admin creation of Admin accounts).

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Endpoint & HTTP Method:**
   - Establish `PATCH /api/v1/admins/:id` (per `DEC-027`).
   - Validate URL parameter `:id` as a valid UUID string.
2. **Access Control & Guard Configuration:**
   - Protected by `authGuard` and `rbacGuard(UserRole.SUPER_ADMIN)`.
   - Non-authenticated requests receive `HTTP 401 Unauthorized` (`PUBLIC_ERROR_CODES.UNAUTHORIZED`).
   - Non-Super Admin callers (`ADMIN`, `CUSTOMER`) receive `HTTP 403 Forbidden` (`PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS`).
3. **Request Contract & Validation (`admin.validation.ts` per `DEC-026`):**
   - Params schema: `id` (valid UUID string).
   - Body schema (`updateAdminSchema`):
     - `role`: enum of permitted privileged roles (`UserRole.ADMIN | UserRole.SUPER_ADMIN`, optional). Disallow assigning `CUSTOMER`.
     - `status`: enum of valid user statuses (`UserStatus.ACTIVE | UserStatus.SUSPENDED | UserStatus.DEACTIVATED`, optional).
     - At least one field must be provided in body (non-empty update payload).
     - *Note (`DEC-026`):* Personal profile fields (`name`, `contactNumber`, `address`) are explicitly excluded from privileged Super Admin management and reserved for self-service profile management.
4. **Target Account Invariants (`admin.service.ts`):**
   - Verify target user exists, is not soft-deleted (`deletedAt === null`), and is a privileged user (`role === ADMIN` or `role === SUPER_ADMIN`).
   - If target does not exist, is soft-deleted, or is a `CUSTOMER`, throw `HTTP 404 Not Found` (`PUBLIC_ERROR_CODES.USER_NOT_FOUND`).
5. **Self-Role Mutation & Self-Lockout Prevention (`FR-RBAC-003.5`, `FR-RBAC-003.6`):**
   - Reject any attempt by an authenticated Super Admin to mutate their own role (`actorId === targetUserId` and payload contains `role` differing from current role) with `HTTP 400 Bad Request` (`PUBLIC_ERROR_CODES.VALIDATION_ERROR`).
   - Reject any attempt by an authenticated Super Admin to suspend or deactivate their own account (`actorId === targetUserId` and `payload.status !== UserStatus.ACTIVE`) with `HTTP 400 Bad Request` (`PUBLIC_ERROR_CODES.VALIDATION_ERROR`) to prevent administrative platform lockout.
6. **Role Transition Rules (`FR-RBAC-003.3`, `FR-RBAC-003.4`):**
   - Support only approved transitions: `ADMIN → SUPER_ADMIN` (promotion) and `SUPER_ADMIN → ADMIN` (demotion).
7. **Session Revocation on Restriction (`FR-ADMIN-002.4`, `FR-RBAC-006.2`):**
   - If `status` is updated to `SUSPENDED` or `DEACTIVATED`, atomically revoke all active sessions of the target user in PostgreSQL (`tx.session.deleteMany({ where: { userId: targetUserId } })`).
8. **Minimal Projections, Atomic Execution & Granular Audit Trail (`FR-ADMIN-002.5`, `FR-RBAC-001.6`, `FR-RBAC-003.7`):**
   - Executes inside `prisma.$transaction` (or caller `tx`):
     - Uses explicit minimal `select` projection on both `findUnique` and `update` queries (per `03-CODING-STANDARDS.md §19`).
     - Updates `User` record (`role`, `status`).
     - Invalidates sessions if status is restricted.
     - Resolves granular semantic `AuditAction` (`ROLE_CHANGE`, `SUSPEND`, `DEACTIVATE`, `REACTIVATE`, or `UPDATE`).
     - Records audit event via `AuditService.record({ actorId, action, entityType: AuditEntityType.ADMIN, entityId: targetUserId, previousValue, newValue, tx })`.
9. **Standard Symmetrical Response (`admin.controller.ts`):**
   - Returns `HTTP 200 OK` with symmetrical, sanitized user and admin profile metadata matching `P2-T018`.
10. **Automated Unit & Integration Testing:**
    - 100% statement, branch, function, and line coverage across all newly added and modified methods in `tests/unit/modules/admin/`.

### Out of Scope

- Modifying personal profile fields (`name`, `contactNumber`, `address`) via privileged administrative endpoint (`DEC-026`).
- Preventing Admin users from modifying other privileged accounts at service boundaries (`P2-T020`).
- Listing Admin accounts with pagination and filters (`P2-T021`).
- Self-service admin profile updates (Super Admin centralized management only).
- Changing email or resetting password via profile update (handled via dedicated auth endpoints).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Require `SUPER_ADMIN` and reject `ADMIN` or `CUSTOMER` with HTTP 403 | Step 6 | Unit tests in `admin.routes.test.ts` & `admin.controller.test.ts` |
| Validate params UUID and body fields, reject empty updates with HTTP 400 | Step 4 | Unit tests in `admin.validation.test.ts` |
| Reject missing or non-privileged targets with HTTP 404 | Step 5 | Unit tests in `admin.service.test.ts` |
| Reject Super Admin self-role mutation with HTTP 400 | Step 5 | Unit tests in `admin.service.test.ts` |
| Support only `ADMIN ↔ SUPER_ADMIN` role transitions | Step 4, Step 5 | Unit tests in `admin.validation.test.ts` & `admin.service.test.ts` |
| Revoke sessions when account status is set to `SUSPENDED` or `DEACTIVATED` | Step 5 | Unit tests in `admin.service.test.ts` asserting `session.deleteMany` |
| Apply updates atomically and record audit log with before/after values | Step 5 | Unit tests in `admin.service.test.ts` asserting `AuditService.record` |

---

## 3. Verified Current Codebase State

- **Current Behavior / Gaps:**
  - `POST /api/v1/admins` exists and creates admin accounts (`P2-T018`, updated per `DEC-027`).
  - No `PATCH /api/v1/admins/:id` route exists yet (to be implemented under this task per `DEC-027`).
  - `Admin` model (`userId`, `contactNumber`, `address`, `createdAt`, `updatedAt`) is linked to `User`.
  - `AccountService.updateStatus` (`P2-T017`) demonstrates atomic session invalidation on restriction.
  - `AuditService.record` (`P2-T016`) supports `AuditAction.UPDATE` with `previousValue` and `newValue`.
  - `rbacGuard` (`P2-T015`) enforces `UserRole.SUPER_ADMIN`.
- **Existing Code Patterns to Follow:**
  - `src/app/modules/admin/admin.validation.ts`, `admin.service.ts`, `admin.controller.ts`, `admin.routes.ts`.
  - Typed Express locals: `res.locals.validated?.params`, `res.locals.validated?.body`, `res.locals.user`.

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  - Route (`PATCH /admins/:id` + `authGuard` + `rbacGuard` + `validateRequest`) → Controller (`catchAsync` + typed locals) → Service (`updateAdmin` in `prisma.$transaction`) → Database (`User`, `Admin`, `Session`, `AuditLog`).
- **Data / Schema Impact:**
  - Uses existing Prisma models (`User`, `Admin`, `Session`, `AuditLog`); no database schema migrations needed.
- **Public API / Contract Impact:**
  - Adds `PATCH /api/v1/admins/:id` endpoint returning HTTP 200 OK with sanitized user and admin profile data (`DEC-027`).
- **Security & Authorization Considerations:**
  - Route protected by `authGuard` and `rbacGuard(UserRole.SUPER_ADMIN)`.
  - Service layer defense-in-depth role check.
  - Immediate session invalidation for restricted accounts prevents session hijacking after suspension.
  - Strict prevention of self-role mutation eliminates administrative lockouts.

---

## 5. Affected Files & Directives

| Action     | File Path                                                       | Responsibility |
| :--------- | :-------------------------------------------------------------- | :------------- |
| `[MODIFY]` | `src/app/modules/admin/admin.validation.ts`                     | Add `updateAdminSchema` (params + body) and inferred types |
| `[MODIFY]` | `src/app/modules/admin/admin.service.ts`                        | Implement `AdminService.updateAdmin` with atomic updates and audit logging |
| `[MODIFY]` | `src/app/modules/admin/admin.controller.ts`                     | Add `AdminController.updateAdmin` handler |
| `[MODIFY]` | `src/app/modules/admin/admin.routes.ts`                         | Mount `PATCH /admins/:id` route |
| `[MODIFY]` | `tests/unit/modules/admin/admin.validation.test.ts`             | Add unit tests for update validation schemas |
| `[MODIFY]` | `tests/unit/modules/admin/admin.service.test.ts`                | Add unit tests for update business logic, role checks, and session invalidation |
| `[MODIFY]` | `tests/unit/modules/admin/admin.controller.test.ts`             | Add unit tests for update controller handler |
| `[MODIFY]` | `tests/unit/modules/admin/admin.routes.test.ts`                 | Add unit tests for route registration, guards, and method exclusivity |
| `[MODIFY]` | `tests/integration/protectedRoutes.test.ts`                     | Add `PATCH /api/v1/admins/:id` to protected endpoints |
| `[NEW]`    | `docs/governance/tasks/phase-2/P2-T019-privileged-profile-role-status-management.md` | Persistent JIT task plan and implementation evidence |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`                   | Track task status `🔲` → `🔄` → `🕵️` → `✅` |
| `[MODIFY]` | `docs/governance/MEMORY.md`                                     | Update current codebase state upon task closure |

---

## 6. Step-by-Step Execution Plan

1. **Step 1 (Pre-planning Read-Only Inspection):** Inspect requirements, Prisma models, existing services, and security constraints. [Done]
2. **Step 2 (Draft JIT Task Plan):** Create persistent task plan `docs/governance/tasks/phase-2/P2-T019-privileged-profile-role-status-management.md`. [Current]
3. **Step 3 (Human Approval & Status Update):** Obtain human lead approval, update parent phase file and task file status to `🔄 In progress`.
4. **Step 4 (Validation Layer):** Extend `admin.validation.ts` with `updateAdminSchema` validating UUID params and partial body fields (`name`, `contactNumber`, `address`, `role`, `status`), enforcing non-empty body.
5. **Step 5 (Business Service Layer):** Implement `AdminService.updateAdmin` in `admin.service.ts` with target check, self-role check, role transition check, session invalidation on restriction, and audit logging.
6. **Step 6 (Controller & Routes Layer):** Add `AdminController.updateAdmin`, mount `PATCH /admins/:id` in `admin.routes.ts`.
7. **Step 7 (Automated Testing):** Update unit tests in `tests/unit/modules/admin/` and add integration test in `tests/integration/protectedRoutes.test.ts`.
8. **Step 8 (Quality Gates):** Run `pnpm test:coverage`, `pnpm tsc --project tsconfig.test.json --noEmit`, `pnpm lint`, and `git diff --check`.
9. **Step 9 (Review Preparation):** Complete Section 7 & 10 in JIT task file, mark status `🕵️ Awaiting human review`.
10. **Step 10 (Final Closure):** Obtain human lead approval, mark `✅ Done`, update `MEMORY.md`, `phase-2-auth-rbac.md`, and propose git commit.

---

## 7. Verification & Quality Gates

| Check                      | Required | Command or Method                                       | Result    |
| :------------------------- | :------- | :------------------------------------------------------ | :-------- |
| Acceptance criteria        | `Yes`    | Code review + unit test suite verification              | `PASS`    |
| Type check / build         | `Yes`    | `pnpm tsc --noEmit`                                     | `PASS`    |
| Lint                       | `Yes`    | `pnpm lint`                                             | `PASS`    |
| Tests                      | `Yes`    | `pnpm test:coverage`                                    | `PASS`    |
| Migration / data integrity | `No`     | Uses existing Prisma schema models and enums            | `N/A`     |
| Manual verification        | `No`     | Replaced by exhaustive unit test suites                 | `N/A`     |

---

## 8. Assumptions & Blockers

- **Active Blockers:**
  - `P2-B001` (Public API): Approved endpoint is `PATCH /api/v1/admins/:id` (per `DEC-027`).
  - `P2-B004` (Product/Security): Privileged profile, role, and status management flow governed by `FR-ADMIN-002` and `FR-RBAC-003`.
- **Design Assumptions Awaiting Approval:**
  - At least one field must be provided in request body for `PATCH` (reject empty payload with 400 Bad Request).
  - Target must be an existing, non-deleted account with privileged role (`ADMIN` or `SUPER_ADMIN`). Attempts to modify a `CUSTOMER` through this administrative endpoint return 404 Not Found.
  - Self-role mutation by a Super Admin is rejected with 400 Bad Request (`FR-RBAC-003.6`).

---

## 9. Plan Review

| Field       | Value                                                              |
| :---------- | :----------------------------------------------------------------- |
| Outcome     | `Approved`                                                         |
| Reviewed by | `Zahid (Human Lead)`                                               |
| Reviewed on | `2026-09-23`                                                       |
| Notes       | `JIT plan approved by human lead. Proceeding with stepwise execution.` |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `src/app/modules/admin/admin.validation.ts`: Added `updateAdminSchema` (validating UUID `:id` param with Zod 4 `.pipe(z.uuid(...))`, partial body fields `role` and `status`, rejecting non-privileged roles like `CUSTOMER` and empty payloads).
  - `src/app/modules/admin/admin.interface.ts`: Created `UpdateAdminServiceInput` interface with optional `tx`.
  - `src/app/modules/admin/admin.service.ts`: Implemented `AdminService.updateAdmin` with target existence check, self-role mutation guard, self-lockout guard, atomic database transaction (`tx`), session invalidation on restriction (`SUSPENDED`/`DEACTIVATED`), zero runtime allocation semantic `AuditAction` mapping, and minimal field projections.
  - `src/app/modules/admin/admin.controller.ts`: Implemented `AdminController.updateAdmin` handler with typed Express locals and `sendResponse(200)`.
  - `src/app/modules/admin/admin.routes.ts`: Mounted `PATCH /:id` with `authGuard`, `rbacGuard(UserRole.SUPER_ADMIN)`, and `validateRequest(updateAdminSchema)`.
  - `src/app/routes/index.ts`: Standardized root routers with pluralized paths `/admins` and `/customers` under `DEC-027`.
  - `tests/unit/modules/admin/admin.validation.test.ts`: Added 14 unit tests for params and body validation (total 24 tests, 100% coverage).
  - `tests/unit/modules/admin/admin.service.test.ts`: Added 15 unit tests covering authorization, self-role, self-lockout, target invariants, role transitions, status restrictions, session invalidation, and caller transaction support (total 20 tests, 100% coverage).
  - `tests/unit/modules/admin/admin.controller.test.ts`: Added 2 unit tests covering successful update response and error forwarding (total 4 tests, 100% coverage).
  - `tests/unit/modules/admin/admin.routes.test.ts`: Added unit tests for `PATCH /:id` (100% coverage).
  - `tests/unit/routes/index.test.ts`: Added unit tests asserting `/auth`, `/admins`, and `/customers` mount properly (100% coverage).
  - `tests/integration/protectedRoutes.test.ts`: Added `POST /api/v1/admins` and `PATCH /api/v1/admins/:id` to Supertest protected route matrix.
  - `docs/governance/DECISIONS.md`: Recorded `DEC-026` and `DEC-027`.
  - `docs/governance/MEMORY.md`: Synchronized current state and test counts.
  - `docs/governance/phases/phase-2-auth-rbac.md`: Synchronized paths under `DEC-027`.
- **Migration Created:** None (uses existing Prisma schema and database models).
- **Test / Verification Output:**
  - `pnpm test`: 456 tests passed across 35 test files.
  - `pnpm test:coverage`: 100% statement, branch, function, and line coverage across `src/app/modules/admin/` and `src/app/routes/index.ts`.
  - `pnpm lint`: 0 errors, 0 warnings.
  - `pnpm tsc --noEmit`: 0 errors.
  - `git diff --check`: 0 whitespace issues.
- **Deviations from Original Plan:**
  - Standardized root routes to plural REST resource collections (`/api/v1/admins` and `/api/v1/customers/register`) per human lead guidance and recorded under `DEC-027`.
- **Remaining Concerns / Follow-ups:** None.
