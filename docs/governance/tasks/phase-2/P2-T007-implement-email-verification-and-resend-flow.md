# Task: P2-T007 - Implement Email Verification and Resend Flow

> **Canonical Status:** `🔲` (tracked authoritatively in parent phase file)  
> **Planning Gate:** Draft Plan → Human Approval → Blocker Clearance (`P2-B001` for email verification endpoints) → `🔄 In Progress`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T007`
- **PRD / Requirement Reference:** `FR-AUTH-004` (Email Verification: `FR-AUTH-004.1` through `FR-AUTH-004.5`)
- **ERD Reference:** `User`, `Verification`
- **Dependencies:** `P2-T006` (`✅ Done`)
- **Active Blockers:** `P2-B001` (Public API: Approval of `POST /api/v1/auth/verify-email` and `POST /api/v1/auth/resend-verification`)

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Email Verification Trigger on Registration (`FR-AUTH-004.1`):**
   - Configure Better Auth email verification with an email sending handler/boundary.
   - When a customer registers via `POST /api/v1/auth/register`, trigger the email verification workflow via Better Auth API or integrated hook.
2. **Email Verification Completion (`FR-AUTH-004.2`, `FR-AUTH-004.3`):**
   - Expose endpoint `POST /api/v1/auth/verify-email` (or `GET /api/v1/auth/verify-email` if token via query param).
   - Validate incoming token via Zod schema using `validateRequest`.
   - Verify token against Better Auth / `Verification` store.
   - Upon successful verification, ensure `User.emailVerified` is set to `true`.
   - Reject invalid, expired, or already-used verification tokens with `400 Bad Request` and sanitized error message.
3. **Resend Verification Flow (`FR-AUTH-004.4`):**
   - Expose endpoint `POST /api/v1/auth/resend-verification`.
   - Validate payload (`email`) via Zod schema using `validateRequest`.
   - Re-issue a fresh verification token/link via Better Auth.
   - Guard against abuse with rate-limiting / polite response (e.g. if already verified, reject or gracefully acknowledge without re-sending).
4. **Email Delivery Boundary:**
   - Establish email delivery boundary using nodemailer / SMTP credentials if configured, or a dev/test boundary logger/mock that outputs the verification link cleanly without breaking or leaking secrets.

### Out of Scope

- In-memory custom token tables (Better Auth's `Verification` model is used).
- Full production SMTP infrastructure setup (`P2-B010` allows approved mocks/dev loggers for individual feature tasks).
- Session creation on email verification (verification is an identity state update, not automatic login).

### Acceptance Criteria Mapping

| Acceptance Criterion | Planned Step | Verification |
| :------------------- | :----------- | :----------- |
| Send verification after email/password registration | Step 2 & 3 | Verify verification token generated in DB upon registration |
| Accept only valid, unexpired, and single-use verification requests | Step 3 & 4 | Verify invalid/expired/reused token returns HTTP 400 Bad Request |
| Set `emailVerified` to `true` after successful verification | Step 3 & 4 | Query `User.emailVerified` in database to verify it turns `true` |
| Rate-limit and validate resend requests | Step 2, 3 & 4 | Verify `POST /api/v1/auth/resend-verification` validates email and triggers token re-issue |
| Never expose token secrets or provider credentials in responses | Step 3 & 4 | Verify API response bodies conform to shared response contract |

---

## 3. Verified Current Codebase State

- `src/app/config/auth.ts`: Better Auth configured with `emailAndPassword: { enabled: true }`, but email verification (`sendVerificationEmail`) is not yet wired in.
- `prisma/schema/auth.prisma`: Model `Verification` already exists in PostgreSQL (`id`, `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt`).
- `src/app/config/env.ts`: Contains optional `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- `src/app/modules/auth/`: Contains `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.validation.ts` created under `P2-T006`.

---

## 4. Implementation Approach

### Applicable Architecture Flow
`Route → validateRequest(Zod) → Controller → Service → Better Auth API / Verification Model`

1. **Email Service / Boundary (`src/app/modules/auth/email.service.ts` or `src/app/lib/email.ts`):**
   - Provide an email dispatch function that checks if SMTP is configured.
   - If SMTP is configured, sends via nodemailer/transporter; if in development or not configured, safely logs the verification URL to console for local testing without crashing.
2. **Better Auth Configuration Update (`src/app/config/auth.ts`):**
   - Configure `emailVerification: { sendOnSignUp: true, sendVerificationEmail: ... }` in Better Auth options.
3. **Zod Validation (`src/app/modules/auth/auth.validation.ts`):**
   - `verifyEmailValidationSchema`: validates `token` (string, required).
   - `resendVerificationValidationSchema`: validates `email` (string, valid email format).
4. **Auth Service (`src/app/modules/auth/auth.service.ts`):**
   - `verifyEmail(token: string)`: invokes Better Auth email verification API or verifies token against `Verification` table, updates `User.emailVerified = true`.
   - `resendVerification(email: string)`: checks user status, verifies user is not already verified, and triggers Better Auth `sendVerificationEmail`.
5. **Auth Controller & Routes (`auth.controller.ts`, `auth.routes.ts`):**
   - `POST /api/v1/auth/verify-email`
   - `POST /api/v1/auth/resend-verification`

---

## 5. Affected Files & Directives

| Action | File Path | Responsibility |
| :----- | :-------- | :------------- |
| `[NEW]` | `src/app/modules/auth/email.service.ts` | Email dispatch boundary (SMTP / dev mock logger) |
| `[MODIFY]` | `src/app/config/auth.ts` | Enable Better Auth `emailVerification` and wire email dispatch |
| `[MODIFY]` | `src/app/modules/auth/auth.validation.ts` | Add Zod schemas for verify-email and resend-verification |
| `[MODIFY]` | `src/app/modules/auth/auth.service.ts` | Implement `verifyEmail` and `resendVerification` methods |
| `[MODIFY]` | `src/app/modules/auth/auth.controller.ts` | Implement controller handlers with `catchAsync` & `sendResponse` |
| `[MODIFY]` | `src/app/modules/auth/auth.routes.ts` | Mount endpoints with `validateRequest` |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md` | Update `P2-T007` status and resolve `P2-B001` for verification endpoints |
| `[MODIFY]` | `docs/governance/tasks/phase-2/P2-T007-implement-email-verification-and-resend-flow.md` | Persistent JIT task plan & evidence |

---

## 6. Step-by-Step Execution Plan

1. **Planning & Governance Gate (Step 1):**
   - Review and approve this JIT plan.
   - Resolve `P2-B001` for `POST /api/v1/auth/verify-email` and `POST /api/v1/auth/resend-verification`.
   - Mark `P2-T007` as `🔄 In progress` in phase file and `MEMORY.md`.
2. **Email Boundary & Better Auth Wiring (Step 2):**
   - Create email service boundary.
   - Configure Better Auth `emailVerification` hook.
3. **Zod Validation Schemas (Step 3):**
   - Define validation schemas for `token` and `email` with clean error messages.
4. **Auth Service Implementation (Step 4):**
   - Implement `verifyEmail` and `resendVerification` logic with proper error mappings (`400 Bad Request`, `404 Not Found`, etc.).
5. **Controller & Route Wiring (Step 5):**
   - Add controller handlers and mount routes.
6. **Contract Verification & Quality Gates (Step 6):**
   - Test registration -> token generated in verification table.
   - Test invalid/expired token rejection (HTTP 400).
   - Test valid token verification -> user `emailVerified: true` (HTTP 200).
   - Test resend verification for unverified email.
   - Run `pnpm lint` and `pnpm build`.
7. **Self-Review & Gate Closure (Step 7):**
   - Record verification evidence in Section 10.
   - Mark task `🕵️ Awaiting human review`.

---

## 7. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :---- | :------- | :---------------- | :----- |
| Acceptance criteria | `Yes` | PRD FR-AUTH-004 criteria inspection | `NOT RUN` |
| Type check / build | `Yes` | `pnpm build` | `NOT RUN` |
| Lint | `Yes` | `pnpm lint` | `NOT RUN` |
| Registration triggers email | `Yes` | Verification token created upon register | `NOT RUN` |
| Invalid token rejected | `Yes` | HTTP 400 on invalid/tampered token | `NOT RUN` |
| Valid token verifies user | `Yes` | `emailVerified` set to `true` in DB | `NOT RUN` |
| Resend verification works | `Yes` | Re-issues verification token | `NOT RUN` |

---

## 8. Assumptions & Blockers

- **Active Blockers:** `P2-B001` (Endpoint contract approval for `/verify-email` and `/resend-verification`).
- **Assumptions:**
  - In local development without live SMTP credentials, email delivery logs the verification link to the development logger/console safely (`DEC-013` / `P2-B010` allows approved dev mocks).
  - Verification tokens expire according to Better Auth defaults (or configurable duration, typically 1 hour to 24 hours).

---

## 9. Plan Review

| Field | Value |
| :---- | :---- |
| Outcome | `Pending` |
| Reviewed by | Pending |
| Reviewed on | Pending |
| Notes | Pending review and approval by Zahidul Islam |

---

## 10. Implementation Evidence

_To be completed after code execution and before marking awaiting human review._
