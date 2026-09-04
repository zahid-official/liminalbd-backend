# 04. Rules

> Mandatory boundaries for AI-assisted work in Liminal Backend.
> These rules constrain AI preferences. Source-of-truth precedence follows
> `AGENTS.md`; execution and approval follow `05-TASK-WORKFLOW.md`.

## 1. Scope and Context

- Work on exactly one eligible task from the active phase file at a time.
- Follow the session startup protocol in `AGENTS.md`, including reading `MEMORY.md`, `06-PHASE-ROADMAP.md` and the active phase file.
- Resolve any task already in progress or awaiting human review before starting another.
- Read only the authoritative context needed for the task. Consult the PRD and ERD for exact requirements.
- Do not invent missing requirements, security policies or future-phase behavior.
- Do not add unrelated dependencies, refactors, renames or adjacent fixes. Report unrelated findings separately.

## 2. Architecture and Contracts

- Follow `02-ARCHITECTURE.md` and `03-CODING-STANDARDS.md`.
- Preserve established repository patterns where they align with approved requirements and decisions.
- Respect layer responsibilities, repository access boundaries and approved integration boundaries.
- Use Better Auth for authentication/session mechanics, Zod for boundary validation and shared response helpers and typed errors.
- Do not build a second authentication/session system or scatter provider SDK calls across unrelated feature logic.
- Do not change architecture or repository layout without approval and a decision recorded in `DECISIONS.md`.
- Do not change API or data contracts merely for implementation convenience.
- Preserve behavior and required compatibility outside the approved change.
- Check existing project capabilities before adding dependencies. New dependencies or provider changes require approved task scope or a technical decision.

## 3. Authorization and Security

- Enforce business-context authorization, ownership and account restrictions at the service or approved application boundary.
- Never trust client-supplied roles, ownership claims, account status or privileged flags.
- Never allow public registration to assign privileged roles or users to modify their own role.
- Enforce the PRD's privileged-account restrictions on administrative operations.
- Never bypass authorization or weaken security controls as a temporary shortcut.
- Read secrets through approved environment/configuration boundaries. Never hard-code, commit or log them.
- Expose only data permitted by the approved contract and authorization rules. Never expose secrets, stack traces, Prisma details or provider internals to clients.
- Preserve the approved cookie-based session contract. Do not introduce application-managed access/refresh tokens without an approved architecture change.

## 4. Data Integrity

- Follow the approved PRD and ERD for schema behavior, domain values and audit requirements.
- Treat the Prisma schema as implementation evidence; it does not override approved PRD or ERD requirements.
- Use soft deletion only where required by the approved model. Do not hard-delete records that require soft deletion.
- Never hand-edit generated Prisma output.
- Do not rewrite applied migration history unless the approved workflow explicitly requires it.
- Review data-integrity and migration impact when affected by the task.

## 5. Verification and Approval

- Run the applicable checks and meaningful tests defined in `03-CODING-STANDARDS.md`.
- Do not weaken tests, type checking or lint rules merely to obtain a passing result.
- Use the shared logger. Remove ad-hoc `console.*` debugging before review.
- Report checks as passed, failed or not run. Do not claim verification without evidence.
- If required checks cannot pass or run, report the blocker. Do not claim readiness for review.
- Mark `🕵️ Awaiting human review` only after acceptance criteria, required checks and self-review are satisfied. Present the result and stop.
- Human approval is required before `✅ Done` and before starting the next task.
- After approval, complete the required memory, decision and roadmap updates under `05-TASK-WORKFLOW.md`.

## 6. Governance Integrity

- Preserve canonical filenames and update the canonical documents. Do not create competing final or version-suffixed copies.
- Keep documents focused on their responsibilities. Reference detailed requirements instead of duplicating them.
- Keep `MEMORY.md` focused on verified current state and phase files focused on execution plans.
- Do not treat proposals, unapproved chat suggestions or planned work as approved decisions or implemented state.
- Update task progress during execution. Record approved completion and current-state memory only after human approval.
- When requirements change, follow the governance-update and task-breakdown approval process before implementation.
- Keep IDE-specific technical skills separate from canonical governance. Do not introduce a parallel governance system without approval.
- Use concise, precise Markdown and established terminology. Do not use the em dash character.

## 7. Conflicts and Escalation

Apply the source-of-truth hierarchy in `AGENTS.md`. Do not silently ignore a human instruction or change an approved requirement to fit the implementation.

If a conflict, missing decision or required scope change remains unresolved:

1. Stop the affected work.
2. State the conflict, its impact and the specific decision needed.
3. Request human direction without inventing a resolution.

If explicit approval already resolves the same action and scope, do not request it again. Record approved durable changes in `DECISIONS.md` and update affected governance documents before relying on the new contract.
