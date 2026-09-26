# ADR-0061 — Trusted client IP behind Cloudflare and the ALB

| | |
|---|---|
| **Status** | proposed (awaiting operator review, S-1) |
| **Date** | 2026-09-26 |
| **Deciders** | Hrishikesh (operator), Claude Code |
| **Tracker task** | AWS-MIGRATION · S-1 (`docs/aws-migration/06-STAGING-DEPLOYMENT.md` §10.2) |
| **Frame document** | SPEC.2 §3.7 (event metadata `ip`), §4.6 / §11 (per-IP rate-limit surfaces), §18 (threat model), §19.4 / Appendix B (dataset stripping) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | ADR-0060 — closes, in code, the "trusted client-IP source behind the ALB" item it left open; origin authentication (F1) remains open |
| **Amended-by** | — |

---

## Context and Problem Statement

Nine call sites derived the client IP independently, all the same way: the **first** entry of
`X-Forwarded-For`. On Vercel that was accidentally safe, because Vercel overwrites the header. On
AWS it is not: the Application Load Balancer **appends** the address it accepted the connection
from, so the first entry is whatever the client sent. Cloudflare, proxying `zugzwangworld.com`
(orange-cloud), does the same — it appends the real client after any value the client supplied.

What read that value:

| Consumer | Consequence of a forged value |
|---|---|
| `adminLoginPerIp` (`auth/admin/login.ts`) | the ONLY brute-force control on the admin password (no Turnstile, by ruling) is bypassed by rotating the header |
| `otpRequestPerIpBurst` (`auth/index.ts`) | OTP email sends unbounded per attacker (Resend spend, inbox abuse) |
| `betPerIp`, `imagePutUrlPerIp`, `visitsPerIp` | backstop limits bypassed (R2 spend for image PUT URLs) |
| event metadata `ip` (bets, admin, ToS, admin media) | an attacker-chosen address — including a real third party's — written into **append-only audit rows** (Bucket A, unrecallable). SPEC.2 Appendix B strips `metadata.ip` from the dataset; §3.7 line 246 says the opposite (see F4) |
| Better Auth's built-in rate limiter + `sessions.ip_address` | same first-hop read (`better-auth/dist/utils/get-request-ip.mjs`, default `["x-forwarded-for"]`) |
| request log `ip` column | forged diagnostics |

## Decision Drivers

1. Only a header **our own edge** wrote can be believed; everything else is client input.
2. "A Cloudflare address" is not "OUR Cloudflare zone": the ranges are shared by every Cloudflare
   customer and by consumer products (WARP, Workers). Membership in them is not an identity.
3. Merging must not weaken today's Vercel production.
4. A mistake or a stale list must fail **safe** — to a coarser key, never to a client-chosen one.
5. The derivation must not depend on `proxy.ts` running (it went unbuilt for the project's whole
   life — AWS-MIGRATION-3).
6. One implementation, structurally guarded, instead of nine copies.

## Considered Options

1. **Peer-anchored helper; `CF-Connecting-IP` only on AWS, only from a Cloudflare peer, and
   (once configured) only with our zone's origin-auth header** ← chosen
2. Always trust `CF-Connecting-IP` — rejected: the ALB and `*.vercel.app` are publicly reachable.
3. Trust the peer only, never `CF-Connecting-IP` — rejected on AWS: behind Cloudflare every user
   would key on a handful of edge addresses (shared buckets, e.g. ten OTP sends a minute per edge).
   It IS today's Vercel behaviour, and is kept there (driver 3).
4. Compute once in `proxy.ts` and forward a header — rejected by driver 5.
5. Rely on an ALB listener rule / security group for origin authentication only — rejected as the
   sole control: it does not exist on Vercel and drifts silently with infra edits; kept as
   defense in depth (F1).

## Decision

`src/server/middleware/client-ip.ts` — `getClientIp(get)`:

1. **Vercel (`process.env.VERCEL === "1"`)**: `x-real-ip`, which Vercel overwrites. Nothing else is
   read. This equals today's production behaviour (Vercel's XFF first hop is the same address).
2. **AWS — peer.** The **last** `X-Forwarded-For` entry: the ALB appends it
   (`routing.http.xff_header_processing.mode = append`, the default), and the service security
   group admits only the ALB, so it cannot come from the client.
3. **AWS — Cloudflare.** `CF-Connecting-IP` is believed only if the peer is inside Cloudflare's
   published ranges (hard-coded, fetched 2026-09-26, matched with `node:net` `BlockList`) **and**
   the request came from our zone: when the runtime secret `ZZ_CF_ORIGIN_SECRET` is set, the
   header `x-zz-cf-origin-auth` must equal it (constant-time over SHA-256 digests). A missing or
   malformed `CF-Connecting-IP`, or a failed origin check, yields the edge address.
   ⚠ With `ZZ_CF_ORIGIN_SECRET` unset the origin check passes — see Residual risk R1.
4. **AWS — otherwise** the peer itself: a request sent straight to the ALB is attributed to its
   real source, whatever `X-Forwarded-For` or `CF-Connecting-IP` it carried.
5. **Validation.** `net.isIP`; ports, brackets, zone ids, lists and junk rejected; IPv4-mapped
   IPv6 unwrapped; IPv6 lower-cased. No valid address → `null`; call sites keep their existing
   fallbacks (`"unknown"` for rate-limit keys and metadata, `null` for the log column).
6. **Better Auth.** `advanced.ipAddress.ipAddressHeaders = ["x-zz-client-ip"]`. The single auth
   mount (`app/api/auth/[...all]/route.ts`) passes each request through `withTrustedClientIp`,
   which deletes any client-sent `x-zz-client-ip` and sets it from the helper; `tos-accept.ts`
   stamps it on its direct `auth.api.issueOnboardingSession` call.
7. **Guards** (`tests/unit/middleware/client-ip-call-sites.test.ts`): no file under `src/` other
   than the helper names `x-forwarded-for`, `cf-connecting-ip`, `x-real-ip`, `true-client-ip`,
   `forwarded`, `x-zz-client-ip` or `@vercel/functions`; every `auth.handler(` call receives
   `withTrustedClientIp(`; `ipAddressHeaders` is exactly the stamp. Each has a positive control.

## Assumptions (each is a condition for the decision to hold)

- A1. On AWS the task is reachable ONLY through the ALB (service SG ingress = ALB SG; no public IP;
  no in-container proxy). Verified in `network-stack.ts`, `compute-stack.ts`, `Dockerfile`.
- A2. The ALB keeps XFF processing in `append` mode. `preserve` would hand the peer slot to the
  client; `remove` would make every peer `null` (see M-2 for what null costs). Not pinned in CDK
  today — F3.
- A3. Exactly one appending proxy of ours sits in front of the app. Enabling CloudFront
  (`cloudFrontEnabled`, currently false) would make the last hop CloudFront's edge and must
  revisit this ADR.
- A4. Cloudflare's ranges are as listed. A new, unlisted range fails safe (edge address as key).
- A5. `VERCEL=1` is set by Vercel at runtime and not in the AWS image or task definition. If it
  were missing on Vercel, the AWS branch would run; since Vercel overwrites XFF, the last hop is
  still the connecting address, but the Cloudflare branch would become reachable.
- A6. **UNMEASURED.** When a client sends TWO `X-Forwarded-For` header lines, the ALB's appended
  address still ends up LAST once the lines are joined (Fetch `Headers` and Node join repeated
  lines in arrival order). If the ALB appended to an earlier line, a client could place a forged
  value last — and a forged Cloudflare-range value there would reach the Cloudflare branch.
  **Launch check:** before cutover, send a two-line XFF request direct to the staging ALB and
  observe what the task receives (needs a separately approved staging debug route or log line).

## Residual risks (stated as accepted-until-fixed, with their launch status)

- **R1 · Any Cloudflare-sourced request is trusted on AWS until F1 is configured. LAUNCH BLOCKER.**
  The ALB is internet-reachable. A request from anywhere inside Cloudflare's ranges — plausibly
  at zero cost via WARP, a free Workers `fetch()` or a free zone pointed at the ALB name
  (unmeasured; the argument does not depend on which works) — sets its own `CF-Connecting-IP`
  and so rotates EVERY per-IP key (`adminLoginPerIp`, `otpRequestPerIpBurst`, `betPerIp`,
  `imagePutUrlPerIp`, `visitsPerIp`) and attributes any address it likes, including a real third
  party's, in append-only `events`/`admin_events` rows and `sessions.ip_address`. The code path
  that closes this exists (`ZZ_CF_ORIGIN_SECRET`); it becomes effective only when the operator
  approves a Cloudflare Transform Rule and the secret (F1). Does NOT affect Vercel (Decision 1).
- **R2 · IPv6 is keyed at /128.** A subscriber holding a /64 can rotate addresses inside it. Not a
  spoof and not a regression, but per-IP limits are weaker for IPv6 clients (F5).
- **M-1 · Null path, Better Auth.** With no trusted IP the stamp is absent; Better Auth then
  records an empty `ip_address` and **skips its own rate limit** for that request. Unreachable
  while A1/A2/A5 hold; reachable only on infra drift. Accepted; F3 is what keeps it unreachable.
- **M-2 · Null path, app limits.** Every call site maps null to the literal `"unknown"`, and
  `ipIdentifier` is identity, so all underivable requests share ONE key per surface. Fail-closed
  against an attacker, but on systemic drift: ten admin-login attempts per hour for everyone
  (an attacker could lock the operator out — the limit is checked before the password), and ten
  OTP sends per minute product-wide. Unreachable while A1/A2/A5 hold. See F6.
- Traffic reaching the ALB without passing our Cloudflare zone bypasses Cloudflare's WAF/DDoS layer
  (F1 security-group half).
- Server code passing raw request headers into `auth.api.*` forwards any client-sent
  `x-zz-client-ip`. Eight call sites do (`getSession` in the auth layout, the public session
  helper, the quote route, the uploads sign route, the bets endpoint, onboarding completion;
  `signOut` twice). None records or gates on an IP: Better Auth writes `ip_address` only in
  `createSession`, `session.disableSessionRefresh` is on, and its rate limiter runs on the HTTP
  router only. **Any new `auth.api.*` call that CREATES a session must stamp the header itself.**

## Consequences

- Positive: header forgery with `curl` no longer steers any per-IP control or stored `ip` on AWS;
  Vercel production is unchanged; stored `ip` values are now always a validated IP literal or
  `"unknown"` (previously any comma-free string of header length reached Bucket-A rows); one
  derivation, structurally guarded.
- Negative / accepted: R1 until F1; R2; M-1/M-2 on drift; the Cloudflare list is a maintained
  constant (F2).

## Follow-ups

- F1. **LAUNCH BLOCKER — authenticate our Cloudflare zone.** (a) Cloudflare Transform Rule on
  `zugzwangworld.com` adding `x-zz-cf-origin-auth: <secret>`; (b) `ZZ_CF_ORIGIN_SECRET` in the
  production app secret (and `RUNTIME_SECRET_KEYS`); (c) defense in depth: an ALB listener rule
  rejecting requests without the header, and the ALB security group limited to Cloudflare's
  ranges. (a)+(b) close R1 in the helper on their own. Each step needs operator approval.
- F2. Refresh the Cloudflare list before cutover and periodically; consider a CI diff against the
  published lists.
- F3. **LAUNCH BLOCKER (was optional).** Pin in CDK that the ALB sets
  `routing.http.xff_header_processing.mode = append` and
  `routing.http.drop_invalid_header_fields.enabled = true`, with a synth test. Measure A6.
- F4. SPEC.2 §3.7 line 246 is wrong twice: it names `proxy.ts` as the source of `ip` (never true)
  and says `ip` is "included in dataset release", contradicting §19.4 / Appendix B (`STRIP_KEY`).
  Surface to the operator; resolve with a SPEC.2 version entry. Not resolved here.
- F5. Key per-IP limits on the canonicalised IPv6 /64 while keeping the full address in metadata
  and logs. Changes rate-limit behaviour; own approval.
- F6. **LAUNCH BLOCKER (recommended by `@security-auditor`, SR-2).** A global, IP-independent cap on
  admin-login attempts, so the admin password's brute-force protection does not rest on the IP
  derivation at all. Cheaper than F1 and removes the highest-value target from R1 and M-2.

## Verification

`tests/unit/middleware/client-ip.test.ts` — Cloudflare-proxied IPv4/IPv6; spoofed XFF (through
Cloudflare and direct; duplicate header lines); forged `CF-Connecting-IP` direct; missing/malformed
Cloudflare header; direct/untrusted requests; Vercel mode (never reads `CF-Connecting-IP`); origin
secret set/unset/wrong/non-Cloudflare peer; IPv4-mapped IPv6; the Better Auth stamp.
`tests/unit/middleware/client-ip-call-sites.test.ts` — the guards in Decision 7.
`tests/server/middleware/logging.test.ts`, `tests/server/auth/tos.test.ts` — updated consumers.
Nothing is deployed for this ADR; A6 and the live direct-to-ALB spoof check belong to the next
approved staging or production rollout.
