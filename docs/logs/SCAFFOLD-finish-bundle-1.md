# SCAFFOLD-finish Bundle 1 — execute-phase close-out

**Stratum:** SCAFFOLD.5 + .6 + .7 (observability stack)
**Branch:** `scaffold/observability-bundle`
**State:** Execute complete; PR open; awaits operator review.
**Date:** 2026-05-26

---

## What landed

5 commits on `scaffold/observability-bundle`:

| # | Commit | Phase | Files |
|---|---|---|---|
| 1 | `chore(scaffold-finish-bundle-1): commit mini-plan as Phase 0 substance contract` | Phase 0 | `docs/plans/SCAFFOLD-finish-mini-plan.md` |
| 2 | `feat(scaffold-5): wire Sentry SDK for Next.js 16 + Turbopack via marketplace integration` | Phase 1 | 14 files (SDK deps, 4 root config files, 4 TODO swaps, 2 test updates) |
| 3 | `feat(scaffold-6): wire PostHog client+server SDKs with useFlag wrapper per AGENTS.md §7` | Phase 2 | 8 files (SDK deps, 3 new posthog lib files, instrumentation-client + layout edits) |
| 4 | `feat(scaffold-7): structured request-log helper per SPEC.1 §16.3 (Vercel runtime logs, Axiom dropped)` | Phase 3 | 4 files (`@vercel/functions` dep, new logging.ts + test) |
| 5 | `chore(scaffold-finish-bundle-1): absorb Phase 4 audit SURPRISE — refresh stale "SCAFFOLD.5 swaps console.error" docblocks` | Phase 4 absorption | 3 files (docblock prose refresh) |

PR #: pending (recorded in follow-up commit after `gh pr create`).

Net diff (vs `origin/main`):
- 21 files changed, ~2456 insertions, 99 deletions.
- 9 net-new files: 4 Sentry root configs + 3 PostHog lib files + 1 logging.ts + 1 logging.test.ts.
- 1 net-new docs file: `docs/plans/SCAFFOLD-finish-mini-plan.md`.

---

## Decisions made

### Phase 0 push-back resolved 5 drift findings against the original kickoff

The original kickoff arrived with three dispositive contradictions against repo state. Pushed back via `AskUserQuestion`; operator answered each:

1. **`docs/plans/SCAFFOLD-finish-mini-plan.md` missing.** Operator pasted the canonical mini-plan; committed verbatim in Phase 0.
2. **`docs/adr/0007-observability.md` missing.** Per user memory `project_adr_catalogue_framing.md`, ADR file backfill is queued maintenance; substance lives in `SPEC.2 §0.1` ADR-0007 entry. Bundle 1 did NOT author the ADR file.
3. **`src/middleware.ts` doesn't exist** — operator confirmed the project's middleware architecture lives at `src/server/middleware/` (handler-stack helpers), not at the Next.js root-middleware location the original kickoff assumed. SCAFFOLD.7 became CREATE-NEW at `src/server/middleware/logging.ts`, not a `middleware → proxy` rename.
4. **AGENTS.md §8 (Tailwind/shadcn) cited for PostHog discipline; §7 is the actual section.** Minor citation fix; revised kickoff carries §7 correctly.
5. **AGENTS.md §7 mandates a `useFlag(name, defaultValue): boolean` wrapper.** Original kickoff forbade the wrapper and ordered bare `useFeatureFlagEnabled() ?? defaultValue`. Operator's call: build the wrapper per AGENTS.md (canonical); revisit wrapper-vs-call-site convention in the post-ADR sweep.

### Critical-path scope decisions

- **`src/server/moderation/openai.ts:109` TODO(SCAFFOLD.5) DEFERRED** to a follow-up critical-path PR per CLAUDE.md §1 + the kickoff refusal trigger. The other 4 TODO sites resolved in Phase 1.
- **No call-site wiring of `logRequest`** in this bundle. The helper exists at `src/server/middleware/logging.ts` and is callable; ENGINE-phase handlers (bet / comment / resolution) will wire it as their step-7 observability sibling per AGENTS.md §7. The cron handler intentionally stays without a `logRequest` call — system-initiated cron traffic is not the "per-request" surface SPEC.1 §16.3 H3 targets.

### Sentry / PostHog / Vercel deviations from the original kickoff (carried into the revised kickoff)

- **Webpack-only `withSentryConfig` options dropped** — `excludeServerRoutes`, `webpack.autoInstrumentServerFunctions`, `webpack.autoInstrumentMiddleware`, `unstable_sentryWebpackPluginOptions` are no-ops under Turbopack and would have cluttered the config.
- **No custom fail-soft try/catch wrappers** around Sentry / PostHog init — both SDKs no-op gracefully on missing keys; the kickoff and the SDK docs agree.
- **No manual release wire** (`release: process.env.VERCEL_GIT_COMMIT_SHA`) — Sentry Vercel Marketplace integration auto-tags releases via the `runAfterProductionCompile` hook (default for SDK ≥ 10.13.0).
- **No `_experimental.turbopackReactComponentAnnotation`** — flagged experimental, deferred.
- **`request_id` field dropped from log row** — SPEC.1 §16.3 names exactly seven keys; the original kickoff's `request_id` addition was rolled back in the revised kickoff for byte-stable dataset shape.

### Sentry SDK v10 API rename

`@sentry/nextjs@10.53.1` exports `captureRequestError`, NOT `onRequestError`. The instrumentation.ts re-export uses `export { captureRequestError as onRequestError } from "@sentry/nextjs"` to satisfy Next.js's `onRequestError` instrumentation contract. Caught by `pnpm tsc --noEmit` between Phase 1 commit and verify; documented here so a future reader doesn't restore the wrong name.

### pnpm-workspace.yaml allowBuilds

Three new entries minted during dep install:
- `@sentry/cli`: true — postinstall downloads the CLI binary used at build time for source-map upload.
- `protobufjs`: true — functional postinstall used by `posthog-node` for serialization.
- `core-js`: false — postinstall is a sponsor banner only; functional no-op.

---

## Surprises caught + fixed in-session

Per CLAUDE.md §5.10 + user memory `feedback_audit_surprises.md` — full chain, not buried.

1. **Phase 0 push-back chain (5 drift findings).** See "Decisions made" above. The original kickoff would have produced a `src/proxy.ts` that didn't belong, a missing `useFlag` wrapper that contradicted AGENTS.md §7, and stale references to a non-existent ADR-0007 file. All 5 surfaced via the Phase 0 input-ack pass before any edits landed.

2. **Sentry SDK v10 `onRequestError` → `captureRequestError` rename.** First `pnpm tsc --noEmit` after Phase 1 commit failed with `TS2305: Module '"@sentry/nextjs"' has no exported member 'onRequestError'`. The Next.js instrumentation contract still expects an `onRequestError` export; the SDK now provides the same function under `captureRequestError`. Fixed via aliased re-export in `instrumentation.ts`, re-verified, no further fallout.

3. **Two integration tests failed on `consoleErrorSpy` assertions.** `tests/integration/rate-limit.integration.test.ts:250` and `tests/integration/idempotency-cache.integration.test.ts:369` were asserting on the pre-swap `console.error('<tag>', err)` shape. Migrated both files to a `vi.hoisted` + `vi.mock('@sentry/nextjs')` pattern with `mockCaptureException` discriminator, removed the now-dead `consoleErrorSpy` infrastructure, refreshed the file-header comments to reference Sentry's `captureException` byte-identically. Tests pass 20/20.

4. **Phase 4 audit caught 3 stale block-comments.** `src/server/idempotency/cache.ts:65`, `src/server/middleware/rate-limit.ts:36`, `src/server/storage/sweep-orphans.ts:39` each described the failure-mode posture in terms of "console.error stub + SCAFFOLD.5 routes to Sentry later." Absorbed via commit #5 (chore) per CLAUDE.md §7 cleanup-absorption rule.

5. **Phase 4 audit DEFERRED SURPRISE.** Three unmarked `console.error` sites in `src/app/api/cron/r2-orphan-sweep/route.ts` (lines 57 `cron_misconfigured`, 72 `cron_lock_acquire_failed`, 114 `cron_lock_release_failed`) match the SPEC.2 §17.3 alarm-6 vendor-unavailability / cron-job-failure pattern but lack `TODO(SCAFFOLD.5)` markers. Outside this bundle's TODO-contract; surfaced for the follow-up SCAFFOLD.5 critical-path PR that also resolves `src/server/moderation/openai.ts:109`.

---

## Pre-PR self-audit (CLAUDE.md §5.10)

PASS / FAIL / SURPRISE per kickoff Phase 4 checklist:

| # | Item | Result |
|---|---|---|
| 1 | `@sentry/nextjs` pinned ≥ 10.13.0 | **PASS** — `10.53.1` literal |
| 2 | `@vercel/functions` pinned ≥ 3.6.0 | **PASS** — `3.6.0` literal |
| 3 | Sentry init uses `instrumentation-client.ts` | **PASS** — root file exists, `Sentry.init` runs |
| 4 | Sentry init does NOT include any Webpack-only options | **PASS** — `withSentryConfig` carries only `org` / `project` / `silent` |
| 5 | Sentry init does NOT include custom fail-soft try/catch wrapper | **PASS** — bare `Sentry.init` at module top |
| 6 | Sentry init does NOT manually wire `release` | **PASS** — no `VERCEL_GIT_COMMIT_SHA` reference (only documented in a negative-phrasing comment) |
| 7 | `useFlag(name, defaultValue): boolean` exists at `src/lib/posthog/use-flag.ts` per AGENTS.md §7 | **PASS** — signature matches verbatim, `defaultValue` required (no optional, no default) |
| 8 | PostHog init does NOT include custom fail-soft try/catch wrapper | **PASS** — only a `if (posthogKey)` presence check (not try/catch) |
| 9 | Logging step added at simplest insertion point in `src/server/middleware/` | **PASS** — `logging.ts` created |
| 10 | Logging step does NOT create `src/proxy.ts` or `src/middleware.ts` | **PASS** — neither file exists |
| 11 | Logging step uses `ipAddress()` from `@vercel/functions` | **PASS** |
| 12 | Structured-log row matches SPEC.1 §16.3 field set EXACTLY (7 fields, no additions) | **PASS** — `timestamp`, `user_id`, `route`, `status_code`, `ip`, `user_agent`, `latency_ms`; no `request_id` |
| 13 | No business-logic changes outside of SDK init + new logging step | **PASS** — 4 TODO swaps preserve byte-identical tag strings + return shapes; tests updated to match new emission API; no semantic changes |
| 14 | `pnpm tsc --noEmit` clean | **PASS** |
| 15 | `pnpm biome check .` clean | **PASS** — 130 files |
| 16 | `pnpm vitest run` clean | **PASS** — 305 passed, 2 skipped (intentional `.skip`), 5 todo (intentional `.todo`) |

**SURPRISE items** — see "Surprises caught + fixed in-session" above. 4 absorbed in-session (one as a separate chore commit), 1 deferred to follow-up.

**Behavioral verification (deferred per CLAUDE.md §5.10 — informational only):**

- Sentry test error appears in dashboard within 30s: **DEFERRED** — verify against the preview URL after PR opens.
- PostHog test event appears in dashboard within 60s: **DEFERRED** — same.
- Structured log row appears in Vercel runtime logs after preview deploy: **DEFERRED** — same. Note: `logRequest` is not yet wired into any handler (ENGINE-phase work); the smoke surface in this bundle is the unit test at `tests/server/middleware/logging.test.ts`.

---

## Open questions

None blocking PR open or merge.

---

## Next session starts at

Bundle 2 — **SCAFFOLD.18 + .19 (CI + Backups)** per mini-plan execution sequence row 2.

Exact next action: open a new Claude Code chat, paste the Bundle 2 kickoff (TBD by operator), proceed from Phase 0 input-ack. Bundle 2 should ship BEFORE Bundle 3 so SCAFFOLD.8's staging-env PR gets CI gating immediately (mini-plan sequencing note).

---

## Context to preserve

- **Sentry Vercel Marketplace env vars are write-only** (per memory `feedback_vercel_env_writeonly.md`). Verification happens by hitting the dashboard after Preview deploy, not by reading env values via `vercel env ls` / `vercel inspect`.
- **`ipAddress()` returns `undefined` in dev** (no `x-forwarded-for` / `x-real-ip` headers locally). Production-only behavioral check.
- **`posthogServer` is `null` when `NEXT_PUBLIC_POSTHOG_KEY` is absent**. Future server-side flag callers must null-check before invoking SDK methods.
- **Follow-up critical-path PR scope** (single PR, separate task):
  - `src/server/moderation/openai.ts:109` — swap pre-anchored `console.error("openai_*", err)` for `captureException`.
  - `src/app/api/cron/r2-orphan-sweep/route.ts` lines 57 / 72 / 114 — three unmarked `console.error` sites matching SPEC.2 §17.3 alarm-6 vendor-unavailability pattern. Decide whether to swap (and mint missing TODO anchors retroactively for grep discoverability) or leave as console.error with a docblock note explaining why.
- **AGENTS.md §11 "no `console.log` in `src/server/**`" rule is documentation-only**, not enforced by Biome (the config only sets `recommended: true`, and `noConsole` is not in the recommended set). The convention holds because `src/server/middleware/logging.ts` is the project's "structured logger" referenced by §11; all server-side logging routes through it. Future bet/comment handlers must NOT add ad-hoc `console.log` calls — they MUST use `logRequest`. If this convention starts drifting, add `"suspicious/noConsole": "error"` to `biome.json` with an override for `src/server/middleware/logging.ts`.

---

## Time

~2-3h chat time, three execute commits + one Phase 0 chore + one Phase 4 absorption chore. No reviewer-call subagents invoked (non-critical-path per CLAUDE.md §1).
