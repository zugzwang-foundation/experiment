# SCAFFOLD.12 — Domain + DNS setup (`zugzwangworld.com` → Vercel)

> Plan-mode scratch. After approval, promote to `docs/plans/SCAFFOLD.12.md` and commit on the SCAFFOLD.12 branch before any vendor-UI step (CLAUDE.md §5.1).

## Context

The experiment app currently serves out of the Vercel-default URL
`https://experiment-zugzwang-worlds-projects.vercel.app` (canonical
`BETTER_AUTH_URL` after the SCAFFOLD.13-B SURPRISE 3 surgical fix).
That URL is a deploy alias, not a brand identity, and is unsuitable
as the production origin for Devcon 8 (15 Sep – 5 Nov 2026).

This task attaches `zugzwangworld.com` (owned, Namecheap PremiumDNS,
DNSSEC on, Proton-Mail-MX wired) as the custom apex domain on the
Vercel project `experiment`, retires the Vercel default URL as the
canonical origin, and updates the Google OAuth client redirect URI
list to match. Apex-only for the experiment phase (`www` → apex 308
via Vercel edge); subdomain architecture is testnet-phase scope.

Critical-path (auth + domain cutover): CLAUDE.md §5.10 pre-PR
self-audit + §5.11 security-auditor reviewer call apply. Symmetric
pre-verification rule from SCAFFOLD.13-B carries forward — every
vendor-UI prescription below was pre-verified by web Claude in the
kickoff; failure of any prescription in practice → STOP + request
re-verification (do not improvise).

## Open questions resolved at plan-review

- **Q1 — Preview `BETTER_AUTH_URL`:** **Split.** Production scope
  flips to `https://zugzwangworld.com`; Preview scope unbundles from
  the current grouped value and stays at
  `https://experiment-zugzwang-worlds-projects.vercel.app`. §10
  (old Google OAuth redirect URI cleanup) defers indefinitely until
  Preview is later flipped.
- **Q2 — Env-var actor for §6:** **Operator via Vercel Dashboard.**
  Matches 13-B precedent across all credential mutations. CC issues
  the prescription, operator executes, CC verifies via `vercel env ls`.
- **Q3 — Resend `RESEND_FROM_EMAIL` flip:** **Follow-up, not in this
  task.** `RESEND_FROM_EMAIL = onboarding@resend.dev` (sandbox)
  stays for §7 Email-OTP verification (sandbox delivers to
  `zugzwangworld@proton.me`). Resend domain verification + flip
  belongs to a later task (likely SCAFFOLD.14). Tracked at §10.

Hard-coded URL check (kickoff open question 2) confirmed via Phase 1
Explore: zero matches for `experiment-zugzwang-worlds-projects`
outside `docs/logs/` and `.claude/scratch-*.md`. No source code paths
hard-code the old URL.

## SURPRISES caught at plan-time

1. **Kickoff §0.4 referenced `.vercel/project.json`; the actual file
   in this repo is `.vercel/repo.json`** (local-only by Vercel
   design, gitignored per `.gitignore` line 60). §0.4 below verifies
   presence + content, not git-tracking. Carries forward 13-B
   SURPRISE 5 (`vercel` CLI resolves the project via directory-name +
   user-context inference, not via committed repo metadata).
2. **§6 transient window.** Between §4 (TLS cert valid → new domain
   live + serving) and end-of-§6 (redeploy completes with new
   `BETTER_AUTH_URL`), any OAuth attempt at `https://zugzwangworld.com`
   will fail: Better Auth still constructs the callback URL from the
   old `BETTER_AUTH_URL`, Google redirects to the old origin, the
   state cookie set on the new origin does not transfer. Plan §6
   below pins explicit operator instruction: do NOT test OAuth at
   the new domain during this window.
3. **ADRs 0004 / 0006 / 0010 do not exist yet** (only ADR-0001 in
   `docs/adr/`). The kickoff and CLAUDE.md treat these as
   load-bearing references — decisions documented in `docs/plans/
   SCAFFOLD.1.md` / SCAFFOLD.3.md / SCAFFOLD.13-B.md and SPEC.1 §13.
   Not blocking this task. ADR backfill is a separate maintenance
   line.

## Surface separation (do not violate)

- **Operator (Hrishikesh):** runs all vendor-UI clicks — Namecheap
  PremiumDNS, Vercel Domain Settings, Vercel Environment Variables,
  Google Cloud Console OAuth client, Proton Mail. Pastes redacted
  screenshots or copy-pasted text to CC at each gate.
- **Claude Code:** issues prescriptions, runs read-only verifications
  (`dig`, `vercel domains inspect`, `vercel env ls`, `git ls-files`),
  invokes security-auditor reviewer call, writes logs + PR. NEVER
  fires vendor-UI clicks.
- **Web Claude:** pre-verification reference (already captured in
  kickoff), SURPRISE adjudication during execute, close-out support.
  NOT firing tool calls during this task.

When a step requires operator action, CC outputs the prescription
and STOPs. CC waits for explicit operator confirmation (redacted
screenshot or copy-pasted text) before proceeding to the next
step-group.

## Pre-verified vendor mechanics (do not re-derive)

### Vercel custom-domain configuration

- **Apex A record value:** read from Vercel Domain Settings card OR
  `vercel domains inspect zugzwangworld.com`. Default for Hobby/Pro
  is `76.76.21.21` but project-specific IPs occur — do NOT hard-code,
  read from Vercel.
- **`www` CNAME target:** read project-specific value from Vercel
  Domain Settings card OR `vercel domains inspect`. Format:
  `<hash>.vercel-dns-NNN.com`. The older generic `cname.vercel-dns.com`
  is outdated.
- **`www` → apex redirect:** Vercel Domain Settings → www card →
  Edit → "Redirect to" = `zugzwangworld.com`. Edge-side 308; no app
  code.
- **TLS:** Vercel auto-provisions Let's Encrypt on DNS validation.

### Better Auth Google OAuth callback URL

- **New production redirect URI:**
  `https://zugzwangworld.com/api/auth/callback/google` (path fixed
  by Better Auth; do not alter `/api/auth/callback/{provider}`).
- **`BETTER_AUTH_URL`** is read by Better Auth at init
  (`src/server/auth/index.ts:42–44`, passed as `baseURL` at line
  188). No hard-coded fallback. Updating it requires redeploy.

### Google Cloud Console OAuth client behavior

- **Adding a redirect URI is purely additive.** Does NOT rotate
  `GOOGLE_CLIENT_SECRET`. Old + new can coexist (dual-active).
- **Secret rotation is a separate, explicit operator action.** Do
  not invoke it during this task.

### Namecheap PremiumDNS posture

- Domain registered, PremiumDNS active, DNSSEC enabled, auto-renew
  through 2 Mar 2031.
- Existing records (read-only inventory): 3 Proton DKIM CNAMEs, 1
  Proton verification TXT, 1 SPF TXT, 2 Proton MX records. None
  conflict with the A + CNAME this task adds.
- **Do NOT change nameservers** (DNSSEC).

### Email — `foundation@zugzwangworld.com`

Already provisioned as Proton Mail alias. No DNS changes for email
in this task. Verification = external→inbox test email at §7.5.

## Standing refusals (operator-set; non-negotiable)

- Refuse non-trivial code without a spec.
- Refuse to skip subagent review on critical-path PRs (THIS task is
  critical-path; security-auditor is required at §8).
- Refuse to silently absorb scope creep — surface scope deltas at
  step-group boundaries.
- Refuse to make domain decisions affecting production posture
  without operator sign-off.
- Refuse to commit operator-supplied secret material (DNS API tokens,
  email provider creds, OAuth client secrets) to the repo.
- "Confirm" / "Continue" / "Trust me" at a gate → explicit
  verification request, not silent accept.
- No-screenshot-with-reveal: operator confirmations may be redacted
  screenshots or copy-pasted text; NEVER request screenshots showing
  secret material.
- Operator-authority HIGH-finding closure (§8) requires explicit
  audit trail in PR description or `docs/logs/SCAFFOLD.12.md`. Not
  closed by verbal assertion.

## Plan

### §0 — Pre-flight

- **§0.1** CC reads predecessor context: `docs/logs/SCAFFOLD.13-A.md`,
  `docs/logs/SCAFFOLD.13-B.md`, `docs/logs/FOUND.2.md` (if present),
  ADR 0004 / 0006 / 0010 backfills (if present), tracker v9 row for
  SCAFFOLD.12. (Phase 1 Explore findings stand in for this if CC
  has them in-session.)
- **§0.2** Operator reads Vercel Dashboard → Project `experiment` →
  Settings → Environment Variables → `BETTER_AUTH_URL`. Confirms
  current Production value is
  `https://experiment-zugzwang-worlds-projects.vercel.app`. Also
  confirms the source-of-truth for this env var: is it managed via
  the Doppler→Vercel integration (visible in Vercel as
  integration-linked, value greyed-out) or set directly in Vercel
  (manually editable in the dashboard)? This determines whether §6
  edits happen in Doppler (with Vercel sync) or directly in Vercel.
  The user-facing instruction in §6 (edit value, then trigger manual
  redeploy) is unchanged either way; only the §6 reason-for-manual
  framing differs. Reports via redacted screenshot or copy-pasted
  env var inventory (value-only, not the cluster of all 12 keys).
- **§0.3** Operator reads Google Cloud Console → OAuth 2.0 Client
  IDs → the experiment client → Authorized redirect URIs. Reports
  the current URI list (copy-pasted text).
- **§0.4** CC verifies `.vercel/repo.json` exists locally and carries
  the expected project linkage. File is local-only by Vercel design
  (`.vercel/README.txt`: "you should not share the '.vercel' folder
  with anyone"); gitignored per `.gitignore` line 60. Verification
  mechanic:
  - `test -f .vercel/repo.json` — confirms presence on disk
  - `cat .vercel/repo.json` — content must include:
    - `id: prj_5krm0VEQQ9TleA2rjUBIL3oLJpiI`
    - `orgId: team_m0d8TiC9xuPrm9qI8ob6byBM`
    - `name: experiment` (Vercel CLI uses `name`, not `projectName`)
    - `directory: "."`
  - `git check-ignore -v .vercel/repo.json` — confirms the file is
    matched by `.gitignore` line 60 (`.vercel`); expected output
    references that rule
  Linkage is via `vercel` CLI directory + user-context inference, not
  via committed repo metadata (per 13-B SURPRISE 5 forward-relevance).
- **§0.5** Operator reads Namecheap → `zugzwangworld.com` →
  Advanced DNS → record list. Confirms baseline (3 Proton DKIM
  CNAMEs, 1 Proton verification TXT, 1 SPF TXT, 2 MX). Reports
  whether any CAA records exist. If yes → CC adds `0 issue
  "letsencrypt.org"` requirement to §3. If no → CAA omitted (default
  behaviour allows any CA).

**Batching (nice-to-have):** §0.2 / §0.3 / §0.5 may be reported by
the operator in a single consolidated reply if convenient. CC issues
all three prescriptions together at session start and waits for one
response (rather than gating sequentially). §0.4 is CC-side and
independent.

Gate: §0 PASS = §0.1 read + §0.2/§0.3/§0.5 operator reports + §0.4
file present and correct.

### §1 — Google OAuth Client: additive redirect URI

- Operator-side: Google Cloud Console → OAuth 2.0 Client → Authorized
  redirect URIs → Add `https://zugzwangworld.com/api/auth/callback/google`.
- Save. Old URI stays. Result list = old + new (dual-active).
- No env var change. No deploy. No git op.
- Operator confirms via redacted screenshot or copy-pasted updated
  URI list. CC verifies new entry present, old entry retained.

Gate: §1 PASS = updated URI list contains exactly the old URI plus
the new URI. No other changes.

### §2 — Vercel custom domain add

- Operator-side: Vercel Dashboard → Project `experiment` → Settings
  → Domains → Add Domain. Add `zugzwangworld.com` and (separately)
  `www.zugzwangworld.com`.
- Vercel displays "Invalid Configuration" with required DNS values
  (A IP for apex; CNAME target for www).
- Operator captures exact DNS values (screenshot or copy-pasted)
  and pastes to CC. Alternatively: operator runs `vercel domains
  inspect zugzwangworld.com` locally and pastes output.

Gate: §2 PASS = both domains added in Vercel, exact DNS A value and
CNAME target captured.

### §3 — Namecheap PremiumDNS: A + CNAME records (+ CAA if §0.5)

- Operator-side: Namecheap → `zugzwangworld.com` → Advanced DNS →
  Add New Record:
  - Type `A`, Host `@`, Value `<from §2>`, TTL Automatic
  - Type `CNAME`, Host `www`, Value `<from §2>` (project-specific
    hash), TTL Automatic
- If §0.5 reported existing CAA records: also add Type `CAA`,
  Host `@`, Tag `issue`, Value `letsencrypt.org`, TTL Automatic.
- Save records. Operator confirms via redacted screenshot of record
  table.

Gate: §3 PASS = A + CNAME records visible in Namecheap with the
exact values from §2.

### §4 — DNS propagation + TLS cert verification

- CC-side: `dig @8.8.8.8 zugzwangworld.com A +short` (explicit
  Google public resolver) → should resolve to the A value from §2
  within ~minutes (Namecheap PremiumDNS propagation is typically
  <5 min globally). Also run `dig zugzwangworld.com A +short`
  (default resolver — likely the operator's ISP or local
  forwarder) for comparison; both should agree.
- CC-side: `dig @8.8.8.8 www.zugzwangworld.com CNAME +short` →
  should resolve to the CNAME target from §2. Also run with default
  resolver for comparison.
- Operator-side: Vercel Domain Settings card for both domains shows
  "Valid Configuration" and TLS cert "Issued" (Let's Encrypt
  auto-issued on DNS validation).
- **Stop condition:** if validation has not succeeded after 15 min,
  STOP. Re-read DNS records at Namecheap, re-verify they match §2
  values exactly. Do not proceed until both domains valid.

Gate: §4 PASS = both `dig` queries resolve to expected values AND
both Vercel domain cards show Valid + TLS Issued.

**⚠ Transient OAuth-break window opens here.** New domain is live
and serving, but `BETTER_AUTH_URL` still references the old origin.
OAuth at `https://zugzwangworld.com` will fail for ANY visitor — not
just the operator — because Better Auth constructs the callback URL
from `BETTER_AUTH_URL` (still pointing at the old origin), Google
redirects there, and the state cookie set on the new apex does not
transfer cross-origin. **Mitigation:** zero pre-publication state.
The new domain is not yet linked from anywhere, no users are aware
of it, and ingress in this window is bounded to deliberate operator
visits. The user-impact dimension is acknowledged but functionally
absent given the pre-publication posture. **Operator: do NOT test
OAuth at `https://zugzwangworld.com` between §4 and end-of-§6.**
Window closes after §6 redeploy completes.

### §5 — Vercel: configure `www` → apex 308 redirect

- Operator-side: Vercel Dashboard → Domain Settings →
  `www.zugzwangworld.com` card → Edit → "Redirect to" field →
  `zugzwangworld.com`. Default 308 status, edge-side.
- Operator confirms via redacted screenshot showing `www` card with
  redirect target visible.

Gate: §5 PASS = www card shows redirect to apex; no app-code edit
required.

### §6 — Vercel env var update: `BETTER_AUTH_URL` Production-only

Per Q1 (Split) + Q2 (Operator via Dashboard):

- Operator-side: Vercel Dashboard → Settings → Environment Variables
  → `BETTER_AUTH_URL`.
- The current entry is grouped across Production + Preview with
  value `https://experiment-zugzwang-worlds-projects.vercel.app`.
- Unbundle into two scopes:
  - **Production:** value = `https://zugzwangworld.com`
  - **Preview:** value = `https://experiment-zugzwang-worlds-projects.vercel.app`
    (unchanged from current)
- Save. Operator confirms via redacted screenshot showing both
  scopes with their values.
- CC verifies via `vercel env ls` that two `BETTER_AUTH_URL` entries
  exist with scopes split as Production + Preview, and that the
  modified-at timestamp on the Production entry has just updated.
  **Vercel env values are write-only post-set** — `vercel env ls`
  surfaces metadata (name, scopes, modified-at) but NOT the value
  itself; neither does `vercel inspect` read env values. The actual
  value being correct is proven functionally at §7.2 (Google OAuth
  completes end-to-end at the new domain), not by value read-back.
- Operator triggers production redeploy: Vercel Dashboard →
  Deployments → most recent Production deploy → "Redeploy" (without
  build cache OK; with cache also fine for env-only change). Env-var
  changes in Vercel do not propagate to running deployments without
  a redeploy — this is standard Vercel behaviour regardless of the
  source-of-truth determined at §0.2 (Doppler-managed: edit in
  Doppler, sync to Vercel, then redeploy; Vercel-direct: edit in
  Vercel, then redeploy). The 13-B carry-forward (Doppler→Vercel
  auto-redeploy did not fire that session) reinforces the contract:
  this task treats manual redeploy as required, never assuming
  auto-redeploy.
- Operator confirms redeploy completed via Vercel Dashboard
  Deployments listing. CC verifies by checking that a new Production
  deployment with "Ready" status exists with a timestamp post-§6
  env-edit.

Gate: §6 PASS = `vercel env ls` shows split entries (Prod + Preview)
with the Production entry modified-at timestamp post-§6 start, AND
a new Production deployment is "Ready" post-env-edit, AND
`https://zugzwangworld.com` returns a 200 for `/sign-in`. Functional
correctness of the env value itself is proven at §7.2, not here.
Transient OAuth-break window closes at this gate.

### §7 — End-to-end verification

Operator-side, from a clean incognito browser session. CC does not
proceed to §8 until all 5 subtests PASS.

- **§7.1** Navigate to `https://zugzwangworld.com/sign-in`. Page
  loads with valid TLS (no cert errors), renders SCAFFOLD.3 sign-in
  surface (Google + Email-OTP options).
- **§7.2** Test Google OAuth: click "Sign in with Google" → consent
  screen → returns to `https://zugzwangworld.com` with established
  session. No `redirect_uri_mismatch` from Google. Confirms §1 +
  §6 wired correctly.
- **§7.3** Test Email-OTP: enter `zugzwangworld@proton.me`,
  receive OTP from `onboarding@resend.dev` (sandbox sender per Q3),
  enter code, session established. Confirms `BETTER_AUTH_URL` flip
  did not break the email-OTP flow.
- **§7.4** Navigate to `https://www.zugzwangworld.com/sign-in`.
  Browser shows 308 redirect to `https://zugzwangworld.com/sign-in`
  in the network tab; final page loads correctly. Confirms §5
  wired correctly.
- **§7.5** From an external email account (any non-Proton), send a
  short test email to `foundation@zugzwangworld.com`. Confirm
  receipt in the Proton Mail inbox routed for that alias. Confirms
  the existing Proton MX records still route correctly (no
  disruption from the A + CNAME additions in §3).

Operator reports PASS/FAIL for each subtest. Any FAIL → STOP, do
NOT proceed to §8. Diagnose root cause: most likely §3 DNS, §5
redirect config, or §6 env var/redeploy.

Gate: §7 PASS = 5/5 subtests pass.

### §8 — security-auditor reviewer call

CC invokes per CLAUDE.md §5.11 — a fresh-context `general-purpose`
Agent invocation with the `.claude/agents/security-auditor.md` role
briefing baked into the prompt + this plan path
(`@docs/plans/SCAFFOLD.12.md` once promoted) + tool-scope constraints
(Read, Grep, Glob, Bash only; no Edit/Write).

Scope of audit:

- Env var changes (Production-scope split for `BETTER_AUTH_URL`;
  rest of env inventory unchanged).
- Google OAuth client redirect URI list (dual-active old+new).
- DNS configuration at Namecheap (A + CNAME additions; existing
  Proton records untouched; CAA if added).
- TLS posture (Let's Encrypt cert valid on apex + www).
- Secret material handling during cutover (no creds in repo, no
  creds in logs, screenshots redacted per no-screenshot-with-reveal
  rule).
- Dual-active credential window posture (old redirect URI still in
  Google OAuth client; Preview env still at old default URL).
- INV-1/INV-2/INV-3/INV-4 enforcement gaps — expect "no diff in
  src/server/ — invariants not touched in this task" verdict.

Output format per CLAUDE.md §5.10:

- **PASS** items: itemize with brief justification.
- **FAIL** items (CRITICAL / HIGH): fix in-session before PR open.
  If fix requires operator-side action, surface to operator,
  capture audit trail in PR description / `docs/logs/SCAFFOLD.12.md`.
- **SURPRISE** items: write to `claude-progress.md` and STOP — do
  not silently expand scope.

Gate: §8 PASS = security-auditor returns PASS verdict OR all
FAIL/HIGH findings closed with audit trail.

### §9 — Pre-PR self-audit + PR open + merge

- **§9.1 Pre-PR self-audit (CLAUDE.md §5.10):** CC walks this plan
  item by item, reporting PASS / FAIL / SURPRISE for:
  - §0.1–§0.5 (predecessor read + operator reports + file checks)
  - §1 (Google OAuth URI additive add)
  - §2 (Vercel domain add, DNS values captured)
  - §3 (Namecheap A + CNAME + optional CAA)
  - §4 (DNS propagation + TLS cert validation)
  - §5 (www → apex redirect)
  - §6 (env var split + redeploy)
  - §7 (5 verification subtests)
  - §8 (security-auditor verdict)
  FAIL items fix in-session before PR open. SURPRISE items surface
  for operator decision.
- **§9.2** CC opens PR against `main`:
  - Title: `chore(scaffold-12): zugzwangworld.com domain cutover`
  - Description includes:
    - Summary (env vars + Vercel Dashboard + Namecheap + Google OAuth;
      no source code changes expected)
    - §8 security-auditor verdict (and audit trail for any
      HIGH-finding closures)
    - Operator-confirmation log of all vendor-UI steps
    - §7 verification artifacts (redacted; PASS confirmations)
    - §9.1 self-audit walk: PASS/FAIL/SURPRISE per plan item
    - Link to `docs/logs/SCAFFOLD.12.md`
  - Files in this PR: `docs/plans/SCAFFOLD.12.md`,
    `docs/logs/SCAFFOLD.12.md`, possibly `docs/parked.md` (§10 row).
    Likely zero changes under `src/`.
- **§9.3** Operator reviews PR, approves, squash-merges to `main`.

Gate: §9 PASS = PR open with green checks, self-audit clean,
operator approval, squash-merge to main.

### §10 — (Deferred) Follow-ups tracked at PR close

Per Q1 (Split) + Q3 (Follow-up):

- **§10.a Old Vercel-default URI cleanup** from Google OAuth client.
  Per Q1: deferred indefinitely until Preview env is later flipped
  to a new value. Add row to `docs/parked.md` referencing
  SCAFFOLD.12 §10.a.
- **§10.b Resend domain verification + `RESEND_FROM_EMAIL` flip.**
  Per Q3: deferred to a later task (likely SCAFFOLD.14). Add row
  to `docs/parked.md` referencing SCAFFOLD.12 §10.b. The candidate
  flip target (`noreply@zugzwangworld.com` vs alias of
  `foundation@…`) is that task's call, not this one's.
- **§10.c Preview-env `BETTER_AUTH_URL` posture.** If a later task
  requires preview OAuth to work at canonical preview alias URLs,
  the Google OAuth client may need additional redirect URIs added.
  Add row to `docs/parked.md`.

These rows in `docs/parked.md` ship in this PR (per CLAUDE.md §7
cleanup absorption rule — these are not stratum-scope absorbable
under 2h, so they become real follow-up tasks tracked in `parked.md`,
not embedded backlog).

### §11 — Exit criteria checklist (all must be green for PR merge)

- [ ] §1: New Google OAuth redirect URI added; old retained
- [ ] §2: Both `zugzwangworld.com` + `www.zugzwangworld.com` added
      in Vercel; DNS values captured
- [ ] §3: A + CNAME records added at Namecheap (+CAA if §0.5
      flagged it)
- [ ] §4: `dig` confirms propagation; Vercel cards show Valid + TLS
      Issued for both domains
- [ ] §5: `www` → apex 308 redirect configured in Vercel
- [ ] §6: `BETTER_AUTH_URL` split (Prod=new, Preview=old) + manual
      redeploy completed
- [ ] §7.1: `https://zugzwangworld.com/sign-in` loads, no cert errors
- [ ] §7.2: Google OAuth completes end-to-end at new domain
- [ ] §7.3: Email-OTP completes end-to-end at new domain (sandbox
      sender + Proton inbox)
- [ ] §7.4: `https://www.zugzwangworld.com` 308-redirects to apex
- [ ] §7.5: External email → `foundation@zugzwangworld.com` received
      in Proton
- [ ] §8: security-auditor PASS or HIGH findings closed with audit
      trail
- [ ] §9.1: Pre-PR self-audit clean
- [ ] §9.2: PR open with required content
- [ ] `docs/logs/SCAFFOLD.12.md` committed
- [ ] `docs/parked.md` rows for §10 added
- [ ] §9.3: PR squash-merged to `main`

### §12 — Session log (`docs/logs/SCAFFOLD.12.md`)

CC writes the log BEFORE PR open per CLAUDE.md §5.9. Schema:

- **What landed** — files changed (likely doc-only:
  `docs/plans/SCAFFOLD.12.md`, `docs/logs/SCAFFOLD.12.md`,
  `docs/parked.md`), PR #, vendor-UI deltas (Google OAuth URI add,
  Vercel domains added, Namecheap records added, www→apex redirect,
  `BETTER_AUTH_URL` Production split).
- **Decisions made** — Q1 Split / Q2 Operator-Dashboard / Q3
  Follow-up, plus any in-flight choices.
- **Open questions** — none expected, but any SURPRISE adjudication
  outcomes land here.
- **Next session starts at** — likely either SCAFFOLD.13-A or the
  next tracker-v9 SCAFFOLD row depending on operator routing.
- **Context to preserve** — old default URL still serves; old
  Google OAuth redirect URI still active; Preview env still on old
  default URL; Resend sandbox sender still in use.
- **Surprises caught + fixed in-session** subsection per memory
  `feedback_audit_surprises.md` — at minimum the plan-time
  SURPRISES (`.vercel/repo.json` filename, §6 transient window).

Convention: commit message
`chore(scaffold-12): log session — domain cutover complete`.

## Critical files

Read-only verification (no edits expected unless SURPRISE forces a
code touch):

- `/Users/hrishikesh/code/zugzwang/experiment/.vercel/repo.json`
  (§0.4 — verify present + correct linkage)
- `/Users/hrishikesh/code/zugzwang/experiment/src/server/auth/index.ts`
  (§0.1 reference — confirms Better Auth reads `BETTER_AUTH_URL`
  with no fallback; lines 42–44, 188)
- `/Users/hrishikesh/code/zugzwang/experiment/src/app/api/auth/[...all]/route.ts`
  (§0.1 reference — confirms callback handler path
  `/api/auth/callback/google` derived from Better Auth catch-all)
- `/Users/hrishikesh/code/zugzwang/experiment/src/server/auth/email-otp.ts`
  (§7.3 reference — confirms `RESEND_FROM_EMAIL` env var read at
  line 22)
- `/Users/hrishikesh/code/zugzwang/experiment/.env.example` (§0.1
  reference — confirms env var inventory)

Created in this task:

- `/Users/hrishikesh/code/zugzwang/experiment/docs/plans/SCAFFOLD.12.md`
  (promoted from this scratch plan after operator approval)
- `/Users/hrishikesh/code/zugzwang/experiment/docs/logs/SCAFFOLD.12.md`
  (§12 session log)
- `/Users/hrishikesh/code/zugzwang/experiment/docs/parked.md`
  appended with §10 follow-up rows

## Verification (re-stated end-to-end)

- §0 read + report gates pass
- §1 OAuth URI additive add verified by operator screenshot
- §2 domains added + DNS values captured
- §3 Namecheap records added per §2 values
- §4 `dig` + Vercel card validation
- §5 redirect screenshot
- §6 split env var + redeploy completion
- §7 five-subtest live verification at new domain
- §8 security-auditor PASS
- §9.1 pre-PR self-audit clean
- §9.2 PR with required content
- §9.3 squash-merge to main
- §11 exit criteria checklist green

## What CC is NOT doing in this task

- NOT running Namecheap UI clicks
- NOT running Vercel Domain Settings UI clicks
- NOT running Vercel Environment Variables UI clicks
- NOT running Google Cloud Console UI clicks
- NOT registering domains, transferring, or changing nameservers
- NOT modifying DNSSEC settings
- NOT touching Proton Mail configuration
- NOT generating, rotating, or moving any OAuth client secret
- NOT making subdomain decisions (apex-only confirmed for experiment
  phase)
- NOT flipping `RESEND_FROM_EMAIL` in this PR (Q3 → follow-up)
- NOT cleaning up the old Google OAuth redirect URI in this PR (Q1
  → §10.a follow-up)
- NOT closing security-auditor HIGH findings by verbal assertion

## First action when execute mode begins

1. Operator confirms plan approval (via ExitPlanMode → accept).
2. CC creates branch `feat/scaffold-12-domain-cutover` (or similar
   per conventional commits / kickoff scope).
3. CC promotes this scratch plan to
   `docs/plans/SCAFFOLD.12.md` and commits — convention
   `plan(scaffold-12): promote plan` — per CLAUDE.md §5.1.
4. CC begins §0.1 (re-read predecessor context if cleared), then
   prompts operator for §0.2 / §0.3 / §0.5 reports.
