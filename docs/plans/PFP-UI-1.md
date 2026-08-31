# PFP-UI-1 — the avatar is a circle, because the asset already is

> **Status:** PLAN ONLY. Nothing in `src/` is touched by this document.
> **Authored against:** `origin/main` @ `5463f61aa34cd059ef8c441019cb83251be352b9`, in a clean detached worktree.
> **Measurement of record — TWO files, and which one a number comes from matters:**
> · `zz_PFP-UI-1_2026-08-26T1704.md` — the **24-asset** stratified sample, the crop/gap arithmetic, and the live computed read of the profile hero.
> · `zz_PFP-CENSUS_2026-08-26T1748.md` — the **full 1,079-object** corner-chroma census, which supersedes every population-rate claim the 24 could only estimate.
> Every number below is from one of those two; none is derived from a mockup or a spec.
> **Predecessor:** PFP-RECON-1 (`zz_PFP-RECON-1_2026-08-26T1635.md`), which established the eight mounts and the two tokens.
>
> **AMENDED 2026-08-26 (web review).** Five changes, each marked in place: §2.2 + §3.3 close the edit surface (mount 7 → wrapper, mount 8 → hand-rolled; **`ui/avatar.tsx` NOT touched**, so §9's cascade is unchanged); §4.2 **withdraws** this plan's claim to have discovered the `lg`/`xl` seam; §5.2/§5.3/`PD-PFP-08`/`PD-PFP-09`/`OD-4` are restated on the census; §6 row 6's direction is **reversed** (§6.2); `PD-PFP-10` and §10.1 are new. Change log: `zz_PFP-UI-1_AMEND_2026-08-26T1819.md`.
>
> **AMENDED AGAIN 2026-08-26 (A-5).** ⛔ **The wrapper §3.3.1 introduces BREAKS the §4.3 sizing chain — measured, `256 × 256` instead of `188 × 188`, overflowing the band by 68 px.** §3.3.2 is new and carries the measurement, the decision (**Fix A**), and the exact class strings for both elements; §2.1 mount 7 and §4.3 are corrected at their own sites; §9 gains the RED assertion **and what it cannot prove**; §10.1 gains the ≥1280 square-box row. ⚠ Two candidate utilities — **`xl:self-stretch`** and **`xl:size-full`** — were measured **ABSENT from the compiled stylesheet**. Change log: `zz_PFP-UI-1_A5_2026-08-26T1834.md`. Production read: `zz_PFP-PRD_2026-08-26T1834.md` — **prod `identity_pool` is EMPTY (0 rows, 0 users) and no PFP object is publicly readable in `zugzwang-pfp/v1/`**, which confirms §7.1's premise that the manifest filter is a filter on a file that does not exist yet.

---

## 0 · The case determination, and the term this plan had to define

### 0.1 ⚠ `Case A` and `Case B` are not defined anywhere on `main`

`grep -rn "Case A\b" docs/` and `grep -rn "Case B\b" docs/` both return **zero
hits** at `5463f61`. The kickoff uses the terms without defining them. Rather than
guess silently, this plan states the definition it is using; **if the founder
meant something else, this section is the one to re-rule and everything below
re-derives from it.**

- **Case A** — the assets are **frame-filling square art**: the identity colour
  runs edge to edge, the subject is inset from the frame, and a circular crop
  removes only background. In Case A the circle pass is a pure CSS change and it
  fully solves the presentation.
- **Case B** — the assets are **already circular**: the art is a disc with
  padding around it, and that disc's registration (centre, radius) **varies per
  asset**. In Case B a circular CSS crop cannot land exactly on the baked disc,
  the residual lives **in the asset**, and any CSS transform that hides it is a
  **compensation**.

### 0.2 ⛔ PART 1 LANDS IN CASE B

Three independent measurements, each sufficient on its own:

| Case-B criterion | Measured, n = 24 |
|---|---|
| The art is a disc with padding, not frame-filling | **24 / 24.** Median **24.83%** of the square is padding (min 11.20%, max 57.57%) |
| The disc centre varies per asset | Fitted-centre offset **0.00 – 8.50 px**, median **4.25 px** — and **rightward in 24 / 24** (`dx ≥ 0` everywhere, 21 strictly positive, **none negative**) |
| The disc radius varies per asset | Fitted radius **97.2 – 128.0**, median **124.1** — a **30.8 px spread** on a 256 px canvas |

✅ **All three were re-tested against the full 1,079 and all three hold or
strengthen** (census §B.7): the rightward bias goes 24 / 24 → **1,075 / 1,079**
(sign test **z = 29.0**, zero negatives among the 840 NORMAL), and the radius
spread goes 30.8 px → **65.2 px** (62.8 – 128.0, median 121.8). **The sample did
not overstate the case; it understated the spread.**

**No single CSS transform can normalise 24 different registrations.** A
`scale()`/`translate()` tuned to close `red-alpaca`'s 9.7 px gap over-crops
`indigo-cat` (gap 0.0) and does not touch `indigo-mouse` (gap 39.3).

### 0.3 ⛔ THIS PLAN PROPOSES NO CSS COMPENSATION

There is no `scale`, no `translate`, no negative margin, no `object-position`
nudge, no per-asset override, and no ring sized to cover a crescent, anywhere in
this document. **§5 states the boundary, names the residual, routes it out of
this repo, and stops there.**

### 0.4 ⚠ The one ambiguity this plan surfaces rather than resolves

*"if Case B, it must NOT propose a CSS compensation — say so and stop"* has two
readings:

- **Narrow** — stop at the compensation; the shape change itself proceeds.
- **Wide** — Case B gates the whole pass; nothing ships until the assets are
  re-baked.

**This plan is written to the NARROW reading**, because the shape change is not a
compensation: it aligns the mount to the shape the asset already has, and it is
independently worth **4.1×** on visible padding (24.83% → 6.04%). **The wide
reading is recorded as `OD-1` and is the founder's to rule before execute.**

---

## 1 · ⚠ Pushback before scope: the kickoff names the right direction and the wrong three mounts to stop at

The kickoff asks to convert mounts **6, 7 and 8** to a circle. **All three are
currently FAITHFUL to their ratified mockups. Four of the five existing circles
are not.**

| Mount | Built shape | Its mockup class | Mockup says | Faithful? |
|---|---|---|---|---|
| 1, 2 header chip | circle | `.navav` — `DESIGN_W2_1_first-login-journey_mockup-v0_1.html:98` | 26px, **`--imgr`** | ❌ diverges |
| 3 Discovery head | circle | `.avatar` — `surface_discovery_v1_0.html:84` | 16px, **`border-radius:50%`** | ✅ |
| 4 debate arg row | circle | `.argprofile .avatar` — `surface_d5_v1_0.html:437` + `:576` | 18px, **`--imgr`** | ❌ diverges |
| 5 profile arg row | circle | `.rchead .avatar` — `surface_profile_v1_0.html:181` + `:322` | 18px, **`--imgr`** | ❌ diverges |
| 6 onboarding deck | `--imgr` | `.idhero` — `DESIGN_W2_2_onboarding-deck_mockup-v0_1.html:79` | 84px, **`--imgr`** | ✅ |
| 7 profile hero | `--imgr` | `.pfp` — `surface_profile_v1_0.html:191` | `height:100%; aspect-ratio:1/1;` **`--imgr`** | ✅ — and `xl:aspect-square xl:h-full xl:w-auto` is a *verbatim* port of it |
| 8 onboarding page | `--imgr` | `.idav` — `DESIGN_W2_1_first-login-journey_mockup-v0_1.html:183` | 46px, **`--imgr`** | ✅ |

**The mockup corpus is itself split** — three files say circle
(`surface_discovery:84`, `DESIGN_W2_10_sell-and-clamp:90`,
`DESIGN_W2_1_auth-modal_v0_3:106`), six say `--imgr`. The build is split too, but
along a **different line**. Converting only 6/7/8 moves the three compliant
mounts, leaves the four divergent ones, and ends with an all-circle product in
which **six ratified documents say rounded-square**.

### 1.1 The root cause is on the record, and it is not anyone's mistake

`docs/design/ZUGZWANG-BRAND_agenda-and-values-log_v0_3.md:44`:

> **O6 · PFP resolved:** avatar art is **pipeline-owned, not CD** — ADR-0011 specs the full pre-launch ComfyUI/Flux run … **Empty square in CD is the correct current state. Nothing to fix, nothing to import.**

The brand system assigned `--imgr` to avatars (`:176` — *"`--imgr 6px` (images,
**avatars**, media, graph panels)"*) **while the avatar was an abstract empty
square nobody had seen.** The art that arrived on 2026-08-25 is a disc.

⇒ **This is not a defect. It is a ratified shape meeting delivered art for the
first time, and it is the founder's to rule.** That ruling is `OD-2`, and §2
below is written on the assumption it goes to all-circle — which is what the
kickoff's own framing implies.

---

## 2 · Shape — the circle pass

**Ruling assumed (`OD-2` = all-circle).** One shape for the identity avatar
across the product: a circle.

### 2.1 The three mounts the kickoff names

| # | File · symbol | Change |
|---|---|---|
| **6** | `src/components/onboarding/figures.tsx` · `IdentityHero` | The frame carries `rounded-(--imgr)` and the primitive's radius is nulled three times (`rounded-none` on `Avatar`, `AvatarImage`, `AvatarFallback`) plus `after:hidden`. **Delete all four overrides and the frame's radius**; let the primitive be itself at `size-[140px]`. The `overflow-hidden` clip becomes redundant and goes with them. |
| **7** | `src/components/profile/IdentityCard.tsx` · the `<img>` | ⚠ **REVISED by A-5 — the class string DOES change, and substantially.** The first draft said *"nothing else in the class string changes"*; that is false once §3.3.1's wrapper exists, because the wrapper breaks the percentage-height chain §4.3 depends on. **The sizing utilities move to the wrapper and the `<img>` becomes `size-full`** — exact strings in **§3.3.2**. |
| **8** | `src/app/(auth)/onboarding/page.tsx` · the `<Image>` | `rounded-(--imgr)` → `rounded-full`. `unoptimized` **stays** — `next.config.ts` still has no `images.remotePatterns` and removing it 500s the mandatory first screen after signup (PFP-RECON-1 D-7). |

### 2.2 The edit surface — CLOSED, not left open

**Fence by symbol, not by line (O-8). Three files, and `ui/avatar.tsx` is NOT
one of them — see §3.3 for the evidence that closes it.**

| File | In scope | Explicitly NOT in scope |
|---|---|---|
| `src/components/onboarding/figures.tsx` | `IdentityHero` — the frame's radius + `overflow-hidden`, and the three `rounded-none` / `after:hidden` overrides | the 140px sizing, the `mb-[18px]`, the fallback's `text-[28px]` |
| `src/components/profile/IdentityCard.tsx` | the `<img>` element, **its new wrapper**, and the `biome-ignore` comment block immediately above it | the `bg-n1`, the `alt`, the `width`/`height` hint attributes, `.idcol` and everything below it |
| `src/app/(auth)/onboarding/page.tsx` | the `<Image>` element and **its new wrapper** | `unoptimized`, the `alt`, the 128px sizing, the surrounding `CardHeader` |
| **`src/components/ui/avatar.tsx`** | ⛔ **NOTHING. Not touched.** | — |

⚠ **The `biome-ignore` block is in scope and that is deliberate.**
`IdentityCard.tsx:138` carries the suppression reason
*"static SVG placeholder — next/image is not warranted"*. **The premise is false
since PFP-1** — the src is a 256×256 R2 webp, not a static SVG. The conclusion
still stands but for a different reason (no `images.remotePatterns`, PFP-RECON-1
**D-7**), so the reason string is **re-stated, not deleted**. ⛔ A `biome-ignore`
attaches to the node that follows it, and the same comment block records that
inserting anything between it and the element orphans the suppression — so the
wrapper goes **outside** that block, never between it and the `<img>`.

**Orphans this change creates and must clean up (§5.3):** `figures.tsx`'s
`overflow-hidden` and the three `rounded-none` overrides exist *only* to defeat
the primitive's circle. They become dead the moment the circle is wanted, and
leaving them would encode the superseded decision in code.

### 2.3 Mounts 1–5 are already circles

No code change. **They are in scope only for the ring rule (§3) and the doc
amendments (§6)** — under `OD-2` = all-circle they become compliant retroactively,
which is precisely why the amendments are same-commit and not a follow-up.

---

## 3 · ONE ring rule, across all eight

### 3.1 The disagreement, stated exactly

| Source | Ring |
|---|---|
| **Built** — `globals.css:221` | `--avatar-ring: 1px solid var(--color-n2)` ⇒ **1px solid `#404040`** |
| **Mockups** — `.navav:98`, `.idav:183`, `.idhero:79`, `.avatar` (d5 `:437`, profile `:181`, discovery `:84`) | **`1.5px solid var(--ink)`** ⇒ **1.5px solid `#fafafa`** |

Both the **width** and the **colour** differ. `avatar.tsx:18-20` already records
half the reason the build diverged.

### 3.2 The choice, named

| Option | What it is | Cost |
|---|---|---|
| **R-a ✅ RECOMMENDED** | Keep `--avatar-ring` (1px `#404040`) and make it the rule for all eight | The mockups' 1.5px `#fafafa` is formally superseded — a doc amendment, §6 |
| **R-b** | Adopt 1.5px `#fafafa` | ⛔ **`#fafafa` IS `--color-no`** — the NO pole (values-log v0_3 §3). A bright ring on every avatar puts the NO-side colour around every identity in the product, including YES-side authors. Also 1.5px on the 16px mount is **9.4% of the diameter** |
| **R-c** | No ring | The disc supplies its own edge — but only against a contrasting page. `silver-clownfish` and `violet-cat` have near-white padding at `#fefefe`/`#fdfdfd`; with no ring their crop edge is invisible and the avatar reads as a floating shape |

**R-a, and the argument is the pole collision, not inertia.** `avatar.tsx:19-20`
already says *"`--color-ink` is #fafafa in this build"*; what it does not yet say
is that this is the **NO pole**, which is the part that makes the mockup value
unusable rather than merely different. That sentence is the amendment in §6 #3.

### 3.3 The rule has a MECHANISM half, and that half is a real inconsistency today

> **Every avatar mount carries exactly `var(--avatar-ring)`, applied as an INSET
> OVERLAY that consumes no layout box.**

| Mount | Ring today | Mechanism |
|---|---|---|
| 1–6 | ✅ present | `ui/avatar.tsx:34` — `after:absolute after:inset-0 after:rounded-full after:[border:var(--avatar-ring)]`, a pseudo-element. **Zero layout cost.** |
| 7 | ❌ **ABSENT** | — |
| 8 | ✅ present | `(auth)/onboarding/page.tsx:85` — `[border:var(--avatar-ring)]`, a **real border**. Under Tailwind preflight's `box-sizing: border-box` this eats 1px per side: the 128px box renders a **126px** image. |

**Two fixes, both inside the rule — and both DECIDED here, not at execute:**

#### 3.3.1 Mount 7 → a WRAPPER. It does not adopt `ui/avatar.tsx`.

⚠ The previous draft left this open ("re-evaluate at execute"). It is closed
now, and the deciding evidence is the test suite rather than the comment.

**Does `IdentityCard.tsx:125-138`'s jsdom argument still hold now that the src is
a real R2 URL? It splits in three, and only one third is stale:**

| Clause | Verdict |
|---|---|
| *"the radix Avatar … defers the img until load and shows only its fallback under jsdom"* | ✅ **STILL HOLDS.** Nothing in PFP-1 touched the radix loading state machine. And it is no longer merely asserted — **`grep 'AvatarImage\|avatar-image' tests/` returns ZERO hits across the whole suite.** Not one test in this repo has ever asserted a primitive-rendered avatar src, on any of the six primitive mounts. That absence is the mechanism's fingerprint |
| *"the PFP is a tiny static SVG placeholder"* | ⛔ **STALE.** It is a 256×256 R2 webp, median 4.7 KB |
| *"next/image would rewrite its src and add no value"* | ✅ **HOLDS, for a NEW reason.** Not "adds no value" — `next.config.ts` has no `images.remotePatterns`, so `next/image` on an R2 host **throws at render** (PFP-RECON-1 **D-7**). The conclusion survives its own premise; §2.2 re-states the reason rather than deleting it |

**Four live assertions depend on a real `<img>` being a child of the card:**

| Assertion | What it does |
|---|---|
| `surface.test.tsx:519-522` | `card.querySelector("img")`, then asserts `src` **and** `alt` |
| `arrangement.test.tsx:1214-1220` | `row16::the-square-is-declared-and-is-xl-SCOPED` — **throws** `"row16: the identity card renders no <img>"`, then reads `pfp.className` for the xl utilities |
| `arrangement.test.tsx:1269-1275` | asserts the `width="56"` / `height="56"` ratio-hint attributes |
| `arrangement.test.tsx:1428-1431` | `expect(img?.parentElement).toBe(card)` |

⇒ **Adopting the primitive would take all four RED at once, and would delete the
only coverage in the repo that proves the profile hero renders the right image.**
A wrapper keeps three of the four green.

**Decision: a wrapping element.** ⚠ **But the `<img>` does NOT "stay exactly what
it is" — that sentence stood here in the first draft and A-5 falsified it. See
§3.3.2.**

#### 3.3.2 ⛔ A-5 — THE WRAPPER BREAKS THE SIZING CHAIN. MEASURED, NOT REASONED.

**The concern FIRES.** Verified against the compiled stylesheet on staging in a
**pinned 1440px iframe that throws on width mismatch**, with `/api/health`
`canary` asserted equal to the build under review **before** measuring — the same
method §2 of `zz_PFP-UI-1` used. Canary `4ed4875…`; `IdentityCard.tsx`,
`ui/avatar.tsx` and `globals.css` blob-hash **identical** to `origin/main`, and
the band declaration `grid gap-4 lg:h-[188px] lg:grid-cols-2 lg:grid-rows-[188px]`
byte-identical, so the chain measured is `origin/main`'s chain.

**The failure is worse than the concern predicted — not a shrink, a blow-out:**

| Variant @1440 | `<img>` box | Verdict |
|---|---|---|
| **0 · Baseline, as shipped** | **188 × 188** | the §4.3 precondition |
| **1 · Naive wrapper** — `<span class="relative">`, `<img>` unchanged | ⛔ **256 × 256** | `height:100%` against an auto-height wrapper resolves to **`auto`**; `width:auto` + `aspect-ratio:1/1` then fall back to the **intrinsic 256×256**. **68 px larger in both axes, overflowing the 188 px band.** Not 56×56 — the attribute hints lose to the author `w-auto` |
| **2 · FIX A** — sizing on the wrapper, `<img>` `size-full` | **188 × 188** ✅ | |
| **3 · FIX B** — wrapper `self-stretch`, `<img>` unchanged | **188 × 188** ✅ | |
| **4 · Restored** | 188 × 188 | harness clean, no state bleed |

**And below xl, in a second pinned iframe at 1100:**

| Variant @1100 | `<img>` box | top offset in the 188 band |
|---|---|---|
| Baseline | 56 × 56 | 66 px (centred) |
| **FIX A** | 56 × 56 | 66 px ✅ identical to baseline |
| **FIX B** with the `xl:`-scoped stretch inactive | 56 × 56 | 66 px ✅ |
| ⛔ **FIX B with `self-stretch` UNPREFIXED** | 56 × 56 | **0 px — TOP-ALIGNED** ⛔ a regression |

##### ⚠ Two candidate classes DO NOT EXIST in the compiled stylesheet

Checked directly against the live CSSOM, which is exactly why this was measured
rather than reasoned:

| Class | Resolves? |
|---|---|
| `relative` · `size-full` · `self-stretch` · `shrink-0` · `h-14 w-14` · `object-cover` · `rounded-full` · `xl:h-full` · `xl:w-auto` · `xl:aspect-square` · `aspect-square` · `h-full` · `w-auto` | ✅ all present |
| `after:absolute after:inset-0 after:rounded-full after:[border:var(--avatar-ring)]` | ✅ present — `::after` renders `position:absolute`, inset 0 on all four sides, full radius, **1px `rgb(64,64,64)` = `#404040`** |
| **`xl:self-stretch`** | ⛔ **ABSENT** — `align-self` computes `auto` |
| **`xl:size-full`** | ⛔ **ABSENT** |

Tailwind v4 compiles only what it finds in source, and neither string appears in
the codebase today. **They would compile once written into source — but they
cannot be verified by the method this task mandates**, and Fix B needs
`xl:self-stretch` (unprefixed is the measured regression above).

##### THE DECISION: **FIX A**

**Three reasons, in order of weight:**

1. **Every class in Fix A is already compiled and was measured green at both
   breakpoints.** Fix B depends on a class that does not exist in the build I
   could test. Choosing it would mean shipping a utility I was explicitly told to
   verify and could not.
2. **It matches an existing in-repo pattern.** `figures.tsx:430` (mount 6)
   already does frame-owns-the-box + `size-full` inside. The two large mounts end
   up the same shape.
3. **Fix B's correct form is one keystroke from a broken one** — drop the `xl:`
   and the avatar top-aligns below xl, silently, with no test able to see it.
   Fix A has no such neighbour.

**The exact class strings — both elements, verbatim:**

```
wrapper  <span className="relative shrink-0 h-14 w-14 xl:aspect-square xl:h-full xl:w-auto
                          after:absolute after:inset-0 after:rounded-full
                          after:[border:var(--avatar-ring)]">

<img>    className="size-full rounded-full bg-n1 object-cover"
```

**Measured with the ring attached, @1440:** wrapper 188 × 188 `aspect-ratio 1/1`
`position: relative`; `<img>` 188 × 188, full radius, `object-fit: cover`; ring
`::after` absolute, inset 0 ×4, **1px `#404040`**; the `width="56" height="56"`
ratio-hint attributes and `alt=""` **survive on the `<img>`**; does **not**
overflow the band.

⚠ **`bg-n1` moves to the `<img>`, not the wrapper** — it is the loading-state
fill and must sit on the element that is loading. ⚠ **`rounded-full` is on BOTH**:
the `<img>` for the crop, the wrapper's `::after` for the ring.

##### The second test this costs

Fix A moves `xl:aspect-square xl:h-full xl:w-auto` **off** the `<img>`, so
`arrangement.test.tsx:1214-1220` — `row16::the-square-is-declared-and-is-xl-SCOPED`,
which reads `pfp.className` where `pfp = card.querySelector("img")` — must now
read the **wrapper's** className. **Re-expressed, not deleted**: the property it
guards (*the square is declared, and it is xl-scoped*) still holds, one element
out. That is **two** re-expressions in total with §3.3.1's `parentElement` one,
and both are named in §9.

**Fix B is recorded, not adopted**: measured viable at both breakpoints, but
needs `xl:self-stretch` (uncompiled today) and has the unprefixed regression
adjacent.

The ring rides that wrapper carrying
`after:absolute after:inset-0 after:rounded-full after:[border:var(--avatar-ring)]`
— **the identical declaration `ui/avatar.tsx:34` uses**, copied rather than
imported (see §3.3.4).

⚠ **The wrapper costs exactly one assertion, and it is named here so it is not a
surprise at execute:** `arrangement.test.tsx:1431`'s
`expect(img?.parentElement).toBe(card)` goes RED, because the parent becomes the
wrapper. Its stated intent is *"If the tiles landed beside the PFP the band would
be three columns, not two"* — a claim about **column count**, for which
`parentElement` was only ever a proxy. It is re-expressed against the wrapper
(`expect(img?.closest('[data-testid="identity-card"]')).toBe(card)` plus the
wrapper's own parent), **not deleted**. Re-expressing an assertion to test what
it says it tests is in scope; weakening it is not.

#### 3.3.3 Mount 8 → HAND-ROLLED. Primitive-supplied is not available.

`AvatarImage` is `AvatarPrimitive.Image`, which **renders its own `<img>`**. It
cannot wrap or adopt a `next/image`. So there is no primitive-supplied option
here at all, and the choice is not between two mechanisms — it is between a
hand-rolled overlay and the layout border that is already wrong. Mount 8 gets the
same `relative` wrapper as mount 7, and its `[border:var(--avatar-ring)]` comes
off the `<Image>` so the rendered image is **128px, not 126px**.

#### 3.3.4 ⛔ THE CONDITIONAL DOES NOT FIRE — and why the declaration is copied

**Neither answer lands in `src/components/ui/avatar.tsx`.** Mount 7 takes a
wrapper; mount 8 cannot use the primitive at all. **So there is no fence
addition, no 6-mount / 5-surface blast radius, and §9's cascade is unchanged** —
this remains a three-file component change off the critical path.

That leaves the ring declaration in **three** places: `avatar.tsx:34` and the two
new wrappers. That is deliberate:

- **Extracting a shared constant would mean editing `ui/avatar.tsx`** — a file
  that serves **6 mounts across 5 surfaces** (shell · discovery · debate ·
  profile · onboarding). Paying that blast radius to dedupe a class string is the
  wrong trade, and it would pull `@code-reviewer` onto a cosmetic change.
- **The rule is enforced by a TEST, not by a constant.** §9's ring-parity test
  asserts all eight mounts resolve `var(--avatar-ring)`. A shared constant would
  be a *second* enforcement mechanism for the same rule, and §5.2 says the
  minimum that works.
- Each copy carries a one-line comment naming `ui/avatar.tsx:34` as the source,
  so the next reader finds the original rather than a third variant.

⚠ **If the founder prefers the shared constant anyway, that is a different plan:
add `ui/avatar.tsx` to §2.2's fence, state the 6-mount / 5-surface blast radius,
and add `@code-reviewer` to §9.** Recorded as the alternative, not adopted.

3. **Mount 8's border becomes an overlay**, so its rendered image is 128px and
   not 126px. *(Numbered third because §3.3.1 and §3.3.3 are the two decisions;
   this is the consequence of the second.)*

⛔ **A ring is NOT permitted to be sized to cover the §5 crescent.** At the sizes
where the crescent is visible it could not anyway — 1px against a median 6.57px
crescent at 188px — but the prohibition is stated so that a later pass cannot
reach for a 4px ring and call it design.

---

## 4 · The size ladder

### 4.1 Built vs mockup, with every divergence classified

| Mount | Built | Mockup | Δ | Classification |
|---|---|---|---|---|
| 3 Discovery | **16** | `.avatar` disc `:84` = **16** | 0 | ✅ **exact.** `avatar.tsx:9-16` documents why `xs` lives on the primitive (the `data-[size]` specificity trap) |
| 1, 2 header chip | **24** (`sm`) | `.navav` = **26** | **−2** | ⚠ **DRIFT, undocumented.** 26 sits between `sm` (24) and `default` (32). Nothing in the tree explains the choice |
| 4 debate arg row | **24** (`sm`) | `.argprofile .avatar` = **18** | **+6** | ✅ **DELIBERATE, documented.** `ArgumentList.tsx:653-659`: *"The mockup's 18px box sits between the `xs` (16) and `sm` (24) presets and is a VALUE, so it is not ported; the shipped preset for the role is."* |
| 5 profile arg row | **24** (`sm`) | `.rchead .avatar` = **18** | **+6** | ✅ **DELIBERATE** — same rule, same note |
| 6 deck | **140** | `.idhero` = **84** | **+56** | ✅ **DELIBERATE, documented.** `figures.tsx:426`: *"Sized to 140px to match the figure row on every other card."* |
| 7 profile hero | **56** below xl → **188** at ≥xl | `.pfp` = `height:100%` ⇒ **188** | 0 at ≥xl | ✅ **exact at xl** (measured, §4.3). The 56 below xl is the build's own and has no mockup counterpart |
| 8 onboarding | **128** | `.idav` = **46** | **+82** | ⚠ **UNDOCUMENTED.** Nothing in the tree explains 128 against 46 — the largest unexplained divergence in the ladder |

**Scope ruling:** this pass changes **shape and ring**, not size. The two
undocumented divergences (chip −2, onboarding +82) are **recorded as `OD-5`**,
not silently ratified and not silently changed. A size change is a separate
decision with its own blast radius.

### 4.2 The `lg`/`xl` seam — ALREADY KNOWN, and this plan overstated it

⚠ **CORRECTION TO THIS PLAN'S OWN FIRST DRAFT.** It called this *"a seam the
ladder hides, found by measurement"* and *"a seam nobody asked about"*. **Both
are wrong.** It is documented in the repo, in the test file that guards the very
row it belongs to — `tests/unit/profile/render/arrangement.test.tsx:1211-1212`:

> ⚠ THE REMAINING COST IS NAMED, NOT HIDDEN: between `lg` and `xl` the avatar is 56×56 against the mockup's 188×188. **That is the last open piece of D-1.**

**What this pass contributed is confirmation, not discovery** — the first live
measurement of it, and the identification of the mechanism. The claim is
downgraded accordingly, because a plan that claims to have found a thing the
repo already names is a plan a reader will stop trusting.

**The mechanism, which the test note does not state:** the band height comes from
`lg:h-[188px]`; the image sizing comes from `xl:aspect-square xl:h-full
xl:w-auto`. **The two breakpoints do not match**, so across a 256 px-wide
viewport range the hero renders a 56 px image in a 188 px slot — 132 px of empty
column.

Measured on staging at viewport 1100 (guarded by an iframe width assertion):
band 188, image 56 × 56, `aspect-ratio: auto 56 / 56`.

**Not fixed here** — it is a breakpoint decision, not a shape one. `OD-5`, and
POLISH row `PD-PFP-04`. ⚠ **It is also the last open piece of D-1**, per the test
note, which makes it older and better-attested than this plan implied.

### 4.3 The measured box, for the record

| Viewport | `lg` | `xl` | Band | Image box | `aspect-ratio` |
|---|---|---|---|---|---|
| 1440 | ✓ | ✓ | 188 | **188 × 188** | `1 / 1` |
| 1280 | ✓ | ✓ | 188 | **188 × 188** | `1 / 1` |
| 1100 | ✓ | ✗ | 188 | 56 × 56 | `auto 56 / 56` |
| 900 | ✗ | ✗ | 144.8 | 56 × 56 | `auto 56 / 56` |

**No letterboxing at any breakpoint.** The box is exactly square and the source
is exactly square (256 × 256), so `object-cover` degenerates to a plain 256 → 188
downscale (73.4%). **This is the precondition §2.1 mount 7 relies on:** a
circular crop of a non-square box would be an ellipse.

⚠ **A-5: that precondition is PRODUCED BY A CHAIN, and §3.3.1's wrapper breaks
it.** The 188 px box exists because the card root is a **grid item** stretched to
the 188 px row, which gives `xl:h-full` a definite percentage base. Insert a flex
child between them and the base becomes auto — measured result **256 × 256**, the
intrinsic size, overflowing the band. **§3.3.2 measures it and moves the sizing
utilities onto the wrapper so the chain is restored.** Read §3.3.2 before touching
either element.

---

## 5 · ⛔ THE CASE-B BOUNDARY — the residual, and where it goes

### 5.1 What remains after the circle pass, measured

The circle is **better, not clean**. Median visible padding falls 24.83% → 6.04%
(**4.1×**), but a cream crescent survives on the **left** of most assets, because
the disc is undersized (median r = 124.1 against 128) **and** displaced right
(median dx = +4.0 in the 24, and **`dx ≥ 0` in 1,075 of 1,079 across the full
population** — census §B.7; the sample figure of 24 / 24 this line first carried
is superseded, O-5).

Worst-direction gap = `128 − r + offset`, scaled to each mount:

| Rendered size | Mounts | median gap | max gap | ≥1 px | ≥2 px |
|---|---|---|---|---|---|
| 16 px | 3 | 0.56 px | 2.46 px | 1 / 24 | 1 / 24 |
| 24 px | 1, 2, 4, 5 | 0.84 px | 3.68 px | 8 / 24 | 1 / 24 |
| 56 px | 7 below xl | 1.96 px | 8.60 px | 16 / 24 | 11 / 24 |
| 128 px | 8 | 4.47 px | 19.65 px | 21 / 24 | 17 / 24 |
| 140 px | 6 | 4.89 px | 21.49 px | 21 / 24 | 19 / 24 |
| 188 px | 7 at ≥xl | 6.57 px | 28.86 px | 21 / 24 | 20 / 24 |

**The five small mounts are essentially clean. The three large mounts — exactly
the three this pass converts — are where the residual shows.**

### 5.2 NO CSS COMPENSATION IS PROPOSED. THIS IS WHERE THE PLAN STOPS.

The residual is **baked into the asset**, in two independent ways that CSS cannot
address:

1. **A systematic rightward crop bias.** ⚠ **Restated on the census (O-5 — every
   site, not just `PD-PFP-08`): `dx ≥ 0` in 1,075 of 1,079, not 24 of 24.**
   Only 4 are negative and **none of them is NORMAL** — all four have a fitted
   radius far below the 121.8 median, meaning the fill found the *animal* rather
   than a disc, so `dx` is not measuring a disc's registration there at all.
   **Among the 840 NORMAL assets there is not one negative.** Sign test over the
   855 non-zero `dx`: 851 positive, **z = 29.0**. `fit_dy` median **0.0**,
   mean +0.42 — symmetric. A per-asset registration error scatters on both axes;
   this one is on the horizontal only. **Fixable at source and only at source.**
2. **A 30.8 px radius spread** in the 24-asset sample, and **65.2 px across the
   full population** (fitted radius 62.8 – 128.0, median 121.8). No single
   transform serves both `indigo-cat` (r = 128.0, gap 0.0) and `indigo-mouse`
   (r = 97.2, gap 39.3), let alone the full range.

**Routed to:** the asset pipeline on `spark-3100` — `convert_and_upload_pfp.py`,
which is **not in this repository**. A re-bake lands at `v2/` per ADR-0011's
version sentinel, and `pfp-url.ts` already hard-codes `v1/` at a single site, so
the cutover is one constant.

**Not owned by this plan. Not scheduled by this plan. `PD-PFP-08`, and `OD-1`
governs whether it gates.**

### 5.3 The inverted-asset rate — MEASURED. The "NOT ESTABLISHED" is discharged.

⚠ **SUPERSEDED IN PLACE (O-5).** This section previously read *"How many of the
other 847 stems are inverted is NOT ESTABLISHED — 1 of 24 sampled"* and named a
full corner-chroma pass as what would settle it. **That pass has been run over
all 1,079 objects.** Source of record: **`zz_PFP-CENSUS_2026-08-26T1748.md`**.
The old sentence is replaced rather than annotated, because it stated a
*position* — "we do not know" — that is no longer true.

**The census, over all 1,079:**

| Class | n | % |
|---|---|---|
| NORMAL — cream pad, chromatic disc | **840** | 77.85% |
| **INVERTED — chromatic pad, achromatic disc** | **47** | **4.36%** |
| FULLBLEED | **47** | 4.36% |
| OTHER | **145** | 13.44% |

⚠ **83 of the 145 OTHER are the whole Silver arm** — a silver disc has chroma ~1
by construction and cannot satisfy "chromatic disc". **OTHER is not a defect
bucket.** Excluding Silver it is 62 of 996 (6.2%).

**⛔ AND THE HEADLINE NUMBER IS NOT 47 — INVERTED ≠ COLOUR LOST.** Many inverted
assets draw the *animal* in the identity colour, so the colour survives the crop
through the animal. The operative metric is **how much of the visible circle
carries the identity colour**:

| Class | n | min | median | **below 10%** |
|---|---|---|---|---|
| **NORMAL** | 840 | **16.57%** | 45.99% | **0** |
| INVERTED | 47 | 0.00% | 24.11% | **13** |
| FULLBLEED | 47 | 1.18% | 51.31% | **1** |
| OTHER | 145 | 0.02% | 48.27% | **4** |

> ⭐ **Not one of the 840 NORMAL assets falls below 16.57%. Every asset at risk is
> outside NORMAL, and there are 18 of them — 1.67% of the population.**

**The 18, named — this is the actionable list, and `PD-PFP-09` acts on exactly
it** *(full table with RGB and chroma at `zz_PFP-CENSUS` §B.4)*:

`cerulean-capybara` (0.00%) · `teal-orangutan` (0.02%) · `olive-giraffe` (0.03%) ·
`indigo-capybara` (0.08%) · `green-squirrel` (0.11%) · `olive-squirrel` (0.28%) ·
`gold-giraffe` (0.55%) · `silver-toucan` (0.91%) · `cerulean-ladybug` (1.18%) ·
`teal-squirrel` (1.69%) · `violet-capybara` (2.52%) · `indigo-toucan` (3.77%) ·
`indigo-elephant` (7.16%) · `silver-hedgehog` (7.75%) · `teal-capybara` (8.74%) ·
`olive-capybara` (8.99%) · `jade-tortoise` (9.27%) · `jade-capybara` (9.83%)

**`cerulean-capybara.webp` remains the only literal zero**, and remains held by
`CeruleanCapybara000` — **1 of the 9 live staging identities**. The other eight
all sit between 45.58% and 52.83%.

**Forward exposure on staging:** 47 `identity_pool` rows point at an INVERTED
asset and **46 are still unassigned** — 46 future signups would receive one.

⛔ **Still not fixable in CSS** (a per-asset shape override is the same forbidden
compensation, one layer up). **`OD-4`**, restated in §8 against these numbers.

---

## 6 · Same-commit doc amendments (§5.12)

**Seven targets. The kickoff named three; measurement found four more, two of
which are already-false claims that PFP-1 falsified on 2026-08-25.**

| # | Target | Current text | Why it must move in THIS commit |
|---|---|---|---|
| 1 | `docs/design/mockups/DESIGN_W2_2_CLOSE-OUT.md:25` | *"Card 1 image = the live PFP avatar (**rounded-square at `--imgr`, matching `.navav`/`.idav`**)"* | Names the shape mount 6 is changing |
| 2 | `docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md:80` | *"the viewer's live PFP avatar as a centred hero (`.idhero`), **rounded-square at `--imgr`. Matches `.navav`.**"* | Same, for the deck's own register |
| 3 | `src/components/ui/avatar.tsx:18-20` | *"The mockup's `.avatar{border-radius:50%; border:1.5px solid var(--ink)}` is NOT ported by token name…"* | ⚠ **The citation is right for Discovery (`:84`) and WRONG for d5 (`:437`) and profile (`:181`), which say `--imgr`.** It names one source for a rule with two. Add the pole-collision reason (§3.2) while there |
| 4 | **`docs/design/ZUGZWANG-BRAND_agenda-and-values-log_v0_3.md:176`** | *"`--imgr 6px` (images, **avatars**, media, graph panels)"* | ⛔ **NEW.** The top-level brand ratification. A shape change that leaves it standing makes the system contradict itself |
| 5 | **`docs/design/design-token-contract.md:227`** | same `--imgr` scope sentence | ⛔ **NEW.** The token contract carries its own copy |
| 6 | **`docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md:86-90`** | *"**There is no live PFP anywhere in this product.** Every surface renders one static asset, `/pfp-placeholder.svg`"* — and it names all five sites | ⛔ **NEW and ALREADY FALSE.** PFP-1 falsified it. ⚠ **DIRECTION REVERSED — see §6.2.** This row previously said *"correct it IN the annotation, do not append a second one"*. That was wrong. **Preserve the dated block, append a dated supersession, and put a pointer at its head.** |
| 7 | **`docs/design/ZUGZWANG-BRAND_agenda-and-values-log_v0_3.md:280`** | *"**H2-scrub avatar render:** scrubbed users … need a defined scrubbed-avatar visual at build. One-line brand ruling owed when the surface is built."* | ⛔ **NEW.** The surface is built and the ruling is still owed; a shape change is the moment to take it. Cross-refs PFP-RECON-1 **D-3** and `IdentityCard.tsx:128-129` |

### 6.1 ⚠ The `.html` mockups are deliberately NOT on that list

`.navav:98`, `.idav:183`, `.idhero:79`, `.avatar` (`:437`, `:181`, `:84`),
`.pfp:191` are **locked evidence of what was drawn**, not contracts. Amending
them would rewrite the record of a past decision — the O-5 trap in reverse. **The
supersession belongs in the seven contract documents above.** That is why the
list is seven documents and zero mockups.

### 6.2 ⚠ Row 6's direction, REVERSED — and O-5's own text, so the reader can check

**O-5, verbatim from `CLAUDE.md:320` at `5463f61`:**

> - **O-5 · A durable amendment is applied at every site that states the superseded position.** An appendix reverses nothing a reader reaches first. POLISH.3's §18 amendments contradicted three operative sections, and an executor reading the item table never reached them. ⇒ **Write the correction INTO each operative section; an amendments block is a record of the change, never the delivery of it.** *(Proposed at `docs/plans/POLISH-3-RUN-TRACKER.md` under "founder to rule at D5"; ruled and numbered here 2026-08-14.)*

**Does that mandate in-place correction of a dated observation? NO — and the
review is right that my row was wrong.**

Read what O-5 actually contrasts. Its failure case is **an appendix**: *"an
executor reading the item table never reached them."* Its rule is about
**delivery versus filing** — *"an amendments block is a record of the change,
never the delivery of it."* The word doing the work is **INTO each operative
section**, i.e. *at the site the reader reaches*. **O-5 nowhere says the
correcting text must overwrite the superseded sentence, and it nowhere addresses
dated observations at all.** Its subject is a *superseded position* — something a
reader would act on — not a record of what was true on a date.

**And the repo already rules the dated-record case, one register over.**
`CLAUDE.md` §5.13.1, on pre-convention commits:

> **History here is not rewritten — those messages exist and are already signed, and reaching back to edit them would manufacture a past that did not happen. A note attaches to a commit without altering it, so the reasoning can be added while the commit stays exactly what it was.**

That is the identical shape: **append the correction, preserve the record.**
Rewriting the 2026-08-18 annotation would have made that date assert something it
did not assert — manufacturing a past that did not happen. **It is also exactly
the argument §6.1 already makes for leaving the `.html` mockups alone**, so my
own plan was internally inconsistent: it protected the mockups as dated evidence
and proposed rewriting an annotation that is dated evidence of the same kind.

**⚠ What my row DID get right, and what must survive the reversal:** the block is
styled *"Appended, never a rewrite"*, **and that is exactly how the stale claim
survived for eight days.** Appending alone does not satisfy O-5, because a reader
still meets the false sentence first. **The head pointer is the part that
discharges O-5**, and without it this treatment would be the appendix O-5 forbids.

**The treatment, three parts, all in the same commit:**

| # | Where | What |
|---|---|---|
| **1** | At the **head** of the 2026-08-18 block, before its first line | A one-line pointer: **⚠ SUPERSEDED 2026-08-26 — PFP-1 (`c49138d`) landed live PFPs; see the annotation below this block.** This is the O-5 delivery: the reader meets the correction *before* the stale claim |
| **2** | The 2026-08-18 block itself | **UNTOUCHED. Not one word.** It remains a true record of what the build found on 2026-08-18 |
| **3** | **Adjacent, immediately after** the 2026-08-18 block | A new dated **2026-08-26** annotation in the same register style, stating: `pfp_filename` is read by `resolve-authors.ts`, `profile/resolve.ts`, both layouts and `(auth)/onboarding/page.tsx`; composed to a public R2 URL by `server/identity-pool/pfp-url.ts`; and that `figures.tsx:433` — Card 2 — is the **one** surface still on the placeholder, deliberately (`PD-PFP-10`, §7.2) |

⛔ **If the founder reads O-5 as governing dated observations too, then part 2
inverts and the block is rewritten in place.** The quote is above so that call can
be made on the text rather than on my summary of it. **This plan takes the
append-plus-pointer reading.**

### 6.3 ADR

**No new ADR.** This changes a rendered shape, not an architectural decision.
ADR-0011 already governs the asset pipeline and its patch record already names
what is owed there. **If `OD-2` goes to all-circle, that is a design ruling and
its home is the design corpus (§6 rows 1–5), not `docs/adr/`.**
⚠ Next free ADR number is **`0041`** on `main` — but `0041` is **already claimed
by an uncommitted file on branch `Ritam`**. Anyone minting one must read
`ls docs/adr/` on both (O-2, and PFP-RECON-1 §1.5).

---

## 7 · POLISH-register rows

**IDs are PROPOSED.** `PD-<surface>-<nn>` must be allocated against the live
register's high-water mark. `PFP` is used as the surface token because this pass
is cross-surface (shell · discovery · debate · profile · onboarding); if the
register requires a numeric surface, renumber on apply. *Never renumbered, never
reused once set.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| `PD-PFP-01` | Mounts 6/7/8 render a median 24.83% of the tile as cream padding — the mount shape disagrees with the asset shape | V | values-log v0_3 §3 (`--imgr` = avatars) vs the measured asset geometry | `zz_PFP-UI-1` §1.7, T-3/T-4; contact sheet of 24 | routed | open | `--imgr` was ratified for avatars while the avatar was an empty square (values-log `:44`, O6) | **This plan §2** |
| `PD-PFP-02` | Mount 7 (profile hero) carries no ring while mounts 1–6 and 8 do | V | `--avatar-ring` ratified OQ-6; `.pfp:191` specifies `1.5px solid var(--ink)` | `IdentityCard.tsx:144` class string — no border, no ring | routed | open | Built as a plain `<img>` outside the primitive that supplies the ring | **This plan §3.3** |
| `PD-PFP-03` | The ring is a layout border on mount 8 and an inset overlay on 1–6 — a 128px box renders a 126px image | F | Tailwind preflight `box-sizing: border-box` | `(auth)/onboarding/page.tsx:85` vs `ui/avatar.tsx:34` | routed | open | Two mechanisms for one token, never unified | **This plan §3.3** |
| `PD-PFP-04` | 1024–1279 px: a 56px PFP sits in a 188px band — `lg:h-[188px]` and `xl:aspect-square` disagree on breakpoint | V | `surface_profile_v1_0.html:191` (`.pfp{height:100%}`) | ⚠ **PRE-EXISTING, not found here** — `arrangement.test.tsx:1211-1212` already names it: *"between `lg` and `xl` the avatar is 56×56 against the mockup's 188×188. That is the last open piece of D-1."* This pass contributed the **first live measurement** (viewport 1100, iframe-guarded, `zz_PFP-UI-1` §2.4) and the mechanism, not the discovery | routed | open | Band height keyed to `lg`, image sizing keyed to `xl` | **`OD-5`** — breakpoint decision, out of this pass. **Closes the last open piece of D-1 when taken** |
| `PD-PFP-05` | O1-DECK copy-register `:86-90` asserts *"There is no live PFP anywhere in this product"* — false since 2026-08-25 | S | PFP-1 (`c49138d`); `pfp-url.ts` + four resolver read sites | `zz_PFP-RECON-1` §2.2, §2.4 | routed | open | The block is styled *"Appended, never a rewrite"* — so appending happened and **reachability did not**: a reader still meets the false sentence first. That is the O-5 failure, and it is a missing **pointer**, not a missing rewrite | **This plan §6 row 6 → §6.2.** ⚠ Direction reversed: preserve the dated block, append a dated supersession, add a head pointer |
| `PD-PFP-06` | Mounts 1, 2, 4, 5 render circles where `.navav` / `.argprofile .avatar` / `.rchead .avatar` all specify `--imgr` | R | `DESIGN_W2_1:98`, `surface_d5:437,576`, `surface_profile:181,322` | This plan §1 table | routed | open | The mockup corpus is itself split 3-circle / 6-square; the build split along a different line | **`OD-2` — FOUNDER RULING. Do not "fix" either way without it** |
| `PD-PFP-07` | `avatar.tsx:18-20` cites one mockup source for a rule with two, and omits the reason the mockup value is unusable | S | `surface_discovery:84` (50%) vs `surface_d5:437` / `surface_profile:181` (`--imgr`) | The comment's own text | routed | open | Written against the first mockup opened | **This plan §6 row 3** |
| `PD-PFP-08` | Disc registration: systematic rightward crop bias + a 65.2 px radius spread across the population | B | ADR-0011 patch record §4 (the converter's contract) | **`zz_PFP-CENSUS` §B.7 — `fit_dx ≥ 0` in 1,075 / 1,079; sign test over the 855 non-zero, 851 positive, z = 29.0; `fit_dy` median 0.0 (symmetric); all 4 negatives are non-NORMAL with sub-median radii, i.e. the fill found the animal, not a disc; ZERO negatives among the 840 NORMAL.** *(Supersedes the 24/24 sample figure this row first carried.)* | routed | open | Crop stage of `convert_and_upload_pfp.py` (spark-3100, **not this repo**). Horizontal-only asymmetry is consistent with the 1280×720 → square **width** crop; the axis is evidence, the mechanism is **NOT ESTABLISHED** — the file was not read | ⛔ **Asset re-bake → `v2/`. §5.2. `OD-1` governs whether it gates** |
| `PD-PFP-09` | **18 assets lose their identity colour under a circular crop** — 13 INVERTED, 1 FULLBLEED, 4 OTHER; zero NORMAL | B | The colour-per-identity premise of ADR-0011 | **`zz_PFP-CENSUS` §B.4 — the named 18, from 0.00% (`cerulean-capybara`) to 9.83% (`jade-capybara`). 840 / 840 NORMAL are ≥ 16.57%.** 1 of 9 live staging users affected; 46 unassigned pool rows point at an INVERTED asset | routed | open | Introduced by the **recolour**, not the render: `red` — the one arm that is an original source render — carries **0** inversions, as do `magenta` and `rose`. All 47 fall in the nine recolour targets `orange`→`violet`, peaking at `teal` (9 of 83) | ⛔ **PRIMARY: filter the named 18 out of the PRODUCTION seed manifest — see §7.1. SECONDARY, non-blocking: `recolor_batch.py`, routed separately. `OD-4`** |
| `PD-PFP-10` | Mount 6 is reshaped to a circle while `figures.tsx:433` still hard-codes `/pfp-placeholder.svg` — the O1-DECK register `:80` says that slot is the live avatar | S | `ZUGZWANG-O1-DECK_copy-register_v1_0.md:80`; `DESIGN_W2_2_CLOSE-OUT.md:25` | `figures.tsx:433` (the literal) vs `:17-28` (the docblock ruling it deliberate); PFP-RECON-1 **D-6** | routed | open | The deck takes no viewer data beyond the pseudonym, and a deck-local avatar fetch would create a second PFP path beside the one resolver-owned builder | **PARKED — see §7.2. Not this pass** |

### 7.1 `PD-PFP-09`'s remedy is a MANIFEST FILTER, not a re-bake

⚠ **The first draft of this row said "re-bake that asset". That is the wrong
remedy and it is withdrawn.** Three reasons, all measured:

1. **Production is unseeded — MEASURED, no longer inferred from the ADR.**
   `zz_PFP-PRD_2026-08-26T1834.md`, read-only against `--config prd` (project ref
   `zbvprdcyxhlguxb…`, matching the repo's own `PRODUCTION_PROJECT_REF`):
   **`identity_pool` = 0 rows / 0 unassigned / 0 distinct filenames, and `users` =
   0 rows.** Independently, **0 of 11 probed PFP objects are publicly readable in
   `zugzwang-pfp/v1/`**, while the identical keys return 200 on staging.
   ADR-0011's patch record §4 already listed *"the 50,000-row production manifest
   for `scripts/seed-identity-pool.ts`"* among what is **"still owed… not
   started"** — the database and the bucket both agree with it. **So this is a
   filter applied to a file that does not exist yet — an edit to the manifest
   generator, not an operation on a live table.** No `identity_pool` row is
   updated, no `users` row is touched, and Bucket-B's one-way `assigned_at`
   transition is never approached. ⚠ **This is the strongest fact in §7.1 and it
   has a shelf life: it holds until the prod seed runs, and after that the remedy
   is a different, harder one.**
2. **A per-animal re-bake is wrong.** `capybara` is INVERTED in 7 colour arms and
   NORMAL in 4; `giraffe` in 6 and NORMAL in 5. The inversion is not a property
   of the animal.
3. **A per-colour re-bake is wrong too.** All 13 arms hold exactly 83 objects and
   **none is uniformly bad** — `teal` is the worst at 9 of 83. `red`, `magenta`
   and `rose` carry **zero**.

**The remedy, in two independently-shippable halves:**

| | What | Blocking? |
|---|---|---|
| **PRIMARY** | Exclude the **18 named files** (§5.3) from the production seed manifest, so no prod identity is ever allocated one. 18 of 1,079 = **1.67%** of the namespace — it costs 18 (colour, animal) pairs out of 871 and needs no new art | **Blocks the prod seed. Nothing else.** |
| **SECONDARY** | `recolor_batch.py` on `spark-3100` — why the recolour inverts for `orange`→`violet` and never for the `red` source arm | ⛔ **NON-BLOCKING.** Routed separately, out of this repo, no date |

⚠ **Staging is a separate question and is NOT covered by the filter.** Staging is
already seeded: 47 pool rows point at an INVERTED asset, 46 unassigned, and
`CeruleanCapybara000` already holds the 0.00% one. The staging remedy is a
`pnpm staging:reset` — a **write**, out of scope for a plan, and it is the same
reset PFP-RECON-1 **D-1**/**D-2** already want.

### 7.2 `PD-PFP-10` is PARKED, explicitly — not silently carried

**Routed to `docs/parked.md`, not to this pass.** The row exists because mount 6
gets reshaped by §2.1 while `figures.tsx:433` keeps its hard-coded
`/pfp-placeholder.svg`, and the O1-DECK register `:80` says that slot is the
viewer's live avatar. **Reshaping the frame around a placeholder makes the
divergence more visible, not less.**

**Why parked rather than fixed here:** wiring a live avatar into the deck means
giving `CardFigure` viewer data it does not currently take, which is a **new prop
through the onboarding deck's whole figure chain** — a different change with a
different blast radius, and `figures.tsx:17-28` argues on the record that a
deck-local avatar fetch would create a second PFP path beside the one
resolver-owned builder. **That argument is sound and this pass does not overturn
it.**

**What is owed with the park:** a `docs/parked.md` row in the same commit, per
that file's own standing rule (*"A routing destination named in a committed
document gets a row here in the SAME commit"*). Trigger: **whenever the deck next
takes viewer data for any reason.** Owner: whoever rules `OD-2`.

---

## 8 · Open decisions — founder

| ID | Decision | Why it cannot be taken here |
|---|---|---|
| **`OD-1`** | Does Case B gate the whole pass (**wide**) or only the compensation (**narrow**)? | This plan assumes narrow (§0.4). Wide means nothing ships until `v2/` |
| **`OD-2`** ⭐ | **All-circle** (move mounts 6/7/8, retro-ratify 1–5, amend 7 docs) or **all-rounded-square** (move mounts 1/2/4/5 and live with 24.83% padding until a frame-filling re-bake)? | Six ratified documents say `--imgr`. §1 is the evidence; the ruling is not CC's |
| **`OD-3`** | Ring: **R-a** 1px `#404040` (recommended) · **R-b** 1.5px `#fafafa` · **R-c** none | R-b puts the **NO pole** colour around every identity. §3.2 |
| **`OD-4`** ⚠ **RESTATED ON THE CENSUS** | **18 of 1,079 assets (1.67%) keep under 10% of their identity colour under a circular crop; `cerulean-capybara` keeps 0.00%. Zero of the 840 NORMAL assets are affected.** Do we (**a**) filter the named 18 from the production seed manifest — prod is unseeded, so this is a manifest edit, not a live-table operation — or (**b**) accept them and let ~1.67% of participants carry a colourless identity? | It costs 18 of 871 pairs and no new art. The old framing — *"re-bake `cerulean-capybara`, population rate unknown"* — is **withdrawn**: the rate is measured, and neither a per-animal nor a per-colour re-bake is the right instrument (§7.1). `recolor_batch.py` is routed separately and **does not gate**. §5.3 · §7.1 |
| **`OD-5`** | Size ladder: ratify or correct the two undocumented divergences — chip **24 vs 26**, onboarding **128 vs 46** — and the `lg`/`xl` seam (`PD-PFP-04`) | §4.1 / §4.2. Size is a separate blast radius from shape |

---

## 9 · Verification

**Not the critical path** (CLAUDE.md §1 — no `src/server/`, no schema, no
migration), so: `just verify` + the render suites. **No `@code-reviewer`,
`@db-migration-reviewer` or `@security-auditor`** — §5.11's triggers do not fire
on a component-radius change. `ZUGZWANG_ENV=preview just verify`.

⚠ **The cascade call is CONDITIONAL and the condition was tested, not assumed.**
It stays as written **only because §3.3.4 closed the edit surface without
touching `src/components/ui/avatar.tsx`.** Mount 7 takes a wrapper; mount 8
cannot use the primitive at all. **If either decision is reopened in favour of
the shared-constant variant, `ui/avatar.tsx` enters the fence — 6 mounts across 5
surfaces — and `@code-reviewer` must be added to this section in the same
breath.** That is a PR-scope deviation, not an executor's call.

**RED first, on the three converted mounts:**

| Test | Asserts |
|---|---|
| `tests/unit/onboarding/render/*` | `IdentityHero` renders no `rounded-none` and no `overflow-hidden` |
| `tests/unit/profile/render/*` | the hero `<img>` class contains `rounded-full` and **not** `rounded-[var(--imgr)]` |
| `tests/server/auth/onboarding-page-wiring.test.ts` | the `<Image>` carries `rounded-full` and still carries `unoptimized` |
| new — ring parity | all eight mounts resolve `var(--avatar-ring)`; **mount 7 included** (that one is RED today) |
| new — ring MECHANISM | mounts 7 and 8 carry the overlay, **not** a layout border: no `border` utility on either image element |
| **new — A-5 · the sizing chain survives the wrapper** | on `IdentityCard`: the **wrapper** carries `xl:aspect-square`, `xl:h-full`, `xl:w-auto` **and** `h-14 w-14`; the `<img>` carries `size-full` and carries **none** of those four. **Both halves asserted** — a wrapper that gained them while the `<img>` kept them would pass a one-sided check and still blow out to 256×256 |

⛔ **WHAT THAT ASSERTION CANNOT PROVE, stated plainly.** It is a **class-string**
assertion in jsdom, and **jsdom performs no layout**. It proves the utilities are
*on the right elements*. It **cannot** prove the box resolves to 188 × 188, it
**cannot** detect the 256 × 256 blow-out, and it **cannot** see that the naive
wrapper overflows the band by 68 px — the exact defect A-5 exists to prevent
would pass it. **Nothing in the automated suite can close this.** The proof is
§10.1's founder pass, and that is why A-5 adds a row to it rather than trusting
this test. *(The same limit applies to Tailwind itself: a class that does not
compile — `xl:self-stretch`, `xl:size-full`, both measured absent — is a no-op
that a class-string assertion reads as present, because it asserts the source
string, not the resolved rule.)*

⚠ **ONE EXISTING ASSERTION CHANGES, and it is named rather than discovered at
execute.** `arrangement.test.tsx:1431` — `expect(img?.parentElement).toBe(card)` —
goes RED under the wrapper. **Re-expressed, not deleted** (§3.3.1): its stated
intent is a claim about the band's **column count**, for which `parentElement`
was a proxy. The other three `<img>` assertions
(`surface.test.tsx:519-522`, `arrangement.test.tsx:1214-1220`, `:1269-1275`)
**stay green untouched** — which is the whole reason mount 7 does not adopt the
primitive.

⚠ **What a source scan cannot see, and must not be claimed.** These are class-string
assertions in jsdom, which performs no layout (AGENTS.md §9 — the four existing
height chains are source scans for the same reason). **They prove the class is
present; they cannot prove the avatar is round on screen, and they cannot see the
crescent at all.** The visual half is a founder pass on staging, and it needs
`O-10` ordering (push `staging` **before** the branch) and the `/api/health`
canary asserted in the same action as the look.

⚠ **`--imgr` has 21 consumers across 11 files. Nineteen of them are NOT avatars**
(market thumbs, comment images, media panels, composer wells). **This pass must
not touch the token** — only the three avatar call sites. A token edit would
silently re-radius every image in the product.

---

## 10 · Ritual

### 10.1 ⛔ THE FOUNDER VISUAL PASS IS A NAMED GATE BETWEEN CI-GREEN AND MERGE

**Not a suggestion, not a follow-up, and not satisfiable by a green PR.** This
pass changes only how something *looks*; §9 says in its own words that jsdom
performs no layout, so **every automated test in this plan can pass on an avatar
that renders wrong.** The gate exists because the suite structurally cannot close
it.

**Gate order — and the ordering is the control, not the courtesy:**

| # | Step | Why it is in this position |
|---|---|---|
| **1** | Push **`staging` FIRST**, before the feature branch | ⛔ **O-10.** Vercel dedups the same SHA across refs — branch-first makes it skip the staging deployment entirely, and the domain then serves the old SHA indefinitely **while Staging Migrate reports green.** There is no alias or redeploy escape hatch |
| **2** | Push the feature branch, open the PR | — |
| **3** | `ci` green — **checked at the moment of merge, not once at the start** | CLAUDE.md §5.13: there is no branch protection, `ci` is not a required check, and a red PR can be merged |
| **4** | ⛔ **FOUNDER VISUAL PASS on staging** | The gate this section adds |
| **5** | Merge | Only after 4 |

**What the visual pass must assert, in the SAME action as the look:**

> `GET /api/health` → read the **`canary`** field, and confirm it is the SHA under
> review, **in the same action as the screenshot** — not before it, not after.

⚠ **A stale server returns the passing picture.** The canary and the look are one
observation or they are two unrelated ones. Staging's canary was measured at
`f953f6d` during this plan's own Part 2 — **a `feat/rply-2-composer-fit` merge,
not `main`** — so "staging reflects `main`" does **not** hold today and the canary
must be read, never assumed (O-4's open exception).

**The five surfaces, and all eight mounts, because the pass is per-mount:**

| Surface | Mounts | What to look at |
|---|---|---|
| any signed-in page header | 1, 2 | the 24px chip — circle, ring present |
| `/` Discovery | 3 | the 16px hero head — the size where the crescent should be invisible |
| `/m/[slug]` | 4 | the 24px argument-row author |
| `/u/[pseudonym]` | 5, **7** | the argument rows **and** the hero — **at ≥1280 (188px) and again at 1100 (56px)**, because §4.2's seam changes which one you are looking at |
| ⛔ **`/u/[pseudonym]` at ≥1280 — THE A-5 ROW** | **7** | **The hero must be a SQUARE 188 × 188 box, NOT a 56 px one — and must not overflow the 188 px band.** Measure it, do not eyeball it: the wrapper and the image should both report **188 × 188**. ⚠ **Three wrong outcomes this row exists to catch, all of which pass every automated test:** **56 × 56** (the wrapper swallowed the percentage-height chain), **256 × 256** (the measured naive-wrapper blow-out — it will visibly overflow the band by 68 px), and a **non-square ellipse** (the box lost `aspect-square`, so `rounded-full` renders an oval). §3.3.2 |
| `/onboarding` | 6, **8** | the 140px deck figure and the 128px hero — **the two largest, and where §5.1 says the crescent shows (median 4.9 px and 4.5 px)** |

⚠ **Two things the pass must look for that no test can see:** the **left-side
cream crescent** (§5.1 — 21 of 24 at these sizes), and whether
`CeruleanCapybara000` — or any of the §5.3 eighteen — reads as a colourless blob.
Neither is a class string.

### 10.2 The rest

- **Branch:** `feat/pfp-ui-1`. ⚠ Check the name is free before `checkout -b`.
- **Plan:** this file, committed before Phase 1 ends (§5.1).
- **Doc amendments:** §6, **same commit as the code** (§5.12). Seven files.
- **`docs/parked.md` row:** `PD-PFP-10`, **same commit** (§7.2) — that file's own standing rule.
- **Log:** `docs/logs/PFP-UI-1.md`, own commit, before the PR (§5.9).
- **`Instructions for AI` block:** every commit, constant text, after the body and before any trailer (§5.13.1). No `Co-authored-by`.
- **Closing ritual:** the `--imgr`-is-for-avatars sentence lives in **two** design docs and **one** `globals.css` comment. If `OD-2` goes all-circle, that comment at `globals.css:180` moves too — and it is the one most likely to be missed, because it reads like a token definition rather than a claim about avatars.
