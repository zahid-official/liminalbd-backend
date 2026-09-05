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
