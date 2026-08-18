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
