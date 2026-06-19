# Runbook — DEBATE.7 reactive-moderation operator smoke test

> **Scope.** This is the **only** step that exercises the **real OpenAI multimodal classifier end-to-end** on the Vercel preview. The DEBATE.7 §10 automated tests mock the verdict; they prove the wiring + persisted state given a verdict. This runbook proves the *live* classifier path fires that wiring on a real deploy.
>
> **Operator-run, after web review.** The operator (Hrishikesh) runs this on the Vercel **preview** deployment after web has reviewed this runbook. Claude Code does **not** run it and makes **no** live OpenAI call while authoring it.
>
> **Governing model:** ADR-0021 (reactive moderation, no held queue) + ADR-0014 (gate architecture; §18 P1 A2 patch). Canonical code SHA: `02f87ac` on `main` (PR #143).

---

## ⚠ Safety caveats — READ FIRST, do not soften, do not skip

1. **NEVER live-test CSAM.** Real or simulated child-sexual-abuse material is illegal to possess or upload. **Under no circumstances upload real or simulated CSAM to any environment.** The PhotoDNA hash gate is a *parked* operator capability, proven only with **mocked** hashes — it is not wired in this stratum.
2. **Thresholds are UNTUNED until HARDEN.5.** This smoke test verifies that **the wiring fires given a verdict** — not classifier calibration. A benign image that happens to score over an untuned threshold is a calibration finding for HARDEN.5, not a wiring failure.
3. **No admin UI at this stage.** Verify the `mod_actions` row and the ban via a **DB / log check**, *not* a feed. The upload → review-feed → Remove/Ban loop is the reactive-admin-dashboard stratum's demo, not this one.
4. **`sexual/minors` is TEXT-ONLY** on `omni-moderation-2024-09-26` (image input scores 0 for that category). **Image-CSAM detection cannot be smoke-tested here** — it is covered only by the parked PhotoDNA gate + the A2 adult-`sexual` image backstop (case 3 below) + reactive admin removal. Do not attempt to construct an image-CSAM test.
5. **The only OpenAI `track_a` path other than the adult-NSFW image backstop is CSAM-adjacent text + image — NEVER test it.** The adult-NSFW image backstop (case 3) is the only `track_a` path this runbook exercises.

---

## Preconditions

- The branch is deployed to a **Vercel preview** (this stratum is live on `main` at `02f87ac`).
- A valid **participant session** (a throwaway test account — it **will be auto-banned** by case 3; do not use a real account).
- **DB read access** (Supabase session pooler) and **log/Sentry access** to verify persisted state and the CSAM seam.
- A **benign test image**, a **graphic-violence test image**, and a **legal adult-NSFW image** (never CSAM) prepared off-platform.

Each case is: submit a comment-bearing bet with the image attached (the F-COMMENT-3 image flow through `POST /api/bets/place`), then verify the HTTP response **and** the persisted state.

---

## Live cases

### Case 1 — Benign image → posts (Track C)
- **Do:** attach the benign image to a comment-bearing bet on an Open market; submit.
- **Expect (HTTP):** `200`, body `{ ok: true, ... }`.
- **Verify (persisted):** a `comments` row + a `bets` row landed for the market; the attached `image_uploads` row terminalized `terminal_state = 'committed'` (the normal pass path); **no** `mod_actions` row written for this submit.

### Case 2 — Graphic-violence image → Track B block, no ban
- **Do:** attach the graphic-violence image; submit. (`violence/graphic` fires on images.)
- **Expect (HTTP):** `400`, error code `comment_track_b_blocked`. (The category is **never** revealed to the author — the body is the generic Track-B rejection.)
- **Verify (persisted):**
  - a `mod_actions` row with `reason = 'track_b_blocked'`, `verdict = 'track_b'`, `actor_id = 'system'`, `image_r2_key` set, `target_market_id` set, `categories` carrying the OpenAI scores;
  - the attached `image_uploads` row flipped to `terminal_state = 'blocked'`;
  - **NO ban** — the test account's `users.banned_at` stays `NULL`;
  - **not published** — no `bets` / `comments` row for this submit.

### Case 3 — Legal ADULT NSFW image (NEVER CSAM) → Track A block + AUTO-BAN
- **Do:** attach the **legal adult-NSFW** image (never CSAM); submit. (A2: omni `sexual` on the image + `imageR2Key` → `track_a` — the CSAM-image backstop while PhotoDNA is parked.)
- **Expect (HTTP):** `400`, error code `comment_track_a_blocked`.
- **Verify (persisted):**
  - a `mod_actions` row with `reason = 'track_a_autoban'`, `verdict = 'track_a'`, `actor_id = 'system'`, `image_r2_key` set, `target_market_id` set;
  - the test account is **auto-banned** — `users.banned_at` is now set (a subsequent submit from that account returns `403 banned_user`);
  - the attached `image_uploads` row flipped to `terminal_state = 'blocked'`;
  - **not published** — no `bets` / `comments` row;
  - the CSAM Sentry seam (`csam_auto_report_pending`) does **NOT** fire for this case — adult `sexual` is not `sexual/minors`, so it is correctly **not** treated as CSAM.

---

## Verification reference (DB / log, since there is no admin UI)

- `mod_actions`: `SELECT reason, verdict, actor_id, target_market_id, image_r2_key, blocked_text FROM mod_actions ORDER BY created_at DESC;` (run via the session pooler; `blocked_text` is admin-only / STRIP-in-dataset).
- ban state: `SELECT banned_at FROM users WHERE id = '<test-account-id>';`
- image terminalization: `SELECT terminal_state FROM image_uploads WHERE id = '<upload-id>';`
- published-or-not: `SELECT count(*) FROM bets WHERE market_id = '<market-id>';` (expect 0 for cases 2 & 3).
- CSAM seam: a Sentry `csam_auto_report_pending` event fires **only** on a `track_a` whose categories include `sexual/minors` — it must **not** appear for case 3.

> **Operator action (not part of the smoke run):** set the Sentry alert level on `csam_auto_report_pending` high enough to **page** — a pending CSAM report needs human follow-up (NCMEC filing is a parked manual step, `TODO(MOD-NCMEC-INTEGRATION)` / `docs/parked.md` LD-7).

---

## Pass criteria

All three cases produce the expected HTTP code **and** the expected persisted state. A mismatch is a wiring defect (file it); a benign image tripping a threshold is a calibration note for HARDEN.5 (caveat 2), not a wiring failure.
