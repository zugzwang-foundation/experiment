# ENGINE.14 — plan-session log

> **Stratum:** ENGINE.14 — Market lifecycle writes, per the R-9.7 mint
> (docs/plans/ENGINE.9.md §Rulings): F-ADMIN-1 create, F-ADMIN-2 seed/open +
> dormant `pool_seed` activation, the clock-driven Open → Closed transition, the
> three remaining `market.*` emits (`created`/`opened`/`closed`) + their SPEC.2
> §19.4.1 STRIP rows. W-4 wrapper mint; zero migrations; W-1 / W-3 /
> `transitions.ts` byte-untouched is a plan constraint. Critical-path
> money-adjacent; Ultrathink-mandatory.
> **Entry:** plan session only (S1 sync-gate → S2 recon → web-lane rulings draft +
> S4 arithmetic pass → founder ratification → Phase P plan PR). Execute runs in a
> fresh CC session + fresh web chat (§5.8) and logs separately.

---

## Plan session — 2026-06-12

**What landed.**
- `docs/plans/ENGINE.14.md` — the founder-ratified implementation plan (rulings
  R-14.1..R-14.6 + plan-level decisions D-14.a..f) — via **PR #116**,
  squash-merged to `main` at **`b5e87df`** (`ENGINE.14 plan — market lifecycle
  writes (docs-only) (#116)`, merged 2026-06-12T13:48:10Z), docs-only, no
  reviewer cascade (plan-PR precedent). 635 lines / 36,057 bytes /
  md5 `aefcfce543830e42b8581b7a8f828a46` — verified identical on the transfer
  artifact, the in-repo copy, and post-merge `main`. Branch
  `docs/engine-14-plan`, commit `92a3787`; one-file diff +635/−0; operator
  merged after CI green.
- Base: `main @ b047563` (S1 sync-gate 9/9 PASS). No `src/`, test, or
  schema/migration changes — plan-only. This log ships on
  `chore/engine-14-plan-log`.

**Mode pins per phase (stated in every report header; zero Fable→Opus
fallbacks).**
- S1/S2 — recon: `claude-fable-5` (CC 2.1.170), effort gated-xhigh (no
  `/effort max`), ultrathink ON, ultracode OFF behaviourally — solo-sequential,
  zero subagents, ZERO repo writes (S1's single permitted ref mutation:
  `git fetch origin`). The harness session flag read ultracode ON; recon ran
  solo-sequential per the kickoff pin + standing feedback, and the discrepancy
  was surfaced in the S1 SURPRISE section.
- S3/S4 — rulings draft + arithmetic pass: web lane (not this CC session);
  founder ratification 2026-06-12.
- Phase P (S5): NORMAL mode, named write set only (plan file → PR #116; this
  log → `chore/engine-14-plan-log`).

**Rulings provenance (founder-ratified 2026-06-12, "go"; binding, encoded
verbatim in the plan's §Rulings — drafted by the web lane from this session's
S2 recon).** R-14.1 (seed via `pools` row + `seedAmount` payload field on
`market.opened`; enum stays dormant; R-2 untouched; `seedAmount` MOVES
created→opened) · R-14.2 (W-4 wrapper duplicating the W-3 spine per C-3,
markets-first; ADR-0013 P3 patch record) · R-14.3 (clock-driven close +
`closeDueMarkets` sweep; invocation deferred to ENGINE.10; close-lag window
accepted eyes-open) · R-14.4 (final payloads + ZERO new columns/migrations;
criterion→`description` service-required; SPEC.2 B.2 7-state drift-kill rides)
· R-14.5 (admin-actor assert born into all three flows via new
`src/server/admin/actor.ts`; resolution retrofit stays ENGINE.10) · R-14.6
(ceiling as service guard, `FREEZE_INSTANT_UTC` constant; no CHECK). Plan-level
decisions D-14.a..f ratified with the text 2026-06-12 ("best recoms"): (a) slug
caller-supplied + in-tx pre-check; (b)/(c) live-deadline guards at create/open;
(d) sweep emits as `admin-singleton` (no `'system'` actor this phase); (e)
clock-as-argument in all flows; (f) response shapes pinned with semantic
event-id assertions (L-E9.3).

**Session arc.**
1. **S1 sync-gate (9/9 PASS @ `b047563`).** Clean synced main (HEAD itself the
   PR #115 squash); BASE-OK; `docs/plans/ENGINE.14.md` absent on every ref;
   `src/server/markets/` censused NOT-greenfield (2 files, both pure, zero DB —
   `transitions.ts` holds the ENGINE.4 state machine, unpersisted);
   `markets.status` writers exactly three, all in `src/server/resolution/`
   (trigger/settle/void; `correct.ts` writes `resolution_outcome` only — a
   kickoff-expectation precision); the three `market.*` types registered with
   ZERO emit sites repo-wide; EVENT_TYPES = 23 with the inventory pin
   `insert.test.ts:639 .toBe(23)` live; pools = 5 columns, UNIQUE FK 1:1;
   migration head `0015` with 16 applied on local Postgres `:54322`;
   `docs/engine-14-plan` + `chore/engine-14-plan-log` free both sides.
   SURPRISEs: the session-level ultracode flag (reported, not acted on) and the
   trigger/settle/correct/void-vs-three-writers precision.
2. **S2 recon (R1–R10; 9 SURPRISEs).** The evidence base the rulings were
   drafted from: markets 10 columns / no lifecycle timestamps / no CHECKs;
   transitions API + 49-pair test matrix; SPEC.1 §6.1 lifecycle contract
   (Open → Closed is the server clock, not admin action) + F-ADMIN-1/2 verbatim
   (**§15, not §11** — prompt-vs-disk correction); seeding sources incl. the
   R4 critical fact — `dharma_ledger.user_id` NOT NULL + FK to `users` makes a
   `pool_seed` ledger row structurally unwritable; the three payload schemas on
   disk with `seedAmount` sitting on `market.created` (the two-step §15 flow
   tension → closed by R-14.1); W-3 spine + ADR-0013 P1/P2 live text + W-1's
   deliberately-unlocked status read; admin-actor census — NO call-site asserts
   `actor_id === 'admin-singleton'` / `user_id === null` today (ENGINE.9
   security-handoff row confirmed open, owner ENGINE.10); §12.1 ceiling with
   zero storage enforcement; ADR-0005 Pattern A as shipped in `insert.ts`;
   test substrate = per-file raw inserts, no shared market fixture, 16
   `insert(pools)` fixture sites. Headline SURPRISEs consumed by rulings:
   `market.created`/`opened`/`closed` have ZERO SPEC.2 presence (no §3.x form,
   no §19.4.1 rows → same-commit obligations); cpmm.md §7.1 :306 retains
   pre-R-2 "ledger entry `pool_seed`" wording (→ R-14.1 rider); `G6` is an
   external-register ID colliding with SPEC.1 §3 Goal G6 (definition not on
   disk); SPEC.2 markets/pools are B.2/B.3 and "Appendix B8" is the external
   lettered register (prompt-vs-disk corrections, recorded once).
3. **S3/S4 (web lane).** Rulings R-14.1..6 drafted from the S2 recon; D-14.a..f
   recommended; S4 arithmetic pass hand-verified the worked example — seed
   C = 1000 → reserves `(1000.000000000000000000, 1000.000000000000000000)`
   string-identical, `p_yes = 0.5` exact, `k = 10⁶` — and the boundary
   semantics (`deadline == FREEZE` passes the "≤"; `now == deadline` closes).
   **Zero defects; no D-x/F-x folds — the plan text ratified unamended.**
4. **Phase P (S5) — halt + resume.** First attempt STOPPED at the intake gate:
   `~/Downloads/ENGINE.14.md` absent on the operator machine (variant sweep +
   exact-size sweep both empty) — zero writes, per the gate's
   halt-don't-improvise rule. Resume passed the md5 trio
   (`aefcfce543830e42b8581b7a8f828a46` / 635 / 36057) on both the transfer
   artifact and the in-repo copy; branch `docs/engine-14-plan` (re-verified
   free); commit `92a3787` (house identity, `/tmp/engine14-commit-msg.txt`,
   no co-author trailer); PR #116, +635/−0; operator squash-merged →
   `b5e87df`.

**Defect ledger.** None in the plan text (S4 zero-defect pass; ratified
unamended). Process event recorded: the S5 intake halt above — the discipline
worked as designed.

**Open questions.** None at ratification — Q1–Q6 closed by R-14.1..R-14.6; the
residual judgment calls live as D-14.a..f. Carry-forwards 1–6 minted in the
plan (close-lag window; ceiling CHECK → HARDEN; `resolution_criterion` +
`display_order` columns; `'system'` actor; resolution actor-assert retrofit →
ENGINE.10).

**Process verifications & anomalies (recorded).**
- Hygiene clean: branch names verified free pre-`switch -c` (both branches);
  staged set asserted = exactly one path pre-commit; commit-message and PR-body
  files tail-verified; unique `/tmp/engine14-*` message files
  (parallel-lane discipline); ★ STOPs honored at every operator gate.
- Anomaly 1: the S5 intake halt (artifact absent) — resolved by operator
  transfer + resume; no improvisation, zero writes during the halt.
- Known drift, noted once: **no ENGINE.14 tracker row** — sweep deferred to
  after ENGINE.10 by founder ruling 2026-06-12; the merged ENGINE.9 plan + log
  mint (R-9.7) is the authority.

**Next session starts at.** **ENGINE.14 EXECUTE — a FRESH CC session + fresh
web gate chat, never this one**, off a `main` carrying the merged plan,
referenced as `@docs/plans/ENGINE.14.md` in the execute kickoff. Branch
`feat/engine-14-lifecycle`. Mode pin: gated-xhigh default with `/effort max`
recommended session-only (the ENGINE.7/9 money-code precedent); ultracode OFF.
Execute order per the plan's §Execute ritual: S0 sync gate (CLOSED-set
checksums, EVENT_TYPES pin 23, head 0015) → S1 `@test-writer` RED suite (§Test
plan charter, ~24 tests) → S2 one implementation commit (the L-E9.1
pre-declared fold) → S3 riders R-A..R-I + version bumps → S4 §5.10 self-audit →
S5 `@code-reviewer` → `@security-auditor` (**`@db-migration-reviewer` not
engaged — zero migrations, stated in-plan so the absence is
ritual-conformant**) → S6 gate battery → S7 PR. Before that, this lane's
remaining step: END-ON-MAIN + PK staging — a separate gated step after this
log PR merges.

**Context to preserve.**
- **Canonical plan SHA:** `b5e87df` (PR #116; branch commit `92a3787`; 635
  lines; md5 `aefcfce543830e42b8581b7a8f828a46`).
- **The stratum, one line:** W-4 wrapper at `src/server/markets/transaction.ts`
  (W-3 spine duplicated per C-3; create lockless, open/close markets-first
  `FOR NO KEY UPDATE`; ADR-0013 P3) → `createMarket` / `openMarket` /
  `closeMarket` + `closeDueMarkets` sweep, all clock-as-argument and
  born-asserting the admin actor → three emits via bound-tx `insertEvent`
  (`created = {marketId, resolutionDeadline}` ·
  `opened = {marketId, seedAmount}` · `closed = {marketId}`) → symmetric
  `pools` INSERT (`y₀ = n₀ = seedAmount`, carry-forward 2 preserved by
  construction) → zero migrations, zero ledger rows.
- **Environment:** local Postgres `:54322` up (16 migrations applied); CI
  PR-gated only; `/tmp` clobbered between turns (md5-gate at use-time);
  migration head `0015_nightly_drift_zero_terminal_fix.sql`.
- **Tracker (operator-maintained — recorded, NOT edited):** no ENGINE.14 row;
  sweep deferred post-ENGINE.10 by founder ruling 2026-06-12.

**Time.** 2026-06-12 (IST). Session arc: S1 sync-gate (9/9 @ `b047563`) → S2
recon (R1–R10; 9 SURPRISEs) → web-lane rulings draft + founder ratification
("go") → S4 arithmetic pass (zero defects, unamended) → Phase P: intake halt →
resume → `docs/engine-14-plan` `92a3787` → PR #116 → squash-merge `b5e87df` →
this log (`chore/engine-14-plan-log`).
