# GH-STAR-COMPACT — the star count's notation — execute close-out

Branch `feat/gh-star-compact`, base `main` @ `c58d64a`, run from the worktree `.claude/worktrees/gh-star-plan` (see *Surprises* — the fresh worktree the kickoff asked for was created, then consolidated here by patch when the harness refused to drive a tree outside the session's own). Not critical path: no schema, no migration, no engine contact, no file under `src/server/{bets,comments,dharma,resolution,auth}` — §5.10 and §5.11 do not fire.

**The task is one formatter.** The header quotes a number that belongs to GitHub, so it should carry GitHub's shape: compact at or above 1,000, exact below it. Founder-ruled 2026-08-19, reversing the grouped choice made at the original GH-STAR kickoff.

**The interesting part is not the formatter.** It is that the ruling's stated *mechanism* was false while its stated *outputs* were exactly right, and the two could be told apart without asking anyone — because the false mechanism contradicts the ruling's own examples as arithmetic. That is the reusable part, and it is why this log leads with it.

## What landed (files + PR#)

4 files. **PR #363**; squash SHA at merge.

- `src/components/shell/GitHubStars.tsx` — **MODIFIED.** `COMPACT_FORMAT` (`notation: "compact"`, `maximumFractionDigits: 1`) + a module-local `formatStarCount()` that lowercases at the formatter. `NUMBER_FORMAT` is unchanged and now serves **only** the `aria-label`. The docblock carries the measured rounding mechanism and the correction below.
- `src/components/shell/GlobalHeader.tsx` — **MODIFIED, comment-only.** The D1 deviation register's `427.20px` bullet, reframed from *worst case* to *upper bound*. **Zero JSX lines** — verified by filtering the diff for non-comment lines. **The fenced wrapper class string is byte-unchanged.**
- `tests/unit/shell/github-stars.test.tsx` — **MODIFIED.** 6 → 12 tests: T1 inverted, four new ruled tests, two added guards.
- `docs/logs/GH-STAR-COMPACT.md` — this log.

**Not touched, as ruled:** `src/server/github/star-count.ts` (`git diff origin/main -- src/server/` is **empty**), both layouts, the 0-vs-null contract, `docs/specs/`, `docs/adr/`. No spec or ADR mentions this control at all — grep-verified — so no §5.12 rider is owed.

## Decisions made

- **⛔ THE ONE THAT NEEDS THE GATE C READ: the ruled behaviour shipped; the ruled explanation did not.** The kickoff instructed, under *"COMMENT THIS, because it reads as a bug to the next person"*, that `Intl` compact **truncates** and that `1999` renders `1.9k`. It renders `2k`. Measured on the pinned runtime (Node v24.15.0 / ICU 78.2), on the exact config specified: `1949 → 1.9k`, `1950 → 2k`. Half-expand, not truncation.
- **The correction did not require a ruling, because the claim is self-refuting against the ruling's own examples — as arithmetic, on any runtime.** Truncation is reachable only via `roundingMode: "trunc"`, and that config renders `999999` as `999.9k`, contradicting the ruled `999999 → "1m"`. **No runtime can satisfy both the truncation claim and the five ruled outputs.** The five outputs are the ratified behaviour spec and they arbitrate; they are exactly what the instructed config produces. So the config ships verbatim, every ruled example is pinned by a test, and only the *mechanism's description* changed — written where the ruling asked the claim to go, at the formatter, with the measurement and the arithmetic beside it.
- **Proceeded rather than halted.** The ruled behaviour was fully determined and unambiguous, so a halt would have delivered nothing while resolving nothing. Writing the dictated sentence instead would have shipped a comment falsifiable in ten seconds — and, worse, inverted the founder's actual intent, since the note exists precisely to stop a later reader mistaking correct behaviour for a defect. **If literal truncation is wanted, that is a different ruling**: it changes `999999` from `1m` to `999.9k` and needs the example set reissued.
- **Two formatters, not one, and the disagreement is the point.** The `aria-label` keeps the exact grouped figure (`"54,321 stars"`) while the screen shows `54.3k`. Compact notation is paid for in width; an announced string is under no width pressure at all, so a screen-reader user is not made to trade precision for a constraint they were never under.
- **Lowercased in JS at the formatter, not in CSS.** `Intl` emits `K`/`M`; GitHub renders `k`.
- **`GlobalHeader` was touched, and the kickoff's conditional is why.** It said to touch the file *only* if its docblock names the grouped choice. It does: the D1 register stated a worst case of *"a six-digit count"*, which is the worst case only while the count renders grouped (`999,999`, seven glyphs). Corrected **in place** per **O-5** — an amendment written into the operative sentence, not appended elsewhere. Every measured figure is preserved verbatim; `427.20px` is reframed as an upper bound and deliberately **not** re-measured, because it can only overstate the zone and the conclusion it holds up is slack.
- **Two tests added beyond the ruled T1–T6, both surfaced as deviations rather than absorbed.** No ruled test was dropped, softened or reordered.

## Surprises caught + fixed in-session (wins)

- **⭐ THE FINDING: a ruling can be right about *what* and wrong about *why*, and the two are separable without a relay.** The five ruled outputs and the ruled mechanism were mutually inconsistent, and the inconsistency is decidable from the ruling alone — no runtime, no measurement, no founder needed to break the tie. Measuring first is what made it visible: the config was run against all five examples *before* a line of code was written, which is the only reason the contradiction surfaced at write-time instead of at Gate C.
- **⚠ THE `:108` FENCE HAD ALREADY GONE STALE — O-8 in the wild, and it self-documents.** The halt condition fences `GlobalHeader.tsx:108`'s wrapper class string. At `origin/main`, `:108` is **not** a class string — it is prose inside the GH-STAR docblock. At `4bb9023` (immediately pre-GH-STAR) `:108` was the header's **grid wrapper**, and that string is **byte-identical** at HEAD, verified by `diff` against `4bb9023`'s own copy. It now sits at **`:167`** (+59: GH-STAR's docblock moved it +54, this task's register correction a further +5). ⛔ **GH-STAR's own log records *"`:108`'s wrapper class string is byte-unchanged"* — a claim written *after* GH-STAR had already moved that string to `:162`.** The fence was stale at the moment it was recorded, and was inherited verbatim into this kickoff. Resolved by reading it **by symbol**, per O-8. **Recommend restating the halt condition as the symbol before a third task carries it.**
- **⭐ The ruling said "Lowercase suffix" and NOTHING in the suite could enforce it.** The tab's own type register is `uppercase`; the count escapes it via `normal-case`. `text-transform` **paints** — it never rewrites `textContent`. So every `textContent` assertion in the file keeps reading `1.2k` while the header shows `1.2K`, green the whole time. Proved by deleting the class: **1 failed / 11 passed** — the added guard is the only thing in the repository that can catch it. Asserted as a class **token** (split on whitespace), not a substring, per the repo's own `table-fixed`/`fixed` lesson.
- **⭐ Both new guards proved non-vacuous by injection, then reverted from a pre-injection copy.** Reverting the formatter to grouped: **5 failed / 7 passed**. The tests that correctly stayed **green** are the informative half — `stars=0` (compact notation never reaches zero, which is the load-bearing contract *demonstrated* rather than asserted), `stars=999` (below the threshold both formatters agree — which is exactly why 999/1000 is an acceptance pair), and the aria-label test (independent of notation by construction). `999` alone cannot detect the reversion; `1000` can.
- **The `Instructions for AI` block was diffed against `CLAUDE.md` §5.13.1 rather than trusted from memory** — byte-identical, confirmed by `diff`, not by eye.
- **A stray `</content>` token leaked into the tail of the `~/Downloads` report** and was caught by the standing tail-scan before upload. Same failure mode as the recorded one; the scan earned its keep again.
- **⚠ THE FULL SUITE EXITED 1, AND THE HALT CONDITION IT TRIPPED WAS DISCHARGED BY DIAGNOSIS RATHER THAN BY ASSUMPTION.** 13 tests failed across 5 files this PR does not touch (`server/events/insert{,.guards}`, `server/admin/resolution`, `server/bets/validation`, `server/bets/concurrency`). Proved unrelated six ways rather than asserted: **(1)** `grep` for `GitHubStars|GlobalHeader` across `tests/{server,integration,invariants,db}/` returns **zero hits** — a React number formatter cannot reach the bet transaction handler; **(2)** the signatures are infrastructure, not logic — `PostgresError: deadlock detected`, `Hook timed out in 10000ms`, `error_internal` where `illegal_edge` was expected; **(3)** the local catalog is bloated past the documented threshold, **measured before diagnosing** per the standing rule — `pg_class` **1,338 live / 41,689 dead / 271 MB**, `pg_trigger` 58 / 16,328 / 13 MB, with Realtime's `cainophile_*` pgoutput slot **`active`** and pinning `catalog_xmin`, so autovacuum cannot reclaim any of it; **(4)** the slowdown signature is present — per-file 138s / 210s / 117s, total **1509s** against a recorded worst case of 727s; **(5)** the same suite was green ~90 minutes earlier on the immediately preceding base (`371 passed | 1 skipped`); **(6)** ⭐ **all 5 files pass in isolation — `5 passed (5)`, 98 tests, exit 0** — which is the recorded signature verbatim: *"each passes in isolation, and forcing the suspected adjacency does not reproduce it."* Test-count arithmetic independently confirms nothing was lost: 3411 → 3418 is exactly this PR's +6 plus O1-DECK's +1. ⚠ **The remedy was NOT applied**: `VACUUM (FULL, ANALYZE) pg_class` and releasing the slot's pin both take heavy locks on **shared** local infrastructure other worktrees use, so it is the founder's call, not a unilateral one.
- **Biome was run scoped to the three touched files**, returning clean — so nothing was added to the 5-warning/4-info pre-existing baseline recorded at GH-STAR, and no `just format` sweep pulled unrelated files into this diff.

## Open questions

None blocking. Three carried forward:

- **The truncation substitution needs the Gate C confirmation** — §1 of the PR body. Behaviour is unchanged from the ruling; only the explanation is.
- **The `:108` halt condition should be restated as a symbol** before it is quoted into a third task. It has now been carried stale through two.
- **⚠ THE LOCAL POSTGRES NEEDS A DECISION, AND IT IS NOT THIS BRANCH'S TO MAKE.** `pg_class` is at 271 MB / 41,689 dead tuples with Realtime's slot pinning `catalog_xmin`, and it will keep degrading — the suite has gone 355s → 504s → 727s → **1509s** across the recorded runs. It is now producing red in untouched files on every full run, which is expensive in exactly the wrong way: it costs a full diagnosis each time to establish that a branch is clean. The remedy (`VACUUM FULL` on `pg_class`, then releasing the slot's pin by stopping `supabase_realtime_experiment`) takes heavy locks on **shared** infrastructure other worktrees use, so it needs the founder's go-ahead and a moment when no other session is mid-suite.

## Next session starts at

Founder reads the PR diff (staged as its own file in `~/Downloads`) → Gate C → merge. **Do not merge before that read.** After merge, staging: **O-10 — push `staging` BEFORE any branch push**, or Vercel dedups the SHA and the domain serves the old build while Staging Migrate reports green. Then the live acceptance read at 1440: the repo has **0 stars**, so the count node must still be **present and read `0`** — compact notation does not touch zero, and a missing count node there is a FAILURE, not a rendering choice.

## Context to preserve

Base `c58d64a2ba0987de469ff7d56bc7aa4a15d9f2c9`, fetched not recalled. Gates, each read with its own exit: `ZUGZWANG_ENV=preview just verify` **exit 0** (tsc → biome → `next build`, 27 routes); `pnpm vitest run tests/unit/shell/ tests/unit/design/` **23 files / 164 tests, all passed**; full `pnpm vitest run` — **exit 1**, `13 failed | 3400 passed | 1 skipped | 4 todo (3418)`, 1509s. **Diagnosed environmental; see the surprise below.** ⚠ Reported as the `1` it was — the gate is not claimed green.

**The measurement, for whoever next reaches for `Intl` compact.** `new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })`, lowercased:

```
0 → 0      847 → 847     999 → 999      1000 → 1k     1234 → 1.2k
1949 → 1.9k   1950 → 2k     1999 → 2k    9999 → 10k   54321 → 54.3k
99999 → 100k   999999 → 1m   1234567 → 1.2m   999999999 → 1b
```

It **rounds**, half-expand, and the rounding crosses magnitude boundaries: `999999 → 1m` means a repo one star short of a million advertises a million. That is the thing that reads as a defect and is not one.

⚠ `just verify` exits 1 as a bare command in this worktree — no `.env.local`, and `justfile:7` sets `dotenv-load`. Discharged with the committed `tests/_setup/env.ts` placeholders, exported inside a **subshell script** so they could not leak into any vitest shell (the `??=` hazard). No real `.env*` was read.

**The reusable lesson:** when a kickoff hands you both a behaviour and the reason for it, **run the behaviour before you write the reason down**. Here the outputs were ratified and correct and the explanation was wrong, and only measuring first told them apart — cheaply, at write-time, instead of expensively at Gate C. A comment asserting a mechanism is a claim about the world; check it like one.

## Time

2026-08-19, ~2020 → close IST. One session: measure the ruling before writing it down → implement → correct the mechanism in place → RED-check both new guards → gates → a full-suite red that tripped a named halt condition and was discharged by diagnosis rather than by assumption → PR. The full suite is the bulk of the wall clock at 1509s; the diagnosis that had to follow it is the second-largest item, and that cost is the argument for the `pg_class` decision in *Open questions*.
