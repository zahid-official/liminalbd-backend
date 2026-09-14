# Decisions: Architecture and Governance Log

> Durable technical, architectural and governance decisions.
> This is not task history or current-state memory. Newest entries appear first.

## Usage Rules

- Add an entry only after human approval.
- Record lasting choices, trade-offs, provider boundaries or approved deviations.
- Keep current state in [MEMORY.md](MEMORY.md) and task progress in phase files under `docs/governance/phases/`.
- Do not duplicate coding standards or ordinary implementation details.
- Never rewrite an accepted decision to hide history. Supersede it with a new entry and link both records.
- Use the next sequential ID in the form `DEC-NNN`.

Statuses:

- `ACCEPTED`: approved and authoritative.
- `SUPERSEDED`: replaced by a newer accepted decision.
- `REJECTED`: retained only when its rejection prevents repeated reconsideration.

## Accepted Decisions

### DEC-020: Dedicated Customer Authentication Boundary and Separation of Administrative Login Portals

**Recorded:** 2026-09-14
**Status:** `ACCEPTED`

**Decision:** The public authentication endpoints `POST /api/v1/auth/login` (credential login) and `POST /api/v1/auth/login/google` (Google OAuth) are strictly reserved for the `CUSTOMER` role. Privileged accounts (`ADMIN`, `SUPER_ADMIN`) are strictly forbidden from authenticating, creating sessions, or linking accounts via these customer endpoints. Administrative authentication will be handled via dedicated administrative endpoints (to be established under Workstream C). Any attempt by an administrative user to authenticate via the public customer login routes must be rejected with `HTTP 403 Forbidden` (`FORBIDDEN_ROLE_ACCESS`).

**Why:**
1. **Attack Surface Minimization & Privilege Separation:** Mixing customer and administrative authentication on the same public endpoints exposes high-privilege accounts to public credential stuffing, consumer-facing social login misconfigurations, and unauthorized identity linking.
2. **Dedicated Administrative Workflows:** Administrative users operate in a distinct back-office environment with different security requirements (no third-party social logins like Google, mandatory security audits, and specialized credential policies).
3. **Defense-in-Depth:** Enforcing role checks at the authentication handler ensures that even if an administrative user's credentials are valid, they cannot establish a session through the public customer portal.

**Consequences:**
- `POST /api/v1/auth/login` verifies that the authenticated user possesses the `CUSTOMER` role. Any attempt to log in with an `ADMIN` or `SUPER_ADMIN` account returns `HTTP 403 Forbidden` (`FORBIDDEN_ROLE_ACCESS`), and any newly created session is immediately revoked.
- `POST /api/v1/auth/login/google` and Google OAuth callback reject any account with an administrative role (`ADMIN`, `SUPER_ADMIN`) with `HTTP 403 Forbidden` (`FORBIDDEN_ROLE_ACCESS`). Public Google sign-up will only ever create accounts with `role: CUSTOMER`.
- Task plan `P2-T009`, parent phase file `phase-2-auth-rbac.md`, and `MEMORY.md` are synchronized with this policy.

### DEC-019: Delegation of Authentication Rate Limiting to Reverse Proxy / API Gateway Tier

**Recorded:** 2026-09-14
**Status:** `ACCEPTED`

**Decision:** Formally delegate IP-based and network-level rate limiting for authentication endpoints (including `POST /api/v1/auth/login` and repeated failed attempts) to the infrastructure tier—specifically the Reverse Proxy (Nginx) or Cloudflare / API Gateway boundary. Do not implement single-process in-memory rate-limiting middleware in the Node.js Express application.

**Why:**
1. **Stateless Multi-Instance Architecture:** In production, the backend runs in a clustered or containerized environment (multiple Node.js instances behind a load balancer). In-memory rate limiting within a single Node.js process does not share state across instances, allowing distributed brute-force attempts to leak through.
2. **Resource & DoS Protection:** Network-level rate limiting at the Nginx or Cloudflare edge drops malicious or excessive requests at the socket/kernel layer in microseconds without consuming Node.js CPU cycles, event loop time, or parsing overhead.
3. **Better Auth SDK Isolation:** In our architecture (`Route → Controller → Service → Repository`), authentication services invoke Better Auth's programmatic SDK (`auth.api.signInEmail`), which operates as a direct server-side dispatcher and intentionally bypasses Better Auth's HTTP-level `onRequestRateLimit` pipeline. Adding custom application-level rate limiting would introduce redundant state management without solving distributed coordination.

**Consequences:**
- Node application code remains stateless and lean; no unnecessary in-memory rate limiting middleware or unapproved packages are introduced into Express.
- Deployment specifications require configuring an Nginx / Cloudflare rate-limiting policy (e.g. `limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m; limit_req zone=auth_limit burst=5 nodelay;` returning HTTP 429) for `POST /api/v1/auth/login`.
- `docs/product/PRD.md` (`FR-AUTH-005.4`), `docs/governance/phases/phase-2-auth-rbac.md` (`P2-T008`), `docs/governance/02-ARCHITECTURE.md` (Section 5), and task file `P2-T008` are synchronized with this decision.

### DEC-018: Anti-Enumeration Rejection for Soft-Deleted Accounts on Authentication

**Recorded:** 2026-09-14
**Status:** `ACCEPTED`

**Decision:** Authenticating against soft-deleted accounts (`deletedAt !== null`) via `POST /api/v1/auth/login` must return generic `HTTP 401 Unauthorized` with public error code `INVALID_CREDENTIALS` ("Invalid email or password"), exactly matching non-existent accounts and invalid passwords, rather than returning `HTTP 403 Forbidden` ("Account deleted").

**Why:** Returning a specialized `HTTP 403 Forbidden` specifically for deleted accounts discloses the prior existence and lifecycle history of an account to unauthenticated callers. This enables user enumeration and identity reconnaissance attacks against former customers. Treating soft-deleted accounts as non-existent credentials during authentication aligns with standard OWASP anti-enumeration principles and prevents account-state leakage.

**Consequences:** `databaseHooks.session.create.before` in `src/app/config/auth.ts` throws `APIError("UNAUTHORIZED", { code: "INVALID_CREDENTIALS", message: "Invalid email or password" })` when `deletedAt !== null`. `docs/product/PRD.md` Section 2.2 (`FR-AUTH-005`) error scenario is synchronized to reflect that deleted accounts return generic HTTP 401 Unauthorized for anti-enumeration protection.

### DEC-017: Defer Customer Profile Fields (contactNumber, address) to P2-T024 for Frictionless Registration

**Recorded:** 2026-09-13
**Status:** `ACCEPTED`

**Decision:** Maintain a minimal, frictionless public customer registration contract (`POST /api/v1/auth/register`) consisting exclusively of identity and credential fields: `name` (min 2, max 100), `email` (RFC-compliant, max 255), and `password` (min 8, max 100 with complexity). Do not accept or persist `contactNumber` or `address` during public customer registration. Defer collection, validation, and persistence of customer contact numbers and addresses exclusively to the Customer Profile Update flow (`P2-T024`).

**Why:** Requiring or prompting for phone numbers and physical addresses during initial account creation introduces unnecessary onboarding friction and drops conversion rates. In an e-commerce and interior studio customer journey, contact and shipping address details are contextual and properly collected during profile completion or checkout, not during authentication signup. This aligns with human product governance (`AGENTS.md` Section 1) and honors the original design assumption recorded during `P2-T006` planning (`docs/governance/tasks/phase-2/P2-T006-implement-email-password-customer-registration.md` Section 8).

**Consequences:** `registerCustomerSchema` strictly validates `name`, `email`, and `password`. Any client-supplied profile fields outside these credentials continue to be safely stripped by Zod. `email` is bounded to 255 characters (RFC 5321 / DB constraint guard) and `password` to 100 characters (cryptographic hashing CPU DoS guard). Customer records are initialized with null contact and address attributes upon signup. Full customer profile management, validation, and updates will be implemented and tested under `P2-T024`.

### DEC-016: Structured Validation Error Detail Contract with Explicit Source and Field Separation

**Recorded:** 2026-09-12
**Status:** `ACCEPTED`
**Supersedes:** `DEC-014` (partially: supersedes the dot-notated validation issue path string convention)

**Decision:** Structure validation error details within the public error envelope's `errors` array as discrete objects containing `source` (`"body" | "params" | "query"`), `field` (string identifying the specific target property, e.g. `"email"`, or `"root"` for schema-level issues), and `message` (string). For non-validation error details (such as database unique constraint conflicts), `source` remains optional (`source?: string`).

**Why:** The previous dot-concatenated convention (`"body.<path>"`, `"params.<path>"`) forced frontend consumers to parse or strip transport source prefixes before binding errors to UI form inputs. Separating `source` and `field` cleanly provides structured metadata for API clients while maintaining consistency with database error representations where no transport source exists.

**Consequences:** `ErrorDetail` provides `source?: string`, `field: string`, and `message: string`. Zod validation middleware emits structured objects with explicit `source` and `field`. `03-CODING-STANDARDS.md` is updated to reflect this structured format. The core error envelope (`success`, `message`, `code`, `errors`) and `res.locals.validated` contract established by `DEC-014` remain fully in force.

### DEC-015: Squash Phase 2 Pre-Production Migrations into Unified Canonical Baseline

**Recorded:** 2026-09-12
**Status:** `ACCEPTED`

**Decision:** Squash the legacy pre-production Phase 2 migrations into a single canonical baseline migration (`20260912090148_init`). The resulting migration directly defines all mapped lowercase tables (`user`, `account`, `session`, `verification`, `admin`, `customer`, `audit_log`), canonical constraints, and indexes without destructive `DROP TABLE` operations.

**Why:** The secondary migration generated destructive `DROP TABLE` statements when table mappings (`@@map`) were introduced during `P2-T005`. In a pre-production repository without live production data, maintaining destructive table drops introduces technical debt and deployment risks for CI/CD, staging, and future production deployment. Pre-production squashing establishes an immutable, clean, and safe schema baseline.

**Consequences:** The Phase 2 migration history consists of a single canonical baseline migration. The development database is reset against this canonical baseline with zero schema drift. All future schema modifications must proceed through sequential, non-destructive migrations.

### DEC-014: Standardize Public Error Envelope, Stable Application Error Codes, and Typed Validated-Input Locals Contract

**Recorded:** 2026-09-06
**Status:** `ACCEPTED` (partially superseded by `DEC-016` regarding validation issue path formatting)

**Decision:** Standardize the public error JSON envelope across the backend to require `success` (false), `message` (string), and `code` (string), with an optional `errors` array of field-level details (`field`, `message`). Establish an initial public error-code registry containing `VALIDATION_ERROR`, `ROUTE_NOT_FOUND`, and `INTERNAL_SERVER_ERROR`. Keep startup configuration errors typed internally (`CONFIGURATION_ERROR`) without public HTTP exposure. Validate request inputs at the middleware layer using Zod, and pass parsed/normalized data to controllers exclusively via a typed Express response locals contract (`res.locals.validated` / `ValidatedLocals<T>`) rather than mutating `req.body`, `req.params`, or `req.query`. Deterministically qualify validation issue paths by their request source (`body.<path>`, `params.<path>`, `query.<path>`). Note: Validation issue path formatting is superseded by `DEC-016` to provide discrete `source` and `field` attributes.

**Why:** The previous error response structure allowed inconsistent field names and dev-mode stack trace leakage, violating security and contract stability standards. Passing validated input through `res.locals.validated` guarantees that controllers operate on sanitized and schema-coerced data while leaving Express request objects untouched.

**Consequences:** All HTTP endpoints must conform to the unified success (`sendResponse`) and error (`AppError` / `globalErrorHandler`) envelopes. Unexpected errors will always serialize as HTTP 500 with code `INTERNAL_SERVER_ERROR` and a generic message, preventing information leakage in all environments. New public error codes may only be added through approved feature tasks. Controllers consume parsed and coerced data from `res.locals.validated`.

### DEC-013: Defer Docker, Jest and Winston Until Project Completion

**Recorded:** 2026-09-06
**Status:** `ACCEPTED`

**Decision:** Exclude Docker configuration, Jest setup and Winston integration from Phase 2 and all remaining feature implementation phases. Introduce them later through dedicated, human-approved project-completion tooling tasks after product feature implementation is complete. Retire Phase 2 task IDs `P2-T003` and `P2-T004` without reusing them.

**Why:** The team has chosen to keep current feature delivery focused on application behavior and postpone containerization, automated-test infrastructure and structured logging until the complete product implementation can define their final requirements coherently.

**Consequences:** Phase tasks may close without Jest suites when their approved build, lint, executable/manual acceptance and security checks pass. The placeholder test script remains accepted temporary state. Existing lifecycle `console.*` logging is tolerated only as the documented temporary baseline; new ad hoc debug logging and sensitive-data logging remain prohibited. Docker files remain absent. The later project-completion tooling plan must implement and verify Docker, Jest and Winston across the completed application before production readiness is claimed.

### DEC-012: Defer Docker Configuration

**Recorded:** 2026-09-06
**Status:** `ACCEPTED`

**Decision:** Remove the current root `Dockerfile` and `.dockerignore`, and defer Docker build and runtime configuration until separately approved deployment work.

**Why:** The existing file does not represent an approved production container workflow, and Docker behavior is outside the current implementation focus.

**Consequences:** The repository contains no active Docker configuration and does not currently define a Docker build contract. Generated Prisma Client creation for future container builds must be designed and verified when Docker configuration is introduced. The product remains intended to be containerizable; this decision defers its implementation.

### DEC-011: Discard Disposable Test Migrations and Establish a Clean Phase 2 Baseline

**Recorded:** 2026-09-06
**Status:** `ACCEPTED`

**Decision:** Treat the legacy Prisma migrations and their target database state as disposable test artifacts. Remove the legacy migration files, reset the confirmed test-only database, and let `P2-T001` establish the first canonical Prisma schema and initial migration baseline for Phase 2. This decision does not authorize resetting any shared, staging or production database.

**Why:** The legacy `User` and `Post` migration was created only for testing, the approved application model has not yet been implemented, and the inspected database contained no business tables. Preserving the legacy history would add false implementation history and complicate the approved Phase 2 baseline.

**Consequences:** `P2-B006` is resolved and Phase 2 may move to `ACTIVE/READY`. The disposable test database has zero migration records and no business tables. This was a one-time reset of the inspected disposable test database, not a repeatable setup instruction. Never reset another developer, shared, staging or production database automatically. Each developer must use a clean isolated development database or explicitly approve resetting their own disposable database. `P2-T001` remains `🔲` until its persistent JIT plan is human-approved, after which it will create the canonical Phase 2 schema and migration.

### DEC-010: Persistent Just-In-Time (JIT) Task Planning and Preparation Gate

**Recorded:** 2026-09-05  
**Status:** `ACCEPTED`

**Decision:** Do not generate all phase task files upfront. Instead, create a persistent Just-In-Time (JIT) task file under `docs/governance/tasks/<phase-folder>/<TASK_ID>-<short-name>.md` only for the currently selected task using `docs/governance/tasks/_template.md`. Furthermore, enforce a preparation and planning gate before marking a task `🔄 In progress`: perform read-only inspection, draft the concrete execution plan in the JIT task file, resolve blockers/assumptions, submit it for human review, and mark `🔄` only upon approval. Post-implementation, concise actual evidence (changed files, tests, deviations) is recorded in the task file as a permanent audit trail.

**Why:** IDE-specific artifacts (e.g., Antigravity `implementation_plan.md`) lack continuity across models, IDEs, and new chat sessions. Conversely, generating dozens of task files upfront creates massive maintenance overhead. JIT task files provide model-independent, git-tracked continuity and token-efficient execution while preserving canonical scope in the phase file.

**Consequences:** `docs/governance/tasks/` holds individual task plans and permanent execution evidence. Phase files remain canonical for scope, boundaries, and task status. While canonical status remains `🔲`, the selected task passes through Draft Plan → Human Plan Approval. Canonical execution status then proceeds `🔲` → `🔄` → `🕵️` → `✅`.

### DEC-009: Human Authority Over Git Operations and Environment Invariance

**Recorded:** 2026-09-05  
**Status:** `ACCEPTED`

**Decision:** AI agents must never execute git commits or pushes autonomously without explicit human direction. Furthermore, all AI models and IDE environments (Cursor, Windsurf, Copilot, Antigravity, Claude Code) must conform strictly to canonical repository governance, and environment-specific configs must never contradict repository rules.

**Why:** Autonomous AI commits pollute git history, risk committing unintended/secret files, and bypass human accountability. Multi-environment development requires a single canonical source of truth.

**Consequences:** AI proposes conventional commit messages upon task review approval; human approves or executes git commits. Tool configurations are strictly subordinated to `AGENTS.md` and `docs/governance/`.

### DEC-008: Progressive Scope Integration and Governance Synchronization

**Recorded:** 2026-09-05  
**Status:** `ACCEPTED`

**Decision:** Future business modules (Inquiries, Commerce, Cart, Payments, Blog, Showcases) will be integrated phase-wise into the PRD. When product teams finalize a new phase, AI agents must update canonical governance files (`06-PHASE-ROADMAP.md`, phase execution plans, `DECISIONS.md`) and receive explicit human approval before any implementation begins.

**Why:** Product vision must not be mistaken for approved implementation scope. Prevents speculative coding and hallucinated business logic.

**Consequences:** Future module absence in the active phase is treated as intentional, not missing. AI must never invent requirements for future modules.

### DEC-007: Separate Phase Status From Execution Readiness

**Recorded:** 2026-09-05  
**Status:** `ACCEPTED`

**Decision:** `ACTIVE` identifies the current approved phase. `READY` or
`BLOCKED` separately determines whether implementation may proceed.

**Why:** A phase may be current while its task plan or prerequisites are not yet approved.

**Consequences:** `ACTIVE/BLOCKED` is valid. Implementation requires an active,
ready phase with an eligible task.

### DEC-006: One-Task Workflow With Human Approval

**Recorded:** 2026-09-05  
**Status:** `ACCEPTED`

**Decision:** Only one task may be in progress or awaiting review across the project. Verification, explicit human approval and governance updates are required before closure.

**Why:** Small review checkpoints reduce scope drift and preserve continuity across contributors and tools.

**Consequences:** Review corrections remain in the same task. The next task cannot begin before closure under [05-TASK-WORKFLOW.md](05-TASK-WORKFLOW.md).

### DEC-005: Responsibility-Driven Module Structure

**Recorded:** 2026-09-05  
**Status:** `ACCEPTED`

**Decision:** Module file count follows real responsibilities, not a fixed template. Custom interface and type files are optional; Prisma-generated contracts are reused when sufficient.

**Why:** Clear boundaries should not require empty, duplicate or speculative files.

**Consequences:** Add files and abstractions only when an application-level responsibility requires them.

### DEC-004: Replaceable External Provider Boundaries

**Recorded:** 2026-09-05  
**Status:** `ACCEPTED`

**Decision:** Stripe, Cloudinary, SMTP, Redis and other external providers remain behind approved application boundaries.

**Why:** Provider changes should not require rewriting unrelated business logic.

**Consequences:** Feature code must not depend directly on provider SDKs when an application-level boundary is appropriate.

### DEC-003: Better Auth Owns Authentication Mechanics

**Recorded:** 2026-09-05  
**Status:** `ACCEPTED`

**Decision:** Better Auth owns credential handling, session lifecycle, email verification and Google authentication mechanics. Application code owns RBAC, authorization, ownership, account status and business restrictions.

**Why:** Security-sensitive authentication primitives should not be reimplemented in application business logic.

**Consequences:** A second authentication system or application-managed token contract requires an approved architecture change.

### DEC-002: Layered Modular Architecture

**Recorded:** 2026-09-05  
**Status:** `ACCEPTED`

**Decision:** Use the default request flow:

```text
Route → Middleware → Controller → Service → Repository → Prisma → PostgreSQL
```

**Why:** Explicit responsibilities and dependency direction keep modules predictable and maintainable.

**Consequences:** Controllers remain thin, services own business behavior and repositories own persistence.

### DEC-001: Shared AI Governance Entry Point

**Recorded:** 2026-09-05  
**Status:** `ACCEPTED`

**Decision:** Use root [AGENTS.md](../../AGENTS.md) as the universal AI entry point, supported by focused documents under `docs/governance/`.

**Why:** Contributors using different AI models and IDEs need the same durable, token-efficient project context.

**Consequences:** Tool-specific instructions may point to canonical governance but must not create a parallel governance system.

## New Entry Template

```markdown
### DEC-NNN: <Short Decision Title>

**Recorded:** YYYY-MM-DD  
**Status:** `ACCEPTED`  
**Supersedes:** `DEC-NNN` or `None`

**Decision:** <What was approved?>

**Why:** <What constraint, trade-off or reasoning led to it?>

**Consequences:** <What must future work follow?>

**Affected Sources:** <Documents or code boundaries that must align>
```

When superseding a decision, mark the earlier entry `SUPERSEDED`, reference the new ID and update every affected source before relying on the new decision.
