# RELAY B2 — The two money-path wall-clock bounds (PLAN-ONLY deliverable)

## Context

`ADR-0038` P1 identified a real gap: under the transaction-mode pooler, a bet queues for a backend *before* one exists, upstream of every timeout this codebase currently sets (`SET LOCAL statement_timeout`/`idle_in_transaction_session_timeout` both fire only after a backend is assigned). `ADR-0044` separately parked `PENDING_TTL_SECONDS`'s re-derivation for S-5, because its own double-charge (DC) closure argument depends on `PENDING_TTL_SECONDS` (30s) staying strictly greater than `RESERVATION_TTL_SECONDS` (10s) — moving either number carelessly could reopen a closed correctness argument, not just a performance one.

Both are named as Stage-0 exit criteria in `docs/scale/S-5-LOAD-PLAN.md` (B-1, B-2), and this relay is explicitly **plan-mode only**: *"This session writes NO code and opens NO PR. It produces a plan for web review and founder ratification. A fresh chat executes it afterwards."* That's not a restriction added here — `docs/plans/S-3.md` independently fenced this exact file for this exact reason: *"⛔ Do not open `src/db/index.ts` — including `connect_timeout`, still unpinned (S3-4)."* Two prior strata agree this needs its own gated pass. This document is that pass's planning output — nothing here was executed in the session that produced it.

---

## Deliverable 1 — `PENDING_TTL_SECONDS` re-derivation (a document, not a new number)

**The current derivation is dead.** The `30` comes from `docs/adr/0015-rate-limit-idempotency.md`: *"10-second moderation reservation worst case + bet-transaction worst case (3 retries × ~200ms = ~600ms upper bound) + ample slack."* That `~600ms` is the ADR-0013 SERIALIZABLE retry budget *inside* a transaction that already has a backend — it has no term for queue-wait *before* backend assignment, which is exactly the quantity `:6543` transaction mode introduces and `:5432` session mode never had (session mode failed fast with `EMAXCONNSESSION` instead of queuing).

**What must NOT move without care:** `PENDING_TTL_SECONDS > RESERVATION_TTL_SECONDS` (currently 30 > 10) is independently load-bearing to `ADR-0044`'s TTL-nesting closure of the double-charge window — *"the idempotency sentinel's TTL always outlives the moderation reservation's TTL, so no second request can ever observe a stale reservation."* Any re-derivation must preserve this inequality, or `ADR-0044`'s DC argument needs re-opening alongside it, which is a bigger and separate decision.

**Per `ADR-0038` decision 2 ("sizing from measurement, never estimate"), this document produces the derivation *method*, not a replacement number.** The actual value is Stage 6's to set, from the observed bet worst-case under real load — this is Stage 0's job only insofar as it makes that later measurement meaningful rather than inherited-and-forgotten.

**The corrected formula:**
```
PENDING_TTL_SECONDS  >  queue-wait-for-backend-checkout (unmeasured, Stage 3/6's to produce)
                       + in-transaction retry budget (~600ms, ADR-0013, unchanged — still real)
                       + moderation reservation worst case (10s, RESERVATION_TTL_SECONDS, unchanged)
                       + slack
```
The old formula silently assumed the first term was zero, which was true under `:5432` (immediate assignment or fast failure) and is not true under `:6543`. **Until the queue-wait term is measured, 30 stays as a floor, not a ceiling** — it is not known to be sufficient, only known to have been sufficient under a pooler mode this app no longer runs on staging.

**Exit condition for this item, restated precisely:** Stage 6 measures the real bet-wall-clock distribution under load; `PENDING_TTL_SECONDS`'s new value is `max(observed p99 bet wall-clock, current 30) + slack`, re-checked against the `> RESERVATION_TTL_SECONDS` constraint before it ships. If Stage 6 shows queue-wait is negligible in practice, 30 may stand — but that becomes a measured conclusion instead of an inherited assumption, which is the entire point of doing this.

---

## Deliverable 2 — `connect_timeout` pinning plan (a real value, with its derivation)

**What `connect_timeout` actually bounds, precisely, per `postgres.js`'s own semantics:** the initial TCP handshake when the pool opens a *new* connection to Supavisor (up to `max: 4` times per instance — not per request, since the socket is then held per `idle_timeout`/`max_lifetime`). **What it does NOT bound:** the queue-wait for an actual Postgres backend once that socket is established — under transaction mode, Supavisor multiplexes backend assignment *behind* an already-open client socket, invisibly to this setting. `ADR-0038` P1 already states this precisely and warns against mistaking a `connect_timeout` pin for a fix to the queue-wait gap — it is not; it is a narrower, still-worth-having control for a different failure mode (a genuinely dead/unreachable Supavisor endpoint).

**Current state:** unset, meaning `postgres.js`'s own vendor default applies — **30 seconds** (per `docs/logs/S-1-close.md` finding M-C). This is the same failure shape this file's own `max_lifetime` docblock already named and rejected once: *"a vendored default silently disarmed a control."* An explicit pin, even at a similar value, converts an inherited default into a stated decision someone can find, question, and change on purpose.

**Derived value: 10 seconds.**
- Failure mode being protected against: a genuinely unreachable Supavisor endpoint (DNS failure, network partition, Supavisor itself down) — this should fail fast and loudly, not hang for 30s consuming a slot in whatever's waiting on `max: 4`'s pool to hand back a connection attempt.
- 10s is roughly 3× a normal TCP+TLS handshake's worst-case tail under ordinary network jitter (sub-second in the common case, per the region co-location work already measured elsewhere in this repo — 5.34ms round trip warm, so a cold TCP+TLS handshake in the same region should be well under a second), leaving real margin before treating a slow-but-alive endpoint as dead.
- It is **not** derived from a load measurement, because it doesn't need to be — it bounds a rare, per-new-connection event (socket establishment), not the per-request hot path `ADR-0038` decision 2 is protecting from premature tuning. `docs/scale/S-5-LOAD-PLAN.md`'s own Stage-0 exit criterion for this item is *"pinned, with its derivation in the comment"* — a real number, unlike Deliverable 1.

**Where it goes, matching this file's own documented style exactly** (name mechanism, cite the measured incident this repo already has for `max_lifetime`, flag what it does not protect against, name the authorizing ADR):

```ts
	max: 4,
	prepare: false,
	idle_timeout: 20,
	max_lifetime: 600,
	// connect_timeout (s) — bounds ONLY the initial TCP+TLS handshake when the
	// pool opens a NEW connection (up to `max: 4` times per instance), never
	// the post-connect queue-wait for an actual Postgres backend under
	// Supavisor's transaction-mode multiplexing (ADR-0038 P1 — that gap is
	// separate and still open, S-5's to close). Unset previously meant
	// inheriting postgres.js's own 30s default silently — the same failure
	// shape max_lifetime's own docblock above already named once. Pinned
	// explicitly at 10s: ~3× a normal same-region TCP+TLS handshake's tail
	// (region co-location measures warm round trips at ~5ms), enough margin
	// to not mistake a slow-but-alive endpoint for a dead one, short enough
	// to fail loud rather than hang a `max: 4` slot on a genuinely
	// unreachable Supavisor. RELAY B2 / docs/scale/S-5-LOAD-PLAN.md Stage 0
	// B-2.
	connect_timeout: 10,
```

**Blast radius:** touches every environment this client connects from (preview, staging; production stays on session mode / `:5432` per `ADR-0038` §5, unaffected in *mode* but this same client file serves it too — the pin applies there as well, and is equally correct there: a dead endpoint should fail in 10s under session mode too). No behavior change on a healthy connection — the pin only fires when a handshake would otherwise hang past 10s, which never happens today.

**Rollback:** delete the one line. No migration, no data implication, no state to unwind.

**The test that proves the pin took effect:** point `DATABASE_URL` at an unroutable address (e.g. a reserved-for-documentation IP, `192.0.2.1`, per RFC 5737 — guaranteed to black-hole rather than refuse, which is what actually exercises a *timeout* rather than an instant connection-refused) and assert the client throws within ~10-11s, not ~30-31s. This is a real, cheap, deterministic integration test — no live infra needed beyond an address guaranteed not to answer.

---

## Deliverable 3 — the armed abort, specified for the rig (not built here — this is the spec Shourav's A2 rig implements)

**Abort condition:** any single bet's observed wall-clock (request start → response, from the k6 rig's own per-request record) exceeds `0.5 × PENDING_TTL_SECONDS`'s *current* value (i.e., 15s against today's unmoved 30s) during any write-load stage.

**How the rig observes it:** the per-request record schema already specified in A2 (`URL · status · wall clock · limiter decision · canary SHA · pooler mode · offered rate step`) already carries wall-clock per request — the abort is a threshold check on that same field, not new instrumentation.

**What it captures at the moment of abort, so the abort is itself evidence:** the triggering request's full record, plus a `sample-backend-activity.ts` snapshot taken immediately (same JSONL mechanism already proven this session) — correlated via the sampler's own clock-offset field, never an assumed shared clock, matching the standing rule this whole programme uses everywhere else.

**Why `0.5×` and not `1×`:** the abort exists to catch the failure mode *before* it fully manifests as the unbounded hang `ADR-0038` P1 describes — tripping at half the sentinel's own lifetime leaves room to abort, capture evidence, and stop the run before a request could plausibly still be legitimately in-flight versus genuinely stuck.

---

## What this plan explicitly does not do

- Does not touch `src/db/index.ts` or any other file — Deliverable 2's code block above is the *specification* for a fresh session to apply, not an edit made here.
- Does not choose `PENDING_TTL_SECONDS`'s new numeric value — that's Stage 6's, from measurement, per `ADR-0038` decision 2.
- Does not build the rig's abort mechanism — that's A2's implementation, this is its spec.
- This document itself is the deliverable. Per B2's own instruction, it goes to web review, then founder ratification, then a **fresh chat** executes Deliverable 2's code change (the only one of the three with actual code attached) — never this session, matching `docs/plans/S-3.md`'s standing fence on this exact file.

## Verification (for the fresh session that eventually executes Deliverable 2)

1. `just verify` after the one-line addition — no other change, should be a no-op on typecheck/biome/build.
2. The unroutable-address timeout test described above, both before (confirms it currently takes ~30s, proving the vendor default was live) and after (confirms ~10s) the pin — a real before/after, not just a code diff.
3. Confirm no existing test asserted or depended on the unset/30s default anywhere (`grep -r "connect_timeout" tests/` — currently zero hits, so this is a clean addition, not a behavior change to anything under test today).
