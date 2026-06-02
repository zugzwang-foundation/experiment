# SYNC.8 — AGENTS.md + CLAUDE.md rebuild

> **Stage:** SYNC.8 — rebuild AGENTS.md (descriptive, CC-authored-from-repo, web-reviewed) then CLAUDE.md (mixed: web-drafted invariants + CC-verified file-map refs). **Status:** CLOSED.
> **Mode:** Web Claude sole author/reviewer. Claude Code ON HOLD — read-only recon only (HEAD `27216fc`); no repo writes.
> **Deliverables:** full `AGENTS.md` + full `CLAUDE.md` (exactly 225 lines), single files, not diffs.
> Refreshed for `docs/logs/` at SYNC.9 from the SYNC.8 close-out (six fields per CLAUDE.md §5.9).

---

## What landed

Both files rebuilt from scratch against live repo `27216fc` + SPEC.1 v1.9.0-draft + SPEC.2 + ADRs 0003–0019. All 23 recon deltas corrected. CLAUDE.md weighted to CC's runtime needs (§5 workflow largest; §1 vocabulary + §2 invariants/landmines next; governance lighter).

**AGENTS.md — descriptive, CC-authored-from-repo:**
- Real versions (Node via `.nvmrc` `‹CC-VERIFY›`, pnpm 10.33.2, Next 16.2.4, React 19.2.4, drizzle-orm 0.45 / kit 0.30, better-auth 1.6.11, Biome 2.4.13 width 80); real tree (schema at `src/db/schema/`, **21 tables across 11 files**, client `src/db/index.ts`); real `justfile` / CI / lefthook / auth wiring.
- Reply-as-bet reality + a prominent **specs-ahead-of-code** pointer naming the pre-fold artifacts still on disk (`friendly_fire_events`, nullable `comments.bet_id`, `stake_at_post_time`, `ff_direction`) and pinning their removal to **DEBATE.8/9**, not before.

**CLAUDE.md — the contract (225 lines):**
- Header: advisory-not-enforcement · loads-every-session · lean-maintenance.
- §1 frame + operating model + Vocabulary (16 domain terms) + critical paths + specs-ahead guardrail (one line; detail delegated to AGENTS §6).
- §2 four invariants table + mandatory-commentary + architecture & money landmines (event-sourced / never-mutate-in-place; `NUMERIC(38,18)` / never-JS-floats; fail-modes rate-open / idempotency-closed / moderation-closed).
- §3 eight refusal triggers · §4 push-back engagement.
- §5 workflow 5.1–5.13 (+ Gotchas + `ultrathink`).
- §6 four subagents (per-line) + **hooks/skills NOT installed** + the prioritized enforcement-gap install list + CC = Opus 4.8.
- §7 maintaining + 15-entry decision log + closing ritual · §8 closing rule + provenance footer.

Resolves `.claude/` hooks/skills (ruling #2 / D6): documented as NOT installed. Records CC-on-Opus-4.8 + CLAUDE-as-advisory. Absorbs the dissolved PRECURSOR.5 sweep (MAINT.2/6/7/11/12).

## Decisions made

1. **225 lines, by operator ask.** A maximally-lean version landed ~180; the headroom was spent on genuinely CC-load-bearing content (vocabulary, gotchas, enforcement-gap list, fuller §5 bodies), not filler. A still-leaner ~180–200 file would also be defensible (shorter loads = better adherence) — 225 was the explicit target.
2. **Specs-ahead detail → AGENTS.md §6; CLAUDE.md keeps one guardrail line** ("don't reconcile schema outside DEBATE.8/9"). Avoids duplicating schema detail in the always-loaded file.
3. **AGENTS.md describes the on-disk schema truthfully** (vestigial artifacts named + tagged) so CC doesn't tidy them out-of-sequence.
4. **Hooks/skills/`settings.json` documented as NOT installed.** The prior CLAUDE.md §6 claimed four hooks (block-destructive, block-main, format-and-typecheck, session-start) that do not exist on disk; the gap is now explicit with a prioritized install list.

Founder-facing explainer HTML — declined by operator. Not touched: SPEC.1, SPEC.2, ADR bodies/statuses, RANKING.md, cpmm.md, the tracker, memory, project instructions.

## Open questions

`‹CC-VERIFY›`: confirm the `.nvmrc` Node value in AGENTS.md at/before commit. Enforcement-gap install (PreToolUse `block-main-commits` / `block-destructive`, post-edit `format-and-typecheck`, `permissions.deny`, optional commitlint) is a dedicated HARDEN-adjacent hooks task — not now.

## Next session starts at

**SYNC.8.5 — instructions + memory refresh.**

## Context to preserve

In sync after this pass: SPEC.1 v1.9.0-draft ↔ SPEC.2 ↔ ADR-0017/0018/0019 ↔ CLAUDE.md ↔ AGENTS.md — all describe reply-as-bet, ranking = 0017, two floors, RLS-out, CC = Opus 4.8. Still trailing (tracked): built schema behind specs → DEBATE.8/9; ADR-0017 body + statuses → SYNC.BACKFILL; RANKING.md → DEBATE.8; cpmm.md → own chat; ADRs on disk (only 0001) + tracker_v11 → SYNC.BACKFILL / SYNC.10; account/project memory + instructions → SYNC.8.5. CC was on hold — no `docs/logs/` entry, no branch/PR; the CLAUDE.md/AGENTS.md repo commit rides SYNC.9/10.

## Time

Single web doc-authoring session; no stopwatch recorded.
