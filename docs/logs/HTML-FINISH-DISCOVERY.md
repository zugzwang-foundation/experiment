# HTML-FINISH · DISCOVERY · PARITY — session log

**Branch** `htmlfinish/discovery-parity` · **base** `b7c2a380cb465e4905dc7ccbd98d24c0f497663d`
**Ran unsupervised**, 2026-08-15. Plan authored before any JSX: `~/Downloads/HF-DISCOVERY-PLAN.md`.
⛔ **DO NOT MERGE** — a human reads the diff.

---

## What landed

Three implementation commits + this one. 12 files, **all inside the §2 allow-list; zero outside**.

| Commit | Rows | Files |
|---|---|---|
| `08e138b` | **C1 · THE GRID** — 1, 4, 5 | `MarketCard.tsx` · `DiscoveryGrid.tsx` + 4 test files |
| `bb080da` | **C2 · THE HERO PANELS** — 2, 6, 7 | `HeroPanels.tsx` + 2 test files |
| `7ec0cc9` | **C3 · THE HEIGHT CHAIN** — 8, 9 | `layout.tsx` *(fenced)* · `page.tsx` · `DiscoveryCarousel.tsx` · `DiscoveryGrid.tsx` · `HeroPanels.tsx` + 1 test file |
| *this* | **C4 · GUARD + DOCS** — 10 | `POLISH-register.md` (PD-2-35) · this log |

Per-row outcome: **9 implemented · 1 struck (row 3) · 0 halted · 0 anchors lost.**

---

## Decisions made

**1 · The recon was stale in its premise, not its content.** The kickoff warned line numbers had
moved under PR #333. They had not: `git diff --stat 9be5d1c b7c2a38` shows #333 touched 15 files and
**not one is a Discovery file**. All ten anchors re-resolved at their recorded coordinates. Verified
by opening each file, not by trusting the diffstat.

**2 · Row 4 moved two guard hooks. Both carried; neither dropped.**
- `emphasis-ladder-tokens` CONSUMERS census re-pointed `DiscoveryGrid.tsx` → `MarketCard.tsx`. A
  **census update, not a weakening** — the block documents itself as *"re-measured at this commit's
  head"*, and every assertion is preserved: exact count 1, literal still banned, whole-tree
  `the-literals-survive-nowhere-in-src` scan untouched and still reaching the new file.
- `data-testid="grid-ring"` is **retired, not dropped**. Its element no longer exists and the tile
  that replaces it already carries `data-testid="market-card"` (one element, one testid). Every
  guarantee is carried verbatim into `expectActive`.

  > ⚠ **CORRECTED at Gate C (finding M-2) — the original ground stated here was WRONG.** This entry
  > first claimed the old form "could pass with the outline on a different box from the `data-active`
  > attribute." **It could not.** In the old code both the attribute and the outline class were on the
  > *same* `grid-ring` wrapper, and the old assertion read the outline off the element it had just
  > selected by that attribute — so the two could not diverge. **What actually improved** is narrower
  > and worth stating accurately: the ring is now provably **on the TILE**, which is the thing row 4
  > exists to establish; previously the assertion proved only that *some wrapper* was ringed, and said
  > nothing about the tile's own relationship to it. Two of the assertions removed in that edit were
  > exact duplicates of the two lines immediately above them, not a loss of coverage.
  > **The change is right; the ground I gave for it was not, and a wrong ground gets inherited.**

**3 · Row 2's colour and glyph provenance.** `text-n3` on the row-6 separator is taken from
**shipped code** — `StatLine.tsx` already ships `<span className="… text-n3">|</span>` for this exact
glyph in this exact role ("V27 — an explicit n3 separator"). The mockup's `.vsep{color:var(--n3)}` is
**not** the source: the ramps are inverted and name-porting across them is the failure `side-pole-
binding` and V7/V42 exist to prevent.

**4 · Canon §3 item 6, quoted as instructed and not re-litigated:** *"**Pick / carousel-select is
view-only** — never mutates a position."* It governs **position mutation**. Navigating to `/m/[slug]`
mutates nothing.

**5 · Row 2 built as a real `<Link>`, not a stretched link.** The side panels' `after:inset-0`
workaround exists **only** because those panels contain a second, independent author anchor and
anchors cannot nest. The market panel contains none — thumb, `<h2>`, `StatLine`, `PriceSparkline`,
`PriceBar` all grepped anchor-free — so the simple whole-element form is available and used, matching
`MarketCard`. The side panels are untouched.

**6 · Row 10 filed as `routed`/`open`, deliberately NOT `accepted-divergence`.** The register's own
§"How to use this" reserves that value to the founder (P12). Recording a divergence as deliberate is
not the same act as ratifying it. **PD-2-35**, founder ratification requested.

---

## Row 3 — STRUCK, and the strike is sound

> "Drop the bold headline above the argument in the side panels."

Ground **verified against the mockup, not accepted on assertion**: its own header declares the gap —
*"Known render gap: post panels show body only — the title+body post structure (SCL-1) patches the
post primitive at the DESIGN.5 lock and back-propagates here at refine"* (`:11-13`). The build renders
real `post.title` data. Deleting shipped information to match a prototype that documents itself as
behind is backwards. **The strike does not look wrong to me — no halt.** Not implemented in any form;
row 7 quotes the teaser only, and a test asserts the headline is **not** wrapped so row 7 cannot be
over-applied to it.

---

## Surprises caught + fixed in-session

**S-1 · The "green baseline" was a false receipt — my own gate command lied.**
I opened with `just verify` backgrounded as `cmd > log; echo EXIT=$? >> log; tail -3 log`. The harness
reported **exit 0** and I stated the baseline was green. It was **254**: `node_modules` was empty in
this worktree and `tsc` was never found. The 0 was `tail`'s. This is `feedback_gate_commands_never_
pipe_to_tail` one variant over — the trailing command owns the compound exit code, whether it is a
pipe or a `;`. Fixed: `CI=true pnpm install --frozen-lockfile`, then every gate run as its own
statement with `echo EXIT=$?` immediately after and **no** trailing command.

**S-2 · A fresh worktree has no `.env.local`, so `next build` cannot collect page data.**
`Error: DATABASE_URL is not set` at `/m/[slug]/export`. Resolved with the placeholder env
`tests/_setup/env.ts` already ships (vars **set**, not connected). ⛔ No real `.env*` was read, copied
or written. True baseline then measured: **`just verify` exit 0**, vitest 18 files / 133 tests green.

**S-3 · Row 8's first subtrahend was wrong by exactly two pixels — a permanent scrollbar.**
`calc(100vh-60px)` assumed the header is its `h-[60px]` inner row. Its **border-box is 62px**:
`h-[60px]` + `border-y` (1px top + 1px bottom). The page overflowed by 2px, so a page that *fits*
would have shipped with a scrollbar on every load. **Caught only by measuring the real compiled CSS
in a browser** — invisible in the diff, invisible to every test, and invisible to my own first
(hand-mapped) probe. Corrected to `calc(100vh-60px-2px)`, written as its two shipped contributors so
the provenance is legible; Tailwind folds it to `calc(100vh - 62px)`.

**S-4 · `min-h-full` on the `(public)` wrapper is inert.** `min-height:100%` against a parent whose
own height is min-height-driven resolves to `auto`. Measured: in a 777px viewport that column was
**510px**. So `flex-1` on `<main>` had no slack to divide — row 8's clause 1 could not be delivered by
flex alone, which is why the viewport-derived floor is on `<main>` and why row 8 still fits its fence.

---

## Verification

`just verify` run **before each commit**, unpiped, exit code captured directly.

| Gate | Result |
|---|---|
| `just verify` (typecheck → biome → next build) | **PASS** before C1, C2, C3, C4 |
| `vitest tests/unit/ tests/server/discovery/` | **126 files / 1687 tests PASS** |
| `side-pole-binding` · `pct-round-render` · `no-raw-hex-view-layer` · `tokens-monochrome` · `emphasis-ladder-tokens` | **all green, none weakened or skipped** |

**Row 8/9 measured live against the real compiled Tailwind CSS**, 971px viewport:
- **Fits:** col 971 = viewport · main 910 · hero 611 (absorbed the slack) · graph 485 (floor 96px) ·
  rail 18 (fixed) · grid 236 (content) · `scrolls: false`.
- **RULED A1, tiles forced past the viewport:** `docScrollH` 1197 > 971, `scrolls: true`, last tile
  fully laid out at its full 420px, hero correctly giving the slack back (611 → 221), `overflow-y`
  computed `visible` on `html` and `body`, and **zero** elements in the chain carrying
  `overflow:hidden`. **The page scrolls; it never clips.**
- Row 9 invents nothing: compiled CSS proves `h-24` and `min-h-24` both emit
  `calc(var(--spacing) * 24)` = **96px**. Same number, different property.

**VALUES — confirmed: zero colours, px, rem, font sizes or durations taken from the mockup.**
Every number introduced traces to shipped code: `60px` + `2px` = `GlobalHeader.tsx`'s `h-[60px]` and
its `border-y`; `min-h-24` = the pre-existing `h-24`; `text-n3` = `StatLine.tsx`'s shipped separator.
The only bytes carried from the mockup are the two **glyphs** rows 6 and 7 explicitly require, both
hexdumped: `0x7C` (U+007C) and `0x22` (U+0022) — not colours or measurements.

---

## Open questions

1. **PD-2-35 needs a founder disposition.** Filed `routed`/`open`; only the founder may set
   `accepted-divergence` (P12).
2. **PD-2-08 is unchanged and still awaits its Gate C ruling.** The active-ring colour call (n4) moved
   files with row 4; the ruling it is waiting on did not move with it.
3. **Was the rationale comment in `layout.tsx` inside the fence?** The fence permits the `<main>`
   element's className "AND NOTHING ELSE IN THAT FILE". I added a JSX comment *attached to that same
   element*, on the reading that documenting the one permitted change is not "a second thing" — and
   that shipping a bare `calc(100vh-60px-2px)` with no provenance would be worse and against this
   repo's documentation discipline. **Flagged rather than assumed; object if that reading is wrong.**
   Nothing else in the file was touched — the diff is one removed line and one replaced element.

---

## Widenings — RECORDED, NOT IMPLEMENTED

1. **A `--header-h` token** would remove the `60px-2px` coupling between `layout.tsx` and
   `GlobalHeader.tsx`. Needs `globals.css`, outside the allow-list.
2. **`PriceSparkline`'s `size="card"` preset has no consumer** now that row 1 removed the tile chart —
   the hero is the only caller. `price-sparkline.test.tsx` still exercises the preset directly, so
   nothing is red. Removing it is a separate cleanup.
3. **`market-thumb.test.tsx`'s docblock coordinates** (`MarketCard.tsx:51-55`) drift by row 1's
   deletion. Per **O-8** fences are by symbol; these are prose evidence lines, not fences. Not chased.

---

## PERF-1 — observation only, no server file touched

⛔ **No `src/server/**` file was read into this diff.** Observed while removing the tile chart: the
grid's series fetch is **unchanged and still runs**. `DiscoveryMarketView.series` is still populated
per market by `loadPriceSeries` in `page.tsx`'s `DiscoveryContent` loop, and is still consumed — by
the **hero**, which renders one series per carousel position. So row 1 removed **eight renders** of
that data but **zero reads**: the 1 + 12N round-trip shape is untouched, exactly as the kickoff
fenced. A future PERF-1 pass should note that the series is now needed for **one** market at a time
(whichever the carousel is showing) while it is still fetched for **all eight** up-front — but the
carousel is client-side motion over pre-loaded props (§22, "no re-fetch"), so making that lazy is a
**data-loading architecture change**, not a tidy-up. Recorded, not acted on.

---

## Next session starts at

**Human review of the diff** (`~/Downloads/HF-DISCOVERY-DIFF.patch`), then the founder rulings on
**PD-2-35** and **open question 3**. ⛔ Do not merge before that read.

## Context to preserve

- `just verify` in this worktree needs the placeholder env (S-2) **and** `pnpm install` — a fresh
  worktree has neither. Gate commands must not end in `tail` (S-1).
- Row 8/9 are only provable in a **browser against compiled CSS**; the render suites structurally
  cannot see a 2px overflow (S-3).
- The mockup is `485` lines, md5 `68c65bd781df4fb564727d2f0ed83e77`, verified unchanged at both
  `9be5d1c` and `b7c2a38`.

## Time

One unsupervised session, 2026-08-15.

---

# ROUND 2 — GATE C REMEDIATION (2026-08-15)

Gate C read the diff and **PASSED** it with six findings. All six were founder-ruled and landed as
three commits on the same branch / same PR **#334**. ⛔ Still DO NOT MERGE.

| Commit | Finding | What landed |
|---|---|---|
| `d09bd6d` | **G-1** *(blocker)* | SPEC.1 → **1.0.30** · design-language → **v0.8-draft** |
| `82361bb` | **M-1**, **H-1** | ladder census zero-count entry · new `discovery-height-chain` guard |
| *this* | **7.1**, **7.1b**, PD-2-08, PD-2-35, **M-2**, **M-3** | measurements · dispositions · parked rows · this log |

## G-1 — the tier-1 spec conflict, and the founder's ruling

**FINDING.** Row 1 removed the tile price chart. **SPEC.1 §22 and design-language §3.2 both NAMED
that sparkline in the LOCKED card composition.** The kickoff's own rule — *where a ratified tier-1
ruling already decided a presentational question, that ruling wins and the row is STRUCK* — was
applied correctly to row 3 and **never applied to row 1**.

**FOUNDER RULING: the spec is STALE; the mockup governs. Row 1 STANDS.** The card sparkline is
defined *by SPEC.1 itself* as **decorative** — no axis, `aria-hidden`, index-spaced X — and
composition of decoration is the ratified mockup's jurisdiction.

**§5.1 reconnaissance narrowed the rider, which is why it ran first.**
**`design-canon.md` §2 ALREADY OMITS THE SPARKLINE** — verbatim: *"Cards: image + title + stats +
YES/NO bar."* So canon and the mockup **already agreed**, and SPEC.1 + design-language were the
**lone stragglers**. That strengthens the ruling and it means **canon needed no amendment and was
not touched** — two prescriptive docs amended, not three. Every replacement unit was quoted from the
file **at HEAD**.

Amended: SPEC.1 §22 read model + §22 *Price series* + §22 F-DISC-1 + §9 *Market price history* +
§16.1 + Appendix B; design-language §3.2 Market card + §3.2 two-line graph.
⚠ **"must be identical everywhere" was RETAINED** — the sparkline leaves *both* renders together, so
Discovery and Profile stay one composition. Dropping that clause would have been the opposite of the
fix. ⛔ **Historical records deliberately untouched**: SPEC.1's own change-log rows 1.0.17/1.0.18/
1.0.22, all logs, plans, POLISH-0, the register's defect rows, the brand values-log. A record that no
longer matches the build is *correct* — it records what was true then.
⚠ **Nothing architectural changed**: no field, no query, no cache behaviour, no ADR, no §17 row.

## M-1 / H-1 — the two guards

**M-1.** The ladder census asserts **per-listed-file**, so dropping `DiscoveryGrid.tsx` from
CONSUMERS silently retired the only assertion that ever examined it — a re-added ring token there
would have passed, and the whole-tree scan does not cover it (it bans the raw *literal*, never the
token). Fixed by keeping the file listed at **`count: 0`**. ⚠ **Verified against the assertion code
before writing it**: `occurrences()` is `split(needle).length - 1`, which returns `0` for an absent
needle, so `toBe(0)` pins absence exactly as `toBe(1)` pins presence — **no assertion weakened, one
restored.** **Proven by reversal**: re-adding the token turns the suite RED
(`token count: expected 1 to be +0`); the mutation was transient and reverted, `src/` untouched.

**H-1.** New source-scan guard `tests/unit/design/discovery-height-chain.test.ts`, modelled on
`emphasis-ladder-tokens.test.ts`. jsdom performs no layout — it resolves no `calc()`, no `100vh`, no
Tailwind utility — so a render test structurally cannot see this. It reads the **shipped files** and
asserts `layout.tsx`'s calc subtrahends against `GlobalHeader`'s own row height and border.
**Positive control included** and it is the point: the predicate is a pure function of the two file
contents, run against the real sources with one byte-level mutation each — header row `60px→72px`,
calc border allowance dropped (*literally this PR's shipped 2px bug*), `border-y→border-y-2`, border
removed. All four redden; unmutated agrees.

> ⚠ **ONE RESIDUAL ASSUMPTION, DECLARED NOT HIDDEN — and the halt condition applies to it.**
> The header carries the bare `border-y` utility and **its width is NOT readable from this repo**:
> no `tailwind.config.*` (v4 is CSS-first), no border-width in `globals.css`, and the pinned
> `tailwindcss` package ships no `--default-border-width` in `theme.css`/`preflight.css` — the value
> lives inside the compiler. I did **not** halt the whole sub-item, because both drift vectors that
> actually live in this repo *are* derivable and are derived: the row height is read from
> `GlobalHeader` and compared, and the border **utility string is pinned exactly**. `BORDER_Y_TOTAL_PX
> = 2` is **measured** (62px border-box vs a 60px row, real compiled CSS), isolated in one named
> constant. **Residual risk, stated:** a Tailwind *major upgrade* that changes the default border
> width would go stale without reddening. **What I would need to close it:** a
> `--default-border-width` (or a `--header-h`) declared in `globals.css` — which needs a shell file
> this round's allow-list excludes.

## 7.1 / 7.1b — the measurements

Real compiled CSS, layout viewport pinned by a **fixed-width iframe**.
⚠ **Method note worth keeping:** `resize_window` resized the OS window but left `innerWidth` at
**1800** — the first attempt measured desktop three times and would have reported a clean pass. An
iframe is the only reliable way to pin a layout viewport here.

| | 390px | 768px | 1440px |
|---|---|---|---|
| Clips anywhere | **NO** | **NO** | **NO** |
| Scrolls vertically | yes (1737 > 844) | no | no |
| Grid reachable · last tile | **yes**, 108px | **yes** | **yes** |
| `overflow:hidden` in chain | **none** | **none** | **none** |
| `html`/`body` `overflow-y` | visible | visible | visible |
| Hero panel heights | 206 / 206 | equal | 618 / 618 |
| **Head row clips (both poles)** | **NO** (sw = cw) | **NO** | **NO** |
| **Stake right edge inside row + viewport** | **yes** | **yes** | **yes** |
| **Horizontal overflow** | **105px** | **320px** | **0** |

**7.1b — row 6 did NOT break the head row.** `scrollWidth === clientWidth` at every width for both
poles; the stake figure (`Đ 1,000 → Đ 1,407`) is fully rendered and its right edge sits inside both
the row's client box and the viewport. **Delta attributable to row 6, isolated by a with/without
control rather than inferred:** +16px of head-row min-content per panel (2 separators × 8px);
**page-level +0px at 390, +32px of 320 at 768 (~10%), +0px at 1440.**

**⚠ THE MEASUREMENT'S REAL FINDING — horizontal overflow below `lg`, and it is NOT row 6's.**
`min-width: auto` on grid items meets nowrap content: the post head row is `flex-nowrap …
whitespace-nowrap` and the hero `<h2>` is `truncate` (also nowrap), and a grid item will not shrink
below its content's min-content width. **At 390 the overflow is 105px WITH and WITHOUT the
separators — delta 0** — so at mobile it is entirely pre-existing. Filed as **PD-2-36**.

## Dispositions

- **PD-2-08 → CLOSED.** `n4` ratified. Recorded with its full ground; the ring **moved files** at row
  4 but its value did not change, and both files are now pinned by the ladder census.
- **PD-2-35 → HELD OPEN, deliberately.** The literal §7.2 condition (no clipping, grid reachable)
  **passes**. But the measurement surfaced a third state the condition did not contemplate, and
  PD-2-35's whole content is *"the responsive column behaviour is deliberate"* — banking
  `accepted-divergence` over a layout that forces sideways scrolling at every sub-desktop width would
  convert an unexamined defect into a ratified decision, which is what the conditional exists to
  prevent. **One-word flip once PD-2-36 is dispositioned. Founder's call, now with numbers.**
- **PD-2-36 → MINTED**, `routed`/`open`. ⛔ No code — the fix (`min-w-0` on the grid items, or
  relaxing `nowrap`) is a layout change to a ratified surface.
- **M-2 → corrected in place** above, in the round-1 entry it falsified.
- **M-3 + the clamped-teaser artefact → two rows in `docs/parked.md`**, the second carrying the
  founder's KEEP ruling so it is not rediscovered and "fixed".
