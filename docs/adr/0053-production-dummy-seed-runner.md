# ADR-0053 — Production Dummy Seed Runner

| | |
|---|---|
| **Status** | proposed |
| **Date** | 2026-09-15 |
| **Deciders** | Hrishikesh (operator); team ruling relayed 2026-09-15 |
| **Tracker task** | SEED-1-DUMMY |
| **Frame document** | SEED-1 Content Seeding Strategy v1 §4–§5, §8.4; ADR-0035; ADR-0036 |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | — |
| **Amended-by** | — |

---

## Context and Problem Statement

The team ruled on 2026-09-15 that dummy content — about 1000 accounts and SEED-1-shaped post and
reply chains, with placeholder images — goes onto **production** first, using tooling the real seed
reuses later. Every operational runner in the repository refuses production by design:
`resolveRunnerTarget` and `resolveStagingTarget` refuse the production ref first and
unconditionally (ADR-0035), P-17 refuses it for every Vitest run, and
`scripts/seed-content-markets.ts` refuses `--env prod` by name. Producing engine-true rows
(ADR-0036 primitive 3) needs the Vitest harness, so a plain script is not an option.

Production is live on this date: `/api/health` reports env `prod`, eight markets are Open at 10%, and
there are no posts.

This ADR does **not** decide:

- How production is cleaned after the dummy run. Deleting selected rows with the append-only triggers
  disabled was requested and **refused**: CLAUDE.md §2 forbids it, and it would leave pools,
  positions, lots, `dharma_ledger.seq`, consumed identity tuples and injector liquidity mutated. The
  alternatives, a full in-place rebuild or a fresh-project cutover, are open decisions.
- The real seed's calibration: opening price and tank solved per SEED-1 §3. That is a later task.
- Moderation of seed content, text **or image**. `place()` is driven below the route, so the text
  precommit does not run. Seed images are also served without screening, which is a named exception
  to CLAUDE.md §2 / ADR-0046's "never served before screened". It is justified the way ADR-0027
  justifies admin market media: the content is **operator-curated**, supplied by the operator and
  labelled in the manifest, not participant content. SEED-1 D11.

## Decision Drivers

1. The existing production refusals must stay exactly as strong for every existing runner.
2. Every row must come from the shipped engine — no direct writes (ADR-0036 primitive 3/4).
3. A run must be resumable after any failure without placing a row twice.
4. A production write must be impossible to reach by accident: an explicit mode, a positive match on
   the production ref, an acknowledgement, and a typed confirmation.
5. Every created id must be recorded, so seeded data is labelled rather than hidden (SEED-1 §8.4).

## Considered Options

1. **A separate runner family with its own positive-match production guard** ← chosen
2. Widen `resolveRunnerTarget` and P-17 to admit production behind a flag
3. Point the staging runners at production by spoofing their environment

## Decision Outcome

**Chosen: Option 1.**

- `tests/prod-seed/` is a new operational runner family with its own config,
  `vitest.prod-seed.config.ts`. It is excluded from the default config, asserted in
  `tests/unit/staging/runner-isolation.test.ts`.
- `resolveSeedTarget` (`tests/prod-seed/_lib/target.ts`) has three modes and no default:
  - **local** and **staging** run P-17's check, then the staging resolver.
  - **prod** requires all of the following, and refuses every other combination:
    - `DATABASE_URL` contains `PRODUCTION_PROJECT_REF`
    - the host is Supabase
    - `ZUGZWANG_ENV=prod`
    - `ZUGZWANG_PROD_SEED_ACK=seed-dummy-content-on-production`

  The `globalSetup` check is the authoritative one. The runner's module-scope re-check cannot vouch
  for `ZUGZWANG_ENV`, because `tests/_setup/env.ts` defaults it to `prod` before the runner loads; it
  re-checks the mode, the acknowledgement, the ref and the host. The live socket is then checked
  against the mode's ref (`assertLiveConnection`).
- `scripts/seed-prod.ts` is the only entry point. For a prod write it additionally requires
  `--i-understand-this-writes-production` and the typed phrase `seed production`.
- The runner drives `createOAuthUser` → `acceptTosAction` → the image chain → `runBetTransaction` /
  `place()`. It sits behind the existing write guard, and its source tripwire is
  `tests/unit/prod-seed/no-direct-writes.test.ts`.
- **The route's checks are re-done**, because `place()` is driven below the route:
  - the conclusion freeze, read before the run and before every row; the run refuses when
    `system_state`'s `'system'` row is missing as well as when `frozen_at` is set;
  - the author's ban, before every row;
  - `validateReplyParent`, plus the parent's expected side, before every reply.
- **Resume is verified, not trusted.** Bet idempotency keys are `seed-<runId>-<marketIdx>-<seq>`, and
  each receipt's `body_fingerprint` is a sha256 of the row's content. A receipt under a seed key is
  skipped only when its fingerprint, market and user all match the table; any mismatch refuses the
  run. Run ids are lowercase alphanumerics of 8+ characters, so one run's key prefix never covers
  another's. Accounts are found again by their derived Google `sub`. A user row whose account is
  missing (an interrupted create) refuses by name rather than consuming another identity tuple.
- **`--limit N` means the first N rows of the table.** Only those rows' authors get accounts, and
  re-running the same command places nothing.
- **Manifest**: `progress-<mode>.jsonl` gets a line per placed row. `manifest-<mode>.json` is
  **rebuilt from the database** at the end of each run (accounts, pseudonyms, bets, comments, uploads,
  R2 keys), so a commit whose acknowledgement was lost is still recorded.
- **Operational guards in the CLI:**
  - a per-table lock file stops concurrent runs;
  - inherited `ZUGZWANG_SEED_*` settings are scrubbed from the environment;
  - table and images must sit outside the repository;
  - a refusal recorded by the runner stops `--until-done` from retrying.
- The table is validated by one shared `validateTable` (SEED-1 §4.3's seven rules plus the route's
  body and key rules) before generation completes and again before a run starts.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Seed table rules | `tests/prod-seed/_lib/table.ts` |
| Production seed target | `tests/prod-seed/_lib/target.ts` |
| Engine driving | `tests/prod-seed/seed.prod-seed.test.ts` |
| Operator entry point | `scripts/seed-prod.ts` |

## Consequences

### Positive

- P-17 and the staging target resolvers are unchanged, and no existing runner can reach production.
  **One shared file did change:** `tests/staging/_lib/write-guard.ts` now parses Windows stack frames.
  Before, every frame on Windows was unparseable, so the guard refused every engine write. The
  change only adds parseable forms; `/tests/` callers are still refused. The Windows branch is pinned
  by `tests/unit/staging/write-guard-frames.test.ts`, because CI runs on Linux.
- Re-running the same command after a crash continues from the first uncommitted row.
- The same tooling serves the real seed. Only the table content and the images folder change.

### Negative

- A tool that can write production now exists. Mitigated by the four-part positive match, the typed
  confirmation, the config isolation and the unit tests pinning each refusal.
- Dummy rows on production cannot be deleted in place (Bucket A). Accepted by the team. The cleanup
  path is an open decision, recorded above.
- Seed rows skip route-layer moderation (text and image) and clamping. Mitigated by table validation
  and the operator-curated exception above.
- A failed image PUT after its sign step leaves an orphan upload row. Accepted: harmless, and swept by
  the existing orphan cron.

## Security audit outcome (2026-09-15)

`@security-auditor` found no CRITICAL and no invariant break. INV-1..4, the freeze, HTTP-outside-tx,
P-17, config isolation, the write-guard change and the Google sub/email collision were all verified
safe. What changed as a result:

- **H-1 — the injector counts seed accounts.** The liquidity target is
  `GREATEST(floor, coefficient × count(users))`, with no filter. At coefficient 500, 1000 seed
  accounts raise every Open market's target to 500,000 or more, and that liquidity can never be
  removed.
  - **Built:** pre-flight reads the policy in force (the injector's own `effective_from` read) and
    projects the target after this run. If the policy is enabled and accounts are still to be
    created, the run refuses unless `--ack-injector-target <projected>` names that exact number.
  - **Needs a founder ruling:** whether to seed with the injector enabled, and at what account count.
- **M-1 — the seed flow is directional.** A float estimate moves p_yes from 10% to about 16% on every
  market at a 100k tank, so a participant who buys YES as the dummy posts appear and sells afterwards
  nets about +58%.
  - **Not built:** it needs a ruling on price-neutral stakes, a per-market impact cap, or seeding
    before participants can trade. ADR-0047 §B's "stakes too small to move anything" does not hold
    for this table.
- **M-2 — seed keys shared the participants' key space.** Fixed:
  - keys are now `seed.<runId>.<market>.<seq>`, and the `.` is outside the route's idempotency
    alphabet, so no participant request can hold one;
  - the run id is minted from a CSPRNG by default;
  - the manifest lists only rows matching the table, and anything else under the prefix is listed
    apart.
- **M-3 — images are published unscreened.**
  - **Built:** every selected image's sha256 is pinned at pre-flight and re-checked at upload. A prod
    run with images refuses unless `--ack-unscreened-images` is passed.
  - **Needs a founder ruling:** whether to run the shipped image moderation on the folder at
    pre-flight, and EXIF stripping. Both matter before the real seed uses third-party images.
- **L-1:** the CLI mints a nonce into the lock file, and the runner refuses a prod run without it.
- **L-2:** the env scrub is case-insensitive.
- **L-4:** pre-flight reads the policy in force (see H-1).
- **L-5:** the pool is `max: 4` with an idle timeout.
- **L-7:** `prepare-images` validates the table.
- **L-8:** P-17's header names the fourth config.
- **L-9:** the orphan refusal no longer suggests a direct write.
- **S-5:** seed bodies no longer say "to be replaced".
- **Open, recorded:**
  - **L-3:** local mode does not check the socket (inherited from the staging generator).
  - **L-6:** 1000 unrevoked 400-day sessions are left behind.
  - **S-1:** the market resolver controls 1000 accounts holding positions.
  - **S-2:** the released dataset has no seed label outside the manifest.
  - **S-3:** a fresh-project cutover would silently disarm `PRODUCTION_PROJECT_REF`.
  - **S-4:** pre-existing — `api/uploads/sign` checks neither ban nor freeze.

## Pros and Cons of the Options

### Option 2 — widen the existing guards

**Cons:** it weakens the refusal every existing runner depends on, permanently.
**Verdict:** Rejected (SEED-1 §6.1 says the same).

### Option 3 — spoof the staging runners' environment

**Cons:** it disarms the production guard silently.
**Verdict:** Rejected (SEED-1 §6.7).

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 §5 | INV-1..4 | consumes — every row goes through W-1; nothing disables a trigger |
| ADR-0036 | primitives 3, 4 | consumes — engine-only writes, write guard, source tripwire |
| ADR-0035 | production refusal | shapes — left intact; a separate positive-match resolver is minted |
| SEED-1 | §4.3, §8.4 | consumes — table rules; the manifest as label |

---

*ADR-0053 ratifies a separate, positive-match production seed runner that drives the shipped engine,
resumes by deterministic keys and records every id it creates. It leaves every existing production
refusal unchanged.*
