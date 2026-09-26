# Task: P2-T025 - Implement the Authorized Customer-List Operation

> **Canonical Status:** `🔄 In progress` (tracked authoritatively in parent phase file)  
> **Planning Gate:** Approved → `🔄 In Progress`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T025`
- **PRD / Requirement Reference:**
  - `FR-CUSTOMER-002.1`: `SUPER_ADMIN` and `ADMIN` can retrieve the customer list; `CUSTOMER` access rejected with HTTP 403 Forbidden (`PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS`).
  - `FR-CUSTOMER-002.2`: Customer list supports standard query capabilities (pagination, name/email search, sorting, status filter, creation date range filtering).
  - `FR-CUSTOMER-002.3`: Customer list includes only accounts with the `CUSTOMER` role (`ADMIN` and `SUPER_ADMIN` excluded).
- **ERD Reference:** `User` in `prisma/schema/auth.prisma`, `Customer` in `prisma/schema/profiles.prisma`.
- **Dependencies:** `P2-T021` (admin-list query pattern with `buildPrismaQuery`), `P2-T022` (ownership & authorization infrastructure).
- **Blockers:** `P2-B001` (Resolved per `DEC-027` - pluralized REST path `GET /api/v1/customers`).

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

- Define constants in `src/app/modules/customer/customer.constant.ts`:
  - `CUSTOMER_SORT_FIELDS` (`["createdAt", "updatedAt", "name", "email", "status"] as const`).
  - `CUSTOMER_SEARCHABLE_FIELDS` (`["name", "email"] as const`).
- Implement request query validation schema `getCustomersQuerySchema` in `src/app/modules/customer/customer.validation.ts`:
  - Extends `paginationQuerySchema` (`page`, `limit`, `sortOrder`, `searchTerm`).
  - `sortBy`: enum of `CUSTOMER_SORT_FIELDS`, default `"createdAt"`.
  - `status`: optional `userStatusSchema`.
  - `startDate`: optional coerced ISO date string via `z.coerce.date()`.
  - `endDate`: optional coerced ISO date string via `z.coerce.date()`.
  - Export inferred type `GetCustomersQuery`.
- Define type contracts in `src/app/modules/customer/customer.interface.ts`:
  - `GetCustomersInput`: `{ actorId: string; actorRole: UserRole; query: GetCustomersQuery; }`.
- Implement `CustomerService.getCustomers` in `src/app/modules/customer/customer.service.ts`:
  - Service-level defense-in-depth: assert `actorRole === UserRole.ADMIN || actorRole === UserRole.SUPER_ADMIN`. If violated, record `AuditAction.UNAUTHORIZED_ATTEMPT` via `AuditService.record` and throw `AppError(status.FORBIDDEN, PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS, "Only administrators can list Customer accounts")`.
  - Utilize `buildPrismaQuery` for `skip`, `take`, `orderBy`, `searchFilter`, `page`, and `limit`.
  - Construct query filter `where: { role: UserRole.CUSTOMER, deletedAt: null, ...searchFilter }`.
  - Apply `where.status = query.status` when `query.status` is provided.
  - Apply creation date range filtering `where.createdAt = { gte: query.startDate, lte: query.endDate }` when dates are supplied.
  - Execute concurrent query using `Promise.all([prisma.user.findMany(...), prisma.user.count(...)])` with `include: { customer: true }`.
  - Format response array into flattened DTO with dynamic latest-timestamp resolution per `DEC-028`:
    `{ id, name, email, emailVerified, image, role, status, contactNumber, address, createdAt, updatedAt }`.
  - Return `{ data: formattedCustomers, meta: buildPaginationMeta(page, limit, total) }`.
- Implement `CustomerController.getCustomers` in `src/app/modules/customer/customer.controller.ts`:
  - Extract `res.locals.user` (`AuthUser`) and `res.locals.validated?.query as GetCustomersQuery`.
  - Invoke `CustomerService.getCustomers`.
  - Return standard envelope via `sendResponse` (`statusCode: status.OK`, `message: "Customers retrieved successfully"`, `data: result.data`, `meta: result.meta`).
- Mount `GET /api/v1/customers` in `src/app/modules/customer/customer.routes.ts`:
  - Protected by `authGuard`, `rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN)`, and `validateRequest(CustomerValidation.getCustomersQuerySchema)`.
- Implement comprehensive Vitest unit tests in `tests/unit/modules/customer/`:
  - `customer.validation.test.ts`: test query schema pagination defaults, sort fields, status, and date range filters.
  - `customer.service.test.ts`: test role authorization, defense-in-depth security audit log on unauthorized role, query filter building, pagination meta, and flattened DTO mapping.
  - `customer.controller.test.ts`: test 200 OK orchestration with data and meta, and error propagation via `catchAsync`.
  - `customer.routes.test.ts`: verify `GET /` route stack, auth guard, rbac guard, and validation middleware.

### Out of Scope

- Customer profile update endpoints (completed in `P2-T024`).
- Customer account lifecycle mutations (`P2-T026`).
- Future business entities (Orders, Inquiries) deferred per `DEC-008` / `P2-B008`.

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| `SUPER_ADMIN` and `ADMIN` permitted to retrieve customer list | Step 6, Step 7, Step 8 | Unit tests in `customer.service.test.ts` & `customer.routes.test.ts` |
| `CUSTOMER` role rejected with HTTP 403 Forbidden | Step 6, Step 7, Step 8 | Unit tests asserting 403 `FORBIDDEN_ROLE_ACCESS` via `rbacGuard` & service check |
| Query options supported (pagination, search, sort, status, date range) | Step 4, Step 6, Step 8 | Unit tests in `customer.validation.test.ts` & `customer.service.test.ts` |
| Only `role: CUSTOMER` included; soft-deleted accounts excluded | Step 6, Step 8 | Unit tests asserting `where` query clause in `customer.service.test.ts` |
| Standardized pagination metadata and flattened DTO envelope | Step 6, Step 7, Step 8 | Unit tests verifying response shape and `buildPaginationMeta` output |

---

## 3. Verified Current Codebase State

- **Current Behavior / Gaps:**
  - `src/app/modules/customer/` currently has registration (`POST /register`) and single customer retrieval (`GET /:id`).
  - No list operation exists for customer entities.
  - `src/app/utils/queryBuilder.ts` provides reusable `buildPrismaQuery` and `buildPaginationMeta` helpers.
  - Symmetrical pattern established in `src/app/modules/admin/admin.service.ts` (`getAdmins`).
- **Existing Code Patterns to Follow:**
  - Route: `router.get("/", authGuard, rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN), validateRequest(schema), controller)`.
  - Controller: Extract `query` from `res.locals.validated?.query`, pass to service with `actorId` and `actorRole`, respond via `sendResponse`.
  - Service: Verify actor role, call `buildPrismaQuery`, execute `Promise.all` with `findMany` and `count`, map to flattened DTOs per `DEC-028`, return `{ data, meta }`.
- **Related Existing Files:**
  - `src/app/modules/customer/customer.routes.ts`
  - `src/app/modules/customer/customer.controller.ts`
  - `src/app/modules/customer/customer.service.ts`
  - `src/app/modules/customer/customer.validation.ts`
  - `src/app/modules/customer/customer.interface.ts`
  - `src/app/utils/queryBuilder.ts`
  - `src/app/modules/admin/admin.service.ts` (reference implementation)

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  `Client → GET /api/v1/customers?page=1&limit=10 → authGuard → rbacGuard(ADMIN, SUPER_ADMIN) → validateRequest(getCustomersQuerySchema) → CustomerController.getCustomers → CustomerService.getCustomers → buildPrismaQuery & prisma.user.findMany + count → sendResponse(200 OK)`
- **Data / Schema Impact:**
  - Zero database schema migrations required. Uses existing PostgreSQL `User` and `Customer` tables.
- **Public API / Contract Impact:**
  - New Endpoint: `GET /api/v1/customers`
  - Query Parameters: `page`, `limit`, `sortBy`, `sortOrder`, `searchTerm`, `status`, `startDate`, `endDate`.
  - Success Response:
    ```json
    {
      "statusCode": 200,
      "success": true,
      "message": "Customers retrieved successfully",
      "data": [
        {
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
      ],
      "meta": {
        "page": 1,
        "limit": 10,
        "total": 0,
        "totalPages": 0
      }
    }
    ```
- **Security & Authorization Considerations:**
  - `authGuard` authenticates request and attaches `res.locals.user`.
  - `rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN)` gates route access.
  - Defense-in-depth: `CustomerService.getCustomers` validates `actorRole` and records `AuditAction.UNAUTHORIZED_ATTEMPT` on violations.
  - Query security: search is restricted to safe searchable text fields (`name`, `email`); sorting restricted to allowed whitelist.
  - Data protection: soft-deleted accounts (`deletedAt !== null`) excluded; internal credentials/tokens strictly excluded.

---

## 5. Affected Files & Directives

| Action     | File Path                                                 | Responsibility |
| :--------- | :-------------------------------------------------------- | :------------- |
| `[NEW]`    | `src/app/modules/customer/customer.constant.ts`           | Define sort and searchable field constants |
| `[MODIFY]` | `src/app/modules/customer/customer.validation.ts`         | Define `getCustomersQuerySchema` and `GetCustomersQuery` |
| `[MODIFY]` | `src/app/modules/customer/customer.interface.ts`          | Define `GetCustomersInput` contract |
| `[MODIFY]` | `src/app/modules/customer/customer.service.ts`            | Implement `getCustomers` with pagination, filter, and DTO projection |
| `[MODIFY]` | `src/app/modules/customer/customer.controller.ts`         | Implement `getCustomers` controller handler |
| `[MODIFY]` | `src/app/modules/customer/customer.routes.ts`             | Mount `GET /` with guards and validation |
| `[MODIFY]` | `tests/unit/modules/customer/customer.validation.test.ts` | Add query validation tests |
| `[MODIFY]` | `tests/unit/modules/customer/customer.service.test.ts`    | Add customer list service tests |
| `[MODIFY]` | `tests/unit/modules/customer/customer.controller.test.ts` | Add customer list controller tests |
| `[MODIFY]` | `tests/unit/modules/customer/customer.routes.test.ts`     | Add route configuration tests |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`             | Update P2-T025 status from `🔲` to `🔄` |

---

## 6. Step-by-Step Execution Plan

1. **Step 1: Read-Only Pre-Planning Inspection** (Completed)
   - Inspect PRD `FR-CUSTOMER-002`, `queryBuilder.ts`, `admin.service.ts` pattern, and existing customer module.
2. **Step 2: JIT Task Plan Creation & Human Review** (Current Step)
   - Draft persistent JIT task plan file and present to reviewer.
3. **Step 3: Planning Gate & Status Update**
   - Obtain explicit human approval, mark `phase-2-auth-rbac.md` and task file status `🔄 In progress`.
4. **Step 4: Constants & Query Validation Implementation**
   - Create `src/app/modules/customer/customer.constant.ts`.
   - Update `src/app/modules/customer/customer.validation.ts` with `getCustomersQuerySchema` and `GetCustomersQuery`.
5. **Step 5: Interface Contract Definition**
   - Update `src/app/modules/customer/customer.interface.ts` with `GetCustomersInput`.
6. **Step 6: Service Layer Implementation (`CustomerService.getCustomers`)**
   - Implement `getCustomers` in `src/app/modules/customer/customer.service.ts`.
7. **Step 7: Controller & Route Implementation**
   - Implement `getCustomers` in `src/app/modules/customer/customer.controller.ts`.
   - Mount `GET /` in `src/app/modules/customer/customer.routes.ts`.
8. **Step 8: Automated Unit Test Suite Implementation**
   - Add comprehensive tests in validation, service, controller, and routes test files.
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
| Acceptance criteria        | `Yes`    | Inspection against FR-CUSTOMER-002 requirements | `NOT RUN` |
| Type check / build         | `Yes`    | `pnpm tsc --noEmit`                             | `NOT RUN` |
| Lint                       | `Yes`    | `pnpm lint`                                     | `NOT RUN` |
| Tests                      | `Yes`    | `pnpm test tests/unit/modules/customer`         | `NOT RUN` |
| Migration / data integrity | `No`     | Schema unchanged                                | `N/A`     |
| Manual verification        | `No`     | Automated test suite covers all criteria        | `N/A`     |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None. `P2-B001` resolved per `DEC-027` (`GET /api/v1/customers`).
- **Design Decisions:**
  - Date filtering handles `startDate` (greater-than-or-equal) and `endDate` (less-than-or-equal) on `createdAt`.
  - Symmetrical with `P2-T021` (`AdminService.getAdmins`), unauthorized attempts at the service layer record forensic `AuditAction.UNAUTHORIZED_ATTEMPT` before throwing 403 `FORBIDDEN_ROLE_ACCESS`.
  - Response array utilizes flattened DTOs with dynamic latest-timestamp precedence per `DEC-028`.

---

## 9. Plan Review

| Field       | Value                                    |
| :---------- | :--------------------------------------- |
| Outcome     | `Approved`                               |
| Reviewed by | `Human Reviewer`                         |
| Reviewed on | `2026-09-26`                             |
| Notes       | `JIT plan approved for implementation`   |

---

## 10. Implementation Evidence

- **Changed Files:**
- **Migration Created:** None.
- **Test / Verification Output:**
- **Deviations from Original Plan:**
- **Remaining Concerns / Follow-ups:**
