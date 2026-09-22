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

/**
 * Per-ACCOUNT write cap on bet place/sell — the fairness control, and the one
 * that fires in normal operation. Per ADR-0054: a bet endpoint is reachable
 * only behind a session, so the account is the identity the product actually
 * bills the write to, and one participant may not out-post the room whichever
 * address they arrive from. Carries the value `BET_ATTEMPTS_PER_IP_PER_MIN`
 * held before ADR-0054, because the number was always meant as "how fast may
 * one person write" — it was the KEY that was wrong, not the figure.
 */
export const BET_ATTEMPTS_PER_USER_PER_MIN = 30;

/**
 * Per-IP anti-abuse BACKSTOP on bet place/sell — deliberately loose, and no
 * longer the fairness control (ADR-0054 moved that to the per-account cap
 * above). It exists so one machine cannot hammer the endpoint across many
 * accounts, which is the credential-stuffing threat SPEC.2 §11 names.
 *
 * ⚠ 10x the per-account cap is the whole design, not a round number: below ten
 * accounts sharing an address it can never fire FIRST, so a NAT — an office, a
 * campus, a carrier — reaches the per-account cap it should reach rather than
 * an address-shaped one it cannot see or explain. Above that it bounds a single
 * machine at 5 writes/second, which the bet path's SERIALIZABLE pool-row lock
 * already answers for.
 *
 * PLACEHOLDER VALUE — tuned by HARDEN.5 per SPEC.1 §16.1 + ADR-0015 D7.
 */
export const BET_ATTEMPTS_PER_IP_PER_MIN = 300;

/** Per-IP anti-abuse burst cap on R2 signed-PUT URL mint. PLACEHOLDER VALUE — tuned by HARDEN.5 per SPEC.1 §16.1 + ADR-0015 D7. */
export const IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN = 10;

// === SCAFFOLD.15: R2 storage substrate + moderation pipeline constants ====

/** Signed-PUT URL TTL. Ratified at SCAFFOLD.15 Q2 + SPEC.2 §12.3 — long enough for `pick file → review → submit` (~30s typical), short enough to bound exfiltrated-URL exposure. NOT a HARDEN.5-tuned placeholder. */
export const PUT_URL_TTL_SECONDS = 60;

/** Signed-READ URL TTL for moderation hop. Per SCAFFOLD.15 Q3 + SPEC.2 §10.10 — 60s spans OpenAI's 3s call + 1 retry + slack. Discarded after the call returns; never flows to client. */
export const READ_URL_TTL_SECONDS_MODERATION = 60;

/**
 * `Cache-Control` served with a rendered image, applied at SERVE time via the
 * presigned URL's `response-cache-control` parameter rather than stored on the
 * object.
 *
 * ⚠ WHY SERVE TIME AND NOT UPLOAD TIME, because upload time is the obvious
 * answer and it is the wrong one here. A header written at upload only ever
 * describes objects uploaded AFTER the change; every object already in the
 * bucket keeps whatever it was born with, and the only remedy is a backfill.
 * That was measured rather than reasoned: a backfill of the `uploads` arm on
 * 2026-09-04 left 41/41 objects correct, and within three hours 204 new objects
 * had arrived uncacheable, because nothing in the upload path sets the header.
 * A fix that decays in an afternoon is a cleanup, not a fix.
 *
 * Serving it instead makes the question moot — past and future objects are
 * covered by the same line, and no bucket ever needs touching again.
 *
 * ⚠ IT IS SIGNED, WHICH IS WHY IT IS SAFE. `response-cache-control` is a QUERY
 * PARAMETER, so it falls under the SigV4 signature; a client that edits it gets
 * 403 rather than a URL that serves with its own caching policy (measured).
 * Contrast the upload direction, where `CacheControl` on a presigned PUT is
 * INERT — `X-Amz-SignedHeaders` there is `host` alone, so the header has to come
 * from the client, which in turn needs `cache-control` on the bucket's CORS
 * allow-list. That asymmetry is the whole reason this direction is cheaper.
 *
 * `immutable` is honest here because keys are minted per upload and never
 * reused, so a given URL's bytes genuinely cannot change. ⚠ A future
 * replace-image feature that REUSES a key would break that promise and must
 * change this constant, not work around it.
 */
export const RENDER_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

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

/** Per-bet maximum stake (SPEC.1 §16.1 / F-BET-9 clamp rider — UI.A2). Buy/add
 * stake strictly above this CLAMPS to it before the CPMM computation (clamp ≠
 * reject; no error code); sell is NEVER clamped. Enforced by `clampStakeToMax`
 * (src/server/bets/floors.ts) at the place route's step 5d ONLY — the constant
 * never enters src/server/cpmm/ (cpmm.md 2.1.0 §13: app-layer guard, the pure
 * functions stay pure).
 *
 * ⚠ **PINNED at 250 by ADR-0047 — no longer a HARDEN.5 placeholder.** It was
 * `"10000"` (ratified UI-A2 OQ-1 as 10× the initial grant, "economically inert
 * by design") until LIQ-1 Phase 2. The ADR's constants table calls this "the ONE
 * Appendix B constant this ADR pins", and the reason it belongs to a LIQUIDITY
 * decision is that the two numbers are one number: a market's depth and the
 * largest single bite anyone can take out of it are the same question asked
 * twice. At a 100,000 tank a 10,000 Đ bet is a tenth of the book in one
 * transaction — the price impact that makes a market read as manipulable rather
 * than as informative. 250 is a quarter of the initial grant, which keeps a
 * single bet a contribution rather than an event.
 *
 * Decimal string — never a JS float (CLAUDE.md §2). Coherence
 * (max > reply floor > post floor > 0) is pinned by tests/unit/bets/clamp.test.ts,
 * and 250 > 50 > 10 > 0 still holds with room to spare. */
export const BET_MAX_STAKE = "250";

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

// === UI.A4: Discovery surface (SPEC.1 §22) =================================

/** Discovery featured-set slot count — the carousel/grid cap. PINNED at 8 per
 * design-canon §2 + SPEC.1 §16.1/§22/Appendix B (`DISCOVERY_GRID_SIZE = 8 #
 * pinned by design-canon §2`); NOT a HARDEN-tuned placeholder. Selection is
 * all Open markets newest-first, capped here — capital-neutral (SCL-5,
 * ADR-0017 Driver 2 applied to the entry surface). Integer (a count, not
 * Dharma). */
export const DISCOVERY_GRID_SIZE = 8;

/** Discovery price-series downsample bound — `loadPriceSeries` thins the
 * replayed series server-side to at most this many points (first + last always
 * kept), bounding the DTO payload regardless of a market's bet count. A pinned
 * design value (SPEC.1 1.0.22 §16.1 + Appendix B) sized for the decorative §22
 * card/hero sparkline — shipped at UI-A4 and recorded in §16.1/Appendix B at
 * 1.0.22 to close its omission. Integer (a point count, not Dharma). */
export const DISCOVERY_SERIES_MAX_POINTS = 64;

/** Market-detail price-chart downsample bound (SPEC.1 1.0.22 §9 / F-DEBATE-5) —
 * `loadMarketPriceSeries` thins the replayed YES-price series server-side to at
 * most this many points (first + last always kept), bounding the market-detail
 * read payload regardless of a market's event count. A pinned design value
 * (SPEC.1 1.0.22 §16.1 + Appendix B) — set to 256 for the full-size,
 * axis-bearing chart, deliberately larger than the decorative
 * `DISCOVERY_SERIES_MAX_POINTS`. Integer (a point count, not Dharma). */
export const MARKET_SERIES_MAX_POINTS = 256;

/** Minimum interval between derivations of a market's price-series HISTORY
 * (SPEC.1 1.0.45 §9 *Refresh — floored history, live edge* + §16.1 + Appendix
 * B, founder-ruled at CHART-1). Within the window a derivation is REUSED; the
 * series' TERMINAL point is composed fresh on every render from the live pool
 * price and is never floored, so the chart's right edge cannot disagree with
 * the `PriceBar` directly beneath it — **on an `Open` market**. ⚠ On every other
 * state the series is rendered UNTOUCHED and nothing is recomposed: a frozen
 * chart is its event history alone, and a visible disagreement with `PriceBar`
 * there is the correct outcome rather than a defect (**INV-4**; changed at
 * CHART-1.A, which removed the non-`Open` restamp this sentence used to cover).
 *
 * ⚠ DELIBERATELY LONGER THAN `POLL_INTERVAL_MS_DEBATE_VIEW` (30000), and that
 * inequality is the whole design rather than an oversight. The window exists to
 * COALESCE, not to tolerate staleness: fifty bets in thirty seconds become one
 * derivation instead of fifty, so a busy market's cost stops scaling with how
 * busy it is. Keying invalidation on the POOL instead performs WORST exactly
 * when load is highest, because every bet busts every reader's entry. That is
 * why this series is keyed on market identity alone.
 *
 * ⚠ THE SENTENCE ABOVE USED TO NAME THE SURROUNDING `'use cache'` BLOCKS AS THE
 * COUNTER-EXAMPLE — *"which is what they do, since they key on `reserves`"* —
 * and CACHE-KEY-1 made that false by fixing them. `getCachedDebateView` and
 * `getCachedMarketDiscoveryData` now key on identity and window on
 * `SHARED_VIEW_MIN_WINDOW_MS` below. The argument is unchanged and is now
 * general; only the example it cited is gone. Corrected in place rather than
 * appended to (**O-5**).
 *
 * A pinned DESIGN value, not a tuned economy value — contrast the poll interval
 * above, which is explicitly provisional. Read from this constant at every call
 * site and never inlined, so the HARDEN.6 tune stays a one-line change. Integer
 * (milliseconds, not Dharma). */
export const MARKET_SERIES_MIN_WINDOW_MS = 60000;

/**
 * Minimum interval between derivations of a market's SHARED READ BLOCK — the
 * debate view's comments/ranking/replies/totals (`getCachedDebateView`) and
 * Discovery's per-market totals/media/series/top-posts
 * (`getCachedMarketDiscoveryData`). Within the window a derivation is REUSED
 * (SPEC.1 §9 *Refresh*; CACHE-KEY-1, ADR-0051).
 *
 * ⛔ IT EXISTS BECAUSE THE THING IT REPLACED WAS NOT A WINDOW AT ALL. Both
 * blocks used to key on `reserves`, and a `'use cache'` key is its serialized
 * argument list — so every bet moved the pool, changed the key, and forced a
 * full miss for every reader. The cache worked on quiet markets and stopped
 * working entirely on the market everyone was betting on. Keying on identity
 * plus a clock is what lets the window COALESCE.
 *
 * ⚠ SHORTER THAN `MARKET_SERIES_MIN_WINDOW_MS` (60000), DELIBERATELY, and the
 * two are not the same kind of thing. That one floors a price HISTORY — a
 * picture of the past, legitimately allowed to be a minute old, with its live
 * right edge recomposed outside the boundary anyway. This one floors
 * ARGUMENTS, which are the product: a reader waiting a minute to see that
 * someone answered them is a different cost entirely.
 *
 * ⚠ NOT DERIVED FROM `POLL_INTERVAL_MS_DEBATE_VIEW`, and the proof is that the
 * two no longer agree: the poll moved 15000 → 30000 (POLL-IDLE) and this window
 * stayed put. Two independent tunables that used to agree — the
 * `HEADER_PORTFOLIO_CACHE_TTL_SECONDS` precedent below, which matches the same
 * number for the same reason and likewise keeps its own constant. Deriving one
 * from the other would silently couple a cache window to a client cadence, so
 * that retuning the poll retunes freshness for every reader of every market.
 *
 * ⛔ IT IS NOT WHAT MAKES A POSTER SEE THEIR OWN ARGUMENT. Every comment rides
 * a bet (INV-1), so before CACHE-KEY-1 posting moved the pool, busted the key,
 * and the author's own refresh carried their comment back — accidentally, and
 * nowhere written down. A window has no such side effect, so `/m/[slug]`
 * BYPASSES this cache for a viewer who posted inside the last window
 * (`viewer-freshness.ts`). Shortening this constant is therefore not a way to
 * improve that case, and lengthening it does not harm it.
 *
 * Read from this constant at every call site and never inlined, so the tune
 * stays a one-line change. Integer (milliseconds, not Dharma). */
export const SHARED_VIEW_MIN_WINDOW_MS = 15000;

/**
 * The outer bound on serving a `SHARED_VIEW_MIN_WINDOW_MS` entry STALE while a
 * revalidation is in flight — `cacheLife`'s `expire`, in the seconds it speaks.
 *
 * ⚠ DELIBERATELY NOT `cached-series.ts`'s `WINDOW × 60` RATIO. That sibling
 * caches history and can afford an hour's ceiling; reusing the ratio here would
 * give a 15 s window a 900 s ceiling, so a debate feed in a low-traffic lull
 * could serve fifteen minutes stale. Pinned instead to
 * `MARKET_SERIES_MIN_WINDOW_MS` — one minute, the bound already ratified for
 * this surface's chart — so no shared block is ever older than the oldest thing
 * rendered beside it. ⚠ One exception, and it predates the shared store: the
 * walk ITSELF carries the hour ceiling on both its layers (`cached-series.ts`
 * `EXPIRE_SEC`, and the same value as its fleet-wide entry's TTL since
 * CACHE-COALESCE-2) — it is history, and the sentence above is about the
 * blocks rendered beside it. Seconds, not milliseconds: `cacheLife` takes
 * seconds. */
export const SHARED_VIEW_EXPIRE_SEC = MARKET_SERIES_MIN_WINDOW_MS / 1000;

/**
 * CACHE-COALESCE-1/2 — the fleet-wide single-flight around every per-market
 * shared read block (`src/server/cache/shared-block-store.ts`; the debate
 * view's binding is `src/server/debate-view/shared-view-store.ts`).
 *
 * `'use cache'` dedupes a render inside ONE Vercel instance; measured on
 * production at 5,000 readers the fleet paid instances × markets × 4/min
 * (~3,800 renders/min against a window that costs 4/min/market), and a burst
 * cold-started every instance at once. A shared entry in Upstash plus a lock
 * makes a stale window cost ONE render across the fleet.
 *
 * `SHARED_VIEW_LOCK_MS` — how long one instance may hold the render lock. Well
 * above a worst-case render (the bet path's own `statement_timeout` is 1 s;
 * a full debate view is a handful of those) and short enough that a holder
 * that dies mid-render releases by expiry, not by hand.
 *
 * `SHARED_VIEW_WAIT_MS` / `SHARED_VIEW_WAIT_POLL_MS` — how long an instance
 * with NO entry to serve waits for the lock holder's before rendering itself.
 * Two seconds is a cold-market bound, not a steady-state cost: with an entry
 * present the loser serves it stale and never waits. ⚠ It is a bound PER
 * BLOCK; a page that reads several blocks in series pays it several times,
 * which is why the two Discovery blocks pass `waitMs: 0` (CACHE-COALESCE-2). */
export const SHARED_VIEW_LOCK_MS = 10_000;
export const SHARED_VIEW_WAIT_MS = 2_000;
export const SHARED_VIEW_WAIT_POLL_MS = 100;

/**
 * The largest serialized shared entry the store will write. Upstash rejects
 * values over its plan limit (1 MB on the smallest) SILENTLY from the page's
 * point of view — the `SET` fails, no entry lands, and every non-holder pays
 * the cold-market wait and renders anyway, which turns the feature into a
 * latency tax. Below the limit with margin; an oversize render raises a flag
 * instead, and the fleet renders locally until it clears. */
export const SHARED_VIEW_MAX_BYTES = 900_000;

/**
 * Minimum interval between LIVE POOL PRICE reads on Discovery (`/`) — the
 * per-market spot price and reserves behind every card, the hero chart's live
 * tail and the hero's `Đ now` figure (ADR-0055).
 *
 * ⛔ THIS IS A MONEY FIGURE BEHIND A WINDOW, WHICH ADR-0051 EXPRESSLY REFUSED,
 * so read why before touching it. That ADR composed `currentValue` outside the
 * cache on the rule that "money on a public surface may not lag a window", and
 * the rule was right about money and wrong about which surface bears the risk.
 * `/m/[slug]` — the page where a bet is actually placed — has been serving a
 * PRERENDERED price all along, measured at thirteen hours old on production and
 * corrected only by the client poll. Discovery, where nobody can bet, was the
 * one surface paying a live database read per visitor to be stricter than the
 * page taking the money. The asymmetry, not the freshness, is what was wrong.
 *
 * ⚠ FIVE SECONDS IS NOT A PERFORMANCE DIAL — it is the largest lag that keeps
 * Discovery STRICTER than the surface it links to. Raising it toward
 * `SHARED_VIEW_MIN_WINDOW_MS` would make a price on the front page older than
 * the same price one click away, which is the defect this window exists under,
 * not a cheaper version of it. Lowering it below a second re-opens the
 * per-visitor read without buying a freshness anyone can perceive.
 *
 * Read from this constant at every call site and never inlined. Integer
 * (milliseconds, not Dharma). */
export const DISCOVERY_PRICE_MIN_WINDOW_MS = 5000;

/**
 * The outer bound on serving a `DISCOVERY_PRICE_MIN_WINDOW_MS` entry STALE
 * while a revalidation is in flight — `cacheLife`'s `expire`, in seconds.
 *
 * ⚠ Deliberately NOT `SHARED_VIEW_EXPIRE_SEC` (60 s) and deliberately not the
 * `cached-series.ts` `window × 60` ratio, which would hand a 5 s window a 300 s
 * ceiling. This entry holds a PRICE, so its stale ceiling is the number that
 * actually bounds how wrong the front page can be during a revalidation, and it
 * is pinned tight for that reason alone. Seconds, not milliseconds. */
export const DISCOVERY_PRICE_EXPIRE_SEC = 30;

// === CHART-3: the fixed experiment window (SPEC.1 1.0.48 §9 + §16.1) ======

/** The §9 price chart's fixed X axis, as a pair of ISO instants. */
export type ChartWindow = { readonly start: string; readonly end: string };

/**
 * ⚠ `end` is **23:45**, not 23:59 — it is the ratified `resolution_deadline`
 * shared by all eight markets, and the same instant is trading close and
 * settlement. A 23:59 axis would run fifteen minutes past the last instant at
 * which anything can happen.
 *
 * ⛔ `start` IS CORRECT ONLY IF THE MARKETS ARE SEEDED ON 15 SEPTEMBER, and that
 * condition is written here rather than assumed because it is the whole of what
 * makes this value right (CHART-6, founder ruling — D10 closed OPERATIONALLY,
 * not by moving the constant). `market.opened` is emitted at Draft → Open, so a
 * market opened during the run-up carries a genesis instant BEFORE this axis
 * begins — and `xPx` is deliberately unclamped in both directions, so that point
 * maps to a negative x and is cut by the viewBox. **Seed on launch day, or move
 * this constant.**
 *
 * ⚠ THAT IS NOT HYPOTHETICAL — IT IS WHAT HAPPENED ON STAGING, ON ALL EIGHT
 * MARKETS, FOR TWO WEEKS. The staging window began 21 August against a slate
 * whose genesis instants are all 17 August, so the opening price of every market
 * was clipped off the left edge with nothing raised: the chart still rendered, the
 * suite stayed green, and the symptom the founder eventually saw was not a missing
 * point but the LABELS, stranded at the far right beside a line crushed into the
 * leftmost sixth of the plot. A window that does not contain its data clips it
 * **silently**; the guard added at CHART-6 asserts containment against these real
 * constants, because a guard written against a fixture window would have passed
 * every day of those two weeks.
 */
const PRODUCTION_CHART_WINDOW: ChartWindow = {
	start: "2026-09-15T00:00:00.000Z",
	end: "2026-11-05T23:45:00.000Z",
};

/**
 * ⚠ `start` is MEASURED, not chosen: the earliest event of ANY type across
 * staging's whole slate is `2026-08-17T20:55:20.712Z`, floored to its UTC day.
 * Read at CHART-6 against the live staging database, because a window narrower
 * than the data silently clips real points off the canvas and nothing reports it.
 * The latest event at that reading was `2026-09-01T07:30:30.139Z`, comfortably
 * inside `end`.
 *
 * ⛔ IT WAS `2026-08-21T00:00:00.000Z` UNTIL CHART-6, AND THAT VALUE WAS CLIPPING
 * THE GENESIS POINT OF ALL EIGHT MARKETS. The measurement CHART-3 took was of the
 * earliest **`bet.placed`** — `2026-08-21T05:29:29.430Z` on
 * `github-zugzwang-repo-stars` — which was the right instant for the series
 * CHART-3 could see. CHART-4 then backfilled a `market.opened` row per market
 * carrying that market's `pools.created_at`, four days EARLIER, and the walk
 * `replayReserveSeries` performs starts from exactly that seed. So the first
 * point of every staging chart moved outside a window nobody re-measured.
 *
 * ⚠ THE LESSON IS THE PREDICATE, NOT THE DATE. The floor is the earliest event
 * the chart can RENDER, which is the earliest of `market.opened` · `bet.placed` ·
 * `bet.sold` — and a measurement scoped to one of the three is a measurement of
 * the wrong quantity that looks exactly like the right one. Measured 2026-09-01,
 * both floors land on the same instant only because `market.opened` is now the
 * earliest; the all-types floor is taken deliberately so it stays true if a
 * fourth event type ever joins the walk.
 *
 * ⚠ The eight backfilled `market.opened` rows carry their pool's `created_at`
 * FLOORED TO THE MILLISECOND (measured Δ −59 … −923 µs), because the backfill
 * bound the value through a JS `Date`. Recorded so a later reader comparing
 * `events.created_at` to `pools.created_at` for equality finds them unequal and
 * does not read that as a defect.
 *
 * ⛔ `end` USED TO EXPIRE ON 2026-09-10, AND THE CONSEQUENCE WAS LARGER THAN
 * "THE LINE LOOKS SHORT". After that instant `withLiveTail` appends a point at
 * `now` beyond the axis, so `xPx` returns a coordinate past `VIEWBOX_W` and the
 * viewBox clips it. What is clipped is not only the line's last segment:
 * `terminalX` follows the series, so **both terminal dots and both pulses leave
 * the canvas entirely**, while `TerminalLabels` — HTML, outside the SVG — keeps
 * rendering. The result on every `Open` staging market would be two colour-coded
 * words naming two marks that are not drawn.
 *
 * ⚠ CHART-6 CHANGED THE MECHANISM AND SHARPENED THE SYMPTOM. There is no gutter
 * any more: the labels are an overlay positioned from the dot's own x. Past
 * `end`, `terminalX` exceeds `VIEWBOX_W`, so the label's anchor exceeds 100 %, it
 * FLIPS, and it comes to rest just inside the plot's right edge — naming a dot
 * that has been clipped off the canvas. The failure is the same and it now looks
 * MORE deliberate, because the label lands somewhere plausible instead of in a
 * column. Restated rather than left, since a reader will grep this docblock for
 * "gutter" and find nothing. Caught by `@code-reviewer`.
 *
 * The clip itself is deliberate: drawing the point AT the edge instead would put
 * the live price at an instant it did not happen, which this codebase rejects on
 * principle (`price-series.ts` `withLiveTail`, `price-chart.ts`
 * `deriveMarketPriceChart`). ⇒ **The fix is to move this value, never to clamp
 * the geometry** — and CHART-4 D11 moved it, to production's own
 * `2026-11-05T23:45:00Z`, on founder ruling. Staging outlives 10 September, and
 * an end date chosen to sit just past the fixtures was a value with a shelf life
 * measured in days on an environment that is used every day.
 *
 * ⚠ AMENDED AT CHART-5, BECAUSE THE SYMPTOM GOT WORSE. The overlay's end label
 * carries the current PERCENTAGE — **beside** the name since CHART-7 (RF-2), and
 * beneath it when this paragraph was written — so past `end` the failure
 * is no longer two colour-coded words naming absent marks — it is two words AND
 * TWO NUMERIC PRICE FIGURES attached to nothing drawn. A reader who cannot see
 * the dots can still read a price off the label. ⚠ CHART-6 widens this: the hero
 * carries the value line too, so all three surfaces show the figure. Written in here per `O-5`
 * rather than left to the CHART-5 log, because this docblock is the site that
 * states the position the change supersedes.
 *
 * ⚠ THE EXPIRY ALARM IS KEPT ON PURPOSE, and it is the load-bearing half of this
 * docblock rather than a leftover. The failure mode above is not repaired by the
 * new value — it is only postponed, and it will fire again the moment `now`
 * passes the new `end`. It is silent when it fires: nothing errors, the page
 * renders, and the only symptom is two labels pointing at marks that are not
 * there. A reader arriving in November needs the mechanism, not just the date.
 */
/**
 * ── RE-MEASURED 2026-09-11 · `2026-08-17` → `2026-09-07` ───────────────────
 *
 * ⛔ THE OLD FLOOR WAS MEASURED AGAINST MARKETS THAT NO LONGER EXIST. The
 * 2026-09-07 staging reset destroyed all eight content markets and
 * `LIQ-1-RESTORE` recreated them through `createMarket` / `openMarket`, minting
 * a fresh `market.opened` for each. Every renderable event on staging is
 * therefore younger than the window that was supposed to contain it, and the
 * window opened **twenty-one days before any data existed**.
 *
 * ⚠ THE SYMPTOM IS NOT AN EMPTY CHART — IT IS A CHART THAT LOOKS FINE AND LIES
 * ABOUT WHEN THE MARKET STARTED. `xPx` maps the window's start to x=0, so the
 * series was drawn as a short nub beginning a third of the way across an
 * otherwise empty plot, reading as "this market sat still for three weeks and
 * then traded" rather than "this market opened four days ago". Nothing errors,
 * nothing clips, and both the debate page and the JPEG export render it.
 *
 * ⚠ MEASURED THE WAY THE DOCBLOCK ABOVE INSISTS — the earliest of
 * `market.opened` · `bet.placed` · `bet.sold`, not of any one of them, read off
 * the live staging database:
 *   market.opened  n= 24  first = 2026-09-07T20:18:13.954Z
 *   bet.placed     n=388  first = 2026-09-07T20:18:16.131Z
 *   bet.sold       n= 16  first = 2026-09-07T20:18:35.118Z
 *   latest of all              = 2026-09-11T05:32:18.582Z  (well inside `end`)
 * Floored to its UTC day, as before.
 *
 * ⚠ AND THE FAILURE IS PERIODIC, NOT ONE-OFF: every staging reset that
 * recreates the markets moves this floor forward, and nothing re-reads it. The
 * previous entry warned that its own `end` would go stale silently; this is the
 * same class of decay at the other edge, and it arrived first.
 */
const STAGING_CHART_WINDOW: ChartWindow = {
	start: "2026-09-07T00:00:00.000Z",
	end: "2026-11-05T23:45:00.000Z",
};

/**
 * The whole environment branch, in one pure function, evaluated ONCE below.
 *
 * ⛔ THIS IS THE ONLY PLACE `ZUGZWANG_ENV` MAY DECIDE THE WINDOW. SPEC.1 §16.1:
 * "Resolved from `ZUGZWANG_ENV` at the constants layer; **never branched on
 * inside the derivation or the component.**" A conditional in the read path is
 * how staging behaviour leaks into production — it survives review because each
 * individual branch looks correct, and it fires only in the environment nobody
 * is testing.
 *
 * `preview` takes the STAGING window because anything pointed at the staging
 * database needs staging's dates: given production's window, every such chart
 * would render as a line crushed against the left edge.
 *
 * ⚠ MEASURED, AND IT INVERTS THE ASSUMPTION THAT PUT THAT ARM HERE. A Vercel
 * Preview deployment reports `env: "staging"`, not `"preview"` — read off this
 * branch's own preview at `/api/health` (`canary` matching the branch HEAD, so
 * it was this build and not another session's). So the deployed preview lane
 * already takes the staging window **through the `staging` arm**, and the
 * `preview` arm covers only what actually sets that value: a LOCAL build, which
 * AGENTS.md §2 instructs (`ZUGZWANG_ENV=preview just verify`), plus any future
 * environment tagged that way. `preview` is in `VALID_ENVS` beside `prod` and
 * `staging`, so the arm is not dead — but it is not the thing that makes
 * previews work, and this docblock said it was.
 *
 * ⇒ Recorded rather than quietly corrected because `@code-reviewer` filed this
 * as **NOT ESTABLISHED (O-13)** and the honest close is the reading, not a
 * tidier sentence.
 *
 * Everything else — `prod`, the `"unknown"` fallback `next.config.ts` inlines
 * into the browser bundle, and an unset var under `vitest` — takes PRODUCTION.
 * That is the fail-safe direction: production is the only environment whose
 * window is load-bearing, so an unrecognised value must not be able to serve it
 * a fixture window.
 */
export function resolveChartWindow(env: string | undefined): ChartWindow {
	return env === "staging" || env === "preview"
		? STAGING_CHART_WINDOW
		: PRODUCTION_CHART_WINDOW;
}

/**
 * ⚠ THIS IS A BUILD-TIME SNAPSHOT ON BOTH SIDES, SO AN ENV CHANGE REQUIRES A
 * REBUILD. `next.config.ts` puts `ZUGZWANG_ENV` in its `env:` block, and Next
 * spreads `getNextConfigEnv(config)` into the define set for the client, the
 * node server AND the edge server alike — every `config.env` key becomes a
 * literal substituted for `process.env.<KEY>` at compile time. Editing the
 * variable in the Vercel dashboard therefore changes **nothing anywhere** until
 * a redeploy.
 *
 * ⛔ AN EARLIER VERSION OF THIS DOCBLOCK GOT THE MECHANISM WRONG AND IS
 * CORRECTED RATHER THAN DELETED, BECAUSE THE ERROR IS THE INSTRUCTIVE PART. It
 * said the server re-reads `process.env` per request while the browser carries a
 * frozen literal, and derived a hydration mismatch on `/m/[slug]` from the two
 * disagreeing. They cannot disagree — both are the same literal — so that
 * mismatch is unreachable. The CONCLUSION ("an env change requires a rebuild")
 * was right, and is in fact stronger than the reasoning that produced it.
 *
 * That is precisely the shape `O-13` and CLAUDE.md §5.13 exist to end: a sound
 * conclusion carried by a named mechanism nobody checked. Measured against the
 * pinned Next by `@security-auditor` at the CHART-3 cascade; the runtime-read
 * escape hatch is gated on `next experimental-compile`, which this repo does
 * not use.
 */
const CHART_WINDOW = resolveChartWindow(process.env.ZUGZWANG_ENV);

/** Start of the §9 chart's fixed X axis (SPEC.1 §16.1). ISO, not ms — it is
 * byte-comparable with the spec that pins it, and the one consumer already
 * parses timestamps. */
export const MARKET_CHART_WINDOW_START = CHART_WINDOW.start;

/** End of the §9 chart's fixed X axis (SPEC.1 §16.1). ⚠ **The axis ends here;
 * the series never does** — the line stops at the present instant, never at
 * this value. */
export const MARKET_CHART_WINDOW_END = CHART_WINDOW.end;

/**
 * The ordered calendar instants the §9 chart's X axis labels (SPEC.1 §16.1,
 * founder ruling D20(b) + D21(b) at CHART-7).
 *
 * ⭐ THESE ARE EXPERIMENT DATES, NOT WINDOW ENDPOINTS, AND THE DISTINCTION IS THE
 * WHOLE RULING. Before CHART-7 the axis labelled wherever the window happened to
 * begin and end, so a reader learned the configuration rather than the calendar.
 * On production the two coincide — the window IS 15 September to 5 November — and
 * on staging, whose window opens on 17 August because its fixtures predate the
 * experiment, the first two anchors fall *inside* the plot. **That is correct and
 * intended: the chart marks launch day even on a window that predates it.**
 *
 * ⚠ AN ANCHOR OUTSIDE THE CONFIGURED WINDOW IS NOT DRAWN. Neither environment has
 * one today; the rule is specified anyway, because the alternative is a label at
 * a negative x — clipped by the viewBox on the SVG side, and NOT clipped on the
 * HTML side, where it would escape the plot and land on whatever sits beside the
 * chart. A rule that only matters under a configuration nobody has yet is exactly
 * the rule that gets discovered by a screenshot.
 *
 * ⛔ ONE ORDERED LIST RATHER THAN THREE SCATTERED DATES, so the set is tunable in
 * one place, and **resolved here at the constants layer** — SPEC.1 §16.1's
 * standing rule for this chart's constants, *"never branched on inside the
 * derivation or the component"*. Unlike the WINDOW, this list takes no
 * environment branch at all: an experiment date is the same date wherever it is
 * read, and giving it an env arm would be inventing a variance the ruling does
 * not have.
 *
 * ⚠ WRITTEN IN THE SPEC ROW'S OWN FORM (`…:00Z`, not `…:00.000Z`) so the constant
 * is byte-comparable with the document that pins it — `MARKET_CHART_WINDOW_START`'s
 * reason exactly. Every consumer goes through `Date.parse`, which reads the two
 * spellings identically.
 */
export const MARKET_CHART_AXIS_ANCHORS: readonly string[] = Object.freeze([
	"2026-09-15T00:00:00Z",
	"2026-10-01T00:00:00Z",
	"2026-11-05T23:45:00Z",
]);

// === UI.A5: Profile Dharma graph (SPEC.1 §23) =============================

/** Profile graph-series downsample bound (UI-A5 §7 S2, OQ-4 B) — every served
 * profile line (free-Dharma, net-worth, each per-market value segment) is
 * thinned server-side to at most this many points (first + last always kept),
 * bounding the RSC payload regardless of a user's activity. A NEW
 * IMPLEMENTATION constant kept SEPARATE from `DISCOVERY_SERIES_MAX_POINTS` so
 * the two surfaces stay independently tunable (OQ-4 B, declined the spec-side
 * bound); NOT a spec constant (~64). HARDEN-tunable. Integer (a point count,
 * not Dharma). */
export const PROFILE_SERIES_MAX_POINTS = 64;

/** Fixed Y-axis ceiling of the §23 cumulative Dharma graph (net-worth +
 * free-Dharma lines; no autoscale). MIRRORS the SPEC constant
 * `PROFILE_GRAPH_Y_MAX` (SPEC.1 §16.1 + Appendix B, landed at #248) — set to
 * 10,000 by the W2.6 design record; a design pin, not a HARDEN-tuned value.
 * This plan mints NO new Appendix B row (UI-A5 §7 S2) — code mirrors the spec.
 * Integer (a Đ ceiling rendered as an axis bound). */
export const PROFILE_GRAPH_Y_MAX = 10000;

// === F-DEBATE-4: Debate-view polled refresh (SPEC.1 §9) ====================

/** Debate-view poll interval in milliseconds (SPEC.1 1.0.25 §16.1 + Appendix B
 * + §9 F-DEBATE-4, per `C7`) — the cadence at which `/m/[slug]` re-invokes its
 * own server read via `router.refresh()` (`src/components/debate/DebatePoll.tsx`),
 * NOT a fetch against a read endpoint. **PROVISIONAL PIN at 30000** (raised
 * from 15000 at POLL-IDLE to halve per-tab server renders; see also
 * `POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW` below, which stops the poll for an idle
 * reader). Unlike the
 * pinned design constants above, this one **remains deferred to the
 * number-tuning pass** — SPEC.2 §4.3 assigns the tune to HARDEN.6; the pin
 * exists only because the flow is unbuildable without a value and go-live
 * precedes that pass. Sized against the measured shape of one tick: because the
 * refresh re-executes the route's LAYOUT as well as its page, a tick costs
 * twelve to fourteen sequential database round-trips per open tab — including
 * TWO session reads — and nothing throttles it per tab. THREE of those
 * round-trips are NOT constant: `listMarketComments` carries no `LIMIT` and the
 * price-series replay walks the market's whole event history, so per-tick cost
 * SCALES WITH THE MARKET and grows monotonically across the live window, most
 * steeply on the markets carrying the most viewers. The quantity to size
 * against is therefore ticks × concurrent tabs × round-trips × O(market
 * events), not the interval alone; visibility suspension is the larger lever,
 * and a cap or keyset on `listMarketComments` is a HARDEN.6 PREREQUISITE, not
 * an optimisation. Read from this constant at every
 * call site and never inlined, so the HARDEN.6 tune is a one-line change.
 * Integer (milliseconds, not Dharma). */
export const POLL_INTERVAL_MS_DEBATE_VIEW = 30000;

/** POLL-IDLE — how long a reader may go without ANY pointer, touch, wheel,
 * scroll or keyboard input before `DebatePoll` stops refreshing `/m/[slug]`.
 * The first input after that refreshes immediately and resumes the
 * `POLL_INTERVAL_MS_DEBATE_VIEW` cadence. Exists because the poll's other
 * suspensions (hidden tab, open composer) never fire for a tab left open and
 * visible, which is exactly the tab that costs a server render per interval
 * for nobody. Client-side only; changes no server read. Integer (milliseconds,
 * not Dharma). */
export const POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW = 300000;

/** The debate view's post-carousel auto-advance cadence (`scrollers.tsx`).
 * Minted at POLL-IDLE, when the poll moved to 30000: the carousel used to read
 * `POLL_INTERVAL_MS_DEBATE_VIEW` directly, and that file's own docblock asked
 * for exactly this constant the day the two needed to differ. Held at the
 * carousel's shipped 15000 so the refresh change does not slow the carousel.
 * Integer (milliseconds, not Dharma). */
export const AUTO_ADVANCE_MS_DEBATE_VIEW = 15000;

// === HEADER-PORTFOLIO-CACHE: header PORTFOLIO figure cache-aside ===========

/** TTL for the Redis cache-aside in front of `getHeaderPortfolio`
 * (`getHeaderPortfolioCached`, `src/server/dharma/header-portfolio.ts`).
 * Set to 15 s to match the debate-view poll's cadence at the time (15000 ms),
 * the product's accepted display-freshness bar. POLL-IDLE moved that poll to
 * `POLL_INTERVAL_MS_DEBATE_VIEW` = 30000 and this TTL stayed at 15 s, so it is
 * now SHORTER than the cadence `/m/[slug]` re-renders this figure on and still
 * adds no staleness beyond what a viewer already experiences there. Seconds, not
 * milliseconds — Upstash `SET ... EX` takes seconds. */
export const HEADER_PORTFOLIO_CACHE_TTL_SECONDS = 15;
