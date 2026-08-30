# CRIT-1 — the resolution criterion returns to `/m/[slug]`, collapsed

**Task** CRIT-1 · **Branch** `feat/crit-1-criterion-disclosure` · **Base** `origin/main` @ `d9128e2`
**Mode** autonomous overnight (recon → plan → execute → deploy → report). No operator gates.
**Governing docs** `ZUGZWANG-CRIT-1_brief_v1_1.md` (what) + `docs/overnight-run.md` (how).

---

## 0 · The core idea

RESO-1 removed the clamped one-line criterion excerpt from Market Detail, and measurement
confirmed it was the only render of `markets.description` on the route. The pre-registered
public text a participant stakes against now appears nowhere on the page it is staked on — it
survives only behind a file download.

CRIT-1 puts it back as the founder ruled: **a native disclosure, closed by default, carrying the
complete untransformed text, findable by find-in-page while still closed.** The page stays clean
at rest; the binding text is one click, or one Ctrl-F, away.

---

## 1 · The finding that changes the build

⛔ **C-4's stated mechanism breaks C-1, measured in Chrome 151.**

`hidden="until-found"` is **not** cleared when a `<details>` opens. So a content container
carrying it stays `content-visibility: hidden` after the user clicks, and the disclosure's own
box never grows past its summary:

| probe | closed | open |
|---|---|---|
| plain `<details>` own box | 24px | **312px** ✓ |
| `<details>` + `hidden="until-found"` body, own box | 24px | **24px** ✗ |

✅ **And the attribute is unnecessary, for an exact reason.** A closed `<details>` hides its
content via `::details-content`, whose computed signature is byte-identical to a bare
`hidden="until-found"` element — `content-visibility: hidden; display: block`. That is precisely
the find-in-page-traversable class (`display: none` is not). The capability §3 describes is
delivered **by the element itself**, with no attribute and no JavaScript.

⇒ CRIT-1 ships **C-4's outcome** — findable by find-in-page while closed — and **not** the
literal attribute. OVN-O4: the ruled outcome already held; the stated mechanism was a fix for a
state that did not exist, and here it destroys the outcome it was meant to enable.

⇒ **C-5 is moot in consequence.** Its failure mode is "hidden and unfindable in a browser
without support". With plain `<details>` the content is never unfindable: the summary is always
visible and clickable, and `<details>` is universally supported. A JS fallback that force-opened
the disclosure in older browsers would violate **C-3** (closed by default) there. So: no
fallback, no JavaScript, reported.

---

## 2 · File map

| File | Why |
|---|---|
| `src/components/debate/CriterionDisclosure.tsx` | **NEW** — the disclosure. C-1, C-2, C-3, C-4(outcome), C-6, C-7, C-8 |
| `src/components/debate/DebateView.tsx` | one mount, one line + docblock (C-1's parent) |
| `tests/unit/debate/render/criterion-disclosure.test.tsx` | **NEW** — G-1…G-4 |
| `tests/unit/design/debate-height-chain.test.ts` | G-5 — extend, not rewrite; the chain gains a node |
| `docs/plans/CRIT-1.md` | this file |

**Not touched:** `src/server/**` (zero files — §7), any schema or migration, `MarketHeader.tsx`,
`ResolverCards.tsx` and the four blocks, `HeadZone.tsx`, the export route, `docs/parked.md`.

---

## 3 · Placement — the chosen parent, and why

**Chosen: a direct child of `PageContainer`, after the market↔post ternary, before the overlays.**

```jsx
<PageContainer className="flex h-[calc(100dvh-60px-2px)] min-h-0 flex-col gap-3 overflow-hidden">
  <DebatePoll/>
  {selectedPost ? <><PostFocusHeader/><arena/></> : <><MarketHeader/><arena/></>}
  <CriterionDisclosure description={market.description} />   ← HERE
  <PostPopup/> <ReplyPopup/> <ImageLightbox/>
</PageContainer>
```

Why:
1. **One authoring site renders it on BOTH arms.** A reader in post focus can still Ctrl-F the
   criterion — the capability this task exists to restore is not lost in half the surface.
2. **Changes less** — no edit to either arm fragment, no duplicated JSX, and
   `debate-height-chain`'s "both arms wire the arena identically" stays trivially true.
3. Unambiguously outside the band and outside `headzone-stack` (wall).
4. Does not interrupt the band → arena reading flow.

⚠ **It is NOT free, and §0c's "competes for nothing" is corrected.** `PageContainer` is a fixed
`h-[calc(100dvh-60px-2px)]` with `overflow-hidden`, and the arena is its only `flex-1`. The
disclosure's height therefore comes out of the **arena**. That is acceptable — the arena's
columns scroll internally, which is this surface's ruled overflow posture — and it leaves the
band and `headzone-stack` untouched, which is what the wall protects. Measured at §9 of the run
report, not asserted away.

---

## 4 · Baseline, and the predicted post-build value

| Baseline | BEFORE (`d9128e2`, 1440×777) | PREDICTED AFTER |
|---|---|---|
| Full suite | 391 files / 3626 tests, exit 0 | 391+1 files, +N tests, exit 0 |
| band height | 188.03 | **188.03 — unchanged** (`shrink-0 basis-[24.2dvh]`) |
| `headzone-stack` | scroll 188 / client 188, over 0 | **188 / 188, over 0 — unchanged** |
| block row | y 154.04 / h 111.99 | **unchanged** |
| arena height | 482.97 | **~438** (−summary ~33 −`gap-3` 12) |
| pageScrolls | false | **false** |
| criterion rendered hits | 0 | **1, complete, inside a closed `<details>`** |

---

## 5 · Slices

| # | Slice | Exit condition |
|---|---|---|
| S0 | recon + baselines | recorded; longest description named |
| S1 | C-1 · C-2 · C-3 · C-7 — the disclosure renders the full text, closed | suite green; text in DOM; `open` absent |
| S2 | C-4(outcome) · C-5(moot, reported) · C-6 | suite green; `whitespace-pre-wrap`; no `hidden` attribute |
| S3 | C-9 — verify at the RESO-1 viewport ladder 777/660/600/520/460, on the real longest **and** a ~7,500-char stress body | measured; no crush, no clip, no page scroll while closed |
| S4 | guards, full suite, reviewer cascade, deploy, report | all green; preview serves the canary |

Reviewer-bearing: **S4** — `code-reviewer` (full diff), then `test-writer` (adversarial over the
guards). `security-auditor` and `db-migration-reviewer` excluded per §7: no auth, no ledger, no
money path, no schema.

---

## 6 · Ambiguities resolved, with the alternative rejected

| # | Ambiguity | Chose | Rejected | Why |
|---|---|---|---|---|
| A-1 | C-1 says "below the header band" — immediately below it, or below the arena? | direct child of `PageContainer` **after the ternary** | inside each arm between band and arena | one site → renders on BOTH arms, so post-focus keeps the restored capability; changes less; no coupling to the provisional RESOLUTION fixture block |
| A-2 | C-4 rules an attribute that measurement shows breaks C-1 | ship the **outcome** — plain `<details>`, whose `::details-content` is already `content-visibility: hidden` | ship the attribute as written | it never reveals on open (24px → 24px, measured). Shipping it would break C-1/C-2/C-7 while looking correct in every screenshot |
| A-3 | could the attribute be applied only while closed, via React state? | **no** | `hidden={open ? undefined : "until-found"}` | works only after hydration; pre-hydration a click opens the details and the body stays hidden. It also adds JS to a thing §3 says needs none, to replace a mechanism the element already has |
| A-4 | C-5's feature-detect fallback | **not implemented; reported** | a JS fallback expanding the content where `onbeforematch` is unsupported | with plain `<details>` the content is never unfindable — the summary is always clickable. Force-expanding in older browsers would violate **C-3** there |
| A-5 | C-6 `whitespace-pre-wrap` — only if warranted | **applied** | omitting it | measured: **8 of 8** descriptions carry 6–8 newlines and 3–4 paragraph breaks. Without it four paragraphs collapse into one block |
| A-6 | the open body can exceed a fixed one-screen container | `max-h-[30dvh] overflow-y-auto` on the body | unbounded | `PageContainer` is `overflow-hidden`; unbounded open content is **clipped**, the exact failure `debate-height-chain` names. A `dvh` bound matches the surface's own `basis-[24.2dvh]` idiom and scales with the viewport |
| A-7 | the brief's 7,481-char figure vs the measured 799 | verify against **both** | only the seeded 799 | if 7,481 is the amended text in the separate lane, a design verified only at 799 would fail on arrival. Cheap to stress |
| A-8 | summary type treatment — reuse the `.overline` recipe? | **no** — sentence case, `text-[11px]` | the `uppercase` overline recipe | C-2 says sentence case; `uppercase` would render `RESOLUTION CRITERIA` |
| A-9 | body type treatment | **byte-reuse** the removed `<p>`'s recipe, minus the clamp | a new recipe | the founder ratified `text-[11px] leading-[1.5] text-muted-foreground`; only `line-clamp-2` was the defect. No new value enters |

---

## 7 · Guards (§6.1), each verified by reverting its fix and watching it red

| # | Guard | The wrong answer it rejects |
|---|---|---|
| G-1 | the **complete** criterion is in the DOM while closed, **with a positive control** | a truncated or absent body; a query pointed at the wrong subtree |
| G-2 | `open` is absent on first render | shipping it expanded |
| G-3 | the disclosure is a native `<details>`/`<summary>`, and the body carries **no** `hidden` attribute | the measured-broken C-4 form, and a `<button>` accordion |
| G-4 | no clamp/truncate class on the body, asserted over class **TOKENS** extracted from `className` | ⚠ **not** a bare `not.toContain("truncate")` — that matches the docblock prose explaining the absence, which has now failed **six** times in this repo |
| G-5 | `headzone-stack` scroll == client, and the band/block-row geometry is unmoved | a placement that steals from the band |
| G-6 | the four RESO-1 blocks + four INV-3 guards unmodified — **by diff, not assertion** | greening a red by editing a guard |
