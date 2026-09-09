# MOBILE-1-HEADER — The signed-in header at phone width

> **Status:** **reviewed** — all four rulings and the §7.3 substitution signed
> off 2026-09-09; Phase 1 closed by the commit carrying this file
> **Date:** 2026-09-08, finalised 2026-09-09
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** **no** — CLAUDE.md §1's seven areas are untouched: no auth
> logic, no server module, no schema, no migration, no Dharma movement. It runs
> the full ritual anyway by kickoff instruction, because it edits the shell
> header every route mounts and it **inverts two shipped guards**.
> **Plan PR / commit:** this file, committed as Phase 1's close (CLAUDE.md §5.1)
> **Branch:** `fix/mobile-1-header-signed-in-phone-width`, cut from `origin/main`
> at `b19bb43`

⛔ **The branch changed at finalisation, and the reason is a documented trap this
plan nearly walked into.** Phase 1 ran on
`chore/adr-0049-signed-in-header-at-phone-width` — which **had already been
squash-merged as PR #510** on 2026-09-08. Asked by hash it looked live; asked by
content (AGENTS.md §10) it was dead: `git rev-list --count HEAD..origin/main` = 1,
`gh pr list --state merged --head …` returned #510, and the **tree hashes were
equal** — `6c485573fb4639bf1a220df9142e681d8681cfd7` on both sides, the positive
receipt that the squash landed byte-for-byte. Committing Phase 1 there would have
reproduced MOBILE-1 Phase A's own failure, which built an entire phase on an
already-merged branch. ⇒ Work continues on a branch cut fresh from `origin/main`.

✅ **ADR-0049's `:13` obligation is discharged, and it was THIS PR's to
discharge** — the ADR instructs its number be re-read against the merged head
before its PR lands. Measured 2026-09-09 after `git fetch`:
`git ls-tree --name-only origin/main docs/adr/` ceiling is
`0049-signed-in-header-at-phone-width.md`; next free is `0050`. **This task mints
no ADR**, so nothing further is owed — but the re-read is recorded in the PR body
per that instruction rather than assumed.

---

## Tracker context

**No tracker row.** MOBILE-1 is an ad-hoc continuation lane; ADR-0049 records it
as *"MOBILE-1 (continuation; ad hoc, no tracker row)"* and that is the whole of
the tracker context. The frame document is
[`docs/adr/0049-signed-in-header-at-phone-width.md`](../adr/0049-signed-in-header-at-phone-width.md),
ratified by Hrishikesh 2026-09-08 and **merged to `main` as PR #510** (`b19bb43`).

**Declared dependencies and their status at plan time:**

| Dependency | Status |
|---|---|
| ADR-0049 (the ruling this executes) | **merged to `main`**, PR #510, `b19bb43` — ⚠ *not* "on this branch", which is how Phase 1 first recorded it |
| ADR-0048 (both header mounts opt in) | **landed and live** — `(auth)/layout.tsx:190` passes `mobileResponsive` |
| ADR-0045 (`--breakpoint-mobile: 640px`, override-never-replace) | live; auth carve-out superseded by 0048, the rest stands |
| MOBILE-1 Job A (PR #486 → the prop chain) | merged; this task extends the same chain by two hops |
| MOBILE-1 Job B (PR #509) | merged at `7ffc18a` |

**No ADR is minted by this task.** ADR-0049 already exists and is the
architectural record (CLAUDE.md §5.12 — one ADR per architectural change, and it
landed ahead of the code rather than with it because the *decision* was the
founder's to make first).

## Approach (one paragraph)

Thread the existing `mobileResponsive` prop two hops further — into
`DharmaCluster` and `IdentityCluster` — and let each component carry its own
`max-mobile:hidden` on the node that should disappear: the Đ cluster's **root**,
and the identity chip's **pseudonym span**. No wrapper element is introduced
anywhere, because the header's right zone is a flat DOM order that a shipped
guard depends on. Because the hide then lives outside `GlobalHeader.tsx`, the
guard that promises those two components are *never hidden* cannot see it — so
that guard's two rows are not merely inverted in place but **relocated to the
files that now carry the behaviour**, and the third guard (`IdentityCluster`
carries no responsive token at all) is inverted into a closed allowlist. The
remainder of the work is the O-5 sweep ADR-0049 enumerates, converted from line
fences to symbol fences first, because the list invalidates itself on the first
edit.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity (INV-1) | **no** | No bet, comment or transaction path is opened. The diff is **four `src/` files / seven sites** (§7.1), all presentational, **none under `src/server/`**. | n/a |
| 2.2 Dharma non-transferable / no overdraft (INV-2) | **no** | `DharmaCluster` is a read-only renderer of two strings the layout already fetched; this task changes only whether one CSS rule applies to it. No ledger read is added, removed or moved. ⚠ Note the **display** consequence in §5 F-2 — a hidden figure is not a changed figure. | n/a |
| 2.3 Side frozen at comment-time (INV-3) | **no** | No comment path. | n/a |
| 2.4 Resolutions append-only (INV-4) | **no** | No resolution path. | n/a |

**Not a critical-path task**, so the per-invariant failure-mode paragraph the
template requires for §1 tasks does not apply. Recorded as checked rather than
skipped: the four were read against the diff surface, not against the task
title.

## 2. Data model changes

**None** — presentational change; no table, column, index, constraint or
migration. `drizzle/migrations/` head stays `0030_liquidity_revoke_app_roles`.

## 3. API surface

**None** — no route handler, no Server Action, no endpoint. The two Đ reads
(`portfolio`, `spendable`) are already performed by `(public)/layout.tsx` and
are unchanged; this task does not stop the fetch, only the render. **That is
deliberate and is stated in §8**, because "hidden on phones, so skip the read"
is the obvious next thought and it is wrong here: a server component cannot know
the viewport, so the read must happen either way.

## 4. UI / user flow

### 4.1 The change, as it lands

Below `--breakpoint-mobile` (640px), on any mount that has opted into
`mobileResponsive`:

| Element | Above 640px | Below 640px | Where the token lives |
|---|---|---|---|
| `HeaderNav` (Back · Home) | visible | **visible, unchanged** | — |
| Radio + GitHub wrapper | visible | hidden (shipped, Phase A) | `GlobalHeader.tsx` |
| `RulesControl` | visible | **visible, unchanged** | — |
| `BrandCluster` mark (48px) | visible | **visible, unchanged** | — |
| `BrandCluster` wordmark + countdown | visible | hidden (shipped, Phase A) | `BrandCluster.tsx` |
| **`DharmaCluster`** | visible | **hidden — NEW** | **`DharmaCluster.tsx` root** |
| **`IdentityCluster` pseudonym text** | visible | **hidden — NEW** | **`IdentityCluster.tsx` span** |
| `IdentityCluster` avatar + chip | visible | **visible** | — |
| `IdentityCluster` JOIN CTA (signed-out) | visible | **visible, unchanged** | — |
| §21.1 register divider | visible | hidden (shipped, Phase A) | `GlobalHeader.tsx` |
| `VisitorCounter` | visible | hidden (shipped, Phase A) | `VisitorCounter.tsx` |

**Resulting signed-in right zone below 640px: the identity chip alone, 44px**
(`pl-1.5` 6 + avatar 24 + `pr-3` 12 + hairline 2). With left zone 157.13px, two
18px gaps and the 48px mark, that is **285px used of a 327px content box at
375px — ~42px of slack**, against the 10.75px the header has signed-out today.
This is ADR-0049 §The measured budget's own second row (*"if the chip wrapper
survives carrying only the avatar… the slack is ~42px"*), not an independent
derivation.

⚠ **~42px is slack, not headroom for a full mark at every phone width, and the
distinction is the one verification requirement 1 exists to catch.** Feeding
`R = 44` into the ADR's model `mark(W) = clamp(0, 48, (W − 84) − L − R)`:

| viewport | mark | note |
|---:|---:|---|
| 375 | **48.00** | full |
| **333** | **48.00** | the threshold — ADR-0049 §Consequence's `W ≥ 313–333px`, upper end |
| 320 | **34.87** | ⚠ **shrunken, not annihilated** — a 1st-gen SE / iPhone 5 viewport |
| 285 | 0.00 | annihilation returns |

⇒ **Annihilation is eliminated across 285–640px** (the ADR's claim, and it
holds). **Shrinkage is not**: between 285px and 333px the mark still renders
short, silently, with zero document overflow. No device this product targets is
in that band, and nothing in the tree asserts that. Stated because §4.1's table
is the kind of thing that gets read as "the mark is fine below 640px now".

### 4.2 The shape, and which of the two mechanisms it satisfies

ADR-0049 §Guards names two constraints pointing at the same place. Answering its
question directly:

**Chosen shape: the hide lives on each component's OWN ROOT (or own leaf), gated
on a threaded `mobileResponsive` prop defaulting `false`. No wrapper element,
anywhere.**

- **It SATISFIES T4** (`dharma-cluster.test.tsx`,
  `orders-dharma-cluster-then-identity-then-divider-then-visitor`). The right
  zone's DOM order and child list are byte-identical before and after; nothing
  changes depth. T4 stays green without being touched.
- **It DODGES G1** (`global-header-mobile-reflow.test.ts`,
  `header-mobile::HeaderNav-…-are-never-hidden`), completely and by
  construction. G1 reads only `GlobalHeader.tsx`; both new tokens live in other
  files. **After this change G1's `DharmaCluster` and `IdentityCluster` rows
  would still pass, while both behaviours had reversed.** That is not a risk to
  manage — it is a certainty, and it is why §4.4 relocates those two rows rather
  than expecting them to redden.

**This is not a novel shape. It is the shape already shipped one node over, for
this exact reason.** `VisitorCounter` carries its own hide on its own root, and
`global-header-mobile-reflow.test.ts:775-784` states why in terms: a wrapper
*"pushes the real `visitor-counter` node down one level — invisible to a
className check, and it is exactly what broke T4 the first time this task
landed."* The precedent, the justification and the guard idiom all exist; this
task copies them rather than inventing a third pattern.

**Rejected: a wrapper `<div className="max-mobile:hidden">`.** Reddens T4, and
§4.3 shows T4 catches it for a subtler reason than ADR-0049 states.

**Rejected: a `className` passthrough prop on `DharmaCluster`.** It would put
the token back in `GlobalHeader.tsx` (satisfying G1's file scope) at the cost of
giving a leaf component an open styling surface, which is a larger and more
copyable pattern than the one problem it solves. `cn()`-gated own-root is what
three sibling components already do.

⚠ **The `cn(base, mobileResponsive && "…")` spelling is load-bearing, not
style.** Two shipped guard helpers parse it structurally:
`nodeClasses()` expects `className={cn(` or `className="`, and
`ungatedBreakpointClasses()` matches `/mobileResponsive\s*&&\s*$/` immediately
before the opening quote. A ternary (`mobileResponsive ? "…" : ""`) is TS-legal,
renders identically, and would be **reported as an ungated class** by the seam
scan. `IdentityCluster.tsx` currently composes with template literals and has no
`cn` import; it gains one.

### 4.3 ⚠ ADR-0049's stated T4 mechanism is wrong. Its conclusion is right.

ADR-0049 `:122` says T4 *"walks the right zone's direct children requiring
`indexOf(cluster) >= 0`"*. **That assertion is vacuous by construction.**
`rightZoneChildren()` (`dharma-cluster.test.tsx:92-97`) derives the zone **as
`cluster.parentElement`**, so the cluster is necessarily among its own parent's
children. `expect(cluster).toBeGreaterThanOrEqual(0)` can never fail.

A wrapper reddens T4 for a different reason: `zone` becomes the wrapper,
`identity` / `visitor` / `divider` all resolve to `-1`, and their three
`toBeGreaterThanOrEqual(0)` assertions fail.

**This is not pedantry, because the corrected mechanism has a hole the stated
one does not:** T4 is an anti-***partial***-wrapper guard. Wrap **all four**
right-zone children in one `max-mobile:hidden` div and every index resolves,
every ordering assertion passes, **T4 is green, and the entire right zone —
`VisitorCounter` included — disappears below 640px.** One line closes it, and
§4.4 item **E** proposes it.

Recorded rather than quietly worked around, per O-3: a guard that holds for a
reason other than its documented one is a guard whose next edit is unsafe.

### 4.4 The guard work

Symbol-fenced (O-8). Line numbers below are evidence of where things are today,
never the fence.

| # | Guard | Action | RED before implementation? |
|--:|---|---|:--:|
| **A** | `header-mobile::HeaderNav-RulesControl-BrandCluster-DharmaCluster-IdentityCluster-are-never-hidden` | Drop the `DharmaCluster` and `IdentityCluster` rows from `cases`; **rename the test to the three components it still asserts**. Both mechanisms (mount-line scan + `hiddenRegions`) survive untouched for those three. | no — green either way; the rename is what makes the name true |
| **B** | **NEW** `header-mobile::DharmaCluster-hides-below-640-on-its-own-root-with-NO-wrapper` | The relocated row. Six assertions, §4.5. | **yes** |
| **C** | `header-mobile::IdentityCluster.tsx-carries-no-responsive-token-at-all` → **NEW** `header-mobile::IdentityCluster-reduces-to-the-avatar-below-640-and-the-JOIN-CTA-never-hides` | **Inverted, not deleted** (the WARLI-MOUNT precedent ADR-0048:82 names). Its failure message currently quotes Phase B's superseded two-condition JOIN-CTA motive; the *rule* that the CTA never hides survives ADR-0048 and is asserted **explicitly** now rather than as a side effect of a blanket ban. Six assertions, §4.5. | **yes** |
| **D** | `header-mobile::the-secondary-controls-wrapper-…`, `…RulesControl-is-mounted-exactly-once…`, the divider pair, the `BrandCluster` block, the `VisitorCounter` pair, the whole seam describe block, `…the-header-tag-and-its-60px-row-take-ZERO-diff` | **byte-identical. Not touched.** | n/a |
| **E** | `dharma-cluster.test.tsx` `rightZoneChildren()` | ✅ **RULED IN** (Q4) — one line, `expect(zone?.getAttribute("class")).toContain("justify-self-end")`, making §4.3's vacuous assertion non-vacuous and closing the all-four-wrapper hole. Second file touched; that is the whole of the second file's diff. | no — regression guard |
| ~~**F**~~ | ~~`header-mobile::HeaderNav-and-RulesControl-carry-no-responsive-token`~~ | ⛔ **RULED OUT** (Q4). *"A new absence check on files this task does not touch — that is the general file-scope hole ADR-0049 explicitly left to Phase 1 and did not require."* **Do not write it.** Consequence carried openly in §4.4a. | n/a |

**On `_probe-*` posture (AGENTS.md §9).** B and C are TDD drivers and go red on
the current tree. E is green the day it is written and is a regression guard, not
a driver — stated so the suite's green is not overread, exactly as
`I-IDEM-NOMASK-001` states it.

### 4.4a ⚠ What F's exclusion leaves open — carried, not mitigated

Self-critique #2 observed that the chosen shape dodges G1 by construction, and
that relocating the two rows is only as good as the next person **noticing a row
should have moved**. F would have closed that for `HeaderNav` and `RulesControl`
by asserting absence outright. F is ruled out, deliberately and on a reason this
plan agrees with — it is a new guard over files this task does not touch, and
ADR-0049 `:124` left general closure optional.

⇒ **The residual, stated plainly so it is not discovered later as a surprise:**
after this task, a hide placed on `HeaderNav.tsx`'s or `RulesControl.tsx`'s own
root — or on `BrandCluster.tsx`'s root rather than its inner span — **still
passes G1 silently**, exactly as `DharmaCluster`'s would have. G1's name still
promises more than G1 reads. What this task changes is that the promise is now
true of the three components it names and no longer false about two it doesn't.

⇒ **PR-body obligation (§9 item 2):** say that self-critique #2 stands
**partially unmitigated by ruling**, and name the residual above. A limitation
recorded only in a plan's self-critique table is a limitation nobody reads.

### 4.5 The two new tests, in full

**B — `DharmaCluster`** (`DHARMA = "src/components/shell/DharmaCluster.tsx"`):

1. `read(DHARMA)` matches `/mobileResponsive\s*=\s*false/` — the polarity.
2. `nodeClasses(read(DHARMA), DHARMA, "dharma-cluster")` still contains
   `mr-3.5`, `flex`, `h-11`, `shrink-0` — **the desktop render is unchanged**,
   asserted rather than assumed.
3. That node's window contains `GATED_HIDE` — the hide is present and gated.
4. `depthWithin(read(HEADER), HEADER, "justify-self-end", "<DharmaCluster")`
   is `0` — no wrapper, under any name. This is the assertion that protects T4's
   real dependency, and it is the `VisitorCounter` row's idiom verbatim.
5. The `<DharmaCluster … />` tag in `GlobalHeader.tsx` matches
   `/mobileResponsive=\{mobileResponsive\}/` — **the exact literal**, which is
   itself the allowlist half-two lesson (`={false}`, `={SOME_FLAG}` and every
   other spelling redden).
6. No `max-mobile:` token on the mount line in `GlobalHeader.tsx` — records that
   the hide is deliberately in the component and not the header, so a later
   reader does not "helpfully" move it.

**C — `IdentityCluster`** (`IDENTITY` const already exists):

1. `read(IDENTITY)` matches `/mobileResponsive\s*=\s*false/`.
2. The pseudonym `<span>`'s `cn()` carries `GATED_HIDE`.
3. **Closed allowlist over the whole file.** The file's responsive vocabulary
   must be **exactly one** token and it must be `max-mobile:hidden`:
   `ungatedBreakpointClasses(read(IDENTITY))` is `[]`, **and** the set of
   `VARIANTS` matches is exactly `{max-mobile:hidden}` with count 1. Everything
   else reddens, *including spellings nobody has thought of* — the shape the
   file's own `(auth)` guard had to learn the hard way after five TS-legal
   reverts walked through a denylist.
4. **The JOIN branch carries no responsive token.** Read the
   `href="/sign-in"` `<Link>`'s className and assert no `VARIANTS` match. ⚠ This
   obligation is currently held *accidentally*, as a side effect of the blanket
   ban being inverted away; ADR-0048's whole point is that a phone participant
   may join, so it becomes an explicit assertion here or it stops being asserted
   at all.
5. **The avatar is not inside the hidden region.**
   `hiddenRegions(read(IDENTITY), IDENTITY)` contains no `<Avatar` — the helper
   is file-agnostic and is reused unchanged. This is what makes the test's name
   ("reduces to the avatar") true of what it does.
6. Mount tag passes `mobileResponsive={mobileResponsive}` exactly; depth-zero in
   the right zone.

⚠ **On runtime-assembled variant prefixes** (AGENTS.md §8, `docs/parked.md`
MOBILE-1 Block D). The rule exists because a guard can emit a **production
utility with no `src/` origin** — the measured case is `max-mobile:opacity-0`,
emitted by *this very file*. **It does not apply to the new assertions**, and
the reason is worth writing down rather than cargo-culting the rule: this task
authors **no new utility**. `max-mobile:hidden` already ships from six `src/`
sites and already compiles. Reusing the file's existing `HIDE_BELOW_640` /
`GATED_HIDE` constants creates no orphan, keeps the new rows parseable by the
same helpers, and avoids a two-idiom file. **Cleaning the file's existing
literals stays parked** — it touches assertions across several suites and is a
decision, not an edit.

### 4.6 The O-5 sweep — ⚠ convert to symbol fences BEFORE editing

ADR-0049 `:130` gives the sweep as a **line-fenced list**, and
**the first edit to `global-header-mobile-reflow.test.ts` invalidates every
subsequent number in it.** Seven of the nine sites are in the one file the guard
work rewrites. O-8: fence by symbol. Phase 2's first action on this list is to
re-anchor it, not to work down it.

| Site (symbol fence) | Today | What is false |
|---|---|---|
| head docblock, the `⛔⛔ THE NEGATIVE HALF IS THE LOAD-BEARING HALF` paragraph | `:95-101` | "Five elements must stay visible at EVERY width"; names all five |
| head docblock, the `⚠ IdentityCluster especially` paragraph + its `⚠⚠ AND THAT PARAGRAPH IS LEFT AS PHASE A WROTE IT` rider | `:126-142` | The Phase B two-condition JOIN-CTA motive, and a divergence note whose stated reason (keeping step with G2's message) dissolves once G2 is inverted |
| head docblock, the `RulesControl` re-attribution paragraph's citation of G1's test name | `:111` | Cites a test name this task renames |
| `cases` array — `DharmaCluster` entry | `:960-964` | Row removed |
| `cases` array — `IdentityCluster` entry | `:965-971` | Row removed |
| the loop's mount-line failure message, `"It must render at every width — ${why}"` | `:997` | Scope narrows to three components |
| G2's failure message | `:1042-1049` | Superseded Phase B motive, verbatim |
| `docs/plans/MOBILE-1-JOB-A.md`, the *"What stays visible at every width, unchanged"* paragraph | `:127-131` | Names `DharmaCluster` and `IdentityCluster`; asserts `IdentityCluster.tsx` "still carries **zero** responsive tokens" |
| `docs/plans/MOBILE-1.md`, the Component row of §7's test-plan table | `:513` | Phase B's superseded CTA-hide scenarios |
| **`src/`** — `GlobalHeader.tsx` component docblock, the `equal side tracks keep the brand cluster absolutely centred` sentence | `:26` | False below ~364px even signed out — the mark measures 11.63px right of true centre at 375px (ADR-0049 §O-5) |
| **`src/`** — `GlobalHeader.tsx` component docblock, the `The tolerance, stated so the claim survives…` paragraph | `:98-104` | 1440px figures without the width caveat; *"every control carries `shrink-0`"* is false of the brand mark; the stated failure mode (hard overflow) is not what happens |

### 4.6a ✅ RULED IN (Q3) — three OI-7 sites this task also discharges

Three further `src/` passages in this subtree are false in the **other**
direction: they quote ADR-0045's superseded *"gated, not made responsive"* as
live doctrine. They are docketed as **OI-7** (`MOBILE-1-JOB-A.md:473-498`) and
are **not** in ADR-0049's list. **Ruled into scope**, on the reasoning that
*"the prop's own docblock is being rewritten in this commit to describe two
consumers; a false sentence inside a docblock you are editing is O-5 in its
purest form."*

| # | Site (symbol fence) | Today | What is false | Status |
|--:|---|---|---|---|
| OI-7 #2 | `GlobalHeader.tsx` **component** docblock, the `MOBILE-1 Phase A amends design-language §1.7…` paragraph | `:29-35` | Quotes ADR-0045's carve-out as live and says the amendment applies *"never for the `(auth)` mount"* | ✅ **in scope** |
| OI-7 #3 | `GlobalHeader.tsx` **`mobileResponsive` prop** docblock | `:179-187` | *"`(auth)/layout.tsx` passes nothing"* — flatly false since Job A. **This is the docblock the task rewrites anyway**, to describe two new consumers. | ✅ **in scope** |
| **NEW — the eighth site** | `src/app/(public)/layout.tsx`, the comment on the `mobileResponsive` prop | `:143-146` | *"the (auth) mount deliberately omits this prop, so /sign-in, /sign-in/otp and /onboarding keep rendering the header exactly as before this task."* False since ADR-0048. | ✅ **in scope** |
| OI-7 #4 | `RulesControl.tsx` prop docblock | `:57-66` | same superseded position | ⛔ **stays parked** |
| OI-7 #5, #6 | `OnboardingDeck.tsx` component + prop docblocks | `:53-62`, `:101-112` | same | ⛔ **stays parked** |

⚠ **The eighth site is a new finding and OI-7's own inventory misses it.** That
inventory exists *because* OI-7 was once ruled on a wrong census — its own text
says a job *"discharging OQ-6a literally would have left three behind."* It has
now happened a second time, one site over. ⇒ **Phase 2 updates OI-7's table in
`MOBILE-1-JOB-A.md` to carry all eight and to mark the three discharged here** —
otherwise whoever picks up the remainder inherits the same wrong census for the
third time.

⚠ **`BrandCluster.tsx:48-50` and `VisitorCounter.tsx:39-41` take no edit**, per
OI-7 #7's own reasoning: they say only *"see `GlobalHeader`'s own prop
docblock"*, so they state no position and **self-correct the moment #3 lands**.
Checked, not assumed.

---

## 5. Failure modes

| # | Failure | Detection | Recovery |
|---|---|---|---|
| **F-1** | **The utility compiles inert** — Turbopack's cache serves a stylesheet missing the variant while the `className` is correct in source, reproducing the exact before-state. Measured twice at Phase A. | ⚠ **Not** by grepping the built sheet for `max-mobile:hidden` — see §7.3, that check is degenerate here. The runtime compile probe (AGENTS.md §9) is the real detector. | `just clean` then rebuild. A hard reload and a dev-server restart both fail to clear it. |
| **F-2** | **A signed-in phone user cannot see their stakeable balance while browsing.** | n/a — this is the ratified cost, not a defect. | **Ratified by Hrishikesh on an informed basis** (ADR-0049 §Decision Outcome), and not re-litigated here. One factual correction to its size, in support: the bet path is not blind — `BetComposer` clamps the amount input to `viewer.spendableToday` (`gating.ts:40-43`) and names the figure in the below-floor C2 sentence (`copy.ts:71-72`). It is **not** an always-visible balance. |
| **F-3** | **Mark annihilation returns silently** if the right zone ever grows above 640px — `flex-shrink: 1` inside `1fr auto 1fr`, no scrollbar, no error, the `<a>` still measurable. | **Nothing reports it.** ADR-0049 **OI-A**, ruled and carried deliberately. | This task eliminates **annihilation** below 640px (R drops to 44px ⇒ mark > 0 for all W ≥ 285px) and leaves the root cause untouched by ruling. ⚠ It does **not** eliminate shrinkage: the mark is short below 333px — see §4.1's table. Any future right-zone addition must re-measure the mark's own computed width. |
| **F-4** | **A revert leaves the call site looking like an opt-in** — `mobileResponsive={false}`, `={SOME_FLAG}`, `{...{ mobileResponsive: false }}`. Five such spellings walked through a denylist on this very file. | The exact-literal mount assertions (§4.5 B5, C6) and C3's closed allowlist. | Guard reddens. |
| **F-5** | **A later wrapper re-breaks T4's DOM order** — or the all-four wrapper that T4 cannot see (§4.3). | Depth-zero assertions (B4, C6); the all-four case only if **E** is ruled in. | Guard reddens. **Without E, the all-four case ships silently.** |
| **F-6** | **The `(auth)` mount inherits the change** — a session-bearing viewer on `/onboarding` loses their pseudonym text below 640px. | None automated; it is a consequence of a threaded prop both mounts pass. | ✅ **RULED: INHERIT** (Q2). *"Gating would give two mounts divergent behaviour and a prop that means different things by caller."* ⚠⚠ **AMENDED AT PHASE 2 — THIS ROW'S FACTUAL CLAIM WAS FALSIFIED BY THE GREP IT ORDERED, AND NAMED THE WRONG ROUTE.** It read: *"The case is UNMEASURED and is recorded as such by instruction. `(auth)/layout.tsx`'s docblock only suggests it is empty… Nobody has verified that a fully-onboarded user cannot reach `/onboarding` with a live session."* **Measured (§7.1 step 3): `/onboarding` CANNOT render signed-in, and both arms are closed.** `onboarding/page.tsx` redirects to `/sign-in` without a valid `onboarding_ref` and to `/` once `tosAcceptedAt` is set, while `session-gate.ts` throws `ONBOARDING_REQUIRED` before any `sessions` row is written whenever either field is NULL. The docblock was right. ⇒ **But the reach is NOT empty, and the plan was looking one route over: `/sign-in` and `/sign-in/otp` have NO session redirect at all**, and this layout builds a viewer from `getSession` — so a fully-onboarded viewer who navigates there renders the SIGNED-IN header and now loses their pseudonym text below 640px. **The ruling is unchanged and the diff does not widen**: `(auth)` passes neither `portfolio` nor `spendable`, so `DharmaCluster` returns `null` there at every width and the Đ hide is inert; only the pseudonym hide reaches. ⚠ The superseded text is quoted rather than deleted (O-5, and the same shape as §7.2's own self-correction) — this row is amended although the plan is closed, because a closed document carrying a falsified factual claim is worse than an amended one, and O-5 does not care that the document is closed. |
| **F-7** | Stale cache / read-after-write, DB transaction failure, auth downtime, race between concurrent users, partial write, migrate-before-serve | **structurally absent** — no write, no transaction, no fetch, no migration, no shared mutable state. Checked against the template's list rather than declared "None". | n/a |

## 6. Edge cases

- **`viewer.pseudonym === null`** (the throwaway-header edge, `IdentityCluster.tsx:51-60`) — **already avatar-only** and takes **zero diff**. Worth stating twice: the phone render of the linked chip becomes *structurally identical to a branch that already ships*, so the 44px figure is a rendered shape rather than a computed one.
- **Signed out, any width** — `DharmaCluster` returns `null` on `spendable === null`, so its new token is inert; `IdentityCluster` renders JOIN, which C4 pins as never hidden. Unchanged.
- **Signed in, `spendable === null`** (pre-grant / mid-signup) — cluster already returns `null`; the hide is a no-op. The render gate stays Balance's null, untouched (T6).
- **Exactly 640px** — desktop render returns in full. The mark renders ~31.9px shrunken across roughly 640–658px. Inside ADR-0048's already-ratified 641–860px accepted gap; **not new, not fixed, ruled**.
- **A long pseudonym** — `max-w-40 truncate` is what handles it above 640px and is untouched; below 640px the span is `display:none`, so truncation is moot.
- **The pseudonym's `InfoTip`** — hiding the trigger removes the glossary tip for `pseudonym` on phones. Accepted under the same relocation argument as the figures: the profile the chip links to is where that vocabulary lives. `Slot`-merged `asChild` adds no DOM node, so the class lands on the span and nothing else moves.
- **Flex `gap-2` on the chip** — a `display:none` child contributes no gap, which is why the chip measures 44px and not 52px.
- **`DharmaCluster`'s `mr-3.5`** — goes with the node. No 14px ghost margin.

## 7. Test plan

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| **Unit — source scan** (`tests/unit/shell/global-header-mobile-reflow.test.ts`) | §4.4 **A** (rename + two rows removed), **B** (six assertions, RED first), **C** (six assertions, RED first). §4.4 **D** untouched, confirmed by diff. ⛔ **F is ruled out — do not write it** (§4.4a). | None — no thesis invariant touched (§1) |
| **Unit — render** (`tests/unit/shell/dharma-cluster.test.tsx`, `identity-cluster-link.test.tsx`) | **Expected to stay green and asserted to, not assumed.** Both render without the prop, so the `= false` default keeps the class strings identical; jsdom resolves no Tailwind regardless. Plus **E** — the one-line `justify-self-end` pin in `rightZoneChildren()`, which is the whole of this file's diff. | None |
| **Unit — adjacent** | Two suites **do** read the changed files and were checked by inspection, not assumed: `tests/unit/design/avatar-ring-token.test.ts` opens `IdentityCluster.tsx` **by name** (asserts absence of `after:[border:…]`, `mix-blend`, `avatarRing` — none of which this task adds), and `no-raw-dharma-render.test.ts` reaches `DharmaCluster.tsx` through a **recursive `src/` sweep** (asserts no raw Đ render bypasses `formatDharma` — this task adds no Đ render). ⚠ `tests/unit/ui/avatar-sizes.test.tsx` does **not** read either file — it renders `Avatar` directly; its `IdentityCluster.tsx:48,62` references are stale comments (the mounts are at `:54` and `:68` today) and are **not** this task's to fix. Run all three to confirm rather than to argue. | None |
| **Integration** (`tests/integration/`) | **None.** No service-layer function is opened. `header-balance` and `header-portfolio` cover the reads, which are unchanged. | None |
| **E2E** (`tests/e2e/`) | **Does not exist** — no Playwright in this repo (AGENTS.md §1, §9). Not a gap this task creates. | None |
| **Browser measurement** (§7.2) | The only layer that can see any of this. jsdom performs no layout. | None |

**Full-suite gate:** `ZUGZWANG_ENV=preview just verify`, plus
`pnpm exec vitest run tests/unit/` — **baseline measured 2026-09-08 before any
edit: `tests/unit/shell/` + `tests/unit/design/` = 34 files, 287 tests, all
green.** Not critical-path, so `pnpm test:invariants` / `test:integration` are
not required by §5.7; run them anyway if the diff grows past the **7 `src/`
sites** §7.1 names, which would mean the plan was wrong.

### 7.1 Sequencing (tests first, §5.6 posture)

**Final scope after the rulings: 7 `src/` sites — 4 behavioural
(`GlobalHeader.tsx` two mounts, `DharmaCluster.tsx`, `IdentityCluster.tsx`) and
3 docblock (`GlobalHeader.tsx` ×2, `(public)/layout.tsx`) — plus 2 test files
(`global-header-mobile-reflow.test.ts`, and one line in
`dharma-cluster.test.tsx`).**

0. ⛔ **First, before anything.** `git fetch origin` and ask `origin/main` a
   **content** question — `git rev-list --count HEAD..origin/main`,
   `gh pr list --state merged --head <branch>`, and the tree-hash receipt.
   Self-critique #11: Phase 1 was written on an already-merged branch and the
   check that caught it ran at the *end* by luck. It belongs here.
1. **Measure the signed-out 375px baseline** on the rig Phase 2 will use, before
   any edit. One call. It is what makes F-1 and §4.1's arithmetic falsifiable
   later, and Phase 1 deliberately did not take it (self-critique #10).
2. **Re-anchor §4.6's O-5 list to symbol fences.** Not "work down it" — the
   first edit invalidates every subsequent line number in it.
3. If Q2's reach matters to anyone: **one `grep` of the onboarding gate** to
   settle whether a session-bearing viewer can reach `/onboarding`
   (self-critique #3). Owed *because* Q2 ruled INHERIT.
4. Write **B** and **C**. Run. **Both must be RED**, and the failure messages
   must name the missing prop and the missing token — a red for the wrong reason
   is not a driver.
5. Implement the 4 behavioural `src/` edits.
6. B and C green; **A**'s rename; **E**'s one line; **D confirmed
   byte-identical** by `git diff` on the untouched blocks, not by reading them.
7. The O-5 sweep (§4.6) and the three Q3 docblocks (§4.6a).
8. **Update OI-7's table in `MOBILE-1-JOB-A.md`** to carry all eight sites and
   mark the three discharged — §4.6a. Third time that census would otherwise be
   inherited wrong.
9. `ZUGZWANG_ENV=preview just verify` + full unit suite.
10. §5.10 pre-PR self-audit, item by item against this plan.
11. Verification route per §7.2/§7.4, then the PR body per §9.

### 7.2 Browser measurement — ⚠ what can and cannot be observed

⚠⚠ **THIS SECTION OPENED WITH ITS OWN SUPERSEDED POSITION AND THE CORRECTION IS
KEPT RATHER THAN SMOOTHED AWAY.** It read: *"Measured before / measured after is
NOT available for the signed-in header, and no amount of care in Phase 2 changes
that."* That was written while all three of ADR-0049's routes were closed and
before Q1 ruled. **Q1 ruled (b), which produces exactly the observation that
sentence said was unavailable** — so the sentence became false in the same
document that ruled it false, four paragraphs above the ruling. Left visible
because it is O-5's exact shape occurring *inside the plan that spends §4.6
warning about it*, and because the failure is instructive: **the stale sentence
was the confident one.** A reader skimming would have taken the bolded absolute
and never reached the ruling.

**The true position:** no signed-in observation of this header exists **yet**,
every magnitude in this plan is therefore constructed, and **Q1's ruling is what
changes that** — see the route table and the ruling below.

**What this session established, going beyond the ADR's three closed paths:**
the ADR reads the closed OTP path as a *preview* condition. It is not.
**There is no Turnstile widget anywhere in the product** —
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` has zero consumers in `src/`,
`sign-in/page.tsx:177` is a live `TODO`, and both client call sites send the
hardcoded string `"placeholder-token"` (confirmed in a live local DOM: 17-char
hidden input, no Turnstile iframe, `window.turnstile === undefined`).
`verifyTurnstile` fails closed on a missing secret and otherwise siteverifies
that constant. ⇒ **Local sign-in is reachable if and only if
`TURNSTILE_SECRET_KEY` is Cloudflare's always-passes testing key** — one
environment value this session may not read (AGENTS.md §11). Recorded in full in
`claude-progress.md` and spun out as its own task; **out of scope here** (auth
is §1 area 4).

**✅ RULED (Q1): (b), with (a) attempted first.** In order — **try (a)** if the
operator confirms the Turnstile testing key is present, because it is cheaper and
needs no O-4 exception; **otherwise (b)**, push to `staging` pre-merge; **fall
back to (d), "measured-before / unmeasured-after" in those words, only if both
fail.** (c) is not a route on its own — it is what (d) is made of.

⚠ **(b) puts unmerged work on `staging`, against O-4, and the exception is
ACCEPTED ON THE RECORD rather than overlooked.** The founder's reasoning,
carried verbatim so a later reader does not re-derive it: *"staging is not
production, the change is CSS-only, and the alternative is shipping the header
unverified in exactly the state that caused this defect."*

⇒ **Two obligations attach to (b) and neither is optional:**

1. **Push `staging` BEFORE the branch** — O-10. Vercel dedups by SHA across
   refs, so branch-first makes it skip the staging deployment entirely and the
   domain serves the old SHA indefinitely **while Staging Migrate reports
   green**. There is no alias or redeploy escape hatch; the ordering *is* the
   control.
2. **Restore `staging` to `main` after the check**, so O-4's "staging reflects
   `main`" is true again the moment the exception has been spent. An exception
   that is not closed becomes the new normal.

⚠ And confirm `/api/health`'s `canary` equals the pushed SHA **in the same call
as the geometry** — the alias serves the previous build until the new one is
Ready, so one trusting read returns a healthy response describing the old tree.

**The four routes, for the record:**

| | Route | Gives | Costs |
|---|---|---|---|
| **(a)** | **Local**, if the operator confirms the testing key is in `.env.local`. `preview_start` `zugzwang-prod-staging-db` (a production build against the staging DB — the rig Job B used, already in `.claude/launch.json`), sign in, pin a 375px in-page frame. | A **genuine signed-in observation**, before/after on one rig | One local signup consuming a staging `identity_pool` row + an `initial_grant` |
| **(b)** | **`staging.zugzwangworld.com`** — it *is* the `BETTER_AUTH_URL`, so origin and `BETTER_AUTH_URL` both pass and the operator signs in on a real phone over real HTTPS. Push `staging` **before** the branch (O-10: Vercel dedups by SHA). | Observation **and** ADR-0049 verification 3 in one pass | Staging temporarily carries unmerged work; O-4 says staging reflects `main`, so it must be restored |
| **(c)** | **Constructed injection** — inject the post-change class strings into the live signed-out header, the technique that produced every figure in ADR-0049. | A constructed after-state | It is construction, not observation, and must be labelled so |
| **(d)** | **Ship measured-before / unmeasured-after, in those words.** | Honesty | Verification requirements 1 and 3 go undischarged and are recorded as such |

**Under the ruling, requirement 5 is expected to be DISCHARGED rather than
answered with its own escape hatch** — (a) or (b) both produce a genuine
signed-in observation. ⚠ **But the escape hatch stays written down, because it
is only owed if both routes fail**, and the sentence must then be used verbatim
rather than paraphrased into something softer: _this task ships measured-before
and unmeasured-after._ Requirement 1 (assert the mark's own computed width)
rides the same route — the mark's post-change width below 640px is a function of
the signed-in right zone, so whichever route delivers the after-state delivers
both, and if neither does, both are undischarged and are named as such.

⚠ **Requirement 1 has a second half the ruling does not remove.** §4.1's table
predicts a **shrunken** mark between 285px and 333px. Every route above measures
at 375px, where the prediction is a full 48px — so **a 375px-only measurement
cannot falsify the interesting half of the model.** If a measurement happens,
take the mark's computed width at **375px and at 320px**; two numbers, one extra
frame resize, and the second is the one that can actually be wrong.

⚠ **The document-level overflow check is worthless here and must not be run as
if it were evidence.** ADR-0049 verification 1: the mark is annihilated across
the entire 292–364px band with **0px** reported overflow. The assertion is on the
mark's own box — `mark.getBoundingClientRect().width` — at both widths:

| frame | expected | what a miss means |
|---:|---:|---|
| 375 | **48.00** | the change did not take, or `R` is larger than 44px |
| 320 | **34.87** | ⚠ **the model is wrong**, and `L` (157.13px) or the ADR's 585-vs-608 inconsistency is the reason |

⛔ **Do not "correct" a 320px reading of 34.87 to a defect.** It is the predicted
value and the whole point of taking it — a 48.00 there would mean the model is
wrong in the *reassuring* direction, which is harder to notice and worse.

⚠ Every AGENTS.md §9 browser-measurement precondition applies to whichever route
is taken and none is optional: complete the React 19 Suspense boundary by hand
(match **both** `<!--$?-->` **and** `<!--$~-->`) and assert `stillHidden === 0`
plus a non-zero box before trusting a number; pin the frame in-page with a
`throw` unless `innerWidth === 1440`/`375`; `await document.fonts.ready`; kill
animation and transition; assert `/api/health` `canary` in the same call as the
geometry; snapshot every `getComputedStyle` value to a string at the instant it
is valid.

### 7.3 ✅ RULED — the built-stylesheet check is substituted, not skipped

ADR-0049 verification 2 requires checking the built sheet by class name at
`.next/static/chunks/*.css` after `just clean`. **Performing it here would prove
nothing, and would look like it had.** Two independent reasons:

1. **No new utility is authored.** `max-mobile:hidden` already ships from
   `GlobalHeader.tsx` ×2, `BrandCluster.tsx`, `VisitorCounter.tsx`,
   `HeroPanels.tsx` and `DiscoveryCarousel.tsx`, and demonstrably compiles —
   Phase A's 394px → 0px depended on it.
2. **The grep is self-fulfilling.** Tailwind v4 scans `tests/`, and
   `global-header-mobile-reflow.test.ts` carries the literal in
   `HIDE_BELOW_640`. That file is the *named source* of `docs/parked.md`'s
   measured `max-mobile:opacity-0` orphan. The token would be in the sheet with
   or without this change.

⇒ **✅ SUBSTITUTION APPROVED** — *"The built-stylesheet grep would prove nothing
here and would look like it had."* Run AGENTS.md §9's **runtime compile probe**
instead: inject `flex max-mobile:flex-col`, read
`getComputedStyle(...).flexDirection`; `"column"` = compiled, `"row"` = **not**
compiled. That is what the built-sheet grep was always a proxy for, and unlike
the grep **no test file can fake it**.

⛔ **Two conditions on the substitution, both explicit in the ruling:**

1. **State the substitution and its reasoning in the PR body** (§9 item 1).
   Never perform it silently — a ratified verification requirement being
   replaced is a thing a reviewer must be able to see and disagree with.
2. **Never report the grep as passed.** Not "checked", not "N/A", not omitted
   and left to look discharged. If the built sheet is inspected at all, it is
   inspected for something else and said so.

⚠ If a grep is nonetheless run for any reason, the path is
`.next/static/chunks/*.css` — **never** `static/css/`, which does not exist in
this tree and whose zsh glob never expands, so `grep` is never invoked and the
result is **indistinguishable from a clean pass** (O-13). Confirm the glob
returns a non-empty list before believing anything downstream of it.

### 7.4 The real-phone procedure — the written one does not work

ADR-0049 verification 3 requires a real-phone check; **the LAN-IP procedure
written into both MOBILE-1 plans cannot work.** `crypto.randomUUID` is
secure-context-only and `http://<LAN-IP>:3000` is not a secure context —
origin-dependent, not device-dependent (`claude-progress.md`, 2026-09-08).

**✅ RULED — the working procedure is route (b), doing double duty.**
`staging.zugzwangworld.com` is HTTPS (secure context ⇒ `crypto.randomUUID`
works), it is the configured `BETTER_AUTH_URL` (⇒ origin check and Better Auth
baseURL both pass), and it is a phone's real browser on a real network. It needs
no `allowedDevOrigins`, no LAN IP and no dev server. It discharges verification 3
and supplies the §7.2 after-state in one pass.

**Steps, in this order** (the order is the control, not a preference):

1. Push `staging` **first** — O-10.
2. Wait for the Vercel deploy, then assert `/api/health` `canary` equals the
   pushed SHA. Trust the health gauge, not a migrate exit code.
3. On a real phone: open a `(public)` route signed in, **and turn it sideways** —
   the rotation check is five seconds and caught the Phase B cache failure when
   nothing automated could.
4. Take the mark's computed width at 375px **and** 320px (§7.2).
5. **Restore `staging` to `main`.**

⚠ **It is still gated on the Turnstile question.** If the staging secret is a
real one, the operator cannot sign in there either and the procedure degrades to
a **signed-out** rotation check — worth doing, and **not what verification 3
asks for.** In that case the answer to Q1 falls through to **(d)** and the
literal sentence is owed. **Say which of the three actually happened**; do not
report a signed-out check in language that reads like a signed-in one.

## 8. Out of scope

- **Pinning the brand mark.** `shrink-0` on the mark is **ruled out** — founder chose the shrunken logo over a scrollbar in the 640–658px band (ADR-0049 §Residual). Zero diff. **OI-A carries the surviving root cause** and is not closed here.
- **The 641–860px band.** Ratified accepted gap (ADR-0048).
- **`/admin/*`.** Structurally separate, desktop-operator-only (ADR-0010).
- **Skipping the two Đ reads on phones.** A server component cannot know the viewport; the read must happen either way. Not an optimisation, a category error.
- **`design-language.md` §1 item 7** (`:44`, `:112`, `:260` — still flat "desktop-only, no responsive variants"). ADR-0048 §Spec impact rules it must be **redrafted, not ratified as written**; that is a founder surface, deferred as OI-3. ⚠ This task makes it *more* false; the debt deepens and is not discharged.
- **OI-7's remaining docblocks — `RulesControl.tsx` and `OnboardingDeck.tsx` ×2.** ⚠ **Partially in scope now:** Q3 ruled the two in `GlobalHeader.tsx` and the eighth site in `(public)/layout.tsx` **into** the commit (§4.6a). These three stay parked under OI-7.
- **F — a general absence check on `HeaderNav.tsx` / `RulesControl.tsx`.** Ruled out by Q4. The residual it would have closed is stated in §4.4a and goes in the PR body.
- **`docs/parked.md` MOBILE-1 Block D** — cleaning the existing guard files' class literals, and enumerating the built-sheet tokens with no `src/` origin. Both explicitly "a decision rather than an edit"; §4.5 explains why the new rows do not add to the debt.
- **The Turnstile finding.** Recorded in `claude-progress.md`, spun out as its own task. §1 area 4, critical path, full ritual, ask-first dependency. **Not touched here.**
- **ADR-0048 path (ii)** — deleting the `mobileResponsive` prop. It touches five files and ~8 assertions including three `= false` default pins, and this task **adds two more consumers**, making (ii) larger rather than smaller. Recorded so the growth is deliberate.
- **Any spec amendment.** SPEC.1 2.0.0 §17–§19 and §21–§23 are intentionally absent (D-29) and it carries one incidental header mention; SPEC.2 is technical/schema and nothing schema-shaped moves. **No spec version bump is owed** — checked, not assumed.

---

## Open questions — ✅ ALL RULED 2026-09-09

**None open.** Kept as a record rather than deleted: a plan that shows only its
settled state hides which way the decision could have gone, and three of these
four were live enough that the plan was written to execute at either scope.

| | Question | **Ruling** | Reasoning, as given |
|---|---|---|---|
| **Q1** | After-state verification | **(b) push to `staging` pre-merge — try (a) first if the Turnstile testing key is present; fall back to (d) only if both fail** | *"Staging IS the `BETTER_AUTH_URL`, so a real phone over HTTPS gives a genuine signed-in after-state and discharges verification 3 in the same pass."* The **O-4 exception is accepted**: *"staging is not production, the change is CSS-only, and the alternative is shipping the header unverified in exactly the state that caused this defect."* → §7.2, §7.4 |
| **Q2** | `(auth)` reach | **INHERIT — do not gate to `(public)`** | *"Gating would give two mounts divergent behaviour and a prop that means different things by caller."* The unmeasured case is recorded by instruction. → §5 F-6 |
| **Q3** | OI-7 docblocks | **Take the two in `GlobalHeader.tsx` AND the eighth site in `(public)/layout.tsx`. Leave `RulesControl` / `OnboardingDeck` parked.** | *"A false sentence inside a docblock you are editing is O-5 in its purest form."* → §4.6a |
| **Q4** | G1 file-scope hole | **E only. NOT F.** | E closes a real hole this plan found; *"F is a new absence check on files this task does not touch — that is the general file-scope hole ADR-0049 explicitly left to Phase 1 and did not require."* → §4.4, §4.4a |
| **§1.4** | Built-stylesheet grep | **SUBSTITUTION APPROVED** | *"It would prove nothing here and would look like it had."* State it in the PR body; **never report the grep as passed.** → §7.3 |
| **§1.1** | ADR-0049's T4 mechanism | **Correction accepted; carry this plan's version** | *"I described it wrongly and the corrected mechanism has a hole the stated one does not."* → §4.3 |
| **Q5** | Turnstile | **Out of scope, escalated separately. Leave it there.** | → `claude-progress.md`, 2026-09-08; own task |

## 9. PR-body obligations

Four things go in the PR body. Each exists because it is a claim a reviewer must
be able to see and disagree with, and none of them survives in the diff.

1. **The §7.3 substitution and its reasoning** — the built-stylesheet grep was
   replaced by the runtime compile probe, because no new utility is authored and
   the token is in the sheet from the test file regardless. ⛔ **Never report the
   grep as passed, checked, or N/A.**
2. **Self-critique #2 stands partially unmitigated by ruling** — F was ruled out,
   so a hide on `HeaderNav`'s, `RulesControl`'s or `BrandCluster`'s own root
   still passes G1 silently. §4.4a states the residual; the PR body repeats it.
3. **Which verification route actually happened** — (a), (b), or (d). If the
   Turnstile secret closes sign-in on staging too, the check degrades to
   **signed-out** and the literal sentence *"this task ships measured-before and
   unmeasured-after"* is owed. **Do not report a signed-out check in language
   that reads like a signed-in one.**
4. **The ADR-number re-read** — ADR-0049 `:13` requires it be re-read against the
   merged head before its PR lands and that the PR body say it was. Discharged
   at finalisation: ceiling `0049`, next free `0050`, **this task mints no ADR**.

⚠ **Not a PR-body item, an ordering one:** if route (b) is taken, **push
`staging` before the branch** (O-10) and **restore `staging` to `main`
afterwards** (O-4). See §7.4.

## ADRs needed

**None.** ADR-0049 is the architectural record and is on `main` as PR #510
(`b19bb43`). Nothing in §4 sets a pattern that document does not already
govern — the own-root gated hide is `VisitorCounter`'s shipped shape, reused.

---

## Self-critique (after Phase 1 self-review)

| # | Severity | Finding | Resolution |
|--:|---|---|---|
| 1 | **high** | **The plan cannot verify its own central claim.** Every figure in §4.1 — the 44px chip, the 86px slack, the eliminated mark annihilation — is **arithmetic over ADR-0049's constructed magnitudes**, not a measurement. The ADR itself flags that two prior figures (585px vs 608px) disagree by 71px of right zone and which is wrong is NOT ESTABLISHED. If the 585px reading is the right one, the left-zone constant may be wrong and my slack figure with it. | **Accepted and stated.** §7.2 routes it to Q1 and offers the literal measured-before/unmeasured-after sentence. ⚠ **It is not fully mitigated**, and a reader should not take §4.1's table as measured. Marked in §7.2. |
| 2 | **high** | **§4.2 admits the chosen shape dodges G1 entirely — the guard stays green while both behaviours reverse.** The mitigation is that I *relocate* the rows. But **a relocated row is only as good as somebody noticing it should have moved.** Nothing structural forces the next person who hides a header child to relocate a row rather than let G1 pass. | ⚠ **STANDS PARTIALLY UNMITIGATED, BY RULING.** Q4 took **E** (closing the all-four-wrapper hole, which is a different hole) and **rejected F**, which was the part addressing *this* finding. The rejection is sound — F is a new guard over files this task does not touch — but it means the residual survives: a hide on `HeaderNav`'s, `RulesControl`'s or `BrandCluster`'s own root still passes G1 silently. **Stated in §4.4a and carried into the PR body (§9 item 2)**, per the ruling's own instruction, rather than left in a self-critique table nobody reads. |
| 3 | **medium** | **The `(auth)` reach (Q2) is reasoned from a docblock, not measured.** I assert `/onboarding` renders signed-out because that layout's comment says so. I did not verify the redirect. If a fully-onboarded user *can* reach `/onboarding` with a session, the reach is non-empty and the founder ruled on a case I mis-sized. | **Q2 ruled INHERIT with the uncertainty explicitly preserved** — the ruling itself instructs that the unmeasured case be recorded and that the docblock only *suggests* emptiness. §5 F-6 carries it in those terms. ⚠ **The `grep` of the onboarding gate is now OWED at Phase 2 start**, precisely because the ruling went the way that makes the case reachable rather than moot. |
| 4 | **medium** | **§4.6 asserts that seven of nine O-5 sites are in one file and therefore that the line list self-invalidates — but I have not proven the ADR's ranges are right today.** I spot-checked four and found them accurate; I extrapolated to the rest. That is exactly the O-13 shape one register over: partial verification presented as coverage. | **Corrected in place** — §4.6's table gives **my own measured line numbers as evidence** and fences by symbol, so the ADR's ranges are never load-bearing. |
| 5 | **medium** | **The scope grew.** The kickoff scoped four `src/` files and two guard inversions. This plan proposed a **second test file** (E), a **new guard** (F), and **three more docblocks** (Q3). Every one was justified, and "every one is justified" is what scope creep sounds like from the inside (§5.4). | **Routing them as questions was the right call and it worked**: of the three, **two were taken and one was refused.** F is out. Final scope: **7 `src/` sites** (4 behavioural + 3 docblock) and **2 test files**. ⚠ The refusal is the evidence the routing was not theatre — had all three been waved through, this row would read as a rubber stamp. |
| 6 | **low** | **§7.3 argues a verification requirement should not be performed.** An ADR ratified by the founder says "verify the built stylesheet by class name"; I proposed a substitution. Even correct, this is the sort of reasoning that ends with a check quietly dropped and the ADR's requirement counted as met. | **Approved, with the failure mode this row names written into the ruling itself**: the substitution goes in the PR body, and the grep is **never** reported as passed, checked, or N/A. The replacement is *stronger* — a test file can fake the grep and cannot fake the runtime probe. §7.3, §9 item 1. |
| 11 | **high** | **Phase 1 ran on a branch that had already been squash-merged, and every check I ran at kickoff missed it.** `git status` and `git log` both looked healthy; PR #510 had merged the day before. I only caught it at finalisation because I went to discharge ADR-0049's number obligation and asked `origin/main` a **content** question. Had the founder not required that obligation, I would have committed Phase 1 onto a dead branch — **precisely what MOBILE-1 Phase A did for an entire phase**, and what AGENTS.md §10 exists to prevent. | **Caught and corrected before the commit** — fresh branch from `origin/main` at `b19bb43`, tree-hash receipt recorded in the header block. ⚠ **The lesson is about timing, not about the check:** I ran the right command at the end of Phase 1 because a *different* obligation happened to require it. It belongs at the **start** of every session, before a line is planned. Nothing in the kickoff or in this plan made it a step, and this row is the only thing that now does. |
| 7 | **low** | **The Turnstile finding is disproportionate to its container.** It is by far the most consequential thing this session found and it sits in a bullet inside §8 of a header-reflow plan. | Recorded at full length in `claude-progress.md` per §5.4 and spun out as its own task; §7.2 carries the part that bears on *this* plan and no more. |
| 8 | **high** | **§4.1 shipped a wrong slack figure in the first draft, and it was wrong in the reassuring direction** — "289px in a 375px viewport, ~86px of slack", conflating the 375px viewport with the 327px content box and double-counting the padding. The correct figure is **~42px**, which is ADR-0049's own second row. ⚠ **A plan whose §7.2 warns that its numbers are constructed still has to get the arithmetic right on the ones it derives**, and the error survived into a document that was already telling the reader to distrust its magnitudes — which is how a wrong number gets quoted forward as if the caveat covered it. | **Corrected**, and the correction carried a second finding worth more than itself: the same recomputation surfaced that **shrinkage persists 285–333px** while annihilation does not, which no source had stated. Both now in §4.1 and F-3. |
| 9 | **medium** | **§7's adjacent-suite row claimed three tests "read both changed files". One of them does not.** `avatar-sizes.test.tsx` renders `Avatar` directly and only *mentions* `IdentityCluster.tsx` in a stale comment. Asserting coverage that is not there is the exact defect `docs/parked.md`'s Block D row was opened for, one register over. | **Corrected in §7** with what each suite actually reads and what it actually asserts. The stale line references are named and explicitly left alone. |
| 10 | **low** | **I did not measure the current signed-out 375px baseline on a rig, though I had one running.** I started the dev server, confirmed it served, and stopped it. A before-baseline on the same rig Phase 2 will use costs one call and would make F-1 and the §4.1 arithmetic checkable. | **Deliberate.** The kickoff forbids production code and a baseline is Phase 2's first act, not Phase 1's. Recorded so the omission is not read as an oversight; §7.1 step 2 is where it belongs. |

| 12 | **medium** | **§7.2 opened with its own superseded position, inserted by the finalisation pass itself.** *"Measured before/after is NOT available for the signed-in header, and no amount of care in Phase 2 changes that"* was true when drafted and was made false by Q1's ruling — which I then wrote in **four paragraphs below it**, leaving a document that contradicted itself top-to-bottom. ⚠ **This is O-5's exact shape occurring inside the plan whose §4.6 is a lecture about O-5**, and the instructive part is that **the stale sentence was the confident one**: bolded, absolute, and positioned where a skimming reader stops. | **Corrected in §7.2 with the superseded text quoted rather than deleted**, so the failure stays legible. ⚠ **The general lesson is not "check §7.2":** applying a ruling means re-reading every sentence the ruling touches, including ones written minutes earlier in the same session. A finalisation pass edits *around* prose it wrote and trusts it, which is the same reflex that leaves a false docblock beside a changed line. |

*Checked: invariant coverage, scope discipline, test assertions, edge-case
enumeration, verification honesty, cross-reference consistency after the
rulings, and whether any claim in this plan is asserted where it should be
measured.*

---

## References

- `CLAUDE.md` — §1 (not critical path), §5.1/5.3/5.4/5.6/5.7/5.10/5.12, §8 O-3 · O-5 · O-8 · O-13 · O-15
- `AGENTS.md` — §8 (the `--breakpoint-mobile` three rules), §9 (browser measurement; `_probe-*` posture; no jest-dom), §10 (squash SHA, content questions), §11
- [ADR-0049](../adr/0049-signed-in-header-at-phone-width.md) — the ruling this executes
- [ADR-0048](../adr/0048-phone-responsive-auth-surfaces-and-the-focus-mode-row.md) — both mounts opt in; the WARLI-MOUNT invert-don't-delete precedent; the 641–860px accepted gap
- ADR-0045 — the 640px token and the override-never-replace discipline
- [`tests/unit/shell/global-header-mobile-reflow.test.ts`](../../tests/unit/shell/global-header-mobile-reflow.test.ts) — G1, G2, the seam
- [`tests/unit/shell/dharma-cluster.test.tsx`](../../tests/unit/shell/dharma-cluster.test.tsx) — T4/T5/T6
- [`docs/plans/MOBILE-1-JOB-A.md`](MOBILE-1-JOB-A.md) — OI-7's inventory (and its eighth site, found here)
- [`docs/parked.md`](../parked.md) — MOBILE-1 Block D
- [`claude-progress.md`](../../claude-progress.md) — the Turnstile finding, 2026-09-08
