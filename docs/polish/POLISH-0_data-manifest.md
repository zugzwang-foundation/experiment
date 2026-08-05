# POLISH — Data Manifest

> **Doc:** `POLISH-0_data-manifest.md` · web-authored. Deliverable #4 of POLISH.0.
> **Status:** **v1.1** — 2026-08-05 IST. Supersedes the uncommitted v1.0-draft of 2026-07-30.
> **Consumed by:** **STAGING-PARITY** — this is its build target. Also read by POLISH.1–.8 to know which states are reachable.
> **Governed by:** `POLISH-0.md` §6 (environment) and §7 (exit bar).

**Why this exists.** The exit bar requires *"all states rendered."* That clause **is** a data requirement, restated. Without it written down, whoever specs STAGING-PARITY has to reverse-engineer POLISH's needs from an inspection checklist — which works, badly, and puts a design-lane requirement inside a code-lane spec where the two can drift.

**What this is not.** It is not a seed script, and it is not market content. It says *what shapes must exist*; STAGING-PARITY decides how to produce them.

---

## §0 · Amendment record — what changed at v1.1

v1.0-draft was authored 2026-07-30 and **never committed to the repo**, which was itself the finding that produced this version. STAGING-PARITY's RECON-1 (2026-08-05, `origin/main` @ `731be431`) established five facts that change the manifest. Each amendment names the ruling that carries it.

| # | Amendment | Ruling | Recon evidence |
|---|---|---|---|
| **A1** | **M9 (Frozen market) moves from §2.1 to §3 — permanently unreachable on staging.** A new hard constraint §1.8 forbids ever freezing staging | **R4** | No freeze write function exists anywhere in `src/` — only the read at `src/server/system/is-frozen.ts:12–19`, whose own comment assigns the flip to HARDEN.10's `pg_cron` job. `system_state.frozen_at` is a one-shot `NULL→timestamp` transition enforced by `enforce_system_state_frozen_at` (`0003:169–186`). **It cannot be unset.** Setting it renders staging read-only permanently |
| **A2** | **Graph x-domain confirmed HARD-PINNED.** The §3 row is upgraded from "verify first" to a settled finding, and the remedy is routed to its own task | **R5** | `WINDOW_START = "2026-09-15T00:00:00.000Z"` / `WINDOW_END = "2026-11-05T23:59:00.000Z"` are module-private consts at `src/server/profile/graph-series.ts:31–34`, gating the sample grid at `:399–417` and returned verbatim as `windowStart`/`windowEnd` at `:437–438`. Zero `process.env` in `src/server/config/limits.ts`; no override path exists |
| **A3** | **§4 gains two gates** — magnitudes (G5) and zero-share (G6) | — | `tests/unit/profile/tile-identity.test.ts` was proven structurally blind at PRIMITIVES-1 P10: six tests, a dedicated `describe` for `displayNetProfitLoss`, every assertion sub-thousand, stayed GREEN with the grouping wrapper deleted. Current staging fixtures repeat the failure one layer up |
| **A4** | **§1.3 amplified** — the generator will likely execute inside a Next request context, not as a plain `tsx` script | **R3 / R3a** | `src/server/auth/index.ts` imports `@/db` (server-only); `acceptTosAction` reads a signed `onboarding_ref` cookie via `cookies()` (`tos-accept.ts:85–96`); all five market lifecycle wires and `moderateComment` are Server Actions behind `requireAdminSession()`, not HTTP routes |
| **A5** | **§1 gains constraint 9** — the reset half of the generator is a guarded, audited artifact | **R2 / R2a** | `DELETE` blocked by `bucket_a_no_delete` / `bucket_b_no_delete` on 13 base tables plus 13 `events_*` partitions (`0003`, `0022:27`). `TRUNCATE` **also** blocked — `0021_truncate_guards.sql:39–45` adds statement-level triggers on every protected table and each partition individually. Only owner-privilege `ALTER TABLE … DISABLE TRIGGER` gets through; the `postgres` role owns all app tables |

**Withdrawn at v1.1.** The v1.0 concern that four-digit Đ magnitudes might be unreachable at the ratified economy is **closed, engine-legally**. `accrueDailyCredit` posts the 10 Đ allowance *before* the affordability check inside `place`, so a fresh participant's first betting day opens at **1010 Đ** — one post-bet of 1000–1010 Đ lands a four-digit staked figure on every per-user surface with no config change. `openMarket`'s `seedAmount` has no ceiling (`open.ts`), so four-digit realised P/L follows from a generously seeded market plus `settleMarket`'s pro-rata payout. No admin grant/mint action exists and none is needed.

---

## §1 · Hard constraints

Non-negotiable. Each has a reason, and the reasons are load-bearing.

| # | Constraint | Why |
|---|---|---|
| **1** | **Every row is produced by driving the real engine** — `openMarket` · `place` · `sell` · the admin actions. **No hand-written events, ever.** | Staging today has 37 of 39 `bets` rows with no corresponding event because fixture scripts bypass the engine. A second event-writing implementation is a divergent source of truth, and it dissolves the property that makes integrity verification conclusive |
| **2** | **Dharma conservation holds after generation.** `src/server/dharma/conservation.ts` passes against the generated set | If the fixture set doesn't conserve, no inspection downstream of it means anything |
| **3** | **Deterministic and re-runnable.** A committed generator, seeded RNG, idempotent or cleanly re-creatable. **⚠ v1.1:** it will likely run inside a Next request context (non-prod-gated route handler), not as a plain `tsx` script — see §0 A4 | POLISH runs across weeks. A fixture set nobody can reproduce is a fixture set nobody can trust after the first bug fix |
| **4** | **Throwaway market questions only.** **Do not seed CONTENT.1's real questions.** | CONTENT.1 is founder-serial and unlaunched. Burning real questions into a shared staging env pre-launch leaks them and wastes founder work |
| **5** | **Pseudonyms come from the pool** (ADR-0011). No hand-written identities | The pool is the identity mechanism; bypassing it produces users the product could never have made. `consumeIdentityPoolTuple` fires on every create and throws `identity_pool_exhausted` when dry — staging holds 200 tuples, 194 unassigned |
| **6** | **The seeding admin holds no position and authors no comment** | Admin is not a participant, structurally. A fixture set that violates it makes POLISH.8's hard invariant check untestable |
| **7** | **No real personal data.** No real emails beyond the operator's own test addresses | Public dataset release is Nov 6 |
| **8** | ⚠ **NEW v1.1 — staging is NEVER frozen.** Nothing writes `system_state.frozen_at`. Not a script, not a migration, not a manual `UPDATE` | The transition is one-shot and trigger-enforced. Setting it makes staging read-only **permanently**, with no undo short of a schema rebuild. There is deliberately no write path in `src/`; do not add one to satisfy M9 |
| **9** | ⚠ **NEW v1.1 — the reset path is a guarded artifact.** Any script that disables append-only triggers must: refuse to run unless the `DATABASE_URL_STAGING` + project-ref-fragment guard passes **and** the environment is not prod; re-enable every trigger in a `finally`; verify all triggers are back on and exit non-zero if not; ship behind the full ritual including `@security-auditor`, with an ADR | It is a script whose job is to switch off the enforcement that makes the ledger credible. The existing precedent (`tests/db/_fixtures/truncate.ts:65–81`) is deliberately test-only. Promoting that pattern to a committed operational script is a decision, not a convenience |

---

## §2 · The fixture set

### §2.1 · Markets — one per lifecycle state

`LifecycleBadge`'s TERMINAL set is `Closed · Resolving · Resolved · Voided · Frozen`; `Open` and `Draft` are the non-terminal pair.

| # | State | Purpose | Notes |
|---|---|---|---|
| M1 | **Draft** | Admin surface; and `/m/<draft-slug>` **404s** — the R3 not-found path | The only way to reach a Draft slug is by knowing it |
| M2 | **Open**, heavily active | The primary POLISH.3 subject | See §2.3 for its content shape |
| M3 | **Open**, lightly active | Graceful degradation — no post clears `k_lane`, so **no badges render** and Top falls back to closest-to-landslide | Proves the majority-carry-no-badge criterion |
| M4 | **Open**, brand new | Both `EmptySideCTA` slots — *"Be the first to argue YES / NO"* | Zero posts |
| M5 | **Closed** | Read-only; all write affordances gated | `closeMarket` (`markets/close.ts:33`) |
| M6 | **Resolving** | Read-only; distinct badge | `triggerResolution` (`resolution/trigger.ts:30`) |
| M7 | **Resolved** | Read-only; settled positions on the Profile side | Resolve to **YES**. `settleMarket` (`resolution/settle.ts:32`) |
| M8 | **Voided** | Read-only; the void path differs from resolve | `voidMarket` (`resolution/void.ts:34`) |
| ~~M9~~ | ~~**Frozen**~~ | ⚠ **MOVED TO §3 at v1.1 — unreachable. Do not attempt.** See §1.8 | — |
| M10…M(9+k) | **Open**, filler | Enough total Open markets to fill Discovery's hero + full grid — **`DISCOVERY_GRID_SIZE` + 1** | Content can be thin |

### §2.2 · Participants

**8–10 pooled pseudonymous accounts.** Named roles, not real people.

| Role | Must have |
|---|---|
| **P-owner** | The operator's own account — the **owner arm** of Profile, positions, bookmarks. Posts and replies on both sides across several markets |
| **P-visitor-target** | A well-populated profile viewed as a **visitor** — proves the DTO split (no `sellEligible` field on the visitor arm) |
| **P-empty** | A pooled account with **zero** posts, replies, positions and bookmarks — every empty state on Profile at once |
| **P-flipped** | Holds a position it **flipped** — the `Flipped` marker, and the graph's flip rim |
| **P-exited** | **Fully sold out** of a position — the `Exited` marker |
| **P-removed** | An author with **one removed comment** and one surviving one — masking without a ban |
| **P-banned** | Banned, **whose past content survives** — ADR-0021: ban removes voice, not past content. Distinct from removal |
| **P-crowd** ×3–4 | Volume for lane dominance, reply counts, and the interleave |

**⚠ v1.1 note on cost.** Only four of the sixteen users currently on staging were engine-created, and only two carry any content. `RedOtter002` (the operator's account) is **banned** and holds 23 of the 37 invalid rows. Assume nearly the full roster is built from scratch, and cost the auth path explicitly — it is the largest single line item in this task.

### §2.3 · Content on M2 (the primary Market Detail subject)

| # | Shape | Serves |
|---|---|---|
| C1 | Posts on **both** sides, both slots populated | Base render |
| C2 | Posts totalling **`LATEST_INTERLEAVE_INTERVAL` + 2** | Proves the P2 latest-interleave fires at least twice |
| C3 | **One post dominating each of the three lanes** — Most Debated (`n`) · Highest Stakes (`Đ`) · Contested (`n^b`) | Each badge renders at least once |
| C4 | **Most posts dominating no lane** | The majority-carry-no-badge criterion |
| C5 | A post with **many replies on both sides** | `ReplySplitBar` proportions · `ReplyPreview` expand · reply stake-ordering within side |
| C6 | A post with **zero replies** | The empty reply state inside a populated market |
| C7 | A post with an **attached image** | `--imgmax` 160px in-card clip **and** whole-render in the pop-up (R14) |
| C8 | A post long enough to **truncate** | The "Read more" affordance (PD-0-01) |
| C9 | A **removed post** with surviving replies | Removal masking with thread integrity — the structural property, visible |
| C10 | A **removed reply** under a present post | The reply-level masked variant |
| C11 | Enough price movement for a **multi-point chart** with post nodes | All four UI.19 render variants |

### §2.4 · Positions and bookmarks

| # | Shape | Serves |
|---|---|---|
| Q1 | An **open sellable** position | The Sell affordance renders |
| Q2 | A position on a **terminal** market | Sell is **hidden**, not disabled (PD-0-12) |
| Q3 | A **settled** position post-resolution | Net P/L on the winning and losing sides |
| Q4 | A viewer **holding YES** on M2 | The **opposite-slot rule** — the NO composer is `oppositeHeld`-disabled |
| Q5 | Zero positions | Empty `PositionsTable`, owner and visitor copy |
| B1 | Bookmarks on **others'** posts **and** replies | Staked / Current are the **bookmarked author's** figures (canon §4 ruling 1) |
| B2 | Zero bookmarks | Empty Bookmarks page |

### §2.5 · Moderation

All three shapes are produced by one function: `moderateComment({ action: "remove" | "ban" })` at `src/server/admin/moderation/act.ts:60`, a Server Action behind `requireAdminSession()`.

| # | Shape | Serves |
|---|---|---|
| X1 | One `content_removed` **mod action** on a post | Feeds C9 and the audit surface |
| X2 | One on a **reply** | Feeds C10 |
| X3 | One **banned author with surviving content** | POLISH.8 review feed; and the ADR-0021 distinction on the participant side |
| X4 | Enough `mod_actions` rows to make the **audit feed** paginate | POLISH.8's search and cursor paths |

---

## §3 · States that are unreachable, and why

Naming these prevents eight surfaces from each independently discovering them. Each becomes **`data-blocked` by construction**, not by accident.

| State | Why unreachable | Handling |
|---|---|---|
| **Frozen market (ex-M9)** ⚠ **NEW v1.1** | No freeze write path exists in `src/`, and `system_state.frozen_at` is a one-shot trigger-enforced transition. Setting it bricks staging permanently — see §1.8 | Inspect on a throwaway database, once, and record the capture. **Never on staging, under any pressure** |
| **Empty Discovery** | It requires **zero** Open markets, which is mutually exclusive with §2.1's `DISCOVERY_GRID_SIZE + 1`. One shared env cannot hold both | Inspect on a preview DB or local, once, and record the capture. Do **not** empty staging to see it |
| **Turnstile states** | Not wired — placeholder token, staging on always-pass test keys | `data-blocked` pending AUTH-TURNSTILE-WIRE (PD-0-14) |
| **Live-window polling behaviour** | F-DEBATE-4 is unverified and may be unbuilt (B3) | `data-blocked` pending B3 |
| **Cron-driven transitions** | Crons do not auto-fire on a branch deploy — `vercel.json` declares three with no per-env gating, and Vercel fires them only against Production | Drive the transitions via the admin actions instead. The external-scheduler fix is **STAGING-PARITY-ENV**, its own row, sequenced before TESTING.0 |
| **⚠ Graph x-domain** — SETTLED at v1.1 | The x-domain is hard-pinned to Sep 15 → Nov 5 2026 as module-private consts at `graph-series.ts:31–34`, with no env or config override. Engine-generated data carries `created_at = now`, so August points are filtered out at `:402/:409/:415` before reaching the chart, leaving only the two boundary samples. Backdating `created_at` is **forbidden** — it would mean writing timestamps the engine cannot produce | `data-blocked` for POLISH.5's graph criteria. Remedy routed to **GRAPH-WINDOW-OVERRIDE**: a small task making the window overridable on non-prod, behind a **SPEC.1 §23 rider**, landing before it. GRAPH-STAGING-CHECK's acceptance depends on that task, not on this one |
| **Real ToS / Privacy bodies** | Lorem-ipsum pending LEGAL.1 | Content-blocked, one element on `/onboarding` |

---

## §4 · Verification

STAGING-PARITY is not done until **all six** pass. Gates 1–4 are v1.0's; gates 5–6 are new at v1.1 (§0 A3).

| # | Gate | Check |
|---|---|---|
| **1** | **Event parity** — every `bets` row has a corresponding event. The current 37-of-39 gap is zero | `SELECT count(*) FROM bets b WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.aggregate_id = b.id AND e.event_type = 'bet.placed')` → **0**. No assertion for this exists in the repo today; the generator's close-out adds one |
| **2** | **Conservation** — `src/server/dharma/conservation.ts` passes against the generated set | `checkMarketConservation` (`:35`). Server-only, no package script, test-callers only — needs a wrapper |
| **3** | **Replay** — `src/server/bets/replay.ts` reproduces current state from the event log | Same server-only constraint |
| **4** | **Coverage** — every row in §2 exists and is reachable by URL | Produce the URL list; POLISH.1–.8 navigate from it |
| **5** | ⚠ **Magnitudes** — **at least one four-digit Đ figure on every Đ-rendering surface class**: profile §23 tiles, positions table, discovery staked totals, composer amounts, header Portfolio and Balance | Written as acceptance criteria, never as prose. The point is to make comma-grouping observable; requiring *every* figure to be four-digit would forbid the small-magnitude cases §2 also needs |
| **6** | ⚠ **Zero `share_quantity = 0` rows** on completion | So SP-2's `CHECK (share_quantity > 0)` migration — its own task, sequenced after this one — meets no violating rows |

**Then:** capture the coverage list into `POLISH-register.md` as the standing reference, so an inspector never hunts for "the market that has a removed post."

---

*v1.0-draft authored by web Claude, 2026-07-30 IST. v1.1 amendments authored 2026-08-05 IST from STAGING-PARITY RECON-1 against `origin/main` @ `731be431`. Constants named in caps (`DISCOVERY_GRID_SIZE`, `LATEST_INTERLEAVE_INTERVAL`, `k_lane`, `floor_lane`) are owned by `RANKING.md` and `limits.ts` and pin at the 2026-09-01 number-tuning pass — this manifest references them, never sets them.*
