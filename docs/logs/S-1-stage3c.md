# S-1 · Stage 3c execution — session log

**Task:** S-1 — transaction pooler migration. This session: execute the ratified next
action, criterion 4 (*"Bet path works under `SERIALIZABLE`"*, S-1 plan `:535`), on the
preview.
**Ritual:** CC-LIGHT, gated. `ultracode` FORBIDDEN, not used. No subagents invoked.
**Ground:** branch `fix/pool-transaction-mode` @ `f3ac4bd`; worktree `experiment-b` @
`b98efe3` (code-identical — the three later commits are log-only, verified by
`git show --stat`).

> Continues `docs/logs/S-1-stage3b.md`. That file is not amended.

---

## ⛔ HEADLINE — **STATUS: HALTED. `HALTED-AT`: criterion 4, preview column.**

**Criterion 4 cannot be performed on the preview, and this is structural rather than a
matter of trying harder.** Two independent blockers were found, *either one of which is
sufficient on its own*, and neither is inside S-1's declared file set:

1. **No session can exist at the preview origin.** Better Auth's `baseURL` comes from
   `BETTER_AUTH_URL`, which in Doppler `stg` — the config the preview also reads — is
   `https://staging.zugzwangworld.com`. The OAuth `redirect_uri` is built from it, so
   Google returns to *staging*, and the state cookie set at the preview origin does not
   travel cross-origin. **This is a known, documented, parked defect, not a discovery:**
   `src/server/auth/index.ts:321` says in as many words *"preview auth is known-broken per
   docs/parked.md M1/M2"*, and `docs/parked.md` records that **preview OAuth has never
   worked at any URL**.
2. **Even holding a valid session, the bet is rejected before anything else runs.**
   `runBetEndpoint` step 0 is `checkOrigin` (`src/server/bets/endpoint.ts:154-159`), and
   `origin-allowlist.ts` derives its allowlist **solely from `BETTER_AUTH_URL`**. A browser
   at `experiment-e75od9xcz-….vercel.app` therefore gets **403 `error_origin_not_allowed`**
   — before auth, before idempotency, before moderation, before the transaction.

⚠ **The fix for either one is a named S-1 halt condition.** `BETTER_AUTH_URL` is a live
shared `stg` value that *also* drives staging's auth **and** staging's own origin allowlist;
repointing it would break staging sign-in and every staging bet. That is exactly the
cross-lane blast radius for which the plan rejected option (e). The plan's own halt list
names both *"a revision that would go outside the declared file set"* and *"the change
appearing to need … any auth file — **the plan is wrong**"*.

⇒ **This is a plan defect, not a pooler defect.** Nothing observed today casts any doubt on
transaction mode; criterion 6 stays GREEN.

**Nothing was worked around. No auth file was touched, no Doppler value was written, no bet
was placed, and no row of any kind was written to staging by CC.**

---

## What landed

**No code changes. No application-code commits. No PR.** The repository artifact is this
report and the session log. Four read-only probes and two instruments were built in a
**gitignored** directory (`experiment-b/.cache/s1-c4/`, `.gitignore: .cache/`) precisely so
`git status` stays clean; it does.

---

## ✅ What WAS discharged — three prerequisites closed, one of them by luck

### 1. `OPENAI_API_KEY` is now EXERCISED and VALID — the flagged risk is discharged

Carried into this session as ⚠ OPEN (*"present in Doppler `stg`, **unexercised**. Presence
is not validity … **Suspect the key before the pooler**"*).

**A complete bet landed on staging at 2026-08-24T08:51:38.479Z** — not by CC (see the
SURPRISE below). `precommitModerate` is called **unconditionally** on the place path
(`src/app/api/bets/place/route.ts:133`), before the transaction, and it fails closed. **The
bet succeeded ⇒ OpenAI returned a verdict ⇒ the key is valid**, on the same Doppler `stg`
config the preview reads.

⇒ **The most likely false-negative diagnosis in the criterion-4 runbook is now eliminated in
advance**, which is worth more than the bet that eliminated it.

### 2. `identity_pool`, and the account/session picture — re-measured, not recalled

| | |
|---|---|
| Users | **7**, not the 6 recorded at stage3b close — `RedOwl006` was created **today 09:27:03Z**, ToS accepted **09:36:47Z**, holds **1000 Đ**, **1 live session**, **no positions** |
| Stake floors | `BET_MIN_STAKE_POST` = **10**, `BET_MIN_STAKE_REPLY` = **50** (`src/server/config/limits.ts:104,107`) |
| `RedFox000` | **16.894441040356560144 Đ** — above the POST floor, **below the REPLY floor**. A reply-bet from this account would be rejected on the floor and would present as *"the bet didn't work."* |
| Open markets | **8**, all with `resolution_deadline` in the future |

⚠ **`RedOwl006` — 1000 Đ, a live session, no positions — is the ideal criterion-4 actor**, and
its creation this morning reads like preparation for exactly that. **Which origin it was
created on is the question that decides everything, and the database cannot answer it.**

### 3. The instruments are built AND validated in both directions

Two read-only tools, both refusing to start if `DATABASE_URL` contains `:6543` (§4 property 1
— never observe through the pooler under test):

- **`c4-dash-sampler.mts`** — the DASH sampler. 200 ms period, chosen against §4 property 2
  (*one bet is 16–19 statements*), not against a burst. Writes JSONL, prints changes only.
- **`c4-verify.mts`** — the post-bet spine verifier. Criterion 4's halt clause is *"fails,
  retries out, produces no receipt, or **hangs**"*, so it asserts the **whole W-1 spine**, not
  that a bet row exists — a bet row without its receipt, its lot or its ledger pair is a
  partial write, which under INV-1 is the failure atomicity exists to make impossible.

**Both were proven before they were trusted, and both needed correcting to be worth anything:**

| Instrument | Defect found in it | Fix |
|---|---|---|
| Sampler | Reported **its own backend** as the busy one — the instrument producing its own result, the stage3b lesson verbatim | `AND pid <> pg_backend_pid()` |
| Verifier | Asserted *"exactly one position row"* — **wrong**; positions are per (user, market, **side**), so a user legitimately carries a zero row on the side they sold out of. It FAILed a healthy bet | assert a row **for the bet's side with quantity > 0** |

- **Sampler negative control:** quiet against a quiet database (0 busy backends, 48 samples).
- **Sampler POSITIVE control:** a deliberate read-only `BEGIN … pg_sleep(5) … COMMIT` on a
  second `:5432` connection was caught within one sample — `pid=3989205 idle in transaction …
  begin`, then `active … SELECT pg_sleep($1) wait=Timeout/PgSleep`. ⇒ **the sampler can see a
  transaction on another backend, and a quiet screen now means a quiet database.**
  *(V-2: a verification that passes when it is not looking is worth nothing.)*
- **Verifier positive control:** run against the known-good 08:51 bet → **8/8 PASS**.

---

## ✅ A CRITERION WAS TAKEN THAT NOBODY ASKED FOR — **I-LOT-SUM-001, LIVE**

AGENTS.md §9 and ADR-0039 R2 both record that the on-disk `I-LOT-SUM-001` *"seeds its own rows
into the local ephemeral Postgres … so it proves the RULE and observes **NO live
environment** — a live-DB Σ check is **owed** and belongs with the staging gates."*

**It is taken here, against live staging, and it is clean.** Σ `lots.surviving_shares` ==
`positions.quantity` across **all six** non-trivial (user, market, side) triples, **drift
exactly `0.000000000000000000` on every one**, including the two zero-quantity rows.

⇒ **The owed live check is discharged.** It cost one query because the instrument was already
open, and it is the strongest single statement available today about the money path's health.

---

## ⚠ SURPRISE — staging was written to between sessions, and it changes a baseline

**Not by CC.** From IP `115.98.232.47`, Chrome/macOS — the operator:

| When (UTC) | What |
|---|---|
| 08:06 – 08:51 | six `image_upload.sign_requested` |
| **08:51:38.479** | **a complete bet** — `RedFox000`, `github-zugzwang-repo-stars`, **NO**, stake **10**, 18.577488016091033164 shares, with an image, `flow_id` **F-BET-1** |
| 08:51:38.479 | `daily_allowance` **+10** at seq 619 and `bet_stake` **−10** at seq 620 — same timestamp, i.e. accrual inside the bet's own W-1 transaction |
| 09:27 – 09:36 | **`RedOwl006` signs up**, accepts ToS, is granted 1000 Đ |

⛔ **WHICH DEPLOYMENT SERVED THESE IS NOT RECORDED ANYWHERE.** `events.metadata` carries `ip`,
`flow_id`, `user_id`, `request_id`, `user_agent`, `idempotency_key` — and **no canary, SHA,
origin or pooler field**. The preview and staging share one database, so a row landing in it
says nothing about which runtime, or which pooler, put it there.

⚠ **This is the criterion-2 error wearing criterion 4's clothes** — treating a fact about the
database as a fact about the deployment — and it is the second time in two sessions this
project has had to be careful about precisely that distinction.

**The inference, stated as an inference:** `RedFox000`'s newest session row predates today
(2026-08-22) and **no new session was created for it today**, so the 08:51 bet rode an
existing cookie — and a cookie set on the staging origin. Combined with blocker 2 above
(a preview-origin bet is 403'd at step 0), **the 08:51 bet almost certainly went through
STAGING on `:5432`.**

⇒ **It is NOT Sample A.** Sample A is defined at plan `:379` as taken **after** the O-4
advance, at the merged SHA. Staging currently runs `25fc31e`, pre-merge. This is a
**pre-merge, pre-flip, `:5432`** exercise — genuinely useful for the moderation key and for
the money path's general health, and **evidence for nothing about the pooler**.

**Baseline for the criterion-4 delta, measured 09:42Z, i.e. AFTER the 08:51 bet:**
`bets 17 · comments 17 · bet_receipts 24 · lots 17 · dharma_ledger 35 · events 108`.

---

## ⚠ The clock offset MOVED — do not reuse the recorded one

stage3b measured **db − local ≈ +3.3 s** and warned that correlating a browser stopwatch
against a DB timestamp without it is what made the burst look like it never reached the
database.

**Measured today across five independent samples: +4.20, +4.18, +4.16, +4.15, +4.11 s at
start; +3.89 s at the end of two separate runs.** It drifts by ~0.3 s within a single
16-second run. ⇒ **The offset is a MEASUREMENT, not a constant.** Both instruments now take it
at start **and** at end and write both into the record.

---

## Open questions

- **⛔ WHAT REPLACES CRITERION 4's PREVIEW COLUMN? — founder ruling required.** Three
  candidates, in order of how well they preserve what the plan was buying:

  - **(A) Drop the preview column; take criterion 4 on staging only (step (h)).**
    There is precedent in the plan itself — **criterion 7 has no preview column on purpose**,
    for a structurally identical reason (the preview cannot host the flow at all). Cheapest,
    and staging's run is the one that closes the task regardless.
    ⚠ **State the cost rather than glossing it: the plan's design is that the preview pass is
    what GATES THE PR. Under (A) the money path is first exercised on `:6543` only AFTER the
    merge and the flip** — the gate does not move, it disappears.
  - **(B) Fire parked §10.c + §10.d** (preview `BETTER_AUTH_URL` + the Google client's
    preview callback URI). Makes the preview column executable as written. **Coupled,
    multi-task, touches auth — a named S-1 halt condition. Not S-1's to do.**
  - **(C) Exercise the money path against `:6543` without a browser.** ⚠ **There is a
    ratified vehicle for this and it is worth knowing about:** `tests/staging/`'s
    engine-driven generator (ADR-0035/0036) already drives the real `place` against the LIVE
    staging database under a five-guard contract, and **`_lib/target.ts` constrains host and
    production-ref but places NO constraint on PORT** — so pointing it at the `:6543` URL is
    mechanically possible. **Its blast radius is a fixture rebuild, not one bet**, and it is
    outside S-1's declared file set. A narrower variant — one harness calling
    `precommitModerate` honestly and then the W-1 transaction through `DATABASE_URL_TXN` —
    has a one-bet blast radius but is new code, still outside the file set, and exercises the
    transaction spine rather than the bet path end-to-end (no auth, idempotency, rate-limit
    or envelope layer).

  ⚠ **The Standing Refusal governs all three.** None of them may become *"skip moderation for
  the test bet."* (C) is only admissible **because** it calls the real gate.

- **⛔ THE IGNORED BUILD STEP STILL NEEDS A RULING, AND IT IS STILL OQ-1.** Unchanged from
  stage3b; the preview built for this branch is still serving, so nothing is blocked on it
  *today*, but the dated per-branch exception is still pending and still un-deletable from a
  session (no `vercel` CLI, no `gh`, no `VERCEL_*` key in Doppler).
- **⚠ S-5 still inherits the criterion-6 false negative.** Unchanged, and still not S-1's to
  answer.
- **Criterion 1's instrument is still weaker than the criteria table implies** — `/api/health`
  has no pooler or port field, by a declared hard constraint in its own docblock.
- **Unruled recommendation, now raised a THIRD time:** move the step-(d) unset to just
  **before** the merge rather than after.

---

## Next session starts at

**The ruling on criterion 4's preview column is the gate; nothing after it can be sequenced
without it.** Both instruments are built, controlled and ready, and the pre-bet baseline is
recorded — so whichever option is ruled, the observation itself is minutes of work, not hours.

- **If (A):** criterion 4 moves to step (h) and the preview half of step (b) is **closed as
  N/A with its reason recorded in the criteria table** — written INTO the table, per O-5, not
  appended as an amendment nobody reaches.
- **If (C):** the vehicle needs its own ruling before any harness is written.

⚠ **Criterion 2 remains un-closeable on the preview regardless** — property 3's Sample A/B is
staging-only by construction (plan `:379`), so it stays open until steps (f) and (h) whatever
is decided here.

---

## Context to preserve

- **⚠ `DB_POOLER_MODE=transaction` IS STILL SET IN DOPPLER `stg`.** Re-verified today. Still
  inert only because `main` and `staging` carry no flag-reading code. ⛔ **If anyone advances
  `main` → `staging` while it is set, the advance IS the flip**, Sample A becomes unobtainable
  and the A/B collapses to *SHA + mode*. Nothing goes red when this happens; the only casualty
  is a measurement nobody can take any more.
- **F-1 / F-1b re-verified:** `DATABASE_URL_TXN` = `aws-1-ap-south-1.pooler.supabase.com:6543`,
  `DATABASE_URL` = the same host at `:5432`, `DB_POOLER_MODE` = `transaction`.
- **Preview is alive and current:** `canary 6ece90b` · `env staging` · `region bom1` · `db ok`
  · `migrations ok`. `6ece90b` is a **log** commit that post-dates the last code commit
  (`b98efe3`), so the preview carries all of this branch's code.
- **The Doppler project is `zugzwang-experiment`, and the config is `stg`.** `--project
  zugzwang` fails; `--config staging` would too (CLAUDE.md Gotchas).
- **⛔ `events.metadata` CANNOT ATTRIBUTE A ROW TO A DEPLOYMENT.** No canary, SHA, origin or
  pooler field. Two runtimes share one database. **Any future "did it go through `:6543`?"
  question must be answered at observation time, from the DASH side — it cannot be
  reconstructed afterwards from the data.** This is the single most reusable finding here.
- **Scripts live in `experiment-b/.cache/s1-c4/`** — gitignored deliberately, so operational
  probes never dirty the tree. They are `.mts`, not `.ts`: `tsx` compiles a bare `.ts` here as
  CJS and rejects top-level `await`. Run them as
  `doppler run --project zugzwang-experiment --config stg -- npx tsx .cache/s1-c4/<f>.mts`
  from `experiment-b` — a bare `node_modules/.bin/tsx` path fails under this shell.
- **No writes of any kind reached staging by CC.** No bet, no Doppler write, no deployment, no
  application code edited, `git status` clean. Every probe was a read through `:5432`; the
  positive control's transaction was explicitly `SET TRANSACTION READ ONLY`, took no locks and
  committed itself, leaving nothing to clean up (the Windows no-signal-handler lesson applied
  rather than re-learned).

---

## Time

Session ran 2026-08-24, ≈ 09:40–09:55 UTC (local IST 15:10–15:25). Ground `f3ac4bd`.
Zero application-code commits.
