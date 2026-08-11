# PRIMITIVES-2 PR-B — session log

**Task:** PR-B of PRIMITIVES-2 — the seam pass. `SideBadge`'s map lookup and its
two surface presets, the emphasis ladder as named CSS tokens, the replyhead
tier as a named constant, and the doc/register corrections.
**Plan:** `docs/plans/PRIMITIVES-2.md` (#316) — §6 is PR-B's commit sequence,
§3 D1 and D5–D13 its rulings, §7 the halt set, §8 the proof discipline, §11 the
patch records.
**Ritual:** FULL and gated. Not ultracode, not stacked on one.
**Ground:** `origin/main` = `143380b` (PR #317 merged, `mergeCommit.oid`
confirmed via `gh pr view`). Branch `chore/primitives-2-seam`, cut from it.
**Reviewer:** `@code-reviewer` on the whole branch. **No `@security-auditor`,
no `@test-writer`** — D14 / PRIMITIVES-1 precedent.
**Gate C:** a web diff-read before merge, **non-optional**. Diff written to
`~/Downloads/PR-B-primitives-2.diff`.

⚠ **Every count in this log was re-verified at PR HEAD before the log was
committed**, not at the moment it was written. PR-A's log shipped three stale
counts, and its own §1 went stale inside its own PR.

---

## 1 · What landed

**Six** commits on `chore/primitives-2-seam`. **12 files, +723 / −26.**

| # | SHA | Commit |
|---|---|---|
| 1 | `ab56d88` | `refactor(debate): SideBadge resolves its preset by map lookup` |
| 2 | `5485f6f` | `feat(debate): SideBadge detail + profile presets` |
| 3 | `f12d844` | `refactor(design): the emphasis ladder becomes two named tokens` |
| 4 | `c23edfa` | `refactor(discovery): the replyhead tier becomes a named constant` |
| 5 | `6a55b3d` | `docs(polish,parked): three stale mix-blend corrections; two register rows; RR-4` |
| 6 | `dc91c9d` | `fix(design,docs): address @code-reviewer findings on PR-B` |

**Source (4):** `src/components/debate/badges.tsx` ·
`src/components/discovery/HeroPanels.tsx` ·
`src/components/discovery/DiscoveryGrid.tsx` · `src/app/globals.css`
**Tests (3):** `tests/unit/debate/render/side-badge.test.tsx` ·
`tests/unit/design/emphasis-ladder-tokens.test.ts` (**new**) ·
`tests/unit/discovery/render/hero-panels.test.tsx`
**Docs (5):** `docs/plans/PRIMITIVES-2.md` · `docs/parked.md` ·
`docs/polish/POLISH-0.md` · `docs/polish/POLISH-TRACKER.md` ·
`docs/polish/POLISH-register.md`

**Nothing under `src/server/**`.** No DDL, no migration, no `EVENT_TYPES`
value, no ADR, no SPEC edit, no read-model field, no handler. ADR ceiling stays
**0036**. Exit criterion 9 holds.

---

## 2 · Decisions made

**D7 — the map lookup, `size` stays optional.** `CHIP[size ?? "base"]` with
`base` a real key, so a union member added without a `CHIP` entry is a compile
error rather than a silent fall-through. `size` stays **optional** and the
asymmetry with `PriceBar`'s required `size` is recorded in the docblock as
deliberate: 12 of 13 sites pass none, so `required` is a 12-site edit writing
the string the default already resolves to. O-1's guarantee is carried by the
**map**, not by required-ness.

**D5/D6 — the two presets, named by surface, wired nowhere.** `detail` (d5's
`.md`, 10px) and `profile` (Profile's `.sm`, 8.5px). **Zero call sites wired**,
and a guard now asserts it stays that way — the seam lands at the primitive,
the adoption is POLISH.3's and POLISH.5's.

**Each preset is a FLATTENED CASCADE, and that is the whole risk.** The mockups
are cascading CSS; the component has none. Every property a modifier inherits
from its base is written out explicitly or it falls through to shadcn's
`badgeVariants`, whose base declares `text-xs font-medium`. Mutation D proved
it live: dropping `font-extrabold` from `detail` left `font-medium` standing.

**D9 proper, not D9-alt.** V1 cleared `tokens-monochrome` **from the
predicate** before any CSS was written, so the ladder joined rung 1's
mechanism. Two composites in the second `:root` block beside `--hairline`,
outside both `@theme` blocks.

**D8 at reduced scope, and RULE-2 on the name.** `REPLYHEAD_TIER` is named for
the replyhead and scoped to `discovery/` — never `MICRO_LABEL` or
`SECONDARY_TEXT_TIER`, which would assert ownership of 12 sites it does not
touch.

**RULE-1, ratified and recorded as §11 `§8-P1`.** RED-first applies **only** to
a guard asserting a defect exists. Zero-delta and census guards are green on
first run by definition and are discharged by **mutation**, stated with the RED
count. A census mutation must break in **both** directions. This reads off §5's
own commit table, which already attached H15 to PR-A's defect test and not to
its zero-delta baselines. **Standing for every remaining POLISH surface.**

**Sixteen mutations, each RED, each reverted.** 3 on the map lookup and its
census (A–C) · 4 on the presets and the wiring census (D–G) · 4 on the ladder
tokens and their consumers (H–K) · 3 on the replyhead extraction (L–N) · 2 on
the reviewer fixes (O–P).

---

## 3 · Surprises caught + fixed in-session

**S-1 · The monochrome guard is blind to a hard-coded hex in a composite —
demonstrated, not theorised.** V1's analysis predicted it from the predicate:
the census at `tokens-monochrome.test.ts:61` is keyed on a property **name**
(`--color-n0..n7|ink|yes|no`) carrying a hex **value**, so
`--ring-active: 1.5px solid #747474` matches neither half. **Mutation I put
exactly that hex in place and `tokens-monochrome` passed 8/8.** The constraint
now lives in `emphasis-ladder-tokens.test.ts` with a positive and a negative
assertion. This is the result from PR-B most likely to matter to another task.

**S-2 · A new guard produced a confident RED on correct code.** The ladder
guard's first `@theme` matcher was unanchored, matched the word `@theme` in a
**prose comment** at `globals.css:162`, and ran forward to the next `{` — the
`:root` block the new tokens live in — reporting them as inside `@theme`. O-3:
a true refusal with a misleading cause is a defect, and so is a false one. Both
anchors are now load-bearing and the reasoning is in the file.

**S-3 · A guard I wrote was vacuous, and its own comment claimed the coverage
it lacked.** `the-literals-survive-nowhere-in-src` filtered the two ladder
literals against `CONSUMERS`' own two files while its comment said *"a fifth
site written tomorrow … would not be in CONSUMERS."* It could only fail where
the test above it already failed. **§8.3 N8 verbatim.** Caught by
`@code-reviewer` (H-1), not by my own mutations — **J and K each wrote into a
file already in `CONSUMERS`, so neither exercised the missing direction.**

⚠ **The lesson generalises past this file:** RULE-1's both-directions clause is
about the guard's **input set**, not only about add-vs-remove. A census
mutation must also test a member the census could fail to *look at*. Mutation O
(a literal written into a third file) is that direction; the pre-fix guard
passed it.

**S-4 · Two of §9's four docket rows were missing.** The execute relay named
three docket rows; the plan's §9 mints four. **The plan governs and the relay
ranks below it** — `RR-4-ID-COLLISION` and `G1-RECON-TEMPLATE` were dropped
because I followed the relay's list. D13's row is load-bearing: it moved RR-4's
disposition cell, and §9's standing rule puts the row in the **same commit**
that names it, so without it the unresolved half dies silently under a cell
edit that never touched it. Both added at commit 6.

**S-5 · `just verify` failed on a format error the pre-commit hook had been
hiding.** Lefthook formats **staged** files, so `biome check` never saw the
unformatted state of files that went straight into a commit. Running verify on
an **uncommitted** tree surfaced it. Worth knowing: a clean `just verify` after
committing is weaker evidence than the same run before.

**S-6 · The "only `text-n4` micro-label" claim was false.** Plan §2 said the
replyhead was the only one; `debate/composer/AuthGateSlot.tsx:49` is a second
(`text-xs font-medium tracking-wide text-n4 uppercase`, rendering
`AUTH_GATE_COPY.micro`). D8's safety property survives — OQ-2 rules on the
replyhead's tier, still one line — but the uniqueness claim was never true.
Struck in past tense in §2, naming the counter-example.

---

## 4 · Open questions

1. **OQ-2 — replyhead `text-n4` vs `text-n6`.** Unanswered. It is now a
   one-line change at `HeroPanels.tsx:51-52`, which is the property D8 existed
   to secure. Mutation L applied the ruling and the render moved.
2. **PD-2-08 — the active ring colour.** Unanswered. One line,
   `globals.css` `--ring-active`.
3. **`RR-4-ID-COLLISION` needs a ruling, not an edit.** D13 moved one cell and
   did not touch it. Rowed at commit 6.
4. **The micro-label census is classifier-dependent and two honest counts
   disagree** — recon's 13/6 files/5 tiers vs this branch's 12/7 files/4 tiers.
   Neither is wrong. The `MICRO-LABEL-TIER` row states its classifier; a future
   task must name its predicate before quoting a number.
5. **`h-5` survives both presets** (`badgeVariants`), so `profile`'s box is
   20px where `2px 7px` on 8.5px text computes to ~14px. Not a dropped property
   — neither mockup declares a height — and identical in kind to the ratified
   `hero`. First visible at POLISH.5's 1440 inspection.

---

## 5 · Next session starts at

**Gate C — a web diff-read of `~/Downloads/PR-B-primitives-2.diff`, before
merge, non-optional.** Then squash-merge.

**On close:** staging advance (behind by docs-only commits), PK refresh table,
and the tracker note that PRIMITIVES-2 is closed and `.7a` is the next machine
run. New register high-water marks are **`PD-3-03`** and **`PD-5-01`**, so
REGISTER-APPLY allocates from `PD-3-04` / `PD-5-02`.

---

## 6 · Context to preserve

- **`POLISH-register-ADDITIONS.md` was NOT touched** — verified clean in
  `git status`. Its placeholders are the literal strings `PD-3-nn` / `PD-5-nn`;
  no collision exists.
- **`docs/plans/DISCOVERY-COMPLETE.md` was deliberately NOT edited.** It is a
  landed historical plan; `PD-5-01` is the correction of record for its `.6`
  routing error. `badges.tsx:18`'s copy of the same error **was** corrected.
- **⚠ Two commit bodies cite stale line numbers, and the substance holds.**
  `f12d844` and `c23edfa` both say *"P2-H3 HELD — HeroPanels.tsx:277-278"*; at
  branch head those expressions are at **`:304-305`**, shifted by commit 4's
  `REPLYHEAD_TIER` block. The check itself is correct — zero occurrences of
  either identifier in the file's diff, `side-pole-binding` green and untouched.
  Not amended: rewriting a commit body for a citation whose substance is right
  is churn. **A Gate C reader grepping `:277-278` should not conclude the check
  ran on the wrong lines.**
- **`P2-H8` was upgraded to a correctness halt and is recorded at the preset.**
  d5's `.sm` and Profile's `.sm` are byte-identical **at the modifier only**;
  d5 carries contextual `border-radius:4px` overrides (`:882`, `:911`) a
  flattened preset cannot express. Wiring `CHIP.profile` into a d5 `.sm` site
  would render `var(--r)` where the mockup ratified 4px.
- **The mockups are in-repo** at `docs/design/mockups/` — that is the canonical
  copy, not `~/Downloads`.
- **No mockup declares a `font-family` on `.sidechip`.** All three declare it
  once, on `html,body`, as `var(--sans)`. Both presets therefore carry no font
  class. `CHIP.base`'s `font-mono` is the pre-C3 built render preserved
  byte-identical, not a port.
- **Reviewer verdict:** CRITICAL none · HIGH 2 (both fixed) · MEDIUM 1 (fixed)
  · LOW 8 (6 fixed, 2 recorded). Q1 zero-delta **17/17** consumers — 12
  `CHIP.base` + 4 ladder + 1 replyhead — zero intended and zero unintended
  deltas. Q2 both poles on `detail`, `profile` and the replyhead. Q3
  `PERMITTED_FILES` and its predicate untouched. Q4 every ported token traces.

---

## 7 · Gates

| Gate | Result |
|---|---|
| `ZUGZWANG_ENV=preview just verify` | **exit 0.** 1 warning + 4 infos, **pre-existing** (`tests/staging/_lib/reset.ts`, `price-percent-pair.test.tsx` — neither touched here) and present in every green run |
| Full `pnpm vitest run` ×3 (at commit 5) | **exit 0 ×3**, identical totals: 318 files passed / 1 skipped; 2833 passed / 1 skipped / 4 todo. Deterministic |
| Full `pnpm vitest run` (at commit 6, head) | **exit 0** — 318 files passed / 1 skipped; **2834** passed / 1 skipped / 4 todo (+1: the ladder guard's new alive check) |
| `pseudonym-assigned-event.test.ts:91` | **Did NOT recur.** Zero failures in all four full runs |
| `side-pole-binding.test.ts` | **Green, 4 tests, file untouched** — absent from `git diff --name-only origin/main..HEAD` |
| `tokens-monochrome.test.ts` | **Green, 8 tests, file untouched** |
| Counted inventories at head | 13 `SideBadge` sites / **12** riding `CHIP.base` · **3** rung-2 + **1** rung-3 ladder consumers · **1** replyhead site |
| Suite sizes at head | side-badge **19** · emphasis-ladder **7** · hero-panels **19** |

---

## 8 · Time

One session. Ground and re-count → V1/V2 → commit 1 (stop for ratification) →
commits 2–5 → full suite ×3 → `@code-reviewer` → commit 6 → final full suite →
this log. Not pushed until the log landed.
