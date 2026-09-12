# Task: P2-T001 - Establish the Phase 2 Prisma Schema and Initial Migration Baseline

> **Canonical Status:** `✅ Done` (tracked authoritatively in the parent phase file)
> **Planning Gate:** Draft Plan → Human Approval → `🔄 In progress` → Implementation & Verification Complete → `🕵️ Awaiting human review` → `✅ Done`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T001`
- **Requirement References:** Phase 2 ERD; `FR-RBAC-001`; `FR-RBAC-006`; `DEC-011`
- **ERD Coverage:** `User`, `Account`, `Session`, `Verification`, `Admin`, `Customer`, `AuditLog`, `UserRole`, `UserStatus`, `AuditAction`, `AuditEntityType`
- **Dependencies:** None
- **Resolved Blocker:** `P2-B006` under `DEC-011`

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

- Define the complete approved Phase 2 ERD contract under the configured `prisma/schema/` schema root.
- Create and apply the first canonical migration to an approved, clean, isolated development database.
- Generate Prisma Client at the configured `src/generated/prisma` output.
- Verify the schema, generated migration, database structure and existing build/lint compatibility.
- Preserve the Better Auth core-model contract without installing or configuring Better Auth in this task.

### Out of Scope

- Better Auth installation, configuration or runtime authentication behavior (`P2-T005`).
- Services, repositories, controllers, middleware, routes or public API behavior.
- Docker, Jest or Winston changes, now deferred under `DEC-013`.
- Seed data, initial `SUPER_ADMIN` provisioning or account/profile creation flows.
- Any model, field, enum, index or business rule outside the approved Phase 2 ERD.
- Resetting a database or rewriting migration history.

### Schema Contract

The following field contract is the approved implementation contract for this task.

| Model          | Fields and constraints                                                                                                                                                                                                                                                                                                                 |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`         | `id String @id`; `name String`; `email String @unique`; `emailVerified Boolean @default(false)`; `image String?`; `role UserRole @default(CUSTOMER)`; `status UserStatus @default(ACTIVE)`; `needPasswordChange Boolean @default(false)`; `deletedAt DateTime?`; `createdAt DateTime @default(now())`; `updatedAt DateTime @updatedAt` |
| `Account`      | `id String @id`; `userId String`; `accountId String`; `providerId String`; `accessToken String?`; `refreshToken String?`; `accessTokenExpiresAt DateTime?`; `refreshTokenExpiresAt DateTime?`; `scope String?`; `idToken String?`; `password String?`; `createdAt DateTime @default(now())`; `updatedAt DateTime @updatedAt`           |
| `Session`      | `id String @id`; `userId String`; `token String @unique`; `expiresAt DateTime`; `ipAddress String?`; `userAgent String?`; `createdAt DateTime @default(now())`; `updatedAt DateTime @updatedAt`                                                                                                                                        |
| `Verification` | `id String @id`; `identifier String`; `value String`; `expiresAt DateTime`; `createdAt DateTime @default(now())`; `updatedAt DateTime @updatedAt`                                                                                                                                                                                      |
| `Admin`        | `userId String @id`; `contactNumber String?`; `address String?`; `createdAt DateTime @default(now())`; `updatedAt DateTime @updatedAt`                                                                                                                                                                                                 |
| `Customer`     | `userId String @id`; `contactNumber String?`; `address String?`; `createdAt DateTime @default(now())`; `updatedAt DateTime @updatedAt`                                                                                                                                                                                                 |
| `AuditLog`     | `id String @id @default(uuid())`; `actorId String?`; `action AuditAction`; `entityType AuditEntityType`; `entityId String?`; `previousValue Json?`; `newValue Json?`; `metadata Json?`; `createdAt DateTime @default(now())`                                                                                                           |

| Enum              | Approved values                                                                                                 |
| :---------------- | :-------------------------------------------------------------------------------------------------------------- |
| `UserRole`        | `SUPER_ADMIN`, `ADMIN`, `CUSTOMER`                                                                              |
| `UserStatus`      | `ACTIVE`, `SUSPENDED`, `DEACTIVATED`                                                                            |
| `AuditAction`     | `CREATE`, `UPDATE`, `ROLE_CHANGE`, `SUSPEND`, `DEACTIVATE`, `REACTIVATE`, `SOFT_DELETE`, `UNAUTHORIZED_ATTEMPT` |
| `AuditEntityType` | `USER`, `ADMIN`, `CUSTOMER`                                                                                     |

### Relation and Storage Contract

| Relation            | Cardinality                                     | Referential action   |
| :------------------ | :---------------------------------------------- | :------------------- |
| `User` → `Account`  | One-to-many                                     | `onDelete: Cascade`  |
| `User` → `Session`  | One-to-many                                     | `onDelete: Cascade`  |
| `User` → `Admin`    | Optional one-to-one through `Admin.userId`      | `onDelete: Restrict` |
| `User` → `Customer` | Optional one-to-one through `Customer.userId`   | `onDelete: Restrict` |
| `User` → `AuditLog` | One-to-many through optional `AuditLog.actorId` | `onDelete: SetNull`  |

- `User`, `Account`, `Session` and `Verification` IDs have no Prisma database default. Better Auth supplies their IDs when its approved integration is implemented.
- `AuditLog.id` uses the ERD-defined Prisma Client-generated UUID default (`@default(uuid())`).
- `Admin.userId` and `Customer.userId` are both primary and foreign keys.
- Prisma model and field names follow the ERD. Do not add physical table or column mappings unless an approved requirement requires them.
- Add only uniqueness rules explicitly required by the ERD: `User.email` and `Session.token`. Do not add speculative indexes in this baseline.

### Better Auth Compatibility Boundary

- The core `User`, `Account`, `Session` and `Verification` fields must remain compatible with the approved Better Auth integration.
- This task does not run the Better Auth schema generator because Better Auth and its configuration are not approved or installed until `P2-T005`.
- During `P2-T005`, validate this baseline against the exact approved Better Auth version and configuration before runtime integration. Stop and reconcile through governance if the generated contract conflicts with the approved ERD.
- Configure `role`, `status`, `needPasswordChange` and `deletedAt` as server-owned fields that client/provider input cannot set when Better Auth is configured.

### Acceptance Criteria Mapping

| Acceptance Criterion                                                                                                | Planned Step | Verification                                                                                    |
| :------------------------------------------------------------------------------------------------------------------ | :----------- | :---------------------------------------------------------------------------------------------- |
| Every approved entity, field, enum, relationship, timestamp, unique constraint and soft-delete field is represented | Step 2       | ERD-to-schema checklist and `prisma validate`                                                   |
| Better Auth core database structures are present without parallel authentication mechanics                          | Step 2       | Core-model contract inspection                                                                  |
| Legacy test-only artifacts are absent                                                                               | Step 1       | Repository and target-database inventory                                                        |
| Schema formats and validates                                                                                        | Step 3       | `pnpm exec prisma format`; `pnpm exec prisma validate`                                          |
| First canonical migration is generated and applied to the approved clean database                                   | Step 4       | Migration command, SQL inspection and migration-table query                                     |
| Prisma Client generates at the configured output                                                                    | Step 5       | `pnpm exec prisma generate` and output inspection                                               |
| Resulting database matches the ERD contract                                                                         | Step 6       | PostgreSQL catalog queries for tables, columns, enums, keys, uniqueness and foreign-key actions |
| Generated migration SQL and Prisma Client remain generated artifacts                                                | Steps 4-5    | Git diff and file-history inspection                                                            |

---

## 3. Verified Current Codebase State

- `prisma.config.ts` now uses `prisma/schema` as the schema root, `prisma/migrations` as the migration path and `DATABASE_URL` as the datasource URL.
- `prisma/schema/schema.prisma` contains the PostgreSQL datasource and Prisma Client generator; its relative output resolves to `src/generated/prisma`.
- The former root-level `prisma/schema.prisma` and generated client based on the discarded test schema have been removed. Successful generation in Step 5 must recreate the client from the approved Phase 2 schema.
- `src/app/config/prisma.ts` imports the generated client and uses `@prisma/adapter-pg`.
- At the time of `P2-T001`, Better Auth was not installed or configured; it was subsequently configured and verified under `P2-T005`.
- Legacy test migration files are absent from the repository.
- The database inspected and reset for `DEC-011` had zero migration records and no business tables. That observation does not prove that another developer's current `DATABASE_URL` is safe to migrate.
- The test script is an approved temporary failing placeholder under `DEC-013`.

---

## 4. Implementation Approach

- **Architecture Flow:** `Prisma schema → Prisma Migrate → PostgreSQL → generated Prisma Client`
- **Public API Impact:** None.
- **Security Impact:** The database defaults enforce public-user role and active-state baselines; authorization remains application-owned and is implemented in later tasks.
- **Deletion Policy:** Business users remain soft-deleted through `User.deletedAt`. `Restrict` protects one-to-one business profiles from accidental parent deletion; auth-dependent `Account` and `Session` rows may cascade only if an explicitly authorized hard deletion ever occurs; audit history survives actor deletion through `SetNull`.
- **Migration Policy:** Generate the migration with Prisma CLI and inspect it; never hand-edit the generated SQL or Prisma Client output.

---

## 5. Affected Files & Directives

| Action                        | File Path                                                                                       | Responsibility                                                           |
| :---------------------------- | :---------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| `[VERIFY, EXISTING CHANGE]`   | `prisma.config.ts`                                                                              | Directory-based schema root, migration path and datasource configuration |
| `[DELETE, EXISTING CHANGE]`   | `prisma/schema.prisma`                                                                          | Remove the superseded single-file schema location                        |
| `[VERIFY, EXISTING CHANGE]`   | `prisma/schema/schema.prisma`                                                                   | Datasource and Prisma Client generator                                   |
| `[NEW]`                       | `prisma/schema/auth.prisma`                                                                     | `User`, `Account`, `Session`, `Verification`, `UserRole`, `UserStatus`   |
| `[NEW]`                       | `prisma/schema/profiles.prisma`                                                                 | `Admin` and `Customer` profiles                                          |
| `[NEW]`                       | `prisma/schema/audit.prisma`                                                                    | `AuditLog`, `AuditAction`, `AuditEntityType`                             |
| `[NEW, GENERATED]`            | `prisma/migrations/<timestamp>_init_phase_2/migration.sql`                                      | First canonical migration                                                |
| `[NEW, GENERATED IF CREATED]` | `prisma/migrations/migration_lock.toml`                                                         | Prisma migration provider lock                                           |
| `[REGENERATE]`                | `src/generated/prisma/**`                                                                       | Prisma Client output; never hand-edit                                    |
| `[DELETE, REVIEW CHANGE]`     | `Dockerfile`                                                                                    | Defer unapproved Docker configuration under `DEC-012`                    |
| `[DELETE, REVIEW CHANGE]`     | `.dockerignore`                                                                                 | Remove the deferred Docker-specific ignore configuration                 |
| `[MODIFY, REVIEW CHANGE]`     | `docs/governance/02-ARCHITECTURE.md`                                                            | Remove the deferred file from the current layout                         |
| `[MODIFY, REVIEW CHANGE]`     | `docs/governance/phases/phase-1-foundation.md`                                                  | Reconcile the retrospective foundation record                            |
| `[MODIFY, REVIEW CHANGE]`     | `docs/governance/DECISIONS.md`                                                                  | Record the approved Docker deferral                                      |
| `[MODIFY, REVIEW CHANGE]`     | `docs/governance/MEMORY.md`                                                                     | Record the current Docker boundary                                       |
| `[MODIFY]`                    | `docs/governance/phases/phase-2-auth-rbac.md`                                                   | Canonical task status only: `🔄`, then `🕵️`                              |
| `[MODIFY]`                    | `docs/governance/tasks/phase-2/P2-T001-phase-2-prisma-schema-and-initial-migration-baseline.md` | Plan review and implementation evidence                                  |

No other file is authorized by this plan. Stop and amend the plan if implementation requires one.

---

## 6. Step-by-Step Execution Plan

1. **Confirm execution authorization and database safety.** Confirm the plan is approved and `P2-T001` is `🔄`. Resolve the current `DATABASE_URL` without printing credentials; verify that it targets the developer's approved isolated development database. Inspect user tables and `_prisma_migrations` immediately before migration. Stop on unexpected tables, data, migration history, or any shared/staging/production target. Do not reset automatically.
2. **Finalize the schema contract.** Retain the confirmed multi-file schema root, then add exactly the models, enums, fields, defaults, constraints and relations in Section 2 across the responsibility-based files listed in Section 5. Do not add legacy or future-scope structures.
3. **Format and validate.** Run `pnpm exec prisma format` and `pnpm exec prisma validate`. Resolve only schema issues within this approved contract.
4. **Generate and apply the migration.** Run `pnpm exec prisma migrate dev --name init_phase_2` against the verified clean isolated database. Inspect the generated SQL without editing it. Stop if Prisma proposes destructive or unexpected operations.
5. **Generate the client and check compilation.** Run `pnpm exec prisma generate`, verify the configured output, then run `pnpm build` and `pnpm lint`.
6. **Verify database integrity.** Run `pnpm exec prisma migrate status` and PostgreSQL catalog queries to verify model tables, columns, nullability, defaults, enum values, primary/foreign keys, unique constraints and referential actions against Section 2.
7. **Record evidence and request review.** Record actual files, migration name, command results, database observations and any deviation in Section 10. Self-review the diff, mark only `P2-T001` as `🕵️`, and stop for human approval.

---

## 7. Verification & Quality Gates

| Check                 | Required | Command or Method                                                         | Result                       |
| :-------------------- | :------- | :------------------------------------------------------------------------ | :--------------------------- |
| Acceptance criteria   | `Yes`    | ERD-to-schema checklist and Section 2 contract inspection                 | `PASS`                       |
| Schema format         | `Yes`    | `pnpm exec prisma format`                                                 | `PASS`                       |
| Schema validation     | `Yes`    | `pnpm exec prisma validate`                                               | `PASS`                       |
| Migration safety      | `Yes`    | Target identity plus pre-migration table/data/history inventory           | `PASS`                       |
| Migration application | `Yes`    | `pnpm exec prisma migrate dev --name init_phase_2`                        | `PASS`                       |
| Client generation     | `Yes`    | `pnpm exec prisma generate` and output inspection                         | `PASS`                       |
| Migration status      | `Yes`    | `pnpm exec prisma migrate status`                                         | `PASS`                       |
| Database integrity    | `Yes`    | PostgreSQL catalog queries against Section 2                              | `PASS`                       |
| Type check / build    | `Yes`    | `pnpm build`                                                              | `PASS`                       |
| Lint                  | `Yes`    | `pnpm lint`                                                               | `PASS`                       |
| Automated tests       | `No`     | Jest is deferred under `DEC-013`; no runtime business logic changes here  | `NOT RUN`: approved deferral |
| Manual review         | `Yes`    | Inspect schema, generated SQL, generated-output diff and unexpected files | `PASS`                       |

Use only `PASS`, `FAIL` or `NOT RUN`, with a reason when a required or applicable check does not run.

---

## 8. Assumptions & Blockers

- **Active Blockers:** None. `P2-B006` is resolved and the plan is approved.
- **Confirmed Configuration Baseline:** `prisma.config.ts` points to `prisma/schema`; `prisma/schema/schema.prisma` resolves generated output to `src/generated/prisma`.
- **Approved Design Contract:**
  - Organize the approved models under the confirmed schema root using separate auth, profile and audit schema files.
  - Better Auth generates string IDs for `User`, `Account`, `Session` and `Verification`; these fields therefore have no Prisma database default in this task.
  - Business-profile foreign keys use `onDelete: Restrict`; auth-dependent foreign keys use `onDelete: Cascade`; audit actor deletion uses `onDelete: SetNull`.
  - No `@@map`, `@map` or speculative secondary index is introduced without an approved requirement.
  - Exact Better Auth package/version compatibility is revalidated in `P2-T005` before runtime use.
- If this contract conflicts with the exact approved Better Auth configuration later, update and re-approve the affected task plan before implementation.

---

## 9. Plan Review

| Field       | Value                                                                                 |
| :---------- | :------------------------------------------------------------------------------------ |
| Outcome     | `Approved`                                                                            |
| Reviewed by | User                                                                                  |
| Reviewed on | 2026-09-06                                                                            |
| Notes       | Explicit human approval received to execute the 7-step plan. Marked `🔄 In progress`. |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `prisma.config.ts` (schema root changed to `prisma/schema`)
  - `prisma/schema.prisma` (superseded root-level schema removed)
  - `prisma/schema/schema.prisma` (new directory-based datasource and generator entry)
  - `prisma/schema/auth.prisma` (new: `User`, `Account`, `Session`, `Verification`, `UserRole`, `UserStatus` with canonical `@@map`)
  - `prisma/schema/profiles.prisma` (new: `Admin`, `Customer` with canonical `@@map`)
  - `prisma/schema/audit.prisma` (new: `AuditLog`, `AuditAction`, `AuditEntityType` with canonical `@@map`)
  - `prisma/migrations/20260912090148_init/migration.sql` (canonical initial migration baseline under `DEC-015`)
  - `prisma/migrations/migration_lock.toml` (generated lock file)
  - `src/generated/prisma/**` (legacy tracked output removed; Phase 2 client regenerated locally and intentionally Git-ignored)
  - `Dockerfile` (deleted by explicit human direction; Docker configuration deferred)
  - `.dockerignore` (deleted by explicit human direction)
  - `docs/governance/02-ARCHITECTURE.md` (current root layout reconciled)
  - `docs/governance/phases/phase-1-foundation.md` (container state reconciled)
  - `docs/governance/DECISIONS.md` (`DEC-012`, `DEC-015` recorded)
  - `docs/governance/MEMORY.md` (current Docker boundary and canonical migration recorded)
  - `docs/governance/phases/phase-2-auth-rbac.md` (task status tracking)
  - `docs/governance/tasks/phase-2/P2-T001-phase-2-prisma-schema-and-initial-migration-baseline.md` (implementation plan & evidence)
- **Migration Created / Canonical Baseline:** `20260912090148_init` (reconciled and canonicalized under `DEC-015`)
- **Database Target Classification:** Isolated developer PostgreSQL database (`db.prisma.io:5432/postgres`)
- **Pre-Migration Safety Evidence (Historical 2026-09-06):** Pre-migration inspection verified only `_prisma_migrations` existed with 0 migration rows and 0 business tables. No unmanaged application data was present. (Subsequent pre-production squash and dev database reset executed under `DEC-015` on 2026-09-12).
- **Verification Results:**
  - `pnpm exec prisma format`: PASS (`Formatted prisma\schema in 15ms 🚀`)
  - `pnpm exec prisma validate`: PASS (`The schemas at prisma\schema are valid 🚀`)
  - `pnpm exec prisma migrate dev --name init`: PASS (`Applying migration 20260912090148_init`, `Your database is now in sync with your schema.`)
  - `pnpm exec prisma generate`: PASS (`Generated Prisma Client (7.9.1) to .\src\generated\prisma`)
  - `pnpm build`: PASS (`prisma generate && tsc` completed with exit code 0)
  - `pnpm lint`: PASS (`eslint ./src` exited with code 0)
  - `pnpm exec prisma migrate status`: PASS (`1 migration found in prisma/migrations`, `Database schema is up to date!`)
- **Database Integrity Evidence:**
  - PostgreSQL catalog inspection confirmed canonical tables: `account`, `admin`, `audit_log`, `customer`, `session`, `user`, `verification`, `_prisma_migrations`.
  - Enums confirmed: `AuditAction` (8 values), `AuditEntityType` (3 values), `UserRole` (3 values), `UserStatus` (3 values).
  - Foreign key and referential actions confirmed: `account.userId` (`CASCADE`), `session.userId` (`CASCADE`), `admin.userId` (`RESTRICT`), `customer.userId` (`RESTRICT`), `audit_log.actorId` (`SET NULL`).
  - Canonical indexes confirmed: `user_email_key`, `session_token_key`, `account_userId_idx`, `session_userId_idx`, `verification_identifier_idx`, `audit_log_actorId_idx`, plus PKs on each entity table.
- **Deviations from Approved Plan:** During human review, the user directed removal of the current `Dockerfile` and `.dockerignore`, and deferred Docker configuration. The plan and affected governance records were amended under `DEC-012`. Pre-production migrations were squashed into a unified non-destructive baseline under `DEC-015`.
- **Remaining Concerns / Follow-ups:** Generated Prisma output remains intentionally ignored by Git. Prisma Client generation is now covered by both `postinstall` and `build`. Future Docker work must verify its production dependency-installation and client-generation sequence.

---

## 11. Task Closure Review

| Field          | Value                                                                                                        |
| :------------- | :----------------------------------------------------------------------------------------------------------- |
| Final Outcome  | `Accepted / ✅ Done`                                                                                         |
| Reviewed by    | User                                                                                                         |
| Closed on      | 2026-09-06 (Baseline reconciled to canonical `20260912090148_init` under `DEC-015` on 2026-09-12)           |
| Notes          | All acceptance criteria verified; baseline canonicalized and verified against isolated PostgreSQL database. |
