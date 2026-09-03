# STATE — where Zugzwang is

**Generated** 2026-09-03 from `origin/main` @ `ead741577b89849560ab3d3222a48b2a69bf18b7`
**Regenerate** per `docs/records/README.md` · **Lane detail** in `docs/records/`
**Go-live** 2026-09-15 — **12 days from this generation**

> This file is an **index and a measurement**. It carries no rule of its own; if a sentence
> here reads as normative, that is a defect. The rules live where §5 points.

---

## §1 · Measured ceilings

⛔ **These decay. Re-measure them; never read them.** Every row carries the command that
produced it, which is the only thing about this section that stays true. This is the fifth
consecutive documentation pass at which a *copied* ceiling has been found stale — including
passes whose own prose contained the instruction not to copy one.

| Quantity | Value | Command |
|---|---|---|
| **ADR ceiling** | **0045** (`0045-mobile-responsive-browsing-and-auth-gate.md`) · next free **0046** | `ls docs/adr/ \| sort \| tail -1` |
| ADR files | **44** = 43 ADRs + `_template.md`; `0002` and `0012` never used | `ls docs/adr/ \| wc -l` |
| **SPEC.1** | **1.0.49** (2026-09-03) | `grep -m1 '^- \*\*Version:' docs/specs/SPEC.1.md` |
| **SPEC.2** | **1.0.27** (dated 2026-08-27 — but see `F-22`) | `grep -m1 '^\| \*\*Version\*\* \|' docs/specs/SPEC.2.md` |
| **cpmm.md** | **2.1.0** (2026-07-15) | same shape |
| **Migration head** | **`0026_lots_no_delete`** · 27 `.sql` files · journal 27 entries | `ls drizzle/migrations/*.sql \| sort \| tail -1` |
| **`EVENT_TYPES`** | **24** — `src/server/events/schemas.ts:54` | `awk '/export const EVENT_TYPES = \[/,/\] as const;/' … \| grep -cE '^\s+"'` |
| **Test files** | **462** — unit 227 · server 157 · integration 36 · db 18 · invariants 13 · scale 8 · staging 3 | `find tests -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' \) \| wc -l` |
| Suite actually run by `vitest run` | **451** — scale (8) and staging (3) are config-excluded | `pnpm vitest run` |
| **Invariant specs** | **13** | `ls tests/invariants/ \| wc -l` |
| **O-space** | **O-15** | `grep -oE '\*\*O-[0-9]+ ·' CLAUDE.md \| sort -u -t- -k2 -n \| tail -1` |
| **V-space** | **V-21** ⚠ `V-15` is deliberately reserved; `V-22` appears only in a sentence saying a row does *not* take it | `grep -oE '\*\*V-[0-9]+ ·' docs/polish/POLISH-0_data-manifest.md \| …` |
| **L-space** | **L-10** — and see `F-23` | `grep -oE '\bL-[0-9]+\b' docs/polish/POLISH-register-ADDITIONS.md \| …` |
| Merged PRs | **449** (15 closed-unmerged, 3 open, 467 total) · first merge PR #1, 2026-04-23 | `gh pr list --state merged --limit 600 --json number --jq length` |
| `docs/logs/` + `docs/plans/` | **366** (236 + 130) — the corpus `docs/records/` replaces | `ls docs/logs \| wc -l` · `ls docs/plans \| wc -l` |

---

## §2 · What is built

| Lane | Record | Status |
|---|---|---|
| Auth, identity, onboarding | [`records/AUTH-record.md`](records/AUTH-record.md) | **SHIPPED** |
| Debate, moderation, ranking | [`records/DEBATE-record.md`](records/DEBATE-record.md) | **SHIPPED** |
| Participant surfaces | [`records/SURFACES-record.md`](records/SURFACES-record.md) | **SHIPPED** — mobile NOT BUILT |
| Admin Control Centre | [`records/ADMIN-record.md`](records/ADMIN-record.md) | **SHIPPED** |
| Platform, deploy, observability | [`records/PLATFORM-record.md`](records/PLATFORM-record.md) | **SHIPPED** — production not promoted |
| Scale programme | [`records/SCALE-record.md`](records/SCALE-record.md) | **PARTIAL** — S-5 unmerged |
| Dataset export | [`records/DATASET-record.md`](records/DATASET-record.md) | **PARTIAL** — pipeline unmerged |
| Market engine (ENGINE .0–.16) | [`records/ENGINE-record.md`](records/ENGINE-record.md) | **CLOSED** |

---

## §3 · Go-live status — measured today, inherited from no tracker

| | Staging | Production |
|---|---|---|
| Served SHA | `e193cfb` = `origin/staging` | **`a61859a`** — 2026-07-02, **326 commits behind `main`** |
| `/api/health` | `env:staging · region:bom1 · db:ok · migrations:ok` | `env:prod · db:ok · migrations:ok` · **no `region` key** |
| Migrations applied | **27 / 27** — `IN SYNC ✓` | **20 / 27** — ⛔ `DRIFT ✗` |
| `identity_pool` total / unassigned | 1,070 / **548** | ⛔ **0 / 0** |
| `users` | 321 | ⛔ **0** |
| `markets` | 12, all `Open` (8 content + 4 load fixtures) | ⛔ **0** |
| `comments` / `bets` | **1,692 / 1,692** | 0 / 0 |

✅ **`comments` = `bets` exactly, on 1,692 live participant rows.** That is INV-1 — no bet
without a comment, no comment without a bet — holding on real data. The pair moved from
1,689 to 1,692 during this generation and stayed equal across the change.

⛔ **Production is empty, seven migrations behind, and serving a build from 2 July.** Three
separate gaps on one database, twelve days out. None is a defect in shipped code; all three are
work not yet done. `docs/runbooks/deploy-pipeline.md` §3 owns the sequence.

---

## §4 · Open blockers and findings

**Recorded, not fixed.** Every row is measured; none was corrected, because this pass writes
records and a silent fix makes a record disagree with the document it describes. `Owner` is
left blank for the founder.

### Go-live gating

| ID | Finding | Evidence | Owner |
|---|---|---|---|
| **F-1** | **Production is 7 migrations behind the code** — `0020_dharma_ledger_seq` … `0026_lots_no_delete`, including `bet_receipts` (the `I-IDEM-ONCE-001` durable backstop), the TRUNCATE guards and `lots` | `doppler run --config prd -- pnpm db:check-drift` → `20 applied` vs journal `27` | |
| **F-2** | **The production database is empty** — no identity pool, no users, no markets | `SELECT count(*)` ×3 against `prd` → `0 0 0` | |
| **F-3** | **The number-tuning pass has not run.** SPEC.1 Appendix B carries **26** `TBD` constants; `src/server/config/limits.ts` ships **13** of them as values whose own JSDoc reads `PLACEHOLDER VALUE — tuned by HARDEN.5`, dated **~2026-09-01** in five comments | `awk 'NR>=1975' docs/specs/SPEC.1.md \| grep -cE '^[A-Z_0-9]+ = TBD'` → 26; no number-tuning ADR exists | |
| **F-15** | **The dataset pipeline is unmerged.** PR **#435**, 57 files, `ci=SUCCESS`, base `main` — the artifact the experiment exists to publish | `gh pr view 435` | |
| **F-11** | **Mobile is decided and unbuilt.** ADR-0045 accepted 2026-09-01, `docs/plans/MOBILE-1.md` landed 2026-09-03; **no implementation PR** | `ls docs/plans/MOBILE-1.md`; PR search returns only #467 (the plan) | |
| **F-9** | `identity_pool` is sized at **50,000** by ADR-0011 and stated as fact by ADR-0016:161; **1,070 rows exist** on staging, 548 unassigned. ADR-0011's own patch text already says the manifest is *"still owed"* | `SELECT count(*) FROM identity_pool` | |

### Correctness and coverage

| ID | Finding | Evidence | Owner |
|---|---|---|---|
| **F-16** | The **pseudonymiser** and the **egress guard** — the two components whose failure mode is publishing what must not be published — have **no test file of their own** in PR #435's file list. Transitive coverage is possible; nobody can tell from the list | `gh pr view 435 --json files` | |
| **F-17** | The shipped debate `.md` export has **no round-trip proof** — nothing parses the emitted Markdown back and compares it to the source | `tests/unit/debate-export/`, `tests/integration/debate-export.integration.test.ts` | |
| **F-14** | **SCALE S-4's own exit metric is unmet.** `docs/logs/S4-FINAL-RECORD.md:8-11`: *"budget tests on five surfaces and two of five exist"*. Partly overtaken — the commits landed — but the gap is undischarged and no closure record exists | that file | |
| **F-13** | The **2026-09-02 load report is not in the repository** (`~/Downloads/zz_LOAD-TESTING-FINAL-REPORT_20260902T1802.md`, 70 lines, md5 `d35063aa61d282d826921fe14f04e0d7`; matches **no** tracked blob). ADR-0038's W-9 / W-10 are still written as open although S-5 has measured | md5 scan over all 1,510 tracked files, with a positive control | |
| **F-18** | ⛔ **`scripts/stage-reviewer-project.sh` is dead on `main`, and was before this pass.** Run at `ead7415`: `ERROR: expected 29 ADR decision files at $SHA, got 43`. It exits at that gate and never reaches the rest of its file list | `bash scripts/stage-reviewer-project.sh --dest <tmp> --sha origin/main` | |

### Documentation that disagrees with the tree

| ID | Finding | Evidence | Owner |
|---|---|---|---|
| **F-4** | **`CLAUDE.md`:286 records ADR-0026's admin-upload moderation, which ADR-0027 superseded** — and `grep -c 'ADR-0027' CLAUDE.md` returns **0** (control: `ADR-0026` returns 1). The same bullet says migration `0019` is *"at execute"*; it shipped long ago | `src/app/(admin)/admin/markets/media/sign/route.ts` imports no moderation (0; control: place route 2) | |
| **F-20** | **`SPEC.2` §0 states the ADR ceiling as `0039` and the count as 37** — stale by **six**. The same paragraph warns that *"THREE successive versions of this annotation have now gone stale by one"* and instructs the reader to run `ls docs/adr/` | `ls docs/adr/` → `0045` | |
| **F-21** | `CLAUDE.md` §1 and the `AGENTS.md` footer both state ADRs **0001–0044**, next free **0045** — stale by one | same | |
| **F-22** | **`SPEC.2` changed on 2026-09-02 without a version bump or a changelog row.** `073f65e` (#394, RANK-2) rewrote the §4 ranking-aggregate definitions, +15/−6; §0 still reads `1.0.27`, dated 2026-08-27 | `git log -1 --format='%h %ad' -- docs/specs/SPEC.2.md` | |
| **F-10** | **SPEC.1 contradicts itself on the deck.** *"six-card deck"* at `:1505`, `:1573`, `:1640`, `:1730`; *"govern all seven cards"* at `:1783`. The array has **seven** (`src/components/onboarding/cards.ts:67`); six is the re-show | `grep -c 'figure: "' cards.ts` → 7 | |
| **F-5** | **`src/components/debate/ResolverCards.tsx:56-60` states arithmetic that does not work** — *"SIX placeholders of THREE kinds … leaving FIVE of TWO"*; 6 − 4 = 2. `AGENTS.md` copied the five. `docs/parked.md` SEQUENCE row 5 still says four. **Measured: two kinds at four mount sites** (`SURFACES-record.md` §4.1) | that file, and the four mount sites | |
| **F-19** | **Four references to `docs/logs/ENGINE-phase-record.md` are left dangling by this pass, deliberately** — `docs/adr/0005-postgres-event-sourcing.md:19`, `docs/parked.md:816`, `docs/parked.md:822`, `scripts/stage-reviewer-project.sh:70`. All four are in files this pass is forbidden to edit. Baseline 10 lines / 7 files → 4 remain | `git grep -n 'ENGINE-phase-record'` | |

### Register hygiene

| ID | Finding | Evidence | Owner |
|---|---|---|---|
| **F-12** | **`S-n` names both a SCALE stratum and a Surprise row.** 51 Surprise-row occurrences in `docs/logs/`; **`S-7` is both** the idempotency stratum and POLISH-8's surprise row 7. `docs/logs/CONTENT-2-TILES.md:57` records a kickoff already citing an `S-4` that *"didn't resolve to anything"*. Strata that exist as files: **S-1, S-3, S-4, S-7**; S-5 exists only in PR #462; S-2/S-6/S-8/S-9 do not exist | `grep -rn '^\*\*S-[0-9]* ·' docs/logs/ \| wc -l` | |
| **F-23** | **`L-n` is in use across three registers on `main`.** `docs/polish/POLISH-register-ADDITIONS.md` cites `L-2…L-10` and defines none; `docs/polish/POLISH-register.md:67` carries a **bare `L-6`** from a different task's `@code-reviewer`, which `CLAUDE.md` §8 forbids; `POLISH-0_data-manifest.md:75` records a retired third numbering | those three files | |
| **F-8** | **No branch protection exists on any branch.** `ci` is not a required status check, nothing rejects a force-push, nothing blocks a direct push to `main` or `staging`. Measured and dated in `CLAUDE.md` §5.13 — **the single home; not restated here** | `CLAUDE.md` §5.13 | |
| **F-6** | `DATABASE_URL_TXN` and `DB_POOLER_MODE` exist in Doppler `stg` and not in `prd`. **Deliberate** — ADR-0038 keeps `prd` on `:5432` and `src/db/index.ts:55` refuses `transaction` mode there. Listed so the asymmetry is not later read as a gap | `doppler secrets --only-names` | |
| **F-7** | **`BETTER_AUTH_TRUSTED_ORIGINS` is absent from Doppler `prd` — a config-hygiene item, NOT a security gap.** `src/server/auth/index.ts:330-333` resolves it to `[]`, but Better Auth's `getTrustedOrigins` pushes `new URL(baseURL).origin` **first and unconditionally** (`node_modules/better-auth/dist/context/helpers.mjs:73`) — so the effective production trust set is `["https://zugzwangworld.com"]`, which is exactly what `docs/plans/SCAFFOLD.8-staging-plan.md:173` ratifies. `BETTER_AUTH_URL` cannot be unset: `auth/index.ts:47-49` hard-throws at module load. A second, independent origin defence derives from the same variable at `src/server/middleware/origin-allowlist.ts:24`. **What is missing is the name and any record of a decision to drop it**, not the protection | `doppler secrets --only-names`; `helpers.mjs:60-84` read directly | |
| **F-24** | `origin/chore/pfp-2-plans-log` was pushed 2026-09-03 with **no PR of any state**; `origin/feat/e2e-playwright-setup` (2026-08-26) likewise | `gh pr list --state all --head <branch>` → empty | |

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
| `docs/specs/flows/` | 38 normative flow specs — `F-AUTH-*`, `F-BET-*`, `F-COMMENT-*`, `F-DEBATE-*`, `F-MOD-*`, `F-RESOLVE-*`, `F-ADMIN-*` |
| `docs/adr/` | 43 decisions, `0001`–`0045`. **On conflict with a spec, the ADR wins** |
| `CLAUDE.md` | the build contract — invariants, refusal triggers, workflow, **O-space** (§8), the branch-protection measurement (§5.13) |
| `AGENTS.md` | stack patterns — descriptive, tracks the repo |
| `docs/parked.md` | the deferred docket, and the SEQUENCE table of rows whose trigger has fired |
| `docs/polish/POLISH-0_data-manifest.md` §5 | **V-space** — verification lessons |
| `docs/polish/POLISH-register-ADDITIONS.md` | **L-space** |
| `docs/overnight-run.md` | how an unattended run works |
| `docs/runbooks/deploy-pipeline.md` | the promote sequence |
| `docs/runbooks/dataset-release.md` | the 2026-11-06 release |
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
