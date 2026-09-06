# Phase <N>: <Phase Name>

> Canonical execution plan for this phase.
> One task equals one implementation and human-review cycle under [05-TASK-WORKFLOW.md](../05-TASK-WORKFLOW.md).

## 1. Phase Identity

| Field        | Value        |
| ------------ | ------------ |
| Phase        | `Phase <N>`  |
| Status       | `PLANNED`    |
| Readiness    | `N/A`        |
| Last updated | `YYYY-MM-DD` |

Use only status and readiness combinations defined in [06-PHASE-ROADMAP.md](../06-PHASE-ROADMAP.md).
These values mirror the roadmap and must be updated with it.

## 2. Goal and Requirement Boundary

**Goal:** <Describe the approved phase outcome and why it exists in one short paragraph.>

**Requirement Sources:**

| Source    | Approved Coverage                     |
| --------- | ------------------------------------- |
| PRD       | `<Sections and requirement IDs>`      |
| ERD       | `<Entities and relationships or N/A>` |
| Decisions | `<DEC-NNN references or None>`        |

### In Scope

- <Approved capability or deliverable>

### Out of Scope

- <Adjacent or future capability excluded from this phase>

Do not convert product vision, chat discussion or AI inference into phase scope.

## 3. Readiness

- [ ] Requirement sources and phase boundaries are approved.
- [ ] ERD impact is approved where applicable.
- [ ] Tasks are small, ordered and independently reviewable.
- [ ] Every task has requirement references and acceptance criteria.
- [ ] Dependencies and exclusions are clear.
- [ ] Relevant product, architecture, security and data conflicts are resolved.
- [ ] The task breakdown is human-approved.

An active phase remains `BLOCKED` until every applicable item is satisfied.

## 4. Phase Constraints

| Area               | Approved Constraint or Impact                               |
| ------------------ | ----------------------------------------------------------- |
| Architecture       | `<Existing contract, approved change or None>`              |
| Public API         | `<Approved boundary or None>`                               |
| Data and migration | `<Approved ERD/migration impact or None>`                   |
| Security           | `<Authentication, authorization, ownership or other rules>` |
| External providers | `<Approved boundary or None>`                               |

Reference [DECISIONS.md](../DECISIONS.md) for durable changes. This file does not approve a new product or architecture decision by itself.

## 5. Task Index

| Order | Task ID     | Task                    | Status | Depends On  |
| ----- | ----------- | ----------------------- | ------ | ----------- |
| 1     | `P<N>-T001` | `<Single focused task>` | `🔲`   | `None`      |
| 2     | `P<N>-T002` | `<Single focused task>` | `🔲`   | `P<N>-T001` |

Only one task may be `🔄` or `🕵️` across the project at a time. Execute tasks in order unless dependencies and human approval allow a different sequence. The Task Index is the canonical location for task status. Update status here, not in the detailed task block.

## 6. Task Definitions

Copy this block for every approved task, then remove this instruction.

### P<N>-T001: <Task Title>

**Requirement references:** `<PRD IDs, ERD area and decision IDs>`  
**Depends on:** `<Task IDs or None>`

**Objective:** <State one independently reviewable outcome.>

**Scope:**

- <Required work>

**Acceptance Criteria:**

- [ ] <Observable or verifiable result>
- [ ] <Observable or verifiable result>
- [ ] No out-of-scope behavior is included.

**Verification:**

| Check                    | Required   | Command or Method         | Result    |
| ------------------------ | ---------- | ------------------------- | --------- |
| Acceptance criteria      | Yes        | `<Method>`                | `NOT RUN` |
| Type check               | `<Yes/No>` | `<Command>`               | `NOT RUN` |
| Lint                     | `<Yes/No>` | `<Command>`               | `NOT RUN` |
| Tests                    | `<Yes/No>` | `<Command or test scope>` | `NOT RUN` |
| Build                    | `<Yes/No>` | `<Command>`               | `NOT RUN` |
| Migration/data integrity | `<Yes/No>` | `<Command or method>`     | `NOT RUN` |

Use `PASS`, `FAIL` or `NOT RUN`, with a reason when a check does not run. A task is not review-ready while a required check failed or could not run.

**Implementation Notes:** <Concise facts needed to review or resume the task. Upon approval: update memory/decisions, and propose conventional git commit message under human direction.>

**Human Review:**

| Field       | Value                                        |
| ----------- | -------------------------------------------- |
| Submitted   | `YYYY-MM-DD or Pending`                      |
| Outcome     | `Pending`, `Changes requested` or `Approved` |
| Reviewed by | `<Name or Pending>`                          |
| Reviewed on | `YYYY-MM-DD or Pending`                      |
| Notes       | `<Concise decision or None>`                 |

## 7. Blockers and Open Decisions

| ID      | Type                                                                  | Issue           | Required Action                 | Status |
| ------- | --------------------------------------------------------------------- | --------------- | ------------------------------- | ------ |
| `B-001` | `<Requirement, Architecture, Security, Data, Dependency or External>` | `<Description>` | `<Specific decision or action>` | `OPEN` |

Remove the placeholder row when none exist. Do not invent a resolution. Record approved durable choices in [DECISIONS.md](../DECISIONS.md). Use only `OPEN` or `RESOLVED` for blocker status.

## 8. Phase Completion

- [ ] Every required task is `✅`.
- [ ] Phase-level acceptance criteria and required checks are satisfied.
- [ ] Migrations and data-integrity verification are complete where applicable.
- [ ] Blockers and approved deferred work are documented.
- [ ] The phase file, [MEMORY.md](../MEMORY.md), [DECISIONS.md](../DECISIONS.md) and [06-PHASE-ROADMAP.md](../06-PHASE-ROADMAP.md) are consistent.
- [ ] Explicit human approval for phase completion is recorded.

| Approval Field | Value                                 |
| -------------- | ------------------------------------- |
| Outcome        | `Pending`                             |
| Approved by    | `<Name or Pending>`                   |
| Approved on    | `YYYY-MM-DD or Pending`               |
| Notes          | `<Limitation, deferred work or None>` |

Do not mark the phase `COMPLETE` or activate another phase before completing the transition defined by [05-TASK-WORKFLOW.md](../05-TASK-WORKFLOW.md) and [06-PHASE-ROADMAP.md](../06-PHASE-ROADMAP.md).

## 9. Maintenance Rule

- Update task status and verified execution facts in place.
- Keep task IDs stable after approval.
- Do not duplicate full PRD, ERD, memory or decision content.
- Update affected sources and obtain human approval before implementing a scope change.
