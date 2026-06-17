# DEBATE.3 — Side-binding immutability (INV-3) — execute-session record

> **Status:** executed on `chore/debate-3`; held for web diff-review + founder ratification before squash-merge.
> **Date:** 2026-06-17
> **Author:** Claude Code (execute), reviewed at the plan gate + diff gate (web).
> **Plan:** `docs/plans/DEBATE.3.md` (this PR).
> **Branched off:** `main` `233c3e0` (#138).
> **PR / canonical SHA:** PR #139; squash-merge SHA on `main` filled at merge.

---

## Scope + outcome

DEBATE.3 = the INV-3 side-freeze obligation. Recon found it **already delivered in both
halves**, so this task **proves and ratifies** rather than builds:

- **Immutability** — `comments` is a full **Bucket A** append-only table (SCAFFOLD.2 3.C,
  `0003_append_only_triggers.sql:48-49`). The whole-row `bucket_a_no_update` trigger raises
  `P0001 "UPDATE not permitted"` on any UPDATE, so `side_at_post_time` is immutable. SPEC.2
  §6.5 names this exact mechanism (*"INV-3 … via append-only `comments`"*).
- **Capture** — `side_at_post_time = side` is written at INSERT inside the W-1 bet tx
  (`src/server/bets/place.ts:133`), built at **DEBATE.2** (#136).

The kickoff's proposed **column-scoped** trigger (rejecting `side_at_post_time` while
*allowing other column updates*) was **refused** as an append-only weakening: it would relax
`comments` from full Bucket-A immutability, and there is no legitimate post-insert UPDATE
path to `comments` to justify it (the only flow UPDATEs are `image_uploads` Bucket-B and
`pools` Bucket-C; `image_uploads_id` is set at INSERT). Web review ratified the reframe.

---

## What shipped (this PR)

1. **`docs/plans/DEBATE.3.md`** — the reviewed plan.
2. **ADR-0005 patch (web-authored, verbatim):** a new `## Patch record` section (placed as
   ADR-0013 places its — after the metadata table, before the first `##` content section)
   recording that INV-3's side-freeze IS the `comments` Bucket-A guarantee and the
   column-trigger approach is rejected; plus an exact find/replace of the stale line-263
   INV-3 table cell (*"ADR-0013 / DEBATE.3 own the post-time-side capture itself"* → the
   capture was built in DEBATE.2, `place.ts:133`).
3. **One named I-SIDE-BIND-001 assertion** —
   `tests/invariants/I-SIDE-BIND-001.comment-side-bound-at-post-time.spec.ts` gains
   `comment-side-bound::direct-update-of-side-at-post-time-rejected`: seed a comment, then
   `UPDATE comments SET side_at_post_time = 'NO'` →
   `.rejects.toMatchObject({ code: "P0001", message: …"UPDATE not permitted" })`. A
   **regression guard** (the mechanism already ships → green from day one), not a TDD driver
   (AGENTS.md §9). The flow `it` is the FLOW half; this is the STORAGE half, in the canonical
   invariant home with the named P0001.
4. **`docs/logs/DEBATE.3.md`** — this record.

**No `src/` change. No migration. No schema delta. No new event type.** Subagents not
invoked (test + docs only; no `src/server/` or schema diff → §5.11 not triggered).

---

## Key rulings (with rationale)

- **Reframe ratified (web).** Build nothing; prove + ratify. INV-3 is delivered by the
  stronger whole-row Bucket-A guarantee, not a column trigger.
- **OQ1 → ADD the named assertion (not doc-only).** The `tests/scale/side-bind.scale.test.ts`
  column-targeted UPDATE is **not** a substitute: wrong location (`tests/scale/`, not the
  invariant home), weak (bare `.rejects.toThrow()`, not the named P0001), and behind the
  24-user / degree-32 storm gate (outside `pnpm test:invariants`).
- **OQ2 → home confirmed** = `I-SIDE-BIND-001.comment-side-bound-at-post-time.spec.ts`.
- **Decision 2 → web-authored ADR-0005 §5.12 patch-record**, integrated verbatim; CC does
  not author the decision text.
- **STEP 5(b) refused** — "a legitimate UPDATE to a different column succeeds" has no
  satisfying caller and would require weakening the append-only table (§2).

---

## Stale-doc reconciliation
- **ADR-0005 line 263** — corrected by the web-authored patch (this PR).
- **DEBATE.2 close-out line 77** (*"the trigger is not built"*) — stale: the Bucket-A trigger
  shipped at SCAFFOLD.2 3.C (`0003`). Recorded here; the merged DEBATE.2 log is not rewritten.
- **Tracker row** — external operator-maintained HTML; flipped by the operator, not in-repo.
- **SYNC backlog (noted, not fixed — §5.4):** AGENTS.md §3 still calls `src/server/comments/`
  greenfield (it exists since #136/#137); AGENTS.md §9 omits `tests/scale/`.

---

## §5.9 fields

- **What landed (files + PR#):** `tests/invariants/I-SIDE-BIND-001.comment-side-bound-at-post-time.spec.ts`
  (one `it`), `docs/adr/0005-postgres-event-sourcing.md` (web-authored patch),
  `docs/plans/DEBATE.3.md`, `docs/logs/DEBATE.3.md`. PR #139.
- **Decisions made:** Option A (delivered-by-construction, no trigger/migration); Option 2
  (web-authored ADR-0005 patch); OQ1 (add the named assertion); OQ2 (invariant-home).
- **Open questions:** none blocking. (DEBATE.7 moderation-state, DEBATE.8/9 vestigial drops
  remain separately sequenced.)
- **Next session starts at:** post-merge — flip the DEBATE.3 tracker row after the
  tree-content proof (`git diff <reviewed-SHA> origin/main` empty + the new `it` present on
  `main`); then the next DEBATE-phase row per the tracker.
- **Context to preserve:** INV-3 is delivered by the `comments` whole-row Bucket-A trigger
  (SPEC.2 §6.5), capture at `place.ts:133` (DEBATE.2); the column-scoped trigger was refused
  as a weakening; head stays `0015`, EVENT_TYPES 23, zero migration delta.
- **Time:** plan (recon + reframe + AskUserQuestion) → web review → execute (test + docs) →
  full verification → hold for diff-review, single session (2026-06-17).
