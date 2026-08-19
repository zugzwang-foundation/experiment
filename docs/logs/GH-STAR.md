# GH-STAR — the header's GitHub star control — execute close-out

Branch `feat/gh-star`, base `main` @ `4bb9023`, run from the worktree `.claude/worktrees/gh-star-plan` — which is this session's own working directory and so could not be removed as the kickoff asked (see *Surprises*). Not critical path: no schema, no migration, no engine contact, and no file under `src/server/{bets,comments,dharma,resolution,auth}`.

**The task is one control and one contract.** The repo is public, has zero stars, and nothing in the product pointed at it. The control is a header link carrying the live count — and the entire risk sits in the fact that **`0` is a real value and `unavailable` is a different one**. `0` is falsy, so any truthiness check collapses them and ships a header claiming a failed read on the exact count the repo has today. Everything below is arranged around keeping those two apart and proving they are apart.

**This session ran in two parts.** The first HALTED on a named condition; the second applied the founder's ruling and closed it. The halt is kept in this log rather than tidied away, because the thing it found is the reusable part.

## What landed (files + PR#)

9 files. **PR #362**; squash SHA at merge.

- `src/server/github/star-count.ts` — **NEW.** `readStarCount(): Promise<number | null>`. One unauthenticated GET, `next: { revalidate: 900 }`, `AbortSignal.timeout(2000)`. Never throws, never coerces a missing count to `0`. Both URLs are module-level string literals — **no interpolation from any request, route param, env value or user input**.
- `src/components/shell/GitHubStars.tsx` — **NEW.** Exports `GitHubStarsView` only: a **sync** view taking `stars: number | null`. The count span carries `data-testid="github-stars-count"` and exists **only** when `stars !== null`.
- `src/components/shell/GlobalHeader.tsx` — **MODIFIED.** New optional `stars?: number | null` prop defaulting to `null`; one JSX line between `RadioSlot` and `RulesControl`; the D1 deviation-register entry; the `stars`-must-be-a-prop note; the left-zone order sentence (which this change made false). **`:108`'s wrapper class string is byte-unchanged**, re-proven after the rewrite.
- `src/app/(public)/layout.tsx` · `src/app/(auth)/layout.tsx` — **MODIFIED.** Each awaits `readStarCount()` and passes `stars` down. Unconditional in both, unlike the viewer-scoped Đ pair.
- `tests/unit/shell/github-stars.test.tsx` — **NEW**, 6 tests: the 5-test 0-vs-null contract plus the A3 wiring positive control.
- `tests/unit/shell/github-star-count.test.ts` — **NEW**, 7 tests.
- `CLAUDE.md` — **MODIFIED**, one line: the §1 ADR-ceiling correction.
- `docs/logs/GH-STAR.md` — this log.

**Not created, per founder ruling:** `docs/adr/0038` (OD-2 overruled), any `docs/specs/` edit or §21.10 subsection (OD-3), any tracker row (OD-4 overruled — the D1 register entry is the record).

## Decisions made

- **OD-A → Option 3.** The `readStarCount()` await lives in the two layouts; `GlobalHeader` stays sync and takes `stars` as a prop. Not a workaround for a test: it is the only shape that keeps every ratified property (no `<Suspense>`, no header CLS, count still server-resolved before first paint) **and** it is the idiom this header already uses three times over for `portfolio` and `spendable`.
- **OD-B → both layouts fetch, unconditionally.** `(auth)` deliberately skips the two Đ reads because those are viewer-scoped and those routes are signed-out by definition. The star count is scoped to nobody. Omitting it would render the no-count arm on `/sign-in`, `/sign-in/otp` and `/onboarding` — visually identical to a failed GitHub read, which is the one confusion this control exists to prevent. The Data Cache makes the extra call free in practice.
- **The async wrapper was DELETED, not left beside the view.** Dead code here is a loaded gun: re-mounting it in the header silently re-breaks every header render test. The file now says so in place of the wrapper.
- **OD-1 applied as ratified.** The label takes the RULES type register — `text-[12px] tracking-[0.1em] text-ink` with RULES' `leading-[1.2] font-bold uppercase` — on **RadioSlot's box** (`px-3`, `gap-2`, `h-[34px]`, hairline, `--btn-fill`), which is the composition V2 actually measured. `text-ink` because a link is an enabled control and Radio's `text-n5` is a disabled slot's colour.
- **The CLAUDE.md ride grew from one number to three, and the founder ratified the extension.** The sentence said `0001–0036`, `(34 files)` and `next free 0037`; `ls docs/adr/` measures 35 numbered files, `0001–0037`, 0002 and 0012 still unused. Fixing only the third would have left the sentence asserting 0037 is unused — a *new* contradiction in the one sentence whose own parenthetical is an O-2 confession about going stale.
- **The RULES entry's `387.77px` was left alone** (founder-ruled). V2 showed it is the pre-RULES reading. The new D1 entry dates it instead of rewriting a ruled entry: `387.77 − 306.63 = 81.14`, and RULES plus its gap is `81.13`. **O-8** — that entry fences by symbol; no line number in it is load-bearing.
- **No reviewer cascade.** `src/server/github/` is not a §1 critical path, so §5.10 and §5.11 exempt it. Founder accepted, substituting an explicit URL-construction statement in the PR description.

## Surprises caught + fixed in-session (wins)

- **⛔ THE FINDING, and the reason Part 1 halted: an async component anywhere in the header's tree makes the WHOLE header unrenderable in jsdom.** The control first shipped as an async server wrapper that fetched for itself. React's client renderer refuses it outright — *"`<GitHubStars>` is an async Client Component"* — and `tests/unit/shell/dharma-cluster.test.tsx`, the only test that `render()`s `GlobalHeader`, produced `<body><div /></body>` and lost 3 of 11 assertions about `DharmaCluster`, the §21.1 divider and `VisitorCounter`. **None of those nodes is anywhere near the control that caused it**, and the error names the new component while the red lands in a file the PR never touched. Baseline proven both ways before it was called a regression: `git checkout origin/main -- GlobalHeader.tsx` → 11/11 green; my header restored → 3 red. The plan had the governing insight (*"an async server component cannot be rendered by `@testing-library/react`"*) and applied it to the new component's own test without tracing its second consequence — that the same fact removes the *header* from that harness.
- **⭐ The 0-vs-null contract was proven by reversal.** The falsy bug (`stars === null` → `!stars`) was injected at all four sites: **test 1 (`stars=0`) went RED, test 3 (`stars=null`) stayed GREEN.** That asymmetry is the whole argument for the pair — test 3 alone certifies a header that ships broken. Restored from a pre-injection copy, md5-verified (`b8c7014074f41d964fbc07680793d9ae`).
- **⭐ A3 — the wiring positive control, also proven by reversal, and it caught a real blind spot.** Option 3 makes `dharma-cluster.test.tsx` green by rendering the *unavailable* arm, which proves the header stopped crashing and **nothing at all** about the prop reaching the view. Breaking the pass-through (`stars={stars}` → `stars={null}`) leaves **`dharma-cluster.test.tsx` at 11/11 green, the 5 view tests green, the build green** — and reddens *only* the new test, with `the 'stars' prop never reached the view`. Restored and md5-verified (`2eb560e818a5f667746f2018ef9b4a65`). Without it the entire layout→header→view path was untested behind a green suite.
- **The A3 assertion was written against the `-1` trap the halt itself surfaced.** `findIndex` returns `-1`, and `-1 < 0` is TRUE — so a DOM-order assertion can be satisfied by a control that never rendered. Every index is asserted `>= 0` before any comparison. The failure that started this session read `expected -1 to be less than -1`.
- **Every `patch-fetch.js` line number in the A2 comment was re-verified against the installed Next 16.2.4**, not carried from the plan: `:349` `noFetchConfigAndForceDynamic`, `:355` the `revalidate = 0` assignment, `:363` `hasUnCacheableHeader`, `:383` `autoNoCache`. Also grep-confirmed that both `(public)` pages export `force-dynamic` (`page.tsx:18`, `m/[slug]/page.tsx:21`) — the segment condition `:383` needs. The plan's `:354` is the `else if`; the assignment is `:355`. **O-2.**
- **The D1 entry's mockup claim was verified before it was written.** `grep -i "github\|star"` over `DESIGN_W2_4-5-14_global-header_mockup-v0_2.html` returns 3 hits, **all three the substring `start`** (`justify-self:start`, `align-items:flex-start`). No repo link, no star count. **O-9** — the entry cites a document, so the document was read at HEAD.
- **A biome format error in my own new test file was caught by the gate and fixed scoped.** `biome check --write` was pointed at **only the files this PR touches**; `just format` would have swept four pre-existing warnings into this diff.
- **The full-suite exit was read from the log, not the wrapper.** The run is backgrounded with a trailing `echo`, so the harness reports the *wrapper* as 0 while the gate is whatever vitest returned. In Part 1 that distinction was the difference between "green" and `3 failed`.

## Open questions

None blocking. Two carried forward:

- **OD-D · the plan's `387.77px` in the RULES entry** — left dated rather than rewritten, by ruling. A later pass may correct it at source.
- **The `(public)`/`(auth)` layouts now both call `readStarCount()`.** Cheap today because of the Data Cache. If a future segment-level `fetchCache` export ever lands in `src/`, re-read `patch-fetch.js:340–392` — it is one of the four opt-outs that would silently un-cache this call. `tests/unit/shell/github-star-count.test.ts` pins the request shape but cannot see a segment export.

## Next session starts at

Founder reads the PR diff (staged as its own file in `~/Downloads`) → Gate C → merge. **Do not merge before that read.** After merge, staging: **O-10 — push `staging` BEFORE any branch push**, or Vercel dedups the SHA and the domain serves the old build while Staging Migrate reports green. Then the live acceptance test: the count node must be **present and read `0`** at 1440. ⚠ `0` and *unavailable* look nearly identical to a person glancing at the header, and staging is the only place the real GitHub read happens — a missing count node there is a FAILURE, not a rendering choice.

## Context to preserve

Base `4bb90232b43d95f71432f50ba0b82c12a287f565`, fetched not recalled. Final gates, each read unpiped with its own exit: `ZUGZWANG_ENV=preview just verify` **exit 0** (tsc clean · biome **0 errors**, 5 warnings + 4 infos — the unchanged VIEWS-1d baseline across the same five pre-existing files · `next build` exit 0, 27 routes); `pnpm vitest run tests/unit/shell/ tests/unit/design/` **exit 0 — 23 files / 158 tests**; full `pnpm vitest run` result in the EXECUTE-2 report.

⚠ **`just verify` exits 1 as a bare command in this worktree** — `Error: DATABASE_URL is not set` at `Collecting page data for /m/[slug]/export`. There is no `.env.local` here and `justfile:7` sets `dotenv-load`. Discharged by passing the **committed `tests/_setup/env.ts` placeholders inline**; no real `.env*` was read. Env-only, not a regression.

**The reusable lesson, for whoever writes the next header task:** `tests/unit/shell/dharma-cluster.test.tsx` is the only test that `render()`s `GlobalHeader`, and jsdom cannot render an async child anywhere in that tree. **Any header control needing server data takes it as a prop and the layout does the await** — `portfolio`, `spendable` and now `stars`. And when a prop replaces a fetch, the test that stopped failing is *not* the test that proves the prop arrived: write the positive control, and prove it by breaking the pass-through.

## Time

2026-08-19, ~1735 → close IST. One session in two parts: recon → write → gates → halt with a costed diagnosis → founder ruling → apply → gates → PR. The full suite is the bulk of the wall clock, twice.
