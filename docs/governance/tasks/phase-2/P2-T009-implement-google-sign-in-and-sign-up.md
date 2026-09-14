# Task: P2-T009 - Implement Google Sign-In and Sign-Up

> **Canonical Status:** `🔲 Planning candidate` → `🔄 In progress` (awaiting human approval)  
> **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`  
> **Requirement Reference:** `FR-AUTH-002`, `FR-AUTH-004.5`, `FR-RBAC-001.2`, `FR-RBAC-001.3`  
> **ERD Reference:** `User`, `Account`, `Session`, `Customer`  
> **Dependencies:** `P2-T005` (✅), `P2-T008` (✅)

---

## 1. Context & Traceability

- **Objective:** Support Google OAuth authentication through Better Auth exclusively for the **`CUSTOMER`** role, ensuring no duplicate accounts are created, verified Google identities bypass separate OTP verification, and privileged roles (`ADMIN`, `SUPER_ADMIN`) are strictly rejected from public customer login portals.
- **PRD Alignment:**
  - `FR-AUTH-002.1`: Secure Google OAuth flow handled by Better Auth.
  - `FR-AUTH-002.2`: First-time Google authentication creates a Customer account (`role: CUSTOMER` with atomic/linked `Customer` profile record).
  - `FR-AUTH-002.3`: Verified Google email identity treated as email-verified (`emailVerified: true`).
  - `FR-AUTH-002.4`: Prevent unintended duplicate accounts when Google authentication matches an existing customer account (account linking policy).
  - `FR-AUTH-002.5`: Google authentication must never grant, modify, or authenticate privileged roles (`ADMIN`, `SUPER_ADMIN`).
  - `FR-AUTH-004.5`: Verified Google identities do not require a separate email verification OTP.
  - `FR-RBAC-001.2` & `FR-RBAC-001.3`: Strict separation between customer-facing authentication and dedicated administrative portals.

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Customer-Exclusive Authentication Boundary:**
   - Both `/login` (credential login) and `/login/google` (Google OAuth) are dedicated exclusively to customer authentication.
   - Administrative users (`ADMIN`, `SUPER_ADMIN`) are prohibited from authenticating or linking accounts through the public customer portal.
2. **Google OAuth Provider Configuration (`src/app/config/auth.ts`):**
   - Configure `socialProviders.google` in Better Auth with `clientId` and `clientSecret` from `env.ts`.
   - Enable secure account linking policy (`account.accountLinking.enabled: true`) strictly for customer accounts.
3. **Customer Profile Creation on Google Sign-Up:**
   - When a new user registers via Google (`role === UserRole.CUSTOMER`), automatically create the corresponding `Customer` profile record in PostgreSQL via a database hook, maintaining strict database relational integrity.
4. **Email Verification & Privilege Protection:**
   - First-time Google accounts receive `emailVerified: true`.
   - **Privilege Account Guard:** If a user attempting Google authentication matches an existing user whose role is `ADMIN` or `SUPER_ADMIN`, the authentication cycle must be rejected with `HTTP 403 Forbidden` (`FORBIDDEN_ROLE_ACCESS`), preventing privileged accounts from being accessed or linked via public customer OAuth.
5. **Account Status & Soft-Delete Interception:**
   - Existing centralized session-creation lifecycle guards (`databaseHooks.session.create.before`) apply identically to Google sign-in:
     - Soft-deleted users (`deletedAt !== null`) receive generic `401 INVALID_CREDENTIALS` (anti-enumeration per `DEC-018`).
     - Suspended users receive `403 ACCOUNT_SUSPENDED`.
     - Deactivated users receive `403 ACCOUNT_DEACTIVATED`.
6. **Session Cookies & Sanitized Response:**
   - Successful Google OAuth callback issues standard secure session cookies (`session_token`, cookie cache) and redirects to frontend.

### Out of Scope

- Administrative login endpoints (deferred to dedicated admin portal tasks under Workstream C).
- Application-managed JWT tokens in response bodies (strictly cookie-only session issuance per `DEC-003`).
- Manual OAuth token refresh or custom Google API calls outside Better Auth.
- Account unlinking endpoints (deferred to `P2-T011`).
- Live production Google credentials deployment verification (deferred to `P2-T027` per `P2-B010`; task verified with unit/integration tests and mocked OAuth flow).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Support Google OAuth through Better Auth | Step 1 & 2 | Better Auth handles Google OAuth callback and session creation |
| Assign `CUSTOMER` role & create `Customer` profile for new Google users | Step 2 & 3 | Inspect database: new Google user has `role: CUSTOMER` and related `Customer` record |
| Treat Google identity as email-verified (`emailVerified: true`) | Step 2 | New user created via Google has `emailVerified: true` |
| Prevent duplicate accounts via customer account linking | Step 2 & 4 | Signing in with Google on existing customer email links `Account` without duplicate `User` |
| Reject privileged accounts (`ADMIN`, `SUPER_ADMIN`) on customer Google login | Step 2 & 4 | Existing `ADMIN`/`SUPER_ADMIN` email returns `HTTP 403 Forbidden` on Google login |
| Enforce account status restrictions (suspended/deactivated/deleted) | Step 2 & 4 | Suspended or deactivated Google users rejected with 403; soft-deleted rejected with 401 |

---

## 3. Verified Current Codebase State

- **`src/app/config/env.ts`:**
  - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are defined as optional trimmed strings.
- **`src/app/config/auth.ts`:**
  - Better Auth is configured with `prismaAdapter`, `emailAndPassword`, `emailVerification`, and `emailOTP`.
  - `databaseHooks.session.create.before` centralizes status guards (`deletedAt`, `SUSPENDED`, `DEACTIVATED`, `emailVerified`).
  - `socialProviders` is not yet enabled.
- **`src/app/app.ts` & `src/app/routes/index.ts`:**
  - Application routes are mounted under `/api/v1`.
  - Better Auth endpoints (`/api/v1/auth/*`) are dispatched through the express router or directly through Better Auth handlers.
- **`prisma/schema/auth.prisma`:**
  - `Account` model has `providerId` and `accountId` supporting OAuth accounts linked to `User`.

---

## 4. Implementation Approach

### 4.1 Better Auth Configuration Update (`src/app/config/auth.ts`)

1. **Enable Google Social Provider:**
   ```typescript
   socialProviders: {
     google: {
       clientId: env.GOOGLE_CLIENT_ID || "",
       clientSecret: env.GOOGLE_CLIENT_SECRET || "",
       enabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
     },
   },
   ```
2. **Account Linking Configuration:**
   Enable automatic account linking for trusted email providers (Google verifies emails):
   ```typescript
   account: {
     accountLinking: {
       enabled: true,
       trustedProviders: ["google"],
     },
   },
   ```
3. **Database Hook for Customer Profile Creation:**
   Use `databaseHooks.user.create.after` to automatically create a `Customer` record when a new user is created with `role === UserRole.CUSTOMER` (such as via Google OAuth sign-up):
   ```typescript
   databaseHooks: {
     user: {
       create: {
         after: async (user) => {
           if (user.role === UserRole.CUSTOMER) {
             await prisma.customer.upsert({
               where: { userId: user.id },
               create: { userId: user.id },
               update: {},
             });
           }
         },
       },
     },
     session: {
       create: {
         before: async (session) => {
           // existing status and soft-delete guards
         },
       },
     },
   },
   ```

### 4.2 Customer OAuth Routing (`/login/google` & `/callback/google`)

Per `DEC-020` and user architectural direction:
- Initiation Route: `POST /api/v1/auth/login/google`
  - Express route in `src/app/modules/auth/auth.routes.ts` maps `POST /login/google` to Better Auth's social sign-in initiation (`provider: "google"`).
- Callback Route: `GET /api/v1/auth/callback/google`
  - Better Auth processes the OAuth exchange, issues secure session cookies, and redirects the customer to the frontend.
- Administrative Role Protection:
  - If a user authenticated via Google possesses role `ADMIN` or `SUPER_ADMIN`, the session creation hook/callback aborts and rejects with `HTTP 403 Forbidden` (`FORBIDDEN_ROLE_ACCESS`), preventing privileged accounts from using or linking to the customer portal.

---

## 5. Affected Files & Directives

| Action | File Path | Responsibility |
| :----- | :-------- | :------------- |
| `[MODIFY]` | `src/app/config/auth.ts` | Configure `socialProviders.google`, `account.accountLinking`, customer role guard, and `databaseHooks.user.create.after` |
| `[MODIFY]` | `src/app/modules/auth/auth.routes.ts` | Mount `POST /login/google` and Better Auth callback handler under `/api/v1/auth` |
| `[MODIFY]` | `src/app/modules/auth/auth.service.ts` | Enforce customer-only role check (`user.role === UserRole.CUSTOMER`) on `POST /api/v1/auth/login` per `DEC-020` |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md` | Track `P2-T009` progress from `🔲` to `🔄` and `✅` |
| `[MODIFY]` | `docs/governance/tasks/phase-2/P2-T009-implement-google-sign-in-and-sign-up.md` | Record JIT execution plan and implementation evidence |

---

## 6. Step-by-Step Execution Plan

1. **Step 1: Plan Approval & Blocker Clearance:**
   - Confirm resolution of `P2-B001` (`POST /login/google` and `GET /callback/google`) and `P2-B003` (customer-only account linking per `DEC-020`).
   - Mark `P2-T009` as `🔄 In progress` in parent phase file.
2. **Step 2: Customer Exclusivity Enforcement on `/login` (`src/app/modules/auth/auth.service.ts`):**
   - Guard `loginWithCredentials`: if `authResult.user.role !== UserRole.CUSTOMER`, revoke session immediately and throw `HTTP 403 Forbidden` (`FORBIDDEN_ROLE_ACCESS`).
3. **Step 3: Better Auth Google Configuration & Customer Hook (`src/app/config/auth.ts`):**
   - Add `socialProviders.google` and `account.accountLinking`.
   - Add `databaseHooks.user.create.after` to automatically create a `Customer` profile record for new Google sign-ups (`role === UserRole.CUSTOMER`).
   - Add role guard ensuring non-customer accounts cannot establish sessions or link via Google OAuth.
4. **Step 4: Route Mounting (`src/app/modules/auth/auth.routes.ts`):**
   - Mount `POST /login/google` and Better Auth route handler for `/callback/google`.
5. **Step 5: Comprehensive Verification:**
   - Verify first-time Google sign-up assigns `CUSTOMER` role, `emailVerified: true`, and creates `Customer` profile.
   - Verify returning customer links Google account without duplicate `User`.
   - Verify privileged user (`ADMIN`, `SUPER_ADMIN`) is rejected on both `/login` and `/login/google` with `HTTP 403 Forbidden`.
   - Verify suspended, deactivated, and soft-deleted accounts are intercepted properly.
6. **Step 6: Code Quality & Review Gates:**
   - Run `pnpm lint` and `pnpm exec tsc --noEmit`.
   - Record actual verification evidence and submit for human review (`🕵️`).

---

## 7. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :---- | :------- | :---------------- | :----- |
| Acceptance criteria | `Yes` | Verify PRD `FR-AUTH-002` requirements & `DEC-020` | `NOT RUN` |
| Type check / build | `Yes` | `pnpm exec tsc --noEmit` | `NOT RUN` |
| Lint | `Yes` | `pnpm lint` | `NOT RUN` |
| First-time Google user creation | `Yes` | Check User created with `role: CUSTOMER`, `emailVerified: true`, and `Customer` profile row | `NOT RUN` |
| Customer account linking check | `Yes` | Check existing customer email links Google `Account` without duplicate `User` | `NOT RUN` |
| Privileged role rejection | `Yes` | Existing `ADMIN`/`SUPER_ADMIN` rejected on `/login` and `/login/google` with HTTP 403 | `NOT RUN` |
| Restricted account check | `Yes` | Suspended/deactivated users rejected with 403; soft-deleted rejected with 401 | `NOT RUN` |

---

## 8. Assumptions & Blockers

- **Active Blockers:**
  - `P2-B001`: Approved customer Google endpoints (`POST /api/v1/auth/login/google`, `GET /api/v1/auth/callback/google`).
  - `P2-B003`: Approved account-linking policy (Google verified email identity automatically links to matching existing customer user; privileged accounts rejected per `DEC-020`).
- **Design Assumptions:**
  - Live Google API testing is deferred to final integration `P2-T027` per `P2-B010`; feature-level verification is conducted via programmatic Better Auth sign-in/account linkage and test mocks.

---

## 9. Plan Review

| Field | Value |
| :---- | :---- |
| Outcome | `Pending` |
| Reviewed by | Zahidul Islam |
| Reviewed on | `Pending` |
| Notes | Awaiting human approval to resolve blockers and begin implementation. |

---

## 10. Implementation Evidence

_To be completed after code execution and before marking awaiting human review:_

- **Changed Files:**
- **Migration Created:** None (schema already includes `Account` model)
- **Test / Verification Output:**
- **Deviations from Original Plan:**
- **Remaining Concerns / Follow-ups:**
