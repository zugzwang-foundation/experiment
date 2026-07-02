# DESIGN.W2.3 — Universal Back navigation · CLOSE-OUT

**Locked:** 2026-06-18 · **Lane:** design-only (operator + web Claude; no Claude Code, no PR)
**Consumer:** the global **app-frame / UI-shell** build, via DESIGN.HANDOVER · **Dep:** DESIGN.7.5 integration shell v1.0 (done)
**Satisfies:** `DESIGN-phase-record.md` §10 carry-forward **#1** (universal back).

---

## What W2.3 produced

The **function + structure** of one universal back affordance, locked to the v1.0 chrome.
**No HTML still this cycle** — the operator deferred the visual ("design it later; for now lock
the function and the structure"). This close-out + the three consolidated-doc append-blocks are
the deliverable; the still is registered as a carried-forward visual task.

A **behaviour/chrome lock**, not a SPEC change: nothing here touches a thesis invariant, the bet
engine, the ledger, moderation, or auth. The obligation is a **shell/UI-frame build note**, routed
through the handoff and added to the phase-record forward contract — **no SPEC.1 amendment**.

### Deliverables

| File | What it is |
|---|---|
| `DESIGN_W2_3_universal-back_CLOSE-OUT.md` | This record — the lock spine, the 4 build spec-change notes, the 3 append-blocks, supersessions. |
| → `DESIGN-spec-changes-consolidated.md` | + Wave-2 § (append-block A below): history stack, global header + back handler, ESC routing, ×-on-pop-ups. |
| → `DESIGN-motion-consolidated.md` | + Wave-2 § (append-block B below): back reuses the surface-switch transition; ESC/× reuse the overlay-close; supersedes the "back = click-identity" note. |
| → `DESIGN-copy-register-consolidated.md` | + Wave-2 § (append-block C below): the `←` control + `×` close (strings/aria reserved; visual deferred). |
| **(deferred)** HTML still | The visual treatment of the global header + `←` + disabled-at-root + pop-up `×`. Carried forward — see below. |

---

## The model that locked

```
TWO CLASSES
  Pages  (carry the global header → carry the back control)
    Discovery · Market Detail · Reply · Profile · Bookmark
  Pop-ups (no global header → carry their own × close)
    + compose popover · bet composer (Buy/Sell) · slippage modal · auth modals

THE REVERSE  (one function, two triggers)
  back button (←, global header)  ─┐
                                   ├─►  "last screen"  (pop the page history)
  ESC (keyboard)                  ─┘

PRECEDENCE  (a pop-up is open)
  ESC / back  ─►  close the open pop-up FIRST   (× is the mouse equivalent)
  no pop-up open  ─►  back a page

ROOT
  Discovery (boot screen) ─►  back is DISABLED / dimmed (nothing behind it);
                              re-disables whenever history empties back to it.
```

Back restores the exact prior page **including which post** — the history holds `(page, post)`
tuples, so back from *Reply-for-post-A → Market → back* returns to **Reply-for-post-A**, not a
bare "reply".

---

## Locked decisions (spine)

- **One reverse, two triggers:** global-header **back button (`←`)** and **ESC** are the same
  function — "go to the last screen."
- **Pop-ups are a separate class:** not pages, no global header → each carries its own **`×`**.
  (This *adds* a `×` to the `+` popover and the bet composer, which today close on ESC / click-out
  only.)
- **Overlay precedence (operator ruling):** if a pop-up is open, ESC/back **closes the pop-up
  first**; back-a-page fires only when no pop-up is open.
- **History semantics — "last screen", with consecutive-duplicate suppression:** a forward page
  nav that targets the **same `(page, post)` already on top of the stack does not push a second
  copy** — back never lands you on a screen you're already on. **Two *different* markets are
  distinct entries** (back walks through them). *(Operator: "keep it simple to use." No
  move-to-front / visited-set reordering — that would make back less predictable.)*
- **No forward button** this phase (operator ruling).
- **Root is disabled:** back is dimmed/inert at Discovery; disabled is a required primitive state
  (design-language §4.9), depicted in the deferred still.
- **Click-identity reverts to plain meaning** — a *forward* nav to **Profile**. The Bookmark
  "back = click the nav identity" stopgap is **retired** (a real back exists now).
- **Control treatment:** a functional **`←`** at the **far left of the 60px nav**, on-language with
  the existing functional arrows (`‹ › ▲ ▼`) — not a decorative icon. Exact glyph / label-vs-icon /
  weight = the deferred visual task.

---

## Build spec-change notes (v1.0 is FROZEN — these are build obligations, not mockup edits)

Per `DESIGN-phase-record.md` §9, the v1.0 shell cannot be reproduced from the PK build env and is
hand-maintained; the shell router (§4) is a **flat surface-switch with no history**. The four items
below are obligations for the downstream **app-frame / UI-shell** build (via DESIGN.HANDOVER), and
are added to the phase-record **forward contract (§8)**:

1. **History stack (shell).** A stack of `(page, post)` tuples. **Only page navigations push**
   (pop-ups never push). **Consecutive-duplicate suppression:** don't push a tuple equal to the
   current top. Back **pops** and calls `go(target, post)`. Empties → root, back disabled.
2. **Global persistent header + back handler.** A header across every page (today each surface
   carries its own 60px bar). The back button posts `{type:'back'}`; the shell pops the stack and
   routes. *(Chrome change — the shell has no persistent header today.)*
3. **ESC / back routing generalised — overlay-first precedence.** On ESC/back the **focused
   surface is asked "is a pop-up open?"**; if **yes**, a close-overlay is dispatched to that surface
   (closing `body.ppop` / `slot.bet` / a modal); **only if no** does the shell pop the page history.
   *(Today ESC closes popovers locally inside d5; the generalisation is the shell↔surface
   precedence handshake.)*
4. **`×` close added to the `+` popover and the bet composer.** Today they close on ESC / click-out
   only. The `×` is the mouse equivalent of "close the pop-up first." (Slippage + auth modals are
   centred and already modal; the bet composer is **slot-based**, so `×` placement on the slot is a
   visual detail for the deferred still — but it is pop-up-class and gets one.)

**Spec home:** the UI-shell build (no SPEC.1 functional clause is touched — chrome behaviour, no
thesis invariant affected). Extends the cross-surface nav contract already in phase-record §8.

---

## Supersessions (existing PK notes this lock retires — update when splicing)

- `DESIGN-phase-record.md` **§10 carry-forward #1** → **DONE** (this task). Mark it closed.
- `DESIGN-phase-record.md` **§3 Bookmark** — "back = click the nav identity (universal back is a
  future task, §10)" → **superseded**: back is the global-header `←` / ESC; click-identity is now
  purely a forward nav to Profile.
- `DESIGN-motion-consolidated.md` (Profile/Bookmark section) — "Back is currently click-the-identity;
  a universal back affordance is a carried-forward task" → **superseded** (replaced in append-block B).
- The v0.35 **nav-identity → Profile** wiring is unchanged as a *forward* nav; it no longer doubles
  as Bookmark's back.

---

## Carried forward / downstream

- **Deferred visual still (placeholder).** The high-fidelity treatment of: the global header, the
  `←` control, its **disabled-at-root** state, and the pop-up `×`. Operator to schedule as a W2.3
  visual follow-on / fold into the branding pass *(no tracker edit made in this lane)*.
- **Copy/aria final set** — exact glyph, label-vs-icon, aria-labels for `←` and `×` — set at that
  visual task (reserved in append-block C).
- **UI-shell build (consumer)** — the 4 build notes above, via DESIGN.HANDOVER.
- **PK-lag flag:** the three consolidated docs in PK **do not yet carry W2.1's Wave-2 sections**
  (the W2.1 close-out landed today; splicing pending). Splice W2.1's blocks **and** W2.3's
  (below) when updating PK.

---

## States coverage

The control's own states are monochrome primitive states (design-language §4.9): **default ·
hover · focus · active · disabled (root)**. Rendered at the deferred visual still, not invented at
build. The pop-up `×` inherits the same primitive states. No surface loading/empty/error shapes are
introduced by this chrome behaviour.

---
---

# APPEND-BLOCKS — splice each into its consolidated doc (create the Wave-2 section if absent)

> Format-matched to each doc. Add **after** the W2.1 Wave-2 entries once those are spliced; if no
> Wave-2 section exists yet, create one.

---

## ▸ APPEND-BLOCK A → `DESIGN-spec-changes-consolidated.md`

```markdown
## Wave-2 — DESIGN.W2.3 · Universal back (chrome / UI-shell)

A behaviour/chrome lock — **no SPEC.1 clause touched** (no thesis invariant, engine, ledger,
moderation, or auth). The items below are **build obligations** for the global app-frame / UI-shell
(via DESIGN.HANDOVER) and extend the cross-surface nav contract (§6 above / phase-record §8). The
v1.0 shell is frozen (phase-record §9); these are not mockup edits.

- **Two classes.** *Pages* (carry the global header → the back control): Discovery · Market Detail ·
  Reply · Profile · Bookmark. *Pop-ups* (no global header → own `×` close): `+` popover (`body.ppop`)
  · bet composer (`slot.bet`) · slippage modal · auth modals.
- **One reverse, two triggers.** Global-header **back button (`←`)** and **ESC** are the same
  function — "last screen."
- **History stack (shell).** Stack of `(page, post)` tuples. **Only page navs push**; pop-ups never
  push. **Consecutive-duplicate suppression** — don't push a tuple equal to the current top (back
  never lands on the screen you're on; two *different* markets remain distinct). Back **pops** and
  calls `go(target, post)`. Empties → root, back disabled.
- **Global persistent header + back handler.** New chrome across every page (today each surface owns
  its own 60px bar). Back button posts `{type:'back'}`; shell pops + routes.
- **ESC / back routing generalised — overlay-first.** On ESC/back the **focused surface is asked
  "pop-up open?"**; if yes, close-overlay is dispatched to it; only if no does the shell pop the
  page history. *(Today ESC closes popovers locally in d5; this adds the shell↔surface precedence
  handshake.)*
- **`×` added** to the `+` popover and the bet composer (today: ESC / click-out only). The `×` is the
  mouse equivalent of "close the pop-up first."
- **Root disabled.** Back is dimmed/inert at Discovery; re-disables when history empties to root.
- **No forward button** this phase.
- **Click-identity** reverts to a plain forward nav → Profile; the Bookmark "back = click-identity"
  stopgap is retired.
- **Spec home:** UI-shell build. Forward-contract addition (phase-record §8). No SPEC.1 amendment.
```

---

## ▸ APPEND-BLOCK B → `DESIGN-motion-consolidated.md`

```markdown
## Wave-2 — DESIGN.W2.3 · Universal back (chrome)

- **Back transition reuses the surface-switch.** A back nav animates **identically to a forward
  `go()`** surface switch — no new motion token; back is just `go()` with a popped target.
- **Overlay close (× / ESC) reuses the existing overlay-close motion** — the `body.ppop` /
  `slot.bet` close already defined per surface; the `×` and ESC trigger the same close, with the
  overlay-first precedence (close the pop-up, then a *second* back navigates the page).
- **Back control — disabled state at root.** Dimmed/inert at Discovery; no transition while
  disabled. (Hover/focus/active treatments → the deferred visual still.)
- **Motion VALUES deferred** with the visual still (the function + structure are locked; timings
  ride the existing surface-switch / overlay-close values).

> **Supersedes** the earlier note in the Profile/Bookmark section — *"Back is currently
> click-the-identity; a universal back affordance is a carried-forward task."* Back is now the
> global-header `←` / ESC (W2.3); click-identity is a forward nav → Profile only.
```

---

## ▸ APPEND-BLOCK C → `DESIGN-copy-register-consolidated.md`

```markdown
## Global header (Wave-2 — DESIGN.W2.3 · Universal back)

Visual + final strings are **deferred** to the W2.3 visual still; these are **reserved**.

| Element | String / treatment |
|---|---|
| Back control | `←` (functional glyph, far-left of the 60px nav; icon-only assumed — label-vs-icon TBD at the visual still). aria-label: `Back` *(reserved)*. |
| Back — disabled (root) | dimmed/inert at Discovery; aria-disabled. |
| Pop-up close | `×` on every pop-up (`+` popover, bet composer, slippage modal, auth modals). aria-label: `Close` *(reserved)*. |

> Final glyph, label-vs-icon decision, and the exact aria set are fixed at the W2.3 visual task.
> All vocabulary stays identical to the v1.0 register; no new participant-facing copy is introduced
> by this chrome behaviour.
```
