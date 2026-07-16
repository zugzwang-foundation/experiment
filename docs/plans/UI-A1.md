# UI.A1 — Foundation: branded global header + shell polish + DEBATE.4 rebrand pass

> **Status:** reviewed — final web review passed · operator-ratified 2026-07-17
> **Date:** 2026-07-16
> **Author:** Hrishikesh + Claude Code (Phase 1 tab, Fable 5)
> **Critical-path?** no — Standard, web-gated per `docs/plans/UI-LANE.md` §2 A1 ("shared foundation"). The one scope-line question (OQ-1) is **ratified**: A1 adds a single **additive** `src/app/(auth)/layout.tsx`; zero existing auth files are edited (standing law).
> **Plan PR / commit:** committed via docs/ui-a1-plan (PR + squash SHA recorded at the A1 close-out)

---

## Tracker context

UI-LANE.md §2 row A1 (BINDING scope, verbatim):

> | A1 | Foundation | Branded global header + nav (W2.4-5-14 v0_2) replacing the throwaway · tokens verified on all real routes · shell polish · DEBATE.4 rebrand pass (stray-value sweep + branded-header integration) | Standard, web-gated (shared foundation) | ADR-0023 · canon §8 rows 2/8 · token contract v0.4 |

Dependency status at plan time (ground = `main` @ `c7ed71e`, PR #230 merge commit == origin/main, tree clean):

- **UI.0 lane plan** — merged (#228 `c588d17`); Fable-5 window pin live (4/4 agents `claude-fable-5`/`max`).
- **BRIDGE token layer** (#222 `858598f`) — landed: `globals.css` branded dark system + `tests/unit/design/tokens-monochrome.test.ts` CI pin. Poles de-aliased to literals (WI-1 executed).
- **DEBATE.4 render set** — on `main`: 3 route files under `(public)` + 17 files under `src/components/debate/`, single client boundary `DebateView.tsx`.
- **W2.4-5-14 mockup v0_2** — committed at `docs/design/mockups/DESIGN_W2_4-5-14_global-header_mockup-v0_2.html` (v0_1 superseded).
- **Values-log v0_3** — committed; §1 item 7 / §2 R-2/R-3/R-4/R-6 / §3 items 3–5 supersede parts of the mockup (brand cluster, timer format, 34px control register, one-button system).
- **`public/brand/zugzwang-mark.svg`** — present (WI-12 landed).
- **`public/pfp-placeholder.svg`** — present; `resolveAuthors` serves it for every author (D8 — `pfp_filename → URL` deliberately unbuilt).
- **`FREEZE_INSTANT_UTC`** — the built freeze constant `new Date("2026-11-05T23:59:00.000Z")` at `src/server/markets/create.ts:34`, pinned by SPEC.1 §15 F-ADMIN-1 (also SPEC.1 §6 lifecycle + §12 conclusion prose; SPEC.2 §20.2). The countdown consumes THIS constant (F2 — see §4.2), never a duplicate.
- **Not available, by design:** viewer-session context (held position + balance) — A2; Profile route — A5; radio player — Session B (SPEC-FIRST); visitor-counter data source — Session B; RULES/Đ-explainer content — the deck-chat re-scope (values-log §0.2).

## Ratification record (interview answers, operator-ratified 2026-07-16 · fold-ins F1–F3 same day)

| Item | Ruling |
|---|---|
| OQ-1 | **YES** — create additive `src/app/(auth)/layout.tsx` (`getSession` → `<GlobalHeader/>` + `<main>`). Zero-edits-to-existing-auth-files stands as law. A short **ADR-0023 amendment rider lands in the SAME execute commit** as the layout; rider text is **web-authored at the commit point** (relayed — CC does not draft it). |
| OQ-2 | **DEFER** — Đ Portfolio/Balance is A2/A3 scope; A1 signed-in right zone = identity chip only. |
| OQ-3 | **RATIFIED as proposed** — RULES omit · Đ-info omit · Research omit · radio inert placeholder (OFF, `aria-disabled`, static) · visitor counter omit. Each recorded as a named deviation-from-mockup per design-handoff §4. |
| OQ-4 | Rule ratified: render only channels with supplied URLs; zero supplied → omit `SocialMenu` this slice. **The answer placeholder arrived unfilled (neither URLs nor "omit") → zero supplied → SocialMenu OMITTED by default**, flagged for the final web pass; the operator may supply URLs any time before Phase 2 kickoff to activate the conditional SocialMenu slice. |
| OQ-5 | **YES** — Button/Card/Dialog restyle in scope; it is the rebrand mechanism (values-log R-6); blast radius stands as grep-verified (debate-only consumers). |
| OQ-6 | **YES** — 2-line root metadata fix, reused copy only. |
| OQ-7 | **YES** — `Buy` → `Đ BET` copy-only relabel on the C1 disabled triggers now; values-log §6 ruling-1 restructure lands at A2/A3. |
| OQ-8 | **RATIFIED (design ruling)** — row-2 cell count tracks the countdown string (9 cells today → 8 when days < 100, ~Jul 29); row 1 stays 8; parity and alternation preserved. A one-line values-log append recording this ruling is **owed at that doc's next touch** (not this task's commit). |
| F1 | §1 row 2.2 test citation corrected — the transfer-absence backstop is `tests/server/dharma/non-transferable.test.ts` (filename verified on disk), plus absence-by-design. |
| F2 | Countdown target instant citation resolved — no micro-OQ needed: SPEC.1 pins "2026-11-05 23:59 UTC" with timezone (§6 lifecycle `Resolved|Voided → Frozen`, §12 conclusion, §15 F-ADMIN-1), and the repo carries the built constant `FREEZE_INSTANT_UTC` (`src/server/markets/create.ts:34`) — the countdown consumes it via server→prop (§4.2). |
| F3 | Second uncommitted file named: `docs/logs/UI-A1.md` (the §5.9 session log). Staging law recorded in the header block: only `docs/plans/UI-A1.md` is staged at the plan commit absent an explicit ruling. |

## Approach (one paragraph)

Replace the throwaway `(public)/layout.tsx` header with a branded `GlobalHeader` composed from new `src/components/shell/` components, built from the W2.4-5-14 v0_2 mockup **structure** mapped onto the BRIDGE token layer, with the values-log v0_3 superseding the mockup where they conflict (brand chessboard cluster + digits-only countdown, 34px control register, one-button system). In the same pass, reconcile the DEBATE.4 surface onto the BRIDGE layer — this is what "stray-value sweep" concretely resolves to, since a grep audit found zero raw color literals and correct `bg-yes`/`bg-no` pole binding already: the sweep is elevation/state/radius adoption via the shadcn primitives, one real dark-era rendering fix (borderless YES badge invisible on `n0` cards), era-stale comments, and the `Buy` → `Đ BET` copy relabel. Elements whose data or content does not exist yet ship per the ratified dispositions (§4.2): Đ cluster deferred to A2/A3, RULES/Đ-info/Research/visitor omitted, radio inert, SocialMenu omitted by default (OQ-4 zero-supplied rule) — never fake-live UI. Zero `src/server/**` edits, zero `globals.css` edits, zero migrations.

---

## 0. Binding scope guards (kickoff + ratification — plan law)

- **SCOPE GUARD 1 — auth files.** The branded header lands via shell layouts ONLY. **Zero edits to any existing auth route file or component** (`src/app/(auth)/**` pages, `src/server/auth/**`) — that is A7, critical-path class. The single ratified exception (OQ-1) is **creating** the new, additive `src/app/(auth)/layout.tsx` that mounts `<GlobalHeader/>` around `{children}` — required by the fork gate (UI-LANE §3: "branded header live on `/m/[slug]` **+ the auth routes**") and impossible any other way (no `(auth)/layout.tsx` existed; the root layout is shared with `(admin)`, rejected by ADR-0023). It ships as an isolated slice **in the same execute commit as the web-authored ADR-0023 amendment rider** (see ADRs needed). If any *edit* to an existing auth file proves unavoidable → STOP, surface, do not absorb.
- **SCOPE GUARD 2 — server files.** The DEBATE.4 pass is presentational only: token/class/copy/comment changes in view files (`src/components/**`, `(public)/**`). **Zero edits under `src/server/**`** (moderation/comments are critical paths). A stray value found in a server file → flag in the PR + `claude-progress.md`, don't touch. (Recon found none.) The `FREEZE_INSTANT_UTC` import (§4.2) is a read-only import from `src/server/markets/create.ts` into an RSC — not an edit.
- **Zero `globals.css` edits.** The token contract v0.4 is frozen; no new slots, no retunes. Every needed value already exists as a token/custom property. If execution finds itself wanting a `globals.css` line → STOP: that is a contract amendment being smuggled; open question instead. Corollary: `tests/unit/design/tokens-monochrome.test.ts` is **not amended** and must stay green untouched.
- **Zero new dependencies.** If the conditional SocialMenu slice activates (OQ-4), its shadcn `dropdown-menu` generator runs over the already-pinned `radix-ui`/`lucide-react`. If `shadcn add` tries to touch `package.json` → STOP (AGENTS §11 ask-first). SocialMenu omitted (the default) → `dropdown-menu` is NOT installed (no zero-consumer primitive lands).

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity | no — read-only UI task, no write path | n/a (no bet/comment code touched) | existing `I-ATOMICITY-001` untouched |
| 2.2 Dharma non-transferable | no | No Dharma read or write is added (the Đ cluster is deferred — OQ-2 ratified); non-transferability is absence-by-design (no transfer surface exists; none is created) | transfer-absence backstop `tests/server/dharma/non-transferable.test.ts` (existing, untouched — F1) |
| 2.3 Side frozen at comment-time | **yes — visually** | `SideBadge` remains bound to `sideAtPostTime` via the pole tokens `bg-yes`/`bg-no`; the sweep adds a hairline edge but never re-keys the side source or introduces any side-mutation affordance; pole mapping rule in §4.5 forbids name-to-value remaps | `tests/unit/design/tokens-monochrome.test.ts` (pole pins + "NOT Support" coupling, unamended) · storage backstop `I-SIDE-BIND-001` untouched · manual checklist §7 row M3 |
| 2.4 Resolutions append-only | no — `LifecycleBadge` copy/those code paths untouched | Terminal states keep the "read-only" paired-text render | existing `I-APPEND-ONLY-001` untouched |

Non-critical-path task: no per-invariant failure-mode narratives required (template rule); the §4.6 invariant-visual obligations table carries the visual-layer equivalents.

## 2. Data model changes

None — UI-only change. No schema, no migrations (head stays `0023`), no seed changes.

## 3. API surface

None — no new endpoints, Server Actions, or route handlers. The only server-side call the header makes is the **existing** `auth.api.getSession({ headers })` read already performed by `(public)/layout.tsx`, extended to the ratified additive `(auth)/layout.tsx` (OQ-1) — an import + call, not an auth-code change.

## 4. UI / user flow

### 4.1 Routes — what "all real routes" resolves to (pinned)

| Route | Group | A1 header? | A1 tokens verification | Notes |
|---|---|---|---|---|
| `/m/[slug]` | `(public)` | **yes** — via `(public)/layout.tsx` | full (branded surface + sweep) | the DEBATE.4 surface |
| `/sign-in` | `(auth)` | **yes — ratified (OQ-1)**, via the new additive `(auth)/layout.tsx` | verify-only: branded ground/typography arrive via root `body` classes + the header; page internals stay functional-unstyled (A7) | page is bare HTML today (grep: zero classes) — no strays to report |
| `/sign-in/otp` | `(auth)` | same as above | same | 〃 |
| `/onboarding` | `(auth)` | same as above | same; one inline `style` pair (`border: 2px solid`, scroll regions) noted — **report-only, A7's** | pre-session flow: header renders signed-out there (session deferred by the onboarding gate) — accepted |
| `/` coming-soon | root (outside `(public)`) | **no — ruled OUT** | smoke-only (renders on stock achromatic `neutral-*` utilities; report-only) | Discovery displaces it at A4 (UI-LANE §1/§2); header links target it as Home/brand → `/` |
| `/m/[slug]/export` | `(public)` | n/a | n/a — non-visual (`.md` response) | ADR-0025; untouched |
| `(admin)/**` | admin | **no** | out of lane | UI.0 ruling: admin consumes no shared branded components (verified: zero `components/ui` imports outside `src/components/debate/`) |

### 4.2 Component inventory vs the W2.4-5-14 v0_2 mockup (+ values-log supersessions · dispositions ratified 2026-07-16)

Header frame: 60px band (`--bar-block` register) · 3-zone grid `1fr auto 1fr` (left / center / right) · surface `bg-n0` · top+bottom `var(--hairline)` · `--elev-1` (values-log §4: "the top bar" is tier-1) · desktop fixed max-width per the shell container (mockup viewport 1440, 24px side padding) · **no responsive breakpoints** (design-language §1.7 / handoff §4 — the kickoff's "responsive per mockup" resolves to the mockup's fixed-width behavior).

| Mockup element | A1 component | Disposition at A1 | Source of truth |
|---|---|---|---|
| Back (leftmost) | `shell/HeaderNav.tsx` (client) | **live** — `router.back()`; disabled when no in-app history (fresh tab / deep-link); states per values-log header-icon-button table | mockup (order: v0.2 swap) + values-log §3 item 3 (34×34, rest `--btn-fill` + hairline; hover border → `--ring`; pressed `--state-pressed-fill`; focus `--state-focus-ring`; icon 15px ink) |
| Home | `shell/HeaderNav.tsx` | **live** — `<Link href="/">`; `aria-current` at `/`… moot at A1 (no header on `/`), kept for A4 | 〃 |
| Radio | `shell/RadioSlot.tsx` (server, static) | **inert placeholder skin — ratified (OQ-3)** — default OFF, `aria-disabled`, static bars (no fake "On Air" liveness), title per mockup ("built in W2.14"). Named deviation-from-mockup (no live animation) | mockup placeholder skin; W2.14 = Session B, SPEC-FIRST (§21.5 amendment + ADR before ANY build) |
| Social dropdown | `shell/SocialMenu.tsx` (client) + shadcn `dropdown-menu` — **CONDITIONAL slice** | **OMITTED by default — ratified rule (OQ-4) with zero URLs supplied** (the answer placeholder arrived unfilled). If the operator supplies channel URLs before Phase 2 kickoff, the slice activates: render only supplied channels; popover = `--elev-2` (its first live consumer). Named deviation while omitted | mockup (X · Instagram · YouTube · Telegram, "final accounts TBD"); values-log §4 tier 2 |
| Research | — | **omit — ratified (OQ-3)** (sub-domain undefined; dashed-placeholder chrome that 404s is worse than absent). Named deviation | mockup marks it placeholder/TBD |
| Brand cluster (center) | `shell/BrandCluster.tsx` (server) + `shell/CountdownDigits.tsx` (client leaf) | **live** — `zugzwang-mark.svg` 48×48 · 10px gap · 2×8 chessboard: 20×20 cells, outer 1px `var(--hairline)` (≡ #404040), no internal borders; row 1 `Z U G Z W A N G` Geist 13/800 (stays 8 cells); row 2 digits-only countdown Geist Mono 13/700; cell fills alternate `bg-n0`/`bg-ink`, top-left dark, text inverts per cell (`text-ink`/`text-n0`); ONE `role="link"` click target → `/`; absolutely centred. **Target instant (F2): the built `FREEZE_INSTANT_UTC` (`src/server/markets/create.ts:34`, `2026-11-05T23:59:00.000Z`; SPEC.1 §6/§12/§15 pin it with timezone) — imported by the RSC, passed to the client leaf as epoch-millis prop; no duplicate constant.** **Cell-count design ruling (OQ-8, ratified): row-2 cell count tracks the countdown string — 9 cells today, 8 once days < 100 (~Jul 29); row 1 stays 8; parity + alternation preserved.** Execute-time visual note: fixed 20px cells make row 2 transiently 180px vs row 1's 160px until ~Jul 29 — centre-aligned lockup, screenshot surfaced at PR review (the ruling is silent on width reconciliation; see critique #10) | **values-log §3 item 5 + R-2/R-3/R-4 SUPERSEDE the mockup's** wordmark+`45d : 06h : 15m` format. R-4: the `#FAFAFA` cells are ratified header-only chrome, not pole usage |
| RULES tab | — | **omit — ratified (OQ-3)** (the 4-rules+goal frames are the deck-chat re-scope, values-log §0.2). Named deviation | mockup shows it; content unbuilt |
| Đ-info (signed-out) | — | **omit — ratified (OQ-3)** (the Đ explainer content is unbuilt; same class as RULES). Named deviation | mockup shows it |
| JOIN (signed-out) | `shell/IdentityCluster.tsx` | **live** — `<Link href="/sign-in">`, label `JOIN` per mockup v0_2 (the W2.1 nav flip), ink-fill/ground-text inverse button | mockup |
| Đ cluster: Portfolio + Balance (signed-in) | — | **deferred to A2/A3 — ratified (OQ-2)** — the data is verbatim A2 scope ("viewer-session context (held position + balance)"); A1 signed-in right zone = identity chip alone. Named deviation until A2/A3 | mockup shows it; UI-LANE §2 A2 owns the reads |
| Identity chip (signed-in) | `shell/IdentityCluster.tsx` | **live, link-inert** — Avatar (`/pfp-placeholder.svg` + 1-char fallback per mockup `.av`) + pseudonym, pill w/ hairline; **no Profile link until A5** (`aria-disabled`, title "Profile — coming soon"… exact microcopy at execute, no invented product copy) | mockup + DC ruling 4; D8 placeholder rule |
| Visitor counter | — | **omit — ratified (OQ-3)** (its data source is a Session B row; a fake count violates no-invented-content). §21.1 anti-conflation is trivially honored by absence; the divider structure returns with the counter. Named deviation | mockup; Session B owns it |

Signed-in/out selection is server-side in the layouts (existing `getSession` pattern) — no client auth state.

### 4.3 Shell polish (ADR-0023 conformance)

- `(public)/layout.tsx`: replace the throwaway `<header>` (wordmark + Sign in/pseudonym) with `<GlobalHeader viewer={…}/>`; keep: server component, zero new providers, public-read, session read via `auth.api.getSession({ headers })`. Delete the now-false "THROWAWAY PLACEHOLDER" doc comment (the ADR-0023 "superseded at UI.13" pointer resolves here — note in the PR body that UI.13 was re-sequenced into A1 by UI-LANE).
- **Ratified OQ-1 slice**: new `src/app/(auth)/layout.tsx` — `getSession` → `<GlobalHeader/>` + `<main>{children}</main>`. Additive file; the three auth pages are not edited. **Ships in the same execute commit as the web-authored ADR-0023 amendment rider** (ADRs needed; execution BLOCKS on the relayed rider text at that commit — CC never drafts it).
- Root `src/app/layout.tsx`: **ratified (OQ-6)** — 2-line metadata fix: `title: "Zugzwang"`, description reusing the existing operator-authored line "The world's reputation market." — no invented copy.
- `/m/[slug]` container: `DebateView` keeps its own `max-w-5xl` column; the header spans the shell width above it. No page-level restructure.

### 4.4 DEBATE.4 rebrand pass — the concrete sweep inventory (per file)

Recon ground truth: `grep -rE '#hex|oklch|rgb|hsl'` over `src/components/**` + `(public)/**` → **zero raw color literals**; `SideBadge`/`PriceBar` already bind poles via `bg-yes`/`bg-no` with the era-proof opposite-pole foreground trick. The sweep is therefore **BRIDGE-layer adoption + copy/comment/edge fixes**, not a hex hunt:

| File | Change | Why |
|---|---|---|
| `components/ui/button.tsx` | **One-button-system restyle — ratified (OQ-5)**: `default`/`outline` → unified rest `bg-(--btn-fill)` + `[border:var(--hairline)]` + ink text; hover fill `--state-hover-fill`; pressed `--state-pressed-fill`; focus `--state-focus-ring`; disabled `opacity-(--state-disabled-opacity)`; `ghost` → quiet (n5 label rest → ink hover, pressed via `--state-pressed-fill`); radius `var(--r)`; sizes kept; `destructive`/`link` variants untouched (no consumers) | values-log §3 item 3 + R-6 ("one button system"); blast radius grep-verified: consumers = `src/components/debate/**` only (+ the new header) — no admin/auth imports |
| `components/ui/card.tsx` | `rounded-xl` → `rounded-(--r)`; `ring-1 ring-foreground/10` → `[border:var(--hairline)]`; add `shadow-(--elev-1)` | values-log: every bordered card/panel at rest = 1px #404040 + tier-1; `--r` 8px |
| `components/ui/dialog.tsx` | overlay `bg-black/50` → `bg-(--overlay)`; content `shadow-lg` → `shadow-(--elev-3)`, `rounded-xl` → `rounded-(--r)` | values-log §4 tier 3 + `--overlay` |
| `components/ui/dropdown-menu.tsx` | **CONDITIONAL — only if the SocialMenu slice activates (OQ-4)**: NEW via shadcn generator; restyle to `--elev-2` + `--r` + hairline on landing. Default (zero URLs) = NOT installed | just-in-time rule (ADR-0023); no zero-consumer primitive lands |
| `components/ui/badge.tsx`, `avatar.tsx`, `separator.tsx`, `skeleton.tsx` | verify-only; align radius to `--r-chip`/`--imgr` only if visibly off at the checklist | surgical rule §5.3 |
| `components/debate/badges.tsx` | `SideBadge`: hairline on **both** poles (today only NO has it — the YES badge `bg-yes` #181818 is borderless and near-invisible on the #212121 card: the one real dark-era rendering bug); side-binding classes untouched | values-log: "Pole edges are carried by the standard #404040 border everywhere" |
| `components/debate/PriceBar.tsx` | comment fix: "reads on a white ground" → dark-era wording; classes/geometry unchanged | era-stale comment |
| `components/debate/PostCard.tsx` | disabled trigger copy `Buy` → `Đ BET` — **ratified (OQ-7)**; `Support / Counter` label already canon | W2.8 relabel, canon §6 |
| `components/debate/DebateColumn.tsx` | disabled colhead trigger `Buy {side}` → `Đ BET` (side stays in `aria-label`) — **ratified (OQ-7)** | 〃 |
| `components/debate/{MarketHeader,PostFocusHeader,ReplyCard,ReplyPreview,AggregateFooter,ArgProfile,scrollers,dialogs,placeholders,CommentImage,format,types,DebateView}` | verify-only — already riding re-pointed semantic tokens (`text-muted-foreground`, `border-t`, `[border:var(--hairline)]`, `--imgr`, `--imgmax`); they inherit the primitive restyles | lane recon "token-riding" confirmed |

**Named NOT-sweep items** (visible in the values-log but owned elsewhere — recorded so they're not lost): the reply-view position strip + "no Đ BET/Sell buttons on the debate surface" restructure (values-log §6 build ruling 1 — lands at A2/A3 with the viewer-session/quote reads; at A1 the C1 disabled triggers only get the ratified copy relabel) · price-pill grammar `Yes 👍 38%` + thumb glyphs (arrive with the slot-header grammar; thumb-down filled `#FAFAFA` = the NO marker) · slot-header geometry values (R-5) · `@entry%`/`→now` enrichments (D7 — data gap) · engaged-slot backlight + Support/Counter pill glows (composer-era treatments, deliberately not tokenized) · the 13px body-default type register (a d5-surface convention; per-surface builds) · scrubbed-avatar visual (values-log §6 ruling 2 — brand ruling owed at its surface).

### 4.5 WI-1 BOOBY-TRAP — pole mapping law for every line of A1 code

- History: the light-era repo aliased the poles onto ramp ends (yes ≡ ink-value, no ≡ n0-value). BRIDGE **inverted the ramp** (n0 is now the darkest surface #212121; ink is now near-white **#fafafa** — note: the kickoff's "#F9FEFF" is a drift; the repo/values-log/contract value is `#fafafa`, and #F9FEFF would fail the R==G==B census) and **de-aliased the poles to literals** (`--color-yes: #181818`, `--color-no: #fafafa`, CI-pinned).
- **Law:** every mapping in this task is by **slot semantics, never name-to-value memory**. Pole-coded elements bind `bg-yes`/`bg-no` (+ the era-proof opposite-pole foreground already used by `SideBadge`: `text-no` on yes-fill, `text-yes` on no-fill). Surfaces bind `n0`; page ground binds `ground`; primary text binds `ink`. Never paint a YES element with `ink`/`n7` or a NO element with `n0` "because the value matches".
- The chessboard cells (`bg-n0`/`bg-ink`) are **chrome, not poles** — ratified R-4 (header-only white-as-chrome); they carry no side meaning.
- **YES/NO stay the frozen side poles; thumb-up = YES / thumb-down = NO are invariant pole markers, NOT vote affordances** — no thumb renders at A1 (they arrive with the price-pill grammar), and nothing in this task may present a thumb, arrow, or pill as a castable vote.
- Current-state verification (recon): zero name-mapped pole usages exist in the render set; this law binds the NEW header code and the sweep diffs.

### 4.6 Invariant-visual obligations (design-handoff §4 — must hold after every A1 diff)

| Obligation | A1 status |
|---|---|
| Frozen YES/NO side badge on every post/reply; never changes | preserved — `SideBadge` side-source untouched; sweep adds an edge, not a binding |
| Position marker none/Flipped/Exited; no marker default | untouched (`PositionMarker`) |
| **NO vote affordance anywhere** (no up/down, no friendly-fire) | preserved — the header introduces zero vote-like controls; disabled triggers remain disabled and read `Đ BET`/`Support / Counter` (entry affordances, not votes) |
| Mandatory comment field on every buy; sell the only comment-free action | n/a at A1 — no composer exists; obligation transfers to A3 |
| Single-side UX; resolved/voided/frozen render read-only | untouched — `LifecycleBadge` terminal "· read-only" render preserved |
| **The DEBATE.4 read-only surface stays read-only** | preserved — no write path, no auth-gate, no composer is wired by any A1 diff (C1 posture unchanged) |

### 4.7 Đ BET copy register (canon §6 exact strings)

Points where A1 surfaces the register: header — **none** (the Đ cluster is deferred per ratified OQ-2; the Đ-info explainer is ratified-omit per OQ-3; so the header introduces zero Đ strings at A1 — deliberate, recorded). Debate surface — the two disabled entry triggers relabel to exactly **`Đ BET`** (ratified OQ-7; W2.8: entry button; canon §5.5 chain `Đ BET` → `Place your Đ BET` → `PLACE Đ BET`, of which only the first exists pre-composer). Currency glyph everywhere else (`Đ{amount}` in `MarketHeader`/`ReplyCard`/`AggregateFooter`/`ArgProfile`) — already canon-conformant, untouched. When the Đ cluster lands (A2/A3) its labels are the mockup's `PORTFOLIO`/`BALANCE` + `Đ N` values.

### 4.8 States (kickoff-mandated enumeration)

- **Signed-out header:** left cluster + brand + JOIN. **Signed-in:** identity chip replaces JOIN. Server-decided per request. (Omitted/deferred elements per the ratified dispositions, §4.2.)
- **Active-route nav:** Back disabled when no in-app history (fresh tab/deep-link — `history.length <= 1` heuristic, client-evaluated post-mount, default enabled=false until mount); Home carries `aria-current="page"` logic (inert until `/` is in-shell at A4).
- **Interactive states:** every header control implements rest/hover/pressed/focus/disabled from the `--state-*` tokens per the values-log table (via the restyled Button where possible; bespoke controls — radio slot, identity pill — consume the same tokens).
- **Loading:** none server-side (RSC renders complete). Countdown (v2 mechanism, F2 fold-in): the RSC computes the initial display string from `FREEZE_INSTANT_UTC` at request time and passes it + the epoch-millis target as props — server and client markup are identical (prop-derived), so no placeholder flash and no hydration mismatch; the client leaf starts its minute tick after mount. Replaces the v1 mount-gate `--:--:--` placeholder.
- **Responsive:** none — desktop-only fixed max-width (design-language §1.7 / handoff §4). The mockup's own `width=1440` viewport is the register.
- **Reduced motion:** the only animation A1 ships is the countdown text tick (content change, not motion); the radio synth-wave stays static (inert OFF, ratified OQ-3). Nothing to gate.

## 5. Failure modes

- **Hydration mismatch on the countdown** — a ticking clock rendered on the server diverges at hydrate. Prevent (v2): initial display is a server-computed prop (identical markup both sides); tick starts post-mount; minute granularity makes request-to-hydrate drift invisible except across a minute boundary, which the post-mount tick immediately corrects. Detect: React hydration warning in dev/Sentry.
- **Session read failure in a layout** (`getSession` throws) — would 500 every `(public)`/`(auth)` page. Prevent: same posture as the existing shell (it already awaits `getSession` unguarded — Better Auth returns `null` on absent/invalid session rather than throwing for the normal paths). No behavior change; verify signed-out render on a cleared-cookie smoke.
- **`(auth)/layout.tsx` mount breaking an auth flow** (ratified OQ-1 slice) — a layout wrapping a client page must not alter form behavior, but the onboarding redirect chain (`cookies()` reads) and the OTP flow deserve a full manual re-smoke: Google path to consent redirect, email → OTP → onboarding → accept → home. Detect: manual smoke at execute + staging rehearsal per the deploy runbook. Recover: the slice is isolated — revert the single file (+ its same-commit rider).
- **shadcn `dropdown-menu` generator drift** *(conditional slice only — activates with OQ-4 URLs)* — generated code assuming a newer radix/shadcn than pinned. Detect: `just verify` + visual check. Recover: hand-roll the popover on the pinned `radix-ui` `DropdownMenu` primitive (no new dep either way).
- **Primitive restyle regressions on the debate surface** (Button/Card/Dialog blast radius) — a variant used somewhere unnoticed renders broken. Detect: consumer list is grep-pinned (debate files only); before/after screenshots of `/m/[slug]` market + post view + dialogs in the PR. Recover: per-variant fix; the restyle commits separately from the header commits.
- **Back-button heuristic wrong** (`history.length` counts cross-origin entries) — button enabled but `router.back()` exits the app. Accepted-known at A1 (single-surface app); the W2.3 history-stack contract matures as surfaces land (A4+). Documented in code comment.
- **`.next/types` stale-validator trap** — after building the new `(auth)/layout.tsx` on the branch then switching branches, pre-push `tsc` can fail on a phantom route (memory: EXPORT.1). Recover: `just clean` before push on any branch lacking the file.

## 6. Edge cases

- **Countdown > 99 days — RULED (OQ-8, operator 2026-07-16):** today (Jul 16) → freeze = 112 days; `112:06:15` is 9 chars vs the 8-cell chessboard. Ruling: row-2 cell count tracks the countdown string (9 cells today → 8 once days < 100, ~Jul 29); row 1 stays 8; parity and alternation preserved. Implementation note: fixed 20px cells leave row 2 at 180px vs row 1's 160px until ~Jul 29 (centre-aligned lockup; screenshot at PR review — the ruling is silent on width reconciliation). A one-line values-log append recording this ruling is owed at that doc's next touch.
- **At/after freeze:** clamp to `00:00:00` (no negative). The frozen-surface treatment is a later task; the clamp is just arithmetic honesty.
- **Signed-in user with no pseudonym:** structurally impossible post-onboarding (the session-create gate defers pre-onboarding sessions; `pseudonym` NOT NULL) — fallback renders the chip without a name if `null` leaks (same guard the throwaway had).
- **Very long pseudonym:** `truncate` on the chip (the `ArgProfile` pattern); format is bounded (`<colour>-<piece>-<NN>`) anyway.
- **`/m/[slug]` unknown slug → `notFound()`:** bubbles to the root not-found (no `(public)/not-found.tsx` exists) → renders without the header. Accepted at A1; a shell-level not-found is A4-adjacent polish (noted, not absorbed).
- **Onboarding mid-flow:** no session yet (deferred) → header shows JOIN on `/onboarding`. Accepted; A7 restyles the flow.
- **Avatar image 404:** `AvatarFallback` (first char) — the mockup's own render. `pfp-placeholder.svg` is a committed static asset.
- **Social dropdown:** omitted by default (ratified OQ-4 zero-supplied rule) — the zero-URL edge is the resolved default; if URLs arrive, only supplied channels render (no `href="#"` chrome).

## 7. Test plan

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| Unit (Vitest, `tests/unit/`) | NEW `tests/unit/shell/countdown-format.test.ts`: remaining-time formatter against the imported `FREEZE_INSTANT_UTC` value — in-window (8-char/8-cell shape), pre-launch >99d (ratified 9-cell shape), **the 100→99-day cell-count flip boundary (~Jul 29)**, at-freeze clamp `00:00:00`, post-freeze clamp, UTC boundary minute. NEW `tests/unit/shell/header-view.test.ts` (only if a pure session→header-props mapper is extracted; else dropped — no forced abstraction) | — |
| Unit — design guards (`tests/unit/design/`) | **`tokens-monochrome.test.ts` — UNTOUCHED and green** (A1 edits zero `globals.css` lines; the pin is the proof). NEW `no-raw-hex-view-layer.test.ts`: static grep-test banning `#rrggbb`/`#rgb` literals across `src/components/**` + `src/app/(public)/**` + `src/app/(auth)/layout.tsx` (rgb()/rgba() stays allowed — the ratified not-tokenized treatments arriving at A2+ use white/black-alpha; hex is the tell for a smuggled color) | 2.3 (pole/census integrity via the unamended pin) |
| Integration (Vitest + PG, `tests/integration/`) | No new DB-touching surface → no new integration specs. Full existing suite green (`pnpm vitest run` — the whole-suite pre-PR gate incl. `debate-export`, `market-by-slug`, `tests/server/dharma/non-transferable.test.ts`) | existing invariant suite untouched |
| E2E | none — Playwright not installed (AGENTS §9); not added (dependency rule). The lane-law "integration test" step for this slot resolves to: the two static guards + full suite green + the manual checklist below | — |

**Existing tests the rebrand pass legitimately moves/updates: NONE.** Justification: the only test referencing the debate tree is `tests/integration/debate-export.integration.test.ts`, which asserts masking/text output, not classes; no component/DOM test exists; the tokens pin is deliberately unamended. Any execution-time discovery that a test must move → it rides the PR with its own justification line (else STOP).

**Manual visual checklist (execute-phase, screenshots into the PR / web review):**
- M1 `/m/[slug]` signed-out + signed-in: header per mockup-as-superseded; debate cards show elev-1/hairline/`--r`; dialogs show `--overlay`/elev-3.
- M2 auth trio (`/sign-in`, `/sign-in/otp`, `/onboarding`): header present (ratified OQ-1), pages functional, flows re-smoked end-to-end.
- M3 pole check: YES badge black w/ white text + hairline, NO badge white w/ black text + hairline, price bar YES-share black anchored left — on the DARK ground (the inversion proof).
- M4 states: hover/pressed/focus/disabled on every header control (keyboard tab-through — visible focus ring).
- M5 `/` smoke (no header, legible), `ZUGZWANG_ENV=preview just verify` green, full `pnpm vitest run` green.

## 8. Out of scope (explicit — Phase 2 may not absorb any of these)

- **Composers/A2+:** no `BET_MAX_STAKE`, no quote read, **no viewer-session view-model work**, no deep-link param. (Also: no Đ Portfolio/Balance data read — ratified OQ-2 defers the cluster itself.)
- **Session B rows** (fork gate UI-LANE §3 unmet): Landing · ToS/Privacy · AGPL footer · OG cards · Leaderboards · route protection · **visitor counter** (incl. its data source) · post-JPEG share card · debate-`.md` affordance changes · **Radio** (SPEC-FIRST: §21.5 amendment + ADR before ANY build) · Admin Centre.
- **Token contract v0.4 amendments** — zero `globals.css` edits; any discovered need = open question, additions only by ratified amendment.
- **SPEC.2 bundle** (§0 banner + MAINT.22/F4 + MAINT.15) — stays parked.
- **`stash@{0}`** (EXTAUDIT-06 `.env.example` R2 quad) — untouched; operator ruling pending.
- **Migrations / DDL** — none; head stays `0023`.
- **CD sessions** — no design-lane work; deviations here are surfaced for review, never redesigned in CD.
- Plus (this plan's own lines): zero `src/server/**` edits · zero edits to existing `(auth)` page files · the `/` coming-soon page (verify-only) · the reply-view position-strip restructure + disabled-trigger removal (values-log §6 ruling 1 — A2/A3) · price-pill/thumb grammar + slot-header geometry (A2+/A3 surfaces) · `(public)/not-found.tsx` (noted for A4) · the ~100 `[gone]` branch sweep (post-window hygiene) · the OQ-8 values-log one-line append (owed at that doc's next touch, not this task's commit).

## 9. Build order (lane law: component → read-model → wiring → states → integration test)

Commit-sized slices, in order — each independently green (`ZUGZWANG_ENV=preview just verify` + suite):

1. **Primitives (sweep part 1):** `ui/button.tsx` one-button-system · `ui/card.tsx` · `ui/dialog.tsx` restyles. *(Conditional: `ui/dropdown-menu.tsx` install/restyle only if the OQ-4 SocialMenu slice activates.)* Before/after screenshots of the debate surface.
2. **Debate sweep (part 2):** `badges.tsx` YES-edge fix · `PriceBar` comment · `Đ BET` relabels (ratified OQ-7).
3. **Shell components:** `src/components/shell/{GlobalHeader,BrandCluster,CountdownDigits,HeaderNav,RadioSlot,IdentityCluster}.tsx` *(+ `SocialMenu.tsx` if activated)* + `tests/unit/shell/countdown-format.test.ts` (test first — §5.6 applies to the countdown math as the one real logic unit; formatter consumes the `FREEZE_INSTANT_UTC` value per F2).
4. **Read-model:** none new — session mapping stays in the layouts (deliberately thin; recorded as the vertical step's resolution).
5. **Wiring:** `(public)/layout.tsx` header swap · root metadata (ratified OQ-6) · **[isolated slice, ratified OQ-1]** new `src/app/(auth)/layout.tsx` **in the same commit as the web-authored ADR-0023 amendment rider** — execution BLOCKS at this commit until the rider text is relayed (CC never authors it).
6. **States + guards:** `--state-*` conformance pass over every control · `tests/unit/design/no-raw-hex-view-layer.test.ts`.
7. **Integration/verification:** full suite · manual checklist M1–M5 · pre-PR self-audit §5.10 (standard-class: audit vs this plan item-by-item) · `@code-reviewer` on the diff (src/ surface; no `src/server` → no `@security-auditor` unless web directs) · PR.

Post-ratification (operator's call on timing): commit this plan via the `docs/ui-a1-plan` branch convention, **staging ONLY `docs/plans/UI-A1.md` (F3)** — `docs/logs/UI-A1.md` (the session log, the tree's second uncommitted file) rides its own later PR or an explicit ruling; execution opens in a **fresh tab** from the committed plan (§5.8).

---

## Open questions

None blocking — all 8 interview OQs answered and folded (see Ratification record). Residuals (tracked, none gates Phase 2 start):

- **OQ-4 supply window:** operator may supply social channel URLs any time before Phase 2 kickoff → activates the conditional SocialMenu + `dropdown-menu` slice; default stands as OMIT (zero supplied — the answer placeholder arrived unfilled, flagged for the final web pass).
- **ADR-0023 amendment rider text:** web-authored, relayed at the execute commit that adds `(auth)/layout.tsx` (same commit). CC does not draft it; execution blocks at slice 5 if the text has not arrived.
- **Values-log append (OQ-8):** one line recording the row-2 cell-count ruling — owed at that doc's next touch, not this task's commit.

## ADRs needed

**ADR-0023 amendment rider** (in-place patch record per CLAUDE.md §5.12 — the decision is unchanged; the consumer surface grows): records that the shared branded `GlobalHeader` also mounts in the `(auth)` route group via a new additive `(auth)/layout.tsx` (fork-gate §3 satisfaction), with the zero-edits-to-existing-auth-files law intact. **Lands in the SAME execute commit as `src/app/(auth)/layout.tsx`; rider text is web-authored at the commit point and relayed — CC does not draft it** (ratified OQ-1).

---

## Self-critique (append-only record — v1 rows 1–8 preserved; v2 delta rows 9–13 appended after the ratification fold-in)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | high | The fork-gate §3 "header on auth routes" vs Scope-Guard-1 "zero auth edits" conflict could stall A1 at execute if discovered late | surfaced as OQ-1 with a concrete additive-file mechanism + isolated slice; §9 sequences it last so the rest of A1 lands regardless of the ruling — **now ratified YES with a same-commit ADR-0023 rider** |
| 2 | high | The signed-in header per mockup requires A2-owned data (Portfolio/Balance); building any read now would silently escalate A1 into critical-path dirs (`src/server/dharma`) | OQ-2 defers the cluster (**ratified**); §8 names the read as out of scope verbatim; identity chip alone keeps the fork gate's "branded header live" satisfiable |
| 3 | medium | Restyling shared shadcn primitives could regress the only shipped participant surface | blast radius grep-pinned (debate-only consumers); §9 slice 1 is isolated with before/after screenshots; per-variant fallback in §5 — **restyle ratified in scope (OQ-5)** |
| 4 | medium | The countdown grid design breaks pre-launch (>99 days) — unnoticed, execution would have invented a format silently | caught at plan time; OQ-8 requested the ruling — **ratified: row-2 cell count tracks the string (9→8 at days<100, ~Jul 29), row 1 stays 8, parity preserved** |
| 5 | medium | "Stray-value sweep" as named in the lane row implies hex-hunting that recon disproves — an executor could pad scope to look busy | §4.4 pins the sweep to a closed per-file inventory; anything beyond it needs a surfaced justification |
| 6 | low | The back-button `history.length` heuristic is imperfect (cross-origin entries count) | accepted-known (§5); the W2.3 history-stack contract matures at A4+ |
| 7 | low | No component-render test layer exists (no RTL/Playwright), so header states are manually verified only | accepted: dependency rule beats coverage; the two static guards + countdown unit tests + M1–M5 are the honest maximum without a new dep |
| 8 | low | Omitting mockup elements (visitor/RULES/Đ-info/Research) deviates from the locked still | every omission is a named deviation per handoff §4's rule — OQ-3 was that surfacing; **dispositions ratified as proposed** |
| 9 | medium | **OQ-4's answer placeholder arrived unfilled** — neither URLs nor the word "omit"; intent-omit vs forgot-to-paste is indistinguishable from the relay text | resolved via the ratified rule's own zero-supplied branch (omit by default) rather than fabricating an answer; flagged in the Ratification record + Residuals so the FINAL web pass sees it; supply window stays open to Phase 2 kickoff |
| 10 | low | The OQ-8 ruling is silent on row-width reconciliation — fixed 20px cells make row 2 (9×20 = 180px) wider than row 1 (160px) until ~Jul 29 | candidate recorded in §4.2/§6: fixed cells, centre-aligned lockup, transient mismatch accepted; screenshot surfaced at PR review for a cheap veto |
| 11 | medium | v1 §1 row 2.2 cited `I-NO-OVERDRAFT-001` for non-transferability — that spec maps to the overdraft half of INV-2, not transfer-absence (F1, caught at web review) | corrected to the on-disk `tests/server/dharma/non-transferable.test.ts` (filename verified) + absence-by-design language; lesson recorded: map invariant *halves* to their assertions, not the invariant's ID to its nearest-named test |
| 12 | low | v1 stated the countdown target as a plan-level constant, risking a duplicate of an existing pin (F2) | corrected: the built `FREEZE_INSTANT_UTC` (`src/server/markets/create.ts:34`; SPEC.1 §6/§12/§15 pin the instant with timezone) is the single source, imported by the RSC and passed to the client leaf as a prop — no duplicate constant, no `server-only` breach; the §4.8 loading mechanism was simplified to prop-seeded initial render as a side benefit |
| 13 | low | v1 planned the `dropdown-menu` install unconditionally; with SocialMenu now omitted-by-default it would have landed as a zero-consumer primitive, violating the just-in-time rule (ADR-0023) | install made conditional on the OQ-4 slice activating (§4.4, §9 slice 1) |

---

## References

- `CLAUDE.md` (§1 critical paths · §2 invariants · §3 freeze trigger · §5 workflow) + `AGENTS.md` (§8 tokens · §9 tests · §11 boundaries)
- `docs/plans/UI-LANE.md` §2 A1 (binding scope) · §3 (fork gate)
- `docs/logs/UI-0.md` (ground + census + next-session pointer)
- ADR-0023 (shell topology — amendment rider due at execute, see ADRs needed) · ADR-0025 (export affordance, untouched) · ADR-0016 §6 (slug URLs)
- SPEC.1 §6 (lifecycle freeze transition) · §12 (conclusion at 2026-11-05 23:59 UTC) · §15 F-ADMIN-1 (`FREEZE_INSTANT_UTC` service constant) — the countdown's target authority (F2)
- `src/server/markets/create.ts:34` (`FREEZE_INSTANT_UTC`) · `tests/server/dharma/non-transferable.test.ts` (INV-2 transfer-absence backstop, F1)
- `docs/design/design-canon.md` §3 (locked decisions) · §4 (DC rulings) · §6 (copy register) · §8 rows 2/8 · §10 (R-2/R-5 supersessions)
- `docs/design/design-token-contract.md` v0.4 (frozen slots; §3.6 BRIDGE census)
- `docs/design/design-language.md` §1 (constraints) · §3.1/§3.2 (primitives) · §4 (state-shape rules)
- `docs/design/design-handoff.md` §4 (build brief + invariant-visual obligations + deviations rule) · §5 (ritual)
- `docs/design/ZUGZWANG-BRAND_agenda-and-values-log_v0_3.md` §1–§6 (value authority: brand cluster, states, elevation, one-button system, build rulings; OQ-8 append owed at next touch)
- `docs/design/mockups/DESIGN_W2_4-5-14_global-header_mockup-v0_2.html` (structure authority)
- `src/app/globals.css` + `tests/unit/design/tokens-monochrome.test.ts` (the BRIDGE layer + its pin — untouched by this plan)
- Tracker: UI-LANE §2 A1 (tracker_v17 is web-side; the lane plan is the in-repo sequencer)

---

*Plan follows `docs/plans/_template.md`. Authored in the A1 plan-mode session (2026-07-16); interview answers operator-ratified + web fold-ins F1–F3 applied the same day (self-critique rows 9–13 appended, rows 1–8 preserved). Commits only after final web review + operator ratification (deliberate deviation from plan-then-execute.md, per kickoff). At the plan commit, ONLY this file is staged (F3). Execution opens in a fresh tab from the committed plan.*
