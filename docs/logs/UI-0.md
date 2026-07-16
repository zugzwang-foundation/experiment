# UI.0 — session log (ground re-verify · surface recon · lane-plan commit · FINISH)

> 2026-07-16 · one sitting · CC on Fable 5 (`claude-fable-5`, effort max) · operator-relayed web gating (Parts 1–3 + FINISH kickoffs)

## What landed
- `docs/plans/UI-LANE.md` — web-authored, operator-ratified UI lane plan v1.0. PR #228, squash `c588d17d9d0618d3f92fbfa9d1fef5b483fdeb50` (`c588d17`) on `main`.
- `.claude/agents/{code-reviewer,db-migration-reviewer,security-auditor,test-writer}.md` — `model: claude-opus-4-8` → `claude-fable-5`, `effort: max` unchanged (same PR).
- Branch cleanup (ratified `-D` after zero-diff proof): `docs/sync-lite-maint-19-20` (was `f33d86e`) + `chore/sync-lite-log` (was `7cfd411`); work branch `docs/ui-lane-plan` cleaned local+remote post-merge the same gated way.
- FINISH fidelity checks on `main`: one `model:` line per agent file (`claude-fable-5` ×4) · UI-LANE Status line verbatim · `## 3` present · `NEVER ultracode` ×3 · `Đ BET` present — **all PASS, zero fix commits**.
- This log (its own PR; the squash subject carries the number).

## Decisions made
- **Fable-5 window pin** (UI-LANE.md §2 window note + §7): session + all four subagents on `claude-fable-5` through ~Jul 19 2026. **POST-WINDOW REVERT OBLIGATION:** pins return to `claude-opus-4-8`; the revert task also reconciles CLAUDE.md §6's now-window-stale "Fable 5 is currently unavailable" text (deliberately unedited this session — kickoff scope was plan + pins only).
- **zero-diff-then-`-D`** ratified as the house branch-cleanup pattern (`git branch -d`'s ancestry predicate is structurally unmeetable under squash-only merges).
- **Admin Centre = Session B leaf** (recon: admin consumes no shared branded components).
- **A1–A8 binding order:** Foundation → Composer substrate (backend) → Composers UI → Discovery → Profile → Bookmarks (ADR first) → Auth skin → MEDIA.2.
- Relayed at FINISH, recorded as relayed: **deferred-6 KEEP** (no in-session referent — see Open questions) · **branch census "84 definitive"** — measurement disagrees, see the census correction.

## Census correction (measured 2026-07-16, post-cleanup)
`git branch`: **117 local** = **100 `[gone]`** + 15 non-gone task branches + `main` + `staging`. The recon's "~86 [gone]" (baked into UI-LANE.md §6 as "~86") was an eyeball estimate; the relayed "84 definitive" ≈ 86−2 (the SYNC-LITE deletions) inherits that imprecision. **Correct sweep target: 100 `[gone]`, plus 15 non-gone locals gated individually.** UI-LANE.md §6's "~" wording stays truthful as written; re-ratify the definitive number when the parked sweep executes.

## Open questions
- **deferred-6 KEEP** — relayed in the FINISH kickoff without an in-session referent; needs a web-side definition before the parked branch sweep runs.
- `stash@{0}` (EXTAUDIT-06 `.env.example` R2 quad) — operator ruling pending; untouched all session.
- W2.11 45-state ledger CSV — operator locate (canon §8 row 12; non-blocking).
- Bookmarks storage (table vs `user_events` projection) — web-authored ADR due before A6.

## Next session starts at
- **UI.A-FOUNDATION (A1) plan-mode chat**: branded global header + nav (W2.4-5-14 v0_2) replacing the throwaway shell header, plus the DEBATE.4 rebrand pass. Fresh session + fresh web chat per CLAUDE.md §5.1/§5.8; no surface work before its plan is signed off.

## Context to preserve
- Ground: recon read from `main` @ `26d9f3e`; lane plan now on `main` @ `c588d17`.
- Part 2 headline gaps feeding A2/A5/A6: `BET_MAX_STAKE` absent from code (`config/limits.ts` carries the two floors only; DC ruling 2 leans on the cap) · Bookmarks entirely spec-less (zero schema/endpoint/spec presence; canon ruling 1 = semantics only) · Profile read model missing wholesale (no `src/server/profile/`) · no deep-link post param on `/m/[slug]` (post-focus is client state).
- Mockup corpus 1:1 vs canon §8 rows 1–15; integration shell PK-only by design; W2.9 market-media rides MEDIA.2; W2.12 re-scoped to the O1 chat.
- Ceilings at close: ADR 0031 · migration head 0023 · EVENT_TYPES 24.
- Session B fork gate = UI-LANE.md §3 foundation-stable criterion (A1 merged + branded header live + rebrand merged + zero open header/nav PRs).

## Time
- 2026-07-16, one sitting: Part 1 ground re-verify → Part 2 read-only recon → Part 3 execute (pin flip · ratified `-D` · plan commit · PR #228 merge) → FINISH (fidelity PASS · this log · PK staging).
