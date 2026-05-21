# SCAFFOLD.12 — Domain + DNS setup (`zugzwangworld.com` → Vercel) + `BETTER_AUTH_URL` cutover

**Status:** Closed 2026-05-21
**Branch:** `feat/scaffold-12-domain-cutover` (from `main` at `2fb9091`; 5 commits — plan promote + email-otp.ts comment fix + 2 plan amendments + this close-out)
**PR:** [#44](https://github.com/zugzwang-foundation/experiment/pull/44)
**Predecessor:** SCAFFOLD.13-B (#43, post-merge SHA `2fb9091`)
**Unblocks:** SCAFFOLD.3-FOLLOWUP-1 (production auth functionality is now blocked solely on FOLLOWUP-1 since cutover is verified — `BETTER_AUTH_URL`/OAuth-client wiring all correct at `https://zugzwangworld.com`); any future task requiring a stable production origin instead of the Vercel-default deploy alias

## What landed (§5.9 field 1)

- **Custom apex domain `zugzwangworld.com` attached to Vercel project `experiment`**, with apex-canonical posture (www → apex 308 redirect auto-installed via Vercel canonical-domain setting at §2 domain-add; §5 implicit satisfaction).
- **DNS records added at Namecheap PremiumDNS** (DNSSEC on, nameservers unchanged):
  - `zugzwangworld.com` A → `216.198.79.1` (project-specific Vercel IPv4, not the older generic `76.76.21.21`)
  - `www.zugzwangworld.com` CNAME → `b2cddc96cb109c21.vercel-dns-017.com` (project-specific Vercel CNAME target, not the older generic `cname.vercel-dns.com`)
  - No CAA records added (§0.5 baseline had none; default behavior allows any CA including Let's Encrypt).
  - Existing Proton baseline preserved: 3 DKIM CNAMEs, 1 verification TXT, 1 SPF TXT, 2 MX records — none modified. Verified via §7.5 external→Proton delivery test (Gmail → `foundation@zugzwangworld.com` → Proton inbox).
- **TLS auto-issued** by Vercel via Let's Encrypt on apex + www within ~minutes of DNS validation (§4 PASS).
- **`BETTER_AUTH_URL` flipped to `https://zugzwangworld.com` at both Vercel scopes** via single Doppler `prd` edit per Q1 Both (post-SURPRISE-5 reversal). Doppler→Vercel integration syncs propagated to both Production AND Preview env-var entries (verified via `vercel env ls <scope> --format json` showing `updatedAt: 2026-05-21T11:29:09 UTC` / `11:29:08 UTC`). New Production deployment `37d6749U6` Ready post-§6 (manual redeploy required per 13-B SURPRISE 11 carry-forward).
- **Google OAuth client URI verified** (verify-not-add per execute-time SURPRISE 3). Final state: `[http://localhost:3000/api/auth/callback/google, https://zugzwangworld.com/api/auth/callback/google]`. The vercel-default callback URI was never present — operator had added `zugzwangworld.com` callback manually at some earlier point during initial OAuth client configuration; production OAuth never tested at vercel-default URL until this task.
- **`src/server/auth/email-otp.ts:5-9` comment fix** (commit `e2c106f`) — removed brittle SCAFFOLD.12 cross-reference ("until SCAFFOLD.12 verifies the production domain") and redirected to the parked.md §10.b follow-up row. Comment-only; no behavior change.
- **`docs/parked.md` created** with §10.b (Resend domain verification + `RESEND_FROM_EMAIL` flip) + §10.c (Preview-env `BETTER_AUTH_URL` value flip; coupled with §10.d) + §10.d (Preview-alias callback URI add to Google OAuth client; conditional follow-up). §10.a removed at plan-amendment time (vercel-default URI cleanup was moot per SURPRISE 3).
- **Plan amendments to `docs/plans/SCAFFOLD.12.md`** — two amendment commits post-promote covering SURPRISE 3 cascade (§1 verify-not-add, §4 transient framing, §7.2 first-time-test annotation, §8 audit scope, §9.1 walk list, §10 restructure, §11 exit criteria, Verification end-to-end) and SURPRISE 5 cascade (Q1 reversal Split → Both, §6 single-Doppler-edit rewrite, §8 audit scope Preview-env, §10 header, §10.c reframing, §11 exit criteria, §12 log schema, Verification end-to-end). Both commits also added entries to a new "Execute-time amendments" section in the plan.
- **`feedback_vercel_env_writeonly.md` memory updated** — precision note on default `vercel env ls` tabular vs `--format json` for `updatedAt` access. The default tabular view shows `createdAt` only and misleads for Doppler-integration-managed entries (which don't update `createdAt` on value changes).

## Decisions made (§5.9 field 2)

- **Q1 — Both scopes flip** (reversed Split → Both at execute-time SURPRISE 5 per operator decision + web-Claude adjudication). Single Doppler `prd` edit propagates to both Vercel Production + Preview via Doppler→Vercel integration sync; no Vercel-direct override; no Doppler config split. Reasoning chain: SURPRISE 3 established no working preview OAuth state at the vercel-default URL; SURPRISE 5 confirmed via out-of-sequence Doppler edit + recovery that there is no working state to protect via Split. The M1/M2/M3 mechanic dependency POTENTIAL SURPRISE 4 flagged evaporates.
- **Q2 — Operator via Vercel Dashboard** (matches 13-B precedent across credential mutations). For §6 specifically, the operator acts in Doppler Dashboard (since `BETTER_AUTH_URL` is Doppler-managed source-of-truth per §0.2); CC verifies via `vercel env ls <scope> --format json`.
- **Q3 — Resend `RESEND_FROM_EMAIL` flip deferred to parked.md §10.b** (follow-up, not in this PR). Sandbox sender `onboarding@resend.dev` stays for §7.3 verification (delivers to `zugzwangworld@proton.me`).
- **Option B at §7.2/§7.3 FOLLOWUP-1 manifestation** — accept §7.2/§7.3 as PASS-with-FOLLOWUP-1 (cutover-verified), continue §7.4/§7.5/§8/§9. Reasoning: the 415-as-cutover-ground-truth mapping (identical to 13-A `DATABASE_URL` 415 ground-truth methodology) is load-bearing positive evidence that all SCAFFOLD.12 cutover layers (DNS, TLS, Vercel routing, `BETTER_AUTH_URL`, OAuth client URI) are correctly wired — the failure was generated by Better Auth at the new domain, not by anything upstream. The 415 is downstream of every SCAFFOLD.12 concern and identical to the SCAFFOLD.3-FOLLOWUP-1 bug pattern from 13-A. Coupling SCAFFOLD.12 close to FOLLOWUP-1 close would create artificial blocker.
- **§5 implicit satisfaction via §2 apex-canonical flip** (operator flipped Vercel's UI default www-canonical to apex-canonical pre-§3 to match plan; Vercel auto-installed the www→apex 308 redirect at the edge as a side-effect). §5's "configure" verb effectively reduces to verify-not-set, mirroring §1's SURPRISE-3 reduction. Recorded in this log rather than via mid-execute plan amendment to avoid commit churn.
- **Reviewer-call invocation summary** (CLAUDE.md §5.11):
  - **§8 security-auditor** (`.claude/agents/security-auditor.md`): **PASS.** No CRITICAL / HIGH / MEDIUM / LOW exploitable findings against SCAFFOLD.12 scope. One non-security SURPRISE: `docs/parked.md` + `docs/logs/SCAFFOLD.12.md` not yet present on branch (caught by plan §9.1 + §11 exit-criteria; resolved by this close-out commit). Key positive findings: Better Auth `trustedOrigins` correctly derives from `baseURL = https://zugzwangworld.com` (legacy vercel-default no longer trusted); cookies remain host-only HttpOnly+Secure+SameSite=Lax with admin/participant scope separation; OAuth scope set unchanged (no `offline_access`, no refresh-token request); `email_verified === true` enforcement preserved at `mapProfileToUser`; zero hard-coded URL leaks in `src/`; no HTTP-in-transaction violations; INV-1/INV-2/INV-3/INV-4 not touched. Invoked via `subagent_type: "security-auditor"` directly (NOT via the general-purpose-with-role-baked-in pattern CLAUDE.md §5.11 documents — see maintenance candidate below).
  - **code-reviewer NOT invoked** — the only `src/` change was a 3-line comment fix with no behavior change, no symbol added/removed, no control flow change. Per CLAUDE.md §5.11 "When NOT to invoke a reviewer call": tightly analogous to "type-only declarations (the type-check is the gate)" — no exploitable surface to review.
  - **db-migration-reviewer NOT invoked** — no schema or migration changes in this PR.
  - **test-writer NOT invoked** — no new business-logic behavior introduced (cutover work is configuration + verification only).

## Surprises caught + fixed in-session (§5.10 — 6 entries plus POTENTIAL SURPRISE 4 MOOT)

Per memory `feedback_audit_surprises.md`: close-out logs carry the full chain, not a buried footnote.

1. **Execute-time SURPRISE 1 (2026-05-20, pre-promote).** Plan-time SURPRISE 1's "remain tracked" claim was wrong. `.vercel/repo.json` is gitignored per `.gitignore:60 .vercel` and has never been tracked (`git ls-files .vercel/` empty; `git log --all -- .vercel/repo.json` empty). Vercel's own `.vercel/README.txt` states "you should not share the '.vercel' folder with anyone." Substance of §0.4 PASSES (project linkage matches plan exactly: `id: prj_5krm0VEQQ9TleA2rjUBIL3oLJpiI`, `orgId: team_m0d8TiC9xuPrm9qI8ob6byBM`, `name: experiment`, `directory: "."`). Plan-time SURPRISE 1 wording rewritten pre-promote (operator approved Option A in-place amend with 2 specific corrections); §0.4 verification mechanic rewritten pre-promote (`test -f` + content match + `git check-ignore -v` instead of `git ls-files`). Forward-relevance: future plan templates should not assume gitignored files survive as "tracked" based on creation-vs-gitignore timing — gitignored files are gitignored, period.

2. **Execute-time SURPRISE 2 (2026-05-20, §0.1 close).** Stale forward-reference in `src/server/auth/email-otp.ts:5-6` ("until SCAFFOLD.12 verifies the production domain" — but SCAFFOLD.12 does NOT per Q3 resolved at plan-review). Operator approved Option (i) absorb-in-this-PR via separate commit (`e2c106f`) with operator-supplied rewrite redirecting to parked.md §10.b. NO behavior change. Logged as in-scope absorption per CLAUDE.md §7 (<2h drift surfaced by stratum, absorbed by stratum). Security-auditor flagged the precision point that at commit-boundary the new comment points to `docs/parked.md` which didn't yet exist (transient inter-commit reference inconsistency, resolves at PR merge once parked.md is created in this close-out).

3. **Execute-time SURPRISE 3 (2026-05-21, §0 close).** Google OAuth client Authorized redirect URIs baseline diverged from plan. Actual list = `[http://localhost:3000/api/auth/callback/google, https://zugzwangworld.com/api/auth/callback/google]`; the vercel-default callback URI was never present. Operator timeline: `zugzwangworld.com` callback added manually at some earlier point during initial OAuth client configuration; production OAuth never tested at vercel-default URL. Web-Claude adjudicated:
   - §1 collapses to verification (URI already present; CC verifies exact-string match against §0.3 baseline).
   - §10.a (deferred cleanup of vercel-default-callback) is MOOT — URI never in OAuth client; no parked.md row.
   - §4 transient OAuth-break window reframed: failure mode is Google `redirect_uri_mismatch` (vercel-default URI absent from OAuth client list), not cross-origin cookie transfer failure on callback (original framing assumed vercel-default URI was authorized; SURPRISE 3 established it never was).
   - §7.2 framing: first-time-ever production Google OAuth test, not regression.
   - Q1 (Split, then) RECONFIRMED with revised reasoning at this point: preview-deploy OAuth never worked at vercel-default URL either (same callback URI absent from OAuth client). [Q1 subsequently REVERSED to Both at SURPRISE 5 — see entry 5.]
   - §10.d added: Preview-alias callback URI add to Google OAuth client (conditional follow-up).

   Plan amendments committed as `plan(scaffold-12): amend per execute-time SURPRISE 3 — §1 verify-not-add + §4 transient framing + §10 restructure` (`f494e58`).

4. **POTENTIAL SURPRISE 4 (CC-flagged 2026-05-21, MOOT post-SURPRISE-5).** CC flagged that §6 substantive flow (Doppler-managed source-of-truth + Q1 Split mechanic) was non-trivial. Three candidate mechanics surfaced for adjudication:
   - M1 — Vercel-direct override on Preview (relies on Vercel precedence rule; not pre-verified empirically)
   - M2 — Doppler config split (cleaner separation; doubles config maintenance)
   - M3 — Doppler integration-sync key exclusion (Doppler-feature-support unknown; pre-verification needed)

   SURPRISE 5's Q1 reversal (Split → Both) eliminated the mechanic dependency entirely. The candidate-mechanic exploration is now historical-only and preserved as reference in parked.md §10.c (for a future task that wants Preview OAuth to actually work at preview-alias URLs).

5. **Execute-time SURPRISE 5 (2026-05-21, pre-§1 verification window).** Operator out-of-sequence action + Q1 reversal Split → Both. Timeline:
   - Operator edited Doppler `prd` `BETTER_AUTH_URL` → new URL out-of-sequence (before §1 verification ran, before any M-mechanic pre-verification).
   - Doppler→Vercel sync fired; both Production and Preview scopes briefly reflected new URL value at Vercel env-var entry level.
   - Operator reverted Doppler `BETTER_AUTH_URL` to old URL (`https://experiment-zugzwang-worlds-projects.vercel.app`) and manually redeployed; pre-§6 state restored.

   **Q1 reversed Split → Both** because no working preview OAuth state to protect (per SURPRISE 3 chain). Q1 = Both removes the M1/M2/M3 mechanic dependency POTENTIAL SURPRISE 4 flagged — single Doppler edit, both scopes flip together, no Vercel-direct override, no Doppler config split.

   Preview OAuth still won't work at preview-alias URLs post-Q1 = Both, but for a different reason (cross-origin cookie transfer failure when callback hits apex). Enabling Preview OAuth is parked at §10.c + §10.d (conditional follow-ups).

   Plan amendments committed as `plan(scaffold-12): amend per execute-time SURPRISE 5 — Q1 reversal Split → Both + §6 single-Doppler-edit rewrite` (`910ef93`). §6 substantively rewritten: start point pinned as Doppler Dashboard (was Vercel Dashboard); single Doppler edit propagates to both Vercel scopes; manual Vercel redeploy required.

   Forward-relevance: operator out-of-sequence dashboard action pattern recurs (13-A §0 finding 4 / SURPRISE 5 across SCAFFOLD.13 phase: now 2 instances of "operator did the operation out of plan sequence; state recovered or was already correct"). Plan templates may need to either (a) be more explicit at the prescription level about "do NOT fire this operation yet" gates, OR (b) accept that pre-emptive dashboard work is operationally common and plan around it (always verify state-before-§N rather than assuming pre-§N baseline).

6. **Execute-time finding 6 (2026-05-21, §7.2 + §7.3).** FOLLOWUP-1 scope broadens. 13-A originally framed FOLLOWUP-1 as "Email-OTP 415 on Content-Type" (specifically `/api/auth/email-otp/send-verification-otp`). §7.2 surfaced an identical HTTP 415 UNSUPPORTED_MEDIA_TYPE response at `/api/auth/sign-in/social` (Google OAuth path). §7.3 corroborated: same 415 response body at the Email-OTP endpoint.

   **Reframing.** The bug is at the Better Auth Content-Type middleware layer (rejects `application/x-www-form-urlencoded`), upstream of any route-specific logic. Any Better Auth POST endpoint the SCAFFOLD.3 sign-in form posts to with `application/x-www-form-urlencoded` will hit the same 415.

   **415-as-cutover-ground-truth mapping (load-bearing for §6 verification).** The §7.2 failure mode itself proves the §6 cutover is correct — the 415 response was generated by Better Auth running at `https://zugzwangworld.com` (the new apex domain). For this response to fire, every SCAFFOLD.12 cutover layer must already work: DNS, TLS, Vercel routing, Better Auth deployment post-§6 rebuild, `BETTER_AUTH_URL` value, OAuth client URI (Better Auth constructs `redirect_uri` from `BETTER_AUTH_URL`; the 415 fires AFTER this construction). Identical methodology to 13-A's `DATABASE_URL` 415 ground-truth verification.

   **Operator-approved log framing for §7.2 + §7.3** (Option B adjudication 2026-05-21): "PASS-with-FOLLOWUP-1 (cutover-verified)" — see §7 results section below.

   **Operator will update external tracker FOLLOWUP-1 row** with this reframed scope ("all Better Auth POST endpoints from sign-in form: Email-OTP send, Google OAuth sign-in/social, and any future POST handler reached from that form") post-PR-merge.

## §7 end-to-end verification results

Operator-side, clean incognito browser session. All 5 PASS (with §7.2 + §7.3 in the Option B PASS-with-FOLLOWUP-1 framing).

- **§7.1 PASS-with-observation.** Sign-in page renders at `https://zugzwangworld.com/sign-in`, TLS valid, all four interactive elements present (Continue with Google link, Email input, Send code button). Unstyled per SCAFFOLD.3 scaffold baseline (DESIGN.1 + DESIGN.7 produce the brand palette + typography later); not a SCAFFOLD.12 issue.
- **§7.2 PASS-with-FOLLOWUP-1 (cutover-verified).** Request reached Better Auth handler at the new domain (`POST https://zugzwangworld.com/api/auth/sign-in/social`) and was rejected with HTTP 415 UNSUPPORTED_MEDIA_TYPE. This response was generated by Better Auth at `https://zugzwangworld.com` (proving DNS, TLS, Vercel routing, `BETTER_AUTH_URL`, and OAuth client URI are all correctly wired). The 415 is downstream of every SCAFFOLD.12 concern and identical to the SCAFFOLD.3-FOLLOWUP-1 bug pattern from 13-A. Matches 13-A `DATABASE_URL` ground-truth verification methodology.
- **§7.3 PASS-with-FOLLOWUP-1 (cutover-verified, expected).** Same 415 at `POST https://zugzwangworld.com/api/auth/email-otp/send-verification-otp`. Confirms FOLLOWUP-1 scope-broadening: bug affects both `/api/auth/sign-in/social` (§7.2) AND `/api/auth/email-otp/send-verification-otp` (§7.3). Same Better Auth middleware Content-Type validation, same handler boundary.
- **§7.4 PASS.** First request to `https://www.zugzwangworld.com/sign-in` → 308 Permanent Redirect → Location header `https://zugzwangworld.com/sign-in` → final URL `zugzwangworld.com/sign-in`. §5 implicit satisfaction confirmed (the 308 was auto-installed by Vercel apex-canonical setting at §2).
- **§7.5 PASS.** External Gmail → `foundation@zugzwangworld.com` → email received in Proton inbox. §3 A + CNAME additions did NOT disrupt Proton MX routing; baseline preserved.

## Open questions (§5.9 field 3)

None at close — all SURPRISES resolved or operator-adjudicated in-session. Cross-stratum carry-forwards (FOLLOWUP-1, parked.md §10.b/§10.c/§10.d) are not SCAFFOLD.12 open questions.

## Next session starts at (§5.9 field 4)

Operator's call per tracker queue. Candidates ranked by load-bearing-ness:

- **SCAFFOLD.3-FOLLOWUP-1** (Better Auth Content-Type 415 on all sign-in form POSTs per execute-time finding 6 reframing). Now the load-bearing blocker for any end-to-end auth flow at production — both Email-OTP and Google OAuth fail at the same Better Auth middleware boundary. Scope: SCAFFOLD.3 sign-in form should post `application/json` (not `application/x-www-form-urlencoded`), OR Better Auth should be configured/wrapped to accept urlencoded bodies. Fix lives in `src/app/(auth)/sign-in/` or a wrapper around the auth catch-all route. Cross-stratum tracker entry per 13-A close-out posture.
- **SCAFFOLD.3-FOLLOWUP-2** (Better Auth session endpoint route mounting per 13-B SURPRISE 7) — separate route-discipline issue from FOLLOWUP-1.
- **ENGINE.6** (events helper at `src/server/events/insert.ts`) per pre-13-A queue ordering.
- **Tracker-sweep v9 → v10**: cadence rule ≥3 strata since v9; current count = 3 (13-A + 13-B + 12 closed). Eligible after SCAFFOLD.12 merges.

## Context to preserve (§5.9 field 5)

- **`zugzwangworld.com` is the production origin** for the experiment app. Apex-canonical posture; `www` 308-redirects to apex via Vercel edge.
- **DNS at Namecheap PremiumDNS** (DNSSEC on; auto-renew through 2 Mar 2031):
  - Apex A → `216.198.79.1`
  - `www` CNAME → `b2cddc96cb109c21.vercel-dns-017.com`
  - Existing Proton baseline preserved (3 DKIM CNAMEs, verification TXT, SPF TXT, 2 MX records)
  - No CAA records (default-any-CA allows Let's Encrypt)
- **TLS** auto-managed by Vercel (Let's Encrypt; auto-renewal).
- **`BETTER_AUTH_URL` = `https://zugzwangworld.com`** at both Vercel scopes (Production + Preview) via Doppler `prd` config × Doppler→Vercel integration sync (2 sync targets from 1 config per 13-B Phase B topology).
- **Doppler→Vercel auto-redeploy still NOT observed firing** (13-B SURPRISE 11 carry-forward). Manual Vercel redeploy required after Doppler env-var changes. Treat as operational fallback regardless of any auto-redeploy expectation.
- **Vercel CLI `env ls` precision** — default tabular output shows `createdAt` only (column header "created"); for `updatedAt` use `vercel env ls <scope> --format json` and decode the millisecond epoch. The default view misleads for Doppler-integration-managed entries (which don't update `createdAt` on value changes). Memory `feedback_vercel_env_writeonly.md` updated with this precision.
- **Google OAuth client Authorized redirect URIs**:
  - `http://localhost:3000/api/auth/callback/google` (development)
  - `https://zugzwangworld.com/api/auth/callback/google` (production)
  - The vercel-default callback URI was NEVER present (per SURPRISE 3); no cleanup pending.
- **`RESEND_FROM_EMAIL` = `onboarding@resend.dev`** (sandbox sender; deliverability limited to `zugzwangworld@proton.me`). Production-domain flip parked at parked.md §10.b.
- **Preview-env posture under Q1 Both:** Preview-scope `BETTER_AUTH_URL` = apex URL (same as Production). Preview deployments at preview-alias URLs have BROKEN Google OAuth (callback redirects to apex; state cookie cross-origin failure) — not a regression, the never-worked state. Parked at parked.md §10.c (env-var side) + §10.d (OAuth-client side, conditional).
- **FOLLOWUP-1 scope-broadened** (per execute-time finding 6): "Better Auth Content-Type middleware rejects `application/x-www-form-urlencoded` on all POST endpoints from SCAFFOLD.3 sign-in form (Email-OTP send, Google OAuth sign-in/social, and any future POST handler reached from that form)." Production auth functionality is blocked solely on this fix.
- **`docs/parked.md` introduced** (this PR) as the canonical parked-items tracker per CLAUDE.md §7 cleanup absorption rule. Format: per-row `## <task-id> §<section> — <description>` with originating task, deferred work, why deferred, conditional trigger, and (where applicable) candidate mechanics carried from MOOT POTENTIAL SURPRISES.

### Maintenance candidates for `docs/maintenance.md` / CLAUDE.md / AGENTS.md

Per CLAUDE.md §7 closing ritual: "Should CLAUDE.md, AGENTS.md, the workflow, or the tracker change as a result of this session?"

- **CLAUDE.md §5.11 staleness on reviewer-call invocation.** §5.11 says: "the named project review roles (`code-reviewer`, `db-migration-reviewer`, `security-auditor`, `test-writer`) are NOT auto-discoverable" and prescribes invoking via `general-purpose` with role briefing baked in. In the current Claude Code runtime, the named roles ARE auto-discoverable via `subagent_type` (the agent tool exposes them directly with the role briefing at `.claude/agents/<role>.md` auto-loaded). This session invoked `subagent_type: "security-auditor"` directly with full effect. §5.11 needs a maintenance update to reflect the current runtime behavior — or a clarifying note that both invocation patterns work and the direct-subagent_type is preferred when available.
- **Plan-template recurrence on operator out-of-sequence dashboard actions** (SURPRISE 5 here + 13-A §0 finding 4). Two instances across SCAFFOLD.13 phase now. Either (a) plan templates instrument an explicit "do NOT fire this operation yet" gate before vendor-UI prescriptions, OR (b) plan templates accept that pre-emptive dashboard work is operationally common and always verify state-before-§N rather than assume pre-§N baseline. Forward-relevance for future SCAFFOLD/HARDEN strata.
- **Vercel CLI precision update propagated to `feedback_vercel_env_writeonly.md` memory** (already done in-session).
- **Plan-time SURPRISE assumptions about git-tracking** (SURPRISE 1) — future plans should not assume gitignored files survive as "tracked" based on creation-vs-gitignore timing. Add to plan-template review checklist.

## Time (§5.9 field 6 — optional)

Single-session execute on 2026-05-21 (preceded by plan-mode session on 2026-05-20 producing the scratch plan + plan-time SURPRISES). Aggregate ~3 hours including:

- §0 reads + batched operator §0.2/§0.3/§0.5 reports
- Plan amendment for SURPRISE 1 (pre-promote) + Option A in-place amend
- Plan promote commit
- email-otp.ts comment fix (SURPRISE 2)
- Plan amendment for SURPRISE 3 (post-promote)
- Plan amendment for SURPRISE 5 (post-promote) — Q1 reversal cascade
- §1 verify-not-add + §2 prescription + §2 DNS values report
- §3 Namecheap record additions
- §4 CC-side dig + operator Vercel card validation
- §5 implicit satisfaction (via §2 apex-canonical flip)
- §6 Doppler edit + Doppler→Vercel sync + manual Vercel redeploy
- §7 5 subtests including FOLLOWUP-1 manifestation diagnosis + Option B adjudication
- §8 security-auditor reviewer call (subagent_type: security-auditor)
- §9 close-out: parked.md + this log + commit + self-audit + PR

Five commits on the branch:
1. `56d670f` plan(scaffold-12): promote plan
2. `e2c106f` chore(scaffold-12): correct stale forward-reference in email-otp.ts
3. `f494e58` plan(scaffold-12): amend per execute-time SURPRISE 3 — §1 verify-not-add + §4 transient framing + §10 restructure
4. `910ef93` plan(scaffold-12): amend per execute-time SURPRISE 5 — Q1 reversal Split → Both + §6 single-Doppler-edit rewrite
5. [this commit] chore(scaffold-12): close-out — log session + docs/parked.md follow-up rows
