# STAGING-PARITY — Rebuild the staging fixture set by driving the real engine

> **Status:** drafted
> **Date:** 2026-08-05
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** **no** for the generator; **yes-adjacent** for the reset script — it disables the Bucket-A/B append-only guards on 26 relations, which is the enforcement layer behind INV-2 and INV-4. Treated as critical-path for ritual purposes (§5.6 tests-first · §5.7 invariant gate · §5.10 self-audit · §5.11 `@code-reviewer` + `@security-auditor` + `@db-migration-reviewer`).
> **Plan PR / commit:** this PR.

---

> ## ⛔ STANDING PROHIBITION — read before anything else
>
> **NEVER write `system_state.frozen_at` on staging.** Not a query, not a script, not a test, not "just to see M9 render". It is a one-shot `NULL → timestamp` transition enforced by `enforce_system_state_frozen_at` (`0003:169–186`). **It cannot be unset.** Setting it makes staging read-only **permanently**, with no undo short of a schema rebuild — 41 days before go-live. There is deliberately no write path in `src/`; **do not add one**, and do not read M9's absence from the fixture set as a gap to close. M9 is `data-blocked` **by ruling** (manifest §1.8 / §3); its capture is taken on a throwaway database instead.
>
> **NEVER run `scripts/seed-debate-view-staging.ts`, and never re-run the write path of `scripts/verify-ranking-staging.ts`.** They are the source of the corruption this task exists to remove. Both are dealt with in Slice D.
>
> **`system_state` is NOT in the truncate set** — even though it appears in `TRUNCATE_GUARDS` and therefore looks truncatable. See **Q3**.

---

## Tracker context

STAGING-PARITY has no tracker row of its own yet; it is carried by three register rows minted at PRIMITIVES-1 close-out (`docs/polish/POLISH-register-ADDITIONS.md` §B), reproduced verbatim:

| ID | Title | Class | Disposition | Routed to |
|---|---|---|---|---|
| **SP-1** | **P0** — staging-parity blocks the §23 tile verify and all profile-surface testing | B | data-blocked | STAGING-PARITY |
| **SP-2** | **DECISION** — add `CHECK (share_quantity > 0)` to `bets` | R | routed | STAGING-PARITY planning — **DDL: full ritual + ADR. Do not build silently.** |
| **SP-3** | **DOCKET** — one bad row makes a whole profile permanently unreachable; append-only means no remediation | S | routed | STAGING-PARITY — **`episodes.ts:168` is CORRECT. Do not weaken it. The question is blast radius, not whether to refuse.** |

**Build target:** `docs/polish/POLISH-0_data-manifest.md` **v1.1** (2026-08-05 IST) — §1 nine hard constraints, §2 the fixture set, §3 unreachable states, §4 six verification gates.

**Dependency status at plan time.**

| Dependency | State | Consequence |
|---|---|---|
| `docs/polish/POLISH-0_data-manifest.md` v1.1 | **NOT on `origin/main`.** Lives on branch `docs/polish-canon`, **PR #295 OPEN, unmerged** | This plan's build target is not yet in-tree. **PR #295 must merge before STAGING-PARITY execute begins**, or the executing session cannot read the manifest it is gated on. Not a blocker for *authoring* — the manifest was read in full at plan time from the branch. |
| ADR for the reset script (§1.9) | **Not written.** Next free ADR number is **0035** (highest on disk = `0034-viewer-scoped-debate-reads.md`) | Web authors ADRs. Execute gates on the ADR landing first — see **ADRs needed**. |
| `origin/staging` vs `origin/main` | **In sync.** `git diff origin/main..origin/staging` is **EMPTY**; both at `731be43145beb67aacecbdbbbee2aad3ed99431b` | No DRIFT-1 hold. The advance step is clean going in. |
| SEED-RULING / CONTENT.1 (real market questions) | Unlaunched, founder-serial | Manifest §1.4 — placeholder text only. Out of scope (§8). |
| GRAPH-WINDOW-OVERRIDE | Not started | Manifest §3 — the profile graph x-domain stays `data-blocked`. Out of scope (§8). |
| STAGING-PARITY-ENV (external cron scheduler) | Not started | Manifest §3 — lifecycle transitions are driven by admin actions here, not crons. Out of scope (§8). |

## Approach (one paragraph)

Staging's data is not merely thin, it is *counterfeit*: 37 of 39 `bets` rows were hand-INSERTed by two seed scripts that never ran the engine, so they carry `share_quantity = 0`, no `bet.placed` event, no ledger row, no position, and no pool movement — and one market sits in `Resolved` with zero `resolution_events`. Rather than patch around it (impossible — Bucket A is append-only, so there is no UPDATE that repairs a bad row), this task **wipes and regenerates**: a guarded reset that disables the 0021/0022 TRUNCATE guards for exactly one transaction, and a generator that produces every §2 fixture shape by calling the *real* engine functions — `createMarket` · `openMarket` · `place` · `sell` · `closeMarket` · `triggerResolution` · `settleMarket` · `voidMarket` · `moderateComment` · `grantInitialDharma` — with only the HTTP/cookie shell replaced. Both halves run as **Vitest-context runners** under a dedicated `vitest.staging.config.ts`, which the S1 spike proved is the only execution context that can reach the whole engine surface without a second event-writing implementation. Six named gates — event parity, conservation, replay, coverage, magnitudes, zero-share — are the acceptance bar, written as executable assertions rather than prose.

---

# INVESTIGATION RECORD (STEP 2)

Recorded verbatim so a later session need not re-derive it. All findings are against `origin/main` @ `731be431` (2026-08-05), the live staging DB (`rwfdoqzsghqhhdapxafg`), and the installed dependency tree.

## S0 · Ground verification

| # | Check | Verdict |
|---|---|---|
| 0a | `origin/main` tip | `731be43145beb67aacecbdbbbee2aad3ed99431b` (PR #294, `chore(logs): PRIMITIVES-1`). **PR #295 (`docs/polish-canon`) is OPEN, NOT merged** — `mergeCommit: null` |
| 0b | `docs/polish/POLISH-0_data-manifest.md` | **EXISTS** and reads **v1.1** (line 4: `> **Status:** **v1.1** — 2026-08-05 IST`). **Only on branch `docs/polish-canon`** — `git ls-tree -r origin/main -- docs/polish/` returns nothing |
| 0c | `git diff origin/main..origin/staging` | **EMPTY.** `origin/staging` == `origin/main` == `731be43…`. No advance owed |
| 0d | `ls docs/adr/` | Highest = **0034** (`0034-viewer-scoped-debate-reads.md`); next free = **0035**. 33 files + `_template.md`; 0002 and 0012 unused. Not minted or reserved by this plan |

## S1 · The spike — execution context, tested rather than inferred

**The prior recon's conclusion was right; its stated reason was one of three blockers, and the important finding is what clears them.**

Spike file `/tmp/spike-import.mts` — import resolution only, no calls, no DB. `DATABASE_URL` pointed at an unreachable host (`postgresql://spike:spike@127.0.0.1:1/…`); `postgres-js` is lazy and never connects at construction.

### Run A — plain `tsx`, default resolution conditions

`pnpm exec tsx --tsconfig ./tsconfig.json /tmp/spike-import.mts <module>`

**All five modules THROW, identically:**

```
name: Error
code: (none)
message: This module cannot be imported from a Client Component module. It should only be used from a Server Component.
  at Object.<anonymous> (node_modules/.pnpm/server-only@0.0.1/node_modules/server-only/index.js:1:7)
  at Module._compile (node:internal/modules/cjs/loader:1830:14)
  at Object.transformer (node_modules/.pnpm/tsx@4.22.0/node_modules/tsx/dist/register-DJgoUG_Q.cjs:9:1709)
  at Module.load (node:internal/modules/cjs/loader:1553:32)
```

| Module | Verdict |
|---|---|
| `@/server/auth` | THROW — `server-only` |
| `@/server/dharma/conservation` | THROW — `server-only` |
| `@/server/bets/place` | THROW — `server-only` |
| `@/server/markets/open` | THROW — `server-only` |
| `@/server/admin/moderation/act` | THROW — `server-only` |

Mechanism: `server-only@0.0.1`'s `exports` map is `{ ".": { "react-server": "./empty.js", "default": "./index.js" } }`, and `index.js` is a bare `throw`. Under plain Node the `react-server` condition is absent, so the throw fires.

**Incidental:** a `.ts` file under `/tmp` transpiles to **CJS** (`package.json` has no `"type"` field → CJS), so top-level `await` fails with `Top-level await is currently not supported with the "cjs" output format`. Renamed to `.mts` to force ESM. This applies to the repo's own `scripts/*.ts` too — they are CJS under `tsx`.

### Run B — plain `tsx` + `--conditions=react-server`

`NODE_OPTIONS="--conditions=react-server" pnpm exec tsx --tsconfig ./tsconfig.json …`
*(`tsx --conditions` passes through to node and drops tsx's own `--tsconfig` parsing — `bad option: --tsconfig`. `NODE_OPTIONS` or `TSX_TSCONFIG_PATH` both work; verified both.)*

**`server-only` is fully bypassed** — it resolves to `empty.js`. **4 of 14 modules import cleanly:**

| Module | Verdict |
|---|---|
| `@/server/dharma/conservation` | **[OK]** exports: `checkCorrectedMarketConservation, checkMarketConservation` |
| `@/server/admin/moderation/act` | **[OK]** exports: `moderateComment` |
| `@/server/bets/replay` | **[OK]** exports: `isDurableIdempotencyConflict, loadDurableReplay` |
| `@/server/identity-pool/consume` | **[OK]** exports: `consumeIdentityPoolTuple` |

**The other ten hit a SECOND, independent blocker**, verbatim:

```
name: Error
code: ERR_PACKAGE_PATH_NOT_EXPORTED
message: No "exports" main defined in /Users/hrishikesh/code/zugzwang/experiment/node_modules/canonicalize/package.json
  at exportsNotFound (node:internal/modules/esm/resolve:310:10)
  at packageExportsResolve (node:internal/modules/esm/resolve:601:13)
  at resolveExports (node:internal/modules/cjs/loader:685:36)
  at Module._findPath (node:internal/modules/cjs/loader:752:31)
```

Affected: `@/server/auth`, `@/server/bets/place`, `@/server/bets/sell`, `@/server/markets/create`, `@/server/markets/open`, `@/server/markets/close`, `@/server/resolution/settle`, `@/server/resolution/trigger`, `@/server/resolution/void`, `@/server/dharma/accrual`.

Mechanism: `canonicalize@3.0.0` is ESM-only — `"type": "module"` with `"exports": { ".": { "import": "./lib/canonicalize.js", "types": "…" } }` and **no `require` key**. `tsx` transpiles repo `.ts` to CJS, so `import canonicalize from "canonicalize"` becomes a `require()`, which resolves with the `require` condition and finds nothing exported. The single importer is `src/server/idempotency/cache.ts:2` — pulled into every bet, market-lifecycle and resolution path via the idempotency layer.

### Run C — plain `tsx` + `--conditions=react-server --conditions=import`

Forcing the `import` condition globally clears `canonicalize` and immediately produces a **THIRD** blocker:

```
name: SyntaxError
message: /…/node_modules/.pnpm/@fastify+otel@0.18.0_@opentelemetry+api@1.9.1/node_modules/@fastify/otel/package.json:
         Unexpected token 'v', "var name=""... is not valid JSON
  at parse (<anonymous>)
  at Object..json (node:internal/modules/cjs/loader:1973:39)
```

All nine remaining modules fail this way (the Sentry → OpenTelemetry chain resolves a bundler artifact whose `package.json` is not JSON). **Global condition-forcing is not viable.**

### Run D — Vitest context

`/tmp/spike.vitest.config.mts` — `root` = repo, `resolve.alias` for `server-only` → `tests/_setup/server-only-shim.ts` and `@/*` → `src/*`, `setupFiles: tests/_setup/env.ts`. **ALL SIXTEEN modules import cleanly in 881 ms:**

```
[OK] @/server/auth :: auth
[OK] @/server/dharma/conservation :: checkCorrectedMarketConservation, checkMarketConservation
[OK] @/server/dharma/accrual :: accrueDailyCredit, utcDayOf, validateCreditAmount
[OK] @/server/bets/place :: place
[OK] @/server/bets/sell :: sell
[OK] @/server/bets/replay :: isDurableIdempotencyConflict, loadDurableReplay
[OK] @/server/markets/create :: FREEZE_INSTANT_UTC, createMarket
[OK] @/server/markets/open :: openMarket
[OK] @/server/markets/close :: closeDueMarkets, closeMarket
[OK] @/server/resolution/settle :: settleMarket
[OK] @/server/resolution/trigger :: triggerResolution
[OK] @/server/resolution/void :: voidMarket
[OK] @/server/admin/moderation/act :: moderateComment
[OK] @/server/identity-pool/consume :: consumeIdentityPoolTuple
[OK] @/server/auth/tos-accept :: acceptTosAction
[OK] @/db :: db
```

**Conclusion.** A plain `tsx` script cannot drive the engine — not for the one reason recon inferred, but for three, the second of which (`canonicalize`) has no non-invasive fix and the third of which (`@fastify/otel`) kills the only workaround for the second. The Vitest context clears all three with **zero new machinery**: the `server-only` alias, `vite-tsconfig-paths`, and `tests/_setup/env.ts` already exist and are already used by 20 integration suites. **This retires manifest §0 A4 / §1.3's "likely a Next request context (non-prod-gated route handler)" — no route handler is needed, and none should be added.**

## S2 · Participant creation — the cost driver, re-costed

**The pattern already exists in the repo.** `tests/integration/signup-create-path.integration.test.ts` drives the **real** create-path with no HTTP, no OAuth round-trip, no Turnstile and no cookie:

```ts
const ctx = await auth.$context;
const created = await ctx.internalAdapter.createOAuthUser(userPayload, accountData);
```

That is the exact entry `oauth2/link-account.mjs:91-94` uses. It runs `createWithHooks` → `databaseHooks.user.create.before` → **`consumeIdentityPoolTuple` (real pool allocation, ADR-0011)** → `adapter.create` → `transformInput` → the real INSERT, wrapped in `createOAuthUser`'s `runWithTransaction`. The test asserts the pool tuple's `assigned_at` flips and the composed pseudonym round-trips. It also emits `user.pseudonym_assigned` (confirmed by the file's own truncate comment, which lists `events` for exactly that reason).

**`acceptTosAction` requires beyond the signed cookie** (`src/server/auth/tos-accept.ts`, read whole):

- `cookies()` from `next/headers` — reads `onboarding_ref` (`:85–87`)
- `verifyOnboardingRef(refToken)` — HMAC verify; failure → `redirect("/sign-in")` (`:93–96`)
- `formData.get("accepted") === "true"` — the server-side checkbox gate (`:102`)
- `headers()` from `next/headers` — `x-forwarded-for` → IP, `user-agent` (`:106–108`)
- `redirect("/")` from `next/navigation` at the end (`:201`)

**Inside its transaction** (`:134–189`), in strict order:

1. `SELECT 1 FROM users WHERE id = $userId FOR UPDATE` — the tab-race lock
2. `tx.query.users.findFirst` — re-read; missing row → silent no-op; `tosAcceptedAt !== null` → idempotent no-op
3. The five-column acceptance UPDATE — `tos_accepted_at = now()`, `tos_version_hash`, `privacy_version_hash`, `tos_acceptance_ip`, `tos_acceptance_user_agent`
4. **`grantInitialDharma(tx, { userId, grantEventId, metadata })`** — first-acceptance branch only
5. `insertEvent(… "user.tos_accepted" …)`

Lock order is load-bearing: `users` → `dharma_ledger` → `events` (R1a). Runs at READ COMMITTED with the `FOR UPDATE` lock, **not** SERIALIZABLE — the file's comment explicitly warns against "fixing" that.

**Can `grantInitialDharma` be called directly?** Yes — `src/server/dharma/grant.ts` takes `(tx, { userId, grantEventId, metadata })`. Its complete write set is **exactly two rows**: one `dharma_ledger(initial_grant, bet_id NULL, amount = INITIAL_USER_DHARMA, balance_after = amount)` via `appendLedgerRow`, and one `events(dharma.granted)`. It does **not** set `tos_accepted_at`. Calling it alone leaves a user with Dharma but no ToS acceptance — inconsistent, and `session-gate` would reject that user. The consistent end state needs the 5-column UPDATE **and** the grant **and** the `user.tos_accepted` event, all in one transaction — i.e. `acceptTosAction`'s tx body, not a subset of it.

**The existing precedent for driving the whole thing:** `tests/server/auth/tos-accept-grant.test.ts` calls the **real** `acceptTosAction` against test Postgres by mocking only the shell —

```
vi.mock("@/server/auth/onboarding-ref", () => ({ signOnboardingRef: vi.fn(), verifyOnboardingRef: mockVerifyOnboardingRef }))
vi.mock("next/headers", () => ({ cookies: () => ({ get, set, delete }), headers: () => ({ get }) }))
vi.mock("@/db", async () => ({ db: (await import("../../db/_fixtures/db")).testDb }))
```

This is the whole argument for the Vitest context in one file: **the shell is mockable at the module boundary, so the engine runs unmodified and no second write path is authored.**

**Turnstile's failure mode outside a request:** it never runs. Turnstile verification is a client-token → server-verify step on the sign-in/OTP HTTP routes; `createOAuthUser` and `acceptTosAction` contain no Turnstile call. Manifest §3 already records Turnstile as unwired on staging (always-pass test keys, `data-blocked` pending AUTH-TURNSTILE-WIRE). It is not a cost line for this task.

**Cost verdict.** Participant creation is **two calls per user** — `createOAuthUser` then `acceptTosAction` — both already exercised by committed tests. The manifest's "largest single line item" framing (§2.2 v1.1 note) is **withdrawn**: it was priced against an HTTP/OAuth path that this plan does not use.

## S3 · Execution context options

| Option | Can reach | Cannot reach | Cost | Risk |
|---|---|---|---|---|
| **Plain `tsx` script** | `conservation`, `moderateComment`, `replay`, `consumeIdentityPoolTuple` (with `--conditions=react-server`) | `auth`, `place`, `sell`, all market lifecycle, all resolution, `accrual` — the entire write engine | Low to write, **infinite** to unblock | **Rejected.** Unblocking needs either `"type": "module"` on the repo (breaks every other `scripts/*.ts`) or a `canonicalize` shim in tsconfig `paths` (leaks into `next build`). Both are engine-wide changes to make a fixture script run |
| **Non-prod-gated route handler** | Everything (Next applies `react-server` natively) | — | A permanent product surface, a deploy cycle per iteration, and its own auth gate | **Rejected.** Manifest §1.3/A4 leaned this way, but it ships a data-mutation endpoint into the app for a ~90-day asset. Deploy-per-iteration also breaks the tight edit/run loop a generator needs |
| **Vitest-context runner** | **Everything** — 16/16 proven | Nothing found | Config file + runner files; all three enabling pieces already exist | **Chosen.** See Q1 |
| **Drive the deployed app over HTTP** | Everything the product exposes | Admin Server Actions are not HTTP routes; needs real Google OAuth or email-OTP per user, Turnstile, and cookie jars | Highest by a wide margin | **Rejected.** Also re-introduces the moderation API call per comment |

## S4 · The reset half

`tests/db/_fixtures/truncate.ts` read whole. Key mechanisms:

**Which triggers must be disabled** — `TRUNCATE_GUARDS` is 26 `(table, trigger)` pairs:

- **Bucket A, 9 non-partitioned:** `dharma_ledger`, `bets`, `comments`, `resolution_events`, `payout_events`, `mod_actions`, `admin_events`, `user_events`, `bet_receipts` → `bucket_a_no_truncate`
- **`events` family, 14:** the parent `events` plus **13 partitions** — `events_2026_05` … `events_2026_12`, `events_2027_01` … `events_2027_04`, `events_default` → `bucket_a_no_truncate`. Statement triggers do **not** clone to partitions; each carries its own
- **Bucket B, 3:** `identity_pool`, `image_uploads`, `system_state` → `bucket_b_no_truncate`

**Verified live on staging** (read-only catalog query): `bucket_a_no_delete` / `bucket_a_no_truncate` / `bucket_a_no_update` each appear on **23** relations; `bucket_b_no_delete` / `bucket_b_no_truncate` / `bucket_b_update_check` each on **3**. `tgenabled <> 'O'` count is **0** for all six — every guard is currently enabled at origin. All 14 `events*` relations present. **No other non-internal triggers exist in `public`.**

**Owner privilege:** `pg_tables` reports **all 38 public tables owned by `postgres`**, and the staging connection's `current_user` / `session_user` are both `postgres`. `ALTER TABLE … DISABLE TRIGGER` is therefore available — confirmed empirically, not assumed.

**The correct re-enable sequence — and why a `finally` is the weaker guarantee.** The fixture issues **one parameterless `.unsafe()` round-trip** containing `disable…` + `TRUNCATE … CASCADE` + `enable…`. Under the simple-query protocol that is **ONE implicit transaction**, and `ALTER TABLE … DISABLE TRIGGER` is transactional DDL in Postgres. So:

> **If the TRUNCATE fails, the whole batch rolls back and the guards are never left disabled.**

This also answers *"what breaks if the process dies between disable and re-enable?"* — **nothing.** A killed process drops the connection; the server aborts the in-flight transaction; the `DISABLE` is rolled back with it. The guards cannot survive a crash in the off position, because they were never committed off. A `try/finally` re-enable (manifest §1.9) is strictly weaker: it does not run on `SIGKILL`, on a lost connection, or on an OOM. **The plan adopts the single-transaction batch as the primary mechanism and keeps a post-run catalog verification as the belt.**

**`drizzle.__drizzle_migrations` must NOT be truncated — confirmed.** It is in the `drizzle` schema, not `public`; it appears in no guard list and no `TRUNCATE` list, and it is not FK-reachable from any `public` table so `CASCADE` cannot reach it. Truncating it would make `drizzle-kit migrate` believe zero migrations are applied and attempt to re-apply `0000` onward against a populated schema — every `CREATE TABLE` fails, and `/api/health`'s per-hash `migrations` field flips to `"drift"`. Staging currently reports **25 applied rows** (0000–0024). It is data the DB cannot regenerate.

**`identity_pool` — the decision.** It is in the guard list, so it *can* be truncated. **Decision: truncate it and re-seed.** Reason: `assigned_at` is a one-way `NULL → timestamp` Bucket-B transition, so tuples consumed by the users we are about to delete would be **permanently stranded** — 6 are already consumed of 200 (194 unassigned). Leaving the table intact across repeated regeneration runs burns ~10–12 tuples per run and silently walks toward `identity_pool_exhausted`; over the weeks POLISH runs, that is a live failure mode. Re-seeding costs one command — `doppler run --config stg -- pnpm db:seed:staging`, idempotent, `ON CONFLICT DO NOTHING` against `identity_pool_tuple_idx`, 200 rows. **Consequence if left out of the truncate set instead:** pseudonyms drift upward on every run (`RedBadger003` → `RedLynx004` → …), so the coverage URL list breaks on every regeneration and the fixture set stops being reproducible — a direct violation of manifest §1.3.

## S5 · Verification tooling

| Gate | Function | Reachability today | What it needs |
|---|---|---|---|
| **1 · Event parity** | none — **no assertion exists in the repo** | — | A new SQL assertion. The manifest supplies it verbatim (§4 gate 1) |
| **2 · Conservation** | `checkMarketConservation` / `checkCorrectedMarketConservation` (`src/server/dharma/conservation.ts`) | `server-only`; test-callers only; **no package script** | Callable from the Vitest context (proven [OK] in S1 runs B and D) |
| **3 · Replay** | `loadDurableReplay`, `isDurableIdempotencyConflict` (`src/server/bets/replay.ts`) | same | same (proven [OK]) |
| **4 · Coverage** | none | — | The generator emits a URL list as a build artifact |
| **5 · Magnitudes** | none | — | SQL assertions per surface class, plus the fixture design in S7 |
| **6 · Zero share_quantity** | none | — | One SQL assertion |

Given S1, **all six run in the same Vitest context as the generator** — as a `tests/staging/` gate file executed by the same `vitest.staging.config.ts`. No wrapper script, no package-script plumbing beyond one `test:staging` entry.

⚠ **Note on gate 2's shape.** `checkMarketConservation` is per-market. `docs/logs`-recorded prior art (memory, ENGINE.10): CPMM conservation is measured against **pool CASH**, not reserve-sum — pre-resolution per-market injection = `seed − (Y + Σ YES positions)`. The gate must call the real function per market, not re-derive the identity.

## S6 · Generation dependency order

§2 is a list; the actual order is a DAG. Derived:

```
0.  identity_pool seeded (200 tuples)            ← precondition, not generated
1.  ADMIN                                        ← admin has no users row; the wire gate is mocked
2.  PARTICIPANTS  (createOAuthUser → acceptTosAction)   ×10
      └─ each: pool tuple consumed, pseudonym assigned, ToS accepted, 1000 Đ granted
3.  MARKETS: createMarket  (Draft)               ×15
4.  POOLS:   openMarket    (Draft → Open)        ×14   [M1 stays Draft]
      └─ seedAmount chosen here; drives all downstream magnitudes
5.  POSTS:   place(parentCommentId = null)             [needs 2 + 4]
6.  REPLIES: place(parentCommentId = <post>)           [needs 5 — depth 1, flat]
7.  PRICE MOVEMENT: further place() calls              [needs 5; produces C11's multi-point chart]
8.  P-exited:  place → sell(full)                      [buy strictly before sell]
9.  P-flipped: place(YES) → sell(all YES) → place(NO)  [INV-3: prior comments never move]
10. BOOKMARKS  (B1 on others' posts AND replies)       [needs 5 + 6]
11. MODERATION: moderateComment({remove}) ×2, {ban} ×1 [needs 5 + 6; ban AFTER that author's content exists]
12. LIFECYCLE TERMINALS:
      closeMarket        → M5 (Closed)
      triggerResolution  → M6 (Resolving)
      triggerResolution → settleMarket(YES) → M7 (Resolved)  [settle needs positions ⇒ after 5]
      voidMarket         → M8 (Voided)
13. COVERAGE LIST emitted
14. GATES 1–6 run
```

**Hard ordering rules the DAG encodes:** users before bets (FK + Dharma balance); markets before pools before bets (`runBetTransaction` locks the pool row and asserts `Open`); content before moderation (a `content_removed` row targets a `comment_id`); bets before resolution (`settleMarket` pays positions pro-rata — a market with no positions settles vacuously and produces no `payout_events`, so M7 must carry real bets); buy before sell for P-exited; buy-then-flip for P-flipped.

**Unreachable given the order** — see §"Fixture coverage checklist" for the full list with reasons. The two that the ordering itself forecloses:

- **M9 (Frozen)** — manifest §1.8 / §3. No freeze write path exists in `src/`; the transition is one-shot and trigger-enforced. Permanently out.
- **X4 (audit feed paginates)** — `AUDIT_FEED_DEFAULT_LIMIT = 200` (`src/server/admin/moderation/audit-feed.ts:26`). Paginating the feed means **> 200 `mod_actions` rows**, each requiring a distinct comment to remove. That is an order of magnitude more content than every other §2 shape combined. Flagged for a ruling — see **Open questions**.

## S7 · Magnitudes (gate 5) — the 1010 Đ claim, verified in code

**Verified, not taken from the prompt.** `src/server/bets/place.ts:104–120`:

```
const balance = await readBalance(tx, userId);
// ENGINE.12 R4 — accrue-if-unpaid BETWEEN the balance read and the friendly pre-check
const accrual = await accrueDailyCredit(tx, { userId, previousBalance: balance, … });
if (new CpmmDecimal(accrual.balanceAfter).lessThan(stake)) { throw new InsufficientDharmaError({ balance: accrual.balanceAfter, … }) }
```

The affordability check reads `accrual.balanceAfter` — the **post-credit** balance. With `INITIAL_USER_DHARMA = "1000"` (`limits.ts:139`) and `DAILY_CREDIT_DHARMA = "10"` (`limits.ts:130`), a fresh participant's first betting day opens at **1010 Đ**. ✓

Other constants that bound the design:

| Constant | Value | Consequence |
|---|---|---|
| `BET_MIN_STAKE_POST` | `"10"` | floor for a post |
| `BET_MIN_STAKE_REPLY` | `"50"` | floor for a reply |
| `BET_MAX_STAKE` | `"10000"` | a single bet can be five-digit; four-digit is comfortably inside |
| `INITIAL_USER_DHARMA` | `"1000"` | |
| `DAILY_CREDIT_DHARMA` | `"10"` | |
| `DISCOVERY_GRID_SIZE` | `8` | §2.1 filler target = **9 Open markets** (`GRID + 1`) |
| `PROFILE_GRAPH_Y_MAX` | `10000` | the profile graph y-domain accommodates four-digit portfolios |
| `REPLY_DEPTH_MAX` | `1` | replies are flat |

**Live staging today: `max(stake) = 300`, `four_digit_stakes = 0`.** Gate 5 has never had a chance to be true.

Surface-class → fixture mapping is in the **Acceptance criteria** section.

## S8 · Gap-fill — live staging census (read-only, `default_transaction_read_only=on`)

Queried through `doppler run --project zugzwang-experiment --config stg`, session pinned read-only, guard-checked on the `rwfdoqzsghqhhdapxafg` ref fragment.

| Table | Rows | | Table | Rows |
|---|---|---|---|---|
| `users` | **16** | | `bets` | **39** |
| `markets` | **5** | | `comments` | **39** (11 posts, 28 replies, 3 with image) |
| `pools` | **4** | | `dharma_ledger` | **8** |
| **`positions`** | **13** | | `events` | **42** |
| `mod_actions` | **5** | | `bet_receipts` | **1** |
| `bookmarks` | **4** | | `image_uploads` | **11** |
| `identity_pool` | **200** (194 unassigned) | | `market_media` | **0** |
| `resolution_events` | **0** | | `payout_events` | **0** |
| `admin_events` | **0** | | `user_events` | **0** |
| `system_state` | 1 — **`frozen_at` IS NULL** ✓ | | migrations applied | **25** |

**`positions` = 13** — the count the prior recon lost. Breakdown: **YES 10** (one with `quantity = 0`), **NO 3**.

**Corruption, quantified:**

- **Gate 1 today: 37** bets with no `bet.placed` event (of 39).
- **Gate 6 today: 37** bets with `share_quantity = 0`.
- `dharma_ledger` holds **8** rows for **39** bets — `bet_stake` ×2, `daily_allowance` ×2, `initial_grant` ×4. **Conservation cannot hold.**
- **NEW — a third corruption class the manifest does not yet name:** `debate4-resolved-f2ae918a` has `status = 'Resolved'` with **zero `resolution_events` and zero `payout_events`**. The status was hand-set. INV-4's append-only chain has no row for a market the product says is settled.
- **12 of 16 users have authored content but never accepted ToS** → no `initial_grant`, no ledger rows, no `tos_accepted_at`. They could not exist through the product.
- `RedOtter002` (operator) is `banned = true`.
- Markets: Draft 1, Open 3, Resolved 1 — no Closed, no Resolving, no Voided.
- Events by type: `bet.placed` **2**, `comment.placed` **2**, `market.created` **1**, `market.opened` **1**, `dharma.granted` 4, `user.tos_accepted` 4, plus auth/upload noise. Zero `market.closed`, zero resolution events.

**The two guilty scripts, inspected:**

- **`scripts/seed-debate-view-staging.ts`** (352 lines) — raw `INSERT INTO` against `users`, `positions`, `markets`, `pools`, `image_uploads`, `comments`, `bets`, `mod_actions`. No engine, no events, no ledger. **Delete in full.**
- **`scripts/verify-ranking-staging.ts`** (209 lines) — **mixed**. Its write path (`:107–140`) raw-INSERTs `markets`, `comments`, `bets` with `share_quantity = '0'` and `price_at_bet = '0.5'`; that is the direct producer of `debate8-ranking-demo-*` (23 comments) and the `episodes.ts:168` throw. But steps 1, 3 and 4 are **genuine read-only verification**: the schema check (`stake_at_post_time` dropped, `comments_ranking_idx` survives), the live re-run of the exact `ranking-substrate.ts` aggregate query, and feeding that substrate to the pure `src/lib/ranking.ts` to print the Top order + lane badges. **Keep 1/3/4, delete 2, take the market by slug argument instead.**

---

# THE PLAN

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| **INV-1** Bet ↔ comment atomicity | **yes** (exercised, never bypassed) | Every bet is written by `place()` inside `runBetTransaction`'s SERIALIZABLE wrapper. The generator never INSERTs into `bets` or `comments` | `tests/staging/gates.staging.test.ts` — gate 1 (event parity) + a `bets.comment_id IS NULL` count = 0 |
| **INV-2** Dharma non-transferable / no overdraft | **yes** (exercised) | All Dharma movement comes from `grantInitialDharma`, `accrueDailyCredit`, and `place`/`sell` ledger rows. No transfer path is written or needed | gate 2 — `checkMarketConservation` per market |
| **INV-3** Comments side-bound at post-time | **yes** (exercised by P-flipped) | `place()` writes `side_at_post_time` at insert; the flip sequence (buy YES → sell all → buy NO) proves prior comments do not move | gate 4 coverage + `I-SIDE-BIND-001` already on disk |
| **INV-4** Resolutions append-only | **yes — and the reset script disables its storage-layer guard** | The reset disables `bucket_a_no_truncate` on `resolution_events` + `payout_events` for exactly one transaction, then TRUNCATEs. `bucket_a_no_update` / `bucket_a_no_delete` are **never** disabled | a catalog assertion that all 26 guards read `tgenabled = 'O'` after every reset run, and `tests/db/triggers/truncate-rejected.spec.ts` (already on disk) as the positive control |

**Critical-path failure modes.**

- *If the post-reset guard verification is missing or wrong*: a reset that fails between `DISABLE` and `ENABLE` in a way that **commits** (impossible under the single-transaction design, but reachable if a future edit splits the batch into separate round-trips) leaves `resolution_events` and `dharma_ledger` UPDATE-able and TRUNCATE-able on a live environment. The append-only property that makes the Nov 6 dataset credible would be off, silently, with nothing to notice it. The catalog assertion is what makes "the batch is still one transaction" checkable rather than assumed.
- *If the generator ever writes a `bets` or `events` row directly*: the whole verification chain becomes circular — gate 1 would pass because the generator wrote both halves. The guard is a lint-level assertion that the generator source contains no `INSERT INTO bets|comments|events|dharma_ledger|resolution_events|payout_events` and no `.insert(` against those tables.

## 2. Data model changes

**None.** No new tables, columns, indexes, constraints, enums or migrations. The reset script is DML plus transient `ALTER TABLE … DISABLE/ENABLE TRIGGER`, which is not schema change — it commits and reverts within one transaction, and the catalog is asserted identical afterward.

**SP-2's `CHECK (share_quantity > 0)` is deliberately NOT here** — see §8. Gate 6 is what hands that migration a clean floor.

## 3. API surface

**None.** No route handler, no Server Action, no endpoint. This is the explicit rejection of manifest §0 A4's "non-prod-gated route handler" — S1 removed the need.

New **package scripts** only:

| Script | Command | Purpose |
|---|---|---|
| `staging:reset` | `vitest run --config vitest.staging.config.ts tests/staging/reset.staging.test.ts` | the guarded wipe |
| `staging:generate` | `vitest run --config vitest.staging.config.ts tests/staging/generate.staging.test.ts` | the fixture generator |
| `staging:gates` | `vitest run --config vitest.staging.config.ts tests/staging/gates.staging.test.ts` | the six gates |
| `staging:rebuild` | `pnpm staging:reset && pnpm db:seed:staging && pnpm staging:generate && pnpm staging:gates` | the full loop |

All four are run under `doppler run --project zugzwang-experiment --config stg --`.

## 4. UI / user flow

**None — data-only task.** The *consumers* are POLISH.1–.8's inspection surfaces; this task changes no rendering code. Its user-facing deliverable is the **coverage URL list** (§"Deliverables"), which POLISH inspectors navigate from.

## 5. Failure modes

| Failure | Detection | Recovery |
|---|---|---|
| Reset transaction fails mid-batch | Non-zero exit + the post-run catalog assertion | **Automatic** — the single implicit transaction rolls back; guards were never committed off. Re-run |
| Process `SIGKILL`ed during reset | Post-run catalog assertion on the next run | **Automatic** — connection drop aborts the transaction server-side |
| Guard left disabled by a future edit that splits the batch | The catalog assertion fails and exits non-zero | Manual `ALTER TABLE … ENABLE TRIGGER` for the 26 pairs; the assertion prints the offending `(table, trigger)` rows |
| Reset pointed at **production** | The `DATABASE_URL_STAGING` + `STAGING_PROJECT_REF_FRAGMENT` guard (the `migrate-staging.ts` precedent) **and** a `ZUGZWANG_ENV !== "prod"` assertion **and** a positive assertion that the connection's `current_database()` / ref fragment matches staging | Refuses to run; zero writes |
| `identity_pool_exhausted` mid-generation | `consumeIdentityPoolTuple` throws; the generator aborts | Re-run `db:seed:staging` then re-run the generator. The reset truncates + re-seeds precisely to prevent this drifting |
| Generation partially completes (crash after N markets) | Gate 4 coverage fails | **Clean re-create, not resume** — re-run `staging:rebuild`. Idempotent-resume is explicitly rejected (Q4) |
| `settleMarket` on a market with zero positions | Produces no `payout_events`; gate 2 passes vacuously and gate 4 catches the missing shape | The DAG (S6 step 12) places settle strictly after bets exist |
| A SERIALIZABLE 40001 storm from concurrent generation | `runBetTransaction`'s full-jitter retry absorbs it; exhaustion throws | Generation is **sequential by construction** (Q4) — no concurrency to storm |
| Moderation API called per comment | Cost + nondeterminism + a network dependency in a fixture run | `moderation/precommit.ts` is **not** on the `place()` path — it lives in `endpoint.ts`, outside the tx (ADR-0014). Skipping the endpoint skips it. Stated as a shell-layer skip in Q1 |
| Staging deploy is mid-flight during generation | `/api/health` `canary` mismatch | Generation writes to the DB, not the app; no coupling. Run the coverage inspection after health is green |

## 6. Edge cases

- **A user with zero positions and zero comments (P-empty)** must still exist and be fully onboarded — `createOAuthUser` + `acceptTosAction`, then nothing. Its `initial_grant` row exists; its balance is exactly 1000 Đ. Its profile must render every empty state at once.
- **P-flipped's ordering.** Buy YES → `sell` the *entire* YES position → buy NO. `place()` throws `OppositeSideHeldError` if any YES quantity remains (`place.ts:97–103`), so the sell must be for the full quantity. The prior YES comments keep `side_at_post_time = 'YES'` — that is the INV-3 proof, and it must be visible.
- **P-exited must NOT re-enter.** Buy → sell full → stop. If it re-enters, it is P-flipped, not P-exited.
- **Q4's opposite-slot rule** requires the *viewer* (P-owner) to hold YES on M2, so M2's NO composer renders `oppositeHeld`-disabled. That constrains which side P-owner bets on M2 — it cannot be arbitrary.
- **C9/C10 removal ordering.** `moderateComment({ action: "remove" })` targets a `comment_id`; the removed post (C9) must have surviving replies authored *before* the removal, and the removed reply (C10) must sit under a post that is *not* removed.
- **X3's banned author must have content that survives.** Ban after the content is written. ADR-0021: ban removes voice, not past content. P-banned ≠ P-removed.
- **M4 must have zero posts** — both `EmptySideCTA` slots. Any stray bet destroys the shape.
- **M3 must have no post clearing `k_lane`** — so no badge renders and Top falls back to closest-to-landslide. That is a *ceiling* constraint on M3's stakes and reply counts, not a floor.
- **Day boundaries.** `accrueDailyCredit` is once per UTC day per user (`I-DAILY-ONCE-001`, unique partial index). A generation run that straddles UTC midnight gives some users two allowances and others one — a 10 Đ asymmetry, harmless to the gates but a determinism wobble. Note it; do not engineer around it.
- **`bet_receipts` idempotency.** `place()` via `runBetTransaction` is reached directly, not through `endpoint.ts`, so the durable receipt path is not exercised by the generator. Deliberate: the generator is not a replay test.
- **Admin holds no position and authors no comment** (manifest §1.6). Every `place()` call is attributed to a pooled participant; the admin identity is used only for `createMarket`/`openMarket`/`close`/`trigger`/`settle`/`void`/`moderateComment`.

## 7. Test plan

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| **Unit** (`tests/unit/`) | The reset script's guard-list constant matches `drizzle/migrations/0021`+`0022` (26 pairs, exact); the env-guard predicate refuses a non-staging URL, refuses `ZUGZWANG_ENV === "prod"`, and accepts only a URL containing the ref fragment; the generator's source contains no direct `INSERT`/`.insert(` against Bucket-A tables | INV-4 (guard-list completeness), INV-1/2 (no direct writes) |
| **Integration** (`tests/integration/`, local Postgres) | The reset + generate + gates loop runs end-to-end against `localhost:54322` with a **scaled-down** fixture set (2 users, 2 markets), proving the DAG and the gates before any staging run; a post-reset catalog assertion that all 26 guards read `tgenabled = 'O'` | INV-4 |
| **Staging runners** (`tests/staging/`, opt-in, excluded from the default config) | The full §2 fixture set against the real staging DB; the six gates | all four |
| **E2E** | none — Playwright is not installed (AGENTS.md §9) | — |

**Every touched invariant has an assertion.** INV-1 → gate 1 + the `comment_id` count; INV-2 → gate 2; INV-3 → the P-flipped sequence + `I-SIDE-BIND-001`; INV-4 → the catalog assertion + `truncate-rejected.spec.ts`.

**`tests/staging/**` must be excluded from `vitest.config.ts`'s `include`** exactly as `tests/scale/**` is — a bare `vitest run`, local or CI, must never touch a real staging database.

## 8. Out of scope

Stated explicitly so execute cannot absorb them.

- **SP-2's `CHECK (share_quantity > 0)` on `bets`.** Its own task, **after** this one, so its migration meets zero violating rows. Gate 6 is what hands it a clean floor. DDL + full ritual + its own ADR.
- **STAGING-PARITY-ENV** — the external cron scheduler for `close-due-markets` / `r2-orphan-sweep` / `alarms-drain` on staging. Own row, sequenced before TESTING.0. This task drives lifecycle transitions via the admin actions instead (manifest §3).
- **GRAPH-WINDOW-OVERRIDE** — making `WINDOW_START`/`WINDOW_END` (`graph-series.ts:31–34`) overridable on non-prod. Own task, gated on a **SPEC.1 §23 rider**. The profile graph stays `data-blocked` here. **Backdating `created_at` is forbidden** — it would mean writing timestamps the engine cannot produce.
- **Real market questions or arguments.** Blocked on SEED-RULING / CONTENT.1. **Placeholder text only** (manifest §1.4).
- **Any freeze path.** Manifest §1.8. Nothing in this task writes `system_state.frozen_at`, and no such path is designed "for later". See the standing prohibition below.
- **Code or schema parity between staging and production.** That is DP.2.
- **Any fixtures framework, factory library, or reusable seeding abstraction.** Everything dies 2026-11-05; this is a ~90-day asset. Build the minimum that produces valid data at realistic magnitudes, and stop (CLAUDE.md §5.2).
- **Weakening `episodes.ts:168`.** SP-3: the guard is correct. This task removes the bad rows; it does not soften the code that refuses them.
- **`src/` behaviour changes of any kind.** The only `src/`-adjacent change is the surgical edit to `scripts/verify-ranking-staging.ts` (delete its write path).

---

---

# DECISIONS — Q1 … Q8

## Q1 · Execution context

**Decision: a Vitest-context runner** — `tests/staging/*.staging.test.ts` executed by a dedicated `vitest.staging.config.ts`, mirroring the `tests/scale/` + `vitest.scale.config.ts` precedent exactly (opt-in, and **excluded from the default `vitest.config.ts` `include`** so a bare `vitest run` — local or CI — can never touch a real staging database).

**Named alternative rejected:** the non-prod-gated route handler that manifest §0 A4 / §1.3 leaned toward. It ships a permanent data-mutation surface into the product for a ~90-day asset, needs a deploy cycle per iteration of a generator that will be iterated many times, and needs its own auth gate. **S1 removed the reason to prefer it** — the inference that only a Next request context could reach the engine was one of three blockers, and Vitest clears all three with machinery that already exists (the `server-only` alias, `vite-tsconfig-paths`, `tests/_setup/env.ts`, all in use by 20 integration suites today).

**Justification against the ratified deviation.** The deviation permits driving the real ENGINE and skipping only the HTTP and cookie SHELL, because a second event-writing implementation is what the ruling protects against. This design writes **zero** engine code. Precisely which shell layers are skipped, per surface:

| Surface | Engine called (real, unmodified) | Shell skipped |
|---|---|---|
| **Bet / sell** | `runBetTransaction(...)` → `place(...)` / `sell(...)` | `runBetEndpoint` (`src/server/bets/endpoint.ts`) in full: origin allowlist · `auth.api.getSession` + ban check · **Redis idempotency lookup/reserve** · **rate limit** · zod body validation · **OpenAI moderation precommit** · the `bet_receipts` durable receipt · the wire envelope. Moderation is a *shell* layer by ADR-0014's own construction — it runs strictly **outside** the transaction. Skipping it removes a paid network call, its latency, and its nondeterminism from a fixture run whose text is placeholder anyway |
| **Market lifecycle** | `createMarket` · `openMarket` · `closeMarket` — all plain async functions taking `{ …, now, metadata }`, no session gate inside | `src/server/admin/markets/{create,open,close}.ts` Server Actions: `requireAdminSession()` · zod wire parse · `canonicalizeAmount18` · `revalidatePath`. **The generator must canonicalize `seedAmount` itself** (pass an exact 18-dp string) since that step lived in the wire |
| **Resolution** | `triggerResolution` · `settleMarket` · `voidMarket` — same shape | `src/server/admin/markets/{resolve,void,correct}.ts`: same four wire layers |
| **Moderation** | `moderateComment({ commentId, action })` — the real function, including its `mod_actions` append and `users.banned_at` set | Only the two shell calls *inside* it: `requireAdminSession()` (`act.ts:63`) mocked to a session, and `revalidatePath` (`next/cache`) mocked to a no-op. Everything after the gate is untouched |
| **Onboarding** | `auth.$context.internalAdapter.createOAuthUser(...)` — real Better Auth create-path, real `user.create.before` hook, real `consumeIdentityPoolTuple`; then the real `acceptTosAction(formData)` | `next/headers` (`cookies`/`headers`), `next/navigation` (`redirect`), and `verifyOnboardingRef` — the signed-cookie shell. The transaction body (5-column ToS UPDATE → `grantInitialDharma` → `user.tos_accepted`) runs unmodified |
| **Bookmarks** | `addBookmarkAction(commentId)` | `next/headers` + `auth.api.getSession`, mocked to the acting viewer |

**Nothing in the generator writes a row directly.** No `INSERT INTO`, no `db.insert()` against `bets`, `comments`, `events`, `dharma_ledger`, `positions`, `pools`, `resolution_events`, `payout_events`, `mod_actions`, `bet_receipts`. A lint-level unit assertion enforces it (§7).

## Q2 · Participant creation, concretely

Per user, in order:

```
1.  const ctx = await auth.$context

2.  const { user } = await ctx.internalAdapter.createOAuthUser(
      { email, name, image, emailVerified: true, googleId },
      { providerId: "google", accountId: googleId,
        accessToken: "…", refreshToken: "…", idToken: "…",
        scope: "openid email profile",
        accessTokenExpiresAt: null, refreshTokenExpiresAt: null },
    )
    →  writes: users (pseudonym + pfp_filename from the REAL pool consume),
               accounts, identity_pool.assigned_at, events(user.pseudonym_assigned)

3.  mockVerifyOnboardingRef.mockReturnValue({ userId: user.id })
    mockCookiesGet.mockReturnValue({ value: "<any>" })
    const fd = new FormData(); fd.set("accepted", "true")
    await acceptTosAction(fd)            // NEXT_REDIRECT is expected — mock
                                          // next/navigation's redirect to a noop
    →  writes (ONE transaction): users 5-column ToS evidence,
               dharma_ledger(initial_grant, +1000, balance_after 1000),
               events(dharma.granted), events(user.tos_accepted)
```

**End state per manifest §2.2:** pseudonym assigned from the pool ✓ · `tos_accepted_at` set ✓ · initial Dharma granted through `grantInitialDharma` ✓ · not banned ✓.

**P-banned is the same three steps, plus** `moderateComment({ commentId, action: "ban" })` **after** that user's content exists — ADR-0021: ban removes voice, not past content.

**Turnstile does not participate.** It is a client-token → server-verify step on the sign-in / OTP HTTP routes; neither `createOAuthUser` nor `acceptTosAction` contains a Turnstile call. Its failure mode outside a request is that it never runs.

**⚠ P-owner needs a capture-before-reset step.** P-owner is the operator's own Google account. If the generator seeds it with a *fabricated* `googleId`, the operator's next real sign-in finds no matching `accounts` row, tries to create a new user, and collides on the `users_email_idx` UNIQUE — a hard sign-in failure on staging. **Before the first reset, capture the operator's `users.email` and `accounts.account_id` (the Google `sub`) from the live staging rows and feed them to the generator as P-owner's identity.** Values are read once and held in the Doppler `stg` config, never committed.

## Q3 · Reset script design

`tests/staging/reset.staging.test.ts` — one file, four guards, one transaction.

**Guard 1 — target.** `DATABASE_URL_STAGING` must be set and must contain `STAGING_PROJECT_REF_FRAGMENT` (the exact `migrate-staging.ts` / `verify-ranking-staging.ts` precedent). Additionally: the URL must **not** contain the production ref `zbvprdcyxhlguxbostdj`. Refuse with a non-zero exit otherwise.

**Guard 2 — environment.** `ZUGZWANG_ENV` must equal `"staging"`. Not "is not prod" — a positive match, so an unset or `"unknown"` value also refuses.

**Guard 3 — atomicity (primary) and `finally` (belt).** The disable → `TRUNCATE … CASCADE` → enable sequence is issued as **one parameterless `client.unsafe()` round-trip**, i.e. one implicit transaction under the simple-query protocol. `ALTER TABLE … DISABLE TRIGGER` is transactional DDL, so a failure at any point — including a killed process or a dropped connection — rolls the disable back. The `finally` re-enable required by manifest §1.9 is retained, but the plan states plainly that **it is the weaker mechanism**: it does not run on `SIGKILL`, OOM, or a lost socket, and the batch design does. If a future edit ever splits the batch into separate round-trips, the `finally` becomes load-bearing and Guard 4 is what notices.

**Guard 4 — verification, not assumption.** After the batch, a catalog query:

```sql
SELECT c.relname, t.tgname, t.tgenabled
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                  JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgname LIKE 'bucket_%'
```

must return **exactly 78 rows** — `bucket_a_no_delete` / `no_truncate` / `no_update` on **23** relations, `bucket_b_no_delete` / `no_truncate` / `update_check` on **3** — with **`tgenabled = 'O'` on every one**. Any deviation prints the offending `(table, trigger, tgenabled)` rows and exits non-zero. *(78 = 23×3 + 3×3, verified live on staging at plan time.)*

**The truncate set — and two deliberate exclusions.**

*Truncated:* `bets`, `comments`, `dharma_ledger`, `events` (+ its 13 partitions via the parent), `resolution_events`, `payout_events`, `mod_actions`, `admin_events`, `user_events`, `bet_receipts`, `positions`, `markets`, `pools`, `market_media`, `bookmarks`, `image_uploads`, `users`, `accounts`, `sessions`, `verifications`, `identity_pool`.

*NOT truncated — `drizzle.__drizzle_migrations`.* It lives in the `drizzle` schema, is in no guard list, and is not FK-reachable from `public`, so `CASCADE` cannot reach it. Truncating it would make `drizzle-kit migrate` believe zero migrations are applied and re-run `0000` onward against a populated schema; `/api/health` would report `migrations: "drift"`. Staging holds **25** applied rows. It is data the database cannot regenerate.

*NOT truncated — **`system_state`**.* ⚠ **This is a correction to the guard-list-shaped intuition.** `system_state` *is* in `TRUNCATE_GUARDS`, so it *can* be truncated — and must not be. Its singleton row (`id = 'system'`, `frozen_at NULL`) is seeded by **migration `0004_seed_system_state.sql`**, which `drizzle-kit` believes is already applied and will never re-run. `pnpm db:seed:staging` seeds only `identity_pool`. Deleting the row leaves no restore path short of a raw INSERT into a Bucket-B table — and `isFrozen()` (`src/server/system/is-frozen.ts:14–19`) reads `row?.frozenAt != null`, so a **missing row fails open silently**: the freeze sentinel would simply cease to exist, with nothing reporting it. It is excluded, and its guards are never disabled.

*Truncated but immediately re-seeded — `identity_pool`.* See S4 and Q4.

**No DDL. No migration. `bucket_*_no_update` and `bucket_*_no_delete` are NEVER disabled** — only the three `*_no_truncate` guards are, and only for the one transaction.

## Q4 · Determinism

**Decision: clean-recreate, never idempotent-resume, and a literal fixture table instead of a seeded RNG.**

- **No RNG at all.** Manifest §1.3 permits a seeded RNG; a hand-written fixture table is strictly stronger and, at ~14 markets and ~150 engine calls, is also *shorter*. Every stake, side, reply count and body string is a literal in one `fixtures.ts` data module. There is no seed to lose and no generator version to reproduce.
- **Pseudonyms become reproducible** *because* the reset truncates and re-seeds `identity_pool`. `scripts/seed-staging.ts` builds its 200 rows as `COLOURS.flatMap((colour) => ANIMALS.map(...))` and inserts them in a fixed `for` loop, so `created_at ASC` — the FIFO order `consumeIdentityPoolTuple` reads — is deterministic. Run N and run N+1 assign the *same* pseudonym to the same role. Leaving `identity_pool` untruncated would drift pseudonyms upward every run (`RedBadger003` → `RedLynx004` → …), break the coverage URL list on every regeneration, and walk toward `identity_pool_exhausted` at ~10–12 stranded tuples per run.
- **Slugs are literals** — `sp-m1-draft`, `sp-m2-active`, … — so `/m/<slug>` URLs are stable across runs. Profile URLs are `/u/<pseudonym>`, stable by the point above.
- **What is *not* deterministic:** UUIDv7 primary keys and all timestamps. That is inherent to the engine and is not worked around. Consequence: the **coverage URL list is emitted as a build artifact per run**, not committed as a fixed file — but its *contents* are stable because slugs and pseudonyms are.
- **Re-runnability contract:** `pnpm staging:rebuild` = reset → re-seed pool → generate → gates. Running it twice in a row must produce the same coverage list and the same six green gates. A partial failure is never resumed — it is re-run from the reset. This is the direct answer to constraint 3's "POLISH runs for weeks against this": the recovery procedure is one command, not a diagnosis.
- **One acknowledged wobble:** `accrueDailyCredit` is once per UTC day per user. A generation run straddling UTC midnight gives some users two allowances and others one — a ≤10 Đ asymmetry, harmless to all six gates. It is noted, not engineered around.

## Q5 · How each gate runs

One file, `tests/staging/gates.staging.test.ts`, run by `pnpm staging:gates`. Six `describe` blocks, all reading the same staging connection.

| Gate | Artifact | Mechanism |
|---|---|---|
| 1 · Event parity | new SQL assertion | the manifest's own query, asserted `=== 0`. **No such assertion exists anywhere in the repo today** — this mints it |
| 2 · Conservation | `checkMarketConservation` + `checkCorrectedMarketConservation` (`src/server/dharma/conservation.ts`) | imported directly — proven importable in S1 runs B *and* D. Called **per market**, iterating every row in `markets`. The identity is not re-derived in the test (CPMM conservation is measured against pool **cash**, not reserve-sum) |
| 3 · Replay | `loadDurableReplay` / `isDurableIdempotencyConflict` (`src/server/bets/replay.ts`) | imported directly; proven importable |
| 4 · Coverage | the emitted `staging-coverage.json` | every §2 row id present, each with a URL, each URL's underlying row confirmed by a targeted query |
| 5 · Magnitudes | six SQL assertions, one per surface class | see **Acceptance criteria** — written as criteria, never prose |
| 6 · Zero-share | one SQL assertion | `SELECT count(*) FROM bets WHERE share_quantity = 0` → `0` |

No wrapper script and no new package plumbing beyond the four `staging:*` entries. Gates 2 and 3 need no wrapper at all — that was a consequence of the plain-`tsx` premise S1 retired.

## Q6 · Slice boundaries and the session split

Each slice ends at a clean PR boundary with a `docs/logs/STAGING-PARITY-<slice>.md` session log, so the next session resumes from a stated next action.

| Slice | Scope | Ends when | Resumes at |
|---|---|---|---|
| **A · Reset** | `vitest.staging.config.ts`; `tests/staging/reset.staging.test.ts`; the 26-pair guard constant; guards 1–4; the `system_state` + `__drizzle_migrations` exclusions; unit tests for the guard predicate + the guard-list/migration-parity assertion; a local-Postgres integration test of the whole disable→truncate→enable→verify loop; `@code-reviewer` + `@security-auditor` | The reset runs green against **local Postgres**, and its guards provably refuse a non-staging URL. **It is NOT yet run against staging** | Slice B, with a reset that is safe to point at staging |
| **B · Skeleton** | `fixtures.ts` (the literal fixture table); participant creation ×10; `createMarket` ×14; `openMarket` ×13; one post per market; gates 1, 2, 3, 6 | The first real staging reset + generate + four mechanical gates are green | Slice C, on a staging DB that is already event-legal |
| **C · Content** | M2's C1–C6, C8–C11; M3's below-floor shaping calibrated against `src/lib/ranking.ts`; positions Q1–Q5; bookmarks B1–B2; moderation X1–X3; P-flipped and P-exited sequences; gate 5 | All of §2 except C7 and X4 is produced, and gate 5 is green | Slice D, with only the image path outstanding |
| **D · Close** | C7's image attachment (sign → PUT → verify → `place({image})`); **delete `scripts/seed-debate-view-staging.ts`**; **surgery on `scripts/verify-ranking-staging.ts`** (delete the write path, take a market slug argument, keep steps 1/3/4); the coverage URL list artifact; a full `staging:rebuild` from scratch; §5.10 self-audit; close-out log | All six gates green from a cold reset, coverage list published into `POLISH-register.md` | POLISH.1–.8 |

**Why A is alone.** It is the only slice that disables an invariant's storage-layer enforcement. Bundling it with generation work would put a `@security-auditor` pass on a diff that is 90% fixture data, which is how a real finding gets lost in the noise.

## Q7 · Estimate

**Four sessions, with a fifth held in reserve.** A prior note guessed 2–3; that estimate priced neither the reset script's ritual nor the content-shaping calibration, and it over-priced participant creation.

| Slice | Sessions | Why |
|---|---|---|
| A · Reset | **1.0** | |
| B · Skeleton | **1.0** | |
| C · Content | **1.0** | |
| D · Close | **1.0** | |
| *(reserve)* | *0.5–1.0* | C7's R2 path, or a ranking re-calibration |

**Cost driver 1 — the reset script: ~1 full session, and the code is not why.** The artifact is ~120 lines. What costs a session is the gate around it: an ADR must land **first** (web-authored — a hard serialization point this task does not control), then tests-first per §5.6, then `@code-reviewer` → `@security-auditor` run sequentially (never concurrently — concurrent subagent `vitest` runs saturate local Postgres into false reds), then a §5.10 self-audit. It is the only artifact in this task whose job is to switch off the enforcement that makes the ledger credible, and it earns every one of those passes.

**Cost driver 2 — participant creation: ~0.3 of a session, down from "the largest single line item".** Manifest §2.2's v1.1 note priced this against an HTTP/OAuth path. S2 found both halves already have committed precedent — `tests/integration/signup-create-path.integration.test.ts` for the create path and `tests/server/auth/tos-accept-grant.test.ts` for the shell-mocked ToS path — so the work is assembling two known calls into a loop over ten literal identities. **The manifest's framing is withdrawn.** What is genuinely expensive in its place is **content shaping**: C3 requires one post to dominate each of three lanes and C4 requires most posts to dominate none, against `kLane = 3` and floors `n ≥ 5 · D ≥ 200 · n^b ≥ 3` — all of which are labelled *"pre-tuning placeholder — NOT final; pins 2026-09-01"* in `src/lib/ranking.config.ts`. That is an iterative calibration against `ranking.ts`, and it may need redoing after the tuning pass.

## Q8 · ADRs needed

**Two. Web authors both. Execute gates on ADR-0035 landing first.** Numbers are *proposed against the current ceiling* (highest on disk 0034, next free 0035) and must be re-checked at authoring time.

**ADR-0035 — Guarded staging reset: owner-privilege trigger disablement in a committed operational artifact.** Must decide:

1. **Whether** promoting the deliberately test-only `tests/db/_fixtures/truncate.ts` pattern to a committed *operational* artifact is permitted at all. `truncate.ts` says in its own header: *"NEVER import this from `src/**` (production must not gain an escape hatch)."* This task does not import it into `src/` — it re-implements the pattern under `tests/staging/` — but the decision to have a second copy of the escape hatch is exactly a decision, not a convenience.
2. **The required mechanism:** the single-implicit-transaction batch, with the `finally` demoted to a belt. This is a correction to manifest §1.9's ordering and should be recorded as such.
3. **The exclusion set** — `drizzle.__drizzle_migrations` and `system_state` — and *why* each is excluded, since the `system_state` exclusion is counter-intuitive (it appears in the guard list, so it looks truncatable).
4. **The guard contract:** staging-only by positive match, prod refused by construction, `bucket_*_no_update` / `no_delete` never disabled, and a post-run catalog verification that exits non-zero.
5. **Scope and lifetime** — staging only, dies with the experiment on 2026-11-05, never reachable from `src/`.

**ADR-0036 — Vitest-context runners for operational staging tasks.** Must decide:

1. **Whether** a Vitest context is an acceptable *execution vehicle* for non-test operational work, or whether that conflates the test runner with an operations tool. This is a pattern other code will copy — the template's third ADR criterion.
2. **The shell-mocking boundary** as a stated rule: which layers may be mocked (`next/headers`, `next/navigation`, `next/cache`, `requireAdminSession`, `auth.api.getSession`, `verifyOnboardingRef`) and which may **never** be (anything that writes an event, a ledger row, or a bet).
3. **The isolation requirement** — `tests/staging/**` excluded from `vitest.config.ts`'s `include`, mirroring `tests/scale/**`, so no default run can reach a live database.
4. Whether it **supersedes or amends** manifest §0 A4 / §1.3's "likely a non-prod-gated route handler", which S1 empirically retired.

**This plan does not write either ADR.** ADRs are web-authored; the names and the decision surface above are the handoff.

---

# ACCEPTANCE CRITERIA

Literal and checkable. STAGING-PARITY is not done until **all six** pass from a cold `staging:rebuild`.

### Gate 1 · Event parity

- [ ] **G1.1** `SELECT count(*) FROM bets b WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.aggregate_id = b.id AND e.event_type = 'bet.placed')` **= 0**  *(today: 37)*
- [ ] **G1.2** `SELECT count(*) FROM comments c WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.aggregate_id = c.id AND e.event_type = 'comment.placed')` **= 0**
- [ ] **G1.3** `SELECT count(*) FROM bets WHERE comment_id IS NULL` **= 0** *(INV-1)*
- [ ] **G1.4** every market with `status <> 'Draft'` has a `market.opened` event; every `Closed`/`Resolving`/`Resolved`/`Voided` market has its corresponding lifecycle event
- [ ] **G1.5** every market with `status IN ('Resolved','Voided')` has **≥ 1 `resolution_events` row** *(today `debate4-resolved-f2ae918a` has 0 — the third corruption class)*

### Gate 2 · Conservation

- [ ] **G2.1** `checkMarketConservation(marketId)` passes for **every** row in `markets` — iterated, not sampled
- [ ] **G2.2** `checkCorrectedMarketConservation` passes for every market carrying a correction row (zero expected; the assertion runs anyway)
- [ ] **G2.3** `SELECT count(*) FROM dharma_ledger WHERE balance_after < 0` **= 0** *(INV-2)*
- [ ] **G2.4** every user's latest `balance_after` equals the running sum of their `amount` column ordered by `seq`

### Gate 3 · Replay

- [ ] **G3.1** `loadDurableReplay` reproduces current state from the event log for every market
- [ ] **G3.2** `isDurableIdempotencyConflict` reports no conflicts across the generated set

### Gate 4 · Coverage

- [ ] **G4.1** `staging-coverage.json` exists and contains **one entry per §2 row** — M1…M15, P-owner…P-crowd×3, C1…C11, Q1…Q5, B1…B2, X1…X3
- [ ] **G4.2** every entry carries a URL, and every URL's underlying row is confirmed present by a targeted query
- [ ] **G4.3** every entry marked `unreachable` names its reason and matches the §3 / checklist list exactly — no silent omissions

### Gate 5 · Magnitudes ⚠

> **This gate exists because a passing test suite was structurally blind.** `tests/unit/profile/tile-identity.test.ts` had six tests, a dedicated `describe` for `displayNetProfitLoss`, and **every assertion sub-thousand** — it stayed GREEN with the comma-grouping wrapper deleted (PRIMITIVES-1 P10). Staging's fixtures repeat that failure one layer up: `max(stake)` today is **300**, and `four_digit_stakes` is **0**. Requiring *every* figure to be four-digit would forbid the small-magnitude cases §2 also needs, so the criterion is **at least one per surface class** — and it is written as a checkbox, not as prose, because prose is what got missed last time.

- [ ] **G5.1 · Header Balance** — ≥ 1 user whose current Dharma balance is **≥ 1000**. *Fixture:* **P-empty** sits at exactly `1000.000000000000000000` (granted, never bet)
- [ ] **G5.2 · Composer amounts** — ≥ 1 user whose spendable balance at composer-render time is **≥ 1000**. *Fixture:* **P-empty** and **P-visitor-target** both open their first betting day at **1010** (1000 grant + 10 allowance, verified at `place.ts:104–120`)
- [ ] **G5.3 · Positions table** — ≥ 1 `positions` row whose staked figure is **≥ 1000**. *Fixture:* **P-owner** places a single **1000 Đ** post-bet on **M7** (legal: balance 1010, `BET_MAX_STAKE = 10000`)
- [ ] **G5.4 · Discovery staked totals** — ≥ 1 market whose total staked is **≥ 1000**. *Fixture:* **M2** — twelve posts plus replies, two of them 1000 Đ carriers
- [ ] **G5.5 · Header Portfolio** — ≥ 1 user whose marked-to-market portfolio value is **≥ 1000**. *Fixture:* **P-owner**'s M7 YES position, bought at 1000 Đ into a fairly-priced pool
- [ ] **G5.6 · Profile §23 tiles** — ≥ 1 user whose **realised** net P/L is four-digit. *Fixture:* **M7** is opened with a deliberately generous `seedAmount` (`openMarket` has no ceiling) and settled **YES** via `triggerResolution` → `settleMarket`; **P-owner** holds the winning side and takes a four-digit pro-rata payout. `PROFILE_GRAPH_Y_MAX = 10000` accommodates it
- [ ] **G5.7** the assertion set is executed as SQL against the generated data, **not** against hand-built objects — a unit-level restatement would reproduce exactly the blindness this gate exists to catch

### Gate 6 · Zero-share

- [ ] **G6.1** `SELECT count(*) FROM bets WHERE share_quantity = 0` **= 0**  *(today: 37)*
- [ ] **G6.2** `SELECT count(*) FROM positions WHERE quantity < 0` **= 0** *(`I-NO-OVERSELL-001`)*
- [ ] **G6.3** the count in G6.1 is re-asserted **after** the P-exited full-sell sequence — a fully-exited position legitimately reaches `quantity = 0` in `positions` (Bucket C), and that must not be confused with a `bets.share_quantity = 0` row. SP-2's future `CHECK` constrains `bets`, not `positions`

### Reset-integrity criteria (every run)

- [ ] **R.1** the `bucket_%` catalog query returns exactly **78** rows, all `tgenabled = 'O'`
- [ ] **R.2** `drizzle.__drizzle_migrations` still holds **25** rows
- [ ] **R.3** `system_state` still holds its `id = 'system'` row, and **`frozen_at IS NULL`**
- [ ] **R.4** `identity_pool` holds **200** rows after re-seed
- [ ] **R.5** `/api/health` reports `migrations: "ok"` after the run

---

# FIXTURE COVERAGE CHECKLIST (§2)

## §2.1 Markets — 14 total, of which 9 Open (`DISCOVERY_GRID_SIZE = 8`, so grid + 1 = **9**)

| # | State | Slug | Produced by | Status |
|---|---|---|---|---|
| M1 | Draft | `sp-m1-draft` | `createMarket` only | ✅ reachable |
| M2 | Open, heavily active | `sp-m2-active` | create → open → §2.3 content | ✅ |
| M3 | Open, lightly active | `sp-m3-light` | create → open → below-floor content | ✅ |
| M4 | Open, brand new | `sp-m4-new` | create → open, **zero posts** | ✅ |
| M5 | Closed | `sp-m5-closed` | create → open → bets → `closeMarket` | ✅ |
| M6 | Resolving | `sp-m6-resolving` | … → close → `triggerResolution` | ✅ |
| M7 | Resolved (YES) | `sp-m7-resolved` | … → trigger → `settleMarket("YES")` | ✅ — also the G5.6 carrier |
| M8 | Voided | `sp-m8-voided` | create → open → bets → `voidMarket` (accepts `Open` or `Closed`) | ✅ |
| ~~M9~~ | ~~Frozen~~ | — | — | ❌ **UNREACHABLE — permanent.** No freeze write path exists in `src/`; `system_state.frozen_at` is a one-shot trigger-enforced transition (`0003:169–186`). Setting it bricks staging permanently. Manifest §1.8 / §3. Capture on a throwaway DB |
| M10–M15 | Open, filler (k = 6) | `sp-m10-fill` … `sp-m15-fill` | create → open → 1 thin post each | ✅ — brings Open total to **9** (M2+M3+M4+6) |

## §2.2 Participants — 10

| Role | Count | Status |
|---|---|---|
| P-owner | 1 | ✅ — ⚠ needs the capture-before-reset step (Q2) |
| P-visitor-target | 1 | ✅ |
| P-empty | 1 | ✅ — the G5.1 carrier |
| P-flipped | 1 | ✅ — buy YES → sell **all** YES → buy NO (partial sell throws `OppositeSideHeldError`) |
| P-exited | 1 | ✅ — buy → sell full → **stop** |
| P-removed | 1 | ✅ — one removed comment, one surviving |
| P-banned | 1 | ✅ — banned **after** content exists |
| P-crowd | 3 | ✅ |

## §2.3 Content on M2 — 12 posts (`latestInterleaveInterval = 10`, so `+2`)

| # | Shape | Status |
|---|---|---|
| C1 | posts on both sides, both slots populated | ✅ |
| C2 | **12** posts total — interleave fires ≥ twice | ✅ *(constant read from `ranking.config.ts:38`)* |
| C3 | one post dominating each of Most Debated (n) · Highest Stakes (Đ) · Contested (n^b) | ⚠ ✅ **calibration required** — floors `n ≥ 5 · D ≥ 200 · n^b ≥ 3`, `kLane = 3`, all flagged *"pre-tuning placeholder — pins 2026-09-01"*. Calibrate by running the surviving read-only half of `verify-ranking-staging.ts` against the generated market before accepting the shape |
| C4 | most posts dominating no lane | ✅ — 9 of 12 |
| C5 | a post with many replies on both sides | ✅ |
| C6 | a post with zero replies | ✅ |
| C7 | a post with an **attached image** | ⚠ **most expensive shape — see Open questions OQ-1.** Needs `signUploadAndInsert` → a real `PUT` to R2 → `verifyUploadedObject` → `place({ image })` |
| C8 | a post long enough to truncate | ✅ — placeholder text, length is a literal |
| C9 | a removed post with surviving replies | ✅ — replies authored **before** the removal |
| C10 | a removed reply under a present post | ✅ |
| C11 | enough price movement for a multi-point chart with post nodes | ✅ — falls out of C2's twelve sequential `place()` calls |

## §2.4 Positions and bookmarks

| # | Shape | Status |
|---|---|---|
| Q1 | open sellable position | ✅ |
| Q2 | position on a terminal market | ✅ — P-owner on M7 |
| Q3 | settled position post-resolution | ✅ — the G5.6 carrier |
| Q4 | viewer holding YES on M2 → NO composer `oppositeHeld`-disabled | ✅ — constrains P-owner's M2 side; not arbitrary |
| Q5 | zero positions | ✅ — P-empty |
| B1 | bookmarks on **others'** posts **and** replies | ✅ — `addBookmarkAction` rejects self-bookmarks (`self_bookmark_forbidden`), so the acting viewer must differ from the author |
| B2 | zero bookmarks | ✅ — P-empty |

## §2.5 Moderation

| # | Shape | Status |
|---|---|---|
| X1 | one `content_removed` on a post | ✅ |
| X2 | one on a reply | ✅ |
| X3 | one banned author with surviving content | ✅ |
| X4 | enough `mod_actions` to make the **audit feed paginate** | ❌ **NOT REACHABLE at fixture scale — see OQ-2.** `AUDIT_FEED_DEFAULT_LIMIT = 200` (`src/server/admin/moderation/audit-feed.ts:26`). Paginating needs **> 200** `mod_actions` rows, each requiring its own comment to remove — an order of magnitude more content than every other §2 shape combined. Needs a ruling, not a workaround |

## Unreachable, consolidated

**M9 (Frozen)** · **X4 (audit-feed pagination)** · **Empty Discovery** (mutually exclusive with 9 Open markets — capture on a preview DB) · **Turnstile states** (unwired, always-pass test keys) · **Live-window polling** (F-DEBATE-4 unverified) · **Cron-driven transitions** (driven by admin actions instead) · **Graph x-domain** (hard-pinned Sep 15 → Nov 5 2026, `graph-series.ts:31–34`, no override; remedy is GRAPH-WINDOW-OVERRIDE) · **Real ToS / Privacy bodies** (lorem-ipsum pending LEGAL.1).

---

# DELIVERABLES

1. `vitest.staging.config.ts` — opt-in runner config; `tests/staging/**` **excluded** from `vitest.config.ts`.
2. `tests/staging/reset.staging.test.ts` — the guarded reset (Q3).
3. `tests/staging/fixtures.ts` — the literal fixture table (no RNG).
4. `tests/staging/generate.staging.test.ts` — the engine-driven generator (Q1/Q2, DAG per S6).
5. `tests/staging/gates.staging.test.ts` — the six gates (Q5) + the reset-integrity criteria.
6. Four `package.json` scripts: `staging:reset` · `staging:generate` · `staging:gates` · `staging:rebuild`.
7. **`staging-coverage.json` — the coverage URL list, one URL per §2 row.** A named deliverable, emitted per run, then captured into `POLISH-register.md` as the standing reference so an inspector never hunts for "the market that has a removed post." Routes: `/` · `/m/<slug>` · `/u/<pseudonym>` · `/bookmarks` · `/m/<slug>/export`.
8. **`scripts/seed-debate-view-staging.ts` — DELETED.** 352 lines of raw `INSERT INTO` against `users`, `positions`, `markets`, `pools`, `image_uploads`, `comments`, `bets`, `mod_actions`. No engine, no events, no ledger. It is the source of the corruption.
9. **`scripts/verify-ranking-staging.ts` — write path removed, read-only value kept.** Inspected: its step 2 (`:107–140`) raw-INSERTs `markets`/`comments`/`bets` with `share_quantity = '0'` and `price_at_bet = '0.5'` — the direct producer of `debate8-ranking-demo-*` (23 comments) and of the `episodes.ts:168` throw. **Deleted.** Steps 1, 3 and 4 are genuine read-only verification — the schema check (`stake_at_post_time` dropped, `comments_ranking_idx` survives), the live re-run of the exact `ranking-substrate.ts` aggregate query, and feeding that substrate to the pure `src/lib/ranking.ts` to print the Top order and lane badges. **Kept**, re-pointed to take a market slug argument, and promoted to the C3 calibration instrument.
10. `docs/logs/STAGING-PARITY-<A|B|C|D>.md` — one per slice.

---

## Open questions

- **OQ-1 · C7's image attachment.**
  **Q:** How does a generated post get a real attached image, given the reset truncates `image_uploads` and `place({ image })` requires a committed upload with a real ETag and byte size?
  **Candidate:** drive the real path — `signUploadAndInsert` → a real HTTPS `PUT` to the presigned R2 URL with a small checked-in placeholder PNG → `verifyUploadedObject` (HeadObject) → `place({ image: { uploadId, r2ObjectKey, committedEventId, etag, byteSizeActual } })`. This stays inside constraint 1 (the engine writes every row) and is the only path that produces a truthful `image_upload.committed` payload. **Known risk:** `pnpm smoke:staging`'s `r2-scope` item currently FAILS pending triage (asymmetric — the other three deny 403), flagged at PR #173 and not a regression. If the presign or PUT is blocked by that, C7 becomes `data-blocked` and POLISH.3's image criteria defer.
  **Resolve with:** Slice D, empirically. If blocked, record C7 as `data-blocked` with the R2 triage as its dependency — do **not** hand-INSERT an `image_uploads` row to fake it.

- **OQ-2 · X4's audit-feed pagination.**
  **Q:** `AUDIT_FEED_DEFAULT_LIMIT = 200`. Producing > 200 `mod_actions` rows means > 200 comments generated solely to be removed — more content than the entire rest of §2. Is that in scope?
  **Candidate:** **No.** Instead, expose the limit as a parameter the *inspection* can lower (`loadAuditFeed` already accepts `options.limit`), and have POLISH.8 exercise pagination with `limit: 3` against the ~5 `mod_actions` rows X1–X3 produce. That tests the cursor and search paths without inflating the fixture set by an order of magnitude. **This is a ruling, not a finding** — the manifest wrote X4 without the constant in view.
  **Resolve with:** web ruling, before Slice C. If the ruling is "produce the rows", the estimate gains a full session.

- **OQ-3 · PR #295 ordering.**
  **Q:** The build target (`docs/polish/POLISH-0_data-manifest.md` v1.1) is not on `main` — PR #295 is open.
  **Candidate:** merge #295 before STAGING-PARITY execute begins. This plan PR is independent of it and can merge in either order.
  **Resolve with:** operator, before Slice A.

- **OQ-4 · Ranking constants pin on 2026-09-01.**
  **Q:** C3 and C4's shapes are calibrated against `kLane = 3` and floors `n ≥ 5 · D ≥ 200 · n^b ≥ 3`, every one labelled *"pre-tuning placeholder — NOT final; pins 2026-09-01"* (`src/lib/ranking.config.ts:30–38`). The number-tuning pass will move them.
  **Candidate:** accept the rework. Build C3/C4 against today's constants, and add a line to the tuning task's scope: *re-run `staging:gates` and re-calibrate M2/M3 after the pin*. The alternative — waiting for 2026-09-01 — blocks all eight POLISH surfaces for four weeks.
  **Resolve with:** this plan section; noted for the 2026-09-01 tuning task.

- **OQ-5 · Does `settleMarket` on M7 leave `positions` rows at `quantity > 0`?**
  **Q:** Gate 6 asserts zero `bets.share_quantity = 0`. Settlement pays out but does not obviously zero the position. If settled positions retain quantity, Q3's "settled position" shape and G6 are both satisfied; if settlement writes a zeroing row, the interaction with SP-2's future `CHECK` needs stating.
  **Candidate:** settlement writes `payout_events` and ledger rows and leaves `positions` intact (it is Bucket C and the read models derive settled state from `resolution_events`). Confirm by reading `settle.ts`'s write set at Slice B, before designing Q3's fixture.
  **Resolve with:** Slice B, by reading the code — not by assumption.

- **OQ-6 · Does `market.opened`'s `seedAmount` need a `pool_seed` ledger row for conservation?**
  **Q:** `dharma_entry_type` includes `pool_seed` / `pool_unwind`, documented as **dormant in v1 (R-2)**. A generously seeded M7 (needed for G5.6) injects Đ into a pool with no corresponding ledger debit.
  **Candidate:** correct as-is — `checkMarketConservation` measures pool **cash**, and the per-market injection identity is `seed − (Y + Σ YES positions)`; the seed is an injection, not a transfer. Gate 2 is the arbiter. If gate 2 fails on a large seed, lower it rather than adding a ledger row.
  **Resolve with:** Slice B, empirically via gate 2.

## ADRs needed

**ADR-0035** — *Guarded staging reset: owner-privilege trigger disablement in a committed operational artifact.*
**ADR-0036** — *Vitest-context runners for operational staging tasks.*

Decision surfaces for both are enumerated in **Q8**. **Neither is written by this plan** — ADRs are web-authored, and execute gates on ADR-0035 landing first. Numbers are proposed against the current ceiling (highest on disk **0034**; next free **0035**) and must be re-checked at authoring time; nothing here mints or reserves them.

---

## Self-critique (after Phase 1 self-review)

Adversarial pass, 2026-08-05. Findings retained after resolution.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **high** | **Which §2 shapes does the plan silently fail to produce?** First draft treated X4 as a normal checklist row. With `AUDIT_FEED_DEFAULT_LIMIT = 200` in view it is off by ~40× — a plan that listed it without the number would have had a session discover it mid-build | Named ❌ in the checklist with the constant cited, and raised as **OQ-2** with a ruling request. Not silently dropped, not silently worked around |
| 2 | **high** | **`system_state` was in my truncate set.** It appears in `TRUNCATE_GUARDS`, so the guard list — the obvious source of truth — actively *invites* truncating it. Its singleton row is seeded by migration `0004`, which drizzle will never re-run, and `isFrozen()` reads `row?.frozenAt != null`, so a missing row **fails open silently**. A run would have removed the freeze sentinel and nothing would have reported it | Excluded in **Q3**, with the reasoning stated at length precisely because the exclusion is counter-intuitive. Added as reset-integrity criterion **R.3** so every run re-asserts the row and its NULL `frozen_at` |
| 3 | **high** | **"Could a reader reasonably conclude they should freeze staging?"** The first draft mentioned the prohibition once, inside a §8 bullet. A reader skimming for "what produces M9" could reach the fixture checklist without ever seeing it | Three reinforcements: a **standing prohibition block** at the head of the plan in blockquote; M9's checklist row states *"UNREACHABLE — permanent"* with the mechanism inline; §8 keeps its bullet. The M9 row explains **why** rather than only forbidding, because a bare prohibition invites a workaround |
| 4 | **high** | **"Does anything write an event outside the engine?"** The bookmarks path tempted one — `bookmarks` is Bucket C with no event emission, so a direct `db.insert` looks harmless and is two lines shorter | Rejected. `addBookmarkAction` is called with the session mocked. More importantly the rule is made **enforceable rather than aspirational**: a unit assertion (§7) greps the generator source for `INSERT INTO` / `.insert(` against the eleven engine-owned tables. "No second implementation" is otherwise a promise nobody can check |
| 5 | **high** | **"Which acceptance criterion could pass while the thing it checks is broken?"** Gate 5 as originally drafted. If its assertions were written as unit tests over hand-built objects, it would reproduce *exactly* the PRIMITIVES-1 P10 blindness it exists to prevent — six green tests that cannot detect the thing they name | **G5.7** added as an explicit criterion: the assertions run as SQL against generated data. Each of G5.1–G5.6 also names its **carrier fixture**, so a criterion cannot pass by accident on some other row |
| 6 | **medium** | **Gate 2 could pass vacuously.** `checkMarketConservation` on a market with no bets conserves trivially. With 14 markets and 6 thin fillers, a bug affecting only busy markets could hide | **G2.1** iterates every market rather than sampling, and **G2.3**/**G2.4** add ledger-level assertions that do not depend on market activity. Also noted that the identity must not be re-derived in the test — CPMM conservation is measured against pool **cash**, and re-deriving it is how the ENGINE.10 RED test went wrong |
| 7 | **medium** | **"What happens if the reset dies mid-run, in the worst moment?"** The worst moment is between `DISABLE` and `ENABLE`. Manifest §1.9 prescribes a `finally`, which does **not** run on `SIGKILL`, OOM, or a dropped socket — the exact failures that matter | Reading `truncate.ts` established that the batch is **one implicit transaction**, so the disable is rolled back by the server on any abort. The plan adopts that as the primary mechanism and demotes the `finally` to a belt, saying so plainly. **R.1** verifies the catalog every run, so if a future edit splits the batch the regression is caught rather than assumed away. This is recorded as a correction to §1.9 for **ADR-0035** to ratify |
| 8 | **medium** | **The reset destroys P-owner's OAuth linkage.** Nothing in the manifest flags it, and the failure surfaces *later*, as a hard sign-in failure on the operator's own account — collision on `users_email_idx` when Better Auth tries to create a second user for the same email | **Q2** adds an explicit **capture-before-reset** step for the operator's `users.email` + `accounts.account_id`. Called out because it is destroyed by the very first reset and cannot be recovered afterward |
| 9 | **medium** | **The estimate was anchored.** A prior note said 2–3 sessions and my first pass drifted toward it | Re-costed bottom-up from the slice table: **4**, with a reserve. The two drivers are broken out and one of them moves in the *opposite* direction from the manifest's assumption — participant creation is cheap (committed precedent for both halves), and the reset script is expensive for ritual rather than for code |
| 10 | **low** | **A third corruption class exists that the manifest does not name.** `debate4-resolved-f2ae918a` is `status = 'Resolved'` with zero `resolution_events` and zero `payout_events` — the status was hand-set. The manifest's gates 1 and 6 would both pass on such a market while it remains a lie | **G1.5** added — every `Resolved`/`Voided` market must carry ≥ 1 `resolution_events` row. Recorded in S8 as a manifest gap worth folding back at v1.2 |
| 11 | **low** | **`tests/staging/**` could be picked up by a bare `vitest run`** and point CI at a live database | Excluded from `vitest.config.ts`'s `include`, mirroring the `tests/scale/**` precedent, and stated as a requirement in both §7 and **ADR-0036**'s decision surface |
| 12 | **low** | **Gate 6 vs. P-exited is a genuine ambiguity.** A fully-exited position legitimately reaches `quantity = 0` in `positions`; gate 6 is about `bets.share_quantity` | **G6.3** disambiguates explicitly, and notes that SP-2's future `CHECK` constrains `bets`, not `positions` — so the shapes do not collide |
| 13 | **low** | **C3's calibration is against constants that expire.** Every ranking floor is labelled *"pins 2026-09-01"* | Accepted as known rework and raised as **OQ-4** with the trade-off stated: waiting blocks all eight POLISH surfaces for four weeks; rebuilding M2/M3 after the pin costs part of a session |

---

## References

- `docs/polish/POLISH-0_data-manifest.md` v1.1 — **the build target** (arriving via PR #295)
- `docs/polish/POLISH-register-ADDITIONS.md` §B — SP-1 / SP-2 / SP-3
- `docs/runbooks/deploy-pipeline.md` §0, §1, §2 — staging topology, `/api/health`, the advance step
- `CLAUDE.md` §2 (invariants), §3 (refusal triggers), §5 (workflow gates)
- `AGENTS.md` §6 (buckets, migrations), §9 (test layout), §11 (boundaries)
- ADR-0011 (identity pool) · ADR-0013 (bet tx) · ADR-0014 (moderation outside tx) · ADR-0018 (issuance + floors) · ADR-0021 (reactive moderation) · ADR-0024 (deploy pipeline) · ADR-0030 (TRUNCATE rejection) · ADR-0031 (durable receipts)
- `tests/db/_fixtures/truncate.ts` — the reset precedent
- `tests/integration/signup-create-path.integration.test.ts` — the participant-creation precedent
- `tests/server/auth/tos-accept-grant.test.ts` — the shell-mocking precedent

---

> ## ⛔ STANDING PROHIBITION — read before executing
>
> **NEVER write `system_state.frozen_at` on staging.** Not a query, not a script, not a test, not "just to see M9 render". It is a one-shot `NULL → timestamp` transition enforced by `enforce_system_state_frozen_at` (`0003:169–186`). **It cannot be unset.** Setting it makes staging read-only **permanently**, with no undo short of a schema rebuild — 41 days before go-live. There is deliberately no write path in `src/`; **do not add one**, and do not treat M9's absence from the fixture set as a gap to close. M9 is `data-blocked` by ruling (manifest §1.8 / §3), and the capture is taken on a throwaway database instead.
>
> **NEVER run `scripts/seed-debate-view-staging.ts`.** It is the source of the corruption this task exists to remove, and it is deleted by this task.

*Plan authored 2026-08-05 against `origin/main` @ `731be431`. Template: `docs/plans/_template.md`.*
