# Task: P2-T018 - Implement Super Admin Creation of Admin Accounts

> **Canonical Status:** `✅ Done`
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-RBAC-003.1`, `FR-ADMIN-001` (`FR-ADMIN-001.1`, `FR-ADMIN-001.2`, `FR-ADMIN-001.3`, `FR-ADMIN-001.4`)  
> **ERD Reference:** `User` model, `Admin` model, `Account` model, `AuditLog` model (`prisma/schema/auth.prisma`, `prisma/schema/profiles.prisma`, `prisma/schema/audit.prisma`)  
> **Dependencies:** `P2-T015` (✅), `P2-T016` (✅), `P2-T017` (✅)  
> **Blockers:** `P2-B001` (Endpoint paths & contracts), `P2-B004` (Admin credential & creation flow)

---

## 1. Context & Traceability

- **Objective:** Establish the administrative module (`src/app/modules/admin/`) and implement the `POST /api/v1/admin/admins` endpoint allowing an authenticated `SUPER_ADMIN` to create new administrator (`ADMIN`) accounts with atomic credential provisioning, `Admin` profile record creation, initial password security (`needPasswordChange: true`), and compliant audit logging via `AuditService`.
- **PRD Alignment:**
  - `FR-RBAC-003.1`: Super Admin can create Admin accounts (assigned exactly the `ADMIN` role).
  - `FR-ADMIN-001.1`: Only Super Admin can create an Admin account; attempts by an `ADMIN` or `CUSTOMER` receive `HTTP 403 Forbidden`.
  - `FR-ADMIN-001.2`: Operation must not create or assign a `SUPER_ADMIN` role; any attempt to create a `SUPER_ADMIN` through this operation receives `HTTP 403 Forbidden`.
  - `FR-ADMIN-001.3`: Public self-registration for Admin accounts is not supported; accounts follow administrative provisioning.
  - `FR-ADMIN-001.4`: Admin account creation must be auditable (actor, target, action, and timestamp are recorded via `AuditService`).

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Dedicated Admin Module (`src/app/modules/admin/`):**
   - Establish `admin.interface.ts`, `admin.validation.ts`, `admin.service.ts`, `admin.controller.ts`, and `admin.routes.ts`.
   - Mount `AdminRoutes` under `/admin` in `src/app/routes/index.ts`.
2. **Access Control & Guard Configuration:**
   - Route `POST /api/v1/admin/admins` is protected by `authGuard` and `rbacGuard(UserRole.SUPER_ADMIN)`.
   - Unauthenticated requests receive `HTTP 401 Unauthorized` (`PUBLIC_ERROR_CODES.UNAUTHORIZED`).
   - Authenticated requests with `role: ADMIN` or `role: CUSTOMER` receive `HTTP 403 Forbidden` (`PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS`).
3. **Request Contract & Validation (`admin.validation.ts`):**
   - Schema `createAdminSchema`:
     - `name`: string (2 to 100 characters).
     - `email`: RFC 5321 compliant email string, trimmed and converted to lowercase (max 255 chars).
     - `password`: initial password complying with `passwordSchema` (min 8, max 100 chars, upper, lower, number, special char).
     - Note: Profile fields (`contactNumber`, `address`) are deferred to profile update (`P2-T019`) adhering to the same separation pattern as `DEC-017`.
     - Explicit rejection / prevention of client-supplied `role`, `status`, or `needPasswordChange` overrides.
4. **Duplicate Email Rejection:**
   - Case-insensitive duplicate check against `User.email` in PostgreSQL.
   - If an account with the email already exists, throw `AppError(status.CONFLICT, PUBLIC_ERROR_CODES.USER_ALREADY_EXISTS, "User with this email already exists")`.
5. **Atomic Provisioning & Invariant Execution (`admin.service.ts`):**
   - Executes inside `prisma.$transaction`:
     - Generates user ID (`crypto.randomUUID()`).
     - Hashes password using Better Auth's standard timing-equalized hasher (`hashPassword` from `better-auth/crypto`).
     - Creates `User` record: `role = UserRole.ADMIN`, `status = UserStatus.ACTIVE`, `emailVerified = true`, `needPasswordChange = true`.
     - Creates `Account` record: `providerId = "credential"`, `accountId = userId`, `password = hashedPassword`.
     - Creates `Admin` profile record: `userId`, `contactNumber`, `address`.
     - Records audit log via `AuditService.record({ actorId, action: AuditAction.CREATE, entityType: AuditEntityType.ADMIN, entityId: userId, newValue: {...}, tx })`.
6. **Standard Response Envelope (`admin.controller.ts`):**
   - Returns `HTTP 201 Created` via `sendResponse`:
     - Flat, sanitized user and admin profile attributes without exposing passwords, password hashes, or session tokens.
7. **Automated Unit Testing:**
   - 100% test coverage across validation, service, controller, and route layers under `tests/unit/modules/admin/`.

### Out of Scope

- Administrative profile updates, role promotions/demotions, and status suspensions (`P2-T019`).
- Preventing Admin users from modifying other privileged accounts at service boundaries (`P2-T020`).
- Listing Admin accounts (`P2-T021`).
- Self-service first-time login password change UI/endpoint (already satisfied under `P2-T013`).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Require `SUPER_ADMIN` and reject `ADMIN` or `CUSTOMER` with HTTP 403 | Step 4 | Unit tests in `admin.routes.test.ts` and `admin.controller.test.ts` |
| Validate required input, reject duplicate email with HTTP 409 | Step 2, Step 3 | Unit tests in `admin.validation.test.ts` and `admin.service.test.ts` |
| Assign exactly `ADMIN` and reject any attempt to create `SUPER_ADMIN` | Step 2, Step 3 | Schema rejection and service assertion in unit tests |
| Set initial credential with `needPasswordChange: true` without secret exposure | Step 3 | Unit tests asserting DB writes and response sanitation |
| Create User, Account, Admin profile, and Audit Log atomically in transaction | Step 3 | Unit tests verifying transactional execution and `AuditService.record` call |

---

## 3. Verified Current Codebase State

- **Current Behavior / Gaps:**
  - Route registry in `src/app/routes/index.ts` currently mounts only `/auth` and `/customer`. No `/admin` module exists yet.
  - Better Auth's public sign-up defaults `role` to `CUSTOMER` and creates a `Customer` profile record. No administrative creation flow exists.
  - `Admin` model in `prisma/schema/profiles.prisma` (`userId`, `contactNumber`, `address`, `user`) is ready and mapped.
  - `User.needPasswordChange` boolean exists in `prisma/schema/auth.prisma` and is reset by `change-password` (`P2-T013`), but no flow currently sets it to `true` on creation.
  - `AuditService` (`P2-T016`) is established and supports dual `tx` execution.
  - `rbacGuard` (`P2-T015`) is established and enforces `UserRole.SUPER_ADMIN`.
- **Existing Code Patterns to Follow:**
  - `src/app/modules/customer/customer.validation.ts` and `customer.service.ts` provide clean module structure.
  - Common validation schemas (`emailSchema`, `passwordSchema`) imported from `src/app/validations/common.validation.ts`.
  - Typed Express locals `res.locals.validated` (`validateRequest`) and `res.locals.user` (`authGuard`).
  - Response formatting via `sendResponse` (`src/app/utils/sendResponse.ts`).

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  - `POST /api/v1/admin/admins → authGuard → rbacGuard(UserRole.SUPER_ADMIN) → validateRequest(createAdminSchema) → AdminController.createAdmin → AdminService.createAdmin → prisma.$transaction(tx => User + Account + Admin + AuditService.record) → sendResponse(201)`
- **Data & Schema Impact:**
  - Zero schema changes needed. Existing `User`, `Account`, `Admin`, and `AuditLog` models in Prisma completely support this flow.
- **Security & Authorization Invariants:**
  - Route-level and service-level enforcement that only `SUPER_ADMIN` may execute this operation.
  - Explicit assignment of `role = UserRole.ADMIN`; input schema disallows client role tampering.
  - Password hashed using scrypt/timing-equalized Better Auth crypto utility (`hashPassword`).
  - Account marked `needPasswordChange = true` so the admin is forced to change their password on first login.
  - Account marked `emailVerified = true` because it is created by an authorized Super Admin.
  - Audit log captures the creation event under `AuditAction.CREATE` and `AuditEntityType.ADMIN`.

---

## 5. Affected Files & Directives

| Action     | File Path                                                       | Responsibility                                                  |
| :--------- | :-------------------------------------------------------------- | :-------------------------------------------------------------- |
| `[NEW]`    | `src/app/modules/admin/admin.validation.ts`                     | Zod validation schema and inferred input types for Admin creation |
| `[NEW]`    | `src/app/modules/admin/admin.service.ts`                        | Business logic, duplicate checks, transaction, and audit log   |
| `[NEW]`    | `src/app/modules/admin/admin.controller.ts`                     | Controller orchestrating request, locals, and response          |
| `[NEW]`    | `src/app/modules/admin/admin.routes.ts`                         | Admin route definitions with `authGuard` and `rbacGuard`        |
| `[MODIFY]` | `src/app/routes/index.ts`                                       | Mount `/admin` routes on root application router                |
| `[NEW]`    | `tests/unit/modules/admin/admin.validation.test.ts`             | 100% unit test coverage for validation rules                    |
| `[NEW]`    | `tests/unit/modules/admin/admin.service.test.ts`                | 100% unit test coverage for business logic and transactions    |
| `[NEW]`    | `tests/unit/modules/admin/admin.controller.test.ts`             | 100% unit test coverage for HTTP controller handler             |
| `[NEW]`    | `tests/unit/modules/admin/admin.routes.test.ts`                 | 100% unit test coverage for route mounting and middleware guards|
| `[NEW]`    | `docs/governance/tasks/phase-2/P2-T018-super-admin-create-admin.md` | Persistent JIT task plan and implementation evidence            |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`                   | Track task status `🔲` → `🔄` → `🕵️` → `✅`                     |
| `[MODIFY]` | `docs/governance/MEMORY.md`                                     | Update current codebase state upon task closure                 |

---

## 6. Step-by-Step Execution Plan

1. **Step 1 (Planning Gate & Blocker Resolution):** Present this JIT task plan to the human lead, resolve `P2-B001` and `P2-B004` parameters, obtain explicit approval, and mark status `🔄 In progress`.
2. **Step 2 (Zod Validation & Inferred Types):** Create `src/app/modules/admin/admin.validation.ts` defining `createAdminSchema` and inferred `CreateAdminInput` type using shared primitive schemas.
3. **Step 3 (Service Layer Implementation):** Implement `AdminService.createAdmin` in `src/app/modules/admin/admin.service.ts` with duplicate email check, transaction handling, Better Auth password hashing, `User` + `Account` + `Admin` record creation, and `AuditService.record` integration.
4. **Step 4 (Controller, Routes & Router Mounting):** Implement `AdminController.createAdmin`, define `AdminRoutes` in `admin.routes.ts` protected by `authGuard` and `rbacGuard(UserRole.SUPER_ADMIN)`, and register `/admin` in `src/app/routes/index.ts`.
5. **Step 5 (Automated Unit Tests):** Create comprehensive Vitest unit test suites in `tests/unit/modules/admin/` (`admin.validation.test.ts`, `admin.service.test.ts`, `admin.controller.test.ts`, `admin.routes.test.ts`) asserting 100% statement, branch, function, and line coverage.
6. **Step 6 (Quality Gates Verification):** Execute `pnpm test`, `pnpm tsc --project tsconfig.test.json --noEmit`, `pnpm lint`, and `git diff --check`.
7. **Step 7 (Review Preparation):** Fill Section 7 and Section 10 with implementation evidence, set canonical status to `🕵️ Awaiting human review`, and present evidence for review.
8. **Step 8 (Final Approval & Closure):** Upon human approval, mark `✅ Done`, update `MEMORY.md` and `phase-2-auth-rbac.md`, and propose conventional git commit.

---

## 7. Verification & Quality Gates

| Check                      | Required | Command or Method                                       | Result    |
| :------------------------- | :------- | :------------------------------------------------------ | :-------- |
| Acceptance criteria        | `Yes`    | Code review + unit test suite verification              | `PASSED`  |
| Type check / build         | `Yes`    | `pnpm tsc --project tsconfig.test.json --noEmit` + build| `PASSED`  |
| Lint                       | `Yes`    | `pnpm lint`                                             | `PASSED`  |
| Tests                      | `Yes`    | `pnpm test`                                             | `PASSED`  |
| Migration / data integrity | `No`     | Uses existing Prisma schema models and enums            | `N/A`     |
| Manual verification        | `No`     | Replaced by exhaustive unit test suites                 | `N/A`     |

---

## 8. Assumptions & Blockers

- **Active Blockers:**
  - `P2-B001` (Public API): Approved endpoint is `POST /api/v1/admin/admins`.
  - `P2-B004` (Product/Security): Super Admin provides initial temporary password with `needPasswordChange: true`; Admin changes password on first login. Initial Super Admin provisioning is handled via deployment database seed script.
- **Design Assumptions Awaiting Approval:**
  - Admin module placed in `src/app/modules/admin/` mirroring `customer` and `auth`.
  - Creation operation sets `emailVerified: true` directly because the administrator is explicitly vetted and provisioned by the Super Admin.

---

## 9. Plan & Task Review

| Field       | Value                                                              |
| :---------- | :----------------------------------------------------------------- |
| Outcome     | `Approved`                                                         |
| Reviewed by | `Zahid (Human Lead)`                                               |
| Reviewed on | `2026-09-23`                                                       |
| Notes       | `Task implementation verified and approved by human lead. Marked Done.` |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `src/app/modules/admin/admin.validation.ts`: Zod schema `createAdminSchema` validating `name`, RFC email, complexity-enforced `password`, and exporting inferred `CreateAdminInput` type.
  - `src/app/modules/admin/admin.service.ts`: `AdminService.createAdmin` with defense-in-depth role check, duplicate email rejection (409 CONFLICT), Better Auth `hashPassword`, atomic transaction provisioning `User` + `Account` + `Admin`, `AuditService.record` integration, and symmetrical metadata return (`updatedAt: user.updatedAt`).
  - `src/app/modules/admin/admin.controller.ts`: `AdminController.createAdmin` handler using `catchAsync`, `res.locals.user as AuthUser`, `res.locals.validated?.body as CreateAdminInput`, and `sendResponse` (201 CREATED).
  - `src/app/modules/admin/admin.routes.ts`: `POST /admins` route protected by `authGuard`, `rbacGuard(UserRole.SUPER_ADMIN)`, and `validateRequest(AdminValidation.createAdminSchema)`.
  - `src/app/routes/index.ts`: Registered `AdminRoutes` under `/admin` (`POST /api/v1/admin/admins`).
  - `tests/unit/modules/admin/admin.validation.test.ts`: 100% coverage unit test suite for validation and sanitization rules.
  - `tests/unit/modules/admin/admin.service.test.ts`: 100% coverage unit test suite for authorization, duplicate check, transaction execution, and caller tx support.
  - `tests/unit/modules/admin/admin.controller.test.ts`: 100% coverage unit test suite for controller handler and error propagation.
  - `tests/unit/modules/admin/admin.routes.test.ts`: 100% coverage unit test suite for route configuration, method exclusivity, and guard chain.
  - `tests/integration/protectedRoutes.test.ts`: Added `/api/v1/admin/admins` to Supertest protected POST endpoints matrix (verified 401 Unauthorized for unauthenticated calls).
  - `docs/governance/tasks/phase-2/P2-T018-super-admin-create-admin.md`: Task tracking and implementation evidence.
- **Migration Created:**
  - `None` (uses existing Prisma models: `User`, `Account`, `Admin`, and `AuditLog`).
- **Test / Verification Output:**
  - `vitest run --coverage`: 34 test files passed, 419 tests passed, 0 failures. 100% statement, branch, function, and line coverage across `src/app/modules/admin`.
  - `pnpm tsc --project tsconfig.test.json --noEmit`: Exit code 0 (zero type errors).
  - `pnpm lint`: Exit code 0 (clean ESLint).
  - `git diff --check`: Exit code 0 (zero trailing whitespace/conflict artifacts).
- **Deviations from Original Plan:**
  - `None`.
- **Remaining Concerns / Follow-ups:**
  - `None`. Ready for final human review.
