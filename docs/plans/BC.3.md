# BC.3 — Remove the vestigial write-budget / write-burst rate limiters

> **Phase-1 plan** (CLAUDE.md §5.1). Awaiting web sign-off before Phase 2. Phase-2 branch: `refactor/bc3-vestigial-rate-limit`; commit type `refactor`. Committed in its own `plan:` commit ahead of execution.

> **Status:** drafted
> **Date:** 2026-07-01
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** No by the CLAUDE.md §1 file list (`src/server/middleware/` is not on it) — **but treated with full critical-path ritual** (plan→execute, `@code-reviewer` + `@security-auditor`, pre-PR self-audit): the file is write-path-adjacent and owns the LIVE `bet-ip` anti-abuse limiter guarding the bet + comment-bearing-bet write paths. NOT ultracode.
> **Plan PR / commit:** n/a (this plan commits before Phase 2)

---

## Tracker context

BC-series doc/code reconciliation. **BC.3 ruling (Gate 1 passed — web + operator): FORK A ratified.** The v1.8.x `write-budget` (per-market 24h) + `write-burst` (per-user 1m) rate-limit pair is **dead code — remove it.**

**Ruling basis (re-verified from live files at HEAD `f0a033e`, not from the corrupted relay):**
- **SPEC.2 §11 body, `docs/specs/SPEC.2.md:1149`** (verbatim): *"the v1.8.x `write-budget` (per-market 24h) + `write-burst` (per-user 1m) pair is removed, and friendly-fire is gone entirely."* The deferred open question (whether reply-bets warrant an *additional* per-market cap) resolves at HARDEN.6 and, *"if adopted[,] would mint a **new** per-market reply-bet constant"* — **never** a revival of these names/this code.
- **SPEC.2 §11 constant note, `SPEC.2.md:1175`**: *"the v1.8.x comment-budget constants `RATE_LIMIT_PER_MARKET_PER_DAY` + `RATE_LIMIT_BURST_PER_MIN` are removed under reply-as-bet."*
- **SPEC.2 §11 live surface table, `SPEC.2.md:1142–1147`** already lists exactly **six** surfaces (otp-email, otp-ip, admin-login-ip, bet-ip, image-put-ip, admin-media-put-ip) — precisely the six instances that remain after this removal. The SPEC is ahead; the code is the laggard.
- **SPEC.1 §16.1 rows, `SPEC.1.md:978–979`**: both rows assert nothing on their own — they **defer to SPEC.2 §11**. So no live spec contradiction and no retention rationale.
- **Recon + independent Explore blast-radius sweep**: neither `writeBudgetPerMarket` nor `writeBurstPerUser` is invoked on any real (non-test) path anywhere in the repo. Six of the eight `Ratelimit` instances are live-wired; this pair is not. Blast radius = exactly three files.

**Dependencies:** none open. Gate 1 (ruling) is passed; this is the plan gate.

## Approach (one paragraph)

Mechanical excision of dead code across three files: delete the two never-invoked `Ratelimit` instances + their two identifier helpers + their `RateLimitSurface`/`SURFACE_INSTANCES` re-exports in `rate-limit.ts`, delete the two placeholder constants in `limits.ts` and their imports, and prune the test coverage of the pair from the one integration test that references it (two full `it()` blocks + the pair's entries inside the disjointness test) while leaving the six live surfaces' coverage green. Fix the count-comment(s) my own edit falsifies. Touch **nothing** else — the live `bet-ip` limiter, every other limiter, the idempotency code, the deferred HARDEN.6 reply-flood question, and the ADR-0015/SPEC drift are all explicitly out of scope and ledgered.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity | **no** | The removed symbols are never invoked; the bet write path (`bets/endpoint.ts` → W-1 tx) is byte-untouched. | (unchanged) `tests/invariants/I-ATOMICITY-001.*` |
| 2.2 Dharma non-transferable | **no** | No ledger/Dharma code in scope. | (unchanged) |
| 2.3 Side frozen at comment-time | **no** | No comment/side code in scope. | (unchanged) |
| 2.4 Resolutions append-only | **no** | No resolution code in scope. | (unchanged) |

No thesis invariant is touched. The one adjacent safety property — the **live `bet-ip` anti-abuse cap** on the bet + comment-bearing-bet write paths — is preserved by *not touching it*; `@security-auditor` verifies `betPerIp` / `BET_ATTEMPTS_PER_IP_PER_MIN` / `src/server/bets/endpoint.ts` remain byte-identical and no live rate-limit posture is weakened.

## 2. Data model changes

**None** — no schema, no migration, no DDL. (Therefore **NOT** `@db-migration-reviewer`.)

## 3. API surface

**None** — the removed symbols have zero runtime consumers (proven by call-graph trace + independent Explore sweep). No endpoint, Server Action, route handler, or rate-limit surface that is actually dispatched changes. `checkRateLimit` keeps its six live surfaces.

## 4. UI / user flow

**None** — backend dead-code removal.

## 5. Failure modes

The only real risk is **collateral damage to a live control**, since this file owns the live `bet-ip` limiter and the fail-open middleware.

- **Accidentally weakening/altering a live limiter** (`betPerIp`, `otpRequestPerEmail`, `otpRequestPerIpBurst`, `adminLoginPerIp`, `imagePutUrlPerIp`, `adminMediaPutUrlPerIp`) or the `checkRateLimit` dispatcher / fail-open posture. → **Detect:** `@security-auditor` diff review + pre-PR self-audit assert the six live instances + `checkRateLimit` body are byte-unchanged; `pnpm vitest run` keeps the six live surfaces' tests green. → **Recover:** surgical scope; revert is a single-commit refactor.
- **Unused-import straggler after test-block deletion** → biome `noUnusedImports` fails `just verify`. → **Detect:** already pre-verified (see §6) — no retained import goes unused; `just verify` is the backstop.
- **Mock harness break** (the test's `ratelimitInstances` map) → the harness is **reactive**: it is populated by each `new Ratelimit()` at module load (`rate-limit.integration.test.ts:39–71`), keyed by prefix's last segment. Removing the two instances simply drops their keys; there is no hardcoded prefix list to maintain. The only stale references are the ones this plan prunes.
- **Migrate-before-serve / deploy** → N/A (no DB, no env, no build-time config).

## 6. Edge cases

- **No retained import becomes unused.** Pre-verified against the live file: after deleting the two blocks (lines 137–182 and 341–414), every retained import still has ≥1 usage outside those ranges — `OTP_REQUESTS_PER_EMAIL_PER_HOUR`@337, `OTP_REQUESTS_PER_IP_BURST_PER_MIN`@213, `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR`@338, `BET_ATTEMPTS_PER_IP_PER_MIN`@232, `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN`@254; and every retained rate-limit symbol at the disjointness `toBeDefined()` block (460–465) and the live-surface tests.
- **The two removed constants have no other test usage** — only imports (103–104) + the row-7 sanity asserts (411–412), both removed together.
- **`RateLimitSurface` type has no external importer** — used only within `rate-limit.ts` (:112 def, :122, :173). Removing two union members is self-contained; callers pass bare string literals.
- **Section-header comment gaps.** Deleting the `// === §7.3 row 1 ===` and `// === §7.3 row 7 ===` labels leaves gaps in the SCAFFOLD.4-plan row numbering (surviving: rows 2–6, 8). **Do NOT renumber** — the labels are historical plan references; renumbering is out-of-scope adjacent churn (§5.3).
- **Count-comment truthfulness** — see Open Question 1; three comments carry counts my structural edit falsifies.

## 7. Test plan

**No new tests. `@test-writer` is NOT invoked** — there is no new behavior to drive; this is mechanical excision of dead-code test blocks, which test-writer is forbidden from doing (it only writes new failing tests, never deletes). The excision is done inline and verified by `@code-reviewer` + the full suite.

| Layer | Action | Result |
|---|---|---|
| Integration (`tests/integration/rate-limit.integration.test.ts`) | Delete the two `it()` blocks that exercise the pair; remove the pair's imports + its two entries in the disjointness array + its two `toBeDefined()` asserts. | The **six live surfaces** keep full coverage (throttle, fail-open, disjointness, identifier shapes). |
| Whole suite | `pnpm vitest run` (run directly against local Postgres `:54322` per the critical-path local-gate practice, not `just` which would target the cloud DB). | Green, with the pair's ~2 tests removed. |

**Gate before "done" (CLAUDE.md §5.7):** `ZUGZWANG_ENV=preview just verify` (typecheck → biome → build) **+** `pnpm vitest run` (full suite — the final pre-PR local gate that catches cross-suite floors). This is treated as critical-path, so the integration suite runs locally, not "ride CI."

## 8. Out of scope

- **The live `bet-ip` limiter** — `betPerIp` (`rate-limit.ts:75–80`), `BET_ATTEMPTS_PER_IP_PER_MIN` (`limits.ts:35`), `src/server/bets/endpoint.ts`. **STOP and surface if the removal appears to require touching any of these.**
- **Every other live limiter** (otp-email, otp-ip, admin-login-ip, image-put-ip, admin-media-put-ip) and **all idempotency code** in `rate-limit.ts` / `idempotency/`.
- **The deferred reply-flood per-market cap** — stays HARDEN.6; if ever adopted it mints a NEW constant (SPEC.2 §11:1149). Do not resolve or mint anything.
- **ADR-0015 §1 per-surface table drift** (`docs/adr/0015-rate-limit-idempotency.md:121–122, 495` still list the pair) — **ledgered follow-up doc task**, not fixed here.
- **SPEC.1 §16.1 rows (:978–979, :1470–1471)** still name the two constants — **ledgered follow-up**, SPEC.1-owned per ADR-0018; not fixed here.
- **MEDIA.1 test-sync residue** — the test's *"recorded all 7"* comment (~:456–459) and the disjointness array missing `adminMediaPutUrlPerIp`. Pre-existing, orthogonal, NOT ours; **do not fix — ledger it.** (Note: my removal of the two `toBeDefined()` asserts makes that comment further stale; this is a deliberate, operator-sanctioned non-fix, flagged for the reviewer so it does not read as an oversight.)

---

## Exact edits (re-verified loci at HEAD `f0a033e`; Phase 2 re-confirms against the live file before editing)

### File 1 — `src/server/middleware/rate-limit.ts`

| # | Locus (current lines) | Edit |
|---|---|---|
| 1 | import block, **:10–11** (`RATE_LIMIT_BURST_PER_MIN`, `RATE_LIMIT_PER_MARKET_PER_DAY`) | remove both imported names |
| 2 | module-header comment **:21** — `Seven Ratelimit instances, one per surface row in §11.` | count fix `Seven` → `Six` (**operator-sanctioned**, resolved judgment call #1) |
| 3 | **:61–66** `export const writeBudgetPerMarket = new Ratelimit({…})` (+ trailing blank :67) | delete the instance |
| 4 | **:68–73** `export const writeBurstPerUser = new Ratelimit({…})` (+ trailing blank :74) | delete the instance |
| 5 | `RateLimitSurface` union, **:116–117** (`\| "writeBudgetPerMarket"` / `\| "writeBurstPerUser"`) | delete both members |
| 6 | `SURFACE_INSTANCES` record, **:126–127** (`writeBudgetPerMarket,` / `writeBurstPerUser,`) | delete both entries |
| 7 | identifier helpers **:152–157** (`writeBudgetIdentifier` :152–155, `writeBurstIdentifier` :156–157) | delete both helpers (keep the shared JSDoc :144–149 and `ipIdentifier`/`otpEmailIdentifier` :150–151) |
| 8 | `RateLimitSurface` JSDoc, **:106–111** (`…one of the eight Ratelimit instances… the seven SPEC.2 §11 per-surface-table rows + the MEDIA.1 arm…`) | count fix — see **Open Question 1** (my edit forces this comment internally inconsistent) |

### File 2 — `src/server/config/limits.ts`

| # | Locus | Edit |
|---|---|---|
| 1 | **:28–29** JSDoc + `export const RATE_LIMIT_PER_MARKET_PER_DAY = 50;` | delete |
| 2 | **:31–32** JSDoc + `export const RATE_LIMIT_BURST_PER_MIN = 5;` | delete |
| 3 | module-header **:2 / :4** (`Seven numeric placeholders … seven sliding-window Ratelimit surfaces`) | count fix — see **Open Question 1** |

### File 3 — `tests/integration/rate-limit.integration.test.ts`

| # | Locus | Edit |
|---|---|---|
| 1 | limits import block, **:103–104** (`RATE_LIMIT_BURST_PER_MIN`, `RATE_LIMIT_PER_MARKET_PER_DAY`) | remove both |
| 2 | rate-limit import block, **:114–117** (`writeBudgetIdentifier`, `writeBudgetPerMarket`, `writeBurstIdentifier`, `writeBurstPerUser`) | remove all four |
| 3 | **:137–182** — `// === §7.3 row 1 ===` header + `it("…write-budget-and-burst-admit-independently")` block + trailing blank | delete the whole block |
| 4 | **:341–414** — `// === §7.3 row 7 (extension) ===` header + `it("…write-budget-and-burst-must-both-allow")` block + trailing blank | delete the whole block |
| 5 | disjointness test array, **:437–438** (`"write-budget",` / `"write-burst",`) | remove both entries (leaves the 5 live §11 prefixes; array's missing admin-media is MEDIA.1 residue — leave it) |
| 6 | disjointness test asserts, **:462–463** (`expect(writeBudgetPerMarket).toBeDefined();` / `expect(writeBurstPerUser).toBeDefined();`) | remove both |
| — | **:456–459** *"recorded all 7"* comment | **do NOT touch** (MEDIA.1 residue, ledgered) |

**Blast-radius confirmation (recon + independent Explore sweep, whole repo):** the three files above are the *entire* code blast radius. No re-export, no `RateLimitSurface` external import, no non-test invocation, no other file imports any of the six symbols. Everything else is documentation prose (`docs/adr/0015…`, `docs/specs/SPEC.1.md`, `docs/specs/SPEC.2.md`, `docs/logs/*`, `docs/plans/*`) that already flags this as known code↔spec drift — reconciled separately, not here.

---

## Phase 2 execution order + subagents

1. Branch `refactor/bc3-vestigial-rate-limit` off fresh `main`.
2. Apply File 1 → File 2 → File 3 edits (re-verify each locus against the live file first — CLAUDE.md §5.5).
3. `ZUGZWANG_ENV=preview just verify` + `pnpm vitest run` (direct, local Postgres). Both green.
4. **Pre-PR self-audit** (§5.10 checklist below) — in-session, item by item.
5. **`@code-reviewer`** on the `src/` diff (+ the test) — pass `@docs/plans/BC.3.md`; confirms scope discipline, no live-limiter change, no dead references left.
6. **`@security-auditor`** after code-reviewer passes — pass `@docs/plans/BC.3.md`; confirms `betPerIp` / `BET_ATTEMPTS_PER_IP_PER_MIN` / `bets/endpoint.ts` byte-untouched, no INV-1/2/3/4 exposure, no live rate-limit posture weakened (fail-open middleware + the six live surfaces intact).
7. FAIL in scope → fix in-session before PR. SURPRISE out of scope → `claude-progress.md` + STOP.
8. `refactor(rate-limit): remove vestigial write-budget/write-burst limiters (BC.3)` — signed, squash-merge PR. Single commit (code + the sanctioned comment fixes; ADR/SPEC reconciliation is a **separate ledgered task**, per §8).

### Pre-PR self-audit checklist (§5.10)
- [ ] **Scope:** exactly the three files; every changed line traces to the removal (or a count-comment my edit falsifies). No adjacent "improvement."
- [ ] **Live limiters intact:** `betPerIp`, `otpRequestPerEmail`, `otpRequestPerIpBurst`, `adminLoginPerIp`, `imagePutUrlPerIp`, `adminMediaPutUrlPerIp` and the `checkRateLimit` body + fail-open posture — byte-unchanged (diff-verified).
- [ ] **No dangling references:** grep the repo for all six symbols → only doc prose remains (grep-verified).
- [ ] **`RateLimitSurface`/`SURFACE_INSTANCES`** each lost exactly two entries; the type still compiles; no external importer.
- [ ] **Test suite:** two blocks removed, six live surfaces green, no unused import, mock harness reactive (no hardcoded key list touched).
- [ ] **Comment counts** resolved per Open Question 1's ratified answer.
- [ ] **Gate:** `just verify` + `pnpm vitest run` both green.
- [ ] **`bets/endpoint.ts` + `limits.ts:35` (`BET_ATTEMPTS…`)** untouched.

---

## Open questions

- **Q1 — Count-comment truthfulness (needs web ratification).** Resolved judgment call #1 named **one** comment (rate-limit.ts:21 header, `seven`→`six`). Re-reading the live files, my structural edit falsifies **three** count-bearing comments, and one of them cannot be left as-is without becoming self-contradictory:
  - **(a) rate-limit.ts:21 header** — `Seven Ratelimit instances` → `Six`. **Baked in** (operator-sanctioned).
  - **(b) rate-limit.ts:106–111 `RateLimitSurface` JSDoc** — currently *"one of the **eight** Ratelimit instances declared above: the **seven** SPEC.2 §11 per-surface-table rows + the MEDIA.1 `adminMediaPutUrlPerIp` arm."* Removing two instances makes "eight" wrong; but changing only "eight"→"six" leaves the breakdown enumerating 7+1=8 (self-contradiction). Since **SPEC.2 §11's table now lists all six surfaces as first-class rows** (including admin-media, :1147), the cleanest truthful minimal fix is: *"one of the **six** Ratelimit instances declared above, one per SPEC.2 §11 per-surface-table row."*
  - **(c) limits.ts:2 / :4 header** — *"**Seven** numeric placeholders … **seven** sliding-window Ratelimit surfaces."* → *"**Five** numeric placeholders … **six** sliding-window Ratelimit surfaces."* (five constants remain; six surfaces).
  - **Candidate:** apply (a)+(b)+(c) in the same commit — each is a comment my own edit falsifies (CLAUDE.md §5.3, "clean up orphans your change created"), zero logic, and (b) is *forced* (leaving it is a self-contradicting comment). This is a consistent extension of the operator's own rationale for (a).
  - **Alternative if web prefers strict literalism:** apply only (a); ledger (b)+(c) to the SPEC-sweep follow-up. **Not recommended** — it knowingly ships (b) as a self-contradicting comment inches from the edit, which `@code-reviewer` would flag.
  - **Resolve with:** web sign-off on this plan (before Phase 2).

- **Q2 — "three test blocks" vs ground truth (informational; no decision needed).** The kickoff said "prune the three test blocks exercising the pair." Ground truth from the live file: there are **two** `it()` blocks that fully exercise the pair (`:139` row 1, `:343` row 7), plus the pair's **references inside the disjointness `it()` block** (`:437–438` array + `:462–463` asserts) — that third `it()` is *kept*, only its pair-references pruned. The plan prunes exactly what the kickoff intended (two full blocks + the disjointness references); the "three" was a loose count. Flagged so web sees the reconciliation, not a scope deviation.

## ADRs needed

**None.** Fork A is a ratified execution of the existing SPEC.2 §11 decision; removing dead code that the SPEC already declares removed is not a new architectural decision. (The reverse — reviving the pair — *would* need an ADR; this is the opposite.)

---

## Self-critique (Phase 1 self-review)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | Kickoff said "three test blocks"; live file has two full blocks + disjointness references. Blindly deleting a literal "third block" would over-cut the disjointness test (which covers live surfaces). | Addressed — §7 + Q2 + edit-table rows 3–6 excise exactly two blocks and only the pair's entries in the surviving disjointness test. |
| 2 | medium | Judgment call #1 named one count-comment, but the edit falsifies three, and the `RateLimitSurface` JSDoc goes self-contradictory if only partially fixed. Silently fixing all three = scope creep; silently fixing one = shipping a broken comment. | Surfaced as **Open Question 1** with a ratified-recommendation; not silently absorbed. |
| 3 | medium | This file owns the LIVE `bet-ip` limiter — the real risk is collateral change, not the removal itself. | Addressed — §1/§5/§8 pin the live boundary; `@security-auditor` + self-audit assert byte-untouched; hard STOP boundary declared. |
| 4 | low | Unused-import straggler could fail `just verify` after block deletion. | Pre-verified in §6 (every retained import used outside deleted ranges); `just verify` is the backstop. |
| 5 | low | Leaving the MEDIA.1 *"recorded all 7"* comment (now further stale after removing two asserts) could read as an oversight to the reviewer. | Operator-mandated non-fix; explicitly flagged in §8 + self-audit so `@code-reviewer` sees it as deliberate + ledgered. |
| 6 | low | Section-header row-number gaps (rows 1, 7 removed) look untidy. | Deliberate — renumbering is out-of-scope adjacent churn (§5.3, §6). |

*Self-critique pass 2026-07-01: no high findings. Checked invariants coverage (none touched), scope discipline (three files, hard live-limiter boundary), test-excision correctness (two blocks + disjointness references, no unused imports), edge cases (mock reactivity, count comments), and the ruling's SPEC basis (re-cited from live files).*

---

## References

- `CLAUDE.md` §5.1/§5.3/§5.4/§5.10/§5.11, §1 critical-path list, §6 (no ultracode here)
- `AGENTS.md` §7 (middleware), §9 (Vitest), §11 (boundaries)
- `docs/specs/SPEC.2.md` §11 (:1142–1177 — the removal + the six-surface table)
- `docs/specs/SPEC.1.md` §16.1 (:957, :978–979, :1470–1471), §8 (:354 — reply-as-bet)
- `docs/adr/0015-rate-limit-idempotency.md` (§1 table :121–122 — the ledgered doc drift)
- `docs/logs/BC.2-close-out.md` (:81/:95/:118 — BC.3 deferral), `docs/logs/MEDIA.1-close-out.md:53`
- Tracker: BC.3 (BC-series doc/code reconciliation)
