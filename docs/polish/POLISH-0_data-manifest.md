# POLISH — Data Manifest

> **Doc:** `POLISH-0_data-manifest.md` · web-authored. Deliverable #4 of POLISH.0.
> **Status:** **v1.4** — 2026-08-08 IST. Supersedes v1.3 (2026-08-06).
> **Consumed by:** **STAGING-PARITY** — this is its build target. Also read by POLISH.1–.8 to know which states are reachable.
> **Governed by:** `POLISH-0.md` §6 (environment) and §7 (exit bar) · `docs/plans/STAGING-PARITY.md` + its Ratification Record · ADR-0035 · ADR-0036.

**Why this exists.** The exit bar requires *"all states rendered."* That clause **is** a data requirement, restated. Without it written down, whoever specs STAGING-PARITY has to reverse-engineer POLISH's needs from an inspection checklist — which works, badly, and puts a design-lane requirement inside a code-lane spec where the two can drift.

**What this is not.** It is not a seed script, and it is not market content. It says *what shapes must exist*; STAGING-PARITY decides how to produce them.

---

## §0 · Amendment record

### v1.4 — 2026-08-08 · from SYNC-1 (the D.4 V-renumber, executed)

| # | Amendment | Detail |
|---|---|---|
| **D1** | **§5's lessons are numbered, and the numbering is V-space** | STAGING-PARITY **D.4 (2026-08-07) ruled the renumber out of L-space**; the ruling landed as a routing sentence and **the renumbering itself never executed**. This amendment executes it. §5's four unnumbered bullets become **V-1…V-4 in place**, in the order they already stood, and §5 is declared their canonical home. |
| **D2** | **The L-space collision that forced it** | Three registers were all using the bare form `L-n` at once: the verification lessons (here), the PRIMITIVES-1 Gate C reviewer LOWs (`POLISH-register-ADDITIONS.md`), and task-scoped `@security-auditor` LOWs (F-DEBATE-4). Each held a distinct **L-2**, so `L-2` resolved to nothing — which is why it read as *missing* rather than as *ambiguous*. Only the `SA-L-n` set had disambiguated itself with a prefix. |
| **D3** | **V-5 added** — negative controls must SPAN failure classes | Promoted from the STAGING-PARITY close-out, where it was carried as "L-8, successor to L-1 and L-2". It is now **V-5, successor to V-1 and V-2**, and its text lands here rather than only in a session log. |
| **D4** | **Root cause: the register lived only in a PK document** | V-1…V-5 were numbered against `STAGING-PARITY_operating-plan_v1_0.md`, which is **project-knowledge only and not on `main`**. A repo-side reader could see every citation and no definition, so nothing on `main` could adjudicate a collision or detect a gap. The register is committed here for that reason. Same failure class as the `L-8` succession note and the five `V-1…V-5` "(web-side — paste in)" placeholders in `STAGING-PARITY-closeout.md` §3, both closed in the same commit. |

### v1.3 — 2026-08-06 · from Slice B

| # | Amendment | Detail |
|---|---|---|
| **C1** | **Gate 3 renamed to what it verifies** | v1.0–v1.2 described `loadDurableReplay` as reproducing state from the event log. It does not. Per ADR-0031 it is the **durable idempotency backstop**: it reads `bet_receipts` and answers a retried request with the original response, because `newPrice` is persisted nowhere and must be stored rather than re-derived. The gate always asserted what the function does; the description was wrong. Seventh instance of a document describing a control as doing something other than what it does |
| **C2** | **G1.6 added — event/row CONTENT parity** | Correcting C1 alone would silently shrink the exit bar. Gate 1 proves an event **exists** per row; G1.6 proves it **agrees** with the row. Co-existence is not agreement |

### v1.2 — 2026-08-06 · from the Ratification Record §8 and Slice A

| # | Amendment | Source | Detail |
|---|---|---|---|
| **B1** | **§1.9 corrected — atomicity is primary, `finally` is a belt** | Ratification Record §5 W-A; ADR-0035 primitive 2 | v1.1 prescribed a `try/finally` re-enable as the guarantee. It is the **weaker** mechanism: `finally` does not run on `SIGKILL`, OOM, or a dropped socket. The single `client.unsafe()` batch is one implicit transaction and `ALTER TABLE … DISABLE TRIGGER` is transactional DDL, so any abort rolls the disable back. **Measured, not argued** — `SET LOCAL` alone reads `"0"` with `WARNING 25P01`; inside the batch it reads `"15s"`; a `DISABLE` followed by an in-batch failure leaves `tgenabled = 'O'` |
| **B2** | **§4 gate 1 broadened** to event parity across **all state-mutating flows** | Ratification Record ruling 3 | The `bets ↔ bet.placed` query was one instance of a wider corruption class. Staging carried a market at `status = 'Resolved'` with **zero `resolution_events` and zero `payout_events`** — hand-set. Gate 1 now covers bets, comments, market lifecycle and resolution |
| **B3** | **X4 moved from §2.5 to §3** — unreachable, recorded as a **product** gap | Ratification Record OQ-2 | `AUDIT_FEED_DEFAULT_LIMIT = 200`, and the page hard-codes `ROW_LIMIT` with no wiring to reach it. **There is no pagination in the audit surface at all.** Generating >200 removals to exercise a paginator that does not exist costs a session; building pagination is a UI feature needing its own POLISH.8 ruling |
| **B4** | **§1.3 — a literal fixture table is permitted, and is the stronger form** | Ratification Record; plan Q4 | v1.1 said "seeded RNG." A hand-written fixture table is strictly more deterministic: no seed to lose, no generator version to reproduce. At ~14 markets and ~150 engine calls it is also shorter |
| **B5** | **§1.7 — synthetic-literal rule made explicit** | Ratification Record §5 W-C | `acceptTosAction` writes `tos_acceptance_ip` and `tos_acceptance_user_agent` from mocked headers. These land in a database published on 2026-11-06 |
| **B6** | **§0 A4 retired — empirically disproven** | Ratification Record §5; plan S1 | v1.1 predicted the generator would "likely" need a Next request context. A spike found **three** independent blockers to a plain `tsx` script, and a Vitest context clears all three. **No route handler is needed, and none should be added** (ADR-0036) |
| **B7** | **The 1010 Đ note corrected** | Ratification Record §5 W-D | v1.1's withdrawal said P-empty and P-visitor-target "both open their first betting day at 1010." `accrueDailyCredit` fires **inside `place()`**, so a participant who never bets never accrues. **P-empty sits at exactly 1000** — which is still four-digit, so gate 5 holds; the carrier assignment moves |

**Also settled at Slice A, no amendment needed.** Participant creation is two calls per user — `createOAuthUser` then `acceptTosAction` — both with committed precedent in-tree. §2.2's v1.1 cost note stands withdrawn.

### v1.1 — 2026-08-05 · from STAGING-PARITY RECON-1

| # | Amendment | Detail |
|---|---|---|
| **A1** | **M9 (Frozen) moved to §3 — permanently unreachable.** New hard constraint §1.8 forbids ever freezing staging | No freeze write path exists in `src/`; `system_state.frozen_at` is a one-shot `NULL→timestamp` transition enforced by `enforce_system_state_frozen_at`. **It cannot be unset** |
| **A2** | **Graph x-domain confirmed HARD-PINNED**, remedy routed to its own task | Module-private consts at `graph-series.ts:31–34`, no env or config override path |
| **A3** | **§4 gains two gates** — magnitudes (G5) and zero-share (G6) | `tile-identity.test.ts` was proven structurally blind: six tests, every assertion sub-thousand, stayed GREEN with the grouping wrapper deleted |
| ~~A4~~ | ~~Generator likely runs inside a Next request context~~ | **RETIRED at v1.2 — see B6** |
| **A5** | **§1 gains constraint 9** — the reset is a guarded, audited artifact | `DELETE` and `TRUNCATE` both blocked; only owner-privilege `DISABLE TRIGGER` gets through |

---

## §1 · Hard constraints

Non-negotiable. Each has a reason, and the reasons are load-bearing.

| # | Constraint | Why |
|---|---|---|
| **1** | **Every row is produced by driving the real engine** — `openMarket` · `place` · `sell` · the admin actions. **No hand-written events, ever.** | Staging carried 37 of 39 `bets` rows with no corresponding event because fixture scripts bypassed the engine. A second event-writing implementation is a divergent source of truth |
| **2** | **Dharma conservation holds after generation.** `checkMarketConservation` passes against the generated set | If the fixture set doesn't conserve, no inspection downstream of it means anything |
| **3** | **Deterministic and re-runnable.** A committed generator, **a literal fixture table or a seeded RNG** — the fixture table is the stronger form (B4) — idempotent or cleanly re-creatable. It runs as a **Vitest-context operational runner** under `tests/staging/`, per ADR-0036. **No route handler** (B6) | POLISH runs across weeks. A fixture set nobody can reproduce is one nobody can trust after the first bug fix |
| **4** | **Throwaway market questions only.** **Do not seed CONTENT.1's real questions.** | CONTENT.1 is founder-serial and unlaunched. Burning real questions into a shared pre-launch env leaks them and wastes founder work |
| **5** | **Pseudonyms come from the pool** (ADR-0011). No hand-written identities | `consumeIdentityPoolTuple` fires on every create and throws `identity_pool_exhausted` when dry. The reset truncates and re-seeds so consumption does not accumulate across runs |
| **6** | **The seeding admin holds no position and authors no comment** | Admin is not a participant, structurally. A fixture set that violates it makes POLISH.8's invariant check untestable |
| **7** | **No real personal data — and synthetic values must LOOK synthetic.** ⚠ **amplified v1.2 (B5):** `tos_acceptance_ip` and `tos_acceptance_user_agent` take **fixed, obviously-synthetic literals** — unmistakably generated on sight. Never a plausible IP, never a real user-agent string | The public dataset releases 2026-11-06. A plausible-looking synthetic IP is indistinguishable from a real one after the fact |
| **8** | **Staging is NEVER frozen.** Nothing writes `system_state.frozen_at`. Not a script, not a migration, not a manual `UPDATE` | The transition is one-shot and trigger-enforced. Setting it makes staging read-only **permanently**. There is deliberately no write path in `src/`; do not add one to satisfy M9 |
| **9** | **The reset path is a guarded artifact.** ⚠ **corrected v1.2 (B1):** the **single-transaction batch is the primary mechanism**; the `finally` re-enable is a retained **belt**, explicitly demoted. Plus: refuse unless the staging target and environment guards pass, fail closed on absence, never fall back to `DATABASE_URL`, assert against the **live connection**, verify every guard is re-enabled and exit non-zero if not, and ship behind the full ritual with an ADR | It is a script whose job is to switch off the enforcement that makes the ledger credible. Ratified as ADR-0035 |

---

## §2 · The fixture set

### §2.1 · Markets — one per lifecycle state

| # | State | Purpose | Notes |
|---|---|---|---|
| M1 | **Draft** | Admin surface; and `/m/<draft-slug>` **404s** | The only way to reach a Draft slug is by knowing it |
| M2 | **Open**, heavily active | The primary POLISH.3 subject | See §2.3 |
| M3 | **Open**, lightly active | Graceful degradation — no post clears `k_lane`, so **no badges render** and Top falls back to closest-to-landslide | Proves the majority-carry-no-badge criterion |
| M4 | **Open**, brand new | Both `EmptySideCTA` slots | Zero posts |
| M5 | **Closed** | Read-only; write affordances gated | `closeMarket` |
| M6 | **Resolving** | Read-only; distinct badge | `triggerResolution` |
| M7 | **Resolved** | Settled positions on the Profile side. Resolve to **YES** | `triggerResolution` → `settleMarket`. Also the gate-5 four-digit-P/L carrier |
| M8 | **Voided** | The void path differs from resolve | `voidMarket` |
| ~~M9~~ | ~~**Frozen**~~ | ⚠ **§3 — unreachable, permanent. Do not attempt.** See §1.8 | — |
| M10…M(9+k) | **Open**, filler | Enough total Open markets to fill Discovery's hero + full grid — **`DISCOVERY_GRID_SIZE` + 1** | Content can be thin |

### §2.2 · Participants

**8–10 pooled pseudonymous accounts.** Named roles, not real people.

| Role | Must have |
|---|---|
| **P-owner** | The operator's own account — the **owner arm** of Profile, positions, bookmarks. Posts and replies on both sides across several markets. ⚠ **Its email and Google `sub` must be captured BEFORE the first reset**, or the operator's next staging sign-in fails on a `users_email_idx` collision, unrecoverably |
| **P-visitor-target** | A well-populated profile viewed as a **visitor** — proves the DTO split |
| **P-empty** | Zero posts, replies, positions and bookmarks — every empty state at once. ⚠ **Balance is exactly 1000** (B7): `accrueDailyCredit` fires inside `place()`, so a role defined by never betting never accrues |
| **P-flipped** | Holds a position it **flipped** — the `Flipped` marker and the graph's flip rim. Buy YES → sell **all** YES → buy NO; a partial sell raises `OppositeSideHeldError` |
| **P-exited** | **Fully sold out** — the `Exited` marker. Must not re-enter |
| **P-removed** | One removed comment and one surviving one — masking without a ban |
| **P-banned** | Banned, **whose past content survives** — ADR-0021: ban removes voice, not past content. Ban **after** the content exists |
| **P-crowd** ×3–4 | Volume for lane dominance, reply counts, and the interleave |

**Method** (settled at Slice A, two calls per user, both with committed precedent): `auth.$context.internalAdapter.createOAuthUser(…)` → the real `acceptTosAction(formData)` with only the cookie/redirect shell mocked. The pool consume, the pseudonym assignment, the five-column ToS evidence write, `grantInitialDharma` and the two events all run unmodified.

### §2.3 · Content on M2

| # | Shape | Serves |
|---|---|---|
| C1 | Posts on **both** sides, both slots populated | Base render |
| C2 | Posts totalling **`LATEST_INTERLEAVE_INTERVAL` + 2** | The P2 latest-interleave fires at least twice |
| C3 | **One post dominating each of the three lanes** — Most Debated (`n`) · Highest Stakes (`Đ`) · Contested (`n^b`) | Each badge renders at least once |
| C4 | **Most posts dominating no lane** | The majority-carry-no-badge criterion |
| C5 | A post with **many replies on both sides** | `ReplySplitBar` · `ReplyPreview` expand · reply stake-ordering within side |
| C6 | A post with **zero replies** | The empty reply state inside a populated market |
| C7 | A post with an **attached image** | `--imgmax` in-card clip **and** whole-render in the pop-up |
| C8 | A post long enough to **truncate** | The "Read more" affordance |
| C9 | A **removed post** with surviving replies | Removal masking with thread integrity |
| C10 | A **removed reply** under a present post | The reply-level masked variant |
| C11 | Enough price movement for a **multi-point chart** with post nodes | All four UI.19 render variants |

### §2.4 · Positions and bookmarks

| # | Shape | Serves |
|---|---|---|
| Q1 | An **open sellable** position | The Sell affordance renders |
| Q2 | A position on a **terminal** market | Sell is **hidden**, not disabled |
| Q3 | A **settled** position post-resolution | Net P/L on winning and losing sides |
| Q4 | A viewer **holding YES** on M2 | The **opposite-slot rule** — the NO composer is `oppositeHeld`-disabled. Constrains which side P-owner bets on M2 |
| Q5 | Zero positions | Empty `PositionsTable`, owner and visitor copy |
| B1 | Bookmarks on **others'** posts **and** replies | Staked / Current are the **bookmarked author's** figures. Self-bookmarks are forbidden, so the acting viewer must differ from the author |
| B2 | Zero bookmarks | Empty Bookmarks page |

### §2.5 · Moderation

All produced by `moderateComment({ action: "remove" | "ban" })`.

| # | Shape | Serves |
|---|---|---|
| X1 | One `content_removed` **mod action** on a post | Feeds C9 and the audit surface |
| X2 | One on a **reply** | Feeds C10 |
| X3 | One **banned author with surviving content** | POLISH.8 review feed; the ADR-0021 distinction |
| ~~X4~~ | ~~Audit feed paginates~~ | ⚠ **MOVED TO §3 at v1.2 (B3)** — a product gap, not a data gap |

---

## §3 · States that are unreachable, and why

Naming these prevents eight surfaces from each independently discovering them. Each is **`data-blocked` by construction**, not by accident.

| State | Why unreachable | Handling |
|---|---|---|
| **Frozen market (ex-M9)** | No freeze write path exists in `src/`, and the transition is one-shot and trigger-enforced. Setting it bricks staging permanently — §1.8 | Inspect on a throwaway database, once, and record the capture. **Never on staging, under any pressure** |
| **X4 · audit-feed pagination** ⚠ **NEW v1.2** | `AUDIT_FEED_DEFAULT_LIMIT = 200`, and the page hard-codes its own `ROW_LIMIT` with no wiring to reach it. **There is no pagination in the audit surface at all** | **A product gap, not a data gap.** Needs its own POLISH.8 ruling on whether the feed should paginate. The cursor path, wherever it exists, is integration-testable without 200 rows of staging content |
| **Empty Discovery** | Requires **zero** Open markets, mutually exclusive with §2.1's `DISCOVERY_GRID_SIZE + 1` | Inspect on a preview DB or local, once. Do **not** empty staging to see it |
| **Turnstile states** | Not wired — staging on always-pass test keys | `data-blocked` pending AUTH-TURNSTILE-WIRE |
| **Live-window polling** | F-DEBATE-4 unverified and possibly unbuilt | `data-blocked` pending that finding |
| **Cron-driven transitions** | Crons do not auto-fire on a branch deploy | Drive the transitions via admin actions instead. The scheduler fix is **STAGING-PARITY-ENV**, sequenced before TESTING.0 |
| **Graph x-domain** | Hard-pinned Sep 15 → Nov 5 2026 as module-private consts, no override. August points are filtered before reaching the chart. **Backdating `created_at` is forbidden** — it would mean writing timestamps the engine cannot produce | `data-blocked`. Remedy routed to **GRAPH-WINDOW-OVERRIDE**, behind a SPEC.1 §23 rider |
| **Real ToS / Privacy bodies** | Lorem-ipsum pending LEGAL.1 | Content-blocked, one element on `/onboarding` |

---

## §4 · Verification

STAGING-PARITY is not done until **all six** pass from a cold rebuild.

| # | Gate | Check |
|---|---|---|
| **1** | ⚠ **Event parity across ALL state-mutating flows** (broadened v1.2, B2) | Every `bets` row has a `bet.placed`; every `comments` row a `comment.placed`; every `bets` row a non-null `comment_id`; every non-Draft market its lifecycle event; **every Resolved or Voided market ≥1 `resolution_events` row** — the third corruption class, and the one v1.1's gate would have passed. ⚠ **G1.6 — content parity:** for every `bets` row, its `bet.placed` event payload AGREES with the row on stake, side, share quantity and price. Existence is G1.1; agreement is G1.6 |
| **2** | **Conservation** | `checkMarketConservation` **iterated over every market, not sampled** — a market with no bets conserves trivially. Plus ledger-level checks that do not depend on market activity. **Do not re-derive the identity in the test:** CPMM conservation is measured against pool cash |
| **3** | **Durable receipt integrity** | `loadDurableReplay` and `isDurableIdempotencyConflict` behave correctly against the generated receipt set. ⚠ **v1.3 (C1):** this is ADR-0031's idempotency backstop, NOT event-log state reconstruction — it reads `bet_receipts`. The wider property, that state derives from the log, is covered by gate 1's G1.6 |
| **4** | **Coverage** | Every §2 row exists and is reachable by URL. Entries marked unreachable name their reason and match §3 exactly — no silent omissions |
| **5** | **Magnitudes** — ≥1 four-digit Đ figure on **every** Đ-rendering surface class: profile §23 tiles, positions table, discovery staked totals, composer amounts, header Portfolio and Balance | **Executed as SQL against the generated data, never as unit assertions over hand-built objects** — a unit-level restatement reproduces exactly the blindness this gate exists to catch. Each criterion names its carrier fixture, so it cannot pass by accident on some other row |
| **6** | **Zero `share_quantity = 0` rows** | So SP-2's future `CHECK` migration meets no violating rows. Note: a fully-exited **position** legitimately reaches `quantity = 0`; SP-2 constrains `bets`, not `positions` |

**Then:** capture the coverage list into `POLISH-register.md` as the standing reference, so an inspector never hunts for "the market that has a removed post."

---

## §5 · Inherited verification discipline — the **V-space** register

**This section is the canonical home of V-1…V-5.** They are the *verification* lessons: what makes a control weaker than it looks. They are **not** L-space — L-numbers belong to `POLISH-register-ADDITIONS.md` (the PRIMITIVES-1 Gate C reviewer LOWs) and to task-scoped `@security-auditor` LOWs, which carry their task name. Cite a verification lesson as **V-n**, never as L-n.

V-1…V-4 came from Slice A, which found **six** controls that passed while blind to what they named; V-5 came from Slice C/D. These constraints are carried into every remaining slice.

- **V-1 · A test that reassembles a lookalike proves nothing about the shipped one.** Assert against the shipped artifact, or against what actually happens on the wire.
- **V-2 · A negative assertion needs a positive control** — `not.toMatch` passes when its pattern matches nothing, and "matches nothing" is exactly what a rename or a reformat produces.
- **V-3 · Asserting that a call exists is not asserting what it does.** An entire guard surface shipped unasserted because a test checked the call's lexical position and a comment claimed coverage that did not exist.
- **V-4 · A source match is the weak form: it reads text ABOUT a file, and it false-alarms on correct code.** Keep it as a cheap tripwire; make the behavioural assertion the control.
- **V-5 · Negative controls must SPAN failure classes, not accumulate within one.** Gate 4's three probes were all magnitude corruptions, so none could detect a scoping error — four gate-4 probes were not scoped to the user whose URL they certify, and no control in the set could have caught it. Each control was sound; the set was still blind, and invisibly so from inside it. A fourth magnitude corruption would have raised confidence without raising coverage.
- ⚠ **Load-bearing for Slice B:** ADR-0036 primitive 4's **no-direct-writes assertion** is what keeps gate 1 non-vacuous — if the generator could write both a `bets` row and its event, gate 1 would pass *because the generator wrote both halves*. It gets a **positive control per pattern**, a **non-empty file-set assertion**, **whitespace tolerance**, and a **mutation control at authoring time**.

---

*v1.0-draft 2026-07-30 · v1.1 2026-08-05 from RECON-1 · v1.2 2026-08-06 from the STAGING-PARITY Ratification Record §8 and Slice A · v1.3 2026-08-06 from Slice B · v1.4 2026-08-08 from SYNC-1 (the D.4 V-renumber, executed; §5 is V-space's canonical home). Constants named in caps (`DISCOVERY_GRID_SIZE`, `LATEST_INTERLEAVE_INTERVAL`, `k_lane`) are owned by `RANKING.md` and `limits.ts` and pin at the 2026-09-01 number-tuning pass — this manifest references them, never sets them.*
