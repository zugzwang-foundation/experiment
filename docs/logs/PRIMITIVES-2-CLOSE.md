# PRIMITIVES-2 — close-out session log

**Task:** close-out bookkeeping for PRIMITIVES-2. Not a new task.
**Ground:** `origin/main` = **`0ff2733`** (PR #318's squash-merge). Branch
`chore/primitives-2-close`.
**Ritual:** docs only. **No reviewer pass**, none required.

**Merges of record:**

| PR | Squash SHA | Merged |
|---|---|---|
| **#317** — PR-A, `MarketThumb` | **`143380b`** | 2026-08-11T08:01:19Z |
| **#318** — PR-B, the seam pass | **`0ff2733`** | 2026-08-11T11:28:30Z |

**Tree identity proved before anything was flipped:** `git diff 1689ea9
origin/main` → **EMPTY**, and the guard lines are present on `main`
(`--border-hero`/`--ring-active` at `globals.css:177-178`, `CHIP[size ??
"base"]` at `badges.tsx:162`). A squash merge can land a tree that is not the
reviewed one; this rules it out.

⚠ **This log's own diffstat is DECLARED EXEMPT rather than reported.** Per
plan §11 `§8-P1`, a log's diffstat counts a tree in which the log does not yet
exist and is unmeasurable from inside the commit that writes it. The ratified
options are *measure at PR head and amend* or *declare the exclusion in the
line itself*; **this log takes the declaration.** Every other count below was
re-verified at `origin/main` `0ff2733` post-merge.

---

## 1 · The exit-criteria discharge — plan §1, all nine

Evidence, not ticks. Verified at post-merge `main`.

| # | Criterion | Discharge | Evidence |
|---|---|---|---|
| **1** | A 404ing presigned URL degrades to the site's own placeholder at **all three** Discovery image sites | **MET** — PR-A (`143380b`) | `src/components/discovery/MarketThumb.tsx` (180 lines). Three mounts: `MarketCard.tsx:48`, `HeroPanels.tsx:87` (hero thumb), `HeroPanels.tsx:206` (hero POST image). Behaviour pinned by `tests/unit/discovery/render/market-thumb.test.tsx` — **30 tests, green** |
| **2** | Exactly **one** component owns null · error · loaded. No site patches its own `<img>` | **MET** — PR-A | One `<img>` in the tree's Discovery image path, inside `MarketThumb`; the three consumers pass `src`/`alt`/`className`/`fallback` and own no state. The `biome-ignore` for `noImgElement` is on the primitive's single `<img>` — three suppressions became one |
| **3** | Both market thumbs carry `alt=""` | **MET** — PR-A, D4 | `MarketCard.tsx:50` · `HeroPanels.tsx:89`. Matches the hero POST image's already-ratified `alt=""` at `:211`. ⚠ **The ONE intended delta in PR-A**, on record so a reviewer does not flag it |
| **4** | `SideBadge` can **receive** a d5 and a Profile preset; a fourth union member cannot silently fall through — resolution is a **map lookup**, not a binary ternary | **MET** — PR-B commits 1 (`ab56d88`) + 2 (`5485f6f`) | `badges.tsx:162` is `CHIP[size ?? "base"]` with `base` a real key; `:147` is `size?: "hero" \| "detail" \| "profile"`. A member added without a `CHIP` entry is a **compile error**, not a wrong render |
| **5** | **The two held values are each a ONE-LINE change in ONE named place, proved by naming the line** | **MET — see §2. Both lines named, quoted, and stress-tested** | §2 below |
| **6** | Every existing render byte-identical, proved per consumer, except the two ratified `alt` deltas | **MET** — PR-A + PR-B | 17 consumers proved: 12 `CHIP.base` (census by set equality, `side-badge.test.tsx`), 4 ladder sites, 1 replyhead (full-string equality at both poles, `hero-panels.test.tsx`). `@code-reviewer` independently re-measured all three inventories: **zero intended and zero unintended deltas** beyond D4's two `alt`s |
| **7** | `side-pole-binding.test.ts` green **without any change to `PERMITTED_FILES` or its predicate** | **MET** — PR-B | The file is **absent from `git diff --name-only f51a9dd..origin/main`** — untouched across both PRs. Green, 4 tests. `badges.tsx` stays in the inventory via its `side === "YES" ? …` expression; the ternary PR-B removed keyed on `size`, which fails the guard's `/side$/i` leaf test and was never an inventory member |
| **8** | `tokens-monochrome.test.ts` green. No token **value** changed, no hex added | **MET** — PR-B | The test file is untouched across both PRs; green, 8 tests. **No hex added to `globals.css`**: the only `+` line containing one is *prose inside a comment* (`"a hard-coded #545454 here would sail past it"`), not a declaration. `--border-hero`/`--ring-active` are composites over `var(--color-n3)`/`var(--color-n4)` |
| **9** | No DDL, no migration, no `EVENT_TYPES` value, no ADR, no SPEC edit, nothing under `src/server/**`, no `DebateViewModel` field | **MET** — both PRs | `git diff --name-only f51a9dd..origin/main` filtered to `^src/server/|^drizzle/|^docs/adr/|^docs/specs/` returns **nothing**. ADR ceiling still **0036** |

---

## 2 · Criterion 5 — the two lines, named

**This is the criterion the task existed for**, and the binding condition
behind it. Both rulings are a one-line edit in one named place, at
`origin/main` `0ff2733`.

### PD-2-08 — the active carousel ring

**`src/app/globals.css:178`**

```css
	--ring-active: 1.5px solid var(--color-n4); /* rung 3 — ruling OPEN, PD-2-08 */
```

The register row scopes PD-2-08 to the ring's **value** — *"the active carousel
ring was the same value as every card's resting hairline (both n2)"*, built to
the V7 ladder **n2 grid < n3 hero < n4 ring**. Width, style and colour all sit
inside this one declaration, so a ruling on any of them is this line.
Sole consumer: `DiscoveryGrid.tsx:52`.

⚠ **Stress-tested, and one boundary is worth stating.** `outline-offset-[3px]`
is a **separate class at the call site**, not part of the token. A ruling on the
ring's *value* is one line; a ruling that also moved the **offset** would be a
second line in a different file. **PD-2-08 as filed rules on the value**, so the
criterion holds as written — but it holds for the ruling that exists, not for an
arbitrarily widened one.

### OQ-2 — the replyhead text tier

**`src/components/discovery/HeroPanels.tsx:52`**

```ts
	"text-[9.5px] font-bold tracking-[0.12em] text-n4 uppercase";
```

OQ-2 is `text-n4` vs `text-n6` — one token inside this string. The constant is
declared across two physical lines (`:51` is `const REPLYHEAD_TIER =`, wrapped
by Biome); **the edit is line 52 alone.** Consumed once, at `:228`.

**Neither ruling requires more than one line. The binding condition is met.**

---

## 3 · What landed in this close-out

- **Plan `§8-P1`, two fold-ins**, both additive — nothing else in the record
  moved. (a) the "Applied in PR-B" sentence now says mutations **O and P are
  commit 6's**, so a reader meeting "mutation O" in the three-axis bullet can
  locate it. (b) the **log-diffstat carve-out**, web-authored and committed
  verbatim.
- **`docs/parked.md`** — the `## PRIMITIVES-2` row **CLOSED**, carrying both
  PRs and both squash SHAs, and a table of **what did NOT land and where it
  went**. A closed row that does not say what left it is how a later reader
  re-opens settled scope.
- **`docs/polish/POLISH-TRACKER.md`** — §1 `.7a` is **RUN NEXT**; §4's
  PRIMITIVES-2 row **CLOSED** with both SHAs and the seam-only qualifier; §5's
  sequence marks both predecessors closed; §5's binding-condition block now
  records **MET**, with the two lines named and the mechanism split (CSS
  custom properties for the ladder, a TS constant for the text tier) stated so
  it is not mistaken for a single uniform preset host.

---

## 4 · Staging — ADVANCED and verified

**It was 7 commits behind, 0 ahead** — behind, not diverged. ⚠ **No longer
docs-only**: 6 `src/` files differed, so the pre-PR-A "4 docs-only commits
behind" is superseded.

All three `deploy-pipeline.md` §2.5 preconditions proved before pushing:

| Check | Result |
|---|---|
| (a) tree identity — `git diff 1689ea9 origin/main` | **EMPTY** |
| (b) fast-forwardability — `git log origin/main..origin/staging` | **EMPTY** |
| (c) migration delta — `drizzle/migrations/ src/db/` | **EMPTY → a §2.5 fast-forward, not a §3 sequenced deploy** |

`git push origin origin/main:staging` → `71f4d42..0ff2733`.

- `staging-migrate.yml` run `31487110911` — **success**, `headSha` confirmed
  `0ff2733` **before** reading the verdict.
- The migrate log shows **exactly the two idempotent NOTICEs** (`42P06`,
  `42P07`) and **no DDL** — the no-op precondition (c) predicted. Expectation
  and log agree.
- **PRIMARY GATE — `/api/health`:** `canary` = `0ff2733dd07eec96b87797761d4cf86b183a826e`
  (bare 40-char, equals `origin/main`), `env` `"staging"`, `db` `"ok"`,
  **`migrations` `"ok"`**. The health endpoint is the authority, not the
  migrate exit code (drizzle-orm #5769).

### ⚠ DP.2 — REPORTED, NOT ACTED ON

**Prod promote remains BLOCKED, and PRIMITIVES-2 did not touch either
blocker.** This is a founder decision, not a close-out step.

1. **PRIMITIVES-1's partial staging verify** (`docs/logs/PRIMITIVES-1.md` §6,
   and its explicit *"Do not start DP.2"* at `:163`). Confirmed there: header
   balance, StatLine, the D4 character count, the multiplier exemption, `Đ BET`
   copy, the avatar ring. **Still BLOCKED: the §23 tile row and any composer Đ
   figure ≥ 1000** — every profile with enough data throws
   (`ProfileTradeStreamError`, `episodes.ts:168`), and the three that render
   are all sub-thousand. **Blocked on DATA, not code** — `SP-1`. PRIMITIVES-2
   changed nothing under `src/server/profile/`, so this is untouched.
2. **POOL-2** (`docs/parked.md:26`) — `BETTER_AUTH_SECRET` may differ between
   Doppler `stg` and Vercel `staging`; **operator-owned, before DP.2**, and
   unresolvable from a CC session because Vercel env values are write-only once
   set.

---

## 5 · Register high-water marks on record

**`PD-2-34` · `PD-3-03` · `PD-5-01`.** REGISTER-APPLY allocates from
`PD-3-04` / `PD-5-02`. `POLISH-register-ADDITIONS.md` remains **untouched** by
this task and by PR-B — its placeholders are the literal strings `PD-3-nn` /
`PD-5-nn`, so no collision exists.

`PD-2-32` and `PD-2-33` were moved `open` → `fixed` at PR-B's Gate C commit.
⚠ **`PD-2-33` closed its OVERFLOW half only**; the a11y half (WCAG 1.1.1) stays
routed and open at **A11Y.0**, with the `alt=""` exception rowed at
`OQ-6-ALT-EXCEPTION`.

---

## 6 · Open questions

1. **OQ-2** and **PD-2-08** — both still unanswered, both now one line. §2.
2. **`RR-4-ID-COLLISION`** — needs a ruling, not an edit.
3. **`G1-RECON-TEMPLATE`** — PRIMITIVES-1's seven recon-template requirements
   have now failed to land across three tasks.
4. **`MICRO-LABEL-TIER`** — routed to POLISH.4; its census is
   classifier-dependent and the row states which predicate it means.
5. **`VACUITY-RULE-TO-V-REGISTER`** — promote `§8-P1`'s **three-axis** rule.
   ⚠ Not the two-axis form; that version was disproved on the branch that
   minted it.

---

## 7 · Next session starts at

**`.7a` Auth — the next machine run.** Single gated pass, no gates outstanding.
Nothing precedes it: PRIMITIVES-2 and POLISH-TEMPLATE are both closed.

⚠ **Before `.5` Profile: REGISTER-APPLY first** — six `PD-5-nn` rows sit
unapplied in `POLISH-register-ADDITIONS.md`.

---

## 8 · Time

One session, continuous with PR-B's. Merge #318 → ground → exit-criteria
discharge → two fold-ins → doc state → staging advance + health gate → PK
refresh → this log.
