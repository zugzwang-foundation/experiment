# ADR-0052 — Prerendering the Auth Shell by Hoisting Its Two Request Reads

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-13 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | AUTH-PRERENDER (the load-testing programme's last unfixed per-request cost) |
| **Frame document** | ADR-0023 §Patch record (the `(auth)` shell mount) · ADR-0041 (`cacheComponents`) · ADR-0048 (`mobileResponsive` on the auth mount) · `docs/logs/S4-PHASE-B.md` (the deferral this discharges) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | ADR-0041 — the consequence that moves: `instant = false` on `(auth)/layout.tsx` is no longer the route group's opt-out. It scopes to `(auth)/onboarding/page.tsx` alone. |
| **Amended-by** | — |

---

## Context and Problem Statement

A load-testing programme run 2026-09-01 → 2026-09-13 against staging found `/sign-in` failing at
**>98% at 200 concurrent** — the lightest crowd tested, and far worse than any other surface, all of
which held. The product returned no wrong answers under any pressure; what failed was capacity, and
this page failed first and worst.

**The cause is a category difference, not a magnitude one.** Every other page's per-request cost is
an *awaited* database read, which yields Node's single event loop. `/sign-in`'s dominant cost is
*synchronous CPU*, which does not. The `(auth)` layout mounts a decorative SVG art layer
(`WARLI-MOUNT`, one site, this file) whose markup is **15,956 tags / ~791 KB**, measured at **~30 ms
of serialization per request**, of which the static field layer alone is 13,584 tags (85%) and
21.53 ms (72%). Two hundred concurrent requests is six seconds of unyielding CPU ahead of the
two-hundredth response.

**Two earlier fixes aimed at the wrong half of that number, and naming them is most of this ADR's
value.** Hoisting the scene *arithmetic* to module scope saved 1.367 ms. Hoisting the entire element
*tree* to module scope took the hero from 31.19 ms to 30.09 ms — 3.5%. Both were real and both were
marginal, because element **construction** was never the cost: markup **serialization** is, and no
amount of caching upstream of the renderer touches it. The server writes every tag on every request
for as long as a request is what triggers the render. ⚠ The 1.367 ms figure was also actively
misleading: it benchmarked `buildFieldScene` alone — the code that pass was about to fix — so it was
blind to the ~30 ms sitting directly beside it. An instrument pointed only at the part already being
repaired.

⇒ The only fix is to stop rendering per request. Two `await`s at the **top level of the async layout
function** were what prevented that:

- `(auth)/layout.tsx:43` — `await auth.api.getSession({ headers: await headers() })`
- `(auth)/layout.tsx:66` — `await readStarCount()`

Under `cacheComponents` (ADR-0041) an unwrapped `headers()` read errors the prerender build, and
`export const instant = false` was the opt-out that kept the build green. **That opt-out is what
produced the empty shell** — a fact already recorded twice in this repository, in both cases naming
this exact export as the blocker and this work as its exit condition
(`docs/parked.md:3580-3582`, `docs/plans/WARLI-MOUNT.md:67-68`). S-4 Phase B called it *"Deferred,
not restructured"*, which was the correct call at the time and was never costed.

This ADR does **not** decide:

- Whether `cacheComponents` / `'use cache'` are the right primitives (ADR-0041 D-1, unchanged).
- Cache **keys** for the participant read blocks (ADR-0051, unchanged and untouched here).
- Anything under `src/server/auth/`. No auth logic, no gate, no redirect, no session semantics moves
  — see *Decision Driver 1*.
- The `(public)` route group's identical unwrapped-read shape. It keeps `instant = false` and is out
  of scope; restructuring it is separate work with a separate blocker (ADR-0034's 744-line
  `"use client"` `DebateView` takes `model` and `viewer` as sibling props).
- The DB connection ceiling (`src/db/index.ts`), which is site-wide, needs infra access, and whose
  obvious fix was already tried and made things worse.

## Decision Drivers

1. **This must not be an auth change.** CLAUDE.md §1 area 4 is `src/server/auth/`, and the layout's
   own docblock states the governing invariant: *"ZERO AUTH-LOGIC EDITS, not zero file edits."* Any
   option that alters what the session read *means* is disqualified regardless of its performance.
2. **Every existing guard must keep exercising real code.** Eight guards pin this surface by
   **literal file path**, several by *set equality* rather than membership. An option that leaves
   them green by moving their subject out of reach is worse than one that reddens them.
3. **The header must stay a sync component.** Documented twice already (`(auth)/layout.tsx:62-65`,
   `(public)/layout.tsx:104-109`): the awaits live in the layout *because* `GlobalHeader` renders in
   jsdom at `tests/unit/shell/dharma-cluster.test.tsx`, and React's client renderer refuses an async
   component.
4. **No value that changes between renders may enter a prerender.** A build-time value served as
   though it were a request-time one is a correctness defect, not a cosmetic one.
5. **The fix must be measurable as a state change, not as a benchmark.** Two prior passes produced
   defensible millisecond figures for changes that did not fix the problem. The evidence for this one
   has to be structural.

## Considered Options

1. **Hoist both awaits into an in-file async child behind `<Suspense>`** ← chosen
2. Extract the header mount to a new `_components/AuthHeader.tsx`
3. Replace the artwork with a rasterised asset or an inline sprite
4. Make `hero.tsx` a server component
5. Accept the cost and rate-limit `/sign-in`

## Decision Outcome

**Chosen: Option 1 — hoist both awaits into an in-file async child behind `<Suspense>`.**

Four primitives are ratified, each load-bearing:

**D-1 · The layout's default export becomes synchronous.** Both request reads move into
`AuthHeader`, a non-exported `async function` **in the same file**, rendered inside a single
`<Suspense>` boundary. Nothing about either read changes — same call, same arguments, same derived
`viewer` shape, same consumer. Only its *position in the tree* moves, which is the whole of what
decides prerenderability.

**D-2 · `AuthHeader` stays in `layout.tsx` and is not extracted.** This is a decision, not a
convenience. `global-header-mobile-reflow.test.ts`'s **D-4** guard scans *that file alone* for a
direct mount of the onboarding deck — a mount there could be handed an `onComplete` and let a
signed-out visitor write their own completion marker, suppressing their real first-login deck later.
Extraction would put the header mount **outside that guard's reach**: the check would still pass, on
a file that no longer contains what it is looking for. **Coverage narrowing with nothing red** is the
failure this arrangement refuses. Seven further path-pinned guards are kept green by the same choice.

**D-3 · The Suspense fallback reserves the header's box, never its content.** The first
implementation used `<GlobalHeader viewer={null} stars={null} mobileResponsive />`, reasoning that
all three routes render signed out anyway (`/sign-in` and `/sign-in/otp` by definition,
`/onboarding` by ADR-0023's ruling), so a null-viewer header *is* the common case and the swap would
be invisible. **The build rejected it, correctly.** `GlobalHeader.tsx:245` seeds the freeze countdown
from `Date.now()`, and a clock cannot be prerendered: the value would freeze at *build* time and be
served until the dynamic header replaced it — a September build opening November by announcing the
wrong number of days left, briefly, on the surface whose entire job is to say how long is left. The
fallback is therefore a bare band carrying the header's chrome (opaque `bg-n0`, both hairlines,
tier-1 elevation, the 60px band) and none of its content, `aria-hidden` and a `<div>` rather than a
second `<header>` landmark, and `sticky` rather than `fixed` so the file keeps exactly one `fixed`
class string. What streams in is the **controls appearing inside a bar that was already drawn
correctly** — a fill, not a shift.

**D-4 · `instant = false` scopes to the one page that still needs it.** It leaves the layout and
lands on `(auth)/onboarding/page.tsx`, which reads `cookies()` unwrapped and drives four
`redirect()` calls — the onboarding gate, which is not restructured for a rendering benefit.
`/onboarding` is reached once per participant, immediately after an OAuth round trip; per-request
cost is not its problem the way it is `/sign-in`'s.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| The `(auth)` shell's tree shape, its one artwork mount, and its one dynamic hole | `src/app/(auth)/layout.tsx` |
| The `(auth)` group's remaining prerender opt-out | `src/app/(auth)/onboarding/page.tsx` |
| That every `GlobalHeader` mount in the auth layout opts into `mobileResponsive` | `tests/unit/shell/global-header-mobile-reflow.test.ts` |

## Consequences

### Positive

- **Measured, before and after, by building both trees.** `/sign-in` and `/sign-in/otp` move from
  `ƒ` (Dynamic) to `◐` (Partial Prerender). `/onboarding` stays `ƒ` by design.
- **The artwork is on disk.** `.next/server/app/sign-in.html` is **799,674 bytes** carrying 330
  ground marks, 104 motifs, 28 field figures and 4,689 SVG shape tags — serialized once at build
  instead of once per request. This is a state change, not a benchmark, which is what Driver 5 asked
  for.
- **Exactly one Suspense hole in the shell, and no header mount in it** — so the countdown clock
  verifiably stayed on the dynamic side rather than being silently baked in.
- **A latent guard hole closed in the same commit.** `global-header-mobile-reflow.test.ts` used
  `.exec()`, which returns one match. Mutation-tested against the two-mount draft of this change:
  with the second mount reverted to `mobileResponsive={SOME_FLAG}`, the old form returned **GREEN**
  and the widened `matchAll` form returned **RED**. The shipped file holds one mount, so the
  widening is defensive — kept because a Suspense boundary is where a second mount is most likely
  to arrive.
- **Served, not just built.** Under `next start`, `GET /sign-in` returns `x-nextjs-prerender: 1`
  and `x-nextjs-postponed: 1`, and the 823 KB body carries all 330 ground marks — the shell is what
  the server actually sends, with the header as the one postponed hole.

### Negative

- **The header now streams rather than arriving with the document.** *Acceptable because:* the box
  is reserved to the pixel, so there is no layout shift — only a fill — and on these three routes
  the session read is a cookie parse that usually finds nothing. Time to *first paint* improves even
  counting the fill, because the shell no longer waits on ~30 ms of serialization plus a session
  read before its first byte.
- **`(auth)` and `(public)` now have different shapes for the same problem.** *Mitigated by:* this
  ADR naming the `(public)` blocker explicitly (ADR-0034's monolithic `"use client"` `DebateView`)
  so the asymmetry reads as scoped rather than forgotten.
- **A second `Date.now()`-shaped value added anywhere in the prerendered shell will red the build.**
  *Acceptable because:* that is the guarantee working. The error names the file and line.
- **`/onboarding`'s redirects are still delivered in-stream, not as a real `307`.** Measured under
  `next start` with no `onboarding_ref` cookie: `HTTP/1.1 200`, no `Location` header, and
  `NEXT_REDIRECT;replace;/sign-in;307` inside the body — the degradation `docs/logs/S4-PHASE-B.md:29-45`
  records. ⚠ This ADR does **not** repair it, and an earlier draft implied it might: the two routes
  that shed `instant = false` contain no redirects, and the one that does keeps the opt-out.
  *Acceptable because:* it is unchanged from before this ADR, and restructuring the onboarding gate
  for a rendering benefit is the trade Driver 1 forbids. It stays owed to that log's exit criterion.

### Neutral

- **The two module-scope element hoists in `field-layer.tsx` and `hero.tsx` are kept, on a narrower
  argument than the one that landed them.** `docs/parked.md:3546-3553` records that an earlier
  element hoist was implemented, measured (26.82 → 25.65 ms) and **reverted as not worth it**. That
  measurement was of the *server* cost, which this ADR takes to zero anyway, and it never measured
  *hydration*. `hero.tsx` is `"use client"`, so the browser rebuilds ~460 `.map()` iterations of
  element tree on every page load; the hoist eliminates that and prerendering does not. **The
  server-side justification for those hoists is hereby void; the client-side one is what keeps
  them.**

## Pros and Cons of the Options

### Option 1 — in-file async child behind `<Suspense>` (chosen)

**Pros**

- The only option that changes *where* a read happens without changing *what* it means (Driver 1).
- Zero test churn on eight path-pinned guards, and D-4's coverage is preserved exactly (Driver 2).
- `GlobalHeader` stays sync; the await moved one component *down*, not up (Driver 3).
- Copies a shape the repo already runs at `(public)/page.tsx:54-68` — a sync shell mounting a
  `<Suspense>` around an async sibling.

**Cons**

- A layout file that now holds two components reads as slightly less tidy than one that holds one.
  Accepted: D-2 explains why the tidier arrangement is the unsafe one.

### Option 2 — extract the header mount to `_components/AuthHeader.tsx`

**Pros**

- Conventionally tidier; one component per file.

**Cons**

- **Silently narrows the D-4 security guard**, which scans only the layout file.
- Reddens `art-layer-guards.test.ts:360` (importer *set equality*),
  `sticky-header.test.ts:168`, `stacking-contract.test.ts:50`, and the
  `global-header-mobile-reflow` mount assertions, and would add the new file to
  `no-raw-hex-view-layer.test.ts`'s `SCAN_FILES` — five guards edited to accommodate a refactor.

**Verdict:** Rejected. It trades a real security-guard's reach for a filing convention.

### Option 3 — rasterise the artwork, or inline it as a sprite

**Pros**

- Would cut the markup to near zero regardless of prerendering.

**Cons**

- Every mechanism it needs — `<image`, `<use`, `xlink:href`, `dangerouslySetInnerHTML` — is in the
  `SINKS` denylist of `art-layer-guards.test.ts`, minted by a security audit.

**Verdict:** Rejected. Forbidden by a guard that exists for a reason unrelated to performance.

### Option 4 — make `hero.tsx` a server component

**Pros**

- Removes the hydration cost entirely.

**Cons**

- It genuinely needs client state: `useRef` ×5, `useEffect`, and pointerenter/move/leave plus
  window scroll and resize listeners.

**Verdict:** Rejected. Not possible without deleting the interaction the component exists for.

### Option 5 — accept the cost, rate-limit `/sign-in`

**Pros**

- No code change.

**Cons**

- Rate-limiting the signup funnel to protect a decorative layer inverts the priority. ADR-0038's
  signup target is the thing being protected *from*.

**Verdict:** Rejected.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| ADR-0023 §Patch record | `(auth)` shell mount | **Consumes** — *"ZERO AUTH-LOGIC EDITS, not zero file edits"*; this ADR edits the file and not the logic. |
| ADR-0041 | `cacheComponents` | **Shapes** — the `instant = false` opt-out narrows from the layout to one page; D-1/D-3/D-4/D-5 of that ADR are untouched. |
| ADR-0048 `:61`, `:82` | `mobileResponsive` on the auth mount | **Consumes** — the prop and its threading survive verbatim; the guard that checks it is widened from first-match to every mount. |
| ADR-0048 `:86` | D-4, the deck guard | **Consumes** — D-2 above exists to keep this guard's reach intact, and is the reason `AuthHeader` is not extracted. |
| ADR-0049 | signed-in header at phone width | **Consumes** — inert on `(auth)` (no Đ props passed); unchanged. |
| SPEC.1 §21.9 | the deck's re-show entry point | **Consumes** — `RulesControl` still mounts inside `GlobalHeader`, now one component down. |
| `docs/logs/S4-PHASE-B.md` | the Phase B deferral | **Discharges** — for this route group only. `(public)` remains deferred. |
| Tracker | AUTH-PRERENDER; P2.1 / ART-CPU-1 closed | All depend on this ADR being `accepted`. |

## More Information

- `docs/parked.md:3546-3553` — the measured cost breakdown, and the reverted element hoist.
- `docs/parked.md:3580-3582` and `docs/plans/WARLI-MOUNT.md:67-68` — both name `instant = false` as
  the blocker this ADR removes.
- `docs/logs/S4-PHASE-B.md:29-45` — the `redirect()` degradation, and its `curl -D -` exit criterion.
- `src/app/(public)/page.tsx:54-68` — the sync-shell-plus-`<Suspense>` shape copied here.

---

*ADR-0052 ratifies moving the `(auth)` layout's two request reads behind a `<Suspense>` boundary in
the same file, so the WARLI art layer is serialized once at build instead of once per request, and
narrowing `instant = false` to the one page that still needs it. The decision body and the four
primitives minted in §Decision Outcome are immutable; superseding requires a new ADR with a
same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
