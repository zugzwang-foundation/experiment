// Per SPEC.1 §16.1 (operational floor constants) + SPEC.2 §11 ¶"Per-
// surface rate-limit table" + ADR-0015 D6/D7. Five numeric placeholders
// consumed by `src/server/middleware/rate-limit.ts` to instantiate the
// six sliding-window Ratelimit surfaces. HARDEN.5 owns the real-value
// tuning pass; SCAFFOLD.4 ships conservative anti-abuse defaults so the
// substrate is operationally testable end-to-end before HARDEN.* lands.
//
// Per SCAFFOLD.4 plan §F4 + plan-Q5 carve-out: PLACEHOLDER VALUES — name
// each constant's intended HARDEN.5 source in its JSDoc so a future reader
// who finds a 5 looks up §16.1 / §19 Q4/Q16 / ADR-0010 / ADR-0015 for the
// real cap rather than treating these as production numbers.
//
// SCAFFOLD.15 additions follow the rate-limit block: R2 storage TTLs +
// MIME whitelist + ext mapping + byte cap, orphan-sweep tuning, OpenAI
// moderation constants. These are SPEC-ratified (not placeholder) per
// SCAFFOLD.15 Q2/Q3/Q5/Q6/Q7 + SPEC.2 §10.10 + §12.3 + §12.6 amendments.
// JSDoc per-constant cites the ratification source for greppability.

/** Per-email OTP request cap (anti-spam / anti-bot). PLACEHOLDER VALUE — tuned by HARDEN.5 per SPEC.1 §16.1 + §19 Q4/Q16. */
export const OTP_REQUESTS_PER_EMAIL_PER_HOUR = 5;

/** Per-IP OTP request burst cap. PLACEHOLDER VALUE — tuned by HARDEN.5 per SPEC.1 §16.1 + §19 Q4/Q16. */
export const OTP_REQUESTS_PER_IP_BURST_PER_MIN = 10;

/** Per-IP rate limit on /admin/login POST attempts. PLACEHOLDER VALUE — tuned by HARDEN.5 per SPEC.1 §16.1 + ADR-0010. */
export const ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR = 10;

/** Per-IP anti-abuse burst cap on bet place/sell. PLACEHOLDER VALUE — tuned by HARDEN.5 per SPEC.1 §16.1 + ADR-0015 D7. */
export const BET_ATTEMPTS_PER_IP_PER_MIN = 30;

/** Per-IP anti-abuse burst cap on R2 signed-PUT URL mint. PLACEHOLDER VALUE — tuned by HARDEN.5 per SPEC.1 §16.1 + ADR-0015 D7. */
export const IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN = 10;

// === SCAFFOLD.15: R2 storage substrate + moderation pipeline constants ====

/** Signed-PUT URL TTL. Ratified at SCAFFOLD.15 Q2 + SPEC.2 §12.3 — long enough for `pick file → review → submit` (~30s typical), short enough to bound exfiltrated-URL exposure. NOT a HARDEN.5-tuned placeholder. */
export const PUT_URL_TTL_SECONDS = 60;

/** Signed-READ URL TTL for moderation hop. Per SCAFFOLD.15 Q3 + SPEC.2 §10.10 — 60s spans OpenAI's 3s call + 1 retry + slack. Discarded after the call returns; never flows to client. */
export const READ_URL_TTL_SECONDS_MODERATION = 60;

// READ_URL_TTL_SECONDS_RENDER (3600s render-side TTL per SCAFFOLD.15 Q3) is
// documented but NOT exported — SCAFFOLD.15 doesn't ship a render-side
// caller; DEBATE.4 adds the constant + caller together when the render path
// lands. Pre-declaring an unused constant would invite drift.

/** Image upload byte cap (8 MiB). Ratified at SCAFFOLD.15 Q6 + SPEC.2 §12.3 + 0006 CHECK constraint. Mirrored in `image_uploads.byte_size <= 8388608` SQL CHECK. */
export const IMAGE_UPLOADS_MAX_BYTES = 8 * 1024 * 1024;

/** Allowed image MIME whitelist. Per SCAFFOLD.15 Q5 — SVG excluded (XSS surface); HEIC/HEIF excluded (vendor moderation coverage gap). Whitelist (not blacklist) is the load-bearing pattern. */
export const IMAGE_UPLOADS_ALLOWED_MIME = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"image/avif",
] as const;

/** Canonical lowercase ext per MIME for the `u/{user_id}/{image_uploads_id}.{ext}` object-key shape per SCAFFOLD.15 Q9 + SPEC.2 §12.9. JPEG canonicalises to `jpg` (not `jpeg`) to match common CDN convention + Cloudflare R2 cache-key normalisation. */
export const IMAGE_UPLOADS_EXT_BY_MIME: Readonly<
	Record<(typeof IMAGE_UPLOADS_ALLOWED_MIME)[number], string>
> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/avif": "avif",
};

/** Orphan-sweep candidate window — only image_uploads rows older than 120 minutes with `terminal_state IS NULL` are eligible. Ratified at SCAFFOLD.15 + SPEC.2 §12.6 — 2h spans typical F-COMMENT-3 client orchestration latency + slack. */
export const ORPHAN_WINDOW_MINUTES = 120;

/** Distributed-lock TTL for the orphan-sweep cron. 10 min = 600s — enough for a single sweep run even with R2 retry backoff; expires automatically if the handler crashes without releasing. */
export const ORPHAN_SWEEP_LOCK_TTL_SECONDS = 600;

/** Circuit breaker threshold — N consecutive R2 deleteObject failures aborts the sweep cleanly. Per SCAFFOLD.15 plan §5.6 — prevents a universal R2 outage from burning Vercel function execution budget + Sentry noise. */
export const ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD = 5;

/** Orphan-sweep per-batch SELECT limit. Per SCAFFOLD.15 plan §5.6 — caps the working set per sweep iteration; loop continues until an empty batch returns. Lifted to limits.ts (rather than a route-handler module constant) for SCAFFOLD.5 sweep greppability. */
export const ORPHAN_SWEEP_BATCH_SIZE = 100;

/** OpenAI moderation model snapshot pin. Per SPEC.2 §10 + ADR-0014 — pinning the snapshot guarantees verdict-mapping stability across OpenAI model retunes. OpenAI omni-moderation is the SOLE moderation vendor in experiment phase per SCAFFOLD.16 LD-1; second-vendor deferred per docs/parked.md. */
export const OPENAI_MODERATION_MODEL_SNAPSHOT = "omni-moderation-2024-09-26";

/** OpenAI moderation call timeout (ms). Per SPEC.2 §10.10 — 3s budget for the moderation hop; 1 retry on transient failure makes the effective ceiling ~6s + reservation slack. */
export const OPENAI_TIMEOUT_MS = 3000;

/** OpenAI moderation retry budget. Per SPEC.2 §10.10 — 1 retry on transient (network / timeout / 5xx / 429). 4xx auth failures (401/403) throw without retry. */
export const OPENAI_MAX_RETRIES = 1;

/** Reservation key base segment per SPEC.2 §10.10. Consumed by `getRedisKey(RESERVATION_KEY_BASE, userId, marketId, idempotencyKey)` per SCAFFOLD.8 LD-10 → keys land at `{env}:mod-reserve:{userId}:{marketId}:{idempotencyKey}`. Disjoint from `idem:*` (idempotency-cache), `ratelimit:*`, and `cron-lock:*` segments per the disjointness invariant. */
export const RESERVATION_KEY_BASE = "mod-reserve";

/** Reservation TTL (s). Per SPEC.2 §10.10 — 10s spans the moderation call's worst case + slack. Auto-expires if `precommitModerate` crashes between SET-NX and DEL-in-finally; a retry from the same idempotency key then proceeds cleanly. */
export const RESERVATION_TTL_SECONDS = 10;

// === ENGINE.8: bet stake floors (ADR-0018) + comment length ===============
//
// The two-floor economy per ADR-0018 + SPEC.1 §10.9. `assertStakeFloor`
// (src/server/bets/floors.ts) selects the floor by post-vs-reply. Decimal
// STRINGS (the NUMERIC(38,18) domain) — never JS floats (CLAUDE.md §2).

/** Top-level post-bet minimum stake. PLACEHOLDER VALUE (~10) — tuned by HARDEN.5 per SPEC.1 §16.1 + ADR-0018. Decimal string. */
export const BET_MIN_STAKE_POST = "10";

/** Reply-bet minimum stake — PINNED at 50 (higher than the post floor) per ADR-0018; NOT a HARDEN.5 placeholder. Decimal string. Exercised by DEBATE.2's reply route; ENGINE.8 ships the tested validator. */
export const BET_MIN_STAKE_REPLY = "50";

/** Comment body max length (characters). PLACEHOLDER VALUE — tuned by HARDEN.5 per SPEC.1 §10.9 / §16.1. Step-5 body validation maps length > this to `comment_too_long`. */
export const COMMENT_MAX_LENGTH = 5000;

/** Maximum reply depth — PINNED at 1 (flat replies) per ADR-0017 / SPEC.1 §8 F-COMMENT-2. A reply (a comment with a non-null `parent_comment_id`) cannot itself be replied to; `reply-validate` rejects a parent already at this depth with `reply_depth_exceeded`. Integer, not a decimal string (a count, not Dharma). */
export const REPLY_DEPTH_MAX = 1;

// === ENGINE.12: Daily Credit (ADR-0018 + SPEC.1 §10.4) ====================

/** Flat (non-escalating) Daily Credit, paid once per UTC day only on a day the user places a commented bet (ADR-0018 + SPEC.1 §10.4/§16.1). Use-or-lose. PLACEHOLDER VALUE (~10, ranged) — HARDEN.5 (number-tuning pass, 2026-09-01) owns the value. Decimal string — never a JS float (CLAUDE.md §2). Name adopted from SPEC.1 §16.1. */
export const DAILY_CREDIT_DHARMA = "10";

// === ENGINE.13: Initial grant (ADR-0018 + SPEC.1 §10.1/§16.1) =============

/** Equal initial Dharma grant, paid once per user inside the F-AUTH-4 first-
 * acceptance tx (ADR-0018 Driver 3 — equal for all; differentiation by
 * deployment, not endowment). PLACEHOLDER VALUE (~1,000, ranged 1,000–2,000)
 * — HARDEN.5 (number-tuning pass, 2026-09-01) owns the value. Decimal string
 * — never a JS float (CLAUDE.md §2). Name adopted from SPEC.1 §16.1. */
export const INITIAL_USER_DHARMA = "1000";

// === ENGINE.15: admin form-boundary bounds + close-sweep lock (D-15.f) =====
//
// SA-L-1 ceiling enforcement at the admin form boundary — the lifecycle/
// resolution services validate presence only (`trim() !== ""`, no ceiling), so
// the wire enforces the max-char bound. The three max-char values are
// PLACEHOLDER safety bounds owned by the number-tuning pass (HARDEN); names
// pinned now + registered in SPEC.1 Appendix B (R-15-G). The lock TTL is the
// provisional close-sweep lease, HARDEN-tunable (R-15.2 cadence pass).

/** Admin market title (the question) max length (chars). PLACEHOLDER VALUE — tuned by HARDEN per SPEC.1 §16.1 + R-15-G. SA-L-1 form-boundary ceiling. */
export const MARKET_TITLE_MAX_CHARS = 200;

/** Admin market description (the resolution criterion) max length (chars). PLACEHOLDER VALUE — tuned by HARDEN per SPEC.1 §16.1 + R-15-G. SA-L-1 form-boundary ceiling. */
export const MARKET_DESCRIPTION_MAX_CHARS = 4000;

/** Resolution / correction / void `reason` max length (chars) — the ENGINE.9 R-9.1 mandatory note. PLACEHOLDER VALUE — tuned by HARDEN per SPEC.1 §16.1 + R-15-G. SA-L-1 form-boundary ceiling. */
export const RESOLUTION_REASON_MAX_CHARS = 1000;

/** Distributed-lock TTL (s) for the close-due-markets cron sweep (D-15.g). Provisional 55s — under the per-minute (`* * * * *`) cadence so a crashed sweep's lease expires before the next tick. HARDEN-tunable (R-15.2 cadence pass). */
export const CLOSE_SWEEP_LOCK_TTL_SECONDS = 55;

// === AUDIT-FIX-B1: cron_alarms drain (A7) ==================================

/** Distributed-lock TTL (s) for the alarms-drain cron. 240s — under the every-5-minutes (300s) cadence so a crashed drain's lease expires before the next tick (mirrors CLOSE_SWEEP 55 < 60). HARDEN-tunable. */
export const ALARMS_DRAIN_LOCK_TTL_SECONDS = 240;

/** Alarms-drain per-tick SELECT limit. Leftovers drain next tick — bounded, not silent (the `selected` count returns in the route body). HARDEN-tunable. */
export const ALARMS_DRAIN_BATCH_SIZE = 200;

/** Sentry transport flush budget (ms) for the alarms-drain. The drain awaits `safeFlush(this)` after emitting and BEFORE stamping any row — a delivery timeout (resolve false) or a flush throw retires NOTHING, so the row re-drains next tick (fingerprint dedup absorbs the re-emit). 2000ms spans the SDK HTTP send + slack, far under the 240s lock TTL. Upgrades the drain from enqueue-level to DELIVERY-level at-least-once (B1 close-out ruling). HARDEN-tunable. */
export const ALARMS_DRAIN_FLUSH_TIMEOUT_MS = 2000;

// === AUDIT-FIX-B7a: Upstash transport bounds (A14 / ADR-0015 Patch) ========
//
// Consumed by the shared @upstash/redis singleton (src/server/upstash/
// redis.ts). Without these the SDK defaults to retries ?? 5 (6 fetch
// attempts, exponential backoff ≈4.3s of sleep) and NO timeout of any kind
// — a hung socket rides undici defaults up to the platform function
// timeout, silently contradicting ADR-0015's no-auto-retry posture on
// every call from idempotency, rate-limit, and the moderation reservation.
// Same vendor-transport-bound posture as the OPENAI_* constants above.

/** Upstash transport-level retry budget — a single flat retry (2 fetch attempts total). Application-level no-retry stands (ADR-0015 Patch 2026-07-06 + SPEC.2 §11); B7a OD-1 ratified value. HARDEN-tunable. */
export const REDIS_MAX_RETRIES = 1;

/** Upstash transport retry backoff (ms) — FLAT via `backoff: () => REDIS_RETRY_BACKOFF_MS`, not the vendor's exponential default. Per ADR-0015 Patch 2026-07-06. HARDEN-tunable. */
export const REDIS_RETRY_BACKOFF_MS = 200;

/** Upstash per-command abort ceiling (ms) — `signal: () => AbortSignal.timeout(...)`, minted once per command and covering the vendor's whole internal retry loop. Per ADR-0015 Patch 2026-07-06 + SPEC.2 §11; B7a OD-2 ratified value. HARDEN-tunable. */
export const REDIS_COMMAND_TIMEOUT_MS = 2000;
