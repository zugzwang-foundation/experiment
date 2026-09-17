# ADR-0054 — The Bet Write Cap Belongs to the Account, Not the Address

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-17 |
| **Deciders** | Hrishikesh M. H. |
| **Tracker task** | HARDEN — production load-test remediation, fix 4 |
| **Frame document** | SPEC.2 §11 (per-surface rate-limit table), SPEC.2 §4.6 (rate-limit class per surface), SPEC.1 §8 + §16.1 |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | ADR-0015 — D7's `BET_ATTEMPTS_PER_IP_PER_MIN` stays minted and keeps its name; what moves is which control the number expresses, and the addition of a second bet surface beside it · ADR-0044 — its accepted mitigation *"bounded by the existing `bet-ip` rate limit"* moves; see §"The ADR-0044 bound" below |
| **Amended-by** | — |

---

## Context and Problem Statement

Every write a participant makes — a bet, a post, a reply, a sell — passes through
`runBetEndpoint`, and until this ADR all four were counted against **one budget keyed on
the client IP address**: `bet-ip`, thirty requests per minute. SPEC.2 §11 did not arrive
at that by default; it argued for it, in a sentence this ADR has to answer rather than
quietly delete:

> Bet placement and image-PUT-URL surfaces use **per-IP** identifiers because the threat
> model is credential-stuffed bot traffic across many compromised accounts; per-user
> limits only fire after a successful login and are the wrong defense surface.

**That argument is sound about a threat and wrong about a budget, and the conflation is
the defect.** It reasons only about the *attacker*, for whom an address is indeed the
better key, and never about the *participant*, for whom it is a proxy so lossy that the
control stops describing anything the product means. A bet endpoint is **unreachable
without a session** — step 1 of the handler stack returns `error_session_required` before
any limiter is consulted — so the premise that a per-user limit "only fires after a
successful login" describes the only population the endpoint ever serves. There is no
pre-login bet traffic for a per-IP cap to be protecting.

What the single key actually produced:

- **It bills one person's writes to everyone beside them.** Thirty per minute is shared by
  every participant behind one address: an office, a campus, a hall, a carrier's CGNAT, a
  shared VPN egress. The thirty-first reader is refused because of thirty strangers, and
  the refusal names no reason they can see or act on. On a product whose thesis is that
  argument is mandatory, the control silences the room to cap the individual.
- **It is evaded by the attacker it was written for.** The credential-stuffed bot that
  §11 names is the one actor who rotates addresses freely; the per-IP cap costs it a proxy
  and costs a shared office its whole budget. The control lands hardest on precisely whom
  it was not aimed at.
- **It was measured, not theorised.** The 2026-09 production load-test campaign reached
  `error_rate_limit_exceeded` on a single-machine run long before the server was the
  constraint, which is what put this in front of us: the limiter was answering a question
  about the load generator's address instead of about anybody's conduct.

The fix is not to remove the address from the picture — §11's threat is real and stays
answered. It is to **stop asking one key to be two controls**: the account carries the
fairness budget, and the address keeps a loose abuse backstop behind it.

This ADR does **not** decide:

- The numeric values themselves; both constants remain HARDEN.5 placeholders (SPEC.1 §16.1).
- How the client IP is derived — the leftmost `x-forwarded-for` token is spoofable and its
  repair is the seven-call-site sweep docketed in `docs/parked.md`. This ADR moves the
  *weight* off that value, which reduces the blast radius of that defect but does not close it.
- Rate limits on any other surface (ADR-0015 D6/D7 continue to govern all five).
- The per-market productive cap on reply-bets, still deferred to HARDEN.6 (SPEC.2 §11).
- The fail-open posture, unchanged and reaffirmed (ADR-0006, ADR-0015).

## Decision Drivers

1. **A budget must be keyed on the thing the product charges.** Dharma, positions,
   comments and the daily credit are all per account; the write cap was the one control
   keyed on something else.
2. **A shared address must not make one participant's conduct another's refusal.**
3. **The credential-stuffing threat of SPEC.2 §11 stays answered** — narrowing the fairness
   key must not delete the abuse ceiling.
4. **Fail-open is not negotiable** (ADR-0006 §"Failure-mode profile"): an Upstash outage
   admits writes; it never blocks participation.
5. **No extra latency on the write path.** This work came out of a load-test campaign; a
   fix for throughput that adds a serial Redis round trip to every bet is not a fix.
6. **A 429 must not teach an attacker how to tune.**

## Considered Options

1. **Per-account cap as the fairness control, with a loose per-IP backstop behind it** ← chosen
2. **Replace the per-IP cap with a per-account cap outright** — keys the budget correctly and
   *deletes* §11's answer to credential stuffing: one machine driving many compromised
   accounts regains an unbounded aggregate rate. Rejected: the threat §11 names is real.
3. **Keep per-IP only, raise the number** — the shared-address unfairness is not a tuning
   problem; a larger shared bucket is still shared, and raising it weakens the abuse ceiling
   in exchange for nothing.
4. **Composite key (`ip:userId`)** — one surface, no shared-address penalty. Rejected: it caps
   neither thing. One machine gets a full budget *per account* it drives, so the aggregate is
   unbounded exactly as in option 2, while a participant moving between networks silently
   gets a fresh budget per address.
5. **Per-market or per-surface budgets** — a different axis (productive capping), already
   deferred to HARDEN.6 and orthogonal to who pays for a write.

## Decision Outcome

**Chosen: Option 1 — two surfaces, one call site, the account in front.**

1. **`bet-user` is minted** as the seventh §11 surface: `Ratelimit.slidingWindow(BET_ATTEMPTS_PER_USER_PER_MIN, "1 m")`,
   prefix `{env}:ratelimit:bet-user`, identifier the bare `users.id`.
2. **`BET_ATTEMPTS_PER_USER_PER_MIN = 30`** — the value `BET_ATTEMPTS_PER_IP_PER_MIN` carried
   before this ADR. The figure was always an answer to *how fast may one person write*; it
   was the key that was wrong, not the number, so moving it unchanged is what makes this a
   re-keying rather than a loosening.
3. **`BET_ATTEMPTS_PER_IP_PER_MIN` moves 30 → 300** and is demoted to an abuse backstop.
   **The 10× is the design, not a round number:** below ten accounts sharing an address the
   backstop can never fire *first*, so a NAT reaches the per-account cap it can understand
   rather than an address-shaped one it cannot. Above that it bounds one machine at five
   writes per second — a rate the bet path's SERIALIZABLE pool-row lock already answers for.
4. **Both are checked at handler-stack step 4, concurrently**, via `Promise.all`. The pair
   costs one Redis round trip, not two (driver 5). Each `limit()` consumes a token, so a
   refusal debits the other surface too — deliberate, and the conservative direction: a
   request that was refused was still a request that was made.
5. **One envelope for both.** `error_rate_limit_exceeded` + `Retry-After`, byte-identical
   whichever cap fired (driver 6). The 429 stays cached under the idempotency key per §11.
6. **Fail-open is preserved on both**, unchanged: `checkRateLimit` catches, admits, and tags
   `upstash_unavailable_rate_limit`.

### What this deliberately does not add

**No `userIdentifier` helper**, and the asymmetry with `ipIdentifier` beside it is a
decision rather than an oversight. The identifier helpers are `(x) => x`; their only
product is the name at the call site, and `checkRateLimit("betPerUser", userId)` already
reads as the §11 row it implements. Against that cosmetic gain sits a **measured** cost:
**39 test files replace `rate-limit.ts` wholesale with a `vi.mock` factory**, so every
export the endpoint imports must be hand-written into 39 factories, and the next surface
to be added pays it again. A pass-through function is not worth re-arming that trap
(CLAUDE.md §8 O-1 — structural beats procedural). The module docblock says so, so the
next reader does not "fix" the asymmetry.

## Consequences

**Good.** A participant's budget is their own and travels with them. A shared address no
longer converts one person's writing into everybody's refusal. The credential-stuffing
ceiling survives at 300/min/IP. The load-test campaign's single-machine runs stop
measuring the limiter.

**Bad, and accepted.** One machine can now sustain 300 writes/min where it could sustain
30 — that is the explicit price of not penalising shared addresses, and the aggregate is
still bounded, still fails open, and still sits in front of a SERIALIZABLE transaction
that is the real ceiling. A second Redis key per bet doubles the limiter's key count and
Upstash command volume; it costs no extra latency, being concurrent.

**Neutral.** Redis holds one extra sliding window per active participant per minute, expiring
on its own.

### The ADR-0044 bound — the one load-bearing interaction, stated rather than discovered later

ADR-0044 §Consequences/Negative accepts a real cost — a cross-user idempotency-key collision
now *reaches the transaction* (a moderation call plus a full SERIALIZABLE attempt holding
`FOR NO KEY UPDATE` on the pool row) before the still-global unique refuses it — with the
explicit mitigation **"bounded by the existing `bet-ip` rate limit."** This ADR moves that
bound, so it must say by how much rather than leave a later reader to find it:

| Attacker shape | Before ADR-0054 | After | Direction |
|---|---|---|---|
| One machine, one account | 30/min | 30/min (the per-account cap binds first) | **unchanged** |
| One machine, many accounts | 30/min total | 300/min total | **10× weaker** |
| Many machines, many accounts | effectively unbounded — rotating the address bought a fresh 30 each time | 30/min **per account**, whatever the address | **stronger; a bound that did not previously exist** |

Two of the three rows improve or hold, and the third is the price. It is accepted, for reasons
that are checkable rather than reassuring:

- The weakened row requires **many valid sessions on one machine** — i.e. genuinely compromised
  accounts, since signup is gated by the identity pool, OTP/OAuth and Turnstile. That is the
  credential-stuffing shape, and it is still bounded; the ceiling moved, it did not lift.
- 300/min is **five writes per second from one address**, against a bet path whose real
  serialisation point is a per-market `FOR NO KEY UPDATE` that legitimate concurrent betting
  already contends for.
- The previously-unbounded row is the one a competent attacker actually uses — rotating
  addresses is cheap, compromising accounts is not. ADR-0044's mitigation was **weakest exactly
  where the threat is most realistic**, and this ADR is what closes that gap.

⚠ If HARDEN.5 finds the middle row unacceptable, the lever is `BET_ATTEMPTS_PER_IP_PER_MIN`
alone — lowering it toward the per-account cap trades shared-address fairness back for a
tighter ceiling, and the ordering guard in `tests/integration/rate-limit.integration.test.ts`
is what stops it being lowered *past* the per-account cap, which would silently restore the
shared-address defect this ADR exists to fix.

### The cached 429, checked rather than assumed

The 429 is assigned to `completed` and therefore cached under the idempotency key for
`COMPLETED_TTL_SECONDS` (24 h) per SPEC.2 §11 — unchanged by this ADR, but worth stating
because a new cap that a participant did not cause now reaches that path. The question is
whether a refused caller can be stuck for 24 h on a stale refusal. **It cannot**, and the
mechanism already exists: `src/components/debate/composer/idempotency.ts` mints a **fresh
key after every 429** (`pending: "fresh_on_enable"` — every exit path, countdown expiry or
edit, re-mints) precisely so a key is never held past a cached answer, and blocks submit
during the `Retry-After` countdown. So the cached 429 is never re-consulted, and a per-user
refusal behaves on the client exactly as the per-IP one did. No change was needed here;
it is recorded so the next reader does not have to re-derive it.

## Verification

- `tests/integration/rate-limit.integration.test.ts` — `bet-user` throttles; **and the
  ordering is pinned** (`BET_ATTEMPTS_PER_IP_PER_MIN > BET_ATTEMPTS_PER_USER_PER_MIN`), so a
  HARDEN.5 retune that inverts the two reddens here rather than on a NAT in production.
- `tests/integration/rate-limit.integration.test.ts` — prefix disjointness, now over six surfaces.
- `tests/unit/rate-limit-prefix.test.ts` — seven env-prefixed ctors at module load.
- **`tests/server/bets/rate-limit-surfaces.test.ts` — new, and the reason it is new is the
  finding below.**

### ⛔ The coverage gap this ADR had to close, found by mutation and not by reading

The three suites above look like they cover this decision. **They do not**, and the way that
was established matters more than the fact: a mutation pass replaced the endpoint's combined
decision with `const rl = rlUser` — which leaves the per-IP backstop computed and then thrown
away, i.e. **deletes half of this ADR** — and **every test in the repository stayed green.**
The opposite mutation (`const rl = rlIp`, deleting the per-account cap) was green too. The
existing suites exercise `checkRateLimit` in *isolation*: that each surface throttles, that
the prefixes are disjoint. Nothing asserted that the endpoint consults both, or that it acts
on either answer — so the whole of this decision lived in one unguarded expression.

A guard that cannot fail on the defect it is written for is not a guard, so the new file is
shaped by the mutants it must kill, and the kills were run rather than asserted — all four
killed, each by its intended case, **zero survivors**:

| Mutant | Effect | Killed by |
|---|---|---|
| `const rl = rlUser` | per-IP backstop computed and discarded | `ip-cap-alone-refuses` |
| `const rl = rlIp` | per-account cap computed and discarded | `user-cap-alone-refuses` |
| identifiers swapped | account quota keyed on the address | `consults-both-surfaces` |
| the `betPerIp` call deleted | backstop gone entirely | `consults-both-surfaces` + `ip-cap-alone-refuses` |

The suite also carries a positive control (`both-allowed-proceeds-to-the-transaction`),
without which every refusal assertion above is satisfiable by an endpoint that 429s
everything — the `O-13` shape, where silence corroborates nothing.

## Links

- ADR-0006 — failure-mode profile (fail-open rate limits).
- ADR-0015 — the rate-limit + idempotency contract this amends.
- SPEC.2 §4.6, §11, §18 — amended in this commit.
- SPEC.1 §8, §16.1 — amended in this commit.

---

*ADR-0054 re-keys the bet write cap from the client IP to the signed-in account, and demotes the
per-IP cap to a loose abuse backstop behind it. The decision body and any constraints minted in
§Decision Outcome are immutable; superseding requires a new ADR with a same-commit SPEC.2 update
per the SPEC.2 §0 versioning policy.*
