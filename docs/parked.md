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

## SYNC-sweep — spec/doc reconciliation owed by AUDIT-FIX-A1 + AUDIT-FIX-B1 + AUDIT-FIX-B2 + AUDIT-FIX-B3 (FOUR targets)

**Originating task:** AUDIT-FIX-A1 (PR #197, squash `4350406`) + AUDIT-FIX-B1 (PR #199, squash `72ce26c`) + AUDIT-FIX-B2 (PR #201, squash `7fc4c60`) + AUDIT-FIX-B3 (rider commit on `fix/audit-fix-b3`; PR# in `docs/logs/AUDIT-FIX-B3.md`) — all landed same-commit spec riders but none ran the §0 version/changelog bump nor the ADR-index/footer count reconciliation (per CLAUDE.md §7 these are a periodic SYNC sweep, not per-task). **FOUR distinct targets** — the sweep must not do the SPEC.2 §0 bump alone and miss the SPEC.1 bump + the ADR-index/footer reconciliation. State verified current 2026-07-05 (B3 extension same day).

**Deferred work (all four).**

1. **SPEC.2 §0 — version + change log** (currently **v1.0.15**). Bump + add §0.1 change-log row(s) covering:
   - **A1** riders — §12.2 / §12.3 (write-once `If-None-Match: *` PUT + pre-moderation `HeadObject` verify) · §10 (pre-moderation object verify) · the §22 ADR-0028 row (already in the table). ADR-0028 = moderated-image byte-identity binding.
   - **B1** riders — §17.2 (row 2 `events_default_nonempty` drain-side transport; row 4 `openai_moderation_upstream_failure` pin; new row 9 `bet_handler_internal_error`; count-prose eight→nine) · §17.3 6c (`headObject` 4th `r2_unavailable` source).
   - **B2** riders — §5.1 row 2 (`dharma_ledger` seq clause) · Appendix B.7 (new `seq` column row) · §6 intro + §6.1 clauses 1&2 + §6.2 addendum (`enforce_bucket_a_no_truncate()`, 25 triggers, forward obligation) + §6.5 owner-privilege reconciliation (ADR-0029 / ADR-0030).
   - **B3** riders (ADR-0031 + ADR-0015 Patch; landed same-commit `fix/audit-fix-b3`) — §3.1 durable pre-check · §3.2 W-1 receipt · §5.1 row 10 (`bet_receipts`) + §5.2 (Bucket A 9→10, protected 12→13) · §6.2 (10 tables, 20+26 triggers) · §7.3 (third idempotency layer) · §9 (receipt append) · §11 (durable pre-check step 3a + ownership-checked never-throws release + alarm-6b two-site) · §15.4 (+1 → **39** codes: `error_position_conflict`; `insufficient_shares` joins the aggregated participant set) · §17.2 alarm-9 sibling tags + §17.3 6b two-site · §19.3 (`bet_receipts` excluded-entirely, 2→3). **Also owed (pre-existing drift surfaced at B3):** §19.3's total-table prose predates `market_media` (ADR-0026) — the §19.3 shipped/excluded enumeration omits it entirely; reconcile against §5.1 (24 tables) in the sweep.
   - The §0 status-header ADR line ("25 ADRs at `0003–0027`") also moves to **29 ADRs at `0003–0031`** (it lives in §0; +ADR-0031, and the ADR-0015 Patch record is not a new ADR).

2. **SPEC.1 §0 — version + change log** (currently **v1.0.13**; re-verify at sweep). Bump + add a change-log row for **A1's §16.5** CSAM-compliance rider (swap-window-closure note) and **B3's §7 F-BET-3** rider (oversell `insufficient_shares` pre-check + error row + acceptance rows + the `bet_receipts` durable-backing note, ADR-0031). B1 and B2 did not touch SPEC.1.

3. **SPEC.2 §22 ADR-index.** §22.1 currently reads "**26 ADRs** … `0003–0027`" (26 = ADR-0001 + 0003–0027 per BC.2). The ADR-0028 **row** is already in the §22 table (A1 — target 1's "§22 ADR-row"); B2 deliberately added **no** §22 rows, and B3 added none — so the sweep owes **three new table rows (ADR-0029, ADR-0030, ADR-0031)** plus the **count-prose** → **30 ADRs**, range `0003–0031` (the ADR-0015 Patch record is an in-place amendment, not a new §22 row — optionally annotate the existing ADR-0015 row).

4. **CLAUDE.md + AGENTS.md footers.** Both "Rebuilt at …" footers cite "**ADRs 0003–0027**" → `0003–0031`; CLAUDE.md §"Source of truth" also cites `docs/adr/0003–0027` → `0003–0031`.

**Why deferred.** §0 version bumps + change-log + ADR-index/footer count reconciliation are a periodic SYNC sweep (CLAUDE.md §7 "reconcile periodically"), not per-task — batching avoids a metadata-churn commit on every rider PR. The rider text itself landed same-commit (the load-bearing part); only the metadata is swept.

**Conditional trigger.** The next SYNC.* reconciliation sweep (version-bump + changelog + ADR-index/footer pass).

**Expected next task.** SYNC.* (next reconciliation sweep).

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
