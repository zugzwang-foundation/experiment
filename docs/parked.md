# Parked items

Out-of-scope follow-up tasks tracked here per CLAUDE.md §7 "cleanup
absorption rule" — items genuinely out-of-scope for any current
task, parked until a real task picks them up.

Each entry names the originating task / section, the deferred work,
and the conditional trigger (when it becomes load-bearing).

---

## SCAFFOLD.12 §10.b — Resend domain verification + `RESEND_FROM_EMAIL` flip

**Originating task:** SCAFFOLD.12 §10.b (per Q3 resolved at
plan-review).

**Deferred work.** Verify the Resend production sender domain
(likely `zugzwangworld.com`) in Resend, then flip
`RESEND_FROM_EMAIL` from the sandbox sender
`onboarding@resend.dev` to a production sender on the verified
domain (candidate: `noreply@zugzwangworld.com` or alias of
`foundation@…` — that task's call, not this one's).

**Why deferred:** sandbox sender `onboarding@resend.dev` is
authorized to deliver to `zugzwangworld@proton.me` only, which
satisfied §7.3 Email-OTP verification at the new domain. Production
sender flip requires Resend domain verification (DNS records added
at Namecheap: SPF, DKIM, optional DMARC) plus a coordinated
`RESEND_FROM_EMAIL` env-var change. Out of SCAFFOLD.12 scope (domain
+ DNS cutover only).

**Conditional trigger:** Resend deliverability beyond
`zugzwangworld@proton.me` is required (e.g., for any non-Proton
recipient receiving an Email-OTP), OR brand consistency requires a
sender on the project's own domain.

**Expected next task:** likely SCAFFOLD.14, or a dedicated
SCAFFOLD-RESEND-DOMAIN task.

**Code touch points** (forward reference, do not act on now):
`src/server/auth/email-otp.ts:22` reads `RESEND_FROM_EMAIL` with
fallback to sandbox sender; the comment at lines 3-8 references
this parked row.

---

## SCAFFOLD.12 §10.c — Preview-env `BETTER_AUTH_URL` value flip

**Originating task:** SCAFFOLD.12 §10.c (per Q1 reversed Split → Both
at execute-time SURPRISE 5).

**Deferred work.** Preview-scope `BETTER_AUTH_URL` currently holds
the apex URL `https://zugzwangworld.com` (post-§6 Doppler edit +
Doppler→Vercel sync). Preview deployments at preview-alias URLs
(e.g., `experiment-abc123-zugzwang-worlds-projects.vercel.app`)
will have working Email-OTP at the preview origin (once FOLLOWUP-1
lands) but BROKEN Google OAuth: Better Auth constructs
`redirect_uri = {BETTER_AUTH_URL}/api/auth/callback/google = https://zugzwangworld.com/api/auth/callback/google`,
Google redirects there (apex, not preview origin), and the state
cookie set at the preview origin does not transfer cross-origin to
apex.

**Why deferred:** SCAFFOLD.12 was strictly the cutover task. SURPRISE
3 + SURPRISE 5 established that preview OAuth has never worked at
any URL; flipping Preview to a working state is its own coupled
work (requires §10.d coupled change to the Google OAuth client too).

**Conditional trigger:** any future task needs Google OAuth to work
end-to-end at preview deployments (e.g., for QA testing on a PR's
preview, or a future "preview-environment branding" need).

**Mechanic candidates** (carried from POTENTIAL SURPRISE 4 in
SCAFFOLD.12, MOOT post-SURPRISE-5; preserved here as reference for
the future task):

- **M1 — Vercel-direct override on Preview.** Keep Doppler `prd`
  `BETTER_AUTH_URL` at the chosen value (apex or preview-alias);
  add a Vercel-direct env-var entry at Preview scope holding the
  preview-alias URL. Vercel-direct overrides take precedence over
  Doppler-integration synced values per Vercel docs (NOT
  pre-verified empirically in this codebase).
- **M2 — Doppler config split.** Duplicate `prd` to `prd-preview`
  config; re-point Vercel→Preview integration sync to `prd-preview`;
  set `prd-preview` `BETTER_AUTH_URL` to the preview-alias URL.
  Cleaner separation; doubles Doppler config maintenance burden.
- **M3 — Doppler integration-sync key exclusion.** If Doppler
  supports per-key exclusion on a per-sync basis, exclude
  `BETTER_AUTH_URL` from the Preview sync; add Vercel-direct entry
  at Preview scope. Pre-verification needed on whether Doppler
  supports this.

Coupled with §10.d (preview-alias callback URI add to Google OAuth
client) — both must fire together for preview OAuth to work
end-to-end.

---

## SCAFFOLD.12 §10.d — Preview-alias callback URI add to Google OAuth client

**Originating task:** SCAFFOLD.12 §10.d (per execute-time SURPRISE 3
+ SURPRISE 5; new row added when §10.a "vercel-default URI cleanup"
was retired as moot).

**Deferred work.** If §10.c fires (Preview-scope `BETTER_AUTH_URL`
flips to a preview-alias URL), the Google OAuth client must also
gain the corresponding `/api/auth/callback/google` URI in its
Authorized redirect URIs list — otherwise Google rejects the OAuth
flow with `redirect_uri_mismatch` (the same failure mode SURPRISE 3
+ §4 transient window framing documented).

**Why deferred:** see §10.c; §10.d is the coupled OAuth-client-side
change. Without §10.c flipping the env var, the preview-alias URI
add is unused and clutters the OAuth client.

**Conditional trigger:** §10.c fires.

**Operator action when triggered:** Google Cloud Console → OAuth
2.0 Client → Authorized redirect URIs → Add
`https://<preview-alias>.vercel.app/api/auth/callback/google` (or
whichever preview-alias URL pattern §10.c picks). Vercel preview
aliases are per-deploy by default; the OAuth client URI list may
need to be a wildcard pattern OR the preview alias may need to be
pinned to a known stable subdomain. That is §10.d's design call,
not this PR's.

---

## SCAFFOLD.3-FOLLOWUP-1 §0.2 S3 — ADR backfill (0002 through 0017 missing from disk)

**Originating task:** SCAFFOLD.3-FOLLOWUP-1 §0 step-1 audit;
re-confirmed at execute-phase Phase 0.2 `find` (empty output for
`0004-better-auth*`).

**Deferred work.** Backfill ADRs referenced by SPEC.1 / SPEC.2 /
CLAUDE.md / AGENTS.md but missing from `docs/adr/`. Empirical
inventory at execute time:

- On disk: `0001-license-choice.md` only.
- Referenced (per `grep -ohE "ADR-00[0-9]{2}" docs/specs/SPEC.{1,2}.md CLAUDE.md AGENTS.md | sort -u`):
  ADR-0001 through ADR-0017.
- **Missing (16):** ADR-0002, ADR-0003, ADR-0004 (Better Auth),
  ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010 (admin
  auth), ADR-0011, ADR-0012, ADR-0013 (bet transaction), ADR-0014 (no
  HTTP-in-transaction), ADR-0015 (rate-limit / idempotency), ADR-0016
  (UUIDv7 IDs), ADR-0017.

**Why deferred:** scope creep. FOLLOWUP-1 is a code fix (Better Auth
Content-Type 415 + captcha coverage), not an ADR backfill task.

**Conditional trigger:** next task that touches a domain governed by
a missing ADR.

**Expected next task:** dedicated ADR-BACKFILL stratum, or absorption
by HARDEN.* pre-launch consolidation.

---

## SCAFFOLD.3-FOLLOWUP-1 security-auditor v3 SURPRISE-1 — IP-extraction trust chain (`X-Forwarded-For` leftmost-element issue)

**Originating task:** SCAFFOLD.3-FOLLOWUP-1 security-auditor pass
(Amendment 1.2 transition).

**Deferred work.** `src/server/auth/index.ts:104-110` (`ipFromCtx`)
takes `X-Forwarded-For.split(",")[0]` which is the LEFTMOST element —
attacker-controlled when chained. Defeats per-IP rate-limit
`otpRequestPerIpBurst` AND pollutes Cloudflare siteverify `remoteip`
field. Switch to Vercel-canonical `x-real-ip` or `request.ip` per
Next.js runtime; rightmost `X-Forwarded-For` element is the
trustworthy one in Vercel's edge.

**Why deferred:** pre-existing surface, not touched by FOLLOWUP-1's
Q6 change. Symmetric to the change so the SDK migration does not
amplify the risk.

**Conditional trigger:** HARDEN.* pre-launch security pass, OR first
observed abuse pattern hitting the per-IP rate-limit.

---

## SCAFFOLD.3-FOLLOWUP-1 security-auditor v3 SURPRISE-2 — First-request CSRF gap on `/sign-in/social` + `/sign-in/email-otp` + `/email-otp/send-verification-otp`

**Originating task:** SCAFFOLD.3-FOLLOWUP-1 security-auditor pass
(Amendment 1.2 transition).

**Deferred work.** Better Auth's `originCheckMiddleware` only
validates origin when cookies are present. First-time (cookie-less)
requests to `/sign-in/social`, `/sign-in/email-otp`, and
`/email-otp/send-verification-otp` are reachable cross-origin without
Sec-Fetch CSRF protection. Threat-model fit: low — initiating a
Google OAuth flow cross-origin still requires victim consent at
Google's UI; can't auto-complete sign-in. Email-OTP cross-origin send
is rate-limited per-IP/per-email.

**Why deferred:** pre-existing Better Auth design choice, not
introduced by FOLLOWUP-1. Threat-model fit is low.

**Mitigation candidates:** (a) ask Better Auth maintainers for
`formCsrfMiddleware` on social + email-otp paths, OR (b) implement
repo-side `Sec-Fetch-Site` check at the catch-all wrapper
(`src/app/api/auth/[...all]/route.ts:21-66` is the right hook point).

**Conditional trigger:** HARDEN.* pre-launch security pass.
