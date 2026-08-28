# DATASET.1 — public dataset export pipeline + shared egress guard layer

**Branch** `feat/dataset-1-export-pipeline` · **Base** `origin/main` @ `acb71cb`
**Lane** `DATASET.*` — the stratum SPEC.2 §19 defers implementation to.
**Mode** autonomous overnight run (doctrine `ZUGZWANG-OVERNIGHT-RUN_doctrine_v1_0.md`).
**Target** PR against `main`, left UNMERGED past 15 September (brief D7).

---

## 0 · The core idea, in prose

SPEC.2 §19 contracts a public research dataset published 2026-11-06 under
CC-BY-4.0. Tracker §9 N1: *"THE DATASET EXPORTER DOES NOT EXIST."* The runbook
at `docs/runbooks/dataset-release.md` describes a pipeline nobody has written,
and its step 2 — *"if an event_type exists in `EVENT_TYPES` but has NO §19.4.1
entry → STOP"* — is a manual human check scheduled for the morning of a
conference.

This task builds that pipeline, and builds it **behind a shared egress guard
layer that goes in first**. The ordering is the design, not the schedule: a
guard written after the pipeline it guards is written by someone who already
knows what the pipeline emits, and converges on asserting exactly that.

The artifact cannot be un-published. So the exit criterion is *provably correct
on its guards*, not *rehearsed against real data* — which is why the fixture is
local and deliberately dirty rather than a staging snapshot (§3 below).

---

## 1 · Ground, measured

| | Value |
|---|---|
| `origin/main` | `acb71cb21264238ea92919488b3028c0f53f6601` |
| Migration head | `0026_lots_no_delete` |
| `EVENT_TYPES` (runtime) | **24** |
| Live `pgTable` count (runtime) | **24** |
| EXPORT.1 (debate `.md` route + serializer) | **SHIPPED** — brief D2 applies |
| `src/server/{dataset,export}/` | absent — this task creates |

---

## 2 · What the specs actually say, and where they disagree with the brief

**Appendix B is the exhaustive per-column authority.** §19.4's ten-row table
and §19.5's six-bullet list both read like inventories and are not:

- §19.5's six omit `positions`, `payout_events`, `user_events` — all three ship
  and all three carry a raw `users.id`. Appendix B.4 / B.8 / B.12 mark each
  `PSEUDO`. B's coverage note settles it: *"every `user_id` / `target_user_id`
  FK gets rewritten"*.
- §19.4's ten omit `mod_actions.blocked_text` and `mod_actions.image_r2_key`,
  both `STRIP` per B.10. The second is an R2 key, and R2 keys embed the userId.
- §19.4's ten *include* `users.pfp_filename`, which B.1 marks `NULL_IF_ERASED`
  — it ships. The table is titled "columns dropped" and one of its rows is not.
- §19.3 is a **three**-bucket inventory (16 ship / 5 do not / `lots` UNDECIDED),
  plus 4 excluded from the inventory entirely.

⇒ **Everything derives from Appendix B, cross-checked against the live schema.**
Nothing derives from a prose bullet list.

---

## 3 · Why a local dirty fixture, not staging

Brief §3, and it is a positive-control argument rather than a convenience one.

A guard asserting *"no `ip` key survives"* proves nothing if the rows it ran
over never carried one. Against real data you cannot guarantee the forbidden key
was present pre-strip, so the assertion is equally consistent with *the strip
worked* and *there was nothing to strip* — OVN-V1, and OVN-V3's *a control that
cannot fire is not a control*.

`tests/_fixtures/dataset/dirty-source.ts` is therefore a **literal table** whose
every row deliberately carries every key the strip must remove: one events row
per each of the 24 `EVENT_TYPES`, plus row sets for all 16 shipped tables. It
throws at module load if `EVENT_TYPES` grows past its coverage.

Secrets use RFC-reserved values (`203.0.113.*` TEST-NET-3, `@example.invalid`)
so a value-based scan can never collide with real data or with prose.

---

## 4 · Slices — order fixed, commit boundaries may move

| # | Slice | Exit condition | Reviewer-bearing |
|---|---|---|---|
| 0 | `main`↔`staging` divergence | A section in the report. Read-only. | — |
| 1 | `src/server/export/egress/` — the shared guard layer | Every helper + its positive control; all mutations red | `@test-writer` |
| 2 | STRIP-rule completeness guard | A new `EVENT_TYPES` member with no §19.4.1 rule fails | `@test-writer` |
| 3 | Table inventory + per-column treatment map | An unclassified live `pgTable` fails | `@code-reviewer` |
| 4 | STRIP pipeline over `events.payload` | Each of the 5 named guards red on revert | `@test-writer` |
| 5 | Export-time JOIN pseudonymization | No raw `users.id` outside `users`; JSONB path covered | `@security-auditor` |
| 6 | CSV writer + tarball + manifest | Row counts counted from what was WRITTEN | `@code-reviewer` |
| 7 | Debate `.md` artifact class (P2 shipped ⇒ in scope) | Golden-fixture conformance; egress guards over output | `@security-auditor` |

**Full suite green at the end of every slice** — the full suite, not the
touched tests.

---

## 5 · File map

**Created**

| Path | Why |
|---|---|
| `src/server/export/egress/{errors,forbidden-keys,scan,assertions,index}.ts` | Slice 1 — the shared layer both artifacts pass through |
| `src/server/export/dataset/{inventory,treatments}.ts` | Slice 3 — §19.3 + Appendix B as a typed map |
| `src/server/export/dataset/{strip,pseudonymize}.ts` | Slices 4–5 — the two transforms |
| `src/server/export/dataset/{csv,manifest,build}.ts` | Slice 6 — writer, manifest, orchestrator |
| `src/server/export/dataset/source.ts` | The `DatasetSource` seam — fixture or drizzle |
| `tests/_fixtures/dataset/dirty-source.ts` | The dirty fixture (§3) |
| `tests/unit/export/**` | Every guard + its positive control |
| `scripts/build-dataset.ts` | The operator entry point |

**Read, never modified**

`src/server/debate-export/serialize.ts` · `src/server/debate-view/**` — Slice 7
consumes the existing renderer. Brief §5 wall 7 conditioned a prohibition on P2
finding these unbuilt; P2 found them built, so the prohibition does not bind —
but ADR-0025 rules this surface carries the moderation masking contract, so it
is consumed and never edited, and only its masked variants are touched.

**Not touched** — `docs/specs/`, `docs/adr/`, any tracker, any migration, any
DDL, `system_state`, production, staging.

---

## 6 · Ambiguities resolved, with the alternative rejected

Full register in the run report. The load-bearing ones:

1. **Pseudonymize from Appendix B, not §19.5's six bullets.** Rejected: build
   the six literally. That ships three tables of raw UUIDs and breaches brief
   §5's sixth wall, which is absolute.
2. **Four-way inventory (`SHIPPED`/`NOT_SHIPPED`/`UNDECIDED`/`EXCLUDED`).**
   Rejected: two buckets. That forces `lots` into a bucket SPEC.2 explicitly
   refuses to place it in.
3. **`users.pfp_filename` SHIPS.** Rejected: strip it because §19.4's table
   title says ten columns are dropped. Its own treatment cell says otherwise.
4. **Column FKs rename (`user_id` → `user_pseudonym`); `metadata.actor_id`
   keeps its key and rewrites its value.** §19.5 names a rename for the first;
   B.13 describes value-rewriting with the `'admin-singleton'` sentinel
   preserved for the second. A CSV cannot have a key that varies per row.
5. **`ultracode` / dynamic workflows NOT used.** CLAUDE.md §6 defaults them
   FORBIDDEN absent a web-Claude PERMITTED at kickoff; the brief states none,
   and the task carries ordered proof obligations (RED-first guards, a fixed
   slice order), which fails the fourth condition outright.

---

## 7 · Baseline

The pipeline is new, so there is no behavioural baseline to regress. What is
measured before and after is **the existing suite**, at the file/test level, to
prove this task adds without disturbing:

- Baseline captured at `acb71cb` before slice 1.
- Re-measured at the end of every slice, and reported as a delta.

The *pipeline's* own measurement is the manifest: per-table row counts counted
from the bytes written, never from the query that fed them.
