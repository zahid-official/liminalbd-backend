# Phase 2: Authentication & RBAC

> Canonical execution plan for the complete approved Phase 2 scope.
> Planning covers the full phase; implementation proceeds one task at a time.

## 1. Phase Identity

| Field        | Value        |
| ------------ | ------------ |
| Phase        | `Phase 2`    |
| Status       | `ACTIVE`     |
| Readiness    | `BLOCKED`    |
| Last updated | `2026-09-05` |

These values mirror [06-PHASE-ROADMAP.md](../06-PHASE-ROADMAP.md).

---

## 2. Governance Context

- Follow [AGENTS.md](../../../AGENTS.md) and [05-TASK-WORKFLOW.md](../05-TASK-WORKFLOW.md).
- Do not modify code without active task authorization.
- The active status is `ACTIVE / BLOCKED`. Implementation is blocked until phase-level blockers are resolved.
- Work on exactly one task at a time and obtain human approval before starting the next.
- Git operations remain under explicit human direction. Propose commit messages; do not commit or push autonomously.
- Progressive future-scope integration follows `DEC-008`; it does not expand Phase 2 implementation scope.

---

## 3. Approved Phase Scope

### Requirement Sources

| Source                          | Approved Coverage                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [PRD](../../product/PRD.md)     | Sections 2.1 through 2.3: `FR-AUTH-001` through `FR-AUTH-009`, `FR-RBAC-001` through `FR-RBAC-006`, `FR-ADMIN-001` through `FR-ADMIN-003`, and `FR-CUSTOMER-001` through `FR-CUSTOMER-004` |
| [ERD](../../product/ERD.drawio) | `User`, `Account`, `Session`, `Verification`, `Customer`, `Admin`, `AuditLog`, and related enums                                                                                           |
| [DECISIONS.md](../DECISIONS.md) | `DEC-002` through `DEC-009`                                                                                                                                                                |

### In Scope

- User identity, customer accounts and role-based administration for `CUSTOMER`, `ADMIN` and `SUPER_ADMIN`.
- Credential registration, login, logout, verification, password reset and password update via Better Auth.
- Google OAuth sign-in, sign-up, account linking and unlinking behind approved application boundaries.
- Secure session management, session revocation, account status enforcement and CSRF protection.
- Administrative creation and lifecycle management of Admin accounts with strict Super Admin privilege separation.
- Administrative listing, detail retrieval, suspension, deactivation and soft-delete for Customer accounts.
- Reusable Customer ownership authorization and audit logging across all sensitive actions.

### Out of Scope

- Inquiries, carts, orders, commerce, payments, blogs and showcases.
- General media management outside the approved Customer avatar requirement.
- A custom password, token, OAuth or session implementation that duplicates Better Auth.
- Granular permission administration beyond an extensible role-based design.
- New roles, unapproved account states or business behavior not defined by the PRD/ERD.

---

## 4. Planning and Execution Rule

This file defines the complete Phase 2 plan before implementation begins. The Task Index is the canonical execution state. Only one task may be `🔄` or `🕵️` across the project at a time.

Unstarted tasks may be refined only through an approved scope or requirement change. Such refinement must preserve requirement traceability and must not silently authorize implementation.

Blocker scope is distinct from task dependency:

- `PHASE` blocks the transition to `READY`.
- `TASK` blocks only the named task and its dependents.
- `EXTERNAL` blocks final integration review (`P2-T027`) until required provider or environment evidence is available. Approved mocks allow earlier feature tasks to reach review before `P2-B010` is resolved.

An open task-level blocker does not by itself block an earlier eligible task. If no task remains eligible, readiness must return to `BLOCKED` until the applicable blocker is resolved.

---

## 5. Requirement Coverage

Every listed top-level FR includes all of its approved sub-requirements unless a blocker or approved decision explicitly changes the requirement.

| Requirement       | Planned Task Coverage                                 |
| ----------------- | ----------------------------------------------------- |
| `FR-AUTH-001`     | `P2-T006`                                             |
| `FR-AUTH-002`     | `P2-T009`                                             |
| `FR-AUTH-003`     | `P2-T011`                                             |
| `FR-AUTH-004`     | `P2-T007`                                             |
| `FR-AUTH-005`     | `P2-T008`                                             |
| `FR-AUTH-006`     | `P2-T012`                                             |
| `FR-AUTH-007`     | `P2-T013`                                             |
| `FR-AUTH-008`     | `P2-T014`                                             |
| `FR-AUTH-009`     | `P2-T005`, `P2-T010`, `P2-T014`, `P2-T015`            |
| `FR-RBAC-001`     | `P2-T006`, `P2-T015`, `P2-T018`, `P2-T019`, `P2-T020` |
| `FR-RBAC-002`     | `P2-T015`                                             |
| `FR-RBAC-003`     | `P2-T018`, `P2-T019`                                  |
| `FR-RBAC-004`     | `P2-T020`                                             |
| `FR-RBAC-005`     | `P2-T022`, `P2-T023`, `P2-T024`                       |
| `FR-RBAC-006`     | `P2-T008`, `P2-T017`, `P2-T026`                       |
| `FR-ADMIN-001`    | `P2-T018`                                             |
| `FR-ADMIN-002`    | `P2-T019`                                             |
| `FR-ADMIN-003`    | `P2-T021`                                             |
| `FR-CUSTOMER-001` | `P2-T024`                                             |
| `FR-CUSTOMER-002` | `P2-T025`                                             |
| `FR-CUSTOMER-003` | `P2-T023`                                             |
| `FR-CUSTOMER-004` | `P2-T026`                                             |

---

## 6. Readiness

- [x] Approved PRD coverage and phase boundary are identified.
- [x] Applicable ERD entities and enums are identified.
- [x] Tasks are ordered and independently reviewable.
- [x] Every task has requirement references, dependencies and acceptance criteria.
- [x] Out-of-scope boundaries are explicit.
- [ ] Every phase-level blocker is resolved.
- [x] The complete task breakdown is human-approved.
- [ ] [MEMORY.md](../MEMORY.md) and [06-PHASE-ROADMAP.md](../06-PHASE-ROADMAP.md) are updated consistently to `ACTIVE/READY`.

Implementation must not begin until every readiness item is satisfied and the selected task has no unresolved task-level blocker.

---

## 7. Phase Constraints

| Area               | Approved Constraint or Current Impact                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture       | `Route → Middleware → Controller → Service → Repository → Prisma → PostgreSQL`; Better Auth remains behind its approved boundary                                    |
| Authentication     | Better Auth owns credentials, password hashing, OAuth and session lifecycle; application code must not recreate them                                                |
| Authorization      | Middleware enforces route access and authenticated session identity; services enforce business-context authorization, ownership and privileged-account restrictions |
| Public API         | REST/JSON and the shared response/error contracts apply; exact Phase 2 endpoint contract requires approval under `P2-B001`                                          |
| Data               | Prisma schema must align with the approved ERD; generated output is read-only; applied migrations are never casually rewritten                                      |
| Sessions           | Secure cookies, configurable expiry/renewal, revocation, status enforcement and CSRF protection are required                                                        |
| Audit              | Required audit writes must be atomic with the related business change where consistency requires it                                                                 |
| External providers | Google OAuth, SMTP and avatar media handling remain behind approved application boundaries                                                                          |
| Validation         | All body, params and query input uses Zod at the application boundary                                                                                               |
| Security           | No public privileged-role assignment, self-role mutation, ownership bypass, secret exposure or raw internal error leakage                                           |

---

## 8. Task Index

| Order | Workstream | Task ID   | Task                                                                     | Status | Depends On                      | Blocked By                                   |
| ----- | ---------- | --------- | ------------------------------------------------------------------------ | ------ | ------------------------------- | -------------------------------------------- |
| 1     | A          | `P2-T001` | Reconcile the Phase 2 Prisma schema and migration baseline               | `🔲`   | None                            | `P2-B006`                                    |
| 2     | A          | `P2-T002` | Establish shared response, typed-error and Zod validation infrastructure | `🔲`   | `P2-T001`                       | `P2-B009`                                    |
| 3     | A          | `P2-T003` | Establish Winston logging                                                | `🔲`   | `P2-T002`                       | `P2-B009`                                    |
| 4     | A          | `P2-T004` | Establish the Jest test foundation                                       | `🔲`   | `P2-T002`                       | `P2-B009`                                    |
| 5     | A          | `P2-T005` | Configure Better Auth, secure sessions and provider boundaries           | `🔲`   | `P2-T001` to `P2-T004`          | `P2-B002`, `P2-B009`                         |
| 6     | B          | `P2-T006` | Implement email/password Customer registration                           | `🔲`   | `P2-T005`                       | `P2-B001`                                    |
| 7     | B          | `P2-T007` | Implement email verification and resend flow                             | `🔲`   | `P2-T006`                       | `P2-B001`                                    |
| 8     | B          | `P2-T008` | Implement login with account-status and rate-limit enforcement           | `🔲`   | `P2-T005`, `P2-T006`            | `P2-B001`                                    |
| 9     | B          | `P2-T009` | Implement Google sign-in and sign-up                                     | `🔲`   | `P2-T005`, `P2-T008`            | `P2-B001`, `P2-B003`                         |
| 10    | B          | `P2-T010` | Implement session and authentication middleware guard                    | `🔲`   | `P2-T005`, `P2-T008`            | None                                         |
| 11    | B          | `P2-T011` | Implement Google account linking and unlinking                           | `🔲`   | `P2-T009`, `P2-T010`            | `P2-B001`, `P2-B003`, `P2-B005`              |
| 12    | B          | `P2-T012` | Implement password reset                                                 | `🔲`   | `P2-T005`, `P2-T007`            | `P2-B001`, `P2-B005`                         |
| 13    | B          | `P2-T013` | Implement change or set password                                         | `🔲`   | `P2-T008`, `P2-T010`            | `P2-B001`, `P2-B005`                         |
| 14    | B          | `P2-T014` | Implement logout and session revocation                                  | `🔲`   | `P2-T008`, `P2-T010`            | `P2-B001`                                    |
| 15    | C          | `P2-T015` | Implement role-based access control (RBAC) middleware guard              | `🔲`   | `P2-T010`                       | None                                         |
| 16    | C          | `P2-T016` | Implement the audit-log application boundary                             | `🔲`   | `P2-T001`, `P2-T004`, `P2-T010` | None                                         |
| 17    | C          | `P2-T017` | Enforce restricted account status across protected access                | `🔲`   | `P2-T010`, `P2-T015`, `P2-T016` | None                                         |
| 18    | C          | `P2-T018` | Implement Super Admin creation of Admin accounts                         | `🔲`   | `P2-T015`, `P2-T016`, `P2-T017` | `P2-B001`, `P2-B004`                         |
| 19    | C          | `P2-T019` | Implement privileged profile, role and status management                 | `🔲`   | `P2-T018`                       | `P2-B001`, `P2-B004`                         |
| 20    | C          | `P2-T020` | Enforce and audit Admin restrictions on privileged accounts              | `🔲`   | `P2-T016`, `P2-T019`            | `P2-B001`                                    |
| 21    | C          | `P2-T021` | Implement the Super Admin Admin-list operation                           | `🔲`   | `P2-T019`                       | `P2-B001`                                    |
| 22    | D          | `P2-T022` | Establish the reusable ownership-authorization pattern                   | `🔲`   | `P2-T010`, `P2-T015`, `P2-T016` | None                                         |
| 23    | D          | `P2-T023` | Implement authorized Customer profile retrieval                          | `🔲`   | `P2-T022`                       | `P2-B001`, `P2-B008`                         |
| 24    | D          | `P2-T024` | Implement Customer profile and email updates                             | `🔲`   | `P2-T007`, `P2-T022`, `P2-T023` | `P2-B001`, `P2-B007`                         |
| 25    | D          | `P2-T025` | Implement the authorized Customer-list operation                         | `🔲`   | `P2-T022`                       | `P2-B001`                                    |
| 26    | D          | `P2-T026` | Implement Customer account lifecycle management                          | `🔲`   | `P2-T016`, `P2-T017`, `P2-T022` | `P2-B001`                                    |
| 27    | E          | `P2-T027` | Complete Phase 2 integration and security verification                   | `🔲`   | `P2-T001` through `P2-T026`     | All unresolved blockers, including `P2-B010` |

Workstreams organize one phase; they are not sub-phases and do not permit parallel implementation. Execute tasks in order unless the plan is explicitly re-approved. Update status only in this index.

---

## 9. Task Definitions

For every task, `build`, `lint`, applicable Jest tests and acceptance-criteria inspection are required unless the task records an approved exception. Results begin as `NOT RUN`. No task is review-ready while a required check fails or cannot run.

Approved mocks may verify Google OAuth and SMTP behavior in feature tasks. Live-provider evidence is required by `P2-T027` before phase completion.

### Workstream A: Phase Prerequisites

#### P2-T001: Reconcile the Phase 2 Prisma Schema and Migration Baseline

**Requirements:** Phase 2 ERD; `FR-RBAC-001`, `FR-RBAC-006`  
**Objective:** Replace the empty/legacy model state with an approved Prisma representation of the Phase 2 entities, relationships and enums.

**Acceptance Criteria:**

- Confirm whether the existing migration has been applied before choosing the migration strategy.
- Model every approved ERD entity, field, relationship, enum, uniqueness rule, timestamp and soft-delete field required by Phase 2.
- Remove the legacy `Post` model from the target design without rewriting applied migration history.
- Generate Prisma Client successfully at `src/generated/prisma`.
- Validate the resulting migration and data-integrity impact using the approved workflow.

**Additional verification:** Prisma format/validate/generate and applicable migration checks.  
**Human review:** `Pending`

#### P2-T002: Establish Shared Response, Typed-Error and Zod Validation Infrastructure

**Requirements:** Architecture and coding standards; all Phase 2 request contracts  
**Objective:** Provide the reusable response, typed-error, async-handler and Zod validation infrastructure required by Phase 2 endpoints.

**Acceptance Criteria:**

- Implement `sendResponse` under `src/app/utils/` using the approved success and pagination envelope.
- Align typed application errors and global error output with the approved error contract without leaking stack traces, Prisma objects or provider internals.
- Validate body, params and query inputs through shared Zod middleware.
- Preserve correct HTTP status and stable error-code behavior.
- Add focused tests for success, validation failure and safe error serialization.

**Additional verification:** Targeted unit and middleware integration tests.  
**Human review:** `Pending`

#### P2-T003: Establish Winston Logging

**Requirements:** Architecture and coding standards  
**Objective:** Replace ad hoc application and lifecycle logging with the approved shared logger.

**Acceptance Criteria:**

- Configure Winston behind the shared logging boundary.
- Replace committed `console.*` use across the application and server lifecycle.
- Prevent passwords, tokens, cookies, OAuth values, secrets and unnecessary personal data from being logged.
- Cover logger configuration, log formatting, redaction rules and lifecycle behavior with focused tests.

**Additional verification:** Unit tests verifying logger formatting, redaction rules and server lifecycle.  
**Human review:** `Pending`

#### P2-T004: Establish the Jest Test Foundation

**Requirements:** Architecture and coding standards  
**Objective:** Replace the placeholder test command with a repeatable Jest unit and integration test foundation.

**Acceptance Criteria:**

- Configure Jest for the repository's ESM and TypeScript setup (`"type": "module"`).
- Establish repeatable unit and integration test commands in `package.json` with appropriate data/environment isolation.
- Provide an application test harness with reusable mocking helpers.
- Add meaningful baseline tests proving that the test runner executes, reports and completes successfully.

**Additional verification:** Run `pnpm test` successfully.  
**Human review:** `Pending`

#### P2-T005: Configure Better Auth, Secure Sessions and Provider Boundaries

**Requirements:** `FR-AUTH-009`; `DEC-003`, `DEC-004`  
**Objective:** Establish the single approved Better Auth boundary and secure cookie-based session foundation.

**Acceptance Criteria:**

- Configure Better Auth against the approved Prisma models without implementing parallel credential or session mechanics.
- Configure environment-validated Google OAuth and SMTP boundaries without logging or hard-coding secrets.
- Apply approved cookie attributes, session expiry/renewal and CSRF policy.
- Keep ordinary JSON responses free of application-managed access or refresh tokens.
- Expose reusable session operations needed by later tasks and cover them with focused tests using approved mocks.

**Additional verification:** Configuration, cookie and CSRF tests; provider flows may use approved mocks.  
**Human review:** `Pending`

### Workstream B: Authentication and Sessions

#### P2-T006: Implement Email/Password Customer Registration

**Requirements:** `FR-AUTH-001`, `FR-RBAC-001.1` through `FR-RBAC-001.3`  
**Objective:** Register public users through Better Auth while creating the required Customer data consistently.

**Acceptance Criteria:**

- Validate the approved name, email, password, contact-number and address rules.
- Reject duplicate email case-insensitively with HTTP 409.
- Always assign `CUSTOMER`; ignore or reject client role/status/ownership input and never create a privileged account.
- Create the User, authentication data and Customer profile consistently and return HTTP 201 using the shared response contract.
- Never store or log a plain-text password; cover success and meaningful failure paths.

**Additional verification:** Registration integration tests, including duplicate and privileged-role attempts.  
**Human review:** `Pending`

#### P2-T007: Implement Email Verification and Resend Flow

**Requirements:** `FR-AUTH-004`  
**Objective:** Support initial verification, secure verification completion and rate-limited resend through Better Auth and SMTP boundaries.

**Acceptance Criteria:**

- Send verification after email/password registration through the approved provider boundary.
- Accept only valid, unexpired and single-use verification requests.
- Set `emailVerified` after success and preserve trusted Google verification behavior.
- Rate-limit resend requests and map invalid, expired or reused links to the required errors.
- Cover verification and resend success and failure paths using approved mocks without exposing tokens.

**Additional verification:** Provider-mocked integration tests and token/error mapping tests.  
**Human review:** `Pending`

#### P2-T008: Implement Login with Account-Status and Rate-Limit Enforcement

**Requirements:** `FR-AUTH-005`, `FR-RBAC-006.1`  
**Objective:** Authenticate eligible users by email/password and establish a secure Better Auth session.

**Acceptance Criteria:**

- Reject invalid credentials with HTTP 401 without leaking credential details.
- Reject suspended, deactivated and soft-deleted accounts before protected access is granted.
- Rate-limit repeated failed attempts using the approved authentication policy.
- Return the approved user data in the shared envelope while maintaining the session only through secure cookies.
- Cover active, invalid-credential and restricted-account paths.

**Additional verification:** Login, rate-limit, cookie and status integration tests.  
**Human review:** `Pending`

#### P2-T009: Implement Google Sign-In and Sign-Up

**Requirements:** `FR-AUTH-002`, `FR-RBAC-001.2`, `FR-RBAC-001.3`  
**Objective:** Support Google authentication through Better Auth without duplicate accounts or privileged-role mutation.

**Acceptance Criteria:**

- Complete Google sign-in/sign-up through the approved provider boundary.
- Create first-time public Google users as `CUSTOMER` and populate only approved trusted profile fields.
- Treat a verified Google email as verified where the approved policy permits.
- Apply the approved matching/linking policy without unintended duplicate accounts.
- Preserve every existing privileged role and map denial, provider failure and conflicts safely.

**Additional verification:** Provider-mocked first-time, returning, conflict and privileged-account tests.  
**Human review:** `Pending`

#### P2-T010: Implement Session and Authentication Middleware Guard

**Requirements:** `FR-AUTH-009`  
**Objective:** Establish a reusable session-validation middleware guard that verifies session cookies and attaches server-derived authenticated identity.

**Acceptance Criteria:**

- Require a valid Better Auth session cookie on protected endpoints and return HTTP 401 when absent, expired or invalid.
- Resolve the authenticated user and attach trusted server-derived identity context to the request.
- Ensure revoked sessions cannot bypass the guard.
- Never trust client-supplied headers or body for authentication identity.
- Cover missing, invalid, expired and valid session paths with focused tests.

**Additional verification:** Unit and middleware integration tests with mocked Better Auth sessions.  
**Human review:** `Pending`

#### P2-T011: Implement Google Account Linking and Unlinking

**Requirements:** `FR-AUTH-003`  
**Objective:** Allow an authenticated user to manage their Google authentication method safely behind the authentication guard.

**Acceptance Criteria:**

- Require an authenticated session (protected by `P2-T010`) and approved authentication assurance for link/unlink operations.
- Link only to the authenticated user's account and reject a Google account already linked elsewhere.
- Permit unlinking only when another valid authentication method remains.
- Return HTTP 422 when unlinking would remove the only authentication method.
- Preserve the application role and cover unauthorized, conflict and sole-method paths.

**Additional verification:** Account-linking integration tests with approved provider mocks.  
**Human review:** `Pending`

#### P2-T012: Implement Password Reset

**Requirements:** `FR-AUTH-006`  
**Objective:** Provide a secure, non-enumerating Better Auth password-reset flow via the SMTP provider boundary.

**Acceptance Criteria:**

- Return the same generic initiation response for registered and unregistered emails.
- Send a time-limited, single-use reset link through the approved email boundary.
- Enforce the password policy and update credentials only through Better Auth.
- Revoke all existing sessions after a successful reset.
- Handle Google-only accounts and rate limits exactly as approved without revealing account existence.

**Additional verification:** Enumeration, token reuse/expiry, password policy and session-revocation tests using approved mocks.  
**Human review:** `Pending`

#### P2-T013: Implement Change or Set Password

**Requirements:** `FR-AUTH-007`  
**Objective:** Let authenticated users change an existing password or add one to a Google-only account behind the authentication guard.

**Acceptance Criteria:**

- Require an authenticated session protected by `P2-T010`.
- Require the current password when one exists and reject an incorrect value with HTTP 400.
- Permit a Google-only user to set a password through the supported Better Auth flow.
- Enforce the approved password policy and session-security behavior.
- Preserve linked Google authentication and never expose credential data.
- Cover existing-password, Google-only and invalid-state paths.

**Additional verification:** Credential-method and session-policy integration tests.  
**Human review:** `Pending`

#### P2-T014: Implement Logout and Session Revocation

**Requirements:** `FR-AUTH-008`, `FR-AUTH-009`  
**Objective:** Revoke either the current session or every session belonging to the authenticated user behind the authentication guard.

**Acceptance Criteria:**

- Require an authenticated session protected by `P2-T010`.
- Logout invalidates the current session and clears/invalidates its cookie correctly.
- Logout-all revokes every active session for the user, including the current session.
- Revoked sessions receive HTTP 401 on later protected requests.
- A user cannot revoke another user's sessions through the public flow.
- Cover current-session, all-session and replay-after-revocation paths.

**Additional verification:** Session persistence and revocation integration tests.  
**Human review:** `Pending`

### Workstream C: RBAC and Admin Management

#### P2-T015: Implement Role-Based Access Control (RBAC) Middleware Guard

**Requirements:** `FR-RBAC-001`, `FR-RBAC-002`, `FR-AUTH-009`  
**Objective:** Establish an authorization middleware guard layered on `P2-T010` to enforce role requirements while keeping business authorization in services.

**Acceptance Criteria:**

- Layer on `P2-T010` authenticated identity context.
- Enforce approved route roles and return HTTP 403 for insufficient access.
- Support only `SUPER_ADMIN`, `ADMIN` and `CUSTOMER` through extensible permission mapping.
- Attach trusted server-derived role context; never trust client role or ownership claims.
- Keep privileged and resource-specific authorization in the service layer and test bypass attempts.

**Additional verification:** Middleware unit and protected-route integration tests.  
**Human review:** `Pending`

#### P2-T016: Implement the Audit-Log Application Boundary

**Requirements:** `FR-RBAC-001.6`, `FR-RBAC-003.7`, `FR-RBAC-004.6`, `FR-RBAC-005.4`, `FR-RBAC-006.3`, `FR-ADMIN-001.4`, `FR-ADMIN-002.5`, `FR-CUSTOMER-004.5`  
**Objective:** Provide a reusable persistence boundary for every Phase 2 audit event required by the PRD.

**Acceptance Criteria:**

- Record actor, target/entity, action, previous value, new value, metadata and timestamp as applicable.
- Support required success and rejected-attempt events using approved ERD enums.
- Write audit data atomically with the related state change when consistency requires it.
- Keep audit persistence behind repository/service boundaries and exclude secrets or unnecessary sensitive data.
- Cover successful, rejected and transaction-rollback behavior.

**Additional verification:** Repository, service and transaction tests.  
**Human review:** `Pending`

#### P2-T017: Enforce Restricted Account Status Across Protected Access

**Requirements:** `FR-RBAC-006`  
**Objective:** Prevent suspended, deactivated and soft-deleted accounts from authenticating or using protected resources.

**Acceptance Criteria:**

- Apply status checks during authentication and protected authorization.
- Ensure restricting an account invalidates active sessions.
- Exclude soft-deleted users from normal active-user queries.
- Preserve business records and avoid physical deletion.
- Produce required audit events and cover every restricted status.

**Additional verification:** Status, soft-delete filtering, revocation and audit tests.  
**Human review:** `Pending`

#### P2-T018: Implement Super Admin Creation of Admin Accounts

**Requirements:** `FR-RBAC-003.1`, `FR-ADMIN-001`  
**Objective:** Allow only a Super Admin to create an Admin through the approved administrative creation process.

**Acceptance Criteria:**

- Require `SUPER_ADMIN` and reject `ADMIN` or `CUSTOMER` with HTTP 403.
- Validate required input, reject duplicate email with HTTP 409 and assign exactly `ADMIN`.
- Reject any attempt to create or assign `SUPER_ADMIN` through this operation.
- Follow the approved credential/invitation process without exposing secrets.
- Create required data consistently and record the audit event.

**Additional verification:** Role, duplicate, forbidden-role, creation-flow and audit tests.  
**Human review:** `Pending`

#### P2-T019: Implement Privileged Profile, Role and Status Management

**Requirements:** `FR-RBAC-003.2` through `FR-RBAC-003.7`, `FR-ADMIN-002`  
**Objective:** Let a Super Admin manage permitted privileged-account profile, role and status fields.

**Acceptance Criteria:**

- Permit a Super Admin to update another Admin's allowed profile and status fields.
- Support only approved `ADMIN ↔ SUPER_ADMIN` transitions and reject self-role mutation.
- Revoke active sessions when a privileged account is suspended.
- Reject missing targets and invalid status transitions with the required HTTP behavior.
- Apply changes atomically with complete audit before/after values.

**Additional verification:** Role-transition, self-mutation, status, authorization and audit tests.  
**Human review:** `Pending`

#### P2-T020: Enforce and Audit Admin Restrictions on Privileged Accounts

**Requirements:** `FR-RBAC-004`, `FR-ADMIN-002.3`  
**Objective:** Prevent an Admin from creating or modifying any Admin or Super Admin account at the service boundary.

**Acceptance Criteria:**

- Reject Admin attempts to create privileged accounts.
- Reject Admin attempts to modify, suspend, deactivate, remove or change the role of an Admin or Super Admin.
- Reject every user's self-role mutation.
- Enforce restrictions in services even if route middleware is bypassed.
- Audit rejected privileged-management attempts with actor, target, action and timestamp.

**Additional verification:** Direct-service and HTTP bypass tests plus rejected-attempt audit tests.  
**Human review:** `Pending`

#### P2-T021: Implement the Super Admin Admin-List Operation

**Requirements:** `FR-ADMIN-003`  
**Objective:** Provide a Super Admin-only list of Admin accounts with approved query capabilities.

**Acceptance Criteria:**

- Permit only `SUPER_ADMIN`; reject `ADMIN` and `CUSTOMER` with HTTP 403.
- Return only users whose role is exactly `ADMIN`.
- Validate pagination, search, sorting and account-status filters through Zod.
- Exclude soft-deleted accounts from normal results and return approved pagination metadata.
- Prevent unsafe sort/filter fields and unnecessary data exposure.

**Additional verification:** Authorization, filtering, sorting, pagination and exposure tests.  
**Human review:** `Pending`

### Workstream D: Customer Profile and Account Management

#### P2-T022: Establish the Reusable Ownership-Authorization Pattern

**Requirements:** `FR-RBAC-005`  
**Objective:** Create a reusable service-layer pattern for Customer ownership and scoped administrative access.

**Acceptance Criteria:**

- Derive ownership from the authenticated server-side identity and persisted resource owner.
- Return HTTP 403 for cross-customer access or mutation.
- Apply explicit administrative permission checks rather than unconditional role bypass.
- Support required sensitive-access audit events.
- Provide focused tests proving middleware bypass cannot bypass service ownership checks.

**Additional verification:** Service and route integration tests for owner, non-owner and administrative access.  
**Human review:** `Pending`

#### P2-T023: Implement Authorized Customer Profile Retrieval

**Requirements:** `FR-CUSTOMER-003`, `FR-RBAC-005`  
**Objective:** Return a Customer's permitted profile to the owner or an authorized administrator.

**Acceptance Criteria:**

- Allow a Customer to retrieve only their own profile.
- Allow `ADMIN` and `SUPER_ADMIN` access only within approved permissions.
- Reject cross-customer access with HTTP 403 and return HTTP 404 for an unavailable target as approved.
- Return only permitted profile fields through the shared response contract.
- Handle order and inquiry summaries only according to the approved resolution of `P2-B008`.

**Additional verification:** Owner, cross-owner, administrator, not-found and field-exposure tests.  
**Human review:** `Pending`

#### P2-T024: Implement Customer Profile and Email Updates

**Requirements:** `FR-CUSTOMER-001`, `FR-RBAC-005`  
**Objective:** Update permitted Customer profile data while preserving credential/provider boundaries and email verification rules.

**Acceptance Criteria:**

- Allow Customers to update only their own permitted name, contact number, address and approved avatar representation.
- Allow authorized administrators to update only permitted business-profile fields.
- Prevent profile input from modifying role, status, ownership, credentials or provider-account data.
- Change email only through the approved account flow with validation, uniqueness and correct verification-state reset.
- Enforce ownership, return required errors and cover the approved avatar resolution from `P2-B007`.

**Additional verification:** Ownership, field allow-list, duplicate-email, verification-state and avatar tests.  
**Human review:** `Pending`

#### P2-T025: Implement the Authorized Customer-List Operation

**Requirements:** `FR-CUSTOMER-002`  
**Objective:** Provide authorized administrators with a filtered and paginated Customer list.

**Acceptance Criteria:**

- Permit `SUPER_ADMIN` and `ADMIN`; reject `CUSTOMER` with HTTP 403.
- Return only users whose role is exactly `CUSTOMER`.
- Validate pagination, name/email search, sorting, status and creation-date range filters.
- Exclude soft-deleted accounts from normal results and return approved pagination metadata.
- Prevent unsafe query fields and unnecessary personal-data exposure.

**Additional verification:** Role, query, pagination, date-range and exposure tests.  
**Human review:** `Pending`

#### P2-T026: Implement Customer Account Lifecycle Management

**Requirements:** `FR-CUSTOMER-004`, `FR-RBAC-006`  
**Objective:** Allow authorized administrators to suspend, deactivate or soft-delete Customer accounts safely.

**Acceptance Criteria:**

- Permit `ADMIN` and `SUPER_ADMIN` only within approved permissions; reject Customer self-status changes.
- Validate allowed status transitions and return HTTP 422 for invalid transitions.
- Revoke every active session when an account is suspended, deactivated or soft-deleted.
- Preserve business records and exclude soft-deleted Customers from normal active operations.
- Apply each status change atomically with actor, target, before/after state, action and timestamp audit data.

**Additional verification:** Permission, transition, revocation, soft-delete and transaction/audit tests.  
**Human review:** `Pending`

### Workstream E: Phase Verification

#### P2-T027: Complete Phase 2 Integration and Security Verification

**Requirements:** All Phase 2 FRs  
**Objective:** Verify the completed phase as one coherent authentication, authorization and account-management system without adding new feature scope.

**Acceptance Criteria:**

- Demonstrate traceability from every approved Phase 2 FR and sub-requirement to passing behavior or an explicitly approved deferral.
- Run the full build, lint and Jest suites, including authentication, authorization, ownership, status, audit and data-exposure failures.
- Verify cookie, CSRF, rate-limit, session-revocation and live/staging provider-boundary behavior.
- Verify migration/data integrity against the approved ERD and test database.
- Confirm no raw stack, Prisma/provider internals, secrets, passwords or session tokens are exposed or logged.
- Update review evidence only; do not conceal failures or add unrelated implementation.

**Additional verification:** Full Phase 2 test suite, migration checks, provider verification and manual security acceptance review.  
**Human review:** `Pending`

---

## 10. Blockers and Open Decisions

| ID        | Scope      | Type              | Affects                     | Required Decision or Evidence                                                                                                                            | Status |
| --------- | ---------- | ----------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `P2-B001` | `TASK`     | Public API        | Endpoint tasks              | Approve exact Phase 2 paths, methods and operation names                                                                                                 | `OPEN` |
| `P2-B002` | `TASK`     | Security          | `P2-T005`                   | Approve session lifetime, renewal, `SameSite`, CSRF and production-cookie policy                                                                         | `OPEN` |
| `P2-B003` | `TASK`     | Authentication    | `P2-T009`, `P2-T011`        | Approve trusted Google identity matching and account-linking policy                                                                                      | `OPEN` |
| `P2-B004` | `TASK`     | Product/Security  | `P2-T018`, `P2-T019`        | Approve initial `SUPER_ADMIN` provisioning and Admin credential/invitation flow                                                                          | `OPEN` |
| `P2-B005` | `TASK`     | Security          | `P2-T011` through `P2-T013` | Approve recent-authentication and post-password-change session policy                                                                                    | `OPEN` |
| `P2-B006` | `PHASE`    | Data              | `P2-T001`, phase readiness  | Inspect the target database and approve the legacy-migration reconciliation strategy                                                                     | `OPEN` |
| `P2-B007` | `TASK`     | External Provider | `P2-T024`                   | Approve avatar input, storage ownership and media-boundary contract                                                                                      | `OPEN` |
| `P2-B008` | `TASK`     | Scope             | `P2-T023`                   | Resolve order/inquiry summaries without implementing unapproved future modules                                                                           | `OPEN` |
| `P2-B009` | `TASK`     | Dependency        | `P2-T002` through `P2-T005` | Explicitly approve exact packages before installation                                                                                                    | `OPEN` |
| `P2-B010` | `EXTERNAL` | Provider Evidence | `P2-T027`                   | Provide an approved test environment or evidence for Google OAuth and SMTP flows before final phase closure (individual tasks close with approved mocks) | `OPEN` |

Approved mocks allow affected feature tasks to reach review before `P2-B010` is resolved. Live-provider evidence remains mandatory for `P2-T027` and phase completion.

Do not invent a resolution. Record each approved outcome in the affected task contract and in [DECISIONS.md](../DECISIONS.md) when it creates a durable rule.

---

## 11. Phase Completion

- [ ] Every required task through `P2-T027` is `✅`.
- [ ] Every approved FR and sub-requirement is traceable to verified behavior or an explicitly approved deferral.
- [ ] Required build, lint, test, security, migration and data-integrity checks pass.
- [ ] All blockers are resolved and approved deferred work is documented.
- [ ] This file, [MEMORY.md](../MEMORY.md), [DECISIONS.md](../DECISIONS.md) and [06-PHASE-ROADMAP.md](../06-PHASE-ROADMAP.md) are consistent.
- [ ] Explicit human approval for phase completion is recorded.

| Approval Field | Value                          |
| -------------- | ------------------------------ |
| Outcome        | `Pending`                      |
| Approved by    | `Pending`                      |
| Approved on    | `Pending`                      |
| Notes          | Phase remains `ACTIVE/BLOCKED` |

Do not mark Phase 2 `COMPLETE` or activate another phase before the transition required by [05-TASK-WORKFLOW.md](../05-TASK-WORKFLOW.md) and [06-PHASE-ROADMAP.md](../06-PHASE-ROADMAP.md).

---

## 12. Maintenance Rule

- Keep task IDs stable after approval and update status only in the Task Index.
- Keep implementation facts and review evidence within the active task.
- Do not duplicate the full PRD or ERD in this file.
- Apply approved scope changes to requirement coverage, affected tasks, blockers and governance before implementation.
- Update [MEMORY.md](../MEMORY.md) only after human-approved task closure.
- Git commits and pushes remain under explicit human direction.
