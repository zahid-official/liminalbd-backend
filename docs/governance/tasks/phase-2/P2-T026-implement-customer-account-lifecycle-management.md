# Task: P2-T026 - Implement Customer Account Lifecycle Management

> **Canonical Status:** `🔄 In progress` (tracked authoritatively in parent phase file)  
> **Planning Gate:** Approved → `🔄 In Progress`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T026`
- **PRD / Requirement Reference:**
  - `FR-CUSTOMER-004.1`: `SUPER_ADMIN` and `ADMIN` can suspend a customer account.
  - `FR-CUSTOMER-004.2`: `SUPER_ADMIN` and `ADMIN` can deactivate a customer account.
  - `FR-CUSTOMER-004.3`: `SUPER_ADMIN` and `ADMIN` can soft-delete a customer account; physical deletion prohibited; business records preserved.
  - `FR-CUSTOMER-004.4`: Customer sessions must be revoked when an account is suspended, deactivated, or soft-deleted.
  - `FR-CUSTOMER-004.5`: Customer account status changes must be auditable (`actorId`, `targetId`, `previousStatus`, `newStatus`, `action`, `timestamp`, `AuditEntityType.CUSTOMER`).
  - `FR-CUSTOMER-004.6`: Customers cannot modify their own account status (HTTP 403 Forbidden).
  - `FR-RBAC-006`: Account lifecycle and status restrictions.
- **ERD Reference:** `User` in `prisma/schema/auth.prisma`, `Customer` in `prisma/schema/profiles.prisma`, `Session` in `prisma/schema/auth.prisma`, `AuditLog` in `prisma/schema/audit.prisma`.
- **Dependencies:** `P2-T016` (Audit logging), `P2-T017` (Account status enforcement & `AccountService`), `P2-T022` (Ownership authorization pattern).
- **Blockers:** `P2-B001` (Resolved per `DEC-027` - pluralized REST paths).

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

- Implement request validation schemas in `src/app/modules/customer/customer.validation.ts`:
  - `updateCustomerStatusSchema`:
    - `params`: `z.object({ id: idSchema })`
    - `body`: `z.object({ status: userStatusSchema, reason: z.string().trim().max(500).optional() })`
  - `deleteCustomerSchema`:
    - `params`: `z.object({ id: idSchema })`
    - `body`: `z.object({ reason: z.string().trim().max(500).optional() }).optional()`
  - Export inferred types: `UpdateCustomerStatusParams`, `UpdateCustomerStatusBody`, `DeleteCustomerParams`, `DeleteCustomerBody`.
- Define type contracts in `src/app/modules/customer/customer.interface.ts`:
  - `UpdateCustomerStatusInput`: `{ actorId: string; actorRole: UserRole; customerId: string; payload: UpdateCustomerStatusBody; }`
  - `DeleteCustomerInput`: `{ actorId: string; actorRole: UserRole; customerId: string; payload?: DeleteCustomerBody; }`
- Implement service layer operations in `src/app/modules/customer/customer.service.ts`:
  - `CustomerService.updateCustomerStatus`:
    - Defense-in-depth: assert `actorRole === UserRole.ADMIN || actorRole === UserRole.SUPER_ADMIN`. If violated, record `AuditAction.UNAUTHORIZED_ATTEMPT` with `entityType: AuditEntityType.CUSTOMER` and throw HTTP 403 `FORBIDDEN_ROLE_ACCESS`.
    - Validate target account exists, has `role === UserRole.CUSTOMER`, and `deletedAt === null`. Throw 404 `USER_NOT_FOUND` ("Customer not found") if not found or non-customer to prevent admin account manipulation via customer routes.
    - Prevent redundant status transition: if `targetUser.status === payload.status`, throw HTTP 400 `VALIDATION_ERROR` (`Customer account is already ${payload.status.toLowerCase()}`).
    - Execute atomic update via `prisma.$transaction`: update `User.status`.
    - Invalidate all active sessions in PostgreSQL if `status === SUSPENDED || status === DEACTIVATED`: `tx.session.deleteMany({ where: { userId: customerId } })`.
    - Record structured audit trail atomically within transaction with `entityType: AuditEntityType.CUSTOMER`, `entityId: customerId`, `actorId`, `action: SUSPEND | DEACTIVATE | REACTIVATE`, `previousValue: { status: targetUser.status }`, `newValue: { status: payload.status }`, and optional `reason` in metadata.
    - Return flattened customer DTO per `DEC-028` with dynamic latest `updatedAt`.
  - `CustomerService.deleteCustomer`:
    - Defense-in-depth: assert `actorRole === UserRole.ADMIN || actorRole === UserRole.SUPER_ADMIN`. If violated, record `AuditAction.UNAUTHORIZED_ATTEMPT` with `entityType: AuditEntityType.CUSTOMER` and throw HTTP 403 `FORBIDDEN_ROLE_ACCESS`.
    - Validate target account exists, has `role === UserRole.CUSTOMER`, and `deletedAt === null`. Throw 404 `USER_NOT_FOUND` ("Customer not found") if not found or non-customer.
    - Execute atomic soft-deletion via `prisma.$transaction`: set `User.deletedAt = new Date()`.
    - Invalidate all active sessions in PostgreSQL: `tx.session.deleteMany({ where: { userId: customerId } })`.
    - Record structured audit trail atomically within transaction with `action: AuditAction.SOFT_DELETE`, `entityType: AuditEntityType.CUSTOMER`, `entityId: customerId`, `actorId`, `previousValue: { deletedAt: null }`, `newValue: { deletedAt: updatedUser.deletedAt }`, and optional `reason` in metadata.
    - Return confirmation: `{ id: customerId, message: "Customer account deleted successfully" }`.
- Implement controller handlers in `src/app/modules/customer/customer.controller.ts`:
  - `updateCustomerStatus`: extract `res.locals.user`, `params.id`, `body`, call service, send 200 OK envelope via `sendResponse`.
  - `deleteCustomer`: extract `res.locals.user`, `params.id`, `body`, call service, send 200 OK envelope via `sendResponse`.
- Mount routes in `src/app/modules/customer/customer.routes.ts`:
  - `PATCH /:id/status`: `authGuard`, `rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN)`, `validateRequest(CustomerValidation.updateCustomerStatusSchema)`, `CustomerController.updateCustomerStatus`.
  - `DELETE /:id`: `authGuard`, `rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN)`, `validateRequest(CustomerValidation.deleteCustomerSchema)`, `CustomerController.deleteCustomer`.
- Implement comprehensive automated unit tests in `tests/unit/modules/customer/`:
  - `customer.validation.test.ts`: test `updateCustomerStatusSchema` and `deleteCustomerSchema`.
  - `customer.service.test.ts`: test status mutations, defense-in-depth, session invalidation, audit logging, redundant status checks, non-customer account 404 isolation, and soft deletion.
  - `customer.controller.test.ts`: test `updateCustomerStatus` and `deleteCustomer` response orchestration and error forwarding.
  - `customer.routes.test.ts`: test route definitions and middleware stacks for `PATCH /:id/status` and `DELETE /:id`.

### Out of Scope

- Hard physical database deletion of customer records (strictly prohibited per `FR-CUSTOMER-004.3`).
- Customer self-status modification or self-deletion (must be rejected with HTTP 403 Forbidden).
- Admin role or email modifications (already handled under `/admins` and `/users`).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| `SUPER_ADMIN` and `ADMIN` can suspend, deactivate, or reactivate a Customer account | Step 6, Step 7, Step 8 | Unit tests in `customer.service.test.ts` & `customer.routes.test.ts` |
| `SUPER_ADMIN` and `ADMIN` can soft-delete a Customer account | Step 6, Step 7, Step 8 | Unit tests in `customer.service.test.ts` asserting `deletedAt !== null` |
| Active sessions revoked on suspension, deactivation, or soft deletion | Step 6, Step 8 | Unit tests asserting `tx.session.deleteMany` called |
| Structured audit log with `AuditEntityType.CUSTOMER` recorded atomically | Step 6, Step 8 | Unit tests asserting `AuditService.record` called with before/after state |
| Customers rejected from modifying account status with HTTP 403 | Step 6, Step 7, Step 8 | Unit tests asserting 403 `FORBIDDEN_ROLE_ACCESS` via `rbacGuard` and service guard |
| Redundant status transition rejected with HTTP 400 | Step 6, Step 8 | Unit tests asserting 400 `VALIDATION_ERROR` when status matches |
| Non-customer accounts protected from customer lifecycle operations | Step 6, Step 8 | Unit tests asserting 404 `USER_NOT_FOUND` when target role !== `CUSTOMER` |

---

## 3. Verified Current Codebase State

- **Current Behavior / Gaps:**
  - `src/app/modules/customer/` currently supports registration (`POST /register`), listing (`GET /`), and profile retrieval (`GET /:id`).
  - No administrative status update (`PATCH /:id/status`) or soft-delete (`DELETE /:id`) endpoints exist for customers.
  - `src/app/shared/account/account.service.ts` provides baseline account status handling, but customer-specific endpoints require customer role verification (`role === CUSTOMER`), `AuditEntityType.CUSTOMER` tagging, and `DEC-028` DTO projection.
- **Existing Code Patterns to Follow:**
  - Route: `router.patch("/:id/status", authGuard, rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN), validateRequest(schema), controller)`.
  - Route: `router.delete("/:id", authGuard, rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN), validateRequest(schema), controller)`.
  - Controller: Extract `res.locals.user` (`AuthUser`), `params`, and `body`, invoke service, respond via `sendResponse(200 OK)`.
  - Service: Verify actor role, verify target is customer and not deleted, execute atomic transaction with `session.deleteMany` and `AuditService.record`, return flattened DTO or confirmation.
- **Related Existing Files:**
  - `src/app/modules/customer/customer.routes.ts`
  - `src/app/modules/customer/customer.controller.ts`
  - `src/app/modules/customer/customer.service.ts`
  - `src/app/modules/customer/customer.validation.ts`
  - `src/app/modules/customer/customer.interface.ts`
  - `src/app/shared/account/account.service.ts`
  - `src/app/modules/admin/admin.service.ts` (reference implementation)

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  - Status Update: `Client → PATCH /api/v1/customers/:id/status → authGuard → rbacGuard(ADMIN, SUPER_ADMIN) → validateRequest(updateCustomerStatusSchema) → CustomerController.updateCustomerStatus → CustomerService.updateCustomerStatus → prisma.$transaction (tx.user.update + tx.session.deleteMany + AuditService.record) → sendResponse(200 OK)`
  - Soft Delete: `Client → DELETE /api/v1/customers/:id → authGuard → rbacGuard(ADMIN, SUPER_ADMIN) → validateRequest(deleteCustomerSchema) → CustomerController.deleteCustomer → CustomerService.deleteCustomer → prisma.$transaction (tx.user.update(deletedAt) + tx.session.deleteMany + AuditService.record) → sendResponse(200 OK)`
- **Data / Schema Impact:**
  - Zero database schema migrations required. Uses existing PostgreSQL `User`, `Customer`, `Session`, and `AuditLog` tables.
- **Public API / Contract Impact:**
  - Endpoint 1: `PATCH /api/v1/customers/:id/status`
    - Request Body: `{ "status": "SUSPENDED" | "DEACTIVATED" | "ACTIVE", "reason"?: "string" }`
    - Success Response (200 OK):
      ```json
      {
        "statusCode": 200,
        "success": true,
        "message": "Customer status updated successfully",
        "data": {
          "id": "uuid",
          "name": "string",
          "email": "string",
          "emailVerified": true,
          "image": null,
          "role": "CUSTOMER",
          "status": "SUSPENDED",
          "contactNumber": "string | null",
          "address": "string | null",
          "createdAt": "datetime",
          "updatedAt": "datetime"
        }
      }
      ```
  - Endpoint 2: `DELETE /api/v1/customers/:id`
    - Request Body (optional): `{ "reason"?: "string" }`
    - Success Response (200 OK):
      ```json
      {
        "statusCode": 200,
        "success": true,
        "message": "Customer account deleted successfully",
        "data": {
          "id": "uuid",
          "deletedAt": "datetime"
        }
      }
      ```
- **Security & Authorization Considerations:**
  - `authGuard` authenticates request and attaches `res.locals.user`.
  - `rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN)` gates route access; rejects `CUSTOMER` role with 403 Forbidden.
  - Defense-in-depth: `CustomerService` validates `actorRole` and records `AuditAction.UNAUTHORIZED_ATTEMPT` on violations.
  - Role isolation: target account must have `role === UserRole.CUSTOMER`. Admins cannot manipulate other admin accounts via customer endpoints.
  - Session revocation: all active user sessions terminated in PostgreSQL immediately upon restriction or deletion.

---

## 5. Affected Files & Directives

| Action     | File Path                                                 | Responsibility |
| :--------- | :-------------------------------------------------------- | :------------- |
| `[MODIFY]` | `src/app/modules/customer/customer.validation.ts`         | Define `updateCustomerStatusSchema` and `deleteCustomerSchema` |
| `[MODIFY]` | `src/app/modules/customer/customer.interface.ts`          | Define `UpdateCustomerStatusInput` and `DeleteCustomerInput` |
| `[MODIFY]` | `src/app/modules/customer/customer.service.ts`            | Implement `updateCustomerStatus` and `deleteCustomer` methods |
| `[MODIFY]` | `src/app/modules/customer/customer.controller.ts`         | Implement `updateCustomerStatus` and `deleteCustomer` handlers |
| `[MODIFY]` | `src/app/modules/customer/customer.routes.ts`             | Mount `PATCH /:id/status` and `DELETE /:id` with guards |
| `[MODIFY]` | `tests/unit/modules/customer/customer.validation.test.ts` | Add validation tests for status update and delete schemas |
| `[MODIFY]` | `tests/unit/modules/customer/customer.service.test.ts`    | Add unit tests for lifecycle mutations and edge cases |
| `[MODIFY]` | `tests/unit/modules/customer/customer.controller.test.ts` | Add controller tests for status update and delete |
| `[MODIFY]` | `tests/unit/modules/customer/customer.routes.test.ts`     | Add route tests for `PATCH /:id/status` and `DELETE /:id` |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`             | Update P2-T026 status from `🔲` to `🔄` |

---

## 6. Step-by-Step Execution Plan

1. **Step 1: Read-Only Pre-Planning Inspection** (Completed)
   - Inspect PRD `FR-CUSTOMER-004`, `FR-RBAC-006`, and `AccountService` assets.
2. **Step 2: JIT Task Plan Creation & Human Review** (Current Step)
   - Draft persistent JIT task plan file and present to reviewer.
3. **Step 3: Planning Gate & Status Update**
   - Obtain explicit human approval, mark `phase-2-auth-rbac.md` and task file status `🔄 In progress`.
4. **Step 4: Request Validation Schemas Implementation**
   - Update `src/app/modules/customer/customer.validation.ts` with `updateCustomerStatusSchema` and `deleteCustomerSchema`.
5. **Step 5: Interface Contracts Definition**
   - Update `src/app/modules/customer/customer.interface.ts` with `UpdateCustomerStatusInput` and `DeleteCustomerInput`.
6. **Step 6: Service Layer Implementation (`CustomerService`)**
   - Implement `updateCustomerStatus` and `deleteCustomer` in `src/app/modules/customer/customer.service.ts`.
7. **Step 7: Controller & Route Implementation**
   - Implement handlers in `src/app/modules/customer/customer.controller.ts`.
   - Mount routes in `src/app/modules/customer/customer.routes.ts`.
8. **Step 8: Automated Unit Test Suite Implementation**
   - Add unit tests across validation, service, controller, and routes test files.
9. **Step 9: Quality Gates Execution & Verification**
   - Run `pnpm tsc --noEmit`, `pnpm lint`, and full test suite (`pnpm test`).
10. **Step 10: Task Evidence Recording & Review Readiness**
    - Populate implementation evidence, mark `🕵️ Awaiting human review`, and submit for review.
11. **Step 11: Human Approval & Governance Closure**
    - Obtain user approval, mark `✅ Done`, update `MEMORY.md`, `phase-2-auth-rbac.md`, and `06-PHASE-ROADMAP.md`.

---

## 7. Verification & Quality Gates

| Check                      | Required | Command or Method                               | Result    |
| :------------------------- | :------- | :---------------------------------------------- | :-------- |
| Acceptance criteria        | `Yes`    | Inspection against FR-CUSTOMER-004 requirements | `NOT RUN` |
| Type check / build         | `Yes`    | `pnpm tsc --noEmit`                             | `NOT RUN` |
| Lint                       | `Yes`    | `pnpm lint`                                     | `NOT RUN` |
| Tests                      | `Yes`    | `pnpm test tests/unit/modules/customer`         | `NOT RUN` |
| Migration / data integrity | `No`     | Schema unchanged                                | `N/A`     |
| Manual verification        | `No`     | Automated test suite covers all criteria        | `N/A`     |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None. `P2-B001` resolved per `DEC-027`.
- **Design Decisions:**
  - Status updates are routed to `PATCH /api/v1/customers/:id/status` with `{ status: UserStatus, reason?: string }` to explicitly declare sub-resource lifecycle intent.
  - Soft deletion is routed to `DELETE /api/v1/customers/:id` with optional `{ reason?: string }`.
  - Non-customer accounts are guarded from customer lifecycle operations by returning 404 `USER_NOT_FOUND`.
  - Redundant status transitions return 400 `VALIDATION_ERROR`.

---

## 9. Plan Review

| Field       | Value                                    |
| :---------- | :--------------------------------------- |
| Outcome     | `Approved`                               |
| Reviewed by | `Human Reviewer`                         |
| Reviewed on | `2026-09-27`                             |
| Notes       | `JIT plan approved for implementation`   |

---

## 10. Implementation Evidence

- **Changed Files:**
- **Migration Created:** None.
- **Test / Verification Output:**
- **Deviations from Original Plan:**
- **Remaining Concerns / Follow-ups:**
