# 02. Architecture

> Defines the approved backend architecture, layer boundaries, module structure and integration rules.

## 1. Architectural Pattern

Liminal Backend uses **Layered Architecture with modular feature boundaries**.

```text
HTTP Request
    ↓
Global Middleware
    ↓
Route
    ↓
Controller
    ↓
Service
    ↓
Repository
    ↓
Prisma
    ↓
PostgreSQL
```

A layer may normally depend only on the layer directly below it. Shared infrastructure such as configuration, errors, middleware and common interfaces or types may be consumed where appropriate.

### Route
- Maps HTTP method/path.
- Composes middleware.
- Connects requests to controllers.
- No business or persistence logic.

### Controller
- Receives validated input.
- Calls the appropriate service.
- Shapes the HTTP response through shared response conventions.
- No business logic, repository calls or direct Prisma access.

### Service
- Owns business rules and orchestration.
- Enforces authorization that requires business context and ownership checks.
- Coordinates repositories and approved integrations.
- Coordinates transactions when required.
- Must not depend on Express `req`/`res`.

### Repository
- Owns persistence and Prisma queries.
- Applies approved data-access conventions, such as excluding soft-deleted records where required.
- No HTTP concerns or business authorization decisions.

### Prisma
- ORM/data-access layer for PostgreSQL.
- Generated Prisma output must never be hand-edited.

## 2. Repository Layout

The established repository layout is:

```text
liminalbd-backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── config/
│   │   ├── errors/
│   │   ├── interfaces/
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   └── <module-name>/
│   │   │       └── <module files as required>
│   │   ├── routes/
│   │   │   └── index.ts
│   │   └── generated/
│   ├── app.ts
│   └── server.ts
├── docs/
│   ├── product/
│   └── governance/
├── AGENTS.md
├── Dockerfile
├── prisma.config.ts
├── package.json
└── tsconfig.json
```

Do not restructure the established layout without an approved decision recorded in `docs/governance/DECISIONS.md`.

## 3. Module Anatomy

Module structure is **responsibility-driven, not file-count-driven**.

A typical feature module may contain:

```text
<module-name>/
├── <module>.routes.ts
├── <module>.controller.ts
├── <module>.service.ts
├── <module>.repository.ts
├── <module>.validation.ts
├── <module>.interface.ts
└── <module>.types.ts
```

The actual file set depends on the module's responsibilities.

Rules:

- A module may contain fewer or more files than the example.
- Create a file only when a real responsibility requires it.
- Do not create empty, duplicate or speculative files.
- Keep each file focused on one clear responsibility.
- Module-specific interfaces are optional.
- Use Prisma-generated types or interfaces when they already provide the required contract.
- Create a module-specific `*.interface.ts` only when an additional application-level abstraction or contract is actually needed.
- Use module-specific `*.types.ts` when custom types are needed and are not already adequately provided elsewhere.
- Do not merge unrelated responsibilities merely to reduce file count.

## 4. Dependency Boundaries

Allowed direction:

```text
Route → Controller → Service → Repository → Prisma
```

Not allowed by default:

- Controller → Repository
- Controller → Prisma
- Service → Express `req`/`res`
- Repository → Controller/HTTP response
- Feature module → another module's repository implementation
- Feature module → raw external-provider SDK

Cross-module behavior should use explicit service or application-level interfaces or boundaries.

## 5. Shared Infrastructure

- `src/app/config/`: environment and runtime configuration, third-party client setup.
- `src/app/errors/`: typed application errors and error-code mapping.
- `src/app/interfaces/`: shared interfaces, contracts and common types.
- `src/app/middleware/`: authentication, authorization/RBAC, validation, error handling, rate limiting and other cross-cutting middleware.
- `src/app/routes/index.ts`: mounts module routers; no business logic.
- `src/app/generated/`: generated output; never hand-edit.

## 6. Authentication and Authorization Boundary

**Better Auth owns:**
- credential handling;
- password hashing;
- session lifecycle;
- session tokens/cookies;
- email verification mechanics;
- Google OAuth mechanics.

**Application code owns:**
- roles: `SUPER_ADMIN`, `ADMIN`, `CUSTOMER`;
- RBAC and authorization rules;
- resource ownership;
- account-status policy;
- audit requirements;
- business-level account restrictions.

Do not build a second custom authentication/session system.

## 7. External Integration Boundaries

Current integrations include Better Auth, Stripe, Cloudinary, SMTP/Nodemailer and Redis.

Provider-specific SDK usage must stay behind explicit application boundaries. Controllers and unrelated feature services must not import provider SDKs directly.

```text
Provider SDK → Integration Boundary → Business Service
```

## 8. Data and API Direction

### Data
- PostgreSQL is the relational database; Prisma is the ORM.
- Follow the approved PRD/ERD for schema behavior and domain values.
- Use soft deletion only where the approved model requires it; do not assume every record is soft-deleted.
- Sensitive role, status and administrative operations must be auditable where required by the PRD.
- Do not introduce new roles or data-model behavior without an approved requirement and phase update.

### API
- RESTful HTTP API with JSON payloads.
- Centralized validation and error handling.
- Shared response conventions.
- Cookie-based session handling through Better Auth.
- Do not expose session secrets as application-managed access/refresh tokens without an approved architecture change.

## 9. Architectural Change Rule

If a task requires changing layer boundaries, module anatomy, shared infrastructure, authentication boundaries, provider boundaries, database ownership patterns or repository layout:

1. Stop implementation.
2. Explain the reason and relevant alternatives.
3. Obtain human approval.
4. Record the decision in `docs/governance/DECISIONS.md`.
5. Update this document when the architecture itself changes.

**Architecture principle: explicit responsibilities, predictable dependencies, stable boundaries.**
