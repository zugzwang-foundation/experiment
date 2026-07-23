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

## SCAFFOLD.16 §6 — Second moderation vendor deferred (Hive / PhotoDNA / Safer)

**Originating task:** SCAFFOLD.16 §6 (vendor research summary) + LD-1.

**Deferred work.** Introduce a second moderation vendor for CSAM hash matching (PhotoDNA-or-equivalent: PhotoDNA / Safer / Hive AI / equivalent). Add `src/server/moderation/photodna.ts` (or vendor-specific path) HTTP wrapper. Wire parallel `Promise.all` call in `precommitModerate()`. Reintroduce SPEC.1 + SPEC.2 framing for the second vendor (struck from SPEC framing per SCAFFOLD.16 LD-10 Position B).

**Why deferred.** Vendor-research round (2026-05-25) evaluated four CSAM-detection vendors: PhotoDNA (Microsoft) — gated multi-week vetting; Safer (Thorn) — gated 8-12 week onboarding; Hive AI CSAM Detection — rep-mediated 1-5 business days; Sightengine — does NOT offer CSAM-specific detection (only general moderation + "Child Detection" presence-of-minors signal, not exploitation material). No vendor in the CSAM-detection category offers truly instant self-serve API access. Operator scope decision 2026-05-25: defer all four to post-experiment or pre-launch; use OpenAI `omni-moderation`'s existing `sexual/minors` category as experiment-phase CSAM-proxy detection. LD-10 reopen 2026-05-26: Position B (complete removal of all PhotoDNA references from SPEC framing) — this `docs/parked.md` row is the sole record of optionality.

**Conditional trigger.** Operator decides to add a second vendor before or after launch. If pre-launch: Hive's rep-mediated onboarding (1-5 business days) is the fastest path. Filing the Hive contact form preserves optionality without committing.

**Expected next task.** Dedicated `MOD-VENDOR-SECOND` stratum (TBD) — re-adds SPEC.1 + SPEC.2 framing from scratch + adds vendor-specific wrapper + wires `Promise.all` call in `precommitModerate()`.

**Code touch points** (forward reference, do not act on now): `src/server/moderation/precommit.ts:21-25` (experiment-phase comment block points here); `src/server/config/limits.ts:88` (OpenAI snapshot pin comment points here); SPEC.1 §16.5 bullet 5 (experiment-phase carve-out points here); SPEC.2 §10 (vendor selection paragraph experiment-phase clause points here).

## SCAFFOLD.16 §6 — NCMEC CyberTipline reporting deferred

**Originating task:** SCAFFOLD.16 §6 (legal-floor framing) + LD-7.

**Deferred work.** Integrate NCMEC CyberTipline API for auto-report on confirmed CSAM detection (Track A path). Build pipeline that emits the report payload (account details, manually-reviewed media reference, timestamps) per NCMEC schema. Wire confirmation handling on report submission.

**Why deferred.** Resolution trigger: post-experiment per attorney consultation 2026-05. Integration ships post-incorporation. Attorney engagement confirmed deferral of NCMEC integration for the 7-week experiment window. Original brief framing was "launch-blocker before Sep 15"; updated per attorney consultation to post-experiment + post-incorporation timeline.

**Conditional trigger.** Post-experiment + post-incorporation + attorney sign-off on NCMEC integration scope.

**Expected next task.** Dedicated `MOD-NCMEC-INTEGRATION` stratum (TBD, post-experiment). Coupled with the second-vendor stratum if a hash-match vendor lands first (NCMEC reports typically reference hash-match evidence; a hash-match vendor is the upstream of the NCMEC report).

**Mechanic candidates** (carried for the future stratum): NCMEC CyberTipline API direct integration; intermediary platform (some vendors offer NCMEC reporting as a bundled service); manual report workflow (admin reviews flagged content + files via NCMEC web portal). Operator decision deferred to attorney sign-off + the future stratum kickoff.

## SCAFFOLD.16 §1.1 — Track A text/image asymmetry rationale (LD-3 design record)

**Originating task:** SCAFFOLD.16 §1.1 + LD-3.

**Deferred work.** Re-evaluate the Track A image-presence carve-out (LD-3) after experiment-phase data lands. If text-only `sexual/minors` Track B routing creates admin-queue burden disproportionate to legitimate-content volume, or if false-negative rates from the carve-out surface real CSAM-adjacent content evading auto-ban, the carve-out may need revisiting (tighten to score-floor + category-combination per R-1, or revert to text-only auto-ban with stricter false-positive mitigation).

**Why deferred.** LD-3 is the SCAFFOLD.16 design decision; this row preserves the rationale for future re-litigation. Rationale at decision time (2026-05-25 operator + 2026-05-25 research-brief findings):
1. **Structural alignment with model capability:** `sexual/minors` is text-only on `omni-moderation-2024-09-26` per OpenAI docs — image input always returns score 0 for this category. The carve-out aligns with what the classifier can actually attribute, not just a policy nuance.
2. **Industry practice:** Bluesky (1,154 NCMEC reports/2024, all manually-reviewed), Roblox Sentinel (recall-over-precision, all flags route to ex-FBI/CIA reviewers), Reddit (CSAM removal is hash-driven with human verification before NCMEC) all route text-only CSAM-adjacent signals to specialized human review regardless of score.
3. **False-positive risk profile:** text-only `sexual/minors === true` has elevated false-positive rate from news/fiction/educational content vectors; auto-ban on text-only signal is not done by any public production pipeline.
4. **Experiment-phase scope discipline:** simplest possible Track A predicate (`imageR2Key !== undefined && categories['sexual/minors'] === true`) over defense-in-depth (R-1 score floor + category combination) — operator decision 2026-05-25 to "keep it simple and easy to implement but fully operational — its just the experiment phase — I want no scoring — just a simple detect + block + ban."

**Conditional trigger.** Experiment-phase data analysis (post-Nov 6 2026 dataset release) surfaces either elevated text-only false-positive admin-burden OR elevated image-attached false-negative escape rate. HARDEN.5 sample-content testing (Aug 15-31) is the first formal evaluation gate; post-experiment data is the second.

**Expected next task.** Either HARDEN.5 close-out memo (if thresholds adjusted in pre-launch hardening) or post-experiment hardening stratum (if revisited post-Nov 6).

## SCAFFOLD.16 §research — R-1/R-2/R-3 hardening recommendations deferred to post-experiment

**Originating task:** SCAFFOLD.16 technical research brief `docs/briefs/SCAFFOLD.16-technical-research-brief.md` §"Operator scope decision" — operator chose Option (A) "Hold scope" 2026-05-25.

**Deferred work.** Three research-backed Stage-1 hardening recommendations:

- **R-1 — Track A predicate hardening.** Strengthen Track A predicate from boolean (`imageR2Key !== undefined && categories['sexual/minors'] === true`) to concurrent-signal AND: `imageR2Key !== undefined && categories['sexual/minors'] === true && categories['sexual'] === true && scores['sexual/minors'] >= 0.5 && category_applied_input_types['sexual/minors'].length > 0`. Three concurrent signals reduce false-positive base rate.

- **R-2 — Verdict-shape audit-defensibility expansion.** Add `triggeringModalities`, `rawScores`, `modelSnapshot`, `moderationCallMs` fields to `PrecommitResult`. Caller (DEBATE.2 etc.) writes these to the `mod_actions` row for audit defensibility. Do NOT add a `shouldAutoBan` boolean (encoded already in `outcome === 'track_a'`; parallel boolean creates drift risk).

- **R-3 — Retry policy expansion.** Expand `OPENAI_MAX_RETRIES` from 1 → 2 and `OPENAI_TIMEOUT_MS` from 3000 → 5000 with explicit handling of OpenAI's `invalid_image_url` error (HTTP 400 with `code: "invalid_image_url"` for R2→OpenAI transient image-fetch failures). Surfaces transient failures the current 3s budget sees as terminal.

**Why deferred.** Operator decision at SCAFFOLD.16 brief-drafting close 2026-05-25: "keep it simple and easy to implement but fully operational — its just the experiment phase — I want no scoring — just a simple detect + block + ban." Experiment phase is 7 weeks, expected volume is low (50K images / 7 weeks ≈ 0.5/min average — well under OpenAI Tier 1's effective ~6.94 RPM ceiling), false-positive cost is bounded (admin unban via existing F-ADMIN-* surfaces). Simplicity over defense-in-depth for this phase.

**Conditional trigger.** False-positive rates from real usage data, OR HARDEN.5 sample-content testing (Aug 15-31) surfaces a problem the simple-boolean predicate can't handle, OR a near-miss CSAM escape that R-1's defense-in-depth would have caught.

**Expected next task.** Post-experiment hardening stratum (TBD) OR HARDEN.5 close-out memo if pre-launch hardening absorbs.

## ENGINE.4 OQ-F(b) — SPEC.1 §2 glossary + ADR-0013 market-status wording drift → PRECURSOR.5

**Originating task:** ENGINE.4 OQ-F ruling (founder, 2026-06-05); same drift-class as the F-1 SPEC.2 listing already PRECURSOR.5-bound (`src/db/schema/markets.ts:13-14`).

**Deferred work.** Editorial-only SPEC/ADR fixes (F-4/F-6): SPEC.1 §2 glossary row — add `Draft`, say "seven" states, name the column `markets.status` (not `markets.state`); ADR-0013 — correct `markets.state` → `markets.status` and drop the reference to the non-existent `markets.resolving_at`.

**Why deferred.** ENGINE.4 reads `markets`/`pools` as built with no SPEC/ADR edits; consolidating the market-status wording sweep into PRECURSOR.5 beats scattering tiny SPEC/ADR riders across execute PRs. Drift is noted in-code, not fixed here.

**Conditional trigger.** PRECURSOR.5 (the SPEC.2 market-status listing reconciliation) runs.

**Expected next task.** PRECURSOR.5.

## AUDIT-FIX-B1 A7 — invalid-but-present Sentry DSN residual → HARDEN canary probe

**Originating task:** AUDIT-FIX-B1 A7 flush-before-stamp close-out (2026-07-04); surfaced by `@code-reviewer` + `@security-auditor` on the flush delta (PR #199).

**Deferred work.** A synthetic canary-event health probe that confirms Sentry is actually *ingesting* events (not merely that a DSN string is present), closing the invalid-but-present-DSN gap. The `alarms-drain` flush-before-stamp guarantees delivery only insofar as `Sentry.flush()` reflects real transport success; with an **invalid** (but non-empty) DSN the SDK's no-op/failing transport can resolve `flush()` in a way A18's presence-only boot check does not catch, so the drain could stamp `cron_alarms` rows (including `dharma_chain_drift`, the money-mint tripwire) without a real send.

**Why deferred.** The three DSN states form a ladder: flush-before-stamp closes the **valid-DSN Sentry-outage** case (PR #199); the **absent-DSN** case is closed by the A18 `register()` boot-throw for prod/staging (also PR #199); only the **invalid-but-present-DSN** case remains, and closing it needs an active probe (emit a known canary event, assert it lands) rather than a static presence check — a larger, standalone health-check surface out of B1's additive-only scope.

**Conditional trigger.** HARDEN observability pass, OR any incident where a Sentry alarm was expected but never arrived despite a configured DSN.

**Expected next task.** HARDEN.* observability hardening (TBD).

## SYNC-sweep — PAID (PR #218, 2026-07-07)

**Debt paid in full at PR #218 (branch `docs/sync-sweep`, 2026-07-07)** — one doc-only sweep PR covering the seven originating tasks (A1 #197 · B1 #199 · B2 #201 · B3 #202 · B7-A26 #209 · B7a #211 · B8 #216). Scope, one line: SPEC.2 §0 → **1.0.17** (+ §0.1 row · §19.3 `market_media`/`bet_receipts` enumeration · §22 rows ADR-0029/0030/0031 + counts — 30 ADRs = 29 files + 0012 in-flight, 27 accepted, range `0003–0031`) · SPEC.1 §0 → **1.0.14** (+ §20 row · F-BET-1 Errors + `comment_requires_bet`) · CLAUDE.md/AGENTS.md ADR-range + spec-version cites → 1.0.14/1.0.17 · deploy-pipeline.md §0 head `0023` + the §4 seed-staging OPEN note closed (strings already fixed pre-sweep at `b724094`). **Do not re-pay** — any future §0 bump starts from 1.0.14 / 1.0.17; the next sweep opens a fresh entry.

## AUDIT-FIX-B2 OQ-2 — app-as-owner role split (the only COMPLETE TRUNCATE fix)

**Originating task:** AUDIT-FIX-B2 A20 STEP-0 probe (2026-07-04, operator-ratified park; target **before Sep 15, 2026 launch**).

**Deferred work.** Provision a dedicated **non-owner runtime role** for the app connection (staging + prod Supabase) and re-point the Doppler `stg`/`prd` `DATABASE_URL` (and Vercel-synced env) at it: the app role must not OWN the 12 protected tables. Grant only the DML the handlers need (SELECT/INSERT everywhere; UPDATE only on Bucket-B whitelisted-transition tables + Bucket-C `positions`/`pools`/`markets`/auth tables); no TRUNCATE, no TRIGGER, no DDL.

**Why deferred.** The STEP-0 probe found the app role (Doppler `DATABASE_URL`) is **`postgres` — the table OWNER** on all 12 protected tables. TRUNCATE privilege **cannot be revoked from an owner** (owner privileges are implicit), so grant surgery is a no-op, and an owner-level attacker can also `ALTER TABLE … DISABLE TRIGGER` — i.e., migration 0021's BEFORE TRUNCATE guards (B2) close the accident/blast-radius/unsophisticated-injection class but NOT the owner-level class. The role split is Supabase role/connection/Vercel-env re-plumbing — its own hardening task, out of B2's additive-DDL scope. Recorded in ADR-0030.

**Conditional trigger.** Pre-launch hardening (target before Sep 15), OR any incident involving unexpected DDL/TRUNCATE from the app connection.

**Expected next task.** Dedicated HARDEN-ROLE-SPLIT task (TBD; pairs naturally with the RLS-out-of-scope posture review, ADR-0019).

## AUDIT-FIX-B2 OQ-3 — "D2-C" seq-ordered chain walk (closes the order-free detector blind spot)

**Originating task:** AUDIT-FIX-B2 detector-loop analysis (2026-07-04, operator-ratified park as fast-follow).

**Deferred work.** Add a third dharma-chain derivation to `check_nightly_drift()` — a strict per-user **seq-ordered walk** (`LAG(balance_after) OVER (PARTITION BY user_id ORDER BY seq)`; uncollectable rule: `balance_after = prev`) that alarms on the first broken link. Function-replace via the 0007→0011→0015 precedent (new migration re-states the full body; 0011/0015 stay append-only). The B2 PR's post-migration chain-vs-seq audit query (session log AUDIT-FIX-B2) is the exact walk — promote it from one-off query to detector clause.

**Why deferred.** D2-A/D2-B are order-free by ADR-0016 necessity (pre-seq, no trustworthy order existed). B2's migration 0020 makes a total order available for the first time, but folding a detector change into a ledger-fix PR grows a critical-path diff; and the A2 fix itself stops production of new forks, so the blind spot matters only for pre-fix or non-app corruption. Two zero-alarm **pin tests** document the residual live (`nightly-drift::pin-uncollectable-fork-evades-both-derivations-zero-alarms`, `nightly-drift::pin-balance-value-collision-fork-zero-alarms`) — D2-C's landing flips them to alarm, consciously.

**Conditional trigger.** Fast-follow after B2 merges (next maintenance window), OR any `dharma_chain_drift` alarm whose payload derivation is ambiguous, OR pre-launch HARDEN detector pass.

**Expected next task.** Dedicated fast-follow stratum (AUDIT-FIX-B2-FOLLOWUP or HARDEN.* detector pass).

## AUDIT-FIX-A22 [FU-1] — pool-consumption / user-insert non-atomicity (auth signup)

**Originating task:** AUDIT-FIX-A22 (PR #207, squash `b15a7f5`, 2026-07-06) — operator-ruled close-out filing; body verbatim from the close-out kickoff.

The identity-pool tuple is consumed in Better Auth's `user.create.before` hook (`identity-pool/consume.ts`, its own tx) and Better Auth's adapter INSERTs the `users` row separately — not one atomic transaction. A `users` INSERT that fails after the tuple is consumed leaves it marked `assigned_at` with no owning user: a burned pseudonym. Pre-existing property of the built architecture; recorded as an observation in SPEC.2 §3.5. A22 added audit-log completeness, not atomicity. Options at pickup: (i) move pool consumption into a we-own-it transaction that also inserts the user (the §3.5-original single-tx shape — larger refactor); (ii) a reconciliation pass reclaiming ownerless tuples; (iii) accept-for-experiment (bounded: finite pool, low INSERT-failure rate, 5% low-watermark alarm) and revisit at mainnet. Not scheduled; no live consequence unless the pool depletes.

## AUDIT-FIX-A22 [FU-2] — default-vs-SERIALIZABLE isolation on the two auth transactions

**Originating task:** AUDIT-FIX-A22 (PR #207, squash `b15a7f5`, 2026-07-06) — operator-ruled close-out filing; body verbatim from the close-out kickoff.

F-AUTH-3 (`identity-pool/consume.ts`) and F-AUTH-4 (`auth/tos-accept.ts`) open plain `db.transaction(...)` at default isolation, not the SERIALIZABLE the spec previously claimed (reconciled to default in SPEC.2 §3.5/§16 at A22). The double-assignment guard is the `FOR UPDATE SKIP LOCKED` row-lock, which holds at default isolation. Open correctness question: confirm default is sufficient for both flows (vs promoting to SERIALIZABLE), in particular any read-modify-write in the ToS-acceptance/grant path. Distinct from the W-1/W-3 bet/resolution wrappers, which are correctly SERIALIZABLE per ADR-0013 and out of scope here. Not scheduled.

## AUDIT-FIX-B7b security-auditor SURPRISE — XFF-spoofable `extractIp()` (rate-limit key + `events.metadata.ip`)

**Originating task:** AUDIT-FIX-B7b directed security audit (PR #213, squash `a66d359`, 2026-07-07) — out-of-scope SURPRISE per §5.11: **pre-existing, byte-identical to base `8ef34d4`, not touched by the B7b diff**; recorded, not absorbed.

**Deferred work.** Both sign routes derive the client IP for rate-limit bucketing AND for the append-only `events.metadata.ip` from a local `extractIp()` = LEFTMOST `x-forwarded-for` token (`src/app/api/uploads/sign/route.ts` ~:70; `src/app/(admin)/admin/markets/media/sign/route.ts` ~:90), which is client-controllable when chained — the per-IP mint caps (`imagePutUrlPerIp` / `adminMediaPutUrlPerIp`) are evadable by header rotation and the recorded IP is spoofable. The same local-helper pattern exists in `src/server/bets/endpoint.ts` (~:100, `betPerIp`). Fix direction: switch to Vercel's trusted `ipAddress()` (the parser `logRequest` already uses) or rightmost-hop parsing. **Same class as the SCAFFOLD.3-FOLLOWUP-1 security-auditor SURPRISE-1 row above** (auth `ipFromCtx`) — one HARDEN task should sweep all **seven** call sites in one pass (count corrected 4 → 7 at AUDIT-INV-A12: the four named here missed `auth/admin/login.ts`, `auth/tos-accept.ts`, and `admin/wire.ts`).

**Why deferred.** Pre-existing surface, out of B7b's five-finding scope. Mitigants bound the damage: rate-limit fails open by design (ADR-0015) so the cap is already advisory; the admin route requires a valid admin session before its rate-limit arm; the `logRequest` PII audit path uses the trusted `ipAddress()` parser, not `extractIp`.

**Conditional trigger.** HARDEN.* pre-launch security pass (fires together with the SCAFFOLD.3-FOLLOWUP-1 SURPRISE-1 row), OR first observed abuse pattern hitting a per-IP cap.

**Expected next task.** The same HARDEN task as SURPRISE-1 — a single trusted-IP sweep across all seven leftmost-XFF parse sites; the canonical site list (parser · file:line · what each keys) is the enumeration table in `docs/logs/AUDIT-INV-A12.md`. Severity context there too: AUDIT-INV-A12 confirmed A12 = G3 (Vercel overwrites inbound XFF on this deployment), so the sweep is consistency hardening, not a live spoof fix.

## EXTAUDIT-05 deviation (d) — unused `eq` import warning in moderation-blocked-event test

**Originating task:** EXTAUDIT-05 handover-deck gates (2026-07-14); surfaced by `just check` during the deck PR's verify pass (PR #220).

**Deferred work.** `tests/server/moderation/moderation-blocked-event.test.ts:1` imports `eq` from `drizzle-orm` unused — Biome `lint/correctness/noUnusedImports`, warning severity, FIXABLE. One-line deletion.

**Why deferred.** Pre-existing (AUDIT-FIX-B5 era, PR #205 lane); EXTAUDIT-05 is a docs-only lane (§5.3 surgical-changes — no adjacent code edits). Warning does not fail `biome check` or CI (ci green on #220).

**Conditional trigger.** Next code-adjacent sweep or any task already touching `tests/server/moderation/`.

**Expected next task.** Any SWEEP.* / HARDEN.* touching test hygiene — a `biome check --write` on the one file closes it.

## UI-6 Gate C D1 — review-feed prior-flag count is blind to content removals

**Originating task:** UI-6 (PR #262) S3 — `src/server/admin/moderation/review-feed.ts`; surfaced at Gate C (web diff-read).

**Deferred work.** `priorFlagCount` counts `mod_actions` by `target_user_id`, but `content_removed` rows carry `target_comment_id` only (no `target_user_id`) — so an author with N removed comments shows **0** prior flags. Fix = also count removals via a join through `comments` (`mod_actions.target_comment_id → comments.user_id`) and fold that into the per-author tally.

**Why deferred.** Display enrichment; the completeness + masking invariants are unaffected. Repeat-offender detection (the field's purpose) is degraded, not the moderation correctness.

**Conditional trigger.** Before TESTING.0 (repeat-offender detection is load-bearing there).

**Expected next task.** TESTING.0 prep, or any task next touching `review-feed.ts`.

## UI-6 Gate C D2 — moderation image TTL too short for a browsing surface

**Originating task:** UI-6 (PR #262) S3 — `review-feed.ts` image mint (`signRead(key, READ_URL_TTL_SECONDS_MODERATION)`, 60s).

**Deferred work.** 60s was sized for the precommit gate's mint-and-consume path; the review feed is a *browsing* surface, so after 60s every signed URL is dead — and renders as the browser's broken-image, NOT the "image unavailable" fallback (that fires only on a server-side mint failure at render time). DEBATE.4's render path uses 3600s. Needs its own moderation-feed TTL constant (longer), and possibly a client-side re-mint on expiry.

**Why deferred.** UX degradation on a slow browse, not a correctness/leak defect — the short TTL errs safe.

**Conditional trigger.** Before TESTING.0.

**Expected next task.** TESTING.0 prep, or any task next touching `review-feed.ts` / the moderation image path.

## UI-6 Gate C D3 — review-feed innerJoin(users) is a latent STOP #6 (verified safe today)

**Originating task:** UI-6 (PR #262) S3 — `review-feed.ts` completeness query; surfaced at Gate C.

**Verified now (Gate C, read-only):** no `users`-row hard-delete path exists anywhere in `src/`/`scripts/`, and `comments.user_id → users` is `onDelete: restrict`, which structurally BLOCKS deleting a user that has comments. The erasure / pseudonym-scrub path (N-9 / H2) does NOT delete the row — it KEEPS the `users` row and replaces the pseudonym with a bracketed `[scrubbed_user_N]` placeholder — so a scrubbed author's live content still appears in the feed (with the placeholder pseudonym). **The `innerJoin` drops no live row today.**

**Deferred work.** Defensive hardening against a *hypothetical future* users-row-delete path: convert the `innerJoin(users)` to a `leftJoin` with a placeholder pseudonym, so no future erasure path can ever silently drop a live comment from the feed (the STOP #6 failure mode).

**Why deferred.** Verified safe today; the `leftJoin` is future-proofing, not a live fix.

**Conditional trigger.** Verified at Gate C; convert at the next `review-feed.ts` touch.

**Expected next task.** DEBATE.7 (F-ADMIN-4 completion) or TESTING.0 — whichever next edits `review-feed.ts`.

## UI-6 Gate C D4 — no un-ban affordance (founder decision)

**Originating task:** UI-6 (PR #262) S3 — reactive Ban (`moderateComment({ action: 'ban' })`); surfaced at Gate C.

**Deferred work.** A misclicked Ban silences a participant for the remaining window; the only remedy today is a raw SQL write via `BREAK_GLASS`. Needs a **founder decision**: add an un-ban action, add a stronger confirm on Ban, or accept as-is.

**Why deferred.** A product/founder decision, not a UI-6 defect — UI-6 delivered the reactive Ban per the ratified plan; un-ban was never in scope.

**Conditional trigger.** Founder decision.

**Expected next task.** DEBATE.7 (F-ADMIN-4 completion), or a standalone founder ruling.

## STANDING CHECK — masking is a property of every body read, not of rows

**Originating task:** UI-6 follow-up (parent-snippet masking leak, PR after #262); surfaced on staging when a live reply rendered its `content_removed` parent's body via the review-feed snippet path.

**The rule (a standing review check, not a one-off task).** Removal masking is NOT a property of ROWS — it is a property of EVERY code path that reads `comments.body` (or any user argument text/teaser/snippet). The review-feed's main query anti-joined `content_removed` at the ROW level, but a SECOND read path in the same file (the parent-snippet fetch) read the body without the predicate and leaked it. So:

- **Any new/edited read path that touches `comments.body`** (directly, via a JOIN, via a parent/teaser/snippet lookup, or in raw SQL) **MUST intersect `loadRemovedSet` or the equivalent `mod_actions.reason='content_removed'` predicate** before that body can reach a DTO. A removed comment's body must be un-fetchable or un-renderable by construction (prefer a union type where the removed variant carries no body field).
- **Its test MUST assert the BODY's absence, not just the row's absence** — e.g. `expect(JSON.stringify(rows)).not.toContain(theBody)`, not only `expect(ids).not.toContain(theRow)`. Row-level exclusion assertions do not catch a second body-read path.

**Conditional trigger.** Every PR that adds or edits a read over `comments` on any surface (participant OR admin). Reviewer + `@security-auditor` checklist item.

**Expected next task.** No fix owed — this PR closed the review-feed instance and the audit page was verified clean. This entry is the durable guard so the lesson isn't re-learned.
