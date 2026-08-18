# O1-DECK — session log (execute)

> **Session:** the unattended overnight execute. Commits 1–4, full gate, PR, staging advance.
> **Mode:** no reviewer available; governed by `ZUGZWANG-O1-DECK_overnight-pack_v1_0.md` §3
> (continuation policy) over `docs/plans/O1-DECK.md` @ `23dc0c3` (RATIFIED).
> **Worktree:** `/Users/hrishikesh/code/zz-o1-build`, branch `feat/o1-deck` cut from `origin/main` @ `94dacb7`.

---

## What landed

**PR [#355](https://github.com/zugzwang-foundation/experiment/pull/355) — OPEN, ⛔ NOT MERGED. Gate C is owed.**
15 files, 1966 insertions, 7 deletions. No DDL; migration head stays `0024_bookmarks`.

| Commit | Contents |
|---|---|
| `2d98a04` | `test(onboarding):` the four test files, **RED** |
| `154e618` | `feat(onboarding):` **ADR-0037** verbatim · `server/onboarding/gate.ts` · `complete.ts` · `(public)/layout.tsx` wiring |
| `f6ce580` | `feat(onboarding):` `cards.ts` · `figures.tsx` · `OnboardingDeck.tsx` · copy-register annotation |
| `f8c55cd` | `feat(shell):` `RulesControl.tsx` · `GlobalHeader.tsx` · SPEC.1 §21.9 rider + §0 → **1.0.35** |

**New:** `docs/adr/0037-onboarding-deck-seen-marker-cookie.md` · `src/server/onboarding/{gate,complete}.ts` ·
`src/components/onboarding/{cards.ts,figures.tsx,OnboardingDeck.tsx}` · `src/components/shell/RulesControl.tsx` ·
`tests/unit/onboarding/{gate,cards,copy-drift}.test.ts` + `render/deck.test.tsx`.

**Modified:** `src/app/(public)/layout.tsx` (additive) · `src/components/shell/GlobalHeader.tsx` ·
`docs/specs/SPEC.1.md` · `docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md` (append-only).

⚠ **`src/app/(auth)/layout.tsx` was NOT touched** — the pack's D-6 struck it. `RulesControl` owns its own
re-show deck and `GlobalHeader` already mounts in `(auth)`, so the control reaches `/sign-in`,
`/sign-in/otp` and `/onboarding` with zero edits there.

**Gate:** `tsc` 0 · `biome check .` 0 · `next build` 0 · **`pnpm vitest run` → 368 files / 3388 tests, 0 failures.**

**Staging:** advanced `94dacb7 → f8c55cd` (clean fast-forward, no force needed). Deploy VERIFIED at
`/api/health`: `canary f8c55cd…`, `env staging`, `db ok`, `migrations ok`, `region bom1`.

## Decisions made

Ten CLASS B calls, each recorded in full with its alternative in
`~/Downloads/zz_O1-DECK_overnight_2026-08-18T1547.md` §2. The three load-bearing ones:

- **B-2 — the gate compares the marker against the version token, not bare presence.**
  `viewer !== null && marker !== INTRO_SEEN_VALUE`. ADR-0037 chose a token over a boolean
  precisely to buy a re-show lever; under a presence test that lever does not exist, because a
  browser holding `v1` stays suppressed forever and minting `v2` changes nothing. Behaviourally
  identical today; diverges only on the day the lever is pulled, which is the day it must work.
- **B-3 — `completeOnboardingDeckAction` is passed DOWN as a prop, never imported by the deck.**
  One component serves both contexts, so inverting the dependency is the only way to keep D-4
  structural. `(public)/layout.tsx` is now the sole reference site in the tree; `RulesControl`,
  which reaches `/sign-in`, has no path to it. S-11 becomes a compile-time fact.
- **B-1 — built on `origin/main` @ `94dacb7`**, one docs-only commit past the pack's ground
  `c4526e2`. S-8 and S-9 were re-measured in the new worktree (ceiling `0036`, SPEC.1 `1.0.34`)
  rather than inferred from the pack.

**Two CLASS C heals:** no `node_modules` in the fresh worktree (installed before the first commit,
because `pre-push` needs it and `--no-verify` is prohibited); no `.env.local` (build env supplied
inline from the `tests/_setup/env.ts` placeholder set — set, not connected; no `.env*` read or written).

## Open questions

1. **⛔ Gate C on PR #355.** The full diffs of the three ruling-bearing files are §4 of the report.
   Nothing merges until they are read.
2. **AGENTS.md §9 candidate, NOT taken — it is outside the S-4 allow-list.** The jsdom harness has an
   undocumented trap that cost a red here: **Radix's `DismissableLayer` arms its outside-pointer
   listener inside a `setTimeout(…, 0)`**, so a `pointerDown` fired synchronously after `render()`
   reaches no listener at all. Any future dialog-dismissal test hits this. It belongs beside §9's
   existing "no jest-dom" and fake-timer notes. **Founder's call** — the pack downgrades only
   `docs/plans/**` and `docs/logs/**` to CLASS B, and AGENTS.md is in neither list.
3. **Post-merge staging restore.** `staging` is 4 ahead of `main`; the squash SHA will not be its
   descendant, so returning it needs the runbook's `--force-with-lease`. Restore point: **`94dacb7`**.

## Next session starts at

**Read PR #355's Gate C artifact (report §4), then merge or return findings.** If merging: squash,
then run `deploy-pipeline.md` §2.5 to return `staging` to the new `main` — content test first, then
`git push --force-with-lease origin origin/main:refs/heads/staging`, then verify `canary`.

## Context to preserve

- **Staging serves `f8c55cd`, which is the four FUNCTIONAL commits.** This log commit sits on top of
  it and is docs-only; staging was deliberately left pinned at the SHA that was verified, rather than
  re-deployed for a file with no runtime content. `canary` will therefore read `f8c55cd`, not the
  branch head, and that is intended.
- **The marker cookie has never existed in any browser before this deploy**, so the first-login deck
  fires for anyone already signed in on staging — no signup needed to test it. Full browser
  reproduction is §6 of the report.
- **One committed-RED test was later modified, and it got harder, not easier.** The re-show backdrop
  assertion was the positive control for the first-login one and failed first; that failure is what
  surfaced the Radix deferral above. Without it, "the backdrop does not close it" would have passed
  against a listener that was never armed. No assertion was weakened, skipped or deleted (§3.1).
- **`copy-drift.test.ts` carries no §17 row deliberately** and SPEC.1 §21.9 now says so, so nobody
  goes looking in the catalogue for something intentionally absent from it.

## Time

2026-08-18, 15:47 → 16:45 IST (~1h). Unattended throughout.

---

# Final entry — merged, staging returned, task closed

> **2026-08-18, 17:16 → 17:55 IST.** Two attended sessions after the unattended run:
> the Gate C completion, then this close-out.

## What landed after the overnight run

| Commit | |
|---|---|
| `2623023` | `docs(agents):` the jsdom harness note — Radix arms its outside-pointer listener a macrotask late |
| `d0c8674` | `test(onboarding):` `complete.test.ts`, AGENTS.md `30` → `75`, and the module-scope note in `complete.ts` |

**PR #355 MERGED** 2026-08-18T12:16Z, squash **`e79555c`**, seven commits.
Tree identity verified: `git diff d0c8674 origin/main` is **EMPTY**, so the squash
landed the tree that was reviewed and not some other one.

**The Gate C findings are closed.** The one that mattered: `completeOnboardingDeckAction`
had no test at all, so the single line standing between an anonymous caller and a
written marker was undefended — deleting it left 368 files and 3388 tests green. It
now has five `it()` blocks behind it, and the guard was **proven by reversal**
rather than written red-first: the behaviour already shipped, so a correct test of
it passes on its first run and that pass certifies nothing. Deleting
`if (!session) return;` turned exactly one test red and left the other four green;
restoring it turned them green again.

## Staging returned to main

`origin/staging` was at **`f8c55cd`** — a pre-squash branch commit — so this was the
runbook's documented **force** case and not the fast-forward the outbound advance
enjoyed. `deploy-pipeline.md` §2.5's content test was run before forcing:

- `git merge-base --is-ancestor f8c55cd d0c8674` → **true**, and `d0c8674`'s tree is
  byte-identical to `e79555c`'s, so staging's tree was a prior state on the path to
  main's. **Nothing existed only on staging.**
- The literal `main..staging` shortstat read **1 insertion / 239 deletions**, and
  that single insertion is `AGENTS.md`'s `**75**` reverting to `**30**` — main's own
  *modified* line, not staging content. This is the exact misreading §2.5 warns
  about twice: a direction count cannot tell behind from diverged.

Forced to `e79555c`; migrate run `32136250381` green on the matching `headSha`, with
the two idempotent NOTICEs (`42P06`, `42P07`) and **no DDL**, as precondition (c)
predicted. **Deploy verified at `/api/health`:** `canary e79555c…`, `env staging`,
`db ok`, `migrations ok`, `region bom1`.

⚠ **O-10 did NOT bite, and the reason refines the rule.** `e79555c` already had a
**Ready Production** deployment when staging was forced to it, which is the
dedup condition O-10 names. Vercel built it **again anyway** — two distinct
deployments of one SHA, `experiment-ngd7etn42` (Production) and
`experiment-8efogpmit` (staging). ⇒ **The dedup appears to be per-ENVIRONMENT, not
purely per-SHA.** One observation, not a law; the outbound case that did bite was
branch→staging, where both sides resolve to the same non-production environment.
**Keep verifying `canary` regardless** — that is what made this knowable.

## ⛔ OPEN — the ratified plan never reached `main`

**`docs/plans/O1-DECK.md` is NOT on `main`.** `23dc0c3` is not an ancestor of
`origin/main`; the plan lives only on `origin/plan/o1-deck`, which was never opened
as a PR. The branch survives, holding two commits and exactly one file (753 lines).

**This leaves a dangling reference on `main`:** `docs/logs/O1-DECK.md:5` — the file
you are reading — cites `docs/plans/O1-DECK.md` @ `23dc0c3`, and that path does not
resolve on `main`. The SHA still does, but only while the branch exists; delete
`plan/o1-deck` and the citation becomes unrecoverable.

⇒ **Do not delete `plan/o1-deck` until the plan is landed or the citation is
rewritten.** Landing it is a one-file PR. Not done here: the close-out was scoped to
report the state, and putting a ratified planning artifact on `main` is the
founder's call, not a tidy-up.

## Worktrees

`zz-o1-build`, `zz-o1-plan` and `zz-o1-deck` removed at close-out. `plan/o1-deck`
and `docs/o1-deck-spec` remain as **branches** on the remote; only their working
copies are gone.
