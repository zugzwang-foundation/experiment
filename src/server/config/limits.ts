// Per SPEC.1 §16.1 (operational floor constants) + SPEC.2 §11 ¶"Per-
// surface rate-limit table" + ADR-0015 D6/D7. Seven numeric placeholders
// consumed by `src/server/middleware/rate-limit.ts` to instantiate the
// seven sliding-window Ratelimit surfaces. HARDEN.5 owns the real-value
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

/** Per-user, per-market write cap (shared by comments / replies / image-comments / friendly-fire). PLACEHOLDER VALUE — tuned by HARDEN.5 per SPEC.1 §16.1 + §19 Q4. */
export const RATE_LIMIT_PER_MARKET_PER_DAY = 50;

/** Per-user write burst cap (shared with the per-market budget). PLACEHOLDER VALUE — tuned by HARDEN.5 per SPEC.1 §16.1. */
export const RATE_LIMIT_BURST_PER_MIN = 5;

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
