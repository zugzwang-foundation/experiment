# LOTS-1 — per-argument lot accounting

> **⚠ READ THIS FIRST: this plan was written AFTER the work, at PHASE-0
> (2026-08-21), and saying so is the point of the sentence.**
>
> LOTS-1 ran as a single autonomous overnight session against a kickoff whose
> R1–R10 ruling was pre-ratified, and it landed ten slices without ever writing
> `docs/plans/LOTS-1.md`. All four reviewer passes flagged the absence
> independently, which is the strongest signal available that it mattered: four
> readers arriving separately at *"where is the plan"* is not a formatting
> complaint, it is four readers unable to check the work against anything but
> itself.
>
> So it is reconstructed here from the two artifacts that DO exist — **ADR-0039**
> (the ruling and its decision detail) and **`docs/logs/LOTS-1.md`** (what
> actually landed, and why, slice by slice) — plus the branches themselves.
> **It is a record, not a forecast.** Where a slice deviated from what a plan
> would have said, the deviation is written down as a deviation rather than
> smoothed into an intention. A reconstructed plan that reads as though it
> predicted everything is worse than none: it manufactures a foresight nobody
> had, and the next reader calibrates their trust against it.
>
> CLAUDE.md §5.1 wants the plan committed **before Phase 1 ends**, so that Phase
> 2 can reference it. That did not happen and cannot retroactively. What this
> file can still do is what §5.11 needs it for — give a subagent starting from
> zero context the shape of the work without re-exploring the codebase — and give
> S10 and the ranking lane a specification to be checked against.

**Task:** LOTS-1 · **ADR:** [ADR-0039](../adr/0039-per-argument-lot-accounting.md)
· **Log:** [`docs/logs/LOTS-1.md`](../logs/LOTS-1.md)
· **Base:** `feat/lots-1` cut from `origin/main` = `7832f5a`

---

## 1. The problem, in one paragraph

A participant's holding is one aggregate number with no attribution beneath it.
`positions.quantity` is a single row per `(user, market, side)`, and **Đa** — the
staked basis — is derived by walking that user's whole bet stream and collapsing
every bet into one running figure. Three consequences follow, all measured on
staging rather than argued: a participant whose basis is entirely reply-bets sees
**none** of it rendered (12 of 39 held positions, 31%, across 8 of 9 participants
who hold anything); argument cards show the frozen Bucket-A `bets.stake` while Đa
is multiplied by a surviving fraction rendered nowhere, so after any partial sell
the two are **guaranteed** never to reconcile; and the episode boundary is
invisible with no marker standing in for it.

The fix is to make the unit of accounting equal the unit of meaning: **one
argument, one lot, one basis.**

---

## 2. The ruling — R1–R10

Pre-ratified at kickoff and reproduced verbatim in ADR-0039 §"The ruling
(R1–R10)". **Not restated here**, deliberately: a second copy of a ruling is a
second thing to keep in sync, and the ADR is the one that governs (CLAUDE.md §1
precedence). Read it there.

The two that most often get remembered wrong:

- **R2 — `positions` SURVIVES as aggregate authority; lots are attribution
  BENEATH.** Every design question in this task resolves against that sentence.
- **R1 — "lot" is a word the product must never say.** Every DTO field, badge and
  empty state reaches for argument-language.

---

## 3. Slice decomposition

Ten slices, one branch and one PR each, all targeting `feat/lots-1`.

| Slice | PR | Surface | Critical path? |
|---|---|---|---|
| **S0** | #369 | `.gitignore` harness worktrees | no |
| **S1** | #370 | `docs/adr/0039-*.md` | no (spec lane) |
| **S2** | #371 | `src/db/schema/lots.ts` + `drizzle/migrations/0025_lots.sql` | **yes** — schema/migrations |
| **S3** | #372 | `src/server/lots/{compute,errors}.ts` | **yes** — `src/server/` |
| **S4a** | #373 | `src/server/lots/persist.ts` mint, wired into `place.ts` | **yes** — `src/server/bets/` |
| **S4b** | #374 | `src/server/lots/basis.ts`; Đa rewired at both readers | **yes** |
| **S5** | #375 | per-lot + atomic multi-lot sell; `lotId` on the wire | **yes — the money-exit path** |
| **S6** | #376 | staging wipe, markets preserved; migrate 0025 | no (operational) |
| **S7** | #377 | `ProfilePositionRow.lots[]` DTO | **yes** — read model |
| **S8** | #378 | `LotBreakdown.tsx`; reply stakes render; exit-one-argument | no (UI) |
| **S9** | #379 | attracted-value decay (R5) — **partial** | **yes** |
| **S10** | — | per-lot settlement attribution (R7) | **yes — NOT BUILT** |

### Sequencing constraints that are real (as opposed to conventional)

1. **S2 before S3.** The pure core's types mirror the table's columns; writing
   them in the other order invites the schema to be shaped by the convenience of
   the functions rather than by the invariant.
2. **S3 before S4a.** The mint must route through the shipped pure core, never
   compute a basis itself — a fixture or a caller that computes its own surviving
   basis is a second implementation, and it will agree with the engine right up
   until the moment it matters.
3. **S4a before S4b before S5.** You cannot re-base Đa on lots that do not exist,
   and you cannot sell from them either.
4. **S6 after S5.** The staging fixture set must exercise the sell path, so the
   migration and the sell both have to exist before the data is rebuilt.

### ⚠ The sequencing gap, recorded as a gap

**Nothing in the kickoff minted a lot.** S2 was schema, S3 pure, S4 the read, S5
the sell — and the write that creates a `lots` row appeared in no slice. It was
caught during execution and S4 was split into **S4a (mint) / S4b (Đa read)**.

This is the single most useful thing in this document, and it is exactly the
thing a plan written first would have caught: a slice list is checkable against
"is every row of the new table written by somebody?" in about a minute, and
nobody had a list to check. The gap was not a decision — R1 + ADR-0039 D-2 fully
specify the mint — it was an omission that survived because there was no artifact
whose job was to notice it.

---

## 4. Test plan

Tests-first per CLAUDE.md §5.6 on every business-logic slice.

| Slice | Tests | Standard |
|---|---|---|
| S2 | `tests/db/` schema + constraint specs | every CHECK rejected at the storage layer, fixture-bypass |
| S3 | 35 tests — **24 unit + 11 property × 1000 runs** (fast-check) | the pure core is where property tests earn their place: a continuous decimal domain with a partition invariant |
| S4a | `I-LOT-SUM-001` | the R2 equality, minted as an invariant-class spec |
| S4b | Đa re-basing at both readers | the bookmarks-walk MIRROR **deleted**, not left beside the new path |
| S5 | per-lot + multi-lot sell, oversell pre-check, rollback | ⚠ money-exit; the atomic multi-lot sale commits or unwinds together |
| S7 | DTO shape | **SC-1**: assert the BODY's absence, not the row's |
| S8 | component render (jsdom, per-file docblock) | no `jest-dom` — plain DOM assertions |

**The R2 invariant is the floor.** `I-LOT-SUM-001` asserts
`Σ lots.surviving_shares == positions.quantity` per `(user, market, side)`.

⚠ **It proves the RULE and observes NOTHING.** It seeds its own rows into a local
ephemeral Postgres and truncates after; it can no more see staging or production
than any other unit of the suite. Both ADR-0039 and `lots/persist.ts` once
claimed it was a live-data backstop; both were corrected at PHASE-0. **A
live-environment Σ check is OWED** and belongs with the staging gates, beside
conservation and durable-receipt integrity.

---

## 5. Invariant obligations

Per ADR-0039 §"Invariant impact" — none of INV-1…INV-4 changes, and two are
reinforced:

- **INV-1** — the lot INSERT joins the same W-1 SERIALIZABLE transaction. A lot
  cannot exist without a bet (FK + `lots_bet_id_uq`) and a bet cannot exist
  without a comment (`bets.comment_id` NOT NULL), so **a lot cannot exist without
  an argument** — R1 stated in storage.
- **INV-2** — `surviving_basis` is a *cost record*, never a spendable balance. No
  transfer surface is created. `dharma_ledger` untouched.
- **INV-3** — no lot path reads or writes `comments.side_at_post_time`.
- **INV-4** — S10's attribution is read-time derivation over existing rows; no
  `payout_events` row is added, updated or deleted.
- **NEW, invariant-class** — R2, above.

---

## 6. Ritual gates

Per CLAUDE.md §5.6/§5.7/§5.10/§5.11/§5.12. Every slice touching
`src/server/{bets,dharma,positions}/` or `src/db/schema/` carries writer/reviewer,
the invariant gate, a same-commit ADR/spec rider, and the pre-PR self-audit.

**⚠ RITUAL DEVIATION, and it is on the record rather than in a footnote.** No
`@code-reviewer` / `@db-migration-reviewer` / `@security-auditor` cascade was run
during LOTS-1. The kickoff's slice list contained none, and a kickoff's reviewer
sequence is ratified scope — so running one would itself have been a deviation.
The deviation is real either way, and **PR #375 is the one that most warrants
it**: it changes how a participant exits a position.

---

## 7. What is NOT in this task

- **S10 — per-lot settlement attribution (R7).** Read-time derivation,
  `payout × (lot.surviving_shares / positions.quantity)`, adding no
  `payout_events` row so INV-4 is untouched by construction (ADR-0039 D-6). Needs
  the full `src/server/resolution/` ritual.
- **S9's second half — the reply-lane ordering ruler.** See §8.
- **SPEC.1 §23's Đa paragraph.** Founder-owned text. D-4 redefines Đa as Σ
  surviving lot basis and the definitions **genuinely differ** — lot A (100 → 40
  shares), lot B (100 → 20), sell all of B: episode model **133.33**, lot model
  **100**. Naming it precisely is the honest discharge of a rider you may not
  author.

---

## 8. Open questions — both founder-owned, both from S9

**Q1 · Should the debate view's argument badges show SURVIVING BASIS or the STAKE
AS PLACED?** R6 says "a partially-sold lot renders a reduced figure", but that
badge has always been `bets.stake`, and R4 scopes *ranking*, not that surface.

**Q2 · Does the post-lane author-conviction input `a`** (RANKING.md §3.4's tie
chain and stake lane) key off surviving basis too? R4 names only the reply-lane
ruler and the attracted-value aggregates.

**Why they blocked S9's second half, and why stopping was right.**
`ReplySubstrate.stake` is ONE field feeding TWO consumers — the ranking ruler
(`src/lib/ranking.ts`) and the rendered reply badge (`ReplyCard.tsx` →
`ArgProfile`). Moving the ordering necessarily changes every reply badge in the
debate view. **Splitting that field in two is a design decision**, and making it
silently while "implementing" R4 is precisely the invention the kickoff forbids.

**The consequence of stopping is a live inconsistency, and it is now recorded in
the code** (`src/lib/ranking.ts`, beside `compareReply`, at PHASE-0): the
attracted-value aggregate decays but the ordering ruler does not, so **a
sold-out reply keeps its top slot on a stake it no longer holds** — and
`twoSlot` will surface it as the best argument on its side. A deferral that
lives only in a report is not recorded.

---

## 9. Deviations from what a plan would have said

Written plainly, because this file exists to be checkable rather than tidy.

1. **S0 was unplanned.** Nothing could be pushed without it: a harness worktree
   nested at `.claude/worktrees/` carries its own `biome.json`, and Biome refuses
   on a nested root config. `.git/info/exclude` does not help — Biome does not
   read it.
2. **S4 split into 4a/4b** — the mint gap in §3.
3. **The first version of the position-level sell REFUSED when the holding had no
   lots**, and four unrelated sell suites went red. That red was correct and load
   bearing: R2 makes `positions` the authority, so a refusal would have locked a
   participant out of exiting a position they hold and trapped their Dharma
   behind a bookkeeping disagreement. *(PHASE-0 found the same veto still live on
   the PARTIAL-drift path — some lots, but summing to less than the position —
   and clamped it. Zero lots had been handled; "not quite enough lots" had not.)*
4. **Pro-rata allocation is the one mechanic R1–R10 does not state.** Chosen
   because it changes nothing observable: `Σ(basis × f) = (Σ basis) × f`. FIFO or
   LIFO would each assert an ordering claim the participant never made, on the
   one control that names no argument. Isolated in `allocateProRata`, overrulable
   in a line.
5. **Exit-one-argument is WHOLE-argument only.** `SellModule` is Đ-denominated
   and its "sell all" lands on exactly zero only when the amount is byte-identical
   to a `currentValue` seed; there is no per-argument `currentValue` and FI-2
   forbids minting one, so a per-argument module would have stranded dust on every
   full exit.
6. **S6 does NOT use `pnpm staging:reset`.** `markets` is in `TRUNCATE_SET` and
   the eight markets are not reproducible from this repo. The wipe reuses
   `runGuardedReset` with a markets-preserving parameter, keeping ADR-0035's
   atomicity and identifier guarantees. *(PHASE-0 committed
   `docs/data/staging-markets-snapshot.{json,md}` so a future rebuild no longer
   depends on that care.)*
7. **ADR-0039 is 0039, not 0037.** CLAUDE.md §1 said "next free 0037" and was
   stale by two; the working tree agreed with it. `ls docs/adr/` on `origin/main`
   gave 0038. Listing the working tree and stopping would have minted a colliding
   number — O-2, and the third time that sentence has gone stale.

---

## 10. Traps for whoever picks this up

Carried forward from the run so they are not rediscovered:

- **`buildSellRequest` rebuilds its body key-by-key**, so a new wire key does not
  exist until it is named there. A `lotId` threaded through `SellModule` was
  silently dropped until the helper learned the name.
- **Never source `.env.local` before `vitest`.** It exports real values that
  displace `tests/_setup/env.ts`'s `??=` defaults and reds unrelated OTP/Sentry
  tests in files nobody touched. The suite's own `DATABASE_URL ??=` already
  points at `:54322`.
- **Backticks inside a `` sql`` `` template literal terminate it** — SQL comments
  added to the ranking substrates had to drop theirs.
- **`stakedBasis` has zero readers in `src/`** after S4b. `episodes.ts` keeps
  exactly two jobs — the graph's SideEpisode gap law and `openingTradeId` for the
  N-1a argument cell — and is no longer on the basis path.
- **The full suite runs ~25–30 minutes.** Budget for it; a foreground call dies
  at the 10-minute cap.
