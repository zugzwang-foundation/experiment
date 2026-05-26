# SCAFFOLD.16 — execute-phase close-out

> Execute-phase CC chat 2026-05-26 (Phase 0 inputs → Phase 9 close-out). Plan-mode close-out at `docs/logs/SCAFFOLD.16-plan-mode.md`. Plan body amended in commit-2 (`fec72aa`) per Phase-1 verify-don't-trust find ratification.
>
> Six fields per CLAUDE.md §5.9.

---

## What landed

**Commits on branch `plan/scaffold-16` (off `origin/main` HEAD `6a6b04b`):**

- `fec72aa` — `plan(scaffold-16): Phase 1 verify-don't-trust amendments + 8 new §F loci + research-brief errata` (commit-2)
  - `docs/plans/SCAFFOLD.16.md`: §F count 9 → 17; Edit 4a "After" text corrected per Option 6α + re-narrowed per F-γ-thin citation chain; new Edits 10–17 (Items A–E + F-γ-thin sub-edits 15a–15e + G2 §14 F-MOD-3 cascade extension + Item G SPEC.2 §4 line 371); §3.7 SURPRISE 7 (7a/7b/7c three-way split); §I provenance subsection "Brief drift caught at execute-phase Phase 1 verify-don't-trust" + 42-locus `mod_actions` inventory + Item H-1 close-out documentation.
  - `docs/briefs/SCAFFOLD.16-technical-research-brief.md`: NEW — v1 frozen body + dated ERRATA 2026-05-26 (Error 1 `hate` image-support mis-categorization at §1 line 33; Error 2 implied F-ADMIN-4 mitigation citation chain break).

- `34487a7` — `feat(scaffold-16): LD-3 carve-out + 17 §F SPEC amendments + parked.md rows + F-γ-thin test scaffold` (commit-3)
  - `src/server/moderation/precommit.ts`: LD-3 verdict-mapping ternary at line 114 (`outcome = imageR2Key ? "track_a" : "track_b";`); JSDoc rewrite at lines 21–29 (LD-3 verdict-mapping documentation + experiment-phase scope note + docs/parked.md pointer); future-PhotoDNA-addition comment at lines 101–108 cleaned up to cite docs/parked.md (L3 absorbed per CLAUDE.md §7).
  - `src/server/config/limits.ts:88`: JSDoc PhotoDNA framing dropped per LD-1; cites SCAFFOLD.16 + docs/parked.md.
  - `tests/integration/precommit-moderate.integration.test.ts`: rename `precommit-moderate::track-a-csam-mapping` → `::track-a-csam-mapping-with-image` (add `imageR2Key` + `mockSignRead`); add new `::text-only-sexual-minors-routes-track-b` test per LD-3 carve-out (currently failing before Phase 3 implementation lands; passes after).
  - `tests/server/admin/moderation/act.test.ts`: NEW; `f-admin-4::pass-verdict-removal` scaffold for F-γ-thin per plan §F sub-edit 15e. `it.skip` + dynamic import + `@ts-expect-error` directive pending DEBATE.2 caller-side implementation per LD-5 + LD-6 + plan §B B12.
  - `docs/specs/SPEC.1.md`: 12 SPEC.1 §F edits (Edits 1–3 + 10–16) + NCMEC ceiling-exempt strikes at F-MOD-1 line 772, §14 provisional gate line 803, §16 Q3 row line 1236.
  - `docs/specs/SPEC.2.md`: 5 SPEC.2 §F edits (Edits 4–9 + 17, Edit 7 verified no-op) + NCMEC ceiling-exempt strikes at §11 line 1071, §12.x F-MOD-3 row line 1295 (struck), §18 lines 1684 + 1759, §21 line 2012 + PhotoDNA ceiling-exempt strike at §22.x SCAFFOLD.13 drift-correction row line 2227.
  - `docs/parked.md`: 4 new H2 rows — second-vendor deferred, NCMEC reporting deferred, Track A text/image asymmetry (LD-3 design record), R-1/R-2/R-3 hardening deferred.

- `<this commit>` — `chore(scaffold-16): execute-phase close-out log` (commit-4).

**PR**: opened post-commit-4 push (URL recorded inline below once `gh pr create` returns).

**Phase summary**:

- **Phase 0** (input acks): 7 inputs read; line-number drift verified clean against `main` HEAD `6a6b04b`.
- **Phase 1** (verify-don't-trust): 5 SPEC.1 brief-drift items surfaced + 1 broken F-ADMIN-4 citation chain + 1 plan-body factual error inherited from research brief v1 → STOP-and-surface to operator per CLAUDE.md §5. Commit-2 landed plan amendments after individual operator ratification + web Claude review.
- **Phase 2** (test-writer subagent): rename + 1 new LD-3 carve-out test in precommit-moderate file; NEW F-γ-thin admin scaffold (`it.skip`) for DEBATE.2 handoff. Failing-tests-first verified.
- **Phase 3** (src/ implementation): 3 edits applied per plan §E; 15 precommit-moderate tests pass; tsc clean.
- **Phase 4** (17 §F SPEC amendments + NCMEC/PhotoDNA ceiling-exempt strikes): all applied.
- **Phase 5** (docs/parked.md +4 rows): applied.
- **Phase 6** (pre-PR self-audit): PASS/FAIL/SURPRISE hybrid; all PASS modulo F-γ-thin admin test `.skip` adjustment for CI-green.
- **Phase 7** (code-reviewer + security-auditor cascade): 0 CRITICAL/HIGH. 1 code-reviewer MEDIUM (pre-existing truthy-check pattern; aligned with R-1 parked.md). 4 code-reviewer LOW + 2 security-auditor LOW. L3 absorbed in-session per CLAUDE.md §7.
- **Phase 8** (final checks): tsc clean, biome clean (121 files), vitest 302 passed + 2 skipped + 5 todo.
- **Phase 9** (close-out log): this file.

---

## Decisions made

**Variances from plan-time framing absorbed at execute-phase**:

1. **Phase-1 §F locus expansion: 9 → 17.** Verify-don't-trust re-grep against current `main` HEAD `6a6b04b` surfaced 5 SPEC.1 brief-drift items (Items A–E rooted in LD-1 + LD-3) + 1 broken F-ADMIN-4 citation chain (Item F → Option F-γ-thin chosen by operator; sub-edits 15a–15e + G2 §14 F-MOD-3 cascade + Item G SPEC.2 §4 line 371). Operator-ratified individually 2026-05-26 with verification gates (Item A structural verification of §14 Track labels A/A/B/C; Item B + D + E re-narrowing per authoritative OpenAI `omni-moderation-2024-09-26` capability table; Item C Q-table column-shape verification). Plan body amended in commit-2 (`fec72aa`).

2. **Plan §F Edit 4a "After" text corrected per Option 6α + re-narrowed per F-γ-thin H-γ encoding-agnostic phrasing.** Original text claimed "three image categories `omni-moderation` does NOT classify (`hate`, `harassment`, `weapons` on image inputs)" — three compounding factual errors per authoritative OpenAI capability table (fetched 2026-05-26 from `developers.openai.com/api/docs/guides/moderation`): wrong count (7 text-only categories, not 3), wrong list (missing `illicit`, `illicit/violent`, `sexual/minors`), wrong taxonomy claim (`weapons` is not an OpenAI moderation category at all). Error originated in research brief v1 §1 line 33 (claimed `hate` is image-supported; authoritative source contradicts) and propagated into plan body Edit 4a during /plan opening drafting 2026-05-26. Corrected in-place per 6α; tracked as amendment-note within existing Edit 4 entry not as separate locus.

3. **F-γ-thin (extend SPEC.1 §15 F-ADMIN-4 with inline admin removal of pass-verdict comments).** Operator chose F-γ-thin over F-α (defer mitigation) and F-γ-full (extend ahead-of-need) on grounds of image-borne harm content during the 15 Sep – 1 Nov experiment window + ETHGlobal Mumbai public launch being a thesis-violation surface (mandatory-commentary integrity + K_eff demonstration optics) that outweighs the ~1-2 hour scope expansion. Documentation honesty + operational adequacy both achieved. H-γ encoding-agnostic phrasing for `mod_actions` row shape (deferring verdict-enum vs action column vs metadata-field encoding choice to DEBATE.2 caller-side per LD-5) avoids propagating Item H-1 (long-standing SPEC vs shipped-code drift on `mod_actions` schema) into a new SPEC.1 location.

4. **Research-brief Option II inline errata note.** Brief frozen at v1 per plan-provenance convention; dated ERRATA 2026-05-26 note appended at `docs/briefs/SCAFFOLD.16-technical-research-brief.md` (third commit-2 file change). Records propagation chain for Error 1 (hate image-support mis-categorization) + Error 2 (implied F-ADMIN-4 mitigation citation chain break). Brief body unchanged per convention; errata is appendix-only.

5. **Test-writer subagent output: starting-count discrepancy.** Kickoff + plan body both estimated 12 existing tests in precommit-moderate file; actual was 14. Net new tests = +2 (1 LD-3 carve-out + 1 F-γ-thin admin removal); rename is identity-preserving. Total post-Phase-2: 16 tests across two files (15 in precommit-moderate file, 1 in new admin file). Test-writer surfaced as informational; not a scope/structural issue. Per operator's default disposition ("apply judgment, document in close-out, keep moving") — documented here.

6. **F-γ-thin admin removal test `.skip` for CI-green.** Test-writer wrote a failing test that fails on module-resolution (`Cannot find package '@/server/admin/moderation/act'` — implementation is DEBATE.2-owned per LD-5 + LD-6 + plan §B B12). For CI-green at PR open, converted `it(...)` → `it.skip(...)` with explanatory text + DEBATE.2 handoff comment. Preserves test body as DEBATE.2 contract; preserves `@ts-expect-error` directive as handoff signal (TS2578 unused-directive error fires when DEBATE.2 lands the module); CI green for SCAFFOLD.16 PR. Per operator's default disposition.

7. **NCMEC + PhotoDNA ceiling-exempt default-strikes applied.** Per operator's kickoff §4 + Phase-1 default-strike rule:
   - **NCMEC additional refs (8 loci)**: SPEC.1 line 772 (F-MOD-1 "legal report filed automatically"), SPEC.1 line 803 (§14 provisional gate), SPEC.1 line 1236 (§16 Q3 row), SPEC.2 line 1071 (§11 fail-CLOSED), SPEC.2 line 1295 (§12.x F-MOD-3 row struck), SPEC.2 line 1684 (§18 prose), SPEC.2 line 1759 (§18 ADRs consumed), SPEC.2 line 2012 (§21 prose). All amended with deferred-marker citing LD-7 + `docs/parked.md`.
   - **PhotoDNA additional refs (3 loci)**: SPEC.1 line 803 + line 1236 (overlap with NCMEC strike; covered above), SPEC.2 line 2227 (§22.x SCAFFOLD.13 drift-correction row). Amended with deferred-marker citing LD-1 + LD-10 Position B + `docs/parked.md`.
   - **Preserved per "ADR-0014 unamended" framing + memory `project_adr_catalogue_framing`**: SPEC.1 line 1268 (§20 change-log historical entry), SPEC.2 line 40 (§0.1 change-log historical entry), SPEC.2 line 2105 (§23 ADR Index row description).

8. **L3 code-reviewer finding absorbed in-session.** `precommit.ts:101–108` "future PhotoDNA addition might throw a raw error" comment was stale post-LD-10 Position B. Updated to "future second-vendor addition (per docs/parked.md) might throw a raw error" in commit-3 per CLAUDE.md §7 cleanup absorption rule (<2 hours; in-stratum).

**Reviewer-cascade findings (MEDIUM/LOW) absorbed per operator's escalation discipline**:

- **MEDIUM (code-reviewer)**: `precommit.ts:120` LD-3 ternary uses JS truthy check; empty string `""` slips through (matches pre-existing `if (imageR2Key)` gate at line 74). NOT a SCAFFOLD.16 regression — pre-existing pattern continuation. Aligns with `docs/parked.md` Row 4 R-1 strict-equality hardening recommendation (`imageR2Key !== undefined && ...`). Document for post-experiment hardening backlog.

- **LOW (code-reviewer)**:
  - Plan §A item 4 test-count arithmetic (claims "12 existing", actual 14). Plan body claim wrong; intent correct. Documented above (Decision #5).
  - Pre-existing `§10.10` → `§10` JSDoc drift in `precommit.ts:15` + `limits.ts:16, :45, :91, :94, :97, :100`. Out of SCAFFOLD.16 scope per CLAUDE.md §5.3/§5.4. Tracker-visibility note only; future hygiene sweep.
  - `precommit.ts:101–108` stale "future PhotoDNA addition" comment. Absorbed in-session per CLAUDE.md §7 (one-line fix; <2 hours). Documented above (Decision #8).
  - `docs/parked.md` Row 3 quotes strict-equality predicate (`imageR2Key !== undefined && ...`); implementation uses truthy check. Both consistent under `exactOptionalPropertyTypes: true` (AGENTS.md §4 mandated config); both diverge under current `tsconfig.json` state (only `strict: true`). Surface for future `exactOptionalPropertyTypes` hardening pass.

- **LOW (security-auditor)**:
  - `tests/server/admin/moderation/act.test.ts:204` — F-γ-thin test asserts `UPDATE comments` but `comments` is Bucket A (storage trigger `enforce_bucket_a_no_update` rejects all UPDATEs at the storage layer). DEBATE.2 will reconcile when picking the encoding (likely a sibling visibility table or a read-time `LEFT JOIN mod_actions` filter or a Bucket-B-style append-only flag table). Test is `.skip`'d; no exploitability surface. Trigger is the load-bearing INV-3 enforcement layer — this drift cannot reach it.
  - `tests/server/admin/moderation/act.test.ts:94–96` — mock returns `mockValidateAdminSession.mockResolvedValue({ session_id: ... })` (snake_case); actual `validateAdminSession` at `src/server/auth/admin/validate.ts:26–40` returns `{ sessionId: string } | null` (camelCase). Mock encoding drift; test is `.skip`'d; DEBATE.2 reconciles at implementation time.

---

## Open questions

None for SCAFFOLD.16 closure. All findings either absorbed in-session, ratified by operator at Phase-1, or documented for DEBATE.2 handoff / post-experiment hardening backlog.

**Forward-flagged questions for DEBATE.2 (caller-side stratum that ships F-COMMENT-3 + F-γ-thin admin Server Action)**:

- **`mod_actions` row shape encoding (H-γ deferred choice)**: verdict-enum extension vs new action column vs metadata field. SCAFFOLD.16 F-γ-thin uses encoding-agnostic phrasing per H-γ. Item H-1 (long-standing SPEC vs shipped-code drift; SPEC.1 §1 lines 62–63 documents `mod_actions.action ∈ {csam_blocked, nsfw_auto_banned, flagged, approved, blocked}` but shipped `src/db/schema/audit.ts` has `verdict: modVerdictEnum('verdict', ['pass', 'track_a', 'track_b'])` with no `action` column) is in scope for DEBATE.2 to reconcile at INSERT-site shipping time. 42-locus inventory in plan §I "Brief drift caught at execute-phase Phase 1 verify-don't-trust" subsection for DEBATE.2 future-reader.

- **F-γ-thin admin Server Action implementation**: `src/server/admin/moderation/act.ts` with `moderateComment(input)` carrying new `action: "remove_pass_verdict"`. Test scaffold at `tests/server/admin/moderation/act.test.ts` (currently `.skip`'d) is the SCAFFOLD.16 contract for DEBATE.2 to satisfy. DEBATE.2 removes `.skip` + `@ts-expect-error` directive + implements `act.ts` + reconciles mock encoding drifts (snake_case vs camelCase; `UPDATE comments` vs Bucket A trigger ground-truth) + assertions go green.

- **`mod_actions.image_r2_key` linkage on Remove pass-verdict**: should the action carry an `image_r2_key` linkage for orphan-sweep correlation per SPEC.2 §12.x reconciliation invariant? Currently undefined. DEBATE.2's call.

**Forward-flagged hygiene tasks**:

- **CF-3 (test-naming convention sweep)**: post-SCAFFOLD.16 SPEC.1 §17 carries 10 `moderation::*` rows + 1 `precommit-moderate::*` row + 1 `f-admin-4::*` row = 12 total moderation-domain rows in mixed family. Full sweep (rename all `moderation::*` rows to match shipped test families OR document which rows are SPEC-aspirational) deferred to future SPEC.1 hygiene task. Per plan §H CF-3.

- **`§10.10` → `§10` JSDoc drift**: pre-existing in `precommit.ts:15` + `limits.ts:16, :45, :91, :94, :97, :100`. Out of SCAFFOLD.16 scope. Cleanup pass needed in future hygiene task (probably alongside ENGINE.8 or DEBATE.2's caller-side wiring).

- **`exactOptionalPropertyTypes: true` enablement**: AGENTS.md §4 mandates this; current `tsconfig.json` does not enable it. R-1 (parked.md Row 4) strict-equality predicate framing assumes it. Surface for HARDEN.* pre-launch hardening.

- **Tracker v11 update**: SCAFFOLD.16 status flip Open → Closed; description amend to reflect actual scope (Track A image-presence carve-out per LD-3 + F-γ-thin §15 F-ADMIN-4 extension + 17 §F SPEC amendments — not "cron infrastructure" per pre-existing stale tracker description). Operator-maintained external HTML per memory `project_tracker_external`.

---

## Next session starts at

**Tracker hygiene + DEBATE.2 kickoff drafting** (operator-side actions):

1. Tracker v11 update (operator-maintained external HTML).
2. DEBATE.2 kickoff drafting: F-COMMENT-3 caller wires + F-γ-thin admin Server Action implementation per SCAFFOLD.16 contract at `tests/server/admin/moderation/act.test.ts`.

If a CC session opens next on this branch (before merge), the entry point is `gh pr view <PR#>` to inspect reviewer comments and `gh pr checks` to verify CI status.

---

## Context to preserve

Items not derivable from the plan body or git history alone:

- **Phase 1 verify-don't-trust process learning (7a/7b/7c three failure modes)**: documented in plan §I provenance subsection "Brief drift caught at execute-phase Phase 1 verify-don't-trust". Sibling to plan-mode close-out's "Brief drift caught at plan opening". Each subsection records the specific failure-mode root cause:
  - **7a**: brief-time scope estimate dramatically underestimated SPEC.1 amendment fan-out (brief: 5 → /plan: 9 → execute-phase: 17 = +240% cumulative). Future plan-mode CC sessions: brief-time estimates are not upper bounds; /plan opening greps + execute-phase verify-don't-trust greps are both necessary scope-discovery passes.
  - **7b**: research brief factual claim propagated into plan body without primary-source verification (`hate` image-support mis-categorization at §1 line 33). Future plan-mode CC sessions: per-category capability tables for external vendors should be verified against primary docs at /plan opening, not assumed correct from briefs.
  - **7c**: plan-mode cited-mitigation contract not grep'd against target prose (F-ADMIN-4 citation chain broken at SPEC.1 §15 lines 882–892). Future plan-mode CC sessions: cited-mitigation references (e.g., "mitigated by F-ADMIN-X reactive removal") should be grep'd against the cited contract's actual prose at /plan opening; cited mechanism's scope may not match the citing context's claim.

- **42-locus `mod_actions` SPEC inventory** (close-out reference for DEBATE.2 future-reader): documented in plan §I subsection. 18 operational hits in SPEC.1 + 24 in SPEC.2 + 2 historical change-log refs preserved per ADR-substance discipline. Item H-1 drift isolated to SPEC.1 §1 lines 62–63 (the only operational locations documenting `mod_actions.action` enum). When DEBATE.2 wires caller-side `mod_actions` INSERT semantics, this inventory is the reference material; reconciliation ripples through SPEC.1 §1 + SPEC.2 §5/§6/§B.11 at minimum.

- **F-γ-thin admin Server Action test contract** (`tests/server/admin/moderation/act.test.ts`, currently `.skip`'d): substantial mock setup + assertion logic that's encoding-agnostic per H-γ. DEBATE.2 handoff signal is the `@ts-expect-error` directive — when DEBATE.2 lands `src/server/admin/moderation/act.ts`, the directive becomes a TS2578 "unused directive" error, signaling the test has moved past the "blocked on DEBATE.2 implementation" state. DEBATE.2 also removes `.skip` to enable runtime execution. Mock encoding drifts (snake_case `session_id` vs camelCase `sessionId`; `UPDATE comments` vs Bucket A trigger ground-truth) are DEBATE.2's reconciliation surface per security-auditor LOWs.

- **Research brief v1 frozen + ERRATA convention**: original `~/Downloads/SCAFFOLD.16-technical-research-brief.md` (180-line v1, MD5 `4698d41100695ffa58040de001063823`) preserved unchanged. In-repo copy at `docs/briefs/SCAFFOLD.16-technical-research-brief.md` is v1 body + appended dated ERRATA 2026-05-26 note. Future research-brief errata follows this same pattern — body frozen, errata appended with date. The brief was brought into the repo at this stratum (previously at `~/Downloads/` only); operator may delete the `~/Downloads/` copies at leisure.

- **Hard-ceiling-at-6 SURPRISES bookkeeping**: plan-mode used 6/6 (SURPRISES 1–6 absorbed at /plan opening 2026-05-26). Execute-phase used 1/6 (SURPRISE 7 = 7a/7b/7c lumped as one event per Q3 operator refinement on grounds that all three share the same root cause: Phase 1 verify-don't-trust discovery). 5 execute-phase budget remaining; not used. Cumulative ceiling consumption: 7/12 (plan-mode + execute-phase) — well within budget.

- **Defensive sweeps run pre-commit-2** (all CLEAN; documented for process learning):
  - Sweep #3 (SPEC.1 §17 acceptance-test catalogue cascade under F-γ-thin) — existing rows hold semantically; new sub-edit 15e row slots in without conflict.
  - Sweep #4 (SPEC.1 §14 F-MOD-1 through F-MOD-5 prose) — clean modulo NCMEC ceiling-exempt strike at F-MOD-1 line 772 (already in inventory).
  - Sweep #5 (F-COMMENT-3 cascade in SPEC.2) — clean; orthogonal to F-γ-thin (F-COMMENT-3 is participant-side; F-γ-thin extends admin-side).
  - Sweep #6 (`mod_actions` SPEC inventory) — 42 loci catalogued for DEBATE.2 reference; Item H-1 drift isolated to SPEC.1 §1 lines 62–63.

- **§F Edit 7 is an explicit no-op** per ENGINE.6 process-improvement #5 enumeration discipline. Phase 4 application verified SPEC.2 §17.2 row 4 unchanged (no edit needed); enumerated for traceability.

- **Plan-mode close-out used "PhotoDNA HTTP call shape" paragraph strike at §10 line 1021** — Phase 4 applied this strike via Edit 4d's empty-string replacement (the whole paragraph removed). Post-strike, SPEC.2 §10 has no paragraph between Edit 4c (line 1017 "No Postgres transaction") and Edit 4e (line 1023 "Failure mode"). This is the intended state — the paragraph was PhotoDNA-specific and Position B-struck per LD-10 reopen.

---

## Time

- 2026-05-26 ~10:00 IST: Phase 0 inputs ack (7 inputs in parallel).
- 2026-05-26 ~10:30 IST: Phase 1 verify-don't-trust re-grep + 5 SPEC.1 brief-drift items surfaced (Items A–E) + STOP-and-surface to operator.
- 2026-05-26 ~11:00 IST: Operator ratifies Items A–E individually with verification gates; Item E verification fetches authoritative OpenAI capability table; Item F surfaces (F-ADMIN-4 citation chain broken); Option F-γ-thin chosen; Option 6α + Option II ratified; G2 + Item G + Item H-1 disposition + Items B/D/E α-fix.
- 2026-05-26 ~12:00 IST: Commit-2 (`fec72aa`) drafted + pushed (plan body amendments + research brief errata).
- 2026-05-26 ~12:30 IST: Phase 2 test-writer subagent invocation; 2 failing tests + 1 admin scaffold delivered.
- 2026-05-26 ~13:00 IST: Phase 3 src/ implementation; 15 precommit-moderate tests green; tsc clean.
- 2026-05-26 ~13:30 IST: Phase 4 17 §F SPEC amendments + NCMEC/PhotoDNA additional ceiling-exempt strikes applied.
- 2026-05-26 ~14:00 IST: Phase 5 parked.md 4 rows + Phase 6 self-audit + Phase 7 reviewer cascade (code-reviewer + security-auditor) + Phase 8 final checks.
- 2026-05-26 ~14:30 IST: Commit-3 (`34487a7`) drafted + L3 absorbed in-session + this close-out drafted + commit-4 (close-out) drafted.

Total elapsed execute-phase chat time: ~4–5 hours wall-clock, ~3–4 hours operator-engaged.
