# SCAFFOLD.13-B — Plan: 5-vendor credential rotation + Doppler as canonical secrets store

**Task ID:** `SCAFFOLD.13-B` (Stratum B of SCAFFOLD.13; Stratum A closed at PR #40 / commit `7167397`)
**Branch (Phase 2):** `feat/scaffold-13-b` (off `main` at the post-merge SHA of SCAFFOLD.13-A: `7167397`)
**Predecessors on `main`:** SCAFFOLD.13-A @ `7167397`, tracker-sweep-v9 @ `82bee48`
**Critical path:** NO under CLAUDE.md §1's literal directory list (no `src/server/auth/`, `src/db/schema/`, or `drizzle/migrations/` files touched). **Treated as security-sensitive anyway** — kickoff mandates `security-auditor` reviewer calls at plan-review and at execute close-out. **Per Amendment 7 (web Claude plan-review verdict): the §5.11 invocation policy is pattern-extended in this PR via `docs/maintenance.md` to add "credential-rotation / secrets-store cutover work" as a recognized routing class.** Documented in §6.
**Plan author:** Claude Code plan-mode session, 2026-05-17 (re-emit round 3 same calendar day — security-auditor PASS-with-conditions returned 2 MEDIUM FAILs + 2 LOW SURPRISEs + 1 meta; web Claude adjudication accepted 5 amendments (9–13) closing all four substantive findings via in-plan changes)
**Plan-review surface:** web Claude chat (per CLAUDE.md §5.1) — Hrishikesh confirms in Claude Code then pastes for re-review pass

**Amendment log:**

| # | Severity | Amendment | Round | Sections touched |
|---|---|---|---|---|
| 1 | HIGH | Copy-paste discipline (not re-type) for Doppler `prd` + NEW B5a non-secret value-match check | Round 1 | §1.1, B4, B5a (new), §8.2 |
| 2 | MEDIUM | A3 `read -rs` discipline wording rewritten for operational feasibility | Round 1 | A3, A4 |
| 3 | MEDIUM | Better Auth smoke endpoint coverage (A6-3a + B9 mirror; ADR-0010 coupling finding pre-loaded in §14) | Round 1 | A6, B9, §14 |
| 4 | MEDIUM | Doppler `dev` simplified to key-names-only with placeholder values | Round 1 | §0.5, §1.1, B5, §2 #6, §11 #6 |
| 5 | HIGH | Doppler→Vercel disable-behavior NEW B5b password-manager backup (vendor-unverified disable behavior) | Round 1 | B5b (new), §7 (multiple rows), §0.4 |
| 6 | Q4 verdict | IMMEDIATE old-secret disablement (Google + Resend); override CC's 24h candidate | Round 1 | §5.1, §5.2, §2 #10, §9 Q4, §7 |
| 7 | Q5 verdict | Pattern-amend §5.11 in-PR via `docs/maintenance.md`; not one-off deviation | Round 1 | §1.3, §6, §9 Q5 |
| 8 | Q7 verdict | Narrow CLI allowlist (`doppler secrets list`, `doppler configs list`) for audit backstop; reject wildcard | Round 1 | §6, §9 Q7, §12 |
| Q8 | Q8 verdict (Round 2) | **B5b mechanism CORRECTED — vendor-dashboards + password-manager sourcing (NOT Vercel reveal). Vercel Sensitive flag confirmed write-once-read-never from BOTH CLI AND dashboard.** Meta-lesson preserved in Q8 + §14. | Round 2 | §0.3, §0.4, §1.1, §4 B4, §4 B5b (mechanism replaced), §7 (B6 rows), §8.2, §9 Q8, §11 #17, §14 |
| 9 | MEDIUM FAIL (security-auditor F4) | Vercel auto-redeploy cascade — NEW B6a-smoke gate between B6a + B6b + B7 redesign (Doppler activity-log inspection; no production redeploys for verification) + strike "non-disruptive to production" language | Round 3 | §1.1, §2 #8 (content replaced), §4 B6a+B6b (B6a-smoke inserted), §4 B7 (replaced), §4 B8 (cascade-aligned to new B7), §7 (B7 row revised + new B6a-smoke row), §8.2, §11, §14 |
| 10 | MEDIUM FAIL (security-auditor F6) | Pre-verification footprint — confirm "<2 min" SLA absent from §0.4 prose + NEW B0 public-search pre-flight (lighter than throwaway-Vercel-project probe) | Round 3 | §0.4 (new row), §2 #16 (new), §4 B0 (new), §11 |
| 11 | LOW SURPRISE (security-auditor F8) | `.env.local` update path — NEW A4.5 step (operator updates `.env.local` with rotated values for local-dev parity) + §1.3 tightening | Round 3 | §1.3, §3 A4.5 (new), §11 |
| 12 | LOW SURPRISE (security-auditor F7) | Sensitive-flag literal-value assertion §14 pre-load (generalized from probe-key surface, now moot post-Amendment-9 B7 redesign) | Round 3 | §14 |
| 13 | meta | Reviewer-call format discipline carry-forward (round-2 security-auditor invocation opened with preamble line; single occurrence, not yet a pattern) | Round 3 | §12, §14 |
| 14 | Round 4 micro-touch | 4 cosmetic fixes (§2 #16 AND-not-OR + §4 B7 halt-clarification + §9 Q2 RESOLVED + §9 Q3 RESOLVED) | Round 4 | §2, §4, §9 |
| 15 | Round 4 close — LOWs accepted as residual | F6 + F7 + F8 accepted with §9 rationale; no amendments | Round 4 | §9 (Q-residuals new entry) |
| 16 | **HIGH** (B0 Behavior-(a) CONTRADICTED) | NEW B5c clean-slate step — delete the 12 manually-added Vercel env vars between B5b and B6a; HARD CONSTRAINT no operator-triggered deploys during the B5c→B6a-smoke window; §9 Q1 mitigation replaced (clean-slate over value-match); §4 B4 "collision-converges-to-correct" prose struck | Round 5 | §0.4, §1.1, §2 (new #17), §4 B4 + B5c (new), §7 (new + revised rows), §8.2 (new item), §9 Q1, §11 (new item #21), §14 |
| 17 | MEDIUM (B0 Behavior-(c) NEW SURPRISE) | §0.4 disconnect-row reframe "NOT DOCUMENTED" → "DOCUMENTED with two-path nuance" (Path A Doppler-side checkbox; Path B Vercel-side auto-removes); §4 B5b prose re-grounds backup rationale on documented behavior; §7 General-revert paragraph aligned | Round 5 | §0.4, §4 B5b, §7 (paragraph after table), §14 |
| 18 | **MEDIUM** (WI4 AMBIGUOUS — Sensitive-flag propagation operator-reported divergence) | §0.4 NEW row "Doppler→Vercel Sensitive-flag propagation on synced vars" (AMBIGUOUS — Doppler docs claim Sensitive default; Vercel community thread 38766 reports operator-observed non-Sensitive) + Condition-1 breach-context footnote (post-2026-04-19 Vercel breach); B6a-smoke gains explicit `vercel env ls production` literal-value assertion (`Encrypted` flag on all 12 keys); §14 Amendment-12 pre-load entry reframed; §9 NEW Q9 PRE-COMMITTED to Option (a) abandon per Condition-2 web-Claude verdict | Round 5 | §0.4 (new row + footnote), §4 B6a-smoke (extended), §7 (new row), §8.2 #9, §11 #20, §14, §9 (new Q9) |
| 19 | LOW (housekeeping) | Round 5 cascade-emergent check; §11 grows 20→21; §15 sign-off updates; §12 process-observation item 1 updates count | Round 5 | §11 count, §12 #1 count, §15 sign-off |

**Round 2 (2026-05-17 same calendar day):** web Claude accepted Q8 corrected-sourcing candidate from re-emit round 1. Original Amendment 5 mechanism ("Vercel UI shows Sensitive values on click → reveal → copy") was structurally infeasible. Corrected mechanism applied inline to B5b; all "pending Q8 verdict" caveats removed throughout. Meta-lesson captured in §9 Q8 + §14 SURPRISE pre-load (web Claude prescriptions touching vendor UI mechanics must be pre-verified by CC against vendor docs before plan-mode applies them — symmetric to §0.4 pre-verification rule applied to CC).

**Round 3 (2026-05-17 same calendar day):** security-auditor reviewer-call (plan-review surface, per §6 routing table row 1 + Amendment 7 pattern-extension) returned PASS-with-conditions on round-2 plan: 2 MEDIUM FAILs (F4 Vercel auto-redeploy cascade, F6 pre-verification footprint adequacy) + 2 LOW SURPRISEs (F7 Sensitive-flag literal-value, F8 `.env.local` update path) + 1 meta (reviewer-call preamble drift). Web Claude adjudication 2026-05-17 same day accepted 5 amendments (9–13) closing all four substantive findings via in-plan changes; meta-finding tracked in §12 process observations (carry-forward) + §14 pre-load (recurrence-watch). Round-3 amendments stack on round-2 state. Cascade-emergent edits (B8 prose alignment to new B7, new §7 row for B6a-smoke gate, §8.2 renumber, §11 grows from 17 to 20 items, §14 strike/update/add, §1.1 row title + substance rewrite, §3/§4 phase-header updates) are implementation details of Amendments 9–13; no Q9 surfaced (§9 unchanged structurally — see Round 3 cascade-emergent check at end of §15).

---

## §0 Context (load-bearing — read first)

### §0.1 Two distinct surfaces this stratum addresses (keep separate)

This plan covers two related but distinct surfaces. They overlap on the 5 leaked secrets but otherwise have different shape, sequencing, and rollback profile. **Phases A and B are sequenced; A completes and verifies before B begins. Per Amendment 11 (round 3), A4.5 is inserted between A4 and A5. Per Amendment 10 (round 3), B0 (public-search pre-flight) is inserted at the start of Phase B before B1. Per Amendment 9 (round 3), B6a-smoke is inserted between B6a and B6b.**

| Surface | Scope | Trigger | Sequencing |
|---|---|---|---|
| **Rotation** | 5 leaked secrets (`BETTER_AUTH_SECRET`, `ADMIN_PASSWORD`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`) — exposed via `/tmp/scaffold14-env.txt` for 3+ days, world-readable mode 644 | SCAFFOLD.13-A SURPRISE 8 + A8 HIGH finding 2 + operator decision 2026-05-17 ~14:50 IST | **Phase A** (load-bearing first action; A1–A7 with A4.5 inserted per Amendment 11) |
| **Doppler-canonical** | All ~12 production env vars (the 5 above plus `DATABASE_URL`, Upstash REST URL/token, Google client ID, Resend FROM, Turnstile site key, Better Auth URL) move into Doppler as the single source of truth, with Doppler→Vercel integration syncing automatically | Tracker-sweep-v9 §"Path A — SCAFFOLD.13 kickoff first" + original SCAFFOLD.13-B framing | **Phase B** (B0 pre-flight + B1–B9, plus B5a + B5b + B6a-smoke inserted per Amendments 1 + 5 + 9) |

**Why this sequencing:** under the current "direct-Vercel-dashboard" operating mode, both the rotation procedure and the rollback profile are well-understood. Once Doppler is wired as Vercel's source, that flow changes shape — the spot-check loop becomes Doppler → integration webhook → Vercel auto-redeploy, and the dashboard-edit path becomes ambiguous (open question §9 Q1). Doing rotation first under the known flow is the safer ordering, and Phase B then begins with a known-clean credential state.

### §0.2 Inventory: what's currently in Vercel (per SCAFFOLD.13-A §14 appendix)

12 entries captured 2026-05-17 via `vercel env ls production`, all Sensitive-flagged ("Encrypted"):

```
 DATABASE_URL                       Production, Preview         23h ago     (rotated 2026-05-17 — DO NOT re-rotate)
 UPSTASH_REDIS_REST_URL             Production, Preview         2d ago
 UPSTASH_REDIS_REST_TOKEN           Production, Preview         2d ago
 GOOGLE_CLIENT_ID                   Production, Preview         3d ago
 GOOGLE_CLIENT_SECRET               Production, Preview         3d ago      ← ROTATE (in /tmp/scaffold14-env.txt)
 RESEND_API_KEY                     Production, Preview         3d ago      ← ROTATE
 RESEND_FROM_EMAIL                  Production, Preview         3d ago
 NEXT_PUBLIC_TURNSTILE_SITE_KEY     Production, Preview         3d ago
 TURNSTILE_SECRET_KEY               Production, Preview         3d ago      ← ROTATE
 BETTER_AUTH_SECRET                 Production, Preview         3d ago      ← ROTATE
 BETTER_AUTH_URL                    Production, Preview         3d ago
 ADMIN_PASSWORD                     Production, Preview         3d ago      ← ROTATE
```

**Rotation set (Phase A):** 5 entries marked above.
**Non-rotation, Doppler-only (Phase B):** the other 7 (DATABASE_URL was rotated in 13-A's mid-session leak incident; the rest were never exposed to /tmp).
**Total Doppler `prd` population: 12 entries** — Doppler holds the full set, with values copy-pasted from vendor dashboards + operator password manager (per Q8 RESOLVED sourcing; **NOT from Vercel reveal**, which is structurally infeasible per §0.3 / §0.4).

**Non-secret subset (4 keys; safe to copy from `.env.local` for B5a eyeball comparison):** `GOOGLE_CLIENT_ID`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `BETTER_AUTH_URL`.

R2 env vars are NOT present in current Vercel inventory — R2 substrate has not landed in any prior stratum. **R2 is out of scope** for SCAFFOLD.13-B (no inventory to migrate). When R2 substrate lands (separate task; HARDEN.* range), it adopts the Doppler pattern this stratum establishes.

### §0.3 Load-bearing predecessor anchors

- `docs/logs/SCAFFOLD.13-A.md` — read in full; the "Handoff to SCAFFOLD.13-B" section is this plan's literal first-action contract. §"Surprises caught + fixed in-session" (8 entries) — SURPRISE 4 + 7 + 8 motivate Phase A; SURPRISE 5 + 6 motivate Phase B's pre-verification discipline.
- `docs/plans/SCAFFOLD.13-A.md §14` appendix — `vercel env ls production` capture, source of §0.2 above.
- `docs/plans/SCAFFOLD.13-A.md §0` finding 3 — **Vercel Sensitive flag root cause: write-once-read-never from BOTH CLI AND dashboard.** Q8 RESOLVED in round 2 generalizes this from "CLI-specific" to "all-surface" — the dashboard masks Sensitive values too; reveal-on-click is NOT a Vercel behavior for Sensitive vars (operator's UI sees the masked-indicator state, never the value). Phase B's Doppler→Vercel cutover relies on Doppler **defaulting to Sensitive** on all syncs (verified via Doppler docs in §0.4 below) — preserves the §0 finding 3 posture. **B5b sourcing strategy (per Q8 RESOLVED): vendor dashboards + password manager, not Vercel.**
- `CLAUDE.md §5.10` (pre-PR self-audit) + `§5.11` (reviewer-call invocation; pattern-extended in this PR per Amendment 7) + `§7` cleanup absorption rule.

### §0.4 Pre-verification footprint (carrying forward 13-A error pattern)

SCAFFOLD.13-A's repeating error pattern (per §0 finding 4 + finding 6) was asserting tool/vendor capabilities without pre-verifying them against the operator's actual tier/setup. This plan front-loads pre-verification before asserting procedure. **Round 2 also adds a symmetric pre-verification rule for web-Claude prescriptions touching vendor UI mechanics (per §9 Q8 meta-lesson + §14 SURPRISE pre-load). Round 3 adds B0 public-search pre-flight at execute-phase per Amendment 10 (Finding 6c resolution) — bottom row.**

| Capability asserted | Pre-verified via | Result |
|---|---|---|
| Doppler free-tier project + config + sync limits | `www.doppler.com/pricing` (2026-05-17) | Developer tier: 10 projects, 10 configs/env, 4 envs, **5 config syncs**, 3-day activity log. Comfortably within budget for 1 project + 2 configs (`dev` + `prd`) + 2 Vercel integration slots. |
| Doppler→Vercel Sensitive-flag preservation | `docs.doppler.com/docs/vercel` (2026-05-17) | "Doppler defaults to Sensitive for all Vercel syncs." **Preserves §0 finding 3 posture from 13-A.** |
| **Doppler→Vercel Sensitive-flag propagation on synced vars (NEW per Amendment 18 / WI4 mini pre-verification 2026-05-18)** | Doppler docs (row above) + Vercel community thread 38766 + Doppler community thread 1967 + Vercel KB April-2026-breach bulletin (WI4 yield 2026-05-18 + Q9-pre-flight 2026-05-18) | **AMBIGUOUS pre-execute; verified explicitly at B6a-smoke step 4.** Doppler docs claim Sensitive default for all Vercel syncs (row above); Vercel community thread 38766 (posted 2026-04-20) reports one operator observing Doppler-synced vars appearing as "visible on click" (non-Sensitive) in Vercel dashboard; Vercel staff (Jacob Paris) acknowledged: *"our integrations team is actively working on this feature but since it involves adding support for each third party, we can't give an immediate ETA."* Q9-pre-flight (2026-05-18) confirmed STILL OPEN — no dated changelog evidence of resolution between 2026-04-20 and 2026-05-18. **Verification at execute-phase B6a-smoke step (Amendment 18 extension):** explicit `vercel env ls production` literal-value check immediately after B6a sync + auto-redeploy lands, asserting all 12 keys show `Encrypted` flag. **Escalation:** if non-Sensitive observed, halt B6b and execute pre-committed Option (a) abandon per §9 Q9 (web-Claude PRE-COMMITTED 2026-05-18). **See post-table footnote for threat-model amplification (Condition 1).** |
| Doppler→Vercel integration scope (per-environment) | `docs.doppler.com/docs/vercel` (2026-05-17) | **Each integration targets a single Vercel environment.** Production + Preview = 2 separate integrations (both pulling from same `prd` config). Within free-tier 5-slot budget. |
| Doppler→Vercel auto-redeploy on change | Doppler search results (2026-05-17) | "Doppler extends Vercel's environment variable workflow by adding features such as cross-project variable referencing and automatic redeployment when variables change using environment-specific webhooks." **Auto-redeploy is the mechanism, not manual sync.** No specific propagation-lag SLA published by Doppler (per Amendment 10 Finding 6b — observe-and-document during execute; no number-bound gate). |
| Doppler→Vercel name-collision behavior on first sync | Doppler support article 12963214278427 + community thread 1940 (B0 yield report 2026-05-18, per Amendment 10) | **DOCUMENTED — Vercel REJECTS sync writes on name-collision** with manually-added or other-integration-owned env vars. Verbatim from Doppler support: *"Vercel throws an error rather than allowing this to be overwritten."* Resolution: *"remove or rename the manually added variables that are conflicting."* Plan's prior "collision converges to correct end state" framing INVALID. Mitigation replaced — per Amendment 16: new B5c clean-slate step deletes all 12 Vercel-side env vars before B6a integration enable. Surfaced as §9 Q1 (status retained as UNRESOLVED-MITIGATED with replaced mitigation). |
| Doppler→Vercel integration-DISABLE behavior (per Amendment 5; **resolved post-B0 per Amendment 17**) | Vercel REST API doc "Delete an integration configuration" + Doppler community thread 1967 (B0 yield report 2026-05-18) | **DOCUMENTED with two-path nuance.** **(Path A — Doppler-side sync delete):** operator-controlled "Delete all secrets in Vercel" checkbox; default behavior on plain disconnect not explicitly stated; verbatim from thread 1967: *"When prompted, choose 'Delete all secrets in Vercel' as well. This prevents existing Encrypted variables from remaining in Vercel."* **(Path B — Vercel-side integration uninstall / REST API `DELETE /v1/integrations/configuration/{id}`):** auto-removes env vars; verbatim from Vercel REST API doc: *"the configuration and all of its resources will be removed. This includes Webhooks, LogDrains and Project Env variables."* **Mitigation retained:** B5b backup substrate ensures Vercel-side recovery regardless of which path is used and regardless of checkbox state. |
| **Vercel Sensitive-flag readability from dashboard (per Q8 RESOLVED in round 2)** | 13-A §0 finding 3 root cause + Vercel platform-security convention (2026-05-17) | **VERIFIED write-once-read-never from BOTH CLI AND dashboard.** Matches §0 finding 3 from 13-A — the finding was NOT CLI-specific. Vercel's dashboard masks Sensitive values; no "click → reveal → copy" path exists. B5b sourcing pulls from vendor dashboards + password manager instead (per Q8 RESOLVED). |
| Google OAuth Client Secret rotation (dual-active) | `support.google.com/cloud/answer/15549257` + Google OAuth API docs (2026-05-17) | **Dual-active supported.** Max 2 secrets per client. Add new → migrate apps → manually disable old. No automatic invalidation. |
| Resend API key rotation (graceful) | `resend.com/docs/knowledge-base/how-to-handle-api-keys` (2026-05-17) | **Dual-active supported.** "Both keys will work simultaneously, so ensure your new key is working before deleting your old key." Standard create-new → verify → delete-old. |
| Cloudflare Turnstile secret rotation (atomic with grace) | `developers.cloudflare.com/turnstile/troubleshooting/rotate-secret-key/` (2026-05-17) | **2-hour grace period.** Settings → Rotate Secret Key. Both keys valid for 2 hours; cannot rotate again during grace window. Auto-invalidates after 2h. |
| `/tmp/scaffold14-env.txt` + mirror still present | `ls -la /tmp/scaffold14-env.txt /private/tmp/scaffold14-env.txt` (2026-05-17) | **Both present.** 1035 bytes, mode `-rw-r--r--` (644, world-readable), mtime 2026-05-14 21:03 (~3 days on disk; matches 13-A SURPRISE 8 description). |
| `.env.local` permissions | `ls -la .env.local` (2026-05-17) | **Mode 644** (world-readable). Closes A8 LOW finding 4 from 13-A via Phase A step A2. |
| `docs/maintenance.md` structure (per Amendment 7) | `Read docs/maintenance.md` (2026-05-17) | File exists; structure = "What's in scope" table + "When to audit — five triggers" + audit cadence table + last-revised footer (FOUND.4 / Apr 2026). Cleanest amendment shape: NEW sub-section "Routing extensions to CLAUDE.md §5.11" listing recognized routing classes; see §9 Q5 for exact amendment text. |
| `.claude/settings.local.json` gitignored | `git check-ignore -v .claude/settings.local.json` (2026-05-17) | `.gitignore:49:.claude/settings.local.json` — confirmed gitignored. Operator-local allowlist edits (per Amendment 8 narrow form) do NOT appear in PR diff; §1.3 does not list this file. |
| **Doppler→Vercel undocumented behaviors public-search (per Amendment 10 / Finding 6c)** | **B0 pre-flight executed 2026-05-18 (~10 min; yield report archived in operator's chat surface)** | **EXECUTED.** (a) initial-sync collision: **CONTRADICTED** — plan mitigation invalid; replaced via Amendment 16 / B5c. (b) propagation lag: **CONFIRMED** — no community-reported number-bound SLA; observe-and-document posture retained. (c) integration-disconnect semantics: **NEW SURPRISE** — documented with two-path nuance, framing-level edits per Amendment 17. Yield report's decision gate (HALT) triggered Round 5 amendment cycle before B1. |

**Symmetric pre-verification rule (added round 2 per §9 Q8 meta-lesson):** the pre-verification discipline applied to CC plan-mode also applies to **web Claude prescriptions** that touch vendor UI mechanics, vendor CLI behavior, or vendor flag semantics. When web Claude prescribes a vendor-specific procedure step (per amendment, per verdict, per resolution), CC verifies it against vendor docs + prior session findings before applying. Q8 cascade in round 1 illustrated this — Amendment 5's "Vercel dashboard reveal" mechanism conflicted with 13-A §0 finding 3 (Sensitive write-once-read-never) and was caught only because B5b prose carried a forward-pointer caveat. The corrected mechanism (vendor-dashboards + password-manager) lands in round 2.

**B0 pre-flight (executed 2026-05-18) closed the two undocumented items:** (a) Doppler→Vercel name-collision behavior on initial sync — CONTRADICTED; Vercel rejects rather than converges. Plan's prior "collision converges to correct end state" framing is **struck**. Mitigation replaced per Amendment 16 with new B5c clean-slate delete step before B6a integration enable. (b) Doppler→Vercel integration-DISABLE behavior — DOCUMENTED with two-path nuance per Amendment 17 (Path A Doppler-side: operator-controlled checkbox per community thread 1967; Path B Vercel-side: auto-removes per Vercel REST API doc verbatim). B5b backup substrate motivation preserved. **WI4 mini pre-verification (executed 2026-05-18) surfaced AMBIGUOUS Sensitive-flag propagation;** Q9-pre-flight (2026-05-18) confirmed STILL OPEN — escalation pre-committed to Option (a) abandon per §9 Q9 (web-Claude verdict 2026-05-18); B6a-smoke step 4 is the execute-phase disambiguation surface per Amendment 18.

**Footnote (Amendment 18 / Condition 1 — Vercel April 2026 breach threat-model amplification):**

> Threat-model amplification (post-2026-04-19 Vercel breach): the April 2026 Vercel security incident (https://vercel.com/kb/bulletin/vercel-april-2026-security-incident) confirmed non-Sensitive environment variables as the load-bearing exfiltration surface in a documented production breach. Vercel KB verbatim: *"the investigation confirmed that no sensitive environment variables or npm packages were compromised."* This shifts the Sensitive-flag verification from a substrate-quality check to a thesis-level security control. Q9 (a) abandon recommendation is correspondingly load-bearing post-breach, not advisory.

### §0.5 Path A locked (no `doppler run` for local dev); Doppler `dev` is a key-name inventory reference

Per kickoff scope hard boundary: **Doppler-native dev flow (`doppler run -- pnpm dev`) is rejected.** `.env.local` continues as the dev-time secrets file. **Per Amendment 4 (web Claude verdict on internal-facing-object bloat):** Doppler `dev` config exists as a **key-name inventory reference with empty / placeholder values** (e.g. `<set-in-doppler-prd>`), NOT real dev secrets. It is never synced anywhere, never read by application code. Purpose: **drift-detection visibility** — if a new key is added to `prd` later, operator can see `dev` is missing that key and mint a matching name-only entry. Near-zero maintenance cost.

Future operator can switch paths in a separate stratum if/when the tradeoff changes; not this PR's call. If/when that switch happens, Doppler `dev` would need to be populated with real dev values at that time.

GitHub Actions / CI secrets also out of scope (kickoff). CI stays on GitHub-native secret store; if/when CI grows beyond current scope, separate follow-up.

---

## §1 Scope

### §1.1 In scope (this PR — SCAFFOLD.13-B)

| Item | Substance |
|---|---|
| Rotation of 5 leaked secrets | `BETTER_AUTH_SECRET`, `ADMIN_PASSWORD`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY` (per §0.2 inventory + §0.1 surface table) |
| `/tmp` hygiene | `rm /tmp/scaffold14-env.txt /private/tmp/scaffold14-env.txt`; post-Phase-A re-check via `find /tmp /private/tmp -name '*env*' -mtime +0 2>/dev/null` |
| `.env.local` permissions | `chmod 600 .env.local` |
| `.env.local` content update (per Amendment 11 / Finding 8 resolution) | A4.5 — operator updates `.env.local` with the 5 rotated values from A3+A4 for local-dev parity with post-rotation Vercel state. Gitignored; no diff in PR. |
| Vercel env-var update for rotated 5 | Dashboard, Sensitive flag on, scope Production + Preview (single grouped entry — match A6/A7 pattern from 13-A) |
| Doppler **public-search pre-flight** (per Amendment 10 / Finding 6c) | B0 — ~10-min public-search across Doppler community, GitHub issues, changelog, Stack Overflow for any community-reported patterns on (a) initial-sync collision, (b) propagation lag, (c) integration-disconnect semantics. Captures findings inline before B1. |
| Doppler project provisioning | `zugzwang-experiment` (single project; no vendor-split) |
| Doppler configs | `dev` (key-name inventory reference with placeholder values per Amendment 4; not synced) + `prd` (synced to Vercel Production AND Preview via 2 separate integrations) |
| Doppler `prd` population | All 12 keys from §0.2 inventory **copy-pasted** (per Amendment 1; not re-typed) from vendor dashboards and operator password manager **(per Q8 RESOLVED sourcing — NOT from Vercel reveal, which is structurally infeasible per §0.4)**. Per-key sourcing in B4 table. **Per Amendment 16 / B0 Behavior-(a) CONTRADICTED:** byte-identical values no longer load-bearing for collision mitigation — B5c clean-slate eliminates collision entirely. Copy-paste discipline retained for typo-prevention + audit-trail consistency. |
| Doppler `dev` population | **12-key NAMES mirroring `prd`'s inventory (per Amendment 4), with empty-string or placeholder values (e.g. `<set-in-doppler-prd>`).** No real dev secrets. Sanity-check name parity vs `prd`. |
| **B5c clean-slate delete of manually-added Vercel env vars (NEW per Amendment 16; B0 Behavior-(a) CONTRADICTED resolution)** | All 12 keys deleted from Vercel project (Production + Preview scopes) AFTER B5b backup verification completes. Operator-side window discipline: no deploys triggered between B5c completion and B6a-smoke pass (~5-min target). Last-built deployment continues serving baked-in env values throughout window. B5b backup is the recovery substrate. |
| Doppler→Vercel integration (Production) | `prd` config → Vercel Production environment |
| **Post-B6a gate (per Amendment 9 / Finding 4 resolution): B6a-smoke** | Abbreviated A6 smoke against Production after B6a sync + auto-redeploy lands. HALT before B6b if FAIL. |
| Doppler→Vercel integration (Preview) | `prd` config → Vercel Preview environment (matches current grouped-entry posture from 13-A §0 finding 4) |
| **Doppler→Vercel propagation verification via activity log (per Amendment 9 / Finding 4 resolution; replaces probe-key approach)** | Doppler activity-log inspection confirms B6a + B6b initial syncs are operational and Vercel returned webhook success indicators. **No production redeploys triggered for verification purposes** — the probe-key add/delete approach (round-2 plan) would have caused two extra Production auto-redeploys; activity-log inspection achieves the same propagation-verification goal with zero verification-triggered redeploys. |
| Per-vendor old-secret disablement | **Per Amendment 6 (Q4 verdict):** Google + Resend **IMMEDIATELY** after step-5/step-4 verification confirms new secret works (no 24h window — threat model from 3+ day /tmp exposure does not tolerate dual-active residual). Turnstile auto-invalidates at 2h grace (vendor-controlled). See §5 + §7 rollback table. |
| `.env.example` drift fix | Update line 3 stale "Doppler integration is deferred to SCAFFOLD.13-B" → "Doppler is the canonical source per SCAFFOLD.13-B; Vercel auto-synced via integration; local dev reads `.env.local` (Path A locked)" |
| `docs/maintenance.md` amendment (per Amendment 7 — Q5 verdict) | Add "Routing extensions to CLAUDE.md §5.11" sub-section codifying credential-rotation / secrets-store cutover work routes `security-auditor` at plan-review + execute close-out regardless of §1 critical-path file match. Exact amendment text in §9 Q5. |
| `docs/plans/SCAFFOLD.13-B.md` | This file, promoted at execute-phase first commit |
| `docs/logs/SCAFFOLD.13-B.md` | Six-field log per CLAUDE.md §5.9, written before `gh pr create`; §14 SURPRISE entries pre-drafted at end of plan |

### §1.2 Out of scope (rejected — call out by name)

| Item | Reason | Defer to |
|---|---|---|
| `doppler run -- pnpm dev` (Doppler-native dev flow) | **Path A locked per kickoff.** `.env.local` continues as dev secrets file. | Separate stratum if/when operator switches paths |
| GitHub Actions / CI secrets in Doppler | **Out of scope per kickoff.** CI stays on GitHub-native secret store. | Separate follow-up if/when CI surface grows |
| Vendor-namespacing of secret names (e.g. `supabase.db.url` → `SUPABASE_DATABASE_URL`) | **Explicitly rejected per kickoff.** Secret names mirror Vercel exactly; no renaming. | n/a |
| SCAFFOLD.3-FOLLOWUP-1 (Better Auth Content-Type bug per 13-A §0 finding 5) | Separate tracker entry; downstream from this stratum | SCAFFOLD.3-FOLLOWUP-1 task |
| Interim Supabase project deletion (`niihrpqgzxpczyignxnn`, Tokyo, schemaless) | Operator-side dashboard action; 24h grace per 13-A §10 Q9 amendment; not blocked by this PR | Operator calendar / tracker MAINT-row (target ~2026-05-18 evening) |
| Tracker-sweep v9 → v10 | **Deferred per cadence rule** (1 stratum since v9; sweep cadence ≥ 3 strata) | Future sweep (v10 likely after ~SCAFFOLD.15) |
| R2 credential audit + Doppler integration | R2 substrate not yet landed (no R2 env vars in current Vercel inventory) | Whichever stratum mints R2 (HARDEN.* range likely); adopts the Doppler pattern this stratum establishes |
| `DATABASE_URL` rotation | Rotated 2026-05-17 in 13-A mid-session leak incident (per 13-A SURPRISE 4); current value is post-rotation. **DO NOT re-rotate.** | n/a |
| `GOOGLE_CLIENT_ID`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `BETTER_AUTH_URL` rotation | Not in 5-secret leak set; the latter two are public/non-secret by design (`NEXT_PUBLIC_` prefix + callback URL); `GOOGLE_CLIENT_ID` is technically not secret. Doppler still mirrors them for canonical-source completeness. | n/a |
| `src/**` changes | None expected. If found needed, scope drift — surface and stop. | Separate task |
| `drizzle/migrations/**` changes | None expected (no schema work). | n/a |
| `supabase/migrations/**` changes | None expected (no RLS work). | n/a |
| ADR mint | This is operational, not architectural — no new pattern other code copies. CLAUDE.md §10 defaults not changed. | n/a |
| Throwaway-Vercel-project provisioning for B0 (security-auditor F6 candidate; rejected in favor of lighter B0 form per Amendment 10) | Public-search achieves the same risk-reduction in ~10 min vs ~30 min of new-infra surface with its own failure modes; B5b backup remains the production-side safety net. | n/a |

### §1.3 Source-tree touch surface (what changes in this PR's diff)

```
docs/plans/SCAFFOLD.13-B.md      (NEW — this plan)
docs/logs/SCAFFOLD.13-B.md       (NEW — six-field per-session log)
.env.example                     (MODIFIED — drift fix on line 3 + post-Phase-A canonical-source note)
docs/maintenance.md              (MODIFIED — per Amendment 7 — pattern-extension to CLAUDE.md §5.11 reviewer-call routing; exact amendment text in §9 Q5)
```

**Forbidden surfaces** for this PR (mirror 13-A discipline):
- `src/**` — no source changes; if needed, scope drift
- `drizzle/migrations/**` — append-only at file level per AGENTS.md §6
- `src/db/schema/**` — no schema changes
- `tests/**` — no new tests (env-config swap doesn't have a unit-test surface)
- `docs/specs/SPEC.*.md` — no SPEC amendments (rotation + Doppler-wire is operational; SPEC.1/SPEC.2 not affected)
- `docs/adr/*.md` — no ADR mint (operational, not architectural)
- `.env.local` — modified for permissions (chmod 600 at A2) AND content updated with new rotated values at A4.5 (operator action per Amendment 11). Gitignored; no diff in PR.
- `.claude/settings.local.json` — gitignored (verified §0.4); operator-local narrow-allowlist edit per Amendment 8 does not appear in PR diff.

---

## §2 Exit criterion (PR opens only after all green)

| # | Criterion | Audit reference | Phase |
|---|---|---|---|
| 1 | All 5 leaked credentials rotated and verified live in production | §3 A6 + §5 per-vendor | A |
| 2 | `/tmp/scaffold14-env.txt` + `/private/tmp/scaffold14-env.txt` removed | §3 A1 | A |
| 3 | `.env.local` permissions == mode 600 | §3 A2 | A |
| 4 | Vercel env-var update for rotated 5 reflects new values (audit via `vercel env ls production` showing updated "X seconds/minutes ago" timing) | §3 A5 | A |
| 5 | Smoke test passes post-Phase-A: `/sign-in` returns 200; admin Server Action login succeeds with rotated `ADMIN_PASSWORD`; **Better Auth `/api/auth/session` endpoint smoke (A6-3a) if admin auth is decoupled from Better Auth session machinery per ADR-0010 read** | §3 A6 + §8 | A |
| 6 | Doppler project `zugzwang-experiment` exists with **`dev` (12 key NAMES, placeholder values acceptable)** + `prd` (12 keys with real values) | §4 B2–B5 | B |
| 7 | Doppler→Vercel integrations active for both Vercel Production + Preview (2 integrations, both from `prd`) | §4 B6 | B |
| 8 | **Propagation verification via Doppler activity log (per Amendment 9 / Finding 4 resolution):** B6a + B6b initial syncs logged with Vercel webhook success indicators; `vercel env ls production` cross-reference consistent with sync timestamps. **No production redeploys triggered for verification purposes** (replaces round-2 probe-key spot-check). | §4 B7 | B |
| 9 | Final smoke test passes: `/sign-in` 200; admin login still succeeds; Better Auth `/api/auth/session` endpoint still 200 (B9 mirror of A6-3a); rotated values' integrity preserved through Doppler-mediated sync | §4 B9 + §8 | B |
| 10 | **Per-vendor old-secret disablement performed IN-SESSION per Amendment 6 (Q4 verdict):** Google + Resend old secrets disabled IMMEDIATELY after verification confirms new works (no 24h window). Turnstile auto-invalidates at 2h grace. **No tracker MAINT-row minted (Amendment 6 drops the 24h-deferred row).** | §5 + §7 + §9 Q4 | A or B (immediate post-verification) |
| 11 | `.env.example` drift fix landed | §1.3 | A or B |
| 12 | `docs/logs/SCAFFOLD.13-B.md` written before `gh pr create` (six-field per §5.9 + §14 SURPRISE entries) | §6 close-out | post-B |
| 13 | `security-auditor` reviewer-call invocations: 1 at plan-review (this surface) + 1 at execute close-out | §6 reviewer-call routing | both phases |
| 14 | `pnpm tsc --noEmit && pnpm biome check . && pnpm vitest run` exit 0 (no `src/` changes, but `just verify` per AGENTS.md §11) | §8 verification | post-B |
| 15 | **`docs/maintenance.md` amendment (per Amendment 7) landed in PR diff** — "Routing extensions to CLAUDE.md §5.11" sub-section with exact text per §9 Q5 | §1.3 + §9 Q5 | A or B |
| 16 | **B0 pre-flight public-search completed (per Amendment 10 / Finding 6c):** any community-reported patterns for Doppler→Vercel initial-sync collision, propagation lag, integration-disconnect behavior documented inline in §0.4 update AND captured as §14 SURPRISE entry. If patterns contradict plan assumptions, re-review mitigations before B1 (B0 prose carries the decision gate). | §4 B0 + §0.4 (new row) | B |
| 17 | **B5c clean-slate completed pre-B6a (per Amendment 16 / B0 Behavior-(a) CONTRADICTED resolution):** all 12 manually-added Vercel env vars deleted from Production + Preview scopes before B6a integration enable; operator-side window discipline observed (no deploy triggered between B5c completion and B6a-smoke pass). Verified via `vercel env ls production` showing 0 of 12 keys present in the brief pre-B6a window. | §4 B5c + §8.2 (new item) | B |

---

## §3 Phase A — rotation + `/tmp` + `.env.local` hygiene (A1–A7; A4.5 inserted per Amendment 11)

**Load-bearing first action sequence per 13-A handoff section. Phase A must complete and verify before Phase B begins. Reason: rotation under the current direct-Vercel flow is well-understood; once Doppler is wired as Vercel's source, rotation flows change shape — doing rotation first under the known flow is safer.**

### A1 — `/tmp` hygiene

```bash
rm /tmp/scaffold14-env.txt /private/tmp/scaffold14-env.txt
ls -la /tmp/scaffold14-env.txt /private/tmp/scaffold14-env.txt 2>&1 | grep -q "No such file" || echo "FAIL: files still present"
```

**Verification:** `ls` returns "No such file or directory" for both paths.
**Status (pre-execute):** files confirmed present 2026-05-17 (per §0.4 pre-verification); 1035 bytes each, mode 644, mtime 2026-05-14.

### A2 — `.env.local` permissions

```bash
chmod 600 .env.local
ls -la .env.local | awk '{print $1}' | grep -q "^-rw-------" || echo "FAIL: permissions not 600"
```

**Verification:** `ls -la .env.local` shows mode `-rw-------`.

### A3 — Rotate `BETTER_AUTH_SECRET` + `ADMIN_PASSWORD` (internal regeneration, highest blast radius)

`BETTER_AUTH_SECRET` is the session-cookie HMAC key — compromise lets an attacker forge any participant session.
`ADMIN_PASSWORD` is the admin Control Centre password per ADR-0010.

Both are project-internal (no vendor dashboard required):

```bash
openssl rand -hex 32   # → new BETTER_AUTH_SECRET (64 hex chars; displays once)
openssl rand -hex 32   # → new ADMIN_PASSWORD (64 hex chars; displays once)
```

**Capture pattern (per Amendment 2 — operationally feasible):**

`openssl rand -hex 32` displays the value once in terminal. Operator copies via mouse-select directly into password manager. Then `pbcopy < /dev/null` to clear clipboard immediately, and `clear && history -c` (or close-terminal) to scrub scrollback and shell history. **Do NOT write the value to any file** (no `> /tmp/foo`, no redirects). The previous "no `pbcopy`" wording was infeasible — `openssl` writes to stdout and capture necessarily transits clipboard or scrollback; the discipline is **scrub-after-capture, not refuse-to-capture**.

The `read -rs` discipline (from 13-A) applies to **capturing values from VENDOR DASHBOARDS into a CLI command** (A4 context — paste the vendor-displayed secret into `read -rs VAR` to avoid scrollback persistence). **It does NOT apply to generated values in A3.**

**Pre-launch session-invalidation note:** rotating `BETTER_AUTH_SECRET` invalidates all existing Better Auth sessions. Acceptable pre-launch (no real users; A10 first-smoke is the only "session" in the system and it failed at Content-Type validation before any session was created). Acknowledged in §9 Q3.

### A4 — Rotate `GOOGLE_CLIENT_SECRET` + `RESEND_API_KEY` + `TURNSTILE_SECRET_KEY` (vendor dashboards)

See §5 for per-vendor procedure. **Per Amendment 6 (Q4 verdict): old-secret disablement is IMMEDIATE after verification, not deferred 24h.**

**Capture discipline (per Amendment 2 clarification):**

- For paste-into-Vercel-dashboard flows (typical of A4): vendor displays new secret on a one-time dashboard screen → operator copy-pastes into Vercel dashboard env-var form (browser-to-browser; no terminal transit). Clear browser-clipboard if extension supports; otherwise rely on browser-clipboard expiry / OS clipboard re-fill.
- For paste-into-CLI flows (rare in dashboard-only Phase A): use `read -rs VAR` to capture into a shell variable without scrollback persistence. `read -rs VAR && echo "captured"` then use `$VAR` in the next command.
- Either path: **post-paste `pbcopy < /dev/null`** clears OS clipboard immediately. Avoid `pbpaste` / clipboard-history tools.

High-level:

- **Google Cloud Console** (https://console.cloud.google.com/apis/credentials): Open OAuth 2.0 Client; "Add Secret"; capture new secret. Old secret remains valid until manually disabled (§5.1 — **immediate post-verification per Amendment 6**).
- **Resend dashboard** (https://resend.com/api-keys): "Create API Key"; capture new key. Old key remains valid until deleted (§5.2 — **immediate post-verification per Amendment 6**).
- **Cloudflare Turnstile** (https://dash.cloudflare.com/?to=/:account/turnstile): Open widget; Settings → "Rotate Secret Key"; capture new key. Old key auto-invalidates 2h post-rotation (§5.3 — vendor-controlled timing, no choice).

### A4.5 — Update `.env.local` with new rotated values (local-dev parity; NEW per Amendment 11 / Finding 8 resolution)

**Goal:** local-dev parity with the post-rotation Vercel state. If operator forgets, local dev runs against stale rotated values — not exploitable (`.env.local` is mode 600 + gitignored + local-only) but local dev's admin session-cookie + admin-password behavior diverges silently from production, complicating future smoke-debugging.

**Action:** operator updates `.env.local` with the 5 new values from A3+A4:

- `BETTER_AUTH_SECRET` (new value from A3)
- `ADMIN_PASSWORD` (new value from A3)
- `GOOGLE_CLIENT_SECRET` (new value from A4)
- `RESEND_API_KEY` (new value from A4)
- `TURNSTILE_SECRET_KEY` (new value from A4)

**Capture pattern:** paste each new value from password manager directly into the corresponding `.env.local` line (one at a time; mouse-select-paste from password-manager-reveal field, not clipboard-roundtrip). Save file. `.env.local` mode remains 600 (set at A2; macOS preserves mode on edit by default).

**Verification:** open `.env.local`; eyeball the 5 lines reflect new rotated values. NOT committed (gitignored per §1.3).

**Why A4.5 not deferred:** if operator forgets, the divergence is silent and only surfaces during future debugging. Cheap to do at rotation-time when values are still in password-manager reveal context. Cost: ~3 min.

**Rollback:** if operator pastes wrong value into `.env.local`, re-open password manager, re-paste correct value, save. No production impact (local-only file).

### A5 — Update Vercel env vars (direct dashboard write; Doppler not yet provisioned)

5 keys updated in Vercel via web dashboard, **Sensitive flag on, scope Production + Preview (single grouped entry)** — matches A6/A7 pattern from 13-A:

1. `BETTER_AUTH_SECRET` ← new value from A3
2. `ADMIN_PASSWORD` ← new value from A3
3. `GOOGLE_CLIENT_SECRET` ← new value from A4
4. `RESEND_API_KEY` ← new value from A4
5. `TURNSTILE_SECRET_KEY` ← new value from A4

Vercel auto-redeploys on env-var update (per platform default). Multiple in-flight redeploys collapse to the latest (Vercel's queue behavior). Operator can batch all 5 updates in a single dashboard window; Vercel issues redeploys until the dust settles.

**Post-update audit:** `vercel env ls production` shows all 5 keys with updated "X seconds/minutes ago" timing.

### A6 — Smoke test post-Phase-A (per Amendment 3: Better Auth coverage expanded)

**A6-1 — Pre-smoke check (per Amendment 3):** Read `docs/adr/0010-*.md` (admin auth ADR) + `src/server/auth/` to determine whether admin Server Action login shares session-cookie machinery with Better Auth.

- **If COUPLED** (admin sessions use the Better Auth `BETTER_AUTH_SECRET` for cookie HMAC): admin-login smoke (A6-3 below) implicitly exercises `BETTER_AUTH_SECRET`. Document the coupling finding in §14.
- **If DECOUPLED** (admin uses its own ADR-0010 static-password verification independent of Better Auth session machinery): admin-login smoke does NOT exercise `BETTER_AUTH_SECRET`. Add A6-3a (below).

Browser-only (Vercel deploy URL):

**A6-2** — `https://experiment-zugzwang-worlds-projects.vercel.app/sign-in` → HTTP 200, page renders.

**A6-3** — **Admin Server Action login** (per ADR-0010): admin sign-in form accepts rotated `ADMIN_PASSWORD`; old password rejected. (Validation: try old password first if operator still has it cached; expect failure. Then try new password; expect success.)

**A6-3a (per Amendment 3, only if A6-1 finds DECOUPLED)** — `curl -I https://experiment-zugzwang-worlds-projects.vercel.app/api/auth/session` → expect HTTP 200 with well-formed JSON response body (session endpoint codepath exercised). This exercises `BETTER_AUTH_SECRET` without requiring a real authenticated session — Better Auth's `/api/auth/session` returns an empty/null session for unauthenticated requests but still loads + verifies the secret on the request path. A 500 here would indicate `BETTER_AUTH_SECRET` is broken / misconfigured.

**A6-4** — The 415 downstream bug from 13-A finding 5 still exists on participant Email-OTP POST — this is **not regressing**; it's the same SCAFFOLD.3-FOLLOWUP-1 bug. Document as expected.

**A6-5** — Optional: Google OAuth sign-in. Caveat: OAuth providers cache config; new client secret may take a few minutes to propagate Google-side. If old secret was already disabled (per Amendment 6 immediate disablement), test the new-secret path directly.

**Verification gate before Phase B:** smoke test passes (A6-2 + A6-3 + A6-3a if applicable); rotated 5 values are live; old `/tmp` files removed; `.env.local` is mode 600 with updated content (per A4.5).

### A7 — Phase A close + Phase B gate

`/tmp` hygiene re-check (`find /tmp /private/tmp -name '*env*' -mtime -7 -ls 2>/dev/null` shouldn't surface anything alarming).

Capture A7 close artifact: `vercel env ls production` output post-Phase-A. Compare against §0.2 inventory — same 12 keys, but the 5 rotated entries show recent "X minutes ago" timing. This is Phase B's baseline.

**Phase A complete; gate to Phase B opens.**

---

## §4 Phase B — Doppler integration (B0 pre-flight + B1–B9, canonical-store cutover; B5a + B5b + B6a-smoke inserted per Amendments 1 + 5 + 9; B5b mechanism per Q8 RESOLVED in round 2; B7 redesigned per Amendment 9 / Finding 4 resolution)

### B0 — Pre-flight: public-search vendor-behavior survey (NEW per Amendment 10 / Finding 6c resolution)

**Goal:** reduce reliance on undocumented Doppler→Vercel behaviors via lightweight public-search before production cutover. Cost: ~10 min. No infra spin-up. Closes Finding 6c via auditor's asymmetric-risk concern without compounding scope.

**For each of the three undocumented behaviors flagged in §0.4** (initial-sync collision, propagation lag, integration-disconnect semantics), spend ~3 min on each via:

- Doppler community forum (community.doppler.com)
- Doppler GitHub issues (github.com/DopplerHQ)
- Doppler changelog / release notes
- Stack Overflow / general web search

**Capture findings:**

- If a clear public-reported pattern emerges (e.g. "initial sync overwrites silently", "disconnect retains Vercel vars", "<5 min typical propagation lag") → document inline in §0.4 update AND log to §14 SURPRISE entry for the finding.
- If no clear pattern → status quo (B5b password-manager backup remains the production-side safety net; mitigations unchanged).

**Decision gate after B0:** if public-search surfaces a pattern that CONTRADICTS current plan assumptions (e.g. "disconnect DOES clear Vercel vars" — which would invalidate the "B5b is insurance, probably unused" framing), re-review mitigations before B1. Otherwise proceed to B1.

**Why lighter form (not full throwaway-Vercel-project probe per security-auditor F6c candidate):** auditor's option of provisioning a throwaway Vercel project, attaching Doppler integration, running B6-B7 cycle, and tearing down adds ~30 min of new infra surface with its own failure modes (account-tier limits, OAuth flow on second Vercel project, possible billing edge-cases). B5b backup substrate already exists as production safety net. Public-search closes the asymmetric-risk concern (pre-execution probe exists in some form) without the new-infra surface. Cost-benefit favors lighter form.

**Rollback:** if B0 surfaces a contradicting pattern, B0's internal decision gate handles re-review — no separate §7 rollback row needed.

### B1 — Pre-verify Doppler account state (operator action; <5min)

Operator opens Doppler dashboard (https://dashboard.doppler.com); confirms:

- Account exists (if not: sign up at https://www.doppler.com/signup; free Developer tier).
- Workspace tier = **Developer (free)** per §0.4: 10 projects, 10 configs/env, 4 envs, 5 config syncs, 3-day activity log.
- 0 existing projects (or if any exist from prior experiments, snapshot and continue).

### B2 — Mint Doppler project

Doppler dashboard → New Project → Name: `zugzwang-experiment`. **Single project, NOT split by vendor** (per kickoff). Default configs created: `dev`, `stg`, `prd`.

### B3 — Configs: keep `dev` + `prd`, delete `stg`

Per kickoff: "configs: `dev` + `prd` ONLY (no staging, no branched child configs, no inheritance trees)". Open `stg` → Delete (Doppler default-creates 3 configs; we use 2).

**Why `dev` exists** (per Amendment 4 update): as a **key-name inventory reference** with empty / placeholder values. Drift-detection visibility only. Never synced, never read.

### B4 — Populate `prd` config with current values (per Amendment 1 — copy-paste, not re-type; per Q8 RESOLVED — vendor-dashboards + password-manager sourcing)

**Sequencing: rotate Vercel FIRST (Phase A), then populate Doppler `prd`.** For each of the 12 keys in §0.2 inventory, operator opens Doppler `prd` → Add Secret → enters the key name (mirroring Vercel **exactly** — no renaming, no namespacing, no vendor-prefixing) and **COPY-PASTES the value from the appropriate source (per Amendment 1 + Q8 RESOLVED sourcing strategy — NOT from Vercel reveal)**:

| # | Key name | **Copy-paste source** (per Amendment 1 + Q8 RESOLVED) |
|---|---|---|
| 1 | `DATABASE_URL` | Operator password manager (rotated 2026-05-17 in 13-A leak incident; password component) + Supabase dashboard (project ref + Session pooler endpoint pattern) |
| 2 | `UPSTASH_REDIS_REST_URL` | Upstash console (vendor UI allows value reveal in dashboard) |
| 3 | `UPSTASH_REDIS_REST_TOKEN` | Upstash console (vendor UI allows value reveal in dashboard) |
| 4 | `GOOGLE_CLIENT_ID` | Google Cloud Console (vendor allows reveal; also semi-public) OR `.env.local` (safe to copy) |
| 5 | `GOOGLE_CLIENT_SECRET` | Operator password manager (rotated A4 / §5.1) |
| 6 | `RESEND_API_KEY` | Operator password manager (rotated A4 / §5.2) |
| 7 | `RESEND_FROM_EMAIL` | Resend dashboard (an email address; public) OR `.env.local` |
| 8 | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile dashboard (public by `NEXT_PUBLIC_` prefix) OR `.env.local` |
| 9 | `TURNSTILE_SECRET_KEY` | Operator password manager (rotated A4 / §5.3) |
| 10 | `BETTER_AUTH_SECRET` | Operator password manager (rotated A3) |
| 11 | `BETTER_AUTH_URL` | Known constant: `https://experiment-zugzwang-worlds-projects.vercel.app` |
| 12 | `ADMIN_PASSWORD` | Operator password manager (rotated A3) |

**No re-typing — operator copy-pastes from source to Doppler form field.** Reason (per Amendment 1): re-typing is a typo-generator, and Q1's name-collision value-match mitigation depends on byte-identical values.

**No Vercel reveal** — per Q8 RESOLVED, Vercel Sensitive flag is write-once-read-never from both CLI and dashboard. The 11 Sensitive keys cannot be read back from Vercel. All sourcing is from vendor dashboards (Upstash console, Supabase + password manager, Google Cloud Console, Resend, Cloudflare Turnstile) or operator password manager.

**Mitigation for Doppler→Vercel name-collision behavior (§0.4 DOCUMENTED post-B0; Q1 in §9):** ~~because Doppler `prd` is populated with **the same values Vercel already holds** (post-Phase-A), the collision-time behavior at B6 integration enable is irrelevant — any of overwrite-with-same / skip-existing / error-on-conflict converges to a correct end state.~~ **Per Amendment 16 / B0 yield report Behavior-(a) CONTRADICTED:** Vercel REJECTS sync writes on name-collision (Doppler support article 12963214278427 verbatim: *"Vercel throws an error rather than allowing this to be overwritten"*). The "values match → collision irrelevant" framing is invalid. Mitigation replaced: new B5c step (between B5b and B6a) deletes the 12 manually-added Vercel env vars before B6a integration enable — Doppler writes fresh vars at sync, no collision possible. Byte-identical copy-paste discipline retained for typo-prevention only, not for collision-mitigation.

### B5 — Populate `dev` config with key NAMES only (per Amendment 4)

Doppler `dev` → Add 12 keys mirroring `prd`'s key inventory, with **empty or placeholder values** (e.g. `<set-in-doppler-prd>` or empty string). **No real dev secrets.** Purpose: drift-detection visibility only.

Sanity-check: `prd` 12-key inventory == `dev` 12-key inventory (name-only parity, not value parity). Eyeball or use Doppler's "Compare" view if available on free tier.

### B5a — Pre-B6 non-secret value-match sanity check (NEW per Amendment 1)

For the 4 non-secret keys (`GOOGLE_CLIENT_ID`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `BETTER_AUTH_URL`), eyeball-compare Doppler `prd` values against `.env.local`. These 4 are public/non-secret so reading them locally is safe. **4-of-12 partial backstop with zero credential exposure** — if Doppler `prd` was mis-pasted despite Amendment 1's copy-paste discipline, at least these 4 will surface the mismatch before B6 integration enable.

If any mismatch found → correct in Doppler `prd` BEFORE B6 enable.

For the 8 secret keys, no eyeball check is possible (would expose secret to terminal / log); rely on Amendment 1 copy-paste discipline + Q1 value-match mitigation + B4 vendor-dashboard sourcing.

### B5b — Pre-integration credential backup (NEW per Amendment 5; mechanism per Q8 RESOLVED in round 2)

**Goal (intent preserved per Amendment 5):** Establish a password-manager-resident rollback substrate for all 12 keys. If B6 integration enable clears Vercel env vars unexpectedly (vendor-unverified per §0.4), re-population from the backup closes the gap. Cost: ~5–10 min.

**Mechanism (per Q8 RESOLVED in round 2 — Vercel reveal is structurally infeasible; source from vendor dashboards + password manager instead):**

For each of the 12 keys, confirm the operator's password manager holds the canonical current value. Source per the per-key table below — **NOT from Vercel reveal**, which is blocked by the Sensitive flag (write-once-read-never from BOTH CLI AND dashboard per §0 finding 3 + §0.4 row).

**5 rotated keys (A3 + A4):** already in operator password manager from rotation capture. **No new dashboard reveals needed.** Re-confirm presence + value-correctness in password manager.

**7 unrotated keys:** source per vendor below.

| # | Key name | B5b backup source |
|---|---|---|
| 1 | `DATABASE_URL` | Operator password manager (captured during 13-A rotation, 2026-05-17) |
| 2 | `UPSTASH_REDIS_REST_URL` | Upstash console (vendor allows value reveal in dashboard) |
| 3 | `UPSTASH_REDIS_REST_TOKEN` | Upstash console (same) |
| 4 | `GOOGLE_CLIENT_ID` | Google Cloud Console (vendor allows reveal; also semi-public) |
| 7 | `RESEND_FROM_EMAIL` | Resend dashboard (an email address; public) |
| 8 | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile dashboard (public by `NEXT_PUBLIC_` prefix; safe to copy from `.env.local` also) |
| 11 | `BETTER_AUTH_URL` | Known constant: `https://experiment-zugzwang-worlds-projects.vercel.app` |

**Verification:** After B5b, password manager contains all 12 keys' canonical values. If any key cannot be sourced (vendor lockout, lost session, etc.), pause B6 and resolve before integration enable.

**Why this matters at B6 (re-grounded per Amendment 17):** disconnect behavior is now DOCUMENTED with two-path nuance (per §0.4 row update). **Path A (Doppler-side sync delete)** presents an operator-controlled "Delete all secrets in Vercel" checkbox; default behavior on plain disconnect not explicitly stated by Doppler docs. **Path B (Vercel-side integration uninstall / REST API):** auto-removes all integration-managed env vars per Vercel REST API doc verbatim. Either path can result in Vercel-side var loss during rollback. B5b backup ensures Vercel-side recovery regardless of which path is used and regardless of operator's checkbox choice in Path A. Without this substrate, an integration-disconnect would force operator into a multi-vendor scramble during a degraded-production state, particularly if Path B is used or Path A is used with the delete-secrets checkbox checked.

### B5c — Clean-slate delete of manually-added Vercel env vars (NEW per Amendment 16; B0 Behavior-(a) CONTRADICTED resolution)

**Goal:** zero the Vercel project's env-var state before B6a integration enable, so Doppler's first sync writes fresh vars without name-collision. Vercel's sync-rejection behavior on name-collision (per Doppler support article 12963214278427 + community thread 1940; B0 yield report 2026-05-18) blocks B6a if any of the 12 keys remain Vercel-side at integration enable.

**Pre-condition:** B5b complete (password manager + vendor-dashboard backup verified for all 12 keys; recovery substrate ready).

**Procedure:**

1. Operator opens Vercel dashboard → `experiment` project → Settings → Environment Variables.
2. For each of the 12 keys in §0.2 inventory, delete the row (Production + Preview scopes; the current grouped-entry shape means one delete per key removes both).
3. Audit via `vercel env ls production` — expect zero rows returned (or only Vercel system vars like `VERCEL_ENV` that are platform-injected, not project-defined).

**HARD CONSTRAINT — operator-side window discipline:** between B5c completion (step 3 audit clean) and B6a-smoke pass, operator MUST NOT trigger any deploy. Specifically:

- No `git push` to any branch wired to Vercel deployments (main or any Preview branch with auto-deploy).
- No PR opens / updates that auto-trigger Preview builds.
- No manual redeploy via Vercel dashboard → Deployments → Redeploy.
- No env-var edits (which themselves auto-trigger redeploys per Vercel platform default).

Last-built deployment continues serving on baked-in env values throughout the window. Any new build triggered in this window would fail at deploy-time with `missing env var` errors.

**Target window:** <5 min B5c-complete → B6a-enable → Doppler initial sync + Vercel auto-redeploy → B6a-smoke pass.

**Recovery substrate:** B5b password-manager + vendor-dashboard backup. If B6a errors irrecoverably post-B5c (despite clean-slate), operator manually re-pastes all 12 vars back into Vercel from B5b backup (~10 min). Same B5b values used for both B6a recovery and any subsequent rollback per §7.

**Rollback:** see §7 B5c row.

**Audit trail:** capture `vercel env ls production` snapshot before B5c (12 keys baseline) AND after B5c (0 keys). Both go to §14 SURPRISE entry "B5c clean-slate state capture."

### B6 — Doppler→Vercel integration (cutover)

Two integrations required (per §0.4 pre-verification — one per Vercel environment). **Per Amendment 9 / Finding 4 resolution: B6a-smoke gate is inserted between B6a and B6b to catch a Production-degraded state at single-integration scope before compounding it with Preview integration enable.**

#### B6a — Doppler `prd` → Vercel Production

Doppler dashboard → Project `zugzwang-experiment` → Config `prd` → Sync → Vercel:
- Authorize Vercel (OAuth) — operator's `zugzwang-worlds-projects` org.
- Project: `experiment` (Vercel project name).
- Environment: **Production**.
- Confirm: Doppler defaults to Sensitive flag on all syncs (per §0.4 pre-verification).
- Enable sync.

**Vercel Production auto-redeploy:** B6a's initial sync pushes 12 vars to Vercel Production; Vercel auto-redeploys via webhook (per §0.4 documented mechanism). Wait for the redeploy to complete (Vercel dashboard → Deployments tab; ~1-3 min typical build). Capture build ID for §14.

**Conflict-time behavior observed (capture in §14 SURPRISE if anything surprises):** Doppler may overwrite, skip, or error on Vercel's existing same-name vars. Because values match (B4 sequencing + Amendment 1 copy-paste), the end state is correct regardless. Note observed behavior for future plans.

#### B6a-smoke — Production-only smoke gate before B6b (NEW per Amendment 9 / Finding 4 resolution)

**Goal:** verify Vercel Production state is healthy after B6a sync + auto-redeploy lands, BEFORE enabling B6b (Preview integration). Prevents compounding a Production-degraded state with a Preview-degraded state.

After B6a integration enable completes AND Vercel Production auto-redeploy lands successfully, run abbreviated A6 smoke against Production:

1. `https://experiment-zugzwang-worlds-projects.vercel.app/sign-in` → HTTP 200, page renders.
2. Admin Server Action login with rotated `ADMIN_PASSWORD` (confirms Doppler-mediated value reaches Vercel runtime correctly under the new integration).
3. **(If A6-1 found DECOUPLED)** `curl -I https://experiment-zugzwang-worlds-projects.vercel.app/api/auth/session` → expect HTTP 200.
4. **NEW per Amendment 18 (WI4 AMBIGUOUS resolution; threat-model amplified per §0.4 Condition-1 footnote post-Vercel-April-2026-breach):** `vercel env ls production` → assert ALL 12 keys show `Encrypted` flag (Sensitive). This is a **literal-value assertion**, not just presence. Capture full output to §14 SURPRISE entry. Cross-reference §0.4 NEW Amendment-18 row for the AMBIGUOUS posture and the source citation.

**Gate behavior (extended per Amendment 18):**

- **If B6a-smoke steps 1–3 PASS AND step 4 PASS (all 12 Encrypted):** proceed to B6b. Doppler default-Sensitive claim confirmed in operator's environment; AMBIGUOUS resolved as CONFIRMED-Sensitive at this execution.
- **If B6a-smoke steps 1–3 PASS but step 4 FAILS (any key shows non-Encrypted / "visible on click"):** **HALT B6b. Execute pre-committed Option (a) abandon per §9 Q9 (web-Claude PRE-COMMITTED 2026-05-18 — no in-execute adjudication required):** disconnect B6a integration via Path A (Doppler-side sync delete, checkbox unchecked per Amendment 17 to retain Vercel-side vars) → re-populate Vercel directly from B5b backup → resume direct-Vercel-Sensitive posture (Phase B aborted for this attempt). Recovery <30 min per Q9 (a). Document outcome in §14 SURPRISE.
- **If B6a-smoke steps 1–3 FAIL (functional smoke regression):** existing Amendment 9 HALT path applies; rollback per §7 B6a-smoke row regardless of step-4 outcome.

#### B6b — Doppler `prd` → Vercel Preview

**Pre-condition:** B6a-smoke PASSED. If FAILED, do not enter this step.

Repeat B6a, but Environment: **Preview**. Same `prd` config feeds both — single source of truth for `prd` config; Vercel Production + Preview see identical values (matches current §0.2 grouped-entry posture).

**Vercel Preview auto-redeploy:** B6b's initial sync pushes 12 vars to Vercel Preview; Vercel auto-redeploys the most recent Preview branch via webhook. Capture build ID for §14.

**Cost check:** 2 of 5 free-tier config-syncs used. 3 remaining for future expansion (or `prd` → Vercel Development if Path A ever changes; not now).

### B7 — Propagation verification via Doppler activity log (REPLACED per Amendment 9 / Finding 4 resolution; no production redeploy triggered)

**Goal:** confirm Doppler→Vercel sync is operational without perturbing production.

**Method:** open Doppler dashboard → Project `zugzwang-experiment` → Config `prd` → Activity tab (or equivalent log surface; Developer-tier 3-day window per §0.4). Most recent entries should show:

- 2 sync events from B6a + B6b initial syncs (12 keys each to Production + Preview)
- Vercel webhook response confirmation per sync (HTTP 200 or equivalent success indicator)

**Cross-reference:** `vercel env ls production` shows 12 Encrypted keys with timing consistent with B6 sync timestamps (no probe-key add required).

If activity log shows sync FAILED or no webhook confirmation: halt Phase B — investigate per §7 B7 row before proceeding to B8 or B9 (sync failure means no redeploy to observe at B8 and no production state worth final-smoking at B9).

**Why this approach (vs probe-key add/delete in round-2 plan):**

- Probe-key add triggers Vercel Production auto-redeploy (per §0.4 documented behavior) — not "non-disruptive to production" as the round-2 plan claimed (security-auditor F4).
- Probe-key delete triggers a second Production auto-redeploy.
- Activity-log inspection achieves the same propagation-verification goal with zero production redeploys triggered for verification purposes.

The redeploy observation that the round-2 B7 probe-key was supposed to provide is now provided by B6a + B6b initial syncs themselves (which legitimately do trigger redeploys as part of the cutover, not as verification overhead).

### B8 — Vercel auto-redeploy observation (B6a + B6b initial syncs; cascade-aligned to new B7 per round-3 cascade-emergent edit)

**Goal:** confirm Doppler→Vercel sync mechanism (auto-redeploy via webhook per §0.4) actually fired during B6 cutover.

**Method:** Vercel dashboard → Deployments tab. Confirm 2 redeploys completed successfully:

- 1 Production redeploy triggered by B6a initial sync.
- 1 Preview redeploy triggered by B6b initial sync (against most recent Preview branch).

Capture both build IDs for §14 (per "Vercel auto-redeploy behavior on Doppler sync" pre-load entry).

**If a B6 redeploy FAILED:** revert per §7 B6 row. Investigate Vercel deployment logs; if cause is env-var-related (e.g. malformed value reached runtime), re-populate from B5b backup and re-trigger.

**If NO redeploy was observed for either B6 sync** (Doppler doc claim about auto-redeploy doesn't hold in practice): document in §14 SURPRISE (Doppler→Vercel auto-redeploy behavior diverged from doc); trigger manual redeploy via Vercel dashboard → Deployments → Redeploy → "use existing build cache".

**Why B8 retained despite B7 redesign:** B7 (activity-log inspection) verifies the sync event + webhook response; B8 verifies the redeploy actually happened on Vercel's side. They cover different rungs of the propagation chain. If B7 PASSES (sync logged + webhook success) but B8 FAILS (no redeploy), the divergence is meaningful — Doppler successfully signaled Vercel but Vercel didn't act. This is a Vercel-side issue, not a Doppler-side issue.

### B9 — Final smoke test (post-Doppler cutover; per Amendment 3 mirror of A6)

Same checks as A6, after B6 + B7 + B8 cutover:

1. `/sign-in` → HTTP 200, page renders.
2. Admin Server Action login: rotated `ADMIN_PASSWORD` accepted (confirms Doppler-mediated value reaches Vercel runtime correctly).
3. **B9-3a (mirror of A6-3a, if admin auth was found DECOUPLED at A6-1):** `curl -I https://experiment-zugzwang-worlds-projects.vercel.app/api/auth/session` → expect HTTP 200. Same rationale as A6-3a.
4. Optional: Email-OTP POST returns 415 (SCAFFOLD.3-FOLLOWUP-1 bug; not a regression).

If smoke fails: rollback per §7.

**Phase B complete. Exit criteria 6–9 + 14 + 15 + 16 satisfied.**

---

## §5 Per-vendor rotation procedure (per Amendment 6 — IMMEDIATE old-secret disablement for Google + Resend)

One sub-section per vendor; sourced from pre-verified docs (per §0.4 pre-verification footprint). Each procedure is dual-active where the vendor supports it — minimize the production-downtime window. **Threat model (per Amendment 6): 5 credentials were world-readable in /tmp for 3+ days; assume worst case (potentially exfiltrated). Every additional hour of dual-active = additional hour the potentially-compromised credential remains valid. Pre-launch breakage surface is near-zero. Immediate disablement after verification eliminates residual exposure faster.**

### §5.1 Google OAuth Client Secret

**Vendor docs:** https://support.google.com/cloud/answer/15549257 (verified 2026-05-17). **Dual-active supported.** Max 2 secrets per client. No automatic invalidation — operator manually disables old.

**Procedure:**
1. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → click the Zugzwang client.
2. Right side: **Add Secret**. New secret appears in "Enabled" state.
3. Capture new secret value to operator password manager (`read -rs` if echoed — though dashboard is browser flow per Amendment 2 clarification).
4. Update Vercel env var `GOOGLE_CLIENT_SECRET` with new value (Phase A step A5).
5. Verify new secret works in production (smoke test A6 — Google OAuth sign-in flow; may take a few minutes for Google to propagate config).
6. **Disable old secret — IMMEDIATELY after step 5 verification confirms new secret works (per Amendment 6 / Q4 verdict).** Click old-secret row → Disable. This is a hard cutover; do NOT delete, just disable (Google retains disabled secrets for audit / re-enable).
   - **Timing rationale (per Amendment 6):** threat model post-/tmp-exposure does not tolerate 24h dual-active window. Pre-launch breakage surface is near-zero (no real OAuth flows beyond optional smoke). If A6 verification confirms new secret works, the disablement is safe to perform same-session.

**Failure recovery (per Amendment 6 tightened):** If new secret breaks something AFTER immediate disable: re-enable old secret in Cloud Console (Google retains disabled secrets indefinitely); revert Vercel env var to old secret. Recovery <15 min.

**Public client ID `GOOGLE_CLIENT_ID`:** NOT rotated. Public by design.

### §5.2 Resend API Key

**Vendor docs:** https://resend.com/docs/knowledge-base/how-to-handle-api-keys (verified 2026-05-17). **Dual-active supported.** Both keys work simultaneously until old is deleted.

**Procedure:**
1. Resend dashboard → API Keys → **Create API Key**. Choose permissions matching old key (likely full-access; verify against current SCAFFOLD.3 OTP usage).
2. Capture new key value to operator password manager. **Resend shows the key value once at creation; cannot be re-read.**
3. Update Vercel env var `RESEND_API_KEY` with new value (Phase A step A5).
4. Verify new key works in production. SCAFFOLD.3 OTP path is currently blocked by the 415 Content-Type bug (per 13-A finding 5) — direct OTP smoke is not feasible. **Substitute verification:** check Resend dashboard "Activity" tab post-deploy for any sends using the new key. Or send a manual test email via Resend "Send Email" UI feature (if available on free tier).
5. **Delete old key — IMMEDIATELY after step 4 verification confirms new key works (per Amendment 6 / Q4 verdict).** Resend dashboard → API Keys → old-key row → Delete.
   - **Timing rationale (per Amendment 6):** same as §5.1.

**Failure recovery (per Amendment 6 tightened):** If new key breaks something AFTER immediate delete: **old key is unrecoverable** (Resend deletes; doesn't disable). Create a THIRD new key in Resend; update Vercel; re-verify. Recovery <15 min.

**Public FROM email `RESEND_FROM_EMAIL`:** NOT rotated. Identity, not a credential.

### §5.3 Cloudflare Turnstile Secret Key

**Vendor docs:** https://developers.cloudflare.com/turnstile/troubleshooting/rotate-secret-key/ (verified 2026-05-17). **Atomic with 2-hour grace.** Settings → Rotate Secret Key. Both keys valid for 2 hours; cannot rotate again during grace window. Auto-invalidates after 2h.

**Procedure (Amendment 6 doesn't apply — vendor-controlled timing):**
1. Cloudflare dashboard → Turnstile → Widgets → the Zugzwang widget → Settings.
2. **Rotate Secret Key**. Capture new secret to operator password manager.
3. Update Vercel env var `TURNSTILE_SECRET_KEY` with new value (Phase A step A5).
4. Verify new secret works in production. Direct Turnstile verification is gated by sign-in flow (currently 415-bugged); substitute: check Turnstile dashboard for any failed challenges using the new secret post-deploy.
5. **No manual disablement step.** Old secret auto-invalidates 2h post-rotation. Vendor-controlled timing — no choice.

**Failure recovery:** if new secret breaks something within the 2h grace, old secret is still valid; revert Vercel `TURNSTILE_SECRET_KEY` to old value. **After 2h, no rollback possible** — re-rotation locked during grace; would need to wait for grace to end before re-rotating.

**Public site key `NEXT_PUBLIC_TURNSTILE_SITE_KEY`:** NOT rotated. Public by design (`NEXT_PUBLIC_` prefix).

### §5.4 `BETTER_AUTH_SECRET` (internal — no vendor)

Generation via `openssl rand -hex 32` (per `.env.example` comment). 64 hex chars.

**Pre-launch session-invalidation note:** rotating `BETTER_AUTH_SECRET` invalidates all existing Better Auth sessions (the secret is the session-cookie HMAC key). Acceptable pre-launch (no real users). Acknowledged in §9 Q3.

**No dual-active concept** — Better Auth uses a single secret. Cutover is atomic at the Vercel redeploy boundary.

### §5.5 `ADMIN_PASSWORD` (internal — no vendor)

Generation via `openssl rand -hex 32`. 64 hex chars.

**No dual-active concept** — ADR-0010 specifies a single static password; cutover is atomic.

**Verification:** A6 admin-login smoke (try old password first, expect failure; then new, expect success).

---

## §6 Subagent / reviewer-call routing summary (CLAUDE.md §5.11, per Amendment 7 pattern-extension)

**Per Amendment 7 (Q5 verdict):** §5.11's invocation policy is **pattern-extended in this PR via `docs/maintenance.md`** to add "credential-rotation / secrets-store cutover work" as a recognized routing class. The kickoff-direction routing is therefore **not a deviation but a documented pattern extension**. See §9 Q5 for exact amendment text landing in `docs/maintenance.md`.

| Reviewer | Phase | When | Tool scope | Briefing | Plan path | Scope |
|---|---|---|---|---|---|---|
| `security-auditor` | Plan-review (post-plan, before execute) | After plan committed to branch (Phase 1 close) | Read, Grep, Glob, Bash (no Edit, no Write) | `.claude/agents/security-auditor.md` | `@docs/plans/SCAFFOLD.13-B.md` | Review plan for: (1) credential-rotation sequencing correctness; (2) Doppler-Vercel integration risk surface (name-collision behavior; Sensitive-flag preservation; Vercel auto-redeploy boundary); (3) plan-level refusal-trigger boundary; (4) pre-verification footprint adequacy. Output: PASS / FAIL / SURPRISE on plan correctness. **No execution authority.** **Round 3:** re-fires post-amendments-9-13 with tightened format prescription per Amendment 13 (no preamble; findings table first). |
| `security-auditor` | Execute close-out | After Phase B B9 smoke, before `gh pr create` | Read, Grep, Glob, Bash (no Edit, no Write) | `.claude/agents/security-auditor.md` | `@docs/plans/SCAFFOLD.13-B.md` | Three surfaces: (1) credential-rotation surface (verify all 5 rotated values reach Vercel runtime; old secrets disabled per IMMEDIATE timing in §5 + §7 per Amendment 6); (2) Doppler-Vercel integration surface (verify `prd` config is sync source; no Vercel-side dashboard drift; Sensitive flag preserved); (3) `/tmp` hygiene re-check + `.env.local` mode 600 + transcript persistence per 13-A SURPRISE 4. Output: PASS / FAIL / SURPRISE. |
| `db-migration-reviewer` | — | NOT invoked | — | — | — | No schema work this stratum |
| `code-reviewer` | — | NOT invoked | — | — | — | No `src/server/` changes |
| `test-writer` | — | NOT invoked | — | — | — | No new business-logic behavior |

**Three required prompt elements per CLAUDE.md §5.11** (enforced in both reviewer-call prompts):
1. Explicit role briefing — `.claude/agents/security-auditor.md` loaded and followed verbatim.
2. Plan path — `@docs/plans/SCAFFOLD.13-B.md`.
3. Tool-scope constraints — "Read, Grep, Glob, Bash only — do not Edit or Write" enforced in prompt body.

**Reviewer output discipline (carry forward 13-A process observation 2):** "Output format: report only, no preamble. No thinking-fragment text at the start of the report. No 'I've completed the review of...' filler — start with findings table." **Per Amendment 13 (round 3): round-2 security-auditor invocation drifted on this — opened with one preamble line. Round-3 re-invocation tightens the prompt instruction (recurrence-watch in §14 + §12 carry-forward).**

**Pattern-extension framing (per Amendment 7):** §5.11's invocation policy is amended in this PR via `docs/maintenance.md` to add "credential rotation / secrets-canonical-store cutover" as a recognized class that routes `security-auditor` at plan-review + execute close-out regardless of literal §1 critical-path file touch. Justification: rotation surfaces affect production auth substrate even without `src/` file changes. The kickoff routing is therefore the **documented pattern**, not a one-off deviation. Future strata that meet this class (testnet credential migration, mainnet rotation, etc.) inherit the routing automatically.

**Pre-PR self-audit per §5.10:** §5.10 is reserved for critical-path PRs per §1; this task is not literal critical-path. Self-audit recommended but not strictly mandated. **Recommendation:** run a light self-audit (walk §2 exit criteria 1–16 line-by-line, PASS/FAIL/SURPRISE) before `gh pr create`, since context is loaded and the audit is cheap.

**Allowlist discipline for Doppler CLI (per Amendment 8 — Q7 verdict):** Dashboard for write-ops (project mint, config mint, secret population, integration enable). **Narrow CLI allowlist for post-hoc state-capture audit backstop only:** `Bash(doppler secrets list)` + `Bash(doppler configs list)`. These are read-only, value-redacting commands (Doppler default redacts unless `--plain` flag). **REJECTED:** `Bash(doppler *)` wildcard form — bypasses the per-subcommand audit envelope (13-A SURPRISE 7 lesson). Actual `.claude/settings.local.json` edit is an operator action at execute-phase A start; gitignored (per §0.4 verification) so does NOT appear in PR diff.

---

## §7 Rollback (per-action; per Amendments 5 + 6 cascade updates; per Q8 RESOLVED in round 2; per Amendment 9 round 3 — B7 row revised + new B6a-smoke row inserted)

| Step | What goes wrong | Rollback procedure | Time to recover |
|---|---|---|---|
| A1 `rm /tmp/scaffold14-env.txt` | n/a (idempotent; only risk is removing the wrong file by typo) | If wrong path typed, no actual harm — `/tmp` files are throwaway. Re-attempt with correct path. | <1 min |
| A2 `chmod 600 .env.local` | Wrong file mode (e.g. `400`) | `chmod 600 .env.local` — re-apply correct mode | <1 min |
| A3 `BETTER_AUTH_SECRET` rotate | New secret breaks Better Auth (Vercel deploy fails or returns 500 on `/sign-in`) | Revert Vercel `BETTER_AUTH_SECRET` to **previous** value (operator password manager keeps old). All sessions still invalidated, but auth functions resume. | <5 min |
| A3 `ADMIN_PASSWORD` rotate | New password breaks admin Server Action login (auth assertion error) | Revert Vercel `ADMIN_PASSWORD` to previous value. | <5 min |
| A4 / §5.1 `GOOGLE_CLIENT_SECRET` (per Amendment 6 tightening) | New secret breaks OAuth | **Before IMMEDIATE disable (between step 4 and step 5):** revert Vercel env var to old secret (still valid); test; if good, proceed. **After IMMEDIATE disable (post-step 6):** re-enable old secret in Cloud Console (Google retains disabled indefinitely); revert Vercel env var. **Recovery <15 min** (vs prior 30 min estimate). |
| A4 / §5.2 `RESEND_API_KEY` (per Amendment 6 tightening) | New key breaks Resend | **Before IMMEDIATE delete (between step 3 and step 4):** revert Vercel env var to old key (still valid); test. **After IMMEDIATE delete (post-step 5):** old key is gone (Resend deletes; doesn't disable). Create a THIRD new key; update Vercel; re-verify. **Recovery <15 min** (vs prior 30 min). |
| A4 / §5.3 `TURNSTILE_SECRET_KEY` | New secret breaks Turnstile within 2h grace | Revert Vercel env var to old secret (still valid in grace). | <5 min |
| A4 / §5.3 `TURNSTILE_SECRET_KEY` | New secret breaks Turnstile AFTER 2h grace | Re-rotate (note: grace blocks re-rotation during the original 2h — only after grace ends). Wait for grace to expire, then rotate again. | up to 2h wait + 5 min rotate |
| **A4.5 `.env.local` content update (per Amendment 11)** | Wrong rotated value pasted into `.env.local` line | Re-open password manager; re-paste correct value; save. No production impact (local-only, gitignored). | <2 min |
| A5 Vercel env-var update | Wrong value pasted into Vercel UI | Edit Vercel env var → paste correct value → save. Auto-redeploy triggers. | <5 min |
| A6 smoke test fails | Auth flow regressed post-rotation | Per per-vendor rollback above. Diagnose which credential is faulty (admin login = `ADMIN_PASSWORD`; participant session = `BETTER_AUTH_SECRET`; OAuth = `GOOGLE_CLIENT_SECRET`; OTP = `RESEND_API_KEY`; CAPTCHA = `TURNSTILE_SECRET_KEY`). | varies |
| **B0 public-search surfaces contradicting pattern (per Amendment 10)** | Community-reported behavior contradicts plan assumption (e.g. "disconnect DOES clear Vercel vars") | B0's own decision gate — re-review §0.4 mitigations against new finding; if contradiction stands, pause Phase B and surface to operator for adjudication before B1. | <30 min decision |
| B2 Doppler project mint | Wrong name typed | Delete Doppler project; re-create with correct name. | <2 min |
| B4 Doppler `prd` populate | Wrong value pasted into Doppler UI | Edit Doppler secret → correct value → save. Integration (not yet enabled — B6 hasn't fired) so no Vercel-side propagation yet. | <2 min |
| B5a non-secret value-match check fails | Doppler `prd` value mismatched for one of 4 non-secret keys | Re-paste from `.env.local`; re-verify; proceed to B5b. | <2 min |
| B5b password-manager backup gap (per Amendment 5; per Q8 RESOLVED sourcing) | Password manager missing canonical value for one of 12 keys | Source from vendor dashboard per B5b table (NOT Vercel reveal per §0.4 row + §0 finding 3). For the 7 unrotated keys: Upstash console / Supabase + password manager / Google Cloud Console / Resend / Cloudflare Turnstile / public deploy URL. For the 5 rotated keys: already in password manager from A3 + A4 capture. | <10 min |
| **B5c clean-slate delete (NEW per Amendment 16)** | Partial delete (e.g. 8 of 12 vars removed when dashboard hiccups) | Retry remaining deletes; re-audit via `vercel env ls production`. If irrecoverable, re-paste deleted vars from B5b backup; abort Phase B; revert to direct-Vercel posture. | <5 min retry; <30 min full revert |
| **B5c clean-slate delete (NEW per Amendment 16)** | Operator triggered deploy during the B5c→B6a-smoke window (deploy fails with `missing env var`) | Cancel in-flight build via Vercel dashboard. Last-built deployment continues serving. Re-attempt B6a integration enable to populate Vercel-side env vars; if still failing, re-paste from B5b backup. **Lesson logged in §14 SURPRISE** for window-discipline drift. | <5 min decide; <15 min recover |
| B6a / B6b integration enable (per Amendment 5 revised + Amendment 16 clean-slate cascade) | Integration fails to authorize (Vercel OAuth flow breaks) OR errors at first sync despite B5c clean-slate | Disconnect Doppler integration from Vercel UI; re-authorize; retry. **Vercel state post-B5c is empty for the 12 keys; if B6a fails irrecoverably, re-populate Vercel directly from B5b backup (vendor dashboards + password manager values; NOT from Vercel reveal per Q8 RESOLVED).** This returns the system to the post-Phase-A direct-Vercel posture; Phase B is abandoned for this attempt. **Target recovery <15 min** (clean-slate state simplifies recovery vs prior "did Vercel keep or lose vars" ambiguity). | <15 min |
| ~~B6 Doppler→Vercel | Initial-sync collision causes Vercel value loss~~ | **STRUCK per Amendment 16 — no collision can occur post-B5c clean-slate.** Replaced by B5c rollback rows above + revised B6a/B6b row. | — |
| **B6a-smoke fails post-B6a sync (per Amendment 9 / Finding 4 resolution; steps 1–3 functional smoke)** | Production degraded post-B6a auto-redeploy (auth flow broken, admin login failing, or `/sign-in` non-200) | **HALT — do NOT enable B6b.** Disconnect Doppler→Vercel Production integration from Vercel UI to halt further sync. Diagnose via Vercel runtime logs + deployment build logs. If rotation values failed to reach runtime correctly, re-populate Vercel env vars from B5b backup. If structural issue (Doppler sync behavior diverges from doc expectations), abandon Phase B (rollback to direct-Vercel posture); document in §14 SURPRISE. Halting at single-integration scope is cheaper than compounding with B6b Preview-degraded state. | <30 min |
| **B6a-smoke step 4 fails — non-Sensitive flag observed on any of 12 keys (NEW per Amendment 18 / WI4 AMBIGUOUS escalation; Q9 PRE-COMMITTED Option (a))** | Doppler-synced vars appear as non-Sensitive / "visible on click" in Vercel (contradicts Doppler default-Sensitive claim) | **HALT B6b. Execute pre-committed Q9 Option (a) abandon** (no in-execute adjudication — web Claude verdict 2026-05-18): disconnect B6a integration via Path A (Doppler-side sync delete, checkbox UNCHECKED per Amendment 17 to retain Vercel-side vars) → re-populate Vercel directly from B5b backup → resume direct-Vercel-Sensitive posture (Phase B aborted). Document substrate downgrade avoidance in §14 SURPRISE. | <30 min per Q9 (a) pre-committed verdict |
| B7 activity-log inspection surfaces sync failure / no webhook confirmation (REVISED per Amendment 9 / Finding 4 resolution) | Doppler→Vercel sync not propagating (activity log shows sync failed, or no Vercel webhook success indicator) | Investigate Doppler integration status; check Vercel webhook activity in Vercel dashboard; consult Doppler docs / support. **Critical decision point:** if sync is structurally broken, abandon Phase B (rollback to direct-Vercel posture), unconvert by deleting Doppler integration in Vercel; document failure in §14 SURPRISE; revisit in later stratum. | <30 min decision; full rollback ~1h |
| B8 redeploy not observed for B6a or B6b sync (cascade per round-3 B8 alignment) | Doppler→Vercel auto-redeploy claim doesn't hold; sync logged + webhook OK but no Vercel redeploy | Trigger manual redeploy via Vercel dashboard → Deployments → Redeploy → "use existing build cache". Document divergence in §14 SURPRISE (auto-redeploy behavior). | <10 min |
| B9 final smoke test fails | Doppler-mediated values don't reach Vercel runtime correctly | Disable Doppler integration; rely on B5b vendor-dashboard + password-manager backup to re-populate Vercel directly if needed (per Amendment 5 + Q8 RESOLVED — Vercel's env vars MAY or MAY NOT persist on integration-disable; backup is the rollback substrate regardless). Re-test. If still broken, root-cause from runtime logs. | <30 min |

**General Phase A→B revert (per Amendment 5 revised + Q8 RESOLVED + Amendment 17 two-path documentation):** at any point in Phase B, if Doppler proves unworkable, disable the Doppler→Vercel integration. **Behavior is documented per §0.4 row (Amendment 17): Path A (Doppler-side sync delete) → operator-controlled "Delete all secrets in Vercel" checkbox; Path B (Vercel-side uninstall / REST API) → auto-removes env vars.** B5b vendor-dashboard + password-manager backup is the rollback substrate regardless of path chosen. **Operator preference:** Path A with checkbox UNCHECKED is the lowest-disruption disconnect (vars retained on Vercel, only the sync mechanism removed; production unaffected). **If Path A checkbox checked OR Path B used → re-populate Vercel from B5b backup.**

**Old-secret retention summary (per Amendment 6):**
- Google: disabled secrets retained indefinitely in Cloud Console; re-enable possible. IMMEDIATE disablement post-verification.
- Resend: deleted keys are GONE (no re-enable; create third new key on rollback). IMMEDIATE deletion post-verification.
- Turnstile: auto-invalidated 2h post-rotation; vendor-controlled.

---

## §8 Verification (smoke tests + propagation spot-checks)

### §8.1 Phase A verification (post-A6)

1. **Build smoke**: Vercel auto-redeploy completes successfully (no build errors). Capture build ID for §14.
2. **`/sign-in` 200**: `curl -I https://experiment-zugzwang-worlds-projects.vercel.app/sign-in` returns `HTTP/2 200`.
3. **Admin login**: Admin Server Action accepts new `ADMIN_PASSWORD`; rejects old. (Operator browser-side; not automatable from CLI without exposing the password.)
4. **Better Auth `/api/auth/session` smoke (per Amendment 3, if A6-1 found admin auth DECOUPLED):** `curl -I .../api/auth/session` returns 200.
5. **`.env.local` content (per Amendment 11 / A4.5):** 5 rotated values updated in `.env.local`; mode 600 preserved; not in PR diff (gitignored).
6. **`vercel env ls production` post-Phase-A**: 12 keys, all Encrypted; the 5 rotated keys show recent "X minutes ago" timing.
7. **No regression**: SCAFFOLD.3-FOLLOWUP-1 (415 on OTP POST) reproduces — confirming the rotation didn't introduce new regressions on top of the known bug.

### §8.2 Phase B verification (post-B9; renumbered per Amendment 9 / Finding 4 resolution insertion of B6a-smoke item; further renumbered per Amendment 16 insertion of B5c verification item)

1. **Doppler project state**: dashboard shows `zugzwang-experiment` with `dev` (12 key names, placeholder values per Amendment 4) + `prd` (12 keys with real values), `stg` deleted.
2. **B5c clean-slate verified pre-B6a (NEW per Amendment 16):** `vercel env ls production` immediately before B6a integration enable shows 0 of the 12 keys present in §0.2 inventory. Snapshot captured for §14.
3. **B6a-smoke gate passed before B6b enable (per Amendment 9 step a + Amendment 18 step 4):** abbreviated A6 smoke against Production (`/sign-in` 200; admin login with rotated `ADMIN_PASSWORD`; `/api/auth/session` 200 if DECOUPLED) AND `vercel env ls production` shows all 12 keys with `Encrypted` flag literal-value (Amendment 18 / WI4 AMBIGUOUS resolution); HALT-and-execute-Q9-(a)-rollback per §9 Q9 not triggered (no in-execute adjudication; pre-committed verdict).
4. **2 Vercel integrations**: Doppler `prd` → Vercel Production active; Doppler `prd` → Vercel Preview active.
5. **B5a non-secret value-match check (per Amendment 1):** for `GOOGLE_CLIENT_ID`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `BETTER_AUTH_URL`, Doppler `prd` values matched `.env.local` (eyeballed pre-B6).
6. **B5b password-manager backup (per Q8 RESOLVED sourcing):** all 12 keys present in password manager via vendor-dashboard + rotation-capture sourcing (NOT Vercel reveal); rollback substrate ready.
7. **Activity-log inspection (REVISED per Amendment 9 / Finding 4 resolution; replaces probe-key spot-check):** Doppler `prd` Activity tab shows 2 sync events from B6a + B6b initial syncs (12 keys each to Production + Preview) with Vercel webhook success indicators per sync. `vercel env ls production` cross-reference consistent with sync timestamps. No production redeploys triggered for verification purposes.
8. **B8 redeploy observation:** Vercel Deployments tab shows 2 redeploys (1 Production from B6a, 1 Preview from B6b) completed successfully. Build IDs captured for §14.
9. **Final smoke**: same as §8.1 items 2 + 3 + 4 (Better Auth `/api/auth/session` if DECOUPLED), but post-Doppler cutover.
10. **`vercel env ls production` post-Phase-B**: 12 keys, all **Encrypted** (Sensitive flag literal-value assertion per Amendment 12 / Finding 7; **strengthened to FIRST-fire-at-B6a-smoke per Amendment 18 / WI4 AMBIGUOUS resolution — not just post-B9**). Cross-reference §0.4 NEW Amendment-18 row + §4 B6a-smoke step 4 + §9 Q9 (PRE-COMMITTED Option (a) abandon; B6a-smoke step 4 is the trigger). Note: Vercel may show "X minutes ago" for some keys reflecting last Doppler sync; timing-recency is informational, not load-bearing.

### §8.3 `just verify` (baseline; no `src/` changes but discipline-mandated per AGENTS.md §11)

```
pnpm tsc --noEmit         # exit 0
pnpm biome check .        # zero fixes
pnpm vitest run           # 133 pass + 5 todo (per 13-A baseline); no regressions
```

**Why run vitest despite no `src/` changes:** discipline. Catches accidental config/import drift (e.g. if `.env.example` shape change ever feeds into test setup).

---

## §9 Open questions (for plan-review)

8 numbered items at re-emit round 4 close: 4 RESOLVED in round 1 (Q4 / Q5 / Q7) + round 2 (Q8) + 2 RESOLVED in round 3 (Q2 / Q3) = 6 RESOLVED total + 1 unresolved-mitigated (Q1) + 1 unresolved-low-risk (Q6). **No Q9 surfaced from round-3 cascade analysis or round-4 micro-touch (see §15 cascade-emergent check).**

### Q1 — Doppler→Vercel name-collision behavior on initial sync — **UNRESOLVED-MITIGATED; mitigation REPLACED in Round 5 / Amendment 16**

- **Q:** When Doppler enables sync to Vercel Production at B6a, what does Doppler do for the 12 env vars Vercel already has with matching names? (Overwrite? Skip? Warn? Error?) Doppler docs at https://docs.doppler.com/docs/vercel do not specify (per §0.4 pre-verification).
- **Candidate (pre-amendment):** Doppler likely overwrites. ~~Mitigation chosen: byte-identical values make collision behavior value-neutral.~~ **REFUTED by B0 pre-flight (2026-05-18, per Amendment 10).**
- **B0 finding (CONTRADICTED per yield report 2026-05-18):** Vercel REJECTS sync writes on name-collision with manually-added or other-integration-owned env vars. Sources: Doppler support article 12963214278427 ("Error syncing secrets to Vercel" — verbatim: *"Vercel throws an error rather than allowing this to be overwritten"*) + Doppler community thread 1940 (staff Ryan Hanson confirmation). The "value-match mitigation" was invalid against the error-on-conflict branch.
- **Mitigation REPLACED (per Amendment 16):** new B5c step (between B5b and B6a) deletes the 12 manually-added Vercel env vars before B6a integration enable. Doppler writes fresh vars at first sync; no collision possible. Operator-side window discipline: no deploys between B5c and B6a-smoke pass (~5-min target). B5b backup is the recovery substrate.
- **Status:** UNRESOLVED-MITIGATED with replaced mitigation. **Re-RESOLVED via Amendment 16's structural clean-slate, not via value-match.**
- **Resolve with:** Web Claude ratification of Amendment 16 mitigation shape (ratified 2026-05-18); security-auditor review of B5c window discipline + cascade impact (Phase 3 fire).

### Q2 — Vercel target environments (Production-only vs Production + Preview) — **RESOLVED (Round 3)**

- **Q:** Should Doppler `prd` sync to Vercel **Production only**, or to **Production + Preview**? Current state ships a single grouped entry covering both (per 13-A §0 finding 4); the two integrations B6a + B6b mirror that.
- **Candidate:** Production + Preview (2 integrations, both from `prd`). Mirrors current state; uses 2 of 5 free-tier sync slots; matches operator's existing posture from 13-A.
- **Resolve with:** Web Claude re-review confirm. Alternative is Production-only with Preview operationally orphaned (Preview deploys would have NO env vars unless populated separately) — this is a regression from current state.
- **Verdict (web Claude plan-review, round 3):** **Production + Preview** (2 integrations, both from `prd`). Justification matches plan candidate: mirrors current state per 13-A §0 finding 4, uses 2 of 5 free-tier sync slots, alternative would orphan Preview deploys with no offsetting benefit. **Status:** RESOLVED.

### Q3 — Pre-launch session-invalidation acceptance for `BETTER_AUTH_SECRET` — **RESOLVED (Round 3)**

- **Q:** Rotating `BETTER_AUTH_SECRET` invalidates all existing Better Auth sessions. Pre-launch, this is academic (no real users). Is the project-wide "no impact" position correct, or should we surface a follow-up "post-rotation session-restore drill" task?
- **Candidate:** No impact pre-launch. Acknowledge + move on. No follow-up task needed.
- **Resolve with:** Web Claude re-review confirm. Cross-reference with 2026-09-15 launch readiness criteria.
- **Verdict (web Claude plan-review, round 3):** **No impact pre-launch; no follow-up task needed.** Zero real users + zero authenticated sessions in production state; A10 first-smoke failed at Content-Type validation before any session was created — nothing to invalidate. Post-rotation session-restore drill is a testnet-phase concern (when real sessions exist); not minted as experiment-phase follow-up. **Status:** RESOLVED.

### Q4 — Per-vendor old-secret disablement timing — **RESOLVED (Amendment 6 / Round 1)**

- **Q (original):** After Vercel cutover to new secret in Phase A, when to disable old secret for Google + Resend? (24h dual-active vs immediate vs 7d?)
- **Verdict (web Claude plan-review, round 1):** **IMMEDIATE disablement for Google + Resend** (no 24h window). Threat model post-/tmp-exposure does not tolerate 24h dual-active window. Pre-launch breakage surface is near-zero. Turnstile auto-invalidates at 2h grace (vendor-controlled; unchanged).
- **Plan adjustments applied:** §5.1 step 6, §5.2 step 5, §2 #10, §7 rollback rows for §5.1 + §5.2 tightened (<15 min recovery). **Tracker MAINT-row at 2026-05-18 IST is DROPPED (not minted).**
- **Status:** RESOLVED.

### Q5 — Reviewer-call invocation policy deviation (security-auditor) — **RESOLVED (Amendment 7 / Round 1)**

- **Q (original):** §5.11's invocation policy routes `security-auditor` "after code-reviewer passes on critical-path PRs." This task is NOT literal critical-path. Kickoff overrides with "security-auditor at plan-review + at execute close-out." Accept deviation or pattern-amend §5.11?
- **Verdict (web Claude plan-review, round 1):** **Pattern-amend §5.11 in-PR via `docs/maintenance.md`** (not one-off deviation). Codifies routing for future secrets-management strata (testnet, mainnet) — cheaper than re-litigating.
- **Plan adjustments applied:** §1.3 adds `docs/maintenance.md` (MODIFIED); §6 deviation note revised to "pattern extension, not deviation."
- **Exact amendment text for `docs/maintenance.md`** (to be appended as a new sub-section after "Anti-patterns" and before "Closing ritual for every task chat"):

````markdown
## Routing extensions to CLAUDE.md §5.11

`CLAUDE.md §5.11`'s reviewer-call invocation policy is a per-class
routing table (schema → `db-migration-reviewer`, server → `code-reviewer`,
critical-path business logic → `security-auditor`, new business-logic →
`test-writer`). This sub-section enumerates ADDITIONAL recognized classes
that route to a reviewer regardless of literal §1 critical-path file
touch. The classes accumulate as the project encounters them; each entry
names the class, the reviewer, when it fires, and a one-line
justification.

| Class | Reviewer | Phases fired | Justification |
|---|---|---|---|
| Credential rotation / secrets-store cutover | `security-auditor` | Plan-review + execute close-out | Rotation surfaces affect production auth substrate even without `src/` file changes; cutover changes the secrets-store substrate. First recognized at SCAFFOLD.13-B (2026-05-17). |

Future strata that meet a listed class inherit the routing automatically.
New classes are added to the table at the stratum that first surfaces
them — same PR, not as a follow-up.
````

- **Status:** RESOLVED.

### Q6 — `.env.example` drift fix scope — **UNRESOLVED (low-risk)**

- **Q:** §1.3 lists `.env.example` line 3 update. Are there any other stale references to update?
- **Candidate:** Re-read `.env.example` at execute phase A start; update any references to "Doppler integration is deferred" or "wired directly in Vercel" — replace with canonical-Doppler-source language. Scope <2h per CLAUDE.md §7 cleanup absorption rule.
- **Resolve with:** Execute-phase A reading; no plan-review input needed. Surface in §14 if additional drift surfaces.

### Q7 — `Bash(doppler *)` permission allowlist — **RESOLVED (Amendment 8 / Round 1)**

- **Q (original):** Should Claude Code allowlist `Bash(doppler *)` wildcard for CLI access, or keep all Doppler work dashboard-side?
- **Verdict (web Claude plan-review, round 1):** **Dashboard for write-ops; narrow CLI allowlist for post-hoc state-capture audit backstop only.** REJECTED: `Bash(doppler *)` wildcard (13-A SURPRISE 7 lesson — wildcards bypass per-subcommand audit envelope). Approved narrow allowlist entries: `Bash(doppler secrets list)` + `Bash(doppler configs list)` — read-only, value-redacting (Doppler defaults to redact unless `--plain` flag).
- **Plan adjustments applied:** §6 allowlist discipline paragraph; §12 carry-forward item 3 aligned. Actual `.claude/settings.local.json` edit is operator action at execute-phase A start; gitignored, not in PR diff.
- **Status:** RESOLVED.

### Q8 — Amendment 5's B5b mechanism contradicts Vercel Sensitive-flag behavior — **RESOLVED (Round 2)**

- **Q (cascade-emergent in round 1 re-emit):** Amendment 5's B5b prescribed "For the 7 unrotated keys, capture current Vercel values to password manager via dashboard reveal (Vercel UI shows Sensitive values on click → reveal → copy)." Per 13-A §0 finding 3 root cause + Vercel platform-security convention, Sensitive-flagged values are write-once-read-never from BOTH CLI AND dashboard. Eleven of twelve keys are Sensitive. B5b's "dashboard reveal → copy" sourcing was structurally infeasible.
- **Verdict (web Claude plan-review, round 2):** **ACCEPT corrected sourcing.** Web Claude's original Amendment 5 mechanism was wrong — it conflated Vercel's "key exists, masked indicator" UI state with revealability. The Sensitive value cannot be retrieved post-creation from either CLI or dashboard. Corrected sourcing per the candidate in round 1 re-emit:
  - 5 rotated keys (A3/A4): operator password manager (already captured).
  - `DATABASE_URL`: operator password manager (captured during 13-A rotation, 2026-05-17).
  - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`: Upstash console (vendor allows value reveal in dashboard).
  - `GOOGLE_CLIENT_ID`: Google Cloud Console (vendor allows reveal; also semi-public).
  - `RESEND_FROM_EMAIL`: Resend dashboard (an email address, public).
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: Cloudflare Turnstile dashboard (public by `NEXT_PUBLIC_` prefix; safe to copy from `.env.local` also).
  - `BETTER_AUTH_URL`: known constant `https://experiment-zugzwang-worlds-projects.vercel.app`.
- **Plan adjustments applied (round 2):** §4 B5b prose mechanism replaced (Vercel reveal removed; vendor-dashboard + password-manager sourcing inlined with per-key table); §0.4 row "Vercel Sensitive-flag readability from dashboard" finalized as VERIFIED write-once-read-never; §1.1 + §4 B4 sourcing language firmed (caveats removed); §7 rollback table B6 rows confirm corrected sourcing carries through; §8.2 #4 firmed; §14 SURPRISE category-headers append meta-finding entry.
- **Meta-lesson preserved (per kickoff direction):** **web Claude's Amendment 5 misstated the mechanism; CC §5.10-style discipline (pending-verdict caveat in round 1 re-emit) caught it before commit. Pattern: Vercel Sensitive flag is write-once-read-never from BOTH CLI AND dashboard, not just CLI.** Round 2 carries forward a symmetric pre-verification rule (§0.4 paragraph after the table): web Claude prescriptions touching vendor UI mechanics must be pre-verified by CC against vendor docs before plan-mode applies them — symmetric to §0.4 pre-verification rule applied to CC.
- **Status:** RESOLVED.

### Q9 — Doppler→Vercel Sensitive-flag propagation: abandon-or-accept decision if execute-phase verifies non-Sensitive — **PRE-COMMITTED RESOLUTION: Option (a) abandon (web Claude verdict 2026-05-18, Round 5 scratch review)**

- **Q (cascade-emergent in Round 5 / Amendment 18):** WI4 mini pre-verification (2026-05-18) surfaced AMBIGUOUS Sensitive-flag propagation. Doppler docs claim default Sensitive; Vercel community thread 38766 (posted 2026-04-20) reports operator-observed non-Sensitive ("visible on click") on synced vars, with Vercel staff Jacob Paris acknowledging per-integration Sensitive support is in-progress. Q9-pre-flight (2026-05-18) confirmed STILL OPEN — no dated changelog evidence of resolution between 2026-04-20 and 2026-05-18. Execute-phase B6a-smoke step 4 (per Amendment 18) is the disambiguation surface. **If step 4 fails (any of 12 keys non-Sensitive), what's the plan?**
- **Option (a) — Abandon Doppler-canonical (PRE-COMMITTED VERDICT):** Disconnect B6a integration via Path A (Doppler-side sync delete, checkbox unchecked per Amendment 17 to retain Vercel-side vars) → re-populate Vercel directly from B5b backup → resume direct-Vercel-Sensitive posture. Phase B aborted for this attempt; defer Doppler integration to a later stratum once Vercel's per-integration Sensitive support lands (no ETA per Vercel staff). **Cost:** ~30 min revert; loses Doppler-canonical automation benefit (Doppler-side canonical storage preserved; only the Doppler→Vercel sync workflow regresses, recoverable at testnet phase once Vercel's per-integration Sensitive support GAs).
- **Option (b) — REJECTED:** Accept non-Sensitive on Vercel side as the cost of Doppler-canonical workflow. Trades Vercel-side Sensitive (write-once-read-never per §0.3 / §0 finding 3 from 13-A) for Doppler-side Sensitive on canonical store + Vercel-side visible-on-click. **Security delta:** Vercel-side vars become readable via `vercel env pull` (CLI-readable). This is a SUBSTRATE DOWNGRADE relative to current direct-Vercel-Sensitive state. **Rejected** per the four-point rationale below.
- **Threat-model amplification (post-2026-04-19 Vercel breach; per §0.4 Condition-1 footnote):** the April 2026 Vercel security incident (https://vercel.com/kb/bulletin/vercel-april-2026-security-incident) confirmed non-Sensitive environment variables as the load-bearing exfiltration surface in a documented production breach. Vercel KB verbatim: *"the investigation confirmed that no sensitive environment variables or npm packages were compromised."* This shifts the Sensitive-flag verification from a substrate-quality check to a thesis-level security control. Q9 (a) abandon recommendation is correspondingly load-bearing post-breach, not advisory.
- **Status:** **PRE-COMMITTED RESOLUTION — Option (a) abandon Doppler-canonical if B6a-smoke step 4 fails.** Web Claude verdict ratified 2026-05-18 at Round 5 scratch review. No in-execute adjudication required; B6a-smoke step 4 failure triggers immediate execution of Option (a) rollback per §7 (Doppler-side Path A disconnect, checkbox unchecked → restore from B5b backup → resume direct-Vercel-Sensitive posture).
- **Rationale (web Claude four-point):**
  1. **Thesis alignment** — SCAFFOLD.13-B exists to reduce exfiltration surface; Option (b) accepts an exfiltration surface exploited in the wild during the April 2026 Vercel breach.
  2. **Asymmetric reversibility** — Option (a) costs ~30 min revert; Option (b) inherits a security downgrade into testnet + mainnet.
  3. **Post-breach industry posture** — Vercel's own post-incident guidance is to use Sensitive flag for credentials going forward; Option (b) operates against vendor-published guidance in a documented threat model.
  4. **Doppler-canonical strategic benefit survives (a)** — Doppler-side canonical storage preserved; only the automation workflow regresses, recoverable at testnet phase once Vercel's per-integration Sensitive support GAs.

### Q-residuals — security-auditor round-4 LOWs accepted as residual (Round 4 close)

Three LOW findings from round-4 re-audit accepted without amendment:

- **F6 (B6a-smoke runtime-boot coverage):** Existing B6a-smoke step 2 (admin Server Action login with rotated `ADMIN_PASSWORD`) exercises production runtime via real auth flow — covers the "deployed values boot correctly" surface beyond auditor's recommended `/api/health` ping. Resend + Turnstile typo paths covered by §5.2 + §5.3 dashboard-side verification. No amendment needed.

- **F7 (B0 PASS/INCONCLUSIVE distinction):** B0 prose already implicitly encodes this distinction (positive-pattern branch → §0.4 + §14; no-pattern branch → status quo + B5b substrate). Wording-only tightening not justified given cumulative iteration overhead. Operator applies PASS/INCONCLUSIVE mental model during B0 execution.

- **F8 (A4.5 post-update verification):** Silent local-prod divergence surfaces on next dev-server boot regardless. Accepted residual cost (≤1 debugging session). Cheap verification (`grep -c '=' .env.local` count check) defensibly applied at execute-phase if operator chooses, but not amended into plan.

**Verdict:** residuals do not block execution. Documented per CLAUDE.md §5.10 self-audit pattern.

---

## §10 ADRs needed

**None.** This stratum is operational, not architectural:
- No vendor commitment beyond what's already locked in AGENTS.md §1 (Vercel) or 13-A (Supabase) — Doppler is added as a tooling vendor for secrets management, but it doesn't change auth/data/runtime architecture. Defensible as a tooling-choice ADR if reviewer disagrees; surface as Q-extension if needed.
- No CLAUDE.md §10 defaults changed.
- No pattern other code copies (credential rotation is a one-time procedure, not a recurring pattern in `src/`).

If plan-review judges Doppler vendor-commitment warrants an ADR ("we commit to Doppler for secrets management; reversal is non-trivial"), mint `docs/adr/0017-doppler-secrets-management.md` in same commit per CLAUDE.md §5.12. Currently judged not-ADR-worthy.

---

## §11 Pre-PR self-audit checklist (recommended; not strictly mandated per §5.10; grown to 21 items in round 5 per Amendments 9 + 10 + 11 + 16)

| # | Item | Plan reference | Status |
|---|---|---|---|
| 1 | `/tmp/scaffold14-env.txt` + `/private/tmp/scaffold14-env.txt` removed | §2 #2 + A1 | ⏳ |
| 2 | `.env.local` mode 600 | §2 #3 + A2 | ⏳ |
| 3 | All 5 rotated values reach Vercel runtime (smoke A6 + B9; includes Better Auth `/api/auth/session` if DECOUPLED) | §2 #1 + §2 #5 + §2 #9 | ⏳ |
| 4 | Doppler project `zugzwang-experiment` exists with `dev` + `prd` (no `stg`) | §2 #6 + B2 + B3 | ⏳ |
| 5 | Doppler `prd` has 12 keys matching §0.2 inventory (copy-paste discipline; Amendment 1; sourcing per Q8 RESOLVED) | §2 #6 + B4 | ⏳ |
| 6 | **Doppler `dev` has same 12-key NAMES (placeholder values acceptable per Amendment 4)** | B5 | ⏳ |
| 7 | 2 Doppler→Vercel integrations active (Production + Preview), Sensitive flag preserved | §2 #7 + B6 | ⏳ |
| 8 | **Activity-log inspection passes (B6a + B6b sync events logged with Vercel webhook success indicators; no production redeploys triggered for verification) (REVISED per Amendment 9 / Finding 4 resolution; was probe-key spot-check in round 2)** | §2 #8 + B7 | ⏳ |
| 9 | **Per-vendor old-secret disablement performed IN-SESSION per Amendment 6 (Google + Resend IMMEDIATE; Turnstile auto)** | §2 #10 + §5 + §9 Q4 | ⏳ |
| 10 | `.env.example` drift fix landed | §2 #11 + §1.3 | ⏳ |
| 11 | `docs/logs/SCAFFOLD.13-B.md` written before `gh pr create` (six-field per §5.9 + §14 SURPRISE entries) | §2 #12 | ⏳ |
| 12 | `security-auditor` reviewer call at plan-review (PASS surface) + execute close-out (PASS surface) | §2 #13 + §6 | ⏳ |
| 13 | `just verify` (tsc + biome + vitest) exit 0 | §2 #14 + §8.3 | ⏳ |
| 14 | No `src/`, `drizzle/migrations/`, `supabase/migrations/`, `tests/`, `docs/specs/`, `docs/adr/` files touched in PR diff | §1.3 forbidden surfaces | ⏳ |
| 15 | **`docs/maintenance.md` "Routing extensions to CLAUDE.md §5.11" sub-section landed per Amendment 7 / §9 Q5 exact text** | §2 #15 + §1.3 + §9 Q5 | ⏳ |
| 16 | **B5a non-secret value-match check passed pre-B6 (4 keys eyeball-compared) per Amendment 1** | §4 B5a + §8.2 | ⏳ |
| 17 | **B5b password-manager backup complete with Q8 RESOLVED sourcing (12 keys via vendor dashboards + password manager; not Vercel reveal)** per Amendment 5 + Q8 RESOLVED | §4 B5b + §8.2 + §9 Q8 | ⏳ |
| 18 | **B0 pre-flight executed per Amendment 10 (Finding 6c resolution): public-search across Doppler community / GitHub / changelog / Stack Overflow for 3 undocumented behaviors; findings logged to §0.4 update or §14 SURPRISE; decision gate honored before B1** | §2 #16 + §4 B0 + §0.4 (new row) | ⏳ |
| 19 | **`.env.local` updated with 5 rotated values at A4.5 per Amendment 11 (Finding 8 resolution): local-dev parity; mode 600 preserved; not in PR diff** | §3 A4.5 + §1.3 | ⏳ |
| 20 | **B6a-smoke gate passed pre-B6b per Amendment 9 + Amendment 18 (extended): (a) abbreviated A6 against Production after B6a sync + auto-redeploy (steps 1–3); (b) explicit `vercel env ls production` literal-value assertion that all 12 keys show `Encrypted` flag (step 4; WI4 AMBIGUOUS resolution); HALT-and-execute-Q9-(a)-rollback per §9 Q9 if step-4 fails (no in-execute adjudication; pre-committed verdict)** | §4 B6a-smoke + §8.2 #10 + §9 Q9 | ⏳ |
| 21 | **B5c clean-slate delete completed pre-B6a per Amendment 16 (Round 5 / B0 Behavior-(a) CONTRADICTED resolution):** all 12 manually-added Vercel env vars deleted (Production + Preview); `vercel env ls production` post-B5c shows 0 of 12; window discipline observed (no deploy triggered B5c → B6a-smoke); B6a integration enable succeeded without collision error. | §2 #17 + §4 B5c + §8.2 #2 | ⏳ |

---

## §12 Process observations carried forward from 13-A (carry-forward discipline)

Per kickoff §"Process observations carried forward from 13-A":

1. **Pre-verify tool/vendor capabilities before asserting them as plan procedure.** Honored in §0.4 — pre-verification footprint table captures 16 capabilities verified via vendor docs + prior session findings + execute-phase B0 yield + WI4 mini pre-verification + Q9-pre-flight (15 from rounds 1–3 + 1 new row Sensitive-flag propagation — Amendment 18; 2 rows replaced in-place — collision per Amendment 16 + disconnect per Amendment 17; B0 status row content updated post-execution). Round 2 adds a symmetric pre-verification rule for web-Claude prescriptions touching vendor UI mechanics (per §9 Q8 meta-lesson) — captured as a paragraph after the §0.4 table. **Round 5 confirms the pattern: B0 yield + WI4 + Q9-pre-flight caught CONTRADICTION + AMBIGUOUS BEFORE B1 / B6a fired, where context is loaded and fixes are cheap. The asymmetric leverage of pre-verification at plan-mode / execute-phase pre-flight is now the validated default for Vercel-marketplace integration work.**
2. **Plan-amendment-during-execution is high-overhead; tight plan pre-flight is cheaper.** Honored by front-loading pre-verification + the 7 open questions from initial plan reduced to: 3 unresolved (Q1 mitigated / Q2 / Q3 / Q6 low-risk) + 4 RESOLVED (Q4 / Q5 / Q7 / Q8) via the two-round re-emit cycle + 5 additional amendments (9–13) from round 3 security-auditor adjudication. Q8 itself emerged from round 1's cascade analysis and was RESOLVED in round 2; rounds 3's amendments emerged from security-auditor PASS-with-conditions and were absorbed same-day. Pattern: the multi-round re-emit cycle catches what a single-pass plan would have missed.
3. **Dashboard-side operations leave no audit trail; post-hoc capture (`vercel env ls`, narrow CLI allowlist per Amendment 8) is the minimum backstop.** Honored — A7 closes with `vercel env ls production` capture; B6 + B7 + B9 each capture state. **Per Amendment 8 (Q7 verdict):** Doppler state-capture uses narrow CLI allowlist (`Bash(doppler secrets list)`, `Bash(doppler configs list)`) — read-only, value-redacted by default. Dashboard write-ops remain auditable via post-hoc CLI capture. No wildcard allowlist.
4. **`/tmp` hygiene audit at stratum close (re-check after Phase A).** Honored — A7 re-runs `find /tmp /private/tmp -name '*env*'` post-A1.
5. **Subagent output format discipline (no thinking fragments, no preamble).** Captured in §6 reviewer-call routing notes ("Output format: report only, no preamble").
6. **Reviewer-call format discipline carry-forward (NEW per Amendment 13 / round 3):** reviewer outputs must lead with the findings table, no preamble, no thinking-fragment text. SCAFFOLD.13-B's first security-auditor invocation (round-2 plan-review surface) opened with one line of preamble ("I now have the full picture. Composing the report."). Single occurrence; not yet a pattern. Round-3 re-invocation tightens the prompt instruction; if preamble recurs after the tightened prescription, escalate to `.claude/agents/security-auditor.md` hardening or `docs/maintenance.md` amendment.

---

## §13 References

- `CLAUDE.md` §1 (critical-path list) — this task NOT critical-path under literal directory list; security-auditor routing pattern-extended per Amendment 7 (§9 Q5)
- `CLAUDE.md` §5.1 (plan mode), §5.9 (per-session logs), §5.10 (pre-PR self-audit; not strictly triggered), §5.11 (reviewer-call invocation; pattern-extended via `docs/maintenance.md` in this PR per Amendment 7), §5.12 (ADRs; none needed), §7 (cleanup absorption)
- `AGENTS.md` §1 (stack), §2 (commands; `just verify`), §11 (boundaries — credential rotation respects "Ask first" gates)
- `docs/plans/SCAFFOLD.13-A.md` — predecessor plan; §0.2 inventory sourced from §14 appendix
- `docs/logs/SCAFFOLD.13-A.md` — predecessor log; "Handoff to SCAFFOLD.13-B" section is this plan's literal first-action contract
- `docs/maintenance.md` — pattern-extension target per Amendment 7 (§9 Q5)
- `.env.example` — current 12-key inventory baseline (plus drift-fix touch surface)
- `ADR-0004` (Better Auth) — `BETTER_AUTH_SECRET` rotation operates within ADR-0004's session-cookie boundary
- `ADR-0010` (admin auth static password) — `ADMIN_PASSWORD` rotation operates within ADR-0010's static-password boundary; per Amendment 3, A6-1 reads ADR-0010 + `src/server/auth/` to determine admin/Better-Auth coupling
- `ADR-0015` (idempotency) — Upstash credentials are Doppler-mirrored but NOT rotated (not in 5-leak set)
- Doppler docs: https://docs.doppler.com/docs/vercel + https://www.doppler.com/pricing (verified 2026-05-17 in §0.4)
- Google OAuth client-secret rotation: https://support.google.com/cloud/answer/15549257 (verified 2026-05-17)
- Resend API key handling: https://resend.com/docs/knowledge-base/how-to-handle-api-keys (verified 2026-05-17)
- Cloudflare Turnstile rotate-secret-key: https://developers.cloudflare.com/turnstile/troubleshooting/rotate-secret-key/ (verified 2026-05-17)

---

## §14 Surprises — section header only (populated during execute, not now)

Per CLAUDE.md §5.10 + 13-A pattern: this section is reserved for execute-phase findings. **Populated at log-close (Phase B B9 close → log write → `gh pr create`).** Empty at plan-review time.

**Pre-loaded category headers** (per Amendment 3 + Q8 RESOLVED + §0.4 undocumented items + round 2 meta-finding + round 3 Amendments 9 + 10 + 12 + 13):

- **ADR-0010 admin-auth coupling-to-Better-Auth finding** (per Amendment 3): A6-1 pre-smoke check will determine whether admin Server Action shares `BETTER_AUTH_SECRET` machinery with Better Auth. Either COUPLED or DECOUPLED finding ships as §14 entry.
- **Doppler→Vercel name-collision behavior at B6 initial sync** (per Q1; §0.4 DOCUMENTED post-B0 yield report 2026-05-18; Amendment 16 inserts B5c clean-slate as structural mitigation). **B0 finding (verbatim, Doppler support article 12963214278427):** *"if one of the secrets in the Doppler config you're trying to sync has already been manually added to the Vercel project, Vercel throws an error rather than allowing this to be overwritten."* **Plan resolution:** new B5c step deletes the 12 manually-added Vercel env vars before B6a integration enable. **Execute-phase observation to capture here:** did B6a integration enable succeed without collision error post-B5c clean-slate? Did Vercel's `vercel env ls production` show 0 keys in the B5c→B6a window as planned? Did operator-side window discipline hold (no deploy triggered)?
- **Vercel auto-redeploy behavior on Doppler sync** (observed at B6a + B6b initial syncs per round-3 B8 cascade; per §0.4 search-result claim). Capture build IDs for B6a Production redeploy + B6b Preview redeploy.
- **Doppler→Vercel integration-disable behavior** (per Amendment 5; **§0.4 DOCUMENTED with two-path nuance post-B0 yield report 2026-05-18 / Amendment 17**). **B0 finding:** behavior is documented per disconnect path; Path A (Doppler-side sync delete) presents operator-controlled "Delete all secrets in Vercel" checkbox per community thread 1967; Path B (Vercel-side uninstall / REST API `DELETE /v1/integrations/configuration/{id}`) auto-removes env vars per Vercel REST API doc verbatim. **Execute-phase observation to capture here (only if a rollback actually fires):** which path operator traversed, whether checkbox was checked (Path A), whether vars actually cleared / retained as documented. B5b backup substrate mitigates either path.
- **B5b sourcing actually performed via Q8 RESOLVED strategy** (vendor dashboards + password manager; observed cost + any vendor-side friction points).
- **Per-vendor old-secret disablement actually performed IN-SESSION** (per Amendment 6; if any vendor's verification was inconclusive enough to defer disablement, capture as §14 SURPRISE).
- **Amendment-cycle meta-finding (round 2):** web-Claude prescription error caught by CC plan-mode discipline (Q8 cascade). Web Claude's Amendment 5 mechanism ("Vercel UI shows Sensitive values on click → reveal → copy") was structurally infeasible per 13-A §0 finding 3 root cause — the Sensitive flag is write-once-read-never from BOTH CLI AND dashboard, not CLI-specific. CC's round-1 re-emit surfaced this as Q8 with a candidate corrected mechanism; web Claude accepted in round 2 and the corrected mechanism (vendor-dashboards + password-manager sourcing) landed inline. **Discipline carry-forward: web Claude prescriptions touching vendor UI mechanics must be pre-verified by CC against vendor docs before plan-mode applies them — symmetric to the §0.4 pre-verification rule applied to CC.** Capture this as a `docs/maintenance.md` candidate if the pattern recurs.
- **Sensitive-flag literal-value assertion at B6a-smoke + post-B6 cutover (NEW per Amendment 12 / Finding 7 generalization + STRENGTHENED per Amendment 18 / WI4 AMBIGUOUS):** `vercel env ls production` at B6a-smoke (NEW per Amendment 18 — first-fire, not just post-B9) AND post-Phase-B must show ALL 12 keys with `Encrypted` flag (literal value assertion, not just presence). **WI4 surfaced concrete operator-reports** (Vercel community thread 38766, posted 2026-04-20) of Doppler-synced vars appearing as non-Sensitive / "visible on click" — contradicting Doppler's default-Sensitive doc claim. Q9-pre-flight (2026-05-18) confirmed STILL OPEN — no dated changelog evidence of resolution. **Threat-model amplification** (post-2026-04-19 Vercel breach; per §0.4 Condition-1 footnote): non-Sensitive vars were the load-bearing exfiltration surface in the April 2026 Vercel incident. **Capture here at execute-phase:** observed flag state per key per environment (Production + Preview); whether step-4 of B6a-smoke passed; if Q9 (a) abandon fired (pre-committed verdict per web-Claude 2026-05-18), the recovery path taken and timing.
- **B0 public-search pre-flight findings (NEW per Amendment 10 / Finding 6c):** any community/forum/changelog-reported patterns for (a) initial-sync collision, (b) propagation lag, (c) integration-disconnect behavior — log inline in §0.4 update at execute-phase AND capture as §14 SURPRISE entry. If no patterns found, log "B0 surfaced no community pattern; status quo mitigations retained."
- **Reviewer-call format discipline meta-finding (NEW per Amendment 13 / round 3 recurrence-watch):** first security-auditor invocation (round-2 plan-review surface) opened with one line of preamble ("I now have the full picture. Composing the report.") — violates §6 + 13-A process observation 2 ("output format: report only, no preamble"). Single occurrence at the time; round-3 re-invocation includes tightened prompt prescription per §6 update. If preamble recurs after the tightened prescription in round-3 re-invocation OR at execute close-out invocation, this becomes a pattern signal worth structural fix (`.claude/agents/security-auditor.md` edit or `docs/maintenance.md` amendment). Log in §14 with "preamble observed Y/N" per invocation.

---

## §15 Sign-off

Plan **re-emitted 2026-05-17 round 3** with 5 amendments (9–13) absorbing security-auditor PASS-with-conditions findings inline per web Claude verdict. All round-1 amendments (1–8) + round-2 Q8 cascade-emergent question + round-3 security-auditor adjudication (Amendments 9–13) now applied or RESOLVED.

**Re-emit round 3 deliverables at Phase 1 close (this turn):**
- This file re-emitted at `.claude/scratch-scaffold-13-b-round3.md` (~820 lines full body; not delta; uploaded to web Claude for re-review pass before canonical promotion).
- Amendment log at file head (8 round-1 amendments + Q8 round-2 resolution + 5 round-3 amendments = 14 rows).
- 8 open questions in §9 structurally unchanged: 1 unresolved-mitigated [Q1] + 2 unresolved [Q2 / Q3] + 1 unresolved-low-risk [Q6] + 4 RESOLVED [Q4 / Q5 / Q7 / Q8]. **No Q9 surfaced from round-3 cascade analysis.**
- 14 pre-verifications in §0.4 + symmetric pre-verification rule paragraph for web-Claude prescriptions per Q8 meta-lesson + 1 new row for B0 per Amendment 10.
- §11 self-audit grown from 17 to 20 items (Amendments 9 + 10 + 11 each contribute one new item; Amendment 9 also revises item 8).
- §14 SURPRISE pre-load: 1 entry struck (Doppler→Vercel propagation lag at B7 — moot post-Amendment-9 B7 redesign), 1 entry retained with updated framing (Vercel auto-redeploy now observed at B6a + B6b initial syncs per cascade B8), 3 new entries added (Amendment 10 B0 public-search pre-flight findings — cascade-emergent per Amendment 10's prose mandating "document in §0.4 update AND §14 SURPRISE entry"; Amendment 12 Sensitive-flag literal-value; Amendment 13 reviewer-call format discipline meta-finding). Net: 8 − 1 + 3 = 10 entries.
- `security-auditor` plan-review reviewer re-call to fire next post-amendments — per Amendment 7 pattern-extension + §6 routing + Amendment 13 format-prescription tightening. **Not invoked by Claude Code in plan-mode this turn; operator confirms before reviewer-call invocation per kickoff "DO NOT EXECUTE" boundary.**

**Plan file NOT yet committed to branch this turn** — per kickoff direction, round-3 lands at `.claude/scratch-scaffold-13-b-round3.md` (NOT canonical `docs/plans/SCAFFOLD.13-B.md`) for operator's web-Claude re-review pass. After web-Claude approval of round 3, operator promotes scratch-round3 to canonical and commits to `feat/scaffold-13-b`. After re-audit PASS, operator merges PR #41 and opens fresh execute-phase session at A1.

**Pattern observation (carry-forward to future plans):** the multi-round amendment cycle illustrates that plan-mode discipline benefits from explicit "pending verdict" caveats on web Claude-prescribed mechanisms + a security-auditor plan-review reviewer call BEFORE execute-phase commits. Round 3's amendments (9–13) closed 4 substantive findings (2 MEDIUM + 2 LOW) before any production-credential touch — at plan-mode pre-commit time, where context is loaded and fixes are cheap. This is the §5.10 pre-PR self-audit pattern shifted left to plan-mode — symmetric and even cheaper than per-PR audit.

**Round 5 re-emit (2026-05-18):** execute-phase B0 yield report (per Amendment 10) surfaced one CONTRADICTED behavior (initial-sync collision) + one NEW SURPRISE (disconnect semantics two-path nuance); WI4 mini pre-verification surfaced AMBIGUOUS Sensitive-flag propagation; Q9-pre-flight (~10 min budget) confirmed STILL OPEN with Vercel April 2026 breach as load-bearing threat-model amplification. 4 amendments (16–19) absorb the findings: Amendment 16 (HIGH — new B5c clean-slate step + cascading edits + Q1 mitigation replaced), Amendment 17 (MEDIUM — disconnect framing + B5b re-grounding), Amendment 18 (MEDIUM — B6a-smoke literal-value assertion + Q9 PRE-COMMITTED (a) abandon + Condition-1 breach footnote), Amendment 19 (LOW — housekeeping). **Net: §0.4 15 rows → 16 rows (3 replaced + 1 new Sensitive-flag); §2 16 → 17 criteria; §9 8 → 9 Q-entries (Q9 pre-committed); §11 20 → 21 audit items; §14 10 SURPRISE entries (3 strengthened, no count change).** Round-5 amendments absorbed two web-Claude conditions inline (Condition 1: Vercel breach footnote on §0.4; Condition 2: Q9 pre-commit to Option (a)). Security-auditor fires Phase 3 against amended plan.

**Pattern observation (Round 5 carry-forward):** the execute-phase B0 pre-flight + WI4 + Q9-pre-flight model is the **validated default** for Vercel-marketplace-integration plans — three pre-execute search budgets totaling ~25 min caught one HIGH and one MEDIUM cascading-mitigation issue BEFORE any production-credential touch. Cost-comparison: each finding caught at execute-phase B6 would have cost a partial-rollback (~30 min recovery + re-run from B5b backup); caught at plan-mode it costs an amendment-cycle (~20 min). 4× asymmetric leverage. **Codify in future SCAFFOLD/HARDEN strata that wire Vercel marketplace integrations: B0-style pre-flight is non-optional.**

---

## Round 3 cascade-emergent check

Reviewed for any new inconsistencies surfacing from the round-3 deltas applied above. Tracked items:

1. **B8 prose referenced defunct probe-key from round-2 B7** — cascade-fixed in-plan (B8 now references B6a + B6b initial-sync redeploys, not B7 probe-key). Documented as round-3 cascade-emergent edit in amendment log row 9.
2. **B6a-smoke required its own §7 rollback row** — added in-plan (new row "B6a-smoke fails post-B6a sync"). Documented in amendment log row 9.
3. **B0 did NOT require its own §7 rollback row** — B0's internal decision gate handles the contradiction case; no production-side write happens during B0. Documented as conscious omission.
4. **§8.2 renumber from 7 → 9 items** — Amendment 9 inserted B6a-smoke gate item between #1 and #2; cascade B8 added a redeploy-observation item; Amendment 12 generalized literal-value assertion captured in #9. Renumber applied; downstream §11 item references re-validated.
5. **§11 grown from 17 → 20 items** — Amendments 9 + 10 + 11 each contribute one new item; Amendment 9 also revises item 8. Item numbers 18, 19, 20 are the three new items (B0 pre-flight, A4.5 .env.local, B6a-smoke).
6. **§1.1 propagation row title + substance rewrite** — old row described probe-key approach; new row describes activity-log inspection. Documented in amendment log row 9 (§1.1 in sections-touched).
7. **§3 + §4 phase headers updated** — §3 reflects A4.5 inserted per Amendment 11; §4 reflects B0 + B6a-smoke inserted per Amendments 10 + 9.
8. **§2 exit criterion 8 content replaced** (not renumbered — number stays #8, content swapped). Note: amendment log row 9's column entry "§2 #8 (renumbered)" is slightly imprecise — actual operation is content replacement, not renumber. Preserved user's exact wording per kickoff fidelity; corrected interpretation noted here for future-CC clarity.
9. **§14 pre-load entries** — 1 struck (propagation lag at B7), 1 retained with cascade-aligned framing (auto-redeploy now at B6a + B6b), 3 added (Amendment 10 B0 public-search pre-flight findings — cascade-emergent per Amendment 10's prose mandating "document in §0.4 update AND §14 SURPRISE entry"; Amendment 12 Sensitive-flag; Amendment 13 reviewer-call format discipline). Total entries before round 3: 8. After round 3: 10 (8 − 1 + 3 = 10). Reconciled. Note: Amendment 10's amendment-log row lists sections "§0.4 (new row), §2 #16 (new), §4 B0 (new), §11" but its prose also touches §14 via the B0 capture rule; surfacing the B0 §14 entry as a cascade-emergent edit per Amendment 10's prose.
10. **§12 process observations** — item 6 added per Amendment 13.

**Verdict:** no new cascade-emergent open questions surfaced. **Round 3 closes coherently.** All cascade-emergent edits are implementation details of Amendments 9–13 (or, in the case of item 8 above, a minor wording-precision note carried in this cascade check rather than amended away from the user's verbatim Amendment-9 description).

---

## Round 5 cascade-emergent check

Reviewed for any new inconsistencies surfacing from Amendments 16–19:

1. **§4 B4 line "irrelevant — converges to correct" prose** — struck-and-replaced in Amendment 16. Replacement prose cites Amendment 16 + B0 yield. No remaining references to the old framing in §0.4, §1.1, §7, §9 Q1, or §14.
2. **§2 exit criterion renumber** — new criterion #17 (B5c) appended; criteria #1–#16 unchanged. §11 item references untouched (item #21 is new and cross-references #17 + §4 B5c + §8.2 #2).
3. **§8.2 item renumber** — new item inserted at position 2 (B5c clean-slate verification); old items 2–9 renumbered to 3–10. §11 item #20 cross-reference updated to "§8.2 #10"; item #21 references "§8.2 #2".
4. **§7 rollback table — strike vs replace for B6 row** — chose strike-with-replacement-pointer per audit-trail readability convention (web Claude saw the old row in earlier rounds). The struck row remains visible with `~~strike~~` markup and a pointer to the replacement rows above.
5. **§11 grows 20 → 21** — item #21 added. Header count updated 20 → 21. Documented in Amendment 19.
6. **§9 grows 8 → 9 Q-entries** — Q9 added with PRE-COMMITTED RESOLUTION (Option (a) abandon) per Condition-2 web-Claude verdict 2026-05-18. Q1 status updated (UNRESOLVED-MITIGATED with replaced mitigation) per Amendment 16. Q-residuals (Q2–Q8) untouched.
7. **§14 SURPRISE pre-load** — Amendment 16 + 17 + 18 each strengthen existing pre-load entries with B0 / WI4 / Q9-pre-flight finding text. Net count unchanged at 10 entries.
8. **B5c window discipline operator-side constraint** — no `git push` to deploy-wired branches between B5c-complete and B6a-smoke-pass. Cross-impact: ensures no Vercel auto-deploy fires in the empty-env-var window. This is an **operator-discipline constraint**, not a code/config constraint. Cannot be enforced via CI / hooks at the Vercel level. Documented in B5c prose + §7 rollback row (window-discipline drift recovery).
9. **B5b backup substrate motivation re-grounded** — Amendment 17 strengthens via documented two-path behavior; Amendment 16 retains the same substrate as recovery for B5c clean-slate failures. No conflict; the substrate now load-bears for three distinct rollback paths (clean-slate failure + integration-disconnect rollback + Q9 (a) abandon).
10. **Q9 escalation — substrate-shaping decision PRE-COMMITTED** — Q9 explicitly resolved at plan-mode by web-Claude verdict, NOT deferred to in-execute adjudication. This is the SAME pattern as Q8 RESOLVED in round 2 (web-Claude prescription touching vendor mechanics, pre-verified by CC and adjudicated at plan-review). **Pattern strengthening: substrate-shaping decisions land at plan-review with execute-phase trigger conditions, not in-execute adjudication under degraded-production pressure.**
11. **§0.4 Condition-1 footnote placement** — chose post-table italic blockquote rather than table-cell continuation (markdown blockquotes don't render inside table cells); the new Sensitive-flag row's third cell carries a "see post-table footnote" pointer to the blockquote. Footnote is anchored before the "Symmetric pre-verification rule" paragraph for visual proximity to the §0.4 table.
12. **Amendment-log row count** — 16 rows pre-Round-5; +4 new rows (16–19) = 20 amendment-log rows total. Q8 row at position 9 (alphanumeric, not sequential) preserved as-is per existing convention.

**Verdict:** no new cascade-emergent open questions surfaced. **Round 5 closes coherently.** All cascade-emergent edits are implementation details of Amendments 16–19 (or, in items 4 + 11 above, conscious typographic / strike-vs-replace choices documented for future-CC clarity).

---

*Round 5 amendment delta applied to canonical plan 2026-05-18 per operator + web-Claude ratification. Security-auditor fires Phase 3 against this state; PR opens Phase 4 after auditor PASS clean.*

