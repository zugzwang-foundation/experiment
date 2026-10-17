# ADR-0067 — The experiment ends when its markets close, on 31 December 2026; no freeze is scheduled

| | |
|---|---|
| **Status** | proposed |
| **Date** | 2026-10-13 |
| **Deciders** | Hrishikesh (founder) — ruling D-55, 2026-10-11 |
| **Tracker task** | EXT-1 |
| **Frame document** | SPEC.2 §20.1 (moving the end instant requires an ADR and same-commit SPEC.1 + SPEC.2 updates); decision record amendment 2.13 (D-55) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | — |
| **Amended-by** | — |

> ⚠ **Who wrote this.** The ruling is the founder's. The text was drafted by the EXT-1 dev session from the handover of 2026-10-11, because web Claude's text pack (its item R-2) had not arrived. It states the rulings as that handover states them and adds none. Status stays `proposed` until the founder or web Claude ratifies this text or replaces it.
>
> **Order of landing.** The code and migration this ADR describes landed on `staging` first (PR #674, 2026-10-13); this file follows in the next PR. Both reach `main` together in the release PR, which is what `CLAUDE.md` §5.12's same-commit rule is about.

---

## Context and Problem Statement

The experiment was specified to end at a write-freeze on `2026-11-05 23:59 UTC`: a single `system_state.frozen_at` flag, flipped once, after which every gated state-mutating endpoint returns HTTP 410 `error_experiment_concluded` (SPEC.2 §20). The six live markets carried a `resolution_deadline` on 2026-11-05 — 23:45 UTC by their own text — and SPEC.1 §6.1 obliged the admin to resolve or void every market before the freeze.

On 2026-10-11 the founder ruled (D-55) that the experiment runs to the end of the year. SPEC.2 §20.1 says the instant cannot move without an ADR. This is that ADR.

Three facts shaped it:

- **The freeze was never armed.** SPEC.2 §20.2 ratified two ways to set the flag — a `pg_cron` job and a manual `psql` UPDATE. No migration registers the job.
- **SPEC.1's B8 forbids extending a market's deadline**, and no code path does. The six deadlines live in six `markets` rows on two databases.
- **The date is also in the markets' own words.** Each description states its deadline in prose, Bitcoin's title states it too, and that text belongs to the founder.

This ADR does **not** decide:

- The wording of the six markets, or of the Terms and Privacy Policy (the founder's; EXT-1 handover §5 and §6.5).
- Daily credit, liquidity policy or caps (ADR-0018, ADR-0047).
- Whether the participant report path is built (ADR-0021; its own task).
- AWS spend past 2026-11-05, or the R2 lifecycle rule (ADR-0038; operations decisions).
- Where the dataset release draws its cutoff (SPEC.2 §19.1; not ruled).

## Decision Drivers

1. The founder's ruling: the end is 31 December 2026 at 23:45 UTC, and there is one end time.
2. Nothing about any market changes except its date words.
3. The locks hold: Dharma stays soulbound, every bet carries an argument, the ledger is append-only, admin is not a participant, moderation is untouched.
4. No new capability. In particular, nothing that lets a deadline be extended again.
5. The change must be the same on staging and production, and must refuse to run against text it was not written for.

## Considered Options

1. **Move the end; schedule no freeze; move the six deadlines once, by a data migration** ← chosen (D-55)
2. Move the end and arm the freeze at the new instant
3. Give the product a way to extend a deadline

## Decision Outcome

**Chosen: Option 1.**

1. **The end instant is `2026-12-31T23:45:00.000Z`.** There is one end time; nothing happens at 23:59. In code it is `FREEZE_INSTANT_UTC` (`src/server/markets/create.ts`). The name is historical and is kept: renaming it would touch every countdown and every test that reads it, for no change in behaviour. It is the market-creation deadline ceiling and the target of the header, admin and image-export countdowns. It sets no flag.
2. **No freeze is scheduled. The experiment ends when its markets close.** `system_state.frozen_at`, `isFrozen()`, every gate that reads them, `error_experiment_concluded`, the Bucket-B trigger and every freeze test stay exactly as they are: unchanged, unused, **dormant**. Nothing is deleted. If the flag is ever set by hand, it is never unset except through `docs/runbooks/BREAK_GLASS.md`.
3. **Resolution follows the close.** SPEC.1 §6.1's obligation to resolve every market before a freeze instant is retired.
4. **The six markets' deadlines move once, by migration `0032_ext1_end_moved_to_dec31` — the ruled exception to B8.** It is data only, one statement, forward-only. Keyed on the six market ids: none present is a no-op, some is an exception, all six runs. Each row must be `Open` with a deadline on 2026-11-05 UTC. The date words are replaced by exact pairs, each of which must occur exactly once, and the result must match md5s fixed in advance. B8 stands for the product: the guard (`assertDeadlineNotExtended`) and its negative tests stay, and nothing can repeat the move without a new ruling and a new migration.
5. **One new event type, `market.deadline_moved`.** Payload `{ marketId, previousDeadline, newDeadline, ruling }`, with `previousDeadline` read from the row. The migration appends one per market and nothing in `src/` emits it. `EVENT_TYPES` goes from 25 to 26, with its Zod schema and its SPEC.2 §19.4.1 row.
6. **The dataset release is untimed:** after the experiment closes.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| The end instant | `src/server/markets/create.ts` (`FREEZE_INSTANT_UTC`) · SPEC.2 §20.1 |
| The chart window's end | `src/server/config/limits.ts` |
| The one-time move | `drizzle/migrations/0032_ext1_end_moved_to_dec31.sql` |
| The event type and its payload | `src/server/events/schemas.ts` · SPEC.2 §19.4.1 |
| The dormant freeze | `src/server/system/is-frozen.ts` · `src/db/schema/system.ts` · SPEC.2 §20.2 |
| The ruling | `docs/decisions/RECORD-v2.13-amendment.md` (D-55) |

## Consequences

### Positive

- One end time. The fourteen-minute gap between the markets' close (23:45) and the freeze (23:59) is gone.
- No code path gained the power to move a deadline. The move is six rows, once, with its own ledger entries.
- The migration cannot half-apply and refuses anything it was not written for: a missing market, a market not `Open`, a deadline off 2026-11-05, or one character of drift in the text.
- The freeze machinery is untouched, so every freeze test still passes and the flag still works if it is ever needed.

### Negative

- **The close sweep is now the only thing that ends trading.** The bet path reads `markets.status`, never the clock, so a market stays tradeable until `close-due-markets` closes it. Until D-55 the 23:59 freeze bounded that lag. *Mitigated by:* checking the closer before the instant (EXT-1 handover §10.2) and the manual Close action. A deadline check inside the bet path is a bet-path change, founder-gated, and a separate task.
- **Nothing draws a line under the record.** With the flag never set, signups, image-upload signing and moderation rows keep arriving after the markets close. *Not mitigated here:* where the release cuts is not ruled (`docs/runbooks/dataset-release.md` step 7).
- **The migration is forward-only.** Reversing it needs a new migration with the reverse pairs and its own event, and is possible only before `2026-11-05 23:45 UTC`.
- **ADR-0044's stated mitigation rested on the freeze** and no longer applies. Its conclusion was re-checked and holds; the dataset is not published while any market is `Open`.
- **ADR-0018's dilution bound is exceeded:** about 870 Dharma of daily credit over 87 days against a bound of about 510. Recorded there, not corrected.
- **ADR-0021's re-open trigger (b) has fired.** Recorded there; reopened as its own task.
- **The R2 `u/` lifecycle rule was sized for a 51-day window.** A 90-day expiry now ends three days after the close (SPEC.2 §12.3). An operations decision.
- **ADR-0038 authorises no spend past 2026-11-05**, and D-55 does not extend it.
- **The migration's no-op arm keys on ids only.** A database holding the same six slugs under other ids is recorded as migrated without being moved.

### Neutral

- `FREEZE_INSTANT_UTC` now names an instant at which nothing freezes.
- Thirty ADRs that state the old end, freeze, dataset date or window length carry a D-55 patch record. Their decisions are unchanged.
- Terms and Privacy Policy go to Version 1.1. Nobody is re-prompted: the sign-in gate checks only that an acceptance exists.

## Pros and Cons of the Options

### Option 1 — Move the end; no freeze; one data migration (chosen)

**Pros**

- Builds nothing new: one constant, copy, six rows.
- Leaves every freeze gate and every B8 guard as it is.
- The same file means the same thing on staging, production and an empty test database.

**Cons**

- The end of trading now depends on one sweep running.
- Forward-only.

### Option 2 — Move the end and arm the freeze at the new instant

**Pros**

- Bounds the close lag, as the 23:59 freeze did.
- Draws a line under the record.

**Cons**

- It is a freeze switch, which D-55 rules out: *the experiment ends when its markets close*.
- The scheduled path was never built, so this is new work on a critical path. The manual path needs a person at the keyboard at 05:15 IST on 1 January.
- The flag is one-way. Set a minute early, it also stops the close sweep, which is freeze-gated.

**Verdict:** Rejected by the ruling.

### Option 3 — Give the product a way to extend a deadline

**Pros**

- No migration; the admin moves each market.

**Cons**

- It is the capability B8 exists to forbid, and it would outlive the one use it was built for.
- It moves the deadline column and leaves the date words in six descriptions and one title to be edited by hand.

**Verdict:** Rejected. The EXT-1 handover: *no new capability to extend a deadline*.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.2 §20.1 | The end instant | **Consumes** the rule that moving the instant needs an ADR with same-commit SPEC.1 + SPEC.2 updates; this is that ADR, with SPEC.1 2.3.0 and SPEC.2 2.3.0 |
| SPEC.2 §20.2–§20.3 | The freeze mechanism | **Shapes** — unchanged in code, restated as dormant |
| SPEC.1 §6.1 | B8 — no deadline is extended | **Shapes** — a rider records the one ruled exception; the rule and its guard stand |
| SPEC.1 §6.1, §12 | Pre-freeze settlement obligation | **Shapes** — retired; resolution follows the close |
| SPEC.1 INV-4 | Append-only | **Consumes**, unchanged — the migration INSERTs six `events` rows and updates no Bucket-A row; `markets` is Bucket C |
| SPEC.2 §7, §19.4.1 | Event model; payload strip rules | **Mints** `market.deadline_moved` and its SHIP row |
| SPEC.2 §19.1 | Dataset-build point | **Shapes** — keyed on the markets' close; no market is `Open` at it |
| Tracker | EXT-1 | Depends on this ADR being ratified |

## More Information

- `docs/decisions/RECORD-v2.13-amendment.md` — ruling D-55.
- `docs/plans/EXT-1.md` — the plan, where the build departs from the handover, the open questions, and the security findings cited above (SA-H-2, SA-M-1, SA-H-3, SA-L-1, OQ-9).
- `tests/db/ext1-end-moved.spec.ts` — the migration's tests.
- Staging: PR #674, deployed 2026-10-13. Production: not yet.

---

*ADR-0067 records that the experiment ends when its markets close on 2026-12-31 at 23:45 UTC, that no freeze is scheduled and the freeze machinery stays dormant, that the six markets' deadlines moved once by migration `0032` as the ruled exception to B8, and that `market.deadline_moved` is the event that records it. Superseding it requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
