# <TASK.ID> — <title>

> **Status:** drafted | reviewed | executing | complete | abandoned
> **Date:** YYYY-MM-DD · **Author:** <> · **Plan commit:** <>
> **Criticality:** CRITICAL PATH (<which of OPERATING.md §4's seven>) | ORDINARY

> **How much of this to fill.** ORDINARY work needs §1 Approach, §5 Failure modes and §7 Out of
> scope — the rest is optional and a plan comment in the pull request may replace this document
> entirely. **CRITICAL PATH work fills every section**, and §2 is mandatory: the whole point of the
> ritual is that a mistake on those seven areas is unrecoverable.

---

## 1 · Approach

Two to four sentences. The shape of the solution, not the implementation. A reader should know what
they are looking at before §2.

## 2 · Locks and invariants touched — CRITICAL PATH ONLY

| Lock / invariant | Touched? | How this plan preserves it | Test that asserts it |
|---|---|---|---|
| Dharma soulbound | | | |
| Bet ↔ comment atomicity | | | |
| Side frozen at post time | | | |
| Append-only, frozen at resolution | | | |
| Admin is not a participant | | | |
| Moderation fails closed (image path) | | | |

For each row marked touched, name the **concrete failure mode** if the test is missing or wrong.
Be specific: *"without `<test>`, `<corruption scenario>` ships undetected."* A row with no named
failure mode has not been thought about.

## 3 · Data model

Schema differences: tables, columns, indexes, constraints, nullability. Each migration by name,
what it does, whether it is reversible. **Irreversible migrations against production are
founder-reserved** (OPERATING.md §3). "None — <reason>" is a valid answer; blank is not.

## 4 · Surface and API

Endpoints, actions, routes: method, request shape, response shape, auth requirement, rate-limit
class. Pages and states for user-facing work.

## 5 · Failure modes

What goes wrong at runtime, how it is detected, how it is recovered. Check each of these before
writing "none": transaction failure mid-write · provider downtime · concurrent writers · partial
failure · stale read after write · migration and deploy out of order.

## 6 · Edge cases

Concrete, with values. Not "handle errors".

## 7 · Out of scope

The adjacent things this task does not do. Explicit, because this is what stops scope creep during
execution rather than after it.

## 8 · Open questions

Each with a candidate answer and a path to resolve — an ADR, a section of this plan, or a separate
task. "None at plan time" is valid, written deliberately.

## 9 · Self-critique

Findings from the author's own review pass, kept after they are addressed so the executor can see
what was considered.

| # | Severity | Finding | Resolution |
|---|---|---|---|
