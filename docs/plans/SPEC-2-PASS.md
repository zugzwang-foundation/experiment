# SPEC-2-PASS — plan and change ledger · SPEC.2 → 2.0.0

**Plan version:** 1.0 (2026-09-07).
**Status:** Founder delegated the technical decisions to web Claude on 2026-09-07 ("you are the CTO — go for the whole SPEC.2 amends"). D-30 is the ruling this plan carries; the founder ratifies D-30 and the merge, not each edit.
**Anchor base:** `docs/specs/SPEC.2.md` blob `c54cd0a36684c148b8cb154add4a03aca9f9684f` · 2,945 lines · declared 1.0.27 · last touched 2026-09-02.
Cross-checked against `docs/specs/SPEC.1.md` blob `d0d500716681f2d0374b0c4fe119388b792c26db` (2.0.0, 1,285 lines, merged at `0bf84b05`).
**Every line anchor below was located in the blob above and its quoted fragment confirmed on its stated line.**
**Precedence:** decision record → SPEC.1 → SPEC.2 → ADRs → tracker (D-22).
**Carries:** D-20, D-21/D-26, D-22, D-24, D-28 (rows 7, 12, 15, 16, 17, 18, 21), D-29, D-30; ADR-0046. It invents nothing.
**Roles:** web Claude authored; founder ratified; Claude Code executes; a fresh-session reviewer reads the diff; web Claude and the founder read the diff; founder merges.

---

## 0 · Execution contract

### 0.1 Preconditions (measured, then proceed or HALT)
1. `pwd` is a worktree on branch `docs/spec-2-pass`, cut from `origin/main`; `git status --porcelain` empty.
2. `git hash-object docs/specs/SPEC.2.md` → `c54cd0a36684c148b8cb154add4a03aca9f9684f`. **Any other value → HALT** — the anchors are invalid and the plan must be re-measured.
3. `git hash-object docs/specs/SPEC.1.md` → `d0d500716681f2d0374b0c4fe119388b792c26db`. A different value means SPEC.1 moved after 2.0.0; report it and continue only if `grep -nE '^## §' docs/specs/SPEC.1.md` still yields §0–§16 and §20 with no §17–§19 or §21–§23.
4. `git log --oneline -1 -- docs/plans/SPEC-2-PASS.md` shows this plan committed on this branch.
5. `docs/decisions/RECORD-v2.6-amendment.md` exists on this branch.
6. `git log -1 --format=%h -- docs/specs/SPEC.2.md` → record. This is the **last 1.0.x commit**, substituted for `<LAST-1.0.x-SHA>` in T-00 and T-CL. Do not invent it.

### 0.2 Order of operations
- **Bottom-up.** Apply §2 then §3 from the highest line number to the lowest. Before every range operation, `sed -n '<first>p;<last>p'` and confirm both boundary lines match the text quoted here. Mismatch → HALT and report the lines seen.
- **Verbatim.** Every block in §4 is applied character-for-character. A restatement in your own words has changed the spec.
- **Rules** in §5 are applied by the stated rule; every before/after pair is listed in the run report. A site the rule does not fit is **reported, not improvised**.
- **ONE commit**, `docs/specs/SPEC.2.md` only. Author `Zugzwang/world <zugzwangworld@proton.me>`; SSH-signed; no `Co-authored-by`.
- Then §6 post-checks, all of them. Then push, then `gh pr create --draft`. **Do not merge. Do not mark ready.**

### 0.3 Not in scope (do not touch)
`src/`, `tests/`, `drizzle/` (MOD-1 owns the code) · `docs/specs/SPEC.1.md` · `CLAUDE.md`, `AGENTS.md` · `docs/adr/*` (the ADR pass follows) · `docs/specs/flows/*` · `docs/runbooks/*` · the eight market specs · `docs/decisions/README.md` beyond the one index row in Relay A · SPEC.2 §14's four invariants (D-23: carried verbatim, and this pass carries them by *not touching them*).

### 0.4 Report
Write incrementally to `~/Downloads/zz_SPEC-2-PASS_execute_<YYYY-MM-DDTHHMM>.md`: preconditions incl. the §0.1.6 sha → each range op with its boundary check → each line edit → each §5 rule application with before/after → the §6 post-check table → `wc -l`, `git hash-object`, commit sha, PR URL. Inline reply is the ≤10-line headline.

---

## 1 · D-30 — decision record amendment 2.6 (new file, verbatim)

Path: `docs/decisions/RECORD-v2.6-amendment.md`

```
# DECISION RECORD — amendment 2.6

**Amends** `RECORD-v2.0.md` · follows 2.1, 2.2, 2.3, 2.4, 2.5 · **Opened** 2026-09-07
**Ruling** D-30

---

## D-30 · `SPEC.2` is rebaselined at 2.0.0, and D-23's rebuild is narrowed to the defective sections

**Narrows** D-23 (2026-09-04) for `SPEC.2`. D-29 already narrowed it for `SPEC.1`.

**Why.** D-23 ruled a rebuild from an estimate — *"nine defects, a stale index, and five `MUST`
clauses."* The `SPEC-2-RECON-0` measurement (2026-09-06) puts the count at 87 and shows them
**concentrated**: §10, §13, §0 and §12 carry 51% of them in 12.7% of the file, nine of 26 sections
carry none, and the two kinds do not overlap — the gate assertions sit in §10 and §12, the broken
citations in §13, §0 and §3. A whole-document rebuild would rewrite 2,945 lines to repair 87
defects, and would put §14's four invariants — which D-23 requires carried verbatim — through an
unnecessary rewrite.

**Ruling.**
- **Section-level rebuild:** §10 (renamed *Moderation Contract*) and §12's moderation-coupled
  clauses. These state the superseded pre-commit gate; the posture is wrong, not the wording.
- **Repair in place:** §0, §3, §4, §5, §8, §11, §13, §15, §17, §18, §19, Appendix B.
- **Reduced to a pointer:** §21, §22, Appendix A. Each is a list the repository already holds and
  each has gone stale — §22 declares 38 ADRs against 44 on disk and a ceiling of 0039 against
  0046; Appendix A declares 26; §21 names twenty runbooks of which nineteen do not exist. This
  discharges D-28 r12 (*"the twenty are struck; `docs/runbooks/` is kept whole"*), r16, r17 and,
  by removing the index that keeps going stale rather than reformatting it, r18.
- **Removed:** §2 (Architectural Blockers Register — a historical register) and §23 (Tracker Task
  Gating Map — the tracker is last on the D-22 ladder and is operator-maintained). No ruling names
  either.
- **Untouched:** §1, §6, §7, §9, §14, §16, §20. §14 carries INV-1…INV-4 verbatim, per D-23.
- **Kept deliberately:** Appendix B. It carries no `MUST` line, but it decides which columns about
  real participants are published on 2026-11-06. That is a privacy contract, not a catalogue.
- Change log reset; the `v0.1-outline`–`1.0.27` line stays in git history. Version 2.0.0. Section
  numbers are retained with gaps so cross-references elsewhere stay resolvable.

**Consequences.** D-28 r12/r15/r16/r17/r18 are discharged at this pass. D-24's launch date, absent
from `SPEC.2` entirely, is stated. Moderation code conformance remains `MOD-1`, pending: the spec
leads the code until it lands and the 2.0.0 change-log row says so. The `SPEC.1` §16 preamble
residue (`SPEC.1:1155`) and the superseded ladders in `docs/decisions/README.md` and
`docs/STATE.md` are a separate hygiene commit, not this one.

**Enforced at** `SPEC.2` §0 and its change log.

---

*End amendment 2.6.*
```

Relay A also appends one row to the amendment index in `docs/decisions/README.md`, in the exact format of the existing rows (measure with `grep -n '2.5' docs/decisions/README.md` first), and moves the 2.5 row's *superseded/followed* cell exactly as the 2.5 commit moved 2.4's. Content: amendment 2.6 · 2026-09-07 · D-30 · "`SPEC.2` rebaselined at 2.0.0".

---

## 2 · Structural operations (ranges verified at blob `c54cd0a3`; apply bottom-up)

Each range ends **before** the `---` + blank that separates it from the next section, except where stated. That separator survives and is the check that the operation landed correctly.

| Op | Range | First line must read | Last line must read | Action |
|---|---|---|---|---|
| S-01 | 2467–2653 | `## Appendix A — Single-Source-of-Truth File Map (consolidated)` | the final content line before the `---` at 2654 | replace with **T-APPA**. 2654 (`---`) and 2655 (blank) stay |
| S-02 | 2367–2466 | `## §23 Tracker Task Gating Map` | the blank line at 2466 | **delete.** 2365 (`---`) and 2366 (blank) become the separator before Appendix A |
| S-03 | 2267–2364 | `## §22 ADR Index` | the final content line before the `---` at 2365 | replace with **T-22**. 2365/2366 stay |
| S-04 | 2197–2264 | `## §21 Operational Runbook Pointers` | the final content line before the `---` at 2265 | replace with **T-21**. 2265/2266 stay |
| S-05 | 1141–1180 | `## §10 Pre-Commit Moderation Contract` | `ADR-0014 holds the full decision body, eight ratified primitives, seven considered options with verdicts, and the closing italic summary. SPEC.2 §10 is the cross-reference; ADR-0014 is the canonical text.` | replace with **T-10**. 1181 (`---`) and 1182 (blank) stay |
| S-06 | 157–222 | `## §2 Architectural Blockers Register` | the blank line at 222 | **delete.** 155 (`---`) and 156 (blank) become the separator before §3 |
| S-07 | 9–80 | `## §0 Document Metadata` | the last change-log table row | replace with **T-00**. Confirm line 81 reads `## §1 …` before and after |
| S-08 | 3–5 | `> **Status:** version is in the §0 table below …` | `> **Companion files:** …` | replace with **T-FM** |

---

## 3 · Line-level ledger (apply bottom-up; confirm the fragment on its stated line first)

Sites inside S-01…S-08's ranges are **not** listed here — the range operation carries them.

| L# | Line | Fragment | Edit | Ruled by |
|---|---:|---|---|---|
| L-01 | 2820 | `` `'system'` for all gate auto-actions `` | → `` `'system'` for every classifier-written row `` | D-20 |
| L-02 | 2818 | `The rejected comment body for a gate-block (no comment row exists)` | replace the whole cell's description with **T-B18** | D-20 |
| L-03 | 2815 | `` `track_a_autoban` / `track_b_blocked` / `sexual_minors_text_blocked` (gate auto-actions) `` | → `` `track_a_auto_ban` / `track_b_flagged` / `sexual_minors_text_flagged` / `image_rejected` / `image_screening_failed` (classifier-written); `content_removed` / `user_banned` (admin-written) `` | SPEC.1 §14 |
| L-04 | 2814 | `the market a gate-block submit targeted` | → `the market the flagged submission targeted` | D-20 |
| L-05 | 2169 | Devcon / archive-boundary claim | apply **RULE-3** | D-21/D-26 |
| L-06 | 2159 | `dominated by the pre-commit moderation budget` | → `dominated by the in-flight bet transaction` | D-20 |
| L-07 | 2140 | Devcon / archive-boundary claim | apply **RULE-3** | D-21/D-26 |
| L-08 | 2040 | `` `moderation.blocked` \| `payload.userId` `` | → `` `moderation.flagged` `` (same row, same cell shape) | D-20 |
| L-09 | 1941 | Devcon / archive-boundary claim | apply **RULE-3** | D-21/D-26 |
| L-10 | 1802 | `SPEC.1 §16.3 seven (its lock comment requires a SPEC.1 amendment + a same-commit …)` | apply **RULE-1**; if the clause is an *obligation* against §16.3 rather than a pointer, strike the obligation and keep the observability requirement | D-29 |
| L-11 | 1792 | `asymmetric to §10 (pre-commit moderation fails closed)` | → `asymmetric to §10 (moderation is advisory and never fails a request)` | D-20 |
| L-12 | 1762 | `` `headObject` failure (the pre-moderation verify-object HEAD per ADR-0028 `` | → `the pre-serve verify-object HEAD per ADR-0028` | D-20 |
| L-13 | 1745 | `Both fail closed to `ModerationUnavailableError`; the captures are fail-open side-effects` | replace with **T-17A** | D-20 |
| L-14 | 1646 | Direction A — *"every error_code … MUST exist in `docs/specs/error-codes.md`"* | replace with **T-15A** | D-28 r15 |
| L-15 | 1625 | `` ADR-0014 (pre-commit moderation) \| 4 \| `error_moderation_unavailable`, `error_moderation_in_flight`, `…track_a`, `…track_b` `` | replace the row with **T-15B** | D-20 |
| L-16 | 1618 | `The standalone catalogue file `docs/specs/error-codes.md` is a **named forward deliverable** …` | replace that sentence and the `§15.5 lint` clause with **T-15C** | D-28 r15 |
| L-17 | 1557 | `ADR-0014 (pre-commit moderation outside the transaction backing INV-1…` | append ` — superseded by ADR-0046; moderation is not in the transaction at all` | ADR-0046 |
| L-18 | 1508 | `(iii) §10 pre-commit moderation runs OUTSIDE the transaction` | → `(iii) §10 moderation is dispatched after the transaction commits and never gates it` | D-20 |
| L-19 | 1494 | `ADR-0014 (pre-commit moderation cited by every comment-bearing-bet System block…` | append ` — superseded by ADR-0046` | ADR-0046 |
| L-20 | 1491 | `` \| Cross-reference CI lint (Errors → catalogue + Acceptance → §17) \| HARDEN.* \| `` | → `` \| Cross-reference CI lint (Errors → §15.4) \| HARDEN.* \| `` | D-28 r15, D-29 |
| L-21 | 1490 | `` \| Acceptance-test catalogue (consumed by every Acceptance block) \| SPEC.1 §17 \| `` | → `` \| Acceptance test paths (cited by every Acceptance block) \| `tests/` \| `` | D-29 |
| L-22 | 1487 | `` `docs/specs/flows/F-*.md` (37 files; per gating task cadence) `` | append `. 36 of the 37 are SCAFFOLD.2 skeletons at this writing; only `F-DEBATE-4.md` carries content` | recon R5.c |
| L-23 | 1476 | *"every row in SPEC.1 §17's catalogue SHOULD appear in at least one F-*.md file's Acceptance block"* — whole paragraph | **delete the paragraph** | D-29 |
| L-24 | 1474 | *"§17 alignment. Every name in any Acceptance block MUST appear verbatim in SPEC.1 §17's acceptance-test catalogue …"* — whole paragraph | replace with **T-13B** | D-29 |
| L-25 | 1472 | `### §13.5 §17 acceptance-test alignment + §23 bidirectional trace` | → `### §13.5 Acceptance-path alignment + §23 bidirectional trace` ⟨COND⟩ — if §23 has been deleted by S-02, also drop ` + §23 bidirectional trace` and report | D-29, D-30 |
| L-26 | 1470 | `Exception: skeleton files at SCAFFOLD.2. SCAFFOLD.2 mints empty F-*.md files … for all 37 flows` | append ` This is the state on disk: 36 of 37 files carry six `<placeholder>` markers and no content.` | recon R5.c |
| L-27 | 1449 | `F-MOD-5 (manual moderation queue review)` | → `F-MOD-5 (user banned mid-session)` — align to SPEC.1 §14's F-MOD-5 | SPEC.1 §14 |
| L-28 | 1397 | *"Acceptance — named integration tests from SPEC.1 §17's catalogue … MUST appear verbatim in SPEC.1 §17 …"* | replace with **T-13C** | D-29 |
| L-29 | 1393 | *"…a stable error_code from `docs/specs/error-codes.md`. **Cross-reference invariant: every error_code listed here MUST exist in the codes catalogue.**"* | replace with **T-13D** | D-28 r15 |
| L-30 | 1381 | *"(2) every error_code … MUST exist in `docs/specs/error-codes.md` …; (3) every name in any Acceptance block MUST appear verbatim in SPEC.1 §17 …"* | replace the whole sentence with **T-13A** | D-28 r15, D-29 |
| L-31 | 1283 | `the bytes §10 moderation reads are — by construction — the bytes render serves; this closes the AUDIT.1 A1 swap-after-approval CSAM window at the storage layer (SPEC.1 §16.5)` | → `the bytes §10 screening reads are — by construction — the bytes render serves; this closes the AUDIT.1 A1 swap-after-screening CSAM window at the storage layer (SPEC.1 §14)` | D-20, D-29 |
| L-32 | 1283 | `The pre-moderation `HeadObject` (`verifyUploadedObject`)` | → `` The pre-serve `HeadObject` (`verifyUploadedObject`) `` | D-20 |
| L-33 | 1279 | `the byte-size cap is enforced **pre-moderation** via a wired `HeadObject` verify` | → `` the byte-size cap is enforced **before screening** via a wired `HeadObject` verify `` | D-20 |
| L-34 | 1279 | `before the bet transaction opens (ADR-0028; closes AUDIT.1 A10)` | → `before the image is attached (ADR-0028; closes AUDIT.1 A10)` | D-20 |
| L-35 | 1271 | whole paragraph beginning `The R2 object exists from step 3 onward regardless of step-6 outcome.` | replace with **T-12C** | D-20, ADR-0046 |
| L-36 | 1266 | whole numbered item 5 | replace with **T-12B** | D-20, ADR-0046 |
| L-37 | 1260 | `The R2 object exists from step 3 onward regardless of moderation outcome; the DB-side `image_uploads` row tracks commit vs orphan vs blocked.` | → `` The R2 object exists from step 3 onward regardless of the screening outcome; the `image_uploads` row tracks committed, orphaned, and dropped. `` | D-20 |
| L-38 | 1248 | `Per-upload signed-PUT mint, moderation-gated commit, orphan sweep eligible` | → `Per-upload signed-PUT mint, screened before first serve, orphan sweep eligible` | D-20 |
| L-39 | 1239 | `the F-COMMENT-3 image-attached-comment six-step orchestration that integrates with §10 pre-commit moderation + §11 idempotency + §3.5 orphan sweep` | → `the F-COMMENT-3 image-attached-comment orchestration that integrates with §10 moderation + §11 idempotency + §3.5 orphan sweep` | D-20 |
| L-40 | 1223 | `Pre-commit moderation also fails CLOSED (per §10 / ADR-0014)` and its `SPEC.1 §16.5` citations | replace the clause with **T-11A** | D-20, D-29 |
| L-41 | 1217 | `5. Pre-commit moderation (per §10 / ADR-0014 — every comment-bearing bet…` | → `5. Moderation dispatch (per §10 — after the transaction commits, off the request path)` | D-20 |
| L-42 | 1131 | `the FIRST authenticated step in every bet handler — before pre-commit moderation` | → `the FIRST authenticated step in every bet handler` | D-20 |
| L-43 | 975 | `Turnstile fail-mode is fail-closed … mirrors §10 / §11 idempotency / moderation fail-closed posture` | → `Turnstile fail-mode is fail-closed, mirroring §11 idempotency. It does **not** mirror §10 — moderation is advisory and fails neither way (ADR-0046)` | D-20 |
| L-44 | 643 | `(Track A / Track B content never reaches `comments`; it is blocked at the gate per ADR-0021…` | replace the parenthetical with **T-05A** | D-20, ADR-0046 |
| L-45 | 526 | `` `mod_actions` … Moderation audit trail; pre-commit verdict + image-upload linkage `` | → `` `mod_actions` … Moderation audit trail; classifier verdicts, admin actions, and image-upload linkage `` | D-20 |
| L-46 | 492 | Devcon / archive-boundary claim | apply **RULE-3** | D-21/D-26 |
| L-47 | 450 | `not moderated on upload (the moderation pipeline gates untrusted user-generated content…` | replace the parenthetical with **T-04A** | D-20 |
| L-48 | 370 | `ADR-0014 (pre-commit moderation), ADR-0015 (rate-limit + idempotency)…` | apply **RULE-2** | ADR-0046 |
| L-49 | 247 | `…can never be re-moderated into a bogus rejection. The pre-check fails **open**` | → `…is never re-moderated. The pre-check fails **open**` | D-20 |
| L-50 | 245 | `rate-limit fails open (step 4); idempotency fails closed (step 3); pre-commit moderation fails closed (step 5)` | → `rate-limit fails open (step 4); idempotency fails closed (step 3); moderation fails neither way — it is dispatched after commit and no participant outcome depends on it (step 5)` | D-20 |
| L-51 | 238 | `5. Pre-commit moderation — per §10 / ADR-0014 (every comment-bearing bet; …` | → `5. Moderation dispatch — per §10 (every comment-bearing bet; after the transaction commits)` | D-20 |
| L-52 | 105 | `The pre-commit moderation pattern — moderation outside the transaction, Redis intent-reservation…` | replace the clause with **T-01A** | D-20 |
| L-53 | 129 | reference to `design.md` as a companion spec | strike the file reference; keep the sentence's subject | D-28 r17 |

---

## 4 · Text blocks (verbatim)

### T-FM — front matter (replaces lines 3–5)
```
> **Status:** version is in the §0 table below and in the last changelog row; this line deliberately carries no number (`O-15`) · §0–§20 + Appendix B · §2, §23 and Appendix A removed at 2.0.0 (D-30); numbering retained with gaps for cross-reference stability
> **Repo path:** `zugzwang-foundation/experiment/docs/specs/SPEC.2.md`
> **Companion files:** `SPEC.1.md` (product), `cpmm.md` (math), `RANKING.md` (ranking function) — all three on disk at `docs/specs/`. `PSEUDONYM.md` and `design.md` were promised and are deleted as promises (D-28 r16, r17); no file replaces them.
```

### T-00 — §0 (replaces lines 9–80)
`<LAST-1.0.x-SHA>` is substituted from §0.1.6.
```
## §0 Document Metadata

| Field | Value |
|---|---|
| **Document** | SPEC.2 — Zugzwang Technical Architecture |
| **Version** | 2.0.0 |
| **Date** | 2026-09-07 |
| **Owner** | Hrishikesh Manoj Hundekari |
| **Phase** | Experiment phase only. Markets open 2026-09-15; the freeze is 2026-11-05 23:59 UTC; the dataset is released 2026-11-06. Out of scope: testnet, mainnet, on-chain |
| **Status** | Rebaselined at 2.0.0 by D-30 (decision record amendment 2.6, 2026-09-07). §10 rebuilt as the *Moderation Contract*; §12's moderation clauses rebuilt; §21, §22 and Appendix A reduced to pointers; §2 and §23 removed. The `v0.1-outline`–`1.0.27` line and its change log are retained in git history; last 1.0.x commit `<LAST-1.0.x-SHA>` |
| **Sections** | §0, §1, §3–§20, Appendix B. §2, §21 (pointer), §22 (pointer), §23 and Appendix A (pointer) — see the change log. Numbering is retained with gaps so cross-references stay resolvable |
| **Source-of-truth** | `zugzwang-foundation/experiment` repo. Project knowledge is a snapshot, not the canonical copy |
| **Precedence** | Decision record → `SPEC.1` → `SPEC.2` → ADRs → tracker (D-22). `SPEC.1` outranks this document; ADRs do not |
| **ADRs** | `docs/adr/` is the index. This document names ADRs where they bind a contract and counts none |
| **Companion paper** | `zugzwang_btc_style_v4.pdf` — theory and the Zugzwang Condition. SPEC.2 implements; the paper does not bind on engineering choices |
| **License** | AGPL-3.0 (see `LICENSE.md`) |

### §0.1 Change log

*Reset at 2.0.0 (D-30). The `v0.1-outline`–`1.0.27` log is in git history; last 1.0.x commit `<LAST-1.0.x-SHA>`.*

| Version | Date | Author | Change |
|---|---|---|---|
| 2.0.0 | 2026-09-07 | HMH | Rebaselined. **§10 rebuilt as the Moderation Contract** — advisory throughout: text is dispatched after commit and never awaited, images are screened before first serve, no request fails on a moderation outcome, the Redis intent reservation and the 409/503 branches are retired (D-20, ADR-0046). §12's moderation-coupled clauses rebuilt to match. 49 dangling `SPEC.1` citations repaired against SPEC.1 2.0.0 and seven broken `MUST` obligations discharged (D-29). `error-codes.md`'s five `MUST` clauses removed; §15.4 is the catalogue (D-28 r15). §21, §22 and Appendix A reduced to pointers; §2 and §23 removed (D-30, D-28 r12/r16/r17/r18). Devcon struck (D-21/D-26); the launch date stated (D-24). Reason codes aligned to SPEC.1 §14. **Code conformance for moderation: MOD-1, pending** — until it lands, `src/` implements the superseded gate | D-20, D-21/D-26, D-22, D-24, D-28, D-29, D-30; ADR-0046 |
```

### T-10 — §10 (replaces lines 1141–1180)
```
## §10 Moderation Contract

> **[Rebuilt at 2.0.0 per D-30. ADR-0046 (2026-09-06) supersedes ADR-0014's pre-commit gate architecture: moderation is advisory. ADR-0021's reactive-review consequence stands. The vendor, the category routing, the multimodal call shape, the write-once binding and the `no-transaction-across-an-HTTP-call` refusal are unchanged. `src/server/moderation/` still implements the superseded gate; MOD-1 is the conformance task.]**

**Moderation is advisory. No post is ever blocked, no submission ever fails, no participant ever waits** (ADR-0046; D-20; SPEC.1 §14). The invariant, stated once and identically to SPEC.1 §14: *a post is never blocked by moderation, and an image is never served before it has been screened.* Both halves hold because the screening window is the composing window — an image is attached before the mandatory argument is written, so the check runs while the participant types and gates nothing.

Moderation runs on every comment-bearing bet: F-BET-1, F-BET-2, F-COMMENT-1, F-COMMENT-2, F-COMMENT-3. The comment-free sell (F-BET-3) carries no text and is not moderated. The flow is exposed as a single function in `src/server/moderation/precommit.ts` (name retained until MOD-1 renames it).

**Vendor selection.** OpenAI `omni-moderation-latest`, snapshot-pinned `omni-moderation-2024-09-26`, for text and multimodal classification — the **sole** moderation vendor for the experiment phase, free of charge per OpenAI's Help Center as of May 2026. No second image classifier ships in the experiment phase. The snapshot covers `violence` (including `violence/graphic`), `self-harm` (including `/intent` and `/instructions`) and `sexual` (non-minors) on image inputs natively. The `harassment`, `harassment/threatening`, `hate`, `hate/threatening`, `illicit`, `illicit/violent` and `sexual/minors` categories accept **text inputs only** on that snapshot. The six non-CSAM text-only categories are an accepted v1 image-input gap — a model limitation, not a design choice — mitigated by the admin's reactive removal on live content (SPEC.1 §15 F-ADMIN-4). `weapons` is not an OpenAI category at all; weapon-policy content relies on F-ADMIN-4 end to end. **PhotoDNA, Safer and Hive are parked** (`docs/parked.md`).

**Category routing.** SPEC.1 Appendix A is the per-category routing table and this section does not restate it. Two routings are load-bearing at the architecture layer because they are realised by predicate rather than by lookup:

- **LD-3 carve-out.** `sexual/minors === true` with no attached image routes to Track B: the text **publishes** and is flagged `sexual_minors_text_flagged` for the admin's reactive review, with no auto-ban. The category's false-positive rate on news, fiction and educational vectors is elevated, and the model scores it on text only. With an attached image the same flag routes to Track A.
- **A2 image-adult-sexual escalation.** Adult `sexual === true` on an **image-attached** submit routes to Track A. This is the live CSAM-image backstop while PhotoDNA is parked: the snapshot scores image-borne CSAM as adult `sexual`, because `sexual/minors` is text-only. Realised in `precommit.ts` via the omni `sexual` category plus `imageR2Key` presence. Adult-sexual **text** stays Track B. **This predicate is the only mechanism in the product that catches image-borne CSAM. It is not an optimisation and it is not removable while PhotoDNA is parked.**

**Server Action sequence (mandatory order).**

1. **Auth gate** at the Server Action boundary (ADR-0004).
2. **Idempotency cache lookup** as the first authenticated work (ADR-0013 §3; user-scoped per ADR-0044). On hit, return the cached `(status, body)` verbatim; no transaction, no moderation.
3. **Open the §9 W-1 bet transaction** (ADR-0013) and insert the paired `bets` + `comments` rows atomically. **No moderation input reaches this step.** INV-1 holds trivially: the transaction is never conditional on a verdict, so there is no partial state a verdict could leave behind.
4. **After commit, dispatch moderation off the request path.** The response to the participant does not wait for it. A verdict that lands later writes a `mod_actions` row and marks the item in the admin's review feed (SPEC.1 §15 F-ADMIN-4); it changes nothing the participant sees.

There is no intent reservation and no `409 moderation_in_flight`. Both existed to serialise concurrent submits against a blocking gate; with moderation downstream of the commit there is nothing to serialise, and duplicate submits are already handled by §11's user-scoped idempotency.

**Images — screened before first serve.** An attached image is uploaded to the private participant prefix (§12.2) and screening fires **at attach**, not at submit. The composer stays interactive throughout. At submit: a clean verdict publishes with the post; a verdict still pending publishes the post and attaches the image when it clears; a rejected or failed screening drops the image, publishes the post without it, and tells the participant which image and why. **No public read URL is minted for an object that has not been screened** — this is the §12.3 write-once binding doing its work, and it is the one place the request path is ordered by a verdict. Byte-identical re-uploads reuse the cached verdict (ADR-0028).

**OpenAI HTTP call shape.** `POST https://api.openai.com/v1/moderations`, model `omni-moderation-2024-09-26`. Multimodal input array on image-attached submits (text + `image_url` with a 60-second signed R2 read URL, §12.4). 3-second timeout per attempt. **One retry** on transient failure (network error, timeout, 5xx, 429). **No retry** on 4xx auth errors (401/403), which fire `openai_moderation_auth_failure` as a separate Sentry event (§17 alarm 4).

**Failure mode: it fails neither way.** A terminal failure of the OpenAI call — after retry, on timeout, on a non-200, or on a `flagged:true` verdict that maps to no known category (snapshot drift) — emits the Sentry event, writes an audit row recording the failure, and **changes nothing a participant sees**. There is no `503 moderation_unavailable` and no `error_moderation_unavailable` code. This is deliberately asymmetric to §11's idempotency-fails-closed and to §8's Turnstile-fails-closed: those decide whether a write is legitimate, and moderation does not. The image path is the exception and states its own rule above — a screening failure drops the image; it does not block the post.

**Moderated-object immutability (ADR-0028).** The bytes screening classifies are immutable between screening and render: the participant upload uses a write-once conditional PUT (`If-None-Match: *`, §12.3), so the object cannot be swapped after it clears. This is the precondition that makes the verdict binding on the bytes render later serves. A `HeadObject` verify runs before screening, outside any transaction, and fails the *attach* on oversize, missing object, or R2 unavailability (§12.2 step 5 / §12.3). It does not fail the post.

**No Postgres transaction is held across an HTTP call** (`REFUSAL:` per CLAUDE.md golden rules, §9, ADR-0013 §8). Under this contract the point is stronger than before: the OpenAI call is not merely outside the transaction, it is after it. The bet wrapper from ADR-0013 stays moderation-unaware.

**Events emit.** A verdict that flags writes one `mod_actions` row and emits exactly one `events` row of `event_type = 'moderation.flagged'` in the same standalone transaction — satisfying §3.7's ≥1-event-per-state-mutation rule and §7.5's F-MOD-* write set. `aggregate_type = 'mod_action'`, `aggregate_id = mod_actions.id`. Payload `{ userId, reason, uploadId }`; the raw `imageR2Key` is deliberately excluded because it embeds the userId. `metadata.flow_id = 'F-MOD-1'` for Track A, `'F-MOD-2'` for Track B. `metadata.user_id = actor_id = <submitting user>` per §3.7's binary actor convention; `mod_actions.actor_id` remains `'system'`, which is a different question and does not conflict. `metadata.request_id`/`ip`/`user_agent` are `'unknown'` and `idempotency_key` is `null` at this seam (the established `logout.ts` / `tos-accept.ts` placeholder pattern; `ip` and `user_agent` are STRIP_KEY at export per §19.4 regardless).

**Reason codes** are SPEC.1 §14's, and SPEC.1 is the source: `track_a_auto_ban` · `track_b_flagged` · `sexual_minors_text_flagged` · `image_rejected` · `image_screening_failed` · `content_removed` · `user_banned`. The shipped enum still carries the superseded `track_a_autoban` / `track_b_blocked` / `sexual_minors_text_blocked`; the rename lands at MOD-1 with the migration.

**No automated reporting.** The CSAM auto-report mechanism is scrapped (D-28 r7). Detection is unchanged and unweakened; the admin holds full manual control over removal, ban and any report they choose to make.

**Single source of truth.** `src/server/moderation/precommit.ts` owns the function, the verdict shape, the OpenAI call orchestration, the Sentry emission and the constants (`OPENAI_MODERATION_MODEL_SNAPSHOT`, `OPENAI_TIMEOUT_MS`, `OPENAI_MAX_RETRIES`). `src/server/moderation/openai.ts` holds the HTTP wrapper. `RESERVATION_KEY_PREFIX` and `RESERVATION_TTL_SECONDS` are retired with the reservation.

**Conformance.** ADR-0046 holds the ruling; SPEC.1 §14 holds the product contract; this section holds the architecture. **`src/` implements none of it yet** — it awaits the moderation call, throws on a flag, and fails closed on a provider failure. MOD-1 is the conformance task and until it lands this section leads the code, which is the correct interim state and is recorded here rather than left silent.
```

### T-12B — §12.5 step 5 (replaces line 1266)
```
5. **Pre-serve object verify (ADR-0028):** before screening runs, `verifyUploadedObject` issues one `HeadObject` on the uploaded key — failing the *attach* on oversize (`error_image_oversize`), missing object (`error_storage_object_missing`) or R2 unavailability (`error_storage_unavailable`) — and captures the ETag and real byte size for the `image_upload.committed` event. A failed verify drops the image; it does not block the post. **Screening then calls the §10 moderation function with a multimodal input array** (text + `image_url` with a 60-second signed R2 read URL minted at §12.4), OpenAI `omni-moderation-2024-09-26`. The bet transaction is not conditional on either result.
```

### T-12C — §12.5 (replaces the paragraph at line 1271)
```
The R2 object exists from step 3 onward regardless of the screening outcome. On a Track A or Track B image verdict the object is preserved for the admin's review surface — the admin sees what was attempted before deciding to remove or ban — and **no public read URL is ever minted for it**. The orphan sweep at §12.6 reconciles the case where step 4 never fires: the client uploads to R2 and never submits the Server Action, through a crash, a network drop after step 3, or deliberate abandonment.
```

### T-11A — §11 (replaces the clause at line 1223)
```
**Moderation fails neither way** (per §10). Idempotency fails closed and rate-limiting fails open because both decide whether a write is legitimate; moderation decides nothing about the write, so it has no failure posture on the request path at all.
```

### T-05A — §5 (replaces the parenthetical at line 643)
```
(A Track A or Track B verdict does not stop a comment row from existing — the comment is written first and the verdict is advisory. `mod_actions` carries the verdict; `comments` carries the content, removed only by an admin's `content_removed` action, per ADR-0021 and ADR-0046.)
```

### T-04A — §4 (replaces the parenthetical at line 450)
```
(the moderation pipeline screens untrusted user-generated content; admin market media is operator-curated and unscreened, ADR-0027)
```

### T-01A — §1 (replaces the clause at line 105)
```
The advisory-moderation pattern — the classifier call dispatched after the transaction commits, images screened at attach before first serve
```

### T-17A — §17 (replaces line 1745)
```
Both are fail-open side-effects: a capture that cannot be written is logged and dropped. Moderation itself has no failure posture on the request path (§10), so there is no `ModerationUnavailableError` seam to fail at.
```

### T-15A — §15 Direction A (replaces line 1646)
```
**Direction A: Flow file → catalogue.** Every `error_code` in any per-flow `docs/specs/flows/F-*.md` Errors block must exist in §15.4's catalogue. The HARDEN-phase CI lint walks every `F-*.md` file and asserts each cited code has a §15.4 row; a flow file that cites an undefined code is a build error.
```

### T-15B — §15 source-breakdown row (replaces line 1625)
```
| ADR-0046 (advisory moderation) | 0 | none — moderation produces no participant-facing error code |
```

### T-15C — §15.4 (replaces the `error-codes.md` sentences at line 1618)
```
**§15.4 is the canonical catalogue and the only one.** The standalone `docs/specs/error-codes.md` was a named forward deliverable; the promise is withdrawn (D-28 r15) and the five `MUST` clauses that bound to it are removed. The §15.5 cross-reference CI lint checks flow files against §15.4.
```

### T-13A — §13 preamble (replaces the sentence at line 1381)
```
Three load-bearing constraints minted in §13 and consumed by every F-* file: (1) the six-field block is mandatory with one degenerate variant for read flows (§13.2); (2) every `error_code` in any Errors block must exist in §15.4's catalogue (§13.1's cross-reference invariant, CI-lint at HARDEN-phase); (3) every name in any Acceptance block must resolve to a real test path under `tests/` (§13.5).
```

### T-13B — §13.5 (replaces the paragraph at line 1474)
```
**Acceptance alignment.** Every name in any Acceptance block must resolve to a real test under `tests/`. The HARDEN-phase CI lint walks every `F-*.md` file's Acceptance block and asserts each named path exists; a name that resolves to nothing is a build error. The former requirement bound these names to a catalogue in SPEC.1 §17, which D-29 removed on 2026-09-06; the flows keep their inline Acceptance lines and the tests themselves are now the referent.
```

### T-13C — §13.1 Acceptance field (replaces line 1397)
```
**Acceptance** — named integration tests that verify end-to-end behaviour, each given as a path under `tests/`. **Cross-reference invariant: every name listed here must resolve to a real test.** A flow file that cites a non-existent test fails the HARDEN-phase CI lint.
```

### T-13D — §13.1 Errors field (replaces line 1393)
```
**Errors** — table mapping every precondition violation and every system-step failure mode to a stable `error_code` from §15.4's catalogue. **Cross-reference invariant: every `error_code` listed here must exist in §15.4.** A flow file that cites an undefined code fails the HARDEN-phase CI lint. The Errors block is exhaustive — undocumented error paths are a contract violation, not a graceful-degradation surface.
```

### T-B18 — Appendix B `blocked_text` row description (replaces the cell at line 2818)
```
Retained text of a submission the classifier flagged, where one exists. Under advisory moderation the comment row also exists; this column is a forensic copy, not the only record. Populated by the superseded gate until MOD-1.
```

### T-21 — §21 (replaces lines 2197–2264)
```
## §21 Operational Runbooks

§21 no longer carries an inventory. **`docs/runbooks/` is the inventory** — the directory is the source of truth and this section does not restate it. The twenty named slots that stood here are struck (D-28 r12): nineteen of them named files that did not exist, while four files that do exist were unnamed, including `deploy-pipeline.md`, which `CLAUDE.md` §5 treats as canonical for the deploy path.

A runbook is added by adding a file. Nothing in this document gates that.
```

### T-22 — §22 (replaces lines 2267–2364)
```
## §22 ADR Index

§22 no longer carries an index. **`docs/adr/` is the index** — the directory is the source of truth and this section does not restate it, count it, or classify it. The 38-row index that stood here declared 38 ADRs against 44 on disk, a ceiling of `0039` against `0046`, and *"dense + gapless"* numbering against two documented gaps at `0002` and `0012`. A per-file index in a specification is a list that goes stale between the writing and the reading; removing it discharges D-28 r18 by removing the thing that kept breaking.

ADRs are named in this document where they bind a contract, at the point where they bind it. They are not counted here.
```

### T-APPA — Appendix A (replaces lines 2467–2653)
```
## Appendix A — Source-of-Truth Pointers

Appendix A no longer carries a file map. **The repository is the map.** The 140-row path→owner table that stood here was declared canonical *"at this v0.3-draft snapshot"* while the document was at 1.0.27, named `PSEUDONYM.md` and `design.md` as companion specs that have never existed on disk (promises deleted, D-28 r16 and r17), and counted 26 ADR files against 44.

The four pointers that are load-bearing, and are stated here because they are cited by contract rather than by convenience:

| Concern | Source of truth |
|---|---|
| Product contract | `docs/specs/SPEC.1.md` — outranks this document (D-22) |
| Decisions and rulings | `docs/decisions/` — outranks both (D-22) |
| Architecture decisions | `docs/adr/` |
| Error-code catalogue | §15.4 of this document |

Everything else is found where it lives.
```

---

## 5 · Rules (apply by the rule; report every before/after; report — do not improvise — any site the rule does not fit)

### RULE-1 — dangling `SPEC.1` citations
The recon enumerated 49 sites. Sites inside a §2 range are carried by that range operation; the rest are remapped by **target**, keeping the surrounding sentence intact:

| Written as | Becomes | Note |
|---|---|---|
| `SPEC.1 §16.5` | `SPEC.1 §14` | Compliance was folded into the moderation section at SPEC.1 2.0.0. Where the clause cites §16.5 as a *legal floor*, the replacement is `SPEC.1 §14`; the legal-floor framing itself is struck (D-28 r7) |
| `SPEC.1 §16.4` | `SPEC.1 §15` when the referent is audit rows; `SPEC.1 §12.2` when the referent is the dataset | |
| `SPEC.1 §16.3` | `SPEC.1 §12.2` when the referent is the dataset or export; `SPEC.1 §6.3` when the referent is erasure; otherwise strike the parenthetical | |
| `SPEC.1 §17` | see L-20/L-21/L-24/L-28/L-30 — these are obligations, not pointers, and are replaced individually | |
| `SPEC.1 §22` | `the Discovery front page` | |
| `SPEC.1 §23` | `the Profile surface` | |
| `SPEC.1 §21.3` | `the debate .md export` | |
| `SPEC.1 §21.9` | `the onboarding deck` | |
| `SPEC.1 §19` | `SPEC.1 §12.2` | |
| `SPEC.1 §16.6`, `SPEC.1 §19.5`, `SPEC.1 §786` | strike the section number; keep the noun phrase | Never resolved; pre-existing, not D-29's doing |

**Verify after:** every surviving `SPEC.1 §N` token names a section that `grep -nE '^## §' docs/specs/SPEC.1.md` reports as present, or a subsection of §16 limited to `16.1`/`16.2`.

### RULE-2 — naming ADR-0014
A site that merely *names* ADR-0014 (as the origin of a pattern, in a citation list, in a footer) is not rewritten; append ` — superseded by ADR-0046` **once per site**. A site that *asserts* the gate behaviour is a line-level edit above. If a site does both, do both.

### RULE-3 — Devcon and the archive boundary (lines 492, 1941, 2140, 2169)
Strike `Devcon`, `Devcon 8`, `ETHGlobal` and the `2026-11-08` archive-boundary claim by name. **Keep** the freeze instant `2026-11-05 23:59 UTC` and the dataset date `2026-11-06`; both are dated facts, not deadline claims (D-21:28). A sentence that exists only to make the struck claim is removed whole.

### RULE-4 — residual gate vocabulary
After §2, §3 and RULES 1–3, sweep for `pre-commit`, `fail-closed` *predicated of moderation*, `blocked at the gate`, `never opens`, `held queue`, `gate auto-action`, `moderation_unavailable`, `moderation_in_flight`, `track_b_blocked`, `sexual_minors_text_blocked`, `track_a_autoban`. Every survivor must be one of: (a) inside the §0 change-log row, which names what it struck; (b) an explicit negation or a narration of the supersession; (c) a description of what `src/` still does pending MOD-1, marked as such. **Report every survivor with which case it is.** Anything that asserts present-tense gating is a NEW FINDING — report it, do not fix it.

---

## 6 · Post-checks (measured; table in the run report: command · expected · actual · PASS/FAIL)

```
git hash-object docs/specs/SPEC.2.md                    # reported
wc -l docs/specs/SPEC.2.md                              # reported (expect ~2,400-2,550)
git diff --name-only origin/main...HEAD                 # exactly: docs/decisions/README.md, docs/decisions/RECORD-v2.6-amendment.md, docs/plans/SPEC-2-PASS.md, docs/specs/SPEC.2.md
grep -nE '^## §' docs/specs/SPEC.2.md                   # §0 §1 §3..§20 §21 §22 — no §2, no §23
grep -c 'Pre-Commit Moderation Contract'                # 0
grep -c '## §10 Moderation Contract'                    # 1
grep -ciE 'devcon|ethglobal'                            # 0    control: grep -c 'Dharma' > 0
grep -c '2026-11-08'                                    # 0
grep -c '2026-09-15'                                    # >= 1  (D-24)
grep -c '2026-11-05 23:59'                              # >= 1  (the freeze instant survives)
grep -ciE 'moderation_unavailable|moderation_in_flight' # 0
grep -ciE 'track_a_autoban|track_b_blocked|sexual_minors_text_blocked'   # only inside the §0 change-log row and §10's MOD-1 sentence — list every site
grep -nE 'error-codes\.md'                              # 0 MUST-bearing sites; list every survivor with its clause
grep -cE 'PSEUDONYM\.md|design\.md'                     # 0
grep -oE 'SPEC\.1 §[0-9]+(\.[0-9]+)?' docs/specs/SPEC.2.md | sort -u    # every one must exist in SPEC.1 — cross-check and list
grep -c 'MOD-1'                                         # >= 3
grep -c '<LAST-1.0.x-SHA>'                              # 0 — the token must have been substituted
grep -c 'an image is never served before it has been screened'          # 1
grep -c 'only mechanism in the product that catches image-borne CSAM'   # 1
grep -nE '^\| \*\*Version\*\* \| 2\.0\.0'               # 1
awk '/^## /{if(p)print p" -> "NR-1; p=$0}' docs/specs/SPEC.2.md         # section boundaries, for the report
grep -c '^---'                                          # report; adjacent sections must have exactly one separator
pnpm biome check docs/ 2>&1 | tail -3                   # NOT a receipt — biome does not lint Markdown. Note once; the load-bearing checks are above
```

---

## 7 · Relays

### Relay A — commit the plan and D-30 (session 1; halts after commit)
```
TASK.ID: SPEC-2-PASS
PHASE: plan-commit
MODE: gated. Not ultracode. No bypass-permissions.

  git worktree add -b docs/spec-2-pass ~/code/zugzwang/wt-spec-2-pass origin/main
  cd there; git fetch origin --prune; git rev-parse HEAD; git rev-parse origin/main   # equal, or ff-only
  git hash-object docs/specs/SPEC.2.md   # must be c54cd0a36684c148b8cb154add4a03aca9f9684f, else HALT
  git hash-object docs/specs/SPEC.1.md   # report; expect d0d500716681f2d0374b0c4fe119388b792c26db

1. cp <the ledger from ~/Downloads> docs/plans/SPEC-2-PASS.md
   Verify by md5 against the value in the kickoff, and that line 3 reads "Plan version: 1.0".
   If the named path fails, list ~/Downloads/SPEC-2-PASS_ledger*.md with md5s and use the file whose
   md5 matches, recording the filename. If no file matches, HALT.
2. Create docs/decisions/RECORD-v2.6-amendment.md from plan §1, verbatim, extracted programmatically
   from the plan file rather than retyped. Re-measure the block's line range in the file you copied.
3. Append the amendment-2.6 index row to docs/decisions/README.md in the existing rows' format, and
   move the 2.5 row's superseded/followed cell exactly as the 2.5 commit moved 2.4's. Measure the
   format and the precedent with git show before matching them.
4. ONE commit: "docs(spec): SPEC-2-PASS plan + D-30 (amendment 2.6) — SPEC.2 rebaseline to 2.0.0"
5. git push -u origin docs/spec-2-pass
6. Report to ~/Downloads/zz_SPEC-2-PASS_plan-commit_<ts>.md; ≤10-line headline inline. HALT.
   Do not execute the plan in this session.
```

### Relay B — execute (session 2, FRESH, same worktree)
```
TASK.ID: SPEC-2-PASS
PHASE: execute
MODE: gated. Not ultracode. No bypass-permissions. Moderation is a Lock-5 document.

cd ~/code/zugzwang/wt-spec-2-pass
Read docs/plans/SPEC-2-PASS.md in full. It is the only instruction. Nothing in this prompt adds to it.
Run plan §0.1 preconditions, all six; HALT on any failure.
Apply §2 then §3 bottom-up with the boundary checks; §4 text verbatim; then §5's four rules.
ONE commit: docs/specs/SPEC.2.md — "docs(spec): SPEC.2 2.0.0 — rebaseline per D-30; §10 rebuilt as the Moderation Contract (ADR-0046, D-20)"
Run every §6 post-check; the table goes in the report.
git push; gh pr create --draft --title "docs(spec): SPEC.2 2.0.0 — rebaseline per D-30; moderation advisory" --body "Plan: docs/plans/SPEC-2-PASS.md · Ruling: D-30 (amendment 2.6) · Code half: MOD-1 pending · Gate C: reviewer + web + founder diff-read before ready"
Do not merge. Do not mark ready.
Report to ~/Downloads/zz_SPEC-2-PASS_execute_<ts>.md; ≤10-line headline inline.
```

### Relay C — reviewer (session 3, FRESH; issued after B's headline)
Reads the PR diff against this plan: every §2/§3 op applied at its ratified anchor; every §4 block byte-identical (diff each programmatically against the plan's fenced source — T-10 gets the closest read, it is Lock-5 prose); every §5 rule applied by its rule with judgement calls flagged; nothing outside the plan touched; §6 reproduced. Then a **continuous read** of §10, §12, §11, §5 and §3 asking one question: *does any surviving sentence still assert that moderation blocks, holds, rejects or gates a post?* Report every hit. Also: every surviving `SPEC.1 §N` resolves; every surviving `error_code` reference resolves to §15.4; no `§2`/`§23`/Appendix-A cross-reference survives elsewhere in the file. Output HIGH/MED/LOW findings plus the full diff, both to `~/Downloads`.

---

## 8 · Parked and follow-ons (not this PR)

| ID | Item | When |
|---|---|---|
| HYGIENE-1 | `SPEC.1:1155` — §16 preamble still promises Privacy, Audit Logs and Compliance subsections that D-29 removed. Plus `docs/decisions/README.md:16-18` and `docs/STATE.md`, which still state the superseded ladder | One small PR, any time |
| MOD-1 | The code half. Handover brief issued 2026-09-06; appendix file map pending | Founder to sequence against 2026-09-15 |
| MOD-1-B | The option-B consequence amendment (no auto-drop, no auto-ban outside the CSAM-adjacent image set) — amends SPEC.1 §2, §14, §15, §16.2, Appendix A **and** SPEC.2 §10's category-routing paragraph | Blocked on the founder's CSAM-backstop ruling |
| ADR pass | ADR-0014 `Amended-by` row; ADR-0021's Track B consequence; ADR-0011 ×2 (D-28 r16); ADR-0006:34 (r20); `Status` formatting (r19) | After this PR |
| Flow files | 36 of 37 are empty skeletons. §13 now describes that accurately; filling them is separate work and is not gated by this document | Post-launch |
| PK refresh | After SPEC.2 lands (D-28 r28) | Founder |
