# SCAFFOLD.16 — plan-review + execute-review wrapper log

> Review-wrapper companion log for the cumulative web Claude review work that wrapped around SCAFFOLD.16. Plan-mode close-out at `docs/logs/SCAFFOLD.16-plan-mode.md` + execute-phase close-out at `docs/logs/SCAFFOLD.16.md` hold the substance; this log records the review-loop process around them.
>
> Six fields per CLAUDE.md §5.9.

---

## What landed

- **PR #52 merged** ([github.com/zugzwang-foundation/experiment/pull/52](https://github.com/zugzwang-foundation/experiment/pull/52)) — SCAFFOLD.16 critical-path moderation stratum shipped to `main`.
- **Final §F locus count: 9 → 17.** Plan-mode originally locked at 9; execute-phase Phase-1 verify-don't-trust expanded to 17 (5 SPEC.1 brief-drift items + F-γ-thin + G2 + Item G) per operator individual ratification 2026-05-26.
- **Reviewer cascade clean**: 0 CRITICAL, 0 HIGH. 1 MEDIUM (code-reviewer; pre-existing truthy-check on `imageR2Key` aligned with R-1 parked.md). 4 LOW (code-reviewer) + 2 LOW (security-auditor). L3 absorbed in-session; others documented in close-out.
- **Verification gates green at push**: `pnpm tsc --noEmit` clean, `pnpm biome check .` clean (121 files), `pnpm vitest run` → 302 passed + 2 skipped + 5 todo. Skips both carry explicit handoff signals (F-γ-thin `it.skip` + `@ts-expect-error` for DEBATE.2; R2 roundtrip probe gated on live R2).
- **SURPRISES ceiling consumption**: 1/6 execute-phase event (SURPRISE 7 = 7a/7b/7c lumped per Q3 operator refinement). Plan-mode used 6/6. 5 execute-phase budget unspent.

## Decisions made

The review-loop ratified six load-bearing dispositions across plan-review + execute-review chats. Each chose a non-default option with explicit operator rationale:

- **F-γ-thin over F-α (defer mitigation).** Image-borne harm content during the 15 Sep – 1 Nov experiment window + ETHGlobal Mumbai public launch is a thesis-violation surface (mandatory-commentary integrity + K_eff demonstration optics) that outweighs the ~1-2 hour scope expansion. F-α would have shipped honest documentation of "accepted v1 gap, deferred mitigation" but no operational mechanism. F-γ-full would have extended F-ADMIN-4 ahead-of-need with broader scope (user-report path + ad-hoc removal); F-γ-thin narrow-extension (inline admin Remove on pass-verdict comments only) balanced operational adequacy with scope discipline.
- **G2 over G1 (operator-narrow-scope) and G3 (mint F-MOD-6).** F-MOD-3 ↔ F-ADMIN-4 has 1:1 moderation-pair coupling — F-MOD-3 documents the decision contract for the same Approve/Block actions F-ADMIN-4 surfaces. Under G1, F-ADMIN-4 would document 3 actions while F-MOD-3 documents 2 — a new internal-consistency break in the moderation pair (same failure mode as the 5 SPEC.1 Phase-1 brief-drift items). G3 (mint F-MOD-6) would have created a third SPEC.1 ↔ SPEC.2 F-MOD numbering asymmetry (scope-creep hazard). G2 (extend F-MOD-3) is one bullet to an existing slot, no new namespace entries, no SPEC.2 cascade.
- **H-γ (encoding-agnostic) over H-α (operator-verbatim, propagates drift) and H-β (migration, scope expansion).** H-α would have deliberately propagated Item H-1 (long-standing SPEC vs shipped-code drift on `mod_actions` schema) into a new SPEC.1 location authored by SCAFFOLD.16 — extending drift rather than inheriting. H-β would have added a same-commit schema migration to SCAFFOLD.16 (`ALTER TYPE mod_verdict ADD VALUE 'remove_pass_verdict'`), tripping scope-expansion + cascading into drizzle/migrations/ + RLS review. H-γ defers encoding choice (verdict-enum vs action column vs metadata field) to DEBATE.2 caller-side per LD-5; F-γ-thin sub-edits 15a + 16 (G2) phrased identically across SPEC.1 §14 + §15 + §F Edit 4a re-narrowing.
- **6α (correction-in-place) over 6β (defer + close-out documentation).** Plan body §F Edit 4a "After" text contained three compounding factual errors per authoritative OpenAI capability table (wrong count, wrong list, wrong taxonomy claim re. `weapons`). 6β would have applied Edit 4a verbatim with factual error preserved in SPEC.2 §10. 6α corrects in-place + tracks as amendment-note within existing Edit 4 entry (not a separate locus).
- **Research-brief Option II (inline errata note).** Original `~/Downloads/SCAFFOLD.16-technical-research-brief.md` v1 frozen per plan-provenance convention. Brief body brought in-repo at `docs/briefs/` + dated ERRATA 2026-05-26 note appended. Records propagation chain for Error 1 (hate image-support mis-categorization at §1 line 33) + Error 2 (implied F-ADMIN-4 mitigation citation chain break). Convention exists to preserve plan provenance, not known factual errors.
- **Greenlight + escalation triggers framing for end of execute-phase.** After 6+ review-turn requests during plan-review + early execute-review, operator established clear greenlight: "execute through to PR-merged without further review unless [CRITICAL/HIGH from reviewers OR hard ceiling tripped OR Item I+ non-NCMEC/non-PhotoDNA/non-cascade OR migration requirement OR new operator decision territory]". Cut review-loop overhead at Phase 4-9 from per-edit ratification to exception-only escalation.

## Open questions

None blocking SCAFFOLD.16 closure. Tracker confirmation on next stratum at next chat opening (per operator wind-down framing).

## Next session starts at

**Per tracker** — operator-confirmed at next chat. SCAFFOLD.16 status flip Open → Closed; DEBATE.2 kickoff drafting next (caller-side stratum that ships F-COMMENT-3 wires + F-γ-thin admin Server Action implementation per SCAFFOLD.16 contract at `tests/server/admin/moderation/act.test.ts`).

## Context to preserve

Items derived from the review-loop process around SCAFFOLD.16 (not derivable from the existing plan-mode or execute-phase close-out logs):

- **Brief-time scope estimate dramatically underestimated SPEC amendment fan-out** (brief: 5 → /plan: 9 → execute-phase: 17 = +240% cumulative; brief→execute is ~90% off from the 9-lock baseline operator anticipated). Future scope-narrowing strata (post-design-system-lock SCAFFOLD/DEBATE/ENGINE work that does LD-1-style "OpenAI sole vendor" or LD-3-style carve-outs against multi-section SPEC framing) should multiply brief-time same-commit amendment estimates by **2-3x default safety margin** to account for cross-document fan-out (decision-contracts in SPEC.1 §14 ↔ operational-surfaces in SPEC.1 §15 ↔ catalogue tables in §17 + §20-Appendix ↔ SPEC.2 §3/§4/§10/§12/§17/§18/§21/§22/§23/Appendix A all need touch when a single LD ripples).

- **Three process-learnings for future plan-mode /plan opening greps** (each documented in plan §I "Brief drift caught at execute-phase Phase 1 verify-don't-trust" subsections 7a/7b/7c):
  - **(a) Verify research-brief category claims against primary docs at /plan opening.** Research brief v1 §1 line 33 claimed `hate` image-supported on `omni-moderation-2024-09-26`; authoritative OpenAI docs say text-only. Error propagated into plan §F Edit 4a. Future /plan openings: per-category capability tables for external vendors should be verified against primary docs, not assumed correct from briefs.
  - **(b) Grep cited mitigations against their target contracts at /plan opening.** Plan §F Edit 4a cited "SPEC.1 §15 F-ADMIN-4 reactive removal" as the v1 image-input gap mitigation; F-ADMIN-4's actual contract at lines 882–892 required upstream Track A/B classification — citation chain structurally broken. Future /plan openings: cited-mitigation references should be grep'd against the cited contract's actual prose; cited mechanism's scope may not match the citing context's claim. Particularly important for §14 ↔ §15 ↔ §20-Appendix moderation-domain cross-references.
  - **(c) Apply research-call Part 2 grep patterns A1-A6, B7-B11, C12-C14, D15-D16 at /plan opening.** Execute-phase Phase-1 Q4 defensive sweep applied subset (B7 "vendor.*TBD" / B8 "general.*classifier" / B9 "hash.*match" / B10 "auto-report" / B11 "if/when.*integrate") to SPEC.2 LD-1 cascade — CLEAN. Subset application caught the Item G cascade in SPEC.2 §4 line 371 + verified no Item I beyond. Full A1-A6 / B7-B11 / C12-C14 / D15-D16 application at /plan opening would have caught Items A-E + F + G during plan-mode rather than execute-phase verify-don't-trust.

- **Item H-1 isolated to SPEC.1 §1 lines 62-63** (long-standing SPEC vs shipped-code drift on `mod_actions` schema; SPEC.1 documents `mod_actions.action ∈ {csam_blocked, nsfw_auto_banned, flagged, approved, blocked}` but shipped `src/db/schema/audit.ts` has `verdict: modVerdictEnum('verdict', ['pass', 'track_a', 'track_b'])` with no `action` column). Predates SCAFFOLD.16; out-of-scope per LD-5. 42-locus `mod_actions` SPEC inventory appended to `docs/logs/SCAFFOLD.16.md` for DEBATE.2 future-reader reference. DEBATE.2's reconciliation decision (extend verdict enum vs add action column vs metadata field) ripples through SPEC.1 §1 + SPEC.2 §5/§6/§B.11 at minimum.

- **F-γ-thin extension shape** (load-bearing for DEBATE.2 implementation):
  - Inline admin Remove on pass-verdict comments only.
  - No schema migration (mod_actions row shape deferred per LD-5 via H-γ encoding-agnostic phrasing).
  - No new queue surface (uses existing F-ADMIN-4 inline affordance pattern).
  - `users.banned_at` NOT set on Remove pass-verdict path (admin escalates via separate Block user action if user-level enforcement needed).
  - Test scaffold at `tests/server/admin/moderation/act.test.ts` in commit `34487a7` with `it.skip` + `@ts-expect-error` handoff signal to DEBATE.2 — when DEBATE.2 lands `src/server/admin/moderation/act.ts`, the directive becomes TS2578 "unused directive" error, signalling the test has moved past blocked state.

- **Candidate CLAUDE.md amendment for next maintenance pass** (per `docs/maintenance.md` audit-trigger criteria): **"Execute-phase CC should escalate by exception, not by checkpoint."** Multiple review-turn requests this stratum were per-edit check-ins (asking operator to verify Item E citation, H-α vs H-β vs H-γ phrasing, G1 vs G2 vs G3, etc.) not exception escalations of CRITICAL/HIGH or ceiling-tripping findings. Operator's mid-execute "greenlight + escalation-trigger framing" (after F-γ-thin ratification) cut review overhead at Phases 4-9 from per-edit ratification to exception-only. Future execute-phase CC sessions should default to greenlight-with-escalation-triggers from Phase 0 onwards; per-edit check-ins are appropriate only at Phase-1 verify-don't-trust find ratification (where 5+ structurally-different items genuinely need operator disposition per item) or when an Item I+ surfaces requiring new operator decision.

## Time

- **Web-Claude review-chat wall-time**: ~4h cumulative across plan-review chat (post plan-mode close-out, pre execute-chat kickoff) + execute-review chat (interleaved with execute-phase Phases 0-9).
- **CC execute-phase wall-time**: 14m 3s (Phase 0 ack → Phase 9 close-out commit).
- **Net process cost**: ~3.5h operator + review-turn engagement caught **~8 distinct load-bearing issues** that would have shipped silent or as launch-blockers:
  - 5 SPEC.1 brief-drift items (Items A-E rooted in LD-1 + LD-3 cross-document fan-out).
  - 1 plan §F Edit 4a "After" text factual error (6α correction; image-input gap category enumeration).
  - 1 F-ADMIN-4 citation chain structural break (Item F → F-γ-thin resolution; would have shipped honest-looking documentation of a non-existent mitigation mechanism).
  - 1 Item H-1/H-2 schema-encoding drift surface (long-standing predates SCAFFOLD.16; documented for DEBATE.2 + isolated to prevent further propagation via H-γ).
  - Plus Item G cascade in SPEC.2 §4 Server Action map description column.

  Net: ~26 minutes of operator engagement per caught-issue, where the alternatives (silent ship → discover at HARDEN.5 or post-launch incident; or launch-blocker discovery in deeper review pass) range from days to weeks of rework or thesis-violation exposure during the experiment window.
