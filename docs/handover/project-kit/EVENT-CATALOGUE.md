# EVENT-CATALOGUE.md — the 24 `EVENT_TYPES`

**Dated:** 2026-07-15 · **Pinned to:** `e28d4b6` · **Derived from:**
`src/server/events/schemas.ts` (the closed inventory) + emit-site grep across `src/server/`.

**Contract:** `events.event_type` is **`text`**, not a pgEnum (open extensibility,
SPEC.2 §7.1). The closed value set is the TS const `EVENT_TYPES` (24 values), compile-guarded
by `as const satisfies Record<EventType, …>` — adding a type without its Zod payload schema
fails `tsc`. Money/share/price payload fields are `numericString` (exact NUMERIC(38,18)
decimal strings — never `z.number()`). Every row also carries the 7-field snake_case
`metadata` set (SPEC.2 §3.7: `request_id`, `flow_id`, `user_id?`, `actor_id`,
`idempotency_key?`, `ip`, `user_agent`). There is deliberately **no `payout.*` type** —
per-bet payouts are rows in the `payout_events` *table*, not generic events (SPEC.2 §3.6).

Emit-site pointers are files under `src/server/` at the pin.

---

## `image_upload.*` (4)

| Type | Payload (one line) | Emit site |
|---|---|---|
| `image_upload.sign_requested` | uploadId, userId, contentType, byteSize, key | `storage/sign-upload.ts` |
| `image_upload.committed` | uploadId, userId, commentId, key, etag (nullable forensic ETag), byteSizeActual | `bets/place.ts` |
| `image_upload.blocked` | uploadId, userId, modVerdict, reasonCategory | **schema-only** — no emit site on disk; the image-block consequence rides `mod_actions` + `moderation.blocked` |
| `image_upload.orphaned` | uploadId, key | `storage/sweep-orphans.ts` |

## `user.*` (5)

| Type | Payload | Emit site |
|---|---|---|
| `user.oauth_signed_in` | userId, provider (`"google"`), googleId | `auth/post-commit-events.ts` |
| `user.otp_signed_in` | userId, email | `auth/post-commit-events.ts` |
| `user.pseudonym_assigned` | userId, pseudonym, pfpFilename | `auth/post-commit-events.ts` |
| `user.tos_accepted` | userId, tosVersionHash, privacyVersionHash, ip, userAgent | `auth/tos-accept.ts` |
| `user.signed_out` | userId | `auth/logout.ts` |

## `admin.*` (2)

| Type | Payload | Emit site |
|---|---|---|
| `admin.signed_in` | sessionId, ip | `auth/admin/login.ts` |
| `admin.signed_out` | sessionId | `auth/admin/logout.ts` |

## `market.*` (7 — lifecycle + settlement, all `aggregate_type "market"`)

| Type | Payload | Emit site |
|---|---|---|
| `market.created` | marketId, resolutionDeadline (ISO-8601+offset), media[] (key, displayOrder, isDefault — the at-create manifest, MEDIA.1 OD-2), mediaVideoUrl? | `markets/create.ts` |
| `market.opened` | marketId, seedAmount — the CPMM seed rides *open*, not create (R-14.1) | `markets/open.ts` |
| `market.closed` | marketId | `markets/close.ts` |
| `market.resolving` | marketId **only** — outcome/evidence live on `resolution_events`, never duplicated (R-9.1) | `resolution/trigger.ts` |
| `market.resolved` | marketId, winningSide, resolutionNote, poolUnwindAmount (residual pool Dharma exiting circulation — a payload field, never a ledger row) | `resolution/settle.ts` |
| `market.corrected` | marketId, correctsEventId (→ `resolution_events.id`), correctedWinningSide, resolutionNote | `resolution/correct.ts` |
| `market.voided` | marketId, voidReason, poolUnwindAmount | `resolution/void.ts` |

## `bet.*` (2)

| Type | Payload | Emit site |
|---|---|---|
| `bet.placed` | betId, marketId, userId, side, stake, shares, price, commentId, parentCommentId? (null = top-level post-bet) | `bets/place.ts` |
| `bet.sold` | betId, marketId, userId, side, sharesSold, proceeds, price | `bets/sell.ts` |

## `comment.*` (1)

| Type | Payload | Emit site |
|---|---|---|
| `comment.placed` | commentId, betId, userId, marketId, side, parentCommentId?, bodyLength (chars, not money), uploadId? | `bets/place.ts` |

## `dharma.*` (2)

| Type | Payload | Emit site |
|---|---|---|
| `dharma.credited` | userId, amount, creditedForDate (UTC `YYYY-MM-DD` — the Daily-Credit accrual key) | `dharma/accrual.ts` |
| `dharma.granted` | userId, amount — the one-time genesis grant; deliberately no day key | `dharma/grant.ts` |

## `moderation.*` (1)

| Type | Payload | Emit site |
|---|---|---|
| `moderation.blocked` | userId, reason (`track_a_autoban` \| `track_b_blocked` \| `sexual_minors_text_blocked`), banned, uploadId? — raw `imageR2Key` deliberately excluded (embeds the userId); scores not carried (they live on `mod_actions.categories`) | `moderation/consequences.ts` |

---

**Probe hint:** insertion is idempotent by `event_id` (`ON CONFLICT (event_id, created_at)
DO NOTHING` on the hand-partitioned `events` table); the helper passes metadata through
**without enrichment** (locked behaviorally by the insert probe test). Adding a 25th type
requires the same-commit `EVENT_TYPES` + payload-schema edit (enum-hygiene, AGENTS.md §6).

*EXTAUDIT-06 kit · file 7 of 7.*
