# 03. Coding Standards

> Shared coding conventions for the Liminal Backend codebase.
> These standards apply across modules and AI/IDE environments unless an approved
> requirement or decision explicitly requires otherwise.

## 1. Core Principles

- Prefer clear, predictable, maintainable code over clever abstractions.
- Follow established repository patterns before introducing new ones.
- Respect the boundaries defined in `02-ARCHITECTURE.md`.
- Implement only approved requirements. Do not invent behavior.
- Keep changes focused on the active task.
- Avoid premature abstraction, duplication, speculative code and unrelated refactors.

## 2. TypeScript and Types

- Use TypeScript with strict type checking enabled.
- Prefer explicit types over `any`.
- Do not use `any` unless a documented external boundary makes it unavoidable.
- Prefer `unknown` for untrusted values, then narrow safely.
- Use `type` or `interface` according to actual responsibility.
- Do not add an `I` prefix to interface names.
- Reuse Prisma-generated types, inputs and enums when they already provide the required contract.
- Create module-specific interfaces or types only when they add a real application-level contract.
- Avoid duplicating Prisma model types without a clear reason.

## 3. Naming

Use consistent naming for new code. Existing files may retain their current
names unless renaming is part of the active task or an approved refactoring task.

| Item                               | Convention                            | Example                             |
| ---------------------------------- | ------------------------------------- | ----------------------------------- |
| Feature files                      | `kebab-case` + responsibility suffix  | `auth.service.ts`                   |
| Middleware, utility & config files | `camelCase`                           | `globalErrorHandler.ts`, `env.ts`   |
| Class / error class files          | `PascalCase` matching the class name  | `AppError.ts`                       |
| Folders                            | `kebab-case`                          | `password-reset/`                   |
| Classes                            | `PascalCase`                          | `AuthService`, `AppError`           |
| Functions                          | `camelCase`                           | `getUserById`                       |
| Variables                          | `camelCase`                           | `userId`                            |
| Constants                          | `UPPER_SNAKE_CASE` for true constants | `MAX_PAGE_SIZE`                     |
| Types / Interfaces                 | `PascalCase`                          | `CreateUserInput`, `UserRepository` |
| Zod schemas                        | `camelCase` + `Schema`                | `registerSchema`                    |
| Enum members                       | Approved `UPPER_SNAKE_CASE`           | `SUPER_ADMIN`                       |

Rules:

- New files must follow the documented naming convention.
- Do not rename existing files solely for stylistic consistency.
- Existing naming may be preserved when touching a file unless the active task or an approved refactoring task includes the rename.
- Prefer singular responsibility suffixes such as `.controller.ts`, `.service.ts`, `.repository.ts`, and `.validation.ts`.
- Names must describe purpose clearly. Avoid vague names such as `data`, `helper`, `temp`, or `misc` when a more precise name exists.

## 4. Module File Responsibilities

Module structure is responsibility-driven, not file-count-driven.

Typical files may include:

```text
<module>/
├── <module>.routes.ts
├── <module>.controller.ts
├── <module>.service.ts
├── <module>.repository.ts
├── <module>.validation.ts
├── <module>.interface.ts
└── <module>.types.ts
```

Rules:

- A module may contain fewer or more files than the example.
- Create a file only when the module has a real responsibility that requires it.
- Do not create empty, duplicate or speculative files.
- Keep each file focused on one responsibility.
- Do not merge unrelated responsibilities merely to reduce file count.
- `*.interface.ts` and `*.types.ts` are optional.
- Use Prisma-generated types when they already satisfy the required type contract.
- Add custom interfaces or types only when the module needs an additional application-level contract.

## 5. Imports and Dependencies

Order imports consistently:

1. Node.js built-ins
2. External packages
3. Internal aliased imports
4. Relative imports

Separate groups with one blank line.

Also:

- Prefer named exports for controllers, services and repositories.
- Remove unused imports and dead dependencies.
- Respect the dependency direction in `02-ARCHITECTURE.md`.
- Do not import Prisma into controllers.
- Do not import Express `Request` or `Response` into services.
- Do not reach into another module's repository implementation.
- Do not scatter provider SDK calls across feature code.

## 6. Validation

- Validate all externally supplied body, params, query and relevant external payloads at the application boundary.
- Use Zod and the shared validation mechanism.
- Keep schemas aligned with approved requirements.
- Do not duplicate the same validation rule across layers without a boundary-specific reason.
- Never trust client-supplied role, ownership, account status or privileged flags.
- Use validated and normalized values inside business logic.

## 7. Controllers

Controllers must remain thin.

A controller should generally:

1. receive the request;
2. use validated input and trusted request context;
3. call the appropriate service;
4. return the standardized HTTP response.

Controllers must not:

- contain business rules;
- call Prisma or repositories directly;
- duplicate repository logic;
- contain provider-specific integration logic;
- catch errors only to format standard error responses.

## 8. Services

Services own business behavior.

- Keep business rules and business-context authorization in the service or approved application boundary.
- Services may coordinate multiple repositories when required.
- Services may coordinate approved external integrations through their application boundaries.
- Services must not depend on Express `req` or `res`.
- Make ownership and authorization checks explicit.
- Use transactions when atomicity is required.
- Avoid hidden side effects that are not required by the operation.

## 9. Repositories and Prisma

- Repository code is the default application boundary for Prisma access.
- Keep repositories focused on persistence.
- Do not hide business rules inside repositories.
- Apply normal soft-delete filtering only where the approved data model requires it.
- Reuse Prisma-generated types and enums where appropriate.
- Never hand-edit generated Prisma output.
- Keep queries explicit and avoid unnecessary database round trips.
- Use transactions when required by the business operation.

## 10. Authentication and Authorization

- Better Auth owns approved authentication mechanics, credentials and session handling.
- Application code owns RBAC, authorization, ownership, account status and business restrictions.
- Never reimplement Better Auth responsibilities without an approved architecture decision.
- Never trust authorization data supplied by the client.
- Enforce sensitive authorization rules server-side.
- Ownership checks must use trusted authenticated context and server-side data.

## 11. Error Handling

- Use typed application errors for expected application failures.
- Do not use raw `throw new Error()` for expected business failures.
- Use centralized error middleware for standard response formatting.
- Do not expose stack traces, Prisma details, provider internals or secrets to clients.
- Preserve stable application error codes where defined.
- Map errors consistently to the HTTP behavior required by the relevant PRD.
- Do not silently swallow errors unless explicitly intentional.

## 12. Response Contract

Use the shared response helper. Do not recreate response envelopes ad hoc.

### Success

```json
{
  "success": true,
  "message": "Human-readable summary",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

`meta` is included only when relevant, typically for paginated collections.

### Error

```json
{
  "success": false,
  "message": "Human-readable error summary",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

`errors` is included when field-level or multiple validation details are useful.
Do not expose internal implementation details through the response contract.

## 13. HTTP Semantics

Follow the approved PRD contract for each feature.

| Status | Typical use                                         |
| ------ | --------------------------------------------------- |
| `200`  | Successful read or update                           |
| `201`  | Resource created                                    |
| `204`  | Successful operation with no response body          |
| `400`  | Malformed or invalid request                        |
| `401`  | Authentication required or invalid                  |
| `403`  | Authenticated but not authorized                    |
| `404`  | Resource not found or intentionally hidden          |
| `409`  | Conflict with current state or uniqueness           |
| `422`  | Only when the approved feature contract requires it |
| `429`  | Rate limit exceeded                                 |

Do not invent feature-specific status conventions when approved requirements
already define them.

## 14. Async Code and Control Flow

- Use `async` / `await`.
- Avoid unnecessary `.then()` chains.
- Use the shared async error wrapper where the codebase provides one.
- Prefer early returns over deeply nested conditions.
- Keep functions focused and reasonably small.

## 15. Comments and Documentation

Comments should explain intent, constraints or non-obvious reasoning.

- Prefer self-explanatory code.
- Do not leave commented-out code.
- Do not use decorative banner comments.
- Do not add AI/meta comments.
- Use `TODO(phase-x): ...` only for genuinely deferred, approved work.
- Do not duplicate PRD or governance content inside source comments.

Example:

```ts
// TODO(phase-2): Add audit event after the approved audit contract is implemented.
```

## 16. Logging

- Use the shared project logger for application logging.
- Do not commit ad-hoc `console.*` debugging. Temporary console usage during local development must be removed before review.
- The ESLint configuration treats `console.*` as a warning outside production and an error in production.
- Log meaningful operational events at appropriate levels.
- Include useful context such as module, operation and correlation/request context when available.
- Never log passwords, session secrets, tokens, API keys, payment secrets or unnecessary sensitive personal data.
- Avoid duplicate logs for the same failure unless each adds useful context.

## 17. Security

Treat security as part of implementation.

Review protected operations for:

- authentication;
- authorization and RBAC;
- ownership;
- account status;
- input validation;
- data exposure;
- session and CSRF concerns where applicable;
- rate limiting where applicable;
- injection and unsafe query construction;
- privilege escalation;
- auditability where required.

Never hard-code secrets. Read them through approved configuration boundaries.

## 18. Testing

Use Jest and the repository's established test organization.

For new business logic:

- cover at least one expected path;
- cover at least one meaningful failure path;
- add authorization, ownership, state-transition or edge-case tests when relevant.

Tests should verify behavior, not implementation details alone.

Do not weaken or remove tests merely to make a change pass.

## 19. Database and Migration Changes

- Treat `docs/product/ERD.drawio` as the data-model design authority.
- Keep schema and migration changes aligned with approved requirements.
- Do not change the schema merely to simplify implementation.
- Review generated migration SQL when database behavior changes materially.
- Do not rewrite already-applied migration history unless the approved workflow requires it.
- Test important data-integrity and migration behavior before review.

## 20. External Providers

Keep provider SDK usage behind the boundaries defined in
`02-ARCHITECTURE.md`.

- Do not expose provider-specific objects or errors across unrelated application layers when an application-level contract is appropriate.
- Handle provider failures explicitly and safely.
- Preserve provider replaceability where required by the architecture or PRD.

## 21. Formatting and Quality Checks

Use the repository's configured formatter, linter, type checker and test scripts.

The current ESLint baseline includes:

- `tseslint.configs.strict` and `tseslint.configs.stylistic`;
- `no-console` as a warning outside production and an error in production;
- `@typescript-eslint/no-explicit-any` as a warning;
- unused variables and parameters as errors, with intentionally unused values allowed by a leading `_`.

Before presenting a task for human review, run the applicable checks:

- formatter;
- linter;
- TypeScript type checking;
- relevant tests;
- build or migration checks when affected.

Do not introduce another formatter, linter or test framework without an approved decision.

## 22. AI Implementation Discipline

AI-assisted implementation follows `AGENTS.md` and
`05-TASK-WORKFLOW.md`.

Before changing code:

1. identify the active task;
2. read the minimum relevant context;
3. confirm the change fits approved requirements and architecture;
4. implement only the required scope.

Do not:

- perform unrelated refactors;
- add speculative abstractions;
- change public API behavior without approval;
- change architecture without approval;
- silently fix unrelated issues discovered during the task.

## 23. Standard of Done

Code is ready for human review only when:

- the active task's acceptance criteria are addressed;
- relevant tests and quality checks pass;
- architecture and coding standards are followed;
- no unrelated work is included;
- no known requirement or security issue is being hidden.

Human approval is required before the task is considered complete.
