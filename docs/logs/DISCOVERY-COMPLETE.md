# DISCOVERY-COMPLETE — session log

> **Session:** 2026-08-10 · execute · branch `feat/discovery-complete` off `origin/main` `aff76b3`
> **Plan:** `docs/plans/DISCOVERY-COMPLETE.md` (PR #310, squash `aff76b3`)
> **State at close:** pushed, **NOT MERGED** — awaiting the founder's Gate C diff-read.

---

## What landed

**14 commits, one PR. 34 files, +2606 / −110.** The 12 planned commits, plus two
in-session corrections (`C3a`, and a counted-inventory fix) — both recorded
below rather than folded silently.

| # | Commit | What |
|---|---|---|
| C0 | `3b1c492` | pole-inversion static guard, **committed RED** |
| C1 | `9663853` | V29/V30 PriceBar size presets (hero 22px / card 16px / detail pinned) |
| C2 | `2777d1f` | V50 Avatar `xs` (16px) preset |
| C3 | `27501b4` | V10/V11 SideBadge entry price + hero chip geometry; `HeroPost.entryPrice` |
| C4 | `53e75d4` | **INV-3 fix** — `/bookmarks` side encoding was inverted |
| C4b | `22e8192` | **INV-3 fix** — the same inversion on the publicly reachable `/u/[pseudonym]` |
| C3a | `adb2b13` | **correction** — entry price is already side-scoped; render it raw |
| C5 | `801a7a9` | V16 hero reply head |
| C6 | `2b27633` | V17 Support/Counter split bar (display-only) |
| C7 | `cdfed95` | V15 hero post image (LEFT JOIN + `signRead`) |
| C8 | `0346a50` | V13 argstake progression (OD-1 = B, post-anchored) |
| C9 | `e0ab7b2` | V46 Empty + Error reconcile to the W2.11 P1 shape (R9) |
| C10 | `e5827dc` | P7 loading primitive **+ canon amendment, one commit** (R8, T1 superseded) |
| — | `79e0477` | **correction** — SideBadge's counted inventory to the PR-head truth |

Founder rulings executed as stated: **OD-1 = B** (C8 built, post-anchored),
**OD-2 = yes** (`detail` pinned, zero delta), **OD-3** (`@test-writer` wrote C0),
**OD-4 = A** (C4b landed). Ultracode narrowing (C2/C9/C10) was **granted and not
used** — each is a small single-file change where a fan-out would cost more than
it returns. Permission, not a mandate.

---

## Decisions made

1. **C0's guard is the sharpened predicate, not the literal ban.** It flags a
   side-keyed expression resolving to a NON-pole colour. The kickoff's literal
   phrasing would have reddened six legitimate files on landing day.
2. **The C0 inventory is asserted by exact set equality, not a count** — it names
   the six files, so a seventh cannot appear silently *and* a sixth cannot be
   quietly added.
3. **C3a — entry price renders RAW.** See "Surprises" below. This reverses a
   deviation I made in C3 and returns to the plan's own ratified mechanism.
4. **C8's reserves are a SIBLING of the card, never a field on it.**
   `listOpenMarkets` returns `DiscoveryListing = { card, reserves }`, so halt
   item 13 is satisfied structurally rather than by remembering a rule.
5. **C6's zero-total case is handled at the call site**, not by changing the
   shared `computeSplitBar` — `"0%"` is right inside a composer and wrong on a
   resting hero panel, and changing the primitive would move `ReplySplitBar`.
6. **C5's reply head is `text-n4`, not the plan's `text-n6`.** The plan cites
   mockup `:97-98` as its authority and those lines say `color:var(--n4)`. Built
   to the cited source; flagged for the diff-read (one class to change).
7. **C6's split halves are normalised to 18 dp, not carried verbatim.** A RED
   test found the substrate returns unpadded `"0"` for an empty aggregate and
   18-dp otherwise, which would have made the DTO internally inconsistent with
   `replyDharma`. Value-preserving formatting, not arithmetic.

---

## Surprises caught + fixed in-session

**S-1 · The C0 survey was incomplete — found by `@test-writer`, not by me.**
My hand survey enumerated five legitimate side-keyed colour expressions across
four files. There are **seven across six**: the
`{...(side === "YES" ? {stroke} : {className: "fill-no"})}` thumb-glyph SPREAD at
`composer/PositionStrip.tsx:102` and `composer/SlotHeader.tsx:43` is genuinely
side-keyed colour and I missed it — my grep looked for class-string ternaries.
Both are pole-bound, so neither is an offender. The agent explicitly refused to
narrow the predicate to make the count match my survey, which would have left
the property-object route to inversion uncovered. **The guard is stronger than
the survey that specified it.**

**S-2 · The plan's alive-check threshold was arithmetically wrong.** It pinned
`sideKeyedExpressions.length >= 6`. With the corrected survey the true count is
9 at C0 → **7 at PR head**, so 6 holds with one unit of slack. Had my original
survey been right (5 at PR head), the ratified threshold would have reddened the
guard *on its own fix*. Caught before C0 was committed.

**S-3 · C3 shipped a factually wrong number, and `@code-reviewer` caught it.**
I deviated from the plan's `formatPercentUnpaired` and used the paired
`formatPricePercent`, on the premise that `price_at_bet` is the canonical YES
probability and each side's price must be derived from it. **That premise is
false.** `bets/place.ts:162` stores `computeBuy(...).pEff`, and
`cpmm/calculate.ts:73-97` computes it as `stake ÷ shares` where `a =
reserves[side]` is the **bought** side — so a NO bet already stores the NO price.
My derivation would have rendered `NO @ 45%` for an author who entered NO at
55%, on a public surface, disagreeing with the `.md` export of the same field.

Worse: **I misread the evidence I cited.** C3's commit body argued from the d5
fixtures (YES post `entry:27`, NO post `entry:55`). Those prove the opposite —
the mockup renders `e` raw, and `e` is already side-scoped (the NO post's
*support* replies carry 57/59/61, its *counter* replies 36/34/31). Fixed in
`C3a`, verified at source myself before accepting the finding.

**S-4 · A test-precision defect that would have read as a code defect.** C4's
first draft asserted `.not.toContain("bg-primary")` on the raw class string.
That fails even after twMerge correctly drops the base `bg-primary`, because
`badgeVariants` ships `[a]:hover:bg-primary/80` — a different rule containing the
same substring. All such assertions now match exact class tokens. A guard that
reports a defect which is not there is the same class of failure as one that
misses a defect that is (O-3).

**S-5 · C10's first draft silently dropped a shadcn marker.** `LoadingBlock`
passed `data-slot="loading-block"`, which **replaced** `data-slot="skeleton"` on
every block. Caught by the pre-existing `surface-states` assertion. P7 now marks
itself with a separate `data-loading-block` attribute; a new test pins that both
coexist.

**S-6 · The loading skeleton was structurally lying.** Its card count was
hard-coded to FOUR while the grid renders up to EIGHT. Now sourced from
`DISCOVERY_GRID_SIZE`, asserted against the imported constant.

**S-7 · C3's zero-delta proof caught its own regression.** The first draft
hoisted the hairline out of the geometry string into its own `cn()` argument,
emitting the same classes in a DIFFERENT ORDER — visually identical, not
byte-identical. Moved back inside each preset string.

---

## Open questions

**OQ-1 · `@code-reviewer` on Group 2 and `@security-auditor` DID NOT RUN.**
The Group 2 reviewer terminated on an API error — *"You've hit your monthly spend
limit"* — before producing any findings, and the same limit blocks
`@security-auditor` entirely. The plan requires both. **This is the single
largest gap in the PR and the founder should treat it as one.** What did run:
`@test-writer` on C0 (OD-3), and `@code-reviewer` on Group 1 — which found the
S-3 CRITICAL, so the cascade was demonstrably earning its keep when it stopped.
Group 2's §3b/SC-1/float/round-trip questions were verified by hand instead
(evidence in each commit body), but hand-verification by the author is not the
independent check the plan asked for.

**OQ-2 · The `text-n4` vs `text-n6` reply-head tier** (decision 6 above) — one
class, founder's call.

**OQ-3 · `PositionMarker` adoption is a small pixel delta on two surfaces.**
C4/C4b replaced a hand-rolled `<Badge variant="outline">` marker with the shared
`PositionMarker`, which is `variant="secondary"`. Correct per the plan (adopt,
never patch) and the reason the missing `aria-label` arrived — but it is a
visual change on `/bookmarks` and `/u/[pseudonym]`, which POLISH.5/.6 own.
Recorded so those tasks are not surprised.

**OQ-4 · A spec↔code drift found while fixing S-3, NOT fixed here.**
`docs/specs/debate-export.md:177` states entry price is "the market
**YES-probability** … the same basis for YES and NO bets". The engine
contradicts it (see S-3); `SPEC.2.md:2721` is ambiguous the same way. The
shipped export is numerically correct — the prose is not. **This is the
misreading I inherited**, and it will mislead the next surface that renders the
field. Owner: a doc sweep, not this PR.

---

## Next session starts at

**The founder's Gate C diff-read of the pushed branch.** Do not merge before it.
After the read, the two live decisions are OQ-1 (whether to re-run the Group 2
reviewer + `@security-auditor` once the spend limit resets, before merge) and
OQ-2.

---

## Context to preserve

- **Branch is pushed and NOT merged, deliberately** — the plan's overnight mode
  removed every checkpoint except this diff-read.
- **C0 is the highest-leverage artifact here.** It was RED at C0, RED through
  C4, and green only at C4b — greened by fixing code, never by an allowlist. It
  has no allowlist, suppression list or dated exception. Its pinned inventory is
  exactly six files and neither fixed file appears.
- **PD-0-10 collapses from three side-chip implementations to one.** The
  survivor is `(admin)/…/ReviewFeed.tsx:102-104`, whose mapping is CORRECT —
  duplication, not inversion. Deliberately out of scope (admin is a structurally
  separate path, CLAUDE.md §3).
- **Corrections to carry** (plan "Corrections to carry", unchanged): CC-1
  (PD-2-21 names a non-consumer, omits `MarketCard.tsx:68` — re-verified this
  session), CC-2 (round-trip figure), CC-3 (`1b7f37f` unpushed, kept out — the
  branch was cut from `origin/main` explicitly and `git merge-base
  --is-ancestor` confirms it is absent), CC-4 (PD-0-10's side-chip half should
  re-class V → F functional). Plus **OQ-4 above as a new CC-5.**
- **Query budget is a ceiling, not an invitation.** Group 2 added five DTO
  fields at **+0 round-trips**; the count stays `1 + 12N`.

---

## Time

Single session, ~2.5h wall-clock: recon + plan read, 14 commits with per-commit
`ZUGZWANG_ENV=preview just verify`, one `@test-writer` pass, one completed
`@code-reviewer` pass, one failed reviewer pass, and the full local suite.
