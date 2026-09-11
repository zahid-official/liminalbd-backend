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

*(Detailed operational guidelines, transaction boundaries, and driver adapter rules will be expanded here as data-layer features evolve.)*

- **Boundary Rule:** Prisma must only be accessed through repository boundaries (`*.repository.ts`) or approved application infrastructure. Controllers and business services must not import `prisma` directly.
- **Enum Rule:** Always import and compare generated Prisma enum constants (e.g. `UserStatus.SUSPENDED`, `UserRole.CUSTOMER`) rather than raw string literals.
- **Output Rule:** Generated Prisma files in `src/generated/` are read-only and must never be edited by hand.

---

## 4. Future Integrations Baseline (Redis, Stripe, Cloudinary)

As defined in `DEC-004` (Replaceable External Provider Boundaries):
1. **Isolation:** External provider SDKs must remain strictly encapsulated behind dedicated application boundaries (`src/app/shared/<provider>/` or feature-specific adapters).
2. **Error Translation:** Provider-specific errors must be caught at the integration boundary and translated into application-standard `AppError` instances before reaching controllers or routes.
3. **Configuration:** All provider secrets and credentials must be read exclusively from `src/app/config/env.ts` with strict Zod validation at startup.
