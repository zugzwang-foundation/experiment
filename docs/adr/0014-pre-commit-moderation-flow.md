# ADR-0014 — Pre-Commit Moderation Flow

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-05-07 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SPEC.15 |
| **Frame document** | SPEC.2 §1.4 #5 (delegation), §10 (Pre-Commit Moderation Contract), §23 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amended-by** | ADR-0021 (Track B verdict consequence only — held → block; reactive moderation; text-only `sexual/minors` carve-out. Gate architecture, vendor, fail-closed, Redis reservation, idempotency-first, CSAM short-circuit, F-MOD-4 atomicity unchanged.) |

---

## Patch record

### P1 — A2: the gate realises the App. A image→Track A mapping for adult `sexual` (DEBATE.7, 2026-06-19)

In-place Patch record per CLAUDE.md §5.12 (consumer-surface scoping, **not** supersession).
**The load-bearing decision is unchanged** — the gate runs entirely before the bet transaction,
fails closed, holds no Postgres tx across the OpenAI call, and the category→track map stays fixed
(SPEC.1 §14 Appendix A). DEBATE.7 scopes *which* App. A rows the gate realises: `precommitModerate`
previously routed only `sexual/minors` + `imageR2Key` → `track_a` (SCAFFOLD.16); it now ALSO routes
adult `sexual === true` + `imageR2Key` → `track_a` (`src/server/moderation/precommit.ts`, the new
`TRACK_A_SEXUAL_CATEGORY` branch), implementing the fixed App. A image-attached adult-imagery rows.
**Rationale:** with PhotoDNA parked and `omni-moderation-2024-09-26` scoring image-borne CSAM as
adult `sexual` (not `sexual/minors`, which is text-only on the snapshot), the adult-`sexual` + image
→ auto-ban rule is the live CSAM-image backstop. Adult `sexual` on **text** stays `track_b`
(auto-ban-on-text escalation deferred to HARDEN.5; text-first platform). **Consumers:** SPEC.1
Appendix A (adult-`sexual` text row → Track B; the new image-attached adult-`sexual` → Track A row;
the "image adult-imagery → Track A realisation" note) and SPEC.2 §10 (the A2 note on the Track-A
image-presence paragraph). CSAM-image coverage = this backstop + reactive admin removal (SPEC.1 §15
F-ADMIN-4) until PhotoDNA / NCMEC land (parked — `docs/parked.md` LD-1 / LD-7). Orthogonal to the
ADR-0021 Track B *consequence* amendment (held → block): this P1 scopes the *gate mapping*.

---

## Context and Problem Statement

SPEC.1 §14 mandates AI-driven pre-commit moderation across Tracks A (auto-ban categories: CSAM, sexual/minors, NSFW), B (admin-review categories: violence, hate, harassment, threats, self-harm, weapons), and C (passes). The moderation runs on every comment: F-BET-1 entry (atomic with bet, governed by INV-1 and F-MOD-4), F-COMMENT-1 (direct), F-COMMENT-2 (reply), and F-COMMENT-3 (image-attached). Per SPEC.1 §14 Appendix A, the canonical category-to-track mapping is fixed; threshold values per category are deferred to HARDEN.5 sample-content testing (target: 2026-09-01).

The architectural problem this ADR resolves: the moderation HTTP call is a 200–2000 ms upstream dependency, and SPEC.2 §9 (ratified by ADR-0013) forbids holding a Postgres transaction open across an HTTP call (`REFUSAL:` per CLAUDE.md golden rules). The naive shape — call OpenAI inside the bet+comment SERIALIZABLE transaction — would pin a database transaction across an unbounded external dependency, exhausting Postgres connections under load and entangling moderation outage with bet-flow availability. The required shape is the inverse: moderation runs entirely **before** the bet/comment transaction opens, with its own concurrency-control primitive.

This ADR also resolves the implicit second problem flagged in the SPEC.15 kickoff: two concurrent submits from the same user against the same market with the same idempotency key would both call OpenAI before either could write the cached idempotency response. The Stripe-style idempotency cache (per ADR-0013 §3) only short-circuits **completed** requests; the in-flight window between "first request sees cache miss" and "first request writes cached response" is unprotected. A separate Redis intent-reservation key fills this gap.

The vendor question — whether to use Rekognition / Sightengine / Hive for image classification alongside OpenAI for text — was carried into the kickoff as "decide or defer." Research (May 2026) confirms that OpenAI's `omni-moderation-latest` model accepts both text and image inputs in a single multimodal call and supports the violence, self-harm, and sexual (non-minors) image categories natively. CSAM hash matching remains a separate concern — it is a database lookup against known-CSAM hashes, not a classifier task — and stays with PhotoDNA-or-equivalent per SPEC.1 §14. No third image-classifier vendor is needed for v1.

This ADR does **not** decide:

- Bet transaction concurrency model — owned by ADR-0013 (SPEC.14).
- Idempotency-key store substrate (Redis SETNX vs Postgres `INSERT … ON CONFLICT`) and TTL values — owned by ADR-0015 (SPEC.16).
- AI threshold numeric values per category — owned by HARDEN.5 number-tuning pass.
- `mod_actions` event-row schema and the `events`-table column shape — owned by ADR-0005 / SPEC.5 + ENGINE.6 + `src/db/schema/events.ts`.
- Admin queue UI for Track B review — owned by ENGINE.* / DEBATE.* / UI.6.
- Track B admin Approve / Block decision flow — owned by SPEC.1 §14 F-MOD-3 + ENGINE.* implementation.
- The PhotoDNA onboarding procedure — owned by SPEC.1 §14 Provisional Gates + Hrishikesh-as-operator.

## Decision Drivers

1. **No Postgres transaction held across an HTTP call.** SPEC.2 §9 + ADR-0013 §8 + CLAUDE.md golden rules. Holding a SERIALIZABLE transaction across a 200–2000 ms upstream call exhausts Postgres connections and entangles moderation upstream availability with bet-flow availability.
2. **Idempotency cache as the first authenticated step.** Per ADR-0013 §3, a duplicate retry must short-circuit before moderation is called — both for cost reasons (free moderation today, but a single retry could double the OpenAI call volume) and for correctness reasons (OpenAI category scores are not stable across calls; a borderline-Track-B comment that passed on the first call could fail on a retry, corrupting the dataset).
3. **In-flight dedup separate from completion dedup.** Two concurrent submits from the same `(user, market, idempotency_key)` triple, both arriving before either completes, both see cache miss. Without an in-flight guard, both call OpenAI. A second concurrency primitive — distinct from the idempotency cache — is required.
4. **F-MOD-4 atomicity preserved.** SPEC.1 §14 F-MOD-4: on Track A or Track B verdict for an entry comment, the bet+comment transaction aborts. The mechanism: never open the bet wrapper. INV-1 holds trivially because the double-insert was never attempted.
5. **Legal floor: CSAM auto-report (SPEC.1 §16.5).** A moderation outage that fails open is a legal-floor breach for CSAM categories. Fail-closed is mandatory; fail-open is non-negotiable in the wrong direction.
6. **Accuracy-first for the experiment phase.** Hrishikesh ratified accuracy over latency in the SPEC.15 kickoff. 5–10 second submit budget is acceptable; one retry on transient upstream failure is preferred over fast failure.
7. **Simplicity for solo build.** A single moderation primitive (one source-of-truth file, one verdict shape, one parameterised flow consumed by F-BET-1 / F-COMMENT-1/2/3) keeps the moderation surface auditable and testable. Multiple-vendor split would multiply integration surface for marginal v1 benefit.
8. **Provisional posture honoured.** SPEC.1 §14 F-MOD-1 (auto-ban) and F-MOD-4 (atomicity) are both labelled `provisional`. ADR-0014 ratifies the v1 shape and names the HARDEN.5 degrade-mode trigger; it does not pre-emptively switch from the provisional defaults.

## Considered Options

1. **OpenAI `omni-moderation-latest` (text + multimodal) + PhotoDNA (CSAM hash); pre-bet-transaction Server Action sequence; 10-second Redis SETNX intent-reservation; one retry on transient upstream failure; fail-closed on terminal failure** ← chosen
2. OpenAI for text + a third-party image classifier (Rekognition / Sightengine / Hive) for general image categories + PhotoDNA for CSAM hash
3. Self-hosted classifier (open-source models on Vercel / a Modal worker) for both text and image
4. No pre-commit moderation; rely entirely on admin reactive removal via F-ADMIN-4
5. Synchronous moderation **inside** the bet+comment SERIALIZABLE transaction
6. Asynchronous moderation **after** the bet+comment commits (post-write classification, retroactive removal)
7. Reservation-key pattern via Postgres advisory locks instead of Redis SETNX

## Decision Outcome

**Chosen: Option 1 — OpenAI `omni-moderation-latest` for text and multimodal classification, PhotoDNA for CSAM hash, pre-bet-transaction Server Action sequence with 10-second Redis SETNX intent-reservation, one retry on transient upstream failure, fail-closed on terminal failure.**

Eight primitives ratified.

### 1. Vendor selection: OpenAI `omni-moderation-latest` + PhotoDNA, no third vendor

**OpenAI `omni-moderation-latest`** (snapshot pin: `omni-moderation-2024-09-26`) is the single classifier for all text and general-image moderation. The model accepts text and image inputs in one multimodal call, returns calibrated probability scores per the SPEC.1 Appendix A category list, and is free of charge with no per-call rate cap counted against monthly usage (verified May 2026).

**PhotoDNA-or-equivalent** is the CSAM hash service, called separately and in parallel with OpenAI on every image-attached submission. CSAM detection is a hash lookup against a known-CSAM database, not a classifier task; OpenAI cannot do it. PhotoDNA onboarding is a SPEC.1 §14 Provisional Gate, owned by Hrishikesh-as-operator pre-launch.

**No third-party image classifier (Rekognition / Sightengine / Hive)** ships in v1. The prior kickoff "decide or defer" framing is resolved as **decide**, not defer: omni-moderation-latest's native image-category coverage (violence, violence/graphic, self-harm, self-harm/intent, self-harm/instructions, sexual) is sufficient for v1 experiment scale. Three image categories that omni-moderation does not classify — `hate` (image), `harassment` (image), `weapons` (image) — are accepted as a v1 gap; admin reactive removal via SPEC.1 §15 F-ADMIN-4 covers escalations, and HARDEN.5 sample-content testing measures the empirical false-negative rate.

The pinned snapshot `omni-moderation-2024-09-26` fixes the model version. `omni-moderation-latest` would auto-track upstream model upgrades; the pinned snapshot avoids silent calibration drift across HARDEN.5 threshold tuning and the 2026-09-15 → 2026-11-05 live window. A model-version upgrade is an explicit ADR amendment, not a silent refresh.

### 2. Server Action sequence (parameterised by caller)

The pre-commit moderation flow is a single function `precommitModerate()` in `src/server/moderation/precommit.ts`, exported and consumed by F-BET-1 (entry), F-COMMENT-1 (direct), F-COMMENT-2 (reply), and F-COMMENT-3 (image-attached) Server Action handlers.

The handler-side sequence, per ADR-0013 §3 idempotency-first ordering:

1. **Auth gate.** Reject unauthenticated requests at the Server Action boundary (per ADR-0004 / SPEC.4).
2. **Idempotency cache lookup.** First authenticated work. On hit, return cached `(status, body)` verbatim and exit. No moderation, no transaction. Per ADR-0013 §3.
3. **Redis intent reservation** (per primitive #3 below). On collision, return 409 `moderation_in_flight` with `Retry-After: 2`. On reservation success, hold the key for 10 seconds.
4. **Call `precommitModerate(input)`.** Returns a typed `ModerationVerdict` (per primitive #4 below).
5. **Branch on verdict:**
   - **`pass`**: open the caller-specific transaction. F-BET-1 calls the bet wrapper (`src/server/bets/transaction.ts` per ADR-0013); F-COMMENT-1/2/3 call the comment-write transaction.
   - **`track_a`**: write `mod_actions` row in a standalone short transaction (verdict, AI categories with confidence scores, source layer, user_id, comment text, image R2 key if applicable). Return F-MOD-1 response per SPEC.1 §14. The bet+comment transaction never opens (F-MOD-4 atomicity preserved trivially).
   - **`track_b`**: write `mod_actions` row in a standalone short transaction (same shape, marked `track_b_pending`). Return F-MOD-2 response. The bet+comment transaction never opens.
6. **Release Redis reservation** in a `finally` block, regardless of branch outcome. The 10-second TTL is the safety net if release fails.
7. **Cache idempotency response.** Per ADR-0013 §3 / ADR-0015. The cached response on Track A / Track B branches is the F-MOD-* error response, so a duplicate retry replays the same error (not a fresh moderation call).

For F-BET-2 (subsequent buy) and F-BET-3 (sell), `precommitModerate()` is **not called**. These flows have no comment to moderate per SPEC.1 §7, and ADR-0013 §8 already establishes the wrapper as moderation-unaware.

### 3. Redis intent-reservation: 10-second SETNX-with-TTL

The reservation key shape is `mod:reserve:{user_id}:{market_id}:{idempotency_key}`. The Redis primitive is `SET key 1 NX EX 10` (SETNX with 10-second TTL) via `@upstash/redis`.

**TTL: 10 seconds.** Sized to cover worst-case moderation latency (3s timeout + 3s retry timeout = 6s) plus bet-transaction wrapper worst case (~1s with retries) plus slack. The original kickoff value of 60 seconds is rejected as 10× over-sized; with a 5–10 second submit budget ratified, a 60s reservation generates needlessly long collision windows for legitimate retries. The 10s value is principled, not paranoid.

**Collision response.** On `SET … NX` returning failure (key already exists), the handler returns HTTP 409 with body `{ error_code: "moderation_in_flight", message: "Your previous submit is still being processed.", retry_after: 2 }` and the `Retry-After: 2` header. The client retries after 2 seconds; the typical moderation finishes in ~700 ms, so most collisions resolve within one retry.

**Release semantics.** The reservation is released in a `finally` block via `DEL`. If the release fails (Redis transient), the 10-second TTL is the safety net. The reservation is intentionally not released atomically with the moderation verdict write — release-on-error is acceptable because the failure case is "user can retry in 10 seconds at most," not "data loss."

**Why Redis SETNX, not Postgres advisory locks.** Postgres advisory locks (Option 7) are session-scoped or transaction-scoped — neither shape fits a reservation that must outlive the moderation call without holding a database connection. SETNX is the canonical idiom for distributed in-flight dedup; ADR-0015 will pick the broader idempotency-cache substrate (Redis vs Postgres-native), but the reservation primitive specifically is Redis-shaped.

**Why distinct from the idempotency cache.** The idempotency cache (per ADR-0013 §3, owned by ADR-0015) keys on the idempotency key alone and stores the **completed** response with a 24-hour TTL. The reservation keys on the `(user, market, idempotency_key)` triple and guards the **in-flight** window with a 10-second TTL. They serve disjoint concerns: cache short-circuits completed requests; reservation prevents concurrent moderation calls during the same in-flight window.

### 4. OpenAI HTTP call shape: 3-second timeout, one retry on transient failure, fail-closed on terminal failure

**Endpoint.** `POST https://api.openai.com/v1/moderations`. Auth via `OPENAI_API_KEY` env var. Request body shape per the omni-moderation-latest API:

```ts
// Text-only (F-COMMENT-1, F-COMMENT-2, F-BET-1 entry without image)
{
  model: 'omni-moderation-2024-09-26',
  input: [{ type: 'text', text: commentText }],
}

// Multimodal (F-COMMENT-3, F-BET-1 entry with image)
{
  model: 'omni-moderation-2024-09-26',
  input: [
    { type: 'text', text: commentText },
    { type: 'image_url', image_url: { url: r2SignedReadUrl } },
  ],
}
```

**Image URL format.** Signed R2 read URL with 60-second TTL, generated server-side from the R2 object key the browser uploaded to during composition (per SPEC.1 §8 F-COMMENT-3 and SPEC.2 §12). The signed URL TTL is intentionally short — OpenAI fetches the image once during the call; a leaked URL becomes useless after 60 seconds.

**Timeout: 3 seconds per attempt.** Aligned with the documented 200–2000 ms latency envelope plus 50% margin. A timeout is treated as a transient failure (retry once).

**Retry policy: one retry on transient failure.** Transient = network error, timeout, HTTP 5xx, HTTP 429. No retry on HTTP 4xx (`401`, `403` — these are auth/quota errors that won't resolve on retry; they fire a separate Sentry event tagged `openai_moderation_auth_failure` and fail closed). On the retry attempt, the same timeout (3s) applies. Total worst-case OpenAI latency: 6 seconds.

**Why one retry, not multiple.** Concurrency is bounded by the 10-second Redis reservation; a multi-retry policy could exceed the reservation TTL. One retry covers the dominant transient failure mode (single 5xx blip) without unbounded latency growth. Aligns with ADR-0013's bounded-retry discipline (3 retries on bet transaction, 1 retry on moderation).

**Fail-closed on terminal failure.** If both attempts fail, the handler emits a Sentry custom event tagged `openai_moderation_upstream_failure` (per primitive #6), releases the Redis reservation, does NOT write `mod_actions`, and returns HTTP 503 `moderation_unavailable` with `Retry-After: 5`. The bet+comment is never persisted. The user retries.

**The fail-closed posture is non-negotiable.** SPEC.2 §11's rate-limit-fails-open posture does not apply here. A moderation outage with fail-open behaviour means CSAM detection is bypassed during the outage — a legal-floor breach per SPEC.1 §16.5. Mirror SPEC.2 §11's idempotency-fails-closed posture instead.

### 5. PhotoDNA HTTP call shape (image-attached path)

PhotoDNA (or equivalent CSAM hash service onboarded per SPEC.1 §14 Provisional Gates) is called in **parallel** with OpenAI on every image-attached submit. Total moderation latency for image-attached flows = `max(OpenAI_latency, PhotoDNA_latency)`, dominated by whichever finishes last.

The exact PhotoDNA HTTP shape is owned by SCAFFOLD.16 (vendor-onboarding deliverable). ADR-0014 ratifies the contract:

- Same 3-second timeout as OpenAI.
- Same one-retry-on-transient-failure policy.
- Same fail-closed posture on terminal failure (Sentry event tagged `photodna_upstream_failure`, also catalogued under ADR-0007 §4 alarm 4 since the user-facing impact — moderation unavailable, fail-closed — is identical to OpenAI failure).
- Returns `{ outcome: 'csam_match' | 'no_match' }`. A `csam_match` is unconditionally Track A regardless of the OpenAI verdict.

**Verdict aggregation across the two calls** (image-attached path):

```
if photodna === 'csam_match':                  return { outcome: 'track_a', categories: ['csam'] }
if openai.flagged && openai.track === 'a':     return { outcome: 'track_a', categories: openai.categories }
if openai.flagged && openai.track === 'b':     return { outcome: 'track_b', categories: openai.categories }
return                                                { outcome: 'pass' }
```

A PhotoDNA `csam_match` short-circuits the OpenAI verdict — Track A is the most-restrictive outcome, and CSAM hash match is more reliable than classifier inference for this category specifically.

**Both calls fail-closed.** If either call returns terminal failure (after retry), the submit returns 503. We do not proceed on partial verdict — a CSAM hash match without OpenAI verification, or vice versa, is incomplete moderation by design.

### 6. Sentry observability per ADR-0007 §4 alarm 4

Two Sentry custom event tags ship under ADR-0007's alarm 4 ("OpenAI moderation upstream failure rate"):

- **`openai_moderation_upstream_failure`** — fires on every OpenAI call that fails terminally (timeout after retry, 5xx after retry, 429 after retry, network error after retry). Tags: `attempt_count`, `last_status_code`, `flow` (one of `F-BET-1`, `F-COMMENT-1`, `F-COMMENT-2`, `F-COMMENT-3`).
- **`openai_moderation_auth_failure`** — fires on HTTP 401 / 403 (no retry). Tags: `status_code`, `flow`. Operationally distinct from upstream blips: signals expired key, rotated key, or quota exhaustion. Requires ops attention, not just waiting it out.
- **`photodna_upstream_failure`** — same shape as `openai_moderation_upstream_failure`, fired on PhotoDNA terminal failure. Distinguished by tag for ops triage.

Threshold values for the Sentry alert rule (events/window) are deferred to HARDEN.* per ADR-0007 §4. Per-call breadcrumbs (one per attempt, including retries) are emitted in addition to the terminal events, mirroring ADR-0013 §5's per-retry breadcrumb pattern.

### 7. F-MOD-4 entry-case atomicity mechanism

The atomicity property "bet+comment both persist or neither persists" (SPEC.1 §5 INV-1, F-MOD-4) is preserved by **structure, not by transaction-level rollback**. The flow:

1. F-BET-1 handler calls `precommitModerate()`.
2. On `track_a` / `track_b` verdict: `mod_actions` row is written in a standalone short transaction; bet wrapper is **never invoked**. The bet+comment double-insert is never attempted. INV-1 holds trivially because there is no partial state to roll back.
3. On `pass` verdict: F-BET-1 handler invokes the bet wrapper (`src/server/bets/transaction.ts` per ADR-0013). The wrapper opens the SERIALIZABLE transaction, writes the bet row, writes the comment row, all atomically per ADR-0013 §1–§7.

The moderation result is communicated to the bet handler via the typed return value, not via a shared transaction. The bet wrapper never sees moderation context — per ADR-0013 §8, passing moderation context into the wrapper would re-introduce the "Postgres tx held across HTTP call" anti-pattern.

The F-MOD-4 row in SPEC.1 §17 (`moderation::entry-flag-fails-both` linked to INV-1) tests this property end-to-end: a Track A or Track B entry-comment flag results in zero rows in `bets` and zero rows in `comments` for the request.

### 8. Track A degrade mode (HARDEN.5 trigger)

SPEC.1 §14 F-MOD-1 specifies Track A as auto-ban: comment never reaches public view, user account flagged `banned`, mod_actions written, existing positions ride to resolution, no appeal. CSAM specifically auto-reports.

SPEC.1 §14 also marks F-MOD-1 and F-MOD-4 as **provisional**: "Confirm or override during sample-content testing if revision creates abusive retry loops" (F-MOD-4) and the broader "Pattern locked; thresholds, vendor selection, and edge-case behaviour finalised after Aug 15–31 sample-content testing" (§14 preamble).

If HARDEN.5 sample-content testing surfaces an unacceptably high false-positive rate or other operational issue with auto-ban, Track A degrades to **flag-only mode**: content blocked, mod_actions written, user **not** banned, admin reviews the queue at `/admin/moderation` and bans manually via F-ADMIN-4. The legal-floor auto-report (CSAM → NCMEC) is unaffected by the degrade — auto-report does not depend on auto-ban.

The degrade decision is owned by HARDEN.5 and ratified by a separate ADR (or a HARDEN.5 close-out memo) at that time. ADR-0014 documents the degrade path so the option is not buried implicit knowledge; ADR-0014 does not pre-emptively switch from the SPEC.1 §14 provisional default.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| `precommitModerate()` function (Server Action sequence, OpenAI + PhotoDNA calls in parallel, retry policy, verdict aggregation, Sentry emission, Redis reservation lifecycle) | `src/server/moderation/precommit.ts` |
| `ModerationVerdict` typed return shape | `src/server/moderation/precommit.ts` (co-located; not extracted to a types file because it is a decision parameter of this ADR) |
| OpenAI HTTP call constants (`OPENAI_MODERATION_MODEL_SNAPSHOT`, `OPENAI_TIMEOUT_MS`, `OPENAI_MAX_RETRIES`) | `src/server/moderation/precommit.ts` (co-located with the wrapper; not extracted to config because they are decision parameters of this ADR, not tunables) |
| Redis reservation key shape and TTL | `src/server/moderation/precommit.ts` (constants `RESERVATION_KEY_PREFIX`, `RESERVATION_TTL_SECONDS`) |
| PhotoDNA HTTP call shape | `src/server/moderation/photodna.ts` (vendor-specific module; called from `precommit.ts`); vendor onboarding owned by SCAFFOLD.16 |
| OpenAI client (HTTP wrapper, auth, base URL) | `src/server/moderation/openai.ts` (vendor-specific module; called from `precommit.ts`) |
| Sentry alarm 4 emission site | `src/server/moderation/precommit.ts` (per ADR-0007 §4; threshold values deferred to HARDEN.*) |
| `mod_actions` row schema | Owned by ADR-0005 / SPEC.5 + ENGINE.6; lives in `src/db/schema/moderation.ts` (specific domain file owned by SCAFFOLD.2) |
| `mod_actions` append-only trigger SQL | `drizzle/migrations/<NNNN>_append_only_triggers.sql` per ADR-0005 §6 |
| Acceptance test file | `tests/server/moderation/precommit.test.ts` (mints six new rows in SPEC.1 §17 — see "Acceptance tests minted" below) |

## Consequences

### Positive

- **No Postgres transaction held across an HTTP call.** SPEC.2 §9 + ADR-0013 §8 invariant preserved verbatim. The bet wrapper stays moderation-unaware; moderation stays transaction-unaware.
- **Single vendor for general moderation.** OpenAI omni-moderation-latest covers text and image categories in one multimodal call. No third image-classifier integration. Reduced surface area for solo build and audit.
- **Free of charge.** OpenAI moderation endpoint is free of charge with no per-call rate cap counted against monthly usage. Cost ceiling for moderation is $0 in v1.
- **Calibrated confidence scores.** OpenAI's calibrated scores (per the GPT-4o moderation model upgrade) make HARDEN.5 threshold tuning principled, not magical: a score of 0.7 means roughly 70% probability of policy violation, not an arbitrary classifier output.
- **Idempotency-first ordering preserved.** ADR-0013 §3 contract honoured: cache lookup is the first authenticated work, before moderation is even called.
- **In-flight collision dedup is principled.** The 10-second Redis reservation is sized to actual worst-case latency, not a paranoia margin. Legitimate retries during the in-flight window are bounced with a clear `Retry-After: 2` and resolve quickly.
- **Fail-closed on legal-floor categories.** CSAM detection cannot be bypassed by an OpenAI or PhotoDNA outage — the submit fails; nothing posts unmoderated.
- **Track A degrade mode documented.** If HARDEN.5 surfaces too many false positives, the override path (auto-ban → flag-only with manual admin ban) is named and discoverable, not buried in tribal knowledge.

### Negative

- **Three image categories not classified by omni-moderation: hate (image), harassment (image), weapons (image).** Mitigated by: SPEC.1 §15 F-ADMIN-4 admin reactive removal; HARDEN.5 sample-content testing measures the empirical false-negative rate; if the rate is unacceptable, a follow-up ADR can add a third vendor at that point.
- **OpenAI as single point of failure.** An OpenAI outage means submit downtime (fail-closed). Mitigated by: Sentry alarm 4 fires on elevated upstream failure rate so Hrishikesh-as-operator knows immediately; one retry on transient failure absorbs short blips; the `Retry-After: 5` user-facing message is honest.
- **OpenAI category scores not stable across calls.** A borderline-Track-B comment that scored 0.49 on the first call could score 0.51 on a retry and flip the verdict. Mitigated by: idempotency-cache-first ordering means a successful call's verdict is cached for 24 hours; only failed calls are retried; the model snapshot is pinned (`omni-moderation-2024-09-26`) so calibration drift is opt-in.
- **PhotoDNA onboarding is a pre-launch gate.** PhotoDNA access requires Microsoft qualification as an "online service provider." Mitigated by: SPEC.1 §14 already names this as a Provisional Gate; SCAFFOLD.16 owns the vendor-onboarding work; if PhotoDNA-specifically is unattainable in the timeline, an equivalent CSAM-hash service (NCMEC's CyberTipline, Thorn's Safer) is acceptable per SPEC.1 §14 wording.
- **Reservation release is not atomic with moderation completion.** A handler that crashes between OpenAI call return and Redis `DEL` leaves the reservation held until the 10-second TTL expires. Acceptable: the failure mode is "user retries in 10 seconds," not data corruption.
- **Multimodal call sends image URL, not bytes.** OpenAI fetches the image from R2 during the call. Implies the R2 object must be readable when OpenAI fetches it. Mitigated by: signed R2 read URL with 60-second TTL generated at handler entry; OpenAI's documented behaviour fetches once during the call.

### Neutral

- The pinned snapshot `omni-moderation-2024-09-26` will become superseded by future OpenAI moderation model versions. A model upgrade is an explicit ADR amendment (or a new ADR superseding this one), not a silent refresh. This ADR's snapshot pin holds across the experiment phase.
- The ADR scopes "moderation" to pre-commit only. Post-commit / reactive moderation via F-ADMIN-4 is owned by SPEC.1 §15 and the admin Control Centre implementation.
- HARDEN.5 may produce a follow-up ADR ratifying threshold values + degrade-mode decision + the empirical false-negative rate for the three uncovered image categories. ADR-0014 does not pre-empt that work; it leaves clean hooks for it.

## Pros and Cons of the Options

### Option 1 — OpenAI omni-moderation-latest + PhotoDNA, pre-bet-tx Server Action, 10-second Redis reservation, one retry, fail-closed (chosen)

**Pros**

- Single vendor for general moderation; lowest integration surface.
- Multimodal in one call; native image support for the highest-impact categories (violence, self-harm, sexual non-minors).
- Free of charge.
- Calibrated scores enable principled HARDEN.5 tuning.
- Reservation TTL sized to real latency, not paranoia.
- Fail-closed posture aligns with legal floor.
- Mature, well-documented HTTP API with stable wire shape.

**Cons**

- Three image categories uncovered (hate / harassment / weapons in image inputs). Accepted with F-ADMIN-4 mitigation and HARDEN.5 measurement.
- OpenAI as single point of failure (fail-closed = submit downtime during outage). Acceptable for experiment scale.
- Score non-determinism on retry; mitigated by cache-first ordering.

### Option 2 — OpenAI for text + Rekognition / Sightengine / Hive for image + PhotoDNA for CSAM

**Pros**

- Image-category coverage extends to hate / harassment / weapons.
- Multi-vendor classifier diversity could reduce single-vendor false-positive bias.

**Cons**

- Multiplies integration surface: three vendors (OpenAI + image classifier + PhotoDNA) instead of two.
- Requires a third-party vendor evaluation (cost, latency, region, contract), which the SPEC.15 kickoff already flagged as "decide or defer." Defer is overcomplication for v1; decide adds 1–2 weeks of vendor onboarding under a fixed deadline.
- Verdict aggregation across three classifiers is more failure-prone than two.
- Cost ceiling. Rekognition / Sightengine / Hive are paid per call; budget impact is small but non-zero, contrary to the "single-tier $50/mo" budget posture per ADR-0007.
- Latency is dominated by the slowest vendor regardless of how many vendors run in parallel. Adding a third classifier doesn't reduce p99; it adds a third failure mode.

**Verdict:** Rejected. Three-vendor integration is overcomplication for a 5,000-user experiment. The accepted v1 gap (three image categories) is mitigated by F-ADMIN-4 and measured by HARDEN.5.

### Option 3 — Self-hosted classifier (open-source models on Vercel / Modal worker)

**Pros**

- No upstream-vendor dependency; no fail-closed scenarios from a third-party outage.
- Full control over model and threshold values.

**Cons**

- Solo-build constraint: Hrishikesh has 2 support devs and Claude Code; productionising open-source classifiers (Llama Guard, Gemma-Shield, etc.) takes ~2–4 weeks under the fixed deadline. Time not available.
- Ongoing model-drift management is a recurring ops cost.
- CSAM hash matching still requires PhotoDNA — self-hosting doesn't replace the legal-floor service, only the classifier.
- Model quality is unlikely to match `omni-moderation-latest` (GPT-4o-derived) for v1.

**Verdict:** Rejected. Time-not-available against the deadline. Reconsidered for testnet/mainnet phases per the no-decisions-across-phase-boundary discipline.

### Option 4 — No pre-commit moderation; admin reactive removal only via F-ADMIN-4

**Pros**

- Minimal complexity; no upstream dependencies; no fail-closed scenarios.
- Removes the bet+comment latency penalty entirely.

**Cons**

- **Legal floor violated.** SPEC.1 §16.5 + §14 mandate CSAM detection at submit time, with auto-report to NCMEC. Reactive-only removal cannot meet this — by the time the admin sees CSAM in a queue, the legal-floor breach has occurred.
- Admin queue would scale linearly with submit volume; experiment-scale is small, but the legal-floor argument is independent of scale.
- Thesis-violating: the entire SPEC.1 §14 contract is pre-commit moderation. Dropping it is a thesis-level change requiring explicit rediscussion, not a delivery shortcut.

**Verdict:** Rejected. Legal-floor violation. Out of scope per CLAUDE.md refusals contract — would require a thesis-level rediscussion (which Hrishikesh has not requested).

### Option 5 — Synchronous moderation inside the bet+comment SERIALIZABLE transaction

**Pros**

- Trivial atomicity: moderation result and bet+comment writes share the same transaction.
- No reservation primitive needed.

**Cons**

- **Holds a Postgres SERIALIZABLE transaction open across a 200–2000 ms HTTP call.** This is a `REFUSAL:` per CLAUDE.md golden rules and SPEC.2 §9.
- Postgres connection pool exhaustion under any non-trivial concurrency.
- Couples moderation upstream availability to Postgres availability — an OpenAI hang freezes the database.
- ADR-0013 §8 already establishes the bet wrapper as moderation-unaware. This option contradicts a ratified ADR.

**Verdict:** Rejected. Architectural contradiction with ADR-0013 §8 and SPEC.2 §9. Hard refusal under CLAUDE.md golden rules.

### Option 6 — Asynchronous moderation after commit; retroactive removal

**Pros**

- Submit latency is minimal (no moderation in the critical path).
- Moderation outage doesn't block submits.

**Cons**

- **Legal floor violated.** Same issue as Option 4: CSAM content is publicly visible — even briefly — before async moderation runs. NCMEC auto-report obligation is pre-publication, not post-publication.
- INV-3 and the debate-view contract assume a comment is either visible (moderation passed) or not visible (Track A blocked). An async-moderation flow introduces an "in-limbo" state visible to readers, which neither SPEC.1 §14 nor §17 acceptance tests cover.
- F-MOD-4 atomicity is broken: bet commits, comment commits, moderation later fails — now the bet exists with a removed comment, violating INV-1.

**Verdict:** Rejected. Legal-floor violation + INV-1 violation.

### Option 7 — Postgres advisory locks instead of Redis SETNX for the reservation

**Pros**

- One fewer external dependency in the moderation path (Redis can fail; Postgres advisory locks live with the database we already require).
- No TTL management needed for session-scoped advisory locks.

**Cons**

- **Session-scoped advisory locks require holding a Postgres session/connection across the moderation HTTP call** — exactly the anti-pattern this ADR exists to avoid.
- Transaction-scoped advisory locks release on transaction commit/rollback; we have no transaction at the moderation step (and explicitly cannot have one).
- Redis is already required for rate-limiting (per SPEC.1 §16.1 and ADR-0015). Adding "moderation reservation" to Redis is incremental, not a new dependency.
- Postgres advisory locks have no TTL — a crashed handler leaves the lock held indefinitely (until the connection is recycled, which can be hours).

**Verdict:** Rejected. Mechanism mismatch — advisory locks don't fit the "no Postgres connection across HTTP call" constraint.

## Acceptance tests minted (consumed by SPEC.1 §17)

Six new rows added to the `moderation::*` family:

| Test ID | Verifies |
|---|---|
| `moderation::no-postgres-tx-across-openai-call` | An assertion in the bet wrapper that no Postgres connection / transaction is held during the OpenAI HTTP call (verified by mocking OpenAI to a 2-second delay and asserting active connection count remains baseline). |
| `moderation::idempotency-cache-hit-skips-moderation` | A duplicate request with a cache hit returns the cached response without invoking `precommitModerate()` (verified by spy on the moderation function call). |
| `moderation::redis-reservation-collision-409` | Two concurrent submits on the same `(user, market, idempotency_key)` triple: first acquires reservation, second receives 409 `moderation_in_flight` with `Retry-After: 2`. |
| `moderation::openai-transient-failure-retry-succeeds` | A request where OpenAI returns 5xx on the first attempt and 200 on the retry succeeds end-to-end without leaking the failure to the user. |
| `moderation::openai-terminal-failure-fails-closed` | A request where OpenAI returns 5xx on both attempts returns 503 `moderation_unavailable`, writes no `mod_actions` row, writes no bet+comment row, releases the Redis reservation. |
| `moderation::photodna-csam-match-shortcircuits-openai` | Image-attached request where PhotoDNA returns `csam_match` returns Track A regardless of OpenAI verdict. |

The five existing `moderation::*` rows in SPEC.1 §17 (`track-a-auto-ban`, `track-b-queue`, `track-b-approve-block`, `entry-flag-fails-both`, `banned-mid-session`) remain unchanged.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 §5 | INV-1 (bet ↔ comment atomicity) | **Consumes**. Preserved structurally: on Track A / Track B verdict, bet+comment transaction never opens, so there is no partial state. F-MOD-4 atomicity follows. |
| SPEC.1 §7 | F-BET-1 (entry: atomic bet+comment) | **Shapes**. F-BET-1 caller invokes `precommitModerate()` before opening the bet wrapper; on `pass`, wrapper opens; on Track A / B, wrapper never opens. |
| SPEC.1 §8 | F-COMMENT-1, F-COMMENT-2, F-COMMENT-3 | **Shapes**. Standalone-comment callers invoke `precommitModerate()` before opening the comment-write transaction. Same flow shape, different caller-side branches. |
| SPEC.1 §14 | F-MOD-1, F-MOD-2, F-MOD-3, F-MOD-4, F-MOD-5 | **Consumes** the SPEC.1 contract; **mints** the implementation flow. Tracks A/B/C routing per Appendix A; `mod_actions` write on flag; F-MOD-4 atomicity preserved structurally. |
| SPEC.1 §14 Appendix A | AI category-to-track mapping | **Consumes**. The verdict aggregation in `precommitModerate()` reads OpenAI category scores and PhotoDNA result and routes per Appendix A. ADR-0014 does not duplicate the mapping. |
| SPEC.1 §16.1 | `AI_FLAG_THRESHOLD_TRACK_A_*`, `AI_FLAG_THRESHOLD_TRACK_B_*` | **Consumes** symbolic constants; **defers** numeric values to HARDEN.5 per the number-tuning rule. |
| SPEC.1 §16.5 | CSAM auto-report (NCMEC), legal floor | **Consumes**. Fail-closed posture is the operational consequence of this constraint. |
| SPEC.1 §17 | `moderation::*` acceptance tests | **Mints** six new rows (per "Acceptance tests minted" above) in addition to the five existing rows. |
| SPEC.2 §9 | "No Postgres tx held across HTTP call" | **Consumes**. The pre-bet-transaction sequence is the structural mechanism preserving this. |
| SPEC.2 §10 | Pre-Commit Moderation Contract (stub) | **Mints** the substantive contract that absorbs the §10 stub at SPEC.2's next drafting pass. |
| SPEC.2 §11 | Rate-Limit & Idempotency Contract (stub) | **Consumes** the idempotency-fails-closed posture; mirrors it as moderation-fails-closed. |
| ADR-0007 | §4 alarm 4 (OpenAI moderation upstream-failure rate) | **Consumes** the alarm; **mints** the emission site (`src/server/moderation/precommit.ts`) and the three event tags (`openai_moderation_upstream_failure`, `openai_moderation_auth_failure`, `photodna_upstream_failure`). |
| ADR-0013 | §3 (idempotency-first ordering), §8 (moderation outside transaction) | **Consumes** both. Idempotency cache lookup is the first authenticated step; moderation runs entirely before the bet wrapper opens; the wrapper stays moderation-unaware. |
| ADR-0015 (forthcoming) | Idempotency-key store + cache TTL + key-shape | **Consumes** (forthcoming). The reservation key is distinct from the idempotency cache; ADR-0015 picks the cache substrate without affecting ADR-0014. |
| Tracker | ENGINE.8 (bet flow API), HARDEN.5 (sample-content testing), SCAFFOLD.16 (PhotoDNA onboarding) | All depend on this ADR being `accepted`. |

## More Information

- OpenAI moderation API guide (model: `omni-moderation-latest`, multimodal text + image, free of charge, calibrated scores): https://platform.openai.com/docs/guides/moderation
- OpenAI moderation API reference (request/response shape, snapshot list): https://platform.openai.com/docs/api-reference/moderations/create
- OpenAI moderation pricing confirmation (free, does not count toward monthly usage limits, verified May 2026): OpenAI Help Center, "Is the Moderation endpoint free to use?"
- Multimodal moderation upgrade announcement (GPT-4o-based, image categories, calibrated scores, multilingual improvement): https://openai.com/index/upgrading-the-moderation-api-with-our-new-multimodal-moderation-model/
- PhotoDNA service overview (Microsoft, CSAM hash matching, qualified-online-service-provider onboarding): https://www.microsoft.com/en-us/photodna
- Stripe idempotency contract (24-hour TTL, completed-response replay): https://docs.stripe.com/api/idempotent_requests
- ADR-0007 (Observability — Sentry alarm 4 catalogue entry)
- ADR-0013 (Concurrency & bet transaction — idempotency-first ordering, moderation-outside-transaction)
- SPEC.1 §14 (Moderation product contract)
- SPEC.1 §14 Appendix A (AI category-to-track mapping)
- SPEC.2 §10 (Pre-Commit Moderation Contract — absorbed by this ADR)

---

*ADR-0014 ratifies the pre-commit moderation flow as: OpenAI `omni-moderation-latest` (snapshot `omni-moderation-2024-09-26`) for text and multimodal classification, PhotoDNA-or-equivalent for CSAM hash matching, called in parallel before the bet+comment Postgres transaction opens, guarded by a 10-second Redis SETNX intent-reservation key on `(user_id, market_id, idempotency_key)`, with one retry on transient upstream failure (3-second timeout per attempt) and fail-closed on terminal failure. F-MOD-4 atomicity is preserved structurally — on Track A or Track B verdict, the bet+comment transaction never opens. Track A degrades to flag-only mode if HARDEN.5 sample-content testing surfaces unacceptably high false-positive rates; CSAM auto-report (legal floor) is unaffected by the degrade. The decision body and any constraints minted in §1–§8 are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
