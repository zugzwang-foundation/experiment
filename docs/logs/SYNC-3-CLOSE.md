# SYNC-3 · CLOSE — session log

**Task:** SYNC-3 · CLOSE — the two docket rows, this log, and the PK stage.
**Ritual:** CC-LIGHT, gated. `ultracode` FORBIDDEN, not used. No subagents invoked.
**Ground:** `origin/main` @ `9a694db54d50d82cba59c4ab6316f5e583d5fc23`.

---

## What landed

| Commit | Scope | Content |
|---|---|---|
| `91beec6` | `docs/parked.md` | C2 — the HARDEN ruling + two measurements onto `IDENTITY-POOL-NAMESPACE`; C3 — the new `STAGING-POOL-UNDERSIZED` row |
| *(this commit)* | `docs/logs/SYNC-3-CLOSE.md` | this log |

**PR:** opened immediately after this commit; its number is not knowable at log-write
time because §5.9 puts the log *before* the PR. Recorded in the close report.

**Prior PR — the one this session closes out: #364, squash-merged
`9a694db54d50d82cba59c4ab6316f5e583d5fc23`.** That SHA is the current `origin/main` tip, and
`git diff 20b6810 origin/main` is **empty** — the tree that was reviewed is the tree that landed.

---

## ⚠ Gate C on #364 was granted a RECORDED EXCEPTION

**#364 merged without its diff ever reaching the reviewer.** The diff was requested and not
received across **three rounds**. Approval therefore did not rest on a read of the change. It
rested on three substitutes, all of which are mechanical:

1. **The scope assertion** — `git diff --name-only origin/main...HEAD` returned six paths, every
   one under `docs/`. No `src/`, no `tests/`, no migration, no workflow file. A path list is
   checkable without reading content.
2. **Terminal-green CI** — run **`32367120661`**, `status=completed`, `conclusion=success`, on
   head `20b68104e5445f6733a0233f71ff87b11aa0f948`, the exact pushed SHA.
3. **Every changed byte quoted in two reports** — the fix report and the diff artifact, both
   written to `~/Downloads/` and both carrying the full text of every edit.

⚠ **This is per-PR, and it is not precedent. A `src/` PR does not get this.**

The reason it was survivable here is the same reason it is worthless as a general rule: on a
documentation-only change, the scope assertion *is* most of the review, because there is no
behaviour to reason about. The moment a path under `src/` appears in that list, none of the three
substitutes says anything about whether the code is correct. **CI's green on #364 is a statement
that nothing else broke — `just verify` and `ci.yml` read zero bytes of a markdown-only diff, which
`docs/parked.md`'s `MARKDOWN-UNGATED-BY-CI` row already records as a standing property.**

---

## The staging identity-pool measurement, and what it gates

Measured on the live staging database at the previous SYNC-3 session (read-only; this session
issued **no database statement**, per its kickoff):

| | |
|---|---|
| `identity_pool` rows | **200** |
| consumed (`assigned_at IS NOT NULL`) | **15** |
| unassigned | **185** |
| distinct `pfp_filename` | 200 |
| distinct `number` | 200 — the number runs `0…199` once across the table, **not** `000–999` per asset |
| digit width | **3, uniformly** (`distinct_digit_widths = 1`) |

**It gates the load runs.** Against the scale tracker's 50 signups/sec profile, 185 rows drain in
**3.7 seconds**, with the 5%-of-pool low-watermark alarm (`SPEC.2` §17 alarm 5, named at
`SPEC.1:957`) firing about two tenths of a second earlier. Past that every signup is
`503 error_identity_pool_exhausted` (`SPEC.1:731`, `:758`). **LOAD RUN #1 (tracker 3.5)** and
**LOAD RUN #2 (4.1)** would both measure pool exhaustion at second four instead of signup
capacity, and the delta between those two runs is what the compute-tier decision rests on. The
`G1` deadlock fix has the same trap under it: verified against a pool that empties at second four,
it is verified against the wrong regime.

**Nothing is broken.** `scripts/seed-staging.ts:2` says *"200 deterministic"* by design. Filed as
`STAGING-POOL-UNDERSIZED`, triggered **before** the load rig is built, against tracker row 2.4
which already owns the seeding.

---

## ⚠ Correction to the SYNC-3 fix report

The fix report (`zz_SYNC-3_fix_2026-08-19T1729.md`, §5.6) wrote:

> *"The shipped script follows `:117` — `scripts/verify-identity-pool.ts:25` pins
> `const EXPECTED_TOTAL = 50_000;` and `:49` compares with `rowCount === EXPECTED_TOTAL`."*

**The attribution is wrong.** `===` is an equality test, which is `SCAFFOLD.17:239`'s predicate
(*"must equal 50,000"*), **not** `:117`'s (*"`>= 50000`"*). Re-measured against `origin/main` this
session: `verify-identity-pool.ts:49` reads `if (rowCount === EXPECTED_TOTAL)`. **The shipped
script implements `:239`, the stricter of the two.**

**The measurement was right and the attribution was not** — the quoted line was accurate, the
sentence attached to it pointed at the wrong one of the two predicates. The underlying finding
stands unchanged: `SCAFFOLD.17` states its expected count two incompatible ways, at `:117` and
`:239`, and that inconsistency is still on `main`.

---

## ⚠ `origin/staging` moved, by someone other than CC, and is unattributed

Measured this session:

| | |
|---|---|
| `origin/staging` | `a8c5e06c5a474f9dfd539c6d8c33c563f7a62d7f` |
| Subject | `feat(shell): the star count reads compact, and the rounding that reads as a defect (#363)` |
| Author | `Zugzwang/world <zugzwangworld@proton.me>` |
| **Committer** | **`GitHub <noreply@github.com>`** |
| Position | contained in `origin/main`; **behind it by exactly one commit** (#364) |

The ref moved between the SYNC-3 recon and the SYNC-3 execute, and **CC did not move it** — no
session in this task pushed `staging`. The committer identity is GitHub's own, so the ref move
carries no attribution beyond the account, and **it remains unattributed**.

⚠ **This is an `O-4` observation and it was NOT acted on.** Staging is one commit behind `main`,
and that commit is #364 — documentation only, so nothing served is stale in a way a user could
see. This session's kickoff forbids a staging push, so the gap is **recorded, not closed**. It
belongs with the standing `STAGING-AUTO-ADVANCE` gap and the open `O-4` exception row.

---

## Decisions made

1. **The identity-pool namespace is a HARDEN task with its own kickoff**, not a documentation
   sweep folded into another commit. Founder-ruled 2026-08-20; recorded on the row.
2. **Fixture size is a separate row from namespace definition.** `STAGING-POOL-UNDERSIZED` is
   about how many rows the load rig needs; `IDENTITY-POOL-NAMESPACE` is about what the tuples
   are. Merged, they would block each other and the fixture would wait on a ruling it does not
   need.
3. **The `CLAUDE.md` §5.10 cascade-exemption paragraph was NOT applied.** Its kickoff item carries
   the stop condition *"HALT AND REPORT if the founder has not ratified this"* together with the
   statement that the kickoff *"carries it as recommended, not ruled."* The condition fires on the
   kickoff's own evidence. `CLAUDE.md` is untouched by this branch.

---

## Open questions

- **The §5.10 cascade exemption — ratified or not?** The text is drafted and its anchor
  (`CLAUDE.md:131`, `### 5.10 Pre-PR self-audit`, verified unique) is known, so a ratified pass
  applies it in one edit. ⚠ It interacts with this log: the Gate C exception above is exactly the
  kind of per-PR grant such a rule would govern.
- **Does the production identity-pool seeder inherit the dev seeder's one-number-per-pair shape?**
  UNMEASURED. `scripts/seed-identity-pool.ts` ingests an external CSV manifest that is not in the
  repository, so nothing on `main` answers it.
- **Padded or unpadded numbers?** Decides the namespace by a factor of ~1,000. No migration either
  way — `number` is `smallint NOT NULL` and `(colour, animal, number)` stays unique.
- **`SCAFFOLD.17`'s two count predicates** (`:117` `>= 50000` vs `:239` *must equal*) — still
  contradictory on `main`, unowned.

---

## Next session starts at

**The PK drag.** The staged set is at `~/Desktop/zz-pk-refresh-SYNC-3/` — 25 files plus
`MANIFEST.md`. The exact next action is **Batch 0 of that manifest: dump all seven CLASS A records
to disk and confirm them on disk, before any purge runs.** Nothing else in the batch order may run
first; CLASS A is the only irreversible step and none of those seven is on `main`.

---

## Context to preserve

- **`~/Desktop/zz-pk-refresh-SYNC-2/` was left in place, untouched.** The SYNC-3 stage is a new
  folder beside it. Neither was deleted; the kickoff forbids it.
- **This branch's own files are NOT in the PK stage** — they are unmerged, and PK takes `main`.
  `parked.md` in the staged set therefore does **not** contain the two rows this session wrote.
  That is correct and deliberate; it re-stages at the next refresh.
- **The Gate C exception above is the third round in a row where the diff did not reach the
  reviewer.** The transfer mechanism, not the report, is what has been failing.
- `docs/parked.md` is now 2,226 lines.

---

## Time

Session ran 2026-08-20, roughly 17:45–19:00 IST. Ground `9a694db`. Two commits on
`chore/sync-3-close`, both signed, `docs/**` only.
