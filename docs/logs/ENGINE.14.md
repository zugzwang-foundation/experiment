# ENGINE.14 — Market lifecycle writes (execute session log)

**Stratum:** ENGINE.14 — F-ADMIN-1 create · F-ADMIN-2 seed/open · the clock-driven `Open → Closed` cutoff + sweep · the three remaining `market.*` emits.
**Dates:** 2026-06-12 → 2026-06-13 (one execute session, fresh CC + fresh web gate chat).
**Plan:** `docs/plans/ENGINE.14.md` (merged at PR #116, squash `b5e87df`; rulings R-14.1–R-14.6 + D-14.a–f founder-ratified 2026-06-12; plan md5 `aefcfce543830e42b8581b7a8f828a46`, 635 lines — S0-verified byte-exact).
**PR:** #118, squash-merged to `main` 2026-06-12T20:49:55Z → **canonical SHA `a29ef7e2a7daed6ef78fb221e43c5f4cbe204b37`**.
**Commit chain (branch, squashed):** `775e25f` RED suite → `5e594c4` implementation → `d6f3c61` riders → `60f1f10` S5 dispositions.
**Mode-pin record:** `claude-fable-5[1m]` · Claude Code 2.1.170 (≥ 2.1.170 asserted every report) · effort xhigh (gated-xhigh persistent default; no in-session command exposes a live `/effort max` operator pin — visibility note carried on every mode-pin header) · ultracode banner ON throughout, **never used** (critical path, CLAUDE.md §6; zero Workflow invocations; subagents only at S1/S5 per §5.11, both pinned fable-5/xhigh).

---

## Gate record S0 → S7

- **S0 sync gate — PASS 8/8.** Clean main at BASE `dbfbef4`; plan byte-exact; all line anchors live (schemas.ts `seedAmount` pre-move state confirmed); zero pre-existing emit sites; migration head 0015; CLOSED-set checksum table recorded (11 files); branch free both sides; settle.ts event-id mint idiom quoted — the Item-8 precision note (required-arg vs "minted in-flow") produced the S1 gate ruling on `eventId?`.
- **S1 RED suite — PASS.** `@test-writer` minted the charter exactly: 23 it() across 4 new files + the pre-declared insert.test.ts fixture edit (+4/−2); commit `775e25f`; all six reds the expected ones (4 collection-RED + 2 edited fixtures); `.toBe(23)` pin GREEN; budgets 240/263/249/219.
- **S2 implementation — PASS, one commit `5e594c4` to green.** W-4 + three flows + sweep + `assertAdminActor` + 9-class taxonomy + `seedAmount` move + the §19.4.1 STRIP rows (same-commit rule) + the pre-declared `markets.ts:13-14` comment edit. **First-run green 51/51, zero test edits**; checks: 3 emit sites · 1 pools INSERT · tsc/Biome clean · budgets 220/140/130/147/39 (two overruns caught at check 6, fixed by doc-trims pre-commit).
- **S3 riders — HALT, then ruling, then PASS (`d6f3c61`).** Halted on the R-D anchor conflict (plan said new §3.7; §3.7 occupied by the events-row contract, cross-referenced from nine src/ + six SPEC.2-internal sites) — zero edits at halt. Gate ruled §3.8 (append-don't-renumber, the SPEC.1 1.9.0 §21 precedent) + the R-F micro-extension (B.2 1:1 column match 10/10 → stale SCAFFOLD.2 trailer deleted). R-A..R-I + SPEC.1/SPEC.2 → 1.0.4 landed in one docs-only commit; all five budgets held.
- **S4 §5.10 self-audit — PASS 17/17.** CLOSED set proven **11/11 byte-identical checksums** (W-1, W-3, transitions.ts, all 8 dharma files — zero-line diff); footprint exactly the declared 18 files, +1,781/−19; singletons (1 pools INSERT · 3 emits · EVENT_TYPES 23 · zero lifecycle ledger touches); §3.7/§3.8/insert.ts ON CONFLICT three-way agreement.
- **S5 reviewers — 0 CRITICAL / 0 HIGH (1 MEDIUM + 3 LOW each side + 5 INFO), HALT-relayed verbatim; dispositions commit `60f1f10`.** `@code-reviewer` then `@security-auditor`, full branch; all carry-ins answered (create.ts untested branches REACHABLE/ORDERED/TYPED; short-form seed benign-latent; message-only errors deferable). Gate landed CR-1 (§17.2 row 8) + SA-M-1-docs (§3.8 caller-freshness) + CR-2 (M1 renames, label-only, 240/240 kept); the rest dispositioned as named carry-forwards.
- **S6 battery — halt at pre-flight 0b → re-entry → PASS 5/5, skips on-ratified-baseline.** First entry stopped on the literal skip-grep (two pre-existing hits, one a comment). Re-entry under the delta-vs-BASE form: verify clean (12s) · invariants 20/20 · integration 103/103 · test-db 83/83 (watermark ran 6/6, no skip) · full suite **790/0** in 52s (105 files; the five ENGINE.14 suites green). Gate-5 marked-test inventory (2 skipped + 5 todo) exceeded the 1-item 0c baseline → stopped again; gate ratified the named 7-item inventory as the standing baseline.
- **S7 — PR #118 (CI green: `ci` pass 2m20s, run 27441593412) → operator squash-merge → this log.**

---

## Deviations register (all gate-ratified, with dates)

1. **R-D §3.7 → §3.8** (gate ruling 2026-06-12): the plan assigned the new "Market lifecycle writes (W-4)" block §3.7 — occupied on disk by the events-row contract. Landed as §3.8 per the append-don't-renumber convention (the SPEC.1 1.9.0-draft §21 precedent). Recorded in the SPEC.2 §0.1 1.0.4 row + the riders commit message.
2. **§3.8 placed before the §3 closers** (structure-first reading, flagged in the S3-resume report): the ruling's "immediately before `## §4`" clause collides with the unnumbered §3 closing sub-sections ("Single source of truth" + "ADRs consumed by §3"); the ruling's own "place by STRUCTURE" instruction won — §3.8 sits after §3.7's content, keeping the numbered sequence contiguous.
3. **S5 dispositions commit `60f1f10`** (gate-ratified 2026-06-12): **CR-1** — SPEC.2 §17.2 alarm row 8 (`lifecycle_serialization_exhausted`), heading + count "seven→eight". **PLAN GAP noted:** the plan's §Riders omitted the alarm-row counterpart despite the exact ENGINE.9 R-K precedent (row 7 for W-3); code matched the plan — the plan had the gap. **SA-M-1 docs half** — §3.8 caller-freshness sentence (fresh UUIDv7 per logical create; dedupe is same-operation retry-purity, not cross-create replay protection; ENGINE.10 wire layer mints server-side only). **CR-2** — the three M1 it() labels renamed to embed the spec-pinned `deadline-form-validation` substring; suffixes shortened within the kickoff's "e.g." latitude to stay under Biome's 80-col it()-rewrap (file stayed 240/240; the ≤244 amendment unused).
4. **Commit-msg files used the `engine14-exec-*` pattern** (`/tmp/engine14-exec-{red,impl,riders,s5fix,log}.txt`) — kickoff refinement over the plan's single `/tmp/engine14-commit-msg.txt` name; parallel-lane-unique throughout (one plan-lane leftover, `/tmp/engine14-pr-body.md`, detected and left untouched).

---

## Carry-forward register (full, named owners)

**Plan-minted (CF-1..6, verbatim owners):**
1. **Close-lag window** (R-14.3): deadline-to-sweep-tick stale-`Open` bets; bounded by cron cadence. Owner: **ENGINE.10** (wiring) + HARDEN (cadence tuning; optional W-1 deadline guard if ever revisited — would touch W-1, founder gate required).
2. **Ceiling CHECK constraint** on `resolution_deadline` — **HARDEN** defense-in-depth candidate (L-E9.2 fixture-ripple priced in there).
3. **`resolution_criterion` dedicated column** (criterion rides `description` per R-14.4) — **admin-UI/HARDEN** candidate.
4. **`display_order` column** (F-ADMIN-1 optional field) — **admin-UI stratum**.
5. **`'system'` actor identity** for autonomous ops (sweep emits as `admin-singleton` per D-14.d) — revisit if non-admin-parameter automation ever lands.
6. **Resolution call-site actor-assert retrofit** via `src/server/admin/actor.ts` — **ENGINE.10** (the guard now exists to import).

**S5 reviewer handoffs (ENGINE.10 security-handoff register, extending the ENGINE.9 rows — resolution-site retrofit + `reason` max-length):**
- **SA-M-1 code half:** the wire layer mints event ids **server-side ONLY**; add insertion verification (RETURNING/rowCount on the `insertEvent` path) if a caller-supplied id is ever wire-exposed. The same property exists in the four resolution flows (`triggerEventId`/`settleEventId`/`correctEventId`/`voidEventId`) — **uniform ENGINE.10 treatment**. §3.8 carries the caller-obligation pin.
- **SA-L-1:** `title`/`description` max-length at the ENGINE.10 form boundary (extends the `reason` max-length row).
- **SA-L-2:** v7-prefix timestamp skew — resolved by server-mint-only (same row as SA-M-1).
- **SA-L-3:** wire mapping returns **typed codes, never raw `.message`** (messages echo caller input by design on the in-process surface).
- **CR-3 ≡ SA-I-3:** `seedAmount` 18-dp canonicalization at the ENGINE.10 admin form (preserves the dataset string-identity property for any input form; P4 pins the canonical case).
- **SA-I-1:** the admin-session gate (`src/server/auth/admin/`) **MUST front every lifecycle route** — the actor belt is form-discipline, not authn.

**Deferred docs:**
- **AGENTS.md §9 tests-tree rows** for `tests/server/markets/` + the two new admin test files (S3 founder-deferred → **ENGINE.10** follow-on).
- **Docs drift register (4 items, observed-not-fixed):** (a) SPEC.2 §3 "Single source of truth" closer lists W-1/W-3 owners but not W-4 (§3.8 carries its own file map — no information missing); (b) Appendix-B enum-as-text Type-cell convention (`status`/`resolution_outcome`/`side`/`outcome` say `text`; only B.8 `entry_type` names its pgEnum) — candidate B-wide sweep; (c) SPEC.1 §10.1 "Receives `pool_unwind` flows at resolution and void" is pre-existing ENGINE.9-era stale phrasing (R-9.5e re-encoded unwind as the `poolUnwindAmount` payload field); (d) SPEC.2 §17.2:1612 "Alarm rows 1-5 and 7…" sentence now row-8-incomplete (true but unmentioning).

---

## Ratified baseline — full-suite marked-test inventory (standing, for future gate batteries)

Gate-ratified 2026-06-12 (S6 disposition): **7 items, all pre-existing at BASE, all in ENGINE.14-untouched files; zero failures anywhere.**

| Mechanism | Site | Provenance |
|---|---|---|
| `it.skip` ×1 | `tests/server/admin/moderation/act.test.ts:111` (`f-admin-4::pass-verdict-removal`) | SCAFFOLD.16; explicit DEBATE.2 remove-the-skip handoff |
| `describe.skipIf(!LIVE)` ×1 | `tests/server/storage/_probe-r2-roundtrip.test.ts:22` | SCAFFOLD.15 gated live-vendor probe (creds-flagged; skips locally + CI) |
| `it.todo` ×5 | `tests/server/identity/no-raw-uuid-in-urls.test.ts:24,28,32` · `tests/server/auth/pseudonym.test.ts:360` · `tests/server/auth/tos.test.ts:375` (HARDEN-era by its own label) | forward-stratum stubs |

(Conditional non-firing skip, registered separately: `tests/db/identity-pool/watermark.test.ts` ctx-skip must NOT fire on the local :54322 substrate — it did not; 6/6 ran.)

---

## Lessons (minted)

- **L-E14.1 — probe-intent-not-token.** Three instances in one session: the S4 C.10 grep flagged doc-comments *asserting* the property it audited; the S6 0b literal `\.(only|skip)\(` grep flagged a comment + a pre-existing skip; the 0c baseline was structurally blind to `skipIf`/`todo`/ctx-skip (the regex cannot match them). Future batteries pre-register marked-test inventories **by MECHANISM** (`only|skip|skipIf|todo|ctx.skip` — and todo) and assert the **delta vs BASE**, not literal emptiness.
- **L-E14.2 — plan-anchor check.** §-numbers and rider anchors must be grep-verified against live disk at the PLAN session's own audit (its S4), not first discovered at execute: the §3.7 collision and the §17.2 alarm-row omission were both plan-authoring misses that the execute ritual caught (S3 halt; S5 reviewer MEDIUM). Cheap at plan time, a full relay round-trip each at execute time.

---

## Final state

- `main` @ **`a29ef7e2a7daed6ef78fb221e43c5f4cbe204b37`** (PR #118 squash) — W-4 + the three lifecycle flows + sweep + actor guard live; the market-row event vocabulary complete (all seven `market.*` types have emit sites).
- Specs: SPEC.1 **1.0.4** · SPEC.2 **1.0.4** (§3.8 NEW; §17.2 eight rows; §19.4.1 complete for all 23 event types). cpmm.md §7.1 + ADR-0013 P3 + AGENTS.md file map current.
- Migration head **0015** (zero migrations this stratum); `EVENT_TYPES` **23**; conservation identities untouched; W-1/W-3/transitions/dharma byte-identical to pre-stratum.
- **Next task: ENGINE.10** (founder sequencing 2026-06-12: ENGINE.14 → ENGINE.10 → tracker sweep) — HTTP/cron wiring, admin surfaces, error-envelope mapping, the composed trigger→settle endpoint, the resolution-site actor retrofit, and the S5 security-handoff register above.
- **Time:** one session, 2026-06-12 evening → 2026-06-13, S0 through S7 stage 2.
