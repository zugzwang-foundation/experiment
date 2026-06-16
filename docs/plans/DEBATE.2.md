# DEBATE.1 + DEBATE.2 — INV-1 atomicity (API+DB) + comment/reply-as-bet write path

> **Status:** reviewed (operator-ratified 2026-06-16; rulings 1–3 applied)
> **Date:** 2026-06-16
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** yes — `src/server/comments/` (greenfield), `src/server/bets/`, INV-1/INV-3 (CLAUDE.md §1)
> **Plan PR / commit:** this PR (`chore/debate-2-plan`)

---

## Tracker context

Two separate tracker rows, **co-planned here and executed as one unit** in the fresh execute chat (one tightly-coupled server+tests change with no schema delta — CLAUDE.md §5.11's "don't split tightly-coupled" applies).

```
DEBATE.1 — { id:"DEBATE.1", phase:4, title:"INV-1 atomicity enforcement (API + DB)",
  desc:"Bet+comment atomic at 3 layers: API rejects bet without commentId (400); bets.comment_id
  NOT NULL FK (built); single tx wraps both. Mints I-ATOMICITY-001 (shared with ENGINE.7).",
  pri:"P0", deps:["ENGINE.8"], est:"1d" }

DEBATE.2 — { id:"DEBATE.2", phase:4, title:"Comment/reply schema + post/reply/image logic",
  desc:"src/server/comments/ (greenfield). A reply IS a Support/Counter bet (ADR-0017) — reply-write
  goes through the bet path. DOES NOT write stake_at_post_time (ADR-0009-dead). F-COMMENT-1…5.
  Image attach via built R2 signUploadAndInsert.", pri:"P0",
  deps:["ENGINE.6","DEBATE.1","SCAFFOLD.15"], est:"3d" }
```

**Dependency status at plan time (verified on `main` @ `c6dffa6`):**
- **ENGINE.6** (`insertEvent`, event payload schemas) — DONE (`src/server/events/insert.ts:95`; `eventPayloadSchemas` incl. `comment.placed` with nullable `uploadId`/`parentCommentId`).
- **ENGINE.8** (`place()` + place route) — DONE (`src/server/bets/place.ts`, `src/app/api/bets/place/route.ts`); fenced at `parentCommentId: null`.
- **SCAFFOLD.15** (`signUploadAndInsert` + `/api/uploads/sign`) — DONE (`src/server/storage/sign-upload.ts:53`). The image-moderation *primitive* (`precommitModerate` accepting `imageR2Key`; `moderate()` multimodal) is also built (SCAFFOLD.15/16) — see §3 / STEP-A note.
- **ENGINE.11** (positions read — `getHeldPosition`/`heldSideOrNull`) — DONE (`src/server/positions/read.ts`); the foreclosure read fn builds on it.
- **DEBATE.1** — co-planned here; DEBATE.2 depends on it (shared INV-1 surface).
- Migration head `0015`, EVENT_TYPES = 23 — **no change** in this task.

---

## Approach

The DB half of INV-1 is already built (`bets.comment_id NOT NULL FK → comments.id`, restrict, indexed). **DEBATE.1** therefore reduces to the *API frontstop* + the *bidirectional precision* + the shared invariant test. **DEBATE.2** un-fences the reply branch of the **existing** `place()` W-1 path (a reply IS a Support/Counter bet — ADR-0017) and adds a thin greenfield `src/server/comments/` *validation/derivation* layer (Call B): parent lookup + depth-1 + same-market + Support/Counter→side derivation + image-attach orchestration + the single-side×Counter **foreclosure read surface**. `place.ts` stays the *single* atomic owner of the bet+comment write (INV-1 in one place); `comments/` produces validated inputs it consumes. **No new table, no migration, no new event type, no new route** — replies and images flow through `POST /api/bets/place`.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| **2.1 Bet ↔ comment atomicity (INV-1)** | **yes** | bet→comment: `bets.comment_id NOT NULL` (built) **+** API requires a comment body → else **400 `comment_requires_bet`** (DEBATE.1 frontstop). comment→bet: **by construction** — comments are only ever inserted inside `place()`'s single SERIALIZABLE W-1 tx, always paired with a bet (`comments.bet_id` is NULLABLE today — DEBATE.8/9 reconciliation, **not changed here**; the bind holds structurally, not by constraint). Reply + image branches reuse the same single tx. | `tests/server/bets/atomicity.test.ts` (rollback both directions; missing-comment 400; comment_id-NULL constraint) + `tests/invariants/I-ATOMICITY-001.bet-comment-atomic.spec.ts` (shared w/ ENGINE.7; extended for the construction direction) + `tests/server/comments/no-position.test.ts::comment-requires-bet` |
| **2.3 Side frozen at comment-time (INV-3)** | **yes** | The reply's `comments.side_at_post_time` is set to the **replier's** held/entry side (NOT the parent's) at write-time inside the tx; Support/Counter is **derived at read time** (`side` vs `parent.side_at_post_time`), never stored. DEBATE.2 **sets** the value correctly; **DEBATE.3** owns the BEFORE-UPDATE freeze trigger. Selling/exiting never moves prior comments (append-only). | `tests/server/comments/reply.test.ts::reply-is-a-bet-replier-side-not-parent` + `tests/server/comments/no-position.test.ts::exited-user-prior-comments-remain` (freeze-trigger assertion is DEBATE.3 / `I-SIDE-BIND-001`) |
| 2.2 Dharma non-transferable (INV-2) | no | `place()` writes a `bet_stake` `dharma_ledger` row via the built ledger path; no transfer surface introduced. Untouched. | n/a (covered by ENGINE.12 + `dharma/non-transferable`) |
| 2.4 Resolutions append-only (INV-4) | no | No resolution surface touched. | n/a |

**Critical-path failure modes (CLAUDE.md §1):**
- **INV-1, if the `comment_requires_bet` frontstop or the single-tx wrapper is missing/regressed:** a bet could commit without (or before) its comment, or a refactor could split the two inserts across transactions — silent thesis corruption (a bet with no argument), recoverable only by replay from a clean snapshot. The atomicity rollback tests + the API-frontstop test are the guards.
- **INV-3, if the reply writes the *parent's* side instead of the *replier's*:** the debate view's Support/Counter aggregation (read-time, ADR-0017) inverts — a Counter reply would be counted as Support, corrupting the K·n>C signal and the public dataset. The `reply-is-a-bet-replier-side-not-parent` assertion is the guard.

---

## 2. Data model changes

**None — the `comments` table already exists** (`src/db/schema/comments.ts`, created in `0001_initial_schema.sql`); `bets.comment_id NOT NULL FK` is built. **No migration, no new index, no enum change, no new event type.** (`comment.placed` payload already accepts non-null `uploadId` + `parentCommentId` — `src/server/events/schemas.ts:241`.)

**Call A — `stake_at_post_time` (ADR-0009-dead column) — operator-ratified "0".** Verified at plan time: `comments.stake_at_post_time` is `numeric(38,18) NOT NULL` with **no DB DEFAULT** (`0001_initial_schema.sql:134`; schema `.notNull()` with no `.default()`). Per Call A branch "NO": the comment insert writes a **documented placeholder `"0"`** with a `// vestigial: ADR-0009-dead, dropped DEBATE.8/9` comment. **Never read** (ADR-0017 ranking reads `comments` + `bets` only — re-confirmed SPEC.2 §5 / ADR-0017 Flow-table line 402: "no new frozen column required ... unlike ADR-0009's `stake_at_post_time`, which this model does not need"). This is a **deliberate 1-line change** to the current scaffolding, which writes `stakeAtPostTime: stake` (`place.ts:118`). **Ruling 1 (ratified):** the "leave the existing stake" alternative is **DECLINED** — a live duplicate of an authoritative value can drift and misleads readers into trusting a dead column; write `"0"`. (Safe: all `stakeAtPostTime` test references are fixture inserts with explicit values, not assertions on `place()`'s output.)

---

## 3. API surface

> **STEP-A ground truth (moderation seam, verified on `main` @ `c6dffa6`).** `precommitModerate` (`src/server/moderation/precommit.ts:61`) **already accepts an `imageR2Key` argument and classifies images today** — it mints a 60s signed read URL and calls `moderate({ text, imageUrl })`, which sends **multimodal** input (`text` + `image_url`) to the OpenAI `omni-moderation` snapshot (`openai.ts:80-91`) and maps `sexual/minors`+image → `track_a`. **The multimodal classifier *primitive* is built (SCAFFOLD.15/16), not deferred.** What is NOT wired today: the place **route** passes the comment's image into that seam (route.ts:51-56 is text-only), and the Track A/B/C **consequences** (DEBATE.7). PhotoDNA hash-match is a parked pre-launch operator gate (`ENGINE-phase-record.md:123`).

### DEBATE.1 — the INV-1 frontstop (no new route)
`POST /api/bets/place` already requires `body: z.string().min(1)`. DEBATE.1 makes the "bet with no comment" rejection a **named, testable** code:
- **`comment_requires_bet` (400)** — new `BetProductError`. Fires when a place request is not a complete atomic bet+comment pair (body absent/empty). This is the API surface of bet→comment; comment→bet is structural (there is no comment-only endpoint — confirmed: no `/api/comments` route exists).

### DEBATE.2 — un-fence the reply + image branches of `place`
**`POST /api/bets/place`** — extend `placeBodySchema`:
```ts
const placeBodySchema = z.object({
  marketId: z.string().uuid(),
  side: z.enum(["YES", "NO"]),
  stake: numericString,
  body: z.string().min(1),
  parentCommentId: z.string().uuid().nullable().optional(),   // un-fenced (was hardcoded null)
  imageUploadsId: z.string().uuid().optional(),               // F-COMMENT-3
});
```
Route tail (order is load-bearing — all pre-tx, ADR-0014 moderate-first):
1. zod parse → `comment_requires_bet` if body empty; `comment_too_long` (built) if `> COMMENT_MAX_LENGTH` (5000).
2. **reply validation** (`comments/` layer, pre-tx; reads immutable append-only `comments`) when `parentCommentId` set → `parent_comment_not_found` / `reply_depth_exceeded`.
3. **image resolve** (`comments/` layer, pre-tx) when `imageUploadsId` set → resolve `image_uploads.r2_object_key`, assert ownership (`user_id` matches), return the `r2ObjectKey`.
4. `assertStakeFloor({ parentCommentId, stake })` — **reply floor 50** when set, post floor 10 otherwise (built selector, `floors.ts`).
5. `precommitModerate({ text: body, imageR2Key?, ... })` — pre-tx (built; **already image-capable**). DEBATE.2's only image-moderation change is **passing the resolved `r2ObjectKey` as `imageR2Key`** into this existing call. `track_a`→400, `track_b`→423 (built); the bet+comment tx **never opens** on a block (F-MOD-4 by construction).
6. `runBetTransaction({ marketId, flow: parentCommentId ? "F-COMMENT-2" : "F-BET-1" }, place(... parentCommentId, imageUploadsId ...))`.

**Response:** `{ betId, commentId, side, sharesBought, newPrice, parentCommentId? }` (F-COMMENT-1/2/3 — superset of the existing post response). **Auth:** authenticated participant (built `runBetEndpoint` prefix: origin → auth+ban → idem → rate-limit). **Rate-limit:** the bet bucket (`BET_ATTEMPTS_PER_IP_PER_MIN`) — replies are bets (SPEC.1 §8); no separate comment budget.

**Image-attach completion (in-tx, DEBATE.2).** On PASS, `place()` links `imageUploadsId` into `comments.image_uploads_id`, sets `comment.placed.uploadId` (was hardcoded `null`), and emits `image_upload.committed` (`{ uploadId, userId, commentId, key }`) to mark the upload non-orphan. (The `image_upload.blocked` audit event + ban/queue/`mod_actions` on a block are **DEBATE.7**, not here — see §8.)

### New errors (in `src/server/bets/errors.ts`, as `BetProductError` so `toWireError` maps them; codes added to `docs/specs/error-codes.md` same-commit)
| Code | HTTP | Flow | Trigger |
|---|---|---|---|
| `comment_requires_bet` | 400 | F-COMMENT-5 / DEBATE.1 | place request missing a comment body (not a valid atomic pair) |
| `reply_depth_exceeded` | 400 | F-COMMENT-2 | `parentCommentId` references a comment whose own `parent_comment_id` is non-null (`REPLY_DEPTH_MAX = 1`) |
| `parent_comment_not_found` | 404 | F-COMMENT-2 | parent absent **or** in a different market |

> **`no_position_no_voice` (403)** — SPEC.1 §8 F-COMMENT-5 names it a **"legacy alias for the zero-position case."** Under reply-as-bet a zero-position user simply places an *entry* bet, so the 403 **never fires as a hard block**; it is **not implemented** as a separate enforcement. Documented as superseded; the `comment-requires-bet` + `exited-user-prior-comments-remain` tests cover the live behavior. (Self-critique #2 records the directional-naming nuance.)

### The single-side × Counter **foreclosure read surface** (Open Item 1; ruling 1a, forward-contract §6)
New pure fn + thin reader in `src/server/comments/foreclosure.ts` — **data contract only, NO render** (UI = DESIGN.5 / DEBATE.4):
```ts
type Affordance = "allowed" | "foreclosed";
interface ReplyAffordance {
  support: Affordance;   // a reply on the parent's frozen side P
  counter: Affordance;   // a reply on ¬P
  reason: string | null; // why-foreclosed, for disable-and-explain; null when both allowed
}
// pure: P = parent.side_at_post_time, H = viewer held side ("YES"|"NO"|null)
computeReplyAffordance(P, H): ReplyAffordance
// thin wrapper: reads H via heldSideOrNull (ENGINE.11), P from the parent comment
readReplyAffordance(client, { viewerId, parentComment }): Promise<ReplyAffordance>
```
**Truth table (encoded):** Support targets side `P`; Counter targets side `¬P`.
| Viewer held `H` | `support` | `counter` | rationale |
|---|---|---|---|
| `H == P` | allowed | **foreclosed** | Counter would bet `¬P ≠ H` → F-BET-10 |
| `H == ¬P` | **foreclosed** | allowed | Support would bet `P ≠ H` → F-BET-10 |
| `H == none` | allowed | allowed | each is an entry bet on its own side |

The **write-path** enforcement of this is the existing **F-BET-10** `opposite_side_held` (400) check inside `place()` (`place.ts:69`) — already built. DEBATE.2 adds only the read contract.

### Files
**New** (`src/server/comments/`, greenfield): `reply-validate.ts` (parent existence + same-market + depth-1), `foreclosure.ts` (above), `image-attach.ts` (resolve + ownership → `{ uploadId, r2ObjectKey }`).
**Modified:** `src/app/api/bets/place/route.ts` (un-fence + new pre-tx steps), `src/server/bets/place.ts` (thread `imageUploadsId` → `comments.image_uploads_id` + `comment.placed.uploadId`; emit `image_upload.committed` in-tx when an image is attached; `stakeAtPostTime: "0"` per Call A), `src/server/bets/errors.ts` (+3 classes + `toWireError`), `src/server/config/limits.ts` (`REPLY_DEPTH_MAX = 1`), `docs/specs/error-codes.md` (+3 codes).

---

## 4. UI / user flow

**None — backend-only.** The `ReplyAffordance` shape is a **read contract** that feeds DESIGN.5 (the disable-and-explain lock-checklist item) and DEBATE.4 (debate-view render). DEBATE.2 ships the computation + unit tests; no component, no route render, no Support/Counter button. (Per the memory `feedback_middleware_same_commit_codify`: this cross-cutting engine→debate read contract should land a paired **SPEC.2 amendment** codifying `ReplyAffordance` so DEBATE.4 builds against a load-bearing contract — see "ADRs / SPEC amendments needed".)

---

## 5. Failure modes

| Failure | Detect | Recover |
|---|---|---|
| Comment insert throws after bet insert (or vice-versa) | tx error → Sentry | Full W-1 rollback — neither persists (INV-1). Tested both directions. |
| Concurrent replies to the same market (same pool row) | n/a (expected) | W-1 locks the pool `FOR NO KEY UPDATE`; serialization conflicts retry on 40001/40P01 (built spine). No new concern. |
| Moderation provider down / terminal error | `ModerationUnavailableError` → 503 (fail-closed, ADR-0014) | Tx never opens; client retries; Redis reservation auto-expires (10s). |
| In-flight duplicate (same idem key mid-moderation) | `ModerationInFlightError` → 409 | Reservation SETNX; retry after TTL. |
| Parent comment not yet committed / absent / cross-market | pre-tx read miss → `parent_comment_not_found` 404; FK check at commit is the backstop | No torn state — the reply tx fails closed. |
| Image attached but tx rolls back | `image_upload.committed` not emitted | Upload stays orphan → reaped by the `r2-orphan-sweep` cron. **Verify** the sweep's committed-detection contract before relying on it (edge below). |
| Image not owned by requester / bad key shape | `image-attach` ownership check + `precommitModerate`'s `u/${userId}/` namespace gate | Reject pre-tx (no cross-user image disclosure). |

---

## 6. Edge cases

- **Zero-position reply-as-entry** — replier holds nothing → the reply is their **entry** bet on the chosen side (clears the **50** reply floor); `side_at_post_time` = chosen side. Allowed. *(Test: `reply.test.ts`.)*
- **Depth-1 violation** — `parentCommentId` points at a comment that is itself a reply (`parent_comment_id` non-null) → **`reply_depth_exceeded` 400** (pre-tx; parent's depth is immutable, race-free). *(Test: `reply.test.ts`.)*
- **Parent in a different market** — parent exists but `parent.market_id ≠ marketId` → **`parent_comment_not_found` 404**. *(Test: `reply.test.ts`.)*
- **Opposite-side held on a reply** — replier holds `¬(chosen side)` → **`opposite_side_held` 400** (F-BET-10, in-tx, built). The `ReplyAffordance` read marks that side foreclosed *before* submit.
- **Below reply floor** — stake `< 50` on a reply → **`below_reply_floor` 400** (built selector). A stake clearing the *post* floor (10) but not the reply floor (50) is rejected.
- **Exited-to-zero re-comment** — a user who sold to zero may post/reply again via a **fresh entry bet**; their prior comments **remain** (append-only, never touched). The **Exited marker** rendering is **DEBATE.5 (out of scope)** — DEBATE.2 only asserts re-entry works + prior comments persist. *(Test: `no-position.test.ts::exited-user-prior-comments-remain`.)*
- **Image moderation block** — moderation is **pre-tx** through the **already-image-capable** `precommitModerate`, so a Track-A/B image means the tx **never opens** (F-MOD-4 atomicity *by construction*; there is no in-transaction image moderation). DEBATE.2 only *routes* the resolved image key into the seam and *respects* the verdict — it does **not** own the classifier backend (already built) or the block **consequences** (DEBATE.7). *(Test: `media.test.ts::image-moderation-routes`, **verdict mocked** — see §7.)*
- **Empty body** — `comment_requires_bet` 400 (DEBATE.1 frontstop). *(Test: `no-position.test.ts::comment-requires-bet`.)*

---

## 7. Test plan

> **NOTE — carry forward verbatim to the execute chat (ruling 2):** *SPEC.1 §8 is canonical for F-COMMENT-1…5; the `docs/specs/flows/F-COMMENT-{4,5,6}.md` flow skeletons are STALE — ignore them.* (They mislabel F-COMMENT-4/5 as edit/delete and F-COMMENT-6 as friendly-fire; the skeleton reconciliation is a deferred web-authored SYNC doc-sweep, not this PR.)

**Test-path reconciliation (kickoff requirement).** SPEC.1 §8 names `tests/server/comments/{direct,reply,media,validation,no-position}.test.ts` — these **are** the repo's server-layer paths (`tests/server/<domain>/`, per the ENGINE.15 route-handler-test precedent); no divergence from the house layout. Pure functions go to `tests/unit/comments/`. The template's `tests/e2e/` row is **N/A** (no Playwright). SPEC.1 §5 INV names `tests/server/bets/atomicity.test.ts` (DEBATE.1 extends; exists) and `tests/server/comments/side-frozen.test.ts` (the freeze — **DEBATE.3**, not here).

| Layer | Scenarios | Invariants |
|---|---|---|
| **Unit** (`tests/unit/comments/foreclosure.test.ts`) | `computeReplyAffordance` truth table — all three `H` cases × both `P` values; reason text present iff foreclosed | INV-3 (side semantics) |
| **Server** (`tests/server/comments/`) | `direct.test.ts::additional-argument-is-a-post-bet` (F-COMMENT-1) · `reply.test.ts::reply-is-a-bet-replier-side-not-parent` + `::reply-floor-enforced` + depth/cross-market/opposite-side rejects (F-COMMENT-2) · `media.test.ts::image-moderation-routes` (F-COMMENT-3, **verdict mocked**) · `validation.test.ts::length-limit` (F-COMMENT-4) · `no-position.test.ts::comment-requires-bet` + `::exited-user-prior-comments-remain` (F-COMMENT-5) | INV-1, INV-3 |
| **Server / invariant** (DEBATE.1) | `tests/server/bets/atomicity.test.ts` — extend with `rejects API calls missing the comment with 400 comment_requires_bet` + the **construction** assertion (every persisted comment has a bet whose `comment_id` references it; no comment-only write path) · `tests/invariants/I-ATOMICITY-001` — shared w/ ENGINE.7, extend for the comment→bet construction direction | INV-1 |
| Integration (`tests/integration/`) | covered by the server-layer tests above against real Postgres (the W-1 spine writes the full bet+comment+ledger+events+pool); no new dedicated integration file required beyond them | INV-1 |
| E2E | N/A — no Playwright | — |

**`media.test.ts` mock contract (ruling 3).** The image test asserts the **wiring + verdict-respect**, not classifier accuracy: (a) when `imageUploadsId` is set, the route resolves it and calls `precommitModerate` with the resolved `imageR2Key` (image is **ROUTED** to the seam); (b) a **mocked** `track_a`/`track_b` verdict ⇒ the bet+comment tx **never opens** (no comment, no bet, no `image_upload.committed`); (c) a **mocked** `pass` ⇒ the image links into the comment + `image_upload.committed` emits. **The real multimodal classifier is NOT exercised** (no live OpenAI call — consistent with the built `precommit-moderate.integration` + `_probe-openai-omni-shape` mocking pattern); classifier behavior + thresholds are the vendor's job and pin at HARDEN.5, and the Track A/B/C **consequences** are DEBATE.7.

**Every "touched" invariant has ≥1 assertion:** INV-1 → atomicity.test.ts + I-ATOMICITY-001 + no-position; INV-3 → reply.test.ts + foreclosure unit. ✓

---

## 8. Out of scope

- **DEBATE.4** — debate-view render / Support/Counter display (DESIGN.5-gated). DEBATE.2 ships only the `ReplyAffordance` read contract.
- **DEBATE.7** — moderation Track A/B/C **consequence** wiring (auto-ban, mod queue, `mod_actions`, legal report, the `image_upload.blocked` audit event). **The multimodal image classifier *primitive* is already built (SCAFFOLD.15/16) — NOT a DEBATE.7 item;** DEBATE.2 *routes* a comment's image into that existing seam and *respects* the verdict. DEBATE.2 wires neither the classifier backend nor the consequences. PhotoDNA second-vendor / CSAM hash-match is a **parked** pre-launch operator gate (`ENGINE-phase-record.md:123`).
- **DEBATE.3** — the BEFORE-UPDATE side-freeze trigger. DEBATE.2 **sets** `side_at_post_time`; DEBATE.3 **freezes** it.
- **DEBATE.5** — In/Flipped/**Exited** marker computation.
- **DEBATE.8** — ranking + `RANKING.md`.
- **DEBATE.9** — `friendly_fire_events` drop + `stake_at_post_time` drop + `comments.bet_id` → NOT NULL reconciliation. **Do not touch these vestigial artifacts here.**
- Real market content (questions/criteria) · the reply-as-bet **LOAD/k6** test (post-DEBATE.2 stratum, forward-contract §6) · **any new table, migration, or event type.**

---

## Open questions

- **Q:** The `docs/specs/flows/F-COMMENT-{4,5,6}.md` skeletons are mislabeled vs canonical SPEC.1 §8 — `F-COMMENT-4.md` says "comment edit (STRUCK)", `F-COMMENT-5.md` "comment delete (STRUCK)", `F-COMMENT-6.md` "friendly-fire upvote (skeleton)", whereas SPEC.1 §8 defines F-COMMENT-4 = length-limit, F-COMMENT-5 = no-stake-no-voice, and §8's footnote **removes** F-COMMENT-6/7/8.
  - **Resolution (ruling 2):** **DEFERRED to a SYNC doc-sweep (web-authored). SPEC.1 §8 governs; the skeletons are stale.** Not touched in this critical-path PR — spec-class docs are web-authored, not CC-patched mid-build, and nothing builds wrong because SPEC.1 §8 is canonical by precedence.
- **Q:** `comment_requires_bet` directional naming — DEBATE.1 frames it "bet without comment", SPEC.1 §8 F-COMMENT-5 frames it "comment without bet". The unified single-endpoint architecture collapses both into "not a valid atomic pair."
  - **Candidate:** One code, defined as "the place request is not a complete bet+comment pair" (body-missing branch is the live trigger; the comment-only direction is structurally impossible — no comment endpoint). Documented in the code + error-codes.md.
  - **Resolve with:** this plan §3 (accepted unless web review objects).

## ADRs / SPEC amendments needed

- **No new ADR** — DEBATE.2 is fully governed by **ADR-0013** (W-1 path), **ADR-0014** (pre-commit moderate-first), **ADR-0017** (reply-as-bet / read-time Support-Counter / `REPLY_DEPTH_MAX=1`), **ADR-0018** (reply floor 50 > post floor). The new error codes, the `REPLY_DEPTH_MAX` constant, and the foreclosure shape are *implementations* of these, not new decisions.
- **SPEC amendment (same-commit):** codify the `ReplyAffordance` read shape in SPEC.2 (the engine→debate foreclosure contract) so DEBATE.4 consumes a load-bearing contract, not an undocumented one (per `feedback_middleware_same_commit_codify`). Add the 3 new error codes to `docs/specs/error-codes.md`.

---

## Execute-phase ritual (critical-path — for the fresh execute chat)

1. **`@test-writer`** (Phase 2 start) — FAILING tests first against §7, passing `@docs/plans/DEBATE.2.md`. Never edits `src/`.
2. Implement in scope → green.
3. `@db-migration-reviewer` — **confirms NO migration** (sanity only — schema unchanged).
4. `@code-reviewer` — diff under `src/server/` vs §2/§3, stack patterns.
5. `@security-auditor` — the moderation seam (incl. the image key resolution + `u/${userId}/` namespace gate) + INV-1/INV-3 + the foreclosure/F-BET-10 single-side enforcement.
6. `ZUGZWANG_ENV=preview just verify` (tsc → biome → build) → `pnpm test:invariants` + `pnpm test:integration` + the new `tests/server/comments/` → **full-suite `pnpm vitest run`** (the EVENT_TYPES-inventory cross-suite floor — `project_full_suite_vitest_final_pre_pr_gate`).
7. **Pre-PR self-audit** (§5.10) item-by-item vs this plan.
8. PR → 24h soak before merge (critical-path).

---

## References

- `CLAUDE.md` §1–§3 · `AGENTS.md` §6/§9
- `docs/specs/SPEC.1.md` §5 (INV-1/INV-3), §7 (F-BET-1/2/10), **§8 (F-COMMENT-1…5 — CANONICAL; the `flows/F-COMMENT-{4,5,6}.md` skeletons are STALE, ignore)**, §10.9 (floors), §14 (F-MOD-4)
- `docs/specs/SPEC.2.md` §5 (comments/bets), ADR-0017 Flow-table line 402
- `docs/logs/ENGINE-phase-record.md` §2 (forward contract), §6 (ruling 1a foreclosure; reply-as-bet LOAD deferral; line 123 DEBATE.7/PhotoDNA), §7 (governing ADRs)
- ADR-0013, ADR-0014, ADR-0017, ADR-0018
- Built scaffolding: `src/server/bets/{place,floors,transaction,errors}.ts`, `src/server/moderation/{precommit,openai}.ts`, `src/server/positions/read.ts`, `src/server/storage/sign-upload.ts`, `src/db/schema/comments.ts`, `src/app/api/bets/place/route.ts`
- Tracker: DEBATE.1, DEBATE.2 (rows above)

---

## Self-critique (after Phase 1 self-review)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | high | Scope-creep risk in the foreclosure read fn (could balloon into render/route work that belongs to DEBATE.4). | Bounded in §3/§4: a pure fn + one thin positions-read wrapper + unit tests only — no route, no component. Forward-contract §6 assigns the *read surface* to DEBATE.2; UI to DESIGN.5/DEBATE.4. Accepted as scoped. |
| 2 | medium | `comment_requires_bet` directional ambiguity — DEBATE.1 ("bet w/o comment") vs SPEC.1 §8 F-COMMENT-5 ("comment w/o bet") use one code for opposite directions. | §3 + Open Q: one code = "not a complete atomic bet+comment pair"; live trigger is the body-missing branch; the comment-only direction is structurally impossible. Flagged for web review. |
| 3 | medium | Call A changes a built file's behavior (`place.ts:118` `stake` → `"0"`) on a critical path — risks a "while we're here" smell. | **Operator-ratified "0" (ruling 1).** The "leave existing stake" alternative is DECLINED — a live duplicate of an authoritative value drifts and misleads readers into trusting a dead column. Verified safe: no test asserts `place()`'s written `stakeAtPostTime` (all references are fixture inserts). Single line + `// vestigial` comment. |
| 4 | medium | Flow-skeleton drift (`F-COMMENT-4/5/6.md` mislabeled vs SPEC.1 §8) could mislead a future reader or the execute chat. | **Deferred (ruling 2)** to a web-authored SYNC doc-sweep; SPEC.1 §8 governs by precedence; the §7 NOTE + References call-out carry the warning across the chat boundary. Does not block execution. |
| 5 | low | Image `image_upload.committed` emission + orphan-sweep contract asserted but not verified against the cron's committed-detection logic. | Flagged in §5/§6 as a verify-before-relying item for the execute chat; the orphan path fails safe (an un-emitted committed event only over-reaps an un-attached image, never a committed one). |
| 6 | low | `REPLY_DEPTH_MAX` introduced as a code constant where none existed. | Adding the named constant (matches `BET_MIN_STAKE_*` + the spec/ADR vocabulary) is the legible choice; the depth-1 check reads it. Accepted. |
| 7 | low | DEBATE.1 + DEBATE.2 co-execute but are separate P0 rows; a reviewer could lose the per-row independently-checkable exit. | §1/§3/§7 keep DEBATE.1's exits (frontstop code + bidirectional construction test + shared I-ATOMICITY-001) separable from DEBATE.2's (F-COMMENT-1…5 + foreclosure). The execute chat tags commits by row. |
| 8 | low | STEP-A correction: the ratify ruling assumed the multimodal classifier is wired at DEBATE.7, but the primitive is already built (SCAFFOLD.15/16). A plan written to the ruling's premise would have over-scoped DEBATE.2 (a classifier extension that isn't needed). | Corrected in §3 (STEP-A note), §6, §8, §7: DEBATE.2's image scope is *route-wiring the resolved key into the existing image-capable seam* + respecting the verdict; the classifier backend is already built and the consequences are DEBATE.7. Reported to the operator/web for the .2/.7 boundary check. |

*No high finding remains unresolved after this pass. Checked: invariant coverage (INV-1/INV-3 each mapped to ≥1 assertion), scope discipline (no schema/migration/event-type/route additions; vestigial artifacts untouched), test-assertion completeness, edge-case enumeration, the .2/.7 image boundary, and source-of-truth precedence (spec > flow-skeleton > kickoff).*
