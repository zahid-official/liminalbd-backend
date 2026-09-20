# Task: P2-T015 - Implement Role-Based Access Control (RBAC) Middleware Guard

> **Canonical Status:** `✅ Done`  
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-RBAC-001`, `FR-RBAC-002`, `FR-AUTH-009`  
> **ERD Reference:** `User` (`role` field), `UserRole` enum (`SUPER_ADMIN`, `ADMIN`, `CUSTOMER`)  
> **Dependencies:** `P2-T010` (✅)

---

## 1. Context & Traceability

- **Objective:** Establish a reusable, server-side authorization middleware guard (`rbacGuard`) layered on top of `authGuard` (`P2-T010`) to enforce route-level role restrictions, reject unauthorized access with `HTTP 403 Forbidden`, and guarantee that role authorization is derived exclusively from server-verified session identity context (`res.locals.user.role`).
- **PRD Alignment:**
  - `FR-RBAC-001.1`: Support the defined application roles (`SUPER_ADMIN`, `ADMIN`, `CUSTOMER`).
  - `FR-RBAC-001.4`: Enforce role-based permissions on protected operations so users perform only actions permitted by their assigned role.
  - `FR-RBAC-002.1`: Layer on valid authenticated session context from `authGuard`.
  - `FR-RBAC-002.2`: Middleware must enforce route-level role restrictions; insufficient role or permission yields `HTTP 403 Forbidden` (`PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS`).
  - `FR-RBAC-002.4`: Authorization must be enforced strictly server-side; client-side claims or payloads must never bypass backend authorization.
  - `FR-RBAC-002.5`: Extensible authorization design supporting future granular permissions without architectural rework.

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Reusable RBAC Middleware Guard (`src/app/middleware/rbacGuard.ts`):**
   - Higher-order Express middleware factory: `rbacGuard(...allowedRoles: [UserRole, ...UserRole[]]): RequestHandler`.
   - Inspect server-derived user context from `res.locals.user` injected by `authGuard`.
   - Defense-in-depth: if `res.locals.user` or `res.locals.user.role` is missing (e.g. guard mounted out of order without `authGuard`), safely reject with `HTTP 401 Unauthorized` (`PUBLIC_ERROR_CODES.UNAUTHORIZED`).
   - If the authenticated user's role is not included in `allowedRoles`, reject immediately with `HTTP 403 Forbidden` (`PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS`, message: `"You do not have permission to access this resource."`).
   - If the authenticated user's role is included in `allowedRoles`, call `next()`.
   - Strictly ignore and prohibit any client-provided role claims (such as `req.body.role`, `req.headers["x-user-role"]`, or `req.query.role`).
2. **Automated Unit Testing (`tests/unit/middleware/rbacGuard.test.ts`):**
   - Comprehensive test suite covering single-role access, multi-role access, insufficient-role rejection, defense-in-depth unauthenticated rejection, client spoofing attempt rejection, and empty-role guard edge cases.
   - Achieve 100% statement, branch, function, and line coverage.

### Out of Scope

- Audit logging of rejected privileged access attempts (strictly dedicated to `P2-T016`).
- Account status enforcement (e.g. `SUSPENDED`, `DEACTIVATED`) across protected routes (dedicated to `P2-T017`).
- Administrative account management and role mutation endpoints (`P2-T018`, `P2-T019`, `P2-T020`).
- Resource ownership validation (e.g. verifying that a Customer owns an order or inquiry) (dedicated to `P2-T022`).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Layer on `P2-T010` authenticated identity context | Step 1 | Code inspection of `res.locals.user.role` + unit test asserting integration with `authGuard` output |
| Enforce approved route roles and return HTTP 403 for insufficient access | Step 1, Step 2 | Automated unit tests asserting `HTTP 403` and `PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS` |
| Support only `SUPER_ADMIN`, `ADMIN` and `CUSTOMER` via Prisma `UserRole` enum | Step 1 | TypeScript type checking restricting parameters to `UserRole[]` |
| Attach trusted server-derived role context; never trust client role or ownership claims | Step 1, Step 2 | Unit test injecting spoofed `body.role`, `headers["x-user-role"]`, and `query.role`, confirming zero impact |
| Keep privileged and resource-specific authorization in the service layer and verify bypass attempts | Step 1, Step 2 | Unit tests verifying role boundary isolation |

---

## 3. Verified Current Codebase State

_Read-only inspection findings before execution:_

- **Current Behavior / Gaps:** `authGuard` (`src/app/middleware/authGuard.ts`) verifies session authenticity and populates `res.locals.user` and `res.locals.session`, but no authorization guard exists to restrict endpoints by role.
- **Existing Code Patterns to Follow:**
  - `src/app/middleware/validateRequest.ts` uses higher-order middleware factory returning `RequestHandler`.
  - `src/app/middleware/authGuard.ts` uses `AppError` with `status.UNAUTHORIZED` and `PUBLIC_ERROR_CODES.UNAUTHORIZED`.
  - `src/app/interfaces/express.d.ts` augments `Express.Locals` with `user?: AuthUser` where `user.role` is accessible.
  - `src/app/errors/errorCodes.ts` defines `FORBIDDEN_ROLE_ACCESS: "FORBIDDEN_ROLE_ACCESS"`.
  - Prisma generates `UserRole` enum at `src/generated/prisma/enums.js` with values `SUPER_ADMIN`, `ADMIN`, `CUSTOMER`.
- **Related Existing Files:**
  - `src/app/middleware/authGuard.ts`
  - `src/app/interfaces/express.d.ts`
  - `src/app/errors/errorCodes.ts`
  - `src/app/errors/AppError.ts`
  - `src/generated/prisma/enums.ts`

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  `Route → authGuard → rbacGuard(...allowedRoles) → Controller → Service → Repository → Prisma`
- **Middleware Logic (`src/app/middleware/rbacGuard.ts`):**
  ```typescript
  import type { NextFunction, Request, RequestHandler, Response } from "express";
  import status from "http-status";
  import { AppError } from "../errors/AppError.js";
  import { PUBLIC_ERROR_CODES } from "../errors/errorCodes.js";
  import type { UserRole } from "../../generated/prisma/enums.js";

  export const rbacGuard = (...allowedRoles: [UserRole, ...UserRole[]]): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const user = res.locals.user;

      if (!user || !user.role) {
        throw new AppError(
          status.UNAUTHORIZED,
          PUBLIC_ERROR_CODES.UNAUTHORIZED,
          "Authentication required. Please sign in.",
        );
      }

      if (!allowedRoles.includes(user.role as UserRole)) {
        throw new AppError(
          status.FORBIDDEN,
          PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
          "You do not have permission to access this resource.",
        );
      }

      next();
    };
  };
  ```
- **Security & Authorization Considerations:**
  - Strictly reads `res.locals.user.role`, which is resolved server-side from PostgreSQL via Better Auth during `authGuard`.
  - No client header, query, or body parameter is ever consulted.
  - Fail-safe default: if no role matches, execution terminates immediately with 403.
  - Defense-in-depth: missing user or role terminates with 401.

---

## 5. Affected Files & Directives

| Action     | File Path                                        | Responsibility                                                    |
| :--------- | :----------------------------------------------- | :---------------------------------------------------------------- |
| `[NEW]`    | `src/app/middleware/rbacGuard.ts`                | Role-based authorization middleware guard implementation           |
| `[NEW]`    | `tests/unit/middleware/rbacGuard.test.ts`        | Comprehensive unit tests for RBAC guard (100% coverage)          |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`    | Mark P2-T015 status `🔄 In progress` then `✅ Done`               |
| `[MODIFY]` | `docs/governance/MEMORY.md`                      | Record P2-T015 completion and updated test metrics                |

---

## 6. Step-by-Step Execution Plan

1. **Step 1:** Create `src/app/middleware/rbacGuard.ts` implementing `rbacGuard(...allowedRoles: UserRole[]): RequestHandler` using `AppError`, `PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS`, and `status.FORBIDDEN`.
2. **Step 2:** Create `tests/unit/middleware/rbacGuard.test.ts` covering all positive, negative, edge-case, and spoofing attack scenarios.
3. **Step 3:** Run test suite and coverage (`pnpm test:coverage`) to confirm 100% statement, branch, function, and line coverage.
4. **Step 4:** Run TypeScript compilation (`pnpm tsc --project tsconfig.test.json --noEmit`) and ESLint (`pnpm lint`).
5. **Step 5:** Record actual implementation evidence in Section 10 of this task file, update phase file and `MEMORY.md`, and submit for human review (`🕵️ Awaiting human review`).

---

## 7. Verification & Quality Gates

| Check                      | Required | Command or Method                                       | Result |
| :------------------------- | :------- | :------------------------------------------------------ | :----- |
| Acceptance criteria        | `Yes`    | Code review + unit test suite verification              | `PASS` |
| Type check / build         | `Yes`    | `pnpm tsc --project tsconfig.test.json --noEmit` + build| `PASS` |
| Lint                       | `Yes`    | `pnpm lint`                                             | `PASS` |
| Tests                      | `Yes`    | `pnpm test` (376/376 passed)                            | `PASS` |
| Migration / data integrity | `No`     | No schema changes                                       | `N/A`  |
| Manual verification        | `No`     | Replaced by exhaustive unit test suite                  | `N/A`  |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None
- **Design Assumptions Awaiting Approval:** None — uses standard Express middleware pattern, Prisma `UserRole` enum, and existing `PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS`.

---

## 9. Plan Review

| Field       | Value                                                              |
| :---------- | :----------------------------------------------------------------- |
| Outcome     | `Approved`                                                         |
| Reviewed by | `Zahid (Human Lead)`                                               |
| Reviewed on | `2026-09-21`                                                       |
| Notes       | `Plan approved by human lead. Proceeding with stepwise execution.` |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `src/app/middleware/rbacGuard.ts` (`[NEW]`): Implemented `rbacGuard(...allowedRoles: [UserRole, ...UserRole[]]): RequestHandler` factory enforcing compile-time non-empty role requirements and runtime server-side role authorization strictly via `res.locals.user.role` with defense-in-depth 401 handling for unauthenticated requests and 403 `FORBIDDEN_ROLE_ACCESS` rejection for unauthorized roles.
  - `tests/unit/middleware/rbacGuard.test.ts` (`[NEW]`): Added 10 exhaustive unit tests covering single-role, multi-role, 403 forbidden rejection, 401 unauthenticated defense-in-depth, and client role spoofing attack resistance.
  - `docs/governance/phases/phase-2-auth-rbac.md` (`[MODIFY]`): Task index row 14 status tracked.
  - `docs/governance/tasks/phase-2/P2-T015-implement-rbac-middleware-guard.md` (`[NEW]`): Complete JIT implementation record and evidence.
- **Migration Created:** None (`N/A` — no database schema modifications).
- **Test / Verification Output:**
  - `pnpm test:coverage tests/unit/middleware/rbacGuard.test.ts`:
    - 10/10 unit tests passed (100% Stmts, 100% Branch, 100% Funcs, 100% Lines on `rbacGuard.ts`).
  - `pnpm test`:
    - 28 test files passed, 376/376 tests passed.
  - `pnpm tsc --project tsconfig.test.json --noEmit`: 0 TypeScript type errors.
  - `pnpm lint`: 0 ESLint warnings or errors.
  - `git diff --check`: 0 whitespace issues.
- **Deviations from Original Plan:** None. Implementation strictly adheres to the approved JIT task plan.
- **Remaining Concerns / Follow-ups:** None.

