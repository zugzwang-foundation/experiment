# PCT.ROUND — Percentage display, the complement rule

> **Status:** executing
> **Date:** 2026-07-31
> **Author:** Hrishikesh (rulings) + Claude Code (this record)
> **Critical-path?** **no** — see the scope note below.
> **Plan PR / commit:** first commit on `fix/pct-round`; PR opened at close.

**Scope note (critical-path determination).** No changed file sits on a CLAUDE.md §1 critical path. The §1 list is `src/server/{auth,identity-pool,moderation,cpmm,dharma,positions,bets,comments,resolution}` plus `src/db/schema/` and `drizzle/migrations/`. This task touches `src/components/debate/**` and `src/server/debate-export/`, neither of which is listed. It nonetheless modifies a file under `src/server/`, so **§5.11 routes `@code-reviewer`**. `@security-auditor` is **not** required — the diff touches no masking, no auth, no viewer state, and reads no user-scoped data (ruling F).

**This plan re-decides nothing.** Every rule below was ratified by the operator before execution. The plan's job is to record how those rulings land on the actual code, enumerate every call site with its treatment, and state what turns red and why.

---

## Tracker context

No tracker row exists for PCT.ROUND at plan time (the tracker is operator-maintained external HTML and is not committed — see `docs/maintenance.md`). The task arrives as a ratified ruling set rather than a tracker entry.

**Declared dependency:** DROUND (the Đ 0-dp display rule, SPEC.1 §10.8, PR #146) — **landed**. PCT.ROUND is its percentage sibling and reuses its formatter home, its marker-allowlist guard pattern, and its revert→red→restore proof method.

## Approach (one paragraph)

Two complementary market prices are today rounded **independently**, each ROUND_HALF_UP. Their fractional remainders are `r` and `1 − r`, so they disagree only at an exact `.xx5` tie — where half-up rounds *both* sides up and the pair renders **101%**. The fix makes **YES canonical** and **derives NO as `100 − YES`**, so the pair sums to exactly 100 by construction. The rule is enforced *structurally*, not by intention: the new paired formatter takes the whole `pricing` object plus a side, making it impossible to render a NO percent without holding the YES price. A single-side escape hatch survives under a deliberately awkward name (`formatPercentUnpaired`) for the two readouts that legitimately render one side alone, allowlisted by marker and pinned to an exact count.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| INV-1 Bet ↔ comment atomicity | **no** | View-layer formatter only. No write path, no transaction, no schema. | n/a |
| INV-2 Dharma non-transferable / no overdraft | **no** | No ledger read or write. Percentages are prices, not Đ. | n/a |
| INV-3 Side frozen at post-time | **no** | `side_at_post_time` is never read or written here. The `side` argument to the new formatter is a *render-time column identity* (which pole the caller is drawing), not a comment's bound side. | n/a |
| INV-4 Resolutions append-only | **no** | No resolution surface touched. | n/a |

**Money-law adjacency (CLAUDE.md §2 — "never JS floats for balances, prices, or shares").** This is the constraint the task actually engages. The rule is preserved and *strengthened*: the canonical YES percent is computed by **pure integer digit-extraction on the canonical decimal string**, never float multiplication, and the seventh call site — which *did* do `Math.round(Number(yes) * 100)` — is deleted. A static guard makes the float idiom unable to return.

---

## 2. Data model changes

**None** — view-layer display rule. No DDL, no migration, no new event type, no new §16.1 constant, no read-model or DTO change. The ledger, the engine, the read models and every DTO keep full `NUMERIC(38,18)` precision.

## 3. API surface

**None** — no endpoint, Server Action, or route handler changes. `src/server/debate-export/serialize.ts` is modified, but it is a pure serializer; the `GET /m/[slug]/export` handler and its response shape are untouched.

## 4. UI / user flow

No layout, copy, or flow change. Only the *value* of already-rendered percentages changes, and only at an exact `.xx5` tie — where NO drops by one point so the pair sums to 100.

**Module change — `src/components/debate/format.ts`:**

- **NEW** `formatPricePercent(pricing: { yes: string; no: string }, side: Side): string` — the paired formatter. YES canonical (integer digit-extraction, ROUND_HALF_UP, on `pricing.yes`); NO returned as `100 − YES`. **It never reads `pricing.no`.**
- **RENAME** `formatPercent` → `formatPercentUnpaired` — the escape hatch. Behaviour byte-identical to today's `formatPercent`.
- Both route through one private integer helper so the two can never drift.

`Side` is imported **type-only** from `./types` (`export type Side = "YES" | "NO"`) — the canonical type DebateView already maps over. No new side type is minted, and a type-only import is erased at compile, so `serialize.ts` (server) gains no runtime coupling to a client module.

### Call-site register — all seven, each with its treatment

| # | Site | Pair or single? | Treatment |
|---|---|---|---|
| 1 | `debate/PriceBar.tsx:20–21` | **pair** (renders both) | → `formatPricePercent(pricing, "YES")` / `(pricing, "NO")` |
| 2 | `debate/DebateColumn.tsx:41` | **pair** — mounts **twice** via `DebateView`'s `["YES","NO"].map` | → `formatPricePercent(pricing, side)` |
| 3 | `debate/composer/SlotHeader.tsx:88` | **pair** — mounts **twice** | → `formatPricePercent(pricing, side)` |
| 4 | `debate/composer/PositionStrip.tsx:40` | **pair** — mounts **twice** | → `formatPricePercent(pricing, side)` |
| 5 | `server/debate-export/serialize.ts:174` | **pair** (prose, one sentence) | → `formatPricePercent(m.pricing, "YES")` / `"NO"` |
| 6 | `server/debate-export/serialize.ts:242` | **pair** (prose, one line) | → `formatPricePercent(m.pricing, "YES")` / `"NO"` |
| 7 | `debate/chart/geometry.ts:46` `fmtPct` → used at `MarketPriceChartCard.tsx:37–38` | **genuinely single-side** | `fmtPct` **DELETED**; both sites → `formatPercentUnpaired`, each with its own `pctround-allow:` marker |

Sites 2–4 are the point the recon corrected: because `DebateView` renders `(["YES","NO"] as const).map(...)`, each of those components **mounts twice, side by side**. The 101 is therefore visible in the column headlines, again in the slot headers, again in the position strips, and again in the price bar — four paired surfaces, not one.

**Site 7 detail.** The two chart readouts are legitimately single-side: they are the **opening** and **current** YES price at two points in *time*, not two halves of a pair. But they must agree with the `PriceBar` rendering the same current price a few pixels below, so they cannot keep a second, divergent implementation. Deleting `fmtPct` also removes float math on a price — which `geometry.ts`'s own sibling docblock forbids. The two calls are hoisted to named consts above the `return` so each can carry a `//` line marker; a JSX `{/* */}` comment inside the `sr-only` span was rejected as a whitespace risk to the existing render assertions. Rendered output is unchanged.

### Not touched, deliberately

- **`debate/composer/split-bar.ts` `supportPct`** — integer-**TRUNCATED** by design, so a full bar means literally zero counter Dharma. It is a **Dharma-share** percentage, not a price. **Zero code change.** The spec rider names it out of scope so a future reader does not "fix" it.
- **`PriceBar.tsx:31` geometry** — the YES segment takes the rounded percent as its CSS `width` and the NO segment is a `flex-1` remainder. This line stays **byte-identical**. Happy consequence: at a `.525` tie the bar was *already* 53/47 while its labels read 53/48, so this fix makes the labels agree with the geometry they sit on. Moving the fill to the exact basis is **docketed in the rider, not done here**.
- **`src/server/cpmm/calculate.ts`** — **zero-line diff, absolute.** Proven at close with `git diff origin/main...HEAD -- src/server/cpmm/calculate.ts` returning empty.
- The export's **YAML front matter** `yes_price` / `no_price` (`price2`, 2-dp ROUND_HALF_EVEN) — untouched. Those are the reproducible machine-readable values, and they are structurally sum-preserving because complementary kept digits share parity.

## 5. Failure modes

| Failure mode | Detection | Recovery |
|---|---|---|
| Derived NO disagrees with a NO price the engine actually emitted | Cannot occur by construction — the derived path never reads `pricing.no`. This is the *reason* for deriving: the CPMM charter pins `|p_yes + p_no − 1| ≤ 1 ulp` (cpmm §10.2; `tests/unit/cpmm/invariants.property.test.ts:316`), **not** exact equality. A rule reading both strings would assert something the engine does not promise. | n/a |
| A new percent surface bypasses the paired formatter | Static guard `tests/unit/design/pct-round-render.test.ts` — fails CI | Route the new site through `formatPricePercent` |
| The escape hatch silently multiplies | Guard pins the marker count at **exactly 2** | Any third site fails the build until ratified |
| The float-percent idiom returns | Guard asserts no `Math.round(Number(…) * 100)` in scan dirs | Fails CI |
| Malformed price string | **Unchanged, pre-existing.** Today's `formatPercent` yields `NaN%` on a non-numeric string; `formatPercentUnpaired` and the derived path behave identically (`100 − NaN → NaN`). Prices are server-computed by `getPrices`, so this is not a reachable production state. **No new failure mode is introduced, and no speculative guard is added** (CLAUDE.md §5.2/§5.3). | n/a |

**Asymmetry, stated deliberately:** NO absorbs the rounding error. That is the cost of determinism and is recorded as such in the spec rider.

## 6. Edge cases

Concrete values the implementation must answer, all covered in §7:

- **`0.525 / 0.475` — the defect.** Today 53% + 48% = **101**. After: **53% + 47% = 100**.
- **`0.50 / 0.50`** — 50% + 50%. Unchanged.
- **Near-degenerate pools approaching 0 and 1** — e.g. `0.999…` → YES 100%, NO **0%**; `0.001` → YES 0%, NO **100%**.
- **The `Math.min(pct, 100)` clamp — is it reachable?** With reserves validated by `requirePositive`, a price is in `[0,1]`, so `intPct` is 100 only at exactly `1.0` (fraction digits all zero) and the sum cannot exceed 100. The clamp is therefore **unreachable on valid input** and is retained purely as a defensive belt. `1.0 / 0.0` renders **100% / 0%**.
- **Every existing fixture in the tree is an exact 2-dp probability with no tie** — `0.38/0.62`, `0.54/0.46`, `0.50/0.50` — verified by grep. The complement rule produces **byte-identical** output on all of them.

## 7. Test plan

**RED before GREEN. The ordering is the point, not a formality.**

| Layer | Scenarios | Asserted |
|---|---|---|
| Unit — `tests/unit/debate/format.test.ts` | **(a) The behavioural RED**, written and proven failing against current HEAD: the two rendered percents at `yes=0.525…/no=0.475…` sum to exactly 100 using **today's** `formatPercent`. Must FAIL reporting **101**, and that output is captured verbatim into the log. **(b)** The same assertion ported to `formatPricePercent` → YES 53%, NO 47%, sum 100. **(c)** `0.50/0.50`; near-degenerate ends; the clamp question; `100/0`. **(d)** `formatPercentUnpaired` retains byte-identical behaviour to the old `formatPercent`. | The complement rule; no-float-on-price |
| Unit — property (`fast-check`, already in the tree) | For any valid reserve pair, `YES% + NO% === 100`. | The invariant, exhaustively |
| Render — `tests/unit/debate/render/` (jsdom + Testing Library, per-file `// @vitest-environment jsdom`; **no jest-dom**, so plain DOM assertions) | `PriceBar` at the tie fixture: `aria-label` reads exactly `YES 53%, NO 47%` — a screen reader announces the pair as **one utterance**, which is where the arithmetic read worst. Plus the paired mounts (`DebateColumn` / `SlotHeader` / `PositionStrip`) at a tie. | End-to-end render correctness |
| Static guard — `tests/unit/design/pct-round-render.test.ts` | Modelled on `no-raw-dharma-render.test.ts`. `SCAN_DIRS` = `src/components`, `src/app/(public)`, `src/app/(admin)`, **and `src/server/debate-export`** — that last is new, and closes a real gap: DROUND's guard did not scan it, yet `serialize.ts` is a percent call site. Liveness assertion `files.length > 20`. Every `formatPercentUnpaired(` carries a `pctround-allow:` marker within the preceding 5 lines; **total marker count === exactly 2**. No `Math.round(Number(…) * 100)` anywhere in scan dirs. | Structural enforcement |

**Guard RED proof (DROUND's documented method).** After the fix lands: temporarily revert one real call site to the unpaired formatter without a marker → run the guard → confirm it **FAILS** → restore. Recorded in the log. *A guard that has never failed is not a guard.*

**Expected end state.** Baseline at `b2e8bb1` is **281 files / 2027 passed, 1 skipped, 4 todo, exit 0**. All 2027 must still pass. In particular `tests/unit/debate-export/_fixtures/mumbai-metro.expected.md` (54%/46%) must stay **byte-identical**. **If the golden fixture's bytes change, that is a HALT — do not regenerate it to make a test pass.**

## 8. Out of scope

- **`split-bar.ts` `supportPct`** — a Dharma share, not a price; truncation retained (§4).
- **`PriceBar` fill geometry** — stays byte-identical; moving the fill to the exact basis is docketed in the rider.
- **`src/server/cpmm/calculate.ts`** — zero-line diff, absolute. If the fix appeared to require touching it, the task would be mis-scoped.
- **The export's YAML front matter** — `price2` values untouched.
- **No §17 acceptance row.** DROUND took none for its display rule; that precedent holds.
- **Any other percentage surface** not enumerated in the call-site register. A newly discovered site is a **finding**, not a footnote.

---

## Open questions

None at plan time. Every decision this task needed was ratified before execution. Judgement calls forced during execution are recorded under **"## Unratified choices"** in `docs/logs/PCT-ROUND.md` for morning adjudication.

## ADRs needed

**None.** This is a display rule, not an architectural decision — it sets no new vendor commitment and changes no CLAUDE.md default. It lands as a **SPEC.1 rider** (§0 version 1.0.23 → 1.0.24, §10.8, §20), exactly as DROUND did. Note that §10.8 currently **excludes percentages by name** ("Odds multipliers (2.17x), percentages, and counts are not Đ values and are not governed by this rule"), so the rider **amends an explicit carve-out** rather than extending an existing rule.

---

## Self-critique

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | Deriving NO means the NO percent can differ by one point from a NO price rounded on its own — a reader comparing against the raw DTO could call it a bug. | **Accepted and documented**, in the spec rider and in the module docblock. The asymmetry is the price of determinism, and it is strictly better than asserting a sum the engine only guarantees to 1 ulp. |
| 2 | medium | Renaming a public export is a breaking change to every importer. | Deliberate, and the reason is on the record: DROUND tried an import *alias* and **reversed it at the gate**, because a reader saw one name silently resolving to another. A call site must announce that it is unpaired. All importers are updated in the same commit; `tsc` proves completeness. |
| 3 | low | The `Math.min(pct, 100)` clamp is retained though unreachable on valid input. | Retained as a defensive belt — removing it is scope creep (§5.3) and would be a behaviour change to `formatPercentUnpaired`, which must stay byte-identical. |
| 4 | low | Guard scan-dir `src/server/debate-export` sits outside the "view layer" the sibling guard describes. | Correct and intended: the export *is* a render surface for these percentages. Called out in the guard's header comment so the next reader does not "tidy" it away. |
| 5 | medium | A malformed price still yields `NaN%`. | Pre-existing and unchanged; adding a fallback would be speculative error handling for an unreachable state (§5.2). Explicitly listed in §5 so the reviewer reads it as *considered*, not *missed*. |

---

## References

- `CLAUDE.md` §2 (no JS floats on prices), §5.2/§5.3 (simplicity, surgical), §5.11 (reviewer routing)
- `AGENTS.md` §8 (Tailwind/shadcn, a11y), §9 (test layout + naming)
- `docs/specs/SPEC.1.md` §10.8 (display rules), §20 (change log)
- `docs/specs/cpmm.md` §10.2 (configuration), §10.4 (determinism)
- `tests/unit/cpmm/invariants.property.test.ts:316` — the `≤ 1 ulp` price-sum guarantee
- `docs/plans/DROUND.md`, `docs/logs/DROUND.md` — the sibling rule this one mirrors
- `tests/unit/design/no-raw-dharma-render.test.ts` — the guard this one is modelled on
- ADR-0025 — the `.md` debate export
