# WARLI-MOUNT — session log

**Date:** 2026-08-31 · **Branch:** `feat/warli-mount` · **Base:** `origin/main` = `2d40a68`
**Plan:** `docs/plans/WARLI-MOUNT.md` (web-authored, operator-ratified, committed verbatim)
**Preview:** `https://experiment-git-feat-warli-mount-zugzwang-worlds-projects.vercel.app/sign-in`

---

## What landed

| file | change |
|---|---|
| `src/app/(auth)/layout.tsx` | the mount — one import, one node. **Purely additive: zero existing lines removed.** Plus `aria-hidden="true"` (a stated deviation from recipe #433, see OQ-2) |
| `tests/unit/art/art-layer-guards.test.ts` | the unmounted assertion **inverted**, not deleted (ruling Q(a)); detector rewritten to RESOLVE specifiers rather than substring-match them |
| `tests/unit/shell/sticky-header.test.ts` | **unplanned** — the overlay contract widened to admit an underlay |
| `tests/unit/shell/_stacking-predicates.ts` · `tests/unit/art/_mount-scan.ts` | **new** — one definition of each detector, imported by guard and audit alike |
| `tests/unit/shell/stacking-contract.test.ts` · `tests/unit/art/mount-scan-reach.test.ts` | **new**, from `@test-writer` — assert the REJECTIONS each guard claims |
| `docs/adr/0023-participant-shell-topology.md` | in-place Patch record: the stacking contract gains an underlay side (§5.12) |
| `src/components/art/warli/index.ts` | docblock: "nothing imports this yet" → one importer, and why the count stays pinned |
| `AGENTS.md` | `:92` "MOUNTED NOWHERE" → mounted at one named site |
| `docs/parked.md` | WARLI-3 header + item 3 + item 4 + conditional trigger corrected; **item 5 minted** (the clearance failure) |
| `docs/plans/WARLI-MOUNT.md` | the brief, committed per §5.1 |

**Slice 1 (the field hoist) was implemented, measured, and REVERTED. It is not in
the diff.** See below — that is the session's main finding.

---

## Decisions made

**1 · The docket's diagnosis of the artwork's cost was wrong, and reverting the
fix it proposed was the right outcome.** `docs/parked.md` WARLI-3 item 4 read the
field's ~35 ms of server CPU together with the fact that it is rebuilt every
render, and proposed hoisting the element tree out of the render. Implemented and
measured:

| | median | note |
|---|---|---|
| `FieldLayer()` element-tree construction, before | 1.460 ms | this is ALL the hoist can remove |
| `FieldLayer()` after | 0.000083 ms | ~17,600× — the hoist works perfectly |
| whole-hero `renderToStaticMarkup`, before | 26.82 ms | N=150, paired, git-stashed between runs |
| whole-hero after | 25.65 ms | **4.4 % — against the brief's 50 % bar** |

**The ~35 ms is SERIALISATION of 791,640 bytes of markup, not construction.** The
brief's §0 table asserts `≈35 ms → eliminated`; that row is wrong, and it
inherited the error from the docket row. Reverted per §3 1c's own rule. Output
was byte-identical either way (md5 `2bfe3db35755fea54fbc1710dcc72690`, `cmp`
exit 0), so the revert costs nothing but 1.17 ms.

⚠ **A disagreement is on record rather than silently overridden (CLAUDE.md §4):**
on the merits the 12-line change was worth shipping — provably identical output,
100 % of the cost it targets removed. The bar is the operator's and 4.4 % does not
clear it. The exact patch is in the run report; re-landing is a copy-paste.

**2 · `docs/parked.md` item 4 is discharged by a CORRECTION, not by a fix — and
my correction was ITSELF wrong on the remedy.** I wrote that the only lever on
either the ~25 ms or the 82 KB is fewer elements, i.e. that the performance row
and the composition row were the same row. **`@security-auditor` refuted that,
and it is right.** The artwork is a pure constant — no props beyond `className`,
no request data, no clock, no RNG, all four already asserted by the layer's own
guards — so it need not be rendered per request at all. Two levers that are NOT
composition changes:

1. **A build-time static asset** (`public/*.svg` + `<img>`) — removes the CPU
   entirely and the bytes after first fetch. Costs baked theming (cheap: single
   dark theme) and the pointer gesture (already dead — see OQ-3).
2. **A PPR-eligible segment**, so the artwork lands in the prerendered shell.
   Blocked today by `export const instant = false`.

⚠ **Twice now this row has been reasoned about soundly from an unchecked
premise** — first the docket's (build vs serialisation), then mine (composition
as the only lever). Both corrections are written into the row itself.

**3 · The guard was inverted, not deleted, and the reason survives the change.**
The question *"where is this mounted"* gets sharper, not weaker, once the answer
stops being "nowhere": a 790 KB drawing is a deliberate trade on one signed-out
route and an accident anywhere else. Count pinned at one, site pinned by name.

**4 · `sticky-header.test.ts` was widened in SUBJECT — but the FIRST draft of
that widening really did weaken it, and both reviewers caught it.** The rule —
every `fixed` layer stacks above the header — was sound while every fixed node in
the tree was something that covers the page. The art layer is the first that goes
under; a negative tier is the far side of the in-flow content, where paint order
makes the header unreachable.

⛔ **What I got wrong, twice, and what fixed it:**

- **`-z-0` sailed through.** Tailwind compiles the negative utility as
  `calc(N * -1)`, so `-z-0` is `z-index: 0` — a stacking context above in-flow
  content and below the header, i.e. precisely the silent failure the file
  exists to catch. The pre-widening rule RED'd it; mine accepted it as
  `under = [0]`. Fixed by requiring a STRICTLY negative tier.
- **`EXPECTED_UNDERLAY_FILES` was a floor, not a ceiling** — any file could ship
  `fixed … -z-10` and pass unseen. Now pinned by set EQUALITY, like the art
  layer's importer list.
- **The scan-reach row asserted less than its docblock claimed** — flipping the
  mount to `z-50` left it green. Now it asserts the file still carries an
  underlay tier.
- **Variant-scoped tiers needed TWO predicate pairs, not one.** My first fix made
  `md:z-50` count for nothing, which then let `-z-10 md:z-50` read as a clean
  underlay — but that element genuinely is an underlay below `md` and an overlay
  above it. *"Did it declare a side?"* asks the unprefixed pair; *"did it declare
  BOTH?"* asks the variant-inclusive one.

**5 · The predicates moved into shared modules, and the reason is measured.**
`@test-writer`'s audits originally LIFTED the detectors out of the guards' source
text. Both lifts broke within an hour of the rules changing — one silently
certifying a stale rule, one dying at collection. `tests/unit/shell/_stacking-predicates.ts`
and `tests/unit/art/_mount-scan.ts` now hold one definition each (O-1).

**5 · 2d (responsive) SHIPPED WITHOUT A CHANGE, on the brief's own instruction.**
The brief assumed ~220 units of empty margin either side. `svg.getBBox()` returns
`0,0 1441×1000` — the ink fills the whole viewBox. The border bands sit on x=0 and
x=1440, and 310 of 462 placed marks live in the proposed crop zone. Any crop is a
composition change, so: *"stop, report, and ship without it."*

---

## Open questions

**OQ-1 · The composition's own clearance guarantee fails below ≈1271 × 883.
FILED as `docs/parked.md` WARLI-3 item 5**, with the eight-viewport table and the
three measurements that close off cropping.

`hero.tsx` derives `R_INNER = 330` from the card's half-diagonal and says so:
*"Shrink it and the corners of the sign-in card start eating figures."* The mount
scales the ring with the viewport; the card is a fixed 416 px. The card's worst
corner is a constant **291.3 px** from the composition centre, so clearance is
`330 · scale > 291.3` ⇒ **scale ≥ 0.8827**. It fails at 1512 × 860 (MacBook Pro
14″, 7.5 px), at 1440 × 790 (a 1440 × 900 screen after browser chrome, 30.6 px),
at 1366 × 768, 1280 × 720, 768 × 1024, and at 390 × 844 by 182 px. A measured
further 31 px of card-centre offset (artwork centres on the viewport, card centres
below the 62 px header) makes the bottom corners bite first.

⚠⚠ **I FILED THIS WRONG THE FIRST TIME AND `@code-reviewer` CAUGHT IT.** My table
compared the OUTER ring's diameter to the card's WIDTH (846 vs 416 at 1440 × 900)
and reported "clears card: yes" for every desktop width, filing it as phone-only.
That was never the constraint `hero.tsx` states. Against the right pair — inner
radius vs half-diagonal — the answer inverts at four of eight viewports and the
row becomes a desktop row. **A guarantee is only checked by the comparison it was
written as**, and I checked a different one.

**OQ-2 · The artwork is announced to screen readers on `/sign-in`.** `WarliHero`
renders `role="img"` + an `aria-label` describing the rings. Correct for an
unmounted component; as a decorative full-viewport backdrop it means a
screen-reader user meeting the first screen of the product hears that sentence
before *"Sign in"*. Not changed — every fix leaves the ratified recipe (an
`aria-hidden` on the wrapper, or a change inside `hero.tsx`). The `label` prop
already exists for exactly this. One line at the mount, either way.

**OQ-3 · `pointer-events-none` makes the pointer gesture unreachable in
production.** `hero.tsx`'s pointerenter/move/leave handling, `nudgeFor` and
`currentRotationDeg` cannot fire behind a full-viewport layer. Ruled out of scope
(S(a)) and kept as built. Whether shipping unreachable interaction code is a row
of its own is a founder call.

**OQ-4 · ⛔ THE 82 KB RESIDUAL IS AN UNAUTHENTICATED AMPLIFICATION SURFACE, and
this is `@security-auditor`'s HIGH.** Measured from the build manifests, not
assumed: `/sign-in`, `/sign-in/otp` and `/onboarding` all have `htmlSize: 0` and
**`initialRevalidateSeconds: false`** — an empty PPR shell and no ISR window, so
100 % of every request is generated by the function. `proxy.ts`'s matcher is
`["/admin/:path*"]`, so the edge middleware never runs on `/sign-in`, and all six
`Ratelimit` instances are bound to API surfaces. **No cache, no rate limit, no
auth wall.**

⚠ **The class is pre-existing; the multiplier is this PR's.** `/sign-in` was
already dynamic and unrate-limited at roughly 8 KB / 3 ms. This mount makes it
~83 KB / 28 ms — **about 10× in both bytes and CPU**, which the auditor frames as
the difference between needing a botnet and needing one VPS. Not fixed here; the
fix belongs with the lever, and the levers are in `docs/parked.md` WARLI-3 item 4.

⛔ **AND THE ROUTE TABLE I FILED WAS WRONG IN BOTH DIRECTIONS.** It read *"an
email sign-in pays it TWICE"* and *"`/onboarding` — artwork: no"*. Both refuted,
both verified by me before accepting:

- **The EMAIL flow does NOT pay twice.** `sign-in/page.tsx:74` navigates with
  `router.push()` — client-side — and the two routes share the `(auth)` layout
  segment, so the layout is not re-fetched and the SVG stays mounted. My 94.6 KB
  figure was a `curl` of a cold document, which is not what the flow does.
- **The OAUTH flow DOES pay twice.** `/onboarding` redirects only when
  `onboarding_ref` is absent or unverifiable (`onboarding/page.tsx:65-76`); with a
  valid ref it renders inside `AuthLayout` and therefore renders the artwork. The
  Google callback is a hard navigation, so a real OAuth signup fetches 791 KB at
  `/sign-in` and again at `/onboarding`.

**A number measured with `curl` describes a document, not a journey.**

---

## Context to preserve

- **The field is NOT in the hydration/flight payload.** Zero `data-warli-*`
  tokens in the 14,458-char `self.__next_f.push` stream; the payload carries only
  the client-module reference and props. The 790 KB is SSR'd HTML the browser must
  hydrate, which is a different cost from the one the docket named.
- **`next.config.ts` has `cacheComponents: true`** (S-4 Phase B). **AGENTS.md §5
  still says it is NOT enabled** — that line is stale and was not corrected here
  because it is outside this task's surface. Worth a SYNC row.
- **`-z-10` is visible only because `<html>` carries no background.**
  `globals.css`'s `body` selector applies `bg-background` and its `html` selector
  sets only `font-sans`; CSS propagates a body background to the canvas when the
  root has none, and leaves body's own used background transparent. Measured on
  the preview: `htmlBg rgba(0,0,0,0)`, `bodyBg rgb(24,24,24)`; `@code-reviewer`
  independently verified the propagation chain including Tailwind's preflight.
  ⛔ **THREE edits make the layer vanish and the one first written down was the
  least likely of them:** a background on `<html>`; a background on `<body>` or
  the `flex min-h-dvh flex-col` wrapper (far likelier); or a `transform` /
  `filter` / `backdrop-filter` / `contain` / `will-change` on either, which
  re-anchors `position: fixed` to that element and would make the artwork scroll
  away on the tall onboarding page. All three are in the layout's own comment,
  because **no test in this repo can see any of them — jsdom performs no layout.**
  *(Fenced by SELECTOR, not by line: an earlier draft here said `globals.css:238`,
  which is O-8's forbidden form and was already off by one — `:238` is `body {`
  and the declaration is on `:239`.)*
- Two remote branches still diverge under `(auth)` and neither is a lock:
  `origin/feat/pfp-1` (landed; `main` is ahead of it) and
  `origin/feat/ui6-admin-fixes` (2026-06-20, no PR). Candidates for deletion.
- Open PR **#434** also edits `AGENTS.md`; whichever merges second needs a
  trivial textual rebase.
- **Four findings outside this task's scope are filed as `docs/parked.md`
  AUTH-SURFACE-AUDIT**, from the same auditor pass. **Item 1 is the one to look
  at:** the Turnstile gate is fed the literal `"placeholder-token"` while
  `verifyTurnstile()` fails closed, so either email-OTP sign-in is broken in
  production or the bot gate is a no-op on an email-sending endpoint whose two
  rate limits both fail OPEN. Not touched here; a decorative mount is not the
  place to change auth.
- **`@security-auditor` also verified two things worth keeping**: the layer has
  **two independent locks** against intercepting input — `pointer-events-none`
  (and the compiled stylesheet contains **zero** `pointer-events:auto` rules, so
  nothing can re-enable it) and the negative tier, which puts it behind the
  full-height in-flow wrapper at every point and scroll position. Either alone
  would do. And **session replay is off** (`disable_session_recording: true`, no
  Sentry `replayIntegration`) — had it been on, 7,978 new DOM nodes would have
  entered every replay snapshot on the auth surface.

---

## Next session starts at

**Gate C on this PR.** Nothing is owed before it — the full reviewer cascade ran
(`@code-reviewer` → `@test-writer` → `@security-auditor`), every finding is either
fixed in-session or recorded above as an open question, and the suite is green.

Two things Gate C may want to rule on, both cheap either way:

- **OQ-2 was FIXED, not deferred** — `aria-hidden="true"` on the wrapper. That is
  the one addition to ratified recipe #433 and is flagged in the PR body as a
  deviation. Reverting it is deleting one attribute.
- **Slice 1 can be re-landed** against a lower bar than 50 % — the exact patch and
  its measurements are in the run report; it is 12 lines and provably
  output-identical.

⚠ **Do NOT advance `staging` from here.** That is the operator's, after Gate C
and merge (brief §6).

---

## Time

One session, 2026-08-31. Baseline suite 206 s, post-change suite 186 s, both at
zero external contention.
