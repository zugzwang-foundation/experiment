# Zugzwang — Design Language (high-fidelity monochrome)

> **Doc:** `docs/design/design-language.md`
> **Status:** v0.7-draft · precursor · living document
> **Phase:** experiment-phase VISUAL stratum
> **Authorship:** web Claude (orchestrator) · ratified by operator · committed by Claude Code
>
> **What this is.** The shared design *language* for every experiment-phase surface: the locked visual constraints, the token vocabulary, the component primitives, the state-shape rules, and the per-surface primitive map. It is the single reference every Claude Design session and every Claude Code handoff is built against.
>
> **What this is NOT.** It is not `design.md`. `design.md` (locked by ADR-0012 / SPEC.13) is *derived* from the approved high-fidelity mockups at task **DESIGN.SPEC** (formerly DESIGN.8) — it is the final, value-filled, version-locked spec. This document is the precursor DESIGN.SPEC derives from. Its sections are organised to map cleanly onto `design.md`'s token + applied-pattern structure.
>
> **Division of labour.** This document carries *vocabulary and constraints* — token *names* and their semantic roles, the primitive list, the rules that must hold. Values land here only once they are minted in the built system: the colour **side poles** and the **neutral ramp** now carry landed OKLCH values (SHELL/UI.0 mint — §2.1 provenance); typography, spacing, radius, elevation, and motion values remain **blank**, designed by the operator in Claude Design; the **accent** is deferred to the brand pass. Tokens not yet designed stay explicitly blank (§1.10) — never vaguely described.
>
> **Grounding.** Constraints and conventions trace to SPEC.1 (§6 lifecycles · §7 bet flow · §9 debate view · §11 invariants), SPEC.2 (§14 invariant contract), and ADR-0017 (ranking). Spec IDs are cited as anchors; the rules are stated in plain design terms. The house-style and exactness constraints (§1.9–§1.10) and the state-completeness rules (§4.9–§4.10) trace to the Claude Design high-fidelity research (`Research_Report_v2.md`).
>
> **Living.** The primitive vocabulary (§3) grows additively as each surface is designed, per the placeholder convention in the planner. Additions never silently rewrite a locked constraint (§1) or a state-shape rule (§4); those change only by explicit decision.
>
> **v1.0 lock (2026-06-17).** The four core surfaces (Discovery · Market Detail · Reply · Profile) + the Bookmark page are now **LOCKED at integration-shell v1.0**. This design language is the constraint set they embody and the reference the **DESIGN Wave-2** surfaces and the **Claude Design handover** are built against. The locked detail lives in the consolidated design PK (`DESIGN-phase-record`, motion / spec / copy consolidated); the final value-filled spec is derived at **DESIGN.SPEC**.

---

## §1 — Locked constraints

Every Claude Design session and every Claude Code handoff carries these. Non-negotiable unless explicitly reopened.

1. **High fidelity.** Surfaces are designed at production visual fidelity — real type, real spacing, real components. *(Not low-fidelity wireframes — that approach was considered and dropped.)*

2. **Monochrome is the language, not a placeholder.** The entire experiment-phase design is black, white, and grey. This is the durable look — not a stand-in for a colour design that arrives later.

3. **Black and white are the two poles of the debate.** The two **sides** of every market — its **YES** and its **NO** — are encoded as the two monochrome extremes:
   - **YES → black** *(side→pole binding CONFIRMED by operator, 2026-06-05)*
   - **NO → white**

   This binding is semantic and permanent, and it encodes the **side** (the position a bet takes, frozen at post-time — INV-3) and only the side. It is the visual form of the thesis: every market has two opposed sides, and the design never lets you forget which side you're reading. The exact *rendering* (filled vs. outline, inverted panels, badge treatment) is realised in the locked **v1.0** surfaces; the *binding* of side → pole is locked here.

   > **Side ≠ Support/Counter — the axis correction (v1.0 lock, 2026-06-17).** The black/white poles encode **side (YES/NO)**, nothing else. **Support/Counter is a separate, post-relative relation** — whether a reply *agrees or disagrees with its parent post* — and is **never** a colour, a pole, or a column. Supporting a YES post means betting YES (black); supporting a NO post means betting NO (white) — so Support has no fixed colour. Support/Counter appears only on the post's **split bar** and in the **composer**. (See §6. This supersedes the earlier "Support↔YES / Counter↔NO" wording.)

4. **Grey is the default — and the future-colour placeholder.** Everything that is not a side — surfaces, borders, text hierarchy, structure, disabled states — lives on a neutral grey ramp. The grey ramp does double duty: it is the working neutral palette now, **and** it is the slot the brand accent fills later. (See §2.1 and §7.)

5. **One brand accent, deferred, applied in code.** Exactly one brand accent colour lands at the very end of the design phase, applied **in Claude Code as a token swap** — repainting a defined slice of the grey ramp — not by re-skinning surfaces in Claude Design. The rule handed to Claude Code at the brand pass: *repaint the designated greys; leave the black/white side coding untouched.* (Resolved at B1: no accent — see §2.1.)

6. **Claude Design produces monochrome only.** Claude Design never introduces colour. All colour work — the accent, any branded palette — happens later, in Claude Code. If a mockup shows colour, it is wrong.

7. **Desktop-only.** Every surface is designed for a single desktop viewport. No mobile, no tablet, no responsive variants this phase. (Mobile is a later pass — §7.)

8. **The four thesis invariants carry visual obligations.** The design must keep these legible at all times:
   - **INV-1 — every bet carries an argument.** No buy without a comment field; "no stake, no voice." (Selling is the only comment-free action.)
   - **INV-2 — no Dharma overdraft.** The live balance is visible wherever a stake is committed; the two bet floors are enforced at the input.
   - **INV-3 — a comment's side is frozen at post-time.** The YES/NO badge on a post never changes, even if its author later flips or exits.
   - **INV-4 — resolved markets are frozen.** Resolved / voided surfaces read as permanently locked, not editable.

9. **The Claude Design house style is banned, by name.** Claude Design's underlying model carries a default "house style" that surfaces whenever context is thin. Every element of it is banned, each paired with its neutral replacement:
   - warm / cream / parchment ground → the dark true-neutral ground (`--color-ground` `#181818` — BRIDGE era; the light/near-white ground is retired)
   - serif display type → a single neutral sans-serif family carries display and body; hierarchy comes from weight and size, never from family changes (ratified FINAL at the brand pass: Geist — the §7 revisit is closed)
   - terracotta or any warm accent → no accent at all (closed at B1: true-neutral ratified, none exists — constraint 5's open question is resolved)
   - warm-tinted greys → **true-neutral greys**, zero warm cast, across the entire ramp
   - large border radii → **small-or-zero radius**, with **hairline (1px) borders** carrying separation
   Where elevation/shadow is used, it is neutral grey — never warm-tinted (§2.3). If any of these house-style elements appears in a mockup, it is wrong, the same way colour is wrong (constraint 6). *Slot-1 record (2026-06-05): a serif/aged-paper "old newspaper" direction was explored at the operator's request and **rejected** — the one-sans + true-neutral rules stand reaffirmed, and "no editorial/newspaper styling" is carried into every CD prompt as a named negative.*

10. **Specs and prompts speak in exact values, never adjectives.** Aesthetic adjectives — "modern", "clean", "minimal", "professional", "sleek" — are banned from this document, from the constraints block, and from every Claude Design prompt. The model resolves such adjectives against its own priors, and they can silently override explicit specs (e.g. "modern" re-rounding corners that were specified square). Wherever a value is stated, it is exact — a hex, a px, a named family, a count. Tokens not yet designed stay **explicitly blank** (per the division of labour above) rather than vaguely described.

> **Binding resolved.** **YES = black, NO = white** — the **side → pole** binding, confirmed by the operator at the look-anchor slot, 2026-06-05, and held through the v1.0 lock. Support/Counter is a separate, post-relative relation (§1.3 note, §6), never a colour or column. Locked alongside the constraint set; flipping now requires explicitly reopening this section.

---

## §2 — Token vocabulary

Locked token *names* + their semantic role. The colour **side poles** and the **neutral ramp** carry **landed values** (SHELL/UI.0 mint, re-valued at the BRIDGE brand swap — 2026-07-14; provenance below). Typography, spacing, radius, elevation, and motion remain **blank — CD**; the **accent** is **deferred** to the brand pass. Remaining values are designed by the operator in Claude Design and finalised into `design.md` at DESIGN.SPEC.

### §2.1 Colour — three roles

Colour carries exactly three roles. The side poles and the neutral ramp carry landed hex values (hex-authoritative since BRIDGE); the accent question is closed — none exists (true-neutral, ratified at B1).

| Role         | Token                                    | Value                                                                     | Notes                                                                                                                                                                                                                                                            |
|--------------|------------------------------------------|---------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Side — YES   | color.side.yes                           | black — `#181818` (locked)                                                | One pole. Permanent, semantic. Encodes side, not Support/Counter (§1.3). ↔ `--color-yes` (literal since BRIDGE — de-aliased, contract §3.1).                                                                                                                     |
| Side — NO    | color.side.no                            | white — `#fafafa` (locked)                                                | The other pole. Permanent, semantic. ↔ `--color-no` (literal since BRIDGE — de-aliased, contract §3.1).                                                                                                                                                          |
| Neutral ramp | color.neutral.0 … .7 + color.neutral.ink | landed — 9-step true-neutral ramp (hex, achromatic R=G=B), dark → bright   | Surfaces, borders, text hierarchy, structure, disabled. **Inverted vs the retired light ramp — never copy values across eras by name or lightness.** Page ground `--color-ground` `#181818` sits alongside, outside the ramp census. ↔ `--color-n0` … `--color-n7` + `--color-ink`. |
| Accent       | color.accent.*                           | none — ratified out (B1: true-neutral)                                    | Closed. No accent exists; contract §2.2 stays reserved-empty (name-space protected by the `--color-brand` CI ban). Nothing is deferred.                                                                                                                          |

*The ramp's step count and exact greys are landed (provenance below). The brand pass has happened: no accent repaints any step — the system is permanently true-neutral this phase.*

**Provenance — SHELL/UI.0 token mint (the DESIGN.7 back-apply · 2026-06-24 · PR #161).** The values live in `src/app/globals.css` as the locked v1.0 monochrome system. The neutral ramp is `--color-n0 … --color-n7` + `--color-ink` — 9 true-neutral greys, chroma 0 (the Tailwind-neutral OKLCH equivalents of the design hex, verified by deterministic conversion): `n0 oklch(1 0 0)` · `n1 oklch(0.971 0 0)` · `n2 oklch(0.922 0 0)` · `n3 oklch(0.871 0 0)` · `n4 oklch(0.708 0 0)` · `n5 oklch(0.556 0 0)` · `n6 oklch(0.371 0 0)` · `n7 oklch(0.205 0 0)` · `ink oklch(0.145 0 0)`. The side poles are `--color-yes oklch(0.145 0 0)` (YES = black = ink) and `--color-no oklch(1 0 0)` (NO = white = n0). The code comments bind **side** (YES/NO) and explicitly disavow the Support/Counter relation ("NOT Support") — Support/Counter is a read-time stance toward a parent, not a colour pole. `--color-accent` is deliberately absent (the brand pass mints it). The shadcn semantic `:root` ramp (`--background`, `--foreground`, `--card`, …) resolves to these same greys — `--color-n*` is the design-system vocabulary; the shadcn semantic layer is the component-consumed one. The monochrome system is pinned by `tests/unit/design/tokens-monochrome.test.ts` — a slot rename or chroma drift fails CI.

Provenance — BRIDGE brand swap (values-log v0_3 §3 · 2026-07-14 · the bridge commit). The branded dark system landed on the same frozen slot names, hex-authoritative (Biome normalizes hex to lowercase; CSS hex is case-insensitive; the values-log dump cites uppercase): ground `--color-ground` `#181818` (new primitive; generates `bg-ground`; outside the 11-token census) · ramp `n0 #212121 · n1 #2a2a2a · n2 #404040 · n3 #545454 · n4 #747474 · n5 #989898 · n6 #bdbdbd · n7 #e4e4e4 · ink #fafafa` — achromatic, dark → bright, inverted vs the retired light ramp · poles `--color-yes` `#181818` (YES = black; the value coincides with the ground — a coincidence of value, not of role) and `--color-no` `#fafafa` (NO = white; coincides with ink). The side binding is unchanged (R-1): the poles encode SIDE, never the Support/Counter relation — the "NOT Support" comment coupling survives verbatim in code. The poles are literals, deliberately de-aliased from the ramp (WI-1): a name-alias across inverted eras is exactly the pole-flip trap the bridge was built to kill. oklch appears in comments only. The applied-semantic / state / elevation / radius layer minted alongside is censused in the token contract v0.4. Guard: `tests/unit/design/tokens-monochrome.test.ts` — exact hex pins, 11-count census (R=G=B), ground/graph/destructive pins, string bans.

### §2.2 Typography

| Slot | Token | Value | Notes |
|---|---|---|---|
| Display / headline | `type.family.display` | *(blank — CD)* | |
| Body / UI | `type.family.body` | *(blank — CD)* | |
| Mono / numeric | `type.family.mono` | *(blank — CD)* | For prices, Dharma balances, the resolution clock — if the CD aesthetic adopts a mono numeric treatment. |
| Scale | `type.scale.*` | *(blank — CD)* | |
| Weights | `type.weight.*` | *(blank — CD)* | |

*This phase, `type.family.display` and `type.family.body` resolve to **one neutral sans-serif family** (§1.9) — hierarchy is carried by weight and size contrast, not by switching families. Which family is a CD decision; serif display faces are banned as house style; the brand pass may revisit families (§7).*

### §2.3 Spacing · radius · elevation · motion

| System | Token | Value | Notes |
|---|---|---|---|
| Spacing scale | `space.*` | *(blank — CD)* | |
| Radius scale | `radius.*` | *(blank — CD)* | Small or zero (§1.9). |
| Elevation / shadow | `elevation.*` | *(blank — CD)* | Monochrome — shadow as true-neutral grey, never colour, never warm-tinted (§1.9). |
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
- *Slots:* side badge · position marker · author pseudonym/avatar + own stake (`a`) at the header · argument **title + body** *(two text parts — pending SPEC.1 amendment, SCL-1)* + optional attachment · **Support/Counter aggregate** footer (rendered as the reply stake bar where compact).
- *Rule:* every post rides a bet (INV-1).

**Reply (depth-1)**
- *Intent:* a Support or Counter bet on a post; itself a stake-backed argument.
- *Rule:* flat (one level only); ordered by stake descending within its side; earlier-posted wins ties.
- *Slots:* side badge · position marker · reply stake · argument text.

**Support/Counter aggregate**
- *Intent:* the weight of replies that **support vs. counter** a post (post-relative — see §6).
- *Form:* `Support (count) : Đ  /  Counter (count) : Đ` — a **read-only** read-time aggregate.
- *Rule:* **there is no vote control.** No up/down arrows, no `↑N ↓M`. Friendly-fire is removed entirely. Support/Counter are computed, never cast.

**Mandatory comment field** *(INV-1)*
- *Intent:* the argument attached to every buy.
- *Rule:* present on every buy (entry and same-side add). Absent only on sell (the one comment-free action). Enforces "no stake, no voice."

**Single-side buy/sell panel**
- *Intent:* commit, add to, or exit a position.
- *Rule:* a user holds at most one side at a time. To switch sides: sell to zero, then re-enter with a fresh commented bet. Buy enforces the bet floor (post floor / reply floor) against the live Dharma balance (INV-2) and the per-bet cap `BET_MAX_STAKE` (buy/add only — **sell is never clamped**). A partial sell is native CPMM behaviour — sell N shares, the curve reprices, proceeds are credited; no new mechanism, no extra parameter.
- *Slots:* side selector (entry only) · amount input with the per-bet cap clamp (buy/add: over-cap disables submit + inline max strip, the W2.11 P3 primitive) · mandatory comment field (on buy) · live balance · price/shares/cost-or-proceeds display · **sell module** (defaults to the full position, editable to a partial amount).

**Slippage modal — RETIRED** *(W2.10 · deep-liquidity Option A, ratified 2026-06-27)*
- Deep-liquidity seeding + the per-bet cap `BET_MAX_STAKE` keep single-bet price impact sub-threshold, so there is **no slippage warning and no tolerance control — buy or sell**. The d5 "Price impact warning" modal is retired. Kept here as a named-retired record so no CD prompt or build resurrects it.

**Dharma balance**
- *Intent:* the user's spendable Đ.
- *Rule:* visible wherever a stake is committed.

**Empty-side CTA**
- *Form:* `Be the first to argue [YES/NO]` — rendered on a side with no posts yet.

### §3.2 Surface & navigation primitives

- **App shell / nav** — global navigation + auth/identity entry point.
- **Market card** — a market at a glance. **Locked composition (Slot 1):** image thumb + question · two-line sparkline · YES/NO split bar · `Đ volume · posts · replies`. *(Category chip, lifecycle marker, and close date are parked off the Discovery card — still in the vocabulary for other renders.)* Reused across Discovery and Profile; must be identical everywhere.
- **Category / tab vocabulary** — the taxonomy that groups and filters markets.
- **Featured / trending rail** — a curated horizontal rail of highlighted markets.
- **Price chart** — a market's price history.
- **Debate mode selector** — switches the debate-view ranking mode; echoes the active mode.
- **Pseudonym / PFP** — a participant's anonymous identity (name + avatar from the identity pool). Renders a permanent placeholder once scrubbed (erasure).
- **Split bar** *(originated Slot 1)* — the shared two-pole bar: **label — bar — label**, text never inside the bar. Two variants on two different axes: the **market price bar** (`YES n% — bar — NO m%` — a **side** bar; black fill = the YES-side share, anchored to the YES side) and the **reply stake bar** (`SUPPORT Đx — bar — COUNTER Đy`, under a `Replies · count · Đ total` header — a **post-relative** Support/Counter bar, §6). *(The reply stake bar's exact fill mapping follows the locked v1.0 surface.)*
- Two-line price graph (originated Slot 1) — YES and NO as two always-complementary lines (mirrors crossing at 50%). The pole that matches the ground cannot render on it, so one line is always a grey stand-in — series-bound via tokens, never restyled ad hoc. Current (dark ground, BRIDGE): YES = `--graph-yes` `#737373` (grey stands in for the black pole) · NO = `--graph-no` `#fafafa`. Retired light-era mirror: YES = solid ink, NO = grey standing in for white. Full-size on market panels; sparkline on cards.
- **Market image thumb** *(originated Slot 1)* — every market carries an image reference rendered beside its question (hero and card sizes); labelled placeholder until the asset exists *(field pends SPEC.1 amendment, SCL-2)*.
- **Featured-market hero** *(originated Slot 1)* — the Discovery centerpiece: three panels — top YES post | the market (image+question · two-line graph · price bar · `Đ staked · posts · replies`) | top NO post — over a dot-indicator carousel. Supersedes the generic rail on Discovery; the reduced-rail wording stays for any landing use.

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
9. **Interactive states are part of the primitive.** Every interactive primitive — buttons, inputs, tabs, category chips, cards-as-links, the buy/sell panel controls — defines **hover · focus · active · disabled** on the neutral ramp, monochrome only, with a *visible* focus treatment. These states are designed in Claude Design as part of the primitive, not improvised at build time.
10. **Surface states ship with the surface.** Each surface's **loading, empty, and error** shapes are part of its design and are rendered before handoff — never left for the build to invent. (The empty-side CTA in §3.1 is the debate-view instance of this rule.)

---

## §5 — Per-surface primitive map

Which primitives each surface composes — the anchor that keeps shared primitives identical across screens. **Layouts are designed per slot in Claude Design; this is the parts list, not the arrangement.** Exact slot decomposition lives in the planner.

| Primitive | Landing | Discovery | Market detail + bet | Debate view | Profile (/me) |
|---|:--:|:--:|:--:|:--:|:--:|
| App shell / nav | ● | ● | ● | ● | ● |
| Market card | | ● | | | ● |
| Category / tab vocabulary | | ● | | | |
| Featured / trending rail → **featured-market hero** on Discovery | ◐ | ● | | | |
| Price chart | | ◐ | ● | ◐ | |
| Single-side buy/sell panel | | | ● | | |
| Mandatory comment field | | | ● | ● | |
| Side badge | | ◐ | ◐ | ● | ◐ |
| Position marker | | | | ● | ◐ |
| Resolution / lifecycle marker | | ◐ | ● | ● | ◐ |
| Top-level post | | ◐ | | ● | ◐ |
| Reply (depth-1) | | | | ● | |
| Support/Counter aggregate | | ◐ | | ● | |
| Debate mode selector | | | | ● | |
| Dharma balance | | | ● | ● | ● |
| Pseudonym / PFP | | | | ● | ● |
| Empty-side CTA | | | | ● | |

● primary · ◐ present in a secondary/compact form (e.g., profile history rows show frozen badges/markers; a landing rail is a reduced market card).

*(The Slippage modal row is removed — the primitive is retired, §3.1.)*

---

## §6 — Debate-view conventions

The highest-iteration surface. Its structure is locked here so every iteration in Claude Design holds the same shape.

- **Two columns are the two fixed poles: left = YES (black), right = NO (white)** — the **same for every post**, regardless of the post's own side. Replies are routed into a column by their **own** YES/NO side.
- **Support/Counter is post-relative — never a column.** Whether a reply *supports* or *counters* a post is its stance toward that post (Support = agrees → same side as the post; Counter = disagrees → opposite side); because it flips with the post's side, it is never a column label or a colour. It appears only on the post's **split bar** (`SUPPORT Đx — bar — COUNTER Đy`) and in the **composer**.
- **Top-level posts are ranked**, default **Top** (a composite), with selectable modes: **Most Debated**, **Highest Stakes**, **Contested**, **Newest**. The active mode is echoed in the UI. (Surging is deferred.)
- **Replies are flat (one level only)**, ranked **by stake descending within their side**, earlier-posted winning ties.
- **Two-slot default render:** each post surfaces the **top reply in each column** (its top YES reply and its top NO reply); expanding shows that column's full stake-sorted list.
- **Each post** shows the author's own stake at its header and the **Support/Counter aggregate** (post-relative — stake agreeing vs. disagreeing with *this* post) at its footer — no vote control.
- **Empty side** shows `Be the first to argue [YES/NO]` until a post exists.
- **Refresh is polled**, not pushed (no live sockets this phase); new posts, new reply-bets, changed markers, and re-ranking appear on the next poll.
- **Track-B comments** are admin-only inline (pending-review marker); never visible to the public.

---

## §7 — Later passes (in scope, sequenced after the five monochrome surfaces)

Scheduled, not excluded. These run after the core monochrome surfaces (now **locked at v1.0**) and the **DESIGN Wave-2** surfaces are designed and signed off.

1. **Brand pass.** The one brand accent (applied in Claude Code as a token swap into the designated greys — *side black/white untouched*), logo, mascots, and type refinement. Feeds `design.md` / ADR-0012 at DESIGN.SPEC.
2. **Admin visual language.** The admin hub and inline moderation surfaces get their own visual language — deliberately distinct from participant surfaces, reinforcing the structural rule that **admin is not a participant** (no account, no bet, no comment, no position). Designed as its own pass.
3. **Mobile / responsive.** A responsive pass over the desktop surfaces.
4. **Motion polish.** Finalising motion tokens and transitions.

---

> **Changelog.**
> v0.7-draft (2026-07-14, BRIDGE) — brand swap landed: §1.9 ground → dark (`--color-ground` `#181818`); §1.9 sans/accent bullets closed (Geist FINAL; no accent — true-neutral ratified); §2/§2.1 restated hex-authoritative with the branded dark values, accent row closed, BRIDGE provenance appended (side binding unchanged, R-1; poles de-aliased to literals); §3.2 two-line graph gains the dark-ground mirror (`--graph-yes` `#737373` / `--graph-no` `#fafafa`, series-bound; light-era mirror retired). Version note: "v0.6-draft" existed only as a PK-side label during the branding sessions (no repo landing); the repo jumps v0.5 → v0.7 to keep citations coherent — any PK-side deltas are subsumed here. Source: values-log v0_3 §3 (committed alongside) + docs/plans/BRIDGE.md.
> **v0.5-draft (2026-07-02) — fork-merge + lineage repair (DC.1).** Two branches had forked from v0.2 with **colliding "v0.3" labels**: the **PK branch** (v0.3-draft 2026-06-05 → v0.4-draft 2026-06-17, never committed — design lane's pre-DC.3 posture) and the **disk branch** (v0.3-draft 2026-06-24, committed at SHELL/UI.0 PR #161, unaware of the PK line). v0.5 merges them. Base = PK v0.4 (axis correction + v1.0-lock reflection + DESIGN.SPEC renames, all retained). Folded in from disk = the §2.1 landed OKLCH values + SHELL/UI.0 provenance, restated onto the **corrected** side tokens (`color.side.yes`/`color.side.no` ↔ `--color-yes`/`--color-no`; the disk copy's `color.side.support`/`.counter` labels are dropped); neutral-ramp vocabulary aligned to the built CSS (`color.neutral.0 … .7` + `color.neutral.ink` ↔ `--color-n0…n7` + `--color-ink`); provenance gains the `tests/unit/design/tokens-monochrome.test.ts` CI pin. Stale residue repaired: §2 heading/intro and the header division-of-labour no longer claim all values blank; the closing line is version-synced (the disk copy's was stuck at v0.2). **Rulings fold (operator-ratified 2026-07-02):** §3.1 **Slippage modal → RETIRED** (W2.10 / deep-liquidity Option A, 2026-06-27 — no warning, no tolerance control, buy or sell; d5 "Price impact warning" modal retired; §5 map row removed); §3.1 buy/sell panel restated — per-bet cap `BET_MAX_STAKE` on buy/add (sell never clamped), sell module defaults to full position editable to partial, partial sell is native CPMM (no new mechanism); slots gain the cap clamp + price/shares/cost-or-proceeds display, drop the slippage control. No §1 constraint or §4 state-shape rule changed beyond the already-recorded axis correction. Authored at DC.1; committed at DC.3. Source: DC.1 fork-merge — disk verbatims via CC micro-recon, PK v0.4 copy, `slippage_bet-cap_FINAL-spec-package.md`, 2026-07-02.
> **[PK lineage] v0.4-draft (2026-06-17):** **Axis correction (the load-bearing fix)** — removed the Support↔YES / Counter↔NO conflation throughout (§1.3, §1 binding note, §2.1 token names, §3.1 aggregate, §6). The black/white poles now encode **side (YES/NO) only**; **Support/Counter is a separate, post-relative relation** (split bar + composer), never a colour or column. §2.1 tokens renamed `color.side.support→.yes`, `.counter→.no`. §6 columns restated as fixed YES/NO poles with replies routed by side; two-slot render restated per-column; split bar (§3.2) split into a side bar + a post-relative bar. **v1.0-lock reflection** — added the lock note (core surfaces + Bookmark locked at integration-shell v1.0; consolidated design PK canonical); retired task ref **DESIGN.8 → DESIGN.SPEC** throughout; §7 "five surfaces" → core (locked) + Wave-2. Source: v1.0 lock + `DESIGN-spec-changes-consolidated`, 2026-06-17.
> **[disk lineage] v0.3-draft (2026-06-24):** §2.1 token values landed — the neutral ramp and the two side poles gained minted OKLCH values, replacing the `*(blank — CD)*` placeholders, with a SHELL/UI.0 provenance note pointing at `src/app/globals.css`. The side rows were clarified to bind the **YES/NO side** (not the Support/Counter relation), matching the built code comments; accent remained deferred. No §1 constraint or §4 state-shape rule changed. *(Committed at PR #161; carried the pre-correction `color.side.support`/`.counter` token labels — superseded by the v0.5 merge.)* Source: SHELL/UI.0 token mint (the DESIGN.7 mint), 2026-06-24.
> **[PK lineage] v0.3-draft (2026-06-05):** §1.3 binding **CONFIRMED** by the operator (flagged-choice block resolved); §1.9 gains the Slot-1 rejected-direction record (newspaper/editorial styling — named negative for CD prompts); §3.1 top-level post slots amended (pseudonym/avatar header; argument = **title + body**, pending SCL-1); §3.2 gains four Slot-1 primitives (**split bar**, **two-line price graph**, **market image thumb**, **featured-market hero**) and the market card's **locked composition**; §5 map updated for Discovery (price chart ◐, side badge ◐, top-level post ◐, Support/Counter aggregate ◐; rail → hero). Source: Slot-1 lock (still v0.13) + operator decisions, 2026-06-05.
> **v0.2-draft (2026-06-04):** added §1.9 (Claude Design house style banned by name, each element paired with its neutral replacement) and §1.10 (exact values, never adjectives — vague-descriptor specs banned); added §4.9 (interactive states are part of the primitive) and §4.10 (loading/empty/error ship with the surface); propagated §1.9 cross-notes into §2.1 (true-neutral ramp), §2.2 (one neutral sans family this phase), §2.3 (radius small-or-zero; neutral shadows); clarified §1.3's rendering-decision anchor from "DESIGN.1" to "the look-anchor slot (Slot 1 / tracker DESIGN.3)"; grounding line now cites `Research_Report_v2.md`. Source: Claude Design high-fidelity research, 2026-06-04. *(Common ancestor of both lineages.)*
> **v0-draft:** initial authoring (visual-backbone thread).

*End design-language v0.7-draft. Remaining blank values designed in Claude Design; derived into `design.md` at DESIGN.SPEC. Living vocabulary — §3 grows additively; §1 and §4 change only by explicit decision.*
