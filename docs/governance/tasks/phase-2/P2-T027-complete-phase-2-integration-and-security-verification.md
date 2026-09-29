# Task: P2-T027 - Complete Phase 2 Integration and Security Verification

> **Canonical Status:** `✅ Done` (tracked authoritatively in parent phase file)  
> **Planning Gate:** Draft Plan → Human Approval → `🔄 In Progress` → `🕵️ Awaiting human review` → `✅ Done`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T027`
- **PRD / Requirement Reference:**
  - `FR-AUTH-001` through `FR-AUTH-009` (Authentication & Session Management)
  - `FR-RBAC-001` through `FR-RBAC-006` (Role-Based Access Control)
  - `FR-ADMIN-001` through `FR-ADMIN-003` (Admin Management & Auditability)
  - `FR-CUSTOMER-001` through `FR-CUSTOMER-004` (Customer Profile & Lifecycle)
- **ERD Reference:**
  - `User`, `Account`, `Session`, `Verification` in `prisma/schema/auth.prisma`
  - `Admin`, `Customer` in `prisma/schema/profiles.prisma`
  - `AuditLog` in `prisma/schema/audit.prisma`
- **Dependencies:** All Phase 2 foundation, authentication, authorization, admin, and customer tasks (`P2-T029`, `P2-T028`, `P2-T001`, `P2-T002`, `P2-T005`–`P2-T026`).
- **Blockers:**
  - `P2-B004` (Approve initial `SUPER_ADMIN` provisioning and Admin credential flow - documentation & seed guidance).
  - `P2-B007` (Approve avatar input/media contract - resolved: URL validated via `imageSchema`, storage upload deferred per `DEC-017`/`DEC-028`).
  - `P2-B010` (Provider evidence for Google OAuth & SMTP - unit test mocks verified; live credential environment documented).

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

- Establish a comprehensive **Phase 2 Requirements Traceability Matrix** linking every approved FR and sub-requirement (`FR-AUTH-001`–`009`, `FR-RBAC-001`–`006`, `FR-ADMIN-001`–`003`, `FR-CUSTOMER-001`–`004`) to verified implementation files and automated test suites.
- Implement an automated end-to-end integration and security test suite in `tests/integration/phase2.security.test.ts` covering:
  - **Full Route Authentication Boundary:** Every protected endpoint across auth, admin, user, and customer modules rejects unauthenticated requests with HTTP 401 `UNAUTHORIZED`.
  - **Role-Based Access Control Matrix:**
    - Customer role cannot access admin endpoints (`POST /api/v1/admins`, `PATCH /api/v1/admins/:id`, `GET /api/v1/admins`, `GET /api/v1/customers`, `GET /api/v1/customers/:id`, `PATCH /api/v1/customers/:id/status`, `DELETE /api/v1/customers/:id`) → HTTP 403 `FORBIDDEN_ROLE_ACCESS`.
    - Admin role cannot access Super Admin-only endpoints (`POST /api/v1/admins`, `PATCH /api/v1/admins/:id`, `GET /api/v1/admins`) → HTTP 403 `FORBIDDEN_ROLE_ACCESS`.
    - Super Admin can access all administrative operations.
  - **Account Status & Session Revocation:** Suspended and deactivated accounts are blocked from protected operations with HTTP 403 `ACCOUNT_SUSPENDED` / `ACCOUNT_DEACTIVATED`.
  - **Session Security & Transport Attributes:** Verify cookie attributes (`httpOnly`, `SameSite: "lax"`, `Secure` in production) and CORS origin policy.
  - **Sensitive Data Non-Exposure:** Verify that HTTP responses and Pino logger redact sensitive data (passwords, tokens, internal stack traces, DB credentials).
- Verify database and migration integrity against the approved ERD (`prisma/schema/` models, foreign key actions, and migration history).
- Execute full quality gates: TypeScript compile check (`pnpm tsc --noEmit`), ESLint (`pnpm lint`), and complete test suite run (`pnpm test`).
- Record complete execution evidence and review notes for human approval.

### Out of Scope

- Introducing new feature endpoints or modifying approved API contracts.
- Implementing unapproved future Phase 3+ modules (Inquiries, Projects, Products, Orders, Stripe, Cloudinary).
- Live third-party provider credential setup in local repository environment (mocked transport verified per governance rules).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Traceability from every approved Phase 2 FR to passing behavior | Step 4 | Traceability Matrix in task document & test mapping |
| Run full build, lint, and security verification matrix | Step 5, Step 7 | `tests/integration/phase2.security.test.ts`, `pnpm tsc`, `pnpm lint`, `pnpm test` |
| Verify cookie, CSRF origin handling, session revocation, and provider boundaries (network rate limiting delegated to reverse proxy per DEC-019) | Step 5 | Automated integration tests against Express app |
| Verify migration and data integrity against approved ERD | Step 6 | Prisma schema and migration inspection |
| Confirm zero exposure of sensitive data, stack traces, or credentials | Step 5, Step 7 | Payload assertions and logger redaction tests |

---

### Phase 2 Requirements Traceability Matrix

| Requirement ID | Description | Implementation Path(s) | Verification Test Suite(s) | Status |
| :--- | :--- | :--- | :--- | :---: |
| **FR-AUTH-001** | Email & Password Registration (Customer default, 409 duplicate, DEC-017) | `customer.routes.ts`, `customer.controller.ts`, `customer.service.ts`, `auth.ts` | `customer.validation.test.ts`, `customer.service.test.ts`, `customer.controller.test.ts` | `PASSED` |
| **FR-AUTH-002** | Google OAuth Sign-In / Sign-Up (Customer boundary per DEC-020) | `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.ts` | `auth.validation.test.ts`, `auth.service.test.ts`, `auth.controller.test.ts` | `PASSED` |
| **FR-AUTH-003** | Google Account Linking & Unlinking (DEC-020, 422 sole method, DEC-023) | `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts` | `auth.service.test.ts`, `auth.controller.test.ts` | `PASSED` |
| **FR-AUTH-004** | Email Verification & OTP Resend (React Email template, transport) | `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `email.service.ts`, `auth.mailer.ts` | `email.service.test.ts`, `auth.mailer.test.ts`, `auth.service.test.ts` | `PASSED` |
| **FR-AUTH-005** | Credential Login (Anti-enumeration DEC-018, status check, DEC-020 customer) | `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.ts` | `auth.service.test.ts`, `auth.controller.test.ts` | `PASSED` |
| **FR-AUTH-006** | Password Reset (Generic 200 anti-enumeration, session revocation, email) | `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.mailer.ts` | `auth.service.test.ts`, `auth.controller.test.ts` | `PASSED` |
| **FR-AUTH-007** | Change / Set Password (Current password verify, reuse reject, revoke other) | `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts` | `auth.service.test.ts`, `auth.controller.test.ts` | `PASSED` |
| **FR-AUTH-008** | Logout & Session Revocation (Single session, logout-all, 401 replay) | `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts` | `auth.service.test.ts`, `auth.controller.test.ts` | `PASSED` |
| **FR-AUTH-009** | Session Security & Cookies (`httpOnly`, `SameSite: "lax"`, CSRF origin) | `auth.ts`, `authGuard.ts`, `env.ts` | `config/auth.test.ts`, `middleware/authGuard.test.ts` | `PASSED` |
| **FR-RBAC-001** | User Role System (`SUPER_ADMIN`, `ADMIN`, `CUSTOMER`, self-role lock) | `auth.prisma`, `admin.service.ts`, `customer.service.ts` | `admin.service.test.ts`, `customer.service.test.ts` | `PASSED` |
| **FR-RBAC-002** | Authorization Middleware (`authGuard`, `rbacGuard`, 401/403 separation) | `authGuard.ts`, `rbacGuard.ts` | `authGuard.test.ts`, `rbacGuard.test.ts` | `PASSED` |
| **FR-RBAC-003** | Super Admin Role Management (Admin promote/demote, prevent self-lock) | `admin.routes.ts`, `admin.controller.ts`, `admin.service.ts` | `admin.service.test.ts`, `admin.controller.test.ts` | `PASSED` |
| **FR-RBAC-004** | Admin Restrictions on Privileged Accounts (403, audit unauthorized) | `admin.service.ts`, `audit.service.ts` | `admin.service.test.ts` | `PASSED` |
| **FR-RBAC-005** | Resource Ownership Validation (`AuthorizationService`, IDOR guard) | `authorization.service.ts`, `user.service.ts`, `customer.service.ts` | `user.service.test.ts`, `customer.service.test.ts` | `PASSED` |
| **FR-RBAC-006** | Account Status Enforcement (`SUSPENDED`/`DEACTIVATED` 403, session revoke) | `authGuard.ts`, `admin.service.ts`, `customer.service.ts`, `DEC-030` | `authGuard.test.ts`, `customer.service.test.ts`, `admin.service.test.ts` | `PASSED` |
| **FR-ADMIN-001** | Create Admin User (Super Admin only, 409 duplicate, audit log) | `admin.routes.ts`, `admin.controller.ts`, `admin.service.ts` | `admin.service.test.ts`, `admin.validation.test.ts`, `admin.controller.test.ts` | `PASSED` |
| **FR-ADMIN-002** | Update Admin Profile & Status (Super Admin only, session revocation) | `admin.routes.ts`, `admin.controller.ts`, `admin.service.ts` | `admin.service.test.ts`, `admin.validation.test.ts`, `admin.controller.test.ts` | `PASSED` |
| **FR-ADMIN-003** | Get Admin List (Super Admin only, pagination, search, status filter) | `admin.routes.ts`, `admin.controller.ts`, `admin.service.ts`, `queryBuilder.ts` | `admin.service.test.ts`, `admin.validation.test.ts` | `PASSED` |
| **FR-CUSTOMER-001** | Universal Self-Service Profile (`/users/profile`, IDOR elimination DEC-029) | `user.routes.ts`, `user.controller.ts`, `user.service.ts` | `user.service.test.ts`, `user.validation.test.ts`, `user.controller.test.ts` | `PASSED` |
| **FR-CUSTOMER-002** | Get Customer List (Admin/Super Admin only, pagination, date filter) | `customer.routes.ts`, `customer.controller.ts`, `customer.service.ts` | `customer.service.test.ts`, `customer.validation.test.ts` | `PASSED` |
| **FR-CUSTOMER-003** | Get Customer by ID (Admin/Super Admin only, 404 non-customer, DEC-028 DTO) | `customer.routes.ts`, `customer.controller.ts`, `customer.service.ts` | `customer.service.test.ts`, `customer.controller.test.ts` | `PASSED` |
| **FR-CUSTOMER-004** | Suspend / Deactivate / Soft Delete Customer (Session revoke, DEC-030) | `customer.routes.ts`, `customer.controller.ts`, `customer.service.ts` | `customer.service.test.ts`, `customer.validation.test.ts`, `customer.controller.test.ts` | `PASSED` |

---

### Phase 2 Endpoint Security & RBAC Matrix

| Endpoint | Method | Allowed Role(s) | Unauthenticated | CUSTOMER | ADMIN | SUPER_ADMIN |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| `/api/v1/customers/register` | `POST` | Public | 201 / 400 / 409 | Allowed | Allowed | Allowed |
| `/api/v1/auth/login` | `POST` | Public (Customer portal) | 200 / 401 | Allowed | 403 (DEC-020) | 403 (DEC-020) |
| `/api/v1/auth/login/google` | `POST` | Public (Customer portal) | 200 / 401 | Allowed | 403 (DEC-020) | 403 (DEC-020) |
| `/api/v1/auth/forgot-password` | `POST` | Public | 200 (Generic) | Allowed | Allowed | Allowed |
| `/api/v1/auth/reset-password` | `POST` | Public | 200 / 400 | Allowed | Allowed | Allowed |
| `/api/v1/auth/send-verification-otp` | `POST` | Public | 200 / 400 | Allowed | Allowed | Allowed |
| `/api/v1/auth/verify-email-otp` | `POST` | Public | 200 / 400 | Allowed | Allowed | Allowed |
| `/api/v1/auth/logout` | `POST` | Authenticated | 401 | 200 | 200 | 200 |
| `/api/v1/auth/logout-all` | `POST` | Authenticated | 401 | 200 | 200 | 200 |
| `/api/v1/auth/change-password` | `POST` | Authenticated | 401 | 200 | 200 | 200 |
| `/api/v1/auth/set-password` | `POST` | Authenticated | 401 | 200 | 200 | 200 |
| `/api/v1/auth/link/google` | `POST` | Authenticated Customer | 401 | 200 | 403 (DEC-020) | 403 (DEC-020) |
| `/api/v1/auth/unlink/google` | `POST` | Authenticated Customer | 401 | 200 | 403 (DEC-020) | 403 (DEC-020) |
| `/api/v1/users/profile` | `GET` | Authenticated (Self) | 401 | 200 | 200 | 200 |
| `/api/v1/users/profile` | `PATCH` | Authenticated (Self) | 401 | 200 | 200 | 200 |
| `/api/v1/customers` | `GET` | ADMIN, SUPER_ADMIN | 401 | 403 | 200 | 200 |
| `/api/v1/customers/:id` | `GET` | ADMIN, SUPER_ADMIN | 401 | 403 | 200 | 200 |
| `/api/v1/customers/:id/status` | `PATCH` | ADMIN, SUPER_ADMIN | 401 | 403 | 200 | 200 |
| `/api/v1/customers/:id` | `DELETE` | ADMIN, SUPER_ADMIN | 401 | 403 | 200 | 200 |
| `/api/v1/admins` | `POST` | SUPER_ADMIN | 401 | 403 | 403 | 201 |
| `/api/v1/admins` | `GET` | SUPER_ADMIN | 401 | 403 | 403 | 200 |
| `/api/v1/admins/:id` | `PATCH` | SUPER_ADMIN | 401 | 403 | 403 | 200 |

---

## 3. Verified Current Codebase State

- **Current Behavior / Gaps:**
  - 39 test files with 629 tests passing across unit test suites.
  - Integration tests in `tests/integration/protectedRoutes.test.ts` only cover a subset of endpoints and lack customer/user endpoints and role matrix assertions.
  - All Phase 2 feature tasks (`P2-T001` through `P2-T026`) are implemented and verified individually.
- **Existing Code Patterns to Follow:**
  - Vitest test syntax (`describe`, `it`, `expect`, `vi`) with explicit imports per `DEC-025`.
  - Supertest HTTP assertions with `getApp()` from `tests/helpers/app.helper.ts`.
  - Mock authentication sessions via `better-auth` mock handlers.
- **Related Existing Files:**
  - `src/app/middleware/authGuard.ts`, `src/app/middleware/rbacGuard.ts`
  - `src/app/config/auth.ts`, `src/app/config/env.ts`, `src/app/config/logger.ts`
  - `src/app/routes/index.ts`
  - `tests/integration/protectedRoutes.test.ts`, `tests/helpers/app.helper.ts`

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  - `HTTP Request (Supertest) → Express App (app.ts) → Middleware Stack (pino, CORS, parsers, authGuard, rbacGuard, validateRequest) → Controllers / Handlers → Standard JSON Response / Centralized Error Handler`
- **Data / Schema Impact:**
  - None (Schema and migrations remain unchanged).
- **Public API / Contract Impact:**
  - None (Verification of existing endpoints only).
- **Security & Authorization Considerations:**
  - Verify complete separation of roles: `SUPER_ADMIN` > `ADMIN` > `CUSTOMER`.
  - Verify defense-in-depth: Route guard bypass cannot bypass service ownership checks.
  - Verify account status enforcement (`SUSPENDED`, `DEACTIVATED`, `deletedAt`).
  - Verify that sensitive fields (`password`, `token`, `secret`, `accessToken`) are stripped in all responses and logs.

---

## 5. Affected Files & Directives

| Action     | File Path                                                                                   | Responsibility                                                                    |
| :--------- | :------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------- |
| `[NEW]`    | `tests/integration/phase2.security.test.ts`                                                 | Comprehensive integration and security verification test suite                    |
| `[MODIFY]` | `tests/integration/protectedRoutes.test.ts`                                                 | Update to include all Phase 2 protected endpoints                                |
| `[NEW]`    | `docs/governance/tasks/phase-2/P2-T027-complete-phase-2-integration-and-security-verification.md` | Persistent JIT task plan and verification evidence                                |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`                                               | Update blockers, task status, and human review                                    |
| `[MODIFY]` | `docs/governance/MEMORY.md`                                                                 | Record Phase 2 completion state and final metrics                                 |
| `[MODIFY]` | `docs/governance/06-PHASE-ROADMAP.md`                                                       | Record Phase 2 completion                                                         |

---

## 6. Step-by-Step Execution Plan

1. **ধাপ ১: প্রি-প্ল্যানিং রীড-অনলি ইনস্পেকশন:** Review PRD Phase 2 FRs, ERD models, test suite coverage, and blocker statuses. *(COMPLETED)*
2. **ধাপ ২: JIT টাস্ক প্ল্যান খসড়া তৈরি:** Draft and submit `P2-T027` JIT task plan. *(CURRENT)*
3. **ধাপ ৩: প্ল্যানিং গেট অনুমোদন ও স্ট্যাটাস আপডেট:** Present plan for human review; update canonical status in phase file and task file to `🔄 In progress`.
4. **ধাপ ৪: রিকোয়ারমেন্ট ট্রেইসেবিলিটি ও সিকিউরিটি ভেরিফিকেশন ম্যাট্রিক্স সংজ্ঞায়িতকরণ:** Document exhaustive FR-to-code traceability matrix in Section 2 of task document.
5. **ধাপ ৫: ইন্টিগ্রেশন ও সিকিউরিটি টেস্ট স্যুট বাস্তবায়ন:** Implement `tests/integration/phase2.security.test.ts` and update `tests/integration/protectedRoutes.test.ts` covering full auth boundary, RBAC matrix, account status, and sensitive data non-exposure.
6. **ধাপ ৬: ডাটাবেজ ও স্কিমা ইন্টিগ্রিটি ভেরিফিকেশন:** Inspect Prisma schemas, relations, and migration consistency against the ERD.
7. **ধাপ ৭: কোয়ালিটি গেটস ভ্যালিডেশন:** Execute `pnpm tsc --noEmit`, `pnpm lint`, and `pnpm test` (full suite run).
8. **ধাপ ৮: টাস্ক এভিডেন্স ও রিভিউ প্রস্তুতকরণ:** Document all execution evidence in Section 10 and mark `🕵️ Awaiting human review`.
9. **ধাপ ৯: হিউম্যান অনুমোদন ও গভর্নেন্স সমাপ্তি (Phase 2 Closure):** Obtain human review approval; update phase file (`✅ Done`), roadmap, and `MEMORY.md`; propose git commit.

---

## 7. Verification & Quality Gates

| Check                      | Required | Command or Method                               | Result   |
| :------------------------- | :------- | :---------------------------------------------- | :------- |
| Acceptance criteria        | `Yes`    | Inspection against PRD Phase 2 FRs              | `PASSED` |
| Type check / build         | `Yes`    | `pnpm tsc --noEmit`                             | `PASSED` |
| Lint                       | `Yes`    | `pnpm lint`                                     | `PASSED` |
| Tests                      | `Yes`    | `pnpm test` (Full test suite across all files)  | `PASSED` |
| Migration / data integrity | `Yes`    | Schema & migration history review               | `PASSED` |
| Manual verification        | `Yes`    | Security matrix & data exposure manual audit    | `PASSED` |

---

## 8. Assumptions & Blockers

- **Active Blockers:**
  - `P2-B004`: Initial `SUPER_ADMIN` provisioning and Admin credential flow. Documented: In production, initial Super Admin account is seeded or created via CLI script; subsequent admins are created via `POST /api/v1/admins`.
  - `P2-B007`: Avatar storage ownership and media boundary. Resolved: User profile accepts validated image URL (`imageSchema`), while multipart media uploads belong to future Cloudinary media module.
  - `P2-B010`: Google OAuth and SMTP live provider credentials. Verified via unit/integration test mocks per `DEC-013` and project rules.
- **Design Assumptions Awaiting Approval:** None.

---

## 9. Plan Review

| Field       | Value                                                                                         |
| :---------- | :-------------------------------------------------------------------------------------------- |
| Outcome     | `Approved & Completed`                                                                        |
| Reviewed by | `Human Reviewer`                                                                              |
| Reviewed on | `2026-09-27`                                                                                  |
| Notes       | `Phase 2 integration and security verification verified and approved by human reviewer`       |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `tests/integration/protectedRoutes.test.ts`: Expanded to test all 15 Phase 2 protected endpoints across GET, POST, PATCH, and DELETE rejecting unauthenticated requests with 401 `UNAUTHORIZED`.
  - `tests/integration/phase2.security.test.ts`: Added 17 integration and security tests covering Customer RBAC boundaries, Admin RBAC boundaries, account status enforcement (`SUSPENDED`, `DEACTIVATED`, soft-deleted), and data exposure / CORS.
  - `docs/governance/tasks/phase-2/P2-T027-complete-phase-2-integration-and-security-verification.md`: Documented Phase 2 Traceability Matrix, Security Matrix, and verification evidence.
- **Migration Created:** None (schema verified against baseline migrations).
- **Test / Verification Output:**
  - `pnpm tsc --noEmit`: 0 errors.
  - `pnpm lint`: 0 errors, 0 warnings.
  - `pnpm prisma validate`: The schemas at `prisma\schema` are valid 🚀.
  - `pnpm test`: 40 test files passed (40), 653 tests passed (653).
  - `git diff --check`: Clean (0 whitespace issues).
- **Deviations from Original Plan:** None.
- **Remaining Concerns / Follow-ups:** None. All Phase 2 functional requirements and security gates verified. Ready for human sign-off and Phase 2 closure.
