# MOBILE-2c — the Android touch failure, and the sheet becoming a sheet

**Task:** MOBILE-2c · **Branch:** `feat/mobile-2-market-detail` (continued) · **PR:** #517, DRAFT
**Base tip measured:** `6f34563902f542610686b2bbc19b7f9c546c51ed`
**`origin/main` measured:** `8dc7082321fd967769de1db652c1f54988811823` — ⚠ **ONE COMMIT PAST the branch base** `8d63ebc0` (`8dc70823 Feat/post image export (#518)`). Nothing is rebased; the consequence for the staging push is in the run report.
**Doctrine:** `docs/overnight-run.md` v1.2 · **Brief:** `zz_MOBILE-2c_overnight-brief_2026-09-12.md` (founder rulings Q1–Q10 of 2026-09-12)

---

## 0 · THE R-12 ROOT CAUSE, AND WHY IT IS ONE DEFECT RATHER THAN TWO

The report was *"on Android phones neither the YES/NO switch nor vertical scrolling works."*
Those read as two defects. **They are one symptom of a modal being up when the reader does not
believe one is up**: a full-viewport `fixed inset-0` layer with `body{overflow:hidden}` behind it
kills vertical scrolling *and* swallows the tap on the tabs. One cause, both sentences.

**Two independent instances were reproduced, each with an isolating control.**

### R-12a — the composer sheet cannot be dismissed by tapping outside it, because there is no outside

`PhoneSheet.tsx:217-219` sizes the panel `h-full` when `fullHeight`, and
`PhoneDebateView.tsx:613` passes `fullHeight={viewer !== null}`. **So the sheet is full-viewport for
exactly the readers who can bet.** Measured on M3 (Pixel 5 Chromium, `isMobile`, `hasTouch`,
Android UA), signed in, composer open:

```
panel rect        {x:0, y:0, w:393, h:727}   ← the entire viewport
backdrop rect     {x:0, y:0, w:393, h:727}   ← the same rect, entirely BEHIND the panel
exposedBackdrop   null                        ← not one reachable pixel
body overflow     hidden
close controls    TWO, both aria-label "Close", both "×", 51px apart
```

A tap anywhere that is not one of those two 44×44 corner targets does nothing, and the matrix then
reads:

```
DEAD  feed · vertical AFTER composer sheet closed     doc 1649->1649
DEAD  feed · tap INACTIVE tab AFTER composer closed   track 0->0, tab YES->YES
DEAD  feed · horizontal AFTER composer sheet closed   track 0->0
```
with `sheetOpen: 1` at every one of them. **The sheet had not closed.** The details sheet closes
from the identical tap because its panel (`max-h-[96dvh]`, bottom-anchored) does not cover its own
backdrop. **Isolating control: the two sheets differ only in `fullHeight`.**

⚠ **It is NOT Android-specific.** It reproduces identically on M1 (WebKit iPhone 13), M2, and at
360 and 430. Android is where it was noticed, not where it lives.

### R-12b — the first-login deck does the same thing to a NEW viewer, and an Android tester is one

Outside this task's fence (it mounts through `GlobalHeader → RulesControl → OnboardingDeck`, the
shell lane), so it is **reported, not edited**. Measured on M3 signed in, the two rows differing by
**one cookie** and nothing else:

| | NEW viewer (no `zugzwang_intro_seen`) | RETURNING viewer |
|---|---|---|
| dialog | `Welcome to Zugzwang`, 369×596 at (12,66) | none |
| `body` overflow | **`hidden`** | `visible` |
| vertical swipe | `docY 0 → 0` **DEAD** | `docY 0 → 401` **WORKS** |
| tap the inactive tab | `YES → YES` **DEAD** | `YES → NO` **WORKS** |
| what a touch at the NO tab's own centre hits | the **deck's** div | the tab's own `<b>` |

⇒ A founder asking an Android user to check is asking somebody who has never signed in, i.e.
somebody who gets the seven-step deck first.

---

## 1 · THE SCROLL MODEL I AM SHIPPING — and the one I am rejecting

**SHIPPING: the model that is already there, unchanged.** Nested horizontal snap track
(`overflow-x-auto snap-x snap-mandatory`, `touch-action: pan-x pan-y`) with panes that are
content-height, and `<html>` as the single vertical scroller.

**Measured, before any change, on the founder's engine:** vertical scroll, horizontal swipe, finger
drag and tab tap **all WORK** on M3, M3@360, M3@430, M2, and M1 — in the feed arm and in the thread
arm. 48 of 60 cells WORKS on the first five-profile run; **all 12 DEAD cells were the same three
cells** (`vertical / tab / horizontal AFTER composer sheet closed`) on the four Chromium profiles.
Not one cell failed for a scroll-model reason.

**REJECTING: the brief's §3 step-3 replacement** — document scroll with one visible pane, translated
panes and an angle-locked pointer-events swipe detector. It is a correct design and it is the right
answer *if* nested snap cannot pass the matrix. **Nested snap passes the matrix.** Replacing a
working browser-native scroller with a hand-written gesture detector would re-implement momentum,
rubber-banding, cancellation and fling on the one device class this tier exists for, to fix a defect
that is not in the scroll model. `PhoneFeedTrack`'s own docblock argues this and the measurement
agrees with it. **`OVN-O4`: the ruled outcome is "the matrix passes"; the mechanism named alongside
it was a hypothesis, and the hypothesis is falsified.**

⇒ **The R-12 fix is R-5.** Making the sheet content-height and bottom-anchored means the backdrop is
always reachable, and R-4's swipe-down adds the gesture a phone reader tries first. The P0 and the
ruled refinement are the same change, which is why S1 and S2 merge (§3).

---

## 2 · AMBIGUITIES RESOLVED — chose / rejected / why

| # | ambiguity | chose | rejected | why |
|--:|---|---|---|---|
| A-1 | the brief's worktree command refuses — `~/code/zugzwang/mobile-2` still holds the branch | detach that worktree (`git checkout --detach`) and create `mobile-2c` **on** the branch | a second local branch + refspec push, as 2b did | 2b's blocker was a LIVE process on that tree; there is none tonight and the tree is clean, so the branch is free to take. A refspec push from a differently-named branch **skips every Lefthook pre-push job** — 2b paid that and ran the gates by hand |
| A-2 | R-12's scroll model | keep nested snap | the document-scroll replacement | measured: the model passes the matrix on every profile. §1 |
| A-3 | R-12b, the deck | **report with evidence, do not edit** | fix it | the shell lane is a scope fence and the deck reaches every `(public)` route, not this one. A change there is outside every guard this task writes. It is named in §0.2 of the report so the founder can tell the two apart on the phone in ten seconds |
| A-4 | R-5 removes `fullHeight`; the composer is the sheet that needs the most room | remove the prop entirely — one shell, `max-h-[92dvh]`, content-height | keep `fullHeight` for the composer | `fullHeight` IS R-12a. A prop whose only value is the defect is not a prop to keep. Keyboard reachability is re-measured, not assumed |
| A-5 | R-5's "largest live radius token" | **`--radius-4xl` = 26px** (`rounded-t-4xl`) | 16px | the `@theme` scale has four tokens ≥12px (14/18/22/26px, `globals.css:44-47`) so the brief's 16px fallback does not apply. 26px is also the largest that is actually USED in the tree (census: `rounded-4xl` ×9) — so "largest" and "live" agree |
| A-6 | R-4's durations | open **260ms**, close **200ms** | a `--dur-*` token | `design-canon.md §5:109` ratifies `.26 s` for this surface and `ComposerSlot.tsx:55` already declares the literal `EXIT_MS = 260` for a composer appearing. **There is exactly one duration token in the repo** (`--dur-hover: 0.12s ease`) and it is a compound hover value, not a slide. The brief's `.20s` close has no canon analogue and is taken as ruled |
| A-7 | R-4's animated close, given that `PhoneSheet` returns `null` on `!open` and the parent also unmounts it | **the sheet owns a `closing` phase**: every door sets it, the panel animates down, `onClose()` fires after the duration | hold the children as a corpse for 200ms, `ComposerSlot`-style | a corpse means `BetComposer` stays mounted after the reader has dismissed it, on the surface that takes money. Deferring `onClose` keeps the element mounted by its PARENT for the whole animation and holds nothing |
| A-8 | R-6's ruled order needs the footblock to leave `.compright`, which `BetComposer.tsx:717-728` records as "not a token" | **`max-mobile:contents` on `.compright` + `max-mobile:order-*` on the four resulting grid children** — additive, inert ≥640px | restructuring the composer's DOM under the scoped exception | `display:contents` dissolves the wrapper's BOX below 640px without moving a single node, so the grid's children become [image, fields, balance, footblock] and `order` sequences them. The founder ruled the outcome; the scoped exception is for when no additive mechanism exists, and one does |
| A-9 | R-1 removes the per-side active fill, so `activeClass` has no remaining purpose | **delete the prop**; the component owns one active style | keep the prop and pass the same value twice | the anti-inversion argument (`RR-3`) is *"never derive a POLE from a key here"*. With no pole in the answer there is nothing to derive, and a prop that must always carry one value is a way for a later edit to make it carry two |
| A-10 | R-1's active border weight vs the 1px inactive hairline | active `2px solid var(--color-ink)` — the fill's own colour | equalise both to 2px | the 1px geometry difference between states already ships; matching the border to the fill removes the visible seam without changing the inactive control |
| A-11 | R-10 does not reproduce locally | fire the FIRST quote immediately; keep the trailing debounce for keystrokes | a pending indicator in the TO WIN row | measured: `—` at 2ms → numeric at **325–354ms** on all four arms, every quote a 200 with real `shares`, NO@10 = **`Đ 12`** (the founder's own local value). The em-dash IS the 300ms trailing debounce applied to a MOUNT, which has no keystroke to debounce. A pending indicator needs a new string, and "no new strings" is a wall |
| A-12 | R-11 does not reproduce with a 4000×1500 image in the feed | measure all three shapes in all three states and report; fix only a measured overflow | fix `CommentImage` blind | at M3 with the real 4000×1500 served, `innerW 393`, `docScrollW 393`, the image renders 343×130. 2b's 569px reading is not reproduced in the feed arm. `OVN-O4` |

---

## 3 · SLICES — and the one boundary that moves

⚠ **S1 and S2 ship as ONE commit, deliberately.** R-12a's fix *is* R-5: removing `fullHeight` is
what exposes the backdrop. There is no intermediate state where the P0 is fixed and the sheet is not
yet a sheet — and splitting it would produce two commits that each fail the green-suite gate they
were split to satisfy. **The order of work does not move.**

| slice | what | exit condition |
|---|---|---|
| **S1+S2** | R-12a + R-5 (one shell: content-height, `max-h-[92dvh]`, `rounded-t-4xl`, 60% dim, reachable backdrop, `env(safe-area-inset-bottom)`, no empty band) + R-4 (slide up 260ms / down 200ms, backdrop fade, `prefers-reduced-motion` instant, swipe-down on the handle with an 80px / 0.5px·ms⁻¹ threshold, busy blocks every door) + R-8 (one `×`) + R-9 (`PLACE Đ BET` on one line) + R-10 (leading-edge quote) | the touch matrix is **all WORKS** on M1, M2, M3, M3@360, M3@430; keyboard reachability re-measured; full suite green |
| **S3** | R-6 (order + the white `Add Image`) + R-7 (preview at natural aspect, phone and the desktop carve-out) | phone order matches the ruling top to bottom; B1-c pairs at 1440 for four image shapes; B1 = 0; full suite green |
| **S4** | R-1 (tabs) + R-2 (identity row one line) + R-3 (quote-well on WebKit) + R-11 (D-15) | B12 line counts all 1 at 360/375/390/430 for normal and sold; B1-w pairs; B1 = 0; full suite green |
| **S5** | guards, reversal verification, the reviewer cascade, docs in the same commit, final audits, push, PR, preview, PNGs, report | every guard reversal-verified; cascade acted on; matrix green on the final tip |

**The matrix re-runs after every slice.** A regression there is a P0 `D-n`, not a note.

---

## 4 · FILE MAP

| file | why | tier |
|---|---|---|
| `src/components/debate/phone/PhoneSheet.tsx` | R-4, R-5, R-8, R-12a — the whole shell | phone |
| `src/components/debate/phone/PhoneDebateView.tsx` | drop `fullHeight` at three sites; R-1's tab options | phone |
| `src/components/debate/phone/PhoneSideTabs.tsx` | R-1 — one active style, no `activeClass` | phone |
| `src/components/debate/composer/BetComposer.tsx` | R-6 (`max-mobile:contents` + `order`), R-9 (one-line submit) — additive tokens only | shared, additive |
| `src/components/debate/composer/ImageAttach.tsx` | R-6 (white `Add Image`, 40px, full width), R-7 (natural-aspect preview) — R-7's attached frame is **founder-ruled carve-out 1** | shared, carve-out |
| `src/components/debate/composer/quote-reader.ts` | R-10 — the first request of a reader's life is not debounced | shared, behaviour |
| `src/components/debate/quote-well/*` | R-3 — **founder-ruled carve-out 2**, WebKit only, Chromium byte-identical at 1440 | shared, carve-out |
| `src/components/debate/ArgProfile.tsx` | R-2 — additive `max-mobile:` tokens on the identity row | shared, additive |
| `src/components/debate/CommentImage.tsx` | R-11 — **only if a real overflow is measured** | shared, conditional |
| `tests/unit/debate/phone/*`, `tests/unit/design/*` | the guards in §5 | tests |
| `docs/adr/0051-phone-market-detail-presentation.md` | Amendment A2, brief §9 **verbatim** | doc |
| `AGENTS.md` | the scroll model and the sheet shell (S5) | doc |

---

## 5 · GUARDS, each with the wrong answer it must reject

| guard | must reject |
|---|---|
| `phone-sheet-dismissal.test.tsx` | a sheet whose panel covers its own backdrop — **asserts the backdrop is hit-testable above the panel**, not merely that it exists. The row that would have caught R-12a |
| the same file | a sheet that closes while `busy`; a sheet that does not close on backdrop tap when idle |
| `phone-sheet-motion.test.tsx` | a close path that unmounts before the animation; a `closing` sheet whose backdrop still intercepts; `prefers-reduced-motion` not honoured in JS |
| `phone-sheet-swipe.test.tsx` | a swipe under threshold that closes; a swipe over threshold that does not; **a `touchmove` handler that calls `preventDefault`** |
| `phone-touch-handlers.test.ts` (source scan) | any `preventDefault` inside a `touchmove`/`touchstart` handler under `phone/`; a changed `touch-action` on the track, the panes or the bar |
| `phone-side-tabs.test.tsx` + source scan | an active tab style that depends on the side |
| `phone-sheet-single-close.test.tsx` | two controls named `Close` in one sheet |
| `composer-phone-order.test.tsx` | the ruled phone order broken; an `order` token that reorders desktop children |
| `composer-to-win.test.tsx` | a TO WIN that is still `—` after the quote resolves |
| `identity-row-one-line.test.tsx` | a meta row that wraps, incl. the sold case |
| desktop-neutrality rows in each | a phone fix applied unconditionally |

Reversal-verified (`OVN-V2`), positive controls on every negative (`OVN-V1`), test ids not classes
(`OVN-V5`).

---

## 6 · BASELINES — measured before any change, and the predicted after

| id | what | layer | before | predicted after |
|---|---|---|---|---|
| **B11** | the Android touch matrix | CDP `Input.synthesizeScrollGesture` + `Input.dispatchTouchEvent` on a launched Chromium; mechanism cells on WebKit | **60 cells: 48 WORKS / 12 DEAD**, all 12 the same three post-composer cells | **all WORKS** |
| **B1** | desktop default page ≥640 | tier gate + geometry at 1440 | one root each side of 640 | **0 px**, additive tokens + two listed carve-outs |
| **B1-c** | composer attached state at 1440, four image shapes | element boxes, composer open, image attached | to measure in S3 | an intentional diff, explained, paired |
| **B1-w** | the quote-well at 1440 on **WebKit** | mark boxes relative to the text box | to measure in S4 | Chromium unchanged, WebKit corrected |
| **B2** | horizontal overflow at 360/375/390/430 | `documentElement.scrollWidth` vs `innerWidth` | **0** (`innerW 393 == docScrollW 393` with a real 4000×1500 image served) | 0 |
| **B7** | tap-target misses | every interactive box, WCAG 2.5.8, `disabled` marked | 2b left it at **28 (17 enabled)** | ≤ that |
| **B8** | axe serious/critical | `@axe-core/playwright` wcag2a/2aa/21a/21aa | 2b left it at **0 / 0** | 0 / 0 |
| **B10** | timer callbacks/min at phone width | in-page wrap, 20s window | 2b **owed** the after-figure (O-6) | measured and reported |
| **B12** | identity-row line counts | computed line boxes, normal + sold | to measure in S4 | **1** at every width |

⚠ **Instrument discipline.** Every measurement runs against `next build` + `next start` (never
`next dev` — it paints `loading.tsx` permanently on `(public)`), and the harness **throws** rather
than returning a number on: fonts not loaded, an image undecoded, an un-revealed Suspense boundary,
zero stylesheets, an unpainted ground, a tier root under 200px tall, and a `max-mobile:` probe that
does not compute `column` below 640 and `row` above. The Chromium matrix additionally refuses to
report unless its own control page scrolled; the WebKit matrix refuses unless its mechanism reading
**discriminates in both polarities** (clean → reachable, modal up → not).
