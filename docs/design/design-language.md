# Zugzwang — Design Language (high-fidelity monochrome)

> **Doc:** `docs/design/design-language.md`
> **Status:** v0-draft · precursor · living document
> **Phase:** experiment-phase VISUAL stratum
> **Authorship:** web Claude (orchestrator) · ratified by operator · committed by Claude Code
>
> **What this is.** The shared design *language* for every experiment-phase surface: the locked visual constraints, the token vocabulary, the component primitives, the state-shape rules, and the per-surface primitive map. It is the single reference every Claude Design session and every Claude Code handoff is built against.
>
> **What this is NOT.** It is not `design.md`. `design.md` (locked by ADR-0012 / SPEC.13) is *derived* from the approved high-fidelity mockups at task **DESIGN.8** — it is the final, value-filled, version-locked spec. This document is the precursor DESIGN.8 derives from. Its sections are organised to map cleanly onto `design.md`'s token + applied-pattern structure.
>
> **Division of labour.** This document carries *vocabulary and constraints* — token *names* and their semantic roles, the primitive list, the rules that must hold. It does **not** carry *values*. Exact greys, type family, and spacing/radius/elevation/motion scales are designed by the operator in Claude Design. The token tables here are intentionally empty: locked names, blank values.
>
> **Grounding.** Constraints and conventions trace to SPEC.1 (§6 lifecycles · §7 bet flow · §9 debate view · §11 invariants), SPEC.2 (§14 invariant contract), and ADR-0017 (ranking). Spec IDs are cited as anchors; the rules are stated in plain design terms.
>
> **Living.** The primitive vocabulary (§3) grows additively as each surface is designed, per the placeholder convention in the planner. Additions never silently rewrite a locked constraint (§1) or a state-shape rule (§4); those change only by explicit decision.

---

## §1 — Locked constraints

Every Claude Design session and every Claude Code handoff carries these. Non-negotiable unless explicitly reopened.

1. **High fidelity.** Surfaces are designed at production visual fidelity — real type, real spacing, real components. *(Not low-fidelity wireframes — that approach was considered and dropped.)*

2. **Monochrome is the language, not a placeholder.** The entire experiment-phase design is black, white, and grey. This is the durable look — not a stand-in for a colour design that arrives later.

3. **Black and white are the two poles of the debate.** The two sides of every market are encoded as the two monochrome extremes:
   - **Support / YES → black** *(default — see the flagged choice at the end of this section)*
   - **Counter / NO → white**

   This binding is semantic and permanent. It is the visual form of the thesis: every market has two opposed sides, and the design never lets you forget which side you're reading. The exact *rendering* (filled vs. outline, inverted panels, badge treatment) is a high-fidelity decision made in Claude Design at DESIGN.1; the *binding* of side → pole is locked here.

4. **Grey is the default — and the future-colour placeholder.** Everything that is not a side — surfaces, borders, text hierarchy, structure, disabled states — lives on a neutral grey ramp. The grey ramp does double duty: it is the working neutral palette now, **and** it is the slot the brand accent fills later. (See §2.1 and §7.)

5. **One brand accent, deferred, applied in code.** Exactly one brand accent colour lands at the very end of the design phase, applied **in Claude Code as a token swap** — repainting a defined slice of the grey ramp — not by re-skinning surfaces in Claude Design. The rule handed to Claude Code at the brand pass: *repaint the designated greys; leave the black/white side coding untouched.*

6. **Claude Design produces monochrome only.** Claude Design never introduces colour. All colour work — the accent, any branded palette — happens later, in Claude Code. If a mockup shows colour, it is wrong.

7. **Desktop-only.** Every surface is designed for a single desktop viewport. No mobile, no tablet, no responsive variants this phase. (Mobile is a later pass — §7.)

8. **The four thesis invariants carry visual obligations.** The design must keep these legible at all times:
   - **INV-1 — every bet carries an argument.** No buy without a comment field; "no stake, no voice." (Selling is the only comment-free action.)
   - **INV-2 — no Dharma overdraft.** The live balance is visible wherever a stake is committed; the two bet floors are enforced at the input.
   - **INV-3 — a comment's side is frozen at post-time.** The YES/NO badge on a post never changes, even if its author later flips or exits.
   - **INV-4 — resolved markets are frozen.** Resolved / voided surfaces read as permanently locked, not editable.

> **One flagged choice — confirm or flip.** I defaulted **Support/YES = black, Counter/NO = white**. There is no canonical reason it can't be the reverse. If you want NO = black, say so and I flip the binding everywhere.

---

## §2 — Token vocabulary (empty schemas)

Locked token *names* + their semantic role. **Values are blank** — designed by the operator in Claude Design, finalised into `design.md` at DESIGN.8.

### §2.1 Colour — three roles

Colour carries exactly three roles. Only the **side** role has locked values (black / white); the rest are designed in Claude Design.

| Role | Token | Value | Notes |
|---|---|---|---|
| Side — Support/YES | `color.side.support` | **black (locked)** | One pole. Permanent, semantic. |
| Side — Counter/NO | `color.side.counter` | **white (locked)** | The other pole. Permanent, semantic. |
| Neutral ramp | `color.neutral.0 … color.neutral.N` | *(blank — CD)* | Surfaces, borders, text hierarchy, structure, disabled. Working palette **and** future-accent slot. |
| Accent | `color.accent.*` | *(deferred — CC)* | One brand accent. Applied in code at the brand pass, into a defined slice of the neutral ramp. Never used in CD. |

*The number of neutral steps, their exact greys, and which steps the accent later replaces are designed in CD / decided at the brand pass.*

### §2.2 Typography

| Slot | Token | Value | Notes |
|---|---|---|---|
| Display / headline | `type.family.display` | *(blank — CD)* | |
| Body / UI | `type.family.body` | *(blank — CD)* | |
| Mono / numeric | `type.family.mono` | *(blank — CD)* | For prices, Dharma balances, the resolution clock — if the CD aesthetic adopts a mono numeric treatment. |
| Scale | `type.scale.*` | *(blank — CD)* | |
| Weights | `type.weight.*` | *(blank — CD)* | |

### §2.3 Spacing · radius · elevation · motion

| System | Token | Value | Notes |
|---|---|---|---|
| Spacing scale | `space.*` | *(blank — CD)* | |
| Radius scale | `radius.*` | *(blank — CD)* | |
| Elevation / shadow | `elevation.*` | *(blank — CD)* | Monochrome — shadow as grey, never colour. |
| Motion | `motion.duration.*`, `motion.ease.*` | *(blank — CD)* | Motion polish is a later pass (§7); names reserved now. |

### §2.4 Breakpoints

| Token | Value | Notes |
|---|---|---|
| `breakpoint.desktop` | *(single target — CD)* | Desktop-only this phase. Mobile/tablet breakpoints are a later pass (§7); not defined now. |

---

## §3 — Component primitives (living vocabulary)

The shared kit. **Thesis-load-bearing primitives** carry intent + states + content slots (consistency *and* invariant-correctness matter here). **Generic primitives** carry intent only. The list grows additively as surfaces are designed.

### §3.1 Thesis-load-bearing primitives

**Side badge** *(INV-3)*
- *Intent:* marks which side (YES/NO) a post argues.
- *Rule:* frozen at post-time; never changes. YES → black pole, NO → white pole.
- *States:* YES · NO.

**Position marker** *(F-DEBATE-2 / F-DEBATE-3)*
- *Intent:* shows whether a post's author still holds the side they argued.
- *States:* **none** (still on that side — the default; no marker rendered) · **Flipped** (now on the opposite side) · **Exited** (no position).
- *Rule:* computed live on read; freezes at resolution.

**Resolution / lifecycle marker** *(INV-4)*
- *Intent:* shows a market's terminal state.
- *States:* Open · Closed · Resolving · **Resolved** · **Voided** · **Frozen** (read-only after Nov 5).
- *Rule:* resolved / voided / frozen render as permanently locked.

**Top-level post**
- *Intent:* one stake-backed argument.
- *Slots:* side badge · position marker · author's own stake (`a`) at the header · argument text/image · **Support/Counter aggregate** footer.
- *Rule:* every post rides a bet (INV-1).

**Reply (depth-1)**
- *Intent:* a Support or Counter bet on a post; itself a stake-backed argument.
- *Rule:* flat (one level only); ordered by stake descending within its side; earlier-posted wins ties.
- *Slots:* side badge · position marker · reply stake · argument text.

**Support/Counter aggregate**
- *Intent:* the weight of replies on each side of a post.
- *Form:* `Support (count) : Đ  /  Counter (count) : Đ` — a **read-only** read-time aggregate.
- *Rule:* **there is no vote control.** No up/down arrows, no `↑N ↓M`. Friendly-fire is removed entirely. Support/Counter are computed, never cast.

**Mandatory comment field** *(INV-1)*
- *Intent:* the argument attached to every buy.
- *Rule:* present on every buy (entry and same-side add). Absent only on sell (the one comment-free action). Enforces "no stake, no voice."

**Single-side buy/sell panel**
- *Intent:* commit, add to, or exit a position.
- *Rule:* a user holds at most one side at a time. To switch sides: sell to zero, then re-enter with a fresh commented bet. Buy enforces the bet floor (post floor / reply floor) against the live Dharma balance (INV-2).
- *Slots:* side selector (entry only) · amount · slippage control · mandatory comment field (on buy) · live balance · cost/payout preview.

**Slippage modal**
- *Intent:* confirm price impact on a CPMM trade (per the slippage spec).

**Dharma balance**
- *Intent:* the user's spendable Đ.
- *Rule:* visible wherever a stake is committed.

**Empty-side CTA**
- *Form:* `Be the first to argue [YES/NO]` — rendered on a side with no posts yet.

### §3.2 Surface & navigation primitives

- **App shell / nav** — global navigation + auth/identity entry point.
- **Market card** — a market at a glance (odds/price, title, category, activity). Reused across Discovery and Profile; must be identical everywhere.
- **Category / tab vocabulary** — the taxonomy that groups and filters markets.
- **Featured / trending rail** — a curated horizontal rail of highlighted markets.
- **Price chart** — a market's price history.
- **Debate mode selector** — switches the debate-view ranking mode; echoes the active mode.
- **Pseudonym / PFP** — a participant's anonymous identity (name + avatar from the identity pool). Renders a permanent placeholder once scrubbed (erasure).

### §3.3 Generic primitives

Buttons · inputs · selects · modals/dialogs · toasts/inline errors · tabs · badges/chips · tables/lists · pagination. *Intent only; standard behaviour; designed in CD.*

---

## §4 — State-shape conventions (cross-surface rules)

The visual rules that MUST hold identically on every surface. Thesis-load-bearing; they do not change per screen.

1. **Side is frozen and always shown.** Every post and reply shows its YES/NO badge, bound to the side held at post-time; it never changes (INV-3).
2. **Position marker is live, then frozen.** `none` / Flipped / Exited is computed on read and freezes at resolution (F-DEBATE-2/3). Default is `none` — no marker.
3. **No vote affordance anywhere.** Support/Counter are read-only aggregates. No upvote/downvote, no friendly-fire control, on any surface.
4. **Every buy shows the comment field.** No buy without an argument (INV-1). Sell is the only comment-free action.
5. **Single-side everywhere.** One side per market at a time; the UI never lets a user hold both. Switching is sell-to-zero, then re-enter.
6. **Resolved is read-only.** Resolved / voided / frozen markets render as permanently locked — no bet, no comment affordances (INV-4).
7. **Moderation is invisible to the public.** Track-B (queued) comments are hidden from anonymous and non-admin users; an authenticated admin sees them inline with a pending-review marker; the author sees their own on their profile. (Admin's full visual language is a later pass — §7.)
8. **Balance and floors are honest.** Where a stake is committed, the live Dharma balance and the applicable floor are visible; the input cannot submit below the floor or above the balance (INV-2).

---

## §5 — Per-surface primitive map

Which primitives each surface composes — the anchor that keeps shared primitives identical across screens. **Layouts are designed per slot in Claude Design; this is the parts list, not the arrangement.** Exact slot decomposition lives in the planner.

| Primitive | Landing | Discovery | Market detail + bet | Debate view | Profile (/me) |
|---|:--:|:--:|:--:|:--:|:--:|
| App shell / nav | ● | ● | ● | ● | ● |
| Market card | | ● | | | ● |
| Category / tab vocabulary | | ● | | | |
| Featured / trending rail | ◐ | ● | | | |
| Price chart | | | ● | ◐ | |
| Single-side buy/sell panel | | | ● | | |
| Mandatory comment field | | | ● | ● | |
| Slippage modal | | | ● | | |
| Side badge | | | ◐ | ● | ◐ |
| Position marker | | | | ● | ◐ |
| Resolution / lifecycle marker | | ◐ | ● | ● | ◐ |
| Top-level post | | | | ● | ◐ |
| Reply (depth-1) | | | | ● | |
| Support/Counter aggregate | | | | ● | |
| Debate mode selector | | | | ● | |
| Dharma balance | | | ● | ● | ● |
| Pseudonym / PFP | | | | ● | ● |
| Empty-side CTA | | | | ● | |

● primary · ◐ present in a secondary/compact form (e.g., profile history rows show frozen badges/markers; a landing rail is a reduced market card).

---

## §6 — Debate-view conventions

The highest-iteration surface. Its structure is locked here so every iteration in Claude Design holds the same shape.

- **Two columns: YES (Support) and NO (Counter)** — the two poles side by side.
- **Top-level posts are ranked**, default **Top** (a composite), with selectable modes: **Most Debated**, **Highest Stakes**, **Contested**, **Newest**. The active mode is echoed in the UI. (Surging is deferred.)
- **Replies are flat (one level only)**, ranked **by stake descending within their side**, earlier-posted winning ties.
- **Two-slot default render:** each post surfaces the **top reply of each side** (one Support, one Counter); expanding shows that side's full stake-sorted list.
- **Each post** shows the author's own stake at its header and the **Support/Counter aggregate** at its footer — no vote control.
- **Empty side** shows `Be the first to argue [YES/NO]` until a post exists.
- **Refresh is polled**, not pushed (no live sockets this phase); new posts, new reply-bets, changed markers, and re-ranking appear on the next poll.
- **Track-B comments** are admin-only inline (pending-review marker); never visible to the public.

---

## §7 — Later passes (in scope, sequenced after the five monochrome surfaces)

Scheduled, not excluded. These run after the five monochrome surfaces are designed and signed off.

1. **Brand pass.** The one brand accent (applied in Claude Code as a token swap into the designated greys — *side black/white untouched*), logo, mascots, and type refinement. Feeds `design.md` / ADR-0012 at DESIGN.8.
2. **Admin visual language.** The admin hub and inline moderation surfaces get their own visual language — deliberately distinct from participant surfaces, reinforcing the structural rule that **admin is not a participant** (no account, no bet, no comment, no position). Designed as its own pass.
3. **Mobile / responsive.** A responsive pass over the desktop surfaces.
4. **Motion polish.** Finalising motion tokens and transitions.

---

*End design-language v0-draft. Values designed in Claude Design; derived into `design.md` at DESIGN.8. Living vocabulary — §3 grows additively; §1 and §4 change only by explicit decision.*
