# 01. Project Context

> Condensed project context for AI agents.
> This document explains what is being built, why it exists, and the current
> approved implementation scope. It does not replace the PRD or ERD.

## 1. Product

Liminal Backend is the production-grade REST API for **Liminal Interior Design
Studio**.

The broader platform brings three business areas under one backend:

1. **Interior Design Services** — design services, project showcases, and
   structured client inquiries.

2. **Custom Furniture Design** — custom furniture requirements and inquiry
   workflows.

3. **Ready-Made Furniture Retail** — product catalog, cart, checkout, payment,
   and order workflows.

The backend is designed as a scalable foundation that can support additional
business modules without breaking established architecture or governance.

## 2. Product Goals

The backend should be:

- secure;
- maintainable;
- scalable;
- consistent across modules;
- auditable where business operations require traceability;
- suitable for cloud and container-based deployment.

## 3. Users and Access Model

The approved role model includes:

| Role | Responsibility |
|---|---|
| `SUPER_ADMIN` | Privileged administrative authority, including account and role management as defined by the PRD. |
| `ADMIN` | Manages authorized business operations within defined RBAC boundaries. |
| `CUSTOMER` | Manages permitted account data and accesses customer-owned resources and services. |

Exact permissions, restrictions, and ownership rules must follow the approved
PRD and RBAC requirements.

## 4. Current Technology Direction

The backend technology direction includes:

- Node.js
- Express
- TypeScript
- PostgreSQL
- Prisma
- Redis
- Better Auth
- Stripe
- Cloudinary
- Nodemailer / SMTP
- Winston
- Zod
- Jest
- pnpm

Exact versions and implementation decisions are defined by the repository,
architecture documentation, and approved technical decisions.

## 5. Architecture Direction

The default application flow is:

`Route → Controller → Service → Repository → Prisma`

Authentication and session mechanics are delegated to Better Auth.

Application code is responsible for Liminal-specific concerns such as:

- RBAC;
- authorization;
- ownership enforcement;
- account status rules;
- business restrictions;
- audit requirements where applicable.

External providers must remain behind appropriate boundaries so provider-specific
SDK details do not spread into unrelated business logic.

## 6. Current Approved Implementation Scope

Implementation scope is controlled by the approved phase roadmap, not by the
full product vision.

The currently approved phases are:

### Phase 1 — Foundation

Establishes the application's core foundation, including the project structure,
shared infrastructure, tooling, database/ORM foundation, and development
conventions.

### Phase 2 — Authentication & RBAC

Defines the currently approved authentication and authorization scope, including
the role model and related access-control, ownership, account-status, and
privileged account-management requirements defined by the PRD and active phase
plan.

Do not implement product areas outside the currently approved phase scope.

## 7. Future Product Scope

The broader product vision includes additional capabilities such as project
showcases, inquiries, commerce, payments, media, content, caching, and audit
features.

These areas must not be designed or implemented from assumptions.

A future module becomes implementation-ready only when its requirements are
formally defined in the approved product documentation and represented in the
governance and phase execution plan.

## 8. Source Documents

The authoritative product sources are:

- `docs/product/PRD.md` — functional requirements, business rules, and
  acceptance criteria.
- `docs/product/ERD.drawio` — entity relationships and data-model intent.

This document is a condensed context layer.

When exact behavior, permissions, validation rules, API behavior, or data-model
details are required, consult the relevant approved source instead of guessing.

## 9. Context Principle

Use this file to understand the project quickly.

Use the phase roadmap to determine current scope.

Use the active phase file to determine the current task.

Use the PRD and ERD when exact requirement details are needed.

> **Do not convert the broader product vision into implementation requirements.**
> **Implement only what is formally approved and planned.**