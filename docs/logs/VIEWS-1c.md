# VIEWS-1c — post-merge housekeeping — execute close-out

**PR #360** (OPEN, not draft — founder merges) · branch `chore/views-1c` · base `main` @ `6931400` · run from the **primary repo** `/Users/hrishikesh/code/zugzwang/experiment`, not a worktree · squash SHA TBD at merge.

Three disjoint items from VIEWS-1 (#359): the worktree that carried it is gone, the docblock it left contradicting itself is corrected, and the CI-reading lesson it produced is numbered where V-numbers live. Not critical path — no runtime code, no schema, no migration, no test change.

## What landed (files + PR#)

2 files + this log, across 3 commits. `46c454f` docblock · `898b6cf` V-14 · this log.

- `src/components/shell/VisitorCounter.tsx` — **docblock only**, 4 lines, `@@ -6,12 +6,12 @@`. Three corrections: the instructed `"visitors"` → `"views"` at `:10`; `TOTAL page visits` → `TOTAL page views` at `:9`; and the second label quote at `:13–14` dropped rather than replaced (see Decisions).
- `docs/polish/POLISH-0_data-manifest.md` — **V-14** appended to §5 verbatim, plus four consistency sites: the §5 extent sentence, the PROPOSED row's high-water pointer (`V-13` → `V-14`, declined number `V-14` → `V-15`), the status line + footer (`v1.8` → `v1.9`), and a new §0 `v1.9` block (H1, H2).
- **No files** — `wt-views1` removed, `git worktree prune`, local `feat/views-1-label` deleted, three stale remote-tracking refs pruned.

Untouched by design: the rendered label, the `title` tooltip, `data-state`, `data-testid`, the `visitor-before-load` state name, the `VisitorCounter` symbol, `/api/visits`, `src/server/visitors/**`, the Redis key, every test, `SPEC.1`, `CLAUDE.md` §8, `POLISH-register-ADDITIONS.md`, and PR #358.

## Decisions made

- **The next free V is 14, measured off `origin/main`, not assumed.** Highest **defined** is V-13. The `V-14` already in §5 is the PROPOSED row **declining** a number, not holding one. Reading it as taken would have skipped a slot; counting entries rather than reading them would have issued one twice — both failures are already in this register, which is why it was read and not recalled.
- **Four consistency sites moved with the mint.** A register that contradicts itself on the commit that mints into it is the failure it exists to record (**O-5**, **V-9**). The high-water pointer was updated in the file's own demonstrated idiom — the previous mint (v1.8) did exactly this in its own commit, and the footer says so.
- **`:14` deviates from the literal instruction, and the deviation is the point.** Substituting `"views"` there would assert that *"views"* reads as a participant count — a claim §21.1 does not make and whose reasoning it contradicts, in a paragraph that opens by citing `SPEC.1 §21.1` by number. That is **O-9** in the keystroke meant to remove it. Now reads *"a bare number reads as…"*. Revert is one edit.
- **`v1.8`'s missing §0 block is recorded (H2), not backfilled.** Its content is the founder's to state; an executing task that authors a register's own amendment history is the D4 failure twice over.
- **Nothing cross-listed** into `CLAUDE.md` §8 or `POLISH-register-ADDITIONS.md` — one register, one home, per the kickoff and E1.

## Surprises caught + fixed in-session (wins)

- **The primary repo's working tree was not at `origin/main`.** It sat on `fix/runbook-staging-content-test` @ `205b44a`, which **predates the VIEWS-1 merge**. The first read of `VisitorCounter.tsx` — and a repo-wide `rg` — returned the *pre-merge* file, showing the label still `visitors` and the tooltip still `Total page visits`. That would have been reported as a live defect in a merged PR. Caught by re-reading at `git show origin/main:` before drawing any conclusion; at `origin/main` both were already correct. **`git rev-parse origin/main` is not `git rev-parse HEAD`.**
- **`git branch -r` reported a remote branch that no longer exists.** `origin/feat/views-1-label` was listed after `git fetch`, because a plain fetch does not prune. `git ls-remote` read 0 — GitHub had auto-deleted it at merge. Had the listing been trusted, this task would have issued a delete against a branch that was already gone.
- **The 0.2 halt condition could never have been satisfied.** `ci.yml` is `on: pull_request` only (`:9–11`) — no `push` trigger — so **no `ci` run exists on `main` for any SHA**, and `head_sha=6931400` returns `total_count: 0`. Reported rather than HALTed: the merge is green by the only gate that exists (the PR-head run `32187168264` on `3c1e3ae`, `completed`/`success`), and the squash tree is byte-identical to it (`6931400^{tree}` == `3c1e3ae^{tree}` == `f6b0858…`).
- **A gate reported through a pipe reported nothing.** `pnpm biome check . | tail -20` with `${PIPESTATUS[0]}` printed an empty exit under zsh. Re-run unpiped for a true `0`. This is the standing rule firing on its author.
- **The first full-suite run had no captured exit code.** It was backgrounded with `nohup … &` and only its summary was readable. Re-run with a measured exit rather than inferring one from a clean summary.

## Open questions

- **OD-1 · `O-11` is cited by the kickoff but is not on disk.** `CLAUDE.md` §8 carries **O-1…O-10**. It was complied with as stated; if it is durable it needs minting in §8, or the citation needs correcting.
- **OD-2 · `v1.8` has no `§0` amendment block** (H2). One version after §0 records the same absence for v1.6, in the document that names the failure.
- **OD-3 · `docs/logs/VIEWS-1.md:3` still reads "squash SHA TBD at merge."** The SHA is `6931400`. Out of this task's fence; one line.
- **OD-4 · O-4 currency not measured.** The kickoff invoked staging sync as the ground for the 0.2 gate, but staging is outside this task's fence and no `/api/health` canary was read. Whether staging reflects `6931400` is unverified here.
- **OD-5 · The `:14` deviation** above — founder's call, one edit either way.

## Next session starts at

Founder reads PR #360 → merges, or rules on OD-5. **Apply V-14 when reading its CI:** this log is a second push, so the first run is `cancelled` by design of the §5.9 sequence — read `gh run list --branch chore/views-1c`, then `gh run view <id>`, and accept only the run whose `sha` equals the final head. After merge, if staging is to advance: **O-10** — push `staging` **before** any branch push, or Vercel dedups the SHA and the domain serves the old build while Staging Migrate reports green.

## Context to preserve

Base `6931400` (the VIEWS-1 squash). Gates all measured green in the primary repo: `ZUGZWANG_ENV=preview just verify` **exit 0**; full `pnpm vitest run` **exit 0** — 369 files / 3393 tests passed, 1 skipped, 4 todo; `pnpm biome check .` **exit 0** with 5 warnings + 4 infos, all pre-existing in untouched files. The V-14 text is **verbatim web-authored** — do not redraft; it was byte-verified (md5 `7dc0668e26e292aacfe7936eb423b6a3`). The primary repo now sits on `chore/views-1c`; the unpushed commit `205b44a` on `fix/runbook-staging-content-test` is untouched and still there.

## Time

2026-08-19, 0328 → 0430 IST, single unattended session (recon → cleanup → two edits → gates → PR). ~1 h wall clock, ~12 min of it the two full-suite runs.
