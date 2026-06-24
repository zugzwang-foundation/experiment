# Session log — SHELL/UI.0 (participant shell bootstrap + DESIGN.7 token mint)

**Stratum:** SHELL/UI.0 · **State:** EXECUTE complete, PR open · **Date:** 2026-06-24

## What landed (files + PR#)

PR: **#161** (`feat/shell-ui-0` → `main`). Canonical reference SHA = the squash-merge SHA on `main` (filled at merge). Baseline: `main` @ `55c3cb5` (squash of plan PR #160). Migration head **unchanged at `0018`** (no schema/migration).

15 files (the plan §3 file map, 1:1):
- **Token mint** — `src/app/globals.css`: minted the locked v1.0 monochrome ramp `--color-n0…--color-n7` + `--color-ink` (chroma 0) into the `@theme` block; rebound `--color-yes`=`oklch(0.145 0 0)` (YES side = black/ink) and `--color-no`=`oklch(1 0 0)` (NO side = white/n0) with the REQUIRED-FIX-1 "NOT Support" comments; removed `--color-brand` + the "do not consume until DESIGN.7" header; added raw `:root` tokens `--hairline` / `--imgmax` + the CD-deferred `--imgr` placeholder.
- **Shell + route** — `src/app/(public)/layout.tsx` (RSC placeholder shell, REQUIRED FIX 2: wordmark + sign-in/pseudonym only, UI.13 supersessor flagged, zero new providers); `src/app/(public)/m/[slug]/page.tsx` (RSC scaffold, `null→notFound()`, minimal placeholder); `src/server/markets/get-by-slug.ts` (server-only DTO resolver, excludes `Draft` in-query — OQ-2).
- **shadcn baseline** — `src/components/ui/{card,badge,avatar,separator,skeleton}.tsx` (via `pnpm dlx shadcn add`; no globals.css clobber, no new deps).
- **Dev-smoke retarget** — `src/app/(dev)/scaffold-1-smoke/page.tsx`: `bg-yes/50 → bg-muted` (OQ-5; not deleted).
- **Tests** — `tests/unit/design/tokens-monochrome.test.ts` (static guard, 5 cases); `tests/integration/market-by-slug.integration.test.ts` (DTO / unknown→null / Draft→null / terminal-state, 4 cases).
- **Docs (same-commit)** — `docs/adr/0023-participant-shell-topology.md` (NEW, OQ-6); `docs/design/design-language.md` §2.1 landed values + provenance + changelog (→ v0.3-draft); `AGENTS.md` §8 (minted ramp) + §3 (`(public)/` exists, tree + greenfield truth-up).

## Decisions made

- **Precondition §0.1 (pseudonym on session) — SETTLED:** `session.user.pseudonym` is type-safe via `user.additionalFields.pseudonym` in `src/server/auth/index.ts:241`; resolved server-side in the RSC layout via `auth.api.getSession({ headers: await headers() })`. No separate resolver needed.
- **n4 hex↔OKLCH (SURPRISE, resolved):** plan §4 maps `#A3A3A3 → oklch(0.708 0 0)`, but a deterministic sRGB→OKLab conversion gives L≈0.7155. Kept `0.708` — the plan's explicit OKLCH column is the authoritative mint target, it's the canonical Tailwind neutral-400, and it's byte-identical to the existing shadcn `--ring`. All 9 greys verified chroma-0 (the substantive "lossless for greys" property). Detail in `claude-progress.md`.
- **Biome 80-col wrap (formatting deviation):** the verbatim inline side-pole comment exceeds 80 cols, so Biome wrapped the `oklch()` args. Moved both comments to their own line ABOVE each declaration — exact text preserved verbatim, declarations single-line. Load-bearing content unchanged.
- **ultracode vs contract:** session had ultracode on, but CLAUDE.md §6 bars auto-orchestration on critical paths (it bypasses the named-reviewer cascade). Ran the disciplined sequential ritual instead; used the Agent tool only for the mandated `@code-reviewer` (with `model:"opus"` override — the subagents pin fable-5 and die in an Opus session).

## Ritual / gates

- Writer/reviewer → pre-PR self-audit (§5.10, all PASS, 4 surprises caught & resolved) → `@code-reviewer` (CLEAN, approve; no CRITICAL/HIGH/MEDIUM). No `@security-auditor` (per plan). No `@db-migration-reviewer` (no migration).
- `ZUGZWANG_ENV=preview just verify` → exit 0. `pnpm vitest run` (full suite) → **1008 passed / 0 failed** (3 files / 2 tests skipped, 5 todo) against the local supabase DB (already migrated to head 0018, port 54322). No-raw-uuid guard remains `it.todo` (non-failing; `/m/[slug]` is slug-addressed).

## Open questions / surprises (none blocking)

- **OQ-5 dev-smoke page** — comment "removed by DESIGN.7 close-out" is now stale (SHELL/UI.0 is the DESIGN.7 mint, did not remove it). Maintenance-sweep deletion candidate.
- **Admin audit page** (`src/app/(admin)/admin/moderation/audit/page.tsx:22`) — code comment calls `--color-yes/no` "placeholder brand tokens"; now stale (real side poles). Out-of-fence (admin surface, OQ-1); → admin-pass truth-up.
- **CLAUDE.md** — confirmed **no change** needed (no invariant/contract shift; no token/DESIGN.7 reference to update).

## Next session starts at (exact next action)

Two independent follow-ups, neither blocking this PR:
1. **Staging-verify (§11)** — operator action first: on staging, clear the pre-existing DEBATE.9-close `migrations:"drift"` (redeploy) and seed ≥1 Open market (+ ideally 1 Draft) with known slugs via admin market-CRUD. Then walk the §11 checklist: signed-out `/m/<open-slug>` → placeholder (no auth redirect), `/m/<unknown>` → 404, `/m/<draft-slug>` → 404; signed-in header shows pseudonym; primitives render monochrome; `/api/health` head = `0018`.
2. **DEBATE.4** — the debate view (two-column / ranking / markers / Support–Counter aggregates) composes this shell. The `/m/[slug]` placeholder is its entry point.

## Context to preserve

- Local full-suite run needs the supabase stack on :54322 (Docker CLI is at `/Applications/Docker.app/Contents/Resources/bin/` — not on PATH; the `docker-credential-desktop` helper lives there too). `pnpm vitest run` directly (not via `just`) leaves `DATABASE_URL` unset so `tests/_setup/env.ts` defaults it to `:54322`.
- shadcn primitives reference only monochrome semantic tokens; `--destructive` (red) survives in the unused `badge`/`button` destructive variant (OQ-1, admin-only) — participant surfaces avoid it.
- The shadcn semantic `:root` ramp and the new `--color-n*` ramp intentionally point at the same greys (two vocabularies; documented in `globals.css` + design-language §2.1).

## Time

~Single execute session, 2026-06-24.
