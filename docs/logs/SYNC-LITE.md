# SYNC-LITE — MAINT.19 fork heal + MAINT.20 citation refresh + PK staging (session log)

Three-part maintenance arc in one session, operator-relayed with web gates: Part 1
ground check + recon (read-only) → Part 2 execute (MAINT.19 + MAINT.20, one docs
branch, PR #226) → Part 3 PK-kit staging (repo read-only, Desktop writes) → this
close-out log on `chore/sync-lite-log`. Kickoffs operator-relayed; STOP-1 (byte gate)
and STOP-2 (web diff-read) both honored; CC merged nothing.

## 1. What landed (files + PR#)

**PR #226 — squash `abb255d` on `main`** (canonical, read via
`gh pr view 226 --json mergeCommit`; branch SHA `f33d86e` ephemeral). One signed
commit, exactly 4 files, doc-only:

- `docs/design/design-handoff.md` — fork healed v0.2→**v0.6-draft**, wholesale
  replacement gated on md5 `722c480a356fbc8b02a9e715818dd69b` (PK-canonical bytes).
- `docs/design/design-workflow.md` — same heal, md5 `c0ed164133ee61acf68eac08bccdc2f8`;
  both headers carry the 2026-07-03 branding-realignment pointer.
- `CLAUDE.md` — line 18 `SPEC.1 (product, 1.0.14)`→`1.0.15` + `tracker_v16.html`→
  `tracker_v17.html`; line 203 `tracker_v16`→`tracker_v17`; line 232 provenance clause
  `; SPEC.1 cite refreshed to 1.0.15 at SYNC-LITE (Jul 16, 2026)` appended after the
  Jul-7 anchor (sentence kept intact). Line 205 historical `1.0.11 / 1.0.12` untouched.
- `AGENTS.md` — line 280, same provenance clause at the same anchor.

Predicates at commit (all held): `1.0.14` ×2 (both inside the Jul-7 provenance
sentences) · `1.0.15` ×3 (CLAUDE 18 + the two clauses) · `tracker_v16` zero ·
`tracker_v17` ×2 (CLAUDE 18/203) · exactly 4 modified files. CI green (required `ci`
3m40s + Vercel); web diff-read passed at STOP-2; operator merged.

**Part-3 staging (not repo content)** — `~/Desktop/zz-pk-refresh-SYNC-LITE/`, 7 files
fresh from post-#226 `origin/main`, every disk md5 == blob md5: five unchanged from the
P2 kit (canon `ca715613…` · language `9334b726…` · contract `3ed3433b…` · BRIDGE-plan
`554a9b0d…` · BRIDGE-log `863c33d5…`) + the two **new** post-#226 hashes — CLAUDE.md
`4b8db8bd15e2aad7d5634e33f81481d9` · AGENTS.md `67fb2d1af01725aeeeb74bd0cad8ecb4`.
Mockup grounding for the 11 conditional PK deletions: `git ls-files docs/design/`
shows exactly **11** tracked `.html` mockups (8 `DESIGN_W2_*` + 3 `surface_*_v1_0`).

**This log commit** — `docs/logs/SYNC-LITE.md` only, on `chore/sync-lite-log`; PR
"docs(logs): SYNC-LITE session log"; operator merges on green.

## 2. Decisions made

- **STOP-1 round 1 = hard stop, zero changes.** Operator reported the drop but the repo
  files still hashed v0.2 (`8b5c4418…`/`fe9974c9…`). No workaround, no edits; read-only
  diagnostic located the true files in `~/Downloads` as browser-deduped
  `design-handoff (2).md` / `design-workflow (2).md` (Jul 16 14:06) with exact expected
  md5s, amid four stale decoys (plain-named Jun 4/5, `(1)` copies Jul 3).
- **Byte source = the hash-verified `(2)` files, never the chat paste.** Operator
  authorized "add them yourself"; the copy ran from explicit `~/Downloads` paths after
  re-hashing source, then re-gated on destination md5 + `head -4` (both v0.6-draft).
  Chat-pasted text was rejected as a byte source (transport never survives an md5 gate;
  only one of the two files was pasted anyway).
- **Edit mechanics:** substring-only edits per kickoff; the line-203 edit anchored with
  backtick context (`` ; `tracker_v16` is planning/sequencing only. ``) so it could not
  collide with line 18's `tracker_v16.html`; provenance clauses appended without
  touching the Jul-7 sentence.
- **Session log deferred from #226** — kickoff pinned the commit at exactly 4 files;
  deviation flagged at STOP-2 rather than silently absorbed; landed here (§5.9).
- **Canonical-SHA discipline held:** `abb255d` read from `gh pr view --json mergeCommit`
  and cross-checked against the fetched `origin/main` tip before Part-3 staging.

## 3. Open questions

- **Parked biome warning** (pre-existing, EXTAUDIT-05 close-out row): unused `eq` import
  in `tests/server/moderation/moderation-blocked-event.test.ts` — surfaced again by the
  pre-push hook, not this session's to fix.
- **stash@{0}** (EXTAUDIT-06 stray: R2 market-media env quad in `.env.example`) — still
  parked, untouched all session; operator to rule intentional-or-not.
- **PK-side actions are unverifiable from the repo:** the 7-file drag from
  `zz-pk-refresh-SYNC-LITE`, the 11 conditional mockup deletions, and trashing the
  superseded `zz-pk-refresh-P2/` are operator actions in web project knowledge.

## 4. Next session starts at

Operator merges this log PR on green, then runs the PK drag pass (SYNC-LITE folder, not
P2). Next CC session: post-merge sync — assert HEAD==main before any reset, read the
squash SHA via `gh pr view`, then clean both merged locals (`docs/sync-lite-maint-19-20`,
`chore/sync-lite-log`): squash-merge means `branch -d` refuses — gate on zero diff vs
`origin/main` then `-D`; check `git ls-remote` for remote leftovers (auto-delete is
inconsistent). Then the next task per **tracker_v17**.

## 5. Context to preserve

- **PK re-stage note (the reason Part 3 exists):** the P2-staged CLAUDE/AGENTS
  (`b42ea9f2…`/`8c6dcb11…`, staged Jul 16 01:06) were superseded the same day by #226 —
  the drag pass MUST use `zz-pk-refresh-SYNC-LITE` (CLAUDE `4b8db8bd…` / AGENTS
  `67fb2d1a…`); the other five kit files are byte-identical between the two folders.
- **`~/Downloads` decoy field is live:** plain-named + `(1)` + `(2)` design-guide
  variants all remain; a future web delivery will dedupe to `(3)`. Always gate on md5,
  never on filename.
- Live citations now: **SPEC.1 1.0.15** (CLAUDE.md:18) · **tracker_v17** (CLAUDE.md:18,
  :203); the two footers keep the Jul-7 `1.0.14` citation inside their provenance
  history by design — a future grep for stale `1.0.14` must read context before
  "fixing" those two hits, and CLAUDE.md:205 keeps `1.0.11 / 1.0.12` (ADR-0026 history).
- The guides' fork existed because v0.3→v0.6 evolved web-side only (repo history for
  both files was just #68 mint + #70 v0.2). If a guide is amended web-side again, land
  the repo copy same-day to avoid re-forking.

## 6. Time

2026-07-16, single afternoon sitting (IST): Part-1 recon → Part-2 execute with two
operator stops (drop heal ~14:06; STOP-2 → merge) → Part-3 staging 14:32 → close-out
immediately after. CI on #226: 3m40s.
