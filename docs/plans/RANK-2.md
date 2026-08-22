# RANK-2 — the 0025 drift, the staging push, and the count lanes

| | |
|---|---|
| **Task** | RANK-2 |
| **Date** | 2026-08-22 |
| **Branch** | `fix/rank-2-self-reply-attraction` |
| **Base** | `4c64e40` (`main`, = RANK-1 / PR #391 merged) |
| **Governing ADR** | ADR-0039 — **new patch record P2**, ruling web-authored |
| **Governing spec** | `docs/specs/RANKING.md` §2 (substrate table + the count-axis block), header, change log |

Three ordered steps. Steps 1 and 2 are **operational and already complete**; only
Step 3 carries a code diff and is what this PR contains.

---

## Step 1 — the 0025 hash drift (DONE, no diff except the script)

Staging's `drizzle.__drizzle_migrations` held the pre-squash hash for `0025_lots`
while the code computed the post-squash one. Identical `when` timestamp ⇒
drizzle's high-water mark can never re-apply it ⇒ **permanent**.

**Safety re-derived independently, three ways** (not taken from the brief): the
diff of `0025_lots.sql` between `a4d8652` and `main`, with comments and blanks
stripped, is **empty**; the MD5 of the executable remainder is
`50c8a47683fe7aca0eec2301cb8938ec` on **both** sides; and of 27 changed lines,
**0** are non-comment. Also checked that neither version contains a `/* */` block
comment, so no comment form was missed.

`scripts/fix-migration-hash-drift.ts` — guarded, committed, repeatable.
Signature: `<old-sha256> <new-sha256> <folderMillis>` plus `--local` /
`--dry-run`. Guards, all proven to fire by **exit code** before it was pointed at
anything real: unrecognised flags are fatal (a typo'd `--dryrun` must not
silently mean "do it for real"); both hashes are **arguments**, validated as
64-hex; production refused **three ways** (DSN ref, `DOPPLER_CONFIG=prd`, and
`DATABASE_URL_PROD` merely being SET); the target must be positively named —
`--local` with a loopback:54322 DSN, or a staging fragment that is
**shape-checked** (`≥ MIN_FRAGMENT_LENGTH`, lowercase alphanumeric, the control
`tests/staging/_lib/guards.ts` ratifies, because a generic fragment like
`postgres` makes the target guard a no-op); **exactly one** matching row, and
that row's `created_at` must equal the `folderMillis` the caller named — a hash
alone does not name a migration; the UPDATE runs in a transaction keyed on
`(id, hash)`; and the result is re-read through a fresh statement with
`created_at` asserted unmoved.

⚠ The third argument and the fragment/flag/prod-var guards were **added after the
reviewer cascade**. Staging was corrected with the earlier two-argument form —
already verified correct and idempotent, so no re-run is owed.

Result: `/api/health` `migrations` went **`drift` → `ok`** on staging, and stayed
`ok` after Step 2 promoted a new build.

## Step 2 — staging to current main (DONE, no diff)

`origin/staging` `b851858` → `4c64e40`. Staging was a strict **ancestor** of main
(merge-base == staging head), the content test found **0 staging-unique files**
out of 53 differing, and the migration/schema delta was **0 files** — so none of
the three warned false alarms arose. Pushed staging **before** any branch (O-10).
Staging Migrate `32550764708` success; health shows `env=staging, db=ok,
canary=4c64e40, migrations=ok`; **8 markets, 0 `sp-*` fixtures**.

---

## Step 3 — the count lanes (this PR's diff)

### The attack

RANK-1 closed the **stake** axis: rank now follows surviving lot basis, so a
bought slot is released when the money leaves. It closed no **count** axis,
because there were none in its ruling. Three ranking inputs are counts — traction
`n`, the dominance split `lop`, the contestation badge `n^b` — and
`support_count` / `counter_count` are plain `COUNT(...)` over **Bucket-A** rows
with no survival predicate. A count can never move, by any mechanism, including
moderation (ADR-0021 removes the body and leaves the row).

**Measured on `4c64e40` before the fix**, one account, `DEFAULT_RANKING_CONFIG`:
post at `BET_MIN_STAKE_POST` (Đ10), then reply to your own post six times at
`BET_MIN_STAKE_REPLY` (Đ50) — no self-reply guard, no per-post cap, no uniqueness
on `(user, parent_comment_id)`:

```
supportCount = 6   counterCount = 0   supportDharma = Đ300  (all the attacker's own money)
topOrder     = [ATTACKER, honest]     badge        = "Most Debated"
```

A **Đ10** post outranked a **Đ100** one. `n = 6` clears `floorLane.n = 5`,
`lop = 1` clears the `floorSplit = 6` gate, sole clearer ⇒ `SENTINEL_MAX` ⇒ #1
outright, plus the Discovery hero. Then sell everything back for dust.

### The ruling (verbatim — ADR-0039 patch record P2)

> Self-authored replies do not count as attraction. A reply whose author is the
> parent post's author is excluded from the count lanes (n, lop, n^b) and from
> the attracted-value aggregates (support_dharma, counter_dharma).
> It is NOT excluded from anything else: it keeps its own stake, its own lane
> position, its own ranking weight as an argument, and its place in the author's
> Arguments count. The argument still happened and R9 still holds.
> What changes is only this: a post attracting its own author is not attracting
> anything, and attraction is what those inputs measure.
> Rationale: counts cannot decay without contradicting R9 (an argument someone
> made and exited did still get made). This closes the single-account attack by
> removing its other leg instead. Multi-account capture remains open and costs
> signup, identity-pool consumption, Turnstile and rate limits — a different
> threat class, and one every system pays.

### Implementation

One predicate, `AND rc.user_id <> p.user_id`, on the reply join. Sites
**enumerated from the live repo**, not taken from any list:

| # | Site | Why |
|---|---|---|
| 1 | `src/server/debate-view/ranking-substrate.ts` | counts + aggregates |
| 2 | `src/server/profile/arguments.ts` | counts + aggregates |
| 3 | `scripts/verify-ranking-staging.ts` | the staging instrument's hand-kept copy |
| ~~4~~ | ~~`src/server/bookmarks/list.ts`~~ | **removed from `main` by `unwire-1` mid-branch** — it received the predicate, then the file was deleted upstream and the predicate went with it |

⚠ **In the JOIN, never the WHERE.** In a `WHERE` it would drop any post whose
only replies are self-replies out of the result entirely; in the `ON` clause the
`LEFT JOIN` still yields the post with counts correctly at zero.

⚠ **`debate-view/reply-substrate.ts` is deliberately NOT changed.** It produces a
reply's own lane position, which the ruling explicitly preserves. Its *absence*
from the list is asserted positively in the parity test — a future reader
applying the predicate "consistently" to all five sites would silently delete a
participant's own arguments from the lane they belong in.

**Deliberately out of scope and docketed, not silently skipped:**
`src/server/profile/tiles.ts` (`supportReceived` / `counterReceived`) is a
per-user display tile, not a ranking input, and is already docketed as
**RANK-1-D3** for a related reason (it still sums frozen stake). Self-replies
will continue to inflate it. Merging two decisions into one PR is how a ruling
gets applied where nobody ruled it.

### Tests

| File | Proves |
|---|---|
| `tests/server/lots/self-reply-capture.test.ts` | **the acceptance criterion** — DB-backed through the real engine. RED on `4c64e40`. Includes a control asserting the self-replies KEEP their stake and lane. |
| `tests/unit/ranking/substrate-site-parity.test.ts` (extended) | the predicate exists at all four sites **and sits in the JOIN**, plus a positive assertion that `reply-substrate.ts` does **not** filter |

### Fences

- **F1** production forbidden — the prod ref appears in no command; the script
  refuses it unconditionally.
- **F2** no `staging:rebuild` / `reset` / `generate` — none invoked; the 8
  markets were verified intact afterwards.
- **F3** no new migration — `git diff` over `drizzle/` and `src/db/` is empty.
- **F4** halt on red — `just verify` green, full suite green, CI green on a
  confirmed headSha.
- **F5** fresh worktree `wt-rank2`; neither `wt-merge1` nor `wt-rank1` reused.

---

## Cascade outcomes (S3.5)

`@code-reviewer` → `@security-auditor`, sequential, both `claude-opus-5` / `effort: max`.
Neither found a CRITICAL. Fixed in-session: the script's flag whitelist,
`DATABASE_URL_PROD` refusal, fragment shape check, migration-identity assertion
and a false "transaction rolled back" message; SPEC.2 §5.4's canonical definition
of the four fields; a **wrong `§5.3` citation I had introduced** (and then a
wrong `§17` replacing it — corrected to `§23` only after reading the enclosing
heading); ADR D-5's superseded three-site list (O-5, in place); RANKING.md §2.1 +
§11's index note; a widened parity regex; and an **over-exclusion control**
proven by mutation to catch `rc.user_id <> rc.user_id`.

**Two findings carry decisions and are NOT fixed here** — both in the PR body:

1. **The ruling's residual-risk sentence is optimistic by 6×.** Measured: **one**
   sybil, **five** replies, **≈ 3 attoDharma**, attacker keeps the money. Google
   OAuth signup has no Turnstile; the OTP cap allows ~600 signups/hour and fails
   open; the pool holds 50,000. The ruling text is untouched; the measurement is
   recorded beside it in ADR-0039 P2 and RANKING.md §2.
2. **A new SC-1 count differential.** `loadReplySubstrate` is unfiltered and
   includes removed replies; the aggregate is filtered. Their difference is the
   self-reply count — and both numbers render on the same surface, including the
   **public, signed-out `.md` export**. An observer can attribute a removed reply
   to a named pseudonym. Introduced by this change; the recommended resolution is
   an additive self-inclusive `totalReplyCount`.
