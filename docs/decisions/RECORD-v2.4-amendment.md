# DECISION RECORD — amendment 2.4

**Amends** `RECORD-v2.0.md` · follows 2.1, 2.2, 2.3 · **Opened** 2026-09-05
**Ruling** D-28 — the open-questions round, twenty-eight answers in one ruling

> Twenty-eight questions were put to the founder on 2026-09-05 and answered in one sitting. They are
> recorded as one ruling with a table rather than twenty-eight numbered rulings, per D-25.
> Where a row says *closed* the matter is not reopened.

---

## D-28 · The open-questions round

| # | Topic | Ruling | Consequence |
|--:|---|---|---|
| 1 | Number tuning | In progress; a founder task | Seeding waits on it |
| 2–3 | Production migration + seeding | One stratum, whole team, protocol chats open 7–8 Sep | `deploy-pipeline.md` §3 is the procedure |
| 4 | Identity pool | **Closed.** 1,070 PFPs × numeric suffixes; the PR is merged | `STATE.md` F-9 discharged; D-11's stated size superseded |
| 5 | Dataset pipeline (PR #435) | **Deliberately open** until after 5 Nov | F-15 reclassified from blocker to *by design* |
| 6 | Mobile | In flight; PR to come | Not a documented gate |
| 7 | `F-MOD-3` | **Scrapped.** No automated reporting. Admin has full control | `SPEC.1` §16.5's legal clauses removed at the `SPEC.1` pass. Moderation is closed as a topic |
| 8 | Seven `AI_FLAG_THRESHOLD_*` constants | Delete | `SPEC.1` App. B, §16.1 |
| 9 | `OTP_TTL_MIN` | Not important | Row struck, not tuned |
| 10 | `PROFILE_GRAPH_Y_MAX` | Delete | `SPEC.1` App. B |
| 11 | Four visible placeholders on `/m/[slug]` | Not important | Ship as-is |
| 12 | Runbooks | **The twenty promised in `SPEC.2` §21 are struck. `docs/runbooks/` is kept whole** | `SPEC.2` §21 rewritten at the `SPEC.2` pass |
| 13 | Pool-saturation alarm | Finding removed; blind spot accepted | — |
| 14 | Shedding order | Finding removed; accepted undecided | — |
| 15 | `error-codes.md` | The five `MUST` clauses removed | `SPEC.2` pass |
| 16 | `PSEUDONYM.md` | Promise deleted | `SPEC.2` App. A; `ADR-0011` ×2 |
| 17 | `design.md` | Promise deleted | `SPEC.2` App. A |
| 18 | ADR index rows 0002, 0012 | Formatting pass | `SPEC.2` §22 |
| 19 | ADR `Status` forms | One cohesive formatting pass | 44 files |
| 20 | Axiom in `ADR-0006` | Strike | `ADR-0006:34` |
| 21 | 82 stale "by 1 September" claims | Rewrite to point at the event, not the date | *"pins at the number-tuning pass"* |
| 22 | Lane leads | **Founder occupies every seat** | No document change; `OPERATING.md` §2 assigns by tracker |
| 23 | `MOD-1` | **Proceeds. No waiting** | Critical-path task, gated per `OPERATING.md` §5 |
| 24 | Session secret | Not important | One line in the 7–8 Sep migration protocol: verify before promote |
| 25 | App-as-owner role split | Not important | `parked.md` row retired |
| 26 | Branch protection | Executor applies best practice | Required CI on `main`; no force-push to `main`/`staging` |
| 27 | Orphan branch | Executor decides | `origin/chore/pfp-2-plans-log` |
| 28 | PK refresh | After `SPEC.2` lands | — |

**Standing consequence.** Rows 7, 13, 14 and 23 close moderation, alarming and load-shedding as
topics. They are not reopened without a new ruling.

*End amendment 2.4.*
