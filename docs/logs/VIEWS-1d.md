# VIEWS-1d — §8 recital + the VIEWS-1 squash-SHA backfill — execute close-out

**PR #361** (OPEN, not draft — founder merges) · branch `chore/views-1d` · base `main` @ `2efe706` · run from the **primary repo** `/Users/hrishikesh/code/zugzwang/experiment`, not a worktree · squash SHA recorded at merge, not here.

One line of one log file, plus a read-only recital of `CLAUDE.md` §8. Not critical path — no runtime code, no schema, no migration, no test change. **The edit is the smaller half of this session.** The larger half is that the task was scoped around a defect that does not exist: `O-11` was reported missing from §8 by VIEWS-1c and is not missing, and this kickoff inherited that and wrote a paragraph to route around it.

## What landed (files + PR#)

2 files, across 2 commits. The edit · this log.

- `docs/logs/VIEWS-1.md` — **line 3 only**, 1 insertion / 1 deletion. `squash SHA TBD at merge.` → `` squash SHA `6931400`. `` The SHA was measured (`gh pr view 359 --json mergeCommit --jq .mergeCommit.oid` → `69314007c4788db45c964d007497073495fda9eb`), never typed from the relay, and corroborated independently by the fetch line `6931400..2efe706` — `6931400` was `main`'s head between #359 and #360. This discharges **VIEWS-1c OD-3**.
- `docs/logs/VIEWS-1d.md` — this log.

Untouched by design: `CLAUDE.md` (§8 was **read-only** this session — every O-entry is web-authored), `docs/specs/SPEC.1.md`, PR #358 and its branch, the mockup, `/api/visits`, `src/server/visitors/**`, the Redis key, `VisitorCounter.tsx`, `POLISH-0_data-manifest.md`, and every test.

## Decisions made

- **The `squash SHA` label was kept; only `TBD at merge` was replaced.** A literal reading of the instruction removes the words that say what the SHA is, leaving `` · `6931400`. `` — a bare token in a list of labelled ones. One edit either way.
- **Short form `6931400`, not the 40-char oid** — taken from the material, not from taste: the same sentence already cites `` `b153400` `` and `` `2c8b144` `` in short form, and **VIEWS-1c OD-3**, the item this discharges, names the value as `` `6931400` ``. The full oid is in the close-out report and in this log above, so nothing is lost.
- **The stale `(OPEN, not draft — founder merges)` on that same line was NOT fixed.** PR #359 is `MERGED`; the clause is stale in exactly the way the SHA was, and sits four words away from the token I was told to change. It is outside the fence (*"change nothing else in that file"*), so it is surfaced, not absorbed (**OD-1** below).
- **Two commits, and the log carries its real PR number.** The log is written after `gh pr create` so it can name the PR rather than mint a second `TBD` — a placeholder for a *knowable* value is what created OD-3 in the first place. The cost is a second push, so the first CI run is `cancelled` by design; **V-14** governs reading it.

## Surprises caught + fixed in-session (wins)

- **`O-11` is not missing, and never was.** VIEWS-1c's `OD-1` states *"`CLAUDE.md` §8 carries **O-1…O-10** at `6931400` (measured, not recalled)"*. Measured here: §8 at `2efe706` carries **O-1…O-12**, and `git log -S` puts both `O-11` and `O-12` in `a50de29` (**#352, SYNC-2**), which `git merge-base --is-ancestor` confirms is an ancestor of `6931400`. I looked for the tree that would make the claim true and there isn't one — `fix/runbook-staging-content-test`, `8823755` and `6931400` **all three** carry twelve. So it was not the usual stale-worktree read. A claim labelled *measured* was not, and it propagated one hop. This is **O-2** one register over: the O-ceiling understated by the report that said it had checked it.
- **`O-11` is, almost clause for clause, the reporting contract this kickoff restated as prose** — while explicitly declining to cite a register number. The restatement is lossy: it drops *write incrementally*, the `UPLOAD` line, the `-r2` collision rule and the never-let-the-OS-mint-`(1)` clause, *never rename/move/overwrite an operator-staged report*, *the headline names, it does not conclude*, and *web Claude checks the line count before reading*. **A contract that is restated instead of cited drifts, and cannot be corrected in one place.**
- **Two other live Claude sessions hold a cwd in the primary tree** (`ps` + `lsof -d cwd`: PIDs `12223` and `2599` → `/Users/hrishikesh/code/zugzwang/experiment`). Both parked; the tree was clean at `chore/views-1c` `8823755`, whose tree is byte-identical to `2efe706`. Proceeded, because an idle session mutates nothing — but the ~35 min full suite this gate requires is exactly what a resumed second lane would corrupt.
- **One stray mutating command, caught and proven inert.** A leftover `git checkout -q origin/main -- .` ran against `chore/views-1c` before the branch was cut. `git status --short` and `git diff --stat HEAD origin/main` both returned empty — the two trees are identical, so it wrote nothing. Named rather than dropped.

## Open questions

- **OD-1 · `docs/logs/VIEWS-1.md:3` still says PR #359 is "OPEN, not draft".** It is `MERGED`. Out of this task's fence; one clause. If the intent was to make line 3 *true* rather than to swap one token, this is the other half.
- **OD-2 · VIEWS-1c's `OD-1` should be closed INVALID, not carried.** Its premise is refuted above. Recording the closure is the founder's call; leaving it open invites a third kickoff to route around `O-11` again.
- **OD-3 · Should kickoffs cite `O-11` rather than restate it?** This one restated it and lost six clauses. The register exists so the contract has one home.
- **OD-4 · `docs/logs/UI-13-log.md:3` carries the same `squash SHA TBD at merge` placeholder** — found while checking house style for this edit. PR #264 is `MERGED`, squash SHA `903e185` (`903e185b451293b9f798e59e699ef7f3718256f8`, measured), and that line also still calls it `(DRAFT)`. Same defect class as VIEWS-1c's OD-3, one file over, both halves stale. Out of fence; not touched. **The pattern is the finding:** a log header is written with a placeholder for a value that only exists after merge, and nothing brings the session back to fill it.

## Next session starts at

Founder reads the PR → merges, or rules on OD-1. **Apply V-14 when reading its CI:** this log is a second push, so the first run is `cancelled` by design — read `gh run list --branch chore/views-1d`, then `gh run view <id>`, and accept only the run whose `sha` equals the final head. After merge, if staging is to advance: **O-10** — push `staging` **before** any branch push, or Vercel dedups the SHA and the domain serves the old build while Staging Migrate reports green.

## Context to preserve

Base `2efe706` (the VIEWS-1c squash). Gates measured green in the primary repo, each unpiped with its own exit read: `ZUGZWANG_ENV=preview just verify` **exit 0**; full `pnpm vitest run` **exit 0**; `pnpm biome check .` **exit 0** with 5 warnings + 4 infos — all five files pre-existing and untouched (`tests/staging/_lib/reset.ts`, `tests/unit/debate/render/price-percent-pair.test.tsx`, `src/components/debate/CommentImage.tsx`, `src/components/debate/dialogs.tsx`, `tests/server/moderation/moderation-blocked-event.test.ts`), identical to the VIEWS-1c baseline. **§8 is `O-1…O-12`; next free is `O-13`** — read off `origin/main`, not counted. The primary repo now sits on `chore/views-1d`; the unpushed commit `205b44a` on `fix/runbook-staging-content-test` is still untouched.

## Time

2026-08-19, 1313 → close IST, single unattended session (recon → one edit → gates → PR). The full suite is the bulk of the wall clock.
