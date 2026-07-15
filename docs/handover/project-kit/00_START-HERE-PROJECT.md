# 00_START-HERE-PROJECT — the reviewer Claude-Project kit

**Dated:** 2026-07-15 · **Pinned to:** `e28d4b6` (`origin/main` at kit authoring — the PR #223 squash)
**For:** the two-person external review team (holders of EXTAUDIT-00..04 and the EXTAUDIT-05 deck)

---

## What this folder is

The knowledge base for your **Claude Project**. Every file in it was staged by
`scripts/stage-reviewer-project.sh` from the live repo at the pinned SHA (plus the five
EXTAUDIT package documents you already hold). The manifest — every file, its repo path,
its role, its currency — is `SOURCES.md`. Nothing in this folder is secret; it is the
backend + ops documentation corpus, curated.

The Project's Claude is a **non-ratifying product lead**: it explains, maps, and traces
this corpus for you. It does not decide anything, and it never writes code to this repo —
your findings-only charter (EXTAUDIT-01 §2) applies to it too. Scope is **BACKEND + OPS**:
the design corpus, the planning tracker, `docs/plans/`, and the ops-procedure runbooks
(deploy-pipeline, BREAK_GLASS, staging-provisioning) are deliberately absent — see the
exclusions table at the end of `SOURCES.md`.

## Read order

1. **This page**, then **`SOURCES.md`** — what is here, what is authoritative, and the
   per-file riders (known doc-drift you should not re-discover as findings).
2. **`DELTA-NOTE.md`** — what moved on `main` between the EXTAUDIT package pin (`31d8965`)
   and this kit's pin (`e28d4b6`). Short version: nothing that touches your review surface.
3. **EXTAUDIT-00 → 01 → 02** — your charter and process pack (you have read these; the
   Project's Claude needs them to know your mission). EXTAUDIT-03/04 are the per-dev
   probe bodies.
4. **EXTAUDIT-05 deck** — the commit-sequenced walkthrough. Part A is the system map;
   Part B ties all 218 first-parent commits to product; Part C is the ops story.
5. The four **quick-reference cards** minted for this Project: `CONSTANTS.md`,
   `DATA-MODEL.md`, `API-SURFACE.md`, `EVENT-CATALOGUE.md` — lookup tables derived from
   the live tree at the pin, so you don't have to re-derive them from the specs.
6. Everything else is reference: canon (`CLAUDE.md`, `AGENTS.md`), the specs
   (`SPEC.1`/`SPEC.2`/`cpmm`/`RANKING`/`debate-export`), and the 29 ADRs (the decision
   record).

## How this kit relates to what you already hold

- **EXTAUDIT-00..04** (issued 2026-07-10, pinned `31d8965`) own your **charter, scope,
  process, and probe methodology** — the *how* of the review. This kit does not restate
  any of it; where a card here touches process (e.g. findings mechanics, severity rubric,
  the refute-first harness), the answer lives in **EXTAUDIT-02**, not here.
- **EXTAUDIT-05** (the deck, also pinned `31d8965`) owns **orientation** — the system map
  and the build chronicle. The cards in this kit are *narrower and flatter*: single-topic
  lookup tables for retrieval, not narrative.
- **This kit** adds the manifest (`SOURCES.md`), the pin-to-live delta (`DELTA-NOTE.md`),
  and the four cards. That's all it adds.

## ⚠ The numbering trap (repeated from EXTAUDIT-00/04 — it bites)

Two invariant-numbering schemes exist and they **do not match**:

- The **EXTAUDIT package** numbers its five load-bearing invariants **INV-1…INV-5**
  (soulbound Dharma / mandatory commentary / append-only + frozen resolution / admin
  non-participation / moderation fail-closed).
- The **repo's own scheme** — `tests/invariants/`, `CLAUDE.md` §2, SPEC.1 §5 — is
  **INV-1…INV-4**: INV-1 = bet↔comment atomicity (mandatory commentary), INV-2 =
  no-overdraft/non-transferable Dharma, INV-3 = side-binding at post time, INV-4 =
  append-only resolutions.

So "INV-3" means *append-only* in the package but *side-binding* in the repo. **Map by
name, never by number.** Everything in this kit uses the **repo scheme** (INV-1..4, by
name + location `tests/invariants/I-<AREA>-NNN.<slug>.spec.ts`); no third scheme is
minted anywhere.

## The `REVIEW.md` instruction

Root `REVIEW.md` on `main` is a **supersession note** — a tombstone for the stale
2026-06-02 cold-repo review, retained only because review tooling reads the root path.
It is *not* review grounding. In **your fork**, overwrite it with your own grounding
skeleton per **EXTAUDIT-02 §2.2** before any agent runs — Anthropic's Code Review tooling
injects the repo-root `REVIEW.md` as the highest-priority instruction to every agent, so
a stale one poisons every run.

## Pinned vs live

Live repo: <https://github.com/zugzwang-foundation/experiment>. This folder is a snapshot
at `e28d4b6` — if `main` has moved since staging, `DELTA-NOTE.md` is the model for how to
read the gap (and the staging receipt in this folder records the exact staged-from SHA).

---

*EXTAUDIT-06 kit · file 1 of 7 · manifest in `SOURCES.md`.*
