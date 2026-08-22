# RANK-1 — close the free rank-capture

| | |
|---|---|
| **Task** | RANK-1 |
| **Date** | 2026-08-22 |
| **Branch** | `fix/rank-1-surviving-basis-ranking` |
| **Base** | `7fdaa99` (`main`) |
| **Governing ADR** | ADR-0039 R4 (**amended by this task** — see its Patch record P1) |
| **Governing spec** | `docs/specs/RANKING.md` §2, §3.3, §3.4, §3.6, §7, §7.3, §8 |
| **Ruling** | Web-authored (R-A … R-H below), reproduced verbatim; executed by Claude Code |

---

## Why this task exists

Confirmed adversarially by `@security-auditor` during MERGE-1 — **not hypothesised.**

Place a large reply-bet on a rival's post. `compareReply` ranks the lane on frozen
`bets.stake`, so the reply takes the top Support or Counter slot and `twoSlot`
surfaces it to every visitor as the best argument on that side. Then Exit that
argument. **The CPMM is fee-less**, so the round trip returns the stake minus
~1e-18 of dust. The lot goes Sold; `bets.stake` is Bucket-A immutable and never
moves. **The slot is permanent, the cost is dust, and it repeats on every post in
every market.**

Two things shipped at LOTS-1 made it worse, not better:

1. **Per-lot sell (ADR-0039 R3) made the exit SURGICAL.** Before it, recovering
   one reply's stake shrank every argument the attacker held in that market
   pro-rata.
2. **Attracted-value decay (R5) made it INVISIBLE.** The captured slot now
   renders `Đ 0` attracted value beside a `#1` ordering — the signal a reader
   would have used to detect the manipulation, inverted into what looks like a
   rounding artifact.

**There are THREE frozen-stake rulers.** One was closed; two were open:

| | Ruler | Site | State before RANK-1 |
|---|---|---|---|
| (i) | reply-lane ordering | `compareReply` on `ReplySubstrate.stake` | **OPEN** |
| (ii) | post-lane tiebreak | `tiebreak()` on `PostSubstrate.authorStake` | **OPEN** — named in no document; found at MERGE-1 as SURPRISE S-2 |
| (iii) | attracted aggregates | three SQL sites | closed at LOTS-1 S9 |

Ruler (ii) decides `topOrder` whenever the lane margins tie — **the common case**
in a young market where most posts sit BELOW_FLOOR (RANKING.md §3.3) — and
decides `profileOrder` outright.

*"No stake, no voice" is the product. If rank is buyable and refundable for dust,
the mechanism that makes the experiment mean anything is decorative.*

---

## The ruling (R-A … R-H) — web-authored, reproduced verbatim

> **R-A** ALL THREE RANKING INPUTS KEY OFF SURVIVING LOT BASIS, no exceptions:
> the reply-lane ordering ruler, the post-lane `tiebreak()` author-conviction
> input, and the attracted aggregates. If the money can leave, the rank it
> bought leaves with it.
>
> **R-B** THE BADGE FOLLOWS THE RULER. `ReplySubstrate.stake` and `authorStake`
> each feed TWO consumers — the ruler and the rendered badge. They move
> together. Both badges render CURRENT basis: the reduced figure with the
> ORIGINAL STRUCK THROUGH when partially sold, and `Đ 0` + the `Sold` tag at
> exactly zero (R6's predicate: `surviving_shares = 0`). The historical fact
> survives in the strikethrough; nothing is erased.
>
> **R-C** THE LANE ORDER WILL CHANGE, AND THAT CHANGE IS THE FIX, NOT A
> REGRESSION. Any shipped test asserting a specific ordering that goes red must
> be UPDATED to the new expected order with the reason recorded in the test.
> ⛔ NEVER "fix" a red ordering test by preserving the old order. If you cannot
> tell which it is, the test is the finding — report it.
>
> **R-D** KEEP THE `COALESCE(<surviving basis>, <frozen stake>)` FALLBACK at
> every site. Removing it zeroes ranking weight for any lot-less row, which is a
> worse failure than the hole it leaves for a class that no longer arises —
> every bet since `0025` mints a lot inside the same transaction.
> ⚠ BUT: `src/lib/ranking.ts`'s forward instruction says to substitute
> `SUM(l.surviving_basis)` bare. All three shipped sites use the COALESCE form.
> Following that instruction literally zeroes every lot-less bet. FIX THE
> COMMENT to match what ships (O-9).
>
> **R-E** NO MIGRATION. Read-path only.
>
> **R-F** THREE SITES, THREE TESTS. `src/server/debate-view/ranking-substrate.ts`,
> `src/server/profile/arguments.ts` and `src/server/bookmarks/list.ts` carry
> BYTE-IDENTICAL blocks and only the first is exercised. Every site gets a decay
> assertion. They are separately-maintained copies: a future edit that diverges
> one of the two untested sites ships green today.
>
> **R-G** AMEND ADR-0039's R4. As written it names the reply ruler and the
> attracted aggregates. It does NOT name `tiebreak()`. Amend R4 to name all
> three rulers and record the confirmed exploit as the reason.
>
> **R-H** UPDATE RANKING.md. §3.4 (the tie chain) and §3.6 (the reply ruler)
> both describe frozen stake. Both are now wrong.

---

## Design

**One field, two consumers, substituted at the query layer.** `tiebreak()` and
`compareReply()` are byte-unchanged as code — what they *read* changed beneath
them. That is R-B made structural rather than promised: an ordering justified by
one quantity cannot sit beside a figure reporting another, because there is only
one quantity.

`PostSubstrate` / `ReplySubstrate` each gain two fields, **required, not
optional** (O-1 — structural beats procedural; a required field makes every
stale construction site a compile error, which is precisely the drift R-F
exists to prevent):

| Field | Meaning |
|---|---|
| `authorStake` / `stake` | **CURRENT** — `COALESCE(lots.surviving_basis, bets.stake)`. The ruler AND the badge. |
| `authorStakeOriginal` / `stakeOriginal` | frozen `bets.stake`, for the strikethrough. **Never sorted on.** |
| `authorSold` / `sold` | `COALESCE(lots.surviving_shares = 0, false)` — R6's predicate, exactly zero. |

**No migration** (R-E): `lots.surviving_basis` already exists, and `lots` is 1:1
with `bets` (`lots_bet_id_uq`), so every lot reach is a unique-index lookup that
cannot fan an aggregate out.

### Query sites — the brief said three; there are FIVE

| # | Site | Ruler | In R-F's list? |
|---|---|---|---|
| 1 | `src/server/debate-view/ranking-substrate.ts` | (ii) + aggregates | ✅ |
| 2 | `src/server/profile/arguments.ts` | (i) + (ii) + aggregates | ✅ |
| 3 | `src/server/bookmarks/list.ts` | (i) + (ii) + aggregates | ✅ |
| 4 | `src/server/debate-view/reply-substrate.ts` | **(i), the debate view** | ❌ SURPRISE S-A |
| 5 | `scripts/verify-ranking-staging.ts` | (ii) + aggregates | ❌ SURPRISE S-B |

**S-A** — R-F's three-site list is correct for the *attracted aggregates* and
incomplete for the *reply ruler*. `reply-substrate.ts` is the loader that feeds
`twoSlot` on the debate view — the exact surface the exploit captures — and it
had no `lots` join at all. R-A ("all three ranking inputs … no exceptions")
reaches it; R-F's list says where the *tests* go, not where the *fix* goes.

**S-B** — `scripts/verify-ranking-staging.ts` carries a hand-kept copy of the
substrate SQL and **had already drifted**: it still read frozen `SUM(rb.stake)`
after LOTS-1 moved the aggregates, so the instrument whose job is to confirm the
engine's ranking against real staging rows had been computing a different order
from the application for a release, with nothing to say so.

### Badge surfaces (R-B)

- `src/components/debate/ArgProfile.tsx` — **one component, five call sites**
  (`PostCard`, `ReplyCard`, `PostFocusHeader`, both pop-ups in `dialogs.tsx`).
- `src/components/profile/ArgumentList.tsx` — the profile's post + reply badge.
- ⛔ `"Lot"` never reaches user-facing copy (ADR-0039 R1) — pinned by a
  `textContent` assertion.

**Out of scope, recorded as an open item:** the Discovery hero's `Đa → Đb` arrow
(`HeroPanels.tsx`) renders `post.authorStake`, so its LEFT figure now carries the
surviving basis — correct and unavoidable under R-A. No strikethrough or `Sold`
tag is added there: the hero's composition is founder-ruled (OD-1 = Option B) and
adding a marker to it would be a design decision no ruling covers.

---

## Slices

| # | Slice | State |
|---|---|---|
| S1 | Reproduction test, RED first — DB-backed, through the real engine | **RED confirmed, then GREEN** |
| S2 | Baseline lane order + performance, before any change | done |
| S3 | ADR-0039 R4 amendment (R-G) + RANKING.md (R-H) | done |
| S4 | Reply-lane ordering ruler (R-A i) | done |
| S5 | Post-lane `tiebreak()` (R-A ii) | done |
| S6 | The badges (R-B) | done |
| S7 | Tests at every site (R-F) + performance re-measurement | done |
| S8 | `@code-reviewer` → `@security-auditor`, SEQUENTIALLY | — |
| S9 | One PR against `main`. ⛔ DO NOT MERGE | — |

### Tests

| File | What it proves |
|---|---|
| `tests/server/lots/rank-capture.test.ts` | **The acceptance criterion.** Both rulers: capture works, exit happens, slot is released. RED on `7fdaa99`. |
| `tests/server/lots/rank-decay-parity.test.ts` | R-F — sites 1-4 each return current basis + intact original + exact `Sold`. |
| `tests/unit/ranking/substrate-site-parity.test.ts` | Source scan — the only control that can reach site 5, which cannot be tested behaviourally (it dials the live staging DB). |
| `tests/unit/debate/render/arg-stake.test.tsx` | R-B — reduced-with-strikethrough, `Đ 0` + `Sold` at zero, and never the word "lot". |

### Fences held

- **F1 PRODUCTION FORBIDDEN** — `zbvprdcyxhlguxbostdj` appears in no command; no
  `prd` Doppler config touched.
- **F2 NO STAGING WRITE** — no `staging:*` script run, no push to `staging`.
- **F3 NO MIGRATION / NO DDL** — read-path only; migration files byte-unchanged.
- **F4 NO MERGE** — one PR, opened only.
- **F5 HALT ON RED** at each slice boundary.
- **F6 DEDICATED WORKTREE** — `wt-rank1`, cut fresh from `origin/main`.
  `wt-merge1` was NOT reused: another session held it, running a full suite.
