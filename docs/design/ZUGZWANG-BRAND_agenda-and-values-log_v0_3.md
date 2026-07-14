# ZUGZWANG — BRAND · agenda & values log · v0.3

**Status:** CLOSED — DESIGN.B1 complete (short close; re-scopes named, nothing silently dropped)
**Date:** 2026-07-14 · Session 2 (continues v0.2 / session 1, 2026-07-13)
**Supersedes:** ZUGZWANG-BRAND_agenda-and-values-log_v0_2.md
**Lane:** design-only (operator + web Claude as prompt-author; Claude Design as executor; no repo commits)

---

## 0. Close state

**DESIGN.B1 closes at this file.** The bridge (token swap + contract amendment, code lane) is **OPEN** and can start immediately. The CD system is published, dark-themed, true-neutral, with poles, states, elevation, and the brand cluster resolved; the full resolved state is captured **verbatim** in §3.

**Exit criterion vs actual:**

| Criterion | Status |
|---|---|
| Published CD system reflects the finished brand | ✅ core system done; assets partially deferred (below) |
| Validated on Discovery + market card + reply view | ✅ operator-validated through the session |
| Validated on the pop-up | ➜ SUPERSEDED — pop-up is being redesigned in its own CD chat; validating the old one is moot |
| Graph shows YES and NO as unmistakably different lines | ✅ YES `#737373` · NO `#FAFAFA` |
| Brand assets exist | ◐ mark + header cluster exist; **favicon · OG · verified badge deferred** to the deck chat tail (ruling 3a) |
| CD resolved values captured verbatim | ✅ §3 |

**Re-scoped OUT — named follow-ups, not dropped:**
1. **Pop-up redesign** — own CD chat. Canon reopen. **Ruling 1a:** that chat ends with a close-out .md which becomes the new locked pop-up anatomy (CD stays a sketchpad; Path B intact).
2. **Onboarding deck edit + rules frames (5 cards: 4 rules + 1 goal) + favicon/OG/verified badge** — one CD chat (rulings 2a, 3a); assets at its tail. Same W2.1 deck shell, one illustration language.
3. **W2.9 market-media** — was never designed; still blocks Path B for that surface; unchanged from kickoff NOT-DOING.

---

## 1. Session-2 landings (chronological, all ratified by operator on-screen)

1. **O1 · Two-line price graph fixed** (WI-3 closed): NO = solid `#FAFAFA` (retuned from `#FFFFFF`), YES = solid `#737373` grey stand-in (black pole can't render on dark — exact mirror of the light era's grey-for-NO). All three renders: full-size, sparkline, hero. Series-bound, not draw-order-bound.
2. **O2 · Side chips verified clean** (WI-4 closed): bindings correct, black chip separates via border, bar reads, thumbs placed right.
3. **Thumb-down glyph** → FILLED solid `#FAFAFA`, no stroke, everywhere it renders as the NO side marker. Thumb-up stays stroked currentColor.
4. **Engaged-slot backlight** (replaces the first-pass chip glow, which was reverted): `0 0 10px 1px rgba(255,255,255,0.2)` on the engaged side's own slot (MDSlot / RVColumn) while the composer is open opposite. Interaction signal, not elevation. Composer chips restored to pre-glow rendering.
5. **O4 · Interactive states** defined system-wide (full table in §3 item 3). Support/Counter pills initially got no states (fill-change ban read as no-state); fixed with glow-only states: hover `0 0 8px 1px rgba(255,255,255,0.25)` · pressed `0 0 4px 1px rgba(255,255,255,0.4)` · system focus ring · disabled 0.5.
6. **Geometry deltas — market-detail slot header** (ratified through 3 iterations; supersedes the locked mockup's pixel values for these elements): band padding `8px 14px` · Đ BET / Sell = outline sm, 13px, padding `7px 14px`, minHeight **34** (pinned to the Research button height) · price cluster **19px** (word 600 / percent 800), thumb **16px**, 5px gap.
7. **Header brand cluster** (reinstates the removed ⧗ cluster; W2.4 micro-format superseded — see §2): mark `zugzwang-mark.svg` at 48×48 · 10px gap · 2×8 chessboard grid, 20×20 cells, outer 1px `#404040`, no internal borders · row 1 `Z U G Z W A N G` Geist 13/800 · row 2 `45:06:15` Geist Mono 13/700, digits-only · fills alternate `#212121`/`#FAFAFA`, top-left dark, text inverts per cell · one click target → Discovery · absolutely centred in the 60px band. Unit subscripts and `TO FREEZE` label trialled and **removed** (ratified).
8. **Pole VALUE retune** (locked binding untouched — BLACK = YES, WHITE = NO everywhere): `--color-yes #181818` · `--color-no #FAFAFA`. Applied to chips, column pills, Support/Counter pills, both split bars, graph NO line, thumb glyphs. **Black-pill exception:** black-filled Support/Counter pill takes **0.5px** solid `#404040` (white pill keeps 1px). Ground-colour collision (YES segment ≡ ground on the price bar) **accepted** by operator — carried by adjacency + track edge.
9. **Reply-view column-header clusters** matched to market: PriceTag 19 / thumb 16, minHeight 48, padding `12px 14px`.
10. **O3 · Elevation** — tiers 0–3 defined (values §3 item 4) and made **homogeneous**: 9 resting panels that lacked tier 1 were closed (Sparkline wrapper; Discovery HeroPost card + hero market panel; ReplyView post-focus header; Profile 6-tile stats, positions panel, argument replica; MarketDetail resolver + X info cards). Boundary call logged: inset n1 wells, chips, buttons, inputs, table rows, bars = tier 0.
11. **O6 · PFP resolved:** avatar art is **pipeline-owned, not CD** — ADR-0011 specs the full pre-launch ComfyUI/Flux run (DGX Spark, `<Colour><Animal><Number>` composited, R2, FIFO). Empty square in CD is the correct current state. Nothing to fix, nothing to import.

---

## 2. Ratified reopens & deviations (each explicit, operator-ratified)

| # | What | Old | New | Downstream |
|---|---|---|---|---|
| R-1 | **Pole values** (token-contract §3.1 lock reopened; binding NOT reopened) | `oklch(0.145 0 0)` / `oklch(1 0 0)` | `#181818` / `#FAFAFA` | WI-10: contract §3.1 + CI exact-string pins amended in the same commit as the swap |
| R-2 | **W2.4 timer micro-format** | `45d : 06h : 15m` bare, beneath wordmark | digits-only `45:06:15` inside the 8-cell chessboard; units + `TO FREEZE` label removed | Build implements live countdown to Nov 5 23:59 UTC in this grid format |
| R-3 | **Wordmark form** | type-only `ZUGZWANG` .16em | mark + 2×8 letter/countdown chessboard lockup | S7 resolved; share-card "Zugzwang Verified" lockup may now shorten (W2.13 note) |
| R-4 | **White-as-chrome in the header** | black/white reserved for side encoding only | `#FAFAFA` cells in the brand cluster | Deliberate, header-only; poles unaffected |
| R-5 | **Slot-header geometry** | locked mockup px | §1 item 6 values | CC builds these elements from log values, not mockup px |
| R-6 | **Đ BET / Sell no longer bespoke-sized** | mockup-specific | pinned to standard button sm + minHeight 34 (= header controls) | one button system |

---

## 3. THE DUMP — CD resolved state, verbatim (2026-07-14, session close)

> Captured exactly as reported by Claude Design. This section is the bridge's source of truth.

State report — Zugzwang Design System, resolved as of this turn.

### 1. tokens/colors.css — full contents, verbatim

```css
/* ============================================================================
   Zugzwang — color tokens. DARK THEME, TRUE-NEUTRAL (2026-07 pass: the
   cool-slate cast (hue ≈278) is removed — every neutral is chroma-0, R=G=B).
   Ground #181818 (given), surface #212121 (given), border #404040 (given).
   The ramp runs DARK → LIGHT: n0 = base surface (panels), ink = primary
   text. Roles per step are unchanged. NO accent colour exists — every
   value is a true neutral (chroma 0); grey stands in wherever an accent
   would go. Never invent one. Hex is authoritative; oklch in comments.
   ========================================================================== */
:root {
	/* --- Tier 1 · ground + neutral ramp (9 steps, chroma 0) --- */
	--color-ground: #181818; /* GIVEN anchor — app ground · oklch(0.209 0 0) */
	--color-n0: #212121; /* GIVEN anchor — base surface: cards, panels, bars, popovers, modals, inputs, nav · oklch(0.248 0 0) */
	--color-n1: #2A2A2A; /* inset wash: placeholders, hovers, avatar fill · oklch(0.285 0 0) */
	--color-n2: #404040; /* GIVEN anchor — THE border. One treatment: 1px solid, everywhere · oklch(0.372 0 0) */
	--color-n3: #545454; /* meta separators, strong rules · oklch(0.446 0 0) */
	--color-n4: #747474; /* placeholder/disabled text, focus ring · oklch(0.559 0 0) */
	--color-n5: #989898; /* meta text · oklch(0.680 0 0) */
	--color-n6: #BDBDBD; /* body/secondary text · oklch(0.799 0 0) */
	--color-n7: #E4E4E4; /* strong text · oklch(0.919 0 0) */
	--color-ink: #FAFAFA; /* primary text/emphasis · oklch(0.985 0 0) */

	/* --- Side poles — LOCKED binding, permanent, semantic. Encode SIDE only
	       (frozen at post-time, INV-3) — never Support/Counter, never a
	       Support/Counter repaint. BLACK = YES, WHITE = NO on every element.
	       2026-07 retune: the pole VALUES moved onto the neutral anchors —
	       black pole #181818 (≡ ground), white pole #FAFAFA (≡ ink). Pole
	       edges are carried by the standard #404040 border everywhere (the
	       old 1px-ink pole hairline is RETIRED; --pole-hairline now aliases
	       the n2 border for compat). --- */
	--color-yes: #181818; /* YES = pole black · oklch(0.209 0 0) */
	--color-no: #FAFAFA; /* NO = pole white · oklch(0.985 0 0) */
	--pole-hairline: 1px solid var(--color-n2); /* RETIRED alias — ≡ --hairline; kept for compat */

	/* --- Tier 2 · semantic aliases (shadcn layer, roles as built) --- */
	--background: var(--color-ground);
	--foreground: var(--color-ink);
	--card: var(--color-n0);
	--card-foreground: var(--color-ink);
	--popover: var(--color-n0);
	--popover-foreground: var(--color-ink);
	--primary: var(--color-n7);
	--primary-foreground: var(--color-ground);
	--secondary: var(--color-n1);
	--secondary-foreground: var(--color-n7);
	--muted: var(--color-n1);
	--muted-foreground: var(--color-n5);
	--accent: var(--color-n1); /* NOT a brand accent — a neutral wash; the accent slot is deliberately empty until the brand pass */
	--accent-foreground: var(--color-n7);
	/* Repo carries stock shadcn red here; it never surfaces on designed
	   surfaces (errors render monochrome — W2.11 state kit). Neutralized. */
	--destructive: var(--color-n6);
	--border: var(--color-n2);
	--input: var(--color-n2);
	--ring: var(--color-n4);
	--chart-1: var(--color-n7);
	--chart-2: var(--color-n5);
	--chart-3: var(--color-n4);
	--chart-4: var(--color-n3);
	--chart-5: var(--color-n2);

	/* --- Applied semantics (roles from the locked v1.0 surfaces) --- */
	--surface-page: var(--color-ground); /* true-neutral near-black — never warm, never tinted */
	--surface-inset: var(--color-n1); /* image placeholders, avatar fill, hover wash */
	--btn-fill: var(--color-ground); /* button interior OUTSIDE the header — recessed into the #212121 panel */
	--text-primary: var(--color-ink);
	--text-body: var(--color-n6);
	--text-meta: var(--color-n5);
	--text-faint: var(--color-n4); /* placeholders, disabled */
	--border-strong: var(--color-n2); /* unified 2026-07 — the old ink emphasis border is retired; kept as an alias */
	--overlay: rgb(10 10 10 / 0.6); /* modal scrim — true neutral */
	--graph-yes: #737373; /* two-line graph: YES = solid mid-grey stand-in (black can't render on the dark ground — the exact mirror of the light era's grey-for-NO). Off-ramp on purpose: darker than n5 so the two lines separate clearly. */
	--graph-no: #FAFAFA; /* NO = solid pole white (≡ --color-no), renderable on dark */

	/* --- Interactive states (2026-07 state pass). TRUE NEUTRALS ONLY —
	       every state is a greyscale fill/border shift or a white-alpha
	       ring/glow. Resting values never change: ground #181818, panels
	       #212121, buttons #181818, borders 1px #404040. States LAYER on top.
	       Focus ≠ hover: focus is always the hard 2px light ring; hover is a
	       fill/border shift (or soft glow on pole-coded elements).
	       POLE-CODED elements (side chips, Support/Counter pills) never
	       change fill in any state — ring/glow/border shifts only. --- */
	--state-hover-fill: var(--color-n1); /* hover wash on recessed fills · #2A2A2A */
	--state-pressed-fill: #333333; /* pressed fill — minted mid-step n1→n2, chroma 0 · oklch(0.315 0 0) */
	--state-hover-border: var(--color-n3); /* hover border shift on inputs · #545454 */
	--state-focus-ring: 0 0 0 2px rgb(255 255 255 / 0.32); /* THE focus ring — hard 2px, white-alpha */
	--state-focus-ring-pole: 0 0 0 2px var(--color-n0), 0 0 0 4px rgb(255 255 255 / 0.32); /* pole-safe: n0 gap so the ring reads on white fills */
	--state-hover-glow-pole: 0 0 8px 0 rgb(255 255 255 / 0.22); /* pole hover — soft glow, fill untouched */
	--state-pressed-glow-pole: 0 0 8px 2px rgb(255 255 255 / 0.34); /* pole pressed — stronger glow */
	--state-disabled-opacity: 0.5; /* @kind other */ /* non-pole disabled dim; pole-coded disabled dims border/label only (fills stay black/white) */

	/* --- Resting elevation (2026-07 elevation pass). TRUE NEUTRALS ONLY —
	       pure-black shadows + a pure-white top rim (inset 1px). Elevation
	       never changes a surface fill (ground #181818, surfaces #212121),
	       never a border (1px #404040), and never moves on hover/press —
	       interaction states are a separate system. The engaged-slot
	       backlight is an interaction signal, NOT an elevation tier. --- */
	--elev-0: none; /* @kind shadow */ /* tier 0 — flush content on the ground */
	--elev-1: inset 0 1px 0 rgb(255 255 255 / 0.04), 0 1px 2px rgb(0 0 0 / 0.4); /* @kind shadow */ /* tier 1 — EVERY bordered card/panel at rest: market/post/reply cards, pole slots, hero panels, graph panels, info tiles, the top bar. Inset n1 wells, chips, buttons, inputs stay tier 0 */
	--elev-2: inset 0 1px 0 rgb(255 255 255 / 0.06), 0 2px 4px rgb(0 0 0 / 0.4), 0 6px 16px rgb(0 0 0 / 0.5); /* @kind shadow */ /* tier 2 — floating: popovers, dropdowns (debate mode selector), toasts */
	--elev-3: inset 0 1px 0 rgb(255 255 255 / 0.08), 0 4px 12px rgb(0 0 0 / 0.45), 0 16px 40px rgb(0 0 0 / 0.6); /* @kind shadow */ /* tier 3 — the modal layer (post pop-up dialog; its backdrop is untouched) */
}
```

### 2. Resolved base values

Radii: `--radius 0.625rem` (shadcn base) · `--r 8px` (cards, panels, buttons, bars, inputs) · `--imgr 6px` (images, avatars, media, graph panels) · `--r-chip 4px` (card-scoped side chips) · `--r-dot 3px` (carousel active-dot pill).

Borders: `--hairline` = 1px solid `#404040` — the one treatment on buttons, cards, panels, inputs, chips, modals, bars, pole elements. `--border-emphasis` and `--pole-hairline` are retired aliases of it. `--avatar-ring` = 1px solid `#404040`. Exception: the black (YES-pole) Support/Counter pill takes **0.5px** solid `#404040`.

Fonts: `--font-sans` "Geist" (variable 100–900; CSS comment says "declared placeholder — final family undecided" — **STALE**, see WI-13: Geist + Lucide were RATIFIED final in session 1), fallback -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif. `--font-mono` "Geist Mono" (variable 100–900). `--font-heading` ≡ `--font-sans` (one-sans rule). Body default: 13px Geist on `#181818`, antialiased.

Weights: body 400 · button/price 600 · name 650 · title 700 · heavy 750 · black 800.

Type scale (px, exact): nano 8 · micro 8.5 · label 9.5 · tiny 10.5 · caption 11 · small 11.5 · body 13 · title 14 · lead 15 · h3 17 · h2 19 · num 22 · h1 24. Tracking: wordmark 0.16em · label 0.14em · micro 0.12em · chip 0.1em · loose 0.05em · body 0.01em. Leading: tight 1.15 · title 1.35 · body 1.45 · copy 1.55.

Icons: Lucide paths verbatim (the codebase's lucide-react set) plus locked mockup glyphs (thumbs, radio bars). Monochrome stroke, currentColor, default size 14px, strokeWidth 1.5. Sizes in use: 13 (quiet icons), 14 (radio), 15 (header buttons, profile icons), 16 (slot-header thumbs). Thumb glyph: custom 14×14 viewBox path, strokeWidth 1.1; thumb-down = same path rotated 180°, rendered FILLED solid `#FAFAFA` with no stroke (the NO marker); thumb-up stroked currentColor. Never emoji.

### 3. Interactive states

Buttons (one unified treatment — header included): rest `#181818` interior (`--btn-fill`), 1px `#404040`, `--r`, ink text, 13/600/.01em (sm 11px 5px 10px · md 13px 9px 18px · lg 13px 11px 22px). Hover: fill → `#2A2A2A` (quiet variant also label n5 → ink). Pressed: fill → `#333333`. Focus: `0 0 0 2px rgb(255 255 255 / 0.32)`. Disabled: opacity 0.5, no pointer. primary/outline render identically; quiet = n5 label at rest.

Header icon buttons (34×34 `--bar-block`): rest `--btn-fill` + 1px `#404040`. Hover: border → 1px solid `#747474` (`--ring`), fill unchanged. Pressed: fill → `#333333`. Focus: the 2px light ring. Icon 15px ink.

Quiet icons (bookmark/download, ArgProfile): rest n4, no border, 2px padding, 4px radius. Hover: color → ink. Pressed: background → `#333333`. Focus: the 2px light ring.

Text inputs / textarea: rest n0 fill, 1px `#404040`, 10px 12px pad, 13px. Hover: border → 1px solid `#545454`. Focus: border → 1px solid `#747474` + the 2px light ring. Disabled: opacity 0.5, no pointer. Label 9.5/700/.12em uppercase n5 with "— required" / "· optional" and n4 counter.

Amount input: borderless, transparent, 22/800 tabular right-aligned, 4px radius. Focus: the 2px light ring. Disabled: opacity 0.5 (whole row). Over-cap: value text → n4.

Tabs / toggles / category chips (SegmentedToggle): rest n0 + n5 text, 10/800/.1em uppercase, 7px 14px, segments split by internal hairlines. Selected: ink fill + n0 text. Hover: `#2A2A2A` wash + ink text. Pressed: `#333333`. Focus: INSET `0 0 0 2px rgb(255 255 255 / 0.32)` (row clips). Disabled: whole control opacity 0.5.

Cards-as-links (MarketCard): rest hairline + elev-1. Hover or active/selected: border → 1px solid `#747474`. Pressed: border → 1px solid `#989898`. Focus: the 2px light ring layered over elev-1. Disabled: opacity 0.5, no pointer.

Support/Counter pills: pole fill/text/border NEVER change. Hover: `0 0 8px 1px rgba(255,255,255,0.25)`. Pressed: `0 0 4px 1px rgba(255,255,255,0.4)`. Focus: `0 0 0 2px rgb(255 255 255 / 0.32)`. Disabled: opacity 0.5, default cursor, no pointer events.

Composer side chips (SideChip with onClick): pole fills never change. Hover: `0 0 8px 0 rgb(255 255 255 / 0.22)`. Pressed: `0 0 8px 2px rgb(255 255 255 / 0.34)`. Focus: `0 0 0 2px #212121, 0 0 0 4px rgb(255 255 255 / 0.32)` (offset ring). Disabled: label only dims — YES label → n5, NO label → n3; fills stay black/white, border stays `#404040`. `selected` is semantic only — no chip-level treatment; the engaged signal is the slot backlight.

All state transitions: 0.12s ease (`--dur-hover`).

### 4. Elevation tiers

Tier 0 — none. Flush content on the ground; inset n1 wells (image/media placeholders, avatar fill), chips, buttons, inputs, table rows, bars, the Banner strip, EmptyState.
Tier 1 — `inset 0 1px 0 rgb(255 255 255 / 0.04), 0 1px 2px rgb(0 0 0 / 0.4)`. Every bordered card/panel at rest: market cards, ArgCards, pole slots, composer panels, hero post + hero market panels, reply focus header, profile tiles, positions panel, argument replica, Sparkline graph panels, the top bar.
Tier 2 — `inset 0 1px 0 rgb(255 255 255 / 0.06), 0 2px 4px rgb(0 0 0 / 0.4), 0 6px 16px rgb(0 0 0 / 0.5)`. Popovers, dropdowns (debate mode selector), toasts. No live component consumes it yet.
Tier 3 — `inset 0 1px 0 rgb(255 255 255 / 0.08), 0 4px 12px rgb(0 0 0 / 0.45), 0 16px 40px rgb(0 0 0 / 0.6)`. The ConfirmModal dialog. Backdrop stays `--overlay rgb(10 10 10 / 0.6)`, untouched.

### 5. Component specs set this session

Header brand cluster: mark `zugzwang-mark.svg` at 48×48 · 10px gap · 2×8 chessboard grid, 20×20px cells, outer 1px solid `#404040`, no internal borders · row 1 = Z U G Z W A N G, Geist 13px/800 uppercase · row 2 = 45:06:15 countdown, Geist Mono 13px/700, dead-centred per cell · fills alternate `#212121`/`#FAFAFA` in chessboard parity, top-left `#212121`, text inverts per cell · the whole cluster is one role="link" click target → Discovery, absolutely centred in the 60px band.

Market-detail slot header: band padding 8px 14px, hairline bottom border. Đ BET / Sell: Button outline sm with fontSize 13px, padding 7px 14px, minHeight 34. Price cluster: PriceTag size 19 (word 19/600, percent 19/800), thumb 16px, 5px gap, vertically centred. To win / Your position: 8px/800/.14em uppercase n4 label over 11.5px/700 tabular value.

Reply-view column header: same cluster — PriceTag size 19, thumbSize 16 — centred, minHeight 48, padding 12px 14px, hairline bottom border; row grows to fit.

Engaged-slot backlight: `0 0 10px 1px rgba(255,255,255,0.2)`, layered over `var(--elev-1)`. Interaction signal only.

Support/Counter glows: hover `0 0 8px 1px rgba(255,255,255,0.25)` · pressed `0 0 4px 1px rgba(255,255,255,0.4)`.

Poles: `--color-yes #181818` (BLACK = YES) · `--color-no #FAFAFA` (WHITE = NO), everywhere: side-chip fills (YES black/white text, NO white/black text) · Support/Counter pills coloured by the RESULTING bet side (Support inherits the post's side, Counter the opposite) · stake-bar segments (left = Support share in the Support side's pole colour, right = Counter's; 1px `#404040` frame) · split bar (YES share pole black anchored left, remainder pole white) · graph lines `--graph-yes #737373` (grey stand-in, black can't render on dark) / `--graph-no #FAFAFA` · thumb glyphs (thumb-down filled `#FAFAFA` as the NO marker; thumb-up stroked currentColor).

Black-pill exception: a Support/Counter pill with the black (YES) fill takes 0.5px solid `#404040`; the white pill takes the standard 1px.

### 6. Other values resolved this session, not covered above

`var(--elev-1)` added to nine resting panels that lacked it: the Sparkline component wrapper; Discovery HeroPost card and hero market panel; ReplyView post-focus header panel; Profile's six-tile stat cards, positions-list panel, and argument-replica panel; MarketDetail's resolver and X info cards. Identical value, no other property touched.
The `--elev-1` token comment reworded to name the full tier-1 class (shown verbatim in item 1).
Nothing else was minted or defaulted; all other values above were already in the published files at session start.

*(end of verbatim dump)*

---

## 4. Frozen / waived — conscious, named (no silent narrowing)

| Item | Status | Why safe |
|---|---|---|
| Reply-view "← question" back-line (CD-only artifact) | Ruled for removal, **never executed**, frozen | Build never sees it; shell has no such element |
| Reply-card stake single-amounts vs delta grammar (Δ2) | Waived in CD | Shell anatomy carries `Đ a → Đ b`; build renders from shell |
| Composer side-selector white-fill vs `#FAFAFA` NO pole (near-pole read) | Observation logged, no re-treat | `selected` is semantic-only per states table; engaged signal is the slot backlight |
| Reply/profile layout parity in CD (media block, three-zone alignment, Sell placement, per-row Sells, `(+Đx)` deltas) | Never CD's job | Shell owns layout; build inherits |
| Elevation tier 2 | Defined, unconsumed in CD | Build wires popovers/dropdowns/toasts to `--elev-2` |

---

## 5. Work-item ledger — the bridge

Carried from v0.2, updated; new items minted this session.

- **WI-1 — pole aliases booby-trapped · RESOLVED IN CD, LANDS AT BRIDGE.** CD now holds `--color-yes`/`--color-no` as **literals**, exactly as the bridge requires. Bridge action: `tokens.json` stops pointing `side.*` at `{primitive.neutral.*}`; repo literals = the R-1 values.
- **WI-2 — `ground` has no contract slot.** Unchanged. Contract amendment; name must not match `n[0-7]` (it doesn't — census safe).
- **WI-3 — graph.** ✅ CLOSED (§1 item 1). New tokens `--graph-yes`/`--graph-no` need contract slots (fold into WI-11).
- **WI-4 — side-chip legibility.** ✅ CLOSED (verified clean).
- **WI-5 — comment-media behaviour** (repo clips at `--imgmax: 160px` + expand; CD shows whole). Unchanged — reconcile at build; shell rule wins unless operator re-rules.
- **WI-6 — CI pin amended in the same commit as the swap.** Both retuned poles are chroma 0 → the 11-token chroma census **survives**; the two exact-string pins (`--color-yes`, `--color-no`) change. Verify against §3 item 1.
- **WI-7 — `.dark` vs `:root` ruling.** Unchanged, decide at bridge. Note: CD's dump is written under `:root`.
- **WI-8 — canon docs amended at the bridge, same-commit:** design-language (§1.9 white ground → dark; §3.2 graph rule gains the dark-ground mirror), design-canon (monochrome framing), token-contract §3.1/§3.4. Add: W2.4 timer micro-format (R-2), slot-header geometry (R-5).
- **WI-9 — canvas-edit discipline.** One further canvas edit occurred this session (slot-header sizing sketch + one open Edit panel observed); both discarded per protocol. No saved canvas edits.
- **WI-10 (new) — pole VALUE retune** (R-1): contract §3.1 lock text + CI exact-string pins → `#181818`/`#FAFAFA` (or oklch equivalents), same commit as the swap.
- **WI-11 (new) — contract surface grew.** New tokens minted in CD with no contract slots; reconcile the FULL §3 item 1 file against design-token-contract v0.3 at the bridge. Checklist: `--elev-0..3` · `--state-*` (8 tokens incl. minted `#333333` pressed step) · `--graph-yes/no` · `--overlay` · `--r-chip`/`--r-dot` · retired aliases (`--pole-hairline`, `--border-emphasis`) recorded as retired · `--destructive` neutralized to n6 (repo stock shadcn red must be neutralized at swap) · `--chart-*` retained but graph consumes `--graph-*` (map or note).
- **WI-12 (new) — brand asset files.** `zugzwang-mark.svg` must land in the repo (brand/ per the handover package structure); favicon/OG/verified badge derive in the deck-chat follow-up. Both black-square and transparent SVG variants exist operator-side.
- **WI-13 (new) — stale font comment.** CSS says Geist is a "placeholder — final family undecided"; **Geist + Lucide were ratified FINAL in session 1.** Fix the comment at the bridge; no value change.

---

## 6. Build-lane rulings recorded this session (no CD action; to tracker/spec lane at bridge)

1. **Reply-page position strip** (operator-ruled a·a·a): the reply view's column headers gain the market grammar **minus action buttons** — `TO WIN Đ1 → Đx` left · price cluster centre · `YOUR POSITION Đa → Đb` / `NO ACTIVE POSITION` right. **No Đ BET / Sell buttons on the debate surface.** The held-side readout keeps its W2.10-C behaviour: click → Profile (where Sell lives). TO WIN renders on **both** columns always (market context, not position context).
2. **H2-scrub avatar render:** scrubbed users (pseudonym → placeholder, PFP unset per SPEC.1) need a defined scrubbed-avatar visual at build. One-line brand ruling owed when the surface is built.
3. **PFP pipeline** (ADR-0011) remains a separate pre-launch task — DGX Spark run, R2 upload, pool population.

---

## 7. Next

1. **Bridge (code lane, opens now):** token swap from §3 + contract amendments (WI-1/2/6/7/8/10/11/13) + mark SVG commit (WI-12), same-commit doctrine per CLAUDE.md. Unblocks per-surface builds (Discovery, Market Detail, Reply, Profile) immediately.
2. **CD chat A — pop-up redesign** (canon reopen; ends with close-out .md = new locked anatomy).
3. **CD chat B — onboarding deck edit + rules 5 frames + favicon/OG/verified badge at tail.**
4. Chats A/B run in parallel with the bridge; only the pop-up surface and onboarding/rules gate on them.
