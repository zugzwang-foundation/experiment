# &lt;TASK.ID&gt; — &lt;Task title&gt;

> Replace placeholders in `<...>` with real content. Delete sections that are genuinely "None" only after explicitly checking — don't leave them blank without thinking. The template's job is to force the question, not to lock you into long answers.

> **Status:** drafted | reviewed | executing | complete | abandoned
> **Date:** YYYY-MM-DD
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** yes | no — see CLAUDE.md §1
> **Plan PR / commit:** &lt;link or n/a&gt;

---

## Tracker context

Paste the tracker entry verbatim: title, description, priority, dependencies, estimate. Then list the status of each declared dependency at plan time. If a dependency is not actually done, call that out — the plan needs to either wait or explicitly justify proceeding.

## Approach (one paragraph)

Two to four sentences. The shape of the solution at a high level. Not the implementation — the strategy. Anyone reading the rest of the plan should know what they are looking at after this paragraph.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity | yes / no | &lt;e.g. "single Postgres transaction wrapping bet + comment writes; FK constraint NOT NULL"&gt; | &lt;test file path : test name&gt; |
| 2.2 Dharma non-transferable | yes / no | &lt;e.g. "no `dharma_ledger` row written without a `resolution_event_id` reference; user-initiated transfer endpoints absent by design"&gt; | &lt;test file path : test name&gt; |
| 2.3 Side frozen at comment-time | yes / no | &lt;e.g. "`comments.side_at_post_time` column, never updated after insert; trigger rejects updates"&gt; | &lt;test file path : test name&gt; |
| 2.4 Resolutions append-only | yes / no | &lt;e.g. "`resolution_events` table, no UPDATE permitted via row-level rule + audit trigger; corrections written as new event with `corrects_event_id`"&gt; | &lt;test file path : test name&gt; |

**Critical-path tasks (CLAUDE.md §1) only:** for each "touched" invariant above, name the concrete failure mode if the test assertion is missing or wrong. Be specific: *"If we omit the test at `<test name>`, then `<concrete corruption scenario>` can ship undetected — for example, a bet committing without a comment if the transaction wrapper is removed during a refactor."*

---

## 2. Data model changes

Schema diffs. New tables, new columns, indexes, foreign keys, constraints, NOT NULL changes, partition strategies. Either the Drizzle schema delta inline or a prose description.

For migrations: list each migration file by name + what it does + whether it is reversible. If irreversible, justify why and note the backup snapshot taken before apply.

If no data model changes, write "None — &lt;reason, e.g. read-only feature, UI-only change&gt;."

## 3. API surface

New or modified endpoints, Server Actions, and route handlers. For each:

- HTTP method + path (or Server Action name)
- Request body shape (zod schema reference)
- Response shape
- Auth requirements (public, authenticated, admin-only)
- Rate-limit class (per HARDEN.2 buckets)

If no API surface changes, write "None — &lt;reason&gt;."

## 4. UI / user flow

Pages affected, states, transitions. For new flows: step-by-step. For new components: name + location. For non-trivial UI: wireframe inline or "wireframe TBD" with owner.

If no UI changes, write "None — backend-only task."

## 5. Failure modes

What can go wrong at runtime? For each failure mode: how we detect (Sentry, health check, log alert, user report) and how we recover (rollback, retry, manual intervention).

Common categories to check before declaring "None":

- DB transaction failure mid-write
- Auth provider downtime
- Race condition between concurrent users
- Partial failure (some writes commit, others fail)
- Stale cache / read-after-write inconsistency
- Migration applied but code not yet deployed (or vice versa)

## 6. Edge cases

Specific cases the implementation must handle correctly. Be concrete with values where you can.

Examples:
- User has zero positions in a market and tries to comment.
- Market closes mid-bet (between price quote and submit).
- Comment exceeds length limit.
- Two users place bets on the same market in the same millisecond.
- User flips position immediately after posting a comment, before the next request.
- X handle changes between session creation and resolution.

## 7. Test plan

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| Unit (Vitest, `tests/unit/`) | &lt;happy path + edge cases for pure functions&gt; | &lt;which invariants get an assertion at this layer&gt; |
| Integration (Vitest + test Postgres, `tests/integration/`) | &lt;service-layer scenarios writing to DB&gt; | &lt;which invariants get an assertion at this layer&gt; |
| E2E (Playwright, `tests/e2e/`) | &lt;user-flow scenarios; usually only for UI tasks&gt; | &lt;which invariants get an assertion at this layer&gt; |

**Critical-path tasks (§1):** every "touched" invariant from the §1 table above must have at least one corresponding assertion in this test plan. If an invariant has no assertion, the plan is incomplete — fix before Phase 2.

## 8. Out of scope

Explicit list of things this task does NOT do, even though they might look related. Prevents scope creep in Phase 2.

Examples:
- "Not refactoring `src/server/markets/queries.ts`, even though it's adjacent. Open a separate task if needed."
- "Not adding rate limiting on this endpoint — that's HARDEN.2."
- "Not touching the admin UI for this; admin flow stays manual until UI.5."
- "Not handling the case where Postgres replication lags — out of scope for the experiment phase."

---

## Open questions

Things unresolved at plan time. Each question has a candidate answer and a path to resolve.

Format:
- **Q:** &lt;question&gt;
- **Candidate:** &lt;the answer Hrishikesh+Claude lean toward&gt;
- **Resolve with:** &lt;ADR-NNNN, this plan section, separate task, or "before Phase 2"&gt;

If no open questions, write "None at plan time."

## ADRs needed

Architectural decisions implicit in this plan that should be ADR'd before or during execution.

A decision is ADR-worthy if any of:
- It changes a default in CLAUDE.md §10.
- It commits the project to a vendor or major dependency.
- It sets a pattern other code will copy.
- A reasonable person could pick a different option without violating CLAUDE.md.

If none, write "None."

---

## Self-critique (after Phase 1 self-review)

After writing the plan, Claude Code's self-critique findings get logged here. Do not delete findings after addressing them — keep the record so Phase 2 can see what was considered.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | high / medium / low | &lt;what's wrong with the plan as drafted&gt; | addressed in §&lt;X&gt; / accepted as known limitation / deferred to &lt;task or follow-up&gt; |

If no findings after a careful pass, write: *"Self-critique returned no high or medium findings on date YYYY-MM-DD. Checked: invariants coverage, scope discipline, test assertions, edge case enumeration."*

---

## References

- `CLAUDE.md` — the contract this plan respects
- `AGENTS.md` — the stack patterns this plan follows
- `docs/specs/<spec>.md` — &lt;if this plan implements a spec&gt;
- `docs/logs/<predecessor>.md` — &lt;if this plan builds on prior work&gt;
- ADR-&lt;NNNN&gt; — &lt;if this plan implements an ADR&gt;
- Tracker entry: &lt;link or task ID&gt;

---

*Plan template lives at `docs/plans/_template.md`. Update via the maintenance loop (`docs/maintenance.md`) when plans repeatedly miss a category the template should have prompted for. The template is itself a living document; if filling it in is consistently painful for one type of task, the template needs adjustment, not the task.*
