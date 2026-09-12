# MOBILE-2d — a bounded app shell on the phone tier: native scrollers, no gesture JS

**Task:** MOBILE-2d · **Branch:** `feat/mobile-2-market-detail` (continued) · **PR:** #517, DRAFT
**Base tip:** `d5aad22d42672e879f25fdecf801e88281ca8704` — which is also `origin/staging`
**Written:** 2026-09-12, autonomous overnight run per `docs/overnight-run.md` v1.2
**Brief:** `~/Downloads/zz_MOBILE-2d_overnight-brief_2026-09-12.md` (OVN-V7, read in full)
**Foundation:** `~/Downloads/zz_MOBILE-2c-ANDROID_probe_2026-09-12T1435.md` §5, §7.1, §7.2, §9, §10, §12

---

## 0 · The one paragraph

The founder's ask is *"smooth up-down and right-left movement like iPhone."* The reason it does not
feel like that today is structural rather than stylistic: **the phone tier's designed scroll model
has never been in effect.** `PhoneFeedTrack` builds two panes that are each `overflow-y-auto
overscroll-contain`, intending the pane to scroll and the page to stay put — but nothing in the
chain above bounds the panes from the top. `<main>`'s `min-h-[calc(100dvh-60px-2px)]` is a
**minimum**, so every box grows to its content, `scrollHeight === clientHeight` on the pane forever,
`overflow-y: auto` never engages, and the **document** is the only scroller. The containment
declaration is therefore attached to a box that cannot scroll, where its one reachable effect is the
defect: an engine that treats a non-overflowing `overflow:auto` box as a scroll container refuses to
chain a pan out of it, and the pane's rectangle becomes a dead region while the chrome around it
keeps scrolling the page.

So this run does two things in order. **S-1 removes the containment token** — one line, immediately
correct whatever the cause, and it makes an Android phone usable tonight. **S-2 bounds the chain**,
which turns the tier into a real app shell: the pane becomes the scroller, the chrome sits outside
it, the browser supplies momentum, rubber-band, axis lock and snapping for free, and containment
becomes correct again and comes back. No gesture JS, no `preventDefault`, no drag maths — the class
of bug that started this lane cannot return, because there is no handler for it to live in.

---

## 1 · Measured ground (Phase A) — what the floor actually is

Local production build of `d5aad22d` on `:3100` against `zugzwang_qa`. Full detail and every
positive control in `~/Downloads/zz_MOBILE-2d_qa_2026-09-12T1555.md`.

| what | measured on the tip |
|---|---|
| pane scrollable | **false** on every market, both engines — `client 2587 / scroll 2587` |
| document scrollable | **true** — `scrollHeight 2766` against `innerHeight 727` |
| the chain | `pane h2587 (flex 0 0 auto, min auto)` → `track h2587 (flex 1 1 0%, min 0)` → `phone root h2704 (flex 1 1 0%, min 0)` → `main h2704 (flex 1 1 0%, **min 665px**)` → body h2766 |
| G1 vertical, 15 origins × 2 APIs | **0 dead / 30 works** on M3 — this Chromium chains out of the pane, exactly as the probe found |
| G2 momentum | **+209px of decelerating post-release travel** (finger arm). The `synthesizeScrollGesture` arm is N/A: the API returns only after its own fling has settled |
| G4 horizontal | TRACKS — `scrollLeft` climbs 0→260 during the drag, lands on 393 |
| G5 snap | flick advances at every distance (correct); drag returns at 0.3/0.49, advances at 0.7, returns at 0.51 |
| G6 axis lock | **1 BOTH cell of 105** (`r3c0`, x=8, 0°); crossover between 30° and 45° |
| G7 tab agreement | **0 disagreements** |
| G8 chrome | **everything scrolls** — title strip, tabs, bet bar, shell header. The document is the scroller, so every pixel of the screen drives it |
| G10 after sheets | unchanged; `body{overflow:hidden}` genuinely locks, because the body genuinely scrolls |

**⚠ The honest reading of that table: on this Chromium the floor is already good.** The founder's
defect is engine-dependent and I could not reproduce it here, exactly as the probe could not. What
S-1 removes is not a measured failure on this machine — it is **the one declaration whose only
reachable effect is that failure**, on a box where it can have no legitimate effect at all.

---

## 2 · S-1 — the floor. Its own commit, pushed before S-2 begins.

**Change.** Remove `overscroll-contain` from the pane's `className` in `PhoneFeedTrack.tsx`, and put
the reason at that line in the same commit: that the chain is unbounded, that `min-h-*` is a
minimum, that the pane never scrolls, that `overflow-y: auto` never engages, that Chromium will not
chain a pan out of a non-scrolling `overflow:auto` box with `contain`, and that the token **comes
back the moment the chain is bounded**. Cites the probe and its §7.2.

**Guard.** `tests/unit/design/phone-scroll-model.test.ts` — the **pair**, in one assertion with two
branches: containment on the pane iff the tier root declares a definite height below 640px.
Whichever half moves first, it reddens. Plus: a bounded root requires `min-h-0`/`min-w-0` on the
track row; the bounded root is sized in `dvh`/`svh` and never bare `vh`; no unprefixed
viewport-height token on the tier root (the desktop wall).

**Exit condition.** A pan from the middle of a card moves the document by a non-zero delta on M3
(the probe's §7.2 A/B), the full suite is green, B1 = 0.

---

## 3 · S-2 — the bounded shell

### 3.1 The structure, and why it is four tokens rather than a rewrite

The chain *already* declares everything a bounded shell needs, except the bound itself:

```
phone root   max-mobile:flex  max-mobile:min-h-0  max-mobile:flex-1  max-mobile:flex-col
  strip+tabs (sticky wrapper)                    flex 0 1 auto
  track      flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden
    pane     w-full shrink-0 snap-start snap-always overflow-y-auto
  bet bar    position: fixed
```

`flex-1` + `min-h-0` on the track is exactly `1fr` with the automatic minimum defeated. The pane is
a cross-axis `stretch` item of a row container, so its height is the track's. **Everything below the
root is already correct and is measured to be correct — what is missing is a definite height at the
top.** So:

**On `PhoneDebateView`'s root, below 640px only:**
`max-mobile:h-[calc(100dvh-60px-2px)]` · `max-mobile:flex-none` · `max-mobile:overflow-hidden`

⛔ **`flex-none` is not optional and it is the trap this element has already fallen into once.**
`flex: 1 1 0%` sets `flex-basis: 0%`, and in a **column** container the basis *is* the main size — it
beats `height`. A percentage basis against an indefinite parent resolves to `auto`, i.e. content.
`(public)/layout.tsx` records this being tried at MOBILE-2b and measured: Chromium kept growing to
content (the change was simply inert) and **WebKit resolved `<main>` to zero height and painted a
blank market page**. The difference here is that the height goes on the *phone root* rather than on
the shared `<main>`, and it is paired with `flex-none` so the basis cannot win.

**On the track, add `min-w-0`** — the inline-axis twin of `min-h-0`. The track is itself a
horizontal scroller full of `w-full` panes; without it the automatic minimum size on the inline axis
is the content, which is the same defect one axis over.

**On the pane, restore `overscroll-contain`** — now correct, with its comment **updated** to say so.

### 3.2 What is deliberately NOT done, with reasons

| brief item | chose | why |
|---|---|---|
| `display: grid` + `grid-template-rows: auto auto 1fr auto` | **flex column, unchanged** | The strip and the tabs are ONE sticky wrapper element in the DOM, not two rows, and the bet bar is `position: fixed`. A column flex with `flex-1 min-h-0` on the track computes identically to `1fr` and is what is already there, already guarded, and already debugged. Converting to grid is a layout rewrite whose only gain is matching the brief's words. |
| bet bar as the fourth grid row | **stays `fixed`** | It is `fixed inset-x-0 bottom-0 z-50` with `pb-[env(safe-area-inset-bottom)]` today, and the feed's content carries `pb-[140px]` to clear it. Converting it to an in-flow row changes the bottom padding, the safe-area handling and the last card's clearance — a visual change three days before the open, for no gesture benefit: the bar is chrome either way and a drag on it is outside the track either way. |
| `scrollend` for tab state | **measure first** | The register says *"prefer `scrollend` where supported"*; the ruled OUTCOME is *"tab state follows the scroller, never leads it"*, which the shipped IntersectionObserver already does — the tab WRITES scroll and the observer READS it back. G7 measures 0 disagreements on both engines today. `OVN-O4`: act on a measured condition. If G7 holds at 0 after S-2, the existing read path stays and the decision is logged; if it drifts, `scrollend` lands. |
| `-webkit-overflow-scrolling: touch` | **omitted** | Removed from WebKit in iOS 13 (2019); momentum is the default and the property is a no-op. Adding a dead vendor property is a comment that looks like a mechanism. |

### 3.3 The five consequences

**1 · Scroll lock must target the pane, not the body.** Two hand-rolled body locks exist and both
become no-ops under a bounded shell:
`PhoneSheet.tsx:467` and `MarketPriceChartOverlay.tsx:34` (reachable from the phone details sheet via
`MarketPriceChartHost`). ⇒ One module, `phone/scroll-lock.ts`, which captures and restores the
**body's** overflow *and* every `[data-pane]`'s overflow **and `scrollTop`**, and returns a restore
function. Nest-safe by construction (each lock captures whatever it found). Test: with each sheet
open a pan over the backdrop moves nothing, and on close the pane's previous `scrollTop` is restored
exactly.

⚠ **The Radix dialogs are NOT in this set and that is a measurement, not an assumption.**
`PostPopup`, `ReplyPopup`, `ImageLightbox` and the first-login deck are Radix `Dialog`s, which use
`react-remove-scroll` — that blocks scroll by *event interception*, not only by `body{overflow}`, so
it keeps working on an inner scroller. Measured in the run report rather than reasoned.

**2 · The first-login deck.** Another lane's component; **measured, reported, not touched**.

**3 · `scrollIntoView` / `window.scrollTo` retarget.** The census of the whole tree:
`DebateView.tsx:653` `resetPageScroll` (`window.scrollTo({top:0})`, called on post enter/exit),
`PhoneFeedTrack.tsx:175` `track.scrollTo` (horizontal, unaffected), `PositionsTable.tsx:614`
(profile, not this tier). Under a bounded shell `window.scrollTo(0,0)` is a no-op on the phone and a
reader entering a post lands wherever the pane happened to be. ⇒ The phone tier resets its own panes'
`scrollTop` on an arm change, in `PhoneDebateView`, keyed the same way the existing arm-reset
interlock is.

**4 · Pull-to-refresh.** With the document no longer scrolling, Android Chrome's PTR would fire from
the pane's top; `overscroll-behavior-y: contain` prevents it. Confirmed by measuring that an
over-pan at the top moves nothing and chains nowhere; the behaviour is stated in the report.

**5 · Keyboard.** The app emits no `interactive-widget`, so the keyboard shrinks the visual viewport
only and `dvh` does not change. The composer sheet's own `overflow-y-auto` is what keeps
`PLACE Đ BET` reachable (2c CR-HIGH-6). **A real on-screen keyboard remains OWED** (2c O-2) and goes
in §0.2 of the report.

---

## 4 · S-3 — the viewport unit

`dvh`, and the measurement that decides it is in the QA file. The short form: `vh`/`lvh` is the
**large** viewport, so a shell sized in it puts its own bet bar under the browser toolbar — and with
`overflow: hidden` on the root and no document scroll, under the toolbar means **unreachable**.
That leaves `dvh` and `svh`, and the bounded shell makes them behave identically in practice: URL-bar
collapse is driven by the *root* scroller, and after S-2 the document does not scroll, so the bar
never collapses and the two units never separate. `dvh` is chosen because it is the one that stays
correct if that ever stops being true, and because `<main>` and `PageContainer` already declare
`100dvh` — a second unit in the same chain is a second boundary.

⚠ **The honest limit, stated in the plan and not only in the report: an emulated Playwright viewport
has no browser chrome, so all four units measure equal.** What is measured instead is the question
the units decide — whether the shell clips, whether the bet bar is on screen, and whether the feed's
position survives — at the small viewport and the large one, and across a resize between them.

---

## 5 · Slices

| # | slice | exit condition |
|--:|---|---|
| **S1** | Fix A — the token, its reason, the pairing guard | the §7.2 A/B delta > 0 on M3; suite green; B1 = 0. **Own commit, pushed before S2 starts.** |
| **S2** | Fix B — the bound, containment restored, the five consequences | G1 0 dead · G2 momentum > 0 · G4 tracks · G5 snaps at the 50% line · G6 no cell moving both · G7 agrees · G10 unchanged after all three sheets · B1 = 0 · B2 = 0 · suite green |
| **S3** | guards, reversal-verified · full suite · reviewer cascade · docs in the same commit · the AFTER column · push · PR · preview | every guard reds with its fix reverted; cascade findings acted on or logged as DECLINED |

**S-5 revert gate, in numbers.** If after three genuine attempts S-2 cannot reach **G1 dead = 0**,
**G6 both ≤ 1 of 105** (the floor's own figure), **G10 unchanged after all three sheets**, **B1 = 0
at 1440**, and a green suite — then revert S-2's commits, keep S-1, log CARRIED with the failing
cells, and say so in one sentence in §0 of the report.

---

## 6 · Guards

| guard | the wrong answer it rejects | how it is verified |
|---|---|---|
| `phone-scroll::overscroll-on-the-pane-IFF-the-tier-root-is-bounded` | containment on a pane that cannot scroll; or a bounded pane with nothing to stop the chain | both branches exercised by flipping the root's height token |
| `phone-scroll::a-bounded-root-requires-min-h-0-on-the-track-row` | a bound that does nothing because the track's automatic minimum is its content | remove `min-h-0`, watch it red |
| `phone-scroll::the-bounded-root-is-sized-in-dvh-and-never-vh` | a bet bar under the browser toolbar and unreachable | swap `dvh`→`vh`, watch it red |
| `phone-scroll::no-unprefixed-viewport-height-on-the-tier-root` | the desktop wall, broken by one token | carries its own positive control |
| `phone-touch::…-track-and-panes-carry-no-touch-or-pointer-handler` | the P0 returning by the door it came in | synthetic samples per shape |
| the scroll-lock target test | a pane that scrolls under an open sheet; a `scrollTop` lost on close | assert the restore value, not just the call |
| the arm-reset scroll test | entering a post and landing mid-page | assert the pane's `scrollTop`, both arms |

Every guard reversal-verified (OVN-V2). Every negative assertion carries a positive control
(OVN-V1). Selectors are `data-testid`, never classes (OVN-V5).

---

## 7 · Ambiguity register (plan-time; the run report carries the rest)

| # | ambiguity | chose | rejected | why |
|--:|---|---|---|---|
| A-1 | "B1 vs `origin/main` = 0" | tip → final tip | branch vs `origin/main` | the branch already differs from `main` by the whole of 2b+2c (ADR-0051 records 80 px against a 118–156 px noise floor). The claim MOBILE-2d can make is that it moves nothing. |
| A-2 | grid vs flex for the shell | flex column, unchanged | `display:grid` + 4 rows | identical computed layout; the strip+tabs are one element and the bar is `fixed`, so the brief's four rows do not exist in this DOM |
| A-3 | bet bar in flow vs fixed | `fixed`, unchanged | a grid row | a visual change (bottom padding, safe area, last-card clearance) with no gesture benefit, three days before the open |
| A-4 | `scrollend` vs the shipped IntersectionObserver | measure G7 first | rewrite now | `OVN-O4` — the ruled outcome already holds and the mechanism beside it was a suggestion |
| A-5 | the viewport unit | `dvh` | `svh`, `vh`, `lvh` | §4; `vh`/`lvh` put the bar under the toolbar, `svh` and `dvh` are identical in a shell that never scrolls the document, and `dvh` is what the rest of the chain already declares |
| A-6 | `-webkit-overflow-scrolling: touch` | omit | add it as the brief lists | removed from WebKit in iOS 13; a dead vendor property that looks like a mechanism |

---

## 8 · ⛔⛔ THE FINDING — THE VERTICAL SCROLLER MUST BE AN **ANCESTOR** OF THE SNAP TRACK

*Written during the run, immediately after it was measured, because it is the thing the night was
actually for and it existed nowhere but a terminal buffer.*

### The shape of it

A bounded phone shell can put its vertical scroller in two places, and both look correct:

- **INSIDE the horizontal snap track** — one `overflow-y: auto` per pane, so each side of the debate
  keeps its own reading position. This is the obvious design, it is what `PhoneFeedTrack` was
  already written as if it had, and it is what the brief's register describes.
- **ABOVE the track** — one scroll region wrapping the whole track, the way the *document* was the
  scroller before any of this.

**The first one breaks the sideways swipe, and nothing about the layout shows it.** With a vertical
scroller nested inside the snap track, a horizontal swipe that follows a vertical scroll **moves
nothing at all** in roughly a third of attempts. Sampled every frame across the whole gesture, the
track's `scrollLeft` and the pane's `scrollTop` are both zero for every frame — so it is not a snap
that travelled and came back, it is a gesture routed to a scroller that cannot take it.

### The numbers

| arm | scroll, then swipe sideways |
|---|---|
| **unbounded (the S-1 floor, document scrolls)** | **40 / 40** — 10/10 on each of four input paths |
| bounded, scroller **inside** the track (per-pane) | **25 / 40** — 6/10, 7/10, 6/10, 6/10 |
| bounded, scroller **inside the pane** (one level deeper) | 1–5 of 6 per slope; no better |
| **bounded, scroller ABOVE the track** | **50 / 50** — 10/10 on each of four input paths, plus the control |
| any arm, with **no** prior scroll | 10 / 10 |

The four input paths are 10, 24 and 36 hand-dispatched `Input.dispatchTouchEvent` moves and Chrome's
own `Input.synthesizeScrollGesture`. **All four agree**, which is what rules out "my synthetic finger
is too coarse" as the explanation: a real gesture pipeline fails at the same rate as a hand-built one.

Across slopes, prior-scroll-then-swipe, bounded-nested vs bounded-ancestor:

| slope | nested | ancestor |
|--:|--:|--:|
| 60° | 3/6 | **6/6** |
| 70° | 3/6 | **6/6** |
| 75° | 3/6 | **6/6** |
| 80° | 3/6 | **6/6** |
| 90° | 2/6 | **6/6** |

### What else it decided, which nothing else did

**Your place in the feed survives opening a post and coming back.** The panes are keyed by side
(`YES`/`NO` ⇄ `support`/`counter`), so React replaces them whenever the arm changes — a scroller
living on a pane is rebuilt, at zero, every time. A scroll region above the track is one stable
element and is not.

| model | park the feed at 400, open a post, come back |
|---|---|
| unbounded (S-1 floor) | document **400 → 128** — the browser's own scroll restoration, and it is approximate |
| bounded, scroller on the pane | **400 → 0** — lost |
| **bounded, scroller above the track** | **400 → 400** — exact |

### The price, stated

**Both sides share one vertical position, and the shorter side is padded out to the taller one's
height.** That is precisely what the document-scroll model does today, so it is the status quo
rather than a regression — but it is real, it is the reason the nested design is attractive, and it
cannot be recovered by nesting. Per-side scroll positions need a different mechanism entirely and
are not in this task.

### Two declarations that are reliably FATAL on the snap item

Measured 0 of 8, both sweeps, and recorded so nobody adds them back:

- `overscroll-behavior-x` anything other than `auto` on the pane;
- `touch-action: pan-y` on the pane.

Both stop a horizontal gesture that begins on a card from ever reaching the track — `touch-action`
is intersected down the ancestor chain, and inline-axis containment forbids the chain. The brief's
register lists `touch-action: pan-y` on the panes; **it is not applied, and this is why.**

---

## 9 · TWO BUGS IN MY OWN HARNESS, AND WHAT THEY BECAME

Both produced a *plausible wrong number* rather than an error, which is the only kind worth writing
down.

**9.1 · The precondition check was pane-only, so it discarded an entire arm as unmeasurable.**
The scroll-then-swipe probe asserts that the *prior* vertical scroll actually happened before it
counts the swipe. It read `[data-pane], [data-pane-scroll]` scrollTops. On the **unbounded** build
the reader's vertical position lives in the **document**, so every one of ten trials was discarded
with "no prior scroll" — on a build where the scroll had worked perfectly. The output was ten
discards and an empty result set, which reads as *"this arm cannot be measured"* rather than as
*"my check is looking in the wrong object"*.
⇒ It now reads `max(window.scrollY, every element's scrollTop)`. The two models keep the reader's
position in different objects and a third variant kept it in a third; naming them one at a time is
how a precondition silently deletes an arm.

**9.2 · The box census keyed duplicate `data-testid`s by a GLOBAL index, so inserting one element
renumbered everything after it.** The desktop non-regression diff for a change that adds exactly one
node reported **~140 boxes added and ~140 removed**. A diff key has to be stable under insertion or
the diff is measuring the keying.
⇒ Keys are now `testid` plus that testid's own ordinal. Re-measured, the honest answer is: **at 1440
and at 640, zero boxes moved, zero removed, one added** (`phone-scroll-region`, which measures
`0×0` at both widths because the phone root is `display: none` there).

**And three more of the same family, found the same way and fixed at the source.** Every sampler in
the harness that NAMED the vertical scroller went silently to zero each time the scroller moved
element — and zero, on this instrument, is the word for the defect under investigation. Momentum
reported `NONE`; the tab-agreement cell reported three disagreements on a surface that agreed
perfectly; the rubber-band cell parked nothing and measured an ordinary scroll. None was a product
change. ⇒ There is now **one** definition, used by every sampler: *the element that actually
overflows and actually clips*. The self-test's broken control is computed the same way, for the same
reason — it used to list selectors, the list went stale when the scroller moved, the "broken" page
kept scrolling, and the run **refused to report**, which is the only reason that one is a footnote
instead of a table of numbers taken against a control that controlled nothing.
