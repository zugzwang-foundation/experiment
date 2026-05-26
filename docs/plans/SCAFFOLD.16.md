# SCAFFOLD.16 — Plan

> **Status:** drafted
> **Date:** 2026-05-26
> **Author:** Hrishikesh + Claude Code (plan-mode chat, 2026-05-25→26)
> **Critical-path?** yes — `src/server/moderation/` per CLAUDE.md §1
> **Plan PR / commit:** branch `plan/scaffold-16` off `origin/main` HEAD `6a6b04b`

> **Authority:** Plan-mode draft against `SCAFFOLD.16-plan-mode-brief.md` (v1, 552 lines, MD5 `4698d41100695ffa58040de001063823`) + `SCAFFOLD.16-technical-research-brief.md` (180 lines). Plan-mode CC chat 2026-05-25→26; branch `plan/scaffold-16` cut from `origin/main` at HEAD `6a6b04b` (post-SCAFFOLD.17-post-merge-log chore merge — PR #51).
>
> **Stratum sequencing:** ENGINE.6 (merged 2026-05-25 at `42baa8b`) → SCAFFOLD.17 (merged 2026-05-25 at `d5be518`) → SCAFFOLD.17 post-merge-log chore (merged 2026-05-26 at `6a6b04b`) → **SCAFFOLD.16** → DEBATE.2 (downstream consumer of `precommitModerate` return shape per LD-4/5/6).
>
> **Out-of-scope at chat level:** second moderation vendor (PhotoDNA / Safer / Hive) per LD-1; NCMEC CyberTipline integration per LD-7; auto-ban `users.banned_at` write per LD-6; `mod_actions` row insertion per LD-5; `precommitModerate` return-shape modification per LD-4; research-backed R-1/R-2/R-3 hardening per operator scope decision 2026-05-25.

---

## Tracker context

Tracker v10 entry for SCAFFOLD.16 absorbed into the brief (`SCAFFOLD.16-plan-mode-brief.md` §0 + §1). Tracker is operator-maintained external HTML per user-memory `project_tracker_external` — no inline paste in this plan. Scope reframe from the original tracker description ("PhotoDNA + Safer parallel call via Promise.all") is documented in the brief's > authority block and at brief §6 vendor-research summary.

**Predecessor dependencies (all merged):** ENGINE.6 (#49), SCAFFOLD.15 (#47 + #48), SCAFFOLD.17 (#50 + #51 chore log).
**Downstream consumers (deferred):** DEBATE.2 (F-COMMENT-3 caller of `precommitModerate`), future caller strata for F-BET-1 / F-COMMENT-1 / F-COMMENT-2 entry paths.

## Approach (one paragraph)

SCAFFOLD.16 adjusts the existing OpenAI-only `precommitModerate()` Track A verdict-mapping to gate auto-ban routing on `imageR2Key` presence (LD-3): text-only `sexual/minors === true` routes to Track B (admin review); image-attached `sexual/minors === true` routes to Track A (auto-ban contract owned by future caller strata). Five-LOC-band code change in `src/server/moderation/precommit.ts`; one new acceptance test + one renamed existing test (per Q2 = β, rename + add); two JSDoc comment cleanups; four `docs/parked.md` row drafts; nine same-commit SPEC amendment locations applying Position B (complete removal, not deferred-marker) to all PhotoDNA references in SPEC.1 + SPEC.2 plus NCMEC operational references. The brief's "vendor onboarding stratum" framing is dropped; the canonical record of second-vendor + NCMEC optionality moves entirely to `docs/parked.md`.

---

## §1 — Locked decisions absorbed verbatim

Plan-mode CC does **not** re-litigate the LDs. LD-1 through LD-9 reproduced as decision names; substance is at brief §0. LD-10 was **REOPENED at /plan opening 2026-05-26** and changed from Position A to Position B per operator-directed scope discipline — substance recorded inline below.

- **LD-1** — OpenAI omni-moderation is the SOLE moderation vendor in SCAFFOLD.16 experiment-phase scope. Operator ratification 2026-05-25 + ADR-0014 "PhotoDNA-or-equivalent" framing.
- **LD-2** — Snapshot pin: `omni-moderation-2024-09-26` per SPEC.2 §10 + ADR-0014 + `src/server/config/limits.ts:89`. Shipped at SCAFFOLD.15.
- **LD-3** — Track A auto-ban gated on `imageR2Key` presence; text-only `sexual/minors === true` flags route to Track B (admin review). Operator ratification 2026-05-25 (Reading 1). NEW — SCAFFOLD.16 ships this. **Structurally validated** by research-brief finding: `sexual/minors` is text-only on `omni-moderation-2024-09-26` per OpenAI docs; the carve-out aligns with what the classifier can actually attribute, not just a policy nuance.
- **LD-4** — `precommitModerate` return shape (`{outcome, categories}`) UNCHANGED. Auto-ban contract documented for downstream caller strata (DEBATE.2 etc.) per Option (b). Operator ratification 2026-05-25.
- **LD-5** — `mod_actions` row insertion remains caller-side per ADR-0014 + existing `precommit-moderate.integration.test.ts` lines 20-23 — SCAFFOLD.16 does NOT touch this discipline.
- **LD-6** — `users.banned_at` write remains caller-side per LD-4. Operator ratification 2026-05-25.
- **LD-7** — NCMEC reporting OUT OF SCOPE for SCAFFOLD.16 and OUT OF SCOPE for experiment phase entirely. **Updated 2026-05-26 at /plan opening per attorney consultation 2026-05:** resolution trigger = post-experiment; integration ships post-incorporation. Originally framed as "launch-blocker tracked in `docs/parked.md` with attorney-consultation requirement before Sep 15"; updated framing rolls into `docs/parked.md` Item 2 (§G below).
- **LD-8** — Test-naming convention: `precommit-moderate::*` (matches shipped tests). Same-commit SPEC.1 §17 prose amendment per Q-Brief-1 = B. Operator ratification 2026-05-25. NEW — SCAFFOLD.16 ships this.
- **LD-9** — SPEC.2 §10 amendments: surgical edits per Q-Brief-2 = A. NOT a §10 rewrite. Operator ratification 2026-05-25.
- **LD-10 — REOPENED 2026-05-26 at /plan opening.** Original brief-time decision: Position A (keep `src/server/moderation/photodna.ts` row in SPEC.2 §10 file map, marked deferred per Q-Brief-3 = B). Operator-directed change to **Position B (complete removal)** for ALL PhotoDNA references in SPEC.1 + SPEC.2 to enforce experiment-phase OpenAI-only posture without optionality-preserving framing. Rationale: experiment-phase scope discipline; PhotoDNA optionality preserved via `docs/parked.md` row only (§G Item 1), not via SPEC framing. If a post-experiment second-vendor stratum revives the path, that stratum re-adds SPEC framing from scratch.

---

## §3 — Phase-0 SURPRISES (6 absorbed at /plan opening)

The first five surfaced during /plan opening + Phase-1 Q-verdict ratification; the sixth surfaced during §F amendment-drafting prep. All six ratified by operator before plan-body drafting began. Hard ceiling locked at 6 finds — additional non-NCMEC, non-PhotoDNA brief-drift items during plan-body drafting would have triggered STOP; none surfaced.

1. **Q2 brief-error correction (parenthetical).** Brief §1.1 item 4 + §5 item 2 both asserted the existing `precommit-moderate::track-a-csam-mapping` test "uses `imageR2Key`" and serves as the image-attached Track A regression. Verified against repo state (`tests/integration/precommit-moderate.integration.test.ts:126-142` + `args()` helper at lines 85-104): the existing test does NOT use `imageR2Key`. Under LD-3, the existing test's input (text-only `sexual/minors: true`) would route to Track B and the existing assertion `expect(result.outcome).toBe("track_a")` would fail. **Resolution: Option β — rename + modify.** Rename existing test to `precommit-moderate::track-a-csam-mapping-with-image`, add `imageR2Key` + `mockSignRead.mockResolvedValueOnce(...)`, update inline comment to cite LD-3. Add new `precommit-moderate::text-only-sexual-minors-routes-track-b` test as explicit counterexample. Test count stays at 13 (12 existing − 1 renamed + 1 renamed + 1 new). Operator ratification 2026-05-26.

2. **SPEC.1 §20-Appendix moderation-category table contradicts LD-1 + LD-3 + LD-7.** Table at lines 1276-1290+ lists per-category sources and tracks; two rows contradict SCAFFOLD.16 LDs: `csam` (hash match) row names "Image — PhotoDNA" with Track A auto-block + auto-report + auto-ban (PhotoDNA deferred per LD-1; auto-report deferred per LD-7); `sexual/minors` row names Track A auto-ban (text-only routes to Track B per LD-3). **Resolution: Position B (strike).** Strike `csam` row entirely; rewrite `sexual/minors` row to Track column "A (image-attached) / B (text-only)" + Notes column reflecting LD-3 carve-out + remove auto-report references entirely. Per §F edit 3 below. Operator ratification 2026-05-26.

3. **SPEC.2 §12.2 line 1112 names PhotoDNA in F-COMMENT-3 step 5.** Line names "OpenAI omni-moderation-2024-09-26 + PhotoDNA run in parallel per ADR-0014 §10". Brief §4 did not enumerate this as an amendment target. **Resolution: Position B (strike).** Rewrite line to "OpenAI omni-moderation-2024-09-26 per ADR-0014 §10." Per §F edit 6 below. Operator ratification 2026-05-26.

4. **SPEC.2 Appendix A file map (lines 2316-2318) names PhotoDNA in two rows.** `precommit.ts` row description names "OpenAI omni-moderation + PhotoDNA + Redis intent reservation"; `photodna.ts` row is the canonical-path placeholder per original Position A. Brief §1.1 item 6 framed the photodna.ts row mark as a "SPEC.2 §10 file map" edit, but the structured file map physically lives in Appendix A (the §10 prose at line 1029 also names photodna.ts as part of the source-of-truth paragraph). **Resolution: Position B (strike everywhere).** Strike `photodna.ts` row from Appendix A entirely; strike `photodna.ts` reference from SPEC.2 §10 line 1029 source-of-truth paragraph; rewrite `precommit.ts` row description to drop "+ PhotoDNA". Per §F edits 4 + 9 below. Operator ratification 2026-05-26.

5. **LD-10 reopened: Position A → Position B.** Brief locked LD-10 as Position A (keep photodna.ts row + mark deferred); operator at /plan opening changed to Position B (complete removal of all PhotoDNA references in SPEC.1 + SPEC.2). Rationale: experiment-phase scope discipline; `docs/parked.md` Item 1 (§G below) is the sole record of PhotoDNA optionality. If a post-experiment second-vendor stratum revives the path, that stratum re-adds SPEC framing from scratch. Operator ratification 2026-05-26.

6. **NCMEC operational-reference strikes (batched as single entry per operator).** During §F drafting prep, SPEC.2 §10 Track A degrade-mode paragraph found to contain the sentence: *"The CSAM auto-report (NCMEC) is unaffected by the degrade."* Under LD-7 (NCMEC deferred to post-experiment), this sentence references functionality that does not exist in experiment phase. Surfaced to operator as a 6th find per hard-ceiling-at-5 discipline. **Resolution: Option γ (strike entirely).** Strike the sentence from §10 Track A degrade paragraph. Default-strike applies to any additional NCMEC operational references encountered during §F drafting per same root cause (ceiling-exempt per operator ratification 2026-05-26). NCMEC inventory grep explicitly skipped per operator instruction; default-strike-on-encounter is the discipline. Per §F edit 5 below. Operator ratification 2026-05-26.

**Ceiling discipline:** non-NCMEC, non-PhotoDNA brief-drift items remain ceiling-eligible. None surfaced during plan-body drafting.

---

## §3.7 — Execute-phase Phase 1 verify-don't-trust SURPRISE (1 event, ceiling 2/6)

Per CLAUDE.md §5 + SCAFFOLD.3-FOLLOWUP-1 lesson 3.1, execute-phase honors the same hard-ceiling-at-6 SURPRISES rule as plan-mode. SURPRISE 7 was absorbed at execute-phase Phase 1 (verify-don't-trust re-grep against current `main` HEAD `6a6b04b` at chat opening 2026-05-26). Three-way split (7a / 7b / 7c) per operator's Q3 refinement: same SURPRISE event, three distinct failure modes worth distinguishing for process learning.

**SURPRISE 7 (one event) — Execute-phase Phase 1 verify-don't-trust find ratification 2026-05-26.**

- **7a — 5 SPEC.1 brief-drift items (Items A–E).** Phase 1 verify-don't-trust re-grep against current `main` HEAD `6a6b04b` surfaced 5 non-NCMEC, non-PhotoDNA brief-drift items in SPEC.1 not enumerated by plan §F. Drift rooted in LD-1 (OpenAI sole vendor) + LD-3 (text/image Track A carve-out): Item A SPEC.1 §14 main moderation matrix row 763 (LD-3 + LD-7); Item B SPEC.1 §14 prose line 759 (LD-1); Item C SPEC.1 §16 Q-table line 1235 Q2 (LD-1); Item D SPEC.1 §20-Appendix preamble line 1276 (LD-1); Item E SPEC.1 §20-Appendix image-classifier rows 1283/1285/1291 (LD-1). All 5 ratified individually by operator 2026-05-26 with verification gates (Item A structural verification of §14 Track labels A/A/B/C; Item B + D + E re-narrowing per authoritative OpenAI `omni-moderation-2024-09-26` capability table; Item C Q-table column-shape verification). Process learning: brief-time scope estimate was off by ~90% on §F amendment count (5 in brief → 9 ratified at /plan → 17 ratified at execute-phase Phase 1). Per §F edits 10–14 above.

- **7b — Plan body §F Edit 4a "After" text factual error (Option 6α correction).** Item E verification (authoritative OpenAI `omni-moderation-2024-09-26` capability table fetched 2026-05-26 from `developers.openai.com/api/docs/guides/moderation`) revealed plan body §F Edit 4a "After" text contained a factual error: claimed "three image categories `omni-moderation` does NOT classify (`hate`, `harassment`, `weapons` on image inputs)" but authoritative table shows 7 text-only categories (`harassment`, `harassment/threatening`, `hate`, `hate/threatening`, `illicit`, `illicit/violent`, `sexual/minors`) and `weapons` is not an OpenAI moderation category at all. Error originated in research brief v1 §1 line 33 (claimed `hate` is image-supported; authoritative source contradicts) and propagated into plan body Edit 4a during /plan opening drafting 2026-05-26. **Option 6α resolution:** correct plan body Edit 4a "After" text in-place per authoritative table; tracked as amendment-note within existing Edit 4 entry, not as separate locus. Research brief frozen at v1; dated errata note appended per Option II as a third commit-2 file change (`docs/briefs/SCAFFOLD.16-technical-research-brief.md`). Process learning: research brief factual claims should be verified against primary docs at /plan opening, not assumed correct.

- **7c — F-ADMIN-4 citation chain structural break (Option F-γ-thin resolution).** Phase 1 Q4 defensive sweep #2 (SPEC.1 §15 F-ADMIN-4 contract review) surfaced that plan body §F Edit 4a "After" text + the re-narrowed Items B/C/D/E + Item E weapons row Notes column all cite "SPEC.1 §15 F-ADMIN-4 reactive removal" as the v1 image-input gap mitigation. F-ADMIN-4's actual contract (lines 882–892) requires upstream Track A/B classification (`Pre: Track B comment exists with review_status = pending`; inline scope is approve Track B / remove Track A/B) — it cannot act on `pass`-verdict content. The cited mitigation mechanism does not exist in §15 today; citation chain structurally broken. **Option F-γ-thin resolution:** extend F-ADMIN-4 with one narrow capability (inline admin removal of pass-verdict comments) per sub-edits 15a–15e + cascade via G2 (extend §14 F-MOD-3 to preserve §14 ↔ §15 moderation-pair internal consistency) + Item G (SPEC.2 §4 Server Action map line 371 description column update). Rationale: image-borne harm content during the 15 Sep – 1 Nov experiment window + ETHGlobal Mumbai public launch is a thesis-violation surface (mandatory-commentary integrity + K_eff demonstration optics) that outweighs the ~1-2 hour scope expansion; documentation honesty + operational adequacy both achieved. F-γ-thin uses H-γ encoding-agnostic phrasing for the `mod_actions` row shape (deferring verdict-enum vs action column vs metadata-field encoding choice to DEBATE.2 caller-side per LD-5) to avoid propagating Item H-1 (long-standing SPEC vs shipped-code drift on `mod_actions` schema; SPEC.1 §1 documents `mod_actions.action` enum but shipped audit.ts has `verdict: modVerdictEnum` only). Item H-1 itself is out-of-scope per LD-5; flagged for DEBATE.2 caller-side reconciliation. Per §F edits 15 + 16 + 17 above + plan body Edit 4a "After" text re-narrowing. Process learning: plan-mode cited-mitigation contracts should be grep'd against their target prose at /plan opening; cited mechanism may not match cited contract's actual scope.

**Ceiling bookkeeping:** SURPRISE 7 (7a + 7b + 7c lumped as one event per Q3 operator refinement) = 1 of 6 execute-phase ceiling. Plan-mode used 6 of 6 (SURPRISES 1–6 absorbed at /plan opening 2026-05-26). Total Phase 0 + execute-phase ceiling consumption: 1 of 6 events; 5 budget remaining for Phases 2–6.

**Defensive sweeps run pre-commit-2** (no Items I+ surfaced, all clean):
- Sweep #3: SPEC.1 §17 acceptance-test catalogue cascade under F-γ-thin → existing rows hold; new sub-edit 15e row slots in without conflict.
- Sweep #4: SPEC.1 §14 F-MOD-1 through F-MOD-5 prose → clean modulo NCMEC ceiling-exempt strike at F-MOD-1 line 772 (already in Phase 4 NCMEC inventory).
- Sweep #5: F-COMMENT-3 cascade SPEC.2 → 15+ hits analyzed; no F-ADMIN-4 coupling found; orthogonal participant-side vs admin-side surfaces.
- Sweep #6: `mod_actions` SPEC inventory → 42 operational references catalogued (18 SPEC.1 + 24 SPEC.2); Item H-1 drift isolated to SPEC.1 lines 62–63; rest aligned with shipped schema.

---

## §A — Scope (6 items per brief §1.1 — Phase-2 execute deliverable)

> Brief §1.1 enumerated 6 items (the kickoff §A summary "5 items" was a count-error; the brief is authoritative). All 6 reproduced verbatim with plan-mode amendments where Q-verdicts or §3 SURPRISES adjusted shape.

1. **Verdict-mapping behavior change** in `src/server/moderation/precommit.ts:112-117`. Gate Track A on `imageR2Key` presence per LD-3. Text-only `sexual/minors === true` routes to Track B. Per Q1 = Option A explicit gate (§C below). ~1 LOC delta in the existing if-else block (§E edit 1).

2. **Comment cleanup at `src/server/moderation/precommit.ts:24-25`.** Strike the stale "SCAFFOLD.16 adds PhotoDNA + Safer in parallel via Promise.all" hook comment. Replace with experiment-phase scope note referencing `docs/parked.md` Item 1 for second-vendor deferral. ~2-3 LOC delta (§E edit 2).

3. **Comment cleanup at `src/server/config/limits.ts:88`.** Strike the "SCAFFOLD.16 adds PhotoDNA / Safer in parallel" suffix on the `OPENAI_MODERATION_MODEL_SNAPSHOT` JSDoc. Replace with neutral experiment-phase posture note. ~1 LOC delta (§E edit 3).

4. **Test surface changes** in `tests/integration/precommit-moderate.integration.test.ts` — per Q2 = Option β resolution (rename + add):
   - **RENAME existing test** `precommit-moderate::track-a-csam-mapping` (lines 126-142) to `precommit-moderate::track-a-csam-mapping-with-image`. Add `imageR2Key: "u/user-1/csam-test.jpg"` to the `args()` call; add `mockSignRead.mockResolvedValueOnce("https://r2.example/u/user-1/csam-test.jpg?X-Amz-Signature=mod");` to the setup; update inline comment to cite LD-3 + new image-presence precondition.
   - **ADD new test** `precommit-moderate::text-only-sexual-minors-routes-track-b`. Text-only input (`imageR2Key` undefined) with `sexual/minors: true` asserts `outcome === "track_b"` and `categories.includes("sexual/minors")`. Mock pattern matches existing tests (`vi.hoisted` + `vi.mock` at module boundary; `mockOpenAiModerate.mockResolvedValueOnce(modResult({...}))`).
   - **Test count stays at 13** (12 existing − 1 renamed + 1 renamed + 1 new = 13).
   - **Test-writer subagent invocation** per CLAUDE.md §5.11 — Phase 2 START (not end). Subagent writes the failing test + applies the rename + modifies the renamed test BEFORE implementation edit lands in `precommit.ts`. Tool scope: Read + Write + Edit (tests only — no `src/` edits).

5. **`docs/parked.md` row additions** — 4 separate H2-headed rows per Q3 = separate + 4-entry (per kickoff alignment; brief enumerated 3 but the kickoff + research brief enumerate 4). Row drafts at §G below.

6. **Same-commit SPEC amendments** at 9 locations per §F below (ENGINE.6 process-improvement #5 — same-commit amendment scope reflex; expanded from brief §4's 5 locations to 9 per §3 SURPRISES 2 + 3 + 4 + 5 + 6).

---

## §B — Out of scope

Combines brief §1.2 (8 surfaces deferred to named owners) + brief §3 (12-row B-verdict list of structural decisions). All retained verbatim from brief; no plan-mode modifications.

### Deferred to named owner strata (brief §1.2)

| Surface | Owner | Reason |
|---|---|---|
| `src/server/moderation/photodna.ts` (file creation) | Post-experiment / launch-blocker resolution stratum | LD-1 deferral; per LD-10 Position B, the canonical-path placeholder is also STRUCK from SPEC framing — `docs/parked.md` Item 1 is the sole record |
| Hive / Sightengine / Safer SDK integration | Same as above | Same |
| `Promise.all` parallel-vendor call shape in `precommit.ts` | Same as above | Same |
| NCMEC CyberTipline API integration | Post-experiment per attorney consultation 2026-05 | LD-7 + `docs/parked.md` Item 2 updated trigger |
| Auto-ban write (`users.banned_at` set on Track A) | DEBATE.2 + future caller strata | LD-6 — caller-side per ADR-0014 + LD-4 unchanged precommit shape |
| `mod_actions` row INSERT on Track A | DEBATE.2 + future caller strata | LD-5 — caller-side per ADR-0014 |
| `openai_moderation_upstream_failure` Sentry tag wiring | SCAFFOLD.5 (Sentry SDK swap stratum) | Tag currently unwired per CC inspection §8; SCAFFOLD.16 does NOT extend the stub surface |
| `photodna_upstream_failure` Sentry tag | **Permanently dropped per LD-10 Position B** | No PhotoDNA vendor in SCAFFOLD.16 scope; tag has no firing site; if second-vendor stratum revives, that stratum re-introduces the tag |
| HARDEN.5 threshold-tuning pass | HARDEN.5 (Sep 1 target per SPEC.1 §16.1) | Number-tuning rule; not SCAFFOLD.16 scope |

### B-verdicts (brief §3 — structural NO's)

| # | Verdict | Reason |
|---|---|---|
| B1 | NO second moderation vendor (Hive / Safer / PhotoDNA) | LD-1 + LD-10 Position B |
| B2 | NO NCMEC CyberTipline reporting | LD-7 + attorney consultation 2026-05 |
| B3 | NO modification to `precommitModerate` return shape | LD-4 — Option (b) caller-side contract |
| B4 | NO `mod_actions` row insertion in `precommit.ts` | LD-5 — caller-side per ADR-0014 |
| B5 | NO `users.banned_at` set in `precommit.ts` | LD-6 — caller-side per LD-4 |
| B6 | NO `csamMatch: boolean` field on `PrecommitResult` | Caller can discriminate via `categories.includes("sexual/minors")` already; no new field needed for OpenAI-only scope |
| B7 | NO new env keys in `.env.example` | No second vendor → no new env keys |
| B8 | NO new constants in `src/server/config/limits.ts` | No second vendor → no new constants |
| B9 | NO new error classes in `src/lib/errors.ts` | Existing `ModerationUnavailableError` + `ModerationInFlightError` cover the OpenAI-only fail-closed surface |
| B10 | NO modification to `src/server/moderation/openai.ts` | OpenAI wrapper is shape-correct for SCAFFOLD.16 scope |
| B11 | NO `tests/server/moderation/_probe-photodna-shape.test.ts` probe | No PhotoDNA vendor → no probe needed |
| B12 | NO touch to `src/server/events/insert.ts` or `schemas.ts` | No new event types in SCAFFOLD.16 (`image_upload.blocked` already registered per ENGINE.6, awaiting DEBATE.2 emit site) |

---

## §C — Decisions ratified at plan-mode opening (Q1–Q6 verdicts)

### Q1 — Verdict-mapping implementation shape. **Verdict: Option A (explicit gate).**

The behavior change at `src/server/moderation/precommit.ts:112-117` uses an explicit ternary inside the existing `if` clause, preserving the two-clause if-else structure:

```ts
// Before (existing code, lines 112-117)
let outcome: PrecommitResult["outcome"] = "pass";
if (result.categories[TRACK_A_CATEGORY] === true) {
  outcome = "track_a";
} else if (flaggedCategories.length > 0) {
  outcome = "track_b";
}

// After (Option A)
let outcome: PrecommitResult["outcome"] = "pass";
if (result.categories[TRACK_A_CATEGORY] === true) {
  outcome = imageR2Key ? "track_a" : "track_b";
} else if (flaggedCategories.length > 0) {
  outcome = "track_b";
}
```

One line changed at the existing decision point. Option B (precompute branch with `hasImage` + `csamFlagged` consts) rejected as larger diff for no clarity gain at this scale. ENGINE.6 LOC-variance lesson satisfied.

### Q2 — `precommit-moderate::text-only-sexual-minors-routes-track-b` test shape. **Verdict: Option β (rename + add).**

The brief framed Q2 as "single happy-path / pair / triple". Phase-1 surfaced the brief-factual-error: the existing `precommit-moderate::track-a-csam-mapping` test does NOT use `imageR2Key` (despite brief §1.1 item 4 parenthetical asserting it does). Under LD-3 the existing test fails. Verdict reframed: Option β (rename + add):
- Rename `precommit-moderate::track-a-csam-mapping` → `precommit-moderate::track-a-csam-mapping-with-image`; add `imageR2Key` + `mockSignRead` mock setup.
- Add new `precommit-moderate::text-only-sexual-minors-routes-track-b` as explicit counterexample.

Test count stays at 13. See §D for full test plan + §3 SURPRISE 1 for the brief-error correction provenance.

### Q3 — `docs/parked.md` row structure. **Verdict: separate rows, 4 entries.**

Brief §1.1 item 5 enumerated 3 entries; kickoff prompt + research brief §"Operator scope decision" both enumerate 4 (the same three plus R-1/R-2/R-3 research-backed improvements deferred to post-experiment hardening). Kickoff post-dates the brief and is operator-authored; aligned to 4 entries. See §G for row drafts.

### Q4 — SPEC.2 §17.2 row 4 cleanup scope. **Verdict: minimal — strike `photodna_upstream_failure` in SPEC.2 §10 fail-closed paragraph, not §17.2 row 4 prose.**

Row 4 in §17.2 (line 1592) only names `openai_moderation_auth_failure`. The `photodna_upstream_failure` tag is named in SPEC.2 §10 fail-closed paragraph (line 1023) where the tag list is enumerated. Per Position B (LD-10 reopen) the strike happens in §10 prose; row 4 itself stays unchanged. See §F edit 4 + edit 7.

### Q5 — SPEC.1 §17 amendment scope. **Verdict: minimal — 1 row marked deferred + 1 new row added.**

Mixed-family interim state is INTENDED, not an oversight. Post-SCAFFOLD.16 §17 will carry 11 `moderation::*` rows (10 unchanged + 1 marked deferred) + 1 new `precommit-moderate::*` row. Full sweep (rename all `moderation::*` rows) deferred to future SPEC.1 hygiene task per CF-3.

Per LD-10 Position B (reopen): the row marking is **not** a soft-defer marker but a complete-strike-and-replace amendment. Original recommended marking was "(deferred to launch — see docs/parked.md)" suffix; under Position B the row is rewritten or struck. See §F edit 2 for the final shape.

### Q6 — Branch hygiene. **Verdict: cut `plan/scaffold-16` off `origin/main` HEAD `6a6b04b`.**

`git fetch origin main` at /plan opening showed `d5be518..6a6b04b` (SCAFFOLD.17 post-merge-log chore PR #51 merged 2026-05-26). Branch cut from `6a6b04b`. Local `chore/scaffold-17-post-merge-log` branch (still at `ff9c679`) superseded by origin/main's squash-merge of the same content; operator can delete at leisure.

---

## §D — Test plan

| Layer | Scenarios | Invariants asserted (§2 invariants) |
|---|---|---|
| Unit (Vitest, `tests/unit/`) | None — SCAFFOLD.16 changes are integration-style verdict-mapping behavior, not pure-function unit logic. The verdict-mapping branch is exercised through the existing integration suite. | None |
| Integration (Vitest + module-mock, `tests/integration/`) | +1 new test + 1 renamed test in `tests/integration/precommit-moderate.integration.test.ts` per Q2 = β | None (no INV-1/2/3/4 directly touched; SCAFFOLD.16 is a verdict-mapping change inside an existing moderation client, no DB writes, no transaction boundaries) |
| E2E (Playwright) | None — no UI surface in SCAFFOLD.16 | None |

### Test 1 — RENAME + MODIFY `precommit-moderate::track-a-csam-mapping` → `precommit-moderate::track-a-csam-mapping-with-image`

File: `tests/integration/precommit-moderate.integration.test.ts` lines 126-142.

Changes:
- Rename: `it("precommit-moderate::track-a-csam-mapping", ...)` → `it("precommit-moderate::track-a-csam-mapping-with-image", ...)`.
- Add `imageR2Key: "u/user-1/csam-test.jpg"` to the `args()` call: `const { a } = args({ text: "blocked content", imageR2Key: "u/user-1/csam-test.jpg", idempotencyKey: "idem-a" });`.
- Add `mockSignRead.mockResolvedValueOnce("https://r2.example/u/user-1/csam-test.jpg?X-Amz-Signature=mod");` to the setup (between the existing `mockRedis.del.mockResolvedValueOnce(1);` and `mockOpenAiModerate.mockResolvedValueOnce(...)` lines).
- Update inline comment: replace the existing "REFUSAL-2 (CSAM legal floor): 'sexual/minors' true → track_a, REGARDLESS of other flagged categories also being true. Verifies the 'sexual/minors' branch wins ordering even when sexual is also true." with: "REFUSAL-2 (CSAM legal floor): 'sexual/minors' true + image attached → track_a per SCAFFOLD.16 LD-3 carve-out. Text-only `sexual/minors: true` routes to Track B; image-attached routes to Track A. This test covers the image-attached positive branch; `precommit-moderate::text-only-sexual-minors-routes-track-b` covers the text-only counterexample. Verifies the 'sexual/minors' branch wins ordering even when sexual is also true."
- Assertion unchanged: `expect(result.outcome).toBe("track_a"); expect(result.categories).toContain("sexual/minors");`.

Estimated diff: ~6 LOC modified (1 rename, 1 args() arg added, 1 mockSignRead line added, ~3 comment lines).

### Test 2 — ADD new test `precommit-moderate::text-only-sexual-minors-routes-track-b`

File: `tests/integration/precommit-moderate.integration.test.ts`. Insertion point: between current line 142 (end of `track-a-csam-mapping`) and line 144 (start of `track-b-sexual-not-minors`). Keeps the verdict-mapping tests clustered.

Test body (mock pattern matches existing `vi.hoisted` + `vi.mock` discipline):

```ts
it("precommit-moderate::text-only-sexual-minors-routes-track-b", async () => {
  // SCAFFOLD.16 LD-3 carve-out: text-only `sexual/minors: true` routes to
  // Track B (admin review), NOT Track A (auto-ban). Image-attached path
  // tested at `precommit-moderate::track-a-csam-mapping-with-image`. The
  // carve-out mitigates text-classifier false-positive risk for the CSAM
  // category in line with industry practice (Bluesky, Roblox, Reddit all
  // route text-only CSAM-adjacent signals to specialized human review).
  // Research-brief finding: `sexual/minors` is text-only on
  // omni-moderation-2024-09-26 at the model level — image input always
  // returns score 0 for this category.
  const { a } = args({ text: "blocked content", idempotencyKey: "idem-text-only-csam" });
  mockRedis.set.mockResolvedValueOnce("OK");
  mockRedis.del.mockResolvedValueOnce(1);
  mockOpenAiModerate.mockResolvedValueOnce(
    modResult({ "sexual/minors": true, sexual: true }),
  );

  const result = await precommitModerate(a);

  expect(result.outcome).toBe("track_b");
  expect(result.categories).toContain("sexual/minors");
  expect(mockSignRead).not.toHaveBeenCalled(); // text-only — no R2 fetch
});
```

Estimated diff: ~25 LOC added.

### Test-writer subagent invocation (Phase 2 START, per CLAUDE.md §5.11)

The execute chat invokes the test-writer subagent BEFORE implementation edit in `precommit.ts` lands. Three required prompt elements per CLAUDE.md §5.11:

1. **Explicit role briefing:** name `.claude/agents/test-writer.md` + instruct to load + follow verbatim.
2. **Plan path:** `@docs/plans/SCAFFOLD.16.md` (this file).
3. **Tool-scope constraint:** "Read, Write, Edit (tests only — `src/` is off-limits), Bash, Grep, Glob. Do NOT modify any file under `src/`."

Expected output: test file diff + coverage map per the subagent briefing's "Output format" section. The new test MUST fail before the implementation edit lands (LD-3 carve-out not yet implemented → `outcome === "track_a"` for text-only csam input → assertion fails).

---

## §E — Code-change plan

Three edits. Total LOC delta: ~10-15 across `src/`.

### Edit 1 — `src/server/moderation/precommit.ts:112-117` — Q1 = Option A verdict-mapping change

```ts
// Before (current lines 112-117)
let outcome: PrecommitResult["outcome"] = "pass";
if (result.categories[TRACK_A_CATEGORY] === true) {
  outcome = "track_a";
} else if (flaggedCategories.length > 0) {
  outcome = "track_b";
}

// After (Option A — explicit gate)
let outcome: PrecommitResult["outcome"] = "pass";
if (result.categories[TRACK_A_CATEGORY] === true) {
  outcome = imageR2Key ? "track_a" : "track_b";
} else if (flaggedCategories.length > 0) {
  outcome = "track_b";
}
```

One line changed (line 114).

### Edit 2 — `src/server/moderation/precommit.ts:24-25` — comment cleanup

```ts
// Before (current lines 23-25)
//   5. Map verdict: 'sexual/minors' → track_a (REFUSAL-2 CSAM legal floor);
//      any other flagged → track_b; none → pass.
//
// SCAFFOLD.16 adds PhotoDNA + Safer in parallel via `Promise.all`; the
// caller-facing return shape (`{ outcome, categories }`) stays unchanged.

// After (experiment-phase scope; second-vendor deferred per docs/parked.md)
//   5. Map verdict per SCAFFOLD.16 LD-3:
//      - 'sexual/minors' true + imageR2Key → track_a (REFUSAL-2 CSAM legal
//        floor, image-attached path);
//      - 'sexual/minors' true + no imageR2Key → track_b (text-only carve-out;
//        admin review mitigates text-classifier false-positive risk);
//      - any other flagged → track_b;
//      - none → pass.
//
// OpenAI omni-moderation is the SOLE moderation vendor in experiment phase.
// Second-vendor (PhotoDNA / Safer / Hive) deferred — see docs/parked.md
// "SCAFFOLD.16 §6 — Second moderation vendor deferred" for resolution path.
```

~5 LOC modified (replace 2-line PhotoDNA comment with ~8-line experiment-phase scope note + LD-3 verdict-mapping documentation).

### Edit 3 — `src/server/config/limits.ts:88` — JSDoc cleanup

```ts
// Before (current line 88)
/** OpenAI moderation model snapshot pin. Per SPEC.2 §10.10 + ADR-0014 — pinning the snapshot guarantees verdict-mapping stability across OpenAI model retunes. SCAFFOLD.16 adds PhotoDNA / Safer in parallel. */

// After (experiment-phase scope; SCAFFOLD.16 PhotoDNA framing dropped per LD-10 Position B)
/** OpenAI moderation model snapshot pin. Per SPEC.2 §10 + ADR-0014 — pinning the snapshot guarantees verdict-mapping stability across OpenAI model retunes. OpenAI omni-moderation is the SOLE moderation vendor in experiment phase per SCAFFOLD.16 LD-1; second-vendor deferred per docs/parked.md. */
```

One JSDoc line modified.

### Reviewer-call cascade (per CLAUDE.md §5.11)

After Edit 1-3 land + Test 1-2 land + §F amendments land + pre-PR self-audit per CLAUDE.md §5.10:

1. **`code-reviewer` subagent** — Read-only review of `src/server/` diff (`src/server/moderation/precommit.ts` + `src/server/config/limits.ts`). Tool scope: Read, Grep, Glob, Bash only — no Edit / Write. Briefing: `.claude/agents/code-reviewer.md`. Plan path: this file. Surface: findings ranked CRITICAL / HIGH / MEDIUM / LOW with `file:line` references.
2. **`security-auditor` subagent** — Critical-path review (moderation is CLAUDE.md §1 critical path). Same read-only tool-scope. Briefing: `.claude/agents/security-auditor.md`. Plan path: this file. Surface: INV-1/INV-2/INV-3/INV-4 enforcement gaps + refusal-trigger crossings + structural-separation violations.

**Skip `db-migration-reviewer`** — no schema or migration changes in SCAFFOLD.16 (B12).
**`test-writer` already invoked at Phase 2 START** per §D above.

---

## §F — Same-commit doc amendments (17 SPEC amendment locations)

Per Position B (LD-10 reopen) + 6th-find γ-strike + NCMEC default-strike. Originally locked at 9 per operator at /plan opening 2026-05-26; expanded to 17 per Phase-1 verify-don't-trust find ratification 2026-05-26 (Items A–E SPEC.1 brief-drift items + F-γ-thin SPEC.1 §15 F-ADMIN-4 amendment with sub-edits a–e + G2 SPEC.1 §14 F-MOD-3 cascade extension + Item G SPEC.2 line 371 Server Action map description column update). Edit 4a "After" text additionally corrected per Option 6α (image-input gap category enumeration) + re-narrowed per F-γ-thin citation chain in-place (tracked as amendment-note within the existing Edit 4 entry, not as a separate locus). See §3 SURPRISE 7 (7a/7b/7c) and §I provenance subsection "Brief drift caught at execute-phase Phase 1 verify-don't-trust".

### Edit 1 — `docs/specs/SPEC.1.md` §16.5 bullet 5 (line 1010)

```markdown
// Before
- **PhotoDNA + reporting compliance.** CSAM hash service onboarded pre-launch. Auto-report to NCMEC (or jurisdictional equivalent) on Track A CSAM detection.

// After
- **CSAM detection + reporting compliance.** Experiment-phase posture: OpenAI `sexual/minors` classifier (text-only per `omni-moderation-2024-09-26`) routes text-only flags to Track B (admin review) and image-attached flags to Track A (auto-ban) per SCAFFOLD.16 LD-3. Dedicated CSAM-hash vendor and NCMEC auto-report deferred to post-experiment per attorney consultation 2026-05; see `docs/parked.md` "SCAFFOLD.16 §6 — Second moderation vendor deferred" and "SCAFFOLD.16 §6 — NCMEC CyberTipline reporting deferred". Pre-launch resolution gated on incorporation + attorney sign-off.
```

Position B strike of "PhotoDNA" from bullet title + body; explicit experiment-phase posture; cross-reference to `docs/parked.md` rows as sole record of optionality.

### Edit 2 — `docs/specs/SPEC.1.md` §17 (acceptance-test catalogue, lines 1129-1139)

Two amendments. Mixed-family interim state intended (per operator pre-Phase-1 ack + Q5 verdict).

**Amendment 2a — strike the `moderation::photodna-csam-match-shortcircuits-openai` row (line 1139) entirely.** Per LD-10 Position B (no soft-defer markers): the row is struck, not marked deferred. Operator's pre-Phase-1 framing ("11 moderation::* + 1 new precommit-moderate::*" mixed family) is updated under LD-10 reopen to "10 moderation::* + 1 new precommit-moderate::*" — the PhotoDNA row is removed entirely, consistent with Position B everywhere. Operator's "mixed family is intended interim state" framing still holds; the count changes from 11 to 10.

```markdown
// Before (line 1139)
| `moderation::photodna-csam-match-shortcircuits-openai` | ADR-0014 §3 | — |

// After
(row removed entirely)
```

**Amendment 2b — add new row for the SCAFFOLD.16 carve-out test.** Insert after the existing `moderation::openai-terminal-failure-fails-closed` row (which becomes line 1138 post-Amendment-2a):

```markdown
| `precommit-moderate::text-only-sexual-minors-routes-track-b` | SCAFFOLD.16 LD-3 (text/image Track A carve-out) | — |
```

Post-SCAFFOLD.16 §17 state: **10 `moderation::*` rows** (was 11; one struck) + **1 new `precommit-moderate::*` row** = 11 total moderation-domain rows. Mixed family (`moderation::*` + `precommit-moderate::*`) is intended interim per CF-3.

The renamed test (`precommit-moderate::track-a-csam-mapping-with-image`) does NOT get a SPEC.1 §17 row — §17 is contract-level, not test-file-name-level; the original `precommit-moderate::track-a-csam-mapping` was never in §17, and the renamed test inherits that absence.

### Edit 3 — `docs/specs/SPEC.1.md` §20-Appendix moderation-category table (lines 1280-1281)

Per §3 SURPRISE 2 + Position B (strike, no deferred markers).

**Amendment 3a — strike `csam` row entirely:**

```markdown
// Before (line 1280)
| `csam` (hash match) | Image — PhotoDNA | A | Auto-block + auto-report + auto-ban. Legal floor. |

// After
(row removed entirely)
```

**Amendment 3b — rewrite `sexual/minors` row:**

```markdown
// Before (line 1281)
| `sexual/minors` | Text — OpenAI | A | Auto-block + auto-ban. No product fit. |

// Wait — actual current text per repo grep (line 1281):
| `sexual/minors` | Text — OpenAI | A | Auto-block + auto-report + auto-ban. |

// After (LD-3 carve-out + Position B strike of auto-report reference)
| `sexual/minors` | Text — OpenAI | A (image-attached) / B (text-only) | Image-attached: auto-block + Track A auto-ban contract (caller-side per SCAFFOLD.16 LD-6). Text-only: Track B (admin review via `/admin/moderation`) per SCAFFOLD.16 LD-3 — text-classifier false-positive mitigation. Per research-brief finding, `sexual/minors` is text-only on `omni-moderation-2024-09-26` at the model level (image input returns score 0 for this category); the carve-out aligns with what the classifier can actually attribute. |
```

### Edit 4 — `docs/specs/SPEC.2.md` §10 prose (multi-paragraph surgical Position B strikes)

Five paragraph-level edits across SPEC.2 §10 (lines 1005, 1017, 1021, 1023, 1029).

**Edit 4a — Vendor selection paragraph (line 1005):** strike "PhotoDNA-or-equivalent for CSAM hash matching, called in parallel on every image-attached submit." entirely. Rewrite the surrounding clause to (combined Option 6α image-input gap category correction + F-γ-thin H-γ encoding-agnostic citation re-narrowing per Phase-1 verify-don't-trust find ratification 2026-05-26): "OpenAI `omni-moderation-latest` (snapshot-pinned `omni-moderation-2024-09-26`) for text and multimodal classification — the SOLE moderation vendor for the experiment phase. **No second image-classifier vendor in experiment phase** — `omni-moderation-latest` covers the violence (including `violence/graphic`), self-harm (including `self-harm/intent` and `self-harm/instructions`), and `sexual` (non-minors) image categories natively, and is free of charge per OpenAI Help Center as of May 2026. The `harassment`, `harassment/threatening`, `hate`, `hate/threatening`, `illicit`, `illicit/violent`, and `sexual/minors` categories accept text inputs only per OpenAI's `omni-moderation-2024-09-26` capability table. The 6 non-CSAM text-only categories form an accepted v1 image-input gap (omni-moderation-2024-09-26 limitation, not a Zugzwang design choice); operational mitigation via SPEC.1 §15 F-ADMIN-4 extended scope (per SCAFFOLD.16 F-γ-thin: admin inline removal of pass-verdict comments); empirical measurement via HARDEN.5 sample-content testing. `sexual/minors` is also text-only but is routed per the SCAFFOLD.16 LD-3 carve-out (text-only → Track B admin review; `imageR2Key`-present escalation → Track A), not as an accepted v1 gap. `weapons` is not an OpenAI moderation category; weapon-policy content moderation relies on F-ADMIN-4 end-to-end. **Second-vendor (PhotoDNA / Safer / Hive) optionality deferred per SCAFFOLD.16 LD-1 → `docs/parked.md`.**"

**Edit 4b — Track A carve-out paragraph (NEW, insert after Vendor selection paragraph):** add a paragraph documenting LD-3:

> **Track A image-presence carve-out (SCAFFOLD.16 LD-3).** Text-only `sexual/minors === true` flags route to Track B (admin review) rather than Track A (auto-ban). Image-attached `sexual/minors === true` flags route to Track A. Rationale: text-classifier false-positive risk for the CSAM-adjacent category is elevated by news/fiction/educational content vectors; admin-review mitigation aligns with industry practice (Bluesky, Roblox, Reddit). At the model level, `sexual/minors` is text-only on `omni-moderation-2024-09-26` per OpenAI docs (image input returns score 0 for this category); the carve-out is therefore aligned with classifier capability, not just policy. Post-experiment hardening recommendations (R-1 predicate strengthening, R-2 verdict-shape expansion, R-3 retry-policy expansion) deferred per `docs/parked.md` "SCAFFOLD.16 §research — R-1/R-2/R-3 hardening".

**Edit 4c — "No Postgres transaction" paragraph (line 1017):** strike "and PhotoDNA":

```markdown
// Before
**No Postgres transaction is held across an HTTP call (`REFUSAL:` per CLAUDE.md golden rules + SPEC.2 §9 + ADR-0013 §8).** OpenAI and PhotoDNA HTTP calls happen in steps 3–4, fully outside any database transaction.

// After
**No Postgres transaction is held across an HTTP call (`REFUSAL:` per CLAUDE.md golden rules + SPEC.2 §9 + ADR-0013 §8).** OpenAI HTTP calls happen in steps 3–4, fully outside any database transaction.
```

**Edit 4d — strike PhotoDNA HTTP call shape paragraph entirely (line 1021):**

```markdown
// Before (full paragraph)
**PhotoDNA HTTP call shape.** Called in parallel with OpenAI on image-attached submits. Same 3-second-timeout / one-retry / fail-closed posture. A `csam_match` result short-circuits the verdict to Track A regardless of the OpenAI verdict. Exact wire shape owned by SCAFFOLD.16 (vendor onboarding).

// After
(paragraph removed entirely)
```

**Edit 4e — "Failure mode: fail-closed" paragraph (line 1023):** strike PhotoDNA references + "either call" framing:

```markdown
// Before
**Failure mode: fail-closed.** On terminal failure of either call (after retry), the handler emits a Sentry custom event (`openai_moderation_upstream_failure` or `photodna_upstream_failure` per §17 alarm 4 — see §17.2 master table row 4 for the full alarm catalogue entry), releases the Redis reservation, writes no `mod_actions` row, writes no bet/comment row, and returns HTTP 503 `moderation_unavailable` with `Retry-After: 5`. This mirrors the idempotency-fails-closed posture in §11; it does **not** mirror the rate-limit-fails-open posture, because a moderation outage that fails open is a legal-floor breach for CSAM categories per SPEC.1 §16.5.

// After
**Failure mode: fail-closed.** On terminal failure of the OpenAI call (after retry), the handler emits a Sentry custom event (`openai_moderation_upstream_failure` per §17 alarm 4 — see §17.2 master table row 4 for the full alarm catalogue entry), releases the Redis reservation, writes no `mod_actions` row, writes no bet/comment row, and returns HTTP 503 `moderation_unavailable` with `Retry-After: 5`. This mirrors the idempotency-fails-closed posture in §11; it does **not** mirror the rate-limit-fails-open posture, because a moderation outage that fails open is a legal-floor breach for CSAM categories per SPEC.1 §16.5.
```

Position B strike of `photodna_upstream_failure` tag reference + rewrite of "either call" to "the OpenAI call". `openai_moderation_upstream_failure` retained (still awaits SCAFFOLD.5 wiring; out of SCAFFOLD.16 scope).

**Edit 4f — "Single source of truth" paragraph (line 1029):** strike `photodna.ts` reference:

```markdown
// Before
**Single source of truth.** `src/server/moderation/precommit.ts` owns the function, the verdict shape, the OpenAI + PhotoDNA call orchestration, the Redis reservation lifecycle, the Sentry emission, and the constants (`OPENAI_MODERATION_MODEL_SNAPSHOT`, `OPENAI_TIMEOUT_MS`, `OPENAI_MAX_RETRIES`, `RESERVATION_KEY_PREFIX`, `RESERVATION_TTL_SECONDS`). Vendor-specific HTTP wrappers live in `src/server/moderation/openai.ts` and `src/server/moderation/photodna.ts`. The full file map is absorbed into Appendix A on its drafting pass.

// After
**Single source of truth.** `src/server/moderation/precommit.ts` owns the function, the verdict shape, the OpenAI call orchestration, the Redis reservation lifecycle, the Sentry emission, and the constants (`OPENAI_MODERATION_MODEL_SNAPSHOT`, `OPENAI_TIMEOUT_MS`, `OPENAI_MAX_RETRIES`, `RESERVATION_KEY_PREFIX`, `RESERVATION_TTL_SECONDS`). The OpenAI-specific HTTP wrapper lives in `src/server/moderation/openai.ts`. The full file map is absorbed into Appendix A on its drafting pass.
```

### Edit 5 — `docs/specs/SPEC.2.md` §10 Track A degrade-mode paragraph (line 1027) — NCMEC sentence γ-strike

Per §3 SURPRISE 6 (NCMEC operational-reference strike, Option γ).

```markdown
// Before (current paragraph, NCMEC sentence bolded for visibility)
**Track A degrade mode (HARDEN.5 trigger).** SPEC.1 §14 F-MOD-1 (auto-ban on Track A) and §14 preamble both label the auto-ban as `provisional` pending Aug 15–31 sample-content testing. If HARDEN.5 surfaces unacceptably high false-positive rates, Track A degrades to **flag-only mode**: content blocked, `mod_actions` written, user **not** banned, admin reviews queue and bans manually via SPEC.1 §15 F-ADMIN-4. **The CSAM auto-report (NCMEC) is unaffected by the degrade.** The degrade decision is owned by HARDEN.5 and ratified via a follow-up ADR or HARDEN.5 close-out memo at that time.

// After (NCMEC sentence struck entirely; surrounding context unchanged)
**Track A degrade mode (HARDEN.5 trigger).** SPEC.1 §14 F-MOD-1 (auto-ban on Track A) and §14 preamble both label the auto-ban as `provisional` pending Aug 15–31 sample-content testing. If HARDEN.5 surfaces unacceptably high false-positive rates, Track A degrades to **flag-only mode**: content blocked, `mod_actions` written, user **not** banned, admin reviews queue and bans manually via SPEC.1 §15 F-ADMIN-4. The degrade decision is owned by HARDEN.5 and ratified via a follow-up ADR or HARDEN.5 close-out memo at that time.
```

One sentence struck; surrounding context unchanged.

### Edit 6 — `docs/specs/SPEC.2.md` §12.2 line 1112 — F-COMMENT-3 step 5 PhotoDNA strike

```markdown
// Before
5. **Server runs full §11 handler stack including §10 multimodal moderation.** The moderation step calls `precommitModerate()` with a multimodal input array (text + image_url with a 60-second signed R2 read URL minted at §12.4); OpenAI omni-moderation-2024-09-26 + PhotoDNA run in parallel per ADR-0014 §10.

// After
5. **Server runs full §11 handler stack including §10 multimodal moderation.** The moderation step calls `precommitModerate()` with a multimodal input array (text + image_url with a 60-second signed R2 read URL minted at §12.4); OpenAI omni-moderation-2024-09-26 per ADR-0014 §10.
```

Position B strike of "+ PhotoDNA run in parallel"; no soft-defer marker.

### Edit 7 — `docs/specs/SPEC.2.md` §17.2 row 4 (line 1592) — no edit needed

Per Q4 verdict: row 4 only names `openai_moderation_auth_failure`; the `photodna_upstream_failure` strike happens in §10 prose (Edit 4e above), not row 4.

This is enumerated as one of the 9 amendment locations for traceability — the explicit no-op decision is itself part of the same-commit amendment scope discipline (per ENGINE.6 process improvement #5: enumerate ALL parallel concerns even when the verdict is "no change here").

### Edit 8 — `docs/specs/SPEC.2.md` §22.2 line 2175 — stale "cron infrastructure at SCAFFOLD.16" framing

```markdown
// Before (within the SCAFFOLD-phase table row's "F-* files gated" column)
... image upload pipeline at SCAFFOLD.15; cron infrastructure at SCAFFOLD.16; flag system at SCAFFOLD.6 ...

// After
... image upload pipeline at SCAFFOLD.15; experiment-phase moderation hardening at SCAFFOLD.16 (Track A image-presence carve-out per LD-3); flag system at SCAFFOLD.6 ...
```

Stratum-description drift correction. SCAFFOLD.16 current scope is moderation hardening, not cron (cron infrastructure landed at SCAFFOLD.15 R2 orphan-sweep + SCAFFOLD.17 pg_cron low-watermark).

### Edit 9 — `docs/specs/SPEC.2.md` Appendix A file map (lines 2316-2318)

Two amendments per Position B (LD-10 reopen + §3 SURPRISE 4).

**Amendment 9a — drop "+ PhotoDNA" from precommit.ts row description (line 2316):**

```markdown
// Before
| `src/server/moderation/precommit.ts` | `precommitModerate()` orchestration (OpenAI omni-moderation + PhotoDNA + Redis intent reservation) | §10 |

// After
| `src/server/moderation/precommit.ts` | `precommitModerate()` orchestration (OpenAI omni-moderation + Redis intent reservation) | §10 |
```

**Amendment 9b — strike `photodna.ts` row entirely (line 2318):**

```markdown
// Before
| `src/server/moderation/photodna.ts` | PhotoDNA HTTP wrapper | §10 |

// After
(row removed entirely)
```

Per LD-10 reopen Position B: no soft-defer marker, no path-name preservation. `docs/parked.md` Item 1 (§G) is the sole record.

---

### Edits 10–17 — Phase-1 verify-don't-trust amendments (operator-ratified 2026-05-26)

The following 8 edits surfaced during execute-phase Phase 1 verify-don't-trust re-grep against current `main` HEAD `6a6b04b`. All ratified individually by operator per the same discipline as plan-mode §3 SURPRISE absorption. See §3 SURPRISE 7 (7a/7b/7c) and §I provenance "Brief drift caught at execute-phase Phase 1 verify-don't-trust" subsection.

### Edit 10 — `docs/specs/SPEC.1.md` §14 main moderation matrix row 763 (Item A) — LD-3 carve-out + NCMEC strike

Split single Track A row into image-attached Track A + text-only Track B per LD-3; strike "auto-report (legal)" NCMEC reference per LD-7.

```markdown
// Before (line 763, single Track A row)
| **A** | CSAM, sexual minors | Block + auto-report (legal) + auto-ban user | No |

// After (two rows replacing the single row; existing rows 764-766 shift down by 1)
| **A** | `sexual/minors` (image-attached) | Block + auto-ban user. Per SCAFFOLD.16 LD-3 image-attached path. | No |
| **B** | `sexual/minors` (text-only) | Hide from public; admin review queue at `/admin/moderation`. Per SCAFFOLD.16 LD-3 text-only carve-out (text-classifier false-positive mitigation; industry practice per research brief). | Yes |
```

NCMEC auto-report sentence struck per Position B / LD-7. CSAM-hash row reframed away from PhotoDNA dependency.

### Edit 11 — `docs/specs/SPEC.1.md` §14 prose line 759 (Item B) — LD-1 vendor + image-input gap framing

Strike PhotoDNA + "general adult/violence/weapons classifier, vendor TBD" framing per LD-1; cite authoritative `omni-moderation-2024-09-26` capability table; cite F-γ-thin operational mitigation.

```markdown
// Before (line 759)
Three tracks at submission. Two AI services run in parallel: text (OpenAI moderation API) and image (CSAM hash via PhotoDNA-or-equivalent + general adult/violence/weapons classifier, vendor TBD).

// After
Three tracks at submission. OpenAI omni-moderation (text + multimodal; snapshot-pinned `omni-moderation-2024-09-26` per ADR-0014) is the SOLE moderation vendor in experiment phase per SCAFFOLD.16 LD-1. The `harassment`, `harassment/threatening`, `hate`, `hate/threatening`, `illicit`, `illicit/violent`, and `sexual/minors` categories accept text inputs only per OpenAI's `omni-moderation-2024-09-26` capability table. The 6 non-CSAM text-only categories form an accepted v1 image-input gap (omni-moderation-2024-09-26 limitation, not a Zugzwang design choice); operational mitigation via SPEC.1 §15 F-ADMIN-4 extended scope (per SCAFFOLD.16 F-γ-thin: admin inline removal of pass-verdict comments); empirical measurement via HARDEN.5 sample-content testing. `sexual/minors` is also text-only but is routed per the SCAFFOLD.16 LD-3 carve-out (text-only → Track B admin review; `imageR2Key`-present escalation → Track A), not as an accepted v1 gap. `weapons` is not an OpenAI moderation category; weapon-policy content moderation relies on F-ADMIN-4 end-to-end. Second-vendor optionality (Hive / PhotoDNA / Safer) and NCMEC CyberTipline reporting both deferred to post-experiment per `docs/parked.md`.
```

### Edit 12 — `docs/specs/SPEC.1.md` §16 Q-table line 1235 (Item C) — Q2 resolution per LD-1

Mark Q2 resolved per LD-1; Default column carries resolution text (Q-table has 5 cols, no Status column).

```markdown
// Before (line 1235)
| Q2 | Image classifier vendor (Rekognition / Sightengine / Hive) | TBD; selected via implementation pass. | Engineering implementation pass | Before launch |

// After
| Q2 | Image classifier vendor (Rekognition / Sightengine / Hive) | Resolved per SCAFFOLD.16 LD-1: OpenAI omni-moderation is the SOLE moderation vendor in experiment phase; image-classifier gap (6 text-only categories per `omni-moderation-2024-09-26` capability table) is an accepted v1 gap. Operational mitigation: SPEC.1 §15 F-ADMIN-4 extended scope (per SCAFFOLD.16 F-γ-thin); empirical measurement: HARDEN.5. Second-vendor optionality deferred per `docs/parked.md`. | Hrishikesh (resolved at SCAFFOLD.16) | Resolved 2026-05-26 |
```

### Edit 13 — `docs/specs/SPEC.1.md` §20-Appendix preamble line 1276 (Item D) — LD-1 vendor framing rewrite

Strike PhotoDNA + general image classifier TBD framing per LD-1; parallel phrasing to Edit 11.

```markdown
// Before (line 1276)
Source vendors: OpenAI moderation API (text), PhotoDNA-or-equivalent (image hash for CSAM), general image classifier TBD (adult / violence / weapons).

// After
Source vendor: OpenAI omni-moderation (text + multimodal; snapshot-pinned `omni-moderation-2024-09-26`) is the SOLE moderation vendor in experiment phase per SCAFFOLD.16 LD-1. The `harassment`, `harassment/threatening`, `hate`, `hate/threatening`, `illicit`, `illicit/violent`, and `sexual/minors` categories accept text inputs only per `omni-moderation-2024-09-26`'s capability table. The 6 non-CSAM text-only categories form an accepted v1 image-input gap (omni-moderation-2024-09-26 limitation, not a Zugzwang design choice); operational mitigation via SPEC.1 §15 F-ADMIN-4 extended scope (per SCAFFOLD.16 F-γ-thin: admin inline removal of pass-verdict comments); empirical measurement via HARDEN.5 sample-content testing. `sexual/minors` is also text-only but is routed per the SCAFFOLD.16 LD-3 carve-out (text-only → Track B admin review; `imageR2Key`-present escalation → Track A), not as an accepted v1 gap. `weapons` is not an OpenAI moderation category; weapon-policy content moderation relies on F-ADMIN-4 end-to-end. Second-vendor optionality deferred per `docs/parked.md`.
```

### Edit 14 — `docs/specs/SPEC.1.md` §20-Appendix image-classifier rows (Item E) — Source-layer rewrite per LD-1

Three rows in moderation-category table at lines 1283, 1285, 1291. Rewrite Source-layer column to reflect authoritative `omni-moderation-2024-09-26` capability table (verified at execute-phase Item E verification via OpenAI docs 2026-05-26).

```markdown
// Before (lines 1283, 1285, 1291)
| `nsfw` / adult imagery | Image — classifier | A | Auto-block + auto-ban. No product fit. |
| `violence` (image) | Image — classifier | B | Admin review. |
| `weapons` | Image — classifier | B | Admin review. Edges: weapon-policy markets. |

// After
| `nsfw` / adult imagery | Image — OpenAI (`sexual` category, image inputs supported per `omni-moderation-2024-09-26`) | A | Auto-block + auto-ban. No product fit. |
| `violence` (image) | Image — OpenAI (`violence` category, image inputs supported per `omni-moderation-2024-09-26`) | B | Admin review. |
| `weapons` | Image — N/A (`weapons` is not an OpenAI moderation category; SPEC.1 §15 F-ADMIN-4 extended scope per SCAFFOLD.16 F-γ-thin mitigates) | B | Admin review. Edges: weapon-policy markets. |
```

### Edit 15 — `docs/specs/SPEC.1.md` §15 F-ADMIN-4 contract extension (F-γ-thin) — five sub-edits a–e

Per Phase-1 verify-don't-trust Item F operator ratification 2026-05-26: F-γ-thin extends F-ADMIN-4 with one narrow capability — inline admin removal of pass-verdict comments — to mitigate the v1 image-input gap (image-borne harm content omni-moderation cannot classify) during the 15 Sep – 1 Nov experiment window + ETHGlobal Mumbai public launch. Documentation honesty + operational adequacy both achieved without expanding F-ADMIN-4's user-ban semantics.

**Sub-edit 15a — extend "System" bullet action list (lines 885–887 area).** Current reads "Two actions available: Approve user / Block user". After F-γ-thin:

```markdown
// After (System bullet)
- **System.** Admin reviews comment context (text, image, AI flag categories with confidence, user pseudonym, user Dharma, user prior-flag count). Three actions available:
  - **Approve user** — comment restored to public view, user untouched, flag closed and logged in `mod_actions`.
  - **Block user** — comment stays hidden, user banned (Track A mechanics per `E2`), flag closed and logged.
  - **Remove pass-verdict comment** — comment hidden from public view; an append-only audit row is written recording the removal (exact `mod_actions` row shape — verdict-enum value, action column, or metadata field — determined by caller-side stratum per LD-5; DEBATE.2 owns INSERT semantics). `users.banned_at` NOT set (admin escalates via separate Block user action if user-level enforcement needed). Covers image-borne harm content omni-moderation-2024-09-26 cannot classify (text-only categories on image inputs; weapons-imagery).
```

**Sub-edit 15b — extend "Surface — inline" bullet** to cover pass-verdict removal. Append to existing sentence:

```markdown
Pass-verdict comments also render with admin-only Remove button (no badge — comment appears normally to admin same as to public, with Remove button visible only to admin). Removal mechanic identical to Track A/B inline removal; gated on admin role.
```

**Sub-edit 15c — extend "Inline scope explicitly" bullet** to cover pass-verdict removal:

```markdown
// After
- **Inline scope explicitly:** approve a Track B pending comment, remove a Track A or Track B comment, remove a pass-verdict comment (per SCAFFOLD.16 F-γ-thin). Nothing else. No "ban user" button on the comment author's pseudonym (banning is hub-only — accessed via the moderation queue or a user-record action). No "trigger resolution" button on the market header. No bulk-select.
```

**Sub-edit 15d — split "Pre" bullet** into two pre-conditions:

```markdown
// After
- **Pre (Approve/Block path).** Track B comment exists with `review_status = pending`.
- **Pre (Remove pass-verdict path).** Any comment with `outcome === 'pass'` exists on a market the admin is viewing.
```

**Sub-edit 15e — add new §17 acceptance-test row**:

```markdown
| `f-admin-4::pass-verdict-removal` | §15 F-ADMIN-4 (per SCAFFOLD.16 F-γ-thin) | — |
```

Insertion point: after existing F-ADMIN-4 rows at SPEC.1 §17 lines 1144–1147.

### Edit 16 — `docs/specs/SPEC.1.md` §14 F-MOD-3 cascade extension (G2)

Per operator Q3 G2 disposition: extend F-MOD-3 to acknowledge the new Remove pass-verdict action, maintaining §14 ↔ §15 moderation-pair internal consistency (F-MOD-3 documents the decision contract; F-ADMIN-4 surfaces the operational mechanic).

```markdown
// Before (lines 780–783)
### F-MOD-3 — Admin Approve / Block decision

- **System.** **Approve user**: comment restored to public view, user untouched, flag closed and logged. **Block user**: comment stays hidden, user banned (Track A mechanics), flag closed and logged. No appeal. No middle option (no warn-and-restore, no edit-and-resubmit) in v1. Two surfaces, same backend: the hub queue at `/admin/moderation` (two buttons per row) and the inline affordance on debate views (per F-ADMIN-4 in §15). Both paths call the same endpoint, write the same `mod_actions` row, and apply the same audit discipline.
- **Acceptance.** `tests/server/moderation/track-b.test.ts::approve-and-block-paths`.

// After (per SCAFFOLD.16 F-γ-thin + G2 cascade extension)
### F-MOD-3 — Admin Approve / Block / Remove pass-verdict decision

- **System.** **Approve user**: comment restored to public view, user untouched, flag closed and logged. **Block user**: comment stays hidden, user banned (Track A mechanics), flag closed and logged. **Remove pass-verdict (per SCAFFOLD.16 F-γ-thin)**: comment hidden from public view; an append-only audit row is written recording the removal (exact `mod_actions` row shape — verdict-enum value, action column, or metadata field — determined by caller-side stratum per LD-5; DEBATE.2 owns INSERT semantics). `users.banned_at` NOT set (admin escalates via separate Block user action if user-level enforcement needed). Covers image-borne harm content omni-moderation-2024-09-26 cannot classify (text-only categories on image inputs; weapons-imagery). No appeal. No middle option (no warn-and-restore, no edit-and-resubmit) in v1. All three actions land at the same surfaces: the hub queue at `/admin/moderation` (three buttons per row for pending/applicable comments) and the inline affordance on debate views (per F-ADMIN-4 in §15). All paths call the same endpoint, write the same `mod_actions` row, and apply the same audit discipline.
- **Acceptance.** `tests/server/moderation/track-b.test.ts::approve-and-block-paths`, `f-admin-4::pass-verdict-removal` (per SCAFFOLD.16 F-γ-thin sub-edit 15e).
```

### Edit 17 — `docs/specs/SPEC.2.md` §4 Server Action map line 371 (Item G) — F-γ-thin cascade

Update description column to acknowledge third action (Remove pass-verdict) per F-γ-thin cascade.

```markdown
// Before (line 371)
| `moderateComment(input)` | F5 | `src/server/admin/moderation/act.ts` | Approve / Block buttons on hub queue + inline market view | F-ADMIN-4 |

// After
| `moderateComment(input)` | F5 | `src/server/admin/moderation/act.ts` | Approve / Block / Remove pass-verdict buttons on hub queue + inline market view (per SCAFFOLD.16 F-γ-thin) | F-ADMIN-4 |
```

### Same-commit amendment count summary

| # | File | Section / line | Edit type |
|---|---|---|---|
| 1 | `docs/specs/SPEC.1.md` | §16.5 bullet 5 (line 1010) | Rewrite (Position B + experiment-phase carve-out) |
| 2 | `docs/specs/SPEC.1.md` | §17 (line 1139 strike + new row insert) | Strike + add (mixed family intended interim) |
| 3 | `docs/specs/SPEC.1.md` | §20-Appendix moderation-category table (line 1280 strike + line 1281 rewrite) | Strike + rewrite (LD-3 carve-out + Position B) |
| 4 | `docs/specs/SPEC.2.md` | §10 prose (lines 1005 + 1017 + 1021 + 1023 + 1029) | Multi-paragraph surgical Position B strikes + LD-3 carve-out paragraph add |
| 5 | `docs/specs/SPEC.2.md` | §10 Track A degrade paragraph (line 1027) | NCMEC sentence γ-strike |
| 6 | `docs/specs/SPEC.2.md` | §12.2 line 1112 | Strike "+ PhotoDNA run in parallel" |
| 7 | `docs/specs/SPEC.2.md` | §17.2 row 4 (line 1592) | No-op (explicit no-edit decision per Q4) |
| 8 | `docs/specs/SPEC.2.md` | §22.2 line 2175 | Stratum-description drift correction |
| 9 | `docs/specs/SPEC.2.md` | Appendix A file map (lines 2316 + 2318) | Description strike + row strike (Position B) |
| 10 | `docs/specs/SPEC.1.md` | §14 main moderation matrix row 763 | Split into image-attached A + text-only B per LD-3; strike NCMEC auto-report (Item A) |
| 11 | `docs/specs/SPEC.1.md` | §14 prose line 759 | Vendor framing rewrite per LD-1 + F-γ-thin H-γ citation (Item B) |
| 12 | `docs/specs/SPEC.1.md` | §16 Q-table line 1235 (Q2) | Mark Q2 resolved per LD-1 (Item C) |
| 13 | `docs/specs/SPEC.1.md` | §20-Appendix preamble line 1276 | Vendor framing rewrite per LD-1 + F-γ-thin H-γ citation (Item D) |
| 14 | `docs/specs/SPEC.1.md` | §20-Appendix image-classifier rows (lines 1283, 1285, 1291) | Source-layer column rewrite per LD-1 + authoritative OpenAI table (Item E) |
| 15 | `docs/specs/SPEC.1.md` | §15 F-ADMIN-4 prose (lines 882–892) + §17 acceptance-test row insert | F-γ-thin contract extension; sub-edits a–e (inline admin removal of pass-verdict comments + new §17 row `f-admin-4::pass-verdict-removal`) |
| 16 | `docs/specs/SPEC.1.md` | §14 F-MOD-3 prose (lines 780–783) | G2 cascade extension: add Remove pass-verdict to decision contract (§14 ↔ §15 internal consistency) |
| 17 | `docs/specs/SPEC.2.md` | §4 Server Action map line 371 | Description column update: 2 buttons → 3 buttons (Item G, F-γ-thin cascade) |

**Total: 17 SPEC amendment locations across 2 SPEC files.** (Originally 9 plan-ratified at /plan opening 2026-05-26; expanded to 17 per Phase-1 verify-don't-trust find ratification 2026-05-26 — Items A–E SPEC.1 brief-drift items + F-γ-thin SPEC.1 §15 F-ADMIN-4 amendment + G2 SPEC.1 §14 F-MOD-3 cascade extension + Item G SPEC.2 line 371 description column update. Edit 4a "After" text additionally corrected per Option 6α + re-narrowed per F-γ-thin citation chain in-place, tracked as amendment-note within existing Edit 4 entry not as separate locus.)

---

## §G — `docs/parked.md` row drafts (4 rows)

Each row follows the existing `docs/parked.md` convention (H2 header: `## <STRATUM> §<section> — <short title>`; fields: **Originating task / Deferred work / Why deferred / Conditional trigger / Expected next task**, with optional **Code touch points** / **Mechanic candidates** where applicable). Insertion point: end of file (after existing 6 rows).

### Row 1 — Second moderation vendor deferred

```markdown
## SCAFFOLD.16 §6 — Second moderation vendor deferred (Hive / PhotoDNA / Safer)

**Originating task:** SCAFFOLD.16 §6 (vendor research summary) + LD-1.

**Deferred work.** Introduce a second moderation vendor for CSAM hash matching (PhotoDNA-or-equivalent: PhotoDNA / Safer / Hive AI / equivalent). Add `src/server/moderation/photodna.ts` (or vendor-specific path) HTTP wrapper. Wire parallel `Promise.all` call in `precommitModerate()`. Reintroduce SPEC.1 + SPEC.2 framing for the second vendor (struck from SPEC framing per SCAFFOLD.16 LD-10 Position B).

**Why deferred.** Vendor-research round (2026-05-25) evaluated four CSAM-detection vendors: PhotoDNA (Microsoft) — gated multi-week vetting; Safer (Thorn) — gated 8-12 week onboarding; Hive AI CSAM Detection — rep-mediated 1-5 business days; Sightengine — does NOT offer CSAM-specific detection (only general moderation + "Child Detection" presence-of-minors signal, not exploitation material). No vendor in the CSAM-detection category offers truly instant self-serve API access. Operator scope decision 2026-05-25: defer all four to post-experiment or pre-launch; use OpenAI `omni-moderation`'s existing `sexual/minors` category as experiment-phase CSAM-proxy detection. LD-10 reopen 2026-05-26: Position B (complete removal of all PhotoDNA references from SPEC framing) — this `docs/parked.md` row is the sole record of optionality.

**Conditional trigger.** Operator decides to add a second vendor before or after launch. If pre-launch: Hive's rep-mediated onboarding (1-5 business days) is the fastest path. Filing the Hive contact form preserves optionality without committing.

**Expected next task.** Dedicated `MOD-VENDOR-SECOND` stratum (TBD) — re-adds SPEC.1 + SPEC.2 framing from scratch + adds vendor-specific wrapper + wires `Promise.all` call in `precommitModerate()`.

**Code touch points** (forward reference, do not act on now): `src/server/moderation/precommit.ts:24` (experiment-phase comment block points here); `src/server/config/limits.ts:88` (OpenAI snapshot pin comment points here); SPEC.1 §16.5 bullet 5 (experiment-phase carve-out points here); SPEC.2 §10 (vendor selection paragraph experiment-phase clause points here).
```

### Row 2 — NCMEC reporting deferred

```markdown
## SCAFFOLD.16 §6 — NCMEC CyberTipline reporting deferred

**Originating task:** SCAFFOLD.16 §6 (legal-floor framing) + LD-7.

**Deferred work.** Integrate NCMEC CyberTipline API for auto-report on confirmed CSAM detection (Track A path). Build pipeline that emits the report payload (account details, manually-reviewed media reference, timestamps) per NCMEC schema. Wire confirmation handling on report submission.

**Why deferred.** Resolution trigger: post-experiment per attorney consultation 2026-05. Integration ships post-incorporation. Attorney engagement confirmed deferral of NCMEC integration for the 7-week experiment window. Original brief framing was "launch-blocker before Sep 15"; updated per attorney consultation to post-experiment + post-incorporation timeline.

**Conditional trigger.** Post-experiment + post-incorporation + attorney sign-off on NCMEC integration scope.

**Expected next task.** Dedicated `MOD-NCMEC-INTEGRATION` stratum (TBD, post-experiment). Coupled with the second-vendor stratum if a hash-match vendor lands first (NCMEC reports typically reference hash-match evidence; a hash-match vendor is the upstream of the NCMEC report).

**Mechanic candidates** (carried for the future stratum): NCMEC CyberTipline API direct integration; intermediary platform (some vendors offer NCMEC reporting as a bundled service); manual report workflow (admin reviews flagged content + files via NCMEC web portal). Operator decision deferred to attorney sign-off + the future stratum kickoff.
```

### Row 3 — Track A text/image asymmetry (LD-3 design record)

```markdown
## SCAFFOLD.16 §1.1 — Track A text/image asymmetry rationale (LD-3 design record)

**Originating task:** SCAFFOLD.16 §1.1 + LD-3.

**Deferred work.** Re-evaluate the Track A image-presence carve-out (LD-3) after experiment-phase data lands. If text-only `sexual/minors` Track B routing creates admin-queue burden disproportionate to legitimate-content volume, or if false-negative rates from the carve-out surface real CSAM-adjacent content evading auto-ban, the carve-out may need revisiting (tighten to score-floor + category-combination per R-1, or revert to text-only auto-ban with stricter false-positive mitigation).

**Why deferred.** LD-3 is the SCAFFOLD.16 design decision; this row preserves the rationale for future re-litigation. Rationale at decision time (2026-05-25 operator + 2026-05-25 research-brief findings):
1. **Structural alignment with model capability:** `sexual/minors` is text-only on `omni-moderation-2024-09-26` per OpenAI docs — image input always returns score 0 for this category. The carve-out aligns with what the classifier can actually attribute, not just a policy nuance.
2. **Industry practice:** Bluesky (1,154 NCMEC reports/2024, all manually-reviewed), Roblox Sentinel (recall-over-precision, all flags route to ex-FBI/CIA reviewers), Reddit (CSAM removal is hash-driven with human verification before NCMEC) all route text-only CSAM-adjacent signals to specialized human review regardless of score.
3. **False-positive risk profile:** text-only `sexual/minors === true` has elevated false-positive rate from news/fiction/educational content vectors; auto-ban on text-only signal is not done by any public production pipeline.
4. **Experiment-phase scope discipline:** simplest possible Track A predicate (`imageR2Key !== undefined && categories['sexual/minors'] === true`) over defense-in-depth (R-1 score floor + category combination) — operator decision 2026-05-25 to "keep it simple and easy to implement but fully operational — its just the experiment phase — I want no scoring — just a simple detect + block + ban."

**Conditional trigger.** Experiment-phase data analysis (post-Nov 6 2026 dataset release) surfaces either elevated text-only false-positive admin-burden OR elevated image-attached false-negative escape rate. HARDEN.5 sample-content testing (Aug 15-31) is the first formal evaluation gate; post-experiment data is the second.

**Expected next task.** Either HARDEN.5 close-out memo (if thresholds adjusted in pre-launch hardening) or post-experiment hardening stratum (if revisited post-Nov 6).
```

### Row 4 — R-1/R-2/R-3 research-backed improvements deferred

```markdown
## SCAFFOLD.16 §research — R-1/R-2/R-3 hardening recommendations deferred to post-experiment

**Originating task:** SCAFFOLD.16 technical research brief `SCAFFOLD.16-technical-research-brief.md` §"Operator scope decision" — operator chose Option (A) "Hold scope" 2026-05-25.

**Deferred work.** Three research-backed Stage-1 hardening recommendations:

- **R-1 — Track A predicate hardening.** Strengthen Track A predicate from boolean (`imageR2Key !== undefined && categories['sexual/minors'] === true`) to concurrent-signal AND: `imageR2Key !== undefined && categories['sexual/minors'] === true && categories['sexual'] === true && scores['sexual/minors'] >= 0.5 && category_applied_input_types['sexual/minors'].length > 0`. Three concurrent signals reduce false-positive base rate.

- **R-2 — Verdict-shape audit-defensibility expansion.** Add `triggeringModalities`, `rawScores`, `modelSnapshot`, `moderationCallMs` fields to `PrecommitResult`. Caller (DEBATE.2 etc.) writes these to the `mod_actions` row for audit defensibility. Do NOT add a `shouldAutoBan` boolean (encoded already in `outcome === 'track_a'`; parallel boolean creates drift risk).

- **R-3 — Retry policy expansion.** Expand `OPENAI_MAX_RETRIES` from 1 → 2 and `OPENAI_TIMEOUT_MS` from 3000 → 5000 with explicit handling of OpenAI's `invalid_image_url` error (HTTP 400 with `code: "invalid_image_url"` for R2→OpenAI transient image-fetch failures). Surfaces transient failures the current 3s budget sees as terminal.

**Why deferred.** Operator decision at SCAFFOLD.16 brief-drafting close 2026-05-25: "keep it simple and easy to implement but fully operational — its just the experiment phase — I want no scoring — just a simple detect + block + ban." Experiment phase is 7 weeks, expected volume is low (50K images / 7 weeks ≈ 0.5/min average — well under OpenAI Tier 1's effective ~6.94 RPM ceiling), false-positive cost is bounded (admin unban via existing F-ADMIN-* surfaces). Simplicity over defense-in-depth for this phase.

**Conditional trigger.** False-positive rates from real usage data, OR HARDEN.5 sample-content testing (Aug 15-31) surfaces a problem the simple-boolean predicate can't handle, OR a near-miss CSAM escape that R-1's defense-in-depth would have caught.

**Expected next task.** Post-experiment hardening stratum (TBD) OR HARDEN.5 close-out memo if pre-launch hardening absorbs.
```

---

## §H — Carry-forwards (6 items per brief §7)

- **CF-1 — Second-vendor onboarding (operator-side application filing).** If operator decides to add a second vendor before or after launch, the onboarding application clock starts at the decision time. Hive's rep-mediated onboarding (1-5 business days) is the fastest path; PhotoDNA + Safer are multi-week. Action item for operator (out of SCAFFOLD.16 scope): file the Hive contact form if pre-launch vendor integration is plausible. Filing does not commit to using Hive — it preserves optionality. `docs/parked.md` Row 1 (§G) is the canonical resolution-path record.

- **CF-2 — NCMEC reporting (attorney + post-incorporation).** Attorney consultation 2026-05 confirmed deferral. Resolution trigger updated to post-experiment + post-incorporation. `docs/parked.md` Row 2 (§G) is the canonical resolution-path record. Operator-side actions (post-incorporation): attorney sign-off on NCMEC integration scope, file the future stratum.

- **CF-3 — Test-naming convention sweep (SPEC.1 §17 hygiene).** Per LD-8 + Q5: SPEC.1 §17 has 10 `moderation::*` rows post-SCAFFOLD.16 (was 11; one struck per Edit 2); shipped tests use `precommit-moderate::*` and `openai-omni-shape::*`. SCAFFOLD.16 amends minimally (1 strike + 1 add); the broader sweep (rename all `moderation::*` rows to match shipped test families, OR document which rows are SPEC-aspirational vs. shipped-with-different-name) is a future SPEC.1 hygiene task. Flag for next SPEC.1 sweep — NOT a launch-blocker.

- **CF-4 — Test-writer subagent briefing observability.** The test-writer subagent's documented "Test naming" guidance (`.claude/agents/test-writer.md` lines 43-45) cites SPEC.1 §17's `<area>::<scenario>` convention. With LD-8 (test-naming convention is shipped-code-canonical), the subagent briefing may need a future amendment to acknowledge the convention drift. Flag for next AGENTS.md / `.claude/agents/` sweep — NOT a SCAFFOLD.16 concern.

- **CF-5 — `photodna.ts` file row preservation (CLOSED by LD-10 Position B).** Original brief CF-5 framed the `src/server/moderation/photodna.ts` canonical-path row as preserved in SPEC.2 §10 file map with "(deferred to launch — see docs/parked.md)" marker. LD-10 reopen at /plan opening 2026-05-26 changes this to Position B (complete removal). File row STRUCK from SPEC.2 Appendix A (Edit 9b) + §10 prose (Edit 4f). If a future second-vendor stratum revives the path, that stratum re-adds SPEC framing from scratch. Vendor-specific path naming (e.g., `hive.ts` if Hive becomes the pick) deferred to that stratum's kickoff. CF-5 **CLOSED** by LD-10 Position B.

- **CF-6 — Branch hygiene from SCAFFOLD.17 (CLOSED).** Brief flagged `chore/scaffold-17-post-merge-log` as one log-only commit ahead of main. Chore PR #51 merged to main 2026-05-26 at `6a6b04b`. SCAFFOLD.16 work proceeds against `main` HEAD `6a6b04b`. CF-6 **CLOSED**.

---

## §I — Provenance

### Input briefs

- `SCAFFOLD.16-plan-mode-brief.md` (v1, 552 lines, MD5 `4698d41100695ffa58040de001063823`). Drafted by Web Claude, SCAFFOLD.16 brief-drafting chat 2026-05-25. Three identical copies in `~/Downloads/` (verified by MD5). Authoritative source for LD-1 through LD-10 (original framing; LD-10 reopened at /plan opening per below), Q-list, B-verdicts, scope boundaries, same-commit amendment scope (original 5-location enumeration; expanded to 9 per §3 SURPRISES + LD-10 reopen).
- `SCAFFOLD.16-technical-research-brief.md` (180 lines). Sibling artifact. Empirical backing for the vendor-deferral decision (4 vendors evaluated) + text/image carve-out validation (OpenAI omni-moderation modality asymmetry). §"Operator scope decision" confirms Option (A) Hold scope; R-1/R-2/R-3 are deliberate deferrals.

### Predecessor logs / specs / ADRs consumed

- `docs/specs/SPEC.1.md` v1.7.0-draft — §14 (Moderation), §16.5 (Compliance), §17 (Acceptance Tests), §20 change log + post-§20 Appendix moderation-category table.
- `docs/specs/SPEC.2.md` v0.3-draft — §10 (Pre-Commit Moderation Contract), §12 (File Storage), §17.2 + §17.3 (alarm catalogue), §22.2 (SCAFFOLD-phase parallel-execution clearance), Appendix A (file map).
- ADR-0014 (substance in SPEC.2 §0.1 line 38–40 + SPEC.2 §10 lines 999-1033; no separate file per `project_adr_catalogue_framing` memory). ADR-0014 itself is **unamended by SCAFFOLD.16** — the ADR still ratifies PhotoDNA-or-equivalent; SCAFFOLD.16 defers the experiment-phase implementation per LD-1.
- `docs/logs/ENGINE.6.md` (487 lines, PR #49). Process improvements #5 (same-commit amendment scope reflex) + #6 (verify-don't-trust on lint dismissals) carried forward.
- `docs/logs/SCAFFOLD.17.md` (304 lines) + `docs/logs/SCAFFOLD.17-post-merge.md` (116 lines). Brief-vs-shipped-code reconciliation lesson (CC repo inspection is source of truth, NOT brief narrative framing) carried forward.
- `docs/plans/SCAFFOLD.17.md` (577 lines). Plan-shape precedent: §0 top metadata + §1 LDs + §2 Q-resolutions + §3 SURPRISES + §A-§F substance. SCAFFOLD.16 uses §1 LDs + §3 SURPRISES + §A-§I substance per kickoff explicit structure.
- `docs/plans/SCAFFOLD.15.md` (639 lines). Brief-wording-bug flag carry-forward: "SCAFFOLD.16 does NOT add the moderation client; SCAFFOLD.15 already shipped it" + AVIF support flag for SCAFFOLD.16 plan-mode (absorbed via R-1/R-2/R-3 docs/parked.md row).
- `docs/plans/_template.md` (157 lines). Template framing: Status/Date/Author header + Tracker context + Approach + Open questions + ADRs needed + Self-critique + References.
- Tracker v10 entry (operator-maintained external HTML per user-memory `project_tracker_external` — no inline paste).
- CC repo inspection report `/tmp/scaffold-16-repo-inspection.md` (2026-05-25, 2,292 lines). 12 sections + SURPRISE inventory; brief was drafted against this report's ground-truth state.

### Plan-mode chat history (Phase 0 → Phase 2)

- **Phase 0 (2026-05-26).** CC read 8 inputs (briefs + ADR-0014 substance + SPEC.1 §16.5 + SPEC.1 §17 + SPEC.2 §10/§17.2/§17.3/§22.2/Appendix A + CLAUDE.md + AGENTS.md + shipped code). Confirmed read. Surfaced small observation: SPEC.1 §17 mixed-family interim state (10 `moderation::*` + 1 new `precommit-moderate::*` post-SCAFFOLD.16) — operator ratified as intended interim, cleanup queued per CF-3.
- **Phase 1 (2026-05-26).** Q1-Q6 surfaced. Q2 raised as separate sub-part due to load-bearing brief-error (parenthetical "which uses imageR2Key" was wrong; existing test does NOT use imageR2Key). Q2 resolved as Option β (rename + add). Q1, Q3, Q4, Q5, Q6 bundled with brief recommendations. Q3 count corrected from 3 to 4 entries per kickoff alignment. Q4 locus corrected (strike in SPEC.2 §10 fail-closed paragraph, not §17.2 row 4 prose). Q5 renamed test gets no §17 row (§17 is contract-level not file-name-level). All five ratified.
- **Phase 2 (2026-05-26).** /plan opening greps surfaced 4 load-bearing SURPRISES + 1 ceiling-honored 6th find:
  - SURPRISE-2: SPEC.1 §20-Appendix moderation table contradicts LD-1 + LD-3 + LD-7. Resolution: Position B strikes.
  - SURPRISE-3: SPEC.2 §12.2 line 1112 PhotoDNA reference. Resolution: strike.
  - SURPRISE-4: SPEC.2 Appendix A file map PhotoDNA references. Resolution: strike + LD-10 locus correction.
  - LD-10 reopen: brief Position A (keep + mark deferred) → operator-directed Position B (complete removal). Rationale: experiment-phase scope discipline; `docs/parked.md` Item 1 is sole record.
  - 6th-find: SPEC.2 §10 Track A degrade paragraph NCMEC sentence. Resolution: Option γ strike. NCMEC default-strike applies to additional refs encountered during §F drafting; NCMEC inventory grep explicitly skipped per operator.
  - Plus the Phase-1 Q2 brief-error correction = 6 total SURPRISES batched as §3.
  - Hard ceiling at 6 finds locked. Non-NCMEC, non-PhotoDNA brief-drift items remain ceiling-eligible; none surfaced during plan-body drafting.

### Operator ratifications

- Vendor pick: OpenAI-only (Choice 3) — 2026-05-25
- Text/image carve-out: Reading 1 — 2026-05-25
- Auto-ban contract: Option (b) caller-side — 2026-05-25
- Test-naming: Option B (`precommit-moderate::*`) — 2026-05-25
- SPEC.2 §10 amendment scope: Option A (surgical) — 2026-05-25
- `photodna.ts` file map row: Option B (keep, mark deferred) — 2026-05-25 [SUPERSEDED 2026-05-26 by LD-10 reopen]
- R-1/R-2/R-3 hardening: Option (A) Hold scope — 2026-05-25
- Q1 (verdict-mapping shape) = Option A — 2026-05-26
- Q2 (test shape) = Option β (rename + add) — 2026-05-26
- Q3 ( `docs/parked.md` rows) = separate rows, 4 entries — 2026-05-26
- Q4 (SPEC.2 §17.2 cleanup) = minimal — 2026-05-26
- Q5 (SPEC.1 §17 scope) = minimal — 2026-05-26
- Q6 (branch hygiene) = cut off `origin/main` HEAD `6a6b04b` — 2026-05-26
- §3 SURPRISE 2 resolutions (Position B strikes for SPEC.1 §20-Appendix table) — 2026-05-26
- §3 SURPRISE 3 resolution (SPEC.2 §12.2 line 1112 strike) — 2026-05-26
- §3 SURPRISE 4 resolution (SPEC.2 Appendix A file map strikes + §10 prose strike) — 2026-05-26
- LD-10 reopen: Position B (complete removal) for ALL PhotoDNA refs in SPEC.1 + SPEC.2 — 2026-05-26
- §F amendment count locked at 9 — 2026-05-26
- 6th-find: Option γ strike + NCMEC default-strike-on-encounter + NCMEC inventory grep skipped — 2026-05-26
- Plan-body §A-§I structure approved (kickoff explicit overlay on plan_template.md scaffolding) — 2026-05-26

### Brief drift caught at plan opening

- Brief §1.1 item 4 + §5 item 2 parenthetical "(which uses `imageR2Key`)" on the existing `precommit-moderate::track-a-csam-mapping` test was a factual error. Verified at repo state: the existing test does NOT use `imageR2Key`. Operator acknowledged the brief-time assumption error (cited test name without verifying against inspection file). Resolution: Q2 reframed from "single vs pair vs triple" to "rename + add" (Option β).
- Brief §4 same-commit amendment scope enumerated 5 SPEC locations. /plan opening greps surfaced 3 additional load-bearing SPEC amendment targets (SPEC.1 §20-Appendix + SPEC.2 §12.2 line 1112 + SPEC.2 Appendix A file map). Locked at 9 per operator + LD-10 Position B.
- Brief LD-10 originally locked Position A (keep `photodna.ts` row in SPEC.2 §10 file map, mark deferred). Operator reopened at /plan opening 2026-05-26 → Position B (complete removal of all PhotoDNA references in SPEC.1 + SPEC.2). Rationale: experiment-phase scope discipline; `docs/parked.md` Item 1 sole record.
- NCMEC operational references in SPEC framing: brief did not enumerate. NCMEC default-strike applies during §F drafting per operator ratification 2026-05-26 (ceiling-exempt; same root cause as 6th-find).

### Brief drift caught at execute-phase Phase 1 verify-don't-trust

Sibling subsection added per Phase-1 verify-don't-trust find ratification 2026-05-26 (SURPRISE 7a/7b/7c — see §3.7). Three failure-mode root causes worth distinguishing for process learning.

**7a failure-mode root cause — brief-time scope estimate dramatically underestimated SPEC.1 amendment fan-out.** Brief §4 enumerated 5 SPEC amendment locations; /plan opening greps surfaced 4 more → 9 ratified at /plan opening 2026-05-26; execute-phase Phase 1 verify-don't-trust re-grep surfaced 5 more → 17 ratified 2026-05-26. Cumulative scope expansion: brief → /plan ratification: +80%; /plan → execute-phase ratification: +89%; brief → execute-phase: +240%. Each expansion ratified individually with operator verification gates. **Process learning:** brief-time scope estimates on cross-document amendment fan-out (e.g., LD-1 "OpenAI sole vendor" + LD-3 "text/image carve-out" implications) should not be treated as upper bounds; /plan opening greps + execute-phase verify-don't-trust greps are both necessary scope-discovery passes.

**7b failure-mode root cause — research brief factual claim propagated into plan body without primary-source verification.** Research brief v1 §1 line 33 stated "image inputs are supported only for `violence`, `violence/graphic`, `sexual`, `self-harm` (including `intent`/`instructions`), and `hate`". Authoritative source (OpenAI Moderation Guide at `developers.openai.com/api/docs/guides/moderation`, fetched at execute-phase Item E verification 2026-05-26) lists 7 text-only categories including `hate`. Brief was wrong about `hate`. Plan body §F Edit 4a inherited the brief's category enumeration and propagated it as "three image categories `omni-moderation` does NOT classify (`hate`, `harassment`, `weapons` on image inputs)" — three errors compounded into one: (i) wrong count (7 text-only, not 3); (ii) wrong list (missing illicit, illicit/violent, sexual/minors); (iii) wrong taxonomy claim (`weapons` is not an OpenAI moderation category at all). Caught at execute-phase Item E verification when operator gated Item E on authoritative citation; cascaded to Item B + Item D + Item E + plan body Edit 4a "After" text correction per Option 6α. **Process learning:** research brief factual claims (especially per-category capability tables for external vendors) should be verified against primary docs at /plan opening, not assumed correct. Plan-mode CC's verify-before-claiming-done discipline (CLAUDE.md §5.7) should extend to all empirical claims absorbed from briefs into plan bodies.

**7c failure-mode root cause — plan-mode cited-mitigation contract not grep'd against target prose.** Plan body §F Edit 4a "After" text cited "SPEC.1 §15 F-ADMIN-4 reactive removal" as the v1 image-input gap mitigation. Items B/C/D/E inherited the citation. F-ADMIN-4's actual contract at SPEC.1 §15 lines 882–892 requires upstream Track A/B classification (`Pre: Track B comment exists with review_status = pending`; inline scope is approve Track B / remove Track A/B). The cited mitigation mechanism does not exist in §15 today; citation chain structurally broken. Caught at execute-phase Phase 1 Q4 defensive sweep #2 (F-ADMIN-4 contract review). Operator chose Option F-γ-thin: extend F-ADMIN-4 with narrow new capability (inline admin removal of pass-verdict comments) to align cited mechanism with actual mitigation. Cascade: G2 (§14 F-MOD-3 extension) + Item G (SPEC.2 §4 Server Action map description column). **Process learning:** plan-mode CC's cited-mitigation references (e.g., "mitigated by F-ADMIN-X reactive removal") should be grep'd against the cited contract's actual prose at /plan opening; cited mechanism's scope may not match the citing context's claim. Particularly important for §14 ↔ §15 ↔ §20-Appendix moderation-domain cross-references where decision-contracts (§14 F-MOD-*) and operational-surfaces (§15 F-ADMIN-*) live in different sections and drift independently.

**Item H-1 close-out documentation (long-standing SPEC vs shipped-code drift on `mod_actions` schema; predates SCAFFOLD.16).** Discovered during Phase 1 Item H bundled sweep 2026-05-26. SPEC.1 §1 glossary lines 62–63 documents `mod_actions.action ∈ {csam_blocked, nsfw_auto_banned}` (Track A) and `∈ {flagged, approved, blocked}` (Track B); shipped `src/db/schema/audit.ts` has NO `action` column — has `verdict: modVerdictEnum("verdict", ["pass", "track_a", "track_b"])` instead. Long-standing SPEC vs code drift. Out-of-scope for SCAFFOLD.16 per LD-5 (`mod_actions` INSERT is caller-side; DEBATE.2 caller-side stratum owns the schema reconciliation at INSERT-site shipping time). F-γ-thin uses H-γ encoding-agnostic phrasing to avoid propagating Item H-1 into new SPEC.1 §15 / §14 prose. Flagged for DEBATE.2 caller-side reconciliation.

**42-locus `mod_actions` SPEC inventory (close-out reference for DEBATE.2 future-reader; from Phase 1 Sweep #6).**

SPEC.1 (18 operational hits, excluding historical change-log line 1268): lines 62, 63 (Item H-1 drift source — glossary `mod_actions.action ∈ {...}` framing); 64, 68 (glossary Track C absence + Mod-action log → table); 136, 181, 189, 1002 (§5 + §16.4 append-only discipline); 772, 782 (§14 F-MOD-1 + F-MOD-3 mod_actions writes); 816, 886, 888 (§15 admin centre + F-ADMIN-4 prose); 897, 994, 1204 (§15 F-ADMIN-5 + §16 catalogue + §17 deferred public-log); 911, 914 (§15 Control Centre boundary statements).

SPEC.2 (24 operational hits, excluding historical change-log lines 40 + 43): line 373 (§4 F-ADMIN-5 audit-log search); 471 (§5 mod_actions Bucket A row); 505, 1801 (Bucket A list + §19 Bucket-A table row 7); 548, 685, 1217 (ADR-0014 consumption); 595, 738, 754 (§5 / §7 SQL + current-state writes lists); 1015, 1023, 1027, 1115 (§10 / §12 Track A/B mod_actions writes); 1141 (§12 audit-trail integrity rationale); 1156 (§12 reconciliation invariant); 1247 (§13 four pure-read flows); 1698 (§18 insider-threat residual mitigations); 1739 (§18 admin-actor no-FK encoding); 1843 (§20 metadata.ip strip); 1880 (§20 mod_actions.user_id pseudonym scrub); 2269 (Appendix file map `src/db/schema/audit.ts`); 2587 (Appendix B.11 mod_actions Bucket A appendix); 2688 (Appendix JSONB sub-key handling).

DEBATE.2 future-reader scope: when wiring caller-side `mod_actions` INSERT semantics, this 42-locus inventory is the reference material. Reconciliation decision (extend verdict enum vs add action column vs use metadata field) ripples through SPEC.1 §1 + SPEC.2 §5/§6/§B.11 at minimum.

### Sequencing authority

SCAFFOLD.15 close-out §11.1 was cited at SCAFFOLD.17 brief drafting as the sequencing authority (ENGINE.6 → SCAFFOLD.17 → SCAFFOLD.16). Per SCAFFOLD.17.md §3 SURPRISE-3: `docs/logs/SCAFFOLD.15.md` (160 lines) contains no `§11.1` section and no `SCAFFOLD.17` mention; the sequencing authority is operator-ratified at the brief-drafting chat, not logged into SCAFFOLD.15 close-out. SCAFFOLD.16 inherits the same: sequencing authority is operator + brief, not retroactively-attributed SCAFFOLD.15 close-out content.

---

## Open questions

None at plan time. Q1–Q6 all ratified at /plan opening 2026-05-26; verdicts at §C. Hard ceiling at 6 SURPRISES held; no additional non-NCMEC, non-PhotoDNA brief-drift items surfaced during plan-body drafting.

## ADRs needed

None. SCAFFOLD.16 consumes ADR-0014 substance (in SPEC.2 §10) + LD-3 carve-out is documented in SPEC.1 §20-Appendix + SPEC.2 §10 new paragraph (Edit 4b) + `docs/parked.md` Row 3 design-record. ADR-0014 itself is unamended; the carve-out is an experiment-phase narrowing of the Track A predicate, not a re-litigation of ADR-0014's substance.

If post-experiment hardening surfaces a need to formally ratify either R-1 (predicate hardening) or R-2 (verdict-shape expansion) or R-3 (retry policy), that stratum mints a follow-up ADR. Not SCAFFOLD.16 territory.

---

## Self-critique (after Phase 1 self-review)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | §F amendment count expanded from brief's 5 to 9 mid-Phase-2 via /plan opening greps. Risk: scope-creep relative to brief contract. | Mitigated by hard ceiling at 6 SURPRISES + operator ratification per find. Each expansion documented in §3 SURPRISES + §I provenance "Brief drift caught at plan opening". |
| 2 | medium | LD-10 reopened mid-Phase-2 from Position A to Position B. Risk: brief-time decision shifted at plan time, weakening brief authority. | Operator-directed change with explicit rationale (experiment-phase scope discipline, sole-record-in-parked.md). Documented in LD-10 verbatim + §3 SURPRISE 5 + §I provenance. CF-5 closed in §H. |
| 3 | medium | NCMEC default-strike-on-encounter is ceiling-exempt per operator. Risk: silent scope creep masquerading as ceiling exemption. | Mitigated by surfacing the 6th find explicitly + operator's batched-entry framing (single §3 entry covers all NCMEC strikes). §F edit 5 is the only known NCMEC strike at plan time; additional strikes during execute-phase would surface in execute-phase audit per CLAUDE.md §5.10. |
| 4 | low | §1 LDs reproduce brief §0 verbatim instead of cross-referencing. Risk: drift if brief is updated post-plan. | Brief is frozen at v1 (MD5 4698d41100695ffa58040de001063823); no expected post-plan brief updates. Verbatim reproduction is correct per `docs/plans/SCAFFOLD.17.md` precedent. |
| 5 | low | §B out-of-scope mixes brief §1.2 (8 deferred surfaces) + brief §3 (12 B-verdicts) into one section. Risk: muddled distinction between "deferred to named owner" vs "structural NO". | Mitigated by two sub-tables (3.B "Deferred to named owner strata" + 3.B "B-verdicts"). Distinction preserved at sub-table level. |
| 6 | low | §D test plan documents +1/+1 changes but doesn't include the failing-test gate verification step explicitly. | Test-writer subagent invocation note at end of §D explicitly says "MUST fail before the implementation edit lands". Discipline preserved. |
| 7 | low | §F edit 7 (SPEC.2 §17.2 row 4 no-op) is enumerated as an amendment location despite being no-edit. Risk: amendment-count inflation. | Per operator pre-Phase-1 ack: same-commit amendment scope discipline (ENGINE.6 process improvement #5) "enumerate ALL parallel concerns even when the verdict is no-change". Counting it preserves the enumeration discipline. Total 9 = 9 real loci even though 1 is no-op. |

Self-critique pass complete 2026-05-26. No HIGH severity findings. MEDIUM findings (1, 2, 3) all have explicit operator-ratification provenance + §3 / §I documentation. LOW findings noted; none gate Phase-2 execute.

---

## References

- `CLAUDE.md` — the contract this plan respects (§1 critical paths, §2 invariants, §3 refusal triggers, §5 workflow rules, §5.10 pre-PR self-audit, §5.11 reviewer-call invocation, §7 maintenance + cleanup absorption)
- `AGENTS.md` — the stack patterns this plan follows (§4 TypeScript conventions, §7 handler-stack failure-mode posture, §9 testing, §10 boundaries, §11 git workflow)
- `docs/specs/SPEC.1.md` — §14 Moderation contract; §16.5 Compliance bullet 5 amended (Edit 1); §17 acceptance-test catalogue amended (Edit 2); §20-Appendix moderation-category table amended (Edit 3)
- `docs/specs/SPEC.2.md` — §10 Pre-Commit Moderation Contract amended (Edits 4 + 5); §12.2 line 1112 amended (Edit 6); §17.2 row 4 no-op (Edit 7); §22.2 line 2175 amended (Edit 8); Appendix A file map amended (Edit 9)
- `docs/specs/SPEC.2.md` §0.1 change-log entries — ADR-0014 substance (no separate ADR file per `project_adr_catalogue_framing`); ADR-0014 itself unamended
- `docs/logs/SCAFFOLD.17.md` + `docs/logs/SCAFFOLD.17-post-merge.md` — predecessor close-out
- `docs/logs/ENGINE.6.md` — process improvements #5 + #6 carried forward
- `docs/plans/SCAFFOLD.17.md` — plan-shape precedent (§0/§1/§2/§3 + §A-§F)
- `docs/plans/SCAFFOLD.15.md` — predecessor that shipped the precommit moderation client
- `docs/plans/_template.md` — template scaffolding (Status/Date/Author/Critical-path? header + Tracker context + Approach + Open questions + ADRs needed + Self-critique + References)
- `docs/parked.md` — parked-item convention; 4 new rows added (§G)
- `.claude/agents/test-writer.md` — Phase-2 test-writer subagent briefing
- `.claude/agents/code-reviewer.md` — post-implementation code-reviewer briefing
- `.claude/agents/security-auditor.md` — post-implementation security-auditor briefing
- `SCAFFOLD.16-plan-mode-brief.md` (input contract; v1, MD5 `4698d41100695ffa58040de001063823`)
- `SCAFFOLD.16-technical-research-brief.md` (input contract; empirical backing)
- `/tmp/scaffold-16-repo-inspection.md` (CC repo inspection 2026-05-25; ground-truth source for brief drafting)
- Tracker v10 (operator-maintained external HTML; not inline)

---

*Plan-mode draft. Branch `plan/scaffold-16` HEAD: TBD (this commit). Plan PR: TBD. Execute-chat kickoff prompt: not drafted in this chat per kickoff scope (web Claude plan-review chat or operator-direct).*
