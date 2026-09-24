# Task: P2-T024 - Implement Customer Profile and Email Updates

> **Canonical Status:** `🔄 In Progress`  
> **Planning Gate:** Approved by Human (2026-09-25) → `🔄 In Progress`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T024`
- **PRD / Requirement Reference:** `FR-CUSTOMER-001`, `FR-RBAC-005`
- **ERD Reference:** `User`, `Customer`, `AuditLog`
- **Dependencies:** `P2-T007` (Email Verification), `P2-T022` (Ownership Authorization), `P2-T023` (Customer Profile Retrieval)

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

- Allow Customers to update their own permitted profile fields: `name`, `contactNumber`, `address`, and `image` (avatar URL).
- Allow Customers to update their email address with format validation and uniqueness check; reset `emailVerified` to `false` and trigger email verification OTP via `auth.api.sendVerificationOTP`.
- Allow authorized administrators (`ADMIN`, `SUPER_ADMIN`) to update permitted customer business profile fields (`name`, `contactNumber`, `address`, `image`) with audit logging (`AuditAction.UPDATE`, `AuditEntityType.CUSTOMER`).
- Prohibit administrators from changing a Customer's email address (`HTTP 403 Forbidden`).
- Enforce resource ownership via `AuthorizationService.authorizeOwnership` (`HTTP 403 Forbidden` for cross-customer access).
- Prevent modification of roles, account status, credentials, or provider accounts through profile updates via Zod sanitization.
- Return unified, flattened Customer Profile DTOs adhering to `DEC-028` with defensive `?? null` and native latest `updatedAt` calculation.
- Resolve `P2-B007` within the approved Phase 2 scope by accepting valid image URL strings or `null`.

### Out of Scope

- Direct binary file upload / storage (Cloudinary integration is deferred to future phase).
- Password management or credential mutation through profile endpoints (handled via auth module).
- Customer role, status, or lifecycle changes (handled via dedicated admin endpoints in `P2-T026`).
- Order, inquiry, or commerce summaries (deferred under `DEC-008`).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| 1. Allow Customers to update only their own permitted name, contact number, address and approved avatar representation | Steps 4, 5, 6, 7 | Automated unit tests in `customer.service.test.ts` |
| 2. Allow authorized administrators to update only permitted business-profile fields with audit logging | Steps 6, 7 | Automated unit tests verifying `AuditService.createAuditLog` |
| 3. Prevent profile input from modifying role, status, ownership, credentials or provider-account data | Step 5 | Automated validation tests in `customer.validation.test.ts` |
| 4. Change email only through the approved account flow with validation, uniqueness and correct verification-state reset | Step 6 | Unit tests covering uniqueness conflict, `emailVerified: false`, and OTP dispatch |
| 5. Enforce ownership, return required errors and cover the approved avatar resolution from `P2-B007` | Steps 5, 6, 7 | Ownership rejection tests and avatar URL validation tests |

---

## 3. Verified Current Codebase State

_Findings from read-only repository inspection before planning or writing code:_

- **Current Behavior / Gaps:** 
  - `CustomerService.registerCustomer` creates a Customer and `CustomerService.getCustomerProfile` retrieves the flattened profile DTO.
  - No profile update (`PATCH /api/v1/customers/:id`) endpoint or service method currently exists.
- **Existing Code Patterns to Follow:**
  - `AuthorizationService.authorizeOwnership` is established in `P2-T022` and used in `P2-T023`.
  - `DEC-028` establishes flattened resource DTOs with defensive `?? null` and native latest `updatedAt` comparison (`targetUser.customer && targetUser.customer.updatedAt > targetUser.updatedAt ? targetUser.customer.updatedAt : targetUser.updatedAt`).
  - Validation pattern in `src/app/modules/customer/customer.validation.ts` uses Zod with custom error messages and `.trim()`.
  - Express controller uses `catchAsync` and `sendResponse`.
- **Related Existing Files:**
  - `src/app/modules/customer/customer.interface.ts`
  - `src/app/modules/customer/customer.validation.ts`
  - `src/app/modules/customer/customer.service.ts`
  - `src/app/modules/customer/customer.controller.ts`
  - `src/app/modules/customer/customer.routes.ts`

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  `Route (PATCH /api/v1/customers/:id) → Middleware (authGuard, validateRequest) → Controller → Service → Repository/Prisma → AuditService / Better Auth OTP`
- **Data / Schema Impact:**
  - Zero schema migrations needed. The existing `User` and `Customer` models in `prisma/schema/` already contain `name`, `email`, `emailVerified`, `image`, `contactNumber`, `address`, and `updatedAt`.
- **Public API / Contract Impact:**
  - Endpoint: `PATCH /api/v1/customers/:id`
  - Request Params: `{ id: string (UUID) }`
  - Request Body: Optional fields (`name?`, `email?`, `contactNumber?`, `address?`, `image?`), with refinement requiring at least one field.
  - Success Response: HTTP 200 OK with flattened Customer Profile DTO.
- **Security & Authorization Considerations:**
  - Route is protected by `authGuard`.
  - Service enforces `AuthorizationService.authorizeOwnership`.
  - Administrative users attempting to update a customer's `email` are rejected with `HTTP 403 Forbidden`.
  - Email uniqueness check prevents duplicate email conflicts (`HTTP 409 Conflict`).
  - Changing email resets `emailVerified` to `false` and dispatches verification OTP.
  - Administrative updates create an atomic audit log record.

---

## 5. Affected Files & Directives

| Action | File Path | Responsibility |
| :----- | :-------- | :------------- |
| Modify | `src/app/modules/customer/customer.interface.ts` | Define `UpdateCustomerProfileInput` and `UpdateCustomerProfileServiceInput` |
| Modify | `src/app/modules/customer/customer.validation.ts` | Define `updateCustomerProfileSchema` and export inferred types |
| Modify | `src/app/modules/customer/customer.service.ts` | Implement `updateCustomerProfile` with ownership check, validation, transaction, OTP, audit log, and flattened DTO |
| Modify | `src/app/modules/customer/customer.controller.ts` | Implement `updateCustomerProfile` handler with `sendResponse` |
| Modify | `src/app/modules/customer/customer.routes.ts` | Bind `PATCH /:id` route with `authGuard` and `validateRequest` |
| Modify | `tests/unit/modules/customer/customer.validation.test.ts` | Add unit tests for `updateCustomerProfileSchema` |
| Modify | `tests/unit/modules/customer/customer.service.test.ts` | Add unit tests for `updateCustomerProfile` (self-update, admin-update, ownership rejection, duplicate email, verification reset, audit logging) |
| Modify | `tests/unit/modules/customer/customer.controller.test.ts` | Add unit tests for `updateCustomerProfile` controller method |
| Modify | `tests/unit/modules/customer/customer.routes.test.ts` | Add unit tests verifying `PATCH /:id` route mapping |

---

## 6. Step-by-Step Implementation Plan

- **Step 1: Read-Only Inspection** (Completed)
- **Step 2: Draft JIT Plan** (Active)
- **Step 3: Human Approval & Phase Status Update (`🔄 In progress`)**
- **Step 4: Update Interfaces (`customer.interface.ts`)**
- **Step 5: Implement Validation Schema (`customer.validation.ts`)**
- **Step 6: Implement Service Layer Logic (`customer.service.ts`)**
- **Step 7: Implement Controller and Routes (`customer.controller.ts`, `customer.routes.ts`)**
- **Step 8: Implement Unit Tests & Run Test Suites**
- **Step 9: Run Quality Gates (`tsc`, `lint`, `test`)**
- **Step 10: Record Evidence & Submit for Review (`🕵️ Awaiting human review`)**
- **Step 11: Final Human Approval, Governance Sync & Closure (`✅ Done`)**

---

## 7. Verification Plan

- **Automated Unit Testing:**
  - Run `pnpm test tests/unit/modules/customer/` ensuring 100% test pass rate across validation, service, controller, and routes.
- **Repository-wide Quality Gates:**
  - `pnpm tsc --noEmit` (zero type errors)
  - `pnpm lint` (zero ESLint issues)
  - `pnpm test` (all unit and integration tests passing)
