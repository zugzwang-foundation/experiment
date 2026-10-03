# ADR-0064 — Staging Seed-Activity Tool

| | |
|---|---|
| **Status** | proposed |
| **Date** | 2026-10-01 |
| **Deciders** | Hrishikesh (operator) |
| **Tracker task** | SEED-STAGING-1 (`docs/plans/SEED-STAGING-1.md`) |
| **Frame document** | ADR-0035 / ADR-0036 (staging operational tooling), CLAUDE.md §3 (admin participation) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | — |
| **Amended-by** | — |

---

## Context and Problem Statement

The operator needs to load a client-supplied sheet of arguments — about a hundred per market across six markets — into **staging**, each posted by a distinct test participant, for demos and review. The repository already has an engine-driven fixture generator (`tests/staging/generate.staging.test.ts`, ADR-0036), but it reads a literal fixture table, runs from a developer machine under the Vitest harness, and cannot take an arbitrary sheet.

Two existing rules shape the answer. CLAUDE.md §3 forbids the **admin** from participating — the admin has no `users` row. And every write that moves Dharma or creates a participant must go through the shipped engine, never direct SQL, because the event log, the ledger and the append-only buckets are only coherent when the engine produced them.

The question is where a sheet-driven, participant-creating write path may live, and how production is kept structurally out of reach of it.

## Decision Drivers

- **Production must be unable to run it**, by more than one independent check.
- **No direct writes.** Participants come from Better Auth's create path (pool-assigned pseudonym, ADR-0011) and the F-AUTH-4 grant; arguments come from `runBetTransaction(place)`.
- **The admin still never participates.** The admin *triggers* the tool; the bets belong to synthetic participants with their own `users` rows.
- **Re-running a sheet must not duplicate anything**, without a new job table.
- **No new public attack surface** — in particular, no new browser-callable path that grants Dharma.

## Considered Options

1. **Admin page + two admin Route Handlers, staging-gated, driving the shipped engine** (chosen).
2. Extend the Vitest-harness generator to read a sheet, run by a developer.
3. A seeding job run as a one-off ECS task, triggered by the pipeline.
4. Direct SQL inserts from the uploaded rows.

## Decision Outcome

**Option 1.** An admin page at `/admin/seed` (staging only) uploads a CSV/XLSX to `POST /admin/seed/preview` (parse + validate, no writes) and then drives `POST /admin/seed/run` in chunks of 25 rows. Each row: get-or-create a synthetic participant, then one `runBetTransaction(place)`.

**Gates:**

1. `isSeedToolsEnabled()` — true only when `ZUGZWANG_ENV === "staging"` **and** `ZUGZWANG_SEED_TOOLS === "enabled"`, both read from the running process by **computed key**. The page `notFound()`s and both handlers answer 404 before any other check.
   - ⚠ **Why computed key.** `next.config.ts` lists `ZUGZWANG_ENV` under `env:`, and Next substitutes every literal `process.env.ZUGZWANG_ENV` with the build's value, in server bundles too. The first version of this gate did exactly that, and its shipped form read a constant (`@code-reviewer` C-1). The page, the handlers and `runSeedChunk` were then one build-time fact rather than independent checks.
   - ⚠ **Why a second variable.** `ZUGZWANG_ENV` describes the image as well as the task. `ZUGZWANG_SEED_TOOLS` is in no build configuration and is set only on the staging ECS task definition (`infra/config/staging.ts` `seedTools`), so permission lives in deployment config, never in an image. A staging image run under production's task definition refuses.
2. `runSeedChunk` re-asserts the gate itself, then checks the conclusion freeze (`isFrozen`, as the bet route does), then takes a deployment-wide Upstash lock per chunk (fail closed), so a caller that skips the handler guard still cannot write, and two runs never mint the same participant twice.
3. Origin allowlist + admin session on both handlers (the cookie is `Path=/admin`, hence `/admin/…` URLs, not `/api/…`).
4. Synthetic participants use `seed-…@seed.staging.invalid` addresses (RFC 2606 reserved) and the generator's synthetic ToS evidence literals; every caused event carries `metadata.request_id = "seed-staging:<batch>"`.

**Idempotency without a table.** `batchId` is a hash of the validated rows. A row's idempotency key is derived from it, so a repeat hits `bet_receipts_idempotency_key_uq` (I-IDEM-ONCE-001) and is reported as skipped; the receipt's stored `commentId` resolves replies across chunks and across runs.

**The ToS refactor.** `acceptTosAction`'s evidence transaction moves verbatim into `recordTosAcceptance` in `src/server/auth/tos-record.ts`. It is `server-only` and deliberately **not** `"use server"`: every export of a `"use server"` module is a public Server Action, and this function grants the initial Dharma to whatever `userId` it is given. `tests/unit/auth/tos-accept-exports.test.ts` pins both halves.

**A known weakness, stated.** `guardSeedRequest` returns `Response | null`, with `null` meaning proceed, so it fails **open**: a handler that forgets to call it, or drops the `return`, serves every caller and nothing errors. It is held today by two things, not by the type system: `runSeedChunk` re-asserts the environment before any read or write, and `tests/unit/seed/route-guard.test.ts` scans each handler for "guard first, and returned". **A third seeding handler must be added to that scan's list.** A guard that throws, or a union the handler must narrow, would turn the omission into a compile error; it was not done here because both handlers are two lines from the guard and the write path has its own check.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Environment gate | `src/server/seed/gate.ts` |
| Sheet rules | `src/server/seed/validate.ts` |
| Batch identity, keys, participant emails | `src/server/seed/plan.ts` |
| Participant creation | `src/server/seed/participants.ts` |
| Row execution | `src/server/seed/run.ts` |
| Handler front door | `src/server/seed/route-guard.ts` |
| ToS evidence transaction | `src/server/auth/tos-record.ts` |

## Consequences

### Positive

- One upload seeds all six markets through the same code real users exercise, so prices, Dharma, replies and the event log are coherent by construction.
- Re-uploading resumes rather than duplicates.
- The ToS evidence transaction now has a single, non-public home that two callers share.

### Negative

- Staging accumulates synthetic activity that only a full staging reset clears, and staging stops mirroring production volumes while it is there.
- A new dependency, `exceljs@4.4.0`, for XLSX and robust CSV.
- **Moderation is not run on seeded arguments.** ⚠ The first draft justified this as "operator-supplied". That was wrong: the sheet is **client-supplied**, third-party text, so the ADR-0027 "operator-curated trusted content" precedent does not apply by itself (`@security-auditor`, MEDIUM). The decision stands on a different basis, stated plainly: **the operator who uploads a sheet takes review responsibility for its content**, exactly as for any content the operator places on staging by hand, and staging is the only place it can land. v1 carries no images, so ADR-0046's load-bearing half (an image is never served unscreened) is not engaged. Turning moderation on is a per-row `precommitModerate` call outside the transaction (ADR-0014), at OpenAI cost per row.
- **Residuals, stated rather than fixed.** (a) A request with `Transfer-Encoding: chunked` carries no `Content-Length`, so `/admin/seed/preview`'s length pre-check cannot see it and `request.formData()` buffers it; `/admin/seed/run`'s schema admits up to roughly 50 MB of JSON. Admin-gated and staging-only: the worst case is the operator exhausting their own task's memory. (b) No admin-side audit event records that a batch ran: no `admin_events` writer exists anywhere yet, and the participant-side tell is `metadata.request_id = "seed-staging:<batch>"`.

### Neutral

- The fixture generator (ADR-0036) is unchanged and remains the deterministic coverage tool; this tool is for ad-hoc content.

## Pros and Cons of the Options

### Option 1 — admin page + gated handlers (chosen)

- Good: runs in the app runtime, so the engine and its cache behaviour are exactly production's.
- Good: no new credentials; the admin session is the authority.
- Bad: one more admin surface to keep gated; mitigated by four independent checks and a test.

### Option 2 — extend the Vitest-harness generator

- Good: no runtime surface at all.
- Bad: needs a developer machine and Doppler `stg` for every upload — the client cannot use it.

### Option 3 — pipeline-triggered ECS task

- Bad: runs outside the Next runtime, needs the same harness workarounds as ADR-0036, and puts sheet content through GitHub.

### Option 4 — direct SQL

- Bad: skips the events, the receipts and every in-transaction guard; a market seeded this way stops being something the engine can reason about. Rejected outright.
