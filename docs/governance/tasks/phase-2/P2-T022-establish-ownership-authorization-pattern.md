# Task: P2-T022 - Establish the Reusable Ownership-Authorization Pattern

> **Canonical Status:** `✅ Done`  
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-RBAC-005` (`FR-RBAC-005.1`–`FR-RBAC-005.4`)  
> **ERD Reference:** `User` model, `Customer` model, `AuditLog` model (`prisma/schema/auth.prisma`, `prisma/schema/profiles.prisma`, `prisma/schema/audit.prisma`)  
> **Dependencies:** `P2-T010` (✅ Session and auth guard), `P2-T015` (✅ RBAC guard), `P2-T016` (✅ Audit log boundary)  
> **Blockers:** None  

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T022`
- **PRD / Requirement Reference:**
  - `FR-RBAC-005.1`: Customers may only access or modify resources they own. Cross-account access or modification attempts must be rejected with `HTTP 403 Forbidden`.
  - `FR-RBAC-005.2`: Customer-owned resources must be validated against the authenticated user identity server-side (profile, inquiries, cart, orders, and account data).
  - `FR-RBAC-005.3`: Administrative access must follow assigned permissions and explicit authorization policies rather than unconditional blind role bypass.
  - `FR-RBAC-005.4`: Unauthorized cross-customer access attempts and sensitive administrative access must be auditable with actor, resource, action, and timestamp.
- **ERD Reference:** `User` and `Customer` in `prisma/schema/`, `AuditLog` in `prisma/schema/audit.prisma`.
- **Dependencies:** `P2-T010` (Authenticated session context), `P2-T015` (Role definitions and RBAC guard), `P2-T016` (Audit logging service boundary).

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

- Register `FORBIDDEN_ACCESS` in `src/app/errors/errorCodes.ts` for clean distinction between route-level role failure (`FORBIDDEN_ROLE_ACCESS`) and resource ownership authorization failure (`FORBIDDEN_ACCESS`).
- Create reusable interface contracts in `src/app/shared/authorization/authorization.interface.ts`:
  - `OwnershipPolicy`: Configurable permissions for administrative roles (`allowAdmin?: boolean`, `allowSuperAdmin?: boolean`, `allowedRoles?: UserRole[]`).
  - `AuthorizeOwnershipInput`: Strongly-typed input contract containing `actorId`, `actorRole`, `resourceOwnerId`, `resourceType`, `resourceId?`, `action`, and `policy?`.
- Implement `AuthorizationService.authorizeOwnership` in `src/app/shared/authorization/authorization.service.ts`:
  - Enforce Customer ownership: If `actorRole === UserRole.CUSTOMER`, verify `actorId === resourceOwnerId`. If mismatched, record an audit event (`AuditAction.UNAUTHORIZED_ATTEMPT`) via `AuditService.createLog` and throw `AppError(status.FORBIDDEN, PUBLIC_ERROR_CODES.FORBIDDEN_ACCESS, ...)`.
  - Enforce Scoped Administrative Access: If actor is `ADMIN` or `SUPER_ADMIN`, evaluate against explicit `OwnershipPolicy` rather than blind bypass. If policy disallows administrative access for the operation, record `AuditAction.UNAUTHORIZED_ATTEMPT` and throw `HTTP 403 Forbidden`.
  - Ensure zero reliance on client-side route middleware: All ownership logic executes strictly within the service boundary as defense-in-depth.
- Implement exhaustive unit tests in `tests/unit/shared/authorization/authorization.service.test.ts` proving:
  - Customer accessing owned resource succeeds without error.
  - Cross-customer access is rejected with `HTTP 403 Forbidden` and audited.
  - Administrative roles succeed when policy permits.
  - Administrative roles are rejected and audited when policy disallows them.
  - Route middleware bypass cannot bypass service ownership checks.
  - Clean audit log payload with sanitized metadata.

### Out of Scope

- Specific Customer profile retrieval endpoints (`P2-T023`).
- Customer profile update endpoints (`P2-T024`).
- Customer list operations (`P2-T025`).
- Customer account lifecycle management (`P2-T026`).
- Database schema changes or migrations (uses existing models and enums).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Derive ownership from authenticated server-side identity and persisted resource owner | Step 4, Step 5 | Unit tests in `authorization.service.test.ts` |
| Return HTTP 403 for cross-customer access or mutation | Step 5 | Unit tests in `authorization.service.test.ts` |
| Apply explicit administrative permission checks rather than unconditional role bypass | Step 4, Step 5 | Unit tests in `authorization.service.test.ts` |
| Support required sensitive-access audit events (`AuditAction.UNAUTHORIZED_ATTEMPT`) | Step 5 | Unit tests in `authorization.service.test.ts` asserting `AuditService.createLog` calls |
| Provide focused verification proving middleware bypass cannot bypass service ownership checks | Step 6 | Dedicated unit test asserting service layer rejection independent of Express middleware |

---

## 3. Verified Current Codebase State

- **Current Behavior / Gaps:**
  - Route-level role guards exist (`rbacGuard` in `src/app/middleware/rbacGuard.ts`).
  - Account service exists for status updates and soft-deletion (`src/app/shared/account/`).
  - Audit logging service exists (`src/app/shared/audit/audit.service.ts`).
  - No centralized, reusable ownership-authorization helper or service exists under `src/app/shared/authorization/`.
- **Existing Code Patterns to Follow:**
  - Shared services live in `src/app/shared/<domain>/` with `<domain>.interface.ts` and `<domain>.service.ts`.
  - Clean optional properties standard: declare `field?: T;`, never `field?: T | undefined;`. Under `exactOptionalPropertyTypes`, omit absent properties cleanly.
  - Defense-in-depth: Services check actor permissions and record `AuditAction.UNAUTHORIZED_ATTEMPT` on violation before throwing `AppError(status.FORBIDDEN, ...)`.
- **Related Existing Files:**
  - `src/app/shared/audit/audit.service.ts`
  - `src/app/shared/audit/audit.interface.ts`
  - `src/app/errors/AppError.ts`
  - `src/app/errors/errorCodes.ts`
  - `src/generated/prisma/enums.ts`

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  `Caller Service (e.g. CustomerService) → AuthorizationService.authorizeOwnership() → AuditService.createLog (on failure or sensitive action) → AppError (if unauthorized)`
- **Data / Schema Impact:**
  - Zero database schema changes. Uses existing `AuditLog` model and `AuditAction.UNAUTHORIZED_ATTEMPT`, `AuditEntityType` enums.
- **Public API / Contract Impact:**
  - Adds `FORBIDDEN_ACCESS: "FORBIDDEN_ACCESS"` to `PUBLIC_ERROR_CODES`.
- **Security & Authorization Considerations:**
  - Strict server-side verification: `actorId` and `actorRole` must come from trusted session context (`res.locals.user`), while `resourceOwnerId` comes from database lookup.
  - Defense-in-depth: Even if a client bypasses route guards, the service layer rejects cross-customer and unauthorized administrative operations.
  - Audit trails: Every unauthorized attempt records actor, target resource ID, resource type, attempted action, and reason.

---

## 5. Affected Files & Directives

| Action     | File Path                                                                   | Responsibility |
| :--------- | :-------------------------------------------------------------------------- | :------------- |
| `[NEW]`    | `docs/governance/tasks/phase-2/P2-T022-establish-ownership-authorization-pattern.md` | JIT task plan and implementation evidence |
| `[MODIFY]` | `src/app/errors/errorCodes.ts`                                               | Register `FORBIDDEN_ACCESS` error code |
| `[NEW]`    | `src/app/shared/authorization/authorization.interface.ts`                   | Interface contracts for ownership authorization and policies |
| `[NEW]`    | `src/app/shared/authorization/authorization.service.ts`                     | Reusable authorization service with ownership check and audit logging |
| `[NEW]`    | `tests/unit/shared/authorization/authorization.service.test.ts`              | Unit tests verifying ownership, admin policies, audit logs, and bypass protection |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`                               | Update task status from `🔲` to `🔄` then `🕵️` / `✅` |
| `[MODIFY]` | `docs/governance/MEMORY.md`                                                 | Record completion of P2-T022 |

---

## 6. Step-by-Step Execution Plan

1. **Step 1: Read-Only Pre-Planning Inspection** (Completed)
   - Inspect requirement definitions, architecture guidelines, and existing shared services.
2. **Step 2: JIT Task Plan Creation & Human Review** (Completed)
   - Draft `docs/governance/tasks/phase-2/P2-T022-establish-ownership-authorization-pattern.md` and present to user for approval.
3. **Step 3: Planning Gate & Status Update** (Completed)
   - Upon explicit approval, update `phase-2-auth-rbac.md` and task file status to `🔄 In progress`.
4. **Step 4: Error Code Registration & Interface Definition** (Completed)
   - Add `FORBIDDEN_ACCESS` in `src/app/errors/errorCodes.ts`.
   - Create `src/app/shared/authorization/authorization.interface.ts` with `OwnershipPolicy` and `AuthorizeOwnershipInput`.
5. **Step 5: Authorization Service Implementation** (Completed)
   - Implement `AuthorizationService.authorizeOwnership` in `src/app/shared/authorization/authorization.service.ts`.
6. **Step 6: Unit Test Suite Implementation** (Completed)
   - Implement comprehensive Vitest tests in `tests/unit/shared/authorization/authorization.service.test.ts`.
7. **Step 7: Verification & Quality Gates Execution** (Completed)
   - Execute `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test:coverage`.
8. **Step 8: Review & Closure Preparation** (Completed)
   - Update evidence in JIT task file, mark `🕵️ Awaiting human review`, and present to user for final approval.

---

## 7. Verification & Quality Gates

| Check                      | Required | Command or Method                        | Result |
| :------------------------- | :------- | :--------------------------------------- | :----- |
| Acceptance criteria        | `Yes`    | Inspection against FR-RBAC-005 criteria  | `PASS` |
| Type check / build         | `Yes`    | `pnpm build` or `pnpm tsc --noEmit`      | `PASS` |
| Lint                       | `Yes`    | `pnpm lint`                              | `PASS` |
| Tests                      | `Yes`    | `pnpm test tests/unit/shared/authorization` | `PASS` |
| Migration / data integrity | `No`     | Schema unchanged                         | `N/A`  |
| Manual verification        | `No`     | Automated test suite covers all criteria | `N/A`  |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None.
- **Design Assumptions Awaiting Approval:**
  - `OwnershipPolicy` allows defaults: `allowAdmin: false` (or explicitly configured by caller), `allowSuperAdmin: true`. This ensures administrative access is never an accidental bypass, adhering strictly to `FR-RBAC-005.3`.

---

## 9. Plan Review

| Field       | Value                                |
| :---------- | :----------------------------------- |
| Outcome     | `Approved`                           |
| Reviewed by | `Human (Product/Architecture Owner)` |
| Reviewed on | `2026-09-24`                         |
| Notes       | Approved to proceed with implementation |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `src/app/errors/errorCodes.ts`: Registered `FORBIDDEN_ACCESS` error code for resource-level authorization failures.
  - `src/app/shared/authorization/authorization.interface.ts`: Created `OwnershipPolicy` and `AuthorizeOwnershipInput` interface contracts with clean optional property standard (`exactOptionalPropertyTypes`).
  - `src/app/shared/authorization/authorization.service.ts`: Implemented `AuthorizationService.authorizeOwnership` with `isAuthorizedRole` policy evaluation and `AuditAction.UNAUTHORIZED_ATTEMPT` logging before throwing 403 `FORBIDDEN_ACCESS`.
  - `tests/unit/shared/authorization/authorization.service.test.ts`: 16 exhaustive unit tests covering owner access, cross-customer rejection, Super Admin / Admin policies, allow-lists, optional fields, and route guard bypass protection.
  - `docs/governance/phases/phase-2-auth-rbac.md`: Task index updated to `🕵️`.
- **Migration Created:** None (Existing Prisma models and enums satisfy all requirements).
- **Test / Verification Output:**
  - Vitest Authorization Service: 16/16 tests passing with 100% statement, branch, function, and line coverage.
  - Full Repository Test Suite: 523/523 tests passing across all 37 test files with 0 failures.
  - Quality Gates: `pnpm tsc --noEmit` (PASS), `pnpm lint` (PASS), `pnpm build` (PASS).
- **Deviations from Original Plan:**
  - Omitted `index.ts` from `src/app/shared/authorization/` to maintain exact consistency with sibling shared services (`shared/account/`, `shared/audit/`).
  - Omitted speculative `metadata` property from `AuthorizeOwnershipInput` in adherence to KISS and YAGNI.
  - Streamlined `isAuthorizedRole` using clear boolean checks (`!== false`, `=== true`) rather than nullish coalescing flags.
- **Remaining Concerns / Follow-ups:** None.
