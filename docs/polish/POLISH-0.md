# POLISH.0 — The Method

> **Doc:** `POLISH-0.md` · web-authored, operator-ratified. Committed 2026-08-05. GitHub is canonical; PK is the mirror.
> **Status:** v1.0-draft · authored 2026-07-30 IST at POLISH.0
> **Supersedes:** `POLISH-0_surface-inventory.md` (standalone, same day) — its content is §3 here, with corrections applied. **Discard the standalone.**
> **Companions:** `POLISH-register.md` (the defect record) · `POLISH-0_ruling-register_r2.md` (the open rulings) · `POLISH-RECON-report.md` (the evidence base, operator-local)
> **Ground:** `origin/main` @ `b6495af`. All `src/` evidence from the POLISH recon @ `9d289b3`, valid at `b6495af` (PR #272 was docs-only).

**What this is.** The method that governs POLISH.1 through POLISH.8 — the precedence model, the inventory, the defect record, the routing taxonomy, the order, and the per-surface exit bar. A person who has never seen this project should be able to read this document and run POLISH.1 correctly.

**What this is not.** It is not an inspection. No surface is inspected here.

---

## §0 · Pending ratification

Everything below is authored against **ratified** ground except the clauses named here. Each says what flips if the ruling goes the other way.

| Ruling | Clause it governs | If ruled otherwise |
|---|---|---|
| **R8** | §7 exit bar — the states clause | If T1 stands, five loading skeletons become defects and the exit bar forbids skeletons. If T1 is superseded, canon gains a P7 loading primitive |
| **R16** | §7 — the accessibility line | If A11Y.0 runs before POLISH.2, its floor folds into the exit bar and the `closed (a11y-deferred)` status disappears |
| **R17** | §5 — the B-class routing check | If declined, drop the ADR-0034 test from B-class routing |
| **R18** | §2 — the precedence model | If declined, §2 reverts to P1's four tiers and §8's kickoff procedure loses tiers 1-patch and 3 |
| **R1 · R2 · R3 · R4 · R5 · R6 · R7** | §3 — the "pre-recorded" rows on their surfaces | Disposition changes; the surface pairing does not |

Nothing else in this document waits on a ruling.

---

## §1 · What POLISH is

A per-surface pass comparing each **built** surface to its baselines on **both axes** — visual fidelity *and* functional completeness.

**Lane discipline (do not blur).** Inspection is **design-lane**: operator + web Claude, CD only on referral. No CC, no branch, no PR. **Fixes execute as code-lane PRs under normal gates.** A fix touching auth · bet engine · ledger · commentary/moderation keeps the full plan→execute + named-reviewer cascade. POLISH is a hybrid node with a design-lane owner.

**Roles.** Operator captures · web compares · **CD only on referral.** `design-handoff.md` §7 forbids iterating a built surface in CD — code is the source of truth post-handoff. Routine visual defects go straight to a code-lane batch. CD is used only for *"this is wrong and we don't know what right looks like"* — an R-class visual question — and then via fresh screenshots into a new exploration.

**Standing rule.** Never polish a surface with an open build PR against it.

---

## §2 · The precedence model

**⚠ Pending R18.** As ratified at P1 the model has four tiers. Four investigations at POLISH.0 found that three of four apparent divergences resolved on documents the four-tier model does not name. The proposed five-tier model:

| Tier | Source | Note |
|---|---|---|
| **1** | SPEC.1 · SPEC.2 · ADRs — **patch records read before the decision body** | ADR-0017 carries P1/P2/P3; ADR-0023 carries one. A patch record amends the body in place. Reading ADR-0017's Decision Outcome and stopping yields four ratified filter modes that were retired at P3 |
| **2** | `design-canon.md` §4 rulings · §10 CD log · the CD close-outs · values-log v0.3 | These override mockup pixels where they speak |
| **3** | **Build-law** — `docs/plans/<SLOT>.md` + its plan-phase and execute close-outs | Supersedes the **mockup** on presentation decisions. **Never** supersedes tiers 1–2 |
| **4** | The locked mockup | Layout / type / spacing, wherever tiers 1–3 are silent |
| **5** | The CD export bundle | **Lossy reference, never canon.** Cited nowhere in this document, by design |

**Hygiene rider.** A tier-3 ruling that supersedes a mockup **appends to canon §10**. §10 already carries the rule — *"any further pure-polish inconsistency noticed downstream → append here; never absorb into a build task"* — it simply was not used for the A7 page↔modal ruling.

### §2.1 · The supersession list

Every row is a place where later ratified work overrode an earlier baseline. **An inspector without this list files each one as a defect.** Four buckets, and the bucket is the whole point.

**A · Ratified, and the code honours it → never filed. Disposition `superseded`.**

| Override | Supersedes | Source |
|---|---|---|
| Countdown is digits-only `DD:HH:MM` — no unit labels, no `TO FREEZE` | the mockup's labeled timer | canon §10 R-2 · values-log v0.3 |
| Graph pair off the neutral ramp (`--graph-yes #737373` / `--graph-no #fafafa`), bound by token **name** not draw order | token-ramp expectation | values-log v0.3 · CI-pinned |
| Pop-up carries **no REPORT** control | the v1.11 pop-up | CD-A, 2026-07-14 |
| **Auth is full pages hosting the W2.1 card** — card content only, no modal chrome, backdrop or dismiss | W2.1's *"modal over dimmed app, not full-page"* | **`docs/plans/UI-A7.md` ruling 1**, operator-ratified 2026-07-21. OAuth redirect kills a modal; the onboarding gate is a full-page flow |
| **Bet entry reads `Đ BET`, not `Buy`** | the d5 mockup's `tradebtn` label | W2.8 (2026-06-26), nine days after the d5 lock · canon §7 item 3 |
| **No ranking mode selector.** Top order always, with the P2 latest-interleave. Lane dominance renders as a **badge**: three names (Most Debated · Highest Stakes · Contested), **Newest is not a badge**, one badge per badged post, most posts carry none | ADR-0017's own Decision Outcome (four selectable filter modes) | **ADR-0017 patch record P3**, 2026-06-23 |
| **Price-bar percentage labels are not controls** — `role="img"` + `aria-label`; percents are plain spans | mockup `:1038`/`:1040`, where they call `pick()` | **Pending R10** — a founder-accepted divergence, appends to canon §10 |

**B · Ratified, and the code does NOT honour it → a pre-recorded defect, class V.**

| Override | Built state | Source |
|---|---|---|
| Card read affordance = **"Read more"**, sentence case, own line, flush left, 11.5px/600, `#989898` → `#FAFAFA` hover | **`<Plus /> Full`** (`PostCard.tsx:88-95`). `Read more` has **zero** occurrences repo-wide | CD-A, 2026-07-14. **Pending R4** |

**C · Ratified, code state unverified → a first-order check at the surface, not a supersession.**

| Override | What to check | Source |
|---|---|---|
| Slot-header geometry = CD-final px | `SlotHeader.tsx:111` `min-h-[34px] py-[7px] text-[13px]`, `:125` `gap-[5px] text-[19px]` against values-log §1 item 6 | canon §10 R-5. **R14** |
| Card media clips at `--imgmax` 160px in-card; renders **whole** in the pop-up | both halves | CD-A (retires WI-5). **R14** |

**D · No POLISH surface — belongs to a future build.**

| Override | Home |
|---|---|
| Share-card lockup may shorten (mark + wordmark tightening) | canon §10 R-3 → the UI.14 build, which is SPEC-blocked |

### §2.2 · Known-stale baselines

`design-language.md:178` and `:227` still describe the debate mode selector as real. `docs/plans/DEBATE.4.md:44` flags them stale and nobody corrected them. **Pending R19** — correct at C3, in the same commit as the CD-A close-out. Until then, treat those two lines as void.

SPEC.1 §18's out-of-scope catalogue appears to still list four shipped modes, stale against ADR-0017 P3. **Verify against §9's annotation before treating it as anything.** Spec hygiene → DESIGN.SPEC, not POLISH's to fix.

---

## §3 · The inventory

Order follows the ratified P6 sequence. **Tier-1 entries marked ⟐ are candidates from memory and the tracker, not documents read at POLISH.0 — verify at that surface's kickoff.**

### POLISH.1 · Shell + branded header/nav

| | |
|---|---|
| **Surface** | Root layout · `(public)` layout · `(auth)` layout · `GlobalHeader` and cluster. Renders on **7 routes**: `/` · `/bookmarks` · `/m/[slug]` · `/u/[pseudonym]` · `/sign-in` · `/sign-in/otp` · `/onboarding`. **Not** on `/admin/*` |
| **Components** | `app/layout.tsx` · `(public)/layout.tsx` · `(auth)/layout.tsx` · `GlobalHeader` · `BrandCluster` · `CountdownDigits` · `countdown-format.ts` · `VisitorCounter` · `HeaderNav` · `RadioSlot` |
| **Build row** | UI.A1 · UI.13 · BRIDGE |
| **Tier 4** | `DESIGN_W2_4-5-14_global-header_mockup-v0_2.html` (**v0_1 superseded — do not read**) |
| **Tier 3** | `docs/plans/UI-A1.md` + `ZUGZWANG-UI-A1_CLOSE-OUT.md` — carries the **ratified omissions**: Social · Research · **RULES** · Đ-info · visitor *(visitor later added at UI.13)* |
| **Tier 2** | canon §10 R-2 (timer) · values-log v0.3 header-cluster geometry · canon §7 item 9 (header frame · timer · visitor · §21.1 anti-conflation placement) |
| **Tier 1** | SPEC.1 **§21.1** visitor counter + anti-conflation ⟐ · §21.5 radio *(UI.17 SPEC-blocked — the slot renders, the feature does not)* · **ADR-0023** + its 2026-07-17 patch record (the `(auth)` header mount) |
| **Invariant obligations** | None of the five render here. **One hard tier-1 check does: §21.1 anti-conflation** — the visitor counter is never co-located with `n`, stake or Dharma |
| **Cross-surface** | None |
| **Pre-recorded** | **UI.11** AGPL source offer absent repo-wide (B4) · **P4 global banner absent** (R2/B8) · **`not-found.tsx` + `global-error.tsx` absent** (R3/B10) · Social/Research = accepted divergence (OQ-3/4) · **countdown cell count: verify 8 on screen, not 9** — the recon's arithmetic was wrong, the code comment is right · `--elev-2` has **no live consumer**; expect no tier-2 elevation anywhere |

### POLISH.7a · Auth surfaces

| | |
|---|---|
| **Surface** | `/sign-in` · `/sign-in/otp` · **`/onboarding`** — all three skinned and visually verified at UI.A7, all PASS. *(Corrected: the standalone inventory put `/onboarding` in 7b. What is blocked on O1 is the 6-card **deck**, a different artifact.)* |
| **Build row** | UI.A7 · AUTH-OTP-DELIVERY |
| **Tier 4** | `DESIGN_W2_1_auth-modal_mockup-v0_3.html` · `DESIGN_W2_1_first-login-journey_mockup-v0_1.html` |
| **Tier 3** | **`docs/plans/UI-A7.md` — load-bearing.** Ruling 1: full pages, card content only. Ruling 4: **the mockup is a structure/layout reference, not a value source** — it predates BRIDGE, so its own token names are never copied; everything resolves against contract v0.4 |
| **Tier 2** | canon §7 item 9 (W2.1) — F-AUTH-4 override → implicit footer acceptance · one-account-per-email · one picker behind all triggers, new-vs-returning silent · R1 silent identity (appears in nav; reveal is deck card 1) |
| **Tier 1** | SPEC.1 §13 F-AUTH-* ⟐ · **ADR-0004** ⟐ · **ADR-0033** OTP boot guard — *deliberately FATAL* ⟐ |
| **Invariant obligations** | None render here |
| **Cross-surface** | None |
| **Pre-recorded** | **Turnstile is not wired** — placeholder token, staging runs always-pass test keys, so W2.1's three ratified Turnstile states cannot be exercised → `data-blocked` pending AUTH-TURNSTILE-WIRE · **raw error codes** (`otp_invalid`, `rate_limited`) render to users → AUTH-ERROR-COPY, routed here under G3 · ToS/Privacy bodies are lorem-ipsum on `/onboarding`, pending LEGAL.1 → content-blocked, one element |

### POLISH.2 · Discovery (`/`)

| | |
|---|---|
| **Surface** | `/` — server, `force-dynamic`, in-page `<Suspense>` (deliberately **no** route-group `loading.tsx`, so it doesn't blanket `/m/[slug]` — `page.tsx:28-30`) |
| **Components** | `DiscoveryCarousel` · `DiscoveryGrid` · `HeroPanels` · `MarketCard` · `PriceSparkline` · `scrollers` · `EmptyState` · `ErrorState` · `LoadingSkeleton` |
| **Build row** | UI.A4 · UI.19 |
| **Tier 4** | `surface_discovery_v1_0.html` |
| **Tier 3** | `docs/plans/UI-A4.md` + close-out |
| **Tier 2** | canon §2 — hero + 8 grid cards on **one shared carousel index** (hero market, both hero top posts, grid outline ring, active dot move in sync) · canon §5 carousel motion · values-log v0.3 §1 item 1 (sparkline + hero renders, **series-bound** — honoured) · canon §4 ruling 4 (nav-identity already-handled) |
| **Tier 1** | **ADR-0017 + P2 + P3** — Top order with latest-interleave; **no selector**; badge vocabulary ⟐ · `RANKING.md` ⟐ |
| **Invariant obligations** | Frozen side badge (`HeroPanels:127`) · no vote affordance |
| **Cross-surface** | Side badge |
| **Pre-recorded** | **PCT.ROUND** — YES%+NO% can render 101 (B2) · R9 empty-state consistency · R8 `LoadingSkeleton` · **there is no participant market-list route** and none is expected — Discovery is a bounded carousel over `listOpenMarkets` capped at `DISCOVERY_GRID_SIZE` |

### POLISH.3 · Market Detail (`/m/[slug]`) — the heaviest row

| | |
|---|---|
| **Surface** | `/m/[slug]` → `DebateView`. **Two mutually exclusive arms**: market view (`PostScroller`) and post-focus view (`PostFocusHeader` + `ReplyScroller`), toggled at `DebateView.tsx:177/:272` |
| **Components** | `DebateView` · `MarketHeader` (+`LifecycleBadge`) · `MarketPriceChartHost/Card/Overlay` · `MarketPriceChart` · `DebateColumn` · `PostCard` · `PostFocusHeader` · `ReplyCard` · `ReplyPreview` · `scrollers` (+`EmptySideCTA`) · `AggregateFooter` · `ArgProfile` · `PriceBar` · `placeholders` · `dialogs` (`PostPopup`) · `badges` |
| **Build row** | DEBATE.4 · UI.19 (both slices) · MEDIA.2 *(build status unconfirmed)* |
| **Tier 4** | `surface_d5_v1_0.html` |
| **Tier 3** | `docs/plans/DEBATE.4.md` — **includes the stale-doc flag at `:44`** · `docs/plans/UI-19*.md` + `docs/logs/UI-19-log.md` (committed at PR #274) |
| **Tier 2 — five documents** | ① canon §2 Market Detail · ② **`DESIGN_popup-redesign_CLOSE-OUT.md` (CD-A)** — ⚠ **PK-only, uncommitted; C3 must land first** · ③ `DESIGN_W2_11_state-kit_mockup-v0_1.html` + the W2.11 close-out · ④ values-log v0.3 §1 item 1 (chart renders) + item 4 (engaged-slot backlight) · ⑤ canon §10 R-5 (**R14**) |
| **Tier 1** | SPEC.1 §9 debate flows + **F-DEBATE-4** interval polling ⟐ · §16.1 constant ⟐ · §17 acceptance ⟐ · **ADR-0017 (+P1/P2/P3)** · **ADR-0018** · **ADR-0020/0021** masking · **ADR-0025** export binds this DTO · **ADR-0034** viewer-scoped reads live outside `DebateViewModel` · **SPEC.CHART** — unread, **R13** |
| **Invariant obligations** | **All five.** Frozen side badge · position marker (default none) · **no vote affordance** *(pre-verified: zero interactive; thumb glyphs are `aria-hidden` static SVG)* · mandatory comment on buy *(pre-verified: one submit path, three client belts + a server belt)* · read-only terminal *(pre-verified: nine mechanisms)* |
| **Cross-surface** | **All six** |
| **Positive criteria from ADR-0017 P3** | Order is **Top with latest-interleave**, never a selector · a badge renders **only** on a post clearing `k_lane`/`floor_lane` · **exactly one** badge per badged post (highest-margin lane) · **most posts carry none** · **"Newest" never appears as a badge** |
| **Pre-recorded** | R1 `PostCard` triggers · R4 Read more · R5 pop-up parity · R6 pop-up composer · B1 bookmark add inert · B2 PCT.ROUND · B3 F-DEBATE-4 unverified · **no `loading.tsx`, `error.tsx` or `not-found.tsx` on this route** — and unlike Discovery's, the omission is undocumented |

### POLISH.4 · Composers + Sell module

| | |
|---|---|
| **Scope** | Composer-specific criteria **only** (P8). Composers mount on `/m/[slug]`; the sell module on `/u/[pseudonym]`. **Host chrome belongs to .3 and .5** |
| **Components** | `BetComposer` · `SlotHeader` · `PositionStrip` · `ReplySplitBar` · `SellModule` · `copy.ts` · `payload.ts` · `requests.ts` · `ImageAttach` · `ErrorStrip` · `AuthGateSlot` |
| **Build row** | UI.A2 (substrate) · UI.A3 (composers) · UI.A5 (sell mount) |
| **Tier 4** | `DESIGN_W2_8_entry_mockup-v0_1.html` · `DESIGN_W2_10_sell-and-clamp_mockup-v0_1.html` · the composer modules in `surface_d5_v1_0.html` |
| **Tier 3** | `docs/plans/UI-A2.md` (SG-1…SG-7 — **note SG-3 is superseded as encoding by ADR-0034 D-5**) · `docs/plans/UI-A3.md` (the relation→side derivation matrix; note its SG-3 is a *different* SG-3) |
| **Tier 2** | canon §4 **rulings 2+3** — Option A: no slippage warning, no tolerance control; price-impact modal **named-retired**; **sell is never clamped**; cap clamp **buy-only** · canon §7 item 2 (split-bar triggers · **composer opens in the opposite slot**) · item 3 (**Đ BET** app-wide) · values-log §1 item 4 (engaged-slot backlight) |
| **Tier 1** | SPEC.1 **INV-1 / INV-2 / INV-3** · §10.8 display rules (DROUND) · **F-BET-9** slippage-warning UI retired (PR #225) · **ADR-0013** ⟐ · **ADR-0015** ⟐ · **ADR-0031** ⟐ · **ADR-0014** ⟐ |
| **Invariant obligations** | Mandatory comment on every buy · sell is the only comment-free action · single-side UX · side **minted** at composer-open, immutable per instance |
| **Cross-surface** | **"Đ BET"** *(pre-verified — `copy.ts:40,43`)* · side badge |
| **Pre-recorded** | R11 sell hidden-vs-disabled (the decision is server-side; the render is .5's) |

### POLISH.5 · Profile (`/u/[pseudonym]`)

| | |
|---|---|
| **Surface** | `/u/[pseudonym]` — server async, **has `loading.tsx` and `error.tsx`**. Owner and visitor arms differ **at the DTO** |
| **Components** | `IdentityCard` · `ProfileTiles` · `ProfileGraph` / `ProfileGraphCard` / `ProfileGraphOverlay` / `ProfileChart` (+`FlipMarker`) · `PositionsTable` · `ArgumentList` · `profile/states.tsx` |
| **Build row** | UI.A5 |
| **Tier 4** | `surface_profile_v1_0.html` |
| **Tier 3** | `docs/plans/UI-A5.md` (+ plan-v2) — carries the design-authority digest and the **off-repo graph-layer port** note |
| **Tier 2** | canon §2 — two bands, identity card + **six tiles** + graph slot; Positions table + the **argument replica** (D5-synced; reply replica keeps its footer) · canon §5 motion — sell slide, replica footer a **fixed 50px box**, translateY 110% + fade over **.26s**, never reflows; `:has()` **banned** · canon §6 copy · **W2.6 records** — fixed 0–10,000 cumulative Y · expanded default Cumulative + market filter · per-market autoscale · nodes = own posts+replies, expanded only · flip/exit marker · x-domain **Sep 15 → Nov 5 2026**, endpoint labels only · **W2.13 R2** — remove the profile download-card icon, **keep** the bookmark icon |
| **Tier 1** | SPEC.1 **§23** Net P/L + Đb basis ⟐ · §10.8 ⟐ · **ADR-0011** ⟐ · **ADR-0032** · **ADR-0034 D-7** — this read model is **outside** the debate rule |
| **Invariant obligations** | Position marker · frozen side badge · read-only terminal |
| **Cross-surface** | Side chip *(hand-rolled — R12)* · position marker *(hand-rolled — R12)* · "Read more" *(R4)* · read-only terminal |
| **Pre-recorded** | B1 bookmark add inert · R8 `ProfileLoading` · R9 · R11 · R12 · verify the **W2.13 R2** icon delta actually landed |
| **Do not run in parallel** | GRAPH-DEFER · GRAPH-PERF |

### POLISH.6 · Bookmarks (`/bookmarks`)

| | |
|---|---|
| **Surface** | `/bookmarks` — server async, **has `loading.tsx` and `error.tsx`** |
| **Components** | `BookmarkCard` · `bookmarks/states.tsx` |
| **Build row** | UI.A6 |
| **Tier 4** | **No mockup of its own — correct, not a gap.** Canon §1: W2.7 needed *"no still — the page lives in the v1.0 shell."* The baseline is the **bookmark reuse-mode inside `surface_profile_v1_0.html`**. State this at kickoff or .6 stalls hunting a file that was deliberately never made |
| **Tier 3** | `docs/plans/UI-A6.md` — **⚠ §11 `:251` is OVERRIDDEN by ADR-0034 D-6** (placement clause only; `:242`, `:248`, `:254` stand) |
| **Tier 2** | canon §4 **ruling 1** — bookmarks cover **only others'** posts/replies; **Staked / Current are the bookmarked AUTHOR's figures**, not the viewer's · canon §7 item 7 — download icon is **visual-only** |
| **Tier 1** | **ADR-0032** — invariant-neutral: comment-free but no stake and no position · **ADR-0034 D-7** — `bookmarks/list.ts` is viewer-keyed, feeds no export, sits **outside** the debate rule |
| **Invariant obligations** | Frozen side badge · position marker · read-only terminal |
| **Cross-surface** | Side chip *(R12)* · position marker *(R12)* · "Read more" *(R4)* |
| **Pre-recorded** | B1 — the add path is inert here too; `BookmarkCard` is already named "a reimplementation" in that plan · R8 · R9 · R12 |

### POLISH.8 · Admin Centre

| | |
|---|---|
| **Surface** | **7 routes** — `/admin` (pure `redirect`, no UI) · `/admin/login` · `/admin/markets` · `/admin/markets/new` · `/admin/markets/[marketId]` · `/admin/moderation` · `/admin/moderation/audit` |
| **Structural note** | **There is deliberately no `(admin)/layout.tsx`** — an admin layout would wrap and therefore loop the in-group `/admin/login` page. Each page renders `<AdminTabs>` itself. **Consequence: admin has no `GlobalHeader` and no shell.** §7's shell criteria are **exempt here** — otherwise eight checks read as failures |
| **Components** | `AdminTabs` · `CreateMarketForm` · `TerminalActions` · `ReviewFeed` · `NeedsResolutionCount` · `SearchForm` / `AuditRow` |
| **Build row** | UI.6 |
| **Tier 4** | **NONE** — ratified at P9 |
| **Tier 3** | `docs/plans/UI-6.md` + `docs/logs/UI-6-log.md` |
| **Tier 2** | design-language §7 — *"admin's full visual language is a later pass"* |
| **Tier 1** | **ADR-0010** ⟐ · **ADR-0020** · **ADR-0021** · **ADR-0027** ⟐ · **ADR-0028** ⟐ |
| **Baseline (P9)** | Token consistency + functional completeness + **one hard invariant check: no bet, comment or position affordance exists anywhere under `(admin)`** |
| **Invariant check** | ✅ **Pre-verified.** The only mutating admin controls are sign-in · create market · seed+open · close/resolve/void/correct · remove content · ban author. `BetComposer`, `SellModule`, `PositionsTable` and every `debate/` component are imported **only** from `(public)` |
| **Pre-recorded** | R7 — `text-white` at `audit/page.tsx:75`, the only Tailwind palette colour class in `src/` |

### POLISH.7b · Onboarding deck + coach-marks — ⛔ blocked

| | |
|---|---|
| **Scope** | The **6-card deck** and the coach-mark guide. **Not** the `/onboarding` page, which is 7a |
| **Tier 4** | `DESIGN_W2_2_onboarding-deck_mockup-v0_1.html` — **O1-DECK is actively re-editing it**, so the baseline is in motion |
| **Tier 2** | canon §7 item 9 (W2.2) — the deck teaches **INV-1/2/3 + the Goal**; **INV-4 and admin-not-a-participant deliberately live in the About/Rules tab, not the deck**. Deck is **not skippable** on first login |
| **Blocked on** | O1-DECK · O1-GUIDE (design first; build gated on a spec line **and an `intro-seen` migration** — DDL, full ritual) |
| **⚠ Schedule note** | **RULES was a ratified omission from the header at UI.A1**, and O1-DECK *"also serves Q8 About/Rules via the re-show tab."* So the full invariant set's only user-facing home sits behind **O1 — the one workstream with no owner and no date**, on an experiment whose claim rests on participants understanding the rules. Not an orphan; a schedule dependency worth a date |

### Surfaces with no POLISH row — named, not skipped

| Surface | Status |
|---|---|
| **The 404 surface** | **Does not exist.** `notFound()` fires from six live sites; each lands on Next's default page. R3 / B10 |
| **Market-media carousel (MEDIA.2)** | W2.9 was **ratified design-at-build** — builds direct from ADR-0026 #6/#7 + canon §5 motion, founder eyeball at PR. **Build status unconfirmed.** If built it folds into .3; if not it is a build row |
| **UI.15 debate `.md` download** | Route exists (`/m/[slug]/export`); acceptance not demonstrated. B5 |
| **UI.1 Landing · UI.7 Leaderboards · UI.8 OG cards** | Conditional on RECON-2. Mockup **and** SPEC line present → CC builds, **polished at its own build**. Either missing → spec-first, not build-ready |
| **UI.10 ToS/Privacy** | Gated on LEGAL.1 ← HARDEN.6, founder-deferred |
| **UI.14 share card** | SPEC-blocked. Its supersession row belongs to that build |
| **UI.17 radio** | The slot renders; the feature is SPEC-blocked on SPEC.1 §21.5. .1 inspects the **slot** |
| **UI.18 feature guide** | W2.12 descoped; re-scoped into O1-GUIDE |

---

## §4 · The defect record

**Home:** `POLISH-register.md`, standalone, **PK-primary**, web-authored (P3). The tracker sequences phases, not defects; eight surfaces × N defects would drown it. GitHub issues fragment a lane that runs without CC. The register emits **batched** rows into the tracker at each surface close.

**ID:** `PD-<surface>-<nn>` — e.g. `PD-3-07`. Stable forever; never renumbered, never reused.

**Fields:**

| Field | Values |
|---|---|
| `id` | `PD-<surface>-<nn>` |
| `surface` | POLISH.1 … .8 |
| `title` | one line |
| `class` | **V · F · B · S · R** (§5) |
| `disposition` | `routed` · `superseded` · `data-blocked` · `duplicate-of-known` · `accepted-divergence` |
| `status` | `open` · `routed` · `fixed` · `verified` · `closed` |
| `evidence` | capture filename(s) + `file:line` where known |
| `baseline` | the tier and document the defect is *against* — a defect with no baseline is class **S**, not V |
| `root_cause` | optional; groups symptoms of one cause across surfaces (e.g. R12's three `PositionMarker` implementations) |
| `routed_to` | the PR, tracker row, spec halt, or ruling |

**The `baseline` field is load-bearing.** If an inspector cannot name the tier and document a thing violates, it is not a visual defect — it is a spec gap. That test is what keeps POLISH from becoming taste.

---

## §5 · The routing taxonomy

**Class** — what kind of defect it is. **Disposition** — what happens to it. They are orthogonal.

| Class | Definition | Route |
|---|---|---|
| **V** | Visual — token usage, spacing, type, layout | Design-lane batch, **one PR per surface, never cross-surface** so a regression bisects to a surface. Ultracode-eligible |
| **F** | Functional — the affordance exists and does not work | Code-lane row, normal gates |
| **B** | Backend gap — the surface cannot be correct without a missing read model, endpoint or invariant | Code-lane row. **Full ritual if it touches auth · engine · ledger · moderation.** ⚠ **Pending R17:** tested against **ADR-0034 D-1** before routing — if the fix would add a field to `DebateViewModel` or any type it transitively contains, it is **re-scoped, not built** |
| **S** | Spec gap — no ratified spec for what it should do | **SPEC-FIRST halt. No build.** |
| **R** | Ruling needed — a missing product decision | Founder |

**B and S are never fixed inline during a visual pass.**

| Disposition | Meaning |
|---|---|
| `routed` | sent to its class's destination |
| `superseded` | cited against §2.1 bucket A — logged, never becomes work |
| `data-blocked` | unjudgeable because staging's data is engine-bypassed; re-checked after STAGING-PARITY |
| `duplicate-of-known` | already recorded in §3's pre-recorded rows or the ruling register |
| `accepted-divergence` | **founder only** (P12). Appends to canon §10 |

---

## §6 · Order and gates

Ratified at P6: **`.1 shell → .7a auth → .2 Discovery → .3 Market Detail → .4 Composers → .5 Profile → .6 Bookmarks → .8 Admin → .7b onboarding`**

Shell first is not arbitrary — shell defects replicate onto every other surface, so fixing a header token after six surfaces means re-polishing six. Auth second because it is data-light, while STAGING-PARITY's engine-driven data lands for the data-heavy surfaces that follow.

**Gates:** `.1` needs B4 · B8 · B10 — **three CC-HEAVY items** · `.2` needs B2 · `.3` needs B1 · B2 · B3 · C3 (the CD-A commit) · `.4` needs B1 · `.5` and `.6` need B1 · `.7a` ships now · `.8` ships now, and is **pullable forward** if a founder slot opens early — it has no mockup dependency · `.7b` ⛔ O1.

**Environment (P5):** staging, **after STAGING.ADVANCE**. Staging data is not trustworthy — 37 of 39 bet rows have no events because fixtures bypass the engine — so anything unjudgeable for that reason is `data-blocked` and re-checked once STAGING-PARITY's engine-driven data lands. One pass per surface; founder hours are the ceiling.

**Capture (P10):** one PNG per state, `POLISH-<n>_<surface>_<state>.png`, pinned viewport **1440 desktop**. Operator-local; the register cites filenames.

---

## §7 · The per-surface exit bar

A surface closes when all of the following hold.

1. **Parity** with its baselines on layout, type and spacing — subject to §2.1, and read in tier order per §2.
2. **Every invariant-visual obligation present** (`design-handoff.md` §4): frozen YES/NO side badge on every post/reply, never changing · position marker none/Flipped/Exited, **none is the default** · **no vote affordance anywhere** · mandatory comment field on every buy, sell the only comment-free action · single-side UX, and resolved/voided/frozen render read-only.
3. **Every interactive affordance functional end-to-end.**
4. **All states rendered** — per **W2.11's kit P1–P6** and its placement table, not an ad-hoc list. ⚠ The state-ledger CSV is **confirmed absent** from both PK and the repo; the 14 build items are pinned from the W2.11 close-out and **the CSV is recorded as lost — do not stall on it.** ⚠ **Pending R8** on whether loading skeletons belong at all.
5. **Cross-surface criteria**, on every surface that hosts the primitive: **"Đ BET"** · **"Read more"** · frozen side badge · **no vote affordance** · position marker default-none · read-only on terminal states.
6. **Token usage**, not value. Value is CI-guarded (`tokens-monochrome.test.ts` pins the 11-token hex census R=G=B, exact pins on poles/ground/graph/destructive, bans `--color-brand`). POLISH checks the gap CI misses: raw literals and wrong semantic slots. ⚠ The guard does **not** catch Tailwind palette classes — R15 closes that.
7. **Out of scope by ruling, never filed:** viewport and responsive findings (**G1 — desktop only, 1440, no mobile**). A responsive observation takes disposition `superseded` citing G1.

**Closing status:** surfaces close as **`closed (a11y-deferred)`** until A11Y.0 rules. ⚠ Pending R16 — if A11Y.0 runs before POLISH.2 its floor folds in here and the qualifier disappears.

---

## §8 · Per-surface kickoff procedure

⚠ **Pending R18.** Before inspecting any surface, read in this order:

1. Its **tier-1** documents — **patch records first**, then the decision body.
2. Its **tier-2** rows in §3.
3. Its **tier-3 build-law**: `docs/plans/<SLOT>.md` and its plan-phase and execute close-outs.
4. Its **tier-4** mockup.
5. §2.1's supersession list and §3's pre-recorded rows for that surface.

Then verify the gates in §6 are actually closed — *a listed dependency is not a completed one* — and confirm no build PR is open against the surface.

**Why step 3 exists.** At POLISH.0, four apparent divergences were investigated. Three resolved on documents outside P1's four tiers: the auth page↔modal ruling in `UI-A7.md`, the About/Rules ownership in the UI.A1 close-out, and the ranking-selector retirement in ADR-0017's patch record P3. Only one — "Read more" — was a genuine defect. **An inspector who skips step 3 will file three false defects for every real one.**

---

## §9 · What POLISH does not do

No code · no `src/` change · no CC session · no PR · no DDL, migration, event type or ADR · no SPEC edit · no rewriting `design-handoff.md` or `design-workflow.md`.

Not re-litigated: W2.7 bookmark semantics · W2.10 slippage Option A · the brand accent (ratified **OUT**, true-neutral) · Social/Research (accepted divergence, founder-deferred) · G1 desktop-only.

Explicitly out: **`MOD-REPORT-PATH`** — its own P0 chat. ADR-0021's reactive pipeline needs a user-facing trigger and none is designed; CD-A stripped REPORT from the pop-up and no policy decision recorded that user reporting is out of scope. It is child-safety adjacent with real lead time. **POLISH.3 inherits a decision; it does not discover a hole.**

Also out: O1 · accessibility (→ A11Y.0) · HARDEN.6 · PFP.1 · UI.14 / SPEC.SHARE.

---

*Authored by web Claude, 2026-07-30 IST. Ground `origin/main` @ `b6495af`. Every §3 row is traceable to `POLISH-RECON-report.md` or a named PK canon document. Tier-1 entries marked ⟐ are unverified candidates. Nothing here has been built, planned or committed.*
