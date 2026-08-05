# ADR-0036 — Vitest-Context Runners for Operational Staging Tasks

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-08-05 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | STAGING-PARITY Slice A (`vitest.staging.config.ts`). Gates Slices B–D. |
| **Frame document** | `docs/plans/STAGING-PARITY.md` Q1, S1, S3 + Ratification Record §7 (deviation record); `docs/polish/POLISH-0_data-manifest.md` §0 A4, §1.1, §1.3; AGENTS.md (test layout); ADR-0014 (moderation outside the transaction); ADR-0011 (identity pool); SPEC.2 ADR Index |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

STAGING-PARITY's governing constraint is that every row must be produced by driving the real engine — `createMarket`, `openMarket`, `place`, `sell`, `closeMarket`, `triggerResolution`, `settleMarket`, `voidMarket`, `moderateComment`, `grantInitialDharma`. A second event-writing implementation would create a divergent source of truth and dissolve the property that makes ledger verification conclusive. So the generator must *call* those functions, not reimplement what they do.

That turns out to be a non-trivial requirement, because the modules are unreachable from an ordinary script. A recon had concluded a plain `tsx` script was blocked by the `server-only` marker on the database module. A spike tested the conclusion rather than accepting it, and found the conclusion right for the wrong reason — there are **three independent blockers**, not one:

1. **`server-only`.** Its exports map resolves only under the `react-server` condition; outside it, the module is a bare `throw`. All five probed modules fail identically.
2. **`canonicalize@3.0.0`.** ESM-only — `"type": "module"` with an `import` key and no `require` key. `tsx` transpiles repo TypeScript to CommonJS because `package.json` declares no `"type"`, so resolution finds nothing exported. Its single importer sits in the idempotency layer, which is pulled into every bet, lifecycle and resolution path.
3. **`@fastify/otel`.** Forcing the `import` condition globally to clear blocker 2 immediately surfaces a `package.json` that is not valid JSON — a bundler artifact reached through the Sentry → OpenTelemetry chain.

So blocker 2's only non-invasive workaround is killed by blocker 3, and clearing blocker 2 properly would require either declaring `"type": "module"` repo-wide or shimming `canonicalize` through tsconfig paths — engine-wide changes made to let a fixture script run.

A Vitest context clears all three at once, using machinery that already exists and is used by twenty integration suites today: the `server-only` alias, `vite-tsconfig-paths`, and the shared env setup. All sixteen probed modules import cleanly in under a second, including auth, the ToS action, every lifecycle wire, `place`, `sell`, `moderateComment` and the database module itself.

But that raises the actual question. **A test runner is for tests.** Using it to execute non-test operational work — wiping a live database, generating fixture data, running verification gates — conflates the test harness with an operations tool. It is also a pattern other work will copy, which is precisely the ADR-worthiness criterion. And a test runner pointed at a live database is dangerous by default: a bare `vitest run` in CI must never be able to reach staging.

This ADR does **not** decide:

- The reset's mechanism, guard contract, or exclusion set — ADR-0035.
- Whether a route handler is appropriate for any *product* purpose. This ADR forecloses it only for this one.
- What the fixture set contains — `docs/polish/POLISH-0_data-manifest.md` §2.
- Whether the generated data is correct — the six gates in `docs/plans/STAGING-PARITY.md`.
- Anything about production. No operational runner touches production, now or later.

## Decision Drivers

1. **No second event-writing implementation.** Whatever vehicle is chosen must call the real functions, unmodified. This is the constraint the whole task exists to honour.
2. **Plain `tsx` is unreachable without engine-wide changes** — three independent blockers, the resolution of one defeated by another.
3. **A route handler ships a permanent data-mutation surface into the product** for a ninety-day asset, and needs a deploy cycle per iteration of something that will be iterated dozens of times.
4. **This is a pattern other code will copy.** Left undecided, the next operational task picks a vehicle by convenience.
5. **Isolation must be structural, not procedural.** "Remember not to run these in CI" is not a control.
6. **The mocking boundary is the load-bearing detail.** A vehicle that permits mocking the wrong layer would let a "generator" quietly become a second writer while appearing to drive the engine.

## Considered Options

1. **Vitest-context runners under `tests/staging/`, executed by a dedicated opt-in config** ← chosen
2. Non-prod-gated route handler inside the Next app
3. Plain `tsx` script, unblocked by engine-wide module changes
4. Drive the deployed application over HTTP
5. A separate minimal Next application used purely as a script host

## Decision Outcome

**Chosen: Option 1 — Vitest-context runners under `tests/staging/`, executed by `vitest.staging.config.ts`.**

Six primitives are ratified together.

**1 · A Vitest context is an acceptable execution vehicle for operational staging tasks.** The runner is not a test — it is an operational artifact that borrows the test harness for module resolution. It is named, located and configured so that distinction is visible: files live under `tests/staging/`, carry the `*.staging.test.ts` suffix, and run only through `vitest.staging.config.ts`.

**2 · Isolation is structural.** `tests/staging/**` is **excluded from `vitest.config.ts`'s include patterns**, mirroring the existing `tests/scale/**` precedent. A bare `vitest run` — local, CI, or a subagent's — must never be able to reach a live database. This is not a convention; it is a config exclusion, and it is asserted by a unit test.

**3 · The mocking boundary is fixed, and it is the whole argument.**

| | |
|---|---|
| **MAY be mocked** | `next/headers` · `next/navigation` · `next/cache` · `requireAdminSession` · `auth.api.getSession` · `verifyOnboardingRef` |
| **MUST NEVER be mocked** | Anything that writes a row or moves Dharma |

The permitted list is exactly the HTTP-and-cookie shell: request context, redirect, cache revalidation, and the session gates that read cookies. Everything downstream of those gates runs unmodified. The precedent already exists in-tree — a committed test drives the real ToS-acceptance action against real Postgres by mocking only the onboarding-ref module and `next/headers`, so the transaction body runs untouched.

The rule's purpose: mocking the shell skips *delivery*, and delivery is not the engine. Mocking anything that writes would make the runner a second implementation, which is the one thing forbidden.

**4 · The runner writes no rows directly, and this is enforced rather than promised.** No `INSERT INTO` and no `.insert(` against `bets`, `comments`, `events`, `dharma_ledger`, `positions`, `pools`, `resolution_events`, `payout_events`, `mod_actions`, `bet_receipts` or `bookmarks`. A source-level assertion checks this.

This assertion is load-bearing and must not be simplified away in review. Gate 1 asserts that every `bets` row has a matching event — but if the runner could write both halves, gate 1 would pass *because the runner wrote them*. **A verification satisfiable by the thing it verifies is not a verification.** The source assertion is what keeps gate 1 non-vacuous, the same shape as the two-derivation conservation check established at ENGINE.10.

The `bookmarks` inclusion is deliberate. It is Bucket C, emits no event, and a direct insert would be two lines shorter and look harmless — which is exactly why the rule is enforced by assertion rather than by intention.

**5 · Manifest §0 A4 / §1.3's route-handler leaning is retired as empirically disproven.** The manifest said the generator would *likely* need a Next request context. The spike showed otherwise. **No route handler is added, and none should be.** The manifest is amended at v1.2 with the three blockers recorded, so a later reader sees why the option was closed rather than re-opening it.

**6 · Scope and lifetime.** Staging only. Never production. Dies with the experiment on 2026-11-05. Operational runners are not a general pattern for the codebase — they are permitted for staging data operations, and any other use is a new decision.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Operational runner execution config | `vitest.staging.config.ts` |
| Operational runners | `tests/staging/*.staging.test.ts` |
| The isolation exclusion | `vitest.config.ts` — `tests/staging/**` excluded from `include` |
| The shell-mocking precedent | the committed ToS-acceptance test, unchanged |

## Consequences

### Positive

- The generator calls the real engine functions with zero engine code written — the task's governing constraint is satisfied by construction.
- No permanent data-mutation surface enters the product.
- Iteration is a local run, not a deploy cycle, which matters for something that will be iterated dozens of times.
- All three enabling pieces already exist and are exercised daily by twenty suites; nothing new is introduced.
- Gates 2 and 3 need no wrapper at all — the wrapper requirement was a consequence of the plain-`tsx` premise, and it disappears with it.
- The mocking boundary, written as a rule, means the next operational task inherits a decision rather than a precedent it has to interpret.

### Negative

- The test harness now hosts non-test work, which blurs a category. *Mitigated by:* the directory, the suffix, the dedicated config, and this ADR making the distinction explicit rather than implicit.
- A runner pointed at a live database sits in the same tree as tests that must never reach one. *Mitigated by:* structural exclusion from the default config, asserted by a unit test, plus ADR-0035's four guards on the destructive runner specifically.
- Vitest's lifecycle — `describe`, `it`, assertion output — is a slightly odd shape for operational work. *Acceptable because:* the alternative costs engine-wide module changes or a permanent product endpoint, and the harness is genuinely doing the one thing needed, which is module resolution.
- The pattern will be copied. *Mitigated by:* primitive 6 scoping it to staging data operations; any other use is a new decision.

### Neutral

- `canonicalize@3.0.0`'s ESM-only shape remains a latent trap for any future tooling that is not Vitest. Recorded, not fixed.
- The moderation pre-commit call is skipped as a shell layer, which is a consequence of ADR-0014's own construction placing it outside the transaction — not a weakening of the moderation pipeline. Fixture text is placeholder by manifest §1.4, and the pipeline itself is untouched.

## Pros and Cons of the Options

### Option 1 — Vitest-context runners (chosen)

**Pros** — reaches every needed module, proven empirically; all enabling machinery already exists; fast local iteration; no product surface added; the mocking boundary can be stated as a rule and enforced.

**Cons** — conflates test harness with operations tool; a live-database runner lives among tests.

### Option 2 — Non-prod-gated route handler

**Pros** — Next applies the `react-server` condition natively, so all three blockers vanish; no harness conflation.

**Cons** — ships a permanent data-mutation endpoint into the product for a ninety-day asset; needs its own auth gate, which is a new attack surface; a deploy cycle per iteration; and the "non-prod-gated" property is a runtime check rather than a structural one.

**Verdict:** Rejected. The manifest leaned this way on the assumption that only a Next context could reach the engine; the spike disproved the assumption, and the cost was never justified once the alternative existed.

### Option 3 — Plain `tsx` plus engine-wide module changes

**Pros** — the most ordinary-looking artifact; a script that is a script.

**Cons** — requires either declaring `"type": "module"` repo-wide, which changes how every existing script is transpiled, or shimming `canonicalize` in tsconfig paths, which leaks into the production build. Both are engine-wide changes made to accommodate a fixture generator, and blocker 3 means neither is even sufficient on its own.

**Verdict:** Rejected. Changing the engine's module resolution to suit a ninety-day tool inverts the priority.

### Option 4 — Drive the deployed application over HTTP

**Pros** — maximally faithful; exercises the real delivery path end to end.

**Cons** — the admin lifecycle wires are Server Actions, not HTTP routes, so they are unreachable this way; needs real sessions per user, Turnstile, and cookie jars; re-introduces a paid moderation API call per comment along with its latency and nondeterminism; by far the highest cost.

**Verdict:** Rejected. The fidelity gained is delivery-layer fidelity, which is not what the fixture set is for.

### Option 5 — A separate minimal Next application as script host

**Pros** — gets the `react-server` condition without touching the product app.

**Cons** — a whole second application to build, configure and maintain for a ninety-day asset; strictly more machinery than Option 1 for the same reach.

**Verdict:** Rejected. Manifest §1's bounding rule — build the minimum and stop — closes this immediately.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| Manifest §1.1 | Engine-driven generation only | **consumes** — the vehicle exists to satisfy it; primitive 4's source assertion is the enforcement |
| Manifest §0 A4, §1.3 | "Likely a Next request context" | **shapes** — retired as empirically disproven; amended at v1.2 with the three blockers recorded |
| SPEC.1 INV-1 | Bet ↔ comment atomicity | **consumes** — exercised through `place()` inside the real bet transaction, never bypassed |
| SPEC.1 INV-3 | Side frozen at post time | **consumes** — the flip sequence exercises it; no runner code touches `side_at_post_time` |
| ADR-0014 | Moderation runs outside the transaction | **shapes** — the pre-commit call is a shell layer by 0014's own construction, so skipping the endpoint skips it. The moderation pipeline is not weakened, bypassed, or made optional for any product path |
| ADR-0011 | Identity pool | **consumes** — the real create-path hook fires and consumes a real tuple; no pseudonym is hand-written |
| ADR-0035 | Guarded staging reset | **shapes** — the reset is itself a runner under this ADR's rules; its four guards are additional, not alternative |
| Tracker | STAGING-PARITY Slices A–D | All depend on this ADR being `accepted` |

## More Information

- `docs/plans/STAGING-PARITY.md` — S1 (the spike, with verbatim errors for all three blockers), S3 (options matrix), Q1 (per-surface shell-skip table), Ratification Record §7.
- The committed signup create-path and ToS-acceptance tests — the two precedents that make participant creation cheap.
- `tests/scale/` and `vitest.scale.config.ts` — the opt-in-config precedent this mirrors.

---

*ADR-0036 ratifies the Vitest context as the execution vehicle for operational staging tasks, fixes the shell-mocking boundary as a stated rule, and makes isolation from default test runs structural. The decision body and the constraints minted in primitives 1–6 are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
