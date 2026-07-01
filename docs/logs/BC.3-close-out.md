# Close-out — BC.3 (remove the vestigial write-budget / write-burst rate limiters)

**Stratum:** BC.3 — mechanical excision of the v1.8.x `write-budget` (per-market 24h) + `write-burst` (per-user 1m) rate-limit pair. Dead code: SPEC.2 §11 already declares it removed, and neither instance was invoked on any non-test path (call-graph trace + independent blast-radius sweep). **No live limiter, no schema, no migration touched — a backend dead-code removal plus the count-comments the removal falsifies.**

**Code branch / squash:** `refactor/bc3-vestigial-rate-limit`, off `main` @ `f0a033e`; **squash `b6e1aea` on `main`, PR #191.**
**Log branch:** `chore/bc3-log`, off `main` @ `b6e1aea`.
**State:** shipped + merged; web verified clean **post-hoc** (line-by-line diff — see DEVIATIONS 2). This log is the close-out.
**Verification (pre-merge, execute session):** `ZUGZWANG_ENV=preview just verify` → tsc + biome + `next build` all green; `pnpm vitest run` → **155 files passed / 3 skipped; 1100 tests passed / 0 failed** (2 skips, 5 todo). Whole-repo grep → **zero** references to the six removed symbols or the `write-budget`/`write-burst` prefixes in `src/`/`tests/`.

---

## SHIPPED

Four code/test files (squash `b6e1aea`, **+9 / −172**). The squash also folds in the `+197` `docs/plans/BC.3.md` plan doc that was committed on the branch → **5 files / +206 / −172** on `main` (the `+197` is the entire source of the `+206`; not a code change).

**1.** `src/server/middleware/rate-limit.ts` — removed the `writeBudgetPerMarket` + `writeBurstPerUser` `Ratelimit` instances, their two `RateLimitSurface` union members, their two `SURFACE_INSTANCES` entries, the `writeBudgetIdentifier` + `writeBurstIdentifier` helpers, and the two now-unused `limits` imports.
**2.** `src/server/config/limits.ts` — removed the `RATE_LIMIT_PER_MARKET_PER_DAY` + `RATE_LIMIT_BURST_PER_MIN` placeholder constants.
**3.** `tests/integration/rate-limit.integration.test.ts` — deleted the two `it()` blocks exercising the pair (§7.3 rows 1 & 7), the pair's imports, its two disjointness-array entries + two `toBeDefined()` asserts.
**4.** `tests/unit/rate-limit-prefix.test.ts` — corrected the module-load construction count `8 → 6` (the `toHaveLength` assertion, the test name, the header comment). *[the ratified 4th file — see DEVIATIONS 1]*

**Three ratified count-comment fixes** (comments the removal falsifies, §5.3 "clean up what your change breaks"):
- **(a)** `rate-limit.ts` module header — "Seven → Six" Ratelimit instances.
- **(b)** `rate-limit.ts` `RateLimitSurface` JSDoc — "eight … the seven §11 rows + the MEDIA.1 arm" → "six … one per SPEC.2 §11 per-surface-table row".
- **(c)** `limits.ts` header — "Seven numeric placeholders … seven surfaces" → "Five … six sliding-window Ratelimit surfaces" (five constants → six surfaces; `IMAGE_PUT_URL_*` is shared by `image-put-ip` and `admin-media-put-ip`).

**Live controls byte-untouched (diff-verified + `@security-auditor`-confirmed):** `betPerIp`, `BET_ATTEMPTS_PER_IP_PER_MIN`, `src/server/bets/endpoint.ts` (empty diff; live enforcement at `endpoint.ts:281` intact), the `checkRateLimit` dispatcher body, its fail-open posture, the other five live limiters (otp-email, otp-ip, admin-login-ip, image-put-ip, admin-media-put-ip), and all idempotency code.

---

## THE RULING

**Fork A — ratified web + operator (Gate 1).** The `write-budget` (per-market 24h) + `write-burst` (per-user 1m) pair is **vestigial dead code — remove it.** Basis:

- **SPEC.2 §11 already declares it removed** ("the v1.8.x `write-budget` … + `write-burst` … pair is removed"); the §11 surface table already lists exactly the **six** live surfaces (otp-email, otp-ip, admin-login-ip, bet-ip, image-put-ip, admin-media-put-ip). The SPEC was ahead; the code was the laggard.
- **The deferred reply-flood per-market cap stays HARDEN.6** — if ever adopted it would mint a **NEW** per-market reply-bet constant, **never** a revival of these names / this code.
- **Proven dead by call-graph trace + independent Explore sweep:** zero non-test invocation of `writeBudgetPerMarket` / `writeBurstPerUser` anywhere in the repo.

Reviving the pair would need an ADR; removing SPEC-declared-removed dead code does not — **no ADR.**

---

## DEVIATIONS (the lessons — recorded in full)

**1. Blast-radius miss — the plan stated "exactly three files"; ground truth was FOUR.**
The plan's blast-radius sweep (recon + the cited independent Explore pass) searched for **importers of the six removed symbols**. But `tests/unit/rate-limit-prefix.test.ts` asserts the module-load `new Ratelimit()` **construction count** by side-effect (`toHaveLength(8)`) — it imports **none** of the removed symbols, so the importer-sweep never saw it. The removal dropped the count 8 → 6 and broke the assertion. The plan's literal claim ("no other file imports any of the six symbols") was *true*; its broader claim ("exactly three files / entire blast radius") was *false*.
- **How it was caught:** the full-suite local gate (plan §7 — `pnpm vitest run`, not the narrow named-gate list) — exactly the "cross-suite floor the narrow gate misses" backstop.
- **How it was handled:** surfaced as a §5.10 **SURPRISE** (not a FAIL — the three-file execution matched the plan; the plan's *scope claim* was what broke), **STOPPED**, logged to `claude-progress.md`, **ratified via relay** (web + operator: fold the 4th file in), then folded into the same commit `b6e1aea` with exactly four edits (assertion + test name + two count-comments).
- **Lesson:** a blast-radius sweep on a `Ratelimit`/instance removal — or any module-load **side-effect** removal — must include **side-effect construction-count tests**, not just symbol importers. Grep the module's construction counters / `toHaveLength(` assertions, not only the symbol names.

**2. Pre-merge review skipped — PR #191 was operator-merged before web's line-by-line diff review.**
Web reviewed **post-hoc** and confirmed clean (removal exactly scoped, live limiters byte-untouched). The review *substance* existed before the PR — both `@code-reviewer` and `@security-auditor` ran and returned **PASS / PASS** before `gh pr create` — but the **web diff gate did not precede the merge**. **Second occurrence after BC.1.** The review-before-merge posture for code tasks is under operator decision; recorded here so the pattern is visible, not smoothed over.

---

## ACCEPTED RESIDUALS / DEFERRED

**MEDIA.1 count-staleness residue is THREE instances, not two.** All three were already stale *before* BC.3 — each said "7" when there were genuinely **8** surfaces post-MEDIA.1 (wrong at 8, **not** falsified by this removal) — so all three are correctly left untouched under BC.3's scope rule (fix only what *this* edit falsifies) and are ledgered for the MEDIA.1 / SPEC doc-sync follow-up:

- **(i)** `tests/integration/rate-limit.integration.test.ts` — the "recorded all 7" comment (~:329).
- **(ii)** `tests/integration/rate-limit.integration.test.ts` — the disjointness array's missing `adminMediaPutUrlPerIp` entry.
- **(iii)** `tests/integration/rate-limit.integration.test.ts` (~:247) — the "distinct env-prefixed prefixes" / "The 7 constructions" comment. **Both subagents flagged this as the third instance** — the ledger had been tracking two.

*(Same class, also left: `tests/unit/rate-limit-prefix.test.ts:13` "seven sites" — folded into the same MEDIA.1/SPEC sweep.)*

**ADR-0015 §1 per-surface table + SPEC.1 §16.1 rows** still name the removed `RATE_LIMIT_PER_MARKET_PER_DAY` / `RATE_LIMIT_BURST_PER_MIN` constants → **separate doc-reconciliation sweep**, not this task (SPEC.1 §16.1 is SPEC.1-owned per ADR-0018).

---

## PK-REFRESH

md5-verified canonical copies of every changed file staged into `~/Desktop/zz-pk-refresh-BC.3/` for operator drag-in. md5s are the `b6e1aea` on-`main` values (`md5 -q`).

| File | md5 on `main` | Source path | What changed |
|---|---|---|---|
| `rate-limit.ts` | `fb4d22c91e944911955a7297f94529c8` | `src/server/middleware/rate-limit.ts` | removed the 2 dead instances + union/record/helper/imports; count-comments (a)(b) |
| `limits.ts` | `d83508703130f84a350759c34dfe47a1` | `src/server/config/limits.ts` | removed the 2 placeholder constants; header count-fix (c) |
| `rate-limit.integration.test.ts` | `b635039a3c1e679fb4b9edbcd87d8754` | `tests/integration/rate-limit.integration.test.ts` | deleted the 2 pair `it()` blocks + imports/array/asserts |
| `rate-limit-prefix.test.ts` | `461a3b7c9341264eb443ba8f3065d320` | `tests/unit/rate-limit-prefix.test.ts` | construction-count `8→6` (assertion + name + comment) |
| `BC.3-close-out.md` | _post-merge — self-referential; refresh from `main` after `chore/bc3-log` lands_ | `docs/logs/BC.3-close-out.md` | this log |

The four code files are canonical at PR #191 (`b6e1aea`); the close-out becomes canonical once `chore/bc3-log` merges.

---

## TRACKER

- **BC.3 → done** in `tracker_v15`.
- **Next backend task: BC.4** (`market.created` `.optional()` / stale-payload fix). **Heads-up / re-confirm premise first (§4):** the BC.2 close-out (item 7b + its superseded row) already recorded that the original "stray `.optional()` in code" premise **did not hold** — there was no such code defect, and the real `market.created` payload drift was **doc-only and already fixed at BC.2 Part C**. BC.4 should re-verify its premise against the live schema/handler before executing, to avoid re-chasing a resolved item.

---

## Next session starts at

BC.4 — first re-verify the `market.created` payload premise against live code (BC.2 7b superseded the original framing); then plan-gate and execute only if a live defect remains.
