# ENGINE.4 — Market state machine (`src/server/markets/`)

> **Status:** reviewed — web amendments A1–A6 folded 2026-06-05; founder-ratified OQ batch 2026-06-05; ratification = plan-PR merge.
> **Date:** 2026-06-05
> **Author:** Hrishikesh + Claude Code (plan tab)
> **Critical-path?** **Adjacent, bespoke ritual (OQ-A).** `src/server/markets/` is **not** a CLAUDE.md §1-listed critical path (the greenfield list is `bets/comments/dharma/resolution`). But the machine is **INV-4-adjacent** — its illegal-edge set *is* the status-level analog of "no un-resolution / no un-freeze" (INV-4) — and it is the **single legality gate** for every `markets.status` write (F-7; `markets` is Bucket C, no DB trigger). New business logic in `src/server/` ⇒ `@test-writer` RED + `@code-reviewer` + a **narrow `@security-auditor`** pass (OQ-A ruling — scoped to INV-4-edge-foreclosure + single-gate-bypass) + §5.10 audit.
> **Plan PR / commit:** this file commits before Phase 2 (CLAUDE.md §5.1); execute happens after founder ratification. **Plan-PR diff-stat = `docs/plans/ENGINE.4.md` only.**

---

## Tracker context

Tracker row (operator tracker v12, ENGINE lane; verbatim, not edited here — memory `project_tracker_external`):

```
{ id: "ENGINE.4", phase: 3, title: "Market state machine",
  desc: "7 states (Draft→Open→Closed→Resolving→Resolved / Voided / Frozen) +
  pure transition functions; illegal transitions as negative tests.
  Reads markets/pools (built).", pri: "P0", deps: ["ENGINE.0"], est: "2d" }
```

**Dependency status at plan time:** **ENGINE.0 — done.** The event vocabulary (`src/server/events/schemas.ts`, `EVENT_TYPES` = 21, incl. the 6 `market.*` types) + `insert.ts` `AggregateType` (8 values, incl. `"market"`) landed and round-tripped green in CI (`docs/logs/ENGINE.0.md:19,68`). The built schema `markets`/`pools` (`src/db/schema/markets.ts`) is the read surface. ENGINE.1/2/3 (cpmm charter + frozen module + property suite) are merged (`88b2a02`) and supply the **pure-module idiom** this task mirrors.

**Preflight dispositions baked in (so a fresh execute session is self-contained):**

- **F-1 — settled.** The 7-value `market_status` pgEnum is **built** (`markets.ts:15–23`, DDL `0001:9`): `Draft|Open|Closed|Resolving|Resolved|Voided|Frozen`. SPEC.2 §3.6/§5.1/§14.1's narrower `Open → Resolved | Voided` wording (and SPEC.2's **zero** `Resolving` mentions) is **owned PRECURSOR.5 drift**, flagged in-code (`markets.ts:13–14`) and at SCAFFOLD.2-3B (`docs/plans/SCAFFOLD.2-3B.md:34`). **Charter = SPEC.1 §6.1 + the built enum; note the drift, do not fix it here.**
- **F-4 + F-6 — one editorial defect (rider OQ-F).** SPEC.1 §2 glossary (`SPEC.1.md:67`) says "**six** … states", omits `Draft`, and names the column `markets.state`; ADR-0013 (`0013-…md:263–266`) says `markets.state` + reads a non-existent `markets.resolving_at`. The built column is `markets.status` (7 states; **no `resolving_at`** anywhere — `grep src/ drizzle/`). Disposition in OQ-F.
- **F-7 — `markets` is Bucket C, no append-only trigger** (`0003` protects neither `markets` nor `pools`). **This module is the ONLY legality gate** for status transitions — the "whitelisted Bucket-C transition" in SPEC.2 §5.1/§14.1 is documentation, not DB-enforced. The plan states a **single-gate consumer contract** (below).

---

## Approach (one paragraph)

Build `src/server/markets/` as a **pure, IO-free transition module** mirroring the `src/server/cpmm/` idiom (`server-only`, named exports, zero DB/zero clock reads, a module-local error sentinel). The machine encodes the **SPEC.1 §6.1 directed graph** as a single declarative `LEGAL_TRANSITIONS` map compile-guarded with `satisfies Record<MarketStatus, …>` (so the enum and the graph cannot drift), exposes a pure edge predicate + a discriminated-result `transition`, and isolates the **one** intrinsic data guard — the clock-derived `Open → Closed` — into a function that takes `{ now, resolutionDeadline }` as **arguments and never reads a clock**. The `MarketStatus` union is **derived from the built `marketStatusEnum`** (single source of truth). Tests are **exhaustive over the full 7×7 status matrix** (the legal set equals §6.1 exactly; all 41 other pairs reject), with each of the six §6.1 illegal bullets a **named** negative test. No schema, no migration, no event emission, no handler wiring — those are the consuming strata (ENGINE.7/9); ENGINE.4 ships the gate they will route through.

---

## Module & state-machine design

### File layout (`src/server/markets/`, greenfield — mirrors `cpmm/`)

| File | Subject |
|---|---|
| `transitions.ts` | `MarketStatus` type, `LEGAL_TRANSITIONS` map, `canTransition`, `transition`, `closeOnDeadline`, `assertDeadlineNotExtended`, the `TransitionResult` / `TransitionRejection` / `DeadlineCheckResult` types. |
| `errors.ts` | `MarketTransitionError` — module-local sentinel (mirrors `cpmm/errors.ts:20–27`), reserved for the unreachable enum-drift case only. |

No barrel `index.ts` (cpmm has none; consumers import from `@/server/markets/transitions`). Both files open with `import "server-only"`; no Manifold attribution header (this module is original, not cpmm-derived).

### Status union — **derive from the built pgEnum** (decision, justified)

```ts
import { marketStatusEnum } from "@/db/schema/markets";
export type MarketStatus = (typeof marketStatusEnum.enumValues)[number];
// ⇒ "Draft" | "Open" | "Closed" | "Resolving" | "Resolved" | "Voided" | "Frozen"
```

**Chosen over a hand-written local literal union** because: (1) the pgEnum is *already* the canonical, DB-backing value set — deriving makes drift **structurally impossible** (a hand-maintained union is exactly the silent-divergence class F-1 documents at the spec layer); (2) it is a genuine string-literal union, so it **complies with AGENTS.md §4** ("string-literal unions over [TS] enums" forbids the `enum {}` construct, not a derived union); (3) the import is **pure** — `markets.ts` pulls only `drizzle-orm/pg-core` + `drizzle-zod` (no `server-only`, no DB client), so the unit tests load it DB-free (vitest `tsconfigPaths` + `server-only` shim already resolve `@/db/schema`). *No `.enumValues` precedent exists in-repo yet (`grep` → none); introducing it here is idiomatic Drizzle.* Alternative (local union + `satisfies` guard, the `EVENT_TYPES` pattern) is rejected: it duplicates the value list — the thing most likely to drift — and still imports the enum for the guard, gaining nothing.

### Transition table — 1:1 with SPEC.1 §6.1

The graph as a single source of truth, compile-guarded:

```ts
const LEGAL_TRANSITIONS = {
  Draft:     ["Open"],
  Open:      ["Closed", "Voided"],
  Closed:    ["Resolving", "Voided"],
  Resolving: ["Resolved"],
  Resolved:  ["Frozen"],
  Voided:    ["Frozen"],
  Frozen:    [],
} as const satisfies Record<MarketStatus, readonly MarketStatus[]>;
```

| # | Edge | §6.1 cite | Guard (owner) | In machine |
|---|---|---|---|---|
| 1 | `Draft→Open` | `:209,220` | admin commit + `pool_seed` lands (**handler**) | edge legal |
| 2 | `Open→Closed` | `:210,221` | `now ≥ resolutionDeadline`, hard cutoff no grace (**PURE clock** — the only data guard in the machine) | edge legal + clock guard |
| 3 | `Closed→Resolving` | `:211,222` | admin triggers (**handler** auth) | edge legal |
| 4 | `Resolving→Resolved` | `:212,223` | in-flight window cleared (**handler / ADR-0013**; the `resolving_at` anchor is deferred — OQ-C) | edge legal |
| 5 | `Open→Voided` | `:213,224` | admin void + reason (**handler**) | edge legal |
| 6 | `Closed→Voided` | `:214,224` | admin void + reason (**handler**) | edge legal |
| 7 | `Resolved→Frozen` | `:215,225` | global freeze instant (**`system_state.frozen_at`**; OQ-B — no per-market writer in ENGINE.4) | edge legal |
| 8 | `Voided→Frozen` | `:216,225` | global freeze instant (same) | edge legal |

**Illegal bullets → named negative tests** (`:227–233`):

| Bullet | §6.1 | Named test |
|---|---|---|
| `Resolved→Open` (no un-resolution, INV-4) | `:228` | `rejects Resolved→Open` |
| `Frozen→Open` (no un-freeze) | `:229` | `rejects Frozen→Open` |
| `Voided→Resolved` (void terminal until freeze) | `:230` | `rejects Voided→Resolved` |
| `Open|Closed→Resolved` (must transit Resolving) | `:231` | `rejects Open→Resolved` **and** `rejects Closed→Resolved` |
| `Draft→Voided` (cannot void unopened; `→ discard`) | `:232` | `rejects Draft→Voided` (OQ-D: discard is **not** a machine edge) |
| deadline extension (B8) | `:233` | `rejects deadline extension` (separate field guard — below) |

Every **other** of the 41 non-legal ordered pairs (e.g. `Draft→Closed`, `Open→Frozen`, `Resolving→Voided`) is rejected by the **exhaustive matrix** as `illegal_edge`.

### Function signatures — the heart (pure over explicit inputs)

```ts
export type TransitionRejection =
  | "illegal_edge"          // (from,to) ∉ the §6.1 graph
  | "deadline_not_reached"; // Open→Closed: now < resolutionDeadline

export type TransitionResult =
  | { ok: true;  to: MarketStatus }
  | { ok: false; reason: TransitionRejection };

// B8 field guard — no target state, so its own result type; reason narrowed.
export type DeadlineCheckResult =
  | { ok: true }
  | { ok: false; reason: "deadline_extension" };

// Primitive — pure graph lookup over the §6.1 edges. Total for MarketStatus inputs.
export function canTransition(from: MarketStatus, to: MarketStatus): boolean;

// Discriminated wrapper for handlers (reason feeds §15 mapping at ENGINE.7/9).
export function transition(from: MarketStatus, to: MarketStatus): TransitionResult;

// The ONE clock-guarded edge. Takes time as arguments — never reads a clock.
// status≠Open ⇒ illegal_edge; now<deadline ⇒ deadline_not_reached; else → Closed.
export function closeOnDeadline(args: {
  status: MarketStatus;
  now: Date;                 // server clock captured by the caller
  resolutionDeadline: Date;  // markets.resolution_deadline (timestamptz → Date)
}): TransitionResult;

// B8 field-guard (NOT a status edge — see below). proposed ≤ current ⇒ ok.
export function assertDeadlineNotExtended(args: {
  current: Date;
  proposed: Date;
}): DeadlineCheckResult;
```

`Open → Closed` boundary is **`now ≥ resolutionDeadline`** — §6.1 `:210` ("deadline **reached**") settles it: *reached* ⇒ the `now == deadline` instant closes (consistent with `:221` "hard cutoff, no grace"). The `==` instant retains a named boundary test. Times are UTC instants compared by `.getTime()` — no timezone hazard (both are `timestamptz`-derived `Date`s).

### B8 (deadline extension) — proposed encoding

B8 is **not a status transition** (it has no `from→to` status pair) — it is a guard on mutating the `resolution_deadline` *field*. ENGINE.4 **represents** it as the pure predicate `assertDeadlineNotExtended` (above): a change is legal only if it does **not** extend (`proposed ≤ current`; shrink/equal is not B8's concern). It ships with a named negative test. Its **callers** (the market-edit / creation-form handlers validating `:233` + §12.1's `deadline ≤ freeze`) are later strata — ENGINE.4 supplies the pure check, not the wiring. *(Alternative considered: defer B8 entirely to the market-edit stratum, parallel to `Draft→discard` (OQ-D). Rejected — the kickoff's "do not drop it"; a 3-line pure predicate represents B8 in the layer it belongs to without overreaching. Recorded as self-critique #2.)*

### Error / result shape (OQ-E — my pick, defended)

**Discriminated typed results for every *expected* outcome** — `TransitionResult` for the status edges (legal → `ok`; illegal-edge / deadline-not-reached → typed `reason`) and `DeadlineCheckResult` for the B8 field guard (`ok` / `deadline_extension`). An illegal transition is a **normal runtime branch** (e.g. a concurrent request trying to resolve an already-`Resolved` market), not a programmer bug — so it is **data, not an exception**, matching the repo's `zod.safeParse` `{ success } | { error }` idiom and AGENTS.md §4's discriminated-`kind` errors. The module-local `MarketTransitionError` (mirroring `CpmmInputError`) is **defined but reserved** for the genuinely-unreachable enum-drift case (an unknown status key reaching the gate from a JS caller / corrupt row) — the same "reaching this is a caller bug" role as `cpmm/errors.ts:13–18`. Mapping `reason → §15 catalogue codes` (`error_market_closed_at`, …) is **handler territory** (ENGINE.7/9), per the web prior.

### Single-gate consumer contract (F-7)

`src/server/markets/transitions.ts` is the **single source of truth for `markets.status` legality**. Because `markets` is Bucket C (no trigger), the DB will accept any status UPDATE — so the consuming strata **must** route every status write through `transition()` / `closeOnDeadline()` (no handler writes a status literal directly). This is a **forward consumer contract** binding ENGINE.7 (bet handler reads status), ENGINE.9 (resolve/void writes status) — recorded here, enforced by review at those strata (candidate future CI lint). **Precedent:** the cpmm "single arithmetic authority" clause (`cpmm/decimal.ts:15` — one constructor, never bypassed) and cpmm.md §10's single-source discipline. ENGINE.4 cannot *mechanically* enforce this (it has no DB surface); it states the contract the gate exists to serve.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity | **no** | no bet/comment writes | n/a |
| 2.2 Dharma non-transferable | **no** | no Dharma/ledger surface | n/a |
| 2.3 Side frozen at comment-time | **no** | no comment surface | n/a |
| 2.4 Resolutions append-only | **adjacent** | the machine **forecloses the status-level un-resolution/un-freeze edges** (`Resolved→Open`, `Voided→Resolved`, `Frozen→Open`) that INV-4 protects — but it **does not write** resolutions; storage-level INV-4 stays the `resolution_events`/`payout_events` Bucket-A triggers + the ENGINE.9 handler routing through this gate (F-7). | `tests/unit/markets/transitions.test.ts › rejects Resolved→Open` / `rejects Voided→Resolved` / `rejects Frozen→Open` |

**Failure mode if the INV-4-adjacent assertions are missing:** if the machine permitted `Resolved→Open` (or a handler bypassed the gate, F-7), a settled market could be re-opened — the status-level corruption INV-4 forbids — and downstream payouts/ledger would diverge from an immutable resolution record. The named negatives + the single-gate contract are the guard.

## 2. Data model changes

**None.** ENGINE.4 *reads* the built `markets`/`pools` (the tracker's "Reads markets/pools (built)"). No new table, column, index, enum, migration, or trigger. The `resolving_at` anchor that ADR-0013 references but that is **not built** stays out of scope (OQ-C) — no schema work in either half.

## 3. API surface

**None external.** No Server Action, route handler, or HTTP endpoint. The deliverable is pure functions consumed *in-process* by future server strata (ENGINE.7/9). No zod request schema (inputs are typed `MarketStatus`/`Date`), no auth/rate-limit class (no request surface).

## 4. UI / user flow

**None — backend pure logic.**

## 5. Failure modes

- **Handler bypasses the gate (F-7) — the primary systemic risk.** `markets` is Bucket C; a handler that writes `markets.status` directly (not via `transition()`) escapes legality. **Detect/recover:** not preventable inside this pure module; mitigated by the single-gate consumer contract + `@code-reviewer`/`@security-auditor` discipline at ENGINE.7/9 + a candidate CI lint. Stated, not solved, here.
- **Unknown status reaches the gate (enum drift / corrupt row).** TS precludes it for typed callers; a JS caller passing garbage hits the `MarketTransitionError` defensive throw. **Detect:** Sentry at the handler boundary. **Recover:** data audit. *(Guarding a TS-impossible case — accepted for a single-gate module; self-critique #3.)*
- **Clock skew / timezone on `Open→Closed`.** Avoided by construction: `now` is a caller-supplied UTC instant, compared by `.getTime()`; the module never reads a clock, so it is deterministic and unit-testable.

## 6. Edge cases

- `now == resolutionDeadline` → **Closed** (`≥`, no grace). Named boundary test.
- `now < resolutionDeadline` on an `Open` market → `deadline_not_reached` (not yet closable).
- `closeOnDeadline` on a non-`Open` status → `illegal_edge` (the clock guard never fires off-`Open`).
- **`Frozen` is absorbing** — `transition(Frozen, *)` is always `illegal_edge`; `LEGAL_TRANSITIONS.Frozen === []`. (Structural test.)
- The **only** edges into `Frozen` are `Resolved→Frozen` and `Voided→Frozen`; ENGINE.4 ships **no writer** that sets `status='Frozen'` (OQ-B).
- Concurrent double-resolve: `transition(Resolved, Resolving)` → `illegal_edge` forecloses re-resolution at the status level (the row lock per ADR-0013 is still the handler's job).

## 7. Test plan (charter → named test)

All in **`tests/unit/markets/transitions.test.ts`** (one subject = the transitions module; AGENTS.md §9 `<subject>.test.ts`). DB-free (pure functions) ⇒ runs locally green; the whole-suite CI gate is the integration backstop (none added here).

| Charter (§6.1) | Test (describe › it) | Assertion |
|---|---|---|
| full graph | `matrix › legal set equals §6.1` | table-driven 7×7: `canTransition(f,t)` true for **exactly** the 8 legal edges, false for all 41 others |
| edge 1 | `legal › Draft→Open` | `transition` → `{ ok:true, to:"Open" }` |
| edge 2 | `closeOnDeadline › now ≥ deadline closes` | `Open` + `now ≥ deadline` → `{ ok:true, to:"Closed" }` |
| edge 2 (boundary) | `closeOnDeadline › now == deadline closes` / `now < deadline` | `==` → Closed; `<` → `deadline_not_reached` |
| edge 2 (off-Open) | `closeOnDeadline › non-Open → illegal_edge` | any non-`Open` status → `illegal_edge` |
| edges 3–8 | `legal › <edge>` | each → `{ ok:true, to:<next> }` |
| illegal `:228–232` | `rejects Resolved→Open` / `Frozen→Open` / `Voided→Resolved` / `Open→Resolved` / `Closed→Resolved` / `Draft→Voided` | each → `{ ok:false, reason:"illegal_edge" }` |
| B8 `:233` | `rejects deadline extension` / `allows non-extension` | `proposed > current` → `deadline_extension`; `proposed ≤ current` → `ok` |
| structural | `structure › Frozen absorbing` / `every non-terminal has ≥1 out-edge` / `legal-edge count == 8` | deterministic graph asserts |
| totality | `totality › no throw over MarketStatus²` | `transition` returns a well-formed `TransitionResult` for all 49 typed pairs (never throws); **`transition(f,t).ok === canTransition(f,t)`** across all 49 pairs |

**fast-check property suite — recommend OUT** (rationale): the state space is **finite and tiny** (7×7 = 49). The table-driven test enumerates the **entire** input domain — strictly stronger than property *sampling*, which here would only re-draw from the same 49 pairs with no added coverage and pure seed/determinism overhead. fast-check earns its place on the continuous decimal domain (ENGINE.3's cpmm), not a 49-cell matrix. The "closure/totality" guarantees it would buy are delivered **deterministically** by the structural + totality rows above. fast-check 4.8.0 stays available; if a later stratum adds a *generated transition-sequence* domain (e.g. reachability over random admin/clock event streams), a property suite at **seed `20260605`** (the repo convention) is the right tool *then* — noted, not built now.

## 8. Out of scope (verbatim charter)

- **No `src/` code or tests in THIS chat** — the execute session writes them.
- **No schema / migration work in either half** — `markets`/`pools` are read as built; the missing `resolving_at` stays unbuilt (OQ-C).
- **No SPEC edits** — F-1's SPEC.2 wording drift is owned PRECURSOR.5 work; this plan notes, never fixes it.
- **No tracker edits.**
- **No invented semantics beyond §6.1** — every gap (`Frozen` writer, `resolving_at` anchor, event emission, `Draft→discard`) is an OQ, not a guess.
- **No event emission** — the `market.*` events (`schemas.ts:71–76`) are emitted by handler strata (ENGINE.7/9 per `schemas.ts:98–100`), not the pure machine.
- **No handler / Server Action / transaction / auth wiring**, no `tests/integration/`, no `tests/invariants/I-*` (those land with the tx strata).
- **No *broad* `@security-auditor` audit** — a **narrow** pass runs per the OQ-A ruling, scoped to INV-4-edge-foreclosure + single-gate-bypass only; the module has no auth/tx/moderation/admin surface.

---

## Open questions

> OQ-A, OQ-B, OQ-E, OQ-F are surfaced in the interactive founder batch (genuine forks). **OQ-C and OQ-D adopt the web priors as-is** (low contention) and are recorded here for ratification with the full plan — reopen via any answer's notes if desired. B8 is *proposed* (above), not OQ'd.

- **OQ-A — Ritual shape + soak.** *Context:* `src/server/markets/` is greenfield `src/` business logic (⇒ `@test-writer` RED-first per §5.6 resolution-adjacency) but a **pure, IO-free, money-free, auth-free** module with no `@security-auditor` exploitability surface; markets/ is **not** a §1 critical path. *Options:* (i) RED + `@code-reviewer` + §5.10, **no soak**, `@security-auditor` **deferred to ENGINE.7/9**; (ii) add a **narrow** `@security-auditor` pass scoped to INV-4-edge-foreclosure + single-gate bypass; (iii) full ritual + 24h soak. *Recommendation:* **(i)** — dissenting from the web "full ritual" default with evidence: `@security-auditor`'s charter (auth, tx handlers, moderation, admin, exploitability) has **no surface** on a pure transition function; its value lands when the gate meets auth+tx at ENGINE.7/9. *Soak:* **CLAUDE.md §5.10 ("there is no post-PR soak", newer, SYNC.8) supersedes `plan-then-execute.md`'s 24h soak**; ENGINE.3 merged without one. *Web prior:* full critical-path ritual (OQ-7 precedent invited adjustment). **→ RULED (founder, 2026-06-05): option (ii)** — RED + `@code-reviewer` + a **narrow `@security-auditor`** pass scoped to INV-4-edge-foreclosure + single-gate-bypass + §5.10 audit; **no soak** (§5.10 governs). The CC dissent (drop `@security-auditor`) is **overridden** — the belt-and-braces pass on the INV-4-adjacent gate is retained.
- **OQ-B — `Frozen` encoding (F-2).** *Context:* `Frozen` is both a `market_status` enum value (`markets.ts:22`) and the global `system_state.frozen_at` (`system.ts:14`, SPEC.2 §20.2 — a middleware freeze that **never flips a per-market status**); SPEC.1 §6.1 + cpmm.md §8.4 show `Resolved/Voided → Frozen` as *logical*. *Options:* (i) **real terminal state** — edges 7/8 legal, `Frozen` absorbing (negatives), **ENGINE.4 ships no writer**, per-market `'Frozen'` persistence is a later-strata decision, global freeze stays `system_state.frozen_at`; (ii) logical-only — omit `Frozen` as a reachable status, markets never carry it; (iii) defer to ENGINE.9. *Recommendation:* **(i)** — matches the built enum + §6.1 + the web prior. *Web prior:* real state; `Resolved|Voided → Frozen` legal; fully terminal; no writer; global freeze noted. **→ RULED (founder, 2026-06-05): option (i)** — real terminal state; ENGINE.4 ships no `'Frozen'` writer.
- **OQ-C — `Resolving` anchor + event gaps (F-5 + F-3).** *Context:* ADR-0013 reads `markets.resolving_at` (`:263–266`) for the in-flight timeout (F-BET-5/6) — **not built**; and `Closed→Resolving` / `→Frozen` / `Draft→discard` have **no event type** (P4). *Recommendation (adopt web prior):* **zero schema work here** ("reads built" holds); carry the `resolving_at` anchor + the `market.resolving` event-gap forward to the **ENGINE.7/9** plans (candidate mechanisms: a `market.resolving` events-row timestamp vs. a new column) with an **ADR-0013 in-place patch record** at that point. ENGINE.4's pure functions are unaffected (they model the `Resolving→Resolved` edge; the *timeout* is the handler's). *Web prior:* as stated.
- **OQ-D — `Draft→discard`.** *Context:* `:232` says `Draft→Voided` is illegal; the alternative is `Draft → discard` (no target state). *Recommendation (adopt web prior):* **not a machine transition** — the machine encodes only the `Draft→Voided` **rejection**; `discard` is operational draft handling owned by the **market-creation stratum**; **plan note only** (no `discard` edge, no `discarded` status). *Web prior:* as stated.
- **OQ-E — Illegal-transition error shape.** *Context:* web prior = module-local typed rejection with a reason union; "class or discriminated result — you pick and defend." *Recommendation:* **discriminated `TransitionResult` for expected rejections** (reasons as data, not exceptions) **+ a reserved `MarketTransitionError` sentinel** for the unreachable enum-drift case (defended above). Reason→§15 mapping is ENGINE.7/9. *Web prior:* typed rejection + reason union (sub-choice delegated). **→ RULED (founder, 2026-06-05): option (i)** — discriminated `TransitionResult` + reserved `MarketTransitionError` sentinel. *(A2 type-shape note, 2026-06-05: the B8 field guard returns its own `DeadlineCheckResult`; `deadline_extension` narrows to it — ruling substance unchanged.)*
- **OQ-F — Doc riders.** *Context:* (a) AGENTS.md §9 `tests/` tree gains `markets/`, and the `ZUGZWANG_ENV=preview` build gotcha (`docs/logs/ENGINE.2.md:64`, currently only in a memory + log) is promotion-worthy; (b) the F-4/F-6 editorial fixes (SPEC.1 §2 glossary row: add `Draft` / seven / `status`; ADR-0013 `markets.state`+`resolving_at` wording). *Recommendation:* **(a) ride the execute PR** (ENGINE.3 doc-rider precedent); **(b) queue to PRECURSOR.5** — the F-4/F-6 market-status wording drift is the **same class** as F-1's SPEC.2 listing (already PRECURSOR.5-bound per `markets.ts:14`); consolidating the status-wording sweep beats scattering tiny SPEC/ADR riders across execute PRs. *(Counter-precedent acknowledged: CLAUDE.md §7 "same PR, never a follow-up" + ENGINE.1's §2-fix rider — the founder may prefer (b) rides too.)* **→ RULED (founder, 2026-06-05): (a) ride the execute PR; (b) queue F-4/F-6 to PRECURSOR.5 via a one-line `docs/parked.md` entry, which rides the execute PR with the AGENTS.md riders.**

## Carry-forwards minted by this plan

1. **`resolving_at` anchor + `market.resolving` event gap** (OQ-C / F-5 / F-3) → the **ENGINE.7/9** plans, with an **ADR-0013 in-place patch record** there (candidate mechanisms: a `market.resolving` events-row timestamp vs. a new `markets.resolving_at` column). ENGINE.4's pure functions are unaffected.
2. **Single-gate mechanical-enforcement decision** (self-critique #1 / F-7) — DB trigger vs CI lint vs review-only for the `markets.status` write path → **ENGINE.9** (a Bucket-reclassification / trigger choice is out of ENGINE.4's "reads built, no schema" scope).
3. **F-4 / F-6 editorial fixes** → **PRECURSOR.5** via a one-line `docs/parked.md` entry (A3), riding the execute PR with the AGENTS.md riders.

## ADRs needed

**None at plan time.** A pure transition module mints no event type, error code, schema, vendor, or invariant. The single-gate consumer contract (F-7) is a *consumer* discipline recorded for ENGINE.7/9; if those strata add a CI-lint enforcement mechanism, **that** is the ADR — not this one. (OQ-E's discriminated-result vs class is a local style call, not ADR-worthy.)

---

## Execution checklist (runnable by a fresh session, zero plan-chat context)

> **Hard STOP conditions:** no schema/migration edits (either half); no event emission; no handler wiring; no invented semantics beyond §6.1 — a gap is a STOP-and-surface, never a guess. The legal-edge set **equals** §6.1 exactly; never add an edge to reach green.

1. **Sync + branch** (never in plan mode): `git checkout main && git fetch origin && git reset --hard origin/main` (expect `88b2a02` or later) → `git checkout -b feat/engine-4-market-state-machine`.
2. **`@test-writer` RED (Phase 2 start, OQ-A):** author `tests/unit/markets/transitions.test.ts` from §7 — the 7×7 matrix, every named negative, the `closeOnDeadline` boundary set, the B8 guard, the structural + totality rows. **Tests fail** (module absent). `@test-writer` is forbidden from `src/`. Pass `@docs/plans/ENGINE.4.md`.
   - **CP-1 (checkpoint):** STOP — paste the test file **in full** to the web chat for line review **before** implementation. Confirm the legal set in the matrix equals §6.1 (8 edges) exactly.
3. **Implement to green (main session):** `src/server/markets/errors.ts` (`MarketTransitionError`) → `src/server/markets/transitions.ts` (`MarketStatus` derived from `marketStatusEnum.enumValues`, `LEGAL_TRANSITIONS` + `satisfies` guard, `canTransition`/`transition`/`closeOnDeadline`/`assertDeadlineNotExtended`). `import "server-only"` both files.
   - **CP-2 (checkpoint):** STOP — paste both `src/` files in full for line review **before** the verify gate + cascade.
4. **Green + verify (L-E3.5 — exact local forms):**
   - `pnpm vitest run tests/unit/markets/` (the new suite — DB-free, local).
   - `pnpm vitest run` (whole suite — needs local Postgres `:54322`; locally the `tests/unit/` subset is the proxy, full suite is the CI gate — memory `project_whole_suite_needs_local_postgres`).
   - `ZUGZWANG_ENV=preview just verify` (typecheck → biome → build). **The build stage needs the env prefix** — quoting `docs/logs/ENGINE.2.md:64` verbatim: *"Local `next build` needs `ZUGZWANG_ENV=preview` (the `getRedisKey` build-env gate rejects `"unknown"`); bare `just verify` fails on `/admin/login` page-data collection without it — env-only, not a regression."* (No `pnpm test:invariants`/`test:integration` contribution — ENGINE.4 adds no DB tests.)
5. **Doc riders (per OQ-F ruling):** (a) AGENTS.md §9 `tests/` tree gains `markets/` + the `ZUGZWANG_ENV` gotcha promotion; (b) F-4/F-6 do **not** ride as edits — a **one-line `docs/parked.md` entry** (SPEC.1 §2 glossary: add Draft / seven / status; ADR-0013 `markets.state` + `resolving_at` wording) queues them to PRECURSOR.5 and rides the execute PR alongside the AGENTS.md riders.
6. **Review cascade:** `@code-reviewer` → `@security-auditor` (**narrow** scope per the OQ-A ruling: INV-4-edge-foreclosure + single-gate-bypass). Pass `@docs/plans/ENGINE.4.md` to each.
7. **Pre-PR §5.10 audit (item-by-item PASS/FAIL/SURPRISE):**
   - **Charter map complete** — every §6.1 edge + every illegal bullet maps to a named green test; legal set == 8 edges.
   - **Diff-stat = closed set:** `src/server/markets/{transitions,errors}.ts` + `tests/unit/markets/transitions.test.ts` + the OQ-F (a) AGENTS.md rider + the one-line `docs/parked.md` entry (A3). **Zero schema/migration lines; zero event/handler lines** (`git diff --stat` proves it).
   - **`MarketStatus` derived from `marketStatusEnum.enumValues`** (grep — no hand-written status literal union).
   - **No clock read** in `src/server/markets/` (grep `Date.now`/`new Date(` with no args → none; `now` is an argument).
   - **Single-gate contract** noted for ENGINE.7/9; no direct `markets.status` writer shipped here.
8. **PR** → founder squash-merge → post-merge sync + `git branch -D feat/engine-4-market-state-machine`.

Commit identity `Zugzwang/world` (no `Co-authored-by` trailer); multi-line messages via `/tmp/engine-4-msg.txt` (`rm -f` first; AGENTS.md §10). Tail/grep Write-authored files for stray delimiter tokens before commit. Plan file commits on its own branch before Phase 2; session log ships separately (§5.9).

---

## Self-critique (plan self-review, 2026-06-05)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **high** | The single-gate contract (F-7) is **unenforceable by this module** — `markets` is Bucket C, so a future handler can write `status` directly and bypass every guard. The plan's central value is a *contract*, not a mechanism. | Accepted + escalated: stated as the primary failure mode (§5) and a forward consumer contract binding ENGINE.7/9 (review + candidate CI lint). A DB-trigger alternative would re-classify `markets` out of Bucket C — **out of scope** (no schema work), surfaced for ENGINE.9. |
| 2 | medium | **B8 in the markets module may be scope creep** — it is deadline-field logic, not status logic; it arguably belongs to the market-edit stratum (like `Draft→discard`). | Kept as a 3-line pure predicate (the kickoff's "do not drop it"), clearly labelled *not a status edge*; callers are later strata. Founder can re-route via OQ notes. |
| 3 | medium | `MarketTransitionError` **guards a TS-impossible case** — strict typing precludes an out-of-enum `MarketStatus`, so the sentinel risks violating §5.2 ("no error handling for impossible scenarios"). | Justified by the single-gate criticality (F-7) + JS-caller trust boundary; mirrors `CpmmInputError`'s reserved role. If `@code-reviewer` calls it dead weight at execute, drop it and note the discriminated result is total — recorded as a known thin call. |
| 4 | low | `(typeof marketStatusEnum.enumValues)[number]` introduces a **first-in-repo `.enumValues` pattern**; a reviewer may expect the `EVENT_TYPES` local-union idiom. | Defended in the design (single-source-of-truth beats duplicated literals; complies with AGENTS.md §4); the import is pure + DB-free-testable. Low risk; reversible to a local union + guard if web prefers. |
| 5 | low (resolved) | `Open→Closed` boundary `≥` vs `>`: §6.1 `:210` "deadline **reached**" disambiguates toward `≥` (reached ⇒ the `==` instant closes), so this is a **cited decision**, not an open ambiguity. | Pinned `≥` on the `:210` "reached" wording; the `==` instant retains a named boundary test for explicitness. |
| 6 | low | Only OQ-A/B/E/F are in the interactive batch (4-max); OQ-C/D ride as adopted priors — a founder skim might miss them. | Flagged explicitly in the OQ preamble; C/D are reopenable via any answer's notes; the plan stays `draft` until full ratification. |

Checked: §6.1 charter completeness (8 legal edges + 6 illegal bullets + B8 all mapped to named tests), scope discipline (zero schema/event/handler), invariant adjacency (INV-4 status-level), pure-over-inputs (no clock read), the import decision, the single-gate contract, OQ web-prior alignment + the two dissents (OQ-A security-auditor, OQ-F (b)).

---

## References

- `docs/specs/SPEC.1.md` **§6.1** (`:206–233`, the charter — legal/illegal per row), §2 glossary (`:67`, F-4/F-6), §10.7 (`:509–514`), §11 (`:537–564`), §12.1 (`:574–576`, the global freeze).
- `docs/specs/SPEC.2.md` §3.6 (`:296`), §5.1 row 18 (`:496`), §14.1 INV-4 mech iii (`:1361`) — the owned F-1 wording drift; §20.2 (`:1971–1996`, `system_state.frozen_at` global freeze).
- `docs/specs/cpmm.md` §8 (`:368–424`, resolution/void/freeze — terminal bookkeeping the machine gates), §13 (lowercase-side idiom contrast).
- `src/db/schema/markets.ts` (`:15–23` enum, `:32–54` table — read surface + `marketStatusEnum`), `system.ts` (`:12–18`), `0001_initial_schema.sql:9,202–214`, `0003_append_only_triggers.sql` (markets/pools absent ⇒ Bucket C).
- `src/server/cpmm/{errors,decimal,validate,calculate}.ts` — the pure-module idiom (`errors.ts:20–27` sentinel; `decimal.ts:15` single-authority precedent).
- `src/server/events/schemas.ts` (`:71–76` market events, `:98–100` emit-at-handler), `insert.ts:75–83` (`AggregateType`).
- `docs/adr/0013-concurrency-bet-transaction.md:263–266` — `markets.state`/`resolving_at` drift (F-5/OQ-C).
- `CLAUDE.md` §1 (critical-path list — markets/ absent), §2 (INV-4, event-sourcing), §5.6 (tests-first), §5.7 (verify), §5.10 (no post-PR soak — OQ-A), §5.11 (subagents), §7 (same-PR doc doctrine — OQ-F).
- `AGENTS.md` §4 (string-literal unions — import decision), §9 (test layout/naming), §10 (commit hygiene).
- `docs/plans/ENGINE.3.md` — structural precedent; `docs/plans/SCAFFOLD.2-3B.md:34,292` (7-state enum adoption + SPEC.2 drift flag).
- `docs/logs/ENGINE.0.md:19,23,68` (spec>kickoff event-naming precedent; market events built), `ENGINE.2.md:64` (the `ZUGZWANG_ENV=preview` build line), `ENGINE.3.md:73,82,93` (R-1 ES2017 — non-binding here).
- `docs/plan-then-execute.md` (24h soak — superseded by §5.10 per OQ-A). Tracker: ENGINE.4 (v12).
