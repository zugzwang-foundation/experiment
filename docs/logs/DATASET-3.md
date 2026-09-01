# DATASET.3 — session log

**Task** DATASET.3 · deny-by-default payload strip, provenance partition, and the
remaining ratified rulings
**Branch** `feat/dataset-1-export-pipeline` — CONTINUED · **PR** #435, **OPEN and
UNMERGED**, base `main`
**Run** 2026-09-01T20:41 → 2026-09-02 UTC, autonomous overnight
**Report** `~/Downloads/zz_DATASET-3_run_2026-09-01T2041.md`
**Plan** `docs/plans/DATASET-3.md`

---

## What landed

Thirteen commits, `92f30d5` (the `main` merge) → `aaa14da`.

| # | SHA | Substance |
|---|---|---|
| 0 | `92f30d5` | **The merge.** 111 commits of `main` taken in. ONE conflicted path, `.gitignore`, resolved by UNION (82 lines = 71 base + 4 branch + 7 main; both entries survive; `pnpm dataset:build:fixture` then leaves `git status` empty) |
| 1 | `542dea0` | **Ruling E — the payload strip inverts to a positive allow-list.** `PAYLOAD_SHIP_KEYS` is a per-event-type TREE; everything undeclared is dropped unread at any depth and through arrays. `true` ships a scalar and THROWS on a container |
| 2 | `4264b6f` | **Ruling S1 — needle provenance partitions fatality.** Fatal iff the needle is system-sourced OR the hit landed under a field it was harvested from |
| 3 | `006a742` | **Rulings S2 + I.** `idempotency_key` stripped from column and metadata; `STRIPPED_COLUMNS` derived from `COLUMN_TREATMENTS`, harvest bound by a `satisfies` compile error |
| 4 | `fcfd8e6` | **Rulings S6 + B.** Timestamps at full stored precision (six digits, kept in the SQL); one `REPEATABLE READ, READ ONLY` snapshot for the whole build |
| 5 | `fcb69d1` | The four LOWs + **C7 measured** |
| 6 | `8a92208` | **`GET /api/dataset/manifest`** (§19.7, admitted on the text) + a repo-wide NUL-byte sweep |
| 7 | `bb9811f` | **F1–F5**, one commit, SPEC.2 → **1.0.29** |
| 8 | `f447bcb` | The new route admitted to the pinned handler inventory |
| 9 | `fd2de69` | `@security-auditor` findings fixed |
| 10 | `d3a88bd` | `@code-reviewer` findings fixed |
| 11 | `2170a07` | `@test-writer` repairs — eight guards that could not fail |
| 12 | `aaa14da` | **F-11 re-run** findings fixed; the label guard INVERTED after three wrong rounds |

**Gate at close:** `tsc --noEmit` **0** · `biome check .` **0** ·
`pnpm dataset:build:fixture` **0** · full suite **469 files / 4,787 tests, 0
failures**.

**G6 baseline** (merged `main` + branch, before any DATASET.3 work): 464 files /
4,679 tests. **Delta: +5 files, +108 tests.**

---

## Decisions made

1. **The byte-identity proof is NOT identity, and the delta is named.**
   `f4a45387…` → `bb20207a…` → `fd6934cd…`. Isolated by building an
   intermediate: **1 row of 27 moved for MECHANISM** (the fixture's undeclared
   `context`/`variants` on `image_upload.committed`), **2 more for POLICY**
   (ruling S5). 15 of 16 CSVs byte-identical throughout.
2. **The byte comparison is blind to every key the fixture does not carry**, and
   the fixture carries a minority of them. The assertion that CAN fail is
   `payload-ship-schema-parity.test.ts`, binding the declaration to
   `eventPayloadSchemas`.
3. **Slice 6 ADMITTED** — §19.7 states plainly what the endpoint is for and
   anticipates the GitHub-release path rather than conflicting with it.
4. **Ruling S1 needed two dimensions, not one.** Provenance alone downgraded
   `users.email`; the field-match half is what keeps a broken column strip fatal.
5. **The label guard is an allow-list**, after three deny-list rounds each of
   which traded a false negative for a false positive.

## Open questions — owed to a founder or web ruling

| # | Owed | Why not settled here |
|---|---|---|
| A | **`metadata.request_id` is the same channel as `idempotency_key`** — client-echoed, `^[A-Za-z0-9_-]{1,200}$`, unmoderated, SHIPPED. Ruling S2's argument applies verbatim | Stripping it is a policy decision SPEC.2 1.0.29 states the other way (*"four now ship"*), and the mechanism fix touches `src/server/bets/endpoint.ts` — a critical path |
| B | **`assertNoRawUserIds` has no tier**, so a participant posting their own `users.id` as a comment body aborts the release | S1 as ruled makes a system-generated needle fatal. Changing it is a founder call |
| C | **`comment.placed.bodyLength` ships for a removed comment**, so the archive states "this comment was removed and was exactly 72 characters" | Uniform, so no condition leaks. A release-note line or a ruling |
| D | **C7: the build CANNOT complete at 100k users** — `events.csv` exceeds V8's 536,870,888-char string limit at ~1.57M rows against a ~7.3M projection | Streaming needs an `AsyncIterable` seam through strip → pseudonymize → csv → the guards. Its own task, its own reviewer pass |

## Next session starts at

**Gate C on the #435 diff by the founder**, and rulings A–D above. Nothing is
blocked on code.

## Context to preserve

- **The night's shape:** every hole the reviewers found sat on a fix made
  tonight *after* an earlier reviewer named it — three inside the commit whose
  own message explains why the guard set could not see what it was fixing. The
  cheap tell remains: after writing a fix, revert it and watch a **named** test
  go red.
- **F-11 ran and returned its first clean pass** (no CRITICAL, no HIGH) after
  three rounds of findings. ⚠ The fixes made in response to it (`aaa14da`) are
  reviewed by nobody — that is F-11's own stated open limitation.
- Two stray NUL bytes were written into source files tonight, one of them
  committed, and every gate passed over it. `tests/unit/source-integrity.test.ts`
  now sweeps all 1,524 tracked text files.

## Time

~9 hours, autonomous.
