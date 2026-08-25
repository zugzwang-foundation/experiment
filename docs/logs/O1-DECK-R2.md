# O1-DECK-R2 — session log (close-out)

> **Session:** the R2 refinement round's endgame — staging restore, the SPEC.1 version collision,
> the merge-debt clearance, and the return of staging to `main`.
> **Mode:** relay-driven; web Claude ruled, Claude Code executed and measured.
> **Worktree:** `/Users/hrishikesh/code/zugzwang/wt-o1-r2`, branch `feat/o1-deck-r2` (removed at close-out).
> **Plan:** ⚠ **none — R2 ran plan-less.** See *Context to preserve*.

---

## What landed

**PR [#358](https://github.com/zugzwang-foundation/experiment/pull/358) — MERGED 2026-08-19T14:37:56Z, squash `c58d64a`.**
The R2 visual pass: 9 files against its merge base — the deck's measure set by its copy, the first
card's wordmark exception, and `Wordmark.tsx` extracted so the deck and the header cannot drift.

| SHA | What it was |
|---|---|
| `8205071` | the R2 execute head, reviewed on staging overnight |
| `1080748` | `chore(spec):` merge `main` into R2 — resolves the **1.0.36 version collision** |
| `375fc50` | GitHub "Update branch" merge, levelling R2 onto `beb36a6` (#362) |
| `c58d64a` | the squash on `main` |

**SPEC.1 → 1.0.37.** Three edits, all web-authored and applied verbatim: §0 `Version`/`Last updated`;
§20's R2 row replaced wholesale at `1.0.37`; and §21.9's *"at the ratified type ramp"* struck, because
the R2 build's own measurement found **no ratified type scale exists** to fit at. VIEWS-1's `1.0.36`
row was kept byte-identical — extracted from `origin/main` by script rather than retyped, md5
`448db168b77d137ddbac462f0ee74029` on both sides.

**Gate at the merged tree** (`375fc50`, tree `3039350426…`, byte-identical to `c58d64a`'s):
`tsc` 0 · `biome check .` 0 (747 files, the standing 5 warnings / 4 infos in five untouched files) ·
`next build` 0 · **`ci` GREEN** on the exact SHA. The local `pnpm vitest run` on that tree exited **1**
with 32 failures — **a false red**, diagnosed and attributed: a second `vitest` from the GH-STAR lane's
worktree overlapped this run by ~8.5 minutes against the shared local Postgres on `:54322`, producing
24 × `violates foreign key constraint` and 6 × `deadlock detected` in files neither lane touched.
The same suite passed 3394/3394 four hours earlier on `1080748`.

**Staging** — three moves, ending level with `main`:

| When (IST) | staging → | How |
|---|---|---|
| 08-18 20:44 | `8205071` | the R2 review advance |
| 08-19 14:06 | `4bb9023` | ⚠ **returned to `main` by another lane**, erasing the park |
| 08-19 18:22 | `8205071` | restore — **ref moved, deploy did NOT** (dedup, see below) |
| 08-19 19:52 | `1080748` | the merge SHA; deployed and verified |
| 08-19 22:35 | `a8c5e06` | **return to `main`** — clean fast-forward, deploy VERIFIED |

Final: `/api/health` → `canary a8c5e06c5a474f9dfd539c6d8c33c563f7a62d7f`, `env staging`,
`db ok`, `migrations ok`, `region bom1`.

## Decisions made

1. **R2 yields the version number, not VIEWS-1.** Both lanes minted `1.0.36` from base `1.0.35`.
   Git could not flag it — identical edits auto-merge, so the only marked §0 conflict was the *date*
   and the `Version` line resolved silently to a single `1.0.36`. R2 merged second, so R2 renumbered
   to `1.0.37`. **Founder ruling; the resolved text was web-authored and applied verbatim.**
2. **The "ratified type ramp" claim is struck rather than honoured.** The seventh refinement asked for
   one ramp step up; measurement found `type.scale.*` unminted and explicitly not a token-contract slot.
   No type size changed, and the spec sentence asserting the ramp went with it — same commit, O-9.
3. **`staging` is pushed before any other ref.** Held throughout. See *Open questions* — the evidence
   for the underlying mechanism turned out to be weaker than this log's earlier drafts claimed.
4. **A duplicate local merge was discarded rather than force-pushed.** The GitHub UI's "Update branch"
   had already levelled the branch; the local merge had an **identical tree OID**, so keeping it would
   have meant a force-push discarding a founder-created commit to land nothing.

## Open questions

- **OQ-1 · O-10's stated mechanism does not match this project's configuration.** O-10 says branch-first
  makes Vercel skip the staging deployment. Measured today: `commandForIgnoringBuildStep` is
  `[ "$VERCEL_GIT_COMMIT_REF" != "main" ] && [ "$VERCEL_GIT_COMMIT_REF" != "staging" ]`, so **every
  non-`main`/non-`staging` ref is skipped unconditionally** and a branch push can never consume a build.
  What **is** real and was measured: re-pushing a SHA that already has a READY deployment **in the same
  environment** produces no deployment at all — that is what defeated the 18:22 restore. And the same
  SHA in a *different* environment builds normally, observed twice (`c58d64a` and `a8c5e06` each built
  for staging after a Production deployment). **O-10's rule may still be right for the wrong reason, or
  may be scoped to a configuration this project no longer has. Founder to rule.**
- **OQ-2 · `docs/plans/` has no O1-DECK-R2 plan** and, by decision, none is being manufactured. See below.
- **OQ-3 · A "Update branch" press produces a commit with no `Instructions for AI` block.** `375fc50`
  carries git's default one-liner; CLAUDE.md §5.13.1 admits no exemption by type and the GitHub UI cannot
  comply. Either the button is not used, or mechanical merge commits are explicitly exempted.
- **OQ-4 · The shared local Postgres has no per-worktree isolation.** Two lanes running `vitest`
  concurrently — from *different* worktrees, which reads as safe — produced 32 false failures. The
  existing discipline is written about one tree; the isolation that matters is the database.
- **OQ-5 · `docs/plans/O1-DECK.md` §Q4 still reads "MEASURED, at the ratified type ramp."** That is the
  origin of the claim SPEC.1 1.0.37 struck. A plan is a historical record, not normative text, so no
  rider is owed — noted so it is not later read as a live authority.

## Next session starts at

**Nothing is owed on O1-DECK-R2.** It is merged, staging is level with `main`, and the worktree is
removed. The next session picks up whatever the tracker names; if it touches the onboarding deck,
start from SPEC.1 §21.9 at `1.0.37` and `docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md`.

## Context to preserve

- **R2 ran plan-less, and that is a statement of fact rather than an omission to repair.**
  `docs/plans/` on `main` carries `O1-DECK.md` — the *parent* task's plan, dated 2026-08-18, cut from
  `c4526e2` — and **no `O1-DECK-R2` plan of any name**. R2 executed from the overnight pack's refinement
  round and the founder's per-round relays. ⚠ **A grep for "R2" inside `O1-DECK.md` returns hits that are
  about the Cloudflare **R2 storage bucket**, not this refinement round** — the substring is a false
  friend, and a later reader should not take those lines as R2 plan coverage. No plan is being
  back-written: a manufactured plan would misrepresent how the work was actually governed.
- **The version-collision failure mode is the durable lesson.** Two lanes amending one document from one
  base can mint the same version, and **git's conflict markers cannot show it** — identical edits merge
  silently. The control that catches it is reading the **base** version and comparing both heads against
  it. Reading only the markers ships one number over two amendments.
- **`1080748` is unreachable from any branch** after the squash. Staging served it for ~2h40m, so any
  artefact citing that canary refers to a SHA `git branch --contains` cannot place.

## Time

2026-08-19, ~18:10 → ~22:40 IST (≈4h30m), across five relayed rounds: staging restore · SPEC.1 conflict
report · merge-resolve + re-advance · Gate C arithmetic · endgame and staging return.
