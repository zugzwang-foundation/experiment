# AUDIT-FIX-B7 — A26 Freeze Accepted-Window Ruling (web-authored riders)

**For CC:** doc-only PR (no code, no migrations). Branch `docs/b7-a26-freeze-window` (or house convention). Commit **this file** as `docs/plans/AUDIT-FIX-B7_A26-freeze-window-ruling.md` alongside the SPEC.2 riders below, same commit. **Riders are CONTENT-ANCHORED** — find each quoted "current" string on your branch and confirm it matches before replacing; if any differs, STOP and flag. **Do NOT touch SPEC.2 §0 / §22** — extend the `parked.md` sweep-debt entry instead (note the §0 bump owed for this ruling). Open the PR and return the full diff for web review; operator merges after the gate read.

**No ADR is minted.** Precedent: the R-14.3 close-lag window (the ruling this mirrors) lives as a plan-doc ruling (`docs/plans/ENGINE.14.md:111-122`) + a SPEC.2 §3.4 anchor clause — no ADR. This ruling is likewise doc-only: it changes no behavior contract, mints no mechanism, and touches no code. ADR ceiling stays 0031.

---

## 1. The ruling (founder-ratified 2026-07-06, AUDIT.1 finding A26)

**Disposition: ACCEPTED-WINDOW. No code. W-1 untouched.**

The freeze gate is a single pre-transaction read — `isFrozen()` at the handler boundary (`src/server/system/is-frozen.ts`, a deliberately non-locking read of the `system_state` singleton, kept outside the W-1/W-3/W-4 lock order per its own docstring). The W-1 bet transaction locks pools and reads `markets.status` only; it never re-reads `system_state`. Consequently a request that passed the gate while `frozen_at` was `NULL` can commit **after** the flip.

**Accepted cost, eyes open** (mirroring the close-lag ruling's structure):

- **Window bound.** In-flight handler lifetime — seconds-class, dominated by the pre-commit moderation budget (up to 2 attempts) plus the W-1 statement/retry budget (1000ms `statement_timeout` per statement, 4-attempt retry with 50/100/200ms backoff bases + jitter, 30s idle-in-transaction ceiling). Unlike close-lag (bounded by a named sweep cadence), no single named value bounds this window and **none is minted** — numeric characterization is HARDEN/runbook territory, consistent with the close-lag "numeric tuning is HARDEN" posture.
- **Why not close it.** A W-1 re-read of `system_state` would put a freeze check inside the bet path — the exact class of change the close-lag ruling declared founder-gated ("optional W-1 deadline guard if ever revisited would touch W-1, founder gate required"). The window fires at most once, at the experiment's terminal instant, for requests already in flight at that instant. The fix cost (critical-path W-1 change + lock-order interaction with the deliberately-outside `isFrozen()` read) is out of all proportion to a seconds-class, once-ever window.
- **Two backstops cap it in practice.** (i) A window **bet** must additionally find its market still `Open` inside W-1; for markets whose `resolution_deadline` coincides with (or precedes) the freeze instant — the experiment's terminal configuration — that adds the R-14.3 close-lag bound (per-minute close-due sweep) as an independent cap. (ii) The dataset-build point (§19.1 as amended below) post-dates the drain by hours, so every window commit is in the released artifact — nothing is lost or ambiguous.
- **What is not touched.** Window commits are ordinary appended rows. The one-shot `frozen_at` transition (NULL → timestamp once; trigger rejects re-fire, un-freeze, DELETE) is untouched; nothing frozen is mutated; no row is retroactively altered. The append-only and frozen-at-resolution guardrails hold unchanged.

**Discovery folded into this ruling — §19.1 was already internally contradicted.** The pre-ruling §19.1 sentence claimed post-freeze rows "would be absent" from the artifact "(which §20.2 forecloses anyway)". §20.3 contradicts both halves *by design*: admin conclusion work (resolutions, payouts, moderation — the experiment's outcomes) fires **post-freeze** and §20.3 explicitly promises "the dataset release reflects the admin actions taken between freeze and Nov 6 dataset-build time"; the auth surface likewise stays write-live post-freeze. So the snapshot boundary was never the freeze instant — it is the **dataset-build point**. The riders below realign §19.1/§19.2 to the boundary §20.3 already ratified, and slot the A26 window in as the third (and smallest) legitimately-post-freeze row class.

---

## 2. SPEC.2 §20.2 rider — insert the accepted-window clause

Insert the following as a new paragraph **after** the middleware paragraph ending:

> …read paths do NOT call `isFrozen()` (they remain available indefinitely post-freeze); only state-mutating paths gate.

and **before** the paragraph beginning:

> **Wire envelope.**

**Insert (new paragraph):**

> **Freeze accepted-window (in-flight requests) — AUDIT.1 A26 ruling, founder-ratified 2026-07-06.** The `isFrozen()` gate is a single pre-transaction read; the W-1 bet transaction deliberately does not re-read `system_state` (the read is kept outside the W-1/W-3/W-4 lock order per `is-frozen.ts`; no freeze check enters the bet path — any change to that is founder-gated, mirroring the R-14.3 close-lag posture, §3.4). A request that passed the gate while `frozen_at` was `NULL` can therefore commit after the flip. **Accepted cost, eyes open:** the window is bounded by in-flight handler lifetime — seconds-class, dominated by the pre-commit moderation budget plus the W-1 statement/retry budget; no single named value bounds it and none is minted (numeric characterization is HARDEN/runbook territory). Two backstops cap it in practice: a window *bet* must additionally find its market still `Open` in W-1, which for markets whose `resolution_deadline` coincides with the freeze instant adds the R-14.3 per-minute close-lag bound; and the §19.1 dataset-build point post-dates the drain by hours, so every window commit ships in the release artifact as an ordinary row. The one-shot `frozen_at` transition above is untouched — nothing frozen is mutated, no row is retroactively altered. Dataset interpretation: §19.1.

---

## 3. SPEC.2 §19.1 rider — Source-of-truth boundary (CONTENT-ANCHORED)

**Current** (first two sentences of the **Source-of-truth state.** paragraph, `§19.1`):

> **Source-of-truth state.** The release artifact is built from a Postgres state snapshot taken immediately after the 2026-11-05 23:59 UTC write-freeze fires (per §20). The artifact contains rows that existed at the freeze instant; rows from any post-freeze writes (which §20.2 forecloses anyway) would be absent.

**Replace with** (the paragraph's remaining sentences — "The build pipeline runs once; …" onward — stay verbatim, untouched):

> **Source-of-truth state.** The release artifact is built from a Postgres state snapshot taken at the **dataset-build point**: after the 2026-11-05 23:59 UTC write-freeze fires (per §20) *and* after the post-freeze admin conclusion work (§20.3) completes, ahead of the 2026-11-06 build. The artifact contains every row committed up to the build point. Three row classes legitimately post-date the freeze instant and appear as ordinary rows: (i) admin conclusion-event rows — resolutions, payouts, moderation (§20.3; required content — the market outcomes fire post-freeze by design); (ii) auth-surface rows from the still-live login/signup posture (§20.3); (iii) freeze accepted-window commits (§20.2) — participant bet-path requests already past the pre-transaction freeze gate when `frozen_at` flipped, committing seconds after it. Window rows are not specially marked; the release does not claim that zero participant writes committed after `frozen_at` — the guarantees are that the participant write surface *gated* from the moment the flip was readable (410 for every subsequently arriving request) and that the build point post-dates every in-flight commit, so nothing is absent.

---

## 4. SPEC.2 §19.2 rider — replica target (CONTENT-ANCHORED)

**Current** (final paragraph of §19.2):

> The build pipeline runs `pg_dump` against a freeze-snapshot Postgres replica (Supabase point-in-time recovery to the freeze instant), then post-processes per §19.4 (PII strip) and §19.5 (export-time JOIN pseudonymization), then packages into the tarball. The replica is short-lived (built for the export run, dropped after); the pipeline is one-shot.

**Replace with:**

> The build pipeline runs `pg_dump` against a build-point Postgres replica (Supabase point-in-time recovery to the §19.1 dataset-build point), then post-processes per §19.4 (PII strip) and §19.5 (export-time JOIN pseudonymization), then packages into the tarball. The replica is short-lived (built for the export run, dropped after); the pipeline is one-shot.

---

## 5. Descriptive-doc mirror check (CC-owned)

Check `docs/` for descriptive mirrors of the old boundary language — at minimum `dataset-release.md` (and any runbook stub, if `conclusion-event-freeze.md` exists yet). If any restates "snapshot at the freeze instant" / "post-freeze writes absent", update it descriptively to match the amended §19.1 (descriptive docs are CC-authored; web reviews in the same PR diff). If a mirror conflict is more than a phrasing fix, STOP and flag instead of resolving it unilaterally.

---

## 6. Observed drift — noted once, NOT touched in this PR

- §20.2 places the `isFrozen()` check at "handler-stack step 1 … before the idempotency cache lookup"; live code runs it as step 1.5 of `runBetEndpoint` (`bets/endpoint.ts:196-203`). Spec-vs-code step-numbering drift; sweep territory, not this ruling's to reconcile.
- Pre-existing parked items unaffected and untouched: §19.3 `market_media` enumeration gap; SPEC.2 §0/§22 sweep debt (extended per header instruction, not edited).

---

## 7. STOP conditions for CC

STOP and report (do not improvise) if: any content anchor mismatches live `main`; the §19.2 PITR sentence differs from the quoted current text; a descriptive-doc mirror conflict is structural rather than phrasing; or committing this doc/riders would collide with any in-flight branch touching §19/§20.

---

*Ruling record. The freeze deadline itself never moves and frozen state is never mutated — this ruling only makes the spec honest about the seconds between a request entering the door and the door registering as locked, the same honesty the close-lag ruling already established for market close. Founder-ratified 2026-07-06 (B7 decision 5a).*
