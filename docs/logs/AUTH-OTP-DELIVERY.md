# AUTH-OTP-DELIVERY — session log (execute)

**Stratum:** auth critical-path · **State:** built + reviewed, local gates green; PR #257 open, **halted at merge gate** (Gate C web diff-read pending; NO auto-merge).

## What landed (files + PR#)
PR **#257** — `fix/auth-otp-delivery` → `main` (base `e887c02`). Impl+ADR commit `453b849` (signed); plan commits `edd971d` (plan) + `8bea537` (ratified-rulings lock).

- **NEW** `src/server/auth/resend-from.ts` — pure `isSandboxFrom` (bare + `Name <email>`, case-insensitive, `false` on no-`@`/malformed, no lookalike misfire).
- `instrumentation.ts` — S2 boot gate (`unset || sandbox`, `ZUGZWANG_ENV ∈ {prod,staging}`).
- `src/server/auth/email-otp.ts` — S2 send-time backstop + OQ-2 `Sentry.captureException` (network + API-error paths).
- `src/app/(auth)/sign-in/otp/page.tsx` — fix (b) Resend + Back affordance (shared `role="alert"`, success `role="status"`, placeholder Turnstile token).
- `tests/_setup/env.ts` — non-sandbox default (companion to the guard).
- **NEW** `tests/unit/auth/resend-from.test.ts`; extended `email-otp-from-guard`, `instrumentation-register`, `otp-render`.
- **NEW** `docs/adr/0033-otp-delivery-boot-guard-and-optimistic-request-semantics.md` (web-authored, same-commit).

## Decisions made (all ratified pre-execute; §0·R of the plan)
- Fix (b) = UX affordance; inline surfacing **infeasible** (Better Auth 1.6.11 `runInBackgroundOrAwait` structurally swallows the sender throw → HTTP 200). Do NOT await/rethrow to reclaim a client error.
- OQ-1 = **S2**: enforce prod+staging; `preview` (local dev + CI) exempt; keyed on existing `ZUGZWANG_ENV` (no new env var). Retires the A35 "staging EXEMPT" accommodation.
- OQ-2 = Sentry capture in the sender. OQ-4 = robust case-insensitive predicate (`=== "resend.dev" || endsWith(".resend.dev")`).
- ADR-0033 = same-commit, web-authored (not drafted here).
- OQ-5 = correct-forward; only the "staging EXEMPT" comments on the edited lines were touched. `docs/parked.md` + `docs/runbooks/staging-provisioning.md` left for the operator's close-out doc pass.

## Surprises caught + fixed in-session
- **`@code-reviewer` LOW:** Verify (`handleSubmit`) didn't clear `resent` → a successful resend's `role="status"` could co-display with a later verify `role="alert"`. Fixed (`setResent(false)` in `handleSubmit`); otp-render re-green.
- **`@test-writer` "concurrent worktree actor" SURPRISE:** benign — the "other actor" was this main session implementing during the subagent's background run (planned test→impl handoff). Disjoint file sets (`tests/` vs `src/`), no index/HEAD touch during its run, RED evidence valid (captured vs pre-impl). No corruption. Lesson: for tests-first purity, serialize the subagent fully before implementing.

## Open questions
- None blocking. **Flagged out-of-scope follow-up:** Sentry inits lack a `beforeSend` scrubber — no leak today (`sendDefaultPii:false` + bounded Resend error shape, both verified by `@security-auditor`), but this PR is the first to route Resend errors into Sentry. Candidate for AUTH-HARDEN / a dedicated task.

## Next session starts at (exact next action)
Watch PR #257: after **Gate C** web diff-read + operator merge, capture the **squash-merge SHA on `main`** as canonical. If Gate C requests changes, resume on `fix/auth-otp-delivery`. Sibling A7-ledger tasks still open: AUTH-FIRST-LOGIN, AUTH-ERROR-COPY, AUTH-HARDEN (XFF + Sentry scrubber), AUTH-TURNSTILE-WIRE.

## Context to preserve
- Gate chain byte-identical to HEAD (`session-gate.ts`, `api/auth/[...all]/route.ts`, `tos-accept.ts`, `onboarding-ref.ts`, `sign-in/page.tsx`). No DDL — head `0024`, `EVENT_TYPES` 24 → `@db-migration-reviewer` waived.
- Local gates green: full `pnpm vitest run` 1836 passed; `just verify` (typecheck + biome + next build) exit 0. CI (`ci` required check) running at halt.
- The resend↔sign-in Turnstile-token parity is load-bearing (ADR-0033 constraint) — AUTH-TURNSTILE-WIRE must keep both paths on the same token.

## Time
2026-07-22 — execute session (plan ratified same day; plan authored 2026-07-21).
