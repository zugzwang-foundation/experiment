# DEBATE.3 — Side-binding immutability (INV-3)

> **Status:** web review PASS; executing as one PR (`chore/debate-3`), hold for diff review before merge.
> **Plan SHA frame:** branched off `main` `233c3e0` (#138).

---

## Context — the reframe

DEBATE.3's row reads "INV-3 side-freeze: the BEFORE-UPDATE trigger on
`comments.side_at_post_time`." The kickoff (echoing the DEBATE.2 close-out, line 77 —
*"the value is SET here, the trigger is not built"*) framed it as: build a **column-scoped
BEFORE UPDATE trigger** that rejects `side_at_post_time` changes while **allowing other
column updates**, ship migration `0016`, write a failing-first test pair.

**Recon contradicted the premise. BOTH halves of INV-3 are already delivered:**

1. **Immutability** — `comments` is a **full Bucket A append-only table** (SCAFFOLD.2
   stratum 3.C, `0003`). Every UPDATE/DELETE to the whole row → P0001, so
   `side_at_post_time` is already immutable. SPEC.2 §6.5 names the mechanism:
   *"INV-3 (comments side-bound at post time **via append-only `comments`**)."*
2. **Capture** — `side_at_post_time = side` is written **at INSERT** inside the W-1 bet
   tx (`src/server/bets/place.ts:133`), built in **DEBATE.2** (#136).

There is **no** legitimate post-insert UPDATE path to `comments`, so the kickoff's
column-scoped trigger (which permits other-column UPDATEs) would *relax* the table from
full append-only — a **regression** against SPEC.2 §6 and a §2 weakening. Refused.

**Founder rulings:**
- **Decision 1 → Option A.** Close as delivered. No new trigger, no migration, head stays
  `0015`. The column-scoped trigger is rejected as an append-only weakening; a layered
  additive guard (option B) is rejected as redundant dead weight.
- **Decision 2 → Option 2.** A **web-authored** ADR-0005 §5.12 **patch-record** records the
  ratification + corrects the stale line 263. The ADR text is integrated verbatim, not
  CC-authored.

---

## The discovery — proof table

| Claim | Proof on disk |
|---|---|
| `comments` is Bucket A (whole-row append-only) | `0003_append_only_triggers.sql:48-49` — `bucket_a_no_update` / `bucket_a_no_delete` → `enforce_bucket_a_no_update()` RAISEs `P0001 "UPDATE not permitted"` on ANY UPDATE |
| The spec mechanism IS append-only-`comments` | SPEC.2 §6.5 line 605; SPEC.2 §3.2 line 232 (Pattern W-2 retired; side frozen *inside the W-1 tx*); SPEC.1 §5 line 170 (*"never updated after insert; a row-level rule rejects updates to that column"*) |
| Capture built in DEBATE.2 | `place.ts:133` `sideAtPostTime: side` (INSERT). No `UPDATE comments` anywhere in `place.ts`. |
| NO legitimate UPDATE path to `comments` | `place.ts` post-insert UPDATEs touch only `image_uploads` (Bucket B, `:216`) + `pools` (Bucket C, `:258`). `image_uploads_id` set at INSERT (`:135`). `image-attach.ts` is read-only on comments. No moderation-state column on `comments` (moderation is pre-commit, aborts the INSERT). |
| Already recorded as done | ENGINE-phase-record §5 line 100: *"INV-3 side-bind — I-SIDE-BIND-001 (ENGINE.8). side_at_post_time frozen by BEFORE-UPDATE trigger."* |

**ADR-0013 (kickoff STEP 1):** moot — no new trigger. The existing `bucket_a_no_update`
is BEFORE UPDATE, never fires on the INSERT capture path, and does not conflict with the
SERIALIZABLE W-1 tx (which only INSERTs into `comments`).

---

## Existing I-SIDE-BIND-001 coverage (Decision-1 conditional — reported before adding)

**Within the named scope (`tests/invariants/` + `comments-append-only.spec.ts`): only
generic coverage — the column was NOT asserted specifically.**

- `tests/db/triggers/comments-append-only.spec.ts` — UPDATE-rejection case mutates **`body`**
  (`UPDATE comments SET body='changed'` → P0001) + a DELETE case. Generic whole-row.
- `tests/invariants/I-SIDE-BIND-001…spec.ts` — one **flow** test (place-YES → sell-to-zero
  → re-enter-NO) asserting the original comment's `side_at_post_time` *reads back*
  unchanged. A read-back equality, **not** a direct column-targeted UPDATE-rejection.

**Out-of-scope datapoint:** `tests/scale/side-bind.scale.test.ts:154-160` (ENGINE.10) runs
`UPDATE comments SET side_at_post_time='NO'` → `.rejects.toThrow()` — but (a) `tests/scale/`,
not the invariant home; (b) bare `.rejects.toThrow()`, not named P0001; (c) behind a
24-user / degree-32 storm, outside the canonical `pnpm test:invariants` gate.

**OQ1 ruling:** ADD the named column-targeted assertion (not doc-only). **OQ2 ruling:** home
is `tests/invariants/I-SIDE-BIND-001.comment-side-bound-at-post-time.spec.ts`.

---

## Changes (one PR)

### 1. `docs/plans/DEBATE.3.md` — this plan.

### 2. ADR-0005 patch (web-authored, verbatim)
- New `## Patch record` section, placed as ADR-0013 places its (after the metadata table,
  before the first `##` content section).
- Replace the stale line-263 INV-3 table cell (*"ADR-0013 / DEBATE.3 own the post-time-side
  capture itself"*) with the new cell — the capture was built in **DEBATE.2** (`place.ts:133`).

### 3. The ONE named I-SIDE-BIND-001 assertion (test-only; no `src/`, no migration)
`it("comment-side-bound::direct-update-of-side-at-post-time-rejected", …)` — seed a comment
row, then `UPDATE comments SET side_at_post_time = 'NO'` →
`.rejects.toMatchObject({ code: "P0001", message: …"UPDATE not permitted" })`.
**Regression guard, not a TDD driver** — the Bucket-A mechanism already ships, so it is green
from day one (AGENTS.md §9 guard-vs-driver distinction). STEP 5(b) ("a legitimate UPDATE to a
different column succeeds") is **rejected** — no such column exists; asserting it would
require weakening the table (§2 refusal).

### 4. `docs/logs/DEBATE.3.md` — close-out (CC-authored).

---

## Stale-doc reconciliation set
- **ADR-0005 line 263** — corrected by the web-authored patch (this cycle).
- **DEBATE.2 carry-forward** (close-out log line 77, *"the trigger is not built"*) — stale:
  the Bucket-A trigger was built at SCAFFOLD.2 3.C (`0003`). Noted in the DEBATE.3 close-out;
  the merged DEBATE.2 log is not rewritten.
- **Tracker row** — external operator-maintained HTML (not in-repo); flip to done is the
  operator's, not edited here.
- **SYNC backlog (noted, not fixed — §5.4 scope):** AGENTS.md §3 still calls
  `src/server/comments/` greenfield (it now exists, #136/#137); AGENTS.md §9 omits
  `tests/scale/`. Flag for the next SYNC sweep.

---

## Verification (pre-PR)
`ZUGZWANG_ENV=preview just verify` → `pnpm test:invariants` → `just test-db` → full
`pnpm vitest run`. Green = the new named assertion + I-SIDE-BIND-001 + comments-append-only
all pass; head `0015`; EVENT_TYPES 23; zero migration delta. Critical-path pre-PR self-audit
(§5.10) against this plan before `gh pr create`.
