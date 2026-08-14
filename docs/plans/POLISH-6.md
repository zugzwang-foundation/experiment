# POLISH.6 · /bookmarks — EXECUTE PLAN v1.4

> ## ⚠ v1.5 — TWO AMENDMENTS AT DOC-1, BOTH FOUNDER-RATIFIED
>
> **1 · THE CITED AUTHORITY DOES NOT EXIST.** The converged kickoff §2 is absent from every filesystem root and every session transcript (DOC-1). **The authority is `docs/plans/POLISH-5.md` §1.5A**, and every citation here is re-pointed to it. ⛔ **The rulings are unchanged: `JR-1`, `JR-3`, `JR-5`/B′ and the `sub` tier rule all carry.** ⚠ **This plan's own restatement of §2.1 and §2.2 is what made §1.5A recoverable — it is the only artifact on disk that printed the call sites and the tier rule.**
>
> **2 · `.3 PR 2` IS NOT A PRECONDITION OF THIS PLAN** (`D-4`, 2026-08-14). This plan already keyed only to PR B's leaves existing; `POLISH-5.md` §15's chain table also gated `.6` on `.3 PR 2` and no longer does. `BookmarkToggle.tsx` remains ⛔ out of scope by ruling `D3`, and PR 2 files its own adoption record at its own close-out.

> **v1.4 supersedes v1.3.** Base md5 `1a2ed19f15d7fc6699f0f9c704a3f847`, verified off disk before
> reading (`V-1`). **SIX SITES, applied AT THE SITES, never as an appendix.**
>
> ## ⛔ THE ONE RULING THAT MOVES: **`JR-5` / VARIANT B′ — ITEMS 4 AND 6 NOW IMPORT `ui/` PRIMITIVES**
>
> v1.3 ruled item 6 renders the family **INLINE** and that `.6` consumes **no leaf in any branch**
> (S-1). **That was correct when POLISH.5's leaf did not exist and its shape was unsettled.** The
> `docs/plans/POLISH-5.md` §1.5A settles it, and **POLISH.5 PR B mints both leaves before this plan runs**.
>
> **⇒ ITEM 4 IMPORTS `ui/empty-block.tsx`. ITEM 6 IMPORTS `ui/error-block.tsx`. THIS PLAN MINTS
> NEITHER AND WRITES NEITHER.** `src/components/ui/` widens to **IMPORT-ONLY** and stays on the
> **write** deny-belt. ⛔5 and STEP 0.8 are **RESTORED** in the form §2 requires — the `ui/`
> dependency v1.3 deleted them for **now exists**.
>
> **⇒ AND `OD-2`'s STRING RETURNS.** Under **B′** the body tier is **REQUIRED** and each consumer
> passes its **own carried surface string**. `/bookmarks` passes **`"Couldn't load your bookmarks."`**
> ⚠ **This DISCHARGES the loss the plan-chat close-out logged as knowingly accepted** — *"the
> deliberate loss of surface-specific error copy."* **`OD-4` did not reject the string; it removed
> the tier that could hold it. B′ gives the tier back.**
>
> ⛔ **v1.3's inline shape is SUPERSEDED BUT KEPT AS A RECORD, never deleted** — a later reader must
> see the ruling, not a plan that was silently narrowed.
>
> **⛔ THE PRIMITIVES' SHAPE IS CITED, NEVER RE-DERIVED HERE.** The authority is
> **`docs/plans/POLISH-5.md` §1.5A** — §1.5A.0 conventions, §1.5A.1 `empty-block`, §1.5A.2
> `error-block`. Where §1.5A and this plan disagree, **§1.5A governs the primitive's shape and this
> plan governs everything else.**
> **Re-derivation is the `R12` / `F-7` failure and it has been caught three times on this task.**
>
> **⚠ MEASUREMENT GROUND RE-KEYED: `16971cd`** (from `af3a070`). **The distance is ONE commit and it
> is DOC-ONLY** — `16971cd` adds `docs/logs/POLISH-3-PR-1.md` and `docs/plans/POLISH-3-RUN-TRACKER.md`,
> **378 insertions, two files, both pure additions.** Measured per-path across all seven allow-list
> rows and all fifteen named references: **zero moved WRITE-set paths, zero moved CITE-set paths**
> (`POLISH-56-HEADMEASURE.md` §0). **Every coordinate in this document carries unchanged.**
>
> **Execute runs with auto mode OFF:** every commit C1–C5 requires the run to **STOP and capture a
> RED** before its source change. Changes marked **[v1.4]**; v1.3's markers are retained as history.

---

## §0 · SESSION STATE — recorded, because the plan's ground moved under it

| Question | Answer |
|---|---|
| `git branch --show-current` | **empty — detached HEAD.** No branch checked out |
| `git status --porcelain` | **empty — clean** |
| Worktree | `/Users/hrishikesh/code/zugzwang/wt-p6-headverify` @ `2326e84` (detached), 1 of 14 |
| `git log --oneline origin/main..HEAD` | **empty.** HEAD is **BEHIND** `origin/main`. `merge-base --is-ancestor 2326e84 origin/main` → **0** |
| `git ls-remote --heads origin 'polish/6*' 'polish-bookmarks*'` | **empty — no such remote branch** |
| `git branch -a --list '*polish-bookmarks*' '*polish/6*'` | **empty** |
| Is `polish-bookmarks-ui` a branch, worktree, or session label? | **A SESSION LABEL.** **No branch exists; none was created; nothing to delete** |
| Permission mode | **NOT plan mode for the whole run.** Turn 1 entered and exited plan mode on approval; turns 2–5 ran in normal mode. The constraint held **by discipline, not by harness enforcement** |
| Commands | **All read-only.** The only writes were `Write` calls to `~/.claude/plans/` and `~/Downloads/` — **outside the repo** |

⚠ **[v1.4] `origin/main` = `16971cdff8b58f82d1144290926b52cbeadc7af5`** — *chore(polish): log
session — POLISH.3 PR 1 FRAME (#329)*, measured by `git ls-remote` at the head read. **v1.3's
`af3a070` was correct when written and the caution it carried was right: head has since advanced by
one.**

⚠ **THE ADVANCE IS DOC-ONLY AND CHANGES NOTHING IN THIS PLAN.** `git diff --stat af3a070..16971cd` →
two files, 378 insertions, both **pure additions** under `docs/`. Per-path over all seven §7
allow-list rows and all fifteen §7 named references: **moved = 0, every one.** Two allow-list entries
are **ABSENT** — `tests/unit/bookmarks/render/surface-states.test.tsx` and `docs/plans/POLISH-6.md` —
and **both are files this plan mints.** That is the expected state, not drift.

⛔ **STEP 0.1 STILL RUNS `git fetch` AND STILL RE-KEYS.** `16971cd` is a **proven head as of the
measurement**, not a proven head at execute — and POLISH.5's PRs A and B land between this reading
and this plan's branch point. ⚠ **PR A and PR B are EXPECTED to have moved `main` by then; that is
the ruled sequence, not an anomaly.** What STEP 0 checks is whether they moved anything on **this**
plan's write or cite sets.

---

## §0b · Context

`/bookmarks` shipped at **UI-A6 / ADR-0032** and has never had a polish pass. Six ratified items
bring it onto the primitives and canon that landed after it. Everything is **presentational**. No
server file, no schema, no migration, no read model, no invariant surface.

The rulings are **RATIFIED but NOT on `origin/main`** (`POLISH-56-STEP0-RECON-CLOSE-OUT.md` plus the
v1.1/v1.2/v1.3 relays, all off-repo). Commit 0 is unauthored and **POLISH.5 has never run**. This plan
is their citable form. Do not grep for them; do not halt on their absence.

**Sequencing:** commit 0 → **POLISH.5 PR A → POLISH.5 PR B** → POLISH.6 PR → POLISH.5 PR C.
⚠ **POLISH.5 lands BEFORE this task** — load-bearing for F-7, STEP 0.9, **and now [v1.4] for items 4
and 6, which import primitives PR B mints.**

> ### ⚠ [v1.4] **`/bookmarks` IS UNREACHABLE TODAY, AND POLISH.5 FIXES IT BEFORE THIS PLAN RUNS**
>
> **MEASURED at `16971cd`:** `grep -rn '"/bookmarks"' src/` → **ZERO matches.** Widened to any
> `/bookmarks` occurrence in `src/`: **28 lines, every one an import specifier or docblock prose,
> not one a link target.** No `<Link>`, no `<a>`, no `router.push`, no `redirect()`
> (`POLISH-56-HEADMEASURE.md` §2d). **The route is live and auth-gated and ORPHANED FROM THE
> NAVIGATION GRAPH.**
>
> **⇒ POLISH.5 item 17 (`PB-1`) closes it** — an owner-only bookmark icon on `IdentityCard`, landing
> in **PR A, commit A8**, by founder ruling 2026-08-13 which reversed `D10` for that item.
>
> ⚠ **Why this plan records it:** every one of this plan's six items is presentational, and until
> `PB-1` merges **no participant can see any of them**. The founder pass on this surface is
> performable only after PR A. ⛔ **It is NOT this plan's to build** — `IdentityCard.tsx` and all of
> `src/components/profile/` remain on the deny-belt (§2, §7).

---

## STEP 0 · MANDATORY RE-KEY — before any write, no exceptions

> ### ⚠ **[v1.4] STEP 0.8 IS RESTORED — THE `ui/` EXISTENCE GATE**
>
> **Before any commit, verify BOTH leaves exist on disk and report each TRUE / FALSE with `file:line`:**
>
> ```
> src/components/ui/empty-block.tsx     ← item 4 consumes
> src/components/ui/error-block.tsx     ← item 6 consumes
> ```
>
> **FALSE on either ⇒ ⛔ RUN-STOP condition 11.** It means **POLISH.5 PR B has not merged** and this
> plan's ordering precondition is violated. ⛔ **Do not mint them. Do not inline the shape. Do not
> proceed on five items and defer the sixth.**
>
> ⚠ **AND VERIFY THEIR PROP NAMES AT HEAD, NOT FROM THIS DOCUMENT.** The contract is
> `docs/plans/POLISH-5.md` §1.5A.1 / §1.5A.2, but **the shipped file is the artifact**. A prop named
> differently from §1.5A is a
> **finding to report** — ⛔ never a leaf to edit (condition 12), and never a signature to guess.
> **`V-4`: a source match is the weak form.**
>
> ⚠ **This step was DISSOLVED at v1.3 and is RESTORED because `JR-5` gave it a subject again.** The
> dissolution is recorded in §9, not erased.

**It has already fired once.** v1.1 was keyed to `2326e84`; `origin/main` is `af3a070`. The advance
touched `tests/unit/shell/page-container.test.ts`, a ⛔1 named reference file. **This is the control
working, not a hypothetical.**

### What the `2326e84 → af3a070` advance touched — 10 files, 909 insertions

| File | Ours? |
|---|---|
| `tests/unit/shell/page-container.test.ts` (+171) | ⚠ **NAMED REFERENCE** — re-measured, citation survives |
| `src/app/(public)/m/[slug]/error.tsx` (new, 81) | ⚠ **THE FAMILY REFERENCE** — F-6, and now item 6's source of truth |
| `tests/unit/debate/render/market-error-boundary.test.tsx` (new, 378) | ⚠ **THE DIRECT TEST MODEL** — §5 |
| `src/components/debate/{DebateColumn,MarketHeader,PriceBar}.tsx` · `market-header.test.tsx` · `price-bar-presets.test.tsx` · `docs/parked.md` · `docs/plans/POLISH-3.md` | ✅ none is an allow-list or reference path |

**✅ NONE of the allow-list source files moved. ✅ `badges.tsx` did NOT move** — every chip coordinate
holds. **✅ `design-canon.md`, `POLISH-TRACKER.md`, `globals.css`, `arguments.ts`, `list.ts`,
`figures.ts`, the three `tests/unit/design/` guards, `discovery/render/surface-states.test.tsx`,
`bookmarks/{page,error,loading}.tsx`, `bookmarks/states.tsx`, `BookmarkCard.tsx` and
`side-encoding.test.tsx` did not move.**

**✅ F-2's citation SURVIVES:** `SITES` still has **9** entries (`:239`), `bookmarks/error.tsx` still
**entry 4** (`:74-76`). POLISH.3's new boundary landed in a separate `GREENFIELD` array (`:126-132`),
deliberately **outside** `SITES` — *"`SITES` stays at nine"* (`:124`).

### The steps

| # | Action | Pass condition |
|---|---|---|
| **0.1** | `git fetch origin && git rev-parse origin/main` | Record the head SHA. **That SHA is the execute ground** |
| **0.2** | `git diff --stat af3a070 origin/main -- <§7 allow-list> <§9 ⛔1 references>` | **Empty** → coordinates carry. **Non-empty** → 0.3 per touched file |
| **0.3** | Re-measure every §1 anchor and every coordinate in §3, §5 and §7's two fences | Each matches, or is **corrected in this file in the commit that corrects it**. A moved coordinate silently followed is ⛔ RUN-STOP |
| **0.4** | Re-run each §3 discriminating condition | "Already done" → **dropped with its evidence**, not re-done |
| **0.5** | Does `ProfileArgumentItem`'s `removed:false` **post AND reply** arm carry the entry-price field? | Present → item 1 executes, C2 applies. Absent → **item 1 per-delta halts**; C2 not opened. ⛔ Never add it here |
| **0.6** | Re-run the §5 grep table verbatim | Any new pin gets added to §5 before its commit |
| **0.7** | Confirm the reviewer worktree is at the 0.1 head | Agent definitions load from the working directory **at launch** and are not hot-reloaded (CLAUDE.md §6) |
| **0.8** | ~~`ls src/components/ui/` — did POLISH.5 mint the D2b leaf?~~ | ⛔ **DISSOLVED [v1.3].** OD-4 consumes no `ui/` leaf under any outcome |
| **0.9** | `git log --oneline af3a070..origin/main -- 'src/app/(public)/u/**' 'src/components/profile/**'` | **RETAINED.** Record what POLISH.5 did to the **twin defect** (F-7). **If `.5` already shipped its half, its shape is the one `/bookmarks` matches** |

---

## §A · OD-2 PRE-CONFIRMATION — A1/A2/A3. All PASS. **ALL STILL APPLY under OD-4**

`error.tsx` is absent from the `2326e84→af3a070` diff, so these receipts hold byte-for-byte. ⚠ **OD-4
changes what is written into `error.tsx`, not that `error.tsx` is the write site.** `"use client"`
still stays at `:1`; the default-export signature is still fenced; the wrapper is still removed **by
symbol, never by line** (F-1).

### A1 — ✅ PASS. `src/app/(public)/bookmarks/error.tsx` line 1 is exactly `"use client";`

```
 1: "use client";
 2:
 3: import { BookmarksError } from "@/components/bookmarks/states";
 4: import { PageContainer } from "@/components/shell/PageContainer";
 5:
 6: /** The /bookmarks error boundary (plan §3.3 states) — catches a load failure
 7:  * and offers the retry line. */
 8: export default function BookmarksRouteError({
 9: 	reset,
10: }: {
11: 	error: Error & { digest?: string };
12: 	reset: () => void;
13: }): React.JSX.Element {
14: 	return (
15: 		<PageContainer preset="reading">
16: 			<button type="button" onClick={reset} className="block w-full text-left">
17: 				<BookmarksError />
18: 			</button>
19: 		</PageContainer>
20: 	);
```

### A2 — ✅ PASS. `reset` is a destructured prop of the **default export**

`:8-13` — both members of the App Router contract present and correctly typed; `reset` already wired
to a live `onClick` at `:16`. **The handler is proven reachable today.**

⚠ **[v1.3] And the signature ALREADY carries the family's structural no-leak guarantee.** `:8-9`
destructures `{ reset }` **alone**; `error` is declared in the type at `:11` and **never bound**.
That is byte-for-byte the property `m/[slug]/error.tsx:29-32` documents and
`market-error-boundary.test.tsx:336-360` pins. **Nothing about it changes — the fence protects it.**

### A3 — ✅ PASS. `BookmarksLoading`'s server render is not at risk

- **Census** — `BookmarksLoading`: one consumer, `loading.tsx:1,:9`. `BookmarksError`: one consumer,
  `error.tsx:3,:17`. Nothing else imports `bookmarks/states`.
- **Mechanism** — `states.tsx` carries no `"use client"`; a directive-free module compiles into
  whichever graph imports it. `loading.tsx` (server) pulls a server-compiled `BookmarksLoading`.
- **Tree** — `div` → `LoadingBlock` → `Skeleton`; neither `loading-block.tsx:1` nor `skeleton.tsx:1`
  carries a directive.

⚠ **[v1.3] Under OD-4, A3 gets STRONGER, not weaker.** `BookmarksError` is deleted, so `error.tsx`
stops importing `states.tsx` **entirely**. `states.tsx` then has exactly **one** consumer
(`loading.tsx`, a Server Component) and never enters the client graph at all. **F-5's latent
fragility dissolves with it.**

---

## §B · THE G-GATE — G1–G4, run at `af3a070` **[v1.3]**

### G1 — `src/app/(public)/m/[slug]/error.tsx`, VERBATIM, WHOLE

⚠ **The file is 81 lines. Lines `:82-90` DO NOT EXIST** — the request asked for `:1-90`.

```tsx
  1: // SPDX-License-Identifier: AGPL-3.0-or-later
  2: "use client";
  3:
  4: import { PageContainer } from "@/components/shell/PageContainer";
  5:
  6: /**
  7:  * The `/m/[slug]` error boundary — POLISH.3 D4 / PD-3-11, following the
  8:  * ratified `PD-7a-04` / R-C precedent exactly.
  9:  *
 10:  * WHAT IT CLOSES. Before this file the debate route had no boundary of its own:
 11:  * an uncaught throw in `page.tsx`, in `loadDebateView`, or anywhere under
 12:  * `DebateView` escalated past `(public)/layout.tsx` to `src/app/global-error.tsx`
 13:  * — the WHOLE-DOCUMENT boundary, which replaces the root layout and therefore
 14:  * takes the branded header, the ground and the shell with it.
 15:  * `(public)/not-found.tsx` one level up already catches this route's
 16:  * `notFound()` throw (ADR-0023's "unknown or Draft slug"), but only that one.
 17:  *
 18:  * IT DECLARES A CONTAINER AND `(auth)/error.tsx` DOES NOT, and the difference
 19:  * is not inconsistency. The rule the repo actually supports is "declare one iff
 20:  * your layout does not": `(auth)/layout.tsx` wraps its boundary in
 21:  * `PageContainer preset="auth"`, while `(public)/layout.tsx` supplies no
 22:  * container at all. `debate` is this route's own preset — read the class
 23:  * literal off `CONTAINER_PRESETS` in `PageContainer.tsx`, never off a plan.
 24:  * ⚠ Flagged for Gate C under template §4.2 B3: `(auth)/error.tsx` was read as
 25:  * required and is SILENT on which preset an error boundary takes, so the tie
 26:  * was genuinely unbroken by the repo. This is a judgement recorded, not a
 27:  * precedent found.
 28:  *
 29:  * ⚠ NOTHING FROM `error` IS RENDERED — not `message`, not `stack`, not
 30:  * `digest`, not `cause`. The prop is accepted because Next's contract passes it
 31:  * and is deliberately NOT DESTRUCTURED, so no binding exists to render by
 32:  * accident. Structural, not a rule someone has to remember (CLAUDE.md §8 O-1).
 33:  *
 34:  * ⚠ AND THE ARM THAT PROTECTS IS NOT THE ONE YOU WOULD GUESS. In a production
 35:  * build React's Flight client already replaces a SERVER-side error with a fixed
 36:  * placeholder before it reaches the browser — "the specific message is omitted
 37:  * in production builds" — so for server throws this file has nothing left to
 38:  * leak. What it genuinely guards is the CLIENT arm: an error thrown in the
 39:  * browser or during hydration arrives here as the REAL, unsanitized `Error` in
 40:  * production too. Anyone later "improving" this to show `error.message` will
 41:  * check a server throw, see a placeholder, conclude production is safe — and be
 42:  * wrong for the arm that matters. Do not render it.
 43:  *
 44:  * ⚠ NO `loading.tsx` LANDS BESIDE THIS — R-C, stated in the very file D4 names
 45:  * (`(auth)/error.tsx`). A route-level fallback would blanket the whole debate
 46:  * surface on every navigation; if a specific read ever wants one it belongs
 47:  * in-page as `<Suspense>`, which is a different task.
 48:  *
 49:  * Copy and treatment follow the established state family — `(auth)/error.tsx`
 50:  * and `(public)/not-found.tsx` — with W2.11's generic-error title vocabulary.
 51:  * Template §11: the states must feel like one family.
 52:  *
 53:  * `"use client"` is a Next.js framework requirement for `error.tsx`, not new
 54:  * product logic.
 55:  */
 56: export default function DebateRouteError({
 57: 	reset,
 58: }: {
 59: 	error: Error & { digest?: string };
 60: 	reset: () => void;
 61: }): React.JSX.Element {
 62: 	return (
 63: 		<PageContainer
 64: 			preset="debate"
 65: 			data-testid="debate-error"
 66: 			className="text-center"
 67: 		>
 68: 			<h1 className="font-medium text-ink text-lg">Something went wrong.</h1>
 69: 			<p className="mt-2 text-n5 text-sm">
 70: 				An unexpected error stopped this page from loading.
 71: 			</p>
 72: 			<button
 73: 				type="button"
 74: 				onClick={reset}
 75: 				className="mt-6 inline-block font-medium text-ink text-sm underline-offset-4 outline-none hover:underline focus-visible:shadow-(--state-focus-ring)"
 76: 			>
 77: 				Try again
 78: 			</button>
 79: 		</PageContainer>
 80: 	);
 81: }
```

### G2 — ⛔ **NO. There is no leaking arm, in any environment. The relay's premise is wrong, and the conditional does not fire**

**Nothing in that file renders `error.message`, `.stack`, `.digest` or `.cause`, under any condition.**

| Probe | Result |
|---|---|
| `grep -n "process\.env\|NODE_ENV"` | **ZERO.** There is no environment branch in the file at all |
| `grep -n "error\."` | **7 hits, ALL inside the docblock** (`:12`, `:18`, `:24`, `:40`, `:45`, `:49`, `:53`) — six are filename prose (`global-error.tsx`, `(auth)/error.tsx`), one is `:40`'s *"Anyone later 'improving' this to show `error.message`"*. **Zero in the function body** |
| `grep -n "message\|stack\|digest\|cause"` | `:29`, `:30`, `:36`, `:40` — **all docblock prose**; `:59` — `error: Error & { digest?: string }`, a **TYPE ANNOTATION**, not a render |
| The destructuring pattern `:56-58` | `export default function DebateRouteError({ reset }: {` — binds **`reset` and nothing else**. `error` is declared in the type at `:59` and **never bound**, so no expression can reach it |

**⚠ `:34-42` IS A COMMENT, NOT AN ARM.** It is prose warning a *future* editor which arm would leak
*if someone rendered `error`* — the client arm, because React's Flight client sanitizes server errors
in production but not client-side or hydration throws. **It describes a hazard the file does not
have.**

**Consequence for the relay's conditional:** *"If G2 shows ANY leaking arm: adopt the family's VISUAL
shape and NOT that arm"* — **it does not fire. There is no arm to exclude.** The family's error-prop
handling is not a liability to route around; it is **the strongest part of the shape and is copied
deliberately**: accept `error` in the type, **never destructure it**, pinned by
`market-error-boundary.test.tsx:336-360` (`expect(pattern.replace(/[{}\s,]/g,"")).toBe("reset")`, with
`expect(types).toMatch(/\berror\b/)` as its positive control).

**⚠ And `bookmarks/error.tsx:8-13` ALREADY has this property** (§A A2). Item 6 preserves it; the §7
fence on the signature is what keeps it.

**Self-correction:** v1.2 §11 asked the auditor to check the client arm *"which is the one that leaks
in production."* Tightened in v1.3's §11 to: **the client arm is where a leak *would* surface if
anyone ever rendered `error` — nothing leaks today, on either arm.**

### G3 — ✅ **CONFIRMED, both halves. Adding a `className` to `bookmarks/error.tsx`'s `<PageContainer>` reddens the guard**

**(a) Yes**, `m/[slug]/error.tsx:63-67` carries `className="text-center"` on its `<PageContainer>`.

**(b) Yes**, `callSite()` reads `className` — `page-container.test.ts:131`:
`extras: tag[0].match(/className="([^"]*)"/)?.[1] ?? ""` — and the row assertion (`:141-143`) is
**class-set EQUALITY**: `expect(asSet(cn(CONTAINER_PRESETS[preset], extras))).toEqual(expected)`,
where `expected = asSet(\`${before} ${adds ?? ""}\`)`.

**SITES entry 4** (`:73-77`): `before: "mx-auto w-full max-w-3xl px-4 py-6"`, **no `adds`**, **no
`text-center`**. Adding `className="text-center"` puts `text-center` in the computed set and not in
`expected` → 🔴 **RED**.

**⇒ The centering goes on an INNER wrapper. Never a `className` on that tag.** Written into §3 as a
named divergence and into §9 as its own ⛔ condition, because copying the family file verbatim is
exactly how an executor reaches it.

**[v1.3] Two corrections/additions the relay did not have:**

- **`data-testid` IS SAFE.** `callSite()` reads **only** `preset` (`:125`) and `className` (`:131`).
  `data-testid` is not read. So `data-testid="bookmarks-error"` **can** sit on the `<PageContainer>`,
  matching the family exactly. **The divergence is one attribute wide — `className` — not two.**
- **Why `m/[slug]` gets away with it:** it is **not a `SITES` entry**. POLISH.3 declared it in a
  separate `GREENFIELD` array (`:126-132`) precisely because *"a greenfield site cannot carry a
  `before` … `SITES` stays at nine"* (`:119-124`). ⚠ Editing entry 4's `before` to admit
  `text-center` would be **the inversion that file's docblock (`:21-27`) exists to prevent** — and
  `page-container.test.ts` is not on the allow-list. **Inner wrapper. Confirmed.**

### G4 — `m/[slug]/error.tsx:1`, verbatim

```
// SPDX-License-Identifier: AGPL-3.0-or-later
```

**Present.** Adopted by item 6 (§3). Byte-copy, no invention.

### G5 — COUNTER-ARTIFACT SEARCH. **None found. The OD-4 line HOLDS** *(unprompted; the relay invited it)*

**(i) Is any ratified artifact putting P1 on a ROUTE boundary?** **No.** Canon `:223-230` (R9) reads:
*"P1's placement table gains **Discovery empty** and **Discovery error**."* It names **Discovery,
twice, and nothing else**. Discovery has **no route `error.tsx`** — `git ls-tree -r origin/main
"src/app/(public)"` yields exactly three: `bookmarks/`, `m/[slug]/`, `u/[pseudonym]/`.
`discovery/ErrorState.tsx` renders from an in-page RSC catch. **R9 never reached route boundaries.**

**(ii) Is any ratified artifact putting the family on an IN-SURFACE panel?** **No.** All three family
members are route-level; none is mounted inside a populated surface.

**(iii) Is the family actually consistent?** ✅ **Verified byte-for-byte across all three:**

| File | Container | h1 | p | Action |
|---|---|---|---|---|
| `(auth)/error.tsx` | `<div className="my-auto text-center">` — **no `PageContainer`**, because `(auth)/layout.tsx` supplies one | `Something went wrong.` | `An unexpected error stopped this page from loading.` | `<button>` `Try again` |
| `(public)/not-found.tsx` | `<PageContainer preset="notice" data-testid="public-not-found" className="text-center">` | `Not found.` | `This page doesn't exist, or the market isn't public yet.` | `<Link>` `Back to markets` |
| `(public)/m/[slug]/error.tsx` | `<PageContainer preset="debate" data-testid="debate-error" className="text-center">` | `Something went wrong.` | `An unexpected error stopped this page from loading.` | `<button>` `Try again` |

**The h1/p of the two ERROR members are byte-identical**, and **all three action classNames are
byte-identical**: `mt-6 inline-block font-medium text-ink text-sm underline-offset-4 outline-none
hover:underline focus-visible:shadow-(--state-focus-ring)`.

**And the container rule is stated, not inferred** — `m/[slug]/error.tsx:18-23`: *"declare one iff
your layout does not."* `(public)/layout.tsx` supplies none, so **`bookmarks/error.tsx` KEEPING its
`PageContainer` is family-CONSISTENT, not a divergence.** The only divergence is where `text-center`
sits (G3).

**⇒ The line is correct as ruled. Nothing on disk contradicts it.**

---

## §1 · Anchors — re-verified at `af3a070`. Re-run at STEP 0.3

| Anchor | Verdict | Receipt |
|---|---|---|
| `priceAtBet` absent from both `removed:false` arms of `ProfileArgumentItem` | ✅ **CONFIRMED** | `arguments.ts:59-95` — post arm `:59-76`, reply arm `:77-95`; the reply arm carries `stake` (`:91`), no price. Substrate carries it (`:217`, `:224`), unprojected |
| `BookmarkItem` = `Extract<…{removed:false}>` + 3 fields | ✅ **CONFIRMED** | `list.ts:43-53`; the `removed:false` arm is `:47-53` |
| No retry leaf under `src/components/ui/` | ✅ **CONFIRMED — and now IRRELEVANT IN EVERY BRANCH [v1.3]** | OD-4 consumes no leaf under any outcome. **D2b's leaf ruling stands for POLISH.5 ALONE** (S-1) |
| `/bookmarks` has no P1 empty block | ✅ **CONFIRMED** | inline `<p>` at `page.tsx:42-47` (ternary arm `:41-48`). **Item 4's anchor — unchanged** |
| PD-6 high-water mark | ✅ **NONE.** `grep -rn "PD-6-" docs src tests` → zero. **Next free `PD-6-01`** |
| File sizes | ✅ `BookmarkCard.tsx` 89 · `states.tsx` 28 · `page.tsx` 57 · `error.tsx` 21 · `side-encoding.test.tsx` 201 · `m/[slug]/error.tsx` **81** |
| P1 CTA tokens exist | ✅ `globals.css:219` `--r-chip` · `:199` `--state-hover-fill` · `:200` `--state-pressed-fill` · `:202` `--state-focus-ring` · `:222` `--dur-hover`. ⚠ **[v1.3] Only `--state-focus-ring` is used by item 6 now** — the family's button uses `hover:underline`, not a fill. The rest remain item 4's / unused |
| `page-container.test.ts` `SITES` | ✅ **9 entries at `af3a070`** (`:239`); `bookmarks/error.tsx` = **entry 4** (`:73-77`), `before: "mx-auto w-full max-w-3xl px-4 py-6"`; `page.tsx` = 2; `loading.tsx` = 3 |

**`LoadingBlock` (P7) IS on disk** — `src/components/ui/loading-block.tsx` (C10 / R8). Item 5's
dependency exists.

---

## §2 · What this plan does not do

- Does **not** touch any file under `src/server/**`. Item 1's field is **POLISH.5's to deliver**.
- Does **not** touch `BookmarkToggle.tsx` (POLISH.3 PR 2's, ruling D3) or `UnbookmarkButton.tsx`.
- Does **not** refactor `discovery/*` or `m/[slug]/error.tsx` or `(auth)/error.tsx` or
  `(public)/not-found.tsx`. **Read-only reference shapes.**
- ⛔ Does **not** touch `src/app/(public)/u/[pseudonym]/**` or `src/components/profile/**` —
  **F-7's twin defect is POLISH.5's**, measured here and handed over, **never fixed here**.
- Does **not** introduce `onRetry`. ⛔ **Unchanged at v1.4** — `error-block`'s action prop is
  `onAction`, and both consumers pass `reset()` from their own `"use client"` boundary. ⛔ **NEVER
  `window.location.reload()`** — `discovery/ErrorState.tsx:49` is the tempting model and copying it
  would silently downgrade this surface from a segment re-render to a full document reload, invisible
  to every test this surface has.
- Does **not** put a P1 panel on a route boundary. ⛔ **Unchanged at v1.4** — `JR-1` holds:
  `ui/error-block.tsx` renders the **route-boundary family**, not P1.
- ⚠ **[v1.4] Does not MINT or WRITE any `src/components/ui/` file.** It **imports two**. v1.3's *"does
  not mint or consume a retry leaf"* is **reversed as to CONSUME and unchanged as to MINT** — the
  distinction is the whole of `JR-5`. ⛔ **Editing a leaf to fit this surface is RUN-STOP 12.**
- Does **not** mint a `src/components/bookmarks/copy.ts` (F-8b) or a bookmarks page-size constant (S-6).
- Does **not** rename `states.tsx` after `BookmarksError` is deleted — `loading.tsx` imports it and is
  off the allow-list.

---

## §3 · THE SIX ITEMS — re-verified at `af3a070`, re-run at STEP 0.3

| # | Item | Ruling | Site(s) | Register | Discriminating condition |
|---|---|---|---|---|---|
| **1** | Render entry price on the side chip (`YES @ 27%`) | **P6-D03** | `BookmarkCard.tsx:46` **ONLY** — S-5 | `PD-6-01` | `grep -n "price=" …BookmarkCard.tsx` → zero. **⛔ HALT-ON-ABSENT (STEP 0.5).** Absent → **per-delta halt. NEVER add the field here.** ⛔ Edit no server file |
| **2** | Figures column word `Value` → `Current` | **P6-D04a** | `BookmarkCard.tsx:76-82` | `PD-6-02` | `grep -n "Value Đ" …BookmarkCard.tsx` → `:80`. **Zero ⇒ done.** Ground: `design-canon.md:49`, restated `:110` |
| **3** | `size="profile"` at **both** `SideBadge` sites | **P6-D05** (R12) | `BookmarkCard.tsx:32` **and** `:46` | `PD-6-03` | `grep -n 'size="profile"' …BookmarkCard.tsx` → zero. ⚠ **NOT `PD-5-01`** — POLISH.5's row |
| **4** | Empty state adopts **W2.11 P1** — ⚠ **[v1.4] BY IMPORTING `ui/empty-block.tsx`, NOT BY BUILDING A PANEL** | **P6-D06** · **OD-1** · **`JR-3`** | `page.tsx:42-47` | `PD-6-04` | `grep -n "EmptyBlock\|empty-block" …page.tsx` → zero. ⚠ **UNCHANGED IN SUBSTANCE BY OD-4 [v1.3]; CHANGED IN MECHANISM BY `JR-5` [v1.4]** — the panel is now a **consumed primitive**. ⛔ **This plan does not build a 148px panel by hand and does not write the leaf** |
| **5** | `BookmarksLoading` adopts **P7 `LoadingBlock`** | **P6-D07** | `states.tsx:1`, `:12` | `PD-6-05` | `grep -n "LoadingBlock" …states.tsx` → zero; three raw `<Skeleton>` at `:12`. **Non-zero ⇒ done** |
| **6** | **The error boundary adopts the ROUTE-BOUNDARY FAMILY** — ⚠ **[v1.4] BY IMPORTING `ui/error-block.tsx` UNDER B′, NOT INLINE** | **P6-D08 RE-RULED ×3 (OD-4 → `JR-1`+`JR-5`)** | `error.tsx` (whole render body + `:1` + `:3`) **and** `states.tsx:19-27` (**deletion**) | `PD-6-06` | `grep -n "ErrorBlock\|error-block" …bookmarks/error.tsx` → zero **and** `grep -n "BookmarksError" …states.tsx` → `:19`. **Either inverted ⇒ done** |

### ⚠ ITEM 4 — P1 IS STILL CORRECT HERE. ⚠ **[v1.4] THE MECHANISM CHANGES: IT IMPORTS THE LEAF**

**OD-4 does not move this item.** `/bookmarks`' empty state is an **IN-SURFACE state block**, rendered
inside `page.tsx`'s populated route — not a route-level boundary. **P1 is correct there.** The W2.11
**"Empty Bookmarks · id 18"** precedent (mockup `:195-199`) and **OD-1's carried string** both stand
unchanged.

> ### ⚠ **[v1.4] `JR-5` — ITEM 4 IMPORTS `src/components/ui/empty-block.tsx`. IT BUILDS NOTHING.**
>
> **THE SHAPE IS `docs/plans/POLISH-5.md` §1.5A.1's, CITED AND NOT RE-DERIVED HERE.** Props, marker, panel
> geometry and the tier rule all live there. What is `.6`-specific is stated below and nothing else.
>
> ```
> <EmptyBlock
>   message={BOOKMARKS_EMPTY_COPY.msg}
>   messageTestId="bookmarks-empty"
>   sub={BOOKMARKS_EMPTY_COPY.sub}
> />
> ```
>
> ⚠ NOT a stale line. The rename to bodyTestId is scoped to error-block, whose named node moved from heading to body under B′. empty-block has no heading/body split (POLISH-5.md §1.5A.1).
>
> **⚠ `.6` IS THE ONLY CONSUMER OF THE `sub` TIER, AND THAT IS RULED, NOT INCIDENTAL.** §1.5A.1's tier
> rule: *a tier is REQUIRED when every consumer has carried content for it, OPTIONAL when only some
> do, and ABSENT when none does.* **`.5`'s three sites have NO carried sub string and pass none;
> `.6`'s one site does.** ⇒ `sub` is **OPTIONAL** on the primitive and **PRESENT** here.
>
> ⛔ **NEITHER SURFACE AUTHORS A SUB STRING.** `.6`'s is carried **VERBATIM** from
> `DESIGN_W2_11_state-kit_mockup-v0_1.html:199`, in the *"Empty Bookmarks · id 18"* block (`:195`) —
> the tier-4 baseline for **this exact surface** — and restated at `DESIGN_W2_11_CLOSE-OUT.md:72`.
> Founder-ratified as **`OD-1`**. **Absence of a carried string means absence of the tier, never an
> invitation to write one.**
>
> ⛔ **NO ACTION PROP** (`JR-3`). `.6`'s empty state has no CTA and the primitive offers none.
> ⚠ **Scoped to the current consumer set, NOT "never"** — canon `:223-230` contemplates P1's optional
> single CTA and Discovery's no-results block ships one. **That block is POLISH.2's and CLOSED, so
> nothing is owed today** — recorded so a future adoption is not blocked by a prohibition canon
> contradicts.
>
> ⚠ **`page.tsx` STAYS SYMBOL-FENCED (§7).** Two write sites only: the module-scope copy const and
> the `:41-48` ternary's empty arm. **The import line joins them — it is part of the empty arm's
> change, not a widening.**

**The copy const is unchanged and still ships** — tests import it; it is never re-typed inline:

```tsx
/** W2.11 P1 copy — web-authored, VERBATIM (state-kit mockup :198, :199).
 *  Tests import these; they are never re-typed inline. */
const BOOKMARKS_EMPTY_COPY = {
	msg: "No bookmarks yet.",
	sub: "Saved arguments will appear here.",
} as const;
```

**THE LINE (quoted, per the ruling) — and it is what separates items 4 and 6:**

> **P1 governs IN-SURFACE state blocks. The heading-led family governs ROUTE-LEVEL boundaries.**

Ground, verified at G5: R9's error-panel extension reasons from **Discovery specifically**
(canon `:223-230` — *"P1's placement table gains Discovery empty and Discovery error"*), and Discovery
has **no route `error.tsx`**; `ErrorState.tsx` renders from an in-page RSC catch. **R9 never reached
route boundaries.** The family is `(auth)/error.tsx` → `(public)/not-found.tsx` →
`m/[slug]/error.tsx`, and the only two `(public)/` boundaries outside it are **exactly the two
carrying F-7's defect**.

### Item 6 — THE SHAPE · ⚠ **[v1.4] `JR-5` / VARIANT B′ — IT IMPORTS THE LEAF**

> ## ⛔ **[v1.4] v1.3's INLINE SHAPE IS SUPERSEDED. IT IS KEPT BELOW AS A RECORD, NOT DELETED.**
>
> **WHY IT CHANGED, stated so it is not re-argued.** v1.3 ruled the family renders **inline** and that
> `.6` consumes no `ui/` leaf **in any branch** (S-1). **That was sound on its own ground:** POLISH.5's
> leaf did not exist, its shape was unsettled, and `OD-4`'s question was *"P1 panel or family?"* — not
> *"inline or primitive?"*. **`JR-1` settled the first question in v1.3's favour and `JR-5` settles the
> second against it.** `ui/error-block.tsx` **renders the ROUTE-BOUNDARY FAMILY** (`JR-1`) and
> **POLISH.5 PR B mints it before this plan branches**. An inline byte-copy beside a shipped primitive
> of the same shape is the divergence the primitive exists to prevent.
>
> **⇒ ITEM 6 IMPORTS `src/components/ui/error-block.tsx`. IT WRITES NEITHER THAT FILE NOR ANY OTHER
> UNDER `src/components/ui/`.**
>
> **THE SHAPE IS `docs/plans/POLISH-5.md` §1.5A.2's, CITED AND NOT RE-DERIVED.** Props, marker, the internal
> heading const, the treatment classes and the `reset()` rule all live there.
>
> ```
> <ErrorBlock
>   body={BOOKMARKS_ERROR_COPY.load}
>   bodyTestId="bookmarks-error"
>   actionLabel="Try again"
>   onAction={reset}
> />
> ```

> ### ⚠ **[v1.4] `OD-2`'s STRING RETURNS, AND THAT DISCHARGES A LOGGED LOSS**
>
> Under **B′** the **body tier is REQUIRED** and **each consumer passes its own carried surface
> string**. `/bookmarks` passes **`"Couldn't load your bookmarks."`**
>
> ⚠ **NO STRING IS AUTHORED. IT IS A CLEAN SENTENCE SPLIT OF A LIVE STRING AT ITS SENTENCE BOUNDARY**,
> with the trailing action phrase routed to `actionLabel`:
>
> | | Live at `states.tsx:25` | Under B′ |
> |---|---|---|
> | body | `Couldn't load your bookmarks. Tap to retry.` | **`Couldn't load your bookmarks.`** |
> | actionLabel | — | **`Try again`** — byte-copy of `m/[slug]/error.tsx:77`, verified at head |
>
> ⇒ **This is a sentence split, NOT `F-4`'s rejected mid-sentence word extraction.** `"Tap to retry."`
> is dropped; nothing is invented.
>
> ✅ **AND IT DISCHARGES A LOSS THE PLAN-CHAT CLOSE-OUT LOGGED AS KNOWINGLY ACCEPTED** — *"the
> deliberate loss of surface-specific error copy"* under `OD-4`. ⛔ **`OD-4` did not reject `.6`'s
> string. It removed the tier that could hold it. B′ gives the tier back.** ⚠ **§6's "one deliberate
> visible change" is therefore NARROWER than v1.3 recorded: the heading and the button go generic;
> the body stays this surface's own.**
>
> ⚠ **THE HONEST COST, RECORDED.** `m/[slug]/error.tsx` uses the family's generic body, so **two of
> four boundaries carry a surface line and two do not.** That divergence falls on a principled line —
> *surfaces with a carried string vs surfaces without* — and `m/[slug]` is a **recorded adoption debt**
> for whichever task owns it next. ⛔ **NOT this plan's** (§2, §7).

> ### ⚠ **[v1.4] `OD-7` = BESIDE IS ADOPTED. `.6`'s CONTAINER-LEVEL PLACEMENT IS WITHDRAWN.**
>
> v1.3 put `data-testid="bookmarks-error"` on the **`<PageContainer>`** and measured it **guard-safe**
> — `callSite()` reads `preset` + `className` only (G3). ⚠ **That measurement STANDS and is not
> retracted: the placement was SAFE.** **It was not RIGHT.**
>
> **`OD-7` rules BESIDE**, so the testid lands on the **body node inside the leaf**, under
> **`bodyTestId`** — ⚠ **renamed from the kickoff's earlier `messageTestId` because the node it names
> moved, not because the ruling did.** Under B′ the surface-specific line is the **body**.
>
> ⛔ **The marked subtree excludes the button and the `h1`.** ⛔ **Never on the container** — that is
> `m/[slug]/error.tsx:65`'s shape and this plan does not copy it.
>
> ⚠ **`data-testid` on the `<PageContainer>` remains guard-SAFE if anything ever needs it. Item 6 no
> longer uses it.** Recorded so a reader does not mistake a withdrawal for a correction of the
> measurement.

**⛔ THE SUPERSEDED v1.3 SHAPE, KEPT AS A RECORD.** `error.tsx` rendered the family treatment
**INLINE**, every string and className a **BYTE-COPY** from `m/[slug]/error.tsx` (cross-checked
against `(auth)/error.tsx`, G5). **The byte-copy analysis below remains the authority for WHAT the
family says and how it is styled — it is now discharged by the primitive rather than by hand:**

| Element | Value | Source |
|---|---|---|
| `:1` | `// SPDX-License-Identifier: AGPL-3.0-or-later` | `m/[slug]/error.tsx:1` (G4) — **byte-copy** |
| `:2` | `"use client";` — **unmoved**, still line 1 of code | already present (A1) |
| import | `PageContainer` only. ⚠ **`BookmarksError`'s import is ORPHANED — delete it** | see the orphan note |
| container | `<PageContainer preset="reading" data-testid="bookmarks-error">` — ⚠ **`preset` unchanged and FENCED; `data-testid` is guard-safe (G3); NO `className`** | family + G3 |
| centering | ⚠ **NAMED DIVERGENCE:** an inner `<div className="text-center">` wrapping h1/p/button | forced by G3 |
| `h1` | `<h1 className="font-medium text-ink text-lg">Something went wrong.</h1>` | `m/[slug]:68` — **byte-copy** |
| `p` | `<p className="mt-2 text-n5 text-sm">An unexpected error stopped this page from loading.</p>` | `m/[slug]:69-71` — **byte-copy** |
| `button` | `<button type="button" onClick={reset} className="mt-6 inline-block font-medium text-ink text-sm underline-offset-4 outline-none hover:underline focus-visible:shadow-(--state-focus-ring)">Try again</button>` | `m/[slug]:72-78` — **byte-copy** |
| signature | **UNCHANGED and FENCED.** `{ reset }` destructured alone; `error` declared in the type, never bound | A1/A2 + G2 |
| `states.tsx` | **`BookmarksError` DELETED.** `states.tsx` then exports `BookmarksLoading` alone | — |
| `onRetry` | ⛔ **NEVER INTRODUCED.** Removed from §5, §7, §8 and §11 | OD-4 |

**Copy fit — checked, not assumed.** Both family strings are **surface-agnostic** (*"this page"*), so
they fit `/bookmarks` **verbatim**. **No string names the wrong surface; no new copy is authored.**

⚠ **A deliberate consequence, recorded so Gate C does not file it as a regression.** The current
`"Couldn't load your bookmarks."` is surface-**specific**; the family's is **generic**. ⚠⚠ **[v1.4] THIS PARAGRAPH IS NARROWED BY B′ AND THE NARROWING IS THE POINT: the BODY keeps this surface's own string. Only the HEADING and the BUTTON go generic.** The analysis below governs those two and is retained verbatim; the body's specificity is **no longer given up** (see item 6's B′ block). Under v1.3 that specificity was **given up on purpose** — `m/[slug]/error.tsx:49-51` states the family uses *"W2.11's
generic-error title vocabulary … the states must feel like one family."* Genericity is the ruling's
point, not an oversight. `"Tap to retry."` is deleted with it.

**Orphans this change creates (§5.3, in scope by definition):**

- `states.tsx:1` — `import { Skeleton } …`, used only at `:12`. **Item 5 orphans it.** Remove in the
  same commit or `biome`/`tsc` reddens.
- 🔴 **[v1.3 CORRECTION OF v1.2] `error.tsx:3` — `import { BookmarksError } from "@/components/bookmarks/states";` IS ORPHANED and MUST be removed.** v1.2 §3 stated *"Item 6 orphans nothing in
  `error.tsx` … No import moves."* **That was true under OD-2's shape** (where `BookmarksError`
  survived and merely gained a prop). **Under OD-4 it is FALSE** — `BookmarksError` is deleted, so the
  import must go or `tsc` reddens on a missing export. Correcting my own v1.2 statement.
- After items 5 + 6, `states.tsx` imports **`LoadingBlock` alone** and exports **`BookmarksLoading`
  alone**. Nothing else is orphaned inside it — `BookmarksError` was a bare `<p>` using no import.
- Items 1–4 orphan nothing.

---

## §4 · Item 2 — WHICH QUANTITY THE COLUMN HOLDS

`BookmarkCard.tsx:76-82` renders **two** figures. The rename touches **only the second word**.

```
Staked Đ {formatDharma(item.staked)}  ·  Value Đ {formatDharma(item.current)}
         └─ unchanged ─┘                  └ → "Current" ┘   └─ unchanged ─┘
```

| Column word | Field | What it is | On disk |
|---|---|---|---|
| `Staked` (unchanged) | **`item.staked`** | **Đa** — the bookmarked AUTHOR's current `SideEpisode` staked basis in that market on the card's frozen side S; `0` unless held on S | `figures.ts:39-40`, computed `:104-107` |
| `Value` → **`Current`** | **`item.current`** | **Đb** — the author's settled net Σ `payout_events.amount` if settled, else live `computeSell` proceeds; `0` unless held on S | `figures.ts:41-42`, computed `:109-118` |

### ⚠ The `stake` / `staked` trap — same root, different meanings

- **`item.stake`** — `arguments.ts:91`, *"The reply-bet's own stake — the §3.6 reply ruler."* One
  bet's stake, inherited through the `Extract`. It is the **ordering ruler**, and `BookmarkCard`
  **renders it nowhere**.
- **`item.staked`** — `list.ts:50`, Đa. The author's **episode basis across all their bets on side S
  in that market**.

An author who replied with Đ50 while already holding Đ1000 of basis on that side has
`item.stake = "50.000…"` and `item.staked = "1000.000…"`.

**The column holds `item.staked`. Do not re-point it at `item.stake`.**

**Guard note.** `no-raw-dharma-render.test.ts:26` scans `src/components`; `MONEY_IDS` (`:36-79`) lists
`staked`, `current` **and** `stake`; `RAW_RENDER` (`:85-87`) matches a bare `{…staked}` / `{…current}`
JSX child. Item 2 edits literal text **outside** `{}`, so the guard holds — and it is *why* both
interpolations must stay wrapped in `formatDharma`.

---

## §5 · TEST PINS — re-verified at `af3a070`, re-run at STEP 0.6

### Item 1 — the one existing file that moves

`tests/unit/bookmarks/render/side-encoding.test.tsx` — 🔴 **BREAKS BY DESIGN, at two assertions:**

| Line | Assertion | Why it breaks |
|---|---|---|
| `:98-104` + `:122` | `sideChip()` matches `el.textContent?.trim() === side`; `:122` asserts `not.toBeNull()` | With a price, `badges.tsx:166` emits `` `${side} @ ${pct}` `` → text is `"YES @ 27%"` → selector returns `null`. Same at `:135` |
| `:149-151` | `getAttribute("aria-label")).toBe("YES side")` | `badges.tsx:155-157` emits `"YES side, entry price 27%"` when `price` is defined |

**Recapture per V-1 (capture-after-change), in item 1's own commit.** Widen `sideChip`'s predicate
from equality to a side-anchored prefix match; relax `:149-151` to the priced label. ⚠ A **selector**
change, not an assertion deletion — the file's own `:106-114` docblock is about a false negative from
sloppy matching (O-3). The widened helper also serves item 3's assertions. **If item 1 halts at 0.5,
the helper is untouched** and item 3's assertions ride the existing equality selector, correct in that
world.

### Assertions that stay GREEN (measured, not assumed)

| Lines | Assertion | Why it holds |
|---|---|---|
| `:126-127`, `:139-140` | `bg-yes`/`text-no`, `bg-no`/`text-yes` | **POLE TOKENS, not geometry** — `badges.tsx:163`'s side ternary, independent of `CHIP[size]` |
| `:129-130`, `:141-142`, `:199` | `not.toContain("bg-primary"/"bg-secondary")` | `CHIP.profile` (`badges.tsx:83`) contains neither substring |
| `:182-183`, `:196-197` | the **removed**-variant chips | Item 1 does **not** reach `:32` (S-5) → the removed chip's text stays exactly `"NO"`/`"YES"` → the selector still matches |
| `:155-175` | the `PositionMarker` block | untouched by every item |

### The greenfield guards — one new file

**`tests/unit/bookmarks/render/surface-states.test.tsx`** *(new)*. Covers **items 4, 5, 6**.

⚠ **[v1.3] A stated divergence from `market-error-boundary.test.tsx`'s one-file-per-boundary shape.**
The allow-list admits exactly **one** new test file, and these three are one subject — *what
`/bookmarks` renders when it has nothing to render* (empty · loading · error boundary). That is a
coherent AGENTS.md §9 subject; splitting it would need a second file the allow-list does not admit.

| Item | Assertion | Model |
|---|---|---|
| **4** | The empty block is the P1 panel and carries both strings | Assert `min-h-[148px]`, `bg-n0`, `rounded-[var(--r)]`, `[border:var(--hairline)]` as **exact class tokens**; assert `.msg`/`.sub` **through the copy const**, never re-typed (`discovery/EmptyState.tsx:20-24`). Assert **zero** `button, a` — P1's CTA is absent on Empty (`discovery/render/surface-states.test.tsx:199-204`) |
| **5** | P7 adopted, shadcn marker preserved | `querySelectorAll("[data-loading-block]")` → length **3**; every block's `data-slot === "skeleton"`. **Mirror `discovery/render/surface-states.test.tsx:181-197`** — that shape exists because overriding `data-slot` silently dropped the marker once |
| **6** | **[v1.3 REWRITTEN — no `onRetry`; the subject is the ROUTE FILE]** | **PRIMARY MODEL: `tests/unit/debate/render/market-error-boundary.test.tsx`.** Import the default export directly, its `:9` idiom: `import BookmarksRouteError from "@/app/(public)/bookmarks/error";`. Then its four load-bearing shapes: (1) **family copy** — `root.querySelector("h1")?.textContent` **exact-equals** `"Something went wrong."`, the `p` its sentence, the `button` `"Try again"` (`:90-99`); (2) **the reset wiring** — `fireEvent.click(screen.getByText("Try again"))` + `expect(reset).toHaveBeenCalledTimes(1)` (`:101-109`); (3) **the container-wide no-leak sweep** — `container.innerHTML` must not contain the thrown `message`/`stack`/`digest`/`cause` (`:112-`, `:244-267`); ⚠ **ABSENCE assertions are container-wide, PRESENCE assertions are targeted** (`:20-35`); (4) **the source-read structural pin** (`:336-360`) — strip comments, match the signature, `expect(pattern.replace(/[{}\s,]/g,"")).toBe("reset")` with `expect(types).toMatch(/\berror\b/)` as the positive control. ⛔ **NO snapshot, NO byte-pin** (`:37-38`) |

**Harness:** `// @vitest-environment jsdom` on **line 1**. **No jest-dom** (AGENTS.md §9) — plain DOM
assertions only. `PageContainer` renders in jsdom — `market-error-boundary.test.tsx` proves it.

**Item 3's pin goes into `side-encoding.test.tsx`, NOT the new file — a stated deviation.** Item 3
changes the **BookmarkCard side chip**, and `side-encoding.test.tsx` is *the* file whose subject is
exactly that — already allow-listed, already holding the pole-token census, already the file item 1
moves. Routing it elsewhere splits the chip's coverage. **This widens nothing.** Assertions:
`CHIP.profile`'s seven flattened tokens at **both poles** and **both call sites**, modelled on
`side-badge.test.tsx:333-380`.

**Item 2 needs no test** — one literal word.

### Items 2–6 — what was grepped, and where. **Every one: none found**

| Item | Command | Result |
|---|---|---|
| **2** | `grep -rn "bookmark-figures" tests src` | 3 hits in `tests/server/bookmarks/list.test.ts` (`:542`, `:592`, `:660`) — FI-2 figure **values**, never the label word |
| **2** | `grep -rn "Value Đ\|Staked Đ" tests src` | one hit, `BookmarkCard.tsx:80` — the source. **No test pins the word** |
| **2** | `grep -rniw "value" tests/server/bookmarks tests/unit/bookmarks` | 2 hits, both prose in comments. **none found** |
| **3** | `grep -rn 'size="profile"\|CHIP\.profile' tests src` | `side-badge.test.tsx:348-359` pins the **preset string**; nothing pins a `/bookmarks` call site |
| **3** | `grep -rn "SideBadge" tests \| grep -i bookmark` | **none found** |
| **4** | `grep -rn "bookmarks-empty" tests src` | one hit, `page.tsx:43` — the source. **No test** |
| **4** | `grep -rn "No bookmarks yet" tests` | **none found** |
| **5** | `grep -rn "bookmarks-loading" tests src` | one hit, `states.tsx:10` — the source. **No test** |
| **6** | `grep -rn "bookmarks-error" tests src` | one hit, `states.tsx:22` — the source. **No test** |
| **6** | `grep -rn "Tap to retry" tests src docs` | one hit, `states.tsx:25` — the source. **No test, no copy-register entry.** ⚠ Its deletion reddens nothing |
| **6** | `grep -rn "bookmarks/error\|bookmarks/loading" tests` | **only `page-container.test.ts` SITES rows** — no test renders either route file |
| **6** | `grep -rn "BookmarksError" src tests` | `states.tsx:19` + `error.tsx:3,:17` **only** — the deletion breaks no third consumer |

### Auto-enrolling guards — every allow-list file is in scope

| Guard | Scope | Verdict |
|---|---|---|
| `no-raw-hex-view-layer.test.ts:20` | `["src/components", "src/app/(public)"]` | ✅ holds — **[v1.3]** every byte-copied family className is a token (`text-ink`, `text-n5`, `focus-visible:shadow-(--state-focus-ring)`); item 4's P1 block likewise. ⛔ **A raw hex reddens it.** Does **not** scan `docs/` |
| `no-raw-dharma-render.test.ts:26` | same + `(admin)` | ✅ holds — §4 |
| `pct-round-render.test.ts:26,52` | same + `debate-export`; `EXPECTED_ALLOW_MARKERS = 3` **exact** | ✅ holds — item 1 passes a **prop**; S-4 |
| `page-container.test.ts:73-77`, `:119-133`, `:239` | `SITES` 2/3/**4** = `bookmarks/{page,loading,error}.tsx`; `callSite()` reads **`preset` + `className` only** | ⚠ **HOLDS ONLY IF NO `className` IS ADDED** — G3. `data-testid` is safe; `className` is 🔴. **Item 6's single most likely trip** — ⛔6 |
| `page-container.test.ts:126-138` | `GREENFIELD` array + the `CALL_SITE_ROOTS` tree census | ✅ holds — **[v1.3]** item 6 **keeps** the existing `<PageContainer>`; it adds no new call site, so the census is unmoved and no `GREENFIELD` row is needed |
| `tests/unit/docs/session-logs-survive.test.ts:50-58` | `git ls-tree … HEAD docs/logs/` | ✅ **C0 is safe** — the set is `docs/logs/` only; `docs/plans/POLISH-6.md` never enters it |

---

## §6 · FINDINGS

### ✅ S-1 · RESOLVED — and **[v1.3]** the `ui/` leaf now stands for POLISH.5 **ALONE**

v1.0's finding stands and was accepted. The original premise — *"a screen-reader user is instructed to
perform a gesture that does nothing"* — was measurably false: `error.tsx:16-18` already wraps
`<BookmarksError />` in a live `<button onClick={reset}>`. The **real** defects: (1) a `<p>` (flow
content) nested in a `<button>` (phrasing-content model) — **invalid HTML**; (2) no focus/hover/pressed
treatment; (3) a whole-panel click target.

**OD-4 fixes all three by adoption rather than by construction.** The family's shape is a heading, a
paragraph and **one** underline text button — no nesting violation, `focus-visible:shadow-(--state-focus-ring)`
present, and the button is the only interactive element.

⚠ **[v1.3] D2b's `ui/` retry-leaf ruling now stands for POLISH.5 ALONE, and `.6` is NOT its consumer
in ANY branch.** v1.2 kept a conditional door open (STEP 0.8 / ⛔5): if `.5` minted the leaf first,
`/bookmarks` consuming it became a live question. **OD-4 closes that door in every direction** —
item 6 renders inline, imports nothing from `src/components/ui/`, and would not consume a leaf even
if one existed at execute. **STEP 0.8 and ⛔5 dissolve.** Recorded explicitly so `.5` inherits no
false dependency from `.6`'s outcome, and `.6` inherits none from `.5`'s.

### 🔴 F-1 · The wrapper is at `:16-18`, NOT `:15-17` — and `:15` is the fenced line. **STILL APPLIES**

| Line | Content |
|---|---|
| `:15` | `<PageContainer preset="reading">` ← **the fenced tag** |
| `:16` | `<button type="button" onClick={reset} className="block w-full text-left">` |
| `:17` | `<BookmarksError />` |
| `:18` | `</button>` |

**A line-keyed removal of `:15-17` deletes the `<PageContainer>` opening line and orphans
`</button>`** — a syntax error and a fence violation. **Under OD-4 the whole render body is rewritten,
so remove the wrapper BY SYMBOL** — `:15`'s tag is *kept* (gaining only `data-testid`), `:16`/`:18`
go, `:17` is replaced by the family body.

### 🔴 F-2 · `error.tsx` is `page-container.test.ts` SITES entry **4**, not 3 — re-verified at `af3a070`

| Entry | File |
|---|---|
| 2 (`:64-65`) | `bookmarks/page.tsx` |
| 3 (`:69-70`) | `bookmarks/**loading**.tsx` |
| **4** (`:73-77`) | `bookmarks/**error**.tsx` — `before: "mx-auto w-full max-w-3xl px-4 py-6"` |

**Survives the `af3a070` advance:** `SITES` is still 9 and nothing renumbered. ⚠ **[v1.3] Entry 4's
`before` is now doubly load-bearing** — it is also what G3's ⛔6 protects.

### ✅ F-3 · P1's `.sub` and CTA are each independently optional — **item 4's ground, unchanged**

Census of every `.emptyblk` in `DESIGN_W2_11_state-kit_mockup-v0_1.html`:

| Lines | Block | Shape |
|---|---|---|
| `:187-189` | No-results · filter (Discovery), id 2 | `.msg` + `.cta`, **no `.sub`** |
| `:197-199` | **Empty Bookmarks**, id 18 | `.msg` + `.sub`, **no CTA** ← **item 4's precedent** |
| `:207-209` | No positions | `.msg` + `.sub`, no CTA |

⚠ **[v1.3] F-3 no longer bears on item 6 at all** — item 6 is not a P1 block. It remains item 4's
ground, and item 4 ships **`.msg` + `.sub`, no CTA**, exactly as id 18 specifies.

### ⛔ F-4 · **DISSOLVED [v1.3].** `"Try again"` is a BYTE-COPY, not a composition

v1.2's F-4 (rewritten at D-3) recorded that `"Retry"` carried its **verb** from `profile/copy.ts:24`
(`"Couldn't load this profile. Retry."`) while the **standalone label** was a composition, not a
byte-copy — a grade distinction that mattered because "carried verbatim" is this repo's line between
carried and authored copy (CLAUDE.md §3).

**OD-4 removes the composition entirely.** `"Try again"` is a **byte-copy from
`m/[slug]/error.tsx:77`**, cross-verified byte-identical in `(auth)/error.tsx` (G5). So are the
heading and the paragraph. **Nothing in item 6 is authored, composed or extracted — every string is
lifted whole from a ratified file on `main`.** The provenance question F-4 existed to answer no
longer arises.

⚠ **Recorded, not deleted**, for two reasons: (a) `profile/copy.ts:24` remains the copy of **F-7's
twin defect**, so the string is still evidence in that finding; (b) a reader of v1.2 must be able to
see why the row vanished rather than assume it was dropped.

### 🟡 F-5 · **[v1.3] DISSOLVES with `BookmarksError`**

v1.2 recorded a latent fragility: with no `"use client"` on `states.tsx`, a future Server Component
consumer of `BookmarksError` would compile and crash at render.

**OD-4 deletes `BookmarksError`.** `states.tsx` is left exporting `BookmarksLoading` alone, whose only
consumer is `loading.tsx` — a Server Component — and which takes no handler. **`states.tsx` never
enters the client graph at all.** The fragility has no subject. `states.tsx` stays directive-free, now
for a stronger reason than before.

### ✅ F-6 · **RULED (OD-4).** The two treatments are not in conflict — they occupy different slots

`af3a070` landed `m/[slug]/error.tsx` with a heading-led, underline-button, `"Try again"` treatment,
citing `PD-7a-04`/`R-C` and *"the states must feel like one family"* (`:49-51`). v1.2 surfaced this as
OD-4 because OD-2's P1 panel would have made `/bookmarks` the only `(public)/` route boundary
diverging from it, with a third CTA label.

**RULED, and the line is quoted in §3:** *P1 governs IN-SURFACE state blocks; the heading-led family
governs ROUTE-LEVEL boundaries.* **G5 found no counter-artifact** — R9 names Discovery twice and
nothing else, Discovery has no route boundary, and all three family members verify byte-consistent.

**Consequences, all applied:** item 6 adopts the family; item 4 is **untouched**; `/bookmarks` stops
being the odd one out; and the CTA-label question dissolves into a byte-copy (F-4).

### 🔴 F-7 · The identical defect on POLISH.5's surface — **NOW RULED ONCE, BINDING ON BOTH [v1.3]**

`src/app/(public)/u/[pseudonym]/error.tsx` at `af3a070`, in full:

```tsx
"use client";
import { ProfileError } from "@/components/profile/states";
import { PageContainer } from "@/components/shell/PageContainer";

export default function ProfileRouteError({ reset }: { error: …; reset: () => void }) {
	return (
		<PageContainer preset="reading">
			<button type="button" onClick={reset} className="block w-full text-left">
				<ProfileError />
			</button>
		</PageContainer>
	);
}
```

and `src/components/profile/states.tsx:27-35`:

```tsx
export function ProfileError(): React.JSX.Element {
	return (
		<p data-testid="profile-error" className="py-12 text-center text-sm text-n5">
			{PROFILE_COPY.error.load}
		</p>
	);
}
```

**Byte-for-byte the same defect** as `/bookmarks`: same whole-panel `<button>`, same `className`, same
`<p>`-inside-`<button>` content-model violation, same missing focus treatment, same `preset="reading"`
container. **S-1 is a two-surface pattern defect.**

**⚠ [v1.3] THE §3 LINE IS A CROSS-SURFACE RULING, AND IT GOVERNS `u/[pseudonym]/error.tsx`
IDENTICALLY.** POLISH.5 **CITES it, and does not re-derive it.** Two surfaces independently
re-deriving one shape is **exactly how D2b and D3 went wrong on this task** — D2b reasoned from
Discovery's handler-less RSC catch and produced a `ui/`-leaf requirement that `/bookmarks` never had,
and OD-2 then ruled a P1 panel from evidence that `af3a070` superseded three hours later. The ruling
is written once, here, and both surfaces read it.

**⛔ SCOPE IS UNCHANGED. `.6` STILL NEVER EDITS `src/app/(public)/u/**` OR `src/components/profile/**`.**
The §7 struck-list entry and the §7 deny-belt lines **stay**. **STEP 0.9 stays:** if `.5` has already
shipped its half at execute, **its shape is the one to match** — the ruling names the family, and `.5`'s
rendering of it is the tiebreak on any detail the family leaves open.

### 🟡 F-8 · **[v1.3 UPDATED]** SPDX — now IN scope for `bookmarks/error.tsx` only

`git grep -l "^// SPDX-License-Identifier" origin/main -- src` → **10 files of 283.** Not repo-wide,
but it covers five of the seven error/not-found boundary files, **including all three family members**:
`(auth)/_components/AuthAlert.tsx` · `(auth)/error.tsx` · `(public)/m/[slug]/error.tsx` ·
`(public)/not-found.tsx` · `global-error.tsx` · `not-found.tsx` · `shell/DharmaCluster.tsx` ·
`shell/PageContainer.tsx` · `server/dharma/header-{balance,portfolio}.ts`

**Absent from `(public)/bookmarks/error.tsx` and `(public)/u/[pseudonym]/error.tsx`** — the same two
files as F-7's defect.

**⚠ v1.2 said "noted, NOT actioned." OD-4 changes that for ONE file:** the SPDX line is **part of the
family adoption** and is added to `bookmarks/error.tsx:1`, byte-copied per G4. ⛔ **`u/[pseudonym]/error.tsx`
is still NOT touched** — POLISH.5's, under the same cross-surface ruling. ⛔ **No other file gains one.**

**F-8b — a copy-module precedent exists and is still NOT adopted.** `src/components/profile/` carries
both `states.tsx` and `copy.ts` (`PROFILE_COPY`). `/bookmarks` has no `copy.ts`, and minting one would
widen the allow-list. Item 4's copy const stays co-located in `page.tsx` (the `discovery/EmptyState.tsx`
pattern). ⚠ **Item 6 needs no copy const at all** — the family strings are inline in the family files
and are byte-copied inline here.

### 🟢 S-4 · The PCT.ROUND guard structurally enforces *"pass the prop only"*

`pct-round-render.test.ts:52` pins `EXPECTED_ALLOW_MARKERS = 3` — an **exact** count across
`src/components` — and `:78-102` flags any `formatPercentUnpaired(` without a marker in the preceding
five lines. Item 1 passes `price={…}` as a **prop**; formatting happens inside `badges.tsx:152` under
the marker at `:150`. **The count stays 3.** Formatting at the call site adds a fourth marker or an
unmarked offender and reddens the guard — a mechanism, not discipline (O-1).

### 🔴 S-5 · Item 1 touches ONE site; item 3 touches TWO

`BookmarkCard.tsx:32` is the **`removed === true`** arm —
`Extract<ProfileArgumentItem,{removed:true}> & { authorPseudonym }` (`list.ts:44-46`) — which carries
**no price field and never will**, because the `Extract` split is the compile-enforced masking boundary
(`list.ts:38-41`). A price prop there is a **TS error**. `:46` is the live arm.

**Item 1 → `:46`. Item 3 → `:32` and `:46`.** Also why `side-encoding.test.tsx:182-183` / `:196-197`
stay green.

### 🟠 S-6 · OD-3 RULED — keep 3, record the knowing partial

Canon §10's P7 rules *"Count — sourced from the surface's own constant, never a literal."* **There is
no bookmarks equivalent.** `limits.ts:200` has `DISCOVERY_GRID_SIZE = 8` and nothing for bookmarks;
`loadBookmarks` is **unpaginated** (`list.ts:99-102`); `states.tsx:11` uses `["a","b","c"]`.

**Item 5 discharges the *primitive* clause and NOT the *count* clause.** Minting a
`BOOKMARKS_SKELETON_COUNT` would be new server API (off the allow-list) for a single consumer — §5.2.
**Knowingly accepted partial**; canon note batched to close-out (§12).

### 🟡 S-7 · Item 2 may re-wrap the JSX

`Value` (5) → `Current` (7) crosses Biome's 80-col width; the `{" "}` at `:80` is a wrap artifact. Run
`just format` and accept the re-wrap. Not a regression.

### ✅ S-8 · RESOLVED — coverage lands

**D-D collapsed the eye pass from eight per-surface passes to ONE comprehensive pass**, so *"the eye
pass verifies it"* carries far less than v1.0 assumed. The allow-list widens by one test file. **Item 2
alone stays untested** — one literal word. **CLAUDE.md §5.6 still does not fire** (no bet, Dharma,
payout, comment, side, resolution, media or moderation logic).

### 🟢 S-9 · SC-1 (§5.14) — checked, does not fire

No allow-list file adds or edits a read over `comments`. `BookmarkCard` renders a DTO from the
untouched `loadBookmarks`, whose masking runs through `loadRemovedSet` (`list.ts:394`) into the
compile-enforced union. Item 1's field lands **only** on the `removed:false` arm (S-5), so no masked
value can reach the chip. Recorded because SC-1 fires independently of the trigger table.

### ⛔ S-3 · VOID — OD-1 removed the `<COPY-PENDING>` placeholder entirely

Retained as a struck row so a reader of all four versions is not left hunting for it. Item 4's copy
const still ships — for the `EMPTY_COPY` discipline, not to dodge a parse error (§3).

### ℹ️ S-10 · `PositionMarker` — tracker RR-4 inspected, not actioned

`docs/polish/POLISH-TRACKER.md:74` (**RR-4**): the outline→filled delta is a **founder-ACCEPTED known
delta**, *"Do not re-file."* `BookmarkCard.tsx:51` renders it. **No item touches it.**

---

## §7 · ALLOW-LIST — **seven files**. A file not on this list cannot be written. An import cannot widen it

| # | Path | Items |
|---|---|---|
| 1 | `src/components/bookmarks/BookmarkCard.tsx` | 1, 2, 3 |
| 2 | `src/components/bookmarks/states.tsx` | 5, **6 (DELETION of `BookmarksError`)** |
| 3 | `src/app/(public)/bookmarks/page.tsx` | 4 — **symbol-fenced** |
| 4 | `src/app/(public)/bookmarks/error.tsx` | 6 — **symbol-fenced** |
| 5 | `tests/unit/bookmarks/render/side-encoding.test.tsx` | 1, **3** |
| 6 | `tests/unit/bookmarks/render/surface-states.test.tsx` **(new)** | 4, 5, 6 |
| 7 | `docs/plans/POLISH-6.md` | **this plan**, per CLAUDE.md §5.1 — **doc-only, its own commit (C0), before Phase 1 ends** |

⚠ **Entry 7 is the ONLY `docs/` path admitted.** No other `docs/` file may be written by this task.
⚠ **Halt records live at `~/Downloads/POLISH-6-HALT-<n>.md`, OUTSIDE the repo** — not a repo write,
no allow-list entry needed (§9A carve-out c).

**⛔ Not on the list, each on independent ground:**

| Struck | Ground |
|---|---|
| `src/app/(public)/bookmarks/loading.tsx` | Item 5 changes `BookmarksLoading`'s *body* in `states.tsx`; the mount is untouched. ⚠ `page-container.test.ts` **SITES entry 3** |
| **`src/app/(public)/u/[pseudonym]/error.tsx` · `src/components/profile/{states,copy}.tsx`** | **F-7's twin defect. POLISH.5's surface, under the SAME cross-surface ruling.** Measured here, handed over, **never fixed here** |
| `src/app/(public)/m/[slug]/error.tsx` · `src/app/(auth)/error.tsx` · `src/app/(public)/not-found.tsx` | **The family. Read-only.** Item 6 byte-copies from them; it never writes them |
| `src/components/ui/**` | ⚠ **[v1.4] IMPORT-ONLY, NEVER WRITE.** `JR-5` reverses v1.3's *"consumes no leaf in any branch"*: **item 4 imports `empty-block.tsx`, item 6 imports `error-block.tsx`**, and **POLISH.5 PR B mints both before this plan branches**. ⛔ **This plan writes NOTHING under `src/components/ui/`** — the directory stays on the **write** deny-belt below, and an edit there is ⛔ **RUN-STOP condition 12**, not a widening. ⚠ **An import does not widen an allow-list; §7's opening sentence still holds** |
| `BookmarkToggle.tsx` | Renders **nowhere** on `/bookmarks` — all 7 consumers are `src/components/debate/**`; `/bookmarks` uses `UnbookmarkButton` (`BookmarkCard.tsx:35`, `:54`). **POLISH.3 PR 2's by ruling D3** |
| `UnbookmarkButton.tsx` | No ratified item touches it |
| `src/server/profile/arguments.ts` | **POLISH.5's named exception** |
| `src/server/bookmarks/figures.ts` | Holds the Đa/Đb identity byte-stable against `loadProfilePositions` under FI-2. 6 params (`:83-96`), no price; `grep -in price` → **zero** |
| `src/server/bookmarks/list.ts` | **Read-only.** canon §4 ruling 1 PASSES at `:114`, `:249`, `:277`, `:310` |
| `src/components/discovery/*` | **Reference shapes only. POLISH.2 is closed** |
| `src/components/debate/badges.tsx` | The V10 `price` prop and `CHIP.profile` **already exist** (`:109-169`, `:82-83`). Both items consume; neither modifies |
| `tests/unit/shell/page-container.test.ts` | ⚠ **[v1.3] Named explicitly.** Editing SITES entry 4's `before` to admit a `className` is the inversion its own docblock (`:21-27`) exists to prevent. **The fix is an inner wrapper, never a baseline edit** |
| `tests/unit/discovery/render/surface-states.test.tsx` · `tests/unit/debate/render/market-error-boundary.test.tsx` | Assertion-shape **models** for allow-list #6. Read them; never write them |

### ⛔ SYMBOL FENCES — by symbol, never by line (F-1 is why)

**`page.tsx` — allow-list #3:**
```
⛔ <h1>Bookmarks</h1>                                                — conforms tier 4, surface_profile_v1_0.html:767
⛔ <Badge variant="outline">Your bookmarks</Badge>                   — conforms tier 4, :768
⛔ <PageContainer preset="reading" className="flex flex-col gap-4">  — page-container.test.ts SITES entry 2
```
**Two write sites only:** a module-scope copy const, and the `:41-48` ternary's empty arm.

**`error.tsx` — allow-list #4 [v1.3, revised for OD-4]:**
```
⛔ preset="reading" on the <PageContainer>   — SITES entry FOUR (not 3 — F-2)
⛔ NO className on that tag, ever            — G3; adding one reddens page-container.test.ts (⛔6)
⛔ the default-export signature              — { reset } destructured ALONE; `error` typed, never bound (A2, G2)
⛔ the "use client" directive                — stays; it moves to :2 only because SPDX takes :1 (G4)
✅ WRITEABLE: the render body between the <PageContainer> tags; the import block; the SPDX line at :1
✅ SAFE to add: data-testid on the <PageContainer> — callSite() does not read it (G3)
```

### ⛔ DENY-LIST BELT — by directory, in the plan

```
⛔ src/server/**          ⛔ src/db/**        ⛔ drizzle/**
⛔ src/app/(admin)/**
⛔ src/components/debate/**       ⛔ src/components/discovery/**
⛔ src/components/ui/**   ⚠ [v1.4] WRITE-deny ONLY — IMPORT is permitted for items 4 and 6
⛔ src/components/profile/**
⛔ src/app/(public)/u/**          ⛔ src/app/(public)/m/**       ⛔ src/app/(auth)/**
⛔ src/app/(public)/bookmarks/loading.tsx    ⛔ src/app/(public)/not-found.tsx
⛔ tests/unit/shell/**            ⛔ tests/unit/discovery/**     ⛔ tests/unit/debate/**
⛔ docs/**  EXCEPT docs/plans/POLISH-6.md
```

⚠ **`src/components/bookmarks/{BookmarkToggle,UnbookmarkButton}.tsx` sit inside a directory the belt
does not deny.** They are excluded by the allow-list **alone** — an edit there is ⛔ RUN-STOP
condition 2, not a per-delta halt.

---

## §8 · COMMIT BOUNDARIES — six, none ultracode. **Auto mode OFF: every one STOPS for a RED**

STEP 0 precedes all of them and is **not** a commit.

| Commit | Contents | Ultracode | Why this boundary |
|---|---|---|---|
| **C0** | **`docs/plans/POLISH-6.md` ALONE** — doc-only. No source, no test | ⛔ **NO** | **FIRST, before Phase 1 ends** (§5.1). Lands green trivially: no gate reads `.md` (§5). Message: `docs(polish): POLISH.6 execute plan` |
| **C1** | Items **2 + 3** — `BookmarkCard.tsx:32`, `:46`, `:80` **+** item 3's preset assertions in `side-encoding.test.tsx` | ⛔ **NO** — ordered RED-first, fails §6 condition 4 | Tests-first: write the `CHIP.profile` pin → run → **STOP, capture the RED** → change the source → green. ONE commit |
| **C2** | Item **1** — `BookmarkCard.tsx:46` **and** the recaptured `sideChip` helper + `:149-151` | ⛔ **NO** — ordered (V-1 capture-after-change) | **ONE commit.** ⚠ **Skipped entirely if STEP 0.5 finds the field absent** |
| **C3** | Item **4** — `page.tsx` copy const, the **`EmptyBlock` import**, and the `:41-48` empty arm **+** the item-4 block of `surface-states.test.tsx` **(new file lands here)** | ⛔ **NO** — ordered RED-first | Separate so the P1 *empty* adoption and its two verbatim strings read as one diff at Gate C. ⚠ **[v1.4] STEP 0.8 gates this commit: `ui/empty-block.tsx` must EXIST.** The Gate C question is *did it adopt the primitive, or re-implement the panel?* |
| **C4** | Item **5** — `states.tsx` `LoadingBlock` swap **+ the orphaned `Skeleton` import** **+** the item-5 block | ⛔ **NO** — ordered RED-first | The orphan must ride the same commit or `biome`/`tsc` reddens |
| **C5** | ⚠ **[v1.4 RESHAPED AGAIN]** Item **6** — `error.tsx`'s SPDX line, the orphaned `BookmarksError` import **swapped for the `ErrorBlock` import**, and the render body **replaced by the primitive under B′**; **`BookmarksError` DELETED from `states.tsx`**; **+** the item-6 block | ⛔ **NO** — ordered RED-first | **MUST be ONE commit.** Deleting `BookmarksError` while `error.tsx:3` still imports it is a **`tsc` error**; rewriting `error.tsx` first leaves a dead export `biome` flags. Split either way and the boundary is red — H9. ⚠ **[v1.4] STEP 0.8 gates this commit: `ui/error-block.tsx` must EXIST.** ⛔ **The body prop carries THIS surface's string** (`"Couldn't load your bookmarks."`), **not the family's generic line** — B′. ⛔ **`bodyTestId`, never a container testid** |

**Ultracode is FORBIDDEN for every commit.** CLAUDE.md §6's default is FORBIDDEN and no relay states
PERMITTED; independently, C1–C5 each carry an ordered RED-first or capture-after-change obligation,
failing condition 4. **C0 has no parallel units at all.**

⚠ `states.tsx` is edited by **both C4 and C5**; `side-encoding.test.tsx` by **both C1 and C2**;
`surface-states.test.tsx` grows across **C3, C4, C5**. Intended — sequential commits on one file. Each
boundary keeps one register row legible in the Gate C diff.

---

## §9 · HALT GRADES — ⚠ **[v1.4] TWELVE CONDITIONS: old ⛔5 RESTORED as 11, and a new 12 fences the `ui/` write direction**

**Per-delta halt** — that item stops, the run continues, the item is reported with its evidence.

**⛔ RUN-STOP** — write `~/Downloads/POLISH-6-HALT-<n>.md` (what tripped · the file · the finding ·
what I would have done next) and **STOP**. No routing around, no defer, no note-and-continue.

⛔ conditions:

1. **`origin/main` advances MID-RUN AND the diff touches an allow-list path or a named reference
   file** — `badges.tsx` · `loading-block.tsx` · `discovery/{ErrorState,EmptyState,LoadingSkeleton}.tsx`
   · `discovery/render/surface-states.test.tsx` · `debate/render/market-error-boundary.test.tsx`
   · `page-container.test.ts` · the three `tests/unit/design/` guards · `arguments.ts` · `list.ts`
   · `figures.ts` · `globals.css` · `design-canon.md` · **[v1.3]** `m/[slug]/error.tsx` ·
   `(auth)/error.tsx` · `(public)/not-found.tsx` (**the family — item 6 byte-copies from them**).
   *An advance touching none of these is recorded and the run continues. **Movement BEFORE the run is
   STEP 0's job.***
2. Any instruction requires writing outside §7's allow-list. ⚠ **Includes `loading.tsx`, the two
   sibling `bookmarks/` components, `page-container.test.ts`, and all of F-7's POLISH.5 surface.**
3. **A STEP 0.3 coordinate moved and was followed silently** rather than corrected in-file.
4. **`priceAtBet` appears to need adding in `src/server/**`** — POLISH.5's D23. Item 1 per-delta
   halts; the field is **never** added here.
5. **`error.tsx`'s `preset="reading"`, default-export signature, or `"use client"` directive is about
   to be changed** — all three are fenced (§7). F-1 shows how a line-keyed edit reaches the first by
   accident. *(Adding the SPDX line at `:1`, which shifts `"use client"` to `:2`, is the **ratified**
   change and is not this condition.)*
6. **[v1.3 NEW] A `className` is added to `bookmarks/error.tsx`'s `<PageContainer>` tag.** G3:
   `callSite()` reads `className` (`page-container.test.ts:131`) and asserts class-set equality against
   SITES entry 4's `before`, which has no `text-center`. **This is item 6's single most likely trip** —
   the family file being byte-copied carries `className="text-center"` on exactly that tag
   (`m/[slug]/error.tsx:66`). **Centering goes on an inner wrapper. `data-testid` is safe; `className`
   is not. Editing entry 4's `before` instead is ⛔2.**
7. **A raw hex literal enters any allow-list `src/` file** — `no-raw-hex-view-layer.test.ts`
   auto-enrols all of `src/components` and `src/app/(public)`.
8. **`EXPECTED_ALLOW_MARKERS` moves off 3** — a percent is being formatted at a call site (S-4).
9. **`page-container.test.ts` reddens** for any reason.
10. **The plan turns out jointly unsatisfiable with itself.**

11. ⚠ **[v1.4 RESTORED — ⛔5] EITHER `src/components/ui/empty-block.tsx` OR `src/components/ui/error-block.tsx` IS ABSENT AT STEP 0.**
    **Items 4 and 6 CONSUME them; POLISH.5 PR B MINTS them.** Their absence means **PR B has not
    merged** and this plan's ordering precondition is violated. ⛔ **RUN-STOP, not a per-delta halt,
    and not an invitation to mint them here.** ⚠ **This condition was DISSOLVED at v1.3 on the ground
    that `OD-4` consumed no leaf in any branch. `JR-5` reverses that ground and the condition is
    RESTORED in the form §2 requires** — keyed to **existence**, never to a line.
12. ⚠ **[v1.4] ANY WRITE UNDER `src/components/ui/`, in any commit.** The directory is **IMPORT-ONLY**
    for this plan and remains on the §7 **write** deny-belt. ⛔ **Editing a leaf to fit this surface —
    adding a prop, widening a tier, changing a class — is a RUN-STOP, not a fix.** A divergence
    between what the leaf offers and what this surface needs is a **finding for Gate C**, reported
    with its evidence. ⚠ **This is the fence that stops `.6` from re-shaping a primitive `.5` and
    `.4` both inherit.**

**⛔ DISSOLVED at v1.3 and ⚠ RESTORED at v1.4 — the record of both moves, kept so neither is silent:**
v1.3 removed *"Item 6 requires a `src/components/ui/` file that does not exist"* because `OD-4`
consumed no leaf in any branch (S-1), leaving the condition without a subject. **`JR-5` gives it a
subject again.** It returns above as **condition 11**, alongside a new **condition 12** that fences
the direction v1.3 never had to consider. ⚠ **The v1.3 reasoning was correct on its facts; the facts
moved.**

**Per-surface halt slot:** *a second `SideBadge` call site is found on `/bookmarks` beyond
`BookmarkCard.tsx:32`/`:46`.* The enumeration is the count; a third site means item 3's "both sites"
rests on a bad denominator.

Base halts H1–H17 (`docs/polish/POLISH-SURFACE-TEMPLATE.md` §5) are inherited unchanged.

---

## §9A · §13.1 PRE-FLIGHT — **RE-RUN against the v1.3 condition set [v1.3]**

**POLISH.8 measured 3 of 8 items hitting a halt on a carefully written plan.** This is that check, run
before execute. **Carve-outs (a), (b) and (c) carry forward from v1.2.**

| ⛔ | Fires on the plan / on C0? | Carve-out or fix |
|---|---|---|
| **1** main advances | ⚠ **FIRED ALREADY** — `2326e84 → af3a070`, touching `page-container.test.ts` and **landing the family reference this version now depends on** | **STEP 0's domain, not ⛔1's** — ⛔1 is scoped to **MID-RUN**. Ground re-keyed; F-2 re-verified. ⚠ **[v1.3] The reference list GREW** — the three family files are now load-bearing and are added to ⛔1 |
| **2** write outside §7 | ✅ **FIXED at v1.2 (was D-1).** Allow-list **entry 7** + **C0** admit `docs/plans/POLISH-6.md`. **Carve-out (b)** | ⚠ **Carve-out (c):** halt records at `~/Downloads/` are **outside the repo** — not a repo write, no entry needed |
| **2** (quotation fence) | 🟡 **Would fire on a naive reading.** §1–§7 quote `arguments.ts`, `list.ts`, `figures.ts`, `profile/{states,copy}.tsx`, `u/[pseudonym]/error.tsx`, `m/[slug]/error.tsx`, `(auth)/error.tsx`, `not-found.tsx` and `page-container.test.ts` as **context** — and §B G1 quotes an entire struck file | ✅ **Carve-out (a): the fence applies to the WORKING DIFF, never to text quoted inside this plan.** The operative test is `git diff --name-only` at commit time; only the seven allow-list paths may appear. **⚠ [v1.3] This carve-out now carries more weight than at v1.2** — G1 reproduces 81 lines of a deny-belt file verbatim, which is the largest quotation in the plan and the most likely to be misread as a write |
| **3** coordinate moved silently | ⬜ Does not fire on plan text — a run condition. **STEP 0.3 is its enabling step** | — |
| **4** `priceAtBet` in `src/server/**` | ⬜ Does not fire. The plan **forbids** it in four places (§2, §3 item 1, §7, ⛔4) | Rides carve-out (a) for the quotations |
| **5** `error.tsx` fenced symbols | 🟡 **Would fire on its own ratified change if left as v1.2 worded it.** OD-4 **adds an SPDX line at `:1`**, which shifts `"use client"` from `:1` to `:2` — and v1.2's ⛔6 fenced *"the `"use client"` directive at `:1`"* **by line** | ✅ **FIXED:** ⛔5 now fences the directive **by symbol** (*"is about to be changed"*) with an explicit carve-out for the SPDX shift. **⚠ This is a THIRD instance of the fence-by-line defect — F-1's class, inside this plan's own halt list.** §12 escalates it |
| **6** `className` on the container | 🔴 **NEW, and it WOULD have fired at execute.** Item 6 byte-copies a file whose container carries `className="text-center"` (`m/[slug]/error.tsx:66`). Copying it wholesale reddens `page-container.test.ts` | ✅ **Named as its own ⛔ and as a §3 divergence + §7 fence line.** Fix is an inner wrapper. **Found by G3, not by execute** |
| **7** raw hex | ⬜ Does not fire. The plan quotes **no hex literal**; `SCAN_DIRS` are `src/` only and never reach `docs/`, so **C0 cannot trip it**. Every byte-copied family className is a token | — |
| **8** `EXPECTED_ALLOW_MARKERS` | ⬜ Does not fire. No item adds a `formatPercentUnpaired` call or a marker (S-4) | — |
| **9** `page-container.test.ts` reddens | 🟡 **Conditional on ⛔6.** Otherwise ⬜ — item 6 keeps the existing `<PageContainer>` (no new call site → the `CALL_SITE_ROOTS` census at `:138` is unmoved) and no other item touches a container tag | Discharged by ⛔6's fix |
| **10** jointly unsatisfiable | 🔴 **THREE INSTANCES FOUND ACROSS VERSIONS, ALL FIXED** — D-1 (⛔2, v1.2), the old ⛔5 vs F-7's leaf branch (v1.2), and **[v1.3] ⛔5's line-keyed `"use client"` fence vs OD-4's own SPDX addition** | ✅ All three closed. **This row is why §9A exists** |
| **per-surface** 3rd `SideBadge` site | ⬜ Does not fire. Census is 2, both in `BookmarkCard.tsx` | — |
| **H12** concurrent vitest | ⬜ Not a plan defect, a run one | `pgrep -f 'node.*vitest'` before any suite (§10) |

**Additional pre-flight checks:**

| Check | Result |
|---|---|
| Does C0 redden any gate? | ✅ **No.** `just verify` = `tsc` → `biome check` → `next build`; none reads `.md`. Biome does not format Markdown. `session-logs-survive.test.ts` scopes to `docs/logs/` |
| Is every §3 Site(s) coordinate inside a §7 allow-list file? | ✅ Yes — 7/7 |
| Does any item's fix require a file the plan struck? | ✅ **No — and ⚠ [v1.4] re-checked against `JR-5`.** Items 4 and 6 now **IMPORT** from `src/components/ui/`, which is **write-denied, not read-denied**. ⛔ **Neither writes it**; a needed change there is RUN-STOP 12, reported to Gate C. Item 6 still byte-copies nothing by hand — the leaf carries the treatment |
| **[v1.3]** Does deleting `BookmarksError` break a third consumer? | ✅ **No.** `grep -rn "BookmarksError" src tests` → `states.tsx:19` + `error.tsx:3,:17` only |
| **[v1.3]** Does `"Tap to retry."`'s deletion redden anything? | ✅ **No.** `grep -rn "Tap to retry" tests src docs` → one hit, the source line itself |
| Are all v1.1/v1.2 ODs closed? | ✅ **All four — OD-1, OD-2, OD-3, OD-4. None open** |
| Does the plan cite a coordinate it has not measured? | ✅ No. Every `file:line` was read at `2326e84` or `af3a070` |

---

## §10 · VERIFICATION

**Auto mode is OFF.** Every commit C1–C5 requires the run to **STOP** at its RED and capture it before
the source change. That is not a formality: the RED log is the only falsifiable proof the ordered
obligation was honoured, and a commit claiming tests-first without one is unverifiable.

```
# 1. write the assertion(s) for the item
ZUGZWANG_ENV=preview pnpm vitest run <target> > /tmp/p6-red-<commit>.log 2>&1; echo EXIT=$?   # expect NON-ZERO
# 2. STOP. Read the log. Confirm it failed for the RIGHT reason.
# 3. make the source change
ZUGZWANG_ENV=preview just verify > /tmp/p6-verify-<n>.log 2>&1; echo exit=$?                 # expect 0
# 4. commit, citing the RED log path in the commit body
```

`ZUGZWANG_ENV=preview` is required — `next build` rejects `"unknown"` at the `getRedisKey` gate
(AGENTS.md §2). Env-only, not a regression. *(C0 is doc-only; run `just verify` anyway so the log
series has no gap.)*

⚠ **Never pipe a gate to `tail`** — it exits with `tail`'s 0 and swallows the failure.
⚠ **`just verify` runs BEFORE the commit, not after.** Lefthook `pre-commit` runs Biome with
`stage_fixed: true` and **silently re-stages** what it repairs; a post-commit run is blind to it.

**Targeted, per commit:**
```
pnpm vitest run tests/unit/bookmarks/ tests/unit/design/ \
  tests/unit/shell/page-container.test.ts tests/unit/debate/render/side-badge.test.tsx
```
⚠ **[v1.3] `page-container.test.ts` is in the targeted set for C5 specifically** — it is ⛔6's detector.

**Full suite before PR** — ~35 min, backgrounded, exit captured:
```
pgrep -f 'node.*vitest'                     # a second runner manufactures a false RED
pnpm vitest run > /tmp/p6-suite.log 2>&1; echo EXIT=$?
```
Non-TTY Vitest prints no per-file progress — gauge liveness by log growth, not by silence.

**Critical-path suites are NOT triggered** — no `src/server/**`, no schema, no migration.
⚠ **CI is `pull_request`-gated only.** A branch push has no remote gate.

### Eye pass — **APPEARANCE ONLY, and that is stated deliberately**

`/bookmarks` is **auth-gated**; sign in on staging. Four items are directly observable:

1. The side chip reads `YES @ n%` at the profile geometry.
2. The figures line reads `Staked Đ … · Current Đ …`.
3. The empty state is the 148px P1 panel reading *"No bookmarks yet." / "Saved arguments will appear
   here."* — reachable by un-bookmarking every item, or on a fresh account.
4. The loading state shows three placeholder blocks — reachable by throttling the network on a client
   navigation to `/bookmarks`.

**Item 6's error boundary: APPEARANCE ONLY.** v1.1 asked the founder to confirm the button *"visibly
re-runs the load"* **without naming any way to make `/bookmarks` fail on staging** — an unperformable
instruction. There is no supported failure trigger: the surface is a server read inside a route
boundary, and forcing one would mean breaking the staging DB or shipping throw-code, neither in scope.

**[v1.3] What CAN be verified by eye, and it is now stronger than at v1.2:** the boundary should be
**visually indistinguishable from `/m/<any-slug>`'s error state** — same heading, same paragraph, same
underline `Try again`. **That is a side-by-side comparison the founder can actually perform**, and it
is the whole point of the family ruling. **The runtime behaviour — that clicking `Try again` invokes
`reset` exactly once, and that nothing from `error` reaches the DOM — is covered by
`surface-states.test.tsx`**, modelled on `market-error-boundary.test.tsx:101-109` and `:244-267`, which
is a stronger proof than a human click.

---

## §11 · REVIEWERS — both, sequentially

**`@code-reviewer` AND `@security-auditor`.** v1.0 read the §5.11 trigger table as exhaustive and
concluded neither fires. **That was wrong, on three grounds:**

1. **The trigger table is a FLOOR, not a ceiling.** The kickoff named both.
2. **Three for three, all unrequested, none on a critical path** — POLISH.7a a CRITICAL; POLISH.8 a
   HIGH plus three SURPRISEs; POLISH.3 PR 1 two HIGHs.
3. **Items 1 and 3 change what the side chip renders and what its `aria-label` announces** — the
   **INV-3 surface**. `badges.tsx:99-107` is explicit that the pole binding is the invariant and the
   price is a sibling; `side-encoding.test.tsx` exists because that exact chip shipped **inverted** on
   two surfaces.

**Run SEQUENTIALLY, one DB-touching reviewer at a time** — concurrent subagent `pnpm vitest` runs
saturate local Postgres and manufacture "Hook timed out" flakiness. `@code-reviewer` first.

⚠ **Launch from a worktree at the STEP 0.1 head** (0.7). Agent definitions load from the working
directory **at launch** and are not hot-reloaded; a subagent dying at 0 tool_uses is that symptom.

**Each reviewer must leave at least one FALSIFIABLE, repo-checkable receipt.** **No mechanism proves a
subagent ran: a clean pass and a dead-at-zero pass produce identical artifacts.**

- **`@code-reviewer`** — re-derive the `pctround-allow:` marker count and confirm it is still **3**;
  quote the widened `sideChip` predicate and state why the removed-arm chips (`:182-183`, `:196-197`)
  still match it; **[v1.3]** confirm `error.tsx` imports **nothing** from `@/components/bookmarks/states`
  after the rewrite and that `states.tsx` exports `BookmarksLoading` alone; **[v1.3]** diff item 6's
  three strings and its button className against `m/[slug]/error.tsx:68`, `:69-71`, `:75`, `:77` and
  report **byte-equality or the exact delta**; **[v1.3]** confirm the `<PageContainer>` tag carries
  **no `className`** (⛔6) and that `text-center` sits on an inner wrapper.
- **`@security-auditor`** — confirm **INV-3**: the pole binding at `badges.tsx:163` is unmoved and the
  price is additive at both `BookmarkCard` sites; confirm the entry price reaches **only** the
  `removed:false` arm, so no masked field can surface on a `content_removed` stub (SC-1, S-9);
  **[v1.3]** confirm `error.tsx` renders **nothing** from the `error` object — not `message`, `stack`,
  `digest` or `cause` — after the rewrite, and that the signature still destructures `{ reset }`
  **alone** with `error` typed-but-unbound (the `m/[slug]/error.tsx:29-32` structural guarantee, pinned
  by `market-error-boundary.test.tsx:336-360`). ⚠ **Phrased correctly per G2:** *nothing leaks today on
  either arm*; the **client** arm is merely where a leak **would** surface if anyone ever rendered
  `error`, because React's Flight client sanitizes server throws in production and not client or
  hydration throws (`m/[slug]/error.tsx:34-42`, which is **prose, not a leaking arm**).

**Every finding is reported INDIVIDUALLY at its assigned severity with `file:line`** — never "a
CRITICAL plus two HIGHs". Never a bare PASS; a bare PASS twice is H10.

⚠ **This sequence is ratified scope.** Neither is added nor skipped without surfacing it as a PR deviation.

---

## §12 · CLOSING RITUAL (CLAUDE.md §7)

*Should CLAUDE.md / AGENTS.md / the workflow / the tracker change as a result of this session?*

- **CLAUDE.md — 🔴 [v1.3] "FENCE BY SYMBOL, NEVER BY LINE" IS NOW AT THREE INSTANCES AND SHOULD BE
  MINTED AS AN O-SPACE ROW.** v1.2 recorded two and said *"two instances is not yet a mint — recorded
  so a third makes it an O-space row rather than a rediscovery."* **§9A found the third.** The full chain:
  1. `DebateView.tsx`'s documented coordinates drifted **+67 / −36**, which is why POLISH.3 §11 fenced
     that file **by symbol**.
  2. **F-1** — OD-2 fenced `bookmarks/error.tsx` **by line** (`:15-17`) *in the same document that
     ruled fence-by-symbol*, and the line range **included the tag it forbade touching**.
  3. **[v1.3]** This plan's own **⛔5** fenced *"the `"use client"` directive **at `:1`**"* — and OD-4's
     own ratified SPDX addition **moves it to `:2`**. A halt condition that would have fired on the
     change it was written to protect.
  **The pattern is not "people cite wrong lines." It is that a line-keyed fence goes stale from the
  very edit it guards.** Recommend an O-space row; the mint is web's call, not this task's.
- **AGENTS.md** — no. §9's `tests/unit/**/render/` description already covers the harness.
- **Tracker** — `PD-6-01 … PD-6-06` are minted by **commit 0**, unauthored. If commit 0 lands with this
  PR the six rows land with it; otherwise the register additions ride the close-out.
- **Canon — two candidates, both batched to close-out:**
  1. **(OD-3)** P7's *count* clause has no discharge on an **unpaginated** surface; it binds
     paginated/gridded surfaces and is inert elsewhere.
  2. **🔴 (OD-4) — the strongest candidate this task produced.** The line *"P1 governs IN-SURFACE state
     blocks; the heading-led family governs ROUTE-LEVEL boundaries"* **is not written down anywhere on
     `main`**. It was derived here from R9's Discovery-scoped wording (canon `:223-230`) plus a
     three-file census (G5). **Two surfaces have now had to re-derive it** — `/bookmarks` here and
     `/u/[pseudonym]` at POLISH.5 — which is F-7's whole point. **Canon should carry it.** Batched to
     close-out, but it is the item most likely to prevent the next re-derivation.

---

## §13 · OPEN DECISIONS — **ALL CLOSED**

> ### ⚠ **[v1.4] `OD-4` IS PARTLY SUPERSEDED BY `JR-5`, AND THE SUPERSESSION IS RECORDED HERE, NOT BURIED**
>
> **`OD-4`'s DURABLE HALF, unchanged:** *P1 governs in-surface state blocks; the route-boundary family
> governs route boundaries.* **`JR-1` ratified this and `.5` WITHDREW its opposing position.**
>
> **`OD-4`'s SUPERSEDED HALF:** *the family renders INLINE and `.6` consumes no `ui/` leaf in any
> branch.* ⛔ **`JR-5` reverses it.** Item 6 **imports `ui/error-block.tsx`** — the primitive that
> renders the family (`JR-1`) — and `OD-2`'s surface string **returns as the body tier** under B′.
>
> ⚠ **THE PATTERN, NAMED SO IT IS NOT MISTAKEN FOR CHURN.** `D08` has now been ruled **four** times:
> `D08` → `OD-2` → `OD-4` → `JR-1`+`JR-5`. **Every reversal came from evidence that postdated the
> ruling it overturned** — `af3a070` landing `m/[slug]/error.tsx` for `OD-4`, and the converged
> primitive contract for `JR-5`. **None came from a change of mind on the same facts.** ⚠ **`OD-4`'s
> own logged loss — *"the deliberate loss of surface-specific error copy"* — is DISCHARGED by B′,
> not merely regretted.**

| OD | Question | Ruling |
|---|---|---|
| **OD-1** | `.sub` — placeholder or the on-`main` string? | ✅ **CLOSED — CARRY THE STRING.** `"Saved arguments will appear here."`, verbatim from mockup `:199`. **S-3 void.** `.msg` source is mockup `:198`, not `UI-A6.md:102`. ⚠ **Unaffected by OD-4 — item 4 is in-surface** |
| **OD-2** | Item 6 — unsatisfiable as originally ruled | ✅ **CLOSED, then SUPERSEDED by OD-4** — ⚠ **and [v1.4] its STRING is RESTORED by `JR-5`/B′.** Durable half: `error.tsx` joins the allow-list, the wrapper is removed, A1/A2/A3 pass. Its P1-panel + `onRetry` half stays **withdrawn**. ✅ **Its surface string `"Couldn't load your bookmarks."` RETURNS as the body tier** — `OD-4` removed the tier, not the string, and B′ gives the tier back |
| **OD-3** | P7's count clause on an unpaginated surface | ✅ **CLOSED — KEEP 3.** Knowing partial (S-6); canon note batched (§12) |
| **OD-4** | Item 6's shape, against evidence postdating D08 | ⚠ **[v1.4] CLOSED, THEN PARTLY SUPERSEDED BY `JR-5`** — see the block above. **Durable half stands (`JR-1`); the INLINE half is reversed.** ✅ **CLOSED — THE ROUTE-BOUNDARY FAMILY.** *P1 governs in-surface blocks; the heading-led family governs route boundaries.* **G5 found no counter-artifact.** `onRetry` never introduced; `BookmarksError` deleted; `"Try again"` a byte-copy; SPDX adopted; **item 4 untouched**; centering diverges to an inner wrapper (G3) |
| **S-8** | Coverage for items 2–6 | ✅ **CLOSED — one new test file**, items 4/5/6. Item 3's pin → `side-encoding.test.tsx`. Item 2 needs none |
| **§11** | Reviewers | ✅ **CLOSED — BOTH**, sequentially |
| **F-7** | Who rules the twin defect | ✅ **CLOSED — RULED ONCE, BINDING ON BOTH.** POLISH.5 **cites** the §3 line; it does not re-derive it. ⛔ `.6` still never edits `u/**` or `components/profile/**` |

### ⚠ Ruling citations corrected against disk — carried into §3, §6, §7 and §9

| # | Ruling said | Disk says | Consequence if uncorrected |
|---|---|---|---|
| **F-1** | the wrapper is at `error.tsx:15-17` | **`:16-18`**; `:15` is the fenced `<PageContainer>` open tag | Deletes the fenced tag, orphans `</button>` — syntax error **and** fence violation |
| **F-2** | `error.tsx` is `page-container.test.ts` **SITES entry 3** | **entry 4**; entry 3 is `loading.tsx` | Fences the wrong file, and the one fenced is one no item may write |
| **F-4** | `"Retry"` is *"carried verbatim"* | The **verb** was carried; the standalone label was a **composition**. ⚠ **Now moot — OD-4's `"Try again"` is a true byte-copy** | A Gate C reader told "verbatim" would find no matching string |
| **G1** | *"Quote `:1-90`"* | The file is **81 lines**; `:82-90` do not exist | A plan citing `:82-90` cites nothing |
| **G2** | *"`:34-42` … the CLIENT arm, which is the one that leaks in production"* | **`:34-42` is a COMMENT, not an arm.** Zero `process.env`, zero `error.` in the body, `error` never destructured. **Nothing leaks, on either arm** | The conditional *"adopt the visual shape and NOT that arm"* would have excluded the **strongest** part of the family shape for a leak that does not exist |
| **v1.2 §3** *(my own)* | *"Item 6 orphans nothing in `error.tsx`. No import moves"* | **True under OD-2, FALSE under OD-4** — `error.tsx:3`'s `BookmarksError` import **is orphaned** and must be removed | `tsc` reddens on a missing export at C5 |

---

## §14 · GATE C — mandatory, non-optional

**A web diff-read before this PR merges (POLISH-0).** Not a courtesy and not skippable. Named here
because v1.0 and v1.1 did not name it anywhere, and an unnamed gate gets missed.

**Delivery — the mechanism is part of the gate.** The diff travels as an **UPLOADED FILE written to
`~/Downloads`**, never a terminal paste. **Pasted output has truncated mid-sentence four times in this
task family**, and a silently truncated diff is worse than no diff: it reads as complete.

```
git diff <base>..HEAD > ~/Downloads/POLISH-6-GateC-diff.txt
wc -l ~/Downloads/POLISH-6-GateC-diff.txt          # state the line count with the file
md5 -q ~/Downloads/POLISH-6-GateC-diff.txt         # so truncation in transit is detectable
```

Ship the **line count and md5 alongside the file** so a truncated arrival is detectable rather than
assumed-complete.

**What Gate C must be told, beyond the diff:**

1. Which items **executed** and which **per-delta halted** — item 1 turns on STEP 0.5.
2. **STEP 0.9's observation:** what POLISH.5 shipped on `u/[pseudonym]/error.tsx`, and whether item 6
   matches it (F-7 rules them identically; a visible divergence is a finding).
3. The captured **RED logs** for C1–C5 (`/tmp/p6-red-<commit>.log`) — the only falsifiable proof the
   ordered obligations were honoured. **Auto mode is OFF, so each is a real stop.**
4. Both reviewers' **falsifiable receipts** (§11), including the **byte-equality diff** of item 6's
   three strings against `m/[slug]/error.tsx`.
5. The **knowingly accepted partials**: S-6 (P7's count clause), S-8 (item 2 untested), F-8b (no
   `copy.ts` minted), F-7 (the twin defect measured and handed to POLISH.5, not fixed), and the
   **deliberate loss of surface-specific error copy** (§3 — `"Couldn't load your bookmarks."` → the
   family's generic string, which is the ruling's intent and not a regression).
6. **§12's O-space recommendation** — *fence by symbol, never by line*, now at **three** instances,
   the third found inside this plan's own halt list.
