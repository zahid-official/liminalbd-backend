# Task: P2-T006 - Implement Email/Password Customer Registration

> **Canonical Status:** `🔄` (tracked authoritatively in parent phase file)  
> **Planning Gate:** Plan Approved -> Blockers Cleared (`P2-B001` for registration) -> `🔄 In Progress`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T006`
- **PRD / Requirement Reference:** `FR-AUTH-001` (Customer Registration: `FR-AUTH-001.1` through `FR-AUTH-001.4`), `FR-RBAC-001.1` through `FR-RBAC-001.3` (Default Customer Role Assignment & Protection against Privilege Escalation)
- **ERD Reference:** `User`, `Account`, `Customer`
- **Dependencies:** `P2-T005` (`✅ Done`)
- **Active Blockers:** `P2-B001` (Public API: Approval of `POST /api/v1/auth/register`)

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

- Expose public endpoint `POST /api/v1/auth/register` with strict MVC architecture (`Route → Controller → Service → Better Auth API / Prisma`).
- Validate incoming request payload via dedicated Zod schema with `validateRequest`:
  - `name`: string, trimmed, min 2 characters, max 100 characters.
  - `email`: valid email format, converted to lowercase, trimmed.
  - `password`: string, min 8 characters, requiring at least one letter and one number for secure baseline.
  - `contactNumber`: string, optional, trimmed.
  - `address`: string, optional, trimmed.
- Strict payload sanitization: Reject or strip any client-supplied `role`, `status`, `needPasswordChange`, or `deletedAt`.
- Enforce default role and status: Always assign `role: "CUSTOMER"` and `status: "ACTIVE"`. Never create an `ADMIN` or `SUPER_ADMIN` via this public endpoint.
- Duplicate email prevention: Check email existence case-insensitively and return `HTTP 409 Conflict` if the email is already registered.
- Atomic / consistent database persistence:
  - Better Auth `auth.api.signUpEmail` creates `User` and `Account` (with securely hashed password).
  - Associate and create `Customer` record (`userId`, `contactNumber`, `address`) in PostgreSQL.
- Response contract:
  - Respond with `HTTP 201 Created` using shared `sendResponse`.
  - Return sanitized user & customer profile data (`id`, `name`, `email`, `role`, `status`, `createdAt`, `customer: { contactNumber, address }`).
  - Never expose or return passwords, hashes, internal tokens, or secrets.

### Out of Scope

- Email verification sending / token dispatch (`P2-T007`).
- Login, session cookie creation, or rate-limiting for sign-in (`P2-T008`).
- Google OAuth registration (`P2-T009`).
- Admin account creation (`P2-T018`).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Validate approved name, email, password, contactNumber, address rules | Step 2 & 3 | Zod schema unit & executable contract test |
| Reject duplicate email case-insensitively with HTTP 409 | Step 3 & 4 | Duplicate registration test returning 409 Conflict |
| Always assign `CUSTOMER`, reject client privileged-role input | Step 2 & 3 | Payload injection test asserting role remains `CUSTOMER` |
| Create User, Account and Customer profile consistently returning HTTP 201 | Step 3 & 4 | End-to-end registration check verifying database rows |
| Never store or log plain-text passwords | Step 3 | Database inspection of `Account.password` hash |

---

## 3. Verified Current Codebase State

- `src/app/config/auth.ts`: Better Auth instance is configured with PostgreSQL Prisma adapter and `user.additionalFields` (`input: false` for `role`, `status`, etc.).
- `src/app/modules/auth/auth.routes.ts`: Exists and is mounted at `/api/v1/auth` in `src/app/routes/index.ts`, currently has no registered routes.
- `src/app/modules/auth/auth.controller.ts`: Empty file.
- `src/app/modules/auth/auth.service.ts`: Empty file.
- `src/app/utils/`: Shared utilities `sendResponse` and `catchAsync` are available and tested.
- `src/app/middleware/validateRequest.ts`: Shared Zod validation middleware is available and operational.
- `prisma/schema/profiles.prisma`: `Customer` model has `userId` (@id, relation to User), `contactNumber`, `address`, `createdAt`, `updatedAt`.

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  - **Route (`src/app/modules/auth/auth.routes.ts`):** Mount `POST /register` with `validateRequest(registerValidationSchema)` and route to `AuthController.registerCustomer`.
  - **Validation (`src/app/modules/auth/auth.validation.ts`):** Define `registerValidationSchema` using Zod.
  - **Controller (`src/app/modules/auth/auth.controller.ts`):** `registerCustomer` wrapped with `catchAsync`, delegates to `AuthService.registerCustomer`, calls `sendResponse` with `HTTP 201`.
  - **Service (`src/app/modules/auth/auth.service.ts`):**
    - Check case-insensitive duplicate email existence via `prisma.user.findUnique({ where: { email } })`. If found, throw `AppError(status.CONFLICT, "User with this email already exists")`.
    - Call Better Auth `auth.api.signUpEmail` passing sanitized fields (`name`, `email`, `password`) ensuring `role: UserRole.CUSTOMER` and `status: UserStatus.ACTIVE`.
    - Create `Customer` profile record linked to the newly created user ID with `contactNumber` and `address`.
    - Format and return sanitized public data.
- **Data / Schema Impact:**
  - No database schema migrations needed; existing `User`, `Account`, and `Customer` tables are fully established.
- **Public API / Contract Impact:**
  - `POST /api/v1/auth/register` becomes the official public customer registration endpoint.
- **Security & Authorization Considerations:**
  - No client-supplied role assignment (strictly `CUSTOMER`).
  - Passwords hashed securely by Better Auth using scrypt/argon2id.
  - Never return password hash in JSON response.

---

## 5. Affected Files & Directives

| Action | File Path | Responsibility |
| :----- | :-------- | :------------- |
| `[NEW]` | `src/app/modules/auth/auth.validation.ts` | Zod schema for registration payload |
| `[MODIFY]` | `src/app/modules/auth/auth.routes.ts` | Register `POST /register` endpoint with validation middleware |
| `[MODIFY]` | `src/app/modules/auth/auth.controller.ts` | Controller handler for customer registration with `catchAsync` and `sendResponse` |
| `[MODIFY]` | `src/app/modules/auth/auth.service.ts` | Service business logic orchestrating Better Auth user creation & Customer profile record |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md` | Update `P2-T006` status and resolve `P2-B001` for registration |
| `[MODIFY]` | `docs/governance/tasks/phase-2/P2-T006-implement-email-password-customer-registration.md` | Persistent JIT task plan and implementation evidence |

---

## 6. Step-by-Step Execution Plan

1. **Planning & Governance Gate (Step 1):**
   - Review and approve this JIT plan.
   - Resolve `P2-B001` (specifically for `POST /api/v1/auth/register`).
   - Mark `P2-T006` as `🔄 In progress` in phase file and `MEMORY.md`.
2. **Registration Zod Validation Schema (Step 2):**
   - Create `src/app/modules/auth/auth.validation.ts` with strict rules for name, email, password, contactNumber, address.
3. **Auth Service Implementation (Step 3):**
   - Implement `AuthService.registerCustomer` in `src/app/modules/auth/auth.service.ts`.
   - Handle case-insensitive duplicate email check (throwing 409).
   - Create User via Better Auth API and Customer profile in Prisma.
4. **Auth Controller & Route Mapping (Step 4):**
   - Implement `AuthController.registerCustomer` in `src/app/modules/auth/auth.controller.ts`.
   - Mount route in `src/app/modules/auth/auth.routes.ts`.
5. **Contract Verification & Quality Gates (Step 5):**
   - Verify validation errors on invalid email/short password.
   - Verify duplicate registration returns HTTP 409.
   - Verify role injection attempt is ignored/assigned `CUSTOMER`.
   - Verify successful registration creates User & Customer in database and returns HTTP 201.
   - Run `pnpm build` and `pnpm lint`.
6. **Self-Review & Gate Closure (Step 6):**
   - Record verification evidence in Section 10.
   - Mark task `🕵️ Awaiting human review`.

---

## 7. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :---- | :------- | :---------------- | :----- |
| Acceptance criteria | `Yes` | Section 2 mapping and diff inspection | `NOT RUN` |
| Type check / build | `Yes` | `pnpm build` | `NOT RUN` |
| Lint | `Yes` | `pnpm lint` | `NOT RUN` |
| Input validation check | `Yes` | Reject invalid email & short password | `NOT RUN` |
| Duplicate email check | `Yes` | Reject duplicate email with HTTP 409 | `NOT RUN` |
| Privilege escalation check | `Yes` | Confirm injected `role: "ADMIN"` is ignored/rejected | `NOT RUN` |
| End-to-end registration | `Yes` | Verify User & Customer database creation and HTTP 201 response | `NOT RUN` |

---

## 8. Assumptions & Blockers
 
- **Active Blockers:** None (Cleared: `P2-B001` approved `POST /api/v1/auth/register` on 2026-09-08).
- **Design Assumptions:**
  - Password minimum length is 8 characters with at least one letter and one number.
  - Name minimum length is 2 characters, maximum 100 characters.
  - Response status is HTTP 201 with public user/customer profile data.

---

## 9. Plan Review

| Field | Value |
| :---- | :---- |
| Outcome | `Approved` |
| Reviewed by | Zahidul Islam |
| Reviewed on | 2026-09-08 |
| Notes | Explicitly approved POST /api/v1/auth/register, strict Zod validation, and MVC service-driven Better Auth architecture. Step 1 Governance Gate complete. |

---

## 10. Implementation Evidence

_To be completed after code execution and before marking awaiting human review:_

- **Changed Files:** Pending
- **Migration Created:** None expected
- **Test / Verification Output:** Pending
- **Deviations from Original Plan:** Pending
- **Remaining Concerns / Follow-ups:** Pending
