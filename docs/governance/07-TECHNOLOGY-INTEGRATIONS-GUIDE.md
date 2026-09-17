# 07. Technology Integrations Guide

> Authoritative reference for core external technologies, libraries, and provider boundaries in Liminal Backend.
> Defines architectural integration patterns, operational rules, and error contracts for third-party technologies.
> Governed under [AGENTS.md](../../AGENTS.md), [02-ARCHITECTURE.md](02-ARCHITECTURE.md), [03-CODING-STANDARDS.md](03-CODING-STANDARDS.md), and [DECISIONS.md](DECISIONS.md) (`DEC-002`, `DEC-003`, `DEC-004`, `DEC-014`, `DEC-018`, `DEC-019`).

---

## 1. Scope and Purpose

This document provides a single, unified source of truth for integrating external frameworks, engines, and third-party provider SDKs across the codebase. As our technology stack evolves, new technologies (e.g., Prisma ORM, Redis, Stripe, Cloudinary, Nodemailer) must adhere to their respective sections below.

---

## 2. Better Auth (Authentication & Session Engine)

### 2.1 Architectural Responsibility Boundary (`DEC-003`)

Liminal Backend enforces a strict separation of concerns between Better Auth and application business logic:

```text
HTTP Request → Middleware → Controller → Service → Better Auth API / Repository → Prisma / PostgreSQL
```

| Better Auth Owns | Liminal Application Code Owns |
| :--- | :--- |
| Credential validation and timing-equalized password hashing | User roles (`SUPER_ADMIN`, `ADMIN`, `CUSTOMER`) |
| Session token generation, signing, and lifecycle | RBAC enforcement and authorization guards |
| Cookie serialization, encryption, and caching | User account status policy (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`) |
| Email verification mechanics and OTP delivery | Soft deletion lifecycle (`deletedAt` anti-enumeration per `DEC-018`) |
| Google OAuth handshake and token management | Resource ownership verification |
| Core auth mechanics & dummy password hash | Audit logging (network rate limiting delegated to Reverse Proxy per `DEC-019`) |

> **Hard Rule:** Never construct a parallel session or custom authentication mechanism. Never store JWTs in local storage or expose raw tokens in response bodies.

### 2.2 Server-Side Invocation Standard

When invoking Better Auth endpoints from application services, always use the internal server-side `auth.api` contract.

1. **Pass Request Headers:** Always forward incoming request headers (`headers: req.headers` converted via `fromNodeHeaders` or `new Headers()`) to maintain client IP tracking, User-Agent recording, and session cookie validation.
2. **Use `returnHeaders: true` When Capturing Set-Cookie:**  
   When an operation generates or refreshes cookies (e.g., `signInEmail`, `signOut`), supply `returnHeaders: true`.
   - **Why:** `returnHeaders: true` automatically throws typed `APIError` upon failure and directly returns typed `{ headers, response }` on success.
   - Avoid `asResponse: true` for business services, as it suppresses exceptions and returns raw web Response streams requiring manual status verification.
   - Use `authHeaders.getSetCookie()` returning `string[]` to preserve discrete cookie headers without RFC 6265 illegal comma-folding.

```ts
// Canonical Server-Side Sign-In Invocation
const { headers: authHeaders, response: authResult } =
  await auth.api.signInEmail({
    body: { email, password },
    headers,
    returnHeaders: true,
  });

const setCookies = authHeaders.getSetCookie();
```

### 2.3 Server-Side Session Retrieval

For middleware and authenticated guards:
```ts
const session = await auth.api.getSession({
  headers: req.headers, // Node.js IncomingHttpHeaders or standard Headers
});

if (!session) {
  throw new AppError(status.UNAUTHORIZED, PUBLIC_ERROR_CODES.UNAUTHORIZED, "Authentication required");
}
```

### 2.4 Cookie Architecture and Caching Policy

Liminal Backend operates strictly under a **cookie-only session architecture**:

- **Primary Session Token (`session_token`):**
  - Configured under `advanced.cookies.session_token`.
  - Security attributes: `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `secure: env.NODE_ENV === "production"`.
  - Storage: Database-backed via `Session` table in PostgreSQL.
  - Duration: 7 days (`expiresIn: 60 * 60 * 24 * 7`).
  - Sliding Renewal: Automatically renewed after 1 day (`updateAge: 60 * 60 * 24`).

- **Session Cookie Cache (`session_data`):**
  - Configuration: `session.cookieCache: { enabled: true, maxAge: 15 * 60 }`.
  - Behavior: Stores signed, tamper-proof session data in client cookie cache for 15 minutes.
  - Performance: Eliminates database lookups for session verification during rapid sequential requests.
  - Revalidation Constraint: Revoked sessions or status changes (`SUSPENDED`/`DEACTIVATED`) take up to 15 minutes to reflect across other active devices unless explicitly invalidated.

### 2.5 Error Resolution and Exception Standard

Better Auth communicates server-side failures by throwing instances of `APIError`.

- **Official Type Guard:** Never inspect raw error messages with substring checks (`error.message.includes(...)`). Always use the official type guard:
  ```ts
  import { isAPIError } from "better-auth/api";

  if (isAPIError(error)) {
    // Safe to access error.statusCode, error.status, and error.body.code
  }
  ```

- **Error Mapping Pipeline (`handleBetterAuthError.ts`):**  
  All Better Auth machine codes are translated into standardized application errors via `handleBetterAuthError.ts`:

  | Better Auth Code (`error.body.code`) | HTTP Status | Public Application Code | Public Message |
  | :--- | :--- | :--- | :--- |
  | `INVALID_EMAIL_OR_PASSWORD` | `401 Unauthorized` | `INVALID_CREDENTIALS` | `"Invalid email or password"` |
  | `INVALID_PASSWORD` | `401 Unauthorized` | `INVALID_CREDENTIALS` | `"Invalid email or password"` |
  | `INVALID_CREDENTIALS` | `401 Unauthorized` | `INVALID_CREDENTIALS` | `"Invalid email or password"` |
  | `EMAIL_NOT_VERIFIED` | `403 Forbidden` | `EMAIL_NOT_VERIFIED` | `"Please verify your email before logging in"` |
  | `ACCOUNT_SUSPENDED` | `403 Forbidden` | `ACCOUNT_SUSPENDED` | `"Your account has been suspended. Please contact support."` |
  | `ACCOUNT_DEACTIVATED` | `403 Forbidden` | `ACCOUNT_DEACTIVATED` | `"Your account is deactivated. Please contact support."` |
  | `INVALID_OTP` | `400 Bad Request` | `INVALID_OR_EXPIRED_OTP` | `"Invalid or expired verification code"` |
  | `OTP_EXPIRED` | `400 Bad Request` | `INVALID_OR_EXPIRED_OTP` | `"Invalid or expired verification code"` |
  | `TOKEN_EXPIRED` | `400 Bad Request` | `INVALID_OR_EXPIRED_TOKEN` | `"Invalid or expired verification token"` |
  | `INVALID_TOKEN` | `400 Bad Request` | `INVALID_OR_EXPIRED_TOKEN` | `"Invalid or expired verification token"` |
  | `USER_NOT_FOUND` | `404 Not Found` | `USER_NOT_FOUND` | `"No account found with this email address"` |
  | `USER_ALREADY_EXISTS` | `409 Conflict` | `USER_ALREADY_EXISTS` | `"User with this email already exists"` |
  | Unknown 4xx `APIError` | `4xx` (`error.statusCode` or `400`) | `VALIDATION_ERROR` (`INVALID_CREDENTIALS` if 401) | Fixed safe message (`"Authentication request failed"`) |
  | Internal 5xx / Unhandled `APIError` | `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Fixed generic message (`"An unexpected internal error occurred."`) |

  > **Note:** Unknown 4xx errors emit the fixed safe client message `"Authentication request failed"`, while 5xx/internal server errors are strictly masked with `"An unexpected internal error occurred."` and logged server-side via `globalErrorHandler.ts`.

### 2.6 Security, Compound-State Precedence and Lifecycle Guards

Account status restrictions and anti-enumeration protections are enforced centrally at the session creation lifecycle boundary (`databaseHooks.session.create.before` in `src/app/config/auth.ts`). This guarantees that Better Auth's timing-equalized credential verification executes first, completely eliminating timing side-channels and state reconnaissance:

1. **Deterministic Compound-State Precedence:**
   - **Priority 1: Invalid Credentials (`401 INVALID_CREDENTIALS`):** Non-existent users or incorrect passwords fail credential verification first with timing-equalized dummy password hashing.
   - **Priority 2: Soft-Deleted Account (`401 INVALID_CREDENTIALS` per `DEC-018`):** If `deletedAt !== null`, session persistence aborts with generic 401 to prevent disclosing prior account existence.
   - **Priority 3: Administrative Sanctions (`403 ACCOUNT_SUSPENDED` / `ACCOUNT_DEACTIVATED`):** Suspended or deactivated accounts abort session creation with sanitized status-specific 403 forbidden responses. Moderation takes precedence over email verification.
   - **Priority 4: Unverified Email (`403 EMAIL_NOT_VERIFIED`):** Unverified accounts with valid credentials abort session creation with 403 instructing verification.
   - **Priority 5: Active Verified Success (`200 OK`):** Session and secure cookies are established and returned in the shared envelope.

2. **Schema Protection (`additionalFields`):**
   - Privileged and operational user fields (`role`, `status`, `needPasswordChange`, `deletedAt`) are configured with `input: false` in `src/app/config/auth.ts`.
   - Clients cannot self-assign or mutate these fields via Better Auth registration or profile endpoints.

### 2.7 Email and Verification Mechanics

- **Plugin:** Better Auth `emailOTP` plugin is configured for 6-digit numeric verification.
- **Expiry:** Verification codes expire after 5 minutes (`expiresIn: 300`).
- **Transport Boundary:** Better Auth hooks delegate email delivery to `AuthMailer` and `sendEmail` (`src/app/shared/email/`), preserving unified HTML/plain-text formatting and SMTP error isolation.
- **Synchronization:** Upon successful OTP verification via Better Auth, application code updates `User.emailVerified` in PostgreSQL to ensure immediate relational consistency.

---

## 3. Prisma ORM (Database & Persistence Engine)

### 3.1 Architectural Responsibility Boundary (`DEC-003`, `DEC-014`)

Liminal Backend enforces a strict Layered Architecture with modular feature boundaries:

```text
HTTP Request → Route → Controller → Service → Repository → Prisma Client → @prisma/adapter-pg → PostgreSQL
```

| Layer | Responsibility with Prisma | Prohibited Behaviors |
| :--- | :--- | :--- |
| **Controller** | Receives validated input, calls service, formats response | Never import `prisma`, never call repository or database methods directly |
| **Service** | Owns business logic, orchestration, and transaction boundaries (`$transaction`) | Never write raw database queries; coordinate multi-repository transactions via transaction client (`tx`) |
| **Repository** | Owns persistence logic, Prisma queries, relations, and data mapping | Never make business decisions or HTTP assumptions; receive optional transaction client (`tx`) |
| **Prisma Client** | Strongly-typed query builder and PostgreSQL adapter interface | Never edit generated output in `src/generated/prisma/` by hand |

> **Hard Rule:** Prisma Client must only be instantiated in `src/app/config/prisma.ts` and queried within repository modules (`*.repository.ts`) or approved application infrastructure. Controllers must never import `prisma`.

### 3.2 Prisma v7 & PostgreSQL Driver Adapter Standard

Liminal Backend utilizes **Prisma ORM v7** with native PostgreSQL driver adapters (`@prisma/adapter-pg` + `pg`):

1. **New Configuration System (`prisma.config.ts`):**
   - Database connection URLs, migration paths, and multi-file schema locations are configured in `prisma.config.ts` using `defineConfig` and `env()`.
   - `.env` must be explicitly loaded via `import "dotenv/config"` at the very top of `prisma.config.ts`.
   - In `prisma/schema/schema.prisma`, the `datasource db` block defines only `provider = "postgresql"`. Connection URLs are not hardcoded or duplicated in `.prisma` files.

2. **Schema Organization & Output Generation:**
   - Schemas use multi-file structure inside `prisma/schema/` (`schema.prisma`, `auth.prisma`, `profiles.prisma`, `audit.prisma`).
   - Generator provider is `prisma-client` (Prisma v7 standard), outputting to `src/generated/prisma`.
   - Output files are strictly read-only artifacts.

3. **Client Instantiation & Connection Pool:**
   - Single shared Prisma client instance configured in `src/app/config/prisma.ts`.
   - Instantiated via `PrismaPg` adapter passing `env.DATABASE_URL`.
   - For PostgreSQL in Node.js native ESM, connection pooling parameters (`max`, `idleTimeoutMillis`, `connectionTimeoutMillis`) are governed via the adapter driver options or connection string query parameters (e.g., `?connection_limit=10&pool_timeout=10`).

```ts
// Canonical Prisma Client Setup (src/app/config/prisma.ts)
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { env } from "./env.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export { prisma };
```

### 3.3 Type Safety, Imports, and Enum Rule

Prisma v7 provides modular, granular entrypoints from the generated output:

1. **Client & Namespace:**
   - Import `PrismaClient` and `Prisma` namespace from `src/generated/prisma/client.js`:
     ```ts
     import { Prisma } from "../../generated/prisma/client.js";
     ```
2. **Prisma Enums Standard (`03-CODING-STANDARDS.md`):**
   - Import domain enums from `src/generated/prisma/enums.js`:
     ```ts
     import { UserRole, UserStatus } from "../../../generated/prisma/enums.js";
     ```
   - **Rule:** Never use magic string literals (e.g., `"CUSTOMER"`, `"SUSPENDED"`) when filtering, comparing, or assigning enum values. Always use the generated Prisma enum object (e.g., `UserRole.CUSTOMER`, `UserStatus.SUSPENDED`).
3. **Type-Safe Query Shapes (`satisfies`):**
   - In Prisma v7, `Prisma.validator()` is deprecated. Always use TypeScript `satisfies` operator for type-safe query shapes:
     ```ts
     const userSelect = {
       id: true,
       email: true,
       role: true,
       status: true,
     } satisfies Prisma.UserSelect;
     ```

### 3.4 Data Access, Soft Deletion, and Field Selection

1. **Mandatory Minimal Field Selection (`select`):**
   - Every Prisma read and update query must explicitly specify a `select` projection tailored strictly to the minimal fields required for that operation.
   - For existence checks, always use `select: { id: true }`.
   - For validation or guard queries (e.g., status, soft-delete, or verification checks), select only the specific fields evaluated by the business logic.
   - Unbounded full-entity fetches (`SELECT *`) without explicit `select` (or `omit` where applicable) are strictly prohibited across all services and repositories. This eliminates database over-fetching, saves network bandwidth, preserves Node.js heap memory, and guarantees zero leakage of sensitive credentials or internal fields.
   - In Prisma v7, `omit` can be used to explicitly exclude fields (e.g., `omit: { password: true }`), but cannot be combined simultaneously with `select`.
2. **Soft Deletion Convention:**
   - Entities implementing soft deletion feature a `deletedAt DateTime?` column.
   - Repositories must explicitly filter `where: { deletedAt: null }` for normal operational queries unless the specific method explicitly handles trash or recovery semantics.
3. **Relations & Joins:**
   - Avoid N+1 query patterns. Use `include` or nested `select` to fetch relational records in a single database round trip.
   - For relation counting without loading children, use `_count: { select: { ... } }`.
4. **Identifier (ID) Generation Policy:**
   - Liminal Backend enforces application-layer identifier generation across all domain models:
     - Authentication entities (`User`, `Account`, `Session`, `Verification`) receive IDs generated by the Better Auth runtime engine.
     - Profile entities (`Admin`, `Customer`) inherit their primary keys via `userId` referencing `User.id`.
     - System and audit entities (`AuditLog`) utilize Prisma Client-generated UUIDs (`@default(uuid())`).
   - Database-level defaults (e.g., `DEFAULT gen_random_uuid()`) are intentionally avoided to ensure in-memory ID availability prior to query execution and avoid database engine dialect divergence.

### 3.5 Transaction Boundaries & Repository Orchestration

When a business operation requires atomicity across multiple tables or queries:

1. **Transaction Coordination Lives in Service:**
   - Business services initiate transactions using `prisma.$transaction`.
   - Services pass the scoped transaction client `tx` (type: `Prisma.TransactionClient`) to repository persistence methods.
2. **Repository Transaction-Aware Methods:**
   - Repository methods must accept an optional transaction context `tx?: Prisma.TransactionClient`:
     ```ts
     const createCustomerProfile = async (
       data: Prisma.CustomerCreateInput,
       tx?: Prisma.TransactionClient,
     ) => {
       const client = tx ?? prisma;
       return client.customer.create({ data });
     };
     ```
3. **Interactive Transactions Best Practices:**
   - Keep transactions short and focused purely on database operations.
   - Avoid long-running network calls (e.g., sending emails via SMTP, calling Stripe APIs, upload to Cloudinary) inside `$transaction` callbacks to avoid holding database locks.
   - If an external call fails after database operations, apply compensating actions or perform external calls after the transaction successfully commits.

### 3.6 Error Resolution & Mapping Pipeline (`handlePrismaError.ts`)

Prisma ORM errors are caught at `globalErrorHandler.ts` and transformed into standard `AppError` instances via `src/app/errors/handlePrismaError.ts`.

1. **Security & Information Disclosure Rule:**
   - Never leak table names (`table`), column names (`column_name`), raw SQL statements, or database internal errors to API responses.
   - All errors must translate to safe, user-friendly messages with stable application error codes (`PUBLIC_ERROR_CODES`).

2. **Official Type Identification:**
   - Detected via `isPrismaError(error)` using `error instanceof Error && error.name.startsWith("PrismaClient")` and typed Prisma error classes.

3. **Status Code and Error Contract Mapping:**

| Prisma Error Class | Code / Condition | HTTP Status | Public Code | Client Message & Metadata |
| :--- | :--- | :--- | :--- | :--- |
| `PrismaClientKnownRequestError` | `P2002` (Unique constraint) | `409 Conflict` | `CONFLICT` | "A record with this {field} already exists" + `errors: [{ field, message: "{field} already exists" }]` |
| `PrismaClientKnownRequestError` | `P2003` (Foreign key violation) | `400 Bad Request` | `VALIDATION_ERROR` | "Referenced relationship does not exist" |
| `PrismaClientKnownRequestError` | `P2004` (Database constraint failed) | `400 Bad Request` | `VALIDATION_ERROR` | "Database constraint condition failed" |
| `PrismaClientKnownRequestError` | `P2006` (Invalid field value) | `400 Bad Request` | `VALIDATION_ERROR` | "Provided value is invalid for database field" |
| `PrismaClientKnownRequestError` | `P2001`, `P2015`, `P2018`, `P2025` (Not found) | `404 Not Found` | `NOT_FOUND` | "The requested record was not found" |
| `PrismaClientKnownRequestError` | `P1xxx` (Database connection issue) | `503 Service Unavailable` | `INTERNAL_SERVER_ERROR` | "Database service is temporarily unavailable" |
| `PrismaClientKnownRequestError` | Unmapped `P2xxx` query error | `400 Bad Request` | `VALIDATION_ERROR` | "Database request constraint violation" |
| `PrismaClientValidationError` | Schema argument mismatch | `400 Bad Request` | `VALIDATION_ERROR` | "Invalid query arguments provided to database" |
| `PrismaClientInitializationError` | Connection / startup failure | `503 Service Unavailable` | `INTERNAL_SERVER_ERROR` | "Database service is temporarily unavailable" |
| `PrismaClientRustPanicError` / Unknown | Engine panic / unhandled | `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | "An unexpected database error occurred" |

### 3.7 Database CLI & Migration Governance

All database migrations and schema updates follow strict governance procedures (`03-CODING-STANDARDS.md` Section 19):

1. **Development Migrations:**
   - Execute `pnpm migrate` (`prisma migrate dev`) during local development.
   - Always name migrations descriptively: `pnpm dlx prisma migrate dev --name <descriptive_name>`.
   - Never use `db push` on production or shared environments; migrations are the sole source of truth for database schema history.
2. **Regeneration Discipline:**
   - Always run `pnpm generate` (`prisma generate`) immediately after changing any schema file in `prisma/schema/`.
3. **AI Safety Checkpoint:**
   - Destructive commands (`migrate reset`, `db push --force-reset`, `db push --accept-data-loss`) are strictly prohibited without explicit human authorization immediately before execution.
4. **Seed Execution:**
   - Database seeding commands are configured under `migrations.seed` in `prisma.config.ts` and executed via `pnpm dlx prisma db seed`.

---

---

## 4. Zod (Data Validation & Type Inference Engine)

### 4.1 Architectural Responsibility Boundary (`DEC-002`, `DEC-014`)

Zod is the authoritative schema validation and static type inference engine for Liminal Backend (`"zod": "^4.5.4"`). It guards application boundaries against malformed or malicious inputs before requests reach controllers or services.

```text
HTTP Request (body / query / params)
         ↓
  validateRequest(schema)
  [Zod safeParseAsync]
         ↓  (Pass: Store in res.locals.validated)
         ↓  (Fail: Throw AppValidationError / formatZodIssues)
    Controller (Reads ONLY res.locals.validated)
         ↓
     Service (Applies business rules & domain invariant checks)
         ↓
   Repository / Prisma (Enforces DB constraints & referential integrity)
```

| Zod / `validateRequest` Boundary Owns | Service / Domain Boundary Owns | Prisma / PostgreSQL Layer Owns |
| :--- | :--- | :--- |
| Shape, primitive types, and required fields | Business logic rules & permissions | Physical column types & nullability |
| String lengths, patterns, regex, formatting | Cross-entity business invariants | Unique constraints & foreign key integrity |
| String sanitization (`.trim()`, `.toLowerCase()`) | Account status & state transitions | Cascading rules & database check constraints |
| Input transformation & coercion (`z.coerce.number()`) | Temporal validation requiring DB state | Auto-generated default values & timestamps |
| Converting raw inputs into strongly-typed objects | Calling third-party providers & auth APIs | Transaction isolation & row locks |

> **Hard Rule:** Never duplicate business or database validations in Zod schemas. For example, verifying whether an email is already registered, whether a user has sufficient balance, or whether an ID exists in the database belongs in the Service or Database layer, not inside Zod refinements or custom schemas.

---

### 4.2 Schema Design & Zod v4 Standards

All module request schemas must reside in `<module>.validation.ts` and follow strict Zod v4 syntax:

1. **Top-Level Request Structure:**
   Every route validation schema must implement `RequestValidationSchema`:
   ```typescript
   import { z } from "zod";

   export const exampleSchema = {
     body: z.strictObject({
       // validated body fields
     }),
     params: z.object({
       id: z.string().uuid({ error: "ID must be a valid UUID v4" }),
     }),
     query: z.object({
       page: z.coerce.number().int().positive().default(1),
       limit: z.coerce.number().int().positive().max(100).default(10),
     }),
   };
   ```

2. **Strict Object Principle for Payloads:**
   - Always use `z.strictObject({...})` or `z.object({...}).strict()` for incoming JSON request bodies (`body`).
   - **Rationale:** Strict objects actively reject unexpected or extraneous fields (`unrecognized_keys`), preventing mass assignment vulnerabilities and accidental parameter pollution.

3. **Zod v4 Error Customization Syntax:**
   - In Zod v4, custom error messages are declared using `{ error: "..." }` or dynamic callbacks `{ error: (issue) => "..." }`.
   - Do NOT use legacy Zod v3 signatures such as `{ message: "..." }`, `{ required_error: "..." }`, or `{ invalid_type_error: "..." }`.
   ```typescript
   // Recommended (Zod v4 Standard):
   z.string({ error: "Name is required" })
     .trim()
     .min(2, { error: "Name must be at least 2 characters long" })
     .max(100, { error: "Name cannot exceed 100 characters" });

   // Dynamic contextual error:
   z.number({
     error: (issue) => issue.input === undefined ? "Price is required" : "Price must be a valid number",
   });
   ```

4. **Input Sanitization & Normalization Pipeline:**
   - Always sanitize and normalize string inputs at the schema level before executing format validations:
     - Apply `.trim()` on all text fields.
     - Apply `.toLowerCase()` on email addresses and case-insensitive usernames.
   - **Order of Execution & Deprecation Rule:** In Zod v4, `z.string().email()` is deprecated in favor of `z.email()`. However, calling `z.email().trim()` evaluates regex before trimming, causing inputs with accidental leading or trailing whitespace to fail format checks prematurely. Therefore, the canonical non-deprecated Zod v4 pattern uses `.pipe(z.email(...))` to pipe normalized string values directly into the standalone `z.email()` validator:
   - Canonical Standard Pattern:
     ```typescript
     email: z
       .string({
         error: (issue) =>
           issue.input === undefined
             ? "Email address is required"
             : "Email must be a valid text string",
       })
       .trim()
       .toLowerCase()
       .pipe(
         z
           .email({ error: "Please provide a valid email address" })
           .max(255, { error: "Email address cannot exceed 255 characters" })
       );
     ```

5. **Security & Regex Constraints:**
   - Passwords must be validated with explicit complexity rules using `.regex()` and descriptive error messages:
     ```typescript
     password: z
       .string({ error: "Password is required" })
       .min(8, { error: "Password must be at least 8 characters long" })
       .max(128, { error: "Password cannot exceed 128 characters" })
       .regex(/[A-Z]/, { error: "Password must contain at least one uppercase letter" })
       .regex(/[a-z]/, { error: "Password must contain at least one lowercase letter" })
       .regex(/[0-9]/, { error: "Password must contain at least one number" })
       .regex(/[^A-Za-z0-9]/, { error: "Password must contain at least one special character" });
     ```

---

### 4.3 Request Validation Middleware (`validateRequest.ts`)

Request validation is executed via `src/app/middleware/validateRequest.ts`:

1. **Asynchronous Parsing:**
   Always use `schema[source].safeParseAsync(sourceData)` to support asynchronous refinements, transformations, and non-blocking validation execution.

2. **Storage in `res.locals.validated` (`DEC-014`):**
   - Transformed and validated outputs are stored in `res.locals.validated[source]`.
   - **Immutability Principle:** `req.body`, `req.query`, and `req.params` must NEVER be modified directly by validation middleware.
   - Controllers must read exclusively from `res.locals.validated[source]` via `ValidatedLocals<TSchema>`.

3. **Issue Formatting Pipeline:**
   Validation errors are transformed from raw `z.ZodIssue` items into application-standard `ErrorDetail` objects:
   ```typescript
   interface ErrorDetail {
     source: "body" | "params" | "query";
     field: string;   // dot-delimited path (e.g., "address.postalCode" or "items[0].id")
     message: string; // clear, client-friendly validation instruction
   }
   ```
   When validation fails, `validateRequest` instantly aborts request processing with `AppValidationError(details)`.

---

### 4.4 Static Type Inference Standards

To eliminate duplicate TypeScript type declarations and keep types 100% synchronized with runtime validations:

1. **Infer from Schemas:**
   Always infer types directly from validation schemas:
   ```typescript
   export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema.body>;
   export type LoginWithCredentialsInput = z.infer<typeof loginWithCredentialsSchema.body>;
   export type CustomerQueryInput = z.infer<typeof customerListQuerySchema.query>;
   ```

2. **Understanding `z.infer`, `z.output`, and `z.input`:**
   - In 99% of backend application handlers, `z.infer<T>` (which is synonymous with `z.output<T>`) is required, representing the sanitized, transformed, and coerced data.
   - Use `z.input<T>` only when typing the raw, unvalidated external payload (e.g., testing mock payloads before passing them to the validator):
     ```typescript
     // If schema has coercion or transforms:
     const schema = z.object({ count: z.coerce.number() });
     type Input = z.input<typeof schema>;   // { count?: unknown }
     type Output = z.output<typeof schema>; // { count: number }
     type Infer = z.infer<typeof schema>;   // { count: number } (Output)
     ```

3. **Controller Parameter Typing:**
   Use the project helper type `ValidatedLocals<TSchema>` when declaring Express controller parameters:
   ```typescript
   export const registerCustomer = catchAsync(
     async (
       _req: Request,
       res: Response<ApiResponse<RegisterResponseData>, ValidatedLocals<typeof registerCustomerSchema>>
     ) => {
       const validatedBody = res.locals.validated.body;
       // validatedBody is fully typed and sanitized
     }
   );
   ```

---

### 4.5 Environment Variable Validation (`src/app/config/env.ts`)

All application environment variables are validated at boot-up using Zod (`DEC-001`, `DEC-002`):

1. **Fail-Fast Boot Principle:**
   - If any environment variable is missing, invalid, or violates required constraints, the application must immediately throw `ConfigurationError` and terminate the process before listening on any port.
   - Sensitive credentials (e.g., database passwords, Better Auth secrets) must NEVER be printed in error logs.

2. **Coercion & URL Standards:**
   - Use `z.coerce.number()` for numeric variables (`PORT`, `RATE_LIMIT_MAX_REQUESTS`).
   - Use `z.url()` with explicit error messages for network endpoints (`DATABASE_URL`, `BETTER_AUTH_URL`, `FRONTEND_URL`).
   - Use `z.enum(["development", "production", "test"])` for `NODE_ENV`.

---

### 4.6 Advanced Zod Capabilities: Metadata, JSON Schema & Codecs

Zod v4 provides native architectural features for documentation and system interoperability:

1. **Schema Metadata (`.describe()` and `.meta()`):**
   - Attach human-readable field documentation and contract notes directly to schema fields:
     ```typescript
     const priceSchema = z.number().positive().describe("Unit price in BDT currency");
     ```
   - Useful for automated API documentation generation (e.g., OpenAPI / Swagger generation).

2. **JSON Schema Generation (`z.toJsonSchema()`):**
   - When communicating data contracts to frontend clients, form builders, or external webhooks, use Zod's native JSON schema conversion:
     ```typescript
     const jsonSchema = z.toJsonSchema(exampleSchema.body);
     ```

3. **Bidirectional Codecs (`z.codec()`):**
   - For complex bidirectional serialization (such as parsing a comma-separated query string into an array and serializing it back), utilize Zod v4 codecs rather than ad-hoc split/join functions.

---

### 4.7 Prohibited Anti-Patterns & Best Practices

| Anti-Pattern | Correct Practice | Reason |
| :--- | :--- | :--- |
| `req.body.email = ...` | Read sanitized data from `res.locals.validated.body` | Mutating `req` breaks purity and bypasses express immutability guarantees. |
| Using `z.any()` or `z.unknown()` in body schemas | Explicitly define schemas or use `z.record()` with typed values | Unchecked input destroys type safety downstream. |
| Passing unvalidated `req.params.id` to services | Validate with `params: z.object({ id: z.string().uuid() })` | Prevents invalid UUID syntax errors from crashing database queries. |
| Catching Zod errors inside Controllers | Let `validateRequest` handle errors and throw `AppValidationError` | Preserves standard centralized error serialization architecture (`DEC-014`). |
| Using Zod refinements (`.refine()`) for DB checks | Execute DB existence queries in Services/Repositories | Schemas must remain pure, synchronous or bounded, and decoupled from DB connections. |
| Legacy Zod v3 error options (`required_error`) | Use Zod v4 `{ error: "..." }` or `{ error: (issue) => ... }` | Deprecated in Zod v4; causes type errors or ignored message strings. |

---

## 5. Future Integrations Baseline (Redis, Stripe, Cloudinary)

As defined in `DEC-004` (Replaceable External Provider Boundaries):
1. **Isolation:** External provider SDKs must remain strictly encapsulated behind dedicated application boundaries (`src/app/shared/<provider>/` or feature-specific adapters).
2. **Error Translation:** Provider-specific errors must be caught at the integration boundary and translated into application-standard `AppError` instances before reaching controllers or routes.
3. **Configuration:** All provider secrets and credentials must be read exclusively from `src/app/config/env.ts` with strict Zod validation at startup.

