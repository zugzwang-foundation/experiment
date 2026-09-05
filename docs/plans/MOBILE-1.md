# MOBILE-1 — Mobile-responsive read surfaces + hard Join/Login exclusion on mobile

> Replace placeholders in `<...>` with real content. Delete sections that are genuinely "None" only after explicitly checking — don't leave them blank without thinking. The template's job is to force the question, not to lock you into long answers.

> **Status:** drafted
> **Date:** 2026-09-02
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** Phase B only — see Approach. Phase A is not critical-path.
> **Plan PR / commit:** n/a

---

## Tracker context

No tracker row — ad hoc task, framed directly against ADR-0045 (renumbered
from ADR-0041 during this planning session — see Decisions-received note
below; original file `docs/adr/0041-mobile-responsive-browsing-and-auth-gate.md`
collided with the pre-existing, `main`-landed
`docs/adr/0041-cache-components-and-reserves-keyed-participant-caching.md`).
ADR-0045 was approved by Hrishikesh 2026-09-01, on branch `chore/adr-0045`
(commit `d7785c1`), not yet merged to `main`. No declared dependencies.

**Decisions received during Phase 1 framing** (CC ↔ web Claude ↔ Hrishikesh,
this session, 2026-09-02):

1. ADR renumber to 0045 — approved, executed (file renamed, header + closing
   paragraph updated, commit amended, branch renamed; gate-mechanism "TBD in
   Phase 1" language deliberately left untouched in the ADR itself).
2. Server-side gate mechanism — route-wrapper block in
   `src/app/api/auth/[...all]/route.ts`'s `handleAuth`, before
   `auth.handler(request)` — approved over the ADR's floated
   `databaseHooks.session.create.before` (ADR-0004) candidate, which fires too
   late in the Better Auth lifecycle (see §3, §5).
3. Structure — one ADR (0045), two build phases, two PRs. Phase A
   (breakpoint token + responsive CSS) is not critical-path,
   `@code-reviewer` only, web reviewer clears Gate C directly. Phase B
   (route-wrapper reject + client-side CTA/page hides) is critical-path, full
   ritual, `@code-reviewer` + `@security-auditor`, founder Gate C required.
4. `tests/e2e/.auth/world.json` + `participant.json` — left untouched and
   unopened; escalated to Hrishikesh separately, not a MOBILE-1 blocker.
   **Correction (M1-10, second-pass review, verified this session):** these
   trace to the unmerged `origin/feat/e2e-playwright-setup` branch (confirmed
   present on `origin`, carries its own `playwright.config.ts`) — almost
   certainly written to disk by that branch's own Playwright auth-setup
   having run at some point in this local checkout, and persisting as
   untracked files regardless of which branch is later checked out. Not
   evidence of anything specific to the `chore/adr-0045` lineage or to
   MOBILE-1's own working tree, as the earlier wording implied.
5. Sign-in-page mobile-hidden content — plain message, exact string
   **"Sign-up only works on a computer right now."**
6. Mobile breakpoint width — 640px (phones only, Tailwind's own `sm` value,
   explicitly re-minted as a named token per ADR-0045's file-map requirement
   rather than relied on implicitly).
7. Tablet treatment — **provisionally** desktop (unaffected), pending
   Hrishikesh confirming separately before Phase 2 execution begins.
   **Superseded by item 8 below** — Open questions no longer carries this;
   see §3/§4/§6/Self-critique #1 instead.

**Decisions received — Round 2 (device-scope widening, 2026-09-02):**

8. Final ruling on device scope: Join/Login is restricted to computer/laptop
   only — phones, tablets, AND iPads are all excluded from Join/Login, not
   just phones. Tablet **browsing** (Phase A's responsive reflow) is
   unaffected — this widens who is excluded from Join/Login, not who gets
   the phone-width reflow. Implemented as: (a) server-side UA classification
   extended to also match Android-tablet-class UAs, with a hard, researched
   limit on iPads specifically — see §3; (b) client-side cosmetic hide gains
   a second, independent condition (coarse-pointer/no-hover, not a wider
   pixel breakpoint) alongside the unchanged 640px phone rule — see §4.

**Decisions received — Round 3 (second-pass review fixes, 2026-09-02):**

9. M1-1, RESOLVED, founder-confirmed: "strictly excluded" means a strong
   policy deterrent (stops non-bypassing users), not an absolute technical
   guarantee — confirmed not achievable by any method, on any website, given
   client-controlled device signals. Matches this plan exactly as designed
   (§3, §6, Self-critique #1). Recorded as answered, not open.
10. M1-4, RESOLVED, founder-confirmed: admin login (`/admin/*`) stays
    untouched and unaffected by this gate, on ADR-0010's existing structural
    separation. Recorded as a closed, founder-ratified decision (§3, §8) —
    not a developer scoping default.
11. Six blocking/cleanup findings from a second-pass plan review (M1-2,
    M1-3, M1-6, M1-8, M1-5, M1-10) incorporated directly into §1, §3, §4,
    §5, §7, §8, and Self-critique below rather than logged separately here —
    each touched section states what changed and why. The most consequential
    (M1-2) is a real coverage gap this plan had: the server-side gate never
    covered the first-time-signup completion path. Found and fixed this
    pass, not carried forward as a known limitation — see §3 and
    Self-critique #6.

**Correction to this log's own closing instruction:** the request that
triggered this round stated the plan file "still only exists in Downloads,
not in the repo." Checked directly this session (`git status --short
docs/plans/MOBILE-1.md`): it exists at `docs/plans/MOBILE-1.md` in the
working tree right now, untracked but present — not committed yet, which is
a real and correctly-flagged gap, but a different claim than "doesn't exist
in the repo." Corrected here rather than silently complied with, per
CLAUDE.md §4; committed at the end of this round regardless, per the
original instruction's intent.

## Approach (one paragraph)

Two-phase, one-ADR, two-PR build. **Phase A** mints a single named mobile
breakpoint token (`--breakpoint-mobile: 640px` in `src/app/globals.css`'s
`@theme` block — the first responsive infrastructure in this codebase) and
applies pragmatic, non-designed responsive reflow to the two read-only
surfaces named in ADR-0045: the homepage/market feed and `/m/[slug]`. This
reflow is phone-width-scoped only — tablets keep the desktop layout. Zero
auth touch, zero change to desktop rendering at 1440px. **Phase B** adds the
actual enforcement — a hard 403 for a mobile-**or-tablet**-detected
User-Agent hitting `/api/auth/[...all]`, before any Better Auth logic runs,
with a researched, hard limit on the tablet side (§3) — plus the cosmetic,
known-bypassable client-side layer: hiding the three Join/Login CTAs and
swapping the two sign-in pages' content for a plain "desktop only" message,
under **two independent conditions** — the existing 640px phone-width rule,
and a new coarse-pointer/no-hover (touch-primary) rule that is
viewport-width-independent (§4). Phase B consumes Phase A's breakpoint
token; it cannot ship first.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity (INV-1) | No | This task writes nothing to `bets`/`comments`. **Corrected this pass (M1-2) — the original claim here was false as written.** No session can be issued to a mobile/tablet-classified request through either path that creates one: the route-wrapper gate (`route.ts`, blocks `sign-in/social` / `sign-in/email-otp` before Better Auth runs) **and** the `acceptTosAction` gate (`tos-accept.ts`, refuses to proceed at function entry — the first-time-signup completion path, which issues its session in-process and never routes through `route.ts` at all, §3). Without a session on either path, the bet-placement code path stays unreachable. | N/A — see note below |
| 2.2 Dharma non-transferable / no overdraft (INV-2) | No | No `dharma_ledger` write anywhere in this diff. | N/A |
| 2.3 Side frozen at comment-time (INV-3) | No | Same reasoning as INV-1 — no session, no comment. | N/A |
| 2.4 Resolutions append-only (INV-4) | No | Not touched by CSS or an auth-entry User-Agent check. | N/A |

**No thesis invariant is touched, so the template's "name the concrete
failure mode if the assertion is missing" question doesn't have a target.**
This task's nearest equivalent is its own internal correctness property — the
mobile gate must fail open, not silently block real desktop signups — covered
in §5 and §7, not in this table.

---

## 2. Data model changes

None — Phase A is CSS/component-only. Phase B is a route-handler-level check
with no persistence. No migration, no schema diff, no new table, no new
column.

## 3. API surface

**Endpoint:** `src/app/api/auth/[...all]/route.ts` — `handleAuth`, both the
`GET` and `POST` exports (unchanged — both still route through the same
function).

**Change:** a shared classifier module, plus **two** call sites that each
independently refuse to proceed on a positive match — not one gate. The
route-wrapper alone misses the first-time-signup completion path
(`acceptTosAction`), which issues the actual session via an in-process,
`SERVER_ONLY` Better Auth endpoint that never touches `route.ts` (M1-2,
second-pass review — verified by reading both files this session, not
assumed from the review's description alone).

- **Shared classifier module — `src/server/auth/device-class.ts` (new
  file):** the single source of truth for phone/tablet classification,
  imported at both call sites below. One module, not two independently
  drifting copies of the same pattern — the same "two enforcement layers
  must stay in sync" risk ADR-0045 already names for the client-hide vs.
  server-reject split, closed one layer down between the two *server*-side
  call sites.
  - **ReDoS-safe by construction, not by exception handling (M1-3):**
    `ua.slice(0, 256)` before any pattern match — bounds the input
    regardless of what a client sends. The pattern itself is linear-time:
    no nested quantifiers, no alternation inside a repeated group. A unit
    test asserts bounded runtime against a deliberately pathological UA
    string (§7) — proving the property, not assuming the pattern is safe.
    **This also corrects §5:** wrapping the check in try/catch does not
    protect against catastrophic backtracking — a ReDoS hang is not a
    thrown exception, it's the single-threaded event loop never returning,
    which try/catch cannot interrupt. try/catch still covers ordinary
    unexpected exceptions (§5 is otherwise unchanged), but it was never the
    ReDoS mitigation and this plan should not have implied it was.
- **Call site 1 — the route wrapper** (mechanism unchanged from Round 2, now
  imports the shared module): at the top of `handleAuth`, before the
  existing `const response = await auth.handler(request);` line, read the
  incoming `user-agent` header and classify it via `device-class.ts`. On a
  positive match, short-circuit and return the reject response below
  without calling `auth.handler` at all — none of the existing
  403/ONBOARDING_REQUIRED/OAuth-callback logic in this file runs for a
  blocked request.
- **Call site 2 — `acceptTosAction`** (`src/server/auth/tos-accept.ts`,
  new for this task, M1-2): classify at **function entry**, before the
  `onboarding_ref` cookie is even read — earlier than "before calling
  `issueOnboardingSession`" as the review's own wording literally put it.
  Reading the actual function this session (not assumed): its transaction
  already grants the once-per-user initial Dharma amount and writes the
  append-only `user.tos_accepted` event *before* the point the review's
  wording would place the check. Gating only immediately before
  `issueOnboardingSession` would still let a blocked device's request grant
  real Dharma and write a permanent audit event, then deny the session that
  would let anyone ever use either — an orphaned, ToS-accepted-but-
  unsessionable user row, permanently consuming that user's one-shot
  `initial_grant` slot (`dharma_ledger_initial_grant_user_uq`,
  I-GRANT-ONCE-001-adjacent) for nothing. On a classifier match at function
  entry: `redirect("/sign-in")` — the exact pattern this function already
  uses for a missing/invalid `onboarding_ref` cookie, so this is the
  function's existing failure shape applied one condition earlier, not a
  new one. `/sign-in` already renders the "computer only" message below the
  breakpoint (§4).

- **Scope:** the entire `/api/auth/*` surface, every sub-path, unconditionally
  — not an allowlist of specific auth-initiating paths. Verified this is safe:
  the only HTTP consumer of this route in the whole tree is the Better Auth
  React client (`authClient`), used in exactly two files
  ([sign-in/page.tsx](src/app/\(auth\)/sign-in/page.tsx),
  [sign-in/otp/page.tsx](src/app/\(auth\)/sign-in/otp/page.tsx)), both
  themselves gated below the breakpoint in Phase B. Every session read on the
  read surfaces goes through `auth.api.getSession({ headers })` called
  **in-process** ([_lib/session.ts](src/app/\(public\)/_lib/session.ts),
  `(auth)/layout.tsx`) — never over HTTP, never through this route. Sign-out
  (`signOutAction`, [logout.ts](src/server/auth/logout.ts)) is likewise an
  in-process Server Action call. `disableSessionRefresh: true` means no
  background refresh traffic either. A signed-in mobile session — whether
  pre-dating this feature or established via a spoofed/desktop-mode UA — is
  therefore **unaffected**: nothing it does during normal browsing/session-use
  ever hits this route.
- **Device classification (extended per Round 2 ruling — tablets and iPads
  now in scope, not just phones):**
  - **Phones:** unchanged from the original pattern.
  - **Android tablets:** extended pattern matches `Android` UA strings
    lacking the `Mobile` token — Chrome's own convention is to omit `Mobile`
    on tablets while including it on phones. **Real, bounded, accepted
    false-negative rate:** this convention is Chrome-specific, not
    universal — other browsers and some budget-tablet manufacturers don't
    follow it consistently. Same accepted-risk posture as the existing
    phone-UA false-positive finding (§5).
  - **iPads — researched, and this is a hard technical ceiling, not an
    implementation gap:** iPadOS Safari's default mode (on since iPadOS 13,
    2019, unchanged through iPadOS 26 in 2026 — verified via web search
    against current sources, not assumed) sends a User-Agent string
    **byte-identical to real macOS Safari**:
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15
    (KHTML, like Gecko) Version/26.x Safari/605.1.15`. There is no token
    anywhere in that string distinguishing an iPad from a real Mac —
    confirmed by Apple's own developer forums grappling with the same
    question (sources: Niels Leenheer, "The User-Agent string of Safari on
    iOS 26 and macOS 26", 2025; Apple Developer Forums, "Is there any
    information in the user agent that identifies whether it is an iPad or
    not?"). **Any server-side pattern that tries to catch this would also
    catch every real desktop/laptop Mac user and block their sign-up** — a
    far worse outcome than under-blocking iPads, and not attempted. The only
    self-identifying iPad UA (`Mozilla/5.0 (iPad; CPU OS ... like Mac OS X)
    ...Mobile/15E148...`) requires the user to have manually opted into
    Safari's per-device "Request Mobile Website" setting, which is **off by
    default** — so this only ever matches a minority of real iPad traffic.
    UA Client Hints (`Sec-CH-UA-*`) don't rescue this either: Safari/WebKit
    has never implemented the Client Hints spec, by longstanding design
    choice.
  - **Consequence:** for the default-mode iPad — the overwhelming majority
    of real iPad traffic — **the server-side layer provides no enforcement
    at all.** This is the one device class where this plan's usual "server
    is the real backstop, client is cosmetic" framing (ADR-0045, §4) does
    not hold. The client-side touch-primary rule (§4) is the only practical
    deterrent for it, not a redundant cosmetic layer on top of a working
    server check. Rated a high self-critique finding, not a footnote.
- **Response on block, revised (M1-6):** JSON `403`,
  `{ "code": "mobile_auth_unavailable" }`, no `Set-Cookie`, for POST/SDK-driven
  requests — matches the existing short-code convention in this file
  (`admin_login_invalid`, `oauth_email_not_verified`, `identity_pool_exhausted`).
  **Exception, reusing the file's own existing discriminator:** for a blocked
  GET on the OAuth-callback path, reuse the `isOAuthCallback` check already
  in this file (`url.pathname.startsWith("/api/auth/callback/")`) and
  `302`-redirect to `/sign-in` instead — where the "computer only" message
  already renders below the breakpoint (§4) — rather than a raw JSON blob
  answering what is fundamentally a browser navigation. Corrects the
  original plan, which applied the JSON shape uniformly; the file already
  draws exactly this GET-navigation-vs-POST-fetch distinction for its
  existing ONBOARDING_REQUIRED handling, so this reuses an established
  pattern instead of adding a third response shape.
- **Observability (M1-5, un-deferred from Self-critique #4):** one
  structured log line per reject, at both call sites. **Not** a call to the
  existing `logRequest` in `src/server/middleware/logging.ts` — that
  function's own doctrine explicitly excludes rejections ("Rejected
  requests — origin-blocked, rate-limited, auth-failed — DO NOT call this
  helper") and its 7-field shape is locked to the public-dataset extractor
  (SPEC.1 §16.3; changing it needs a SPEC.1 amendment, out of scope here).
  Add a small, separate export to the same file (e.g. `logDeviceGateReject`)
  following the identical `console.log(JSON.stringify(...))` emission
  pattern, with its own field set (call site, classification reason,
  truncated UA) — not reusing or widening `logRequest`'s locked shape. This
  is the only way to know the false-positive rate or whether the gate is
  still working post-launch.
- **Auth requirement:** N/A — this check runs before any session/auth state
  exists or is consulted; it classifies the request, not the requester.
- **Rate-limit class:** none. The reject path does zero DB/external work, so
  it is strictly cheaper than the flows it replaces and cannot be used to
  amplify load beyond what hitting the same endpoints with a desktop UA
  already permits today.

**Not touched:** `src/server/auth/index.ts` (the Better Auth instance,
`databaseHooks`, `zugzwangOtpGate`, `issueOnboardingSession` itself — all
zero-diff; only its *caller* in `tos-accept.ts` gains a pre-check),
`proxy.ts` (admin-only middleware — **founder-ratified untouched, M1-4**,
not just a developer default), `(auth)/layout.tsx`.

**Touched, newly (M1-2):** `src/server/auth/tos-accept.ts` — a small, scoped
addition (the function-entry classifier check above); its transaction,
Dharma-grant, and event-emission logic are otherwise unchanged. New file:
`src/server/auth/device-class.ts` (the shared classifier).

## 4. UI / user flow

**Breakpoint token** (Phase A) — `src/app/globals.css`, `@theme` block:
`--breakpoint-mobile: 640px;`. Tailwind v4 generates `mobile:*` (≥640px,
"desktop and up") and `max-mobile:*` (<640px, "phone and below") variants
from this automatically. **Discipline: desktop is the unprefixed/default
state everywhere; every mobile-specific rule is a `max-mobile:` override.**
This is what makes "zero desktop regression" structurally true rather than
asserted — a broken or missing token can only ever affect the `max-mobile:`
rules, never the base ones.

**Resolved (M1-8): `--breakpoint-mobile` is a deliberate synonym for
Tailwind's own default `sm` (640px, unoverridden in this repo) — kept, not
dropped, stated explicitly rather than left implicit.** Two reasons: (1)
ADR-0045's own file map requires an explicitly minted breakpoint
("breakpoints are minted here or not at all") — relying on Tailwind's
undeclared default would match the pixel value but not the ADR's
explicit-minting requirement; (2) naming it `mobile` rather than reusing
bare `sm` decouples this plan's phone-width semantics from Tailwind's
generic small-screen scale name, so an unrelated future use of `sm`
elsewhere can't silently start meaning "phone" by accident, and the mobile
cutoff can move independently of `sm` later without an app-wide rename. The
duplication was real and worth questioning; the resolution is to keep it,
for these two stated reasons, not leave it implicit.

⚠ **AMENDED AT THE PR #486 REMEDIATION PASS — "synonym" OVERSTATES IT, AND
THE GAP IS AN ACCESSIBILITY SETTING.** Tailwind's `sm` is **`40rem`**
(`node_modules/tailwindcss/theme.css:327`, unoverridden here); this token is
**`640px`**. Those are equal at a 16px root font size and at no other, and
root font size is something readers change on purpose. At a 20px root, `sm`
fires at 800px while `mobile` fires at 640px — and both boundaries are live
in the same stylesheet, so any place a `max-mobile:` override is expected to
hand off to an `sm:`/`md:` rule will leave a 160px band where neither
applies. Reason (2) above — that the two can diverge later without an
app-wide rename — is therefore already true today, for some readers, rather
than a future option. **The value is right and matching `sm` was the correct
call**; `px` is deliberate because a phone's viewport does not grow when
someone enlarges their text. What is corrected is the word *synonym*, in
this entry, in `globals.css`'s own comment, and in the PR body — three
documents recording a unit difference as an identity.

**Read surfaces (Phase A):**
- `(public)/page.tsx` (Discovery/feed): single-column stack below 640px;
  the featured-market hero carousel and the two-line price graph (both
  decorative per design-language §3.2) simplify or hide below 640px rather
  than attempting the full three-panel desktop composition at phone width.
  Core content — market card list, side badges — keeps rendering.
- `m/[slug]/page.tsx` (debate view): single-column stack below 640px; the
  fixed two-column YES/NO layout (design-language §6) is not preserved at
  phone width — exact per-component treatment (stacked-with-toggle vs.
  simple vertical concatenation) is Phase A's own execution-time call, not
  pixel-specified here. ADR-0045 explicitly defers "component-level
  responsive treatment" past this plan, and no Claude-Design mobile pass has
  happened (design-language §7 item 3 is scheduled but not started).
- Desktop rendering at 1440px: byte-identical before/after — verified in §7,
  not just asserted.

**Client-side CTA hides (Phase B)** — **two independent hide conditions**,
per the Round 2 ruling, not one widened breakpoint:
1. `max-mobile:hidden` — the existing 640px phone-width rule, unchanged.
2. `touch-primary:hidden` — a **new**, viewport-width-independent rule
   targeting coarse-pointer/no-hover (touch-primary) devices, via a Tailwind
   v4 custom variant minted in `globals.css`:
   `@custom-variant touch-primary (@media (hover: none) and (pointer: coarse));`
   — the standard, combined `hover:none` + `pointer:coarse` pattern for
   detecting a touch-primary device, chosen over `pointer-coarse` alone
   (Tailwind v4's own built-in variant) because the combined form is more
   precise against hybrid/2-in-1 devices with a secondary pointer.
   **Implementation risk to verify at execution time, not just trust:**
   Tailwind v4 has an open GitHub issue (#16053) where a custom variant
   built from a raw media query can generate malformed/misplaced CSS. Test
   the actual compiled output, not just that the build succeeds. If it
   proves broken, fall back to the built-in `pointer-coarse:` variant alone
   (slightly less precise — doesn't also require `hover:none` — but avoids
   the buggy path).

Both rules apply to the same three CTA surfaces, fenced by JSX element, not
the ADR's now-stale line citations:
- [IdentityCluster.tsx](src/components/shell/IdentityCluster.tsx) — the
  `<Link href="/sign-in">` JOIN button inside the `if (!viewer)` branch
  (currently lines 36–42; ADR-0045 cites 30–35, already stale).
- [AuthGateSlot.tsx](src/components/debate/composer/AuthGateSlot.tsx) — the
  two `<Button>` elements wrapping `AUTH_GATE_COPY.signUp` / `.signIn`
  (lines 42–47, still accurate).
- `sign-in/page.tsx` and `sign-in/otp/page.tsx` — see below.

**Known, accepted client-side limitation:** touchscreen laptops (e.g.
Surface-class devices) present as coarse-pointer/no-hover and will be caught
by the `touch-primary:hidden` rule too, hiding the CTA for a real laptop
user. Same accepted-risk posture as the existing UA false-positive findings
— this is the cosmetic layer, not enforcement, and such a user's UA is a
completely ordinary Windows/desktop string, so their actual sign-up would
still succeed server-side if they reach `/sign-in` some other way (e.g. a
direct link). Not fixed; documented.

**Sign-in destination pages (Phase B):** below 640px, both pages render the
plain message **"Sign-up only works on a computer right now."** in place of
the real form, reusing the existing `Card`/`CardHeader`/`CardContent`
primitives already imported in both files — no new component. **Implemented
as a pure-CSS toggle between two sibling blocks (both present in the
server-rendered HTML, `max-mobile:hidden` / `mobile:hidden` deciding which
paints), never a client-side JS-computed conditional render.** This is a
correctness requirement, not a style preference: both pages are already
`"use client"` and fully dependent on JS to actually submit anything, but a
CSS-only toggle means the correct state renders even before hydration, with
zero flash and zero dependency on `window.innerWidth`/`matchMedia` at
runtime.

**`(auth)/layout.tsx` — not touched, structurally.** This file mounts
`WarliHero` as a `fixed inset-0 -z-10` decorative layer with several
explicitly documented "this silently breaks if you touch X" landmines in its
own comments (background propagation, `min-h-dvh`/flex chain fragility). The
message-vs-form toggle lives entirely inside each page's own returned JSX,
never in the shared layout. `WarliHero` keeps rendering behind the message on
mobile — harmless, since it is `pointer-events-none` and purely decorative.

**`/onboarding` — no treatment.** Reaching it requires a successful OAuth/OTP
attempt to have gotten far enough to trigger `ONBOARDING_REQUIRED`; both
entry points that lead there (`sign-in/social`, `sign-in/email-otp`) are
blocked upstream in Phase B. A mobile UA cannot reach `/onboarding` through
normal use, so it needs no gate and no responsive treatment.

## 5. Failure modes

- **UA header missing/empty/unparseable at the check** → fail **open**
  (classify as desktop, let the request through to `auth.handler`). Rationale:
  this is a policy/UX gate, not a security boundary (ADR-0045 says so
  explicitly) — the failure that matters is never wrongly blocking a real
  desktop signup, not the narrow, already-accepted case of an unusual client
  slipping through.
- **Unexpected exception inside the classifier itself** → wrapped in
  try/catch, logged, fail open. A bug in a peripheral UA check must never
  take down real signups. **Correction (M1-3): this does not cover
  catastrophic-backtracking/ReDoS hangs** — a pathological regex match
  doesn't throw, it never returns, and try/catch has nothing to catch. The
  actual ReDoS mitigation is structural, specified in §3: a bounded input
  length (`ua.slice(0, 256)`) and a linear-time pattern with no nested
  quantifiers or alternation-inside-repetition, proven by a dedicated unit
  test (§7) rather than assumed safe. This plan's original wording implied
  try/catch covered this case; it doesn't, and didn't.
- **UA regex false positives on atypical (non-phone) clients** — a real,
  not-fully-eliminable residual risk, not just a theoretical one: some
  desktop in-app webviews (email clients, chat-app embedded browsers) carry
  "Mobile" tokens in their UA string for legacy compatibility reasons, and
  would be wrongly classified as mobile by a naive phone-pattern regex. No
  clean fix exists without a much heavier detection mechanism, which
  contradicts "policy gate, not security boundary." Accepted, named
  explicitly here rather than left implicit — see Self-critique.
- **Race/concurrency:** none applicable. The check is a stateless,
  synchronous, per-request classification with no shared mutable state — not
  in the same failure class as the bet-transaction machinery elsewhere in
  this codebase.
- **Migration applied but code not deployed (or vice versa):** N/A, no
  migration in this task.
- **Desktop regression:** structurally prevented, not just tested — see the
  `max-mobile:`-only discipline in §4.

## 6. Edge cases

- **Desktop-mode / "Request Desktop Site" mobile browsers:** passes the
  server gate by design (UA reports as desktop). ADR-0045 names and accepts
  this already; not re-litigated here.
- **Resized desktop windows:** the server always allows (UA doesn't change on
  resize). The CSS layer, being viewport-based, *will* hide the CTAs and show
  the "computer only" message on the sign-in pages for a real desktop user
  who has simply narrowed their browser below 640px. Accepted, known rough
  edge — stated explicitly rather than left implicit. No fix planned; adding
  one would mean a second detection mechanism for a scenario with no realistic
  user-harm.
- **Tablets and iPads — resolved (Round 2 ruling): excluded from Join/Login,
  browsing unaffected.** Two different reliability profiles, not one:
  - **Android tablets:** real, bounded false-negative rate server-side (the
    `Android`-without-`Mobile` heuristic isn't universal — §3). The
    client-side touch-primary rule (§4) catches most of what the server
    misses.
  - **iPads in default (desktop) Safari mode — the majority of real iPad
    traffic:** **cannot be detected server-side at all**, confirmed by
    research, not a reliability nuance (§3). The client-side touch-primary
    rule is the only practical deterrent for this case — not a backup layer
    on top of a working server check, the *only* layer. A determined or
    accidental iPad user who reaches `/sign-in` (direct link, or the CTA
    somehow not hidden) will have their sign-up **succeed** server-side.
    Accepted, per the "policy gate, not security boundary" framing ADR-0045
    already establishes — but the magnitude here is larger than the other
    accepted gaps in this plan, since it's the default configuration of an
    entire major device class, not a rare exception. Rated a high
    self-critique finding.
- **Touchscreen laptops:** caught by the new `touch-primary:hidden` client
  rule (coarse-pointer/no-hover), same as a tablet — CTA hidden for a real
  laptop user with a touchscreen. Accepted, cosmetic-layer-only (§4) — their
  UA is an ordinary desktop string, so direct-link sign-up still succeeds
  server-side.
- **Two devices, one account:** cookies are device/browser-scoped and never
  shared cross-device by this stack, so a desktop-signed-in user opening the
  same account on their phone simply presents no cookie there — ordinary
  signed-out mobile browsing, not a special case.
- **Existing/pre-existing mobile sessions** (signed in before this ships, or
  via a spoofed/desktop-mode UA): completely unaffected, per §3 — the gate
  only blocks *new* sign-in attempts, never session reads or any bet/comment
  endpoint.

## 7. Test plan

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| Unit (`tests/unit/`) | UA classifier as a pure function: clear-mobile UA → blocked; clear-desktop UA → allowed; missing/empty UA → allowed (fail-open); "Request Desktop Site" spoofed UA (desktop-class string on a phone) → allowed (by design, §5); Android tablet UA (no `Mobile` token) → blocked; budget/non-Chrome Android tablet UA that *does* carry `Mobile` → allowed (documented false-negative, §3, not a bug); iPad UA in default desktop-Safari mode (`Macintosh; Intel Mac OS X...Safari`) → **allowed, and asserted as correct, with an inline comment explaining why** — this is the researched, structural iPad limitation (§3), not something a future reader should "fix"; iPad UA with the user's own opt-in "Request Mobile Website" setting (`iPad; CPU OS...Mobile/15E148`) → blocked | None — no thesis invariant touched; this proves the task's own internal correctness |
| Integration (`tests/integration/`) | Hit `/api/auth/[...all]`'s real `handleAuth` with each UA class against `sign-in/social`, `sign-in/email-otp`, `email-otp/send-verification-otp` — assert 403 + `mobile_auth_unavailable` for mobile/tablet UAs, real pass-through into `auth.handler` for desktop UAs including a Mac-Safari UA specifically (proves the block doesn't regress real desktop auth, and specifically doesn't misfire on the exact string an iPad shares) | None |
| Component (jsdom, `tests/unit/**/render/`) | `IdentityCluster`/`AuthGateSlot` hide the CTA at/below 640px, show it above (existing rule, unchanged); coarse-pointer + no-hover simulated at a wide viewport (simulated tablet) → CTA hidden by the new `touch-primary:hidden` rule; fine-pointer + hover-capable simulated at a viewport ≥640px (a laptop window resized down but still above the phone-width cutoff — **not** below 640px, which is the pre-existing, already-accepted width rule from Round 1 and not what this new case is testing) → CTA still shown, proving the new touch-primary rule doesn't accidentally correlate with width; sign-in pages render the message below 640px and the real form above it, via the DOM class/attribute — not via `toBeInTheDocument()` (unavailable, no jest-dom, per AGENTS.md §9) | None |
| Manual/Browser (Chrome/CDP, per AGENTS.md §9's documented "Browser measurement" practice — this repo has no automated visual-regression tool, and adding one is an ask-first dependency decision out of scope here) | Confirm Discovery/`/m/[slug]` render byte-identical at 1440px before/after Phase A (iframe-pinned width, computed-style snapshot per the documented gotchas); confirm phone-width (375px, 414px) renders the new stacked layout without overlap or horizontal scroll; confirm the `touch-primary:` compiled CSS actually matches on `(hover: none) and (pointer: coarse)` and nothing else (Tailwind v4 issue #16053 risk, §4) | None |
| Unit (`tests/unit/`) — new, M1-2/M1-3 | ReDoS: assert `device-class.ts`'s classifier returns within a tight time bound against a deliberately pathological UA string crafted against the actual chosen pattern — proves linear time structurally, not "looks fine on normal input"; a second assertion confirms both `route.ts` and `tos-accept.ts` import the same exported function (no inline/duplicate pattern anywhere else in the tree) | None |
| Integration (`tests/integration/`) — new, M1-2 | `acceptTosAction` called with a **valid** `onboarding_ref` cookie but a mobile/tablet-classified request: assert (a) `redirect("/sign-in")` fires at function entry, before the transaction opens, (b) **zero** `dharma_ledger` rows written, (c) **zero** `events` rows written, (d) no session/cookie issued. This is the test that proves the orphaned-grant gap found this session (§3) is actually closed, not just that a session is eventually denied. | Nearest thing this task has to a thesis-invariant assertion: proves this path cannot pre-consume a user's one-shot `initial_grant` slot for a session that will never exist (I-GRANT-ONCE-001-adjacent — not itself a §1 invariant, since §1 remains "no" across the board) |
| Component/Integration (jsdom or route-level) — new, M1-6 | A blocked OAuth-callback GET request asserts a `302` to `/sign-in`, not a JSON body — distinguishing it from the POST/SDK-driven reject shape | None |

No invariant-assertion row is required per §1 — every row above tests this
task's own correctness, not a thesis invariant.

**Note on the Component-row wording above:** the Round 2 ruling's own
test-plan request read "fine-pointer + narrow-viewport (simulated resized
laptop window) → CTA still shown," which taken literally conflicts with the
already-accepted Round 1 edge case that a laptop window narrowed *below*
640px already gets the CTA hidden today (§6). Resolved as "≥640px, merely
narrower than typical" — consistent with the concern actually stated
alongside it ("A width-only approach risks also hiding the button for a
real laptop user... which must not happen"), which is about the *new*
touch-primary rule not gaining an unintended width correlation, not about
reopening the pre-existing width rule.

## 8. Out of scope

- No PFP/pseudonym work.
- No `/admin/*` changes — ADR-0010's structural separation stands untouched.
- No colour/brand changes.
- No native mobile client (ADR-0045 Option 4, rejected).
- No `/onboarding` treatment — naturally unreachable by mobile, §4.
- No developer/QA bypass mechanism for testing the gate in production — use
  browser devtools' UA override / responsive mode locally instead. One more
  spoofable mechanism to maintain isn't worth it for a gate that's already
  explicitly not a security boundary.
- ~~No observability/logging addition for rejected mobile attempts~~ —
  **reversed at M1-5, second-pass review.** No longer out of scope; see §3
  (`logDeviceGateReject`) and Self-critique #4 (now addressed, not
  deferred).
- No automated visual-regression tooling — the existing manual Browser
  Measurement practice (§7) substitutes.
- No change to `docs/plans/RATE-GUARD-PUBLIC.md` (unrelated in-progress plan)
  or to `tests/e2e/.auth/*.json` (escalated to Hrishikesh separately, per
  Decisions received above).
- Not touching `src/server/auth/index.ts` — the route-wrapper mechanism
  (§3) was chosen specifically so this file takes zero diff.

---

## Open questions

None at plan time. The tablet-treatment question from Round 1 is resolved by
the Round 2 ruling: tablets and iPads are excluded from Join/Login (§3, §4),
browsing is unaffected (§4). What remains is not an open *question* — it's a
documented, researched technical ceiling (default-mode iPads cannot be
detected server-side, §3) with no decision pending on it, carried instead as
Self-critique finding #1 so it stays visible through Gate C rather than
being filed as if it were still awaiting an answer.

## ADRs needed

None. This plan resolves Phase-1-level details ADR-0045 explicitly deferred
("Exact breakpoint pixel values / component-level responsive treatment...
Phase 1 plan detail, once this ADR is accepted") and the mechanism choice for
the server-side reject, which ADR-0045 named as a "Phase 1 planning question,"
not a decision it made itself. No new architectural decision is introduced
beyond what ADR-0045 already ratifies.

---

## Self-critique (after Phase 1 self-review)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | high | **Server-side enforcement does not exist for default-mode iPads — the majority of real iPad traffic — and no fix is possible without also blocking real Mac desktop users.** Researched and confirmed (§3): iPadOS Safari's default UA is byte-identical to macOS Safari, by Apple's own design since 2019, unchanged through 2026. "Join/Login restricted to computer/laptop ONLY" is therefore true by *server-side* construction only for phones and (imperfectly) Android tablets — for the default-mode iPad it is true only insofar as the client-side `touch-primary:hidden` rule succeeds at hiding the button, a materially weaker guarantee than everywhere else in this plan. Rated high, not medium (revised up from the original tablet-policy finding this replaces, per the Round 2 ruling): this isn't a rare edge case slipping through an otherwise-solid check, it's the *default configuration of an entire major device class* having zero server-side backstop. | Not fixable within this plan's constraints — a technical ceiling, not an implementation gap. Documented prominently in §3 and §6 rather than left as a footnote, specifically so Gate C reviews it with accurate expectations rather than assuming "excluded" means the same thing for iPads as it does for phones. |
| 2 | medium | The UA classifier will have a real, non-zero false-positive rate on atypical desktop clients — specifically desktop in-app webviews (email/chat-app embedded browsers) that carry legacy "Mobile" compatibility tokens in their UA string. This isn't hypothetical hedging; it's a known category of UA string. No fix exists that doesn't add a heavier detection mechanism, which would contradict the "policy gate, not security boundary" framing ADR-0045 deliberately chose. | Accepted and named explicitly in §5 rather than left implicit. No action — flagging so it isn't rediscovered as a "bug" later. |
| 3 | low-medium | Between Phase A merging and Phase B merging, mobile visitors get the improved read-surface layout but the JOIN button is still visible and still routes to the still-unstyled, still-ungated `/sign-in` page (today's status quo, not a new regression) — an accepted interim state, but one that could read as "half-broken" if someone checks the site in that window without knowing Phase B is still in flight. | Named here so it isn't mistaken for an incomplete rollout if noticed; no fix needed, sequencing is intentional per Decisions received #3. |
| 4 | low | Declining to add any observability on rejected mobile attempts (§8) means ADR-0045's own Decision Driver 1 — "record this so ratification means ratifying the tradeoff, not overlooking it" against ADR-0038's 100k-signup target — has no way to be checked against reality until it's too late to act on (e.g., not until the Nov freeze). This was a deliberate scope call, not an oversight, but it is a genuine open gap, not a closed one. | **Addressed, not deferred (M1-5, second-pass review, reversing the original call).** One structured log line per reject, both call sites, via a new small export in `src/server/middleware/logging.ts` (§3) — not the existing `logRequest`, whose shape is locked and whose own doctrine excludes rejections. |
| 5 | medium | Two more ordinary accuracy gaps, secondary to finding 1: (a) Android-tablet server-side matching has a real, bounded false-negative rate (§3) — not every manufacturer/browser follows Chrome's `Mobile`-token convention; (b) the new client-side `touch-primary:hidden` rule also hides the CTA for real touchscreen laptops (e.g. Surface-class devices) — a false positive on a legitimate desktop user, not a missed exclusion. | Both accepted, same posture as finding 2 — named explicitly (§3, §4, §6) rather than left implicit. |
| 6 | high (found and fixed this pass) | The original plan's server-side gate covered only the route wrapper (`route.ts`), missing `acceptTosAction`'s in-process, `SERVER_ONLY` session-issuance path entirely (M1-2, second-pass review). A mobile/tablet device that somehow obtained a valid `onboarding_ref` cookie could have completed signup with zero server-side gate at all. Worse: gating only at the literal point the review specified (immediately before `issueOnboardingSession`) would still have let such a request grant real initial Dharma and write a permanent audit event before being denied a session — an orphaned, unsessionable user row permanently holding a consumed one-shot grant slot. | Fixed: shared classifier module, second call site at `acceptTosAction`'s function entry — before the transaction opens, not just before session issuance (§3). A test specifically proves zero Dharma/event writes on a blocked classification (§7), not just that a session is eventually denied. |

Two high findings, in different states. Finding 1 (device-class-scale
enforcement gap for iPads) is founder-ratified as intended, not a gap
awaiting a decision (M1-1) — it stays high-severity because it is still
worth a reviewer's attention at every future read of this plan, not because
it remains unresolved. Finding 6 (the `acceptTosAction` coverage gap) was
found **and fixed** within this same self-critique pass — recorded rather
than silently absorbed, per this plan's own standard for what a
self-critique is for. Nothing here breaks a thesis invariant, corrupts
data, or is irreversible — consistent with this task's actual shape (a
UI/UX and policy gate, not bet/Dharma/resolution code) — but a real-money-
adjacent grant almost shipping without a corresponding session is the
closest this task came to an actual defect, which is why it's recorded at
high rather than folded into a routine accuracy note. Checked: invariant
coverage (§1, revised this pass), scope discipline (§8), test-assertion
coverage (§7), edge-case enumeration (§6), and the specific request to
critique imprecision — finding 2 (in-app-webview false positives), the
resolved test-plan ambiguity noted in §7, and finding 6 itself are exactly
that: places where this plan's own language, or the second-pass review's
own wording, was less airtight than it first read.

---

## References

- `CLAUDE.md` — the contract this plan respects (§1 critical-path list, §2
  thesis invariants, §5.1 plan-mode ritual, §8 O-8/O-15 identifier discipline)
- `AGENTS.md` — §5 Next.js patterns, §7 Better Auth operational notes, §9
  testing layers (component/render, integration, manual Browser Measurement)
- `docs/adr/0045-mobile-responsive-browsing-and-auth-gate.md` — the ADR this
  plan implements (renamed from 0041 during this session)
- `docs/adr/0023-participant-shell-topology.md` — the `(public)/` shell this
  plan's Phase A operates within
- `docs/adr/0004-better-auth.md` — the session-deferral hook pattern this
  plan explicitly does *not* use for the mobile gate, and why (§3)
- `docs/adr/0010-admin-auth.md` — the "UX-layer, not a security boundary"
  precedent this plan's server-side gate follows
- `docs/design/design-language.md` — §1.7 (desktop-only constraint this ADR
  narrows), §7 (mobile/responsive named as a scheduled later pass)
- Tracker: none (ad hoc, see Tracker context)

---

*Plan template lives at `docs/plans/_template.md`.*
