# SCAFFOLD.2 stratum 3.A — Setup + F-* skeletons (session log)

> Per-session log per CLAUDE.md §5.9. The 3.A entry originally lived as
> `## Stratum 3.A` in `docs/logs/SCAFFOLD.2.md` (introduced in PR #24,
> commits `f6ae91b` + `1ced8c2`); extracted to this per-stratum file in
> 3.E when `docs/logs/SCAFFOLD.2.md` was rewritten as the task-level
> close-out. Content below preserved from `e6a136a:docs/logs/SCAFFOLD.2.md`
> (heading levels shifted one for standalone-file structure; no
> substantive edits).

**Date:** 2026-05-11
**Branch:** `feat/scaffold-2-stratum-a`
**PR:** #22 (merged at 97d3cdb)
**Session length:** ~1 chat

---

## What landed

- `package.json`: 8 new deps (drizzle-orm ^0.45.0, drizzle-zod ^0.7.0, postgres ^3.4.5, uuid ^11.0.0, server-only ^0.0.1 in deps; drizzle-kit ^0.30.0, vitest ^3.0.0, @types/uuid ^10.0.0 in devDeps) + `pnpm.onlyBuiltDependencies`
- `pnpm-workspace.yaml`: newly git-tracked; `allowBuilds: { esbuild: true, lefthook: true, sharp: true }`
- `pnpm-lock.yaml`: regenerated cleanly (no churn beyond new deps + transitive)
- `mise.toml`: `supabase = "latest"` (resolved 2.98.2)
- `justfile`: `db-generate`, `db-migrate`, `db-reset`, `test-db` recipes; `verify` unchanged
- `drizzle.config.ts` (new) — `tablesFilter: ["!events"]` per ADR-0005 §5
- `src/db/index.ts` (new) — `import "server-only"` first; `DbClient` + `DbTransaction` type aliases for ENGINE.7
- `src/db/schema/index.ts` (new) — empty `export {};` re-export aggregator; 3.B fills
- `.env.example` (new) — local Supabase URL template
- `docs/specs/flows/` — README + 40 F-\*.md skeletons (38 active + 2 struck audit-trace for F-COMMENT-4/5)

## Decisions made

**Plan-doc variances (3, all captured in PR #22 body):**

1. **`server-only` added as 8th dep.** Plan listed 7; required by `src/db/index.ts` `import "server-only"` first-statement discipline per ADR-0008 §1. Pinned `^0.0.1` — only published version on npm and matches what Next.js 16.2.4 bundles transitively.

2. **`pnpm-workspace.yaml` now git-tracked.** Plan's pre-flight note "(already addressed in pre-flight per `lefthook` + `sharp` approval)" referenced the pnpm 10 era mechanism (`pnpm exec lefthook install` direct). pnpm 11 strict mode requires explicit `pnpm approve-builds`, which writes `allowBuilds:` to `pnpm-workspace.yaml`. Pre-flight catchup done in this commit. AGENTS.md §10 line "`pnpm-workspace.yaml` not used (single package)" is now technically inaccurate for build-approval purposes — **fix deferred to PRECURSOR.5 sweep per user instruction.**

3. **`src/db/schema/index.ts` placeholder added.** Not in plan's file list. Required for `import * as schema from "./schema"` in `src/db/index.ts` to resolve under bundler module resolution before 3.B's per-domain files land. One-line `export {};` stub; 3.B replaces with real `export * from './<domain>'` re-exports.

**Judgment call (one, surfaced via AskUserQuestion):**

- F-COMMENT-4 / F-COMMENT-5 (struck flows per SPEC.2 §13.3) Status line **overridden** to `STRUCK from v1 per SPEC.1 §8 — no gating task; preserved as audit trace per SPEC.2 §13.3` instead of the plan's verbatim "skeleton (substance pending per SPEC.2 §13.4 gating cadence)" template. User selected the override (deliberate divergence from "verbatim") because the cadence is inapplicable for flows that will never receive substance. Active 38 use verbatim template Status.

**F-\* enumeration audit (per plan's pre-generation gate):**

- SPEC.2 §13.3 inventory authoritative: 40 rows across 7 prefix families
- Prior estimate gap of 3 filled by F-MOD-5 (manual mod queue review), F-DEBATE-4 (debate view poll), F-ADMIN-5 (audit-log search)
- F-ADMIN-6 (raw-grep hit) is **deleted** per SPEC.1 2026-05-03 change-log — not in scope
- F-DATASET-1 (raw-grep hit) is gated to SCAFFOLD.18 — not in scope at 3.A

## Open questions

None blocking 3.B. Carry-forward items:

- AGENTS.md §10 line correction queued for PRECURSOR.5 sweep (declined here per user)
- pnpm version mismatch: AGENTS.md §10 says pnpm 10; corepack-resolved pnpm is 11.0.9 (mise installs 10.33.2 but corepack overrides). Not blocking; flag for the same sweep.

## Next session starts at

**Stratum 3.B — Drizzle schemas (21 tables, 9 domains).**

- Branch `feat/scaffold-2-stratum-b` from `main` (after `/clear`)
- Read `docs/plans/SCAFFOLD.2.md` stratum 3.B section in full FIRST
- 11 schema files at `src/db/schema/<domain>.ts` per SPEC.2 §5 inventory + ADR-0008 §4
- All PKs declare `uuid("id").primaryKey().default(sql\`uuidv7()\`)` per ADR-0016 D3
- drizzle-zod insert/select schemas co-located per ADR-0008 §5
- ADR-0009 ratification (`friendly_fire_events.cleared_at` = nullable timestamp; two independent whitelisted transitions) lands as same-commit ADR amendment per plan's stratum 3.B "Manual review gate"
- `src/db/schema/index.ts` placeholder gets real re-exports

## Context to preserve (non-obvious)

- `src/db/schema/index.ts` currently `export {};` — placeholder for compile; 3.B replaces
- `bets.comment_id` FK target is `comments.id`. Per ADR-0008 §6.1, use lambda form `.references(() => comments.id)` to handle the circular reference
- `system_state.id` is **text `'system'`** carve-out from universal UUIDv7 rule per SPEC.2 §20.2 single-row sentinel discipline; ADR-0016 amendment in 3.C, not 3.B
- The 13 protected tables (9 Bucket A + 4 Bucket B per SPEC.2 §5.1) only become "protected" once 3.C's append-only triggers land; 3.B is type-only
- `events` table is declared in `src/db/schema/events.ts` for type inference + drizzle-zod ONLY — actual DDL is hand-written in 3.C's `0002_events_partitioning.sql` because Drizzle can't express PARTITION BY RANGE. `drizzle.config.ts` already excludes it via `tablesFilter: ["!events"]`
- pnpm 11 strict mode: any new dep with a postinstall script will require `pnpm approve-builds <name>` + a commit to `pnpm-workspace.yaml`. Watch for this in 3.C/3.D if test deps grow
- supabase CLI invoked via `mise exec -- supabase ...` (shell activation not configured on this machine)
- `just verify` is DB-free (typecheck + biome + build only). DB-touching verification is `just test-db` and requires `supabase start` running
- Lefthook hooks installed (`approve-builds` triggered `lefthook postinstall: sync hooks: ✔️ (pre-commit, pre-push)`); pre-push runs typecheck + biome
