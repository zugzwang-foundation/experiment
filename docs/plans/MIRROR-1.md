# MIRROR-1 — the Mirror composer (presentation only)

**Mode:** autonomous overnight run (`docs/overnight-run.md`). **Base:** `origin/main` @ `b4d1f512`.
**Register:** `docs/design/composer-mirror.md` (committed at S1 — CORE IDEA + RF-1…RF-8, verbatim).
**Critical path?** No §1 area is touched: nothing under `src/server/`, no route handler, no schema,
no migration. The composer's wire, validation and image-upload flow are the walls of this task and
are proven unchanged by baseline (A4), not by reasoning.

---

## 1 · The shape of the change

`BetComposer` stays the ONE controller — every piece of state, the key lifecycle, the quote reader,
the submit, the gating predicates. A new optional prop, `mirror`, selects a second PRESENTATION of
that same state:

- `mirror` absent → today's render, byte for byte. This is what the phone mount
  (`PhoneDebateView.tsx`) gets, because it passes nothing (RF-8).
- `mirror` present → `MirrorComposer` (new file, `composer/MirrorComposer.tsx`), a presentation
  component fed the controller's state, derived values and handlers.

`mirror` carries the only two facts the Mirror needs that the composer does not already hold — the
viewer's own identity (pseudonym + PFP URL, for RF-3) and the market's live pricing (for the RF-3
chip). Making it one object means a mount cannot ask for the Mirror without supplying them (O-1).

`ImageAttach` gains `variant: "mirror"` and renders the RF-6 image view from the SAME closures it
already owns: the local blob preview and its revoke invariants, the drag-and-drop gate, the hidden
file input. None of that logic is copied: the file input (with its `onChange`) is hoisted to one
element and the three drop handlers to one object, and both branches render those.

## 2 · Slices and exit conditions

Exit condition for EVERY slice: `pnpm vitest run` (whole suite) green, `pnpm tsc --noEmit` clean,
`biome check .` clean, `next build` green. A4 and the RF-8 render baseline stay unedited and green.

| Slice | Content | Exit condition beyond the suite |
|---|---|---|
| A | `submit-baseline.test.tsx` (A4) and `classic-layout-baseline.test.tsx` + fixture, captured on untouched `main` | both green twice (determinism) — DONE before this plan |
| S1 | `docs/design/composer-mirror.md` (verbatim register); design-canon §3 rule 5 and the "Composer (all bet composers)" entry replaced per the brief's RF-9 (its canon instructions — not a register item; the register ends at RF-8) | before/after quotes in the run report |
| S2 | `composer/mirror-sizing.ts` — `fitTitleSize` (0.5px step-down, floor 13, line height = size × 1.375) + `titleLinesLeft` counter rule; unit tests (G3's arithmetic, G6) | a 125-char all-caps title takes the step-down path in the model; a normal one does not |
| S3 | Post variant, UNMOUNTED: `MirrorComposer.tsx` (RF-1, RF-3, RF-4, RF-6 image view, RF-7), `ImageAttach` mirror variant, `BetComposer` `mirror` prop; render tests | classic baseline still byte-identical; side-pole inventory updated in this commit |
| S4+S5 | Reply variant (RF-2) + both desktop mounts switched + `page.tsx` threads the viewer PFP + detail toggle and slide (RF-5, RF-6 detail view) — **ONE commit, see §6 #1** | A4 green against the Mirror (the switch makes it exercise the new layout) |
| S6 | Guards G1–G7 verified by revert-to-red; `@code-reviewer` → `@security-auditor`; fixes | every declined finding logged with reasoning; unreviewed-fix list kept |
| M | Merge `origin/main` (FF-1 shipped mid-run — §6 #20–23) | classic baseline re-captured from pure `main` passes on the merge; A4 unedited passes |
| S7 | Push, PR (unmerged). Staging: both gates re-measured at push time (§7) | PR open; staging serves the PR head, verified by canary |

## 3 · File map

| File | Why |
|---|---|
| `src/components/debate/composer/BetComposer.tsx` | `mirror` prop; hoist the five input handlers and the suspended `Dialog` so both layouts share one copy; early branch into `MirrorComposer` before today's `return`. Today's JSX is edited ONLY where an inline handler/subtree becomes a reference to its hoisted const. |
| `src/components/debate/composer/MirrorComposer.tsx` (new) | RF-1…RF-7 presentation |
| `src/components/debate/composer/mirror-sizing.ts` (new) | RF-4 step-down + counter arithmetic (pure) |
| `src/components/debate/composer/ImageAttach.tsx` | `variant: "mirror"`; four handlers hoisted; mirror branch |
| `src/components/debate/composer/copy.ts` | the register's NEW strings only (`Draft`, `Add detail`, `Edit detail`, `Show image`, `Add an image`, `Optional · shown whole · any orientation`, `Add evidence, sources, reasoning`, `Replace`, `Min`, `Max`, `left`). No existing string changes. |
| `src/components/debate/DebateView.tsx` | the two desktop mounts pass `mirror`; new optional `ownPfpUrl` prop |
| `src/app/(public)/m/[slug]/page.tsx` | passes `ownPfpUrl` — the same `pfpUrl(session.user.pfpFilename)` the `(public)` layout already computes for the header (§6 #7) |
| `tests/unit/design/side-pole-binding.test.ts` | `MirrorComposer.tsx` joins the CLOSED inventory — the submit is side-keyed to the pole family (RF-7). Named here, same commit as the code, offender predicate passing: the file's own rule. |
| `tests/unit/debate/render/side-badge.test.tsx` | the `CHIP.base` census gains `MirrorComposer.tsx` (1 unsized site: RF-3's author-row chip IS the card's chip, unrestyled, by the register's own ruling); base 6 → 7; the test's count-bearing name is replaced by a count-free one, per that file's fence. Added at S3, where the census reddened on the new site. |
| `docs/design/composer-mirror.md` (new), `docs/design/design-canon.md` | the brief's RF-9 (canon instructions) |
| tests (new) | `submit-baseline`, `classic-layout-baseline`, `mirror-sizing`, `mirror-composer` render suites, `mirror-toggle` (G2), source guards |

NOT touched: anything under `src/server/`, `src/app/api/`, `src/db/`, `drizzle/`; `limits.ts`; `payload.ts`,
`gating.ts`, `requests.ts`, `image-attach.ts`, `state-map.ts`, `idempotency.ts`, `envelope.ts`;
`ComposerSlot.tsx`; every file under `src/components/debate/phone/`.

## 4 · Guards (kickoff §6)

| Guard | Where | Wrong answer it rejects |
|---|---|---|
| G1 | A4 (`submit-baseline.test.tsx`), unedited, green after the switch | any byte of the request moving |
| G2 | `mirror-toggle.test.tsx` | the toggle dropping the image or the detail; the hidden view unmounting (preview revoked) |
| G3 | `mirror-sizing.test.ts` + render | `{n} left` early (114) or late; wrong arithmetic at 115/125 |
| G4 | render, asserted against `floorFor(kind)` / `BET_MAX_STAKE` | literals; the post floor on a reply |
| G5 | render | a second line on the submit; any balance text (positive control: `Min` present) |
| G6 | `mirror-sizing.test.ts` | a step-down that never runs, or runs on a normal title |
| G7 | `git diff --stat origin/main -- src/components/debate/phone/` empty + RF-8 baseline | a phone render that moved |

Every guard is verified by reverting its fix and watching it red (OVN-V2); every negative carries a
positive control (OVN-V1).

## 5 · Reviewer cascade (kickoff §6, in order, effort max)

1. `@code-reviewer` — whole diff: submitted/validated/uploaded data; reply side and floor; toggle
   dropping image or detail; phone tier touched; accessibility (labels, `aria-pressed`, focus order
   title → toggle → media → amount → submit, keyboard-only use).
2. `@security-auditor` — media frame and file input only: an image shown to anyone but its author, or
   submitted, outside the existing screening flow; new client-side handling of file bytes.

## 6 · Ambiguity register (chose · rejected · why)

1. **S4 and S5 ship as ONE commit.** Rejected: separate commits. Why: switching the desktop mounts
   (S4) before the detail view exists (S5) leaves the desktop composer with no way to write detail —
   A4 (a) and (c) type into `Argument body` and would redden. No shippable state exists between
   them. Order of work unchanged.
2. **The frame's geometry is CSS, not a JS `fitFrame`.** The host is a size container (flex-grow,
   160px minimum); the frame's width is `min(100cqw, 100cqh × 16/9)` with a 16:9 aspect ratio.
   Rejected: a pure `fitFrame` + `ResizeObserver` writing pixel sizes into state. Why: the CSS form
   IS the rule `width = min(available width, available height × 16/9)`, is correct on the first
   paint, needs no layout state in React and no observer, and follows every resize without a frame
   of lag. A JS `fitFrame` would have one caller and exist to be tested. G6's frame half is proven
   instead by a real-browser measurement across viewports (w/h = 16/9 and w = min(…)) plus a source
   guard pinning the expression. OVN-O4: S2 named a mechanism; RF-6 rules the outcome.
3. **The slide is translateX ±36px + fade, 260ms, `ease`.** The shipped slot slide is translateY 14px
   (recon premise #2). Chose the register's explicit numbers with the slot's duration and easing
   (tw-animate's default `ease`). Rejected: reusing the vertical 14px. Direction: to detail = out
   left / in from right; back = the reverse. Instant under `prefers-reduced-motion`, honoured in JS
   too (the `ComposerSlot` reason: CSS alone would still hold the exit).
4. **Both views stay mounted; the inactive one is `hidden` + `inert`.** Rejected: unmounting the
   inactive view. Why: RF-6 says the image stays attached and keeps screening while hidden; the local
   preview lives in `ImageAttach`'s state and is revoked on unmount, so unmounting would blank the
   preview on the way back. It also keeps `Argument body` in the DOM for A4.
5. **Live chip price is the PAIRED percent** (`formatPricePercent` — NO = 100 − round(YES)), fed to
   `SideBadge` as the decimal whose unpaired rendering equals it. Rejected: the raw live NO price
   (rounds independently → can print 101% against the PriceBar — SPEC.1 §10.8), and the quote's
   effective price (RF-3 says live price). `SideBadge` is reused unmodified.
6. **Side pole via pole tokens.** YES `bg-yes border-no text-no`, NO `bg-no border-no text-yes` —
   the same values RF-7 names (#181818 / ink). Rejected: `text-ink`/`border-ink` — Route 2 in
   `side-pole-binding.test.ts`. The NO border matches its fill, so both poles share one box.
7. **`page.tsx` threads `ownPfpUrl`.** The wall bars "server code"; in this repository that phrase
   means `src/server/**` (AGENTS.md §3/§7, CLAUDE.md §5.11), and the wall lists API routes and server
   actions separately, which it would not need to if it meant everything that runs on a server. The
   edit is one prop computed by the helper the layout already calls; it touches no read, write or
   check. Rejected: initials-only avatars (fails RF-3's avatar), and a client fetch of the session.
   Flagged for Gate C.
8. **The author's pseudonym is text, not the card's profile link.** Rejected: the card's `Link`.
   Why: navigating away from a draft discards the typed argument.
9. **Title field is a plain `textarea`**, not the shadcn primitive — the primitive ships
   `field-sizing-content` and a bordered box, both of which RF-4 removes. Accessible name, max length,
   Enter block and newline strip are today's (hoisted, shared).
10. **Step-down measures the real field**: at each candidate size the field's height is set to 0 and
    `scrollHeight` read (content height), restored in the same layout effect; re-run on title change
    and on field width change (`ResizeObserver`, guarded for jsdom). Rejected: a hidden mirror div
    (a second wrapping model that can disagree with the textarea's).
11. **`ErrorStrip` renders full width directly above the stake bar**, inside the scrolling body.
    Rejected: squeezing its two-line strips into the Min/Max column. RF-7 routes only the three
    VALIDATION notices (C2, 429, over-cap) into that column, which is where the classic notice slot
    held them.
12. **Stake bar is `min-height` 56px, not fixed.** The C2 sentence ships verbatim (never cut to fit),
    so at narrow widths it may need a third line; clipping it is the one thing forbidden.
13. **Narrowest desktop width (640px viewport, 254px slot):** RF-7's fallback (submit 170 → 140, then
    the TO WIN column) is implemented with flex shrink weights; below the width where one row can hold
    everything, the bar wraps the submit onto its own full-width row (container query). Rejected:
    truncating money figures; horizontal overflow. The title row keeps the register's 118px toggle at
    every width — recorded as a carried design question for the 640–1000px band.
14. **Flag `image-attach-enabled` off** (ADR-0052 brake): the frame shows the detail view and the
    toggle is not rendered. Rejected: an empty image view with a dead toggle.
15. **Masked parent** (reply to a removed post): the statement row shows today's fallback
    `Place your Đ BET` (composer-header's third state), never an invented string.
16. **Pick button's accessible name is its visible text `Add an image`** (caption as description).
    Rejected: reusing `Choose an image file`, which the Mirror's visible text would not contain
    (WCAG 2.5.3). The group keeps `Attach an image`; `Remove image` is today's name.
17. **Moving to the detail view focuses the detail field**; moving back leaves focus on the toggle.
18. **The friendly-fire slot** is a `display: contents` element named
    `data-mirror-slot="friendly-fire"` immediately before the statement row's `×` — named and boxless
    (so it adds no gap). Written empty; since the merge (#21) it carries FF-1's switch on a Support
    reply and stays empty on a Counter.
19. **Local DB writes.** The wall forbids database writes; the kickoff also mandates the full suite,
    which writes to (and toggles triggers on) the local ephemeral test Postgres. Read as: no write BY
    THIS SESSION to any database outside the suite's own fixtures; staging, production and any manual
    `psql` are untouched. No screenshot fixture is seeded.

20. **FF-1 SHIPPED MID-RUN — the branch MERGES `origin/main`.** #568 and #569 merged to `main` at
    21:37Z / 21:48Z on 2026-09-23 (A0 was taken at 21:06Z; both observations sound, O-14). Rejected:
    rebasing (rewrites the SHAs this plan and the run report cite; a merge also leaves `staging` a
    fast-forward away from the PR head), and staying on the old base (the PR would conflict and could
    not merge). Conflicts: `BetComposer.tsx`, `DebateView.tsx`, the side-pole inventory — all
    take-both.
21. **FF-1's switch goes in RF-2's reserved slot — the same element.** On `main` the switch lives in
    the classic composer's header row; a Mirror without it would drop a shipped field from the
    desktop composer, which "presentation only" forbids. RF-2 names the slot as the switch's home, so
    the controller's switch element is hoisted into one const and rendered by both layouts: in the
    classic header row where FF-1 put it, and in the Mirror's slot. Rejected: a second switch in the
    Mirror (two controls over one state is where they drift), and leaving the slot empty.
    ⚠ The Mirror does NOT carry FF-1's helper line (`ff-helper`) nor a friendly-fire tag in the author
    row. RF-1's rows have no helper row and RF-3's author row lists no tag; the founder's own reply
    render shows neither beneath the statement. On the desktop the switch label's gloss carries the
    meaning (FF-1 CLOSE-1 R-A15). Flagged for Gate C.
22. **RF-8's baseline was re-captured from pure new `main` @ `44573547`** — FF-1 changed the phone's
    classic render, so "exactly as today" had a new "today". The old fixture reddened on all six
    scenarios against pure new `main` (the control that the comparison can see a change).
23. **A4 was NOT re-captured and did not need to be**: FF-1 emits `friendlyFire` only when true, so the
    three unflagged bodies are byte-identical; A4 ran green, unedited, on pure new `main`.

## 7 · Deploy (S7)

Push `feat/mirror-1`; open "MIRROR-1 — Mirror composer" against `main`; leave it unmerged.
**Staging is re-evaluated at push time, not at A0.** At A0, Gate 1 classified `0031` NOT
ADDITIVE-SAFE (a CHECK on the existing `comments` table). Since then `0031` is on `main` and in this
branch's journal, and `staging` == `main`. Both gates are re-measured immediately before any push:
Gate 1 asks whether staging's database carries a migration the PR head's journal lacks; Gate 2 asks
whether `staging` holds any commit on no other remote branch. If both hold, the push is a
FAST-FORWARD (`origin/staging` an ancestor of the PR head) — no force flag is typed, so the lease
form in the brief is not needed. Anything else → STAGING BLOCKED, reported with the reason.
