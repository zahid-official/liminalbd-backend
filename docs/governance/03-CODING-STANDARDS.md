# 03. Coding Standards

> Shared coding conventions for the Liminal Backend codebase.
> These standards apply across modules and AI/IDE environments unless an approved
> requirement or decision explicitly requires otherwise.

## 1. Core Principles: KISS, YAGNI, DRY & Clean Code

All code in this repository must embody professional engineering standards designed for long-term production reliability, junior-friendly readability, and architectural elegance:

- **KISS (Keep It Simple, Stupid):** Prioritize clear, self-explanatory, and maintainable logic over clever or intricate abstractions. Code should read like plain English and be readily understandable by junior developers without cognitive overhead.
- **YAGNI (You Aren't Gonna Need It):** Implement only what is explicitly required for the current approved task. Strictly avoid speculative features, premature abstractions, redundant type wrappers, or future-proofing mechanisms that add immediate complexity.
- **DRY (Don't Repeat Yourself):** Consolidate genuine domain logic, shared validation schemas, and common utilities without creating rigid or awkward coupling. Do not duplicate contracts across layers when TypeScript inference and established patterns already provide type safety.
- **Clean Code & Professionalism:** Write robust, defensive, production-grade code adhering to clean architecture. Ensure zero database schema leakage, explicit nullish handling (`?? null`), deterministic return contracts, and zero lint or type errors.
- **Respect Boundaries:** Follow established repository patterns before introducing new ones. Strictly respect the layer boundaries defined in `02-ARCHITECTURE.md`.
- **Focused Scope:** Implement only approved requirements. Keep changes focused strictly on the active task without unrelated refactors.

## 2. TypeScript and Types

- Use TypeScript with strict type checking enabled.
- Prefer explicit types over `any`.
- Do not use `any` unless a documented external boundary makes it unavoidable.
- Prefer `unknown` for untrusted values, then narrow safely.
- Use `type` or `interface` according to actual responsibility.
- Do not add an `I` prefix to interface names.
- Reuse Prisma-generated types, inputs and enums when they already provide the required contract. Across all application modules and domain entities (e.g., status, role, audit actions, order statuses, product states), always import and use Prisma enum objects/constants (e.g., `UserStatus.SUSPENDED`, `UserRole.CUSTOMER`) rather than raw magic string literals whenever comparing, filtering, or assigning enum field values.
- Create module-specific interfaces or types only when they add a real application-level contract.
- Avoid duplicating Prisma model types without a clear reason.
- Keep optional properties clean and idiomatic: Declare optional properties using standard optional syntax (`field?: T;`). Never pollute interfaces or type definitions with redundant `| undefined` unions (such as `field?: string | undefined;` or `field?: number | undefined;`). With `exactOptionalPropertyTypes: true` enabled in `tsconfig.json`, call sites must omit the key or conditionally inject it (e.g., `...(val ? { field: val } : {})`) rather than passing explicit `{ field: undefined }`.

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

- Prefer named exports across all files. Follow the approved 3-tier export conventions:
  1. **Modular files (`.service.ts`, `.controller.ts`, `.routes.ts`, `.repository.ts`):** Export directly inline at declaration time (e.g., `export const AuthService = { ... };`, `export const AuthRoutes = router;`).
  2. **Helper / Utility / Mailer files (`sendResponse.ts`, `catchAsync.ts`, `auth.mailer.ts`):** Declare first and export via bottom named export block (e.g., `const sendResponse = ...; export { sendResponse };`, `const AuthMailer = ...; export { AuthMailer };`).
  3. **Constants, Types & Interfaces:** Export directly inline at declaration time (e.g., `export const PUBLIC_ERROR_CODES = ... as const;`, `export type PublicErrorCode = ...;`, `export interface SendVerificationOtpParams { ... }`).
- Remove unused imports and dead dependencies.
- Use explicit `.js` extensions for relative TypeScript/ESM imports (e.g., `import { env } from "./config/env.js";`, `import { AuthService } from "./auth.service.js";`) in compliance with Node.js native ESM (`"type": "module"`).
- Respect the dependency direction in `02-ARCHITECTURE.md`.
- Do not import Prisma into controllers.
- Do not import Express `Request` or `Response` into services.
- Do not reach into another module's repository implementation.
- Do not scatter provider SDK calls across feature code.

## 6. Validation

- Validate all externally supplied body, params, query and relevant external payloads at the application boundary.
- Use Zod and the shared validation mechanism.
- Store parsed and normalized values in `res.locals.validated` (`ValidatedLocals<T>`); controllers read validated input using typed assertions (e.g., `res.locals.validated?.body as InputType`) rather than unvalidated raw input.
- Store authenticated identity context exclusively in `res.locals.user` and `res.locals.session`; controllers read authenticated identity using typed assertions (e.g., `const user = res.locals.user as AuthUser`). Never mutate Express `req` (`req.user`, `req.session`) to maintain strict incoming HTTP request immutability (`DEC-014`, `DEC-022`).
- Structure validation issue details with separated source and clean field names (e.g., `source: "body"`, `field: "email"`), adhering to `DEC-016`.
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

Use the shared response helper (`sendResponse` from `src/app/utils/`). Do not recreate response envelopes ad hoc.

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
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "source": "body",
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

- `code` is required and represents a stable application error code (adhering to `DEC-014`).
- `errors` is optional and is included when field-level or multiple validation details are useful (containing `field`, `message`, and optional `source`, adhering to `DEC-016`).
- Unexpected errors must serialize as HTTP 500 with `code: "INTERNAL_SERVER_ERROR"` and a generic message.
- Do not expose stack traces, internal implementation details, or debug info through the response contract in any environment.

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
- Use the shared async error wrapper (`catchAsync` from `src/app/utils/`) for controller methods.
- Prefer early returns over deeply nested conditions.
- Keep functions focused and reasonably small.

## 15. Comments and Documentation

Comments should explain intent, constraints or non-obvious reasoning with a clean, senior-level aesthetic.

- Use concise, single-line header comments before top-level declarations (models, interfaces, core functions/utilities) to clarify purpose and boundary responsibility.
- Prefer self-explanatory code. Avoid mechanical line-by-line narration (e.g., do not add comments that merely narrate variable destructuring or return statements).
- Add inline comments only when documenting non-obvious logic, business edge cases, external workarounds, or security constraints.
- Do not leave commented-out code.
- Do not use decorative banner comments.
- Do not add AI/meta comments.
- Use `TODO(phase-x): ...` only for genuinely deferred, approved work.
- Do not duplicate PRD or governance content inside source comments.

Example:

```ts
// Standardized HTTP success response helper
export const sendResponse = <T>(res: Response, options: SendResponseOptions<T>) => { ... };

// TODO(phase-2): Add audit event after the approved audit contract is implemented.
```

## 16. Logging

- Pino is the canonical structured logger (`DEC-024`). The shared logger instance is exported from `src/app/config/logger.ts` and must be the sole logger instantiation point across the application.
- Do not import `pino` directly in feature modules or instantiate a secondary logger anywhere.
- HTTP request logging is handled globally by `pino-http` middleware mounted in `app.ts`.
- Use appropriate log levels: `fatal` for application-stopping conditions, `error` for unexpected runtime failures, `warn` for recoverable anomalies, `info` for significant lifecycle events, `debug` for development diagnostics.
- Include useful context in log objects (e.g., `{ module, operation, userId }`) where available. Avoid overly verbose or repetitive log entries.
- Never log passwords, session secrets, tokens, API keys, payment secrets or unnecessary sensitive personal data.
- `req.headers.authorization`, `req.headers.cookie`, `res.headers['set-cookie']`, credential/token request body fields, and query parameters (`req.query.token`, `req.query.code`) are automatically redacted by `pino-http` configuration.
- Avoid duplicate logs for the same failure unless each adds useful context.
- Temporary `console.*` calls introduced during local development must be removed before task review. The `no-console` ESLint rule enforces this.

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

- Vitest is the canonical test framework (`DEC-025`). Jest is permanently dropped.
- All test files live under `tests/unit/` (pure unit tests) or `tests/integration/` (HTTP-level endpoint tests) at the repository root. Placing test files inside `src/` is not permitted without an approved deviation.
- **Mirrored Directory Structure & 1:1 Basename Alignment:** `tests/unit/` strictly mirrors the `src/app/` hierarchy (e.g. `tests/unit/errors/AppError.test.ts` mirrors `src/app/errors/AppError.ts`; `tests/unit/middleware/validateRequest.test.ts` mirrors `src/app/middleware/validateRequest.ts`; `tests/unit/modules/<module>/<file>.test.ts` mirrors `src/app/modules/<module>/<file>.ts`). Test files strictly match the exact source file basename (`<filename>.test.ts`).
- **Semantic Test Grouping:** Group unit tests logically using nested `describe()` blocks (e.g., standard envelopes vs. pagination, success scenarios vs. validation failure scenarios) rather than flat test lists, avoiding noisy redundant comments.
- Test files use the `.test.ts` extension and import all Vitest APIs explicitly: `import { describe, it, expect, vi } from 'vitest'`. The `globals: false` configuration enforces this convention.
- The shared Pino logger (`src/app/config/logger.ts`) must be mocked in `tests/setup.ts` using an authentic silent Pino instance (`pino({ level: 'silent' })`) for all test suites to prevent output pollution while satisfying `pino-http` object contracts.
- Each feature task must define and execute the strongest available verification, including:
  - at least one expected (happy) path;
  - at least one meaningful failure path;
  - authorization, ownership, state-transition or edge-case checks when relevant.
- Tests must verify behavior rather than implementation details alone. Do not write tests that merely assert internal function calls without covering observable output.
- Do not weaken or remove tests merely to make a change pass.
- When tests cannot run (e.g., a dependency is unavailable in CI), record `NOT RUN: <reason>` in the task verification evidence rather than deleting the test.
- Use `supertest` for HTTP-level integration tests against the Express app factory.
- Run `pnpm test` and confirm pass before marking a task `🕵️ Awaiting human review`.

## 19. Database and Migration Changes

- Treat `docs/product/ERD.drawio` as the data-model design authority.
- Keep schema and migration changes aligned with approved requirements.
- Do not change the schema merely to simplify implementation.
- Review generated migration SQL when database behavior changes materially.
- Do not rewrite already-applied migration history unless the approved workflow requires it.
- Test important data-integrity and migration behavior before review.
- **Mandatory Minimal Field Projection (`select`):** Every Prisma read and update query must explicitly specify a `select` projection tailored strictly to the minimal fields required for that operation.
  - For existence checks, always use `select: { id: true }`.
  - For validation and guard queries (e.g., status or verification checks), select only the specific fields being inspected (e.g., `select: { id: true, emailVerified: true }`).
  - Unbounded full-entity fetches (`SELECT *`) without explicit `select` (or `omit` where applicable) are strictly prohibited across all services and repositories to eliminate over-fetching, conserve Node.js heap memory, protect against sensitive data leakage, and maintain optimal database I/O.
- **Unified Resource DTOs & Zero Schema Leakage (`DEC-028`):** When projecting extended domain entities (such as `Customer` or `Admin` profiles linked to `User`), services must return a flattened, unified Data Transfer Object rather than leaking internal database relation structures. Extended profile attributes (`contactNumber`, `address`) must be flattened onto the root response object directly from the database record via optional chaining, and compound timestamps must dynamically resolve to the latest modification timestamp (`updatedAt = profile && profile.updatedAt > user.updatedAt ? profile.updatedAt : user.updatedAt`).

## 20. External Providers

Keep provider SDK usage behind the boundaries defined in
`02-ARCHITECTURE.md`.

- Do not expose provider-specific objects or errors across unrelated application layers when an application-level contract is appropriate.
- Handle provider failures explicitly and safely.
- Preserve provider replaceability where required by the architecture or PRD.

## 21. Formatting and Quality Checks

Use the repository's configured formatter, linter and type checker. Use test scripts when the approved test foundation is available.

The current ESLint baseline includes:

- `tseslint.configs.strict` and `tseslint.configs.stylistic`;
- `no-console` as a warning outside production and an error in production;
- `@typescript-eslint/no-explicit-any` as a warning;
- unused variables and parameters as errors, with intentionally unused values allowed by a leading `_`.

Before presenting a task for human review, run the applicable checks:

- formatter;
- linter;
- TypeScript type checking;
- relevant executable/manual verification, and automated tests when available;
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
- relevant approved verification and quality checks pass;
- architecture and coding standards are followed;
- no unrelated work is included;
- no known requirement or security issue is being hidden.

Human approval is required before the task is considered complete.
