# FEED-1 — session log

**Autonomous overnight run, 2026-08-24.** No operator gate at any point.

---

## What landed

**PR [#400](https://github.com/zugzwang-foundation/experiment/pull/400) → `staging`, OPEN and
UNMERGED** (deliberately — the brief asks for a founder review pass, not a merge).
Branch `feat/feed-1` · HEAD `1763659` · base `06d4178` · 10 commits, all signed.

| Commit | What |
|---|---|
| `a3a63e7` | the plan + the A1 baseline measured against the **unchanged** tree |
| `30c0034` | `ComposerSlot`: `open: boolean` → `slot: "scroller" \| "composer" \| "confirmed"` |
| `1d0e3d2` | the feature — success holds the slot; the real post is looked up and rendered |
| `94d6e6d` | `find-posted` unit tests — what the lookup RETURNS, incl. the masking rule |
| `4c935ec` | `@test-writer` round: guards that were passing on things that never happened |
| `3d923df` | `@code-reviewer` round: **the CRITICAL** — a keyboard exit from the wait window |
| `738bae2` | `@security-auditor` round: gate the render on refresh-landed; arm-scoped fallback; fail-closed narrowing |
| `5fafa5d` | re-review: the control exemption was inert in the wait; `criterionOpen` in the overlay set; `aria-busy` |
| `06d0737` | the pre-existing masking gap gets a durable `docs/parked.md` row |
| `1763659` | a selector made stable against `staging`'s parallel header change |

**Files:** `ComposerSlot.tsx` · `PostedConfirmation.tsx` (new) · `find-posted.ts` (new) ·
`BetComposer.tsx` (the success branch only) · `copy.ts` · `DebateView.tsx` · six test files ·
`docs/plans/FEED-1.md` · `docs/parked.md`.

**Zero files under `src/server/`, `src/db/` or `drizzle/`.**

## Decisions made

1. **The refresh-landed signal is `model !== posted.fromModel`, not `useTransition().isPending`.**
   `router.refresh()` opens its own `startTransition` internally, so an outer pending flag
   tracks a different transition. The model's arrival asks the question that actually matters.
2. **The confirmation's entrance rides the confirmation node, not the slot wrapper.** Every
   `animate-in` variant compiles to `animation-name: enter`; re-labelling an element that
   already carries it restarts nothing. It would have typechecked and never played.
3. **The post is looked up, never reconstructed** — `ordinal`, `badge` and `entryPrice` are
   unknowable client-side, and no test here could have caught a wrong one. The lookup returns
   the PRESENT variant or nothing, so masking is enforced by the signature.
4. **The arm stays engaged through the confirmation.** That is what holds the freeze, the poll
   suspension and the two-refresh budget with **no new term in any of them**.
5. **`Escape` is the exit.** Pointer events are not an exit for a keyboard reader, and in the
   wait window every other exit is independently dead.
6. **No timer bounds the wait** — a timer would be a second source of truth about whether the
   refresh landed, which `ComposerSlot`'s own R6 docblock argues against at length.
7. **Did not rebase onto the moved `staging`** — the reviewer cascade audited a specific tree.
   Measured the merge in a throwaway worktree instead (702/702 after one fix).

## Open questions — all owed to a human

1. **A visible in-flight affordance.** `ErrorStrip` renders nothing for `phase: "in_flight"`,
   so the post-success wait is a greyed motionless form — and this task makes that window the
   primary post-submit view. `aria-busy` shipped (a state, no copy); the visible half needs a
   founder string. RF-6 forbids authoring one.
2. **The stale column while confirmed.** With the arm held there is no reachable refresh on
   `/m/[slug]`, so that participant's whole surface is frozen at the read-time snapshot until
   they dismiss. Not a masking bypass, and it self-corrects on any payload — but it is now the
   default post-bet state rather than an opt-in. Plan §2 RF-5 carries both reasons.
3. **SPEC.1 §9** words the poll rule as *"any bet composer is open"*; a confirmed slot is not
   literally a composer. Build follows the founder ruling; the sentence wants widening.
4. **design-canon §6:122** carries no confirmation string. `Posted` is registered in `copy.ts`
   for the web lane's amendment.
5. **No ADR** for the refresh-landed handshake — a genuinely new client-side primitive.

## Next session starts at

**Read `~/Downloads/zz_FEED-1_run_2026-08-24T1032.md` §10 and run the twelve-item browser pass
against a real staging deploy.** Item 1 is the one everything rests on: *does a real refresh
actually produce a new `model` object identity, so the confirmation ever appears at all.*
Nothing else in the list matters if that one fails.

## Context to preserve

- ⚠ **`staging` moved TWICE during this run** (`17f666b` → `06d4178` → `b5e6e63`), both times
  into `src/components/debate/`. The other lane is live on the same surface. `09b5fa0` there
  independently answers half of a finding raised here (the header mirror).
- **The A1 budget is 2 refreshes per successful bet, measured both before and after.** If a
  later change makes it 3, `posted-refresh-budget.test.tsx` is the guard that says so.
- **The masking guarantee has four layers** and only the third is new here — the run report §6
  names all four, and names the one property (`posted` holds an id, not a node) that makes the
  confirmation self-correcting. A future change that caches the resolved node destroys it.
- **`claude-progress.md` is gitignored**, so the SURPRISE it recorded also has a
  `docs/parked.md` row. That was a reviewer's pushback and it was right.

## Time

Recon → plan → 4 slices → 3 reviewers → 2 scoped re-reviews → PR, in one session.
CI run `32734397658`, `conclusion=success`, on `headSha=1763659`.
