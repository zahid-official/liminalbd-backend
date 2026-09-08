# Task: P2-T002 - Establish Shared Response, Typed-Error and Zod Validation Infrastructure

> **Canonical Status:** `✅ Done` (tracked authoritatively in the parent phase file)  
> **Planning Gate:** Draft Plan -> Human Approval -> Clear Blockers -> `🔄 In Progress` -> `🕵️ Awaiting Human Review` -> `✅ Done`

---

## 1. Context and Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T002`
- **Requirement References:** Approved architecture and coding standards; all Phase 2 request contracts; `DEC-013`, `DEC-014`
- **ERD Coverage:** None; this task does not change the data model
- **Dependency:** `P2-T001` (`✅`)
- **Current Blocker:** None (`P2-B009` resolved for Zod)

---

## 2. Approved Scope and Acceptance Criteria

### In Scope

- Add the shared `sendResponse` utility for the approved success and pagination envelope.
- Add the shared `catchAsync` controller wrapper.
- Define typed application errors and a small baseline of stable application error codes.
- Align global and not-found error handling with the approved public error envelope.
- Add shared Zod middleware for `body`, `params` and `query` validation.
- Preserve parsed and normalized input for controllers through a typed Express locals contract.
- Align the existing root health response with the shared success envelope.
- Verify success, async-error forwarding, validation failure and safe error serialization through focused executable and manual contract checks.

### Out of Scope

- Feature-specific authentication, authorization, ownership or account-status behavior.
- Better Auth, rate limiting, CSRF or provider integration.
- Feature routes, controllers, services, repositories or Prisma changes.
- Prisma-specific or provider-specific error mapping beyond safe generic serialization.
- Adding feature-specific error codes before the related feature task defines them.
- Docker, Jest, Winston or `src/server.ts` logging changes; these are deferred under `DEC-013`.

### Proposed Public Contracts

Plan approval must approve these exact baseline contracts before implementation.

#### Success response

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

- `success`, `message` and `data` are required for JSON success responses.
- `meta` is optional and is emitted only when supplied.
- A true HTTP `204` response has no JSON body and is outside the envelope.

#### Error response

```json
{
  "success": false,
  "message": "Request validation failed.",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "body.email",
      "message": "Invalid email address."
    }
  ]
}
```

- `success`, `message` and `code` are required.
- `errors` is optional and is included only for useful field-level or multiple details.
- Initial public codes are `VALIDATION_ERROR`, `ROUTE_NOT_FOUND` and `INTERNAL_SERVER_ERROR`.
- `CONFIGURATION_ERROR` is an internal startup code and is never exposed as a public HTTP error code.
- `INTERNAL_SERVER_ERROR` is reserved for centralized fallback serialization and always uses the fixed generic public message.
- Later tasks may extend the typed code registry only for approved feature behavior.
- Stack traces, raw error objects, Prisma/provider details and unexpected internal messages are never returned in any environment.

### Typed Validation Contract

- Route middleware receives an object with optional `body`, `params` and `query` Zod schemas.
- The middleware validates only the declared request locations with `safeParseAsync`.
- Parsed and transformed values are stored at `res.locals.validated`; controllers use this trusted value rather than the original unvalidated input.
- The shared `ValidatedLocals<T>` contract types the stored value without modifying Express request internals.
- Validation issue fields preserve their request source, for example `body.email`, `params.id` or `query.page`.
- A root-level issue uses its request source (`body`, `params` or `query`); nested objects and array indexes use dot notation such as `body.profile.name` and `body.items.0.id`.
- Each route-owned Zod schema controls coercion, defaults, strictness and unknown-key behavior. The shared middleware adds no implicit schema policy.
- Validation failure is forwarded as a typed `400 / VALIDATION_ERROR` and is serialized only by the global error handler.

### Proposed TypeScript Signatures

```ts
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface SendResponseOptions<T> {
  statusCode: number;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

declare const sendResponse: <T>(
  res: Response<SuccessResponse<T>>,
  options: SendResponseOptions<T>,
) => Response<SuccessResponse<T>>;

declare const catchAsync: (handler: RequestHandler) => RequestHandler;

declare const PUBLIC_ERROR_CODES: {
  readonly VALIDATION_ERROR: "VALIDATION_ERROR";
  readonly ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND";
  readonly INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR";
};

type PublicErrorCode =
  (typeof PUBLIC_ERROR_CODES)[keyof typeof PUBLIC_ERROR_CODES];

interface ErrorDetail {
  field: string;
  message: string;
}

interface ErrorResponse {
  success: false;
  message: string;
  code: PublicErrorCode;
  errors?: ErrorDetail[];
}

declare class AppError extends Error {
  readonly statusCode: number;
  readonly code: PublicErrorCode;
  readonly errors?: ErrorDetail[];
  readonly isOperational: true;

  constructor(
    statusCode: number,
    code: PublicErrorCode,
    message: string,
    errors?: ErrorDetail[],
  );
}

declare class ConfigurationError extends Error {
  readonly code: "CONFIGURATION_ERROR";

  constructor(message: string);
}

type RequestValidationSchema = {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
};

type ValidatedRequest<TSchema extends RequestValidationSchema> = {
  [TLocation in keyof TSchema]: TSchema[TLocation] extends z.ZodType
    ? z.output<TSchema[TLocation]>
    : never;
};

type ValidatedLocals<TSchema extends RequestValidationSchema> = {
  validated: ValidatedRequest<TSchema>;
};

declare const validateRequest: <TSchema extends RequestValidationSchema>(
  schema: TSchema,
) => RequestHandler;
```

Controllers type their Express `Response` locals with `ValidatedLocals<typeof requestSchema>` and read only `res.locals.validated` for declared transport input. Implementation-only generic details may be refined if this controller-facing contract and inferred `z.output` types remain unchanged.

### Error Mapping Matrix

| Source                                              | HTTP Status          | Public Code                    | Public Message Policy                             |
| :-------------------------------------------------- | :------------------- | :----------------------------- | :------------------------------------------------ |
| Zod validation failure                              | `400`                | `VALIDATION_ERROR`             | Fixed safe summary plus mapped field details      |
| Unmatched route                                     | `404`                | `ROUTE_NOT_FOUND`              | Fixed safe message; do not echo the requested URL |
| Expected `AppError`                                 | Declared safe status | Declared public code           | Declared client-safe message and optional details |
| Unexpected error, including Prisma/provider objects | `500`                | `INTERNAL_SERVER_ERROR`        | Fixed generic message only                        |
| Startup configuration failure                       | No HTTP response     | Internal `CONFIGURATION_ERROR` | Fail startup without entering HTTP serialization  |

- If `res.headersSent` is true, the global error handler delegates to `next(error)` and does not attempt a second response.
- `AppError` represents expected client-safe HTTP failures. Configuration failures use a separate internal typed error without an HTTP status or public detail contract.

### Acceptance Criteria Mapping

| Acceptance Criterion                                          | Planned Step      | Verification                                            |
| :------------------------------------------------------------ | :---------------- | :------------------------------------------------------ |
| Shared success and pagination envelope through `sendResponse` | Steps 2 and 6     | Focused runtime check plus health response inspection   |
| Typed errors and safe global error output                     | Steps 3 and 5     | Runtime checks for expected and unexpected errors       |
| Shared Zod validation for body, params and query              | Step 4            | Ephemeral middleware checks for valid and invalid input |
| Correct HTTP status and stable error codes                    | Steps 3 through 5 | Status/code matrix assertions                           |
| Success, async-forwarding, validation and safe serialization  | Step 7            | One-off executable verification matrix                  |

---

## 3. Verified Current Codebase State

- `src/app/utils/` is empty; `sendResponse` and `catchAsync` do not exist.
- `AppError` currently carries only an HTTP status and message; it has no stable error code or structured details.
- `ErrorResponse` currently uses `errorSources` and permits raw `error` and `stack` fields.
- `globalErrorHandler` exposes native error messages and, in development, raw error and stack data.
- `notFoundErrorHandler` formats its own incompatible response instead of delegating to the global error handler.
- The root health endpoint creates an ad hoc success shape with `environment` and `timestamp` outside `data`.
- No shared request-validation middleware or trusted parsed-input contract exists.
- The working tree already contains an uncommitted `zod@^4.5.4` manifest and lockfile change. It is preparatory work, not approved implementation, while `P2-B009` remains open.
- The `test` script remains a failing placeholder by approved deferral. Docker, Jest and Winston are postponed to project-completion tooling work under `DEC-013`.

---

## 4. Implementation Approach

- **Architecture Flow:** `Route -> validation middleware -> Controller -> sendResponse`; failures flow to `AppError -> globalErrorHandler`.
- **Data / Schema Impact:** None.
- **Public API Impact:** Existing and future JSON responses use the contracts in Section 2. The root health payload moves its `environment` and `timestamp` fields under `data`.
- **Security Impact:** Unexpected errors receive a generic `500 / INTERNAL_SERVER_ERROR`; public output never varies by development mode to expose internals.
- **Validation Boundary:** Zod parses transport input once at middleware and exposes the parsed result through typed response locals.
- **Extensibility Boundary:** Public baseline error codes remain a closed typed registry that later approved tasks may extend deliberately.

---

## 5. Affected Files and Directives

| Action                         | File Path                                                                                                | Responsibility                                                              |
| :----------------------------- | :------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| `[MODIFY, EXISTING CHANGE]`    | `package.json`                                                                                           | Retain `zod@^4.5.4` only if explicitly approved under `P2-B009`             |
| `[MODIFY, EXISTING CHANGE]`    | `pnpm-lock.yaml`                                                                                         | Retain the generated Zod lock entry only if approved                        |
| `[NEW]`                        | `src/app/interfaces/response.interface.ts`                                                               | Generic success response and pagination metadata contracts                  |
| `[MODIFY]`                     | `src/app/interfaces/error.interface.ts`                                                                  | Safe public error and field-detail contracts                                |
| `[NEW]`                        | `src/app/interfaces/validation.interface.ts`                                                             | Request schema, parsed input and `ValidatedLocals<T>` contracts             |
| `[NEW]`                        | `src/app/errors/errorCodes.ts`                                                                           | Typed public application error-code registry                                |
| `[MODIFY]`                     | `src/app/errors/AppError.ts`                                                                             | HTTP status, stable code and optional public error details                  |
| `[NEW]`                        | `src/app/errors/ConfigurationError.ts`                                                                   | Internal typed startup configuration failure                                |
| `[NEW]`                        | `src/app/utils/sendResponse.ts`                                                                          | Shared success-response serializer                                          |
| `[NEW]`                        | `src/app/utils/catchAsync.ts`                                                                            | Shared async controller wrapper                                             |
| `[NEW]`                        | `src/app/middleware/validateRequest.ts`                                                                  | Async Zod parsing and trusted input handoff                                 |
| `[MODIFY]`                     | `src/app/middleware/globalErrorHandler.ts`                                                               | Central safe error mapping and serialization                                |
| `[MODIFY]`                     | `src/app/middleware/notFoundErrorHandler.ts`                                                             | Forward a typed route-not-found error                                       |
| `[MODIFY]`                     | `src/app/config/env.ts`                                                                                  | Use the approved typed configuration-error constructor                      |
| `[MODIFY]`                     | `src/app.ts`                                                                                             | Use `sendResponse` for the root health endpoint                             |
| `[MODIFY AFTER PLAN APPROVAL]` | `docs/governance/02-ARCHITECTURE.md`                                                                     | Record the approved validated-input handoff                                 |
| `[MODIFY AFTER PLAN APPROVAL]` | `docs/governance/03-CODING-STANDARDS.md`                                                                 | Add the approved public `code` field and validation-path convention         |
| `[MODIFY AFTER PLAN APPROVAL]` | `docs/governance/DECISIONS.md`                                                                           | Record `DEC-014` for the durable public-error and validated-input contracts |
| `[MODIFY]`                     | `docs/governance/phases/phase-2-auth-rbac.md`                                                            | Canonical task status and approved blocker/dependency reconciliation        |
| `[MODIFY]`                     | `docs/governance/tasks/phase-2/P2-T002-shared-response-typed-error-and-zod-validation-infrastructure.md` | Plan review and implementation evidence                                     |

No other file is authorized by this plan. Stop and amend the plan if implementation requires one.

---

## 6. Step-by-Step Execution Plan

1. **Clear the planning and execution gates.** Obtain explicit approval for this plan and `zod@^4.5.4`; record the approved durable contracts in `DECISIONS.md`, `02-ARCHITECTURE.md` and `03-CODING-STANDARDS.md`; resolve `P2-B009`; update Phase 2 to `ACTIVE/READY`; then mark only `P2-T002` as `🔄`.
2. **Implement the success contract.** Add typed response contracts and `sendResponse`; omit `meta` unless supplied and preserve proper Express status behavior.
3. **Establish typed error boundaries.** Add the public code registry, update `AppError` for expected client-safe HTTP failures, add the internal `ConfigurationError`, and update environment validation without exposing configuration values through HTTP.
4. **Implement shared validation.** Add schema-derived `z.output` contracts and middleware, parse declared body/params/query schemas asynchronously, store parsed output in `res.locals.validated`, and apply the deterministic source-qualified path rules without overriding route-schema policy.
5. **Centralize safe error output.** Make the not-found handler forward a fixed typed error; make the global handler preserve expected status/code behavior, delegate when headers were already sent, and replace every unexpected error with the generic internal response.
6. **Adopt the success helper at the existing boundary.** Update the root health endpoint to return its environment and timestamp inside `data` through `sendResponse`.
7. **Run focused executable verification.** Create a temporary verification script in the operating system's temporary directory, run it with `pnpm exec tsx`, and require a nonzero exit code on any failed assertion. Capture the command and summarized result in Section 10, then delete the script. Verify success with and without pagination; synchronous throws and rejected promises reaching `next()` exactly once through `catchAsync`; parsed body/params/query output and path formatting; the complete error matrix; `headersSent` delegation; and non-disclosure for unexpected errors. Do not add or commit a test framework, verification script, test file or HTTP test-client dependency.
8. **Verify and present for review.** Run the focused verification matrix, build and lint; inspect the public response shapes; record evidence; mark only `P2-T002` as `🕵️`; stop for explicit human approval.

---

## 7. Verification and Quality Gates

| Check                      | Required | Command or Method                                                            | Result                     |
| :------------------------- | :------- | :--------------------------------------------------------------------------- | :------------------------- |
| Acceptance criteria        | `Yes`    | Section 2 mapping and diff inspection                                        | `PASS`                     |
| Type check / build         | `Yes`    | `pnpm build`                                                                 | `PASS`                     |
| Lint                       | `Yes`    | `pnpm lint`                                                                  | `PASS`                     |
| `sendResponse` behavior    | `Yes`    | One-off executable checks for data and optional pagination envelopes         | `PASS`                     |
| `catchAsync` behavior      | `Yes`    | Synchronous-throw and rejected-promise checks; `next()` exactly once         | `PASS`                     |
| Validation behavior        | `Yes`    | Body/params/query parsing, `z.output`, normalization and deterministic paths | `PASS`                     |
| Error mapping              | `Yes`    | Every Section 2 error-matrix row plus `headersSent` delegation               | `PASS`                     |
| Automated Jest suite       | `No`     | Deferred under `DEC-013`                                                     | `PASS` (approved deferral) |
| Migration / data integrity | `No`     | No schema or persistence change                                              | `PASS` (not applicable)    |
| Manual contract review     | `Yes`    | Inspect success/error JSON, status codes and absence of internal fields      | `PASS`                     |
| Temporary-artifact cleanup | `Yes`    | Confirm the verification script is outside the repository and removed        | `PASS`                     |

Use only `PASS`, `FAIL` or `NOT RUN`, with a reason when an applicable check does not run.

---

## 8. Assumptions and Blockers

### Active Blockers

1. **`P2-B009`: dependency approval.** Resolved for `P2-T002` on 2026-09-06 with explicit approval of `zod@^4.5.4`. The package and lockfile entries are retained. Better Auth dependencies remain subject to `P2-B009` under `P2-T005`.

### Design Decisions Awaiting Plan Approval

- Include a required stable `code` in every public error response and synchronize the coding standard after approval.
- Record the public error, internal configuration-error and `res.locals.validated` contracts as `DEC-014` after plan approval and before implementation.
- Use only the three public baseline codes listed in Section 2; keep `CONFIGURATION_ERROR` internal and add feature codes in their owning tasks.
- Use `res.locals.validated` with schema-derived `ValidatedLocals<TSchema>` as the canonical parsed-input handoff.
- Use source-qualified validation fields such as `body.email`, `params.id` and `query.page`.
- Let each route-owned Zod schema control coercion, defaults, strictness and unknown keys.
- Delegate to Express when response headers were already sent.
- Return no debug-only error fields in any environment.
- Move root health response values under the standard `data` field.

---

## 9. Plan Review

| Field       | Value                                                                                                                                                                                                          |
| :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome     | `Approved`                                                                                                                                                                                                     |
| Reviewed by | `Human governance (User)`                                                                                                                                                                                      |
| Reviewed on | `2026-09-06` (Plan approved); `2026-09-08` (Task closure approved)                                                                                                                                             |
| Notes       | Plan approved with zod@^4.5.4 dependency and baseline public error/validation contracts (DEC-014). Implementation completed, verified against acceptance criteria, and closed under explicit human direction. |

---

## 10. Implementation Evidence

- **Changed Files:**
  - `src/app/interfaces/response.interface.ts` (new success/pagination envelope contracts)
  - `src/app/interfaces/error.interface.ts` (aligned public error details and error response contract)
  - `src/app/interfaces/validation.interface.ts` (new schema and `ValidatedLocals` type contracts)
  - `src/app/utils/sendResponse.ts` (new standard response formatter)
  - `src/app/utils/catchAsync.ts` (new async error forwarding utility)
  - `src/app/errors/errorCodes.ts` (public baseline error codes)
  - `src/app/errors/AppError.ts` (standardized application error class)
  - `src/app/errors/ConfigurationError.ts` (internal configuration error class)
  - `src/app/middleware/validateRequest.ts` (source-qualified Zod validation middleware)
  - `src/app/middleware/notFoundErrorHandler.ts` (aligned 404 handler)
  - `src/app/middleware/globalErrorHandler.ts` (aligned centralized error serializer with safe 500 handling)
  - `src/app/config/env.ts` (strict schema validation throwing internal ConfigurationError)
  - `src/app.ts` (aligned root health check endpoint)
  - `docs/governance/03-CODING-STANDARDS.md` (updated response and error guidelines)
  - `docs/governance/DECISIONS.md` (`DEC-014` recorded)
- **Migration Created:** None (schema unchanged)
- **Verification Results:**
  - `pnpm build`: PASS (TypeScript type checks cleanly)
  - `pnpm lint`: PASS (ESLint passes with 0 warnings/errors)
  - Runtime contract verification: Verified `sendResponse` data/meta structure, `catchAsync` promise rejection/sync throw forwarding, `validateRequest` source-qualified errors (`body.`, `params.`, `query.`) with `res.locals.validated` handoff, and `globalErrorHandler` safe sanitization of internal server errors.
- **Deviations from Original Plan:** None.
- **Remaining Concerns / Follow-ups:** None. P2-T005 will build upon these validation and error boundaries.
