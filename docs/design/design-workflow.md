# Zugzwang — Design Workflow (how we produce)

> **Doc:** `docs/design/design-workflow.md`
> **Status:** v0.2-draft · operating manual
> **Phase:** experiment-phase VISUAL stratum
>
> **What this is.** The operating manual for *producing* surfaces in Claude Design (CD): who does what, the loop each surface follows, how we write a Claude Design prompt that has no open ends, how we handle the HTML mockups, the reliability workarounds, the usage discipline, and the front-end kit that seeds CD's design system so every surface stays on-model.
>
> **What this is NOT.** It is not the design *language* — that is `design-language.md` (the what: tokens, primitives, constraints). It is not the *handoff* contract — that is `design-handoff.md` (how a finished surface is delivered to Claude Code). It is not the *sequence* — that is the planner (which surface, in what order, with the paste-ready kickoff). This doc is referenced *by* the planner for the loop, and runs *alongside* the handoff doc as the produce-side of the same pipeline.
>
> **Grounding.** Procedures and gotchas are distilled from the Claude Design research in PK — primary: `Research_Report_v2.md` (high-fidelity operation); `Research_Report.md` (v1) remains background where v2 is silent, but is wireframe-framed — do not take fidelity-mode advice from it. Where a number is time-sensitive (usage metering), verify in the live dashboard before relying on it.

---

## §1 — Roles

The same relay discipline as the core build, with Claude Design taking Claude Code's seat as the executor.

- **web Claude — orchestrator.** Authors the CD prompt package, gates each step, sequences the work, holds the design-language and conventions. Runs no tools, touches no canvas. The spec-author/critic of the design phase.
- **Operator (Hrishikesh) — product owner + driver.** Makes the product and aesthetic decisions, sketches the first cut, relays prompts into CD, runs CD, pastes outputs back to web Claude. The only party who touches Claude Design.
- **Claude Design (CD) — executor.** Generates and iterates the mockup on its canvas from the prompt the operator pastes. The Claude Code equivalent for the design phase.
- **Claude Code (CC) — downstream builder.** Consumes the finished, signed-off surface via the handoff (see `design-handoff.md`). Named here only as the consumer at the end of the loop.

> One-task-per-chat holds: each surface gets its own web Claude chat (see the loop below). web Claude flags when a surface should split across chats to avoid context loss.

---

## §2 — The per-slot chat loop

Each surface follows this loop. **Discussion precedes all Claude Design action** — we do not explore via half-formed prompts; the prompt is fully planned before it is pasted.

- **A — Open & read.** Open the surface's own web Claude chat. Read `design-language.md`, this doc, and the surface's tracker entry. (The research reports are in PK as reference.)
- **B — Sketch.** Operator provides a whiteboard sketch as the first cut. This anchors the layout discussion in something concrete.
- **C — Discuss & lock the layout.** Substance discussion in the web Claude chat — layout, content blocks, which primitives the surface composes (per `design-language.md` §5), and the surface's behaviours (e.g., for the debate view: ranking modes, empty-side CTA, marker rules). The layout is locked here. **No CD action yet.**
- **D — Draft the prompt package.** web Claude drafts the pin-point CD prompt (§3) — and, on Slot 1 only, the reference HTML skeleton (§3.4). Operator ratifies the package. Nothing open remains except the *named* variation dimensions (§3.1).
- **E — Set up & generate.** Operator sets `design-language.md` as the CD project's **root `CLAUDE.md`** (§3.3), attaches the sketch (+ the Slot-1 skeleton), pastes the prompt. CD generates; answer its clarifying questions (§3.1 note). Iterate via chat + batched comments (§5).
- **F — Checkpoint.** At "structurally right," export a checkpoint (§4). Continue refining toward sign-off-ready.
- **G — Sign off & wind down.** Operator signs off the surface. Log drift + any placeholders (planner registers). Produce the handoff package (`design-handoff.md`). Wind down the chat.

The planner holds the *sequence* of surfaces and the paste-ready *kickoff* for each slot; it points here for the loop. This doc does not duplicate the sequence.

---

## §3 — Writing a pin-point Claude Design prompt

The requirement: **the prompt to CD is pin-point, fully planned, no open things.** Every decision is made in step C (discussion) before the prompt is written. The prompt below is the template; web Claude fills it from the locked layout.

### §3.1 The template

```
GOAL: [what the user does on this surface, in one or two sentences]
AUDIENCE: [who is using it]

LAYOUT: [the agreed structure, described precisely from the sketch —
         regions, what sits where, the grid/columns]

CONTENT: [the exact blocks to render, naming primitives from the
          design language by name — e.g. "a market card per row",
          "the single-side buy/sell panel on the right", "the
          Support/Counter aggregate footer under each post"]

CONSTRAINTS: [paste the §3.2 block verbatim, every time]

STATES: [the interactive states to render — hover / focus / active /
         disabled on the named interactive primitives — and the
         surface states: loading, empty, error. Per design-language
         §4.9–§4.10; rendered before handoff, not left to the build.]

COMPONENTS: [name the design-language primitives this surface reuses,
             and the published system once it exists —
             "use the Market Card and Side Badge from the published
             Zugzwang Monochrome system"]

VARIATIONS: [Slot 1 (look-anchor) only: "show 2–3 high-fidelity
             variations of this SAME locked layout, differing ONLY on:
             type hierarchy within the single sans family · grey-ramp
             density · border/elevation character. All strictly
             monochrome." Later slots: "build exactly this layout, no
             variations" — unless a named region's dimension is
             deliberately opened.]

BUILD INSTRUCTION: Build exactly this specification. If something is
genuinely underspecified, ASK before inventing — do not pad with
filler content, decorative stats, or placeholder data beyond what is
named above. The attached reference file is structural and tonal
grounding — do not replicate it pixel-for-pixel. [Slot 1 only.]
```

**On "no open things" vs CD's questioning.** CD is built to ask clarifying questions and, left vague, will invent content. Our prompt forecloses that: the layout and content are fully specified in step C, the prompt names every block, and the build instruction tells CD to *ask, not invent* if a true gap remains. We lean on CD's questioning only as a safety net for gaps we didn't anticipate — never as a substitute for planning. Three refinements from the high-fidelity research:

- **Answer the questions.** First-pass quality jumps when the questioning round is engaged rather than skipped; its product-logic questions also surface blind spots cheaply.
- **The look-anchor opening is specified, not open.** On Slot 1, the *aesthetic character* is deliberately explored — but only through the VARIATIONS request, on named dimensions, inside the locked layout. Layout, content, and constraints stay fully closed. A named exploration on named dimensions is not an open end.
- **The model is literal.** The underlying model (Opus 4.8) interprets prompts literally and does not silently generalise. Any rule meant to hold everywhere ("all states", "every card") must say so explicitly.

### §3.2 The constraints block (verbatim, every prompt)

Bracketed values are filled once, from the **Slot-1 (look-anchor) outcome** — type family, corner treatment, side-binding confirmation — then reused unchanged. *For Slot 1 itself, `[TYPE FAMILY]` is open by design: CD proposes within "one neutral sans-serif"; the chosen family back-fills the bracket for Slots 2–5.*

```
CONSTRAINTS:
- Monochrome only: black, white, and neutral greys. NO colour, NO
  gradients, NO accent of any kind. Colour is added later, in code.
- Black = [Support/YES] side; white = [Counter/NO] side. Greys carry
  ALL hierarchy, surfaces, borders, and structure.
- True-neutral greys only — zero warm cast anywhere on the ramp.
- NO imagery, NO emoji, NO decorative icons. Where an image would go,
  use a clearly labelled placeholder.
- One neutral sans-serif [TYPE FAMILY] carries display AND body;
  hierarchy comes from weight and size contrast, never from switching
  families.
- Hairline (1px) borders. [CORNER TREATMENT] corners — small or zero.
  Elevation, where used, is neutral-grey shadow — never warm-tinted.
- Desktop only: a single fixed [1440]px viewport, presented in a
  desktop browser-window frame. Do NOT generate mobile, tablet, or
  responsive variants or breakpoints.
- HOUSE-STYLE OVERRIDE — do NOT use: a warm/cream/parchment
  background, serif display type, a terracotta or any warm accent,
  warm-tinted greys, or large border radii. Use instead: a white or
  near-white true-neutral ground, the single neutral sans, no accent,
  true-neutral greys, small-or-zero radii.
- This specification uses exact values only. Treat every stated value
  as binding; do not reinterpret through aesthetic adjectives.
- [Once published:] Use the published "Zugzwang Monochrome" design
  system.
```

The override lines matter: Claude Design's underlying model has a built-in warm-cream/serif/terracotta "house style" that surfaces whenever context is thin, and vague adjectives ("modern", "minimal") get resolved against its priors — capable of silently overriding explicit specs (design-language §1.9–§1.10). Negatives are always paired with concrete positives; the published system is what suppresses the house style durably (§7).

### §3.3 Reference material to attach

- **The whiteboard sketch** (screenshot) — for "build this layout." Ours in steps B–C; attached in CD as layout grounding.
- **The design-language doc — as the CD project's root `CLAUDE.md`.** Create/edit the project's root `CLAUDE.md` and paste the doc in. Only the **root** file is read (subfolders are ignored), and it persists for every chat in that project — sturdier than paste-only. Still restate the load-bearing rules in chat after long stretches (the canvas auto-compacts old context).
- **The reference HTML skeleton** — Slot 1 only; see §3.4.

### §3.4 The reference HTML skeleton (Slot-1-only)

At high fidelity, CD's own guidance is that good work is *rooted in existing design context*, and **code beats screenshots** as that context. With no published system yet, Slot 1 supplies a code anchor by hand:

- **What.** One self-contained HTML file (inline CSS): the **locked step-C layout** as real regions and blocks, with the design-language constraints live in code — white/near-white true-neutral ground, a grey ramp, near-black text, hairline borders, one neutral sans, a fixed 1440px frame. Deliberately **unrefined on the variation dimensions** (type hierarchy, ramp density, border/elevation character) — those are CD's to design.
- **Why.** It grounds structure and suppresses the house style in the form the model trusts most. It is the design-language doc *compiled into code*, not a competing aesthetic.
- **Who/when.** web Claude authors it at **step D**, from the locked layout, as part of the prompt package. Operator ratifies, then attaches it in CD alongside the prompt.
- **Rules.** It is a **throwaway input**: it never enters the repo, and it is **not** the seed kit — the kit is extracted from the *approved CD surface* (§7), never from the skeleton. The prompt carries the line *"structural and tonal grounding — do not replicate pixel-for-pixel."* The variations request is the anti-anchoring valve. **Slot-1-only:** Slots 2–5 anchor on the published system instead and need no per-prompt skeleton.
- **Never attach:** web-captures of live sites, coloured reference screenshots, or `.fig` files carrying brand — they re-import exactly the colour/brand/house-style we are excluding.

---

## §4 — HTML mockup handling

CD produces real HTML on the canvas. Treat in-app history as unreliable and checkpoint externally.

- **One project per surface.** Iterate the surface in its own CD project.
- **Context persistence.** The project's root `CLAUDE.md` (§3.3) persists across that project's chats; there is **no memory across projects**. Re-state the load-bearing rules (and, for the debate view, the marker/sort/empty-state rules) after long stretches — the canvas auto-compacts old context.
- **Edit-and-regenerate beats stacking corrections.** When a generation is wrong, edit the original message and regenerate rather than piling correction turns — context is re-read every turn, so stacked corrections burn budget and accumulate conflicting instructions.
- **Version with intent.** To branch, tell CD *"save what we have and try a different approach"* and name versions explicitly. In-app version control is weak — do not rely on Redo or history for anything you cannot lose.
- **Checkpoint-export at milestones.** Export (zip / standalone HTML) when a surface is "structurally right" and again before any deep-polish push. This is the real safety net.
- **The debate view gets extra care** (§highest-iteration): design structure first, export a checkpoint, then iterate density and interaction — across two sessions if needed, rather than one marathon.

---

## §5 — Chat vs. inline comments, and reliability workarounds

**Steering:**
- **Chat** — structural and aesthetic moves: new sections, "rearrange," "try a different approach," asking for variations or a design review.
- **Inline comments** — surgical, component-level edits ("make this a dropdown," "tighten this spacing"). **Batch them** ("Select for Send") and let CD resolve them in one turn.
- **Tweaks (sliders) + direct edits** — the cheap, no/low-generation levers for spacing and variant nudges; reach for these before chat regenerations on pixel-level work. Community-reported as occasionally buggy — fall back to batched comments if they misbehave.
- For the high-iteration surfaces (debate view especially), **prefer chat or batched comments over single inline comments** — see the persistence bug below.

**Known issues + workarounds (from the research):**
- **Inline comments can disappear** before CD reads them → paste the comment text into chat instead. (Always works.)
- **Save errors in compact view** → switch to full view and retry.
- **Large-folder lag / browser issues** → link a specific subfolder, never a large tree (§7).
- **"Chat upstream error"** → start a new chat tab within the same project.

---

## §6 — Token / usage discipline

Claude Design usage is steep, and the reset is **weekly**, not daily — running out means waiting days. Treat the budget as a first-class constraint.

- **The pool is shared (verify live).** As of late May 2026, an in-app notice states Design **now shares usage limits with Claude.ai and Claude Code** — one weekly pool (server-side rollout, community-reported; help-center docs may lag; **confirm in the live usage dashboard**). Consequence: a heavy CD day now eats CC budget — **sequence design-heavy and build-heavy days** so they do not starve each other.
- **High fidelity burns more per generation** than wireframes (vision-heavy model). Prefer the no/low-generation levers (§5) and edit-and-regenerate (§4). Reported datapoints — anecdotal, version-sensitive: a single prompt ~59% of a session / ~10% of a weekly Pro limit; 3–5 prompts can exhaust a Pro week.
- **Budget per surface.** Get structure right fast, then stop. The first ~60% (structure, layout, flow) is where CD is strong; deep visual polish has diminishing returns and high burn.
- **Stop-and-hand-off threshold.** If a single surface is consuming **>40–50% of a weekly allowance**, stop iterating in CD and move remaining polish to Claude Code; if the program is allowance-bound, provision a second operator seat (allowances are per-user, not pooled).
- **Seeding cost.** Building the CD design system from a *small* kit is cheap; linking a large folder can consume most of a week's allowance. Keep the kit tiny (§7).

---

## §7 — The front-end kit that seeds Claude Design

Claude Design produces its best, most consistent output when it extracts a **published design system** from real code — "code beats specs." We use this to lock the monochrome look across surfaces. The ordering below is deliberate and was a planning decision: **the kit is built *from* the approved first surface, not before it.**

### §7.1 Why after Slot 1, not before

The high-fidelity *visual character* (the actual look — not just "monochrome") is decided at **Slot 1 (the look-anchor; tracker DESIGN.3)**, in Claude Design, with sketching and iteration. So:

- **Slot 1 runs with NO published system.** CD uses default styling; we hold it to monochrome via the design-language doc as root `CLAUDE.md` + the §3.2 constraints block + the explicit house-style override + the reference HTML skeleton (§3.4). One surface establishing the look this way is acceptable.
- **After Slot-1 sign-off, a one-time seeding interlude** captures the established look as a published system.
- **Slots 2–5 inherit the published system** → every later surface is consistent with Slot 1 by construction, with far less per-prompt babysitting.

The Slot-1 reference skeleton is **not** a pre-kit: the kit extracts from the **approved CD surface**, never from the skeleton. This is a one-time interlude between slot 1 and slot 2 — not part of every loop.

### §7.2 Building the kit (Claude Code)

After Slot 1 is signed off, CC builds a **small, monochrome component kit** from the approved first surface — extracting the established primitives (nav, market card, side badge, button, input, post/reply block, panel) into a minimal HTML/CSS kit.

- **Deliberately tiny** — just enough for CD to extract the look. A large folder burns the allowance (§6) and lags the tool.
- **Local-only folder** — it does **not** go in the canonical repo. It is a seed artifact for CD, distinct from the production code CC will build later. (The production repo subfolders that CC rebuilds against are covered in `design-handoff.md` — different folder, different purpose.)

### §7.3 Seeding CD (operator, via the onboarding screen)

On the design-system onboarding screen (reached via **Continue to generation**):

1. **Name it** — e.g. "Zugzwang Monochrome."
2. Under **"Link code from your computer"** → browse to the kit folder. *(Not "Link code on GitHub" — the kit is a local folder and stays out of the canonical repo. CD copies selected files; for anything large, attach a frontend-focused subfolder.)*
3. **Skip** the `.fig` upload and the **fonts/logos/assets** slot — there is no brand yet.
4. In **"Any other notes?"**, paste the §3.2 constraints block (monochrome, desktop-only, house-style override).
5. **Continue to generation.**
6. **Validate** with one generic test prompt (e.g. "design a settings page with a left nav and three content sections") and confirm the output is monochrome and on-look.
7. Only then flip **Published**, so Slots 2–5 inherit it.

### §7.4 Updating the system

If the look needs to evolve, open the design system and use **Remix** (chat) to adjust it — or re-seed from an updated kit. A second, branded system (logo / accent / mascots) is created at the brand pass (`design-language.md` §7), held alongside the monochrome one; branding is then applied in code, not by re-running surfaces.

---

## §8 — Out of scope for this doc (pointers)

- **The design language** (tokens, primitives, constraints, state-shape rules) → `design-language.md`.
- **The handoff contract** (bundle contents, local-agent vs Web, the CC build instruction, which repo subfolders to link, per-surface cadence) → `design-handoff.md`.
- **The slot sequence + the paste-ready slot kickoffs + the placeholder/drift registers** → the planner.

---

> **Changelog.**
> **v0.2-draft (2026-06-04):** step-D becomes a prompt *package* — the Slot-1 **reference HTML skeleton** added (new §3.4; research-backed reversal of the earlier "no hand-built reference" stance); design-language now delivered as the CD project's **root `CLAUDE.md`** (§3.3, §4); §3.2 constraints block hardened (named house-style override with paired positives, true-neutral greys, exact-values rule, desktop browser-frame + fixed-1440px enforcement; Slot-1 `[TYPE FAMILY]` open-by-design note); template gains **STATES** and look-anchor **VARIATIONS** dimensions; questioning guidance refined (answer the questions; the look-anchor opening is specified, not open; Opus 4.8 literalism); §4 gains **edit-and-regenerate**; §5 gains **Tweaks/direct-edit** levers; §6 metering updated to **shared weekly pool** (late-May in-app notice; verify live) + high-fidelity burn; §7.1 retitled to Slot-1 language (DESIGN.1 ambiguity fix). Grounding → `Research_Report_v2.md`.
> **v0-draft:** initial authoring (visual-backbone thread).

*End design-workflow v0.2-draft. Procedures derived from `Research_Report_v2.md` (in PK; v1 as background); verify time-sensitive usage facts in the live dashboard. The CD-seed kit (§7) is distinct from the production repo subfolders in `design-handoff.md`.*
