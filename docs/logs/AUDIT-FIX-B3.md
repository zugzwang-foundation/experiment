# Session log — AUDIT-FIX-B3 (bet-engine robustness: A3 · A4 · A9)

**State: PR OPEN (awaiting web merge-gate; do NOT merge — operator merges after web diff review).** The web-authored ADR-0031 + ADR-0015 Patch + SPEC/CLAUDE/AGENTS/parked riders were amended into the impl commit (same-commit doctrine, CLAUDE.md §5.12). Execute ran on branch `fix/audit-fix-b3` (off `main` @ `7fc4c60`).

## 1. What landed

Impl commit (local, ephemeral SHA `f122b73` post-amend; `a18c634` pre-amend; signed ED25519) — 51 files (44 code/test/migration + 7 web-authored docs amended in at the commit-pause):

**Web-authored docs (amended in, same-commit):** `docs/adr/0031-durable-bet-receipts-and-terminal-error-mapping.md` (NEW) · `docs/adr/0015-rate-limit-idempotency.md` (Patch record) · `docs/specs/SPEC.2.md` (§3.1/§3.2/§5.1/§5.2/§6.2/§7.3/§9/§11/§15.4/§17.2/§17.3/§19.3 riders) · `docs/specs/SPEC.1.md` (§7 F-BET-3) · `CLAUDE.md` §2 · `AGENTS.md` §6/§9 · `docs/parked.md` (SYNC-sweep extension). Deviations flagged in the PR note (byte-matched code constants; §17.6→§17.2 tag-note placement; §19.3 `market_media` pre-existing drift).

- **A3 (oversell 400 + unmapped-error sweep):** `src/server/bets/errors.ts` — new `InsufficientSharesError` (400 `insufficient_shares`) + `toWireError` maps `PositionOversellError`→400 `insufficient_shares` and `PositionSingleSideError`→503 `error_position_conflict`+RA1. `sell.ts` product pre-check (`shares > held.quantity`; `== held` legal). `endpoint.ts` `position_oversell_backstop` alarm.
- **A4 (guarded release):** `src/server/idempotency/cache.ts` — owner-token sentinel `PENDING:{fp}:{token}`, ownership-checked `redis.eval` release (compare-and-DEL / compare-and-SET), never-throws + `site:release` alarm, lookup-side `safeCaptureException`. `endpoint.ts` guarded finally (`site:endpoint_finally`). `types.ts` doc rider.
- **A9 (durable receipts):** migration `0022_bet_receipts.sql` (Bucket-A table + 3 guard triggers reusing 0003/0021 fns, single file). `src/db/schema/bets.ts` `betReceipts` + drizzle-zod pair. `src/server/bets/replay.ts` (new: `isDurableIdempotencyConflict` + `loadDurableReplay`, fail-open). `place.ts`/`sell.ts` receipt as LAST write. `endpoint.ts` durable pre-check (before rate-limit + moderation) + `noCache` rule. Both routes: `bodyFingerprint` plumb + 23505 catch.
- **Tests:** 6 new (sell-oversell, place-replay-durable, sell-replay-durable, release-failure, double-sell-chain, idempotency-release) + wire-envelope ext + idempotency-cache integration adapt + `bet-receipts-append-only.spec` + `I-IDEM-ONCE-001` + truncate-rejected/fixture (→ 10 Bucket-A / 13 protected). ~18 fixture files updated for the new required `bodyFingerprint`/`idempotencyKey` params + 3 endpoint-unit `@/db` mocks gained a `select` shim.

**PR:** _pending_ — opens after the web riders are amended into `a18c634`.

## 2. Decisions made

- **Confirmation 1 — PositionSingleSideError → 503 is CORRECT.** The user-reachable instance is the write-side flip-order race-loser (`persist.ts` catches 23505 on `positions_one_held_side_idx`). Transient: the winning concurrent write established the opposite held side, so the 503 (uncached by the `<500` rule) triggers a retry that re-reads it and deterministically resolves to `opposite_side_held` 400 (cached) — no retry-storm. The only persistent instance (`read.ts` >1 held rows) needs the unique index absent = a structural corruption, not user-reachable in the shipped system. Class shared → 503 justified by the reachable case.
- **Confirmation 3 — newPrice IS derivable from stored state.** `newPrice = p1 = getPrices(post-trade reserves)` — a pure function of reserves persisted in `pools` AND replayable from `events` (seed + ordered trades). The receipt stores it only for synchronous replay fidelity; it does NOT mask a B5 event-completeness gap. (It lives in no other single row, but is reconstructable from canonical state.)
- **Two new wire codes (Confirmation 2 naming):** `insufficient_shares` (400, product — bare, mirrors `insufficient_dharma`) and `error_position_conflict` (503, transient — `error_*` prefix, mirrors `error_bet_serialization_exhausted`).
- Reviewer-driven in-session additions: added the `bet_receipts` drizzle-zod pair (db-migration-reviewer SURPRISE — restores the 22/22 AGENTS.md §6 convention the plan block omitted); tightened the receipt-insert lock comment (code-reviewer LOW); fixed a stale "25 guards"→"26" comment.

## 3. Open questions (for the web-authored ADR-0031)

- **Scope the §3.3 backstop claim** (code-reviewer MEDIUM): "tx-level unique backstops correctness" is over-broad for LARGE sells (remaining < resell amount, incl. sell-to-zero). In the compound double-fault (Redis lost AND the pre-check SELECT fails open), such a replay re-enters the tx and hits `PositionNotHeldError`/`InsufficientSharesError` BEFORE the receipt insert → route returns 404/400, not the idempotent 200. **No invariant violated, no double proceeds** (the position checks pre-empt re-execution) — a degraded-UX residual, strictly better than pre-B3. ADR-0031's residual enumeration should scope the claim to "sells whose remaining quantity ≥ the resell amount," and place.
- **Cross-user replay note** (security-auditor LOW): the receipt is keyed by `idempotency_key` alone (not `(user_id, key)`) — consistent with the pre-existing Redis completed-cache (also key-only), gated by the unguessable client-supplied key (never reflected), `result` carries no PII, conclusion-freeze closes it. The one delta vs Redis: durable receipts never expire (Redis = 24h). Closing it would need BOTH layers scoped (out of B3 scope). ADR-0031 security section should record this.
- **Pre-check DoS surface** (both reviewers LOW): the durable pre-check adds one indexed `bet_receipts` SELECT before rate-limit (plan-sanctioned; dominated by the pre-existing auth queries). Note in the ADR performance section.

## 4. Next session starts at (exact next action)

**PR #202 is OPEN — https://github.com/zugzwang-foundation/experiment/pull/202 — STOP; do NOT merge.** The web-authored docs were amended into the impl commit (`a18c634` → `f122b73`), this log commit was rebuilt on top with the PR#, and `gh pr create` ran. The PR body carries migration 0022's SQL + the 13-row error-mapping table + the two wire-code names + the three confirmations + the code-constant byte-match table + six flagged deviations, all verbatim.

**Next action = the operator merges after web reviews the diff hunks.** On squash-merge: capture the canonical `main` SHA into this log (branch SHAs are ephemeral), verify `git diff <PR-head> origin/main` is empty (the right tree landed — bit #136 precedent), then the SYNC-sweep debt recorded in `parked.md` (SPEC §0/§22/footers → `0003–0031`, 39-code catalogue, + the §19.3 `market_media` pre-existing drift) is owed to the next SYNC.* pass. Nothing else is pending on the execute side.

## 5. Context to preserve

- Plan `docs/plans/AUDIT-FIX-B3.md` was executed exactly (Fable 5 + ultracode operator override, but the gated named-reviewer cascade + commit-pause were honored per the kickoff). All 3 reviewers passed: **no CRITICAL/HIGH/MEDIUM** anywhere.
- Gates green: `just verify`, full `pnpm vitest run` (1236 passed), `pnpm test:scale` (15 passed — `idempotency-dedup.scale` needed NO adaptation: it calls `place()` directly, so losers still 23505 at the bets insert), `drizzle-kit check`.
- Migration 0022 applied to local DB `:54322` (head now 0022). Branch un-pushed.
- The full 13-row error table + migration 0022 SQL go verbatim in the PR body (operator merges only after web reads those hunks).
- NOT in scope (untouched): A30/A21/A31/A26/A27/A25/A28; `events/insert.ts`; `dharma/*`; `moderation/*`; `positions` compute/errors/read (import-only); `transaction.ts` retry spine; committed migrations 0000–0021; the parked non-owner DB role; the SPEC §0/§22/footer sweep.

## 6. Time

Session: 2026-07-04. One execute session, plan Phase 0 → commit-pause.
