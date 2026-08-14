# POLISH register — rows to mint from PRIMITIVES-1 close-out

> **Paste-ready.** Rows in the exact `POLISH-register.md` schema (`POLISH-0.md` §4).
> **Not applied in place.** `POLISH-register.md` self-describes as *"PK-primary, web-authored from operator captures. **Not committed to the repo.**"* — and the only local copy (`~/Downloads/POLISH-register.md`, **mtime Jul 30 21:56**) still reads *"No surface has been inspected"* with **zero** allocated `PD-` rows, six days after POLISH.1a/1b/DOCS shipped. Editing that copy would fork a stale PK-primary doc, so the rows are delivered additively instead. Apply against the **live** register.
>
> ⚠ **The quoted header above is SUPERSEDED (2026-08-06).** `POLISH-register.md` was committed at R1 and its header now reads *"Committed 2026-08-05. GitHub is canonical; PK is the mirror."* — the opposite of the "Not committed to the repo" claim quoted here. The quote is preserved as the plan-time record of why these rows were delivered additively; it is **not** a description of the current state, and it must not be used again to route a row away from the repo. It already did that once: STAGING-PARITY Slice A routed a docket row to its session log on the strength of this header, and the row belonged in `docs/parked.md`.
>
> **IDs are PROPOSED.** `PD-<surface>-<nn>` must be allocated against the live register's high-water mark, which the stale copy cannot supply. Renumber on apply; the scheme is *never renumbered, never reused* once set.
>
> **Five rows unapplied: three (§B) + one (§C) + one (§D).** Two of §C's three were applied at POLISH.3's commit 0, 2026-08-12, and **all six of §A's** at POLISH.5/6's commit 0, 2026-08-14; all eight are struck in place below. ⚠ **The remainder is ENUMERATED, never subtracted** — `POLISH-register.md:321` records the last time a subtracted figure drifted.

---

## A · POLISH.5 · Profile — the five Gate C findings, as six rows (P5-e split)

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| ~~PD-5-nn *(proposed)*~~ → **`PD-5-03`** · **APPLIED 2026-08-14** | **P5-a** Footer guard reach — a mounted-elsewhere footer evades both arms (M-2 + F4) | F | D8's static position judgment; the guard's own reach claim | `tests/unit/shell/not-found.test.tsx` ancestry loop + `SiteFooter` name belt | routed | open | Following a mount needs import resolution — a different class of guard | Guard-hardening docket (same family as F16) |
| ~~PD-5-nn *(proposed)*~~ → **`PD-5-04`** · **APPLIED 2026-08-14** | **P5-b** Guard-reach claims overstate the mechanism (L-2 / L-3 / F2) | R | `format.ts:35-38` + the `ROUND0_RENDER` constant's own wording | `(?<!=)\{\s*round0Dharma\s*\(` matches the direct-JSX-child shape only | routed | open | Commit 5 scoped the guard file's header; two claims survive elsewhere | **Ruling: widen the regex OR scope both remaining claims** |
| ~~PD-5-nn *(proposed)*~~ → **`PD-5-05`** · **APPLIED 2026-08-14** | **P5-c** Two latent guard hazards — `floor` shorthand surface (L-4), `SiteFooter` raw-source belt (L-5) | F | R4c ratification (L-4); mechanism A's `stripComments` vs the belt's raw read (L-5) | `MONEY_IDS`; the belt's file set grew 3 → 17 in this PR | routed | open | Object-shorthand false positives; belt reads raw source while mechanism A strips comments | Guard-hardening docket — **both latent, neither fires today** |
| ~~PD-5-nn *(proposed)*~~ → **`PD-5-06`** · **APPLIED 2026-08-14** | **P5-d** `tile-identity.test.ts` has no four-digit case of its own (F3) | F | SPEC.1 §10.8 (grouping) vs the suite that owns `displayNetProfitLoss` | Proven structurally blind at **P10** — stayed GREEN with the grouping wrapper deleted | routed | open | Six tests, dedicated describe, every assertion sub-thousand | Fold in when a task legitimately opens that file |
| ~~PD-5-nn *(proposed)*~~ → **`PD-5-07`** · **APPLIED 2026-08-14** | **P5-e(i)** Two pre-existing: dead export (L-7), geometry `Number()` on a Đ string (L-9) | S | SPEC.1 §10.8 expressly rules geometry off the Đ basis (L-9) | `copy.ts::c2Strip`; `profile/graph/geometry.ts:46,68` | routed | open | L-7: re-pointing rather than removing was the correct §5.3 surgical call | **Both pre-existing** |
| ~~PD-5-nn *(proposed)*~~ → **`PD-5-08`** · **APPLIED 2026-08-14** | **P5-e(ii)** L-8 — two grouping implementations coexist with a divergent malformed branch | S | D1 **RATIFIES** the duplication; golden fixture backstops drift | `format.ts::groupInteger` guards `/^\d+$/`; `serialize.ts::formatDharmaExportGrouped` uses truthiness, no malformed guard | **accepted-divergence** | closed | Deliberate: unifying them would break the export path's zero-change property | **FOUNDER RULING (P12). DO NOT UNIFY** — see note below |

### Verbatim — Gate C verdict text, as received

> **P5-a · Footer guard reach (M-2).** A footer rendered by a component defined elsewhere and merely mounted evades both arms — ancestry never sees the element, the name belt greps one string. Inherent to D8's static position judgment; following a mount needs import resolution, a different class of guard. PLUS F4: a self-closing container before a `<footer` unbalances the count permanently, making later footers read "nested" — the FALSE-NEGATIVE direction, verified absent today. Same family as F16.

> **P5-b · Guard-reach claims vs mechanism (L-2 / L-3 / F2).** `(?<!=)\{\s*round0Dharma\s*\(` catches the direct-JSX-child shape only — not a template literal, a ternary, or a bound local. Commit 5 scoped the guard file's header; the phrase "guarded, not merely conventional" survives at `format.ts:35-38` and on the ROUND0_RENDER constant. Either widen the regex or scope both remaining claims.

> **P5-c · L-4** — `floor` widens the object-shorthand false-positive surface in MONEY_IDS; hazard pre-existed for `spendable`/`balance`/`current`/`stake`, ratified at R4c. **L-5** — the `SiteFooter` name belt reads RAW source while mechanism A strips comments, so prose naming `SiteFooter` in any of the 17 globbed files now REDs; that surface grew 3 -> 17 in this PR. Both latent, none today.

> **P5-d · F3** — `tests/unit/profile/tile-identity.test.ts` has no four-digit case of its own. Six tests, a dedicated describe for `displayNetProfitLoss`, and every assertion sub-thousand — proven structurally blind at P10, where it stayed GREEN with the grouping wrapper deleted. The grouping pin lives in `format.test.ts`; a reader working only in the profile suite sees six greens that cannot detect grouping. Fold in when a task legitimately opens that file.

> **P5-e · L-7** `copy.ts::c2Strip` is a dead export (re-pointing rather than removing was the correct §5.3 surgical call). **L-8** two grouping implementations coexist with a divergent branch — `format.ts::groupInteger` guards with `/^\d+$/`, `serialize.ts::formatDharmaExportGrouped` uses truthiness and has no malformed guard; D1 RATIFIES the duplication and the golden fixture backstops drift. **L-9** `profile/graph/geometry.ts:46,68` calls `Number()` on a Đ string for pixel geometry — §10.8 expressly rules geometry off the Đ basis. All pre-existing.

### Three notes on applying §A

**L-8 is `accepted-divergence` by FOUNDER RULING (P12), and P5-e is split to carry it.** Gate C bundled L-7, L-8 and L-9 into one row, but disposition is a per-row field and `accepted-divergence` is a strong signal — leaving it on the bundle would have read as the founder blessing the dead export (L-7) and the geometry call (L-9) too, which nobody ruled. So the row is split into **P5-e(i)** (L-7 + L-9, `routed`/`open`) and **P5-e(ii)** (L-8 alone, `accepted-divergence`/`closed`). The Gate C verbatim block below is left whole and unsplit — it is the source text.

**Why L-8 is closed, in the row so a future session cannot miss it:** D1 ratifies the duplication and the golden fixture backstops drift. Filing it `routed` would invite a later "tidy-up" to unify `format.ts::groupInteger` with `serialize.ts::formatDharmaExportGrouped` and **break the export path's zero-change property** — the structural guarantee that `serialize.ts` never calls `formatDharma`, so grouping cannot leak into the machine-readable front matter by construction rather than by discipline.

**L-9 was independently re-tested this session and stands refuted as a live risk.** Re-opened at staging-verify on the grounds that the original disposition considered the *file* rather than the *values*, since §10.8 at 1.0.29 groups product-wide. `geometry.ts`'s `Number()` input is a **raw NUMERIC(38,18)** off the read model — `graph-series.ts` emits `toFixed18(new CpmmDecimal(...))` at `:293`/`:427`/`:481`, and `yMax` is the constant `PROFILE_GRAPH_Y_MAX`. The ~130-site sweep it triggered established the durable property that **§10.8 terminality holds tree-wide at `997f308`: zero `coercion(formatter(...))` nesting in `src/`.** Corroborates the Gate C text; recorded so the row is not re-litigated.

---

## B · Staging-parity — profile surface blocked

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| SP-1 | **P0** — staging-parity blocks the §23 tile verify and all profile-surface testing | B | SPEC.1 §23 (cannot be verified against staging) | `episodes.ts:168` throw; 37/39 `bets` rows `share_quantity = 0`; 2 `bet.placed` events for 39 rows; 13/16 users affected | data-blocked | open | Hand-inserted fixtures the engine could never have produced | STAGING-PARITY |
| SP-2 | **DECISION** — add `CHECK (share_quantity > 0)` to `bets` | R | SPEC.2 §5 (`bets` inventory) | DB-predicted vs live verdicts matched 6/6 | routed | open | No storage-layer floor on `share_quantity` | STAGING-PARITY planning — **DDL: full ritual + ADR. Do not build silently.** |
| SP-3 | **DOCKET** — one bad row makes a whole profile permanently unreachable; append-only means no remediation | S | SPEC.1 §5 INV-4 / Bucket-A append-only | Distinct React digest per user (`723741083` RedOtter002, `154092059` dave, `2860378395` alice) — one offending bet id each | routed | open | Guard is correct; there is no repair path behind it | STAGING-PARITY — **`episodes.ts:168` is CORRECT. Do not weaken it. The question is blast radius, not whether to refuse.** |

## C · Visual / copy

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| PD-1-nn *(proposed)* | Portfolio / Balance read as **nested** by a reader | V | tier-2 · SPEC.1 §21.8 | Operator read, staging global header (`Portfolio Đ 10` · `Balance Đ 1,010`) | routed | open | §21.8's labels carry load-bearing work and may not be sufficient on their own | POLISH.1 |
| ~~PD-3-nn *(proposed)*~~ → **`PD-3-07`** · **APPLIED 2026-08-12** | `Đ10 staked` on `/m/[slug]` vs `Đ 100 staked` on discovery — Đ-glyph spacing inconsistent for the same quantity | V | tier-2 · SPEC.1 §10.8 governs the **value**; glyph spacing is unspecified — this is an internal inconsistency, not a spec violation | **VERIFIED IN SOURCE at `997f308`, not off the capture:** `MarketHeader.tsx:98` `` `Đ{formatDharma(...)} staked` `` (**no space**) vs `StatLine.tsx:31` `` `Đ {formatDharma(...)}</b> staked` `` (**space**) | routed | open | Two independent call sites for one design-language element; no shared primitive | POLISH.3 (defect) · POLISH.2 (reference form) |
| ~~PD-3-nn *(proposed)*~~ → **`PD-3-08`** · **APPLIED 2026-08-12** | `"1 posts"` — count never pluralised | V | tier-2 · design-language copy register | Market page + discovery cards | routed | open | Bare interpolation, no plural rule | POLISH.3 — ⚠ **POLISH.2's half is CLOSED and this routing was half-stale.** Fixed and pinned at V48, `tests/unit/discovery/render/stat-line.test.tsx:37-46`; `/m/[slug]` is the only unfixed surface |

**On PD-3-nn (spacing):** the operator flagged this as read off a screenshot and asked for verification before docketing. **Verified — it is real**, and the evidence above is the source citation rather than the capture. Which form is correct (spaced or unspaced) is a ruling, not a finding; both surfaces render the same market staked total.

## D · Process — the deploy loop

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| DRIFT-1 | Staging fails to advance after merge — **2 of 3 merges** (#292, #294) | R | `deploy-pipeline.md` §2.5 — assigns the advance to whoever merged | **#292** merged un-advanced; found only at the #293 advance, which then had to carry two commits. **#294** merged un-advanced; found only at close-out. Both caught by asking, neither by a control | routed | open | §2.5 assigns **ownership** but nothing **enforces** it, so the advance happens only when someone remembers to ask | **Ruling: automate the advance on merge to `main`, or add it to the merge checklist.** With POLISH.2+ merge volume this recurs every time |

**The invariant to enforce, whichever fix wins:** `git diff main..staging` is **empty except during a deliberate hold**. That is the whole property — it is checkable in one command, and it is exactly what went unchecked twice.

**Why this is class R and not a docket.** §2.5 already documents the step, in detail, with preconditions. Documentation was not the gap; both misses happened *after* the section existed, and the second happened one merge after it was rewritten. Adding more prose to §2.5 is the fix that has already failed twice. The ruling is whether to automate or to gate.

---

## Apply checklist

**1.** Allocate real `PD-<surface>-<nn>` numbers from the live register's high-water mark.
**2.** File §A under **POLISH.5 · Profile**.
**3.** File §B under **POLISH.5** or route to the STAGING-PARITY stratum per `POLISH-0.md` §5 — SP-1/2/3 are B/R/S class, not V, so §5 routing governs, not the surface table.
**4.** File §C per its `Routed to` column (POLISH.1 · POLISH.3 · POLISH.2), and §D (`DRIFT-1`) wherever process/infra rulings live — it is not a surface defect.
**5.** L-8 is already `accepted-divergence`/`closed` by founder ruling (P12) — do not re-open it, and do not unify the two grouping implementations.
**6.** Emit one batched summary row into the tracker at surface close — never row-by-row.

*G1's seven requirements are **not** here by ruling — they go to the separate web-authored docs task against `docs/maintenance.md` and the recon template.*

⚠ **Item 4 has RUN ONCE — POLISH.3 only, 2026-08-12.** §C's Đ-glyph and pluralisation rows were applied at POLISH.3's commit 0 as **`PD-3-07`** and **`PD-3-08`**, and are struck in place above with their allocated IDs. ⚠ **`REGISTER-APPLY`'s stated timing of *"before `.5`"* was wrong about WHEN** — two of §C's three rows were POLISH.3's, and POLISH.3 ran first.

⚠ **Item 2 has NOW RUN — POLISH.5/6's commit 0, 2026-08-14.** All **six** §A rows were filed under **POLISH.5 · Profile** as **`PD-5-03` … `PD-5-08`**, allocated off the live high-water `PD-5-02` (**not** `PD-5-01` — the off-by-one is recorded at `docs/plans/POLISH-5.md` §1.7 as `HM-3`). The remaining **five** rows — three (§B) + one (§C) + one (§D) — are untouched and still owed at `REGISTER-APPLY`. ⚠ **`PD-5-08` (`P5-e(ii)`) lands `accepted-divergence`/`closed` ON ARRIVAL**, by founder ruling P12; that is correct and intended, not a mint error.

⚠ **AN APPLIED ROW IS STRUCK, NEVER DELETED — ruled 2026-08-12, because this file did not say.** The original text is the record of what was proposed and against which baseline; deleting it destroys the provenance the live register's `routed_to` field points back at. Strike the **ID cell**, name the allocated ID and the date, and leave every other cell intact. This is the form already used at `POLISH-TRACKER.md` §3, `POLISH-0.md` §3 · POLISH.1, and `docs/parked.md`'s closed rows.
