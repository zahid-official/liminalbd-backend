# 07. Technology Integrations Guide

> Authoritative reference for core external technologies, libraries, and provider boundaries in Liminal Backend.
> Defines architectural integration patterns, operational rules, and error contracts for third-party technologies.
> Governed under [AGENTS.md](../../AGENTS.md), [02-ARCHITECTURE.md](02-ARCHITECTURE.md), [03-CODING-STANDARDS.md](03-CODING-STANDARDS.md), and [DECISIONS.md](DECISIONS.md) (`DEC-003`, `DEC-004`, `DEC-014`).

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
| Credential validation and secure password hashing | User roles (`SUPER_ADMIN`, `ADMIN`, `CUSTOMER`) |
| Session token generation, signing, and lifecycle | RBAC enforcement and authorization guards |
| Cookie serialization, encryption, and caching | User account status policy (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`) |
| Email verification mechanics and OTP delivery | Soft deletion lifecycle (`deletedAt`) |
| Google OAuth handshake and token management | Resource ownership verification |
| Built-in brute-force and request rate limiting | Audit logging of sensitive and privileged events |

> **Hard Rule:** Never construct a parallel session or custom authentication mechanism. Never store JWTs in local storage or expose raw tokens in response bodies.

### 2.2 Server-Side Invocation Standard

When invoking Better Auth endpoints from application services, always use the internal server-side `auth.api` contract.

1. **Pass Request Headers:** Always forward incoming request headers (`headers: req.headers` converted via `fromNodeHeaders` or `new Headers()`) to maintain client IP tracking, User-Agent recording, and session cookie validation.
2. **Use `returnHeaders: true` When Capturing Set-Cookie:**  
   When an operation generates or refreshes cookies (e.g., `signInEmail`, `signOut`), supply `returnHeaders: true`.
   - **Why:** `returnHeaders: true` automatically throws typed `APIError` upon failure and directly returns typed `{ headers, response }` on success.
   - Avoid `asResponse: true` for business services, as it suppresses exceptions and returns raw web Response streams requiring manual status verification.

```ts
// Canonical Server-Side Sign-In Invocation
const { headers: authHeaders, response: authResult } =
  await auth.api.signInEmail({
    body: { email, password },
    headers,
    returnHeaders: true,
  });

const setCookie = authHeaders.get("set-cookie");
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

  | Better Auth Code (`error.body.code`) | HTTP Status | Public Application Code |
  | :--- | :--- | :--- |
  | `INVALID_EMAIL_OR_PASSWORD` | `401 Unauthorized` | `INVALID_CREDENTIALS` |
  | `INVALID_PASSWORD` | `401 Unauthorized` | `INVALID_CREDENTIALS` |
  | `INVALID_OTP` | `400 Bad Request` | `INVALID_OR_EXPIRED_OTP` |
  | `TOKEN_EXPIRED` | `400 Bad Request` | `INVALID_OR_EXPIRED_OTP` |
  | `USER_NOT_FOUND` | `404 Not Found` | `USER_NOT_FOUND` |
  | `USER_ALREADY_EXISTS` | `409 Conflict` | `USER_ALREADY_EXISTS` |
  | Unknown / Generic `APIError` | `error.statusCode` | `VALIDATION_ERROR` |

### 2.6 Security and Account Lifecycle Enforcement

Application services must enforce account status rules **before and after** delegating to Better Auth:

1. **Pre-Authentication Guard:**
   - Soft-deleted (`deletedAt !== null`) and non-existent users must return identical generic `401 INVALID_CREDENTIALS` errors to prevent email enumeration.
   - Unverified accounts (`emailVerified === false`) must return `403 EMAIL_NOT_VERIFIED`.
   - Suspended accounts (`status === UserStatus.SUSPENDED`) must return `403 ACCOUNT_SUSPENDED`.
   - Deactivated accounts (`status === UserStatus.DEACTIVATED`) must return `403 ACCOUNT_DEACTIVATED`.

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

1. **Explicit Field Selection:**
   - Prefer `select` over returning full database models, especially on models containing sensitive hashes (`password`, tokens, internal audit metadata).
   - In Prisma v7, `omit` can be used to explicitly exclude fields (e.g., `omit: { password: true }`), but cannot be combined simultaneously with `select`.
2. **Soft Deletion Convention:**
   - Entities implementing soft deletion feature a `deletedAt DateTime?` column.
   - Repositories must explicitly filter `where: { deletedAt: null }` for normal operational queries unless the specific method explicitly handles trash or recovery semantics.
3. **Relations & Joins:**
   - Avoid N+1 query patterns. Use `include` or nested `select` to fetch relational records in a single database round trip.
   - For relation counting without loading children, use `_count: { select: { ... } }`.

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

## 4. Future Integrations Baseline (Redis, Stripe, Cloudinary)

As defined in `DEC-004` (Replaceable External Provider Boundaries):
1. **Isolation:** External provider SDKs must remain strictly encapsulated behind dedicated application boundaries (`src/app/shared/<provider>/` or feature-specific adapters).
2. **Error Translation:** Provider-specific errors must be caught at the integration boundary and translated into application-standard `AppError` instances before reaching controllers or routes.
3. **Configuration:** All provider secrets and credentials must be read exclusively from `src/app/config/env.ts` with strict Zod validation at startup.
