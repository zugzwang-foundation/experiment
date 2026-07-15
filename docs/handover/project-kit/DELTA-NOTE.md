# DELTA-NOTE — package pin `31d8965` → kit pin `e28d4b6`

**Dated:** 2026-07-15 · **Derived live** from `git log --first-parent --oneline 31d8965..e28d4b6`
**Why you care:** the EXTAUDIT-00..04 package *and* the EXTAUDIT-05 deck are both pinned to
`31d8965` (the #219 squash, 2026-07-07). This kit is pinned to `e28d4b6`. Four squash-merge
commits sit between them.

---

## The four commits

| SHA | PR | What it is | Touches |
|---|---|---|---|
| `b4daa9c` | [#220](https://github.com/zugzwang-foundation/experiment/pull/220) | The EXTAUDIT-05 handover deck itself (md + html render + link verifier + a Biome rider) | `docs/handover/`, `docs/plans/`, `scripts/verify-handover-links.sh`, `biome.json` (7-line rider) |
| `074ea31` | [#221](https://github.com/zugzwang-foundation/experiment/pull/221) | Session log for the deck close-out + one parked-register row (a known unused-import Biome warning) | `docs/logs/`, `docs/parked.md` |
| `858598f` | [#222](https://github.com/zugzwang-foundation/experiment/pull/222) | BRIDGE: the branded dark design-token layer (values-log v0_3 §3) | `src/app/globals.css`, `tests/unit/design/`, `public/brand/`, design docs + brand records, `AGENTS.md` §8, plan/log |
| `e28d4b6` | [#223](https://github.com/zugzwang-foundation/experiment/pull/223) | Pre-EXTAUDIT-06 canon hygiene: root `REVIEW.md` → supersession note; AGENTS/CLAUDE currency fixes; README deck pointer | `REVIEW.md`, `AGENTS.md`, `CLAUDE.md`, `README.md` |

## What this means for your review

**Zero backend / schema / spec-semantics change.** Plainly:

- No commit in this window touches `src/server/`, `src/db/`, `drizzle/migrations/`, or
  any API route. Migration head is `0023` at both pins.
- No spec semantics moved: `docs/specs/` is byte-identical across the window
  (SPEC.1 stays 1.0.14, SPEC.2 stays 1.0.17).
- The only code-touching commit is **#222**, and it is styling-only: CSS design tokens in
  `globals.css`, their unit-test guard, and a brand SVG. Frontend design is out of your
  charter scope anyway.

**Consequences for the documents you hold:**

- The **EXTAUDIT-05 deck remains fully current for Parts A and B** — the system map and
  the 218-commit chronicle describe a tree whose backend is unchanged at `e28d4b6`.
  (Part C's live-environment probes carry their own as-of stamps by design.)
- The **canon files in this folder (`CLAUDE.md`, `AGENTS.md`, `README.md`) are MORE
  current than at the deck pin** — #223 is precisely the hygiene pass that refreshed
  them for this handover. Where deck prose and canon prose differ on currency detail,
  prefer the canon in this folder.
- Root `REVIEW.md` became a supersession tombstone at #223 — the instruction in
  `00_START-HERE-PROJECT.md` (overwrite it in your fork per EXTAUDIT-02 §2.2) exists
  *because* of that commit.

## Reproduce this note

```bash
git fetch origin
git log --first-parent --oneline 31d8965..e28d4b6
git diff --stat 31d8965..e28d4b6 -- src/ drizzle/ docs/specs/   # → styling-only src delta, nothing else
```

---

*EXTAUDIT-06 kit · file 3 of 7.*
