# SYNC-6 · BUILD — plan

**Generated** 2026-09-03 from `origin/main` @ `ead741577b89849560ab3d3222a48b2a69bf18b7`
**Branch** `docs/sync-6-records` · **Worktree** fresh, per OVN-O6
**Doctrine** `docs/overnight-run.md` v1.2 (699 lines) · **Mode** autonomous overnight, zero operator gates
**Recon** `~/Downloads/zz_SYNC-6-BUILD_recon_2026-09-03T1302.md` (not in repo — O-11 artifact)

---

## 1 · What this builds

Ten files: **nine new** and **one moved**. They replace, for the purpose of *knowing what
exists*, the 366 documents in `docs/logs/` (236) and `docs/plans/` (130) — measured, not
quoted. The records are generated from code, specs, ADRs and the commit log, never from
prose about the code, so any of them can be regenerated against a later commit. That
regenerability is the design; `docs/records/README.md` is what makes it repeatable.

**This pass adds and moves. It deletes nothing and edits no prescriptive document.**

---

## 2 · File order, and each file's exit condition

Order is chosen so that (a) the only file touching existing paths lands first, while there
is still a whole night to notice breakage, and (b) findings accumulate before the index
that lists them is written.

| # | File | Exit condition |
|--:|---|---|
| 1 | **RF-1** `docs/records/ENGINE-record.md` | `git mv` clean; non-walled inbound references updated; dangling count measured and reported; full suite run |
| 2 | **RF-6** `docs/records/PLATFORM-record.md` | §2 environment table carries a command per cell; every status word has a path |
| 3 | **RF-2** `docs/records/AUTH-record.md` | §4 states the admin/participant separation with the file:line that enforces it |
| 4 | **RF-3** `docs/records/DEBATE-record.md` | §4 states moderation posture **per branch**, text and image separately, in/outside tx |
| 5 | **RF-4** `docs/records/SURFACES-record.md` | placeholder inventory present, counted from the code, file:line per row; REMOVED surfaces listed with their ADR |
| 6 | **RF-5** `docs/records/ADMIN-record.md` | ADR-0026/0027 supersession resolved from the route's own file:line |
| 7 | **RF-7** `docs/records/SCALE-record.md` | the absent load report stated as absent, no number reconstructed; `S-n` collision named |
| 8 | **RF-8** `docs/records/DATASET-record.md` | coverage stated honestly — test / round-trip proof / neither |
| 9 | **RF-9** `docs/records/README.md` | a regenerate command per record, each one runnable |
| 10 | **RF-0** `docs/STATE.md` | §1 shows its working; §4 carries every finding; §2 links resolve to files that exist |

**One commit per file, pushed immediately.** A night that dies at 4am leaves every completed
record on the branch.

---

## 3 · Source map

| Record | Code read | Specs / ADRs read |
|---|---|---|
| **AUTH** | `src/server/auth/**`, `src/server/auth/admin/**`, `src/server/identity-pool/**`, `src/server/onboarding/**`, `src/app/(auth)/**`, `src/app/api/auth/**`, `tests/server/auth/**`, `tests/unit/onboarding/**` | SPEC.1 §13, flows `F-AUTH-1..5` + `F-AUTH-ADMIN`; ADR-0004, 0010, 0011, 0016, 0033, 0037, 0043 |
| **DEBATE** | `src/server/comments/**`, `src/server/moderation/**`, `src/server/debate-view/**`, `src/server/debate-export/**`, `src/lib/ranking*`, `src/app/api/bets/place/route.ts`, `src/app/(public)/m/[slug]/**` | SPEC.1 §8/§9/§15, `docs/specs/RANKING.md`, `docs/specs/debate-export.md`, flows `F-COMMENT-*`, `F-DEBATE-*`, `F-MOD-*`; ADR-0014, 0017, 0020, 0021, 0025, 0028, 0034, 0039 |
| **SURFACES** | `src/app/(public)/**`, `src/components/{debate,discovery,profile,shell,onboarding,art,legal,ui}/**` | SPEC.1 §21, §22, §23; `docs/design/*`; ADR-0023, 0032, 0037, 0040, 0041, 0045 |
| **ADMIN** | `src/app/(admin)/**`, `src/server/admin/**`, `src/server/auth/admin/**`, `src/server/resolution/**`, `src/server/markets/**` | SPEC.1 §15, flows `F-ADMIN-1..5`; ADR-0010, 0021, 0026, 0027; `docs/runbooks/BREAK_GLASS.md` |
| **PLATFORM** | `src/app/api/health/route.ts`, `src/server/{upstash,idempotency,middleware,storage,observability,health}/**`, `scripts/{migrate-*,check-migration-drift}.ts`, `next.config.ts`, `vercel.json` | ADR-0003, 0005, 0006, 0007, 0008, 0015, 0022, 0024, 0029, 0030, 0031, 0041, 0042, 0044; `docs/runbooks/deploy-pipeline.md`, `staging-provisioning.md` |
| **SCALE** | `tests/scale/**`, `tests/staging/**`, `docs/plans/S-*`, `docs/logs/S-*`, `docs/logs/S4-*` | ADR-0038, 0043, 0044; open PR #462 |
| **DATASET** | `src/server/debate-export/**`, `src/app/(public)/m/[slug]/export/route.ts`, `public/zugzwang.md`, PR #435's branch | ADR-0025; `docs/runbooks/dataset-release.md`; SPEC.1 §12, §20 |

---

## 4 · Ambiguities resolved in recon, and the alternative rejected

| # | Ambiguity | Chose | Rejected | Why |
|--:|---|---|---|---|
| 1 | **RF-1 says "update every inbound reference"; the walls forbid editing ADRs, `docs/parked.md` and code.** 4 of the 10 reference lines sit in walled files. | Move; update only the **non-walled** references; record the 4 walled ones as dangling, with file:line. | Editing ADR-0005 / `parked.md` / the script to keep the count at zero. | The wall is stated absolute with "Zero exceptions" and carries its consequence; RF-1's zero-dangling target is a goal, not a wall. A recorded dangling pointer is repairable in one line by whoever owns those files; a wall broken at 3am is not. **Consequence: the post-move dangling count is 4, not 0, and that number is reported rather than engineered away.** |
| 2 | Is the moved file's own header line 3 (`> **Doc:** docs/logs/ENGINE-phase-record.md`) an "inbound reference" to update, or "body" to leave? | **Update the path token only.** | Leaving it, on a literal reading of "Body untouched". | RF-1's grep is "across the entire tree" and returns that line, so it is in the set. Leaving it ships a file whose third line states a path it does not occupy. One token changes; no sentence does. |
| 3 | Should historical plans (`DEBATE.2.md`, `DEBATE.3.md`) have their citations rewritten? | **Yes** — they are not walled and RF-1 is explicit. | Leaving them, on the grounds that rewriting a June plan's citation changes what it said. | The tension is real and is logged. A pointer is not a claim; a dangling pointer costs a reader a search, and these are the documents the records exist to make navigable. |
| 4 | File order — the prompt lists RF-0 first. | **RF-0 last**, RF-1 first. | Literal order. | §0 permits reordering. RF-1 is the only file touching existing paths, so it goes first while there is a night left to notice. STATE.md §4 collects findings the lane records generate, so writing it first would guarantee it incomplete. |
| 5 | Does `pnpm install` in the fresh worktree violate "never touch config"? | **No** — install, because the prompt mandates two full-suite runs and a fresh worktree has no `node_modules`. | Running the suite from another worktree. | `--frozen-lockfile` writes no tracked file; `git status --porcelain` verified empty after. Running from another worktree would measure a different SHA. |
| 6 | `ResolverCards.tsx` states an inventory arithmetic that does not work (6 − 4 = 5). Fix it? | **Record it.** | Correcting the comment. | It is `src/`. Doubly walled, and the wall's reason applies exactly: a silent fix makes the record disagree with the thing it describes. |

---

## 5 · RF-1 baseline (OVN-V4)

**Measurement layer:** `git grep` over the **tracked tree**, not the working directory —
the working directory carries `node_modules` and untracked scratch, and the question is
what a reader following a link in the repository will hit.

| | Value |
|---|---|
| Inbound reference **lines** before the move | **10** |
| Distinct **files** before the move | **7** |
| Positive control (OVN-V1) — same pattern for `overnight-run` | **18** lines · the pattern shape finds real references |
| Of the 10: **walled** (must stay dangling) | **4** — `docs/adr/0005-postgres-event-sourcing.md:19` · `docs/parked.md:816` · `docs/parked.md:822` · `scripts/stage-reviewer-project.sh:70` |
| Of the 10: **updatable** | **6** — `docs/handover/project-kit/SOURCES.md:128` · `docs/plans/DEBATE.2.md:69,193,235` · `docs/plans/DEBATE.3.md:47` · the file's own header `:3` |
| **Predicted dangling after the move** | **4** — exactly the walled set, and no others |

⛔ **`scripts/stage-reviewer-project.sh` is already dead on `origin/main`, before this change.**
Run at `ead7415`: `ERROR: expected 29 ADR decision files at $SHA, got 43`. It exits at that
gate and never reaches its `ENGINE-phase-record` line. **The move does not break it; fourteen
ADRs did, some time ago.** Recorded as a finding.

---

## 6 · Reviewer cascade — every record is reviewer-bearing

Run **after** all ten files exist, so each reviewer sees the whole set (OVN-O8: measurements
are taken **before** the cascade, never during it, because a mutation-testing subagent writes
to the tree).

| # | Reviewer | Scope | Failure mode to hunt |
|--:|---|---|---|
| 1 | `@code-reviewer` | every `file:line` citation in all ten records | a citation that resolves to a real file but the wrong thing; a status word the cited code does not support. **Sample ≥ 30 across all nine new files, report the hit rate.** |
| 2 | `@test-writer` | every "Proved by" cell | a named test that exists but asserts something other than the feature claimed; a `none` that is wrong because a test exists under a name I did not search for. **Read-only — this task writes no tests.** |
| 3 | `@security-auditor` | the ten files as **published artifacts** in a public AGPL repo | a secret value, an internal URL, a participant identifier, an admin path detail, an environment fact that must not be public the moment the PR opens |

Findings are acted on in-session. Declines are logged with reasoning. **Any fix authored after
the reviewer that would have caught it is listed in the run report's UNREVIEWED-FIX LIST**
(doctrine §6 item 8, §7.1) — that list is the only mitigation F-11 has.

---

## 7 · Test-suite obligation

Docs-only CI reads nothing, so the suite is the only instrument that can catch a moved path
something depended on. **Run the full suite twice**: once immediately after RF-1, once at the
end. Report both, including counts and any red, with the OVN-V8 rotation question asked if a
red appears.
