# DESIGN — Pop-up redesign + Read-more · CLOSE-OUT (canon)

**Locked:** 2026-07-14 · **Lane:** design-only (operator + web Claude prompt-author; Claude Design executor; no repo commits)
**Ruling basis:** founder reopen of the v1.11 pop-up record, ruled 2026-07-14 (values-log v0.3 close, "chat A" scope executed in-session)
**Supersedes:** the v1.11 pop-up anatomy · the "+" show-more affordance · WI-5 (retired herein)
**Consumer:** CC builds the pop-up surface and card read-affordance from THIS file + the values-log v0.3 tokens. CD is a sketchpad; this document is the anatomy of record (Path B).

---

## 1. The pop-up (post AND reply variants)

**Geometry:** dialog `min(720px, 94vw)` — Medium-style reading column (supersedes `min(1560px, 94vw)`) · max-height `90vh` · vertical scroll inside the dialog · radius 8 · tier-3 elevation (`--elev-3`) · backdrop `rgb(10 10 10 / 0.6)`, blurred, unchanged.

**Single column, content order:**
1. **Header row** (one run, wraps to a second line if needed, never truncates): `author + PFP · side chip · Đ {stake} → Đ {current} · Đ {n} staked in replies · {reply count} · × (top-right)`. No standalone "REPLIES" label. Reply pop-ups carry the **reply's own** side chip (INV-3), not the parent's.
2. **Title** (full).
3. **Body** (full — the argument is the content; nothing editable, append-only).
4. **Media** — full column width, **always shown whole** in the pop-up.
5. **Footer:** Support/Counter pills + stake bar at full column width (reply-as-bet from full context). **No Sell** (W2.10-C: position → Profile). **No comment-free buy.**

**Trigger:** clicking the post/reply card opens the pop-up (whole card remains the target; Read more is the explicit cue, not the sole trigger).

**REPORT:** **stripped** from the pop-up (founder ruling, 2026-07-14 — it had entered via an unratified prompt presupposition and was removed entirely). See §4 parked.

## 2. Card read-affordance — "Read more" (replaces "+")

- Renders on **post AND reply cards**, **only when a body exists** (body is optional on both).
- **Sentence case** "Read more" · **own line** below the truncated body · **flush left** with the body's left edge · margin-top 6px · never runs on from the last sentence.
- Register: quiet text link — 11.5px / 600 · `#989898` rest → `#FAFAFA` hover · system focus ring (`--state-focus-ring`).

## 3. Card media rule (retires WI-5)

- **In-card:** media wells clip at `--imgmax` **160px** max-height, with the expand cue icon.
- **In-pop-up:** media renders **whole**, full column width.
- Per-context rule; both halves canon.

## 4. Parked (explicit, owed later)

- **Moderation/report entry point placement** — ADR-0021's reactive pipeline requires a user-facing report path; no surface currently carries a designed one. Product ruling owed **before the moderation-consequences build (DEBATE.7)**. Not silently dropped: stripped here, parked by name.

## 5. Provenance

Redesign executed in CD against the chat-A kickoff (pre-ruled: 8 founder rulings, 2026-07-14) + two founder refinements (Read more register/placement; Medium-column geometry) + one correction round (CD regeneration drift: title/body restore, header grammar, Read-more restore, clip enforcement). Final state operator-verified clean 2026-07-14. Values inherited: B1 tokens/states/elevation (values-log v0.3 §3) — not restated here; the log is the value source, this file is the anatomy source.
