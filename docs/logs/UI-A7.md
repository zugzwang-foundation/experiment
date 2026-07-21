# UI-A7 — Auth skin — session log

**Stratum:** UI-A7 (auth skin, Option A — pages hosting the W2.1 card). **State:** built + tests-first + reviewer cascade + full gate GREEN; **PR open, run HALTED at the merge gate** (two human gates pending — no overnight merge). **Class:** CLAUDE.md §1 critical path (auth) — gated plan→execute + named-reviewer cascade (NOT ultracode).

## 1. What landed (files + PR#)
- **PR #256** — https://github.com/zugzwang-foundation/experiment/pull/256 — branch `feat/ui-a7` (feature commit `e795422` + this log commit). **NOT merged.** Canonical reference SHA = the squash-merge SHA on `main` (post-merge; unknown until the morning merge, per §5.9).
- **Skinned (presentation JSX only):** `src/app/(auth)/layout.tsx`, `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-in/otp/page.tsx`, `src/app/(auth)/onboarding/page.tsx`.
- **Tests (new, tests-first §9):** `tests/unit/auth/sign-in-render.test.tsx`, `tests/unit/auth/otp-render.test.tsx`, `tests/server/auth/onboarding-page-wiring.test.ts`.

## 2. Decisions made
- **Option A** skin (full pages hosting the W2.1 card content; no modal backdrop/×/Esc/dismiss chrome) — plan rulings 1–3.
- **V0 seam:** `mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8` (horizontal-center + max-width + vertical padding, **no** `justify-center`); per-surface vertical placement via `my-auto` on the short surfaces (sign-in, otp) / omitted on onboarding (top-aligns + scrolls). `getSession`/`viewer`/`GlobalHeader` verbatim.
- **Error states → uniform `role="alert"` monochrome callout;** the handler's message flows through unchanged. **No code→copy branching** (§5 "add no new logic") — per-code W2.11 titled blocks ("No identities available", "Something went wrong") were deliberately NOT built, as branching on the error code is new logic. See Open Q for Gate C.
- **onboarding kept a pure RSC** (plan §2 V3, "no new client boundary"): Continue/Cancel styled with manual branded button tokens rather than importing `ui/button` (which pulls radix `Slot`); kept `<Image>` (not `Avatar`, which is `"use client"`). A literal `<footer>` + `<a href="/">` retained (seam + test).
- **Deliberate omissions (both reviewers agreed correct):** sign-in Terms/Privacy footer (`/terms` `/privacy` routes don't exist → would be dead links; full bodies are disclosed in-flow on `/onboarding`); otp "Secured by Cloudflare Turnstile" line (Turnstile not wired — §8; the hidden `turnstileToken` anchor is retained).
- **"A7 law" comment patched same-commit** (ruling 3) — the true invariant is ZERO auth-logic edits, not zero file edits.
- **@db-migration-reviewer WAIVED** — A7 touches no schema/migration (recorded here + in the PR body).

## 3. Open questions
- **[Gate C] Error-state treatment interpretation** — uniform callout (built) vs per-code W2.11 titled blocks. The uniform callout is the presentation-only reading (per-code blocks require branching = logic, forbidden by §5). Confirm acceptable, or spin a separate logic-touching task.
- **[Operator visual] Placeholder-only input labeling** — email/otp inputs use `placeholder` + `aria-label` (no visible `<label>`), matching the W2.1 mockup. Accessible name preserved; eyeball at the visual check. (Onboarding's acceptance checkbox keeps its visible `<label>`.)
- **[Banked · §5.4 · OUT OF A7 SCOPE] `src/server/auth/tos-accept.ts:70`** — `getIp()` records the **leftmost `x-forwarded-for`** (client-spoofable) as `tos_acceptance_ip` (ToS-acceptance audit evidence). **PRE-EXISTING, LOW, NOT in the A7 diff** — surfaced incidentally by @security-auditor, who said "track separately, do not fix in this PR." Handled per §5.4 (log + raise + continue), not the §5.11 deliverable-SURPRISE→HALT path (nothing about A7 is invalidated; both reviewers PASSED the skin clean). **Operator: confirm this bank-and-continue call, or redirect. Recommend a separate hardening task (rightmost trusted-boundary IP / Vercel's dedicated header).**

## 4. Next session starts at (exact next action)
morning: **web-Claude Gate C diff-read of PR #256** + **operator visual-fidelity check** of all three surfaces vs the W2.1 card on the **Vercel preview deploy** → if BOTH pass, **squash-merge** → confirm green on `staging`. Do **not** merge before both gates. No automated test asserts appearance — the visual match is the acceptance criterion (§1.B / §7).

## 5. Context to preserve
- **Gate-intact proof:** full `pnpm vitest run` = **259 files / 1806 passed** (256/1790 pre-change baseline + 3 new files / 16 new tests), 0 failed, 2 skipped, 4 todo. **No existing spine test edited** (only additive files); the §4 gate chain (`session-gate.ts`, `api/auth/[...all]/route.ts`, `tos-accept.ts`, `onboarding-ref.ts`) is **byte-identical to HEAD**. `ZUGZWANG_ENV=preview just verify` GREEN. Design guards (`no-raw-hex-view-layer`, `tokens-monochrome`) green; zero raw hex.
- **Reviewer cascade:** @code-reviewer PASS (0 CRITICAL/HIGH/MEDIUM; all §3 seam bindings attested intact) → @security-auditor PASS (§4 "no session before `tos_accepted_at`" HOLDS by construction — issuance is 100% server-side) → @db-migration-reviewer WAIVED.
- **Phase-0 baseline gotcha (not a regression):** a *subset* `vitest run` invocation shows a false `pseudonym-assigned-event.test.ts` cross-file pollution failure (that test has an `afterEach` but no `beforeEach` truncate). Green in isolation; the FULL suite (what CI gates) is green. Always gate on the full suite, not a lumped subset.
- **Closing ritual:** no CLAUDE.md / AGENTS.md / tracker change from this session (presentation slot; the AGENTS.md `0023`/`0031`/`1.0.17` sync lag is explicitly NOT A7's job — plan §8).

## 6. Time
2026-07-21 — overnight autonomous execute run (Phase 0 preflight → Phase 5 PR + HALT). Single session, no `/clear`.
