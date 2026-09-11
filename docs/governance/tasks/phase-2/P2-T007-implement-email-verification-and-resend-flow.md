# Task: P2-T007 - Implement Email Verification and Resend Flow

> **Canonical Status:** `✅ Done`  
> **Planning Gate:** Draft Plan → Human Approval → Blocker Clearance (`P2-B001`) → `🔄 In progress` → `🕵️ Awaiting human review` → `✅ Done`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T007`
- **PRD / Requirement Reference:** `FR-AUTH-004` (Email Verification: `FR-AUTH-004.1` through `FR-AUTH-004.5`)
- **ERD Reference:** `User`, `Verification`
- **Dependencies:** `P2-T006` (`✅ Done`)
- **Active Blockers:** `P2-B001` (Public API: Approved `POST /api/v1/auth/send-verification-otp` and `POST /api/v1/auth/verify-email-otp`)

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

1. **Email Verification Trigger on Registration (`FR-AUTH-004.1`):**
   - Configured Better Auth `emailOTP` plugin with `sendVerificationOnSignUp: true` and `overrideDefaultEmailVerification: true`.
   - When a customer registers via `POST /api/v1/auth/register`, Better Auth generates a 6-digit OTP (5 min validity) and triggers branded email dispatch.
2. **Email Verification Completion (`FR-AUTH-004.2`, `FR-AUTH-004.3`):**
   - Exposed endpoint `POST /api/v1/auth/verify-email-otp`.
   - Validated incoming payload (`email`, `otp` exactly 6 digits) via Zod schema using `validateRequest`.
   - Verified OTP against Better Auth / `Verification` store.
   - Upon successful verification, synchronized database state so `User.emailVerified` is set to `true`.
   - Rejected invalid, expired, or tampered verification codes with `400 Bad Request` and sanitized error message (`INVALID_OR_EXPIRED_OTP`).
3. **Resend Verification Flow (`FR-AUTH-004.4`):**
   - Exposed endpoint `POST /api/v1/auth/send-verification-otp`.
   - Validated payload (`email`) via Zod schema using `validateRequest`.
   - Re-issued fresh 6-digit OTP code via Better Auth `sendVerificationOTP`.
   - Guarded against abuse: checks if user is already verified and returns `400 Bad Request` (`ALREADY_VERIFIED`).
4. **Email Delivery Boundary:**
   - Established standalone universal email transport `sendEmail` under `src/app/shared/email/email.service.ts` using Nodemailer and React Email.
   - Designed branded, responsive HTML & plain-text architectural email template `VerificationEmail.tsx` matching Liminal Studio aesthetics.
   - Organized domain-specific dispatchers under `src/app/shared/email/mailers/auth.mailer.ts` (`AuthMailer.sendVerificationOtp`).

### Out of Scope

- In-memory custom token tables (Better Auth's canonical `Verification` model is used).
- Full production SMTP infrastructure setup (`P2-B010` allows approved test credentials / dev mocks).
- Session creation without credentials on email verification (unless configured with Better Auth `autoSignInAfterVerification`).

---

## 3. Verified Current Codebase State

- `src/app/shared/email/email.service.ts`: Standalone universal email dispatcher supporting React Email templates, HTML/plain-text rendering, and high-priority transactional headers.
- `src/app/shared/email/templates/VerificationEmail.tsx`: Architectural 6-digit OTP email template styled with Tailwind, Olive Green accents, and 5-minute expiration notice.
- `src/app/shared/email/mailers/auth.mailer.ts`: Dedicated `AuthMailer` handling auth-domain email dispatches.
- `src/app/config/auth.ts`: Better Auth configured with `emailAndPassword` (`requireEmailVerification: true`), `emailVerification` (`sendOnSignUp: true`), and `emailOTP` plugin.
- `src/app/modules/auth/auth.validation.ts`: Zod schemas `registerCustomerSchema`, `sendVerificationOtpSchema`, and `verifyEmailOtpSchema`.
- `src/app/modules/auth/auth.service.ts`: `registerCustomer`, `sendVerificationOtp`, and `verifyEmailOtp` with strict error handling.
- `src/app/modules/auth/auth.controller.ts`: Controller handlers using `catchAsync` and `sendResponse`.
- `src/app/modules/auth/auth.routes.ts`: Mounted `/register`, `/send-verification-otp`, and `/verify-email-otp`.

---

## 4. Implementation Approach

`Route → validateRequest(Zod) → Controller → Service → Better Auth API / Prisma Verification`

---

## 5. Affected Files & Directives

| Action | File Path | Responsibility |
| :----- | :-------- | :------------- |
| `[NEW]` | `src/app/shared/email/email.service.ts` | Universal email dispatcher via Nodemailer & React Email |
| `[NEW]` | `src/app/shared/email/templates/VerificationEmail.tsx` | Branded React Email OTP verification template |
| `[NEW]` | `src/app/shared/email/mailers/auth.mailer.ts` | Auth domain mailer invoking universal email service |
| `[MODIFY]` | `src/app/config/auth.ts` | Configure `emailOTP` plugin and integrate `AuthMailer` |
| `[MODIFY]` | `src/app/errors/errorCodes.ts` | Added `USER_NOT_FOUND`, `ALREADY_VERIFIED`, `INVALID_OR_EXPIRED_OTP` |
| `[MODIFY]` | `src/app/modules/auth/auth.validation.ts` | Schemas and inferred types for OTP endpoints |
| `[MODIFY]` | `src/app/modules/auth/auth.service.ts` | Service methods for OTP dispatch and confirmation |
| `[MODIFY]` | `src/app/modules/auth/auth.controller.ts` | Handlers for OTP dispatch and confirmation |
| `[MODIFY]` | `src/app/modules/auth/auth.routes.ts` | Mount `/send-verification-otp` and `/verify-email-otp` |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md` | Track `P2-T007` status and resolve `P2-B001` for verification |
| `[MODIFY]` | `docs/governance/tasks/phase-2/P2-T007-implement-email-verification-and-resend-flow.md` | Persistent JIT task plan & evidence |

---

## 6. Verification & Quality Gates

| Check | Required | Command or Method | Result |
| :---- | :------- | :---------------- | :----- |
| Acceptance criteria | `Yes` | PRD FR-AUTH-004 criteria inspection | `PASS` |
| Type check / build | `Yes` | `pnpm build` (`tsc`) | `PASS` (0 errors) |
| Lint | `Yes` | `pnpm lint` (`eslint ./src`) | `PASS` (0 warnings/errors) |
| Dev server runtime | `Yes` | `pnpm dev` | `PASS` (Port 5000 running) |
| OTP dispatch on signup | `Yes` | Verified Better Auth hook triggers `AuthMailer` | `PASS` |
| Invalid OTP rejection | `Yes` | Rejects with HTTP 400 (`INVALID_OR_EXPIRED_OTP`) | `PASS` |
| Valid OTP verification | `Yes` | Updates `User.emailVerified: true` | `PASS` |
| Resend verification | `Yes` | Generates fresh OTP for unverified accounts | `PASS` |

---

## 7. Assumptions & Blockers

- **Active Blockers:** `P2-B001` resolved for email verification endpoints (`POST /api/v1/auth/send-verification-otp` and `POST /api/v1/auth/verify-email-otp`).
- **Assumptions:** SMTP credentials or local dev logger handles email delivery gracefully without breaking request flows.

---

## 8. Plan Review

| Field | Value |
| :---- | :---- |
| Outcome | `Approved` |
| Reviewed by | Zahidul Islam |
| Reviewed on | 2026-09-10 |
| Notes | Adopted 6-digit OTP verification flow with React Email, centralized mailer architecture, and cookieCache |

---

## 9. Implementation Evidence

- **Universal Transport:** Created `sendEmail` in `src/app/shared/email/email.service.ts` supporting dual HTML/plain-text rendering with React Email.
- **Architectural Email Template:** Created `VerificationEmail.tsx` with responsive layout, Liminal Studio color theory (`#44542d`, `#141f0a`), monospaced 6-digit OTP box, and 5-minute validity notices.
- **Mailer Subsystem:** Created `AuthMailer` under `src/app/shared/email/mailers/auth.mailer.ts`.
- **Better Auth Integration:** Configured `emailOTP` plugin with 6-digit length, 300s expiry, `sendVerificationOnSignUp: true`, `overrideDefaultEmailVerification: true`, and 15-minute `cookieCache` for session optimization.
- **Service & Error Contract:** Added `USER_NOT_FOUND`, `ALREADY_VERIFIED`, and `INVALID_OR_EXPIRED_OTP` to `PUBLIC_ERROR_CODES`. Implemented `sendVerificationOtp` and `verifyEmailOtp` in `auth.service.ts`.
- **Zod Validation:** Added `sendVerificationOtpSchema` and `verifyEmailOtpSchema` with exact 6-digit length checking.
- **Routing:** Mounted `POST /api/v1/auth/send-verification-otp` and `POST /api/v1/auth/verify-email-otp` in `auth.routes.ts`.
- **Checks:** `pnpm lint` and `pnpm build` pass with 0 errors.
