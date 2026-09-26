# Task: P2-T023 - Implement Authorized Customer Profile Retrieval

> **Canonical Status:** `✅ Done`  
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-CUSTOMER-003`, `FR-RBAC-005` (`FR-RBAC-005.1`–`FR-RBAC-005.4`)  
> **ERD Reference:** `User` model, `Customer` model (`prisma/schema/auth.prisma`, `prisma/schema/profiles.prisma`)  
> **Dependencies:** `P2-T022` (✅ Reusable ownership authorization pattern), `P2-T010` (✅ Auth guard session context), `P2-T015` (✅ RBAC guard)  
> **Blockers:** `P2-B001` (Resolved per `DEC-027`), `P2-B008` (Resolved per `DEC-008`)  

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T023`
- **PRD / Requirement Reference:**
  - `FR-CUSTOMER-003.1`: `SUPER_ADMIN` and `ADMIN` can view a customer's permitted administrative profile.
  - `FR-CUSTOMER-003.2`: Customers can view their own profile (centralized uniformly under `GET /api/v1/users/profile` via `UserService.getProfile`).
  - `FR-CUSTOMER-003.3`: Customers cannot access another customer's profile (cross-customer access rejected with `HTTP 403 Forbidden` / role-isolated at gateway).
  - `FR-CUSTOMER-003.4`: Customer data access must enforce server-side role and identity rules derived from authenticated session context.
  - `FR-RBAC-005.1`–`FR-RBAC-005.4`: Defense-in-depth authorization, role verification, and auditable access control.
- **ERD Reference:** `User` in `prisma/schema/auth.prisma`, `Customer` in `prisma/schema/profiles.prisma`.
- **Dependencies:** `P2-T010` (`authGuard`), `P2-T015` (`rbacGuard`), `P2-T022` (`AuthorizationService`).

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

- Implement request validation schema `getCustomerSchema` in `src/app/modules/customer/customer.validation.ts` validating UUID route parameter `:id`.
- Export inferred type `GetCustomerParams` from `getCustomerSchema.params`.
- Implement `CustomerService.getCustomerById` in `src/app/modules/customer/customer.service.ts`:
  - Directly accept `customerId: string` as single parameter adhering strictly to KISS and YAGNI (no redundant single-property wrapper interface).
  - Query target user by `:id` with `include: { customer: true }`.
  - Validate that target user exists, is not soft-deleted (`deletedAt === null`), and has `role === UserRole.CUSTOMER`. If not, throw `AppError(status.NOT_FOUND, PUBLIC_ERROR_CODES.USER_NOT_FOUND, "Customer not found")`.
  - Return flattened, sanitized customer profile representation without leaking sensitive attributes (passwords, tokens, internal flags).
  - Resolve accurate `updatedAt` timestamp prioritizing latest modification between `targetUser.customer.updatedAt` and `targetUser.updatedAt`.
- Implement `CustomerController.getCustomerById` in `src/app/modules/customer/customer.controller.ts` wrapped with `catchAsync` and returning standardized JSON envelope via `sendResponse`.
- Mount `GET /api/v1/customers/:id` in `src/app/modules/customer/customer.routes.ts` protected by `authGuard`, `rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN)`, and `validateRequest(CustomerValidation.getCustomerSchema)`.
- Implement automated Vitest unit tests in `tests/unit/modules/customer/`:
  - Validate param schema (valid UUID passes, invalid UUID fails with 400).
  - Verify administrative retrieval by `ADMIN` and `SUPER_ADMIN` succeeds with 200 OK and expected flattened DTO.
  - Verify unauthorized roles (e.g. `CUSTOMER`) are blocked with 403 `FORBIDDEN_ROLE_ACCESS`.
  - Verify non-existent, non-customer, or soft-deleted customer returns 404 `USER_NOT_FOUND`.
  - Verify route middleware and controller orchestration.

### Out of Scope

- Customer profile update endpoints (`P2-T024`).
- Administrative customer listing with pagination and filters (`P2-T025`).
- Customer account lifecycle management (suspend, deactivate, soft-delete) (`P2-T026`).
- Future business modules (Orders, Inquiries) deferred per `DEC-008` / `P2-B008`.

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Administrative profile retrieval by ID (`ADMIN`, `SUPER_ADMIN`) | Step 5, Step 7 | Unit tests in `customer.service.test.ts` & `customer.controller.test.ts` |
| Unauthorized role (`CUSTOMER`) rejected with HTTP 403 Forbidden | Step 6, Step 7 | Unit tests asserting 403 `FORBIDDEN_ROLE_ACCESS` via `rbacGuard` |
| Non-existent, non-customer, or soft-deleted customer returns HTTP 404 | Step 5, Step 7 | Unit tests asserting 404 `USER_NOT_FOUND` |
| Sanitize response fields according to flat DTO contract | Step 5, Step 7 | Unit tests verifying returned JSON fields |
| Parameter validation enforces valid UUID `:id` | Step 4, Step 7 | Unit tests in `customer.validation.test.ts` |

---

## 3. Verified Current Codebase State

- **Current Behavior:**
  - `CustomerService.getCustomerById` cleanly fetches customer profile by ID with `include: { customer: true }`.
  - Parameter validation uses `CustomerValidation.getCustomerSchema` with piped trimmed UUID validation.
  - Route is mounted at `GET /api/v1/customers/:id` protected by `authGuard`, `rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN)`, and `validateRequest`.
  - Self-service customer profile retrieval is unified under `GET /api/v1/users/profile` (`UserService.getProfile`).
- **Existing Code Patterns Followed:**
  - Route: `router.get("/:id", authGuard, rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN), validateRequest(CustomerValidation.getCustomerSchema), CustomerController.getCustomerById)`.
  - Controller: Extract `res.locals.validated?.params as GetCustomerParams`, pass `params.id` to service, respond via `sendResponse`.
  - Service: `getCustomerById(customerId: string)` takes primitive ID directly without redundant wrapper object, returns flat DTO with latest timestamp.
- **Related Existing Files:**
  - `src/app/modules/customer/customer.routes.ts`
  - `src/app/modules/customer/customer.controller.ts`
  - `src/app/modules/customer/customer.service.ts`
  - `src/app/modules/customer/customer.validation.ts`
  - `src/app/middleware/authGuard.ts`
  - `src/app/middleware/rbacGuard.ts`
  - `src/app/errors/errorCodes.ts`

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  `Client → GET /api/v1/customers/:id → authGuard → rbacGuard(ADMIN, SUPER_ADMIN) → validateRequest(getCustomerSchema) → CustomerController.getCustomerById → CustomerService.getCustomerById(customerId) → prisma.user.findUnique({ include: { customer: true } }) → sendResponse(200 OK)`
- **Data / Schema Impact:**
  - Zero database schema changes. Uses existing `User` and `Customer` models in PostgreSQL.
- **Public API / Contract Impact:**
  - Endpoint: `GET /api/v1/customers/:id`
  - Success Response:
    ```json
    {
      "statusCode": 200,
      "success": true,
      "message": "Customer retrieved successfully",
      "data": {
        "id": "uuid",
        "name": "string",
        "email": "string",
        "emailVerified": true,
        "image": null,
        "role": "CUSTOMER",
        "status": "ACTIVE",
        "contactNumber": "string | null",
        "address": "string | null",
        "createdAt": "datetime",
        "updatedAt": "datetime"
      }
    }
    ```
- **Security & Authorization Considerations:**
  - `authGuard` verifies active session and injects server-verified user identity into `res.locals.user`.
  - `rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN)` ensures only privileged administrative roles can access customer profile by ID.
  - Soft-deleted users or users with non-customer roles are treated as non-existent (404 `USER_NOT_FOUND`) per `DEC-018`.
  - Defense-in-depth: customer records cannot leak sensitive fields (passwords, tokens, verification secrets).

---

## 5. Affected Files & Directives

| Action     | File Path                                                                           | Responsibility |
| :--------- | :---------------------------------------------------------------------------------- | :------------- |
| `[MODIFY]` | `docs/governance/tasks/phase-2/P2-T023-implement-authorized-customer-profile-retrieval.md` | JIT task plan and finalized implementation evidence |
| `[MODIFY]` | `src/app/modules/customer/customer.validation.ts`                                   | `getCustomerSchema` with UUID `:id` param validation |
| `[MODIFY]` | `src/app/modules/customer/customer.service.ts`                                      | `getCustomerById(customerId: string)` with `include: { customer: true }` |
| `[MODIFY]` | `src/app/modules/customer/customer.controller.ts`                                   | `getCustomerById` controller handler |
| `[MODIFY]` | `src/app/modules/customer/customer.routes.ts`                                       | Mount `GET /:id` with `authGuard`, `rbacGuard`, and `validateRequest` |
| `[MODIFY]` | `tests/unit/modules/customer/customer.validation.test.ts`                          | Param validation unit tests |
| `[MODIFY]` | `tests/unit/modules/customer/customer.service.test.ts`                             | Service layer profile retrieval unit tests |
| `[MODIFY]` | `tests/unit/modules/customer/customer.controller.test.ts`                          | Controller layer profile retrieval unit tests |
| `[MODIFY]` | `tests/unit/modules/customer/customer.routes.test.ts`                              | Route mounting and middleware configuration tests |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`                                       | Task status synchronization (`✅ Done`) |
| `[MODIFY]` | `docs/governance/MEMORY.md`                                                         | Current-state recording |

---

## 6. Step-by-Step Execution Plan

1. **Step 1: Read-Only Pre-Planning Inspection** (Completed)
   - Inspect PRD `FR-CUSTOMER-003`, ERD models, blockers (`P2-B001`, `P2-B008`), and existing customer module.
2. **Step 2: JIT Task Plan Creation & Human Review** (Completed)
   - Draft JIT task file and establish scope boundaries.
3. **Step 3: Planning Gate & Status Update** (Completed)
   - Confirmed phase status and approved execution.
4. **Step 4: Request Validation Implementation** (Completed)
   - Define `getCustomerSchema` validating UUID `:id` parameter and export inferred `GetCustomerParams`.
5. **Step 5: Customer Service Implementation** (Completed)
   - Implement `CustomerService.getCustomerById(customerId: string)` directly querying via `findUnique` with `include: { customer: true }`.
6. **Step 6: Customer Controller & Route Implementation** (Completed)
   - Implement `CustomerController.getCustomerById` and mount `GET /:id` with `authGuard`, `rbacGuard`, and `validateRequest`.
7. **Step 7: Automated Unit Test Suite Implementation** (Completed)
   - Add unit tests across validation, service, controller, and routes.
8. **Step 8: Verification & Quality Gates Execution** (Completed)
   - Execute `pnpm tsc --noEmit`, `pnpm lint`, and full test suite (`pnpm test`).
9. **Step 9: Code Review & Refinement** (Completed)
   - Refined service signature to single parameter (KISS/YAGNI), removed unnecessary verbose selects in favor of `include: { customer: true }`.
10. **Step 10: Human Approval & Governance Sync** (Completed)
    - Synchronized governance docs and task records.

---

## 7. Verification & Quality Gates

| Check                      | Required | Command or Method                               | Result                                                |
| :------------------------- | :------- | :---------------------------------------------- | :---------------------------------------------------- |
| Acceptance criteria        | `Yes`    | Inspection against FR-CUSTOMER-003 requirements | `Passed`                                              |
| Type check / build         | `Yes`    | `pnpm tsc --noEmit`                             | `Passed (0 errors)`                                   |
| Lint                       | `Yes`    | `pnpm lint`                                     | `Passed (0 warnings/errors)`                          |
| Tests                      | `Yes`    | `pnpm test`                                     | `Passed (40/40 test files, 574/574 tests passing)`    |
| Migration / data integrity | `No`     | Schema unchanged                                | `N/A`                                                 |
| Manual verification        | `No`     | Automated test suite covers all criteria        | `N/A`                                                 |

---

## 8. Assumptions & Blockers

- **Active Blockers:**
  - `P2-B001` (Public API paths): Resolved per `DEC-027` (`GET /api/v1/customers/:id`).
  - `P2-B008` (Order/Inquiry summaries): Resolved per `DEC-008`; order and inquiry models belong to future phases, profile returns customer business data without speculative mock orders.
- **Design Decisions:**
  - Administrative retrieval of customer profiles is restricted to `ADMIN` and `SUPER_ADMIN` via `rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN)`.
  - Self-service customer profile retrieval is managed centrally and symmetrically under `GET /api/v1/users/profile` (`UserService.getProfile`).
  - Soft-deleted users and non-customer IDs return 404 `USER_NOT_FOUND` to preserve privacy and anti-enumeration.

---

## 9. Plan Review

| Field       | Value                                |
| :---------- | :----------------------------------- |
| Outcome     | `Approved`                           |
| Reviewed by | `Human (Product/Architecture Owner)` |
| Reviewed on | `2026-09-24`                         |
| Notes       | `Approved and verified`              |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `src/app/modules/customer/customer.validation.ts`: Exported `getCustomerSchema` and `GetCustomerParams` validating UUID `:id`.
  - `src/app/modules/customer/customer.service.ts`: Implemented `getCustomerById(customerId: string)` querying via `prisma.user.findUnique({ where: { id: customerId }, include: { customer: true } })`, returning flattened DTO with accurate `updatedAt`.
  - `src/app/modules/customer/customer.controller.ts`: Implemented `getCustomerById` controller handler returning standard envelope via `sendResponse`.
  - `src/app/modules/customer/customer.routes.ts`: Mounted `GET /:id` protected by `authGuard`, `rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN)`, and `validateRequest(CustomerValidation.getCustomerSchema)`.
  - `tests/unit/modules/customer/customer.validation.test.ts`: Unit tests verifying UUID `:id` validation.
  - `tests/unit/modules/customer/customer.service.test.ts`: Unit tests verifying successful retrieval, 404 on missing/deleted/non-customer, and timestamp resolution.
  - `tests/unit/modules/customer/customer.controller.test.ts`: Unit tests verifying controller orchestration and response.
  - `tests/unit/modules/customer/customer.routes.test.ts`: Unit tests verifying route configuration, auth guard, rbac guard, and validation middleware.
- **Migration Created:** None (PostgreSQL schema unchanged).
- **Test / Verification Output:**
  - `pnpm tsc --noEmit`: 0 errors.
  - `pnpm lint`: 0 issues/warnings.
  - `pnpm test`: 40 test files, 574 tests passed (100% pass rate).
- **Deviations from Original Plan:**
  - Applied KISS and YAGNI by eliminating redundant single-property input interface (`GetCustomerProfileServiceInput`), passing `customerId: string` directly to the service.
  - Named schema `getCustomerSchema` and method `getCustomerById` aligning consistently with standard REST and repository conventions.
  - Delegated administrative role authorization directly to `rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN)` on the route, as self-service customer retrieval is handled uniformly under `/api/v1/users/profile`.
- **Remaining Concerns / Follow-ups:**
  - Next task in Phase 2 roadmap: `P2-T024` (Implement Customer profile and email updates).
