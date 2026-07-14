# Zugzwang — Claude Design Branding & Handoff: Decision Record

> **v1.0** · decision record · 2026-07-03
> **Status: CANON.** Supersedes the **B1→B2→B3** branding phasing and `ZUGZWANG-CD-GUIDE_B-series_v1_0.md`. Companion to `ZUGZWANG-CD_design-system-editing-manual_v1_0.md`.
> **Authorship:** web Claude (orchestrator) · ratified by operator (Hrishikesh) · **to be committed to the repo by Claude Code at/before the build-lane open** (edits made for PK/CD now must not be left PK-only).
> **Precedence:** SPEC.1/SPEC.2 > ADRs > `design-canon.md` > this record. This record governs the **CD→CC pipeline** (workflow), not the design *language*.

---

## Why this exists

The B-series (B1 identity → B2 assets → B3 token swap) phased branding as an abstract, staged exercise. Once the Claude Design system was built and shown to render the real product, that phasing became redundant overhead: **branding is decided by seeing it on the actual product surfaces, not on abstract canvases.** This record replaces the phasing with the visual-first pipeline ratified on 2026-07-03.

---

## The pipeline (three stages, sequential)

1. **Brand the design system** — in Claude Design, in the **existing "Zugzwang Design System" project**. Global brand (type, any accent, logo/wordmark, iconography, radii, component styling) is set **once at the system level** and propagates to every surface. Operated per the editing manual. *(Fable/deadline-bound — the only clock, window ~July 7.)*
2. **Bridge — values to repo tokens** — the final brand **values** are mirrored into the repo's token files (`globals.css`, against the frozen slot names in `design-token-contract` v0.2). Web Claude authors the token spec from the operator's values-log; Claude Code commits it. **The CD export bundle is a lossy reference, not canon.**
3. **Build** — Claude Code builds the surfaces **one at a time**, each against the **locked repo mockup (layout) + the branded repo tokens (look)**. Full critical-path ritual on the bet-engine / ledger / moderation / auth surfaces. **A run of per-surface build tasks, not one handoff.**

---

## The ten locked decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | B1→B2→B3 phasing scrapped; the B-series guide retired. | Visual-first branding on the real system makes staged phasing redundant. |
| 2 | Branding is done **once, globally, at the CD system level** — never per-mockup. | The published system propagates the brand; per-mockup branding produces 15 divergent brands (the drift trap). |
| 3 | **Path B:** CC builds from the 15 locked repo mockups (layout) + branded system (look). **No** separate end-to-end CD prototype is built or exported. | The repo mockups already are layout canon; a fresh CD prototype triplicates the layout source and burns the Fable window. |
| 4 | **Sequential:** branding fully completes **before** any CC build work begins. | Branding is Fable/deadline-bound (~July 7); Claude Code (Opus) has no window. Spend the scarce resource first; don't split the solo operator's attention. |
| 5 | **Monochrome is the permanent design language**, not a placeholder. Introducing an accent colour is a deliberate reopening requiring a `design-language.md` update **in the same commit**. | Locked design decision, stated in the CD system readme and `design-language` v0.5. |
| 6 | **YES = black / NO = white** poles are **semantic** (bet side, frozen at post-time) and are **never restyled**. | Load-bearing product semantics; the whole app depends on them. |
| 7 | CD→CC bridge = brand **values → repo token files** (`globals.css`) against the frozen slots. The CD export bundle is a lossy, proprietary reference, not canon. | The repo tokens are the build source of truth. |
| 8 | The brand swap is a **single token-layer change** that brands the entire coded product. | Three-tier token architecture; value swap at the primitive/semantic boundary (`design-token-contract` v0.2). |
| 9 | **Values-log discipline:** brand values are logged as they are set in CD (font names, any accent hex, radii, border weight, icon set, logo/icon SVGs). | This short list is the only thing that must survive out of CD; it makes the bridge a copy-paste, not a redo. |
| 10 | The build is a **run of per-surface tasks** under the full critical-path ritual — not a single handoff that emits the app. | Standing build discipline (`CLAUDE.md`, plan-then-execute, `design-handoff` §5). |

---

## Guardrails carried forward

- **Repo tokens + repo mockups are the single source of truth**; CD artifacts are throwaway references.
- **Monochrome** unless an accent is a ratified, documented reopening (decision 5).
- The **YES/NO poles are untouchable** (decision 6).
- **Critical-path ritual** on bet-engine / ledger / moderation / auth surface builds.
- **No invented market content**; Mumbai Metro Line 3 is the canonical demo.

---

## Open items (not gates)

- **Inventory gap.** Per `design-canon` §1/§8, **W2.9 (market-media tab) is OPEN — not designed**, and **W2.12 (feature-guide) is DESCOPED**. Path-B "build from the 15 mockups" cannot cover these two until W2.9 is designed (rides MEDIA.2) and W2.12 is re-scoped at a later sweep. **Verify the full inventory against the live repo before opening the build lane.**
- **Repo commit** of the reconciled design docs + this record is required **at/before the build-lane open**, so repo canon reconverges. Edits made for PK/CD now must not be left PK-only.
- **Retire** the B-series tracker rows and the B-series guide (repo op).
- **Optional:** a read-only CC inventory recon can pre-clear the build lane.

---

## Pointers

- **Operating the branding:** `ZUGZWANG-CD_design-system-editing-manual_v1_0.md`.
- **Design canon / locked surfaces + decisions:** `design-canon.md`.
- **Language + tokens:** `design-language.md` v0.5 · `design-token-contract.md` v0.2.
- **Handoff mechanics (being reconciled to this record):** `design-handoff.md` · `design-workflow.md`.

---

*End v1.0. This record is the workflow anchor; the design-language and token bodies are unchanged by it. The repo remains the build source of truth; CD artifacts are references.*
