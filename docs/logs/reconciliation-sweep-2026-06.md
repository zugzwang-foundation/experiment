# reconciliation-sweep-2026-06 — repo↔tracker↔spec evidence sweep + §19.4.1 catch-up (SPEC.2 → 1.0.2)

**Status:** Sweep PR merged 2026-06-10; this log PR closes the session (GATE-2)
**Sweep branch:** `chore/reconciliation-sweep-2026-06` (PR **#106**) — squash SHA on `main`: **`5e75f5f`**
**Log branch:** `chore/reconciliation-sweep-2026-06-log` (this PR)
**Predecessor:** ENGINE.12 close (`docs/logs/ENGINE.12.md`, `main` @ `cdd882f`)
**Base:** `main @ cdd882f` (sync-gate verified clean; tracker NOT repo-resident — no tracker file created)
**Mode pin:** claude-fable-5 · effort xhigh · ultrathink · NOT ultracode · sequential pass, no fan-out. No Opus 4.8 classifier fallback observed.

---

## What landed (CLAUDE.md §5.9 field 1)

**PR #106 — `chore/reconciliation-sweep-2026-06`** — single signed commit (`4825228` on branch → squash **`5e75f5f`** on `main`), six files, docs + comment lines only, zero behavior:

| File | State | Notes |
|---|---|---|
| `docs/specs/SPEC.2.md` | Modified | 1.0.1 → **1.0.2** (same-commit §0 version + date + §0.1 change-log row + status blockquote). §19.4.1: three catch-up STRIP rows for the ENGINE.8-emitted types — `bet.placed`, `bet.sold`, `comment.placed` — each STRIPs `payload.userId`; research keys SHIP. No other §19.4.1 edits. |
| `AGENTS.md` | Modified | §3 tree + greenfield list (bets/cpmm/dharma/markets/positions landed across ENGINE.2–12); §6 migration head `0011` → `0012_daily_allowance_day_unique.sql`; §9 invariant inventory rewritten from disk (**7 specs**, one-line purpose each) + tree-block truth-up (integration 8→9, server/ + unit/ listings). |
| `CLAUDE.md` | Modified | §2 stale parenthetical ("Today only `I-APPEND-ONLY-001` exists…") → on-disk INV→spec mapping. Nothing else (— #101 already moved the harness prose to Fable 5). |
| `src/server/config/limits.ts` | Modified | 13× `HARDEN.6` → `HARDEN.5` (header comment + JSDoc cites). Comment lines only. |
| `src/server/idempotency/types.ts` | Modified | 2× negative cites ("NOT a HARDEN.6 tuning knob") → `HARDEN.5`. |
| `src/app/api/uploads/sign/route.ts` | Modified | 1× line-178 cite ("tunable in HARDEN.6") → `HARDEN.5`. |

Gates: `just check` clean (200 files) · `just typecheck` clean · PR CI `ci` pass (1m56s, run 27291561214) · Vercel pass. Docs-only precedent — no reviewer cascade.

**Grounding deltas applied to the web-authored §19.4.1 rider rows** (STRIP targets unchanged in all three — `payload.userId`; no additional PII-class keys found):

1. `bet.sold` rationale: research key is **`sharesSold`** (the actual payload key, `schemas.ts:220`), not `shares`.
2. `comment.placed` rationale: **`body` / `side_at_post_time` are not payload keys** — the payload carries `bodyLength` + `side`; body + side_at_post_time ship via the `comments` table per Appendix B.13. Rationale rewritten to the actual payload research keys (`side`, `bodyLength`, market/bet/comment ids, `uploadId`).
3. `bet.placed`: applied verbatim + the "(ENGINE.8 emit site)" marker matching the existing rows' convention.

Confirmed per kickoff: `dharma.credited` already had a §19.4.1 row (ENGINE.12) — no rider applied.

---

## Recon evidence table (Phase A1 — evidence from `git log` / `gh pr list|checks` / `ls` / `git log --all` only)

Baseline done-set (v12): FOUND.\*, SPEC.\* except SPEC.13, PRECURSOR.1–4, SCAFFOLD.\* except .9/.11/.17, SYNC.\*, ENGINE.0, MAINT.2/6/7/11/12/13/14.

| Row | Verdict | Deliverables | Squash SHA | PR# | CI run |
|---|---|---|---|---|---|
| ENGINE.1 | DONE | `docs/specs/cpmm.md` v1.0.0 + third-party notices + SPEC.1 1.0.2 glossary fix | `e7362fc` | #71 | 26945546149 pass |
| ENGINE.2 (plan) | DONE | `docs/plans/ENGINE.2.md` | `d6af030` | #73 | docs-only |
| ENGINE.2 (execute) | DONE | `src/server/cpmm/{calculate,decimal,errors,validate}.ts` | `2a8d888` | #75 | 26958899567 pass |
| ENGINE.3 | DONE | `tests/unit/cpmm/` fast-check suite (plan `945b764` #77) | `d8e9159` | #79 | 27012069836 pass |
| ENGINE.4 | DONE | `src/server/markets/{transitions,errors}.ts` + `tests/unit/markets/` (plan `3148020` #81) | `c976222` | #83 | 27060628496 pass |
| ENGINE.5 | DONE | `src/server/dharma/` ledger + `I-NO-OVERDRAFT-001` + migration 0009 (plan `c7acc1b` #85) | `da4618d` | #87 | 27097016634 pass |
| ENGINE.6 | DONE | `src/server/events/{insert,schemas}.ts` + 6-site emission | `42baa8b` | #49 | pre-SCAFFOLD.18 CI (no `ci` job yet) |
| ENGINE.7 (plan) | DONE | `docs/plans/ENGINE.7.md` | `7dc22d8` | #93 | docs-only |
| ENGINE.7 (execute) | DONE | `src/server/bets/{transaction,errors}.ts` + `I-ATOMICITY-001` (INV-1 canonical) | `37dae5a` | #95 | 27206540432 pass |
| ENGINE.8 (plan) | DONE | `docs/plans/ENGINE.8.md` | `c87eb9a` | #97 | 27217345135 pass |
| ENGINE.8 (execute) | DONE | `src/server/bets/{place,sell,endpoint,floors}.ts` + `I-SIDE-BIND-001` (INV-3 canonical) | `66fa532` | #99 | 27231233747 pass |
| ENGINE.9 | **NOT-DONE** | `src/server/resolution/` absent; `git log --all -- src/server/resolution/` = zero commits across all refs | — | — | — |
| ENGINE.10 | **NOT-DONE** | zero candidate evidence | — | — | — |
| ENGINE.11 | DONE | `src/server/positions/` + migrations 0010/0011 + `I-NO-OVERSELL-001`/`I-SINGLE-SIDE-001` (plan `10b9aa8` #89) | `deb0c76` | #91 | 27155330552 pass |
| ENGINE.12 | DONE | `src/server/dharma/accrual.ts` + `I-DAILY-ONCE-001` + migration 0012 (plan `ca790ca` #102; log `cdd882f` #105) | `af61ce5` | #104 | 27270073245 pass |
| DESIGN.\* | **WEB-VERIFY** | PK-resident mockups. Repo traces: `docs/design/` VISUAL backbone (`5b19a13` #68) + v0.2 / Research_Report_v2 (`2e26b52` #70) | — | — | — |
| UI lane | **NOT-DONE** + drift | no `src/app/(public)/`; lane renamed `UI.*` → `VISUAL.*` at tracker v11 (SPEC.2 §0.1 1.0.1 row) | — | — | — |
| DEBATE.\* | **NOT-DONE** | `src/server/comments/` absent; zero history across all refs | — | — | — |
| SCAFFOLD.9 | **NOT-DONE** | zero candidate evidence | — | — | — |
| SCAFFOLD.11 | **NOT-DONE** | zero candidate evidence | — | — | — |
| SCAFFOLD.17 | **DONE — DRIFT vs baseline** | identity-pool seed + pg_cron low-watermark + verification; logs on disk | `d5be518` | #50 (+#51 close-out `6a04ec3`) | pre-SCAFFOLD.18 CI |
| MAINT.15 | **NOT-DONE** | named carry-forward: SPEC.2 §13.3 F-\* count truth-up (home: §23.3) | — | — | — |
| MAINT.16 | **NOT-DONE** | named carry-forward: spec-wide v7→v11 HARDEN-ID renumber propagation (~30 refs) | — | — | — |
| TESTING.\* | **NOT-DONE** | zero candidate evidence | — | — | — |
| HARDEN.\* | **NOT-DONE** | zero candidate evidence (forward owner-cites only) | — | — | — |
| LAUNCH.\* | **NOT-DONE** | zero candidate evidence | — | — | — |

**Reverse direction:** no baseline-done row with absent deliverables. Bounded caveat: MAINT.2/6/7/11/12/13/14 deliverables not enumerable from the repo (tracker external) — nothing contradicts them; not positively re-verified.

**Drift vs the kickoff's own v12 baseline:** SCAFFOLD.17 is merge-verified DONE (listed not-done in the baseline); `tests/invariants/` has **7** specs (kickoff expected 5; AGENTS.md §9 listed 2) — disk won in all cases.

**Emit-site diff (A2-5):** `EVENT_TYPES` = 21. Live emits (10): `bet.placed`/`comment.placed` (`place.ts:153/171`), `bet.sold` (`sell.ts:78`), `dharma.credited` (`accrual.ts:191`), `user.tos_accepted`, `user.signed_out`, `admin.signed_in`, `admin.signed_out`, `image_upload.sign_requested`, `image_upload.orphaned`. Schema-only: `image_upload.committed`/`.blocked` (DEBATE.2), `user.oauth_signed_in`/`.otp_signed_in`/`.pseudonym_assigned` (auth-hook stratum), `market.*` ×6 (ENGINE.9 / market admin). §19.4.1 was missing exactly the three rider types; `dharma.credited` row pre-existed.

**Machine items (A3, report-only):** `.env.local` not read/grepped (never-rule); DATABASE_URL append rides the close-out as an operator one-liner. Docker: `/usr/local/bin/docker` → dead DMG path `/Volumes/Docker/Docker.app/...`; real binary at `/Applications/Docker.app/Contents/Resources/bin/docker`; fix one-liner in "Context to preserve".

---

## Decisions made (CLAUDE.md §5.9 field 2)

1. **HARDEN.6 → HARDEN.5 ruling grounded, scope-bounded.** Canonical v11 mapping: HARDEN.5 = number-tuning pass (`limits.ts:120`, the newest ENGINE.12 cite; SPEC.2 §23.2 per the §0.1 1.0.1 row). Fixed in `src/` comment lines only (16 cites across 3 files). SPEC.2's own internal stale `HARDEN.6` refs deliberately untouched — spec-wide propagation is already homed to **MAINT.16**.
2. **Disk wins over kickoff expectations** (7 invariant specs vs expected 5; SCAFFOLD.17 DONE vs baseline not-done) — recorded, not silently absorbed.
3. **Grounding deltas to web-authored rider rows applied + flagged** (see "What landed"); STRIP targets unchanged.
4. **`market.*` §19.4.1 rows deferred** to the emit-site stratum (ENGINE.9) — no PII-class payload keys; §19.4.1's same-commit amendment rule makes the emit stratum the right home. Recorded in the 1.0.2 change-log row.
5. **CLAUDE.md edit eligibility:** only the §2 parenthetical qualified (A2-proved stale present-tense ref); the §6/§7 Fable-5 prose (#101) and the line-225 footer were left untouched.
6. **Opus grep dispositions:** zero present-tense CC-harness refs needed fixing; `docs/design/*` hits describe the Claude Design web app (external tool), not the CC harness — out of fix-rule scope.

---

## Open questions / flags — all with named homes (CLAUDE.md §5.9 field 3)

| # | Flag | Home |
|---|---|---|
| F-1 | **SPEC.2 §0.1 versioning drift:** ENGINE.5 (#87) + ENGINE.12 (#104) edited SPEC.2 body (incl. the §19.4.1 `dharma.credited` row) with **no change-log rows / version bumps** | next spec sweep |
| F-2 | **SPEC.2 Appendix B.13 illustrative-note drift** (web-review rider): B.13's `payload` row Notes claim "`comment.placed` carries body / side_at_post_time"; the built schema carries `bodyLength` + `side` — body + side_at_post_time live on the `comments` table. One-line Notes-column fix | next spec sweep (alongside F-1) |
| F-3 | **SPEC.2 §14 INV-3 test-file slug drift** (noticed during Phase-D verification): the INV-3 row cites `I-SIDE-BIND-001.comment-side-frozen.spec.ts`; the on-disk canonical file is `I-SIDE-BIND-001.comment-side-bound-at-post-time.spec.ts` | next spec sweep (alongside F-1/F-2) |
| F-4 | **CLAUDE.md:225 footer** ("Folded: … CC → Opus 4.8") — historical SYNC.8 provenance note, accurate as a record but datable | next SYNC footer refresh |
| F-5 | **`claude-progress.md` header** still claims SCAFFOLD.1 scope while serving as the cross-task SURPRISE log (424 lines; ENGINE.7 57014/alarm-3 SURPRISE at tail) | next MAINT sweep (cosmetic) |
| F-6 | **`market.*` §19.4.1 rows** — deferred, not missing: no PII-class payload keys; rows land with the emit sites | ENGINE.9 (same-commit per §19.4.1 rule) |

---

## Next session starts at (CLAUDE.md §5.9 field 4)

**ENGINE.9 — NAMED, NOT STARTED.** The founder holds the ENGINE.9 scoping discussion in a separate web chat before any kickoff. Dependency evidence (merge-verified this sweep): ENGINE.4 `c976222` (#83) · ENGINE.5 `da4618d` (#87) · ENGINE.7 `37dae5a` (#95). Candidate-not-done proof: `git log --all -- src/server/resolution/` returns zero commits; the directory has never existed on any ref.

---

## Context to preserve (CLAUDE.md §5.9 field 5)

- **Canonical SHA for this sweep: `5e75f5f`** (squash of #106 on `main`). SPEC.2 is at **1.0.2**.
- **PK refresh staging set (Phase E):** `~/Desktop/zz-pk-refresh-SWEEP-2026-06/` ← from `origin/main`: `SPEC_2.md`, `AGENTS.md`, **`CLAUDE.md`** (changed in #106 and PK-mirrored — web-review rider), and this log. md5-verify all four.
- **Operator one-liners (machine items, files untouched by CC):**
  - Docker symlink fix: `sudo ln -sf /Applications/Docker.app/Contents/Resources/bin/docker /usr/local/bin/docker`
  - `.env.local` DATABASE_URL append — composed at close-out (E2); CC never reads/writes `.env*`.
- The tracker is **not repo-resident** (web-Claude PK HTML; PK md5 `b73a5c4b76ff2452756355b05247f17a` at this sweep's authoring). The v12 baseline drifts found here (SCAFFOLD.17 DONE; 7 invariant specs) are tracker-author inputs.
- `gh` graphql intermittently returned 401 mid-session (REST fine; retries succeeded) — transient, not config.

---

## Time (CLAUDE.md §5.9 field 6)

One session, 2026-06-10: sync-gate (Step 1, prior chat turn) → recon (A1–A3) → apply (B1–B4) → gates + PR #106 (GATE-1) → merged same day → this log (GATE-2). Phase E (PK staging + close-out report) follows the log merge.
