# BLOCK-1 — session log

Autonomous overnight run per `docs/overnight-run.md`. Full report:
`~/Downloads/zz_BLOCK-1_report_2026-08-31T1644.md` (uploaded to the operator
directly — six required fields below per CLAUDE.md §5.9).

**What landed** — 12 commits on `feat/block-1-resolution-content`, PR #447
(unmerged): the static per-slug resolution-block map
(`src/components/debate/resolution-block-data.ts`), the `ResolverCards.tsx`
render wiring (RESOLVER becomes a whole-block link; an unknown slug degrades
one row + one Sentry capture rather than crashing `/m/[slug]`), the guarded
YCP-01 artifact-noun rename (`scripts/rename-ycp01-artifact.ts`, already
executed against live staging and verified), 7 collateral test-fixture
fixes, and two rounds of reviewer-driven hardening (test-writer, code-reviewer,
security-auditor — all three found real, verified issues; full dispositions
in the run report §7).

**Decisions made** — (1) RF-1's "fail the build" split into a compile-time
half (the map's own `Record<KnownMarketSlug, T>`) and a runtime half
(`getResolutionBlocks` throws on an unknown slug), since a DB-sourced
`string` can't be proven a member of a literal union at `tsc` time; (2)
post-review, the THROW's *caller* (`ResolverCards`) now catches it and
degrades one row instead of the whole route — two independent reviewers
converged on this from different angles; (3) RF-2's table shipped verbatim
per its own explicit instruction, including two rows (oktoberfest, github)
flagged during review as possibly diverging from a different, uncited
ruling — shipped as instructed, flagged for confirmation, not silently
changed (report §8); (4) the shared, auto-generated `mumbai-metro.input.ts`
fixture was left untouched ("do not hand-edit") — dependent test files
shadow the import with a locally-corrected model instead.

**Open questions** — the two content items in report §8 (OKT-01's
RESOLUTION text, CLA-01's RESOLVER completeness) need a founder/operator
ruling against documents this task's kickoff didn't cite. Both are
one-file, few-line fixes if the ruling goes against what shipped.

**Next session starts at** — nothing queued. If §8's ruling changes either
value, edit `src/components/debate/resolution-block-data.ts` directly (the
map is the only place either string lives) and re-run
`tests/unit/debate/resolution-block-data.test.ts` — the content-spot-check
tests will need their expected strings updated to match.

**Context to preserve** — the two-tier exhaustiveness design
(`resolution-block-data.ts`'s own docblock) and the degrade-one-row-not-the-
route pattern in `ResolverCards.tsx` are both load-bearing for any future
change to this file; read both docblocks before touching either. The
`_posted-fixtures.ts` shadowing pattern (`mumbaiMetroModel as
mumbaiMetroModelRaw`, then a locally-corrected const shadowing the original
name) is the template for any future fixture that needs a valid slug without
touching the golden file.

**Time** — single continuous overnight session, 2026-08-31.

Canonical reference SHA: the squash-merge SHA on `main`, once merged (branch
SHA `74b7ffa27fcb2f8ca3e894cd878adf31ff27e880` is ephemeral).
