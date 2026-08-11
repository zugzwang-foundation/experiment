# Parked items

Out-of-scope follow-up tasks tracked here per CLAUDE.md §7 "cleanup
absorption rule" — items genuinely out-of-scope for any current
task, parked until a real task picks them up.

Each entry names the originating task / section, the deferred work,
and the conditional trigger (when it becomes load-bearing).

**Standing rule (2026-08-10).** A routing destination named in a committed
document gets a row here in the SAME commit. Six were named across the POLISH
corpus with no plan, log, row, owner or date — and two were load-bearing:
A11Y.0 gated every surface's closing status, and SPEC.CHART was cited as a
tier-1 source. A phantom prerequisite is worse than a deferred one.

---

## SEQUENCE — the triggered set, in order (SYNC-1, 2026-08-08)

Rows whose stated trigger is **met today**. Everything else in this file is
waiting on an event that has not happened. Go-live is **2026-09-15**.

| # | Row | Owner / gate | Why here |
|---|---|---|---|
| ~~**1**~~ | ~~**PERF-1 — Discovery serves in ~35 s**~~ **— CLOSED 2026-08-10** | — | **No longer a blocker.** Functions were in `iad1` against a Mumbai DB; ADR-0006's ratified `bom1` was never applied. Fixed: **361.6 → 5.34 ms/trip**, Discovery **35.07 → 0.692 s p50** (staging-verified). **POLISH.1–.8 are unblocked.** Kept one cycle as a strike so the reordering below is legible, then delete. |
| **1** | **POOL-2 — `BETTER_AUTH_SECRET` may differ between Doppler `stg` and Vercel `staging`** | **operator-owned, before DP.2** | Unresolvable from a CC session — Vercel env values are write-only once set. A promote that discovers this afterwards has already signed out every production participant. |
| **2** | **POOL-2 — the Sentry routing smoke check is a lookalike, three times over** | runbook corrected here; **probe at HARDEN** | The doc half is done at SYNC-1: `deploy-pipeline.md` **§3.0** now states the smoke's real reach and that it does **not** certify Sentry routing. What remains is the scripts-only fix + a real delivery assertion. |
| **3** | **AUDIT-FIX-B2 OQ-2 — app-as-owner role split** | **pre-launch, before Sep 15** | The only COMPLETE TRUNCATE fix. Migration 0021's guards close the accident class, not the owner-level class. |
| **4** | **UI-6 Gate C D3 — review-feed `innerJoin(users)`** | **armed; next `review-feed.ts` touch** | Verified safe today (no users-row hard-delete path; `onDelete: restrict`). Fires on contact, not on a date. |

*Ordering rule: go-live blocker → operator-owned pre-promote → known-vacuous
gate → dated pre-launch hardening → armed-on-touch. A row leaves this table only
when it closes; a row enters it when its trigger fires.*

*PERF-1 closed 2026-08-10 and **there is no GO-LIVE BLOCKER row left** — the
operator-owned `BETTER_AUTH_SECRET` check is now the head of the queue. Its
strike stays one cycle so the renumbering is traceable, then it goes.*

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

## SCAFFOLD.3-FOLLOWUP-1 §0.2 S3 — ADR backfill — ✅ **CLOSED 2026-08-08 (SYNC-1)**

> **CLOSED — discharged by PR #59 (`7a53341`, 2026-06-02), "docs(adr): backfill
> ADRs 0003-0019 and ADR template".** Verified at SYNC-1 against `ls docs/adr/`
> on `origin/main` `fecbaf3`: **14 of the 16 ADRs this row named as missing now
> exist** (0003, 0004, 0005, 0006, 0007, 0008, 0009, 0010, 0011, 0013, 0014,
> 0015, 0016, 0017). The remaining two — **0002 and 0012 — are not gaps to
> fill**: CLAUDE.md §1 and SPEC.2 §22.1 both record them as permanently unused
> numbers (0002's topic lives in `TRADEMARK.md` + the repo structure; 0012 is
> the design.md in-flight carve-out). The live inventory is **0001–0036, 34
> files**, so this row's premise — *"On disk: `0001-license-choice.md` only"* —
> has been false for **two months**. **Nothing is owed.** Retained as the
> closure record, not as work.
>
> *Why it survived: its trigger was "next task that touches a domain governed by
> a missing ADR", which is a condition nobody evaluates as a checklist item —
> so the row was never re-read, and the backfill that discharged it never
> closed it.*

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

**⚠ RE-TRIGGERED 2026-08-08 (SYNC-1) — new owner needed. The fixes never landed, and the trigger was already in the past when this row was written.**

**The content check, run at SYNC-1 against `origin/main` `fecbaf3`:**

- `docs/specs/SPEC.1.md:69` — the §2 glossary row still reads **"Open / Closed / Resolving / Resolved / Voided / Frozen | The **six** market lifecycle states"** with the column named **`markets.state`**. All three prescribed fixes are un-made: `Draft` is still absent, it still says *six* not *seven*, and the column is still `markets.state`. It is also **self-contradicted 168 lines later** — `SPEC.1.md:237` writes `markets.status` for the same column.
- `docs/adr/0013-concurrency-bet-transaction.md:318, :320, :321` — still reads `markets.state` (3 sites) and `markets.resolving_at` (3 sites). Un-fixed.

**Why it went stale rather than firing: the trigger was un-fireable from birth.** The row was written at the ENGINE.4 OQ-F ruling on **2026-06-05** with the sole trigger *"PRECURSOR.5 runs"* — but `docs/logs/PRECURSOR.5.md` is dated **2026-05-14**, three weeks *earlier*. PRECURSOR.5 had already run. A trigger that points at a completed event never fires, and nothing detects that. **Any row whose trigger names a task must be checked against that task's log at filing time.**

**Why SYNC-1 did not simply fix it.** Both halves were deliberately left: the SPEC.1 half is a **normative** glossary edit, and the ADR-0013 half cannot be a plain body edit — ADRs are immutable (SPEC.2 §22.4), so it needs an in-place **Patch record** per CLAUDE.md §5.12, which is an ADR-lane action outside a documentation truth-pass. Landing only the SPEC.1 half would re-create the same half-fixed state this row already records. **They must land together, in one commit, under an owner who can take the ADR action.**

**Conditional trigger.** **NOW** — the trigger is met and the row is unowned. Fires again on any task touching SPEC.1 §2, ADR-0013, or the market-status vocabulary.

**Expected next task.** A dedicated editorial task, or absorption by the next task that opens ADR-0013 for its own reasons (it can carry the Patch record at no extra cost). **Not** PRECURSOR.5 — that ran on 2026-05-14 and is closed.

## AUDIT-FIX-B1 A7 — invalid-but-present Sentry DSN residual → HARDEN canary probe

**Originating task:** AUDIT-FIX-B1 A7 flush-before-stamp close-out (2026-07-04); surfaced by `@code-reviewer` + `@security-auditor` on the flush delta (PR #199).

**Deferred work.** A synthetic canary-event health probe that confirms Sentry is actually *ingesting* events (not merely that a DSN string is present), closing the invalid-but-present-DSN gap. The `alarms-drain` flush-before-stamp guarantees delivery only insofar as `Sentry.flush()` reflects real transport success; with an **invalid** (but non-empty) DSN the SDK's no-op/failing transport can resolve `flush()` in a way A18's presence-only boot check does not catch, so the drain could stamp `cron_alarms` rows (including `dharma_chain_drift`, the money-mint tripwire) without a real send.

**Why deferred.** The three DSN states form a ladder: flush-before-stamp closes the **valid-DSN Sentry-outage** case (PR #199); the **absent-DSN** case is closed by the A18 `register()` boot-throw for prod/staging (also PR #199); only the **invalid-but-present-DSN** case remains, and closing it needs an active probe (emit a known canary event, assert it lands) rather than a static presence check — a larger, standalone health-check surface out of B1's additive-only scope.

**Conditional trigger.** HARDEN observability pass, OR any incident where a Sentry alarm was expected but never arrived despite a configured DSN.

**Expected next task.** HARDEN.* observability hardening (TBD).

## SYNC-sweep — PAID (PR #218, 2026-07-07)

**Debt paid in full at PR #218 (branch `docs/sync-sweep`, 2026-07-07)** — one doc-only sweep PR covering the seven originating tasks (A1 #197 · B1 #199 · B2 #201 · B3 #202 · B7-A26 #209 · B7a #211 · B8 #216). Scope, one line: SPEC.2 §0 → **1.0.17** (+ §0.1 row · §19.3 `market_media`/`bet_receipts` enumeration · §22 rows ADR-0029/0030/0031 + counts — 30 ADRs = 29 files + 0012 in-flight, 27 accepted, range `0003–0031`) · SPEC.1 §0 → **1.0.14** (+ §20 row · F-BET-1 Errors + `comment_requires_bet`) · CLAUDE.md/AGENTS.md ADR-range + spec-version cites → 1.0.14/1.0.17 · deploy-pipeline.md §0 head `0023` + the §4 seed-staging OPEN note closed (strings already fixed pre-sweep at `b724094`). **Do not re-pay** — the debt is settled and the seven originating tasks stay closed. ⚠ **Version anchors refreshed at SYNC-1 (2026-08-08): the "1.0.14 / 1.0.17" figures above are the values *as of PR #218* and are historical.** The live versions are **SPEC.1 1.0.29 · SPEC.2 1.0.22 · cpmm 2.1.0**; a future §0 bump starts from those, read off the files, never from this row. The next sweep opens a fresh entry.

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

The identity-pool tuple is consumed in Better Auth's `user.create.before` hook (`identity-pool/consume.ts`, its own tx) and Better Auth's adapter INSERTs the `users` row separately — not one atomic transaction. A `users` INSERT that fails after the tuple is consumed leaves it marked `assigned_at` with no owning user: a burned pseudonym. Pre-existing property of the built architecture; recorded as an observation in SPEC.2 §3.5. A22 added audit-log completeness, not atomicity. Options at pickup: (i) move pool consumption into a we-own-it transaction that also inserts the user (the §3.5-original single-tx shape — larger refactor); (ii) a reconciliation pass reclaiming ownerless tuples; (iii) accept-for-experiment (bounded: finite pool, low INSERT-failure rate, 5% low-watermark alarm) and revisit at mainnet.

**Conditional trigger** *(added at SYNC-1 — this row had none, against the promise at the head of this file)*: the identity-pool **5% low-watermark alarm** fires, OR any observed `unable_to_create_user` / signup-failure cluster, OR any task that reopens `identity-pool/consume.ts` or the Better Auth `user.create.before` hook. Until then: accepted for the experiment, no live consequence unless the pool depletes.

## AUDIT-FIX-A22 [FU-2] — default-vs-SERIALIZABLE isolation on the two auth transactions

**Originating task:** AUDIT-FIX-A22 (PR #207, squash `b15a7f5`, 2026-07-06) — operator-ruled close-out filing; body verbatim from the close-out kickoff.

F-AUTH-3 (`identity-pool/consume.ts`) and F-AUTH-4 (`auth/tos-accept.ts`) open plain `db.transaction(...)` at default isolation, not the SERIALIZABLE the spec previously claimed (reconciled to default in SPEC.2 §3.5/§16 at A22). The double-assignment guard is the `FOR UPDATE SKIP LOCKED` row-lock, which holds at default isolation. Open correctness question: confirm default is sufficient for both flows (vs promoting to SERIALIZABLE), in particular any read-modify-write in the ToS-acceptance/grant path. Distinct from the W-1/W-3 bet/resolution wrappers, which are correctly SERIALIZABLE per ADR-0013 and out of scope here.

**Conditional trigger** *(added at SYNC-1 — this row had none, against the promise at the head of this file)*: HARDEN.\* pre-launch correctness pass, OR any task that reopens `identity-pool/consume.ts` or `auth/tos-accept.ts` (it rides that diff at near-zero cost), OR any observed double-assignment or ToS-grant anomaly.

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

## STANDING CHECK — masking — ➡ **MOVED 2026-08-08 (SYNC-1) to `CLAUDE.md` §5.14 SC-1**

> **Not closed — promoted.** *"Masking is a property of every body read, not of
> rows"* is now **CLAUDE.md §5.14 SC-1**, a standing per-PR review check, with
> its two obligations (intersect `loadRemovedSet` before a body reaches a DTO;
> assert the BODY's absence, not the row's) and its origin (the review-feed
> parent-snippet leak on staging) carried across verbatim.
>
> **Why it moved.** Its trigger is *"every PR that adds or edits a read over
> `comments`"* — a per-PR reviewer obligation, not deferred work. `docs/parked.md`
> is *"out-of-scope follow-up tasks … parked until a real task picks them up"*
> (§ header), and nothing here is read at PR time. **A standing check filed in
> the docket is a standing check nobody reads, and one that is never read never
> fires.** It belongs in the file every session loads.

## STAGING-PARITY Slice A — `PRODUCTION_PROJECT_REF` liveness (rotation is a process control)

**Originating task:** STAGING-PARITY Slice A Gate C, Q-A ruling (2026-08-06). Sits alongside **AUDIT-FIX-B2 OQ-2** above — same family: both are the owner-privilege reality that the guarded reset (ADR-0035) is built on top of rather than closing.

**The row, as ruled:**

> Supabase project restore or ref change → update `PRODUCTION_PROJECT_REF`
> (`tests/staging/_lib/guards.ts`) and re-verify the guard. Class R.
> The constant is the single code copy of the production ref; nothing
> detects that it has gone stale. Trigger: any Supabase project restore,
> migration, or ref change on either project.

**Why a test cannot own this.** `reset-guard.test.ts` builds its synthetic production URL by INTERPOLATING the constant, so it is satisfied by whatever value the constant holds — a stale one included. It proves the refusal PATH works and (via a `/^[a-z0-9]{20}$/` shape assertion) catches a blanked, truncated or placeholder constant. It cannot detect rotation. Hardcoding the literal a second time was considered and rejected: both copies would go stale together, and it would cost the single-code-constant property.

**Blast radius if it does go stale — smaller than it first looks.** G-1's **positive** fragment match is the primary protection: the reset proceeds only when the URL carries the **staging** ref, which does not depend on knowing production's name at all. The name-based production refusal is the SECOND net, and its job is to make the wrong-target case *report itself correctly* — "this is PRODUCTION" rather than "wrong fragment". A stale constant therefore degrades the error message, not the refusal.

**Conditional trigger.** Any Supabase project restore, project migration, or ref change on either the staging or the production project.

**Expected next task.** Runbook-owned — a step in `docs/runbooks/deploy-pipeline.md`'s project-identity procedure, or its own HARDEN row. Full reasoning is in `docs/logs/STAGING-PARITY-A.md` under *Q-A*; this entry is the tracking, that one is the argument.

## STAGING-PARITY Slice B — ADR-0031's `bet_receipts` derivability claim is unverified

**Originating task:** STAGING-PARITY Slice B → manifest v1.3 (2026-08-06). Sits directly beside the `PRODUCTION_PROJECT_REF` row above — same family: a claim a slice can record but must not discharge.

**The row, as ruled:**

> ADR-0031 excludes `bet_receipts` from the 2026-11-06 dataset on the
> grounds that its content is "fully derivable from `events` + `pools`".
> Nothing verifies that claim. Class R, owned by the DATASET RELEASE task,
> NOT by STAGING-PARITY: verifying derivability means implementing the
> derivation, which is a second implementation of what the engine does and
> is forbidden by manifest §1.1. Trigger: dataset release scoping.

**Why STAGING-PARITY cannot own it.** Manifest §1 constraint 1 forbids a second event-writing implementation precisely because it becomes a divergent source of truth. Verifying "derivable from `events` + `pools`" requires writing that derivation — reconstructing `newPrice` and the response body from the log — which is the same prohibited shape pointed the other way. The v1.3 C1 amendment is the adjacent finding: `loadDurableReplay` stores `newPrice` rather than re-deriving it *because* re-derivation was judged not worth doing, and that judgement is exactly what the exclusion claim leans on.

**Conditional trigger.** Dataset release scoping — the point at which the 2026-11-06 table set is fixed and each exclusion must justify itself.

**Expected next task.** DATASET RELEASE. Full context is manifest §0 v1.3 C1 and ADR-0031; this entry is the tracking.

## STAGING-PARITY Slice C/D — `identity_pool` FIFO consume has no tiebreak

**Originating task:** STAGING-PARITY Slices C+D (2026-08-06), open question 1. Third in the family above — a control that holds today for a reason no assertion states.

**The row, as ruled:**

> `consumeIdentityPoolTuple` orders by `created_at ASC` with **no tiebreak**
> (`src/server/identity-pool/consume.ts:32`). It is deterministic only because
> `scripts/seed-staging.ts` inserts its 200 tuples **serially**, one statement
> per row, so every `created_at` differs. A batched or parallelised seed can
> produce ties, making consume order nondeterministic — which silently breaks
> pseudonym reproducibility and therefore the coverage list, with nothing
> reporting it. Class R. Trigger: any change to the seed's insert strategy.

**Why nothing catches it.** The property is not "the pool is seeded" — it is "the pool's rows have distinct `created_at`", and no test asserts that. `staging:rebuild`'s reproducibility check (gate 4's drift comparison) would go RED *after* the fact, but it cannot say why: a shuffled pseudonym assignment reads as a coverage-list change, not as a seed-ordering defect. The failure is also **intermittent by nature** — ties only sometimes reorder — so a single green rebuild proves nothing.

**Blast radius.** Every `/u/<pseudonym>` URL in `docs/polish/staging-coverage.json` and in `POLISH-register.md`'s standing reference is keyed to a role→pseudonym mapping that FIFO order fixes. Lose the order and the whole coverage list points at the wrong profiles — silently, because each URL still resolves to *a* real user. Slice C/D verified the current state (200 rows, **200 distinct `created_at`**), so this is a forward obligation, not a present defect.

**Conditional trigger.** Any change to `scripts/seed-staging.ts`'s insert strategy — batching, a multi-row `VALUES`, `COPY`, or parallelism. Also any new seed path that populates `identity_pool`.

**Expected next task.** Either a tiebreak in `consume.ts` (`ORDER BY created_at ASC, id ASC` — `id` is UUIDv7, so it is already monotonic and costs nothing), or an assertion that the seeded pool carries distinct timestamps. The first is strictly better: it makes the ordering total regardless of how the pool was filled. Evidence is in `docs/logs/STAGING-PARITY-CD.md` under *Open questions*; this entry is the tracking.

## STAGING-PARITY Slice A — an `events` partition added without its truncate guard is invisible

**Originating task:** STAGING-PARITY Slice A, overnight mutation sweep (2026-08-06), GROUP 5 item 9. Sits directly beside the `PRODUCTION_PROJECT_REF` row above — same family: a control that no assertion in the slice can hold, recorded rather than left silently unproven.

**The row, as ruled:**

> A new `events` partition added without its `bucket_a_no_truncate` guard is
> invisible to every assertion in Slice A, because guard-list parity derives
> from the same migration SQL that would be missing the guard. Class R.
> Trigger: any migration adding an `events` partition or a protected table.
> Cross-reference ADR-0030's forward obligation.

**Why no assertion can catch it.** `tests/unit/staging/guard-list-parity.test.ts` is deliberately built so that *the migrations are the authority* — it parses every `.sql` on disk and derives the expected guard set from them. That is the right design for detecting drift **between the constant and the migrations**, and it is exactly why it cannot detect a migration that is **itself** wrong: both sides move together and agree. `EXPECTED_GUARD_CATALOG_ROWS` is derived the same way, so it moves too. And the integration suite's "accounts for every public base table" query — the assertion that *does* catch a new **non-partition** protected table appearing in none of the three lists — explicitly excludes `events\_%`, so a partition is outside its reach as well.

**Blast radius.** A reset would then truncate the partition **because** it is unguarded — the `TRUNCATE … CASCADE` succeeds where a guarded partition would abort the batch — and nothing reports the omission. The row loss is not the concern (partitions are in the truncate set by design); the concern is that the partition sits **outside the Bucket-A append-only contract** in normal operation, where `UPDATE`/`DELETE` on it would also be unguarded. Statement-level triggers do **not** clone to partitions (ADR-0030, verified via `tgparentid`), which is the whole reason each partition must carry its own by name.

**Conditional trigger.** Any migration that adds an `events` partition, or that adds a protected table. This is ADR-0030's standing forward obligation, restated as a docket row because the mutation sweep established that no test enforces it for the partition case.

**Expected next task.** Process-owned, not code — a checklist line in the partition-migration procedure and a `@db-migration-reviewer` check. Evidence is in `docs/logs/STAGING-PARITY-A-mutation-audit.md` under *GROUP 5 · item 9*; this entry is the tracking, that one is the argument.

## POOL-2 — `BETTER_AUTH_SECRET` may differ between Doppler `stg` and Vercel `staging`

**Originating task:** POOL-2 (2026-08-08), STEP 1a. Surfaced while trying to obtain a real staging session cookie for the authenticated reproduction probe; the probe could not be completed because of it.

**The row, as ruled:**

> The one live staging session (`RedFox000`) cannot be resolved by a cookie
> signed with `BETTER_AUTH_SECRET` as read from Doppler `stg`. Signing was done
> with Better Auth's own `createHMAC("SHA-256","base64urlnopad")` and verified
> byte-identical to a Node `createHmac(...).digest("base64url")`, so the
> algorithm is not in question. `GET /api/auth/get-session` returns `null` for
> every cookie form tried. Class R. Trigger: before DP.2's production promote.

**Why this is the same family as the Sentry drift.** `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG` and `SENTRY_PROJECT` are present in the Vercel `staging` environment and **absent from Doppler `stg`**. That is proven drift in one direction. `BETTER_AUTH_SECRET` is present in both, so if the *values* differ this is drift of a second, worse kind — one that no name-level parity check can see. `scripts/vercel-env-audit.ts` and `env-audit.yml` compare presence, not values.

**⚠ The consequence, stated explicitly.** If Doppler→Vercel sync is unreliable for one variable, **DP.2's production promotion inherits that risk on every variable.** A prod promote assumes the Doppler `prd` config is what the deployment actually runs. Nothing today proves that for any single secret, and `BETTER_AUTH_SECRET` is the one whose divergence is silent: the app boots, serves, and issues cookies normally — it simply cannot validate sessions signed against the other value. **This must be verified BEFORE the prod promote, not during it.** A promote that discovers it afterwards has already signed out every production participant.

**Why it cannot be settled from here.** Vercel environment values are write-only once set (`vercel env ls` / `inspect` surface metadata only), so the two values cannot be compared directly by any read available to a CC session. Verification has to be functional — mint a session through the deployed app itself and check that a Doppler-signed cookie validates — or operator-side in the dashboard.

**Conditional trigger.** Before DP.2's production promote; also on any change to the Doppler↔Vercel sync configuration.

**Expected next task.** A value-level parity check for the secrets that cannot fail loudly (`BETTER_AUTH_SECRET` first), or a functional assertion in the deploy gate that a freshly-issued session cookie validates. Evidence is in `docs/logs/POOL-1.md` §2.1; this entry is the tracking.

## POOL-2 — the Sentry routing smoke check is a lookalike, three times over

**Originating task:** POOL-1 (2026-08-07), STEP 1a. Three independent defects in a single control, each alone sufficient to make it a V-3 lookalike — a gate that reports success while asserting nothing.

**The row, as ruled:**

> `scripts/smoke-staging.ts` item 9 (`sentry-routing`) cannot pass for three
> independent reasons: (1) the route it triggers, `/api/_smoke-error`, can
> never route — the `_` prefix makes `src/app/api/_smoke-error/` a Next.js App
> Router *private folder*, excluded from routing; (2) the item skips whenever
> `SENTRY_ORG` is unset, and `SENTRY_ORG` is absent from Doppler `stg`, so it
> has always skipped; (3) it asserts against the project `zugzwang-prod`, which
> does not exist — the org `zugzwang-foundation` contains only
> `zugzwang-staging` and `zugzwang-experiment`. Class R, scripts-only fix.

**Why each alone is sufficient.** Fix the skip and it fails on a 404 that is not an error signal. Fix the route and it still queries a project that does not exist. Fix the project slug and it still skips. **Three defects, one control, and any single one of them makes the gate a lookalike** — which is why this is recorded as one row rather than three: the lesson is about the control, not the lines.

**Evidence, each verified.** `curl https://staging.zugzwangworld.com/api/_smoke-error` returns Next's own `/404` (`x-matched-path: /404`, the branded `data-testid="root-not-found"` body), and the build manifest `.next/server/app/api/` lists `auth bets cron health uploads visits` with no `_smoke-error`. The skip is `scripts/smoke-staging.ts:259`. The project list came from the Sentry API with the `stg` token.

**Blast radius.** `docs/runbooks/deploy-pipeline.md` §3 treats the staging smoke as a promote gate. For Sentry routing specifically that gate has never asserted anything, which is why the server-side SDK's delivery status is still unknown after two sessions — nothing was ever positioned to notice.

**Conditional trigger.** Before relying on the staging smoke as a Sentry gate; or whenever the server-side SDK delivery question (`docs/logs/POOL-1.md` §5.1) is taken up.

**Expected next task.** Scripts-only: correct the project slug, add `SENTRY_ORG` to Doppler `stg`, and replace the `_smoke-error` assertion with one that asserts real delivery. The route rename is **not** enough on its own and should not be done alone. Evidence is in `docs/logs/POOL-1.md` §5; this entry is the tracking.

## ~~PERF-1 — Discovery serves in ~35 s · **GO-LIVE BLOCKER**~~ → **CLOSED 2026-08-10**

> **CLOSED — FIXED AND VERIFIED.** No longer a go-live blocker; POLISH.1–.8 are
> unblocked. Struck rather than deleted: two numbers this row carried were wrong,
> and the correction is worth more than the row.

**Originating task:** POOL-1 / POOL-2 (2026-08-08). **Closed by PERF-1 (2026-08-10)**, PR #307 + the close-out PR.

### The result

Measured on **staging** (`staging.zugzwangworld.com`, `cc776bf`) — the serving
environment and the authoritative figure. Preview is shown alongside because the
fix was first proved there and the two agreeing is itself evidence.

| | before | **after (STAGING)** | | after (preview) |
|---|---|---|---|---|
| **Discovery `/` p50** | 35.07 s | **0.692 s** | **51×** | 0.584 s |
| **Profile `/u/…` p50** | 6.2 s | **0.190 s** | **33×** | 0.189 s |
| per DB round-trip | 361.6 ms | **5.34 ms** | 68× | 5.34 ms |
| `/api/health` (2 trips) | 0.719 s | 0.070 s | 10× | 0.070 s |

Exit criterion was **Discovery p50 cold ≤ 2.0 s on staging**: met with **2.9×
headroom**; the worst of three staging runs (0.874 s) is still inside it. Staging
runs: 0.692 / 0.874 / 0.570 s, all `x-vercel-cache: MISS`, all
`x-vercel-id: bom1::bom1`. Profile: 0.335 / 0.184 / 0.190 s.

**Staging is ~0.11 s slower than preview on Discovery and identical on Profile.**
Both are the same code against the same database; the delta is ordinary
instance-to-instance variance at this scale, not a divergence — and it is recorded
rather than smoothed over so nobody later reads 0.584 s as the staging number.

**Cause.** Vercel functions executed in **`iad1`** (Washington D.C.) against a
Supabase database in **`ap-south-1`** (Mumbai) — every statement paid a
cross-region round trip. `x-vercel-id` read `bom1::iad1` on 17 of 17 requests.

**Fix.** **ADR-0006's ratified `bom1`, finally implemented.** The region was
ratified 2026-05-05 (§1 Web tier: *"primary region `bom1` (Mumbai)"*) and never
applied: the project carried Vercel's `iad1` default and `vercel.json` had no
`regions` key at all. One line. See the ADR-0006 patch record.

**Batching is NOT required and was not done.** At 5.34 ms/trip the 97 statements
cost ~0.52 s of the 0.69 s; batching to ~12 would save ~0.45 s on a page already
clearing the bar by 2.9×. **Reconsider only on evidence** — a growing trip count
or measured concurrency behaviour — **never reflexively.** The POOL-1 connection
pressure also dissolves: Discovery held one slot for 35 s, now ~0.5 s — **~60×
fewer slot-seconds**, which is the axis that exhausts the pooler.

### ⛔ Two numbers this row carried were WRONG — struck, with the reason

**1. ~~"41 sequential DB round-trips"~~ → 97.** It counted function CALLS, not SQL
statements. `loadPriceSeries` issues **4** (`price-series.ts:58, 90, 110, 178`),
`selectHeroTopPosts` **5** (`hero.ts:73, 78, 96, 106, 115`) — so the second loop is
**9N, not 2N**. Total `1 + 3N + 9N = 97` at `DISCOVERY_GRID_SIZE = 8`.

**2. ~~"warm p50 ≈ 1.1 s"~~ → THERE IS NO WARM REGIME.** Seven runs, six after the
first, **spread 0.29 s around a flat 35 s floor**, gaps to 150 s, **no decay**. The
1.1 s was almost certainly **TTFB**: the Suspense boundary flushes the shell and
`LoadingSkeleton` immediately, so any time-to-first-byte measure reads ~1 s on a
35 s request (measured TTFB at PERF-1: 0.28–2.15 s against 35 s totals).

**Consequently the whole carry-verbatim thread is void.** It read: *"41 round-trips
do not account for 35 seconds… a large one-time cold cost sits underneath and the
trace does not explain it."* Correct arithmetic on two wrong inputs. At 97 trips ×
361.6 ms the round-trips account for the entire 35 s; **there was no cold cost.**
The instruction it carried — *do not assume batching is the fix* — was right, but
for the wrong reason: batching was never the fix because the per-trip cost was.

### The durable lesson — this is the part worth keeping

**A ratified ADR can go unimplemented indefinitely when the config surface is
SILENT rather than wrong.** `vercel.json` did not contain a bad region; it
contained **no region key at all**, and an absent key is indistinguishable from a
correct one in every diff, every CI run and every code review. Nothing failed.
Nothing looked odd.

**Every control this project has watches for CHANGE. Nothing watched for a
decision that never landed.** CI diffs commits; `db:check-drift` compares schema
to migrations; `/api/health` reported env, db and migration drift. All of them
answer *"did something move?"*. None answers *"did what we ratified ever get
built?"* — and a decision that was never implemented never moves, so it is
invisible to all of them, permanently.

It survived **three months and roughly forty PRs**, and was found only because a
performance number was implausible enough to trace to its cause — not by any
review, and not by any gate.

**The generalisation, for any future ratified-but-unbuilt decision:** a decision
is not implemented until something reads the *deployed reality* back and compares
it to the *decision*. Config-as-code is necessary and nowhere near sufficient —
`vercel.json` was config-as-code and it was silent. **Closing control:**
`/api/health` now returns `region`, so the deployed region is readable at any time
and against any environment; its truthfulness is pinned against `x-vercel-id`
rather than against itself (V-2).

**Second-order note, recorded so it is not misread later.** The `iad1` two-point
regression had a fixed-overhead intercept of ≈ 0 ms; the `bom1` one is ≈ 60 ms.
Nothing regressed — DB latency used to swamp the fixed cost and now does not.

**Evidence.** ADR-0006 §Patch record 2026-08-09 · `docs/logs/POOL-1.md` §6a (struck
in place) · PR #307 (`vercel.json` + patch record, merged `cc776bf`) · the PERF-1
close-out PR (`/api/health` region, this row, the POOL-1 strikes) · **staging
verified 2026-08-10 at `cc776bf`: `x-vercel-id: bom1::bom1`, health
`canary == cc776bf`, `db: ok`, `migrations: ok`.**

**⚠ One proof is still outstanding, and it is ordered, not failed.** The Layer-2
cross-check — health's `region` field against the compute half of `x-vercel-id` on
the same response — **cannot run yet**: the `region` field ships in *this* PR, not
in #307, so staging does not serve it. Until it runs, `bom1::bom1` (edge-generated,
independent of the function) is the sole authority for the region, and it agrees on
every request measured. **Run the cross-check on the next staging advance after
this PR merges**; it validates the new health field, not the performance fix, and
nothing about PERF-1's result depends on it.

## N1 — Commit the two PK-only artifacts that committed docs depend on

**Originating task:** SYNC-1 (2026-08-08), STEP 2.6 — the dangling-reference sweep.

**Deferred work.** Commit **`DESIGN_integration-shell_v1_0.html`** (282,719 B) and **`ZUGZWANG-CD_design-system-editing-manual_v1_0.md`** (11,780 B) to `docs/design/`. Both are held in project knowledge only. Committed repo docs point at them: the integration shell from `docs/design/mockups/README.md` (twice) and `design-canon.md` §8 row 16; the editing manual from `design-workflow.md` (twice) and `ZUGZWANG-CD_branding-handoff-decision-record_v1_0.md` (twice). **PK is currently the sole holder of an artifact `main` depends on, which inverts "GitHub is canonical."** Every one of those references was annotated *"held in project knowledge, not in this repo"* at SYNC-1 so no reader is misled in the interim — the annotation is the mitigation, not the fix.

**⚠ This row is in tension with a standing rule and cannot simply be executed.** `design-canon.md` §8 row 16 currently rules the integration shell **"🔒 v1.0 — PK-only by rule · ✕ stays PK"**, and `mockups/README.md` explains the reasoning (it is a frozen, self-contained build artifact, and its source mockups live on an operator machine). So N1 is **two decisions, not one**:

1. **The editing manual** — no rule opposes committing it. Straightforward.
2. **The integration shell** — committing it **reverses a documented canon rule**. That needs a founder ruling and a same-commit `design-canon.md` §8 amendment, or the row scopes down to the editing manual alone and the shell's PK-only status is instead *restated* as deliberate (which the annotations already do).

**Why deferred.** SYNC-1 is a documentation truth pass; committing a 282 KB binary-ish artifact and amending the design canon are both out of its scope, and the second needs a ruling it cannot take.

**Conditional trigger.** Before the next design-doc edit, or at DESIGN lane close — whichever comes first.

**Expected next task.** A DESIGN-lane task that can take the canon ruling. Evidence: `~/Desktop/SYNC-1-recon.md` R2 (the eviction analysis that surfaced it).

## N2 — Write `docs/logs/UI-phase-record.md`

**Originating task:** SYNC-1 (2026-08-08), PK eviction.

**Deferred work.** Write `docs/logs/UI-phase-record.md` — the analogue of the existing `docs/logs/ENGINE-phase-record.md`: a per-task SHA spine for the UI lane (task → PR # → squash SHA on `main` → what landed → gate outcome). **15 UI close-outs were evicted from project knowledge at SYNC-1 with only a raw archive as insurance.** The repo holds per-task logs and plans, but nothing that reads as one lane-level spine, so reconstructing "what the UI lane did, in order" currently means opening fifteen files and trusting their cross-references.

**Why deferred.** It is a writing task over ~15 close-outs plus their PRs, not a truth-pass edit; and it is most useful written *once* at lane close rather than incrementally.

**Conditional trigger.** **Before POLISH closes.** ~~(POLISH is itself sequenced below PERF-1 — see the SEQUENCE table.)~~ **PERF-1 closed 2026-08-10; POLISH is no longer gated behind it.**

**Expected next task.** A UI-lane or POLISH close-out task. Model: `docs/logs/ENGINE-phase-record.md`.

## N3 — Task-scope the bare `L-n` citations that live outside `docs/`

**Originating task:** SYNC-1 (2026-08-08), STEP 1 — the V-renumber.

**Deferred work.** SYNC-1 split three colliding registers — **O-space** (`CLAUDE.md` §8), **V-space** (`POLISH-0_data-manifest.md` §5), **L-space** (`POLISH-register-ADDITIONS.md`) — and established that task-scoped `@security-auditor` LOWs must carry their task name. Every citation **inside `docs/`** was reconciled. **Five citation sites sit outside the SYNC-1 scope boundary (`src/`, `tests/`, root config) and were deliberately not touched:**

| Site | Current text | Should read |
|---|---|---|
| `tests/server/debate-view/poll-contract.test.ts:211` | `(@security-auditor L-5, L-2)` | `(F-DEBATE-4 L-5, L-2)` |
| `tests/integration/staging-reset-mechanism.integration.test.ts:596` | `(L-1, on myself: a hardcoded DSN is …)` | `(V-1, on myself: …)` |
| `tests/unit/staging/runner-isolation.test.ts:76` | `A config key does not decay (L-3).` | `… (O-1).` |
| `vitest.staging.config.ts:55` | `Structural beats procedural (L-3), the …` | `… (O-1), the …` |
| `src/components/debate/composer/BetComposer.tsx:168` | `In-flight guarded (cascade L-6)` | task-scope it — `L-6` here is a UI-A3 reviewer LOW, a fourth distinct L-space |

**Comment-only edits, zero behaviour.** They are listed together because fixing one and leaving four reproduces exactly the ambiguity the renumber removed.

**Why deferred.** SYNC-1's scope boundary is `docs/**` + `CLAUDE.md` + `AGENTS.md`, absolute. Touching `src/`, `tests/` or root config would have broken it for a comment.

**Conditional trigger.** Next touch of each file — or one sweep, whichever comes first. No urgency; nothing executes on these strings.

**Expected next task.** Any task already editing one of the five, or a dedicated comment sweep. Canonical mapping: `CLAUDE.md` §8 and `POLISH-0_data-manifest.md` §5.

## N4 — `visual_precursor_planner.md` — authority between the PK copy and the repo copy is undetermined

**Originating task:** SYNC-1 (2026-08-08), PK drift sweep (recon R1, row 107).

**Deferred work.** Decide which copy of `docs/design/visual_precursor_planner.md` is authoritative, then reconcile. **The PK copy is 22,334 B; the repo copy is 15,655 B — the PK copy is 6,679 bytes LARGER.** This is the **only** artifact in the 229-file PK sweep where PK holds *more* than `main`; every other drift row is the repo moving ahead. The repo file has been touched exactly **twice, both in June 2026** (`5b19a13` #68, `2e26b52` #70) and not since, and the PK copy's md5 matches **no commit in that file's history** — so the extra content was never on `main` in any revision.

**Why this is not a normal drift row.** For every other stale PK mirror the remedy is obvious (re-stage from `main`). Here, re-staging would **destroy 6.7 KB of planner content** that exists nowhere else. Nothing establishes whether that content is a superseded draft, an unlanded expansion, or an editing accident.

**Mitigation in place.** The PK copy is preserved on the operator's disk and was **not** overwritten by the SYNC-1 PK refresh — `visual_precursor_planner.md` is deliberately absent from the staged replacement set for exactly this reason.

**Conditional trigger.** **Before any edit to either copy**, in either direction. Also before any future PK re-stage that would include this file.

**Expected next task.** An operator/founder read of the two copies side by side. Evidence: `~/Desktop/SYNC-1-recon.md` R1 row 107.

## N5 — SPEC.2 §22 does not know ADR-0035 or ADR-0036

**Originating task:** SYNC-1 (2026-08-08), STEP 2.7 — surfaced while correcting SPEC.2 §0, **not** in the original work order.

**Deferred work.** Fold **ADR-0035** (guarded staging reset) and **ADR-0036** (Vitest-context operational runners) into SPEC.2 **§22.1** (the index), **§22.5** (the SSOT counts), and the §0 metadata that mirrors them. Today `§22.1` self-describes as *"The 33-row index"* with an inventory of *"33 ADRs — 32 ADR files + ADR-0012 in-flight"* and states *"the numbering runs 0001, (0002 skipped), 0003–0034."* **On disk the numbering runs 0001, (0002 skipped), 0003–0036 — 34 files.** §0's `ADRs 0003–0034 (32)` mirrors the same stale figure in three places (the status banner, the companion-files line, the *Gates downstream* row).

**Why deferred, and why §0 was only annotated.** SYNC-1's work order authorised **SPEC.2 §0 metadata only** and instructed a STOP if the correction required a normative edit. It does: §22.1 is normative and §22.5 designates the ADR files as the single source of truth, so rewriting §0's range while §22.1 still says 33/0003–0034 would leave SPEC.2 **contradicting itself inside one document** — strictly worse than the present state. §0 therefore carries a truthful annotation naming the real ceiling and pointing here, and no number was changed.

**⚠ Note the second-order finding.** SPEC.2 §22's arithmetic is deliberately built so the index matches the files on disk (the ADR-0033 index-row-only ruling at BOOKMARK-ADD-WIRE exists *precisely* to keep that property). **That property is currently broken** — two ADR files on `main` appear in no SPEC.2 index row.

**Conditional trigger.** The next SPEC.2 amendment of any kind — it is a §22 count reconciliation, the same shape as the one BOOKMARK-ADD-WIRE performed, and rides that commit at near-zero cost. Also fires if a task needs SPEC.2's ADR index to be authoritative.

**Expected next task.** Any task already amending SPEC.2. Evidence: `docs/specs/SPEC.2.md` §0 banner annotation + §22.1 `:2253`.

## N6 — PERF-1 Layer-2: prove `/api/health`'s `region` field reports the truth

**Originating task:** PERF-1 close-out (2026-08-10). Carried here as a **tracked row rather than a memory**, because it is the one proof PERF-1 could not run and the binding merge order is what prevented it — a gap that is easy to mistake for "done" once the performance numbers land.

**Deferred work.** On the **same response** from staging, compare two independently-produced values:

```bash
curl -sS -D /tmp/h.txt https://staging.zugzwangworld.com/api/health
#   JSON  -> .region                      (read by the function from VERCEL_REGION)
#   header-> x-vercel-id: <ingress>::<compute>   (generated by the EDGE)
```

**Agreement closes the proof. Disagreement means `VERCEL_REGION` is not what it claims, and the field is worse than useless** — a control that reports a region it did not read is precisely the failure mode PERF-1 exists to have removed.

**Why it could not run at PERF-1.** The `region` field ships in the close-out PR (#308); the region change itself shipped in #307. The ratified order was #307 → staging advance → verify → #308, so at verification time staging served no `region` field. **Ordered, not failed.** Staging's `x-vercel-id` read `bom1::bom1` on every request measured, so the region itself is not in doubt — only the *new field's* fidelity is unproven.

**What it does NOT gate.** Nothing about PERF-1's result. Discovery **35.07 → 0.692 s p50** on staging is measured and closed. This row validates the **control**, not the fix.

**Conditional trigger.** **The next staging advance after #308 merges.** That advance is a §2.5 fast-forward like any other; this check rides it and costs one `curl`.

**Expected next task.** Whoever performs that advance. Record the observed pair in the ADR-0006 patch record (which already names the cross-check as the settling evidence) and delete this row.

**⚠ If it disagrees, do not "fix" the field to match.** Two sources disagreeing about the executing region is a finding about the platform contract, not a formatting problem — investigate before changing either side, and treat `x-vercel-id` as the authority because it is generated outside the function.



---

## R2-KEY-OPACITY — the R2 object key embeds `users.id`, emitted anonymously — **DUE 2026-09-05** (hard date, not a trigger)

**Found by** `@security-auditor` at DISCOVERY-COMPLETE Gate C (#311), MEDIUM. **Root cause predates that PR.**

`src/server/storage/sign-upload.ts:72` mints the object key as ``u/${userId}/${uploadId}.${ext}``. The presigned READ URL therefore carries the author's **raw `users.id` in its path**, and that URL is emitted into anonymous HTML on **two** surfaces: `/m/[slug]` (pre-existing, `src/server/debate-view/load-debate-view.ts:382`) and now `/` (DISCOVERY-COMPLETE C7).

**Why it matters, precisely.** `users.id` is **UUIDv7** — its first 48 bits are the account-creation unix-ms. An anonymous scraper harvests `pseudonym → users.id` pairs plus a signup timestamp to the millisecond, with no login. The key is **trigger-immutable** (Bucket-B `image_uploads`), so the identifier **survives a pseudonym scrub**: a pre-scrub scrape re-links a scrubbed identity to its old pseudonym and content — which is exactly what **SPEC.1 §16.5 erasure exists to sever**.

**The codebase already knows this key is PII-bearing.** `src/server/events/schemas.ts:298` excludes the raw `imageR2Key` from the `moderation.blocked` payload with the reason stated inline: *"(it embeds the userId → its own strip)"*. The event layer strips it; the render layer publishes it.

**Two fix shapes, both needing a MIGRATION + BACKFILL** (every existing key embeds an id):
1. **Opaque key namespace** — write new objects at ``o/${uploadId}``, backfill by copy-then-repoint, and drop the `u/${userId}/` prefix. Simplest read path (still a direct presign) but touches R2 object storage, not just Postgres.
2. **Proxy read route** — keep the keys, serve images through an app route that presigns server-side and never exposes the key. No object migration, but adds a request hop on a hot render path and needs its own authz + rate story.

⚠ **`precommitModerate` asserts `key.startsWith("u/${userId}/")`** (`src/server/moderation/precommit.ts:97-111`) — an ownership check that shape 1 removes. Whatever replaces it must not weaken that assertion; it is what stops a caller attaching another user's upload.

**NOT a DISCOVERY-COMPLETE fix.** C7 added a second emission site for data already published; expanding #311 to a storage migration was explicitly rejected at Gate C.

---

## RATE-GUARD-PUBLIC — the participant RSC surfaces have no request-rate limit — **DUE 2026-09-05** (hard date, not a trigger)

**Found by** `@security-auditor` at DISCOVERY-COMPLETE Gate C (#311), MEDIUM. **Pre-existing; #311 adds zero queries.**

`proxy.ts:41` sets the edge matcher to `["/admin/:path*"]` **only**, and `src/server/middleware/rate-limit.ts` is applied inside **route handlers**, not around RSC page renders. So `/` — `force-dynamic`, uncached, **~97 sequential DB round-trips** per render (`1 + 12N` at `N = DISCOVERY_GRID_SIZE = 8`) — is reachable by an unauthenticated client **at any rate**, against a Supabase session pooler with a bounded connection budget.

**Why now.** PERF-1 has just bought this surface back from **35.07 s → 0.692 s p50** and closed the only GO-LIVE BLOCKER. Nothing prevents an attacker from spending that headroom again, and the failure mode is pooler exhaustion, which takes down more than Discovery.

**#311 is not the cause and does not worsen it** — its query count is now mechanically pinned at `1 + 12N` by `tests/server/discovery/round-trip-budget.test.ts`. It is recorded here because the audit surfaced it while reading that surface.

**Upstash is already in the stack** (`@upstash/ratelimit`, ADR-0015), so the primitive exists; what is missing is a limiter on the RSC path. ⚠ Note the ADR-0015 posture — rate-limit fails **OPEN** — so a limiter added here does not become a new availability dependency.

**Scope note.** Applies to every anonymous participant RSC surface, not just `/`: `/m/[slug]`, `/u/[pseudonym]` and the `.md` export are all uncached reads. Size the row across all of them.


---

## STAGING-FIXTURE-DISCOVERY-SHAPE — the staging fixture set cannot render what Discovery is for — **DUE 2026-09-05** (hard date, not a trigger)

**Found at the DISCOVERY-COMPLETE post-staging verification, 2026-08-10.** Scoped here, **nothing changed** — the STAGING-PARITY fixture set is **md5-pinned** (`tests/staging/fixtures.ts` + `docs/polish/staging-coverage.json`), so altering it is a **deliberate fixture change with a re-pin**, never an edit. Three defects in the fixture SHAPE, none in the engine.

**1 · No market has BOTH hero sides populated, so the two-pole comparison cannot be rendered on any screen.** Measured across all 8 Discovery markets:

```
sp-m16 YES   sp-m15 NO    sp-m14 NO    sp-m13 YES
sp-m12 YES   sp-m11 NO    sp-m10 YES   sp-m4-new (neither)
```

Seven markets carry a hero post on exactly ONE side; one carries none. **Zero carry both.** That matters beyond convenience: V17's split bar binds its poles to the post's side, so *the whole point of the fix is that a YES panel and a NO panel look different* — and no single screen on staging can show that. The V17 pole defect shipped through a full PR partly because **every** V17 render test passed `no: null`; the fixture set has the identical blind spot. ⚠ **POLISH.3 hits the same wall on `/m/[slug]`, which is exactly where RR-3's LIVE inversion sits.**

**2 · The market that sorts FIRST is the emptiest.** Discovery orders `created_at DESC` and caps at `DISCOVERY_GRID_SIZE`. `sp-m4-new` ("brand new") has **no** hero posts on either side, so a first-time viewer lands on the both-sides-empty hero. *(⚠ Correction to the scoping brief, verified from the served payload: `sp-m4-new` sorts **LAST** of the eight, not first — index 0 is `sp-m16-fill`. The concern is real but the ordering claim was inverted; the emptiest market is at the END of the carousel, not its opening frame.)*

**3 · All 8 `market_media` R2 objects are absent** — every minted URL returns `404 NoSuchKey`. Rows in the DB, objects never uploaded. This is what makes **PD-2-32** (a real production defect: a minted URL that later 404s has no degradation path) visible on staging. Fixing the fixture would HIDE PD-2-32 without fixing it — **land PD-2-32 first, then re-pin the fixtures.**

**What a fix must preserve.** The set is engine-DRIVEN (`generate.staging.test.ts` calls `place`/`openMarket`/etc. and writes nothing itself, ADR-0036), so the shape changes by driving MORE bets on the opposite side of existing posts — not by inserting rows. The six verification gates and the coverage inventory re-pin together.

---

## O1-KICKOFF-INPUT — Discovery's hero at go-live: every market opens with zero posts — **route to O1's kickoff, DECIDE don't discover**

**Product question, NOT a POLISH defect.** Recorded from the DISCOVERY-COMPLETE staging pass, 2026-08-10.

At go-live on **2026-09-15** all eight markets open **simultaneously, with zero posts**. Discovery's hero renders per side, and a side with no eligible post renders the OQ-6 empty copy (`HERO_SIDE_EMPTY`). So on day one **every market's hero shows the both-sides-empty state**, for as long as it takes participants to post — and the entry surface of the experiment opens on its emptiest frame.

**The mockup never showed this state.** `surface_discovery_v1_0.html` renders populated hero panels throughout; there is no zero-post frame in tier 4 to port. The build's behaviour is correct and deliberate (F-DISC-2: a side with no eligible post is `null`, never a placeholder post, and the copy is identical whether a side has zero posts or masked ones so it can never hint hidden content exists). **Nothing is broken.** The question is whether that is the intended first impression.

**Why it is O1's and not POLISH.2's.** It is not a parity delta — there is no mockup to be out of parity with. It is a launch-shape decision: seed the markets with founder-authored opening posts, stagger the opens, show something else in the hero for an empty market, or accept the empty frame. ⚠ Any option involving posts crosses **CLAUDE.md §3 market-content invention** — the questions, arguments and copy are the founder's, and CC scaffolds the frame only.

**Recorded so it is DECIDED rather than DISCOVERED on 2026-09-15.**

---

## PRIMITIVES-2 — the shared-primitive pass — **CLOSED 2026-08-11**

**Closed by two PRs, both squash-merged to `main`:**

| PR | Squash SHA | Scope |
|---|---|---|
| **#317** | **`143380b`** | PR-A — `MarketThumb`, the null · error · loaded owner for all three Discovery image sites, plus D4's two `alt=""` |
| **#318** | **`0ff2733`** | PR-B — the seam pass: `SideBadge`'s map lookup and its two surface presets, the emphasis ladder as named tokens, the replyhead tier as a named constant, the doc/register corrections |

Plan `docs/plans/PRIMITIVES-2.md`; logs `docs/logs/PRIMITIVES-2-PR-A.md` and
`docs/logs/PRIMITIVES-2-PR-B.md`. **All nine of §1's exit criteria discharged
with evidence** at the close-out task; criterion 5's two named lines are
`src/app/globals.css:178` and `src/components/discovery/HeroPanels.tsx:52`.

### ⚠ What did NOT land here, and where it went

**A closed row that does not say what left it is how a later reader re-opens
settled scope.** Of the five items:

| Item | Outcome | Now owned by |
|---|---|---|
| **1** `MarketThumb` | **Built.** All three sites, one owner | — (PD-2-32 `fixed`) |
| **2** the `alt` fix | **Overflow half built.** ⚠ The **a11y half (WCAG 1.1.1) did NOT close** | **A11Y.0**, plus `OQ-6-ALT-EXCEPTION` |
| **3** the two presets | **SEAM only.** Both presets exist and are render-tested at both poles; **zero call sites wired, by ruling D5**, and a guard asserts it stays so | **`PD-3-03`** (d5 adopts `detail`) · **`PD-5-01`** (Profile adopts `profile`) |
| **4** `mix-blend-darken` | **NOT BUILT — already discharged** at PRIMITIVES-1 D6 (`997f308`, PR #293), which fixed it at the primitive. Three stale documents corrected instead | — (closed; absence pinned by `avatar-ring-token.test.ts:72,83`) |
| **5** text tier + ladder | **REDUCED TO SEAM-ONLY by ruling D8, a recorded departure.** The ladder's rungs 2–3 became `--border-hero` / `--ring-active`; the replyhead tier became `REPLYHEAD_TIER`. **The other 12 micro-label sites were NOT normalised** — they span `shell/` and `debate/composer/`, POLISH.4's uninspected surface | **`MICRO-LABEL-TIER`** (routed to POLISH.4) · **`BORDER-STRONG-ORPHAN`** (D10) |

**The binding condition was met, and the proof is a named line rather than a
claim.** D8 delivered the *safety property* — a later founder ruling costs one
line in one place — and explicitly not the literal 14-site scope. That is
recorded as a departure in plan §4.2, not absorbed as an interpretation.

Also minted here: **`RR-4-ID-COLLISION`** (needs a ruling, not an edit) ·
**`VACUITY-RULE-TO-V-REGISTER`** (promote §8-P1's three-axis rule) ·
**`G1-RECON-TEMPLATE`** (PRIMITIVES-1's seven recon requirements, still landed
nowhere).

---

*Historical record of the row as it stood while open, retained deliberately —
the strikethroughs inside it are the corrections this task made.*

**Originating task:** POLISH-TEMPLATE (2026-08-10). Named twice on `main` before today — `POLISH-register.md` CC-9 and `docs/logs/DISCOVERY-COMPLETE.md:268` — **both times routing work *away* from it**, and it had no row, no plan and no owner. It is the successor to PRIMITIVES-1.

**Deferred work.** One pass over the shared primitives, five items:

1. **One shared `MarketThumb` owning three states — null · error · loaded — used by BOTH sites** (PD-2-32). ⚠ **THREE call sites, not two:** `MarketCard.tsx:53` and `HeroPanels.tsx:64` render the market thumb; the **hero POST image** handles `null` but has **no `onError`**, so it carries the same gap. Do not patch the `<img>` tags independently — that is how PD-0-10 happened.
2. **PD-2-33's `alt` fix, landing WITH it.** Both thumbs carry `alt={card.title}` while the same title renders in the adjacent `<h3>`; `alt=""` matches the hero POST image's ratified treatment and is also what stops the broken-image text overflowing the metadata row. ⚠ Fixing the `alt` alone hides the symptom while PD-2-32's real gap remains.
3. ~~**The `SideBadge` d5 `.md` and Profile `.sm` presets.** These have **NO register row** and **no preset to receive them** — `badges.tsx:70` is `size?: "hero"`, a **one-member union**. The only committed statement of the requirement is a plan sentence, `docs/plans/DISCOVERY-COMPLETE.md:70`.~~ **The SEAM half is DELIVERED at PRIMITIVES-2 PR-B commit 2**, and both stated blockers are gone: `CHIP.detail` / `CHIP.profile` exist, the union is three-member, and the register rows are **`PD-3-03`** and **`PD-5-01`**. **The ADOPTION half is deliberately NOT delivered** (D5) — zero call sites are wired, and a guard asserts it stays that way; `/m/[slug]` and `/u/[pseudonym]` adopt at POLISH.3 and POLISH.5 against their own inspections. Struck rather than deleted so the original blocker is still legible.
4. ~~**`ui/avatar.tsx`'s `mix-blend-darken` on its two unfixed consumers.** POLISH-1a unbound it at the two `IdentityCluster` chip sites; the remaining consumers still carry it.~~ **STRUCK — DISCHARGED, not built (PRIMITIVES-2 D1).** This item **said** the two named consumers still carried the blend. They do not, and did not when PRIMITIVES-2 was scoped: **PRIMITIVES-1 D6 removed `after:mix-blend-darken` FROM THE PRIMITIVE** (`997f308`, PR #293), which fixed all three consumers in one edit rather than two of three. `mix-blend` has **zero occurrences anywhere in `src/`** at PRIMITIVES-2 head, and its absence is pinned two independent ways by `tests/unit/design/avatar-ring-token.test.ts:72,83`. The two "unfixed consumers" this row named — `HeroPanels.tsx:112`, `ArgProfile.tsx:51` — are clean (and `:112` is no longer an Avatar mount at all). **Struck rather than deleted so a later reader can see the concern existed and was answered, not that it was never raised.**
5. **The secondary text tier and the emphasis ladder, AS NAMED PRESETS.**

⚠ **BINDING CONDITION, carried verbatim:** *the secondary text tier and the emphasis ladder land as **NAMED PRESETS**, not inline classes. That is what makes deferring the founder's visual pass safe. If they land inline the safety property is gone and the batched pass MUST be revisited.*

⚠ **Every preset defaults to the render that ships today, PROVED per consumer** — a byte-identical baseline per call site, **not asserted**. This is the DISCOVERY-COMPLETE C1 discipline (`detail` pinned byte-identical, 385 bytes) applied to every preset in the pass.

⚠ **PD-2-32 is a PRODUCTION defect, not staging-only.** A minted presigned URL is a local HMAC that never checks existence, so a key pointing at a missing object mints a valid URL and fails only at browser load — and R2 objects can 404 in prod too (deleted, swept, replication lag). **It must land BEFORE `STAGING-FIXTURE-DISCOVERY-SHAPE`: fixing the fixture first would HIDE it** without fixing anything.

**Why deferred.** It is a shared-primitive pass across surfaces POLISH.3/.5/.6 own, and `POLISH-0.md` §5 forbids a V batch spanning surfaces. Absorbing it into any single surface's pass would re-skin the others silently.

**Conditional trigger.** ~~**None — it runs next.**~~ **DISCHARGED — it ran.** No date was needed because nothing gated it: PD-2-32 and PD-2-33 were open and owned here, and every other item was a primitive that already existed. Both are now `fixed`.

**Expected next task.** ~~PRIMITIVES-2 itself.~~ **Ran as PRIMITIVES-2, PRs #317 + #318. The next machine run is `.7a` Auth.** Evidence: `POLISH-register.md` PD-2-32 · PD-2-33 · CC-9 · PD-0-10; `docs/plans/DISCOVERY-COMPLETE.md:70`; `docs/logs/DISCOVERY-COMPLETE.md:268`.

---

## MICRO-LABEL-TIER — normalise the uppercase micro-labels — **ROUTED TO POLISH.4**

**Originating task:** PRIMITIVES-2 PR-B (2026-08-11), ruling **D8**.

**Deferred work.** The participant tree's uppercase micro-labels share no import and no scale. **12 sites across 7 files** outside the one PRIMITIVES-2 touched: `shell/IdentityCluster.tsx:32` · `shell/RadioSlot.tsx:30` · `shell/DharmaCluster.tsx:89,98` · `debate/composer/PositionStrip.tsx:44,61` · `debate/composer/BetComposer.tsx:457,509,537` · `debate/composer/SellModule.tsx:263,278` · `debate/composer/AuthGateSlot.tsx:49`. Between them: **4 sizes × 5 trackings × 2 weights × 4 colour tiers**, no shared constant.

⚠ **STATE THE CLASSIFIER — this census is CLASSIFIER-DEPENDENT and two honest counts disagree.** The set above is *`uppercase` + a `tracking-*` class, participant surfaces only, `src/app/(admin)/**` excluded*. PRIMITIVES-2's recon counted **13 across 6 files with 5 tiers** using a wider predicate that includes the two `text-ink` Support/Counter labels this one excludes. **Neither is wrong.** A future task must say which predicate it means before quoting a number, or it will "correct" a count that was never incorrect.

**Why deferred.** Normalising them re-skins `shell/` and `debate/composer/` — **POLISH.4's uninspected surface** — and `POLISH-0.md` §5 forbids a V batch spanning surfaces. PRIMITIVES-2 D8 is a **recorded departure** from the docket's literal text: it built the seam at the two rungs where it is coherent and proved the one-line safety property, rather than sweeping 14 sites across two surfaces nobody has looked at.

**Conditional trigger.** POLISH.4's inspection. Not before.

**Evidence.** `docs/plans/PRIMITIVES-2.md` §3 D8 + §2's two `R11` rows (both annotated at PR-B commit 4); `src/components/discovery/HeroPanels.tsx` `REPLYHEAD_TIER` — the one site that DID land, named for the replyhead precisely so it claims none of the above.

---

## BORDER-STRONG-ORPHAN — a ratified token with zero consumers — **F3-BLOCKED**

**Originating task:** PRIMITIVES-2 PR-B (2026-08-11), ruling **D10**.

**Deferred work.** `--border-strong` (`globals.css`, aliased to `var(--color-n2)`) has **zero consumers**. Its only mention in `src/` is the prose at `DiscoveryGrid.tsx:37` explaining why it was *not* used. Decide: retire it, or re-point it at the ladder.

**Why deferred.** Both answers are token-**VALUE** decisions, and token values are F3-blocked and CI-pinned by `tokens-monochrome.test.ts`. PRIMITIVES-2 D9 deliberately did **not** absorb it: the ladder now has real named consumers (`--border-hero`, `--ring-active`), which is what makes the question *answerable* later — answering it then would have been a value change riding a mechanism change.

**Conditional trigger.** Whenever the F3 token-value lane opens.

**Evidence.** `docs/plans/PRIMITIVES-2.md` §3 D10; `tests/unit/design/emphasis-ladder-tokens.test.ts` pins that it still has its alias and no consumer.

---

## RR-4-ID-COLLISION — `RR-4` names two different findings — **NEEDS A RULING, NOT AN EDIT**

**Originating task:** POLISH-TEMPLATE (`docs/logs/POLISH-TEMPLATE.md:88`, S-4). **Rowed at PRIMITIVES-2 PR-B** (2026-08-11), ruling **D13**, in the same commit that moved RR-4's disposition cell.

**Deferred work.** `docs/logs/DISCOVERY-COMPLETE.md` mints RR-1…RR-4. The register files RR-3 and RR-4, renames RR-1 → CC-9, and folds RR-2's content into what it calls RR-4. **Read side by side, `RR-4` names two different findings**: the register's is `PositionMarker` outline → filled (`POLISH-register.md:98`), the log's is C0's third route — the fixed-pole-on-a-per-side-element known gap (`docs/logs/DISCOVERY-COMPLETE.md:307`).

**Why deferred, and why an edit would be wrong.** Renumbering a stable ID scheme is exactly what the register forbids (S-3's ruling on the CC-8 gap), and both IDs are cited from committed documents. **It needs a ruling on which reading is canonical, then a one-time reconciliation — not a silent rename.**

⚠ **PRIMITIVES-2 D13 moved RR-4's `disposition` cell to `accepted-divergence` and moved nothing else.** That edit does **not** touch this collision and must not be read as having resolved it. This row exists so the unresolved half survives the cell edit.

**Conditional trigger.** The next register-maintenance pass, or POLISH.5/.6 hitting the ambiguity during inspection.

**Evidence.** `docs/logs/POLISH-TEMPLATE.md:88` · `docs/polish/POLISH-register.md:98` · `docs/logs/DISCOVERY-COMPLETE.md:307`, `:348` · `docs/plans/PRIMITIVES-2.md` §3 D13 + §9.

---

## G1-RECON-TEMPLATE — the seven recon-template requirements landed nowhere — **DOC-ONLY**

**Originating task:** PRIMITIVES-1 (`docs/logs/PRIMITIVES-1.md:52`, finding **G1**). **Rowed at PRIMITIVES-2 PR-B** (2026-08-11), §9.

**Deferred work.** PRIMITIVES-1 minted **seven recon-template requirements**, the load-bearing one being *replace the render census with a consumer census*. They are **named in that one session log and landed nowhere** — not in the recon template, not in `docs/maintenance.md`, not in `CLAUDE.md`. PRIMITIVES-1 ruled the text out of scope for itself and routed it to "its own docs task", which has never been opened.

**Why it matters, measured rather than argued.** The render census enumerated production call sites exhaustively and test assertions not at all, which is how **six defects of one genus** reached execute at PRIMITIVES-1. At PRIMITIVES-2, **recon R6 performed the consumer census by hand** because the requirement still lives only in a log — and the count it produced was then re-measured a third time at PR-B head. Three manual censuses of the same primitive, because a prescriptive requirement was filed in a descriptive document.

⚠ **This is the CLAUDE.md §7 failure mode by name:** *"same PR, never a follow-up — follow-ups never happen."* It has now not happened across two full tasks.

**Conditional trigger.** The next docs/maintenance task, or the next recon of any kind — whichever comes first.

**Evidence.** `docs/logs/PRIMITIVES-1.md:52`, `:148` · `docs/plans/PRIMITIVES-2.md` §9 · PRIMITIVES-2 recon R6.

---

## VACUITY-RULE-TO-V-REGISTER — promote the RED-first scoping rule — **DOC-ONLY**

**Originating task:** PRIMITIVES-2 PR-B (2026-08-11), operator ruling **RULE-1**, recorded as `docs/plans/PRIMITIVES-2.md` §11 `§8-P1`.

**Deferred work.** Promote the rule into the **V-space register** (`POLISH-0_data-manifest.md` §5), where verification lessons live, and give it a V-number. The rule: **RED-first is required only of a guard asserting a DEFECT EXISTS. Zero-delta and census guards are green on first run by definition, and are discharged by MUTATION — stated with the RED count, never claimed. A census mutation must break on THREE axes: ① a member added · ② a member removed · ③ a member the census never looks at.** Axes ① and ② test MEMBERSHIP; only ③ tests REACH.

⚠ **Promote the THREE-axis form. An earlier draft of this row and of `§8-P1` said "BOTH directions", and that two-axis version was DISPROVED on the branch that minted it** — it is the version that passed a vacuous guard (`the-literals-survive-nowhere-in-src`, reviewer finding H-1). Installing it in the register that exists to prevent vacuity would be the defect promoting itself.

**Why deferred.** The register edit is a **numbering decision in a document PRIMITIVES-2 does not own**, and CLAUDE.md §8 is explicit that a register cannot arbitrate its own numbering from outside. PRIMITIVES-2 records the rule at its own §11 and routes the promotion rather than allocating a V-number itself.

**Conditional trigger.** The next SYNC sweep, or the next task that touches `POLISH-0_data-manifest.md` §5.

**Evidence.** `docs/plans/PRIMITIVES-2.md` §11 `§8-P1`; applied across four commits in PR-B (commits 1–4; 16 mutations after the reviewer pass).

---

## A11Y.0 — the accessibility floor — **DATED, founder to set the date**

**Originating task:** POLISH-TEMPLATE (2026-08-10). **Nine committed references routed work to it and it had no row until today** — `POLISH-0.md:22`, `:326`, `:356` · `docs/plans/PRIMITIVES-1.md:344`, `:348` · `docs/plans/HEADER-PORTFOLIO.md:111` · `docs/plans/SHELL-COMPLETE.md:292` · `docs/logs/POLISH-1a.md:125`, `:146`.

**Deferred work.** The accessibility floor, scope **ratified**: **keyboard reachability · accessible names · visible focus.** **WCAG 2.2 AA is scoped PAST the experiment, deliberately** — the floor is the three properties above, not a conformance claim.

⚠ **It already has a backlog, accumulated before it had a row:**

| Item | Where |
|---|---|
| **PD-2-06** — the Reload button had **no focus ring**, and it was the **only keyboard-reachable control on Discovery** | `POLISH-register.md` PD-2-06 (fixed at POLISH.2 C6, but the class it belongs to is this one) |
| **PD-2-10** — **no keyboard handler at all** on the carousel; ArrowLeft/ArrowRight did nothing, against tier-2 canon §5 (explicitly *not* a11y-deferred) | `POLISH-register.md` PD-2-10 |
| **PD-2-33's a11y half** — `alt` duplication, WCAG 1.1.1 | `POLISH-register.md` PD-2-33; the overflow half is POLISH.2's |
| **POLISH-1a's `title`-reach finding** — titles on a `disabled` `<button>` (pointer events suppressed, tooltip never fires) and on role-less `<span>`s (mouse-hover only, no keyboard path, not reliably exposed to AT). The strings are source-of-truth-correct; their **delivery** is this task's | `docs/logs/POLISH-1a.md:125` |

⚠ **Every POLISH surface closes `closed (a11y-deferred)` until this lands** — `POLISH-0.md:326`. **It gates a STATUS, not a build.** No surface's work waits on it; only the qualifier on the word "closed" does. That is why it can be dated rather than sequenced.

**Why deferred.** The floor is a product decision about how much accessibility the experiment commits to, and the scope decision (three properties, AA scoped out) is ratified while the *date* is not. Nothing in POLISH is blocked by its absence.

**Conditional trigger.** **A date, set by the founder.** Not event-triggered — the backlog above only grows as surfaces are inspected, and every surface can close without it.

**Expected next task.** A11Y.0 itself. Evidence: the four backlog items above, each with a register row or a log citation.

---

## SPEC.1 §21.7 rider — the freeze-banner spec — **BEFORE 2026-11-05**

**Originating task:** POLISH-TEMPLATE (2026-08-10). Tracked across five plan and log files as a **gate on other work** — `docs/plans/SHELL-COMPLETE.md:7`, `:16`, `:73`, `:266` · `docs/logs/SHELL-COMPLETE.md:211`, `:230` · `docs/plans/HEADER-PORTFOLIO.md:56` · `docs/plans/PRIMITIVES-1.md:343` — **and it had no row of its own.**

**Deferred work.** Write SPEC.1 **§21.7**. It is currently a RESERVED stub (`docs/specs/SPEC.1.md:1567-1573`), minted at v1.0.28 to close the §21 numbering gap, and it says so itself:

> *"Reserved for the freeze-banner rider. **Not yet written. B8 (freeze banner) is gated on this section and must not be built before it lands.**"*

⚠ **It is SMALL.** `docs/plans/SHELL-COMPLETE.md:73`: *"The rider is small: the **copy is already ratified and shipped** (`composer/copy.ts:126–129`, wired `endpoint.ts:201` → `state-map.ts:50` → `p6_concluded`). The rider gives that copy a second, visitor-reachable **home**; it does not design new copy."* Web-authored, prescriptive, **no code**. Q4 as revised (r5) is what it must ratify — `FREEZE_INSTANT_UTC` as a cheap short-circuit, `system_state.frozen_at` as the truth claim, `isFrozen()` wrapped so a layout can never throw.

⚠ **It is the SOLE blocker on the freeze banner, and it had no owner.** ⚠ **B8 has been STRUCK from POLISH.1's gate list** — the banner renders **only when frozen**, so it is **not inspectable in the POLISH window** even if it were built. POLISH.1 is not waiting on it and never was.

**Why deferred.** It is a spec edit, and SPEC.1 is web-authored — CC does not draft it. Every task that touched the banner correctly refused to write the rider inside its own scope.

**Conditional trigger.** **Before 2026-11-05** — the conclusion freeze is `system_state.frozen_at` at 2026-11-05 23:59 UTC, and a banner that ships after the freeze it announces is worthless. Not a POLISH gate; a launch-window one.

**Expected next task.** The forked S4 task, which `docs/logs/SHELL-COMPLETE.md:230` already specifies **starts by writing the §21.7 rider — not by writing `FreezeBanner.tsx`.**

---

## MOD-REPORT-PATH — no user-facing report trigger exists

**Originating task:** POLISH-TEMPLATE (2026-08-10). Named twice on `main` — `POLISH-0.md:354` and `docs/plans/SHELL-COMPLETE.md:292` — both routing it away, with no row until today.

**Deferred work.** Design and ratify the user-facing report path. **ADR-0021's reactive moderation pipeline needs a user-facing trigger and none is designed.** CD-A stripped **REPORT** from the pop-up (founder ruling, 2026-07-14 — it had entered via an unratified prompt presupposition), and **no policy decision recorded that user reporting is out of scope.** Verified today: `grep -rni "report" src/components/debate/dialogs.tsx` returns **zero**.

⚠ **Child-safety adjacent with real lead time.** ADR-0021 made moderation *reactive* — an admin reviews live content after the fact. Reactive moderation with no participant-side trigger means the only path to an admin's attention is the admin happening to look.

**Why deferred.** It is a product and policy decision with its own P0 chat, not a POLISH defect. **POLISH.3 inherits a decision; it does not discover a hole** — an inspector who finds no REPORT control on the pop-up is looking at a ratified removal, not a defect, and must not file it.

**Conditional trigger.** Its own chat. ⚠ **Lead time is the trigger, not an event** — a child-safety path that is designed in November is designed too late for a 2026-09-15 go-live.

**Expected next task.** A dedicated P0 chat. Evidence: `docs/adr/0021-reactive-moderation-no-held-queue.md`; `docs/design/DESIGN_popup-redesign_CLOSE-OUT.md` §4 (REPORT stripped, parked).

---

## SPEC.CHART — a tier-1 source that does not exist

**Originating task:** POLISH-TEMPLATE (2026-08-10), the RECON-2 sweep.

**Deferred work.** Resolve the chart's missing baseline. **`POLISH-0.md:158` cites `SPEC.CHART` as a TIER-1 source for POLISH.3.** It is **not in `docs/specs/` and never has been** — that directory holds `cpmm.md`, `debate-export.md`, `flows/`, `RANKING.md`, `SPEC.1.md`, `SPEC.2.md`, and nothing else.

⚠ **The consequence is a halt, not an annoyance.** The chart's **expanded-overlay** variant is **built UI with NO baseline at any tier** — values-log branded three renders and four exist. Under `POLISH-0.md` §5 that is class **S**, and class S is a **SPEC-FIRST halt: no build**. So POLISH.3 cannot dispose of that component either way. It is **R13 — the only OPEN ruling** in the index.

**Why deferred.** Writing a chart spec is a spec-lane task, web-authored; and the alternative disposition (`accepted-divergence`) is **founder-only** under P12. Neither is POLISH.3's to take mid-inspection.

**Conditional trigger.** **Before POLISH.3 closes.** Two admissible outcomes, and only two: **write it**, or **record the overlay as permanently unbaselined and accept the divergence** (founder only, P12). A third outcome — POLISH.3 closing with the component undisposed — is what this row exists to prevent.

**Expected next task.** A spec-lane task, or the founder at POLISH.3 kickoff. Evidence: `POLISH-0.md:158`; `POLISH-register.md` PD-0-16 (`R13`); `ls docs/specs/`.

---

## ADR-0006-DISCIPLINE — one known unpushed commit

**Originating task:** POLISH-TEMPLATE (2026-08-10). Named twice on `main` — `POLISH-register.md` CC-3 and `docs/plans/DISCOVERY-COMPLETE.md:19` (and its halt item 10) — **both times routing work away from it**, with no row until today.

**Deferred work.** Land `1b7f37f docs(adr): ADR-0006 §4 — back-reference ADR-0026's third R2 bucket`, which is **confirmed absent from `main`**. It was written on the local branch `chore/post-perf-1-docket` and never pushed; DISCOVERY-COMPLETE branched from `origin/main` explicitly and `git merge-base --is-ancestor` confirmed it absent, so it was correctly kept out of #311 rather than dragged in.

**Why deferred.** It is a one-line ADR back-reference. Opening a PR for it alone costs more than the change is worth, and every task that noticed it correctly declined to absorb an out-of-scope ADR edit.

**Conditional trigger.** **Opportunistic — fold into the next task that legitimately opens `docs/adr/`.** ⚠ Nothing executes on it and nothing is wrong on `main` without it; the only cost of leaving it is that the commit exists in one place and one place only.

**Expected next task.** Any task already editing an ADR. Evidence: `POLISH-register.md` CC-3; `docs/plans/DISCOVERY-COMPLETE.md:19`.

---

## OQ-6-ALT-EXCEPTION — the dynamic-alt rule now has two ratified exceptions

**Originating task:** PRIMITIVES-2 PR-A (2026-08-11), Gate C finding GC-1. Rowed the moment it landed, per the standing rule, so the comprehensive founder visual pass does not rediscover `alt=""` as a defect and "fix" it back.

**Deferred work.** Record, at the surface where the rule is stated, that **OQ-6's dynamic-alt rule ("image alt = the market question") no longer holds at two of its three sites.** PRIMITIVES-2 D4 (PD-2-33) superseded it there:

- `src/components/discovery/MarketCard.tsx:50` — the 52×52 card thumb, `alt=""`.
- `src/components/discovery/HeroPanels.tsx:62` — the 54×54 hero market thumb, `alt=""`.

The third site, the hero POST image at `src/components/discovery/HeroPanels.tsx:184`, already shipped `alt=""` and was never governed by OQ-6. **All three Discovery image sites are now uniformly decorative**, which is the state a reviewer should expect to find.

**Why the exception is correct, so it is not re-litigated from scratch.** The market question renders in the adjacent `<h3>`/`<h2>` two lines below the thumb in both cases, so a populated `alt` announces the same string twice (WCAG 1.1.1 duplicate announcement) — and, before D2-P1, the duplicated text was also what overflowed the metadata row when the image 404ed and the browser painted the `alt` string in place of the picture.

**Why deferred.** The a11y half of PD-2-33 is **A11Y.0's** row, not a primitive pass's; PR-A landed only the overflow half. Restating the rule belongs with the surface that states it, and the exception is already carried in three docblocks (`MarketCard.tsx`, `HeroPanels.tsx`, `tests/unit/discovery/render/market-card.test.tsx`) so nothing is unrecorded in the meantime.

**Conditional trigger.** **The comprehensive founder visual pass**, or A11Y.0 — whichever opens first.

**Expected next task.** A11Y.0. Evidence: `docs/plans/PRIMITIVES-2.md` §3 D4 and §11 GC-1; `POLISH-register.md` PD-2-33.

---

## TEST-ISOLATION-EVENTS — a global `events` row count leaks across test files

**Originating task:** PRIMITIVES-2 PR-A (2026-08-11). Observed, not theorised: **once in nine full-suite runs this session.**

**Deferred work.** `tests/server/auth/pseudonym-assigned-event.test.ts:91` asserts `expect(rows.length).toBe(1)` over **the whole `events` table** — *"Exactly one events row total (exactly-once — no spurious rows)"*. In one run it read **2**. The other eight runs, and every isolated re-run, read 1. Scope the assertion to the rows this test creates (filter by its `user_id` / `event_type`, or assert a delta rather than an absolute) so a concurrently-committed row from another file cannot move it.

⚠ **This is the LEDGER's `events` table** — the Bucket-A append-only spine every projection replays from (ADR-0005). A count assertion there that is *known* to read high sometimes is worse than no assertion: the next time it reads 2, the honest reading is "flake again", and that is exactly how a real double-emit — a genuine INV-class defect — gets waved through. The failure mode is not a red test; it is a **future red test that nobody believes.**

**Why deferred.** Not PRIMITIVES-2's. PR-A touches no file under `src/server/**`, no DB code and no auth code, and nothing in its diff is reachable from that test's import graph. Fixing another suite's isolation from inside a display-primitive PR is exactly the "while we're here" that CLAUDE.md §5.4 forbids.

**Conditional trigger.** **The next task that legitimately opens `tests/server/auth/`** — or immediately, if the count is ever seen high a second time, because two sightings retire the flake reading.

**Expected next task.** Any auth-lane task. Evidence: `docs/logs/PRIMITIVES-2-PR-A.md` §6; run 2 of the first PR-A batch.

---

## TEST-SUSPEND-FALSE-RED — a suspended machine reports a FAILURE, not a skip

**Originating task:** PRIMITIVES-2 PR-A (2026-08-11). Observed once, and diagnosed rather than re-run away.

**Deferred work.** When the host suspends mid-run, the pooled Postgres connection dies with it. The next `afterEach` truncate then exceeds its 10 s hook budget and Vitest reports **`Error: Hook timed out in 10000ms`** — a **test-file FAILURE**, indistinguishable in the summary line from a real assertion failure. Seen at `tests/server/bets/daily-credit.test.ts:278` (the `afterEach` truncate) attributed to `bet-place::credit-funds-the-post-floor [T4]` (`:544`), with the runner recording that test's duration as **26,375,459 ms — about 7.3 hours**, which is the tell. The file passed **6/6 in 569 ms** on an isolated re-run minutes later.

**The fix is to make the tell machine-readable, not to raise the timeout.** Raising `hookTimeout` hides it; the duration is already conclusive evidence and nothing reads it. Options: fail the run explicitly when any test's recorded duration exceeds a wall-clock sanity bound, or have the DB fixture detect a dead connection in teardown and abort with a distinguishable message.

⚠ **It lands on a CRITICAL-PATH suite** (`tests/server/bets/` — the W-1 bet spine, CLAUDE.md §1). That is the worst possible place for a false red, because the correct response to a red there is to stop and investigate, and a team that has been burned by this once will reach for "probably the suspend thing" the second time — on the run where it is real.

**Why deferred.** It is test-infrastructure, in a lane PRIMITIVES-2 does not own, and it is not a product defect. The diagnosis is the valuable part and it is recorded here.

**Conditional trigger.** **The next task that opens `tests/_setup/` or a DB fixture** — or the second sighting, whichever comes first.

**Expected next task.** Any task touching the test harness. Evidence: `docs/logs/PRIMITIVES-2-PR-A.md` §6, run 3 of the second PR-A batch.

---

## AUTH-TURNSTILE-WIRE — the Cloudflare Turnstile widget is not mounted

**Originating task:** POLISH.7a (2026-08-11), carrying `PD-0-14` from POLISH.0. Sits beside **RATE-GUARD-PUBLIC** above — same genus (a public-surface abuse control that is specified, sized and unbuilt) and the same date, so they size together.

**Deferred work.** `src/app/(auth)/sign-in/page.tsx:137` is a `TODO(DESIGN.*)` comment and no widget is mounted; `:143-147` is the retained hidden anchor `<input type="hidden" name="turnstileToken" value="placeholder-token" />` (its literal at `:146`), and `otp/page.tsx:105` hard-codes the same placeholder on the resend path. ⚠ **These are HEAD coordinates, re-measured at PR head.** The three this row first carried — `:121`, `:122-126`, `:103` — were the recon SHA's, and **D03's own restructure inside this PR moved them**; `:121` now lands in the middle of D03's explanatory comment. See `docs/plans/POLISH-7a.md` §12 **P-6**. The server half is BUILT and fails closed — `src/server/auth/index.ts:136-142` rejects a missing token and a failed siteverify — so what is missing is the client widget that produces a real token, not the verification.

**What it carries from POLISH.7a's delta table.** `P7a-D06` (the whole Turnstile pane — three ratified states — unbuilt, `data-blocked`) · `P7a-D13` (the OTP screen's *"Secured by Cloudflare Turnstile"* line, deliberately omitted at UI-A7 because restoring it before the widget is real would be a false claim to the user) · `P7a-D04` (the picker's submit reads `Send code`, where the mockup reads `Continue` — the mockup's Continue advanced to the Turnstile pane, so the label's ground returns only when the pane exists).

⚠ **`ADR-0033:25` binds this task.** *"The "Resend" action must carry the same Turnstile token the initial sign-in request sends (today: always-pass placeholder). When AUTH-TURNSTILE-WIRE lands a real widget, the resend path inherits the real token. Keep resend↔sign-in token parity."* Parity holds today — both sites carry `"placeholder-token"` — and a widget wired on one path only would break it silently, because the resend path's failure mode is a 200 with no delivery (ADR-0033 Decision 2).

⚠ **THE TWO TOKEN SITES ARE STRUCTURALLY ASYMMETRIC, and the parity rule above is what that endangers** — `@security-auditor` LOW-2. `sign-in/page.tsx:143-147` carries the token as a hidden `<input>` read out of `FormData`; `otp/page.tsx:105` hard-codes the string literal in the handler. Parity holds today only because both are the same literal. The natural way to mount a real widget replaces the hidden input's `value` — a change that is **invisible** to the resend handler, which has no form field to update. The failure is silent in the worst way: per `ADR-0033` Decision 2 the resend path returns HTTP 200 even when nothing is sent, so a broken resend is indistinguishable from a working one, and nothing on disk goes red. **Wire BOTH sites in one change, and pin the parity with a test.**

**Conditional trigger.** **DUE 2026-09-05**, with RATE-GUARD-PUBLIC. Until it lands, staging runs always-pass test keys and W2.1's three ratified Turnstile states cannot be exercised on any environment — which is why `PD-0-14` is `data-blocked` rather than open.

**Expected next task.** Its own build row; the server contract is already ratified, so it is client-side plus a real key pair. Evidence: `docs/polish/POLISH-register.md` `PD-0-14`, `docs/polish/POLISH-0_data-manifest.md:166`.

---

## AUTH-ERROR-COPY — raw error codes render to participants

**Originating task:** POLISH.7a (2026-08-11), carrying `PD-0-15` from POLISH.0. Tier-1-named at `ADR-0033:29`: *"Humanizing raw error codes (`rate_limited`, etc.) stays deferred to AUTH-ERROR-COPY."*

**Deferred work.** Both auth screens render the SDK's error message unmodified into a `role="alert"` callout. A rate-limited participant reads the literal string **`otp_rate_limited`**.

⚠ **The register's string was wrong and is corrected at POLISH.7a.** The auth code is `otp_rate_limited` (`src/server/auth/index.ts:154,164`), not `rate_limited`. `rate_limited` occurs at six sites in `src/`, **all under `src/components/debate/composer/**` — POLISH.4's surface.** `PD-0-15`'s ID is unchanged; only its title moved.

**Where the strings come from, which is why this is not a copy fix.** The three codes a real user reaches — `turnstile_required`, `turnstile_failed`, `otp_rate_limited` — are produced **inside `src/server/auth/**`**, a CLAUDE.md §1 critical path and template hard floor **F4**. The client fallbacks (`otp_invalid`, `send_failed`, `sign_in_failed`, `resend_failed`) live in the page components. **There is no `code → copy` mapping anywhere on the auth path.** `docs/logs/UI-A7.md:13` records that branching on the error code was deliberately NOT built — *"per-code W2.11 titled blocks … were deliberately NOT built, as branching on the error code is new logic"* — and filed as an open Gate-C question whose outcome is not recorded on `main`. The precedent shape exists one surface over: `src/components/debate/composer/state-map.ts:43` maps a code to a state and `copy.ts` supplies the string.

⚠ **A FOURTH REACHABLE CODE, and it is the one that needs REPLACING rather than humanising — added at POLISH.7a by `@security-auditor` (MEDIUM-1).** **`identity_pool_exhausted`** reaches an anonymous visitor verbatim. Traced hop by hop: `databaseHooks.user.create.before` throws `APIError("SERVICE_UNAVAILABLE", {message:"identity_pool_exhausted"})` (`src/server/auth/index.ts:317-320`) when the pool is dry; `createWithHooks` has no try/catch, so it propagates unwrapped as a 503 JSON body; `[...all]/route.ts:25` intercepts only 403, so it passes through; the `ONBOARDING_REQUIRED` branch at `otp/page.tsx:74` does not match, and `:79` renders it into the shared callout.

**Why it is worse than a cosmetic code.** SPEC.1 §16.4 scopes `identity_pool` depth as *"Not visible to users. Admin-only operational view (pool depth, exhaustion alerting)"*. This publishes its TERMINAL state. An attacker draining the pool with catch-all sub-addressed signups gets a free progress oracle telling them the instant registration is denied to every legitimate participant. The correct copy is therefore GENERIC ("Sign-up is temporarily unavailable"), not a translation of the code. ⚠ **Pre-existing on `main`** — the identical string reached the identical `role="alert"` region through the deleted file-local `AuthError`; POLISH.7a re-homed the render path byte-identically and did not change the exposure.

**Conditional trigger.** Pre-go-live (2026-09-15).

⚠ **CO-EXECUTE with AUTH-OTP-FIDELITY** (POLISH.7a R-F). Both land in `sign-in/otp/page.tsx`; three separate critical-path rituals on one file is three times the ceremony for one diff. This row keeps its own name because ADR-0033 names it.

**Expected next task.** Its own gated task, co-scheduled. Evidence: `docs/polish/POLISH-register.md` `PD-0-15`; `docs/logs/POLISH-7a.md`.

---

## AUTH-OTP-FIDELITY — the OTP screen's two ratified affordances are unbuilt

**Originating task:** POLISH.7a (2026-08-11), ruled at R-F. Carries `P7a-D10` and `P7a-D11`.

**Deferred work, two halves.**

> **6-box segmented code entry.** `DESIGN_W2_1_CLOSE-OUT.md:60` locks *"OTP: ours — 6-box, resend cooldown, invalid/expired/locked"*, and the mockup renders it (`:364`, CSS `:212-216`). The build ships one field with `pattern="[0-9]{6}"` and `tracking-[0.5em]` (`otp/page.tsx:164-173`, head coordinates — `:134-143` was the recon SHA's and now lands inside D07's comment).
>
> **Resend cooldown.** The mockup ships `resendBtn` DISABLED at entry plus a `resendTimer` (`:366-370`, CSS `:220-224`); the built control is enabled immediately with no timer.

**Why neither shipped in the machine pass — halt H2, twice.** The 6-box port cannot preserve `UI-A7.md:99`'s byte-for-byte pin (*"preserve `pattern="[0-9]{6}"`, `maxLength={6}`, `inputMode="numeric"`, `name="otp"`"*) without new client submit logic. And a cooldown is not cosmetic: it gates how often `sendVerificationOtp` fires against the server's own per-email and per-IP limiters (`src/server/auth/index.ts:148-166`).

⚠ **The cooldown and AUTH-ERROR-COPY are one user experience.** Without a cooldown, a participant mashing Resend hits `otp_rate_limited` — and reads that string raw, which is `PD-0-15` itself. Fixing either alone leaves the other visible on the same screen.

⚠ **A tier-1/tier-2 tension a reviewer must resolve, not absorb.** `ADR-0033:21` Decision 2 specifies the resend affordance with **no** cooldown clause, and `docs/plans/AUTH-OTP-DELIVERY.md:164` describes the built behaviour as deliberate — *"it gives the user agency, not delivery detection"*. Tier 2 (the W2.1 close-out) says cooldown. Both are quoted in `docs/logs/POLISH-7a.md`; neither was resolved by POLISH.7a.

**Conditional trigger.** Pre-go-live (2026-09-15), co-executed with AUTH-ERROR-COPY.

**Expected next task.** Its own gated task. Evidence: `docs/plans/POLISH-7a.md` §3 rows D10/D11.

---

## AUTH-ONBOARDING-GATE — Continue is not disabled until the checkbox is ticked

**Originating task:** POLISH.7a (2026-08-11), ruled at R-B. Carries `P7a-D16`.

**Deferred work.**

> `SPEC.1.md:777` — *"**Continue button is disabled until the checkbox is ticked.**"* The build gates submission with the native `required` attribute (`onboarding/page.tsx:135`) and leaves the button always enabled (`:143-148`).

⚠ **This is TIER-1 SPEC-LOCKED, not a styling preference.** `SPEC.1.md:805`: the F-AUTH-4 structural commitments *"are spec-locked and cannot be relaxed by the UI/UX pass without an ADR amending this section."* And `SPEC.1.md:817` assigns the conformance check to POLISH.7a by name — *"Whether the build matches is POLISH.7a's verification"* — which is how this was found.

⚠ **NOT UNSAFE TODAY, and the distinction is load-bearing for scheduling.** `required` blocks native form submission, and `acceptTosAction` re-checks server-side and returns `{ ok: false, code: 'tos_acceptance_required' }`. Acceptance evidence (`tos_accepted_at`, both version hashes, IP, user-agent) is sound. This is a fidelity gap against a spec-locked line, dated — not an emergency.

**Why it halted (H2).** The fix needs reactive client state around the acceptance form, and `UI-A7.md:76` ratified *"Card stays RSC (presentational) — no new client boundary"* for that page. Tier 1 wins on precedence and tier 3 was void on this point from the day `:805` landed, but the change is on a submit path and exceeds a cosmetic edit boundary.

**Conditional trigger.** Pre-go-live (2026-09-15).

**Expected next task.** Its own gated task on the auth critical path. Full quotations both sides: `docs/plans/POLISH-7a.md` §3 note (e).

---

## AUTH-GOOGLE-MARK — the Google button carries no mark, and cannot obviously carry one

**Originating task:** POLISH.7a (2026-08-11), §2.1 (1). Carries `P7a-D02`.

**Deferred work.** The W2.1 picker renders a 20px circular `.gmark` "G" before the label (`mockup:314-316`, CSS `:149`); the build renders label text only (`sign-in/page.tsx:92-97`).

**Why it is a founder decision and not a machine-pass fix.** It sits at the intersection of a ratified internal constraint and an unverified external one. Internally, DESIGN.B1 ratified a TRUE-NEUTRAL system with no brand accent, CI-guarded by `tests/unit/design/tokens-monochrome.test.ts` (11-token achromatic census, `--color-brand` banned) — so the official multicolour mark is out by construction. Externally, a monochrome or custom "G" is a *modified* Google mark, which Google's sign-in branding guidelines address and which cannot be adjudicated from inside a POLISH run.

**The three options, so the decision starts from a list rather than a blank page.** (a) the official coloured mark — violates B1 and reddens the token guard; (b) a monochrome or custom G — a modified mark, needs the external check; (c) text only — what ships today, and defensible.

**Conditional trigger.** Founder decision, undated. Not go-live-gating: (c) is a shipping state, not a broken one.

**Expected next task.** A founder ruling, then either nothing or a one-line component change. Evidence: `docs/plans/POLISH-7a.md` §2.1 (1).

---

## AUTH-FIRST-LOGIN — an A7-ledger row with no definition on `main`

**Originating task:** named as a sibling A7-ledger task at `docs/plans/AUTH-OTP-DELIVERY.md:226` and `docs/logs/AUTH-OTP-DELIVERY.md:31`; given a row here at POLISH.7a (2026-08-11) under the standing rule at the top of this file.

**Deferred work — UNDEFINED, and that is the finding.** `git grep AUTH-FIRST-LOGIN` over the whole tree returns exactly three hits: the two list mentions above and `docs/plans/POLISH-7a.md`. **No document on `main` states what the defect is.** The name has been carried in two ledgers since 2026-07-22 with no scope, no owner and no date.

⚠ **A claim about it could not be verified.** `docs/plans/POLISH-7a.md:262` records that *"`AUTH-OTP-DELIVERY` **OBS-3**: the defect may no longer reproduce — a fresh signup landed cleanly on `/onboarding` with a pseudonym assigned"*. **`OBS-3` does not exist in either AUTH-OTP-DELIVERY document** — `grep -n "OBS-3"` over both returns nothing. The observation may be real and recorded off-repo, but it cannot be confirmed from `main`, so it is repeated here as an attribution rather than as a fact.

**Conditional trigger.** **Re-verify before scoping.** The first action is not to fix anything — it is to establish, from a live signup, whether there is a defect at all. If there is not, this row closes.

**Expected next task.** A scoping pass, not a build. Evidence: `docs/logs/POLISH-7a.md`.

---

## AUTH-HARDEN — three auth-path hardening items, one of them load-bearing

**Originating task:** named at `docs/plans/AUTH-OTP-DELIVERY.md:226` and `docs/logs/AUTH-OTP-DELIVERY.md:28,31`; given a row here at POLISH.7a (2026-08-11).

**Deferred work, seven items.**

> **(1) Spoofable XFF.** `src/server/auth/index.ts:109-115` takes the LEFTMOST `x-forwarded-for` element as the client IP, which a client controls. It keys the OTP per-IP burst limiter. The same shape is already parked for `extractIp()` and for `tos_acceptance_ip` (`docs/logs/UI-A7.md:22`) — this is the third site of one defect.
>
> **(2) Sentry `beforeSend` scrubber.** Recorded at `docs/logs/AUTH-OTP-DELIVERY.md:28`: no leak today (`sendDefaultPii:false` plus a bounded Resend error shape, both verified by `@security-auditor`), but that PR was the first to route Resend errors into Sentry.
>
> **(3) ⚠ THE OTP SENDER'S CAPTURE IS UNFLUSHED.** `src/server/auth/email-otp.ts:60,65` calls `Sentry.captureException` RAW — no flush, no `waitUntil` — while the repo has `safeCaptureException` / `safeFlush` and routes other call sites through them (`src/server/bets/endpoint.ts`, `replay.ts`, `dharma/header-balance.ts`, `header-portfolio.ts`, `api/cron/alarms-drain/route.ts`). On a serverless function that can freeze the instant the response is returned, an unflushed capture is a capture that may never arrive.

> **(4) ⚠ PARTICIPANT EMAIL ADDRESSES EGRESS TO SENTRY IN THE URL QUERY STRING, at 100% trace sampling** — added at POLISH.7a by `@security-auditor` (MEDIUM-2). `sign-in/page.tsx:73` pushes `/sign-in/otp?email=<real address>`; `instrumentation-client.ts:10-16` sets `tracesSampleRate: 1.0`, and `httpContextIntegration` (a Sentry default) sets `event.request.url` from the FULL `location.href` on every event including transactions. `sendDefaultPii:false` governs IP and cookies, **not the URL**, and there is no `beforeSend` anywhere in `src/` or the three `sentry.*.config.ts` files. ⚠ **This is NOT what item (2) already covers** — (2)'s recorded justification (*"no leak today … bounded Resend error shape"*) is scoped to the SERVER-side Resend capture. SPEC.1 §16.3 `H2` lists `email` among the fields wiped on erasure; a DB scrub cannot reach Sentry's 90-day store or Vercel access logs, so the erasure promise is discharged in the database and silently not in the processor — on a project whose premise is that a pseudonym is not linkable to a real identity. **The better fix is to stop putting the address in the query string at all** (it is already in component state and re-editable at `otp/page.tsx:155-163`), which also clears browser history and access logs; a `beforeSend` scrubber is the weaker second option. PostHog is CLEAN on this axis — autocapture, pageview, pageleave and session recording are all off.
>
> **(5) THE SITEVERIFY FETCH IS ORDERED AHEAD OF EVERY RATE LIMITER** — `@security-auditor` MEDIUM-3, and it is the consequence item (1) does not state. `src/server/auth/index.ts:139` fires an outbound HTTPS POST to Cloudflare BEFORE the per-email and per-IP limiters at `:148-166`. With the leftmost-XFF spoof from item (1), an unauthenticated attacker evades both the app limiter AND Better Auth's built-in one (which reads the same header) and amplifies each request into a third-party call. If Cloudflare then rate-limits the project secret, `verifyTurnstile` returns false for everyone (`:97-99`) — fail-closed degrades into a **full outage of the email sign-in path**.

**Why (3) is the one that matters.** `ADR-0033` Decision 2 ratifies returning HTTP 200 on a FAILED OTP delivery, and designates that Sentry capture as the **sole** mitigation: *"Failed delivery is handled by (a) a "Resend code" … affordance, and (b) server-side observability (`Sentry.captureException` in the sender)."* If the capture does not reliably land, a deliberate silent-failure design has no observability arm at all. Note also that Sentry delivery on this path is **unverified rather than unwired** — no positive control has been fired on staging.

⚠ **`src/server/auth/**` is a CLAUDE.md §1 CRITICAL PATH.** Full plan→execute ritual with the named-reviewer cascade, in its own chat. Not foldable into a polish pass.

> **(7) `users.name` AND `users.image` ARE CLIENT-WRITABLE AT FIRST EMAIL-OTP SIGNUP** — `@security-auditor` LOW-5, homed here at Gate C. Both are first-class fields on better-auth's `signInEmailOTPBodySchema` (`email-otp/routes.mjs:353-361`) and are written straight through on the create branch (`:404-412`), so a participant can set them to arbitrary strings. The three IDENTITY columns are correctly locked — `pseudonym`, `pfpFilename`, `googleId` carry `input: false` and `parseInputData` **throws** — but `name`/`image` are not in that set. **No render path exists today** (verified: the public face is `pseudonym` + `pfpFilename` everywhere), so there is no stored-XSS sink. **The residual is the 2026-11-06 dataset release** — SPEC.1 §16.4 releases the `users` row, so a wholesale column export would publish attacker-controlled text. ⚠ **It is homed HERE and not in the dataset task because the DEFECT is a writable-field-set question in `src/server/auth/**`; the dataset leak is its CONSEQUENCE. One file, one owner.** ⚠ **The cross-reference asked for at Gate C — `docs/specs/dataset-release.md` — DOES NOT EXIST.** `docs/specs/` holds `cpmm.md`, `debate-export.md`, `flows/`, `RANKING.md`, `SPEC.1.md`, `SPEC.2.md` and nothing else, verified at PR head. Writing the citation live would mint the same phantom `SPEC.CHART` already is — `POLISH-0.md` §2's existence rider: *a citation is not an artifact*. The real destination that DOES exist is the **DATASET RELEASE** task, which this file already names as an owner at the STAGING-PARITY Slice B row (`docs/parked.md:508,517`), and the governing spec text is **SPEC.1 §16.4**, which releases the `users` row. **The column allow-list decision belongs to DATASET RELEASE; if it ever gets a spec file, this row's pointer is what should be updated to name it.**
>
> ⚠ **(6) NO ERROR BOUNDARY IN THE TREE REPORTS TO SENTRY** — `@security-auditor` LOW-3. `(auth)/error.tsx`, `global-error.tsx`, `bookmarks/error.tsx` and `u/[pseudonym]/error.tsx` all destructure only `reset`. A boundary makes the error HANDLED, so Sentry's global `onerror` never sees it, and CLIENT-side render errors on the signed-out sign-in path go invisible. **A tree-wide decision, not POLISH.7a's** — the new file matches the established family exactly, which is what the plan asked for.

**Conditional trigger.** Pre-go-live (2026-09-15). Item (3) should lead.

**Expected next task.** Its own gated auth task. Evidence: `docs/logs/AUTH-OTP-DELIVERY.md:28`; `docs/logs/POLISH-7a.md`.

---

## AUTH-CONSENT-LINE — ✅ **STRUCK at POLISH.7a (2026-08-11)**

**Originating task:** named once, at `docs/plans/PRIMITIVES-1.md:342`, as *"AUTH-CONSENT-LINE (POLISH.7a verification)"*. Closed at POLISH.7a R-D. This row exists so that reference resolves to a decision instead of to nothing.

**What it was.** `git grep` over the whole tree returns **exactly one occurrence** — the citation above. No definition, no scope, no owner, no date. The only artifact it could plausibly have meant is the W2.1 picker's `.mfoot` *Terms · Privacy* line (`mockup:323-325`, CSS `:164-167`), which POLISH.7a filed as `P7a-D05`.

**Why struck rather than defined — four grounds, each independently sufficient.**

1. **The page-level footer was withdrawn.** Founder ruling 2026-08-02; B4 is VOID, not deferred (`SPEC.1` v1.0.26 `:1498`). `POLISH-0.md:159`: *"The absence of a footer in `src/` is true and correct."*
2. **The links would be dead.** `/terms` and `/privacy` do not exist as routes. `docs/logs/UI-A7.md:15` records the omission as deliberate and agreed by both reviewers, on exactly this ground.
3. **A guard would go RED.** `tests/unit/shell/not-found.test.tsx:108-167` bans any `<footer>` under `src/app/**` that is not nested inside a content container, and names `(auth)/onboarding/page.tsx`'s nested footer as the legitimate case.
4. **Tier 1 replaced the mechanism.** `SPEC.1.md:807-817` records that implicit footer acceptance lapsed and the explicit checkbox stands, calling it *"the stronger answer to the acceptance-evidence question W2.1 left open."*

**Conditional trigger.** None. Closed.

**Expected next task.** None. If a consent line is ever wanted on the picker it is a fresh decision with a new name, not this row reopened.

---

## LEGAL.1 — the ToS and Privacy bodies are placeholder Lorem ipsum — ⚠ **GO-LIVE GATE**

**Originating task:** POLISH.7a (2026-08-11), ruled at R-E. Carries `P7a-D17` and `P7a-D18`, and the pre-recorded content-block on `POLISH-0.md:174`.

⚠ **`HARDEN.6` and `HARDEN.7` ARE ALIASES OF THIS ROW.** The same deliverable is named three ways across the corpus: `LEGAL.1` (`POLISH-0.md:174`), `LEGAL.1 ← HARDEN.6` (`POLISH-0.md:295`), and `HARDEN.7` in the placeholder files themselves. **`LEGAL.1` is canonical.**

**Deferred work.** `public/legal/tos.txt:1` opens *"Zugzwang Experiment — Terms of Service (PLACEHOLDER v0)"* and `:3` says *"This is placeholder Lorem ipsum copy used during SCAFFOLD.3 development."* `public/legal/privacy.txt` is the same shape. Both are 22 lines. Both are rendered IN FULL, in-page, on `/onboarding` — `SPEC.1.md:776` requires exactly that — so a real participant accepts placeholder text on a screen whose entire purpose is recording that acceptance.

**Three things it carries, and the third is easy to lose.**

1. **The bodies** — the actual legal text (`P7a-D18`).
2. **The version label** (`P7a-D17`). `SPEC.1.md:789` specifies footer text of the form *"ToS v1.0 · `<hash>`"*; the build renders the hashes only, because the hashes ARE the placeholders (`placeholder-tos-v0` / `placeholder-privacy-v0`). Unjudgeable until real versions exist.
3. ⚠ **The AGPL §13 source offer.** When B4 voided the page-level footer, the obligation did not go away — it RELOCATED INTO THE ToS BODY (`SPEC.1.md:1144`: *"Surfaced in the Terms of Service body … Hard legal requirement"*). It is a licence obligation on a body of text that does not exist yet. *(`PRIMITIVES-1.md:345` records AGPL `I6` as its own row, severed from LEGAL.1 — that severance is about ownership of the check, not about where the text lives.)*

**Why it is a gate and not a polish item.** `SPEC.1` §13 F-AUTH-4 requires acceptance EVIDENCE — `tos_version_hash`, `privacy_version_hash`, IP, user-agent, all written in one transaction — and calls it *"the dispute-resolution record"*. Evidence of accepting Lorem ipsum is not a dispute-resolution record. The mechanism is built and correct; only the content is missing.

**Conditional trigger.** **Before go-live, 2026-09-15.** The placeholder files name *"mid-July 2026"* as the delivery date, which is four weeks past as of this row.

**Expected next task.** Its own chat, alongside MOD-REPORT-PATH — founder-owned, with an external dependency (legal review) and real lead time. Evidence: `docs/plans/POLISH-7a.md` R-E.

---

## NO-RAW-HEX-REACH — **REACH CLOSED, SET-EQUALITY RESIDUAL OPEN** — routed to the quality lane with R15

**Originating task:** POLISH.7a recon (2026-08-11), §5. Closed in the same PR that found it. The row exists to record a false receipt, not to track open work.

**What it was.** `tests/unit/design/no-raw-hex-view-layer.test.ts` claimed *"the participant view layer"* in its docblock (`:5-6`) while its input set reached `src/components` + `src/app/(public)` + four named files. Of the `(auth)` group only the LAYOUT was named; **all three route files were outside the set.**

**Why it is worth a row after being fixed.** `UI-A7.md:213` made this guard an exit criterion for the auth skin, and `docs/logs/UI-A7.md:28` recorded it discharged with *"Design guards … green; zero raw hex."* **The guard could not read any of the three files that skin changed.** The green run was true and blind — a promised assertion delivered vacuously, which reads as discharged and is worse than an absent one (POLISH-SURFACE-TEMPLATE §8.1 N8 / V-6). The receipt is now in the git history and the row is what tells a future reader not to trust it.

**What closed it.** The three route files, plus the two files POLISH.7a added beside them (`AuthAlert.tsx`, `error.tsx`), joined `SCAN_FILES`. RED-first on all three RULE-1 axes, with axis ③ — a `#c0ffee` literal in `onboarding/page.tsx` — measured GREEN before enrolment and RED after.

⚠ **ONE WEAKNESS FOUND AND NOT FIXED, so it is visible rather than discovered later.** RULE-1 axis ② (member REMOVED) leaves the suite **GREEN**. The scanned set is 107 files and the alive check is `toBeGreaterThan(20)` — a FLOOR, not set equality (§8.1 N5). A silently deleted `SCAN_FILES` entry is undetectable by this guard. Changing the alive check's shape is a decision about a guard POLISH.7a does not own and exceeded that PR's edit boundary.

⚠ **A SECOND RESIDUAL, and it is the STRUCTURAL fix** (`@code-reviewer` L-5 / CLAUDE.md **O-1**, *structural beats procedural*). `SCAN_DIRS` is `["src/components", "src/app/(public)"]`. **Adding `"src/app/(auth)"` to it makes all five named `SCAN_FILES` entries redundant AND covers `_components/` — a NEW unscanned directory this PR created.** The named-file shape is what forced two extra enrolments inside this very PR to stay closed. It was not done here because the plan's §5 prescribed the named-file form and `SCAN_DIRS` is out of this surface's edit boundary.

**Conditional trigger.** For BOTH residuals: the next task that legitimately opens `tests/unit/design/`.

**Expected next task.** The quality lane, alongside **R15** (which extends the same guard to Tailwind palette classes) — **one visit, THREE fixes**: R15's palette-class ban, the N5 set-equality floor, and the `SCAN_DIRS` structural fix. Evidence: `docs/logs/POLISH-7a.md` §5.
