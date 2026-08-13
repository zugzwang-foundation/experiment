# POLISH.0 — The Method

> **Doc:** `POLISH-0.md` · web-authored, operator-ratified. Committed 2026-08-05. Amended in place 2026-08-10. GitHub is canonical; PK is the mirror.
> **Status:** **v1.1** · authored 2026-07-30 IST at POLISH.0 · amended at POLISH-TEMPLATE, 2026-08-10
> **Supersedes:** `POLISH-0_surface-inventory.md` (standalone, same day) — its content is §3 here, with corrections applied. **Discard the standalone.**
> **Companions:** `POLISH-register.md` (the defect record) · `POLISH-0_data-manifest.md` (states, fixtures, and the V-space register) · `POLISH-SURFACE-TEMPLATE.md` (the runbook) · `POLISH-TRACKER.md` (the phase sequencer) · `POLISH-RECON-report.md` (the POLISH.0 evidence base — **operator-local, deliberately not in the repo**)
> **Ground:** `origin/main` @ `35d041d` (#313), verified 2026-08-10.

> ⚠ **Read §10 first.** Every ruling this document once marked *pending* has been resolved, and every factual claim in it has been swept against the repo. §10 records what changed, who ruled it, and why. A reader who starts at §1 will not know which of §3's assertions were corrected on 2026-08-10 and which have stood since 2026-07-30.

**What this is.** The method that governs POLISH.1 through POLISH.8 — the precedence model, the inventory, the defect record, the routing taxonomy, the order, and the per-surface exit bar. A person who has never seen this project should be able to read this document and run a POLISH surface correctly.

**What this is not.** It is not an inspection, and it is not a runbook. No surface is inspected here. *How* a surface is run lives in `POLISH-SURFACE-TEMPLATE.md`, which reads this document and does not restate it. **Judgment here; procedure there** — so a change to procedure never silently edits a ratified baseline.

---

## §0 · The ruling index

Nineteen rulings are cited across this document and `POLISH-register.md`. Each has exactly one of three states. **No ruling is "pending" any more; a ruling that has not been taken is `OPEN` and says what it blocks.**

| # | Subject | State | Where it stands |
|---|---|---|---|
| **R1** | `PostCard` Đ BET / Support / Counter hardcoded `disabled` | **RULED 2026-08-12** | **SPLIT, and BOTH card controls are REMOVED.** `Đ BET` is redundant — `SlotHeader` carries a live per-column entry. `Support / Counter` is removed on thesis grounds: entering post-focus to argue means reading the post first, and mandatory commentary exists to make argument deliberate, not reflexive. ⚠ **Scope from the STRING, not the row — THREE sites:** `PostCard.tsx:111-119` and `:120-128` (POLISH.3 **PR 2**) · `DebateColumn.tsx:58-66`, dead code (**PR 1**). ⚠ `debate-export/serialize.ts:349` is ADR-0025 export copy, **not a control** — pinned two ways at `tests/unit/debate-export/serialize.test.ts:299` and the Mumbai fixture; touching it reddens both. ✅ **The ADR-0034 D-1 constraint is DISCHARGED** — the remedy is removal, so no `DebateViewModel` field is added. `PD-0-02` · B6. Ruling text in full: `docs/plans/POLISH-3.md` §3 |
| **R2** | P4 global freeze banner absent | **SCHEDULED** | Not POLISH's to take. `PD-0-05` routes to the **SPEC.1 §21.7 rider** task; the banner cannot be built before that rider lands, and it renders only at freeze (2026-11-05). **Struck as a POLISH.1 gate** — see §6 |
| **R3** | `not-found.tsx` + `global-error.tsx` absent | **RULED — discharged by execution** | Built at **`acc2e03` (#283, 2026-08-02)**: `src/app/not-found.tsx`, `src/app/global-error.tsx`, `src/app/(public)/not-found.tsx`. `PD-0-06` closes. The recommendation was *(a) build both*; the artifact discharges it whether or not a ratification was separately recorded |
| **R4** | Card read affordance — CD-A's "Read more" vs built `<Plus /> Full` | **RULED 2026-08-12 — ADOPT** | **Adopt CD-A's "Read more"** at `PostCard.tsx:102-109`, in POLISH.3 **PR 2**. ⚠ **`.3` changes only its own site.** `.5` (`ArgumentList.tsx:75`) and `.6` (`BookmarkCard.tsx:64`) are bare CSS clamps with **no affordance at all** — there the remedy is an *addition*, not a rename, and it is theirs; §5 forbids a V batch spanning surfaces. ✅ **CD-A's `#989898` → `#FAFAFA` hover ARE shipped tokens** — `--color-n5` (`globals.css:144`) and `--color-ink` (`:147`) — so it ports to `text-n5 hover:text-ink` with no raw hex and no divergence. ⚠ Porting the literals would redden `tests/unit/design/no-raw-hex-view-layer.test.ts`. Claim re-verified 2026-08-10: zero `Read more` occurrences repo-wide. `PD-0-01` · B11. Ruling text in full: `docs/plans/POLISH-3.md` §3 |
| **R5** | `PostPopup` parity against CD-A — width, height, `SideBadge`, header row | **RULED 2026-08-12 — SPLIT** | **Two halves, two classes.** Geometry — 512px→720px, 80vh→90vh, the absent CD-A header row — stays class **V** on `PD-0-03`. **The missing `SideBadge` becomes its own class-F row, `PD-3-14`**: a frozen side badge on every post is an invariant-visual obligation (§7 criterion 2), not a width preference. **Full CD-A parity on both halves.** POLISH.3 **PR 2**. `PD-0-03` · B7a. ⚠ Its *"Blocked on C3"* was void — C3 landed at `54b0b2a` (#278, 2026-07-31). Ruling text in full: `docs/plans/POLISH-3.md` §3 |
| **R6** | CD-A's pop-up Support/Counter footer + stake bar; the reply-variant pop-up | **RULED 2026-08-12 — RETIRED** | **Retired by ruling**, appending to canon under the **`C-`** form at the POLISH.3 close-out. CD-A ratified the pop-up composer believing it was the only market-view path to reply-as-bet. It is not — `SlotHeader` is already live, so building it would make a **fourth** entry to one action. ⚠ **Do not file the unbuilt pop-up composer, the Support/Counter footer + stake bar, or the absent `ReplyPopup` as defects.** An inspection that rediscovers them takes `duplicate-of-known` and cites this row. The POLISH.0 recommendation was *defer and re-decide*; the re-decision is this. `PD-0-04`. Ruling text in full: `docs/plans/POLISH-3.md` §3 |
| **R7** | `text-white` at `audit/page.tsx:75` | **SCHEDULED** | Disposition set at POLISH.8 kickoff. `PD-0-07` · B12 · CC-LIGHT. Re-verified 2026-08-10: still live, single site |
| **R8** | Loading skeletons — W2.11 T1 ratified none, five shipped | **RULED — T1 SUPERSEDED** | Skeletons are correct. **P7 loading primitive minted** at `ui/loading-block.tsx`; canon amended in the **same commit** (DISCOVERY-COMPLETE **C10**, `e5827dc`). The locked kit is now **P1–P7**. `PD-0-08` and `PD-2-28` close |
| **R9** | Empty states — W2.11 P1 locked one shape, five shipped | **RULED** | Reconcile to P1's one shape, batched per surface. Executed for Discovery at DISCOVERY-COMPLETE **C9** (`e0ab7b2`). `PD-2-27` closes; `PD-0-09` remains open for .5 and .6 |
| **R10** | Price-bar percentage labels are not controls (`role="img"`) | **RULED 2026-08-12 — accepted-divergence (P12)** | **Accepted divergence, founder-set**, appending to canon as **`C-PRICEBAR-1`** at the POLISH.3 close-out. ⚠ **The `superseded` exit is CLOSED, and the reason is measured:** the mockup carries **two** `pick` functions — the global `:1431`, which **opens the composer** and is what the price labels and the `Buy` buttons both call, and the view-only `:1862`, which is IIFE-private and drives the reply carousel. **Canon §2's *"Pick is view-only"* governs the second, not these labels.** Accepted for consistency with R6: `SlotHeader`'s `Đ BET` is already live, so wiring the labels adds another entry to one action. `PD-0-11`. Ruling text in full: `docs/plans/POLISH-3.md` §3 |
| **R11** | Sell button hidden vs disabled when ineligible | **SCHEDULED** | Disposition set at POLISH.5 kickoff. `PD-0-12`. Same P12 constraint as R10. The server-side type split (a visitor's DTO carries no `sellEligible` field at all) is the stronger property |
| **R12** | `PositionMarker` and side-chip duplication | **SCHEDULED — its INV-3 arm already shipped** | `PD-0-10`. ⚠ **Two of the three hand-rolls inverted the pole on live participant surfaces**; both were fixed at DISCOVERY-COMPLETE **C4/C4b**, and `CC-4` re-classes the side-chip half **V → F**. One implementation survives — `(admin)/…/ReviewFeed.tsx:102-104`, correct today, excluded from the C0 guard by directory. The remaining ruling is cosmetic consolidation only |
| **R13** | The chart expanded-overlay's presentational baseline | **RULED 2026-08-12 — `design-canon.md` §10 `C-CHART-1`** | `PD-0-16`, **reclassed S → R and closed.** The POLISH.0 recommendation was to name **SPEC.CHART** as tier 1. SPEC.CHART is a real phantom — absent from `docs/specs/` and from the entire repository, re-verified at `198d1d0`. **The conclusion drawn from its absence was not.** SPEC.1 **§9** carries *"Market price history — the market-detail chart"* + **F-DEBATE-5** (v1.0.22, 2026-07-23), specifying the collapsed and expanded modes by name, with **eight** `debate-view::price-chart-*` §17 rows and a pinned `MARKET_SERIES_MAX_POINTS`. It was inside the section §3's Tier-1 cell already cited; the ⟐ on that cell's §16.1 and §17 entries records that neither was read. **Class S halts a build — the build shipped at UI.19 and is test-pinned, so nothing was ever halted.** The real gap was *presentational*, which SPEC.1 §9 routes to **canon** by name and canon never received. ⚠ **The lesson is not the existence rider — that worked.** It is that a missing source was allowed to imply a missing baseline without checking the sources that were present. **`C-CHART-1` closes it. No spec minted; no divergence accepted** |
| **R14** | Bucket-C supersessions — slot-header geometry and card media clip, code state unverified | **RULED 2026-08-12 — TWO ROWS MINTED** | **Two rows, not one.** **Check 1 — slot-header geometry: PASSED.** Built values match the CD-final transcription on every named property; only the coordinates drifted (live `SlotHeader.tsx:104` and `:118`, not `:111`/`:125`). **Check 2 — card media clip: HALF-PASSED.** The in-card `--imgmax` clip holds; *"renders whole in the pop-up"* holds in the **width axis only**. ✅ **The rows now exist — `PD-3-05` and `PD-3-06`**, minted at POLISH.3's commit 0. The *"no register row"* absence was asserted in **three** independent places — §2.1 bucket C's rider, §3's POLISH.1 Pre-recorded cell, and `POLISH-TRACKER.md` §2 — and all three are discharged by this mint. ⚠ **Both dispositions append to canon under the `C-` form, NEVER as `R14`** (canon §10's numbering rule). Ruling text in full: `docs/plans/POLISH-3.md` §3 |
| **R15** | `no-raw-hex-view-layer.test.ts` does not catch Tailwind palette classes | **SCHEDULED** | Not a product ruling — a guard to mint. Extend the guard to ban `(bg\|text\|border\|ring\|fill\|stroke)-(white\|black\|red\|blue\|…)` in `src/`. Routes to the quality lane, not to a surface. ⚠ **THE POPULATION IS NOW ZERO.** R7 was its one live instance and POLISH.8 fixed it at `92c401b` (#323) — the same grep returns 0 across `src/` at head, measured. **R15 must therefore be minted RED by PLANTED-OFFENDER MUTATION (RULE-1 axis ①), never by finding a live instance**; a guard green on first run is a vacuous pass (H15). A pre-fix RED capture exists at `docs/logs/POLISH-8.md` §5 — it is **evidence the predicate discriminates, NOT a committed RED-first receipt**. Register row: `PD-8-28` |
| **R16** | A11Y.0 timing, and whether surfaces can close | **RULED** | **`closed (a11y-deferred)` STANDS** as the closing status. A11Y.0 becomes a **real dated docket row with a scope line** — keyboard reachability · accessible names · visible focus — with WCAG 2.2 AA scoped past the experiment. A phantom prerequisite is worse than a deferred one, and A11Y.0 already has a backlog: `PD-2-06`, `PD-2-10`, `PD-2-33`, and POLISH-1a's `title`-reach finding all route to it |
| **R17** | ADR-0034 D-1 as a POLISH routing guard | **RULED — YES, keyed on the property** | See §5. The check does **not** key on a class letter, because `B` means three different things in this corpus |
| **R18** | Four-tier vs five-tier precedence | **RULED — five tiers**, plus the existence rider | See §2 |
| **R19** | `design-language.md` still describes the debate mode selector as real | **RULED — discharged by execution** | Corrected at **`54b0b2a` (#278, 2026-07-31)**, in the same commit as the CD-A close-out, exactly as the remedy specified. The fix was **broader** than the row requested: three sites, not two — `:178`, `:227`, and the §6 ranking clause that asserted four selectable modes as live product. `PD-0-13` closes. See §2.2 |

**5 SCHEDULED · 14 RULED · zero OPEN · one (R2) routed out of POLISH.** A `SCHEDULED` ruling is not a blocker — it is a disposition whose owner and timing are named. ⚠ **No ruling in this index is OPEN**, and none has been since 2026-08-12, when R13 closed at `design-canon.md` §10 `C-CHART-1`. **Nothing in this index stops work.** **Six moved SCHEDULED → RULED at POLISH.3's kickoff** — R1 · R4 · R5 · R6 · R10 · R14 — founder-ratified 2026-08-12 and recorded in full at `docs/plans/POLISH-3.md` §3. ⚠ **The figures above were RE-MEASURED off the amended table, not derived by subtracting six from the previous pair.** This sentence has drifted twice: it once read *"Nine SCHEDULED · eight RULED"* against a table carrying neither, wrong in opposite directions and not reconcilable by any reading of R2. **A tally is a measurement; computing it is how it drifts.** `POLISH-TRACKER.md` §2 carries no second copy — it points here.

*(R2 is counted in SCHEDULED above and is also named as routed out of POLISH; its row carries `SCHEDULED`. The two descriptions are of one ruling, not two.)*

---

## §1 · What POLISH is

A per-surface pass comparing each **built** surface to its baselines on **both axes** — visual fidelity *and* functional completeness.

**Two halves, and a surface is closed by neither alone.**

- **The machine phase** — CC reads the tier-4 mockup against the built components under the full precedence stack, emits a classified delta list, and ships what the standing disposition pre-approves. It cannot see what only a render shows.
- **The founder pass** — the operator walks the surface and judges proportion, density, rhythm, and whether anything reads as broken, unfinished or accidental. A machine cannot do this.

Both are necessary because each is blind to what the other catches: the machine catches a wrong token that happens to render identically; the eye catches a broken thumbnail that no test asserts. **A surface is not closed until both have run and §7's exit bar holds.**

**Lane discipline (do not blur).** The founder pass is **design-lane**: operator + web Claude, CD only on referral. No CC, no branch, no PR. **Fixes execute as code-lane PRs under normal gates.** A fix touching auth · bet engine · ledger · commentary/moderation keeps the full plan→execute + named-reviewer cascade. POLISH is a hybrid node with a design-lane owner.

**Roles.** Operator captures · web compares · **CD only on referral.** `design-handoff.md` §7 forbids iterating a built surface in CD — code is the source of truth post-handoff. Routine visual defects go straight to a code-lane batch. CD is used only for *"this is wrong and we don't know what right looks like"* — an R-class visual question — and then via fresh screenshots into a new exploration.

**Standing rule.** Never polish a surface with an open build PR against it.

---

## §2 · The precedence model

**Ratified at R18, 2026-08-10: five tiers.** As originally ratified at P1 the model had four. Four investigations at POLISH.0 found that three of four apparent divergences resolved on documents the four-tier model does not name; POLISH.2's entire run then turned on tier-3 build-law (`UI-A4.md` + its close-out) and a tier-1 patch record (ADR-0017 P3).

| Tier | Source | Note |
|---|---|---|
| **1** | SPEC.1 · SPEC.2 · ADRs — **patch records read before the decision body** | ADR-0017 carries P1/P2/P3; ADR-0023 carries **two** — 2026-07-17 (the `(auth)` header mount) and 2026-08-03 (header scroll behaviour = sticky, POLISH.1b / D3), both indexed at `0023-participant-shell-topology.md:12`. ⚠ **A reader told there is one may stop after the first.** A patch record amends the body in place. Reading ADR-0017's Decision Outcome and stopping yields four ratified filter modes that were retired at P3 |
| **2** | `design-canon.md` §4 rulings · §10 CD log · the CD close-outs · values-log v0.3 | These override mockup pixels where they speak |
| **3** | **Build-law** — `docs/plans/<SLOT>.md` + its plan-phase and execute close-outs | Supersedes the **mockup** on presentation decisions. **Never** supersedes tiers 1–2 |
| **4** | The locked mockup | Layout / type / spacing, wherever tiers 1–3 are silent |
| **5** | The CD export bundle | **Lossy reference, never canon.** Cited nowhere in this document, by design |

### ⚠ The existence rider — added at R18

**Verify that a named source exists on `main` before reading it.** A citation is not an artifact.

This is not hypothetical. `§3`'s POLISH.3 row cited **SPEC.CHART** as a tier-1 source. It is not in `docs/specs/` and never has been, and an inspector following §8 would spend a session hunting a document that does not exist. ⚠ **What POLISH.0 concluded from that absence — *no baseline at any tier*, therefore class **S** — was itself WRONG**, and R13 corrected it on 2026-08-12: SPEC.1 §9 F-DEBATE-5 governed the component the whole time. **Do not read this example as establishing that conclusion.** What the rider establishes is narrower, and it holds: **a citation is not an artifact**, and a named source is verified to exist before it is read. Why the conclusion did not follow is the second half, below.

⚠ **And the rider's second half, learned the hard way at R13, 2026-08-12.** Verifying that a named source is missing is only the first move. **The absence of a cited source does not establish the absence of a baseline** — the other sources must still be read before that conclusion is drawn. At R13 the missing `SPEC.CHART` was allowed to imply *"no baseline at any tier"* while **SPEC.1 §9 F-DEBATE-5, eight §17 acceptance rows, and a pinned §16.1 constant** governed the component, sitting inside a section this document's own Tier-1 cell already cited — and the ⟐ marks on that cell recorded, in writing, that two of the three had never been read. **A ⟐ is not a footnote. It is a statement that the entry is unverified**, and a finding built on top of an unread ⟐ entry is a finding about the reader.

A named source that cannot be located is a **class-S finding about the method document**, filed as such, not a research task.

**Hygiene rider.** A tier-3 ruling that supersedes a mockup **appends to canon §10**. §10 already carries the rule — *"any further pure-polish inconsistency noticed downstream → append here; never absorb into a build task"* — it simply was not used for the A7 page↔modal ruling.

### §2.1 · The supersession list

Every row is a place where later ratified work overrode an earlier baseline. **An inspector without this list files each one as a defect.** Four buckets, and the bucket is the whole point.

**A · Ratified, and the code honours it → never filed. Disposition `superseded`.**

| Override | Supersedes | Source |
|---|---|---|
| Countdown is digits-only `DD:HH:MM` — no unit labels, no `TO FREEZE` | the mockup's labeled timer | canon §10 R-2 · values-log v0.3 |
| Graph pair off the neutral ramp (`--graph-yes #737373` / `--graph-no #fafafa`), bound by token **name** not draw order | token-ramp expectation | values-log v0.3 · CI-pinned |
| Pop-up carries **no REPORT** control | the v1.11 pop-up | CD-A, 2026-07-14. Re-verified 2026-08-10: zero `report` matches in `dialogs.tsx` |
| **Auth is full pages hosting the W2.1 card** — card content only, no modal chrome, backdrop or dismiss | W2.1's *"modal over dimmed app, not full-page"* | **`docs/plans/UI-A7.md` ruling 1**, operator-ratified 2026-07-21. OAuth redirect kills a modal; the onboarding gate is a full-page flow |
| **Bet entry reads `Đ BET`, not `Buy`** | the d5 mockup's `tradebtn` label | W2.8 (2026-06-26), nine days after the d5 lock · canon §7 item 3 |
| **No ranking mode selector.** Top order always, with the P2 latest-interleave. Lane dominance renders as a **badge**: three names (Most Debated · Highest Stakes · Contested), **Newest is not a badge**, one badge per badged post, most posts carry none | ADR-0017's own Decision Outcome (four selectable filter modes) | **ADR-0017 patch record P3**, 2026-06-23. Now also carried in `design-language.md` itself — see §2.2 |
| **Price-bar percentage labels are not controls** — `role="img"` + `aria-label`; percents are plain spans | mockup `:1038`/`:1040`, where they call `pick()` | **R10 · RULED 2026-08-12 — `accepted-divergence`, founder-set (P12), POLISH.3.** Appends to canon as **`C-PRICEBAR-1`** at the POLISH.3 close-out. ⚠ The `superseded` exit is closed: the mockup's global `pick` at `:1431` **opens the composer**, and canon §2's *"Pick is view-only"* governs the IIFE-private `:1862`, not these labels |

**B · Ratified, and the code does NOT honour it → a pre-recorded defect, class V.**

| Override | Built state | Source |
|---|---|---|
| Card read affordance = **"Read more"**, sentence case, own line, flush left, 11.5px/600, `#989898` → `#FAFAFA` hover | **`<Plus /> Full`** (`PostCard.tsx:102-109` — re-measured 2026-08-12; this cell previously read `:88-95`, drift +14). `Read more` has **zero** occurrences repo-wide — re-verified 2026-08-10 | CD-A, 2026-07-14. **R4 · RULED 2026-08-12 — ADOPT, .3 PR 2 · .5 · .6.** ✅ The two hex values ARE shipped tokens — `--color-n5` (`globals.css:144`) and `--color-ink` (`:147`) — so this ports to `text-n5 hover:text-ink`; porting the literals reddens `no-raw-hex-view-layer.test.ts` |

**C · Ratified, code state unverified → a first-order check at the surface, not a supersession.**

| Override | What to check | Source |
|---|---|---|
| Slot-header geometry = CD-final px | `SlotHeader.tsx:104` `min-h-[34px] px-3.5 py-[7px] text-[13px]`, `:118` `gap-[5px] text-[19px] font-semibold text-ink` against values-log §1 item 6 — **coordinates re-measured 2026-08-12; this cell previously read `:111`/`:125`, drift −7** | canon §10 R-5. **R14 · RULED 2026-08-12 — CHECK 1 PASSED, `PD-3-05`** |
| Card media clips at `--imgmax` 160px in-card; renders **whole** in the pop-up | both halves | CD-A (retires WI-5). **R14 · RULED 2026-08-12 — CHECK 2 HALF-PASSED, `PD-3-06`** — the in-card clip holds; *"renders whole"* holds in the **width axis only** |

✅ **R14's rows now exist — `PD-3-05` and `PD-3-06`**, minted in `POLISH-register.md` at POLISH.3's commit 0, 2026-08-12. Until then these two checks lived only here, and the same absence was asserted in **three** independent places — this rider, `POLISH-0.md` §3's POLISH.1 Pre-recorded cell, and `POLISH-TRACKER.md` §2. **All three are discharged by the one mint**, and a subset would have left this file contradicting itself.

**D · No POLISH surface — belongs to a future build.**

| Override | Home |
|---|---|
| Share-card lockup may shorten (mark + wordmark tightening) | canon §10 R-3 → the UI.14 build, which is SPEC-blocked |

### §2.2 · Known-stale baselines — **R19 discharged**

⚠ **This section previously instructed inspectors to treat `design-language.md:178` and `:227` as void. That instruction was inverted and has been deleted.** Those lines are now the *corrected* text; voiding them would discard a ratified correction.

**`54b0b2a` (#278, 2026-07-31)** — *"docs(design): commit CD-A pop-up close-out; correct stale mode-selector lines"* — corrected **three** sites, one more than the row requested:

- `:178` — *"Debate mode selector"* → **"Lane-dominance badge"**, with the badge vocabulary and *"Newest is not a badge"* stated in full.
- `:227` — the capability-matrix row renamed to match.
- The **§6 ranking clause** (then `:244`) — *"selectable modes: Most Debated, Highest Stakes, Contested, Newest"* → *"ranked in a single fixed order — **Top** … **There is no mode selector in v1** (ADR-0017 P3)."*

The third was the most substantively wrong of the three and appeared in neither this file's original text nor `PD-0-13`. `docs/plans/DEBATE.4.md:44` — the flag this section cited — had named all three sites (`§6/§3.2/§5`); the row that transcribed it named two. **A remedy scoped from a row rather than from the underlying flag will under-fix.**

**Still open, and NOT discharged by #278:** SPEC.1 §18's out-of-scope catalogue appears to still list four shipped modes. Different document, different lane — **DESIGN.SPEC, not POLISH's to fix.** Verify against §9's annotation before treating it as anything.

---

## §3 · The inventory

Order follows the amended sequence in §6. **Tier-1 entries marked ⟐ are candidates from memory and the tracker, not documents read at POLISH.0 — verify at that surface's kickoff, per §8 step 0.**

### POLISH.1 · Shell + branded header/nav

| | |
|---|---|
| **Surface** | Root layout · `(public)` layout · `(auth)` layout · `GlobalHeader` and cluster. Renders on **7 routes**: `/` · `/bookmarks` · `/m/[slug]` · `/u/[pseudonym]` · `/sign-in` · `/sign-in/otp` · `/onboarding`. **Not** on `/admin/*` |
| **Components** | `app/layout.tsx` · `(public)/layout.tsx` · `(auth)/layout.tsx` · `GlobalHeader` · `BrandCluster` · `CountdownDigits` · `countdown-format.ts` · `VisitorCounter` · `HeaderNav` · `RadioSlot` |
| **Build row** | UI.A1 · UI.13 · BRIDGE · **POLISH-1a (#288) · POLISH-1b (#289) · POLISH-1-DOCS (#290)** |
| **Machine phase** | ✅ **RUN** at #288/#289/#290. The founder pass has **not** run — POLISH-1a's still is *"not a verification artifact"* by its own log (`:142`) |
| **Tier 4** | `DESIGN_W2_4-5-14_global-header_mockup-v0_2.html` (**v0_1 superseded — do not read**) |
| **Tier 3** | `docs/plans/UI-A1.md` + `ZUGZWANG-UI-A1_CLOSE-OUT.md` — carries the **ratified omissions**: Social · Research · **RULES** · Đ-info · visitor *(visitor later added at UI.13)*. Also `docs/logs/POLISH-1a.md` — two **recorded deviations** and the `useExhaustiveDependencies` ruling |
| **Tier 2** | canon §10 R-2 (timer) · values-log v0.3 header-cluster geometry · canon §7 item 9 (header frame · timer · visitor · §21.1 anti-conflation placement) |
| **Tier 1** | SPEC.1 **§21.1** visitor counter + anti-conflation ⟐ · §21.5 radio *(UI.17 SPEC-blocked — the slot renders, the feature does not; verified 2026-08-10, `RadioSlot.tsx` is an inert disabled skin)* · **ADR-0023** + its 2026-07-17 patch record (the `(auth)` header mount) |
| **Invariant obligations** | None of the five render here. **One hard tier-1 check does: §21.1 anti-conflation** — the visitor counter is never co-located with `n`, stake or Dharma |
| **Cross-surface** | None |
| **Pre-recorded** | ⚠ **B4 (UI.11 AGPL source offer) is VOID, not open.** SPEC.1 v1.0.26 `:1498`, 2026-08-02: *"Page-level footer withdrawn … **B4 (UI.11) is withdrawn, not rescoped.**"* The AGPL §13 obligation survives, relocated to the ToS body. The *absence* of a footer in `src/` is true and correct · ⚠ **B10 is CLOSED** — `not-found.tsx`, `global-error.tsx` and `(public)/not-found.tsx` all landed at `acc2e03` (#283) · **B8 / P4 freeze banner: SPEC-blocked**, see §6 · Social/Research = accepted divergence (OQ-3/4) · **countdown cell count: verify 8 on screen, not 9** — the recon's arithmetic was wrong, the code comment is right · `--elev-2` has **no live consumer** (re-verified 2026-08-10: one hit, the definition) — expect no tier-2 elevation anywhere · **R14** slot-header geometry check — ✅ **RULED 2026-08-12, CHECK 1 PASSED**; the register row now exists as **`PD-3-05`** · ~~POLISH-1a OQ-1: `ui/avatar.tsx` `mix-blend-darken` fixed on **1 of 3** consumers~~ — **STRUCK at PRIMITIVES-2 D1.** This cell **said** "1 of 3". It was fixed **at the primitive**, and therefore on **all three**: PRIMITIVES-1 D6 removed `after:mix-blend-darken` from `ui/avatar.tsx` itself (`997f308`, PR #293). `mix-blend` has zero occurrences in `src/`; `tests/unit/design/avatar-ring-token.test.ts:72,83` pins the absence two independent ways |

### POLISH.7a · Auth surfaces

| | |
|---|---|
| **Surface** | `/sign-in` · `/sign-in/otp` · **`/onboarding`** — all three skinned at UI.A7. *(Corrected: the standalone inventory put `/onboarding` in 7b. What is blocked on O1 is the 6-card **deck**, a different artifact.)* ⚠ The UI.A7 "all PASS" claim is a statement about a past verification event and is **not a repo artifact** — treat it as context, not as a discharged criterion |
| **Components** | `sign-in/page.tsx` · `sign-in/otp/page.tsx` · `onboarding/page.tsx` · `_components/AuthAlert.tsx` and `error.tsx` (both minted at POLISH.7a). *(S-01 was authored pre-execute and said "+ its file-local `AuthError`"; POLISH.7a's own machine PR deleted that component and added the two files above, so the cell is stated as of PR head — §7's re-verify rule, applied to the claim and not only to the anchor.)* ⚠ **`(auth)/layout.tsx`, `GlobalHeader` and cluster, `PageContainer` and `src/app/layout.tsx` are POLISH.1's** (`:150`) and are not inspected here — **with ONE exception ratified at POLISH.7a R-A: `src/app/layout.tsx` is in scope for `P7a-D19` only**, because `docs/logs/POLISH-1b.md:92,94,136` assigns that defect to this surface by name and directs an upstream-only fix. `src/components/debate/composer/AuthGateSlot.tsx` is **POLISH.4's** (`:217`) |
| **Machine phase** | **NOT RUN.** No gates. Cheapest surface in the set — runs first |
| **Build row** | UI.A7 · AUTH-OTP-DELIVERY |
| **Tier 4** | `DESIGN_W2_1_auth-modal_mockup-v0_3.html` · `DESIGN_W2_1_first-login-journey_mockup-v0_1.html` · `DESIGN_W2_11_state-kit_mockup-v0_1.html` (card spec + the four state treatments — `UI-A7.md:132`, `:231`). ⚠ `DESIGN_W2_1_first-login-journey_mockup-v0_1.html` depicts the post-session 6-card DECK — **POLISH.7b's artifact** — and its cards are literal `PLACEHOLDER` strings. `UI-A7.md` §6.1 rules the onboarding card defaults to the auth-card visual language. **File no delta from it.** |
| **Tier 3** | **`docs/plans/UI-A7.md` — load-bearing.** Ruling 1: full pages, card content only. §6 · WI-1 (`UI-A7.md:157`): **the mockup is a structure/layout reference, not a value source** — it predates BRIDGE, so its own token names are never copied; everything resolves against contract v0.4 |
| **Tier 2** | canon §7 item 9 (W2.1) — F-AUTH-4 override → implicit footer acceptance · one-account-per-email · one picker behind all triggers, new-vs-returning silent · R1 silent identity (appears in nav; reveal is deck card 1) · `DESIGN_W2_1_CLOSE-OUT.md` — the CD close-out is a tier-2 source (`:73`) and is the origin of *"one picker behind all triggers"* (`:55`), *"R1 silent identity"* (`:59`) and the OTP lock (`:60`); `design-canon.md:126` carries neither of the first two. ⚠ **The F-AUTH-4 override cited here LAPSED 2026-08-04** — `SPEC.1.md:807–817`: the sync was never performed, the footer was withdrawn 2026-08-02 removing the override's mechanism, and §13 F-AUTH-4 stands unamended. **Tier 1 wins.** `/onboarding`'s baseline is the inline-scrollable acceptance screen with an explicit checkbox. `design-canon.md:126` still carries the override unannotated — design-lane, not POLISH's |
| **Tier 1** | SPEC.1 §13 F-AUTH-* ⟐ · **ADR-0004** ⟐ · **ADR-0033** OTP boot guard — *deliberately FATAL* ⟐. ⚠ `SPEC.1.md:817` assigns F-AUTH-4's build-conformance verification to THIS SURFACE by name. Discharged at `P7a-D16` → `AUTH-ONBOARDING-GATE` |
| **Invariant obligations** | None render here |
| **Cross-surface** | None |
| **Pre-recorded** | **Turnstile is not wired** — verified 2026-08-10, `sign-in/page.tsx:121` is a TODO comment and no widget is mounted; staging runs always-pass test keys, so W2.1's three ratified Turnstile states cannot be exercised → `data-blocked` pending AUTH-TURNSTILE-WIRE · **raw error codes** (`otp_invalid`, `otp_rate_limited`) render to users → AUTH-ERROR-COPY, routed here under G3 · ToS/Privacy bodies are lorem-ipsum on `/onboarding` (verified: `public/legal/tos.txt` opens *"PLACEHOLDER v0"*), pending LEGAL.1 → content-blocked, one element · **Three carry-forwards route here from `PRIMITIVES-1.md:341–342`** and the row did not carry them: **D4 `my-auto` (upstream-only)** → `P7a-D19`, ratified in scope at R-A · **AUTH-CONSENT-LINE** → **STRUCK at R-D**, four grounds in `docs/plans/POLISH-7a.md` §2 · **D2b container normalisation is `.2`/`.3`/`.5`/`.6`, NOT `.7a`** (`PageContainer.tsx:21–23`). **AGPL `I6` (`PRIMITIVES-1.md:345`) is its own row and is NOT this surface's** |

### POLISH.2 · Discovery (`/`)

| | |
|---|---|
| **Surface** | `/` — server, `force-dynamic`, in-page `<Suspense>` (deliberately **no** route-group `loading.tsx`, so it doesn't blanket `/m/[slug]` — `page.tsx:28-30`) |
| **Components** | `DiscoveryCarousel` · `DiscoveryGrid` · `HeroPanels` · `MarketCard` · `PriceSparkline` · `StatLine` · `EmptyState` · `ErrorState` · `LoadingSkeleton` — *corrected at POLISH.2: `StatLine` was missing and carries six of the surface's deltas; **`scrollers` belongs to the debate surface, not Discovery — mis-copied into this row.** It is real (`src/components/debate/scrollers.tsx`) and correctly listed on POLISH.3's row, which is unchanged* |
| **Machine phase** | ✅ **COMPLETE** — #306 · #311 · #312 · #313. **The surface is NOT CLOSED**: §7 criterion 1, parity by eye at 1440, is the founder's and has not run |
| **Build row** | UI.A4 · UI.19 · **POLISH.2 (#306) · DISCOVERY-COMPLETE (#311)** |
| **Tier 4** | `surface_discovery_v1_0.html` |
| **Tier 3** | `docs/plans/UI-A4.md` + close-out · `docs/plans/DISCOVERY-COMPLETE.md` + `docs/logs/DISCOVERY-COMPLETE.md` · `docs/logs/POLISH-2.md` |
| **Tier 2** | canon §2 — hero + 8 grid cards on **one shared carousel index** · canon §5 carousel motion · values-log v0.3 §1 item 1 (sparkline + hero renders, **series-bound**) · canon §4 ruling 4 (nav-identity already-handled) · **the C10 canon amendment** (P1–P6 → P1–P7) |
| **Tier 1** | **ADR-0017 + P2 + P3** — Top order with latest-interleave; **no selector**; badge vocabulary ⟐ · `RANKING.md` ⟐ |
| **Invariant obligations** | Frozen side badge · no vote affordance |
| **Cross-surface** | Side badge |
| **Pre-recorded** | **PCT.ROUND (B2) — CLOSED**, PR #276 · **R9 empty states — RULED and executed** (C9) · **R8 `LoadingSkeleton` — RULED, P7 minted** (C10) · **there is no participant market-list route** and none is expected — Discovery is a bounded carousel over `listOpenMarkets` capped at `DISCOVERY_GRID_SIZE` · **PD-2-32 broken market thumbnails — an OPEN class-F PRODUCTION defect**, routed to PRIMITIVES-2 |

### POLISH.3 · Market Detail (`/m/[slug]`) — the heaviest row

| | |
|---|---|
| **Surface** | `/m/[slug]` → `DebateView`. **Two mutually exclusive arms**: market view (`PostScroller`) and post-focus view (`PostFocusHeader` + `ReplyScroller`), toggled at the two `<DebateColumn>` mounts — **`DebateView.tsx:308`** (market, `header={<SlotHeader …>}`) and **`:244`** (post-focus, `header={<PositionStrip …>}`). ⚠ **Re-measured 2026-08-12; this cell previously read `:177/:272`, a drift of +36 and +67.** Coordinates in this file drift — **fence by SYMBOL**, per `docs/plans/POLISH-3.md` §11 |
| **Components** | `DebateView` · `MarketHeader` (+`LifecycleBadge`) · `MarketPriceChartHost/Card/Overlay` · `MarketPriceChart` · `DebateColumn` · `PostCard` · `PostFocusHeader` · `ReplyCard` · `ReplyPreview` · `scrollers` (+`EmptySideCTA`) · `AggregateFooter` · `ArgProfile` · `PriceBar` · `placeholders` · `dialogs` (`PostPopup`) · `badges` |
| **Machine phase** | **NOT RUN.** ⚠ **All four gates are CLOSED** — B1, B2, B3 and C3. This surface is fully gated in |
| **Build row** | DEBATE.4 · UI.19 (both slices) · ~~MEDIA.2~~ |
| **Tier 4** | `surface_d5_v1_0.html` |
| **Tier 3** | `docs/plans/DEBATE.4.md` — **its `:44` stale-doc flag is now DISCHARGED**, see §2.2 · ⚠ **`docs/plans/UI.19.md`** — dot-form, corrected 2026-08-12. This cell previously read `docs/plans/UI-19*.md`, **a glob that has never matched anything in this repository's history**; a reader following it found the log and not the plan · `docs/logs/UI-19-log.md` (committed at PR #274, `a3f136e`) · ⚠ **`UI.19.md` is near-silent on the overlay's presentation** — it specifies the two axis endpoint labels and the node's token/y-scale, fences interior ticks OUT of the build as canon-owned, and delegates everything else with *"mirror `ProfileGraphOverlay`"*. Node form, dimensions, backdrop appearance, close-control form, chrome and the shipped legend are in **no** plan passage. **Tier 3 is not the overlay's presentational baseline; `C-CHART-1` is** |
| **Tier 2 — six documents** | ① canon §2 Market Detail — ⚠ **it did not describe the chart at all until 2026-08-12**; the chart-slot sentence was added with `C-CHART-1` · ② **`DESIGN_popup-redesign_CLOSE-OUT.md` (CD-A)** — ✅ **COMMITTED at `54b0b2a` (#278, 2026-07-31). C3 is CLOSED** · ③ `DESIGN_W2_11_state-kit_mockup-v0_1.html` + the W2.11 close-out · ④ values-log v0.3 §1 item 1 (chart renders — the "three branded, four exist" claim behind `PD-0-16`; it is a **colour-binding** ruling and never governed presentation) · ⑤ canon §10 R-5 (**R14** — ⚠ its disposition appends to canon under the **`C-`** form, never as `R14`; see canon §10's numbering rule) · ⑥ **canon §10 `C-CHART-1`** — the expanded overlay's presentation. ⚠ **`DESIGN-W2_6-graph-prototype-record.md` is NOT a tier-2 source for this chart** and must not be cited as one: fixed-window X domain, a node primitive that never shipped, and a self-disclaimed spec status |
| **Tier 1** | SPEC.1 §9 debate flows · **SPEC.1 §9 "Market price history — the market-detail chart" + F-DEBATE-5** — the chart's governing text, both modes, **verified read 2026-08-12** · **§16.1 + Appendix B** `MARKET_SERIES_MAX_POINTS` = 256, pinned, not deferred to tuning — **verified, ⟐ struck** · **§17** — **eight** `debate-view::price-chart-*` rows; note the only presentational one asserts the **absence** of an axis in the **collapsed** state, and **no §17 row constrains the expanded render** — **verified, ⟐ struck** · **ADR-0017 (+P1/P2/P3)** · **ADR-0018** · **ADR-0020/0021** masking · **ADR-0025** export binds this DTO · **ADR-0034** viewer-scoped reads live outside `DebateViewModel` · ⚠ **`SPEC.CHART` DOES NOT EXIST and is not a source — the citation is struck, not deferred.** R13 is **RULED**; the chart's presentational baseline is tier 2, `design-canon.md` §10 **`C-CHART-1`**. **Inspect the overlay normally against F-DEBATE-5 and `C-CHART-1`** |
| **F-DEBATE-4** | ✅ **VERIFIED, not unverified.** `docs/plans/F-DEBATE-4.md` and `docs/logs/F-DEBATE-4.md` are both on `main`, and the behaviour is test-pinned at `tests/unit/debate/render/poll.test.tsx` — cadence `:144`, suspension `:196`, stop rule `:280`. **B3 is CLOSED** |
| **Invariant obligations** | **All five.** Frozen side badge · position marker (default none) · **no vote affordance** *(pre-verified: zero interactive; thumb glyphs are `aria-hidden` static SVG)* · mandatory comment on buy *(pre-verified: one submit path, three client belts + a server belt)* · read-only terminal *(pre-verified: nine mechanisms)* |
| **Cross-surface** | **All six** |
| **Positive criteria from ADR-0017 P3** | Order is **Top with latest-interleave**, never a selector · a badge renders **only** on a post clearing `k_lane`/`floor_lane` · **exactly one** badge per badged post (highest-margin lane) · **most posts carry none** · **"Newest" never appears as a badge** |
| **Pre-recorded** | ⚠ **RR-3 — a LIVE INV-3 pole inversion at `composer/ReplySplitBar.tsx:64,67`, class F, owned here.** The file carries a *correct* side-keyed pole at `:118-122` and a *fixed* `bg-no` track + `bg-yes` fill at `:64,:67` with no side keying, while `postSide` is a prop of the same component. On a NO post the Support share renders black where canon says white. **Founder-ruled: not a styling item** · **PD-3-01** `PriceBar`'s `detail` preset is a named transitional value; d5 specifies 14px/10px · **PD-3-02** `SideBadge` can carry the entry price with no further primitive change — render it **RAW**, it is already the bought side's price · R1 · R4 · R5 · R6 · R10 · R14 · **no `loading.tsx`, `error.tsx` or `not-found.tsx` on this route** — verified 2026-08-10; `(public)/not-found.tsx` one level up does catch `notFound()` from here |
| **MEDIA.2** | ⚠ **NOT BUILT — the question is answerable and the answer is no.** No `MEDIA.2` plan or log exists; every `market_media` consumer in `src/` is admin-side or Discovery-side, with **zero** under `src/server/debate-view/` or `src/components/debate/`. **POLISH.3 does not absorb it.** If it is ever built it is a build row with its own founder eyeball at PR (W2.9, design-at-build) |

### POLISH.4 · Composers + Sell module

| | |
|---|---|
| **Scope** | Composer-specific criteria **only** (P8). Composers mount on `/m/[slug]`; the sell module on `/u/[pseudonym]`. **Host chrome belongs to .3 and .5** |
| **Machine phase** | **NOT RUN.** Gate B1 is **CLOSED** — the surface is gated in |
| **Components** | `BetComposer` · `SlotHeader` · `PositionStrip` · `ReplySplitBar` · `SellModule` · `copy.ts` · `payload.ts` · `requests.ts` · `ImageAttach` · `ErrorStrip` · `AuthGateSlot` |
| **Build row** | UI.A2 (substrate) · UI.A3 (composers) · UI.A5 (sell mount) |
| **Tier 4** | `DESIGN_W2_8_entry_mockup-v0_1.html` · `DESIGN_W2_10_sell-and-clamp_mockup-v0_1.html` · the composer modules in `surface_d5_v1_0.html` |
| **Tier 3** | `docs/plans/UI-A2.md` (SG-1…SG-7 — **note SG-3 is superseded as encoding by ADR-0034 D-5**) · `docs/plans/UI-A3.md` (the relation→side derivation matrix; note its SG-3 is a *different* SG-3) |
| **Tier 2** | canon §4 **rulings 2+3** — Option A: no slippage warning, no tolerance control; price-impact modal **named-retired**; **sell is never clamped**; cap clamp **buy-only** · canon §7 item 2 (split-bar triggers · **composer opens in the opposite slot**) · item 3 (**Đ BET** app-wide) · values-log §1 item 4 (engaged-slot backlight) |
| **Tier 1** | SPEC.1 **INV-1 / INV-2 / INV-3** · §10.8 display rules (DROUND) · **F-BET-9** slippage-warning UI retired (PR #225) · **ADR-0013** ⟐ · **ADR-0015** ⟐ · **ADR-0031** ⟐ · **ADR-0014** ⟐ |
| **Invariant obligations** | Mandatory comment on every buy · sell is the only comment-free action · single-side UX · side **minted** at composer-open, immutable per instance |
| **Cross-surface** | **"Đ BET"** *(pre-verified — `copy.ts:40,43`)* · side badge |
| **Pre-recorded** | ⚠ **RR-3 is co-owned here** — `ReplySplitBar` is a composer component. `.3` and `.4` must not both fix it; whichever runs first takes it and the other records the adoption · R11 sell hidden-vs-disabled (the decision is server-side; the render is .5's) |

### POLISH.5 · Profile (`/u/[pseudonym]`)

| | |
|---|---|
| **Surface** | `/u/[pseudonym]` — server async, **has `loading.tsx` and `error.tsx`**. Owner and visitor arms differ **at the DTO** |
| **Machine phase** | **NOT RUN.** Gate B1 is **CLOSED** — the surface is gated in |
| **Components** | `IdentityCard` · `ProfileTiles` · `ProfileGraph` / `ProfileGraphCard` / `ProfileGraphOverlay` / `ProfileChart` (+`FlipMarker`) · `PositionsTable` · `ArgumentList` · `profile/states.tsx` |
| **Build row** | UI.A5 |
| **Tier 4** | `surface_profile_v1_0.html` |
| **Tier 3** | `docs/plans/UI-A5.md` (+ plan-v2) — carries the design-authority digest and the **off-repo graph-layer port** note |
| **Tier 2** | canon §2 — two bands, identity card + **six tiles** + graph slot; Positions table + the **argument replica** (D5-synced; reply replica keeps its footer) · canon §5 motion — sell slide, replica footer a **fixed 50px box**, translateY 110% + fade over **.26s**, never reflows; `:has()` **banned** · canon §6 copy · **W2.6 records** — fixed 0–10,000 cumulative Y · expanded default Cumulative + market filter · per-market autoscale · nodes = own posts+replies, expanded only · flip/exit marker · x-domain **Sep 15 → Nov 5 2026**, endpoint labels only · **W2.13 R2** — remove the profile download-card icon, **keep** the bookmark icon |
| **Tier 1** | SPEC.1 **§23** Net P/L + Đb basis ⟐ · §10.8 ⟐ · **ADR-0011** ⟐ · **ADR-0032** · **ADR-0034 D-7** — this read model is **outside** the debate rule |
| **Invariant obligations** | Position marker · frozen side badge · read-only terminal |
| **Cross-surface** | Side chip · position marker · "Read more" *(R4)* · read-only terminal |
| **Pre-recorded** | ✅ **DISCHARGED at commit 0, 2026-08-14 — the six `POLISH-register-ADDITIONS.md` §A rows are APPLIED as `PD-5-03` … `PD-5-08`.** ⚠ **The old warning was an OMISSION, not merely stale**: it said the table "looks empty" and named only the six unapplied rows, while `PD-5-01` had occupied it all along. The table now carries **seven** rows. ⚠ **`PD-5-08` (`P5-e(ii)`) arrived `accepted-divergence`/`closed`** by founder ruling P12 — do not re-open it. ⚠ **`PD-5-07` (`P5-e(i)`) is `.5`-RAISED / `.4`-OWNED in its L-7 half** — `c2Strip` lives in `debate/composer/copy.ts`, POLISH.4's file · ⚠ **`W2.13 R2`'s icon delta did NOT land. `PB-1` is POLISH.5 item 17, PR A commit A8 — owner-only, bookmark ONLY, never the download icon** · **RR-4 — `PositionMarker` outline → filled is a founder-ACCEPTED delta**, not a fresh finding; inspect the consolidated state · R8 (`ProfileLoading` — now governed by P7) · R9 · R11 · R12 · **PD-0-18 the empty Dharma graph is `superseded`/`data-blocked`, NOT a defect** — the x-domain is hard-pinned Sep 15 → Nov 5 · **PD-0-17 header 1,000 vs composer 1,010 is NOT a defect** · verify the **W2.13 R2** icon delta actually landed |
| **Do not run in parallel** | GRAPH-DEFER · GRAPH-PERF |

### POLISH.6 · Bookmarks (`/bookmarks`)

| | |
|---|---|
| **Surface** | `/bookmarks` — server async, **has `loading.tsx` and `error.tsx`** |
| **Machine phase** | **NOT RUN.** Gate B1 is **CLOSED** — the surface is gated in |
| **Components** | `BookmarkCard` · `bookmarks/states.tsx` · ⚠ **`UnbookmarkButton`**. ⚠⚠ **VERIFIED AT COMMIT 0, 2026-08-14, AND THE CELL WAS INCOMPLETE BY ONE — a class-S finding under `POLISH-SURFACE-TEMPLATE.md` §2.** `BookmarkCard.tsx:9` imports and `:35` MOUNTS `UnbookmarkButton`, so it is on this surface's render tree and was unnamed. ⚠ **`BookmarkToggle.tsx` is the FOURTH file in `src/components/bookmarks/` and is deliberately NOT added here** — every consumer is under `src/components/debate/**`; it is co-located with this surface but belongs to another. **Directory membership is not surface membership**, and the two files omitted from this cell fail that test in opposite directions |
| **Build row** | UI.A6 |
| **Tier 4** | **No mockup of its own — correct, not a gap.** Canon §1: W2.7 needed *"no still — the page lives in the v1.0 shell."* The baseline is the **bookmark reuse-mode inside `surface_profile_v1_0.html`**. State this at kickoff or .6 stalls hunting a file that was deliberately never made. ⚠ **ONE MEASURED QUALIFICATION, and it changes what the baseline proves:** the v1.0 integration shell's "Bookmarks page" **IS the Profile blob re-rendered** — `FRAMES.bookmark = 'profile'`, and the shell's own comment reads *"a SEPARATE page that reuses the profile blob (no duplicated source)."* ⇒ **The shell shows Profile's chrome because it IS Profile, not because bookmarks was ever specified to carry it.** The row's claim stands; ⛔ **a reader must not infer a structural baseline from it** |
| **Tier 3** | `docs/plans/UI-A6.md` — **⚠ §11 `:251` is OVERRIDDEN by ADR-0034 D-6** (placement clause only; `:242`, `:248`, `:254` stand) |
| **Tier 2** | canon §4 **ruling 1** — bookmarks cover **only others'** posts/replies; **Staked / Current are the bookmarked AUTHOR's figures**, not the viewer's · canon §7 item 7 — download icon is **visual-only** |
| **Tier 1** | **ADR-0032** — invariant-neutral: comment-free but no stake and no position · **ADR-0034 D-7** — `bookmarks/list.ts` is viewer-keyed, feeds no export, sits **outside** the debate rule |
| **Invariant obligations** | Frozen side badge · position marker · read-only terminal |
| **Cross-surface** | Side chip · position marker · "Read more" *(R4)* |
| **Pre-recorded** | ⚠ **`/bookmarks` IS UNREACHABLE — zero href literals in all of `src/`.** The route is live and auth-gated and orphaned from the navigation graph. **POLISH.5 item 17 (`PB-1`) closes it in PR A**, by founder ruling 2026-08-13 reversing `D10` for that item alone. ⛔ **Until PR A merges, no founder pass on this surface is performable** · ⚠ **`BookmarkCard`'s side chip inverted the pole and was FIXED at DISCOVERY-COMPLETE C4** — do not re-file it · **RR-4** as above · R8 · R9 · R12 (cosmetic remainder only) |

### POLISH.8 · Admin Centre

⚠ **Corrected at the POLISH.8 close-out, 2026-08-12.** Seven class-S findings were filed against this row at recon and all seven are fixed below: the route count, the missing route handler, the Components cell, the tier-3 path, the absent SPEC baseline, the control set, and the invariant proof's phrasing. Register rows `PD-8-20` … `PD-8-25`.

| | |
|---|---|
| **Surface** | **8 routable entries** — 7 pages + **1 route handler**. `/admin` (pure `redirect`, no UI) · `/admin/login` · `/admin/markets` · `/admin/markets/new` · `/admin/markets/[marketId]` · `/admin/moderation` · `/admin/moderation/audit` · **`POST /admin/markets/media/sign`** (`markets/media/sign/route.ts`, MEDIA.1 / ADR-0027). ⚠ The row said "7 routes" until 2026-08-12; the handler was never listed |
| **Machine phase** | ✅ **RUN — PR #323, merged `f6d9775`, 2026-08-12.** 6 shipped · 2 halted · 1 superseded · 21 routed. Four Gate C reads. Log: `docs/logs/POLISH-8.md` |
| **Structural note** | **There is deliberately no `(admin)/layout.tsx`** — an admin layout would wrap and therefore loop the in-group `/admin/login` page. Each page renders `<AdminTabs>` itself. **Consequence: admin has no `GlobalHeader` and no shell.** §7's shell criteria are **exempt here** — otherwise eight checks read as failures. Verified three independent ways at recon, including a positive control finding all 10 such files elsewhere under `src/app` |
| **Components** | **16 at head.** Named originally (7): `AdminTabs` · `CreateMarketForm` · `TerminalActions` · `ReviewFeed` · `NeedsResolutionCount` · `SearchForm` / `AuditRow`. ⚠ **Omitted and verified present (8):** `BanIndicator` — **the component that holds R7, this row's own pre-recorded delta** · `ReasonBadge` · `CategoryChips` · `ImageWithheld` · `Field` · `SearchResultRow` · `ActionForm` · `Row`. **Added by #323 (1):** `InvalidDateNote`. Two colocated non-component logic modules sit outside both lists: `countdown.ts`, `terminal-actions-logic.ts` |
| **Build row** | UI.6 (PR #262, merged `0587ca2`, 2026-07-22) |
| **Tier 4** | **NONE** — ratified at P9. Corroborated independently by tier 2: `design-language.md` §7 item 2 schedules admin's visual language as its own later pass, so there is no ratified visual baseline to port from |
| **Tier 3** | `docs/plans/UI-6.md` + **`docs/logs/UI-6.md`**. ⚠ This row cited `docs/logs/UI-6-log.md` until 2026-08-12; **that path has never existed**. The corpus convention is a shared stem |
| **Tier 2** | `design-language.md` §7 item 2 — *"The admin hub and inline moderation surfaces get their own visual language — deliberately distinct from participant surfaces, reinforcing the structural rule that admin is not a participant."* ⚠ **What it licenses:** admin's visual language is scheduled and undesigned, so an aesthetic observation here can name no baseline and is class **S**, not V |
| **Tier 1** | **SPEC.1 §15** — the two-tab Admin Control Centre and its F-ADMIN-n obligations. ⚠ **This is the FUNCTIONAL baseline and the row omitted it entirely until 2026-08-12**, listing five ADRs and no SPEC · **ADR-0010** (admin auth, two-layer) · **ADR-0020** (`superseded` by 0021; the decoupling survives, the held queue does not) · **ADR-0021** (reactive moderation — the governing model) · **ADR-0027** (admin media direct upload, no moderation) · **ADR-0028** (moderated-image byte-identity binding; participant-path, no `(admin)` consumer). ⚠ **None of the five carries a patch record** — verified, count 0 in each. §8's *"patch records before decision bodies"* has nothing to read here |
| **Baseline (P9)** | Token consistency + functional completeness + **one hard invariant check: no bet, comment or position affordance exists anywhere under `(admin)`.** ⚠ **There is no mockup, so there is no parity criterion here.** §7 criterion 1 does not apply |
| **Invariant check** | ✅ **RE-VERIFIED AS A MEASUREMENT at the POLISH.8 recon, not inherited.** Two arms, each with a positive control. **ARM 1 · structural:** `users` has 15 columns and no `role`, no `is_admin`, no admin flag; admin auth is a separate tree (`src/server/auth/admin/**`) with its own `admin_sessions` table (no `user_id` FK) and its own cookie; admin actor identity is a JSONB string (`metadata.actor_id = 'admin-singleton'`, `metadata.user_id = null`) enforced by `assertAdminActor()` before any transaction opens. **ARM 2 · surface:** a transitive import walk from `(admin)` closes at **105 modules**, of which exactly **2** reach `src/components` — `debate/format.ts` (pure formatters, no JSX) and `debate/types.ts` (type-only, zero runtime exports). Positive control: the same four-name probe returns **46 hits** under `(public)`. **The control set is 13, not 6** — the original six mutating groups plus **audit search**, **media sign** and **admin sign-out** (built, and reachable from nothing — `PD-8-15`). ⚠ **The old proof sentence — *"every `debate/` component … imported only from `(public)`"* — was TRUE of components and FALSE as a directory-scoped statement**, and `ReviewFeed.tsx:22-25` claimed in-file to share *"ZERO product components"* while `:6` imports one. **The invariant HOLDS; the sentence proving it did not survive checking.** `PD-8-20` |
| **Pre-recorded** | R7 — `text-white` at `audit/page.tsx:75` — ✅ **CLOSED at `92c401b` (#323).** `text-background`, the pairing the sibling BANNED pill already used. Not cosmetic: `--destructive` maps to `--color-n6` on a dark→bright ramp, so `#fff` sat at ≈1.9:1 on the indicator that tells the operator an author is banned; `text-background` is ≈9.6:1. **B12 closes. `PD-0-07` closes.** ⚠ It also removed R15's only live instance — see §0 · **CC-9** — the `ReviewFeed.tsx` side chip — ✅ **PINNED, deliberately NOT consolidated** (founder ruling, 2026-08-12). It stays hand-rolled; a two-pole render test now binds YES→`bg-yes`/`text-no` and NO→`bg-no`/`text-yes`, each pinning the opposite pole's absence, RED-proven on two mutation classes. Consolidating would have moved admin chrome toward participant primitives against tier 2, and would have broken PRIMITIVES-2 D5's zero-call-sites guard. `PD-8-02` · **X4** — audit-feed pagination — **ACCEPTED for the experiment phase**, conditional on `AUDIT-ORDER-TOTAL`. `PD-8-18` |

### POLISH.7b · Onboarding deck + coach-marks — ⛔ blocked

| | |
|---|---|
| **Scope** | The **6-card deck** and the coach-mark guide. **Not** the `/onboarding` page, which is 7a |
| **Tier 4** | `DESIGN_W2_2_onboarding-deck_mockup-v0_1.html` — **O1-DECK is actively re-editing it**, so the baseline is in motion |
| **Tier 2** | canon §7 item 9 (W2.2) — the deck teaches **INV-1/2/3 + the Goal**; **INV-4 and admin-not-a-participant deliberately live in the About/Rules tab, not the deck**. Deck is **not skippable** on first login |
| **Blocked on** | O1-DECK · O1-GUIDE (design first; build gated on a spec line **and an `intro-seen` migration** — DDL, full ritual) |
| **⚠ Schedule note** | **RULES was a ratified omission from the header at UI.A1**, and O1-DECK *"also serves Q8 About/Rules via the re-show tab."* So the full invariant set's only user-facing home sits behind **O1**, on an experiment whose claim rests on participants understanding the rules. O1 now carries a docket row (`O1-KICKOFF-INPUT`); it still needs a date |

### Surfaces with no POLISH row — named, not skipped

| Surface | Status |
|---|---|
| **The 404 surface** | ⚠ **CORRECTED — it EXISTS.** `src/app/not-found.tsx`, `src/app/global-error.tsx` and `src/app/(public)/not-found.tsx` all landed at `acc2e03` (#283, 2026-08-02). `notFound()` no longer lands on Next's default page. **R3 discharged; B10 closed.** It has no POLISH row of its own and inherits POLISH.1's shell criteria |
| **Market-media carousel (MEDIA.2)** | ⚠ **CORRECTED — NOT BUILT**, and the question was answerable in one grep. See POLISH.3's row. It is a build row, not a POLISH row |
| **UI.15 debate `.md` download** | Route exists (`src/app/(public)/m/[slug]/export/route.ts`); acceptance not demonstrated. B5. Not a gate for any surface |
| **UI.1 Landing · UI.7 Leaderboards · UI.8 OG cards** | Mockup **and** SPEC line present → CC builds, **polished at its own build**. Either missing → spec-first, not build-ready |
| **UI.10 ToS/Privacy** | Gated on LEGAL.1 ← HARDEN.6, founder-deferred |
| **UI.14 share card** | SPEC-blocked. Its supersession row belongs to that build |
| **UI.17 radio** | The slot renders; the feature is SPEC-blocked on SPEC.1 §21.5. `.1` inspects the **slot** |
| **UI.18 feature guide** | W2.12 descoped; re-scoped into O1-GUIDE |
| **The freeze banner** | ⚠ **Its own task, not a POLISH surface.** Gated on the **SPEC.1 §21.7 rider**, which is `RESERVED` and unwritten. It renders only when the experiment is frozen (2026-11-05), so it is not inspectable inside the POLISH window even if built |

---

## §4 · The defect record

**Home:** `POLISH-register.md`, standalone, web-authored (P3). Committed 2026-08-05. GitHub is canonical; PK is the mirror. The tracker sequences phases, not defects; nine surfaces × N defects would drown it. GitHub issues fragment a lane that runs without CC. The register emits **batched** rows into the tracker at each surface close.

**ID:** `PD-<surface>-<nn>` — e.g. `PD-3-07`. Stable forever; never renumbered, never reused.

**Fields:**

| Field | Values |
|---|---|
| `id` | `PD-<surface>-<nn>` |
| `surface` | POLISH.1 … .8 |
| `title` | one line |
| `class` | **V · F · B · S · R** (§5) |
| `disposition` | `routed` · `superseded` · `data-blocked` · `duplicate-of-known` · `accepted-divergence` · `inherited` |
| `status` | `open` · `routed` · `fixed` · `verified` · `closed` |
| `evidence` | capture filename(s) + `file:line` where known |
| `baseline` | the tier and document the defect is *against* — a defect with no baseline is class **S**, not V |
| `root_cause` | optional; groups symptoms of one cause across surfaces |
| `routed_to` | the PR, tracker row, spec halt, or ruling. **This field also carries origin** — `POLISH.2 C3`, `DISCOVERY-COMPLETE C8` — which is how the row's provenance is read |

**The `baseline` field is load-bearing.** If an inspector cannot name the tier and document a thing violates, it is not a visual defect — it is a spec gap. That test is what keeps POLISH from becoming taste.

**On `origin`.** An `origin` field (`0` · `M` · `E`) was specified at POLISH-STRATUM and **never adopted**. The live register has no such column and 65 rows would need backfilling to add one. It is **not part of this schema**; `routed_to` carries provenance instead.

### ⚠ §4.1 · Schema drift, measured 2026-08-10

The schema above is not enforced by anything. As measured across 65 rows:

- **`class` carries 10 distinct values** against a 5-value vocabulary. `V · F` and `S · F` are dual-class; `V · A11y` invents a sixth letter; `F` and `**F**` are the same class spelled two ways.
- **`disposition` carries `inherited`**, minted at #312 and previously undefined. It is now defined above: *a row filed against surface X but owned by surface Y, recorded so Y does not rediscover it.*
- **`status` carries 26 distinct spellings** against 5 defined values. `verified` is never used; `routed` never appears as a status; `data-blocked` — a disposition — appears in the status column.

**Rules that follow, binding on every future row:**

1. `class` takes **exactly one letter, unbolded** — or `—` where the row records a **non-defect** (disposition `superseded` or `data-blocked`). A defect that is genuinely two things is **two rows** with a shared `root_cause`. Rows minted before 2026-08-10 that carry dual values are grandfathered and named at their table; §4.1 binds every row minted after.
2. `status` takes exactly one of the five defined values. Anything else goes in `routed_to`.
3. A row is never appended below a blank line. **Three rows currently sit outside the table body and are invisible to every parser and to GitHub's renderer** — including the only open class-F production defect.
4. **A row is authored against the table it lands in, and the column set is named.** ⚠ **Minted 2026-08-12, after two blocks of a ratified apply-pack were authored against the wrong table's shape.** One was an 8-cell row aimed at **this file's 9-column POLISH.3 table** (`ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to`), having silently inherited the 8-column PD-0 shape from a sibling block in the same pack; its fifth cell carried a *Surfaces* value into an *Evidence* column and it had no *Root cause* cell at all. The other was a markdown **bullet** aimed at a two-column table in `docs/parked.md`, which would have terminated that table and created exactly the fourth orphaned row **rule 3** exists to prevent. **This file holds more than one schema, and so do others.** Any instruction that writes a row — here or anywhere — **states the column set it assumes**, and that set is verified against head before the row is written. **Naming the assumption is what makes a mismatch visible:** the one block in that pack that named its columns passed verification instantly, and is the only reason the defect in the block that did not was detectable before it shipped.

---

## §5 · The routing taxonomy

**Class** — what kind of defect it is. **Disposition** — what happens to it. They are orthogonal.

| Class | Definition | Route |
|---|---|---|
| **V** | Visual — token usage, spacing, type, layout | Design-lane batch, **one surface per PR, never cross-surface** so a regression bisects to a surface. Ultracode-eligible |
| **F** | Functional — the affordance exists and does not work | Code-lane row, normal gates |
| **B** | Backend gap — the surface cannot be correct without a missing read model, endpoint or invariant | Code-lane row. **Full ritual if it touches auth · engine · ledger · moderation** |
| **S** | Spec gap — no ratified spec for what it should do | **SPEC-FIRST halt. No build.** |
| **R** | Ruling needed — a missing product decision | Founder |

**B and S are never fixed inline during a visual pass.**

| Disposition | Meaning |
|---|---|
| `routed` | sent to its class's destination |
| `superseded` | cited against §2.1 bucket A — logged, never becomes work |
| `data-blocked` | unjudgeable because the fixture set cannot produce the state; names its §3 reason in the data manifest |
| `duplicate-of-known` | already recorded in §3's pre-recorded rows or the ruling index |
| `accepted-divergence` | **founder only** (P12). Appends to canon §10 |
| `inherited` | filed against one surface, owned by another; recorded so the owner does not rediscover it |

### §5.1 · The ADR-0034 D-1 guard — **R17, ruled 2026-08-10**

> **Any defect whose fix would add a field to `DebateViewModel`, or to any type it transitively contains, is RE-SCOPED, not built — regardless of its class letter and regardless of which surface filed it.**

**The check keys on the property, not on a class letter, and that is deliberate.** In this corpus `B` means three different things: the register class *backend gap*, POLISH.2's transient delta lane *log*, and the gate IDs `B1…B12`. A guard phrased as *"any B-class defect"* is one ambiguity away from being skipped on the exact surface where it matters.

D-1 exists because `DebateViewModel` is the input type of the public 2026-11-06 export (ADR-0025), and because viewer-independence is what makes content-removal masking **structurally** safe rather than merely tested. A reviewer answering this must answer **per clause, as separately-stated points — never a bare PASS.**

### §5.2 · Delta identifiers

A *delta* is a difference found by a machine pass, before it becomes a register row. Deltas are **transient**: they exist between the recon and the plan, and die at ratification when they become `PD-<surface>-<nn>`.

**Delta IDs take the form `<SURFACE>-D<nn>`** — `P2-D13`, `P7a-D04`. Not bare `Vn`.

Bare `Vn` collided three ways: `V13` a Discovery delta, `V-5` a verification lesson in the data manifest, `V` a register class — separated only by a hyphen. Historical POLISH.1 and POLISH.2 artifacts use `Vn` and stay readable as written; the mapping is `Vn` ≡ `P<surface>-D<nn>`.

**No other classification vocabulary is minted.** A machine pass classifies deltas with `V/F/B/S/R` and dispositions them with the table above. POLISH.2's transient `A/B/C/D` lanes are retired; the behaviour they encoded is the standing disposition in `POLISH-SURFACE-TEMPLATE.md`.

### §5.3 · Gate C

**A web diff-read before merge, on every machine-phase PR, without exception.** Not `.3` and `.4` only.

The evidence is one-sided and comes from three surfaces:

- **POLISH.1** — `V9` shipped **half-applied**. A hand-built still could not catch it (*"it validates the intent, never the implementation"*); no test pinned either class, so all 2139 passed and `just verify` was green. *Both green gates were true and both were blind.* Only reading the diff caught it.
- **POLISH.2 Gate C** — the `V13` CRITICAL: a market-scoped figure shipped under a ruling that said post-scoped, rendering `Đ 1,000 → Đ 4,221` on a public surface under a named pseudonym.
- **POLISH.2 Gate C** — the `V17` CRITICAL: a **live INV-3 pole inversion** on the NO hero panel, invisible to every test because every fixture rendered `no: null`.

Three surfaces, three green suites, three real defects. **A green suite is not a gate.**

---

## §6 · Order and gates

**Order, amended 2026-08-10:** `.7a auth → .3 Market Detail → .4 Composers → .5 Profile → .6 Bookmarks → .8 Admin`, with `.1` and `.2` already machine-complete and `.7b` blocked on O1.

Auth first because it is the cheapest surface in the set and has no gates. Shell-first was the original rationale — shell defects replicate onto every other surface — and it was **discharged, not abandoned**: POLISH.1's machine phase ran at #288/#289/#290 before any other surface was touched.

### The gate state, recomputed against the repo 2026-08-10

| Surface | Gates as originally written | Verified state |
|---|---|---|
| **.1** | B4 · B8 · B10 | **B4 VOID** (withdrawn, SPEC.1 v1.0.26) · **B10 CLOSED** (#283) · **B8 STRUCK** — see below. **Gate-clear** |
| **.7a** | none | ships now |
| **.2** | B2 | **CLOSED** (#276) |
| **.3** | B1 · B2 · B3 · C3 | **all four CLOSED.** C3 since 2026-07-31 |
| **.4** | B1 | **CLOSED** |
| **.5** | B1 | **CLOSED** |
| **.6** | B1 | **CLOSED** |
| **.8** | none | ships now, pullable forward |
| **.7b** | O1 | ⛔ blocked |

**Eight of nine surfaces are gate-clear.** The original gate line implied four blocked surfaces; three of those four blocks had already evaporated when it was written.

### ⚠ B8 is struck from POLISH.1's gate list

B8 is the P4 global freeze banner. `SPEC.1 §21.7` is a **RESERVED** stub — *"Not yet written. B8 (freeze banner) is gated on this section and must not be built before it lands."* POLISH does not edit SPEC (§9), so **POLISH structurally cannot close its own gate.**

It was never a real prerequisite. The banner renders when the experiment is **frozen** — 2026-11-05, seven weeks after every POLISH surface must be closed. It is not inspectable inside the window even if built. Holding a surface for a component that cannot render is pure cost.

The banner is recorded on `.1`'s row as a **named spec-blocked exclusion**, and the §21.7 rider carries its own dated docket row.

### The phase shape — amended 2026-08-10 (D-D)

**Every machine phase runs first; one comprehensive founder visual pass then runs across the whole product; refinement PRs follow.** This reverses the original per-surface *machine → eye → next surface* sequencing, and the reversal is recorded here rather than left implicit.

**What the reversal costs.** The original rationale was a feedback loop: the eye pass on surface *n* teaches what the machine missed, and that feeds surface *n+1*'s relay. Batching discards it. **It is recovered by obligation instead of by sequence:** every machine phase's close-out must emit a *"what the machine read missed"* line, and the next surface's relay must carry it.

**⚠ The revert trigger.** The deferral is safe **only because** shared visual decisions land as **named presets**, so a later founder ruling is one line per preset rather than a six-surface sweep. **If PRIMITIVES-2 inlines the secondary text tier or the emphasis ladder instead of landing them as named presets, that safety property is gone and the batched pass must be revisited.** A ruling with no revert condition is a one-way door.

**⚠ The pass is not the end of the lane.** One visual pass across six surfaces produces a **backlog** across six surfaces, and those refinement PRs need build time before 2026-09-15. The tracker carries a window for them.

**Environment (P5):** staging. **Capture (P10):** one PNG per state, `POLISH-<n>_<surface>_<state>.png`, pinned viewport **1440 desktop**. Operator-local; the register cites filenames.

---

## §7 · The per-surface exit bar

A surface closes when all of the following hold.

1. **Parity** with its baselines on layout, type and spacing — subject to §2.1, and read in tier order per §2. *(Does not apply to POLISH.8, which has no tier-4 baseline by ratification at P9.)*
2. **Every invariant-visual obligation present** (`design-handoff.md` §4): frozen YES/NO side badge on every post/reply, never changing · position marker none/Flipped/Exited, **none is the default** · **no vote affordance anywhere** · mandatory comment field on every buy, sell the only comment-free action · single-side UX, and resolved/voided/frozen render read-only.
3. **Every interactive affordance functional end-to-end.**
4. **All states rendered** — per **W2.11's kit, now P1–P7**, and its placement table, not an ad-hoc list. **P7 is the loading primitive minted at R8** (`ui/loading-block.tsx`, DISCOVERY-COMPLETE C10, canon amended in the same commit). ⚠ The state-ledger CSV is **absent from the repo** — confirmed 2026-08-10, no such file has ever been added — and the 14 build items are pinned from the W2.11 close-out. **Recorded as lost; do not stall on it.**
5. **Cross-surface criteria**, on every surface that hosts the primitive: **"Đ BET"** · **"Read more"** · frozen side badge · **no vote affordance** · position marker default-none · read-only on terminal states.
6. **Token usage**, not value. Value is CI-guarded (`tokens-monochrome.test.ts` pins the 11-token hex census R=G=B, exact pins on poles/ground/graph/destructive, bans `--color-brand`). POLISH checks the gap CI misses: raw literals and wrong semantic slots. ⚠ The guard does **not** catch Tailwind palette classes — **R15** closes that, and R7 is its one live instance.
7. **Pole binding on both sides.** `tests/unit/design/side-pole-binding.test.ts` catches **routes 1 and 2 only** and says so in its own docstring. **A green C0 is not completeness.** Route 3 — a fixed pole colour on a per-side element — has no static detector and is closed by review plus **per-pole render tests that assert BOTH a YES and a NO instance.** A YES-only test passes on an inverted NO panel; that is exactly how V17 survived a full PR.
8. **Out of scope by ruling, never filed:** viewport and responsive findings (**G1 — desktop only, 1440, no mobile**). A responsive observation takes disposition `superseded` citing G1.

**Closing status — R16, ruled 2026-08-10.** Surfaces close as **`closed (a11y-deferred)`**, and that qualifier **stands** for the experiment phase. A11Y.0 carries a dated docket row with a named scope — keyboard reachability, accessible names, visible focus — and WCAG 2.2 AA is scoped past the experiment. The qualifier is honest rather than aspirational: four a11y findings already route to A11Y.0 from surfaces that have run.

---

## §8 · Per-surface kickoff procedure

### Step 0 — verify, do not read

**Before anything else, verify against the live repo every gate, every absence, and every named source this document asserts for that surface.** Report each as TRUE, FALSE, or UNVERIFIABLE with evidence.

**This is the rule this document itself broke, and the reason step 0 exists.** As committed on 2026-08-05, `POLISH-0.md` asserted that C3 was uncommitted (it landed 2026-07-31), that `not-found.tsx` existed nowhere (it landed 2026-08-02), that B4 was a live gate (it was withdrawn 2026-08-02), and that MEDIA.2's build status was unconfirmed (it was answerable in one grep). Four false claims, three of them already false on the day the file shipped — in the document whose own §8 says *"a listed dependency is not a completed one."*

A citation is not an artifact. A gate listed is not a gate closed. A source named is not a source that exists.

### Then read, in this order

1. Its **tier-1** documents — **patch records first**, then the decision body.
2. Its **tier-2** rows in §3.
3. Its **tier-3 build-law**: `docs/plans/<SLOT>.md` and its plan-phase and execute close-outs.
4. Its **tier-4** mockup.
5. §2.1's supersession list, §3's pre-recorded rows for that surface, and §0's ruling index.

**Why step 3 exists.** At POLISH.0, four apparent divergences were investigated. Three resolved on documents outside the original four tiers: the auth page↔modal ruling in `UI-A7.md`, the About/Rules ownership in the UI.A1 close-out, and the ranking-selector retirement in ADR-0017's patch record P3. Only one — "Read more" — was a genuine defect. **An inspector who skips step 3 will file three false defects for every real one.**

Finally, confirm no build PR is open against the surface.

---

## §9 · What POLISH does not do

No code beyond the machine phase's declared edit boundary · no PR outside the surface's own · no DDL, migration, event type or ADR · no SPEC edit · no rewriting `design-handoff.md` or `design-workflow.md`.

> **Amended at POLISH.2 (2026-08-09).** A **CC machine pass** — read the tier-4 mockup against the build, emit a classified delta list, ship the pre-approved deltas under a standing disposition — **is part of the method**, and runs *before* the founder's visual inspection rather than instead of it. Precedent: the `POLISH-1-D` delta recon behind POLISH-1a (`docs/logs/POLISH-1a.md:6`). The exclusions above describe the **founder's inspection**; `no CC session` was already falsified by POLISH-1a (#288) and POLISH-1b (#289) when it was committed here, and is struck.

Not re-litigated: W2.7 bookmark semantics · W2.10 slippage Option A · the brand accent (ratified **OUT**, true-neutral) · Social/Research (accepted divergence, founder-deferred) · G1 desktop-only.

Explicitly out: **`MOD-REPORT-PATH`** — ADR-0021's reactive pipeline needs a user-facing trigger and none is designed; CD-A stripped REPORT from the pop-up and no policy decision recorded that user reporting is out of scope. It is child-safety adjacent with real lead time. **It now carries a docket row.** POLISH.3 inherits a decision; it does not discover a hole.

Also out, each with a docket row: **A11Y.0** · **the SPEC.1 §21.7 freeze-banner rider** · **PRIMITIVES-2** · **SPEC.CHART** · **ADR-0006-DISCIPLINE**. Also out: O1 · HARDEN.6 · PFP.1 · UI.14 / SPEC.SHARE.

> **Standing rule, minted 2026-08-10.** **A routing destination named in a committed document must have a row in `docs/parked.md` landed in the same commit.** Six destinations were named across this corpus with no plan, log, row, owner or date — and two were load-bearing: A11Y.0 gated every surface's closing status, and SPEC.CHART was cited as a tier-1 source. A phantom prerequisite is worse than a deferred one.

---

## §10 · Patch record

**Amended in place 2026-08-10 IST at the POLISH-TEMPLATE task. Ratified by Hrishikesh. Committed by CC.**

### Why in place rather than by supersession

Every *"Pending Rn"* marker lived **inside this document** — §2 and §8 (R18), §5 (R17), §7 (R8, R16), §2.1 (R4, R10), §2.2 (R19). Landing the answers in a separate file would have left the document that tells you how to run a surface still reporting *"Pending R16"* for a thing that was ruled. That is the CD-documents failure exactly: two documents, one superseded, both readable as current.

The project's established pattern is an in-place patch with a Patch record — ADR-0023 and ADR-0006 both took one. This follows it. **No standalone ruling register exists or will be minted.**

### What changed

| # | Change | Ruling |
|---|---|---|
| **P-1** | §0 replaced: a 5-row *pending* table became a **19-row ruling index** with `RULED` / `SCHEDULED` / `OPEN`. *Pending* is no longer a state this document uses | Amendment scope, ratified |
| **P-2** | **R18 ruled — five tiers**, plus the **existence rider**: verify a named source exists on `main` before reading it | R18 |
| **P-3** | **R17 ruled — YES, keyed on the property**, not on a class letter. §5.1 | R17 |
| **P-4** | **R8 ruled — T1 superseded.** Kit is P1–P7. §7 criterion 4 | R8 |
| **P-5** | **R16 ruled — `closed (a11y-deferred)` stands**; A11Y.0 gets a dated row and a scope line | R16 |
| **P-6** | **R19 discharged** at `54b0b2a`. §2.2 rewritten; the *"treat those two lines as void"* instruction **deleted as inverted** | R19 |
| **P-7** | **R3 discharged** at `acc2e03` (#283). The 404 surface exists | R3 |
| **P-8** | **R13 raised from pending to OPEN with teeth** — SPEC.CHART does not exist, so the chart overlay is class **S** and halts | R18's existence rider |
| **P-9** | Four false factual claims corrected: **C3 closed** · **B10 closed** · **B4 void** · **MEDIA.2 not built** | Stale-claim sweep |
| **P-10** | **B8 struck from POLISH.1's gates**; the banner recorded as a spec-blocked exclusion with its own task | Sequencing ruling |
| **P-11** | **Gate C on every machine-phase PR** (§5.3), with the three-surface evidence stated | Gate C ruling |
| **P-12** | Delta IDs become `<SURFACE>-D<nn>`; **no third classification vocabulary** (§5.2) | Vocabulary ruling |
| **P-13** | `origin` recorded as **specified but never adopted**; `routed_to` carries provenance (§4) | Schema ruling |
| **P-14** | §4.1 added — measured schema drift and three binding rules | Stale-claim sweep |
| **P-15** | §6 phase shape amended to all-machine-then-one-pass, **with a revert trigger and a backlog clause** | Phase-shape ruling |
| **P-16** | §8 **step 0 — verify, do not read**, with this document's own four failures as the worked example | Verification discipline |
| **P-17** | §7 gains criterion 7 — **pole binding on both poles**, and the standing warning that a green C0 is not completeness | DISCOVERY-COMPLETE carry-forward |
| **P-18** | §9 gains the **phantom-row standing rule**; six destinations now carry docket rows | Phantom-row ruling |
| **P-19** | Dead companion link to `POLISH-0_ruling-register_r2.md` removed from the header. `POLISH-register.md:258`, which made 14 rows resolve on that file's ratification, is corrected in the same commit to point here | R2's non-existence |
| **P-20** | **R13 RULED — `design-canon.md` §10 `C-CHART-1`.** `PD-0-16` reclassed **S → R** and closed. §0's R13 row, §2's existence rider, and §3's POLISH.3 Tier-1 / Tier-2 / Tier-3 cells all rewritten. **No spec minted; no divergence accepted** | R13 |
| **P-21** | §0's tally sentence **recounted from the table** — it had drifted in two directions at once. `POLISH-TRACKER.md` §2's duplicate copy **removed rather than synced**. §2's existence rider gains its second half: *a missing cited source does not establish a missing baseline* | Stale-claim sweep |
| **P-22** | §3 POLISH.3 Tier 3's `docs/plans/UI-19*.md` corrected to **`docs/plans/UI.19.md`** — the hyphenated glob has never matched anything in repository history | Stale-claim sweep |
| **P-23** | §4.1 gains **rule 4** — a row is authored against the table it lands in, and the column set is named. Minted after two blocks of a ratified apply-pack were written against the wrong table's shape | Schema discipline |

### Reasoning worth keeping

**On R16.** The counter-argument was real and is preserved: if the accessibility floor lands *before* the surfaces, it folds into the exit bar and is checked once per surface inside inspections that are happening anyway; if it lands after, it is a second pass across nine surfaces through the founder bottleneck. That argument was sound when written and is now unavailable — the cheap window closed when POLISH.1 and POLISH.2 ran. What replaced it is a **smaller floor that will actually be met**, on the reasoning that deferring a large floor twice produces no accessibility work at all, while a named small one folds into passes still to come.

**On R8.** T1's premise was that server render is instant, so a designed loading state is never seen. The premise is false for an async server component doing DB work — Next streams a fallback whether one was designed or not. The builders half-knew: both state files carried *"never profile-shaped fake content."* Superseding a ratified W2.11 decision was the founder's alone, and the amendment landed in the **same commit** as the code that needed it.

**On R17's phrasing.** The original wording keyed on *"any B-class defect."* It was re-cut because `B` denotes three different things in this corpus, and a guard that can be skipped by a vocabulary collision on the debate surface is not a guard. The decision is unchanged; only its trigger is stated more robustly.

**On R6, preserved because it will be re-argued.** CD-A ratified the pop-up composer believing the pop-up was the only market-view path to reply-as-bet. It is not — once R1 lands, the card carries it, and post-focus already has a live `ReplySplitBar`. Building the pop-up composer would make a third entry to one action. The recommendation was **defer and re-decide**, and the ground for it is that changed fact.

**On what could not be recovered.** POLISH.2's standing disposition was defined in an inline kickoff that was never committed. Three things are unrecoverable from `main`: what its `B` and `D` lanes meant, the full halt set (only sets 3, 5 and 6 are cited by number, and the numbering reaches at least 6), and the three pre-ratified rulings it names. The behaviour has been reconstructed from 44 committed register rows and lives in `POLISH-SURFACE-TEMPLATE.md`; the lane definitions are not needed, because the lanes are retired. **Recorded so a future reader does not mistake the reconstruction for a transcription.**

---

*v1.0-draft authored by web Claude, 2026-07-30 IST, ground `origin/main` @ `b6495af`. **v1.1 amended in place 2026-08-10 IST at POLISH-TEMPLATE, ground `origin/main` @ `35d041d`** — nineteen rulings resolved, four false claims corrected, twenty-three edits recorded at §10. Tier-1 entries marked ⟐ remain unverified candidates and are verified at their surface's kickoff under §8 step 0.*
