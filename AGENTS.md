# AGENTS.md: Liminal Backend AI Agent Entry Point

> **Read this file first at the beginning of every new AI session,
> before inspecting or modifying code.**

This is the universal entry point for AI-assisted work in this repository. It is designed to work across AI coding environments and models.

`AGENTS.md` is an **entry point and router**, not a duplicate of the entire project documentation. Read the linked governance documents only when required by the current task.

All AI coding environments (e.g., Cursor, Windsurf, Copilot, Antigravity, Claude Code) and models must adhere strictly to this repository's governance. Environment-specific configurations must never override or contradict the rules defined here.

---

## 1. Operating Principle

Liminal Backend is an **AI-assisted, human-governed codebase**.

AI may assist with implementation, analysis, testing, review and documentation.

Humans own:

- product decisions;
- scope decisions;
- architecture approval;
- requirement approval;
- final task approval.

AI must not invent missing requirements or make unapproved product or architecture decisions.

---

## 2. Non-Negotiable Rule: One Task at a Time

Work on **exactly one task at a time**.

For every task:

1.  Select one eligible task.
2.  Mark it `🔄 In progress`.
3.  Read only the context required for that task.
4.  Implement only that task.
5.  Run the required checks and tests.
6.  Self-review against the task requirements and project rules.
7.  Mark it `🕵️ Awaiting human review`.
8.  Stop and present the result.
9.  Wait for explicit human approval.
10. Only after approval:

- mark the task `✅ Done`;
- update `MEMORY.md`;
- update `DECISIONS.md` when a durable decision was made;
- update the roadmap when required.

**Never begin the next task without explicit human approval.**

Full workflow:

`docs/governance/05-TASK-WORKFLOW.md`

---

## 3. Project Identity

Liminal Backend is the production-grade backend API for **Liminal Interior Design Studio**.

The broader product serves:

- interior design services;
- custom furniture inquiries;
- ready-made furniture commerce;
- customer accounts;
- role-based administration.

However, **product vision is not the same as approved implementation scope**.

The currently approved implementation phases are:

- **Phase 1: Foundation**
- **Phase 2: Authentication & RBAC**

The authoritative project context is:

`docs/governance/01-PROJECT-CONTEXT.md`

The authoritative phase status is:

`docs/governance/06-PHASE-ROADMAP.md`

---

## 4. Architecture Contract

The default application flow is:

**Route → Controller → Service → Repository → Prisma**

High-level responsibilities:

- **Route**: HTTP endpoint and middleware mapping.
- **Controller**: request handling and response orchestration.
- **Service**: business logic, authorization decisions, orchestration,
  and transactions where appropriate.
- **Repository**: persistence logic and Prisma access.
- **Prisma**: must not be called directly from controllers or
  unrelated services.

Do not introduce a different architectural pattern based only on AI preference.

Full architecture rules:

`docs/governance/02-ARCHITECTURE.md`

---

## 5. Coding and Governance Rules

Before implementing or modifying code, follow:

- `docs/governance/03-CODING-STANDARDS.md`
- `docs/governance/04-RULES.md`

These documents define the required conventions, boundaries and prohibited behavior.

When AI preference conflicts with an established repository rule or approved decision, follow the repository source of truth.

AI agents must never install new npm/pnpm packages or introduce unapproved third-party architectural libraries without explicit human approval.

---

## 6. Source-of-Truth Hierarchy

When information conflicts, follow this order:

1.  Explicit human instruction for the current approved task.
2.  Approved PRD and ERD requirements.
3.  Active phase file and task acceptance criteria.
4.  Recorded decisions in `DECISIONS.md`.
5.  Architecture, coding standards and rules.
6.  Current-state summary in `MEMORY.md`.
7.  Established codebase patterns.
8.  AI inference.

**AI inference is the weakest source of truth.**

Never invent requirements, business rules, API behavior, database structure or scope merely to keep implementation moving.

---

## 7. Where Project Knowledge Lives

| Document                  | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `01-PROJECT-CONTEXT.md`   | Product meaning and approved scope                   |
| `02-ARCHITECTURE.md`      | Architecture and technical boundaries                |
| `03-CODING-STANDARDS.md`  | Code style and implementation conventions            |
| `04-RULES.md`             | Hard rules and prohibited behavior                   |
| `05-TASK-WORKFLOW.md`     | Task execution, review, approval, and update process |
| `06-PHASE-ROADMAP.md`     | Phase status and active phase                        |
| `MEMORY.md`               | Condensed current state of the codebase              |
| `DECISIONS.md`            | Durable decisions and rationale                      |
| `docs/governance/phases/` | Task-level execution plans                           |
| `docs/product/PRD.md`     | Full functional requirements                         |
| `docs/product/ERD.drawio` | Entity and data-model design                         |

---

Do not duplicate detailed information across governance files unnecessarily.

---

## 8. Session Startup Protocol

At the beginning of every new AI session:

1.  Read `AGENTS.md`.
2.  Read `docs/governance/MEMORY.md`.
3.  Read `docs/governance/06-PHASE-ROADMAP.md`.
4.  Identify the single `ACTIVE` phase.
5.  Open its phase file.
6.  Check whether a task is already `🔄 In progress` or
    `🕵️ Awaiting human review`.
    - If yes, continue or resolve that task.
    - Do not start another task.
7.  Select the next eligible task.
8.  Read task-specific requirements only when the phase file is insufficient.
9.  Read `03-CODING-STANDARDS.md` and `04-RULES.md`.
10. Inspect only the relevant code and dependencies.
11. Follow the one-task workflow.

Do not automatically read the entire PRD, ERD or repository.

Read additional context only when required by the current task.

---

## 9. Requirement Changes

When the PRD or ERD changes (e.g., when new phase modules are finalized):

1.  Do not immediately implement code changes.
2.  Identify the affected phase and verify alignment with `docs/product/PRD.md` (Phase-Wise Scope Evolution).
3.  Update the relevant phase execution plan (`phases/phase-X-...md`).
4.  Update governance documents only where the change affects their purpose.
5.  Record durable decisions in `DECISIONS.md`.
6.  Update `docs/governance/06-PHASE-ROADMAP.md` when phase status or scope changes.
7.  Obtain explicit human approval for the updated task breakdown.
8.  Begin implementation only after approval.

---

## 10. Stop and Escalate

Stop and ask for human direction when:

- requirements are ambiguous or contradictory;
- a required product or business decision is missing;
- the PRD, ERD and phase file conflict;
- implementation requires changing the approved architecture;
- a security-sensitive assumption would be required;
- completing the work would silently require another task;
- existing code contradicts the documented source of truth.

Do not invent behavior simply to keep development moving.

---

## 11. Completion Rule

A task is **not complete merely because the code compiles**.

A task may be marked `🕵️ Awaiting human review` only after:

- acceptance criteria have been checked;
- required validation and tests have been performed;
- relevant architecture and coding rules have been reviewed.

A task becomes `✅ Done` only after:

1.  explicit human approval; and
2.  required governance updates.

---

## 12. Final Principle

When unsure:

1.  Do not guess.
2.  Follow the source-of-truth hierarchy.
3.  Read the relevant governance document.
4.  Ask for human direction if ambiguity remains.

**Consistency over AI autonomy.**

**Controlled progress over unreviewed speed.**

**One approved task at a time.**
