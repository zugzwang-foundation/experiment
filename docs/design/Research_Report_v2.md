# Claude Design Best-Practices — v2 (High Fidelity): Strategic Inputs for a First-Surface, Monochrome, Desktop-Only Program

> **Doc:** `Research_Report_v2.md` (PK reference; repo home if committed: `docs/design/`)
> **Status:** v2 · research synthesis · 2026-06-04
> **Supersedes:** `Research_Report.md` (v1, wireframe-framed) **for all fidelity-mode and CD-operation guidance.** v1 remains valid background where v2 is silent (tool comparisons, admin/governance detail, the design-shotgun pattern) — but v1 assumed a wireframe-first program; take **no** fidelity-mode advice ("use Wireframe mode", "keep fidelity low") from it. This program runs **High Fidelity**.
> **Sources:** official Anthropic docs and announcements + April–June 2026 practitioner reports. The CD system prompt cited is **leaked/unofficial** (cross-corroborated; treat as insight into tendencies, not contract). All usage/metering numbers are anecdotal and version-sensitive — verify in the live dashboard.

---

## TL;DR
- **For a first surface with no published design system, run High Fidelity mode but supply your own context: a precise monochrome DESIGN.md (exact hex/type/spacing tokens) pasted as the project's root CLAUDE.md, plus a dense single-paragraph brief with an explicit constraints block AND an explicit house-style override.** High Fidelity is not just "prettier output" — it changes the working loop, because the model is engineered to refuse to design well "from scratch" and will reach for context (or fall back to its cream/serif/terracotta house style) unless you give it a concrete monochrome anchor.
- **Attach a hand-built reference HTML/CSS mockup, not screenshots** — per the leaked system prompt, "Claude is better at recreating or editing interfaces based on code, rather than screenshots," so a code reference is the single highest-leverage add-on for a no-system first surface. Avoid web-captures and colored reference screens that would re-import brand/colour.
- **Request 2–3 high-fidelity look variations on the FIRST surface only** (it is the look-anchor for the whole program), lock one, then stop iterating early and hand off to Claude Code as a bundle — designs should be "structurally right," polished in code. Note version-sensitive change: as of late May 2026 Claude Design **now shares one weekly usage pool with Claude.ai and Claude Code** (previously metered separately); verify in the live dashboard.

## Key Findings

**1. High Fidelity vs Wireframe is a mode choice made at project creation** (Prototype template → fidelity toggle: Wireframe = "rough sketches for exploring ideas fast," High Fidelity = "polished mockups with real brand assets"). It is selected before the first prompt and is changeable mid-project ("convert to high fidelity").

**2. High Fidelity changes the working loop, not just the polish.** Anthropic's leaked (unofficial but cross-corroborated across two independent repos) system prompt states: *"Good hi-fi designs do not start from scratch -- they are rooted in existing design context"* and *"Mocking a full product from scratch is a LAST RESORT and will lead to poor design."* In High Fidelity the model actively wants a design system, codebase, screenshots, or Figma file; in its absence it (a) asks more clarifying questions and (b) falls back to a default "house style." The same prompt's color rule reinforces this: *"try to use colors from brand / design system, if you have one... Avoid inventing new colors from scratch."*

**3. The house style is real and well-documented by the community:** warm Parchment background (~#f5f4ed), an "Anthropic Serif"-style display face at weight 500, a Terracotta accent (~#c96442), warm-toned neutrals, and generous 12–32px radii. Practitioner BeKnown (beknownusa.com) corroborates that "the default aesthetic skews editorial — warm cream backgrounds, serif typography, terracotta accents," and getdesign.md's analysis of Claude itself notes a "warm terracotta accent, clean editorial layout." It surfaces because Claude Design routes new/brandless work through a built-in "Frontend design" skill whose default is a confident, opinionated first pass. This is the primary thing to suppress for a strict monochrome program.

**4. The four-part brief (goal, layout, content, audience) is confirmed official** but is a floor, not a ceiling. Anthropic's "Get started with Claude Design" Help Center article states: *"A good prompt includes the goal (what you're building), the layout (how things should be arranged), the content (what information to display), and the audience (who will use it). Claude will also ask clarifying questions if it needs more information."* For a high-fidelity no-system surface, dense single-paragraph prompts that also name visual feel, typography, negative constraints, and a concrete palette land usable first drafts far more reliably than vague prompts.

**5. "Code beats screenshots" is the rule for reference material.** Verbatim system prompt (hqman GitHub gist): *"Claude is better at recreating or editing interfaces based on code, rather than screenshots. When given source data, focus on exploring the code and design context, less so on screenshots."* A hand-built reference HTML/CSS mockup is therefore a good idea for a no-system first surface — better than screenshots, and a strong complement to (or substitute for, on a single screen) a scaffolded system.

**6. Clarifying questions are a deliberate, strong feature.** The tool uses a `questions_v2` step and is instructed to "ask at least 10 questions" for new/ambiguous work (e.g. "prototype an onboarding -> ask a TON of questions"), but to skip questions when "enough info was provided" (e.g. "recreate the composer UI from this codebase -> no questions"). You can pre-empt the round by fully specifying, or deliberately leave hooks.

**7. Desktop-only is enforceable** via the `browser_window.jsx` / `macos_window.jsx` starter components (desktop chrome frames) plus an explicit `viewport: {width: 1440}` instruction and a negative constraint against responsive/mobile/tablet output.

## Details

### Q1 — How High Fidelity changes prompting

- **Selection & loop.** High Fidelity is chosen at project creation under the Prototype template. Wireframe is for fast idea exploration; High Fidelity produces real, clickable HTML styling. Practitioners note the gap between the two is large enough to be worth seeing yourself. Because the model treats hi-fi as "rooted in existing context," the loop shifts from "prompt → refine vague" (the chat-app instinct, which is the *wrong* instinct here) to "supply context → generate → targeted refine."
- **Detail to specify vs leave open.** At high fidelity, be MORE specific than feels natural on the brand-defining properties — palette (exact hex), type family + weights + scale, border-radius, spacing base unit, density. The model has strong SaaS priors; "professional"/"minimal" are not constraints, `border-radius: 0` and `font-family` are. Leave open: micro-interaction details, exact copy, and secondary layout choices you want it to explore.
- **Diminishing returns / token burn.** Opus 4.7/4.8 visual generation is token-heavy; one full session (system setup + a prototype + tweaks) reportedly burned >50% of a weekly Pro allotment. Practitioner Blago Dimitrov (blagodesign.com, May 28 2026) reported "one prompt apparently took 59% of a session limit and 10% of a weekly limit on Claude Pro," and multiple reviewers report exhausting the Pro weekly budget in roughly 3–5 prompts / ~30–36 minutes. High-fidelity output is more token-expensive per generation than wireframes. Diminishing returns kick in once the structure is right and you are nudging pixels — push that work to the no-LLM levers (direct edits, sliders/"Tweaks," inline comments batched and sent together) rather than chat regenerations. Editing the original message and regenerating beats stacking correction turns (context is re-read every turn).
- **Stop-and-hand-off threshold.** Hand off to Claude Code once the design is "structurally right" — correct layout, hierarchy, components, states — not pixel-perfect. The division of labour: structural/visual decisions in Claude Design; code-level fixes in Claude Code (don't go back to Claude Design for code fixes).
- **Handoff bundle fidelity.** Export → "Handoff to Claude Code" (local agent) or "Send to Claude Code Web." The bundle carries the project's design files (standalone HTML + inline CSS/JS), the design tokens actually used on the canvas, component structure/hierarchy, layout intent, a README instructing the model to interpret the designs, and the chat log capturing design intent. Because Claude Code reads structured spec output from the same model family, it doesn't infer intent from pixels. High fidelity makes the bundle richer (real tokens/components vs grey boxes), which is exactly what makes the handoff lossless. Anthropic has NOT published the bundle's internal file format — treat it as version-sensitive and expect change before GA.

### Q2 — Prompt anatomy for a high-fidelity first surface, no system

Confirmed core (official): **goal + layout + content + audience.** Sections that materially lift first-pass quality at high fidelity:
- **An explicit constraints block** (monochrome only; desktop 1440px only; no responsive; no imagery/logo/brand this phase).
- **An explicit house-style override** with concrete positive specs (see Q5) — this is the single most important addition for a no-system surface.
- **Component naming & information hierarchy** — name the surfaces and components you know you need ("top nav, market list as cards, a market-detail panel, an order/trade widget"); state primary vs secondary emphasis.
- **Interaction/state notes** — hover, active, disabled, focus, loading, empty, error states. Ask Claude to show empty/loading/error states before handoff so engineering gets the full picture.
- **Negative constraints** paired with positive alternatives ("Do not use Inter/DM Sans; use [named font]"; "no rounded-corner cards as the primary container; use hairline-bordered rectangles").
- **A variation request** (see Q8).
- **Handling "no published system":** Do NOT reference components by names that don't exist yet. Instead, paste a DESIGN.md as the project root `CLAUDE.md` — per the system prompt, *"only the root is read; subfolders are ignored"* — defining the monochrome tokens, and/or attach a reference HTML mockup. This substitutes for the "reference your design system by name" advice that assumes a published system.

### Q3 — Clarifying-question behaviour

The tool is instructed to ask many questions (≥10) for greenfield/ambiguous work via the `questions_v2` form, covering audience, tone, variations wanted, which dimensions to explore (visuals vs interactions vs copy), and tweaks. It skips questions when the prompt already contains everything or when recreating from a codebase. **Best practice at high fidelity:** answer the questions (output quality "jumps significantly"), but for the look-anchor first surface, deliberately leave the *aesthetic direction* slightly open as a hook so it asks — its product-logic questions (e.g. business model / paywall / state handling) frequently surface blind spots. Fully specify the hard constraints (monochrome, desktop, tokens) so it does NOT re-ask or re-invent those. This behaviour is stable from launch through ~June 2026; no major change documented, though the underlying model moved from Opus 4.7 to 4.8. Per Anthropic's Opus 4.8 announcement (May 28 2026), testers note it "asks the right questions, catches its own mistakes, pushes back when a plan isn't sound" and interprets prompts more literally — so state scope explicitly.

### Q4 — Add-ons / attachments that genuinely help at high fidelity

| Add-on | Verdict for no-system monochrome first surface |
|---|---|
| **Hand-built reference HTML/CSS mockup** | **Best add-on.** Aligns with "code beats screenshots." Steers structure + styling precisely. Not counterproductive vs a published system on a *single* surface — they roughly tie; the published system wins only once you need surface #2. |
| **Pasted DESIGN.md / design-language doc** | **Essential.** Exact tokens (hex, type scale, spacing, radii). Put it in project root CLAUDE.md so every chat in the project inherits it (only the root file is read). |
| **Sketch / the draw tool** | Useful and free (no LLM tokens for direct manipulation); good for "move this here / swap these" via arrows and circled regions. |
| **Screenshots of reference UIs** | Use sparingly and ONLY for structure/layout. **Net-negative risk:** importing colour/brand/visual DNA you don't want. For monochrome-original work, prefer a grayscale or your own code reference. |
| **Web-capture of a live site** | **Avoid this phase** — it pulls real colour/brand/house-style from the captured site, the opposite of monochrome-original. |
| **Scaffolding & publishing a small system first** | Best for the *program*, but for the very first surface (no system yet) you're establishing the look that later gets extracted. Recommended sequence: nail surface 1 in hi-fi with DESIGN.md + reference HTML → sign off → extract the monochrome kit (via Claude Code) → publish as org system → later surfaces inherit. |

### Q5 — Suppressing the house style at high fidelity

"Make it minimal" FAILS — it swaps one fixed palette for another default. What works:
- **Specify a concrete alternative, not just a negative.** "Don't use cream backgrounds" merely pushes it to another default. "Pure #FFFFFF background, #0A0A0A near-black text, a 5-step grey ramp (#F5F5F5, #E5E5E5, #A3A3A3, #525252, #171717), 4px corner radius, a single neutral sans-serif" works.
- **Pair every negative with a positive.** Negatives alone are weak; "Do not do X; instead do Y."
- **Use exact values, avoid vague descriptors.** Critically, remove conflicting adjectives: if you say "square buttons" but also "modern," the model may resolve "modern" → rounded and override your explicit spec. Vague descriptors ("clean," "modern") get resolved back to its priors.
- **Name the house-style elements to avoid explicitly:** no warm/cream backgrounds, no serif display type, no terracotta/warm accent, no warm-toned greys (use true neutral or cool greys), no large radii.
- **Use Anthropic's own anti-slop block** from the frontend-aesthetics cookbook (avoid Inter/Roboto/Arial/system fonts, avoid clichéd schemes/purple gradients, avoid cookie-cutter layouts) — but note that block targets *generic* AI slop; the cream/serif/terracotta default is a *secondary* fallback you must override with the same negative+concrete-positive technique.
- Reliability caveat: a good DESIGN.md mostly suppresses the house style at high fidelity, but is not 100% bulletproof — reversion happens on spec-vs-descriptor conflicts, so keep the doc free of vague adjectives.

### Q6 — Monochrome high-fidelity look-craft

To make black/white/grey look intentional rather than unfinished:
- **A defined grey ramp (4–5 steps)** doing specific jobs: lightest for backgrounds, light-mid for card/section surfaces, mid for borders/dividers, dark-mid for secondary text, near-black for titles/key numbers/primary CTA. Designers typically use 3–5 greys.
- **Type hierarchy within a single family** — lean on weight and size contrast since you can't use colour to differentiate. Anthropic's frontend-aesthetics cookbook is explicit: *"Use extremes: 100/200 weight vs 800/900, not 400 vs 600. Size jumps of 3x+, not 1.5x."*
- **Hairline borders (1px) and dividers** to separate without colour; the squint test to verify hierarchy survives in grayscale.
- **Avoid pure black on pure white** for long text — near-black (#171717/#0A0A0A) on white reduces glare; reserve very light greys for large surfaces, not small type (contrast/WCAG).
- **Elevation as grey shadow / ring** — the model's own pattern uses ring shadows (0 0 0 1px) for interactive states; warm drop-shadows must be overridden to neutral.
- **Spacing discipline** — a consistent base unit (4px/8px); whitespace and density do the work colour normally does. For a prediction-market product think dense, data-forward (Bloomberg-terminal density) rather than spacious consumer SaaS, but keep it monochrome-clean.

### Q7 — Desktop-only enforcement

- Drop a **desktop chrome frame** via `copy_starter_component` (`browser_window.jsx` or `macos_window.jsx`) so the design reads as a real desktop window, not a responsive page.
- Set **`viewport: {width: 1440}`** when the file is written/registered.
- **Explicit instruction + negative constraint:** "Design for a single fixed 1440px desktop viewport only. Do NOT add responsive/mobile/tablet breakpoints or variants. Single-column desktop layout." (Mention responsiveness early is official advice — here you mention it to *exclude* it.)
- Resist the model's instinct to add a title screen / center the prototype responsively; specify the fixed canvas.

### Q8 — Variations at high fidelity

The system prompt instructs the model to "give 3+ variations across several dimensions" by default, exposed as slides on a `design_canvas` or as toggleable "Tweaks," starting basic and getting more creative. For the **first surface = look-anchor**, this is the right time to request **2–3 high-fidelity look variations** — but constrain the dimensions to: type treatment/hierarchy, grey-ramp usage/density, and border/elevation treatment (NOT colour, since monochrome is fixed). Compare side-by-side, pick one, then **lock the single direction and iterate** — because everything downstream (the extracted design system, every later surface) inherits this character. Official guidance: "save what we have and try a completely different approach" to branch without losing work. Do not keep variation-generating past the look-anchor decision; it burns the shared token pool.

### Q9 — Freshness / what changed (as of June 3 2026)

- **Model:** Launched on Opus 4.7 (Apr 17 2026). Opus 4.8 shipped May 28 2026 (better judgment, asks sharper questions, more literal instruction-following — state scope explicitly), per Anthropic's official announcement; TechCrunch noted it shipped "just 41 days after Opus 4.7." Confirm which model Claude Design is running in the live app; behavior tuning (verbosity, effort) has shifted across versions.
- **Usage metering (MAJOR, version-sensitive):** Originally metered **separately** with its own weekly allowance. Between **May 27–28 2026** an in-app notice rolled out — reported by PiunikaWeb (May 28 2026) and pasqualepillitteri.it — reading *"Claude Design now shares usage limits with Claude.ai and Claude Code"*, i.e., one shared weekly budget across all three. No blog post/changelog; server-side gradual rollout, so some accounts may still see the old behavior. **Verify in the live dashboard before planning sessions.** Pro remains widely reported as too tight for serious design work; Max is the practical tier.
- **Export/handoff:** Export menu = Download .zip, PDF, PPTX, Send to Canva, standalone HTML, Handoff to Claude Code (local agent OR Claude Code Web). No native Figma import/export (no .fig in export menu).
- **Design-system onboarding screen** offers: link code on GitHub, link code from computer (local folder, copied not uploaded), upload a .fig file (parsed locally in-browser, never uploaded), add fonts/logos/assets (drag into last field), and an "any other notes" field. You can also upload a DESIGN.md to scaffold a full system in one shot.
- **Known quirks:** inline comments occasionally disappear before Claude reads them (workaround: paste into chat); save errors in compact view (switch to full view); large monorepos lag (link a subfolder); "chat upstream error" (start a new chat tab in the same project).
- **Prompting guidance:** Official "Get started" + "Using Claude Design for prototypes and UX" tutorials exist; the frontend-aesthetics cookbook is the canonical anti-slop reference. System prompt is unofficial/leaked (treat as insight into tendencies, not documentation).

## Recommendations

**Recommended best strategic input set for a high-fidelity, monochrome, desktop-only, no-system FIRST surface:**

1. **Mode/settings:** Create a Prototype project → **High Fidelity**. Name the project. Do not rely on an org design system (none exists yet).

2. **Attach (in order of value):**
   - A **monochrome DESIGN.md** as the project root `CLAUDE.md`: exact tokens — `#FFFFFF` bg, `#0A0A0A`/`#171717` text, a 5-step neutral grey ramp, 1px hairline borders, 4px (or 0) radius, one neutral sans-serif with weight + size scale, 8px spacing base, neutral ring/shadow tokens.
   - A **hand-built reference HTML/CSS mockup** of the rough layout (code > screenshots).
   - Avoid: web-capture, colored screenshots, .fig files carrying brand colour.

3. **Prompt structure (dense single paragraph + blocks):**
   - *Goal / layout / content / audience* (the confirmed four-part core).
   - *Constraints block:* "Strictly monochrome — black, white, neutral greys only. No colour, no gradients, no brand, no logo, no imagery. Single fixed 1440px desktop viewport only; no responsive/mobile/tablet variants."
   - *House-style override:* "Do not use a warm/cream/parchment background, serif display type, terracotta/warm accent, warm-toned greys, or large border-radii. Use a pure white background, true-neutral greys, a single neutral sans-serif, and 1px hairline borders." (Concrete positives, no vague adjectives.)
   - *Components & hierarchy:* name the surfaces/components and primary vs secondary emphasis for the prediction-market surface.
   - *States:* request hover/active/disabled/focus/loading/empty/error.
   - *Variations:* "Show me 2–3 high-fidelity look variations differing in type hierarchy, grey-ramp density, and border/elevation treatment — keep all strictly monochrome."

4. **Leverage clarifying questions:** answer them; leave aesthetic direction slightly open as a hook, lock hard constraints.

5. **Iterate cheaply:** direct edits + sliders/Tweaks + batched inline comments (no-LLM or single-generation) for pixel work; chat only for structural change. Edit-and-regenerate rather than stacking turns.

6. **Stop at "structurally right,"** lock one variation, then Export → Handoff to Claude Code with a README naming your stack and "preserve design intent; do not change the approved design." Extract the monochrome component kit in Claude Code, publish as the org design system, and have later surfaces inherit it.

**Benchmarks that change the plan:**
- If first-pass output still shows cream/serif/terracotta → your DESIGN.md has vague adjectives conflicting with tokens; strip them and re-state concrete values.
- If you exhaust the weekly pool fast → you're over-iterating in chat; move to sliders/edits, and note the shared-pool change (budget against Claude.ai + Claude Code too).
- If output looks generic/SaaS → add the anti-slop block and a named font; reference HTML mockup if you only pasted a doc.
- If you need surface #2 to match → stop hand-prompting context; extract & publish the system first.

## Caveats
- **Source quality:** Official Anthropic docs (support.claude.com, anthropic.com, the cookbook) are authoritative. The system prompt is **leaked/reverse-engineered (unofficial)** — cross-corroborated across two independent repos, used here as insight into tendencies, not guarantees. House-style hex values are community reverse-engineering. Token-burn figures are practitioner anecdotes and version-sensitive.
- **Fast-moving preview:** Claude Design is a research preview; the model (4.7→4.8), metering (separate→shared pool, late May 2026), and handoff bundle format are all subject to change. Verify live before committing.
- **No controlled A/B test** exists comparing DESIGN.md vs reference-HTML vs scaffolded-system for first-pass quality; the ranking here is inferred from the model's own stated preference plus converging practitioner consensus.
- **Monochrome-original is slightly against the grain** of a tool whose default skill commits to a bold (warm, branded) aesthetic — expect to override actively and verify the house style hasn't crept back after each major regeneration.
