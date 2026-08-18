# ADR-0037 — Onboarding-Deck Seen-Marker: Browser Cookie, Not a User Column

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-08-18 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | O1-DECK |
| **Frame document** | SPEC.1 §21.9 (the deck), §13 (session model); ADR-0004 (participant session) |
| **Supersedes** | — |
| **Superseded-by** | — |

## Context and Problem Statement

SPEC.1 §21.9 requires the onboarding deck to be shown **once**, non-dismissibly,
to every authenticated participant, and to remain re-reachable afterwards. That
requires exactly one bit of durable state per participant — *has this deck been
completed* — and the product currently has nowhere to put it.

Three facts constrain the answer, and all three were established by
measurement rather than assumption:

1. **There is no persistence surface today.** `users` carries seventeen columns
   and none is a seen-marker. The `(public)` viewer DTO carries exactly one
   field, `pseudonym`. Nothing about the viewer beyond their name crosses into
   the shell.
2. **A session boundary is not a usable trigger.** The participant session is
   400 days with `disableSessionRefresh: true`, no idle timeout, and manual
   logout as the only end path, against a ~51-day live window. A participant who
   signs in on day one and does not log out **never signs in again inside the
   experiment**. "Show it on next login" has no next login.
3. **`(public)` is not middleware-gated.** `proxy.ts` matches `/admin/*` only,
   so every `(public)` surface serves signed-out visitors, who have no `users`
   row at all.

## Decision Drivers

1. **Correctness of the gate over correctness of the record.** The requirement
   is that the deck be *seen*, not that its seeing be *audited*. No downstream
   read, dataset column, ranking input or ledger entry consumes this bit.
2. **There is no adversary.** Nobody gains anything by evading the deck. A
   participant who clears cookies and sees it twice has lost thirty seconds.
   This is the fact that decides the ADR, and it is worth naming plainly rather
   than defending a stronger mechanism than the threat model needs.
3. **DDL cost is real and is paid in the scarcest resource.** A `users` column
   is a migration plus a SPEC.2 §5.1 row plus plan-then-execute plus a Gate C
   diff read — several founder-serial sessions against a fixed 2026-09-15
   go-live, spent on a bit with no consumer.
4. **The auth critical path stays closed.** `src/server/auth/**` is a CLAUDE.md
   §1 critical path. Any mechanism requiring an edit there is rejected on that
   ground alone, independent of its merits.

## Considered Options

1. **`users.intro_seen_at` — a DDL column.**
2. **A browser cookie.** ← chosen
3. **`localStorage`, read by a client component.**
4. **Extend the ADR-0004 session-creation hook** to require the marker.
5. **No persistence — render the deck on every login.**

## Decision Outcome

**Chosen: option 2, a browser cookie**, because it delivers the exact semantics
§21.9 requires — once per browser, durable across the window, written at
completion — at no migration cost and with no contact with the auth critical
path.

### The cookie

| Property | Value | Why |
|---|---|---|
| **Name** | `zugzwang_intro_seen` | Matches the `zugzwang_` application-cookie convention (`zugzwang_session`, `zugzwang_admin_session`) |
| **Value** | A **version token**, `v1` — not a boolean | A materially rewritten deck can be re-shown by minting `v2`. Costs one character; buys a lever that a boolean does not have |
| **Path** | `/` | It must be readable on every `(public)` surface. ⚠ This is the participant-cookie scope and is **deliberately not** the admin cookie's `Path=/admin` isolation — see Consequences |
| **HttpOnly** | `true` | It is read server-side in the layout and written by a Server Action. No client code reads it |
| **Secure** | `true` | Uniform with every other application cookie |
| **SameSite** | `lax` | Uniform with every other application cookie |
| **Max-Age** | `INTRO_SEEN_MAX_AGE_SEC = 60 * 60 * 24 * 400` | 400 days is the hard ceiling enforced by both the cookie serializer and modern browsers, and ~8× the live window. Declared as **its own constant**, deliberately not reusing the session's — the two lifetimes are independent decisions that happen to share a ceiling |

### Where it is read and written

**Read** in `src/app/(public)/layout.tsx` via `cookies()` from `next/headers`,
alongside the `getSession` read already performed there. The gate is
`viewer !== null && marker absent`.

**Written** by a Server Action invoked when the participant reaches the end of
the deck. Never on open. `src/server/auth/tos-accept.ts` establishes the
Server-Action cookie-mutation shape in this codebase; this ADR follows it
without touching it.

**No auth file is opened.** `cookies()` is available in any Server Action or
Route Handler, and the admin login path plus the auth catch-all already
demonstrate both shapes. ADR-0004's cookie file-map row is scoped to Better
Auth's `advanced.cookies` block and is not amended by this decision — as it was
not amended by `zugzwang_admin_session` or `onboarding_ref`, both of which
already sit outside it.

### Why not the alternatives

**Not option 1 (DDL column).** It is the semantically perfect answer — once per
human, not once per browser — and that precision buys nothing. The bit has no
consumer beyond the gate. Rejected on cost, not on correctness, and this ADR
records that the trade was made with the better option visible.

**Not option 3 (`localStorage`).** Same per-browser semantics as the cookie
with strictly worse mechanics: unreadable on the server, so the gate becomes a
client decision, which means the deck mounts after hydration and flashes. The
cookie is read where the decision is already being made.

**Not option 4 (session-gate extension).** It would place the deck **inside**
the auth critical path and hold the participant cookie hostage to a UI
sequence. Rejected categorically.

**Not option 5 (every login).** Falsified by measurement, not by preference:
with a 400-day non-refreshing session over a 51-day window, "every login" and
"once, ever" are the same behaviour. It would ship a deck the participant could
never see again.

## Consequences

### Positive

- No migration, no SPEC.2 §5.1 row, no schema change, no plan-then-execute on DDL.
- No contact with `src/server/auth/**`.
- The gate resolves server-side in a layout that is already doing a session
  read. No hydration flash, no client auth state.
- Marker-at-completion makes abandonment safe by construction: an abandoned
  deck is simply a deck that has not been completed.

### Negative / accepted tensions

- **Per-browser, not per-human.** A second device shows the deck again. Clearing
  cookies shows it again. Incognito shows it every time. All accepted; none has
  a victim.
- **⚠ `Path=/` is the participant scope, and the `Path` discipline on this
  codebase is load-bearing.** A near-miss is on record at
  `src/app/(admin)/admin/markets/media/sign/route.ts`, where broadening the
  admin cookie to `/` would have leaked it to every participant route. This
  cookie is deliberately participant-scoped, carries no identity, no session
  material and no secret, and its value is a literal version string. **The rule
  it must not weaken is the admin cookie's isolation, which it does not touch.**
- **First non-auth cookie in the product.** That is why this ADR exists.
- **The layout re-executes on `router.refresh()`**, which `DebatePoll` triggers
  every 15 s on `/m/[slug]`. The added work is one cookie read per tick per open
  tab — no query, no network, no allocation of consequence. Named so it is a
  measured cost rather than an unexamined one.

## Flow & invariant constraints absorbed

| Source | Constraint |
|---|---|
| SPEC.1 §21.9 | **Consumes.** §21.9 specifies the gate's *condition*; this ADR supplies its *mechanism*. A change to either requires a same-commit change to the other |
| SPEC.1 §13 / ADR-0004 P1 | **Consumes.** The 400-day non-refreshing session is the fact that eliminates option 5 |
| ADR-0004 file map | **Untouched.** Scoped to `advanced.cookies`; two existing cookies already sit outside it |
| ADR-0010 / SPEC.2 §8.7 | **Untouched.** Admin-cookie isolation is unaffected; this cookie carries nothing and reaches no admin route |
| INV-1 … INV-4 | **None render here.** The deck teaches invariants; it enforces none |

## More Information

- SPEC.1 §21.9 — the deck's specification, including the gate condition.
- `ZUGZWANG-O1-DECK_copy-register_v1_0.md` — the ratified card strings.
- ADR-0004 Patch record P1 — the 400-day session cap and
  `disableSessionRefresh: true`.
- The O1-DECK recon, 2026-08-18 — the measurements behind drivers 1–3.

---

*ADR-0037 ratifies a browser cookie, `zugzwang_intro_seen`, as the onboarding
deck's seen-marker, in preference to a `users` column that would have been
semantically exact and operationally expensive for a bit with no consumer and
no adversary. The load-bearing measurement is the participant session: 400 days
with no refresh against a ~51-day window means a once-per-session trigger is a
once-ever trigger, which eliminates the no-persistence option outright. The
marker is written at deck completion and never at deck open, so abandonment is
safe by construction. No auth file is opened and the admin cookie's Path
isolation is untouched.*
