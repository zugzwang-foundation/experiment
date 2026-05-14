# SCAFFOLD.1 — Tailwind v4 + shadcn/ui + Turbopack config (plumbing)

> **Plan-mode scratch draft.** After `ExitPlanMode`, copy/move this to `docs/plans/SCAFFOLD.1.md` and commit before Phase 2 opens, per CLAUDE.md §5.1 + `docs/workflows/plan-then-execute.md` lines 117–122.

> **Status:** drafted
> **Date:** 2026-05-14
> **Author:** Hrishikesh + Claude Code Opus 4.7 (Phase 1 plan)
> **Critical-path?** **No** — SCAFFOLD.1 touches `src/app/*` + `src/components/*` + `src/lib/*` + docs. Per CLAUDE.md §1, critical paths are `src/server/bets|comments|dharma|resolution|auth|identity|moderation/`, `src/db/schema/`, `drizzle/migrations/`, `supabase/migrations/`. None of these are touched.
> **Plan PR / commit:** plan landed via `git commit -m "plan: SCAFFOLD.1 — Tailwind v4 + shadcn/ui + Turbopack plumbing"` after `ExitPlanMode`.

---

## Context

The Zugzwang Experiment ships placeholder Tailwind v4 design tokens + shadcn/ui scaffolding **now** so SCAFFOLD.3 (auth wiring) and downstream UI work can proceed with a stable styling substrate. Real DESIGN.1 brand tokens land later via DESIGN.7's back-application pass — this is the operational realization of SPEC.2 §22.2's design-independence carve-out (codebase scaffolds without `docs/specs/design.md`; the design system layers on once ADR-0012 ratifies).

SCAFFOLD.1 is **plumbing-only**: install shadcn/ui infrastructure, layer Zugzwang placeholder tokens (`--color-yes`, `--color-no`, `--color-brand`, `--font-sans`, `--font-mono`) into `src/app/globals.css`, and prove the toolchain end-to-end via a single smoke page that consumes a shadcn `Button` + a custom OKLCH opacity-modifier utility. The PR also absorbs four adjacent drift items per CLAUDE.md §7 cleanup-absorption rule.

The intended outcome: SCAFFOLD.3+ contributors land on a repo where `import { Button } from "@/components/ui/button"` works, `bg-yes/50` resolves, AGENTS.md §1 matches `mise.toml`, and the tracker filename references are versioned consistently.

---

## Tracker context (v7, verbatim)

```
id: SCAFFOLD.1
phase: 2 (SCAFFOLD)
title: "Tailwind v4 + shadcn/ui + Turbopack config (plumbing)"
desc: "Plumbing-only: Tailwind v4 installed with AGENTS.md §8 placeholder
      OKLCH tokens in src/app/globals.css (--color-yes / --color-no /
      --color-brand / Inter / JetBrains Mono), shadcn/ui new-york v4
      variant, Turbopack default, postcss.config.mjs. SPEC.13 dep DROPPED
      per SPEC.2 §22.2 design-independence carve-out — ships with
      placeholder tokens NOW to unblock SCAFFOLD.3. Real DESIGN.1 tokens
      back-applied by DESIGN.7 (5-min Tailwind config diff)."
pri: P0
deps: ["SPEC.3"]
est: 1d
```

**Dep status at plan time:** SPEC.3 locked (per PRECURSOR.3 close + PRECURSOR.5 sweep). SPEC.13 dep DROPPED per SPEC.2 §22.2 third property. SCAFFOLD.1 unblocks SCAFFOLD.3.

**Reconciliation from kickoff exploration:** the tracker's "Inter / JetBrains Mono" string is inherited from AGENTS.md §8's example block, **not** from the actual repo wiring. Repo ships Geist + Geist Mono via `next/font/google` in `src/app/layout.tsx`. User-locked decision (this session): defer font choice to DESIGN.7 — keep Geist wired in layout.tsx; treat fonts as SCAFFOLD.1 placeholders alongside colors; AGENTS.md §8 example values update to point at Geist CSS vars in the same PR.

---

## Approach

Strip `src/app/globals.css` to a bare `@import "tailwindcss";` line so `pnpm dlx shadcn@latest init` has a clean canvas. Run shadcn init with App Router + RSC + CSS variables + AGENTS.md §3 path aliases + Lucide icons (visual identity intent: new-york v4 — actual CLI flag shape verified at execution time, see §shadcn-init below). Run `shadcn add button` for one smoke primitive. Layer the AGENTS.md §8 placeholder plain-`@theme` block (`--color-yes/-no/-brand` + `--font-sans/-mono` mapped to Geist vars) into globals.css below shadcn's injection. Create a Server Component smoke page at `src/app/(dev)/scaffold-1-smoke/page.tsx` that renders Button + `bg-yes/50` + `font-mono` to prove the pipeline end-to-end. Then absorb four adjacent drift items per CLAUDE.md §7 (AGENTS.md §1 Node row, AGENTS.md §8 example + new prose, `docs/maintenance.md` tracker filename, stale `claude-progress.md`). Stay strictly out of critical paths.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How preserved | Test assertion |
|---|---|---|---|
| INV-1 Bet ↔ comment atomicity | **no** | n/a — no `src/server/bets/` or `src/server/comments/` change | n/a |
| INV-2 Dharma non-transferable / no overdraft | **no** | n/a — no `src/server/dharma/` or `dharma_ledger` change | n/a |
| INV-3 Comments side-bound at post-time | **no** | n/a — no `comments` schema change | n/a |
| INV-4 Resolutions append-only | **no** | n/a — no `resolution_events` / `payout_events` change | n/a |

Plumbing task. Zero invariant exposure. Per CLAUDE.md §1, critical-path triggers are not fired.

---

## 2. Data model changes

**None.** No Drizzle schema files touched. No migrations generated. No `drizzle/migrations/` or `supabase/migrations/` activity. `src/db/schema/` untouched.

---

## 3. API surface

**None.** No Server Actions, no Route Handlers, no API endpoints. The smoke page is a Server Component reading no data; it has no `actions.ts` and no fetch.

---

## 4. UI / user flow

One internal verification surface, **not** user-facing:

- **Route:** `/scaffold-1-smoke` (resolved from `src/app/(dev)/scaffold-1-smoke/page.tsx`; the `(dev)` group does not appear in the URL per Next.js 16 route-group semantics).
- **Component contract:** Server Component (no `'use client'`). Renders a `<main>` with `bg-yes/50 font-mono`, an `<h1>`, a paragraph, and two `<Button>` instances (`default` + `outline` variants).
- **Imports:** `import { Button } from "@/components/ui/button"`. No data fetching, no Server Action, no `'use cache'`.
- **Audience:** internal developers running `pnpm dev` + Hrishikesh during plan-mode verification + Phase-2 smoke checklist execution.

No change to `src/app/page.tsx` (current Zugzwang placeholder homepage). No change to `src/app/layout.tsx` (Geist font wiring stays).

---

## 5. Failure modes

| Failure | Detection | Recovery |
|---|---|---|
| shadcn CLI flag drift (kickoff pre-flight #4 — `new-york` rename) | `shadcn init` exits non-zero, or the resulting `components.json` carries an unexpected key | Phase 2: fall back to the discovered flag shape (`--base radix` + default preset per Plan-agent empirical claim, or whatever the live CLI accepts), surface SURPRISE to `claude-progress.md` if the shape diverges substantially from AGENTS.md §8 wording |
| Tailwind v4 + Turbopack runtime incompat in 16.2.4 | `pnpm dev` errors at startup, or globals.css fails to compile | `pnpm dev --webpack` fallback; surface SURPRISE; do NOT proceed to PR until root cause known |
| Geist font-token mapping broken after globals.css strip | smoke item §10.6 fails — `font-mono` doesn't resolve to Geist Mono | the AGENTS.md §8 placeholder block must include `--font-sans: var(--font-geist-sans)` + `--font-mono: var(--font-geist-mono)`; verify the block lands |
| Biome reformats shadcn-generated CSS in unsafe ways | `pnpm exec biome check src/app/globals.css` fails or auto-fix produces invalid CSS | run `pnpm exec biome check --write src/app/globals.css` post-init; accept Biome's reformatting verbatim; re-stage; biome.json has `tailwindDirectives: true` so `@theme` / `@custom-variant` parse correctly |
| pnpm 10 strict-mode build-script approval requested by a new shadcn-transitive dep | stdout shows `Ignored build scripts: [...]` warning | evaluate each requester; if Radix-primitive (unlikely to need build script) surface as SURPRISE; if expected (e.g. esbuild via cva — already on allowlist), no action |
| shadcn injection collides with existing `@theme inline` token in globals.css | Tailwind class regression (e.g. `bg-background` resolves to wrong color) | sequencing rule: strip globals.css BEFORE init; placeholder block goes AFTER shadcn's `@theme inline`. Plain `@theme` (additive utilities) and `@theme inline` (inline replacement) coexist by Tailwind v4 contract — different jobs, different keys |

No DB transaction failure modes (no DB writes). No auth failure modes (no auth boundary). No race conditions (no concurrent state).

---

## 6. Edge cases

- **Existing `src/app/globals.css` is from create-next-app, not greenfield.** Sequencing matters: bare-strip before init or shadcn rejects/overwrites surprises.
- **shadcn 4.7+ `tw-animate-css` import.** If init writes the `@import "tw-animate-css";` line, accept it; if it doesn't, hand-add it (Plan agent expects it; verify).
- **`@/hooks` alias declared in components.json but `src/hooks/` does not exist yet.** Acceptable — shadcn doesn't create the directory at init time. First `shadcn add` of a hook (e.g. `useToast`) would create it. Not in scope here.
- **`tw-merge`'s class-conflict map doesn't know about `bg-yes/no/brand`.** Won't bite SCAFFOLD.1 (smoke page doesn't combine two `bg-*` utilities via `cn`). DESIGN.7 can register custom utilities later if needed.
- **`src/app/page.tsx` already uses `bg-neutral-950`.** Stock Tailwind palette — survives the globals.css rewrite without any token mapping. No regression.
- **`@theme inline` from create-next-app currently maps `--font-sans` → `--font-geist-sans`.** After strip, this mapping is gone. The AGENTS.md §8 placeholder plain `@theme` block restores it. If the block is forgotten, `font-sans` Tailwind utility resolves to nothing and the body renders in browser-default (likely Arial). The smoke checklist's §10.5 + §10.6 catches this.
- **Biome's `quoteStyle: "double"` JavaScript rule.** shadcn-generated `src/lib/utils.ts` uses double quotes already; `src/components/ui/button.tsx` likewise. No reformat surprise expected.

---

## 7. Test plan

Plumbing task — no Vitest unit/integration tests. Verification is the **smoke checklist** (§10 of this plan) + **pre-PR self-audit** (§11 of this plan). Both run in-session before `gh pr create`.

| Layer | Scope | Asserts |
|---|---|---|
| Unit (Vitest) | none — no pure functions added | n/a |
| Integration (Vitest + test PG) | none — no DB writes | n/a |
| E2E (Playwright) | none — no user flow | n/a |
| Invariant (`tests/invariants/`) | none — INV 1–4 untouched | n/a |
| Smoke (manual via `pnpm dev`) | 7 items §10 | Pipeline end-to-end: build/dev/Button render/OKLCH opacity/Geist load/font-mono resolve/token defined |
| Self-audit (manual via `git diff`) | 6 items §11 | Scope discipline, AGENTS.md compliance, drift edits applied |

---

## 8. Out of scope (refusal-grade)

These belong to other tasks. Adding any of them to SCAFFOLD.1 is `REFUSAL:`-grade scope creep:

- Sonner / `<Toaster />` mount → ships with first surface that toasts
- Dark mode toggle / `next-themes` provider → DESIGN.1 / DESIGN.7 territory
- Additional shadcn primitives beyond Button (Dialog, Input, Select, etc.) → add on demand from consuming tasks
- `next.config.ts` changes beyond verification — user-locked **keep as-is**
- Theme switcher UI
- Real DESIGN.1 brand tokens — DESIGN.7 back-application
- Font swap Geist → Inter/JBM — user-locked **defer to DESIGN.7**
- `src/app/page.tsx` rewrite → SCAFFOLD.11+ or DESIGN.* will replace
- `src/app/layout.tsx` font swap or layout changes — Geist stays
- Any `src/server/*`, `src/db/schema/*`, `drizzle/migrations/*`, `supabase/migrations/*` change
- Any tests/* file
- `.claude/hooks/*` minting (the FOUND.4-era `format-and-typecheck.sh` / `session-start.sh` referenced in CLAUDE.md §6 do not exist yet — backlog, not SCAFFOLD.1)
- `.claude/skills/*` minting (`pr-create/SKILL.md` referenced in AGENTS.md §10 does not exist yet — backlog)
- Tracker description sweep flagged in SPEC.2 §23.3 (DEBATE.4 / SCAFFOLD.3 / SCAFFOLD.13 / SCAFFOLD.4 row descriptions) — PRECURSOR.5 territory; PRECURSOR.5 closed without completing this; not absorbed here

---

## File-by-file walkthrough

Ten files net. Absolute paths.

### Generated by `pnpm dlx shadcn@latest init`

1. **`/Users/hrishikesh/code/zugzwang/experiment/components.json`** — new file. shadcn config of record. Aliases match AGENTS.md §3 (`@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`). `iconLibrary: "lucide"`. `tailwind.css: "src/app/globals.css"`. `tailwind.cssVariables: true`. `rsc: true`. Visual identity: new-york v4 (under whatever flag shape shadcn 4.7+ uses today — see §shadcn-init).
2. **`/Users/hrishikesh/code/zugzwang/experiment/src/lib/utils.ts`** — new file. shadcn-standard `cn` helper (clsx + tailwind-merge). First file under `src/lib/`.

### Generated by `pnpm dlx shadcn@latest add button`

3. **`/Users/hrishikesh/code/zugzwang/experiment/src/components/ui/button.tsx`** — new file. Standard new-york v4 Button with `cva` variants (`default | destructive | outline | secondary | ghost | link`), sizes (`default | sm | lg | icon`), `data-slot="button"`, `asChild` Radix Slot support.

### Hand-created

4. **`/Users/hrishikesh/code/zugzwang/experiment/src/app/(dev)/scaffold-1-smoke/page.tsx`** — new file. Server Component (no `'use client'` per AGENTS.md §5). Renders `<main className="min-h-screen bg-yes/50 p-8 font-mono">` + heading + paragraph + two `<Button>` instances. ~25 LOC. Resolves at `/scaffold-1-smoke`. **Lifecycle:** stays through DESIGN.7's PR (DESIGN.7 uses it as a token-swap regression target, then deletes it as part of close-out — see Open Questions §1).

### Modified — write-through

5. **`/Users/hrishikesh/code/zugzwang/experiment/src/app/globals.css`** — full rewrite via strip → shadcn init → layer. Final shape verbatim below.
6. **`/Users/hrishikesh/code/zugzwang/experiment/package.json`** — dependency additions only. Expected new entries: `class-variance-authority`, `clsx`, `lucide-react`, `tailwind-merge`, `tw-animate-css`, `@radix-ui/react-slot`. No scripts changed. No `pnpm.onlyBuiltDependencies` change expected (verify post-install).

### Modified — drift absorption (CLAUDE.md §7)

7. **`/Users/hrishikesh/code/zugzwang/experiment/AGENTS.md`** — §1 Node row + §8 `@theme` example + new placeholder paragraph. Verbatim text below.
8. **`/Users/hrishikesh/code/zugzwang/experiment/docs/maintenance.md`** — lines 20 + 131: `zugzwang_experiment_tracker.html` → `zugzwang_experiment_tracker_v7.html`.
9. **`/Users/hrishikesh/code/zugzwang/experiment/claude-progress.md`** — overwrite stale 84-line SCAFFOLD.2-3D content with 1-line stub.

### Auto-generated

10. **`/Users/hrishikesh/code/zugzwang/experiment/pnpm-lock.yaml`** — refreshed by `pnpm install` (triggered by shadcn). Stage as-is.

### NO-TOUCH (explicit)

`postcss.config.mjs`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `tsconfig.json`, `biome.json`, `justfile`, `mise.toml`, `.nvmrc`, `CLAUDE.md`, `docs/specs/*`, `docs/adr/*`, `drizzle/*`, `supabase/*`, `src/db/*`, `tests/*`.

---

## Implementation order

Twelve steps. Verification gates inline.

1. **Branch.** `git checkout -b feat/scaffold-1` from `main` (currently `e0ef868`; tree clean).
2. **Strip `src/app/globals.css`** to ONLY:
   ```css
   @import "tailwindcss";
   ```
   (one line + trailing newline). Verify `wc -l = 1`. This gives shadcn init a clean canvas.
3. **Smoke-check the strip** (optional but cheap): `pnpm dev` momentarily. `localhost:3000` renders `src/app/page.tsx`; `bg-neutral-950` survives (stock palette, no `@theme` needed). Body font may render as Arial — acceptable for 30 seconds. Stop dev.
4. **Run shadcn init.** Command in §shadcn-init below. Verify post-init:
   - `test -f components.json`
   - `test -f src/lib/utils.ts`
   - `grep -q '"rsc": true' components.json`
   - `grep -q '@import "tailwindcss"' src/app/globals.css` (still line 1)
   - `git status` shows the expected diff set
5. **`pnpm install`** if shadcn didn't already trigger it. Watch for pnpm 10 strict-mode build-script warnings — none expected; surface if any.
6. **Layer the AGENTS.md §8 placeholder block** onto `src/app/globals.css`. Final shape in §globals-css-final below. Order: shadcn's blocks first; placeholder block after `@theme inline`; `@layer base` last.
7. **`pnpm dlx shadcn@latest add button -y`.** Verify `src/components/ui/button.tsx` lands. `pnpm install` if locks shift.
8. **Hand-create the smoke page** at `src/app/(dev)/scaffold-1-smoke/page.tsx`. Content in §file-4 above.
9. **Apply drift-absorption edits:**
   - `AGENTS.md` §1 Runtime row + §8 `@theme` example + new placeholder paragraph (text below).
   - `docs/maintenance.md` lines 20 + 131 (text below).
   - `claude-progress.md` overwrite (text below).
10. **`just verify`** — typecheck + biome check + build. Must be green. If Biome reformats shadcn-generated CSS or TSX, accept it (`biome check --write`), re-stage.
11. **Smoke verification** — 7 items §10 below. All PASS before proceeding.
12. **Pre-PR self-audit** — 6 items §11 below. PASS items proceed to PR. FAIL items fix in-session and re-verify. SURPRISE items surface to `claude-progress.md` and stop for Hrishikesh decision.

After step 12: `git add` the specific files (no `git add -A` per AGENTS.md §10 safety), commit, push, `gh pr create --fill` (or `/pr` skill when SCAFFOLD.10 lands).

---

## shadcn init invocation

**Visual-identity intent:** shadcn/ui new-york v4 (per AGENTS.md §8 + tracker row). **CLI flag shape:** verified empirically at Phase-2 execution time — Plan agent's empirical claim is that shadcn 4.7.0 has dropped `--style new-york` in favor of `--base radix` + default `--preset base-nova` (where `base-nova` carries the new-york visual identity forward). This claim is **not blocked-on**; Phase 2 runs `pnpm dlx shadcn@latest init --help` first and proceeds with the actual flag set.

**Best-guess command (verify at Phase 2):**
```bash
pnpm dlx shadcn@latest init -y --template next --base radix --css-variables
```

**If `--style new-york` still works** (kickoff pre-flight #4 default action), use that variant instead:
```bash
pnpm dlx shadcn@latest init -y --style new-york --base-color neutral
```

**Interactive answers expected** (under `-y` most auto-resolve; document for the future):

| Prompt | Answer |
|---|---|
| Project name | `experiment` (default) |
| Use src/ directory | Yes |
| TypeScript | Yes |
| App Router | Yes |
| RSC | Yes |
| Tailwind CSS file | `src/app/globals.css` |
| CSS Variables for theming | Yes |
| Tailwind base color | Neutral |
| Import alias — components | `@/components` |
| Import alias — utils | `@/lib/utils` |
| Import alias — ui | `@/components/ui` |
| Import alias — lib | `@/lib` |
| Import alias — hooks | `@/hooks` |
| Icon library | Lucide |

**Add Button:**
```bash
pnpm dlx shadcn@latest add button -y
```

---

## globals.css final shape

Order is load-bearing. `@import "tailwindcss";` MUST be line 1 (Tailwind v4 contract). Plain `@theme` (additive utilities) goes AFTER shadcn's `@theme inline` (inline-replacement) and BEFORE `@layer base`.

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
	--radius: 0.625rem;
	--background: oklch(1 0 0);
	--foreground: oklch(0.145 0 0);
	/* …remaining shadcn-injected tokens accepted verbatim: card, popover,
	   primary, secondary, muted, accent, destructive, border, input, ring,
	   and any sidebar-*/chart-* shadcn 4.7 ships… */
}

.dark {
	--background: oklch(0.145 0 0);
	--foreground: oklch(0.985 0 0);
	/* …matching .dark overrides for each :root token… */
}

@theme inline {
	--radius-sm: calc(var(--radius) - 4px);
	--radius-md: calc(var(--radius) - 2px);
	--radius-lg: var(--radius);
	--radius-xl: calc(var(--radius) + 4px);
	--color-background: var(--background);
	--color-foreground: var(--foreground);
	/* …shadcn-injected color mappings accepted verbatim… */
}

/*
 * AGENTS.md §8 placeholder tokens — Zugzwang brand surface.
 * SCAFFOLD.1 ships PLACEHOLDER OKLCH color values + Geist font-var mappings
 * per SPEC.2 §22.2 design-independence carve-out. DESIGN.1 mints real values;
 * DESIGN.7 back-applies. Do not consume in business logic until DESIGN.7 lands.
 */
@theme {
	--color-yes: oklch(0.65 0.18 145);
	--color-no: oklch(0.65 0.18 25);
	--color-brand: oklch(0.55 0.20 270);
	--font-sans: var(--font-geist-sans);
	--font-mono: var(--font-geist-mono);
}

@layer base {
	* {
		@apply border-border outline-ring/50;
	}
	body {
		@apply bg-background text-foreground;
	}
}
```

Note: shadcn 4.7's exact stock token set may include additional keys (`sidebar-*`, `chart-1..5`); accept whatever init writes. The plan-relevant invariant is: plain `@theme` block with the 5 Zugzwang placeholder tokens lives below `@theme inline`, above `@layer base`, with the placeholder comment intact.

---

## AGENTS.md §8 amendment text

### Edit 8a — replace the `@theme` example block

**Locate** the `@theme` code block in §8 "Tailwind v4 — CSS-first config" (lines ~283–296 in current AGENTS.md).

**Find:**
```css
@import "tailwindcss";

@theme {
  --color-yes:   oklch(0.65 0.18 145);
  --color-no:    oklch(0.65 0.18 25);
  --color-brand: oklch(0.55 0.20 270);
  --font-sans:   "Inter", system-ui, sans-serif;
  --font-mono:   "JetBrains Mono", ui-monospace, monospace;
}
```

**Replace with:**
```css
@import "tailwindcss";

/* Plain @theme: adds utilities for tokens that don't have a Tailwind name. */
@theme {
  --color-yes:   oklch(0.65 0.18 145);  /* placeholder — DESIGN.1 mints */
  --color-no:    oklch(0.65 0.18 25);   /* placeholder — DESIGN.1 mints */
  --color-brand: oklch(0.55 0.20 270);  /* placeholder — DESIGN.1 mints */
  --font-sans:   var(--font-geist-sans); /* placeholder — DESIGN.7 swaps */
  --font-mono:   var(--font-geist-mono); /* placeholder — DESIGN.7 swaps */
}
```

### Edit 8b — add placeholder paragraph immediately after the `@theme` code block

**Insert** (between the closing fence of the code block above and the existing "Defining `--color-yes` automatically generates…" paragraph):

> The `--color-yes` / `--color-no` / `--color-brand` color values AND the `--font-sans` / `--font-mono` mappings shown above are **SCAFFOLD.1 placeholders**. The real brand palette is produced by DESIGN.1 (brand + tokens) and back-applied to `globals.css` by DESIGN.7; the font choice is similarly DESIGN.7's call. This is the operational realization of SPEC.2 §22.2's design-independence carve-out: the codebase scaffolds without `docs/specs/design.md`, then the design system layers on once ADR-0012 lands. Token NAMES (`--color-yes`, `--font-sans`, etc.) are stable; only VALUES are placeholder.

### Edit 8c — leave subsection title "shadcn/ui — new-york v4" unchanged

Empirical shadcn-CLI flag shifts (per Plan-agent claim) do not change the visual-identity lineage AGENTS.md §8 names. If Phase 2 surfaces that the visual identity has rebranded under a different name, surface SURPRISE and update the subsection title in the same PR.

---

## AGENTS.md §1 amendment text

**Locate** the §1 stack table Runtime row (currently line 13).

**Find:**
```
| Runtime | Node.js 22 LTS via `mise` | `.tool-versions` pins exact patch |
```

**Replace with:**
```
| Runtime | Node.js 24 via `mise` | `mise.toml` pins major; `.nvmrc` mirrors for non-mise users |
```

Rationale: empirical state — `mise.toml` has `node = "24"`, `.nvmrc` has `24`, no `.tool-versions` file exists at the repo root. "Node 24" not "Node 24 LTS" because Node 24 only enters LTS October 2026 (pre-LTS through the experiment window).

---

## docs/maintenance.md amendment

**Edit A — line 20:**

**Find:**
```
| `zugzwang_experiment_tracker.html` (or wherever the tracker lives) | Task completion (continuous); occasional reorgs |
```

**Replace with:**
```
| `zugzwang_experiment_tracker_v7.html` | Task completion (continuous); occasional reorgs |
```

**Edit B — line 131:**

**Find:**
```
| `zugzwang_experiment_tracker.html` | Task completion (continuous); reorgs (rare) | Continuous (per task close) |
```

**Replace with:**
```
| `zugzwang_experiment_tracker_v7.html` | Task completion (continuous); reorgs (rare) | Continuous (per task close) |
```

Other occurrences of "tracker" (lines 3, 30, 51, 100, 110) reference the *concept* not the *filename* — leave untouched.

(SPEC.2 §23 line 2116 and §23.4 line 2195 already use `_v7.html` — no edits needed there. User's framing implied SPEC.2 §23.4 drift; empirical check shows SPEC.2 already correct.)

---

## claude-progress.md replacement

**Overwrite** the entire 84-line file with:
```
<!-- Scratch file for SURPRISE findings per CLAUDE.md §5.11. Cleared at each PR boundary. -->
```

(plus trailing newline). Rationale: keeping a one-line stub (vs. zero-bytes) preserves file presence, signals purpose, references the authoritative source (CLAUDE.md §5.11), survives `git add` cleanly with trailing newline per AGENTS.md §10 POSIX rule.

---

## Drift absorption summary (CLAUDE.md §7)

Four items absorbed in this PR (per user-locked "Absorb both — same PR" decision):

| # | Drift | File | Edit count | Why absorbed here |
|---|---|---|---|---|
| 1 | AGENTS.md §1: Node 22 LTS via `.tool-versions` vs reality (Node 24 via `mise.toml + .nvmrc`) | `AGENTS.md` | 1 line | Surfaced by SCAFFOLD.1 plan-mode exploration; <2-hour fix; per §7 cleanup-absorption rule |
| 2 | AGENTS.md §8: `@theme` example values aspirational (Inter/JBM) vs repo wiring (Geist) + missing placeholder prose | `AGENTS.md` | ~10-line block + 1 paragraph | Same PR per user-locked decision; supports SCAFFOLD.1's primary scope |
| 3 | `docs/maintenance.md`: 2× unversioned `zugzwang_experiment_tracker.html` references | `docs/maintenance.md` | 2 lines | Surfaced by tracker-row lookup during plan-mode; SPEC.2 §23 + §23.4 already at `_v7` |
| 4 | `claude-progress.md`: 84 lines of stale SCAFFOLD.2-3D notes (D shipped per `git log b4fc1d7`) | `claude-progress.md` | full overwrite (84 → 1 line) | Per CLAUDE.md §5.11 the file is per-PR scratch; SCAFFOLD.1 is the natural reset point |

Total drift edits: ~17 lines net across 3 files.

---

## Risks

Eleven enumerated. Each has a mitigation. Plan-agent's full risk list condensed; full text in `/Users/hrishikesh/.claude/plans/ultrathink-task-scaffold-1-title-smooth-hummingbird.md` self-critique below if needed.

1. **shadcn CLI flag drift** — Phase 2 runs `init --help` first; fall back gracefully if `--style new-york` rejected. Surface SURPRISE if visual-identity name has rebranded.
2. **tw-animate-css behavior** — accept whatever shadcn installs; don't hand-pin.
3. **Tailwind v4 `@theme` vs `@theme inline` coexistence** — empirically OK; different jobs, different keys; placeholder block is additive.
4. **Geist font-var wiring after globals.css strip** — placeholder block restores `--font-sans` / `--font-mono` mappings; smoke item §10.6 verifies.
5. **Biome formatting of shadcn-injected CSS** — `pnpm exec biome check --write` post-init; Biome wins.
6. **Next.js 16.2 Turbopack + Tailwind v4** — smoke item §10.2; `--webpack` fallback if needed.
7. **pnpm 10 strict-mode build-script approval** — scan stdout for `Ignored build scripts`; evaluate each, surface SURPRISE on anything unrecognized.
8. **Next.js 16 route-group `(dev)` semantics** — Plan agent verified bundled docs support route groups still; smoke item §10.3 confirms.
9. **`tailwind-merge` doesn't know `bg-yes` / `bg-no` / `bg-brand`** — doesn't bite SCAFFOLD.1; DESIGN.7 can extend twMerge config.
10. **Build-time Geist fetch from Google** — unchanged from baseline; already working.
11. **Biome CSS parser + Tailwind v4 directives** — `tailwindDirectives: true` in biome.json; smoke item §10.1 confirms.

No DB / auth / moderation / payment risk vectors. No invariant exposure.

---

## Smoke verification checklist

Seven items, run after step 10:

1. **`just verify` returns 0** — typecheck + biome check + build green.
2. **`pnpm dev` boots at `localhost:3000`** — no Tailwind warnings, no Turbopack errors.
3. **Smoke page renders at `/scaffold-1-smoke`** — two Buttons (default + outline); hover state works on default.
4. **`bg-yes/50` at 50% opacity** — DevTools computed style on `<main>`: `background-color` resolves to OKLCH with alpha 0.5.
5. **Geist font loads** — DevTools Network: two `geist` font files load (200 OK); no FOUT.
6. **`font-mono` resolves to Geist Mono** — DevTools Computed `font-family` on `<main>` includes `__geistMono_` (Next.js auto-class).
7. **`--color-yes` defined on `:root`** — DevTools Computed → search `--color-yes`. Value: `oklch(0.65 0.18 145)`. Or via console: `getComputedStyle(document.documentElement).getPropertyValue('--color-yes')`.

All 7 must PASS before §11 self-audit.

---

## Pre-PR self-audit (stricter-than-policy)

CLAUDE.md §5.10 does NOT require this for non-critical-path PRs. Kickoff calls for it deliberately. Six PASS/FAIL/SURPRISE items, written into the PR body:

| # | Item | Verify |
|---|---|---|
| 1 | **Files-in-scope** | `git diff main --stat` shows ONLY: `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`, `src/app/globals.css`, `src/app/(dev)/scaffold-1-smoke/page.tsx`, `package.json`, `pnpm-lock.yaml`, `AGENTS.md`, `docs/maintenance.md`, `claude-progress.md`. ZERO changes to `src/db/`, `src/server/`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `drizzle/`, `supabase/`, `tests/`, `docs/specs/`, `docs/adr/`, `CLAUDE.md`. |
| 2 | **AGENTS.md §3 path-alias compliance** | `components.json` `aliases` block: `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`. |
| 3 | **AGENTS.md §8 placeholder block present + comment intact** | `grep -A 8 "AGENTS.md §8 placeholder" src/app/globals.css` shows: comment block + all 5 tokens (`--color-yes`, `--color-no`, `--color-brand`, `--font-sans`, `--font-mono`) + SPEC.2 §22.2 + DESIGN.1 + DESIGN.7 references. |
| 4 | **Drift edits applied** | All 4: AGENTS.md §1 Runtime row → "Node.js 24 via mise"; AGENTS.md §8 `@theme` example + placeholder paragraph; `docs/maintenance.md` lines 20 + 131 → `_v7.html`; `claude-progress.md` → 1-line stub. |
| 5 | **Smoke checklist 1–7 PASS** | Per §10. Screenshot or DevTools text-paste for items 3, 4, 6, 7. |
| 6 | **No critical-path diff** | `git diff main -- src/server/ src/db/ drizzle/migrations/ supabase/migrations/ CLAUDE.md docs/adr/ docs/specs/` returns zero output. |

FAIL items fix in-session and re-verify before PR. SURPRISE items surface to `claude-progress.md` AND ask Hrishikesh before PR.

---

## Open questions (resolved candidate answers; can revisit at Phase 2)

1. **Smoke page lifecycle** — keep `src/app/(dev)/scaffold-1-smoke/page.tsx` through DESIGN.7's PR. Rationale: DESIGN.7 uses it as a token-swap regression target ("smoke page renders after token back-application") and deletes it in its close-out. **Resolved candidate:** keep.
2. **Pin or float shadcn preset** — leave `--preset` unset at SCAFFOLD.1; DESIGN.7 pins the real preset when it back-applies. **Resolved candidate:** float.
3. **Node 22 vs 24 long-term** — keep Node 24 in repo; AGENTS.md §1 amendment moves contract to match code. If Hrishikesh wants to downgrade to Node 22 LTS, that's a separate same-day chore PR (not absorbed here). **Resolved candidate:** keep Node 24 per user-locked drift-absorption decision.
4. **§8 placeholder pointer redundancy** — both the globals.css CSS comment AND AGENTS.md §8 prose reference SPEC.2 §22.2 + DESIGN.1 + DESIGN.7. Intentional redundancy (code-reader vs. doc-reader audiences). **Resolved candidate:** keep both.
5. **tw-animate-css ADR** — part of the shadcn-installed transitive set; AGENTS.md §1 already commits to shadcn/ui as a stack pick; no fresh ADR needed. **Resolved candidate:** no ADR.

---

## ADRs needed

**None.** SCAFFOLD.1 is plumbing within already-ADR'd stack picks (shadcn/ui from AGENTS.md §1; Tailwind v4 from AGENTS.md §1 + §8; Geist already in repo). Placeholder-token strategy is the operational realization of SPEC.2 §22.2 carve-out (ADR-0012 in-flight) — no NEW ADR, just consumption of an existing one.

---

## Self-critique

After drafting, three findings worth surfacing:

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Medium | The Plan-agent's empirical claim about shadcn 4.7.0 dropping `--style new-york` is NOT independently verified — Plan agent didn't show CLI output for `pnpm dlx shadcn@latest -v` or `init --help`. Could be hallucinated. | Phase 2 runs `init --help` BEFORE the actual init command. Plan documents BOTH the kickoff's default-action (`--style new-york`) AND the Plan-agent-proposed shape (`--base radix`). Phase 2 picks the one that works. SURPRISE-and-stop if neither. |
| 2 | Low | `(dev)` route group adds one extra path segment vs. `src/app/scaffold-1-smoke/page.tsx`. The signal value ("this is dev-only") may not justify the directory level for a single-file smoke. | Acceptable: the `(dev)` group makes "delete this when DESIGN.7 lands" obvious. Open question #1 has the smoke page surviving through DESIGN.7 anyway — group becomes the "DESIGN.7 deletion target" marker. |
| 3 | Low | `claude-progress.md` stub references CLAUDE.md §5.11 — if CLAUDE.md restructures, the stub becomes stale. | Acceptable: §5.11 is a stable contract; CLAUDE.md changes go through maintenance.md cadence with audit pass that would catch this. If still uncomfortable, drop the §5.11 cite from the stub. |

Plan survives self-critique. No high-severity findings.

---

## References

- **CLAUDE.md** §1 (critical paths — SCAFFOLD.1 NOT on the list), §3 (refusal triggers — none triggered), §5.1 (plan mode), §5.2 (simplicity), §5.4 (scope discipline), §5.9 (session log — will land in `docs/logs/SCAFFOLD.1.md`), §5.10 (pre-PR self-audit — stricter-than-policy here), §5.11 (reviewer-call — none required for this work type), §7 (cleanup-absorption rule)
- **AGENTS.md** §1 (stack — Tailwind v4 + shadcn locked; Node row amended this PR), §3 (project structure + path aliases), §5 (Next.js 16 patterns — Server Components by default), §8 (Tailwind v4 + shadcn/ui — `@theme` example amended this PR), §10 (Git workflow + macOS/zsh constraints), §11 (boundaries)
- **SPEC.2** §22.2 (ADR-0012 in-flight carve-out — operational basis for placeholder-token strategy), §22.1 (ADR index), §23.1 (Direction A — SCAFFOLD.1 in parallel-execution clearance set), §23.4 (single source of truth)
- **SPEC.1** §1.0 (project frame), §12 (timeline)
- **ADR-0012** (Design system lock — in flight per SPEC.2 §22.2; DESIGN.* phase will mint)
- **Predecessor logs:** `docs/logs/PRECURSOR.5.md` (last task; CLAUDE.md + AGENTS.md sweep), `docs/logs/SCAFFOLD.2-3C.md` (drift-absorption discipline reference)
- **Workflow:** `docs/workflows/plan-then-execute.md` (2-tab cadence — plan tab → fresh execute tab)
- **Plan template:** `docs/plans/_template.md`
- **Tracker:** v7 row pasted in §"Tracker context" above (external to repo; `zugzwang_experiment_tracker_v7.html` referenced in `docs/maintenance.md` after this PR's drift fix)

---

*Plan-mode scratch draft. Move to `docs/plans/SCAFFOLD.1.md` and commit before Phase 2 opens, per CLAUDE.md §5.1 + workflow doc lines 117–122.*
