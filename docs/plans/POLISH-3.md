# POLISH.3 · PR 1 — PLAN v1.1

**Status:** plan mode. **No code written, no branch, no PR, no commit, no `src/` change.** Revision of v1.0 against the founder rulings of 2026-08-12. For web review.

**What changed from v1.0:** OD-1…OD-6 ruled (§17) · item 7 (R4) struck to PR 2 · `PostCard` · `ReplyCard` · `ArgProfile` · `AggregateFooter` struck from the allow-list to PR 2 · the dev placeholder box enters as item 5 · IDs now consumed from commit 0, none minted · fixes F1–F4 · three new discharges (D-H, D-I, D-J) from measurements the v1.0 gates did not take. **Every v1.0 gate verdict stands unchanged.**

---

## §0 · Admit-check — verifiable in the medium this travels in

| Leg | Value |
|---|---|
| **Version** | `POLISH-3-PR1-plan v1.1` (supersedes v1.0, md5 `c3ea581012b61724aaca5dd54c9e4513`) |
| **Ground SHA** | `a56943be70e02d8f0cab3e10be6f6bc47b671a12` — re-fetched at revision time, unchanged |
| **Section sequence** | §0 · §1 · §2 · §3 · §4 · §5 · §6 · §7 · §8 · §9 · §10 · §11 · §12 · §13 · §14 · §15 · §16 · §17 — eighteen, in order, no gaps |
| **IDs CONSUMED** (v1.1 **mints none** — commit 0 allocates) | `PD-3-01` · `PD-3-07` · `PD-3-08` · `PD-3-09` · `PD-3-11` · `PD-0-02` |
| **Companion artifact** | `POLISH-3-PR1-anchors-v1.1.md`, same ground SHA, legs L1…L10 |
| **Ruling block** | §3 carries twelve rows / thirteen IDs, transcribed verbatim, byte-unchanged from v1.0 |

⚠ **No line count is an admit-check leg** (§13.5 corollary — counting a transcription measures the typing, not the artifact).
⚠ **v1.0's "Contiguous ID range minted" leg is STRUCK.** PR 1 mints nothing; `PD-3-05` / `PD-3-06` are R14's and are commit 0's.

---

## §1 · Ground

| | |
|---|---|
| **Surface** | `/m/[slug]` → `DebateView`. Two mutually exclusive arms: market view (`SlotHeader` + `PostScroller`) and post-focus view (`PositionStrip` + `ReplyScroller`), toggled at **`DebateView.tsx:244` / `:308`** — ⚠ **not** `:177/:272` as `POLISH-0.md:201` states; drift of +67 / +36 |
| **Ground** | `origin/main` @ `a56943b`; staging at the same SHA (`/api/health` → `canary`), `db:ok`, `migrations:ok`, `region:bom1` |
| **Register high-water** | `PD-3-04` live. Commit 0 allocates above it; **PR 1 mints nothing** |
| **Gates** | B1 · B2 · B3 · C3 all closed. Full ritual (`.3` and `.4` only) |
| **Worktree** | detached at `a56943b`; the primary tree is on `polish/8-close-out` @ `08fe0b3`, **behind main** — reviewer-bearing sessions launch from the detached worktree (§15) |

**Prerequisite.** This plan executes **after** the commit-0 DOC-ONLY PR merges (ratified decision D-1). PR 1 is then **source-only**: no `docs/**` write appears in it.

---

## §2 · What this plan does not do

No PR-2 scope · no canon appends (R6 · R10 · R14×2 batch to the close-out) · no spec or ADR edit · no prescriptive doc text (anchors returned instead, `POLISH-3-PR1-anchors-v1.1.md`) · no re-argument of any ratified ruling · no ultracode on any commit (§9) · **no register ID minted** (§0).

---

## §3 · THE TWELVE RATIFIED RULINGS — founder, 2026-08-12

Transcribed verbatim, unnormalised. Twelve rows, thirteen IDs (D7 · D8 share a row). **Byte-unchanged from v1.0.**

| ID | Ruling |
|---|---|
| **R1** | **SPLIT, and BOTH card controls are REMOVED.** `Đ BET` on `PostCard` is redundant — `SlotHeader` carries a live per-column entry. `Support / Counter` on `PostCard` is removed on thesis grounds: entering post-focus to argue means reading the post first, and mandatory commentary is meant to make argument deliberate, not reflexive. ⚠ **Scope the remedy from the STRING, not the row — THREE sites**: `PostCard.tsx:111-119`, `PostCard.tsx:120-128`, `DebateColumn.tsx:58-66` (dead). ⚠ `debate-export/serialize.ts:349`'s `- **Support / Counter:**` is ADR-0025 export copy, **NOT a control — do not touch it** |
| **R4** | **ADOPT CD-A's "Read more"** at `PostCard.tsx:102-109`. ⚠ **`.3` changes only its own site.** `.5` (`ArgumentList.tsx:75`) and `.6` (`BookmarkCard.tsx:64`) are bare CSS clamps with **no affordance at all** — there the remedy is an *addition*, not a rename, and it is theirs. §5 forbids a V batch spanning surfaces |
| **R5** | **SPLIT.** Geometry (512px→720px, 80vh→90vh, absent header row) stays class **V** on `PD-0-03`. The missing `SideBadge` becomes its own class **F** row — it is an invariant-visual obligation, not a width preference. Full CD-A parity on both halves |
| **R6** | **RETIRED BY RULING**, appending to canon under the `C-` form. CD-A ratified the pop-up composer believing it was the only market-view path to reply-as-bet; `SlotHeader` is already live, so building it would make a fourth entry to one action. ⚠ **Do not file the unbuilt pop-up composer, the Support/Counter footer + stake bar, or the absent `ReplyPopup` as defects** |
| **R10** | **ACCEPTED-DIVERGENCE**, appending to canon as **`C-PRICEBAR-1`**. ⚠ The `superseded` exit is **CLOSED** — the recon proved the mockup has **two** `pick` functions: the global `:1431` **opens the composer** (and is what the price labels and the `Buy` buttons both call), while the view-only `:1862` is IIFE-private and drives the reply carousel. Canon §2's *"Pick is view-only"* does not govern these labels. The divergence is accepted for consistency with R6: `SlotHeader`'s `Đ BET` is already live, so wiring the labels adds another entry to one action. **P12 — founder-set** |
| **R14** | **TWO rows, not one.** Check 1 (slot-header geometry) **PASSED** — built values match the CD-final transcription on every named property; only the coordinates drifted. Check 2 (card media clip) is **HALF-passed** — the in-card `--imgmax` clip holds; *"renders whole in the pop-up"* holds in the width axis only. Both dispositions append to canon under the `C-` form, **never as `R14`** |
| **D2** | **Đ-glyph form is SPACED** — `Đ 100`, matching Discovery (`StatLine.tsx:59`) and the composer (`ReplySplitBar.tsx:70`). **FIVE `.3` sites change**, not one |
| **D3** | **The third disabled control is REMOVED**, same as R1 — the `Download` trigger at `BookmarkToggle.tsx:164-168`. Executes in `.3` PR 2 as a **second named allow-list exception**. `.5`/`.6` record the adoption. Deleting a dead control is not a re-skin, so §5's one-surface rule does not bar it |
| **D4** | **Route-state files follow the ratified `PD-7a-04` / R-C precedent exactly: add `error.tsx`, deliberately OMIT `loading.tsx`** |
| **D5** | **`PriceBar` `detail` ships at d5's 14px bar / 10px labels in PR 1**, deliberately breaking **OD-2's byte-identical pin**. The pin was explicitly transitional. ⚠ **The plan and the log must cite OD-2 by name and record the break as deliberate** — this is the one change that materially alters the header's appearance |
| **D6** | **All three split corrections accepted.** `PriceBar` → **PR 1**. The five chart files come **OFF** PR 1's allow-list (all `C-CHART-1` clauses green, zero findings). `MarketPriceChartOverlay.tsx` sits on **PR 2** for `PD-3-04` only. `placeholders.tsx` and `BookmarkToggle` do not partition cleanly and are **named rather than assigned** |
| **D7 · D8** | **`DebateView.tsx` stays OFF PR 1's allow-list** — BD-1 gives it PR-1 ownership so a finding has somewhere to land, but nothing needs to write it, and listing it opens the ⛔ symbols for no benefit. **The `test-pin` column stays** (§13.2) |

---

## §4 · Discharges — measured against `a56943b`, in the plan's own words

Recorded here, separately, so no ratified ruling's text is edited. **D-A…D-G are v1.0's, unchanged. D-H…D-J are new to v1.1.**

**D-A · D2's "FIVE `.3` sites" is CORRECT. My head check was the thing that was wrong.**
The head check grepped `Đ` followed by a digit or `{`, which cannot see a `Đ` followed by a newline. Two sites were missed. The complete unspaced set on this surface, re-measured:

| # | Site | Form on disk | PR |
|---|---|---|---|
| 1 | `MarketHeader.tsx:98` | `` <span>Đ{formatDharma(market.totals.dharmaStaked)} staked</span> `` | **PR 1** |
| 2 | `ReplyCard.tsx:55` | `` Đ{formatDharma(reply.stake)} `` | PR 2 |
| 3 | `ArgProfile.tsx:67` | `` <span className="font-mono">Đ{formatDharma(authorStake)}</span> `` | PR 2 |
| 4 | `AggregateFooter.tsx:14-15` | `` Support ({aggregate.supportCount}) : Đ `` ⏎ `` {formatDharma(aggregate.supportDharma)} `` | PR 2 |
| 5 | `AggregateFooter.tsx:19-20` | `` Counter ({aggregate.counterCount}) : Đ `` ⏎ `` {formatDharma(aggregate.counterDharma)} `` | PR 2 |

Sites 4 and 5 render unspaced because JSX strips the trailing newline and indentation from a text node before an expression child. **Five, exactly as ruled.** The relay's warning that my head check contradicted D2 was itself the error; D2 stands unamended.
⚠ **v1.1: the PR column is the OD-1 ruling.** `PD-3-07` is consumed **PARTIAL** by PR 1 — site 1 only — and **stays OPEN** for PR 2 to close on sites 2–5.

**D-B · D2's cited reference coordinates VERIFY at head.** `StatLine.tsx:59` and `ReplySplitBar.tsx:70` both carry the spaced form. (`POLISH-register-ADDITIONS.md:60` cites `StatLine.tsx:31`, which has drifted to `:59`; the claim is true, the coordinate is not — L2b.)

**D-C · D6's `placeholders.tsx` clause is discharged for PR 1 — no partition ruling is needed.** `DeferredPlaceholders` is a **file-private, non-exported** function defined at `MarketHeader.tsx:43` and used only at `:102`. `MarketHeader.tsx` does not import `placeholders.tsx` at all. The module's three exports (`REMOVED_STUB_TEXT`, `RemovedPlaceholder`, `EmptySideCTA`) all have live consumers PR 1 does not touch. **`placeholders.tsx` is not on PR 1's allow-list and nothing in PR 1 wants it.**
⚠ **v1.1 correction to my own corollary.** v1.0 concluded from this that the dev box was out of scope because *"no ruling covers it."* **That test was wrong and the founder is right** (OD-6): the twelve rulings dispose of **pre-existing open rulings**; a newly-found class-V defect is authorised by its **register row** and §4.2 B1, not by appearing among them. The box is **item 5**, on `PD-3-09`. The measured fact — that removal orphans nothing in `placeholders.tsx` — stands and is what makes item 5 a two-line deletion.

**D-D · The live high-water is `PD-3-04`; three landed documents say `PD-3-03`.** Recorded once here, once at L10. `docs/plans/PRIMITIVES-2.md:71,326-327` · `docs/logs/PRIMITIVES-2-PR-B.md:226-227,231-232` · `docs/logs/PRIMITIVES-2-CLOSE.md:159-161`. **All three are left alone** — landed historical artifacts, precedent `POLISH-TRACKER.md:73` (`DISCOVERY-COMPLETE.md` / `PD-5-01`).

**D-E · Three stale coordinates found while gating.** `POLISH-0.md:201` `DebateView.tsx:177/:272` → live `:244`/`:308`. `POLISH-0.md:118` `SlotHeader.tsx:111`/`:125` → live `:104`/`:118`. `POLISH-0.md:112` `PostCard.tsx:88-95` → live `:102-109`. Every underlying **claim** is true; only the numbers moved. This is why §11 fences by symbol.

**D-F · R4's CD-A hex values are already tokens — no divergence, no raw hex.** CD-A specifies `#989898 → #FAFAFA hover`. Measured: `globals.css:144` `--color-n5: #989898` and `:147` `--color-ink: #fafafa`. R4 ports to **`text-n5 hover:text-ink`** exactly.
⚠ **v1.1: R4 is PR 2's** (OD-2). This discharge is **carried forward for PR 2's plan** — an execution that copied CD-A's hex strings verbatim would halt on `no-raw-hex-view-layer.test.ts`, and the mapping is exact, so PR 2 need not rediscover it.

**D-G · R1's export warning is confirmed, and a test proves it.** `debate-export/serialize.ts:349` is pinned two ways: `tests/unit/debate-export/serialize.test.ts:299` asserts the header does **not** contain `**Support / Counter:**`, and `_fixtures/mumbai-metro.expected.md` asserts it **does** appear in five post bodies. Touching `serialize.ts` reddens both. **Do not touch it** — exactly as ruled. ⚠ v1.1: R1's PostCard sites are PR 2's, so this warning **travels with them**; it remains live for item 6, which does not go near the export.

---

**D-H · `(auth)/error.tsx` READ. It states a rule neither v1.0 sibling could reveal — and it does NOT contradict `notice`.** *(OD-5's named obligation.)*

`src/app/(auth)/error.tsx` **declares no container at all.** Its docblock, `:16-18`, verbatim:

> This boundary renders INSIDE `(auth)/layout.tsx`, so it inherits `GlobalHeader` and `PageContainer preset="auth"` and must NOT declare a container of its own — the box is POLISH.1's and is already around it.

**The unconfounded rule the three-file set actually supports: an error boundary declares a container IFF its layout does not already provide one.** That explains all three with no confound — `(auth)/error.tsx` inherits one and declares none; `bookmarks/error.tsx` and `u/[pseudonym]/error.tsx` inherit none and each declare one.

**Measured, and this is the load-bearing half: `src/app/(public)/layout.tsx` declares NO `PageContainer`.** It renders `<div className="flex min-h-full flex-col">` → `<GlobalHeader …>` → `<main className="flex-1">{children}</main>`, and it is **absent from `page-container.test.ts`'s nine SITES**. So `/m/[slug]/error.tsx` falls on the *declare one* side, and `(auth)/error.tsx` is silent on **which** preset. **No contradiction with `notice`; the ruling executes.**

⚠ **The founder's correction of my v1.0 rule is accepted and was right.** I inferred "match your route" from n=2 where both siblings are `reading` boundaries on `reading` routes — data that cannot separate that from "copy the string." `(auth)/error.tsx` does not break the tie either, because it declares nothing. **The tie is genuinely unbroken by the repo**, which is exactly the §4.2 B3 situation: ship the defensible option, flag it, rule at Gate C.

**Two further findings from the same read, both carried to Gate C, neither a halt:**
- `(auth)/error.tsx:32-47` establishes a hard, reviewed treatment: **nothing from `error` is rendered — not `message`, not `stack`, not `digest`, not `cause`** — with a `@security-auditor`-sourced argument that the CLIENT arm leaks a real `Error` in production even though the server arm is sanitized by React's `resolveErrorProd`. **Item 4 adopts this verbatim.** It is the strongest existing statement of the treatment and it is on this repo's own error-boundary family.
- `(auth)/error.tsx:53-57` is R-C stated in the file: *"NO `loading.tsx` LANDS BESIDE THIS."* **D4's omission half is therefore precedent-verified in the exact file D4 names**, not merely inferred from `page-states.test.tsx`.

**D-I · The dev placeholder box: UNGATED, and its tier-4 baseline is nameable. Class V holds; it is NOT class S.** *(OD-6's two obligations.)*

**(b) Dev-gating — MEASURED, and the answer is NO.** `grep -n "NODE_ENV\|process.env\|ZUGZWANG_ENV\|dev\b\|flag" src/components/debate/MarketHeader.tsx` returns **zero hits**. `<DeferredPlaceholders />` sits unconditionally in `MarketHeader`'s returned JSX at `:102`, and the function itself (`:43-50`) returns its `<div>` unconditionally. **"Rendered to participants" is TRUE** — it renders on every `/m/[slug]` view, signed-in or out, in production. **The discriminating condition resolves to REMOVAL. No per-delta halt.**

**(a) Tier-4 baseline — NAMEABLE, and it is not "d5 renders no such box."** The d5 mockup is in-repo at `docs/design/mockups/surface_d5_v1_0.html` (1,929 lines), so this was verified rather than asserted. d5 renders **both** things the stub names, as **designed header elements**:

| d5 line | Evidence |
|---|---|
| `:447` | `.headzone{flex:0 0 188px;…}` /* D5: bottom-aligns right column w/ **media+resolver** (tunable) */ |
| `:251-252` | "Header: price bar reduced (bar 22→14, font 12→10) and the **market media** now FILLS the header height (16:9) — so media, **resolver cards**, and the right…" |
| `:225` | "D5-01 — **Market media slot** is now a 1:1 SQUARE, contain-fit" |
| `:262` | "**Market media** aspect → 16:9 (YouTube-thumbnail standard), height = `--imgmax`" |

**So the baseline is `surface_d5_v1_0.html:447` + `:251-252`** — a header that renders market media and resolver cards as real elements and renders **no dashed placeholder box**. The built stub has no tier-4 counterpart, which is the divergence. **Class V is correct. H6 does not fire.**

⚠ **What removal costs, stated so it is a decision and not a side effect.** The box is the only on-screen acknowledgement that two *ratified, designed, unbuilt* d5 elements are missing (`MarketHeader.tsx:36-42`: *"UNBACKED by the current schema… arrive with a future market-content slice"*). **The record survives removal in two committed places** — `POLISH-0.md:214` (*"MEDIA.2 — NOT BUILT… POLISH.3 does not absorb it"*) and the `MEDIA.2-GOLIVE` docket row commit 0 mints. Nothing is lost that is not written down elsewhere. Recorded because "we deleted the only visible trace" is the kind of thing that should be true on purpose.

**D-J · d5's market-detail bar is STRUCTURALLY a one-row `.barrow`, not the two-row form we ship — and PD-3-01 forecloses acting on it.** *(New; a Gate C note, not a halt.)*

D5's cited coordinates **verify exactly**:
- `surface_d5_v1_0.html:507` → `.barrow.f .blab{font-size:10px;}` — **10px labels** ✓
- `surface_d5_v1_0.html:508` → `.barrow.f .bar{height:14px;}` — **14px bar** ✓

⚠ But `.barrow.f` is a **variant of `.barrow`**, and `:505` defines `.barrow{display:flex;align-items:center;gap:9px;…}` — **LABEL — BAR — LABEL on one flex row, gap 9px.** That is the structure our `hero`/`card` presets already implement (`PriceBar.tsx:87`, `flex items-center gap-[9px]`). Our `detail` branch is the **two-row** form (`:62`, `flex flex-col gap-1` — bar above, labels below). **d5's ratified market-detail bar therefore differs from the built one in STRUCTURE as well as in the two numbers.** (Cross-check: `:509` `.barrow.r .bar{height:16px;}` matches our `card` at `h-[16px]`, so the mapping is sound.)

**This is NOT actioned in PR 1, and the foreclosure is explicit, not my judgment.** `POLISH-register.md:131` (`PD-3-01`) states: *"The preset seam exists; **only the numbers are open**."* D5's own text names only *"14px bar / 10px labels."* `PriceBar.tsx:12-13` says the same. **Three sources scope this to the numbers.** Adopting `.barrow.f` structurally would delete the `if (size === "detail")` branch, collapse `detail` into the shared `ROW` map, emit a `data-size="detail"` attribute (breaking `price-bar-presets.test.tsx:52-58`, which G-5 verdicts as HOLDS), and change the DOM shape — a far larger change than any ruling authorises.

**Recorded as a Gate C note** so that a later reader comparing `/m/[slug]` to d5 finds this measured rather than rediscovering it as a defect, and so PD-3-01's *"only the numbers are open"* is understood as a **scoping decision** rather than as a complete description of the divergence.

---

## §5 · GATE RESULTS — v1.0, unchanged

Every verdict below stands. Where a v1.0 open decision has since been ruled, the ruling is noted; **no verdict is altered.**

### G-1 · Does the live path render the percentage pair? — **YES, and the ruling's premise does not arise**

**The rendering line, quoted:** `src/components/debate/composer/SlotHeader.tsx:82` and `:121`

```
	const pct = pricing ? formatPricePercent(pricing, side) : "—";
…
					<b className="font-extrabold">{pct}</b>
```

Same `formatPricePercent` as `DebateColumn.tsx:40`. The sum-to-100 property **is** assertable against the live path.

⚠ **But D-3 is already discharged on disk, twice over — and R1 does not delete the branch it was worried about.** Two findings:

**(i) The retarget target already exists.** `tests/unit/debate/render/price-percent-pair.test.tsx` already contains `SlotHeader: the two slot headers sum to 100` (`:75-99`, the market arm) **and** `PositionStrip: the two position strips sum to 100` (`:101-121`, the post-focus arm). Both use the same `TIE = 0.525/0.475` fixture and the same `53/47/not-48` triple. **B2/PCT.ROUND's guarantee on both live paths is already pinned.** A retarget would author a fourth copy of an assertion that exists two blocks below.

**(ii) R1 does not remove the text the DebateColumn assertion reads.** R1's third site is `DebateColumn.tsx:58-66` — **the `<Button>` only**. The fallback branch's `<SideBadge>` (`:53`) and `{pct}` (`:54-56`) both survive. So `price-percent-pair.test.tsx:59-73` **stays green with no edit at all.**

**Verdict: neither branch of the gate fires.** Not YES→retarget (the target exists), not NO→delete-and-lose-the-guarantee (nothing is lost, and nothing is deleted). **`price-percent-pair.test.tsx` comes OFF the allow-list.** No register row is opened; no guarantee is surrendered. Reported, not taken silently.

### G-2 · What moves in `side-badge.test.tsx`? — **NOTHING. The premise does not occur**

Measured at head: `sideBadgeSites.length` = **13** (12 unsized + 1 sized). The census scans `src/**/*.tsx` with `RENDER_SITE = /<SideBadge\b[\s\S]*?\/>/g`.

**The gate asks what moves "when `DebateColumn.tsx`'s `<SideBadge>` at `:53` is deleted." Under R1 as ruled, it is not deleted.** R1 names `:58-66`, which is the `<Button>`:

```
					<Button                          ← :58
						variant="outline"
						size="xs"
						disabled
						aria-disabled="true"
						aria-label={`Đ BET ${side} — sign in to bet`}
					>
						Đ BET
					</Button>                        ← :66
```

`<SideBadge side={side} />` is at `:53`, **outside** that range. PR 1's other source edits contain no `<SideBadge>`.

**Verdict: the census stays 13/12, set equality holds, and the `>= 13` floor at `:112` is NOT breached. `side-badge.test.tsx` comes OFF the allow-list.**

✅ **RULED at v1.1 — the narrow reading is now founder-ratified.** The kickoff contradicted itself (R1 named `:58-66`; §5 said "the dead fallback"; §5's gap 1 named `:49-70`). The ruling is the **narrow** reading: remove `:58-66` only. Making `header` required and deleting `:49-70` is a structural refactor of a shared component's TYPE, which no ruling authorises and a cosmetic pass must not take. **⛔ RUN-STOP #5 stands unchanged** (§12). The finding is not lost — it becomes a `docs/parked.md` docket row, `DEBATECOLUMN-FALLBACK-DEAD`, minted in commit 0.

### G-3 · Will `error.tsx` use `<PageContainer>`? — **YES, and page-container.test.ts moves in the same commit**

Both siblings do, identically:

- `src/app/(public)/bookmarks/error.tsx:16` → `<PageContainer preset="reading">`
- `src/app/(public)/u/[pseudonym]/error.tsx:16` → `<PageContainer preset="reading">`

So the new file follows, and **`tests/unit/shell/page-container.test.ts` becomes UNCONDITIONAL on the allow-list.** Three edits, same commit:

1. a 10th `SITES` entry — `{ site: 10, file: "src/app/(public)/m/[slug]/error.tsx", before: "<the preset's exact class string>" }`
2. the three `9`s at `:163-165` → `10`
3. the `it(...)` title at `:162`, `"covers all nine declaration sites"` → ten

⚠ **This test does NOT scan the tree** — it is a hardcoded array, self-consistent by construction. Nothing will force the update; a new `PageContainer` site would silently escape the B2 no-change proof while every assertion stayed green. That is why it is on the list rather than left to review.

✅ **RULED at v1.1 — `preset="notice"`, under §4.2 B3.** The v1.0 recommendation of `debate` is withdrawn; my rule was inferred from n=2 with an unbreakable confound (see D-H). The unconfounded family precedent is `(public)/not-found.tsx` at `notice`. **`(auth)/error.tsx` was read as required and does not contradict it** — it declares no container because its layout supplies one, and `(public)/layout.tsx` supplies none (D-H). **Flagged for Gate C, not stalled.** The 10th SITES entry's `before` string is therefore the `notice` preset: `mx-auto w-full max-w-3xl px-4 py-24`.

### G-4 · PriceBar zero-delta for hero and card — **enumerated, and structural rather than argued**

**Every consumer, measured (`grep -rn "<PriceBar" src/`):**

| Preset | Consumer | Surface | In PR 1? |
|---|---|---|---|
| `hero` | `src/components/discovery/HeroPanels.tsx:111` | Discovery | ❌ not touched |
| `card` | `src/components/discovery/MarketCard.tsx:72` | Discovery | ❌ not touched |
| `detail` | `src/components/debate/MarketHeader.tsx:96` | `/m/[slug]` | ✅ the subject |

⚠ The register cites `HeroPanels.tsx:79` and `MarketCard.tsx:68` (`POLISH-register.md:99`). **Both have drifted** — live `:111` and `:72`. Claims true, coordinates stale.

**The §8.2 zero-delta proof for hero and card is STRUCTURAL, not a claim.** `PriceBar.tsx` has three disjoint regions:

- `:17-20` — `const ROW = { hero: …, card: … }`. **`detail` is not a key.**
- `:60-79` — `if (size === "detail") { return … }`. **An early return.**
- `:81-99` — `const s = ROW[size]` and the shared hero/card render, **reachable only when `size !== "detail"`**.

D5's change is confined to `:60-79`. Control flow cannot carry it into `:81-99`, and `ROW` is not read on the `detail` path. **Hero and card cannot move**, and the proof is a property of the file rather than a claim about the diff.

**Belt, enumerated:** four assertions exercise hero/card directly and stand as the executable check — `price-bar-presets.test.tsx:62-81` (hero: 22px bar, 12px labels outside, `data-size="hero"`, gap-[9px]) and `:83-96` (card: 16px bar, 10.5px labels, `data-size="card"`).

⚠ **V-1 — the new `detail` baseline is CAPTURED, never authored.** Ordered obligation: edit `:60-79` → render → dump `container.innerHTML` → paste as `DETAIL_BASELINE`. Writing the literal by hand and then making the component match it inverts the proof. **This is an ordered proof obligation and it is why the D5 commit fails `CLAUDE.md` §6 condition 4 — no ultracode.**

⚠ **v1.1 addendum, and it is why the structural proof matters more than it did at v1.0:** D-J establishes that d5's bar is structurally a one-row `.barrow`. The zero-delta proof above holds **only** for the numbers-only change PD-3-01 authorises. A structural adoption would move `detail` INTO `ROW` and the early return would vanish — at which point hero and card are no longer protected by control flow. **If execute finds itself editing `PriceBar.tsx:81-99` or `:17-20`, that is scope creep past PD-3-01 → per-delta halt.**

### G-5 · Which `detail`-touching assertions move under 14px/10px? — **exactly one, of nine**

`tests/unit/discovery/render/price-bar-presets.test.tsx`:

| Assertion | Line | What it reads | Verdict |
|---|---|---|---|
| `detail-render-is-unchanged` | `:47-50` | `container.innerHTML` vs `DETAIL_BASELINE` | 🔴 **MOVES** — the baseline is recaptured. This is OD-2's pin and D5's deliberate break |
| `detail-carries-no-data-size-attribute` | `:52-58` | `querySelector("[data-size]")` is null | ✅ **HOLDS** — the `detail` branch emits no `data-size`; a numbers-only edit keeps it that way |
| `paired-aria-label-sums-to-100-in-every-preset` | `:102-111` | `aria-label` over all three sizes | ✅ **HOLDS** — `aria-label` is `` `YES ${yesPct}, NO ${noPct}` ``, untouched by geometry |
| `yes-segment-width-is-the-rounded-percent-in-every-preset` | `:113-120` | `.bg-yes` inline `style.width` | ✅ **HOLDS** — `style={{ width: yesPct }}`, untouched |
| `poles-are-never-ported-by-neutral-token-name-in-any-preset` | `:122-135` | `.bg-yes`/`.bg-no` present, `bg-ink`/`bg-n0` absent | ✅ **HOLDS** — token names unchanged |
| `null-pricing-renders-the-quiet-stub-in-every-preset` | `:137-144` | the `Pricing unavailable` stub | ✅ **HOLDS** — the `!pricing` early return at `:50-52` precedes the `detail` branch |

⚠ **A second file renders `detail` and the gate did not ask about it.** `tests/unit/debate/render/price-percent-pair.test.tsx:33-56` has three more `detail` assertions:

| Assertion | Line | Reads | Verdict |
|---|---|---|---|
| `announces the pair as one utterance summing to 100` | `:34-38` | `aria-label` | ✅ **HOLDS** |
| `renders the same pair in the visible labels` | `:40-47` | `container.textContent` | ✅ **HOLDS** — text content, not font size |
| `gives the YES segment the rounded percent as its CSS width` | `:49-55` | `.bg-yes` `style.width` | ✅ **HOLDS** |

**All three hold**, so this file still comes off the allow-list (G-1). Named because "which assertions touch `detail`" has a nine-item answer across two files, and a one-file answer would have read as complete.

**The change itself:** `h-1.5` (6px) → `h-[14px]` at `:64`; `text-[11px]` → `text-[10px]` at `:73`. Two class tokens. ⚠ **The `:52-58` HOLDS verdict is conditional on the numbers-only scope** — see D-J and G-4's v1.1 addendum.

---

## §6 · THE ITEM TABLE — the enumeration IS the count (§13.3)

Each item carries a **discriminating condition**: the observation that would tell you it is already done or not applicable. **IDs are CONSUMED from commit 0's allocation; PR 1 mints none.**

| # | Item | Ruling | Site(s) | Register | Discriminating condition |
|---|---|---|---|---|---|
| **1** | `PriceBar` `detail` ships at d5's **14px bar / 10px labels**, breaking OD-2's byte pin | **D5** | `PriceBar.tsx:64`, `:73` | `PD-3-01` (exists, inherited) | `grep -n "h-1.5" src/components/debate/PriceBar.tsx` returns the `detail` bar line. **If it returns nothing, the change already landed.** Confirm the second axis: `text-[11px]` at `:73`. ⚠ Numbers only — **not** d5's structural `.barrow` form (D-J) |
| **2** | Đ glyph normalised to the **SPACED** form — **`MarketHeader.tsx:98` ONLY** | **D2** (site 1 of 5) | `MarketHeader.tsx:98` | `PD-3-07` **PARTIAL — stays OPEN**, PR 2 closes it on sites 2–5 | Render `MarketHeader`; the staked line reads `Đ 14,260 staked`. **If it already carries the space, done.** ⚠ Sites 2–5 (`ReplyCard` · `ArgProfile` · `AggregateFooter` ×2) are **PR 2's and MUST NOT be touched here** — §10 |
| **3** | `posts` / `replies` counts **pluralised** on the market header | ADDITIONS `:61` | `MarketHeader.tsx:99`, `:100` | `PD-3-08` | Render `MarketHeader` with `postCount: 1, replyCount: 1`. **If it reads `1 post` / `1 reply`, done.** The shipped reference implementation is `StatLine.tsx` (zero is plural — `0 replies`, never `0 reply`) |
| **4** | Route state: **add `error.tsx` at `preset="notice"`, deliberately OMIT `loading.tsx`** | **D4** | `src/app/(public)/m/[slug]/error.tsx` (new) | `PD-3-11` | `ls src/app/(public)/m/[slug]/` shows only `page.tsx`, `export/`, `quote/`. **An `error.tsx` present ⇒ done; a `loading.tsx` present ⇒ ⛔ RUN-STOP.** Treatment is `(auth)/error.tsx:32-47`'s verbatim: render **nothing** from `error` — not `message`, `stack`, `digest` or `cause` (D-H) |
| **5** | The **dev-facing placeholder box REMOVED** from the market header | register row + §4.2 B1 (OD-6) | `MarketHeader.tsx:43-50` (the function), `:102` (the mount), `:36-42` (its docblock) | `PD-3-09` | `grep -n "DeferredPlaceholders" src/components/debate/MarketHeader.tsx` returns `:43` and `:102`. **Zero ⇒ done.** ⚠ **Gating measured: NONE** — the box is unconditional and renders to every participant, so removal proceeds and the per-delta halt does **not** fire (D-I(b)). Tier-4 baseline: `surface_d5_v1_0.html:447` + `:251-252` — **class V, not S** (D-I(a)) |
| **6** | `DebateColumn`'s **dead `Đ BET` REMOVED** — the third R1 site, on the shared row | **R1** (site 3 of 3) | `DebateColumn.tsx:58-66` | `PD-0-02` (shared; PR 2 closes sites 1–2) | `grep -n "Đ BET" src/components/debate/DebateColumn.tsx` returns `:63` and `:65`. **Zero ⇒ done.** Unreachable in production — both `DebateView` mounts pass `header` — so there is no visual delta to verify, only a compile one. ⚠ **NARROW reading, ratified:** `:58-66` only, never `:49-70` |

**Orphans this change creates (§5.3, in scope by definition):**

- `DebateColumn.tsx:3` `import { Button } …` — `Button` is used **only** at `:58-66`. Item 6 orphans it. Remove in the same commit or `biome`/`tsc` reddens.
- `MarketHeader.tsx:36-42` — the `DeferredPlaceholders` docblock describes exactly what item 5 deletes. Remove with it.
- ⚠ **Item 5 orphans nothing else.** `DeferredPlaceholders` is file-private and imports nothing of its own (D-C); `MarketHeader.tsx`'s import block is untouched by it.

**Moved to PR 2 by OD-1 / OD-2, recorded so they are not rediscovered as gaps:** R1 sites 1–2 (`PostCard.tsx:111-119`, `:120-128`) · R4 (`PostCard.tsx:102-109`, with D-F's token mapping carried forward) · D2 sites 2–5 (`ReplyCard.tsx:55` · `ArgProfile.tsx:67` · `AggregateFooter.tsx:14-15`, `:19-20`) · D3 (`BookmarkToggle.tsx:164-168`) · `PD-3-04` (`MarketPriceChartOverlay.tsx`).
**Batched to the close-out:** R5's F row · R6 · R10 (`C-PRICEBAR-1`) · R14 ×2 — all canon appends.

---

## §7 · TEST PINS — existing files only (§13.2)

Every entry is a file **on disk at `a56943b`**. No proposed filenames.

| Item | Existing test pinning current behaviour | Verdict |
|---|---|---|
| **1** (D5) | `tests/unit/discovery/render/price-bar-presets.test.tsx:47-50` — `expect(container.innerHTML).toBe(DETAIL_BASELINE)`, the OD-2 pin, baseline literal at `:35-44` | 🔴 **BREAKS BY DESIGN.** Recapture per V-1. Eight sibling assertions hold (G-5) |
| **1** (D5) | `tests/unit/debate/render/price-percent-pair.test.tsx:33-56` — three `detail` renders | ✅ hold — aria/text/width only |
| **2** (D2) | **No pinning test found.** Zero assertions on the Đ-glyph *spacing* at any of the five sites | ⚠ see the rider |
| **2** (D2) | `tests/unit/design/no-raw-dharma-render.test.ts` — keys on MONEY IDENTIFIERS, not the glyph | ✅ holds — `formatDharma` is retained |
| **3** (plural) | `tests/unit/debate/render/price-chart.test.tsx:240-241` — `getByText(/3 posts/)`, `getByText(/5 replies/)` | ⚠ **Does not defend the defect** (3 and 5 are plural either way) but **is a `getByText` on the exact strings item 3 edits.** On the allow-list |
| **3** (plural) | `tests/unit/discovery/render/stat-line.test.tsx:37-46` — POLISH.2's V48 fix, `not.toContain("1 posts")` | ✅ **the reference implementation**, and the evidence POLISH.2's half is closed (L3). Not edited |
| **4** (error.tsx) | `tests/unit/shell/page-container.test.ts:162-166` — `toHaveLength(9)` + two `size).toBe(9)` | 🔴 **MOVES** — G-3. Hand-maintained, will not self-detect |
| **4** (error.tsx) | `tests/unit/discovery/render/page-states.test.tsx:283-290` · `tests/unit/auth/auth-error-boundary.test.tsx:114-124` | ✅ hold — single-path negatives on `(public)/loading.tsx` and `(auth)/loading.tsx`, neither is this route. ⚠ The latter is **D4's own R-C precedent, in the file D4 names** (D-H) |
| **4** (error.tsx) | `tests/unit/design/no-raw-hex-view-layer.test.ts` — `SCAN_DIRS` includes `src/app/(public)` recursively | ✅ **auto-enrols** the new file. No allow-list edit; it must carry no raw hex |
| **4** (error.tsx) | `tests/server/identity/no-raw-uuid-in-urls.test.ts` — collects **directories** | ✅ blind to a file inside an existing `[slug]` dir |
| **5** (dev box) | **No pinning test found.** Zero references across all of `tests/` to `DeferredPlaceholders`, `Resolver cards`, `Market media` or `market-content slice`. The one test rendering `MarketHeader` (`price-chart.test.tsx:232-257`) makes targeted queries, never a container snapshot | ✅ **removal reddens nothing.** A measured absence, not an assumption |
| **6** (R1) | `tests/unit/debate/render/price-percent-pair.test.tsx:59-73` — reads `{pct}` from the fallback | ✅ **HOLDS** — item 6 removes `:58-66` only; `{pct}` at `:54-56` survives (G-1) |
| **6** (R1) | `tests/unit/debate/render/side-badge.test.tsx:112,119,130` — the counted census | ✅ **HOLDS** — `<SideBadge>` at `:53` is outside `:58-66` (G-2) |

**⚠ Rider on item 2 — a knowingly accepted guard gap, recorded now rather than discovered later (F3).**

D2 has no test in either direction at any of its five sites. `tests/unit/debate/render/market-header.test.tsx` (new, allow-list #7) carries the guard for **site 1 only** — `MarketHeader.tsx:98`'s spaced Đ, alongside item 3's singular/plural pair.

**The other four D2 sites ship unguarded, and they are PR 2's:** `ReplyCard.tsx:55` · `ArgProfile.tsx:67` · `AggregateFooter.tsx:14-15` · `:19-20`. **PR 2's plan must carry their guards** — `PD-3-07` stays OPEN precisely so that obligation has somewhere to live. Between the two PRs, `/m/[slug]` renders the spaced form in the header and the unspaced form in the cards; that intermediate inconsistency is a **ratified consequence of the OD-1 split**, not a defect to file.

---

## §8 · THE FINAL ALLOW-LIST — eight files

**A file not on this list cannot be written. An import cannot widen it.**

| # | Path | Why |
|---|---|---|
| 1 | `src/components/debate/MarketHeader.tsx` | items 2, 3, 5 |
| 2 | `src/components/debate/DebateColumn.tsx` | item 6 |
| 3 | `src/components/debate/PriceBar.tsx` | item 1 |
| 4 | `src/app/(public)/m/[slug]/error.tsx` **(new)** | item 4 |
| 5 | `tests/unit/discovery/render/price-bar-presets.test.tsx` | item 1 — the OD-2 pin |
| 6 | `tests/unit/debate/render/price-chart.test.tsx` | item 3 — the `getByText` pins |
| 7 | `tests/unit/debate/render/market-header.test.tsx` **(new)** | items 2, 3 guards |
| 8 | `tests/unit/shell/page-container.test.ts` | item 4 — G-3 |

**STRUCK, each with its ground:**

| Struck | Ground |
|---|---|
| `src/components/debate/PostCard.tsx` | **OD-1 / OD-2** — R1 sites 1–2 and R4 are PR 2's |
| `src/components/debate/ReplyCard.tsx` · `ArgProfile.tsx` · `AggregateFooter.tsx` | **OD-1** — D2 sites 2–5 are PR 2's. The split is ratified, not an artefact of the starting set |
| `tests/unit/debate/render/price-percent-pair.test.tsx` | **G-1** — R1 removes the Button, not the branch; `{pct}` survives; the live-path retarget already exists at `:75-121`. Nothing moves |
| `tests/unit/debate/render/side-badge.test.tsx` | **G-2** — the `<SideBadge>` at `DebateColumn.tsx:53` is outside R1's `:58-66`. Census stays 13/12 |
| `tests/unit/shell/not-found.test.tsx` | head check — scan filters to `layout.tsx`/`page.tsx`, floor is `>= 17` not equality |
| `tests/unit/debate/render/price-bar-detail.test.tsx` | **never existed.** The pin is #5 |
| `src/components/debate/placeholders.tsx` | **D-C** — `DeferredPlaceholders` is file-private to `MarketHeader.tsx`; item 5 orphans nothing in this module |
| `src/components/debate/DebateView.tsx` | **D7 · D8** — PR-1 ownership without write access |
| the five chart files | **D6** |

⚠ **Carve-out 1 — kept verbatim from v1.0, because it is the reason execute will not halt correctly and expensively.**
**#5 is pathed under `tests/unit/discovery/` but owns a SHARED primitive's presets. This is NOT an H4 / §4.2-C1 surface crossing.** The ground:
- `PriceBar.tsx` lives at `src/components/debate/`, **this surface's** directory. It is a `.3` component that Discovery consumes, not a Discovery component.
- The file's own docblock (`:11-15`) states the `detail` preset is *"pinned BYTE-IDENTICAL… Reconciling it is **POLISH.3's row**, not this task's"* — DISCOVERY-COMPLETE wrote the pin **for POLISH.3 to break**.
- `POLISH-register.md:99` (PD-2-21) says the same: *"⚠ `detail`'s own numbers are **POLISH.3's row** below."*
- The edit touches only `detail`-scoped assertions (G-5); Discovery's hero/card assertions are read as the zero-delta belt and **not modified**.
**The test file's path is a filing accident; its subject is this surface's primitive.** Editing it is intra-surface work.

---

## §9 · COMMIT BOUNDARIES — five, none red, none ultracode

| Commit | Contents | Ultracode | Why this boundary |
|---|---|---|---|
| **C1** | item 6 — `DebateColumn.tsx:58-66` + the orphaned `Button` import | ⛔ **NO** | Smallest, fully isolated, zero test movement (G-1, G-2). Lands green and proves the branch is dead |
| **C2** | item 1 — `PriceBar.tsx:64,:73` **and** the recaptured `DETAIL_BASELINE` in `price-bar-presets.test.tsx` | ⛔ **NO** — ordered proof obligation (V-1 capture-after-change), fails §6 condition 4 | **Must be ONE commit.** Splitting them lands a red suite at the boundary — H9 |
| **C3** | item 4 — `error.tsx` **and** `page-container.test.ts`'s 10th SITES entry + three `9`→`10` | ⛔ **NO** | G-3: same commit or the no-change proof silently under-covers |
| **C4** | items 2 + 3 — `MarketHeader.tsx` Đ site 1 + pluralisation + the new `market-header.test.tsx` | ⛔ **NO** — RED-first guard on new behaviour (§5.6), an ordered obligation | Tests-first: `market-header.test.tsx` RED, then the source, then green |
| **C5** | item 5 — `MarketHeader.tsx` dev-box removal (`PD-3-09`) | ⛔ **NO** | **Deliberately SEPARATE from C4** so the removal is legible in the Gate C diff and does not ride C4's ordered RED-first proof |

**Grouping notes carried from v1.0, both accepted:**
- The relay's `{2,6,7}` grouping was corrected — those were allow-list indices for two test files now struck (G-1, G-2), leaving `DebateColumn.tsx` alone as **C1**.
- **NO commit in this PR takes ultracode.** C2 and C4 fail `CLAUDE.md` §6 condition 4 outright (ordered proof obligations); C1, C3 and C5 are single- or two-file units with no independent parallel work and fail condition 3. §6's default is FORBIDDEN and nothing here meets all four.

⚠ **V-1 on C2, unchanged:** edit → render → dump `container.innerHTML` → paste. **Authoring the literal and making the component match INVERTS the proof.**

**Ordering rationale.** C1 first (smallest, proves dead code). C2 second (the one material visual change, isolated). C3 third (additive, no interaction). C4 fourth (the ordered RED-first unit). C5 last (a clean two-line deletion, legible on its own). Every commit is independently green.

---

## §10 · ⛔ DENY-LIST BELT — BY DIRECTORY, in the plan (§13.4)

A relay-only fence dies with the session. These live here.

```
⛔ src/server/**
⛔ src/server/moderation/**
⛔ src/app/(admin)/**
⛔ src/app/(admin)/admin/moderation/**
⛔ src/components/debate/composer/**
⛔ src/db/**
⛔ drizzle/**
```

**`src/server/moderation/` is a `CLAUDE.md` §1 CRITICAL PATH.** Reading `load-debate-view.ts` to understand how masking reaches the DTO is **expected**; treating the moderation pipeline as inspectable surface is **not**. No moderation file is read *for the purpose of changing it*, and none is written.

**Live temptations this belt exists for, all measured:**
- `src/app/(admin)/admin/moderation/_components/ReviewFeed.tsx:166` carries `Đ{formatDharma(row.authorDharma)}` — the **unspaced** form D2 normalises. ⛔ **admin, out of scope.** It is also `CC-9`'s chip, owned by `.8`.
- `src/components/debate/composer/SellModule.tsx:268` and `BetComposer.tsx:513` render a standalone `Đ` prefix. ⛔ **composer, out of scope**, and structurally different (an input adornment, not a value label).

⚠ **v1.1 — four files are now out of scope by RULING, not by directory, and the belt cannot see them.** `PostCard.tsx` · `ReplyCard.tsx` · `ArgProfile.tsx` · `AggregateFooter.tsx` all live inside `src/components/debate/`, which is **not** deny-listed. **They are excluded only by §8's allow-list.** Four of D2's five sites and all of R1's live work sit in them, so the temptation is direct and the guard is the allow-list alone — an edit there is ⛔ RUN-STOP condition 3, not a per-delta halt.

---

## §11 · ⛔ NO-EDIT SYMBOLS IN `DebateView.tsx` — by symbol, never by line

`DebateView.tsx` is off the allow-list (D7 · D8) and is **not written**. These are named by symbol because this file's own documented coordinates drifted **+67 and +36** lines (D-E) — a line-keyed fence would have pointed at the wrong code.

```
⛔ toggleEntry
⛔ marketColumnBody — and its `viewer === null` branch
⛔ the post-view composer branch — and its auth branch
⛔ the four composer mounts
```

Any finding against these lands as a **register row on PR 1's ownership** (BD-1), never as an edit.

---

## §12 · HALT GRADES

**Per-delta halt** — that item stops, the run continues, the item is reported with its evidence.

**⛔ RUN-STOP** — write `~/Downloads/POLISH-3-PR1-HALT-<n>.md` (what tripped · the file · the finding · what I would have done next) and **STOP**. No routing around, no defer, no note-and-continue.

⛔ conditions:

1. `origin/main` advances mid-run — every measurement in this plan is keyed to `a56943b`.
2. A ratified ruling proves unexecutable.
3. Any instruction requires writing outside §8's allow-list. ⚠ **Includes the four PR-2 component files, which the §10 belt does not cover.**
4. The plan turns out jointly unsatisfiable with itself.
5. **Item 6 appears to require deleting `DebateColumn.tsx`'s fallback branch (`:49-70`) or making `header` required, rather than removing the Button at `:58-66`** — a structural refactor of a shared component's TYPE. **Ratified narrow at v1.1.** It also breaks four assertions (G-1, G-2).
6. **A `loading.tsx` is found or wanted under `m/[slug]/`** — D4 omits it deliberately, and `(auth)/error.tsx:53-57` is R-C stating why.
7. **`no-raw-hex-view-layer.test.ts` reddens** — the new `error.tsx` is auto-enrolled and must carry no hex literal.
8. **`PriceBar.tsx:17-20` or `:81-99` needs editing** — that is d5's structural `.barrow` form, which PD-3-01's *"only the numbers are open"* forecloses (D-J).

Base halts H1–H17 (`POLISH-SURFACE-TEMPLATE.md` §5) are inherited unchanged.

**Per-surface halt slot:** *a **SIXTH** D2 site is discovered beyond the five enumerated in D-A.* The enumeration is the count; a sixth site means the measurement was wrong and item 2's PR-1/PR-2 partition rests on a bad denominator.
*(F2 — v1.0 read "a fifth D2 site… outside the five enumerated," which named a site already inside the set and so could never fire. A miscount inside a halt condition silently disarms it.)*

---

## §13 · §13.1 PRE-FLIGHT — every stop condition run against this plan's own text

**Re-executed against the v1.1 shape. Result: satisfiable, with four carve-outs written in advance.**

| Condition | Run against this plan | Verdict |
|---|---|---|
| **H7** ⛔ any ADR/SPEC edit required | PR 1 edits no ADR and no SPEC. Canon appends batch to the close-out | ✅ clear |
| **H8** ⛔ `tokens-monochrome.test.ts` red | No token is defined or changed | ✅ clear |
| **H2 / deny-list** `src/server/**` | No item touches it | ✅ clear |
| **H3** ADR-0034 D-1 — a field on `DebateViewModel` | No item adds a field. Items 2/3 re-render data already in props; item 5 deletes a static element | ✅ clear |
| **H4** crossing into another surface | Allow-list #5 is under `tests/unit/discovery/` — **carve-out 1**, §8 | ✅ carved |
| **H6** a named baseline does not exist → class S | **Item 5 was the risk.** Baseline named and verified in-repo: `surface_d5_v1_0.html:447` + `:251-252` (D-I(a)). Class V holds | ✅ clear |
| **H13** a mockup colour ported by name where it encodes a side | Item 1 changes two size tokens. `bg-yes`/`bg-no` untouched; `price-bar-presets.test.tsx:122-135` asserts it | ✅ clear |
| **H14** a static guard finds an offender not in its predicted list | `no-raw-hex` auto-enrols the new `error.tsx`; predicted and stated (§7) | ✅ clear |
| **H15** a new guard green on first run | `market-header.test.tsx` is authored RED-first in C4 | ✅ clear |
| **H16** scope creep into a named out-of-scope row | `PostCard`/`ReplyCard`/`ArgProfile`/`AggregateFooter`, R4, D3, `PD-3-04`, `serialize.ts` all named out (§6, §8, §10) | ✅ clear |
| **§6 edit boundary** — *"any file outside the declared component list"* | **carve-out 2** | ✅ carved |
| **`UI-19-log.md`'s "Never `git add` this file"** | **carve-out 3** | ✅ carved |
| **PR 1 is source-only (D-1)** | No `docs/**` write in PR 1 — the anchors go to commit 0 | ✅ clear |
| **PR 1 mints no register ID** | §0 and §6 consume six commit-0 IDs; no allocation is performed here | ✅ clear |

**The four carve-outs, written in advance so no judgment call is left to the run — unchanged from v1.0:**

**Carve-out 1 — allow-list #5's path is not a surface crossing.** Stated verbatim in §8. **H4 does not fire.**

**Carve-out 2 — §6's "declared component list" is §8 of this plan.** §6 forbids *"any file outside the declared component list."* This plan **is** the declaration; §8 is the list. All eight entries are inside the boundary by construction. (Commit 0's separate `docs/**` carve-out is D-1's own amendment to §6 and is not relied on here — PR 1 writes no docs.)

**Carve-out 3 — `docs/logs/UI-19-log.md`'s header instruction is overridden, in commit 0 only.** The file says *"Never `git add` this file."* `docs/parked.md:1464-1476` (`UI19-LOG-SELF-DESCRIPTION`) ratified overriding it at **POLISH.3's kickoff**, which is now, scoped to *"One-line header correction; no other content changes."* **The override is commit-0's, not PR 1's** — PR 1 never touches the file. ⚠ **The contradiction is NOT resolved by untracking**: `tests/unit/docs/session-logs-survive.test.ts:70` asserts a `>= 150` floor over **tracked** session logs.

**Carve-out 4 — this plan's own text may quote guarded strings.** §3 transcribes ruling text containing `Đ BET`, `Support / Counter` and `Read more`, and §6/§7 quote them again. **No stop condition fires on the verbatim text of this plan or on its commit.** (Written per §13.1's own lesson: a guard that fires on the document defining it is broken, and POLISH.8's S-0a made an unattended run take that judgment call.)

**Joint-satisfiability check, re-run.** The plan mandates: commit 0 merges first (D-1) → PR 1 is source-only → PR 1 mints no ID → every source file it names is in §8 → every test it moves is in §8 → no commit lands red (§9) → no ultracode anywhere (§9). **No pair of these excludes the other.** Two tensions are closed rather than left to the run: §6's file-list prohibition by carve-out 2, and the four PR-2 component files — which sit inside a non-deny-listed directory — by ⛔ condition 3 naming them explicitly (§10, §12).

---

## §14 · VERIFICATION

**Before each commit**, unpiped, to a log, exit code echoed — never piped to `tail`, which exits with `tail`'s 0:

```
ZUGZWANG_ENV=preview just verify > /tmp/p3-pr1-verify-<n>.log 2>&1; echo exit=$?
```

`ZUGZWANG_ENV=preview` is required — `next build` rejects `"unknown"` at the `getRedisKey` gate (AGENTS.md §2). Env-only, not a regression.

⚠ **`just verify` runs BEFORE the commit, not after.** Lefthook's `pre-commit` runs Biome with `stage_fixed: true` and **silently re-stages** what it repairs, so a post-commit run is blind to what the hook fixed.

**Full suite** — ~35 min, backgrounded, exit captured:

```
pgrep -f 'node.*vitest'                     # H12 — a second runner manufactures a false RED
pnpm vitest run > /tmp/p3-pr1-suite.log 2>&1; echo EXIT=$?
```

Non-TTY Vitest prints no per-file progress; gauge liveness by log growth, not by silence.

**Critical-path suites** are not triggered — no `src/server/**`, no schema, no migration. `just verify` + the full suite are the gate.

⚠ **CI is `pull_request`-gated only.** A branch push has **no remote gate**; local `just verify` + `pnpm vitest run` are the only pre-PR proxy. Do not promise "push and wait for CI green" before the PR exists.

**Targeted re-runs** for the moving files: `pnpm vitest run tests/unit/discovery/render/price-bar-presets.test.tsx tests/unit/debate/render/ tests/unit/shell/page-container.test.ts`.

---

## §15 · REVIEWERS

`@code-reviewer` **and** `@security-auditor`, **sequentially, one DB-touching reviewer at a time** (concurrent subagent runs saturate local PG and manufacture flakiness).

⚠ **Launch from the detached worktree at `a56943b`**, not the primary tree — agent definitions load from the session's working directory at launch and are not hot-reloaded, and the primary tree is on `polish/8-close-out` @ `08fe0b3`, **behind main**. A subagent dying at 0 tool_uses is a stale model pin.

**Each reviewer must leave at least one FALSIFIABLE, repo-checkable receipt** — a quoted `file:line` it read, a re-derivable count, or a mutation it was shown to catch. **No mechanism proves a subagent ran: a clean pass and a dead-at-zero pass produce identical artifacts.**

Suggested receipts (each independently verifiable):
- `@code-reviewer` — quote the recaptured `DETAIL_BASELINE` and state the two class tokens that changed; re-derive `sideBadgeSites.length` and confirm 13.
- `@security-auditor` — confirm no allow-list file reads `comments.body` (SC-1 does not fire: no read over `comments` is added or edited); confirm the new `error.tsx` renders **nothing** from `error` — not `message`, `stack`, `digest` or `cause` — against `(auth)/error.tsx:32-47`'s stated treatment, **including the client arm**, which is the one that leaks in production (D-H).

**Every finding is reported INDIVIDUALLY at its assigned severity with `file:line`** — never "a CRITICAL plus two HIGHs". Every reviewer answers as separately-stated points, **never a bare PASS**; a bare PASS twice is H10.

⚠ **Kickoff reviewer sequence is ratified scope.** Both are named here; neither is added nor skipped at execute without surfacing it as a PR deviation.

---

## §16 · §4.2 S1 — recorded ONCE

**§4.2 S1 states that mockup silence never authorises removing a shipped affordance.** R1 and D3 remove three shipped controls. **They are FOUNDER RULINGS with stated reasoning, not mockup silence** — R1 on redundancy (`SlotHeader` carries a live per-column entry) and on thesis grounds (mandatory commentary is meant to make argument deliberate); D3 on the same redundancy ground. **S1 therefore does not bar them.**

**Scope of this record: S1 is INERT for PR 1.** Under OD-1, R1's two `PostCard` controls and D3's `BookmarkToggle` control are **PR 2's**. The only R1 work in PR 1 is item 6, whose control is **unreachable dead code** — both `DebateView` mounts pass `header`, so nothing shipped changes and no affordance is removed from any participant's screen. **S1 goes live at PR 2**, where the three visible controls are removed; PR 2's plan carries this record forward.
*(F4 — v1.0's parenthetical made this conditional on an unresolved OD-1. OD-1 is ruled; the condition is discharged.)*

⚠ **Item 5 is not an S1 case at all.** The dev placeholder box is not a shipped *affordance* — it is a non-interactive labelled stub with no control, no handler and no accessible role. It is removed on a **tier-4 baseline** (D-I(a)), which is the ordinary V-class route, not on silence.

---

## §17 · E3 — UNEXECUTABILITY, re-answered against v1.1

**All six open decisions are RULED. Every ruling is executable. Three items carry conditions, and one earlier finding is withdrawn.**

### The six rulings, and their executability

| OD | Ruling | Executable? |
|---|---|---|
| **OD-1** | `PostCard` · `ReplyCard` · `ArgProfile` · `AggregateFooter` → **PR 2** | ✅ **Yes.** §8 strikes all four. ⚠ Carries a consequence, now recorded rather than discovered: `PD-3-07` is consumed PARTIAL and D2's other four sites ship unguarded until PR 2 (§7 rider, F3) |
| **OD-2** | R4 → PR 2 with `PostCard` | ✅ **Yes.** Item 7 struck. D-F's token mapping is carried forward so PR 2 does not rediscover the raw-hex hazard |
| **OD-3** | Six items, no total carried | ✅ **Yes.** §6 is a numbered table of six rows and no sentence anywhere states a total |
| **OD-4** | Dissolved; commit 0's numbers stand | ✅ **Yes.** §0's "minted" leg struck, replaced with six consumed IDs. **PR 1 allocates nothing** |
| **OD-5** | `preset="notice"`, §4.2 B3, flag for Gate C | ✅ **Yes**, and the named obligation is discharged — see below |
| **OD-6** | Dev box in PR 1 as item 5, `PD-3-09` | ✅ **Yes**, and both attached obligations resolve in favour of removal — see below |

### OD-5's obligation — `(auth)/error.tsx` READ, and it does not contradict `notice`

Full finding at **D-H**. In short: it declares **no container**, because its layout supplies one; `(public)/layout.tsx` supplies none, so `/m/[slug]/error.tsx` must declare one and `(auth)` is silent on which. **No contradiction. No Gate C note needed on the preset from this file** — though the preset itself remains flagged for Gate C per §4.2 B3, as ruled.

⚠ **The founder's correction of my v1.0 inference was right and I accept it.** "Match your route" was inferred from n=2 with an unbreakable confound. What the repo actually supports is *"declare one iff your layout does not"* — which is silent on the preset, exactly as the ruling assumed.

**Two bonuses from the read, both folded in:** `(auth)/error.tsx:32-47`'s error-rendering treatment is now item 4's spec verbatim and `@security-auditor`'s receipt (§15), and `:53-57` is **R-C stated in the file D4 names**, making D4's `loading.tsx` omission precedent-verified rather than inferred.

### OD-6's two obligations — both discharged, both toward removal

**(a) Tier-4 baseline: NAMEABLE. Class V, not S.** `surface_d5_v1_0.html:447` + `:251-252` (+ `:225`, `:262`). ⚠ **And the premise in the ruling is inverted in a way worth stating: it is not that "d5 renders no such box" and therefore has nothing to say.** d5 renders **both** things the stub names — market media and resolver cards — as *designed header elements*. The baseline is that header; the built dashed stub has no counterpart in it. That is an ordinary V divergence, and **H6 does not fire.** Verified in-repo, not asserted: the mockup is at `docs/design/mockups/surface_d5_v1_0.html`, 1,929 lines.

**(b) Dev-gating: NONE. Removal proceeds; the per-delta halt does not fire.** Zero hits for `NODE_ENV`, `process.env`, `ZUGZWANG_ENV`, a flag or a prop in `MarketHeader.tsx`. `<DeferredPlaceholders />` is unconditional at `:102` and the function returns unconditionally. **"Rendered to participants" is TRUE.**

⚠ **One cost, stated so it is chosen and not incurred:** the box is the only on-screen trace that two ratified-but-unbuilt d5 elements are missing. **The record survives it** — `POLISH-0.md:214` and commit 0's `MEDIA.2-GOLIVE` row both carry it (D-I).

### 🔴 WITHDRAWN — my v1.0 test for OD-6 was wrong

v1.0 argued the dev box was out of scope because **"no ruling covers it."** **That test is wrong.** The twelve rulings dispose of *pre-existing open rulings*; a newly-found class-V defect is authorised by its **register row** and §4.2 B1. Withdrawn in full (D-C). The measured facts underneath it — file-private, orphans nothing, no test pins it — all stand and are what make item 5 cheap.

### 🔴 NEW — one finding that is NOT a ruling defect, recorded as a Gate C note

**D-J: d5's market-detail price bar is structurally a one-row `.barrow` (`:505`, labels flanking the bar, gap 9px), not the two-row `flex-col` form we ship.** D5's numbers verify exactly at the cited `:507-508`, but the structure differs too. **PD-3-01's *"only the numbers are open"*, D5's own wording, and `PriceBar.tsx:12-13` all scope PR 1 to the numbers**, so this is **not actioned** and **not a halt** — it is recorded so a later reader comparing `/m/[slug]` to d5 finds it measured rather than filing it as a fresh defect, and so *"only the numbers are open"* is read as a scoping decision rather than a complete description of the divergence. **⛔ condition 8** fences the structural change out of PR 1.

### Carried unchanged from v1.0 — still true

- **R10 cannot be executed by a machine PR** — `PD-0-11` is founder-set (P12); commit-0 doc work under D-2 plus a close-out canon append as `C-PRICEBAR-1`. Nothing for PR 1.
- **R14 is executable but was unstaffed** — now commit 0's, at `PD-3-05` / `PD-3-06`. Its canon dispositions append under the `C-` form, **never as `R14`**.
- **D5 is unexecutable without `price-bar-presets.test.tsx`** — allow-list #5, carve-out 1.
- **D2's "FIVE sites" needed no amendment** — my head check was wrong, not the ruling (D-A).
- **D-3 (the decision) was already discharged on disk** — the correct execution is to do nothing; the file leaves the allow-list (G-1).

### Nothing in these rulings is unexecutable

Every OD ruling, and every one of the twelve, is executable as written within §8's allow-list and §9's commit boundaries — with the three conditions above (`PD-3-07` partial · the four unguarded D2 sites owned by PR 2 · the d5 structural divergence fenced out) recorded rather than absorbed.

---

**End of plan v1.1.** Ground `a56943b` · worktree clean · nothing written to the repository.

---

## §18 · Ratified amendments after v1.1 — founder, 2026-08-12

**v1.1 stands. These are execute obligations, not a revision.** Recorded here rather than in a relay, because a relay-only obligation dies with the session — O-1 applied to itself, and §13.4's whole ground.

| ID | Obligation |
|---|---|
| **C-1** | §6 item 2's discriminating condition cites `Đ 14,260 staked`. **That literal is Discovery's hero fixture** (`hero-panels.test.tsx:123`), not `MarketHeader`'s. Read the value off `price-chart.test.tsx`'s `MarketHeader` fixture at execute, and **assert the space, not the number.** A discriminating condition whose literal comes from another surface cannot discriminate. |
| **C-2** | §5 G-3 asserted the `notice` class string with no `file:line`. It was **verified correct** at `src/components/shell/PageContainer.tsx:41` — and it is now moot under **R-b**. Standing rule regardless: read every class literal off `CONTAINER_PRESETS`, never off a plan. |
| **C-3** | Superseded by **R-a**. |
| **C-4** | **C5 must leave `market-header.test.tsx` GREEN.** C4 lands that guard RED-first; C5 then deletes the dev box from the same file. If C4's guard queries container-wide, C5 moves it. **State the verdict in the log** — do not discover it at the commit boundary. |
| **C-5** | §17 OD-3's clause *"no sentence anywhere states a total"* is **deleted** — it is itself a negative counted claim, inside the section ruling on counts. §6's numbered table is the evidence. |

### R-a · The `page-container.test.ts` edit — SUPERSEDES §9 C3's description

**`SITES` is NOT touched. No 10th entry. No `9`→`10`.** `SITES.before` is defined at `page-container.test.ts:46` as *"VERBATIM className on disk at `c5892bc`. Never edited to match code."* **A file that did not exist at `c5892bc` has no `before`**, and authoring one inverts the POLISH-1b no-change proof in the suite whose entire purpose is that proof — the same inversion V-1 fences on `DETAIL_BASELINE`.

**Instead, one purely additive assertion:**

1. A `GREENFIELD` array, each member a file path plus a one-line reason it has no `c5892bc` baseline. **Sole member at PR 1: `src/app/(public)/m/[slug]/error.tsx`.**
2. **BIDIRECTIONAL SET EQUALITY (N5), asserted BOTH ways:** `{every <PageContainer> call site on the tree} === {SITES.file} ∪ {GREENFIELD.file}`. ⚠ **A one-directional "every tree site is covered" assertion is GREEN ON FIRST RUN — H15** — because the tree holds nine sites and all nine are in `SITES` today. The RED comes from the **second** direction only: `GREENFIELD` names a file disk does not have.
3. **Scope: `src/app/**` + `src/components/**`.** ⚠ **Not `src/app/(public)/**`** — that misses `SITES` site 8, `src/app/(auth)/layout.tsx:89`, and a guard blind to part of its own domain reads as discharged over all of it (N8). Measured: nine call sites under the two roots, **zero anywhere else in `src/`**.
4. **Reuse `callSite`'s `/<PageContainer\b[^>]*>/`** (`:123`). ⚠ **Never a bare string match.** Four files name the primitive in prose without being call sites, two because their container absence is *ratified* — and `tests/unit/auth/auth-error-boundary.test.tsx:90-94` records this repo already going RED on correct code for exactly this reason. A second reader would reintroduce a solved problem (O-1).
5. ⚠ **ORDER IS LOAD-BEARING: `GREENFIELD` is populated BEFORE `error.tsx` exists.** Writing the file first makes both directions pass immediately and H15 fires for an accidental reason.

**C3 is ONE commit:** write the guard → run → **capture the RED to a log** → write `error.tsx` → run green → commit both, with the RED capture pasted in the commit body. H15 is satisfied by the observation; H9 is never tripped. `callSite` **throws** rather than returning null, so the RED reads `no <PageContainer> found in …` — recognise it as the intended failure, not a harness fault.

### R-b · OD-5 RE-RULED — `preset="debate"`, not `notice`

The v1.1 ruling of `notice` is **withdrawn**, on two facts measured after it was taken:

- **`PageContainer.tsx:40` scopes `notice` to a single named consumer** — *"the branded `(public)` 404 (site 1)"*. Adopting it for an error boundary widens that comment's stated purpose, so the comment becomes inaccurate unless edited in the same commit.
- **`PageContainer.tsx:19-23` names `/m/[slug]` as a D2b owner** — *"Collapsing the four to fewer is **D2b**, and it belongs to POLISH .2/.3/.5/.6"*. Adding a second consumer to a scoped preset **on the surface that owns the collapse decision** takes a bite out of D2b under a cosmetic gate.

`debate` is the route's own preset, adds no consumer to a scoped one, and touches no doc comment. **§4.2 B3 still applies — flag it at Gate C.** ⚠ `(auth)/error.tsx` was read as required and is silent on the preset: it declares **no container at all**, because its layout supplies one and `(public)/layout.tsx` supplies none. The tie was genuinely unbroken by the repo, which is why B3 governs.
