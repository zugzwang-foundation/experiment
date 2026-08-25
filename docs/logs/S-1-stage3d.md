# S-1 · Stage 3d execution — session log

**Task:** S-1, transaction-pooler migration. This session: criterion 4 — *"Bet path works
under `SERIALIZABLE`"* (plan `:535`) — executed on the preview via **option (D)**.
**Ritual:** CC-LIGHT, gated. `ultracode` FORBIDDEN, not used. No subagents.
**Ground:** `fix/pool-transaction-mode` @ `69d6288`; preview canary `6ece90b`.

> Continues `docs/logs/S-1-stage3c.md`. That file is not amended.

---

## ✅ HEADLINE — **CRITERION 4: GREEN. Preview column discharged.**

**One bet, HTTP 200, `total=3.550398s` against a 30-second bound.** Full W-1 spine landed,
**8/8 spine assertions PASS**, and the bet's own SQL was positively identified on a named
backend from the DASH side.

**No halt condition fired.** It did not fail, did not retry out, produced its receipt, and did
not hang — the four clauses of the criterion's halt, each answered.

⚠ **Option (D) is proven end-to-end**, which was the open question stage3c left: a session
minted on canonical staging authenticates against the **preview** deployment — the one running
the `:6543` pooler code — with no `Origin` header, no new sign-in, and **every server-side gate
intact**.

---

## The run

| | |
|---|---|
| Actor | **RedHawk007** (`anupambera634@gmail.com`) — 1000 Đ, zero positions, zero prior bets |
| Market | `bitcoin-price-50k` (`01a01181-ca40-725f-895c-270b2190c3ee`), reserves 10000/10000 |
| Side / stake | **YES / 10 Đ** (exactly `BET_MIN_STAKE_POST`) |
| Idempotency-Key | `037acc6d-1975-41c9-aaae-d58381ed9c01` |
| Bound | `--max-time 30`, enforced by curl — **not by judgement** |
| **Result** | **HTTP 200 · total 3.550398 s · connect 0.097 s · ttfb 3.546 s** |
| Bet id | `01a034ad-79a3-77f7-8951-caad3749b92f` |
| Shares / new price | `19.990009990009990009` / `0.500499750000124875` |

**The response body is exactly the wire contract**, no envelope drift:
`{"ok":true,"data":{"betId","commentId","side":"YES","sharesBought","newPrice","parentCommentId":null}}`

---

## Spine verification — 8/8 PASS

| Assertion | Result |
|---|---|
| comment row exists | ✅ |
| comment side == bet side | ✅ |
| durable receipt exists (I-IDEM-ONCE-001) | ✅ |
| exactly one lot minted (ADR-0039) | ✅ |
| lot side == bet side | ✅ |
| `bet_stake` ledger row exists (INV-2) | ✅ |
| position row for the bet's side, quantity > 0 | ✅ |
| `bet.placed` + `comment.placed` events | ✅ |

**Deltas against the 16:42Z baseline** (`21 · 21 · 28 · 21 · 41 · 130`): **+1** bets, comments,
receipts, lots · **+2** ledger · **+3** events.

⚠ **The ledger +2 is the daily allowance riding inside the same W-1 transaction**, exactly as
predicted before the run — and the chain is exact:

| seq | entry | amount | balance_after | created_at |
|---|---|---|---|---|
| 627 | `initial_grant` | +1000 | 1000 | 16:16:26.180Z |
| **628** | **`daily_allowance`** | **+10** | **1010** | **16:49:39.172Z** |
| **629** | **`bet_stake`** | **−10** | **1000** | **16:49:39.172Z** |

**Identical timestamps on 628 and 629 ⇒ one transaction.** That is INV-1 atomicity visible in
the data rather than asserted about it.

**`I-LOT-SUM-001`, live, re-taken after the write:** Σ `lots.surviving_shares` ==
`positions.quantity` across **all ten** (user, market, side) triples — **drift exactly zero on
every one**, including the new RedHawk007 row.

---

## The DASH observation — recovered post-hoc, and the record is why

⛔ **THE LIVE SAMPLER SCREEN MISSED THE BET.** Across 294 samples at a 200 ms period, the only
backend it printed as busy was `pid=1119313` running
`SELECT SUM(pg_database_size(...))` — **Supabase's own internal monitoring, not our bet.**

⚠ **Had the sampler only printed, criterion 4's DASH column would have come back empty and
looked like a negative.** It did not, because the JSONL captures **every backend's
`query_start` / `xact_start` / `state_change` every 200 ms**, which makes the transaction
recoverable from the residue even when no sample catches it `active`. **That design decision is
the only reason this criterion has an observation at all.**

**What the record shows, in DB time** (clock offset measured `+3.90 s` at start, `+3.56 s` at
end — it moved 0.34 s inside one 60-second run):

| DB time | Backend | Evidence |
|---|---|---|
| 16:49:37.445 / .446 | **`4020028` + `4020029` BORN** | Supavisor opened two server connections **at the moment the request arrived**; census 12 → 14 |
| 16:49:37.529 | `4020029` | `select "body_fingerprint", "result" from "bet_receipts" where …` — ⇒ **the ADR-0031 durable idempotency pre-check. This is the bet path and nothing else issues it.** |
| 16:49:39.172 | — | `bet_receipts`, `lots`, `positions`, ledger 628+629 all written |
| 16:49:39.264 | `4020029` | **`commit`** |
| 16:49:37.45 → 16:49:41.45 | `4020005`, `4020028` | `SELECT * FROM pgbouncer.get_auth($1)` — Supavisor authenticating its new server connections |

⇒ **The bet's SQL is attributed to a specific backend, created on demand for it, and observed
committing.** `4020029` was never caught in `state=active` — only its advancing timestamps and
its residual query text prove the statements ran.

⚠ **HONEST LIMIT, stated rather than glossed:** this trace proves the bet **executed and
committed**, and is **consistent with** transaction mode — it does **not** discriminate the
mode on its own. Supavisor pools server connections in both modes, so *"backends created on
demand and left idle"* is not a mode signature. **The mode attribution rests on the chain
already established** — preview canary `6ece90b` contains the flag-reading code ·
`DB_POOLER_MODE=transaction` · therefore `DATABASE_URL_TXN` = `:6543` · and criterion 6 proved
`:6543` multiplexes. **Corroboration, not observation** — the same distinction stage3b had to
draw, drawn again here rather than quietly dropped.

**No serialization retry occurred:** one receipt, one bet, one lot, no `40001` evidence. Of the
3.55 s total, ~1.5 s precedes the backend checkout (the OpenAI moderation hop, correctly
**outside** the transaction per ADR-0014) and ~1.7 s is the W-1 transaction itself.

---

## ⚠ Two corrections made during the run, both caught before the write

1. **The cookie name is `__Secure-zugzwang_session`, not `zugzwang_session`.** Better Auth
   prepends `__Secure-` when `secure: true`; the config at `src/server/auth/index.ts:383-392`
   only sets the base name. **The runbook I issued would have sent a header matching nothing
   and returned a 401 that looked like a broken session.** Caught because the operator pasted
   the name from DevTools. ⚠ *Separately: SPEC.2 §8.5 mandates the participant cookie name
   `zugzwang_session`; the wire name is `__Secure-zugzwang_session`. That is a spec-vs-reality
   drift worth a docket line — it is not S-1's to resolve.*
2. **⛔ I asserted the cookie belonged to RedOwl006. It did not — it was `RedHawk007`**, an
   account created **at 16:16:26Z, 26 minutes after my last user snapshot.** The operator
   caught it and required the session be resolved against the database before firing. **Every
   figure I had stated was wrong** — balance 970 vs the true 1000, and a three-market position
   set vs none at all. The token prefix `bSYgq6…` matched no prefix I had already seen, and
   that was the signal I failed to read. **This is O-2 exactly: verify against the live source,
   never against a snapshot**, and the snapshot was 26 minutes old.

⇒ **A pre-flight that writes nothing is what made both survivable.** The zero-write probe
(cookie + no `Idempotency-Key` → **400**) proved origin, auth, ban, onboarding and freeze all
passed **before** any money moved, because `runBetEndpoint` orders those gates 403/401/403/403/
410 ahead of the first reachable 400 at `:204`. **The identity error was caught in the gap that
probe bought.**

---

## Where S-1 stands now

| # | Criterion | Preview | Staging |
|---|---|---|---|
| 1 | Runtime connects via `:6543` | ✅ liveness + inference | — |
| 2 | Transaction mode active | ⚠ strong, **not conclusive** (property 3 is staging-only) | — |
| 3a | Client ceiling risen | ✅ number; verb inherits 2 | — |
| 3b | Backend pool size unchanged | ✅ | — |
| **4** | **Bet path under `SERIALIZABLE`** | ✅ **GREEN — this session** | — |
| 5 | `SET LOCAL` timeouts | inference by composition | — |
| 6 | Positive control fires | ✅ GREEN | — |
| 7 | Rollback | — (no preview column, by design) | — |

⇒ **Step (b) is complete.** Every criterion the preview can carry has been carried.

**Next: step (c)** — the reviewer cascade (`@test-writer` → `@code-reviewer` →
`@security-auditor`) → PR → Gate C → merge. Then (d) unset the flag, (e) advance, (f) Sample A,
(g) re-set + redeploy, (h) Sample B, (i) criterion 7.

⚠ **Criterion 2 stays open regardless** — its temporal A/B is staging-only by construction
(plan `:379`), so it closes at (f)/(h), not here.

---

## Context to preserve

- ⚠ **`DB_POOLER_MODE=transaction` is STILL SET in Doppler `stg`.** Unchanged. ⛔ **Advancing
  `main` → `staging` while it is set makes the advance the flip**, and Sample A becomes
  permanently unobtainable. Step (d) is what prevents it.
- ⚠ **The session token used for this run was pasted into chat and is exposed.** It belongs to
  RedHawk007 and is valid to **2027-09-28**. **Sign that browser session out** — signing out is
  the only revocation path in the product (`auth.api.signOut` deletes the row); there is no
  admin surface. The scratch copy has been deleted from the worktree.
- **Staging now holds 8 users**, four of them real Google identities. It is not a
  single-operator environment.
- **A live sampler screen is not the record.** Print-on-change missed a 1.7-second transaction
  entirely; the per-sample JSONL is what carried the criterion. **Never rely on the console for
  an observation that has to survive.**
- **`events.metadata` still cannot attribute a row to a deployment** — no canary, SHA, origin
  or pooler field. Answer that question at observation time or not at all.
- Instruments live in `experiment-b/.cache/s1-c4/` (gitignored). `git status` clean.

---

## Time

2026-08-24, ≈ 16:42–16:53 UTC (local IST 22:12–22:23). Bet fired 16:49:36 DB time.
Ground `69d6288`. One application-visible write: the bet. Zero code commits.
