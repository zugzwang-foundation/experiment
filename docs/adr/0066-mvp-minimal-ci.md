# ADR-0066 — Minimal CI gate for the MVP launch

| | |
|---|---|
| **Status** | proposed |
| **Date** | 2026-10-05 |
| **Deciders** | Hrishikesh (operator) |
| **Tracker task** | MVP-MINIMAL-CI |
| **Frame document** | ADR-0024 (deploy pipeline), STAGING-FAST-DEPLOY (founder ruling, 2026-09-28, recorded in `ci.yml`) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | — |
| **Amended-by** | — |

> **Number:** 0065 is taken by the open `feat/launch-db-copy` branch (ADR-0065), so this is 0066 to avoid an add/add collision when both land.

---

## Context and Problem Statement

Since STAGING-FAST-DEPLOY (2026-09-28) staging deploys skip CI. The 146 commits that make up the launch version reached `staging` untested and met CI for the first time on the `staging` → `main` PR, where `vitest run` failed.

Measured file by file on Linux against both `staging` (0c9b678) and `main` (7314ab4): **none** of the failures was a regression in a money, auth, resolution or admin path. 96 were UI/design tests pinning the pre-redesign markup, 6 were design-rule checks, 2 were a date-bomb test (also failing on `main`), and the rest were artifacts of the reproduction environment. A ~600-file suite that fails on deliberate UI change blocks the launch without protecting anything that the critical set does not already protect.

## Decision Drivers

- The gate must keep protecting what can corrupt the ledger, admit a participant who should not exist, or settle a market wrongly.
- It must not block a release on a deliberate visual change.
- No test is deleted or weakened to turn CI green.
- No secrets in CI.

## Considered Options

1. **Gate on a critical subset; keep the full suite runnable, non-blocking** (chosen).
2. Update all ~96 stale UI tests before launch. Correct eventually, but it puts weeks of UI-test churn in front of a launch for no protection the critical set lacks.
3. Keep the full suite as the gate and merge red. Rejected: a gate that is routinely ignored is no gate.

## Decision Outcome

**Option 1.**

- `ci.yml` (every PR into `main`, and called by every production deploy) runs: install → Biome → typecheck → `drizzle-kit check` → fresh migration → `db:check-drift` → **`pnpm test:critical`**.
- `pnpm test:critical` = `tests/invariants/`, `tests/server/{auth,bets,resolution,dharma,admin}/`, and six integration flows: `composer-place`, `composer-sell`, `composer-reply`, `resolution-conservation`, `signup-create-path`, `onboarded-login-session`.
- `full-suite.yml` runs the same job with `suite: full` (`vitest run`), on demand and nightly. Non-blocking.
- **No `next build` in CI.** The build needs a reachable database and the whole runtime environment (see the Dockerfile's build stage), which CI does not have without secrets. The production build stays gated by `deploy-aws.yml`'s *Build and push image* job, which builds the production image from the commit with production values and blocks the rollout on failure.
- `deploy-aws.yml` is unchanged: it calls `ci.yml`, whose default `suite` is `critical`.

Fixed in the same change (smallest change each, no business logic):

- The two wire tests in `tests/server/admin/markets*.test.ts` take a deadline relative to the real clock, capped at the freeze. The fixed `2026-10-01` expired on that date.
- `no-raw-hex-view-layer` encodes the 2026-09-29 UIR-9 ruling (the sixteen quote-well fills, `palette.ts`) as a one-file exception pinned to exactly sixteen pairs. The literals stay literals because the server-side share-image renderer imports them.
- `QuoteWell`'s `title` prop is renamed `text`, so no mount spells `title=` (relative-time G5).
- `GlobalHeader`'s phone RULES mount is gated with `mobileResponsive &&` rather than a ternary. The render is identical.
- The tutorial's nested fixed layers declare tiers above the header (z-50/60/70) in their existing order, inside their z-50 root. The picture is identical.

## Consequences

### Positive

- The launch is gated on the paths that can do real damage, and on schema integrity.
- Nothing is deleted; the full suite still runs every night.

### Negative

- About 500 test files (UI, render, design, phone) no longer block a merge. A UI regression can reach `main`, and the nightly run is where it surfaces.
- The 33 stale UI test files are deferred work. They must be brought back in line with the redesign before the full suite can be made blocking again.

### Neutral

- Reverting is one line in `ci.yml` (the `suite` default) or deleting `full-suite.yml`.
