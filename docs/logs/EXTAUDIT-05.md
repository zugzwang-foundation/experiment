# EXTAUDIT-05 — Backend handover deck (session log)

Two-PR arc: deck PR **#220** (merged) → this log PR. Plan authority:
`docs/plans/EXTAUDIT-05-handover-deck-plan.md` (ratified 2026-07-14, §11 record).

## 1. What landed (files + PR#)

**Deck PR #220** — squash `b4daa9c2aaa435ccd9fda3928c5bd2827c44f3b8` on `main`
(read via `gh pr view 220 --json mergeCommit`, never relayed):

- `docs/handover/EXTAUDIT-05_HANDOVER-DECK.md` — 1,705 lines, canonical. Part A system
  map (A1–A6) · Part B 14-chapter build chronicle (all 218 first-parent commits at
  PIN `31d8965`, each exactly once, script-generated ledger lines; deep dives at every
  plan-named commit; 19/19 ratified snippets, ≤25 lines each, `path:line` at PIN) ·
  Part C operations (C1–C7 + epilogue).
- `docs/handover/EXTAUDIT-05_HANDOVER-DECK.html` — 883 lines, generated single-file
  presentation build: two-level sidebar (19 h2 + 37 h3), 18 per-chapter "TL;DR for the
  room" presenter boxes, monochrome tracker styling, zero external requests, minimal
  inline scrollspy JS.
- `scripts/verify-handover-links.sh` — committed verifier, checks 1–4.
- `biome.json` — `!docs/handover` rider (mockups-exclusion precedent, #195).
- `docs/plans/EXTAUDIT-05-handover-deck-plan.md` — ratified + R1/R2-patched plan,
  committed first on the branch (§5.1).

**This log PR** — `docs/logs/EXTAUDIT-05.md` + a `docs/parked.md` row for the
pre-existing Biome warning (deviation d below).

Verifier state: all 4 checks green pre-PR at `31d8965`, and re-run green **post-merge**
from the merged tree (invoked with the explicit deck PIN — see Context, item 3).
Post-merge tree proof: `git diff d5da242 origin/main -- <the five deck paths>` empty;
Part-B root ledger line grepped verbatim on `origin/main`.

## 2. Decisions made

- §11 ratification applied before any authoring: package-numbered filenames (ruling 1);
  EXTAUDIT cross-refs by ID+section against the issued set sighted in `~/Downloads`
  (ruling 2); DP.2 divergence presented as-is via mandatory live probes, framed as the
  promote gate working (ruling 3 + R2); ~2,700-line estimate accepted with thinning as
  fallback only (ruling 5); two-level sidebar (6); presenter boxes mirrored as `.md`
  blockquotes to preserve heading parity (7); C7 hybrid with the operator roadmap table
  rendered verbatim under the ratified label (8).
- R1: live `EVENT_TYPES` count at PIN = **24** (4+5+2+7+2+1+2+1); printed everywhere;
  AGENTS.md §6 never cited for the figure (grep-verified zero).
- R2: `/api/health` probed on both domains at execution (2026-07-14 ~10:52 UTC), JSONs
  excerpted verbatim in C1 with timestamps; behind-by from probed canaries.
- R3: A6 carries the audience-facing chronology-convention sentence; B7/B8 carry
  merge-order footnotes (#159 after #160/#161; FIX-AUTH interleaves).
- Ledger-line grammar (`^- [\`short\`](…/commit/full) · [#N](…/pull/N) — subject — tie`)
  is the verifier's extraction contract; ledger SHAs/PR numbers script-generated from
  `git log --first-parent`, never hand-typed.
- The deck's own PR link was pre-authored in the epilogue as #220 and the PR **is** #220;
  had the number differed, a fix-up commit would have preceded merge.
- Docs-only, non-critical path: no subagent cascade (plan §7.6);
  `ZUGZWANG_ENV=preview just verify` + `just check` green.

## 3. Open questions

None blocking. Standing refresh triggers only: if `main` moves materially before the
live session (especially **DP.2**), re-pin and refresh C1/C7 + a B14 census delta in a
dated PR (plan §8); the as-of stamps bound staleness meanwhile.

## 4. Next session starts at

Operator uploads the four staged PK files (`~/Desktop/zz-pk-refresh-EXTAUDIT-05/`,
staged at this close-out per plan §8) into web project knowledge beside EXTAUDIT-00..04.
Next repo task per the operator roadmap: TESTING.0 continues; DP.2 gated prod promote is
P0 after soak (re-verify `autoAssignCustomDomains` OFF first).

## 5. Context to preserve

- Deck pins **PIN_SHA `31d8965`** (census 218 = root + PRs #1–#219 − {#58, #146});
  census delta between plan and execution was zero.
- Probes at authoring: staging served `f0be380` (#216) — behind PIN by 3 (docs-only),
  journal 0000–0023, `migrations:"ok"`; prod served `a61859a` (#193) — behind PIN by 26,
  serving-build journal ends 0019, `migrations:"ok"` (self-consistent; 0020–0023 await
  DP.2). Prod state in C1 is probe-adjudicated, never doc-narrated.
- **Verifier invocation after `main` moves past the deck's PIN:** always pass the deck's
  PIN explicitly — `scripts/verify-handover-links.sh 31d8965…` — because the default
  (`origin/main`) makes checks 2/3 compare the ledger against a census that now includes
  post-deck commits and fail by design (that failure is the §8 refresh trigger doing its
  job, not a verifier bug).
- The deck's own PR #220 is outside PIN history by construction — epilogue link only;
  its squash SHA lives in this log, not in the deck.
- HTML is generated from the `.md` (never edited independently); any content fix lands
  in the `.md` first, HTML regenerated, check 4 re-run.

## 6. Deviations (as-run vs plan)

**(a) Length.** Final `.md` = **1,705 lines** vs the plan's ~2,700 ±20% estimate —
under the band. Accepted by web review at close-out. Nothing was thinned: the §3
fallback thinning order was never invoked; all 14 chapters, every plan-named deep dive
(B2 ×1, B3 ×4, B6 ×17, B7 ×8, B8 ×2, B10 ×7, B11 ×2, B13 ×5), all 19 snippets, 18
presenter boxes and the full 218-line ledger are present. The estimate was authored
pre-writing; the shortfall is prose density, not dropped scope.

**(b) Prod behind-by.** The plan's grounding table carried "prod ≈ 3 doc-commits
behind" from earlier deploy-arc docs. The R2 mandatory probes adjudicate: prod behind by
**26** commits (`git rev-list --count a61859a..31d8965`), serving-build journal at
**0019**. The deck's C1 and this log state the probed truth; the plan line is superseded
and so noted in plan §11 R2.

**(c) EXTAUDIT-04 sighting.** Close-out re-verification (`ls -la ~/Downloads/EXTAUDIT*`)
sighted **all six** issued files verbatim: `EXTAUDIT-00_START-HERE.md` ·
`EXTAUDIT-01_CHARTER.md` · `EXTAUDIT-02_OPERATING-MANUAL.md` · `EXTAUDIT-03_MATH-BODY.md`
· `EXTAUDIT-04_DEBATE-BODY.md` · `EXTAUDIT_BRIEFING.html` (the five `.md` dated
2026-07-10 14:57, the briefing 14:58). No absence, no refresh-pass fix needed; the
deck's EXTAUDIT-04 cross-refs stand.

**(d) Pre-existing Biome warning.** `tests/server/moderation/moderation-blocked-event.test.ts:1`
carries a `lint/correctness/noUnusedImports` warning (`eq` from `drizzle-orm`) that
predates this task (AUDIT-FIX-B5 era). Warning-severity only — CI green throughout
(#220 ci pass 3m39s). Out of EXTAUDIT-05's docs-only scope; parked in `docs/parked.md`
(row added in this same commit) for the next code-adjacent sweep.

**(e) `.env.example`.** A pre-existing uncommitted working-tree modification to
`.env.example` was present throughout both sessions and deliberately left untouched and
unstaged (not part of this task; plausibly the parked R2 market-media var back-fill in
progress — recon FINDING 5-a).

## 7. Time

2026-07-14, two sessions: execution (ratification patch → re-ground incl. R1 count +
R2 probes → deck authoring with script-assisted ledger → verifier → HTML → gates →
self-audit → PR #220, ci green ≈3.5 h) + this close-out (merge proof → log PR → PK
stage). Fresh chat per phase per §5.8.
