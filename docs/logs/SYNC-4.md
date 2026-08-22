# SYNC-4 · SWEEP — session log

**Task:** SYNC-4 — four stale-doc corrections, then stage PK.
**Ritual:** CC-LIGHT, gated. `ultracode` FORBIDDEN, not used. No subagents invoked.
**Ground:** `origin/main` @ `b05cba511f3e8a81bc351f330f0df84ebd77e232` (#367 squash).

---

## What landed

| Commit | Files | Content |
|---|---|---|
| `5a9bc31` | `docs/specs/SPEC.2.md`, `AGENTS.md`, `docs/plans/SCAFFOLD.17.md`, `docs/parked.md` | S1–S4, the four corrections |
| *(this commit)* | `docs/logs/SYNC-4.md` | this log |

**PR:** opened immediately after this commit; the number is not knowable at log-write time because
§5.9 puts the log before the PR.

---

## The four corrections

### S1 · SPEC.2 §22 — the ADR index rebuilt, `N5` discharged

The index had been four ADRs behind. Fixed as the **normative §22.1/§22.5 rebuild** `N5` had
specified since SYNC-1, not as another running correction.

Four index rows added — **0035** (guarded staging reset, STAGING-PARITY Slice A), **0036**
(Vitest-context operational runners, same), **0037** (onboarding-deck seen-marker cookie, O1-DECK),
**0038** (scale target 100k, SYNC-3). Title, Status and Accepted date for each taken from that
ADR's own header.

⚠ **Every count was RE-MEASURED off the amended table by grepping it. None was computed.**
This is recorded because it is the substance of the fix, not its method:

| Measured | Value |
|---|---|
| Index rows | **37** |
| accepted / superseded / in flight | **34 / 2 / 1** |
| Rows with a real file | **36** |
| Rows `(file pending)` | **1** (ADR-0012) |
| ADR files on disk (`ls docs/adr/`) | **36** |

The last two lines are the point: **the §22.3 cross-reference invariant — that the index match the
files — holds again**, having been broken since ADR-0035 landed. A tally derived by arithmetic
would have asserted the same numbers without establishing that.

**Why the discipline was mandated, in this file's own evidence:** the §0 annotation whose job was
to warn that the count was stale **had itself gone stale twice, once within eleven days, each time
by exactly one**. `N5` went stale by one at the very PR that corrected it. A computed tally drifts;
a measured one does not.

Corrected at every site: §22.1 heading (`33-row` → `37-row`), §22 intro range, the inventory
sentence, the accepted-status split, the numbering range (`0003–0038`), §22.5's SSOT cell, and §0's
**three** mirrors — status banner, companion-files line, *Gates downstream* row. SPEC.2 →
**1.0.23**, Date → **2026-08-20**, with a §0.1 change-log row (this file's change-log is
newest-**last**; the row was appended, matching the live shape).

⚠ **The §0 staleness annotation was struck, not updated.** Its *"folded into NEITHER"* clause was
true until this commit and false after it. An annotation that outlives its condition is the same
defect one layer up, and would mislead a later reader in the opposite direction. What survives is
the standing `O-2` instruction to read `ls docs/adr/` rather than trust the line — which cannot go
stale, because it names no number.

`N5` in `docs/parked.md` marked ✅ **DISCHARGED at SYNC-4** with the measured counts. **The row was
not deleted.**

### S2 · AGENTS.md §3 — two drifts, both re-measured first

**`components/ui/` listed 9 files; there are 13.** ⚠ **The four omitted are not shadcn primitives**
— `empty-block` (P1), `loading-block` (P7), `error-block` (canon §10 `C-STATES-1` rules it NEITHER
P1 NOR P7) and `thumb-glyph` (canon §3 item 13, pinned by component name and props) are
project-authored and canon-ratified. Appending them to a list captioned *"shadcn primitives"* would
have replaced a stale line with a false one, so the entry now states the split and warns against
reaching for a shadcn generator to change one.

**`m/[slug]/error.tsx` was missing from the `(public)/` block.** Confirmed present on `origin/main`,
added in the block's existing style.

### S3 · SCAFFOLD.17 — one plan, two incompatible acceptance predicates

`:239` said `count(*)` **must equal** 50,000; `:117` said **`>= 50000`**. The shipped
`scripts/verify-identity-pool.ts:49` reads `if (rowCount === EXPECTED_TOTAL)` — equality, i.e.
`:239`. `:117` amended to match, with the correction noted inline. **A plan that states its
acceptance two ways cannot fail.**

⚠ **The 50,000 figure itself was NOT corrected** — the identity-pool namespace is a HARDEN task by
founder ruling, and that number moves with it.

### S4 · `docs/parked.md` — an ordering defect, and whose it was

⚠ **This was a web-Claude defect, introduced at #367 in text I applied verbatim.** The
three-paragraph namespace ruling was appended **below** the row's `**Expected next task.**`
paragraph, so `IDENTITY-POOL-NAMESPACE` read *"expected next task…"* and then announced that the
task was something else entirely. Moved to sit immediately **before** `**Conditional trigger.**`.

**Bytes unchanged, position only** — proved, not asserted: the block extracted from `origin/main`
and from the amended file hash identically (`910e025e0d841855d0de46ba5b364b43`), and the file's
line count is unchanged at 2,244. Was `parked.md:890–908`; now `parked.md:881–899`.

---

## S5 · HALTED — the `CLAUDE.md` §5.10 cascade exemption was NOT applied

Its own stop condition: *"HALT AND REPORT this item unless the founder has ratified it in the
message carrying this kickoff."* **The message carries no ratification** — it states the item *"has
been raised four times without a ruling."* Condition satisfied on the kickoff's own evidence.
**`CLAUDE.md` is untouched by this branch.**

This is the **second consecutive session** in which this item arrived unratified and was halted. Its
anchor (`CLAUDE.md`, `### 5.10 Pre-PR self-audit`) was re-verified unique, so a ratified pass costs
one edit. ⚠ The withheld text is a rule against letting a waived reviewer cascade become standing
precedent — applying it without a ruling would be an instance of the thing it forbids.

---

## ⚠ The HARDEN and TESTING findings are deliberately NOT docketed here

**Founder ruling, carried in this kickoff:** *"THIS IS A STALENESS SWEEP, NOT A FINDINGS PASS. The
HARDEN/TESTING findings — A1, A2, the untested invariants — are NOT docketed here. They go through
the normal task ritual."*

**No docket row was written for any defect in this session.** The only `docs/parked.md` movements
were a **discharge** (`N5`) and a **move** (S4) — no new row, no new finding. This is recorded
because the absence is a decision, and an undocumented absence and a ruled one look identical in six
weeks.

---

## Decisions made

1. **`N5` discharged as a normative rebuild**, per its own long-standing instruction.
2. **Counts re-measured, never computed** — and the measurement recorded alongside the result so a
   later reader can tell which it was.
3. **The stale annotation struck rather than updated**, on the ground that a warning outliving its
   condition is itself the defect.
4. **The four non-shadcn `ui/` files distinguished rather than appended**, so the correction does
   not trade a stale caption for a false one.
5. **S5 halted**, unratified.

---

## Open questions

- **The §5.10 cascade exemption** — still unruled after four raisings.
- **ADR-0012** remains the single `(file pending)` index row; the in-flight carve-out (§22.2) still
  holds and design.md finalisation still triggers the v1.0 → v1.1 bump.
- **ADR-0033 stays index-row-only** — its substance is folded into neither spec, a docketed
  follow-up owned by its own task. Untouched here.
- **`SCAFFOLD.17`'s 50,000** — deliberately unmoved; belongs to the HARDEN namespace task.

---

## Next session starts at

**The PK drag.** Staged at `~/Desktop/zz-pk-refresh-SYNC-4/` — 26 files plus `MANIFEST.md`. The
exact next action is **Batch 0 of that manifest: dump all seven CLASS A records to disk and confirm
them on disk, before any purge runs.** CLASS A is the only irreversible step and none of those seven
is on `main`.

---

## Context to preserve

- **The staged `SPEC_2.md`, `AGENTS.md` and `parked.md` are the `main` copies** and therefore do
  **not** carry this branch's corrections. PK takes `main`; they re-stage after this PR merges.
- `~/Desktop/zz-pk-refresh-SYNC-3/` and `…-SYNC-2/` were left untouched.
- ⚠ **A kickoff-internal conflict, resolved and reported:** the SCOPE line says `docs/**` only,
  while **S2 explicitly instructs an edit to `AGENTS.md`**, which is at the repo root. S2 is the
  specific instruction and was followed; the scope line reads as boilerplate aimed at excluding
  `src/`, `tests/` and migrations. Flagged rather than silently absorbed.
- Worktree reused: `/Users/hrishikesh/code/zugzwang/wt-sync3-close`, moved off the merged
  `chore/sync-3-close` after proving its content had landed (`git diff 84df896 origin/main` empty).

---

## Time

Session ran 2026-08-20, roughly 19:10–20:15 IST. Ground `b05cba5`. Two commits on
`chore/sync-4-sweep`, both signed.
