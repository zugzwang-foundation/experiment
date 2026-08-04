# DESIGN.W2.2 — First-login onboarding deck · CLOSE-OUT

**Locked:** 2026-06-29 · **Lane:** design-only (operator + web Claude; no Claude Code, no PR)
**Consumer:** UI.2 (build) · **Dep:** DESIGN.W2.1 (done)
**Depth:** Depth-1 — structure + provisional copy locked; final persuasive wording + real artwork deferred to the branding wave.

---

## What W2.2 produced

A single mockup still — `DESIGN_W2_2_onboarding-deck_mockup-v0_1.html` — finalizing the **six card bodies inside the locked W2.1 deck shell**. Interactive stepper (1→6, "Enter Zugzwang" on the last) plus an all-six overview grid for review/screenshot. Monochrome; brand deferred.

| File | What it is |
|---|---|
| `DESIGN_W2_2_onboarding-deck_mockup-v0_1.html` | The six onboarding cards in the locked modal shell: card anatomy (image slot + eyebrow + title + subtext), founder sequence, provisional copy, dummy infographics. |

---

## Locked decisions (spine)

- **Sequence (founder-defined):** 1 Welcome + Identity reveal · 2 The Goal · 3 No stake, no voice · 4 Soulbound reputation · 5 Single-side binding · 6 Support / Counter.
- **Card mapping = the faithful "how-to-play subset," NOT the tracker's five-point list.** The deck surfaces **INV-1** (no-stake-no-voice + reply-as-bet, taught across cards 3 & 6), **INV-2** (soulbound, card 4), **INV-3** (single-side, card 5), and **the Goal** (card 2). **INV-4 (append-only) and admin-not-a-participant stay OUT of the deck** → they live in the About tab (full set). Content sourced from **SPEC.1 §5 / CLAUDE.md §2.1–2.4**, per the W2.2 flag-1 correction.
- **Anatomy:** centered, Polymarket-style — image band on top → eyebrow → bold title → subtext. Inherits the locked `.card` (218px min-height floor).
- **Image slot (`.cfig`):** full-width band, 140px tall, `--imgr` (6px) radius, `--n1` fill, hairline border, centered illustration. This is the W2.2 Q4 (card-anatomy) answer.
- **Card 1 image = the live PFP avatar** (rounded-square at `--imgr`, matching `.navav`/`.idav`), shown large as a centered hero — no second decorative illustration. Cards 2–6 image = a bundled static illustration.
- **Asset storage = BUNDLED with the app, NOT a new R2 bucket** (decided this chat). First-party UI art ships in the repo / `public`, atomic with the code that references it; R2 stays for user-uploaded + identity (PFP) content. No third bucket; no infra scaffolding.
- **Eyebrow scheme:** `WELCOME` / `THE GOAL` / `THE RULES` (×4 on the rule cards).
- **Side binding (invariant) reflected in the art:** Support/YES = black, Counter/NO = white (cards 5 & 6).
- **Provisional Goal sentence (card 2):** "Knowledge, at scale, beats capital." + "Know more (K), bring informed people together (n)… outweigh the money (C)… K · n > C." Editable in branding.
- **Nav:** locked W1 shell — Back (disabled on card 1) + Next; not skippable on first login (no close). Back-keep-vs-forward-only stays the W1 open visual (branding).

---

## Consolidated-doc updates (apply the blocks below)

### → DESIGN-spec-changes-consolidated.md  · **APPLY**
- **W2.2 card mapping:** deck = INV-1 (cards 3 & 6) + INV-2 (4) + INV-3 (5) + Goal (2); identity (1). INV-4 + admin-not-a-participant excluded from the deck → About tab. Sourced from SPEC.1 §5, **not** the tracker W2.2 row (which splits INV-1, omits INV-3, and folds in INV-4 + admin — flagged stale below).
- **Card anatomy:** centered image-slot layout. `.cfig` 140px band at `--imgr`. Card 1 = PFP avatar hero; cards 2–6 = bundled static illustration.
- **Asset-storage decision:** first-party onboarding/UI illustrations are **bundled with the app, not stored in R2.** R2 remains user-uploaded + identity (PFP) only. (Carry: a one-line AGENTS note or a short asset-storage ADR at UI-build time — see carry-forwards.)
- **Deck-vs-About split reaffirmed:** deck = how-to-play subset; About = full set (4 invariants + append-only + admin-not-participant + Goal). About content **scope (Q3) UNRULED** — overlaps W2.12 feature-guide.

### → DESIGN-copy-register-consolidated.md  · **PROVISIONAL — finalize post-branding**
- Onboarding deck strings (provisional, Depth-1): card titles + subtexts per mockup v0.1. **Do not lock the register entry until the branding wording pass.**

### → DESIGN-motion-consolidated.md  · **NO NEW MOTION**
- W2.2 introduces no new motion. Card swaps inherit the locked W2.1 deck timings (overlay / modal / stepper). Nothing to add.

---

## PK update table

| File | State | Action | Reason |
|---|---|---|---|
| `DESIGN_W2_2_onboarding-deck_mockup-v0_1.html` | new | **Add** | The W2.2 deliverable still. |
| `DESIGN_W2_2_CLOSE-OUT.md` (this file) | new | **Add** | Close-out of record. |
| `DESIGN-spec-changes-consolidated.md` | edit | **Apply** spec block above | Mapping + anatomy + asset-storage decision. |
| `DESIGN-copy-register-consolidated.md` | edit | **Add provisional** entry | Provisional deck strings; finalize post-branding. |
| `DESIGN-motion-consolidated.md` | unchanged | **Keep** | No new motion. |
| `tracker_v14.html` — W2.2 row | stale | **Mark done + flag** | Desc lists 5 points incl. INV-4 + admin; built deck uses the faithful SPEC.1 §5 subset. |
| `tracker_v14.html` — W2.10 row | stale | **Verify** | Marked "RULING PENDING" but slippage spec package + mockup + bet-cap note are in PK — likely resolved. |
| `tracker_v14.html` — W2.7 row | open | **Verify** | "RULING PENDING" (bookmark Staked/Current); confirm done-state on the dashboard. |

---

## Carry-forwards / open

- **Q3 — About-tab content scope:** UNRULED. The full invariant set + Goal live in About; whether W2.2 or **W2.12** (feature-guide, SPEC.1 §21.6) owns that content is your call. **Recommend folding About content into W2.12.**
- **Error-state image slot:** a **W2.11 delta** — add the same `.cfig` slot to the empty/loading/error primitives. Not done; track on W2.11.
- **Asset-storage → ADR/AGENTS:** the bundle-not-R2 call should land as a one-line AGENTS note (or a short asset-storage ADR) at UI-build time, in the deploy/infra lane — not design. Verify `ls docs/adr/` before minting (ceiling is 0024).
- **Final wording + real artwork:** branding wave (Claude Design). The mockup's copy + infographics are provisional placeholders.
- **Back-keep-vs-forward-only:** the W1 open visual; revisit in branding.

---

## Next design tasks (verified against tracker_v14.html + PK close-outs, 2026-06-29)

**Done (close-out present):** W2.1, W2.2, W2.3, W2.4, W2.5, W2.6, W2.8, W2.11.

**Open & unblocked** (recommend order):
1. **W2.12** — Feature-guide page + 'i' deep-links (SPEC.1 §21.6). *Resolves the About-tab content (Q3) while it's fresh; same Depth-1 "mechanism now, words last" build.*
2. **W2.9** — Market media tab (formalize the MARKET MEDIA placeholder). *Self-contained, lightest.*
3. **W2.13** — Download features (profile-card / post-card JPEG / debate .md).

**Blocked on your ruling:**
- **W2.7** — Dharma tab. Needs the **bookmark Staked/Current** ruling. *(Dashboard may already log this done — confirm.)*

**Confirm done-state (PK lags; dashboard is authoritative):**
- **W2.10** — Slippage: spec package + mockup present → looks resolved despite the "RULING PENDING" marker.
- **W2.14** — Radio: decision log present, but the hosting model (YouTube embed vs R2 self-host) may be reopened per the original-music decision.

**After Wave-2:** branding wave → final design-spec lock → Claude Design handover → UI sub-lane builds.
