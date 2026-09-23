# Task: P2-T020 - Enforce and Audit Admin Restrictions on Privileged Accounts

> **Canonical Status:** `🔄 In progress`  
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-RBAC-004` (`FR-RBAC-004.1`–`FR-RBAC-004.6`), `FR-ADMIN-002.3`, `FR-RBAC-001.5`  
> **ERD Reference:** `AuditLog` model, `User` model, `Admin` model (`prisma/schema/audit.prisma`, `prisma/schema/auth.prisma`, `prisma/schema/profiles.prisma`)  
> **Dependencies:** `P2-T016` (✅ Audit-log application boundary), `P2-T018` (✅ Super Admin creation of Admin accounts), `P2-T019` (✅ Privileged profile, role and status management)  
> **Blockers:** `P2-B001` (Public API paths & contracts - RESOLVED)  

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T020`
- **PRD / Requirement Reference:**
  - `FR-RBAC-004.1`: Admin cannot create privileged accounts (`ADMIN` or `SUPER_ADMIN`). Attempts receive `HTTP 403 Forbidden`.
  - `FR-RBAC-004.2`: Admin cannot manage other Admin accounts (modify, suspend, deactivate, or remove). Attempts receive `HTTP 403 Forbidden`.
  - `FR-RBAC-004.3`: Admin cannot manage Super Admin accounts (modify, suspend, deactivate, or remove). Attempts receive `HTTP 403 Forbidden`.
  - `FR-RBAC-004.4`: Admin cannot change the role of another privileged account (`ADMIN ↔ SUPER_ADMIN`). Attempts receive `HTTP 403 Forbidden`.
  - `FR-RBAC-004.5`: Admin cannot modify their own role. Attempts receive `HTTP 403 Forbidden`.
  - `FR-RBAC-004.6`: Unauthorized attempts to manage privileged accounts must be auditable (Actor, target, attempted action, and timestamp are recorded even when the request is rejected).
  - `FR-ADMIN-002.3`: Admin cannot modify another Admin or any Super Admin account (`HTTP 403 Forbidden`).
  - `FR-RBAC-001.5`: Users must not be able to modify their own role; self-promotion and self-demotion are rejected.
- **ERD Reference:** `AuditLog` model, `User` model, `Admin` model (`prisma/schema/audit.prisma`, `prisma/schema/auth.prisma`, `prisma/schema/profiles.prisma`).
- **Dependencies:** `P2-T016`, `P2-T018`, `P2-T019`.

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Audit Logging of Unauthorized Privileged Account Creation (`FR-RBAC-004.1`, `FR-RBAC-004.6`):**
   - When a non-Super Admin (`ADMIN` or `CUSTOMER`) attempts to invoke `AdminService.createAdmin`, record a security audit event with `action: AuditAction.UNAUTHORIZED_ATTEMPT`, `entityType: AuditEntityType.ADMIN`, `actorId`, and metadata `{ attemptedAction: "CREATE_ADMIN", attemptedRole: "ADMIN", reason: "FORBIDDEN_ROLE_ACCESS" }` prior to throwing `AppError(status.FORBIDDEN, PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS, ...)`.
2. **Audit Logging of Unauthorized Privileged Account Management (`FR-RBAC-004.2`–`FR-RBAC-004.4`, `FR-RBAC-004.6`, `FR-ADMIN-002.3`):**
   - When a non-Super Admin (`ADMIN` or `CUSTOMER`) attempts to invoke `AdminService.updateAdmin`, record a security audit event with `action: AuditAction.UNAUTHORIZED_ATTEMPT`, `entityType: AuditEntityType.ADMIN`, `actorId`, `entityId: targetId`, and metadata `{ attemptedAction: "UPDATE_ADMIN", attemptedPayload: payload, reason: "FORBIDDEN_ROLE_ACCESS" }` prior to throwing `AppError(status.FORBIDDEN, PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS, ...)`.
3. **Audit Logging of Self-Role Mutation & Self-Lockout (`FR-RBAC-004.5`, `FR-RBAC-001.5`, `FR-RBAC-004.6`):**
   - When any privileged user attempts to mutate their own role (`actorId === targetId && payload.role !== undefined`), record an audit event with `action: AuditAction.UNAUTHORIZED_ATTEMPT`, `entityType: AuditEntityType.ADMIN`, `actorId`, `entityId: targetId`, and metadata `{ attemptedAction: "SELF_ROLE_MUTATION", attemptedRole: payload.role, reason: "SELF_ROLE_MUTATION_FORBIDDEN" }` prior to throwing `400 Bad Request` (`PUBLIC_ERROR_CODES.VALIDATION_ERROR`).
   - When a Super Admin attempts to suspend or deactivate their own account (`actorId === targetId && payload.status && payload.status !== UserStatus.ACTIVE`), record an audit event with `action: AuditAction.UNAUTHORIZED_ATTEMPT`, `entityType: AuditEntityType.ADMIN`, `actorId`, `entityId: targetId`, and metadata `{ attemptedAction: "SELF_LOCKOUT_ATTEMPT", attemptedStatus: payload.status, reason: "SELF_LOCKOUT_FORBIDDEN" }` prior to throwing `400 Bad Request` (`PUBLIC_ERROR_CODES.VALIDATION_ERROR`).
4. **Service Boundary Defense-in-Depth:**
   - Restrictions and security audit logging are enforced directly within the Service layer methods (`AdminService.createAdmin`, `AdminService.updateAdmin`), guaranteeing complete enforcement even if route middleware (`rbacGuard`) is bypassed or when methods are invoked from internal orchestration services.
5. **Automated Unit Testing & Verification:**
   - 100% statement, branch, function, and line coverage across `src/app/modules/admin/admin.service.ts` verifying that unauthorized attempts and self-role mutations record `AuditAction.UNAUTHORIZED_ATTEMPT` before throwing appropriate HTTP errors.

### Out of Scope

- Modifying route definitions or middleware handlers (routes are already protected by `authGuard` and `rbacGuard(UserRole.SUPER_ADMIN)`).
- Customer lifecycle operations (`P2-T026`).
- Admin listing query operations (`P2-T021`).
- Modifying Prisma schema (existing `AuditAction.UNAUTHORIZED_ATTEMPT` enum in `prisma/schema/audit.prisma` fully satisfies all data requirements).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Reject Admin attempts to create privileged accounts with HTTP 403 | Step 4 | Unit tests in `admin.service.test.ts` |
| Reject Admin attempts to modify, suspend, deactivate, or change role of privileged accounts with HTTP 403 | Step 4 | Unit tests in `admin.service.test.ts` |
| Reject every user's self-role mutation | Step 4 | Unit tests in `admin.service.test.ts` |
| Enforce restrictions in services even if route middleware is bypassed | Step 4 | Direct service invocation tests in `admin.service.test.ts` |
| Audit rejected privileged-management attempts with actor, target, action, and timestamp | Step 4 | Unit tests asserting `AuditService.record` with `AuditAction.UNAUTHORIZED_ATTEMPT` |

---

## 3. Verified Current Codebase State

- **Current Behavior / Gaps:**
  - `AdminService.createAdmin` currently throws `403 FORBIDDEN_ROLE_ACCESS` without persisting an audit log for rejected attempts.
  - `AdminService.updateAdmin` currently throws `403 FORBIDDEN_ROLE_ACCESS` without persisting an audit log for rejected attempts.
  - Self-role mutation and self-lockout checks throw `400 VALIDATION_ERROR` without recording an audit log.
- **Existing Code Patterns to Follow:**
  - `AuditService.record` in `src/app/shared/audit/audit.service.ts` supports `AuditAction.UNAUTHORIZED_ATTEMPT` and takes `actorId`, `entityType`, `entityId`, `metadata`, and optional `tx`.
  - `src/app/modules/admin/admin.service.ts` and `admin.interface.ts`.

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  - Route (`POST /admins`, `PATCH /admins/:id`) → Controller (`createAdmin`, `updateAdmin`) → **Service (`AdminService.createAdmin`, `AdminService.updateAdmin`)** → **Audit Boundary (`AuditService.record`)** → Database (`AuditLog`).
- **Data / Schema Impact:**
  - No database migration required; `AuditAction.UNAUTHORIZED_ATTEMPT` is already defined in `prisma/schema/audit.prisma`.
- **Public API / Contract Impact:**
  - HTTP error contracts (`403 Forbidden` for non-Super Admin, `400 Bad Request` for self-mutation) remain unchanged. Response payload structure is preserved.
- **Security & Authorization Considerations:**
  - Guaranteeing security audit logging for rejected privileged access provides full SIEM observability and forensic auditing against privilege escalation attempts (`FR-RBAC-004.6`).
  - Audit writes for rejected attempts use standard `prisma` client (or caller `tx` if passed), ensuring audit records persist even if the main operation fails or aborts.

---

## 5. Affected Files & Directives

| Action     | File Path                                                                             | Responsibility |
| :--------- | :------------------------------------------------------------------------------------ | :------------- |
| `[MODIFY]` | `src/app/modules/admin/admin.service.ts`                                              | Integrate `AuditService.record` with `UNAUTHORIZED_ATTEMPT` on authorization and self-mutation rejections |
| `[MODIFY]` | `tests/unit/modules/admin/admin.service.test.ts`                                      | Update unit tests asserting `AuditService.record` on rejected attempts |
| `[NEW]`    | `docs/governance/tasks/phase-2/P2-T020-enforce-and-audit-admin-restrictions.md`        | Persistent JIT task plan and implementation evidence |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`                                         | Track task status `🔲` → `🔄` → `🕵️` → `✅` |
| `[MODIFY]` | `docs/governance/MEMORY.md`                                                           | Synchronize active state and project dashboard |

---

## 6. Step-by-Step Execution Plan

1. **Step 1 (Pre-planning Read-Only Inspection):** Inspect requirements, audit schema, and service boundaries. [Done]
2. **Step 2 (Draft JIT Task Plan):** Create persistent task plan `docs/governance/tasks/phase-2/P2-T020-enforce-and-audit-admin-restrictions.md`. [Current]
3. **Step 3 (Human Approval & Status Update):** Obtain human lead approval, update parent phase file and task file status to `🔄 In progress`.
4. **Step 4 (Service Layer Enforcement):** Update `AdminService.createAdmin` and `AdminService.updateAdmin` in `admin.service.ts` to record `AuditAction.UNAUTHORIZED_ATTEMPT` audit logs before throwing `403 FORBIDDEN` or `400 BAD REQUEST`.
5. **Step 5 (Automated Unit Testing):** Update unit tests in `tests/unit/modules/admin/admin.service.test.ts` to verify rejected-attempt audit logging across all unauthorized paths.
6. **Step 6 (Quality Gates):** Run `pnpm test:coverage`, `pnpm tsc --noEmit`, `pnpm lint`, and `git diff --check`.
7. **Step 7 (Review Preparation):** Complete Section 7 & 10 in JIT task file, mark status `🕵️ Awaiting human review`.
8. **Step 8 (Final Closure):** Obtain human lead approval, mark `✅ Done`, update `MEMORY.md`, `phase-2-auth-rbac.md`, and propose git commit.

---

## 7. Verification & Quality Gates

| Check                      | Required | Command or Method                          | Result    |
| :------------------------- | :------- | :----------------------------------------- | :-------- |
| Acceptance criteria        | `Yes`    | Code review + unit test suite verification | `NOT RUN` |
| Type check / build         | `Yes`    | `pnpm tsc --noEmit`                        | `NOT RUN` |
| Lint                       | `Yes`    | `pnpm lint`                                | `NOT RUN` |
| Tests                      | `Yes`    | `pnpm test:coverage`                       | `NOT RUN` |
| Migration / data integrity | `No`     | Uses existing Prisma schema enums          | `N/A`     |
| Manual verification        | `No`     | Replaced by exhaustive unit test suites    | `N/A`     |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None (`P2-B001` resolved).
- **Design Assumptions:**
  - Audit logging for unauthorized attempts is critical for security monitoring. The audit log must record `action: AuditAction.UNAUTHORIZED_ATTEMPT`, `entityType: AuditEntityType.ADMIN`, actor ID, and metadata with the attempted operation and reason.

---

## 9. Plan Review

| Field       | Value                                                              |
| :---------- | :----------------------------------------------------------------- |
| Outcome     | `Approved`                                                         |
| Reviewed by | `Zahid (Human Lead)`                                               |
| Reviewed on | `2026-09-23`                                                       |
| Notes       | `JIT plan approved by human lead. Proceeding with stepwise execution.` |

---

## 10. Implementation Evidence

_To be completed after code execution and before marking awaiting human review:_

- **Changed Files:**
- **Migration Created:**
- **Test / Verification Output:**
- **Deviations from Original Plan:**
- **Remaining Concerns / Follow-ups:**
