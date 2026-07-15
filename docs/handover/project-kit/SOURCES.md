# SOURCES.md — manifest of the reviewer Claude-Project folder

**Dated:** 2026-07-15 · **Pinned to:** `e28d4b6` (`origin/main`, the PR #223 squash)
**Contract:** every content file staged into this folder has exactly one row below
(60 rows: 48 repo files + 5 external package files + 7 kit files). The staging script
asserts this count against the staged folder and aborts on mismatch. `STAGING-RECEIPT.txt`
is written at staging time and is not a content file.

Row format: staged filename → source (repo path @ `e28d4b6`, or external) → role → currency.

---

## 1 · This kit (7)

| Staged file | Source | Role | Currency |
|---|---|---|---|
| `00_START-HERE-PROJECT.md` | `docs/handover/project-kit/` @ `e28d4b6` | Folder orientation, read order, numbering trap, REVIEW.md instruction | current |
| `SOURCES.md` | `docs/handover/project-kit/` @ `e28d4b6` | This manifest | current |
| `DELTA-NOTE.md` | `docs/handover/project-kit/` @ `e28d4b6` | `31d8965` → `e28d4b6` delta (package pin → kit pin) | current |
| `CONSTANTS.md` | `docs/handover/project-kit/` @ `e28d4b6` | Pinned vs deferred-to-tuning constants, with where each value lives | current |
| `DATA-MODEL.md` | `docs/handover/project-kit/` @ `e28d4b6` | 22 tables / 10 schema files, bucket map, the two deliberate asymmetries | current |
| `API-SURFACE.md` | `docs/handover/project-kit/` @ `e28d4b6` | Every live route, grouped, with auth posture + the wire envelope | current |
| `EVENT-CATALOGUE.md` | `docs/handover/project-kit/` @ `e28d4b6` | The 24 `EVENT_TYPES`, payloads, emit sites | current |

## 2 · The EXTAUDIT package (5 — external)

| Staged file | Source | Role | Currency |
|---|---|---|---|
| `EXTAUDIT-00_START-HERE.md` | external package, issued 2026-07-10, pinned `31d8965` | Package index + onboarding; the numbering-trap warning | current (see `DELTA-NOTE.md`) |
| `EXTAUDIT-01_CHARTER.md` | external package, issued 2026-07-10, pinned `31d8965` | Scope in/out, the five invariants as attack targets, rules of engagement | current |
| `EXTAUDIT-02_OPERATING-MANUAL.md` | external package, issued 2026-07-10, pinned `31d8965` | Bring-up, refute-first harness, findings template, severity rubric — **owns all process/findings mechanics** | current |
| `EXTAUDIT-03_MATH-BODY.md` | external package, issued 2026-07-10, pinned `31d8965` | Engine probes: CPMM, ledger, settlement, issuance (dev 1) | current |
| `EXTAUDIT-04_DEBATE-BODY.md` | external package, issued 2026-07-10, pinned `31d8965` | Social probes: reply, moderation, ranking, concurrency (dev 2) | current |

## 3 · Root canon (4)

| Staged file | Source | Role | Currency |
|---|---|---|---|
| `AGENTS.md` | `AGENTS.md` @ `e28d4b6` | Descriptive canon: stack, layout, conventions, enforced-vs-discipline | refreshed at #223 (more current than the deck pin) |
| `CLAUDE.md` | `CLAUDE.md` @ `e28d4b6` | The contract: invariants, refusal triggers, workflow rules | refreshed at #223 |
| `README.md` | `README.md` @ `e28d4b6` | Repo front door; points newcomers at the EXTAUDIT-05 deck | current |
| `SECURITY.md` | `SECURITY.md` @ `e28d4b6` | Vulnerability-reporting policy | current |

## 4 · Specs (5)

| Staged file | Source | Role | Currency |
|---|---|---|---|
| `SPEC.1.md` | `docs/specs/SPEC.1.md` @ `e28d4b6` | Product spec — flows, invariants, moderation tracks, ops floor | v1.0.14, current |
| `SPEC.2.md` | `docs/specs/SPEC.2.md` @ `e28d4b6` | Technical spec — architecture, table inventory, API/envelope, observability | v1.0.17, current |
| `cpmm.md` | `docs/specs/cpmm.md` @ `e28d4b6` | CPMM math spec — buy/sell/slippage/seed + arithmetic policy | v2.0.0, ratified |
| `RANKING.md` | `docs/specs/RANKING.md` @ `e28d4b6` | Debate-view ranking model (Top composite, lanes, interleave) | v1.0.0-draft — see rider |
| `debate-export.md` | `docs/specs/debate-export.md` @ `e28d4b6` | The `/m/[slug]/export` `.md` export contract (ADR-0025) | ratified |

> **RIDER — PhotoDNA (SPEC.1 / SPEC.2 / ADR-0014).** Some spec prose still names PhotoDNA
> in decided-voice. Built reality: the moderation gate is **OpenAI omni-moderation,
> fail-closed on terminal errors, with a Sentry CSAM escalation seam**
> (`csam_auto_report_pending`); PhotoDNA/NCMEC integration is **parked** (`parked.md`,
> two rows). Treat PhotoDNA as **NOT shipped** — matches EXTAUDIT-01 §6. Do not file the
> prose↔build gap as a finding.
>
> **RIDER — RANKING.md.** v1.0.0-draft and **deliberately unpinned**: every numeric
> constant in it (§12 — lane ratios, floors, gravity) defers to the 2026-09-01
> number-tuning pass. The *shape* is locked; the *numbers* are placeholders. Not drift.

## 5 · The handover deck (1)

| Staged file | Source | Role | Currency |
|---|---|---|---|
| `EXTAUDIT-05_HANDOVER-DECK.md` | `docs/handover/EXTAUDIT-05_HANDOVER-DECK.md` @ `e28d4b6` | The commit-sequenced walkthrough: Part A system map, Part B chronicle (218 commits), Part C ops | pinned `31d8965`; fully current for Parts A/B per `DELTA-NOTE.md` |

## 6 · ADRs (29 — every decision file on disk; `_template.md` excluded)

Numbering gaps are real: `0002` was never minted and `0012` never landed on disk
(recorded in SPEC.2 §22) — do not chase missing files.

| Staged file | Source | Role | Currency |
|---|---|---|---|
| `0001-license-choice.md` | `docs/adr/` @ `e28d4b6` | AGPL-3.0-or-later; forecloses closed-source forks | accepted |
| `0003-nextjs-16-app-router.md` | `docs/adr/` @ `e28d4b6` | Framework + Server-Action/Route-Handler taxonomy | accepted |
| `0004-better-auth.md` | `docs/adr/` @ `e28d4b6` | Participant auth stack (Google OAuth + email-OTP; session shape) | accepted (+P1 session-cap patch) |
| `0005-postgres-event-sourcing.md` | `docs/adr/` @ `e28d4b6` | The events spine + append-only Bucket A/B/C scheme | accepted |
| `0006-hosting.md` | `docs/adr/` @ `e28d4b6` | Vercel + Supabase + R2 + Upstash topology; cron carve-out | accepted |
| `0007-observability.md` | `docs/adr/` @ `e28d4b6` | Sentry + PostHog two-vendor posture; request_id; alarm catalogue | accepted |
| `0008-drizzle-orm.md` | `docs/adr/` @ `e28d4b6` | ORM, migration discipline, per-domain schema files, FK lambda form | accepted |
| `0009-ranking-function.md` | `docs/adr/` @ `e28d4b6` | The single-scalar ranking function | **superseded → ADR-0017** (historical) |
| `0010-admin-auth.md` | `docs/adr/` @ `e28d4b6` | Static-password admin path; `admin_sessions`; cookie discipline | accepted |
| `0011-pseudonym-pool-design.md` | `docs/adr/` @ `e28d4b6` | Identity-pool namespace (50,000) + asset pipeline | accepted |
| `0013-concurrency-bet-transaction.md` | `docs/adr/` @ `e28d4b6` | W-1: SERIALIZABLE + `FOR NO KEY UPDATE` + full-jitter retry | accepted |
| `0014-pre-commit-moderation-flow.md` | `docs/adr/` @ `e28d4b6` | Moderation outside the tx; fail-closed on terminal | accepted — see PhotoDNA rider (§4 above) |
| `0015-rate-limit-idempotency.md` | `docs/adr/` @ `e28d4b6` | Rate-limit fails open, idempotency fails closed; Idempotency-Key contract | accepted (+2026-07-06 transport patch) |
| `0016-id-schema-uuidv7.md` | `docs/adr/` @ `e28d4b6` | UUIDv7 PKs everywhere; URL-exposure rule | accepted |
| `0017-ranking-modes-and-top-composite.md` | `docs/adr/` @ `e28d4b6` | Reply-as-bet + the multi-mode Top composite (supersedes 0009) | accepted |
| `0018-dharma-issuance-and-bet-floors.md` | `docs/adr/` @ `e28d4b6` | Issuance (grant + Daily Credit) + the two stake floors | accepted |
| `0019-rls-out-of-scope-experiment.md` | `docs/adr/` @ `e28d4b6` | RLS out of scope for the experiment | accepted |
| `0020-decoupled-content-removal.md` | `docs/adr/` @ `e28d4b6` | Content-removal ↔ user-ban decoupling + held queue | **superseded → ADR-0021** (decoupling retained; queue removed) |
| `0021-reactive-moderation-no-held-queue.md` | `docs/adr/` @ `e28d4b6` | Reactive moderation; gate returns block/pass; no held queue | accepted |
| `0022-prod-migration-strategy-and-drift-guard.md` | `docs/adr/` @ `e28d4b6` | Per-migration-tx prod migrate; env-fragment guard; drift field | accepted; drift method **partially superseded → ADR-0024** |
| `0023-participant-shell-topology.md` | `docs/adr/` @ `e28d4b6` | `(public)/` route group; server-component shell; `/m/[slug]` | accepted |
| `0024-deploy-pipeline-migration-sequencing.md` | `docs/adr/` @ `e28d4b6` | Staging-as-replica pipeline; migrate-before-serve; health gate | accepted |
| `0025-debate-md-export.md` | `docs/adr/` @ `e28d4b6` | On-demand read-only debate `.md` export | accepted |
| `0026-market-media.md` | `docs/adr/` @ `e28d4b6` | Admin-set per-market media pool (`market_media`, third R2 arm) | accepted (composer-pick column build-deferred — see `DATA-MODEL.md`) |
| `0027-admin-market-media-direct-upload.md` | `docs/adr/` @ `e28d4b6` | Admin direct-upload path for market media | accepted |
| `0028-moderated-image-byte-identity-binding.md` | `docs/adr/` @ `e28d4b6` | Moderated bytes = served bytes (ETag/byte-size binding) | accepted |
| `0029-dharma-ledger-total-order-contract.md` | `docs/adr/` @ `e28d4b6` | `dharma_ledger.seq` total order; balance reads order on `seq` | accepted |
| `0030-truncate-rejection-append-only.md` | `docs/adr/` @ `e28d4b6` | Statement-level TRUNCATE guards on Bucket A/B | accepted |
| `0031-durable-bet-receipts-and-terminal-error-mapping.md` | `docs/adr/` @ `e28d4b6` | `bet_receipts` durable idempotency + the terminal error-mapping contract | accepted |

## 7 · References, runbooks in scope, registers (4)

| Staged file | Source | Role | Currency |
|---|---|---|---|
| `manifold.md` | `docs/references/manifold.md` @ `e28d4b6` | CPMM lineage map — attribution pin (fork tag `ref-2026-04-28-found5`, commit `d5b55cf`); the EXTAUDIT-03 differential-harness reference | current |
| `dataset-release.md` | `docs/runbooks/dataset-release.md` @ `e28d4b6` | The 2026-11-06 public-dataset release procedure (in charter scope: dataset story) | current |
| `DEBATE.7-moderation-smoke.md` | `docs/runbooks/DEBATE.7-moderation-smoke.md` @ `e28d4b6` | Moderation-pipeline smoke procedure (safety-critical surface) | current |
| `parked.md` | `docs/parked.md` @ `e28d4b6` | The known-state register: deferred work + accepted risks, each with trigger | current — see rider |

> **RIDER — `parked.md` security-gap rows.** Its two security-gap families — the
> **XFF leftmost-token trust chain** (seven call sites, enumerated in
> `docs/logs/AUDIT-INV-A12.md`; confirmed consistency-hardening, not a live spoof, since
> Vercel overwrites inbound XFF) and the **first-request CSRF gap** on the cookie-less
> Better Auth sign-in paths — are **KNOWN and parked on the pre-launch harden register**.
> Do not re-file them as findings; new *adjacent* findings are of course in scope.

## 8 · Logs in scope (4)

| Staged file | Source | Role | Currency |
|---|---|---|---|
| `ENGINE-phase-record.md` | `docs/logs/ENGINE-phase-record.md` @ `e28d4b6` | The consolidated ENGINE-arc record (the market engine build) | current |
| `INCIDENT-2026-07-02-prod-migration-drift.md` | `docs/logs/INCIDENT-2026-07-02-prod-migration-drift.md` @ `e28d4b6` | The one production incident: migration drift + the drizzle-orm #5769 lesson | current |
| `SYNC-SWEEP.md` | `docs/logs/SYNC-SWEEP.md` @ `e28d4b6` | The doc-reconciliation sweep that produced SPEC.1 1.0.14 / SPEC.2 1.0.17 | current |
| `EXTAUDIT-05.md` | `docs/logs/EXTAUDIT-05.md` @ `e28d4b6` | Deck close-out log — how the deck was built + verified | current |

## 9 · Briefs (1)

| Staged file | Source | Role | Currency |
|---|---|---|---|
| `SCAFFOLD.16-technical-research-brief.md` | `docs/briefs/SCAFFOLD.16-technical-research-brief.md` @ `e28d4b6` | Moderation vendor research — why OpenAI-only shipped; R-1/R-2/R-3 deferred hardening | current (decisions since absorbed into SPEC/ADR/parked) |

---

## Not in this folder (deliberate exclusions)

- `docs/specs/flows/` — **38 intentionally-skeleton placeholder stubs** ("substance
  pending per SPEC.2 §13.4 gating cadence"). Excluded; do not chase them — the flow
  substance lives in SPEC.1 §7–§15.
- `docs/runbooks/deploy-pipeline.md`, `docs/runbooks/BREAK_GLASS.md`,
  `docs/runbooks/staging-provisioning.md` — ops **procedure** (out of charter scope);
  the deck's Part C carries the operating story you need.
- `EXTAUDIT_BRIEFING.html` — an HTML render of the package you already hold as markdown.
- The design corpus, the planning tracker (`tracker_v16`, operator-held), `docs/plans/`,
  and the remaining `docs/logs/` (per-task session logs) — planning/sequencing and
  design lanes, out of BACKEND + OPS scope.
- `CODE_OF_CONDUCT.md`, `THIRD_PARTY_NOTICES.md` — in the repo if needed; not review
  surface.

*EXTAUDIT-06 kit · file 2 of 7 · row count 60 = 48 repo + 5 package + 7 kit.*
