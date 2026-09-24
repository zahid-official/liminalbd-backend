# Task: P2-T023 - Implement Authorized Customer Profile Retrieval

> **Canonical Status:** `✅ Done`  
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-CUSTOMER-003`, `FR-RBAC-005` (`FR-RBAC-005.1`–`FR-RBAC-005.4`)  
> **ERD Reference:** `User` model, `Customer` model (`prisma/schema/auth.prisma`, `prisma/schema/profiles.prisma`)  
> **Dependencies:** `P2-T022` (✅ Reusable ownership authorization pattern), `P2-T010` (✅ Auth guard session context), `P2-T016` (✅ Audit logging boundary)  
> **Blockers:** `P2-B001` (Resolved per `DEC-027`), `P2-B008` (Resolved per `DEC-008`)  

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T023`
- **PRD / Requirement Reference:**
  - `FR-CUSTOMER-003.1`: `SUPER_ADMIN` and `ADMIN` can view a customer's permitted administrative profile.
  - `FR-CUSTOMER-003.2`: Customers can view their own profile.
  - `FR-CUSTOMER-003.3`: Customers cannot access another customer's profile (cross-customer access rejected with `HTTP 403 Forbidden`).
  - `FR-CUSTOMER-003.4`: Customer data access must enforce server-side role and ownership rules derived from authenticated session context.
  - `FR-RBAC-005.1`–`FR-RBAC-005.4`: Ownership verification, defense-in-depth authorization, and auditable unauthorized attempts.
- **ERD Reference:** `User` in `prisma/schema/auth.prisma`, `Customer` in `prisma/schema/profiles.prisma`.
- **Dependencies:** `P2-T022` (`AuthorizationService.authorizeOwnership`), `P2-T010` (`authGuard`), `P2-T016` (`AuditService`).

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

- Implement request validation schema `getCustomerProfileSchema` in `src/app/modules/customer/customer.validation.ts` validating UUID route parameter `:id`.
- Define type contracts in `src/app/modules/customer/customer.interface.ts`:
  - `GetCustomerProfileServiceInput`: Service input contract containing `actorId`, `actorRole`, and `targetId`.
- Implement `CustomerService.getCustomerProfile` in `src/app/modules/customer/customer.service.ts`:
  - Query target user by `:id` with `role: UserRole.CUSTOMER` and `deletedAt: null`, including relation `customer`.
  - If target customer does not exist, throw `AppError(status.NOT_FOUND, PUBLIC_ERROR_CODES.USER_NOT_FOUND, "Customer not found")`.
  - Enforce ownership and administrative access authorization via `AuthorizationService.authorizeOwnership`:
    - `actorId: currentUser.id`
    - `actorRole: currentUser.role`
    - `resourceOwnerId: targetCustomer.id`
    - `resourceType: AuditEntityType.CUSTOMER`
    - `resourceId: targetCustomer.id`
    - `action: "GET_CUSTOMER_PROFILE"`
    - `policy: { allowAdmin: true, allowSuperAdmin: true }`
  - Return sanitized profile representation without exposing sensitive attributes (passwords, tokens, internal flags).
- Implement `CustomerController.getCustomerProfile` in `src/app/modules/customer/customer.controller.ts` wrapped with `catchAsync` and returning standardized JSON envelope via `sendResponse`.
- Mount `GET /api/v1/customers/:id` in `src/app/modules/customer/customer.routes.ts` protected by `authGuard` and `validateRequest(CustomerValidation.getCustomerProfileSchema)`.
- Implement automated Vitest unit tests in `tests/unit/modules/customer/`:
  - Validate param schema (valid UUID passes, invalid UUID or missing param fails with 400).
  - Verify Customer accessing own profile succeeds with 200 OK and expected sanitized fields.
  - Verify Customer attempting cross-customer access is rejected with 403 `FORBIDDEN_ACCESS` and triggers security audit log.
  - Verify `ADMIN` and `SUPER_ADMIN` can retrieve customer profile under authorized policy.
  - Verify non-existent or soft-deleted customer returns 404 `USER_NOT_FOUND`.
  - Verify route middleware and controller orchestration.

### Out of Scope

- Customer profile update endpoints (`P2-T024`).
- Administrative customer listing with pagination and filters (`P2-T025`).
- Customer account lifecycle management (suspend, deactivate, soft-delete) (`P2-T026`).
- Future business modules (Orders, Inquiries) deferred per `DEC-008` / `P2-B008`.

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Customer retrieves their own permitted profile data | Step 5, Step 7 | Unit tests in `customer.service.test.ts` & `customer.controller.test.ts` |
| `ADMIN` and `SUPER_ADMIN` access customer profile under approved policy | Step 5, Step 7 | Unit tests asserting admin authorization via `AuthorizationService` |
| Cross-customer access rejected with HTTP 403 Forbidden | Step 5, Step 7 | Unit tests asserting 403 `FORBIDDEN_ACCESS` & `AuditService.record` call |
| Non-existent or soft-deleted customer returns HTTP 404 | Step 5, Step 7 | Unit tests asserting 404 `USER_NOT_FOUND` |
| Sanitize response fields according to contract | Step 4, Step 5 | Unit tests verifying returned JSON fields |
| Parameter validation enforces valid UUID `:id` | Step 4, Step 7 | Unit tests in `customer.validation.test.ts` |

---

## 3. Verified Current Codebase State

- **Current Behavior / Gaps:**
  - `src/app/modules/customer/` contains registration logic only (`registerCustomer`).
  - No profile retrieval method exists in `CustomerService` or `CustomerController`.
  - `CustomerRoutes` only mounts `POST /register`.
  - Reusable ownership authorization service `AuthorizationService.authorizeOwnership` is established and tested (`P2-T022`).
- **Existing Code Patterns to Follow:**
  - Route: `router.get("/:id", authGuard, validateRequest(schema), controller)`.
  - Controller: Extract `res.locals.validated?.params.id` and `res.locals.user`, pass to service, respond via `sendResponse`.
  - Service: Perform lookup, invoke `AuthorizationService.authorizeOwnership`, return flat/symmetrical sanitized object.
- **Related Existing Files:**
  - `src/app/modules/customer/customer.routes.ts`
  - `src/app/modules/customer/customer.controller.ts`
  - `src/app/modules/customer/customer.service.ts`
  - `src/app/modules/customer/customer.validation.ts`
  - `src/app/shared/authorization/authorization.service.ts`
  - `src/app/middleware/authGuard.ts`
  - `src/app/errors/errorCodes.ts`

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  `Client → GET /api/v1/customers/:id → authGuard → validateRequest(getCustomerProfileSchema) → CustomerController.getCustomerProfile → CustomerService.getCustomerProfile → prisma.user.findFirst & AuthorizationService.authorizeOwnership → sendResponse(200 OK)`
- **Data / Schema Impact:**
  - Zero database schema changes. Uses existing `User` and `Customer` models in PostgreSQL.
- **Public API / Contract Impact:**
  - New Endpoint: `GET /api/v1/customers/:id`
  - Success Response:
    ```json
    {
      "success": true,
      "message": "Customer profile retrieved successfully",
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
  - `AuthorizationService.authorizeOwnership` validates that actor owns resource or possesses administrative privilege (`SUPER_ADMIN` or `ADMIN`).
  - Cross-customer access records `AuditAction.UNAUTHORIZED_ATTEMPT` via `AuditService.record` before throwing 403 `FORBIDDEN_ACCESS`.
  - Soft-deleted users are treated as non-existent (404 `USER_NOT_FOUND`) per `DEC-018`.

---

## 5. Affected Files & Directives

| Action     | File Path                                                                           | Responsibility |
| :--------- | :---------------------------------------------------------------------------------- | :------------- |
| `[NEW]`    | `docs/governance/tasks/phase-2/P2-T023-implement-authorized-customer-profile-retrieval.md` | JIT task plan and implementation evidence |
| `[NEW]`    | `src/app/modules/customer/customer.interface.ts`                                    | Interface contracts for customer profile retrieval |
| `[MODIFY]` | `src/app/modules/customer/customer.validation.ts`                                   | Add `getCustomerProfileSchema` UUID param validation |
| `[MODIFY]` | `src/app/modules/customer/customer.service.ts`                                      | Implement `getCustomerProfile` with ownership check |
| `[MODIFY]` | `src/app/modules/customer/customer.controller.ts`                                   | Implement `getCustomerProfile` handler |
| `[MODIFY]` | `src/app/modules/customer/customer.routes.ts`                                       | Mount `GET /:id` route handler |
| `[MODIFY]` | `tests/unit/modules/customer/customer.validation.test.ts`                          | Add param validation tests |
| `[MODIFY]` | `tests/unit/modules/customer/customer.service.test.ts`                             | Add service layer profile retrieval unit tests |
| `[MODIFY]` | `tests/unit/modules/customer/customer.controller.test.ts`                          | Add controller profile retrieval unit tests |
| `[MODIFY]` | `tests/unit/modules/customer/customer.routes.test.ts`                              | Add route mounting unit tests |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`                                       | Update task status from `🔲` to `🔄` then `🕵️` / `✅` |
| `[MODIFY]` | `docs/governance/MEMORY.md`                                                         | Record completion of P2-T023 |

---

## 6. Step-by-Step Execution Plan

1. **Step 1: Read-Only Pre-Planning Inspection** (Completed)
   - Inspect PRD `FR-CUSTOMER-003`, ERD models, blockers (`P2-B001`, `P2-B008`), and existing customer module.
2. **Step 2: JIT Task Plan Creation & Human Review** (Current Step)
   - Draft JIT task file `P2-T023-implement-authorized-customer-profile-retrieval.md` and present to user for approval.
3. **Step 3: Planning Gate & Status Update**
   - Upon explicit approval, update `phase-2-auth-rbac.md` and task file status to `🔄 In progress`.
4. **Step 4: Interface & Request Validation Implementation** (Completed)
   - Create `src/app/modules/customer/customer.interface.ts` with `GetCustomerProfileServiceInput`.
   - Update `src/app/modules/customer/customer.validation.ts` with `getCustomerProfileSchema`.
5. **Step 5: Customer Service Implementation** (Completed)
   - Implement `CustomerService.getCustomerProfile` enforcing ownership check and data projection.
6. **Step 6: Customer Controller & Route Implementation** (Completed)
   - Implement `CustomerController.getCustomerProfile`.
   - Mount `GET /:id` in `CustomerRoutes` with `authGuard` and validation.
7. **Step 7: Automated Unit Test Suite Implementation**
   - Add comprehensive tests in `customer.validation.test.ts`, `customer.service.test.ts`, `customer.controller.test.ts`, and `customer.routes.test.ts`.
8. **Step 8: Verification & Quality Gates Execution**
   - Run `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test:coverage tests/unit/modules/customer`, and full suite `pnpm test`.
9. **Step 9: Review & Closure Preparation**
   - Update JIT task file evidence, mark `🕵️ Awaiting human review`, and present to user for final review.
10. **Step 10: Human Approval & Governance Sync**
    - Obtain user approval, mark `✅ Done`, update `MEMORY.md`, `phase-2-auth-rbac.md`, and propose git commit.

---

## 7. Verification & Quality Gates

| Check                      | Required | Command or Method                               | Result                                                         |
| :------------------------- | :------- | :---------------------------------------------- | :------------------------------------------------------------- |
| Acceptance criteria        | `Yes`    | Inspection against FR-CUSTOMER-003 requirements | `Passed`                                                       |
| Type check / build         | `Yes`    | `pnpm tsc --noEmit`                             | `Passed (0 errors)`                                            |
| Lint                       | `Yes`    | `pnpm lint`                                     | `Passed (0 warnings/errors)`                                   |
| Tests                      | `Yes`    | `pnpm test tests/unit/modules/customer`         | `Passed (31/31 passed in customer module, 539/539 full suite)` |
| Migration / data integrity | `No`     | Schema unchanged                                | `N/A`                                                          |
| Manual verification        | `No`     | Automated test suite covers all criteria        | `N/A`                                                          |

---

## 8. Assumptions & Blockers

- **Active Blockers:**
  - `P2-B001` (Public API paths): Resolved per `DEC-027` (`GET /api/v1/customers/:id`).
  - `P2-B008` (Order/Inquiry summaries): Resolved per `DEC-008`; order and inquiry models belong to future phases, profile returns customer business data without speculative mock orders.
- **Design Assumptions Awaiting Approval:**
  - Both `ADMIN` and `SUPER_ADMIN` are permitted to view customer profiles as defined in `FR-CUSTOMER-003.1` (`policy: { allowAdmin: true, allowSuperAdmin: true }`).
  - Target customer lookup checks `role: UserRole.CUSTOMER` and `deletedAt: null`. Attempting to retrieve a non-customer user ID or soft-deleted customer returns 404 `USER_NOT_FOUND`.

---

## 9. Plan Review

| Field       | Value                                |
| :---------- | :----------------------------------- |
| Outcome     | `Approved`                           |
| Reviewed by | `Human (Product/Architecture Owner)` |
| Reviewed on | `2026-09-24`                         |
| Notes       | `Approved to proceed with implementation` |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `src/app/modules/customer/customer.interface.ts`: Defined `GetCustomerProfileServiceInput` input contract.
  - `src/app/modules/customer/customer.validation.ts`: Added `getCustomerProfileSchema` with piped trimmed UUID param validation.
  - `src/app/modules/customer/customer.service.ts`: Implemented `getCustomerProfile` with ownership check (`AuthorizationService.authorizeOwnership`), flat DTO projection, and defensive `updatedAt` calculation.
  - `src/app/modules/customer/customer.controller.ts`: Implemented `getCustomerProfile` handler with context passing and standardized JSON response.
  - `src/app/modules/customer/customer.routes.ts`: Mounted `GET /:id` with `authGuard`, `validateRequest`, and `CustomerController.getCustomerProfile`.
  - `tests/unit/modules/customer/customer.validation.test.ts`: Added 5 unit tests for `getCustomerProfileSchema`.
  - `tests/unit/modules/customer/customer.service.test.ts`: Added 7 unit tests for `getCustomerProfile` covering ownership, admin access, 403 breach, 404 not found, timestamp comparison, and null relation.
  - `tests/unit/modules/customer/customer.controller.test.ts`: Added 2 unit tests for `getCustomerProfile` handling 200 OK flow and error propagation.
  - `tests/unit/modules/customer/customer.routes.test.ts`: Added unit test verifying `GET /:id` layer configuration and method exclusivity.
- **Migration Created:** None (PostgreSQL schema unchanged).
- **Test / Verification Output:**
  - `pnpm tsc --noEmit`: 0 errors.
  - `pnpm lint`: 0 issues/warnings.
  - `pnpm test tests/unit/modules/customer`: 4 test files, 31 tests passed.
  - `pnpm test:coverage tests/unit/modules/customer`: 100% Stmts / Branch / Funcs / Lines across all executable files in `src/app/modules/customer`.
  - `pnpm test`: 37 test files, 539 tests passed (0 failures).
- **Deviations from Original Plan:**
  - Omitted explicit `CustomerProfileResponse` type from `customer.interface.ts` in strict adherence to KISS & YAGNI and consistency with `admin.interface.ts` (TypeScript infers the return type accurately from service literal).
  - Flattened DTO projection returned from service instead of leaking nested DB relation structure, preventing frontend stutter (`customer.customer.contactNumber`).
  - Added clean ternary `updatedAt` resolution comparing `targetUser.customer.updatedAt` vs `targetUser.updatedAt` for the true latest modification timestamp.
- **Remaining Concerns / Follow-ups:**
  - Next task `P2-T024` will implement customer profile update (`PATCH /api/v1/customers/:id`).

