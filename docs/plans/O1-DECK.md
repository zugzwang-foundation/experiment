# O1-DECK — The onboarding deck: first-login gate and About re-show

> **Status:** **RATIFIED (amended)** — all five open decisions ruled by the founder 2026-08-18 and applied here. Ready for execute.
> **Date:** 2026-08-18 (amended same day)
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** **no** — no CLAUDE.md §1 path is touched, no DDL, no migration. But it **mints ADR-0037** and **edits two shell files carrying live rulings and an enforcing test**, so it is gated plan-then-execute, not a trivial pass.
> **Plan PR / commit:** this file, on `plan/o1-deck`, cut from `origin/main` `c4526e2`
> **Class:** gated plan-then-execute. **NOT ultracode** — the four §6 conditions do not hold (there is an ordered proof obligation: RED-first tests before the component).

---

## Tracker context

O1-DECK. Commit 0 (the spec package) **landed** as PR #354, squash `c4526e2`: SPEC.1 **1.0.34**, new **§21.9**, the §21.6 `"skippable"` supersession, §21 preamble six → seven, nine `onboarding-deck::*` §17 rows, and the ratified copy register at `docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md`.

**Declared dependencies at plan time — all discharged:**

| Dependency | State |
|---|---|
| SPEC.1 §21.9 exists | ✅ `docs/specs/SPEC.1.md:1606`, SPEC.1 1.0.34 |
| Copy register on `main` | ✅ `docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md`, md5 `fe32aa06ba8f13d655c5a3e0a3aa83d8` |
| ADR-0037 text authored | ✅ Half B of `ZUGZWANG-O1-DECK_spec-package_v1_0.md` (376 lines, md5 `36acbb9501fcc806a5d8d209979a110f`) — **held to the build commit, not yet on disk** |
| ADR number free | ✅ `ls docs/adr/` → ceiling `0036`, next free **`0037`** (re-verified at branch time) |
| W2.2 mockup unchanged | ✅ md5 `420c5e800a3dbe3de57662f0d8f6c102` |

## Approach (one paragraph)

Build the deck as **one client component with one card array**, mounted from `(public)/layout.tsx` behind a server-evaluated gate (authenticated **AND** no cookie). Non-dismissibility is expressed by *refusing* Radix's dismissal events rather than by hand-rolling an overlay — the locked W2.1 shell already implements it that way, and shadcn's `DialogContent` passes those props straight through. The re-show is the same component with the WELCOME card filtered out and dismissal enabled, reached from a new `RULES` control in the global header. Completion writes a cookie through a Server Action; the deck closes **optimistically on the client**, so no `router.refresh()` is involved and the 15-second `DebatePoll` tick cannot reopen or flicker it.

---

# PART A — THE ELEVEN QUESTIONS

Every answer is evidenced from the repo at `c4526e2`. Measurements were taken against the **real compiled `.next` CSS**, served from a production build, in Chrome at a 1440×777 viewport, dpr 2.

## Q1 · Card 2's figure and the viewer DTO

### ⛔ The premise does not hold: there is no live PFP anywhere in this product.

The question asks whether to widen the DTO, fetch separately, or do something else. **The correct answer is "something else", and it is nothing** — Card 2 needs no data the shell does not already carry.

Every PFP on every surface today is one static asset:

| Site | Value |
|---|---|
| `src/server/debate-view/resolve-authors.ts:27` | `const PFP_PLACEHOLDER = "/pfp-placeholder.svg";` |
| `src/server/profile/resolve.ts:41` | `const PFP_PLACEHOLDER = "/pfp-placeholder.svg";` |
| `src/server/discovery/hero.ts:35` | `pfpUrl: "/pfp-placeholder.svg",` |
| `src/components/shell/IdentityCluster.tsx` | `<AvatarImage src="/pfp-placeholder.svg" alt="" />` |
| `src/app/(auth)/onboarding/page.tsx:77` | `src="/pfp-placeholder.svg"` |

`resolve-authors.ts:21-26` states why, in the repo's own words:

> *"The static onboarding PFP placeholder (D8). `pfp_filename → URL` is not built yet — onboarding assigns a static `/pfp-placeholder.svg`; the real PFP (R2 "pfp" bucket / static asset) is deferred. Until then every author renders the placeholder, so `pfp_filename` is intentionally not read here."*

`users.pfpFilename` is populated at signup (`src/server/auth/index.ts:246`, `post-commit-events.ts:208`) and is **deliberately never read** by any renderer.

### ✅ D-5 — RULED. Founder, 2026-08-18, arising from this finding.

**Card 2's figure is the shared placeholder + the pseudonym-initial fallback, exactly as `IdentityCluster` renders it. Not dropped, and not a new `FIG`.**

```tsx
<Avatar>                                   // at .idhero scale: 84×84, rounded to --imgr
  <AvatarImage src="/pfp-placeholder.svg" alt="" />
  <AvatarFallback>{viewer.pseudonym.charAt(0)}</AvatarFallback>
</Avatar>
```

`pseudonym` is the one field `HeaderViewer` carries, and it is the only field Card 2 needs — it is also the card's *title* (`You're {pseudonym}`). **Zero DTO change, zero new read, zero new query on a first-login render.**

Three things the ruling forecloses, each of which was reachable from F-1:
- ⛔ **Not dropped.** The card keeps a figure; the register's `.idhero` slot is filled, so the card's anatomy still matches every other card's.
- ⛔ **Not a new `FIG` illustration.** Inventing artwork for the identity card would put a second visual language beside the six ported SVGs and would need a design pass this plan has no ruling for.
- ⛔ **Not a bespoke avatar fetch.** When the real PFP lands (SCAFFOLD.15 / the R2 `pfp` bucket) it lands in the `resolve*.ts` resolvers that already own the placeholder constant, and the deck inherits it the same way every other surface will. A deck-local fetch would create a second PFP path for that migration to unpick.

### What is safe to add to `(public)/layout.tsx`, and what is not

**Four tests read that file as their SOURCE** and assert on it:

```
tests/unit/design/bookmarks-height-chain.test.ts:227   toContain("min-h-[calc(100vh-60px-2px)]")
tests/unit/design/debate-height-chain.test.ts:122      toContain("min-h-[calc(100vh-60px-2px)]")
tests/unit/design/profile-height-chain.test.ts:354     toContain("min-h-[calc(100vh-60px-2px)]")
tests/unit/design/discovery-height-chain.test.ts       (same chain, same source)
```

They assert with **`toContain`**, not class-set equality — so *additive* statements elsewhere in the file do not break them. What breaks them is touching the `<main>` element or its class string.

| Change | Verdict |
|---|---|
| Add a `cookies()` read + a `const` in the function body | ✅ **SAFE** — no element touched |
| Render `<OnboardingDeck …/>` as a sibling of `<main>`, inside the outer `<div>` | ✅ **SAFE** — and structurally *inert*, because Radix `DialogPortal` renders to `document.body`, entirely outside the flex column. It cannot participate in the height chain at all. |
| Edit `<main className="flex min-h-[calc(100vh-60px-2px)] flex-1 flex-col">` | ⛔ **FORBIDDEN** — untouchable, four tests, two live rulings (RULED A1 + the `/m/[slug]` founder reversal of 2026-08-17) |
| Wrap `{children}` in anything | ⛔ **FORBIDDEN** — same reason |

**The deck is a portalled overlay. It is added to the layout's *render output*, never to its *layout chain*.** That is what makes Q1's warning discharge cleanly rather than being negotiated.

## Q2 · Is shadcn/Radix `Dialog` usable for a non-dismissible modal?

### ✅ Yes, without fighting the primitive. Every lever is a declared prop.

Read from `src/components/ui/dialog.tsx` and the installed types (`@radix-ui/react-dialog@1.1.15`, `@radix-ui/react-dismissable-layer@1.1.11`).

**1 · The close button is already a first-class opt-out.** `dialog.tsx:47-54`:

```tsx
function DialogContent({ className, children, showCloseButton = true, ...props }:
  React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean })
```

`showCloseButton={false}` removes the `<DialogPrimitive.Close>` from the DOM entirely (`:67-75`) — not hidden, **absent**. That satisfies `onboarding-deck::first-login-has-no-dismissal`'s "no close control in the DOM" literally.

**2 · Escape and outside-interaction are declared props that `{...props}` forwards.** The wrapper types `props` as `React.ComponentProps<typeof DialogPrimitive.Content>` and spreads it onto `DialogPrimitive.Content` (`:64`). Radix's `DialogContentImplProps extends Omit<DismissableLayerProps, 'onDismiss'>` (`react-dialog/dist/index.d.mts:58`), and `DismissableLayerProps` declares (`react-dismissable-layer/dist/index.d.mts:16,21,32`):

```ts
onEscapeKeyDown?: (event: KeyboardEvent) => void;
onPointerDownOutside?: (event: PointerDownOutsideEvent) => void;
onInteractOutside?: (event: PointerDownOutsideEvent | FocusOutsideEvent) => void;
```

`preventDefault()` on any of these cancels the dismissal. So:

```tsx
<DialogContent
  showCloseButton={false}
  onEscapeKeyDown={(e) => e.preventDefault()}
  onInteractOutside={(e) => e.preventDefault()}
>
```

**3 · This is exactly the shape the locked W2.1 shell already uses.** `DESIGN_W2_1_first-login-journey_mockup-v0_1.html:396-404` keeps the handlers bound and refuses to act:

```js
function backdropClose(e){
  if(e.target!==overlay) return;
  if(mclose.classList.contains('show')) closeAll();   // first-login deck: no-op
}
document.addEventListener('keydown',function(e){
  if(e.key==='Escape' && !overlay.hidden && mclose.classList.contains('show')) closeAll();
});
```

Guard, not removal. Radix's props are the typed version of the same idea.

**4 · The in-repo precedent forbids editing the primitive, and we do not.** `src/components/debate/dialogs.tsx:70-71` records the rule:

> *"⛔ `ui/dialog.tsx` is NOT on §8's allow-list and is NOT edited — the primitive keeps its default for every other dialog in the app."*

Instance-level `className` overrides win by tailwind-merge (`:69`), which is how the 432px modal width lands without touching the primitive. **`src/components/ui/dialog.tsx` is NOT on this plan's allow-list either.**

**5 · One obligation, not a blocker: Radix requires an accessible name.** `DialogTitle` must be present or Radix warns. The repo's established answer is `dialogs.tsx:201` and `:260`: `<DialogTitle className="sr-only">`. The deck's visible card title is presentational and changes per card; the dialog's *accessible name* is stable. Use `sr-only`.

**Verdict: use the shadcn `Dialog`. A bespoke overlay would duplicate focus-trap, scroll-lock, portal and `aria-modal` — all of which Radix already ships and all of which the deck needs.**

## Q3 · Card 1's three blocks vs everyone else's one paragraph

### Recommendation: one `string` field, one text node, `whitespace-pre-line`.

The register's Card 1 subtext contains real newlines and one blank line between blocks. The mockup renders `.csub` as a single text node, and §21.9 pins the anatomy as "figure band, eyebrow, bold title, subtext" — four slots, not five.

**`whitespace-pre-line` preserves `\n` and collapses runs of spaces**, so a blank line renders as a blank line, and the other six cards — which contain no `\n` — render identically to today. One code path, one shape, no union.

**The repo already does this, twice, for exactly this problem** (user-authored body text with meaningful line breaks):

```tsx
src/components/debate/dialogs.tsx:139   <p className="text-sm whitespace-pre-line">{post.body}</p>
src/components/debate/dialogs.tsx:230   <p className="text-sm whitespace-pre-line">{reply.body}</p>
```

**Rejected: `sub: string | string[]`.** It makes six cards carry a one-element array or a discriminant for one card's benefit, and it invites a `<p>`-per-block render that the mockup's `.csub` shape does not have. The measurement in Q4 was taken with `white-space:pre-line` and produced a correct 287.5px block, so the shape is proven, not assumed.

⚠ **Bytes, not retyping.** The register's §1 is explicit: the strings carry U+2019 (`’`), U+2014 (`—`), U+00B7 (`·`). **The execute copies the bytes out of `docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md`; it never retypes them.** An ASCII apostrophe is a defect that is invisible in review.

## Q4 · Where height is decided, and what the tallest card measures

### MEASURED, at the ratified type ramp, in Geist, at 372px content width.

Method: production build served locally, probe injected into a real page so the font and metrics are the app's own. Card composition per the W2.2 mockup: `.cfig` 140px + 18px, `.idhero` 84px + 18px, eyebrow 9px/800/.14em + 10px, title 21px/800/**1.18** + 12px, subtext 13px/**1.58** capped at 332px.

| Card | Eyebrow | Words | Figure block | Subtext | **Content height** |
|---|---|---|---|---|---|
| **1** | ZUGZWANG | 65 | 158 (`.cfig`) | 287.5 | **503.1px** |
| 2 | WELCOME | 47 | 102 (`.idhero`) | 123.2 | 282.8px |
| 3 | THE GOAL | 34 | 158 | 82.2 | 297.7px |
| 4 | THE RULES | 32 | 158 | 61.6 | **277.2px** (shortest) |
| 5 | THE RULES | 38 | 158 | 82.2 | 297.7px |
| 6 | THE RULES | 43 | 158 | 82.2 | 297.7px |
| 7 | THE RULES | 32 | 158 | 82.2 | 297.7px |

**Card 1 is 503.1px. The second-tallest is 297.7px. The gap is 205.4px.**

Modal chrome, measured the same way: padding 60 (30 top + 30 bottom) · progress block 32 (12px step label + 20 margin) · nav block 70 (24 margin + 46px button).

- **Modal height sized to the tallest card: 665.1px.** In a 777px viewport that fits with **111.9px** to spare.
- Sized to the shortest card it would be 439.2px.
- **Dead space on the shortest card, if the modal is sized to the tallest: 225.9px.**

### Where height is decided

**In the card region, as a `min-height` on the card wrapper — not on the modal, and not per-card.** §21.9 requires no jump between cards; the register (§Card 1 note) already rules the trade:

> *"~72 words against the other cards' 39–44. This is a layout consequence, not a copy defect. The modal is sized to the tallest card so that advancing 1 → 2 does not jump. Do not cut copy to fit a box."*

So the ruling is settled and this plan does not reopen it. What the plan **must not** do is hard-code `503px`: that number is a *measurement of today's strings in today's font*, and it drifts the moment a word changes. The mockup's `.card{min-height:218px}` is a **floor that all seven cards already clear** — it constrains nothing.

### ✅ D-1 — RULED (a) + vertical centring. Founder, 2026-08-18.

**The card region is a CSS grid stack sized to the natural tallest card, and its content is CENTRED VERTICALLY within the region.**

> *"226px pooled at the bottom is a hole; split above and below it is breathing room."*

**Mechanism.** All seven cards render into one grid cell (`grid-area: 1/1`); the non-active ones are `invisible` + `aria-hidden` + `pointer-events-none`. The region's height is then the natural maximum of its children — **no literal anywhere**, and it self-corrects the moment a card's copy changes. The active card is centred on the block axis inside that region.

⛔ **`min-h-[503px]` — or any other measured literal — is forbidden.** 503.1px is a measurement of today's strings in today's font; the copy register is the source of record and its §1 says the strings are what the build copies. A pinned height goes stale on the first word that changes, silently, and the register would still be correct.

⚠ **Vertical centring is a deliberate departure from the mockup's top-aligned `.card` anatomy** (`.card{min-height:218px;display:flex;flex-direction:column;align-items:center}` — `align-items` is the *cross* axis there, so the mockup stacks from the top). Founder-ruled, recorded as a **named deviation** rather than absorbed: the whitespace is split ~113px above and ~113px below on the shortest card instead of pooling 225.9px underneath it.

⚠ **All seven mount at once.** They are static strings with no data dependency, so the cost is DOM nodes and nothing else — no query, no fetch, no per-card state. That is what makes "size to the natural tallest" achievable without measuring anything at runtime.

## Q5 · O-a — RULES on `/sign-in`

`src/app/(auth)/layout.tsx` mounts `<GlobalHeader viewer={viewer} />` (no `portfolio`, no `spendable`). So a RULES control added to `GlobalHeader` appears on **`/sign-in`, `/sign-in/otp`, and `/onboarding`** as well as every `(public)` surface.

### Recommendation: **mount the re-show in `(auth)` too. Do not hide the control, and do not navigate.**

**Why not hide it.** §21.9 is explicit and unconditional: *"It is present for every viewer, authenticated or not."* A control that vanishes on three routes contradicts the sentence, and the signed-out visitor on `/sign-in` is precisely the person with the most reason to ask what the rules are before creating an account.

**Why not navigate.** There is no route to navigate to — `git ls-files | grep -iE 'rules|about'` returns nothing, and §21.6 keeps the feature-guide page *deferred*. §21.9 calls the deck "a modal card sequence… **not a route and not a page**". Minting a route would contradict both sections.

**Why mounting in `(auth)` is cheap and safe.** The re-show is client-only: a static card array, no session read, no cookie read, no query. Mounting it costs one client component on three auth routes and nothing on the server.

⚠ **One hard constraint the execute must honour: on `(auth)` routes the deck is ALWAYS the re-show, never the first-login gate.** `(auth)` must not read the marker cookie and must never render the non-dismissible variant — a non-dismissible modal over `/sign-in` would trap a user inside the sign-in page. The gate lives in `(public)/layout.tsx` **only**.

⚠ **Card 2 is absent from the re-show anyway** (§21.9, register §3), which removes the one card that would need a pseudonym — so the re-show has no viewer dependency at all. That is what makes this safe rather than merely acceptable.

## Q6 · O-c — the measured cost of RULES in the centre zone ⇒ **ruling REVERSED, left zone**

### MEASURED at 1440. The ruling costs **41.57px**.

Baseline, signed-out, real compiled CSS:

```
grid-template-columns: 568px 220px 568px    gap 18px    px-6 (24px)
BrandCluster rect: x=610, width=220  →  centre = 720.00 = viewport centre exactly
24 + 568 + 18 + 220 + 18 + 568 + 24 = 1440 ✓
```

A `RULES` control at the ratified register — mockup `.tab` composition (bordered pill, 13px x-padding, 12px/700/.1em uppercase) at the repo's 34px control height — measures **73.13px wide**.

| Case | Placement | Grid columns after | Brand centre | **Shift** |
|---|---|---|---|---|
| **A** | Centre zone, sibling of BrandCluster, gap **10px** | `526.43 / 303.13 / 526.44` | 678.43 | **41.57px left** |
| A′ | same, gap 12px | `525.43 / 305.13 / 525.44` | 677.43 | 42.57px left |
| A″ | same, gap 18px (grid gap) | `522.43 / 311.13 / 522.44` | 674.43 | 45.57px left |
| **B** | **Left zone**, after Radio | `568 / 220 / 568` | **720.00** | **0.00px** |
| **C** | **Right zone**, before the Đ cluster | `568 / 220 / 568` | **720.00** | **0.00px** |
| **D** | Centre zone + an equal-width `visibility:hidden` counterweight | `484.87 / 386.26 / 484.88` | 719.99 | 0.01px |

The shift is exactly `(73.13 + gap) / 2` — the centre *track* stays centred; the brand inside it does not.

**Headroom:** the side zones measure 180.23 (left) and 173.27 (right) against a 568px track, so **387.77px of slack per side**. B and C are safe by a very wide margin, and remain safe signed-in when the Đ cluster joins the right zone.

### ⚠ D-2 — REVERSED. RULES ships in the LEFT ZONE, beside Radio. Founder, 2026-08-18.

**The measurement reopened the ruling and the founder overturned it.** RULES mounts in the left zone after `RadioSlot` — case **B**, measured shift **0.00px**. The brand mark stays at 720.00, exactly centred.

**Grounds, as recorded by the founder:**

1. **41.57px is 19% of the brand cluster's own 220px width** — not a rounding error, a visible displacement of the product's primary mark.
2. The locked mockup's centre placement predates the repo's measured centring behaviour. *(⚠ See the correction below — this ground is not accurate as stated, and it does not carry the ruling.)*
3. **The left zone is the utility-control family, and the design's own carry-forward budgeted five controls there, of which three shipped.** Confirmed on disk: the mockup's `.zone.left` carries Back · Home · Radio · Social · Research — five — and `GlobalHeader.tsx:92-95` ships three (`HeaderNav` = Back + Home, then `RadioSlot`). RULES joins a family that already exists and has budgeted room.
4. **The hidden counterweight (case D) was rejected** — an invisible node whose purpose is also invisible. It would sit in the tree with nothing to explain it but a comment.

### ⛔ Correction to ground 2, recorded because the plan must not carry a false premise

**The mockup does NOT predate the `1fr auto 1fr` grid — it uses exactly that grid.** `DESIGN_W2_4-5-14_global-header_mockup-v0_2.html:37`:

```css
display:grid;grid-template-columns:1fr auto 1fr;align-items:center;
.zone.center{justify-self:center;}
```

The real mechanism is one level down: in the mockup, `RULES` is a child of `.brand`, *inside* `.zone center` (`:208`). So the mockup has **the identical 41.57px-class displacement** — `justify-self:center` centres the *zone*, never the brand within it. The mockup did not solve this differently; **it never measured it.**

**This strengthens the ruling rather than weakening it**, and it is why the correction is recorded rather than quietly dropped: the mockup's placement was not a considered trade against a measured cost, so overturning it discards no analysis. Grounds 1, 3 and 4 carry the decision on their own.

### ⇒ TIER-4 DEVIATION — recorded per the header's own convention

`GlobalHeader.tsx:26-28` already keeps a named-deviation register for exactly this:

> *"Left zone order Back · Home · Radio (mockup v0_2); Social/Research/RULES/Đ-info are ratified omissions (OQ-3/OQ-4 zero-supplied), each a named deviation in the plan."*

**The deviation, stated for that register:**

> **RULES — placement deviates from the locked W2.4/.5/.14 mockup.** The mockup places the tab in the centre zone as a sibling of the wordmark (`mockup-v0_2:208`, close-out `:31`). It ships in the **left zone, after Radio**. Measured at 1440 against the real compiled CSS: the mockup's placement moves the brand cluster **41.57px** left of true centre (73.13px control + 10px gap, halved); the left zone measures **0.00px** shift with 387.77px of headroom. Founder-ruled 2026-08-18 (D-2).

### ⇒ The docblock's absolute-centring sentence STAYS TRUE — and is NOT amended

`GlobalHeader.tsx:22-23` reads *"3-zone `1fr auto 1fr` grid — equal side tracks keep the brand cluster absolutely centred"*. Under D-2 the brand stays at 720.00 and **that sentence remains true**. ⛔ **Any edit to it is struck from this plan.** An earlier draft carried one under option (a); it is gone.

⚠ **But two OTHER sentences in the same docblock go false and must be corrected in the same commit.** `:26-28` lists **RULES among the ratified omissions** and states the left-zone order as *"Back · Home · Radio"*. The moment RULES ships in the left zone, both are wrong. The build commit therefore edits `GlobalHeader.tsx`'s docblock to (a) state the order as **Back · Home · Radio · RULES**, (b) remove RULES from the omissions list — Social/Research/Đ-info remain — and (c) add the deviation paragraph above. **This is truth-maintenance on prose that describes this exact mechanism (O-9), not the centring edit D-2 struck.**

## Q7 · O-b — the re-show's final-card label

### It is already decided, by the locked shell. **`Done`.**

W2.2's own header states its shell is *"reused verbatim from `DESIGN_W2_1_first-login-journey_mockup-v0_1.html`. NOT redrawn."* That shell's stepper (`:384`) reads:

```js
next.textContent = (idx===n-1) ? (firstLogin ? 'Enter Zugzwang' : 'Done') : 'Next';
```

First login → `Enter Zugzwang`. Re-show → **`Done`**. The copy register's §6 lists this as open and names `Done` as a candidate "already carried" by that mockup — it is carried as the *implementation*, not as a suggestion. **No new copy is authored.**

## Q8 · O-d — Card 2's `8` and its two dates

Card 2's subtext asserts: `8 markets` (twice) and `15th September 2026` → `5th November 2026`.

### What exists in the codebase

| Fact | Constant | Exported? |
|---|---|---|
| Freeze / window end | `FREEZE_INSTANT_UTC = new Date("2026-11-05T23:59:00.000Z")` — `src/server/markets/create.ts:34` | ✅ **exported**, and already imported by `GlobalHeader.tsx` for the countdown |
| Window start | `WINDOW_START = "2026-09-15T00:00:00.000Z"` — `src/server/profile/graph-series.ts:31` | ❌ module-private |
| Window end (a second copy) | `WINDOW_END = "2026-11-05T23:59:00.000Z"` — `graph-series.ts:32` | ❌ module-private, and **duplicates the freeze pin** |
| Market count | **none** | — `grep -rn "MARKET_COUNT\|TOTAL_MARKETS"` → no match. `≤ 8 markets` appears only as a *bound* in two doc comments (`discovery/list.ts:58`, `DiscoveryCarousel.tsx:17`) |

### ✅ D-3 — RULED (b): ALL THREE ship as LITERALS, each drift-tested. Founder, 2026-08-18.

**This differs from my recommendation, which was to bind the dates. The founder's grounds are better than mine, and they are two:**

1. ⛔ **Formatting `FREEZE_INSTANT_UTC` in local time renders "6th November 2026" in IST.** The freeze is `2026-11-05T23:59:00.000Z`; IST is UTC+5:30, so `toLocaleDateString()` on an Indian device — the founder's, and a large share of the audience's — yields **the 6th**. A bound date would have shipped a card that contradicts the freeze it was bound to, on the machines most likely to see it. **Binding would have introduced the bug it was meant to prevent.**
2. **A bound card no longer matches the copy register byte-for-byte, which is the register's entire purpose.** The register is the *string source of record* and says the build copies its bytes. A card assembled from `${format(FREEZE_INSTANT_UTC)}` is no longer comparable to it, and the byte-equality guard — the thing that catches ASCII-apostrophe corruption — stops being possible.

**⇒ `WINDOW_START` needs no export. That refactor is STRUCK from the allow-list**; `src/server/profile/graph-series.ts` is not touched by this plan at all.

### The drift test — `tests/unit/onboarding/copy-drift.test.ts`

A fourth test file, carrying **no §17 row** (it is a regression guard in the `_probe-*` class, not an acceptance case). Three assertions:

| # | Assertion | Strength |
|---|---|---|
| 1 | Every card string in `src/components/onboarding/cards.ts` matches `docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md` **byte-for-byte** — read the register off disk, extract the fenced blocks, compare | **Real verification.** Catches retyping, ASCII `'` for U+2019, a dropped em dash, and any silent edit to either side. This is the assertion the register exists to make possible. |
| 2 | Card 2's end date equals `FREEZE_INSTANT_UTC` **formatted in UTC** — assert the formatted value is `5th November 2026` and that the card contains it | **Real verification**, and it is precisely the guard that catches the IST bug: any future move to local-time formatting fails here. |
| 3 | Card 2 contains `8 markets` exactly twice, and `15th September 2026` | ⚠ **A tripwire, not a verification** — see below. |

⚠ **Assertion 3 cannot verify anything, and the plan says so rather than implying otherwise.** There is no machine-readable slate: `grep -rn "MARKET_COUNT\|TOTAL_MARKETS"` returns nothing, `≤ 8 markets` appears only as a *bound* in two doc comments, and the test database holds fixtures rather than the real slate — so asserting the card's `8` against a test-DB `COUNT(*)` would compare copy to fixtures and mean nothing. The start date has no constant either, and D-3 forbids minting one. **What assertion 3 buys is that the literals are pinned in a named place**, so changing the slate or the window forces a deliberate edit to a test that says why, instead of leaving the card to drift silently. That is the honest ceiling here, and it is worth having.

⚠ **The byte-equality assertion (1) subsumes the byte check earlier assigned to `cards.test.ts`.** It lives here, once, not in two files.

## Q9 · The completion flow, and not flickering on a poll tick

### Recommendation: **optimistic client close. No `router.refresh()` anywhere in this feature.**

**The flow.**

1. Server: `(public)/layout.tsx` reads the cookie and the session, computes `shouldShow`, and passes it as a **prop**.
2. Client: `<OnboardingDeck initialOpen={shouldShow} />` seeds `useState` from that prop **once**.
3. The participant reaches the final card and presses `Enter Zugzwang`.
4. The client sets `open = false` **immediately**, and calls the Server Action.
5. The Server Action writes `zugzwang_intro_seen=v1` via `cookies().set(...)` and returns. **Nothing awaits a refresh.**

**Why this cannot flicker on a `DebatePoll` tick.** The hazard is real and specific: `(public)/layout.tsx:53` records that `DebatePoll` calls `router.refresh()` every 15 s on `/m/[slug]`, and *"a refresh re-executes the LAYOUT as well as the page"*. So the layout — and therefore the gate — is re-evaluated every 15 seconds on that route.

The protection is that **`router.refresh()` re-renders server components without discarding client state.** Because `open` lives in the deck's own `useState` and is seeded only on mount, a locally-closed deck **stays closed** even if the server prop is still `true` on the next tick — which is exactly the window between the optimistic close and the cookie landing.

⛔ **The failure this design avoids, stated so it is not reintroduced:** if `open` were derived from the server prop on every render — `{shouldShow && <Deck/>}` with no client state — then a poll tick arriving before the cookie was set would **re-open a deck the participant had just dismissed**, and a tick arriving after would close it mid-animation. Both are 15-second-periodic, both look like haunting, and neither reproduces on a route without the poll. **The client owns `open`. The server prop is an initial value, never a live binding.**

**Where the gate is evaluated is also load-bearing.** It must stay in the layout, beside the `getSession` read that is already there, so the decision is made once per render on the server. Moving it into the client would mean reading the marker after hydration — and the marker is `HttpOnly` (ADR-0037), so the client *cannot* read it. That is not an accident of this plan; it is why ADR-0037 chose a cookie over `localStorage`.

**Failure posture.** If the Server Action throws, the deck is already closed for this session and the cookie is absent, so it returns on the next full navigation. That is precisely ADR-0037's stated property — *"marker-at-completion makes abandonment safe by construction"* — and it fails toward showing the rules again, never toward hiding them.

## Q10 · The nine §17 case ids

### ⚠ First, a correction to the premise — and it matters, because acting on it literally would corrupt §17.

The task states: *"A §17 row naming a file that does not exist is a build error (§13.5)."*

**SPEC.2 §13.5 does not say that**, and §17 rows do not name files. §13.5 reads:

> *"**§17 alignment.** Every name in any Acceptance block MUST appear verbatim in SPEC.1 §17's acceptance-test catalogue. The CI lint at HARDEN-phase walks every F-*.md file's Acceptance block and asserts the names exist in §17's catalogue; **a name in a flow file that's not in §17 is a build error.**"*

The error direction is **flow-file name → §17 catalogue**. And §17's table has three columns — `| Test | Section | Invariants |` — with **no file-path column**; the nine rows landed at `c4526e2` as `| onboarding-deck::… | §21.9 | — |`. Adding paths to those rows would introduce a fourth column the table does not have.

**The §13.5 obligation is already satisfied:** §21.9's Acceptance line reads *"§17 rows `onboarding-deck::*`"*, and all nine of those rows exist in §17. Nothing in §17 needs to change at build.

**What the repo actually does with test paths** is carry them in the *Acceptance prose* of the flow/section — visible in SPEC.1's own change log, where stale cites were corrected at 1.0.25, 1.0.31 and 1.0.32 (e.g. *"F-DEBATE-1's Acceptance cite named `tests/server/debate-view/replies.test.ts`, which does not exist on disk"*). **So the build commit records the paths by amending §21.9's Acceptance sentence — a same-commit rider, per §5.12 — and the execute must create every file it names there.**

### The assignment — three files, per SPEC.2 §13.4 (placement follows the behaviour under test)

| # | Case id | File | Layer |
|---|---|---|---|
| 1 | `onboarding-deck::renders-for-authenticated-viewer-without-marker` | `tests/unit/onboarding/gate.test.ts` | pure |
| 2 | `onboarding-deck::absent-for-signed-out-visitor` | `tests/unit/onboarding/gate.test.ts` | pure |
| 3 | `onboarding-deck::absent-when-marker-present` | `tests/unit/onboarding/gate.test.ts` | pure |
| 4 | `onboarding-deck::first-login-has-no-dismissal` | `tests/unit/onboarding/render/deck.test.tsx` | jsdom |
| 5 | `onboarding-deck::first-login-final-card-closes` | `tests/unit/onboarding/render/deck.test.tsx` | jsdom |
| 6 | `onboarding-deck::marker-not-written-on-open` | `tests/unit/onboarding/render/deck.test.tsx` | jsdom |
| 7 | `onboarding-deck::reshow-omits-welcome-card` | `tests/unit/onboarding/cards.test.ts` | pure |
| 8 | `onboarding-deck::reshow-is-dismissible` | `tests/unit/onboarding/render/deck.test.tsx` | jsdom |
| 9 | `onboarding-deck::step-count-derives-from-array` | `tests/unit/onboarding/cards.test.ts` | pure |

**Why the gate rows are pure and not a layout render test.** `(public)/layout.tsx` is an `async` server component; the repo has no harness that renders one (only `tests/unit/shell/not-found.test.tsx` renders a page component, and it is synchronous). **The gate is therefore extracted as a pure predicate** — `shouldShowOnboardingDeck({ viewer, marker })` in `src/server/onboarding/gate.ts` — which the layout calls. Rows 1–3 then test the *decision* directly and the layout keeps one readable call. This is the repo's own habit for gates (`src/server/system/is-frozen.ts`, `src/server/auth/session-gate.ts`).

**Why row 9 is pure and not a render assertion.** *"The indicator and dot rail derive from array length — no literal count"* is a property of the card module, and the strongest form is a source scan plus an arity assertion: change the array, the step count follows. A render assertion would pass against a hard-coded `7` on a 7-card array.

**Harness confirmed on disk** (`tests/unit/shell/header-nav-back.test.tsx`): `// SPDX-License-Identifier: AGPL-3.0-or-later` on line 1, `// @vitest-environment jsdom` on line 2, `@testing-library/react`, `vi.mock("next/navigation", …)`. ⛔ **There is no `jest-dom`** — assert with `getAttribute` / `textContent` / `querySelector`, never `toBeInTheDocument()`.

### ⇒ THE THREE FINAL PATHS — for the web-authored §21.9 Acceptance line

```
tests/unit/onboarding/gate.test.ts
tests/unit/onboarding/cards.test.ts
tests/unit/onboarding/render/deck.test.tsx
```

⚠ **`tests/unit/onboarding/copy-drift.test.ts` is a FOURTH file and is deliberately NOT in that list.** It carries no §17 row — it is a regression guard in the `_probe-*` class (D-3). §13.5's MUST binds Acceptance-block names to the §17 catalogue; naming a file that asserts no §17 row would put a name in the Acceptance block with nothing in §17 to match it, which is the exact build error §13.5 defines. **The execute creates all four files; the Acceptance line names three.**

## Q11 · One PR or two?

### **One PR. I agree with the lean, and the strongest argument is not the one in the question.**

The stated argument — a dismissible-capable component with no way to reach the dismissible path is dead code through a Gate C read — is correct. But there is a sharper one:

⛔ **Split, PR 1 ships a non-dismissible modal that every authenticated participant sees on their next visit, and nothing can close it except completing it.** If a defect in the stepper or the final-card handler blocks completion, the product is *bricked for logged-in users* until PR 2 or a revert — and because the marker is written only at completion, the deck returns on every navigation. **A first-login gate is the one feature whose failure mode is "the app is unusable", so its escape hatch must ship in the same commit as its trap.**

Three supporting reasons:

1. **§21.9 specifies the two contexts as one component with one array.** *"Two contexts, one component, one card array."* Splitting builds half a specified object and leaves the spec unsatisfied on `main` between merges.
2. **The nine §17 rows are one set.** Six of the nine describe behaviour that only exists once both contexts do (rows 4–9). A PR 1 that lands rows 1–3 and stubs the rest leaves §17 citing assertions no file makes — the exact drift §13.5 exists to prevent.
3. **ADR-0037 must be same-commit with the code it governs** (§5.12, and the package's own §0). The cookie is written by the completion flow, which is PR 1 — so the ADR would land in PR 1 and immediately be describing a half-built mechanism.

**The honest case for two PRs**, so it is on the record: the diff is large for one review (two shell files, an ADR, a new component tree, three test files, a Server Action), and the RULES header control is the only piece touching a file with a live centring ruling and an enforcing test — isolating it would make that one review cheap. **If the founder wants a split, the correct seam is the RULES control, not the dismissibility** — deck + gate + completion + ADR in PR 1 (with the re-show reachable in tests but not yet in the header), and the header control in PR 2. That ordering never leaves a trap without an exit.

---

# PART B — THE PLAN

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| INV-1 Bet ↔ comment atomicity | **no** | The deck writes no bet, no comment, no row. It is a render surface plus one cookie. | n/a |
| INV-2 Dharma non-transferable | **no** | No ledger read, no ledger write, no Đ figure rendered (the register removed both Đ figures from the deck — §5 item 3). | n/a |
| INV-3 Side frozen at post time | **no** | No comment, no side. | n/a |
| INV-4 Resolutions append-only | **no** | No resolution surface. | n/a |

**The deck TEACHES INV-1, INV-2 and INV-3 and ENFORCES none.** ADR-0037 states this directly (*"None render here. The deck teaches invariants; it enforces none"*), which is why all nine §17 rows carry `—` in the Invariants column.

⚠ **Two tripwires the register records, restated so they are not lost.** Card 5's *"It can't be bought, sold, gifted, or moved to another account"* is INV-2 in plain language: **if INV-2 is ever weakened, that card becomes a lie**, and any such proposal is a change to this card. Card 6 is INV-3 the same way.

## 2. Data model changes

**None.** No table, no column, no index, no constraint, no migration. Migration head stays `0024_bookmarks`.

The seen-marker is a browser cookie, not a `users` column — that is the whole subject of ADR-0037, and its Driver 3 records that the DDL alternative was rejected on cost with the better option visible.

## 3. API surface

**One Server Action. No route handler, no endpoint.**

| | |
|---|---|
| Name | `completeOnboardingDeckAction` |
| Home | `src/server/onboarding/complete.ts` |
| Input | **none** — no arguments, no form data, therefore no zod schema (nothing to validate) |
| Output | `Promise<void>` |
| Auth | Authenticated. Re-checks the session server-side; a signed-out caller is a no-op. |
| Effect | `cookies().set("zugzwang_intro_seen", "v1", { httpOnly, secure, sameSite: "lax", path: "/", maxAge: INTRO_SEEN_MAX_AGE_SEC })` |
| Rate-limit class | **none.** It is idempotent, unauthenticated-safe, writes no row, and costs one `Set-Cookie`. Adding a limiter would put an Upstash round-trip on the completion of a first-login modal. |

⚠ **The action does not take the value as an argument.** The version token `v1` is a module constant. A client-supplied value would let a caller write an arbitrary cookie value — no harm today, but it is a needless input on a write path.

⚠ **`Path=/` is deliberate and is the one thing to read carefully.** ADR-0037's Consequences name the near-miss on record at `src/app/(admin)/admin/markets/media/sign/route.ts:31-36`, where broadening the **admin** cookie to `/` would have leaked it to every participant route. This cookie carries no identity, no session material and no secret — its value is the literal string `v1` — and **the admin cookie's `Path=/admin` isolation is untouched by this plan.**

## 4. UI / user flow

**New component tree** — `src/components/onboarding/`:

| File | Kind | Role |
|---|---|---|
| `OnboardingDeck.tsx` | client | The modal: Radix `Dialog`, stepper, Back/Next, dot rail, dismissal policy by context |
| `cards.ts` | pure | The ratified card array (bytes from the register) + `reshowCards()` |
| `figures.tsx` | server-safe | The `FIG` illustrations, ported from the mockup's inline SVG |

**New shell control** — `src/components/shell/RulesControl.tsx` (client): the header `RULES` button; opens the re-show.

**Flow — first login.** Sign-in completes → `(public)` layout computes `authenticated && !marker` → deck renders non-dismissible at card 1 of 7 → Back disabled at 1, Next advances → final card reads `Enter Zugzwang` → click closes optimistically **and** fires the action → cookie written → never shown again on this browser.

**Flow — re-show.** Any viewer clicks `RULES` → deck opens dismissible at card 1 of 6 (WELCOME omitted) → Escape, the close control, and backdrop all close it → final card reads `Done` → **no cookie is written**.

### ✅ D-4 — RULED (b). The re-show NEVER writes the marker. Founder, 2026-08-18.

**One writer, one path: first-login completion only.** `completeOnboardingDeckAction` is called from the first-login context and from nowhere else — it is not wired to the re-show's `Done` at all, so there is no runtime branch to get wrong.

⚠ **Why this is a ruling and not an obvious default.** The re-show is reachable **signed-out** (Q5 — the RULES control is present for every viewer). If completing it wrote the marker, a visitor could read the deck on `/sign-in`, sign up, and never see the first-login gate — the marker would suppress the very showing §21.9 makes non-dismissible. **The gate's whole guarantee is that every authenticated participant sees the rules once, undismissably**; a second writer on a signed-out path is the one thing that can silently void it.

⚠ Structural, not conditional: the action is imported by the first-login mount only. A `context === "reshow"` guard *inside* the action would be a branch a future edit can flip; not importing it is a compile-time fact.

**States:** card index 1..N · Back disabled at index 0 · final-card label switches on `index === N-1` · dot rail fills to the current index.

## 5. Failure modes

| Failure | Detection | Recovery |
|---|---|---|
| Server Action throws (cookie not written) | Sentry; the deck reappears on next navigation | **By design.** ADR-0037: abandonment is safe by construction. Fails toward showing the rules. |
| Cookie blocked by the browser | Deck shows every visit | Accepted, no victim (ADR-0037 Negative: "Incognito shows it every time"). |
| `router.refresh()` tick lands mid-deck | — | **Prevented by construction** — the client owns `open`; see Q9. |
| Deck renders to a signed-out visitor | `onboarding-deck::absent-for-signed-out-visitor` | The gate's `viewer !== null` term. §21.9 calls this load-bearing precisely because `(public)` is not middleware-gated. |
| Participant cannot complete (stepper defect) | — | ⚠ **The severe one.** A non-dismissible modal that cannot be completed makes the app unusable for authenticated users. This is why Q11 lands on one PR, and why rows 4/5 are RED-first. |
| Copy bytes corrupted by retyping (ASCII `'` for U+2019) | `cards.test.ts` byte assertion | Copy from the register, never retype. Register §1 warns it is invisible in review. |

## 6. Edge cases

- **Viewer authenticated, `pseudonym` null** (mid-signup edge `IdentityCluster` already handles): Card 2's title interpolates a pseudonym. Render the card with the avatar and no name rather than the literal `You're null`. ⚠ In practice unreachable — the marker gate runs on `(public)`, and the ADR-0004 session hook refuses a session until `pseudonym` is non-NULL — but the type is `string | null` and the component must not assume.
- **Re-show opened while the first-login deck is already open**: impossible by construction — the RULES control is not reachable behind a non-dismissible modal (focus trap). No guard needed; noted so it is not "fixed".
- **Reduced motion**: the mockup carries `@media (prefers-reduced-motion:reduce){*{transition:none!important;}}`. shadcn `DialogContent` ships `data-[state=open]:animate-in`. Honour the media query.
- **Very short viewport** (< ~665px): the modal at its tallest is 665.1px. It must scroll internally rather than clip — `max-h-[90vh] overflow-y-auto`, the shape `dialogs.tsx:74` already uses.
- **Keyboard-only**: Back/Next reachable, focus trapped, Escape inert on first login and active on re-show — rows 4 and 8.

## 7. Test plan

**Test-first order is not optional here** — §5.6 covers "new business-logic behavior", and the gate is a decision function.

| Layer | Scenarios | Rows |
|---|---|---|
| Unit pure (`tests/unit/onboarding/gate.test.ts`) | both conditions → show; no session → hide (marker irrelevant, both values); marker present → hide | 1, 2, 3 |
| Unit pure (`tests/unit/onboarding/cards.test.ts`) | re-show list = full minus WELCOME; step count derives from array length (source scan for a literal + arity) | 7, 9 |
| Component jsdom (`tests/unit/onboarding/render/deck.test.tsx`) | first-login: no close control in the DOM, Escape does not close, backdrop does not close; final card closes and calls the action; opening calls nothing; re-show: close control present, Escape closes at every card index, and **`Done` never calls the action** (D-4) | 4, 5, 6, 8 |
| Unit pure (`tests/unit/onboarding/copy-drift.test.ts`) — **guard, no §17 row** | card strings byte-equal to the copy register (subsumes the U+2019 / U+2014 / U+00B7 check); Card 2's end date equals `FREEZE_INSTANT_UTC` formatted **in UTC**; `8 markets` ×2 and `15th September 2026` pinned | — (D-3) |

**Integration:** none. No DB write, no service-layer function. `pnpm test:integration` is unaffected.

## 8. Out of scope

- **Not** building a `/rules` or `/about` route. §21.6 keeps the feature-guide page deferred; §21.9 says the deck is *not a route and not a page*.
- **Not** creating, restoring or re-pointing any `(i)` doorway. §21.9's Scope note is explicit.
- **Not** wiring the real PFP. Deferred to SCAFFOLD.15 / the R2 `pfp` bucket; the deck uses the same placeholder as every other surface (Q1).
- **Not** editing the W2.2 mockup. Structural authority; copy superseded by the register, which says so itself.
- **Not** editing `src/components/ui/dialog.tsx`. Instance overrides only, per `dialogs.tsx:70-71`.
- **Not** touching `src/server/auth/**`. The deck never touches auth.
- **Not** adding a token to `globals.css`. `--overlay`, `--r`, `--imgr`, `--hairline`, `--elev-3` all exist.
- **Not** changing the `<main>` min-h chain or its four tests.

---

## 9. File allow-list

⛔ **A file not on this list is not edited. If the execute needs one, it STOPS and reports.**

### New

| Path | Why |
|---|---|
| `docs/adr/0037-onboarding-deck-seen-marker-cookie.md` | Half B of the spec package, **verbatim**. Not redrafted. |
| `src/server/onboarding/gate.ts` | `shouldShowOnboardingDeck()`, the cookie name + `INTRO_SEEN_MAX_AGE_SEC` |
| `src/server/onboarding/complete.ts` | `completeOnboardingDeckAction` |
| `src/components/onboarding/cards.ts` | ratified card array + `reshowCards()` |
| `src/components/onboarding/figures.tsx` | the `FIG` illustrations |
| `src/components/onboarding/OnboardingDeck.tsx` | the deck |
| `src/components/shell/RulesControl.tsx` | the header control |
| `tests/unit/onboarding/gate.test.ts` | rows 1–3 |
| `tests/unit/onboarding/cards.test.ts` | rows 7, 9 |
| `tests/unit/onboarding/render/deck.test.tsx` | rows 4, 5, 6, 8 |
| `tests/unit/onboarding/copy-drift.test.ts` | **D-3** — register byte-equality, the UTC date guard, the literal tripwires. No §17 row. |

### Modified

| Path | Change | Constraint |
|---|---|---|
| `src/app/(public)/layout.tsx` | read cookie; compute gate; render `<OnboardingDeck>` as a sibling of `<main>` | ⛔ `<main>` and its class string are **untouchable** |
| `src/app/(auth)/layout.tsx` | mount the re-show deck (Q5) | ⛔ re-show only; **never** the gate, never a cookie read, never the completion action (**D-4**) |
| `src/components/shell/GlobalHeader.tsx` | **D-2:** mount `RulesControl` in the **LEFT zone, after `RadioSlot`** (`:92-95`); docblock — state the order as Back · Home · Radio · RULES, drop RULES from the ratified-omissions list, add the tier-4 deviation paragraph | ⛔ **The absolute-centring sentence (`:22-23`) is NOT touched** — under D-2 it stays true. ⛔ The centre zone, the §21.1 divider, and the right-zone order are untouchable. |
| `docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md` | **APPEND-ONLY annotation** under the Card 2 figure note — see below | ⛔ **No card string is touched.** ⛔ The existing note is not rewritten. |
| `docs/specs/SPEC.1.md` | §21.9 Acceptance line gains the three test paths (**web-authored — see §11**); §0 1.0.34 → **1.0.35** + change-log row | same-commit rider, §5.12 |

### The copy-register annotation (append-only)

The register's Card 2 figure note asserts *"the viewer's **live PFP avatar** as a centred hero"*. **F-1 proves that false** — no live PFP exists anywhere in the product. The build appends a dated annotation beneath that note recording the finding and the pointer, in the same commit as the code that relies on it.

⛔ **Append, never rewrite.** The register is a **ratified** web-authored document; its assertions are the founder's. An annotation adds what was learned without editing what was ratified, and it keeps the byte-equality guard (D-3 assertion 1) intact by leaving every fenced card block untouched. ⚠ The annotation must land **outside** the fenced string blocks, or it breaks its own drift test.

### Explicitly NOT on the list

`src/components/ui/dialog.tsx` · `src/app/globals.css` · `src/server/auth/**` · **`src/server/profile/graph-series.ts`** (struck under **D-3** — no `WINDOW_START` export is needed) · `tests/unit/design/*-height-chain.test.ts` · `tests/unit/design/tokens-monochrome.test.ts` · `tests/unit/shell/sticky-header.test.ts` · `tests/unit/shell/page-container.test.ts` · `docs/design/mockups/**` · any `drizzle/**` · any `src/db/**`

## 10. Edit boundary — including the tests that pin current behaviour (§13.2)

**§13.2 says a boundary drawn around source alone forbids its own items.** These existing tests will *see* this change:

| Test | What it pins | Effect of this plan |
|---|---|---|
| `tests/unit/design/{discovery,debate,profile,bookmarks}-height-chain.test.ts` | `(public)/layout.tsx` contains `min-h-[calc(100vh-60px-2px)]`, via `toContain` | **Stays green.** Additive statements do not affect it; `<main>` is untouched. ⛔ Not amended. |
| `tests/unit/shell/sticky-header.test.ts` | Header `z-40`; a scan over `SCAN_DIRS = ["src/components","src/app"]` collects `fixed` overlays and asserts they are `z-50` and that tiers 20/30 stay free; `EXPECTED_OVERLAY_FILES` is a pinned list | **Stays green** *if* the deck adds no new `fixed` class of its own — it inherits `fixed … z-50` from `DialogContent`, already in scope. ⚠ **If the execute writes `fixed` anywhere in the deck, it must be `z-50`.** ⛔ Not amended. |
| `tests/unit/design/no-raw-hex-view-layer.test.ts` | no raw hex under `src/components` + `src/app/(public)` | **New deck files are automatically in scope.** Tokens only. ⛔ Not amended. |
| `tests/unit/design/tokens-monochrome.test.ts` | `globals.css` census, exact hex, 11-token count | Untouched — the plan adds no token. ⛔ **Never amended to let a value through.** |
| `tests/unit/shell/page-container.test.ts` | every `PageContainer` call site by class-set **equality** + an exact moved-sites list | Untouched — the plan adds no `PageContainer` call. ⚠ **The execute must not put one in the deck.** |

**No existing test asserts behaviour this plan changes.** There is no green test defending "the header has no RULES control" or "no modal renders on first login" — checked by grep across `tests/`. **So no test is updated to encode a superseded position, and none is amended.**

## 11. Commit sequence

One PR (Q11). Four commits, RED before GREEN.

| # | Commit | Contents |
|---|---|---|
| **1** | `test(onboarding): the gate, the card set and the deck's two dismissal policies — RED` | the **four** test files, failing. No `src/` change. |
| **2** | `feat(onboarding): the seen-marker is a cookie, and the gate is a decision the layout makes once` | **ADR-0037 verbatim** + `gate.ts` + `complete.ts` + the `(public)` layout wiring. Rows 1–3 GREEN. |
| **3** | `feat(onboarding): one component, one card array, two contexts` | `cards.ts` + `figures.tsx` + `OnboardingDeck.tsx` + the copy-register annotation. Rows 4–9 GREEN; `copy-drift` GREEN. |
| **4** | `feat(shell): the re-show gets the entry point a session boundary cannot give it` | `RulesControl.tsx` + `GlobalHeader` (left zone + docblock) + `(auth)` layout + the SPEC.1 §21.9 rider + §0 → 1.0.35. |

⚠ **ADR-0037 rides commit 2, not commit 1** — same-commit with the mechanism it governs (§5.12), which is `gate.ts` + `complete.ts`.
⚠ **The copy-register annotation rides commit 3**, with `cards.ts` — the commit whose code depends on the finding the annotation records.
⚠ Every message carries the **`Instructions for AI`** block, copied from `CLAUDE.md` §5.13.1, after the body and before any trailer. No `Co-authored-by`.

### ⛔ Commit 4 carries a RESERVED SLOT — web-authored text CC does not draft

SPEC.1 §21.9's Acceptance line currently reads *"**Acceptance.** §17 rows `onboarding-deck::*`."* It needs the three test paths in prose per SPEC.2 §13.4 (*"File placement follows the behaviour under test and is recorded at build"*).

**SPEC.1 is a web-authored prescriptive document.** ⛔ **CC does not draft that sentence.** Commit 4 halts on **S-12** until the replacement text is supplied verbatim, exactly as commit 0's blocks A1–A6 were.

**What the founder needs to write it** — the three paths, final, and each already justified in Q10:

```
tests/unit/onboarding/gate.test.ts          rows 1–3  (the gate predicate, pure)
tests/unit/onboarding/cards.test.ts         rows 7, 9 (the card set + derived step count, pure)
tests/unit/onboarding/render/deck.test.tsx  rows 4, 5, 6, 8 (dismissal + completion, jsdom)
```

⚠ `tests/unit/onboarding/copy-drift.test.ts` is **excluded by design** — it asserts no §17 row, and naming it would put a name in an Acceptance block with nothing in §17 to match, which §13.5 defines as a build error.

**Version:** SPEC.1 §0 **1.0.34 → 1.0.35**, `Last updated:` → the commit date, plus a §20 change-log row. ⚠ The §20 row is CC-authorable (it is a record of the change, not a normative claim); **the §21.9 Acceptance sentence is not**.

## 12. Stop conditions

⛔ **Any of these halts the execute. Report and wait; do not adapt.**

| id | Condition |
|---|---|
| **S-1** | `docs/adr/0037-*.md` would differ from Half B of the spec package in any byte other than the `**Date**` field. The ADR is web-authored. |
| **S-2** | Any card string in `src/components/onboarding/cards.ts` differs from the copy register's bytes. Verify by extracting and diffing, not by eye. |
| **S-3** | The `<main>` element or its class string in `(public)/layout.tsx` requires any change. |
| **S-4** | Any file outside §9's allow-list requires an edit. |
| **S-5** | `src/components/ui/dialog.tsx` requires a change to achieve non-dismissibility. |
| **S-6** | `tokens-monochrome.test.ts`, any `*-height-chain.test.ts`, or `page-container.test.ts` goes RED. |
| **S-7** | Achieving the gate requires reading or writing anything under `src/server/auth/**`. |
| **S-8** | The `ls docs/adr/` ceiling at execute time is not `0036` — i.e. `0037` is taken. |
| **S-9** | SPEC.1 §0 is not `1.0.34` at execute time (something landed in between). |
| **S-10** | ~~D-1, D-2 or D-3 is unresolved~~ — **DISCHARGED.** All five ruled 2026-08-18. Retained as a numbered slot so S-11/S-12 keep their identifiers. |
| **S-11** | A `(auth)`-mounted deck would read the marker cookie, render non-dismissibly, or import `completeOnboardingDeckAction` (**D-4**). |
| **S-12** | Commit 4 is reached without the **web-authored** §21.9 Acceptance sentence supplied verbatim. CC does not draft SPEC.1 prose. |
| **S-13** | The copy-register edit would touch any byte inside a fenced card block, or rewrite the existing Card 2 figure note rather than appending beneath it (**D-3** assertion 1 depends on this). |
| **S-14** | `RulesControl` would mount anywhere but the **left zone**, or `GlobalHeader.tsx:22-23`'s absolute-centring sentence would be edited (**D-2**). |

### ⚠ §13.1 — the plan run against its own stop conditions

**Result: no stop condition fires on this plan's own commit 0, and none forbids its own edit boundary.** Checked explicitly:

- **S-2** fires on card strings *in `cards.ts`*. **This plan quotes no card string** — it cites the register by path and by md5 and quotes only §-headings and prose. Had it quoted a card, S-2 would have needed a carve-out. *(This is the POLISH.8 shape: a guard that fires on the document defining it is broken, not over-broad.)*
- **S-1** fires on the ADR *file*, which this plan does not create. This plan quotes no ADR body text.
- **S-3 / S-4 / S-5 / S-7** are `src/` conditions; the plan's own commit 0 writes exactly one file, `docs/plans/O1-DECK.md`, which §9 does not need to list because §13's amended clause makes a plan the authority for its own declared `docs/**` writes.
- **S-6** cannot fire on a doc-only commit: none of those tests reads `docs/plans/**`.
- **S-8 / S-9** are asserted true at plan time and re-asserted at execute; they are preconditions, not self-references.
- **S-10** names D-1..D-3 as *decisions*, and this plan's job is to surface them, not resolve them — so it cannot deadlock on itself.

**One residual, stated rather than hidden:** S-4's allow-list governs the *execute*. The plan commit writes `docs/plans/O1-DECK.md`, which is not on it. **Carve-out, written in advance: S-4 does not fire on this plan's own commit.**

### ⚠ §13.1 RE-RUN against the AMENDED plan — D-2 changed the file set

The rulings moved the boundary in four places, so the self-check was executed again rather than assumed to still hold.

| What moved | Effect on the plan's own commit | Verdict |
|---|---|---|
| **D-2** — RULES to the left zone | `GlobalHeader.tsx`'s edit changes *which* lines are touched, not *whether*. It was already on the allow-list; it stays. **No file was added or removed from `src/` by D-2.** | no new self-fire |
| **D-3** — `graph-series.ts` **struck** from the allow-list | The set got *smaller*. A shrinking allow-list cannot create a self-fire; it can only make S-4 fire more readily at execute, which is the intent. | no new self-fire |
| **D-3** — `copy-drift.test.ts` **added** | A new `tests/` file. The plan commit writes no `tests/` file. | no self-fire |
| **Copy-register annotation added** | A new `docs/design/**` path on the allow-list. ⚠ **Checked specifically:** the plan commit does **not** write to `docs/design/**` — it writes only `docs/plans/O1-DECK.md`. | no self-fire |

**The four new stop conditions, each run against this document:**

| id | Fires on the plan? | Why not |
|---|---|---|
| **S-11** | no | `(auth)` is a `src/` condition; the plan writes no `src/`. |
| **S-12** | no | Binds *commit 4 of the execute*. The plan neither drafts nor quotes the §21.9 Acceptance sentence — it names three file paths and stops, which is the whole point of reserving the slot. |
| **S-13** | ⚠ **checked closely, and no** | S-13 binds edits to the register. The plan **quotes the register's Card 2 figure note in fragment** (*"the viewer's live PFP avatar as a centred hero"*) — but S-13 fires on **editing** the register, not on quoting it, and a 9-word figure-note fragment is not a card string, so **S-2 does not fire either** (re-verified by grep against all seven card subtexts: 0 hits). |
| **S-14** | no | A `src/components/shell/` condition; the plan writes no `src/`. |

⛔ **One near-miss worth recording, because it is exactly the POLISH.8 shape.** S-13 and S-2 both guard the register. Had this plan quoted a *card string* to illustrate D-3's byte-equality assertion — the natural thing to write — **S-2 would have fired on the plan that defines it**, and the execute would have halted on its own governing document. The plan cites the register by path and md5 and quotes only prose. **That is deliberate, and it is why the grep is re-run rather than reasoned about.**

---

## Open questions — ALL CLOSED. Founder rulings, 2026-08-18.

| id | Question | Ruling | Matched my recommendation? |
|---|---|---|---|
| **D-1** | The 225.9px of dead space | **(a) + vertical centring** — grid stack sized to the natural tallest, no literal; content centred, not top-aligned | ✅ yes, **plus** an addition I had not proposed: *"226px pooled at the bottom is a hole; split above and below it is breathing room."* |
| **D-2** | RULES costs 41.57px of brand centring | ⚠ **REVERSED — left zone, beside Radio.** 0.00px shift. Recorded as a **tier-4 deviation** with its measurement. The centring docblock sentence stays true and is **not** amended | ❌ **no** — I reported the measurement and left the ruling standing. The founder used the number to overturn it, which is what the number was for |
| **D-3** | Card 2's `8` and two dates | ⚠ **(b) — all three ship as LITERALS**, each drift-tested. `WINDOW_START` export **struck** | ❌ **no** — and the founder's grounds are stronger than mine: binding would render **"6th November 2026" in IST** and would break byte-equality with the register |
| **D-4** | Does the re-show write the marker? | **(b) — never.** One writer, one path: first-login completion only | ✅ yes |
| **D-5** | Card 2's figure, given F-1 | **Shared placeholder + pseudonym-initial fallback**, exactly as `IdentityCluster`. Not dropped, not a new `FIG` | — new, arising from F-1 |

**No open questions remain at plan time.** The one thing the execute still needs from outside is the **web-authored §21.9 Acceptance sentence** (S-12) — a reserved slot, not an unresolved decision.

⚠ **Two of five rulings went against my recommendation, and both corrected a real error on my side.** D-3 in particular: I recommended binding the dates to `FREEZE_INSTANT_UTC`, and that would have shipped a card contradicting the freeze on every IST device — I reasoned about the constant and never formatted it. **The measurement discipline that produced Q4 and Q6 was not applied to my own D-3 recommendation.**

## ADRs needed

**ADR-0037 only, and it is already written** — Half B of `ZUGZWANG-O1-DECK_spec-package_v1_0.md`, landing **verbatim** in commit 2. Number re-verified free at branch time (`ls docs/adr/` ceiling `0036`).

No other decision here is ADR-worthy: every remaining choice either follows an existing pattern (`whitespace-pre-line`, `sr-only` title, instance-level `className`) or is a founder copy/design call (D-1..D-3).

---

## Self-critique (Phase 1 self-review)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **high** | Q1's premise — "Card 2's figure is the viewer's LIVE PFP" — is false of the product; there is no live PFP anywhere. A plan that accepted it would have widened the viewer DTO for no gain and created a second PFP path to migrate. | Corrected in **Q1** with five file:line citations. No DTO change. |
| 2 | **high** | The task's reading of SPEC.2 §13.5 ("a §17 row naming a file that does not exist is a build error") is not what §13.5 says, and §17 has no file-path column. Acting on it literally would have added a fourth column to a three-column table. | Corrected in **Q10**, with §13.5 quoted. Paths go in §21.9's Acceptance line. |
| 3 | **high** | An earlier draft derived the deck's `open` from the server prop on every render. On `/m/[slug]` that reopens a just-dismissed deck every 15 s. | **Q9** — the client owns `open`, seeded once. The failure is written into the plan so it is not reintroduced. |
| 4 | medium | The `(auth)` mount could trap a user inside `/sign-in` behind a non-dismissible modal. | **S-11** + the Q5 constraint: `(auth)` is re-show only and never reads the marker. |
| 5 | medium | §13.2: a source-only boundary would have missed that `no-raw-hex-view-layer.test.ts` auto-scopes new files under `src/components`, and that `sticky-header.test.ts` scans for `fixed` overlays. Neither is in the allow-list, and both would have failed the execute by surprise. | **§10** names all five pinning tests and what each implies. |
| 6 | medium | Q4's "size to the tallest card" invites a hard-coded `503px`, which is a measurement of today's strings and drifts on the next copy edit. | **D-1 option (a)** derives the height from content. The literal is explicitly rejected as option (b). |
| 7 | low | D-4 is not stated in §21.9 in as many words; the plan asserts it. | Named as an open decision rather than assumed silently. |
| 8 | low | Q6 measurement is at 1440 signed-out; signed-in adds the Đ cluster to the right zone. | Headroom reported (387.77px/side) so the conclusion holds signed-in; the shift itself is centre-zone-local and unaffected. |

### Added at the amendment pass (2026-08-18, after the five rulings)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 9 | **high** | **My D-3 recommendation was wrong, and wrong in the way this plan was built to avoid.** I recommended binding the dates to `FREEZE_INSTANT_UTC` after *reasoning* about the constant — I never formatted it. Formatted in local time it renders **"6th November 2026" in IST**, so the card would have contradicted the freeze it was bound to, on the founder's own device. Q4 and Q6 were measured; D-3 was not. | Ruled (b) by the founder. The failure mode is now an **assertion** — `copy-drift.test.ts` #2 formats in UTC and pins `5th November 2026`, so any future move to local formatting goes RED. |
| 10 | **medium** | **D-2's ground 2, as relayed, is factually wrong** — the mockup does not predate the `1fr auto 1fr` grid; it uses exactly that grid (`mockup-v0_2:37`). Letting it stand would have put a false premise in a ratified plan. | Corrected in place in **Q6**, with the real mechanism named (`RULES` is a child of `.brand` inside `.zone center`, so the mockup carries the identical displacement and simply never measured it). **The correction strengthens the ruling** — the mockup's placement was not a considered trade — so grounds 1, 3 and 4 carry it unaided. |
| 11 | **medium** | D-2 says "do not amend the docblock", but **two other sentences in that same docblock go false**: `:26-28` lists RULES among the *ratified omissions* and states the left-zone order as Back · Home · Radio. Reading the instruction literally would ship a docblock asserting RULES is omitted while it renders three nodes away. | Split explicitly in **Q6**: the **centring** sentence (`:22-23`) is untouched and stays true; the **order + omissions** sentences are corrected in the same commit — O-9 truth-maintenance on prose describing this exact mechanism, not the edit D-2 struck. |
| 12 | medium | The drift test's `8`-and-start-date half **cannot verify anything** — there is no machine-readable slate, and the test DB holds fixtures. Presenting all three assertions as equal would have overstated the guard. | **D-3** labels assertion 3 a *tripwire*, not a verification, and says why. Assertions 1 (register byte-equality) and 2 (UTC date) are real. |
| 13 | low | The copy-register annotation could break the very byte-equality guard it accompanies if it landed inside a fenced block. | **S-13** added; the allow-list says append-only, outside the fences, and never a rewrite of the ratified note. |
| 14 | low | With D-4 ruled, a `context === "reshow"` guard inside the action would still be a branch a later edit could flip. | §4 makes it structural: the re-show never *imports* `completeOnboardingDeckAction`. A compile-time fact, not a runtime check. **S-11** extended to cover the import. |

*Self-critique checked, both passes: invariant coverage (none touched, with the two register tripwires), scope discipline (§8), test assertions (all nine rows assigned + one guard file), edge cases (§6), the plan against its own stop conditions (§12), and — at the amendment — the four newly-added conditions against this document.*

---

## References

- `CLAUDE.md` §1 (critical paths), §5.6 (tests first), §5.12 (same-commit ADR), §5.13.1 (commit block), §8 O-4/O-8/O-9
- `AGENTS.md` §5 (server/client), §8 (tokens, the `text-[Npx]` leading trap), §9 (the jsdom harness, no jest-dom)
- `docs/specs/SPEC.1.md` §21.9, §21.6, §17, §13 (session model)
- `docs/specs/SPEC.2.md` §13.4, §13.5
- `docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md` — the ratified strings (md5 `fe32aa06ba8f13d655c5a3e0a3aa83d8`)
- `ZUGZWANG-O1-DECK_spec-package_v1_0.md` Half B — ADR-0037 (md5 `36acbb9501fcc806a5d8d209979a110f`)
- `docs/design/mockups/DESIGN_W2_2_onboarding-deck_mockup-v0_1.html` — composition (md5 `420c5e800a3dbe3de57662f0d8f6c102`)
- `docs/design/mockups/DESIGN_W2_1_first-login-journey_mockup-v0_1.html` — the locked shell; `Done` at `:384`
- `docs/polish/POLISH-SURFACE-TEMPLATE.md` §13.1, §13.2
- ADR-0004 P1 (the 400-day session), ADR-0023 (`(public)` topology), ADR-0037 (held)
