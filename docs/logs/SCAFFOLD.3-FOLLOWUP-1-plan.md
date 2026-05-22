# SCAFFOLD.3-FOLLOWUP-1 — Plan-mode log

**Status:** Closed 2026-05-22 (plan-mode chat-closing; execute phase opens in fresh CC session)
**Branch:** `feat/scaffold-3-followup-1` (from `main` at `7362e46`; 1 commit — this close-out)
**Plan:** `docs/plans/SCAFFOLD.3-FOLLOWUP-1.md` (Amendment 1.2, 778 lines, promoted 2026-05-22)
**Predecessor:** SCAFFOLD.12 (#44, post-merge SHA `7362e46`) — the 415-as-cutover-ground-truth that surfaced FOLLOWUP-1 scope-broadening at §7.2/§7.3
**Originating findings:** SCAFFOLD.13-A finding 5 (Email-OTP-only framing); SCAFFOLD.12 `chat_close` §7.2/§7.3 (scope broadened to all 3 endpoints); MAINT.9 (tracker v9 internal restatement)
**Unblocks:** SCAFFOLD.3-FOLLOWUP-1 execute phase (code work in next CC session)

This is the PLAN-MODE log per CLAUDE.md §5.9 + the chat-closing ritual's adapted six-field structure (Task ID + scope / What was done / What was NOT done / Surprises / Decisions / References). The §14 SURPRISES section belongs to the EXECUTE log (`docs/logs/SCAFFOLD.3-FOLLOWUP-1.md`), written at execute close-out per SCAFFOLD.12/13 precedent.

## 1. Task ID + scope

SCAFFOLD.3-FOLLOWUP-1 plan-mode session. Better Auth Content-Type 415 fix + captcha coverage verification.

The 415 surface spans **three** endpoints (all POSTed by the SCAFFOLD.3 sign-in forms with `Content-Type: application/x-www-form-urlencoded`, rejected by `better-call`'s router-level JSON-only enforcement at `better-call@1.1.x+`):
- `/api/auth/sign-in/social` (Google OAuth initiation)
- `/api/auth/email-otp/send-verification-otp` (OTP send)
- `/api/auth/sign-in/email-otp` (OTP verify — corrected from `/email-otp/verify-email` per Plan-Q5-bis)

The kickoff scoped the first two endpoints explicitly. Plan-time step-1 reading surfaced the third (S1) and the wrong-endpoint correction (S5 → Plan-Q5-bis).

## 2. What was done

Three amendment cycles to the plan-mode scratch draft, all in this single CC session:

- **Amendment 1** (post web-Claude plan-review v1): 6 findings landed (3 BLOCKING + 3 NIT). All accepted. Inserted Plan-Q5-bis (endpoint correction `/email-otp/verify-email` → `/sign-in/email-otp`), success-path TDD test (BLOCKING-3 driver), §14.5.0 Zod schema execute-phase pre-check (BLOCKING-1), conditional `docs/parked.md` ADR-backfill entry (S3 + NIT-1).
- **Amendment 1.1** (post plan-review v2): 2 findings. NIT-4 ACCEPTED — Plan-Q5-bis "Optional addendum" closed to "Coupled addendum (ratified INCLUDE)"; 5th boundary-freeze test promoted from optional to firm. NIT-5 ACKNOWLEDGED but NOT applied (§14.5.0 pre-check taxonomy — future plans should consider a top-level "Execute-phase pre-checks" section instead of nesting under §14 SURPRISES).
- **Amendment 1.2** (post web-Claude plan-review v3 + security-auditor v3 pass): 7 findings landed (2 MEDIUM blocking + 2 LOW fold-in + 2 SURPRISE deferred + 1 INFO deferred). All adjudicated; see field 4 below.

Plan promoted to `docs/plans/SCAFFOLD.3-FOLLOWUP-1.md` (778 lines) at chat-closing wind-down per web-Claude Option A (promote-now, not defer). Scratch artifacts stripped: scratch-draft framing, "Do not promote" warnings, "Plan-mode handoff" section. Three amendment change-logs preserved as lineage record (Amendments 1, 1.1, 1.2).

This plan-mode log written.

## 3. What was NOT done

- **Execute phase.** Opens in a fresh CC session per CLAUDE.md §5 plan/execute split. First action: `test-writer` reviewer-call writing the success-path TDD tests FAILING-first against `main` (`200-or-400-not-415::email-otp-send-accepts-json-with-header-token` + `wire-shape::sdk-emits-x-turnstile-token-header`).
- **Code changes.** Zero in plan-mode. Touch surface per plan §2: 2 NEW files (`src/lib/auth-client.ts`, `tests/server/auth/_probe-content-type-415.test.ts`), 4 MODIFIED files (`src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-in/otp/page.tsx`, `src/server/auth/index.ts`, `tests/server/auth/otp.test.ts`), 1 conditional doc edit (`docs/parked.md` ADR-backfill entry per S3 confirmation) + 2 unconditional doc edits (`docs/parked.md` X-Forwarded-For + first-request CSRF entries per Amendment 1.2 SURPRISES).
- **ADR backfill.** S3 surfaced ADR-0004 absent from disk (only `0001-license-choice.md` present in `docs/adr/`). Execute-phase action: `find . -name "0004-better-auth*" -not -path "./node_modules/*"`; if confirmed absent, ship parked.md ADR-backfill entry per Amendment 1 NIT-1. The full ADR-0004 (through 0016) backfill is OUT of scope for this PR (scope creep — FOLLOWUP-1 is a code fix, not a documentation-recovery task).
- **FOLLOWUP-2 session-endpoint bundling.** SCAFFOLD.13-B SURPRISE 7 surfaced a separate `/api/auth/get-session` 404 → FOLLOWUP-2 task. Explicitly NOT bundled into FOLLOWUP-1 per kickoff §Out-of-scope (decision carried forward from 13-B close-out).
- **Real Turnstile widget rendering.** Plan-Q7 verdict DEFER. Placeholder `<input value="placeholder-token">` retained as anchor; widget mount deferred to DESIGN.* or a separate task. §7.3 acceptance test exits at "400 turnstile_failed" not "200 success."
- **Spec amendments.** Plan-Q4 DROPPED at plan-review v1 (SPEC.2 §8.2 + §18.2 wording already matches the hand-rolled `hooks.before` implementation per S6 — the web-Claude-side hypothesis that the official `captcha` plugin's `onRequest` framing was needed was contingent on Finding (i)/(ii), which step-1 reading ruled out via Finding (iii)).
- **MEDIUM-2 operator-side TURNSTILE_SECRET_KEY probe.** Plan-mode could not verify whether prod secret is real-vs-test-key (Vercel env values write-only post-set per `feedback_vercel_env_writeonly.md` memory). Probe added as GATING exit criterion #10 to be run by operator at execute-phase.

## 4. Surprises (9 entries — 6 plan-time + 3 audit-time)

Per `feedback_audit_surprises.md` memory: close-out logs carry the full chain, not a buried footnote.

**Plan-time (step-1 reading; recorded at plan §0.2):**

1. **S1** — `sign-in/otp/page.tsx` form posts to `/api/auth/email-otp/verify-email` with the same 415 bug. Kickoff only named `/sign-in/social` + `/email-otp/send-verification-otp`. Drove Plan-Q5 (include OTP verify form in this PR). Half-broken flow would have shipped if Q5 = NO (user receives OTP email → submits at `/sign-in/otp` → 415 → flow halts).
2. **S2** — `src/lib/auth-client.ts` does NOT exist; kickoff step-1 said "confirm it exists." NEW file required.
3. **S3** — `docs/adr/0004-better-auth.md` does NOT exist on disk (only `0001-license-choice.md`). SPEC.2 + CLAUDE.md reference ADR-0004 §1, §4, §18.2 + ADR-0010, ADR-0014, ADR-0015, ADR-0016 extensively. Conditional parked.md entry per Amendment 1 NIT-1 (re-verify with `find` at execute-time).
4. **S4** — Hand-rolled `zugzwangOtpGate` plugin reads `turnstileToken` from `ctx.body`, not from `x-captcha-response` header (Cloudflare convention). Drove Plan-Q6 (HEADER transport via `x-turnstile-token`).
5. **S5** — `sign-in/otp/page.tsx` form posts to `/email-otp/verify-email` (email-verification side-effect endpoint) instead of `/sign-in/email-otp` (session-issuing endpoint). SCAFFOLD.3 implementation bug. Reframed at plan-review v1 BLOCKING-2 as load-bearing Plan-Q5-bis verdict, not "side benefit" of Q5.
6. **S6** — SPEC.2 §8.2 line 816 wording (`hooks.before` middleware) already matches the hand-rolled implementation. Web-Claude's pre-loaded spec-correction hypothesis (that the official captcha plugin's `onRequest` framing was needed) was contingent on Finding (i)/(ii). With Finding (iii) confirmed by step-1 reading, S6 dropped Plan-Q4 verdict.

**Audit-time (security-auditor v3 pass; absorbed in Amendment 1.2):**

7. **AS1 / LOW-3** — IP-extraction at `src/server/auth/index.ts:104-110` (`ipFromCtx`) takes `X-Forwarded-For.split(",")[0]` (LEFTMOST), which is attacker-controlled when chained. Defeats per-IP rate-limit `otpRequestPerIpBurst` + pollutes Cloudflare siteverify `remoteip` field. Pre-existing surface, not touched by Q6 change. DEFERRED — unconditional `docs/parked.md` entry per Amendment 1.2 §4 (HARDEN.* pre-launch trigger).
8. **AS2 / INFO-2** — Better Auth's `originCheckMiddleware` only validates origin when cookies are present. First-time cookie-less POSTs to `/sign-in/social` + `/sign-in/email-otp` + `/email-otp/send-verification-otp` reachable cross-origin without Sec-Fetch CSRF protection. Pre-existing Better Auth design choice. Threat-model fit low (Google requires consent UI; email-OTP rate-limited per-IP/per-email). DEFERRED — unconditional `docs/parked.md` entry.
9. **AS3 / INFO-1** — Comment at `src/server/auth/index.ts:34-37` could be tightened to reflect the shallow-spread mechanism at `createAuthContext` (the post-hoc `auth.options.hooks.before` mutation writes to the original options object, not the context's shallow-spread copy at `node_modules/better-auth/dist/context/create-context.mjs:84-131`). Future Better Auth upgrade switching from shallow-spread to direct-reference would silently make the mutation runtime-visible → per-request `TypeError`. DEFERRED — §14.6.0 executor-discretion note (absorb if file is being modified anyway for the Q6 hook change).

## 5. Decisions

Eight verdicts (Q1–Q5-bis + Q6 + Q7), all resolved at plan-review v2 or earlier; Amendment 1.2 added no new questions, only fold-ins and deferrals.

| Q | Verdict | Notes |
|---|---|---|
| Q1 | (iii) hand-rolled `hooks.before` plugin | Spec already matches code; no captcha config change. |
| Q2 | EXCLUDE `/sign-in/social` from captcha matcher | OVERRIDES web-Claude pre-rec ("include both"); SPEC.1 §13 F-AUTH-1 line 616 explicit. |
| Q3 | Single file `_probe-content-type-415.test.ts` | Matches `_probe-*` MAINT.7 precedent. |
| Q4 | DROP spec correction | SPEC.2 §8.2 already accurate for hand-rolled (S6). |
| Q5 | YES include `sign-in/otp/page.tsx` 415 fix | Without it, §7.3 acceptance is blocked downstream. |
| Q5-bis | YES endpoint correction (`/email-otp/verify-email` → `/sign-in/email-otp`) + ratified 5th boundary-freeze test | Plan-review v1 BLOCKING-2 + v2 NIT-4 sequence. |
| Q6 | HEADER (`x-turnstile-token`) | Cleaner intent; typed SDK call needs it. §14.5.0 Zod schema pre-check informs but does not change verdict. |
| Q7 | DEFER widget rendering; KEEP placeholder hidden input | §7.3 exits at "400 turnstile_failed"; real widget at DESIGN.* or separate task. |

**Standout learning — MEDIUM-1** (security-auditor v3, absorbed in Amendment 1.2). The original Plan-Q6 + §2 SDK call snippet had `{ fetchOptions: { headers: ... } }` as the second positional arg — WRONG. Per Better Auth v1.6.x SDK contract (`node_modules/better-auth/dist/client/path-to-object.d.mts:42-54`), the second arg IS `FetchOptions` directly. An executor copying the plan snippet verbatim would have shipped a non-functional sign-in flow that PASSES the route-handler success-path test (which sends a hand-built `Request` bypassing the SDK entirely). Fixed two ways: (a) snippet corrected to Form A across §1 + §2; (b) new 6th test added (`wire-shape::sdk-emits-x-turnstile-token-header`) that imports the actual `authClient`, spies on `globalThis.fetch`, and asserts the emitted request carries the `x-turnstile-token` header — FAILS if the SDK call shape regresses. The `test-writer` reviewer-call in execute-phase writes this test failing-first.

**Standout learning — MEDIUM-2** (security-auditor v3, absorbed in Amendment 1.2). TURNSTILE_SECRET_KEY operator-side functional probe added as GATING exit criterion #10. If prod secret is ever a Cloudflare-published test key (`1x...AA`, `2x...AA`, `3x...AA`), the placeholder-token in the hidden input would silently pass siteverify, defeating SPEC.2 §18.2 fail-closed posture. NOT auditable from read-only scope (Vercel env values are write-only post-set per `feedback_vercel_env_writeonly.md` memory); operator must hand-craft a fake-token POST and confirm 400 `turnstile_failed`. Blocks merge if not verified.

**Reviewer-call invocation summary** (CLAUDE.md §5.11):
- **`security-auditor`** at plan-review v3 gate (Amendment 1.1 → 1.2 transition): **PASS verdict** with 7 findings (2 MEDIUM + 2 LOW + 2 SURPRISE + 1 INFO). Invoked via `subagent_type: "security-auditor"` directly (matches SCAFFOLD.12 close-out precedent; the "general-purpose with role briefing baked in" pattern CLAUDE.md §5.11 documents is fallback for environments without auto-discoverable subagent types — present environment has the subagent type registered).
- **`code-reviewer`** — NOT invoked in plan-mode (no code changes). Fires at execute close-out per CLAUDE.md §5.11.
- **`db-migration-reviewer`** — NOT invoked (no schema or migration changes).
- **`test-writer`** — NOT invoked in plan-mode (per CLAUDE.md §5.6 + §5.11 the `test-writer` call fires at Phase 2 start of execute, writing the success-path TDD test FAILING-first).

## 6. References

**Plan + log paths:**
- `docs/plans/SCAFFOLD.3-FOLLOWUP-1.md` — promoted plan (Amendment 1.2, 778 lines; scratch artifacts stripped at promotion)
- `docs/logs/SCAFFOLD.3-FOLLOWUP-1-plan.md` — this log
- `docs/logs/SCAFFOLD.3-FOLLOWUP-1.md` — execute-phase log (NOT YET written; gets written at execute close-out, will carry the §14 SURPRISES section)

**Branch:** `feat/scaffold-3-followup-1` off `main` at `7362e46` (SCAFFOLD.12 squash-merge).

**Predecessor close-outs (web-Claude side, not in repo):**
- `chat_close_2026-05-21_SCAFFOLD_12_full.md` — §7.2/§7.3 broadening that surfaced FOLLOWUP-1 across all POST endpoints (not just Email-OTP).
- `chat_close_2026-05-17_SCAFFOLD_13_A.md` — original Email-OTP-only framing of finding 5.
- `chat_close_2026-05-20_SCAFFOLD_13_B_execute_full.md` — SURPRISE 7 (session endpoint 404 → FOLLOWUP-2 split decision; explicitly NOT bundled into FOLLOWUP-1).

**Predecessor close-outs (in repo):**
- `docs/logs/SCAFFOLD.12.md` — production-side cutover log; 415-as-cutover-ground-truth methodology origin (identical to 13-A `DATABASE_URL` 415 ground-truth verification).

**External tracker:**
- `zugzwang_experiment_tracker_v9.html` (operator-maintained, external per `project_tracker_external.md` memory) — MAINT.9 is the canonical internal restatement of this fix's shape ("lock to application/json to match the API contract"). Carry-forward of the SCAFFOLD.3 security-auditor LOW-2 finding from step 26.

**security-auditor report:** in-context only; NOT separately persisted in `docs/logs/SCAFFOLD.3-FOLLOWUP-1-security-auditor.md` (unlike SCAFFOLD.12 which DID get a separately-persisted security-auditor log). Reason: the audit findings were fully absorbed into Amendment 1.2 (2 MEDIUM into plan §1 + §2 + §3 + §5 + §6; 2 LOW into §2 + §5 + §6; 2 SURPRISE into parked.md; 1 INFO into §14.6.0 note) — no orphan findings to persist outside the plan. If future strata want the verbatim auditor report, it's recoverable from this CC session's transcript before `/clear`.

**Conditional follow-ups (per S3 + Amendment 1.2 SURPRISES):**
- `docs/parked.md` — gets 2 unconditional entries at execute-time (X-Forwarded-For trust chain + first-request CSRF gap, both from Amendment 1.2 SURPRISES) + 1 conditional entry (ADR-0004 through 0016 backfill, if `find` confirms ADR-0004 absent per S3).

**Next session starts at:** fresh CC session opens with `/clear`; first action is the `test-writer` reviewer-call writing the success-path TDD tests (`200-or-400-not-415::email-otp-send-accepts-json-with-header-token` + `wire-shape::sdk-emits-x-turnstile-token-header`) FAILING-first against `main`. Plan path for the reviewer-call: `@docs/plans/SCAFFOLD.3-FOLLOWUP-1.md`. Tool scope: Read + Write tests only, no `src/` edits (per CLAUDE.md §5.11).
