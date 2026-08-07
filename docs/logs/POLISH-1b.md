# POLISH-1b — session log

> **Date:** 2026-08-03 · one session, continuous with POLISH-1a; final stretch run unattended under a halt doctrine.
> **Ground:** `main` @ `c5892bc` (the POLISH-1a squash, PR #288) · detached worktree · branch `polish/1b`
> **Plan:** **none in-repo.** The kickoff was inline and self-contained; D1 · D2a · D3 are its authoritative scope.
> **Spec gate:** ADR-0023 §Patch 2026-08-03 — minted in B1, SPEC-FIRST, before any code.
> **Ritual:** CC-LIGHT — not a CLAUDE.md §1 critical path. No `@security-auditor`, no DB, no migration, no auth logic, no money math.
> **Model:** `claude-opus-5[1m]`, effort `max`.

---

## A note on SHAs in this log

The merge is **squash-to-main**, so **no SHA below reaches `main`.** All four are branch-local. B2 was amended twice and B3 once, so both were rebuilt each time; the set below is the final one, read from `git log` rather than inferred. **The durable reference is the squash-merge SHA on `main`, recorded at close-out.**

---

## What landed

Branch `polish/1b`, four commits off `c5892bc`. **PR opened; not merged, not self-approved.**

| | SHA | What |
|---|---|---|
| **B1** | `68f3590b2594362dd6c32b86cc9390f62197f6aa` | ADR-0023 patch record, doc-only |
| **B2** | `df252d0b163e034525e610f130a409be2b8f4c7c` | the container primitive — D1 + D2a |
| **B3** | `b8fac43f35206df4625f83398524283b9625032b` | sticky header at z-40 — D3 |
| **B4** | *this log* | §5.9 session log, doc-only |

### Gates — all four green

| Gate | Result |
|---|---|
| `tsc --noEmit` | **exit 0** |
| `biome check .` | **exit 0** — 1 warning + 3 infos, all pre-existing in untouched files |
| Full suite | **exit 0** |
| `next build` | **exit 0** |

---

## Decisions made

**1. D3 ruled STICKY, 2026-08-03; the ADR patch record is the basis.** B1 landed the web-ratified text VERBATIM (diff-verified byte-identical, not eyeballed) before any code, per the kickoff's SPEC-FIRST ordering. `position: sticky`, not `fixed` — sticky keeps the header in normal flow, so nothing below needs offset compensation and the existing `min-h` chain is undisturbed. Verified rather than assumed: there is **no `overflow` rule anywhere** in the `html` → `body` → provider → wrapper chain (`html` is `h-full`, `body` `min-h-full flex flex-col`, and `globals.css` sets only colour and font on them), so the viewport is the scrolling ancestor and `top-0` resolves against it.

**2. `z-40` is the header's reserved tier; 20 and 30 stay free.** Every document-level overlay in the app sits at `z-50` — `MarketPriceChartOverlay:45`, `ProfileGraphOverlay:51`, and the shadcn `Dialog` overlay and content (`dialog.tsx:39`, `:61`, portalled). Tiers 20 and 30 are empty. So `z-40` clears every overlay with a full tier of headroom and **no overlay needed raising** — the kickoff's HALT condition never triggered. The three `z-10` occurrences are local stacking contexts inside already-positioned parents and cannot compete. Three things the brief named do not exist to stack: no Popover primitive, no DropdownMenu, no Sonner mounted; `BetComposer` renders inline with no positioning at all.

**3. Four named presets, not three free axes.** Callers name a preset and never pass `maxW`/`px`/`py`. Three free axes across nine sites is a config object, and the scatter would return as prop drift.

**4. `(auth)` split into two nodes (Option B).** `<main>` keeps the landmark and its place in the `min-h` chain; `PageContainer` owns the box. Rejected the `as`/element-prop alternative: it leaks one caller's shape into a shared primitive's API, which is the coupling this task removes.

**5. Logs are exempt from the SPDX SG** (`FOUND-3` scopes that convention to source files; 137 of 140 logs carry no header). The two new **test** files got one.

---

## D1 + D2a — the container inventory

**Nine declaration sites in seven files**, not the five the brief anticipated. `/bookmarks` and `/u/[pseudonym]` each declare the container in **three** files — page, loading *and* error — so six of the nine are route states of two routes. Same logic as POLISH-1a's G1 ruling: fixing only `page.tsx` leaves the defect live in the loading and error states of the same routes.

| # | Site | Preset |
|---|---|---|
| 1 | `(public)/not-found.tsx` | `notice` |
| 2–4 | `(public)/bookmarks/{page,loading,error}.tsx` | `reading` |
| 5–7 | `(public)/u/[pseudonym]/{page,loading,error}.tsx` | `reading` |
| 8 | `(auth)/layout.tsx` | `auth` |
| 9 | `components/debate/DebateView.tsx` | `debate` |

```
reading  max-w-3xl px-4 py-6     debate  max-w-5xl px-6 py-8
auth     max-w-md  px-4 py-8     notice  max-w-3xl px-4 py-24
```

**DISCOVERY (`/`) IS DELIBERATELY FULL-BLEED AND GETS NO CONTAINER.** Confirmed by grep: zero `mx-auto`/`max-w-` in `src/components/discovery/` or `(public)/page.tsx`. Recorded in the primitive's own doc comment so nobody adds one later.

**This commit moves nothing.** The presets are a transcription of what was on disk at `c5892bc`, not a normalisation. Collapsing the four to fewer is **D2b**, and it belongs to POLISH .2/.3/.5/.6 — each of which now changes ONE preset in ONE place instead of hunting three files per route. That is what B2 buys.

**Two corrections to the brief**, both resolved against the files: `(public)/not-found` **has** a width (`max-w-3xl`), so the padding-only preset the brief anticipated was not needed and was not built; and `px` is not uniform (DebateView is `px-6`, the other eight `px-4`) while `py-N` is symmetric top *and* bottom, so the container owns **three** axes, not two.

**`w-full` unified.** DebateView was the only site without it. A block-level flex container in normal flow computes the same used width either way — `width:auto` already fills the line box, capped by `max-w` — so the addition is inert today. It is the only class added anywhere, it is recorded explicitly in the test's `adds` field rather than absorbed into the baseline, and it is the *safer* of the two: if a later task makes the parent a column flex container, `mx-auto` suppresses `align-self: stretch` and the class becomes the difference between fill-to-`max-w` and shrink-to-fit.

---

## The `(auth)` two-node split, and the D4 correction

`(auth)/layout.tsx:40` previously did **landmark + flex child + container in one node**. Now:

```
<main className="flex flex-1 flex-col">
  <PageContainer preset="auth" className="flex flex-1 flex-col">
```

**`flex flex-col` and `flex-1` are on BOTH nodes deliberately.** `<main>` claims the height from the outer column; the container claims it from `<main>` and makes the Card a flex item. The union of the two nodes' classes equals the `c5892bc` single node exactly.

**D4 — the correction that matters for POLISH.7a.** An earlier draft of this reasoning said the Cards "would have" top-aligned. They **already do**. `my-auto` on the sign-in and otp Cards has resolved to **zero since UI-A7**, because the wrapper's `min-h-full` collapses against body `height:auto` — POLISH-1-X measured the card top at **92px, not 484px**. That is D4, POLISH.7a's row, and it is untouched here.

What the split preserves is the **LATENT CAPABILITY**: with the flex chain intact end to end, POLISH.7a repairs the wrapper and the Cards centre with **no second fix**. Flatten either node to a block context and `margin-block: auto` computes to zero forever, and POLISH.7a would need two fixes instead of one. **POLISH.7a should scope its fix as UPSTREAM-ONLY.** Deleting `flex-1` from `<main>` is invisible today and silently defeats that repair, which is why it is pinned by name in the test rather than left to review.

---

## The pixel-identical constraint, and how it is proved

The hard constraint was that every route renders pixel-identically — computed width, horizontal inset, top and bottom padding unchanged. The amended constraint permits a structurally-inert wrapper `<div>` at `(auth)` only.

`tests/unit/shell/page-container.test.ts` proves it by **reading each call site off disk**, extracting the real `<PageContainer>` tag, and comparing the class set it resolves to against the exact string on disk at `c5892bc`. Class order has no cascade effect — Tailwind emits one rule per utility at fixed specificity — so set equality is computed-style equality.

**The site-8 blindness, found and closed.** Every other site is a 1:1 replacement, so the container's class set IS the whole element. `(auth)` is not: one node became two, and a row checking only the container passes while blind to whatever stayed on `<main>` — **the same shape as POLISH-1a's V9 half-application, where a green gate saw one of two labels.** A dedicated cell now asserts the two nodes' UNION equals the pre-change single node, that `<main>` keeps `flex`/`flex-1`/`flex-col` by name, and that no box axis leaked onto `<main>`.

---

## Surprises caught + fixed in-session

**1. The site-9 baseline was DOCTORED (reviewer H1).** `w-full` had been appended to the `before` column so set-equality passed — in a field documented as verbatim. DebateView at `c5892bc` genuinely lacked it. Fixed: the baseline is now the true string, the addition is explicit in an `adds` field with its reason, and a cell asserts exactly ONE site adds anything. A doctored baseline cannot distinguish "the preset is faithful" from "someone widened the baseline again."

**2. The suite pinned the TABLE, not the CALL SITES (reviewer H2).** Eight of nine rows compared two literals inside the test file and read no source. Repointing a route at the wrong preset — or reverting it to a hand-rolled div — left every row green. Every row now reads its file. **Proven to bite:** repointing `bookmarks/loading.tsx` from `reading` to `debate` fails site 3.

**3. The overlay scan was blind to two of four overlay layers (reviewer H3).** It matched only a bare `className="…"`, never `className={cn("…", className)}` — which is how every shadcn primitive is written, including `ui/dialog.tsx`, whose overlay and content ARE two of the overlays the guard names. `GlobalHeader`'s comment told the next reader the Dialog was enforced; it was not. Fixed, and coverage is now pinned **by file name**, because a count check (`length > 0`) sees total scan failure but never *partial*. **Proven to bite:** narrowing the regex back fails with `scan reaches src/components/ui/dialog.tsx`.

**4. `cn` is twMerge-backed, so a call site could silently replace a preset axis (reviewer M3).** Passing `px-8` reads as no conflict — it cleanly overrides `px-4`. A second row per site now asserts the call-site className sets no box axis. **Proven to bite.**

Also fixed: the tier-20/30 test was independently vacuous on an empty scan (M2); the walk covered `src/components` only (M1); and `\bz-(\d+)\b` matched the negative utility `-z-10` as tier 10, inverting the comparison the file exists to make.

---

## Open questions — for Gate C

**1. Two ADR wording drifts, left alone deliberately.** The patch record says sticky is applied "within each group layout" (it is on the `<header>` inside `GlobalHeader`, mounted once) and that the header "permanently occupies 60px" (the inner bar is `h-[60px]` but `border-y` makes the occupied border-box **62px**). Both are in web-ratified verbatim text in a canon document, which the run's halt doctrine forbids editing. **Neither is a code defect.** Flagged for the operator to amend the ADR if wanted — the 62px figure matters only if a later task offsets against it.

**2. Two container declarations remain outside the nine**, and leaving them is correct: `src/app/not-found.tsx` and `src/app/global-error.tsx` are root boundaries outside `(public)`/`(auth)`, and `global-error.tsx` renders its own `<html>`/`<body>` and should stay dependency-light. Noted only so "nine sites" is not later misread as "all container sites are centralised."

**3. `--elev-1` is subtle for its new role.** The ADR now makes it load-bearing — it separates the bar from content passing beneath. It is `inset 0 1px 0 rgb(255 255 255 / 0.04), 0 1px 2px rgb(0 0 0 / 0.4)`. Real, but faint. Design judgement, not a defect.

---

## Next session starts at

**Gate C is a web diff-read on PR #289.** Next action, exactly: read the diff, then squash-merge and record the squash SHA on `main`. Nothing else is pending on this branch.

**POLISH.7a inherits D4** and should scope its fix **upstream-only** — repair the wrapper's `min-h-full`/body `height:auto` collapse and the `(auth)` Cards centre with no second change.

**D2b** is now a one-preset-per-row change for POLISH .2/.3/.5/.6.

---

## Context to preserve

- **Worktree KEPT** at the operator's instruction — deps and `.next` warm for the next task. It sits on `polish/1b`.
- **`main` untouched** by this session beyond the PR; the primary tree is still on `chore/header-portfolio-log`.
- The reviewer independently verified, worth not re-deriving: all nine sites against `git show c5892bc:<file>` rather than the test's own baseline (which is how H1 was caught); the full ancestor chain for sticky, including that `PostHogProvider` renders **no DOM element**; the exhaustive `z-*` enumeration; and that `(admin)` has no layout and no `GlobalHeader` import, so the ADR's "(admin) is unaffected" is true.
- **`ExecuteTruncateGuts` in suite logs is benign** — the append-only TRUNCATE guards being exercised, not a failure.
- Concurrency: `pgrep -f 'node.*vitest'` is the reliable check, **not** `ps | grep` — the latter matches its own wrapper shell and reports phantom runners.

---

## Time

One session, 2026-08-03, continuous with POLISH-1a. Sequence: survey (z-index + container inventory, read-only, authorised in parallel with B1) → B1 doc-only → B2 → B3 → gates → `@code-reviewer` (~9 min, 26 tool uses) → six in-envelope fixes across B2 and B3 → gates again → B4. Full-suite wall-clock ~11 min per complete run. Every phase boundary before the final stretch was operator-ratified; the final stretch ran unattended under a written halt doctrine.
