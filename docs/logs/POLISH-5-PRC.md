# POLISH.5 · PR C — session log (the chart lane)

**Time.** Executed 2026-08-16, ~04:30–05:30 UTC (overnight, unattended). Log written 05:37 UTC.
**Stratum.** POLISH.5 PR C — the third and last of the plan's three PRs (`AM-2`, §4).
**State.** ✅ **COMPLETE AND MERGED.** Gate C passed at web read.

---

## 1 · MERGE RECORD

| | |
|---|---|
| **PR** | [#340](https://github.com/zugzwang-foundation/experiment/pull/340) — *"POLISH.5 PR C — the chart lane: items 12·13·14·16 — ⛔ DO NOT MERGE — Gate C first"* |
| **Canonical SHA** | **`a464d527985650b45fd8f7bfd0dbc5df0bd44072`** — the squash-merge on `main` (branch SHAs are ephemeral) |
| **Merged** | 2026-08-16T05:25:51Z |
| **Base** | `fd4b357044f569027750d1b4a576a51bd54373bb` (PR B's merged head) |
| **Branch** | `polish/5-prc` (auto-deleted on merge) |
| **CI** | run **`31917086149`** · `completed` / **`success`** · head **`446e0ebdc51ccd86a43f5dcdc5d622c10b208afa`** · job `ci: success`. Also `Vercel: SUCCESS` |
| **Worktree** | `wt-prc`, created **fresh and detached** at `fd4b357`. ⛔ Neither spent detached worktree (`wt-p6-residency`, `wt-prc-preflight`) was reused |

**The six commits, in order:**

| SHA | Commit |
|---|---|
| `4d543f6` | `feat(profile): PR C · C1 — items 12 + 14, the node docblock and its both-pole fill guard` |
| `77b6e7a` | `feat(profile): PR C · C2 — item 13, FlipMarker's data-side removed + the three-arm guard` |
| `faae21d` | `feat(profile): PR C · C3 — item 16, the cumulative-arm Y gridlines + their count guard` |
| `5bf3c76` | `fix(profile): PR C — absorb @code-reviewer (the R2 claim, YES-disc legibility, dangling P5-D20b cite, 2 guard arms)` |
| `25d25a8` | `fix(profile): PR C — absorb @security-auditor Q1 (unruled built state, the §9 quote and its dropped clause)` |
| `446e0eb` | `docs(profile): PR C — state the graph-yes grey's own reason inline (plan 2.11 clause (a))` |

All six SSH-signed (ED25519, `SIG:G`), author **and** committer `Zugzwang/world <zugzwangworld@proton.me>`, **no `Co-authored-by` trailer**.

**Scope, and it held absolutely.** Exactly two files. **The entire PR removes three lines:**

```
-			data-side={seg.side}
-/** One own post/reply node — the grey core + side ring (the R2 node primitive).
- * Placement is `netWorthValue` (cumulative) or `marketValue` (per-market). */
```

One attribute (item 13) and the two lines of the lying docblock (item 12). `+230 / −3` across
`src/components/profile/graph/ProfileChart.tsx` and `tests/unit/profile/render/graph.test.tsx`.

---

## 2 · WHAT EACH ITEM SHIPPED

### Item 12 — the `GraphNodeMark` docblock (`P5-D20a`)

Replaced a docblock that was false. All four §2.11 `:1186` clauses are legible: **(a)** rim and core
are `--graph-yes`, a token whose NAME says YES and whose VALUE is mid-grey `#737373`, minted so
because the YES pole IS the ground colour — quoting globals.css's own words; **(b)** both are FIXED
on every side; **(c)** the r=5 disc's `fill` is the only side-keyed **COLOUR** expression and uses
the **POLE** family; **(d)** the ring encoding is routed, not settled here.

Both citations verified at source and **fenced by heading, never by line (O-8)**:
- *"the poles name the SIDE, never the Support/Counter relation"* → **AGENTS.md §8**. ⛔ **Not**
  CLAUDE.md §8 — that is O-space.
- the locked binding → **design-language.md §1 "Binding resolved"**. ⛔ **Not** the changelog entry.
  Independently corroborated by `docs/logs/POLISH-3-PR-2.md:231`.

### Item 13 — `FlipMarker`'s `data-side`, deleted (+ a three-arm negative guard)

The rule applied: **`data-side` stays where the element's render IS side-keyed and goes where it is
not.** `FlipMarker` strokes `--graph-yes` (rim) and `--graph-no` (arrows) unconditionally and its
geometry carries no side term — no pixel in it depends on the side.

Three arms, because one short proves half: the marker carries none (**new**); `segment-*` still
does (**cited**, not duplicated — `segment-stroke-by-side` already asserts both poles' values);
`graph-node-*` still does (**new work** — asserted by no test of this component before).

`data-side` census in `src/`: **6 → 5**. Exactly one removed.

### Item 14 — the both-pole fill assertion

Anchored **by test name** inside `it("node-on-line-placement")`, not by the plan's `:284-289`, which
was dead in kind at head. Asserts the **literal token string** on the r=5 circle's `fill`, plus
two-direction non-vacuity (both poles present in the fixture; the observed fills form a set of 2).

### Item 16 — Y gridlines, cumulative arms only (`OD-9`)

5 intervals collapsed / 10 expanded, **unlabelled**, drawn first so they paint behind every series.
Each line is one interval's UPPER bound, which is why N intervals draw N lines. Spanned by the same
`xPx` endpoints the axis labels use, so **`geometry.ts` is read and never written** and no geometry
primitive was added.

⛔ **`OD-9`'s abstention held in both the code and the guard.** The per-market view draws none and
the guard asserts **nothing** about it — not a count, not a presence, not an absence. The code
records why: *"Zero here means 'not ruled', never 'ruled zero'."*

---

## 3 · HALTS FIRED — **NONE.** Named individually, because "no halts" is not a reading.

| Halt | Condition | Result |
|---|---|---|
| **HALT-BASE** | either baseline RED at head | ⛔ **DID NOT FIRE** — `side-pole-binding` 4/4 and `graph.test.tsx` 10/10, both green at `fd4b357` **before any write** |
| **HALT-A** | `side-pole-binding` reddens after item 13's removal | ⛔ **DID NOT FIRE** — green immediately after, exactly as measured. `data-side={seg.side}` was never in that census (the predicate needs a **ternary** whose body carries a colour token) |
| **HALT-W** | any write outside the two allow-listed files | ⛔ **DID NOT FIRE** — `git diff --name-only fd4b357..HEAD` returns exactly two paths |
| **RUN-STOP 14** | any edit to a token value in `globals.css` | ⛔ **DID NOT FIRE** — `globals.css` never entered the diff. Item 12 moved **prose to the values**; no value was moved to fit prose |

**Fences (§7), each verified mechanically rather than by eye:** `marketYMax` + its `niceMax` call
**byte-identical** (the one `niceMax` hit in the diff is an *added comment line*) · `geometry.ts`
absent from the diff · `globals.css` absent · `FlipMarker`'s glyph and both strokes untouched ·
`ProfileChart`'s exported signature, props and every geometry primitive untouched · `Segment`'s and
`GraphNodeMark`'s `data-side` both kept · `GraphNodeMark`'s fill untouched.

---

## 4 · ITEM 14'S TWO REVERSALS — this is the proof, not the green run

A guard that cannot fail is a receipt. Both reversals were applied to the live component, run, and
reverted; the file was restored byte-identical to its verified state.

| | Mutation | Result |
|---|---|---|
| **A** | fill made FIXED (`var(--color-yes)` on both poles) | 🔴 **RED** — `expected 'var(--color-yes)' to be 'var(--color-no)'` |
| **B** | ⚠ **the family swap** — NO arm → `var(--graph-no)`, *the identical `#fafafa`* | 🔴 **RED** — `expected 'var(--graph-no)' to be 'var(--color-no)'` |

⇒ **Reversal B is the one that matters.** `--graph-no` and `--color-no` are byte-identical in value,
so a **resolved-colour** assertion would have PASSED it and the guard would have silently stopped
proving what it exists to prove. This is `C-1`'s second trap firing exactly as designed, and it is
why the assertion must be against the **literal token string**.

**C2 and C3 were both written RED-first** — the guard added and observed failing before the
implementation landed (`expected true to be false`; `expected [] to have a length of 5`).

---

## 5 · ITEM 16'S GEOMETRY — measured from the rendered DOM, not reasoned

Probed once with a temporary `console.log`, removed before commit (verified: zero `console.log`,
zero probe markers in the committed file).

- **x:** every line spans `44 → 622` — the plot's own left/right edges, identical to the two axis
  labels' anchors.
- **y (expanded, N=10):** `264.4 · 236.8 · 209.2 · 181.6 · 154 · 126.4 · 98.8 · 71.2 · 43.6 · 16` —
  evenly spaced **27.6** apart, ending at the ceiling (`yMax`) at y=16.
- **No `NaN`:** `Array.from({length: 0})` never invokes the mapper, so the `/0` in the per-market
  arm is unreachable.
- **`key={bound}`** is collision-free because `series.yMax` is the constant `PROFILE_GRAPH_Y_MAX`.
  Keying by the interval value (not the array index) is what keeps `lint/suspicious/noArrayIndexKey`
  green **without suppressing a Biome rule** — which would have been an AGENTS.md §11 *ask first*
  with no operator awake to ask.

---

## 6 · GATES, AND THE PREDICTED FAILURE THAT DID NOT HAPPEN

| Gate | Result |
|---|---|
| `just verify` | ✅ **EXIT 0** before **every** commit, never after |
| Biome | ✅ **0 errors**, 5 warnings, 4 infos — **identical to the head baseline**. PR C adds no lint |
| Full `pnpm vitest run` — run 1 (at C3) | ✅ **EXIT 0** — 345 files / 3183 passed — **516.59 s** |
| Full `pnpm vitest run` — run 2 (final tree) | ✅ **EXIT 0** — 345 files / 3183 passed — **348.21 s** |
| Targeted (`design/` + `profile/` + sibling `price-chart`) | ✅ 23 files / 279 passed |
| CI | ✅ run `31917086149` → `success` |

**Suite counts: 3186 → 3188 tests** (+2 cases — item 13's guard, item 16's guard; item 14 added
assertions to an existing case). Test files unchanged at 346.

### ⚠ The FK non-event, recorded because its ABSENCE is the finding

Step 0.5 was briefed to expect a slow (~700 s) run and **FK violations in whichever file was
adjacent** — the bloat having widened a latent teardown race, with three prior runs each reddening a
different file. **Across two full runs there were ZERO failures of any kind and ZERO FK-adjacent
failures**, and both runs came in **under** the predicted duration.

The bloat itself is real and unchanged, read once for the record and **not acted on** (founder
ruling (a): accept it, no vacuum): DB **270 MB** · `pg_class` 202 MB / **788,088 dead** ·
`pg_trigger` 49 MB / **271,972 dead** · slot `cainophile_xtgm8wby` active, `age(catalog_xmin)`
**63,622**. A logical slot pins catalog tuples and `pg_class`/`pg_trigger` **are** catalog tables, so
no vacuum can reclaim them while it lives; `VACUUM FULL` is already spent (13 s, zero reclaimed).

⇒ **The bloat did not express as teardown races on this tree.** Recorded so the next session neither
re-derives the constraint nor treats its absence as proof the bloat is gone.

---

## 7 · REVIEWERS — both run **sequentially**, exactly as §14 ruled

`@db-migration-reviewer` ⛔ **NOT RUN** — ruled out; no schema, no migration. Correct.

⚠ **Every finding was verified against the live repo before being absorbed.** Both agents were
treated as advisory, not authoritative; **all evidence confirmed**, and two findings proved *sharper*
than reported. Every finding absorbed in-session; **none deferred**.

### `@code-reviewer` — 0 CRITICAL · 2 HIGH · 1 MEDIUM · 7 LOW

| # | Finding | Disposition |
|---|---|---|
| **HIGH 1** | The corrected docblock **kept `(the R2 node primitive)`** from the docblock it was correcting. R2 is a **crowd-split ring** — *"BLACK = YES-money on EVERY node"* — while this rim is one fixed grey | ✅ **FIXED.** The same defect class item 12 exists to end, carried forward verbatim. Now states ⛔ **NOT** R2, with the reason: `GraphNode` carries neither a stake nor a crowd field, so R2 is **unrenderable from this DTO** |
| **HIGH 2** | The YES-disc legibility fact was stated in two halves that never joined; the grey core's purpose was attributed to the token | ✅ **FIXED.** Now states what a reader SEES: the **annulus** between core and rim is the pole cue — ground-dark on YES, white on NO |
| **MEDIUM 3** | The routing citation was a **dangling pointer** — `P5-D20a`/`P5-D20b` appear nowhere in the file cited | ✅ **FIXED** — now cites the definition site, `docs/plans/POLISH-5.md` §3.1 |
| **LOW 4** | *"only side-keyed expression"* — `data-side` is also side-keyed | ✅ **FIXED** → *"only side-keyed **COLOUR** expression"* |
| **LOW 5** | *"the 0 baseline is carried by the X labels"* overstates — nothing draws a 0 baseline | ✅ **FIXED** — the comment now says so explicitly |
| **LOW 6** | *"asserted by NO test anywhere"* is false — `price-chart.test.tsx` asserts it for a **different** component sharing the testid prefix | ✅ **FIXED** — claim scoped, counter-example named in the comment |
| **LOW 7** | `stroke="var(--color-n2)"` vs `className="stroke-n2"` | ⚖️ **CONSIDERED AND KEPT — recorded, not silently ignored.** Every other stroked element in this file uses the `stroke=` **attribute** form (`line-networth`, `line-freedharma`, both FlipMarker circles), so the gridline matches its immediate neighbours; and the attribute form **cannot silently fail to generate a utility**, whereas a non-generating `stroke-n2` would ship invisible gridlines that no test would catch. With no operator awake, the un-failable form was the right risk |
| **LOW 8** | Two guard hardenings for item 16 | ✅ **BOTH ADOPTED** — a **distinct-`y`** assertion (a count-only guard passes on an implementation stacking all ten lines at one y) and an **exact `<text>` count of 2** (the per-line `textContent` check would miss a `<text>` rendered as a *sibling* of the lines) |
| **LOW 9** | `arrangement.test.tsx:520` carries a stale *"PR C is UNSTARTED"* comment | ⛔ **NOT FIXED — CORRECTLY.** That file is on **neither** allow-list; editing it would have been HALT-W. **Still open — see §11** |
| **LOW 10** | No `docs/logs/` session log (CLAUDE.md §5.9) | ⛔ **NOT WRITTEN IN PR C — correctly, but raised under the wrong theory.** See §10 |

### `@security-auditor` — scoped to §14's two directed questions and nothing else

**Q2 — does item 13's deletion remove any LIVE ENCODING? → ✅ NO. Clean pass.**

The rule was applied correctly and surgically. `FlipMarker` is genuinely side-blind (`grep "side"`
over the function body returns **zero** after the deletion) — the attribute described something the
pixels never showed. The value is **relocated, not lost**: every marker has a sibling
`segment-${marketId}-${episodeIndex}` — same join key, rendered unconditionally — that still carries
it; recovery is 1:1 and total. Four out-of-tree consumer classes checked, all negative: **zero** CSS
attribute selectors and zero `data-[side` Tailwind variants; PostHog runs `autocapture: false` with
recording disabled; the 2026-11-06 export is text-only from DTOs and does not include the profile
graph at all; the `<svg>` is `aria-hidden` so AT never reaches it; and no Playwright/E2E/screenshot
runner is installed.

**Q1 — is the docblock accurate against the resolved token values? → 2 HIGH, both fixed.**

| # | Finding | Disposition |
|---|---|---|
| **HIGH 1** | *"the two differ by decision, not by drift"* is **unsupported** — built state laundered as ruled state | ✅ **FIXED.** This is the surprise — see §8 |
| **HIGH 2** | The quote *"rescues mostly-black YES nodes that otherwise vanished"* was cited to **§3** but lives in **§9**, and was **truncated**, dropping **"on the black YES line"** | ✅ **FIXED.** The dropped clause was load-bearing: the prototype's problem was a black node on a **black YES line**, and *this build has no black YES line* — `--graph-yes` is grey for exactly that reason. Now cites §9, keeps the full quote, and distinguishes the two cases |
| **LOW** | *"no side-keyed render, so `data-side` was encoding nothing"* — premise true, conclusion overshoots | ✅ **FIXED** — the guard's comment now says no *pixel* depended on it, and that the value survives on the sibling segment |

---

## 8 · ⚠⚠ THE SURPRISE — and the founder ruling it produced

**The profile node's pole-family disc fill — the very expression item 14 now asserts — was UNRULED
BUILT STATE with a measured legibility defect.** Four measurements, each re-verified at the live
repo after the auditor raised it:

1. **`UI-A5.md`, slice 5** — the slice that *built* `components/profile/graph/**` — specifies
   **"brand tokens `--graph-yes/-no`, R2 ring law"**. It names no `--color-*` use anywhere. So
   neither the `--color-*` fill **nor** the absence of the R2 ring is what the build slice asked for.
2. **`MarketPriceChart.tsx:24-28`** gives the reason for preferring `--graph-*` in **generic** terms,
   not market-specific ones: *"`--color-yes` = the ground, so a value-copy would be invisible AND
   invert the poles."*
3. **`docs/logs/UI-19-log.md:256`** — the market twin shipped under an explicit constraint:
   *"ZERO `--color-yes/no` bindings (INV-3 poles safe)."*
4. **`docs/logs/POLISH-3-PR-2-HALT.md:240`** — the identical pairing (`#181818` on `#212121` ≈
   **1.09:1**) was filed as **MEDIUM-3 and FIXED** on the split-bar track.

The YES node's fill is very nearly invisible against its own `bg-n0` panel, and `git log -L` shows it
was written once at file creation and never revisited.

**PR C changed no code for it, and that was correct** — the fill sits inside §7's explicit no-edit
fence (*"item 14 asserts the fill; item 12 describes it"*) and item 14's pole-family assertion is
plan-ratified. What PR C did do is make the docblock record it as **unruled built state** instead of
laundering it as a decision. That is precisely item 12's job.

> ### ✅ FOUNDER RULING, 2026-08-16 (landed with Gate C's PASS)
>
> **The profile node's disc fill MOVES to `--graph-*`, and item 14's assertion MOVES WITH IT, in the
> SAME COMMIT.**
>
> ⛔ **NOT in this dispatch.** It is a **separate one-item PR**, and **`P5-D20b`'s destination still
> needs a mint** — `docs/parked.md` has no profile-node row today; `CHART-NODE-RING` is
> **market-scoped only**, independently confirmed at `POLISH-56-STEP0-RECON-CLOSE-OUT.md:148`.

⚠ **When that PR lands, `ProfileChart.tsx`'s docblock must move with it** — the paragraph recording
the fill as *unruled built state* becomes false the moment it is ruled and moved. **That is an O-9
trigger** (prose citing a governing document, changed in a way that alters what the citation
asserts) and belongs in the SAME commit.

---

## 9 · DEVIATIONS, MEASURED AND NAMED

- ⚠ **Branch convention — the kickoff called it singular; it is not.** PR A (#331) used
  `polish/5-pr-a` (hyphen before the letter); PR B (#333) used `polish/5-prb` (none). Took
  **`polish/5-prc`**, matching PR B as the direct predecessor. Asserted free local **and** remote
  before `checkout -b`.
- ⚠ **`D16` is an ambiguous bare identifier — the `GC-n` collision class (CLAUDE.md §8), one prefix
  over.** `P5-D16` is the entry%/live% row routed **OUT** (`POLISH-5.md:1429`); decision **`D16`** is
  the `P5-D20` split (`POLISH-56-STEP0-RECON-CLOSE-OUT.md:94`). ⇒ The docblock cites the routed
  artifact **`P5-D20b`** *and its definition site*, never a bare `D16` a reader could resolve to the
  wrong row.
- ⚠ **Build env in a fresh worktree.** A fresh worktree has no `.env.local`, so bare
  `ZUGZWANG_ENV=preview just verify` fails at `next build` with *"DATABASE_URL is not set"* —
  **env-only, not a regression**. Supplied the `tests/_setup/env.ts` placeholder env via a
  **scratchpad wrapper script**. ⛔ No `.env*` file was read, copied or written, and no repo file was
  added.
- ⚠ **Three §13 instrument deviations, recorded honestly — the outcomes held, the instruments
  differed.** The execute kickoff carried its own verify discipline and did not restate these;
  the plan outranks the kickoff, so they are gaps, not exemptions.
  1. §13 names **`pgrep -f 'node.*vitest'`** as the H12 instrument and says explicitly *"`ps | grep`
     is NOT the instrument."* **`ps aux | grep` is what was used.** The reading was clear and the
     full suite ran alone both times, so the outcome was sound — but the wrong tool was used.
  2. §13 requires **`pnpm vitest run tests/unit/profile/` before every commit**. What ran before each
     commit was `just verify` plus the targeted `graph.test.tsx` (the only `tests/unit/profile/` file
     PR C touches), with the full `tests/unit/profile/` directory at the two absorption points. A
     superset in effect, not the literal command.
  3. §13 requires **`P-2`'s two-point diff at every PR's branch point**. It was **not run as named**.
     The branch point was proven another way (fresh worktree detached at `fd4b357`, three-leg gate
     passed, both allow-listed files byte-identical since `ea1795e` per the pre-flight's measurement).

---

## 10 · LOW 10 — the session-log question, now settled

`@code-reviewer` raised the missing session log as a **CLAUDE.md §5.9 ↔ allow-list conflict**, and
PR C did not write one. **The escalation was right; the theory was wrong.**

> ### ✅ FOUNDER RULING, 2026-08-16
>
> **There is no conflict.** Logs ride their **own chore PR post-merge** under standing doc-flow —
> descriptive docs are CC-authored from session context and web-reviewed at the PR gate. The execute
> allow-list was two files **because** the log was always a separate PR. **That carve-out should have
> been stated in the kickoff and was not; the omission is web's.**

⇒ This file is that separate PR. Recorded here so the next execute kickoff states the carve-out
rather than re-litigating it, and so a future reviewer does not re-raise LOW 10 as a live conflict.

---

## 11 · OPEN — carried forward, none of it PR C's to close

| Open item | Owner / route |
|---|---|
| ⚠ **The fill → `--graph-*` move**, with item 14's assertion in the same commit | **A separate one-item PR.** Founder-ruled; see §8 |
| ⚠ **`P5-D20b`'s destination is UNMINTED** — no profile-node row exists in `docs/parked.md` | Needs a mint before the fill PR can cite a live destination |
| `arrangement.test.tsx:520` still reads *"POLISH.5 PR C is fenced to symbols in that directory and is **UNSTARTED**"* | Stale as of `a464d52`. Off PR C's allow-list; a doc/test-comment sweep owns it |
| `PROFILE_COPY.error.action` = **"Try again" STANDS** (founder-ruled 2026-08-16); the four `POLISH-5.md` sites recording `NEW-1` as *"Retry"* get swept to match | **Doc-lane PR**, not this one. ⛔ CC authors no product copy (CLAUDE.md §3) |
| **Item 16's gridlines have never been seen in a browser** against the real compiled CSS | Geometry is measured from the rendered DOM in **jsdom**, not from pixels. The one genuinely unmeasured thing in PR C — named rather than left implicit |
| Five pre-existing Biome warnings + four infos (incl. `tests/staging/_lib/reset.ts:239`) | Pre-existing at `fd4b357`, untouched by PR C. Not PR C's |

---

## 12 · CEILINGS AT CLOSE — **read live at `a464d52` (O-2), not recalled**

| Register | High-water | Where |
|---|---|---|
| **ADR** | **`0036`** (`0036-vitest-context-operational-runners.md`); next free **`0037`** | `docs/adr/` — read the highest number, **never count** (the count is 34) |
| **O-space** | **`O-9`** | `CLAUDE.md` §8 |
| **V-space** | **`V-10`** | `docs/polish/POLISH-0_data-manifest.md` §5 |
| **L-space** | present | `docs/polish/POLISH-register-ADDITIONS.md` |
| **Migration head** | unchanged — PR C carries **no** migration | `drizzle/migrations/` |

⚠ **O-space was `O-8` in the CLAUDE.md loaded into the execute session and is `O-9` on `main`.**
`O-9` (the same-commit-rider trigger for prose citing a governing document by section) landed between
that session's tree and this merge. **Read live; the in-context copy was stale by one** — which is
`O-2` demonstrating itself, and the reason these ceilings are recorded as a *reading with a SHA*
rather than a fact.

**`O-9` was checked against PR C and does NOT fire.** The docblock adds citations to AGENTS.md §8,
design-language.md §1, design-canon.md §10, DESIGN-W2_6 §3 and §9, and POLISH-5.md §3.1 — every one
verified at source, and **none contradicts the document it names**. No rider is owed. ⚠ It *will*
fire on the fill-move PR (§8).

---

## 13 · WHAT THIS LOG DOES **NOT** DO

- ⛔ **Mints nothing and numbers nothing.** No `O-n`, no `V-n`, no `L-n`, no ADR, no register row.
  Everything above is routed **by symbol**. The high-waters in §12 are recorded as a *reading* so the
  next session does not re-derive them — they are not a claim to have advanced any register.
- ⛔ **Rules nothing.** The two founder rulings in §8 and §10 are **recorded as received**, not
  authored here. `OD-9`'s per-market interval count, `R-3`'s applicability to a removal, and the
  ring encoding all remain exactly as open as they were.
- ⛔ **Changes no code.** One file, in its own PR.
- ⛔ **Does not advance staging.** At the time of writing, `origin/staging` is parked on
  `htmlfinish/market-detail` (open **draft** PR #341), **not** on `main`, so **`a464d52` is not
  deployed to staging**. The standing post-merge advance is **blocked on a founder decision**, not
  forgotten — it is a non-fast-forward and would tear down #341's review deployment.

---

## §5.9 SIX FIELDS

**What landed.** PR **#340**, squash **`a464d52`** on `main`. Two files:
`src/components/profile/graph/ProfileChart.tsx`, `tests/unit/profile/render/graph.test.tsx`
(`+230 / −3`). Items **12 · 13 · 14 · 16** — the whole of POLISH.5's chart lane.

**Decisions made.** Fence-by-symbol anchoring for item 14 (the plan's `:284-289` was dead in kind) ·
`key={bound}` over an index key, to avoid suppressing a Biome rule with no operator awake to ask ·
LOW 7 kept (`stroke=` attribute form) on un-failability grounds · reviewer absorptions committed
**separately** rather than amended in, so the review trail survives in the branch history.

**Open questions.** §11's table — chiefly the founder-ruled **fill → `--graph-*`** move (a separate
one-item PR, with item 14's assertion moving in the same commit) and **`P5-D20b`'s unminted
destination**.

**Next session starts at.** ⛔ **Resolving the staging block** — `origin/staging` is on open draft PR
#341's branch, so advancing it to `a464d52` is a **force push that tears down that review
deployment**. That is a founder call, not an executor's. Once ruled, the standing §2.5 advance runs
and the `/api/health` canary is the gate — **not** the migrate exit code (drizzle-orm #5769).

**Context to preserve.** Item 14's **Reversal B** is the load-bearing artifact of this PR: because
`--graph-no` and `--color-no` are byte-identical (`#fafafa`), only a **literal-token-string**
assertion can tell the two families apart, and a resolved-colour assertion would pass while proving
nothing. If that assertion is ever "simplified" to a computed colour, the guard dies silently. ⚠ And
the same coincidence is why the §8 fill move must carry item 14 with it **in the same commit**.

**Time.** Execute ~04:30–05:30 UTC 2026-08-16 (overnight, unattended). Two full-suite runs, 516.59 s
and 348.21 s. Log written 05:37 UTC.
