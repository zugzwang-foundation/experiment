# S-1 — trusted client IP behind Cloudflare → ALB → ECS

**Status:** approved 2026-09-26 (operator: "Proceed with S-1 only"). Working tree only — no deploy,
no commit, no infra change, staging untouched. Decision record: ADR-0061.

**Scope.** Replace the nine private first-hop `X-Forwarded-For` parsers, and Better Auth's
default IP read, with one peer-anchored helper.

| Area (CLAUDE.md §1) | Files |
|---|---|
| new helper | `src/server/middleware/client-ip.ts` |
| 1 bets | `src/server/bets/endpoint.ts` |
| 4 auth | `src/server/auth/admin/login.ts`, `src/server/auth/index.ts` (OTP hook + `advanced.ipAddress`), `src/server/auth/tos-accept.ts`, `src/app/api/auth/[...all]/route.ts` |
| 5 moderation/admin | `src/server/admin/wire.ts`, `src/app/(admin)/admin/markets/media/sign/route.ts` |
| ordinary | `src/app/api/uploads/sign/route.ts`, `src/app/api/visits/route.ts`, `src/server/middleware/logging.ts` |

**Out of scope (recorded in ADR-0061 Follow-ups):** ALB SG restricted to Cloudflare ranges; SPEC.2
metadata-table correction; Cloudflare list refresh automation.

## Tests (regression guards — the helper was written first; each spoof row asserts the forged value never returns)
- `tests/unit/middleware/client-ip.test.ts` — Cloudflare-proxied v4/v6; spoofed XFF (via Cloudflare, direct);
  forged CF-Connecting-IP direct; missing/invalid CF header; no headers; unparsable last hop; Vercel mode;
  IPv4-mapped IPv6; Better Auth stamp overwrite/delete/body-preserve.
- `tests/unit/middleware/client-ip-call-sites.test.ts` — single-reader structural guard with positive control.
- `tests/server/middleware/logging.test.ts` — the "first hop" row inverted to "last hop".

## Review rounds (same day)
- `@code-reviewer`: structural guards added (stamp / `Forwarded` / `@vercel/functions`; `auth.handler` wrap; `ipAddressHeaders` pin); `as` casts dropped; orphan `@vercel/functions` mock removed; duplicate-XFF-line row + ADR A6; ADR inventory corrected.
- `@security-auditor` H-1: Vercel mode no longer reads `CF-Connecting-IP` (today's behaviour kept); AWS Cloudflare branch gated on `ZZ_CF_ORIGIN_SECRET` / `x-zz-cf-origin-auth` (inert until F1 is approved). ADR rewritten: R1/R2/M-1/M-2, F3 and F6 promoted to launch blockers, F4 widened.

## Gate
Affected suites + `ZUGZWANG_ENV=preview just verify`; `@code-reviewer` then `@security-auditor` (areas 1/4/5).
