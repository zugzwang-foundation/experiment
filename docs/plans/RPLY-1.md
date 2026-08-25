# RPLY-1 — the reply surface: six refinements

**Task:** RPLY-1 · **Mode:** autonomous overnight (doctrine v1.0)
**Base:** `origin/staging` @ `7021d22` · **Branch:** `feat/rply-1-reply-surface`
**PR target:** `origin/staging` (measured — see §0)

---

## 0 · Ground, measured

| Ref | SHA |
|---|---|
| `origin/main` | `c49138d218c4a30ab12f1a5a9ef98a76b77d519b` |
| `origin/staging` | `7021d2218c77ccdb87a86ce99f1845257d9b6df7` |
| `origin/verify` | `b40a18b7e110516989ff6ca827c0ef91f27cef59` |

`verify` **is** an ancestor of `staging` (0 ahead / 8 behind); their
`src/components/debate/` trees are byte-identical. `main` ↔ `staging` diverge
4 / 44, with `src/components/debate/` differing by 20 files / 1841 insertions.
PRs #408–#414 all carry `base=staging`; #404/#407/#409/#415 carry `base=main`.
⇒ **the UI change sets land through `staging`; the PR targets `staging` and no
retarget is owed.**

---

## 1 · Slices, ordered. Exit condition = full suite green.

| # | Refinement | Files | Reviewer-bearing |
|---|---|---|---|
| S1 | R1 composer column | `DebateView.tsx` + 2 test amendments + G1 | ✅ all three |
| S2 | R2 history ladder | `DebateView.tsx`, new `post-param-client.ts` + G3/G4 | ✅ all three |
| S3 | R3 one notice slot | `BetComposer.tsx` + G5 | ✅ code-reviewer, security-auditor |
| S4 | R4a + R4b headers | `BetComposer.tsx`, `DebateView.tsx` + G6 | ✅ code-reviewer |
| S5 | R5 split-bar port | `composer/ReplySplitBar.tsx` + G7 | ✅ code-reviewer |
| S6 | R6 reply image cell | `ReplyCard.tsx` + 2 test amendments + G8 | ✅ code-reviewer |

**S1 and S2 lead** — most ratification content, freshest reviewing attention.
S5/S6 are leaves: if anything comes back CARRIED it should be one of those.

---

## 2 · Per-slice detail

### S1 · R1 — the composer opens in the column opposite the BET

**Measured defect.** `DebateView.tsx`, post-arm `.map`:
`const composerColumn = opposite(selectedPost.sideAtPostTime);` — the RELATION
is not an input, so Support and Counter cannot produce different columns.

**Build.**
```ts
const resultingSide = openReply !== null ? deriveReplySide({…}) : null;
const composerColumn = resultingSide === null ? null : opposite(resultingSide);
```
⚠ **Declaration order MUST swap** — `composerColumn` is currently declared
ABOVE `resultingSide` (measured: 757 vs 758). Leaving the order alone is a TDZ
`ReferenceError` at runtime that jsdom render tests would not necessarily reach.

`hostsComposer = openReply !== null && side === composerColumn` unchanged — a
null `composerColumn` matches no side.

**The matrix (G1):**

| parent | relation | bet side | composer column |
|---|---|---|---|
| YES | Support | YES | NO |
| YES | Counter | NO | YES |
| NO | Support | NO | YES |
| NO | Counter | YES | NO |

**Test amendments.**
- `tests/unit/composer/render/side-identity.test.tsx` — the literal
  `toContain("const composerColumn = opposite(selectedPost.sideAtPostTime)")`
  pin moves. **`opposite(` count stays 3** (`opposite(openSide)` ×2 +
  `opposite(resultingSide)`), so `toHaveLength(3)` is UNCHANGED.
  ⛔ `not.toContain("side={opposite(")` **stays** (WALL). Docblock corrected in
  place to the sharper rule: the column is opposite the **BET**, not the parent.
- `tests/unit/debate/header-mirror.test.ts` — the `hostsComposer` regex and the
  `showControls={!hostsComposer}` pin (the latter also moves at S4/R4b).

**Free repair (B4).** `engaged={resultingSide === side && side !== composerColumn}`
is `false` for EVERY Counter today (proof: Counter on a YES parent ⇒
resultingSide NO, composerColumn NO ⇒ `side !== composerColumn` false on NO and
`resultingSide === side` false on YES). After the fix it fires on the bet's own
column. Measured before and after.

### S2 · R2 — the history ladder

**Measured defect.** `syncPostParam` uses `history.replaceState` from all three
call sites (`enterPost`, `replyToPost`, `exitPost`), so `history.length` never
grows and browser/header Back leaves `/m/[slug]`.

**Build.**
- `enterPost` / `replyToPost` → `history.pushState`
- `exitPost` → `history.back()` (the stack unwinds rather than growing)
- a `popstate` listener syncing `selectedPostId` / `openReply` / `openSide`

**⚠ THE BRIEF'S PREMISE IS UNBUILDABLE AS WRITTEN, and the intent is buildable.**
The brief says the listener must resolve the ordinal "through the SAME validated
path the server uses (`resolvePostParam`)". `resolvePostParam` is
`src/server/debate-view/resolve-post-param.ts`, imports `server-only`, and takes
a `DbClient` — **a client listener cannot call it**, and the WALLS make it
read-only for this task besides.

**What makes a client-side resolution exact rather than a bypass:**
`load-debate-view.ts` assigns `ordinal` as "1-based rank by (created_at, id)
ascending over ALL top-level comments, **removed INCLUDED**" — the *same domain
in the same order* as `resolvePostParam`'s query. Removed posts keep their slot
in `model.posts` and carry their ordinal on both union variants. So
`posts.find(p => p.ordinal === n)` returns exactly what the server would, and
the client's copy is *strictly safer* because the removed variant carries no
body/author at the type level.

The client path therefore reproduces the cold path's three refusals:
1. shape gate `^[1-9][0-9]{0,4}$` (byte-identical to the server's)
2. no post with that ordinal → market arm
3. `target.removed` → market arm

**Drift control.** The regex is duplicated (the server file is walled). A new
guard reads BOTH files and asserts the two source literals are byte-identical,
so divergence reds rather than shipping silently (O-1: structural beats
procedural).

**⚠ Pre-ruled:** composer-open gets NO history entry. Two rungs only.
ESC-closes-composer verified present (`BetComposer` `useEffect` on `keydown`,
in-flight guarded) — nothing owed.

### S3 · R3 — one notice slot

**⚠ THE BRIEF'S COUNT IS WRONG AND THE FIX IS UNAFFECTED.** The brief says three
conditional children each add a box plus a 12px gap. **Only two are children of
the `flex flex-col gap-3` `<section>`** — the 429 banner and the C2 strip. The
over-cap strip is nested inside the footblock (`<div className="mt-auto">`) and
contributes `mt-1.5` (6px), not a 12px gap. `<ErrorStrip>` is a third
conditional section child the brief does not name.

**Build.** One notice slot rendered **in place of the TO-WIN row** inside the
AMOUNT/TO-WIN block. All three conditions write into it; the three existing
strips are removed from their current positions. Net flex children of
`<section>`: **−2**.

**Precedence (ambiguity, ruled):** `floorAbove` → `countdown` → `overCap`.
C2 is SPEC.1 §16.2-required and describes a total block; a transient 429 must
not displace a spec-mandated message. `overCap` and `floorAbove` are provably
mutually exclusive (clamp-to-spendable ⇒ clamped ≤ spendable < floor ≤ 50 <
`BET_MAX_STAKE`).

**⚠ Contrast, measured not assumed.** The notice lands INSIDE the `dimmed`
wrapper (`opacity-(--state-disabled-opacity)` = 0.5). `text-n5` #989898 over
#212121 is 5.61:1 undimmed but **2.48:1 at 0.5** — a real regression. `text-ink`
#fafafa at 0.5 composites to ≈4.92:1, above the 4.5 floor. ⇒ the notice uses
`text-ink`.

**Constant height** across all four states (none / 429 / floor / over-cap) —
pinned to the measured tallest, so the section's height cannot move at all.
⛔ The C2 sentence ships VERBATIM from `c2Sentence`; it is never shortened.

### S4 · R4a + R4b

**R4a (measured).** Reply variant renders a two-child flex column at
`text-[13.5px] font-bold` plus an unclamped `postTitle` subtitle; fresh-post is
one leaf span at `text-sm font-semibold`. ⇒ reply title becomes a single leaf
span at `text-sm font-semibold text-ink`, wording unchanged
(`Support|Counter <author>'s argument` — canon §6). `postTitle` becomes an
orphan of this change and is removed from the prop type and the one call site
(4 references total, no test consumers).
⛔ The THIRD state is preserved and pinned (G6): `authorPseudonym === null`
(masked parent) still falls back to `Place your Đ BET` on a `kind="reply"`
composer.

**R4b (measure first — OVN-O4).** `PositionStrip`'s ONLY `showControls`
consumer is the position-readout `<Link>`; its own docblock states there are no
Buy/Sell buttons on this strip at all. So the composer-created asymmetry is
exactly one `<Link>` → plain-text swap, reachable only when the viewer is signed
in AND holds a position on the hosting column's side. Enumerate all three
composer states × both columns by render before acting; if the ruled outcome
already holds, pin it and report "no change needed."

### S5 · R5 — port the split-bar geometry

PORT, do not unify. Lift the write exclusion on `composer/ReplySplitBar.tsx`
for this task only. Target = `AggregateFooter`'s staging render.

⚠ **The brief's five bullets omit one thing they depend on.** The `h-6` centring
box only aligns under `items-start`; `AggregateFooter`'s own comment records
that `items-center` was tried and lands ~2px off. `ReplySplitBar`'s row is
`items-center gap-3`. Implementing bullet 1 without the row change ships the
2px misalignment the box exists to remove. ⇒ row becomes `items-start gap-2`,
logged as an addition with that arithmetic as its reason, and measured.

⛔ `AggregateFooter` MUST NOT MOVE (G7). Colour is NOT ported (`text-n5` stays);
the bullets are geometry.

### S6 · R6 — the reply image cell

`ReplyCard`'s root is `min-h-0 flex-1` but all three children are content-sized,
so leftover height lands after the last child. `PostCard` has two absorbers
`ReplyCard` lacks; R6 gives it the image cell (not the footer — both the reply
counter and the split bar are ALREADY absent, so the cell is the whole change).

**Test amendments (found in recon, before any code):**
- `comment-image::a-reply-with-an-image-mounts-it` asserts
  `max-h-[var(--imgmax)]`; under `fill` that becomes `max-h-full`. **Reds.**
- `comment-image::a-reply-without-one-mounts-nothing` still PASSES (the
  placeholder is a `<div>`, `querySelector("img")` is null) but its **name and
  docblock become false**. Corrected in place + the placeholder asserted (G8).
- The removed-reply test gains a placeholder-absence assertion, mirroring
  `PostCard`'s masking argument.

⚠ Pre-ruled: `PostImagePlaceholder` reused VERBATIM including
`POST IMAGE · 640:586`. No "REPLY IMAGE" variant is minted.

---

## 3 · Guards

| G | Asserts | Rejects |
|---|---|---|
| G1 | the four-row column matrix | any column that is a function of the parent's side alone |
| G2 | badge/column independence | **EXISTS** — `side-identity.test.tsx`'s `not.toContain("side={opposite(")`. Cited, not duplicated. |
| G3 | enter grows `history.length`; exit does not | `replaceState` on enter |
| G4 | unresolvable / removed `?post=` falls back on popstate | a listener indexing a comment list from the raw param |
| G5 | no added section flex child in any of 4 states; `c2Sentence` verbatim | a fourth strip; a reworded C2 |
| G6 | masked-parent fallback still renders `Place your Đ BET` | a subtitle removal that takes the masking branch with it |
| G7 | `AggregateFooter` unchanged + parity with the port | a port that moves the market card |
| G8 | `ReplyCard` renders the image cell + placeholder when `imageUrl` is null | a card whose only absorber is the body text |

Every guard verified by reverting its fix and watching it red (OVN-V2); the
assertion message is quoted in the report. Every negative assertion carries a
positive control (OVN-V1).

---

## 4 · Baselines

| B | What | Layer | Why that layer |
|---|---|---|---|
| B1 | full suite pass/fail/skip | `pnpm vitest run` | cross-suite floors the named gates miss |
| B2 | `tests/unit/design/` incl. the 11-token census | same | CI-enforced; S5/S6 touch class strings |
| B3 | composer `scrollHeight` vs `clientHeight` on `[data-testid="column-scroll"]`, 4 states × 2 viewports | **LOCAL dev server + LOCAL db, real browser** | jsdom performs no layout — a unit test cannot prove a fit |
| B4 | `engaged` on the Counter path | render | it is R1's free repair |

⛔ B3 never runs against staging. If the local server will not come up, the
figure is reported as DECLARED (class arithmetic) and labelled as such.

---

## 5 · Reviewer cascade — in order, effort max

1. `@test-writer` — G1–G8. Hunt: a guard that passes against the fixed code
   because it asserts something adjacent to the defect. Interrogate G1 — a
   matrix test can pass by reading the BADGE instead of the COLUMN.
2. `@code-reviewer` — every touched file. Hunt: the TDZ hazard from reordering
   `composerColumn`/`resultingSide`; and any place S3 silently changed WHICH
   condition renders WHICH message.
3. `@security-auditor` — S2 only + any S3 gating change. Hunt: a client
   `popstate` handler reaching a removed/masked comment the cold path refuses;
   and confirm no submit-gating predicate was weakened.

⚠ F-11: a fix to an S1 or S2 finding gets THAT reviewer re-run scoped to the fix.

---

## 6 · Walls honoured

No `staging:rebuild`, no seeder, no remote write. No push to `staging`/`verify`/
`main` (upstream unset at setup — see report §3.5). No write at staging or prod.
No `drizzle/`, no migration. No prescriptive-doc edit. No weakening of
`deriveReplySide` · `isEntryDisabled` · `assessAmount` · `floorFor` ·
`submitDisabled` · `computeSplitBar` · `displaySplitTotal` · `resolvePostParam`.
No PR merge, no auto-merge.
