# POLISH.3 · PR 2 — CARDS · the plan

**Target:** `docs/plans/POLISH-3-PR-2.md` · **Contract:** `POLISH-3-PR-2_plan-contract_v1_0.md` v1.0
**Authored:** 2026-08-13, plan-mode · **Measured at:** `origin/main` = `ea1795e` (v1.4 re-key, §1 · §20)
**Ownership:** W = web-authored (contract §C, transcribed) · C = CC-measured · F = founder-ratified

---

## §0 · Admit-check — verifiable in the medium this travels in

| Property | Value |
|---|---|
| md5 | `⟨STAMPED AT COMMIT — see §0.1⟩` |
| Lines | `⟨STAMPED AT COMMIT⟩` |
| Sections | **22** — §0 … §21, none absent |

**A claim a reader can falsify without the repo.** `src/components/debate/composer/SlotHeader.tsx` is **never edited by PR 2**. Grep this file for `SlotHeader`. Every line carrying it sits in **§0** (this claim), **§1** P1 ground (b) (a merge precondition, now MET), **§2** (the exclusion), **§4** (a bucket-D citation), **§11** (a no-edit symbol), **§16** (the S1 record), **§17** (an arbitrary-value precedent) — **all exclusions, preconditions or citations. Zero in §6, §8 or §9**, the three sections that define work. **A hit in §6, §8 or §9 falsifies the plan.**

⚠ **No number is stated here, deliberately.** A count would need an instrument to be checkable — `grep -c` returns lines, `grep -o | wc -l` returns occurrences — and under the natural reading of *"occurs N times"* the line-count answer is simply false. **The section distribution is the load-bearing claim and it needs no number**; the reader greps and reads the section each hit falls in. *(GC-4, Gate C read 1.)*

*(This claim has been wrong **three times**, each time in its numeric half and never in its section-distribution half. Draft 1 asserted "only §2 and §10", and §10 contains no such string. Draft 2 said "six times"; the H-T1 amendment added a seventh line in §17 and the count went stale the moment the plan was edited. Draft 3 said "seven times" — true by `grep -c`, false by occurrence count, **and Gate C read 1 found it by running a different instrument than the author had.** Drafts 1 and 2 were caught by §13's pre-flight; draft 3 was caught by a reader.)*

⚠ **v1.4 · ONE POINTER IN THE CLAIM MOVED, AND IT IS CORRECTED HERE RATHER THAN LEFT TO DRIFT.** v1.3 routed the §1 hit to *"P2"*. Under v1.4's §1 the surviving precondition is **P1**, whose ground (b) carries the string; **P2 is struck** (it was *"re-read `origin/main` after P1"*, which v1.4 has now performed). **The section distribution is unchanged — §1 still carries exactly one hit.** Recorded because a pointer inside the admit-check is exactly the kind of coordinate `O-8` says goes stale from the edit it guards.

⚠ **THE LESSON, AND IT BEARS DIRECTLY ON §13.3.** Three failures, one cause: **the number was the fragile part and it was never the load-bearing part.** §13.3's rule is *"delete the count, or make the count and the enumeration the same artifact."* Applied literally here, the count is simply deleted — the enumeration (a section list a reader can verify one hit at a time) survives alone and cannot go stale. **A count that must be re-verified on every edit is a count that should not be prose.**

*(Queued for V-space. ⚠ **The blocking event has occurred and the item did NOT mint.** `V-9`'s double-booking was resolved at POLISH.5/.6 commit 0 — §6 G-b, now **CLOSED** — and the two numbers issued there are *an inherited enumeration is a citation* (`V-9`) and *a register cell is not a baseline* (`V-10`). **This lesson is a third and is neither.** It stays queued, owner unchanged: **web mints at the POLISH close-out**, into `POLISH-0_data-manifest.md` §5, which is the only register that can mint a `V`-number and is **not** on §8's allow-list. ⛔ **Its number is NOT stated here.** Read the live high-water at mint time. Writing a number into this plan would be a `V-9` instance in the paragraph that queues a `V-9`-adjacent lesson.)*

⛔ **DO NOT CLEAN THIS UP.** The correction history is the only evidence the check works. A future reader who deletes it removes the proof and leaves an assertion.

**§0.1 · Why the stamp is deferred.** A file cannot carry its own md5. It is computed at the commit that lands this file and written into the commit body — **not** back into §0, which would invalidate it. ⚠ This is `PF-6`'s rule applied to this plan's own admit-check: the receipt records the mechanism **used**, and the mechanism is "stamped at commit", not "self-declared".

---

## §1 · Ground — and the A3 precondition, DISCHARGED

Every fact carries the command that proves it. Re-run all of them at the branch point; §20 is the procedure.

| Fact | Value | Proving command |
|---|---|---|
| Branch point | `origin/main` = **`ea1795e`** | `git rev-parse origin/main` |
| PR 1 merged | `af3a070`, PR #328 | `gh pr view 328 --json mergeCommit,state` |
| PR-1 log merged | `16971cd`, PR #329 | `gh pr view 329 --json mergeCommit,state` |
| Open PRs | **two — #335 and #337, both HTML-FINISH.** ⚠ Neither gates PR 2 (**R-1** below) | `gh pr list --state open` |
| ADR ceiling | **0036**; next free **0037** | `ls docs/adr/` — read the highest, never count (O-2) |
| Migration head | `0024_bookmarks`; PR 2 ships **no DDL** | `ls drizzle/migrations/ \| tail -1` |
| Mockup baseline | `surface_d5_v1_0.html` md5 `34619dac…`, **1929 lines — re-verified at `ea1795e`, unmoved** | `md5 docs/design/mockups/surface_d5_v1_0.html` |

### ✅ §1.1 — **STRUCK.** All four declared-absent artifacts are on `main`

v1.3 §1.1 declared that `POLISH-5.md`, `O-8`, `V-9`/`V-10` and `PD-3-15`'s re-anchor were **not** on `origin/main` and would land with PR #330. **#330 merged as `c8ba802`. All four are on `main`, verified at `ea1795e`.** The declaration was a dated measurement of a condition that has resolved; it is **struck, not re-pointed**, and the sites it excused no longer need excusing.

⚠ **The `O-6` declaration it carried is struck with it** — PR #330's mid-read commit `92dcb02` is now ordinary history inside a merged PR.

### ⛔ ⇒ NOTHING IN THIS PLAN IS **GROUNDED** ON `docs/plans/POLISH-5.md`

**The ground, stated once so it is not re-derived.** `POLISH-5.md` is **mid-correction**: it carries four known-wrong sentences, its sweeping close-out **does not exist** (POLISH.6's close-out is ABSENT — no log, no PR, no branch), and its own §0.3 / §15 disagree about PR 2's queue position. **A plan does not gate itself on a document in that state.** Every fact v1.3 took from it is re-grounded below in a **measured SHA or a live file**, which cannot be mid-correction.

**⚠ THE CHECK IS AN ENUMERATION, NOT A COUNT — AND THE FIRST DRAFT OF THIS SECTION GOT IT WRONG.** v1.4's first pass wrote *"cites it NOWHERE — `grep -c 'POLISH-5'` → 0"*, and **the grep returns 9.** The number was false the moment it was written, because **a document cannot record striking a citation without naming the document it struck.** ⛔ That is `§0`'s failure mode exactly — *a count that must be re-verified on every edit is a count that should not be prose* (`§13.3`) — reproduced, inside the plan that carries `§0`. **Deleted and replaced with the enumeration, which is what §13.3 prescribes:**

| Where the string survives | What it is |
|---|---|
| **§1** — this block, and `R-2`'s statement of the §0.3 / §15 ambiguity | a **record of what was struck and what was resolved** |
| **§13** — the pre-flight row that INVERTED | a **result**, reporting the striking |
| **§21** — docket row 7 | a **defect filed against that file**, owned by POLISH.6's close-out |
| end-matter | the **change record** |

⇒ **THE FALSIFIABLE CLAIM, which is the one that matters:** **§2 through §12 and §14 through §20 contain zero hits** — every section that defines a work item, a fence, a gate, an anchor, a halt grade or a forecast. **Grep those section ranges and find nothing.** §1's surviving precondition grounds on **`b7c2a38`**; §6, §8, §9 and §20 ground on **greps at `ea1795e`**; §12 grounds on this plan; §18 on the register. **Not one of them can move when `POLISH-5.md` is swept.**

### ✅ R-1 · THE SERIAL RULE DOES NOT GATE PR 2 — FOUNDER-RULED 2026-08-15

**The ruling.** #335 and #337 are **HTML-FINISH's track, not a POLISH machine phase.** The one-machine-phase-PR-at-a-time rule does not reach across tracks.

**⇒ AND THE MEASUREMENT THAT SUPPORTS IT, BECAUSE A RULING RECORDED ALONE IS NOT CHECKABLE.** The rule's first protection is that **a regression bisects to a surface**. That protection survives here because the two write sets are **DISJOINT** — measured at `ea1795e`, not asserted:

| | #337 (HTML-FINISH · PROFILE) | PR 2 (this plan, §8) |
|---|---|---|
| Source | `src/app/(public)/u/[pseudonym]/page.tsx` · `src/components/profile/{ArgumentList,IdentityCard,PositionsTable,ProfileTiles}.tsx` · `src/components/shell/PageContainer.tsx` | `src/components/debate/**` (8 files + `chart/`) · `src/components/bookmarks/BookmarkToggle.tsx` · `composer/ReplySplitBar.tsx` |
| Tests | `tests/unit/profile/render/**` · `tests/unit/shell/page-container.test.ts` · `tests/unit/design/profile-height-chain.test.ts` | `tests/unit/debate/render/**` |
| Docs | `docs/design/design-canon.md` | ⛔ none |

**Intersection: EMPTY.** `gh pr view 337 --json files` ∩ §8's twenty-two rows → **zero paths.** A regression on either PR bisects to its own surface. ✅ **The protection holds; the ruling costs nothing.**

> #### ⚠ ONE COUPLING SURVIVES THE DISJOINTNESS, MEASURED NEUTRAL TODAY — DO NOT TREAT DISJOINT WRITE SETS AS DISJOINT EFFECTS
>
> `tests/unit/debate/render/side-badge.test.tsx` (§8 row 20) **does not render components — it SCANS the source tree.** Its census walks `readdirSync(join(ROOT, "src"), { recursive: true })` over every `.tsx` and matches `/<SideBadge\b[\s\S]*?\/>/g`. **`src/components/profile/ArgumentList.tsx` carries two of the thirteen call sites, and #337 rewrites that file (+364/−91).**
>
> ⇒ **#337 could redden a PR 2 allow-list file without writing it.**
>
> ✅ **Measured, and it does not:** `gh pr diff 337 -- src/components/profile/ArgumentList.tsx | grep '^[+-].*SideBadge'` returns **nothing**. #337 is **census-neutral**. **No action; the disjointness stands as ruled.**
>
> ⛔ **But the mechanism is live and is recorded so it is not rediscovered.** If #337 or any later HTML-FINISH commit adds or removes a `<SideBadge …/>` call site anywhere under `src/`, `side-badge.test.tsx` reddens and **PR 2 owns the file it reddens in.** §20 step 2 re-runs the census check at the branch point for exactly this reason.

### ✅ R-2 · §15 GOVERNS THE QUEUE — FOUNDER-RULED 2026-08-15. **PR 2 RUNS NOW**

**The contradiction this resolves, recorded so no reader re-derives it.** Two statements were simultaneously true and pointed different ways:

- **`POLISH-5.md` §15's chain gate table** gives PR 2's entry condition as **"PR B MERGED"** — met since `b7c2a38` (#333).
- **`POLISH-5.md` §0.3's ruled-chain diagram** places `.3 PR 2` **fifth**, behind `.6` and `.5 PR C`.

**Neither was wrong.** A gate is a **necessary** condition, not a **sufficient** one, so a plan can satisfy §15's gate and still sit fifth in §0.3's order. **The queue was ambiguous, not contradictory** — which is why it needed a ruling rather than a correction.

**⇒ FOUNDER-RULED: §15 governs. The gate is the queue.** PR 2's entry condition is PR B merged; PR B is merged; **PR 2 runs now.**

⚠ **The `D-4` amendment that produced the ambiguity was applied at two of three sites** (§0.3's prose and §15's `.6` row) **and not at §0.3's diagram.** That is `O-5` — *a durable amendment is applied at every site that states the superseded position* — live in the document `O-5` was minted from. **Not this PR's to fix** (§21).

### ✅ A3 · MERGE PRECONDITION — **MET.** Re-grounded in measured SHAs

**v1.3's P2 is STRUCK** — it required *"`origin/main` re-read after P1"*, and §20's re-key has now performed exactly that at `ea1795e` (zero drift on 22 source anchors). **One precondition remains, and it holds.**

| # | Precondition | State | Proving command |
|---|---|---|---|
| **P1** | **POLISH.5 PR B merged to `origin/main`** — ⚠ **ONE gate, TWO grounds** | ✅ **MET** — `b7c2a38`, PR **#333**, merged 2026-08-14T22:59:40Z | `gh pr view 333 --json mergeCommit,state,mergedAt` |

**Ground (a) · chain position.** PR B is PR 2's predecessor in the founder-ruled order. ✅ **Discharged by the merge itself** — `b7c2a38` is an ancestor of `ea1795e`; `git merge-base --is-ancestor b7c2a38 origin/main` exits 0.

**Ground (b) · surface movement — ⚠ THIS SURVIVES THE MERGE AND IS KEPT IN WORDS, BECAUSE THE MERGE FACT DOES NOT CARRY IT.** PR B's commit **B5** writes `composer/SlotHeader.tsx (SlotHeader)` as a named symbol-fenced exception **and mints `ui/thumb-glyph.tsx`**. **A column-head rewrite landed in the surface PR 2 measures its cards against.** PR 2 excludes both files (§2, §11), so nothing here is a write obligation — but the executor must know the column head is **not** the one PR 1 measured. **Measured, at `ea1795e`:**

```
git log origin/main --oneline -- src/components/ui/thumb-glyph.tsx
  → b7c2a38                                   MINTED, 61 lines, +61/−0
git diff --numstat 16971cd..ea1795e -- src/components/debate/composer/SlotHeader.tsx
  →  1  29                                    REWRITTEN at b7c2a38
```

⛔ **"PR B merged" alone is NOT a substitute for ground (b).** A reader who reduces P1 to the merge fact loses the only statement telling them the surface moved. **Both grounds are kept; only their evidence changed from a citation to a SHA.**

### 📕 GC-9's HISTORY — recorded, because the ordering ground it rested on has since moved

**What GC-9 found at Gate C read 2 (2026-08-14), and it was right at the time.** v1.2's P1 read *"POLISH.6 merged"*. The then-ruled chain placed `.6` **after** PR 2, so that gate could never open — PR 2 would wait on `.6`, and `.6` waited on PR 2. **An unsatisfiable gate**, correctly collapsed into the single PR-B precondition above.

**What has happened since, and it falsifies GC-9's second ground rather than its conclusion:**

- **The ordering ground moved.** `D-4` (founder, 2026-08-14) removed `.3 PR 2` from `.6`'s gate entirely.
- ⚠ **`.6` RAN FIRST, WITHOUT INCIDENT.** POLISH.6's machine phase merged as **`ea1795e` (#336)** on 2026-08-15 — six items, five commits — and **`git show ea1795e --stat` lists no `BookmarkToggle.tsx`.** GC-9 ground 2 argued that *"a `.6` that ran first would be recording an adoption that had not happened."* **It ran first and recorded nothing**, because `D3`'s recording obligation is filed at each surface's own close-out, not at its machine phase.
- ✅ **GC-9's CONCLUSION is untouched.** P1 = PR B merged was correct then and is MET now. **Only its supporting narrative is superseded**, and it is recorded here as history rather than carried as live reasoning.

⚠ **`.6` IS NOT A PRECONDITION AND MUST NOT BE RE-ADDED.** It is no longer PR 2's successor either — it has merged. **Neither direction is a gate.**

---

## §2 · What this plan does not do — **W**

- **MEDIA.2's content** — the carousel, the admin upload route, the composer pick-from-pool. Three separate build tasks under ADR-0026 §9. **PR 2 builds the SLOT, never the feature.** ⚠ See §4 bucket C: even the slot is deferred for the media panel (`HEADER-3ZONE`).
- **Any SPEC.1 / SPEC.2 amendment.** If the directive appears to need one → ⛔ HALT and surface (§12, H-SPEC).
- **Removing the two-slot reply preview.** Spec-mandated (SPEC.1 §9 F-DEBATE-1). The founder has confirmed he is not asking for this.
- **The four critical paths** — auth, bet engine, ledger, commentary/moderation.
- **`SlotHeader.tsx` and the column head.** Struck by web 2026-08-13. It resolves to `src/components/debate/composer/SlotHeader.tsx` — inside PR 2's own ⛔ deny-listed directory — and `parked.md:1685` records that **POLISH.4 owns the composer surfaces and `SlotHeader`.** ⚠ **Now additionally rewritten by PR B's B5 (§1 P1 ground b)** — a further reason not to reach for it.
- **`ui/thumb-glyph.tsx`.** Minted by POLISH.5 PR B (`b7c2a38`); its consumers are the slot-header thumbs, which are POLISH.4's.
- **The market-view split bar's TRIGGERS.** Bucket D — see §4.

---

## §3 · The founder's directive, and the two rulings that make it executable — **W · F**

> **The mockup is the design reference; the code is the features reference.** Market Detail's UI/UX, buttons, layout and user flow must match the HTML mockup for this machine run. Where content is unbuilt, the **structural slot** ships as a placeholder to be filled later (market media). Refinement lands at the later visual pass; **for now, mimic it.**
> *(Founder, ratified 2026-08-13. `chart` struck from the parenthetical — §4 B-3.)*

**The precedent is Discovery, and it is evidenced.** Built from the same shell and structurally faithful: `discovery/HeroPanels.tsx (HeroPanels)` three-panel hero · `discovery/DiscoveryCarousel.tsx (DiscoveryCarousel)` dots · `discovery/DiscoveryGrid.tsx (DiscoveryGrid)` four-across · `discovery/MarketCard.tsx (MarketCard)` card anatomy.

### RULING A — structure is copied; tokens are not

The mockup is light; the build renders in the ratified dark system (DESIGN.B1, CI-guarded). **Fidelity means layout, anatomy, affordance set and flow — never colour values.** Porting a hex literal reddens `tests/unit/design/no-raw-hex-view-layer.test.ts` and is a **halt**.

✅ Verified at `ea1795e`: the guard scans `SCAN_DIRS = ["src/components", "src/app/(public)"]` (`no-raw-hex-view-layer.test.ts:20 (SCAN_DIRS)`) — **every PR 2 target is inside it.** Ruling A is mechanically enforced.
✅ Carried forward: CD-A's `#989898` / `#FAFAFA` **are** `--color-n5` / `--color-ink`. Port form `text-n5 hover:text-ink` (`POLISH-0.md:26`).

### RULING B — the placeholder line

| | |
|---|---|
| ✅ **BUILD** | The **structural slot** — rendered as designed elements, correctly laid out, awaiting content |
| ⛔ **NEVER** | A box that **tells a participant that engineering has not finished something.** `PD-3-09` removed exactly that at PR 1. SPEC.1 `:482`: *"Markets **always** have media … there is **no empty-media state**."* A build-time note belongs in a **comment** |

**Q19 (a):** MEDIA.2 runs before go-live; the slot always carries content in production. **Slot now, content from MEDIA.2.**
**Q20 (a):** **ONE PR, structure first, cosmetics onto the rebuilt surface.** ⚠ If measured scope exceeds one green PR, the plan says so with ground. **§19 measures it and does NOT propose a split** — argument there, not assertion.

---

## §4 · Precedence applied — the classified divergence table — **C · F**

Every row carries its superseding citation. **Bucket D is not optional.**

### Bucket A — a PR 2 register row *(the enumeration is §6; not restated here)*

### Bucket B — structural, new work under the directive

| Item | Anchor | Disposition |
|---|---|---|
| `RESOLUTION` overline + container | `MarketHeader.tsx:80-82 (MarketHeader → description <p>)` vs `d5:467-471 (.criterion/.overline/.crittext)` | **Tier B-1**, §6 row T1. ✅ **RULED** (§17 H-T1): recipe `9.5px/800/.14em/uppercase/text-n4`; **local styles + docket**, no preset; ⛔ **no clamp** |
| Post-image slot geometry | `CommentImage.tsx:28 (CommentImage → img className)` vs `d5:648-654 (.argimg/.media)` | **Tier B-2**, §6 row T2. ✅ **RULED** (§17 H-T2): **aspect-respecting within a max box** — `--imgmax` on height, 100% width, `--imgr`. ⛔ No fixed box, so `object-fit` does not arise |
| Market-view split bar, **visual half** | `AggregateFooter.tsx:12-22 (AggregateFooter → render body)` vs `d5:1099-1102 (.barrow.f2)` | **Tier B-3**, §6 row T3. Read-only; no DTO change, no server touch. ⚠ **The anchor is the WHOLE render body — see §9 GC-10** |

### Bucket C — docketed elsewhere *(drafted, not committed by this PR unless §6 says so)*

| Finding | Row |
|---|---|
| Media panel + resolver/source cards + chart geometry + three-zone layout | **`HEADER-3ZONE`** — ONE row. ⛔ Not four; splitting it is the incoherent-header failure D6 was ruled against |
| Named resolvers with no schema; CONTENT.1 pack PK-only | **`RESOLVER-SCHEMA`** — two obligations, content-commit first |
| Per-document ID namespaces with no registry | **`ID-COLLISION`** — **six** instances (§21 adds the sixth) |
| Question type scale | **docketed**, design-system-wide, token-contract CI-pinned. ⛔ Not absorbed as a one-surface deviation |
| Carousel auto-advance (20 s) | **deferred to a named build task**; canon §88 is its spec |
| `.overline` recipe duplication | **third instance of `PLURAL-NOUN-DUP`'s genus** — §17 H-T1(b). ⚠ **The row carries the CENSUS** — the recipe plus its three out-of-fence consumers — so the crossing is inherited, not re-derived |
| **Criterion length treatment** | → **`HEADER-3ZONE`**, where the header layout is already being decided (§17 H-T1(c)) |

### Bucket D — mockup superseded; the build is right; change nothing

| Divergence | Superseding citation |
|---|---|
| **Price-impact warning modal** (`d5:1371`) present in mockup, absent in build | `design-canon.md:75` ruling 2 · `design-language.md:162` §3.1 named-retired · SPEC.1 1.0.15 (*F-BET-9 RETIRED*) · `DESIGN_W2_10_…html:501`. Build carries no slippage code |
| **Colhead `Buy`** (`d5:1052`, `:1221`, uppercased by `.tradebtn` `:559`) vs built `Đ BET` | canon W2.8 · `SlotHeader.tsx (SlotHeader → the colhead trade button)`. ⚠ `Sell` was **not** relabelled. ⚠ **v1.4: this row's former line fence is demoted to the symbol above — B5 rewrote this file** (§1 P1 ground b), which is `O-8` firing exactly as written |
| **Lane-dominance badges** absent from mockup (0 hits), built | SPEC.1 `:438`, `:447`, `:448` (ADR-0017 P3) · `badges.tsx:193 (LaneBadge)` |
| **Two-slot reply preview** absent from mockup; dead `.showall` CSS at `d5:846,849` with no consumer | SPEC.1 `:447`. Built at `ReplyPreview.tsx (ReplyPreview)`. ⚠ **PRESENCE only** — the expansion defect is `PD-3-10`, bucket A |
| **Market-view split-bar TRIGGERS** (`d5:1100`, `:1102` `.rbtn2`) absent from build | **`POLISH-3.md` R1** — *"Support / Counter on `PostCard` is removed on thesis grounds: entering post-focus to argue means reading the post first, and mandatory commentary is meant to make argument deliberate, not reflexive."* The `.rbtn2` pills are the same controls in a different container; re-adding them would undo PR 2's own R1 work **inside PR 2**. A mockup element losing to a ratified founder ruling — **not a compromise, not an unfinished build** |
| **Entry-price chip `YES @ 27%`** (`d5:1071`) | **`DEBATE.4 D7`** (`DEBATE.4.md:24`) — *"the side chip shows just the SIDE, **not `YES @ 27%`**"*. Build obeys at `ArgProfile.tsx:20-21 (ArgProfile → the D7 docblock)` |
| **Stake delta `Đ 1,000 → Đ 1,407`** (`d5:1073`) | **`DEBATE.4 D7`** + **OQ-1 HELD** (`UI-A3.md:42`) — *"rendering Đa or P/L before the SPEC.1 line lands is **a defect**."* Building it ships a ruled defect |
| **`Download .md`** (`MarketHeader.tsx (MarketHeader → export anchor)`) not in mockup | EXPORT.1 / ADR-0025. Build-only; **do not remove** |
| **Carousel numeric counter** vs mockup `.psfill` progress fill | The fill is the 20 s timer's readout (`d5:1725 (startFill)`); with auto-advance deferred it indicates nothing. Counter is a coherent substitute, not an omission |
| **`.crittext` 2-line clamp** (`d5:470-471`) absent from build | ⛔ **DO NOT ADOPT.** `market.description` is the **resolution criterion — the terms of the bet**. (i) A bare clamp with no affordance is the defect class `PD-0-01`/R4 is *removing* this same PR; (ii) U3 makes criteria long **by design**; (iii) unclamped **is the status quo** — the mockup would be *introducing* a truncation of the bet terms. Ruled 2026-08-13; §17 H-T1(c) |

⚠ **One divergence is NOT bucket D, and the distinction is load-bearing.** The **post-image slot aspect** cannot be filed here: bucket D requires a mockup element losing to a ratified decision, and on this point **the mockup declines to rule** — two aspects on purpose, the choice filed OPEN at `d5:241-244`. It is a **BUILD decision** (§17 H-T2), the only such row in this plan.

⚠ **`debate-export/serialize.ts:349 (serialize → the Support/Counter export line)` is ADR-0025 export copy, NOT a control.** R1 scopes from the STRING, so this is the one string a string-scoped sweep wrongly catches. Pinned twice (`serialize.test.ts:299 (the Support/Counter pin)` + the Mumbai fixture). ⛔ **Do not touch.**

---

## §5 · Step 0 — the governing artifact, pinned — **C**

**Contract C3 re-verified on the live repo, and it lands STRONGER than measured.** Parsed `var SRC` from `DESIGN_integration-shell_v1_0.html` (61 lines, md5 `ac46b144…`), base64-decoded all three blobs, hashed against the repo:

| Blob | Decoded md5 | Repo file | Repo md5 | Verdict |
|---|---|---|---|---|
| `discovery` | `68c65bd7…` | `surface_discovery_v1_0.html` | `68c65bd7…` | **BYTE-IDENTICAL** |
| `d5` | `34619dac…` | `surface_d5_v1_0.html` | `34619dac…` | **BYTE-IDENTICAL** |
| `profile` | `17053af7…` | `surface_profile_v1_0.html` | `17053af7…` | **BYTE-IDENTICAL** |

C3 claimed anchor-equivalence at exact line count (458 anchors, 0 misses). **It is equality, not equivalence.** `FRAMES = { discovery, d5, profile, bookmark:'profile' }`.

**Baselines have not moved — ⚠ RE-VERIFIED AT `ea1795e`, not carried.** The three files have **one commit in their entire history** — `5b28c49` (DC.3, PR #195). `md5 surface_d5_v1_0.html` at `ea1795e` = **`34619dacee472a245cb6e8678b509219`**, 1929 lines — identical to the value measured at `16971cd`. **Six merges landed in between and none touched them.**

⇒ **No artifact conflict. `docs/design/mockups/surface_d5_v1_0.html` governs.**

### ✅ C3's "Open" is CLOSED

C3 left open whether canon's *"frozen at integration v0.19"* conflicts with a shell reading v0.30 and a d5 blob reading DESIGN.5 v1.12. **Measured and resolved:**

- **Which artifact governs is not ambiguous.** Canon pins it three times: `design-canon.md:136-138` (*"🔒 v1.0 (blob-verified output)"*), `:161` (*"everything v0.29→v1.0 is baked into the artifact's blobs"*), `mockups/README.md:26-28`.
- **`:45`'s "v0.19" is a lineage note** — `:173` item 3 calls v0.19 *"the Market-Detail close-out"*.
- ⚠ **But it is measurably wrong about the blob.** Decoding the `d5` blob from all 38 shell revisions: it changed **16 more times after v0.19** (`+171 / −48` lines, 15 hunks) and **froze at v0.35**, not v0.19. The largest hunk (+96) is the reply-carousel behaviour block, not polish.
- ⚠ `DESIGN_integration-shell_v1_0.html` is byte-identical to `…v0_37.html`; its `<title>` still reads **v0.30** — stale inside the artifact.

**Disposition:** canon-owned, **web drafts the `:45` correction**. Not this PR's. Recorded here so it is not re-derived.

---

## §6 · The item table — **the enumeration IS the count** — **C**

**The table below is the enumeration. No row count is stated here** — §13.3 applied literally: *delete the count, or make the count and the enumeration the same artifact.* A number in this sentence would be a second artifact that can disagree with the first, and at Gate C read 1 it did (**GC-1**: this line said "Sixteen rows" over an 18-row table whose own footnote derived 15).

✅ **v1.4 · EVERY ANCHOR BELOW WAS RE-KEYED AT `ea1795e` AND EVERY ONE IS EXACT.** Zero DRIFTED, zero ABSENT, zero RENAMED, zero DUPLICATED across all six merges since `16971cd` (§20).

| # | Item | Anchor (symbol-first) | Row | Class | Attend |
|---|---|---|---|---|---|
| 1 | Remove disabled `Đ BET` | `PostCard.tsx:111-119 (PostCard → Button "Đ BET")` | `PD-0-02` | F | unattended-capable |
| 2 | Remove disabled `Support / Counter` | `PostCard.tsx:120-128 (PostCard → Button "Support / Counter")` | `PD-0-02` | F | unattended-capable |
| 3 | `<Plus /> Full` → **`Read more`** + `text-n5 hover:text-ink` | `PostCard.tsx:102-109 (PostCard → Button onOpenPopup)` | `PD-0-01` | V | unattended-capable |
| 4 | Spaced `Đ` — site 2 | `ReplyCard.tsx:55 (ReplyCard → stake span)` | `PD-3-07` | V | unattended-capable |
| 5 | Spaced `Đ` — site 3 | `ArgProfile.tsx:67 (ArgProfile → authorStake span)` | `PD-3-07` | V | unattended-capable |
| 6 | Spaced `Đ` — sites 4–5 | `AggregateFooter.tsx:14,19 (AggregateFooter → support/counter spans)` ⚠ **discharged at C2, not C10 — §9 GC-10, §18** | `PD-3-07` | V | unattended-capable |
| 7 | Remove `Download` trigger | **ANCHORED BY SYMBOL** — `BookmarkToggle.tsx::CardActions` → the disabled `<Button>` carrying `aria-label="Download — sign in to use"` and the `<Download />` glyph. Evidence `:161-169`, **re-verified EXACT at `ea1795e`** | `PD-3-15` | R | unattended-capable |
| 8 | Chart overlay accessible summary | `chart/MarketPriceChartOverlay.tsx (MarketPriceChartOverlay)` | `PD-3-04` | **F, tier 1** | unattended-capable |
| 9 | Pop-up image height bound | `dialogs.tsx:44-51 (PostPopup → img)` | `PD-3-06` | R | unattended-capable |
| 10 | `PostPopup` omissions ×3 | `dialogs.tsx:19-58 (PostPopup)` | `PD-3-12` | V | unattended-capable |
| 11 | `PostPopup` author's stake | `dialogs.tsx:38-43 (PostPopup → DialogHeader)` | `PD-3-13` | **F, tier 1** | unattended-capable |
| 12 | `PostPopup` frozen `SideBadge` | `dialogs.tsx:41 (PostPopup → DialogDescription)` — today raw text `{post.sideAtPostTime} · {post.author.pseudonym}`. ⚠ **MUST render UNSIZED `<SideBadge side={…} />`** — §7's census pins `detail` at zero for POLISH.3 | `PD-3-14` | **F, tier 1** | unattended-capable |
| 13 | Side-aware `Show all replies` expansion | `ReplyPreview.tsx:29,33,48 (ReplyPreview)` ⚠ **`PostCard` renders `ReplyPreview` at TWO call sites (`:57`, `:132`)** — one edit, two render paths | `PD-3-10` | **F, tier 1** | unattended-capable |
| 14 | Pop-up geometry 512→720px, 80→90vh | `dialogs.tsx:35 (PostPopup → DialogContent className)` · `ui/dialog.tsx:61 (DialogContent → max-w-lg)` | `PD-0-03` | V | unattended-capable |
| 15 | **`RR-3`** — pole inversion | `composer/ReplySplitBar.tsx:64,67 (ReplySplitBar → track/fill spans)` | `RR-3` | **F** | ⛔ **ATTENDED-ONLY** |
| T1 | `RESOLUTION` overline (`9.5px/800/.14em/uppercase/text-n4`, local styles) + hairline container. ⛔ **no clamp, no affordance** | `MarketHeader.tsx:80-82 (MarketHeader → description <p>)` | Tier B-1 | B | unattended-capable |
| T2 | Post-image geometry — **aspect-respecting; `--imgmax` on HEIGHT, 100% width, `--imgr`** *(one unit with 9 + 14)* | `CommentImage.tsx:28 (CommentImage → img className)` | Tier B-2 | B | unattended-capable |
| T3 | Split bar, visual half | `AggregateFooter.tsx:12-22 (AggregateFooter → render body)` ⚠ **the WHOLE body; contains rows 4–6's sites** | Tier B-3 | B | unattended-capable |

**How the lines map to work units.** Rows 1–15 are **the twelve register rows, of which `PD-0-03` and `RR-3` are two members** — not additions to them. T1–T3 are Tier B. Rows 1–2 share `PD-0-02`; rows 4–6 share `PD-3-07`. ⇒ **18 table lines · 15 distinct work units · 13 commits (§9).**

⚠ **GC-1, recorded.** v1.1 said *"sixteen distinct work units"* and *"the twelve register rows **plus** `PD-0-03` and `RR-3`"*. Both wrong, and the second causes the first: `PD-0-03` and `RR-3` are **items 11 and 12 of the twelve**, so adding them double-counted two rows. The arithmetic was inherited from a ruling that read *"the twelve rows + RR-3 + three Tier B items"* and was carried faithfully instead of being checked against the table beneath it. **An inherited count is a citation, not a measurement** — the lesson, met in the document that records it.

✅ **AND IT NOW HAS A NUMBER.** That lesson is **`V-9`** · *"An enumeration inherited from another artifact is a CITATION, not a proof"* (`POLISH-0_data-manifest.md` §5, **on `main` at `ea1795e`**). **Cite it by number from here on.**

### The three contract-named gaps — **G-a · G-b · G-c**

| # | Item | Disposition |
|---|---|---|
| **G-a** | `PF-6` routes the `POLISH-3.md` §5 G-4 wording fix to PR 2's plan-mode chat | ⚠ **DEFERRED with owner.** `docs/plans/POLISH-3.md` is not on §8's allow-list, and G-4's wording is not a PR 2 code change. **Owner: this plan-mode chat's ratification commit, alongside the plan** — not the execute run |
| **G-b** | **`V-9` double-booking** — two lessons, one number | ✅ **CLOSED at POLISH.5/.6 commit 0.** Both lessons minted into `POLISH-0_data-manifest.md` §5 with one number each: **`V-9`** *an inherited enumeration is a citation, not a proof* · **`V-10`** *a register cell is not a baseline*. **Verified on `main` at `ea1795e`.** The double-booking is settled and is NOT carried forward as open |
| **G-c** | Unnumbered mint queue — pre-authored-receipt lesson → `CLAUDE.md` §8 next free O-number | ⚠ **STILL DEFERRED**, owner **POLISH close-out**, unchanged. ⛔ **No number is stated. The instrument is:** `grep -n '^- \*\*O-[0-9]' CLAUDE.md` — read the highest, never count (**`O-2`**). *(Dated reading at `ea1795e`: ceiling **`O-8`**. ⚠ **`O-9` is minted in PR #335, which is OPEN and unmerged — do not read it as live.**)* ⚠ **The queued lesson still has not minted** — none of `O-5…O-8` is the pre-authored-receipt lesson |

**A deferral is a disposition; silence is not.** All three are dispositioned — **one CLOSED (G-b), two deferred with owners.**

---

## §7 · Test pins — every suite that moves, measured — **C**

**Re-measured at `ea1795e`.** `tests/unit/debate/render/` holds exactly seven files: `bookmark-toggle` · `market-error-boundary` · `market-header` · `poll` · `price-chart` · `price-percent-pair` · `side-badge`. ✅ **Unchanged from `16971cd` — the six intervening merges added none.**

⚠ **There is no test file for `PostCard`, `AggregateFooter`, `ReplyPreview`, `CommentImage`, `ArgProfile`, `ReplyCard`, or `dialogs`/`PostPopup`.** The contract flagged `PostPopup`; the gap is wider. **Every guard PR 2 needs is greenfield** and is authored here, not promised.

| Suite | Movement | Direction (§9) |
|---|---|---|
| `tests/unit/debate/render/post-card.test.tsx` | **NEW** — rows 1, 2, 3 | proof → artifact |
| `tests/unit/debate/render/post-popup.test.tsx` | **NEW** — rows 10, 11, 12, 14 | proof → artifact |
| `tests/unit/debate/render/reply-preview.test.tsx` | **NEW** — row 13, side-aware expansion | proof → artifact |
| `tests/unit/debate/render/dharma-spacing.test.tsx` | **NEW** — rows 4, 5, 6. ⚠ **Covers ALL FOUR `PD-3-07` sites in one guard** — see below | proof → artifact |
| `tests/unit/debate/render/aggregate-footer.test.tsx` | **NEW** — row T3 only (the split-bar visual half) | proof → artifact |
| `tests/unit/debate/render/reply-split-bar.test.tsx` | **NEW** — row 15 (`RR-3`) | proof → artifact |
| `tests/unit/debate/render/chart-overlay-a11y.test.tsx` | **NEW** — row 8 | proof → artifact |
| `tests/unit/debate/render/comment-image.test.tsx` | **NEW** — row T2 | proof → artifact |
| `tests/unit/debate/render/market-header.test.tsx` | **EDIT** — row T1 (targeted queries, PF-3) | artifact → proof |
| `tests/unit/debate/render/side-badge.test.tsx` | ⚠ **RE-KEY — see below, CORRECTED at v1.4** | artifact → proof |
| `tests/unit/debate/render/bookmark-toggle.test.tsx` | **EDIT** — row 7. ⚠ **Six `Download` assertions move** (`:254` · `:268` · `:296` · `:337` · `:482` · `:593`) | artifact → proof |
| `tests/unit/design/no-raw-hex-view-layer.test.ts` | **must stay green** — Ruling A's halt | — |

### ⛔ GC-3 · `PD-3-07` SITES 2 AND 3 WOULD HAVE SHIPPED UNGUARDED — remedy (a) taken

**The defect, as read 1 found it.** v1.1's §7 named `ReplyCard` and `ArgProfile` among the components with no test, then authored seven guards and **none covered either**. `aggregate-footer.test.tsx` was scoped to *"rows 6, T3"* — row 6 is sites 4–5 only. Row 4 (**site 2**) and row 5 (**site 3**) appeared in no suite row, while §21 obligation 1 asserted *"PR 2 carries the guards"*. **The named artifact reached row 6 alone.**

⚠ **Why this was the finding that mattered.** `PD-3-07` was consumed **PARTIAL** at PR 1 *precisely because* sites 2–5 *"are not guarded by anything today."* §18 closes it. **Closing it with sites 2 and 3 unguarded would close it on the exact footing PR 1 refused.**

**Remedy (a) is taken: one guard reaching all four sites.** `dharma-spacing.test.tsx` asserts the spaced form at `ReplyCard.tsx:55 (ReplyCard → stake span)` · `ArgProfile.tsx:67 (ArgProfile → authorStake span)` · `AggregateFooter.tsx:14 (AggregateFooter → support span)` · `:19`.

**Why (a) over (b):** the spaced `Đ` is **ONE display rule with four implementations** — a per-component guard set is four assertions of the same rule, each able to drift alone (`PLURAL-NOUN-DUP`'s genus). A single class-keyed guard is the shape PF-7 prescribes. **(b) defers the same work at higher cost**, and **(a) makes §18's closure honest.**

⚠ `aggregate-footer.test.tsx` is re-scoped to **T3 only** — a different guard class (presence/geometry, not copy).

### ⛔⛔ THE SIDE-BADGE CENSUS COLLISION — **v1.4 CORRECTS v1.3's MEASUREMENT, WHICH WAS STALE BY TWO MERGES**

**v1.3 wrote, and it is wrong at `ea1795e`:**

```
:119  expect(countByFile(base)).toEqual({ … })   ← per-file set equality
:130  expect(base).toHaveLength(12)              ← exact count
"Row 12 … is a 13th call site. Both assertions go RED."
```

**Measured at `ea1795e` — the live shape:**

| | v1.3 said | **Live** |
|---|---|---|
| Base-site subject | **12** | **8** — the test is named `exactly-eight-sites-pass-no-size-and-ride-CHIP-base` (`:120`) |
| Total call sites | — | **13** — floor `expect(sideBadgeSites.length).toBeGreaterThanOrEqual(13)` (`:117`) |
| Row 12 makes it a | **13th** | **9th BASE site** (14th total) |
| Assertions going RED | **both** | **ONE** — set equality (`:120`). The `census-is-alive` floor is `>=`, so 14 still passes |

**Why it moved, from the file's own comments (`:125-135`):** *"THE SUBJECT WAS TWELVE UNTIL 2026-08-14"* — `ArgumentList.tsx`'s two sites took `size="profile"` at POLISH.5 item 2 (`5ff418b`) — *"AND TEN UNTIL 2026-08-15"* — `BookmarkCard.tsx`'s two took `profile` at POLISH.6 item 3 (`ea1795e`). **The census fired and the adoption was RULED, not absorbed, both times.** That is the guard working; v1.3's copy of its numbers simply predated two of those rulings.

**The live inventory, measured — 13 sites, 8 base / 5 sized:**

```
BASE (8):   PostFocusHeader:67 · ArgProfile:62 · DebateColumn:50 ·
            ReplyCard:41 · ReplyCard:49 · PostCard:52 ·
            composer/SellModule:262 · composer/BetComposer:404
SIZED (5):  discovery/HeroPanels:226 (hero) · BookmarkCard:32,:57 (profile) ·
            profile/ArgumentList:53,:72 (profile)
```

⇒ **`side-badge.test.tsx` is on the allow-list (§8 row 20) and its re-key is a planned edit, not a surprise RED.** ⛔ **Row 12's badge must be UNSIZED** — the `detail-stays-unwired-and-profile-is-wired-only-where-ruled` assertion (`:470`) pins `detail` at **zero** for POLISH.3, and a `size="detail"` would redden a second, unplanned assertion.

⚠ **This correction is itself the argument for §20 step 2** — the file moved **+86/−20** across two merges and it is **the only §8 file that moved at all** (§20). A plan that quotes a test's internals by line and number must re-quote them at its branch point.

### ⚠ v1.4 · GUARD-COMPOSITION CONSTRAINT — a later commit must not redden an earlier commit's guard

**Measured composition DAG among allow-list components at `ea1795e`:**

```
PostCard ──▶ ArgProfile ────▶ CardActions (BookmarkToggle)
   ├───────▶ AggregateFooter
   ├───────▶ CommentImage
   └───────▶ ReplyPreview ──▶ ReplyCard ──▶ CardActions (BookmarkToggle)
```

⇒ **`PostCard` transitively renders six other allow-list components**, five of which a *later* commit writes. Concretely: `post-card.test.tsx` greens at **C9**, and **C10** (ArgProfile · ReplyCard · AggregateFooter) and **C11** (CardActions' `Download` removal) both change what `PostCard` renders afterwards.

⛔ **THE RULE THIS IMPOSES ON C1's AUTHORING:** every guard asserts **only its own rows' subject**, via targeted queries — never a whole-subtree snapshot, a button count, or a full-`innerHTML` equality over a composed root. `dharma-spacing.test.tsx` renders `ArgProfile` and `ReplyCard`, both of which render `CardActions`; a whole-output assertion there would go RED at **C11** for a change that is not its subject.

⚠ **This is NOT a relaxation of `O-7`.** `O-7` says assert on `innerHTML`, never `textContent` — because `textContent` cannot see the markup that carries the meaning. That still holds: **assert on `innerHTML` of the ELEMENT that carries the row's subject**, not of the composed root. Narrow the *scope*; keep the *medium*.

### Guard form — keyed to CLASS, not to surface (PF-7 / PF-8)

- **COPY / PRESENCE** guards → targeted queries.
- **ABSENCE / LEAK** guards → the whole rendered output. ⛔ **`container` is not that; `baseElement` is.** The repo's `Dialog` **portals by default** (`ui/dialog.tsx (DialogContent → DialogPortal)`), so every `PostPopup` guard is portalled by construction.
- ⚠ **Per-pole tests assert BOTH poles.** Rows 15 and T3 are each pole-bearing, and T3's bar is **side-coded, not relation-coded** — **four assertions on T3, not two.**
- **No jest-dom.** Assert against plain DOM (`getAttribute`, `innerHTML`, `querySelector`); `// @vitest-environment jsdom` on line 1.

### ✅ V-2 · The positive control for `RR-3`

The mockup poles the split-bar triggers by **resulting side, not by relation** — right column Support is `.rbtn2 n`, Counter `.rbtn2 y` (`d5:1247,1249`), confirmed in JS at `d5:1591 (fs.className)`. `ReplySplitBar.tsx:118-122 (ReplySplitBar → pole)` already gets this right — **re-verified EXACT at `ea1795e`** — while `:64,67` gets it wrong. **The mockup is `RR-3`'s positive control** — the fix makes the build agree with an artifact that was never wrong.

---

## §8 · The allow-list — file by file, with reason and C5 clearance — **C**

**C5 clearance** = does the file fall under `src/components/{bookmarks,profile,ui}/**`, `src/server/{bookmarks,profile}/**`, or `src/components/debate/composer/**`?

| # | File | Reason | C5 clearance |
|---|---|---|---|
| 1 | `src/components/debate/PostCard.tsx` | rows 1, 2, 3 | ✅ clear |
| 2 | `src/components/debate/ReplyCard.tsx` | row 4 | ✅ clear |
| 3 | `src/components/debate/ArgProfile.tsx` | row 5 | ✅ clear |
| 4 | `src/components/debate/AggregateFooter.tsx` | rows 6, T3 | ✅ clear |
| 5 | `src/components/debate/dialogs.tsx` | rows 9, 10, 11, 12, 14 | ✅ clear |
| 6 | `src/components/debate/ReplyPreview.tsx` | row 13 | ✅ clear |
| 7 | `src/components/debate/CommentImage.tsx` | row T2 | ✅ clear |
| 8 | `src/components/debate/MarketHeader.tsx` | row T1 — **ONE edit, no rewrite** | ✅ clear |
| 9 | `src/components/debate/chart/MarketPriceChartOverlay.tsx` | row 8 | ✅ clear. ⛔ **`PD-3-04` ONLY** — D6 does not widen to geometry |
| 10 | `src/components/bookmarks/BookmarkToggle.tsx` | row 7 | ⚠ **CROSS-LANE — pre-cleared by ruling.** `POLISH-3.md:58` **D3** *(re-verified EXACT at `ea1795e`)*: *"Executes in `.3` PR 2 as a **second named allow-list exception**. `.5`/`.6` record the adoption."* ⚠ **And the file is `.3`'s by USE, not only by ruling — re-measured at `ea1795e`:** all seven consumers are under `src/components/debate/**`, zero on any `.6` surface |
| 11 | `src/components/debate/composer/ReplySplitBar.tsx` | row 15 | ⛔ **DENY-LISTED — named exception, §10.** Symbol-fenced to `:64,67` |
| 12–19 | the **NEW** test files enumerated in §7 — `post-card` · `post-popup` · `reply-preview` · **`dharma-spacing`** · `aggregate-footer` · `reply-split-bar` · `chart-overlay-a11y` · `comment-image` | greenfield guards; `dharma-spacing.test.tsx` added at **GC-3**. **Eight files, eight slots** | ✅ clear |
| 20 | `tests/unit/debate/render/side-badge.test.tsx` | census re-key ⚠ **the ONE §8 file that moved since `16971cd`** (+86/−20) | ✅ clear |
| 21 | `tests/unit/debate/render/market-header.test.tsx` | row T1 guard | ✅ clear |
| 22 | `tests/unit/debate/render/bookmark-toggle.test.tsx` | row 7 guard | ✅ clear |

⚠ **GC-5, recorded.** v1.2 numbered the last three rows **19 · 20 · 21** directly after a `12–19` range, so **`19` named two different files** and every row after the range was off by one. The range is right — §7 authors eight new test files and `12–19` is eight slots — so the repair is the tail, not the range. ⛔ **Left uncorrected, "§8 row 19" is ambiguous in exactly the document that says the allow-list IS the whole belt** (below), and `H-FENCE` cites §8 by row.

⚠ **`src/components/debate/**` is NOT covered by §10.** PR 1's log §1: *"the allow-list was their only fence."* **For PR 2's card work the allow-list IS the whole belt.** An edit to a `src/components/debate/` file not listed above is ⛔ **RUN-STOP**, not a per-delta halt.

---

## §9 · Commit boundaries — ordered, none red, direction named — **C**

**Q20: structure first, cosmetics onto the rebuilt surface. Geometry before the clip rows.**

| # | Commit | Rows | Direction | Attend |
|---|---|---|---|---|
| **C1** | `test(debate)`: greenfield guards — RED first | §7's new files, incl. `dharma-spacing.test.tsx` (GC-3) | **proof → artifact** · risk: a guard that never went red. **Capture the RED run.** ⚠ **See §12 `H-GREEN` — three of these guards green PROGRESSIVELY and the schedule is named there** | unattended-capable |
| **C2** | `feat(debate)`: T3 split-bar visual half | T3 ⚠ **+ rows 4–6's sites 4–5, by construction — GC-10** | proof → artifact | unattended-capable |
| **C3** | `feat(debate)`: T1 `RESOLUTION` overline + container | T1 | **artifact → proof** · risk: fabrication. Targeted queries only (PF-3) | unattended-capable |
| **C4** | `feat(debate)`: T2 post-image geometry | T2 | proof → artifact | unattended-capable |
| **C5** | `fix(debate)`: pop-up geometry + clip rows — **one unit** | 9, 14 | proof → artifact. ⛔ **AFTER C4** — 720px changes what *"whole"* means | unattended-capable |
| **C6** | `feat(debate)`: `PostPopup` omissions, stake, `SideBadge` + census re-key | 10, 11, 12 | proof → artifact. ⚠ carries `side-badge.test.tsx`'s re-key — **8 base sites → 9** (§7) | unattended-capable |
| **C7** | `fix(debate)`: side-aware reply expansion | 13 | proof → artifact | unattended-capable |
| **C8** | `refactor(debate)`: remove the two disabled card controls | 1, 2 | artifact → proof | unattended-capable |
| **C9** | `fix(debate)`: `Read more` + token port | 3 | artifact → proof | unattended-capable |
| **C10** | `fix(debate)`: spaced `Đ`, sites 2–3 ⚠ **+ VERIFY sites 4–5** | 4, 5 ⚠ **6 is VERIFIED, not edited — see below** | artifact → proof | unattended-capable |
| **C11** | `refactor(bookmarks)`: remove the `Download` trigger | 7 | artifact → proof | unattended-capable |
| **C12** | `feat(debate)`: chart-overlay accessible summary | 8 | proof → artifact | unattended-capable |
| **C13** | `fix(debate)`: **`RR-3`** pole correction | 15 | proof → artifact, **four pole assertions** | ⛔ **ATTENDED-ONLY** |

### ⛔ GC-10 · C2 DISCHARGES ROWS 4–6's SITES 4–5, EIGHT COMMITS BEFORE C10 — FOUNDER-RULED

**The mechanism, measured at `ea1795e`.** `AggregateFooter.tsx` is **24 lines**. Its entire render body is `:12-22` — which is **row T3's anchor**. Rows 4–6's sites 4 and 5 are `:14` and `:19`, **strictly inside it**:

```
12   <div className="flex flex-wrap items-center gap-x-2 gap-y-1 …">   ← T3's anchor opens
13     <span>
14       Support ({aggregate.supportCount}) : Đ      ← site 4 (UNSPACED today)
15       {formatDharma(aggregate.supportDharma)}
16     </span>
17     <span aria-hidden="true">/</span>
18     <span>
19       Counter ({aggregate.counterCount}) : Đ      ← site 5 (UNSPACED today)
20       {formatDharma(aggregate.counterDharma)}
21     </span>
22   </div>                                          ← T3's anchor closes
```

**C2 cannot rebuild `:12-22` as a split bar without writing both spans.** Written with canon §107's **SPACED `Đ`** grammar — which is the ruled target form — **sites 4 and 5 discharge at C2.**

⇒ **C10's `AggregateFooter` arm is a VERIFICATION, not an edit.** ⛔ **STATED SO THE EXECUTOR DOES NOT WRITE A NO-OP AND REPORT IT AS WORK.** At C10 the executor **re-greps `AggregateFooter.tsx:14,19 (AggregateFooter → support/counter spans)` and confirms the spaced form is already present from C2.** If it is present → **record "verified, discharged at C2"** and edit nothing. If it is **absent** → **C2 did not apply the ruled grammar; that is a C2 defect, and the repair belongs in C2's lane, not as a late C10 edit.**

### ⛔ GC-7 · THE RE-KEY RUNS ONCE, AT THE BRANCH POINT — AND THREE COMMITS INVALIDATE A LATER COMMIT'S ANCHORS

**§20 re-keys every anchor at the branch point and never again.** But **three pairs of commits write the same file**, and the earlier one moves the coordinates the later one is fenced by. **This is `O-8` operating inside a single PR.** Measured at `ea1795e`:

| Pair | File | Earlier commit writes | Later commit is fenced to | Verdict |
|---|---|---|---|---|
| **C2 → C10** | `AggregateFooter.tsx` *(24 lines total)* | **`:12-22`** — T3, **the entire render body** | `:14` and `:19` — rows 4–6's two spans, **both strictly inside `:12-22`** | 🔴 **INVALIDATED BY CONSTRUCTION — and now also a DISCHARGE (GC-10 above)** |
| **C5 → C6** | `dialogs.tsx` | `:35` (row 14, `DialogContent`) and **`:44-51`** (row 9, the `<img>` block) | `:19-58` (row 10, `PostPopup` whole) · `:38-43` (row 11) · `:41` (row 12) | 🔴 **row 10 INVALIDATED** — its range *contains* both C5 edits. ⚠ **Rows 11 and 12 survive only because `:38-43` and `:41` sit ABOVE `:44`.** ✅ **NOT a discharge** — C5 writes geometry and an image bound; C6 writes omissions, a stake and a badge. No row's subject is shared |
| **C8 → C9** | `PostCard.tsx` | **`:111-119`** and **`:120-128`** — rows 1+2, **deleted** | `:102-109` — row 3's Button | 🟡 **SAFE, BY ORDERING ONLY.** Row 3 sits **above** the deletion. ⚠ **The plan never stated this ordering as load-bearing** — and it is: reverse C8 and C9 and row 3's edit shifts an 18-line deletion target. ✅ **NOT a discharge** |

⇒ **THE REMEDY IS A STEP, NOT A REWRITE.** §20 gains **step 7**: before any commit whose file was written by an earlier commit **in this same PR**, re-run the symbol grep for that file's anchors and update them. **The three pairs above are the complete set** — every other commit is the only writer of its file (C1 tests · C3 `MarketHeader` · C4 `CommentImage` · C7 `ReplyPreview` · C11 `BookmarkToggle` · C12 `MarketPriceChartOverlay` · C13 `ReplySplitBar`).

⚠ **`H-REKEY` widens to cover it** (§12). ⛔ **A DRIFTED anchor inside the PR is still just "update and continue"** — it is not a halt.

✅ **Row 7 is immune to all of this**, because it is anchored `BookmarkToggle.tsx::CardActions`. **That is the shape the other anchors would take if this plan were re-authored rather than amended** — recorded as the direction of travel, not proposed as this PR's work.

### A4 · Attendance — the pre-ruled answer

> ⛔ **`RR-3` is NOT unattended-capable, at any hour.** It is a live pole inversion at `composer/ReplySplitBar.tsx` — adjacent to commentary, a `CLAUDE.md` §1 critical path. It executes attended, with the writer/reviewer pass, or it does not execute in PR 2.

⚠ **The `INV-3` label is struck from this plan.** `RR-3`'s source is `DISCOVERY-COMPLETE.md:280-292`. **That source's `INV-3` label is superseded** — `INV-3` is a storage invariant (`comments.side_at_post_time` immutable post-INSERT) and a Tailwind class in a client component cannot violate it. The rule actually broken is the **design-language axis correction**: *"Support/Counter is a separate, post-relative relation, never a colour or column"* (`design-language.md:268`) and `CLAUDE.md` §8, *"the poles name the SIDE (YES/NO), never the Support/Counter relation."*

**Unattended fencing is by DIRECTORY** (`POLISH-SURFACE-TEMPLATE.md` §13.4), not by mechanism: C1–C12 fence to `src/components/debate/**` + `src/components/bookmarks/BookmarkToggle.tsx` + `tests/unit/debate/render/**`. C13 does not run unattended under any fence.

---

## §10 · ⛔ Deny-list belt — by directory — **W**

```
⛔ src/server/**              ⛔ src/server/moderation/**
⛔ src/app/(admin)/**         ⛔ src/app/(admin)/admin/moderation/**
⛔ src/db/**                  ⛔ drizzle/**
⛔ src/components/debate/composer/**
```

**One named exception, by FILE and by SYMBOL:** `composer/ReplySplitBar.tsx (ReplySplitBar → the track span :64 and the fill span :67)`.

**Why the exception is safe:** the edit is **two class strings on two adjacent spans**, inside a component whose correct sibling (`:118-122`) already demonstrates the target rule. It adds no prop, no branch, no data path, and no write. `RR-3`'s safety argument **is its narrowness** — a widening to a component rewrite forfeits it, and web has declined that widening. It executes **attended** with `@code-reviewer` + `@security-auditor` (§15).

⚠ **Two Tier B candidates were tested against this belt and resolved OUT:**
- **Split-bar triggers** → `composer/**`. **Declined — bucket D** (§4), on R1's thesis ground, not on fence size.
- **Chart geometry** → would widen D6's *"`PD-3-04` only"*. **Declined by R-a** — geometry defers with the media panel (`HEADER-3ZONE`).

**No new `composer/**` exception is taken or requested.**

---

## §11 · ⛔ No-edit symbols — by symbol, never by line — **C**

**Inherited from PR 1** (`DebateView.tsx` is off the allow-list, `POLISH-3 D7`): `DebateView` · `PostFocusHeader` · `DebateColumn` · `MarketPriceChartHost`.

**Added by PR 2:**

| Symbol | File | Why |
|---|---|---|
| `SlotHeader` | `composer/SlotHeader.tsx` | §2 — struck; POLISH.4's. ⚠ **Rewritten by PR B's B5** — §1 P1 ground (b) |
| `TriggerPill` | `composer/ReplySplitBar.tsx` | the trigger half is bucket D; the exception is fenced to `:64,67` |
| `BetComposer` · `SellModule` · `PositionStrip` · `AuthGateSlot` | `composer/**` | §10 |
| `ImageLightbox` | `dialogs.tsx` | same file as `PostPopup`, **not** in scope; already `object-contain` at `:88` |
| `RemovedPlaceholder` · `EmptySideCTA` | `placeholders.tsx` | §6 has no row |
| the serialised `- **Support / Counter:**` string | `debate-export/serialize.ts:349 (serialize → the Support/Counter export line)` | ADR-0025 export copy, not a control |

---

## §12 · Halt grades — **W · C**

Base set inherited from `POLISH-SURFACE-TEMPLATE.md` §5. Per-surface additions:

| ID | Condition | Grade |
|---|---|---|
| ~~**H-A3**~~ | ~~Branching before §1 P1 holds~~ | ✅ **DISCHARGED at v1.4.** P1 is **MET** (`b7c2a38`, #333). Retained struck-through on the `H-T1`/`H-T2` precedent: a grade that gated correctly and then opened is evidence the gate worked |
| **H-REKEY** | §20 finds a symbol **absent**, **renamed**, or **duplicated** — ⚠ **at the branch point AND at every inter-commit checkpoint** (§20 step 7, GC-7). ⛔ A merely **DRIFTED** anchor is *update-and-continue*, never a halt | ⛔ RUN-STOP — the plan was written against something that no longer exists |
| **H-FENCE** | An edit to a `src/components/debate/` file not on §8 | ⛔ RUN-STOP |
| **H-HEX** | `no-raw-hex-view-layer.test.ts` reddens | ⛔ HALT — Ruling A |
| **H-SPEC** | Anything appears to need a SPEC.1/SPEC.2 amendment | ⛔ HALT, surface, do not draft (§E 3) |
| **H-GREEN** | ⚠ **WIDENED at v1.4 — see the schedule below** | ⛔ HALT — proof→artifact direction violated |
| **H-SCOPE** | Measured scope exceeds one green PR | ⛔ HALT, surface a split with ground (§E 2) |
| **H-COMPOSER** | Any work resolves inside `composer/**` beyond `RR-3`'s two spans | ⛔ HALT — founder decision (§E 1) |
| ~~H-T1 / H-T2~~ | ✅ **CLEARED 2026-08-13** — both ruled; §17 records the outcomes | — |

### ⛔ `H-GREEN`, WIDENED — green-from-birth **and** green-too-early, with the expected schedule named

**v1.3's `H-GREEN` read *"a C1 guard is green on first run"*.** That covers **green-from-birth** and is **silent on green-too-early** — a guard that goes RED correctly at C1, then goes partially green at a commit *before* its last credited one. **GC-10 produces exactly that**, and an unattended run needs to know which greens are expected.

**⇒ THE RULE, IN TWO CLAUSES.**

> **(a) GREEN-FROM-BIRTH — ⛔ HALT, unchanged.** Any C1 guard that is green on its first run has not proved anything. The proof→artifact direction is violated and the guard is worthless.
>
> **(b) GREEN-TOO-EARLY — ⛔ HALT ONLY IF UNSCHEDULED.** A guard turning green at a commit earlier than its last credited one is **expected** where the table below says so, and a **⛔ HALT** anywhere else. **An unscheduled early green means a commit did work no one attributed to it** — which is GC-10's defect, one commit over.

**THE SCHEDULE — the complete set, derived by running §13's discharge check across all thirteen commits:**

| Guard | Rows | Goes GREEN at | Partial window | Expected? |
|---|---|---|---|---|
| `dharma-spacing.test.tsx` | 4, 5, **6** | **sites 4–5 at C2** *(GC-10)*; **sites 2–3 at C10** | ⚠ **EIGHT commits, C2 → C10** | ✅ **EXPECTED — the longest window in the PR** |
| `post-popup.test.tsx` | 10, 11, 12, **14** | **row 14 at C5**; rows 10–12 at **C6** | 1 commit | ✅ **EXPECTED** |
| `post-card.test.tsx` | 1, 2, **3** | **rows 1–2 at C8**; row 3 at **C9** | 1 commit | ✅ **EXPECTED** |
| `aggregate-footer.test.tsx` | T3 | C2 | — | ✅ single-commit guard |
| `comment-image.test.tsx` | T2 | C4 | — | ✅ single-commit guard |
| `reply-preview.test.tsx` | 13 | C7 | — | ✅ single-commit guard |
| `chart-overlay-a11y.test.tsx` | 8 | C12 | — | ✅ single-commit guard |
| `reply-split-bar.test.tsx` | 15 | C13 | — | ✅ single-commit guard |

⇒ **THREE guards have a partial-green window; five green exactly once.** ⛔ **Any partial green outside this table is a HALT.** The executor records, at each commit, which guards moved — the table above is the expectation it is checked against.

---

## §13 · Pre-flight — this plan run against its own stop conditions — **C**

**This is the section PR 1 proved cannot be skipped.** Run, with results.

⚠ **RE-RUN IN FULL at v1.4, against the AMENDED text** — not carried from the v1.3 pass. Every row was re-evaluated after §1, §7, §9, §12, §18, §19, §20 and §21 changed.

| Check | Result |
|---|---|
| Does any §6 row require a SPEC amendment? | **No.** Every row is render-layer. *(Re-run at v1.4; unchanged)* |
| Does any §6 row touch a critical path? | **Row 15 only**, and it is attended-only with both reviewers. *(Re-run; unchanged)* |
| Does any §6 row need DDL? | **No.** Migration head **re-measured at `ea1795e`: `0024_bookmarks`**, unmoved across six merges; no `@db-migration-reviewer` |
| Does any §8 file fall outside the allow-list belt? | **No.** Two cross-lane entries, both dispositioned (§8 rows 10, 11). Row numbering repaired at GC-5 |
| **⚠ Is every precondition in §1 SATISFIABLE — not merely true?** *(minted at GC-9)* | ✅ **Yes, and now MET.** v1.2's P1 gated PR 2 on `.6`, which the then-ruled chain placed after PR 2 — a gate that could never open. Corrected to POLISH.5 PR B, which **merged at `b7c2a38`.** ⛔ **A precondition check that only asks "is this stated correctly" cannot catch a deadlock**; it must ask whether the gate's opening event is reachable |
| **⚠ Does any anchor survive only until an EARLIER COMMIT IN THIS PR edits its file?** *(minted at GC-7)* | 🔴 **THREE pairs, and the set is unchanged at `ea1795e`** — C2→C10, C5→C6, C8→C9. §20 step 7 covers all three |
| **⛔ ⚠ Does any commit DISCHARGE work another commit is credited with?** *(minted at GC-10, v1.4)* | 🔴 **ONE, and the sweep across all thirteen commits found no second.** ⇒ **C2 discharges rows 4–6's sites 4–5** — T3's anchor `:12-22` strictly contains `:14` and `:19`, and rebuilding the body applies the same ruled grammar. **C5→C6 and C8→C9 were tested and are NOT discharges** — each writes a disjoint region *and* a different row's subject. The other seven commits are the sole writer of their file, so the relation cannot arise. **§18 attributes per site; §9 C10 becomes a verification; §12's schedule names the resulting early green.** ⚠ **This check is generalisable and is routed to `POLISH-SURFACE-TEMPLATE.md` §13 at the surface close-out** — *a plan whose commits overlap by FILE must also be checked for overlap by SUBJECT; the two are different relations and anchor-invalidation catches only the first* |
| **⚠ §13.6 — does this plan widen a shared DTO?** *(the rule minted at POLISH.5 PR A; NEW on `main` since this plan's original ground)* | ✅ **CHECKED — DOES NOT FIRE, and the check is recorded because silence reads as unchecked.** §13.6 requires a plan widening a shared DTO to allow-list every file that **CONSTRUCTS** or **EXHAUSTIVELY ASSERTS** it. **PR 2 widens nothing:** §10 deny-lists `src/server/**` and §8 lists no server file, no schema file and no migration; every one of the 22 rows is a component or a render test. `grep -rn 'Object.keys(' tests/ \| grep -E 'toEqual\|toHaveLength'` is the rule's prescribed finder and **has no subject here.** ⚠ **PR A halted THREE times on this class.** Its structural absence from PR 2 is the single largest reason PR 2's risk profile differs from PR A's, and §19 rests on it |
| **Does any prose sentence state a number the reader could instead obtain by counting?** *(minted at GC-1)* | ✅ **No.** Every surviving figure is derived in the same table that carries the enumeration (§6's mapping line, §12's schedule) or measures something outside this document (§19's PR-1 actuals, §1's SHAs, §7's live census) |
| ~~Does the plan state a count that is not an enumeration?~~ | ⛔ **SUPERSEDED at GC-6 by the check directly above, and struck rather than deleted.** It answered **"No"** on the v1.1 text at the same time as *"Sixteen rows"* sat over an 18-row table — **it passed on FORM and failed on SUBSTANCE.** ⚠ **Leaving it as a live passing row is the defect it embodies** |
| Does the plan prescribe a mechanism a receipt can echo? | **No.** §9 prescribes **direction and proof**, never wording. §0.1 applies the rule to itself. ⚠ **§9 C10's verification clause was written as an OUTCOME with a falsifiable test** (*"re-grep; present → record; absent → C2 defect"*), **not as words a commit body can repeat** |
| Is any anchor bare `file:line`? | **No.** Every code anchor reads `file:line (symbol)`, and row 7 is `file::symbol` with the range demoted to evidence. ⚠ **RESTATED ON `O-8`** — `CLAUDE.md` §8, verified on `main` at `ea1795e`. ⚠ **v1.4 demoted one more:** §4 bucket D's `SlotHeader.tsx (SlotHeader → the colhead trade button)` became `(SlotHeader → the colhead trade button)` **because B5 rewrote that file** — `O-8` firing on this plan's own citation, caught by this row |
| Is `ultracode` permitted anywhere? | ⛔ **No.** Ordered proof obligations fail condition 4 outright — and GC-7 plus GC-10 add more of them |
| Are all three contract gaps dispositioned? | **Yes**, one **CLOSED** (G-b). G-a and G-c deferred with owners; **G-c's instrument re-read at `ea1795e`: ceiling `O-8`**, with `O-9` noted as unmerged |
| Does §17 halt on anything unresolved? | ✅ **No.** H-T1 and H-T2 both **RULED 2026-08-13**. ⚠ **H-A3 is now DISCHARGED, not merely stated** — §12 |
| **⚠ Does the plan cite anything that does not exist at its own stated ground?** *(minted at read 2)* | ✅ **NO — and this row has INVERTED since v1.3.** v1.3 answered *"Yes, four artifacts, declared rather than repaired"*, all on PR #330. **#330 merged (`c8ba802`); all four verified on `main` at `ea1795e`.** §1.1 is struck. ⚠ **And the plan now cites `POLISH-5.md` NOWHERE** (§1), so the largest source of not-yet-true citations is gone by construction rather than by discharge |
| Is any bucket-D row actually a build decision in disguise? | ✅ **Checked, and one was.** The post-image slot aspect is **not** bucket D — the mockup declines to rule (`d5:241-244`). Reclassified as the plan's only BUILD decision (§4, §17 H-T2). **Routed to `POLISH-SURFACE-TEMPLATE.md` §5 at the surface close-out** |

---

## §14 · Verification — **C**

Per commit: `ZUGZWANG_ENV=preview just verify` → the touched suites. Pre-PR: full `pnpm vitest run`.
Critical-path (C13 only): `pnpm test:invariants` + `pnpm test:integration`.

### ⚠ Two operational preconditions — measured, and both recurred after being written up

1. ⛔ **`ZUGZWANG_ENV=preview` belongs to `just verify` and must NEVER share a shell with the test runner.** Sourcing the build-env prelude and running `pnpm vitest run` in the same shell reddens `precommit-moderate::reservation-key-shape-with-namespacing`. **This happened twice**, the second time after documentation. **Separate shells, always.**
2. ⛔ **No time projection from an observed suite trend.** The suite went 320 s → **3054 s** → 185 s when the machine idled. A projection from the rising trend was made and withdrawn. **§19 forecasts commits and reads, never wall clock.**
3. ⛔ **One local Postgres.** `pgrep -f 'node.*vitest'` before **every** suite run — never `ps | grep`, which matches its own command string. If it fires: **WAIT**. ⛔ Never kill another session's process. ⚠ `pgrep -f` can also match the waiting shell itself (`H12-SELF-MATCH`) — resolve matched PIDs before believing a trip.

**Gate commands never pipe to `tail`** — the pipe exits with `tail`'s 0 and swallows real failures. Run unpiped to a log, `echo exit=$?` **last**.

---

## §15 · Reviewers — **W**

`@code-reviewer` on every commit. `@security-auditor` on **C13** (the `RR-3` exception). **No `@db-migration-reviewer`** — PR 2 ships no DDL (§13, §13.6).

⚠ **SEQUENTIALLY, never concurrently** — a concurrent subagent suite saturates the same Postgres as §14.3.
⚠ **A subagent dying at 0 tool_uses means a stale or unreachable frontmatter model pin.** Agent definitions load from the **session's working directory** at launch and are not hot-reloaded ⇒ **reviewer-bearing sessions launch from a worktree at `origin/main`.**
⛔ **`ultracode` FORBIDDEN on every commit.**

---

## §16 · §4.2 S1 — recorded ONCE — **W**

**§4.2 S1 goes LIVE at PR 2 — three shipped controls are removed** (rows 1, 2, 7).

S1 states that **mockup silence never authorises removing a shipped affordance**. These are **founder rulings with stated reasoning, not mockup silence** — R1 on redundancy (`SlotHeader` carries a live per-column entry) and on thesis grounds (mandatory commentary is meant to make argument deliberate, not reflexive); D3 on the same redundancy ground. **S1 therefore does not bar them.**

Recorded **once**, here. ⚠ GC-1…GC-5 came from one decision restated at five sites drifting apart. **This plan does not restate it.**

---

## §17 · Unexecutability — re-answered against the measured scope — **C · F**

**The moment to halt is here, not at execute.** Every §6 row is executable as ruled. **Two carried ruled parameters that measurement contradicted — `H-T1` and `H-T2` — and both were RULED on 2026-08-13. Both halts are CLEARED.**

⚠ **This preamble was stale in v1.1** — it read *"Two carry ruled parameters that measurement contradicts"*, in the present tense, directly above two blocks already marked ✅ RULED. **GC-2, Gate C read 1.** The remedy applied here is a grep for every inbound reference written in the pre-ruling voice, not a fix of the one line that was reported.

### ✅ H-T1 · The overline — RULED 2026-08-13, three parts

**(a) Recipe — the measured one is adopted.** `d5:468-469 (.overline)`:

```css
.overline{font-size:9.5px;font-weight:800;letter-spacing:.14em;
          text-transform:uppercase;color:var(--n4);}
```

⇒ **`text-[9.5px]` / `font-extrabold` / `tracking-[.14em]` / `uppercase` / `text-n4`.** ⛔ The earlier `8px / .12em` is **STRUCK**. ⛔ `n4` via `--color-n4` / `text-n4`, **never** the hex (Ruling A, H-HEX). Arbitrary values are expressible — precedent `composer/SlotHeader.tsx (SlotHeader → the colhead micro-labels)`.

⚠ **The mechanism of the error is recorded, not just the correction.** The wrong recipe came from reading `d5:556 (.poslab)` and `d5:614 (.colstk .lab)` — which **are** `8px / .12em / n4` — and generalising across **roles**. A third rule sharpens it: `d5:483 (.reslabel)` is `8px / **.14em**`. The family carries **three distinct (size, tracking) pairs**:

| Rule | Size | Tracking |
|---|---|---|
| `.poslab` · `.colstk .lab` | 8px | .12em |
| `.reslabel` | 8px | **.14em** |
| `.overline` | **9.5px** | **.14em** |

**The family shares weight (800), transform (uppercase) and colour (n4) — and nothing else.** Same genus as PR 1's S-2.

**(b) Preset vs local — LOCAL STYLES + DOCKET.** Step 1 clean (`git grep -i "overline|eyebrow" -- src/` → **zero**). Step 2: within PR 2's fence there is exactly **one** consumer; every existing consumer is out of fence — `discovery/HeroPanels.tsx:52 (HeroPanels → the micro-label const)`, `composer/BetComposer.tsx (BetComposer → its micro-labels)` (⛔ deny-listed), `shell/IdentityCluster.tsx:32 (IdentityCluster)` + `shell/DharmaCluster.tsx:89,98 (DharmaCluster)`. §5 forbids a batch spanning surfaces.

⇒ **Local styles in `MarketHeader.tsx` + a docket row.** ⚠ **The docket row CARRIES THE CENSUS** — the recipe plus its three known out-of-fence consumers — so the surface crossing is **inherited, not re-derived**. Third instance of `PLURAL-NOUN-DUP`'s genus.

**(c) The `.crittext` 2-line clamp — ⛔ DO NOT CLAMP. Bucket D.** `market.description` **is the resolution criterion — the terms of the bet.**

- **(i)** A bare CSS clamp with no affordance is the exact defect class `PD-0-01`/R4 fixes. Introducing it on the most consequential text on the surface, **in the same PR that removes it from post cards**, is incoherent.
- **(ii)** U3 makes criteria long **by design**. The mockup's demo criterion is a short stand-in.
- **(iii)** Not clamping **is the status quo** (a bare `<p>`). The mockup would be **introducing** a truncation of the bet terms.

⇒ Filed **bucket D** (§4). "Criterion length treatment" docketed to **`HEADER-3ZONE`**.

✅ **Corroboration for "container only":** `d5:467 (.criterion)` is `margin-top:12px; border-top:var(--hairline); padding-top:10px` — **a top hairline rule + padding, not a boxed card.**

### ✅ H-T2 · The slot aspect — RULED 2026-08-13: ASPECT-RESPECTING WITHIN A MAX BOX

**Natural aspect; bounded by `--imgmax` on height and 100% on width; corners `--imgr: 6px`.** ⛔ **No fixed box ⇒ the `object-fit` question does not arise.**

⚠ **THE MOCKUP DOES NOT DECIDE, AND THAT IS THE LOAD-BEARING POINT.** It carries two aspects on purpose — `d5:1079 (.media.land)` 220:96 on YES, `d5:1242 (.media.rdt)` 640:586 on NO — and files the choice as **OPEN** at `d5:241-244`:

> *"Post image → **"shown whole, any orientation"** (aspect-respecting, contain) … **OPEN: hard 640:586 box for all posts vs aspect-respecting (this gates the composer image too).**"*

⇒ **Neither answer can be filed as bucket D. This is a BUILD decision** — the only such row in the plan.

**The ratified rule decides it:**

- *"Shown whole · any orientation"* is a **promise to the author** (composer hint, canon §107). A fixed 640:586 box keeps it literally and breaks it practically.
- **`--imgmax` already exists** as the ratified clip governor (R14 check 2). ⚠ Note the axis change: the build currently binds `max-w-[var(--imgmax)]` (`CommentImage.tsx:28 (CommentImage → img className)`, **re-verified at `ea1795e`**); this ruling moves the bound to **height**, with width at 100%.
- **Card-height variance is the CAROUSEL's problem, and the carousel is deferred.**

⚠ **THE COST, RECORDED:** card heights vary today; the two columns read less regularly than a fixed box would give. **That is the price of the promise**, accepted knowingly.

⚠ **Composer coupling.** `d5:243` says the choice *"gates the composer image too."* Aspect-respecting is correct there for the same reason — **but `composer/**` is ⛔ deny-listed. PR 2 rules for its own fence only.** Recorded so **POLISH.4 inherits it rather than re-deciding**.

✅ `--imgmax: 160px`, `--imgr: 6px` (`globals.css:179-180 (:root → --imgmax / --imgr)`), **re-verified EXACT at `ea1795e`**. **No `object-cover` anywhere in `src/components/debate/`.**

### Everything else is executable

No row requires a SPEC amendment, DDL, a new `composer/**` exception, or a split (§19). **Both halts are cleared; H-A3 is DISCHARGED.**

---

## §18 · Register dispositions — **C**

| Row | Disposition |
|---|---|
| `PD-0-01` · `PD-0-02` · `PD-0-03` | **CLOSED** by rows 3 / 1+2 / 14 |
| `PD-3-04` · `PD-3-06` · `PD-3-10` · `PD-3-12` · `PD-3-13` · `PD-3-14` · `PD-3-15` | **CLOSED** by rows 8 / 9 / 13 / 10 / 11 / 12 / 7 |
| **`PD-3-07`** | ⚠ **Consumed PARTIAL at PR 1, CLOSED here** by rows 4, 5, 6 — sites 2–5, **all four guarded by `dharma-spacing.test.tsx`** (GC-3). ⛔ **ATTRIBUTED PER SITE, NOT PER ROW — GC-10:** **sites 4–5 → `C2`** *(discharged by T3's rebuild of `AggregateFooter`'s whole render body)* · **sites 2–3 → `C10`**. **Crediting all four to C10 would credit C10 with work C2 did**, and the close-out's per-commit attribution would be wrong for eight commits' worth of history. **This is the condition on which the closure is defensible:** PR 1 refused to close it *because* the sites were unguarded, so closing it now requires guarding **every** one — and attributing each to the commit that actually discharged it |
| `RR-3` | **CLOSED** by row 15, attended-only |
| **Newly minted (drafted, web-reviewed, not committed by the execute run)** | `HEADER-3ZONE` · `RESOLVER-SCHEMA` · `ID-COLLISION` · question-type-scale · carousel-auto-advance · the T1 preset-duplication row |

---

## §19 · Cost forecast — argued against PR 1's actuals — **C**

| Metric | PR 1 forecast | PR 1 **actual** | Miss |
|---|---|---|---|
| Commits | 5 | **16** (7 work + 9 remediation) | **3.2×** |
| Gate C reads | 1–2 | **4** | 2–4× |
| Remediation share | — | **56 %** | — |

⚠ **Two of PR 1's four Gate C reads found defects in WEB's rulings, not in execution.** A forecast modelling Gate C as an execution-quality check is mis-specified. **This forecast models it as a ruling-quality check.**

**PR 2 forecast: 13 build commits (§9) + 6–9 remediation ⇒ 19–22 commits; 4 Gate C reads.**

> ### ⚠ THE READ-COUNT FORECAST WAS REVISED UPWARD ON THE CONDITION THIS PLAN SET FOR ITSELF
>
> v1.2 wrote, of read 1's four findings: *"if read 2 returns a comparable count, the 3-read figure should be revised upward rather than defended."* **Read 2 returned FIVE** (GC-5…GC-9) plus four commit-0 re-measurements. **Revised to 4, and the condition discharged rather than argued away.**
>
> ⚠ **Read 3 returned TWO — `GC-10` and `GC-11` — a genuine fall, and it is NOT claimed as vindication.** Both are document defects; **`GC-10` is the most consequential finding of any read** (a commit credited with work another commit does) and would have shipped a wrong attribution into the close-out. **The 4-read figure stands unrevised.**
>
> ⚠ **AND THE FINDING RATE HAS NOT SHIFTED FROM PROSE TO CODE.** Read 1: three-of-four prose defects. Read 2: **five-of-five** document defects. Read 3: **two-of-two** document defects. ⛔ **PR 2's risk lives in its own plan text, not in its fifteen single-file render edits.** *(PR 1's §10 finding, reproduced a fourth time.)*

**The argument, not an assertion:**

- **Above PR 1 on commits, below it on remediation share.** PR 2 has 13 planned commits to PR 1's 7. But PR 1's 9 remediation commits were dominated by **one-time discovery** the RUN-TRACKER §1 enumerated as non-recurring — §6-forbade-the-doc-writes, phantom allow-list paths, the `SCHEDULED` sweep, the ADDITIONS convention. **Those are fixed on `main`.**
- **⚠ AND THE CLASS THAT COST POLISH.5 PR A THREE RUN-STOPS IS STRUCTURALLY ABSENT.** `POLISH-SURFACE-TEMPLATE.md` §13.6 — *a plan that widens a shared DTO must allow-list every file that CONSTRUCTS or ASSERTS it* — **has no subject in PR 2** (§13, checked and recorded). PR 2 writes no server file, no schema, no migration. **This is the single largest structural difference between PR 2's risk profile and PR A's**, and unlike a forecast argument it is a property of the allow-list rather than a prediction.
- **The ruling-defect rate is the risk that carries.** Two of four PR-1 reads found web-ruling defects. **That mechanism was offered as the reason reads would fall 4 → 3, and it did not hold at read 2** (`GC-9`, an unsatisfiable web-ruled precondition). *(Struck as a forecast argument; retained as the correct diagnosis of where risk lives.)*
- **`MarketHeader.tsx` takes ONE edit.** Every estimate in this task assumed a header rewrite. §4 measured none.
- ⛔ **No wall-clock projection** (§14.2).

⛔ **"Comparable to PR 1, not larger" is STRUCK.** It is false: **PR 2 carries 15 work units to PR 1's 6.** PR 2 is **larger in count and smaller in risk per item.**

⚠ **GC-11 — the exception clause is DELETED, not corrected.** v1.2 read *"every row but `RR-3` and the three `PostPopup` F rows is a single-file render edit with no data path."* v1.3 corrected *three* → *two* and kept the clause. **Both `PostPopup` F rows ARE single-file render edits with no data path** — `PD-3-13` and `PD-3-14`'s own register rows record *"ADR-0034 D-1 does not fire"*, and §8 assigns both to `dialogs.tsx` alone with no server file anywhere on the allow-list. **`RR-3` is the only genuine exception.** ⛔ **Deleted rather than re-corrected: the count in this clause has now been wrong three times (three → two → zero), and a clause that keeps being re-counted is a clause that should not exist.** *(§13.3, applied to this plan's own prose for the second time — the first was §0.)*

⇒ **The corrected sentence, which states no count at all:** every §6 row is a single-file render edit with no data path, **except `RR-3`**, which is attended-only and carries both reviewers (§15).

**H-SCOPE not triggered.** **15 work units across 18 rows · 13 commits · one file per commit**, each independently revertible. ⚠ **"One file per commit" holds for each commit in isolation and NOT across the PR** — three files are written by two commits each (§9 GC-7). **No split proposed.**

---

## §20 · Re-key procedure (A2) — **C**

Runnable by an executor who has read nothing but this plan.

```
1. git fetch && git rev-parse origin/main
   → equals ea1795e?  proceed.  differs?  continue anyway — steps 3-6 are
     what make this plan branch-point-independent.

2. §1 P1 — ONE gate, already MET at authoring:
     gh pr view 333 --json state,mergedAt      → MERGED
     git merge-base --is-ancestor b7c2a38 origin/main   → exit 0
     git log origin/main --oneline -- src/components/ui/thumb-glyph.tsx
                                                → non-empty
   → any of these fails?  ⛔ history was rewritten.  STOP and surface.
   ⛔ Do NOT check POLISH.6.  It has MERGED and is not a gate in either
      direction (§1 GC-9 history).
   ⚠ ALSO re-run the census-coupling check (§1 R-1):
     grep -c '<SideBadge' on every .tsx under src/   → expect 13 total,
       8 unsized.  A different number means an out-of-track PR moved
       side-badge.test.tsx's subject; re-read §7 before writing C6.

3. For every §6 and §8 anchor `file:line (symbol)` or `file::symbol`:
     grep -n "<symbol>" <file>
   Compare the found line to the plan's.

4. Classify:
   DRIFTED  — symbol present, line moved      → update the anchor, continue.
   ABSENT   — symbol not found                → ⛔ H-REKEY. STOP.
   RENAMED  — file has a near-match, not the symbol → ⛔ H-REKEY. STOP.
   DUPLICATED — symbol matches >1 site in file → ⛔ H-REKEY. STOP.

5. Re-run §7's suites; record which are green BEFORE any edit.
   ⚠ Check the result against §12's H-GREEN schedule, not against "all red".

6. Write the re-key result into the branch's first commit body.

7. ⚠ INTER-COMMIT RE-KEY — steps 3+4 again, DURING the run, not only at
   the branch point.  Before starting any commit whose file an EARLIER
   commit in this same PR already wrote, re-grep that file's anchors.
   The complete set is three pairs (§9 GC-7):
     before C10 → re-key AggregateFooter.tsx   (C2 rewrote :12-22, and
                  rows 4-6's :14/:19 are inside it)
                  ⛔ AND APPLY §9 GC-10: sites 4-5 are a VERIFICATION at
                  C10, not an edit.
     before C6  → re-key dialogs.tsx           (C5 wrote :35 and :44-51;
                  row 10's :19-58 contains both)
     before C9  → re-key PostCard.tsx          (C8 deleted :111-128; row 3
                  at :102-109 is above it and should survive — CONFIRM it)
   → DRIFTED is the EXPECTED case here: update and continue, never halt.
   → ABSENT / RENAMED / DUPLICATED still ⛔ H-REKEY.
```

**Pass bar:** every anchor classified, zero ABSENT / RENAMED / DUPLICATED — **at the branch point AND at each of step 7's three checkpoints.**

**Failure looks like:** `grep -n "PostPopup" src/components/debate/dialogs.tsx` returning nothing (ABSENT) or two `export function PostPopup` (DUPLICATED). Either means the plan was written against something that no longer exists — **the plan is returned to plan-mode, not patched at execute.**

### ✅ v1.4 · THE RE-KEY HAS BEEN RUN — `16971cd` → `ea1795e`, six merges

**Steps 1–6 executed. Result: every §6 anchor EXACT. Zero DRIFTED, zero ABSENT, zero RENAMED, zero DUPLICATED.**

| Anchor | At `ea1795e` | Class |
|---|---|---|
| `PostCard.tsx:102-109 (PostCard → Button onOpenPopup)` · `:111-119` · `:120-128` | unchanged | ✅ EXACT |
| `ReplyCard.tsx:55 (ReplyCard → stake span)` · `ArgProfile.tsx:67 (ArgProfile → authorStake span)` | unchanged | ✅ EXACT |
| `AggregateFooter.tsx:12-22 (AggregateFooter → render body)` · `:14` · `:19` | unchanged | ✅ EXACT |
| `BookmarkToggle.tsx::CardActions` (evidence `:161-169`) | unchanged | ✅ EXACT |
| `dialogs.tsx:19-58 (PostPopup)` · `:35` · `:38-43` · `:41` · `:44-51` | unchanged | ✅ EXACT |
| `ReplyPreview.tsx:29,33,48 (ReplyPreview)` | unchanged | ✅ EXACT |
| `CommentImage.tsx:28 (CommentImage → img className)` · `MarketHeader.tsx:80-82 (MarketHeader → description <p>)` | unchanged | ✅ EXACT |
| `ui/dialog.tsx:61 (DialogContent → max-w-lg)` · `ReplySplitBar.tsx:64,67 (ReplySplitBar → track/fill spans)` · `:118-122` | unchanged | ✅ EXACT |
| `globals.css:179-180 (:root → --imgmax / --imgr)` · `no-raw-hex-view-layer.test.ts:20 (SCAN_DIRS)` | unchanged | ✅ EXACT |
| `MarketPriceChartOverlay` symbol | present | ✅ |

**⚠ THE ONE THING THAT MOVED IS A TEST, AND IT IS §8 ROW 20.** `tests/unit/debate/render/side-badge.test.tsx` — **+86 / −20** across `5ff418b` (#331) and `ea1795e` (#336). **§7's quotation of its internals was stale in every particular and is corrected there** (12 → 8 base sites; a 13th → a 9th; both assertions → one). ⛔ **This is the whole argument for step 2's census check: a plan that quotes a test by line and by number must re-quote it, and the re-key of SOURCE anchors would not have caught it.**

**Two-point diff over §8's paths, for attribution** (`git diff --numstat 16971cd..ea1795e`): `composer/SlotHeader.tsx` `1/29` ← `b7c2a38` · `side-badge.test.tsx` `86/20` ← `5ff418b` + `ea1795e`. **Both attributable; zero unattributable paths.**

⚠ **WHY STEP 7 EXISTS, STATED SO IT IS NOT OPTIMISED AWAY.** Steps 1–6 verify the plan against **`main`**. They never verify it against **itself**. Every anchor can be correct at the branch point and wrong by commit 10, because this PR is the thing moving the lines. **`O-8`'s harm — *"a line-keyed fence goes stale from the very edit it guards"* — is at its sharpest inside a single PR, where the guarding and the editing are the same run.** *(GC-7.)* ⚠ **GC-10 shows the sharper case: the earlier commit does not merely move the later one's lines, it can do the later one's WORK** — which no coordinate check detects, and which §13's discharge row exists to catch.

---

## §21 · Carried obligations from PR 1's log — **W · C**

| # | Obligation | Disposition |
|---|---|---|
| 1 | **`PD-3-07` consumed PARTIAL, STAYS OPEN.** Sites 2–5 not guarded by anything today | **PR 2 carries the guards for ALL FOUR sites** — rows 4, 5, 6, guarded by **`dharma-spacing.test.tsx`**. ⚠ **Corrected at GC-3:** v1.1 named `aggregate-footer.test.tsx`, which reaches **row 6 only**. ⚠ **And attributed PER SITE at GC-10** — sites 4–5 discharge at **C2**, sites 2–3 at **C10** (§18). Between the PRs `/m/[slug]` renders spaced in the header, unspaced in the cards: a **ratified consequence of the OD-1 split, not a defect to file** |
| 2 | The `(auth)`-boundary follow-up's **five obligations** | ⚠ **NONE is PR 2's.** (1)(2)(3) → `tests/server/auth/auth-error-boundary.test.tsx`, POLISH.7a's lane. (4) → `bookmarks/render/side-encoding.test.tsx` + `profile/render/argument-list-side.test.tsx`, **cross-lane per C5**, POLISH.5/.6's. (5) → `discovery/render/carousel.test.tsx`, POLISH.2's. **All five docketed to their surfaces; none absorbed** |
| 3 | **S-L4 · no `Sentry.captureException` in ANY error boundary** | ✅ **Re-verified at `ea1795e`: five boundaries exist** and **all five contain zero `captureException`**. ⚠ **NOT PR 2's** — an observability change across five surfaces in four lanes, not a card fix. **Docketed with a named owner: HARDEN.** Not a regression from PR 1 |
| 4 | **The render-census re-measurement** | ⚠ **Owner unresolvable as cited, and the reason is itself a finding.** PR-1 log §7 says *"D4 owns both"*. **`POLISH-3.md` D4 is a route-state ruling** that cannot own a markdown-census re-measurement. ⇒ **A SIXTH `ID-COLLISION` instance — and a DISTINCT SUB-GENUS**: instances 1–5 are two definitions competing for one ID; this is **one document citing another's ID space without naming it**, unresolvable *by construction*. **Docketed to POLISH close-out**, which owns the census |
| 5 | **`allow_rebase_merge` is `true`** | ✅ **PR 1's log is CORRECT and stands unamended.** Repo settings are `{merge, rebase, squash} = true`, but branch protection carries **`required_linear_history: true`**, which blocks merge commits regardless. ⇒ **The reachable set is squash or rebase — ONE unenforced axis, not two.** ⚠ An earlier draft read the repo setting alone and reported "two axes"; **a correction of a correction, made without checking the protection layer**, struck. "Squash-merge only" remains **discipline, not enforcement**, on the rebase axis |

### ⚠ v1.4 · TWO REGISTER-HYGIENE INSTANCES FOUND WHILE RE-KEYING — RECORDED WITH OWNERS, FIXED BY NEITHER

⛔ **Both are outside §8's allow-list. This plan records them and changes nothing.** Recording is the disposition; a fix from inside PR 2 would be an out-of-fence write.

| # | Instance | Genus | Owner |
|---|---|---|---|
| 6 | **`docs/plans/POLISH-3-RUN-TRACKER.md` §4 still reads *"Three F rows land there"*** for `PostPopup`. **`GC-8` ruled it TWO** — read off §6's Class column, `dialogs.tsx` carries five rows and exactly two are class F (`PD-3-13`, `PD-3-14`); rows 9, 10 and 14 are R, V and V. The correction was applied in this plan and **never at the site on `main` that states the superseded figure** | **`O-5`** — *a durable amendment is applied at every site that states the superseded position* | **POLISH.3 close-out** (§5 D3, register hygiene). ⚠ It also still shows `A1 · Merge PR #327 ▶ NEXT`, three merges stale — same sweep |
| 7 | **`docs/plans/POLISH-5.md` cites `POLISH-TRACKER.md` by a line number that is stale in FIVE places, every one by exactly +2.** `:172`, `:1465`, `:1900` cite `:130` for the serial rule, which lives at **`:132`**; `:1891`, `:1915` cite `:132` for the *".8 ran out of order"* quote, which lives at **`:134`**. A single insertion above them moved all five | **`O-8`** — *fence by symbol, never by line* | **POLISH.6 close-out**, which is already sweeping `POLISH-5.md`. **Remedy: fence by the heading string `"Execute serial"`** and demote the line to evidence |

⚠ **Instance 7 has a live consequence worth stating once.** A reader who follows `:130` at HEAD lands on `D-4`'s status line and **never reaches the serial rule at all** — the citation does not merely drift, it resolves to different content that reads as if it were the rule. **That is why `O-8` grades line-fences as a defect rather than an untidiness.**

---

*End plan **v1.4** (2026-08-15 — **re-ground and Gate C read 3**). **Founder rulings absorbed: `R-1`** the serial rule does not gate PR 2, HTML-FINISH is a separate track, **recorded with the disjointness measurement rather than alone** (§1) · **`R-2`** §15 governs the queue, PR 2 runs now, **with the §0.3/§15 ambiguity it resolves** (§1). **Gate C read 3: `GC-10`** C2 discharges rows 4–6's sites 4–5 eight commits before C10 — §18 attributes per site, §9 C10 becomes a verification, §12's `H-GREEN` widens to cover green-too-early with a named schedule, §13 gains the discharge check **and the sweep across all thirteen commits found no second instance** · **`GC-11`** §19's exception clause **DELETED, not corrected**, after three wrong counts. **`POLISH-5.md` struck at all five citation sites** — sites 1, 2, 5 spent, site 3 superseded by `D-4` and recorded as GC-9's history, site 4 (`P1`) kept, **MET, and re-grounded in `b7c2a38` with ground (b) preserved in words**. **§13.6 checked and recorded as not firing.** **§20 re-keyed at `ea1795e`: 22 source anchors EXACT, one test moved and §7's stale quotation of it corrected.**)*

*Measured at `origin/main` = **`ea1795e`**. ⚠ **Nothing in this plan is GROUNDED on `docs/plans/POLISH-5.md`** — §2–§12 and §14–§20 contain zero hits, and the surviving mentions are enumerated by section in §1 as records rather than grounds. ⛔ **No count is stated for them**, for the reason §1 gives.*

*⛔ **`H-A3` is DISCHARGED.** P1 is MET at `b7c2a38` (#333); `origin/main` has been re-read and every coordinate re-keyed. **PR 2's branch point EXISTS and the plan is executable at it.** Nothing is committed, there is no branch, and nothing has been written to `docs/plans/`. The plan is **DONE AND WAITING ON RATIFICATION**, which is its correct state.*
