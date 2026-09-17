# ADR-0057 — The Session Is Served From Its Cookie, and a Ban Is Not

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-17 |
| **Deciders** | Hrishikesh M. H. |
| **Tracker task** | HARDEN — production load-test remediation, the auth read path |
| **Frame document** | SPEC.2 §8.2 (Better Auth wiring) · ADR-0004 (auth architecture) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | ADR-0004 — session READS only. Session creation, the onboarding gate (`session.create.before`), the 400-day cap, `disableSessionRefresh`, Turnstile and the OTP flow are all untouched |
| **Amended-by** | — |

---

## Context and Problem Statement

Four merged fixes (#526, #551, #552, #554) took the read path off the database: pages are
CDN-served, the debate poll is answered at the edge, Discovery's pool read is windowed. After
them, a signed-out reader could browse the product without the origin touching Postgres at
all.

**A signed-in reader could not.** `src/app/(public)/_lib/session.ts` calls
`auth.api.getSession()` on every render of the `(public)` layout, and Better Auth's
`session.cookieCache` was **off** — its default. Off means the session is read through the
drizzle adapter from Postgres on every call.

⚠ **Verified in the shipped package rather than inferred from documentation:**
`better-auth/dist/api/routes/session.mjs:93` returns the cookie payload and skips the adapter
read **only** when `cookieCache.enabled` is set. With it unset there is no branch that avoids
the query.

So the last per-visitor database read on the read path was the session lookup — on the one
population the product most wants to keep: people who signed up.

This ADR does **not** decide:

- Session *creation*, the onboarding gate, or the 400-day cap (ADR-0004, unamended).
- Whether to move sessions to Upstash as Better Auth `secondaryStorage` — a larger change,
  and unnecessary if a signed cookie already answers the question.
- The auth POST path (OTP send / verify), which is unmeasured and remains the weakest
  remaining link under a sign-up surge.

## Decision Drivers

1. **A per-visitor database read is the shape this whole programme has been removing**, and
   the connection ceiling is the measured constraint.
2. **It lands on signed-in readers specifically** — the population whose experience matters
   most.
3. **Nothing about money or moderation may become cacheable.** A performance change on the
   auth path is a security change unless it can be shown not to be.
4. **The window must be a stated cost, not a discovered one.**

## Considered Options

1. **Enable `session.cookieCache` with a bounded window** ← chosen
2. **Leave it off** — no new staleness, and keeps a Postgres query on every signed-in page
   view for a value that changes approximately never.
3. **Move sessions to Upstash via `secondaryStorage`** — removes the Postgres read entirely
   and keeps server-side validation on every request. Rejected *for now* as strictly more
   moving parts than a signed cookie the browser already carries; revisit if the window ever
   proves unacceptable.
4. **Cache `getSession` per-request in React `cache()`** — helps only when one request calls
   it twice, which is not the shape here (`session.ts`'s own docblock notes the calls are
   one-shot per request).

## Decision Outcome

**Chosen: Option 1.** `session.cookieCache = { enabled: true, maxAge: SESSION_COOKIE_CACHE_MAX_AGE_SEC }`,
with `SESSION_COOKIE_CACHE_MAX_AGE_SEC = 300`.

### 1 · What is cached, and what is not

The **lookup** is cached; the **trust** is not. The session-data cookie is signed and still
verified on every request — what the window removes is the round trip to Postgres to
re-fetch a row that changes approximately never.

### 2 · ⛔ The cost is chrome; it is never action

**A session revoked server-side keeps RENDERING as signed-in until the cached copy expires**
— at most 300 s. That is the price, stated plainly, and it is a security property rather
than a performance one.

**It does not let a revoked or banned participant do anything**, and this is the load-bearing
half of the decision:

- Every write re-reads the user row from Postgres inside the request. `runBetEndpoint` reads
  `users.bannedAt` (with pseudonym and tos) before anything else, so a ban takes effect on
  the **next bet, sell, post or reply**, whatever the cookie says. Under INV-1 every comment
  rides a bet, so that single gate covers every participant write in the product.
- **There is exactly one ban gate in the tree.** Every other `banned_at` site is an admin
  display or the ban write itself — enumerated, not assumed.
- `session.create.before` (`session-gate.ts`) runs at session CREATION and reads the user row
  itself. This caches reads only.

### 3 · ⚠ A spec sentence that was already wrong, and became dangerous

SPEC.2 §8.2 stated that *"the ban-enforcement check rides on the same `auth.api.getSession`
call that already runs at every handler entry."* **That never described the built code** — the
check has always been its own `db.query.users.findFirst`.

Ordinarily that is minor drift. Here it is not: a reader trusting that sentence would
conclude this ADR delays ban enforcement by the cache window. **It does not, precisely
because the sentence was wrong.** Corrected in place in the same commit (`O-5`), because an
inaccuracy that would make a future reader reject a safe change — or accept an unsafe one —
is worth more than a footnote.

### 4 · Why 300 seconds

Chosen against the read pattern rather than picked round. A reader moving through the site
every ~30 s pays one session read per ten page views instead of one per view; at 60 s it
would be one per two, which leaves most of the cost in place. Against that, 300 s bounds the
stale-chrome window to five minutes.

The value is a dial with nothing else depending on it. A guard caps it at fifteen minutes —
not a pin, a ceiling: the window *is* how long a revoked session keeps rendering, and growing
it into the hours is a different decision that should require saying so.

## Consequences

**Good.** The last per-visitor database read leaves the read path. Signed-in readers now cost
the origin roughly what signed-out readers cost, which is close to nothing.

**Bad, and accepted.** Up to five minutes of stale chrome after a revocation. Bounded, and
confined to what is displayed.

**Neutral.** The session-data cookie grows the request slightly; it is the payload Better
Auth already mints for this purpose.

## Verification

- `tests/unit/auth/session-cookie-cache.test.ts` — **new**, and shaped by the mutants it must
  kill. All run, not asserted: **4 applied, 4 killed, 0 survivors.**

| Mutant | Killed by |
|---|---|
| `enabled: false` | `is enabled, and bounded by a named constant` |
| window grown to 2 h | `the cached window is minutes, not hours` |
| `bannedAt` dropped from the bet path's projection | `the bet path still re-reads the user row` |
| ban sourced from `session.user` instead of the DB | same |

⚠ **One mutant appeared to survive and did not.** A first attempt to delete the ban re-read
matched no bytes — the source reads `bannedAt: true }` with no trailing comma — so the file
was never mutated and the green result meant nothing. **A mutation that does not mutate proves
nothing**, and the run was repeated with the file-changed check that should have been there
from the start.

⚠ **Not measured under load.** The mechanism is verified in the shipped Better Auth source and
the guards pin the safety property, but the *saving* is reasoned from the call pattern rather
than measured against production. The multi-machine run is what would show it.

## Links

- ADR-0004 — Better Auth architecture; amended in session reads only.
- SPEC.2 §8.2 — amended in this commit, twice (see §3).

---

*ADR-0057 enables Better Auth's session cookie cache for 300 seconds, removing the last
per-visitor Postgres read from the participant read path, on the property that every write
re-reads the user row so a ban is never served from a cookie. The decision body and any
constraints minted in §Decision Outcome are immutable; superseding requires a new ADR with a
same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
