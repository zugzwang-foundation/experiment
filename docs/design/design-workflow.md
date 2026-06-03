# Zugzwang — Design Workflow (how we produce)

> **Doc:** `docs/design/design-workflow.md`
> **Status:** v0-draft · operating manual
> **Phase:** experiment-phase VISUAL stratum
>
> **What this is.** The operating manual for *producing* surfaces in Claude Design (CD): who does what, the loop each surface follows, how we write a Claude Design prompt that has no open ends, how we handle the HTML mockups, the reliability workarounds, the usage discipline, and the front-end kit that seeds CD's design system so every surface stays on-model.
>
> **What this is NOT.** It is not the design *language* — that is `design-language.md` (the what: tokens, primitives, constraints). It is not the *handoff* contract — that is `design-handoff.md` (how a finished surface is delivered to Claude Code). It is not the *sequence* — that is the planner (which surface, in what order, with the paste-ready kickoff). This doc is referenced *by* the planner for the loop, and runs *alongside* the handoff doc as the produce-side of the same pipeline.
>
> **Grounding.** Procedures and gotchas are distilled from the Claude Design best-practices research in PK (`Research_Report.md`). That report is the reference; this doc is the operating procedure derived from it. Where a number is time-sensitive (usage metering), verify in the live dashboard before relying on it.

---

## §1 — Roles

The same relay discipline as the core build, with Claude Design taking Claude Code's seat as the executor.

- **web Claude — orchestrator.** Authors the CD prompt, gates each step, sequences the work, holds the design-language and conventions. Runs no tools, touches no canvas. The spec-author/critic of the design phase.
- **Operator (Hrishikesh) — product owner + driver.** Makes the product and aesthetic decisions, sketches the first cut, relays prompts into CD, runs CD, pastes outputs back to web Claude. The only party who touches Claude Design.
- **Claude Design (CD) — executor.** Generates and iterates the mockup on its canvas from the prompt the operator pastes. The Claude Code equivalent for the design phase.
- **Claude Code (CC) — downstream builder.** Consumes the finished, signed-off surface via the handoff (see `design-handoff.md`). Named here only as the consumer at the end of the loop.

> One-task-per-chat holds: each surface gets its own web Claude chat (see the loop below). web Claude flags when a surface should split across chats to avoid context loss.

---

## §2 — The per-slot chat loop

Each surface follows this loop. **Discussion precedes all Claude Design action** — we do not explore via half-formed prompts; the prompt is fully planned before it is pasted.

- **A — Open & read.** Open the surface's own web Claude chat. Read `design-language.md`, this doc, and the surface's tracker entry. (The research report is in PK as reference.)
- **B — Sketch.** Operator provides a whiteboard sketch as the first cut. This anchors the layout discussion in something concrete.
- **C — Discuss & lock the layout.** Substance discussion in the web Claude chat — layout, content blocks, which primitives the surface composes (per `design-language.md` §5), and the surface's behaviours (e.g., for the debate view: ranking modes, empty-side CTA, marker rules). The layout is locked here. **No CD action yet.**
- **D — Draft the prompt.** web Claude drafts the pin-point CD prompt (§3). Operator ratifies it. Nothing open remains.
- **E — Generate & iterate.** Operator pastes the prompt into CD. CD generates. Iterate via chat + batched comments (§5).
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

COMPONENTS: [name the design-language primitives this surface reuses,
             and the published system once it exists —
             "use the Market Card and Side Badge from the published
             Zugzwang Monochrome system"]

VARIATIONS: [either "show 2-3 layout variations of [named region],
             differing on [named dimension]" — or, if the layout is
             locked from the sketch, "build exactly this layout, no
             variations"]

BUILD INSTRUCTION: Build exactly this specification. If something is
genuinely underspecified, ASK before inventing — do not pad with
filler content, decorative stats, or placeholder data beyond what is
named above.
```

**On "no open things" vs CD's questioning.** CD is built to ask clarifying questions and, left vague, will invent content. Our prompt forecloses that: the layout and content are fully specified in step C, the prompt names every block, and the build instruction tells CD to *ask, not invent* if a true gap remains. We lean on CD's questioning only as a safety net for gaps we didn't anticipate — never as a substitute for planning.

### §3.2 The constraints block (verbatim, every prompt)

Bracketed values are filled once, from the DESIGN.1 outcome (type family, corner treatment, which side is black), then reused unchanged.

```
CONSTRAINTS:
- Monochrome only: black, white, and neutral greys. NO colour, NO
  gradients, NO accent of any kind. Colour is added later, in code.
- Black = [Support/YES] side; white = [Counter/NO] side. Greys carry
  ALL hierarchy, surfaces, borders, and structure.
- NO imagery, NO emoji, NO decorative icons. Where an image would go,
  use a clearly labelled placeholder.
- One neutral [TYPE FAMILY] type family. Hairline borders.
  [CORNER TREATMENT] corners.
- Desktop only at [1440]px width. Do NOT generate mobile, tablet, or
  responsive variants.
- Do NOT use a warm cream/off-white background, serif display type, or
  a terracotta accent. Use the monochrome system exactly as specified.
- [Once published:] Use the published "Zugzwang Monochrome" design
  system.
```

The last two lines matter: Claude Design's underlying model has a built-in warm-cream/serif "house style" that surfaces unless explicitly overridden, and the published system is what suppresses it durably (§7).

### §3.3 Reference material to attach

- The **whiteboard sketch** (screenshot) — for "build this layout."
- The **design-language doc** — paste or attach at the start of the session so the vocabulary is in context (CD has no cross-session memory — §4).

---

## §4 — HTML mockup handling

CD produces real HTML on the canvas. Treat in-app history as unreliable and checkpoint externally.

- **One project per surface.** Iterate the surface in its own CD project.
- **No cross-session memory.** CD does not remember prior sessions. Re-paste the design-language doc (and, for the debate view, the marker/sort/empty-state rules) at the start of each session and after long stretches.
- **Version with intent.** To branch, tell CD *"save what we have and try a different approach"* and name versions explicitly. In-app version control is weak — do not rely on Redo or history for anything you cannot lose.
- **Checkpoint-export at milestones.** Export (zip / standalone HTML) when a surface is "structurally right" and again before any deep-polish push. This is the real safety net.
- **The debate view gets extra care** (§highest-iteration): design structure first, export a checkpoint, then iterate density and interaction — across two sessions if needed, rather than one marathon.

---

## §5 — Chat vs. inline comments, and reliability workarounds

**Steering:**
- **Chat** — structural and aesthetic moves: new sections, "rearrange," "try a different approach," asking for variations or a design review.
- **Inline comments** — surgical, component-level edits ("make this a dropdown," "tighten this spacing"). **Batch them** ("Select for Send") and let CD resolve them in one turn.
- For the high-iteration surfaces (debate view especially), **prefer chat or batched comments over single inline comments** — see the persistence bug below.

**Known issues + workarounds (from the research):**
- **Inline comments can disappear** before CD reads them → paste the comment text into chat instead. (Always works.)
- **Save errors in compact view** → switch to full view and retry.
- **Large-folder lag / browser issues** → link a specific subfolder, never a large tree (§7).
- **"Chat upstream error"** → start a new chat tab within the same project.

---

## §6 — Token / usage discipline

Claude Design usage is steep, and the reset is **weekly**, not daily — running out means waiting days. Treat the budget as a first-class constraint.

- **Verify the pool first.** As of the research, Design usage may now draw from the **same allowance pool as Claude Code and chat** (community-reported, not confirmed by Anthropic; the help-center doc still says "separate"). **Check the live usage dashboard** before a heavy design stretch. If it is shared, sequence design-heavy and build-heavy work so they do not starve each other.
- **Budget per surface.** Get structure right fast, then stop. The first ~60% (structure, layout, flow) is where CD is strong; deep visual polish has diminishing returns and high burn.
- **Stop-and-hand-off threshold.** If a single surface is consuming **>40–50% of a weekly allowance**, stop iterating in CD and move remaining polish to Claude Code; if the program is allowance-bound, provision a second operator seat (allowances are per-user, not pooled).
- **Seeding cost.** Building the CD design system from a *small* kit is cheap; linking a large folder can consume most of a week's allowance. Keep the kit tiny (§7).

---

## §7 — The front-end kit that seeds Claude Design

Claude Design produces its best, most consistent output when it extracts a **published design system** from real code — "code beats specs." We use this to lock the monochrome look across surfaces. The ordering below is deliberate and was a planning decision: **the kit is built *from* the approved first surface, not before it.**

### §7.1 Why after DESIGN.1, not before

The high-fidelity *visual character* (the actual look — not just "monochrome") is decided in DESIGN.1, in Claude Design, with sketching and iteration. So:

- **DESIGN.1 (first surface) runs with NO published system.** CD uses default styling; we hold it to monochrome via the design-language doc pasted into the session + the §3.2 constraints block in the prompt + the explicit house-style override. One surface establishing the look this way is acceptable.
- **After DESIGN.1 sign-off, a one-time seeding interlude** captures the established look as a published system.
- **DESIGN.2–5 inherit the published system** → every later surface is consistent with DESIGN.1 by construction, with far less per-prompt babysitting.

This is a one-time interlude between slot 1 and slot 2 — not part of every loop.

### §7.2 Building the kit (Claude Code)

After DESIGN.1 is signed off, CC builds a **small, monochrome component kit** from the approved first surface — extracting the established primitives (nav, market card, side badge, button, input, post/reply block, panel) into a minimal HTML/CSS kit.

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
7. Only then flip **Published**, so DESIGN.2–5 inherit it.

### §7.4 Updating the system

If the look needs to evolve, open the design system and use **Remix** (chat) to adjust it — or re-seed from an updated kit. A second, branded system (logo / accent / mascots) is created at the brand pass (`design-language.md` §7), held alongside the monochrome one; branding is then applied in code, not by re-running surfaces.

---

## §8 — Out of scope for this doc (pointers)

- **The design language** (tokens, primitives, constraints, state-shape rules) → `design-language.md`.
- **The handoff contract** (bundle contents, local-agent vs Web, the CC build instruction, which repo subfolders to link, per-surface cadence) → `design-handoff.md`.
- **The slot sequence + the paste-ready slot kickoffs + the placeholder/drift registers** → the planner.

---

*End design-workflow v0-draft. Procedures derived from `Research_Report.md` (in PK); verify time-sensitive usage facts in the live dashboard. The CD-seed kit (§7) is distinct from the production repo subfolders in `design-handoff.md`.*
