# POLISH-1a — session log

> **Date:** 2026-08-03 · one session, two ratified phases (Phase 1 the still → HALT → Phase 2 build) plus a Gate C round.
> **Ground:** `origin/main` @ `d19ea6f` (#286 HEADER-PORTFOLIO) · detached worktree off `origin/main`, primary tree untouched on `chore/header-portfolio-log` · branch `polish/1a`
> **Plan:** **none in-repo.** The kickoff was inline and self-contained; the ten deltas (V1–V10) are its authoritative scope. `@code-reviewer` was briefed with the kickoff reproduced verbatim in place of a `docs/plans/` file.
> **Upstream recon:** `POLISH-1-D` delta recon (read-only, same day) — findings D-1 / D-2 / D-3 / D-4 and two class-S gaps.
> **Ritual:** CC-LIGHT — not a CLAUDE.md §1 critical path. No `@security-auditor`, no DB, no migration, no auth, no money math.
> **Model:** `claude-opus-5[1m]`, effort `max`.

---

## A note on SHAs in this log

The merge will be **squash-to-main**, so **no SHA below reaches `main`.** All four are branch-local. **The durable reference is the squash-merge SHA on `main`, recorded at close-out — not here.** C1 was amended once and C2 twice, so C2/C3 were rebuilt each time; the SHAs below are the final post-amend set, confirmed by direct `git log`, not inferred.

---

## What landed

Branch `polish/1a`, four commits, **15 source/test files + this log**, +239/−28. **PR not opened** — Gate C is a web diff-read.

| | SHA | Commit |
|---|---|---|
| **C1** | `f37646768d5d936d9e123f9364ab79a49d8de97c` | `feat(shell): POLISH-1a C1 — header presentation pass (V1 V2 V3 V4 V7 V8 V9)` |
| **C2** | `230c0741f08a8816e6250c9b899598c563e901ea` | `fix(shell): POLISH-1a C2 — Back disabled at root, and the history probe re-runs (V5 + Gate C)` |
| **C3** | `71cc64726062378cc6c929ef535c026741f638ce` | `refactor(shell): POLISH-1a C3 — un-nest <main>, scope the w-px selector (V6 V10)` |
| **C4** | *this log* | `chore(shell): log session — POLISH-1a Gate C passed, PR held` |

**C1 · presentation (7 deltas).** `RadioSlot.tsx` title → `"Radio — not yet live"` (V1) · `IdentityCluster.tsx` chip avatar binds `--avatar-ring` and drops the primitive's `mix-blend-darken`, both `<Avatar size="sm">` sites (V2) · `GlobalHeader.tsx` §21.1 divider `h-5` → `h-[30px]`, height only (V3) · `VisitorCounter.tsx` gains `title="Total page visits — not participants"` (V4) · `DharmaCluster.tsx` `mr-3` → `mr-3.5` (V7), gains the mockup's verbatim Đ-cluster title (V8), and both labels + the box move to the semantic tier (V9). One class assertion added to `identity-cluster-link.test.tsx` pinning the ring binding and the absence of the blend.

**C2 · the Back predicate (V5 + Gate C).** `canGoBack = pathname !== "/" && hasHistory`, with the probe re-run on route change. New suite `tests/unit/shell/header-nav-back.test.tsx`, 4 cells.

**C3 · un-nesting + selector scoping (V6, V10).** Six inner `<main>` → `<div>` across `(public)/bookmarks/{page,loading,error}` and `(public)/u/[pseudonym]/{page,loading,error}`; scoping comment on `rightZoneChildren` in `dharma-cluster.test.tsx`.

### Gates — all four green on the final tree

| Gate | Result |
|---|---|
| `tsc --noEmit` | **exit 0** |
| `biome check .` | **exit 0** — 623 files; 1 warning (pre-existing unused import in an untouched moderation test), 3 infos |
| **Full suite** (`pnpm vitest run`) | **exit 0** — 293 passed / 1 skipped (294 files); **2140 passed / 1 skipped / 4 todo** (2145) |
| `next build` | **exit 0** — compiled in 4.7s |

Build ran with the `tests/_setup/env.ts` placeholder env + `ZUGZWANG_ENV=preview`; a fresh worktree has no `.env.local` and no real `.env*` was read or copied. `tests/scale/**` is excluded by the default config, as designed.

---

## Decisions made

**1. Two scope widenings, both ratified before landing, both recorded here rather than absorbed.** Detailed in their own sections below.

**2. `useSyncExternalStore` considered and REJECTED** for the history probe. `history.length` has no subscribe mechanism — no event fires on `pushState` — so it would miss the exact transition that matters. **Do not restructure.**

**3. V2 is not cosmetic and the commit says so.** `mix-blend-darken` takes the *darker* of ring and backdrop; `AvatarFallback`'s `bg-muted` (n1) is darker than the n2 ring, so the ring blended away entirely whenever the placeholder image failed to load. V9 *is* byte-identical in computed style; V2 is a real behavioural fix. The two were deliberately not described in the same register.

**4. `ui/avatar.tsx` untouched**, per kickoff — shared primitive, its own row. Consequence: the primitive's `after:border` / `after:border-border` survive `twMerge` alongside the arbitrary shorthand (different rule groups — verified empirically against the repo's own `tailwind-merge`). Harmless, because all three resolve to `1px solid #404040`. The equality has a stated precondition, now in-code: `--avatar-ring` binds n2 directly while `border-border` goes via `--border`, so re-pointing `--border` would split them.

**5. Logs are exempt from the SPDX SG.** The kickoff said every new file gets `SPDX-License-Identifier: AGPL-3.0-or-later`; `FOUND-3` scoped that convention to **source files**, and 137 of 140 files in `docs/logs/` carry no header. The new **test** file got one; this log does not.

---

## The `useExhaustiveDependencies` ruling — carry lines

- First suppression of `useExhaustiveDependencies` in the repo, ruled 2026-08-03. Grounds: `pathname` is a re-run trigger for an external mutable sample, not a scope read. `useSyncExternalStore` considered and rejected.
- Ask-first per CLAUDE.md §11 still applies to every subsequent suppression. This is a ruling on one line, not a policy change.

Shipped form, house single-line, in `HeaderNav.tsx`:

```
// biome-ignore lint/correctness/useExhaustiveDependencies: pathname is a re-run TRIGGER, not a read. HeaderNav survives soft nav, so [] freezes history.length at first mount — a user landing directly on / gets Back dead for the whole session. Do not remove.
```

The wording is deliberate: it states **what breaks if the dep is deleted**, not what the rule's model is. An explanation of the lint's reasoning does not stop the next reader taking the autofix; a description of the resulting bug does. No `biome.json` change — the rule stays on everywhere else. An earlier multi-line attempt **failed the commit**: Biome requires the `biome-ignore` to be the last comment line before the node, so the suppression attached to nothing and Lefthook rejected it. Caught because the hook printed `🥊` rather than `✔️` and `HEAD` had not moved.

---

## Recorded deviation 1 — G1, the `<main>` widening (C3)

POLISH.1 owns the shell. C3 edits **six files under two other route trees**. Ratified in-kickoff, recorded here.

`(public)/layout.tsx:85` renders `<main className="flex-1">` around every child, and `/bookmarks` and `/u/[pseudonym]` each rendered a **second** `<main>` inside it. The **layout's is the one that stays**: `(public)/page.tsx:25` documents the contract as *"the layout owns the header and the single `<main>`"*, and Discovery at `/` has no `<main>` of its own — stripping the layout's would leave `/` with no landmark at all.

**Six files, not two.** `page` · `loading` · `error` on **both** routes: fixing only `page.tsx` would leave the defect live in the loading and error states of the same routes.

**Why POLISH.1 owns it:** the violated contract is the **shell's**. The layout defines the single `<main>` and these routes break it, so the fix belongs to the task that owns the layout — even though the files sit elsewhere. Bounded at exactly six: no other page under `(public)`, no `(auth)`, no `(admin)`.

**Regression risk, verified nil.** Tag names only — all 12 changed lines, every `className` preserved byte-for-byte; `<main>` and `<div>` are both UA `display:block`. Zero `role="main"`, `getByRole("main")` or `querySelector("main")` anywhere in `src/` or `tests/`; no `main` element selector in `globals.css`. Post-change inventory: `(public)` has exactly one `<main>` (`layout.tsx:85`), `(auth)` one, `(admin)` six — unchanged.

---

## Recorded deviation 2 — C2's Gate C widening, with RED-then-GREEN

V5 as first written kept the history probe mount-only, and **that made V5's own stated behaviour false in a common case.** `HeaderNav` lives in `(public)/layout.tsx`, which survives soft navigation, so a `[]`-dep effect froze `hasHistory` for the whole session: a viewer arriving **directly** at `/` — typed URL or bookmark, which is the operator's staging-test path and the Devcon demo path — starts at `history.length === 1`, and Back then stayed dead on every subsequent route however deep the stack got. Shipping that would have failed the driven pass by design.

`[]` → `[pathname]`. The pathname term stays at RENDER, so the root gate never waits on an effect; the two terms answer different questions — *"is there anywhere to go?"* (the probe) vs *"is this the root?"* (the gate) — and remain separate.

**Two RED-then-GREEN rounds, each against the predicate that was live at the time.**

**1.** *V5 round, against A1's history-depth-only predicate.* **RED:** exit 1, `1 failed | 2 passed` — `disables-back-at-root-even-with-in-app-history` → *expected false to be true* on `back.disabled`. **GREEN:** exit 0, 3 passed.

**2.** *Gate C round, against **C2's own** `[]`-dep predicate — not A1's.* **RED:** exit 1, `1 failed | 3 passed` — `re-probes-history-on-soft-navigation-away-from-root` → *expected true to be false* on `back.disabled`; Back was disabled at `/m/[slug]` with `history.length === 2`. **The three existing cells passed unchanged**, so the RED is specific to the frozen probe rather than a broken harness. **GREEN:** exit 0, 4 passed; whole `tests/unit/shell` 38/38.

**`rerender` is load-bearing** in the soft-nav cell: it re-renders the *same mounted instance*, which is what soft navigation does. A second `render(...)` would remount, re-run the effect, and hide the bug entirely. Cells 1 and 3 stop the fix from being "disable Back everywhere" / "enable Back everywhere".

---

## Surprises caught + fixed in-session

**1. V9 was half-applied — and neither the still nor the 2139-test suite could catch it.** `@code-reviewer` found `DharmaCluster.tsx` still binding `text-n5` on the **Balance** label. Cause: my `replace_all` edit matched only the `Portfolio` label, which sits one tab deeper inside the `portfolio !== null` conditional; the shallower `Balance` string never matched. The label left behind is the one that **always renders** — Portfolio is conditional.

The chain is the point. **The still could not catch it:** `POLISH-1a-still.html` is *hand-authored HTML*, so its TARGET column showed both labels in the semantic tier because I wrote the mock that way — a hand-built still validates the **intent**, never the **implementation**, because it is not generated from the code. **The suite could not catch it either:** no test pins either class, so all 2139 tests passed with V9 half-applied, and `just verify` was green. **Both green gates were true and both were blind.** Only reading the actual diff caught it. Fixed and **amended into C1**, not deferred — verified after: two labels on `text-muted-foreground`, zero `text-n5` classes in the file.

**2. Three reviewer corrections folded in, all comment-only.** The `--border`-repointing precondition on V2's equality claim · the *"leads off-site every time"* overclaim in V5's rationale — false for the `/` → market → Home loop, so the comment and commit body now state the accepted cost plainly · a BOUNDARY note on test cell 2, which read as broader coverage than it proved.

**3. A false-positive process check, worth not repeating.** `ps aux | grep '[v]itest'` reported 2 live runners before a full-suite run; `pgrep -fl vitest` reported none. The two hits were the wrapper shells of *my own grep command*, matching because the command string contained "vitest". Use `pgrep -f 'node.*vitest'`, not `ps | grep`, before trusting a concurrency check. The real check matters: a second concurrent runner truncates fixtures into a false RED.

**4. One superseded gate run stopped rather than left racing.** After the suppression rewrite, the in-flight full suite was on a tree about to be replaced. It was killed (`TaskStop` + `pkill`, verified 0 survivors) before the final run started, rather than allowing two vitest runs to collide.

---

## Open questions — for Gate C / close-out

**1. `docs/parked.md` entry for `ui/avatar.tsx`.** V2 fixed **1 of 3** `mix-blend-darken` Avatar consumers. The other two — `discovery/HeroPanels.tsx:112`, `debate/ArgProfile.tsx:51` — carry the same ring-erasure. The real fix is the shared primitive, which the kickoff held as its own row. That row should become a **real tracker/parked entry rather than an implied one**, now that the treatment is inconsistent across three sites.

**2. `title` reach — routed to A11Y.0, not fixed here.** V1's title sits on a `disabled` `<button>`, where browsers suppress pointer events so the native tooltip never fires; V4's and V8's sit on role-less `<span>`s, so they are mouse-hover only — no keyboard path, not reliably exposed to AT. All three strings are correct as source-of-truth; their *delivery* is A11Y.0's problem.

**3. Two class-S gaps inherited from the `POLISH-1-D` recon, untouched here.** The W2.11 state kit defines **no Đ-cluster state** — three of the cluster's four states have no design authority, and P5's dash treatment collides with the cluster's ratified no-dash rule. And D-2: the `.sep` and the §21.1 register boundary still collapse to one token value, a token-contract change rather than a header edit.

**4. Item 6 survey — closed, nothing to fix.** No `[]`-dep effect reading a `window.*` value remains above the page. Only `GlobalHeader` (both layouts) and `PostHogProvider` (root) render above the page; `PostHogProvider` has no `useEffect` at all, and the `GlobalHeader` subtree's three effects are all correctly keyed — `BrandCluster [targetMs]`, `VisitorCounter [pathname]`, `HeaderNav [pathname]`. The two `[]`-dep effects that exist (`DebatePoll.tsx:74`, `DiscoveryCarousel.tsx:120`) live on **pages**, so they remount on navigation, and neither samples mutable state anyway: a self-updating `visibilitychange` subscription and a one-shot `requestAnimationFrame`.

---

## Next session starts at

**Gate C is PASSED; the PR is deliberately unopened.** Next action, exactly: open the PR from `polish/1a` → `main` with the four commits above, wait for the required `ci` check, then squash-merge and record the squash SHA. Nothing in this branch is pushed yet, so `git push -u origin polish/1a` comes first.

---

## Context to preserve

- **Not pushed. No PR.** Branch is local-only in a detached worktree; primary tree untouched on `chore/header-portfolio-log`.
- **The still** is at `~/Desktop/POLISH-1a-still.html` — self-contained, 237 lines, opens by double-click. Two states × (AS BUILT | TARGET) at true 1440, stacked rather than side-by-side (a 2px delta like V7 is invisible under the scaling that side-by-side at 1440 would require). Not in the repo, and **not a verification artifact** — see Surprise 1.
- **`POLISH-1-D-recon.md`** at `~/Desktop/` is the upstream evidence for D-1/D-3/D-4 and both class-S gaps.
- **The reviewer's independent verifications, worth not re-deriving:** V9's and V2's computed-style equality checked against `globals.css` resolution chains; the `.dark` block confirmed genuinely never applied (no `next-themes`, no `ThemeProvider`, no `classList` manipulation, no `dark` class on `<html>`/`<body>`) so the surviving `dark:after:mix-blend-lighten` is inert; `usePathname()` confirmed to re-render consumers on soft nav **without** remount, via `PathnameContext` — which is what makes V5's render-time gate live rather than frozen at first paint.
- **`ExecuteTruncateGuts` in suite logs is benign noise**, not a failure — it appeared 6593 times in an exit-0 run. The append-only TRUNCATE guards being exercised by `truncate-rejected.spec`.
- **`claude-progress.md`** (gitignored, primary tree) carries the same carry lines and the A11Y.0/parked routings.

---

## Time

One session, 2026-08-03. Phase 1 (recon-fed still) → HALT for ratification → Phase 2 build (C1 → C2 RED/GREEN → C3) → `@code-reviewer` (~8 min, 31 tool uses) → in-session fixes → Gate C round (second RED/GREEN + the suppression ruling) → four gate runs. Full-suite wall-clock 523s / 689s / 690s across the three complete runs; `next build` ~5s compile each. No unattended stretch — every phase boundary was operator-ratified.
