# Task: P2-T024 - Implement Customer Profile Updates

> **Canonical Status:** `🕵️ Awaiting human review`  
> **Planning Gate:** Approved by Human (2026-09-25) → `🔄 In Progress` → Implemented & Tested → `🕵️ Awaiting human review`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T024`
- **PRD / Requirement Reference:** `FR-CUSTOMER-001`, `FR-RBAC-005`
- **ERD Reference:** `User`, `Customer`
- **Dependencies:** `P2-T007` (Email Verification), `P2-T023` (Customer Profile Retrieval)

---

## 2. Approved Scope & Human Directives Applied During Implementation

### Human Architectural & Product Decisions:
1. **Email Immutability in Profile Updates:** Explicitly decided by Human that email is strictly immutable through profile update (`PATCH /profile`). Email mutation/change with OTP flow removed from profile update scope.
2. **Strict Self-Service Endpoint (`PATCH /api/v1/customers/profile`):** In alignment with modern REST best practices (GitHub, Stripe, Spotify) and KISS/YAGNI, profile updates operate strictly on the authenticated session user (`PATCH /profile`). This completely eliminates IDOR attack surface by design and removes redundant `:id` route parameter validation and comparison ceremony.
3. **Strict Non-Nullable Fields:** All updatable fields (`name`, `contactNumber`, `address`, `image`) only accept valid replacement string values when provided, or are omitted (`undefined`) when unchanged. `.nullable()` removed from `image` (avatar) since users only "Change Image" or keep existing avatar.
4. **Bangladeshi Contact Number Validation:** Contact numbers validated via shared `contactNumberSchema` matching `01[3-9]\d{8}` or `+8801[3-9]\d{8}` with polished message: `"Please provide a valid phone number (e.g. 01XXXXXXXXX or +8801XXXXXXXXX)"`.
5. **Pruning Over-Engineering (`AuthorizationService` Removal):** Since this studio platform has strictly 3 static roles (`CUSTOMER`, `ADMIN`, `SUPER_ADMIN`) and will not introduce speculative dynamic roles, the over-engineered multi-role `AuthorizationService` framework was completely deleted and replaced with direct, readable, 2-line role/ownership guard clauses in `customer.service.ts`.
6. **API Input Symmetry:** Unified all `CustomerService` methods to accept typed input contracts (`RegisterCustomerData`, `GetCustomerProfileInput`, `UpdateCustomerProfileInput`).
7. **Universal Self-Service Profile Architecture (`/api/v1/users/profile`):** In alignment with `DEC-026`, `DEC-028`, DRY, and explicit Human directive, self-service profile retrieval and updating are universal concerns for all authenticated roles (`CUSTOMER`, `ADMIN`, `SUPER_ADMIN`). Created universal `user` module mounted at `/api/v1/users/profile` (`GET` and `PATCH`). `UserService` dynamically resolves role-specific profile extensions (`Customer` or `Admin`), preventing redundant module-by-module profile reimplementation.

---

## 3. Implementation Evidence

| Component | File Path | Implementation Summary |
| :-------- | :-------- | :--------------------- |
| **Validation** | `src/app/validations/common.validation.ts` | Refined `contactNumberSchema` with BD regex and consolidated shared `nameSchema` across all modules per DRY |
| **Validation** | `src/app/modules/user/user.validation.ts` | Implemented `updateProfileSchema` with strict body fields, non-nullable image, and refinement requiring >= 1 field |
| **Service** | `src/app/modules/user/user.service.ts` | Universal `getProfile` and `updateProfile` dynamically updating `customer` or `admin` records based on role, with latest timestamp resolution per `DEC-028` |
| **Controller** | `src/app/modules/user/user.controller.ts` | Universal `getProfile` and `updateProfile` handlers extracting session `user.id` |
| **Routes** | `src/app/modules/user/user.routes.ts` | Mounted `GET /profile` and `PATCH /profile` under `/users` with `authGuard` and validation |
| **Routes** | `src/app/routes/index.ts` | Registered `UserRoutes` under `/users` in application `RootRouter` |
| **Customer Service** | `src/app/modules/customer/customer.service.ts` | Cleaned service to focus strictly on customer domain (`registerCustomer`, `getCustomerProfile`) |
| **Customer Controller** | `src/app/modules/customer/customer.controller.ts` | Cleaned controller to focus strictly on customer domain (`registerCustomer`, `getCustomerProfile`) |
| **Customer Routes** | `src/app/modules/customer/customer.routes.ts` | Cleaned routes to `/register` and `/:id` |
| **Unit Tests** | `tests/unit/modules/user/user.validation.test.ts` | 16 tests covering all field constraints, BD numbers, image URLs, and refinement |
| **Unit Tests** | `tests/unit/modules/user/user.service.test.ts` | 7 tests covering Customer updates, Admin updates, null defaults, and 404 handling |
| **Unit Tests** | `tests/unit/modules/user/user.controller.test.ts` | 4 tests covering 200 OK responses and `catchAsync` error forwarding |
| **Unit Tests** | `tests/unit/modules/user/user.routes.test.ts` | 2 tests verifying route stacks, middleware, and method exclusivity |
| **Unit Tests** | `tests/unit/modules/customer/customer.service.test.ts` | 10 tests covering registration and retrieval |
| **Unit Tests** | `tests/unit/modules/customer/customer.controller.test.ts` | 4 tests covering registration and retrieval |
| **Unit Tests** | `tests/unit/modules/customer/customer.routes.test.ts` | 2 tests verifying `/register` and `/:id` |
| **Unit Tests** | `tests/unit/modules/customer/customer.validation.test.ts` | 15 tests covering registration and getCustomer params |
| **Unit Tests** | `tests/unit/routes/index.test.ts` | 5 tests verifying all 4 mounted routes (`/auth`, `/users`, `/admins`, `/customers`) |
| **Unit Tests** | `tests/unit/validations/common.validation.test.ts` | 44 tests covering `nameSchema`, `emailSchema`, `passwordSchema`, `contactNumberSchema`, etc. |

---

## 4. Verification Evidence & Quality Gates

```bash
$ pnpm tsc --noEmit
# Exit code 0 (Zero TypeScript errors)

$ pnpm lint
# Exit code 0 (Zero ESLint warnings/errors)

$ pnpm test
# Test Files  40 passed (40)
# Tests       566 passed (566)
# Duration    3.34s
```

---

## 5. Review Readiness

The implementation is complete, zero lint or type errors exist, 100% of tests are passing, and all customer profile update requirements have been verified according to Human instructions and KISS/YAGNI/DRY principles.
