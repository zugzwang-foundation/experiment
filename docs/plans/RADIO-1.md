# RADIO-1 — the header Radio plays a YouTube playlist (desktop only)

> **Status:** executing — ⛔ **THE DESIGN BELOW (§1–§9, a visible player card) WAS BUILT AND THEN REPLACED BY FOUNDER RULING on 2026-09-26** ("don't open in website"; "add a play/pause button beside Radio; clicking Radio opens the YouTube link"). What is built: the Radio pill links to the playlist on YouTube, and a ▶/⏸ button beside it drives a **hidden** YouTube player — a founder-accepted breach of YouTube's embed rules. The switch is `NEXT_PUBLIC_RADIO_ENABLED` (Doppler), not PostHog, which the founder does not use; a hidden tab no longer pauses it. **ADR-0062 and D-54 describe the built design; read them, not §1–§9.** Playlist: `PLM84XIPy_bFQ` (measured playing; a Mix, `RD…`, never loads in an embed). Still owed: LEGAL-YT before the variable is set in production.
> **Date:** 2026-09-26
> **Author:** Hrishikesh + Claude Code
> **Base:** `origin/main` @ `64d3ea0`
> **Critical path?** RADIO-1 itself: **no** — nothing under `src/server/`, no route handler, no schema,
> no migration, no ledger, no auth code. ⚠ **But it has a critical-path PREREQUISITE**: YouTube's
> Developer Policies oblige changes to `public/legal/tos.txt` and `privacy.txt`, which move
> `TOS_VERSION_HASH` / `PRIVACY_VERSION_HASH` (`src/server/auth/tos-versions.ts`, CLAUDE.md §1 area 4).
> That is a separate full-ritual task, **LEGAL-YT** (§3), and the radio stays switched off in production
> until it lands.
> **Founder instruction (2026-09-26, verbatim):** *"go with youtube, desktop only, write the plan"*

---

## 1 · The shape of the change

`RadioSlot` stops being an inert placeholder. On desktop (≥640px), for a **signed-in** viewer, with
the `radio-enabled` flag on, a click on **Radio** opens a floating **player card**, lazily loads
YouTube's IFrame Player API, builds a player on the founder's playlist and starts it. While the card is
open the same header button pauses and resumes. The card's close control stops playback and destroys
the player. There is **no backend**: the playlist ID is a constant in the bundle, and the embedded
player needs no API key — *"The YouTube IFrame Player API service, which lets you embed videos in a
website, does not require authorization"* (YouTube API Services Developer Policies).

**Why a visible card, not the hidden player the old §21.5 imagined.** YouTube's rules (fetched
2026-09-26) forbid it:

- Required Minimum Functionality (RMF): *"Embedded players must have a viewport that is at least 200px
  by 200px"*; *"If the player displays controls, it must be large enough to fully display the
  controls"*; *"You must not display overlays, frames, or other visual elements in front of any part of
  a YouTube embedded player"*; *"an API Client must not initiate an automatic playback until the player
  is visible and more than half of the player is visible"*.
- Developer Policies §III.I: item 7, do not *"separate, isolate, or modify the audio or video
  components"*; item 8, do not *"promote separately the audio or video components"*; item 9, do not
  *"play content … from a background player, meaning a player that is not displayed in the page, tab,
  or screen that the user is viewing"*.
- Developer Policies §III.A (an embedding site is an "API Client"): link YouTube's Terms and state in
  our own terms that users are bound by them; a privacy policy that says the site uses YouTube API
  Services, links Google's Privacy Policy and discloses third-party device storage; and users must
  *"agree to a privacy policy before users can access the API Client's features"*.

**The reference the founder pointed at — `busdriverplaylist.in` — and why we don't copy it.** Its
shipped chunk mounts one `YT.Player` in a root-layout provider on a node styled
`position:fixed;width:320px;height:180px;opacity:0;pointer-events:none;z-index:-1`, drives it from its own
play/pause/next bar, and walks a 62-track array compiled into the bundle with `loadVideoById`. It starts
audio ~2 s after load and on the first `pointerdown`/`keydown` anywhere on the page. Its only backend is
a Redis listener counter. Measured against the rules above it fails 200×200 (180 tall), "not obscured"
(opacity 0), "no background player", and autoplay-before-visible. **We copy its structure** (imperative
host node, callback-chained loader, `destroy()` in `try` on cleanup, `playsinline`, state from
`onStateChange`, no audio backend) and **none of its hiding or auto-starting.**

## 2 · Behaviour

**Who sees a live button.** `live = viewer !== null && useFlag("radio-enabled", false)`. Otherwise the
button renders exactly as today — disabled, inert — so signed-out visitors, the `(auth)` routes (which
are signed-out by definition, so their header normally gets `viewer: null`), every jsdom header test
(they mount bare, and `useFlag` answers its default), and production until the flag is flipped all see
today's control. Signed-in-only is how the §III.A.2 "agree to a privacy policy before access" clause is
met: the `session.create.before` onboarding gate defers a first session until ToS/privacy acceptance
(AGENTS.md §7) — S2 re-reads that gate to confirm it before relying on it.

**Click table** (the header button, while `live`):

| Player state | Label | Click |
|---|---|---|
| `idle` (no card) | `Radio` | open the card, load, play on ready |
| `loading` | `Radio` | no-op |
| YT `PLAYING` or `BUFFERING` | `On Air` | `pauseVideo()` |
| YT `PAUSED`, `CUED`, `ENDED`, `UNSTARTED` | `Radio` | `playVideo()` |
| `error` (loader failed or timed out) | `Radio` | reset the loader, re-run the open path |

- **Open:** `idle` → `loading` → API ready → `new YT.Player(host, …)` → `onReady` → `playVideo()` **only
  if `document.visibilityState === "visible"`** (RMF: no playback until the player is visible).
- **If the browser blocks playback** (`onAutoplayBlocked`, likely on Safari), nothing special happens: the
  state stays not-playing, the label stays `Radio`, and YouTube's own large play button in the visible
  player is the way in. No extra state, no extra copy.
- **Close:** the card's close button → `destroy()` → `idle`. Closing during `loading` sets a `cancelled`
  flag so the player is never built (Turnstile's shape).
- **Tab hidden:** `visibilitychange` to hidden → `pauseVideo()`, no automatic resume. Item 9 read
  literally — a player in a tab the user has left is *"not displayed in the … tab … that the user is
  viewing"*. This also stops two tabs playing at once. (Ambiguity #4 — the founder may overrule.)
- **Desktop only:** `useIsPhoneTier()` turning `true` closes the card. The button already sits in
  `header-secondary-controls`, which is `max-mobile:hidden`; hiding the card with CSS instead would
  leave a background player.
- **Unmount** (crossing `(public)`↔`(auth)`, which mount separate headers; a full reload) → `destroy()`.
  Playback survives client navigation within `(public)` and `router.refresh()`.

**Player.** `host: "https://www.youtube-nocookie.com"`, `playerVars: { listType: "playlist", list:
RADIO_PLAYLIST_ID, playsinline: 1, loop: 1 }`, **516 × 290**. The size is YouTube's own threshold: its
embed player drops into `ytp-small-mode` (hiding playlist-menu text and jump buttons) below 480 wide or
290 tall (`base.js` build `7460dd14`), which would breach "fully display the controls". YouTube's own
controls stay **on** — they carry the required attribution and the fallback play button. The iframe is
**not** clipped by any rounded or `overflow-hidden` wrapper, and nothing the card draws (title row,
close, terms link, error line) is laid out inside the iframe's rectangle.

**The card.** `createPortal` to `document.body`; `fixed right-4 bottom-4 z-60 bg-n0 rounded-(--r)
shadow-(--elev-3) [border:var(--hairline)] p-3`, written as a literal `className` so the stacking scan
sees it. A title row (`Radio`, a **`YouTube Terms`** link to `https://www.youtube.com/t/terms` — §III.A.1
— and a close button) sits above the player box. The player box is a `bg-n1` container, which is the
background behind the iframe, never an overlay on it. `role="region"`, `aria-label="Radio player"`,
no focus move on open; the error line is `role="status"`.

**The header button.** Keeps its 34px register and `px-3 gap-2`. Drops the disabled opacity when live;
label goes `text-ink` and gains `GITHUB_TAB`'s interactive states (`hover:[border:1px_solid_var(--ring)]
active:bg-(--state-pressed-fill) focus-visible:shadow-(--state-focus-ring)`). **Width is
state-independent by construction**: both labels render in one grid cell (`col-start-1 row-start-1`,
the inactive one `invisible` — `OnboardingDeck.tsx`'s pattern) and the dot's slot is always present,
`invisible` when off. So play/pause never shifts GitHub, X, the brand cluster or the mark; the
one-time growth (the dot slot plus `ON AIR` vs `RADIO`) is measured in S4. `aria-label` follows the
visible text (`Radio` / `On Air`) — WCAG 2.5.3 label-in-name — and there is **no** `aria-pressed`,
because a toggle's label must not change with its state (WAI-ARIA APG). In `idle` it still reads
`aria-label="Radio"`, which `github-stars.test.tsx` pins. The gloss moves from `InfoTip` to `title=`
(`RulesControl`'s precedent): on touch ≥640px `InfoTip`'s Popover branch merges an `onClick` toggle onto
its child, so one tap would start the radio **and** open the gloss (`info-tip.tsx` names this defect).

**Motion** — the ratified mockup (close-out §5 "Radio synth-wave" and "Reduced motion" bullets; mockup
v0_2 `.eq` / `.dot`): five bars, height 18% ↔ 100%, durations .90 / 1.15 / .80 / 1.05 / .95 s, delays
−.10 / −.50 / −.20 / −.40 / −.05 s, running only while `On Air`; the dot at **1.4 s ease-in-out, opacity
1 → .2**. `prefers-reduced-motion`: bars freeze to the stepped 70% / 40% pattern, dot static. Labels
`On Air` / `Radio` are the close-out copy table's Radio row. The one deviation: the dot is `invisible`
rather than `display:none` when off, for the width rule above.

## 3 · Prerequisite and gating — LEGAL-YT and the flag

- **LEGAL-YT** (separate task, CLAUDE.md §1 area 4, full ritual): the founder/lawyer-authored text for
  `tos.txt` (YouTube Terms link + the binding sentence, §III.A.1) and `privacy.txt` (uses YouTube API
  Services; link to Google's Privacy Policy; third-party storage disclosure; the line *"no advertising
  cookies and no cross-site tracking"* reconciled), the hash bumps, and whatever the mid-experiment
  policy-update rule (SPEC.1, "Mid-experiment ToS / Privacy Policy updates") requires of users who
  accepted v1.0. **Claude drafts no legal wording** — it is founder content.
- **`radio-enabled`** (PostHog, `useFlag`, ADR-0052's mechanism; default **false** — fail closed: if
  PostHog is unreachable the radio is simply off). RADIO-1 can merge and deploy dark. **Flip order in
  production:** LEGAL-YT merged and promoted → flip `radio-enabled` on in the `prd` PostHog project.
  Staging and local measurement flip it in `stg`.

## 4 · Slices and exit conditions

Every slice ends green on this named set, run explicitly (`just verify` runs **no** tests):
the five `GlobalHeader` render files (`dharma-cluster`, `github-stars`, `header-rules-and-x`,
`phone-header-a13`, `phone-round-nine-header`) · `sticky-header` · `stacking-contract` ·
`global-header-mobile-reflow` · `glossary` · `terminal-pulse` · `css-compiles` · `tokens-monochrome` ·
`no-raw-hex-view-layer` · `emphasis-ladder-tokens` · the new radio suites — plus whole
`tests/unit/shell`, `tests/unit/design`, `tests/unit/copy` directories, `pnpm tsc --noEmit`,
`biome check .`. Reds already red at clean HEAD on Windows are recorded, not chased. **Nothing is
committed, pushed or PR'd without the operator asking.**

| Slice | Content | Gated by |
|---|---|---|
| S1 | `shell/radio/youtube-iframe-api.ts` (loader + minimal `declare global` types) + G1 | — |
| S2 | `RadioSlot.tsx` → `"use client"` controller; `shell/radio/RadioCard.tsx`; `GlobalHeader` passes `signedIn={viewer !== null}`; radio CSS in `globals.css`; glossary strings; stale prose (§5); G3–G12 | Q3 for the final strings (candidates allowed meanwhile) |
| S3 | Every guard reverted-to-red once; each negative scan with a positive control | — |
| S4 | `shell/radio/playlist.ts` holds the real ID + G2; `ZUGZWANG_ENV=preview just verify`; local browser measurement (§7) with `radio-enabled` on in `stg` | **Q1** (playlist ID) |
| S5 | D-54 + ADR-0062 + design-canon / SURFACES-record / stacking-contract prose (§8), landing **with** the code (same-commit doctrine) | — |

Merge needs Q1 and Q3 answered. Flipping the flag in production needs LEGAL-YT.

## 5 · File map

| File | Why |
|---|---|
| `src/components/shell/RadioSlot.tsx` | `"use client"` controller: `signedIn` prop, `useFlag`, state, player ref, loader call, visibility and phone-tier listeners, the header button (§2). Keeps the `BAR` string byte-identical (`ScrollRail.tsx` cites it as carried byte-for-byte). Docblock rewritten: no longer inert; the W2.14 "§21.5 amendment + ADR" gate is discharged by D-54 + ADR-0062 (SPEC.1 dropped §21 at 2.0.0, D-29). |
| `src/components/shell/radio/RadioCard.tsx` (new) | portal, card chrome, the React-owned container into which the controller appends an **imperative** host `div` (so `YT.Player` replaces a node React does not own), terms link, close, error line. Tokens only. |
| `src/components/shell/radio/youtube-iframe-api.ts` (new) | Loader. Fast path only when `typeof window.YT?.Player === "function"` — never on `window.YT` alone, which `iframe_api` sets to a `{loading, loaded}` stub before the real widget script (`www-widgetapi.js`) arrives. Injects `https://www.youtube.com/iframe_api` at most once; resolves from `window.onYouTubeIframeAPIReady`, **chaining** any previous callback. A 15 s timeout or `onerror` rejects **and cleans up**: clear the cached promise, remove both `script[src="https://www.youtube.com/iframe_api"]` and `#www-widgetapi-script`, `delete window.YT` when `!window.YT.loaded`, restore the previous callback — otherwise a retry re-injects `iframe_api`, which sees `YT.loading === 1` and never fetches the widget again. Hand-written minimal types; no `@types/youtube` (AGENTS.md §11 ask-first). |
| `src/components/shell/radio/playlist.ts` (new) | `RADIO_PLAYLIST_ID` (founder-supplied, never invented), `RADIO_PLAYER_WIDTH = 516`, `RADIO_PLAYER_HEIGHT = 290`. |
| `src/components/shell/GlobalHeader.tsx` | `<RadioSlot signedIn={viewer !== null} />` (the reflow guard's `<RadioSlot` substring holds); the wrapper comment's "off-site/decorative" (`:373`) reworded — Radio is neither any more. Stays synchronous. |
| `src/app/globals.css` | `@keyframes radio-eq` / `radio-dot` and their classes, plus a reduced-motion block **appended after** the existing one — `terminal-pulse.test.tsx` reads the FIRST `@media (prefers-reduced-motion: reduce)` block and expects `.chart-terminal-pulse` in it. |
| `src/lib/copy/glossary.ts` | `HEADER_GLOSSARY.radio` stays `"Radio — not yet live"` for the flag-off state; new keys for signed-out and live (Q3). |
| `src/components/shell/GitHubStars.tsx` (docblock) | "because Radio is a disabled slot" becomes false (O-5). |
| `src/components/debate/AggregateFooter.tsx` (docblock) | cites "`RadioSlot`'s (O-3)" disabled-hit-testing reasoning, which leaves RadioSlot → citation dropped; the reasoning is already inline. |
| `tests/unit/shell/sticky-header.test.ts` | `EXPECTED_OVERLAY_FILES` gains `src/components/shell/radio/RadioCard.tsx`, pinning the new layer by name. |
| `tests/unit/shell/stacking-contract.test.ts` (docblock) | "The four real fixed layers" becomes five. |
| docs — S5 | `docs/decisions/RECORD-v2.12-amendment.md` (D-54) · `docs/adr/0062-radio-youtube-playlist-embed.md` · `docs/design/design-canon.md` (the W2.14 row, DC ruling 5, and the C-CHART-2 clause 7 sentence calling Radio an inert placeholder) · `docs/records/SURFACES-record.md` (row 21.5, the paragraph under it, and the `shell/` count and list) |
| tests (new) | `tests/unit/shell/radio/youtube-iframe-api.test.ts` · `tests/unit/shell/radio/playlist.test.ts` · `tests/unit/shell/radio/radio-slot.test.tsx` · `tests/unit/shell/radio/radio-guards.test.ts` |

NOT touched: both group layouts, `src/server/`, `src/app/api/`, `src/db/`, `drizzle/`,
`src/components/debate/phone/`, `next.config.ts` (no CSP exists — measured in the repo and on the live
response — so nothing needs allow-listing; **never add a `no-referrer` policy**: YouTube answers error
153 without a Referer). Pre-existing stale line citations of `RadioSlot.tsx` (`DharmaCluster.tsx`,
`dharma-cluster.test.tsx`, `docs/parked.md`) are left as they are (§5.3); what they assert is unchanged.

## 6 · Tests

YT is stubbed on `window` in the shape of `turnstile-widget.test.tsx`; `useFlag` is mocked per test; no
network. Class-shaped strings in guards are assembled at runtime (AGENTS.md §8: Tailwind scans
`tests/`). Source scans run on **comment-stripped** source, each with a positive control.

| Guard | Where | Wrong answer it rejects |
|---|---|---|
| G1 | loader | a second `<script>`; a previous `onYouTubeIframeAPIReady` overwritten; resolving on the `YT` stub; **the two-stage hang** — a stub `iframe_api` that sets `YT.loading = 1` while the widget never arrives must reject at the timeout, remove both scripts, drop the stub, and let the next call re-inject |
| G2 | playlist | a malformed `RADIO_PLAYLIST_ID` (lands in S4 with the real ID) |
| G3 | render | anything fetched, injected or portalled before the first click; a live button when signed out or flag off |
| G4 | render | wrong player options: host not `youtube-nocookie`; `listType`/`list`/`playsinline`/`loop` missing; an `autoplay` var; width < 480 or height < 290 |
| G5 | render | the click table — including a click during `BUFFERING` calling `pauseVideo`; label and `aria-label` following `onStateChange`, not the click |
| G6 | render | close or unmount without `destroy()`; a player built after close-during-loading |
| G7 | render | the phone tier not closing the card |
| G8 | render | `visibilitychange` → hidden not pausing; `onReady` while hidden calling `playVideo` |
| G9 | source | a hidden or clipped player: the card's class carries none of `opacity-0`, `invisible`, `hidden`, `sr-only`, `pointer-events-none`, `-z-`, `overflow-hidden`; its `fixed` string is a literal `className` (so `sticky-header`'s scan sees it) |
| G10 | source | `InfoTip` back on the Radio button |
| G11 | render | a width that follows state: both label spans and the dot slot rendered in every state |
| G12 | render | the card without the `https://www.youtube.com/t/terms` link |

Existing assertions that stay green **unedited**: `github-stars.test.tsx` (`[aria-label="Radio"]` before
GitHub — idle label kept) · `global-header-mobile-reflow.test.ts` (`<RadioSlot` inside the gated
wrapper, no nested `<div`) · `phone-header-a13.test.tsx` (exactly ONE `setInterval` at header mount — the
radio arms none) · `glossary.test.ts` (≤80 chars, em dash, no terminal period) · every jsdom header render
(the controller reads `window.matchMedia` only through `useIsPhoneTier`, which answers `false` when jsdom
lacks it, and fetches nothing until a click).

## 7 · Browser measurement (S4, local only)

AGENTS.md §9's rules apply (frame width asserted in-page, fonts ready, animation killed for geometry,
values snapshotted before any mutation, stylesheet present) plus: **assert `document.visibilityState ===
"visible"` before reading any audio result** — a CDP tab can report hidden, and G8 would then correctly
pause and look like a bug.

1. Before any click, zero requests to any YouTube host.
2. Chrome 1440×900: click → card visible; iframe box ≥ 516×290; `elementFromPoint` at the iframe's four
   corners and in its bottom 36px control band returns the iframe, **during `loading` and after
   `onReady`**; no card child's rect intersects the iframe's; iframe host `www.youtube-nocookie.com`;
   audio starts; header `On Air`. Screenshot the control bar and inspect it by eye (the cross-origin
   iframe hides its classes from geometry).
3. Second click → paused, `Radio`. Close → no YouTube node left.
4. **Header stability**, signed out and signed in, at 1024 and 860: brand cluster x and the mark's
   computed width — `idle` vs `playing` delta 0.00px; and `idle` vs the pre-change baseline, the one-time
   growth recorded (GlobalHeader's rule: any side-zone growth re-measures the mark).
5. **Occlusion** at 1440×900, 1280×720, 1024×768: list every interactive element under the card on `/`,
   `/m/[slug]` (market arm, and the reply arm with the composer open in the NO column) and
   `/u/[pseudonym]`. Open RULES and the price-chart overlay while playing; record any overlap with their
   content (the chart overlay is not a Radix modal, so the card stays clickable there).
6. Resize to 639 → card closed, nothing playing. Switch tab → paused.
7. Firefox desktop: steps 2–3, and whether `onAutoplayBlocked` fires.

**Owed, not measurable on this machine:** Safari (macOS) and iPadOS Safari at ≥640px — WebKit may treat
`playVideo()` after an async load as un-gestured; the visible player's own play button is the path.

## 8 · D-54 and ADR-0062 (S5) — decision content

**D-54** (`RECORD-v2.12-amendment.md`, the founder's words above): supersedes design-canon DC ruling 5
(R2 self-host) — the radio embeds a YouTube playlist; desktop only; signed-in only; behind
`radio-enabled`; production flip after LEGAL-YT.

**ADR-0062 — YouTube IFrame playlist embed for the header Radio.** Kept, not optional: `RadioSlot`'s own
gate names an ADR, and this is the first third-party script and iframe on participant pages, carrying
legal obligations. It holds the rules no live spec now does (SPEC.1 dropped §21, D-29): visible ≥516×290
player, never obscured, never hidden, never in a background tab; playback only from a click on Radio,
only while visible; nothing loaded before that click; privacy-enhanced host; no backend, key or
dependency; desktop and signed-in only. **Item 8** read explicitly: the video is shown in full, and the
card presents it as a YouTube player with YouTube's controls and a Terms link. "Radio" is the name of the
control, not a claim that the product streams audio; the founder accepts that reading (Q2). Considered
and rejected: the hidden player (busdriverplaylist.in's model — policy); R2 + `<audio>` (the founder chose
YouTube; kept as the fallback if the embed rules ever bite); a plain `<iframe>` with `autoplay=1`
(simpler, but the header could no longer pause and could not truthfully show On Air — the founder asked
for play and pause); a root-layout player that survives the `(auth)` boundary (reopens ADR-0023's
rejection of root-mounted participant chrome, for pages where the radio is off anyway).

The S4 numbers go into its *More Information*.

## 9 · Ambiguity register (chose · rejected · why)

| # | Ambiguity | Chose | Rejected | Why |
|---|---|---|---|---|
| 1 | How the player is controlled | IFrame API | a plain nocookie `<iframe>` | play **and pause** from the button was the ask; the plain iframe cannot pause or report state |
| 2 | Card tier | `z-60`, above modals | `z-50` (DOM order decides) | a modal scrim over the playing player is *"a visual element in front of"* it. Cost: at 1024–1280 wide the card can overlap the RULES deck's lower right. S4 measures it |
| 3 | Where the card renders | portal to `body` | inside the header | the sticky `z-40` header is a stacking context; nothing inside can rise above a `z-50` overlay |
| 4 | Tab in background | pause, no auto-resume | keep playing | item 9's literal text (*"tab … that the user is viewing"*); also ends multi-tab playback. **Founder may overrule (Q4)** |
| 5 | Who can play | signed-in viewers | everyone | §III.A.2 — agreement to a privacy policy before access. **Founder may overrule (Q5)** |
| 6 | Production switch | `radio-enabled`, default off | ship live at merge | LEGAL-YT is critical-path and separate; the flag decouples merge from legal |
| 7 | Player size | 516×290 | 384×216 | YouTube's small-mode threshold (480 / 290) |
| 8 | Unplayable videos | no auto-skip; `loop: 1` in playerVars | `onError` → `nextVideo()` + a counter | Q1 requires every video to allow embedding; the visible player has its own next button; skip + loop could spin |
| 9 | When to load the API | on click | on hover or idle | nothing touches YouTube for a visitor who never asks |
| 10 | Gloss | `title=` | `InfoTip` | the touch double-action defect |
| 11 | Accessible name | follows the visible label, no `aria-pressed` | fixed `Radio` + `aria-pressed` | WCAG 2.5.3 and the APG toggle rule |
| 12 | Button width | both labels stacked, dot slot reserved | swap the text | play/pause must not move the header |
| 13 | Autoplay blocked | no special state | a hint line | YouTube draws its own play button; a hint needs copy |
| 14 | Escape to close | none | a keydown handler | keys inside the cross-origin iframe never reach the page; the close button already takes Enter/Space; a handler on a static `div` fails Biome's `noStaticElementInteractions` |

## Open questions

- **Q1 — the playlist.** Which playlist? Founder content, never invented. Supply the `PL…` ID from the
  URL. Public or unlisted, and every video must allow embedding. **Blocks S4 and the merge.**
- **Q2 — legal (LEGAL-YT).** The ToS and privacy wording in §3, and acceptance of the item 8 reading in
  §8. Founder / lawyer. **Blocks the production flag flip**, not the merge.
- **Q3 — copy.** Candidates: signed-in gloss `Radio — play the Zugzwang playlist`; signed-out gloss
  `Radio — sign in to listen`; card title `Radio`; close `aria-label` `Close radio`; terms link
  `YouTube Terms`; error line `Radio unavailable — try again`. Founder ruling (glossary.ts). **Blocks the
  merge.**
- **Q4 — background tab.** Pause (chosen) or keep playing? Keep-playing needs the ruling to quote item 9
  verbatim and accept the risk.
- **Q5 — signed-out visitors.** Signed-in only (chosen) or everyone? Everyone needs the §III.A.2 risk
  accepted in writing.

## Self-critique

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Medium | the card (~540×340) covers the lower right of every page; on `/m/[slug]` that is part of the NO column, and closing the card stops the music | S4 step 5 lists what is covered; placement is revisited with the numbers |
| 2 | Medium | Safari / iPadOS first play may need a tap on the player | YouTube's own play button; owed device check |
| 3 | Low | music stops at the `(public)`↔`(auth)` boundary and on reload | accepted; the radio is off on `(auth)` anyway |
| 4 | Low | `z-60` sits over modal content at laptop widths | ambiguity #2; measured in S4 |
| 5 | Low | the `host` option is undocumented | G4 pins it; if YouTube drops it the player falls back to `www.youtube.com` and still plays |
| 6 | Low | the header grows once (dot slot, `ON AIR`) | measured against the mark in S4 step 4 |

## References

`src/components/shell/RadioSlot.tsx` · `docs/design/design-canon.md` (the W2.14 row; DC ruling 5;
C-CHART-2 clause 7) · `docs/design/mockups/DESIGN_W2_4-5-14_global-header_CLOSE-OUT.md` (§5 "Radio
(W2.14 — placeholder)"; the synth-wave and reduced-motion bullets; the copy table's Radio row;
carry-forwards 5 and 6) · deleted SPEC.1 §21.5 (`e193cfb:docs/specs/SPEC.1.md`) ·
`src/app/(auth)/_components/TurnstileWidget.tsx` · ADR-0052 (`useFlag` kill switches) ·
`docs/parked.md` 3a-1 (the phone row's 2.40px deficit; ADR-0051 A13 D-1 rules the phone row) ·
developers.google.com/youtube: iframe_api_reference · player_parameters · terms/developer-policies ·
terms/required-minimum-functionality (all fetched 2026-09-26) · busdriverplaylist.in chunk
`355al6f0mlh9b.js` (scratchpad copy).
