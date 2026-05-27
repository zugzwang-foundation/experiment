# Chat close — SCAFFOLD.8 plan-mode review

**Date:** 2026-05-27
**Chat type:** Plan-mode review (web Claude + Claude Code pair)
**Task:** SCAFFOLD.8 (Bundle 3a of SCAFFOLD-finish mini-plan) — staging environment setup
**Predecessor:** SCAFFOLD.8 brief-drafting chat (2026-05-27)
**Successor:** SCAFFOLD.8 execute chat (web Claude + CC pair, next session)
**Exit criterion met:** `docs/plans/SCAFFOLD.8-staging-plan.md` drafted in /plan mode, reviewed by web Claude across 8 surface items, ratified by operator, ready for ExitPlanMode + commit.

---

## Substance items

### 1. Plan drafted and ratified

CC drafted plan in /plan mode against the SCAFFOLD.8 brief (ratified 2026-05-27 in predecessor chat). Initial plan output: 1075 lines / 68KB. After 8 rounds of web Claude review + iteration, final plan: **1447 lines / 103KB.** Plan resolved 15 OQs total (12 brief + 3 surfaced at plan time), 8 risks, 9 plan-time SURPRISEs, with 12 self-critique items.

Final structure:
- §0 brief acknowledgment (8 sections)
- §1 OQ verdicts + 9 SURPRISEs + 3 new OQs (OQ-13 ratified Option A 2 buckets; OQ-14 ratified Yes add at O3b; OQ-15 ratified Accept default cron-on-staging)
- §2 11 LDs consumed
- §3 step plan (11 O + 15 C + 3 J = 29 steps) + §3.A authoritative env-var inventory (35 Doppler-managed vars) + §3.B migration audit (8 migrations)
- §4 9 authoritative code shapes
- §5 8 risks acknowledged
- §6 reviewer cascade plan (security-auditor on C3+C4 + C9 + _smoke-error)
- §7 12 ECs verification
- §8 pre-staged LD-2 2-scope fallback
- §9 SCAFFOLD.18 log landing as standalone chore PR (operator chose at kickoff)
- §10 12 self-critique items
- §11 11 net-new files + 13 edited
- §12 references
- §13 execute hand-off

### 2. Web Claude review — 8 surface items closed

All items resolved with substantive plan changes:

| # | Item | Outcome |
|---|---|---|
| 1 | OQ-13 R2 dual-bucket scope (operator-deferred to web Claude) | Ratified Option A: 2 staging buckets + 2 bucket-scoped tokens. R2_ENDPOINT_* clarified as shared-with-prod (R2 endpoints are account-scoped, not bucket-scoped). |
| 2 | §4.2 Ratelimit lazy-init refactor — significant brief deviation | Reverted to drop-in `prefix: getRedisKey(...)` helper after Next.js 16 docs verified `register()` awaited before first request. Consumer scan: 0 src/ consumers. No lazy-init refactor needed. |
| 3 | §3 C0 separation + env-var inventory deferred | C0 kept separate (different gate-quality: O4 depends on C0's authoritative inventory output, not C4's refactor). Full §3.A inventory table lifted into plan body (35 Doppler-managed vars: 19 per-env + 13 shared + 2 staging-only + post-fix new SENTRY_API_TOKEN). SURPRISE-10 surfaced mid-grep: `src/server/storage/r2.ts:54,69` had hardcoded bucket names → new C4b step added (refactor to read `R2_BUCKET_UPLOADS`/`R2_BUCKET_PFP` from env). |
| 4 | J1 missing migration audit (per SCAFFOLD.18 carry-forward #4) | §3.B added with 8-migration audit: concern classification (schema-only / seed-only / MIXED) + critical-path table mapping + stratum provenance. 2 MIXED migrations (0006, 0007) both INTENTIONAL bundling, accepted. 0007 pg_cron permission risk flagged as HIGH likelihood-low; recovery path documented. pg_cron version note added (Supabase ≥1.6.2 since March 2024; cron.schedule effectively idempotent on freshly-provisioned staging). J1 step body extended with 8 spot-check queries; time ~5 → ~10 min. |
| 5 | Vitest skip semantics undefined | §4.5 preamble documents repo testing convention (Layer 1 setupFiles env-defaults at `tests/_setup/env.ts`, Layer 2 vi.mock at module boundary per 5 existing test files, ctx.skip() for runtime probes per SCAFFOLD.18 process learning #3). Test 2 mock setup expanded with `vi.mock("@/server/upstash/redis")` + `vi.mock("@sentry/nextjs")` blocks (real issue confirmed: redis.fromEnv at module-load + Sentry side-effects at import). |
| 6 | §4.4 smoke item #9 references `/api/_smoke-error` route not in C6, §4.x, or §11 | All 5 fixes applied: C6 sub-step (c) added, §4.8 added with full route shape (404 on prod, throw labeled error on non-prod, security posture note), §11 inventory bumped 10 → 11 net-new files, §6.2 reviewer scope extended with 3 bullets, §4.4 narrative rewritten with both-projects cross-check per EC9. SENTRY_API_TOKEN plumbing added (new staging-only Doppler var; O5a body extended to include Auth Token creation as sub-step (ii)). |
| 7 | `scripts/verify-r2-scope.ts` "folded or standalone" indecision in §11 | Resolved standalone. §11 wording tightened. §3 C8a body tightened with conceptual gloss ("security posture verification ≠ deploy verification"). Reusable for token-rotation/audit scenarios outside smoke. |
| 8 | §4.7 preview `BETTER_AUTH_TRUSTED_ORIGINS` wildcard deferred to execute | Resolved Path C (empty/unset). Better Auth wildcard support verified per official docs, but issue #3154 (June 2025 protocol-wildcard reliability bug) + parked.md M1/M2 preview-auth deferral + `*.vercel.app` attack-surface concern → wildcard rejected. HARDEN-phase carry-forward added (8 items total in C12 close-out list) with explicit upgrade path: dynamic `trustedOrigins: async (request) => [...]` + org-specific URL regex. |

### 3. Carry-forwards from SCAFFOLD.18 explicitly tracked

All 5 process learnings from SCAFFOLD.18 execute close-out applied this chat:

- **#1 (rm -f /tmp hygiene):** Not triggered — no tmpfile shell-buffer-bypass needed during plan review.
- **#2 (web Claude paste-back discipline):** Applied throughout — verified each of CC's interim plan outputs before drafting next paste-back. One-word operator acks treated as insufficient signal.
- **#3 (Vitest collection-time vs runtime skip semantics):** Item 5 specifically addresses; ctx.skip() precedent confirmed at `tests/db/identity-pool/watermark.test.ts:239`.
- **#4 (plan-mode mixed-concern-migration audit):** Item 4 specifically addresses; §3.B added with full audit.
- **#5 (brief-time scope estimates run optimistic):** SCAFFOLD.8 brief estimated ~3h CC execute. Final plan estimate after all items: ~3-4h CC + ~75 min operator + ~30 min reviewer cascade (or ~60 min if findings). Plan-mode CC was honest about upward revisions (C0 ~30 → ~45 min, O5a ~5 → ~10 min, J1 ~5 → ~10 min). Web Claude did not push back on justified increases.

### 4. Three operator decisions ratified at kickoff

- **OQ-13 (R2 dual-bucket scope):** deferred to web Claude review → ratified Option A (2 buckets, 2 tokens) at Item 1.
- **OQ-14 (Google OAuth staging redirect URI):** ratified by operator at kickoff after web Claude pushed back on alternative custom-auth proposal (Vercel Deployment Protection + Better Auth Email-OTP dev transport identified as solving the underlying concerns without breaking prod/staging auth parity).
- **OQ-15 (Vercel cron firing on staging Custom Env):** ratified by operator at kickoff (Accept default — cron fires on staging, sweeps staging bucket via token-scope construction). Cross-validated at Item 3 by SURPRISE-10 grep confirming cron route routes through `resolveBucketEnv()`.

### 5. SCAFFOLD.18 chore PR landing decision

Operator chose at kickoff: "Land as standalone chore PR now." Sequence:
- Before SCAFFOLD.8 execute begins: open chore PR from existing branch `chore/scaffold-18-execute-log @ 74c72c3` against main.
- PR title: `chore(scaffold-18): log session — SCAFFOLD.18 execute close-out`.
- Squash merge per project convention.
- SCAFFOLD.8 execute opens from main with that log committed.

Per §9 of the plan, hand-off boundary: this chat closes after ExitPlanMode with plan committed. SCAFFOLD.18 chore PR opens in the same CC session as plan-mode close (post-ExitPlanMode, pre-SCAFFOLD.8-execute).

---

## Carry-forwards

### Carry-forwards already in the plan (no separate tracking needed)

- 8 HARDEN-phase carry-forwards in C12 close-out list (per §10):
  1. GitHub Action for migration automation
  2. Weekly pg_dump drift verification
  3. PostHog environment-split (Stage 2)
  4. Redis-key lint rule
  5. BETTER_AUTH_SECRET_FINGERPRINT verification
  6. 0007 retroactive 3-way split (if partial-apply pain materializes)
  7. Probe-test bucket-name placeholder rename (from C4b scope-scan finding)
  8. Preview-deploy auth + trustedOrigins dynamic upgrade (from Item 8)

### Carry-forwards beyond SCAFFOLD.8 scope

- **SCAFFOLD.9 (Bundle 3b — k6 load testing on staging):** depends on SCAFFOLD.8 ship. Brief drafting starts after SCAFFOLD.8 execute close.
- **Operator wellbeing during execute:** Plan estimate is ~3-4h CC + ~75 min operator dashboard work + reviewer cascade time. SCAFFOLD.18 precedent showed 1-2h brief estimates running to ~8h. Operator advised to start execute fresh (not at hour 2 of a session).

### Carry-forwards into future plan reviews

- **Plan-mode CC sanity-pass against repo state should be standard:** This chat's 9 plan-time SURPRISEs (LD-2 env-var inventory incomplete, Better Auth version already pinned, Sentry DSN env-var name, PostHog/Turnstile var names, missing trustedOrigins config, missing Google OAuth staging URI, missing Vercel cron consideration, hardcoded bucket names in r2.ts, R2 endpoint scoping) demonstrate the value of pre-flight inspection before locking the plan. SCAFFOLD.9 brief should explicitly include "plan-mode CC sanity-pass" as step 0.

---

## Project Knowledge updates required

See PK update table in next reply.

---

## Process learnings from this chat

1. **Web Claude review against checklist + critical-read against brief works.** 8 substantive items surfaced; all closed with material plan changes. Lazy-init refactor revert (Item 2) and `_smoke-error` route addition (Item 6) were the largest-impact changes — both would have caused execute-time confusion or rework if not caught.

2. **CC's plan-mode SURPRISE-10 mid-grep is a feature, not a bug.** While responding to Item 3 (env-var inventory grep), CC surfaced hardcoded bucket names in r2.ts that gated OQ-13's verdict. The architecture would have been broken at first staging deploy without C4b. Plan-mode is exactly where these are catchable.

3. **Operator's "simple staging OAuth with single user/password" proposal at OQ-14 stage was correctly pushed back.** Vercel Deployment Protection + Better Auth Email-OTP dev transport solve the underlying access-control + iteration-speed concerns without breaking staging-prod parity. Web Claude's role as technical co-founder includes saying "what you proposed breaks the thesis discipline; here's what you actually want."

4. **Web search at plan time is cheap and catches real risks.** Two searches this chat: pg_cron Supabase version (Item 4 small-addition) + Better Auth wildcard support / issue #3154 (Item 8). Both materially changed verdicts.

5. **Some plan items don't need plan revision, just verification.** Item 5 didn't surface a design gap in §4.5 Tests 1/2, but the verification process caught a real Test 2 issue (redis singleton + Sentry side-effects at import) and documented the existing repo convention in the preamble. Both were value-adds.

---

## Time tracking

- Chat duration: ~1h 35m wall-clock (operator's clock 4:39 PM → 5:58 PM IST).
- CC plan drafting time: ~3 min initial draft + 8 iteration rounds.
- Web Claude review: 8 items, each one substance + relay per reply, average ~1-2 paste-backs per item.

Plan-mode kickoff estimate: ~45-60 min. Actual: ~95 min. Overage primarily from SURPRISE-10 at Item 3 (added C4b step) and Item 6's full route shape addition. Acceptable overage — both caught real risks.

---

## Next chat: SCAFFOLD.8 execute

**Chat type:** Execute review (web Claude + CC pair).
**Owner:** Hrishikesh + web Claude (review) + CC (execute).
**Kickoff prompts:** authored at close-out step 4 (paired — web Claude + CC, both with ultrathink keyword).
**Expected duration:** ~3-4h CC execute time + ~75 min operator dashboard time + ~30-60 min reviewer cascade (security-auditor on C3+C4 + C9 + _smoke-error).
**Exit criterion:** PR `feat/scaffold-8-staging-env` merged to main with all 12 ECs verified.

Before execute opens:
- SCAFFOLD.18 log chore PR opened + squash-merged.
- This plan committed to `docs/plans/SCAFFOLD.8-staging-plan.md`.
- Brief committed to `docs/plans/SCAFFOLD.8-staging.md`.
