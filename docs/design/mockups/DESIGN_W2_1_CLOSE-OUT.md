# DESIGN.W2.1 — Sign-in / Auth · CLOSE-OUT

**Locked:** 2026-06-18 · **Lane:** design-only (operator + web Claude; no Claude Code, no PR)
**Consumer:** UI.2 (build) via DESIGN.HANDOVER · **Dep:** DESIGN.7.5 integration shell (done)

---

## What W2.1 produced

The complete **participant auth surface**, mapped end-to-end and operable, as two locked stills
+ entries in the three consolidated docs. Look = canonical v1.0 verbatim (tokens / nav / chips);
monochrome; desktop. These are **structural mockups** — flow/states/affordances are locked,
**visual design + branding are deferred** (the stills ship plain by design).

### Deliverables

| File | What it is |
|---|---|
| `DESIGN.W2.1_auth-modal_mockup-v0.3.html` | The complete auth modal: picker → Turnstile → 6-box OTP → signed-in. One picker behind every trigger. Pane-jumper exposes every state. |
| `DESIGN.W2.1_first-login-journey_mockup-v0.1.html` | Post-signup journey: auth → 6-card **not-skippable** onboarding deck → app, with the nav flip + the persistent **About** tab. Cards = placeholders. |
| `DESIGN-motion-consolidated.md` | + Wave-2 §: modal/pane/Turnstile/OTP/deck timings (intent values). |
| `DESIGN-spec-changes-consolidated.md` | + Wave-2 §: the **F-AUTH-4 override**, act-gate supersession, one-account-per-email, About tab, Discovery widget fold-in, W2.11 deferrals. |
| `DESIGN-copy-register-consolidated.md` | + Wave-2 §: all new auth strings. |

---

## The flow that locked

```
N0 signed-out browse (Audience reads whole app)
   │  any of: Sign in · Sign up · Buy · Sell · Support · Counter   (signed-out only)
   ▼
N1 PICKER (one modal, neutral header, over dimmed app)
   ├─ Continue with Google → native Google redirect → return
   └─ Email + Continue → Turnstile (silent default | visible fallback | error)
                        → 6-box OTP (invalid | expired | locked | resend)
   ▼
   auth success  (server decides new vs returning — silent)
   ├─ returning + existing account → straight into app (existing identity)
   └─ NEW → first-login DECK (6 cards, NEXT-only, no dismiss)
            1 identity reveal · 2 No stake no voice · 3 Soulbound ·
            4 Single-side binding · 5 Support/Counter · 6 The Goal (K·n>C)
            → Enter → app
   ▼
N5 signed-in — nav flips to balchip Đ + navid umber-falcon-31 ; About tab persists
```

ToS is **implicit** (footer links; signup = acceptance). Identity **appears** in the nav (R1);
card 1 is the reveal, not a separate confirmation.

---

## Locked decisions (spine)

- **One picker** behind all six triggers; new-vs-returning is server-side, silent. **Modal** over
  dimmed app (Polymarket-style), not full-page. Acceptance screen **in-modal** moot — deleted.
- **F-AUTH-4 OVERRIDE:** ToS gate removed → implicit footer acceptance. **Logged for the SYNC
  phase** to amend SPEC.1 §13.
- **R1:** silent identity (appears in nav); reveal = deck card 1; no confirmation step.
- **Turnstile:** managed/silent default + visible-checkbox fallback + error state (slot only).
- **OTP:** ours — 6-box, resend cooldown, invalid/expired/locked, "Secured by Cloudflare Turnstile".
- **Deck:** 6 cards, **not skippable** on first login; cards are **how-to-play rules**, not the
  full invariant set. **About** tab holds the full set (incl. append-only + admin-not-participant)
  + Goal, persistent both states, **name + position TBD**.
- **Discovery nav widget fold-in:** balance chip + identity (E1, matching d5).

## Carried forward / downstream

- **⚠ SYNC:** SPEC.1 §13 F-AUTH-3/4 → implicit-acceptance; resolve acceptance-evidence question.
- **UI.2 build:** one-account-per-email + returning-user-no-new-identity; act-gate→modal;
  Discovery widget fold-in.
- **W2.2:** real invariant card content (deck design).
- **W2.11:** pool-exhausted 503 + generic network/offline/session/500 modal states.
- **About tab:** final name + header position + content surface.
- **Open visual:** first-login deck **Back** kept (re-read allowed; not a skip) — revisit in branding if forward-only wanted.

---

## States coverage (sweep result)

Every auth screen ships its interactive + error states (picker disabled/enabled/loading; Turnstile
auto/challenge/error; OTP invalid/expired/locked/resend; Google redirecting; deck not-skippable).
Four rare/cross-surface states (pool-exhausted 503, network, session-expired, 500) referenced to
**W2.11** — flagged, not dropped.
