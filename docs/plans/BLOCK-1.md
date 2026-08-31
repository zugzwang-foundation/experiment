# BLOCK-1 — wire the four resolution blocks, rename YCP-01's artifact noun

Autonomous overnight run per `docs/overnight-run.md`. Ground: `origin/main` @
`940cdcb1b61d68c99f6d0a2a89894b7b61af77bd`. Full recon:
`~/Downloads/zz_BLOCK-1_recon_2026-08-31T1455.md`.

## Core idea

`ResolverCards.tsx` renders four blocks (RESOLUTION / RESOLVER / CLOSES ON /
FLAVOUR) per market, each currently an empty placeholder bar. The eight live
markets' resolution values are frozen at pre-registration and never change
during the live window, so they ship as a static, per-slug, in-code map rather
than a new column — there is no home for them in the 11-column `markets` table
and this run does not create one (DDL wall). The RESOLVER block additionally
becomes a real link (the market's authoritative resolving source); the other
three stay inert. Separately, YCP-01's artifact noun ("paper" → "pitch") gets a
scoped, guarded UPDATE directly against the staging DB.

## File map

| File | Change |
|---|---|
| `src/components/debate/resolution-block-data.ts` | **NEW.** The map: types, the 8-slug literal union, `RESOLUTION_BLOCKS: Record<KnownMarketSlug, ResolutionBlockSet>`, `isKnownMarketSlug`, `getResolutionBlocks(slug)` (throws on an unknown slug). |
| `src/components/debate/ResolverCards.tsx` | Read `market.slug` → `getResolutionBlocks`. Render real label/value/subvalue text (drop `aria-hidden` on value/subvalue). RESOLVER block (the only one ever carrying an href) renders as a whole-block `<a>` with the A2b hover/focus recipe; the other three stay plain, non-interactive `<div>`s when `href` is null. |
| `tests/unit/debate/render/resolver-cards.test.tsx` | Corrected **in place** (O-5) — docblocks and assertions that state "R-12: non-interactive" and "value/subvalue are empty + aria-hidden" are now false for the RESOLVER block and for all four blocks' text respectively. Existing structural assertions (grid-cols-4, one row, floor height, 1:1 glyph ratio, no MARKET-CONTENT-of-the-fixture leak) are preserved — they're still true. |
| `tests/unit/debate/resolution-block-data.test.ts` | **NEW.** G1 (throws on unknown slug; returns all 4 keys for each of the 8 known slugs) + a full content spot-check against the RF-2 table (doubles as regression coverage for the whole map). |
| `scripts/rename-ycp01-artifact.ts` | **NEW**, operational (inline `postgres()` client, not `@/db` — AGENTS.md §7). Exports the pure `renameArtifactNoun` transform (importable with zero DB/IO) and a `main()` guarded to run only when invoked directly. Performs the RF-4 scoped UPDATE with its guards. |
| `tests/unit/scripts/rename-ycp01-artifact.test.ts` | **NEW.** G6 — pure-function tests of `renameArtifactNoun` against the actual title/description strings plus synthetic edge cases (`"Paper club"`, `"PAPER CLUB"`, leading/trailing "paper"). |
| `docs/data/staging-markets-snapshot.*` | Refreshed in S1 (currently stale — six descriptions have grown 3.8–5.1× since it was captured), and again after S5's UPDATE lands. |
| `tests/unit/debate/render/_posted-fixtures.ts` + `auto-advance.test.tsx` + `criterion-disclosure.test.tsx` + `head-zone.test.tsx` + `market-header.test.tsx` + `poll.test.tsx` + `price-chart.test.tsx` | **Collateral, not planned at Phase B.** These seven files build synthetic `DebateMarketHeader`/`DebateViewModel` fixtures with placeholder slugs to test unrelated concerns (auto-advance timing, poll phase, criterion disclosure, layout) — none care what the slug is, they just need one `ResolverCards` (nested under `MarketHeader`) won't throw on. Fixed by giving each a real slug — three via a direct edit (their own local fixture), four via shadowing the import in the shared, auto-generated (`mumbai-metro.input.ts`, "do not hand-edit") golden fixture rather than touching it. Orphan cleanup this task's own change created (CLAUDE.md §5.3), not scope creep. |

No schema/migration file touched. No DDL.

## Ambiguity register

| # | Ambiguity | Chose | Rejected | Why |
|---|---|---|---|---|
| 1 | RF-1 says the map is "exhaustive at the type level" and "a missing slug must fail the build" — but `market.slug` is DB-sourced `string`, and no TS mechanism can statically prove an arbitrary runtime string belongs to an 8-element literal union. | Two-tier guarantee: (a) `RESOLUTION_BLOCKS: Record<KnownMarketSlug, ResolutionBlockSet>` — omitting one of the 8 known slugs from the object literal **is** a `tsc` error, so `just verify` genuinely fails the build for that case; (b) `getResolutionBlocks` throws synchronously for any slug outside the 8 — loud, caught by `m/[slug]/error.tsx`, never a silent empty bar. | Reading "fail the build" as requiring a compile-time guarantee against DB content, which is not achievable in TypeScript without an unjustified `as` cast (forbidden, AGENTS.md §4) or a false sense of safety. | This is a "measure first, act on what's achievable" case (OVN-O4) — the ruled *outcome* ("no silent empty bar") is fully honored; the *mechanism* stated in the brief ("fail the build") is honored as far as TS actually allows, and the runtime backstop covers the rest. Given the code freeze (10 Sep) and that these 8 markets are the only ones this deployment will ever have, this is a distinction without a practical difference. |
| 2 | RF-2's table shows `RESOLUTION != "X"` for 3 of 8 rows (oktoberfest→"Oktoberfest", bitcoin→"CoinMarketCap", github→"GitHub"), vs. `RESOLUTION == "X"` for the other 5. Could be a typo (RESOLUTION should read "X" uniformly) or intentional. **Corrected here at S6 — an earlier draft of this row miscounted "2 of 8" / "repeats twice (oktoberfest, bitcoin)", missing the github row entirely; caught by @code-reviewer.** | Intentional, verbatim. RESOLUTION names the resolving SURFACE, independently of RESOLVER, not a mirror of it: for the 5 markets resolved by watching an X account's activity that surface is X; for the 3 markets whose evidentiary basis is a named institution's own data (a festival's own report, a price index, a code host's own count) RESOLUTION names that institution instead. For two of those three (oktoberfest, bitcoin) that happens to equal RESOLVER's own value too; for github it does NOT (RESOLUTION="GitHub", RESOLVER="Zugzwang") — which is exactly why "mirrors RESOLVER" is the wrong description of the rule, even though it describes 2 of the 3 cases. | Silently "correcting" all 8 RESOLUTION values to "X". | RF-2's own instruction is "verbatim, do not paraphrase" — explicit pre-emption of exactly this temptation. The pattern is coherent and repeats three times (oktoberfest, bitcoin, github), which argues against a one-off typo. U-3's href rule ("opens Zugzwang's own X post") is a claim about the **link target**, not the **display text** — the two are independent, and RESOLUTION's href is null on all eight today regardless. |
| 3 | Table's shared `line2` column ("Low" for bitcoin, "repo" for github) — which block does it belong to? | RESOLVER's line2 in both cases. | Assigning "Low"/"repo" to RESOLUTION. | The GIT-01 clarifying note is explicit: "GIT-01's TEXT reads Zugzwang / repo" — naming RESOLVER. The BTC-01 clarifying note ("CoinMarketCap's LIVE TICKER is excluded... The href is the historical-data page") is also about RESOLVER's href/content. No other row has a non-null line2 for RESOLUTION anywhere in the table. |
| 4 | RF-3a says "the logo is decorative inside a link: `alt=""`" — but the glyph is an `aria-hidden` `<span>`, not an `<img>`; there's no `alt` attribute to set. | Keep the glyph `aria-hidden="true"` (unchanged) inside the anchor — the same outcome (glyph contributes nothing to the accessible name) the instruction describes for the `<img>` case, achieved by the mechanism that actually applies to a `<span>`. | Adding a literal (invalid) `alt=""` to a `<span>`, or converting the glyph to an `<img>` (out of scope — no logo asset is being added this task). | The instruction's *intent* (decorative, non-announced) is unambiguous; its *literal mechanism* assumes an element type this component doesn't have. Same OVN-O4 shape as ambiguity #1. |
| 5 | Whether to add an explicit `aria-label`/"(opens in a new tab)" hint on the RESOLVER anchor, matching `GitHubStarsView`'s pattern. | No explicit `aria-label`. Accessible name comes from the natural text content (label + value(+subvalue)). | Copying `GitHubStarsView`'s custom `aria-label` pattern. | RF-3a's own worked example — `"Resolver @mybmc, link"` — is exactly what the natural text composition already produces; `GitHubStarsView` needs a custom label because it injects a *formatted, non-visible-text* star count, which doesn't apply here. Matching the brief's own example over a superficially-similar precedent. |
| 6 | Value/subvalue text recipe: one shared recipe (A2) or a dimmer second recipe for line2? | One recipe for both lines: `text-[11px] leading-[1.5] text-muted-foreground`, plus `truncate` (mirroring the label's existing `truncate` + the text stack's existing `min-w-0`). | Inventing a smaller/dimmer treatment for line2. | "No new type size, hex, or radius enters" (RF-3 wall) and only one recipe is cited. `truncate` isn't a size/hex/radius — it's the same overflow-safety class already on the label, extended to the two new real-text lines since generated strings vary in length inside a fixed-width column. |
| 7 | `GITHUB_REPO_URL` already exists as an exported constant (`src/server/github/star-count.ts`) — import it, or hardcode the literal in the new map? | Hardcode the literal in `resolution-block-data.ts`, cross-checked byte-identical against the existing constant. | Importing `GITHUB_REPO_URL` into the new (component-tree) data file. | `star-count.ts` sits under `src/server/`; importing it (even for one constant) risks coupling a presentation-layer static map to a server module's future shape/`server-only` status for no real benefit, since the value was already confirmed identical by direct comparison — the goal (no typo, no drift) is achieved either way, without the coupling. |
| 8 | Test-writer's role here: write G1–G8 first (CLAUDE.md §5.6 tests-first default), or review guards I write myself? | I write the implementation and G1–G8 together (with my own OVN-V1/V2 discipline as I go), then `@test-writer` runs first in the reviewer cascade with the task's own stated scope: "do G1–G8 fail for the right reason, or are any green because their selector matches nothing?" | Blocking S2/S3 on a separate test-writer-first pass before any implementation code. | This is UI display-wiring in `src/components/debate/`, not on CLAUDE.md §5.6's critical-path list (bet placement, Dharma, comment attachment, side assignment, resolution *mechanics*, moderation, CSAM) and not under `src/server/`. The task's own cascade line for test-writer is written as a review-scope, not a write-first scope — the more specific instruction wins over the general default. |

## A3 baseline (measured, see recon §A3) → predicted post-build

| Metric | Before | Predicted after | Why |
|---|---|---|---|
| 1440×777 block width | 162.4px | unchanged | RF-3 touches text content and (only for RESOLVER) wraps children in an anchor with `display` inherited from the same flex classes — no width-affecting class moves. |
| 1440×777 page overflow | 0 | 0 | Same reasoning; text is `truncate`d, never forces block growth. |
| 390×844 overflow | 364px (pre-existing, walled off) | ~364px, unchanged | Scope fence — not touched. S4 re-measures to *confirm* unchanged, not assumed. |
| Value line height | `min-h-[9px]` empty bar | `text-[11px] leading-[1.5]` real text ≈ 16.5px line box | Expected, not a regression — the placeholder bar was never sized to real type metrics; block height is a `flex-1` remainder above an `84px` floor, so a taller value line is absorbed, not clipped (floor math already assumes text content, per the docblock's own 84px derivation). S4 confirms no clipping. |

## Slices

- **S1 — capture.** Dump all 8 staging rows verbatim + md5 to `~/Downloads/zz_BLOCK-1_staging-before_<UTC>.md`; commit a refreshed `docs/data/staging-markets-snapshot.*`. Exit: before-state on disk and in git. *Not reviewer-bearing.*
- **S2 — map + exhaustiveness.** `resolution-block-data.ts` + G1 + the map content-spot-check test. Exit: `tsc --noEmit` green, all 8 slugs present, G1 passes (and was watched red first — delete one slug's entry, confirm `tsc` errors; call an unknown slug, confirm throw).
- **S3 — render wiring.** `ResolverCards.tsx` rewrite + `resolver-cards.test.tsx` corrected in place + G2/G4/G5/G7/G8. Exit: 8 markets show real text, zero empty value bars, RESOLVER end-to-end clickable, other three blocks provably inert.
- **S4 — fit measurement.** Re-run the A3 probe (same 3 viewports) against the branch preview once deployed (S6) — report only, no fix. *Folded into S6's deploy step since it needs a live deployment to measure against; see S6.*
- **S5 — YCP-01 rename.** `rename-ycp01-artifact.ts` + G6 + the guarded UPDATE against staging. Exit: row count affected = 1, `Paper Club` count identical before/after, read-back matches expected.
- **S6 — full suite, reviewer cascade, deploy, report.** `pnpm vitest run` full suite green. Reviewer cascade (test-writer → code-reviewer → security-auditor, sequential, effort max). Fix findings. Deploy preview, confirm `.vercel/project.json` linkage, open unmerged PR. Re-run the S4 probe against the preview URL. Write the final report.

Reviewer-bearing: S3 (the render + anchor change) and S5 (the DB UPDATE) are what the cascade is scoped against; S2's map is covered incidentally by code-reviewer's pass over the whole diff.

## Test plan (G1–G8)

| Guard | File | Rejects |
|---|---|---|
| G1 | `resolution-block-data.test.ts` | A market slug with no map entry (throws; and `tsc` fails if the object literal drops a known key). |
| G2 | `resolver-cards.test.tsx` | Today's shipped state — 0-character value/subvalue text. |
| G3 | `resolver-cards.test.tsx` | "5 Nov 2026" applied slate-wide (OKT-01 must read "4 Oct 2026" / "21:59Z"). |
| G4 | `resolver-cards.test.tsx` | Any rendered anchor with an empty / `#` / placeholder `href` — generic over all blocks, not RESOLUTION-specific (so the RESOLUTION-href seam stays open for later wiring). |
| G5 | `resolver-cards.test.tsx` | GIT-01's href shortened to match its short display text — href must be the full repo URL. |
| G6 | `rename-ycp01-artifact.test.ts` | A substring replace corrupting "Paper Club" (case-insensitive, in either direction). |
| G7 | `resolver-cards.test.tsx` | An anchor wrapping only the value text, leaving glyph or label outside the click target. |
| G8 | `resolver-cards.test.tsx` | A `null`-href block (closes/flavour/resolution-today) that is focusable or renders an anchor. |

Every guard gets a revert-to-red pass (OVN-V2) before S6; results go in the final report, not re-derived here.
