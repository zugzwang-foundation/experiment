# WARLI-FIT — session log

**Task:** WARLI-FIT · fit the artwork by filling the frame, not by shrinking it into one
**Branch:** `feat/warli-fit` · **PR:** #450 (MERGED) · **Base:** `b2da687`
**Canonical SHA:** `35e980949f24a4639e8d7d8c92a5fd8308ef75e4` — the squash-merge on `main`
**Merged:** 2026-09-01T05:42:16Z · **Mode:** autonomous overnight run, no operator gates

---

## ⚠ THIS LOG IS A RECONSTRUCTION, WRITTEN AFTER THE FACT

**It was not written from the session.** It was assembled at NIGHT-1 on 2026-09-02
from four sources, none of which is a session log: the merged PR body, the squash
commit on `main`, `git show --stat` on that commit, and the operator-staged run
report `zz_WARLI-FIT_2026-08-31T2020.md` — named rather than linked, because it
lives in `~/Downloads` and is **not resolvable from this tree**. The eight
screenshots it cites (`zz_WARLI-FIT_{meet,slice}_{1920x1080,1512x860,1440x900,390x844}.png`)
are in the same place and under the same caveat.

**What a contemporaneous log would have carried and this one cannot:**

- **The order in which things were understood.** The run report presents a settled
  argument. A log written at the time would have said which measurement came first
  and which reading it overturned — and for this task that matters, because the
  parked row it discharges had itself been *wrong once* (it compared the outer
  ring's diameter to the card's width before `@code-reviewer` re-derived it against
  the half-diagonal).
- **Anything considered and dropped without reaching the report.** Only
  `preserveAspectRatio="none"` is recorded as rejected, and it is recorded because
  it was worth a warning. Whatever else was weighed left no trace.
- **The actual elapsed time and where it went.** The stamps below are commit and
  merge times, not working time.
- **Whether anything surprised the session.** There is no §5.10 SURPRISE record for
  this task, and a reconstruction cannot manufacture one.

---

## What landed

**One line.** `src/components/art/warli/hero.tsx` — the hero `<svg>` gains
`preserveAspectRatio="xMidYMid slice"`. `1 file changed, 1 insertion(+)`. No
viewBox change, no geometry, no seed, no element. It changes **how** the existing
drawing is fitted, never **what** it draws.

Verified at `origin/main` = `4c041633` during this reconstruction:
`hero.tsx:336` is exactly `preserveAspectRatio="xMidYMid slice"`, and
`R_INNER = 330` still sits at `hero.tsx:53`.

## Decisions made

1. **`slice`, not a composition change.** `R_INNER = 330` is derived from the auth
   card's half-diagonal, and `hero.tsx`'s own docblock states the consequence:
   shrink it and the card's corners eat figures. The attribute was **absent**, so
   SVG defaulted to `xMidYMid meet` — fit the whole viewBox and letterbox. That
   scales the ring with the viewport while the card stays a fixed 416 px, which
   turns a stated guarantee into a function of window size. `slice` inverts which
   constraint yields: cover the viewport, let the overflow leave the screen.

2. **Clearance measured at four viewports, both builds, signed out.** Each width
   pinned in a same-origin iframe with `throw`-on-mismatch on **both** `innerWidth`
   and `innerHeight`; `document.fonts.status === "loaded"` asserted; animation and
   transition killed before reading; build identity fetched in the **same call** as
   the geometry.

   | viewport | inner ring R: meet → slice | card worst corner | meet | slice |
   |---|---|---|---|---|
   | 1920 × 1080 | 356.4 → 440.0 px | 291.3 px | ✅ +65.1 | ✅ +148.7 |
   | **1512 × 860** (MBP 14″) | 283.8 → 346.5 px | 291.3 px | ⛔ **−7.5** | ✅ +55.2 |
   | 1440 × 900 | 297.0 → 330.0 px | 291.3 px | ✅ +5.7 | ✅ +38.7 |
   | **390 × 844** (phone) | 89.4 → 278.5 px | 271.4 px | ⛔ **−182.0** | ✅ +7.1 |

   **meet clears 2 of 4. slice clears 4 of 4.**

3. **The cost was measured, not estimated, and stated before approval.** `slice`
   fills by cropping. At every desktop width the **top and bottom** border bands
   leave the screen; on the phone the **left and right** do. The piece stops
   reading as a closed rectangle and starts reading as a window onto something
   larger. That is a composition judgement, and it was routed to the founder rather
   than absorbed.

4. **`preserveAspectRatio="none"` was never a candidate and is recorded so it does
   not become one.** It would fit every viewport exactly and turn the rings into
   ellipses — the one thing this drawing cannot survive.

## Open questions

- **None blocking.** The composition judgement was put to the founder with both
  builds side by side and **ruled acceptable on 2026-09-01**; that ruling is what
  discharges WARLI-3 item 5.
- **390 × 844 clears by 7.1 px** — a pass, and a thin one. A slightly taller card
  or a shorter phone viewport puts it back under. Nothing guards this today.
- **The border's behaviour under `slice` now belongs to WARLI-3 item 3, not item
  5.** The asymmetric border proposed there assumed all four bands were always
  visible, and that premise no longer holds.

## Next session starts at

**Nothing is owed by this task.** WARLI-3 item 5 is discharged and says so as of
NIGHT-1 (`docs/parked.md`, the WARLI-3 row). The live successor is **WARLI-3 item
3**, whose premise this change invalidated — re-derive the border proposal against
a frame that crops, before proposing an asymmetry for bands that may not be on
screen.

## Context to preserve

- **Reverting is one line.** If the founder's answer ever changes, delete the
  attribute; nothing else depends on it.
- **The clearance predicate is `R_INNER · scale > 291.3`**, i.e. `scale ≥ 0.8827`
  — the inner ring's radius against the card's half-diagonal. **Not** the outer
  ring's diameter against the card's width. That wrong pair was published once and
  inverted the answer at four of eight viewports.
- **`tests/unit/art/` was untouched and stayed green (93 tests).** Nothing in the
  composition suite can see `preserveAspectRatio` — it is a fitting rule applied by
  the browser, not a property of the drawing. **A green art suite is not evidence
  about this change**, and a future session should not read it as one.

## Time

Commit authored 2026-09-01T11:12:15+05:30; PR #450 merged 2026-09-01T05:42:16Z.
Working time is not recoverable from the repository.
