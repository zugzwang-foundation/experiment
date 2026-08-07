# DESIGN.W2.8 — Fresh-post compose entry · CLOSE-OUT

**Locked:** 2026-06-26 · **Lane:** design-only (operator + web Claude; no Claude Code, no Claude Design, no PR)
**Consumer:** UI.4 (build) via the locked still + this record · **Dep:** DESIGN.4 (composer, done)

---

## What W2.8 turned out to be

A scope that collapsed under verification. The fresh-post *composer* was already locked
(DESIGN.5 / surface_d5), the *populated-market entry* already existed (the per-side colhead
"Buy" → composer), the *signed-out* path was already settled by W2.1, and the *empty* states
are resolved product-wide by the curation slate. What remained was a single label.

**The whole of W2.8: relabel the Market-Detail per-side colhead bet-entry button `Buy` → `Đ BET`.**
This brings the entry into the composer wordmark — entry `Đ BET` → header `Place your Đ BET` →
submit `PLACE Đ BET`, one wordmark end-to-end ("Đ BET" reads as DEBATE).

### Deliverable (shape 2 — operator-chosen)
- `DESIGN.W2.8_entry_mockup-v0.1.html` — the two column headers reproduced verbatim from
  surface_d5 with the single relabel, plus the entry button's states (default / hover / focus /
  disabled / live). Not a new surface; a focused reference for the build.
- The consolidated-doc deltas below (copy register + spec-changes). **No motion delta** — the
  relabel inherits the existing colhead-button hover (border→ink); the slot-slide on open is
  unchanged. `DESIGN-motion-consolidated.md` is untouched.

---

## Locked layout (signed off)

- **Market Detail = the locked v1.0 surface, unchanged except** the per-side colhead bet-entry
  button **`Buy` → `Đ BET`** (YES column *and* NO column). The button is **neutral and identical
  in both columns**; the **side comes from the column** (frame + price), not the button. It opens
  the locked composer in that side's slot (side→slot rule, unchanged).
- **`Sell` is unchanged** — the only comment-free action; not a bet, not relabelled.
- **Signed-out:** clicking `Đ BET` routes to the **W2.1 picker** (act-gate). The composer's
  in-module sign-in gate is now **dead UI** → a drop-it note for the UI.4 build, not a surface.
- **Entry states (new, per design-language §4.9):** hover (border→ink), visible focus ring
  (2px ink), **disabled = INV-4** (no bet affordance on closed / resolved / frozen) — all monochrome.
- **Empty-market / empty-side:** not designed — resolved product-wide by the **cpmm.md §7.2
  pre-launch curation slate** (both columns seeded; posts append-only, so no public market ever
  shows an empty column). The empty-side CTA (`Be the first to argue [YES/NO]`) stays a **dormant
  build-time safety primitive**, not a W2.8 surface.
- **No Discovery compose entry.**

---

## Consolidated-doc deltas (fold into PK)

### 1 · `DESIGN-copy-register-consolidated.md` — section "Market Detail (d5 'market' view)"

Replace the `Trade buttons` row:

| Element | String |
|---|---|
| ~~Trade buttons~~ | ~~`Buy` · `Sell`~~ |

with:

| Element | String |
|---|---|
| Trade buttons | `Đ BET` (bet entry — opens the composer; the wordmark, "Đ BET" = DEBATE) · `Sell` (comment-free) |

*(The "Composer" section's `Place your Đ BET` / `PLACE Đ BET` rows already exist and are unchanged;
this brings the entry into the same wordmark.)*

### 2 · `DESIGN-spec-changes-consolidated.md` — append a new section

```
## N. DESIGN.W2.8 — Fresh-post entry (operator, 2026-06-26)

- The Market-Detail per-side colhead bet-entry button "Buy" is relabelled "Đ BET" — folding
  the entry into the §3 "Đ BET" wordmark. Entry "Đ BET" → composer header "Place your Đ BET"
  → submit "PLACE Đ BET" is now one continuous wordmark. The button is neutral and identical
  in both columns; SIDE is carried by the column (frame + price), not the button.
- "Sell" is unchanged — the only comment-free action; not a bet, not relabelled.
- A fresh top-level post IS this entry (every commented market-bet = a post; no separate
  "new post" affordance). Confirmed: pick(side) → composer with the fresh-post flow.
- Signed-out: the entry act-gates to the W2.1 picker. The composer's in-module sign-in gate
  is superseded by W2.1 (dead UI) → drop at the UI.4 build.
- Entry interactive states completed (design-language §4.9): hover (border→ink), visible
  focus ring (2px ink), disabled = INV-4 (closed / resolved / frozen — no bet affordance).
- Empty-market and empty-side are NOT a W2.8 surface — the launch-empty state is resolved
  product-wide by the cpmm.md §7.2 pre-launch curation slate (both columns seeded via
  operator-controlled PARTICIPANT accounts — admin holds no positions, SPEC.1 §10.1;
  posts append-only). The empty-side CTA stays a dormant build-time safety primitive.
- No Discovery compose entry.
```

*(Renumber `N` to the next free section number when folding in.)*

---

## Verified findings carried out of this chat

- **Cold-start is documented and invariant-safe.** cpmm.md §7.2: a pre-launch curation slate of
  ordinary commented bets moves the opening price off 0.5 to a per-market level, under operator
  control, before public availability. Placed via **participant accounts the operator controls,
  NOT the admin account** (admin holds no positions — cpmm.md §3.2 / SPEC.1 §10.1). This moots
  the empty-market screen (corrected an earlier web-Claude argument that "every market is empty
  at launch").
- **Glyph:** `Đ BET` (the Đ glyph, matching the locked composer). Bare "D BET" not adopted;
  changing to a bare D would also touch the composer wordmark and would be its own copy change.
- **Process:** pre-branding surfaces do not go to Claude Design. Deliverable = locked still +
  spec; CC builds from the still directly (DEBATE.4 pattern). Claude Design is branding-only.

---

## Downstream

- **UI.4 build** consumes this: relabel the colhead entry to `Đ BET`; wire it to the act-gate →
  W2.1 picker when signed-out; render the disabled state on INV-4 markets; **drop the composer's
  in-module sign-in gate.**
- **`design-language.md` §6 empty-side CTA** stays as the dormant safety primitive (no change).
