# POLISH-2 — session log

> **Date:** 2026-08-09 · one session, pre-authorised full run under a standing disposition (no HALT-for-ratification phase).
> **Ground:** `origin/main` @ `e2c82aa` (#305 SYNC-1) · branch `polish/2` off `origin/main`, primary tree.
> **Plan:** **none in-repo.** The kickoff was inline and self-contained; the standing disposition (A build / B log / C reclassify-or-build / D navigation-and-motion) plus the three pre-ratified rulings are its authoritative scope.
> **Upstream recon:** the POLISH.2 delta recon (read-only, same day) — 49 deltas `V1`–`V49`, numbered in the `POLISH-1-D` convention (`docs/logs/POLISH-1a.md:5`). `V50` was found during execute.
> **Ritual:** CC-LIGHT — not a CLAUDE.md §1 critical path. No `@security-auditor`, no DB, no migration, no auth, no money math, zero writes.
> **Model:** `claude-opus-5[1m]`, effort `max`.

---

## A note on SHAs in this log

The merge will be **squash-to-main**, so **no SHA below reaches `main`.** All eight are branch-local. **The durable reference is the squash-merge SHA on `main`, recorded at close-out — not here.**

---

## Self-check, run before any edit

Two gates, both from the kickoff, both passed.

**1 · ADR-0023's patch record covers `/`; it does not exclude it.** Decision (`docs/adr/0023-participant-shell-topology.md:229-231`): *"The global header is **sticky** to the top of the viewport on all `(public)` and `(auth)` routes."* `/` is a `(public)` route.

The stronger finding is in its **Context** (`:222-225`): *"No document in the repo speaks to scroll behaviour — **the three surface mockups are fixed-viewport `overflow:hidden` shells that never scroll, so they cannot answer it.**"* The patch record **considered the mockup's `overflow:hidden` and ruled it non-authoritative**. V3's reclassification to B is not an inference from ordering; it is the superseding document saying so in its own words.

**2 · No open PR touches the discovery surface.** `gh pr list --state open` → `[]`.

---

## What landed

Branch `polish/2`, eight commits, **11 source/test/doc files**. **PR opened, NOT merged** — Gate C is a founder diff-read.

| | SHA | Commit |
|---|---|---|
| **C1** | `14a231a` | `feat(discovery): POLISH-2 C1 — the mockup's page inset (V2)` |
| **C2** | `826d4cc` | `feat(discovery): POLISH-2 C2 — stat line: pluralisation + the emphasis tier (V26 V27 V28 V48)` |
| **C3** | `90e0e1c` | `feat(discovery): POLISH-2 C3 — hero panels (V5 V6 V7 V8 V9 V12 V14 V18 V19 V21 V22 V24)` |
| **C4** | `984cec5` | `feat(discovery): POLISH-2 C4 — carousel rhythm, dot shapes, arrow keys (V4 V33 V34 V35 V37)` |
| **C5** | `4303c74` | `feat(discovery): POLISH-2 C5 — grid + card geometry (V20 V24 V39 V40 V41 V42)` |
| **C6** | `dfa38c0` | `feat(discovery): POLISH-2 C6 — error-state interaction tokens (V47)` |
| **C7** | `262eb7e` | `docs(polish): POLISH-2 — 31 register rows, the §9 machine-pass amendment, two corrections` |
| **C8** | *this log* | `chore(polish-2): log session — POLISH.2 machine pass, PR opened, Gate C pending` |

**Commit ordering deviates from the kickoff's group order, deliberately.** The stat line (C2) ships **before** the hero (C3) because the hero consumes V28's new `size` prop; committing hero first would leave a non-compiling tree at that commit, and a commit-per-group scheme is worth nothing if the groups do not individually build.

### Gates — all green on the final tree

| Gate | Result |
|---|---|
| `tsc --noEmit` | **exit 0** |
| `biome check .` | **exit 0** — 650 files; 1 warning (pre-existing unused import in an untouched moderation test), 4 infos |
| **Full suite** (`pnpm vitest run`) | **exit 0** — 306 passed / 1 skipped (307 files); **2706 passed / 1 skipped / 4 todo** (2711). 163s |
| `next build` | **exit 0** — compiled in 5.2s |

Coverage confirmed rather than assumed: **10/10 invariant, 30/30 integration, 17/17 db** suites ran and passed; `tests/scale/**` and `tests/staging/**` produced **zero** references in the log, so the opt-in exclusions held. Build ran with `ZUGZWANG_ENV=preview`; no `.env*` was read.

---

## Decisions made

**1 · Three deltas carved out rather than built, all on the founder's own V10 precedent.** The V10 ruling forked `SIDEBADGE-PRICE` because `SideBadge` spans nine files and §5.4 forbids a V batch spanning surfaces. That reasoning is not specific to `SideBadge`:

- **V29/V30 → `PRICEBAR-GEOMETRY`.** `PriceBar` is consumed by `MarketHeader.tsx` and `chart/MarketPriceChartCard.tsx`, both on `/m/[slug]` — POLISH.3's surface. Building the mockup's bar geometry here would silently re-skin the debate view. **PCT.ROUND is untouched and percentages remain non-controls** (R10 / PD-0-11).
- **V50 → shared-primitive docket.** New, found at execute: the mockup's `.avatar` is **16px** (`:84`), the shipped `Avatar size="sm"` is 24px. The fix is not a consumer override — `data-[size=sm]:size-6` out-specifies a plain `size-4`, which is exactly the twMerge/specificity trap POLISH-1a documented at its item 4. Same treatment POLISH-1a gave `ui/avatar.tsx`.

**2 · V14's rationale changed under V3's supersession, and the delta survives anyway.** The recon justified the clamps by V3's fixed viewport. V3 is superseded, so that argument is gone. The clamps still ship, on a different and now-stated ground: in a three-column grid one unclamped panel stretches its two siblings. **Recorded because a reader checking V14 against the recon would otherwise find its stated reason deleted and assume the delta was too.**

**3 · V23/V25 reclassified B on the same supersession, and NOT built.** The mockup sizes both graphs `flex:1`. That only resolves inside the viewport lock ADR-0023's patch record supersedes; with the page scrolling, `flex-1` on a wrapper whose SVG child has no intrinsic height collapses it to zero. The mockup supplies no absolute height, so there is nothing to port. Fixed heights stay.

**4 · V42's colour is a call, not a port, and it is flagged for ruling.** The mockup rings the active card in `--ink`. Mapping `--ink` by name is forbidden under the V7 ruling (it is `#fafafa` on the dark ramp). But `--border-strong` had been aliased to n2 at BRIDGE — **the exact value of every card's own hairline** — so the "active" ring differed from a resting card by 2px of width and nothing else. Built as **n4**, giving a three-step ladder inside the ratified ramp: n2 grid hairline < n3 hero panel (V7) < n4 active ring. Founder ruling requested at Gate C.

**5 · `hover:underline` kept on the author pseudonym.** V12 removes `font-mono` and sets weight 650 — but the mockup defines no `.pseud:hover` at all, and it is not hover-free (it defines `.sarrow:hover`, `:141`). Silence is not a ruling to delete an affordance. The type changes; the affordance stays.

**6 · V12 also aligned discovery to a convention it was breaking.** `ArgProfile.tsx:60` renders pseudonyms `text-sm font-medium` in the sans face on `/m/[slug]`. Discovery's `font-mono` was the **outlier**, not the house style — the mockup and the other surface already agreed. Worth stating because "the mockup says sans" and "the rest of the product says sans" are two independent reasons and only one of them was in the recon.

**7 · `PageContainer` was NOT touched, and its note is NOT weakened.** `PageContainer.tsx:30-31` says *"DISCOVERY (`/`) TAKES NO CONTAINER. Full-bleed is deliberate — do not add one here or on that route."* Full-bleed means no max-width and no centering; both are still absent. The mockup is itself full-bleed **with** a 28px inset (100vw `.screen`, `.content` padding, no max-width anywhere), so the two never disagreed. The inset lives on the page because `src/components/shell/` is HALT SET 6.

---

## Surprises caught + fixed in-session

**1 · C1 broke a Suspense assertion, and the fix had to go the harder way.** Wrapping the page for V2's inset displaced the Suspense boundary from the root, failing `page-states.test.tsx::render::loading-fallback-is-skeleton` with `expected 'div' to be Symbol(react.suspense)`.

The tempting fix is to delete the assertion. The correct one is to read what it claimed: its own comment says *"DiscoveryPage is SYNC by contract: it returns the Suspense boundary immediately (an async page would return a Promise, failing `el.type`)."* **Root-ness was the mechanism, not the claim.** The cell now asserts the sync contract **directly** (`expect(el).not.toBeInstanceOf(Promise)`), walks one hop to the boundary, keeps both original pins — and **additionally pins V2's inset**, which nothing on disk covered. Net coverage went up, not down.

The alternative structures were both worse and are recorded so they are not retried: putting the inset inside Suspense means padding the content and the fallback separately, and `LoadingSkeleton` is HALT SET 3 (R8 unruled) — untouchable. Padding only the content gives a visible jump on hydration.

**2 · I wrote V48's pluralisation wrong on the first pass and caught it before it landed.** My first edit bolded the whole `"28 posts"`. The mockup is `<b>28</b> posts` (`:212`) — value bold, noun plain. Corrected in place: the helper now returns the **noun only**, so the two stay separate text nodes.

**3 · `--dur-hover` is a compound value, and the obvious utility would have emitted invalid CSS.** V47's first draft used `duration-[var(--dur-hover)]`. `--dur-hover` is `0.12s ease` (`globals.css:210`), so that expands to `transition-duration: 0.12s ease` — invalid, and it would have **silently dropped the transition** with every gate still green. Caught by reading the four existing consumers instead of assuming the token was a bare time; all four use `[transition:all_var(--dur-hover)]`, which is what shipped.

**4 · The V48 defect was structurally invisible to the existing suite, and the RED proves it.** Every discovery fixture on disk uses counts of 28 / 68 / 2 / 0 — all plural. Reverting `StatLine.tsx` to `origin/main` and re-running the new cell yields `expected 'Đ 14,260 staked|1 posts|1 replies' to contain '1 reply'`. **Same shape as POLISH-1a's Surprise 1:** a green suite that cannot see the case. V37's guard was RED-proved the same way (`expected +0 to be 1`).

---

## Open questions — for Gate C / close-out

**1 · V42's n4 active ring needs a founder ruling.** Built and logged per the standing disposition's "unresolved but purely presentational → build to mockup, log the call". The ladder (n2 / n3 / n4) is defensible but it is mine, not ratified.

**2 · V7's brighter step landed as n3 — one step, not two.** The ruling said "a brighter neutral step" without naming it. n3 (`#545454`) against the n2 hairline (`#404040`) is a real but quiet difference on the dark ground. If it does not read at 1440, n4 is the next stop and it is a one-token edit.

**3 · The thirteen `POLISH-register-ADDITIONS.md` rows are STILL UNAPPLIED.** None of the `PD-2-nn` numbers consume them; that file's apply-checklist is untouched. Stated in the register footer so this PR is not mistaken for having closed them.

**4 · Four D-class deltas are blocked on one small DTO decision, not four.** V13 needs a read-model addition and is genuinely large. But **V15, V16 and V17 all want fields on `HeroPost`, and V16/V17's data is already loaded and thrown away** — `PostSubstrate.supportCount / counterCount / supportDharma / counterDharma` is read at `hero.ts:73` and discarded. **Zero new queries.** `HeroPost` is not in `DebateViewModel`'s transitive closure, so **ADR-0034 D-1 is not tripped**; this is a scope extension, not an ADR question. ⚠ V17's bar is **display-only in the mockup — no buttons.** It is a read-time aggregate, not a vote affordance, and the build must never add controls there.

---

## Next session starts at

**Gate C: the founder's diff-read of the PR.** Nothing merges before it. After Gate C passes, the exact next action is the squash-merge and recording the squash SHA — then **`SIDEBADGE-PRICE`** (V10 + V11), which the founder already ruled ships immediately after this one.

**PERF-1 is FORKED, per its own pre-ruling.** The condition was "cold cost identified AND fix S or M AND separable". It is **not identified** — only candidate-ranked — so it forks as its own plan-then-execute task rather than delaying this batch. Findings that must not be re-derived:

- **The "41 round-trips" figure counts function CALLS, not SQL statements.** `loadPriceSeries` is 4 statements (`price-series.ts:58, 90, 110, 178`) and `selectHeroTopPosts` is 5 (`hero.ts:73, 78, 96, 106, 115`), so `DiscoveryContent`'s second loop is **9N, not 2N**. True total: **1 + 3N + 9N = 97** at `DISCOVERY_GRID_SIZE = 8`.
- **This strengthens the carried thread rather than weakening it.** Warm 1.1s ÷ 97 ≈ **11 ms/trip** (plausible for a warm pooled connection); cold 35.1s ÷ 97 ≈ **362 ms/trip** (still not a per-trip cost). ~34 of the 35 seconds remains unexplained by round-trips, and batching 97 statements down to ~12 buys ~1s of the warm path and none of the cold.
- **Candidates, evidence-ranked.** (a) `@aws-sdk/client-s3` is eagerly on the render path — `page.tsx:9` → `list.ts:11` → `media.ts:7` → `r2.ts:2-9`, static import at module scope, with credential/SigV4 resolution on first `getClient()` (`r2.ts:88-104`). Pure cold, invisible warm. (b) **`vercel.json` sets no `regions`** — default `iad1` against Supabase `ap-south-1`; cold pays TCP+TLS+auth+Supavisor setup cross-region, and POOL-1 §5 confirms warm instances hold established connections. (c) Sentry Node SDK boot in `instrumentation.ts:67-69`, cold-only, before the first request. (d) `force-dynamic` (`page.tsx:18`) does not cause the cost but removes what would amortise it. **Ruled out:** pool sizing — POOL-1 §5 already establishes `/` holds one slot.
- **Rule out first, because it is free:** confirm the four ~35s runs targeted the staging Vercel deployment and not `next dev`. POOL-1 §6 credits "POOL-2 probe" but never states the target URL, and a dev-mode route compile would explain a one-time 30s+ that never reappears warm.
- **Judge the fix on SLOT-SECONDS, not peak connections.** Batching raises peak and collapses hold time. A reviewer holding POOL-2's framing will read the peak rise as a regression. It is not.

---

## Context to preserve

- **Pushed, PR open, NOT merged.** Gate C is a diff-read; do not merge on green CI alone.
- **The delta list uses `Vn`, no hyphen** — the literal POLISH-1-D form (`POLISH-1a.md:5`). Note the precedent distinguishes two registers the kickoff template collapses: the *recon* emitted `D-1…D-4` (hyphenated findings), the *kickoff* minted `V1–V10` (deltas, the build scope). If the founder wants recon output to stay `D-n` until ratification, that is a convention ruling and these renumber.
- **Colour never transferred from the mockup.** Its `:root` is the light era and the shipped ramp is dark **and inverted** (V1 / values-log v0.3 §2 R-1). Every value in this PR was read from `globals.css`. `src/components/discovery/` still contains **zero** raw hex and zero Tailwind palette classes.
- **`LoadingSkeleton.tsx` is untouched.** R8 is unruled (W2.11 T1 ratified no loading primitive; `POLISH-0.md:321`). HALT SET 3. Its non-`DISCOVERY_GRID_SIZE` shape is recorded as PD-2-28 and changed nothing.
- **`POLISH-0.md` §9's "no CC session" was struck**, not softened — it was false when committed, POLISH-1a and 1b having already shipped `src/` changes.
- **`scrollers` belongs to the debate surface, not Discovery.** `POLISH-0` §3's POLISH.2 row listed it and omitted `StatLine`; corrected (PD-2-29). It is real — `src/components/debate/scrollers.tsx`, exporting `PostScroller` / `ReplyScroller`, mounted at `DebateView.tsx:294,330` — and correctly listed on POLISH.3's row, which is unchanged. ⚠ **This log first said "`scrollers` does not exist", which was false**: asserted from a `src/components/discovery/`-scoped grep and stated as a repo-wide negative. Caught at Gate C. **O-2 — a directory-scoped negative is not a tree-wide one.**
- **Gate B2 re-verified this session:** `a27f2bf` (PR #276) is an ancestor of `origin/main` and `formatPricePercent` (`format.ts:211`) is the single percent path, with six call sites. POLISH.2's gate is met.

---

## Time

One session, 2026-08-09. Self-check → six build commits with two RED-then-GREEN rounds → four gate runs → register + method amendments → this log. Full-suite wall-clock 163s. No unattended stretch; no phase ran past its scope guard.
