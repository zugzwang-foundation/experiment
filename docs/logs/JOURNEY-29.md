# JOURNEY-29 — session log

**Task:** JOURNEY-29 · complete the journey document through the current HEAD
**Mode:** autonomous overnight — abbreviated recon → plan → execute → PR → report
**Branch:** `journey/29-act-viii` · **Base:** `origin/main` `ead741577b89849560ab3d3222a48b2a69bf18b7`
**Date:** 2026-09-03

---

## What landed

| Commit | |
|---|---|
| `386ee25` | `docs/journey/STYLE.md` (the style spec, byte-identical to the ratified source) + `docs/plans/JOURNEY-29.md` |
| `f9a222d` | three drift guards + a shared parser under `tests/unit/docs/`, and tier markers on all 341 existing entries |
| `3aa62a2` | `08-the-window.md` → `09-the-window.md`, heading retargeted, one README row |
| `2b4c2d4` | `docs/journey/08-the-instruments.md` — front matter, bridge, three Landmarks |
| `d9bdbac` | 65 Chapters |
| `06df24e` | 18 Groundwork |
| `9768948` | README counts reconciled ×2, eleven note bodies as files, the `CLAUDE.md` §5.13.1 count sentence |
| `2931e8a` | the reviewer cascade's fixes — 14 findings from `@test-writer`, 5 from `@security-auditor` |
| `e649094` | 83 entries cut back after the cascade found them written to the ceiling rather than to the commit |
| `00f1cf1` | a note boundary a calendar date cannot express, and a count that contradicted itself |
| `2181459` | eleven note bodies regenerated after the cut invalidated them, plus the guard that stops it recurring |
| `547bf68` | the apply instructions forbade globbing directly above a loop that globs — plus the recovery path, and a block the operator's shell could not run |
| `13058ca` | the bridge-scan fix had reopened its own hole; three more guard holes closed |

**PR:** *(see the run report — opened against `main`, left unmerged)*

The document goes from 341 entries in eight acts to **427 entries in nine**. Act VIII is
`n347–433`, 18 August – 3 September 2026, 87 commits → 86 entries.

## Decisions made

- **The act's name was measured, not chosen.** Style spec §11.1's rule, applied across all 87
  commits rather than the twelve Landmark candidates (§6.1 — a selection rule that hunts for a
  theme returns that theme): **49 / 87 = 56.3 %** against a 25 % threshold → **The Instruments**.
  Every candidate faced three independent refuters; six of an initial 55 did not survive.
- **The Window renumbers VIII → IX.** Cheapest thing to move is the act with no entries in it. A
  "VII-B" would have been the only non-numeral act and would read as an appendix.
- **Tier markers are HTML comments after the mono line.** Invisible when rendered, so 340 published
  records read exactly as before; after the mono line so every existing assumption about where a
  mono line sits still holds.
- **Two unfixable states are pinned, not exempted** — one Landmark seven words over its ceiling,
  one title deliberately printed twice. Both still red if they move.
- **The eleven note bodies are files, not notes.** `refs/notes/commits` is shared, unlocked and has
  no review surface.
- **Twelve ambiguities resolved without an operator**, each with the alternative rejected — the
  register is §7 of the run report.

## What the reviewers found, and it was worth running them

- **`@test-writer` returned a CRITICAL about my own output, not about the tests.** The word-ceiling
  guard's docblock claimed to catch inflation; it catches breach. And inflation had happened — this
  act's 65 Chapters averaged 86 words against 67 for the 118 written before, 41 within three of the
  ceiling and 19 at exactly 89 or 90, against **one** entry above 87 in all seven prior acts. A
  ceiling sees the line, never the distribution beneath it. Fixed editorially (`e649094`) and in the
  docblock: Chapters now mean 77, max 85, **zero** within three of the ceiling.
- **An act file could have left all three guards in silence.** They find files by name pattern and
  were floored at 300 entries — which against 427 tolerates losing a fifth of the corpus. Renaming
  one file dropped 86 entries and everything stayed green. Now the nine filenames are pinned and the
  count is derived a second way, by walking the directory rather than the pattern.
- **2,000 words of bridge prose were scanned by nothing.** Fixed — and fixing it let the §11 length
  rule run against bridges for the first time, which found that Act IX's bridge is 342 words against
  a range ending at 250. Pinned, not rewritten.
- **`@security-auditor` found no CRITICAL and no HIGH**, and states it tried to construct one. Its
  MEDIUMs were about the apply path for the eleven notes: the instruction globbed the directory, and
  eight of eleven targets are lookalike merge hashes typed by hand. Both fixed — the list is explicit
  and the commands derive the hash from the filename.

## The cascade, and where it stops

Three reviewers ran; two ran again scoped to their own fixes. **Both second rounds found real
defects in the first round's fixes** — F-11 twice, in both lanes. 34 findings; 30 fixed, 3 declined
with reasoning, 1 accepted-and-reported.

**It is stopped deliberately, not because it converged.** The third round's fixes are plant-verified
but not independently re-reviewed. This is not a critical path — no `src/`, no schema — and the run
ends at an unmerged PR where a human reads the diff. **A scoped re-review of `547bf68` and
`13058ca` is owed.**

## The defect worth carrying forward

**The cut invalidated all eleven note bodies and every review had already cleared them.** The
bodies are generated from the act entries, were verified byte-identical by the security audit, and
then the entries were cut in a later commit answering a different finding. Nothing regenerated
them; nothing noticed. The only symptom would have been a permanent note on a shared ref saying
something slightly different from the published record.

The narrow lesson is not "re-review fixes" — that rule already existed and the re-audit was already
running. It is: **a generated artifact checked once is not checked. Assert the derivation, not the
output.** Three separate reviews verified the identity by hand and it broke behind all of them,
because nothing was watching the relationship — only the values it produced at one moment. There is
now a test for it.

## Open questions

- **Six findings are flagged and deliberately unfixed** (run report §10): two clauses in
  `CLAUDE.md` §5.13.1 outside RF-6's one-sentence scope, two in the style spec, the Act IX bridge's
  closing statistic now describing a corpus that grew, and an open PR carrying a retired marker.
  The web lane authors those.
- **`docs/journey/09-the-window.md` now disagrees with the index it sits beside.** Its bridge says
  "a fifth of the commits behind this document explain nothing about themselves"; the README was
  corrected to "about a sixth" because the denominator grew from 346 to 433 (measured 77/433 =
  17.78%). Its "one in twenty" clause has drifted the same way — 1-in-34.5 over the newer window.
  **Declined rather than fixed**: the ruling forbids rewriting that bridge, and it is provisional
  until go-live. Whoever writes the forward half inherits both figures.
- **The style spec dates the convention to 2026-08-17 in three places**, which is the UTC reading of
  a corpus that is wholly committer-local, and its Act VIII row still reads `n347–HEAD | 18 Aug –
  15 Sep` against a built `n347–433`, 18 Aug – 3 Sep. Flagged, not amended — the wall forbids it.

## Next session starts at

**Read the eleven files in `docs/journey/notes-owed/`, then attach and push them** —
`git notes add -F docs/journey/notes-owed/<file> <sha>` per file, then
`git push origin refs/notes/commits`. That reading is the review the notes ref otherwise has none
of. Do it only after this PR is reviewed and merged.

## Context to preserve

- **`git notes list | wc -l` is 343 and must stay 343 until a human applies those eleven.** It was
  343 at the start of this run and 343 at the end; it is the canary for the one operation in this
  task with no review surface.
- The four recon artifacts in `~/Downloads` are pinned by md5 and were verified before reading;
  they are not to be regenerated, because regenerating at a moved HEAD changes the corpus under
  work already done.
- **A reviewer briefed to plant violations is a writer.** Running one against the same worktree as
  the build reverted an uncommitted edit via its own `git checkout --` restore. Reviewers that
  plant get their own worktree, or they run when nothing else is building.

## Time

One session, 2026-09-03. Recon was pre-existing and was not re-run.
