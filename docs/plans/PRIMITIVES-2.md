# PRIMITIVES-2 — plan

**Task:** the shared-primitive pass between POLISH-TEMPLATE and the six remaining machine
phases. Successor to PRIMITIVES-1. Five docket items, of which recon discharged one and
resized two.

**Ritual:** FULL, matching PRIMITIVES-1. Recon (done) → this plan → operator ratification
→ **fresh-chat execute** → `@code-reviewer` → **Gate C web diff-read before merge**, on
BOTH PRs. **NO `@security-auditor`:** display-grade primitives and a client-side `onError`;
no write path, no engine contact, none of CLAUDE.md §1's four critical paths. **NO
`@test-writer`** — PRIMITIVES-1's precedent; test work is authored in-session.

**Authorship:** plan web-authored, operator-ratified, CC-committed.
**Ground:** `origin/main` = `613878da13024a4f6039e1aadff15cea8dd5380a`.
`origin/staging` = `71f4d421` — **behind, not diverged**, by 4 docs-only commits.
**Recon:** `~/Downloads/PRIMITIVES-2-recon.md`, md5 `c8c2282bce1a07dd40950d2547827308`,
2009 lines, read-only @ `613878d`. R1–R18 answered, four halts fired.
**ADR ceiling:** 0036, next free 0037. **This task mints none.** If execute finds it needs
one — HALT.

**Days to go-live at authoring: 35.**

---

## §1 · Exit criteria

| # | Criterion |
|---|---|
| 1 | A market-media or post image whose presigned URL 404s at the browser degrades to the site's own placeholder — no broken-image glyph, no `alt` text overflow — at **all three** Discovery image sites |
| 2 | Exactly **one** component owns the null · error · loaded state machine for those three sites. No site patches its own `<img>` |
| 3 | Both market thumbs carry `alt=""`, matching the hero POST image's ratified treatment |
| 4 | `SideBadge` can **receive** a d5 preset and a Profile preset. A fourth union member cannot silently fall through to the default — the resolution is a map lookup, not a binary ternary |
| 5 | **The two held values are each a ONE-LINE change in ONE named place**, and that is *proved* by naming the line, not asserted |
| 6 | Every existing render is **byte-identical**, proved per consumer against a captured baseline, except the two ratified `alt` deltas |
| 7 | `side-pole-binding.test.ts` is green **without any change to `PERMITTED_FILES` or to its predicate** |
| 8 | `tokens-monochrome.test.ts` is green. No token **value** changed, no hex added |
| 9 | No DDL, no migration, no `EVENT_TYPES` value, no ADR, no SPEC edit, nothing under `src/server/**`, no `DebateViewModel` field |

**Criterion 5 is the binding condition, restated as a measurable property.** See §4.2.

---

## §2 · Ground — verified at `613878d`, not inherited

| Fact | Value | Evidence |
|---|---|---|
| `badges.tsx` path | **`src/components/debate/badges.tsx`** — NOT `ui/` | recon H-1 |
| `PriceBar.tsx` path | **`src/components/debate/PriceBar.tsx`** — NOT `ui/` | recon H-2 |
| `SideBadge` size union | `size?: "hero"` at `:70` — one member, **optional** | R5 |
| `SideBadge` resolution | `size === "hero" ? CHIP.hero : CHIP.base` at `:85` — a **binary ternary**; a third member falls through to `base` by accident of shape | R5 |
| `SideBadge` census AT HEAD | **13 render sites / 10 consumer files** (+ the definition) | R6 |
| Sites riding `CHIP.base` | **12** — every site except `HeroPanels.tsx:137`. ⚠ **NOT the "8" in the side-badge docblock** | R6 |
| `PriceBar` size | **REQUIRED, no default** (`:48`) — the opposite O-1 decision on the same primitive class | R8 |
| `mix-blend` anywhere in `src/` | **ZERO occurrences.** Removed at the primitive by PRIMITIVES-1 D6 (`02a3a78` / `997f308`, PR #293) | R7 |
| Absence pinned by | `tests/unit/design/avatar-ring-token.test.ts:72,83` | R7 |
| Market thumb (card) | `MarketCard.tsx:51-55`, **52×52**, `items-start`, `alt={card.title}` at `:53`, **no `onError`** | R9 |
| Market thumb (hero) | `HeroPanels.tsx:62-66`, **54×54**, `items-center`, `alt={card.title}` at `:64`, **no `onError`** | R9 |
| Hero POST image | `HeroPanels.tsx:184-191`, `flex-1 min-h-[40px]`, **`alt=""`** at `:189`, `data-testid` on both arms, **no `onError`** | R9 |
| Client boundary | **All three inside it**, via the single directive at `DiscoveryCarousel.tsx:1`. `onError` is available at every site with no new directive | R9 |
| `getDefaultMarketMediaUrl` | `src/server/discovery/media.ts:40-63`. Returns `null` on a presign throw; **cannot see a missing object** — presigning is a local HMAC | R10 |
| "Secondary text tier" | **Defined nowhere on `main`.** 6 mentions, all naming it as a thing to build | R11 |
| Its one held site | `HeroPanels.tsx:198`, `text-n4` — **the only `text-n4` micro-label on the tree** | R11 |
| Other micro-labels | 13 sites, 6 files, 4 sizes × 4 trackings × 2 weights × 5 tiers, **no shared import** | R11 |
| Ladder rung 1 (n2) | `--hairline` at `globals.css:166` — **45 uses across 31 files** | R12 |
| Ladder rung 2 (n3) | `[border:1px_solid_var(--color-n3)]` literal — `HeroPanels.tsx:51,103,115`. **3 sites, 1 file, nowhere else in `src/`.** FOUNDER-RULED (PD-2-07) | R12 |
| Ladder rung 3 (n4) | `[outline:1.5px_solid_var(--color-n4)]` literal — `DiscoveryGrid.tsx:52`. **1 site. Ruling requested, unanswered** | R12, R2 |
| `--border-strong` | `globals.css:178-180`, alias to n2, **zero consumers** | R12 |
| `src/components/ui/` | 10 files. **None** contains `uppercase`, `text-n4`, `text-n6`, `--color-n3` or `--border-strong` | R13 |
| PD-2-08 recorded answer | **NONE.** `PD-2-08` and `Ruling requested` each occur exactly once, on the same line | R2 |
| OQ-2 recorded answer | **NONE.** Two occurrences, both in one log, both stating it is open | R3 |
| Register high-water | `PD-2-34` · `PD-3-02` · **`PD-5` series empty** | R16 |
| ADDITIONS placeholders | Literal `PD-3-nn` / `PD-5-nn`, **no concrete numbers** — nothing to collide with | R16 |
| RR-4 cells | disposition `routed`, status `closed` | R15 |

**Not required by this task, so not verified:** migration head, `EVENT_TYPES` count,
SPEC versions. This task mints none. If execute finds it needs any — **HALT**.

---

## §3 · Ratified rulings — D1–D14, durable

### D1 · Item 4 is DISCHARGED. It is a doc correction, not a build.

`mix-blend` has zero occurrences in `src/`. PRIMITIVES-1 ruling D6 removed
`after:mix-blend-darken` **from the primitive**, which fixed all three consumers in one
edit, and `avatar-ring-token.test.ts:72,83` now pins its absence in two independent ways.
The two "unfixed consumers" the docs name — `HeroPanels.tsx:112`, `ArgProfile.tsx:51` —
are clean at HEAD (and `:112` is no longer an Avatar mount at all).

**Build: nothing.** **Correct three stale sentences**, in PR-B:

| File:line | Correction |
|---|---|
| `docs/parked.md:910` | Item 4 struck; replaced with a one-line discharge note citing `997f308` and the guard |
| `docs/polish/POLISH-TRACKER.md:128` | The `mix-blend-darken` clause removed from the scope sentence |
| `docs/polish/POLISH-0.md:159` | *"fixed on 1 of 3 consumers"* → fixed at the primitive, all three |

**Struck, not deleted.** Each correction states what the text previously said, in past
tense, so a later reader does not conclude the concern never existed. This is the H-1/H-2
retirement pattern from PRIMITIVES-1.

### D2 · `MarketThumb` owns the three STATES. Geometry and the placeholder stay with the consumer.

The docket says *"one shared `MarketThumb` owning three states — null · error · loaded —
used by BOTH sites"* and forbids patching the `<img>`s independently. It also names three
sites, not two. But recon shows the three sites are **not interchangeable**: 52×52
`items-start`, 54×54 `items-center`, and a `flex-1 min-h-[40px]` post image with a
different placeholder, its own `data-testid` pair, and `bg-n1` on the `<img>` itself.

A component owning geometry as well as state would be three variants × three states = nine
render paths, and every zero-delta proof would have to hold across all nine.

**The defect is the missing error path, and it is identical at all three sites.** So:

```
MarketThumb({ src, alt, className, fallback, ...passthrough })
  src === null            → fallback
  onError fired           → fallback
  otherwise               → <img src alt className {...passthrough} />
```

- **One implementation of the error degradation.** PD-0-10 cannot recur.
- **Each site passes its own `className` and its own `fallback` node**, so the null path
  and the loaded geometry are byte-identical to today by construction, not by assertion.
- `data-testid` and any other attribute rides `passthrough`, so the hero POST image's two
  testids survive unchanged.
- The `biome-ignore` for `noImgElement` moves onto the primitive's single `<img>` — three
  suppressions become one.

**Placement:** `src/components/discovery/MarketThumb.tsx`. All three consumers are under
`discovery/` and all three are already inside the carousel's client boundary. It needs no
`"use client"` of its own, exactly as `HeroPanels.tsx`, `DiscoveryGrid.tsx` and
`MarketCard.tsx` need none. ⚠ If a future surface imports it from a **server** component it
will need one — recorded in its docblock, not built for.

**Naming.** The docket name is kept for traceability even though the primitive also carries
a post image. The docblock states why all three live here: *one error path, not three.*

### D3 · The error fallback is the site's OWN placeholder. No new visual is invented.

Each site already has a null placeholder that is design-ratified (52×52 / 54×54 `IMG`
squares; the post image's bordered `flex-1` block). The error state renders **that same
node**. Nothing new is designed, nothing goes to the founder for approval, and the error
render is provably identical to the null render — which is the correct semantic: *no image
available*, for either reason.

### D4 · `alt=""` on both market thumbs, landing in the same PR as D2.

PD-2-33. Both thumbs carry `alt={card.title}` while the same title renders in the adjacent
`<h3>` / `<h2>` two lines below. `alt=""` matches the hero POST image's already-ratified
treatment (`HeroPanels.tsx:187-189`) and is also what stops broken-image text overflowing
the metadata row.

⚠ **This is the ONE intended delta in PR-A.** Every other render is byte-identical. A
reviewer must not flag it, and the plan says so here so the disposition is on record.

The a11y half (WCAG 1.1.1 duplicate announcement) remains **A11Y.0's** row. The overflow
half is what lands here.

### D5 · `SideBadge` gets the SEAM. `.3` and `.5` get the call sites.

Recon found three answers on `main` — `.3`+`.6`, `.3`+`.5`, and PRIMITIVES-2. All three are
partly right, and the split that makes them consistent is **seam vs value**:

| Lands here | Lands at the surface |
|---|---|
| The union can receive a d5 preset and a Profile preset | `/m/[slug]` adopts the d5 preset |
| The presets carry their mockups' ratified numbers | `/u/[pseudonym]` adopts the Profile preset |
| Both presets are render-tested at both poles | Each surface inspects its own render at 1440 |
| **12 call sites do not move** | — |

Wiring the call sites here would re-skin d5 and Profile before either has been inspected —
`POLISH-SURFACE-TEMPLATE.md` §4.2 C1 exactly.

**`POLISH-TRACKER.md:72` is right that Profile is `.5`'s, not `.6`'s** — that mockup is
POLISH.5's surface. `badges.tsx:17-18` and `docs/plans/DISCOVERY-COMPLETE.md:70` both say
`.6` and are wrong. **Correct the docblock** (we are editing that file anyway). **Do not
edit `DISCOVERY-COMPLETE.md`** — it is a landed historical plan; correcting it is churn, and
the register row carries the correction.

### D6 · Presets are named by SURFACE, never by mockup class. `detail` and `profile`.

⚠ **The trap:** `.sidechip.md` is **9px on Discovery and 10px on d5**. `CHIP.hero` already
*is* Discovery's `.md`. A preset named `md` would carry d5's 10px under a name that means
9px three lines above it — a stale-name defect minted at birth.

```ts
const CHIP = {
  base:    "…",   // unchanged, byte-identical, 12 sites
  hero:    "…",   // unchanged — Discovery's .sidechip.md (9px)
  detail:  "…",   // NEW — d5's .sidechip.md (10px), POLISH.3 adopts
  profile: "…",   // NEW — Profile's .sidechip.sm (8.5px), POLISH.5 adopts
} as const;
```

Matches `PriceBar`'s `hero` / `card` / `detail`, which is already surface-scoped.

⚠ **The exact pixel values come from the tier-4 mockups, read at execute — not from this
plan and not from `DISCOVERY-COMPLETE.md:66`'s summary table.** The plan records the source
lines: `surface_d5_v1_0.html:538-541` and the Profile mockup `:278-279`. If the mockup and
the summary disagree, **the mockup wins and it is a HALT to report, not to resolve.**

### D7 · The binary ternary becomes a map lookup. `size` stays optional.

`badges.tsx:85` is `size === "hero" ? CHIP.hero : CHIP.base`. Add a third member and it
silently resolves to `base` — correct today only by accident of the ternary's shape, and a
latent defect the moment a fifth is added.

```ts
CHIP[size ?? "base"]
```

with `base` a real key. A member added without a `CHIP` entry becomes a **compile error**,
not a wrong render. This is CLAUDE.md §8 O-1 — structural beats procedural — and it is the
decision `PriceBar` already took by making `size` required.

**`size` stays OPTIONAL.** Making it required is a 13-site edit for no defect. The
asymmetry with `PriceBar` is recorded in the docblock as deliberate, with the reason.

### D8 · Item 5 lands at the scope where a preset actually buys something. This is a stated departure.

**The binding condition, verbatim:** *the secondary text tier and the emphasis ladder land
as NAMED PRESETS, not inline classes. That is what makes deferring the founder's visual
pass safe.* Its stated purpose is that a later ruling costs **one line per preset instead of
a six-surface sweep**.

**Recon measured the sweep and it is not there:**

| Held ruling | Sites it governs today | Files |
|---|---|---|
| **OQ-2** — replyhead `text-n4` vs `text-n6` | **1** (`HeroPanels.tsx:198`) | 1 |
| **PD-2-08** — active ring colour | **1** (`DiscoveryGrid.tsx:52`) | 1 |

Both are already one-line changes. Meanwhile the *literal* reading — build a host for "the
secondary text tier" — means normalising **14 sites across 6 files in 3 route trees**, with
4 sizes, 4 trackings, 2 weights and 5 colour tiers and **no shared import**, including
`debate/composer/**` which is **POLISH.4's uninspected surface**. That is a V batch spanning
surfaces, and `POLISH-0.md` §5 forbids it for the reason that it silently re-skins surfaces
nobody looked at.

**Ruling: build the seam at the two rungs where it is coherent, prove the safety property
holds, and docket the general normalisation.**

| Sub-item | Build | Do not build |
|---|---|---|
| **Ladder rung 2** (n3 hero panel) | Named token, 3 sites → 1 definition | — |
| **Ladder rung 3** (n4 active ring) | Named token, 1 site → 1 definition | — |
| **Ladder rung 1** (n2 hairline) | — | Already `--hairline`, a named token with 45 consumers. Re-pointing it is a 45-site change and a token **value** question (F3) |
| **Secondary text tier — the held site** | The replyhead's tier becomes a named constant | — |
| **Secondary text tier — the other 13** | — | **Docket row.** Normalising them re-skins `shell/` and `debate/composer/` uninspected |

**The safety property, proved rather than asserted.** After this pass:

- PD-2-08's ruling = **one line**, `globals.css`, the `--ring-active` definition.
- OQ-2's ruling = **one line**, the named replyhead constant.

The exit criterion names those two lines. That is the property the binding condition was
written to secure, and it is secured — at a fraction of the blast radius the literal
reading would incur.

**This is a departure from the docket's literal text and is recorded as one.** If the
founder wants the full 14-site normalisation, it is its own task against POLISH.4's
inspection, not a rider on a primitive pass.

### D9 · The ladder joins rung 1's mechanism — CSS custom properties — not a React host.

Rung 1 is already `--hairline: 1px solid var(--color-n2)` at `globals.css:166`. Rungs 2 and
3 are per-site literals. Making them React presets would put one ladder in two mechanisms
and leave `--border-strong` — a ratified token naming this exact concept with **zero
consumers** — still orphaned.

```css
--border-hero: 1px solid var(--color-n3);      /* rung 2 — FOUNDER-RULED, PD-2-07 */
--ring-active: 1.5px solid var(--color-n4);    /* rung 3 — ruling OPEN, PD-2-08  */
```

Consumers become `[border:var(--border-hero)]` × 3 and `[outline:var(--ring-active)]`
`outline-offset-[3px]` × 1. **The emitted CSS is byte-identical**; only the indirection is
new. The whole ladder then reads as one object in one file, next to `--hairline`.

⚠ **HALT-GATED on the monochrome guard.** `tokens-monochrome.test.ts` reddens on *a new
colour token or a changed hex* (H8). These add **no hex** and **no colour** — they are
composites over already-ratified ramp tokens, exactly like `--hairline` and `--avatar-ring`.
**Verify the guard's predicate BEFORE writing the CSS.** If it treats any new custom
property as a new token: **do not relax the guard** (H14). Fall back to D9-alt.

**D9-alt (contingency, pre-ratified):** a TS const map in
`src/components/discovery/` — the `StatLine.SIZE` / `PriceBar.ROW` / `SideBadge.CHIP`
mechanism, already used three times in this codebase. Same one-line-ruling property, no
`globals.css` touch. Take it without a round-trip if the guard reddens; record which was
taken and why.

### D10 · `--border-strong` is left alone and docketed.

A ratified token aliased to n2 with zero consumers, referenced only in the prose at
`DiscoveryGrid.tsx:37` explaining why it was not used. Retiring it or re-pointing it is a
token **value** decision (F3, CI-pinned). D9 gives the ladder real named consumers, which
makes the question answerable later; answering it now is out of scope. **Docket row.**

### D11 · Two PRs, serial. Never parallel.

| | Contents | Why separated |
|---|---|---|
| **PR-A** | D2 · D3 · D4 — `MarketThumb`, three adoptions, both `alt`s | A **production defect** with a dated ordering constraint: it must land before `STAGING-FIXTURE-DISCOVERY-SHAPE` (2026-09-05), because repairing the fixture first would hide it |
| **PR-B** | D1 · D5–D10 · D13 — the seam pass, the token work, the doc corrections, the register touch | Carries a halt-gated `globals.css` edit (D9) and a departure ruling (D8) |

**Decoupling, not diff size.** A single PR holds a production fix hostage to seam work
that can halt. Cost is one extra Gate C read; that is the right price.

**Serial** — one open at a time, `POLISH-TRACKER.md` §5's bisect rule. PR-B rebases on PR-A.
⚠ Both touch `HeroPanels.tsx`; expect a rebase, and **re-verify the branch still exists
remotely before pushing after PR-A merges** (§9.4 — it has bitten twice).

### D12 · Register IDs: `PD-3-03` and `PD-5-01`. Nothing in ADDITIONS is touched.

The `SideBadge` preset adoptions have **no register row anywhere** — recon confirms the only
`SideBadge` rows are PD-2-20 and CC-6, both `fixed`. Mint two, in PR-B:

| ID | Row | Owner | Status |
|---|---|---|---|
| **`PD-3-03`** | d5 adopts `SideBadge` `detail` (10px). Seam landed at PRIMITIVES-2; call site is `.3`'s | POLISH.3 | routed / open |
| **`PD-5-01`** | Profile adopts `SideBadge` `profile` (8.5px). ⚠ Corrects the `.6` routing in `badges.tsx` and `DISCOVERY-COMPLETE.md:70` — that mockup is `.5`'s | POLISH.5 | routed / open |

**No collision exists.** `POLISH-register-ADDITIONS.md`'s placeholders are the literal
strings `PD-3-nn` / `PD-5-nn` with no concrete numbers; allocation happens at apply time
against the then-current high-water. After this PR that mark is `PD-3-03` / `PD-5-01`, so
REGISTER-APPLY allocates from `PD-3-04` / `PD-5-02`. **Do not touch that file.** Note the
new marks in PR-B's body so the next allocator reads them.

### D13 · RR-4's disposition cell → `accepted-divergence`. One cell.

Ratified P12, 2026-08-10. Live cell reads `routed`, status already `closed`. Rides PR-B's
register touch. No other cell moves.

⚠ **Do not attempt to resolve X-5** — that `RR-4` names two different findings depending on
whether you read the log or the register is recorded at `POLISH-TEMPLATE.md:88` S-4 as
needing a ruling. Changing one cell does not touch it. **Docket row.**

### D14 · Reviewer depth, and what `@code-reviewer` is specifically tasked with.

Match PRIMITIVES-1: `@code-reviewer` on both PRs, **no `@security-auditor`**, **no
`@test-writer`**. Every finding reported **individually**, at the severity the reviewer
assigned it, with `file:line` and a disposition. Never *"a CRITICAL plus two HIGHs"* — a PR
was once cleared with two unaddressed HIGHs because of exactly that phrasing.

Four questions it must answer **as separately-stated points, never a bare PASS**:

1. **Per-consumer zero-delta.** For each of the 12 `CHIP.base` sites and each of the 3
   thumb sites: byte-identical, or a named intended delta? ⚠ **The number is 12, not the 8
   in the side-badge docblock** — the four C4/C4b-minted sites pass no `size` and do ride
   `CHIP.base`.
2. **Both poles.** Are `detail` and `profile` asserted at a **YES and a NO** instance? A
   YES-only test passes on an inverted NO panel, which is how the last inversion survived a
   full PR with tests.
3. **The pole guard's inventory.** Is `PERMITTED_FILES` unchanged, and is the predicate
   unchanged? Set equality breaks in **both** directions — extracting a side-keyed
   expression out of a file drops it from the inventory and reddens exactly as hard as
   adding one.
4. **`MarketThumb`'s error path.** Does it fire on a real `onError`, and does it render the
   consumer's own fallback node rather than an invented one?

---

## §4 · The two departures, stated plainly

**§4.1 — Item 4 is not built because it is already built.** D1. Three committed documents
disagree with the tree; the tree wins and the documents are corrected.

**§4.2 — Item 5 is built at reduced scope.** D8. The binding condition's *safety property*
is delivered and proved. Its *literal scope* is not, because measurement showed the literal
scope buys nothing the reduced scope does not, at 14 sites of cost across two uninspected
surfaces. **Recorded as a departure, not absorbed as an interpretation.**

---

## §5 · PR-A — `MarketThumb`

**Branch:** `fix/primitives-2-market-thumb`. ⚠ H11: if `git branch --show-current`
disagrees after checkout, HALT — a colliding `checkout -b` is a no-op that leaves HEAD on
`main`.

**Commits, ordered:**

| # | Commit | Contents |
|---|---|---|
| 1 | `test: RED — a 404ing image has no degradation path` | The failing test, **captured RED before any fix is written**, its RED output pasted into the commit body (H9's single exception). ⚠ H15: a new guard green on first run is a **vacuous pass** |
| 2 | `feat: MarketThumb owns null · error · loaded` | The primitive. No consumer touched yet |
| 3 | `fix: three Discovery image sites adopt MarketThumb` | `MarketCard.tsx`, both `HeroPanels.tsx` sites. Includes D4's two `alt=""` |
| 4 | `test: per-consumer zero-delta baselines` | The three captured baselines + the pole/geometry assertions |

**Files touched:** `src/components/discovery/MarketThumb.tsx` (new) ·
`src/components/discovery/MarketCard.tsx` · `src/components/discovery/HeroPanels.tsx` ·
`tests/unit/discovery/render/market-thumb.test.tsx` (new). **Nothing else.**

---

## §6 · PR-B — the seam pass

**Branch:** `chore/primitives-2-seam`, cut from `main` after PR-A merges.

**Commits, ordered:**

| # | Commit | Contents |
|---|---|---|
| 1 | `refactor: SideBadge resolves its preset by map lookup` | D7 alone. Zero new presets. **Proves the 12-site zero-delta in isolation**, before any value is added |
| 2 | `feat: SideBadge detail + profile presets` | D5, D6. Two `CHIP` entries, the union widened, the docblock's `.6` → `.5` correction |
| 3 | `refactor: the emphasis ladder becomes two named tokens` | D9, or D9-alt. Guard verified **first** |
| 4 | `refactor: the replyhead tier becomes a named constant` | D8's text half — one site |
| 5 | `docs: correct three stale mix-blend references; two register rows; RR-4` | D1, D12, D13 |

**Commit 1 before commit 2 is load-bearing.** It isolates the mechanism change from the
value change, so the zero-delta proof is read against a diff that adds no values, and a
reviewer can see the 12 sites are untouched without also parsing two new presets.

---

## §7 · Out of scope — halts if reached

**Named out-of-scope rows** (H16 fires on any of these):

- **CC-9** — `(admin)/…/ReviewFeed.tsx:102-104`. Routed to an ADMIN PASS by the register.
  Consolidating admin chrome onto a participant primitive is an admin-surface decision
  (CLAUDE.md §3).
- **RR-3** — the live INV-3 inversion at `composer/ReplySplitBar.tsx:64,67`. **POLISH.3/.4's.**
  Do not fix it and do not tidy that file.
- **R2-KEY-OPACITY** — the R2 object key embeds `users.id`. ⚠ **It sits on the exact render
  path PR-A touches**, which makes it the single most likely thing to get absorbed by
  accident. Docketed 2026-09-05. Do not touch.
- **STAGING-FIXTURE-DISCOVERY-SHAPE** — the fixture set is md5-pinned. PR-A must land first.
- **REGISTER-APPLY** — the 13 unapplied rows. D12 touches none of them.
- **The other 13 micro-label sites** — D8.
- **Any surface parity work**, any token **value**, anything under `src/server/**`, any
  read-model field, any handler.

**Per-task halts, added to the base set:**

| # | Halt |
|---|---|
| **P2-H1** | ⛔ `tokens-monochrome.test.ts` reddens on D9's tokens → take **D9-alt**, never relax the guard |
| **P2-H2** | ⛔ `side-pole-binding.test.ts` reddens **in either direction**. `PERMITTED_FILES` is a decision, not a maintenance chore (H14) |
| **P2-H3** | ⛔ Any edit lands at `HeroPanels.tsx:274-275` — the `supportPole` / `counterPole` expressions. Touching them drops the file out of the guard's inventory and reddens set equality |
| **P2-H4** | The tier-4 mockup's number for `.sidechip.md` (d5) or `.sidechip.sm` (Profile) disagrees with `DISCOVERY-COMPLETE.md:66`. **The mockup wins; report, do not resolve** |
| **P2-H5** | The zero-delta proof covers fewer than **12** `CHIP.base` sites |
| **P2-H6** | A `MarketThumb` variant would need geometry the consumer cannot pass — the D2 split has failed and the design must come back |
| **P2-H7** | Any new guard is **green on first run** (H15) |

---

## §8 · Proof discipline

**§8.1 — Zero-delta is per consumer, byte-identical, and enumerated.**

The precedent is `tests/unit/discovery/render/price-bar-presets.test.tsx`:

- The baseline is a **literal captured from the pre-change component at a named SHA**, with
  the byte count and the consequence stated in the docblock. **Not hand-written.**
- The assertion is `expect(container.innerHTML).toBe(BASELINE)` — **full-string equality**,
  not `.toContain`. Class *order* is caught. A first draft once emitted identical classes in
  a different order and passed by eye.
- **A second, separate assertion pins the ABSENCE of the new mechanism** on the untouched
  surface (`detail-carries-no-data-size-attribute`). This is the half a naive "same classes"
  test omits.

⚠ **Two proof shapes exist on `main` and the choice is forced, not stylistic.** `PriceBar`
uses full equality because it emits its own classes. `SideBadge` uses a **suffix pin**
(`OWNED_TAIL`) because shadcn's `badgeVariants` base sits to its left and pinning that would
redden the suite on an unrelated shadcn bump. **Use each primitive's existing shape.** Do
not migrate `SideBadge` to full equality; do not weaken `MarketThumb`'s to a suffix.

**§8.2 — Re-count at PR HEAD, never at plan time.** `SideBadge`'s inventory went 9 files →
13 sites inside one PR. Every number in §2 is a **plan-time** number and must be
re-measured at each PR's head.

**§8.3 — Non-vacuity.** N1 alive-check before any set assertion · N3 a positive control
beside every absence assertion · N5 set equality, never a count · **N8: a promised
assertion delivered vacuously is worse than an absent one, because it reads as discharged.**

**§8.4 — A green suite is not a gate.** Three surfaces, three green suites, three real
defects. Gate C is a web diff-read before merge on **both** PRs. **Diffs travel as UPLOADED
FILES** — CC writes to `~/Downloads`, the operator uploads. Never pasted terminal output.

---

## §9 · Docket rows to mint

Each gets a `docs/parked.md` row **in the same commit** that names it — the standing rule.

| Row | What |
|---|---|
| **MICRO-LABEL-TIER** | 13 micro-label sites across `shell/` and `debate/composer/` with 4 sizes × 4 trackings × 2 weights × 5 tiers and no shared import. **Route to POLISH.4's inspection**, not to a primitive pass. D8 |
| **BORDER-STRONG-ORPHAN** | A ratified token aliased to n2 with zero consumers. Token-**value** question, F3-blocked. Answerable once D9 gives the ladder real consumers. D10 |
| **RR-4-ID-COLLISION** | `RR-4` names two different findings depending on log vs register. `POLISH-TEMPLATE.md:88` S-4. **Needs a ruling, not an edit** |
| **G1-RECON-TEMPLATE** | PRIMITIVES-1 minted seven recon-template requirements — *replace the render census with a consumer census* — named only in that one log, landed nowhere. Recon R6 performed the census manually because of this |

---

## §10 · Merge

`@code-reviewer` on both PRs, answering §3 D14's four questions as separately-stated points.
**NO `@security-auditor`.** **Gate C — a web diff-read before merge — on both, non-optional.**
Squash-merge to `main`. Author `Zugzwang/world <zugzwangworld@proton.me>`, SSH-signed, no
`Co-authored-by`.

⚠ **After PR-A merges, re-verify the branch still exists remotely before pushing PR-B.**
An auto-deleted branch got recreated carrying an already-merged duplicate. Twice.

⚠ **`git add -A` destroys session logs.** Stage explicitly.

**On close:** staging advance (it is currently 4 docs-only commits behind), PK refresh
table, and the tracker note that PRIMITIVES-2 is closed and `.7a` is the next machine run.
