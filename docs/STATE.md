# STATE — where Zugzwang is

**Generated** 2026-09-08 from `origin/main` @ `da9979b9c61254f3f3bb8c585c817e1970ecfda1`
**Regenerate** per `docs/records/README.md` · **Lane detail** in `docs/records/`
**Go-live** 2026-09-15 — **7 days from this generation**

> This file is an **index and a measurement**. It carries no rule of its own; if a sentence
> here reads as normative, that is a defect. The rules live where §5 points.

---

## §1 · Measured ceilings

⛔ **These decay. Re-measure them; never read them.** Every row carries the command that
produced it, which is the only thing about this section that stays true. This is the **sixth**
consecutive documentation pass at which a *copied* ceiling has been found stale — including
passes whose own prose contained the instruction not to copy one. ⚠ **This pass found EIGHT of the
sixteen rows below stale in five days**, and two of them were stale by a whole major version.

| Quantity | Value | Command |
|---|---|---|
| **ADR ceiling** | **0048** (`0048-phone-responsive-auth-surfaces-and-the-focus-mode-row.md`) · next free **0049** | `ls docs/adr/ \| sort \| tail -1` |
| ADR files | **47** = 46 ADRs + `_template.md`; `0002` and `0012` never used | `ls docs/adr/ \| wc -l` |
| **SPEC.1** | **2.0.1** — rebaselined at 2.0.0 per D-29 (#490) | `grep -m1 '^- \*\*Version:' docs/specs/SPEC.1.md` |
| **SPEC.2** | **2.0.2** — rebaselined at 2.0.0 per D-30 (#493); `F-22` is thereby discharged | `grep -m1 '^\| \*\*Version\*\* \|' docs/specs/SPEC.2.md` |
| **cpmm.md** | **4.0.0** | same shape |
| **Migration head** | **`0030_liquidity_revoke_app_roles`** · 31 `.sql` files · journal 31 entries | `ls drizzle/migrations/*.sql \| sort \| tail -1` |
| **`EVENT_TYPES`** | **25** — `pool.liquidity_added` added by ADR-0047 | `awk '/export const EVENT_TYPES = \[/,/\] as const;/' … \| grep -cE '^\s+"'` |
| **Test files** | **489** — unit 243 · server 160 · integration 36 · db 25 · invariants 13 · scale 8 · staging 4 | `find tests -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' \) \| wc -l` |
| Suite actually run by `vitest run` | **477** — scale (8) and staging (4) are config-excluded | `pnpm vitest run` |
| **Invariant specs** | **13** | `ls tests/invariants/ \| wc -l` |
| **O-space** | **O-15** | `grep -oE '\*\*O-[0-9]+ ·' CLAUDE.md \| sort -u -t- -k2 -n \| tail -1` |
| **V-space** | **V-21** ⚠ `V-15` is deliberately reserved; `V-22` appears only in a sentence saying a row does *not* take it | `grep -oE '\*\*V-[0-9]+ ·' docs/polish/POLISH-0_data-manifest.md \| …` |
| **L-space** | **L-10** — and see `F-23` | `grep -oE '\bL-[0-9]+\b' docs/polish/POLISH-register-ADDITIONS.md \| …` |
| Merged PRs | **478** · first merge PR #1, 2026-04-23 · newest `#500` `da9979b9` | `gh pr list --state merged --limit 600 --json number --jq length` |
| `docs/logs/` + `docs/plans/` | **179** (95 + 84) — the corpus `docs/records/` replaces. ⚠ **Down from 366 (236 + 130) on 2026-09-03: 188 files pruned in five days**, which is D-18 being carried out rather than drift | `ls docs/logs \| wc -l` · `ls docs/plans \| wc -l` |

---

## §2 · What is built

| Lane | Record | Status |
|---|---|---|
| Auth, identity, onboarding | [`records/AUTH-record.md`](records/AUTH-record.md) | **SHIPPED** |
| Debate, moderation, ranking | [`records/DEBATE-record.md`](records/DEBATE-record.md) | **SHIPPED** |
| Participant surfaces | [`records/SURFACES-record.md`](records/SURFACES-record.md) | **SHIPPED** — mobile BUILT on every read surface. The one open piece is **PR #517** (draft): `/m/[slug]`'s phone tier plus, since MOBILE-2e, the phone view of `/u/[pseudonym]`. Five refinement rounds have landed on it (MOBILE-2 · 2b · 2c · 2d · 2e); it is the last surface before the open |
| Admin Control Centre | [`records/ADMIN-record.md`](records/ADMIN-record.md) | **SHIPPED** |
| Platform, deploy, observability | [`records/PLATFORM-record.md`](records/PLATFORM-record.md) | **SHIPPED** — production not promoted |
| Scale programme | [`records/SCALE-record.md`](records/SCALE-record.md) | **PARTIAL** — S-5 unmerged |
| Dataset export | [`records/DATASET-record.md`](records/DATASET-record.md) | **PARTIAL** — pipeline unmerged |
| Market engine (ENGINE .0–.16) | [`records/ENGINE-record.md`](records/ENGINE-record.md) | **CLOSED** |

---

## §3 · Go-live status — measured today, inherited from no tracker

| | Staging | Production |
|---|---|---|
| Served SHA | **`da9979b9`** = `origin/main` = `origin/staging` | **`a61859a`** — 2026-07-02, **356 commits behind `main`** |
| `/api/health` | `env:staging · region:bom1 · db:ok · migrations:ok` | `env:prod · db:ok · migrations:ok` · **no `region` key** |
| Migrations applied | **31 / 31** — `IN SYNC ✓` | **20 / 31** — ⛔ `DRIFT ✗`, eleven behind |
| `identity_pool` total / unassigned | 871 / **861** | ⛔ **0 / 0** |
| `users` | 10 | ⛔ **0** |
| `markets` | 23 — 15 `Open`, 7 content + 8 fixture families | ⛔ **0** |
| `comments` / `bets` | **56 / 56** | 0 / 0 |

✅ **`comments` = `bets` exactly.** INV-1 — no bet without a comment, no comment without a bet —
holding on live data.

⚠ **The staging figures are DELIBERATELY SMALLER than the 2026-09-03 generation's, and that is
not a regression.** `LIQ-1-SOAK-CLOSE` rebuilt the replica from scratch under the final LIQ-1
code: the reset truncated the fixture surface and re-seeded `identity_pool` at its 871
deterministic tuples, the generator rebuilt the fixture set, and the eight content markets were
recreated through the shipped admin engine. **`users` 321 → 10 and `comments`/`bets` 1,692 → 56
are the rebuild, not attrition.** The `markets` count went the other way (12 → 23) because the
fixture families grew.

⛔ **Production is empty, ELEVEN migrations behind, and serving a build from 2 July.** Three
separate gaps on one database, seven days out. None is a defect in shipped code; all three are
work not yet done. `docs/runbooks/deploy-pipeline.md` §3 owns the sequence — and §2 of it was
corrected at PR #500, because the check it told you to run could not tell the two outcomes
apart.

---

## §4 · Open blockers and findings

**Recorded, not fixed.** Every row is measured; none was corrected, because this pass writes
records and a silent fix makes a record disagree with the document it describes. `Owner` is
left blank for the founder.

### Go-live gating

⚠ **Three of these six rows no longer gate, and `D-28` is why.** `F-9` is **discharged**; `F-15` and `F-11` are **reclassified** — the first *by design*, the second *in flight*. They stay in this table rather than leaving it, because an ID a reader is chasing has to remain findable at that ID, and because a reclassification is part of the record rather than a deletion from it. **`F-1`, `F-2` and `F-3` are the live gates.**

| ID | Finding | Evidence | Owner |
|---|---|---|---|
| **F-1** | **Production is 11 migrations behind the code** — `0020_dharma_ledger_seq` … `0030_liquidity_revoke_app_roles`, including `bet_receipts` (the `I-IDEM-ONCE-001` durable backstop), the TRUNCATE guards, `lots`, and now the whole LIQ-1 set (`0027`–`0030`: the injector, its two CHECK-ceiling tightenings and the app-role revokes). ⚠ **The gap grew by four during LIQ-1, which is expected and is why the row is re-measured rather than carried** | `SELECT count(*) FROM drizzle.__drizzle_migrations` → prd `20`, stg `31`; journal `31` entries | |
| **F-2** | **The production database is empty** — no identity pool, no users, no markets | `SELECT count(*)` ×3 against `prd` → `0 0 0` | |
| **F-3** | **The number-tuning pass has not run in general — but the LIQUIDITY subset is now pinned by decision.** ADR-0047 pins `FLOOR` 100,000 · `COEFF` 500 · `TRIGGER` 0.80 · `GUARD_LOW`/`GUARD_HIGH` 0.02/0.95 · `ENDGAME_HOURS` 72 · `INTERVAL` 60 s · `LOCK_TIMEOUT_MS` 100 · `BET_MAX_STAKE` 250, and every one but the last lives in `liquidity_policy`, adjustable by INSERT rather than by deploy. ⚠ **`COEFF` was explicitly NOT swept** (LIQ-SIM-2 §6.5) — it is a starting value with a Runbook row for tuning it against real deployment on 15 Sep. **`TBD` remaining: 16.** ⚠ **This row read 26 on 2026-09-03 and the SOAK measured 16** — ten were pinned across the SPEC.1 2.0.0 rebaseline and ADR-0047. *(⚠ The `LIQ-1-SOAK-CLOSE` kickoff estimated 22 remaining; the measurement is 16. Recorded as measured — `O-2`.)* | `grep -cE '^[A-Z_0-9]+ = TBD' docs/specs/SPEC.1.md` → 16; no general number-tuning ADR exists | |
| **F-15** | ⚠ **RECLASSIFIED — by design, not a blocker (D-28 row 5).** The dataset pipeline (PR **#435**, 57 files, `ci=SUCCESS`, base `main`) is **deliberately held open until after 5 November**. Its being unmerged is the plan, not a gap in it: the artifact the experiment exists to publish is published *after* the experiment ends, so landing it before the freeze would gate nothing and risk something. **Reclassified, not discharged** — the PR is open and still has to land, which is why the row stays. | `gh pr view 435` | D-28 (reclassified) |
| **F-11** | ⚠ **RECLASSIFIED — in flight, not a documented gate (D-28 row 6).** Mobile is decided (ADR-0045, accepted 2026-09-01) and `docs/plans/MOBILE-1.md` landed 2026-09-03; the implementation **PR is to come**. What D-28 rules here is the classification and not the work: a decision with a plan and a PR coming is a lane in progress, and calling it a go-live gate asserted a dependency the founder does not hold. | `ls docs/plans/MOBILE-1.md`; PR search returns only #467 (the plan) | D-28 (reclassified) |
| **F-9** | ✅ **DISCHARGED by D-28 row 4.** The pool is **1,070 by decision, not by shortfall** — 1,070 PFPs × numeric suffixes, the seeding PR merged, and D-11's stated size *superseded*. ADR-0011's 50,000 and ADR-0016:161's restatement of it are the figures that lost, not a target the pool is failing to reach. ⚠ **The ruling closes the question; the count is still a fact, so SYNC-11 re-measured it (2026-09-05):** staging **1,070** rows — **520** unassigned, **550** assigned; production **0**. This row read *548 unassigned* when it was written on 2026-09-03: 28 identities consumed in two days, which is live participant signup and not drift. **Production's zero belongs to `F-2`, not here** — the pool is sized; production has no data of any kind yet. | `doppler run --project zugzwang-experiment --config <stg\|prd> -- psql "$DATABASE_URL" -Atc "SELECT count(*), count(*) FILTER (WHERE assigned_at IS NULL) FROM identity_pool"` → stg `1070\|520`, prd `0\|0` | D-28 · SYNC-11 |

### Correctness and coverage

| ID | Finding | Evidence | Owner |
|---|---|---|---|
| **F-16** | The **pseudonymiser** has **no test file bearing its name** in PR #435's list (no `pseudonymize.test.ts`). Transitive coverage via `build.test.ts`, the round-trip and the egress suite is possible; nobody can tell from the list alone. ⚠ **A draft of this finding also named the egress guard and was WRONG** — the PR carries five `tests/unit/export/egress/*.test.ts`, two name-matched to their modules, inside 18 `tests/unit/export/**` files | `gh pr view 435 --json files \| grep egress` | |
| **F-17** | The shipped debate `.md` export has **no round-trip proof** — nothing parses the emitted Markdown back and compares it to the source | `tests/unit/debate-export/`, `tests/integration/debate-export.integration.test.ts` | |
| **F-14** | **SCALE S-4's own exit metric is unmet.** `docs/logs/S4-FINAL-RECORD.md:8-11`: *"budget tests on five surfaces and two of five exist"*. Partly overtaken — the commits landed — but the gap is undischarged and no closure record exists | that file | |
| **F-13** | The **2026-09-02 load report is not in the repository** (`~/Downloads/zz_LOAD-TESTING-FINAL-REPORT_20260902T1802.md`, 70 lines, md5 `d35063aa61d282d826921fe14f04e0d7`; matches **no** tracked blob). ADR-0038's W-9 / W-10 are still written as open although S-5 has measured | md5 scan over all 1,510 tracked files, with a positive control | |
| **F-18** | ✅ **DISCHARGED at SYNC-6 · PK REFRESH** — ⚠ **and this row said CLEANUP, which was false on `main` for the whole of that PR's life.** The fix was written, run and double-controlled at SYNC-6 · CLEANUP, and then **never committed**: the negative control cut a throwaway branch while the script edit was already `git add`-ed, `git commit -am` swept it into that branch's commit, and `git branch -D` deleted the only object holding it. PR #474's `fix(scripts):` commit `6925b748` therefore carries **`docs/STATE.md` alone** — one file, no script — while its message and this row both described a repaired script. Recovered from the reflog (`858e3fc6`) rather than retyped, so the bytes are the ones that were actually tested. **What the fix is:** the gate asserted `EXPECTED_ADR=29` against 43 and had been dead since the thirtieth ADR merged. Raising the number would not have worked — `SOURCES.md`, which the next gate compares the staged set against, named 29 ADRs — so the ADR set is now **read from** `SOURCES.md` and `EXPECTED_TOTAL` derived from its row count; no hardcoded count remains. `SOURCES.md` gains the 14 missing ADRs in the same PR, so the kit is complete: **`OK: staged 74 content files`, exit 0**, and the tree-vs-kit drift note is now silent because there is no drift. ⚠ **The lesson is the audit, not the git accident:** the post-merge check ran `git diff <branch> origin/main` and got an empty diff — which proves only that `main` matches the branch, and the branch was already missing the fix. **An empty diff is not a receipt; grep the changed line on `main`.** | `bash scripts/stage-reviewer-project.sh --dest <tmp> --sha origin/main`; `git show origin/main:scripts/stage-reviewer-project.sh | grep -c SOURCES_PATH` → must be > 0 | SYNC-6 · PK REFRESH |

### Documentation that disagrees with the tree

| ID | Finding | Evidence | Owner |
|---|---|---|---|
| **F-4** | **`CLAUDE.md`:286 records ADR-0026's admin-upload moderation, which ADR-0027 superseded** — and `grep -c 'ADR-0027' CLAUDE.md` returns **0** (control: `ADR-0026` returns 1). The same bullet says migration `0019` is *"at execute"*; it shipped long ago | `src/app/(admin)/admin/markets/media/sign/route.ts` imports no moderation (0; control: place route 2) | |
| **F-20** | **`SPEC.2` §0 states the ADR ceiling as `0039` and the count as 37** — stale by **six**. The same paragraph warns that *"THREE successive versions of this annotation have now gone stale by one"* and instructs the reader to run `ls docs/adr/` | `ls docs/adr/` → `0045` | |
| **F-21** | `CLAUDE.md` §1 and the `AGENTS.md` footer both state ADRs **0001–0044**, next free **0045** — stale by one | same | |
| **F-22** | **`SPEC.2` changed on 2026-09-02 without a version bump or a changelog row.** `073f65e` (#394, RANK-2) rewrote the §4 ranking-aggregate definitions, +15/−6; §0 still reads `1.0.27`, dated 2026-08-27 | `git log -1 --format='%h %ad' -- docs/specs/SPEC.2.md` | |
| **F-10** | **SPEC.1 carries two live stale statements about the deck.** `grep -n 'six-card deck'` returns **three** lines — `:1505`, `:1573`, `:1730` — but `:1730` ends *"the card count is likewise superseded, the deck no longer being six cards"*, and the changelog row at `:1640` records the correction. **Only `:1505` and `:1573` are uncorrected.** §21.9 at `:1783` (*"govern all seven cards"*) and the seven-element array at `src/components/onboarding/cards.ts:67` agree | `grep -n 'six-card deck' docs/specs/SPEC.1.md` | |
| **F-5** | **`src/components/debate/ResolverCards.tsx:56-60` states arithmetic that does not work** — *"SIX placeholders of THREE kinds … leaving FIVE of TWO"*; 6 − 4 = 2. `AGENTS.md` copied the five. `docs/parked.md` SEQUENCE row 5 still says four. **Measured: two kinds at four mount sites** (`SURFACES-record.md` §4.1) | that file, and the four mount sites | |
| **F-19** | ✅ **DISCHARGED at SYNC-6 · VERIFY.** The four references to `docs/logs/ENGINE-phase-record.md` that SYNC-6 · BUILD left dangling — `docs/adr/0005-postgres-event-sourcing.md:19`, `docs/parked.md:816`, `docs/parked.md:822`, `scripts/stage-reviewer-project.sh:70` — now name `docs/records/ENGINE-record.md`. **The path token was the only thing changed at each site**; no sentence, no surrounding text and no logic moved, which is what let the four walled files be touched at all. Baseline 10 lines / 7 files → 4 → **0**. The two surviving `ENGINE-phase-record` hits are `docs/plans/SYNC-6-BUILD.md:65,90`, where that plan **quotes** the old path while explaining the ambiguity; they are not references and are deliberately left | `git grep -n 'ENGINE-phase-record'` → 3 lines, of which `STATE.md:113` is this row | SYNC-6 · VERIFY |

### Register hygiene

| ID | Finding | Evidence | Owner |
|---|---|---|---|
| **F-12** | **`S-n` names both a SCALE stratum and a Surprise row.** 51 Surprise-row occurrences in `docs/logs/`; **`S-7` is both** the idempotency stratum and POLISH-8's surprise row 7. `docs/logs/CONTENT-2-TILES.md:57` records a kickoff already citing an `S-4` that *"didn't resolve to anything"*. Strata that exist as files: **S-1, S-3, S-4, S-7**; S-5 exists only in PR #462; S-2/S-6/S-8/S-9 do not exist | `grep -rn '^\*\*S-[0-9]* ·' docs/logs/ \| wc -l` | |
| **F-23** | **`L-n` is in use across three registers on `main`.** `docs/polish/POLISH-register-ADDITIONS.md` cites `L-2…L-10` and defines none; `docs/polish/POLISH-register.md:67` carries a **bare `L-6`** from a different task's `@code-reviewer`, which `CLAUDE.md` §8 forbids; `POLISH-0_data-manifest.md:75` records a retired third numbering | those three files | |
| **F-8** | **No branch protection exists on any branch.** `ci` is not a required status check, nothing rejects a force-push, nothing blocks a direct push to `main` or `staging`. Measured and dated in `CLAUDE.md` §5.13 — **the single home; not restated here** | `CLAUDE.md` §5.13 | |
| **F-6** | `DATABASE_URL_TXN` and `DB_POOLER_MODE` exist in Doppler `stg` and not in `prd`. **Deliberate** — ADR-0038 keeps `prd` on `:5432` and `src/db/index.ts:55` refuses `transaction` mode there. Listed so the asymmetry is not later read as a gap | `doppler secrets --only-names` | |
| **F-7** | **`BETTER_AUTH_TRUSTED_ORIGINS` is absent from Doppler `prd` — a config-hygiene item, NOT a security gap.** `src/server/auth/index.ts:330-333` resolves it to `[]`, but Better Auth's `getTrustedOrigins` pushes `new URL(baseURL).origin` **first and unconditionally** (`node_modules/better-auth/dist/context/helpers.mjs:73`) — so the effective production trust set is `["https://zugzwangworld.com"]`, which is exactly what `docs/plans/SCAFFOLD.8-staging-plan.md:173` ratifies. `BETTER_AUTH_URL` cannot be unset: `auth/index.ts:47-49` hard-throws at module load. A second, independent origin defence derives from the same variable at `src/server/middleware/origin-allowlist.ts:24`. **What is missing is the name and any record of a decision to drop it**, not the protection | `doppler secrets --only-names`; `helpers.mjs:60-84` read directly | |
| **F-24** | `origin/chore/pfp-2-plans-log` was pushed 2026-09-03 with **no PR of any state** — `gh pr list --state all --head chore/pfp-2-plans-log` → empty, against a control that returns rows for a branch that has one. ⚠ `origin/feat/e2e-playwright-setup` **does** have a PR — **#420, CLOSED unmerged**, 2026-08-26 — so only one branch is orphaned, not two | `gh pr list --state all --head <branch>` | |

---

## §5 · Where the rules live

**Pointers only. Nothing in this table is restated anywhere in `docs/records/`.**

| Document | Owns |
|---|---|
| `docs/specs/SPEC.1.md` | product — what it does and why |
| `docs/specs/SPEC.2.md` | architecture |
| `docs/specs/cpmm.md` | every CPMM formula and the numeric policy |
| `docs/specs/RANKING.md` | the ranking function |
| `docs/specs/debate-export.md` | the export format |
| `docs/specs/flows/` | **37** normative flow specs — `F-AUTH-*`, `F-BET-*`, `F-COMMENT-*`, `F-DEBATE-*`, `F-MOD-*`, `F-RESOLVE-*`, `F-ADMIN-*` — plus a `README.md` (`ls docs/specs/flows/F-*.md \| wc -l` → 37) |
| `docs/adr/` | **44** decisions, `0001`–`0046` — 0002 and 0012 unused, so read the highest number and never count (`ls docs/adr/`). **Precedence (D-22): decision record → `SPEC.1` → `SPEC.2` → ADRs → tracker.** An ADR loses to either spec, and all three lose to the decision record — the ADRs were written at product genesis, before the goal was settled |
| `CLAUDE.md` | the build contract — invariants, refusal triggers, workflow, **O-space** (§8), the branch-protection measurement (§5.13) |
| `AGENTS.md` | stack patterns — descriptive, tracks the repo |
| `docs/parked.md` | the deferred docket, and the SEQUENCE table of rows whose trigger has fired |
| `docs/polish/POLISH-0_data-manifest.md` §5 | **V-space** — verification lessons |
| `docs/polish/POLISH-register-ADDITIONS.md` | **L-space** |
| `docs/overnight-run.md` | how an unattended run works |
| `docs/runbooks/deploy-pipeline.md` | the promote sequence |
| `docs/runbooks/dataset-release.md` | the public dataset release (untimed — D-21/D-26) |
| `docs/runbooks/BREAK_GLASS.md` | credential rotation |
| `docs/runbooks/staging-provisioning.md` | the staging sandbox |
| `docs/design/design-{canon,language,token-contract}.md` | tokens, composition, copy register |
| `docs/journey/` | the narrative account of the build |

---

## §6 · Environments

| | Staging | Production |
|---|---|---|
| Domain | `staging.zugzwangworld.com` | `zugzwangworld.com` |
| Deploys | auto, on push to `staging`; `staging-migrate.yml` applies migrations | **not auto-served** — a `main` push builds a production-target deployment and does **not** move the alias |
| Region | `bom1` (ADR-0006, applied at PERF-1 #307) | `bom1` on new builds; the alias build predates the field |
| Database | Supabase, session pooler; transaction pooler available behind `DB_POOLER_MODE` | Supabase, session pooler only |
| Doppler config | **`stg`** — 41 secret names | **`prd`** — 36 secret names |
| Data | **live participant writes** — 1,692 comment/bet pairs, 8 content markets + 4 load fixtures | empty |
| Health gauge | `GET /api/health` → `env`, `canary`, `region`, `db`, `migrations` | same |

⛔ **`pnpm staging:rebuild` replaces staging's data and there is no restore path.** Staging is
under active participant write; treat it as production data that happens to be reachable.

**Divergence:** `git rev-list --left-right --count origin/main...origin/staging` → `1 0`.
`origin/staging` is a strict ancestor of `origin/main`, one docs-only commit behind.
