# AUDIT-FIX-B7-A26 — session log (close-out)

**Task:** the A26 freeze-TOCTOU accepted-window ruling — doc-only commit of the web-authored riders
package (B7 decision 5a, founder-ratified 2026-07-06). One chat across four relays (verify-live recon →
§2 precedent re-quote → execute → close-out). No code, no migration, no ADR, no version bump.

## What landed

- **PR #209, squash `ae489a6`** (canonical SHA on main). Branch `docs/b7-a26-freeze-window`: remote
  auto-deleted at merge (`ls-remote` empty at the close-out check — the inconsistent-auto-delete memory
  check was run, nothing to clean); local `-D` after the empty tree-proof
  (`git diff 6d4997c ae489a6` empty; §20.2 accepted-window guard line grep-confirmed on main).
- **Ruling record** `docs/plans/AUDIT-FIX-B7_A26-freeze-window-ruling.md` — web-authored, committed
  verbatim (85 lines, tail-verified).
- **Three SPEC.2 riders**, every content anchor byte-verified unique against pre-merge main (`c3e42e9`)
  before editing:
  - **§20.2 insert** — the freeze accepted-window clause (after the middleware paragraph, before
    **Wire envelope.**): gate is a single pre-tx read; W-1 never re-reads `system_state`; window bounded
    by in-flight handler lifetime, seconds-class, no value minted (HARDEN/runbook); two practical caps
    (W-1 market-`Open` re-check → R-14.3 close-lag bound at the terminal configuration; §19.1 build point
    post-dates the drain).
  - **§19.1 boundary** — source-of-truth realigned freeze instant → **dataset-build point**; three
    legitimately-post-freeze row classes named (§20.3 admin conclusion work, §20.3 still-live auth
    surface, §20.2 A26 window commits); the release no longer claims zero post-`frozen_at` participant
    commits (the old "(which §20.2 forecloses anyway)" sentence was internally contradicted by §20.3's
    own post-freeze admin-work promise).
  - **§19.2 replica target** — freeze-snapshot replica → build-point replica (PITR repointed to the
    §19.1 dataset-build point).
- **parked.md** SYNC-sweep entry extended: SPEC.2 §0 bump owed for the B7-A26 riders (**target 1 only** —
  no SPEC.1 touch, no new ADR, no §22/footer delta). §0/§22 untouched per kickoff.
- **Mirror check result:** `docs/runbooks/dataset-release.md` carried NO old-boundary language (its
  pre-export step already sits at "2026-11-06 morning" — consistent with the build-point boundary);
  `conclusion-event-freeze.md` does not exist yet (HARDEN.10); grep across docs/ (excl. SPEC.2, logs,
  plans) found zero boundary mirrors. No mirror edits were needed in #209.
- **This log PR:** the dataset-release.md step-5 drift fix (below) + this log.

## Decisions made

- **Founder ratification (web, 2026-07-06, B7 decision 5a):** ACCEPTED-WINDOW; no code; W-1 untouched;
  no bound value minted; no ADR (mirrors the R-14.3 close-lag plan-ruling precedent — plan-doc ruling +
  SPEC.2 anchor clause; ADR ceiling stays 0031).
- **§19.1/§19.2 realignment folded into the ruling** (web discovery): the snapshot boundary was never the
  freeze instant — it is the dataset-build point §20.3 already ratified; the A26 window slots in as the
  third (smallest) legitimately-post-freeze row class.
- **CC execution decisions:** branch used the kickoff-named `docs/b7-a26-freeze-window` (matches the
  in-house `docs/` prefix precedent — `docs/engine-14-plan` et al.); in the step-5 drift fix the same
  sentence's stale section pointer was corrected alongside the ratified code/status swap (`§3.5` →
  `§20.2` — the kickoff's own named source of truth; surfaced in the PR body, one sentence, one drift).

## Drift surfaced at B7-A26 mirror check, fixed here

- `docs/runbooks/dataset-release.md` step 5 said the freeze guard returns **`error_system_frozen`** and
  the curl spot-check expects **503**; SPEC.2 §20.2 + live code (`runBetEndpoint` step 1.5 →
  `error_experiment_concluded`, HTTP **410** Gone, `retry_semantics: do_not_retry`) disagree. Fixed in
  this log PR — descriptive-doc correction, CC-authored, no spec change.
- **Residual, untouched (sweep class):** step 4's "Per SPEC.2 §3.7" freeze-boundary cite (the freeze
  mechanism is §20.2); SPEC.2 §20.2's "handler-stack step 1" vs live step-1.5 placement (already noted
  in the ruling doc §6). Both are step-numbering/pointer drift for the next sweep, not this PR's.

## Ritual

- Doc-only, non-critical path: no subagent cascade (§5.11 — not invoked for non-critical/doc work), no
  plan file (doc-only exemption §5.1). Gates run anyway: all three rider anchors byte-verified unique
  against live main pre-edit (zero mismatches — no STOP fired); `ZUGZWANG_ENV=preview just verify` green
  on #209; write-tail delimiter check clean; single commit per kickoff; commit SSH-signed.
- STOP-condition sweep before execute: no in-flight branch/PR touched §19/§20 (sole open PR #146 touches
  no spec files); working tree proven == origin/main before branching.

## Open questions

- None for A26. **B7 remainder awaits operator ratification of the verified split:** B7a = A14 + A24
  (A27 DROPPED — CLOSED by ADR-0031 row 13's deliberate bug-class 500 posture, pinned by
  `wire-envelope::unknown-error-still-falls-through-to-500`); B7b = A31 + A33 + A29 + A32 + A35. A29
  routing (B7b vs the ENGINE.8 Q4 forward "error-envelope / HARDEN" deliverable that already owns the
  uploads/sign bare-`{error}` gap) is the operator's call — no dedicated error-codes task exists in-repo.

## Next session starts at

B7a or B7b execute per operator ratification (the verify-live report is already delivered — nine finding
statuses, migration surface, precedent quotes). Fresh chat + `/clear`, read the kickoff, VERIFY-LIVE
against the then-current main.

## Context to preserve

- **A33 mechanism (established empirically at recon — do not re-derive):** drizzle-kit generate diffs
  schema vs the PREVIOUS SNAPSHOT (no snapshot-only mode); the 0022 snapshot tracks `checkConstraints`
  (5 tables) and `image_uploads` is `{}` there; the live DB constraint is the AUTO-NAMED
  `image_uploads_byte_size_check` (0006's unnamed column-level CHECK). Approach: name-matched `check()`
  in schema → `just db-generate` → hand-neutralize the generated SQL pre-commit (comment no-op or
  guarded DO block); fresh-DB CI stays consistent because 0006 creates the constraint.
- **A31:** migration head 0022; plain `CREATE INDEX` — CONCURRENTLY is both unnecessary (pre-launch,
  tiny tables) and incompatible with the per-migration-tx runner (drizzle-kit migrate + ADR-0022
  `db:migrate:prod`).
- **Freeze-window facts the ruling encodes:** window = `isFrozen()` read → W-1 COMMIT (spans moderation
  HTTP + W-1 statement/retry budget); the close-lag analogue is cadence-bounded, this one is
  handler-lifetime-bounded; the freeze flip itself is pg_cron Path A / manual Path B (HARDEN.10 — the
  `freeze_cron` migration is not yet on disk).
- **PK staging:** `~/Desktop/zz-pk-refresh-B7-A26/` — 5 files, md5-verified (table below).

## PK update table

| File | State | Keep/Verify/Add/Remove | Reason |
|---|---|---|---|
| `SPEC.2.md` | main @ `ae489a6` | Verify (replace stale PK copy) | carries the three A26 riders (§20.2 insert · §19.1 boundary · §19.2 replica) |
| `parked.md` | main @ `ae489a6` | Verify (replace stale PK copy) | SYNC-sweep entry extended with the B7-A26 §0 debt (target 1 only) |
| `AUDIT-FIX-B7_A26-freeze-window-ruling.md` | main @ `ae489a6` | Add | new ruling record (web-authored, committed verbatim) |
| `dataset-release.md` | `chore/b7-a26-log` (this PR) | Add | step-5 freeze code/status/§-pointer drift fix (410 `error_experiment_concluded`, §20.2) |
| `AUDIT-FIX-B7-A26.md` | `chore/b7-a26-log` (this PR) | Add | this log |

## Time

2026-07-06, single chat, four relays: verify-live recon (nine findings + close-lag/freeze precedent +
migration surface) ≈50 min · §2 precedent re-quote ≈5 min · execute (ruling doc + three riders +
parked.md + gates + PR #209) ≈30 min · close-out (drift fix + log + PK staging + branch cleanup) ≈20 min.
