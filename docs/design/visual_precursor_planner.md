# Zugzwang — VISUAL pre-cursor planner (v1.1)

> **Doc:** `docs/design/visual_precursor_planner.md`
> **Status:** v1.1-draft · planning-thread output · the spine of the VISUAL bucket
> **Supersedes:** the working concepts in `visual_precursor_planner_v0.md` (kept as historical reference; this is a fresh planner per the agreed restart).
>
> **Purpose.** Sequence and shape the per-slot design work for the experiment-phase VISUAL bucket: which surface is designed in what order, the loop each follows, and the paste-ready kickoff for Slot 1. It is the spine the slot chats reference.
>
> **Scope.** Experiment phase only. **High-fidelity, monochrome (black/white/grey), desktop-only.** HTML mockups via Claude Design (`zugzwang/world` org). Brand-last.
>
> **Not in scope.** Tracker edits (deferred to a focused v12 design-lane sweep — all drift is logged in §5 as that sweep's input). Spec amendments (surfaced per slot, written separately). Production code (built downstream by the UI / DEBATE tasks each surface hands off to).
>
> **The docs this planner stands on** (read them; this planner does not duplicate them):
> - `design-language.md` — the **what**: tokens, primitives, locked visual constraints, state-shape rules, per-surface primitive map.
> - `design-workflow.md` — the **how we produce**: the per-slot loop, the pin-point CD prompt package (incl. the Slot-1 reference HTML skeleton), mockup handling, reliability workarounds, usage discipline, the CD-seed kit.
> - `design-handoff.md` — the **how we deliver**: handoff package, local-agent route, what CC builds against, the build brief, per-surface cadence + staging.
> - `Research_Report_v2.md` — the CD **high-fidelity** research (primary reference). Supersedes `Research_Report.md` (v1) for fidelity-mode and CD-operation guidance; v1 remains background where v2 is silent — v1 is wireframe-framed, so take no fidelity-mode advice from it.

---

## §1 — Working model (summary)

Mirrors the core-build relay, with Claude Design as the executor. **Full detail in `design-workflow.md` §1–2.**

- **web Claude** — orchestrator: authors prompt packages, gates steps, sequences; runs no tools.
- **Operator (Hrishikesh)** — product owner + driver: decides, sketches, relays into CD, runs CD.
- **Claude Design** — executor: generates/iterates mockups on its canvas.
- **Claude Code** — downstream builder: consumes each signed-off surface via the handoff.

Each surface gets **its own web Claude chat**. **Discussion precedes all Claude Design action** — the prompt is fully planned before it is pasted (no exploring via half-formed prompts). The loop each slot follows is `design-workflow.md` §2 (read → sketch → discuss & lock layout → draft prompt package → set up & generate → checkpoint → sign off).

---

## §2 — Locked decisions (carry into every slot)

Summary; the full constraint set is `design-language.md` §1.

1. **High fidelity** — production visual fidelity, not wireframes.
2. **Monochrome is the language** — black, white, grey; the durable look, not a placeholder.
3. **Black = Support/YES, white = Counter/NO** *(default — see §5 drift note; flips on one word)*; grey carries all hierarchy and is the future-colour placeholder.
4. **Claude Design produces monochrome only** — never colour. The CD house style (cream/serif/terracotta/warm greys/large radii) is banned by name, with paired neutral replacements (`design-language.md` §1.9); specs speak in exact values, never adjectives (§1.10).
5. **One brand accent, applied later in Claude Code** as a token swap into the designated greys; side black/white untouched.
6. **Desktop-only** — single fixed viewport, no responsive this phase.
7. **Brand-last** — logo, mascots, type-refinement, and the accent come after the participant surfaces.
8. **Per-surface handoff, local agent, staged** — design produces an approved mockup + handoff package; CC builds when the mapped task is sequenced and its backend exists (`design-handoff.md`).

---

## §3 — Placeholder convention

For features encountered during design that have **no written spec**:

- Render a **design placeholder only**: `[FEATURE_N — placeholder]` with a one-line intent and the layout slot noted. **Additive-only.**
- **No behavioural design** is attempted for an unspecced feature.
- A feature that would **rewrite an invariant or a core flow is stopped** and surfaced as a **spec change** — never absorbed as a placeholder.
- Every placeholder is logged in the per-slot register and rolled up at thread close (§8).

---

## §4 — Slot sequence + tracker mapping

User-flow ordered. **Slot numbers are the design sequence; the tracker-task column maps each to its existing task.** Note the sequence does **not** match the tracker's `DESIGN.x` numeric order — the tracker's `DESIGN.1` is the stale "brand identity" task, now moved to a late pass (logged in §5; reconciled in the v12 sweep).

| Slot | Surface | Maps to (design) | Hands off to (build) | Role |
|---|---|---|---|---|
| **1** | **Discovery / market-list front page** | DESIGN.3 | UI.3 | **Look-anchor.** Originates the market card, category/tab vocabulary, featured/trending rail, app shell/nav. Establishes the high-fi monochrome look. *(In flight — opened 2026-06-04.)* |
| **— interlude —** | **Seed the CD design system** | DESIGN.2 *(reframed)* | — | After Slot 1 sign-off: CC builds a small monochrome kit **from the approved Discovery surface**; operator seeds + publishes it to CD (`design-workflow.md` §7). Slots 2–4 then inherit it. Relates to DESIGN.7 (token back-apply). |
| **2** | **Market detail + bet flow** | DESIGN.4 | UI.4 | Price chart, single-side buy/sell panel, mandatory comment field, slippage modal, single-side UX. |
| **3** | **Debate view** | DESIGN.5 | DEBATE.4 *(cross-lane)* | **Highest-iteration, thesis-load-bearing.** Two-column, ranking-sorted top-level, flat stake-ordered replies, markers, read-only Support/Counter. Likely **two sub-sessions** (structure, then density/interaction). |
| **4** | **Profile (/me)** | DESIGN.6 | UI.5 | Pseudonym/PFP, Dharma balance, daily-credit history, bet/comment history with frozen markers, erasure-request UI. |
| **5** | **Brand pass** *(later)* | DESIGN.1 *(reframed — moved here)* | — | The one accent (CC token-swap), logo, mascots, type refinement. Feeds `design.md` / ADR-0012 at DESIGN.8. |
| **6** | **Admin visual language** *(later)* | *(new — not yet a tracker task)* | — | Its own visual language, deliberately distinct (admin is not a participant). Flag for the v12 sweep to mint a task. |
| **—** | **Landing (marketing)** | — | UI.1 | **Fork (see below).** Reuses nav + a reduced rail + bespoke marketing layout. |
| **—** | **design.md + ADR-0012** | DESIGN.8 | — | Derived from all approved mockups, after the slots. Prescriptive — web-authored. |

> **v12-sweep tracker fixes expected from this mapping:** re-point DESIGN.2's dependency `DESIGN.1` → `DESIGN.3` (seed source = the Slot-1 kit, not brand tokens); re-sequence DESIGN.1 (brand) after the participant surfaces; mint the admin-language task. Until swept, tracker rows DESIGN.1/DESIGN.2 read "Not started" while their *content* is delivered out of order per this planner — expected, not an omission.

### §4.1 Sequence forks (operator sign-off)

1. **Slot 1 = Discovery.** Recommended as the look-anchor (most reusable primitives, not the most complex). *Alternative:* Landing first — weaker, since marketing originates few product primitives. **→ Resolved: Discovery; Slot 1 opened 2026-06-04.**
2. **Landing — build-direct vs. own slot.** Recommended: **build-direct** by CC from the established design language (it's marketing, low primitive-origination). *Alternative:* give it a light design slot.
3. **Market detail + bet flow — combined (Slot 2).** Recommended combined, per the tracker (DESIGN.4). *Alternative:* split detail from bet flow into two slots (the v0 decomposition).

---

## §5 — Drift log (input to the tracker v12 design-lane sweep)

Logged here, not acted on in this thread. The v12 sweep consumes this list.

1. **Fidelity: wireframe → high-fidelity.** (Changed this thread; v0 assumed wireframe.)
2. **DESIGN-lane ordering: brand-first → monochrome-first, brand-last.** (Reaffirmed from v0; the tracker still front-loads brand.)
3. **DESIGN.1 reframed and moved.** Tracker DESIGN.1 = "brand identity + design tokens" (first) → brand becomes a **late pass** (Slot 5). The first *design slot* is Discovery (tracker DESIGN.3).
4. **DESIGN.2 reframed.** "Seed CD with DESIGN.1 brand tokens" → "seed CD with the **monochrome kit extracted from the approved Slot 1 surface**," as a one-time interlude after Slot 1.
5. **Colour model locked:** black = Support/YES, white = Counter/NO (semantic, permanent); grey = default + future-colour placeholder; **one** accent applied in CC. *(Black↔side binding is a default pending operator confirmation at the look-anchor slot — Slot 1.)*
6. **Per-surface handoff cadence + staging** made explicit: design produces packages; CC builds per task when backend exists.
7. **Admin visual language** needs a DESIGN task minted (Slot 6) — not currently in the tracker DESIGN lane.
8. **Four backbone docs added** to `docs/design/`: `design-language.md`, `design-workflow.md`, `design-handoff.md`, this planner. (Plus the research reports in PK.)
9. **`design.md` (DESIGN.8)** reaffirmed as **derived from approved mockups**, after the slots — not authored first.
10. **Step-D prompt package amended (Slot 1):** a **web-Claude-authored reference HTML skeleton** is attached to the Slot-1 CD prompt (`design-workflow.md` §3.4) — a research-backed reversal of the earlier "no hand-built reference" stance. Throwaway; never repo code; never the kit; Slot-1-only.
11. **Design-language delivery mechanism:** the doc goes in as the CD project's **root `CLAUDE.md`** (only the root file is read; persists per-project) — not paste-only.
12. **Metering changed:** CD **shares the weekly usage pool with Claude.ai and Claude Code** (late-May 2026 in-app notice; verify live). Design-heavy and build-heavy days must be sequenced.
13. **Research superseded:** `Research_Report_v2.md` (high-fidelity, 2026-06-04) supersedes `Research_Report.md` for CD-operation/fidelity-mode guidance; v1 retained as background.
14. **Backbone docs bumped to v0.2 (language / workflow / handoff), planner to v1.1** — research-knowledge fold-in, done mid-Slot-1 by operator direction (2026-06-04).

---

## §6 — Per-slot chat shape

The loop is `design-workflow.md` §2. Each slot chat opens with scope-framing (objective + exit criterion, the three roles, numbered kickoff-to-close steps, a NOT-doing list), reads the backbone docs + this planner + the slot's tracker entry, then waits for the operator's whiteboard sketch. The Slot-1 kickoff is §7.

---

## §7 — Slot-1 kickoff (paste-ready)

> Paste as the **first message** of a new web Claude chat (in the Zugzwang project) to open Slot 1. Send your whiteboard sketch as the **second** message after it acknowledges. *(This kickoff was consumed 2026-06-04 — Slot 1 is in flight. The block is retained, updated to v0.2 mechanics, for the record and for re-pointing if ever re-run.)*

```
VISUAL — Slot 1: Discovery / market-list front page (design)

You are web Claude, orchestrator for this design slot. This chat designs
ONE surface — the Discovery / market-list front page — to a signed-off,
high-fidelity monochrome mockup, ready to hand off to Claude Code (UI.3).

ROLES
- You (web Claude): orchestrator — author the Claude Design prompt
  package, gate each step, critique. You run no tools and touch no canvas.
- Me (Hrishikesh): product owner + driver — I decide, I sketch, I relay
  prompts into Claude Design, I paste results back.
- Claude Design: executor — generates and iterates the mockup.

READ FIRST (in the project knowledge), in this order:
1. design-language.md   (tokens, primitives, constraints, state-shape rules)
2. design-workflow.md   (the per-slot loop §2, the CD prompt package §3)
3. design-handoff.md    (how this surface is delivered to Claude Code)
4. visual_precursor_planner.md  (this bucket's spine; Slot 1 = this surface)
5. Research_Report_v2.md (CD high-fidelity operation — reference)
Then the tracker entry for DESIGN.3 (market list) and its handoff UI.3.

SCOPE
- Surface: Discovery / market-list front page. Public-by-default.
- This is the LOOK-ANCHOR slot: it originates primitives the later
  surfaces reuse — the market card, the category/tab vocabulary, the
  featured/trending rail, the app shell/nav. Be deliberate about these.
- Fidelity: high. Monochrome only (black/white/grey). Desktop-only.
  No colour, no responsive. (Full constraints: design-language.md §1.)
- There is NO published Claude Design system yet — Slot 1 runs on default
  styling held monochrome via: design-language.md as the CD project's
  root CLAUDE.md + the constraints block (incl. house-style override) +
  a web-authored reference HTML skeleton attached to the prompt
  (workflow §3.4). The seed kit is built FROM this surface after sign-off.

LOOP (design-workflow.md §2)
A. You acknowledge, confirm you've read the docs, and frame the surface.
B. I send my whiteboard sketch (next message).
C. We discuss and lock the layout HERE — regions, the market card, the
   category vocabulary, the rail, nav. No Claude Design action yet.
D. You draft the pin-point Claude Design prompt package (template:
   workflow §3.1; constraints §3.2; reference skeleton §3.4). I ratify it.
E. I set design-language.md as the CD project's root CLAUDE.md, attach
   the skeleton + sketch, paste the prompt; we iterate via chat +
   batched comments.
F. We checkpoint-export at "structurally right," then refine to sign-off.
G. Sign-off → log drift + placeholders → produce the UI.3 handoff package.

NOT DOING
- No colour, no brand, no logo/mascots (brand is a later pass).
- No other surface (market detail, debate, profile are their own slots).
- No production code (UI.3 builds downstream).
- No tracker edits (drift is logged in the planner for the v12 sweep).
- No behavioural design for any unspecced feature — placeholder only
  (planner §3), and stop + surface anything that touches an invariant.

Acknowledge, frame the Discovery surface, and wait for my sketch.
```

---

## §8 — Thread close-out (deferred — produced at the final slot's sign-off)

Populated when all slots close:
- Final placeholder register (across all slots).
- Final drift register (across all slots) — the v12 tracker-sweep handoff.
- Downstream spec/ADR candidate list (per placeholder).
- Pointer doc for the VISUAL stratum execution (the UI / DEBATE builds).

---

> **Changelog.**
> **v1.1-draft (2026-06-04):** drift log gains items 10–14 (Slot-1 reference HTML skeleton; root-`CLAUDE.md` delivery; shared weekly metering pool; `Research_Report_v2.md` supersession; backbone-doc version bumps); §4 gains the v12-sweep tracker-fix note + Slot-1 in-flight marker; §4.1 fork 1 marked resolved; §5.5 binding-confirmation anchor corrected to "the look-anchor slot (Slot 1)"; header doc-list gains `Research_Report_v2.md`; §7 kickoff block updated to v0.2 mechanics and marked consumed.
> **v1-draft:** initial planner (visual-backbone thread restart).

*End planner v1.1-draft. Stands on `design-language.md`, `design-workflow.md`, `design-handoff.md`, `Research_Report_v2.md`. Drift in §5 is the v12 sweep's input; the tracker is not edited in this thread.*
