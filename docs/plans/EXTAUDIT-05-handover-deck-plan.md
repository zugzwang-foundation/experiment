# EXTAUDIT-05 — Backend Handover Deck (plan)

**Status:** PLAN — authored 2026-07-14, **uncommitted**, awaiting web review + operator ratification.
**Task:** plan the backend handover deck for the two-person external review team (holders of the
EXTAUDIT-00..04 package). This document is the only artifact of the plan session; deck authoring
happens in the execution chat after ratification.
**Scope ruling (kickoff):** the ENTIRE backend, commit-sequenced, product-tied. Frontend, design
system, and branding are OUT of scope (ledger-line coverage only, so the commit census stays
complete). No code changes ride this task except the deliverables listed in §1.

---

## 0. Grounding (verified live this session)

| Fact | Value |
|---|---|
| `origin/main` HEAD (pin candidate) | `31d8965fbc2585b58c0e3736bdc01f255d3cdc25` — #219 squash, 2026-07-07 |
| CI state on that SHA | `ci` = **SUCCESS** on PR #219 (its squash **is** this SHA; also Vercel checks SUCCESS). Runs attached to the SHA itself: scheduled `env-audit` only, all success — expected, `ci.yml` is PR-gated and never runs on branch push. |
| Working tree at plan time | clean except pre-existing `M .env.example` (not part of this task; untouched) |
| Prior handover deck | **none in-repo** — `git ls-files`/content grep for handover/deck/EXTAUDIT hit only an unrelated design mockup (`DESIGN_W2_2_onboarding-deck_mockup-v0_1.html`). A `zugzwang_handover.md` in ~/Downloads is a **different project** (football/Polymarket) — not prior art. |
| EXTAUDIT-00..04 + briefing | **NOT in-repo** (zero tracked files, zero content hits). The package exists externally — web-authored, issued 2026-07-10: `EXTAUDIT-00_START-HERE.md`, `-01_CHARTER.md`, `-02_OPERATING-MANUAL.md`, `-03_MATH-BODY.md`, `-04_DEBATE-BODY.md` + `EXTAUDIT_BRIEFING.html` (copies sighted in ~/Downloads). |
| Deck location (kickoff rule) | EXTAUDIT not in-repo ⇒ **`docs/handover/`** (greenfield; directory does not exist yet) |
| First-parent commit census | **218 commits** = root `4f4d746` + **217 squash-merged PRs #1–#219** (gaps: #58, #146 closed-unmerged; zero duplicate PR numbers — script-verified) |
| Suffix-less commits resolved | `02f87ac` → PR #143, `e61a733` → PR #144, `b724094` → PR #178 (via `commits/{sha}/pulls`); root `4f4d746` pre-dates the PR flow |
| Link base | `https://github.com/zugzwang-foundation/experiment` (remote verified; kickoff's repo name correct) |
| Doc-canon versions | SPEC.1 **1.0.14** · SPEC.2 **1.0.17** · cpmm.md **2.0.0** · RANKING.md **v1.0.0-draft** (constants defer to the 2026-09-01 tuning pass) · ADR census **29 files** = 0001 + 0003–0011 + 0013–0031 (0002 never authored; 0012 in-flight, no file — matches SYNC-SWEEP §6 ceilings). Kickoff said "ADR 0001–0031"; the deck states the real 29-file census. |
| Environments (from DP-1.md, D5.md, #194 incident log) | staging = `f0be380` (#216 squash) with migrations **0020–0023 applied and health-proven** (DP.1); prod = last promoted at D5/D6 arc, DB through **0019** (incident remediation), **3 doc-commits + 4 migrations behind** — **DP.2 pending**. Deck states this divergence honestly. |
| Test estate | 220 test files: unit 41 · server 114 · integration 20 · invariants 10 · db 19 · scale 14 · _setup 2. Migrations: 24 (0000–0023). `src/server/` has 22 domain dirs. Crons: 3 Vercel (`vercel.json`) + pg_cron (0007, 0011). Workflows: `ci.yml`, `env-audit.yml`, `staging-migrate.yml`. |

---

## 1. Deliverables (execution chat — none authored now)

1. **`docs/handover/HANDOVER-DECK.md`** — canonical, LLM-consumable.
2. **`docs/handover/HANDOVER-DECK.html`** — self-contained single file, fixed sidebar nav,
   presentation-grade, monochrome tracker-v16 dashboard styling, generated from the .md
   (tracker pattern: .md canonical, .html generated — never edited independently).
3. **`scripts/verify-handover-links.sh`** — link + ledger-completeness verifier (§6), committed
   so every future refresh re-runs it.
4. **`biome.json` rider** — add `!docs/handover` to `files.includes` (precedent: the
   `!docs/design/mockups` archival-mockup exclusion, PR #195) so Biome never reformats the
   generated HTML.
5. **`docs/logs/EXTAUDIT-05.md`** — session log, in a follow-up log PR after the deck PR merges
   (two-PR pattern, late-arc precedent #213→#214, #218→#219), citing the deck PR's squash SHA.
6. This plan, committed as `docs/plans/EXTAUDIT-05-handover-deck-plan.md` before Phase 1 ends
   (§5.1 doctrine).

Both deck files pin **PIN_SHA = `origin/main` at execution-time re-grounding** (expected ≥
`31d8965`; the delta will be this plan's own PR + any strays — absorbed into the census by the
§7 re-grounding step). Every referenced commit gets BOTH hyperlinks:
`…/commit/<full-sha>` and `…/pull/<n>` (squash-merge ⇒ 1:1).

---

## 2. Commit census — 218 first-parent commits → phases

Method: `git log --first-parent --reverse origin/main`, trailing `(#N)` extraction + 3
API-resolved strays; per-phase assignment by stratum tag in the squash subject. Counts
script-verified to sum to 218; PR set = {1..219} − {58, 146}.

| Phase / stratum | PRs (strays noted) | Count |
|---|---|---|
| ROOT | `4f4d746` Initial commit (no PR) | 1 |
| FOUND (.2–.6 + licence/CoC/security + CLAUDE.md births) | #1–#17 | 17 |
| SPEC (SPEC.1 drafts) | #18, #20 | 2 |
| PRECURSOR (.4 spec-lock, .5 sweeps) | #19, #32, #63–#65 | 5 |
| SCAFFOLD (.1–.18: schema, auth, Upstash, R2, identity pool, observability, CI, staging) | #21–#31, #33–#48, #50–#57 | 35 |
| SYNC arc (ADR backfill, cold review, SYNC.10, tracker-v11 sweep, 2026-06 sweep) | #59–#62, #66–#67, #106–#107 | 8 |
| DESIGN / DC (visual backbone, design canon) | #68, #70, #195–#196 | 4 |
| ENGINE (.0–.16 + cpmm.md + phase record; E.6 landed early at #49) | #49, #69, #71–#100, #102–#105, #108–#134 | 63 |
| HARNESS / meta (model-contract moves) | #101, #178 | 2 |
| DEBATE (.1–.9 + ADR-0020/0021 moderation spec) | #135–#144, #151–#159, #162–#163 | 21 |
| SHELL / UI (UI.6 admin viewer, SHELL/UI.0) | #145, #160–#161 | 3 |
| FIX-AUTH (OTP gate, additionalFields, cookie cap) | #147, #149–#150 | 3 |
| DEPLOY D-arc (ADR-0022 path, ADR-0024, D1–D6, incident) | #148, #164–#177, #194 | 16 |
| EXPORT (ADR-0025 + EXPORT.1) | #179–#181 | 3 |
| MEDIA (ADR-0026/0027 + MEDIA.1) | #182–#186 | 5 |
| BC arc (descriptive-canon reconcile .1–.4) | #187–#193 | 7 |
| AUDIT campaign (AUDIT-FIX-A*/B* + AUDIT-INV) | #197–#216 | 20 |
| DP (DP.1 staging migration proof) | #217 | 1 |
| SWEEP (SYNC-SWEEP + v16 ceilings baseline) | #218–#219 | 2 |
| **Total** | | **218** |

Merge-order strays the deck must not trip on: #159 (DEBATE.9 close-out) merged after #160/#161;
#49 is ENGINE.6 landing mid-SCAFFOLD; ledger ordering inside chapters is by **main position**,
not PR number.

---

## 3. Deck structure

### Part A — System map (~350 lines, DEEP)

| § | Content | Sources |
|---|---|---|
| A1 | Thesis + product loop one-pager: binary markets, mandatory commentary (no bet without comment, no comment without bet), soulbound Dharma, reply-as-bet debate, 15 Sep–5 Nov 2026 window, K_eff post-hoc only | SPEC.1 §1–§5 |
| A2 | Tech stack table (live versions) + why-this-stack one-liners | AGENTS.md §1, ADR-0003/0004/0006/0007/0008 |
| A3 | Architecture: event-sourced spine (ADR-0005), W-1..W-4 write wrappers, append-only Buckets A/B/C, NUMERIC(38,18) money rule, handler failure postures (rate-limit open / idempotency closed / moderation closed) | SPEC.2 §3/§7, ADR-0013/0014/0015 |
| A4 | The four invariants INV-1..4 + refusal surfaces + the one deliberate spec↔schema gap (`comments.bet_id` nullable BY DESIGN) — pre-empts the reviewer "bug" report; cross-ref EXTAUDIT-01 charter | CLAUDE.md §2–§3, AGENTS.md preamble |
| A5 | Repo file map (22 `src/server/` domains, `src/db/schema` 12 files, 24 migrations, tests 220 files by tier) | AGENTS.md §3 + live tree |
| A6 | How to read this repo: SPEC > ADR > tracker precedence; same-commit doctrine; squash ritual (1 PR = 1 main commit; canonical SHA = squash SHA — why the history is cleanly sequential); plan→execute→log cadence; docs/logs (117 files) as the forensic trail | CLAUDE.md §5/§7, AGENTS.md §10 |

### Part B — Build chronicle (~1,835 lines) — chapters in phase order

Ledger contract: **every one of the 218 first-parent commits appears exactly once in Part B**,
as `` - [`short`](…/commit/<full>) · [#N](…/pull/N) — subject — product tie ``. Deep-dives
(¶ blocks, 8–15 lines) at load-bearing commits only. Chapter = census row(s); partition is
therefore exact by construction (§2 sums to 218).

| Ch | Title | Census rows (count) | Weight | Deep-dives | Est. lines |
|---|---|---|---|---|---|
| B1 | Bootstrap & foundation | ROOT + FOUND (18) | touch | — | 45 |
| B2 | The specification lane | SPEC + PRECURSOR (7) | touch | spec-lock #63 | 40 |
| B3 | Scaffold: platform substrate | SCAFFOLD (35) | touch | mini-dives: #38 auth wiring, #47 R2 substrate, #50 identity pool, #54 CI+Postgres | 130 |
| B4 | Sync & cold-review interludes | SYNC (8) | touch | — | 35 |
| B5 | Design backbone (out-of-scope pointer) | DESIGN/DC (4) | ledger-only | — | 25 |
| B6 | **The market engine** | ENGINE (63) + #101 harness interlude (1) | **DEEP** | one per stratum: #69 E.0 vocabulary · #71 cpmm.md · #75 E.2 CPMM module · #79 E.3 property suite · #83 E.4 state machine · #87 E.5 Dharma ledger · #91 E.11 positions · #95 E.7 W-1 tx · #99 E.8 handlers · #104 E.12 daily credit · #110 E.13 initial grant · #114 E.9 resolution trio · #118 E.14 lifecycle W-4 · #122 E.15 wiring · #127 E.16 freeze guard · #131 E.10 scale gate · #49 E.6 events emission | 560 |
| B7 | **The debate & moderation layer** | DEBATE (21) | **DEEP** (incl. safety-critical framing of the moderation pipeline) | #136 reply-as-bet/INV-1 · #139 INV-3 side-freeze · #141 ADR-0021 reactive moderation · #143 consequence wiring · #152 D.5 markers · #155 D.8 ranking · #157 D.9 friendly-fire drop · #163 D.4 debate view | 330 |
| B8 | Auth hardening | FIX-AUTH (3) | medium | #149 additionalFields strip · #150 400-day cookie cap | 60 |
| B9 | Participant shell (out-of-scope pointer) | SHELL/UI (3) | ledger-only | — | 25 |
| B10 | **The deploy arc** | DEPLOY (16) + #178 interlude (1) | **DEEP** | #148 ADR-0022 migrate path · #164 ADR-0024 pipeline · #165 D1 health drift · #167 D2 CI gate · #170 D3 staging-as-replica · #176 D6 promote activation · #194 prod-drift incident | 250 |
| B11 | Export & media | EXPORT + MEDIA (8) | medium-deep | #180 debate .md export · #184 MEDIA.1 admin media | 120 |
| B12 | Descriptive-canon reconciliation | BC (7) | touch | — | 35 |
| B13 | The internal audit campaign | AUDIT (20) | touch + cross-ref | #201 seq/TRUNCATE · #202 durable receipts · #205 fused-CTE emit · #213 envelope+index · #216 cpmm 2.0.0 — everything else one ledger line + pointer to the EXTAUDIT package the audience already holds | 160 |
| B14 | Deploy-proof & sweep close-out | DP + SWEEP (3) + EXTAUDIT-05 lane strays landing before PIN_SHA | touch | — | 30 |

### Part C — Operating it (~450 lines, DEEP)

| § | Content | Sources |
|---|---|---|
| C1 | Environments — **honest divergence**: staging vs prod as adjudicated by **mandatory** live `GET /api/health` probes on both domains at execution time (§11 R2) — both JSONs excerpted with capture timestamps; behind-by figures computed `git rev-list --count <probed-canary>..<PIN_SHA>`; DP.2 pending, framed as the deploy discipline working (§11 ruling 3); migrate-before-serve rule. Prod state is narrated from the probes, never from DP-1/D5 docs | live probes, deploy-pipeline.md §1, ADR-0024 |
| C2 | Topology: Vercel (auto-serve OFF, custom `staging` env, `--scope` promote), two Supabase projects (session pooler, ap-south-1), Doppler `stg`/`prd`, R2 three arms, Upstash, Resend/Turnstile/Google, Sentry+PostHog | deploy-pipeline.md §1–§3, ADR-0006/0024 |
| C3 | CI/CD: `ci.yml` anatomy (Biome → tsc → drizzle-kit check → migrate → drift → vitest vs PG-17 service; pg_cron strip), branch protection (squash+signed+`ci` required), `env-audit.yml`, `staging-migrate.yml` | AGENTS.md §11, D2 logs |
| C4 | Crons & runbooks: 3 Vercel crons (close-due-markets 1min, alarms-drain 5min, r2-orphan-sweep 6h) + pg_cron (0007, 0011); runbook index (deploy-pipeline, BREAK_GLASS, dataset-release, moderation-smoke, staging-provisioning) | vercel.json, docs/runbooks/ |
| C5 | Test architecture: 220 files by tier; invariant-spec naming (`I-<AREA>-NNN`); the 10 invariant specs; trigger backstops; ENGINE.10 scale gate (tests/scale, 8 suites) | AGENTS.md §9 |
| C6 | Security posture: admin/participant structural separation, moderation fail-closed + CSAM stance, append-only storage guarantees, AUDIT campaign summary (~40 findings remediated across #197–#216) + **cross-refs into EXTAUDIT-01/03/04** (never duplicating their verification content) | CLAUDE.md §2–§3, AUDIT logs, EXTAUDIT package |
| C7 | Forward state: v16 ceilings baseline (SYNC-SWEEP.md §6), parked.md ledger, what testing-phase readiness means (DP.2, number-tuning 2026-09-01, conclusion freeze 2026-11-05) | SYNC-SWEEP.md, parked.md, SPEC.1 |

**Total estimate: ~2,700 lines .md** (Part A 350 + Part B 1,835 + Part C 450 + front-matter/index/
epilogue ~65). HTML ≈ 4,500–5,500 lines self-contained. Tolerance ±20%; thinning order if the
operator caps length: B13 dives → B10 dives → B3 mini-dives (B6/B7 protected — operator-ruled DEEP).

---

## 4. Snippet list — exact code sites (all paths verified on disk this session)

Rules: ≤25 lines per excerpt, `path:line` cited, illustrative only — **never full-file dumps**;
exact line ranges chosen at execution against PIN_SHA.

| # | Site | Shows | Chapter |
|---|---|---|---|
| 1 | `src/server/cpmm/decimal.ts` | CpmmDecimal constructor — decimal.js 10.6.0 pin, precision 50 | B6 |
| 2 | `src/server/cpmm/calculate.ts` | constant-product buy quote (fee-less, single-MM) | B6 |
| 3 | `src/server/markets/transitions.ts` | pure state-machine transition table (illegal = negative tests) | B6 |
| 4 | `src/server/bets/transaction.ts` | SERIALIZABLE + `FOR NO KEY UPDATE` + full-jitter retry on 40001/40P01 (ADR-0013) | B6 |
| 5 | `src/server/bets/place.ts` | W-1 ordered writes: comment → bet → ledger → position → event → receipt (INV-1 atomicity) | B6 |
| 6 | `src/server/idempotency/cache.ts` + `src/server/bets/replay.ts` | Redis window + durable `bet_receipts` pre-check / 23505 replay catch (ADR-0031) | B6 |
| 7 | `src/server/dharma/ledger.ts` | append-only entry + `balance_after` non-negative (INV-2) | B6 |
| 8 | `src/server/dharma/accrual.ts` | lazy UTC-day daily-credit accrual (I-DAILY-ONCE) | B6 |
| 9 | `src/server/resolution/basis.ts` | pro-rata payout basis (INV-4 spine) | B6 |
| 10 | `src/server/events/schemas.ts` | `EVENT_TYPES` const head (**live-counted at PIN_SHA — 24 values**, text + Zod contract; §11 R1 — never cite AGENTS.md §6 for this figure) | B6 |
| 11 | `drizzle/migrations/0002_events_partitioning.sql` | hand-written `PARTITION BY RANGE` (drizzle-kit excluded) | B6 |
| 12 | `drizzle/migrations/0003_append_only_triggers.sql` | Bucket-A reject function + trigger attach | B6/A4 |
| 13 | `tests/invariants/I-ATOMICITY-001.bet-comment-atomic.spec.ts` | rollback-everything assertion | B6 |
| 14 | `src/db/schema/bets.ts` + `src/db/schema/comments.ts` | circular FK lambda; `bets.comment_id` NOT NULL vs `comments.bet_id` deliberately nullable | B7 |
| 15 | `src/server/moderation/precommit.ts` | externals-before-tx + SETNX reservation + fail-closed terminal mapping (ADR-0014) | B7 |
| 16 | `src/lib/ranking.ts` (+ `ranking.config.ts`) | read-time Top composite / lane ordering head (ADR-0017) | B7 |
| 17 | `src/server/debate-export/serialize.ts` | masking-inherited `.md` export (ADR-0025) | B11 |
| 18 | `src/server/health/migration-drift.ts` | per-hash migration-drift gauge (ADR-0022/0024) | C1 |
| 19 | `.github/workflows/ci.yml` | gate step sequence (names only) | C3 |

---

## 5. `.md` → `.html` generation approach

- **Canonical = .md.** The HTML is generated from the final .md in the execution chat and never
  edited independently; any content fix lands in the .md first, HTML regenerated.
- Single self-contained file: all CSS inline; zero external requests (no fonts, no CDN, no
  images — CSP-safe, offline-openable). Minimal or no JS (sidebar is anchor links; scrollspy
  only if trivially inline).
- **Monochrome tracker-v16 dashboard styling**: true-neutral grey ramp, system font stack,
  fixed left sidebar (Part A/B/C → chapter anchors), sticky chapter headers, ledger tables,
  `<code>` blocks unhighlighted. **No product branding** (B1 unfinished — kickoff rule).
- Parity is machine-checked (§6 check 4): the h2/h3 heading sequence extracted from both files
  must match 1:1.
- Biome rider (§1.4) keeps the generated file out of `just check`'s scope; `ZUGZWANG_ENV=preview
  just verify` still runs as the repo gate.

## 6. Link-verification step — `scripts/verify-handover-links.sh`

Bash (git + gh only; no tsx/db chain), committed with the deck, exit non-zero on any failure,
run pre-PR and at every future refresh:

1. **SHA resolution** — every `…/commit/<40-hex>` in both deck files:
   `git cat-file -e <sha>^{commit}` AND `git merge-base --is-ancestor <sha> origin/main`.
2. **PR resolution** — every `…/pull/<n>` ∈ the census PR set derived live from
   `git log --first-parent` (+ {143,144,178}, − known-unmerged {58,146}); one full
   `gh pr view <n> --json state` pass asserting MERGED (rate-limit-tolerant, cached).
3. **Ledger completeness (two-way)** — the multiset of ledger SHAs extracted from Part B
   `== git log --first-parent --format=%H <PIN_SHA>` exactly — no commit missing, none twice.
4. **md↔html parity** — extracted heading sequences identical.

The deck's own PR is outside PIN_SHA history by construction (epilogue line carries its
`/pull/<n>` link only; its squash SHA is recorded in the follow-up log, not the deck).

## 7. Build sequence (execution chat)

0. **Re-ground**: `git fetch`; PIN_SHA = `origin/main`; census delta vs this plan (expected:
   this plan's PR + strays → absorbed into B14); confirm tip PR's `ci` green.
1. Branch `chore/extaudit-05-handover-deck`; **commit the ratified plan first** (§5.1).
2. Author `HANDOVER-DECK.md`: Part A → B (chapter-sized Writes; `wc -l` + tail check per Write —
   generated-file-tail discipline) → C. Ledger lines generated script-assisted from
   `git log --first-parent --format='%H|%h|%s'`, never hand-typed.
3. Write `scripts/verify-handover-links.sh`; run checks 1–3 → fix → green.
4. Generate `HANDOVER-DECK.html` from the final .md; run check 4; open in browser and eyeball
   sidebar/anchors/tables.
5. Biome rider (`!docs/handover`) + `ZUGZWANG_ENV=preview just verify` + `just check` green.
6. **Self-audit vs this plan, item by item** (§5.10-style PASS/FAIL/SURPRISE table in-session;
   docs-only PR ⇒ no subagent cascade, non-critical path).
7. Deck PR: deck .md + .html + script + biome rider + this plan. PR body: deliverables map +
   the census table + "no invariant surface touched".
8. Fallback session split (only if context forces it): clean boundary after step 3 (md verified);
   park branch + interim session log per §5.9 — never mid-chapter.
9. After merge: **log PR** — `docs/logs/EXTAUDIT-05.md` (six §5.9 fields + deviations + the deck
   PR's squash SHA read via `gh pr view --json mergeCommit`, never relayed).
10. Post-merge tree proof before telling the operator it shipped: `git diff <reviewed-SHA>
    origin/main` empty on the deck paths + grep one ledger line on main.

## 8. PK-refresh + close-out

- Export set for web project knowledge (basename-collision discipline — suffix, verify count=4):
  `HANDOVER-DECK.md`, `HANDOVER-DECK.html`, `EXTAUDIT-05-plan.md` (this file), `EXTAUDIT-05-log.md`.
- Operator uploads beside EXTAUDIT-00..04 in the web project; the deck becomes EXTAUDIT-package
  citable ("the deck" in review sessions).
- Closing ritual: CLAUDE.md/AGENTS.md unchanged expected (deck is descriptive); `docs/handover/`
  gains a mention only if AGENTS.md §3 tree is next swept (park it — don't sweep in-task).
- Refresh policy: if main moves materially before the live session (esp. **DP.2**), re-run §7
  steps 0+2(delta)+3+4 in a dated refresh PR; volatile sections (C1, C7) carry "as of PIN_SHA /
  date" stamps to bound staleness.

## 9. Open questions for the operator (relay to web — no AskUserQuestion)

1. **Naming**: `HANDOVER-DECK.{md,html}` as kickoff-specified (recommended), or
   `EXTAUDIT-05_HANDOVER-DECK.*` to match the external package's numbering convention?
2. **Cross-ref convention**: EXTAUDIT docs are not URL-addressable from the repo — deck cites
   them as `EXTAUDIT-03 §n` by filename+section. Confirm the team's filenames match the sighted
   set (00 START-HERE … 04 DEBATE-BODY + BRIEFING.html).
3. **DP.2 timing** vs the live session: land before (then C1 gets a refresh pass) or present the
   divergence as-is?
4. **Repo access**: will both reviewers have GitHub access to `zugzwang-foundation/experiment`
   at session time? (All 435+ hyperlinks assume it; SHAs/PR#s still work as identifiers offline.)
5. **Length budget**: ~2,700-line .md acceptable? If capped, confirm the §3 thinning order
   (B13 → B10 → B3 dives; B6/B7 protected).
6. **HTML sidebar depth**: chapters only (h2), or chapters + sections (h2+h3)?
7. **Live-session driver**: presented from the HTML (add per-chapter "TL;DR for the room"
   presenter boxes) or HTML-as-artifact only?
8. **Forward-state source (C7)**: in-repo only (SYNC-SWEEP §6 ceilings + parked.md), or will web
   relay tracker-v16 rows for a richer roadmap section? (Tracker is external per standing rule.)

## 10. Ratification checklist (what web sign-off covers)

- [ ] Census partition (§2) + the two interlude absorptions (#101→B6, #178→B10)
- [ ] Chapter map, weights, deep-dive list (§3)
- [ ] Snippet list (§4) — 19 sites, ≤25 lines each
- [ ] HTML approach + biome rider (§5, §1.4)
- [ ] Verification script as a committed artifact in bash (new pattern; repo scripts are tsx —
      justified: git/gh plumbing only, no DB/env chain)
- [ ] Two-PR close-out (deck PR → log PR) + PK export set (§7–§8)
- [ ] Answers to §9

---

## 11. Ratification record (2026-07-14, operator relay)

Plan ratified 2026-07-14. Rulings answer §9 one-to-one; corrections R1–R3 from web review
are patched into the plan body (§4 snippet 10, §3 C1) and honored in the deck.

### Rulings on §9

1. **Naming**: `docs/handover/EXTAUDIT-05_HANDOVER-DECK.md` + `.html` — package-numbered
   (supersedes the §1 `HANDOVER-DECK.*` working names; §8 export set inherits the new basenames).
2. **Cross-refs**: by ID+section (`EXTAUDIT-03 §n`). Issued set verified read-only via
   `ls ~/Downloads` at execution re-grounding — sighted exactly: `EXTAUDIT-00_START-HERE.md`,
   `EXTAUDIT-01_CHARTER.md`, `EXTAUDIT-02_OPERATING-MANUAL.md`, `EXTAUDIT-03_MATH-BODY.md`,
   `EXTAUDIT-04_DEBATE-BODY.md`, `EXTAUDIT_BRIEFING.html`. Match — no relay needed.
3. **DP.2 timing**: does NOT land first. C1 presents the staging/prod divergence as-is,
   framed as the deploy discipline working (gated promote pending soak) — not as debt.
4. **Repo access**: operator action; out of deck scope.
5. **Length**: ~2,700-line .md accepted. §3 thinning order is FALLBACK ONLY (B6/B7 protected).
6. **HTML sidebar**: two-level — h2 chapters + h3 sections.
7. **Presenter boxes**: per-chapter "TL;DR for the room" box in the HTML; mirrored in the .md
   as a blockquote directly under each chapter heading (preserves §6 check-4 heading parity).
8. **C7**: hybrid — in-repo citations (SYNC-SWEEP.md §6 ceilings, parked.md, SPEC.1 dates)
   PLUS the operator-supplied roadmap table, rendered verbatim under the label
   "Operator roadmap as of 2026-07-14 (external tracker v16) — sequencing snapshot, not a spec"
   (no rows extended, reordered, or invented).

### Corrections from web review

- **R1 — EVENT_TYPES**: the §4 snippet-10 "23" was stale (AGENTS.md §6 drift, flagged at #219
  for the next descriptive sweep). Deck prints the live count at PIN_SHA (expect 24 per
  SYNC-SWEEP §6; live count ≠ 24 → STOP and relay). AGENTS.md §6 is never cited for this
  figure anywhere in the deck. *(Verified at execution re-grounding: live count = 24.)*
- **R2 — Environments (C1)**: the `/api/health` capture is MANDATORY, not optional. Probe
  both `https://staging.zugzwangworld.com` and the prod domain per deploy-pipeline.md §1
  (`https://zugzwangworld.com`) at execution time; excerpt both JSONs with capture timestamps;
  compute behind-by from the probed serving SHA vs PIN_SHA
  (`git rev-list --count <probed>..<PIN>`). Payload lacking a commit field → derive the
  serving SHA per deploy-pipeline.md and note the method inline. Prod state is narrated from
  the probes — the plan §0 "3 doc-commits behind" line conflicts with other records; the
  probes adjudicate.
- **R3 — Chronology (A6)**: add one audience-facing sentence stating the convention —
  chapters are phase-grouped and near-chronological across, strictly main-order within;
  interleaves (FIX-AUTH, SHELL) are told as their own chapters with a merge-order footnote,
  so nobody reading `git log` thinks the deck reordered history.
