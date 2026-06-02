# SYNC.10 — Final canonical commit · reconcile + PUSH · PK cleanup

*Per-session log (CLAUDE.md §5.9). This log rides PR-B (the canonical docs commit) and is authored before PR-B merges, so PR-B's own number and squash SHA are recorded in the chat close-out, not here — a session log cannot contain its own merge SHA.*

## What landed (files + PR#)

**PR-A — #61 → squash `5d7b527`** (signed; 3 checks passed; branch deleted). Reconciled the unpushed local commit `27216fc` onto `origin/main` as an isolated squash (MAINT.14):
- `drizzle/migrations/0008_comments_bet_id_idx.sql` (+1) + `meta/0008_snapshot.json` + `meta/_journal.json`
- `src/db/schema/comments.ts` (+1 — `index("comments_bet_id_idx").on(table.betId)`)
- `REVIEW.md`, `docs/logs/REVIEW-2026-05-29.md` (cold-review artifact: 0 critical/high, 10 medium, 11 low; deferred logged)

Local `main` then `reset --hard origin/main` → `main == origin/main == 5d7b527`, `0 0` delta. Divergence closed; `27216fc` reflog-recoverable.

**PR-B — canonical docs bundle** (this commit; 6 files):
- `docs/specs/SPEC.1.md` — **v1.9.0-draft** (overwrites the committed pre-SYNC.7 version)
- `docs/specs/SPEC.2.md` — **v0.4.0-draft** (overwrites the committed version)
- `CLAUDE.md`, `AGENTS.md` — **rebuilt** (SYNC.8); carry **ADRs 0003–0019**, superseding the committed `0003–0016` (objective c achieved by the overwrite — no surgical find/replace)
- `AGENTS.md` — **no-`Co-authored-by`-trailer commit convention** added to the git-hygiene section + the `‹CC-VERIFY›` `.nvmrc` Node placeholder resolved against the live `.nvmrc` (Node 24)
- `docs/logs/SYNC.9.md`, `docs/logs/SYNC.10.md`

## Decisions made

- **Two-PR reconcile (Option 2, founder-ratified).** The migration commit `27216fc` carries a real schema change, so it lands as its **own** revertable/bisectable squash (PR-A) *ahead of* the docs-only PR-B; PR-A merged first so PR-B branches off a reconciled `main`. Rejected Option 1 (one combined PR) — it would weld a migration into a docs commit.
- **Reconcile = cherry-pick onto a branch off origin, then `reset --hard` local `main` to origin.** Not push-as-is on the stale base `92b7c47`; not a replay of `27216fc` onto origin (its content is already on origin via the squash). Content preserved; old pointer reflog-recoverable.
- **Co-author trailer in `5d7b527` — landed deviation, recorded, not remediated.** The `Co-authored-by: Claude Opus 4.8` trailer rode the cherry-picked branch-commit body verbatim, and GitHub composed the #61 squash body from it; the merge-dialog strip did not catch it. Stripping it now requires rewriting merged `main` (forbidden, and `main` is protection-locked). Left as-is. **Recurrence prevented by codifying the no-trailer convention in AGENTS.md (Option A):** strip the trailer at commit time (`git commit --amend`), backstop in the squash-merge dialog. The branch commit was a faithful replay and was left unrewritten by design.
- **Range bump by overwrite.** The rebuilt CLAUDE.md/AGENTS.md already cite `0003–0019`; committing them over the stale `0003–0016` is the bump. No edit hunt.
- **Tracker kept external (Option B).** `tracker_v11.html` is a project-knowledge-resident planning/sequencing instrument — explicitly non-canonical (CLAUDE.md L18: "planning/sequencing only; on conflict, spec/ADR wins") and, per established practice, **not committed**. The trigger to decide was a Biome trip on its embedded `<script>` (8 errors) when it was staged, but the decision rests on doctrine, not the lint: committing it would require a Biome carve-out and would accrete planning snapshots into a source tree whose discipline is "all source is linted." The durable in-repo record of the SYNC arc is `docs/logs/` + the specs + ADRs; the tracker stays where it lives and is superseded by future versions.

## Open questions

- Deferred (HARDEN-adjacent, **not** SYNC.10): the general hook-scoping fix (pre-push still lints the whole tree) + the SYNC.8 enforcement-gap install.
- **Node version drift corrected:** memory carried "Node 22"; `.nvmrc` + `mise.toml` both pin **24**. Memory updated to match the repo at close.

## Next session starts at

**PRECURSOR.4** — fresh-session SPEC.1 + SPEC.2 v1.0 lock-review (ADRs 0017/0018/0019 folded; drift D3/D11 resolved), promoting both specs to v1.0, and reconciling SPEC.2's as-of-SYNC.7 notes (e.g. "only `0001` on disk", "companion specs not yet on disk"). The hard gate before any ENGINE code, and a different session from the SYNC.7 author (writer/reviewer separation). **Not** this session.

## Context to preserve

- **GitHub is canonical; SPEC > ADR > tracker.** `origin/main` now holds the full canonical bundle; local == origin, no unpushed delta.
- **PK reconciled to the repo:** loose close-outs (`chat_close_*`, `SYNC_3_5-*`, `SYNC.4-ranking-design-brief.html`, the SYNC.* outputs) removed once their `docs/logs/` replacements existed and the repo was confirmed whole; SOCIAL.WEDGE-MARKETS + `MKT*` docs removed (E17 scrapped per SYNC.8.5); `SYNC_TRACKER.md` retired (it was never committed — PK removal only). **`tracker_v11.html` stays in PK** — the live planning instrument, intentionally uncommitted.
- **ADR PK statuses re-synced** to the committed files: 0009 `superseded` (by 0017); 0017/0018/0019 `accepted`.
- The **SYNC arc is closed.** Forward: PRECURSOR.4 lock → ENGINE.

## Time

2026-06-02.
