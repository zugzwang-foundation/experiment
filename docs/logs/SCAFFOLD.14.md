# SCAFFOLD.14 — Auth vendor env wiring

**Status:** Closed 2026-05-14
**Branch:** `feat/scaffold-14` (merged + auto-deleted)
**PR:** [#35](https://github.com/zugzwang-foundation/experiment/pull/35) — merged 2026-05-14T17:25:11Z, squashed to `main` as `774aad4`
**Predecessor:** SCAFFOLD.1 (`61157a9`)
**Unblocks:** SCAFFOLD.3 (Better Auth wiring)

---

## Scope delivered

Three vendor accounts provisioned (Google Cloud OAuth, Resend, Cloudflare Turnstile), one Vercel project imported, and 9 env vars wired across two surfaces (`.env.local` + Vercel Production+Preview scopes). `.env.example` committed at `+26 lines / 9 placeholder keys` under 5 labeled sections (Google OAuth / Resend / Cloudflare Turnstile / Better Auth / Admin auth).

Final env-var inventory:

| # | Key | Source | Scope |
|---|---|---|---|
| 1 | `GOOGLE_CLIENT_ID` | Google Cloud Console | Vendor |
| 2 | `GOOGLE_CLIENT_SECRET` | Google Cloud Console | Vendor |
| 3 | `RESEND_API_KEY` | Resend dashboard | Vendor |
| 4 | `RESEND_FROM_EMAIL` | Constant: `onboarding@resend.dev` (sandbox sender; flips to verified-domain sender at SCAFFOLD.12) | Local |
| 5 | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile | Vendor |
| 6 | `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile | Vendor |
| 7 | `BETTER_AUTH_SECRET` | `openssl rand -hex 32`, 64 hex chars | Local |
| 8 | `BETTER_AUTH_URL` | Local: `http://localhost:3000`; Vercel: `https://zugzwangworld.com` | Local |
| 9 | `ADMIN_PASSWORD` | `openssl rand -hex 32`, 64 hex chars per ADR-0010 | Local |

Five vendor + four local/generated. Original kickoff doc specified 5; expansion to 9 ratified mid-task (see Findings #1).

---

## Findings

### Scope

1. **Env-var count expanded 5 → 9 mid-task, user-ratified.** Kickoff doc named 5 (Google×2, Resend×1, Turnstile×2). Web Claude surfaced 4 additions at scope-framing: `BETTER_AUTH_SECRET` (Better Auth library hard-requires session-cookie signing key, refuses to boot without), `BETTER_AUTH_URL` (OAuth callback base URL, per-environment), `RESEND_FROM_EMAIL` (sender address; constant per env, not vendor-issued), `ADMIN_PASSWORD` (ADR-0010 static-password admin auth). All four are local-generation or constants — no new vendor dashboards. Absorbed as scope refinement, not creep; the kickoff exit criterion "every credential SCAFFOLD.3 needs" required them.

2. **`TURNSTILE_SITE_KEY` → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` rename, CC-initiated.** Next.js framework constraint: client-bundle reads `process.env.X` only when `X` is prefixed `NEXT_PUBLIC_`. Turnstile widget renders client-side per §8.2 + ADR-0004, so the site key has to cross the bundle boundary. Site-key is public per Cloudflare's docs (designed to be visible in HTML source). The `_SECRET_KEY` stays unprefixed — server-only siteverify call. CC's variance flagged at PR review, web Claude approved. AGENTS.md §1 amendment captured below (Process learnings #2).

3. **Vercel project import absorbed into SCAFFOLD.14, kickoff-doc gap.** Kickoff doc Step 12 read "update Vercel env vars" assuming a Vercel project already existed from SCAFFOLD.1. Vercel project did NOT exist; SCAFFOLD.1 scope had skipped it. Web Claude initially recommended deferring to a separate task; user pushed back ("why defer and not finish it") — reversed to absorb on grounds that Next.js project import is trivial-config (auto-detected preset, default root, no decisions) and finishing the auth-vendor loop end-to-end is the natural SCAFFOLD.14 exit. ~5 min of clicks. Vercel project `experiment` under team `zugzwang-world's projects` (Hobby), framework auto-detected as Next.js, root `./`, env vars seeded at import via paste-block (not file-import — `.env.local` is a dotfile and macOS Finder hid it from the file picker).

4. **First Vercel deploy succeeded green.** SCAFFOLD.1 had shipped a placeholder landing page (not the empty scaffold web Claude assumed). Deploy at `experiment-*.vercel.app` rendered "Zugzwang — The world's reputation market — Coming soon" with `build 774aad4` footer matching the SCAFFOLD.14 merge SHA. Custom domain attach deferred to SCAFFOLD.12.

### Workflow

5. **Sequencing failure: web Claude variance-rejection arrived after merge.** PR #35 was reviewed by web Claude; two variances surfaced. Variance 1 (NEXT_PUBLIC_ prefix, above) approved. Variance 2 — `BETTER_AUTH_SECRET` and `ADMIN_PASSWORD` had been written as 128 hex chars (CC framed as "concatenated to 128-char values, strictly more entropy") — rejected by web Claude on grounds that ADR-0010 specifies 32 bytes / 64 hex chars and the variance wasn't approved. User merged the PR before relaying the rejection to CC. Amend became mechanically impossible post-merge (branch auto-deleted, squash-commit lives on `main`, force-rewriting `main` is out of scope). Resolved via Option 1 (document the inaccuracy in this log, truncate `.env.local` locally to 64 chars, sync password manager). Code state is now correct; the merged commit body on `774aad4` carries a narrative inaccuracy that's preserved in git history as a teaching artifact, not retro-corrected.

6. **Path forward selection: option 1 (document) over option 2 (corrigendum PR) and option 3 (revert + redo).** Web Claude's recommendation: when commit message and code disagree, fix the cheaper of the two. Code was correct; only the message body was wrong. Corrigendum PR would have added a second commit on `main` whose sole purpose is "the previous commit body had one inaccurate line" — pollutes history more than the inaccuracy itself. Revert + redo would have created three commits where one would do. Bar for rewriting `main` history is high for code-correctness reasons; not high for narrative-correction reasons.

7. **CC squash-merge state divergence handled cleanly twice.** At branch creation: CC verified `local main 24a4206` was tree-identical to `origin/main 61157a9` (squash-merge SHA mismatch from SCAFFOLD.1 close), branched directly from `origin/main` rather than running `git pull --ff-only`. Post-merge: same divergence reappeared (`24a4206` local, `774aad4` origin); resolved via `git reset --hard origin/main` after web Claude verified untracked-only changes via `git status` + `git diff main origin/main --stat`. Untracked `docs/logs/SCAFFOLD.14.md` (this file, pre-commit) survived the reset. SCAFFOLD.1 precedent re-confirmed: squash-merge auto-delete leaves local in a tree-identical-but-SHA-divergent state; reset is the right resolution, not rebase.

### Operational

8. **Resend in sandbox sender mode until SCAFFOLD.12.** `RESEND_FROM_EMAIL=onboarding@resend.dev` is Resend's shared sandbox sender. Limitation: only delivers to the email address registered with the Resend account (`zugzwangworld@proton.me`). SCAFFOLD.3 OTP testing is restricted to this single recipient until SCAFFOLD.12 lands DNS verification for `zugzwangworld.com` and the from-address flips to `noreply@zugzwangworld.com` (or similar). Known temporary state; flagged so SCAFFOLD.3 doesn't debug Resend "silent block" of unregistered recipients as a code bug.

9. **Google Cloud OAuth consent screen: Testing mode, External user type.** `External` was the user-type lock (Internal would restrict sign-in to a Google Workspace org, breaking F-AUTH-1 for arbitrary Gmail users). Initial selection was Internal-by-misclick; fixed before client-ID creation. Publishing status `Testing` (max 100 lifetime users, all on the test-users list). Switch to `In production` at launch is a single click, no Google verification required for our three non-sensitive scopes (`openid` + `userinfo.email` + `userinfo.profile`). Test users list seeded with `hrishixhrishi@gmail.com` (the account that owns the project). Support email is the same Gmail; ProtonMail addresses are not selectable by Google for this field. Foundation-Workspace switch-over deferred to incorporation phase.

10. **Cloudflare Turnstile: Managed mode, three hostnames.** Hostnames registered: `localhost` (covers all dev-port-3000 variants), `zugzwangworld.com` (apex production), `staging.zugzwangworld.com` (forward-looking for SCAFFOLD.8 staging). Managed widget mode per ADR-0004 / SPEC.1 §13 ("invisible for most users, falls back to a visible non-puzzle widget if signals are atypical"). Pre-clearance off. Cloudflare allows both keys to be re-viewed in dashboard any time (unlike Google/Resend one-shot reveal pattern).

11. **Vercel project name: `experiment`, matches GitHub repo.** Vercel auto-suggested `zugzwang-experiment` mid-flow (some prior namespace collision); manually renamed back to `experiment` to keep the deploy URL `experiment-*.vercel.app` aligned with `zugzwang-foundation/experiment` repo name. Env-var scope on import: "Production and Preview" (Vercel Hobby default). Custom domain attach deferred to SCAFFOLD.12.

12. **MAINT.1 carve-out — 8 stale local SCAFFOLD.2 branches.** CC's post-merge diagnostic flagged 8 dangling local branches (`feat/scaffold-2-stratum-{a,b,d}`, `chore/scaffold-2-*`, `chore/claude-md-*`) from prior SCAFFOLD.2 work. Remote counterparts auto-deleted on respective merges. Not in SCAFFOLD.14 scope. Defer to a separate `MAINT.1 — Local branch hygiene` row in tracker v8.

### Process learnings

13. **Web Claude rejection must reach CC before user clicks merge.** Step 9 of the kickoff doc's roles table needs amendment: "Hrishikesh + Web Claude review PR in GitHub UI; Web Claude signs off OR surfaces variances; user does NOT click merge until web Claude approval is explicit." The PR #35 sequencing failure (Finding #5) traces directly to this gap.

14. **AGENTS.md §1 amendment: client-readable env vars require `NEXT_PUBLIC_` prefix in Next.js.** Captured at variance-1 approval. Add to §1's env-var conventions on next AGENTS.md sweep. Operational guardrail, not ADR-shaped.

15. **AGENTS.md §10 amendment: do not deviate from documented secret lengths without explicit user approval.** Captured at variance-2 rejection. The 128-char/64-char incident was a unilateral CC decision; framing it as "strictly more entropy" missed the contract-consistency concern (Better Auth silently re-hashes keys longer than 64 bytes back down to 32 bytes via HMAC; the extra chars are cryptographic noise, not strength). Add: "ADR-specified secret lengths are exact, not minimums."

16. **AGENTS.md operational principle: narrative inaccuracies in merged commit messages are documented in task logs, not retro-corrected by force-push or revert.** Captured at path-forward selection. Bar for rewriting `main` history is high for code reasons, not narrative reasons. Worth documenting as a general principle so future similar incidents auto-resolve.

17. **Verify prerequisite infrastructure exists before kickoff doc finalization.** Kickoff doc assumed Vercel project existed from SCAFFOLD.1. It didn't. Surfacing this at kickoff (single CLI check or browser-tab open) would have given the chance to either widen SCAFFOLD.14 scope intentionally or surface a SCAFFOLD.1 gap pre-flight. Add to kickoff-doc-authoring checklist.

---

## Retractions (preserved for traceability)

- **"Vercel project absorbed = scope creep"** — wrong; web Claude initial recommendation (Option A — defer) was over-literal application of refusal-against-scope-creep. User pushback prompted reversal. The rule exists to prevent silently absorbing big undisclosed scope; 5 min of trivial-config import to complete the stated SCAFFOLD.14 mission isn't that. Updated rec: when a finish-the-loop absorption is well-bounded and the kickoff exit criterion implies it, absorb. Documented as a rule refinement, not just a one-off retraction.

- **"Better Auth's 128-char secret = strictly more entropy"** — wrong by CC; framing missed that Better Auth's HMAC-SHA256 use of the secret re-hashes inputs >64 bytes back to 32 bytes internally. Effective entropy is bounded by what the library actually does with the input, not by the input length. Web Claude rejection upheld.

---

## Open questions / non-blocking items

1. **Resend domain verification deferred to SCAFFOLD.12.** When SCAFFOLD.12 lands DNS for `zugzwangworld.com`, add it as a verified domain in Resend, then flip `RESEND_FROM_EMAIL` to `noreply@zugzwangworld.com` (or chosen sender) in both `.env.local` and Vercel env. ~30 sec env-var update.

2. **Google OAuth support-email Foundation switchover.** Currently `hrishixhrishi@gmail.com`. Switch to a Foundation-Workspace address (e.g. `foundation@zugzwangworld.com`) once Workspace exists. Foundation-incorporation-phase task.

3. **Google OAuth "Testing → In production" publish.** Click at launch (~Sep 15). Single click, no review.

4. **Vercel preview-deploy auth.** Preview URLs are dynamic (`experiment-git-feat-*.vercel.app`). Google OAuth Console disallows wildcards in redirect URIs; Cloudflare Turnstile binds to specific hostnames. SCAFFOLD.8 (staging environment) will provide a stable preview hostname; until then, preview deploys won't have working auth. Acceptable per SCAFFOLD.14 scope.

5. **MAINT.1 — Local branch hygiene.** Open as separate tracker row. 8 dangling local branches identified; ~5 min cleanup once scheduled.

6. **Vercel project: first build green but content is SCAFFOLD.1 placeholder.** SCAFFOLD.3 will replace the placeholder landing page with real auth surfaces. No action in SCAFFOLD.14.

---

## Single source of truth — files touched

| File | State | Notes |
|---|---|---|
| `.env.example` | Committed at `+26 lines / 9 placeholder keys / 5 labeled sections` | Only file in the merge diff |
| `.env.local` | Gitignored; populated locally with 9 real values; both 64-char secrets truncated post-merge to match ADR-0010 | Never committed; password manager re-synced post-truncation |
| Vercel env (Production + Preview) | 9 keys, paste-block seeded at project import | `BETTER_AUTH_URL=https://zugzwangworld.com` differs from `.env.local`'s `http://localhost:3000` |
| Google Cloud project `zugzwang-experiment` | OAuth consent screen + Client ID provisioned | Testing mode; External user type; 3 non-sensitive scopes |
| Resend workspace `zugzwangworld` | API key provisioned; no verified domain yet | Sandbox sender only |
| Cloudflare Turnstile widget `Zugzwang Experiment — Email OTP` | Site + Secret keys provisioned | 3 hostnames; Managed mode |
| `docs/logs/SCAFFOLD.14.md` | This file | Committed via post-merge branch + PR per AGENTS.md §10 |
