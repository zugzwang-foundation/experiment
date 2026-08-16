# POLISH.4 · COMPOSERS + SELL MODULE — PLAN

> **Doc:** `docs/plans/POLISH-4.md` · CC-authored in plan mode · **no code, no branch, no commit written at authoring.**
> **Ground:** `origin/main` @ `35da436a7e46a62049a42b59fa9546caf3f0542f` — `chore(polish): log session — POLISH.5 PR C complete (#340, squash a464d52) (#342)`.
> **Measured from** a detached read-only worktree at that exact SHA (`/Users/hrishikesh/code/zz-p4-plan`). The authoring session's primary tree is on `polish/5-pr-a` @ `b8a3888`, which carries **unpushed POLISH.5 PR A work and a `CLAUDE.md` that stops at `O-8`**. `main` carries `O-9`. **Every number in this plan is read off `35da436`, never off the loaded contract file.**
> **Procedure:** `docs/polish/POLISH-SURFACE-TEMPLATE.md` at its live ceiling — **§13.6**. Its rules are **cited, never restated**.
> **Method:** `docs/polish/POLISH-0.md`. On any disagreement with this file, `POLISH-0.md` wins and this file is the defect.
>
> **⚠ AMENDED 2026-08-16, at the PR A execute session — the record of the change is §15; its delivery is not.** The founder **ratified `OD-1` … `OD-4`** and **folded the HTML-FINISH parity lane into `.4`** for this surface. Amendment ground: `origin/main` @ `8db535da` (`main` moved `35da436` → `8db535d` between authoring and execute; every number re-measured at the new head agreed, and the two that are new are in §15). **Additive.** §1, §2, §8 and §13's rulings are untouched. Per `O-5` the corrections are written **INTO** §4, §5, §10, §12 and §14 — the operative sections — and §15 records the change rather than delivering it.

---

## §A · ADMIT-CHECK — run this before reading further

Per template §9.3, a file handed between lanes carries an admit-check the receiver runs first.

| Leg | Value |
|---|---|
| Ground SHA (authoring) | `35da436a7e46a62049a42b59fa9546caf3f0542f` |
| Ground SHA (amendment) | `8db535d` — `fix(db): bound the Supavisor pool … (#343)` |
| Section sequence | `§A · §0 · §1 · §2 · §3 · §4 · §5 · §6 · §7 · §8 · §9 · §10 · §11 · §12 · §13 · §14 · §15` — contiguous, `§A` then `§0`…`§15`. ⚠ **`§15` is the amendment's; a receiver holding the pre-amendment file reads `§0`…`§14` and is holding a stale copy.** |
| ID range minted | `PD-4-01` … `PD-4-11`, contiguous, no gaps. ⚠ **The amendment mints NO `PD-4` id** — its findings are `P4-F1` … `P4-F5` (§15.3), a task-scoped prefix, never a bare `F-n` |
| Unique string | *"the defect class does not reproduce on this surface"* (§3, `PD-4-06`) |
| Unique string | *"a live hold that the index asserts does not exist"* (§2.6) |
| Unique string *(amendment)* | *"the file that DECLARES the arrangement, not the file that is arranged"* (§15.3, `P4-F1`) |

⚠ **The section-sequence leg was itself stale from the edit that added `§15`** — the classic `O-8`/`O-9` shape, and the reason it is restated rather than left to be discovered. A self-describing leg goes stale from the very change it describes.

**A line count is deliberately NOT an admit-check leg** — template §13.5's corollary: name legs the receiver can check in the medium the handoff travels in.

---

## §0 · GROUND, MODE, AND THE STANDING STATEMENTS

### 0.1 · Ceilings, re-read at head (`O-2`)

Read off `35da436`. **Highest value read, never counted.** The recon's values were re-derived independently by this session and agree; they are restated here because a plan that cites a ceiling it did not measure is `V-9`.

| Register | Ceiling at `35da436` | Read from | Next free |
|---|---|---|---|
| ADR | **`0036`** | `docs/adr/` highest-numbered filename (`0036-vitest-context-operational-runners.md`); 35 files, `0002`/`0012` unused | `0037` |
| O-space | **`O-9`** | `CLAUDE.md` — *"Editing prose that cites a governing document by section number…"* | `O-10` |
| V-space | **`V-10`** | `docs/polish/POLISH-0_data-manifest.md` §5 | `V-11` — ⛔ **founder-mint only** |
| Surface template §13 | **`§13.6`** | `POLISH-SURFACE-TEMPLATE.md` | `§13.7` |
| `PD-4-nn` | **NONE — virgin** | whole-repo grep for `PD-4-`: **zero hits**, independently re-run this session | **`PD-4-01`** |
| R-register | **`R19`** | `POLISH-0.md` §0 · self-states 5 SCHEDULED · 14 RULED · **zero OPEN** | `R20` |
| Migration head | **`0024_bookmarks`** | `drizzle/migrations/` | `0025` |
| `EVENT_TYPES` | **24** | `src/server/events/schemas.ts::EVENT_TYPES` | — |

### 0.2 · ⛔ ULTRACODE / DYNAMIC WORKFLOWS — **FORBIDDEN**

Stated by the kickoff. Independently, `CLAUDE.md` §6's four conditions fail here on **at least two** counts: `.4` carries ordered proof obligations (RED-before-fix guards, a byte-identical zero-delta baseline — §8.2), and template §7 forbids stacking ultracode on a gated unit. **No workflow, no `ultracode`, no parallel fan-out.** `ultrathink` is the first word of every execute prompt.

### 0.3 · `O-6` — AN UNBIDDEN FENCED ARRIVAL IS DECLARED

**Declared:** `~/Downloads/POLISH-4-RECON.md` · md5 `df82432e524b4b623525e67ba3be4f37` · 534 lines · sections `§0`…`§10` · ground SHA `35da436`, matching this plan's.

**Bearing, in one line:** it is a **scoping** recon — plan-existence, carry-in, contention, ceilings — and this plan consumes it as corroboration only; **every load-bearing number below was independently re-measured this session** and each agreed.

**The run CONTINUES on that statement.**

⚠ **What it is NOT, and this is the plan's central structural finding — see §2.1:** it is **not** the template §3 delta recon (*"one row per difference between the tier-4 mockup and the built components"*). No such recon exists for `.4`.

### 0.4 · `§13.1` PRE-FLIGHT — this plan run against its own stop conditions

Template §13.1 requires a plan be run against its own stop conditions **before** it ships, because a plan can forbid its own execution invisibly.

| Stop condition (§10) | Fires on this plan's own text or commit 0? | Carve-out |
|---|---|---|
| `H-SLOT` — `SlotHeader.tsx` is annexed | This plan **quotes** `SlotHeader.tsx` symbols in §2.4 and §7. Quoting is not editing. | ✅ **`H-SLOT` does not fire on the verbatim text of this plan.** Stated in advance; no judgment call at execute. |
| `H-SUSPENDED` — `suspended-modal.test.tsx` is annexed | Named in §5 and §8 as excluded. | ✅ Same carve-out. |
| `H-OQ1` — rendering `Đa` or P/L is a defect | This plan **names** P/L in `PD-4-07`. | ✅ Naming a blocked item is the mechanism by which it stays blocked. Does not fire. |
| `H9` — no commit lands red | Commit 0 is **docs-only** (§9). `just verify` is green on a docs-only diff by construction — ⚠ and per the standing lesson that a doc-only Biome pass checks **zero files**, commit 0's receipt is the **`pnpm vitest run` result**, not `just verify`. | ✅ Stated, not discovered. |
| `H14` — a static guard finds an offender not in its predicted list | `PD-4-04`'s micro-label work touches files pinned by `tests/unit/shell/dharma-cluster.test.tsx`, which **names `PositionStrip.tsx:44,61` and `SellModule.tsx:263,278` in a comment**. | ⚠ **Predicted here, at plan time.** See §8, row 6. |

**Result: the plan does not forbid its own execution.** Four carve-outs written in advance, one hazard predicted.

### 0.5 · ⛔ STATE THE CLASSIFIER BEFORE QUOTING ANY COUNT

Two of this surface's three inherited items are **classifier-dependent**, and for both, *two honest counts disagree and neither is wrong*. Every count in this plan is therefore prefixed by its predicate. **A number in this document without a stated classifier is a defect in this document.**

---

## §1 · THE CARRY-IN — measured, ratified, **DO NOT RE-DERIVE, DO NOT RE-OPEN**

These four were measured at `35da436` by the recon and **independently re-measured by this session**. An execute session must not re-litigate them.

### 1.1 · `RR-3` is **FIXED**. `.4` owes the record, not the fix.

**Verified in source at head, by symbol** (`O-8`) — `ReplySplitBar.tsx`, the split-bar **track** span and its **fill** child:

```
track: `h-1.5 w-full … ${postSide === "YES" ? "bg-no"  : "bg-yes"}`
fill:  `block h-full   ${postSide === "YES" ? "bg-yes" : "bg-no"}`
```

Both side-key on `postSide`. **The inversion is gone.** `.3` took it at **#339** (`54f3962`, commit `9f86076`, C13), attended, with `@code-reviewer` **and** `@security-auditor`.

**`.4`'s obligation is a two-part record act** — `POLISH-0.md` §3's Pre-recorded cell: *"whichever runs first takes it and the other records the adoption."*

**(a)** File the adoption record.
**(b)** Close the **three** sites that still assert it open — and the stale coordinates go with them:

| # | Site | Currently asserts | Stale coordinate carried |
|---|---|---|---|
| 1 | `POLISH-register.md` — the `RR-3` row under **POLISH.2** | `routed` \| **`open`** · *"live pole inversion on `/m/[slug]`"* | `ReplySplitBar.tsx:64,67` |
| 2 | `POLISH-register.md` — the `RR-3` row under **POLISH.3** | `inherited` \| **`open`** · *"⚠ **INV-3 — live pole inversion**"* | `ReplySplitBar.tsx:64,67` |
| 3 | `POLISH-TRACKER.md` **§3 · Inherited work** — the `RR-3` row | *"⚠ **A LIVE INV-3 pole inversion**"* | `:64,67` **and** `:118-122` |

⚠ **Both coordinates on site 3 are stale, not one.** `:64,67` now lands inside the explanatory comment block; the live spans are the track and fill named above. `:118-122` cited the *correct* sibling pole — which at head is `TriggerPill`'s `pole` const. **Drift introduced by the very commit that fixed the defect.** Per `O-8` the replacements name **symbols**, and demote every line number to evidence.

⚠ **The `INV-3` label on those rows is itself superseded** — `docs/plans/POLISH-3-PR-2.md` struck it, on the ground that INV-3 is a **storage** invariant and a Tailwind class cannot violate it. The rule actually broken is the design-language axis correction + `AGENTS.md` §8's *"the poles name the SIDE (YES/NO), never the Support/Counter relation."* **Do not carry `INV-3` forward into the adoption record** (`S2`: a supersession voids a rationale but the delta held on other grounds — state the new ground).

### 1.2 · `MICRO-LABEL-TIER` — **EIGHT sites in this surface**

**⇒ CLASSIFIER, stated first:** `uppercase` **∧** a `tracking-*` class, in `src/components/**`, participant surfaces only, `src/app/(admin)/**` excluded. This is `docs/parked.md`'s own predicate.

**Re-measured this session at `35da436`. The count and the enumeration are one artifact (§13.3):**

| # | Site | Tier | Owner |
|---|---|---|---|
| 1 | `PositionStrip.tsx` — the `To win` label span | `text-[10px] font-bold tracking-[0.1em] text-n5` | **`.4`** |
| 2 | `PositionStrip.tsx` — the `Your position` label span | `text-[10px] font-bold tracking-[0.1em] text-n5` | **`.4`** |
| 3 | `SellModule.tsx` — the `Position` label span | `text-[10px] font-bold tracking-[0.1em] text-n5` | **`.4`** |
| 4 | `SellModule.tsx` — the `You receive` label span | `text-[10px] font-bold tracking-[0.1em] text-n5` | **`.4`** |
| 5 | `BetComposer.tsx` — the `argumentLabel` div | `text-[9.5px] font-bold tracking-[0.12em] text-n5` | **`.4`** |
| 6 | `BetComposer.tsx` — the `amountLabel` span | `text-[9.5px] font-bold tracking-[0.12em] text-n5` | **`.4`** |
| 7 | `BetComposer.tsx` — the `toWinLabel` span | `text-[9.5px] font-bold tracking-[0.12em] text-n5` | **`.4`** |
| 8 | `AuthGateSlot.tsx` — the `AUTH_GATE_COPY.micro` div | `text-xs font-medium tracking-wide text-n4` | **`.4`** |

**⛔ THE FOUR UNDER `shell/` ARE `POLISH.1`'s AND ARE OUT** — `IdentityCluster`, `RadioSlot`, `DharmaCluster` ×2. `POLISH-0.md` §5 / template §4.2 **C1** forbids a V batch spanning surfaces. **The docket row cannot be discharged whole by `.4`.**

**⇒ NEW THIS SESSION — the eight are not one tier, they are THREE:**

| Tier | Size / tracking / weight / colour | Sites |
|---|---|---|
| **T-A** | `10px` / `.1em` / bold / `n5` | 4 |
| **T-B** | `9.5px` / `.12em` / bold / `n5` | 3 |
| **T-C** | `12px` / `tracking-wide` / medium / `n4` | 1 |

⚠ **And `.3` has already minted a FOURTH** — `docs/plans/POLISH-3-PR-2.md` ruled `text-[9.5px]` / `font-extrabold` / `tracking-[.14em]` / `uppercase` / `text-n4`, now live at `MarketHeader.tsx`. **Normalising `.4`'s eight onto `.3`'s tier would be a fifth value, not a convergence.** This needs a ruling — see `OD-2`.

⚠ **A sub-finding, recorded so it is not inherited as fact:** `.3`'s ruling cites *"precedent `composer/SlotHeader.tsx (SlotHeader → the colhead micro-labels)`"*. **`SlotHeader.tsx` carries no uppercase micro-label at head** — zero hits under the classifier. The precedent it actually demonstrates is that *arbitrary Tailwind values are expressible* (`text-[19px]`, `min-h-[34px]`), which is true. **The parenthetical is wrong; the ruling is not.** Not `.4`'s to fix — `.3`'s document — recorded here so `.4` does not adopt a tier on a citation that does not resolve.

⚠ **Tree-wide, the same classifier returns 15 sites across 9 files** — `parked.md`'s *"12 across 7 files"* has drifted by `MarketHeader`'s newly-minted one plus `HeroPanels`' second. **The composer slice is stable at 8/4 and is what `.4` owns.**

### 1.3 · `rate_limited` — **EIGHT composer sites across FIVE files**, not six

**⇒ CLASSIFIER, stated first:** the substring `rate_limited`, anywhere under `src/components/debate/composer/**`. This spans both string families — the `p4_rate_limited` composer **state name** and the bare `rate_limited` **key-outcome** value.

**Re-measured this session. Count and enumeration are one artifact:**

| # | File | Symbol / context | Family |
|---|---|---|---|
| 1 | `state-map.ts` | `ComposerStateName` union member | `p4_rate_limited` |
| 2 | `state-map.ts` | `STATE_BY_CODE` — `error_rate_limit_exceeded:` | `p4_rate_limited` |
| 3 | `state-map.ts` | `keyOutcomeFor` — the 429 return | `rate_limited` |
| 4 | `idempotency.ts` | `KeyOutcome` union member | `rate_limited` |
| 5 | `idempotency.ts` | `reduceKey` — the `case` arm | `rate_limited` |
| 6 | `BetComposer.tsx` | the submit-outcome `case` arm | `p4_rate_limited` |
| 7 | `SellModule.tsx` | the submit-outcome branch | `p4_rate_limited` |
| 8 | `ErrorStrip.tsx` | the render-elsewhere early return | `p4_rate_limited` |

**Sub-counts, so a future reader can reconstruct any of them:** `p4_rate_limited` alone → **5** · bare `rate_limited` alone → **3** · distinct files → **5** · all composer matches → **8**.

⛔ **The cited "six" is reconstructible under no classifier**, and **none of the five files has changed since C15 was written** — so this is not drift; it was wrong at write time and has been cited forward into `POLISH-TRACKER.md` and `POLISH-register.md` without re-measurement (`V-9`).

**⇒ AND THE PART THAT CHANGES THE DISPOSITION — see `PD-4-06`.** The routing carries an implied defect class that **does not reproduce here.**

### 1.4 · `PD-5-07` / `L-7` — `copy.ts::c2Strip` is a dead export

**`.4`-owned, filed under POLISH.5's register section** — so a `.4` recon reading only the `.4` section never sees it.

**Re-verified this session:** `c2Strip` resolves to exactly one site tree-wide, `src/components/debate/composer/copy.ts::c2Strip`, with **zero consumers** in `src/` or `tests/`. Its sibling `c2Sentence` **is** consumed — `BetComposer.tsx`, the floor-above-balance strip. Register disposition: `routed` / `open`, root cause recorded as *"re-pointing rather than removing was the correct §5.3 surgical call."*

⚠ **`L-9`'s half is POLISH.5's** (`profile/graph/geometry.ts`) and is **out of `.4`'s scope entirely**. The row splits by half; `.4` takes only `L-7`.

---

## §2 · MEASUREMENTS TAKEN THIS SESSION — new, not in the recon

### 2.1 · ⛔ **THE DELTA RECON DOES NOT EXIST, AND THIS PLAN CANNOT INVENT IT**

Template §1 fixes the machine phase as `RECON ─▶ CLASSIFY ─▶ RATIFY ─▶ EXECUTE ─▶ GATE C`, and §3 defines what a recon produces: **one row per difference between the tier-4 mockup and the built components**, each with `mockup:line`, `file:line`, class, disposition, baseline and halt.

**`POLISH-4-RECON.md` is not that.** It answers *does a plan exist · what is the carry-in · what is contended · what are the ceilings*. It contains **zero mockup-vs-build delta rows**. Its own §10 calls itself *"the measured carry-in"*, not a delta set.

⇒ **The item space in §3 below is therefore COMPLETE for the carry-in and the riders, and EMPTY for the tier-4 pass.** Template §4 HARD RULES: *"Do NOT construct anything that is missing. Classify it and move on."* This plan does not fabricate a delta table it has no recon for.

**`OD-1` asks the founder to rule on the sequencing.** The relay for the delta recon is drafted and ready at §12.

⚠ **Why this is stated at the top of §2 rather than as a footnote:** a plan that silently shipped a thin item table would read as *"the surface has few deltas."* It has an **unmeasured** number of deltas. Those are different objects and only one of them is honest.

### 2.2 · The Components cell omits **8 of 19** files, and the omission is systematic

`POLISH-0.md` §3's Components cell names **11**. `git ls-files src/components/debate/composer/` returns **19**. Enumerated (count and enumeration are one artifact):

| # | File | In cell? | # | File | In cell? |
|---|---|---|---|---|---|
| 1 | `AuthGateSlot.tsx` | ✅ | 11 | `requests.ts` | ✅ |
| 2 | `BetComposer.tsx` | ✅ | **12** | **`envelope.ts`** | ⛔ |
| 3 | `ErrorStrip.tsx` | ✅ | **13** | **`gating.ts`** | ⛔ |
| 4 | `ImageAttach.tsx` | ✅ | **14** | **`idempotency.ts`** | ⛔ |
| 5 | `PositionStrip.tsx` | ✅ | **15** | **`image-attach.ts`** | ⛔ |
| 6 | `ReplySplitBar.tsx` | ✅ | **16** | **`quote-reader.ts`** | ⛔ |
| 7 | `SellModule.tsx` | ✅ | **17** | **`sell-convert.ts`** | ⛔ |
| 8 | `SlotHeader.tsx` | ✅ | **18** | **`split-bar.ts`** | ⛔ |
| 9 | `copy.ts` | ✅ *(ambiguous)* | **19** | **`state-map.ts`** | ⛔ |
| 10 | `payload.ts` | ✅ | | | |

**Every named entry is a `.tsx` component or one of three `.ts` files shipping user-visible strings or request shapes. Every omission is a `.ts` logic module.** The cell enumerates the **render** surface and drops the **behaviour** surface.

**Not academic — three of the eight hold live `.4` work:** `state-map.ts` and `idempotency.ts` carry **5 of the 8 `rate_limited` sites**; `split-bar.ts` holds `computeSplitBar`/`displaySplitTotal`, imported read-only by `.3` across its own `composer/**` deny-belt. **An allow-list built from this cell would exclude the files holding the work** — template §13.6's genus one level up.

**`copy.ts` resolves to two tracked paths** — `debate/composer/copy.ts` and `profile/copy.ts`. The bare token has already caused one mis-routing on the record (`docs/logs/POLISH-56-STEP0-RECON-CLOSE-OUT.md`: *"I path-qualified `copy.ts` to the wrong file"*).

### 2.3 · ⛔ **NEW — the Cross-surface cell's `Đ BET` coordinate is stale**

`POLISH-0.md` §3's `.4` Cross-surface cell reads: **`"Đ BET" (pre-verified — copy.ts:40,43)`**.

**Measured at `35da436`:**

| Claim | Truth |
|---|---|
| `copy.ts:40` | holds `sell: "Sell",` — **not** `Đ BET` |
| `copy.ts:43` | is inside the `overCapStrip` docblock — **not** `Đ BET` |
| `Đ BET` actually lives at | `COMPOSER_COPY.header` (`"Place your Đ BET"`) and `COMPOSER_COPY.submit` (`"PLACE Đ BET"`) |

The **claim** is true — `Đ BET` is cross-surface and is in `copy.ts`. The **coordinate** is stale. A pre-verification whose evidence pointer does not resolve is a `V-3` false receipt: it reads as checked. **`O-8`** — the replacement names the two `COMPOSER_COPY` symbols. → **`PD-4-03`**, a same-commit rider on the very cell §11 already opens.

### 2.4 · `SellModule.tsx` is a `.4` file with a `.5` host — the read-only boundary

`SellModule.tsx` sits inside `debate/composer/` but its **only** mount is `src/components/profile/PositionsTable.tsx` (`import { SellModule } from "@/components/debate/composer/SellModule"`; rendered in the Sell-trigger branch). This is what `POLISH-0.md`'s Scope cell means by *"the sell module on `/u/[pseudonym]` … Host chrome belongs to .3 and .5."*

⇒ **`PositionsTable.tsx` is READ-ONLY for `.4`** — read it, do not edit it. It is `.5`'s host and 1,080 lines. See §6, `H-HOST`.

⚠ `tests/unit/profile/render/sell.test.tsx` **mocks** `SellModule`, so it pins the *mount*, not the module. It is `.5`'s and is **not** in `.4`'s allow-list — but a `SellModule` prop-signature change would redden it. See §8, row 7.

### 2.5 · `DESIGN_W2_10` has **no close-out**, and the mockup itself expects one

**Measured:** every `DESIGN_W2_*` mockup HTML in `docs/design/mockups/` has a paired `CLOSE-OUT.md` — W2_1, W2_2, W2_4-5-14, W2_6, W2_8, W2_11, W2_13. **`DESIGN_W2_10_sell-and-clamp_mockup-v0_1.html` is the sole exception.**

⚠ **The mockup's own panel E is captioned** *"for the consolidated-doc updates + close-out (**authored after sign-off**)"* — the close-out was anticipated and never written.

**This is consequential, not bookkeeping.** W2_10 is the **sole** tier-4 baseline for the sell module, and `.4`'s tier-2 row leans on rulings a close-out normally ratifies (*"sell is never clamped; cap clamp buy-only"*). `POLISH-0.md` §2.2 is where such a gap is declared; **it is not declared there.** → the second same-commit rider, §11.

**And the gap has teeth.** Panel E's *"Copy — add"* row names **`"Profit / Loss" (sell)`**. The built `SellModule` renders `You receive` and **no P/L**. Two higher tiers disagree about whether that is a defect:

- **Tier 4 (W2_10 panel E)** — P/L is an add.
- **Tier 2 (canon §4 ruling 2)** — W2.10 collapsed to *"the Sell module (default = full position, editable partial) + a clean **price / shares / cost-or-proceeds** display."* No P/L.
- **Tier 3 (`docs/plans/UI-A3.md`)** — *"P/L secondary readout REQUIRES the staked basis → **You-receive-only until the OQ-1 founder ruling lands as its SPEC.1 line** (ratified; **rendering P/L before then is a defect**)."*

⇒ **Tier 3 governs and the build is CORRECT.** A close-out would have recorded this; its absence is exactly what would let a delta recon file the build as a defect. → `PD-4-07`, disposition **`duplicate-of-known` / blocked**, and `H-OQ1`.

### 2.6 · ⛔ **NEW — `OQ-1` is a live hold that the ruling index asserts does not exist**

`POLISH-0.md` §0 closes: **"5 SCHEDULED · 14 RULED · zero OPEN … Nothing in this index stops work."**

**Measured:** `OQ-1` — the **Đa staked-basis** ruling — is **HELD, founder-pending**, and is cited in-source as a live constraint on **three** `.4` components:

| File | Symbol | The hold, verbatim in source |
|---|---|---|
| `SellModule.tsx` | the module docblock | *"the P/L secondary readout REQUIRES the staked basis and is a DEFECT until the OQ-1 founder ruling lands as its SPEC.1 line"* |
| `SlotHeader.tsx` | the `yourPositionLabel` readout | *"Đb-ONLY until the Đa staked-basis SPEC.1 line lands (OQ-1 HELD)"* |
| `PositionStrip.tsx` | the component docblock | *"Đb-ONLY until the Đa staked-basis SPEC.1 line lands (OQ-1 HELD — the `Đa → Đb` grammar activates then)"* |

Tier 3 states the law: `docs/plans/UI-A3.md` — *"**HELD — founder ruling pending.** Law stands verbatim: strip = Đb-only; sell module = You-receive-only; **rendering Đa or P/L before the SPEC.1 line lands is a defect.** The ruling, whenever given, is its own web-authored SPEC.1 line and is NOT carried by A3."*

⇒ **`OQ-1` appears nowhere in `POLISH-0.md` §0.** `R1`…`R19` do not include it. **The index's "zero OPEN" is true of its own nineteen rows and false of `.4`'s surface** — a live hold that the index asserts does not exist. Class **S** against the method document (template §2: *"a divergence is a class-S row against the method document"*). → `PD-4-08`.

⚠ **This is the inverse of `R13`'s lesson.** There, a *missing source* was allowed to imply a missing baseline. Here, a *present index* is allowed to imply an absent hold. Both are the same error: reading a document's silence as a measurement.

### 2.7 · `R11` shows no recorded disposition despite `.5` having run

`POLISH-0.md` §0 `R11` — *"**SCHEDULED.** Disposition set at POLISH.5 kickoff. `PD-0-12`."* `.5`'s three PRs (#331, #333, #340) have all merged. **No disposition for `R11`/`PD-0-12` is recorded on `main`.** `.4`'s own Pre-recorded cell carries it (*"the decision is server-side; the render is .5's"*). **`.4` must not treat it as discharged.** Not `.4`'s to rule; recorded so `.4` does not inherit it silently. → `PD-4-09`.

### 2.8 · `§13.6` PRE-FLIGHT — **discharged at plan time, as the rule demands**

Template §13.6 mandates this grep at **plan** time, not execute:

```
grep -rn 'Object.keys(' tests/ | grep -E 'toEqual|toHaveLength'
```

**Result at `35da436`: 17 shape assertions tree-wide.** *(The template recorded 18 at `c8ba802`; re-measured, not inherited.)*

**THREE are inside `.4`'s population, and all three EXHAUSTIVELY ASSERT a composer request shape:**

| File | Asserts |
|---|---|
| `tests/unit/composer/requests.test.ts` | the `buildPlaceRequest` body's sorted key set |
| `tests/unit/composer/sell-request.test.ts` | `["marketId", "shares"]` — set equality |
| `tests/unit/composer/image-attach.test.ts` | the sign-route body's sorted key set |

⇒ **Any change to `payload.ts`, `requests.ts` or `image-attach.ts` that adds or removes a wire field breaks set-equality in a file the consumer analysis would not surface.** All three are in the allow-list (§5) and named in the test census (§8).

**This plan widens no shared DTO.** Recorded explicitly per §13.6's *"a widening is not a weakening, and the plan must say which it is"*: **`.4` performs NEITHER.** If a delta recon later proposes one, §13.6's pre-flight re-runs at that plan.

### 2.9 · The engaged-slot backlight's implementation site is **`.3`'s, not `.4`'s**

`.4`'s tier-2 row cites **values-log §1 item 4** (engaged-slot backlight — *"on the engaged side's own slot (MDSlot / RVColumn) while the composer is open opposite"*).

**Measured:** the only implementation is `DebateColumn.tsx` (the `engaged` prop and its glow branch), driven from `DebateView.tsx`. **Both are `src/components/debate/`, not `debate/composer/` — `.3`'s surface.** The values-log item's own wording confirms it: it lands on the **slot**, and explicitly *"Composer chips restored to pre-glow rendering."*

⇒ **`.4` cites a tier-2 item it cannot execute.** Any delta found against it is `H4` (crosses into another surface) / template §4.2 **C1**. Recorded so a delta recon does not open it as a `.4` row. → `PD-4-10`.

---

## §3 · THE ITEM TABLE — **eleven rows. The enumeration IS the count (§13.3).**

`PD-4` is virgin; this is the first mint. IDs are contiguous `PD-4-01` … `PD-4-11`.

| ID | Item | Class | Baseline (tier + doc) | Disposition | Halt | Lane |
|---|---|---|---|---|---|---|
| **`PD-4-01`** | `RR-3` **adoption record** filed — `.3` took the fix at #339 | — | tier-2 · `POLISH-0.md` §3 Pre-recorded (*"the other records the adoption"*) | build unasked (**B1**) | no | **A** |
| **`PD-4-02`** | The **three** sites asserting `RR-3` open are closed; both stale coordinates re-fenced by symbol | R | `O-8` · the source at head | build unasked (**B1**) | no | **A** |
| **`PD-4-03`** | `POLISH-0.md` §3 Cross-surface cell — `copy.ts:40,43` does not resolve; re-fence to the two `COMPOSER_COPY` symbols | R | `O-8` · `copy.ts` at head | build unasked (**B1**) | no | **A** |
| **`PD-4-04`** | `MICRO-LABEL-TIER` — 8 composer sites across **three** tiers; `.1` owns 4 more; `.3` has minted a fourth tier | V | tier-2 · `docs/parked.md` `MICRO-LABEL-TIER` (D8, a recorded departure) | ⛔ **RULING REQUIRED** | **H5** | **B** |
| **`PD-4-05`** | `copy.ts::c2Strip` — dead export, zero consumers (`PD-5-07`/`L-7`, `.4`-owned) | S | tier-2 · `POLISH-register.md` `PD-5-07` | ⛔ **RULING REQUIRED** — remove vs re-point | **H5** | **B** |
| **`PD-4-06`** | `rate_limited` — 8 sites / 5 files. ⛔ **The defect class does not reproduce on this surface** | — | tier-2 · `POLISH-register.md` `PD-0-15` · `docs/logs/POLISH-7a.md` C15 | **`duplicate-of-known` / not-a-defect**, ground stated | no | **B** |
| **`PD-4-07`** | Sell module has no **P/L** readout; W2_10 panel E names it as an add | S | tier-3 · `docs/plans/UI-A3.md` **OQ-1** (governs over tier-4) | **blocked** — rendering it is a ratified defect | **H-OQ1** | **B** |
| **`PD-4-08`** | `OQ-1` is a live hold absent from `POLISH-0.md` §0's *"zero OPEN"* index | S | tier-3 · `UI-A3.md` vs `POLISH-0.md` §0 | **SPEC-FIRST** — route, do not build | **H6** | **A** |
| **`PD-4-09`** | `R11`/`PD-0-12` has no recorded disposition though `.5` has run | — | `POLISH-0.md` §0 `R11` | **routed**, not `.4`'s to rule | no | **A** |
| **`PD-4-10`** | values-log §1 item 4 (engaged-slot backlight) implements **only** on `.3`'s files | — | tier-2 · values-log §1 item 4 | **out of surface** — `C1` | **H4** | **A** |
| **`PD-4-11`** | The tier-4 delta pass — **no recon exists** (§2.1) | S | template §1 / §3 | ⛔ **PRECONDITION** — `OD-1` | **H17** | — |

**Lane A = record acts, no `src/` change. Lane B = code, `src/` change.**

**⚠ Six of eleven are class `—` or `S`.** That is the honest shape of a surface whose delta recon has not run: `.4`'s determinate work today is **overwhelmingly a record-reconciliation act**, not a build.

### 3.1 · What is deliberately NOT here

- **No tier-4 delta rows.** §2.1. Not constructible without a recon; not fabricated.
- **No `shell/` micro-label rows.** `.1`'s (§1.2).
- **No `L-9` row.** `.5`'s half of `PD-5-07` (§1.4).
- **No `SlotHeader.tsx` row.** Annexed (§5).

---

## §4 · THE PRs

**THREE PRs, ordered — `A → B → C`.** *(Amended: the plan as authored had two. The founder's fold splits the code lane in half, because the parity lane's rows are of two kinds and they cannot be tuned in one pass — see "Why B precedes C".)* `.4` is `full ritual` (`POLISH-0.md` §6) — the only remaining surface so marked.

| PR | Scope | Ritual |
|---|---|---|
| **PR A · THE RECORD** | Lane A — `PD-4-01` · `-02` · `-03` · `-08` · `-09` · `-10`, plus both same-commit riders (§11) and the `PD-4` register section mint. **`docs/**` only. Zero `src/`, zero `tests/`.** | `just verify` + `pnpm vitest run`. **No subagent cascade** — no `src/server/`, no schema. Gate C. |
| **PR B · LAYOUT + BEHAVIOUR** | **What moves, what opens, what closes, what reflows.** `PD-4-05` (`c2Strip` removal — a source-shape change, no value moves) · `PD-4-06` (zero code; its deliverable is the three-file zero-movement proof, §8 row 9) · **plus the parity lane's arrangement-and-behaviour row set** (§12, table **B**). | Full: `@test-writer` first (§5.6) → `@code-reviewer` → `@security-auditor`, **sequentially, one DB-touching reviewer at a time**, launched from a worktree at `origin/main`. Pre-PR self-audit (§5.10). Gate C. ⛔ **`H-CASCADE` (§10) makes the cascade mandatory, not discretionary, on any row touching `BetComposer.tsx` or `SellModule.tsx`.** |
| **PR C · VALUES** | **Type size, tracking, weight, colour, radius, spacing.** `PD-4-04` (the eight micro-labels → the `OD-2` named preset) · **plus the parity lane's value row set** (§12, table **C** — which the recon reports as *reference data only*, never as pre-classed rows). | Same full cascade. Gate C. ⛔ **`H-VALUE` and `H-SYSTEM` (§10) govern every row here.** |

**`PD-4-07` lands in none of the three.** It is **blocked** by `H-OQ1` until the `OQ-1` SPEC.1 line lands; a blocked row has no PR, only a register entry (PR A's).

**PR A can open today.** PR B and PR C both wait on the `OD-1` delta recon (§12), which is now ratified to run.

### ⚠ Why **B precedes C**, and it is not a preference

**Values tuned on a structure that is about to change are tuned twice.** The founder's ground, and this family has already paid for it twice — measured, not asserted:

- **HTML-FINISH · PROFILE, rounds 4 → 5.** R4 measured the headzone band across three viewports and produced a table (`1024→258`, `1280→318`, `1440→358`) that R5 **discarded whole**. The structural lever R4 could not reach — `ProfileGraphCard`'s `aspect-[2/1]` — came off at R5, and the band was re-derived from scratch to a single `256`. R4's numbers were correct when taken and worthless one commit later. *(`docs/logs/HTML-FINISH-PROFILE-R4.md` §2 item 3 · `HTML-FINISH-PROFILE-R5.md` §2 item B.)*
- **HTML-FINISH · BOOKMARKS, rounds 1 → 3.** R1 byte-carried a panel's values (`p-3`, `[border:var(--hairline)]`, the title tier) onto a one-panel arena. R3 replaced the arrangement wholesale with the full Profile replication, and every one of those values was re-derived against a different structure. *(`docs/logs/HTML-FINISH-BOOKMARKS.md` §4 · `HTML-FINISH-BOOKMARKS-R3.md` §5.)*

⇒ **B is not "the easy half first."** It is the half whose output C's rows are measured *against*. A value row whose host element moves in B is a row measured twice and trusted once.

⚠ **Why PR A is not folded into either:** `PD-4-02`'s whole purpose is that a `.4` delta recon reading the register cold **re-opens a fixed defect**. The record act must land **before** the delta recon runs, or it buys nothing. The fold makes this sharper, not softer — the recon now commissions two row sets off that same register.

---

## §5 · THE ALLOW-LIST — by path, explicit

### Source — **18 of 19** files under `src/components/debate/composer/`

`AuthGateSlot.tsx` · `BetComposer.tsx` · `copy.ts` · `envelope.ts` · `ErrorStrip.tsx` · `gating.ts` · `idempotency.ts` · `image-attach.ts` · `ImageAttach.tsx` · `payload.ts` · `PositionStrip.tsx` · `quote-reader.ts` · `ReplySplitBar.tsx` · `requests.ts` · `sell-convert.ts` · `SellModule.tsx` · `split-bar.ts` · `state-map.ts`

> ### ⛔ **ANNEXED — CONTENDED WITH #341. NOT CLAIMABLE.**
> **`src/components/debate/composer/SlotHeader.tsx`**
>
> Doubly contended and the hottest file on the surface: **POLISH.5 PR B already edited it** (#333, `b7c2a38`) and **#341 will edit it again**. Verified this session — `git diff --name-only origin/main origin/htmlfinish/market-detail` intersects `.4`'s population at **exactly two paths**, this being one. **The allow-list is finalised at execute, after #341 lands.**

### Tests — **19 of 21** files

`tests/unit/composer/` — the 11 `.ts` suites (`envelope` · `gating` · `idempotency` · `image-attach` · `payload` · `quote-reader` · `requests` · `sell-convert` · `sell-request` · `split-bar` · `state-map`) + `render/_harness.tsx` + `render/error-strip.test.tsx` · `render/never-echo.test.tsx` · `render/preserved-inputs.test.tsx` · `render/protective-landing.test.tsx` — **16 of 17**.
`tests/integration/` — `composer-image` · `composer-place` · `composer-reply` · `composer-sell` — **4 of 4**.

> ### ⛔ **ANNEXED — CONTENDED WITH #341.**
> **`tests/unit/composer/render/suspended-modal.test.tsx`** — the second of the two intersecting paths.

### `docs/**` — named, and the plan is the authority for which (template §6, amended 2026-08-12)

`docs/plans/POLISH-4.md` (this file) · `docs/polish/POLISH-register.md` · `docs/polish/POLISH-TRACKER.md` · `docs/polish/POLISH-0.md` · `docs/parked.md` · `docs/logs/POLISH-4.md`

### ⚠ **PR B AND PR C SHARE PR A's ALLOW-LIST. There is not a second one.**

*(Amended at the fold.)* The three lists above — **18 of 19** source files, **19 of 21** test files, the six `docs/**` paths — are the allow-list for **all three PRs**. The fold splits the *work* into layout-and-behaviour and values; it does **not** widen the fence, and no parity row may widen it either. A parity row whose fix needs a nineteenth composer file, a twentieth test, or a seventh document is a **halt**, not an edit (§10, `H4`).

### ⛔ **BOTH ANNEXATIONS HOLD FOR BOTH LANES**

> **`SlotHeader.tsx`** and **`tests/unit/composer/render/suspended-modal.test.tsx`** are annexed for **PR B and PR C alike**. Annexation is a property of the *file*, not of the kind of change proposed against it — a values row and a layout row are equally forbidden there.
>
> **⚠ `#341` OWNS `SlotHeader.tsx`'s ARRANGEMENT, and this is now measured, not predicted.** `docs/plans/HTML-FINISH-MD.md` (committed on `origin/htmlfinish/market-detail`, md5 `079df6560c1d6fa668ee6eb97e3028f2`) puts `composer/SlotHeader.tsx` in its own §11 allow-list marked **⚠ CROSS-OWNER**, for rows **20** (`C24` — the entry trigger relabels) and **21** (`C25` — the held-side Sell affordance takes button shape). The same §11's EXPLICITLY-OUT block names `src/components/debate/composer/**` **EXCEPT `SlotHeader.tsx`** as *"POLISH.4 territory"*, and names `BetComposer.tsx` · `ReplySplitBar.tsx` · `PositionStrip.tsx` out by hand. **The two fences agree; nothing is contended except the one file both already annex.**
>
> **Re-measured at the amendment ground `8db535d`:** `git diff --name-only origin/main origin/htmlfinish/market-detail` returns **54 files** and intersects `.4`'s population at **exactly two paths** — `src/components/debate/composer/SlotHeader.tsx` and `tests/unit/composer/render/suspended-modal.test.tsx`. **Unchanged from the authoring measurement at `35da436`.** The allow-list is finalised at execute, after #341 lands.

### ⛔ `src/components/profile/PositionsTable.tsx` — READ-ONLY for **all three PRs**, and the fold makes it *more* load-bearing

`H-HOST` (§6) already fenced it as `SellModule`'s only mount and `.5`'s host. The fold raises the pressure on it rather than relieving it: **the sell slide's arrangement and behaviour are built in that file, not in `SellModule.tsx`** — the fixed 50px host, the `.26 s` fade and the JS toggle are all at `PositionsTable.tsx` (the `sell-host-*` band and its `animate-in fade-in … duration-[.26s]` wrapper), which the file's own docblock states in terms. See **`P4-F1`** (§15.3). ⇒ **A parity row against the sell slide's box, its timing or its non-reflow is a `.5` row that `.4` reports; it is never a `.4` edit.**

---

## §6 · ⛔ DENY-LIST — **BY DIRECTORY** (template §13.4)

Fenced by directory, never by mechanism, and stated **here in the durable document**, not only in a relay.

| # | Directory / path | Why |
|---|---|---|
| **D1** | `src/server/**` | Hard floor **F4**. `.4` is comment-adjacent — `bets`/`comments` request shapes — and `CLAUDE.md` §1 makes it critical path |
| **D2** | `src/db/schema/**` · `drizzle/migrations/**` | **H7** ⛔ |
| **D3** | `src/app/(admin)/admin/moderation/**` | Template §13.4's standing addition |
| **D4** | `src/components/shell/**` | `.1`'s — the four `shell/` micro-labels (§1.2) |
| **D5** | `src/components/debate/*.tsx` *(the directory ROOT, not `composer/`)* | `.3`'s — `DebateColumn`, `DebateView`, `MarketHeader`, `PostCard`, `ReplyCard`, `PriceBar`, `badges.tsx`, `format.ts`, `types.ts` |
| **D6** | `src/components/profile/**` · `src/components/bookmarks/**` · `src/components/discovery/**` | `.5` / `.6` / `.2` |
| **D7** | `src/app/globals.css` | Token **values** are CI-pinned — **F3** / **H8** ⛔ |
| **D8** | `docs/specs/**` · `docs/adr/**` | **H7** ⛔ |
| **D9** | `src/components/ui/**` | Shared primitives — **C2**: change by preset, never by consumer override, and no preset is proposed here |

> ### ⛔ **`H-HOST` — `src/components/profile/PositionsTable.tsx` is READ-ONLY.**
> It is `SellModule`'s **only** mount and `.5`'s host (§2.4). **Read it; do not edit it.** Covered by **D6** and restated because the file is the one place a `SellModule` change becomes visible, which is exactly the pressure that produces a "just this once" edit.

---

## §7 · ⛔ NO-EDIT SYMBOLS — by symbol, never by line (`O-8`)

| Symbol | File | Why |
|---|---|---|
| the split-bar **track** span and its **fill** child | `ReplySplitBar.tsx` | `RR-3`'s landed fix. `.4` records its adoption; **`.4` does not touch it.** Any edit here re-opens an attended, dual-reviewer commit |
| `TriggerPill` — the `pole` const | `ReplySplitBar.tsx` | `RR-3`'s positive control and the black-pill exception (values-log §1 item 8) |
| `STATE_BY_CODE` — the key set | `state-map.ts` | **SG-5** (`UI-A3.md`): the client consumes the `toWireError` inventory exactly as minted. **No new wire codes.** Pinned by `state-map.test.ts` against the real server formatter |
| `keyOutcomeFor` · `TRANSIENT_CODES` | `state-map.ts` | The ADR-0031 key lifecycle (F-1/F-2). Not cosmetic |
| `reduceKey` · `initialKeyState` | `idempotency.ts` | Same |
| `sellSharesFor` | `sell-convert.ts` | Exact-decimal conversion, capped ≤ quantity. **`CLAUDE.md` §2: never JS floats** |
| `computeSplitBar` · `displaySplitTotal` | `split-bar.ts` | DROUND R2 (SPEC.1 §10.8) **and** a proven cross-surface dependency — `.3` imports both read-only |
| `buildPlaceRequest` · `buildSellRequest` — their **body key sets** | `requests.ts` | §2.8: exhaustively asserted by set-equality |
| `SELL_HINT` | `SellModule.tsx` | Canon §6 verbatim |
| `STATE_COPY` · `SUSPENDED_COPY` · `C1_PROTECTIVE_LANDING` · `AUTH_GATE_COPY` — their **string values** | `copy.ts` | W2.11-kit / canon §6 **verbatim**, curly apostrophes preserved. **`CLAUDE.md` §3: CC never invents argument-adjacent copy** |
| `COMPOSER_COPY.header` · `COMPOSER_COPY.submit` | `copy.ts` | The `Đ BET` wordmark — canon §7 item 3, **app-wide** |

⚠ **`c2Strip` is the ONE exception** and only under `PD-4-05`'s ruling (§13, `OD-3`).

---

## §8 · `§13.2` · THE TEST CENSUS — filenames **FOUND**, never proposed

Template §13.2: for every item whose fix **changes behaviour**, the boundary names the existing tests that assert the current behaviour.

| # | Item | Tests that pin the current behaviour | Consequence |
|---|---|---|---|
| 1 | `PD-4-01` · `-02` · `-03` (record acts) | **none** — `docs/**` only | Doc-only. ⚠ Biome checks **zero** files on a markdown diff, so `just verify` green is **not** a receipt about this diff |
| 2 | `PD-4-04` micro-labels — `PositionStrip` | `tests/unit/composer/render/` suites via `_harness.tsx`; `tests/unit/shell/dharma-cluster.test.tsx` **names `PositionStrip.tsx:44,61` in a comment** | Comment-only reference — no assertion. ⚠ but see row 6 |
| 3 | `PD-4-04` — `BetComposer` | `never-echo` · `preserved-inputs` · `protective-landing` · `error-strip` | These assert **content and state**, not label typography. A tier change should be delta-free against them — **prove it, don't assert it** (§8.2) |
| 4 | `PD-4-04` — `AuthGateSlot` | **none found** under `tests/unit/composer/` | ⚠ **A behaviour change with no test defending it.** `@test-writer` mints the RED first (§5.6) |
| 5 | `PD-4-05` `c2Strip` removal | **none** — zero consumers, zero test references | ✅ The absence **is** the finding. A positive control is mandatory (`N1`/`N3`): assert `c2Sentence` **is** still consumed, or the removal proves nothing |
| 6 | `PD-4-04` / `PD-4-06` | `tests/unit/shell/dharma-cluster.test.tsx` — comments naming `SellModule.tsx:263,278` and `PositionStrip.tsx:44,61` | ⚠ **`H14` predicted at plan time** (§0.4). If the suite turns out to assert rather than comment, **stop — do not widen an allowlist to make it green** |
| 7 | Any `SellModule` prop-signature change | `tests/unit/profile/render/sell.test.tsx` — **mocks** `SellModule`, pinning the mount | **`.5`'s file, NOT in `.4`'s allow-list.** A signature change reddens a file `.4` may not edit ⇒ **`H4`** |
| 8 | Any wire-shape change | `requests.test.ts` · `sell-request.test.ts` · `image-attach.test.ts` | §2.8 — set-equality. **No such change is planned**; named so a widening cannot pass unnoticed |
| 9 | `rate_limited` (`PD-4-06`) | `idempotency.test.ts` · `state-map.test.ts` · `render/error-strip.test.tsx` | **Three files.** Disposition is *not-a-defect*, so nothing should move — these are the proof it did not |

### 8.1 · Zero-delta proof, per consumer (§8.2)

`PD-4-04` is the only row that can move a shared render. Its proof obligation:

- A **byte-identical** baseline captured from each of the four touched components **before** the change and pinned. *Byte-identical, not visually identical.*
- ⚠ **Re-count the consumer inventory at PR head, never at plan time** — template §8.2's own rule, minted from an inventory that went 9 → 13 inside one PR.
- **Per-pole**: assert **both** a YES and a NO instance (§9.1) — a YES-only test passes on an inverted NO panel.

### 8.2 · What `.4` inherits as its own `O-7` obligation

Every render assertion in this surface asserts on **`innerHTML`, never `textContent`** (`O-8`'s sibling, `O-7`). A micro-label tier lives entirely in the `class` attribute; `textContent` cannot see it and would pass on the shape the test was written to reject.

---

## §9 · COMMIT BOUNDARIES — ordered so **no commit lands red** (`H9`)

### PR A · THE RECORD

| # | Commit | Contents |
|---|---|---|
| **A0** | `docs(polish): POLISH.4 plan + the HTML-FINISH fold — ground 35da436, amended at 8db535d` | This file, **as amended at §15**, committed **before** Phase 1 ends (`CLAUDE.md` §5.1) and **before any other A-commit**. The plan and its fold land as one commit — a fold committed after the record acts it re-scopes would be a plan describing work already done |
| **A1** | `docs(polish): PD-4 register section — first mint` | `POLISH-register.md` — replace the em-dash placeholder with `PD-4-01` … `PD-4-11` |
| **A2** | `docs(polish): RR-3 adoption record; close three open assertions` | `PD-4-01` + `PD-4-02` — 2 register rows + tracker §3, both coordinates re-fenced by symbol |
| **A3** | `docs(polish): POLISH-0 §3 .4 row — components 11→19, path-qualify, re-fence Đ BET` | `PD-4-03` + **rider 1** (§11) |
| **A4** | `docs(polish): POLISH-0 §2.2 — declare the DESIGN_W2_10 close-out gap` | **rider 2** (§11) |
| **A5** | `docs(polish): route OQ-1, R11, and the values-log §1 item 4 boundary` | `PD-4-08` · `-09` · `-10` + their `docs/parked.md` rows |
| **A6** | `chore(polish): log session — POLISH.4 PR A` | `docs/logs/POLISH-4.md` (`CLAUDE.md` §5.9) |

⚠ **A5 lands `docs/parked.md` rows in the SAME commit as the routing** — template §12: *"a destination named in a committed document gets a `docs/parked.md` row in the same commit."*

### PR B · THE CODE — **gated, not scheduled**

Sequenced only once `OD-2`/`OD-3` land. Each row is its own commit, `@test-writer` RED first, and **the RED output is captured before any fix is written** (`H9`'s single exception).

⚠ **Before any `pnpm vitest run`: `pgrep -f 'node.*vitest'`** — a second runner truncates fixtures into a **false RED** (`H12`). `ps | grep` matches its own command string and is not the check.

---

## §10 · THE HALT SET

**Base set `H1`…`H17` inherited from template §5 unchanged** — not restated here, per the kickoff.

### Per-surface slot — `.4`'s own

| # | Halt |
|---|---|
| **`H-SLOT`** | ⛔ Any resolution that lands inside `SlotHeader.tsx` before #341 merges. Annexed, doubly contended. *(Carve-out §0.4: does not fire on this plan's own text.)* |
| **`H-SUSPENDED`** | ⛔ Any resolution inside `tests/unit/composer/render/suspended-modal.test.tsx`. Same ground, same carve-out. |
| **`H-HOST`** | ⛔ Any edit to `src/components/profile/PositionsTable.tsx`. Read-only boundary (§2.4). |
| **`H-OQ1`** | ⛔ Any item that renders **Đa** or a **P/L** figure. Rendering it before the SPEC.1 line lands is a **ratified defect** (`UI-A3.md`), not a judgment call. |
| **`H-WIRE`** | ⛔ Any new wire error code, or any change to `STATE_BY_CODE`'s key set. **SG-5** (`UI-A3.md` — qualify every `SG-3`/`SG-n` citation by its plan file). |
| **`H-ECHO`** | ⛔ Any change that lets the composer render, echo, quote or describe gate-blocked content, or that surfaces the Track-B carve-out distinction. **`SG-3` of `docs/plans/UI-A3.md`** — ⚠ **NOT** `SG-3` of `docs/plans/UI-A2.md`, which is a different rule about `loadDebateView`'s viewer-independence. Pinned by `render/never-echo.test.tsx`. |
| **`H-INV1`** | ⛔ Any path that lets a **buy** ship without a comment, or decouples the two. `CLAUDE.md` §3 refusal trigger — surface and stop. |
| **`H-INV3`** | ⛔ Any change letting a composer instance **switch side** after open. Side is minted at composer-open and immutable per instance; the side chip is toggle-to-close, **never a side switch**. |
| **`H-SHAPE`** | ⛔ Any change to a `buildPlaceRequest` / `buildSellRequest` / sign-route body key set (§2.8). |
| **`H-CROSS`** | ⛔ Any micro-label edit reaching `src/components/shell/**` or `debate/*.tsx`. Four `shell/` sites are `.1`'s; `MarketHeader`'s is `.3`'s. |
| **`H-CLASSIFIER`** | ⛔ Quoting any `MICRO-LABEL-TIER` or `rate_limited` count without first stating the predicate. |
| **`H-VALUE`** *(fold)* | ⛔ **Copying any colour, radius, px, type size, duration or easing out of a mockup.** The mockups are **light-mode pre-BRIDGE prototypes**; the shipped system is **dark true-neutral** (`DESIGN.B1`, closed at `docs/design/ZUGZWANG-BRAND_agenda-and-values-log_v0_3.md`, CI-guarded by `tests/unit/design/tokens-monochrome.test.ts`). The ramps are **inverted** — name-porting across them is the exact failure `side-pole-binding` exists to prevent. `.3` already states the rule on the adjacent surface: *"Fidelity means layout, anatomy, affordance set and flow — never colour values"* (`docs/plans/POLISH-3-PR-2.md`). **Every value that ships is byte-carried from shipped code or is a topology declaration.** |
| **`H-SYSTEM`** *(fold)* | ⛔ **THE DESIGN SYSTEM IS NOT TOUCHED BY THE PARITY LANE — no token, no preset, no ramp change.** `globals.css` is already **D7**; this halt extends the same floor to `src/components/ui/**` presets (**D9**/**C2**) and to every `@theme` slot. ⚠ **The one preset the fold DOES authorise is `OD-2`'s named micro-label preset — and it is authorised because it defaults byte-identical to today's render (§8.1), which is a change of *addressability*, not of the system.** If `tokens-monochrome.test.ts` reddens, a value was taken: **halt the row.** |
| **`H-CASCADE`** *(fold)* | ⛔ **Any parity row touching `BetComposer.tsx` or `SellModule.tsx` opens the full reviewer cascade** — `@test-writer` first, then `@code-reviewer`, then `@security-auditor`, **sequentially** — and `H-INV1` fires on it. ⚠ **Discovery's `P-8` carve-out does NOT extend to this surface.** That surface carried no invariant obligations; this one carries `INV-1` in the buy path and `CLAUDE.md` §1 critical-path status through `bets`/`comments` request shapes. ⚠ **`P-8` is named by the founder's ruling and is NOT on `main`** — it lives in the HTML-FINISH · DISCOVERY dispatch, off-repo. It is cited here to be **excluded**, never to be applied; nothing in `.4` may be justified by it. |

### ⛔ THE PARITY LANE'S SCOPE — stated here, in the halt set, because it is a fence

*(Fold, ratified 2026-08-16.)*

**IN — layout AND behaviour, both.** A parity row may be about **what moves, what opens, what closes, what reflows**, not only about where a box sits. The family demonstrates this on every prior surface: Profile's row selection and arrow stepping (`R4` item 5), Bookmarks' `C5` selection mechanism, `#341`'s rows 8 · 17 · 23 · 24 · 27 · 35 · 36 (labels open a composer; the market card *is* the exit; the title enters post-focus; scroll resets). **The two named instances on THIS surface are the sell slide and the composer's opposite-slot open.**

**⛔ OUT — motion VALUES.** `design-canon.md` **§5** fixes them and the parity lane **cites canon; it never re-derives a motion value from a mockup.** Read at the amendment ground:

| Instance | What canon §5 fixes | What it does **not** |
|---|---|---|
| **Sell slide** | the **fixed 50 px** host reserved under each sellable positions row · the **`.26 s`** fade · *"fixed height ⇒ never reflows"* | ⚠ **The DISTANCE is STRUCK, not fixed** — the entry's `translateY(110%)` exit was struck by the founder ruling of 2026-08-15, written into §5 in place (`O-5`) because there is no replica footer to slide away. **Do not restore a distance canon removed.** |
| **Composer opposite-slot open** | the opposite slot (canon **§3 item 3**, the invariant spine) · content slides **`translateX ±36 px` + fade** (canon §5, *Reply — reply carousel*) | — |

⚠ **Neither instance has an EASING value at canon §5.** Measured, not assumed. ⇒ A row that needs an easing curve cannot get one from canon and must not take one from a mockup: it is **`H-VALUE`**, reported whole and built not at all. *(`P4-F2`, §15.3.)*

⚠ **And both instances' arrangement is DECLARED outside `.4`'s allow-list** — see `P4-F1`. Naming them as in-scope does **not** make their implementation sites claimable.

### ⛔ Two identifier rules — `CLAUDE.md` §8

- **`.4`'s Gate C must NOT issue a bare `L-n`.** Two unrelated `L-n` sets are simultaneously citable — `POLISH-register-ADDITIONS.md` §A's `L-2`…`L-9`, and `docs/logs/POLISH-7a.md`'s `L-6`. Task-scoped LOWs carry their task name: **`POLISH-4 L-1`**, never `L-1`.
- **`.4`'s Gate C findings are cited `POLISH-4-GC-n`.** The bare `GC-n` form is in simultaneous use across five registers with at least three distinct `GC-1`s. *"A Gate C finding is cited as `<PR>-GC-n` or it is not cited."*

---

## §11 · SAME-COMMIT RIDERS

Both land **in the same commit as the change they accompany** (`CLAUDE.md` §5.12; `O-5` — the correction is written INTO the operative section, never appended as a block).

### Rider 1 — `POLISH-0.md` §3, the `.4` **Components** cell → commit **A3**

**Replaces this unit in full** (template §13.5 — quote the whole unit, never the phrase):

```
| **Components** | `BetComposer` · `SlotHeader` · `PositionStrip` · `ReplySplitBar` · `SellModule` · `copy.ts` · `payload.ts` · `requests.ts` · `ImageAttach` · `ErrorStrip` · `AuthGateSlot` |
```

**With a cell that:** enumerates all **19** files under `src/components/debate/composer/`; **path-qualifies `copy.ts` to `debate/composer/copy.ts`** (it resolves to two tracked paths — `profile/copy.ts` is the other); records that the previous cell named 11 and **systematically omitted the eight `.ts` behaviour modules**, three of which hold live `.4` work; and notes `SlotHeader.tsx` as #341-contended.

### Rider 2 — `POLISH-0.md` §2.2, the declared gap → commit **A4**

**Adds one line** to *"§2.2 · Known-stale baselines"*, declaring:

> **`DESIGN_W2_10_sell-and-clamp_mockup-v0_1.html` has no close-out.** It is the sole `DESIGN_W2_*` mockup without one, and the sole tier-4 baseline for the sell module — whose tier-2 row leans on rulings a close-out normally ratifies (*"sell is never clamped; cap clamp buy-only"*). The mockup's own panel E is captioned *"authored after sign-off."*

⛔ **A DECLARED GAP, NOT AN INVESTIGATION.** One line. `.4` does not author the missing close-out, does not reconstruct it, and does not treat panel E as ratified. **CC never authors web-owned design ratification text.**

### ⚠ Rider 3 — conditional, `O-9`

**`O-9`:** editing prose that cites a governing document by `§` number, in a way that changes what the citation asserts, is itself a same-commit-rider trigger.

Riders 1 and 2 both edit prose inside `POLISH-0.md` that cites tier-1 and tier-4 sources. ⇒ **At execute, before saving either: re-read the cited section at then-HEAD.** #341 carries pending edits to `SPEC.1.md`, `CLAUDE.md` **and** `AGENTS.md` — verified this session. **If #341 has merged, `.4`'s tier-1 citations (`INV-1`/`2`/`3`, §10.8, `F-BET-9`) must be re-read before they are cited.** *The tell is cheap: if the prose contains a `§`, go read that document at HEAD before you save.*

---

## §12 · THE DELTA-RECON RELAY — **`OD-1` RULED: RUN IT.** Commissions **BOTH** row sets

Per template §3, filled for this surface. ✅ **`OD-1` is ratified — the recon runs.** *(Amended at the fold: the relay as drafted commissioned one row set. It now commissions two, and says which in its task line.)*

⚠ **THIS IS THE DURABLE COPY OF AN INSTRUCTION ALREADY IN FLIGHT.** A second session is running this recon **in parallel, from the same instruction**. This block and that instruction are required to **agree**. ⛔ **On any divergence between them, the recon REPORTS the divergence and does not silently reconcile it** — a relay that quietly conforms to whichever copy it holds destroys the only evidence that two copies existed. Report; do not choose.

⚠ **The task line below executes this plan's own §14 lesson**, minted before the fold and now spent: *"A scoping recon reads as a delta recon … the next surface's relay must state which of the two it is commissioning, in the task line, before the setup block."* `.4` is the next surface, and the lesson is applied to `.4`'s own relay.

```
TASK: POLISH-4 · DELTA RECON — ⚠ THIS COMMISSIONS **TWO** ROW SETS, NOT ONE:
  (A) the POLISH-SURFACE-TEMPLATE §3 tier-4 COMPOSITION delta, and
  (B) the HTML-FINISH PARITY row set for this surface — LAYOUT AND BEHAVIOUR.
  A VALUES section is reference data only and carries NO rows (§3 below).
⛔ This is a DELTA recon, not a scoping recon. A scoping recon already exists
  (~/Downloads/POLISH-4-RECON.md) and is NOT this. If what you produce answers
  "what is the carry-in / what is contended / what are the ceilings", you have
  written the wrong document.
Read-only. No writes, no branch, no PR, no src/, no spec or ADR edit.

SETUP
- Own detached worktree off origin/main. Fetch first; report the tip SHA.
- git status --porcelain empty at start AND end.
- No build, no DB, no Doppler, no credentialed command.
- PIN EVERY MOCKUP BEFORE READING IT — md5 + line count, re-measured, and HALT
  on any mismatch. At origin/main = 8db535d they are:
    DESIGN_W2_8_entry_mockup-v0_1.html            15e6dd5c70c0db539e63ef553a6ec5cd   213
    DESIGN_W2_10_sell-and-clamp_mockup-v0_1.html  4c3c27aa8db2aff81f293359c7b95b22   548
    surface_d5_v1_0.html                          34619dacee472a245cb6e8678b509219  1929
    surface_profile_v1_0.html                     17053af72a88665895a16c439b6bcc3f   777

═══ 0 · VERIFY BEFORE READING (POLISH-SURFACE-TEMPLATE §2)
POLISH-0.md §3's .4 row — TRUE / FALSE / UNVERIFIABLE with file:line or a SHA
for EVERY gate, absence claim, named tier-1/2/3/4 source, and component.
⚠ Rows PD-4-03 (the Đ BET coordinate) and the Components cell 11→19 are ALREADY
MEASURED FALSE by docs/plans/POLISH-4.md §2.2–2.3 — confirm, do not re-derive.

═══ 1 · READ IN THIS ORDER (POLISH-0.md §8 — do not reorder)
1. TIER 1 — SPEC.1 INV-1 / INV-2 / INV-3 · §10.8 (DROUND) · F-BET-9 ·
   ADR-0013 · ADR-0014 · ADR-0015 · ADR-0031. PATCH RECORDS FIRST.
   ⚠ Re-read at then-HEAD if #341 has merged (O-9).
2. TIER 2 — design-canon §4 rulings 2+3 · §7 items 2 and 3 ·
   values-log §1 item 4.
3. TIER 3 (BUILD-LAW, do not skip) — docs/plans/UI-A2.md AND docs/plans/UI-A3.md.
   ⛔ BOTH CARRY AN SG-3 AND THEY ARE DIFFERENT SG-3s. Qualify EVERY citation
   with its plan file. UI-A2's is the viewer-independent masking gate
   (superseded as encoding by ADR-0034 D-5); UI-A3's is the composer
   never-echo + moderation-safety rule.
4. TIER 4 — DESIGN_W2_8_entry_mockup-v0_1.html (close-out EXISTS) ·
   DESIGN_W2_10_sell-and-clamp_mockup-v0_1.html (⛔ NO CLOSE-OUT EXISTS —
   POLISH-4.md §2.5; do not treat its panel E as ratified) ·
   the composer modules in surface_d5_v1_0.html ·
   DESIGN_W2_11_state-kit_mockup-v0_1.html + its CLOSE-OUT (the composer STATE
   surface — behaviour, so it is in scope for row set B) ·
   surface_profile_v1_0.html ⚠ READ-ONLY CONTEXT: it is the sell module's HOST
   mockup and the host is .5's. Read it to know the module's context; report
   NOTHING about the host's own chrome.
5. POLISH-0.md §2.1, §3's pre-recorded rows, §0 — and POLISH-4.md §1 and §3,
   which are the measured carry-in. DO NOT RE-DERIVE THEM.

═══ 2 · SCOPE
Components: the 19 files of src/components/debate/composer/ — MINUS
  SlotHeader.tsx (annexed, #341-contended).
Routes: /m/[slug] (composers) · /u/[pseudonym] (sell module).
⛔ src/components/profile/PositionsTable.tsx is READ-ONLY — read it as
  SellModule's host, report nothing about its own chrome (.5's).
Everything else is out of scope.

═══ 3 · THE TASK — TWO TABLES AND ONE REFERENCE SECTION

── TABLE A · the template §3 COMPOSITION delta ──
One row per difference between the tier-4 mockups and the built components:

  | # | What differs | mockup:line | file:line | class | baseline | owner | disposition | halt? |

- id is P4-D<nn>. Never a bare Vn. Register IDs PD-4-01…11 are ALLOCATED.
- class is exactly one of V / F / B / S / R — POLISH-0.md §5.
- BASELINE is a MANDATORY COLUMN: tier + document + section that licenses or
  contradicts the row. If you cannot name it, the row is class S.
  ⚠ This column is the HTML-FINISH family's most expensive lesson. Discovery's
  Gate C finding G-1 cost a SPEC.1 amendment on a live branch because its recon
  table had "mockup:line" and "build file:line" and NO baseline column — so a
  row deleting an element that SPEC.1 §22 and design-language §3.2 both NAMED
  passed recon, ratification, plan and execute untouched. One grep at recon
  would have killed it. Fill this column or do not file the row.
- halt? — name the condition from POLISH-4.md §10, or "no".
- ⚠ §13.2: for EVERY delta whose fix changes behaviour, grep the suite for a
  test pinning the CURRENT behaviour and report it ON THE ROW. A delta with a
  green test defending it is a different, more expensive object.

── TABLE B · the HTML-FINISH PARITY row set — LAYOUT **AND** BEHAVIOUR ──
Same schema, id P4-P<nn>. A row may be about arrangement (element type,
nesting, sibling order, grouping, control shape, presence/absence) OR about
behaviour (what moves, what opens, what closes, what reflows).
- ⛔ NO ROW IN EITHER TABLE NAMES A COLOUR, A PIXEL, A RADIUS, A TYPE SIZE, A
  DURATION OR AN EASING. Those are the shipped design system's, not the
  mockup's (POLISH-4.md §10, H-VALUE / H-SYSTEM).
- ⛔ MOTION VALUES ARE CANON'S, NOT YOURS TO FILE. design-canon.md §5 fixes the
  sell slide's 50px box and .26s fade, and the composer slide's translateX
  ±36px + fade. CITE canon. Never re-derive one from a mockup, and never
  restore the sell slide's translateY(110%) — canon STRUCK it (§10).
- The two named behaviour instances on this surface are THE SELL SLIDE and THE
  COMPOSER'S OPPOSITE-SLOT OPEN. ⚠ Both are DECLARED outside .4's allow-list
  (POLISH-4.md §15.3 P4-F1) — file them with the owner named; do not drop them.

── SECTION C · VALUES — REFERENCE DATA ONLY, ZERO ROWS ──
Declarations side by side, mockup vs build, for the founder's eye pass. No
judgement, no proposed value, no row id, no disposition. This is the shape
HTML-FINISH · DISCOVERY's delta used (its §4 "PROPORTION — reference data
only"), and it is what keeps a value out of a row table.
⛔ Report token USAGE, never token VALUES — CI-pinned.

═══ 4 · HARD RULES
- FACTS with file:line on BOTH sides. Where judgment is needed, quote both
  and STOP.
- Tier 4 is the LOWEST AUTHORITY above the export bundle, not the least
  accurate. Where tiers 1-3 contradict it, say so. ⚠ Two known instances
  ALREADY MEASURED: the P/L readout (tier-3 OQ-1 governs, build is CORRECT)
  and the engaged-slot backlight (implements on .3's files only).
- Report token USAGE. Never token VALUES — CI-pinned.
- ⛔ STATE YOUR CLASSIFIER before quoting any count.
- A directory-scoped negative is NOT a tree-wide one (O-2).
- UNVERIFIABLE + why, never a guess.
- Where the framing in this relay is wrong, SAY SO.
- ⛔ AN ARRANGEMENT ROW'S OWNER IS THE FILE THAT **DECLARES** THE ARRANGEMENT,
  NOT THE FILE THAT IS ARRANGED. Name the owner on every row. A row whose lever
  sits outside .4's allow-list is REPORTED WITH ITS OWNER, never dropped and
  never quietly re-pointed at a file .4 can reach. Two are already measured:
  the sell slide is declared in profile/PositionsTable.tsx (.5's, H-HOST) and
  the composer's opposite-slot open in debate/DebateView.tsx + DebateColumn.tsx
  (.3's, D5). Expect more.
- ⛔ A ROUTED ITEM INHERITS ITS LOCATION, NOT ITS DEFECT CLASS. Before filing a
  row because a document says the defect is here, verify the class REPRODUCES
  here. PD-4-06 is the measured instance: eight correctly-located rate_limited
  sites carrying a defect class that provably does not reproduce.
- ⚠ THE MOCKUPS ARE LIGHT-MODE PRE-BRIDGE PROTOTYPES; the shipped system is
  dark true-neutral (DESIGN.B1). The ramps are INVERTED. Name-porting a ramp
  token across them is the exact failure side-pole-binding exists to prevent.

═══ 5 · NOT DOING
No fixes. No branch. No PR. No src/ change. No spec or ADR edit.
Do NOT construct anything that is missing — including the DESIGN_W2_10
close-out. Classify it and move on.

═══ 6 · OUTPUT
Write the WHOLE answer to ~/Downloads/POLISH-4-DELTA-RECON.md.
⚠ Report in chat ONLY: file path, md5, line count, section IDs present,
TABLE A row count, TABLE B row count, whether SECTION C carries zero rows,
worktree clean. NOTHING ELSE.
```

---

## §13 · OPEN DECISIONS — web-ruled, relayed. **`.4` does not self-rule these.**

| # | Decision | Why it cannot be taken here | Recommendation |
|---|---|---|---|
| **`OD-1`** | **Does `.4` run a delta recon before PR B, or does `.4` close as a record-reconciliation surface?** | §2.1 — the template's own shape requires a recon `.4` has never had. Ratification is default-ON (template §7) and nothing is edited before it | **Run it.** PR A lands first regardless; the relay is drafted at §12. Closing `.4` without a delta pass would be the only surface to skip the step, on the one surface marked `full ritual` |
| **`OD-2`** | **`PD-4-04` — what tier do the eight composer micro-labels normalise to, and does `.1`'s four-site half move with them?** | Three tiers live in `composer/` and `.3` has minted a fourth. Template §4.2 **C1** forbids a V batch spanning surfaces, so `.4` **cannot** discharge the docket row whole. **C2**: a shared primitive changes by preset, and every preset defaults to today's render | Mint a **named preset**, defaulted byte-identical (§8.2), and route `.1`'s four to a `.1` row. ⚠ **Do not adopt `.3`'s tier by default** — its stated precedent does not resolve (§1.2) |
| **`OD-3`** | **`PD-4-05` — is `c2Strip` removed, or re-pointed to a consumer?** | `PD-5-07` records *"re-pointing rather than removing was the correct §5.3 surgical call"* — but names no consumer, and none exists. `CLAUDE.md` §5.3: leave pre-existing dead code unless asked. **`.4` is being asked** | **Remove**, with a positive control asserting `c2Sentence` is still consumed (§8, row 5). If `c2Strip` encodes ratified copy meant for a not-yet-built surface, that is a reason to keep it and **must be stated** — it is not inferable from the source |
| **`OD-4`** | **`PD-4-08` — who owns adding `OQ-1` to `POLISH-0.md` §0's ruling index?** | A live founder-pending hold on three `.4` components is absent from the index that claims *"zero OPEN … Nothing in this index stops work."* Amending the index is a method-document act | Add it as `R20`, **state-`OPEN`**, naming what it blocks. `.4` files the row; the founder mints the number |

⚠ **Per the relay model, none of these is asked in-session.** They surface here and flow web → operator → CC.

---

## §14 · CLOSING RITUAL

*"Should `CLAUDE.md` / `AGENTS.md` / the workflow / the tracker change as a result of this session?"*

**Provisionally yes, on two counts — both to be confirmed at the `.4` close-out, neither authored here:**

1. **`POLISH-TRACKER.md` §1 is stale on `.3`, `.5` and `.6`,** and the entire **HTML-FINISH stratum is invisible to it** (four PRs, six session logs, zero tracker mentions). A `.4` session planning off §1 alone would not know a parallel mockup-parity stratum is mid-flight on its own host surfaces. ⚠ **The tracker is operator-maintained and lives in web project knowledge — `.4` does not commit a tracker file.** Raised, not fixed.
2. **A candidate `O-10`**, if the founder agrees the shape recurs: *a routed item inherits its **location**, not its **defect class** — re-verify that the class reproduces on the receiving surface before treating the routing as a work order.* Minted from `PD-4-06`, where eight correctly-located `rate_limited` sites carry a defect class (*raw codes render to users*) that provably does not reproduce: no composer code path renders a code, only compares one. **Not numbered here** — `O-space` mints belong to the founder's ruling, and `.4` has one instance, not the three that made `O-8` a rule.

**Two more, added at the fold — both records, neither authored as a fix here:**

3. **⚠ `.4` IS THE FIRST TASK SPANNING BOTH STRATA.** Every prior surface belonged to exactly one: `.1` · `.2` · `.3` · `.5` · `.6` · `.7a` · `.8` ran as POLISH machine passes; DISCOVERY (#334) · PROFILE (#337) · BOOKMARKS (#338) · MARKET DETAIL (#341) ran as HTML-FINISH parity passes. **`.4` now carries a POLISH register lane and an HTML-FINISH parity lane over one file set, under one plan, in one PR sequence.** That is what the fold is, and it is the reason §4 is three PRs rather than two. ⚠ **Nothing in either stratum's method document contemplates a surface that is in both** — `POLISH-0.md` §6's `full ritual` marking and the HTML-FINISH family's row-and-halt shape were each written for a single-stratum run. They do not conflict here, and this plan does not merge them; it runs them as two lanes over one fence (§5). **If they turn out to conflict at execute, that is a class-S row against the method documents, not a judgment call.**

4. **⚠ `POLISH-TRACKER.md` HAS ZERO HTML-FINISH MENTIONS — measured at `8db535d`, not recalled.** `grep -c -i 'html-finish' docs/polish/POLISH-TRACKER.md` returns **`0`**. The tracker's §1 status map still reads `.4 Composers | ❌ | ❌ | CLEAR | full ritual | ▶ after .3. Co-owns RR-3` — a cell describing a single-stratum surface waiting on `.3`, while four HTML-FINISH PRs, six session logs and one open draft have landed or are in flight across `.2`, `.5`, `.6` and `.3`'s own host surfaces. **A session planning `.4` off §1 alone would not know a parallel mockup-parity stratum exists, let alone that it now runs inside `.4`.** ⚠ This file is `docs/polish/POLISH-TRACKER.md` — **in-repo and in `.4`'s allow-list** (§5) — and is a different object from the operator-maintained external `tracker_v20`, which `.4` never commits. **Raised, not fixed: the tracker is web-authored / operator-ratified (its own header says so), so `.4` files the drift and does not author the correction.** ⇒ This is the concrete content of the closing ritual's answer, and it is the one item here with a named destination.

⚠ **Lesson for the next relay — what the machine read missed** (template §12, mandatory):

> **A scoping recon reads as a delta recon.** `POLISH-4-RECON.md` is thorough, correct, and answers a different question than the one the machine phase needs. It was accepted as "the recon" by a kickoff, a plan session, and would have been by an execute session — because it is *named* like one and *formatted* like one. **The next surface's relay must state which of the two it is commissioning, in the task line, before the setup block.**

✅ **SPENT, on this plan's own relay.** §12's task line now states which of the two it commissions, before the setup block. The lesson was minted here and applied here; it does not travel forward as an open item.

---

## §15 · THE FOLD — the record of the amendment, not its delivery

*(`O-5`: the corrections are written into §4, §5, §10, §12 and §14. This section records that they were made, carries the ratifications, and holds the material that has no prior operative home.)*

### 15.1 · RATIFIED, 2026-08-16 — §13's four, as ruled

⛔ **§13's table is left exactly as authored.** It is the record of what was *asked*; this is the record of what was *answered*. Neither replaces the other.

| # | Ruling | What it obliges |
|---|---|---|
| **`OD-1`** | ✅ **RUN the delta recon.** | §12 is live and commissions **both** row sets. PR A still lands first (§4) — the recon reads the register the record act repairs. |
| **`OD-2`** | ✅ **Mint a NAMED PRESET, defaulted byte-identical to today's render.** `POLISH.1`'s four `shell/` sites stay **OUT** and get their **own row**. ⛔ **Do NOT adopt `.3`'s tier** — its stated precedent does not resolve. | The preset is `PR C`'s. **Byte-identical default** is the whole of `§8.1`'s zero-delta obligation and is what keeps `OD-2` inside `H-SYSTEM` — a change of *addressability*, not of the system. The `.1` row is **routed, not built** (`C1` forbids a V batch spanning surfaces, §1.2), so the `MICRO-LABEL-TIER` docket row is **still not discharged whole by `.4`** and must not be marked so. ⚠ The ⛔ on `.3`'s tier is this plan's own §1.2 sub-finding ratified: `.3`'s ruling cites *"precedent `composer/SlotHeader.tsx`"* and `SlotHeader.tsx` **carries no uppercase micro-label at head**. Adopting it would have made `.4`'s eight a **fifth** value, not a convergence. |
| **`OD-3`** | ✅ **REMOVE `c2Strip`**, with the positive control §8 row 5 already names. | `PR B` (a source-shape removal; no value moves). ⛔ The positive control is **mandatory, not optional** (`N1`/`N3`): the removal must be accompanied by an assertion that its sibling **`c2Sentence` IS still consumed**, or the removal proves nothing. This is the one authorised exception to §7's no-edit table, and it is authorised for **`c2Strip` alone**. |
| **`OD-4`** | ✅ **File `OQ-1` as `R20`, state `OPEN`, naming what it blocks.** The founder mints the number; `.4` files the row. | Commit **A5**. `R19` is the live ceiling (`POLISH-0.md` §0, re-read at `8db535d`), so `R20` is next free and the number is the founder's, as given. ⚠ **Filing it falsifies §0's own closing tally in the same commit** — see **`P4-F5`**. |

### 15.2 · THE FAMILY'S RULE — derived from **all four** passes, not from any one close-out

⚠ **This is the amendment's method section, and it was built the way the founder required: by reading Discovery (#334), Profile (#337), Bookmarks (#338) and Market Detail (#341, open draft) — their plans, their session logs and their diffs — before a word of it was written.** Deriving it from a single close-out is the failure that produced the fold; each pass below contributes a clause no other pass states as sharply.

1. **A parity row is an ARRANGEMENT or a BEHAVIOUR; it is never a VALUE.** *(Discovery's delta recon states the predicate in terms — "every row is a *composition* delta: element type, nesting, sibling order, grouping, control shape, presence/absence. No row names a colour, a pixel or a font size" — and puts every value into a separate `PROPORTION` section marked "reference data only … no judgement, no proposed value.")* ⇒ §12 table B + section C.
2. **Every row names its BASELINE — tier + document — and the executor re-quotes it at HEAD before implementing.** *(Discovery's own sealed assessment names this as the single dispatch change that would have made its Gate C blocker `G-1` structurally impossible; the register's schema already required it and the recon table had shipped without the column.)* ⇒ §12 table A's mandatory column.
3. **Every value that ships is BYTE-CARRIED from shipped code, and glyphs are hexdumped on both sides.** *(All four. Discovery took the separator's `text-n3` from `StatLine.tsx`, explicitly **not** from the mockup's `.vsep{color:var(--n3)}`. Profile R5 derived `256` by sweeping 1024→2560 rather than taking the mockup's fixed `188`. Bookmarks byte-carried every class from Profile's implementation and refused the mockup's `var(--ink)`/`var(--n1)` outright. #341 §1: "⛔ THE ONE RULE THAT SURVIVES IS HELD ABSOLUTELY.")* ⇒ `H-VALUE`.
4. **Resolved geometry is proven in a BROWSER against the real compiled CSS — jsdom performs no layout.** *(Every pass records the split; every pass records "rows with no test: the resolved geometry." Two harness facts are load-bearing and cost each pass time to rediscover: `resize_window` moves the OS window and leaves `innerWidth` alone, so a layout viewport must be pinned by a fixed-width same-origin iframe; and the `(public)` Suspense boundary never swaps its fallback under automation, so a reading taken before the measured node has a box is a reading of the loading state.)*
5. **A red guard is a finding about the CHANGE — fix the code, never the guard.** *(Profile R4's `side-badge` census went red on a duplicated primitive call site; the fix was to extract `RemovedHead`/`PresentHead`, and the guard was never touched.)* ⚠ **But a census re-point or a `now`/`movedBy` entry is the guard's OWN documented mechanism and is not a weakening** *(Discovery's ladder-census re-point, kept at `count: 0` so the assertion was restored rather than retired; Bookmarks R1 refusing `C1` on the `page-container.test.ts` site-2 pin and writing out the authorising edit instead of dodging it)*. **The line between the two is whether the guard documents the mechanism you are using.**
6. **⛔ NO PARTIAL SHIPS.** A row lands whole or is reported whole. *(#341 §12.)* And **a refusal with numbers beats a shipped guess** *(Profile R4 refused items 3 and 4 with a measured table; R5 refused item C with a six-viewport sweep and three founder options — all three refusals were later vindicated by the structural fix landing elsewhere).*
7. **⚠ THE LEVER IS ROUTINELY INSIDE A FILE THE FENCE FORBIDS.** *(Profile R4: both blocked items traced to `ProfileGraphCard`'s `aspect-[2/1]`, out of bounds. Bookmarks R1: `C1` and the chain's first link both needed one JSX tag pinned by a guard outside the allow-list. #341: row 16 halts if it needs `ReplySplitBar.tsx`.)* **This is not an occasional accident; it is the family's most common halt.** Generalised as **`P4-F1`** below, and it is why §12 requires an `owner` on every row.

### 15.3 · NEW MEASUREMENTS TAKEN AT THE AMENDMENT — `P4-F1` … `P4-F5`

⚠ **Prefix chosen deliberately.** A bare `F-n` is already in simultaneous use — `#341`'s plan carries `F-1`…`F-7`, and SPEC.1 carries `F-BET-9` / `F-DEBATE-1`. Per `CLAUDE.md` §8 these are **task-scoped and carry their task**: **`P4-F<n>`**, matching the relay's own `P4-D<nn>` / `P4-P<nn>` forms. ⛔ **No `PD-4` id is minted** — §3's range stays `PD-4-01` … `PD-4-11` and §A's leg stays true.

---

**`P4-F1` · ⛔⛔ AN ARRANGEMENT ROW'S OWNER IS THE FILE THAT *DECLARES* THE ARRANGEMENT, NOT THE FILE THAT IS ARRANGED — AND BOTH NAMED INSTANCES DECLARE OUTSIDE `.4`.**

Measured at `8db535d`, by symbol (`O-8`):

| Named instance | Where it is DECLARED | Whose |
|---|---|---|
| **The sell slide** | `src/components/profile/PositionsTable.tsx` — the `sell-host-*` band (`h-[50px]`), its `animate-in fade-in slide-in-from-top-2 duration-[.26s]` wrapper, and the JS toggle. The file's own docblock says so: *"⇒ BUILT HERE: the fixed 50px box, the .26s fade, the JS toggle."* | **`.5`'s** — `H-HOST`, `D6`. **READ-ONLY.** |
| **The composer's opposite-slot open** | `src/components/debate/DebateView.tsx` — the `opposite()` helper, the open-side guard, `composerColumn`, and the two `engaged` props — plus `src/components/debate/DebateColumn.tsx`'s `engaged` glow branch. | **`.3`'s** — `D5`. |

**`SellModule.tsx` carries no transition of its own; `BetComposer.tsx` does not choose its slot.** `.4` owns the *contents* rendered into a slot someone else picks, and the *module* dropped into a host someone else reserves.

⇒ **This is `PD-4-10` generalised.** §2.9 found one tier-2 item (`values-log` §1 item 4, the engaged-slot backlight) that `.4` cites and cannot execute. The fold makes clear that was not a one-off: **it is the shape of this surface.** The composer is a *guest* on two hosts, and arrangement is a property of hosts. ⛔ **Naming an instance as in-scope for the parity lane does NOT make its implementation site claimable** — §10 says so, and §12 requires the recon to file such rows **with the owner named**, never dropped and never re-pointed at a file `.4` can reach.

---

**`P4-F2` · ⚠ CANON §5 FIXES LESS THAN THE FOLD ASSUMED — the sell slide's DISTANCE is STRUCK, and neither instance has an EASING.**

Read at `docs/design/design-canon.md` §5 at the amendment ground. Reported precisely rather than restated, because the difference decides whether a row halts:

- ✅ **Fixed and citable:** the sell slide's **fixed 50 px** host and **`.26 s`** fade, with *"fixed height ⇒ never reflows"*; the composer slide's **opposite slot** (canon §3 item 3, the invariant spine) and its **`translateX ±36 px` + fade**.
- ⛔ **STRUCK, not fixed:** the sell slide's **distance**. §5's entry once read *"the footer slides down (`translateY 110%` + fade)"*; the founder ruling of **2026-08-15, at HTML-FINISH · PROFILE**, struck it — written into §5 **in place**, for the same `O-5` reason this amendment is written into §4/§5/§10/§12/§14 — because with the list reading there is no replica footer to slide away. **A row restoring a distance canon removed is not parity; it is a regression with a citation.**
- ⛔ **Not stated at all:** an **easing** curve, for either instance. ⇒ *"Cite canon; never re-derive it from a mockup"* leaves easing with **no** authority. A row needing one cannot get it from canon and must not take it from a mockup: it is **`H-VALUE`**, reported whole and built not at all.

---

**`P4-F3` · ⚠ THE `Đ BET` CROSS-OWNER DELTA IS CANON-*ANTICIPATED*. §7's no-edit row STANDS, and `.4` must not inherit it as a work order.**

`#341` relabels `SlotHeader.tsx`'s entry trigger `Đ BET` → `Buy` (row 20 / `C24`), and its PR body reports the consequence as a finding: *"the colhead reads `Buy` and opens a composer that does not,"* with `composer/copy.ts` allow-list-excluded on that side.

**Measured at head, on both sides:** `copy.ts` holds `header: "Place your Đ BET"` and `submit: "PLACE Đ BET"`; `SlotHeader.tsx` holds the entry `Đ BET` at its button and its `aria-label`. Canon §3 item 5 states the chain as *"entry button `Đ BET` → header `Place your Đ BET` → submit `PLACE Đ BET`"* — **but canon §7 item 3 reads: *"**"Đ BET" wordmark** (operator, DESIGN.5 v1.12) — **app-wide, plus the W2.8 entry relabel**."***

⇒ **The entry relabel is canon-recorded, and the `app-wide` half is what `.4`'s two strings are.** After #341 lands, `COMPOSER_COPY.header` / `.submit` staying `Đ BET` is **canon-correct, not a residue**. §7's no-edit row on those two symbols **stands unamended**, and `.4` files no row against them.

⚠ **This is the second instance of §14's `O-10` candidate** — *a routed item inherits its **location**, not its **defect class*** — reported from a different direction than `PD-4-06`'s: there, a routing carried a class that did not reproduce; here, a **neighbouring PR's own finding** would have arrived as one. **Two instances, not three.** ⛔ Still **not numbered** — `O-space` mints belong to the founder's ruling, and `.4` does not self-mint one.

---

**`P4-F4` · `.4`'s tier-4 set is FOUR mockups plus one state kit — and the close-out gap is confined to `W2_10`.**

Pinned in §12's SETUP (md5 + line count, re-measured at `8db535d`, HALT on mismatch — the family's rule, from Discovery §0.2 and #341 §0). Of the five:

- `DESIGN_W2_8_entry_mockup-v0_1.html` — **has** `DESIGN_W2_8_CLOSE-OUT.md`.
- `DESIGN_W2_11_state-kit_mockup-v0_1.html` — **has** `DESIGN_W2_11_CLOSE-OUT.md`. ⚠ **In scope for row set B**: the composer's STATE surface is behaviour.
- `surface_d5_v1_0.html` — the composer modules, md5 identical to the one `#341` pins.
- `surface_profile_v1_0.html` — ⚠ **READ-ONLY CONTEXT.** It is the sell module's HOST mockup and the host is `.5`'s.
- `DESIGN_W2_10_sell-and-clamp_mockup-v0_1.html` — ⛔ **the sole `DESIGN_W2_*` mockup with NO close-out** (§2.5), and the sole tier-4 baseline for the sell module. **Rider 2 (§11) declares the gap; `.4` does not author the missing close-out and does not treat its panel E as ratified.**

⇒ **The gap is one mockup wide, not the whole set** — worth stating, because "the sell mockup has no close-out" reads as a hole in `.4`'s tier-4 authority generally, and it is not.

---

**`P4-F5` · ⚠ COMMIT A5's `R20` ROW FALSIFIES `POLISH-0.md` §0's OWN CLOSING TALLY, IN THE SAME COMMIT.**

§0 closes: ***"5 SCHEDULED · 14 RULED · zero OPEN … No ruling in this index is OPEN … Nothing in this index stops work."*** Filing `R20` as **`OPEN`** makes three clauses of that sentence false the moment it lands.

⇒ **A5 carries the correction INTO that sentence** (`O-5` — an appendix reverses nothing a reader reaches first), and ⛔ **re-measures the tally off the amended table rather than computing it.** The sentence itself states why: *"**A tally is a measurement; computing it is how it drifts.** This sentence has drifted twice."* Incrementing `zero OPEN` to `one OPEN` by arithmetic would be the third drift, committed by the row that exists to end the first.

### 15.4 · WHAT THE FOLD DOES **NOT** CHANGE

Stated so an execute session does not go looking:

- **§1 · the carry-in** — untouched. `RR-3` fixed, `MICRO-LABEL-TIER` eight-in-three-tiers, `rate_limited` eight-across-five, `c2Strip` dead. **Do not re-derive, do not re-open.**
- **§2 · the measurements** — untouched, and all re-checked at `8db535d`: the composer tree is still **19** files, and #341's intersection is still **exactly two** paths.
- **§3 · the item table** — untouched. Eleven rows, `PD-4-01` … `PD-4-11`. The parity lane mints **`P4-D<nn>` / `P4-P<nn>`** at the recon, never a `PD-4`.
- **§6 · the deny-list, §7 · the no-edit symbols** — untouched, and both bind PR C exactly as they bind PR B. The single authorised exception remains `c2Strip` under `OD-3`.
- **§8 · the test census** — untouched. Its row 5 is the positive control `OD-3` now requires; its row 1's warning that **a markdown diff checks zero files in Biome** is why PR A's receipt is the `pnpm vitest run` result, not `just verify` green.
- **§11 · the two same-commit riders** — untouched, including **Rider 3's `O-9` condition**: before saving either, re-read the cited section at then-HEAD.
- **§0.2 · ⛔ no `ultracode`, no dynamic workflow, no parallel fan-out.** The fold adds work; it does not add permission.

---

*Authored in plan mode, 2026-08-16, from a detached read-only worktree at `origin/main` @ `35da436`. No branch, no commit, no `src/` or `tests/` write. Every count states its classifier; every coordinate is fenced by symbol with line numbers demoted to evidence (`O-8`). Procedure cited from `POLISH-SURFACE-TEMPLATE.md` @ `§13.6`, never restated. Method governed by `POLISH-0.md`, which wins on any disagreement with this file.*

***Amended 2026-08-16 on `polish/4-pr-a` at `origin/main` @ `8db535d`, in the PR A execute session** — `OD-1` … `OD-4` ratified and the **HTML-FINISH parity lane folded in** (§15). Additive: §1, §2, §8 and §13's rulings untouched; corrections written into §4 · §5 · §10 · §12 · §14 (`O-5`). The fold's method (§15.2) was derived from **all four** prior parity passes at head — DISCOVERY #334 (`7345985`), PROFILE #337 (`77e62c2`), BOOKMARKS #338 (`fd4b357`), MARKET DETAIL #341 (open draft, `docs/plans/HTML-FINISH-MD.md` @ md5 `079df6560c1d6fa668ee6eb97e3028f2`) — their plans, session logs and merged diffs, never from a single close-out. Amendment findings are `P4-F1` … `P4-F5`; **no `PD-4` id was minted.***
