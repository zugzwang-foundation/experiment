# S-1 — CLOSE-OUT LOG

**Task:** S-1 · transaction-pooler migration (`:5432` → `:6543`), staging only
**Closed:** 2026-08-25 · **Plan:** `docs/plans/S-1.md` · **Records:** ADR-0038 P1 · ADR-0024 P3
**Run artifact:** `~/Downloads/zz_S-1_run-dei_2026-08-25T1717.md` (not in-repo; this file is the in-repo record)

> **The record reads: transaction mode PLUS read-path reduction TOGETHER clear the ceiling.**
> Never *"transaction mode clears the ceiling."* S-1 delivered one of the two.

---

## 1 · What landed

| PR | Squash SHA on `main` | What |
|---|---|---|
| **#407** | `b8d75f5` | the two S-5 instruments · `.gitattributes` · the `@/db` §7 exception · the ADR-ceiling correction · the enforcement correction + **O-13** · the `no-force-push-protected` pre-push guard |
| **#404** | `e37da00` | `DB_POOLER_MODE` in `src/db/index.ts` · `verify-pooler-mode.ts` · `pooler-mode.test.ts` (11) · ADR-0038 **P1** · ADR-0024 **P3** · the plan + 5 stage logs |

**`staging` = `e76966f`** — `b8d75f5` and `e37da00` cherry-picked onto it (§3.3), content-parity
verified against `main` for every S-1 and #407 file.

**Doppler `stg`: `DB_POOLER_MODE = transaction`. `DATABASE_URL_TXN` stays minted** — removing
one key is the complete rollback, by design.

---

## 2 · Every criterion, both columns

**§3.5 split applied throughout: `verified` (measured) or `not exercised` (not run). Nothing between.**

| # | Criterion | Preview (Dev B, 2026-08-22/25) | Staging (this run) | Artifact |
|---|---|---|---|---|
| **1** | Runtime connects via `:6543` | **verified** | **verified** (composition — see criterion 2) | `/api/health` canary `e76966f` |
| **2** | Transaction mode actually active | **verified** | **verified** | **criterion 6's discrimination** — `SESSION MODE` before the flip, `TRANSACTION MODE` after, same instrument/code/database 20 min apart |
| **3a** | Client ceiling risen 15 → 200 | **verified** (DASH) | **not exercised** | Supavisor dashboard — not readable from a session |
| **3b** | Backend Pool Size unchanged at 15 | **verified** (DASH) | **not exercised** | same |
| **4** | Bet path works under `SERIALIZABLE` | **verified** — HTTP 200 in 3.55 s vs a 30 s bound, W-1 spine 8/8 | ⛔ **not exercised** | needs an authenticated staging session; not held by the executor |
| **5** | `SET LOCAL` timeouts still apply | **inference by composition** | **inference by composition** | labelled, per §4.4 — never promoted |
| **6** | The positive control fires | **verified** | ⛔ **verified, BOTH directions** | `SESSION MODE` before the flip, `TRANSACTION MODE` after — same instrument, same code, same database |
| **7** | Rollback executed **and** returned | — | **shallow: verified · deep: not exercised** | unset → redeploy → `SESSION` → re-set → redeploy → `TRANSACTION` |

### Labels that stay labels

- **Criterion 2 · established by CRITERION 6, and here is what could NOT establish it.**
  A direct `pg_stat_activity` identity query returns `application_name = "Supavisor"` from one
  address for **every** pooled connection, regardless of which port it arrived on. **The
  database cannot tell you which pooler serves a backend.** That is an architectural fact, and
  **S-5 needs it**: no query against the database will ever attribute load to a pooler.
  Nor can the stored flag be read — Vercel marks it `type: sensitive` and returns `""` for all
  56 project variables, including `ZUGZWANG_ENV`, which is provably `staging`.
  **What establishes it is criterion 6's discrimination:** the sentinel survived *every* read
  before the flip and only *some* after — same instrument, same code, same database, twenty
  minutes apart. **Connection reuse is the only thing that produces that**, and it is not
  affected by how many app instances are running.
  The four-fact composition (Doppler value · explicit redeploy · code resolution · Sample B's
  shift) remains as corroboration.
- **Criterion 5 · inference by composition.** Not measured. Not promoted.
- **Criterion 7 deep · DOCUMENTED, NOT RUN.** `git revert` + redeploy was never executed. V-3's
  split: *"rollback documented"* and *"rollback tested"* are different claims; only the first
  is made.
- **Criteria 3a / 3b staging-side · dashboard, not the executor's to claim.**
- **Sample A/B · directionally consistent, 16 requests, NOT conclusive on its own.**
  9 → 12 backends and 1 → 2 in-transaction is within ordinary variance. The A/B's value is that
  it established a SHA-clean baseline (`canary e76966f` on both sides).
- ⛔ **The 48-request / 8-backend count · DIRECTIONALLY CONSISTENT, CONFOUNDED, not conclusive.**
  48 requests (6 × 8 parallel) at the domain put **8 distinct backends** on app transactions
  against a shipped `max: 4`. **Its distinct and real value is that it was driven at the
  DEPLOYED RUNTIME**, where criterion 6 runs locally against the same secrets — so it is the
  only observation in this task that touches the deployment's own sockets.
  **But `max: 4` is PER INSTANCE.** Six waves of eight parallel requests can raise a second
  Vercel instance, and **two instances in session mode also produce 8 pinned backends.** The
  count therefore does not discriminate between the modes, and it was written up as if it did.
  **The control that would close it was not run: the identical 48-request pattern in session
  mode.** Sample A is not that control — 16 requests, lower parallelism, one instance's worth
  of traffic.
  ⇒ **If a later stratum needs the deployed-runtime claim standing alone, it is one line:**
  delete `DB_POOLER_MODE`, redeploy, replay the same 6 × 8 pattern under the sampler, and
  compare distinct app backends. A session-mode reading at or below 8 leaves the count
  confounded; well below 4 closes it.
  *(Corrected at close-out review. The finding is a LABEL, not a defect — nothing about the
  final state changes, and criterion 2 stands on criterion 6. It is recorded because the row
  that was hardest to earn is the one easiest to overstate, and §5's own discipline for Sample
  A/B applies one row up.)*

---

## 3 · What S-1 does NOT prove

- **It does not prove 3,000 concurrent.** The backend pool is unchanged at **15** and per-tab
  occupancy is **unmeasured**.
- **It does not reduce load.** It raises a client ceiling; it removes no work.
- **It does not establish the tier.**
- **It did not measure the authenticated render.**
- **It did not exercise the money path on staging** — criterion 4 staging-side is `not exercised`.

**⇒ Transaction mode plus read-path reduction TOGETHER clear the ceiling. S-1 is one half.**

---

## 4 · Decisions made

1. **The advance is a CHERRY-PICK, not `push main:staging`.** The refs diverged; `main` was a
   strict ancestor until #407, and 36 UI commits sit on `staging` unmerged. O-4 requires that a
   merge to `main` *reach* `staging`, not that the refs be equal.
2. **`??` → `||` on the mode read.** An empty flag resolved to `""`, which routed correctly but
   exported an empty string into the control's evidence. **Step (d) is the path that produces
   it** — clearing a dashboard field stores empty, not absent.
3. **Step (d) deletes the KEY, never clears the value**, and the read-back must show *absent*.
4. **Nothing was force-pushed.** `main`, `staging` and every feature branch advanced by
   fast-forward only.
5. **The plan was not amended mid-run** when a defect in its own command block surfaced (§6 #1).
   The plan is authority for the execution; editing it while executing it makes the record stop
   matching what happened.

---

## 5 · Open questions

1. **Criteria 3a / 3b staging-side** need a Supavisor dashboard reading. Unclaimed.
2. **Criterion 4 staging-side** needs an authenticated session. Unclaimed.
3. **`staging` is 38 ahead of `main` and diverging** — 10 commits on 08-23, **23 on 08-24**, so
   ~23/day on a full day, not the ~7/day previously quoted. One of them (`efed628`, #403) is
   marked `⛔ LEAVE UNMERGED`; #402 and #406 are open against `staging`. **Programme topology
   decision. Not S-1's.**
4. **Two staging deployments (12:05:21Z, 12:12:33Z) are CANCELED.** Not triggered by this run,
   not explained.

---

## 6 · Findings this run produced

1. ⛔ **§3.3's command block lacks `pnpm install`.** The push cannot succeed as written — a
   fresh worktree has no `node_modules`, so the pre-push `tsc`/`biome` jobs fail with exit 254
   and git rejects the push. **OWED as a doc fix.** Not amended mid-run.
2. ⛔ **`doppler secrets --only-names | grep -x` returns 0 for a PRESENT key** — that flag
   renders a box-drawing table, not bare names. **A read-back that can produce a false "absent"
   is worse than none**, and this one would have reported the key already gone before anything
   was deleted. Use the JSON key set, or `${VAR+x}` through `doppler run`.
3. ⚠ **Up to two staging backends may still carry `statement_timeout = 7777 ms`** until
   Supavisor recycles them — `verify-pooler-mode.ts`'s cleanup could not reach them. **A
   ceiling, not a bypass.** Recorded because the instrument said to record it.
4. ⚠ **`staging..main` still reads 2 after the cherry-pick and always will.** Those commit
   *objects* never become ancestors of `staging`; their *content* did. **Content parity is the
   test; commit reachability is not.** A check written as "expect 0" was wrong by construction,
   and **every future advance inherits this.**
5. ⚠ **Vercel `type: sensitive` env values are unreadable through every API** — `env pull`
   returns `""` for all 56 project variables while returning real values for Vercel's own 9
   build vars. **`""` is not a value.** `ZUGZWANG_ENV` reads `""` and is provably `staging`.
   **This is O-13, and it nearly produced a false halt.**

---

## 7 · Next session starts at

**S-1 is closed.** The next action belongs to other strata — nothing in S-1 is pending.

---

## 8 · Context to preserve

- **`staging` ends on `:6543` and stays there.** `DB_POOLER_MODE=transaction` in Doppler `stg`;
  `staging` = `e76966f`; `/api/health` → `ok / ok / ok`, `region: bom1`.
- **The shallow rollback is one key.** Delete `DB_POOLER_MODE`, redeploy. `DATABASE_URL_TXN`
  can stay minted.
- **A Doppler edit alone reaches nothing** — every flag change needs an explicit redeploy.
- **`max` stays at 4** (ADR-0038 P1.2). The relaxation makes a higher value *permissible*, not
  *correct*; ADR-0038 decision 2 forbids moving it without measurement. **S-5 measures.**
- **The prd guard is a property of the ARTIFACT, not the source** — a prod build keeps it live
  at runtime, a preview build dead-code-eliminates it entirely.

---

## 9 · Time

Steps (d)–(i) plus the post-run check: 2026-08-25 17:17 → 18:0x IST, ~50 min.
Preceded by #407's seven items, #404's Gate C, four plan corrections and two merges.

---

## Findings affecting other strata

**⚠ Three of these land on S-3 TODAY — S-3 has started, and they are not close-out reading.**

| To | Finding |
|---|---|
| **S-3** ⛔ **TODAY** | **The signup deadlock's failure mode changes character.** Session mode failed loud; transaction mode **queues**. Two connections per signup, jams at four — and after this flip it jams **quietly**. |
| **S-3 / S-5** ⛔ **TODAY** | **`connect_timeout` is unpinned at the postgres.js default of 30** (M-C) — the same shape as the `idle_timeout: null` incident of 2026-08-16, where a vendored default silently disarmed a control. |
| **S-5** ⛔ **TODAY** | **`PENDING_TTL_SECONDS = 30` derives from a bound that no longer exists** (H-D, HIGH) — *"bet-transaction worst case ~600 ms upper"*, true only because `:5432` failed fast. **Load must not run until it is re-derived or the wall clock is bounded upstream.** |
| **S-5** | **Saturation goes quiet** (W-10). Instrument **queue depth and backend utilisation**, not error rate — `scripts/sample-backend-activity.ts` is that instrument, and its `--self-test` must pass before a quiet screen is read as a finding. |
| **S-5** | **`f_db` is not observable from S-1.** W-9 does not close without it. |
| **S-5** | **Criterion 4's retry profile is the UNCONTENDED baseline.** A queue with no one in it is indistinguishable from no queue. |
| **S-5** | ⛔ **No database query can attribute load to a pooler.** Every pooled connection presents as `application_name = "Supavisor"` from one address. Attribution must come from the dashboard or from an *effect* (backend count against a known pool ceiling), never from connection identity. |
| **S-8** | **Pool Size stays 15**, deliberately. `max_connections` = 60; guidance band 40–80% (24–48). W-11. |
| **Go-live** ⛔ | **Double-charge (finding S-1, HIGH).** A transient 409 written into the 24-hour completed-response cache; the Redis hit arm short-circuits ahead of the durable receipt. **The flip does not introduce the bug; it introduces the reachability.** A **15 Sep blocker with a named owner**, not a routed note. |
| **Go-live** ⛔ | **Session revocation.** 400-day sessions, refresh disabled, sign-out the only path, no admin revoke surface. With soulbound reputation on a pseudonym from 15 Sep, a borrowed laptop leaves someone posting arguments and moving Dharma under another identity for the whole experiment. |
| **Go-live** | **Finding S-2** — all six rate limits key on client-supplied `x-forwarded-for[0]`. Worst site is `adminLoginPerIp`, the only brute-force cap on a static `ADMIN_PASSWORD`. **The fix is identical either way**, so the measurement is not a prerequisite. |
| **Programme** | **CI runs no `next build`.** The preview build is the build leg and it is **not a required status check** — a PR whose build fails can merge on green CI. |
| **Programme** | **Ignored Build Step (OQ-1)** — dashboard-side, undated, unreadable from a session: no `VERCEL_*` in Doppler. Observed live on #407, whose Vercel check read `Canceled by Ignored Build Step`. |
| **Programme** | **Windows unit suite** — 8 path-portability failures on `main`; `biome check .` cannot pass on any Windows checkout until `.gitattributes` lands **and** existing clones renormalize. `.gitattributes` landed at #407; **the renormalize half is still owed on each clone.** |
| **DP.2 / go-live** ⛔ | **The prd guard is a property of the ARTIFACT, not the source.** Measured on two real builds: a **prod** build keeps `if("transaction"===th)throw …` live at runtime; a **preview** build eliminates it as dead code entirely, because `ZUGZWANG_ENV` is inlined by `next.config.ts`. **If the promote path ever promotes a staging- or preview-built artifact, the guard vanishes and nothing goes red.** |
