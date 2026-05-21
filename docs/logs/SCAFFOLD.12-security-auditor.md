# SCAFFOLD.12 — security-auditor verdict (verbatim, durable audit trail)

Preserved per CLAUDE.md §5.10 + §5.11 + operator decision (2026-05-21) as
the durable §8 reviewer-call audit trail for the SCAFFOLD.12 domain +
DNS cutover PR.

**Invocation context:**
- Reviewer-call mechanic: `Agent` tool with `subagent_type: "security-auditor"`
  (the role briefing at `.claude/agents/security-auditor.md` is
  auto-discovered by the Claude Code runtime and auto-loaded into
  the agent's context)
- Branch at invocation time: `feat/scaffold-12-domain-cutover` at commit
  `910ef93` (4 commits ahead of `main`; before the `34b00b6` close-out
  commit that added `docs/parked.md` + this file's sibling `SCAFFOLD.12.md`
  session log — see the SURPRISE finding below)
- Plan path passed to agent: `@docs/plans/SCAFFOLD.12.md`
- Tool scope constrained to: Read, Grep, Glob, Bash (per role briefing
  + reinforced in invocation prompt)
- Date: 2026-05-21

The verdict text below is reproduced verbatim from the agent's response.
Section headings preserved; only blockquote markers added to distinguish
agent output from this file's framing.

---

> # security-auditor verdict — SCAFFOLD.12 domain + DNS cutover
>
> ## Scope of review
>
> Branch `feat/scaffold-12-domain-cutover` (4 commits ahead of `main` at `2fb9091`). Diff vs main: 2 files changed — `docs/plans/SCAFFOLD.12.md` (new, 765 lines) and `src/server/auth/email-otp.ts` (4 lines, comment-only, commit `e2c106f`). No behavior change in `src/`. Vendor-state changes audited per plan §8 / §7 results.
>
> I read CLAUDE.md (invariants, refusals, critical paths), AGENTS.md §10 (boundaries), the full SCAFFOLD.12 plan including all 5 execute-time SURPRISES, the SCAFFOLD.13-A + 13-B logs for FOLLOWUP-1 context + Doppler topology, and every `src/server/auth/**` file plus `proxy.ts`, `next.config.ts`, `.env.example`, `.gitignore`, `.vercel/repo.json`, and the Better Auth origin-check + cookie internals.
>
> ---
>
> ## CRITICAL (exploitable, ships catastrophic state)
>
> (none)
>
> ## HIGH (exploitable, significant damage)
>
> (none)
>
> ## MEDIUM (exploitable, but bounded damage)
>
> (none)
>
> ## LOW (defense-in-depth gap, not directly exploitable)
>
> (none)
>
> ## SURPRISE
>
> - **[Plan-stated artifact missing from branch] `docs/parked.md` does not exist** — `/Users/hrishikesh/code/zugzwang/experiment/docs/parked.md` is absent on this branch. Verified via `test -f` (fails), `find -name parked.md` (no result), and `git ls-files | grep parked` (no result).
>
>   Two referrers in this PR assume it exists:
>
>   - `/Users/hrishikesh/code/zugzwang/experiment/src/server/auth/email-otp.ts:6-7` (the only `src/` change in this PR) now reads "tracked in docs/parked.md under the Resend `RESEND_FROM_EMAIL` flip follow-up". That comment was rewritten by commit `e2c106f` to replace the previous SCAFFOLD.12 forward-reference (the supposed SURPRISE 2 fix) — but the file it now points to does not exist on this branch. Net result: SURPRISE 2's "fix" replaced one stale forward-reference with another stale forward-reference of identical shape (referent doesn't exist yet at the moment the commit lands).
>   - `docs/plans/SCAFFOLD.12.md:631` ("These rows (b / c / d) in `docs/parked.md` ship in this PR") + plan §11 exit-criteria checklist item "`docs/parked.md` rows for §10 added".
>
>   Also missing: `docs/logs/SCAFFOLD.12.md` (CLAUDE.md §5.9 + plan §12 — the session log that must commit before PR opens). Confirmed absent via `ls docs/logs/`.
>
>   **Security relevance:** none directly — this is a documentation-completeness gap, not an exploitable bug. Surfaced as SURPRISE rather than FAIL/LOW because (a) it's outside the audit-scope items the kickoff named (auth flow / DNS / TLS / secrets / Preview posture / invariants), and (b) the security-auditor role briefing instructs SURPRISE rather than scope-expansion for items outside the plan's stated scope. The plan itself flags these as items to ship in the PR — so this is most likely a "PR-not-yet-finished" pre-PR state rather than a real plan violation; CC should ship `docs/logs/SCAFFOLD.12.md` and `docs/parked.md` (with the §10.b / §10.c / §10.d rows) before `gh pr create`, which is the plan's existing §11 + §12 exit-criteria gates.
>
>   **No security-auditor action required** — the existing §9.1 pre-PR self-audit + §11 exit-criteria checklist will catch this in CC's session. Surfacing here per role-briefing requirement to flag unexpected findings.
>
> ---
>
> ## SAFE (verified)
>
> ### Diff-scoped (the only `src/` change in this PR)
>
> - **`src/server/auth/email-otp.ts:5-9` comment edit** — verified line-by-line in `git show e2c106f`. The diff is exclusively comment text; no symbol added, removed, or renamed; no control flow change; `sendVerificationOTP` callback body identical pre/post. The runtime sender remains `process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"` (line 24), unchanged. Sandbox-mode caveat (Resend `onboarding@resend.dev` only delivers to `zugzwangworld@proton.me`) survives correctly. No exploitable surface affected by this commit. The only finding here is the SURPRISE above (stale referent), which is non-security.
>
> ### Vendor-state changes (per §7 verification reports — accepted as ground truth per the security-auditor's read-only tool scope)
>
> - **OAuth client redirect URI list final state** — per §0.3 baseline + §1 verify-not-add (execute-time SURPRISE 3): `[http://localhost:3000/api/auth/callback/google, https://zugzwangworld.com/api/auth/callback/google]`. No legacy vercel-default callback URI present (never was per SURPRISE 3). No wildcard URIs, no extra/orphaned URIs. Localhost callback is the standard dev-environment requirement; not a production attack surface (Google requires HTTPS for non-localhost authorized redirects, so localhost cannot be substituted for the production callback by a public-internet attacker). `mapProfileToUser` (src/server/auth/index.ts:226-244) still enforces `email_verified === true` at the profile-mapper boundary; rejects on `oauth_email_not_verified`. No `prompt`/`access_type` flags exposed in client-side code. `scope` is `["openid", "email", "profile"]` — no `offline_access` (no refresh-token request), so the `accounts.refresh_token` column (db/schema/auth.ts:110) stays NULL in practice for this scope set.
>
> - **DNS configuration at Namecheap** — A + CNAME additions only; existing Proton baseline (3 DKIM CNAMEs, 1 verification TXT, 1 SPF TXT, 2 MX) untouched per §7.5 PASS (external→Proton delivery still works). No CAA records added but none existed at §0.5 baseline, so default-any-CA posture is unchanged from pre-cutover. DNSSEC still on (operator never changed nameservers, plan-stated "do NOT change nameservers"). A record points at project-specific Vercel IPv4 (`216.198.79.1`), not the older generic Hobby/Pro `76.76.21.21` — matches Vercel's project-specific provisioning. CNAME target is project-specific `b2cddc96cb109c21.vercel-dns-017.com`, not the older generic `cname.vercel-dns.com`. Subdomain takeover risk for the apex+www: not exploitable because both records point at Vercel-managed targets where the project is also configured; an attacker cannot claim the same Vercel target without first compromising the Vercel project itself (out of threat model per SPEC.2 §18 — admin/insider attack).
>
> - **TLS posture** — Let's Encrypt auto-issued on apex + www per §4 PASS. No custom cert, no operator-supplied private-key handling, no certbot challenge stored anywhere reviewer can inspect. Vercel-managed lifecycle (auto-renewal). HSTS is not explicitly set anywhere I can find in this repo (`next.config.ts` has no headers config); this is consistent with pre-cutover posture and out-of-scope for SCAFFOLD.12, but noted as forward-relevance for any later "HARDEN-headers" task.
>
> - **`BETTER_AUTH_URL` flip at Doppler `prd`** — single edit, both Vercel scopes (Production + Preview) sync via Doppler→Vercel integration per §6 + Q1 Both. Both scopes confirmed via `vercel env ls <scope> --format json` with `updatedAt: 2026-05-21T11:29:09 UTC` / `11:29:08 UTC`; values write-only post-set (per `feedback_vercel_env_writeonly.md`), with functional correctness proved by §7.2's "415 from Better Auth at new domain" ground-truth. New Production deployment `37d6749U6` Ready post-§6. Better Auth derives `trustedOrigins` from `baseURL = process.env.BETTER_AUTH_URL` (verified in `node_modules/better-auth/dist/context/helpers.mjs:73`), so post-cutover `https://zugzwangworld.com` is the only static trusted origin — the legacy vercel-default deploy alias is no longer in the trusted list. Preview-deploy OAuth at preview-alias URLs remains broken (cross-origin cookie transfer; tracked at §10.c + §10.d), but this is the documented "no working preview OAuth to protect" state per SURPRISE 5 — not a regression introduced by this PR. There is no Preview-scope override route an attacker can exploit because no Preview deployment is exposed beyond Vercel's per-deploy alias URLs (no DNS pointed at Preview).
>
> - **Secret material handling during cutover** — `.gitignore` line 60 `.vercel` matches `.vercel/repo.json` (verified via `git check-ignore -v` — output `.gitignore:60:.vercel	.../.vercel/repo.json`). `.env*` files all gitignored per `.gitignore:20-26` (the negation `!.env.example` is correct and `.env.example` carries only key names, no values — verified via Read). No secret material committed in any of the 4 PR commits per `git log` + `git show` inspection. No screenshots in repo. Documentation of cutover correctly redacts secret values (e.g., plan §6 reads "**Vercel env values are write-only post-set**" rather than displaying values). `BETTER_AUTH_URL` is a URL, not a credential — its value is intentionally public (it's literally the user-facing domain), so its disclosure in logs / commit messages is not a secrecy concern. SURPRISE 5's "operator out-of-sequence Doppler edit + revert + manual recovery" did NOT result in secret leakage — only `BETTER_AUTH_URL` was touched, and `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, `ADMIN_PASSWORD`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_TOKEN` were untouched (verified by reading commit history + plan execute-time amendments).
>
> - **No hard-coded URL leaks** — `grep -RIn experiment-zugzwang-worlds-projects --include="*.ts" --include="*.tsx" src/ tests/` returns zero matches; `grep -RIn zugzwangworld --include="*.ts" --include="*.tsx" src/` returns only the single email-otp.ts comment line (the `zugzwangworld@proton.me` Resend sandbox recipient, which is correct usage). No source code path can be exploited to send requests to the old URL — Better Auth reads `BETTER_AUTH_URL` at init only, and the only env-var consumer references are at src/server/auth/index.ts:42 (existence check), :43 (error message), :188 (`baseURL` assignment). No fallback constant, no hardcoded host header, no environment-name-keyed branch logic.
>
> ### Auth flow exploitability (per role briefing)
>
> - **Session creation deferral hook (INV-3 construction-layer protection per SPEC.2 §8.3)** — `src/server/auth/session-gate.ts:28-49` + wired at `src/server/auth/index.ts:281`. Reads `users.pseudonym` + `users.tos_accepted_at`; throws `APIError("FORBIDDEN", { message: "ONBOARDING_REQUIRED", onboardingRef })` if either is NULL. The catch-all route at `src/app/api/auth/[...all]/route.ts:21-63` lifts `onboardingRef` from the response body and emits the signed cookie + 302 redirect. The signing is HMAC-SHA256 with `BETTER_AUTH_SECRET` (src/server/auth/onboarding-ref.ts:25-38); verification uses `timingSafeEqual` on equal-length buffers with explicit length check (src/server/auth/onboarding-ref.ts:55-56). Cookie attributes `HttpOnly+Secure+SameSite=Lax+Path=/onboarding+Max-Age=600` (src/app/api/auth/[...all]/route.ts:47-54). The new apex domain does not weaken this — cookies are host-only (no `Domain=` attribute → bound to apex only; never sent to subdomains, never received from non-apex requests). Cutover does not introduce any new session-creation path. Attempted attack: forge `onboarding_ref` cookie — fails on HMAC check; replay expired token — fails on `payload.exp < now()` check; cross-origin paste — `SameSite=Lax` + `HttpOnly` prevent JS read and limit cross-site posting. Not exploitable.
>
> - **Admin auth bypass / structural separation (§8.7 pillar 1)** — `users` table has no `role`/`is_admin` column (verified at `src/db/schema/auth.ts:31-69`). Admin auth is hand-rolled static-password (ADR-0010) via `src/server/auth/admin/login.ts`. Admin cookie name is `zugzwang_admin_session` (Path=/admin); participant cookie is `zugzwang_session`. `validateAdminSession` reads ONLY the admin cookie (`src/server/auth/admin/validate.ts:18,29-30`) — per §8.7 pillar 6, the participant cookie is never consulted by admin handlers, even if present. The domain cutover does not change cookie names, paths, or admin/participant routing. Cookie attributes for admin are `HttpOnly+Secure+SameSite=Lax+Path=/admin` (login.ts:173-178). HMAC password comparison uses `timingSafeEqual` over 32-byte HMAC-SHA256 digests (login.ts:67-75), with same-arity digest construction on both sides to avoid the length-mismatch RangeError that would leak length. `proxy.ts` is documented as Layer 1 UX-only (CVE-2025-29927 bypass-aware); Layer 2 (`validateAdminSession`) is the security boundary. Not exploitable.
>
> - **Ban enforcement** — `users.banned_at` partial index exists (`src/db/schema/auth.ts:62-64`). No bet/comment write paths exist in this branch yet (SCAFFOLD.12 is doc-only + comment fix; no behavior change), so the ban-enforcement contract per §8.6 ("ban-is-request-time-not-logout") is not testable against new code in this PR. Pre-existing surfaces are out-of-scope per the cutover plan. Not a SCAFFOLD.12 regression risk.
>
> - **OAuth token handling** — `accounts.access_token` / `refresh_token` columns are NULL-able text (src/db/schema/auth.ts:109-110). The Google scope set `["openid", "email", "profile"]` (src/server/auth/index.ts:221) does not request `offline_access`, so refresh tokens are not minted in practice — the column stays NULL. No client-side exposure: scope is server-only in `auth/index.ts`; sign-in form uses Better Auth's catch-all `/api/auth/sign-in/social` which builds the OAuth URL server-side. No token-leakage path opened by the domain cutover. Not exploitable.
>
> - **OTP rate-limit** — `src/server/auth/index.ts:112-165` (the `zugzwang-otp-gate` plugin) gates `/email-otp/send-verification-otp` with Turnstile siteverify (fail-CLOSED, lines 76-102) + per-email + per-IP-burst sliding-window rate limits (otpRequestPerEmail @ 5/hr, otpRequestPerIpBurst @ 10/min — `src/server/config/limits.ts:14,17`). Per-email check fires before per-IP burst per SPEC.2 §11 ordering (lines 137-156). On Turnstile/rate-limit failure, `APIError("BAD_REQUEST" | "TOO_MANY_REQUESTS", …)`. Turnstile token validation is a real HTTP `POST` to `challenges.cloudflare.com` (line 84-91), fail-closed on missing secret / non-200 / exception. Domain cutover does not affect these limits — identifier extraction uses bare email or IP, not host header. Not exploitable.
>
> - **Session invalidation on ban** — out of scope for SCAFFOLD.12 (no bet/comment paths touched; ban enforcement is downstream). No regression introduced.
>
> ### Moderation pipeline + transaction handler exploitability
>
> - **Moderation / CSAM / pre-commit ordering** — no moderation code exists in this branch yet (the `src/server/moderation/` path is empty per the `find -type f` enumeration above — only `auth/`, `idempotency/`, `identity-pool/`, `middleware/`, `config/`, `upstash/` modules exist). SCAFFOLD.12 does not touch any moderation surface. Per role briefing, "if a finding requires admin compromise to exploit, downgrade severity by one level" — and per scope, this isn't a moderation-touching PR. No regression risk.
>
> - **Transaction handler / lock ordering / HTTP-in-transaction** — no bet/comment/dharma/resolution transactional code in this branch. The pre-existing `acceptTosAction` (src/server/auth/tos-accept.ts:92-121) uses `db.transaction` with explicit `SELECT FOR UPDATE` and no HTTP inside the transaction (verified line-by-line). The pre-existing `adminLoginAction` (src/server/auth/admin/login.ts:90-101) uses `db.transaction` with `isolationLevel: "serializable"` and the retry-once-on-40001 pattern, no HTTP inside. The pre-existing `consumeIdentityPoolTuple` (src/server/identity-pool/consume.ts:26-53) uses `db.transaction` with `SELECT FOR UPDATE SKIP LOCKED`, no HTTP inside. SCAFFOLD.12 does not touch any of these. The `verifyTurnstile` HTTP call (src/server/auth/index.ts:84-91) is the only HTTP call in `src/server/auth/`, and it runs OUTSIDE any `db.transaction` (it's in the `before` hook chain, before any DB write). Not exploitable.
>
> - **Floating-point drift / race conditions** — out of scope; no math or new race surface introduced.
>
> ### Invariant enforcement (the four hard locks)
>
> - **INV-1 (bet ↔ comment atomicity)** — no bet/comment code in this PR or in the branch generally yet. Plan explicitly notes "expect 'no diff in src/server/ relevant to invariants — invariants not touched in this task' verdict." Attempted attack: construct a flow from this PR's diff that creates a bet without a comment — impossible because no bet-creation handler exists yet. **Not touched, not weakened.**
>
> - **INV-2 (Dharma non-transferable, no overdraft)** — no dharma code in this PR or in the branch generally yet. No `dharma_transfer`-table-shaped artifact added. No admin-pool path introduced. Attempted attack: construct a path that writes a negative `balance_after` from this PR's diff — impossible because no ledger write path exists. **Not touched, not weakened.**
>
> - **INV-3 (side-bound at post-time)** — `comments.side_at_post_time` exists in schema but no comment write path exists yet. Session-deferral hook (per SPEC.2 §14 row 3 clause (i) construction-layer protection of INV-3) is unchanged by SCAFFOLD.12 — `createSessionGate` reads pseudonym + tosAcceptedAt only, no domain-specific branch. The domain cutover does not introduce a path that flips sides on an existing comment. Attempted attack: forge `onboarding_ref` cookie to bypass session-creation gate — fails on HMAC (timing-safe equal with explicit length check). **Not touched, not weakened.**
>
> - **INV-4 (resolutions append-only)** — no resolution code in this PR. Append-only triggers live at storage layer (Bucket A trigger per CLAUDE.md §2). The domain cutover does not run any DDL, does not touch `drizzle/migrations/`, does not touch triggers. **Not touched, not weakened.**
>
> ### Data exposure
>
> - **PII in logs** — `console.error("turnstile_unavailable", …)` (src/server/auth/index.ts:80,93,99) emits a string tag and the error object; no email or IP in the tag itself. `console.error("upstash_unavailable_rate_limit", err)` (src/server/middleware/rate-limit.ts:178) — no PII. `console.error("upstash_unavailable_idempotency", err)` (src/server/idempotency/cache.ts:78) — no PII. Better Auth's internal logging is configurable; not touched here. Not a SCAFFOLD.12 regression.
>
> - **PII in dataset / URL exposure / admin surfaces** — no dataset export code, no URL-exposure surface introduced by the cutover. No `robots.txt` or noindex tag in this PR. Pre-existing posture; not a SCAFFOLD.12 regression. Note as forward-relevance: a `robots.txt` disallow of `/admin/` is not yet present in this codebase (verified via `find public/ -name robots*` — no result), but per role briefing's threat model + boundary rule, this is "outside the plan's stated scope" — surface for a separate task, not for SCAFFOLD.12.
>
> ### Conclusion-freeze enforcement
>
> - Not relevant to a domain cutover. No `system_state.frozen_at` bypass introduced. Not touched.
>
> ### Cross-stratum carry-forward
>
> - **FOLLOWUP-1 (Better Auth Content-Type 415 on all sign-in form POSTs)** — confirmed via §7.2 + §7.3 PASS-with-FOLLOWUP-1 reports. This is **not a SCAFFOLD.12 regression**; the 415 is generated by Better Auth at the new domain (proving DNS/TLS/Vercel-routing/`BETTER_AUTH_URL`/OAuth-client-URI are all correctly wired, identical 415-as-ground-truth methodology to 13-A `DATABASE_URL`). The underlying bug is the SCAFFOLD.3 sign-in form POSTing `application/x-www-form-urlencoded` to a Better Auth endpoint that expects `application/json`. Operator will update external tracker FOLLOWUP-1 row with the scope-reframed-from-Email-OTP-only-to-all-Better-Auth-POSTs finding post-PR-merge. Surface as **carry-forward**, not as SCAFFOLD.12 fail.
>
> ---
>
> ## Verdict
>
> **PASS.**
>
> No CRITICAL / HIGH / MEDIUM / LOW exploitable findings against the SCAFFOLD.12 scope. One SURPRISE flagged (`docs/parked.md` + `docs/logs/SCAFFOLD.12.md` not yet present on the branch — non-security; will be caught by the plan's existing §9.1 self-audit + §11 exit-criteria gates before `gh pr create`). The single `src/` change is comment-only with no behavior delta, and the vendor-state cutover preserves every relevant security property: Better Auth `trustedOrigins` correctly derives from the new `baseURL = https://zugzwangworld.com` only (legacy vercel-default URL no longer trusted); cookies remain host-only HttpOnly+Secure+SameSite=Lax with path scoping; OAuth scope set is unchanged and does not request refresh tokens; secret material was not exposed during the cutover (only `BETTER_AUTH_URL`, a public value, was modified); the four invariants are not touched by this PR.
>
> The FOLLOWUP-1 415 is a documented carry-forward from SCAFFOLD.3, not a SCAFFOLD.12 regression — the 415 is positive evidence that the cutover landed correctly at the auth-handler boundary.
>
> **§8 gate clears.**

---

## Post-audit reconciliation

The single SURPRISE finding (parked.md + log not present on branch at audit time) was resolved by close-out commit `34b00b6` (creates `docs/parked.md` with §10.b/§10.c/§10.d follow-up rows + `docs/logs/SCAFFOLD.12.md` session log). The auditor explicitly noted this would be caught by §9.1 + §11 exit-criteria gates; that resolution path was executed as predicted.

No other findings require operator-action audit trail per CLAUDE.md §5.10 "operator-authority HIGH-finding closure" — no HIGH findings present.

This file ships in the same PR (SCAFFOLD.12) and is referenced from the PR description Section 5 as the durable audit trail.
