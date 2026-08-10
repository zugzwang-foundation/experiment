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
| — | `83da6ba` | **GATE C BLOCKER FIX** — V13 `currentValue` is POST-scoped, as OD-1 actually ruled |

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

**S-8 · V13 shipped MARKET-scoped under a ruling that said POST-scoped — caught
by the founder's Gate C read, not by me or by any test.** OD-1's ruling text is
explicit: *"two numbers joined by an arrow must be the same quantity at two
times; market-scoped 'current' is incommensurable with the post-scoped stake
beside it."* I implemented the plan's Option-B **mechanism** (right figure =
the author's whole held-side value) and then wrote *"the ruled, accepted cost of
+0 queries"* into the docstring — asserting a ruling that had rejected exactly
that. An author with three Đ1,000 YES posts saw `Đ 1,000 → Đ 4,221` on every
panel. Invisible on staging (single-bet authors), wrong in production, on a
public surface, under a named pseudonym. **Same failure shape as S-3: a
confident justification wrapped around the wrong thing.** Fixed at `83da6ba`;
both new tests are RED against the pre-fix build.

**S-9 · The V13 opposite-sides fixture hit a real DB invariant.** The first
draft seeded one author holding 100 YES *and* 700 NO; Postgres rejected the
INSERT. `positions_one_held_side_idx` is a PARTIAL UNIQUE index on
`(user_id, market_id) WHERE quantity > 0` (ENGINE.11 R-5) — dual-side holding is
structurally impossible, so it cannot be tested because it cannot exist. The
test now seeds the reachable state and still discriminates.

**S-10 · `positions_user_market_side_idx` — an assumption that happened to be
safe.** C8's `positions` LEFT JOIN relies on at most one row per
`(user_id, market_id, side)`. As pushed, that was **unexamined**. It is now
verified: `src/db/schema/bets.ts:93-97` declares it a `uniqueIndex`, so the join
cannot fan out. Recorded as a fact NOW ESTABLISHED, not a fact always known.

---

## Open questions

**OQ-1 · Reviewers — RESOLVED, then immediately productive.** The first Group-2
attempt died on an API spend limit. After the founder raised it, `@code-reviewer`
ran on the FULL range `aff76b3..HEAD` and `@security-auditor` on the ADR-0034 D-1
boundary + the SC-1 image join. The code review returned a **CRITICAL** (OQ-5
below) plus two HIGHs. Three of the four subagent passes this task ran have now
found a real defect each — the cascade is the highest-yield control in the task.

**OQ-5 · ⚠ NEW CRITICAL, UNFIXED, AWAITING A RULING — V17's split bar inverts
the pole on the NO hero panel.** The build paints `bg-yes` (black = YES pole) at
`supportPct`, left-anchored, on BOTH panels. The ratified mockup does not:
`surface_discovery_v1_0.html:459` sets `width = (isYes ? sup : (100-sup))` and
the NO panel's fill carries the static `right` class (`:250`, `.fill.right{inset:
0 0 0 auto}` at `:113`). So the black segment ALWAYS measures the **YES-side**
Dharma — Support on a YES post, Counter on a NO post. The values-log agrees, in
the very file C10 edited: *"split bar (YES share pole black anchored left,
remainder pole white)"* (`:231`). With the mockup's own NO fixture (Support
Đ4,400 / Counter Đ2,000) the mockup paints 31% black; the build paints 68.75%.

Why nothing caught it: C0's guard covers **side-KEYED** expressions, and this
bar has no side value in its colour expression — it fell into the plan's
"proportion bar — permitted" carve-out, and `HeroPanels.tsx` asserts immunity on
exactly that ground. Every V17 test renders `no: null`, so the NO panel's bar is
asserted nowhere.

Two consequences the founder must rule on, which is why it is NOT yet built:
(i) the correct fix makes the expression **side-keyed** (`side === "YES" ?
bg-yes : bg-no` on the support segment), which adds `HeroPanels.tsx` to C0's
pinned inventory — **six → seven**, a number the founder personally specified as
a checkable property; and (ii) the shipped `composer/ReplySplitBar.tsx:64,67`
appears to carry the SAME relation-bound fill on `/m/[slug]`, i.e. a
PRE-EXISTING twin outside this PR's scope (POLISH.3's surface).

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

**OQ-6 · `@security-auditor` — no CRITICAL, no HIGH. Two MEDIUM, both with
PRE-EXISTING root causes, both correctly OUT of this PR.** Verified each claim
at source myself before accepting.

- **The R2 object key embeds the raw `users.id`.** `sign-upload.ts:72` mints
  `u/${userId}/${uploadId}.${ext}`, and C7 now emits a presigned URL over that
  key into the ANONYMOUS `/` HTML. `users.id` is UUIDv7, so its first 48 bits are
  the account-creation unix-ms — an anonymous scraper harvests
  `pseudonym → users.id` plus a signup timestamp, and the identifier is
  trigger-immutable so it survives a pseudonym scrub (which is what §16.5
  erasure is meant to sever). **The codebase already knows this key is
  PII-bearing**: `events/schemas.ts:298` excludes it from the
  `moderation.blocked` payload *"(it embeds the userId → its own strip)"*.
  **Root cause predates this PR** — `load-debate-view.ts:382` already mints the
  identical URL for anonymous viewers of `/m/[slug]`. C7 adds a second emission
  site for the same data, not a new class. The fix is an opaque key namespace or
  a proxy read route — a migration plus a backfill, not a Discovery change.
  **New task, not this PR.**
- **`/` has no request-rate guard.** `proxy.ts:41` matches `/admin/:path*` only,
  and rate-limiting lives inside route handlers, not RSC renders. So a
  `force-dynamic`, uncached, ~97-round-trip page is unauthenticated-reachable at
  any rate. **This PR adds zero queries** (now machine-pinned), so it is not the
  cause — but PERF-1 just bought this surface back from 35 s and nothing stops an
  attacker spending it again. **New task.**

One LOW was in scope and is FIXED in this PR: the never-echo sweep covered
`entryPrice`, `replyDharma` and the image key but **not `currentValue`**, and it
would have passed VACUOUSLY — the removed post had no `positions` row, so the
field was null whether it leaked or not. The removed post now holds a
distinctive 777-share position and the sweep asserts the engine-derived proceeds
string absent. Plan §1a had promised that assertion explicitly.

Two LOWs recorded, not fixed: `currentValue` lowers the COST of scraping figures
already published per-pseudonym (same data, one request instead of N), and
C7's `signRead` catch is unnarrowed (mirrors the shipped `load-debate-view`
posture verbatim; cannot swallow a masking failure, which the auditor confirmed
structurally).

**What the audit confirmed positively**, each checked independently rather than
assumed: ADR-0034 D-1 holds by construction (nothing under `debate-view/**` or
`components/debate/**` imports `discovery/hero`); `currentValue` cannot become
the VIEWER's without adding a parameter and threading a session through three
files; SC-1 obligation (1) holds in its stronger "never read" form; the whole-
surface catch was not narrowed; the V13 LATERAL cannot read another user's bet,
cannot fan out, and `computeSell` is unreachable-by-throw; and INV-3 is
**strengthened**, not merely untouched.

---

## Register rows minted here (no code)

**RR-1 · `(admin)/admin/moderation/_components/ReviewFeed.tsx:102-104` — the
surviving third side-chip hand-roll.** Its mapping is **CORRECT today**
(`bg-yes` for YES), so it is duplication, not inversion. It is **EXCLUDED from
C0's guard by directory** (`src/app/(admin)/**`), and that exclusion is
deliberate: importing a participant debate primitive into admin chrome is an
admin-surface decision, and admin is a structurally separate path (CLAUDE.md §3).

What the row must record: **this is the chip the operator reads sides from while
moderating.** It is unguarded, it is a hand-roll, and it can drift silently —
nothing on disk would redden if someone inverted it, because the only guard that
would catch it excludes its directory by design. **Route to an admin pass, NOT
PRIMITIVES-2.** After this PR, PD-0-10 goes three implementations → one
participant primitive plus this one admin hand-roll.

**RR-2 · OQ-3, `PositionMarker` outline → filled — ACCEPTED, not a defect.**
C4/C4b replaced a hand-rolled `<Badge variant="outline">` marker with the shared
`PositionMarker` (`variant="secondary"`), so the marker chip on `/bookmarks` and
`/u/[pseudonym]` changes from outline to filled. That is the adoption the plan
mandated (adopt, never patch) and it is what delivered the missing
`aria-label="Author Flipped"` — PD-0-10's actual root cause. **Founder-accepted
as a known delta.** Recorded so POLISH.5/.6 inspect the CONSOLIDATED state
rather than re-filing it as a fresh finding.

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
