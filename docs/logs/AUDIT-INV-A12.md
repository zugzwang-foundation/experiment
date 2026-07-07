# AUDIT-INV-A12 — session log (recon verdict + close-out)

**Task:** AUDIT.1 endgame verification — READ-ONLY recon, no fixes/plans/code: (a) the INV-A12
Vercel-XFF trust verdict (G1 vs G3), (b) queue-state verify for AUDIT-FIX-B4 / INV-A12 /
AUDIT-FIX-B8, (c) B8's D1–D4 holds-vs-fixed on live main, (d) SYNC-sweep entry readiness. Recon
baseline: `origin/main` = `ef62d73` (PR #214 squash; working tree verified byte-identical). This
close-out PR is the session's only write: this log + the parked.md XFF site-count correction.

## A12 verdict — G3 CONFIRMED (leftmost-XFF is NOT attacker-controlled on our deployment)

**Platform evidence** — fetched 2026-07-07 from `vercel.com/docs/headers/request-headers` (page
last-updated 2025-12-13), verbatim:

> **`x-forwarded-for`** — The public IP address of the client that made the request. If you are
> trying to use Vercel behind a proxy, we currently overwrite the `X-Forwarded-For` header and
> **do not forward external IPs**. This restriction is in place to prevent IP spoofing.
>
> **Custom `X-Forwarded-For` IP** — 🔒 Permissions Required: Trusted Proxy. **Enterprise
> customers** can purchase and enable a trusted proxy to allow your custom `X-Forwarded-For` IP.
>
> **`x-vercel-forwarded-for`** — This header is identical to the `x-forwarded-for` header.
> However, `x-forwarded-for` could be overwritten if you're using a proxy on top of Vercel.
>
> **`x-real-ip`** — This header is identical to the `x-forwarded-for` header.

**Topology evidence (repo-side).** The trusted-proxy passthrough is an Enterprise
purchase-and-enable feature; this project is on **Pro** (SPEC.2 §3.4 notes Pro is what enables the
sub-daily cron cadence) with no trusted proxy configured. No proxy sits in front of Vercel: DNS is
plain Namecheap records (parked.md SCAFFOLD.12 §10.b entry — SPF/DKIM added at Namecheap), and the
app is reachable only via the Vercel edge (`docs/runbooks/staging-provisioning.md:170` already
reasons from "the platform-set XFF"). Even a future proxy-on-top would make XFF the proxy's hop IP
(Vercel still overwrites) — a fidelity issue, never a spoof vector; `x-vercel-forwarded-for` is
the header that survives that topology.

**Consequence.** On this deployment the header reaching the function contains exactly ONE
platform-set token — client-supplied values are discarded, not appended. Leftmost = only = real
client IP. The master-report annex's escalation trigger ("if Vercel appends the true IP to a
client-supplied XFF chain") is precisely what Vercel documents it does not do. `adminLoginPerIp`
(10/hour) buckets on an unspoofable key, so the §8.4 admin brute-force guard holds: **the G1
trigger is not met → A12 = G3** (consistency hardening: centralize the seven hand-rolled parsers
on the trusted `ipAddress()` from `@vercel/functions`, which the log lane already uses at
`src/server/middleware/logging.ts:3` + `:43`).

**B4 stays de-queued.** The 2026-07-04 operator scope amendment
(`AUDIT-1_scope-amendment_2026-07-04.md`, off-repo) removed B4 ("**B4 (admin auth) removed** from
the AUDIT.1 fix queue"; A12 "**Won't-fix** (already LOW)"). Its A12 premise — "Vercel overwrites
inbound XFF on standard deploy, so not spoofable" — is now confirmed at the primary source by this
recon. Nothing re-queues.

## Leftmost-XFF call-site enumeration — SEVEN sites on main @ `ef62d73` (canonical list)

The parked B7b entry said four (`ipFromCtx` + three `extractIp` copies); live main has seven.
This table is the canonical site list for the future HARDEN trusted-IP sweep.

| # | Parser | Defined at | Used at | Keys |
|---|---|---|---|---|
| 1 | `extractIp` | `src/server/bets/endpoint.ts:100` | `:284`, `:325`, `:342` | `betPerIp` limiter (30/min) for `/api/bets/place` + `/api/bets/sell` (shared `runBetEndpoint`), + `events.metadata.ip` via `buildBetMetadata` |
| 2 | `extractIp` | `src/app/api/uploads/sign/route.ts:70` | `:116–117`, `:171` | `imagePutUrlPerIp` limiter (10/min), + `events.metadata.ip` |
| 3 | `extractIp` | `src/app/(admin)/admin/markets/media/sign/route.ts:90` | `:122–123` | `adminMediaPutUrlPerIp` limiter (10/min; behind the admin-session check) |
| 4 | `getClientIp` | `src/server/auth/admin/login.ts:55` | `:137`, `:140` | `adminLoginPerIp` limiter (10/hour) — the SPEC.2 §8.4 admin brute-force guard |
| 5 | `ipFromCtx` | `src/server/auth/index.ts:109` | `:122`, `:158–159`, `:94` | `otpRequestPerIpBurst` limiter (10/min) + Turnstile siteverify `remoteip` (`otpRequestPerEmail` is email-keyed, not IP) |
| 6 | `getIp` | `src/server/auth/tos-accept.ts:67` | `:107` | no limiter — `events.metadata.ip` only (ToS-accept + initial-grant events) |
| 7 | `getClientIp` | `src/server/admin/wire.ts:76` | `:107` | no limiter — `buildAdminMetadata.ip` for all admin market actions (create/seed/close/resolve/correct/void) + the cron close-due-markets route |

All seven take `split(",")[0]` (leftmost). Sites 1–5 key limiters; 6–7 feed append-only events
metadata only. A HARDEN sweep is a seven-site pass, not four.

## A11 correction — stale premise, disposition UNCHANGED

The 2026-07-04 amendment's A11 won't-fix rationale reads "Admin-only, single-user,
**Turnstile-gated**". That premise is **false on live main**: admin login carries NO Turnstile —
removed post-Q1 (`src/server/auth/admin/login.ts:15` "post-Q1 amendment: NO Turnstile";
`src/app/(admin)/admin/login/page.tsx:7` "Single password field, no Turnstile (Q1 — SPEC.1 line
609)"). The **disposition stands unchanged**: A11 is the timing-parity leak (the rate-limited arm
skips `constantTimeDelay()`), not an IP-keyed finding; the operative brute-force guards are
`adminLoginPerIp` (10/hour, platform-unspoofable per the verdict above) + `ADMIN_PASSWORD`
entropy. Recorded here so the Nov-6 audit trail carries the accurate premise, not the stale one.

## What landed

- **This PR** (branch `chore/inv-a12-log`, doc-only): `docs/logs/AUDIT-INV-A12.md` (this log) +
  `docs/parked.md` B7b XFF entry corrected — call-site count 4 → 7, canonical-enumeration pointer
  to this log, and a one-line severity pointer (G3, not a live spoof fix).
- Nothing else — the recon itself was read-only per kickoff (no code, no spec, no plan file).

## Decisions made

- **A12 = G3** (evidence above); tier ratification is the operator's, off the recon report.
- **B4 stays de-queued** per the 2026-07-04 amendment; A11's stale "Turnstile-gated" premise
  corrected in the record, disposition untouched.
- parked.md correction scoped surgically to the count + pointer (the entry's HARDEN routing,
  mitigants, and cross-link to the FOLLOWUP-1 SURPRISE-1 row are unchanged).
- Recon ran as a single sequential read-only pass (house rule) — no subagents, no workflows.

## Open questions

- **B4 tier + B4/B8/sweep order** — operator ratification pending (recon report is with web).
- **B8 scope should be FIVE items, not four:** D1–D4 **plus** the B1-folded §16.3(7)⇄§17.6(8,
  +`request_id`) request-log reconciliation carrying the A17 admin-representation question
  (`docs/plans/AUDIT-FIX-B1.md:79`; `docs/logs/AUDIT-FIX-B1.md:26–28`). Web to fold at B8 kickoff.

## Next session starts at

Whichever the operator sequences off the recon report: **B8** (D1–D4 + the §16.3 fold-in),
the **SYNC.* sweep** (parked entry current: six originating tasks / four targets), or the
**HARDEN trusted-IP sweep** (seven-site table above). Fresh chat + `/clear`, VERIFY-LIVE against
then-current main.

## Context to preserve

- **D1–D4 ALL HOLD on main @ `ef62d73`** — nothing was absorbed by the B-series riders
  (`docs/specs/cpmm.md` has ZERO commits since the audit HEAD `16bb728`): D1 — cpmm.md §8.2
  (`:399–411`) + §11 INV-C4 still describe the pre-R-9.8 net-flow-reversal void model while
  `src/server/resolution/void.ts:27` implements R-9.8 `f × stake` (sale proceeds stand). D2 —
  SPEC.2 `:508` (§5.1 comments row) + `:2707` (B.6) still enumerate `comments.market_media_id`
  FK + not-both-set CHECK as built; schema + migrations (head `0023`) lack them. D3 — Appendix
  B.15 (`:2843`) still lists six columns, no `content_type`/`byte_size`. D4 — the §4.3 catalogue
  (`:415–437`) still omits `GET /api/cron/close-due-markets` + `_smoke-error` (zero "smoke"
  matches in SPEC.2) while listing the unbuilt dataset/manifest route; the §4-closer (`:485`)
  still says "the single Vercel Cron target".
- **SYNC-sweep parked entry is CURRENT:** six originating tasks (A1, B1, B2, B3, B7-A26, B7a) /
  four targets; B7b owes nothing (`a66d359` touched no `docs/specs/` file — squash-stat
  verified). Count quirk to reconcile at sweep: target 1 says "29 ADRs", target 3 says "30 ADRs"
  (the ADR-0001 inclusion question). If the sweep runs after B8, B8's D1 fix adds a cpmm.md
  MAJOR bump not in the entry.
- **AUDIT-FIX-B4 / AUDIT-FIX-B8 have ZERO repo record** (no logs, plans, PR titles, parked
  entries); every docs `B4`/`A12` token is another namespace (SPEC.1 §10.7 clause "B4",
  SCAFFOLD.13 steps, ENGINE.3 amendment "A12"). B8's only substance: the amendment table row
  ("B8 | Spec/doc drift (D1–D4) — doc | G2 (D1)") + the B1 fold-in above. The amendment also
  cites a superseded `AUDIT-1-fix-queue-sequencing.md` — not found locally (web-side artifact).
- **macOS git-grep gotcha (bit this recon):** `\b` in `git grep -E` silently matches nothing on
  macOS — a `\b`-anchored token sweep returned false-zero hits until re-run with `-w`.
- **Fix direction for the HARDEN sweep:** the trusted `ipAddress()` parser
  (`@vercel/functions`), already imported at `src/server/middleware/logging.ts:3`; on-Vercel it
  reads the same platform-set value, so the swap is consistency, not behavior change.

## Time

2026-07-07 (IST), one session: read-only recon (Vercel-docs fetch + seven-site enumeration +
queue-state / D1–D4 / sweep verification, incl. the `\b`-grep re-run) ≈50 min · recon report
≈15 min · close-out (this log + parked.md fix + PR) ≈20 min.
