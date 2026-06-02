# SYNC.9 — Logs/closeouts disposition

*Per-session log (CLAUDE.md §5.9). Authored at SYNC.10; rides the SYNC.10 canonical commit (PR-B), since a session log cannot live in its own PR — PR #60 **was** SYNC.9's work.*

## What landed (files + PR#)

PR **#60** → squash **`5d65804`** (signed; 3 checks passed; branch auto-deleted).

- **9 path-mirror logs into `docs/logs/`** (D-NAMING scheme c): `SYNC.2`, `SYNC.3.5`, `SYNC.4`, `SYNC.5`, `SYNC.7`, `SYNC.7-spec2-fold`, `SYNC.8`, `SYNC.8.5`, `SYNC.BACKFILL`. Eight authored web-side (refreshed from the SYNC close-outs into the §5.9 shape) and couriered into the repo; `SYNC.2.md` promoted by CC from `docs/sync/RECON.md` (body verbatim + a six-field header).
- **`.gitignore`:** `docs/sync/` added (local-only recon scratch). `repo-state.json` left untracked.
- Branch cut from `origin/main` (`7a53341`), per the SYNC.BACKFILL precedent — the unpushed `27216fc` and the SPEC/tracker/CLAUDE/AGENTS commits stay with SYNC.10.

## Decisions made

- **`docs/sync/` gitignored — the narrow fix.** Gitignoring the path makes Biome (`vcs.useIgnoreFile: true`) skip `repo-state.json`, so the pre-push `biome-check-all` now passes **without `--no-verify`**. The *general* fix (scope the hook to tracked/staged files) was not applied — see Open questions.
- **No `Co-Authored-By` trailer; not amended.** CC used the message verbatim and matched the immediate precedent (BACKFILL squash `7a53341` carries no trailer). `5d65804` is already merged on `main`; amending would rewrite merged history. **The no-trailer convention rests on precedent + CC suppressing its harness default and should be recorded explicitly in AGENTS.md** — scheduled into SYNC.10/PR-B.
- **`docs/logs/` legacy naming left mixed.** New 9 + SCAFFOLD/ENGINE/PRECURSOR use dotted scheme-c; legacy FOUND/tracker-sweep logs are inconsistent. Not renamed (§5.3) — cosmetic; scheme-c is consistent going forward; normalization is a ~5-min optional MAINT chore if ever wanted.
- **`SYNC.9.md` + `SYNC.10.md` ride SYNC.10's commit** — same pattern as BACKFILL's log riding SYNC.9. No separate hook-tripping docs PR.

## Open questions

- The **general hook-scoping fix** is deferred: the pre-push hook still runs `biome check .` over the whole working tree, so a future untracked, non-ignored, Biome-known scratch file could still trip it. Bucketed with the SYNC.8 enforcement-gap install → a HARDEN-adjacent hooks chore, not SYNC.10.

## Next session starts at

**SYNC.10** — final canonical commit (SPEC.1/SPEC.2/tracker/CLAUDE.md/AGENTS.md + the SYNC.9/.10 logs); the `27216fc`/origin reconcile + PUSH (MAINT.14); PK cleanup; retire `SYNC_TRACKER.md`. Closes the SYNC arc.

## Context to preserve

- **Courier deliverables land in `~/Downloads`**, not `docs/logs/` — and SYNC-prefixed PK decoys exist (`SYNC.3.5-refinement-*`, `*-CLOSE-OUT-index`, `SYNC.4-ranking-design-brief.html`, `chat_close_*_SYNC_*`). Future courier prompts name the exact target files + flag the decoys.
- **Commit identity = the Foundation operational identity (`Zugzwang/world`); no co-author trailer** — the established convention.
- PR #60 merged **before** web review of the diff — for this PR the risk was negligible (additive docs-only, all checks green, CC's report matched spec). **For critical-path PRs (engine / ledger / commentary-moderation / auth) the pre-merge web review remains non-negotiable.**

## Time

2026-06-02.
