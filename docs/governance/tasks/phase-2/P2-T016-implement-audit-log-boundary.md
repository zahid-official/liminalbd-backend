# Task: P2-T016 - Implement the Audit-Log Application Boundary

> **Canonical Status:** `✅ Done`
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-RBAC-001.6`, `FR-RBAC-003.7`, `FR-RBAC-004.6`, `FR-RBAC-005.4`, `FR-RBAC-006.3`, `FR-ADMIN-001.4`, `FR-ADMIN-002.5`, `FR-CUSTOMER-004.5`  
> **ERD Reference:** `AuditLog` model, `AuditAction` enum, `AuditEntityType` enum (`prisma/schema/audit.prisma`)  
> **Dependencies:** `P2-T001` (✅), `P2-T010` (✅)

---

## 1. Context & Traceability

- **Objective:** Provide a reusable, robust persistence boundary (`AuditService`) for every Phase 2 audit event required by the PRD, supporting both standalone operations and atomic Prisma transaction execution (`$transaction`), while enforcing automated sensitive data redaction on logged payloads.
- **PRD Alignment:**
  - `FR-RBAC-001.6` & `FR-RBAC-003.7`: Role changes and Super Admin promotions/demotions must be atomic and auditable (recording actor, target, previous role, new role, action, and timestamp).
  - `FR-RBAC-004.6`: Unauthorized attempts to manage privileged accounts must be auditable (recording actor, target, attempted action, and timestamp even when rejected).
  - `FR-RBAC-005.4`: Sensitive administrative resource access must be auditable.
  - `FR-RBAC-006.3` & `FR-CUSTOMER-004.5`: Customer and Admin account status changes (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`, `SOFT_DELETE`) must be auditable.
  - `FR-ADMIN-001.4` & `FR-ADMIN-002.5`: Admin account creation and profile/lifecycle changes must be auditable.

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Audit Interface & Contracts (`src/app/shared/audit/audit.interface.ts`):**
   - Define strongly typed `CreateAuditLogInput` supporting:
     - `actorId?: string | null` (nullable for unauthenticated or system-triggered events).
     - `action: AuditAction` (using Prisma `AuditAction` enum: `CREATE`, `UPDATE`, `ROLE_CHANGE`, `SUSPEND`, `DEACTIVATE`, `REACTIVATE`, `SOFT_DELETE`, `UNAUTHORIZED_ATTEMPT`).
     - `entityType: AuditEntityType` (using Prisma `AuditEntityType` enum: `USER`, `ADMIN`, `CUSTOMER`).
     - `entityId?: string | null` (ID of affected record).
     - `previousValue?: Record<string, unknown> | null` (state before action).
     - `newValue?: Record<string, unknown> | null` (state after action).
     - `metadata?: AuditMetadata | null` (typed context with `ip`, `userAgent`, `reason`, and arbitrary extensions).
     - `tx?: Prisma.TransactionClient` (optional transactional client for atomic consistency).
2. **Audit Service Implementation (`src/app/shared/audit/audit.service.ts`):**
   - Provide `AuditService.record(input: CreateAuditLogInput): Promise<AuditLog>`.
   - **Atomic Transaction Support:** If `input.tx` is provided, execute persistence via `input.tx.auditLog.create(...)`; otherwise fallback to default `prisma.auditLog.create(...)`.
   - **Automated Sensitive Data Sanitization:** Ensure secrets, passwords (`password`, `currentPassword`, `newPassword`), tokens, and auth secrets are automatically redacted from `previousValue`, `newValue`, and `metadata` before writing to PostgreSQL.
   - **Safe Value Normalization:** Safely handle null, undefined, or empty payload values into valid Prisma JSON values.
3. **Automated Unit Testing (`tests/unit/shared/audit/audit.service.test.ts`):**
   - Test standalone record creation via default `prisma` client.
   - Test transactional record creation via `tx` client.
   - Test unauthenticated / system actor logging (`actorId: null` or omitted).
   - Test sensitive field redaction across `previousValue`, `newValue`, and `metadata`.
   - Test Prisma rejection and error bubbling.
   - Achieve 100% statement, branch, function, and line coverage.

### Out of Scope

- HTTP endpoints for querying, listing, or exporting audit logs (not in Phase 2 approved scope).
- Account status enforcement middleware (dedicated to `P2-T017`).
- Administrative account mutation routes and controllers (`P2-T018`, `P2-T019`, `P2-T020`).
- Customer account lifecycle endpoints (`P2-T026`).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Record actor, target/entity, action, previous value, new value, metadata and timestamp as applicable | Step 4, Step 5 | Unit test asserting persisted fields in Prisma `auditLog.create` call |
| Support required success and rejected-attempt events using approved ERD enums | Step 4, Step 5 | TypeScript type checking with Prisma `AuditAction` and `AuditEntityType` enums + unit tests |
| Write audit data atomically with the related state change when consistency requires it | Step 5 | Unit test supplying mock `tx` client asserting `tx.auditLog.create` execution |
| Keep audit persistence behind repository/service boundaries and exclude secrets or unnecessary sensitive data | Step 5 | Unit test injecting sensitive fields (`password`, `token`, `secret`) asserting redaction |
| Cover successful, rejected and transaction-rollback behavior | Step 6, Step 7 | Automated unit tests asserting success, error propagation, and transactional client delegation |

---

## 3. Verified Current Codebase State

_Read-only inspection findings before execution:_

- **Current Behavior / Gaps:** `audit_log` table exists in PostgreSQL via migration `20260912090148_init`. `AuditAction` and `AuditEntityType` enums exist at `src/generated/prisma/enums.js`. However, no shared service or repository exists to record audit entries.
- **Existing Code Patterns to Follow:**
  - Shared domain services live under `src/app/shared/` (e.g. `src/app/shared/email/email.service.ts`).
  - Prisma client is initialized and exported at `src/app/config/prisma.ts`.
  - Logging redaction invariants from `DEC-024` are mirrored for persistent audit security.
- **Related Existing Files:**
  - `prisma/schema/audit.prisma`
  - `src/generated/prisma/enums.ts`
  - `src/generated/prisma/models/AuditLog.ts`
  - `src/app/config/prisma.ts`

---

## 4. Implementation Approach

- **Applicable Architecture Flow:**
  `Caller (Service / Guard) → AuditService.record(input) → [tx | prisma].auditLog.create() → PostgreSQL`
- **Data & Sanitization Contract:**
  - Sanitization function recursively strips sensitive keys: `password`, `currentPassword`, `newPassword`, `token`, `secret`, `credential`, `authorization`, `cookie`, `apiKey`.
  - Nullish payload objects are normalized to `Prisma.JsonNull` or omitted if undefined.
- **Transaction Flexibility:**
  ```typescript
  const client = input.tx ?? prisma;
  return await client.auditLog.create({ data: ... });
  ```

---

## 5. Affected Files & Directives

| Action     | File Path                                                | Responsibility                                              |
| :--------- | :------------------------------------------------------- | :---------------------------------------------------------- |
| `[NEW]`    | `src/app/shared/audit/audit.interface.ts`                | Type definitions and contracts for audit log inputs         |
| `[NEW]`    | `src/app/shared/audit/audit.service.ts`                  | Reusable audit persistence service with sanitization and tx |
| `[NEW]`    | `tests/unit/shared/audit/audit.service.test.ts`          | 100% coverage unit tests for AuditService                   |
| `[NEW]`    | `docs/governance/tasks/phase-2/P2-T016-implement-audit-log-boundary.md` | Persistent JIT task plan and evidence record                |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`            | Update task 15 status `🔄 In progress` then `✅ Done`        |
| `[MODIFY]` | `docs/governance/MEMORY.md`                              | Update current-state memory upon task completion            |

---

## 6. Step-by-Step Execution Plan

1. **Step 3 (Approval & Status Update):** Obtain human approval of this JIT plan, update task status to `🔄 In progress` in task file and phase file (`phase-2-auth-rbac.md`).
2. **Step 4 (Audit Contracts):** Create `src/app/shared/audit/audit.interface.ts` defining `CreateAuditLogInput` with Prisma enums and `TransactionClient`.
3. **Step 5 (Audit Service Implementation):** Create `src/app/shared/audit/audit.service.ts` implementing `AuditService.record` with sensitive data redaction and dual client (`tx` vs `prisma`) support.
4. **Step 6 (Unit Tests):** Create `tests/unit/shared/audit/audit.service.test.ts` covering standalone, transactional, unauthenticated/system actor, sensitive redaction, and error failure paths.
5. **Step 7 (Quality Gates):** Execute `pnpm test`, `pnpm test:coverage tests/unit/shared/audit/audit.service.test.ts`, `pnpm tsc --project tsconfig.test.json --noEmit`, `pnpm lint`, and `git diff --check`.
6. **Step 8 (Review Preparation):** Fill Section 7 (Verification & Quality Gates) and Section 10 (Implementation Evidence) in this task file, update phase file status to `🕵️ Awaiting human review`, and present to human lead.
7. **Step 9 (Final Approval & Closure):** Upon human approval, mark `✅ Done` in task file, phase file, update `MEMORY.md`, and present Git commit command.

---

## 7. Verification & Quality Gates

| Check                      | Required | Command or Method                                       | Result    |
| :------------------------- | :------- | :------------------------------------------------------ | :-------- |
| Acceptance criteria        | `Yes`    | Code review + unit test suite verification              | `PASS`    |
| Type check / build         | `Yes`    | `pnpm tsc --project tsconfig.test.json --noEmit` + build| `PASS`    |
| Lint                       | `Yes`    | `pnpm lint`                                             | `PASS`    |
| Tests                      | `Yes`    | `pnpm test`                                             | `PASS`    |
| Migration / data integrity | `No`     | Existing `audit_log` table from baseline migration      | `N/A`     |
| Manual verification        | `No`     | Replaced by exhaustive unit test suite                  | `N/A`     |

---

## 8. Assumptions & Blockers

- **Active Blockers:** None.
- **Design Assumptions Awaiting Approval:**
  - Audit service placed under `src/app/shared/audit/` as a domain-agnostic cross-cutting utility (matching `src/app/shared/email/`).
  - Dual client pattern (`tx?: Prisma.TransactionClient`) enables atomic logging inside existing service transactions without forcing transactions for standalone events.

---

## 9. Plan Review

| Field       | Value                                                              |
| :---------- | :----------------------------------------------------------------- |
| Outcome     | `Approved`                                                         |
| Reviewed by | `Zahid (Human Lead)`                                               |
| Reviewed on | `2026-09-21`                                                       |
| Notes       | `JIT plan approved by human lead. Proceeding with stepwise execution.` |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `src/app/shared/audit/audit.interface.ts`: Defines `CreateAuditLogInput` and `AuditMetadata` contract.
  - `src/app/shared/audit/audit.service.ts`: Implements `AuditService.record` with dual client (`tx` vs `prisma`), recursive sensitive redaction, guard-clause flow, and junior-friendly `CreateAuditLogData` type alias.
  - `tests/unit/shared/audit/audit.service.test.ts`: 7 unit tests achieving 100% statements, branches, functions, and lines coverage.
  - `docs/governance/tasks/phase-2/P2-T016-implement-audit-log-boundary.md`: Canonical task tracking and verification record.
  - `docs/governance/phases/phase-2-auth-rbac.md`: Phase status tracking.
- **Migration Created:** None (`audit_log` table already exists in baseline migration `20260912090148_init`).
- **Test / Verification Output:**
  - `pnpm tsc --project tsconfig.test.json --noEmit`: 0 errors.
  - `pnpm lint`: 0 errors, 0 warnings.
  - `pnpm test:coverage tests/unit/shared/audit/audit.service.test.ts`: 7/7 tests passed with 100% coverage across all metrics.
  - `pnpm test`: 383/383 unit/integration tests passed across 29 test files.
- **Deviations from Original Plan:**
  - Added `AuditMetadata` interface in `audit.interface.ts` supporting typed autocomplete for `ip`, `userAgent`, and `reason`.
  - Added separator-insensitive key normalization (`key.toLowerCase().replace(/[-_]/g, "")`) to reliably catch snake_case and kebab-case secrets.
  - Refined `sanitizePayload` with early return guard clauses and adopted `CreateAuditLogData` type alias for clear readability.
- **Remaining Concerns / Follow-ups:** None. Ready for consumption by downstream RBAC and customer lifecycle tasks.

---

## 11. Final Review & Closure

| Field       | Value                                                              |
| :---------- | :----------------------------------------------------------------- |
| Final Status| `✅ Done`                                                          |
| Approved by | `Zahid (Human Lead)`                                               |
| Approved on | `2026-09-21`                                                       |
| Notes       | `Task completed and approved with 100% test coverage and strict type safety.` |
