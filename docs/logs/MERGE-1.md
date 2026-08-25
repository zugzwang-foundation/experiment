# MERGE-1 — the PHASE-0 cascade, the schema claim, and the composer consolidation

**Task:** MERGE-1 · autonomous execute · 2026-08-21 → 2026-08-22
**Worktree:** `/Users/hrishikesh/code/zugzwang/wt-merge1`
**Base:** `origin/main` `88cd2ff` → **`8b560e6`** after two merges
**Session 2 is the staging half and is deliberately NOT started here.**

---

## What landed

| PR | Squash SHA on `main` | What |
|---|---|---|
| **#386** | `0d0173d97b5d7b1af66c255d394a59a63022833b` | the R9 enforcement claim corrected at every editable site, plus six one-line riders from the cascade |
| **#387** | `8b560e6e4cf0a66cd4c401e3dd474b929696b5e4` | the composer work from `#383`/`#384`/`#385` moved from `staging` onto `main` |

Full narrative report (measurements, every reviewer verdict verbatim, the Session-2 recon):
`~/Downloads/zz_MERGE-1_2026-08-21T2341.md`. It is not in the repo; this file is the
in-repo record.

### #386 — 7 files, +97 / −16, comment and documentation only

The claim that the `lots` monotone CHECKs enforce R9's monotonicity *"strictly stronger
than comparing against the previous value (which storage cannot see)"* was in **six**
places. PHASE-0 corrected ADR-0039 and missed the rest, because the grep that went looking
was line-scoped and the sentence wraps across two comment lines.

Corrected: `src/db/schema/lots.ts:140-142` and `:30-31`; `docs/specs/SPEC.2.md` §5.1 row 26
and the §22 ADR-0039 index row. **Frozen and reported, not edited:** the same sentence in
`0025_lots.sql:15-16` and loose phrasing in `0026:3-4`, both committed migrations.
`docs/logs/PHASE-0.md`'s Q1 is **annotated beneath, not rewritten**.

Riders, all verified independently before they rode: ADR-0039's **unscoped halt condition**
(`:409-410` — satisfied by every pre-existing bet the instant the migration lands; staging
tripped it on contact, and only the migration carried the scoped form);
`sell-oversell.test.ts`'s claim that a corrected body replays its cached refusal (it
returns **409 key-reused**); `lots-no-delete.spec.ts`'s claim to exercise the staging reset
while calling the local fixture; the third hand-typed copy of `78` replaced by an import of
`EXPECTED_GUARD_CATALOG_ROWS`; `AGENTS.md`'s stale table count and its Bucket-C line, which
named neither `lots` nor its fourth shape.

### #387 — 5 files, +1063 / −25, verbatim from `staging`

`ImageAttach.tsx`, `copy.ts`, and three files under `tests/unit/composer/render/`. The
delta was measured over the **whole** composer directory and the **whole**
`tests/unit/composer/` tree before anything was applied — scoping the query to the three
permitted paths would have made the halt check unfalsifiable. Nothing outside the permitted
set moved; `SellModule.tsx` and `requests.ts` were measured byte-identical across both refs
first and remain so.

---

## Decisions made

1. **The SPEC.2 correction was carried even though Step B only asked for it to be
   reported.** SPEC.2 outranks the ADR under CLAUDE.md §1, so the canonical technical
   inventory was asserting a storage guarantee that does not exist — while the schema
   comment being corrected in the same PR disagreed with it. Fixing one and leaving the
   other would have repeated, in this session, the exact **O-5** failure the session was
   sent to remedy.
2. **The SPEC.2 version was NOT bumped and no changelog row was written.** Every row in
   that changelog is authored **HMH**; inventing one is the thing not to do. **Owed:** the
   file now differs from what its own `1.0.24` row describes.
3. **Four candidate one-liners were refused**, each because it failed the "no design
   question" test rather than because it was wrong: one where the reviewer
   over-attributed a false clause to a file that was correct; one whose sentence is
   literally true as written; one that is the reply-lane ordering ruler the kickoff put
   under NOT DOING; and one "vacuous" assertion that is merely weak and asserts nothing
   false.
4. **The `lot_oversell_backstop` alarm was NOT added.** The two reviewers disagree on its
   fix class — one calls it a one-line fix, the other calls it a SPEC.2 §17 catalogue
   surface. **A disagreement between two reviewers is itself a design question.**
5. **No migration was written.** Two findings would need one; the session was fenced.

---

## Open questions — all founder-owned, none actioned

- **`.nullish()` on `lotId` is a fifth change no ratified list names.** `docs/logs/PHASE-0.md:27`
  says four fixes; `dc12a60`'s subject says five; ADR-0039's owed rider says *"optional"*,
  which is `.optional()` semantics. Revert, or amend the rider in the commit that keeps it.
- **A backstop trip is now silent AND cached for 24 h.** `LotOversellError` maps to 400
  without the alarm its own cited precedent pairs with, and 400 is `< 500`, so the retry is
  answered from Redis without re-entering the handler.
- **The clamp is the only runtime site that can detect R2 drift, and it discards the
  measurement** — then, on a sell-all, destroys the state that produced it.
- **`bet.sold` carries no lot attribution**, so `lots` is not reconstructible from `events`.
- **The idempotency key is scoped to neither user nor flow.** The cross-*user* replay is
  **not** reachable — the control is the client's 122-bit `crypto.randomUUID()`, which is a
  client-side property and not a server-side check. The same-user **cross-endpoint**
  confusion **is** reachable and falsifies ADR-0015 D5's stated guarantee.
- **A bare `TRUNCATE lots` is unguarded** and breaks R2 the way the DELETE guard exists to
  prevent. **Would need a new migration.**
- **`lots_no_delete` is the only trigger whose enabled state nothing verifies on staging or
  production** — `guard-list-parity` reads files, not `pg_trigger`.
- **A free, permanent top-slot capture of any post's Support/Counter lane.** Frozen
  `bets.stake` rules the reply lane, the CPMM is fee-less, and the per-lot sell makes the
  round trip surgical. A third frozen-stake ruler — the post-lane `tiebreak()` — is open
  too and is recorded nowhere.
- **Every rate limit keys off a client-supplied `X-Forwarded-For`, including the admin
  brute-force limiter**, while exactly one site uses the platform helper. **Unmeasured** —
  a separate task, not widened into here.
- **`0025_lots.sql` was edited after commit** (comment-only) against `AGENTS.md` §11's
  *Never*. Verified harmless four ways — drizzle-orm 0.45.2 gates on `folderMillis` and
  never compares the hash — but no ruling covers the exception.

---

## Next session starts at

**Session 2 · the staging half.** Nothing here touched staging: no push, no reset, no
rebuild, no database contact of any kind.

**The exact first action:** advance `staging` to `main` by force-push to a pinned SHA, and
**push `staging` before any branch push carrying that SHA** (`O-10`).

```bash
git push --force-with-lease origin <MAIN_SHA>:refs/heads/staging
```

Then watch Staging Migrate → green, **confirm its `headSha` equals the SHA you pushed**,
and gate on `/api/health`'s `canary`, not on the workflow.

⚠ **Precondition (b) will look false and is not.** `git log --oneline origin/main..origin/staging`
returns **17 commits** — the pre-squash LOTS-1 branch history, which squash-merging
guarantees are not ancestors of `main`. **Read content, never the log.** Measured here:
the composer direction is **byte-empty**, and every one of the ten files carrying an
insertion in the `main→staging` direction has been **modified on `main` since the staging
tip** — i.e. staging holds older copies of lines `main` changed, not content of its own.
**The force-push loses nothing.**

---

## Context to preserve

**There is no restore path for the eight markets, and `staging:rebuild` will replace them.**
No script, test or `package.json` entry reads `docs/data/staging-markets-snapshot.json` —
its own header says it is *"a RECORD, not a seeder"*. `staging:reset` truncates `markets`,
and `staging:generate` then creates its **own fifteen `sp-*` fixture markets**. So a
rebuild does not merely truncate and does not restore: it **replaces** the eight
founder-authored markets, and its six gates go green while doing it.

A restore would need 8 `markets` + 8 `pools` + 16 `market_media` — all present in the
snapshot — **plus 8 `market.opened` events, which are NOT.** Two things make it smaller
than it looks: `created_by` is `text` defaulting to `'admin-singleton'` and **not a foreign
key**, so nothing depends on a surviving `users` row; and the `events` partitions through
`2027-04` already exist. One thing makes it larger: writing `market.opened` events by hand
is a claim that something happened which did not, into a Bucket-A table that ADR-0005 makes
the source of truth. **Restore the SEEDED reserves (`10000` both sides), not the
snapshot's current ones** — four pools have moved under real bets.

⚠ **`scripts/lots-1-staging-wipe.ts` is single-use against a given database.** It reads
each pool's seed from `events WHERE event_type = 'market.opened'`, refuses if any market
lacks one, and then truncates `events`. After one run those seeds no longer exist.

**Two `claude` sessions shared the primary tree throughout** (PIDs 14904 and 24313, both
`cwd = .../experiment`). All work here was done in a dedicated worktree so HEAD and the
index could not collide; the shared local Postgres on `:54322` is the one thing a worktree
cannot isolate.

---

## Time

Recon and Step B sweep · three sequential reviewer passes (`@code-reviewer` →
`@security-auditor` → `@db-migration-reviewer`, never concurrent) · two full gate runs plus
one killed and re-run · two PRs opened, CI-gated on a confirmed `headSha`, and
squash-merged. ~5 h wall clock, 2026-08-21 23:41 → 2026-08-22.
