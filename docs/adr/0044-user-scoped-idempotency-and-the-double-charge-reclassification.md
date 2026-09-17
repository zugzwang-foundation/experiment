# ADR-0044 — User-scoped idempotency keys, and the double-charge reclassification

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-08-27 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | S-7 |
| **Frame document** | `ZUGZWANG_S-7_BRIEF_v2_0.md` + `ZUGZWANG_S-7_BRIEF_v2_0_ADDENDUM-A.md`; `docs/plans/S-7.md` |
| **Supersedes** | ADR-0031, partial — only the "receipt keyed by `idempotency_key` alone" risk-acceptance bullet (§ Reviewer notes). The rest of ADR-0031 (the receipt table, the terminal-error-mapping contract) stands unamended. |
| **Superseded-by** | — |
| **Amends** | — |
| **Amended-by** | ADR-0054 — the §Consequences/Negative bullet accepting the transaction-reaching cross-user collision as *"bounded by the existing `bet-ip` rate limit"*. That bound moved: the bet write cap is re-keyed to the account, and `bet-ip` is demoted to a 10x backstop. ⚠ **Read that mitigation as: one machine driving MANY accounts is now bounded at 300/min rather than 30/min, while the same machine on ONE account is unchanged at 30/min and the previously-unbounded many-machine case gains a per-account bound it never had.** ADR-0054 §"The ADR-0044 bound" carries the full three-row table and the argument for accepting the middle row. The decision this ADR makes is untouched; only this mitigation's strength moves. |

**This ADR does not decide:** `PENDING_TTL_SECONDS`'s value (parked for S-5's load run — ADR-0038 forbids acting on an unmeasured number); same-user cross-*endpoint* confusion, i.e. one key reused across `place` and `sell` (the flow axis — `docs/parked.md` D-8 stays open on this point, amended not discharged, below); ADR-0013's lock order, isolation level, or retry budget; whether to add a `noCache` escape to the thrown error channel (DC-b, deferred — reason below).

## Context and Problem Statement

Two findings surfaced together at the same repair site — `case "hit"` in `runBetEndpoint` (`src/server/bets/endpoint.ts`) — because RECON-2 found they overlap line-for-line (S7-11):

**G2 — the idempotency guard never asks whose key it is.** Three arms are keyed on `idempotency_key` alone, with no user term: the Redis cache (`getRedisKey("idem", key)`), the durable-receipt read (`loadDurableReplay`'s `WHERE idempotency_key = $1`), and both Postgres uniques (`bets_idempotency_key_idx`, `bet_receipts_idempotency_key_uq`). `docs/parked.md` D-8 named this in 2026-08-21 and refuted a *cross-user* attack on client-side grounds only (122-bit UUIDv4 entropy) — a control the server does not run and cannot check. This ADR closes the server-side gap D-8 left open.

**DC — a caching asymmetry that RECON-2 believed produced a double charge.** The endpoint's thrown-error channel caches any response under HTTP 500 with a bare `wire.status < 500` test, with no `noCache` escape (unlike the inner-result channel, which honours one). RECON-2 named `ModerationInFlightError` as the transient error that could ride this into the cache and later mask a bet that actually committed. Two independent traces — the plan-chat P-0 pass (via TTL-nesting: the idempotency sentinel's 30s TTL always outlives the moderation reservation's 10s TTL, so no second request can ever observe a stale reservation) and the Gate-7 web-review DC-TRACE (via a stronger, general argument, R-D below) — both close this window **for `ModerationInFlightError` specifically, and for any single request's own cached error against that same request's own commit.** RECON-2's named mechanism does not exist as a live defect. **A narrower, cross-request residual does exist** (a later request's cached rejection can outlive an earlier, different request's receipt under the same key, if a Redis eviction and a durable-pre-check outage happen to align) — caught by security audit after this ADR's first draft claimed the reclassification closed the question entirely; see the DC section below for the mechanism and the reinstated defense.

## Decision Drivers

1. **No live-reachable cross-user attack exists today** (client-side UUIDv4 entropy), but the property holding two participants apart lives entirely in code the server does not run — an unenforced invariant, not a proven-safe one.
2. **No migration on the money path inside a window with no schedule buffer.** The 10 Sep precursor freeze leaves no room for a destructive-adjacent change (re-qualifying a live unique index) that RECON-2 Q1 shows isn't urgently needed.
3. **A CI-enforced invariant is the right proof for what a single request can be shown not to do.** `I-IDEM-NOMASK-001` proves, once at merge time and re-checked on every future change, that no single request's own cached error can coexist with that same request's own commit — the property R-D actually established.
4. **A cross-request property needs a runtime control, not just a test.** Whether a LATER request's cached rejection can sit beside an EARLIER, different request's receipt is not something a single-request CI test can observe — closing that gap (security-audit MEDIUM, caught before merge) needs DC-a's read at `case "hit"`, not a stronger assertion in the test.
5. **Minimal `src/` delta, symmetry with the existing moderation-reservation precedent.** `precommitModerate`'s reservation key (`{env}:mod-reserve:{userId}:{marketId}:{idempotencyKey}`) already demonstrates the exact shape the idempotency key needs.

## Considered Options

**For G2 (cross-user scoping):**
1. **Design B — scope the reads, no DDL** ← chosen. Three call-site changes: the Redis key, `loadDurableReplay`'s `WHERE`, and the 23505-catch outcome. Zero migration.
2. Design A — re-qualify both Postgres uniques to `(user_id, idempotency_key)`. Rejected for this stratum; recorded below as the named testnet successor.

**For DC (the caching asymmetry):**
1. **DC-a (consult the durable receipt on a cached-non-2xx `hit`) plus an invariant test for the single-request property** ← chosen. Revised mid-stratum: DC-a was first dropped on R-D's claim that it could never fire, then reinstated when security audit showed that claim was scoped to one request and missed the cross-request case DC-a actually catches.
2. Drop DC-a; rely on the invariant test alone. Rejected — the invariant test cannot observe the cross-request property, so this option leaves the cross-request gap with no control at all.
3. Do nothing (leave the asymmetry undocumented). Rejected.

## Decision Outcome

**Chosen: Design B for G2; DC-a reinstated at `case "hit"` plus the single-request invariant test.**

### G2 — three changes, zero migration

1. `getRedisKey("idem", key)` → `getRedisKey("idem", userId, key)` in `src/server/idempotency/cache.ts`. `idempotencyLookupOrReserve` gains a `userId` parameter; its one caller (`runBetEndpoint`) already holds `session.user.id` from the auth step, well before the idempotency lookup.
2. `loadDurableReplay` (`src/server/bets/replay.ts`) gains `userId` in its args and its `WHERE` clause. Both call sites — the endpoint's pre-check and each route's post-tx 23505 catch — already hold it via the same request context.
3. The 23505-catch arm in `src/app/api/bets/{place,sell}/route.ts` learns a new outcome, and `loadDurableReplay`'s return type grows a fourth arm to make it expressible: `replay` (200, unchanged), `mismatch` (409 `error_idempotency_key_reused`, `noCache: true`, unchanged), `unavailable` (the durable SELECT itself threw — rethrow the original error into the ordinary uncached-500 path, unchanged from today), and `null` — no receipt for *this* user (the new case: a genuine cross-user collision, or rarely on staging a pre-migration-0022 committed bet with no receipt) — which gets the *same* 409/`noCache: true` as `mismatch`, plus a distinguishing `safeCaptureException` alarm, since it is the one condition this ADR exists to handle and must never be silent. **Caught in code review, before merge:** an earlier draft of this arm conflated `unavailable` with `null`, which would have reported a transient DB hiccup as "this key belongs to someone else" — a client-visible regression, since the shipped client (`src/components/debate/composer/`) treats `error_internal` as retry-with-same-key but `error_idempotency_key_reused` as abandon-the-key-after-refresh. `DurableReplay`'s `unavailable` arm and the guard test `cross-user-idempotency::durable-precheck-outage-on-post-tx-catch-is-uncached-500-not-409` exist specifically to keep this distinction from regressing.

The two Postgres uniques are untouched. Design A is recorded as the named testnet successor: re-qualifying `bets_idempotency_key_idx` and `bet_receipts_idempotency_key_uq` to `(user_id, idempotency_key)` is the correct eventual hardening, deferred because RECON-2 Q1 found no live-reachable attack to justify DDL on the ledger inside a freeze window with no buffer.

**Namespace invariant, asserted rather than assumed.** After G2 the idempotency tuple is `{userId, key}`; the moderation-reservation tuple remains `{userId, marketId, key}`. `{userId, key} ⊂ {userId, marketId, key}` still holds — the idempotency gate remains the coarser one and still fires first. The one real change: the first segment after the namespace was client-supplied before G2 and is server-supplied (`session.user.id`) after — a client can no longer address another user's slot at all, which is the entire point.

### DC — reclassified LOW/latent WITHIN one request; DC-a reinstated for the cross-request residual

**The single-request reachability chain does not close.** `precommitModerate`'s reservation `DEL` is a bare `finally` — it runs on every throw inside the `try` (an OpenAI timeout, a bad image-key shape, a `signRead` failure, an unforeseen error), not only on the happy path. So the one candidate transient error, `ModerationInFlightError`, cannot be produced by an orphaned reservation: the owning request's own `finally` clears it immediately, and the TTL-nesting argument closes the same window independently (the idempotency sentinel always outlives the reservation, so a same-key retry is turned away at the coarser idempotency gate for the reservation's entire possible lifetime).

**R-D generalizes this to every cached error a SINGLE request can produce, not just `ModerationInFlightError`.** Enumerated exhaustively, every cached non-2xx a given request can write corresponds to a state where THAT request's own `runBetTransaction` either never opened (rate-limit, durable-mismatch, validation/floor/comment/reply/image rejections, `ModerationInFlightError`) or rolled back (a product-level oversell rejection, the post-rollback 23505-mismatch 409). The route's own success path is a plain object literal that cannot throw, and the finally block that would release the idempotency sentinel is itself guarded so it can never override an already-built response. **A cached error can never mask the SAME request's own commit.**

**⚠ CORRECTED (security-audit MEDIUM, caught before merge): R-D's enumeration is scoped to one request and does not close the question DC was originally asked.** The double-charge hazard is a CACHED response outliving the request that wrote it, under a key a LATER, DIFFERENT request also uses. R-D says nothing about that case, and there is a real bridge to it: `loadDurableReplay`'s fail-open (3a's `unavailable`, required so a genuinely fresh key doesn't 409 on its first use) means a request's own durable pre-check can be blind to an EARLIER request's already-committed receipt. Concrete sequence, one user, one key, two requests: request 1 commits (receipt written, Redis promoted to a completed 200); Redis later loses that entry (eviction, not a full Upstash outage — a full outage fails `idempotencyLookupOrReserve` CLOSED to 503, upstream of all of this); request 2 gets a `miss`, its OWN pre-check is independently blind at that exact moment, falls through to normal execution (as 3a requires), and terminates in a genuinely-cached pre-tx rejection (a 429, or a moderation block) — leaving a cached non-2xx sitting beside request 1's real, unrelated-to-request-2 receipt under the same key. A third request hitting `case "hit"` would, under R-D's claim alone, be answered the stale rejection verbatim for up to 24h — while the client's own reducer (`keyOutcomeFor` → `fresh_on_enable` / `fresh_on_edit`) mints a fresh key and resubmits, producing a second commit. **This is pre-existing** (identical before G2 — the pre-check's fail-open behaved the same way) and **not attacker-inducible** (it requires two independent infra failures to align, not anything a request can force), but it is real, and citing R-D as though it forecloses it — which the original text of this ADR did — is itself the defect CLAUDE.md O-3 names: *a correct refusal reported with a misleading cause.*

**DC-a is reinstated, not dropped.** `case "hit"` (`src/server/bets/endpoint.ts`), when the cached response is non-2xx, now consults the durable receipt (by `(user_id, idempotency_key)`) before trusting the cache; a matching receipt returns the original 200 instead of the stale error. This is exactly the control that catches the sequence above, and it is not dead code — R-D's proof that it could never fire was itself the error. Cost: one extra DB read, only on a cached-non-2xx `hit`, only for the two or three requests following a rejection under a key (not on every request, and never on a cached 2xx).

**`I-IDEM-NOMASK-001` is restated to the scope it actually proves.** The invariant holds WITHIN one request's own transaction lifecycle (which is what its five parameterized classes exercise) — it does not, and cannot from a single-request harness, prove the cross-request property, which is what DC-a defends at runtime instead. The test stays as a CI regression guard on the single-request property (still valuable: it would catch a future code path that caches a non-2xx `after` that same request's own commit); the cross-request residual is DC-a's job, guarded by its own dedicated regression test (`cross-user-idempotency::case-hit-consults-receipt-before-trusting-a-stale-cached-rejection`), which forces exactly the two-failure alignment above and asserts a third request recovers the original 200.

**DC-b (a `noCache` escape on the thrown channel) is deferred**, on the correct ground: the thrown channel is *structurally* missing the `noCache` field that the inner-result channel has, so any *future* transient 4xx routed through the thrown channel would inherit this defect silently. It is deferred because nothing reaches it today, not because `ModerationInFlightError` specifically cannot fire — a distinction worth recording precisely, since a wrong reason in an ADR outlives a deferred fix. DC-a's reinstatement does not change this: DC-a defends the READ side (`case "hit"`) regardless of how a stale entry arrived; DC-b would additionally control the WRITE side.

**No D-3 demonstration of the single-request property was built.** Constructing one would require writing the precondition directly into Redis, which is not a demonstration of the shipped artifact (V-1) — it would prove a lookalike, not the code. The cross-request property IS demonstrated — that is what DC-a's own regression test does, without fabricating Redis state (it forces the two real fail-open/eviction conditions through the actual code paths that produce them).

### The premise contradiction, and its mitigation, stated together

ADR-0031 accepts its (now-superseded, above) risk on the premise that the idempotency key is "gated by the unguessable client-generated key." SPEC.2 Appendix B ratifies *publishing* that same key: row B.5 (`bets.idempotency_key`) is `SHIP`, and B.13 (`events.metadata.idempotency_key`) is `SHIP_KEY` — both canonical, both correct on their own terms (the key carries no PII, which is the question B.5 actually answers), and both silently contradicting a premise that treats the key as a capability rather than an identifier. **The mitigation:** the conclusion-freeze gate sits at `runBetEndpoint` step 1.5 (`src/server/bets/endpoint.ts:196-203`), strictly *before* step 2's key validation and step 3's cache lookup. The freeze is 2026-11-05 23:59 UTC; the dataset publishes 2026-11-06. Every request arriving after the freeze 410s before the idempotency machinery is ever reached — so a published key cannot be replayed against anything, live or post-hoc. **Publication retires the premise's justification, not its safety.** No dataset change follows from this ADR.

### Amendment to ADR-0031's terminal error-mapping table

Row 13 of ADR-0031's table (§ Decision Outcome) gains a new sub-case: a 23505 on the durable-idempotency constraints where the (now user-scoped) receipt read finds no row belonging to the current user. This was previously indistinguishable from row 13's "unknown 23505" bug class and rethrown as an uncached 500; it now maps to `409 error_idempotency_key_reused`, cached `NO` (poison guard), same as row 4. **Client impact:** any client that previously received an uncached 500 on this specific path (a cross-user key collision on the durable layer) now receives a 409 instead. Both are error responses a contract-following client already retries or surfaces; no client depends on the specific 500 today (the surface has zero live users pre-launch).

### Same-commit SPEC.2 updates

- §11's scoping sentence — "global — matched on the key value alone, regardless of HTTP method or path" — is amended to state the key is scoped to `(user_id, key)` as of this ADR; cross-endpoint (flow) scoping remains out of scope (`docs/parked.md` D-8, amended below).
- §11's stale Server-Action / natural-key sentence (naming `placeDirectComment`, `placeReply`, `placeImageComment` and a `(user_id, market_id, body_hash, posted_at_minute)` natural key) is corrected: none of these exist in `src/`. Comment-bearing bets travel the Route Handler with an `Idempotency-Key` header like every other bet. The sentence is dangerous because it makes a reader believe a user-scoped protection already exists via a different mechanism than the one this ADR actually ships.

  ⚠ **The same false claim also appears at three more sites in SPEC.2** — §4.2's "Fourteen Server Actions" intro paragraph, its `placeDirectComment` table row, and Appendix A's `src/server/comments/place.ts` file-map row — none touched by this ADR. Fixing one of four sites stating the same wrong thing would leave the document self-contradicting; the other three are named here and routed to the AMEND lane (expanding S7-12) rather than silently left, and rather than pulled into this ADR's scope, which is idempotency scoping, not a Server-Actions inventory sweep.

### `docs/parked.md` D-8

Amended, not discharged. See the amendment landed in the same commit: Design B discharges D-8's *deferral reason* (the simultaneous migration-plus-Redis-reshape on the money path) but not D-8's underlying *defect* on the flow axis — the same-user cross-endpoint (place/sell) confusion is untouched by this ADR and stays open.

## Consequences

### Positive

- The cross-user idempotency gap is closed server-side; a client can no longer address another user's cache slot, durable receipt, or (via the existing moderation-reservation precedent it now mirrors) reservation.
- The caching-asymmetry hazard RECON-2 found is documented and permanently guarded by a CI test rather than left as an unstated risk.
- Zero migration, zero DDL, inside a freeze window with no schedule slack.
- The uncached-500 case on a cross-user durable-receipt collision becomes a clean, cached 409 — one fewer unlearnable failure mode on the money path.

### Negative

- The two Postgres uniques remain globally unqualified on `idempotency_key` alone. *Mitigated by:* no live-reachable attack exists (RECON-2 Q1); Design A is the named, deferred successor for testnet.
- **Net-new cost of the refusal being correct:** because the Redis and durable reads are now user-scoped, a colliding second request no longer gets turned away at either of those two arms — it *reaches the transaction* before the still-global unique refuses it. For `place` that is a real moderation call plus a full SERIALIZABLE attempt (holding `FOR NO KEY UPDATE` on the pool row) before rollback; for `sell` the entire unwind executes and rolls back only at the final receipt insert, since sell writes no `bets` row. *Accepted:* bounded by the existing `bet-ip` rate limit; this work did not happen pre-G2 and is the price of B receiving a refusal instead of A's payload.
- Same-user cross-endpoint (flow) confusion remains reachable. *Accepted:* out of scope for this stratum; `docs/parked.md` D-8 stays open on this point, explicitly, rather than being silently closed by this ADR landing.
- `I-IDEM-NOMASK-001` cannot detect a *newly introduced* throw between commit and response if that throw is itself never wired into `toWireError`'s `< 500` branch — i.e., it guards the caching expression, not every conceivable future code path. *Mitigated by:* the test is parameterized per error class and will need a new parameter (not a rewrite) whenever a new cached error class is added, keeping the guard's maintenance burden visible at the point of change.

### Neutral

- `PENDING_TTL_SECONDS` and `RESERVATION_TTL_SECONDS` are unchanged; their relative sizing (30s > 10s) is now load-bearing to this ADR's DC reasoning as a secondary, independent closure of the same window — recorded so S-5's future tuning pass reads this ADR before touching either value.

## Pros and Cons of the Options

### G2 — Design B (chosen)

**Pros:** zero migration inside a frozen window; mirrors an existing, reviewed precedent (`precommitModerate`'s reservation key); the 23505-catch addition is a strict widening of an existing branch, not new control flow.

**Cons:** the durable uniques stay global, so a colliding second request now reaches the transaction before being refused, rather than being turned away earlier — see the net-new cost recorded under Negative consequences below. (Not nondeterminism: `bet_receipts_idempotency_key_uq` is a UNIQUE on `idempotency_key` alone, so at most one row can ever exist per key regardless of user — the `.limit(1)` read has nothing to pick between. That ambiguity is specific to Design A's proposed `(user_id, idempotency_key)` unique, where two rows could share a bare `idempotency_key` across users, and is exactly why the read direction there would need an explicit tie-break; it is not a property of what ships here.)

### G2 — Design A

**Pros:** closes the gap at the storage layer, the strongest possible guarantee.

**Cons:** requires a migration (re-qualifying two live unique indexes) on the money path, inside a window with no buffer, to close a gap with no demonstrated live exploit. **Verdict:** rejected for this stratum; named testnet successor.

### DC — DC-a reinstated + the single-request invariant test (chosen)

**Pros:** the test proves the single-request property once, at CI, and fails loudly on any future regression to it, at no runtime cost; DC-a is the one control that reaches the property a single-request test structurally cannot observe (a stale cached rejection sitting beside an EARLIER, different request's receipt), at a bounded cost (one extra read, only on a cached-non-2xx `hit`).

**Cons:** DC-a is a database read on the money path on every cached-error `hit` — not free, though far short of "every request." **Acceptable because:** the alternative (dropping it) leaves the cross-request bridge with no control at all, and the bridge is real, even if rare and not attacker-inducible.

### DC — invariant test alone, no DC-a

**Cons:** this was S-7's first decision, made on R-D's claim that DC-a could never fire. Security audit showed the claim was scoped to a single request; a cross-request sequence (an earlier commit's receipt, a later request's blind pre-check, a cached rejection under the same key) reaches exactly the case DC-a defends and the test cannot see. **Verdict:** rejected — corrected before merge, not shipped.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.2 §11 | Idempotency scoping | Shapes: narrows "global" to `(user_id, key)`; cross-endpoint scoping remains out of scope. |
| ADR-0015 D4 | Redis key axis | Consumes: D4 decided `key` vs `(method, path, key)`; neither contained a user term, so it never decided this axis. Not superseded by this ADR — it remains correct about what it decided. |
| ADR-0031 (Reviewer notes) | Receipt scoping risk-acceptance | Supersedes: the "unguessable client-generated key" premise is a client convention, not a server property (the key regex accepts a single character); the original acceptance weighed only the read/disclosure direction, never the write/pre-emption direction. |
| ADR-0031 (error-mapping table, row 13) | 23505 sub-case | Shapes: a cross-user durable-receipt collision no longer falls into the "unknown 23505" bug class; it maps to the existing row-4 409. |
| `docs/parked.md` D-8 | Cross-user + flow scoping | Consumes / amends: discharges the deferral reason, not the defect; the flow axis is named as deliberately remaining. |
| SPEC.2 Appendix B (B.5/B.13) | Key publication | Consumes, unchanged: the freeze gate at `runBetEndpoint` step 1.5 precedes key validation and the cache lookup, so a published key (post 2026-11-06) cannot be replayed against anything. No dataset change. |
| Tracker | S-7 | Depends on this ADR being `accepted` for close-out. |

## More Information

- `ZUGZWANG_S-7_BRIEF_v2_0.md`, `ZUGZWANG_S-7_BRIEF_v2_0_ADDENDUM-A.md`, `docs/plans/S-7.md` — the full recon, ruling, and plan trail this ADR summarizes.
- ADR-0015 (rate-limit/idempotency foundations), ADR-0031 (durable receipts + terminal error mapping) — the two prior decisions this ADR builds on and partially amends.

---

*ADR-0044 ratifies user-scoped idempotency reads (Design B: Redis key, durable-receipt read, and the 23505-catch outcome all gain `userId`, with zero migration); reclassifies the double-charge finding as not reachable WITHIN a single request, CI-enforced via `I-IDEM-NOMASK-001`; and reinstates DC-a (a durable-receipt consult on `case "hit"`'s cached non-2xx responses) to defend the cross-request residual that reclassification's own proof (R-D) had missed, caught by security audit before merge. The decision body is immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
