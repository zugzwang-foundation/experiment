# Zugzwang — Design Handoff (how we deliver to Claude Code)

> **Doc:** `docs/design/design-handoff.md`
> **Status:** v0.2-draft · delivery contract
> **Phase:** experiment-phase VISUAL stratum
>
> **What this is.** The contract for delivering a signed-off surface from Claude Design (CD) to Claude Code (CC) for production build: what the handoff package contains, which route we use, which repo code CC builds against, the build instruction CC receives, the review ritual, the per-surface cadence, and the rule for keeping things in sync afterward.
>
> **What this is NOT.** It is not the produce-side — that is `design-workflow.md` (how a surface is made in CD). It is not the design *language* — that is `design-language.md`. It is not the *sequence* — that is the planner. This doc runs alongside `design-workflow.md` as the deliver-side of the same pipeline.
>
> **Grounding.** The handoff mechanics are distilled from the Claude Design research in PK — primary: `Research_Report_v2.md`; `Research_Report.md` (v1) §d remains valid background. The build ritual follows `CLAUDE.md` and `docs/workflows/plan-then-execute.md`; the stack references follow `AGENTS.md`.
>
> **Staging — read first.** Designing a surface and *building* it are separate moments. The VISUAL design bucket runs in parallel with the backend (ENGINE). Most surface builds (the UI / DEBATE tasks each surface maps to) depend on backend that may not exist yet. So a handoff **produces an approved mockup + a handoff package now**; CC **consumes it when the mapped build task is sequenced** and its backend dependencies are met. The design bucket delivers handoff packages, not finished screens.

---

## §1 — What a handoff is (two parts)

A handoff package is two things delivered together:

1. **The CD-native handoff bundle.** Claude Design's **Export → Handoff to Claude Code** packages: the design files as **standalone HTML with inline CSS/JS**, the **design tokens actually used on the canvas**, the **component structure / hierarchy**, a **README** instructing the consuming model how to interpret the designs, and the **chat log** carrying the design intent — not just a screenshot. This carries the *design*. *(The bundle's internal format is research-preview behaviour — version-sensitive, unpublished by Anthropic, and may change before GA. Verify the contents at the first real handoff.)*

2. **The web-authored build brief.** A pin-point instruction to CC (§4) that the generic CD bundle cannot know: our stack, the rule to rebuild against real repo components, the monochrome/desktop/branding-deferred constraints, the plan-first requirement, which subfolders to link, the mapped build task, the invariant-visual obligations, and acceptance. web Claude authors this (prescriptive-doc discipline). This carries the *instructions and guardrails*.

The bundle without the brief tends to produce plausible-but-off code (generic components, drifted spacing, accidental colour). The brief is what makes the build land against *our* codebase and *our* rules.

---

## §2 — Route: local coding agent (not Web)

CD's handoff offers two routes. We use **local**.

- **Send to local coding agent — our route.** Routes to Claude Code on the operator's machine, with direct access to the real repo. CC edits the actual files; the operator reviews diffs before they land. This is the only route compatible with our git discipline (branch protection, PRs, squash-merge, SSH signing, review gates).
- **Send to Claude Code Web — not our production route.** A cloud session that clones the GitHub repo into an Anthropic-managed VM. Requires GitHub; org IP allowlists block it; sessions must be on the same account to move between web and local. Acceptable only for a throwaway, low-sensitivity spike — never for a surface build that lands in `main`.

---

## §3 — What to link (production repo subfolders)

CC builds against the **real** production code. Link **specific subfolders, never the whole repo** (the tool lags and burns allowance on large trees, and the monorepo warning applies).

Link, for each surface:

- **The component library** — the shadcn/ui components and any shared UI components.
- **The design-token file** — `globals.css` (carries the monochrome token system; the brand accent is a later token-swap pass).
- **The surface's feature folder** — the route/feature directory for that surface.

Avoid linking anything containing secrets. **Exact paths are confirmed with CC against the live repo at handoff time** — this doc names the *categories*, not fabricated paths.

> **Distinct from the CD-seed kit.** The seed kit in `design-workflow.md` §7 is a small, local, throwaway folder that *teaches CD the look*. The subfolders here are the *real production code* CC *builds into*. Different folders, opposite directions, do not conflate them.

---

## §4 — The build brief (template)

The pin-point instruction CC receives alongside the CD bundle. web Claude fills it per surface.

```
SURFACE: [name] → maps to build task [UI.x / DEBATE.4]
STACK: Next.js 16 App Router, shadcn/ui, Tailwind, Drizzle, Better Auth
       (per AGENTS.md).

READ FIRST: CLAUDE.md, AGENTS.md, and the README. Then the CD handoff
bundle for this surface.

BUILD AGAINST REAL CODE: Rebuild this surface using the real components
in [component library] and the design tokens in globals.css. Do NOT
reproduce the CD bundle's inline styles verbatim — map them onto our
components and tokens.

PRESERVE THE APPROVED DESIGN: Preserve design intent; do not change
the approved design. Where mapping onto real components forces a
deviation, surface it in the plan for review — never absorb it
silently.

CONSTRAINTS:
- Monochrome only — implement in the monochrome token system. The brand
  accent is a later token-swap pass; do NOT introduce colour.
- Black = [Support/YES], white = [Counter/NO]; greys carry hierarchy.
- Desktop only, fixed max-width. NO responsive breakpoints this phase.

INVARIANT-VISUAL OBLIGATIONS (must hold — per design-language.md §4):
- Frozen YES/NO side badge on every post/reply; never changes.
- Position marker none/Flipped/Exited; no marker is the default.
- NO vote affordance anywhere (no up/down, no friendly-fire).
- Mandatory comment field on every buy; sell is the only comment-free
  action.
- Single-side UX; resolved/voided/frozen render read-only.

PLAN FIRST: Before writing code, plan the folder structure and the
component list, and show it for review (plan-then-execute).

ACCEPTANCE:
- Matches the signed-off mockup.
- Uses real components + globals.css tokens (no orphan inline styles).
- Monochrome; desktop fixed-width; no responsive.
- Passes the surface's checks (lint, types, the relevant tests).
```

The **invariant-visual obligations** are non-optional: they stop CC from quietly reintroducing a vote control, dropping the mandatory comment field, or letting a side badge mutate — the exact ways a UI build can silently break the thesis.

---

## §5 — Ritual: plan-then-execute applies

A surface build is non-trivial (over 30 lines, more than three files), so it runs the **plan-then-execute** workflow: the build brief seeds a plan-mode chat, CC writes a plan, web Claude reviews it, the operator ratifies, and a **fresh chat** executes from the committed plan, followed by the pre-PR self-audit. Standard git discipline throughout (chore/feature branch, PR into `main`, squash-merge, conventional commits, SSH signing).

The **debate view** (→ DEBATE.4) is the highest-stakes surface: it renders the commentary, moderation, and bet surfaces where the thesis lives, so it gets the most review attention and the build brief carries the full invariant-visual obligations. (DEBATE.4 itself sits on the critical path; its build is gated and reviewed accordingly.)

---

## §6 — Per-surface cadence + staging

- **One surface per handoff.** Small, reviewable PRs; each surface isolated. A change to one surface never forces re-handing-off the others.
- **Staged against backend.** Design sign-off produces the handoff package; CC consumes it when the mapped build task is sequenced and its backend dependencies are met. Design runs parallel to ENGINE; builds happen as their tasks come up — not all at once at the end.
- **Surface → build-task map** (the planner owns the exact sequence; this is the mapping):

| Surface | Build task | Notes |
|---|---|---|
| Discovery (market list) | UI.3 | |
| Market detail + bet flow | UI.4 | |
| Debate view | DEBATE.4 | Cross-lane; highest-stakes; critical path. |
| Profile (/me) | UI.5 | |
| Landing | UI.1 | May build directly from the design language without a CD mockup slot — planner decides. |

---

## §7 — After handoff: code is the source of truth

The design→code direction is strong; the **code→design direction is awkward** (CD does not cleanly re-absorb changed code). So:

- **Do not keep iterating a surface in CD after it has been built.** Once handed off and built, visual changes happen **in code** — code-level fixes happen in CC; never go back to CD to fix code.
- **The repo is the source of truth post-handoff.** Treat the built surface as canonical.
- **If a genuine fresh visual exploration is needed**, feed screenshots of the *live coded* surface back into CD for a new exploration, then re-hand-off — rather than diverging an old CD project from the shipped code.
- **Keep the linked subfolders current** so any later CD session extracts from the real, evolving components — not a stale snapshot.

---

## §8 — Out of scope for this doc (pointers)

- **The produce-side** (the per-slot loop, the CD prompt template, the seed kit) → `design-workflow.md`.
- **The design language** (tokens, primitives, constraints, state-shape rules) → `design-language.md`.
- **The slot sequence + paste-ready kickoffs + the placeholder/drift registers** → the planner.

---

> **Changelog.**
> **v0.2-draft (2026-06-04):** §1 bundle contents specified per current behaviour (standalone HTML + inline CSS/JS, on-canvas tokens, component structure, README, chat log) and flagged version-sensitive; §4 build brief gains the **PRESERVE THE APPROVED DESIGN** instruction (implement, don't redesign; deviations surfaced in the plan); §7 sharpened (code fixes in CC, never back in CD); grounding → `Research_Report_v2.md`.
> **v0-draft:** initial authoring (visual-backbone thread).

*End design-handoff v0.2-draft. Handoff mechanics from `Research_Report_v2.md` (verify CD route/bundle specifics if behaviour shifts); build ritual per `CLAUDE.md` + `plan-then-execute.md`; stack per `AGENTS.md`. The §3 production subfolders are distinct from the CD-seed kit in `design-workflow.md` §7.*
