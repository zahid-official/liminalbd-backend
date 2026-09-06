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

### DEC-014: Standardize Public Error Envelope, Stable Application Error Codes, and Typed Validated-Input Locals Contract

**Recorded:** 2026-09-06
**Status:** `ACCEPTED`

**Decision:** Standardize the public error JSON envelope across the backend to require `success` (false), `message` (string), and `code` (string), with an optional `errors` array of field-level details (`field`, `message`). Establish an initial public error-code registry containing `VALIDATION_ERROR`, `ROUTE_NOT_FOUND`, and `INTERNAL_SERVER_ERROR`. Keep startup configuration errors typed internally (`CONFIGURATION_ERROR`) without public HTTP exposure. Validate request inputs at the middleware layer using Zod, and pass parsed/normalized data to controllers exclusively via a typed Express response locals contract (`res.locals.validated` / `ValidatedLocals<T>`) rather than mutating `req.body`, `req.params`, or `req.query`. Deterministically qualify validation issue paths by their request source (`body.<path>`, `params.<path>`, `query.<path>`).

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
