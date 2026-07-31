# PCT.ROUND — session log

> **Date:** 2026-07-31 · **Session:** unattended overnight run (operator asleep; two PRs left open for morning review)
> **Model:** Opus 5, session ID `claude-opus-5[1m]`; effort `max` (harness: "this session only")
> **Mode:** single-threaded. `ultracode` FORBIDDEN, dynamic/auto-orchestrated workflows FORBIDDEN, no fan-out. Named subagents sequential only.
> **Worktree:** `/Users/hrishikesh/code/zugzwang/wt-pctround` (own worktree; the PRIMARY tree was never written to)
> **Ground:** `origin/main` = `b2e8bb1` — `merge-base --is-ancestor b2e8bb1 origin/main` exit 0. Main did not advance during the run.

Two independent PRs, sharing **zero files**:

1. **#275** `chore/model-repin` — `chore(harness): repin CC and subagents to Opus 5`
2. **#276** `fix/pct-round` — `fix(debate): derive NO percent as 100 − YES so price pairs sum to 100`
3. **#277** `chore/pct-round-log` — this log

**MERGE ORDER: #275 first, then #276.** (#277 any time.)

---

## What landed

### PR #275 — MODEL-REPIN (docs + agent frontmatter only)

- `.claude/agents/{code-reviewer,db-migration-reviewer,security-auditor,test-writer}.md` — `model: claude-opus-4-8` → `claude-opus-5`; `effort: max` unchanged.
- `CLAUDE.md` §6 — headline pin, pin history appended, subagents paragraph, the `/effort` session-scope correction, and the new D4 dynamic-workflow rule.
- `CLAUDE.md` §7 decision log — CC model line.
- `docs/workflows/plan-then-execute.md` — Prerequisites (model + the `/effort` persistence correction).
- `docs/maintenance.md` — 2026-07-31 entry + two **backfilled** entries (2026-07-16 Fable-5 re-open, 2026-07-18 OQ-7 close) + "Last revised" footer.

### PR #276 — PCT.ROUND (the fix)

- `docs/plans/PCT-ROUND.md` — committed **first**, before any code (`5faeb52`).
- `src/components/debate/format.ts` — new `formatPricePercent(pricing, side)`; `formatPercent` → `formatPercentUnpaired`; shared private `wholePercent` integer core.
- `src/components/debate/{PriceBar,DebateColumn}.tsx`, `composer/{SlotHeader,PositionStrip}.tsx` — migrated to the paired formatter.
- `src/server/debate-export/serialize.ts` — both prose percent sites (`:174`, `:242`) migrated.
- `src/components/debate/chart/geometry.ts` — **`fmtPct` DELETED** (the seventh site; float math on a price).
- `src/components/debate/chart/MarketPriceChartCard.tsx` — two readouts → `formatPercentUnpaired`, each with its own `pctround-allow:` marker.
- `docs/specs/SPEC.1.md` — the rider: §0 `1.0.23 → 1.0.24` + last-updated `2026-07-31`; §10.8 new paragraph; §20 new row (newest-last). **Then corrected pre-merge in `74aa31b`** — see **Pre-merge corrections** below.
- Tests: `tests/unit/debate/format.test.ts` (extended), `tests/unit/debate/format.property.test.ts` (new), `tests/unit/debate/render/price-percent-pair.test.tsx` (new), `tests/unit/design/pct-round-render.test.ts` (new static guard).

---

## The defect, reproduced

The behavioural RED was written **before** any implementation and run against the pre-fix `formatPercent`. Verbatim failure:

```
FAIL  tests/unit/debate/format.test.ts > PCT.ROUND RED — independent per-side rounding renders 101 > sums to exactly 100 at an exact .525/.475 tie
AssertionError: expected '53% + 48% = 101' to be '53% + 47% = 100' // Object.is equality

Expected: "53% + 47% = 100"
Received: "53% + 48% = 101"
```

That output is the proof the guard has teeth. The tie is invisible to every existing fixture in the tree — all of them are exact 2-dp probabilities (`0.38/0.62`, `0.54/0.46`, `0.50/0.50`), which is exactly why no test caught this.

## The guard, proven red

Method: revert → red → restore (DROUND's documented method). **Both** arms were driven red in one pass, then restored.

Revert 1 — a real paired call site (`PriceBar.tsx`) back to the unpaired hatch with no marker.
Revert 2 — resurrect the deleted float-percent idiom in `chart/geometry.ts`.

```
FAIL  … > uses formatPercentUnpaired only at the exact allowlisted single-side readouts
AssertionError: expected [ Array(1) ] to deeply equal []
+   "src/components/debate/PriceBar.tsx:23",

FAIL  … > computes no percent by float multiplication on a price
AssertionError: expected [ Array(1) ] to deeply equal []
+   "src/components/debate/chart/geometry.ts",
```

Both files restored byte-for-byte; guard re-run **green** (3/3). A guard that has never failed is not a guard.

## Verification

| Gate | Result |
|---|---|
| `pnpm tsc --noEmit` | **exit 0** |
| `pnpm biome check .` | **exit 0** (1 pre-existing warning: unused `eq` import, untouched by this diff) |
| Full suite baseline @ `b2e8bb1` | 281 files / **2027 passed**, 1 skipped, 4 todo, exit 0 |
| Full suite after the fix | 284 files / **2059 passed**, 1 skipped, 4 todo, **exit 0** |
| `src/server/cpmm/calculate.ts` diff | **0 bytes.** No file under `src/server/cpmm/` changed at all. |
| Golden fixture `mumbai-metro.expected.md` | **byte-identical** — not regenerated |
| Branch file overlap (#275 ∩ #276) | **empty** — the two branches share zero files |

Gates were run **unpiped** with the real exit code echoed — piping to `tail` returns tail's status and swallows failures.

**The delta accounts exactly.** `+3` files and `+32` tests, all mine: `format.test.ts` +20, `format.property.test.ts` +3, `pct-round-render.test.ts` +3, `price-percent-pair.test.tsx` +6. `2059 − 32 = 2027` — every baseline test still passes, none removed, none weakened.

### Reviewer — `@code-reviewer` (sequential, sole reviewer per ruling F)

**APPROVE. CRITICAL: none. HIGH: none. MEDIUM: none. LOW: 1 (not applied).**

It cleared all four directed concerns explicitly — derived-complement arithmetic and clamp behaviour, no missed call site, the client/server boundary, and scope discipline against the plan — and verified the `calculate.ts` zero-diff independently with `--exit-code`. It also confirmed the guard's marker bookkeeping: three literal `pctround-allow:` strings exist, one of them in `format.ts`'s own docblock, which the `FORMATTER_MODULE` skip correctly excludes, leaving the counted total at exactly 2.

No remediation was required, so the PR opened normally rather than as a draft.

---

## Decisions made

1. **`formatPercent` was RENAMED, not aliased.** DROUND tried an import alias for this role and reversed it at the gate, because a reader saw one name silently resolving to another. A call site must announce that it is unpaired.
2. **The paired formatter takes the whole `pricing` object**, not a price string. Enforcement is structural: it is impossible to render a NO percent without holding the YES price. It never reads `pricing.no` — asserted directly by a test that passes a poisoned NO string and still gets `47%`.
3. **The guard scans `src/server/debate-export`** — a scan dir DROUND's guard lacks. That omission was a real gap for this rule, since `serialize.ts` is a percent call site.
4. **The two chart readouts were hoisted to named consts** rather than marked inline with JSX `{/* */}` comments, which would have risked whitespace drift in the `sr-only` summary the existing render test asserts on.

---

## Unratified choices

Judgement calls I had to make that the rulings did not cover. Each is flagged for morning adjudication.

**1. STEP 2.1's agent-file copy was SKIPPED — its premise is disproved.**
The instruction was to copy the four repinned `.claude/agents/*.md` into the `fix/pct-round` worktree uncommitted "so that `@code-reviewer` resolves correctly during this run". I proved that **agent definitions are not hot-reloaded**: a temporary in-body marker added mid-session did not fire, while a fresh headless session reading the same file did fire it. So an uncommitted copy cannot change how *this* session resolves the reviewer — it would be pure risk (cross-contaminating two PRs that must share zero files) for zero benefit. I skipped the copy and instead verified before every commit that `.claude/agents/` was not staged. Separately, a baseline probe showed the *existing* `claude-opus-4-8` pin still resolves fine in this Opus 5 session (1 tool use), so `@code-reviewer` was never at risk.
*Options were:* copy as instructed (risk, no benefit) / skip and verify staging (chosen) / re-pin the primary tree (forbidden — HALT 5).

**2. CLAUDE.md §6's old dynamic-workflow default was REPLACED, not appended beside.**
§6 previously asserted the *opposite* of the new D4 rule — "`ultracode` + dynamic / auto-orchestrated workflows are **the default working mode** for ordinary, reversible, parallelizable work". The ratified rule says "Default FORBIDDEN." Both cannot stand in one contract file. I replaced the superseded clause and updated the matching §7 decision-log line for the same reason. The D4 text itself is verbatim.
*Options were:* append and leave the contradiction / replace the superseded clause (chosen) / append and flag for later (leaves the contract self-contradictory overnight).

**3. The maintenance-log entry cites the task ID, not a PR number.**
`docs/maintenance.md`'s 2026-07-31 entry says "MODEL-REPIN" rather than "PR #275", because the entry had to be written before the PR existed. Adding the number afterwards would have meant an amend + force-push of an already-open PR — an unnecessary overnight failure mode. Precedent exists both ways (the 2026-06-10 entry has no PR cite; the 2026-06-28 one does).

**4. `@test-writer` was not invoked; I authored the tests directly.**
The kickoff's named reviewer sequence is `@code-reviewer` only, and explicitly waives `@security-auditor`. A display formatter is also not one of CLAUDE.md §5.6's thesis-touching surfaces. Per house rule, an omitted §5.11 reviewer is treated as ratified scope, not an oversight — so I did not silently add one. RED-before-GREEN was still honoured in full.

**5. The rider's `(cpmm §10.2)` citation points at the wrong section — landed verbatim anyway.**
The rider justifies the derived rule by the engine pinning `|p_yes + p_no − 1| ≤ 1 ulp` "(cpmm §10.2)". cpmm.md **§10.2 is "Configuration"** (the `CpmmDecimal` clone); it does not state the price-sum guarantee. cpmm.md's own prose (line 118) states the *stronger idealised* form, "p_yes + p_no = 1 identically". The ≤1-ulp form is the **tested** guarantee, at `tests/unit/cpmm/invariants.property.test.ts:316` ("line 5 — prices sum to 1: |p_yes + p_no − 1| ≤ 1 ulp").
**This is not a HALT.** HALT condition 3 fires when the rider is *factually wrong about the code*, and it is not — the substantive claim (the built engine guarantees ≤1 ulp, not exact equality) is true and is exactly why deriving NO is the robust rule. What is off is a spec **cross-reference**. The text is web-authored and verbatim, so I did not edit it. **Suggested fix for the operator:** change the parenthetical to cite the charter line-5 property test, or `cpmm §11 INV-C*`, rather than §10.2.
> **ADJUDICATED — fix before merge.** Corrected in `74aa31b`; see **Pre-merge corrections** below. Note my own suggestion of `cpmm §11 INV-C*` turned out to be wrong too, and was rejected on the evidence.

**6. The reviewer's one LOW finding was NOT applied.**
`@code-reviewer` noted that §10.8's *pre-existing* carve-out sentence — "Odds multipliers (2.17x), percentages, and counts are not Đ values and are not governed by this rule" — now sits directly above the new paragraph that *does* govern percentages, and suggested qualifying it to "…not governed by this **Đ** rule". It marked this non-blocking and correct under the intended reading ("this rule" = the Đ 0-dp rule, a distinct rule). I did not apply it: that sentence is pre-existing, web-authored spec prose sitting **outside the three ratified touch points** for this rider (§0 version, the §10.8 append, §20 row). Editing it would be an unratified spec change.
*Options were:* apply the one-word fix (cleaner prose, unratified spec edit) / leave and surface (chosen).
> **ADJUDICATED — fix before merge.** Corrected in `74aa31b` with ratified wording; see **Pre-merge corrections** below. The reviewer was right, and the edit was load-bearing for a different reason than prose clarity: without it the 1.0.24 §20 row was **inaccurate**.

---

## Pre-merge corrections

Both open spec questions were adjudicated **fix-before-merge** by the operator. **Three** web-authored corrections to `docs/specs/SPEC.1.md`, in two commits on `fix/pct-round`:

- **`74aa31b`** — `docs(spec): correct the 1.0.24 rider's cross-reference and scope boundary` (Corrections 1 + 2)
- **`bcaa3a8`** — `docs(spec): state the ulp tolerance as suite-enforced, not as the engine's guarantee` (Correction 3)

All three are edits to the **unmerged** 1.0.24 rider, made **in place** per the DROUND precedent: a rider is corrected while its version is still unmerged. Therefore **no version bump and no new §20 row** — §0 stays `1.0.24` / `2026-07-31`, and §20 keeps exactly one 1.0.24 row. Spec prose only: no code, no tests.

### Correction 1 — the wrong cross-reference (resolves unratified choice 5)

`(cpmm §10.2)` → **`(property-tested at tests/unit/cpmm/invariants.property.test.ts)`**.

This is the instruction's **option 2**, and option 1 was ruled out **empirically, not by preference**:

- **`ulp` appears ZERO times in `docs/specs/cpmm.md`** (`grep -c -i ulp` → `0`). Across all of `docs/specs/`, the only occurrence is the 1.0.24 rider sentence itself. So no `cpmm §N.N` states the ≤1 ulp tolerance, and there was no correct section number to cite.
- cpmm.md's **only** prices-sum statement is **§3.3 Price** (line 118), and it states the *opposite* of what the rider needs:
  > "…equals that side's probability (derived in §4.3). **p_yes + p_no = 1 identically**; there is no fee wedge between the two sides."
  That is the idealised real-number identity — exact equality. Citing it would have made the sentence self-contradictory: *"pins ≤ 1 ulp rather than exact equality (cpmm §3.3, which asserts exact equality)."*
- The `"line 5"` label in the property test is **not** a cpmm.md section. The test's own header calls it *"charter line 5"*, and the string `charter` appears nowhere in cpmm.md. Its `describe` attributes it to `cpmm.md §11`, but §11's numbered list is `INV-C1..INV-C5` and **INV-C5 is "Frozen determinism"**, not prices-sum. So the `cpmm §11 INV-C*` cite I had suggested for the operator was **also wrong**, and is withdrawn. *(A charter document does nonetheless exist — see **F-1** under **Findings — not fixed here**, which corrects the impression that none does: "the charter" is `cpmm.md` itself, so named by `docs/plans/ENGINE.3.md`, and "charter line N" indexes that plan's table. It is simply not self-identified inside cpmm.md.)*
- The tolerance is stated in exactly one in-repo artifact — `tests/unit/cpmm/invariants.property.test.ts:316`:
  > `it("line 5 — prices sum to 1: |p_yes + p_no − 1| ≤ 1 ulp", …)`

**Reported answer: option 2 was used.** No section number was invented.

### Correction 2 — the §10.8 scope boundary (resolves unratified choice 6)

The pre-existing 1.0.23 carve-out now reads:

> **Odds multipliers (`2.17x`), percentages, and counts are not Đ values** and are not governed by this **0-dp rule (market price percentages are governed by the complement rule below)** — including where a multiplier is rendered inside Dharma grammar…

Nothing else in that sentence or paragraph changed; the em-dash continuation about odds statements inside Dharma grammar is untouched.

**Verified: the 1.0.24 §20 row now reads true against the section.** The row claims it *"Amends §10.8's prior scope boundary, which excluded percentages by name at 1.0.23."* Before this edit that claim was **inaccurate** — the boundary sentence was textually unchanged, so 1.0.24 amended nothing of the sort. The row is now accurate: the boundary is scoped to the 0-dp rule and explicitly excepts market price percentages, and the complement-rule paragraph it points to sits below it in the same section. Machine-checked (three assertions, all PASS).

### Correction 3 — the ulp tolerance is suite-enforced, not a weaker engine guarantee (`bcaa3a8`)

Correction 1 fixed the *pointer* but left the *framing* wrong. The paragraph still read that the rule was "robust to the engine's actual guarantee, **which pins** `|p_yes + p_no − 1| ≤ 1 ulp` … **rather than exact equality**" — i.e. it cast ≤1 ulp as a weaker promise the engine makes *instead of* the identity. That misplaces both facts.

**Source verified before citing.** `docs/specs/cpmm.md` line 118, verbatim:

> `equals that side's probability (derived in §4.3). p_yes + p_no = 1 identically;`

It sits under **`### 3.3 Price`** (line 108), with the next heading `### 3.4 Domain` at line 121 — so line 118 is genuinely inside 3.3, and the section number and wording match what was reported.

The replacement separates definition from enforcement: the identity is **definitional** (cpmm §3.3), while the engine emits two *independently quantised 18-dp strings*, and **≤1 ulp is what the suite enforces on those strings** — not the identity itself. It also states the magnitude honestly: at 10⁻¹⁸ the slack sits fifteen decades below the 0.005 tie granularity, so the slack is **not** the defect; the argument for deriving NO is that a rule reading both strings depends on a property *stronger than the one the tests enforce*.

**No cascade.** The 1.0.24 §20 row does not mention the ulp tolerance at all — machine-checked for `ulp`, `tolerance`, `p_yes`, `10.2`, `invariants.property`, `quantis`, `identically`; all absent. Left unedited.

### Proofs

| Check | Result |
|---|---|
| `git diff origin/main...HEAD -- src/` unchanged across all three corrections | **byte-identical** — `md5 058cfeca780a0d018a819ba58b714033` at `bd0ee18`, `74aa31b` and `bcaa3a8` |
| `git diff origin/main...HEAD -- src/server/cpmm/calculate.ts` | **`--exit-code` 0, 0 bytes** |
| `git diff origin/main...HEAD -- tests/unit/cpmm/` | **`--exit-code` 0, 0 bytes** — the CPMM test dir stays out of this display-layer PR |
| Commit contents | `docs/specs/SPEC.1.md` only — 2+/2− (`74aa31b`), 1+/1− (`bcaa3a8`) |
| Full suite | 284 files / **2059 passed**, 1 skipped, 4 todo, **exit 0** — count unchanged |
| Version / §20 | `1.0.24` unchanged; **0** new §20 rows |

**One flaked run, worth recording.** The first post-Correction-3 suite run reported `1 failed | 283 passed` / 2057 tests — `tests/server/admin/moderation/audit-page-auth.test.ts` failing as a **Failed *Suite*** (collection), not a failed test: `Error: [vitest-worker]: Timeout calling "fetch" with ".../AdminTabs.tsx"`. Its 2 uncollected tests are exactly the 2059→2057 gap. Cause was machine contention — I ran `git commit` (lefthook → biome) concurrently with the suite; that run took **1435s with `transform 902s`** against a normal **176s with `transform 1.7s`**, an 8× difference. The file passes in isolation (2/2), and a clean re-run with nothing else running is **2059 passed, exit 0**. A docs-only prose diff cannot reach an admin auth test. Lesson repeated from the reviewer-cascade rule: don't run anything else against this tree while the suite is running.

---

## Findings — not fixed here

Docketed for a future row. **Nothing under `tests/unit/cpmm/` or `src/server/cpmm/` was touched** — this is a display-layer PR and that directory stays out of its diff (proven: `git diff origin/main...HEAD -- tests/unit/cpmm/` and `-- src/server/cpmm/` are both empty).

### F-1 — the CPMM property suite's "charter line N" citation is imprecise, and cpmm.md does not carry the tolerance the suite enforces

**What the test file cites.** `tests/unit/cpmm/invariants.property.test.ts` labels its cases "charter line N" and attributes them to cpmm.md §11:

- `:29–30` — `// ENGINE.3 property suite — cross-cutting invariants INV-C1..C5 (cpmm.md §11) + charter line 5 (prices sum to 1; getPrices-vs-p1 cross-consistency).`
- `:72` — `describe("invariants.property — INV-C1..C5 + line 5 (cpmm.md §11)", …)`
- `:316` — `it("line 5 — prices sum to 1: |p_yes + p_no − 1| ≤ 1 ulp", …)`

**What is actually at that location.** `cpmm.md` **§11 Invariants** (line 539) lists exactly `INV-C1`…`INV-C5` — Conservation, k non-decreasing, Domain, Solvency/residual identity, and **INV-C5 = "Frozen determinism"**. There is **no "line 5"** in §11 and **no prices-sum entry** anywhere in it. So the `(cpmm.md §11)` attribution on the `line 5` cases points at a section that does not contain them.

**Does a charter exist? YES — and this corrects an earlier reading in this log.** A charter does exist; it is simply not self-identified inside cpmm.md.

- **"The charter" is `docs/specs/cpmm.md` itself**, so named by `docs/plans/ENGINE.3.md:213`: *"`docs/specs/cpmm.md` v1.0.0 — the charter: **§3** (domain/price), **§4.2**, **§5.2**, **§5.3**, **§8.1**, **§10.3**, **§10.4**, **§11** (INV-C1–C5), **§12** (E1–E5), **§13** (API)."*
- **"Charter line N" indexes a table in the ENGINE.3 plan**, not a section of cpmm.md: `docs/plans/ENGINE.3.md:97–99` opens *"## Test plan (charter → named test)"* with a `| Charter line |` column running `1`, `2.1`–`2.4`, `3.1`–`3.4`, …; and `:48` maps `invariants.property.test.ts` → *"Charter line 4 + line 5"*.
- The word `charter` appears **nowhere in `docs/specs/cpmm.md`** — it is an ENGINE.3-plan name for that document, never a self-description. That is why grepping cpmm.md for it finds nothing.

**Consequence — narrower than first stated.** The five property tests **can** be checked against a stated list of invariants: `cpmm.md` §11 for `INV-C1..C5`, plus the ENGINE.3 charter-line table for the numbered rows. The real defects are two, and both are citation-level:

1. The `(cpmm.md §11)` attribution on the `line 5` cases is wrong — `line 5` is an ENGINE.3-plan row number, not a §11 entry. A reader following the citation lands on a list that does not mention prices summing.
2. **`cpmm.md` nowhere states the ≤1 ulp tolerance.** `grep -c -i ulp docs/specs/cpmm.md` → **0**. The spec asserts the exact identity at §3.3 (line 118): *"p_yes + p_no = 1 identically; there is no fee wedge between the two sides."* The tolerance exists only in `docs/plans/ENGINE.3.md:24` — *"asserted **≤1 ulp** after independent half-even rounding (§3.3). In charter (carry-forward assertion)"* — and in the test itself. So the property the suite actually enforces on the emitted 18-dp strings is stated in a **plan** and a **test**, never in the spec that the plan calls the charter.

This is precisely the gap SPEC.1 §10.8 now describes correctly after Correction 3: the identity is definitional (cpmm §3.3), the tolerance is what the suite enforces on the serialised strings.

**Suggested future row (not done here):** either add the ≤1 ulp string-level tolerance to `cpmm.md` §3.3 or §11 as a stated invariant, or re-point the test's `describe`/header citation at `docs/plans/ENGINE.3.md`'s charter-line table. Touching `tests/unit/cpmm/` is out of scope for a display-layer PR.

### F-2 — `docs/plans/PCT-ROUND.md:87` still carries the superseded `cpmm §10.2` cite

The plan's §5 failure-mode table reads *"the CPMM charter pins `|p_yes + p_no − 1| ≤ 1 ulp` (cpmm §10.2; `tests/unit/cpmm/invariants.property.test.ts:316`)"*. `§10.2` is *Configuration*, the same wrong pointer Correction 1 removed from the spec. Left unedited deliberately: the plan is a point-in-time record and sits outside the three corrections' ratified scope. Flagged so it is not mistaken for a live citation.

---

## Open questions

- **Price-bar fill geometry on the exact basis** — docketed in the rider, deliberately not done here.

*(The two spec questions above are closed — adjudicated fix-before-merge and landed in `74aa31b`.)*

## Context to preserve

- **Agent definitions are read at session start and are NOT hot-reloaded.** Editing `.claude/agents/*.md` mid-session has no effect on the running session; only a fresh session picks it up. This invalidates any workflow step that assumes an in-session agent-file edit takes effect, and it is now recorded in CLAUDE.md §6.
- **The correct way to test an agent model pin** is a fresh headless `claude -p` session rooted in the repinned tree, with a temporary in-body marker to prove the on-disk definition was the one loaded. Without the marker, a passing probe is ambiguous.
- **`/effort` does not persist** ("this session only"); `/model` does ("saved as your default for new sessions").
- The `Math.min(pct, 100)` clamp in `wholePercent` is unreachable on valid input (reserves are `requirePositive`) and is retained only as a defensive belt.
- `price2` (export YAML front matter) is 2-dp **ROUND_HALF_EVEN** via `CpmmDecimal.toFixed(2)`, and is structurally sum-preserving: `0.525 → 0.52`, `0.475 → 0.48`, sum `1.00`.
- **The guard's marker count depends on the `FORMATTER_MODULE` skip.** `format.ts`'s docblock contains the literal string `pctround-allow:`, so there are three occurrences in the tree but only two counted. This is the same shape as DROUND's guard (which skips the module for `formatDharmaExact`) and is deliberate — but if that skip is ever removed, the count becomes 3 and the guard fails spuriously.
- **Gate commands must not be piped to `tail`** — the pipeline exits with `tail`'s status and swallows a real failure. Every gate here was run unpiped to a log with `echo exit=$?`.

## Next session starts at

Review and merge **#275 first**, then **#276**. Nothing is blocked on further work.

---

## Closing ritual — should CLAUDE.md / AGENTS.md / the workflow / the tracker change?

**Yes, and all of it rides PR #275 rather than a follow-up:**

- **CLAUDE.md** — model pin, the `/effort` session-scope correction, the D4 dynamic-workflow rule, and the not-hot-reloaded fact. *(Done.)*
- **`docs/workflows/plan-then-execute.md`** — model + the corrected `/effort` persistence claim. *(Done.)*
- **`docs/maintenance.md`** — the new entry plus two backfills. *(Done.)*
- **AGENTS.md** — checked directly; it carries **no** model/effort/pin assertions, so nothing to change.
- **Tracker** — operator-maintained external HTML, never committed. PCT.ROUND has no tracker row; the operator may wish to mint one.

One item **not** actioned, surfaced rather than absorbed: `AGENTS.md` §9's test-layout inventory does not list the component-test harness (jsdom + `@testing-library/react`), which demonstrably exists and which this task used. That is a pre-existing descriptive drift, out of this task's scope (§5.4), and belongs to the next SYNC sweep.
