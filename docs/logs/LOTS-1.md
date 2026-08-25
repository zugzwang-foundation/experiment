# LOTS-1 — per-argument lot accounting (autonomous overnight run)

**Session:** 2026-08-21, 02:41 → close (IST). Autonomous; operator asleep,
R1–R10 pre-ratified at kickoff.
**Base:** `feat/lots-1` cut from `origin/main` = `7832f5a`.
**Full run artifact:** `~/Downloads/zz_LOTS-1_run_2026-08-21T0241.md` (O-11).

---

## What landed

Ten slices, ten branches, **eleven PRs, none merged** (F4). Staging deployed and
verified at canary **`04d05e3`**.

| PR | Slice | What |
|---|---|---|
| [#369](https://github.com/zugzwang-foundation/experiment/pull/369) | S0 | `.gitignore` harness worktrees — **unplanned**; nothing could be pushed without it |
| [#370](https://github.com/zugzwang-foundation/experiment/pull/370) | S1 | **ADR-0039** — R1–R10 verbatim (machine-diffed), invariant impact, migration shape, alternatives, schedule cost |
| [#371](https://github.com/zugzwang-foundation/experiment/pull/371) | S2 | `src/db/schema/lots.ts` + `drizzle/migrations/0025_lots.sql` (Bucket C, 7 CHECKs, no back-fill) |
| [#372](https://github.com/zugzwang-foundation/experiment/pull/372) | S3 | `src/server/lots/{compute,errors}.ts` + 35 tests (24 unit, 11 property × 1000 runs) |
| [#373](https://github.com/zugzwang-foundation/experiment/pull/373) | S4a | `src/server/lots/persist.ts` mint, wired into `place.ts`; `I-LOT-SUM-001` |
| [#374](https://github.com/zugzwang-foundation/experiment/pull/374) | S4b | `src/server/lots/basis.ts`; Đa rewired at both readers; the bookmarks walk MIRROR deleted |
| [#375](https://github.com/zugzwang-foundation/experiment/pull/375) | S5 | per-lot + atomic multi-lot sell; `lotId` on the wire ⚠ **money-exit path** |
| [#376](https://github.com/zugzwang-foundation/experiment/pull/376) | S6 | `scripts/lots-1-staging-wipe.ts` — **executed**; staging wiped, markets preserved |
| [#377](https://github.com/zugzwang-foundation/experiment/pull/377) | S7 | `ProfilePositionRow.lots[]` — SC-1 masked, FI-2 preserved |
| [#378](https://github.com/zugzwang-foundation/experiment/pull/378) | S8 | `LotBreakdown.tsx`; reply stakes render (R-01); exit-one-argument |
| [#379](https://github.com/zugzwang-foundation/experiment/pull/379) | S9 | attracted-value decay (R5) ⛔ **partial — see Open questions** |

**Final gate:** `just verify` green · `pnpm vitest run` → **378 files / 3493
tests passed**, 1 skipped, 4 todo, exit 0.

---

## Decisions made

1. **ADR-0039 is 0039, not 0037.** `ls docs/adr/` on **`origin/main`** gives a
   ceiling of 0038. CLAUDE.md §1 says "next free 0037" and is **stale by two**;
   the working tree (`chore/views-1d`) also showed 0037. Listing the working tree
   and stopping would have minted a colliding number (O-2).
2. **Position-level partial sell splits PRO-RATA across lots.** The one mechanic
   R1–R10 does not state. Chosen because Σ(basis × f) = (Σ basis) × f leaves the
   shipped arithmetic byte-identical; FIFO/LIFO would each assert an ordering
   claim the participant never made. Isolated in one pure function
   (`allocateProRata`), overrulable in a line. ADR-0039 §D-3.
3. **Attribution never vetoes the authority.** A position-level sell **proceeds**
   when the holding has no lots. The first version refused, and four unrelated
   sell suites went red. R2 makes `positions` the aggregate authority and lots
   "attribution beneath" — had the refusal shipped, any drift would have locked a
   participant out of exiting a position and trapped their Dharma. The per-lot
   path still refuses an unknown id, because there the lot *is* the request.
4. **`lots` joins `TRUNCATE_SET`.** It could not go in `NOT_TRUNCATED_UNRATIFIED`
   (documented *and tested* as FK-free; `lots` has three). Not the widening
   ADR-0035 warns needs a superseding ADR — `lots` postdates STAGING-PARITY Q3.
5. **S6 does NOT use `pnpm staging:reset`.** `markets` is in `TRUNCATE_SET`, and
   F3 forbids losing them (they are not reproducible from this repo). The wipe
   **reuses `runGuardedReset`** with a markets-preserving parameter, keeping the
   ADR-0035 atomicity and identifier guarantees.
6. **Exit-one-argument is WHOLE-argument only.** `SellModule` is Đ-denominated
   and its "sell all" lands on exactly zero only when the amount is
   byte-identical to a `currentValue` seed. There is no per-argument
   `currentValue` (FI-2 forbids minting one), so a per-argument module would have
   **stranded dust on every full exit**.
7. **The mint got its own slice.** S2 is schema, S3 pure, S4 the read, S5 the
   sell — **nothing in the kickoff minted a lot.** A sequencing gap, not a
   decision: the mint is fully specified by R1 + D-2. S4 was split into 4a/4b.

---

## Open questions — both for the founder, both from S9

**Q1 · Should the debate view's argument badges show SURVIVING BASIS or the
STAKE AS PLACED?** R6 says "a partially-sold lot renders a reduced figure", but
that badge has always been `bets.stake` and R4 scopes *ranking*, not that
surface. RECON-1 R-12 records the divergence as an open product question.

**Q2 · Does the post-lane author-conviction input `a`** (RANKING.md §3.4's tie
chain and stake lane) key off surviving basis too? R4 names only the reply-lane
ruler and the attracted-value aggregates.

**Why they blocked S9's second half:** `ReplySubstrate.stake` is ONE field
feeding TWO consumers — the ranking ruler (`src/lib/ranking.ts`) and the rendered
reply badge (`ReplyCard.tsx:90` → `ArgProfile`). Moving the ordering necessarily
changes every reply badge in the debate view. Splitting the field in two is a
design decision, and making it silently while "implementing" R4 is the invention
the kickoff forbids.

**Also owed, and deliberately not authored (founder-owned text):**

- **SPEC.1 §23** — the Đa paragraph. D-4 redefines Đa as Σ surviving lot basis,
  and the definitions **genuinely differ**: lot A (100 → 40 shares), lot B (100 →
  20 shares), sell all of B → episode model **133.33**, lot model **100**.
- **SPEC.2 §22.1** — the ADR index + §0 count/ceiling (SYNC-4 rebuilt it
  2026-08-20; ADR-0039 moves it by one).

**Ritual deviation:** no `@code-reviewer` / `@security-auditor` /
`@db-migration-reviewer` cascade was run — the kickoff's slice list contains
none, and a kickoff's reviewer sequence is ratified scope. **PR #375 is the one
that most warrants it**: it changes how a participant exits a position.

---

## Next session starts at

**Answer Q1 and Q2, then finish S9's reply-lane ruler** — that is the smallest
unblocked unit. After it: **S10, per-lot settlement attribution (R7)**, which is
`payout × (lot.surviving_shares / positions.quantity)`, read-time derivation over
existing rows, adding **no `payout_events` row** — so INV-4 is untouched by
construction (ADR-0039 §D-6). It needs the full `src/server/resolution/` ritual.

---

## Context to preserve

- **Staging is EMPTY of participants and has all eight markets**, pools reset to
  the seeded `10000 / 10000` read from each market's own `market.opened` payload.
  ⚠ **The wipe destroyed those events**, so `scripts/lots-1-staging-wipe.ts`
  will refuse at guard 4 on a second run — intended, and the seeds now live in
  that commit and the run log rather than in the database.
- **Đa is now Σ `lots.surviving_basis`.** `episodes.ts` keeps exactly two jobs —
  the graph's SideEpisode gap law and `openingTradeId` for the N-1a argument cell
  — and is no longer on the basis path. `stakedBasis` has **zero readers in
  `src/`**.
- **`buildSellRequest` rebuilds its body key-by-key**, so a new wire key does not
  exist until it is named there. A `lotId` threaded through `SellModule` was
  silently dropped until the helper learned the name.
- **`just verify` was broken in this tree** before S0 — a harness worktree nested
  at `.claude/worktrees/` carries its own `biome.json`, and Biome refuses on a
  nested root config. It was excluded only in `.git/info/exclude`, which Biome
  does not read.
- **Never source `.env.local` before `vitest`** — it exports real values that
  displace `tests/_setup/env.ts`'s `??=` defaults and reds unrelated OTP/Sentry
  tests. The suite's own `DATABASE_URL ??=` already points at `:54322`.
- **Backticks inside a `sql\`\`` template literal terminate it** — SQL comments
  added to the ranking substrates had to drop theirs.

---

## Time

~7 hours wall-clock, single autonomous session. Roughly half in the gate: the
full suite runs ~25–30 minutes and was run to completion at S4b, S5 (twice — the
first caught a design error), S8 and S9.
