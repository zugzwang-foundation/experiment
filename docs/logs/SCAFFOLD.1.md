# SCAFFOLD.1 — close-out log

**Date:** 2026-05-14
**Branch:** `feat/scaffold-1` → merged into `main` as `e9e1378`
**PR:** [#33](https://github.com/zugzwang-foundation/experiment/pull/33) — `feat(scaffold-1): Tailwind v4 + shadcn/ui + Turbopack plumbing`
**Duration:** ~3 hours wall (plan 1h + execute 2h)
**Surfaces:** web Claude (Opus 4.7) + Claude Code (Opus 4.7 max effort, accept-edits-on)
**Predecessor:** PRECURSOR.5 close at `e0ef868`
**Successor:** SCAFFOLD.14 (auth vendor onboarding) → SCAFFOLD.3 (auth wiring) — or VISUAL phase DESIGN.1 in parallel

---

## What landed

### Commits (3, merged as `e9e1378`)

| Commit | Type | Files | Notes |
|---|---|---|---|
| `08aa2f1` | `chore(scaffold-1): plan` | `docs/plans/SCAFFOLD.1.md` (+546) | 546-line plan; 8 thesis-invariant analysis, 7-item smoke checklist, 6-item self-audit, 5-item drift table |
| `8569c35` | `feat(scaffold-1)` | 10 files | Implementation: Tailwind v4 + shadcn radix-nova + smoke page + drift absorption (5 items) |
| `8377386` | `chore(scaffold-1): gitignore` | `.gitignore` (+1) | Late housekeeping — `.claude/scheduled_tasks.lock` |

### Files in `8569c35` (10)

- `components.json` (new, +25) — shadcn config, AGENTS.md §3 path aliases, radix-nova style
- `src/lib/utils.ts` (new, +6) — standard `cn` helper (clsx + tailwind-merge)
- `src/components/ui/button.tsx` (new, +67) — shadcn radix-nova Button, 4 size variants + xs/icon-xs/icon-sm/icon-lg additive
- `src/app/(dev)/scaffold-1-smoke/page.tsx` (new, +18) — Server Component smoke target at `/scaffold-1-smoke`
- `src/app/globals.css` (full rewrite, +142/-25) — `@import "tailwindcss"` + shadcn `:root` / `.dark` / `@theme inline` + AGENTS.md §8 placeholder `@theme` block
- `package.json` (+7) — added: `class-variance-authority`, `clsx`, `lucide-react`, `tailwind-merge`, `tw-animate-css`, `@radix-ui/react-slot`, `shadcn` (runtime dep — intentional in 4.x architecture; ships `dist/tailwind.css` consumed via package.json subpath export)
- `pnpm-lock.yaml` (auto-generated, ~52KB)
- `pnpm-workspace.yaml` (+1) — `msw: false` in `allowBuilds` (drift absorption — required for pnpm 11 strict-mode to permit shadcn init)
- `AGENTS.md` (§1 row + §8 example + placeholder paragraph + §8 subsection title + content line, +3/-3 net) — 5 amendments
- `docs/maintenance.md` (lines 20 + 131, +2/-2) — tracker filename `_v7.html`

### Drift absorbed (5 items, per CLAUDE.md §7 cleanup-absorption rule)

| # | Drift | Resolution |
|---|---|---|
| 1 | AGENTS.md §1: Node 22 LTS via `.tool-versions` vs reality (Node 24 via `mise.toml` + `.nvmrc`) | One-line amendment to "Node.js 24 via mise" |
| 2 | AGENTS.md §8: `@theme` example values aspirational (Inter/JBM) vs repo (Geist) + missing placeholder prose | Example tokens point to `var(--font-geist-sans)` / `var(--font-geist-mono)`; placeholder paragraph covers BOTH colors AND fonts |
| 3 | AGENTS.md §8: subsection title "shadcn/ui — new-york v4" vs verified reality (radix-nova preset) | Title cascade: "shadcn/ui — base-nova preset (new-york v4 successor)" |
| 4 | `docs/maintenance.md`: 2× unversioned `zugzwang_experiment_tracker.html` references | Lines 20 + 131 → `_v7.html` |
| 5 | AGENTS.md §1: `pnpm-workspace.yaml not used (single package)` claim vs reality (file IS used since SCAFFOLD.2-a `97d3cdb`) | One-line amendment to remove "not used" claim |

`claude-progress.md` deviation from plan: kept gitignored with SURPRISE notes for review reference, rather than overwritten to 1-line stub. Per CLAUDE.md §5.11, file clears at next PR boundary. Defensible operational call by Claude Code.

---

## Decisions made

### Architectural

1. **shadcn 4.7 in runtime deps is intentional, not a bug.** Initial web-Claude framing called shadcn-in-deps a removal target. Phase 2 verified empirically: shadcn 4.x ships `dist/tailwind.css` (accordion keyframes) exposed via `package.json` subpath export; `globals.css` line 3 `@import "shadcn/tailwind.css"` resolves through that. Removing `shadcn` from deps breaks globals.css resolution. **Retracted via `claude-progress.md` Issue 2 strikethrough + explanatory paragraph in same artifact.**

2. **`radix-nova` is the new-york v4 successor preset in shadcn 4.7.** AGENTS.md §8's "new-york v4" naming was correct *at write time*; shadcn has rebranded the preset. Visual identity continues. §8 subsection title amended same-PR (drift absorption item #3) to "base-nova preset (new-york v4 successor)" — operational reality matches the visual-identity lineage.

3. **`msw: false` in `pnpm-workspace.yaml` allowBuilds is required for pnpm 11 strict-mode.** shadcn init wires `shadcn@latest` to runtime deps (intentional architecture per #1); that pulls `msw` as transitive; pnpm 11's `ERR_PNPM_IGNORED_BUILDS` aborts the install before shadcn writes `utils.ts` + `globals.css`. The deny-explicit decision unblocks init. Absorbed as drift item #5 (file inventory) — not scope creep.

4. **Placeholder treatment expanded to cover fonts AND colors.** Per user-locked decision at picker stage: defer all design choices to DESIGN.1 → DESIGN.7. Token NAMES stable (`--color-yes`, `--color-no`, `--color-brand`, `--font-sans`, `--font-mono`); only VALUES are placeholder. AGENTS.md §8 amendment text covers both axes.

### Workflow

5. **Auto mode rejected for Phase 2; accept-edits-on mode adopted.** SCAFFOLD.1 is non-critical-path per CLAUDE.md §1 (no `src/server/*` work), but auto mode is a separate concern from §5.10 audit carve-out. Repo has `.env.local` credentials + branch protection — not the "isolated environment" auto mode warns about. Accept-edits-on auto-confirms file edits (reversible via git), keeps bash prompts human-gated. Middle path adopted from screenshot 2 onwards.

6. **Pre-PR self-audit ran despite §5.10 carve-out.** Stricter-than-policy per kickoff. 6-item PASS/FAIL/SURPRISE format mirrors §5.10 critical-path audit shape. All PASS (2 PASS-with-finding). Paper trail in commit `8569c35` body.

7. **Smoke verification: 7 items, mixed CSS-proxy + browser session.** CC's smoke audit used built-CSS output proxy for items 4/6/7 (PASS); explicit deferral of full DevTools verification to human browser session. Browser verification completed post-push at `localhost:3000/scaffold-1-smoke`: visual PASS for items 4 (bg-yes/50 semi-transparent green) + 6 (Geist Mono); DevTools confirmation pending for item 7 (`--color-yes` getComputedStyle return).

### Operational

8. **Commit prefix convention: `feat(scaffold-1)` for implementation, `chore(scaffold-1)` for plan + drift housekeeping.** Lefthook does not enforce commitlint; convention matches PRECURSOR.5 precedent (`chore(precursor-5): doc + tooling sweep`).

9. **Branch rename caught + fixed pre-Phase-2.** CC initially created `tailwind-shadcn-turbopack-setup`; renamed to `feat/scaffold-1` per CLAUDE.md §10 / AGENTS.md §10 convention before any commits landed. No remote pollution.

10. **`docs/logs/SCAFFOLD.1.md` deferred from Phase 2 close to task close.** Per kickoff: "task close-out log lands at task close, not Phase 2 close." Log = this file, written at task close (post-merge).

### Retractions (preserved in `claude-progress.md` for traceability)

- **"shadcn CLI in runtime deps is a bug"** — wrong; intentional 4.x architecture. Retracted by CC empirical verification. Tightening B from web Claude's prior message dropped.
- **"SPEC.2 §23.4 calls tracker `_v6.html` or unversioned"** — wrong; SPEC.2 §23 + §23.4 already use `_v7.html`. Web Claude's pre-Phase-1 framing corrected by CC at plan time. Only `docs/maintenance.md` carried the drift.

---

## Open questions / non-blocking items

1. **Smoke item 7 DevTools confirmation pending.** Visual + DevTools confirmation for items 4 + 6 completed at browser. Item 7 (`getComputedStyle(document.documentElement).getPropertyValue('--color-yes')` returns `oklch(0.65 0.18 145)`) implied by item 4 working but not directly verified. Not blocking — confirm at SCAFFOLD.11 phase-exit smoke or DESIGN.7 token back-apply.

2. **`pnpm 11.0.9` actual vs `mise.toml` declares `pnpm = "10"`.** Real environment drift; not absorbed in SCAFFOLD.1 scope. Backlog item for focused `chore(tooling)` task. Either: investigate mise + corepack PATH precedence + disable corepack pnpm shim, OR update `mise.toml` to pin pnpm 11. Plan §5 Risk #7 referenced as `pnpm 10` strict-mode; reality is `pnpm 11` strict-mode (identical strict-mode behavior, so no functional impact, but spec layer drifts).

3. **`pnpm-workspace.yaml not used` claim in AGENTS.md §1 fixed; but `pnpm-workspace.yaml` first appeared at SCAFFOLD.2-a (`97d3cdb`)** — pre-existing drift surfaced by SCAFFOLD.1 verification. Now corrected. No further action.

4. **`.claude/scheduled_tasks.lock` gitignored; pre-existing file presence is a housekeeping leftover from earlier ScheduleWakeup misuse.** Not deleted (CC has no reason to access it during normal operation; lock file is dormant). Future archaeology may discover; not load-bearing.

5. **DESIGN.7 estimate (0.25d, "5-min Tailwind config diff")** likely understates the work — shadcn's `:root` token layer (~20 vars across `:root` + `.dark`) plus AGENTS.md §8 placeholder block must both be touched. Realistic: 0.5–0.75d. Re-estimation deferred to DESIGN.7 plan-mode.

---

## Next session starts at

**Two parallel tracks open. User picks order.**

### Track A — SCAFFOLD continues

**SCAFFOLD.14** (1d, CC) — Auth vendor onboarding (Google Identity Services + Resend + Cloudflare Turnstile API keys, `.env.local` wiring, secret manager state).

Then **SCAFFOLD.3** (3d, CC) — Auth wiring (Better Auth participant path + admin hand-rolled static-password path, per SPEC.1 §13 + SPEC.2 §8 + ADR-0004 + ADR-0010).

### Track B — VISUAL phase opens

**DESIGN.1** (2d, Hrishikesh + Claude Design + web Claude brief) — Brand + tokens (logo, palette, typography selection, OKLCH token mint). Produces handoff bundle that DESIGN.2 seeds into Claude Design system. Doesn't compete with SCAFFOLD continuation (no CC time).

Track B can run **parallel** to Track A. Track A unblocks SCAFFOLD.3+. Track B feeds DESIGN.7 token back-apply + UI.* surfaces.

Recommended: open Track B (DESIGN.1) immediately since it has no CC contention; queue SCAFFOLD.14 for next CC session.

---

## Context to preserve

### Repo state at close

- Local + origin in sync; `main` at `e9e1378`
- Branch `feat/scaffold-1` deleted from remote; can be locally pruned via `git fetch --prune` or kept (no harm)
- Working tree clean
- Repo location: `~/code/zugzwang/experiment`

### Stack state

- **Next.js:** 16.x (Turbopack default for `dev` + `build`)
- **Node:** 24 via mise (AGENTS.md §1 now accurate)
- **pnpm:** 11.0.9 (drifts from `mise.toml = 10`; tracked as backlog item)
- **Tailwind:** v4.x via `@tailwindcss/postcss`
- **shadcn:** 4.7.0 (radix-nova preset variant of new-york v4 visual identity)
- **shadcn Button:** 4 size variants (default/sm/lg/icon) + xs/icon-xs/icon-sm/icon-lg additive; multiple variant axes
- **Geist + Geist Mono:** wired via `next/font/google` in `src/app/layout.tsx`
- **`pnpm-workspace.yaml`:** active; `allowBuilds` carries `msw: false` deny-explicit
- **Lefthook 2.1.6:** pre-commit hook runs Biome on staged files; ran clean on this PR (no biome-relevant files in plan commit + workspace yaml commit)

### Tooling state

- Claude Code 2.1.138, Opus 4.7, max effort persistent via env var
- Accept-edits-on mode adopted as default Phase 2 setting
- Plan-mode harness scratch path: `/Users/hrishikesh/.claude/plans/ultrathink-task-scaffold-1-title-smooth-hummingbird.md` (left in place; not load-bearing)
- VS Code Remote Control: active

### Smoke artifact

`src/app/(dev)/scaffold-1-smoke/page.tsx` retained on main. SCAFFOLD.11 (phase-exit smoke) inherits or replaces. DESIGN.7 uses as token-swap regression target.

### Plan-vs-reality

Plan estimated 1d for SCAFFOLD.1. Actual: ~3h wall (Phase 1 plan-mode ~1h + Phase 2 execute ~1.5h + browser smoke ~30m). Under estimate. Drift-absorption rounds + shadcn-4.7-flag-shape verification + pnpm-11-strict-mode resolution accounted for ~45m of unscheduled work; offset by smaller-than-estimated implementation diff (10 files vs initially-framed 8 → actually 10 due to plan inventory expansion).

---

## Time

- Phase 1 plan-mode (single CC session): ~1h wall, ~150-200k tokens, plan file 546 lines
- Phase 2 execute (fresh CC tab, accept-edits-on): ~1.5h wall, ~200-250k tokens, 3 commits across 11 files
- Browser smoke + GitHub review + merge: ~30m
- **Total: ~3h wall** across web Claude (this chat) + 2 Claude Code sessions

---

## References

- **Plan:** `docs/plans/SCAFFOLD.1.md` (546 lines, committed at `08aa2f1`)
- **PR:** [#33](https://github.com/zugzwang-foundation/experiment/pull/33) merged at `e9e1378`
- **CLAUDE.md:** §1 (critical paths — SCAFFOLD.1 NOT on list), §5.1 (plan ritual), §5.4 (scope discipline), §5.10 (pre-PR self-audit), §5.11 (subagent table + claude-progress scratch), §7 (cleanup-absorption rule), §10 (commit safety + branch naming)
- **AGENTS.md:** §1 (stack — Node 24 amended this PR), §3 (path aliases verified), §8 (Tailwind v4 + shadcn — example block + subsection title amended this PR)
- **SPEC.2:** §22.2 (ADR-0012 in-flight carve-out — operational basis for placeholder-token strategy), §23.1 (Direction A — SCAFFOLD.1 in parallel-execution clearance set)
- **SPEC.1:** §17 (Identifiers — Geist token names stable across DESIGN.7 back-apply)
- **ADR-0012:** Design system lock — IN FLIGHT per SPEC.2 §22.2; DESIGN.* phase will mint
- **Predecessor logs:** `docs/logs/PRECURSOR.5.md`, `docs/logs/SCAFFOLD.2-3C.md`
- **Workflow:** `docs/workflows/plan-then-execute.md`
- **Plan template:** `docs/plans/_template.md`
- **Tracker:** v7 in Anthropic project knowledge (`zugzwang_experiment_tracker_v7.html`); reference drift fixed in `docs/maintenance.md` lines 20 + 131 this PR

---

*Log committed to `main` per CLAUDE.md §5.9 closing ritual step 1 of 4. Project-knowledge update table + Claude Code wind-down prompt + next-pair kickoff prompts follow.*
