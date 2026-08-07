# DESIGN.W2.4 / .5 / .14 — Global Header / Nav Frame — CLOSE-OUT

**Status:** 🔒 LOCKED
**Lane:** design-only (operator + web Claude; no Claude Code, no plan-then-execute, no PR)
**Locked still:** `DESIGN_W2_4-5-14_global-header_mockup-v0.2.html`
**Covers tracker rows:** DESIGN.W2.4 (Zugzwang timer — header) · DESIGN.W2.5 (visitor counter — header) · the deferred **W2.3 back-control visual** · **W2.14 radio — placeholder slot only**
**Plugs into:** the frozen v1.0 integration shell (`DESIGN_integration-shell_v1.0.html`); replaces the per-surface 60px bars.

---

## 1. What this chat delivered

One coherent monochrome **global header** — the single persistent nav frame that replaces the per-surface 60px bars across every surface — locked state-by-state (signed-out + signed-in), as a high-fidelity HTML still consistent with v1.0.

**In scope (brief):** the header frame + element inventory + both states + the now-resolved back-visual + the W2.4 timer + the W2.5 visitor counter + §21.1 anti-conflation placement.

**Added by operator mid-task (scope expansion — see §7):**
- **Home** control (alongside back).
- **Radio** rendered as an animated synth-wave depiction (still a placeholder skin for W2.14).
- **Social** menu — a share button opening a drop-down of channels.
- **Research** — an external-link placeholder to a sub-domain (TBD).

---

## 2. Locked decisions

**Frame.** Single 60px header, 3-zone grid (`1fr · auto · 1fr`), monochrome, desktop-only, hairline top/bottom borders. Chrome lives on the grey ramp; black/white stay reserved for YES/NO side encoding only.

**Zone layout (L → R):**
- **Left:** `Back · Home · Radio · Social · Research` — (back/home order **swapped** from the first cut; Back is leftmost, consistent with W2.3 "far-left").
- **Center:** `[animated mark] ZUGZWANG` with the countdown **timer stacked beneath the wordmark**, then the `RULES` tab.
- **Right (state-flipping):**
  - *Signed-out:* `Đ (i)` info-doorway · `JOIN` · ‖ divider ‖ · visitor count.
  - *Signed-in:* `Đ + Portfolio + Balance` cluster · identity (avatar + pseudonym → Profile) · ‖ divider ‖ · visitor count.

**Back-visual (W2.3 deferred visual — now RESOLVED).** Functional `←` arrow, on-language with `‹ › ▲ ▼`; icon-only 38px button. States locked: default / hover (faint fill) / focus (2px ink outline, offset) / active (pressed fill) / **disabled at root** (dimmed ink, retains its slot — no layout shift on Discovery). Wordmark-as-back stays retired (W2.3). Back is leftmost; Home immediately right of it.

**Wordmark click target.** `ZUGZWANG` → forward nav to home/Discovery (wordmark-as-back retired).

**Đ — signed-out = info doorway.** No balance for the audience; the chip carries an `(i)` and opens the Dharma explainer. `JOIN` remains the auth trigger.

**Đ — signed-in = balance cluster.** Glyph + **two stats: Portfolio** (open-position value) + **Balance** (spendable), both in Đ, tabular figures. (Reference screenshot was for the two-stat *layout* only — rendered monochrome, no colour.)

**Timer (W2.4).** Bare `Dd : Hh : Mm` beneath the wordmark, no seconds, tabular figures, polled. Counts down to the Nov 5 23:59 UTC freeze. *Open micro-decision:* a quiet "to freeze" label may be added — default is bare.

**Visitor counter (W2.5).** Metric = **total page visits** (repeat visits by the same person counted — the fastest-growing number, deliberately). Rendered at the far-right edge, **outside a hairline divider, in the muted register, with the eye glyph + the word "visitors"**, so it can never read as a Dharma/stake/participant figure. **Honors SPEC.1 §21.1 (hard anti-conflation).**

**RULES = the single how-it-works surface.** Confirmed one surface (not two): the W2.1 "About" content **is** the §21.6 feature-guide (tracker row **W2.12**). Content = **5 frames — 4 rules + 1 goal**. The `(i)` doorways (the Đ explainer, the visitor-count explainer, per-feature "i"s) all deep-link into it.

**Radio (W2.14 — placeholder).** On-screen as an animated equalizer (synth-wave) that depicts live music when **On Air**, with a pulsing dot; flat when off. This is a **placeholder skin only** — the final look, the hidden YouTube IFrame player (≥200×200, attribution visible), and play-on-gesture behaviour are owned by **DESIGN.W2.14**.

---

## 3. APPEND → `DESIGN-motion-consolidated.md`

```
## Global header (DESIGN.W2.4/.5/.14)

- Animated mark (hourglass wordmark glyph): ambient loop. Rendered STATIC in the
  still; motion is an intent for Claude Code to build, never baked into the mockup.
  Intent: slow, quiet, non-distracting (chess "zugzwang"/time motif). Timing TBD.
- Radio synth-wave: 5-bar equalizer, staggered oscillation (durations ~0.8–1.15s,
  offset delays), depicting "live music" while On Air. "On Air" dot pulses
  (~1.4s opacity 1→0.2). Flat bars when off. NOTE: demoed in-still because its FEEL
  is a design question; the production build is W2.14 (YouTube-backed).
- Reduced motion: synth-wave + pulse freeze to a static stepped bar pattern
  (prefers-reduced-motion honored).
- Control transitions: icon buttons / tabs / chips — 120ms background+border ease
  on hover; focus = instant 2px ink outline.
- Social menu: drop-down open/close under the share button (click-toggle;
  click-outside closes). Transition intent: quick fade/scale-in (≤120ms).
```

## 4. APPEND → `DESIGN-spec-changes-consolidated.md`

```
## Global header (DESIGN.W2.4/.5/.14)

[BUILD] Per-surface 60px bars → ONE global persistent header.
  The frozen v1.0 shell has no global header; each surface owns its 60px bar
  (phase-record §9). This is a BUILD spec-change (extends the W2.3 forward
  contract: history stack + global header + back handler), NOT a v1.0 mockup edit.
  The header plugs into the existing surfaces; the shell router + per-surface
  content stay frozen.

[RESOLVED] W2.3 back-visual: functional ← (on-language with ‹ › ▲ ▼), 38px
  icon-only, far-left; states default/hover/focus/active/disabled-at-root;
  disabled retains slot (no layout shift). Wordmark-as-back stays retired.

[DECISION] Wordmark → forward nav (home/Discovery).

[DECISION] Đ signed-out = info doorway (opens Dharma explainer; no balance).
[DECISION] Đ signed-in = glyph + Portfolio + Balance (two Đ stats).

[DECISION] Visitor counter metric = total page visits (repeats counted).
  Labelled "visitors", separated from Đ by a divider + muted register.
  Satisfies §21.1 anti-conflation (HARD).

[DECISION] Timer = bare Dd : Hh : Mm under the wordmark, no seconds, polled.
  (Optional "to freeze" label deferred; default bare.)

[CONFIRMED] RULES = the single how-it-works surface = the W1 "About" content
  = the §21.6 feature-guide (tracker W2.12). Content: 5 frames (4 rules + 1 goal).
  All "i" doorways deep-link into it.

[NEW — needs a spec home] Social menu (share button → drop-down of external
  channels: X / Instagram / YouTube / Telegram, set TBD) and Research (external
  link to a sub-domain, TBD). Added mid-task; not in SPEC.1 §21 or the tracker.
  Require: tracker rows + a spec note; Research requires its sub-domain defined.
```

## 5. APPEND → `DESIGN-copy-register-consolidated.md`

```
## Global header (DESIGN.W2.4/.5/.14)

| Element | String |
|---|---|
| Rules / About tab | `RULES` |
| Auth trigger (signed-out) | `JOIN` |
| Dharma info doorway (signed-out) | `Đ` + `i` badge → "What is Dharma?" |
| Balance cluster labels (signed-in) | `Portfolio` · `Balance` (values `Đ N`) |
| Timer (W2.4) | `45d : 06h : 15m` (Dd : Hh : Mm) |
| Visitor counter (W2.5) | `<n>` + `visitors` |
| Radio (placeholder) | `On Air` (playing) / `Radio` (off) |
| Social channels (placeholder set) | `X` · `Instagram` · `YouTube` · `Telegram` |
| Research (placeholder) | `Research` ↗ |
```

## 6. Placeholders & deferrals registered

- **Radio skin + behaviour → DESIGN.W2.14** (this header reserves the slot + a synth-wave depiction only).
- **Research sub-domain → TBD by operator** (external link target undefined).
- **Social account set → TBD** (X / Instagram / YouTube / Telegram are placeholders).
- **Timer "to freeze" label → optional, deferred** (default bare).
- **RULES content (5 frames) → DESIGN.W2.12** (feature-guide page; this header only places the tab/entry).

---

## 7. Carry-forwards / open items

1. **NEW header elements need a home — operator decision owed.** **Social** and **Research** were added mid-task and now live in a locked header but have **no SPEC.1 entry and no tracker row**. Before their build they need: (a) a tracker row each, (b) a one-line spec note, (c) for Research, the **sub-domain defined**. *This is the main loose end leaving this chat.*
2. **Global-header build obligation.** Replacing the per-surface bars with one header is a build task routed via **DESIGN.HANDOVER** (with W2.3's history-stack + back-handler). Carry into the handoff.
3. **User-search — deferred, never specced.** The user-search box in the operator's first sketch (find/visit a participant by pseudonym) was **kept out** of this header. It is its own task and touches the pseudonym-pool privacy model — needs its own chat + spec if pursued.
4. **§21.1 placement is load-bearing — the build must preserve it.** The visitor count must stay structurally separated from the Đ figures (divider + muted register). Do not let a later layout pass collapse them adjacent.
5. **§21.5 radio constraints for W2.14.** The real radio default is OFF (play-on-gesture); the hidden player must be ≥200×200 with YouTube attribution visible. The in-still synth-wave is a depiction, not the player.
6. **Left-zone density.** Five controls now sit left of the brand. Fits at 1440; revisit grouping if a later surface or copy change crowds it.

---

## 8. Build notes (for DESIGN.HANDOVER → Claude Code)

- Header is **global + persistent**; the shell router (phase-record §4) and per-surface content stay **frozen**. The header replaces the 60px bars only.
- Back control reuses the **W2.3 history stack + global back handler** (overlay-first precedence; disabled at root).
- Timer **polled** (no websockets default); counts to Nov 5 23:59 UTC.
- Visitor counter increments per page visit (repeats counted); label fixed to "visitors" per §21.1.
- Radio slot is the **trigger only**; the ≥200×200 YouTube player + attribution live off the 60px strip (W2.14).
- All controls ship interactive states (hover/focus/active/disabled) + the surface ships loading/empty/error shapes (design-language §4.10): balchip-loading, identity-loading, timer-before-resolve, visitor-before-load.

---

## Deliverable manifest

| File | What |
|---|---|
| `DESIGN_W2_4-5-14_global-header_mockup-v0.2.html` | 🔒 the locked still (both states + exhibits) |
| `DESIGN_W2_4-5-14_global-header_CLOSE-OUT.md` | this close-out (carries the 3 append-blocks) |

**PK drop:** add both to project knowledge. Fold §3/§4/§5 append-blocks into the three consolidated docs (note: the consolidated docs still lag prior Wave-2 sections — same PK-lag flag as W2.1/W2.3; a consolidation sweep is overdue).
