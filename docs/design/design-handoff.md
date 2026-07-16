# Zugzwang — Design Handoff (how we deliver to Claude Code)

> **Doc:** `docs/design/design-handoff.md`
> **Status:** v0.6-draft · delivery contract · **realigned to the branding/handoff decision record 2026-07-03**
> **Phase:** experiment-phase VISUAL stratum
>
> **What this is.** The contract for delivering a signed-off surface from Claude Design (CD) to Claude Code (CC) for production build: what the handoff package contains, which route we use, which repo code CC builds against, the build instruction CC receives, the review ritual, the per-surface cadence, and the rule for keeping things in sync afterward.
>
> **What this is NOT.** It is not the produce-side — that is `design-workflow.md` (how a surface is made in CD). It is not the design *language* — that is `design-language.md`. It is not the *sequence* — that is the planner. This doc runs alongside `design-workflow.md` as the deliver-side of the same pipeline.
>
> **Grounding.** The handoff mechanics are distilled from the Claude Design research in PK — primary: `Research_Report_v2.md`; `Research_Report.md` (v1) §d remains valid background. The build ritual follows `CLAUDE.md` and `docs/workflows/plan-then-execute.md`; the stack references follow `AGENTS.md`.
>
> **Staging — read first.** Designing a surface and *building* it are separate moments. The VISUAL design bucket runs in parallel with the backend (ENGINE). Most surface builds (the UI / DEBATE tasks each surface maps to) depend on backend that may not exist yet. So a handoff **produces an approved mockup + a handoff package now**; CC **consumes it when the mapped build task is sequenced** and its backend dependencies are met. The design bucket delivers handoff packages, not finished screens.
>
> **This doc is the one place the two lanes cross.** Upstream of the handoff is the **design lane** (operator + CD, no Claude Code, no plan-then-execute, no PR). Downstream is the **code lane** — the build is a code task and runs the **full CC ritual** (plan-mode → fresh-chat execute → pre-PR audit → PR; §5). The ritual attaches to the **build**, never retroactively to the mockup. web Claude switches lanes here deliberately; it does not blend them.
>
> **Realignment (2026-07-03).** Per `ZUGZWANG-CD_branding-handoff-decision-record_v1_0.md` (CANON): branding is set **once at the CD design-system level**, its **values** land in the repo tokens (`globals.css`), and each surface is built by CC from its **locked repo mockup (layout) + branded repo tokens (look)** — the CD **export bundle is a lossy reference, not canon**. Branding **fully precedes** all surface builds (sequential). This updates §1 (handoff unit), §3/§4 (build against the already-branded tokens), and §6 (DESIGN.HANDOVER framing).
---

## §1 — What a handoff is (four parts)

A handoff package is four things delivered together:

1. **The locked surface source (layout) + the branded repo tokens (look).** Under the 2026-07-03 realignment (`ZUGZWANG-CD_branding-handoff-decision-record_v1_0.md`), the **layout** comes from the surface's **locked repo mockup** (the artifact in `docs/design/mockups/`, per design-canon §8), and the **look** comes from the **branded repo tokens** (`globals.css`, value-swapped from the CD branding session at the bridge stage — decisions 7/8). The Claude Design **export bundle** (standalone HTML + on-canvas tokens + component hierarchy + README + chat log) may be attached as a **lossy visual reference**, but it is **not canon** and is never reproduced verbatim — it applies brand colour too liberally and its format is research-preview. *(The bundle's internal format is version-sensitive, unpublished by Anthropic, and may change before GA — verify at the first real handoff.)* This carries the *design*: locked mockup + branded tokens, reference bundle optional.

2. **The web-authored build brief.** A pin-point instruction to CC (§4) that the generic CD bundle cannot know: our stack, the rule to rebuild against real repo components, the monochrome/desktop/branding-deferred constraints, the plan-first requirement, which subfolders to link, the mapped build task, the invariant-visual obligations, and acceptance. web Claude authors this (prescriptive-doc discipline). This carries the *instructions and guardrails*.

3. **The motion spec** — every motion intent for the surface, with timing, the data behind it, and the implementer; CC implements these at the build task unless an entry is explicitly marked as CD-demoed. *(As of 2026-06-17 this lives in the consolidated `DESIGN-motion-consolidated.md`, not per-screen logs.)*

4. **The design spec-changes** — the design-driven spec changes and read-model requirements the surface depends on, each pointing at the consolidated SPEC.1 amendment / DESIGN.SPEC. *(As of 2026-06-17 this lives in the consolidated `DESIGN-spec-changes-consolidated.md`.)*

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
- **The design-token file** — `globals.css` (carries the **finalized brand tokens** after the bridge-stage value-swap — monochrome unless an accent was ratified; the swap **fully precedes** surface builds under the sequential realignment).
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
- Build against the tokens in globals.css AS THEY STAND — they carry the
  finalized brand (monochrome unless an accent was ratified). Use tokens,
  never hardcode values; introduce NO colour beyond the tokens.
- Black = YES side, white = NO side (the post's side, frozen at
  post-time — NOT Support/Counter, which is a separate post-relative
  relation; design-language §1.3 / §6). Greys carry hierarchy.
- Desktop only, fixed max-width. NO responsive breakpoints this phase.

MOTION: Implement the surface's motion-log entries (simple cycling /
carousel timing is build work, not design work). No motion beyond the
log.

SPEC GATE: Fields introduced by this surface's spec-change log exist
only once the consolidated SPEC.1 amendment is merged. Do NOT build
against unmerged fields.

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
- **Produced after batch refine.** Under the two-phase batch model (`design-workflow.md` §2, ratified 2026-06-05), handoff packages are produced per surface at the end of Phase CD's refine — the cadence stays per-surface; only the production moment is batched.
- **Staged against backend.** Design sign-off produces the handoff package; CC consumes it when the mapped build task is sequenced and its backend dependencies are met. Design runs parallel to ENGINE; builds happen as their tasks come up — not all at once at the end.
- **Surface → build-task map** (the planner owns the exact sequence; this is the mapping):

> **v1.0-lock update (2026-06-17; realigned 2026-07-03).** The four core surfaces (Discovery · Market Detail · Reply · Profile) + Bookmark are **locked at integration-shell v1.0**. The old per-surface build rows **UI.3 / UI.4 / UI.5 were retired** in tracker v14; the production build of the locked surfaces now routes through **DESIGN.HANDOVER** — under the 2026-07-03 realignment this means **Claude Code builds each surface from its locked mockup + the branded repo tokens**, not a separate CD production build. (Tracker currency: v15/v16 — the sequencer, not this contract.)

| Surface | Build path | Notes |
|---|---|---|
| Discovery · Market Detail · Profile (+ Bookmark) | **DESIGN.HANDOVER** | Locked at v1.0; UI.3/4/5 retired — CC builds from the locked mockup + branded tokens. |
| Reply / Debate view | **DEBATE.4** | Cross-lane; highest-stakes; critical path. |
| DESIGN Wave-2 surfaces (sign-in · Dharma graph/tab · compose entry · media tab · system states · feature-guide · downloads · radio) | **DESIGN.HANDOVER** | Designed in Wave-2; built via the handover. |
| Landing | **UI.1** | Standalone (kept separate); may build from the design language directly. |
| Folded build rows (admin · ToS/Privacy · AGPL footer · route protection · OG cards · leaderboards) | their own build tasks (UI.6 · UI.10 · UI.11 · UI.12 · UI.8 · UI.7) | Build-side work in the VISUAL phase; IDs kept stable for cross-lane deps. |

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
> **v0.6-draft (2026-07-03):** realigned to the branding/handoff decision record. §1 handoff unit = locked repo mockup (layout) + branded repo tokens (look); the CD export bundle demoted to a lossy, optional reference (not canon). §3/§4 updated — surfaces build against `globals.css` **as it stands** (finalized brand; the value-swap precedes builds under sequential ordering), not "monochrome, brand later." §6 DESIGN.HANDOVER reframed to "CC builds each surface from its locked mockup + branded tokens." Header realignment note + pointer added. §2 (local route), §5 (plan-then-execute ritual), §7 (code is source of truth), and the invariant-visual obligations unchanged. Source: CD branding/handoff realignment, 2026-07-03.
> **v0.5-draft (2026-06-17):** **Lane-crossing note** added to the staging block (this doc is the one place the design lane hands to the code lane; the CC ritual attaches to the build, never back to the mockup) — sharpening the operator's design-vs-code separation. **Axis correction** in the §4 build brief: `Black = [Support/YES]` → `Black = YES side; white = NO side` (side, not Support/Counter; design-language §1.3 / §6). **v1.0-lock + map currency** in §6: core surfaces locked at v1.0; the retired UI.3/4/5 build rows replaced by **DESIGN.HANDOVER**; map redrawn for tracker v14 (core + Wave-2 → handover; Reply/Debate → DEBATE.4; Landing → UI.1; folded build rows → their own tasks). **Consolidation:** §1.3/§1.4 per-screen logs → the consolidated motion / spec-changes docs. Source: v1.0 lock + tracker v14, 2026-06-17.
> **v0.4-draft (2026-06-05):** log naming aligned to the tracker pattern (`DESIGN.N_<page>_…`). Source: Slot-1 close.
> **v0.3-draft (2026-06-05):** §1 grows from two to **four parts** — the per-screen **motion log** and **design spec-change log** now travel in every handoff package; §4 build brief gains **MOTION** (implement the log; nothing beyond it) and **SPEC GATE** (no building against fields whose consolidated SPEC.1 amendment is unmerged); §6 notes handoff production after Phase-CD batch refine (cadence per-surface unchanged). Source: Slot-1 lock chat, operator ratification 2026-06-05.
> **v0.2-draft (2026-06-04):** §1 bundle contents specified per current behaviour (standalone HTML + inline CSS/JS, on-canvas tokens, component structure, README, chat log) and flagged version-sensitive; §4 build brief gains the **PRESERVE THE APPROVED DESIGN** instruction (implement, don't redesign; deviations surfaced in the plan); §7 sharpened (code fixes in CC, never back in CD); grounding → `Research_Report_v2.md`.
> **v0-draft:** initial authoring (visual-backbone thread).

*End design-handoff v0.6-draft. Handoff mechanics from `Research_Report_v2.md` (verify CD route/bundle specifics if behaviour shifts); build ritual per `CLAUDE.md` + `plan-then-execute.md`; stack per `AGENTS.md`. The §3 production subfolders are distinct from the CD-seed kit in `design-workflow.md` §7.*
