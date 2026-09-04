# 05. Task Workflow

> Defines how one approved task is selected, implemented, verified, reviewed and closed.
> Source-of-truth precedence follows `AGENTS.md`; mandatory boundaries follow `04-RULES.md`.

## 1. Core Principle

**One task, one implementation cycle, one human review and one approval before the next task begins.**

This workflow applies across all contributors, AI models and IDEs.

## 2. Task Status

| Status | Meaning |
|---|---|
| `🔲` | Not started |
| `🔄` | In progress, including requested corrections |
| `🕵️` | Implemented and awaiting human review |
| `✅` | Human-approved and fully closed |

Only one task may be `🔄` or `🕵️` across the project at a time. If the recorded state violates this rule, stop and resolve the earlier task first.

## 3. Select and Start

1. Complete the session startup protocol in `AGENTS.md`.
2. Resume any task already `🔄` or `🕵️`; otherwise select the first eligible task in the active phase file.
3. Confirm its objective, scope, acceptance criteria, dependencies and affected areas.
4. Read only the relevant PRD, ERD, decisions, code and dependency context.
5. Check the task against `02-ARCHITECTURE.md`, `03-CODING-STANDARDS.md` and `04-RULES.md`.
6. Mark only the selected task `🔄` before changing code.

A task is eligible only when its phase is `ACTIVE`, its requirements and acceptance criteria are defined, required predecessors are `✅` and no unresolved conflict or blocker prevents implementation.

Do not select work from an inactive, future or undefined phase. Do not begin implementation when a required product, architecture, security, API or data-model decision is missing.

## 4. Implement

- Implement only the active task and its acceptance criteria.
- Keep every change traceable to the task.
- Follow approved architecture, contracts and repository conventions.
- Preserve approved behavior outside the task.
- Do not include adjacent work, unrelated refactors, speculative abstractions or future scope.
- Report unrelated findings separately.

If implementation requires expanded scope or another task, follow Section 7.

## 5. Verify and Self-Review

Run the checks applicable to the task, including relevant formatting, linting, type checking, tests, build, migration and data-integrity checks.

Self-review the complete task against:

- every acceptance criterion;
- approved PRD and ERD requirements;
- architecture, coding standards and hard rules;
- validation, authorization, ownership, account-status and data-exposure requirements;
- errors, regressions and unintended changes.

Fix in-scope issues and rerun affected checks. Report each check as:

```text
PASS      Completed successfully
FAIL      Completed and failed
NOT RUN   Not run, with the reason stated
```

Do not claim a check passed unless it ran and passed. A task is not ready for review while a known requirement violation remains or a required check failed or could not run. Escalate the blocker unless an approved governance change removes or replaces that requirement.

## 6. Human Review

When implementation, verification and self-review are complete:

1. Mark the task `🕵️`.
2. Present:
   - what changed and why;
   - acceptance criteria addressed;
   - materially affected files or behavior;
   - checks run and results;
   - relevant API, migration, compatibility or security impact;
   - unresolved limitations or separate follow-up findings.
3. Stop and wait for explicit human approval.

AI self-review, passing checks and human silence do not constitute approval. Do not begin another task while review is pending.

If changes are requested:

1. Return the same task to `🔄`.
2. Apply corrections within its approved scope.
3. Follow Section 7 if feedback changes requirements, scope or architecture.
4. Repeat affected verification and self-review.
5. Return the task to `🕵️`, present updated evidence and stop again.

## 7. Changes, Conflicts and Blockers

Stop the affected work when:

- requirements are missing, ambiguous or contradictory;
- authoritative sources conflict;
- architecture, public API or data-model changes are required;
- a security-sensitive assumption is required;
- completion requires another task or an unapproved dependency;
- a required check cannot be completed.

State the issue, impact and specific decision needed. Do not start another task merely because the current one is blocked.

For a proposed requirement or scope change, use:

```text
Proposal → Impact assessment → Product source update → Governance and task update → Human approval → Implementation
```

Do not implement an unapproved change. For an architecture change, obtain explicit approval, record it in `DECISIONS.md`, update `02-ARCHITECTURE.md` and the affected task plan, then resume implementation.

## 8. Close an Approved Task

Explicit human approval unlocks closure. Complete these updates as one controlled step:

1. record the approved outcome and completion date in the active phase file;
2. update `MEMORY.md` with concise, verified current state;
3. update `DECISIONS.md` only when a durable decision or approved deviation exists;
4. update `06-PHASE-ROADMAP.md` only when phase status or scope changed;
5. mark the task `✅` and confirm all closure records are consistent.

Only after closure may the next task begin.

| Document | Responsibility |
|---|---|
| Active phase file | Task scope, acceptance criteria and execution status |
| `MEMORY.md` | Concise, verified current state and established patterns |
| `DECISIONS.md` | Durable decisions, rationale and approved deviations |
| `06-PHASE-ROADMAP.md` | Approved phase scope and status |

Update the relevant section instead of appending conversation history. Do not duplicate the same detail across every document.

## 9. Phase Completion

When all required tasks appear closed:

1. confirm every task is `✅`;
2. confirm phase-level acceptance criteria and checks are satisfied;
3. identify unresolved blockers or approved deferred work;
4. obtain explicit human approval for the phase transition;
5. update `06-PHASE-ROADMAP.md`, the phase file and `MEMORY.md` consistently.

Only one phase may be `ACTIVE`. Do not activate or begin the next phase until its scope and task breakdown are approved.

## 10. Session Continuity and Definition of Done

Canonical governance files carry task state across chats, IDEs and AI models. A new session must follow `AGENTS.md` and resume or resolve any existing `🔄` or `🕵️` task before selecting another.

When a session ends with unfinished work, leave task status, verified progress and blockers accurate. Do not record partial or unreviewed behavior as approved current state.

A task is `✅` only when:

- its approved scope and acceptance criteria are satisfied;
- required verification and self-review are complete;
- no known requirement or security issue is hidden;
- explicit human approval has been received;
- required governance updates are complete.

Compilation alone does not define completion.
