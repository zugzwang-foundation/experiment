# MOBILE-1 — Session log

## Phase A — 2026-09-03

**What landed (files + PR#).** No PR opened yet — this session's brief ended at
"stop, report status," not "open a PR." Working tree on `main`, uncommitted.
Twelve files modified, four new test files:

- `src/app/globals.css` — mints `--breakpoint-mobile: 640px` inside the
  existing branded `@theme` block.
- `src/components/shell/GlobalHeader.tsx` — new `mobileResponsive?: boolean`
  prop (default `false`), gating every reflow class via `cn()`. Radio +
  GitHub stars share one hidden wrapper (`shrink-0`); RULES and HeaderNav
  stay outside it, always visible. The §21.1 divider carries no
  `data-testid` (SG6).
- `src/components/shell/BrandCluster.tsx`, `VisitorCounter.tsx` — take the
  same `mobileResponsive` prop, threaded from `GlobalHeader`. VisitorCounter
  gates its own root directly (no wrapper — preserves
  `dharma-cluster.test.tsx`'s T4 direct-children guard).
- `src/app/(public)/layout.tsx` — passes `mobileResponsive` to its
  `<GlobalHeader>` mount. `(auth)/layout.tsx` is untouched — its mount omits
  the prop, so `/sign-in`, `/sign-in/otp`, `/onboarding` render
  byte-identical to before this task (browser-confirmed: 394px overflow,
  unchanged).
- `src/components/debate/DebateView.tsx` — `max-mobile:h-auto
  max-mobile:overflow-visible` on the `PageContainer`; `max-mobile:flex-col`
  on both `arena` divs (both arms of the market/post ternary).
- `src/components/debate/HeadZone.tsx` — `max-mobile:basis-auto
  max-mobile:overflow-visible`, releasing the same one-screen discipline.
- `src/components/discovery/HeroPanels.tsx`, `DiscoveryCarousel.tsx` — **zero
  functional diff** (comments only). First draft hid both below 640px; both
  hides were reverted — the hero carries real participant argument content
  (SPEC.1 §22 F-DISC-2, CHART-1 made the price chart non-decorative), and it
  already stacks via its pre-existing `md:grid-cols-…` breakpoint with no
  new code needed.
- Pre-existing tests fixed where this diff legitimately changed what they
  pinned: `tests/unit/shell/dharma-cluster.test.tsx` (no — see below, this
  one needed no edit, VisitorCounter's no-wrapper design preserved it
  as-is), `tests/unit/shell/page-container.test.ts`, `github-stars.test.tsx`,
  `tests/unit/debate/resolution-block-glyphs.test.ts`.
- New: `tests/unit/design/mobile-breakpoint-token.test.ts`,
  `discovery-mobile-reflow.test.ts`, `debate-mobile-reflow.test.ts`,
  `tests/unit/shell/global-header-mobile-reflow.test.ts`.

**Decisions made.**
- Header-chrome fix (`GlobalHeader.tsx` + children) was **not** in the
  plan's file list or ADR-0045's file map — found mid-session (measured:
  394px of horizontal overflow at 375px, 395px of which traced to the
  header alone). Surfaced to the user via `AskUserQuestion` before writing
  code; approved as a scoped, frame-only addition.
- `@code-reviewer` caught 3 CRITICAL + 4 HIGH findings against that first
  draft — all fixed this session, not deferred:
  - SG6 violation (divider gained a forbidden `data-testid`) — removed,
    now located by its `w-px` class like T4 already does.
  - Header reflow silently reached `(auth)` routes, which ADR-0045
    explicitly leaves gated, not responsive — fixed via the
    `mobileResponsive` prop threaded from `(public)/layout.tsx` only.
  - RulesControl was hidden below 640px, contradicting SPEC.1 §21.9
    ("present for every viewer, authenticated or not" — the onboarding
    deck's only re-show entry point) — moved outside the hidden wrapper.
  - HeroPanels' hide was hiding real content (stale "decorative" citation;
    CHART-1 made the price chart non-`aria-hidden`) — reverted; the
    existing `md:` breakpoint already satisfies "stacks below 640px" with
    zero new code.
  - Two smaller HIGH fixes: a stale docblock claim, and a comment placed
    inside a block explicitly marked contested/awaiting a founder ruling
    (moved out, with a corrected factual claim).
  - MEDIUM: added `shrink-0` to the new wrapper (every other left-zone
    control already carries it as a documented hard-overflow-budget
    invariant).
- `DebateColumn.tsx` needed **no changes** — verified empirically (a
  synthetic DOM rig using the exact literal class strings, injected into
  the live dev server) that its `overflow-y-auto`/`min-h-0`/`flex-1` go
  cleanly inert once the ancestor chain releases to auto-height at phone
  width, and correctly stay active (internal scroll) at desktop. Not
  assumed — measured in both directions.

**Found after the review, during founder-requested preview work — a real bug
the task's own verification had missed.** The original "0px horizontal overflow
on Discovery" measurement was taken against the EMPTY state: the local dev
database has zero `Open` markets, so `DiscoveryContent` returns `<EmptyState />`
and `HeroPanels` was never mounted at all. True as measured, and it did not
cover the case that matters. Rendering `HeroPanels` with content for the first
time (via throwaway fake-data preview routes) measured **199px of overflow at
375px**, with `hero-post` and `hero-market-link` each at **526px** inside a
375px viewport. Cause: with no unprefixed `grid-cols-*`, the implicit grid track
sizes to its content's max-content width rather than the container — "no
explicit columns" stacks the children one-per-row but does not constrain their
width. Both CC and @code-reviewer read the same source and drew the same wrong
conclusion; only a browser rendering real content exposed it. Fixed with an
unprefixed `grid-cols-1` (`repeat(1, minmax(0, 1fr))`), fully overridden at
`md`, desktop verified untouched, re-measured at 0px. The guard in
`discovery-mobile-reflow.test.ts` now asserts that class's PRESENCE (it
previously asserted its absence) with the measurement recorded in the test.
⚠ The generalisable half: **a source scan cannot see a track-sizing fact**, and
this repo's design suites are source scans by necessity (jsdom performs no
layout).

**FOUNDER RULING, later the same session — the phone-width Discovery surface
is a PLAIN MARKET LIST, reversing the @code-reviewer revert above.** Ruling:
"for mobile view, show all the 8 markets one below another and when someone
clicks a particular market, then show its posts." Confirmed against three
options: hero removed entirely (not shrunk), card content unchanged, desktop
untouched.
- ⚠ THIS REVERSES THE REVERT, AND THE REVIEWER WAS NOT WRONG — the ground
  moved. The reviewer's objection was that hiding `HeroPanels` hides real
  participant content with no path to it (CHART-1's accessible chart, F-DISC-2's
  top posts). The ruling supplies the missing path rather than waiving the
  objection: `MarketCard` is already a whole-card link to `/m/{slug}`, so every
  hidden post and chart is one tap away on the market's own page. Relocated,
  not destroyed — which is the distinction the objection turned on. Both the
  component comment and `discovery-mobile-reflow.test.ts`'s docblock record
  this, so the next reader does not re-derive the reviewer's (still valid)
  reasoning and revert it again.
- `HeroPanels` + the carousel rail now carry `max-mobile:hidden`, pinned
  TOGETHER by a new guard (`hero-and-rail-hide-TOGETHER-never-one-alone`) —
  either alone is a defect with a different shape.
- ⛔ `grid-cols-1` STAYS and is NOT redundant with the hide: it governs the
  640–767px band where the hero is still visible and `md:` has not taken over.
  Hidden below 640px is not hidden at 700px. The guard and the comment both
  say so, because "the hero is hidden on mobile anyway" is the obvious reason
  someone deletes it.
- **A second, user-visible defect fell out of the ruling and is fixed:**
  `MarketCard`'s active ring marks the card whose hero is featured. With the
  hero hidden, the carousel's 10s timer keeps running, so a card highlighted
  itself and the highlight WANDERED down the list every ten seconds with
  nothing on screen explaining it. Measured in a browser at 375px — visible,
  not theoretical. Fixed with `max-mobile:outline-none` on the ring only
  (killing the timer needs a client viewport read, which plan §4 rules against).
  ⚠ This is the user-facing half of a cost this log first recorded as
  invisible; the earlier "accepted invisible cost" line was wrong.
- ⚠ MEASUREMENT NOTE: the first three ring measurements were taken against the
  WRONG ELEMENT — `data-active` is on the carousel DOTS as well as the card, and
  `querySelector` returns the dot first. Corrected to
  `[data-testid="market-card"][data-active="true"]`. Verified after: `none` at
  375px, `solid` at 700px and 1440px.

**Open questions.** Two, neither blocking Phase A.

**(1) `ResolverCards` renders four 74px columns at 375px, and every label and
value truncates to an ellipsis** — `RESOL…` over `CoinMa…`, `CLOSE…` over
`5 Nov …`. Measured against REAL staging data at 375px; invisible before,
because the throwaway preview's hand-written slugs are absent from BLOCK-1's
per-slug resolver map, so this row rendered empty chrome in every local test.
**Not fixed, deliberately — this is a SURPRISE (§5.10), not an in-scope fix.**
`max-mobile:grid-cols-2` was written, measured good (2×155.5px, full text, 0
overflow, desktop unchanged at four 160.7px columns) and then **reverted**,
because three independent sources say the four-across geometry is a held
decision rather than an oversight:

- `tests/unit/debate/render/resolver-cards.test.tsx:119` asserts
  `expect(cls).not.toMatch(/:grid-cols-/)` — a categorical ban on *any*
  breakpoint-prefixed `grid-cols`. It fired on the edit, which is the guard
  working, not a stale pin.
- `docs/plans/BLOCK-1.md:25` records "grid-cols-4, one row" among the
  structural assertions deliberately **preserved** through RESO-1 → BLOCK-1 →
  BLOCK-4 → BLOCK-5b.
- The component already carries an authored **mobile** posture at this exact
  width: the glyph is `hidden … sm:block`, and Tailwind's `sm:` is 640px — the
  same boundary as this task's token. BLOCK-5b's answer below 640px was *drop
  the glyph, keep four text columns*, not *reflow the grid*.

`ResolverCards` is named nowhere in `docs/plans/MOBILE-1.md`. Overriding four
tasks' worth of a pinned property, by rewriting two guards, inside a task whose
plan never scopes the component, is the "while we're here" failure §5.4 names.
**OPERATOR RULING 2026-09-05 — DEFERRED. Leave four-across; ship Phase A with
the truncation.** Not a rejection of the fix, and not an open question any
more. ⚠ **Do NOT re-open this as a fresh finding** — it was found, diagnosed,
fixed, measured, reverted and ruled on inside one session. `ResolverCards.tsx`
is byte-unchanged on this branch.

**The fix, recorded so a later task needs no re-derivation.** Apply
`max-mobile:grid-cols-2` to the row, then update both guards **in the same
commit**, narrowed rather than loosened: pin the *unprefixed* token as
`grid-cols-4` and the sole responsive variant as exactly
`max-mobile:grid-cols-2`, so a third value or a different breakpoint still
reddens. Three files, no ADR, no SPEC amendment — nothing under `docs/specs/`,
`docs/adr/` or `docs/design/` pins this geometry (grep-verified); it lives only
in `docs/plans/BLOCK-1.md` and the two tests.

**Why 2×2 is the right fix, and why the four-across posture is weaker evidence
than it first looks.** `VALUE_TEXT_SIZE[entry.fontSize]` is a **per-entry
fitted** size, computed by BLOCK-3 against a **91px** column and re-verified at
BLOCK-4 across all twenty values (tightest clears by 0.37px). A phone at four
columns gives **73.75px** — 19% under the width the fitting assumed, which is
the actual cause: the column is narrower than the design's own premise, not the
strings too long. Two columns give **155.5px**, comfortably over 91px, so every
value fits **with the existing sizes** — no refit, no fifth size, no breaking
the documented 11px floor. And BLOCK-4's `hidden … sm:block` on the glyph was
**not** an aesthetic ruling that four-across suits a phone: its own comment
records that at 390×844 the glyph (58px with padding) exceeded the 45.67px
block, driving text width to **zero** — values were *invisible*, not truncated
— and hiding it gave "the text stack the block's FULL content width." That is a
rescue from invisible to truncated; the intent was to make text fit. 2×2
finishes it rather than contradicting it.

**(1b) `ArgProfile`'s identity row is CLIPPED at 375px — found only after the
rebase onto `main`, and NOT fixed.** Measured on the rebased tree: Group A
(`ArgProfile.tsx:199` / `:342`, `flex shrink-0 items-center gap-1.5
whitespace-nowrap`, holding `CeruleanCapybara000 | YES @ 50% | Đ 10 | Replies ·
0`) renders **362px wide inside a 203px parent**, and the card ancestor's
`overflow-hidden` cuts the remainder — `Replies · 0` is off-card and invisible.
Page-level overflow is still 0; this is clipping *within* a card, which is why
the document-level check does not see it.

⚠ **This is pre-existing on `main`, and this branch makes it BETTER without
making it right.** Before Phase A the arena is `row` at 375px, so each column
is ~150px and the clip is worse; Phase A stacks the arena and the card reaches
301px. Neither is enough for a 362px unbreakable run.

⚠ **It was covered pre-rebase and is NOT covered now — say so plainly.** The
original Phase A commit put `max-mobile:flex-wrap` on `PostCard`'s
`justify-between` wrapper, which dropped the badge to its own line and gave the
identity chips the full width. Upstream (UI-OVERNIGHT entry 1b) **deleted that
wrapper** and moved the badge inside `ArgProfile`, solving the same crowding a
better way — so the rebase took upstream's version and my override went with
it. Correct resolution; the residual clip is one level deeper than either fix.

**FIXED — OPERATOR RULING 2026-09-05, after a side-by-side of the two builds.**
`ArgProfile.tsx:196-198` documents the constraint as a rule with a stated
purpose: *"GROUP A — never wraps internally (rule 2). A pseudonym long enough to
overflow it is preferred to a pseudonym that is cut in half: identity is not a
field this product truncates."*

⚠ **The ruling turned on evidence, not on preference, and the evidence was that
the operator had already SEEN this row working.** Both builds were compiled from
source against live staging data and screenshotted at 375px: the pre-rebase tree
(`d9c1c61`) measured **0 elements clipped inside cards**; the post-rebase tree
measured Group A at **362px inside a 203px parent**, 106px cut. So this was a
regression relative to what was tested, not an inherited wart — which is what
separates it from (1), where nothing had ever worked differently.

**The fix scopes rule 2 to >=640px; it does not overturn it.** Rule 2's stated
reason is to prevent truncation, and below 640px it was *producing* truncation —
purpose and effect had come apart, at one width only. `max-mobile:shrink
max-mobile:flex-wrap` on BOTH groups lets the row take a second LINE instead of
more WIDTH: every field stays whole, `whitespace-nowrap` still forbids breaking
inside a field, and the pseudonym is as intact as the rule demands. The two
tokens are one mechanism — `flex-wrap` cannot engage while `shrink-0` pins the
group at its content width.

**Verified.** 375px: 0 clipped, Group A 203px × 46px (two lines), full text
`CeruleanCapybara000|YES @ 50%|Đ 10|Replies · 0`, page overflow 0. 1440px:
`flex-wrap: nowrap`, `flex-shrink: 0`, Group A 20px — ONE line — arena `row`,
still one screen. Both `max-mobile:` tokens are inert above 640px, so
UI-OVERNIGHT 1b's two-locked-groups desktop row is byte-identical.

**The guard was read before editing and still passes unmodified**
(`tests/unit/debate/render/arg-profile-row.test.tsx`): it locates the groups by
the `whitespace-nowrap` token, which is KEPT, and its `.flex-wrap` selector does
not match the distinct `max-mobile:flex-wrap` token. 3202/3202 green.

⚠ **Group B takes the pair too, though it does not overflow on today's data** —
the behaviour belongs to the row at phone width, not to one group's current
contents, and a longer badge string would otherwise reintroduce the clip in the
half nobody thought to cover.

**(2)** **The 640–767px band overflows
horizontally by ~54px at 700px**, and it is the HEADER's right zone
(`visitor-counter` and its siblings), not Discovery content. Above 640px every
`max-mobile:` header rule switches off and the full desktop header renders in a
viewport it was never sized for. **Pre-existing — that band was equally broken
before this task**, which fixed <640px and left 640–767px as found. Out of
scope for a ruling explicitly about "mobile view," and ADR-0045 leaves tablet
on the desktop treatment. Named here so it is not mistaken for a regression.

**Resolved, not open (corrected here rather than left standing).** One
pre-existing environment issue surfaced and was confirmed unrelated to this
diff: `pnpm build` failed on unmodified `main` too — `next.config.ts`'s
`agentRules` key tripped a `NextConfig` type error because the installed
`node_modules` reported `Next.js 16.2.4` against `package.json`'s `16.3.2`
pin. Confirmed pre-existing via `git stash` + rebuild against the untouched
tree (identical failure, same line). **Fixed this session by
`pnpm install --frozen-lockfile`**, which resynced `node_modules` to the
pinned `16.3.2`; `package.json` and the lockfile are byte-unchanged. This
paragraph previously read "not attempted, out of scope here," which was true
when written and false by the end of the session.

**Next session starts at:** Phase B, fresh tab, fresh `/plan` per the
kickoff brief — the server-side UA-classifier gate
(`src/server/auth/device-class.ts`, `route.ts`, `tos-accept.ts`) and the
client-side CTA/sign-in-page hides (`IdentityCluster.tsx`, `AuthGateSlot.tsx`,
both sign-in pages). Full critical-path ritual: `@test-writer` →
`@code-reviewer` → `@security-auditor`, founder Gate C. `IdentityCluster.tsx`
and `AuthGateSlot.tsx` are confirmed zero-diff as of this session (asserted
by `global-header-mobile-reflow.test.ts`'s own guard) — Phase B starts from
a clean baseline there, nothing to reconcile.

**Context to preserve.**
- ✅ **The throwaway preview is DELETED** (operator-approved, 2026-09-05).
  `src/app/(public)/zz-mobile1-preview/` — 5 files — is gone; it was untracked,
  so there is no git history to recover it from and no reason to want one. It
  existed only because the local dev database has zero `Open` markets. Verified
  before deleting: zero references to it from anywhere in `src/`, `tests/` or
  `docs/`. Verified after: `pnpm tsc --noEmit` clean, 3104 unit tests pass, a
  clean production rebuild emits **zero** `zz-mobile1-preview` routes, and
  `GET /zz-mobile1-preview` now 404s. ⚠ The stale `.next/types/validator.ts`
  errors that appear immediately after such a deletion are GENERATED artifacts,
  not source — `just clean` + rebuild clears them; do not "fix" them.
- **Replacement for it: run the dev/prod server against the staging database**,
  which renders real markets and is strictly better than fake fixtures. Two
  configs were added to the untracked `.claude/launch.json` this session —
  `zugzwang-dev-staging-db` and `zugzwang-prod-staging-db` (the latter binds
  `-H 0.0.0.0` for phone testing over the LAN). Both are scratch; neither is
  tracked. ⚠ **Prefer the PRODUCTION one for real-device testing** — dev mode
  ships far more JS and its HMR socket drops constantly over a LAN.
- ⚠ **Clearing `.next`/`.turbo` renames every JS chunk, which silently bricks
  an already-open phone browser**: the HTML draws but nothing hydrates, so
  EVERY button on the page is dead at once. That symptom was misread as two
  broken dialogs. The tell is that unrelated controls fail simultaneously; the
  fix is clearing site data on the device, not a code change.
- The `mobileResponsive` prop (not a route check, not context) is the whole
  mechanism keeping `(auth)` untouched. Phase B's own auth-page work will
  mount its own responsive treatment on `/sign-in`/`/sign-in/otp` directly
  (per plan §4, a pure-CSS toggle between two sibling blocks) — independent
  of this prop, no conflict expected, but worth knowing it exists.
- `--breakpoint-mobile: 640px` lives in `globals.css`'s existing branded
  `@theme` block (not a second block — the first draft minted a second one
  and broke a pre-existing "exactly one plain `@theme` block" test).
- This plan's own §4 "decorative per design-language §3.2" framing for the
  hero was checked against SPEC.1 mid-session and found stale (CHART-1,
  2026-08-27, made the price chart non-decorative) — if Phase B or a later
  pass reads plan §4 for the hero, read this log's decision instead.
- Full verification this session: `pnpm vitest run` (no scale/staging) —
  454/455 files, 4503/4509 tests, exit 0. `pnpm tsc --noEmit` — zero new
  errors. `pnpm biome check .` — zero new findings (2 pre-existing warnings,
  untouched region of `DebateView.tsx`; pre-existing untracked `tests/e2e/`
  + `.claude/launch.json` format findings, not this task's). Real browser at
  375px/414px/1440px — zero horizontal overflow, desktop unchanged,
  `/sign-in` unchanged. `pnpm build` — pre-existing failure, see above.

**Time.** Single session, 2026-09-03.
