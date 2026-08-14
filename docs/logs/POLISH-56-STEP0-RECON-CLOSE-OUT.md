# ZUGZWANG · POLISH.5 + POLISH.6 · STEP 0 + RECON — CLOSE-OUT

**Task:** POLISH.5 / POLISH.6 · Step 0, recon, ratification, plan-chat authoring
**Chat:** web orchestrator · CHAT 1 of the two-chat kickoff
**Ground:** `2326e843bc524f20dc5ffd44f11db510172b4eae` — *POLISH.3 commit 0 (#327), doc-only*
**Date:** 2026-08-13 IST
**Result:** Both recons complete and ratified. Both plan-chat kickoffs authored. **Zero repo writes from this chat.**

---

## §1 · WHAT THIS CHAT ACTUALLY DID

It was scoped as Step 0 + recon. It ran past that, deliberately, because the recon returned findings that could not be handed forward unresolved.

| Phase | Output |
|---|---|
| Step 0 · gate | `POLISH-56-phase0-gate.md` · `920e52c9…` · 216 lines |
| Commit-0 anchors | `POLISH-56-commit0-anchors.md` · `952decb4…` · 563 lines · 16 anchors |
| POLISH.5 recon | `POLISH-5-recon.md` · `b41c9af4…` · 217 lines · `P5-D01…P5-D26` |
| POLISH.6 recon | `POLISH-6-recon.md` · `962373f0…` · 149 lines · `P6-D01…P6-D14` |
| DTO + destination measurement | `POLISH-56-dto-measurement.md` — three-state frame, five destinations |
| Ratification | 40 delta dispositions · 25 numbered decisions |
| Plan-chat kickoffs | `POLISH-5-plan-chat-KICKOFF.md` (16 items) · `POLISH-6-plan-chat-KICKOFF.md` v1.1 (6 items) |

**Every md5 and line count verified on arrival.** No artifact was accepted on assertion.

---

## §2 · THE FOUR ESCALATIONS

Ordered by what a participant hits first, not by cost.

### E-1 · `/bookmarks` is unreachable — `P5-D01` + `P6-D01`

Exhaustive `href` inventory: **five literals in all of `src/`** — `/`, `/admin/markets/new`, `/admin/moderation`, `/admin/moderation/audit`, `/sign-in` — and ten template forms. **None is `/bookmarks`.** No `router.push`, no `redirect`.

The intended control is the identity card's `#bmgo` → `nav('bookmark')` (mockup `:438`, wiring `:730-733`). `IdentityCard.tsx:47-66` has no acts cluster.

- **W2.13 R2 explicitly KEEPS it** — `:46`, *"KEEP the bookmark icon — it opens bookmarks, a real function."*
- **The deferral discharged.** `UI-A5.md` §4 `:111` / §16 `:245` deferred it with *"bookmark arrives at A6."* A6 shipped — ADR-0032, PR #254, migration `0024_bookmarks` — without it.
- **NOT `BOOKMARK-ADD-WIRE`**, which covers the per-card toggle. Wiring every card still leaves the page unreachable.
⇒ **Dated lane item (D10).** Owner and date needed **before Sep 15**. Not POLISH's.

### E-2 · The positions table renders no frozen side — `P5-D02`, tier 1

SPEC.1 §23 `:1641` requires the frozen side per holding. `PositionsTable.tsx:137` renders `row.marketTitle`; `row.side` reaches only `:182`, a prop pass into a mocked-away `SellModule`. **`POLISH-0.md` §3 names *"frozen side badge"* as one of `.5`'s three invariant obligations.**

Nothing caught it because `surface.test.tsx:237-240` pins the header set — it asserts what is there, never what should be.

⇒ **Ships in `.5` PR B.** No DTO change: `side` is on the row at `positions.ts:68`.

### E-3 · `/bookmarks` is a fork — `P6-D02`

Three tiers say *reuse the profile surface in forced-visitor mode*; `design-canon.md` §3 item 9 `:65` puts *"not a fork"* inside the **invariant spine**. The build renders `PageContainer` → `<h1>` + `<Badge>` + a card list.

⇒ **D8: divergence ACCEPTED, canon `C-` row.** Canon §3 item 9 satisfied by **mode-of-the-card**. Grounds: the DTO difference is structural (`BookmarkItem` is author-keyed by ADR-0032 D-5, `ProfileArgumentItem` is viewer-keyed); mode-of-the-surface would put an identity card and tiles on a route spanning many authors; and **the tier-4 artifact anticipates the divergence in its own comment** — `:47-48`, *"Mockup reuses the demo rows; production loads the user's bookmarked posts/replies here."*

### E-4 · The emoji — a fourth-generation transcription

| Gen | Artifact | Text |
|---|---|---|
| 1 | `surface_profile_v1_0.html:100` (v0.6 log) | *"the **monochrome** thumb (Yes 👍 38% grammar)"* |
| 2 | `DESIGN_W2_13…CLOSE-OUT.md` §2 | a surface SVG thumb *(👍/👎-style)* — **not emoji** |
| 3 | `POLISH-5-recon.md`, `P5-D02` | thumb glyph (`Yes 👍`/`No 👎`) |
| 4 | `.5` kickoff §3 item 1 | *"word + thumb glyph (`Yes 👍` / `No 👎`)"* |

Generation 1 puts a colour emoji in the same parenthetical as the word *monochrome*. Generation 2 forbids emoji in the sentence that uses one. **By generation 4 the shorthand had become the instruction.**

**CI cannot see it** — `tokens-monochrome.test.ts` pins hex declarations, `no-raw-hex-view-layer.test.ts` pins hex literals. An emoji codepoint is neither. It ships green onto a surface ratified true-neutral, and encodes side by hue in parallel with INV-3's fill.

⇒ **D1(b), with the fallback pre-ruled: tier 2 beats tier 4, so if no reusable primitive exists, word-only — never emoji.** The fix is **structural (O-1)**: commit 0 adds a canon line pinning the thumb **by component name and props**, so the authoritative source stops using shorthand. Landed artifacts are not retro-edited (`PD-5-01`'s routing correction is the precedent).

---

## §3 · DECISIONS OF RECORD — 25

| # | Ruling |
|---|---|
| D1 | **WITHDRAWN** — replaced by D5 after CC established a higher tier |
| D2 | R12 · **consolidate.** `.5`'s site list is exactly two, both in `ArgumentList.tsx` |
| D3 | *"Apply before inspecting"* discharged **by reading**; the write stays in commit 0 |
| D4 | The integration shell is **not in the repo**; the receiver is, so `.6`'s machine phase is unblocked and only the founder visual pass is affected |
| D5 | **R11 CLOSES ENTIRELY.** Arms (i)/(ii) conform against **tier 1** (SPEC.1 §23 `:1658`, `:1660`); arm (iii) does not arise (`settled ⇒ statusLabel === "Closed"`); its only candidate is `PD-0-05`/R2 |
| D6 | Commit 0 is a **doc-only PR ahead** of both machine PRs |
| D7 | `GRAPH-DEFER` / `GRAPH-PERF` **struck** — one occurrence tree-wide, no definition |
| D8 | The `/bookmarks` **fork is accepted**; canon `C-` row |
| D9 | `.6` widens to `page.tsx` for `P6-D06` **only**, symbol-fenced; `P6-D01` routes out |
| D10 | `/bookmarks` reachability = **dated lane item**, outside POLISH |
| D11 | §A files under POLISH.5 **by provenance**; every `routed_to` names a live destination or declares it has none |
| D12 | `P5-D05` replica-head omission — **accepted divergence** |
| D13 | `P5-D08` — **teaser with a clamp**; the title `<Link>` is the read affordance. No `+` control, no popover |
| D14 | `P5-D13` — **tier 1 governs the Sell host.** SPEC.1 §23 `:1660` settles `UI-A5.md:113`↔`:116` |
| D15 | `P5-D15` — **superseded.** The mockup's `Open` selects into a two-pane replica the build has no counterpart for |
| D16 | `P5-D20` **splits** — the lying docblock now, the ring encoding routed |
| D17 | `PD-3-15`'s coordinate drift (`:164-168` → `:161-169`) fixed in commit 0, declared cross-surface |
| D18 | The four canon `C-` rows land in **commit 0** |
| D19 | **Two CARRIED classes** ⇒ `arguments.ts` admitted to `.5`'s allow-list, symbol-fenced, own commit |
| D20 | **Mint O-6** — a fence forbids reading and cannot prevent arriving |
| D21 | `P5-D06` — **stake ships, `→ current` does not.** Đb is a property of a holding, not of a comment |
| D22 | The post's stake ships in the same commit as the price |
| D23 | The passthrough lands in **`.5`'s PR**, own commit; `.6` records the adoption |
| D24 | `P5-D16` **OUT** — entry %/live % never queried; row P/L needs a **SPEC.1 §10.8 amendment** |
| D25 | Commit 0 mints the profile-graph-node row and the guard-hardening docket, retargets OQ-7, corrects `POLISH-register.md:314` |

**Concurred with the `.5` plan chat:** D1(b) glyph · D2(b) client leaf, **relocated to `src/components/ui/`** · D3 held for M2 · D4(b) both reviewers · D5(b) two PRs. Commit-0 handling: **author now, land after, mint no `PD-5` ID.**

---

## §4 · REGISTER MOVEMENT

**Minted at commit 0:**

> **O-6 · A fence forbids READING and cannot prevent ARRIVING.** POLISH.5/.6's fence named `~/Downloads/POLISH-3-PR1-*` unreadable; the harness surfaced ~600 lines of it into the session as an editor selection, by a route neither operator nor session chose. The session did not open it, used none of it, and **said so unprompted** — the only reason the event is visible at all. **A fenced artifact that arrives unbidden is DECLARED in the run's output, its bearing on the run's subject is STATED, and the run continues or halts on that statement — never on silence.** A fence honoured only by not-reading is unfalsifiable; the declaration is what makes it checkable.

**CC applied O-6 three times unprompted, including once after the injection had gone stale.**

**Proposed, evidence attached, not yet minted:**

> **V-10 · A register cell is not a baseline.** Re-derive from the highest tier that speaks before accepting a row's own account of what it violates. Four instances in one task: `PD-0-12` twice — the register said *"— (unspecified)"*, tier 4 specified it, then tier 1 specified it harder — and `PD-0-01` on both surfaces, where the register says *"bare CSS clamps with no affordance at all"* and `design-canon.md` §5 `:92` ratifies the clamp explicitly.

**Working rule, not minted:** *a truncated relay output is not evidence a section went unanswered. Re-request the artifact; do not re-ask the question.* Earned by building a resume relay from a truncated paste and marking four answered sections *"NOT ASKED."*

**Live ceilings at close, read off `main` (O-2):** `V-8` · `O-4` · `§13.5` · `PD-5-01` · `PD-6` none.

---

## §5 · MEASUREMENT VOCABULARY — adopted

CC replaced a binary that would have produced two wrong answers:

| State | Meaning |
|---|---|
| **PRESENT** | on the exported type |
| **CARRIED** | queried, typed, canonicalised onto a substrate, **dropped before the boundary** |
| **ABSENT** | never queried |

And a fourth qualifier that decides rulings: **never-queried and never-receivable are different absences, and only the second closes a question.** `positions.ts`'s entry % is a field the module *could* project from data it already holds; `figures.ts`'s price is a quantity it never receives and whose granularity does not match its key. That distinction is why `P5-D16` routes out and `P6-D03` ships.

**The single drop site.** `BookmarkItem` is `Extract<ProfileArgumentItem, …>` plus three own fields, and `list.ts` imports `buildPostItem`/`buildReplyItem` from `arguments.ts`. **One edit serves both surfaces.** `P5-D04` and `P6-D03` are two rows and one commit.

---

## §6 · BROKEN DESTINATIONS — commit 0 fixes four

| Destination | State |
|---|---|
| **A11Y.0** | Real row, **undated** — but `parked.md:1061`: *"It gates a STATUS, not a build. No surface's work waits on it."* ✅ **Undated ≠ phantom.** My earlier framing over-escalated |
| **CHART-NODE-RING** | Real, undated, **market-scoped only** ⇒ D16's target does not exist. Commit 0 mints a profile-node row |
| **OVERLAY.FOCUS** | A table row **nested inside** A11Y.0. Its own text: *"A claim that a thing is docketed is not a docket"* |
| **OQ-7** | ⚠ **Not a docket** — a UI-A5 open question **discharged at execute**. Two copy rows route to a closed plan artifact. Commit 0 retargets |
| **guard-hardening docket** | ⚠ **Genuine phantom.** Two occurrences tree-wide, both routing *to* it; its `F16` cross-reference resolves only **off-repo**. Commit 0 mints it |
| `POLISH-register.md:314` | ⚠ **Stale** — `BOOKMARK-ADD-WIRE` shipped 2026-07-30 (PR #273). ⚠ Its **slice 4, the Profile arm, was deferred**, corroborated at head |

---

## §7 · WHAT REMAINS

| # | Item | Owner | State |
|---|---|---|---|
| 1 | **`.5` plan chat** | open | Awaiting M1–M4 + D3 |
| 2 | **`.6` plan chat** | ready | v1.1; **one blank left** — D3's `.sub` ruling |
| 3 | **Commit 0** — ~20 edits + the canon glyph line | **web, unauthored** | Anchor pack in hand |
| 4 | **Gate C on PR 1** | **web, unread** | Draft #328, head `37fb25e`, 606-line diff in hand |
| 5 | PR 1's two HIGHs | founder + web | `NEW-1` zero behavioural coverage on `error.tsx`; `NEW-2/3` `PF-1…PF-4` cited as authority, defined nowhere. Both *"before merge, not after"*; neither fixable in-branch |
| 6 | `/bookmarks` reachability | founder | Needs an owner and a date **before Sep 15** |
| 7 | SPEC.1 §10.8 amendment | founder + web | Row-P/L display basis. `P5-D16` blocked on it |
| 8 | PK refresh | CC → operator | ⚠ **After commit 0 merges**, not now — ten of its edits correct documents PK mirrors |

**Serial chain:** `commit 0` → `.5 PR A` → `.5 PR B` → `.6 PR`. Gate C on PR 1 gates all four.

---

## §8 · WHAT WENT WRONG IN THIS CHAT

Recorded because the pattern is more useful than the instances.

1. **I ruled `PD-0-12` as `accepted-divergence` on a false premise** — the register said no baseline; tier 4 had one. I withdrew it. CC then showed tier **1** had one, and R11 closed entirely. **Two tiers above where I looked.**
2. **I path-qualified `copy.ts` to the wrong file.** `c2Strip` exists at one site tree-wide and it is POLISH.4's. My fix for an under-specified path would have made it specifically wrong.
3. **I transcribed a colour emoji into a plan instruction** (§2 E-4).
4. **I wrote an unsatisfiable admit-check** — asked two phases to verify a line count against something that, per §13.3, cannot exist. §13.1 firing on my own prompt, one turn after I explained §13.1.
5. **I built a resume relay from a truncated paste** and marked four answered sections *"NOT ASKED."*
6. **I asked the founder a question the repo answers** — whether A11Y.0 carries a date.
7. **I said "four of five `.6` items adopt `.5`'s treatments."** Three of five adopt primitives already on `main`. The error over-sequenced the plan chats by a full cycle.

**The through-line: accepting a summary where an artifact was available.** Items 1, 2, 5 and 7 are the same failure. It is what `V-10` is for, and it is why the recons' *"open every file you name"* rule earned its place.

**CC corrected the author on every single run of this task, and every correction changed what shipped.** The corrections came from CC sessions and from the `.5` plan chat, not from this one.

---

## §9 · ADMIT-CHECK

- Version: `POLISH.5+.6 · STEP 0 + RECON · CLOSE-OUT — v1.0`
- Ground: `2326e843bc524f20dc5ffd44f11db510172b4eae`
- Section sequence: §1 · §2 · §3 · §4 · §5 · §6 · §7 · §8 · §9
- Decision range contiguous: **D1 … D25**, no gaps, D1 withdrawn in place
- Recon artifacts pinned by md5: `b41c9af4…` (`.5`) · `962373f0…` (`.6`)
- **Zero repo writes from this chat.** Every write is commit 0's or an execute PR's
- No line-count assertion is made about this file (§13.3)
