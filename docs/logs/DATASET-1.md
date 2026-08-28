# DATASET.1 — session log

**Task** DATASET.1 · public dataset export pipeline + shared egress guard layer
**Branch** `feat/dataset-1-export-pipeline` · **Base** `origin/main` @ `acb71cb`
**Mode** autonomous overnight run (doctrine v1.0 + DATASET.1 brief v1.0)
**Date** 2026-08-28

---

## What landed

The offline export pipeline SPEC.2 §19 has contracted since PRECURSOR.3 and
nobody had built — tracker §9 N1's *"THE DATASET EXPORTER DOES NOT EXIST"*.
Built behind a shared egress guard layer that goes in first, so neither
artifact could be written against a guard authored to accommodate it.

| Slice | What | Files |
|---|---|---|
| 0 | `main`↔`staging` divergence measurement | report only — read-only, nothing changed |
| 1 | `src/server/export/egress/` — the shared guard layer | `errors` `forbidden-keys` `scan` `assertions` `index` |
| 2 | STRIP-rule completeness guard | `egress/completeness.ts` |
| 3 | Table inventory + per-column treatment map | `dataset/inventory.ts` `dataset/treatments.ts` |
| 4 | STRIP pipeline over `events.payload` | `dataset/strip.ts` |
| 5 | Export-time JOIN pseudonymization | `dataset/pseudonymize.ts` |
| 6 | CSV writer + deterministic tarball + manifest | `dataset/csv.ts` `tar.ts` `build.ts` `source.ts` |
| 7 | Debate `.md` artifact class (P2 shipped) | `dataset/debates.ts` |
| — | Reactive-removal masking (reviewer C-1) | `dataset/removed.ts` |
| — | Operator entry point | `scripts/build-dataset.ts`, `pnpm dataset:build:fixture` |

Fixture: `tests/_fixtures/dataset/dirty-source.ts` — a literal table carrying
one events row per each of the 24 `EVENT_TYPES` plus row sets for all 16
shipped tables, every one deliberately populated with the keys the strip must
remove.

**PR:** opened against `main`, left UNMERGED (brief D7 — it sits past
15 September; Gate C on it is November work).

---

## Decisions made

1. **Appendix B is the authority, not §19.4's ten-column table or §19.5's
   six-bullet list.** Both read like inventories and neither is exhaustive.
   Building from §19.5's list ships three tables of raw `users.id`.
2. **Four-way inventory** (`SHIPPED` / `NOT_SHIPPED` / `UNDECIDED` /
   `EXCLUDED`). §19.3 row 22 refuses to bucket `lots`; a two-bucket map would
   have this pipeline invent a founder decision.
3. **Five documented divergences from the spec**, each with its reasoning in
   the source beside the code:
   - `payload.userId` stripped from `user.tos_accepted` (§19.4.1 omits it while
     stripping it from all four siblings; a raw `users.id` in a CC-BY artifact).
   - §19.4.1's payload rules applied to `admin_events` / `user_events` too.
   - `admin_session` `aggregate_id` redacted (B.13 ships it raw while §19.4.1
     strips the same bytes one field over).
   - `metadata.actor_id` treated uniformly per B.13 (B.11 and B.12 each say
     something different for the same key).
   - **Reactively-removed comment bodies withheld** — see C-1 below.
4. **`ultracode` / dynamic workflows NOT used.** CLAUDE.md §6 defaults them
   FORBIDDEN absent a web-Claude PERMITTED at kickoff; the brief states none,
   and the task carries ordered proof obligations, failing the fourth condition.

---

## Open questions — owed to the web lane / founder

| # | Question | Why it cannot be settled here |
|---|---|---|
| 1 | **Do reactively-removed comment bodies ship?** | Built to WITHHOLD. Appendix B.6 marks `body` SHIP and §19 predates ADR-0021's reactive-moderation model, so the release contract never contemplated removal. Publishing is unrecoverable; withholding costs a rebuild §19.1 already allows. Needs a ruling. |
| 2 | **Does `admin_session` `aggregate_id` ship raw?** | B.13 says yes; §19.4.1 strips the same value from `payload.sessionId` one field over, and §19.3 withholds the whole `admin_sessions` table as privacy-sensitive. Redacted here pending a ruling. |
| 3 | **`metadata.actor_id` — rename or value-rewrite?** | B.11, B.12 and B.13 give three different answers for one key. Nil impact today (both tables empty); live the moment either gains a writer. |
| 4 | **`user_events` has ZERO writers and nothing records it.** | Identical defect to `ADMIN-EVENTS-WRITER`, which has a parked entry, a founder fork and a 2026-09-15 date. `user_events` has none of those. The ruling needs to cover both tables. |
| 5 | **`lots` — SPEC.1 G3.** | Unchanged; the pipeline classifies it `UNDECIDED` and does not export it, which is not a ruling that it should not be. |
| 6 | **`main`↔`staging` reconciliation.** | Slice 0 measured it; someone else rules it. 41 files exist only on `staging`, 17 of them `src/` product code. |

---

## Next session starts at

**Read the run report first** —
`~/Downloads/zz_DATASET-1_run_2026-08-28T0745.md`. It carries the ambiguity
register, every reviewer finding and disposition, and the run's own errors.

Then, in order:
1. Rule open questions 1–3 above (they are the only things blocking this PR
   from being a clean merge; all three are documented divergences, each
   reversible in a few lines whichever way it goes).
2. Gate C on the diff — the report is not a substitute (doctrine §9).
3. The live `DatasetSource` (a drizzle reader) is **not built** and is the
   release task's; it needs its own reviewer pass.

---

## Context to preserve

- **The pipeline has never touched a database.** Every guard runs against the
  local dirty fixture, deliberately (brief §3): over real data an absence
  assertion cannot distinguish *"the strip worked"* from *"there was nothing to
  strip"*. Production was never contacted; staging was never written.
- **The tar writer is hand-rolled and deterministic.** Not a dependency
  decision to revisit casually — the manifest publishes a checksum and system
  `tar` stamps mtime/uid/gid, so identical data would hash differently per
  machine. `content_sha256` (the uncompressed tar) is the hash that does not
  move; `tarball_sha256` verifies downloaded bytes but is not stable across
  zlib versions.
- **`EVENT_TYPES` moved** to `src/server/events/event-types.ts` (no
  `server-only`), re-exported from `schemas.ts` so every import site is
  unchanged. This is what lets the operator script run under plain `tsx` per
  AGENTS.md §7 instead of arguing for a second `--conditions=react-server`
  exemption.
- **`docs/` was not edited** beyond this log and the plan. No spec amendment,
  no ADR, no tracker — all flagged in the report instead (brief §5 walls 4–5).

---

## Time

Single overnight session, 2026-08-28, ~07:45 UTC onward.
