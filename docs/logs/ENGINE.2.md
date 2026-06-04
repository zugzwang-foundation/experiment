# ENGINE.2 — session log

> **Stratum:** ENGINE.2 — CPMM TypeScript module (`src/server/cpmm/`)
> **Entry:** plan session (recon → draft → web review → ratification → docs land). Execute sessions append below.

---

## Plan session — 2026-06-04

**What landed.**
- `docs/plans/ENGINE.2.md` — the founder-ratified implementation plan — via **PR #73**, squash-merged to `main` at **`d6af030`** (`docs(plans): ENGINE.2 — CPMM module implementation plan (founder-ratified) (#73)`).
- No `src/` and no schema/migration changes — this session was plan-only. Plan-chat branch `docs/engine-2-plan` merged and deleted; this log ships on `chore/engine-2-log`.

**Decisions made.**
- **OQ-A** — decimal.js pinned **literal `10.6.0`** (not the kickoff's `^10.6.0`): vendor-dep literal-pin discipline + cpmm.md §10.4 determinism (exact reproducibility of money math); literal sits within the spec's `^10.6` line, so no `cpmm.md` contradiction.
- **OQ-B** — **tests-first** via `@test-writer` (RED → implement → GREEN), per CLAUDE.md §5.6; reorders the kickoff's implement-first checklist.
- **OQ-C** — every module output rendered uniform **`Decimal.toFixed(18)`** (resolves §12 shorthand vs §10.3 "exactly 18 dp").
- **OQ-D** — attribution header **uniform on all four files** (directive E; makes the pre-PR grep binary).
- **OQ-E** — doc-drift riders ride the **execute** PR (CLAUDE.md §7 same-PR ritual): CLAUDE.md §2 "no decimal library yet" + §1 critical-path add (`src/server/cpmm/`) **and** AGENTS.md §1 "Not installed yet: decimal library" (caught addition — directive M2 named only CLAUDE.md).
- **Web-review amendments A1–A6** applied to the plan: A1 price recipe = exact-then-quantize is the pin (E1–E5 don't lock it); A2 tracker version-neutral ("operator tracker, v12 at plan time"); A3 execute-PR diff-stat enumerated; A4 E4 no-dust smoke vector added; A5 ADR-0008 §8 patch-record **deferred to SYNC.BACKFILL**; A6 status → reviewed.
- Module shape pinned: 4 direct files (`decimal` / `errors` / `validate` / `calculate`), no barrel; `numericString` imported from `@/server/events/schemas` (never redefined); `CpmmInputError` module-local (outside the §15 catalogue); pure — no clock/env/random/DB/I-O.

**Open questions.** None — all five (OQ-A…E) founder-ratified 2026-06-04; ADR-0008 patch-record deferral resolved (→ SYNC.BACKFILL).

**Next session starts at.** Execute chat: branch `feat/engine-2-cpmm-module` off `main` (`d6af030`+); **step 1 = read the merged plan back in full + `cpmm.md` §10 (arithmetic/rounding) and §13 (module API) verbatim**, then run the plan's execute checklist (`pnpm add "decimal.js@10.6.0"` → `@test-writer` smoke tests RED → `decimal/errors/validate/calculate` → `@code-reviewer` → `@security-auditor` → pre-PR §5.10 audit). Pass `@docs/plans/ENGINE.2.md` to both subagents.

**Context to preserve.**
- **Delimiter-leak guard:** Write-tool-authored files can carry stray `</content>`/`</invoke>` tokens in their trailing bytes — `tail` + `grep -n '</content>\|</invoke>\|</parameter>'` before any commit/cp. (Caught and fixed on the plan doc before #73.)
- **Casing boundary:** the module's `Side` is lowercase `"yes" | "no"` per cpmm.md §13; the system `side` pgEnum / event payloads are uppercase `"YES" | "NO"`. Case translation is **ENGINE.7 glue**, not the cpmm module's job.
- **Reserves derive from the FLOORED `s_r`/`M_r`** (not the exact value) — this is what makes `k′ ≥ k` and the residual identity exact; prices are computed from precision-50 exact quantities then quantized.
- Reference fork clone is **optional** — cpmm.md's closed forms are canonical and self-contained (upstream is float+EPSILON+binary-search, deliberately not mirrored).

**Time.** 2026-06-04 — single plan-chat session (opening recon → plan draft + 5 open questions → web "APPROVED WITH AMENDMENTS" → 6 amendments applied → docs-only PR #73 → squash-merge → this log).
