# PRIMITIVES-1 — session log

**Task:** Đ digit grouping product-wide (SPEC.1 §10.8, 1.0.29), avatar ring token binding, export formatter rename, three guards widened.
**Plan:** `docs/plans/PRIMITIVES-1.md` (#292, `ce52e80`).
**Gate C verdict:** **CLEAR TO MERGE**, conditional on commit 7 landing green. It did.

---

## 1 · What landed

**PR #293 → `997f308`** (squash-merge SHA on `main` — the canonical reference). Seven commits squashed, 24 files, +586 −140.

| # | commit | subject |
|---|---|---|
| 1 | `1895537` | `refactor: name the export Đ formatter for its layer` |
| 2 | `02a3a78` | `fix: bind the avatar ring to its ratified token` |
| 3 | `36a4727` | `feat: Đ digit grouping, product-wide` ⟵ the §10.8 rider rides here |
| 4 | `60378ef` | `test: widen three guards, each proven to bite` |
| 5 | `aed0601` | `fix: @code-reviewer pass — three in-scope corrections` |
| 6 | `102f676` | `docs: correct the §20 row count and two docblocks this PR falsified` |
| 7 | `dfd1091` | `test: pin displayNetProfitLoss's terminal grouping` ⟵ Gate C finding F1 |

**Spec.** SPEC.1 **1.0.29** — §10.8 gains the digit-grouping rule (five paragraphs between the 0-dp rule and the complement rule), §0 and the §20 change-log row. Landed in the same commit as the code it governs (C3 same-commit rider), so the three pre-ruling tests inverted against a ratified rule rather than a doctored baseline. No ADR, no DDL, no event type, no §16.1 constant, no §17 row.

**Code.** 13 `src/` files. `format.ts` gains `round0Dharma` (exported, the UNGROUPED displayed-space primitive) and module-private `groupInteger`; `formatDharma = groupInteger(round0Dharma(v))`. `composer/copy.ts::formatDharmaGrouped` **deleted**, its 13 Đ call sites re-pointed. `serialize.ts::formatDharmaGrouped` → **`formatDharmaExportGrouped`**. `avatar.tsx` bound to `--avatar-ring`. 10 test files + 1 new (`avatar-ring-token.test.ts`).

**Deploy.** Staging advanced **`1df95c0` → `997f308`** per `deploy-pipeline.md` §2.5. The advance carried **two** commits, not one — the plan commit (#292, `ce52e80`, docs-only) had merged without an advance, so it rode along. Migration head unmoved at `0024_bookmarks` (25 files / 25 journal entries, byte-identical both sides); precondition (c) EMPTY, migrate was a confirmed **no-op** (the two idempotent NOTICEs `42P06`/`42P07`, zero DDL); `db:check-drift` **IN SYNC**; `/api/health` `canary=997f308…`, `env=staging`, `db=ok`, `migrations=ok`. **Prod untouched** — still `a61859ae`, 99 commits behind, behind not diverged. DP.2 remains a separate gated task.

---

## 2 · Decisions made

**D1–D8** are in the plan and were ratified before execute. What the session settled beyond them:

- **R-K (execute ruling).** A **third** test pinned the pre-ruling ungrouped render — `hero-panels.test.tsx:103`, which the plan's §8 file list did not name. Halted on the §7 trigger rather than absorb it; ruled in, inverted with the other two. `StatLine.tsx` is one shared component consumed by both `MarketCard` and `HeroPanels`, and both tests asserted the identical literal off the identical `data-testid`.
- **Grouping is a property of the formatter, not a call-site choice** — with exactly **one** sanctioned exception, `displayNetProfitLoss`, which cannot route through `formatDharma` because the §23 identity must be summed in ungrouped displayed space first. That exception is now named, commented and tested (commit 7).
- **The export two-layer rule.** Prose body groups (a person reads it); machine-readable YAML front matter never does — `total_stake_dharma` stays on `formatDharmaExact`. The same quantity renders `3,225` in the body and `3225` in the front matter of one file, deliberately. Structural safety: `serialize.ts` never calls `formatDharma` at all — grouping cannot leak into the export by construction rather than by discipline.
- **The malformed path degrades UNGROUPED.** `groupInteger` returns its input untouched when the integer part is not `^\d+$`; composing blindly would have dressed `"1234abc"` up as `"1,234abc"`. A bad value is not dressed up.
- **`DisplayDecimal`, not `ComposerDecimal`,** in commit 7's comment. The ruling named the wrong clone; the clone in play inside `displayNetProfitLoss` is `DisplayDecimal` (`format.ts:19`). Flagged rather than shipped, and the correction was accepted — a permanent comment must not carry a wrong class name.

---

## 3 · Gate C — two findings the `@code-reviewer` and the R1 recon both missed

Both sat on the **test/comment surface**, which is the through-line of this session.

- **F1 — `displayNetProfitLoss`'s terminal grouping was untested. → FIXED, commit 7 (`dfd1091`).** P7 reverted `formatDharma`'s composition only, so the RED-first discipline covered one of the **two** grouping sites and not the other. Removing the wrapper left all 2189 tests green.
- **F2 — "guarded, not merely conventional" overclaims check 4's reach.** Surviving at `format.ts:35-38` and on the `ROUND0_RENDER` constant. **DOCKET — fold into L-2/L-3.** Not fixed this session.

**Gate C's own error, recorded at its instruction.** Gate C inferred *"no coverage exists"* from a diff, which a diff cannot establish. `tests/unit/profile/tile-identity.test.ts` existed — a dedicated `describe` for the function, six tests — and was **fixture-blind**: every assertion sub-thousand (`0`, `-30`, `0`, `1`, `0`, plus a malformed case landing on the catch exit), so none could observe grouping. **The finding survived; the reasoning did not.** Proven at P10: with the wrapper deleted, `tile-identity.test.ts` and `profile/render/surface.test.tsx` both stay **GREEN**, and only the new rows go red.

**G1 — the recon-template amendment: SEVEN requirements, replacing the render census with a consumer census.** ⚠ **TEXT NOT RECEIVED.** The full text lives in the Gate C verdict doc, which has not reached this session and is not on disk (see §7). Recorded here as a pointer only — the seven requirements are **deliberately not paraphrased or reconstructed**, per the standing rule against authoring web-owned decision text. This log must be amended with the verbatim text before the amendment is treated as landed.

---

## 4 · Surprises caught + fixed in-session

**1.** **Own defect, caught by my own new test.** The no-locale assertion read `format.ts` raw, so the docblock sentence that *names* `toLocaleString` / `Intl.NumberFormat` in order to forbid them tripped it. Now strips comments before matching. Logged so the 2-failure intermediate run is not misread as two scope findings.

**2.** **`dround-allow:` written in prose became a second allowlist marker.** The new `formatDharma` docblock wrote the literal guard token, so it occurred twice across the 113 scanned files. `toHaveLength(1)` survived only because the guard skips `format.ts` via `FORMATTER_MODULE` — a `continue` that exists for an unrelated reason. The "exactly one allowlisted seed" property was being enforced **by coincidence**. Token now spelled without its trailing colon.

**3.** **`split-bar.ts` docblock named "the single shared display formatter"** — which after C3 is the *grouping* one, the exact read-back `new ComposerDecimal("1,234")` throws on. Corrected.

**4.** **H-1 / H-2 — two docblocks the PR itself falsified.** `DharmaCluster.tsx` ("UNGROUPED per R4 … routed to POLISH, not settled here" — PRIMITIVES-1 *is* that ruling) and `StatLine.tsx` ("pure string trimming … no thousands separators v1"). Both retired in place, quoting the old text in past tense rather than deleting the history. The R1 sweep then confirmed **no third** such docblock exists: `previously read` occurs nowhere else in the tree.

**5.** **§20's 1.0.29 row said "the two docketed pre-ruling tests";** the inversion set is **three** after R-K. One substring replacement, not a re-transcription.

---

## 5 · L-9 — raised, then refuted, and it bought a durable property

At staging-verify the `@code-reviewer`'s L-9 (`Number()` on a Đ string at `graph/geometry.ts:46,68`, dispositioned "pre-existing, not in this diff") was re-opened on the grounds that the disposition considered the **file**, not the **values** — `Number("1,010")` is `NaN` where `Number("1010")` was `1010`.

**REFUTED.** `geometry.ts`'s `Number()` input is a **raw NUMERIC(38,18)** off the read model — `graph-series.ts` emits `toFixed18(new CpmmDecimal(...))` at `:293`/`:427`/`:481`; `yMax` is the constant `PROFILE_GRAPH_Y_MAX`. No display string reaches it.

The **≈130-site sweep** it triggered established a property worth keeping: **§10.8 terminality holds tree-wide at `997f308` — zero `coercion(formatter(...))` nesting anywhere in `src/`.** Every `formatDharma` / `displayNetProfitLoss` / `formatDharmaExportGrouped` return is terminal, reaching JSX or a template literal and never arithmetic. The near-misses are all correct by construction: `split-bar.ts:51` reads back `round0Dharma` (the ungrouped primitive); `gating.ts` is double-guarded by `PLAIN_DECIMAL = /^\d+(\.\d+)?$/`, which rejects a comma before any Decimal sees it; `sell-convert.ts` is seeded by `formatDharmaExact`, which never groups — the §10.8 named exception, existing for exactly this read-back reason.

---

## 6 · Staging verify — **PARTIAL**

**CONFIRMED, non-vacuously:**

- header **Balance `Đ 1,010`**
- discovery **StatLine `Đ 1,035`**
- **D4 character count `0 / 4998`** — ungrouped, proving the count exemption
- **multiplier exemption `Đ 1 → Đ 1.97x`**
- **`Đ BET`** copy
- **avatar ring**

**BLOCKED:** the **§23 tile row** and **any composer Đ figure ≥ 1000**. Every profile with enough data to produce one throws; the three profiles that render are all sub-thousand. This is blocked on data, not on code — see SP-1.

### The staging profile failure is EXONERATED of PRIMITIVES-1

`/u/RedOtter002` renders "Couldn't load this profile. Retry." The exception:

```
Error [ProfileTradeStreamError]: non-positive shares on buy 019ef411-9373-79ab-9e09-ad77ffc113d2
  kind: 'profile_trade_stream_invalid',
  digest: '723741083'
```

Thrown at `src/server/profile/episodes.ts:168`. Four independent exonerations:

- **Identical React digest `723741083`** on the **pre-advance `1df95c0` deployment**, still live at its own URL, against the **same** staging DB. Staging was not moved to obtain this.
- **Byte-identical read path** — `episodes.ts` `e954ebd0`, `graph-series.ts` `338f1ac0`, `geometry.ts` `668dba09`, `u/[pseudonym]/page.tsx` `36ffbb83` at both `1df95c0` and `997f308`; zero files changed under `src/server/profile/`, `src/components/profile/`, `src/app/(public)/u/`.
- **Error predates the advance by five days** — first seen `2026-07-31T18:04:21Z`; the advance was `2026-08-04T22:34Z`.
- **`RedBadger003` is the internal control** — it renders Đ figures through the same 1.0.29 formatters and renders fine.

Cause: **pre-existing staging fixture data.** 37 of 39 `bets` rows carry `share_quantity = 0`; there are 2 `bet.placed` events for 39 bet rows. 13 of 16 users hold at least one bad row. DB-predicted verdicts matched live results **6/6**, with distinct digests per user (distinct offending bet ids). The header renders because `getHeaderBalance` / `getHeaderPortfolio` read `dharma_ledger` and `positions` directly and never enter the trade-stream replay.

---

## 7 · Open questions

- **G1's seven requirements — TEXT NOT RECEIVED.** The Gate C verdict doc has not reached this session. Blocking for the recon-template amendment; nothing else depends on it.
- **The five POLISH.5 rows — TEXT NOT RECEIVED.** Same doc, same block. Not reconstructed.
- **The two Gate C docs are not on disk** and could not be staged (§9).
- **F2** — the `format.ts:35-38` / `ROUND0_RENDER` overclaim: docketed to L-2/L-3, not scoped.
- **`tile-identity.test.ts` still has no four-digit case of its own.** Commit 7's rows live in `format.test.ts` because the one-file constraint held; a reader working only in `tile-identity.test.ts` will not see the grouping pin. Candidate fold-in when a later task legitimately opens that file.
- **Doubled describe prefix** — resolved in commit 7 (template dropped to `"%s"`), noted only so the nit is not re-raised.

---

## 8 · New rows to mint

| ID | Class | Row |
|---|---|---|
| **SP-1** | **P0** | **STAGING-PARITY now blocks the §23 verify and all profile-surface testing.** 37 of 39 bet rows carry `share_quantity = 0` and no `bet.placed`. |
| **SP-2** | **DECISION** | **`CHECK (share_quantity > 0)`** — DDL, so full ritual + ADR. **Raise at STAGING-PARITY planning; do not build silently.** |
| **SP-3** | **DOCKET** | One bad row makes a whole profile **permanently unreachable**, and append-only means there is no remediation path. **`episodes.ts:168` is CORRECT — do not weaken it.** The question is blast radius, not whether to refuse. |
| **POLISH** | — | Portfolio / Balance read as **nested** by a reader. §21.8's labels carry load-bearing work and may not be sufficient. |
| **POLISH** | — | **`Đ10 staked`** on `/m/[slug]` vs **`Đ 100 staked`** on discovery — verify the spacing inconsistency before docketing. |
| **POLISH** | — | **"1 posts"** — no pluralisation, market page and discovery cards. |
| **POLISH.5** | — | **Five rows in the Gate C verdict doc — TEXT NOT RECEIVED**, not reconstructed. |

SP-3 is the one to read twice: the guard is right, and the correct fix is upstream of it.

---

## 9 · Context to preserve

- **`997f308` is the canonical SHA.** Branch SHAs (`dfd1091` etc.) are ephemeral; `feat/primitives-1` was auto-deleted on merge.
- **P10's shape is the reusable artefact** — three halves (PASS-BEFORE / FAIL-AFTER-naming-its-offender / GREEN-AFTER-restored-byte-identical), one probe at a time (R-I), exclusivity checked with own PID **and** own PGID excluded, gated on a **sentinel artifact written after the runner returns** — never on an exit code alone. A `ps|grep` check matches its own launching shell and returns 0 having run nothing.
- **The session's through-line:** every defect that escaped both the reviewer and the recon was on the **test or comment surface**. F13, F14, C4(c), R-K, H-1/H-2, and F1 — six instances, one genus. The R1 sweep looked for a seventh at `102f676` and found none.
- **A diff cannot establish absence of coverage.** Gate C's own recorded error, and the reason G1 replaces the render census with a consumer census.
- **§2.5 preconditions earn their keep** — (c) is the only thing that tells you *which* green to expect from the migrate job, and it only tells you beforehand.
- **Staging deployments persist at their own URLs**, which is how a pre-advance SHA can be executed against the live DB without moving `staging`. Cheapest possible answer to "was it already broken?".
- **PK refresh staging** — `~/Desktop/zz-pk-refresh-PRIMITIVES-1/`. SPEC.1 (1.0.29) and this log are staged and md5-verified; the plan was already there (`1d7e118e…`). **The two Gate C docs could not be staged — not on disk.**

---

## 10 · Next session starts at

**Relay the two missing Gate C artefacts into the repo**, in this order:

**1.** Send the **Gate C verdict doc** (inline paste, per the standing relay rule — file/path references have arrived empty before). It carries **G1's seven requirements** and **the five POLISH.5 rows**, both of which this log records as NOT RECEIVED.
**2.** Amend `docs/logs/PRIMITIVES-1.md` §3 and §8 with that verbatim text, same branch if still open, otherwise its own `chore/` PR.
**3.** Then **STAGING-PARITY planning**, where SP-1/SP-2/SP-3 are the agenda and SP-2 needs a decision before any DDL is written.

Do **not** start DP.2 — prod promote stays blocked behind the partial staging verify (§6).

---

## 11 · Time

Execute → Gate C → merge → staging advance → post-advance diagnosis, 2026-08-04 into 2026-08-05. Baseline green at `ce52e80`; one HALT (R-K, ~3h to ruling); full suite at the merged tip **296 files / 2195 tests passed | 1 skipped | 4 todo**, 160.77s; `tsc` 0 · `biome` 0 · `next build` 0.
