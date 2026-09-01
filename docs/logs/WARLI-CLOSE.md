# WARLI-CLOSE — session log

**Covers two sessions, deliberately in one file:** `WARLI-CLOSE` (merge #438) and
`WARLI-CLOSE-2` (the amendments it could not land). They are one close-out arc
split by a blocking event, and two near-identical logs would be worse than one
that says so.

⚠ **This log is itself a §5.9 correction.** `WARLI-CLOSE` ended without one — the
run report went to `~/Downloads` and the in-repo log was never written. Caught at
`WARLI-CLOSE-2` by being asked whether it existed. `docs/logs/` is for the execute
build, and a merge session is one.

---

## What landed

**`WARLI-CLOSE`** — PR #438 squash-merged. `origin/main` = **`ab0f23b0274e8119034b1d2929fa33fb8a13cd99`**,
measured with `git rev-parse`, not read off the API. Branch deleted after a
zero-diff proof. PR #439 opened (WARLI-3 docket row in `docs/parked.md`),
unmerged.

**`WARLI-CLOSE-2`** — branch `chore/warli-close-2` off `ab0f23b`:

| File | Change |
|---|---|
| `docs/polish/POLISH-0_data-manifest.md` | **V-15, V-16, V-17** + five consistency sites |
| `docs/polish/POLISH-register-ADDITIONS.md` | **L-10** as a new §E, + a checklist entry |
| `docs/overnight-run.md` | **OVN-O8**, **OVN-V9**, **F-14**; OVN-O2 corrected in place; v1.1 → v1.2 |
| `docs/logs/WARLI-CLOSE.md` | this file |

---

## Decisions made

1. **Ceilings were read from the files, never counted or recalled.** V-14 defined
   (V-15 present only as the number the unnumbered PROPOSED row *declines*); L-9;
   OVN-O7; OVN-V8; F-13. ⚠ My first read of the OVN ceilings was **wrong** —
   `sort -t O` splits inside `OVN-O3`, collapsing every entry to one key and
   reporting a ceiling of 1. A delimiter that occurs inside the data is not a
   delimiter.
2. **L-10 filed as a new §E with a table row**, matching §A–§D's shape, rather
   than appended as loose prose. Its note states at length that it is **distinct
   from the `??=` env leak** — both present as *"tests I didn't touch went red
   after a build"*, and they have different causes and opposite fixes.
3. **The V entries record a weaker provenance than V-14's.** V-14 was
   founder-authored and committed verbatim; V-15/16/17 were founder-**specified**
   in the kickoff and **session-drafted**. §0 I1 says so, so a later reader weighs
   them correctly rather than assuming parity.
4. **v1.8's missing §0 block was NOT backfilled.** H2's reason still binds: its
   content is the founder's to state. Recording my own amendment is required;
   writing another version's is not mine to do.
5. **Nothing was cross-listed.** V-space, L-space and the doctrine each carry
   their own material and cross-reference the others. OVN-O8 and OVN-V9 point at
   V-17, V-12 and V-16 by number without restating them.

---

## Open questions

- **There is no rAF fallback list in `docs/overnight-run.md` to correct.** The
  list the kickoff refers to lived in the WARLI-2 *task brief*, which is not in
  the repo — `getAnimations` appears nowhere under `docs/`. The corrected
  guidance is therefore landed as **new** material (OVN-V9) rather than as an
  edit, and that is a reading of intent rather than a transcription. Flagged for
  the founder.
- **`V-15` was the number the PROPOSED row was declining.** Minting it moved that
  pointer to `V-18`. If the intent was for that row to keep declining `V-15`
  specifically, this needs reversing.

---

## Next session starts at

Founder reads PR #441 (this branch) and PR #439 (the WARLI-3 docket row). Both
unmerged. Then: stage the three amended files into PK — they were **withheld**
from the `WARLI-CLOSE` refresh precisely because they were pre-amendment, and
`~/Desktop/zz-pk-refresh-WARLI/MANIFEST.md` records the gap.

---

## Context to preserve

- **The local suite's parallel-DB fragility is now seen THREE times** and is the
  most durable finding of the arc: `act.test.ts` (residue direction), then
  `audit-search` / `rank-decay-parity` / `image-block` (missing-rows direction).
  Every sighting **rotates**, passes in isolation, and is invisible to CI, which
  gets a clean service container. Filed as **L-10** for the build-ordering half;
  the parallel-truncation half is in `claude-progress.md` and is still unowned.
- **A green claim must name the SHA it was measured against** (V-14). The merge
  head was `1f08b10`, not the `8a18830` the previous session's final report
  quoted — a session-log commit landed in between.
- **`gh pr merge` can print an error while the merge succeeds.** Its local
  post-merge checkout fails when `main` is checked out in another worktree.
  Read as failure, it invites a retry against an already-merged PR — and
  `--delete-branch` silently does not run.

---

## Time

`WARLI-CLOSE` 2026-08-30 12:12–12:30 UTC · `WARLI-CLOSE-2` 2026-08-30 16:44 UTC.
Run reports: `~/Downloads/zz_WARLI-CLOSE_2026-08-30T1212.md` and
`~/Downloads/zz_WARLI-CLOSE-2_2026-08-30T1644.md`.
