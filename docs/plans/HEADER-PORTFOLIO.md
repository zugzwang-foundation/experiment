# HEADER-PORTFOLIO — Σ open-position value in the signed-in Đ cluster

> **Doc:** `docs/plans/HEADER-PORTFOLIO.md`
> **Status:** ratified — operator-ratified 2026-08-02, web-authored, CC-committed
> **Base:** `origin/main` @ `acc2e03804661a88c0ca304bee5bb313c0d5454e` (PR #283)
> **Ground:** `HEADER-PORTFOLIO-recon.md` (md5 `329bddd77381b1fdc9849c5bb5e7af53`) read at `a08f1ff`, delta-checked at `acc2e03`
> **Precedence:** SPEC.1 / SPEC.2 > ADRs > design-canon > this plan
> **Ritual:** plan → ratify → fresh-chat execute → `@code-reviewer` → **Gate C web diff-read before merge**. No `@security-auditor`
> **Timeline:** 44 days to go-live (Sep 15)

## §0 · What this builds

**Portfolio** — the Σ of the viewer's open-position execution values (Đb) — rendered as the FIRST of two stats in the signed-in global-header Đ cluster, beside the shipped Balance.

The cluster becomes what the locked mockup specifies: one bordered box, one `Đ` glyph, a hairline separator, then two column-stats — `PORTFOLIO` then `BALANCE`. The shipped `BalanceCluster` is a flat 3-span row that matches neither the mockup nor a two-stat shape, so this task rebuilds it and renames it `DharmaCluster`.

**Plain-language:** Balance is spendable cash; Portfolio is what your live bets are worth if you exited right now. Together they are net worth (SPEC.1 §10.8).

**Not a tab. Not a page. Not a route.** One number in the header bar.

## §1 · Authority — the spec-first gate

| Tier | Source | What it establishes |
|---|---|---|
| **1** | SPEC.1 §10.8 (`:588`) | The basis. `net worth = free Dharma + Σ Đb over open positions`; Đb = `computeSell(quantity).proceeds`, impact-inclusive per cpmm §6.3. **Mark-to-market explicitly rejected.** "One holding never shows two different current values" |
| **1** | SPEC.1 §10.8 (`:590`) | 0-dp `ROUND_HALF_UP`, never `-0`, view-layer only, rounded values terminal. **SILENT on digit grouping** — see R4 |
| **1** | SPEC.1 §23 (`:1596`) | `**Positions value** — Σ Đb over open holdings (§10.8 basis).` **This is the same quantity Portfolio renders** |
| **1** | SPEC.1 §23 (`:1592`) | `Basis identity (FI-2, codified): Current **is** Đb; one holding never shows two different current values…` |
| **1** | SPEC.1 §21.1 (`:1495`, `:1496`) | Anti-conflation (HARD). Visitor count never co-located with any Dharma figure |
| **1** | **SPEC.1 §21.8 — NEW, this task** | The signed-in Đ cluster. **Does not exist. Authored here, committed same-PR.** See §3 |
| **3** | `docs/plans/UI-A1.md:34` | `OQ-2 **DEFER** — Đ Portfolio/Balance is A2/A3 scope`. The operative deferral this task discharges |
| **3** | `docs/plans/SHELL-COMPLETE.md:292` | The fork line. Amended by this task — see §5 |
| **2** | W2.4/.5/.14 close-out — **PK-only, CC cannot read** | `[DECISION] Đ signed-in = glyph + Portfolio + Balance (two Đ stats)`. Quoted into §4 |
| **4** | `docs/design/mockups/DESIGN_W2_4-5-14_global-header_mockup-v0_2.html:268–281` + CSS `:123–130` | The cluster's DOM and anatomy. **In the repo — read it directly** |

**⚠ The gate did NOT clear on spec text.** "Portfolio" appears **zero times** in `docs/specs/`. Neither does any clause placing a Đ figure in the global header. Balance shipped into the same hole at #283.

**Ruling:** §21.8 is authored as a same-commit rider inside this PR — the DROUND (`5035183`) and UI.13 precedent, where the governing clause lands with the code it governs. It covers **both** stats, discharging Balance's live gap at the same time.

**§22 `:1550`'s "balance chip" is corroboration only, never mandate** — `docs/plans/UI-A4.md:32` defers it: *"The Đ balance chip is deferred (OQ-2 of A1)"*. "Descriptive drift" is the recon's gloss, not A4's text. Citing it as a mandate would imply A4 shipped in violation.

## §2 · Thesis invariants

| Invariant | Touched? | How preserved |
|---|---|---|
| INV-1 bet↔comment atomicity | no | Read-only. No write path, no composer surface |
| INV-2 no overdraft / non-transferable | no | Renders a derived figure. No transfer affordance created or implied |
| Append-only ledger | no | Zero writes. No DDL, no migration, no event type |
| Admin is not a participant | no | `(admin)` has no layout and mounts no header. Untouched |
| Moderation safety | no | No content rendered. No comment, title, body or image is read |
| §21.1 anti-conflation (HARD) | **yes — structurally** | Both Đ stats stay LEFT of the divider; `VisitorCounter` remains the SOLE element to its right. Mechanically enforced by T4 |
| FI-2 one-holding-one-value | **yes — the core constraint** | Same-source derivation + a byte-identity test against `loadProfilePositions`. See §4.3 |

## §3 · SPEC.1 §21.8 — the rider (web-authored, verbatim)

Insert as a new `### 21.8` at the tail of §21, after 21.6, **leaving 21.7 reserved for the freeze-banner rider** (B8's gate is written as "the SPEC.1 §21.7 rider" in merged plan text; reusing the number would contradict it). Amend §21's preamble count. Version `1.0.26 → 1.0.27`. Add the §20 change-log row.

**CC does not draft this text.** It arrives from web at the rider commit. This section names its coverage only:

- The signed-in global header carries a Đ cluster of exactly two stats: **Portfolio** then **Balance**, in that DOM order, under one `Đ` glyph.
- **Portfolio** = Σ Đb over the viewer's open holdings — the §23 Positions-value quantity on the §10.8 basis. One holding, one value: the header figure and the §23 tile are byte-identical.
- **Balance** = spendable-today (ledger `balance_after` + unclaimed `DAILY_CREDIT_DHARMA`), deliberately distinct from the §23 Wallet-value tile's raw ledger figure. Both true; they measure different things.
- **Placement is load-bearing, not decoration.** Both stats sit left of the §21.1 register boundary; the identity chip separates the cluster from the divider; `VisitorCounter` is the sole element right of it.
- **Absence vs zero.** No ledger row → the cluster does not render. No open positions → Portfolio renders `Đ 0`. Zero is a fact; absence is a different fact.
- Signed-out state is unchanged (§21 existing text): no Đ figure for the audience.

## §4 · Rulings — RATIFIED 2026-08-02

| # | Ruling |
|---|---|
| **R1** | **Basis = Đb execution value.** `computeSell(quantity).proceeds`, impact-inclusive. **Mark-to-market is not a display basis** (SPEC.1 §10.8 `:588`, superseding W2.6). Never describe Đb as mark-to-market in code, comment, commit body or PR text |
| **R2** | **Second call site is legal; second formula is not.** FI-2 governs basis, not call count — `computeSell` already has twelve invocations across eight consuming modules (plus the definition in `cpmm/calculate.ts`). Legality is conditional on R3 |
| **R3** | **Same-source derivation, the UI-A6 mandate.** The new read's SQL sourcing mirrors `loadProfilePositions`' statements 1·2·4 exactly — same tables, same columns, same predicates, same discriminant. **Do NOT invent a different source.** `@code-reviewer` diffs the two sourcings; Gate C confirms. Precedent: `src/server/bookmarks/figures.ts:12–24`, shipped |
| **R4** | **Ungrouped.** Portfolio renders through `formatDharma`, matching the §23 Positions-value tile (`ProfileTiles.tsx:29`) and the shipped Balance. §10.8 is SILENT on grouping; the closest analogue of this exact number is ungrouped, and FI-2's spirit says the header renders it as its tile does. The mockup's `Đ 2,480` is tier-4 illustrative. **Grouping is class R, routed to POLISH as one product-wide ruling — not settled here** |
| **R5** | **Open/settled discriminant = `payout_events` row existence.** Settlement does NOT zero `positions.quantity` — `src/server/resolution/settle.ts` writes `resolutionEvents`, `payoutEvents`, the ledger chain and `markets → Resolved`, and never touches `positions` (same for `void.ts`, `correct.ts`). `quantity > 0` alone would `computeSell` against a resolved pool and report a phantom figure. Zero-amount legs are real records (`settle.ts:126–137`), so row-**existence** is sound; amount-nonzero is not |
| **R6** | **Sibling module, parallel reads.** A new `src/server/dharma/header-portfolio.ts` beside `header-balance.ts`, both awaited in one `Promise.all`. Statement count is identical either way (recon C22); `Promise.all` makes them concurrent, and a widened single module would serialise four statements. It also keeps `header-balance.ts`'s T5a parity test scoped to one concern. **The `Promise.all` lives in `src/app/(public)/layout.tsx`** — under `src/app/`, not `src/server/`, so **SG2 is satisfied**. No widened server-side entry point is created; there is no orchestrating module. The layout awaits both reads concurrently and passes two props down. Any reading that puts the `Promise.all` inside `src/server/` violates SG2 and is wrong |
| **R7** | **⚠ The statement-order constraint does not transfer — and must not be broken.** `header-balance.ts` pins balance-first / cursor-second (MEDIUM-1, `3b7db8d`): reversing turns a one-credit understatement into a `DAILY_CREDIT_DHARMA` overstatement. Portfolio runs as a **separate module**, so that ordering is untouched. **The two modules are never interleaved or fused into one read.** State this in-file so no later pass "optimises" it |
| **R8** | **Fail-safe posture inherited.** The Portfolio read wraps its body in try/catch, reports via `safeCaptureException` with `tags: { kind: "header_portfolio_read_failed" }`, and returns `null`. Chrome on four routes must never 500 a page |
| **R9** | **Zero ≠ absence.** No open positions → `"0"`, rendered `Đ 0`. No ledger row → `null` → the whole cluster hides. The cluster's render gate is Balance's null, not Portfolio's |
| **R10** | **Rename to `DharmaCluster`.** A component named `BalanceCluster` rendering two stats is drift. One file, four testid references in `tests/unit/shell/balance-cluster.test.tsx`; the test FILE is renamed too (`git mv` → `dharma-cluster.test.tsx`), and the testid renames `balance-cluster` → `dharma-cluster` |
| **R11** | **Build the mockup's real anatomy now.** POLISH.1 is held behind this task precisely so the header is final before its V-batch measures it; POLISH-STRATUM §8 rule 7 forbids polishing a surface with an open build PR, and §9 forbids feature construction inside a polish pass. Deferring the anatomy defeats the ratified sequencing |
| **R12** | **Accept +3 statements × 4 routes**, uncached, every render. An order of magnitude below the fork's stated N+1 premise, which measurement falsified |

### §4.3 · The FI-2 identity contract (the load-bearing one)

```ts
// For the same userId, at the same instant, against the same pool state:
Σ over open rows of loadProfilePositions(db, { userId }).current
  ===  getHeaderPortfolio(db, userId)   // byte-identical strings
```

This is the same invariant `UI-A6.md:169` established for bookmarks and `bookmarks/figures.ts` shipped. It is achieved by **same-source derivation, not by extraction** — `UI-A6.md:174` ruled diff-and-test over refactor, and `positions.ts` remains read-only here.

Locked by **T3** (§7). If T3 cannot be made to pass, the read is wrong — do not weaken the test.

## §5 · Scope guards — HARD

| # | Guard |
|---|---|
| **SG1** | **No read-model field is added.** `DebateViewModel`, `ViewerMarketContext`, `MarketSummary`, `ProfileTiles`, `ProfilePositionRow` — all untouched. ADR-0034 D-1 posture |
| **SG2** | **Exactly ONE new file under `src/server/**`** — `src/server/dharma/header-portfolio.ts`. **Zero edits to any existing file under `src/server/`.** Named explicitly read-only: `profile/positions.ts`, `profile/tiles.ts`, `debate-view/viewer-context.ts`, `dharma/persist.ts`, `dharma/header-balance.ts`, `cpmm/calculate.ts`, `resolution/**`, `bets/**` |
| **SG3** | **Zero DDL.** Migration head stays `0024_bookmarks`. No new event type (`EVENT_TYPES` stays 24). No ADR (next free stays 0035) |
| **SG4** | **Zero writes.** No transaction, no `BEGIN`/`COMMIT`. Top-level `DbClient` only |
| **SG5** | **§21.1 DOM order (HARD).** Both Đ stats LEFT of the divider at the right zone; `VisitorCounter` the SOLE element to its right; the identity chip between cluster and divider. Enforced by T4, not by prose |
| **SG6** | **The divider is a named untouchable.** It carries no `data-testid` and must not gain one. It is the `w-px` hairline |
| **SG7** | **`(auth)` is out of scope.** That layout passes neither prop. Signed-out by definition; onboarding may have no ledger row |
| **SG8** | **The DROUND guard.** `portfolio` (and any other new Đ-bearing identifier) MUST be added to `MONEY_IDS` in `tests/unit/design/no-raw-dharma-render.test.ts`. The guard is an allow-list of names, not a detector — **a missing identifier passes silently.** RED must be ATTRIBUTED: with the old set restored and the violation injected, the suite passes; with the new set, it fails |
| **SG9** | **SPDX on every new file** — `// SPDX-License-Identifier: AGPL-3.0-or-later` as line 1. Two new files this task (the read module; no other new `src/` file if the cluster is renamed via `git mv`) |
| **SG10** | **No new runtime dependency.** `decimal.js` via `CpmmDecimal` is the only arithmetic — never a JS float on a Đ value (CLAUDE.md §2) |
| **SG11** | **Token slots only.** Zero raw hex, zero Tailwind palette classes (`no-raw-hex-view-layer.test.ts` + the R15 gap). `globals.css` untouched |
| **SG12** | **No responsive work, no accessibility work.** Desktop-only 1440 (G1); a11y → A11Y.0 |

**Any server-side want — a missing read, a new field, an error-shape wish — is a LOUD STOP + open question. Never absorbed.**

### §5.1 · SHELL-COMPLETE amendment (one line, same PR)

`docs/plans/SHELL-COMPLETE.md:292` currently reads:

> `**Portfolio** (forked → HEADER-PORTFOLIO: N+1 reads, loadProfilePositions spine, FI-2 basis law) · …`

**The N+1 premise was false.** `loadProfilePositions` issues 8 batched statements and **zero** loop-issued queries (recon C7). Replace the parenthetical with a pointer and a correction:

> `**Portfolio** (forked → `docs/plans/HEADER-PORTFOLIO.md`. The fork's stated "N+1 reads" premise was falsified at that task's recon — `loadProfilePositions` is 8 batched statements, zero loop-issued; the real cost is +3 statements on 4 routes) · …`

Nothing else in that file is touched. SG2's "exactly one new file" guard there refers to SHELL-COMPLETE's own scope and is not amended.

## §6 · Slices

Four. Each ends green (`ZUGZWANG_ENV=preview just verify` + the relevant suites). **One PR.** Vertical build order: tests → data → render → wiring, then the rider.

| # | Slice | Files | Exit |
|---|---|---|---|
| **S1** | **Tests first (RED)** | `tests/server/dharma/header-portfolio.test.ts` (new) · `tests/integration/header-portfolio.integration.test.ts` (new) · `tests/unit/shell/dharma-cluster.test.tsx` (`git mv` from `balance-cluster.test.tsx`) · `tests/unit/design/no-raw-dharma-render.test.ts` (MONEY_IDS) | Demonstrated RED, and for SG8 **ATTRIBUTED** RED (§7.1) |
| **S2** | **The read module** | `src/server/dharma/header-portfolio.ts` (new, the ONE `src/server/**` file) | T1·T2·T3 green |
| **S3** | **The cluster** | `src/components/shell/DharmaCluster.tsx` (`git mv` from `BalanceCluster.tsx`) · `src/components/shell/GlobalHeader.tsx` (import, prop, mount) | T4·T5·T6 green |
| **S4** | **Wiring + rider** | `src/app/(public)/layout.tsx` (the `Promise.all`, second prop) · `docs/specs/SPEC.1.md` (§21.8 + §0 → 1.0.27 + §20 row) · `docs/plans/SHELL-COMPLETE.md:292` (§5.1) | Full suite green |

**S1 before S2** — critical-path posture: `@test-writer` authors RED first, per CLAUDE.md.
**S3 before S4** — the layout cannot pass a prop the component does not accept.
**⚠ S4's rider text is web-authored and arrives with the execute kickoff.** CC never drafts §21.8. If it has not arrived when S1–S3 are green, **HALT at S4 and request it** — do not open the PR without it, and do not compose it from this plan's §3 coverage list.

### §6.1 · S2 — the read module contract

`src/server/dharma/header-portfolio.ts`, `import "server-only"`, SPDX line 1.

```ts
export async function getHeaderPortfolio(
  client: DbClient,
  userId: string,
): Promise<string | null>
```

**Returns:** a canonical 18-dp `NUMERIC(38,18)` string via `toFixed18`, or `null` on read failure only. **`"0"` when the viewer holds no open positions — never `null` for emptiness (R9).**

**Three statements, in this order, mirroring `loadProfilePositions` statements 1·2·4 byte-for-byte in table, columns, and predicate (R3):**

1. `positions` — `WHERE user_id = $1`, columns `marketId, side, quantity`. Mirrors `positions.ts:139–146`.
2. **Early return `toFixed18(0)` if no rows** — statements 2 and 3 never issue. Mirrors `positions.ts:156–158`, returning `"0"` rather than `[]`.
3. `payout_events` — `WHERE user_id = $1 AND market_id IN (…)`, columns `market_id, amount`. Mirrors `positions.ts:163–171`. **Existence per `market_id` is the settled discriminant (R5); amount is read but never used as the discriminant.**
4. `pools` — `inArray(pools.marketId, marketIdList)`, columns `market_id, yes_reserves, no_reserves`. Mirrors `positions.ts:189–196`. **Restrict the id list to UNSETTLED markets** — a settled market needs no pool read.

**In memory, zero further statements:**
- Drop every market that has ≥1 `payout_events` row for this user (settled — its value is already in the ledger, and counting it would double-count against Balance).
- For each surviving holding: `computeSell({ ...reserves, side, quantity }).proceeds` — imported from `@/server/cpmm/calculate`, the single Đb authority. **Never re-implement the formula (R1/R2).**
- Σ with `CpmmDecimal`. Never a JS float (SG10).
- Return `toFixed18(sum)`.

**Fail-safe (R8):** whole body in `try { … } catch (err) { safeCaptureException(err, { tags: { kind: "header_portfolio_read_failed" } }); return null; }`.

**In-file docblock must state (R7):** this module is deliberately separate from `header-balance.ts`; the two are awaited concurrently in the layout and are **never interleaved or fused**, because `header-balance.ts` pins a balance-first / cursor-second ordering constraint (MEDIUM-1, `3b7db8d`) that a merged read would silently break. Also record R3's same-source mandate and name `loadProfilePositions` as the mirror.

### §6.2 · S3 — the cluster

`git mv BalanceCluster.tsx DharmaCluster.tsx`. Rename the component and `data-testid` → `dharma-cluster`.

```ts
export function DharmaCluster({
  portfolio,
  spendable,
}: {
  portfolio: string | null;
  spendable: string | null;
}): React.JSX.Element | null
```

**Render gate (R9):** `if (spendable === null) return null;` — the cluster's existence is governed by Balance's null, not Portfolio's. If `portfolio` is `null` (read failed) while `spendable` is present, render the cluster with **Balance only** — a failed read must degrade, never blank the working half. Both null → nothing.

**Anatomy, from the mockup (`:268–281`, CSS `:123–130`), on token slots only (R11, SG11):**

```
<span data-testid="dharma-cluster">          ← bordered box, radius, hairline border
  <span>Đ</span>                             ← the ONE cluster glyph
  <span aria-hidden />                       ← the .sep hairline, no testid
  <span>                                     ← stat 1, column
    <span>PORTFOLIO</span>                   ← uppercase, tracked, muted
    <span>Đ {formatDharma(portfolio)}</span> ← ink, tabular-nums
  </span>
  <span>                                     ← stat 2, column
    <span>BALANCE</span>
    <span>Đ {formatDharma(spendable)}</span>
  </span>
</span>
```

**Portfolio FIRST.** Both values `formatDharma` — ungrouped (R4). Each stat carries its own `Đ` in the value **in addition to** the cluster glyph, per the mockup. Labels uppercase per the mockup's `.lab`; the copy register's `Portfolio` · `Balance` is the label identity, uppercase is its rendering.

`GlobalHeader` gains `portfolio?: string | null` defaulting to `null` — a **separate prop**, not a widening of `HeaderViewer`, matching the `spendable` precedent and its stated reasoning.

### §6.3 · S4 — wiring

`src/app/(public)/layout.tsx`, replacing the single awaited call:

```ts
const [spendable, portfolio] = session?.user?.id
  ? await Promise.all([
      getHeaderBalance(db, session.user.id),
      getHeaderPortfolio(db, session.user.id),
    ])
  : [null, null];
```

Concurrent, not sequential. Update the layout docblock: two reads, why they are separate (R7), and the accepted per-request cost (R12).

## §7 · Tests

| ID | File | Asserts |
|---|---|---|
| **T1** | `tests/server/dharma/header-portfolio.test.ts` | Statement shape and count: 3 max, 1 on the empty path. No transaction. Mirrors `positions.ts` sourcing — same tables, same columns, same predicates |
| **T2** | same | Semantics: no positions → `"0"` · all holdings settled → `"0"` · mixed → only unsettled summed · a **zero-amount** `payout_events` row still marks settled (R5's sharp edge) · `computeSell` used, never a spot-price product · read throws → `null` + `safeCaptureException` called once (R8) |
| **T3** | `tests/integration/header-portfolio.integration.test.ts` | **THE FI-2 LOCK.** Against real data: `getHeaderPortfolio(db, userId)` === `Σ` of open-row `.current` from `loadProfilePositions(db, {userId})`, **byte-identical strings**. Fixtures: multi-market, both sides, a partial sell, one settled market, one zero-amount payout leg. **If this cannot pass, the read is wrong — do not weaken it (§4.3)** |
| **T4** | `tests/unit/shell/dharma-cluster.test.tsx` | **SG5, extended from the shipped T4.** Right-zone order `dharma-cluster` → `identity-chip-link` → divider(`w-px`, no testid) → `visitor-counter`; both Đ stats left of the divider; `VisitorCounter` the SOLE element right of it; signed-out renders no cluster and keeps the boundary |
| **T5** | same | Two stats render, **Portfolio before Balance** in DOM order, under exactly ONE cluster glyph. Replaces the inverted `not.toContain("Portfolio")` |
| **T6** | same | Null matrix: both null → renders nothing · `spendable` null, `portfolio` present → nothing · `portfolio` null, `spendable` present → cluster with Balance only · `portfolio` `"0"` → renders `Đ 0`, **not** blank, **not** `—` |
| **T7** | `tests/unit/design/no-raw-dharma-render.test.ts` | `portfolio` added to `MONEY_IDS`. **ATTRIBUTED RED per §7.1** |

### §7.1 · SG8 — the attributed RED procedure

`MONEY_IDS` is an allow-list of names, **not** a detector of Đ-shaped values. An identifier absent from the array never enters the `RAW_RENDER` alternation, so a bare `{portfolio}` matches nothing and **all three checks pass silently.** The `files.length > 20` liveness check counts files, not coverage.

Procedure, mirroring `a08f1ff`:

1. Inject a raw `{portfolio}` render in `DharmaCluster.tsx`.
2. Run the design suite with **the OLD `MONEY_IDS`** → **must PASS.** This proves the gap is real.
3. Add `portfolio` to `MONEY_IDS`. Re-run → **must FAIL** on the injected line.
4. Remove the injection. Re-run → **GREEN.**
5. Record all three outcomes in the session log.

Skipping step 2 makes the RED unattributed and proves nothing.

## §8 · Risks and self-critique

| # | Concern | Disposition |
|---|---|---|
| 1 | A second Σ Đb derivation drifts from `positions.ts` | R3 same-source mandate + T3 byte-identity + `@code-reviewer` sourcing diff + Gate C confirmation. Exactly the UI-A6 treatment, which shipped and held |
| 2 | `/u/[pseudonym]` derives Σ Đb **twice** per request — header and page | Accepted. Both from the same pool state in one request; T3 pins equality. Recon C22 named it. Not optimised here |
| 3 | The mockup shows `Đ 2,480` grouped; we ship ungrouped | Deliberate, R4. Mockup is tier 4. Matches the §23 tile — the same number. Routed to POLISH as class R |
| 4 | The rename churns a test file | Small — 4 references, one `git mv`. Cheaper than shipping a `BalanceCluster` that renders two stats |
| 5 | Portfolio could be read as tradeable "holdings" | It is a read-only display of soulbound-economy positions. No transfer affordance exists or is implied. Copy is the ratified `Portfolio` label, nothing more |
| 6 | `settled` via `payout_events` diverges from `markets.status` mid-settlement | Settlement is one transaction — both flip together. `payout_events` is chosen over status because R3 requires mirroring `positions.ts`' discriminant, not because it is more atomic |
| 7 | The §21.8 rider does not arrive and CC improvises it | Explicit HALT at S4. §3 names the coverage, never the text |
| 8 | A parallel session on the worktree shreds fixtures | **ANYTHING RUNNING VITEST RUNS ALONE.** One terminal. `truncateTables` disables the Bucket-A guard set per call; a 13-file diff "failing" 55 suites is a false red |

## §9 · Gates and delivery

**Branch:** `feat/header-portfolio` off `main` @ `acc2e03`. Name-free check before `checkout -b`.
**Per slice:** `ZUGZWANG_ENV=preview just verify` → 0 · relevant suites → 0 · `biome check .` → 0. **Full `pnpm vitest run` before the PR.**
**Cascade:** `@test-writer` (S1 RED) → `@code-reviewer` on the full diff, passed `@docs/plans/HEADER-PORTFOLIO.md`, with the R3 sourcing diff named as a directed check. **No `@security-auditor`** — display-grade read, no write, no engine contact, not a CLAUDE.md §1 critical path.
**Gate C — web diff-read before merge. Hard.** The PR is opened and left for the gate; CC never merges.
**Commits:** author `Zugzwang/world <zugzwangworld@proton.me>`, SSH-signed, no `Co-authored-by`, squash-merge to main.
**Ceilings unmoved:** migration head `0024_bookmarks` · `EVENT_TYPES` 24 · next free ADR `0035`. SPEC.1 moves `1.0.26 → 1.0.27` (the §21.8 rider only).

## §10 · Ground

`src/server/profile/positions.ts` (the mirror — READ-ONLY) · `src/server/profile/tiles.ts:62–64` (the tile Σ — READ-ONLY) · `src/server/dharma/header-balance.ts` (the sibling — READ-ONLY) · `src/server/cpmm/calculate.ts` (`computeSell`) · `src/server/cpmm/decimal.ts` (`CpmmDecimal`, `toFixed18`) · `src/server/bookmarks/figures.ts:12–24` (the R3 precedent, shipped) · `src/components/shell/BalanceCluster.tsx` → `DharmaCluster.tsx` · `GlobalHeader.tsx` · `src/app/(public)/layout.tsx` · `docs/specs/SPEC.1.md` §10.8 `:586–596`, §21.1 `:1495–1496`, §23 `:1592`/`:1596` · `docs/design/mockups/DESIGN_W2_4-5-14_global-header_mockup-v0_2.html:268–281` + CSS `:123–130` · `tests/unit/design/no-raw-dharma-render.test.ts`.

**Verify everything on the live repo at slice start. A listed dependency is not a completed one.**
