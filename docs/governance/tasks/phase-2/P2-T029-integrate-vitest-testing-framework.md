# Task: P2-T029 — Integrate Vitest Testing Framework

> **Canonical Status:** `✅ Done` (tracked authoritatively in parent phase file)  
> **Planning Gate:** Draft Plan → Human Approval → `🔄 In Progress` → `🕵️ Awaiting Human Review` → `✅ Done`

---

## 1. Context & Traceability

- **Parent Phase:** `docs/governance/phases/phase-2-auth-rbac.md`
- **Task ID:** `P2-T029`
- **PRD / Requirement Reference:** `N/A` (tooling prerequisite; governance decision `DEC-025`)
- **ERD Reference:** `N/A`
- **Dependencies:** None

---

## 2. Approved Scope & Acceptance Criteria

### In Scope

- Install `vitest@^3`, `@vitest/coverage-v8@^3`, `supertest` and `@types/supertest`.
- Create `vitest.config.ts` with `environment: node`, `globals: false`, V8 coverage, `tests/setup.ts` setupFiles.
- Create `tsconfig.test.json` extending `tsconfig.json` with `rootDir: "."`, `noEmit: true` and `tests/**/*.ts` included.
- Create `tests/unit/`, `tests/integration/` and `tests/helpers/` directories.
- Create `tests/setup.ts` mocking the shared Pino logger.
- Create `tests/unit/sendResponse.test.ts` smoke test (6 passing tests).
- Update `package.json`: replace placeholder `test` script with `vitest run`; add `test:watch` and `test:coverage`.
- Update `eslint.config.mjs`: add separate block for `tests/**/*.ts` with relaxed rules.
- Update `06-PHASE-ROADMAP.md`, `phase-2-auth-rbac.md`, `03-CODING-STANDARDS.md`, `MEMORY.md`.
- Record `DEC-025` in `DECISIONS.md`.

### Out of Scope

- Feature-level tests for existing auth/customer modules (future tasks).
- CI/CD pipeline integration.
- Coverage thresholds enforcement.

### Acceptance Criteria Mapping

| Acceptance Criterion                              | Planned Step | Verification                          |
| :------------------------------------------------ | :----------- | :------------------------------------ |
| Packages installed, peer deps clean               | Step 1       | `pnpm peers check` → no issues        |
| `vitest.config.ts` created                        | Step 2       | File inspection, `pnpm test` pass     |
| `tsconfig.test.json` created, build unaffected    | Step 3       | `pnpm build` → exit code 0            |
| `tests/` directory structure correct              | Step 4       | Directory inspection                  |
| `tests/setup.ts` mocks logger                     | Step 5       | Tests run without Pino output         |
| `sendResponse` smoke test: 6 passing tests        | Step 6       | `pnpm test` → 6 passed               |
| `package.json` scripts updated                    | Step 7       | `pnpm test` runs vitest               |
| `eslint.config.mjs` updated                       | Step 8       | `pnpm lint` → exit code 0            |
| Governance documents updated                      | Step 9       | File inspection                       |

---

## 3. Verified Current Codebase State

- No test framework existed. `pnpm test` executed a placeholder `echo "Error: no test specified" && exit 1`.
- `DEC-013` previously deferred Jest and testing to project completion.
- Project uses `"type": "module"`, `"module": "NodeNext"`, `"verbatimModuleSyntax": true` — requires native ESM test runner.
- Existing config files: `tsconfig.json` (rootDir=./src), `eslint.config.mjs`, `package.json`.

---

## 4. Implementation Approach

- Vitest 3 used (not 5) to satisfy `better-auth@1.7.3` peer range `^2.0.0 || ^3.0.0 || ^4.0.0`.
- Separate `tsconfig.test.json` with `rootDir: "."` and `noEmit: true` avoids the `TS6059 rootDir` error when the main tsconfig has `rootDir: "./src"`.
- `globals: false` enforces explicit Vitest API imports matching project conventions.

---

## 5. Affected Files & Directives

| Action     | File Path                                               | Responsibility                                   |
| :--------- | :------------------------------------------------------ | :----------------------------------------------- |
| `[NEW]`    | `vitest.config.ts`                                      | Vitest configuration                             |
| `[NEW]`    | `tsconfig.test.json`                                    | TypeScript config for test files                 |
| `[NEW]`    | `tests/setup.ts`                                        | Global test setup (logger mock)                  |
| `[NEW]`    | `tests/unit/sendResponse.test.ts`                       | Smoke test for sendResponse utility              |
| `[NEW]`    | `tests/unit/.gitkeep`                                   | Keep empty unit dir in git                       |
| `[NEW]`    | `tests/integration/.gitkeep`                            | Keep empty integration dir in git                |
| `[MODIFY]` | `package.json`                                          | Replace test script, add test:watch/coverage     |
| `[MODIFY]` | `eslint.config.mjs`                                     | Add test file rule overrides                     |
| `[MODIFY]` | `docs/governance/DECISIONS.md`                          | Record DEC-025                                   |
| `[MODIFY]` | `docs/governance/MEMORY.md`                             | Update current state snapshot                    |
| `[MODIFY]` | `docs/governance/06-PHASE-ROADMAP.md`                   | Update Phase 2 current state                     |
| `[MODIFY]` | `docs/governance/phases/phase-2-auth-rbac.md`           | Add P2-T029 task definition and index entry      |
| `[MODIFY]` | `docs/governance/03-CODING-STANDARDS.md`                | Rewrite Section 18 (Testing) for Vitest          |

---

## 7. Verification & Quality Gates

| Check                 | Required | Command / Method           | Result    |
| :-------------------- | :------- | :------------------------- | :-------- |
| Tests pass            | `Yes`    | `pnpm test`                | `PASS` — 7/7 tests (6 unit, 1 integration) |
| Test typecheck passes | `Yes`    | `pnpm tsc --project tsconfig.test.json --noEmit` | `PASS` |
| Build passes          | `Yes`    | `pnpm build`               | `PASS`    |
| Lint passes           | `Yes`    | `pnpm lint`                | `PASS`    |
| Peer deps clean       | `Yes`    | `pnpm peers check`         | `PASS` — no issues |
| Governance updated    | `Yes`    | File inspection            | `PASS`    |

---

## 9. Plan Review

| Field       | Value         |
| :---------- | :------------ |
| Outcome     | `Approved`    |
| Reviewed by | Human (team)  |
| Reviewed on | 2026-09-19    |
| Notes       | DEC-025 approved: Vitest adopted immediately; Jest dropped. globals: false, separate tests/ directory, V8 coverage. |

---

## 10. Implementation Evidence

- **Packages installed:** `vitest@3.2.7`, `@vitest/coverage-v8@3.2.7`, `supertest@7.2.2`, `@types/supertest@7.2.1`. Used Vitest 3 (not 5) to satisfy `better-auth` peer constraints.
- **`vitest.config.ts`:** `environment: node`, `globals: false`, `clearMocks: true`, `setupFiles: ["tests/setup.ts"]`, V8 coverage, `tsconfig.test.json` for typecheck.
- **`tsconfig.test.json`:** extends main tsconfig, `rootDir: "."`, `noEmit: true`, includes `tests/**/*.ts`. Explicitly omits `vitest/globals` to enforce clean scoped types and explicit imports.
- **`tests/setup.ts`:** configures authentic silent Pino instance (`pino({ level: 'silent' })`), silencing output without breaking `pino-http` internal object contracts.
- **Directory Structure:** `tests/unit/` strictly mirrors `src/app/` (`errors/`, `middleware/`, `utils/`, `modules/`) with exact 1:1 basename alignment (`<filename>.test.ts`).
- **`src/app/config/env.ts` & `src/app.ts`:** expanded `NODE_ENV` enum to include `"test"` (`z.enum(["development", "production", "test"])`), ensuring seamless runtime initialization during Vitest execution.
- **`tests/unit/utils/sendResponse.test.ts`:** 6 tests covering status code, success flag, message, data, meta presence/absence.
- **`tests/integration/health.test.ts`:** integration smoke test verifying `GET /` responds with status 200 and standard response structure via `supertest` and `getApp()`.
- **`package.json`:** `test` → `vitest run`; added `test:watch` and `test:coverage`; lint now includes `./tests`.
- **`eslint.config.mjs`:** converted from object to array config; added test-file block disabling `no-explicit-any` and `no-console`.
- **`pnpm test` output:** `PASS` across mirrored test suites.
- **`pnpm build` output:** exit 0, Prisma Client generated, TypeScript compiled cleanly.
- **`pnpm lint` output:** exit 0, no violations.
- **`pnpm peers check` output:** `No peer dependency issues found`.
- **Deviations:** Vitest 3 chosen over 5 due to `better-auth@1.7.3` peer range.
