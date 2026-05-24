# SCAFFOLD.15 — operator-substrate clearance + execute review — chat close-out

> Operator-substrate clearance + execute-phase review chat close-out per
> CLAUDE.md §5.9. Companion to `docs/logs/SCAFFOLD.15.md` (CC's execute
> close-out at commit `2f57d52`).

- **Task:** SCAFFOLD.15 operator-substrate clearance + execute-phase review
- **Chat closed:** 2026-05-24
- **PR:** [#47](https://github.com/zugzwang-foundation/experiment/pull/47) (squashed to `main` as `660f193`)
- **Deployment:** Vercel auto-deploy on `main` — **Ready** (green)
- **Plan:** `docs/plans/SCAFFOLD.15.md` (committed `0040270` on `plan/scaffold-15`; amended same-commit during execute per plan §4)
- **Companion log:** `docs/logs/SCAFFOLD.15.md` (CC execute close-out, commit `2f57d52`)

---

## 1. Outcome

PR #47 merged to `main` and deployed to production via Vercel auto-deploy.
Operator-substrate cleared 9-of-9 with 3 SURPRISES absorbed same-commit by
CC. Live R2 round-trip probe ran GREEN against operator-managed substrate
post-merge, conclusively resolving SURPRISE-9 (secret-length uncertainty).

**Live R2 probe result:**

```
✓ tests/server/storage/_probe-r2-roundtrip.test.ts (1 test) 2547ms
  ✓ R2 live roundtrip probe (SCAFFOLD.15; gated) >
    r2-live::sign-put-and-headObject-roundtrip 2546ms

Test Files  1 passed (1)
     Tests  1 passed (1)
```

**`wrangler r2 bucket cors list zugzwang-uploads` output:**

```
allowed_origins:   https://zugzwangworld.com
allowed_methods:   PUT
allowed_headers:   content-type
exposed_headers:   ETag
max_age_seconds:   3600
```

ExposeHeaders + MaxAgeSeconds verified saved (the dashboard form-based UI
didn't surface them as columns at config time — a real concern flagged in
the CC kickoff that turned out to be a no-op).

**`wrangler r2 bucket lifecycle list zugzwang-uploads` output:**

```
name:    Default Multipart Abort Rule
enabled: Yes
prefix:  (all prefixes)
action:  Abort incomplete multipart uploads after 7 days

name:    delete-uploads-after-90d
enabled: Yes
prefix:  u/
action:  Expire objects after 90 days
```

Both rules present, both enabled, prefix `u/` correctly applied, 90d
window (per SURPRISE-7).

---

## 2. Operator-substrate clearance — all 9 items

| # | Item | State at close |
|---|---|---|
| 1 | R2 enabled on Cloudflare account `4ddce98b4a4cbc9146d4269f36b03f68` | ✓ Active, free tier headroom 10GB/1M/10M |
| 2 | `zugzwang-uploads` bucket | ✓ APAC location hint, Default jurisdiction, Standard, Public Disabled |
| 3 | `zugzwang-pfp` bucket | ✓ APAC location hint, Default jurisdiction, Standard, Public Dev URL enabled (substituted for custom domain — see SURPRISE-8) |
| 4 | CORS on `zugzwang-uploads` | ✓ `["content-type"]` literal headers, ExposeHeaders `["ETag"]`, MaxAge 3600 — wrangler-verified |
| 5 | Lifecycle on `zugzwang-uploads` | ✓ 7d multipart abort + 90d prefix `u/` delete (SURPRISE-7 deviation from plan 30d) — wrangler-verified |
| 6 | Custom Domain `cdn.zugzwangworld.com` | ⏭ DEFERRED to post-experiment (SURPRISE-8); R2 public dev URL `https://pub-90d8517586b84be98e9cb597350a3277.r2.dev` substituted |
| 7 | Two bucket-scoped R2 API tokens | ✓ `zugzwang-uploads-rw` + `zugzwang-pfp-rw`, both Account API Tokens, Object Read & Write only |
| 8 | 10 env vars in Doppler `zugzwang-experiment` / `prd` config | ✓ Synced to Vercel `Production` environment |
| 9 | Vercel Pro tier on `zugzwang-worlds-projects` team | ✓ Upgraded from Hobby; $20/seat/mo billable; cron cadence `0 */6 * * *` now deployable |

---

## 3. SURPRISES surfaced during operator-substrate clearance

All three carried forward to CC kickoff at chat-open and absorbed
same-commit by CC in PR #47.

### SURPRISE-7 (MEDIUM) — Lifecycle window 30d → 90d on `zugzwang-uploads` Rule A

**Discovery:** Operator caught it during prereq [5]. Plan §5.11 + research
brief §4 + LD/Q7 verdict locked 30d, but experiment window is Sep 15 → Nov 5
(51 days) + post-Devcon archive window. R2 lifecycle rules are age-based
on the object (not DB-state-aware), so 30d would have auto-deleted
committed images mid-experiment. An image posted Sep 15 would 404 on
Oct 15 — three weeks before experiment close.

**Resolution:** 90d applied at operator side. CC same-commit amended plan
§5.11/Q7, plan §4 amendments #6 + #10, SPEC.2 §12.3 + §12.6.

**Lesson:** lifecycle window must exceed (longest plausible upload-to-archive
interval) + 24h lifecycle fuzz. 90d is the safe value for a 6-week
experiment with a 1-month archive window.

### SURPRISE-8 (MEDIUM) — Custom Domain bind deferred to post-experiment

**Discovery:** Operator hit Cloudflare's "domain not found on account"
error at prereq [6]. `zugzwangworld.com` DNS hosted at Namecheap, not
Cloudflare.

**Path analysis (web search):**
- Path A (nameserver migration): 1-3 hour pause + email risk for
  zugzwangworld@proton.me (5 Proton DKIM/SPF/MX records visible).
- Path B (Cloudflare partial-CNAME setup): paywall-locked at Business
  plan ($200+/mo). Infeasible at experiment scale.
- Path C (skip custom domain, use R2 public dev URL): plan deviation,
  no edge cache, ugly URL.

**Cost-benefit reframe:** Custom domain delivers edge cache (saves ~$2 at
experiment scale, within free tier) + brand URL polish. The plan
positioned this as load-bearing, but the cost analysis shows it's a
CDN optimization, not a correctness requirement.

**Resolution:** R2 public dev URL enabled on `zugzwang-pfp`,
`R2_PUBLIC_URL_PFP = https://pub-90d8517586b84be98e9cb597350a3277.r2.dev`
in Doppler. CC same-commit amended plan §2.2/§5.11/§7.1.4/§8.2 + SPEC.2
§12.7 + queued tracker entry "post-experiment: bind
cdn.zugzwangworld.com to zugzwang-pfp + DNS migration" for testnet phase.

**Architectural impact accepted:**
- PFP reads bypass Cloudflare edge cache (R2 Class B costs ≤$2 over
  experiment window, within free tier)
- Latency per PFP read ~50-100ms direct-to-R2 instead of ~10ms edge HIT
- Ugly URL visible on right-click → view image

**Lesson:** Plan-mode brief listed "DNS control verified ✅" as prereq #3
(`SCAFFOLD.15-plan-mode-brief.md` §6), but "DNS control" meant
registrar-level (Namecheap), not Cloudflare-zone-hosted. Two different
things. Future plan-mode brief verifications should distinguish
"control" from "where DNS is actually hosted."

### SURPRISE-9 (LOW) — R2 secret length not independently verified

**Discovery:** Operator's password manager showed two stored R2 secrets
appearing different lengths during prereq [8]. R2 secrets are
deterministically 64 hex chars; mismatch would indicate mis-copy or
field-swap during token capture.

**Resolution:** Operator confirmed "all good" without character-count
verification. Carried forward as LOW-severity risk gate. CC same-commit
documented in `tests/server/storage/_probe-r2-roundtrip.test.ts` header
as root-cause check #1 for any future SignatureDoesNotMatch error.

**Final resolution (post-merge):** Live R2 round-trip probe ran GREEN
end-to-end. Both stored secrets are valid 64-char hex. SURPRISE-9
conclusively closed.

**Lesson (process):** Operator-pre-flight verification on credential length
is cheap (30 seconds, no exposure of secrets) and prevents
SignatureDoesNotMatch debugging at execute time (30-60 min at the wrong
abstraction layer). Worth pressing on at the moment, even at the cost of
chat-flow friction. Web Claude pressed twice; operator confirmed "all
good" both times; probe proved correct. Discipline justified by outcome.

---

## 4. CC kickoff refinements proposed at chat open

Four refinements proposed before firing the CC prompt; three accepted:

| # | Refinement | Disposition |
|---|---|---|
| 1 | Disambiguate "13 SPEC.2 amendments" count (12 original + 1 origin-allowlist added during plan review) | Accepted; folded into kickoff |
| 2 | Step 0 (branch cut) explicit, not implicit | Accepted; CC verified hash `0040270` at chat open |
| 3 | "8 gating items" reference to plan §7.1 stays as-is (plan is source of truth; let CC catch any gap at probe step per SURPRISE-arrest rule) | Accepted; no kickoff change |
| 4 | Live R2 probe gated on explicit `R2_PROBE_LIVE=true` (NOT on `R2_ENDPOINT_UPLOADS` presence, which Doppler always has set); probe keys prefixed `probe/` (NOT `u/`) so lifecycle rule doesn't sweep probe artifacts | Accepted; CC implemented per kickoff in `_probe-r2-roundtrip.test.ts` |

All four ratified pre-fire. CC absorbed at execute. Probe ran clean
post-merge.

---

## 5. Layer 1 review of CC execute output

Per CLAUDE.md §5.10 (PASS/FAIL/SURPRISE format walking plan §7 exit
criteria).

| Category | Result |
|---|---|
| Phase 0 SURPRISE carry-forward (7/8/9 same-commit amendments) | PASS |
| Step 0 branch cut from `plan/scaffold-15` @ `0040270` | PASS |
| Plan §7 exit criteria (tests, migration, deps, env vars, `just verify`, reviewer-calls, self-audit, close-out log own-commit) | PASS with two minor deviations (13 limits constants instead of 12; 11 .env.example lines instead of 10 — both justified, in-scope) |
| Critical execute-time discipline (AWS SDK shape probe, CORS literal headers, fail-CLOSED moderation, event-write stubs, openai literal pin) | PASS |

**Three Layer 1 findings (forward-looking, non-blocking):**

1. **5 `.todo` tests** — close-out doesn't enumerate titles. Likely
   benign (scaffolds for downstream strata like ENGINE.6/DEBATE.2 per the
   close-out's Option-A recommendation). Action: optional pre-merge `grep
   "it\.todo" -r tests/` for visibility; not gating.

2. **CORS ExposeHeaders verification** — was carried in kickoff as a
   concern (dashboard UI didn't surface those columns). PR body's
   operator test plan explicitly queues `wrangler r2 bucket cors list`
   verification. Operator ran post-merge, confirmed both ExposeHeaders +
   MaxAge saved correctly. Finding resolved.

3. **ENGINE.6 r2_delete_failed event_type** — SURPRISE-13's UPDATE-CAS
   ordering inversion creates a new "R2 delete failed during orphan
   sweep" silent path. Currently 4 canonical event_types stubbed; a 5th
   for r2-delete-failed-during-sweep would close the observability gap.
   Carry-forward note for ENGINE.6 plan-mode.

**Layer 2 (file-level spot-check) and Layer 3 (full diff walk) were
skipped per CLAUDE.md §5.10 ("optional when Layer 1 is clean").** CC's
three reviewer-call subagents (db-migration-reviewer / code-reviewer /
security-auditor) already covered file-level audit, with the
security-auditor catching the UPDATE-CAS inversion (SURPRISE-13) as a
genuine TOCTOU win.

---

## 6. SURPRISES carried forward beyond SCAFFOLD.15

These were surfaced by CC's security-auditor as pre-existing systemic
gaps. Correctly NOT in SCAFFOLD.15 PR scope. Tracked for HARDEN.* sweep.

### SURPRISE-14 (MEDIUM, pre-existing) — `users.banned_at` not enforced anywhere

SPEC.2 §8.6 requires request-time ban enforcement at every state-mutating
handler entry. No handler in the codebase currently honors
`users.banned_at` — including pre-existing surfaces (`createSessionGate`,
OTP gate). SCAFFOLD.15's new upload-sign route inherits the gap.

**Action:** HARDEN.* task to extend `createSessionGate` + every
state-mutating handler with `bannedAt IS NULL` gate returning
`error_account_banned`. Recommend centralization in the session gate
rather than per-handler sprinkling (drift risk).

### SURPRISE-15 (LOW, pre-existing) — `X-Forwarded-For` first-entry trust

`extractIp` pattern lives in 4 places (`tos-accept.ts:50`,
`auth/index.ts:100`, `auth/admin/login.ts:55`, new upload-sign route).
Attacker can spoof leftmost entry to evade per-IP rate-limit.
Severity LOW because rate-limit is fail-OPEN.

**Action:** HARDEN.* task to centralize at `lib/extract-client-ip.ts`
helper preferring `X-Real-IP` with `X-Forwarded-For` rightmost fallback.

### Open decision: HARDEN.* sweep scheduling

Recommended placement: after ENGINE.6 + SCAFFOLD.17 + SCAFFOLD.16 but
before launch (Sep 15). Surfaces in the post-scaffold plan-review
(see §11.2).

---

## 7. Doppler project slug correction (memory hygiene)

**Discovery (mid-chat):** During Action 1 live R2 probe, operator's
`doppler run -p experiment` command failed with `Doppler Error: Could not
find requested project 'experiment'`. Diagnostic via `doppler projects`
revealed the actual slug is **`zugzwang-experiment`**, not `experiment`.

**Correction for future operator-facing instructions:**
- Doppler project slug: `zugzwang-experiment`
- GitHub repo: `zugzwang-foundation/experiment`
- Local working directory: `~/code/zugzwang/experiment`

These three "experiment" namespaces are NOT the same. Future kickoff
prompts and operator probe commands should use the Doppler-specific slug:

```bash
doppler run -p zugzwang-experiment -c prd -- <command>
```

CC's local Doppler config (in the repo) already uses the correct slug,
which is why CC's commits succeeded despite the operator-facing kickoff
using "experiment." The drift was operator-facing only.

---

## 8. CC wind-down branch-cleanup pattern (squash-merge artifact)

**Discovery during wind-down ritual:** `git branch -d plan/scaffold-15`
refused with "branch not fully merged" error after PR #47 squash-merged
to `main`. Force-deletion (`-D`) was required despite the content being
losslessly preserved on `main`.

**Root cause:** Squash-merge collapses all feature-branch commits into a
single new commit with a fresh hash. Git's `branch -d` safety check is a
syntactic commit-hash ancestry walk, not a content-equivalence check. The
plan commit (`0040270`) was the FIRST commit on the feature branch and
its hash is NOT in `main`'s squash commit (`660f193`) ancestry — only its
content is. `git branch -d` cannot verify "content is on main", only
"commit hash is reachable from main", which is false post-squash.

**Pattern to carry forward for future stratum wind-downs:** Standard
cleanup block should explicitly use force-delete on `plan/` branches:

```bash
git branch -d feat/<stratum>            # safe -d: feat branch has remote-tracking ref
git branch -D plan/<stratum>            # force -D: plan branch's first commit is orphaned by squash
```

The `-D` on plan branches is **expected and safe** per squash-merge
mechanics, NOT a sign of unmerged work. The plan content lives in the
squash commit body on main.

**This pattern recurs every stratum.** Each `plan/scaffold-XX` branch will
have a plan-commit-tip that gets orphaned by squash-merge. The standard
CC wind-down kickoff template should reflect this.

---

## 9. Operator-substrate verification artifacts

Captured for future reference:

- **Cloudflare account ID:** `4ddce98b4a4cbc9146d4269f36b03f68`
- **R2 S3 API endpoint (account-level, used for both buckets):**
  `https://4ddce98b4a4cbc9146d4269f36b03f68.r2.cloudflarestorage.com`
- **R2 public dev URL on `zugzwang-pfp`:**
  `https://pub-90d8517586b84be98e9cb597350a3277.r2.dev`
- **API token names (in Cloudflare):**
  `zugzwang-uploads-rw` (Account API Token, Object R&W, scoped to
  `zugzwang-uploads`)
  `zugzwang-pfp-rw` (Account API Token, Object R&W, scoped to
  `zugzwang-pfp`)
- **Cloudflare card on file:** Visa debit ending 2612
- **Vercel team:** `zugzwang-worlds-projects` (Pro plan, $20/seat/mo,
  same card)
- **Production project URL:**
  https://vercel.com/zugzwang-worlds-projects/experiment
- **Production domain:** zugzwangworld.com
- **Doppler project:** `zugzwang-experiment`
- **Doppler configs in use:** `prd` (production; synced to Vercel)

---

## 10. Process notes

- **Operator pushed back twice on web Claude's verification gates** at
  prereqs [7] and [8] ("All set," "Yes all good"). Both pushbacks were
  partially earned — chat-flow friction from web Claude's discipline. In
  both cases the verification eventually proved nothing was wrong, but
  the discipline was justified by the asymmetric cost of catching
  errors at operator-substrate vs. at execute-time. Carry-forward
  pattern: **press on verification gates even when chat flow
  resists; the asymmetric cost favors the press.**

- **Operator caught a real plan bug at prereq [5]** ("why are we deleting
  after 30 days?"). Web Claude initially defended the 30d value, then
  on closer reading found it would auto-delete committed images
  mid-experiment. SURPRISE-7 logged. Operator-led catches are the
  highest-value defect surface — operators see context web Claude
  can't anchor on (in this case: experiment runtime vs. lifecycle
  window). Carry-forward: **always pressure-test plan numerics against
  operator-visible runtime context. The "plan says so" rule does not
  trump "the math doesn't work."**

- **Two-document chat-open ritual.** Operator opened with the kickoff
  prompt from prior plan-mode chat (CC's draft) and asked web Claude
  to refine it. Web Claude refined (4 refinements, 3 accepted) and
  held the refined version until operator-substrate cleared. This
  is a clean pattern worth preserving: don't let plan-mode kickoff
  prompts go to CC un-reviewed; iterate first, fire second.

- **Two CC SURPRISE-arrests during wind-down ritual.** First: local main
  diverged from origin (514675d carrying superseded close-out content).
  Second: `git branch -d plan/scaffold-15` refused due to squash-merge
  hash orphaning. CC stopped both times rather than auto-fixing, per the
  SURPRISE-arrest rule from SCAFFOLD.3-FOLLOWUP-1 lesson 3.1. Both
  resolutions were lossless once verified. Pattern justified again.

- **Operator scope reframe at chat-close on SCAFFOLD.17 dependencies.**
  Operator initially framed SCAFFOLD.16 + SCAFFOLD.17 as a "block to
  complete before plan revision," driven by external dev's 50K-image
  generation timeline. On follow-up question ("do we need the 50k assets
  for this step?"), web Claude re-examined and found a conflation: the
  STRATUM-LEVEL SCAFFOLD.17 work tests at small N (10 placeholder
  images), and the 50K-asset bulk fill is a separate post-stratum
  OPERATOR task. Decoupling these freed the ordering decision. Pattern:
  **operator framings can carry hidden conflations between code-stratum
  scope and operator-substrate scope. Worth probing explicitly before
  accepting ordering claims.**

- **Time:** ~5h elapsed on operator-substrate clearance + execute review,
  parallel to CC's ~5h execute. Plus this chat close-out + ritual.
  Total operator attention for SCAFFOLD.15 day: ~5h.

---

## 11. Decisions ratified post-Layer-1-review

These decisions were made during the close-out ritual, after Layer 1
review completed. Logged here so the reasoning chain is captured for the
post-scaffold plan-review milestone.

### 11.1 — Stratum sequencing for next 3 strata

**Ratified order: ENGINE.6 → SCAFFOLD.17 → SCAFFOLD.16.**

Reasoning chain:

1. Operator's initial framing: "complete SCAFFOLD.16 + SCAFFOLD.17 first
   as a block, because external dev is generating 50K PFP images on DGX
   Spark and we need to test R2 thoroughly."

2. Web Claude pushed back on the "block" framing — each stratum is a
   separate plan-mode → execute → close-out cycle, not a fused
   implementation. Sized properly to preserve SURPRISE-arrest discipline.
   Operator agreed.

3. Web Claude initially recommended SCAFFOLD.17 first (within the 16+17
   block) because it tests `zugzwang-pfp` under realistic load.

4. Operator then asked: "do we need the 50k assets for this step?"

5. Web Claude re-examined and acknowledged a conflation: SCAFFOLD.17 CODE
   testing works at any N (10 placeholder images is fine for integration
   tests). The 50K-image load test is the PRODUCTION FILL operation —
   an operator-side task that happens AFTER SCAFFOLD.17 merges, NOT a
   stratum-scoping concern.

6. With 50K-asset dependency decoupled from stratum scope, the
   16-vs-17-vs-ENGINE.6 ordering becomes a pure dependency-graph
   decision.

7. Web Claude's revised recommendation: **ENGINE.6 first**:
   - Smallest stratum (single-day execute)
   - Unblocks 10+ stub event-write sites accumulated across SCAFFOLD.3
     + SCAFFOLD.15
   - Carries the r2_delete_failed event_type addition naturally
     (Layer 1 Finding 3 from §5)
   - Lowest risk: no vendor unknowns, no migrations, no UI surfaces,
     no external dependencies
   - Repays its 1-2 day cost immediately via cleaner code in subsequent
     strata

8. **Then SCAFFOLD.17:** unblocks pseudonym assignment which is the next
   user-visible bug (currently throws `identity_pool_exhausted` at
   Google OAuth sign-in per SCAFFOLD.3-FOLLOWUP-1 close-out §5.2).

9. **Then SCAFFOLD.16:** Aug 15 Safer onboarding deadline is 12 weeks
   out as of 2026-05-24; comfortable buffer after ENGINE.6 + SCAFFOLD.17.
   Carries the highest external-dependency risk (Safer onboarding +
   AVIF support unknown) — better to land on cleanest substrate.

10. Operator ratified at chat-close.

**DEBATE.2 deprioritized.** Was Web Claude's earlier Option-B
recommendation per CC close-out. Reframed as "useful once primitives
exist, but not blocking next stratum." Will resurface in the
post-scaffold plan-review (§11.2).

### 11.2 — Post-scaffold plan-review milestone

Operator flagged at chat-close: "we will review the plan ahead again after
the scaffolds — we include this in our completed tasks."

**What this means:** After ENGINE.6 + SCAFFOLD.17 + SCAFFOLD.16 are
shipped, hold a plan-review chat to re-evaluate:

- Whether the original plan §7 exit criteria for SCAFFOLD.15 stayed
  current after 3 downstream strata (drift check)
- Whether SURPRISES 14 + 15 (HARDEN.* slot) should still be deferred or
  promoted
- Whether DEBATE.2 should be the next stratum, or whether a different
  stratum has higher priority by then
- Whether the Aug 15 Safer onboarding deadline still holds, or if
  SCAFFOLD.16 already shipped resolved that timeline
- Whether the post-experiment Custom Domain bind task (SURPRISE-8
  carry-forward) needs re-scoping
- Whether any new SURPRISES surfaced across ENGINE.6 + SCAFFOLD.17 +
  SCAFFOLD.16 change the dependency graph going into launch (Sep 15)

**Trigger:** SCAFFOLD.16 close-out chat is the natural moment to schedule
the plan-review. Add to next-stratum kickoff briefs as a known
forward-looking milestone.

**Format:** dedicated plan-review chat (NOT a stratum), 1-2h, web Claude
+ operator only (no CC), output is an updated tracker + revised forward
dependency graph + possible adjustments to the HARDEN.* slot.

**Tracker treatment:** add as a placeholder task entry now (e.g.,
"POST-SCAFFOLD-PLAN-REVIEW") so it appears in the tracker's
completed-tasks list once the three strata ship. This is what operator
meant by "we include this in our completed tasks."

---

## 12. Outstanding for next session(s)

- **ENGINE.6 brief-drafting chat (next).** Web Claude drafts
  `ENGINE.6-plan-mode-brief.md` + `ENGINE.6-technical-research-brief.md`
  before plan-mode opens. Carries forward: r2_delete_failed event_type
  addition (Layer 1 Finding 3), 4 stub event-write sites from
  SCAFFOLD.15, 6 stub event-write sites from SCAFFOLD.3.

- **SCAFFOLD.17 brief-drafting chat (after ENGINE.6).** Scope-clarification
  needed (operator-facing): (a) narrow = upload pipeline only, (b) medium
  = upload + identity-pool seeding, (c) wide = upload + seeding +
  pseudonym-assignment hook fix. Likely (b) or (c). Defer scope decision
  to brief chat. External dev's 50K-image generation is CONCURRENT to
  stratum work, not blocking.

- **SCAFFOLD.16 brief-drafting chat (after SCAFFOLD.17).** Carries
  AVIF-support-across-CSAM-vendors unknown from research brief §Q5.
  Safer onboarding application kicks off in parallel (deadline 2026-08-15
  per research brief §7).

- **Post-scaffold plan-review (after SCAFFOLD.16 ships).** See §11.2.

- **HARDEN.* slot scheduling** — SURPRISES 14 + 15 need a stratum to land
  in. Recommended placement: post-SCAFFOLD.16, pre-launch (late Jul /
  early Aug). Slot decision deferred to post-scaffold plan-review.

- **R2 r2_delete_failed event_type** — Add 5th canonical event_type for
  R2-delete-failed-during-orphan-sweep when ENGINE.6 lands. Closes
  observability gap created by SURPRISE-13's UPDATE-CAS inversion.

- **Post-experiment task** — Bind `cdn.zugzwangworld.com` to
  `zugzwang-pfp` + DNS migration from Namecheap to Cloudflare. Tracked
  per SURPRISE-8 deferral. Testnet-phase scope.

- **Safer/Thorn application** — Apply for Safer Match access by
  2026-08-15. Operator paperwork; not a code dependency. Out of
  SCAFFOLD.15 scope, scheduled for SCAFFOLD.16 brief chat parallel
  initiation.

- **External dev coordination (SCAFFOLD.17 brief)** — Before SCAFFOLD.17
  brief chat opens, confirm with external dev: (a) image format
  (PNG/WebP/AVIF), (b) dimensions, (c) naming convention,
  (d) generation completion ETA, (e) where the 50K images land
  pre-upload (local fs / cloud / direct R2).

---

## 13. Sign-off

PR #47 squash-merged to `main` as `660f193`. Production deploy GREEN.
All 9 operator-substrate items verified live (not just config-claimed).
Three SURPRISES (7/8/9) absorbed same-commit in CC's execute commit.
Layer 1 review PASS. Two pre-existing systemic gaps (SURPRISES 14/15)
correctly deferred to HARDEN.*.

**Stratum sequencing ratified: ENGINE.6 → SCAFFOLD.17 → SCAFFOLD.16.**

**Post-scaffold plan-review scheduled for SCAFFOLD.16 close-out.**

Ready for next chat: ENGINE.6 brief-drafting (web Claude → operator
ratification → committed brief files → ENGINE.6 plan-mode chat opens).

— web Claude, 2026-05-24, ~9:30 PM IST
