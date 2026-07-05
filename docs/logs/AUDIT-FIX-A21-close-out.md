# Session log — AUDIT-FIX-A21 — moderation verdict-mapper fail-open belt

**Stratum state:** DONE — landed to `main`. Squash SHA **`e3f0569`** (PR #203).
Kickoff-driven (no `docs/plans/AUDIT-FIX-A21.md` — the kickoff was self-contained;
verify-live → operator-ratified plan → execute, all in one chat).
**Time:** 2026-07-05 (single session: verify-live → pause-point → execute → auditor → PR → merged → this log).

## What landed (files + PR#)

PR **#203** → squash **`e3f0569`**. One commit (`6526cb8` on the fix branch) carried code + test + all 4 spec edits (same-commit doctrine §5.12). No DDL, no migration.

- **Belt (code):** `src/server/moderation/openai.ts` — a vendor-boundary well-formedness guard in `moderate()` (merged **L111-120**), immediately after the existing `openai_moderation_empty_results` guard. Predicate: `result.flagged === true && !Object.values(result.categories).some((v) => v === true)` → `safeCaptureException(cause, { tags: { kind: "openai_moderation_malformed_flagged" } })` → `throw new ModerationUnavailableError(cause)`. Paired re-throw at the top of the loop's `catch` (merged **L131-140**): `if (err instanceof ModerationUnavailableError) throw err;` as the **first** catch branch (before auth/transient) → one capture, distinct tag preserved, no retry, no double-capture; the empty-results anomaly (plain `Error`) is undisturbed and still classifies as `upstream_failure`.
- **`precommit.ts` UNTOUCHED** — the mapper (L134-160) is byte-identical; its `else pass` is now reachable only for `flagged:false`. Captures stay at the vendor boundary per AUDIT-FIX-B1 A6 ruling #4; `precommit.ts` mints nothing new.
- **Test:** NEW `tests/server/moderation/malformed-flagged-belt.test.ts` — drives the REAL `precommitModerate` seam (real `moderate()` + real mapper) by mocking the OpenAI **SDK** (`moderations.create`), not `moderate` itself. 5 tests: 3 fail-closed (RED→GREEN) + 2 scoping guards (flagged:false still passes; flagged:true + any category true still routes track_b).
- **Spec (same commit, web-authored verbatim):** ADR-0014 §4 well-formedness-guard paragraph (merged **L166**), §5 aggregation annotation — terminal `pass` reachable only for `!flagged` (merged **L182-189**), Patch-record `### P2` (merged **L37-39**); SPEC.2 §10 fail-closed note (merged **L1132**, behavior-only).

**Gates:** `ZUGZWANG_ENV=preview just verify` green; full `pnpm vitest run` = 1241 passed / 0 failed / 2 skipped / 5 todo. `@security-auditor` (Opus, effort max, widened brief) — CLEAN, 5/5 attestations PASS.

## Sequence (how it went)

1. **Verify-live (read-only).** Confirmed the finding at BOTH layers: the mapper (precommit.ts) never reads `result.flagged`, so `flagged:true` + zero true categories falls through to `pass`; and the ADR-0014 §5 aggregation pseudocode assumed `flagged ⇒ track ∈ {a,b}` and likewise fell through to `pass`. Queue-clear confirmed (B2 #201 / B3 #202 merged; A1 real-R2 rehearsal is a standing operator gate, not an in-flight deploy; DP.2 not mid-promote).
2. **Pause-point + operator ratification.** Surfaced the one live-reality divergence (below) and stopped. Web ruled **Option A** and returned the exact spec text.
3. **Execute.** Failing-first test (confirmed RED on main — `precommitModerate` resolved `{outcome:'pass'}`) → belt → GREEN → 4 spec edits → gates → `@security-auditor` → PR #203.
4. **Merge + web Gate-C.** Operator merged #203 (`e3f0569`); web pulled the merged bytes from `raw.githubusercontent`, verified against report + auditor, and passed Gate-C clean (findings folded in below).

## Decisions made

- **Option A — belt at the vendor boundary (`openai.ts`), NOT in the mapper (`precommit.ts`).** The ratified plan framed the fix as a "mapper" change; verify-live surfaced that `openai.ts` L30-33 codifies **AUDIT-FIX-B1 A6 ruling #4** — *all captures sit at the vendor boundary; precommit mints no vendor failure of its own*. Emitting a Sentry capture from the mapper would contradict ruling #4. Web ruled the belt lives at the vendor boundary as the **twin of the existing `openai_moderation_empty_results` anomaly** — honoring ruling #4 with no amendment, and matching the "well-formedness check at the boundary; track-mapping in the mapper" separation. `precommit.ts` stays untouched.
- **Reuse the existing 503 idiom, mint no client-facing error code.** `ModerationUnavailableError` → HTTP 503 `moderation_unavailable` (`Retry-After: 5`).
- **Distinct tag `openai_moderation_malformed_flagged`** (NOT the generic `upstream_failure`) so a category rename under the pinned `omni-moderation-2024-09-26` snapshot reads as label-drift, not an outage. The catch re-throw guard is what prevents reclassification.
- **In-place ADR Patch record (`### P2`), not a new ADR** — the gate architecture is unchanged; only the gate mapping is scoped (§5.12 consumer-surface scoping).

## Web Gate-C findings (post-merge diff-read of the merged bytes — CLEAN)

Web verified the real merged bytes (raw.githubusercontent) and corroborated the report + auditor 5/5; nothing to fix-forward.

- **Belt (openai.ts L111-120):** predicate `flagged===true && no-category-true`; at the vendor boundary after the empty-results guard; fails closed via `ModerationUnavailableError`→503 (existing idiom, no new client code); distinct tag `openai_moderation_malformed_flagged`.
- **Re-throw (openai.ts L131-140):** `if (err instanceof ModerationUnavailableError) throw err;` is the FIRST catch branch (before auth/transient) → one capture, distinct tag preserved, no retry, no double-capture. Empty-results still → `upstream_failure`, undisturbed.
- **precommit.ts mapper (L134-160):** byte-identical / untouched; else-pass reachable only for `flagged:false`.
- **Spec:** ADR-0014 §4 guard (L166), §5 terminal-pass annotation (L182-189), §18→`### P2` (L37-39; P2 = correct next label), SPEC.2 §10 note (L1132, behavior-only).

## Process deviation (recorded honestly — non-incident)

**PR #203 was merged by the operator BEFORE the web Gate-C diff-read.** Web performed the diff-read **post-merge** (against the merged bytes on `main`) and it was **clean** — no fix-forward needed, no harm. The intended gate order for critical-path merges is **PR opened → web reads the actual diff (gate rule C) → operator squash-merges**. Here the read happened after the merge. Recording so the order is preserved on future critical-path merges — relevant for **Nov 6 dataset provenance / post-hoc review**, where "reviewed-before-landed" is the provenance claim we want to be able to make. Not an incident (outcome was clean); a sequencing note.

## Auditor-deferred LOW (out-of-threat-model; do NOT action here)

`@security-auditor` surfaced one LOW, explicitly *not* to be fixed in this PR:

- **Strict-equality on `flagged`** (`openai.ts:112` guard + `precommit.ts:144-154` mapper). Both use `=== true`. A *truthy-but-non-boolean* `flagged` (e.g. `{ flagged: 1, categories: {all false} }`) would slip the guard (`1 === true` is `false`) and map to `pass`.
  - **Why deferred:** pre-existing (identical to the pre-A21 mapper's residual, not an A21 regression); **not attacker-controllable** (an attacker cannot make OpenAI emit a non-boolean `flagged`); **not a realistic drift vector** for the pinned snapshot (drift renames category keys — renamed-but-present → track_b via the catch-all; renamed-all-absent → the belt). Below the threat-model floor.
  - **Future hardening (separate task):** key the guard off `Boolean(result.flagged)` (or route the mapper on `flagged` truthiness). Carried to the B-lane below.

## B-lane carry-forwards (do NOT fix here)

1. **SPEC.2 §10 L1136** — "*`precommit.ts` owns … the Sentry emission*" is **pre-existing B1 drift**: AUDIT-FIX-B1 moved the vendor captures to the boundary (`openai.ts`). The A21 §10 note (L1132) is **behavior-only**, so it does not contradict L1136 — but L1136 itself needs a B-lane correction to name the vendor boundary as the capture site.
2. **SPEC.1 §16.5** — intentionally **not edited**; it already mandates the fail-closed posture (the belt is an instance, not a change).
3. **Auditor LOW (item above)** — `Boolean(flagged)` defense-in-depth hardening, if/when a B-lane pass wants belt-and-suspenders.

## Surprises caught + fixed in-session (§5.10 wins)

1. **The observability-boundary divergence (headline).** The ratified plan said "belt in the mapper + emit a Sentry tag"; verify-live caught that emitting a capture in `precommit.ts` contradicts AUDIT-FIX-B1 A6 ruling #4 (all captures at the vendor boundary). Surfaced at the pause point rather than silently picking a file → web ruled Option A. This is the whole reason the belt lives in `openai.ts` and `precommit.ts` stays untouched.
2. **The reclassification trap.** The kickoff explicitly warned that copying the empty-results throw path would reclassify the belt into `upstream_failure` and lose the drift signal. Implemented the paired `instanceof ModerationUnavailableError` re-throw as the FIRST catch branch so the distinct tag survives and there is no double-capture / retry. Verified by the test asserting exactly one capture with the distinct tag.
3. **ADR anchor deviation — §18 → `### P2`.** EDIT 3's web text was headed "§18 patch-record", but ADR-0014 has no literal §18 — its patch mechanism is the top-of-file `## Patch record` / `### P1` (and "§18" is how `precommit.ts:24` / SPEC.2 §10 already refer to it colloquially). Landed the web paragraph **verbatim** under a new `### P2` heading per the established format, and flagged the deviation in the PR body. Web confirmed P2 is the correct next label.

## Closing-ritual doc check

Should CLAUDE.md / AGENTS.md / the workflow / the tracker change as a result of this session? **No.** Web corroborates: the new tag `openai_moderation_malformed_flagged` is canonically documented in ADR-0014 §4 + Patch-record P2; no new critical path, invariant, or workflow. Neither CLAUDE.md nor AGENTS.md enumerates the per-vendor Sentry tags, so no footer/contract change is triggered.

## Open questions

None blocking. The B-lane carry-forwards above are the only forward items, and they are explicitly out of A21 scope.

## Next session starts at (exact next action)

**This log PR merges → complete the PK refresh** (stage the md5-verified `docs/logs/AUDIT-FIX-A21-close-out.md` copy from `origin/main` into `~/Desktop/zz-pk-refresh-AUDIT-FIX-A21/`, alongside the already-staged ADR-0014 + SPEC.2 copies). Then the operator queues the next audit-fix item / B-lane sweep (§10 L1136 drift correction is a candidate; the auditor LOW is a further candidate).

## Context to preserve

- Squash SHA `e3f0569` (PR #203); reviewed fix-branch commit `6526cb8` (byte-identical tree — verified `git diff 6526cb8 e3f0569` empty for the 4 files).
- **The belt lives at the vendor boundary (`openai.ts`), not the mapper** — a direct consequence of AUDIT-FIX-B1 A6 ruling #4. Any future "distinct-tag terminal at the vendor boundary" must be the FIRST catch branch (re-thrown via `instanceof ModerationUnavailableError`) to avoid reclassification into `upstream_failure`.
- Process: critical-path merge order is **PR → web Gate-C diff-read → operator merge**; #203 read post-merge (clean) — preserve the order going forward.
- B-lane carry-forwards: SPEC.2 §10 L1136 capture-site drift; the auditor `Boolean(flagged)` LOW.
