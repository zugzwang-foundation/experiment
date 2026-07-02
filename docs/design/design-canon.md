# Zugzwang — Design Canon (consolidated · v1.0-era + Wave-2 + DC rulings)

> **Doc:** `docs/design/design-canon.md`
> **Status:** v1.0-draft · authored at **DC.1** (2026-07-02) · committed at **DC.3**
> **Authorship:** web Claude (orchestrator) · ratified by operator · committed by Claude Code
>
> **What this is.** The single consolidated record of the DESIGN phase: the locked surfaces, the locked decisions, motion/timing, copy, spec deltas, the five DC rulings, the per-surface mockup index (the handoff unit), and the CD fine-tune log. It **absorbs** `DESIGN-phase-record.md` + the three by-type consolidations (motion / spec-changes / copy-register), reconciled against the 2026-07-02 rulings. Those four source docs are **superseded by this canon** (delete-after-verify from PK once DC.3 lands).
>
> **The canonical design set** (after DC.3): this canon · `design-language.md` **v0.5** (the living constraint/vocabulary guide) · `design-token-contract.md` **v0.2** (the frozen slot names + monochrome values) · the living guides (`design-workflow.md`, `design-handoff.md`, `visual_precursor_planner.md`, `Research_Report_v2.md`) · `docs/design/mockups/` (the per-surface artifacts, §8).
> **Precedence:** SPEC.1/SPEC.2 > ADRs > this canon > per-surface history. The **v1.0 integration shell** (`DESIGN_integration-shell_v1_0.html`, **PK-only — deliberately not committed**) remains the visual ground truth the canon describes.
> **Data residency:** mockup-phase design artifacts are PK-primary; DC.3 commits the canon set + the per-surface mockups listed in §8. Build scripts stay PK (archival — §9).

---

## §1 — Phase state (what is locked, open, descoped)

**Core (v1.0 lock, 2026-06-17):** Discovery · Market Detail · Reply · Profile · **Bookmark** (a Profile reuse-mode page) — LOCKED at integration-shell v1.0 (= v0.37 renamed). Layout, interaction, and cross-surface navigation are settled; all content is illustrative dummy.

**Wave-2 done-state** (reconciled at DC.1 — supersedes tracker v15's provisional ✅ line):

| Task | State | Artifact / record |
|---|---|---|
| W2.1 auth (modal + first-login journey) | 🔒 locked 06-18 | 2 stills (§8) |
| W2.2 onboarding deck (6 cards, Depth-1) | 🔒 locked 06-29 | 1 still (§8); final copy + artwork → branding wave |
| W2.3 universal back | 🔒 locked 06-18 (function/structure); **visual resolved inside W2.4/5/14** | close-out (no own still) |
| W2.4/.5/.14 global header (timer · visitor · radio slot · back/home · social · research) | 🔒 locked | still v0.2 (§8; v0.1 superseded) |
| W2.6 Dharma graph (market + profile halves) | 🔒 look locked 06-26 | prototype records (§8); throwaway Vite prototype off-repo |
| W2.7 bookmark Staked/Current | ✅ **resolved by DC ruling 1** (§4) — no still needed (page lives in v1.0 shell) | this canon |
| W2.8 fresh-post compose entry | 🔒 locked 06-26 (single relabel `Buy` → `Đ BET`) | 1 still (§8) |
| **W2.9 market-media tab** | **○ OPEN — not designed.** ADR-0026 itself routes the header pixels to a dedicated design-mockup task that must **precede MEDIA.2**; no still or close-out exists. Rides MEDIA.2's kickoff, not a DC blocker. | — |
| W2.10 sell module + cap clamp | ✅ **resolved by DC rulings 2+3** (§4; Option A ratified 06-27) | delta still (§8) + FINAL spec package |
| W2.11 state kit (P1–P6 + placement table) | 🔒 locked 06-27 (45 candidate states → 14 build items) | 1 still (§8) + state ledger CSV |
| **W2.12 feature-guide** | **✕ DESCOPED from Wave-2** (operator ruling 2026-07-02) — re-scoped at a later sweep; UI.18 build row keeps a missing-design-input note | this canon |
| W2.13 post/reply share-card (X image) | 🔒 locked 06-29 (profile-card JPEG stays cut; debate-`.md` split out → EXPORT.1, shipped) | 1 still (§8) |
| W2.14 radio | slot 🔒 in the header still; **hosting resolved by DC ruling 5** (R2 self-host; §21.5 amendment lands at DESIGN.SPEC) | header still + decision log |

**DC.2 status:** pre-closed — both open rulings (W2.7, W2.10) were ratified in the DC.1 session and are folded here. DC.2 collapses to "confirm the rulings are folded" (they are — §4).

---

## §2 — The five core surfaces (final v1.0 state, condensed)

**Discovery** *(locked at integration v0.12)*. Market-discovery grid: hero featured market + 8 grid cards on **one shared carousel index** (hero market + both hero top posts + grid outline ring + active dot move in sync). Cards: image + title + stats + YES/NO bar. Rounded corners (`--r:8px`), ink argument text. Hero posts → the Reply page; author pseuds → Profile. Header identity: **Sign in / Sign up** logged-out, the **nav-identity widget** logged-in (ruling 4, §4).

**Market Detail** *(frozen at integration v0.19 — the d5 "market" view)*. Media, resolution, resolver; two top posts side-by-side (**YES left / NO right**); market YES/NO bar. Post carousel: 4 posts/side. **Side-slot rule:** a bet's composer opens in the **opposite** slot so the side being bet on stays visible. Buy/Sell + position in the slot header; per-side colhead entry button reads **`Đ BET`** (W2.8). Pick is **view-only**.

**Reply** *(the d5 "postview" — per-post thread)*. **Columns are FIXED poles: left = YES, right = NO, for every post.** Column header = the side **price pill only** (`Yes 👍 38%` / `No 👎 62%`). **Support/Counter is a property of the POST, never the column** — it lives on the post's **split bar** (`Đ support ─ total ─ Đ counter`, with the Support/Counter buttons that open the composer) and in the composer ("Support/Counter <author>'s argument"). Replies route into columns by their **own** YES/NO side. Composer opens in the opposite slot.

**Profile** *(frozen v0.18 + lock-cycle extensions)*. Two bands. Top: identity card (PFP + pseudonym + bookmark/download combo) + six account tiles (Wallet value · Positions value · Net P/L · Arguments · Total Support received · Total Counter received) + the graph slot (W2.6 design locked). Bottom "arena": **Positions** table (Position · Argument · Staked · Current; market + Open/Closed filters) + the **argument replica** (D5-synced card anatomy; reply replica keeps its "Replied to …" footer) hosting the **Sell flow**. Owner sees Sell; visitor sees Open; **closed positions are unsellable** (frozen-at-resolution). Up/Down step the *visible filtered* rows; titles are the click targets (↗ arrows removed).

**Bookmark** *(new at v1.0 — a genuine separate page reusing the Profile surface)*. Loads the same profile blob in bookmark mode: forced **visitor** view, list retitled **"Bookmarks,"** headzone bookmark icon active. **Semantics per ruling 1 (§4):** only *someone else's* posts/replies can be bookmarked; the Staked/Current figures shown are **that bookmarked author's** figures on their argument — not the viewer's.

---

## §3 — Locked design decisions (the invariant spine)

1. **Side binding (app-wide, permanent):** YES = **black** · NO = **white**; thumb-up = YES, thumb-down = NO. The poles encode **side only** — *Support/Counter is a separate, post-relative relation* (the v1.0 axis correction; design-language v0.5 §1.3/§6 now match).
2. **Columns are fixed YES/NO poles** in the Reply view; Support/Counter lives on the split bar + composer only, never as a column label or colour.
3. **Composer slide rule:** the composer opens in the **opposite** slot; the bet's side stays visible.
4. **Reply-as-bet** throughout: a reply IS a Support/Counter bet; the split-bar buttons open the composer; every buy carries the mandatory argument; **selling is the only comment-free action**.
5. **"Đ BET" wordmark** end-to-end (entry button `Đ BET` → header `Place your Đ BET` → submit `PLACE Đ BET`; reads as DEBATE).
6. **Pick / carousel-select is view-only** — never mutates a position.
7. **Append-only / frozen-at-resolution** reflected everywhere: closed positions unsellable; resolved surfaces read as locked.
8. **No invented market content** — extra posts reuse on-topic prose; only counts synthesized.
9. **Bookmark = the profile blob in a mode**, not a fork, not a 4th source blob.
10. **`:has()` is banned** (silently dropped CSS blocks in the operator's browser) — JS-toggled body classes instead.
11. **Card anatomy** (all card renders): rounded corners `--r:8px` / `--imgr:6px`; ink argument text; head = avatar · name | SIDE @ entry% | stake → current + right-edge bookmark/download cluster; `Replies · N` inline with enlarged count (`.repn`); split-bar staked total enlarged + ink (`.stkn`); titles are the click targets.
12. **Side chip** = curved rectangle (4px), card-scoped *(reply cards + popover still show pill chips — CD fine-tune log, §10)*.

---

## §4 — The DC rulings (operator-ratified 2026-07-02 · folded, closed)

1. **Bookmark semantics (closes W2.7 + phase-record §7 + spec-changes §7's open question).** You can only bookmark **someone else's** posts/replies. The Staked/Current figures on a bookmarked row are **the bookmarked author's** figures on that argument — never the viewer's. The bookmark page needs no new still; the v1.0 page + this semantics rule are the build spec.
2. **Slippage display (closes W2.10; Option A ratified 2026-06-27).** Deep-liquidity seeding + the per-bet cap `BET_MAX_STAKE` make per-bet impact sub-threshold ⇒ **no slippage warning, no tolerance control, buy or sell**. The d5 "Price impact warning" modal is **RETIRED** (named-retired in design-language v0.5 §3.1 so it is never resurrected). W2.10 collapsed to: the **Sell module** (default = full position, editable partial) + a clean **price / shares / cost-or-proceeds** display. Cap clamp on buy/add only (over-cap = disabled submit + inline "Max Đ N per bet" strip, the W2.11 P3 primitive); **sell is never clamped**.
3. **Partial-sell (closes spec-changes §5's "unspecified").** A partial unwind is **native CPMM behaviour** — sell N shares, the curve reprices, proceeds are credited. **No new mechanism, no extra parameter.** Confirm parameter-free at the build boundary; nothing to spec.
4. **Discovery nav-identity (closes spec-changes §6 / phase-record §7's open item).** Already handled: Discovery's header shows **Sign in / Sign up** logged-out and the **nav-identity widget** (avatar + pseudonym → Profile) logged-in — per the W2.1 Discovery-widget fold-in + the W2.4/5/14 global header. Not a missing widget.
5. **Radio hosting (SPEC.1 §21.5).** **Cloudflare R2 self-host** chosen (the operator creates original music, removing the rights rationale for embed-only). The formal §21.5 amendment/ADR lands at **DESIGN.SPEC's same-commit bump** — noted here, deliberately not authored in DC.

---

## §5 — Motion canon (absorbed from `DESIGN-motion-consolidated`, v1.0 values as implemented)

**Cross-surface (shell):** `go(target, post)` swaps iframes instantly (no transition); `f.contentWindow.focus()` on every navigation; Arrow keys forwarded as `{type:'key'}`.

**Discovery — hero carousel.** One index (0–7) drives hero market + both hero posts + grid ring + active dot **in sync**. Auto-advance **10 s**; the active dot **fills left-to-right over the 10 s** as a countdown, restarting on any change; `‹ ›` / Left-Right advance immediately and **reset** the timer; straight 8-position wrap.

**Market Detail — post carousel** (4 posts/side). Vertical loaders, **20 s** per cycle, ▲/▼ in the inner gutters, no dots. **Stagger:** NO leads YES by **10 s** (columns advance one-after-another). **Pick-a-side:** lifts that side (translateY −5px + shadow) → manual (loader off); the other side keeps auto; toggling swaps + restarts the freed loader (visibility flipped *before* restart — the v0.16 fix; a CSS fill can't animate on `display:none`). Card advance: inner content slides ±14px + fades over **.26 s**; the border never moves. **Sub-view freeze:** composer (`slot.bet`) / `+` popover (`body.ppop`) / debate (`body.postview`) hides controls and freezes both columns. No-side keys: Up/Down grab the most-recently-advanced side; Left/Right pick.

**Reply — reply carousel.** Mirrors Market Detail (20 s, 10 s stagger, lift, .26 s slide). Arrows **and** loader hide whenever any composer/popover is open (the v0.31 specificity fix). Re-kick on `setsub` after a 120 ms tick (iframes render hidden until shown). **Composer slide:** opening a bet composer slides the **opposite** slot's content away (translateX ±36px + fade) and shows the composer there.

**Profile.** **Sell slide:** the replica footer is a fixed **50 px** box; on Sell the footer slides down (translateY 110% + fade) and the sell module replaces it over **.26 s** — fixed height ⇒ never reflows. Reply-footer "Replied to …" clamps to **2 lines** (F1). **Row stepping:** Up/Down step the *currently-visible filtered* rows, wrapping, `scrollIntoView` nearest. `+` popover: ESC / click-out closes; Up/Down yield while open. **V** toggles owner/visitor (demo hotkey) — disabled in bookmark mode.

**Bookmark.** Entry = surface switch + `setsub:'bookmark'` (adds `body.bookmarks` + `body.visitor`, retitles, refreshes). No dedicated transition; headzone bookmark icon shows active state.

**Wave-2 motion (from the W2 close-outs):** auth modal/pane/Turnstile/OTP/deck timings = intent values in the W2.1 block; W2.8 inherits the colhead hover (border→ink) with the slot-slide unchanged; W2.11's kit carries small state-motion deltas per its close-out. **Open (motion):** hero top posts are illustrative dummy for markets 2–8; v1.0 ships **both sides showing arrows + loader by default** (the arrow-default question, resolved).

---

## §6 — Copy canon (absorbed from `DESIGN-copy-register-consolidated`; all strings verbatim from v1.0)

All content is **illustrative dummy** — not final product copy (final copy, microcopy tone, i18n = build-time/branding).

**Global / chrome:** wordmark `ZUGZWANG` · currency glyph `Đ` (Dharma) · nav identity = avatar + pseudonym · pseudonym format `<colour>-<piece>-<NN>` (e.g. `ashen-rook-12`).
**Side / price grammar:** side chip `YES @ 27%` / `NO @ 55%` (side @ entry%) · price pill `Yes 👍 38%` / `No 👎 62%` · market bar `YES 38% … NO 62%` · stake delta `Đ 240 → Đ 310` (staked → current).
**Discovery:** `‹`/`›` (aria Previous/Next market) · card meta `REPLIES · N`, `Đ N STAKED`, `SUPPORT`/`COUNTER` · `IMAGE ATTACHMENT`, `IMG`.
**Market Detail:** demo market/resolution/resolver strings (Mumbai Metro Line 3 set) · `RESOLUTION` · `MARKET MEDIA — IMG / VIDEO`, `LOGO` · `Buy` · `Sell` (colhead entry now **`Đ BET`**, W2.8) · `Your position` `Đ 240 → Đ 310` · `To win Đ 1 → Đ 2.63x` · split bar `SUPPORT Đ 3,800 ─ Đ 10,000 STAKED ─ Đ 6,200 COUNTER` · `POST IMAGE · 640:586`, `IMAGE · SHOWN WHOLE` · `+` (aria Show more / Show full argument).
**Composer (all bet composers):** header `Place your Đ BET` (reply variant: `Support <author>'s argument` / `Counter <author>'s argument`) · `Your argument — required` · counters `58 / 125`, `158 / 2,200 · optional` · `Image`, `Shown whole · any orientation` · `Amount Đ 50` · `To win Đ 126.6` · submit `PLACE Đ BET` · `Confirm bet · Đ 500`, `Cancel`, `×`.
**Reply view:** column headers = price pills only · split-bar triggers `Support` / `Counter` · reply card = side chip + stake delta + bookmark/download (no `↗`, no `SUPPORT/COUNTER · N` head meta).
**Profile:** tiles `Wallet value · Positions value · Net profit / loss · Arguments · Total Support received · Total Counter received` · view chip `Viewing as owner · V toggles` / visitor variant · list `Positions` (→ `Bookmarks`) · filters `Select market ▾`, `Open`/`Closed` · columns `Position · Argument · Staked · Current` · actions `Sell` / `Open` / `Closed` tag · replica reply footer `Replied to <author>'s argument — "<parent quote>"` (2-line clamp) · sell hint `No argument needed — selling is the only comment-free action. Default = full position; edit for a partial sell.`
**Bookmark:** list `Bookmarks` · chip `Your bookmarks` · visitor mode, never Sell.
**Wave-2 strings:** live in the W2 close-outs' copy blocks (auth set, onboarding deck, header cluster, state kit, share card) — carried as-authored; final wording lands at branding/build per the Depth-1 rule.

---

## §7 — Spec-delta canon (absorbed from `DESIGN-spec-changes-consolidated`, reconciled)

1. **Side binding + the axis correction** — as §3.1/§3.2. The old design-language §1.3/§6 conflation is **corrected as of v0.5** (the "required downstream edit" is DONE — 2026-07-02 fork-merge).
2. **Reply-as-bet & composer** — split-bar buttons trigger; reply-column headers reduced to the price pill (v0.32); composer-opposite-slot rule (v0.34).
3. **"Đ BET" wordmark** (operator, DESIGN.5 v1.12) — app-wide, plus the W2.8 entry relabel.
4. **Card anatomy** — as §3.11/§3.12.
5. **Profile surface** — two bands; replica D5-synced (reply replica keeps its footer; head meta removed v0.36); owner/visitor; Closed tag frozen. **Sell module: default full, editable partial — semantics now RESOLVED (rulings 2+3, §4)**; the old "unspecified (open)" marker is retired.
6. **Cross-surface navigation** — nav identity → Profile; market title → overview; argument titles → that post's thread (mockup stand-in: all titles resolve to the demo post `ashen`; production maps each position to its own post id — a reply → its parent's). **Discovery nav-identity: RESOLVED as already-handled (ruling 4)**.
7. **Bookmark page** — profile reuse-mode; **Staked/Current semantics RESOLVED (ruling 1)**; download icon visual-only (§10 CD log).
8. **Standing rules** — no invented content · pick view-only · append-only/frozen · `:has()` ban.
9. **Wave-2 spec deltas** (from the W2 close-outs, carried): W2.1 — F-AUTH-4 override, act-gate supersession, one-account-per-email, the persistent **About** tab, the Discovery widget fold-in; W2.2 — the deck teaches INV-1/2/3 + the Goal, **INV-4 + admin-not-a-participant deliberately live in the About tab, not the deck**; W2.3 — history stack, global back handler, ESC routing, ×-on-pop-ups (build note, no SPEC amendment); W2.4/5/14 — header frame + timer + visitor counter + §21.1 anti-conflation placement + home/social/research additions; W2.11 — the state→primitive→host→§15-code placement table (45→14); W2.13 — share-card = §21.2 extended to reply cards; profile-card JPEG cut; debate-`.md` split to EXPORT (shipped, ADR-0025).

---

## §8 — Per-surface mockup index (THE handoff unit + the DC.3 commit list)

**Commit target:** `docs/design/mockups/` (files renamed only if git objects require ASCII-safe names; index below uses PK filenames). The **integration shell + build scripts stay PK** (archival — §9).

| # | Surface / unit | Artifact (PK filename) | State | DC.3 commit? |
|---|---|---|---|---|
| 1 | Discovery (built surface) | `surface_discovery_v1_0.html` | 🔒 v1.0 (blob-verified output) | ✅ |
| 2 | Market Detail + Reply (built d5 surface) | `surface_d5_v1_0.html` | 🔒 v1.0 (blob-verified output) | ✅ |
| 3 | Profile (+ Bookmark via mode) (built surface) | `surface_profile_v1_0.html` | 🔒 v1.0 (blob-verified output) | ✅ |
| 4 | Mockups README (built-output warning) | `BUILD-FILES-README_v1_0.md` | current | ✅ (as `mockups/README.md`) |
| 5 | Auth modal | `DESIGN_W2_1_auth-modal_mockup-v0_3.html` | 🔒 W2.1 | ✅ |
| 6 | First-login journey | `DESIGN_W2_1_first-login-journey_mockup-v0_1.html` | 🔒 W2.1 | ✅ |
| 7 | Onboarding deck (6 cards) | `DESIGN_W2_2_onboarding-deck_mockup-v0_1.html` | 🔒 W2.2 (Depth-1) | ✅ |
| 8 | Global header (incl. back visual, timer, visitor, radio slot) | `DESIGN_W2_4-5-14_global-header_mockup-v0_2.html` | 🔒 (v0_1 superseded — do not commit) | ✅ |
| 9 | Fresh-post entry (`Đ BET` relabel + states) | `DESIGN_W2_8_entry_mockup-v0_1.html` | 🔒 W2.8 | ✅ |
| 10 | Sell module + cap clamp (delta) | `DESIGN_W2_10_sell-and-clamp_mockup-v0_1.html` | 🔒 by rulings 2+3 | ✅ |
| 11 | State kit P1–P6 + placement table | `DESIGN_W2_11_state-kit_mockup-v0_1.html` | 🔒 W2.11 | ✅ |
| 12 | State ledger (45-state disposition) | `W2.11_state-ledger_reconciled.csv` | named in the W2.11 close-out; **not found in PK — locate before DC.3** | ⚠ pending |
| 13 | Post/reply share card | `DESIGN_W2_13_post-reply-share-card_mockup-v0_1.html` | 🔒 W2.13 | ✅ |
| 14 | Dharma graph (profile + market halves) | `DESIGN-W2_6-graph-prototype-record.md` + `DESIGN-W2_6-profile-graph-CLOSE-OUT.md` | 🔒 look locked (prototype off-repo) | ✅ (records) |
| 15 | Universal back (function/structure) | `DESIGN_W2_3_universal-back_CLOSE-OUT.md` | 🔒 (visual in #8) | ✅ (record) |
| 16 | Integration shell (navigable whole) | `DESIGN_integration-shell_v1_0.html` | 🔒 v1.0 — **PK-only by rule** | ✕ stays PK |
| 17 | Market-media tab | — | **○ W2.9 OPEN** — design still to be produced before MEDIA.2 | — |
| 18 | Feature-guide | — | **✕ W2.12 descoped** (2026-07-02) | — |

**Handoff note (DESIGN.HANDOVER consumes this table):** the per-surface handoff unit = the artifact row(s) above + this canon's relevant sections + design-language v0.5 + the token contract. Locked core surfaces build via the handover (UI.3/4/5 retired); Wave-2 stills feed their named build consumers (W2.1/2 → UI.2; header/back → the app-frame build; W2.11 → all UI.*; W2.13 → UI.14).

---

## §9 — Source-drift + build environment (absorbed from phase-record §9 + the build README)

**The build env cannot reproduce v1.0 — do not rebuild from source.** `build.py` (PK) is at v0.28; everything v0.29→v1.0 is baked into the artifact's blobs. `refine_d5.py`, `refine_reply.py`, and the three *source* mockups live only on the operator's machine; only `add_reply_scroll.py` carries a v0.33-era fix. Running the pipeline today emits **v0.28 and loses the later work**. The three `surface_*_v1_0.html` files are **built OUTPUT** (byte-verified against the blobs) — **never** feed them back through the pipeline (double-transform breakage). The shell is frozen, self-contained, and hand-maintained; the build env is **archival**. Source reconciliation (back-porting v0.29→v1.0 into source + bumping `build.py`) is an **operator-side** task — now **optional / off the critical path**, since the per-surface handover route supersedes shell regeneration (tracker v15: DESIGN.HANDOVER source-drift = optional).

---

## §10 — Claude-Design fine-tune log (deferred to CD — logged, NOT resolved in DC)

Carry these into the CD prompt sheet + sessions; none blocks DC or the handover.

1. **Side-chip shape inconsistency** — curved-rectangle (4px, card-scoped) vs pill chips still on reply cards + the `+` popover. Consolidated as-is; unify visually in CD.
2. **Dead download icon** — the headzone download icon on Profile + Bookmark is visual-only ("later: download profile as a card"). W2.13 revived the *post/reply* share card but the profile-card JPEG **stays cut** — CD either wires the icon to a defined action or removes it; ledger as post-launch UI if kept.
3. **v0.19 polish carry** — `+` box size · the ±1 px no-shift gap on the post-card image · footer separator `|` vs `·`. Pure visual polish from the Market-Detail close-out.

*(Rule: any further pure-polish inconsistency noticed downstream → append here; never absorb into a build task.)*

---

## §11 — Residual open items (properly homed — nothing floating)

| Item | Home | Note |
|---|---|---|
| Reply-target stand-in (all titles → demo post `ashen`) | build-time (forward contract §12) | production maps each position → its own post id; expanding demo data = content task (no-invented-content rule) |
| Allowance (daily-credit) history — no page home | **parked.md** | product-placement call, post-sweep |
| Data-erasure placement (removed from canvas) | **parked.md** | needs a home; later task |
| W2.9 market-media tab still | MEDIA.2 kickoff (design precedes build, per ADR-0026) | see §1/§8 |
| W2.12 feature-guide re-scope | a later sweep | UI.18 keeps the missing-input note |
| Source reconciliation | operator-side, optional | §9 |
| `.dark` block fate + `--destructive` red + off-ramp greys | token contract §3.4 / B-track | code-side, not CD |

---

## §12 — Forward contract (what every downstream build must honor)

Reply-as-bet; mandatory argument on every buy; **selling is the only comment-free action** · columns are **fixed YES/NO poles**; Support/Counter post-relative (split bar + composer) · composer opens in the opposite slot · carousel/pick is view-only · append-only / frozen-at-resolution (closed positions unsellable) · side binding black=YES / white=NO invariant everywhere · bookmark semantics per ruling 1 · **no slippage UI** + cap-clamp-on-buy per rulings 2+3 · cross-surface nav contract: surfaces request `{type:'nav', page, sub, post}`, the host resolves and returns `{type:'setsub', sub, post}` · plus the W2 additions: history-stack back + global header handler + ESC routing + ×-on-pop-ups; the About tab carries the full invariant set (deck carries the how-to-play subset); state kit P1–P6 placements per W2.11.

---

## §13 — Supersession map + changelog

**This canon supersedes (delete-after-verify from PK once DC.3 lands):** `DESIGN-phase-record.md` · `DESIGN-motion-consolidated.md` · `DESIGN-spec-changes-consolidated.md` · `DESIGN-copy-register-consolidated.md` · `DESIGN-PK-consolidation-manifest.md` (its program is complete). **Kept, standalone:** design-language v0.5 · design-token-contract v0.2 · the living guides · the mockups (§8) · the W2 close-outs (historical per-task records; canon is the current-state source).

> **Changelog.**
> **v1.0-draft (2026-07-02, DC.1):** initial consolidation — absorbed the phase record + the three by-type consolidations; folded the five DC rulings (bookmark semantics · slippage/Option A · partial-sell-native · Discovery nav-identity · radio R2); reconciled Wave-2 done-state (**W2.9 OPEN**, **W2.12 descoped**, W2.7/W2.10 closed by ruling); recorded the design-language v0.5 fork-merge + token-contract v0.2 as canon members; built the per-surface mockup index + DC.3 commit list; seeded the CD fine-tune log (3 entries); homed every residual open item.

*End design canon v1.0-draft. Committed at DC.3; branding (B1→B3) fills the token contract; DESIGN.SPEC derives the final value-filled `design.md`; DESIGN.HANDOVER consumes §8.*
