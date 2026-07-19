# SPEC-PROFILE-amendment — session log

> **Task:** SPEC.1 Profile amendment (the UI.A5 blocker) — CC apply leg. Doc-class.
> **Session:** 2026-07-19. **Canonical SHA:** squash-merge **`848e05a`** on `main` (PR #248; read via `gh pr view 248 --json mergeCommit`).
> **This log rides its own post-merge PR** (`chore/spec-profile-amendment-log`) per the session-log ruling — the amendment commit stayed pure.

## What landed

- `docs/specs/SPEC.1.md` **1.0.17 → 1.0.18** — the 12-edit web-authored amendment (`ZUGZWANG-SPEC-PROFILE_amendment_v1_0.md`, RATIFIED sheet, applied byte-verbatim; CC authored nothing): new **§23 Profile** (route `/u/[pseudonym]`; identity block; six tiles; Dharma graph on the §10.8 basis with the SideEpisode gap law; positions table Staked Đa / Current Đb; argument list per RANKING.md §3.6; viewer-independent masking, owner included; owner-only sell mount; F-PROF-1/2/3), **§10.8** net-worth definition (execution-value Đb everywhere; one holding, one value), **§2** Net worth + SideEpisode rows, **§16.1 + Appendix B** `PROFILE_GRAPH_Y_MAX` (10,000), **§16.2** Track-B row → gate-block reality, **§16.3** D8 reconciled, **§17** +11 `profile::` rows, **§20** 1.0.18 row, and the three-construct **ADR-0021 de-staling** (§9 F-DEBATE-1 sentence · §16.2 row · §22 F-DISC-2 hero mirror + Profile-nav → §23).
- **PR #248** — branch `docs/spec-profile-amendment`, single commit `8a345e9` off `4ff2ba3`, squash **`848e05a`**; author `Zugzwang/world`, SSH-signed, no Co-authored-by. Diff: `docs/specs/SPEC.1.md` only, **+80/−6** (net +74 lines, reconciled edit-by-edit). First PR comment: STEP 4 raw verification outputs regenerated on the committed tree + `diff --stat` + corrected expectation numbers + verbatim SPEC.2 L483/L1680 echoes.
- Post-merge proof run at the A5 re-open: `git diff 8a345e9 origin/main` **empty**; §23 guard-grep on `main` at L1494; merged branch deleted local+remote.

## Decisions made

- **P-1 (pin/session):** session model `claude-fable-5` vs the four `.claude/agents/*` pins `claude-opus-4-8` — gate 0a STOPPED as designed; **operator ruled proceed on the selected session model for this apply leg** (zero subagents invoked; Q3 containment held: no ultracode, no Workflow, single sequential pass).
- **SPEC.2 zero-touch STOP:** fired on 2 `/u/` hits (SPEC.2 L483/L1680) → **cleared by web** as a pattern false-positive (pre-existing URL-exposure exemplar paragraphs, byte-identical to origin/main, conformant with §23's route). SPEC.2 byte-untouched; parked bundle stays parked.
- **Verification-expectation corrections** (web authoring slip, web-owned, sheet ERRATA E-1): `profile::` = **12** · `PROFILE_GRAPH_Y_MAX` = **4** · de-staling case-sensitive = **1** (the §20 row describing the fix; two lowercase legacy Discovery ids survive by design, rename docketed). Substance verdicts unaffected.
- **EDIT L anchor** disambiguated by the sheet's own scoping ("inside the Appendix B code block"): raw whole-file count 2 (the §20 1.0.17 row quotes the line), scoped count 1 — both hits echoed verbatim before proceeding.
- **Session-log ruling:** amendment PR pure (one commit, SPEC.1 only); this log is the separate post-merge errand, recording the canonical squash SHA.

## Open questions

- None for the amendment itself. **Carried to the A5 lane:** disposition of the session-model ≡ agent-pin divergence for the execute leg's kickoff-named subagents (`@security-auditor` gates masking/own-visibility/sell-mount per the Q3 mode law) — `/model opus` at execute open vs. explicit per-call Agent model overrides.

## Next session starts at

- **UI.A5 — Profile — plan phase** against `848e05a` (kickoff received in-session post-merge; ground verified green; scope-frame relayed; WAITING for web/operator alignment at the time of this log).

## Context to preserve

- Residue dockets (amendment close-out §"Residue"): Discovery test-id rename → next Discovery `src` touch · §16.2 Track A row oddity → MAINT · W2.6 record "mark-to-market"/"shares × price" wording superseded by §10.8 (reconcile only if those records are re-touched).
- PK staging done this session per the close-out: `~/Desktop/zz-pk-refresh-SPEC-PROFILE/SPEC_1.md` = `docs/specs/SPEC.1.md` @ `848e05a`, md5-verified (hash in the PR body).
- Transient, no action: first `gh pr create` for #248 timed out on the GitHub API after a successful push; retry created the PR cleanly, no duplicates.

## Time

- 2026-07-19, one CC session spanning: amendment kickoff ritual (ground + inputs + scope-frame) → P-1 STOP round-trip → apply leg (STEP 1–4) → SPEC.2 STOP round-trip → STEP 5–6 (PR #248) → operator merge → this close-out errand + the UI.A5 re-open STEP 0.
