# SYNC-2 — session log

> **Task:** SYNC-2 · the doc truth pass. Recon → addendum → prod-migration read → execute.
> **Branch:** `chore/sync-2-truth-pass`, cut from `origin/main` @ `cde3f0a`.
> **Ritual:** CC-LIGHT, gated. `ultracode` FORBIDDEN — none used. No subagents.
> ⚠ **Not to be confused with `docs/logs/SYNC.2.md`** — a different, older file (354 lines, an earlier stratum). Target path confirmed absent with `git ls-tree origin/main -- docs/logs/SYNC-2.md` before this file was created.

---

## What landed

Four commits on `chore/sync-2-truth-pass`. **Scope boundary held mechanically at every commit** — `git diff --cached --name-only | grep -E '^(src/|tests/|drizzle/|\.github/|package\.json|public/)'` returned empty each time. **Zero bytes outside `docs/**`, `CLAUDE.md`, `AGENTS.md`, `README.md`.**

| Commit | Section | Files | Δ |
|---|---|---|---|
| `1d30f84` | **§A** — six verbatim replacements | `CLAUDE.md` · `AGENTS.md` · `docs/journey/README.md` · `docs/polish/POLISH-0_data-manifest.md` · `docs/polish/POLISH-register.md` | +14 −6 |
| `5c50bb1` | **§B** — five verbatim insertions | `CLAUDE.md` · `docs/parked.md` · `docs/runbooks/deploy-pipeline.md` | +88 −0 |
| `3fac695` | **§C** — five mechanical sweeps | `docs/logs/POLISH-4.md` · `docs/parked.md` · `docs/plans/POLISH-4.md` · `docs/polish/POLISH-TRACKER.md` · `docs/polish/POLISH-register.md` | +55 −131 |
| *(this file)* | session log | `docs/logs/SYNC-2.md` | — |

**§A.** `CLAUDE.md`'s V-space extent sentence and its SPEC.1 version citation both lose their transcribed numbers and become pointers. `AGENTS.md`'s PERF-1 paragraph is replaced — Discovery is fast and PERF-1 is closed, with the production caveat kept so one false statement is not swapped for a differently-scoped one. `POLISH-0_data-manifest.md`'s header moves v1.7 → v1.8, catching up with its own amendment record. `PD-3-11`'s title cell stops asserting that `error.tsx` is absent. `docs/journey/README.md`'s first fetch block is fenced and its command matched to the second.

**§B.** `O-11` (every CC → web reply is a file, uploaded not pasted) and `O-12` (a routed item inherits its location, not its defect class) are minted in `CLAUDE.md` §8. `#### 5.13.2` explains what the fourteen `DO NOT MERGE` squash subjects on `main` mean and rules the marker into the PR body going forward. `docs/runbooks/deploy-pipeline.md` gains the force-push staging-advance section. `docs/parked.md` gains the `REGISTER-APPLY` row it never had.

**§C.** Five `O-10` citations move to `O-12` and their "not numbered" hedges go with them. The PERF-1 strike, its retention sentence and its 113-line struck body row are deleted. Three trigger-less docket rows gain triggers. Thirteen fired-but-unpaid rows are marked. `POLISH-TRACKER.md` is retired by header, body byte-unchanged.

---

## ⚠ CARRY-FORWARD — PRODUCTION AND STAGING MIGRATION STATE, MEASURED

**This section exists so the next session does not re-measure production.** Every figure below was read from the live databases on **2026-08-18** in a read-only pass (`SELECT` / `SHOW` / one session-local `SET default_transaction_read_only = on`, verified `on`). **No write of any kind was issued against either database, in that session or in this one.** Full evidence: `zz_SYNC-2_prod-migration_2026-08-18T0626.md` (317 lines, md5 `9ede6f271fdbdd1bd8d1b2d73b6db202`).

The applied-migrations table is **`drizzle.__drizzle_migrations`** — confirmed against the live catalogue on both databases before querying, columns `id integer` / `hash text` / `created_at bigint`. `drizzle.config.ts` sets no `migrationsTable` override.

### Production

- **Head: `0019_market_media`**, applied **2026-06-30T15:23:05.700Z** (`created_at` 1782832985700).
- **20 applied rows. Ledger clean** — every hash matched a file on `origin/main` exactly and every `created_at` matched that file's journal `when`. **No orphan row, no rewritten migration.**
- **Five behind `origin/main`**, enumerated rather than counted:
  `0020_dharma_ledger_seq` · `0021_truncate_guards` · `0022_bet_receipts` · `0023_positions_market_id_idx` · `0024_bookmarks`
- **All five are EXPAND-PHASE.** Zero `DROP`, zero `ALTER … DROP`, zero executed `TRUNCATE`, zero type narrowing, zero `NOT NULL` on a pre-existing column. *(`0021`'s many `TRUNCATE` mentions are trigger event clauses — it creates the guards.)*
- **None is re-runnable** — no `IF NOT EXISTS` anywhere in the five; the only idempotent construct is one `CREATE OR REPLACE FUNCTION` in `0021`. **The journal, not the schema, is the authority on what has run.**
- **Prod holds no participant data:** `users` 0 · `markets` 0 · `bets` 0 · `comments` 0 · `positions` 0 · `dharma_ledger` 0 · `events` 1. `0020`'s identity-column rewrite therefore lands on an empty table.
- **Missing exactly two tables vs staging:** `bet_receipts`, `bookmarks`.
- **`/api/health` reports `migrations: "ok"` and that is CORRECT, not reassuring** — the guard compares the DB journal against **the journal baked into the build being served**, and that build (`a61859a`, 2026-07-02) also ends at `0019`. **It is not a statement about `main`.** The same endpoint reports `region: null` on production against `bom1` on staging.

### Staging

- **Head: `0024_bookmarks`** (`created_at` 1784579785405, 2026-07-20T20:36:25.405Z). **Level with `main`. Nothing unapplied.**
- Its `__drizzle_migrations` **`id` column skips 9–13** — residue of the documented `55P04` enum retry that `scripts/migrate-prod.ts`'s docblock exists to prevent. All 25 files are present exactly once by hash. **No repair is owed.**

### ⚠ The one line that governs the promote

**ADR-0024 is migrate-before-serve.** On the DP.2 promote, migrations **`0020`–`0024` apply to production BEFORE the new build is aliased**, not after. The DB leads the code. `docs/runbooks/deploy-pipeline.md` §3 is the sequence; `scripts/migrate-prod.ts` (per-migration transaction, resumes from the last committed row) is the applier — **not** `drizzle-kit migrate`, which wraps all pending migrations in one transaction.

### Also measured, and load-bearing for `O-4`

- `git diff --stat origin/main origin/staging` at the time of the recon addendum was **non-empty but PURE DELETION** — 14 files, 3 057 lines, **zero `src/`, zero `drizzle/`**, one `tests/` file, nine `docs/`, three repo-root. The 29-vs-4 commit asymmetry is a **squash artifact**: the 29 staging-only commits reconstruct `6272d5b`'s tree byte-for-byte and contribute **no content difference**. Merge-base `1b5423b` (#347).
- **The production alias serves `a61859a`** (`dpl_7oyjVmD7WQR4YLsXkdzMiAocsr9i`), commit #193 of 2026-07-02, **157 commits behind `main`**. Expected under `autoAssignCustomDomains: false` — a `main` push builds a production-target deployment but does not alias it. Ten `main` deployments existed in a 39-hour window, all built, none promoted.
- **`O-10` is being followed and works.** Across thirteen consecutive pushes the `staging` deployment was created 4.6–7.6 s **before** the branch deployment; staging went `READY` every time and the branch build was `CANCELED` every time. ⚠ Vercel **cancels** the second build rather than **skipping** it — `O-10`'s text says "skip", the records say "create then cancel". Not reconciled here.

---

## Decisions made

1. **The pack is committed verbatim; every disagreement with the repository is reported, not reconciled.** Ten flags are recorded in the execute report. The ratified handling — *"the repo is the fact and this pack is the instruction — commit the instruction, report the fact"* — was applied without exception.
2. **`A.2` was applied despite its anchor being absent as a literal string.** The pack wrote the anchor with its own markdown bold around the number (`**1.0.32**`); the file has no bold. The underlying target `` `SPEC.1` (product, 1.0.32) `` is **unique** in the file, so the match was exact-substring and deterministic — not proximity and not a line number, which is what the anchor rule forbids. Recorded as a judgment call, reversible in one line.
3. **`C.1` changed FIVE sites, not six.** The sixth (`docs/plans/POLISH-4.md:42`) is a **next-free allocation cell** in a landed plan, not a citation of either rule. Writing `O-12` there would replace a correct-at-the-time snapshot with a false statement. Left and reported, per the pack's own ambiguity rule.
4. **`C.3` HALTED for `CANON-D18-ROWS-UNAUTHORED`** — that row already carries a `**Conditional trigger — ⚠ PARTLY DISCHARGED AT DOC-1.**` line, in an em-dash form the recon's colon-only pattern could not see. Appending would have given one row two contradictory trigger statements. Three of four applied.
5. **`A.3` committed without its blockquote marker**, because the pack's replacement carries none and A.4 — the neighbouring item — explicitly instructs preserving one where it wants it preserved. Reconciling A.3 against A.4 is exactly what verbatim-and-flag forbids.
6. **No section marker in the PR title.** This PR is the first to honour `§5.13.2`, which it mints: the gate lives in the PR body.

---

## Open questions

1. **`A.3` — was dropping the `> ` blockquote deliberate?** One-line fix either way; not decidable from the pack.
2. **`A.5` — `PD-3-11`'s evidence cell now contradicts its own title cell.** The title says `error.tsx` shipped; the evidence cell two columns right still says the directory *"contains only `page.tsx`, `export/route.ts`, `quote/route.ts`"*. The pack forbade touching other cells. **Needs a follow-up line.**
3. **`B.4` vs `§2.5` in `docs/runbooks/deploy-pipeline.md`.** The new section says a non-fast-forward is normal and is handled by force-pushing; §2.5's precondition (b) and its step 1 say a non-fast-forward means staging diverged and must be investigated before anything is touched. **Both are on `main` and they disagree.** `O-5` binds — *a durable amendment is applied at every site that states the superseded position* — and the pack did not authorise touching §2.5.
4. **`C.5` routes surface state to `tracker_v21`, which this repository has never mentioned.** `CLAUDE.md` §1 still names `tracker_v20.html`; `docs/` cites thirteen distinct `tracker_vN` versions, most-cited `v11` (29) then `v20` (19). The tracker is operator-maintained and external, so none of these is resolvable from `main`.
5. **`CLAUDE.md` now contains `DO NOT MERGE` twelve times**, all inside §5.13.2. Any later pack reusing *"zero occurrences"* as a pre-flight gate will halt. Correct behaviour; recorded so it is not read as a regression.
6. **The five `REGISTER-APPLY` rows are still unapplied**, and `SP-2` (a `CHECK (share_quantity > 0)` on `bets`) is a DDL decision that has sat since 2026-08-06 needing an ADR. **The ADR ceiling has not moved: `0036`, next free `0037`.**
7. **`docs/logs/POLISH-5.md` and `POLISH-6.md` remain absent** and stay absent by ruling — a log written now by someone who was not in the session is fabrication, not filing. **This log records the absence, which is the whole remedy.**

---

## Next session starts at

**Gate C — a web diff-read of PR `chore/sync-2-truth-pass`.** ⛔ **DO NOT MERGE before it.** The diff travels as an uploaded file, not as a paste. The exact next action: read the ten flags in `zz_SYNC-2_execute_2026-08-18T0640.md`, rule on open questions 1–4, and either ratify or reverse `A.2`'s anchor judgment and `C.1`'s left-behind sixth site.

**After merge, in order:** (a) advance `staging` per the new `deploy-pipeline.md` section — ⚠ **read the tree, never the log**, and honour `O-10` on the SHA chosen; (b) DP.2 remains a separate gated task and carries **three** blockers, not two — `POOL-2`'s `BETTER_AUTH_SECRET`, `R2-412-DEPLOY-GATE`, and the four `/m/[slug]` placeholders — plus the five-migration apply above.

---

## Context to preserve

- **Ground was `cde3f0a` and was asserted, not assumed**, before the branch was cut.
- **`just verify` was green before all three section commits — and the receipt is vacuous for this diff.** Biome 2.4.13 has no markdown support and runs `ignoreUnknown: true`; of the 731 files it checked, **none** is a file these commits touched, and `tsc`/`next build` read none of them either. This is `docs/parked.md`'s `MARKDOWN-UNGATED-BY-CI` row happening on the PR that row would have caught. **Green here is a true statement about the repository and says nothing about this change.**
- **Every pack block was extracted programmatically from the pack file and never retyped**, then re-counted in its destination (each present exactly once). **`B.4` required anchor-based extraction rather than fence-matching**: its block contains a nested ` ```bash ` fence inside the pack's own ` ``` ` fence, and a non-greedy fence match would have committed 6 of 34 lines while appearing to succeed.
- **The `Instructions for AI` block was extracted from `CLAUDE.md` §5.13.1's own fence** for every commit message and verified byte-identical in each — never retyped, per §5.13.1.
- **`docs/polish/POLISH-TRACKER.md`'s body is byte-identical below the new header** — verified line-by-line against `origin/main`, 200 lines both sides.
- **`docs/parked.md`'s deletion is fully accounted for:** 117 lines removed = 113 (struck body row) + 1 (struck SEQUENCE row) + 3 (the note paragraph, re-emitted as 2). Ten surviving `PERF-1` mentions are live cross-references; **no dangling anchor to the deleted section exists.**
- **Nothing was deployed, aliased, promoted or pushed to `staging`. No database statement of any kind was issued in this session.**

---

## Time

2026-08-18, 06:40 → 07:2x UTC (12:10 → 12:5x IST). Single session, four commits, one PR opened and left unmerged for Gate C.
