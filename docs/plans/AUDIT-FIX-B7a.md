# AUDIT-FIX-B7a — transport bounding (A14) + whitespace comment semantics (A24)

> **Provenance.** Ratified plan, committed at execute start (house pattern). No standalone
> plan file was relayed — this record is CC-reconstructed verbatim from the operator kickoff
> (2026-07-06, itself the ratified-plan relay) plus the web-authored riders package
> (`AUDIT-FIX-B7a_riders_web-authored.md`, embedded in §5 below as the execution contract).
> Operator has ratified: **OD-1** `REDIS_MAX_RETRIES = 1` · **OD-2**
> `REDIS_COMMAND_TIMEOUT_MS = 2000` · **OD-3/OD-4** the riders as web-authored.
> B7 split per the B7-A26 close-out: **B7a = A14 + A24** (A27 DROPPED — closed by ADR-0031
> row 13); B7b (A29/A31/A32/A33/A35) is NOT this task.

## 1. Frame

Two AUDIT.1 findings, both bet-path critical (full §5.6/§5.7/§5.10/§5.11 ritual):

- **A14 — unbounded Upstash transport.** The vendored `@upstash/redis` default
  (`retries ?? 5` → 6 fetch attempts, exponential backoff ≈4.3s of sleep, **no timeout of
  any kind** — a hung socket rides undici defaults up to the platform function timeout)
  silently contradicts ADR-0015's no-auto-retry posture on every call from the shared
  singleton (idempotency, rate-limit, moderation reserve/release).
- **A24 — whitespace-only comment bodies.** `route.ts` step-5 rejects only
  `body.length === 0`; a whitespace-only body (`" "`, `"\t\n"`, NBSP/em-space) passes the
  gate, is moderated, and mints a bet+comment whose argument is visually absent —
  violating the mandatory-commentary intent (F-COMMENT-5). Ruling (SPEC.1 rider, §5.1):
  **lower** bound on the whitespace-trimmed text; **upper** bound on the submitted (raw)
  text; **stored** value is the raw text, byte-identical to the text moderated.

## 2. Implementation

### 2.1 A24 — `src/app/api/bets/place/route.ts` (step 5)

- Line 63: `if (body.length === 0)` → `if (body.trim().length === 0)` → throw
  `CommentRequiresBetError` (`comment_requires_bet`), unchanged error class/code.
- Comment updated at the site: whitespace-only is an absent argument (A24 ruling); trim is
  JS `String.prototype.trim()` (Unicode WhiteSpace + LineTerminator); the trim result is
  used ONLY for the emptiness gate — moderation and the W-1 tx receive the raw `body`
  byte-identical (stored ≡ moderated). Upper bound (`comment_too_long`) stays on raw.

### 2.2 A14 — `src/server/upstash/redis.ts` (shared singleton)

Override exactly:

```ts
export const redis = Redis.fromEnv({
	automaticDeserialization: false,
	retry: {
		retries: REDIS_MAX_RETRIES,
		backoff: () => REDIS_RETRY_BACKOFF_MS,
	},
	signal: () => AbortSignal.timeout(REDIS_COMMAND_TIMEOUT_MS),
});
```

Code comment carries both vendor subtleties (verified against the installed 1.38.0
source, `chunk-2X4SLXT7.mjs` request loop):

1. **Function-form `signal` is mandatory** — with a static `AbortSignal` the vendor
   fabricates a 200 response with body `{result: "Aborted"}` on abort (garbage into SETNX
   results); the function form rethrows the abort as a throw into the existing catch arms.
2. The signal is minted once per command execution (`signal()` at requestOptions build)
   and **covers the vendor's whole internal retry loop** — a hard 2.0s per-command ceiling
   regardless of retry count.

### 2.3 Constants — `src/server/config/limits.ts`

Three HARDEN-tunable constants beside the `OPENAI_*` precedent (same JSDoc-cites-source
style; new `=== AUDIT-FIX-B7a ===` section):

- `REDIS_MAX_RETRIES = 1` (OD-1) — single flat transport-level retry.
- `REDIS_RETRY_BACKOFF_MS = 200` — flat, not exponential.
- `REDIS_COMMAND_TIMEOUT_MS = 2000` (OD-2) — per-command abort ceiling.

## 3. Test plan (@test-writer FIRST — RED)

**A24 — extend `tests/server/bets/validation.test.ts`** (DB-backed harness, externals
mocked; assertions on the real :54322 Postgres):

1. Whitespace-only ASCII (`"   "`) → 400 `comment_requires_bet` + **zero rows** in
   `bets` / `comments` / `dharma_ledger` (the W-1 tx never opens).
2. Mixed whitespace (`" \t\n "`) → same.
3. Unicode NBSP/em-space (`"  "`) → same (trim covers Unicode WhiteSpace).
4. `" a "` → **200**, comment stored **raw** (`" a "` byte-identical) and moderation
   called with the raw text (stored ≡ moderated).
5. MAX boundary on **raw** (raw length exactly `COMMENT_MAX_LENGTH`, whitespace-padded) →
   200.
6. Padded-past-MAX (trimmed length < MAX but raw length > MAX) → 400 `comment_too_long`
   (upper bound evaluated on raw — the discriminating case).

**A14 — new unit test (config assertions, `@upstash/redis` module mocked to capture the
`fromEnv` config):**

- `automaticDeserialization === false` pin (regression — load-bearing for the cache state
  machine).
- `retry.retries === REDIS_MAX_RETRIES` (=1); `backoff` is flat — same 200ms at any retry
  count.
- `signal` is the **FUNCTION form** (`typeof === "function"`, not an `AbortSignal`
  instance) — the fabricated-200 hazard pin.
- `signal()` returns distinct `AbortSignal` instances per invocation.
- The signal factory calls `AbortSignal.timeout` with `REDIS_COMMAND_TIMEOUT_MS` (=2000).

Expected RED set: cases 1–3 (whitespace passes today) + the retry/signal config
assertions. Cases 4–6 and the deserialization pin are regression pins expected green.

## 4. Reviewer directives (@code-reviewer, directed per-point — B5 lesson)

Sequential, per-point "verify AND STATE":

1. **Trim blast radius:** confirm moderation and the W-1 tx see byte-identical raw input
   (`stored === moderated`); the trimmed value is used only for the emptiness gate;
   `comment_too_long` stays on raw.
2. **Redis override:** confirm rate-limit fail-open / idempotency fail-closed /
   moderation-reserve fail-closed arms are UNCHANGED; a timeout/abort surfaces as a
   thrown error into those arms — never fabricated success.

## 5. Riders (web-authored, SAME COMMIT as code, content-anchored)

Source: `AUDIT-FIX-B7a_riders_web-authored.md` (2026-07-06). STOP on any anchor mismatch.
Do NOT touch SPEC.1/SPEC.2 §0 or §22 — the parked SYNC-sweep entry gains a B7a line
instead (same pattern as B7-A26).

### 5.1 SPEC.1 — C.length whitespace semantics (anchor: F-BET-1 Pre, `C.length ∈ [1, COMMENT_MAX_LENGTH]`, ≈line 278; insert immediately after the Pre block as a note line)

> C.length semantics (AUDIT.1 A24 ruling, 2026-07-06): the **lower** bound is evaluated on
> the whitespace-trimmed comment text — a whitespace-only comment is an absent argument and
> rejects as `comment_requires_bet` per F-COMMENT-5; the **upper** bound is evaluated on
> the submitted (raw) text; the **stored** value is the submitted (raw) text, byte-identical
> to the text moderated (moderated text ≡ stored text). Trim is JS
> `String.prototype.trim()` (Unicode WhiteSpace + LineTerminator).

### 5.2 ADR-0015 — in-place Patch record (append to `docs/adr/0015-rate-limit-idempotency.md`; §5.12 pattern, as at B3)

> ## Patch record — 2026-07-06 (AUDIT-FIX-B7a, finding A14): transport bounding reconciled
>
> **Decision unchanged; transport-layer scoping.** The vendored `@upstash/redis` default
> (retries ?? 5 → 6 fetch attempts, exponential backoff ≈4.3s of sleep, **no timeout of any
> kind** — a hung socket rides undici defaults up to the platform function timeout) silently
> contradicted this ADR's no-auto-retry posture on every call from the shared singleton
> (idempotency, rate-limit, moderation reserve/release). The shared client now pins:
> `retry: { retries: REDIS_MAX_RETRIES /* 1 */, backoff: () => REDIS_RETRY_BACKOFF_MS /* 200ms flat */ }`
> and a per-command abort ceiling `signal: () => AbortSignal.timeout(REDIS_COMMAND_TIMEOUT_MS /* 2000ms */)`.
> The **function form of `signal` is mandatory**: with a static signal the vendor fabricates
> a 200 response with body `{result: "Aborted"}` (garbage into SETNX results); the function
> form rethrows the abort, landing it in the existing catch arms. The signal is minted once
> per command execution and covers the vendor's whole internal retry loop — a hard 2.0s
> per-command ceiling regardless of retry count.
>
> **Ruling scoped.** Application-level no-retry stands: no state-mutating endpoint operation
> is re-attempted. A single flat **transport-level** retry under the hard per-command ceiling
> is permitted and is what this patch records. The override changes *when* the transport
> errors, never *what an error maps to* — rate-limit stays fail-open (`{allowed: true}`
> catch arm), idempotency stays fail-closed (`unavailable` → 503), moderation-reserve stays
> fail-closed (throw aborts the request before any transaction opens). A timeout/abort
> therefore surfaces only as a thrown error into those arms — never as fabricated success.
>
> **Accepted residual.** A lost-response SETNX followed by the transport retry can
> self-collide (the retry observes the reservation its own first attempt created → the
> request resolves as a clean duplicate/pending error). Rare (requires a
> delivered-write/lost-response race inside the 2s window), terminally safe (no state
> mutated, no fabricated success), and strictly better than the pre-patch alternative of
> unbounded hangs. Constants are HARDEN-tunable.

### 5.3 SPEC.2 §11 — one-line transport bound (anchor inside the failure-mode contract paragraph; quote the chosen anchor sentence in the PR body)

> Upstash transport is bounded (ADR-0015 Patch, 2026-07-06): per-command abort ceiling
> `REDIS_COMMAND_TIMEOUT_MS` = 2000ms with a single flat in-window retry
> (`REDIS_MAX_RETRIES` = 1, `REDIS_RETRY_BACKOFF_MS` = 200ms); a timeout/abort surfaces as
> a thrown error into the existing fail-open (rate-limit) / fail-closed (idempotency,
> moderation-reserve) arms — never as fabricated success.

### 5.4 parked.md — SYNC-sweep extension (same pattern as B7-A26)

Extend the SYNC-sweep entry's originating-task line and target 1 with a B7a bullet:
SPEC.1 F-BET-1 C.length rider + ADR-0015 Patch record + SPEC.2 §11 transport line; §0
bumps owed (SPEC.1 **and** SPEC.2 this time — B7a touches both specs), no new ADR
(ceiling stays 0031).

## 6. Gates

`ZUGZWANG_ENV=preview just verify` · `pnpm test:invariants` · `pnpm test:integration` ·
full local `pnpm vitest run` against :54322 (run pnpm directly, not `just` — `.env.local`
would hit the cloud DB). §5.10 self-audit before `gh pr create`. PR opens; operator merges
only after the web gate-C read (bet-path critical file). Session log + PK staging come
AFTER merge as their own `chore/b7a-log` step.

## 7. NOT doing / STOP conditions

**NOT doing:** B7b items (A29/A31/A32/A33/A35), DDL, moderation internals, W-1 internals,
error-envelope work.

**STOP:** any rider anchor mismatch; no clean §11 anchor; anything forcing a
W-1/moderation-internals touch; test evidence contradicting the plan's
fail-open/fail-closed-unchanged claim; scope beyond A14 + A24.
