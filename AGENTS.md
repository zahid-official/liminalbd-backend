# AGENTS.md — Liminal Backend AI Governance Entry Point

> **Read this file first at the beginning of every new AI session, before inspecting or modifying code.**
>
> This is the universal entry point for AI-assisted work in this repository.
> It is designed to work across Google Antigravity, Claude Code, Cursor,
> Windsurf, Copilot, and other AI coding environments or models that can read
> repository instructions.
>
> This file is an **entry point and router**, not a duplicate of the entire
> project documentation. Follow the linked governance documents for detailed
> rules and context.

---

## 1. Mission

Liminal Backend is an **AI-native, human-governed codebase**.

The purpose of this governance system is to ensure that every AI agent:

- understands the project and current implementation state quickly;
- follows the same architecture and coding conventions;
- uses only the context required for the current task;
- avoids inventing missing requirements;
- executes exactly one approved task at a time;
- preserves important project knowledge after human approval;
- produces consistent results across different AI models, IDEs, developers,
  devices, and sessions.

AI may assist with implementation, analysis, review, testing, and
documentation.

**Humans own product decisions, scope, architecture approval, and final task
approval.**

---

## 2. Non-Negotiable Rule: One Task at a Time

For the active phase, work on **exactly one task at a time**.

The required workflow is:

1. Select one eligible task.
2. Mark it `🔄 In progress`.
3. Read only the context required for that task.
4. Implement only that task.
5. Run required checks and tests.
6. Self-review against requirements, architecture, standards, and rules.
7. Mark the task `🕵️ Awaiting human review`.
8. Stop and present the result.
9. Wait for explicit human approval.
10. Only after approval:
   - mark the task `✅ Done`;
   - update `MEMORY.md`;
   - update `DECISIONS.md` if a durable decision was made;
   - update the phase roadmap if the phase is complete.

**Never begin the next task without explicit human approval.**

Full workflow:

`docs/governance/05-TASK-WORKFLOW.md`

---

## 3. Project Identity

Liminal Backend is the production-grade backend API for **Liminal Interior
Design Studio**.

The broader product supports:

- interior design services and project showcases;
- custom furniture inquiries;
- ready-made furniture commerce;
- customer accounts;
- role-based administration;
- future payments, media, content, caching, and audit capabilities.

Do not assume that every planned product area is currently implementation-ready.

The current implementation scope is determined by the approved roadmap and
active phase file.

Full project context:

`docs/governance/01-PROJECT-CONTEXT.md`

---

## 4. Architecture Contract

The default application flow is:

**Route → Controller → Service → Repository → Prisma**

High-level responsibilities:

- **Route** — HTTP method and endpoint mapping only.
- **Controller** — request handling, validated input, service invocation, and
  HTTP response orchestration.
- **Service** — business logic, orchestration, business-level authorization,
  and transactions where appropriate.
- **Repository** — persistence logic and Prisma access.
- **Prisma** — must not be called directly from controllers or unrelated
  services.

Do not introduce a different architectural pattern based only on AI preference.

Full architecture rules:

`docs/governance/02-ARCHITECTURE.md`

---

## 5. Coding and Engineering Rules

Before implementing or modifying code, follow:

- `docs/governance/03-CODING-STANDARDS.md`
- `docs/governance/04-RULES.md`

These documents define:

- naming;
- code organization;
- validation;
- error handling;
- API response conventions;
- logging;
- security boundaries;
- allowed and prohibited behavior.

When a generic AI preference conflicts with an established repository pattern,
follow the repository pattern unless a human-approved change is recorded in
`DECISIONS.md`.

---

## 6. Current Phase Model

The project progresses through controlled implementation phases.

Current phase numbering:

| Phase | Name | Status |
|---|---|---|
| Phase 1 | Foundation | Completed |
| Phase 2 | Authentication & RBAC | Active unless the roadmap changes |
| Phase 3 | Project Showcase Module | Planning only until PRD, ERD, and phase breakdown are approved |
| Phase 4+ | Future modules | Not implementation-ready unless formally added |

The authoritative phase status is always:

`docs/governance/06-PHASE-ROADMAP.md`

Do not rely on this table if the roadmap has changed.

Only **one phase may be ACTIVE at a time**.

---

## 7. Source-of-Truth Hierarchy

When information conflicts, follow this order:

1. Explicit human instruction for the current approved task.
2. Approved PRD and ERD requirements.
3. Active phase file and task acceptance criteria.
4. Recorded decisions in `DECISIONS.md`.
5. Architecture, coding standards, and rules.
6. Current-state summary in `MEMORY.md`.
7. Established codebase patterns.
8. AI inference.

**AI inference is the weakest source of truth.**

Never invent product requirements, business rules, API behavior, database
structure, or future scope merely to keep implementation moving.

If a conflict cannot be resolved from the available sources, stop and ask for
human direction.

---

## 8. Where Project Knowledge Lives

Use each document for its specific purpose.

| Document | Purpose |
|---|---|
| `01-PROJECT-CONTEXT.md` | What the product is and why it exists |
| `02-ARCHITECTURE.md` | Architecture, layers, module structure, and technical boundaries |
| `03-CODING-STANDARDS.md` | Code style and implementation conventions |
| `04-RULES.md` | Hard rules, constraints, and prohibited behavior |
| `05-TASK-WORKFLOW.md` | One-task execution, review, approval, and update process |
| `06-PHASE-ROADMAP.md` | Current and future phase status |
| `MEMORY.md` | Condensed current state of the codebase |
| `DECISIONS.md` | Durable technical decisions and their rationale |
| `phases/` | Task-level execution plans for each approved phase |
| `docs/product/PRD.md` | Full functional requirements |
| `docs/product/ERD.drawio` | Full database and entity relationship design |

Do not duplicate the same information across multiple governance files unless
there is a clear operational reason.

---

## 9. Session Startup Protocol

At the beginning of every new AI session:

1. Read `AGENTS.md`.
2. Read `docs/governance/MEMORY.md`.
3. Read `docs/governance/06-PHASE-ROADMAP.md`.
4. Identify the single `ACTIVE` phase.
5. Open the corresponding phase file.
6. Check whether another task is already marked `🔄` or `🕵️`.
   - If yes, continue or resolve that task.
   - Do not start a new task.
7. Select the next eligible task.
8. Read the task-specific requirements.
9. Read `03-CODING-STANDARDS.md` and `04-RULES.md`.
10. Inspect only the relevant existing code.
11. Follow the one-task workflow.

Do not automatically read the entire PRD, ERD, or repository.

Read additional context only when the current task requires it.

---

## 10. Requirement Change Protocol

When the PRD or ERD changes:

1. **Do not immediately implement the new requirement.**
2. Identify which phase is affected.
3. Create or update the relevant phase file.
4. Update `01-PROJECT-CONTEXT.md` if the product understanding changed.
5. Update `02-ARCHITECTURE.md` only if the architecture changed.
6. Record durable decisions or trade-offs in `DECISIONS.md`.
7. Update `06-PHASE-ROADMAP.md`.
8. Present the proposed governance changes for human review.
9. Begin implementation only after the phase and task breakdown are approved.

Future requirements must not be implemented before they are formally represented
in the approved PRD/ERD and execution plan.

---

## 11. Context Efficiency Rules

To minimize unnecessary token usage and context drift:

- Start with `AGENTS.md` and `MEMORY.md`.
- Read the active phase file before reading the full PRD.
- Read only the PRD or ERD sections required by the current task.
- Inspect only relevant modules and dependencies.
- Keep `MEMORY.md` short and current.
- Keep historical reasoning in `DECISIONS.md`.
- Keep phase files focused on executable tasks.
- Prefer references between documents instead of duplicating large blocks of
  information.

The goal is:

> **Maximum relevant context with minimum unnecessary context.**

---

## 12. Stop and Escalate

Stop implementation and ask for human direction when:

- requirements are ambiguous or contradictory;
- a required business decision is missing;
- the PRD, ERD, and phase file conflict;
- implementation requires changing the approved architecture;
- a security-sensitive assumption would be required;
- a future phase has no approved task breakdown;
- completing the current work would require silently implementing another task;
- the existing codebase contradicts the documented source of truth.

Do not silently invent behavior to keep development moving.

---

## 13. Completion Rule

A task is **not complete merely because the code compiles**.

A task may be marked `🕵️ Awaiting human review` only after:

- its acceptance criteria have been checked;
- required tests and validation have been performed;
- architecture and coding standards have been reviewed;
- relevant security and error scenarios have been considered.

A task becomes `✅ Done` only after:

1. explicit human approval; and
2. required governance documentation updates.

---

## 14. Tool-Specific Instruction Files

Tool-specific instruction files may exist for compatibility with different AI
coding environments, such as:

- `CLAUDE.md`
- `.cursorrules`
- `.windsurfrules`
- other IDE-specific instruction files

These files must remain minimal and point to `AGENTS.md`.

Do not duplicate the complete governance system across multiple AI-specific
instruction files.

If genuinely tool-specific behavior is required, keep it narrowly scoped and
avoid repeating universal project rules.

---

## 15. Final Operating Principle

If you are unsure what to do:

1. Do not guess.
2. Return to the source-of-truth hierarchy.
3. Read the relevant governance document.
4. Ask for human direction if the ambiguity remains.

**Consistency is more important than AI autonomy.**

**Controlled progress is more important than fast but unreviewed implementation.**

**One approved task at a time.**