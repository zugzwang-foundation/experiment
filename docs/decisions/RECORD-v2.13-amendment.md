# DECISION RECORD — amendment 2.13

**Amends** `RECORD-v2.0.md` · follows every amendment on disk before it (measured on `origin/staging` @ `e56cce0b`) · **Opened** 2026-10-11
**Rulings** D-55

> ⚠ **Provenance, stated because this directory's rule is that a record is authored outside the repository.** This file was written by the EXT-1 dev session on 2026-10-13, from §1 and §4 of `EXT-1_HANDOVER_dev-team_2026-10-11.md` (548 lines, md5 `4f691c6c414640e60811287ba2b24541`), because web Claude's text pack — which was to carry this ruling as its item R-1 — had not arrived. It records the founder's rulings of 2026-10-11 as that handover states them and adds none. **If the pack's D-55 text differs, the pack's text replaces this file.**

---

## D-55 · The experiment ends on 31 December 2026 at 23:45 UTC, when its markets close; no freeze is scheduled

**Ruled:** 2026-10-11 · **Task:** EXT-1 · **Supersedes:** D-21's *"the freeze instant does not move"*. D-21 as narrowed by D-26 otherwise stands: the conference stays struck.

### Context

The experiment was to end at a write-freeze on 2026-11-05 at 23:59 UTC, with the six live markets closing at 23:45 UTC that day. On 2026-10-11 the founder ruled that it runs to the end of the year. The handover records the rulings and not the reasons behind them; none is supplied here.

### Decision

**R1 — The end moves.** The experiment ends on **31 December 2026 at 23:45 UTC** instead of 5 November 2026. That covers the six live markets' close and settlement, and every document, constant, copy line and test that states the end date or time. There is one end time, 23:45 UTC, and nothing happens at 23:59 any more.

**R2 — No freeze switch.** The experiment ends when its markets close. `system_state.frozen_at`, `isFrozen()` and every reader of them stay in the code, unchanged and unused; nothing is deleted. Documents that describe a scheduled freeze are restated: the experiment ends when its markets close, and `frozen_at` is dormant. If someone ever sets it by hand, it is never unset except via `BREAK_GLASS.md`. Resolution happens after the markets close, and SPEC.1's *resolve before the freeze* obligation retires.

**R3 — Devcon is struck; history stays.** Remaining Devcon, ETHGlobal and repository-archive references on live surfaces are struck, by the D-21 / D-26 test. The dataset release stays untimed: *after the experiment closes*. Historical records stay as written.

**R4 — The six markets' deadlines move once, and B8 stands.** SPEC.1's rule that a market's deadline cannot be extended stays for the product. This one-time move is the ruled exception, made by migration `0032`, and it leaves one `market.deadline_moved` event per market. No capability to extend a deadline is built.

**R5 — Market wording changes only as the handover's §5 lists.** The date words move; Bitcoin's window goes from 52 to 108 UTC dates; *"No extensions."* becomes *"No further extensions."* where a market said it; and each market's deadline sentence gains the clause *", moved from 5 November 2026 by ruling D-55 (11 October 2026)"*. Nothing else about any market changes.

### The seven sign-offs

The handover lists seven founder sign-offs as pending on 2026-10-11 and says to build the recommended option for each. This is what was built. A row the founder rules otherwise is rework.

| # | Decision | Built |
|---|---|---|
| 1 | Market wording | As R5, with the moved-from clause naming D-55 |
| 2 | Terms and Privacy Policy | Version 1.1, with a *What changed in 1.1* line in each |
| 3 | Start date in the Terms, onboarding card 2 and the legal figure | Corrected from 15 September to **5 October**. Market texts keep 15 September |
| 4 | Daily credit | Unchanged at 10 Đ. ADR-0018's patch record states the exceedance |
| 5 | Participant report path (ADR-0021's re-open trigger fired) | Recorded as fired. Reopened as its own task after EXT-1; nothing built |
| 6 | "Noted in the product" (Terms §10) | The per-market moved-from clauses and the legal *What changed* lines. No site banner |
| 7 | Timeline | Targets: staging 15 October · production 20 October · latest safe 2 November. Staging landed on 13 October (PR #674) |

### Consequences

**Positive.** One end time. No code path can move a deadline. The freeze machinery is untouched and still works if it is ever needed.

**Negative.** The `close-due-markets` sweep is now the only thing that ends trading. Nothing draws a line under the record once the markets close. Migration `0032` is forward-only, reversible by a new migration only before 2026-11-05 23:45 UTC. ADR-0018's dilution bound is exceeded, ADR-0021's re-open trigger has fired, and ADR-0044's freeze-based mitigation no longer applies — each recorded in its own ADR. ADR-0067 lists these in full.

**Not ruled by D-55,** and so not decided: AWS spend past 2026-11-05 (ADR-0038); the R2 lifecycle rule; where the dataset release draws its cutoff; a deadline check inside the bet path.

**Enforced at:** `src/server/markets/create.ts` (`FREEZE_INSTANT_UTC`) · `src/server/config/limits.ts` · `drizzle/migrations/0032_ext1_end_moved_to_dec31.sql` · `src/server/events/schemas.ts` · `public/legal/tos.txt` · `public/legal/privacy.txt` · `tests/db/ext1-end-moved.spec.ts` · `docs/adr/0067-experiment-ends-when-markets-close-dec-31.md` · `docs/specs/SPEC.1.md` §6.1, §12 · `docs/specs/SPEC.2.md` §19, §20 · `CLAUDE.md` §1, §3.

---

*End amendment 2.13.*
