# CONSTANTS.md — pinned vs deferred-to-tuning

**Dated:** 2026-07-15 · **Pinned to:** `e28d4b6`
**Derived from:** SPEC.1 §16.1 / §19 (Q1, Q4, Q16) / Appendix B · RANKING.md §12 ·
cpmm.md §10 · `src/server/config/limits.ts` · `src/server/cpmm/decimal.ts` ·
`src/server/auth/index.ts`.

The system runs on a small set of named constants. Three classes: **PINNED** (the value is
ratified — treat a different value as a finding), **DEFERRED** (symbolic; the shipped number
is a placeholder owned by the 2026-09-01 number-tuning pass — do **not** file placeholder
values as findings), and **PROVISIONAL-OPS** (real ratified values that a HARDEN pass may
retune — operational, not economic).

---

## 1 · PINNED

| Constant | Value | Lives at |
|---|---|---|
| `BET_MIN_STAKE_REPLY` | `"50"` Đ (decimal string) | `src/server/config/limits.ts` · ADR-0018 · SPEC.1 App-B |
| `REPLY_DEPTH_MAX` | `1` (flat replies; a reply can't be replied to) | `src/server/config/limits.ts` · ADR-0017 · SPEC.1 §8 |
| Money/Dharma column type | `NUMERIC(38,18)` everywhere; app side is exact decimal strings, never JS floats | `src/db/schema/*` · CLAUDE.md §2 |
| `CpmmDecimal` precision | `Decimal.clone({ precision: 50, rounding: ROUND_HALF_EVEN })` — the single arithmetic authority, reused by the ledger | `src/server/cpmm/decimal.ts` · cpmm.md §10.2 |
| Boundary rounding | every quantity leaving CPMM quantized to 18 dp; user-credited quantities ROUND_DOWN, prices ROUND_HALF_EVEN, reserves exact by construction | cpmm.md §10.3 |
| Daily Credit accrual key | one credit per **UTC calendar day** (`creditedForDate` `YYYY-MM-DD`), only on a commented-bet day, use-or-lose | SPEC.1 §10.4 · `dharma.credited` payload · `I-DAILY-ONCE-001` |
| Initial grant cadence | once per user EVER, inside the F-AUTH-4 first-acceptance tx | ADR-0018 · `I-GRANT-ONCE-001` |
| `SESSION_MAX_AGE_SEC` | `34,560,000` s (400 days — the better-call/browser cookie ceiling) | `src/server/auth/index.ts` · ADR-0004 Patch P1 · SPEC.2 §8.2 |
| Conclusion freeze | 2026-11-05 23:59 UTC (`system_state.frozen_at`); public dataset dated 2026-11-06 | SPEC.1 §12 · CLAUDE.md §3 |
| `IMAGE_UPLOADS_MAX_BYTES` | 8 MiB (`8388608`), mirrored in a SQL CHECK | `limits.ts` · SPEC.2 §12.3 |
| Image MIME whitelist | jpeg/png/webp/gif/avif — SVG excluded (XSS), HEIC/HEIF excluded (moderation coverage) | `limits.ts` (SCAFFOLD.15 Q5) |
| `PUT_URL_TTL_SECONDS` / `READ_URL_TTL_SECONDS_MODERATION` | 60 s / 60 s | `limits.ts` · SPEC.2 §12.3 / §10.10 |
| `ORPHAN_WINDOW_MINUTES` | 120 (only older uncommitted uploads are sweepable) | `limits.ts` · SPEC.2 §12.6 |
| `OPENAI_MODERATION_MODEL_SNAPSHOT` | `omni-moderation-2024-09-26` (pinned snapshot; sole vendor in experiment phase) | `limits.ts` · SPEC.2 §10 · ADR-0014 |
| `OPENAI_TIMEOUT_MS` / `OPENAI_MAX_RETRIES` | 3000 ms / 1 (transient-only retry) | `limits.ts` · SPEC.2 §10.10 |
| `RESERVATION_TTL_SECONDS` | 10 s (the moderation SETNX reservation) | `limits.ts` · SPEC.2 §10.10 |
| Idempotency-Key format | `^[A-Za-z0-9_-]{1,255}$`, required on bet endpoints; SHA-256 canonical-JSON body fingerprint | SPEC.2 §4.4 · ADR-0015 |

## 2 · DEFERRED — symbolic until the 2026-09-01 number-tuning pass

SPEC.1 §19 Q4/Q16 and Appendix B hold this list as `TBD`. Where code ships a number today,
it is a **labelled placeholder** (JSDoc in `limits.ts` names the tuning owner per value).

| Constant | Shipped placeholder | Lives at |
|---|---|---|
| `INITIAL_USER_DHARMA` (equal grant) | `"1000"` (ranged 1,000–2,000) | `limits.ts` · SPEC.1 §10.1/§16.1 |
| `DAILY_CREDIT_DHARMA` | `"10"` | `limits.ts` · SPEC.1 §10.4 |
| `ADMIN_INITIAL_DHARMA` | — (spec-only symbol) | SPEC.1 §16.1/App-B |
| `POOL_SEED_PER_MARKET_DEFAULT` (seed magnitude) | — (admin enters per market) | SPEC.1 §10.5/§16.1 · cpmm.md §7 |
| `BET_MIN_STAKE_POST` (post floor) | `"10"` | `limits.ts` · ADR-0018 (only the reply floor is pinned) |
| `COMMENT_MAX_LENGTH` | `5000` chars | `limits.ts` · SPEC.1 §10.9 |
| `MARKET_TITLE_MAX_CHARS` / `MARKET_DESCRIPTION_MAX_CHARS` / `RESOLUTION_REASON_MAX_CHARS` | 200 / 4000 / 1000 (admin form-boundary ceilings) | `limits.ts` · SPEC.1 App-B (R-15-G) |
| `SLIPPAGE_WARNING_PCT_THRESHOLD` | — (spec-only) | SPEC.1 §16.1 · cpmm.md §6.2 |
| `IN_FLIGHT_BET_TIMEOUT_SEC` | — (spec-only) | SPEC.1 §16.1 (F-BET-6) |
| `POLL_INTERVAL_MS_DEBATE_VIEW` | — (spec-only) | SPEC.1 §16.1 (F-DEBATE-4) |
| `OTP_TTL_MIN` | 5 min (the Better Auth plugin default rides today) | SPEC.1 §16.1/§19 Q16 · `src/server/auth/email-otp.ts` |
| OTP caps: `OTP_REQUESTS_PER_EMAIL_PER_HOUR` / `OTP_REQUESTS_PER_IP_BURST_PER_MIN` | 5 / 10 | `limits.ts` · SPEC.1 §19 Q16 |
| `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR` | 10 | `limits.ts` · ADR-0010 |
| `BET_ATTEMPTS_PER_IP_PER_MIN` | 30 | `limits.ts` · ADR-0015 D7 |
| `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` | 10 | `limits.ts` · ADR-0015 D7 |
| `RATE_LIMIT_PER_MARKET_PER_DAY` / `RATE_LIMIT_BURST_PER_MIN` | — (spec-only; whether reply-bets carry a per-market productive cap is itself deferred) | SPEC.1 §16.1 · SPEC.2 §4.6/§11 |
| `AI_FLAG_THRESHOLD_TRACK_A_*` / `AI_FLAG_THRESHOLD_TRACK_B_*` | — (per-category; shipped gate is boolean category flags, no score floors, per SCAFFOLD.16 LD-3) | SPEC.1 §19 Q1/App-B · `docs/briefs/SCAFFOLD.16-…` |
| RANKING lane constants: `k_lane`, `floor_lane` (per lane), `floor_split`, gravity `c`, `g`, `LATEST_INTERLEAVE_INTERVAL` | — (shape locked, numbers TBD; interleave design intent ≈ 10) | RANKING.md §12 · future `src/lib/ranking.config.ts` |

## 3 · PROVISIONAL-OPS — ratified values, HARDEN-tunable

| Constant | Value | Lives at |
|---|---|---|
| `REDIS_MAX_RETRIES` / `REDIS_RETRY_BACKOFF_MS` / `REDIS_COMMAND_TIMEOUT_MS` | 1 / 200 ms flat / 2000 ms per-command abort | `limits.ts` · ADR-0015 Patch 2026-07-06 (B7a OD-1/OD-2) |
| `CLOSE_SWEEP_LOCK_TTL_SECONDS` | 55 s (under the per-minute cron cadence) | `limits.ts` (ENGINE.15 D-15.g) |
| `ALARMS_DRAIN_LOCK_TTL_SECONDS` / `ALARMS_DRAIN_BATCH_SIZE` / `ALARMS_DRAIN_FLUSH_TIMEOUT_MS` | 240 s / 200 / 2000 ms | `limits.ts` (AUDIT-FIX-B1 A7) |
| `ORPHAN_SWEEP_LOCK_TTL_SECONDS` / `ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD` / `ORPHAN_SWEEP_BATCH_SIZE` | 600 s / 5 / 100 | `limits.ts` (SCAFFOLD.15) |

**Reading rule:** if a probe's result depends on a §2 value, state the dependency —
"holds at the shipped placeholder; re-check after 2026-09-01 tuning" — rather than
treating the placeholder as contract.

---

*EXTAUDIT-06 kit · file 4 of 7.*
