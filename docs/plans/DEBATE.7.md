# DEBATE.7 — Reactive moderation: wire the consequences + lay the `mod_actions` data foundation

> **Status:** Approved plan (web-reviewed round 1; Hrishikesh ratified the open decisions 2026-06-18). Execute is a **separate fresh chat** with the security-auditor in the loop — do **not** execute from the plan chat.
>
> **Frame:** critical-path · safety-critical · launch-gating. Full ritual at execute: plan→execute · `@test-writer` first · `@code-reviewer` → `@security-auditor` (incl. the gate change) → `@db-migration-reviewer` · pre-PR self-audit · `just verify` + `pnpm test:invariants` + `pnpm test:integration` + full `pnpm vitest run`.
>
> **Source of truth (read first at execute):** ADR-0021 (accepted; reactive model, no held queue, §8 carve-out), ADR-0014 (Amended-by 0021; gate architecture + §18 fixed category→track map + §85 standalone-tx consequence), SPEC.1 v1.0.7 §14 (Moderation) / §15 (F-ADMIN-4) / §16.4-16.5 / §8 (error codes) / §17 (acceptance catalogue) / Appendix A (category→track map), SPEC.2 v1.0.7 §10 (Pre-Commit Moderation Contract) / Appendix B.10 (`mod_actions`) / §11 (idempotency). On any spec↔code conflict the spec/ADR wins (CLAUDE.md §1).

---

## 0. Verified on-disk state (recon — do not re-trust the kickoff block)

| Item | Verified | Evidence |
|---|---|---|
| `origin/main` @ `3467acf` (PR #141); working tree == that tree | ✅ | empty `git diff HEAD origin/main` |
| SPEC.1 / SPEC.2 = v1.0.7 | ✅ | SPEC.1 §0 line 15; SPEC.2 §0 line 14 |
| ADR-0021 accepted · supersedes 0020 · amends 0014; 0020 superseded; 0014 Amended-by 0021 | ✅ | the three ADR headers |
| Migration head `0015` | ✅ | `drizzle/migrations/0015_*` |
| `EVENT_TYPES` = 23 | ✅ | `src/server/events/schemas.ts` (4+5+2+7+2+1+2); no `moderation.*` / `user.banned` |
| Gate **call** wired; **consequences NOT** | ✅ | `place/route.ts:92` calls `precommitModerate`; lines 99-104 only `throw`. DEBATE.2 log: "route-wire only … no Track-A/B/C consequences" |
| `mod_actions` exists, faithful to SPEC.2 App.B.10, **never written** | ✅ | `src/db/schema/audit.ts:28`; grep finds schema+relations only, **no inserts** |

**Scope-fork resolution (kickoff §1):** `mod_actions` exists but keys off `verdict` (`mod_verdict` = `pass`/`track_a`/`track_b`) and has **no reason-code column**, **no blocked-text column**, **no market column**. DEBATE.7 is therefore **NOT scope-zero**: it carries **migration `0016`** + a **same-commit SPEC.2 Appendix B.10 amendment** (the `@db-migration-reviewer` gate).

### Divergences found (the basis for the resolved decisions in §13)

1. **Gate mapping ↔ Appendix A.** SPEC.1 §14 App.A (lines 769, 1397, 1402-1404) maps adult `sexual`(text)→A and `nsfw`/adult-imagery(image)→A; ADR-0014 §18 calls the category→track map **FIXED**. `precommit.ts` routes everything except `sexual/minors` → `track_b`. Compounded: SPEC.2 §10 line 1057 — `sexual/minors` fires on **text only**; images score 0. So the only OpenAI-reachable `track_a` today is CSAM-adjacent **text** + image (never testable). → **resolved A2** (§3, §13).
2. **NCMEC "auto-report" is deferred, not built.** parked.md §SCAFFOLD.16/LD-7 + SPEC.2 §10 line 1073: deferred post-experiment/post-incorporation (attorney-confirmed). → **seam only** (§7, §13).
3. **§17 catalogue already reconciled** by PR #141 (SPEC.1 lines 1165-1176). DEBATE.7 mints the **test files**, not row-renames (§10).
4. **Error code is code-behind-spec.** SPEC.1 §8 (lines 281/367) already says `400 comment_track_b_blocked`; on disk it is `CommentTrackBUnderReviewError` / `comment_track_b_under_review` / **HTTP 423**. → rename + 423→400 (§5).
5. **Audit row wants scores, gate returns names.** `mod_actions.categories` = "OpenAI category **scores**" (App.B.10) / "with confidence" (SPEC.1 §786); `precommitModerate` returns `categories: string[]`. → enrich return (§6).

---

## 1. Scope

**In.** Wire the four-disposition consequences off the gate verdict + lay the `mod_actions`/ban data foundation the reactive admin dashboard later reads. Implement the gate's fixed App.A image→Track A mapping (A2). Mint the failing-first consequence tests + the operator smoke-test checklist.

**Out / scope boundary (kickoff §3 — flag any plan-creep into these):**
- The **admin dashboard build** — the reactive review feed, the Remove/Ban action handlers, the resolution surface. DEBATE.7 lays the rows + ban mechanics it reads; it does **not** build the feed or the action handlers. *(If an execute step starts building the feed / `content_removed` / `user_banned` action handlers, STOP — that is the next stratum.)*
- **Track A degrade mode** (auto-ban → flag-only) — HARDEN.5, its own ADR/memo. ADR-0021 §31 re-homes flag-only items to the reactive feed; not here.
- **Any load-conditional moderation relaxation** — forbidden. CSAM fail-open is non-negotiable.
- **PhotoDNA onboarding** (parked; OpenAI-only path; CSAM-hash is operator-owned).
- **Per-category threshold tuning** (HARDEN.5).
- **A third image classifier** (rejected; image-gap covered by reactive admin removal in the dashboard stratum).
- **Real market/social content.** The public-debate `removed by moderator` render (dashboard/public stratum).

---

## 2. The consequence model (off the gate verdict; golden rule + INV-1/2/3 intact)

The gate runs entirely before any DB transaction (ADR-0014, unchanged). `precommitModerate` releases its Redis reservation in its own `finally` (precommit.ts:135) **before** returning, so the consequence write happens with **no reservation held and no HTTP in-flight** — a pure-DB standalone tx. The route then branches on the verdict:

| Verdict | Consequence (new `recordGateBlock`, one standalone short tx) | Response |
|---|---|---|
| `track_a` | `mod_actions` (reason `track_a_autoban`, verdict `track_a`, actor `system`, scores, `blocked_text`, `image_r2_key`, `target_market_id`) · `UPDATE users SET banned_at = now() WHERE id=? AND banned_at IS NULL` · (image flow) `image_uploads → 'blocked'` · CSAM seam iff `sexual/minors ∈ categories` (§7) | `throw CommentTrackABlockedError` → 400 `comment_track_a_blocked` |
| `track_b` (ordinary) | `mod_actions` (reason `track_b_blocked`) · **no ban** · (image) `image_uploads → 'blocked'` | `throw CommentTrackBBlockedError` → 400 `comment_track_b_blocked` |
| `track_b` (carve-out: `!imageR2Key && categories.includes("sexual/minors")`) | `mod_actions` (reason `sexual_minors_text_blocked`) — the **one** blocked-not-published row surfaced to reactive ban-review | same 400 `comment_track_b_blocked` (category never revealed to the author — SPEC.1 §983) |
| `pass` | none — `runBetTransaction` opens as today (untouched) | 200 |
| terminal moderation failure | **fail-closed**: no `mod_actions`, no bet/comment, reservation already released | `ModerationUnavailableError` → 503 `moderation_unavailable`, `Retry-After: 5` |

**Why this is invariant-safe.**
- **Golden rule:** moderation HTTP is fully done before `recordGateBlock`; the standalone tx is pure DB. No Postgres tx held across an HTTP call.
- **INV-1:** on `track_a`/`track_b` the bet+comment tx **never opens** (F-MOD-4 holds trivially — no partial state).
- **INV-2 / INV-3:** the ban sets only `users.banned_at`; positions and `dharma_ledger` are never touched — "ban removes voice, not balance; positions ride to resolution." No clawback, no compensating sell.
- **Append-only:** `mod_actions` is Bucket A; rows are INSERTed, never mutated.

**Four flows, one handler.** Entry (F-BET-1), subsequent/direct (F-BET-2 / F-COMMENT-1), reply (F-COMMENT-2), image (F-COMMENT-3) all run through `POST /api/bets/place` (reply-as-bet); the comment-free sell (F-BET-3) skips moderation. All gate **before** the W-1 bet tx — confirmed; consistent with ADR-0013 §8 (wrapper is moderation-unaware). The reply path gates identically to entry (it rides the same `place` tx).

---

## 3. Gate change — A2 (the fixed App.A image→Track A mapping)

`precommit.ts` currently routes only `sexual/minors`+image → `track_a`; adult `sexual` and `nsfw`/adult-imagery → `track_b`. A2 implements the **fixed** App.A image rows. Rationale (web round 1): with PhotoDNA parked and omni scoring `sexual/minors`=0 on images, a CSAM image omni reads as adult `sexual` must still **block + auto-ban** — A2 is the live CSAM-image backstop; block-no-ban is not. Accepted cost: false-positive auto-bans on legitimate nudity (HARDEN.5 tunes; text-first platform; A2 does **not** auto-ban on text).

Target mapping (precommit.ts lines ~127-132), in order:

```
sexual/minors === true:           imageR2Key ? track_a : track_b   // unchanged (image=CSAM legal floor; text=carve-out)
sexual        === true && image:  track_a                          // A2 — image adult sexual/NSFW → auto-ban (CSAM-image backstop)
sexual        === true && !image: track_b                          // adult-sexual TEXT stays B (App.A text row reconciled → B)
any other flagged:                track_b
none:                             pass
```

- Use the canonical omni category keys (`"sexual"`, `"sexual/minors"`) — confirm the exact constant against `openai.ts` at execute; add a `TRACK_A_SEXUAL_CATEGORY = "sexual"` const alongside the existing `TRACK_A_CATEGORY = "sexual/minors"`.
- **Same-commit doc reconciliation (no documented divergence):** SPEC.1 App.A adult-sexual **text** row (≈ line 1397/1403) `→ A` becomes `→ B (Experiment)`, with auto-ban escalation noted as a **HARDEN.5** decision; the image rows stay `→ A`, now implemented (the prior "Track A auto-ban" for text-only sexual/minors was already corrected to the carve-out in v1.0.7 — leave that). Add an App.A note that image adult `sexual`/nsfw → Track A is realised via omni's `sexual` category + `imageR2Key` presence.
- **ADR-0014 §18 patch-record** (in-place per CLAUDE.md §5.12 — the decision is unchanged; the consumer surface is scoped): the gate now implements the App.A **image→Track A** mapping for adult `sexual`; SCAFFOLD.16 previously implemented only `sexual/minors`. CSAM-image coverage = this backstop + reactive admin removal until PhotoDNA/NCMEC land (parked).
- This gate change is the reason `@security-auditor` reviews the gate diff (not only the consequence module).

---

## 4. Schema — migration `0016` + same-commit SPEC.2 amendment

**`mod_reason` pgEnum (5 values; ADR-0021 §78 ∪ §84):** `track_a_autoban`, `track_b_blocked`, `sexual_minors_text_blocked`, `content_removed`, `user_banned`. The last two are written only by the **reactive dashboard stratum** — included now for forward-compat so the dashboard needs no further migration.

**`mod_actions` column changes** (drizzle schema `src/db/schema/audit.ts` + generated `0016_mod_actions_reason.sql`):

| Change | Drizzle | Notes |
|---|---|---|
| add `reason` | `modReasonEnum("reason").notNull()` | table is **empty** (no writer has ever existed) → `NOT NULL` add is safe; if any env unexpectedly holds rows the migration fails loudly (investigate, don't backfill silently) |
| add `blocked_text` | `text("blocked_text")` (nullable) | the rejected comment body — no comment row exists for a gate-block; needed for the carve-out's reactive ban-review + SPEC.1 §786 |
| add `target_market_id` | `uuid("target_market_id").references(() => markets.id, { onDelete: "restrict" })` (nullable) | gate-block rows have no comment to JOIN → required for F-ADMIN-5 market search + the dashboard market filter; import `markets` (no cycle) |
| relax `verdict` | drop `.notNull()` → `modVerdictEnum("verdict")` | reactive admin rows (content_removed / user_banned) have no gate verdict |
| index | `mod_actions_reason_idx`, `mod_actions_target_market_idx` | F-ADMIN-5 action-type + market search |

- Generate with `just db-generate mod_actions_reason` (mod_actions is **not** in `tablesFilter: ["!events"]`, so drizzle-kit picks it up). Bucket-A append-only triggers (`0003`) fire on row UPDATE/DELETE, not DDL — `ALTER TABLE` is unaffected.
- `actorId` stays `text NOT NULL` (admin has no `users` row — ADR-0010). Gate auto-actions write `actor_id = 'system'`.

**Same-commit SPEC.2 amendment (Appendix B.10 + §5 + §10):**
- **App.B.10:** add `reason` (mod_reason; **SHIP**), `blocked_text` (text|null; **STRIP** — admin-only, retained for ban-review, not released in the dataset), `target_market_id` (uuid|null; **SHIP**); change `verdict` to `text | null` with note "NULL for reactive admin-action rows"; **fix the stale `actor_id` note** → "'system' for all gate auto-actions (Track A autoban, Track B block, sexual_minors_text_blocked carve-out); 'admin-singleton' for reactive Remove/Ban (dashboard stratum)"; update `categories` note → "full OpenAI response (category scores + applied-input-types) at decision time; the §786 'source layer' is derivable from `category_applied_input_types`".
- **§5.5 (audit domain):** note the `mod_reason` enum on `mod_actions`.
- **§10 step 4:** return shape → `{ outcome; categories?: string[]; categoryScores?: <OpenAI scores> }` (the §6 enrichment).
- **§0.1 changelog row + §0 version bump** (SPEC.2 v1.0.7 → v1.0.8).

**SPEC.1 amendment (A2):** App.A adult-sexual-text row → B (§3) + image-row implementation note; **§0 version bump** (v1.0.7 → v1.0.8) + §20 changelog.

> **No new ADR.** ADR-0021 §28 explicitly delegates the exact `mod_actions` reason-code strings + schema to *this plan*. The schema record is the plan + the same-commit SPEC.2 App.B.10 amendment. The only ADR touch is the ADR-0014 §18 **patch-record** for the A2 gate-mapping (§3).

---

## 5. Error-code change (§4.4 wire envelope)

`src/server/bets/errors.ts`:
- `CommentTrackBUnderReviewError` → **`CommentTrackBBlockedError`**; `static code = "comment_track_b_blocked"`; `static httpStatus = 400` (was 423); message "comment blocked by moderation (track B); revise and resubmit".
- Update the `place/route.ts` import + throw sites; both ordinary-B and the carve-out throw the **same** error (the carve-out distinction lives in `mod_actions.reason`, never in the user response).
- `CommentTrackABlockedError` (code `comment_track_a_blocked`, 400) is already correct — unchanged.
- This aligns code to the already-amended SPEC.1 §8 (lines 281 F-BET-1, 367 F-COMMENT-2: `400 comment_track_b_blocked`). No SPEC.1 §8 edit needed.

---

## 6. `precommitModerate` return enrichment + the carve-out discriminant

- Enrich `PrecommitResult` to carry the raw OpenAI **category scores** (e.g. `categoryScores: Record<string, number>` or the response's `category_scores` + `category_applied_input_types`), so `recordGateBlock` can write the full scores object into `mod_actions.categories` ("with confidence" — SPEC.1 §786, App.B.10). Confirm `openai.ts`'s `moderate()` already surfaces scores; if it only returns the boolean `categories` map, extend it to also return scores. Amend SPEC.2 §10 step 4 (above).
- **Carve-out discriminant** (in `recordGateBlock`, not the gate): `outcome === "track_b" && !imageR2Key && categories.includes("sexual/minors")` → reason `sexual_minors_text_blocked`; else `track_b` → `track_b_blocked`. `precommit` already yields `track_b` for `sexual/minors` only when there is no image (line 129), and pushes `"sexual/minors"` into the flagged list — so this is unambiguous; `!imageR2Key` is the defensive belt.

---

## 7. Fail-closed + the CSAM seam (no NCMEC build — OD-5)

- **Fail-closed** is unchanged (ADR-0014 / SPEC.2 §10): a terminal OpenAI failure → `ModerationUnavailableError` (503, `Retry-After: 5`), **no `mod_actions` row**, no bet/comment, reservation already released. CSAM fail-open remains forbidden. The fail-closed test (§10) must now **also assert no `mod_actions` row** is written on terminal failure (the new writer must not fire).
- **CSAM seam (seam only, no NCMEC integration — LD-7).** In `recordGateBlock`, when `outcome === "track_a" && categories.includes("sexual/minors")`, emit a Sentry custom event (e.g. `csam_auto_report_pending`) carrying the `mod_actions.id` + a `// TODO(MOD-NCMEC-INTEGRATION): file NCMEC CyberTipline report — parked per parked.md LD-7` marker. **No NCMEC API call.** Note: under A2 a track_a from adult `sexual`+image is **not** `sexual/minors`, so it does not fire the seam (correct — it is not CSAM). The text-only `sexual/minors` carve-out is handled by its `mod_actions` reason + the reactive feed surfacing (human review), not the auto-report seam.

---

## 8. Idempotency / reservation / concurrency (affirm — no new guard)

- The §3.1 stack (`endpoint.ts`): origin → auth+ban → freeze → idem-key-validate → JSON → **idempotency lookup** → [miss] rate-limit → `inner` (validate → moderation → consequence/tx) → `release` in finally.
- The consequence write lives **inside `inner`** (after the idem `miss`). An idempotency `hit` returns *before* `inner` (endpoint.ts:235), so a same-key retry replays the cached rejection — **no second `mod_actions` row, no fresh OpenAI call**. A now-banned user's retry is intercepted earlier still by the auth+ban gate (403 `banned_user`).
- The idempotency **pending sentinel** (30s TTL) is held across the whole of `inner`, so concurrent same-key submits get 409 `idempotency_in_flight`. The only way to get two `mod_actions` rows is two genuinely-distinct idempotency keys = two real submits = two correct audit rows.
- **Affirmed benign (web low-pri 1):** the rare reservation-release→cache-write race could in principle duplicate one audit row; that is acceptable — `mod_actions` is append-only audit (over-recording is harmless) and the `banned_at IS NULL` guard makes the ban idempotent. **No extra guard.**

---

## 9. Events posture — no new event type (OD-4 = (a))

`mod_actions` is the authoritative append-only moderation audit; `users.banned_at` is the derived state the bet gate reads. DEBATE.7 emits **no** `events` row for moderation consequences (SPEC.2 line 804 makes the events write *optional*). **`EVENT_TYPES` stays 23** — no enum-hygiene change. *(If event-sourcing/dataset completeness for bans is later wanted, a `user.banned` type is a one-line enum + Zod-payload add — explicitly deferred.)*

---

## 10. Test plan (failing-first via `@test-writer`; assert *persisted state* — DEBATE.2 lesson)

Mint failing tests **before** implementation. Each write-path test asserts the persisted row/state, not just the wire response.

**New consequence tests → §17 rows (catalogue already reconciled; map only):**
- `moderation::track-a-auto-ban` → `tests/server/moderation/track-a.test.ts::auto-ban-and-positions-preserved` (the exact path SPEC.1 §782 names). Asserts: `mod_actions` row (reason `track_a_autoban`, verdict `track_a`, actor `system`, `categories` scores, `blocked_text`, `target_market_id`, `image_r2_key` when image), `users.banned_at` SET, **no** `bets`/`comments` row, positions untouched (INV-2/3), 400 `comment_track_a_blocked`.
- `moderation::track-b-blocked-no-ban` → `mod_actions` reason `track_b_blocked`, **no** ban, no `bets`/`comments`, no stake, 400 `comment_track_b_blocked`, and a revised resubmit (now `pass`) succeeds (author may revise).
- `moderation::sexual-minors-text-blocked-surfaced` → text-only `sexual/minors`: reason `sexual_minors_text_blocked`, no ban, `blocked_text` retained, the row is the surfaceable-for-ban-review item (reason is the discriminant the dashboard filters on).
- **image-block** (both tracks, image flow): `image_uploads.terminal_state = 'blocked'` + `mod_actions.image_r2_key` set; assert the CAS (claimed-exactly-one) mirrors `place()`'s committed CAS.
- **A2 mapping** (gate unit/integration): image adult `sexual` → `track_a`; adult `sexual` **text** → `track_b`; `sexual/minors` image → `track_a`; `sexual/minors` text → `track_b` carve-out. (Mock the OpenAI verdict — these assert the mapping, not the classifier.)
- **fail-closed extension:** terminal OpenAI failure → 503 **and no `mod_actions` row** (the new writer must not fire).
- **CSAM seam:** `track_a` + `sexual/minors` fires the Sentry seam (mocked); adult-`sexual` image track_a does **not**. No NCMEC call.
- `moderation::reactive-remove-ban-positions-ride` → **foundation only**: assert the `mod_reason` enum carries `content_removed`/`user_banned` and that the schema supports an admin-action row (verdict NULL, actor `admin-singleton`) with positions/ledger untouched (INV-2). **The Remove/Ban action handlers + their behavioural test are the dashboard stratum — do not build them here.**

**Already-existing gate-engine rows — reconcile, do NOT recreate:** `entry-flag-fails-both` (F-MOD-4/INV-1), `no-postgres-tx-across-openai-call`, `idempotency-cache-hit-skips-moderation`, `redis-reservation-collision-409`, `openai-transient-failure-retry-succeeds`, `photodna-csam-match-shortcircuits-openai` (mock-only; PhotoDNA parked). The §17 reconciliation deliverable = verify the catalogue ↔ wired consequences ↔ test files map; the row *names* already landed in PR #141.

---

## 11. Operator smoke-test checklist (plan specifies; execute produces `docs/runbooks/DEBATE.7-moderation-smoke.md`)

The **only** step exercising the real OpenAI multimodal classifier end-to-end on the Vercel preview (the §10 tests mock the verdict).

**Live cases:**
- **Benign image** → posts (Track C). 200 + `comments`/`bets` row.
- **Graphic-violence image** → blocked + `mod_actions` reason `track_b_blocked` + `image_uploads → blocked` + **no ban** + no publish. (`violence/graphic` fires on images.)
- **Legal ADULT NSFW image (never CSAM)** → blocked + **auto-ban** + `mod_actions` reason `track_a_autoban` + `image_uploads → blocked`. (A2: omni `sexual` on the image + `imageR2Key` → `track_a`.)

**Caveats the checklist MUST state:**
1. **NEVER live-test CSAM** — illegal to possess/upload. PhotoDNA is a parked operator gate proven only with mocked hashes.
2. Thresholds are **UNTUNED** until HARDEN.5 — the smoke test verifies **wiring fires given a verdict**, not classifier calibration.
3. **No admin UI** at this stage — the `mod_actions` row + the ban are verified via DB/log check, **not a feed**; the upload→feed→Remove/Ban loop is the dashboard stratum's demo.
4. `sexual/minors` is **text-only** on `omni-moderation-2024-09-26` (image scores 0) — **image-CSAM detection cannot be smoke-tested** (covered only by the parked PhotoDNA + the A2 adult-`sexual` backstop + reactive removal).
5. The only OpenAI `track_a` path other than the adult-NSFW backstop is CSAM-adjacent **text** + image — **never test it**.

---

## 12. File list

**New:**
- `src/server/moderation/consequences.ts` — `recordGateBlock` (standalone-tx writer: `mod_actions` + ban + image-block + CSAM seam). *(critical path → `@code-reviewer` + `@security-auditor`)*
- `drizzle/migrations/0016_mod_actions_reason.sql` — generated. *(`@db-migration-reviewer`)*
- Test files per §10 (`tests/server/moderation/track-a.test.ts`, `track-b-blocked.test.ts`, carve-out, image-block, A2-mapping, fail-closed-no-row, CSAM-seam; an integration suite if a real test-DB write is needed). *(`@test-writer`, Phase 2 start)*
- `docs/runbooks/DEBATE.7-moderation-smoke.md` — execute close-out deliverable.

**Modified:**
- `src/db/schema/audit.ts` — `modReasonEnum`; `reason`/`blockedText`/`targetMarketId` columns; `verdict` nullable; two indexes; import `markets`. *(`@db-migration-reviewer`)*
- `src/server/bets/errors.ts` — rename + code + status (§5).
- `src/app/api/bets/place/route.ts` — call `recordGateBlock` before the throw; rename the thrown error; pass `body` (blocked_text), `categoryScores`, `resolvedImage?.uploadId`, `marketId`. *(`@code-reviewer` + `@security-auditor`)*
- `src/server/moderation/precommit.ts` — A2 mapping (§3) + scores enrichment (§6). *(critical → `@security-auditor`)*
- `src/server/moderation/openai.ts` — surface category scores if not already (§6).
- `docs/specs/SPEC.2.md` — App.B.10 + §5.5 + §10 + §0.1 changelog + §0 version (§4).
- `docs/specs/SPEC.1.md` — App.A adult-sexual-text row → B + image note + §0 version + §20 changelog (§3).
- `docs/adr/0014-pre-commit-moderation-flow.md` — §18 patch-record (§3).

*(All SPEC/ADR edits ship in the **same execute commit** as the code/migration — same-commit doctrine, CLAUDE.md §5.12. The plan PR commits only this file.)*

---

## 13. Resolved decisions (the record — ratified 2026-06-18)

| OD | Decision |
|---|---|
| **OD-1** | **A2** — image adult `sexual`/NSFW → `track_a` (CSAM-image backstop while PhotoDNA parked); adult-sexual **text** stays `track_b`, App.A text row reconciled → B (no code↔spec divergence); auto-ban-on-text escalation = HARDEN.5. Gate-touch → `@security-auditor` + App.A/ADR-0014 §18 patch-record. |
| **OD-2** | **Yes** — category scores in the `precommitModerate` return (+ SPEC.2 §10 note). |
| **OD-3** | **All four** columns: `reason` / `blocked_text` (STRIP-in-dataset, admin-only retained) / `target_market_id` / `verdict`-nullable. |
| **OD-4** | **(a) none** — `mod_actions` + `banned_at` are the record; no `user.banned` event; `EVENT_TYPES` stays 23. |
| **OD-5** | **Seam only** — Sentry + `TODO(MOD-NCMEC-INTEGRATION)`; no NCMEC build (LD-7). Aggregate live-CSAM posture (parked PhotoDNA + seam-only NCMEC + A2 backstop + reactive removal) knowingly affirmed by Hrishikesh. |
| **OD-6** | **400** — `comment_track_b_blocked`. |

---

## 14. Execution sequence + pre-PR self-audit

1. Fresh execute chat; read this plan + §0 source-of-truth docs; verify §0 on disk again.
2. `@test-writer` (Phase 2 start) — mint the §10 failing-first tests against this plan.
3. Implement: migration `0016` + `audit.ts` → `precommit.ts`/`openai.ts` (A2 + scores) → `consequences.ts` → `errors.ts` rename → `place/route.ts` wire → same-commit SPEC.2/SPEC.1/ADR-0014 amendments.
4. `@code-reviewer` (src/server diff) → `@security-auditor` (gate change + consequence module + INV-1/2/3 + refusal triggers) → `@db-migration-reviewer` (0016 + App.B.10 same-commit amendment). All FAIL-in-scope fixed before PR; SURPRISE-out-of-scope → `claude-progress.md` + STOP.
5. **Pre-PR self-audit (§5.10)** — PASS/FAIL/SURPRISE per item:
   - **Schema:** `mod_reason` 5 values; `reason` NOT NULL; `blocked_text`/`target_market_id` nullable; `verdict` nullable; indexes; FK lambda/onDelete; **grep-verify the same-commit SPEC.2 App.B.10 amendment landed**.
   - **Server:** all four flows gate pre-tx; `recordGateBlock` opens exactly one standalone tx, no HTTP inside; ban is `banned_at IS NULL`-guarded; image flows flip `image_uploads`; carve-out discriminant correct; **no path holds a tx across the OpenAI call**.
   - **Consequence ↔ invariant:** track_a/track_b never open the bet tx (INV-1); ban touches no position/ledger (INV-2/3); fail-closed writes no row.
   - **Error/CSAM:** 423→400 + code rename; CSAM seam is Sentry-only (no NCMEC call).
6. Subagent reviews spawned with `model:"opus"` (subagents pin fable-5; session on Opus → override or they die at 0 tool_uses).
7. `just verify` (`ZUGZWANG_ENV=preview`) + `pnpm test:invariants` + `pnpm test:integration` + full `pnpm vitest run` (cross-suite floors incl. the EVENT_TYPES inventory pin — must still read 23) before the PR.
8. Execute close-out: `docs/runbooks/DEBATE.7-moderation-smoke.md` + `docs/logs/DEBATE.7.md`.
