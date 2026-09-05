# 06. Phase Roadmap

> Canonical summary of approved phase scope, status and implementation readiness.
> Detailed tasks and execution state belong in the corresponding file under `phases/`.

## 1. Roadmap Rules

- Only one phase may be `ACTIVE` at a time.
- `ACTIVE` identifies the current approved scope; readiness determines whether implementation may proceed.
- An `ACTIVE` phase may be either `READY` or `BLOCKED`.
- Future product vision is not approved implementation scope.
- Phase transitions follow `05-TASK-WORKFLOW.md` and require explicit human approval.
- PRD or ERD changes require impact assessment before roadmap or implementation changes.

## 2. Status and Readiness

| Status         | Readiness | Meaning                                                             |
| -------------- | --------- | ------------------------------------------------------------------- |
| `PLANNED`      | `N/A`     | Approved scope, but not the current phase                           |
| `ACTIVE`       | `READY`   | Current phase and implementation may proceed through eligible tasks |
| `ACTIVE`       | `BLOCKED` | Current scope, but implementation cannot proceed                    |
| `COMPLETE`     | `N/A`     | Human-approved phase completion                                     |
| `NOT APPROVED` | `N/A`     | No approved phase scope exists                                      |

`READY` requires an approved phase file with eligible tasks. `BLOCKED` means implementation cannot proceed until the stated blocker is resolved. A blocked active phase does not permit implementation from another phase.

## 3. Current Roadmap

| Phase   | Name                  | Status         | Readiness | Phase File                     | Requirement Coverage                                       |
| ------- | --------------------- | -------------- | --------- | ------------------------------ | ---------------------------------------------------------- |
| Phase 1 | Foundation            | `COMPLETE`     | `N/A`     | `phases/phase-1-foundation.md` | Approved foundation, architecture and infrastructure scope |
| Phase 2 | Authentication & RBAC | `ACTIVE`       | `BLOCKED` | `phases/phase-2-auth-rbac.md`  | PRD Sections 2.1 through 2.3 and related ERD model         |
| Future  | Undefined scope       | `NOT APPROVED` | `N/A`     | None                           | No approved PRD, ERD impact or phase plan                  |

### Current State

- Create `phases/phase-1-foundation.md` as a concise retrospective record. Do not reopen completed implementation to reconstruct historical task execution.
- Phase 2 remains blocked until `phases/phase-2-auth-rbac.md` is created and human-approved.
- Do not begin Phase 2 implementation from this roadmap alone.

## 4. Phase 2 Requirement Coverage

| Area                                    | PRD Coverage                                |
| --------------------------------------- | ------------------------------------------- |
| Authentication and sessions             | `FR-AUTH-001` through `FR-AUTH-009`         |
| Role-based access control               | `FR-RBAC-001` through `FR-RBAC-006`         |
| Admin account management                | `FR-ADMIN-001` through `FR-ADMIN-003`       |
| Customer profile and account management | `FR-CUSTOMER-001` through `FR-CUSTOMER-004` |

This coverage defines the phase boundary, not executable tasks. The phase file must divide it into small, ordered tasks with acceptance criteria, dependencies, requirement links and explicit exclusions.

## 5. Activation and Readiness

### Scope Approval

A phase may be marked `PLANNED` only after its scope, requirement sources and boundaries are human-approved. Planning does not authorize implementation.

### Activation

A phase becomes `ACTIVE` only when:

1. its scope is approved and it is selected as the current phase;
2. the previous active phase is completed or explicitly paused by human decision;
3. only one phase will remain `ACTIVE`;
4. this roadmap is updated consistently.

Activation does not imply implementation readiness.

### Execution Readiness

An `ACTIVE` phase becomes `READY` only when:

1. applicable PRD requirements and ERD impact are approved;
2. its phase file defines small, independently reviewable tasks;
3. the next eligible task, acceptance criteria, dependencies and exclusions are clear;
4. relevant product, architecture, security and data conflicts are resolved;
5. implementation prerequisites are satisfied;
6. the task breakdown is human-approved.

If any readiness condition stops being true, mark the active phase `BLOCKED` until it is resolved. AI may assist with drafting and analysis but must not silently define, activate, unblock or expand a phase.

## 6. Phase Completion

A phase may become `COMPLETE` only when:

- every required task in its phase file is `✅`;
- phase-level acceptance criteria and required checks are satisfied;
- migrations and data-integrity checks are complete where applicable;
- blockers and approved deferred work are documented;
- the phase file, `MEMORY.md`, `DECISIONS.md` and this roadmap are consistent;
- explicit human approval for phase completion is recorded.

Do not activate the next phase automatically.

## 7. Future Phases

Do not assign a phase number, name, executable status or task breakdown to a future product area until its PRD requirements, ERD impact and phase boundaries are approved.

For approved future scope:

1. create a phase file from `phases/_template.md`;
2. define reviewable tasks, dependencies and exclusions;
3. obtain human approval for the task breakdown;
4. update this roadmap;
5. satisfy the activation rules before implementation.

## 8. Roadmap Integrity

- Keep this file focused on phase scope, status and readiness.
- Keep detailed task state in phase files.
- Do not duplicate full PRD, ERD or task details here.
- Update this file only when approved roadmap state changes.
- Preserve canonical paths and filenames.
- Do not treat proposed or discussed work as approved implementation scope.

The roadmap identifies which phase is current and implementation-ready. The active phase file identifies which task may be executed.
