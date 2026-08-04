# DESIGN.W2.11 — Empty / loading / error states · CLOSE-OUT

**Locked:** 2026-06-27 · **Lane:** design-only (operator + web Claude; no Claude Code, no Claude Design, no PR)
**Consumer:** the UI.* build (per the locked still + this record) · **Dep:** DESIGN.7.5 (done) + the locked + Wave-2 surfaces W2.11 adds states to

---

## What W2.11 produced

A cross-surface **state-primitive kit (P1–P6)** + the `state → primitive → host → §15-code` placement
table, as **one combined still** + consolidated-doc deltas. Deliverable shape **D** (operator-chosen):
one kit still + the table folded into spec-changes. Monochrome · desktop · v1.0 tokens. Copy is
**illustrative** (intent + safety locked, not final wording — final copy is build-time per the register).

Like W2.8, the scope collapsed under verification: the locked v1.0 surfaces shipped **happy-path only**,
so the state layer was net-new — but the curation slate + the input clamp + server-side rendering +
ADR-0021 killed most of the candidate states. **45 candidate states → 14 build items.**

### Deliverables
- `DESIGN.W2.11_state-kit_mockup-v0.1.html` — the combined kit still (P1–P6 + placement table). Not a new
  surface; the cross-surface reference CC builds from at UI.*.
- `W2.11_state-ledger_reconciled.csv` — the full 45-state disposition ledger (audit trail).
- The consolidated-doc deltas below (copy register + spec-changes; motion small).

---

## The kit that locked (P1–P6)

- **P1 · Empty / no-results block** — one shape; the three shipped Profile empties reconcile into it.
  Instances: no-results filter, empty Bookmarks.
- **P2 · Blocking modal** — hard stops, dimmed-app dialog (the W2.1 picker shell), **one shell / five
  contents**: pool-exhausted 503, session-expired, generic 500, Track-A-suspended, banned-once.
- **P3 · Composer-inline** — in the **verbatim** locked composer; inline strip / disabled submit, never a
  popup; the typed argument is **preserved** on every revise/retry. Instances: Track B block-and-revise,
  `moderation_unavailable` 503, `moderation_in_flight` 409, `market_resolving`, floor-above-balance
  (disabled composer), one generic server-reject line; + banned-at-the-act-gate.
- **P4 · Global banner** — persistent, non-blocking: Nov-5 freeze read-only (the one loud participant
  read-only event); offline (auto-clears).
- **P5 · Silent fallback** — visitor-counter dash/hide.
- **P6 · Dormant shell** — empty-side / empty-market; build-time only, never publicly reached.

---

## Locked decisions (spine)

- **Presentation split is settled by primitive, not per-state:** hard stops → modal (P2); composer
  rejections → inline (P3); ambient/persistent → banner (P4). **No toasts** (not introduced).
- **T1** — no first-load skeletons. Pages are server-rendered (populated HTML); polls swap **silently**.
  The only real loading is auth-waits-on-vendor (already shipped at W2.1).
- **T2** — no per-surface error panels; a rare fetch failure surfaces the generic 500 modal / offline banner.
- **T3** — the input clamp prevents below-floor + insufficient-balance (no error UI). Surviving validation:
  `market_resolving`, floor-above-balance (disabled composer), one generic server-reject line.
- **INV-4 rider** — a non-Open market disables **Sell + reply triggers**, not only the entry button. No
  participant-facing resolved/resolving banner; the loud read-only event is the **Nov-5 freeze**.
- **Banned removes voice AND Sell** — positions ride to resolution; no exit. Terminal, no appeal (E2).
- **Moderation = ADR-0021** (no held queue): Track B = synchronous **block-and-revise** at submit; **no
  "under review on profile" state**. Track A = modal (terminal). `moderation_unavailable` = inline. The
  public removed-by-moderator mask is **DEBATE.7's**.
- **Safety invariants on every moderation state:** no content echo/quote/describe; no category named (no
  CSAM confirm/deny); no evasion guidance; preserve the typed argument on revise/retry; Track A / banned
  read **final**.

---

## Consolidated-doc deltas (fold into PK)

### 1 · `DESIGN-copy-register-consolidated.md` — append a new section "States (W2.11)"

| Element | String (illustrative) |
|---|---|
| Empty · no-results filter | `No markets match this filter.` + CTA `Clear filter` |
| Empty · Bookmarks | `No bookmarks yet.` · sub `Saved arguments will appear here.` |
| Empty · positions (shipped) | `No positions to show.` · sub `Adjust the market or status filter.` |
| Modal · session-expired | `Session expired` / `You've been signed out. Sign in again to keep going — anything you were viewing is still here.` / `Sign in` |
| Modal · pool-exhausted | `No identities available` / `We've run out of identities to assign right now. Please try again later.` / `Close` |
| Modal · generic 500 | `Something went wrong` / `That didn't go through. Please try again in a moment.` / `Close` |
| Modal · Track A | `Account suspended` / `This submission broke our standards and your account has been suspended. You can still view markets, but can no longer post, reply, or trade. This decision is final.` / `OK` |
| Modal · banned (once) | `Account suspended` / `Your account has been suspended. You can view markets but can no longer post, reply, or trade. This decision is final.` / `OK` |
| Inline · Track B | `This argument can't be posted as written` / `Please revise it to meet our community standards and try again.` |
| Inline · moderation unavailable | `We couldn't check your argument just now` / `Try again in a few seconds.` |
| Inline · moderation in-flight | `Still checking your last submission — one moment.` |
| Inline · market resolving | `This market is now resolving` / `No further bets can be placed.` |
| Inline · floor-above-balance | `You need Đ 50 to reply. You have Đ 30 available.` (post: `You need Đ 10…`) |
| Inline · server-reject race | `We couldn't place that bet` / `Your position may have changed. Refresh and try again.` |
| Banner · freeze | `The experiment has concluded.` `Markets are frozen and read-only. Thank you for taking part.` |
| Banner · offline | `You're offline. We'll reconnect automatically — some actions are paused.` |
| Dormant · empty-side | `Be the first to argue [YES/NO]` (build-time shell; never public) |

### 2 · `DESIGN-spec-changes-consolidated.md` — append a new section (renumber `N` to next free)

```
## N. DESIGN.W2.11 — State-primitive kit (operator, 2026-06-27)

- The cross-surface robustness layer is ONE kit of six primitives (P1 empty/no-results · P2 blocking
  modal · P3 composer-inline · P4 banner · P5 silent fallback · P6 dormant shell), not per-surface
  bespoke screens. Placement is settled by primitive: hard stops → modal; composer rejections →
  inline; ambient/persistent → banner. No toasts.
- INV-4 build rule (rider on the W2.8 entry-disable): a non-Open market (closed/resolving/resolved/
  voided/frozen) disables the Sell button AND the reply triggers, not only the Đ BET entry button.
  No participant-facing resolved/resolving banner — the loud read-only event is the Nov-5 freeze.
- Offline is a non-blocking BANNER that auto-clears on reconnect (refined from a modal). It is also
  the surface for rare market-list / profile fetch failures; there is no bespoke per-surface error panel.
- Banned removes voice AND Sell: a banned author cannot post/reply/Support/Counter/Sell; positions
  ride to resolution. Terminal, no appeal.
- Moderation participant-facing states follow ADR-0021: Track B = synchronous block-and-revise in the
  composer (no held queue, no "under review" state); Track A = blocking "suspended" modal; the public
  "removed by moderator" mask is owned by DEBATE.7 / the admin dashboard, not W2.11.
- Placement table (state → primitive → host → SPEC.2 §15 code) is the build reference — see the still.
```

### 3 · `DESIGN-motion-consolidated.md` — small delta

- Modal **open** (scrim fade + card lift) / **dismiss**; banner **slide-in** from the chrome edge;
  inline-strip **appearance** in the composer. All **inherit** existing modal/transition tokens
  (the W2.1 picker motion + the existing composer slot motion); names reserved, no new scale.

### 4 · `design-language.md` correction (ADR-0021) — §4.7, §6, + §4.10 note

**§4.7 (state rule 7) — replace** the current "Track-B (queued)… author sees their own on their profile"
text with: *Moderation is invisible to the public. Per ADR-0021 (reactive moderation, no held queue),
the gate blocks flagged content at submit (Tracks A and B) — nothing is queued and nothing publishes
pending review, so there is no public "under review" state and no author-facing pending marker. Track B
is a synchronous block-and-revise in the composer (rejected, text preserved, user revises and resubmits);
Track A blocks and suspends the author. Content an admin reactively removes from live posts renders a
"removed by moderator" placeholder with the thread intact — a public-surface render owned by DEBATE.7 /
the admin dashboard. (Admin's full visual language is a later pass — §7.) Supersedes the prior held-queue
wording.*

**§6 (Track-B bullet) — replace** "Track-B comments are admin-only inline (pending-review marker)…" with:
*Track-B content is blocked at submit (ADR-0021, no held queue) — it never publishes, so it is never
visible to the public and there is no pending-review marker. Reactively-removed live content renders a
"removed by moderator" placeholder (DEBATE.7).*

**§4.10 — append a note:** *(W2.11) the v1.0 surfaces shipped happy-path only; their loading/empty/error
states were realized retroactively at DESIGN.W2.11 as the state-primitive kit (P1–P6). "Ships with the
surface" holds prospectively for surfaces designed after W2.11.*

---

## Verified findings carried out of this chat

- **The v1.0 surfaces shipped happy-path only** — the state layer was net-new at W2.11; §4.10's
  "ships with the surface" is realized retroactively here for the v1.0 surfaces.
- **The consolidated-doc PK copies appear to predate the W2.1/W2.8 fold-ins** (copy register still shows
  `Buy·Sell`; spec-changes stops at §8). Verify the true next free section number when folding — don't
  trust the snapshot.
- **ADR-0021 collision confirmed against the HTML:** no "under review" state exists anywhere in the
  mockups; design-language §4.7/§6 carried the stale held-queue wording (corrected above).

---

## Downstream (consumers)

- The UI build consumes the still wherever each state's host surface is built: auth/signup states → UI.2;
  composer / moderation / validation states → UI.4; profile / bookmark empties → UI.5; visitor-counter
  fallback → UI.13; the Nov-5 freeze banner → the conclusion/freeze build.
- The design-language §4.7/§6 correction is a prescriptive edit → CC-committed when the design PK syncs,
  or folded at **DESIGN.SPEC** (which already lists the §1.3/§6 column-vs-Support correction).

---

## Carried forward / open

- **Product flags (UI/product, NOT W2.11 design):** (a) banned + Sell — **ruled** (no Sell). (b) the
  **floor-above-balance dead-end** — a participant can sit below the reply floor (Đ 50) with no top-up
  path (daily credit pays only on a placed bet; Artha is out of scope). The UI state is designed; the
  product dead-end is a separate founder look.
- **Freeze banner (row 33) ownership** — W2.11 designs the banner; flag vs **W2.4 (timer)** for which task
  wires it at the build.
- **Two small confirms taken as "yes" under best-recoms:** row 13 copy reuse for never-bet users; row 18
  empty Bookmarks independent of the W2.7 ruling.
