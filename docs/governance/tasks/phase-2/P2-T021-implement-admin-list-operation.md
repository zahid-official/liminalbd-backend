# Task: P2-T021 - Implement the Super Admin Admin-List Operation

> **Canonical Status:** `🔄 In progress`
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
> **Requirement Reference:** `FR-ADMIN-003` (`FR-ADMIN-003.1`–`FR-ADMIN-003.3`)
> **ERD Reference:** `User` model, `Admin` model (`prisma/schema/auth.prisma`, `prisma/schema/profiles.prisma`)
> **Dependencies:** `P2-T019` (✅ Privileged profile, role and status management), `P2-T020` (✅ Enforce and audit Admin restrictions on privileged accounts)
> **Blockers:** `P2-B001` (Public API paths & contracts - RESOLVED)

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T021`
- **PRD / Requirement Reference:**
  - `FR-ADMIN-003.1`: Only Super Admin can retrieve the list of Admin accounts. Attempts by an `ADMIN` or `CUSTOMER` receive `HTTP 403 Forbidden`.
  - `FR-ADMIN-003.2`: The Admin list must support standard query capabilities: pagination (`page`, `limit`), text search (`searchTerm`), sorting (`sortBy`, `sortOrder`), and account status filtering (`status`).
  - `FR-ADMIN-003.3`: The Admin list must only include accounts with the `ADMIN` role. `SUPER_ADMIN` and `CUSTOMER` accounts must be strictly excluded.
- **ERD Reference:** `User` model and `Admin` model in `prisma/schema/auth.prisma` and `prisma/schema/profiles.prisma`.
- **Dependencies:** `P2-T019` (Admin profile management), `P2-T020` (Defense-in-depth and security audit boundary).

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

- Implement Zod query validation schema `getAdminsQuerySchema` in `src/app/modules/admin/admin.validation.ts` validating `page` (min 1, default 1), `limit` (min 1, max 100, default 10), `sortBy` (allowed: `createdAt`, `updatedAt`, `name`, `email`, `status`; default `createdAt`), `sortOrder` (`asc`, `desc`; default `desc`), `searchTerm` (trimmed string, search across `name` and `email`), and `status` (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`).
- Implement `AdminService.getAdmins` in `src/app/modules/admin/admin.service.ts`:
  - Defense-in-depth authorization check ensuring caller is `SUPER_ADMIN`. Reject non-Super Admin callers with `HTTP 403 Forbidden` (`PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS`) and record an audit log (`action: AuditAction.UNAUTHORIZED_ATTEMPT`).
  - Query filters: `role: UserRole.ADMIN` strictly (excluding `SUPER_ADMIN` and `CUSTOMER`) and `deletedAt: null`.
  - Optional dynamic filters: `status: query.status`, case-insensitive `searchTerm` filter against `name` and `email`.
  - Pagination execution with `skip = (page - 1) * limit` and `take = limit`.
  - Sorting execution via Prisma `orderBy: { [query.sortBy]: query.sortOrder }`.
  - Safe data projection including `id`, `name`, `email`, `emailVerified`, `role`, `status`, `needPasswordChange`, `createdAt`, `updatedAt`, and linked `admin` profile (`contactNumber`, `address`, `createdAt`, `updatedAt`). Exclude credentials and internal auth accounts/sessions.
  - Return `{ data: admins, meta: { page, limit, total, totalPages } }`.
- Implement `AdminController.getAdmins` in `src/app/modules/admin/admin.controller.ts` consuming validated query from `res.locals.validated.query` and returning `sendResponse` with `statusCode: status.OK`, message `"Admins retrieved successfully"`, `data`, and `meta`.
- Mount `GET /` on `AdminRoutes` in `src/app/modules/admin/admin.routes.ts` protected by `authGuard`, `rbacGuard(UserRole.SUPER_ADMIN)`, and `validateRequest(AdminValidation.getAdminsQuerySchema)`.
- Exhaustive unit test coverage for validation, service, controller, and routes.

### Out of Scope

- Customer list operations (`P2-T025`).
- Modifying Prisma schema or creating database migrations (existing models satisfy all requirements).
- Routine read-query audit logging into database table (standard HTTP access logging is handled by Pino).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Permit only `SUPER_ADMIN`; reject `ADMIN` and `CUSTOMER` with HTTP 403 | Step 4, Step 5, Step 6 | Unit tests in `admin.service.test.ts`, `admin.routes.test.ts` |
| Return only users whose role is exactly `ADMIN` (`SUPER_ADMIN` and `CUSTOMER` excluded) | Step 5 | Unit tests in `admin.service.test.ts` |
| Validate pagination, search, sorting and account-status filters through Zod | Step 4 | Unit tests in `admin.validation.test.ts` |
| Exclude soft-deleted accounts from results and return approved pagination metadata | Step 5 | Unit tests in `admin.service.test.ts` |
| Prevent unsafe sort/filter fields and unnecessary data exposure | Step 4, Step 5 | Unit tests in `admin.validation.test.ts`, `admin.service.test.ts` |

---

## 3. Verified Current Codebase State

- **Current Behavior / Gaps:**
  - `src/app/modules/admin/` currently implements `createAdmin` (`POST /api/v1/admins`) and `updateAdmin` (`PATCH /api/v1/admins/:id`).
  - No `GET /api/v1/admins` route, controller, service, or query validation schema exists.
- **Existing Code Patterns to Follow:**
  - `validateRequest` parses query inputs via `schema.query` and attaches to `res.locals.validated.query`.
  - `sendResponse` accepts `{ statusCode, message, data, meta }` with `PaginationMeta: { page, limit, total, totalPages }`.
  - `authGuard` and `rbacGuard(UserRole.SUPER_ADMIN)` protect privileged endpoints.
  - Defense-in-depth service checks record `AuditAction.UNAUTHORIZED_ATTEMPT` on non-Super Admin attempts.
- **Related Existing Files:**
  - `src/app/modules/admin/admin.validation.ts`
  - `src/app/modules/admin/admin.interface.ts`
  - `src/app/modules/admin/admin.service.ts`
  - `src/app/modules/admin/admin.controller.ts`
  - `src/app/modules/admin/admin.routes.ts`

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  `Route (GET /api/v1/admins) → Middleware (authGuard, rbacGuard, validateRequest) → Controller (getAdmins) → Service (AdminService.getAdmins) → Prisma (findMany, count) → Response (sendResponse)`
- **Data / Schema Impact:**
  - Zero database schema migrations required. Uses existing `User` and `Admin` models.
- **Public API / Contract Impact:**
  - Adds `GET /api/v1/admins` returning HTTP 200 with `{ success: true, message: "Admins retrieved successfully", data: AdminUser[], meta: PaginationMeta }`.
  - Conforms to `DEC-027` pluralized RESTful resource routing.
- **Security & Authorization Considerations:**
  - Route-level RBAC: `rbacGuard(UserRole.SUPER_ADMIN)` rejects unauthorized roles with 403 `FORBIDDEN_ROLE_ACCESS`.
  - Service-level defense-in-depth: `AdminService.getAdmins` checks `actorRole === UserRole.SUPER_ADMIN`, logs `UNAUTHORIZED_ATTEMPT` to audit log if violated, and throws 403.
  - Zero sensitive data exposure: Credentials, password hashes, external accounts, sessions, and soft-deleted records are strictly excluded from projection.
  - Strict input bounding: Zod coerces and bounds `page >= 1`, `1 <= limit <= 100`, and restricts `sortBy` to a whitelist of safe indexed/scalar columns.

---

## 5. Affected Files & Directives

| Action     | File Path                                                                   | Responsibility |
| :--------- | :-------------------------------------------------------------------------- | :------------- |
| `[NEW]`    | `docs/governance/tasks/phase-2/P2-T021-implement-admin-list-operation.md`    | JIT task plan and implementation evidence |
| `[MODIFY]` | `src/app/modules/admin/admin.validation.ts`                                 | Define `getAdminsQuerySchema` and export `GetAdminsQueryInput` |
| `[MODIFY]` | `src/app/modules/admin/admin.interface.ts`                                  | Define `GetAdminsServiceInput` and `GetAdminsResult` |
| `[MODIFY]` | `src/app/modules/admin/admin.service.ts`                                    | Implement `getAdmins` with filtering, pagination, and projection |
| `[MODIFY]` | `src/app/modules/admin/admin.controller.ts`                                 | Implement `getAdmins` handler and format response with meta |
| `[MODIFY]` | `src/app/modules/admin/admin.routes.ts`                                     | Mount `GET /` with auth, rbac, and validation middlewares |
| `[MODIFY]` | `tests/unit/modules/admin/admin.validation.test.ts`                         | Add unit tests for `getAdminsQuerySchema` |
| `[MODIFY]` | `tests/unit/modules/admin/admin.service.test.ts`                            | Add unit tests for `getAdmins` service logic |
| `[MODIFY]` | `tests/unit/modules/admin/admin.controller.test.ts`                         | Add unit tests for `getAdmins` controller |
| `[MODIFY]` | `tests/unit/modules/admin/admin.routes.test.ts`                             | Add unit tests for `GET /api/v1/admins` route definitions |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`                               | Track task status `🔲` → `🔄` → `🕵️` → `✅` |
| `[MODIFY]` | `docs/governance/MEMORY.md`                                                 | Track active task and codebase state |

---

## 6. Step-by-Step Execution Plan

1. **Step 1 (Pre-planning Read-Only Inspection):** Inspect requirements, database models, pagination interfaces, and existing admin module files. [Done]
2. **Step 2 (Draft JIT Task Plan):** Create persistent task plan `docs/governance/tasks/phase-2/P2-T021-implement-admin-list-operation.md`. [Current]
3. **Step 3 (Human Approval & Status Update):** Obtain human lead approval, update parent phase file and task file status to `🔄 In progress`.
4. **Step 4 (Query Validation Schema):** Implement `getAdminsQuerySchema` in `src/app/modules/admin/admin.validation.ts` and update `admin.validation.test.ts`.
5. **Step 5 (Service Layer Implementation):** Implement `getAdmins` in `src/app/modules/admin/admin.service.ts` and `admin.interface.ts`, updating `admin.service.test.ts`.
6. **Step 6 (Controller & Route Mounting):** Implement `AdminController.getAdmins` in `admin.controller.ts`, mount `GET /` in `admin.routes.ts`, and update controller/routes unit tests.
7. **Step 7 (Automated Testing & Full Suite Run):** Run full test suite (`pnpm test`), ensuring zero regressions.
8. **Step 8 (Quality Gates):** Run `pnpm test:coverage` (100% on admin module), `pnpm tsc --noEmit`, `pnpm lint`, and `git diff --check`.
9. **Step 9 (Review Preparation):** Complete Section 7 & 10 in JIT task file, mark status `🕵️ Awaiting human review`.
10. **Step 10 (Final Closure):** Obtain human lead approval, mark `✅ Done`, update `MEMORY.md`, `phase-2-auth-rbac.md`, and propose git commit.

---

## 7. Verification & Quality Gates

| Check                      | Required | Command or Method                          | Result    |
| :------------------------- | :------- | :----------------------------------------- | :-------- |
| Acceptance criteria        | `Yes`    | Code review + unit test suite verification | `NOT RUN` |
| Type check / build         | `Yes`    | `pnpm tsc --noEmit`                        | `NOT RUN` |
| Lint                       | `Yes`    | `pnpm lint`                                | `NOT RUN` |
| Tests                      | `Yes`    | `pnpm test:coverage`                       | `NOT RUN` |
| Migration / data integrity | `No`     | Uses existing Prisma models                | `N/A`     |
| Manual verification        | `No`     | Replaced by exhaustive unit test suites    | `N/A`     |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None (`P2-B001` resolved).
- **Design Assumptions:**
  - Query parameters (`page`, `limit`) are coerced from string to integer via Zod. Default values are `page: 1`, `limit: 10`, `sortBy: "createdAt"`, `sortOrder: "desc"`.
  - Search term performs case-insensitive containment match on `name` OR `email`.
  - Non-Super Admin access attempts are rejected with `HTTP 403 Forbidden` and audited via `AuditAction.UNAUTHORIZED_ATTEMPT`.

---

## 9. Plan Review

| Field       | Value                                                              |
| :---------- | :----------------------------------------------------------------- |
| Outcome     | `Approved`                                                         |
| Reviewed by | `Zahid (Human Lead)`                                               |
| Reviewed on | `2026-09-24`                                                       |
| Notes       | `JIT plan approved by human lead. Proceeding with stepwise execution.` |

---

## 10. Implementation Evidence

_To be completed after code execution and before marking awaiting human review:_

- **Changed Files:**
- **Migration Created:**
- **Test / Verification Output:**
- **Deviations from Original Plan:**
- **Remaining Concerns / Follow-ups:**
