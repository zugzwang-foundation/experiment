// Per SPEC.1 §16.1 (operational floor constants) + SPEC.2 §11 ¶"Per-
// surface rate-limit table" + ADR-0015 D6/D7. Seven numeric placeholders
// consumed by `src/server/middleware/rate-limit.ts` to instantiate the
// seven sliding-window Ratelimit surfaces. HARDEN.6 owns the real-value
// tuning pass; SCAFFOLD.4 ships conservative anti-abuse defaults so the
// substrate is operationally testable end-to-end before HARDEN.* lands.
//
// Per SCAFFOLD.4 plan §F4 + plan-Q5 carve-out: PLACEHOLDER VALUES — name
// each constant's intended HARDEN.6 source in its JSDoc so a future reader
// who finds a 5 looks up §16.1 / §19 Q4/Q16 / ADR-0010 / ADR-0015 for the
// real cap rather than treating these as production numbers.

/** Per-email OTP request cap (anti-spam / anti-bot). PLACEHOLDER VALUE — tuned by HARDEN.6 per SPEC.1 §16.1 + §19 Q4/Q16. */
export const OTP_REQUESTS_PER_EMAIL_PER_HOUR = 5;

/** Per-IP OTP request burst cap. PLACEHOLDER VALUE — tuned by HARDEN.6 per SPEC.1 §16.1 + §19 Q4/Q16. */
export const OTP_REQUESTS_PER_IP_BURST_PER_MIN = 10;

/** Per-IP rate limit on /admin/login POST attempts. PLACEHOLDER VALUE — tuned by HARDEN.6 per SPEC.1 §16.1 + ADR-0010. */
export const ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR = 10;

/** Per-user, per-market write cap (shared by comments / replies / image-comments / friendly-fire). PLACEHOLDER VALUE — tuned by HARDEN.6 per SPEC.1 §16.1 + §19 Q4. */
export const RATE_LIMIT_PER_MARKET_PER_DAY = 50;

/** Per-user write burst cap (shared with the per-market budget). PLACEHOLDER VALUE — tuned by HARDEN.6 per SPEC.1 §16.1. */
export const RATE_LIMIT_BURST_PER_MIN = 5;

/** Per-IP anti-abuse burst cap on bet place/sell. PLACEHOLDER VALUE — tuned by HARDEN.6 per SPEC.1 §16.1 + ADR-0015 D7. */
export const BET_ATTEMPTS_PER_IP_PER_MIN = 30;

/** Per-IP anti-abuse burst cap on R2 signed-PUT URL mint. PLACEHOLDER VALUE — tuned by HARDEN.6 per SPEC.1 §16.1 + ADR-0015 D7. */
export const IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN = 10;
