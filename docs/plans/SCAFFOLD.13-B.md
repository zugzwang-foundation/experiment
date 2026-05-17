# SCAFFOLD.13-B — Plan: 5-vendor credential rotation + Doppler as canonical secrets store

**Task ID:** `SCAFFOLD.13-B` (Stratum B of SCAFFOLD.13; Stratum A closed at PR #40 / commit `7167397`)
**Branch (Phase 2):** `feat/scaffold-13-b` (off `main` at the post-merge SHA of SCAFFOLD.13-A: `7167397`)
**Predecessors on `main`:** SCAFFOLD.13-A @ `7167397`, tracker-sweep-v9 @ `82bee48`
**Critical path:** NO under CLAUDE.md §1's literal directory list (no `src/server/auth/`, `src/db/schema/`, or `drizzle/migrations/` files touched). **Treated as security-sensitive anyway** — kickoff mandates `security-auditor` reviewer calls at plan-review and at execute close-out. **Per Amendment 7 (web Claude plan-review verdict): the §5.11 invocation policy is pattern-extended in this PR via `docs/maintenance.md` to add "credential-rotation / secrets-store cutover work" as a recognized routing class.** Documented in §6.
**Plan author:** Claude Code plan-mode session, 2026-05-17 (re-emit round 2 same calendar day — Q8 RESOLVED inline with corrected B5b mechanism per web Claude verdict)
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

**Round 2 (2026-05-17 same calendar day):** web Claude accepted Q8 corrected-sourcing candidate from re-emit round 1. Original Amendment 5 mechanism ("Vercel UI shows Sensitive values on click → reveal → copy") was structurally infeasible. Corrected mechanism applied inline to B5b; all "pending Q8 verdict" caveats removed throughout. Meta-lesson captured in §9 Q8 + §14 SURPRISE pre-load (web Claude prescriptions touching vendor UI mechanics must be pre-verified by CC against vendor docs before plan-mode applies them — symmetric to §0.4 pre-verification rule applied to CC).

---

## §0 Context (load-bearing — read first)

### §0.1 Two distinct surfaces this stratum addresses (keep separate)

This plan covers two related but distinct surfaces. They overlap on the 5 leaked secrets but otherwise have different shape, sequencing, and rollback profile. **Phases A and B are sequenced; A completes and verifies before B begins.**

| Surface | Scope | Trigger | Sequencing |
|---|---|---|---|
| **Rotation** | 5 leaked secrets (`BETTER_AUTH_SECRET`, `ADMIN_PASSWORD`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`) — exposed via `/tmp/scaffold14-env.txt` for 3+ days, world-readable mode 644 | SCAFFOLD.13-A SURPRISE 8 + A8 HIGH finding 2 + operator decision 2026-05-17 ~14:50 IST | **Phase A** (load-bearing first action; A1–A7) |
| **Doppler-canonical** | All ~12 production env vars (the 5 above plus `DATABASE_URL`, Upstash REST URL/token, Google client ID, Resend FROM, Turnstile site key, Better Auth URL) move into Doppler as the single source of truth, with Doppler→Vercel integration syncing automatically | Tracker-sweep-v9 §"Path A — SCAFFOLD.13 kickoff first" + original SCAFFOLD.13-B framing | **Phase B** (B1–B9, plus B5a + B5b inserted per Amendments 1 + 5) |

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

SCAFFOLD.13-A's repeating error pattern (per §0 finding 4 + finding 6) was asserting tool/vendor capabilities without pre-verifying them against the operator's actual tier/setup. This plan front-loads pre-verification before asserting procedure. **Round 2 also adds a symmetric pre-verification rule for web-Claude prescriptions touching vendor UI mechanics (per §9 Q8 meta-lesson + §14 SURPRISE pre-load).**

| Capability asserted | Pre-verified via | Result |
|---|---|---|
| Doppler free-tier project + config + sync limits | `www.doppler.com/pricing` (2026-05-17) | Developer tier: 10 projects, 10 configs/env, 4 envs, **5 config syncs**, 3-day activity log. Comfortably within budget for 1 project + 2 configs (`dev` + `prd`) + 2 Vercel integration slots. |
| Doppler→Vercel Sensitive-flag preservation | `docs.doppler.com/docs/vercel` (2026-05-17) | "Doppler defaults to Sensitive for all Vercel syncs." **Preserves §0 finding 3 posture from 13-A.** |
| Doppler→Vercel integration scope (per-environment) | `docs.doppler.com/docs/vercel` (2026-05-17) | **Each integration targets a single Vercel environment.** Production + Preview = 2 separate integrations (both pulling from same `prd` config). Within free-tier 5-slot budget. |
| Doppler→Vercel auto-redeploy on change | Doppler search results (2026-05-17) | "Doppler extends Vercel's environment variable workflow by adding features such as cross-project variable referencing and automatic redeployment when variables change using environment-specific webhooks." **Auto-redeploy is the mechanism, not manual sync.** |
| Doppler→Vercel name-collision behavior on first sync | `docs.doppler.com/docs/vercel` (2026-05-17) | **NOT DOCUMENTED.** All 12 keys already exist in Vercel. Surfaced as Open Question Q1 (§9) with chosen mitigation in B4. |
| Doppler→Vercel integration-DISABLE behavior (per Amendment 5) | Doppler docs + web search (2026-05-17) | **NOT DOCUMENTED.** Unclear whether disconnecting the integration retains or clears Vercel env vars. Mitigated by B5b password-manager backup (rollback substrate independent of Doppler-side guarantee). |
| **Vercel Sensitive-flag readability from dashboard (per Q8 RESOLVED in round 2)** | 13-A §0 finding 3 root cause + Vercel platform-security convention (2026-05-17) | **VERIFIED write-once-read-never from BOTH CLI AND dashboard.** Matches §0 finding 3 from 13-A — the finding was NOT CLI-specific. Vercel's dashboard masks Sensitive values; no "click → reveal → copy" path exists. B5b sourcing pulls from vendor dashboards + password manager instead (per Q8 RESOLVED). |
| Google OAuth Client Secret rotation (dual-active) | `support.google.com/cloud/answer/15549257` + Google OAuth API docs (2026-05-17) | **Dual-active supported.** Max 2 secrets per client. Add new → migrate apps → manually disable old. No automatic invalidation. |
| Resend API key rotation (graceful) | `resend.com/docs/knowledge-base/how-to-handle-api-keys` (2026-05-17) | **Dual-active supported.** "Both keys will work simultaneously, so ensure your new key is working before deleting your old key." Standard create-new → verify → delete-old. |
| Cloudflare Turnstile secret rotation (atomic with grace) | `developers.cloudflare.com/turnstile/troubleshooting/rotate-secret-key/` (2026-05-17) | **2-hour grace period.** Settings → Rotate Secret Key. Both keys valid for 2 hours; cannot rotate again during grace window. Auto-invalidates after 2h. |
| `/tmp/scaffold14-env.txt` + mirror still present | `ls -la /tmp/scaffold14-env.txt /private/tmp/scaffold14-env.txt` (2026-05-17) | **Both present.** 1035 bytes, mode `-rw-r--r--` (644, world-readable), mtime 2026-05-14 21:03 (~3 days on disk; matches 13-A SURPRISE 8 description). |
| `.env.local` permissions | `ls -la .env.local` (2026-05-17) | **Mode 644** (world-readable). Closes A8 LOW finding 4 from 13-A via Phase A step A2. |
| `docs/maintenance.md` structure (per Amendment 7) | `Read docs/maintenance.md` (2026-05-17) | File exists; structure = "What's in scope" table + "When to audit — five triggers" + audit cadence table + last-revised footer (FOUND.4 / Apr 2026). Cleanest amendment shape: NEW sub-section "Routing extensions to CLAUDE.md §5.11" listing recognized routing classes; see §9 Q5 for exact amendment text. |
| `.claude/settings.local.json` gitignored | `git check-ignore -v .claude/settings.local.json` (2026-05-17) | `.gitignore:49:.claude/settings.local.json` — confirmed gitignored. Operator-local allowlist edits (per Amendment 8 narrow form) do NOT appear in PR diff; §1.3 does not list this file. |

**Symmetric pre-verification rule (added round 2 per §9 Q8 meta-lesson):** the pre-verification discipline applied to CC plan-mode also applies to **web Claude prescriptions** that touch vendor UI mechanics, vendor CLI behavior, or vendor flag semantics. When web Claude prescribes a vendor-specific procedure step (per amendment, per verdict, per resolution), CC verifies it against vendor docs + prior session findings before applying. Q8 cascade in round 1 illustrated this — Amendment 5's "Vercel dashboard reveal" mechanism conflicted with 13-A §0 finding 3 (Sensitive write-once-read-never) and was caught only because B5b prose carried a forward-pointer caveat. The corrected mechanism (vendor-dashboards + password-manager) lands in round 2.

**Two items remain undocumented / verify-in-execution:** (a) Doppler→Vercel name-collision behavior on initial sync — Phase B sequencing chosen to make this irrelevant (rotate Vercel first, then populate Doppler with current values, then enable integration — collision-time values match, so any of overwrite/skip/error converges to correct state); (b) Doppler→Vercel integration-DISABLE behavior — mitigated by B5b password-manager backup per Amendment 5.

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
| Vercel env-var update for rotated 5 | Dashboard, Sensitive flag on, scope Production + Preview (single grouped entry — match A6/A7 pattern from 13-A) |
| Doppler project provisioning | `zugzwang-experiment` (single project; no vendor-split) |
| Doppler configs | `dev` (key-name inventory reference with placeholder values per Amendment 4; not synced) + `prd` (synced to Vercel Production AND Preview via 2 separate integrations) |
| Doppler `prd` population | All 12 keys from §0.2 inventory **copy-pasted** (per Amendment 1; not re-typed) from vendor dashboards and operator password manager **(per Q8 RESOLVED sourcing — NOT from Vercel reveal, which is structurally infeasible per §0.4)**. Per-key sourcing in B4 table. |
| Doppler `dev` population | **12-key NAMES mirroring `prd`'s inventory (per Amendment 4), with empty-string or placeholder values (e.g. `<set-in-doppler-prd>`).** No real dev secrets. Sanity-check name parity vs `prd`. |
| Doppler→Vercel integration (Production) | `prd` config → Vercel Production environment |
| Doppler→Vercel integration (Preview) | `prd` config → Vercel Preview environment (matches current grouped-entry posture from 13-A §0 finding 4) |
| Doppler→Vercel propagation spot-check | Add `ZUGZWANG_PROBE_KEY=probe-2026-05-17` to Doppler `prd`; observe via `vercel env ls production` (`Encrypted`, "X seconds ago" timing); delete from Doppler; re-observe disappearance. Non-disruptive to production. |
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
- `.env.local` — modified for permissions (chmod 600), but file contents may also be updated by the operator with new rotated values. **`.env.local` is gitignored** — no diff in PR.
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
| 8 | Propagation spot-check passes: `ZUGZWANG_PROBE_KEY` added in Doppler appears in Vercel within reasonable time (target: <2 min — verify), then disappears when deleted in Doppler | §4 B7 | B |
| 9 | Final smoke test passes: `/sign-in` 200; admin login still succeeds; Better Auth `/api/auth/session` endpoint still 200 (B9 mirror of A6-3a); rotated values' integrity preserved through Doppler-mediated sync | §4 B9 + §8 | B |
| 10 | **Per-vendor old-secret disablement performed IN-SESSION per Amendment 6 (Q4 verdict):** Google + Resend old secrets disabled IMMEDIATELY after verification confirms new works (no 24h window). Turnstile auto-invalidates at 2h grace. **No tracker MAINT-row minted (Amendment 6 drops the 24h-deferred row).** | §5 + §7 + §9 Q4 | A or B (immediate post-verification) |
| 11 | `.env.example` drift fix landed | §1.3 | A or B |
| 12 | `docs/logs/SCAFFOLD.13-B.md` written before `gh pr create` (six-field per §5.9 + §14 SURPRISE entries) | §6 close-out | post-B |
| 13 | `security-auditor` reviewer-call invocations: 1 at plan-review (this surface) + 1 at execute close-out | §6 reviewer-call routing | both phases |
| 14 | `pnpm tsc --noEmit && pnpm biome check . && pnpm vitest run` exit 0 (no `src/` changes, but `just verify` per AGENTS.md §11) | §8 verification | post-B |
| 15 | **`docs/maintenance.md` amendment (per Amendment 7) landed in PR diff** — "Routing extensions to CLAUDE.md §5.11" sub-section with exact text per §9 Q5 | §1.3 + §9 Q5 | A or B |

---

## §3 Phase A — rotation + `/tmp` + `.env.local` hygiene (A1–A7)

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

**Verification gate before Phase B:** smoke test passes (A6-2 + A6-3 + A6-3a if applicable); rotated 5 values are live; old `/tmp` files removed; `.env.local` is mode 600.

### A7 — Phase A close + Phase B gate

`/tmp` hygiene re-check (`find /tmp /private/tmp -name '*env*' -mtime -7 -ls 2>/dev/null` shouldn't surface anything alarming).

Capture A7 close artifact: `vercel env ls production` output post-Phase-A. Compare against §0.2 inventory — same 12 keys, but the 5 rotated entries show recent "X minutes ago" timing. This is Phase B's baseline.

**Phase A complete; gate to Phase B opens.**

---

## §4 Phase B — Doppler integration (B1–B9, canonical-store cutover; B5a + B5b inserted per Amendments 1 + 5; B5b mechanism per Q8 RESOLVED in round 2)

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

**Mitigation for Doppler→Vercel name-collision behavior (§0.4 undocumented; Q1 in §9):** because Doppler `prd` is populated with **the same values Vercel already holds** (post-Phase-A), the collision-time behavior at B6 integration enable is irrelevant — any of overwrite-with-same / skip-existing / error-on-conflict converges to a correct end state.

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

**Why this matters at B6:** if Doppler→Vercel integration enable behaves unexpectedly (clears Vercel values, errors out, leaves orphaned entries), the rollback path is re-populating Vercel directly from B5b backup. Without this substrate, an unexpected integration-enable behavior would force operator into a multi-vendor scramble during a degraded-production state.

### B6 — Doppler→Vercel integration (cutover)

Two integrations required (per §0.4 pre-verification — one per Vercel environment):

#### B6a — Doppler `prd` → Vercel Production

Doppler dashboard → Project `zugzwang-experiment` → Config `prd` → Sync → Vercel:
- Authorize Vercel (OAuth) — operator's `zugzwang-worlds-projects` org.
- Project: `experiment` (Vercel project name).
- Environment: **Production**.
- Confirm: Doppler defaults to Sensitive flag on all syncs (per §0.4 pre-verification).
- Enable sync.

**Conflict-time behavior observed (capture in §14 SURPRISE if anything surprises):** Doppler may overwrite, skip, or error on Vercel's existing same-name vars. Because values match (B4 sequencing + Amendment 1 copy-paste), the end state is correct regardless. Note observed behavior for future plans.

#### B6b — Doppler `prd` → Vercel Preview

Repeat B6a, but Environment: **Preview**. Same `prd` config feeds both — single source of truth for `prd` config; Vercel Production + Preview see identical values (matches current §0.2 grouped-entry posture).

**Cost check:** 2 of 5 free-tier config-syncs used. 3 remaining for future expansion (or `prd` → Vercel Development if Path A ever changes; not now).

### B7 — Propagation spot-check (non-disruptive)

Goal: confirm Doppler-side edits propagate to Vercel without manual intervention.

```
# In Doppler `prd`:
Add Secret: ZUGZWANG_PROBE_KEY = "probe-2026-05-17"
```

Within ~2 minutes (target; verify actual lag in execute phase), `vercel env ls production` shows:

```
 ZUGZWANG_PROBE_KEY    Encrypted    Production    just now (or X seconds ago)
```

Then delete the probe key from Doppler:

```
# In Doppler `prd`:
Delete Secret: ZUGZWANG_PROBE_KEY
```

Within ~2 minutes, `vercel env ls production` no longer shows `ZUGZWANG_PROBE_KEY`.

**Vercel auto-redeploy:** observe whether Doppler's sync triggers Vercel auto-redeploy (per §0.4 pre-verification — Doppler docs claim it does via webhook). Capture redeploy build ID in plan §14 SURPRISE if helpful.

**Why probe-key approach (not edit-existing):** Editing an existing key (e.g. `BETTER_AUTH_URL`) risks disrupting production. Adding/deleting a fresh key has no production impact. Doppler-side edits to existing keys are tested implicitly by B6 initial sync.

### B8 — Vercel redeploy (if propagation requires; pre-verify in B7)

If B7 confirms Doppler→Vercel auto-redeploy is functional, B8 is satisfied incidentally during B7's probe-key sync. If redeploy is NOT auto-triggered (Doppler doc claim doesn't hold in practice), trigger manual redeploy via Vercel dashboard → Deployments → Redeploy → "use existing build cache". Document the divergence in §14 SURPRISE.

### B9 — Final smoke test (post-Doppler cutover; per Amendment 3 mirror of A6)

Same checks as A6, after B6 + B7 cutover:

1. `/sign-in` → HTTP 200, page renders.
2. Admin Server Action login: rotated `ADMIN_PASSWORD` accepted (confirms Doppler-mediated value reaches Vercel runtime correctly).
3. **B9-3a (mirror of A6-3a, if admin auth was found DECOUPLED at A6-1):** `curl -I https://experiment-zugzwang-worlds-projects.vercel.app/api/auth/session` → expect HTTP 200. Same rationale as A6-3a.
4. Optional: Email-OTP POST returns 415 (SCAFFOLD.3-FOLLOWUP-1 bug; not a regression).

If smoke fails: rollback per §7.

**Phase B complete. Exit criteria 6–9 + 14 + 15 satisfied.**

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
| `security-auditor` | Plan-review (post-plan, before execute) | After plan committed to branch (Phase 1 close) | Read, Grep, Glob, Bash (no Edit, no Write) | `.claude/agents/security-auditor.md` | `@docs/plans/SCAFFOLD.13-B.md` | Review plan for: (1) credential-rotation sequencing correctness; (2) Doppler-Vercel integration risk surface (name-collision behavior; Sensitive-flag preservation; Vercel auto-redeploy boundary); (3) plan-level refusal-trigger boundary; (4) pre-verification footprint adequacy. Output: PASS / FAIL / SURPRISE on plan correctness. **No execution authority.** |
| `security-auditor` | Execute close-out | After Phase B B9 smoke, before `gh pr create` | Read, Grep, Glob, Bash (no Edit, no Write) | `.claude/agents/security-auditor.md` | `@docs/plans/SCAFFOLD.13-B.md` | Three surfaces: (1) credential-rotation surface (verify all 5 rotated values reach Vercel runtime; old secrets disabled per IMMEDIATE timing in §5 + §7 per Amendment 6); (2) Doppler-Vercel integration surface (verify `prd` config is sync source; no Vercel-side dashboard drift; Sensitive flag preserved); (3) `/tmp` hygiene re-check + `.env.local` mode 600 + transcript persistence per 13-A SURPRISE 4. Output: PASS / FAIL / SURPRISE. |
| `db-migration-reviewer` | — | NOT invoked | — | — | — | No schema work this stratum |
| `code-reviewer` | — | NOT invoked | — | — | — | No `src/server/` changes |
| `test-writer` | — | NOT invoked | — | — | — | No new business-logic behavior |

**Three required prompt elements per CLAUDE.md §5.11** (enforced in both reviewer-call prompts):
1. Explicit role briefing — `.claude/agents/security-auditor.md` loaded and followed verbatim.
2. Plan path — `@docs/plans/SCAFFOLD.13-B.md`.
3. Tool-scope constraints — "Read, Grep, Glob, Bash only — do not Edit or Write" enforced in prompt body.

**Reviewer output discipline (carry forward 13-A process observation 2):** "Output format: report only, no preamble. No thinking-fragment text at the start of the report. No 'I've completed the review of...' filler — start with findings table."

**Pattern-extension framing (per Amendment 7):** §5.11's invocation policy is amended in this PR via `docs/maintenance.md` to add "credential rotation / secrets-canonical-store cutover" as a recognized class that routes `security-auditor` at plan-review + execute close-out regardless of literal §1 critical-path file touch. Justification: rotation surfaces affect production auth substrate even without `src/` file changes. The kickoff routing is therefore the **documented pattern**, not a one-off deviation. Future strata that meet this class (testnet credential migration, mainnet rotation, etc.) inherit the routing automatically.

**Pre-PR self-audit per §5.10:** §5.10 is reserved for critical-path PRs per §1; this task is not literal critical-path. Self-audit recommended but not strictly mandated. **Recommendation:** run a light self-audit (walk §2 exit criteria 1–15 line-by-line, PASS/FAIL/SURPRISE) before `gh pr create`, since context is loaded and the audit is cheap.

**Allowlist discipline for Doppler CLI (per Amendment 8 — Q7 verdict):** Dashboard for write-ops (project mint, config mint, secret population, integration enable). **Narrow CLI allowlist for post-hoc state-capture audit backstop only:** `Bash(doppler secrets list)` + `Bash(doppler configs list)`. These are read-only, value-redacting commands (Doppler default redacts unless `--plain` flag). **REJECTED:** `Bash(doppler *)` wildcard form — bypasses the per-subcommand audit envelope (13-A SURPRISE 7 lesson). Actual `.claude/settings.local.json` edit is an operator action at execute-phase A start; gitignored (per §0.4 verification) so does NOT appear in PR diff.

---

## §7 Rollback (per-action; per Amendments 5 + 6 cascade updates; per Q8 RESOLVED in round 2)

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
| A5 Vercel env-var update | Wrong value pasted into Vercel UI | Edit Vercel env var → paste correct value → save. Auto-redeploy triggers. | <5 min |
| A6 smoke test fails | Auth flow regressed post-rotation | Per per-vendor rollback above. Diagnose which credential is faulty (admin login = `ADMIN_PASSWORD`; participant session = `BETTER_AUTH_SECRET`; OAuth = `GOOGLE_CLIENT_SECRET`; OTP = `RESEND_API_KEY`; CAPTCHA = `TURNSTILE_SECRET_KEY`). | varies |
| B2 Doppler project mint | Wrong name typed | Delete Doppler project; re-create with correct name. | <2 min |
| B4 Doppler `prd` populate | Wrong value pasted into Doppler UI | Edit Doppler secret → correct value → save. Integration (not yet enabled — B6 hasn't fired) so no Vercel-side propagation yet. | <2 min |
| B5a non-secret value-match check fails | Doppler `prd` value mismatched for one of 4 non-secret keys | Re-paste from `.env.local`; re-verify; proceed to B5b. | <2 min |
| B5b password-manager backup gap (per Amendment 5; per Q8 RESOLVED sourcing) | Password manager missing canonical value for one of 12 keys | Source from vendor dashboard per B5b table (NOT Vercel reveal per §0.4 row + §0 finding 3). For the 7 unrotated keys: Upstash console / Supabase + password manager / Google Cloud Console / Resend / Cloudflare Turnstile / public deploy URL. For the 5 rotated keys: already in password manager from A3 + A4 capture. | <10 min |
| B6a / B6b integration enable (per Amendment 5 revised) | Integration fails to authorize (Vercel OAuth flow breaks) | Disconnect Doppler integration from Vercel UI; re-authorize; retry. **Per B5b backup substrate (per Amendment 5 + Q8 RESOLVED):** if integration enable clears Vercel env vars unexpectedly, re-populate Vercel directly from **vendor dashboards + password-manager values captured at B5b — NOT from Vercel reveal**. **Target recovery <15 min.** | <15 min |
| B6 Doppler→Vercel | Initial-sync collision causes Vercel value loss | Because B4 populated Doppler with the same values as Vercel currently holds (post-Phase-A), values match — collision behavior is value-neutral. If Vercel values DO get lost somehow, re-populate Vercel directly from B5b password-manager + vendor-dashboard backup (per Q8 RESOLVED — NOT from Vercel reveal). | <30 min |
| B7 probe-key spot-check fails | Doppler→Vercel sync not propagating | Investigate Doppler integration status; check Vercel webhook activity; consult Doppler docs / support. **Critical decision point:** if sync is structurally broken, abandon Phase B (rollback to direct-Vercel posture), unconvert by deleting Doppler integration in Vercel; document failure in §14 SURPRISE; revisit in later stratum. | <30 min decision; full rollback ~1h |
| B9 final smoke test fails | Doppler-mediated values don't reach Vercel runtime correctly | Disable Doppler integration; rely on B5b vendor-dashboard + password-manager backup to re-populate Vercel directly if needed (per Amendment 5 + Q8 RESOLVED — Vercel's env vars MAY or MAY NOT persist on integration-disable; backup is the rollback substrate regardless). Re-test. If still broken, root-cause from runtime logs. | <30 min |

**General Phase A→B revert (per Amendment 5 revised + Q8 RESOLVED):** at any point in Phase B, if Doppler proves unworkable, disable the Doppler→Vercel integration. **Vercel's env vars MAY or MAY NOT persist on integration-disable (vendor-unverified per §0.4). B5b vendor-dashboard + password-manager backup is the rollback substrate regardless of actual Doppler disable behavior** — if Vercel clears env vars on disconnect, re-populate from backup (vendor dashboards for the 7 unrotated; password manager for the 5 rotated); if Vercel retains, the backup is unused but still cheap insurance.

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
5. **`vercel env ls production` post-Phase-A**: 12 keys, all Encrypted; the 5 rotated keys show recent "X minutes ago" timing.
6. **No regression**: SCAFFOLD.3-FOLLOWUP-1 (415 on OTP POST) reproduces — confirming the rotation didn't introduce new regressions on top of the known bug.

### §8.2 Phase B verification (post-B9)

1. **Doppler project state**: dashboard shows `zugzwang-experiment` with `dev` (12 key names, placeholder values per Amendment 4) + `prd` (12 keys with real values), `stg` deleted.
2. **2 Vercel integrations**: Doppler `prd` → Vercel Production active; Doppler `prd` → Vercel Preview active.
3. **B5a non-secret value-match check (per Amendment 1):** for `GOOGLE_CLIENT_ID`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `BETTER_AUTH_URL`, Doppler `prd` values matched `.env.local` (eyeballed pre-B6).
4. **B5b password-manager backup (per Q8 RESOLVED sourcing):** all 12 keys present in password manager via vendor-dashboard + rotation-capture sourcing (NOT Vercel reveal); rollback substrate ready.
5. **Propagation spot-check**: B7 probe-key add → Vercel shows it within ~2 min; delete → Vercel removes it within ~2 min. Capture the actual lag in §14.
6. **Final smoke**: same as §8.1 items 2 + 3 + 4 (Better Auth `/api/auth/session` if DECOUPLED), but post-Doppler cutover.
7. **`vercel env ls production` post-Phase-B**: 12 keys, all Encrypted (Sensitive flag preserved per Doppler default). Note: Vercel may now show "X minutes ago" for some keys reflecting last Doppler sync; not all 12 necessarily reflect changes since B6 enable.

### §8.3 `just verify` (baseline; no `src/` changes but discipline-mandated per AGENTS.md §11)

```
pnpm tsc --noEmit         # exit 0
pnpm biome check .        # zero fixes
pnpm vitest run           # 133 pass + 5 todo (per 13-A baseline); no regressions
```

**Why run vitest despite no `src/` changes:** discipline. Catches accidental config/import drift (e.g. if `.env.example` shape change ever feeds into test setup).

---

## §9 Open questions (for plan-review)

8 numbered items at re-emit round 2 close: 3 RESOLVED (Q4 / Q5 / Q7 from round 1 web Claude verdict) + 1 RESOLVED (Q8 from round 2 web Claude verdict) + 1 unresolved-mitigated (Q1) + 1 unresolved-low-risk (Q6) + 2 unresolved-pending-review (Q2 / Q3).

### Q1 — Doppler→Vercel name-collision behavior on initial sync — **UNRESOLVED; mitigation in place**

- **Q:** When Doppler enables sync to Vercel Production at B6a, what does Doppler do for the 12 env vars Vercel already has with matching names? (Overwrite? Skip? Warn? Error?) Doppler docs at https://docs.doppler.com/docs/vercel do not specify (per §0.4 pre-verification).
- **Candidate:** Doppler likely overwrites (matches "automatic sync" framing). **Mitigation chosen regardless:** B4 sequencing + Amendment 1 copy-paste discipline populate Doppler `prd` with the **same values** Vercel currently holds (post-Phase-A) — collision behavior is value-neutral. Plan proceeds; observed behavior captured in §14 SURPRISE.
- **Resolve with:** Web Claude re-review acknowledgment + observe + document in §14. Risk is low because of value-match mitigation.

### Q2 — Vercel target environments (Production-only vs Production + Preview) — **UNRESOLVED**

- **Q:** Should Doppler `prd` sync to Vercel **Production only**, or to **Production + Preview**? Current state ships a single grouped entry covering both (per 13-A §0 finding 4); the two integrations B6a + B6b mirror that.
- **Candidate:** Production + Preview (2 integrations, both from `prd`). Mirrors current state; uses 2 of 5 free-tier sync slots; matches operator's existing posture from 13-A.
- **Resolve with:** Web Claude re-review confirm. Alternative is Production-only with Preview operationally orphaned (Preview deploys would have NO env vars unless populated separately) — this is a regression from current state.

### Q3 — Pre-launch session-invalidation acceptance for `BETTER_AUTH_SECRET` — **UNRESOLVED**

- **Q:** Rotating `BETTER_AUTH_SECRET` invalidates all existing Better Auth sessions. Pre-launch, this is academic (no real users). Is the project-wide "no impact" position correct, or should we surface a follow-up "post-rotation session-restore drill" task?
- **Candidate:** No impact pre-launch. Acknowledge + move on. No follow-up task needed.
- **Resolve with:** Web Claude re-review confirm. Cross-reference with 2026-09-15 launch readiness criteria.

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

---

## §10 ADRs needed

**None.** This stratum is operational, not architectural:
- No vendor commitment beyond what's already locked in AGENTS.md §1 (Vercel) or 13-A (Supabase) — Doppler is added as a tooling vendor for secrets management, but it doesn't change auth/data/runtime architecture. Defensible as a tooling-choice ADR if reviewer disagrees; surface as Q-extension if needed.
- No CLAUDE.md §10 defaults changed.
- No pattern other code copies (credential rotation is a one-time procedure, not a recurring pattern in `src/`).

If plan-review judges Doppler vendor-commitment warrants an ADR ("we commit to Doppler for secrets management; reversal is non-trivial"), mint `docs/adr/0017-doppler-secrets-management.md` in same commit per CLAUDE.md §5.12. Currently judged not-ADR-worthy.

---

## §11 Pre-PR self-audit checklist (recommended; not strictly mandated per §5.10)

| # | Item | Plan reference | Status |
|---|---|---|---|
| 1 | `/tmp/scaffold14-env.txt` + `/private/tmp/scaffold14-env.txt` removed | §2 #2 + A1 | ⏳ |
| 2 | `.env.local` mode 600 | §2 #3 + A2 | ⏳ |
| 3 | All 5 rotated values reach Vercel runtime (smoke A6 + B9; includes Better Auth `/api/auth/session` if DECOUPLED) | §2 #1 + §2 #5 + §2 #9 | ⏳ |
| 4 | Doppler project `zugzwang-experiment` exists with `dev` + `prd` (no `stg`) | §2 #6 + B2 + B3 | ⏳ |
| 5 | Doppler `prd` has 12 keys matching §0.2 inventory (copy-paste discipline; Amendment 1; sourcing per Q8 RESOLVED) | §2 #6 + B4 | ⏳ |
| 6 | **Doppler `dev` has same 12-key NAMES (placeholder values acceptable per Amendment 4)** | B5 | ⏳ |
| 7 | 2 Doppler→Vercel integrations active (Production + Preview), Sensitive flag preserved | §2 #7 + B6 | ⏳ |
| 8 | Probe-key spot-check passes (B7 add → ~2 min → Vercel shows; delete → ~2 min → Vercel removes) | §2 #8 + B7 | ⏳ |
| 9 | **Per-vendor old-secret disablement performed IN-SESSION per Amendment 6 (Google + Resend IMMEDIATE; Turnstile auto)** | §2 #10 + §5 + §9 Q4 | ⏳ |
| 10 | `.env.example` drift fix landed | §2 #11 + §1.3 | ⏳ |
| 11 | `docs/logs/SCAFFOLD.13-B.md` written before `gh pr create` (six-field per §5.9 + §14 SURPRISE entries) | §2 #12 | ⏳ |
| 12 | `security-auditor` reviewer call at plan-review (PASS surface) + execute close-out (PASS surface) | §2 #13 + §6 | ⏳ |
| 13 | `just verify` (tsc + biome + vitest) exit 0 | §2 #14 + §8.3 | ⏳ |
| 14 | No `src/`, `drizzle/migrations/`, `supabase/migrations/`, `tests/`, `docs/specs/`, `docs/adr/` files touched in PR diff | §1.3 forbidden surfaces | ⏳ |
| 15 | **`docs/maintenance.md` "Routing extensions to CLAUDE.md §5.11" sub-section landed per Amendment 7 / §9 Q5 exact text** | §2 #15 + §1.3 + §9 Q5 | ⏳ |
| 16 | **B5a non-secret value-match check passed pre-B6 (4 keys eyeball-compared) per Amendment 1** | §4 B5a + §8.2 | ⏳ |
| 17 | **B5b password-manager backup complete with Q8 RESOLVED sourcing (12 keys via vendor dashboards + password manager; not Vercel reveal)** per Amendment 5 + Q8 RESOLVED | §4 B5b + §8.2 + §9 Q8 | ⏳ |

---

## §12 Process observations carried forward from 13-A (carry-forward discipline)

Per kickoff §"Process observations carried forward from 13-A":

1. **Pre-verify tool/vendor capabilities before asserting them as plan procedure.** Honored in §0.4 — pre-verification footprint table captures 13 capabilities verified via vendor docs + prior session findings before plan asserted them. Round 2 adds a symmetric pre-verification rule for web-Claude prescriptions touching vendor UI mechanics (per §9 Q8 meta-lesson) — captured as a paragraph after the §0.4 table.
2. **Plan-amendment-during-execution is high-overhead; tight plan pre-flight is cheaper.** Honored by front-loading pre-verification + the 7 open questions from initial plan reduced to: 3 unresolved (Q1 mitigated / Q2 / Q3 / Q6 low-risk) + 4 RESOLVED (Q4 / Q5 / Q7 / Q8) via the two-round re-emit cycle. Q8 itself emerged from round 1's cascade analysis and was RESOLVED in round 2 — illustrating that the re-emit cycle catches what a single-pass plan would have missed.
3. **Dashboard-side operations leave no audit trail; post-hoc capture (`vercel env ls`, narrow CLI allowlist per Amendment 8) is the minimum backstop.** Honored — A7 closes with `vercel env ls production` capture; B6 + B7 + B9 each capture state. **Per Amendment 8 (Q7 verdict):** Doppler state-capture uses narrow CLI allowlist (`Bash(doppler secrets list)`, `Bash(doppler configs list)`) — read-only, value-redacted by default. Dashboard write-ops remain auditable via post-hoc CLI capture. No wildcard allowlist.
4. **`/tmp` hygiene audit at stratum close (re-check after Phase A).** Honored — A7 re-runs `find /tmp /private/tmp -name '*env*'` post-A1.
5. **Subagent output format discipline (no thinking fragments, no preamble).** Captured in §6 reviewer-call routing notes ("Output format: report only, no preamble").

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

**Pre-loaded category headers** (per Amendment 3 + Q8 RESOLVED + §0.4 undocumented items + round 2 meta-finding):

- **ADR-0010 admin-auth coupling-to-Better-Auth finding** (per Amendment 3): A6-1 pre-smoke check will determine whether admin Server Action shares `BETTER_AUTH_SECRET` machinery with Better Auth. Either COUPLED or DECOUPLED finding ships as §14 entry.
- **Doppler→Vercel name-collision behavior at B6 initial sync** (per Q1; §0.4 undocumented).
- **Doppler→Vercel propagation lag observed at B7** (vs target ≤2 min; per §0.4 search-result claim).
- **Vercel auto-redeploy behavior on Doppler sync** (observed vs documented; per §0.4 search-result claim).
- **Doppler→Vercel integration-disable behavior** (per Amendment 5; §0.4 undocumented).
- **B5b sourcing actually performed via Q8 RESOLVED strategy** (vendor dashboards + password manager; observed cost + any vendor-side friction points).
- **Per-vendor old-secret disablement actually performed IN-SESSION** (per Amendment 6; if any vendor's verification was inconclusive enough to defer disablement, capture as §14 SURPRISE).
- **Amendment-cycle meta-finding (round 2):** web-Claude prescription error caught by CC plan-mode discipline (Q8 cascade). Web Claude's Amendment 5 mechanism ("Vercel UI shows Sensitive values on click → reveal → copy") was structurally infeasible per 13-A §0 finding 3 root cause — the Sensitive flag is write-once-read-never from BOTH CLI AND dashboard, not CLI-specific. CC's round-1 re-emit surfaced this as Q8 with a candidate corrected mechanism; web Claude accepted in round 2 and the corrected mechanism (vendor-dashboards + password-manager sourcing) landed inline. **Discipline carry-forward: web Claude prescriptions touching vendor UI mechanics must be pre-verified by CC against vendor docs before plan-mode applies them — symmetric to the §0.4 pre-verification rule applied to CC.** Capture this as a `docs/maintenance.md` candidate if the pattern recurs.

---

## §15 Sign-off

Plan **re-emitted 2026-05-17 round 2** with Q8 RESOLVED inline per web Claude verdict (Amendment 5 mechanism corrected to vendor-dashboards + password-manager sourcing). All 8 round-1 amendments + Q8 cascade-emergent question now applied or RESOLVED.

**Re-emit round 2 deliverables at Phase 1 close (this turn):**
- This file re-emitted at `docs/plans/SCAFFOLD.13-B.md` (~870 lines, full body; not delta).
- Amendment log at file head (8 round-1 amendments + Q8 round-2 resolution).
- 8 open questions in §9: 1 unresolved-mitigated [Q1] + 2 unresolved [Q2 / Q3] + 1 unresolved-low-risk [Q6] + 4 RESOLVED [Q4 / Q5 / Q7 / Q8].
- 13 pre-verifications in §0.4 + symmetric pre-verification rule paragraph for web-Claude prescriptions per Q8 meta-lesson.
- `security-auditor` plan-review reviewer call to fire next — per Amendment 7 pattern-extension + §6 routing. **Not invoked by Claude Code in plan-mode this turn; operator confirms before reviewer-call invocation per kickoff "DO NOT EXECUTE" boundary.**

**Plan file NOT yet committed to branch this turn** — per CLAUDE.md §5.1 the plan file must be committed before Phase 1 ends; commit happens after web Claude plan-review **re-review** approval (post-round-2 verdict), in a fresh execute-phase session. Branch creation (`feat/scaffold-13-b`) deferred to execute phase.

**Pattern observation (carry-forward to future plans):** the two-round amendment cycle illustrates that plan-mode discipline benefits from explicit "pending verdict" caveats on web Claude-prescribed mechanisms that touch vendor UI. The forward-pointer pattern (cascade-emergent flaw in round 1 → caveat in plan body → Q-entry in §9 → RESOLVED in next re-emit round) caught Amendment 5's Vercel-reveal infeasibility before any execute-phase action. This is the §5.10 pre-PR self-audit pattern applied at plan-mode pre-commit time — symmetric and cheap.
