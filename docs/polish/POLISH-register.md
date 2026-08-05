# POLISH — Defect Register

> **Doc:** `POLISH-register.md` · **PK-primary**, web-authored from operator captures. Committed 2026-08-05. GitHub is canonical; PK is the mirror.
> **Status:** scaffolded 2026-07-30 IST at POLISH.0. **No surface has been inspected.**
> **Governed by:** `POLISH-0.md` §4 (schema) and §5 (routing). Read those first.

---

## How to use this

One row per defect. Web authors rows from the operator's captures; the operator ratifies dispositions; **only the founder may set `accepted-divergence`** (P12).

**ID:** `PD-<surface>-<nn>` — surface is the POLISH number (`3`, `7a`, `7b`). Stable forever. Never renumbered, never reused.

**The `baseline` field is the gate.** If you cannot name the tier and the document a thing violates, it is **not** a visual defect — it is class **S**. That test is what keeps this register from becoming taste.

**Class:** V visual · F functional · B backend gap · S spec gap · R ruling needed.
**Disposition:** `routed` · `superseded` · `data-blocked` · `duplicate-of-known` · `accepted-divergence`.
**Status:** `open` · `routed` · `fixed` · `verified` · `closed`.

**At each surface close:** emit a batched summary row into the tracker. Never row-by-row.

**Row template — copy this:**

```
| PD-n-01 | <one-line title> | V | tier-2 · canon §10 R-5 | POLISH-n_<surface>_<state>.png | routed | open | — | <PR / tracker row / halt> |
```

---

## POLISH.1 · Shell + branded header/nav

*Not yet inspected. Gates: B4 · B8 · B10.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## POLISH.7a · Auth surfaces

*Not yet inspected. No gates — ships now.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## POLISH.2 · Discovery

*Not yet inspected. Gate: B2.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## POLISH.3 · Market Detail

*Not yet inspected. Gates: B1 · B2 · B3 · C3.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## POLISH.4 · Composers + Sell module

*Not yet inspected. Gate: B1.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## POLISH.5 · Profile

*Not yet inspected. Gate: B1.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## POLISH.6 · Bookmarks

*Not yet inspected. Gate: B1.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## POLISH.8 · Admin Centre

*Not yet inspected. No gates — pullable forward.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## POLISH.7b · Onboarding deck + coach-marks

*⛔ Blocked on O1.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

---

## Pre-recorded — found at POLISH.0, before any inspection

These were found by recon, not by a polish pass. **If an inspection re-discovers one, it takes disposition `duplicate-of-known` and cites the ID here — it does not become a second row.** IDs are `PD-0-nn` because POLISH.0 found them.

| ID | Title | Class | Baseline | Surfaces | Disposition | Status | Routed to |
|---|---|---|---|---|---|---|---|
| **PD-0-01** | `<Plus /> Full` where CD-A ratified a **"Read more"** text link. `Read more` has zero occurrences repo-wide | V | tier-2 · CD-A close-out, 2026-07-14 | .3 · .5 · .6 | routed | **pending R4** | B11 · CC-LIGHT |
| **PD-0-02** | `PostCard` `Đ BET` and `Support / Counter` are **literal `disabled`** — no auth prop reaches the component. Signed-in participants see *"sign in to bet"* | F | tier-4 · d5 mockup `:1099-1103`, `:1246-1250` (live handlers) | .3 | routed | **pending R1** | B6 · CC-HEAVY. **ADR-0034 D-1 constraint applies** |
| **PD-0-03** | `PostPopup` at `max-w-lg` (~512px) vs CD-A's 720px; `max-h-[80vh]` vs 90vh; **no `SideBadge` at all** — bare interpolated text; CD-A header row absent | V | tier-2 · CD-A | .3 | routed | **pending R5** | B7a · CC-LIGHT. **Blocked on C3** |
| **PD-0-04** | CD-A's Support/Counter footer + stake bar, and the reply-variant pop-up, are unbuilt. `ReplyPopup` → zero matches | B | tier-2 · CD-A | .3 | routed | **pending R6 — deferred** | — |
| **PD-0-05** | No global banner anywhere. The **2026-11-05 freeze** has no site-wide surface — freeze copy is composer-scoped and surfaces only after a failed write | F | tier-2 · W2.11 **P4**, *"the one loud participant read-only event"* | .1 | routed | **pending R2** | B8 · CC-HEAVY |
| **PD-0-06** | `not-found.tsx` exists nowhere; no `global-error.tsx`. `notFound()` fires from six live sites incl. `/m/[slug]` on unknown **or Draft** slugs | F | tier-1 · the routes throw it | .1 | routed | **pending R3** | B10 · CC-HEAVY |
| **PD-0-07** | `text-white` at `audit/page.tsx:75` — the only Tailwind palette colour class in `src/`, bypassing the `--color-*` layer | V | tier-2 · token contract v0.4 | .8 | routed | **pending R7** | B12 · CC-LIGHT |
| **PD-0-08** | Five loading skeletons shipped; **W2.11 T1 ratified none**, and the locked kit P1–P6 has no loading primitive | R | tier-2 · W2.11 T1 | .1 · .2 · .5 · .6 | — | **pending R8 — no default** | founder |
| **PD-0-09** | At least five distinct empty-state implementations; **W2.11 P1 locked one shape** | V | tier-2 · W2.11 P1 | .2 · .5 · .6 | routed | **pending R9** | per-surface V batch |
| **PD-0-10** | Three `PositionMarker` implementations — `badges.tsx` (`secondary` + `aria-label`) vs hand-rolled `outline`, no `aria-label`, in `ArgumentList` and `BookmarkCard`. Side chips likewise hand-rolled | V | tier-2 · one component, one treatment | .5 · .6 | routed | **pending R12** | **root cause: primitive duplication.** Check at B1's PR whether it rewrote `BookmarkCard`; do **not** add scope to B1 |
| **PD-0-11** | Price-bar percentage labels are non-interactive (`role="img"`); the mockup wires them to `pick()` | R | tier-4 · d5 `:1038`/`:1040` | .3 | **accepted-divergence** *(proposed)* | **pending R10** | canon §10 |
| **PD-0-12** | Sell button is **hidden** when ineligible, not disabled. W2.10 Option A never specified which | R | — (unspecified) | .5 | **accepted-divergence** *(proposed)* | **pending R11** | canon §10 |
| **PD-0-13** | `design-language.md:178`, `:227` still describe the debate mode selector as real — **known-stale**, flagged at `DEBATE.4.md:44`, never corrected | S | tier-2 · a baseline document is wrong | all | routed | **pending R19** | correct at C3, same commit as CD-A |
| **PD-0-14** | Turnstile is not wired — placeholder token, staging on always-pass test keys. W2.1's three ratified Turnstile states cannot be exercised | — | tier-2 · W2.1 | .7a | **data-blocked** | open | AUTH-TURNSTILE-WIRE |
| **PD-0-15** | Raw error codes (`otp_invalid`, `rate_limited`) render to users | V | tier-2 · canon §6 copy | .7a | routed | open | AUTH-ERROR-COPY |
| **PD-0-16** | The chart's **expanded-overlay** variant has no tier-2 or tier-4 baseline; values-log branded three renders, four exist | S | — (no baseline of any tier) | .3 | — | **pending R13** | verify SPEC.CHART covers it; if not, SPEC-FIRST halt |

---

## Duplicate-of-known — Phase B defects, already owned

Do **not** open register rows for these. They are being fixed before their surfaces are inspected.

| Known defect | Surfaces | Owner |
|---|---|---|
| **BOOKMARK-ADD-WIRE** — the add path is inert across Market Detail, Profile and Bookmarks | .3 · .5 · .6 | B1, plan phase live; ADR-0034 is its execute gate |
| **PCT.ROUND** — YES% + NO% can render **101** | .2 · .3 | B2 |
| **F-DEBATE-4** — interval polling on `/m/[slug]`, unverified | .3 | B3, pending RECON-2 |
| **UI.11** — no AGPL source offer exists anywhere in the shell | .1 | B4 |

---

*Scaffolded by web Claude, 2026-07-30 IST. Sixteen pre-recorded rows, none from an inspection. Rows marked "pending Rn" resolve when `POLISH-0_ruling-register_r2.md` is ratified.*
