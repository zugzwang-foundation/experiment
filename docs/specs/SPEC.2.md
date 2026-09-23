# SPEC.2 — Zugzwang Technical Architecture

> **Status:** version is in the §0 table below and in the last changelog row; this line deliberately carries no number (`O-15`) · §0–§20 + Appendix B · §2, §23 and Appendix A removed at 2.0.0 (D-30); numbering retained with gaps for cross-reference stability
> **Repo path:** `zugzwang-foundation/experiment/docs/specs/SPEC.2.md`
> **Companion files:** `SPEC.1.md` (product), `cpmm.md` (math), `RANKING.md` (ranking function) — all three on disk at `docs/specs/`. `PSEUDONYM.md` and `design.md` were promised and are deleted as promises (D-28 r16, r17); no file replaces them.

---

## §0 Document Metadata

| Field | Value |
|---|---|
| **Document** | SPEC.2 — Zugzwang Technical Architecture |
| **Version** | 2.2.0 |
| **Date** | 2026-09-17 |
| **Owner** | Hrishikesh Manoj Hundekari |
| **Phase** | Experiment phase only. Markets open 2026-09-15; the freeze is 2026-11-05 23:59 UTC; the dataset is released 2026-11-06. Out of scope: testnet, mainnet, on-chain |
| **Status** | Rebaselined at 2.0.0 by D-30 (decision record amendment 2.6, 2026-09-07). §10 rebuilt as the *Moderation Contract*; §12's moderation clauses rebuilt; §21, §22 and Appendix A reduced to pointers; §2 and §23 removed. The `v0.1-outline`–`1.0.29` line and its change log are retained in git history; last 1.0.x commit `e25fa277` |
| **Sections** | §0, §1, §3–§20, Appendix B. §2, §21 (pointer), §22 (pointer), §23 and Appendix A (pointer) — see the change log. Numbering is retained with gaps so cross-references stay resolvable |
| **Source-of-truth** | `zugzwang-foundation/experiment` repo. Project knowledge is a snapshot, not the canonical copy |
| **Precedence** | Decision record → `SPEC.1` → `SPEC.2` → ADRs → tracker (D-22). `SPEC.1` outranks this document; ADRs do not |
| **ADRs** | `docs/adr/` is the index. This document names ADRs where they bind a contract and counts none |
| **Companion paper** | `zugzwang_btc_style_v4.pdf` — theory and the Zugzwang Condition. SPEC.2 implements; the paper does not bind on engineering choices |
| **License** | AGPL-3.0 (see `LICENSE.md`) |

### §0.1 Change log

*Reset at 2.0.0 (D-30). The `v0.1-outline`–`1.0.29` log is in git history; last 1.0.x commit `e25fa277`.*

| Version | Date | Author | Change |
|---|---|---|---|
| 2.2.0 | 2026-09-23 | HMH | **Self-replies refused; friendly-fire meter withdrawn (D-52).** ReplyAffordance gains own-post foreclosure — both controls disabled, carried as a viewer-scoped boolean, no author id to the client; **§5.4** `friendly_fire_dharma` reclassified COMPUTED, NOT RENDERED. No schema change. *(refs: D-52)* |
| 2.1.0 | 2026-09-22 | HMH | **Friendly-fire toggle (ADR-0058, D-51).** **§5.1** row 4: `comments.friendly_fire boolean NOT NULL DEFAULT false` + CHECK `comments_friendly_fire_requires_parent`; **§5.4**: three new read-time aggregates — `friendly_fire_dharma` (DISPLAYED, meter numerator), `endorse_count` / `contest_count` (RANKING INPUT, feed `b`); `friendlyFireEligible` helper beside ReplyAffordance; **§5.5** and **§13.3** riders — the removed vote and the new toggle are different mechanics; **§19.4.1** `comment.placed` gains `friendlyFire` (SHIP); **Appendix B.6** `friendly_fire` SHIP. Migration `0031_comments_friendly_fire`; `EXPECTED_GUARD_CATALOG_ROWS` unchanged. The dataset exporter (PR #435) is deliberately untouched — `docs/parked.md` carries the trigger. *(refs: ADR-0058; D-51)* |
| 2.0.0 | 2026-09-07 | HMH | Rebaselined. **§10 rebuilt as the Moderation Contract** — advisory throughout: text is dispatched after commit and never awaited, images are screened before first serve, no request fails on a moderation outcome, the Redis intent reservation and the 409/503 branches are retired (D-20, ADR-0046). §12's moderation-coupled clauses rebuilt to match. 49 dangling `SPEC.1` citations repaired against SPEC.1 2.0.0 and seven broken `MUST` obligations discharged (D-29). `error-codes.md`'s five `MUST` clauses removed; §15.4 is the catalogue (D-28 r15). §21, §22 and Appendix A reduced to pointers; §2 and §23 removed (D-30, D-28 r12/r16/r17/r18). Devcon struck (D-21/D-26); the launch date stated (D-24). Reason codes aligned to SPEC.1 §14. **Code conformance for moderation: MOD-1, pending** — until it lands, `src/` implements the superseded gate. Rulings: D-20, D-21/D-26, D-22, D-24, D-28, D-29, D-30; ADR-0046. |
| 2.0.1 | 2026-09-07 | HMH | **LIQ-1 Phase 2 (ADR-0047) — §19.4.1 same-commit rider for `pool.liquidity_added`.** The new event type's SHIP declaration lands in the SAME commit as `EVENT_TYPES` gains the member, per §19.4.1's own amendment rule and per Phase 1's ADR §F note: the dataset export throws on an undeclared type by design (`strip.ts:299`), so a declaration landing one commit later is a red build rather than a gap. No STRIP target — the payload carries no PII-class key and no `userId` at all, the writer being `pg_cron` rather than a participant. ⚠ **The emit site is migration `0027`'s plpgsql, not `src/`** — the first type for which that is true; the amendment-rule paragraph now says so. `EVENT_TYPES` 24 → 25. The remaining Phase-2 SPEC.2 rows (§5.1 inventory, §5.2, §6, §19.3, Appendix B) ride the migration commit, not this one. ⚠ **A §22.1 row was in that list when this branch was written and is not in it now** — D-30 retired §22's index at 2.0.0, so the amendment was dropped at the rebase rather than re-applied to a section that no longer exists; see 2.0.2. *(refs: ADR-0047; LIQ-1-P2)* |
| 2.0.2 | 2026-09-07 | HMH | **LIQ-1 Phase 2 (ADR-0047) — the schema half.** **§5** header 26 → **28** tables, twelve → **thirteen** domains, Bucket A ten → **eleven**, Bucket C thirteen → **fourteen**, protected thirteen → **fourteen**. **§5.1** rows 27 `liquidity_policy` (Bucket A) + 28 `liquidity_heartbeat` (Bucket C, operational). ⚠ **The Phase-2 plan proposed omitting the heartbeat from this inventory**, reading §19.3's "excluded from the inventory entirely" as covering §5.1; it does not — `watermark_state` and `cron_alarms` are §5.1 rows 22 and 23, and are excluded only from the DATASET inventory. Corrected against the file rather than inherited. **§5.2** both bucket lists + the protected total, and the staging catalogue figure `EXPECTED_GUARD_CATALOG_ROWS` 78 → **81** stated here so the doc and `guards.ts` agree. **§5.3** the domain list gains `liquidity`. **§6** opening corrected — it read "Twelve protected … nine Bucket A" and was **already stale by one before ADR-0047 touched it**: `bet_receipts` joined Bucket A at AUDIT-FIX-B3 and §5.2 has said thirteen ever since, two sections above. ADR-0030's own forward obligation, written into that very section, is what predicted the drift; it was paid at §5.2 and not here. **§19.3** dataset-relevant 22 → **23**, shipped 16 → **17** (`liquidity_policy` YES — without it no reader can reproduce an injection, the target rule being derivable from neither the events nor the reserves), excluded-entirely 4 → **5** (`liquidity_heartbeat`). **Appendix B.16b** new per-column block, every column SHIP; the closing recap moves 4 → 5. ⚠ **No §22.1 row.** The Phase-2 branch amended ADR-0047's index row before the 2.0.0 rebaseline; D-30 retired §22's index outright, so the amendment was dropped at the rebase rather than re-applied to a section that no longer exists. `docs/adr/0047-*.md` is the record. *(refs: ADR-0047; LIQ-1-P2)* |
| 2.0.3 | 2026-09-17 | HMH | **ADR-0054 — the bet write cap is re-keyed from the client IP to the signed-in ACCOUNT, and the per-IP cap is demoted to a loose backstop behind it.** §11 gains a seventh surface, `bet-user:{users.id}` 1m, carrying the new `BET_ATTEMPTS_PER_USER_PER_MIN`; `bet-ip` stays minted and moves to 10x as the cross-account abuse ceiling. Both are consulted at step 4, concurrently, and return the SAME `error_rate_limit_exceeded` envelope so a 429 never says which cap fired. ⚠ **This reverses a ratified position, and the reversal is written INTO each operative section rather than appended (`O-5`):** §4.6's and §11's reasoning paragraphs both argued that bet surfaces use per-IP identifiers *"because the threat model is credential-stuffed bot traffic across many compromised accounts; per-user limits only fire after a successful login and are the wrong defense surface"*. Sound about the THREAT, wrong about the BUDGET — a bet endpoint is unreachable without a session, so that objection describes the endpoint's whole population, while the address key billed one participant's thirty writes to every stranger behind their office, campus or carrier NAT. The threat is still answered, by the backstop, which is why it was demoted rather than deleted; the identical clause about **image-PUT-URL** is untouched and still governs `image-put-ip`. Sites amended: §4.6 (two handler rows + the reasoning paragraph), §11 (the per-surface table, the reasoning paragraph, the single-source-of-truth paragraph), §18 (threat row 2, control (d), the deferred-values row). Fail-open unchanged (ADR-0006). *(refs: ADR-0054; amends ADR-0015 D7)* |
| 2.0.4 | 2026-09-17 | HMH | **ADR-0053 — the debate poll's change probe.** §4.3's handler catalogue gains `GET /m/[slug]/version` and its closure is **narrowed from 'no separate read endpoint' to 'no separate CONTENT-BEARING read endpoint'**. ⚠ That narrowing is the whole ratification and is written into §4.3 itself, not appended (`O-5`): the catalogue was closed to stop a second endpoint forking the debate read and giving removal-masking a second place to diverge, and a probe returning `{"v":"<hash>"}` carries no body, teaser, author or post id — there is nothing in it for masking to be wrong about. The refresh remains `router.refresh()` over the composed read. Cache-Control `public, s-maxage=5, stale-while-revalidate=25` so the edge absorbs the fan-out. *(refs: ADR-0053)* |
| 2.0.5 | 2026-09-17 | HMH | **ADR-0056 — the W-1 retry budget is sized from a measurement.** §9's W-1 pattern row, its shared-shape sentence and its Retry-policy line all stated bases `[50, 100, 200]` / a 3-retry budget shared by W-1 and W-3; W-1 now carries `[50, 100, 200, 400, 800]` (five retries) and **W-3/W-4 deliberately do not follow**, so the three wrappers no longer mirror each other. All three sites corrected in place (`O-5`). ⚠ **The number moved because it was MEASURED, which is the whole point of the record:** a committed sweep (`tests/scale/write-ceiling-sweep.scale.test.ts`) storms one pool row and finds ~10% of writers refused at 48–64 concurrent under three retries and **zero** under five — so the refusal was the retry budget expiring, not the database failing, and the cost of the fix is latency (356 ms → 595 ms for a 64-way storm) rather than load. The prior working figure — a ~25-writer ceiling from a single burst taken during a production deploy — did not survive the sweep; nothing is refused below 32. ⚠ Local Postgres, not Supabase: the SHAPE transfers, the absolute figures do not. ADR-0013's *"DECISION PARAMETERS, NOT tunables"* framing is kept, not relaxed. *(refs: ADR-0056; amends ADR-0013)* |
| 2.0.6 | 2026-09-17 | HMH | **ADR-0057 — the participant session is served from its signed cookie for 300 s.** §8.2's cookie table note asserted all cookies are *"validated server-side every request"*; that is now false for the participant session and is corrected in place (`O-5`). Better Auth's `session.cookieCache` was OFF (its default), and off means every `getSession()` is a Postgres round trip — verified in the shipped package, `better-auth/dist/api/routes/session.mjs:93`, which skips the adapter read only when the flag is set. The `(public)` layout calls it on every render, so a signed-in reader was paying one database query per page view on surfaces #526/#551/#554 had just made free for everyone else; it was the last per-visitor read on the read path. ⚠ **The cost is CHROME, not ACTION:** a revoked session keeps rendering as signed-in for at most the window, while every write re-reads the user row. ⛔ The same amendment corrects a SECOND §8.2 sentence that never described the built code — that ban enforcement *"rides on the same `auth.api.getSession` call"*. It does not and never did: `runBetEndpoint` issues its own `users` read for `banned_at`, which is exactly why this cache is safe, and a reader trusting the old sentence would have concluded the opposite. *(refs: ADR-0057)* |

---

## §1 Purpose, Scope, and Non-Goals

### §1.1 Purpose

SPEC.2 is the **technical architecture frame** for the Zugzwang experiment-phase build. It defines the *shapes, slots, contracts, conventions, and invariant mechanisms* that downstream technical decisions and code must conform to.

SPEC.2 is **not** the substance-bearing technical document. Specific table DDL, library configs, error-code lists, cookie names, retry parameters, and migration filenames live in the **17 dependent ADRs** (`ADR-0003` to `ADR-0019`). SPEC.2 names *that there is an authentication system, that it has two parallel session paths, and that the cookie naming rule is X*; ADR-0004 (auth library) and ADR-0010 (admin auth wiring) supply the actual library, callback chain, and cookie names.

This split is the **Option B distribution**: SPEC.2 is the load-bearing frame; the ADRs are the load-bearing substance. Together, they form the complete coding contract that downstream tracker tasks (`SCAFFOLD.*`, `ENGINE.*`, `DEBATE.*`, `UI.*`, `HARDEN.*`) implement against.

### §1.2 Audience and primary reader

The primary reader of SPEC.2 + ADRs is **Claude Code** generating the experiment codebase under the writer/reviewer ritual. The secondary readers are Hrishikesh (product owner / sole engineer) and the PRECURSOR.4 fresh-session reviewer instance. SPEC.2 MUST therefore optimise for *agent experience* — scannable structure, RFC-2119 keyword discipline, named source-of-truth files, named test paths for every invariant — over narrative readability.

### §1.3 Scope (what SPEC.2 covers)

SPEC.2 owns, as a **frame document**:

- The deployment topology shape (§4 System Context).
- The complete table inventory and append-only/mutable classification (§5).
- The append-only enforcement contract and its single source-of-truth mechanism (§6).
- The events table shape and synchronous-vs-asynchronous projector classification rule (§7).
- The shape of the two parallel authentication systems (§8).
- The concurrency contract for the bet flow — SERIALIZABLE + `SELECT FOR UPDATE` + lock order + retry shape (§9, D2 ratified).
- The advisory-moderation pattern — the classifier call dispatched after the transaction commits, images screened at attach before first serve (§10).
- The rate-limit and idempotency-key contract (§11).
- The file-storage contract — R2 signed PUT URLs, key pattern, orphan sweep (§12).
- The six-field flow-contract template that every `F-*` flow file MUST conform to (§13).
- The invariant contract — every SPEC.1 `INV-N` MUST have a SPEC.2-named technical mechanism and a named test file path (§14).
- The error envelope shape (Plaid-style: `error_code` × `error_type` × `http_status` × `retry_semantics`) (§15).
- The identifier contract — UUIDv7 across all primary keys; pseudonyms in URLs are a separate column (§16).
- The observability contract — every server route MUST emit named fields to Sentry and PostHog per ADR-0007 (§17).
- The sybil and security model (§18).
- The public-dataset export pipeline contract for the 2026-11-06 release (§19).
- The conclusion-event freeze contract (§20).
- The operational runbook *slots* — cron schedule, deployment, rollback, dataset release (§21, substance lives in `HARDEN.*` task outputs).
- The ADR index (§22).

### §1.4 Non-goals (what SPEC.2 explicitly does NOT cover)

SPEC.2 MUST NOT contain:

1. **Product behavior.** That is `SPEC.1.md` v1.0-draft. SPEC.2 references `SPEC.1 §N` for every flow it shapes; it never restates product rules.
2. **CPMM math.** That is `cpmm.md`. SPEC.2 names that the bet handler computes "CPMM share-payout per `cpmm.md`"; it does not duplicate the math.
   - **`cpmm.md` authoring forward-reference (SYNC.7) — landed.** `cpmm.md` is on disk at `docs/specs/cpmm.md`, authored per this brief. **Purpose** — the CPMM math spec for the single-market-maker, fee-less, constant-product maker. **Lineage + license** — lifts Manifold's CPMM implementation (historically `common/src/calculate-cpmm.ts` + `cpmm.ts` in `manifold-markets/manifold`), rewritten for our invariants; the upstream is MIT-licensed and the lift preserves the MIT notice under our AGPL-3.0-or-later (MIT → AGPL is permitted; attribution is mandatory). **Invariants** — Dharma conservation; `NUMERIC(38,18)` precision (per ADR-0008); fee-less single-MM (no fee term in the share/probability math); frozen-at-resolution consistency (ties to INV-4 — a resolved market's CPMM state is immutable and auditor-reproducible). **Scope boundary** — math owned in `cpmm.md`; SPEC.2 names *that* the handler calls it and does not duplicate the formula (this non-goal). **Implementation home** — `src/server/cpmm/` (ENGINE.2–12, built). **Status** — authored and current; the companion-files line and Appendix B.3 (`pools` reserves) reference it.
3. **Ranking math.** That is `RANKING.md` (locked by **ADR-0017**, which supersedes ADR-0009). SPEC.2 names that the debate view orders comments by the ranking model; it does not duplicate the formula. (The superseded ADR-0009 single-function model is retired — see §5.4 + the §22 index.)
4. **Visual / brand system.** SPEC.2 references the design system but does not specify colors, typography, or component variants.
5. **Substance-level decisions delegated to dependent ADRs.** Specifically:
   - Next.js version / App Router config → ADR-0003 (SPEC.3)
   - Auth library + callback chain → ADR-0004 (SPEC.4) + ADR-0010 (SPEC.11)
   - Postgres + event-sourcing DDL + position materialisation + append-only trigger SQL → ADR-0005 (SPEC.5)
   - Hosting topology + cron schedules + R2 bucket policy → ADR-0006 (SPEC.6)
   - Observability vendor-specific configs → ADR-0007 (SPEC.7)
   - ORM choice + migration tooling → ADR-0008 (SPEC.9)
   - Pseudonym pool word lists + asset pipeline → ADR-0011 (SPEC.12)
   - Bet transaction retry policy + jitter formula + idempotency-key shape → ADR-0013 (SPEC.14) + ADR-0015 (SPEC.16)
   - OpenAI moderation + Redis reservation key shape → ADR-0014 (SPEC.15) — superseded by ADR-0046
   - UUIDv7 implementation choice (Postgres native vs userspace) → ADR-0016 (SPEC.17)
6. **Testnet, mainnet, on-chain, smart contracts, token bridging, validator design.** Out of scope for the entire experiment phase per `CLAUDE.md` golden rule "no decisions optimising for continuity across phase boundary."
7. **Marketing copy, launch strategy, partner outreach, legal counsel selection.** Not engineering scope.
8. **Number tuning.** Specific values for daily allowance, comment length cap, per-market rate limits, etc., are deferred to the SPEC.1 number-tuning pass (per memory). SPEC.2 names *that there is a daily allowance accrual job*; SPEC.1 Appendix B holds the concrete number when it lands.
9. **Version pins of any kind** (Postgres minor version, Drizzle patch version, etc.). Pins live in `package.json` and `drizzle.config.ts`. SPEC.2 names "Postgres," not "Postgres 17.4."

### §1.5 What "perfect" means for SPEC.2

A "perfect" SPEC.2 + ADR bundle has the following properties, jointly verified by PRECURSOR.4:

1. **Coverage.** Every flow named in SPEC.1 (`F-*`) has a technical contract in `docs/specs/flows/F-*.md`. Every invariant in SPEC.1 §5 (`INV-1` through `INV-4`) has a named technical mechanism in SPEC.2 §14 + a named test file path. Every constant slot in SPEC.1 Appendix B has an owning ADR or section. Every error case in any `F-*` flow maps to a stable error code in §15.4.
2. **No drift.** Every claim "X is the single source of truth for concern Y" in SPEC.2 has a corresponding `docs/specs/...` or `src/server/...` file path; the file exists; CI greps SPEC.2 for these claims and fails if any path is missing.
3. **No ambiguity.** Every architectural decision is either ratified in SPEC.2, in a dependent ADR, or in the decision record at `docs/decisions/`. There is no third state.
4. **No re-entry.** Substance is named in exactly one place. A reader looking for the bet retry policy reads ADR-0013 (SPEC.14); SPEC.2 §9 references it but does not duplicate the value. SPEC.2 changes do not silently invalidate ADR substance, and ADR changes that affect SPEC.2 carry a same-commit SPEC.2 update.

---

## §3 Data Flows

§3 owns the *architectural data-movement shape* of every state-mutating and read flow in the experiment-phase build — which tables get written or read, in what transaction shape, in what lock order, against what events-log row, with what synchronous vs asynchronous read-model semantics. SPEC.1 §7–§15 owns the *product-level* per-`F-*` flow contracts (Pre / System / Response / Errors / Invariants / Acceptance); §13 (Flow Contract Template) owns the *file-level* per-flow contract files at `docs/specs/flows/F-*.md`; this §3 sits between them at the architectural-pattern layer. The discipline is strict: §3 names the patterns and the four architecturally-distinct flows that don't reduce to a pattern (bet, comment, resolution, signup); it does NOT enumerate every `F-*` flow individually. A reader who needs the per-flow Pre/System/Response goes to SPEC.1 + the flow file; a reader who needs the architectural shape stays here.

Three write-flow patterns, three read-flow patterns, two async-flow patterns, one events-row contract, one cross-cutting handler stack. Every state-mutating endpoint reduces to one of the write patterns plus the handler stack; every read endpoint reduces to one of the read patterns; every cron job reduces to one of the async patterns; every state-mutation transaction emits at least one events-row.

### §3.1 Cross-cutting handler stack

Every state-mutating endpoint — Server Action or Route Handler, participant or admin — runs through the same seven-step contract. The contract is enforced by handler-shape discipline (CI-lint flagged for HARDEN.*); no helper macro abstracts it because the seven steps interleave with handler-specific logic at known points (rate-limit returns 429s; moderation routes Track A/B; the transaction wrapper retries on 40001/40P01).

```
1. Auth gate                  — per ADR-0004 (participant) / ADR-0010 (admin)
2. Idempotency-key validation — per §11 / ADR-0015 (header for Route Handlers; arg for Server Actions)
3. Idempotency cache lookup   — per §11 / ADR-0015 (Redis SETNX + body-fingerprint match)
4. Rate-limit check           — per §11 / ADR-0015 (per-surface sliding window on Upstash)
5. Handler body / transaction — per §3.2 write-flow patterns (W-1 bet/comment · W-3 resolution)
6. Moderation dispatch        — per §10 (every comment-bearing bet; after the transaction commits)
7. Events-row + response cache — per §3.7 + §11 (events.insert inside the txn; cache write outside)
```

Steps 1–4 and 7 are universal across every state-mutating endpoint; step 6 runs on every comment-bearing bet (under the v1.9.0 reply-as-bet model every post and reply carries mandatory commentary — F-BET-1, F-BET-2, F-COMMENT-1/2/3) and is skipped only by the comment-free sell F-BET-3 and the admin resolution flow per §10; step 5 takes one of the two participant/admin write-flow shapes named in §3.2 (the old comment-only shape is retired — see §3.2). The stack is the absorption surface for the three already-absorbed sections — §9 owns step 5's bet wrapper, §10 owns step 6, §11 owns steps 2–4 + step 7's cache write — §3.1 is the cross-reference that names the stack as a whole.

**Failure-mode posture across the stack**: rate-limit fails open (step 4); idempotency fails closed (step 3); moderation fails neither way — it is dispatched after commit and no participant outcome depends on it (step 6); the bet transaction wrapper retries up to 3× on 40001/40P01 (step 5 for bet flow). **Two-step ordering invariant**: idempotency cache lookup MUST run BEFORE rate-limit (step 3 before step 4) so that a retry of a previously rate-limited request returns the cached 429, not a fresh rate-limit decision. This ordering is locked by §11 / ADR-0015 and is not relitigable in §3.

**Durable bet-receipt pre-check (bet flow, AUDIT-FIX-B3 / ADR-0031).** In addition to the universal steps above, the two bet endpoints (`/api/bets/place`, `/api/bets/sell`) run a bet-flow-specific *durable receipt pre-check* **after** the Redis idempotency cache lookup (step 3) and **before** rate-limit (step 4) and moderation (step 6): on a `bet_receipts` hit with a matching body-fingerprint it returns the original stored response (short-circuiting rate-limit, moderation, and the transaction) and promotes the Redis sentinel; on a fingerprint mismatch it returns 409 `error_idempotency_key_reused` (poison guard; not cached). Its placement **before moderation** is load-bearing — a replay of an already-committed comment-bearing bet is never re-moderated. The pre-check fails **open** (a receipt-read failure degrades to normal execution; correctness is backstopped by the tx-level unique). See §11 + ADR-0031.

### §3.2 Write-flow patterns

Every state-mutating handler reduces to one of two transaction shapes (a participant bet/comment flow and an admin resolution flow; the v1.8.x comment-only shape is retired under reply-as-bet — see W-1). The shape name appears in the per-flow contract file under `docs/specs/flows/F-*.md` as `Transaction shape:` so a reader knows which §3.2 pattern applies without re-deriving it.

**Pattern W-1 — Bet flow (SERIALIZABLE + pool-row pessimistic lock).** Used by **every bet**: F-BET-1 (entry post-bet), F-BET-2 (subsequent post-bet), F-BET-3 (sell), and — because under the v1.9.0 reply-as-bet model every comment rides a bet — F-COMMENT-1 (additional post-bet), F-COMMENT-2 (reply-bet), F-COMMENT-3 (image-attached bet+comment). One Postgres transaction at SERIALIZABLE isolation; pool row locked via `SELECT … FOR NO KEY UPDATE`; canonical lock order `pools → positions → dharma_ledger → events`; full-jitter retry on bases `[50, 100, 200, 400, 800]` ms — **six attempts** — on SQLSTATE 40001 / 40P01 (widened from `[50, 100, 200]` by ADR-0056, sized from a measured collision sweep; W-3/W-4 keep the original bases). A comment-bearing bet additionally inserts the `comments` row and the `bets` row inside the same transaction (INV-1 atomic bet+comment via `bets.comment_id NOT NULL`; `comments.bet_id` is deliberately nullable — the comment is inserted before its bet in the same tx, so the FK can only point one direction; append-only forbids a later back-fill); the comment-free sell (F-BET-3) inserts no comment. The bet transaction wrapper at `src/server/bets/transaction.ts` (per §9 / ADR-0013) is the single source of truth; every bet handler invokes it. **Durable receipt (AUDIT-FIX-B3 / ADR-0031):** both `place()` and `sell()` write a `bet_receipts` row as the **last write** inside this W-1 transaction (after the pools update); a Redis-lost replay that reaches execute 23505s on `bet_receipts_idempotency_key_uq` (place also on `bets_idempotency_key_idx`) → whole-transaction rollback → no double proceeds → the 23505 catch returns the original response from the stored receipt.

**Pattern W-2 — Retired (reply-as-bet).** The v1.8.x "comment flow" — a standalone `comments` insert with no pool lock, used when a comment was *not* a bet — **no longer exists** in v1.9.0. Every comment now rides a bet (post-bet or reply-bet per SPEC.1 §7/§8 + ADR-0017/0018), so comment and reply writes run the W-1 bet transaction (taking the pool-row lock, moving CPMM reserves, freezing `side_at_post_time` inside the transaction). There is no comment-without-bet path; the only comment-free write is the sell (F-BET-3, still W-1). `src/server/comments/place.ts` is consequently folded into the bet write path (Appendix A).

**Pattern W-3 — Resolution flow (admin-actor batch settlement, INV-4 append-only).** Used by F-RESOLVE-1 (resolve), F-RESOLVE-2 (correction), F-RESOLVE-3 (void). One Postgres transaction at SERIALIZABLE isolation; lock order `markets → bets → payout_events → resolution_events → dharma_ledger → events`. The transaction fans out across all bets in the market in a single atomic write — typically tens to thousands of rows depending on market activity — and emits one `resolution_events` row plus one `payout_events` row per bet plus one `dharma_ledger` row per non-zero settlement plus a single terminal `events` row of `event_type = 'market.resolved' | 'market.corrected' | 'market.voided'`. The actor identity is structurally distinct: `events.metadata.user_id IS NULL` and `events.metadata.actor_id = 'admin-singleton'` (per ADR-0010 + SPEC.1 §10.1) — the admin has no `users` row, so the participant-side actor field is genuinely null, not a synthetic placeholder.

| Pattern | Used by | Lock order | Moderation | Single source of truth |
|---|---|---|---|---|
| W-1 | F-BET-1, F-BET-2, F-BET-3, F-COMMENT-1, F-COMMENT-2, F-COMMENT-3 | `pools → positions → dharma_ledger → events` (comment + bet rows inserted in-txn for comment-bearing bets) | Every comment-bearing bet (text + image per §10); the comment-free sell F-BET-3 skips | `src/server/bets/transaction.ts` |
| ~~W-2~~ | **Retired** — no comment-without-bet path under reply-as-bet; comment/reply writes run W-1 | — | — | folded into `src/server/bets/transaction.ts` |
| W-3 | F-RESOLVE-1, F-RESOLVE-2, F-RESOLVE-3 | `markets → bets → payout_events → resolution_events → dharma_ledger → events` | None (admin actor) | `src/server/resolution/settle.ts` |

Both remaining patterns (W-1, W-3) share SERIALIZABLE isolation and the full-jitter retry SHAPE from ADR-0013 (parameterised by the per-flow callback). ⚠ **They no longer share the BUDGET, and that is a ruling rather than drift (ADR-0056):** W-1 carries five retries and W-3/W-4 three. W-1 is the only one a crowd contends for — every participant post runs through it — and it is the only one that was measured; widening the other two to restore symmetry would be sizing from estimate, which ADR-0038 decision 2 forbids. They differ in lock-order spine and actor identity. ENGINE.7 (W-1) / ENGINE.9 (W-3) / ENGINE.13 (grant) implement; ENGINE.10 is the cross-flow correctness-at-scale exit gate.

### §3.3 Read-flow patterns

Every read endpoint reduces to one of three shapes. The shape determines whether the page is server-rendered fresh on every request, served from a Next.js cache, or rendered authenticated against per-user state.

**Pattern R-1 — Uncached server-rendered.** Default for Next.js 16 + App Router under `cacheComponents: true` (per ADR-0003 §6). Used by debate view, market detail, public profile pages — anywhere stake-backed correctness or audit-trail freshness is load-bearing. No `'use cache'` directive in the component tree; data fetched per request from Postgres. Acceptable cost: every page render hits the database; SPEC.1's H3 structured request log captures every fetch via Vercel runtime logs (per ADR-0007). The bet-flow read paths (positions, pending bets, debate-view ordering, current YES/NO price) MUST live here per §1.4 #5 and ADR-0003 §6.

**Pattern R-2 — `'use cache'` opt-in (Cache Components).** Used by the market list (`/` — the Discovery front page) and the public profile cards rendered on the leaderboard (`/leaderboard`) — both surfaces are unauthenticated, slow-changing, and tolerate stale-while-revalidate semantics on the order of minutes. The component or function declares `'use cache'` at its top; `cacheLife({ stale, revalidate, expire })` from `next/cache` sets the lifetime in seconds; the cached scope MUST NOT call `cookies()`, `headers()`, or read `searchParams` (Next.js 16.2.x raises a hard error per the May 2026 docs at `/docs/messages/next-request-in-use-cache`). Per-user values that drive the cached output are extracted by the caller (outside the cache scope) and passed in as arguments — this is how the leaderboard renders without per-user state contamination.

```ts
// src/app/(public)/page.tsx (illustrative shape only)
async function getMarketList() {
  'use cache'
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 })  // seconds
  return await db.select().from(markets).where(/* ... */)
}
```

Three operational rules consumed from the May 2026 Next.js 16.2.x docs: (i) `expire > revalidate` is enforced at build time — violation is a build error; (ii) `revalidateTag(tag, 'max')` is the supported two-argument signature for SWR-style invalidation, and `revalidateTag(tag, { expire: 0 })` is the immediate-invalidation form — the single-argument `revalidateTag(tag)` is deprecated in 16.x; (iii) the market-list and leaderboard cadences are deferred to §21 (cron schedule register) — §3.3 names only the pattern, not the specific revalidate / expire values.

**Pattern R-3 — Authenticated reads (uncached, gated).** Used by own-bet-history, own Daily Credit accrual history, own-profile-edit, admin-only views. Auth gate runs at the page boundary (per ADR-0004 / ADR-0010); data fetched per request; never cached because cache scopes can't read cookies. Admin views additionally validate `admin_sessions` independently at the page-level Server Component per CVE-2025-29927 defense-in-depth (per ADR-0010 + AGENTS.md §5).

| Pattern | Used by | Caching | Auth |
|---|---|---|---|
| R-1 | Debate view, market detail, public profile, leaderboard table rows | None (uncached, per-request fresh) | Public; participant session optional for write affordances |
| R-2 | Market list (Discovery, `/`), leaderboard public profile cards | `'use cache'` + `cacheLife({ stale, revalidate, expire })` | Public only — cached scopes cannot read cookies |
| R-3 | Own-bet-history, own Daily Credit, own-profile-edit, admin views | None | Required (participant or admin per surface) |

**Two negative-space directives explicitly NOT used in v1**: `'use cache: remote'` (Redis-backed handler for self-hosted multi-replica cache coherence — irrelevant on Vercel single-region per ADR-0006); `'use cache: private'` (per-user browser-memory cache — would let cached scopes read `cookies()`, but stores results client-side only and re-executes on every server render, providing no shared-cache benefit for our workload). Surfacing both as not-chosen pre-empts the next architect question and makes the negative-space decision auditable.

**Build-version pin.** Next.js MUST be pinned at ≥ 16.2.5 in `package.json` to bring in the `maxPostponedStateSize` DoS patch (CVE-2026-27979), the streaming-fetch-hang fix, and the `http-proxy` CVE patch. ADR-0003's framework version pin lives in `package.json`; this section's reference is the operational floor.

### §3.4 Async-flow patterns

Two engines per ADR-0006. Most scheduled work runs inside Postgres via `pg_cron`; a single carve-out runs as a Vercel Cron HTTP-fanout because it operates against R2 (outside Postgres).

**Pattern A-1 — `pg_cron`-driven (Postgres-internal cadence).** Three jobs in v1: (i) `events`-table partition-overrun monitor (alarms on any DEFAULT-partition insert per ADR-0005); (ii) `identity_pool` low-watermark check (5%-of-pool threshold — alarm 5 per ADR-0007); (iii) `markets`-state drift detection (asserts no `Open` markets past `resolution_deadline` and no `Resolved` markets without a corresponding `resolution_events` row). All three run inside the Supabase Postgres instance; no HTTP fanout; no Vercel function invocation. Failure surfaces via `cron.job_run_details` (Sentry alarm 6 per ADR-0007 §4 entry 6).

**Pattern A-2 — Vercel Cron HTTP-fanout.** Two jobs in v1: **(i) R2 orphan sweep** — deletes uploaded image objects whose corresponding `image_uploads` row is more than N hours old without a referencing `comments.image_url`. Cadence `0 */6 * * *` per SCAFFOLD.15 Q7 ratification (every 6 hours; Vercel Pro tier required for sub-daily cadences). Trigger surface: `GET /api/cron/r2-orphan-sweep` Route Handler. Carved out because the operation reaches into R2 — Postgres can't do that natively. **(ii) Market close-due sweep** (ENGINE.15 R-15.2) — `GET /api/cron/close-due-markets`, per-minute class (`* * * * *` placeholder cadence; numeric tuning is HARDEN), invoking the W-4 `closeDueMarkets` lifecycle sweep (the clock-driven `Open → Closed` cutoff; the deadline-to-tick stale-`Open` window is the R-14.3 close-lag bound). It is a Vercel Cron HTTP-fanout rather than a `pg_cron` job because the close cutoff runs through the app's W-4 transaction, not a Postgres function. Both jobs are Bearer-authed via `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron contract supports GET only). No other Vercel Cron jobs in v1.

The cron-engine split is itself a §3-level data-flow decision: every async background process is either (a) a Postgres-internal job that mutates Postgres state, or (b) an HTTP-fanout job — either mutating state outside Postgres (the R2 orphan sweep) or driving a Postgres mutation through the app's transaction layer rather than a Postgres function (the close-due sweep, ENGINE.15). Adding a third engine (a worker daemon, Inngest, BullMQ) is a future-architecture decision — explicitly out of scope for v1 per ADR-0006.

### §3.5 Auth + signup data flow (special case)

The signup sequence is architecturally distinct from every other flow because it threads through multiple tables across several transactions — pool consumption folded into Better Auth's `user.create.before` hook, the Better-Auth-owned `users` insert, the ToS-acceptance transaction, and post-commit event-emission micro-transactions — with a session-deferral hook gating cookie issuance, and because that hook conditionally suppresses session-cookie issuance based on a downstream-table predicate (`users.pseudonym` + `users.tos_accepted_at`). Worth its own sub-section because no other flow in the codebase has this shape.

**Sequence.** F-AUTH-1 (Google OAuth callback) or F-AUTH-2 (Email + OTP) returns a verified identity. Better Auth's `databaseHooks.session.create.before` hook (per ADR-0004) intercepts before any session row is written. The hook checks: does a `users` row exist for this identity, and does it satisfy `users.pseudonym IS NOT NULL AND users.tos_accepted_at IS NOT NULL`? If yes, the session-create proceeds and the participant cookie issues. Otherwise the hook throws `APIError("FORBIDDEN", { message: "ONBOARDING_REQUIRED" })`, suppressing the session-create — the user record and any OAuth-account row are preserved on rejection, no `sessions` row is written, and no cookie is issued — and the auth flow routes to F-AUTH-3 (pseudonym assignment) or F-AUTH-4 (ToS gate) before retrying.

**F-AUTH-3 pseudonym + PFP consumption (as built).** Pool consumption is folded into Better Auth's `databaseHooks.user.create.before` hook (`src/server/auth/index.ts`), which invokes the pool consumer `src/server/identity-pool/consume.ts`. The consumer opens its own `db.transaction` (default isolation) and runs `SELECT … FOR UPDATE SKIP LOCKED` on the FIFO-oldest unassigned `(colour, animal, number)` tuple from `identity_pool`, then `UPDATE identity_pool SET assigned_at = now()` (the single whitelisted Bucket-B transition per ADR-0005). The double-assignment guard is the `FOR UPDATE SKIP LOCKED` row-lock, not the isolation level. The hook runs *before any `users.id` exists*; it returns `pseudonym`, `pfp_filename`, and the three component columns as part of the user data, and Better Auth's adapter owns the subsequent `INSERT INTO users` (a separate operation from the pool-consumption transaction). `user.pseudonym_assigned` is emitted in a post-commit micro-transaction at the `databaseHooks.user.create.after` seam — the only seam where the created `users.id` is available — per the §7.5.1 sub-case-(b) carve-out, because Better Auth 1.6.11 exposes no in-transaction after-hook; the emit uses `metadata.user_id = metadata.actor_id = users.id` (self-actor per §8.8) and is verify-then-emit (see §7.5.1). If the pool is exhausted, return HTTP 503 `identity_pool_exhausted` with no state changes — the operational alarm at 5% remaining (pattern A-1, alarm 5) is the lead-time signal.

*Observation — pool-consumption / user-insert non-atomicity (pre-existing; not A22's fix).* The pool-consumption transaction (in the before-hook) and the Better-Auth-owned `users` INSERT are not one atomic transaction. A `users` INSERT that fails after the tuple is consumed leaves the tuple marked `assigned_at` with no corresponding `users` row — a burned pseudonym. This is a property of the built architecture (a consequence of Better Auth owning the user insert), recorded here for accuracy; A22 adds audit-log completeness, not atomicity, and the fix is tracked as a separate follow-up.

*Observation — isolation level (pre-existing).* Both signup transactions (this one and F-AUTH-4 below) run at default isolation, not the SERIALIZABLE isolation earlier specified; the double-assignment guard is the row-lock above. Whether default isolation is sufficient here is tracked as a separate correctness follow-up.

**F-AUTH-4 transaction (ToS acceptance evidence + initial grant).** One Postgres transaction at default isolation; lock order `users → dharma_ledger → events`. `UPDATE users SET tos_accepted_at = now(), tos_version_hash = $1, privacy_version_hash = $2, tos_acceptance_ip = $3, tos_acceptance_user_agent = $4` (Bucket-C mutable table per ADR-0005 — no append-only trigger on `users`); on the first-acceptance branch only, `INSERT INTO dharma_ledger` the equal initial grant (`entry_type = 'initial_grant'`, `bet_id` NULL, `amount = INITIAL_USER_DHARMA`, `balance_after = amount` — the recipient's first ledger row; ADR-0018) and `INSERT INTO events` with `event_type = 'dharma.granted'` (aggregate `dharma_account`); `INSERT INTO events` with `event_type = 'user.tos_accepted'` carrying both version hashes and the acceptance evidence in `payload`. The tab-race no-op acceptance reaches none of the grant writes. After commit, the next request's session-deferral hook re-evaluates and the participant cookie issues.

The signup sequence is the only flow where the session cookie's issuance is conditionally suppressed by a downstream-table predicate. This shape is locked by ADR-0004 (the hook contract) + ADR-0011 (the pseudonym pool) + ADR-0005 (the `identity_pool` Bucket-B classification). F-AUTH-ADMIN follows a parallel but disjoint path per ADR-0010 — admin has no `users` row, no pseudonym, no ToS gate; the admin-session cookie issues directly on password match via a transactional `DELETE+INSERT` on `admin_sessions`.

### §3.6 Resolution data flow (special case)

Resolution is architecturally distinct from per-row write flows because it fans out atomically across all bets in a market in one transaction. Worth its own sub-section because the scale and the actor identity differ from the W-1 bet flow in ways that downstream code (export pipeline, dataset schema, observability tagging) consumes.

**Fan-out shape.** F-RESOLVE-1 reads every `bets` row for the market (typically tens to thousands), settles each per the CPMM award rule (`+S × (1 − p) / p` for the winning side; `−S` for the losing side per SPEC.1 §10.3), writes one `payout_events` row per bet, writes one `dharma_ledger` row per non-zero settlement, computes the residual pool balance, records it as the `poolUnwindAmount` payload field on the terminal `market.resolved` events row (`metadata.actor_id = 'admin-singleton'`) — NOT a dedicated `pool_unwind` event type and **not** a `dharma_ledger` row (R-2; the ledger is user-only — R-9.5/R-9.5e), transitions `markets.status` to `Resolved`, locks the comment set (per SPEC.1 §6.2), and emits that single terminal `events` row of `event_type = 'market.resolved'`. All in one Postgres transaction at SERIALIZABLE isolation. The resolution entry point is TWO transactions back-to-back: the F-ADMIN-3 trigger tx (`Closed → Resolving`, emits `market.resolving`, payload marketId only) followed by the settle tx (this fan-out) — composed at the admin endpoint (ENGINE.15, R-15.3 resolveMarketAction), never one mega-transaction. INV-4 holds because every row written is in an append-only Bucket-A table (`bets`, `payout_events`, `dharma_ledger`, `resolution_events`, `events`) plus the one whitelisted Bucket-C update on `markets.status`.

**Actor identity.** The admin is structurally outside the participant identity system per ADR-0010. The events row's `metadata.user_id` is genuinely `NULL` (not a synthetic placeholder); `metadata.actor_id = 'admin-singleton'` is the structural marker. The dataset-export pipeline at §19 / Appendix B treats `metadata.actor_id = 'admin-singleton'` as the signal for admin-actor events, which never get pseudonymised because there is no pseudonym to map.

**F-RESOLVE-2 (correction) and F-RESOLVE-3 (void) follow the same fan-out shape**, with two differences: F-RESOLVE-2 writes paired `correction_reverse` + `correction_apply` `payout_events` rows per affected bet (floored at zero per SPEC.1 §10.7) and references the prior `resolution_events.id` via `corrects_event_id`; F-RESOLVE-3 writes `void_refund` `dharma_ledger` rows refunding `f × stake` per bet (sale proceeds stand — R-9.8) and emits `event_type = 'market.voided'` with the admin's free-text reason and the `poolUnwindAmount` in the payload. INV-4 is preserved in both: corrections are new rows, never updates of prior rows.

Single source of truth: `src/server/resolution/trigger.ts` (F-ADMIN-3), `src/server/resolution/settle.ts` (F-RESOLVE-1), `src/server/resolution/correct.ts` (F-RESOLVE-2), `src/server/resolution/void.ts` (F-RESOLVE-3). All four invoke a shared `runResolutionTransaction()` wrapper (`src/server/resolution/transaction.ts` — W-3) that applies the SERIALIZABLE + retry policy from §9 / ADR-0013 — same retry shape as the bet wrapper, parameterised by the per-flow callback, locking `markets` FIRST then `pools` (ADR-0013 Patch record P2; statement_timeout parameterised — 1 000 ms default, 5 000 ms for the fan-out flows).

### §3.7 Events-row contract (per-write discipline)

Every state-mutating data flow MUST emit at least one `events` row in the same transaction (Pattern A per ADR-0005). The events log is the canonical audit ledger; current-state tables are co-maintained inside the same transaction for read access; the public dataset release on 2026-11-06 is structurally a `pg_dump` over a deterministic view across the events log + current-state tables (per SPEC.1 §12.2). Per SPEC.1 G3, the dataset is the *only* surface from which `K_eff(t)` is derived — post-hoc, out-of-band, against the released archive — so the events log's completeness and the metadata field set below are the architectural mechanism by which G3 is satisfied.

**Canonical `events.metadata` field set** (per §17 observability tag set):

| Field | Type | Source | Notes |
|---|---|---|---|
| `request_id` | text | `proxy.ts` middleware | Generated per request; correlates events to Vercel runtime log lines |
| `flow_id` | text | handler-injected | One of `F-BET-1`, `F-COMMENT-2`, `F-RESOLVE-1`, etc. — name lookup from SPEC.1 |
| `user_id` | uuid \| null | session | Participant `users.id`, or `NULL` for admin actors and unauthenticated paths |
| `actor_id` | text | handler-injected | `'admin-singleton'` for admin actors; otherwise echoes `user_id` as text |
| `idempotency_key` | text \| null | request header / arg | Carried by every bet endpoint, including comment-bearing bets (post-bets and reply-bets) per §11 / ADR-0015 |
| `ip` | text | `proxy.ts` | Client IP; included in dataset release per SPEC.1 §12.2 |
| `user_agent` | text | `proxy.ts` | Client UA; included in dataset release per SPEC.1 §12.2 |

**Events insertion helper.** `src/server/events/insert.ts` exposes a single `insertEvent(tx, eventInput)` function that runs `INSERT INTO events (...) VALUES (...) ON CONFLICT (event_id, created_at) DO NOTHING` against the bound transaction (composite key per §7.1 + §7.3 partition-constraint reconciliation). The `event_id` is generated client-side via UUIDv7 (per ADR-0016) at handler-entry — used as the storage-layer dedupe primitive per ADR-0005 §5; `created_at` is derived deterministically from the UUIDv7 millisecond prefix. The `payload` is Zod-validated against the per-`event_type` schema at `src/server/events/schemas.ts` before insertion; schema mismatches are runtime errors, not silent inserts.

**CI lint enforcement (HARDEN.\* task).** Every state-mutating handler — defined as any file under `src/server/{bets,comments,dharma,resolution,auth,identity-pool,moderation}/` that opens a `db.transaction(...)` — MUST contain at least one `insertEvent(...)` call inside the transaction body. The lint rule scans for the pattern and fails the build on a missing call. Acceptable false-positive (rare): a transaction that legitimately reads but does not write, or one whose event is emitted in a post-commit §7.5.1 carve-out rather than in-transaction — `src/server/identity-pool/consume.ts` is the latter case (it mutates `identity_pool`, but its `user.pseudonym_assigned` event emits post-commit at the `user.create.after` seam per §7.5.1). These mark the handler with a `// no-event` comment, audited at code review.

### §3.8 Market lifecycle writes (W-4)

The lifecycle half of the market state machine — F-ADMIN-1 creation into `Draft`, the F-ADMIN-2 seeded `Draft → Open` commit, and the clock-driven `Open → Closed` cutoff — runs through a fourth write wrapper, W-4 (`runLifecycleTransaction()`), duplicating the W-3 spine per the C-3 no-extraction doctrine (W-1 and W-3 byte-untouched; ADR-0013 Patch record P3). Open and close lock the `markets` row FIRST (`FOR NO KEY UPDATE`) with an `expectedStatus` precondition (`['Draft']` for open, `['Open']` for close); create acquires no row lock — no row exists yet, and SSI's predicate handling covers the slug race (a surfaced 23505 signals a logic bug, not a handled path).

**One emit per flow, inside the W-4 transaction.** `market.created` (payload `marketId` + `resolutionDeadline` + `media[]` + `mediaVideoUrl` — extended at MEDIA.1, OD-2) · `market.opened` (payload `marketId` + `seedAmount` — the seed instant is `Draft → Open`, not creation; R-14.1) · `market.closed` (payload `marketId`). Event ids resolve once at service entry and are closed over across retries (ADR-0016 D1), so a retried attempt re-emits the same id and the §3.7 helper's `ON CONFLICT (event_id, created_at)` dedupes. Callers supplying `eventId` to `createMarket` MUST mint a fresh UUIDv7 per logical create — the §3.7 dedupe is retry-purity for the *same* operation, not cross-create replay protection (insertion is not verified); ENGINE.15's wire layer mints server-side only.

**Actor identity.** All three flows assert the admin actor form at service entry (`src/server/admin/actor.ts`): `metadata.actor_id = 'admin-singleton'`, `metadata.user_id` genuinely `NULL` — the §3.6 admin-actor encoding, uniform across lifecycle writes. The `closeDueMarkets` sweep emits as `admin-singleton` too (D-14.d): the deadline is the admin's committed market parameter; the clock executes the admin's standing instruction. Lifecycle flows write **zero `dharma_ledger` rows** — the seed is an `events` + `pools` reserve fact (R-2; the dormant `pool_seed` enum value stays dormant).

Single source of truth: `src/server/markets/create.ts` (F-ADMIN-1), `src/server/markets/open.ts` (F-ADMIN-2), `src/server/markets/close.ts` (the clock-driven close + the `closeDueMarkets` sweep), all through `src/server/markets/transaction.ts` (W-4); the pure state machine consumed is `src/server/markets/transitions.ts`.

### §3 Single source of truth

`src/server/events/insert.ts` owns the events insertion helper. `src/server/events/schemas.ts` owns the per-`event_type` Zod schema map. `src/server/bets/transaction.ts` owns the W-1 wrapper (per §9 / ADR-0013) — the single write path for every bet, including comment-bearing post-bets and reply-bets (the v1.8.x standalone `src/server/comments/place.ts` comment-only entry point is retired under reply-as-bet; comment/reply construction now sits inside the bet transaction). `src/server/resolution/settle.ts` owns the W-3 fan-out. `src/server/auth/index.ts` owns the Better Auth instance and the F-AUTH session-deferral hook (per ADR-0004). `src/server/identity-pool/consume.ts` owns the pseudonym pool consumer (per ADR-0011), invoked from the Better Auth `databaseHooks.user.create.before` hook in `src/server/auth/index.ts`. `proxy.ts` (formerly `middleware.ts`) at the repo root owns `request_id`, `ip`, `user_agent` injection into the request scope. The full file map is absorbed into Appendix A on its drafting pass.

ADRs consumed by §3: ADR-0003 (framework + runtime), ADR-0004 (Better Auth + session-deferral hook), ADR-0005 (Pattern A + Bucket A/B/C + events table shape), ADR-0006 (cron engine split), ADR-0007 (observability tag set), ADR-0010 (admin actor identity), ADR-0011 (identity pool consumption), ADR-0013 (W-1 concurrency model), ADR-0014 (pre-commit moderation — superseded by ADR-0046), ADR-0015 (rate-limit + idempotency), ADR-0016 (UUIDv7 PK + URL-exposure rule), ADR-0017 (reply-as-bet model + read-time per-side reply-bet aggregates), ADR-0018 (two-floor minimum-bet write-path check). §3 names how these compose; the ADRs hold the canonical substance.

---

## §4 API Surface

§4 owns the *HTTP / RPC surface inventory* for the experiment-phase build — every endpoint that crosses a process boundary, with its method (or Server Action signature), path, runtime, auth class, idempotency requirement, rate-limit class, and the SPEC.1 `F-*` flow it implements. SPEC.1 §7–§15 owns the per-`F-*` product behaviour; §15 (Error Code Envelope Shape) owns the codes catalogue at §15.4; this §4 sits between them at the *surface inventory* layer. The discipline is strict: §4 names what endpoint exists, where it lives, and how clients invoke it; it does NOT mint error codes (deferred to §15), it does NOT pick URL slug formats (deferred to ADR-0016 / §16), and it does NOT specify per-action input schemas (deferred to ADR-0008 + the per-flow contract files at §13).

**Surface principle.** Server Actions are the default mutation contract per ADR-0003 §Primitive 4 — typed, zod-validated, transactional, idempotency-aware via natural-key uniqueness. Route Handlers carve out three categories: (i) external-facing endpoints (OAuth callbacks, R2 signed-PUT URL mint, Vercel Cron HTTP-fanout target, Better Auth's mounted routes); (ii) **bet endpoints F-BET-1 / F-BET-2 / F-BET-3** (the D3 carve-out — per ADR-0015 the `Idempotency-Key` HTTP header is the request-level contract surface, and per the May 2026 Next.js 16.2.x evidence Server Actions cannot natively read custom HTTP headers from the client — Discussion #74255 and the absence of a header-passing API on the `serverActions` config page); (iii) public-read JSON endpoints (`/api/health`, `/api/dataset/manifest`). F-AUTH-ADMIN stays a Server Action behind the `/admin/login` page route per ADR-0010 + D3 — admin auth has no HTTP-header-shaped contract surface that a Route Handler would honor better.

The carve-out for bet endpoints is the load-bearing decision in §4. Two trade-offs accepted: (i) bet endpoints lose Server Actions' built-in CSRF defense (origin↔host check), so each bet Route Handler MUST implement an explicit Origin allowlist check at handler entry (file: `src/server/bets/origin-check.ts`); (ii) `revalidateTag()` and `updateTag()` semantics from inside Server Actions are not available — bet handlers call `revalidateTag(tag, 'max')` directly from the Route Handler body, which is supported per the Next.js 16.2.x docs.

### §4.1 Routing taxonomy

Six surface families. Every endpoint in §4.2 / §4.3 belongs to exactly one.

| Family | Runtime | Purpose | Auth class |
|---|---|---|---|
| **F1.** Public read pages | Server Components | Debate view, market detail, public profile, leaderboard, market list | None (participant session optional for write affordances) |
| **F2.** Auth pages + actions | Server Actions + page routes | F-AUTH-2 (OTP submit), F-AUTH-3 (pseudonym), F-AUTH-4 (ToS), F-AUTH-5 (logout), F-AUTH-ADMIN (admin login), F-AUTH-1 OAuth flow | Mixed — pre-auth for sign-in surfaces; participant for logout; admin for `/admin/login` |
| **F3.** Participant-write Server Actions | Server Actions | F-COMMENT-1/2/3/6/7, F-AUTH-3/4/5, profile-edit, daily-allowance accrual trigger | Participant session required |
| **F4.** Bet Route Handlers (D3 carve-out) | Route Handlers, Node.js runtime | F-BET-1, F-BET-2, F-BET-3 — only flows requiring `Idempotency-Key` header surface | Participant session required |
| **F5.** Admin endpoints | Server Actions + Route Handlers | F-RESOLVE-1/2/3, F-ADMIN-1/2/3/4/5; image upload signed-PUT URL mint for admin moderation actions | Admin session required (validated at handler boundary, not just middleware — CVE-2025-29927 defense-in-depth) |
| **F6.** Internal / external integrations | Route Handlers | OAuth callback (Better Auth mounted routes), R2 signed-PUT URL mint (participant image upload), Vercel Cron target, public health, dataset manifest | Mixed — public for health/manifest; pre-auth for OAuth callback; CRON_SECRET Bearer for cron; participant for upload sign |

The taxonomy is a §4-internal organising aid. The per-endpoint catalogue rows in §4.2 / §4.3 reference family by code (F1–F6) so a reader can scan by family.

**Cross-cutting Origin-allowlist middleware (per ADR-0003 §D3 CSRF defense).** Every state-mutating Route Handler validates the `Origin` request header at handler entry against an allowlist derived from the `BETTER_AUTH_URL` env var (with http→https variant for production). Mismatched-Origin requests return HTTP 403 `error_origin_rejected` with no state changes. Missing-Origin requests (typical server-to-server callers without a browser context) are admitted — the threat model is browser-originated CSRF, which always presents an `Origin` header. Single source of truth: `src/server/middleware/origin-allowlist.ts` (bootstrapped at SCAFFOLD.15 alongside `POST /api/uploads/sign`; future bet and admin handlers reuse the same helper). The Vercel Cron Route Handler `GET /api/cron/r2-orphan-sweep` is **exempt** — Vercel-internal cron fires from a server-to-server context without an `Origin` header, and bearer-auth via `CRON_SECRET` pre-empts CSRF threats on that surface. This middleware is the cross-cutting CSRF defense that compensates for Server Actions' built-in origin check being absent on Route Handlers; per-endpoint Origin-check helpers (e.g., `src/server/bets/origin-check.ts` named in §4.3) are deprecated in favour of the cross-cutting helper as bet endpoints land.

### §4.2 Server Actions catalogue

Fourteen Server Actions in v1 (two — `addBookmarkAction`, `removeBookmarkAction` — unwired at ADR-0040). Every row's file path is the single source of truth for that action's implementation. Under the v1.9.0 reply-as-bet model the three comment-composer actions (`placeDirectComment`, `placeReply`, `placeImageComment`) are **comment-bearing bets** — each opens the §9 W-1 bet transaction (moving CPMM reserves, inserting the paired `bets` + `comments` rows atomically per INV-1), not a standalone comment write.

| Action | Family | File path | Invocation surface | SPEC.1 F-* |
|---|---|---|---|---|
| `submitOtp(input)` | F2 | `src/server/auth/otp/submit.ts` | `<form action={submitOtp}>` on `/auth/otp` | F-AUTH-2 |
| `acceptPseudonymAndTos(input)` | F2 | `src/server/auth/tos/accept.ts` | `<form action={accept}>` on `/auth/welcome` (combined F-AUTH-3 + F-AUTH-4 — single user-facing screen, single transaction at the action boundary) | F-AUTH-3 + F-AUTH-4 |
| `logout()` | F2 | `src/server/auth/logout.ts` | Header user menu | F-AUTH-5 |
| `adminLogin(input)` | F2 | `src/server/auth/admin/login.ts` | `<form action={adminLogin}>` on `/admin/login` | F-AUTH-ADMIN |
| `placeDirectComment(input)` | F3 | `src/server/comments/place.ts` | `<form action={placeDirectComment}>` on debate view | F-COMMENT-1 |
| `placeReply(input)` | F3 | `src/server/comments/reply.ts` | Inline reply composer in debate view | F-COMMENT-2 |
| `placeImageComment(input)` | F3 | `src/server/comments/place-image.ts` | `<form action={placeImageComment}>` after R2 upload completes | F-COMMENT-3 |
| `resolveMarketAction(formData)` | F5 | `src/server/admin/markets/resolve.ts` | `/admin/markets/<id>` resolve / complete-settlement form | **F-ADMIN-3 + F-RESOLVE-1 (composed — trigger → settle, ENGINE.15 R-15.3)** |
| `correctResolutionAction(formData)` | F5 | `src/server/admin/markets/correct.ts` | `/admin/markets/<id>` correct form | F-RESOLVE-2 |
| `voidMarketAction(formData)` | F5 | `src/server/admin/markets/void.ts` | `/admin/markets/<id>` void form | F-RESOLVE-3 |
| `createMarketAction(formData)` | F5 | `src/server/admin/markets/create.ts` | `/admin/markets/new` form | F-ADMIN-1 |
| `seedPoolAction(formData)` | F5 | `src/server/admin/markets/seed.ts` | `/admin/markets/<id>` seed form (Draft → Open) | F-ADMIN-2 |
| `closeMarketAction(formData)` | F5 | `src/server/admin/markets/close.ts` | `/admin/markets/<id>` close form (manual — ENGINE.15 R-15.4) | W-4-CLOSE |
| `moderateComment(input)` | F5 | `src/server/admin/moderation/act.ts` | Per-comment **Remove** / **Ban author** buttons on the `/admin/moderation` live review feed — reactive, two independent axes (ADR-0020/0021; supersedes the SCAFFOLD.16 F-γ-thin approve/block model — UI-6 S3) | F-ADMIN-4 |

Audit-log search (F-ADMIN-5) is a read-only query against `admin_events` and `mod_actions` — implemented as a Server Component page at `/admin/moderation/audit`, not a Server Action. Listed here for completeness; it has no write surface.

The F-ADMIN-4 **live review feed** is likewise a read-only reader — `loadReviewFeed` (`src/server/admin/moderation/review-feed.ts`) backing the `/admin/moderation` Server Component page, not a Server Action (UI-6 S3). It returns every live Track-C comment across **all** markets MINUS the reactive `content_removed` set — a `NOT EXISTS` anti-join on the same `mod_actions.reason='content_removed'` predicate `loadRemovedSet` uses, so the 200-cap keyset window applies to live rows (pagination is not a filter — ADR-0021: no filter, no ranking, newest-first). Each attached comment image is minted server-side as a short-TTL (`READ_URL_TTL_SECONDS_MODERATION` = 60s) admin-gated signed URL via `signRead` — never a raw R2 key. `moderateComment`'s reactive contract is `moderateComment({ commentId, action })`, `action: 'remove' | 'ban'` (ADR-0020 — two independent axes, no combined verb): **Remove** appends exactly one `content_removed` `mod_actions` row (`verdict = NULL`, `categories = {}` — no classifier was involved) and writes NOTHING to `comments` (Bucket-A append-only; the comment is hidden read-side via the `loadRemovedSet` masking); **Ban** appends one `user_banned` row + sets `users.banned_at` only where NULL, touching no position / bet / dharma_ledger / comment (ADR-0021 — "ban removes voice, not balance"). Neither emits an `events` row (EVENT_TYPES stays **24** — UI-6 D-6). The three DEBATE.7-deferred F-ADMIN-4 pieces (Track-A informational rows; the LD-3 text-only `sexual/minors` carve-out ban-review surface; the inline participant debate-view Remove/Ban affordance) are **not** built at UI-6 — F-ADMIN-4 is only partially delivered.

F-ADMIN-3's standalone `triggerResolution` has no catalogue row: it is absorbed into the composed `resolveMarketAction` (trigger → settle back-to-back, with the stranded-`Resolving` resume — ENGINE.15 R-15.3). There is no standalone trigger Server Action; the once-planned `src/server/admin/markets/trigger-resolution.ts` was never created.

Every Server Action returns a typed result object discriminated by `ok: true | false`. The shape is locked at §4.4. Per-action zod input schemas are declared inline in each action file via `drizzle-zod`-derived row schemas (table-row inputs) or hand-rolled zod (non-row args) per ADR-0008.

### §4.3 Route Handlers catalogue

Eleven Route Handlers in v1 (ten built; `GET /api/dataset/manifest` is pending-build per §4.7). All run on the Node.js runtime per ADR-0003 §Primitive 7 (no `runtime = 'edge'` exports under `src/server/{bets,comments,dharma,resolution}/` or anywhere downstream).

| Method + path | Family | File path | Auth | Idempotency-Key | SPEC.1 F-* |
|---|---|---|---|---|---|
| `POST /api/bets/place` | F4 | `src/app/api/bets/place/route.ts` | Participant | **Required** | F-BET-1, F-BET-2 |
| `POST /api/bets/sell` | F4 | `src/app/api/bets/sell/route.ts` | Participant | **Required** | F-BET-3 |
| `POST /api/uploads/sign` | F6 | `src/app/api/uploads/sign/route.ts` | Participant | Optional | F-COMMENT-3 prep |
| `POST /admin/markets/media/sign` | F5 | `src/app/(admin)/admin/markets/media/sign/route.ts` | Admin | Optional | F-ADMIN-1 market-media upload (MEDIA.1) |
| `GET/POST /api/auth/[...all]` | F6 | (Better Auth mounted) `src/app/api/auth/[...all]/route.ts` | Pre-auth | N/A | F-AUTH-1 OAuth callback, OTP request, session validation |
| `GET /api/cron/r2-orphan-sweep` | F6 | `src/app/api/cron/r2-orphan-sweep/route.ts` | Bearer `CRON_SECRET` | N/A | A-2 cron pattern (Vercel Cron contract supports GET only) |
| `GET /api/cron/close-due-markets` | F6 | `src/app/api/cron/close-due-markets/route.ts` | Bearer `CRON_SECRET` (constant-time compare) | N/A — exempt (caller is Vercel Cron; distributed lock + `closeDueMarkets` sweep own the at-least-once / may-fire-twice semantics) | W-4 close-due sweep (ENGINE.15 R-15.2; §3.4 Pattern A-2; freeze-gated per §20.2) |
| `GET /api/health` | F6 | `src/app/api/health/route.ts` | None | N/A | Liveness probe |
| `GET /api/_smoke-error` | F6 | `src/app/api/_smoke-error/route.ts` | None — env-behavioral gate (404 on `prod`; throws on `staging`/`preview`; SCAFFOLD.8 EC9/LD-5) | N/A | Observability smoke — Sentry routing verification; throw-only, no state reachable; not a SPEC.1 flow |
| `GET /api/dataset/manifest` | F6 | `src/app/api/dataset/manifest/route.ts` | None (post-2026-11-06) | N/A | SPEC.1 §12.2 dataset metadata **PENDING-BUILD** (thin build-pipeline pointer per §4.7; not on disk — D4). |
| `GET /m/[slug]/export` | F6 | `src/app/(public)/m/[slug]/export/route.ts` | None | N/A | the debate `.md` export — `text/markdown`, `no-store` (ADR-0025 / EXPORT.1) |
| `GET /m/[slug]/version` | F6 | `src/app/(public)/m/[slug]/version/route.ts` | None | N/A | the poll's change check — `{ v: <opaque token> }` over (status, pool reserves, moderation count), `s-maxage=5` at the edge. Carries NO content, which is what admits it under the narrowing below (ADR-0053 / R2-CHEAP-POLL) |

**Server-Sent Events / WebSocket: explicitly absent.** The debate view refreshes by re-invoking its own `/m/[slug]` server read on a client-side interval (SPEC.1 §9 F-DEBATE-4), not by polling a Route Handler for CONTENT — the catalogue above admits no content-bearing read endpoint for this flow, because one would fork removal-masking into a second implementation (ADR-0021, ADR-0034 D-4). ⚠ **NARROWED AT ADR-0053, and the reason the narrowing is safe is the reason the original bar existed.** The bar was never about the number of endpoints; it was about masking having two homes. `GET /m/[slug]/version` returns a single opaque token over (status, reserves, moderation count) and no comment body, price or viewer-scoped value of any kind, so it re-implements nothing — and a tab that sees the token change still re-invokes the composed `/m/[slug]` read, where masking lives. What it removes is the refresh that happened when nothing had changed: measured on production 2026-09-16, the market page broke at 50 req/s offered with the connection pool pinned at 53 of 60 while Postgres ran 1-3 queries, so idle viewers were consuming the exact resource the site ran out of. `POLL_INTERVAL_MS_DEBATE_VIEW` carries a provisional pin of 15000 ms (SPEC.1 §16.1, Appendix B) so the flow is buildable before go-live; the tune remains deferred to HARDEN.6. The refresh re-executes the route's layout as well as its page; S-4 (ADR-0041) collapsed the prior twelve-to-fourteen round-trips to **2 per open tab for a signed-out viewer, 10 for a signed-in one** — the session-dedup helper folds the layout's and page's session reads into one, and the shared comments/ranking/totals/media/chart block now serves from a per-market cache keyed on `(market, reserves)` rather than re-executing on every tick. Polling suspends while the document is hidden or a bet composer is open, and stops permanently once the market leaves `Open`. `/m/[slug]` carries `export const instant = false`, **not** `force-dynamic`, from S-4 Phase B forward: `cacheComponents` (ADR-0041) makes `force-dynamic` a build error — redundant under the framework's own new default — and `instant = false` is the equivalent opt-out for this route's still-uncached, viewer-scoped reads (session, `?post=`). The poll's own guarantee is unaffected either way: this page file itself carries no `'use cache'`, so a refresh always re-executes it; only the shared block underneath now resolves from cache when nothing has moved. SSE / WS deferred to testnet phase per ADR-0006.

**Bet endpoint Origin defense.** Both `/api/bets/place` and `/api/bets/sell` validate the `Origin` header at handler entry via the cross-cutting `src/server/middleware/origin-allowlist.ts` (allowlist derived from `BETTER_AUTH_URL`, per §4.1) — mismatch returns HTTP 403 with no state changes. This compensates for the loss of Server Actions' built-in origin check. (The earlier per-endpoint `src/server/bets/origin-check.ts` / `ALLOWED_ORIGINS` design is superseded by that single cross-cutting helper — §4.1 — and is not on disk.)

**Market-media admin upload (ADR-0026; forward — lands at build).** An admin-context market-media upload surface — an admin signed-PUT mint into the `market-media` bucket (§12.1) plus the create-form media handling — lands here at **build** time under the admin surface (`src/server/admin/markets/…`), **distinct** from the participant `POST /api/uploads/sign` (which is hard-bound to a participant session). Per ADR-0027, market-media is operator-curated trusted content and is **not** moderated on upload (the moderation pipeline screens untrusted user-generated content; admin market media is operator-curated and unscreened, ADR-0027) — the admin signed-PUT writes the `market_media` row directly, with no moderation caller. Auth contract: admin session (`admin_sessions`), validated at the handler boundary per §4.5. **Built at MEDIA.1** as the Route Handler `POST /admin/markets/media/sign` (`src/app/(admin)/admin/markets/media/sign/route.ts`, catalogued above) — placed under the `(admin)/` route group, NOT `/api/admin/...`, so the `Path=/admin` admin session cookie reaches it; admin-session-gated, forked from the participant sign route, per-IP capped (`admin-media-put-ip`, §11).

### §4.4 Request / response envelope

**Route Handler envelope.** JSON over HTTPS. Success: `{ ok: true, data: <flow-specific-shape> }`. Error: `{ ok: false, error: { code: <stable-string>, message: <display-template>, retry_after?: <seconds> } }`. The `code` field references §15.4 per §15; `message` is the display template (interpolated client-side); `retry_after` is present iff the HTTP status is 429 / 503. HTTP status carries equal weight to `ok` — clients SHOULD branch on status, then on `ok`.

**Server Action return shape.** Discriminated union `{ ok: true; data: T } | { ok: false; error: { code: string; message: string; field_errors?: Record<string, string[]> } }`. The `field_errors` shape is the React 19.2 `useActionState` contract for surfacing per-field validation errors (e.g., "comment too long," "stake exceeds balance"). Server Actions don't return HTTP status to user code — the framework wraps the action call in its own protocol; per-action error class is encoded in `error.code`.

**`Idempotency-Key` header (bet endpoints only).** Format `^[A-Za-z0-9_-]{1,255}$` per ADR-0015. Server returns HTTP 400 `error_idempotency_key_required` if the header is missing on a bet endpoint, HTTP 400 `error_idempotency_key_invalid` if the format is wrong. Body fingerprint: SHA-256 of canonical-JSON (RFC 8785) request body, hex-encoded — used per ADR-0015 to detect body mismatch on key reuse (HTTP 409 `error_idempotency_key_reused`). Server Actions do NOT carry an `Idempotency-Key` header; they rely on natural-key uniqueness — for comment-bearing bets (posts + replies), the dedup key is `(user_id, market_id, body_hash, posted_at_minute)`.

**`request_id` echo.** Every Route Handler response carries an `X-Request-Id` response header echoing the `proxy.ts`-generated request ID. Clients SHOULD log this for support correlation. Server Actions don't expose this header (the framework owns the response shape) — `request_id` flows into the `events.metadata` row instead, so server-side correlation is preserved.

### §4.5 Auth contract per surface

**Participant session.** Cookie name `zugzwang_session`, HTTP-only + Secure + SameSite=Lax, indefinite Max-Age per ADR-0004. Issued on F-AUTH-1 / F-AUTH-2 success after the session-deferral hook clears (per §3.5). Validated at every Server Action boundary (per ADR-0004) and every participant Route Handler entry (per ADR-0003). Logout (F-AUTH-5) deletes the server-side `sessions` row and clears the cookie.

**Admin session.** Cookie name `zugzwang_admin_session`, HTTP-only + Secure + SameSite=Lax + Path=/admin + indefinite Max-Age per ADR-0010. Issued on F-AUTH-ADMIN success via the transactional `DELETE+INSERT` on `admin_sessions`. Validated independently at every admin Server Action and admin Route Handler boundary (NOT only at middleware) — per CVE-2025-29927 defense-in-depth, AGENTS.md §5, ADR-0010. Cookie names MUST differ from the participant cookie; the two session systems are structurally disjoint.

**Cookie discipline summary.** No surface ever validates one cookie type when checking the other. A user holding both cookies in the same browser (hypothetical — `B5` forbids the admin from also being a participant) presents two distinct sessions to two distinct subsystems. Logout endpoints are per-cookie-type; logging out of one does not log out of the other.

**Public surfaces.** F1 read pages and the F6 public-read JSON endpoints (`/api/health`, `/api/dataset/manifest`) explicitly skip the auth gate. Cached scopes (R-2 pattern) cannot read cookies anyway, so the absence of the gate is structurally enforced for those surfaces.

### §4.6 Rate-limit class per surface

Every endpoint in §4.2 / §4.3 is bound to a rate-limit class from §11's per-surface table (per ADR-0015). Numeric values defer to HARDEN.6.

| Surface family / endpoint | Rate-limit class |
|---|---|
| OTP request (F-AUTH-2 first step, served by Better Auth's `/api/auth/[...all]`) | `otp-email` (per email, 1h) + `otp-ip` (per IP burst, 1m) |
| `/admin/login` POST (F-AUTH-ADMIN) | `admin-login-ip` (per IP, 1h) |
| `placeDirectComment`, `placeReply`, `placeImageComment` (comment-bearing bets) | `bet-user` (per ACCOUNT, 1m) — the fairness cap — **plus** `bet-ip` (per IP, 1m) as a loose abuse backstop behind it (ADR-0054). The bet anti-abuse posture (posts/replies are bets, per SPEC.1 §8). Whether reply-bets additionally carry a per-market productive cap is **deferred to §11 + the number-tuning pass** |
| `POST /api/bets/place`, `POST /api/bets/sell` | `bet-user` (per ACCOUNT, 1m) **+** `bet-ip` (per IP, 1m) — both checked, concurrently, at step 4 (ADR-0054) |
| `POST /api/uploads/sign` | `image-put-ip` (per IP, 1m) |
| `POST /admin/markets/media/sign` (F-ADMIN-1 market-media upload) | `admin-media-put-ip` (per IP, 1m) |
| F-RESOLVE-1/2/3, F-ADMIN-1/2/3/4/5 | None — admin path |
| F1 public read pages, `/api/health`, `/api/dataset/manifest` | None — read-only |
| Vercel Cron target | None — Bearer-auth pre-empts abuse |

Under reply-as-bet there is **no standalone comment or vote rate-limit budget** (the v1.8.x `write-budget` + `write-burst` per-market comment pair is removed; friendly-fire is gone). Posts and replies are bets, so their anti-abuse posture is the bet posture — **the per-ACCOUNT cap `bet-user` (`BET_ATTEMPTS_PER_USER_PER_MIN`), with the per-IP `bet-ip` (`BET_ATTEMPTS_PER_IP_PER_MIN`) kept behind it as a loose abuse backstop (ADR-0054).** ⚠ This paragraph previously read *"Bet endpoints use a per-IP identifier because the threat model is credential-stuffed bot traffic across many compromised accounts; per-user limits only fire after a successful login and are the wrong defense surface"* — sound about the THREAT, wrong about the BUDGET, and the conflation was the defect. A bet endpoint is unreachable without a session, so there is no pre-login bet traffic for a per-IP cap to protect; meanwhile one address's thirty writes were shared by every participant behind an office, a campus or a carrier NAT. The threat is still answered — by the backstop, which is why it was demoted rather than deleted. Full reasoning in ADR-0054. Whether reply-bets warrant an additional per-market productive cap (distinct from top-level bets, which are exempt by design) is an open question deferred to §11 + HARDEN.6.

### §4.7 Versioning + URL discipline

**No `/api/v1/*` prefix in v1.** Cross-version compatibility is a non-goal; mobile or service-to-service clients are not in v1 scope; the one external integration (the public dataset) is served as static files post-2026-11-06 from the GitHub release at `zugzwang-foundation/experiment` plus a long-lived static URL — not through this API surface. The `/api/dataset/manifest` endpoint is a thin pointer to those static assets, not a serving layer.

**URL-exposure rule (per ADR-0016 §16 / SPEC.2 §16).** Participant-facing routes use pseudonyms and market slugs only — `/u/RedFox001`, `/m/<market-slug>`, `/markets/<slug>/comment/<short-id>`. Raw UUIDs are FORBIDDEN on participant routes. Admin routes under `/admin/*` MAY use raw UUIDs for operator ergonomics — `/admin/markets/<uuid>`, `/admin/users/<uuid>`. The 2026-11-06 dataset release uses raw UUIDs as join keys per SPEC.1 §12.2. The acceptance test `id::raw-uuid-not-in-participant-urls` regex-asserts no participant-facing route file accepts a raw UUID as a path parameter (per SPEC.2 §16).

**Slug generation** is SCAFFOLD.* territory — §4 names that slugs exist on participant routes; the slug-generation algorithm (kebab-case from market title + collision suffix?) is a future implementation decision, not an architectural one.

### §4 Single source of truth

`src/server/middleware/origin-allowlist.ts` owns the cross-cutting Origin allowlist (per §4.1; the once-planned per-endpoint `src/server/bets/origin-check.ts` is superseded and not on disk). `src/app/api/bets/{place,sell}/route.ts` owns the bet Route Handlers. `src/server/auth/admin/{login,validate,logout}.ts` owns the admin auth endpoints. `src/server/auth/index.ts` owns the Better Auth instance + the F-AUTH-1/2 mounted routes. `src/app/api/uploads/sign/route.ts` (participant) and `src/app/(admin)/admin/markets/media/sign/route.ts` (admin market-media, MEDIA.1) own the signed-PUT URL mints. `src/app/api/cron/{r2-orphan-sweep,close-due-markets}/route.ts` own the two Vercel Cron targets. The full file map is absorbed into Appendix A on its drafting pass.

ADRs consumed by §4: ADR-0003 (Server Actions vs Route Handlers default + runtime pinning), ADR-0004 (Better Auth mounted routes + participant session shape), ADR-0006 (cron-engine carve-out), ADR-0007 (request_id observability tag), ADR-0010 (admin auth wiring + cookie discipline + CVE-2025-29927 defense-in-depth), ADR-0015 (Idempotency-Key header surface + rate-limit class table), ADR-0016 (URL-exposure rule + UUID forbiddance on participant routes). §4 names the surface inventory; the ADRs hold the canonical substance.

---

## §5 Data Model — Table Inventory

§5 owns the *complete table inventory* for the experiment-phase build — every Postgres table the v1 codebase reads or writes, with append-only-vs-mutable classification per ADR-0005's Bucket A / B / C scheme, the per-domain schema home per ADR-0008 §4, and the load-bearing ADR(s) that mint the table's substance. SPEC.2 §5 is the single inventory; per-table DDL substance lives in ADR-0005 (table shape + classification rationale) + ADR-0008 (Drizzle declaration + migration discipline) + ADR-0016 (universal UUIDv7 PK). A reader who needs the column-by-column DDL goes to the schema file at `src/db/schema/<domain>.ts`; a reader who needs the inventory shape stays here.

Twenty-eight tables in v1 across thirteen domains. Eleven strictly append-only (Bucket A); three append-only with one whitelisted column transition (Bucket B); fourteen mutable with no append-only trigger (Bucket C). Total protected by §6's append-only enforcement contract: fourteen — **unchanged by `lots`**, which is Bucket C and carries a narrower `lots_no_delete` guard that is not an append-only trigger (§5.1 row 26).

*(26 → 28 at LIQ-1 Phase 2 / ADR-0047: `liquidity_policy` — Bucket A, the injector's parameter history — and `liquidity_heartbeat` — Bucket C, operational, following `watermark_state`/`cron_alarms`. ⚠ Both are §5.1 rows. The Phase-2 plan proposed omitting the heartbeat on the grounds that §19.3 excludes the pg_cron operational tables "from the inventory entirely"; that is true of the **dataset** inventory at §19.3 and NOT of this one, where `watermark_state` and `cron_alarms` sit at rows 22 and 23. Corrected against the file at execute rather than inherited.)*

### §5.1 Inventory table

Sorted by bucket. Within each bucket, ordered by §3 lock-order spine where applicable, then by FK-dependency order.

**Bucket A — strictly append-only (BEFORE UPDATE + BEFORE DELETE both `RAISE EXCEPTION`)**

| # | Table | Domain | Owner ADRs | Notes |
|---|---|---|---|---|
| 1 | `events` | `events` | ADR-0005 + ADR-0007 + ADR-0016 | Canonical events log per §3.7 + §7; monthly partitioned with twelve pre-created partitions + DEFAULT; composite PK `(event_id, created_at)` per §7.1 partition-constraint reconciliation; storage idempotency via `INSERT ... ON CONFLICT (event_id, created_at) DO NOTHING` |
| 2 | `dharma_ledger` | `dharma` | ADR-0005 | Append-only Dharma balance ledger; every balance change flows here; INV-2 (no-overdraft) enforced via §6 + ledger discipline; per-row total order via `seq` (`BIGINT GENERATED ALWAYS AS IDENTITY`, ADR-0029) — the balance read orders on `seq`, not `(created_at, id)` |
| 3 | `bets` | `bets` | ADR-0005 + ADR-0013 | Per-bet record; locked second in §9 W-1 lock-order chain; INV-1 atomic with comment write |
| 4 | `comments` | `comments` | ADR-0005 + ADR-0017 (supersedes ADR-0009) | Per-comment record; INV-3 (side-bound at post time via `side_at_post_time`). Under reply-as-bet every comment rides a bet (INV-1), enforced by `bets.comment_id` NOT NULL + W-1 transaction atomicity. `comments.bet_id` is **deliberately nullable** — the circular `comments`↔`bets` pair sets only the `bets.comment_id` direction at write time (the comment is inserted before its bet exists, and Bucket-A append-only forbids a later back-fill); `comments.bet_id` stays NULL by construction, relied on by nothing. `parent_comment_id` NULL = top-level **post-bet** comment, non-NULL = **reply-bet** comment (reply floor 50 per ADR-0018). **ADR-0058** adds `friendly_fire boolean NOT NULL DEFAULT false` — set on INSERT only, never updated — with table CHECK `comments_friendly_fire_requires_parent` (`parent_comment_id IS NOT NULL OR friendly_fire = false`); the same-side half of eligibility (`true` only when the reply's side equals the parent's `side_at_post_time`) is enforced on the write path (F-COMMENT-2), not by DDL, because it needs the parent row. A set-on-insert column plus a CHECK does not change the Bucket-A classification. No `stake_at_post_time` column — the superseded ADR-0009 ranking model used it; ADR-0017's multi-mode model reads per-side reply-bet aggregates at render time (§5.4) and needs no frozen post-level stake column. ADR-0026 adds a nullable FK `market_media_id` → `market_media.id` (`ON DELETE RESTRICT`, indexed; set-on-INSERT only, like `image_uploads_id`) for pick-from-pool image attachment, plus a table CHECK `NOT (image_uploads_id IS NOT NULL AND market_media_id IS NOT NULL)` making the two image sources mutually exclusive — a set-on-insert nullable FK + CHECK does not change the Bucket-A append-only classification. **Build-deferred (AUDIT.1 D2):** the `market_media_id` column + not-both-set CHECK are **not in schema** as of migration head `0023` — they ship in one migration with the composer-pick stratum, per the §0 v1.0.12 deferral note. The row above describes the ratified target shape, not current DDL. |
| 5 | `resolution_events` | `events` | ADR-0005 | One row per F-RESOLVE-1/2/3 admin fan-out; INV-4 append-only resolutions; corrections reference prior `resolution_events.id` via `corrects_event_id` |
| 6 | `payout_events` | `events` | ADR-0005 | One row per bet settlement during W-3 fan-out; corrections write paired `correction_reverse` + `correction_apply` rows per §3.6 |
| 7 | `mod_actions` | `audit` | ADR-0014 | Moderation audit trail; classifier verdicts, admin actions, and image-upload linkage via `image_r2_key` per §10 |
| 8 | `admin_events` | `audit` | ADR-0010 | Admin-action audit trail; admin-actor encoding `metadata.user_id = NULL`, `metadata.actor_id = 'admin-singleton'` per §3.6 + §8.8 |
| 9 | `user_events` | `audit` | ADR-0005 | User lifecycle audit trail (ToS acceptance, pseudonym assignment). Daily Credit accrual is NOT here — its complete write set is `events` (`dharma.credited`) + `dharma_ledger` + the `users.last_allowance_accrued_at` cursor per §5.5 (ENGINE.12 R2) |
| 10 | `bet_receipts` | `bets` | ADR-0031 + ADR-0016 | Durable per-request idempotency-receipt backstop for the W-1 bet/sell path (ADR-0031); Bucket A append-only (guards in migration 0022, reusing the shared 0003/0021 functions); UNIQUE on `idempotency_key`; FKs `user_id`→users / `market_id`→markets (indexed, ON DELETE restrict); `flow` CHECK IN ('place','sell'); `result` jsonb stores the F-BET response for replay fidelity; excluded from the §19 dataset entirely |

**Bucket B — append-only with one whitelisted column transition**

| # | Table | Domain | Owner ADRs | Whitelisted transition | Notes |
|---|---|---|---|---|---|
| 11 | `identity_pool` | `identity` | ADR-0005 + ADR-0011 | `assigned_at` NULL → timestamp | 50,000-row pseudonym pool; consumed via `SELECT ... FOR UPDATE SKIP LOCKED` in F-AUTH-3 per §3.5; synthetic UUIDv7 PK + `UNIQUE (colour, animal, number)` per ADR-0016 D5 |
| 12 | `image_uploads` | `image-uploads` | ADR-0006 + ADR-0014 + 3-B §12-R1 | `terminal_state` + `terminal_at` set together once | Image upload lifecycle; two-column atomic transition (committed / orphan / blocked); orphan sweep per §3.5 Pattern A-2 + §12.6 |
| 13 | `system_state` | `system` | 3-E §20-1 | `frozen_at` NULL → timestamp | Single-row keyed by `id = 'system'`; conclusion-event freeze trigger per §20.2; reversibility-none enforced at DB level |

**Bucket C — mutable, no append-only trigger**

| # | Table | Domain | Owner ADRs | Notes |
|---|---|---|---|---|
| 14 | `users` | `auth` | ADR-0004 + ADR-0011 | Better Auth user row + `pseudonym` + ToS evidence (`tos_accepted_at`, `tos_version_hash`, `privacy_version_hash`, `tos_acceptance_ip`, `tos_acceptance_user_agent`); `last_allowance_accrued_at` carries the **Daily Credit** accrual cursor (DB identifier retained per SPEC.1 §10.4); PII-stripped at H2 erasure |
| 15 | `sessions` | `auth` | ADR-0004 | Better Auth participant session; cookie name `zugzwang_session`; manual-logout-deletes-row per F-AUTH-5 |
| 16 | `accounts` | `auth` | ADR-0004 | Better Auth OAuth provider linkage (per 3-A R1 — fourth Better Auth table) |
| 17 | `verifications` | `auth` | ADR-0004 | Better Auth Email-OTP storage; single-use enforced by plugin; TTL-bounded; replaces dropped `otp_codes` |
| 18 | `admin_sessions` | `auth` | ADR-0010 | Hand-rolled three-column schema (`session_id`, `issued_at`, `last_seen_at`); single-row-at-any-moment via transactional `DELETE+INSERT`; cookie name `zugzwang_admin_session` |
| 19 | `markets` | `markets` | ADR-0005 + ADR-0026 | Market metadata + status; whitelisted Bucket-C `markets.status` update during W-3 (`Open` → `Resolved \| Voided`) per §3.6. ADR-0026 adds nullable `media_video_url text` (the outbound YouTube explainer URL; set at create, editable pre-live per the Bucket-C whitelist) |
| 20 | `pools` | `markets` | ADR-0005 + ADR-0013 | CPMM pool reserves; locked first in §9 W-1 chain via `SELECT ... FOR NO KEY UPDATE` |
| 21 | `positions` | `bets` | ADR-0005 + ADR-0013 | Per-user-per-market position cache; updated synchronously inside the W-1 bet transaction per §3.7; gates no-stake-no-voice eligibility (INV-3) and feeds W-3 settlement. No ranking role — ADR-0017's model reads per-side reply-bet aggregates at render time (§5.4), not a frozen position derivation |
| 22 | `watermark_state` | `system` | ADR-0006 + ADR-0007 | Single-row-per-metric state-machine table backing pg_cron alarm transition detection (alarm 5 per ADR-0007 §4). Ships in `drizzle/migrations/0007_pg_cron_jobs.sql`. Schema: `(metric text PK, state text CHECK IN ('above','below'), since timestamptz)`. Operational / pg_cron-machinery; not a domain entity. Constraint-driven validation only (CHECK enum). |
| 23 | `cron_alarms` | `system` | ADR-0006 + ADR-0007 | Queue table for pg_cron-emitted alarms. SCAFFOLD.17 ships the INSERT side; SCAFFOLD.5 ships the drain-and-emit side. Schema: `(id bigserial PK, alarm_id text NOT NULL, payload jsonb NOT NULL, emitted_at timestamptz, processed_at timestamptz NULL)`. Operational / pg_cron-machinery; not a domain entity. Constraint-driven validation only (PK + NOT NULL). |
| 24 | `market_media` | `markets` | ADR-0026 | Admin-set per-market media pool (carousel images + `display_order` + `is_default`); **no `user_id`** — admin-owned, structurally separate from `image_uploads` (admin has no `users` row per F-AUTH-ADMIN). FK `market_id` → `markets.id` (indexed, FK-on-referencing-side); `r2_object_key` in the `m/<marketId>/` namespace (§12.1), immutable post-insert; `created_by` defaults to the `'admin-singleton'` actor per §3.6 (no participant owner); whitelisted Bucket-C curation of `display_order` / `is_default` pre-live; exactly one `is_default = true` per market (partial unique index, strategy at schema build). Drives the §9 Market-Detail header carousel + the F-COMMENT-3 pick-from-pool source |
| 25 | `bookmarks` | `bookmarks` | ADR-0032 | Private per-viewer saved pointers at other authors' comments (UI-A6). Bucket C — mutable: un-bookmark is a legitimate `DELETE`, so NO append-only/TRUNCATE trigger (deliberately absent from `TRUNCATE_GUARDS`; the "disables N guards" teardown count is unchanged). Carries `user_id` (the viewer) → `users.id` + `comment_id` → `comments.id`, both `ON DELETE restrict` (each indexed on the referencing side; `bookmarks_comment_id_idx` closes the second-FK convention per the `positions_market_id_idx` A31 precedent); `UNIQUE (user_id, comment_id)` backs the idempotent `ON CONFLICT DO NOTHING` write. Zero invariant surface — no `events`/`dharma_ledger`/`bets`/`comments`/`resolution` write rides a bookmark (EVENT_TYPES stays 24, ADR-0032 Option 1). Excluded entirely from the §19 dataset. |
| 27 | `liquidity_policy` | `liquidity` | ADR-0047 | **Bucket A.** The signup-pegged injector's parameter history — one row per `version`, newest `effective_from <= now()` wins, ordered `(effective_from DESC, version DESC)` by its single index. No `user_id` and no FK in either direction: it governs every `Open` market at once rather than belonging to any of them, which is also why it is its own schema DOMAIN rather than a table inside `markets` (`O-15`: a schema unit is allocated by creating a FILE). Three `bucket_%` triggers in migration `0027`, reusing the shared `0003`/`0021` functions. `UNIQUE (version)` backs the newest-wins read's total order; one CHECK, `liquidity_policy_bounds`, bounds every parameter. ⛔ **That CHECK is the only review those numbers ever get, and that is deliberate**: tuning is an operator INSERT by design (ADR-0047 §G — "Never a deploy"), so there is no PR, no CI run and no reviewer between a mistyped guard band and every open market. ⚠ It is also a TRUNCATE **exclusion** on staging with its guard left ARMED (`tests/staging/_lib/guards.ts`), on `system_state`'s argument exactly: the seed row is written by `0027`, which drizzle believes applied and will never re-run, and a reset that wiped it would make the injector read no policy and **fail closed silently, forever**. Ships in the §19 dataset (§19.3) — without it a reader cannot reproduce any injection, the target rule being `max(floor, coefficient × count(*) FROM users)` with neither operand derivable from the events. |
| 28 | `liquidity_heartbeat` | `liquidity` | ADR-0047 | **Bucket C — operational, and deliberately carries NO trigger at all**, on the `watermark_state` / `cron_alarms` precedent (rows 22–23). Schema: `(id bigserial PK, run_id uuid NOT NULL, ran_at timestamptz DEFAULT now(), policy_version integer NULL, markets_considered integer NOT NULL, markets_injected integer NOT NULL)`, one index on `(ran_at DESC)`. ⚠ **NOT declared in Drizzle** — hence `"!liquidity_heartbeat"` in `drizzle.config.ts`'s `tablesFilter`; the same posture as rows 22–23, which are likewise hand-written in `0007`. ⚠ That entry guards `drizzle-kit push`/`pull`, **not** `db:check-drift` — measured: the drift script compares journal head to applied head and never introspects a table, so it cannot see an undeclared one in either direction (`O-13`). ⚠ **It must not be `bucket_%`-named**: a guard here would move `EXPECTED_GUARD_CATALOG_ROWS` and enrol a table the reset never truncates in the disable list. What it is FOR: a stopped `pg_cron` job produces no error, no log and no alarm, so a row here is the ONLY positive evidence the sweep ran — which is why it is written on **every** tick including the disabled, frozen and no-policy paths. It records that the JOB ran, never that it injected. Excluded entirely from the §19 dataset. |
| 26 | `lots` | `lots` | ADR-0039 + ADR-0016 | Per-argument lot accounting — ONE lot per `bets` row, 1:1 (R1: lot = bet = argument), enforced by the UNIQUE index `lots_bet_id_uq` plus the FK to `bets.id`; since `bets.comment_id` is NOT NULL (INV-1), the chain lot ⊂ bet ⊂ comment is closed by storage rather than by convention. Bucket C — **mutable**: `surviving_shares` / `surviving_basis` are reduced by every sell reaching the lot, so there is no append-only trigger and, deliberately, **no TRUNCATE guard** — a teardown's `TRUNCATE bets CASCADE` must still reach `lots` through the FK. Carries `user_id` → `users.id`, `market_id` → `markets.id`, `bet_id` → `bets.id`, all `ON DELETE restrict` and each indexed on the referencing side. R9 is DIRECTIONAL rather than append-only, and it is TWO properties enforced in two different places rather than one property held by the CHECKs. **The seven CHECKs bound RANGE, not DIRECTION** — `surviving_shares <= original_shares` says a lot is never larger than it was minted, and an UPDATE raising `surviving_shares` from 5 back to 20 against an original of 20 satisfies every one of them, with nothing at the storage layer refusing it. So R9's **monotonicity** (a lot never grows) is **APPLICATION-enforced**, `sellFromLot` being the only function that computes a new surviving value and `planLotSale`/`applyLotSale` the only path that writes one; R9's **permanence** (Sold is a state, not a removal) is **STORAGE-enforced**, by the row-level `BEFORE DELETE` reject `lots_no_delete` (migration 0026); and the UPDATE-monotonicity trigger that would move the first half into storage too is **DOCKETED, not built**. *(Corrected at MERGE-1, transcribing ADR-0039 D-1's own PHASE-0 correction — this cell had said the property was "held by seven CHECKs", which asserted a storage guarantee that does not exist and, under §1 precedence, outranked the ADR that had already corrected it.)* The guard is named outside the `bucket_%` family on purpose, so it does not enter the §6 append-only contract or the staging reset's guard catalogue, both of which it would misdescribe. **No back-fill (R8):** migration 0025 creates the table empty and inserts nothing, because per-argument attribution for bets placed before lots existed was never recorded; a `bets` row created at or after the migration applied with no matching `lots` row is a HALT condition, never a back-fill trigger. Mints the invariant-class rule R2 — `Σ lots.surviving_shares == positions.quantity` per `(user_id, market_id, side)` — with `positions` remaining the aggregate authority: attribution never vetoes it, so a position-level sell against absent or insufficient lots proceeds and allocates what it can. `Σ surviving_basis` IS Đa. |

### §5.2 Bucket-classification summary

The bucket classification is the load-bearing operational distinction: it determines which §6 trigger fires on which row, what the §6 test contract verifies, and what the public-dataset-export pipeline at §19 ships vs scrubs.

| Bucket | Count | Trigger pattern | Tables |
|---|---|---|---|
| **A** — strictly append-only | 11 | `BEFORE UPDATE` + `BEFORE DELETE` both `RAISE EXCEPTION` (+ `BEFORE TRUNCATE` statement guard per ADR-0030) | `events`, `dharma_ledger`, `bets`, `comments`, `resolution_events`, `payout_events`, `mod_actions`, `admin_events`, `user_events`, `bet_receipts`, `liquidity_policy` |
| **B** — whitelisted transition | 3 | Per-table function comparing OLD/NEW row images, permitting only the named whitelisted column-set transition once | `identity_pool`, `image_uploads`, `system_state` |
| **C** — mutable | 14 | No append-only trigger (constraint-driven validation only) | `users`, `markets`, `pools`, `positions`, `sessions`, `accounts`, `verifications`, `admin_sessions`, `watermark_state`, `cron_alarms`, `market_media`, `bookmarks`, `lots`, `liquidity_heartbeat` |

**`lots` is Bucket C and does not raise the protected count (LOTS-1 / ADR-0039).** It carries one row-level `BEFORE DELETE` reject (`lots_no_delete`, migration 0026) and no other trigger, which is a narrower property than either bucket names: the row may CHANGE — that is what `surviving_shares` is for — in ONE direction, forever, and may never LEAVE. Calling it Bucket A would assert that UPDATE is forbidden, which is the opposite of true; giving the guard a `bucket_%` name would enrol it in the §6 contract and in the staging reset's guard catalogue, neither of which describes what it does. So the guard sits deliberately outside both, and the counts above are the counts of the §6 append-only contract, unchanged.

Total protected (Bucket A + Bucket B): **fourteen tables** (AUDIT-FIX-B3 / ADR-0031 added `bet_receipts`; LIQ-1 Phase 2 / ADR-0047 adds `liquidity_policy`). The staging guard catalogue moves with it: `EXPECTED_GUARD_CATALOG_ROWS` **78 → 81**. ⚠ The derivation has FOUR terms, not three, and stating three gives 68: (11 Bucket-A × 3) + (3 Bucket-B × 3) + (13 `events` partitions × 2 CLONED row-level triggers) + (13 partitions × 1 statement-level `_no_truncate`, which PostgreSQL does NOT clone and which `0021` therefore writes out per partition) = 33 + 9 + 26 + 13 = **81**. The fourth term is the one an arithmetic check drops, because it is the one the SQL already contains rather than one the clone rule produces. `liquidity_heartbeat` adds nothing to either figure — it carries no trigger, which is the whole reason it must not be `bucket_%`-named. The §6 test contract floor (previously sized at 33+ cases for a thirteen-table protected set) reduced with the removal of `friendly_fire_events` — its Bucket-B trigger cases (the two-independent-column `frozen_at` / `cleared_at` transition tests) dropped with the table — then rose again with `bet_receipts`'s append-only cases (row-level UPDATE/DELETE rejection + statement-level TRUNCATE rejection per ADR-0030). The floor is re-baselined for the thirteen-table protected set per the per-table baseline ratified at 3-A.

### §5.3 Universal column conventions

**UUIDv7 primary keys.** Every PK in §5.1 is `uuid` declared as `id: uuid("id").primaryKey().default(sql\`uuidv7()\`)` per ADR-0016 D1–D4. This applies uniformly across the inventory: participant tables, audit tables, the four Better Auth tables (which override Better Auth's default 32-char base62 string per ADR-0016 D4 + ADR-0004 `advanced.database.generateId`), the hand-rolled `admin_sessions`, and the synthetic-PK tables (`identity_pool` carries a UUIDv7 `id` PK plus a separate `UNIQUE (colour, animal, number)` constraint per ADR-0016 D5). The `session.token` field on Better Auth's `session` table is **untouched** by this convention — that's the cookie-payload random string, not a row PK.

**Per-domain schema-file split.** Tables are grouped into domain files at `src/db/schema/<domain>.ts` per ADR-0008 §4 with a barrel re-export at `src/db/schema/index.ts`. Thirteen domains in v1: `auth`, `markets`, `bets`, `bookmarks`, `comments`, `dharma`, `events`, `identity`, `image-uploads`, `liquidity`, `lots`, `audit`, `system`. `liquidity` is its own domain for the same reason `lots` is, plus one of its own: `liquidity_policy` is not market-scoped — one row governs every `Open` market at once — so filing it under `markets` would suggest a per-market policy that does not exist (LIQ-1 Phase 2 / ADR-0047). `lots` is its own domain rather than a second table inside `bets` (LOTS-1 / ADR-0039): it has its own pure core, its own error sentinels, and its own invariant-class rule, and the `bets` file already carries three tables. The `auth` domain spans two ADR ownerships (ADR-0004 for the four Better Auth tables; ADR-0010 for `admin_sessions`); both groups share the same schema file because they share the auth surface conceptually.

**`created_at` + cross-row ordering.** All tables carry `created_at TIMESTAMPTZ DEFAULT now()`. Per ADR-0016's monotonicity caveat, `created_at` is the canonical chronological-sort column for cross-row ordering — UUIDv7's time prefix is per-backend monotonic only and MUST NOT be assumed monotonic across the Supavisor connection pool.

### §5.4 Read-models that are not tables

Two architecturally-significant read-models compute at read time rather than persist as tables:

- **Debate-view ranking + per-side reply aggregates.** Per **ADR-0017** (which supersedes ADR-0009) + `RANKING.md`, post/reply ordering is a **multi-mode model** — a multi-lane "Top" default (traction / stake / split lanes, ratio-to-#2 over an activity floor, graceful degradation) plus single-axis filter modes (Most Debated, Highest Stakes, Contested, Newest; Surging deferred to v1.x), with replies ranked **stake-descending within side** at `REPLY_DEPTH_MAX = 1` (earlier-wins tie-break). The substrate is **four per-side signals computed at render time by aggregating a post's reply-bets** — no friendly-fire vote, no stored vote table:
  - `support_count_total` — **DISPLAYED**: how many replies are on the post's own side, self-authored **and removed INCLUDED**;
  - `counter_count_total` — the same on the opposing side;
  - `support_count` — **RANKING INPUT, never rendered**: how many DISTINCT PEOPLE replied on the post's own side, self-authored excluded (`COUNT(DISTINCT rc.user_id)`);
  - `counter_count` — the same on the opposing side;
  - `support_dharma` — Dharma **still staked** across support-side reply-bets **by others** (`SUM(COALESCE(lots.surviving_basis, bets.stake))`);
  - `counter_dharma` — the same on the counter side.
  - `friendly_fire_dharma` — **COMPUTED, NOT RENDERED** (the meter that displayed it is withdrawn — D-52; carried for the redesign): Dharma **still staked** across support-side reply-bets **by others** that carry `friendly_fire = true` — a subset of `support_dharma`, which is unchanged and still includes it (ADR-0058);
  - `endorse_count` — **RANKING INPUT, never rendered**: how many DISTINCT PEOPLE replied on the post's own side **without** the flag, self-authored excluded;
  - `contest_count` — **RANKING INPUT, never rendered**: how many DISTINCT PEOPLE replied on the opposing side **or** on the own side **with** the flag, self-authored excluded, each person once. `endorse_count` and `contest_count` feed only the balance term `b`; `n` and `D` do not read the flag (`RANKING.md` §2).

  Three amendments are folded into those lines, and all three are load-bearing:

  - **Surviving basis, not frozen stake** (ADR-0039 R4, LOTS-1 + RANK-1). The sums read `lots.surviving_basis` with a `COALESCE` back to `bets.stake`, so a replier who sells down withdraws the weight they lent the parent. `bets.stake` remains Bucket-A immutable and readable; it simply stops being what these report.
  - **Self-authored replies are excluded** (ADR-0039 patch record P2, RANK-2). A reply whose author is the parent post's author counts toward none of the four — *a post attracting its own author is not attracting anything, and attraction is what these measure*. It is excluded from **nothing else**: it keeps its own stake, its own reply-lane position, its own ranking weight as an argument, and its place in the author's Arguments count. This closes a measured single-account capture in which a Đ10 post with six Đ50 self-replies took `topOrder` #1 outright via the sole-clearer sentinel and then sold back for dust. Counts were **not** made to decay, because a decaying count would assert that an argument someone made and later exited never got made — which ADR-0039 R9 forbids.

  - **The counts are TWO numbers** (ADR-0039 patch record P3, RANK-3). The `_total` pair is what a surface shows and **must equal what a reader can count there**; the other pair is what the lanes rank on and **must reach no client**. Their difference is the self-reply count — and on a post carrying a removed reply, that subtraction attributes the removal to a named pseudonym from a signed-out page. **And the ranking pair counts PEOPLE, not replies**: `n` is the thesis's `n` in `K · n > C`, so one person posting five times is `n = 1`. *"Most Debated" therefore means most people arguing, not most replies typed.*

  These derive entirely from existing columns (`lots.surviving_basis` over `bets.stake`, `bets.side` / `comments.side_at_post_time`, `comments.parent_comment_id`, and **`comments.user_id`** for the self-exclusion) via SQL aggregation per render. The "Support / Counter" counts a post displays are these read-time aggregates, **not** a friendly-fire vote tally — and the friendly-fire *toggle* of ADR-0058 is a flag on a Support reply-bet that these aggregates read, not a vote and not a tally. The model is **read-time-computed**: **no projection table, no `ranking_snapshots`, no materialised view, no cached score column** — pure TypeScript at `src/lib/ranking.ts` (tunables in `src/lib/ranking.config.ts`), computed per render, with `now` frozen to the resolution timestamp for resolved markets (INV-4). Lane ratios, the activity floor, and the gravity term are owned by `RANKING.md` and pinned at the 2026-09-01 number-tuning pass; the reply floor (`BET_MIN_STAKE_REPLY` = 50, ADR-0018) is the parameter-level lever on ADR-0017's conceded reply-level `C > n`. Lane-aggregation index requirements are a SCAFFOLD.2 deliverable. `RANKING.md` is authored at DEBATE.8 (the file did not previously exist; there was no ADR-0009 version on disk).
- **K_eff(t) trajectory.** Per SPEC.1 G3 + §12.2 + §19.5, `K_eff(t)` is derived **post-hoc, out-of-band, against the 2026-11-06 public dataset only**. No live in-product surface, no materialised view, no cron job. The PRECURSOR.2-B D4 lock prohibits any in-product K_eff component in v1.

### Read-time reply affordance (ReplyAffordance)

The set of reply sides available to a viewer on a given parent comment is a pure, read-time
derivation — never a stored field, never written. It is computed from (a) the parent comment's
frozen side at post time and (b) the viewer's currently held position in that market.

Let P = parent.side_at_post_time ∈ {YES, NO}, and H = the viewer's held side ∈ {YES, NO, ∅}.

- H = P  → Counter is foreclosed; Support is allowed.
- H = ¬P → Support is foreclosed; Counter is allowed.
- H = ∅  → both Support and Counter are allowed (entry reply).

The derivation is total over these inputs and has no side effects. It informs the UI's
affordance only; it is NOT the write-path guard. The write-path enforcement of a foreclosed side
is the existing single-side rule (F-BET-10, opposite_side_held), which rejects an attempt to take
a side opposed to the viewer's held position. The two agree by construction: a side the
affordance marks foreclosed is exactly a side the write-path rejects.

Shape:
  Affordance = "allowed" | "foreclosed"
  ReplyAffordance = { support: Affordance; counter: Affordance; reason: string | null }
  computeReplyAffordance(P, H) -> ReplyAffordance            (pure)
  readReplyAffordance(client, { viewerId, parentComment: { marketId, sideAtPostTime } }) -> ReplyAffordance

**Friendly-fire eligibility (ADR-0058).** Whether the composer offers the friendly-fire switch is a second pure derivation beside the affordance: `friendlyFireEligible(P, S) = (P === S)`, where `P = parent.side_at_post_time` and `S` is the side the reply will buy — the viewer's held side when they hold one, the side they chose when the reply is their entry. It is true exactly when the reply would be a Support. Like `computeReplyAffordance` it informs the UI only; the write-path guard is F-COMMENT-2's rejection of `friendly_fire = true` on an opposite-side or top-level comment.

**Own-post foreclosure (D-52).** When the viewer authored the parent, both affordances are foreclosed, whatever the viewer holds: the Support and Counter controls render disabled in the existing foreclosed treatment and the composer cannot open. The viewer-scoped read carries this as a boolean (`isOwnPost`, or the read's existing equivalent); the author's user id never reaches the client. The write-path guard is F-COMMENT-2's 400 `self_reply_forbidden`.

### Read-time debate-view comment list (DebateComment)

The debate view's comment list is a read-time read-model: a flat, oldest-first list of a market's comments, each carrying a live **marker** (`Flipped` | `Exited` | `none`) recomputed on every read — never stored, never written. It is the canonical comment-list read the debate-view render (DEBATE.4) consumes. The marker is **viewer-independent**: it reflects the *author's* current position, identical for every reader.

The marker is the live overlay; the comment's frozen `side_at_post_time` badge is a *separate* field that never moves (INV-3). For each comment, let X = `comment.side_at_post_time` ∈ {YES, NO} and Y = the comment author's currently-held side in that market ∈ {YES, NO, ∅}:

- Y = X  → `none` (author still holds the comment's side; renders no badge).
- Y = ¬X → `Flipped` (author now holds the opposite side).
- Y = ∅  → `Exited` (author holds no position).

Y is read from the ENGINE.11 position layer (`heldSideOrNull` / `getHeldPosition`, `src/server/positions/read.ts`), where a sold-to-zero position reads as ∅ (`null`); the marker is computed by the existing pure `computeMarker` (`src/server/positions/compute.ts`). Because every comment rides a bet at post time (INV-1), Y = ∅ unambiguously means *exited*, never *never-participated*.

**Frozen-by-construction at resolution (INV-4).** The marker recomputes per read yet is **stable forever once the market leaves `Open`**: `positions` has exactly one writer (`upsertPositionDelta`, reachable only from buy/sell, which require `market.state = Open`), and resolution writes `resolution_events` / `payout_events` but **never** `positions`. No stored marker, no snapshot table, no freeze write — the freeze is emergent (the ENGINE.11 R-4 "emergent marker" decision; F-DEBATE-3).

**Ordering is not ranking.** The list is returned **oldest-first**, key `(created_at ASC, id ASC)` (UUIDv7 tiebreak), and carries no rank. Debate-view ordering/ranking is the separate multi-mode model in §5.4 above (ADR-0017 / `RANKING.md`, built at DEBATE.8), layered on top of this list by its consumer — never inside this loader.

**Exposure boundary.** The DTO surfaces only the marker enum. The author's raw held side and quantity are consumed by `computeMarker` and dropped; they are **never** returned. The boundary is type-enforced — `DebateComment` has no `heldSide` / `quantity` member, so a leak is a compile error.

**Moderation seam (forward; not built here).** This read-model returns **all** Track-C (passed) comments **unfiltered**, including any an admin has reactively **Removed**. Under ADR-0021, reactive removal is a *soft* action: the comment row persists (marked by a `mod_actions` row), and the public view must render a `removed by moderator` placeholder **with the thread intact** (replies under a removed parent survive — they are other participants' stake-backed arguments). The removal treatment is therefore **render-time masking that preserves thread structure** — the consumer (DEBATE.4 render, paired with the DEBATE.7 moderation schema) masks a removed parent's body while keeping its thread node — **not** a `WHERE`-clause row exclusion, which would orphan the replies. The forward shape is a per-comment removed-state field consumed by the render, plus a viewer/role parameter on the read (public vs admin-review); the marker itself stays viewer-independent. **Hard precondition:** this read-model MUST NOT back any public surface until the removal-masking is attached — public consumption of the unfiltered list is a moderation read-bypass. (A Track A or Track B verdict does not stop a comment row from existing — the comment is written first and the verdict is advisory. `mod_actions` carries the verdict; `comments` carries the content, removed only by an admin's `content_removed` action, per ADR-0021 and ADR-0046.)

Shape:
  Marker = "Flipped" | "Exited" | "none"                          (ENGINE.11; computeMarker)
  DebateComment = {
    id: string;
    parentCommentId: string | null;        // depth-1 thread linkage (DEBATE.4 threads on this)
    userId: string;                         // author (public; identity resolved downstream)
    body: string;
    sideAtPostTime: "YES" | "NO";           // FROZEN badge (INV-3) — distinct from marker
    imageUploadsId: string | null;          // the comment's own attachment (F-COMMENT-3)
    createdAt: Date;                        // timestamptz; HTTP serialization is DEBATE.4's layer
    marker: Marker;                         // live overlay — recomputed per read
  }
  listMarketComments(client, { marketId }) -> Promise<DebateComment[]>     (read-only; oldest-first)
  Single source of truth: `src/server/debate-view/list-comments.ts` (`server-only`, named export, no barrel).

### §5.5 Removed from prior outline (audit trace)

Six tables that appeared in earlier outlines but are absent from the v1 inventory. Retained here as audit trace so a reviewer comparing v0.1-outline / v0.2-draft (and the v0.3-draft "as-built" inventory) against the current model sees the resolution path:

- **`admin`** — no admin user row exists. F-AUTH-ADMIN structural separation per ADR-0010 + §8.7 puts admin entirely outside the participant graph; auth is via `ADMIN_PASSWORD` env var against `admin_sessions` only. The "admin" actor is encoded at events-row write time (`metadata.user_id = NULL`, `metadata.actor_id = 'admin-singleton'`) per §3.6 + §8.8.
- **`otp_codes`** — renamed to `verifications` per ADR-0004 (Better Auth's Email-OTP plugin owns the table name).
- **`daily_allowance_events`** — collapsed into `events` (event-type `dharma.credited`, aggregate `dharma_account` — the built ENGINE.0 name, kept per the ENGINE.12 R1 founder ruling; this entry previously said `user.daily_allowance_accrued`) + `dharma_ledger` (the credit row) + `users.last_allowance_accrued_at` (the idempotency cursor) per ADR-0005. No separate domain table needed; no `user_events` row either (ENGINE.12 R2 — this three-part collapse is the complete write set).
- **`projections_state`** — no async projector cursor needed in v1. ADR-0005 Pattern A maintains read-models synchronously inside the originating transaction; there is no out-of-band projector to track.
- **`k_eff_dashboard`** — struck per PRECURSOR.2-B D4 (2026-05-08). The K_eff dashboard product surface was removed entirely; the only K_eff trajectory derivation is the post-hoc one against the 2026-11-06 public dataset (per §5.4 + §19.5).
- **`friendly_fire_events`** — removed entirely per **ADR-0017** *(and not revived by ADR-0058, whose friendly-fire **toggle** is one boolean on `comments`, not a table)* (reply-as-bet model, sharpened SYNC.7) + SPEC.1 v1.9.0-draft. The standalone friendly-fire up/down vote is gone — there is no vote affordance and no table. The "Support / Counter" signal a post displays is now read-time aggregated over its reply-bets (§5.4), not a stored vote. This table was present in the v0.3-draft "as-built" inventory (and in the SCAFFOLD.2 build) with a two-column Bucket-B trigger and F-COMMENT-6/7/8 Server Actions; all of it — table, trigger, `castFriendlyFire`/`clearFriendlyFire` — is struck from the architecture. (The physical migration dropping the built table + the F-COMMENT-6/7/8 retirement are forward engineering work tracked on the tracker.) **Note:** ADR-0017's own body text still says friendly-fire "stays display-only"; that wording is stale and contradicted by both specs — reconciled by a later in-place ADR-0017 patch, not in this pass per the "don't flip ADR status" scope.

### §5 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Per-domain table declarations | `src/db/schema/<domain>.ts` (ten domain files) |
| Barrel re-export of all schemas | `src/db/schema/index.ts` |
| Drizzle config (migration set + schema barrel pointer) | `drizzle.config.ts` |
| Append-only trigger SQL (Bucket A + Bucket B per-table functions) | `drizzle/migrations/<NNNN>_append_only_triggers.sql` |
| UUIDv7 PL/pgSQL function | `drizzle/migrations/<NNNN>_uuidv7_function.sql` |
| Events monthly partitioning DDL | `drizzle/migrations/<NNNN>_events_partitioning.sql` |
| Drizzle DB client (`server-only` import) | `src/db/index.ts` |

ADRs consumed by §5: ADR-0004 (the four Better Auth tables + cookie / session / verification / account schemas), ADR-0005 (Bucket A/B/C classification + per-domain split discipline + events table shape + dropped-tables collapse rationale), ADR-0006 (R2 bucket inventory feeding `image_uploads` lifecycle), ADR-0008 (Drizzle ORM + per-domain schema-file convention), ADR-0010 (`admin_sessions` hand-rolled three-column schema), ADR-0011 (`identity_pool` 50K-row pseudonym pool), ADR-0013 (`pools` / `positions` lock-order participation in the W-1 bet chain), ADR-0014 (`mod_actions` + `image_uploads` moderation linkage via `image_r2_key`), ADR-0016 (universal UUIDv7 PK + `identity_pool` synthetic-PK pattern), ADR-0017 (reply-as-bet model — `comments.parent_comment_id` post/reply split, `comments.bet_id` 1:1 binding, the four per-side reply-bet aggregates read at render time; supersedes ADR-0009 and retires `stake_at_post_time` + `friendly_fire_events`), ADR-0018 (two-floor minimum-bet write-path check), ADR-0026 (the `market_media` table + `comments.market_media_id` FK + not-both-set CHECK + `markets.media_video_url` + the third `market-media` R2 bucket arm). 3-B §12-R1 ratification (`image_uploads` Bucket B classification with two-column atomic transition) and 3-E §20-1 ratification (`system_state` Bucket B classification with `frozen_at` NULL → timestamp transition) are absorbed in this commit.

---

## §6 Append-Only Enforcement Contract

§6 owns the *physical-enforcement contract* by which Bucket A and Bucket B tables in the §5.1 inventory cannot be silently mutated outside the permitted patterns. The mechanism is Postgres triggers — `BEFORE UPDATE` and `BEFORE DELETE` (row-level) triggers plus `BEFORE TRUNCATE … FOR EACH STATEMENT` triggers that `RAISE EXCEPTION` on disallowed mutations — installed via hand-written raw SQL migrations in the Drizzle migration set per ADR-0005 §3 + ADR-0008 §3, the TRUNCATE guards added by ADR-0030 (`0021`). The triggers are the ground truth; handler-layer checks are advisory; service-role credentials cannot circumvent them without an audit-visible schema change. The contract is what makes INV-2 (no-Dharma-overdraft via append-only `dharma_ledger`), INV-3 (comments side-bound at post time via append-only `comments`), and INV-4 (append-only resolutions via append-only `resolution_events` + `payout_events`) enforceable at the database layer rather than only at the application layer.

Fourteen protected tables in v1: eleven Bucket A (strictly append-only) + three Bucket B (append-only with one whitelisted column-set transition). The fourteen Bucket C tables in §5.1 carry no append-only triggers;

*(⚠ This sentence read "Twelve … nine Bucket A … ten Bucket C" until 2026-09-07 and was **already stale by one before ADR-0047 touched it** — `bet_receipts` joined Bucket A at AUDIT-FIX-B3 and §5.2 has said "thirteen" ever since, two sections above. The forward obligation ADR-0030 wrote into this very section is what predicted the drift; it was paid at §5.2 and not here. Both are now derived from the same §5.1 inventory.)*
 their integrity rides on FK constraints, UNIQUE constraints, NOT NULL constraints, and CHECK constraints declared in their `src/db/schema/<domain>.ts` files via Drizzle DDL.

### §6.1 The five-clause contract

The contract is five clauses, each load-bearing:

1. **Every Bucket A table carries `BEFORE UPDATE` + `BEFORE DELETE` (row-level) triggers plus a `BEFORE TRUNCATE … FOR EACH STATEMENT` trigger, all `RAISE EXCEPTION` unconditionally.** No row in a Bucket A table can be modified or truncated after insert, ever, by any code path. (Row triggers do not fire on `TRUNCATE`; the statement-level TRUNCATE guard is added by ADR-0030, and — because PG17 statement triggers do not clone to partitions — is applied to the `events` parent **and every partition**.)
2. **Every Bucket B table carries a `BEFORE UPDATE` trigger that calls a per-table function comparing OLD and NEW row images, permitting only the named whitelisted column-set transition, and a `BEFORE DELETE` trigger plus a `BEFORE TRUNCATE … FOR EACH STATEMENT` trigger, each `RAISE EXCEPTION` unconditionally (ADR-0030).** The per-table function rejects any UPDATE that touches a non-whitelisted column, any UPDATE that re-fires the whitelisted transition (e.g., `frozen_at` already non-NULL), and any UPDATE that changes whitelisted columns to disallowed values.
3. **Bucket C tables carry no append-only triggers.** Their mutability is the design intent (cookies issue and revoke, market status transitions, position caches update, ToS acceptance evidence stamps, etc.).
4. **The trigger SQL ships in a single migration file.** Single source of truth: `drizzle/migrations/<NNNN>_append_only_triggers.sql`. Adding a new protected table is a same-commit edit to this file plus a new §5.1 row plus a new §6 test case — no scattering across multiple migrations.
5. **The triggers are the ground truth; handler-layer checks are advisory only.** The §3.1 handler stack does not pre-validate that an UPDATE would be permitted; it issues the SQL and lets Postgres enforce. A failed trigger surfaces as a SQLSTATE error in the handler — converted to an HTTP 500 `internal_error` envelope per §15 (the trigger fired because handler logic was wrong; user-displayed messages omit the trigger detail; full error rides into Sentry alarm 1 per §6.7).

### §6.2 Bucket A trigger pattern

Identical shape across all eleven Bucket A tables. Two triggers per table:

```sql
CREATE OR REPLACE FUNCTION enforce_bucket_a_no_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'append-only violation on table %.%: UPDATE not permitted',
    TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_bucket_a_no_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'append-only violation on table %.%: DELETE not permitted',
    TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Applied to each of the 11 Bucket A tables:
CREATE TRIGGER bucket_a_no_update BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_update();
CREATE TRIGGER bucket_a_no_delete BEFORE DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();
-- ... and same for dharma_ledger, bets, comments, resolution_events,
-- payout_events, mod_actions, admin_events, user_events, bet_receipts
-- (AUDIT-FIX-B3 / ADR-0031, migration 0022 — same shared functions), and
-- liquidity_policy (ADR-0047, migration 0027 — likewise reusing them; a
-- table's worth of identical trigger bodies is exactly the drift 0003
-- centralised away).
```

Two functions, twenty trigger declarations (ten tables × two triggers). The functions are shared because the message text is parameterised by `TG_TABLE_*` variables — no per-table function needed.

ADR-0030 adds a third shared statement-level function, `enforce_bucket_a_no_truncate()` (bare `RAISE EXCEPTION`; a *new* function — the row-level `no_update`/`no_delete` functions are not statement-safe), with `BEFORE TRUNCATE … FOR EACH STATEMENT` triggers across the 8 non-partitioned Bucket-A tables and the `events` parent and all 13 partitions (25 TRUNCATE triggers total including the Bucket-B analog). AUDIT-FIX-B3 / ADR-0031 adds `bet_receipts` as the tenth Bucket-A table; migration `0022` attaches its row-level UPDATE/DELETE + statement-level TRUNCATE guards in the same file, reusing all three shared functions (**no new functions**) — 26 TRUNCATE triggers total, and the append-only guards land in the same migration as the CREATE TABLE so the table is never unguarded. **Forward obligation:** any future migration adding an `events` partition or a new protected table MUST add the matching TRUNCATE-reject trigger in the same migration.

### §6.3 Bucket B trigger pattern

Per-table function comparing OLD and NEW row images. Three protected tables, each with its specific whitelisted transition.

**`identity_pool.assigned_at` NULL → timestamp** (per ADR-0011). Single whitelisted column shape — NULL-to-non-NULL transition once via `OLD IS NOT NULL AND NEW IS DISTINCT FROM OLD`, all other columns unchanged. Permits no-op UPDATEs (3-rule uniform across all Bucket B per SCAFFOLD.2 stratum 3.C ratification — see closing paragraph of this section).

**`image_uploads.terminal_state` + `image_uploads.terminal_at` set together atomically** (per 3-B §12-R1). Two-column atomic transition: the trigger function rejects any UPDATE where one column transitions but the other does not, OR where either column is already non-NULL in OLD (re-firing), OR where any non-whitelisted column changes. Permitted: a single UPDATE that moves both columns from NULL to non-NULL together. This is the only Bucket B table with a multi-column transition shape; the per-table function carries an explicit conjunction.

```sql
CREATE OR REPLACE FUNCTION enforce_image_uploads_terminal_atomic()
RETURNS TRIGGER AS $$
BEGIN
  -- One-shot on terminal_state (immutable once set; permits no-op on terminal rows)
  IF OLD.terminal_state IS NOT NULL AND NEW.terminal_state IS DISTINCT FROM OLD.terminal_state THEN
    RAISE EXCEPTION 'image_uploads: terminal_state is one-shot (immutable once set)';
  END IF;
  -- One-shot on terminal_at (immutable once set; permits no-op on terminal rows)
  IF OLD.terminal_at IS NOT NULL AND NEW.terminal_at IS DISTINCT FROM OLD.terminal_at THEN
    RAISE EXCEPTION 'image_uploads: terminal_at is one-shot (immutable once set)';
  END IF;
  -- Reject partial transition (XOR; one column NULL while other set)
  IF (NEW.terminal_state IS NULL) <> (NEW.terminal_at IS NULL) THEN
    RAISE EXCEPTION 'image_uploads: terminal_state and terminal_at must transition together';
  END IF;
  -- Reject any non-whitelisted column change (immutable list extended at
  -- SCAFFOLD.15 to include content_type + byte_size per 0006 migration)
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.r2_object_key IS DISTINCT FROM OLD.r2_object_key
     OR NEW.content_type IS DISTINCT FROM OLD.content_type
     OR NEW.byte_size IS DISTINCT FROM OLD.byte_size
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'image_uploads: only terminal_state + terminal_at may transition together';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

The immutable list for `image_uploads` is `id`, `user_id`, `r2_object_key`, `content_type`, `byte_size`, `created_at`. The two-column atomic transition (`terminal_state` + `terminal_at`) is the only permitted UPDATE; the trigger function lives in `drizzle/migrations/0003_append_only_triggers.sql` with the `content_type` + `byte_size` extension re-created via `CREATE OR REPLACE` in `drizzle/migrations/0006_image_uploads_extension.sql` per SCAFFOLD.15.

**`system_state.frozen_at` NULL → timestamp** (per 3-E §20-1). Single whitelisted column shape — same per-column DISTINCT-FROM one-shot semantics as `identity_pool`. The conclusion-event freeze trigger flips this column once at 2026-11-05 23:59 UTC; the trigger ensures it can never flip back. Recovery from an erroneous freeze requires `BREAK_GLASS.md` direct-database surgery via `ALTER TABLE ... DISABLE TRIGGER` followed by manual UPDATE — this breaks the experiment deliverable per SPEC.1 §12.4 and is acceptable only as catastrophic-failure recovery.

All three Bucket B trigger functions use the 3-rule (DISTINCT-FROM) pattern uniformly per SCAFFOLD.2 stratum 3.C ratification — permit no-op UPDATEs (the trigger enforces non-mutation, not action), reject re-fires on whitelisted columns via DISTINCT-FROM, reject partial transitions on multi-column-atomic Bucket B (image_uploads only), reject any non-whitelisted column change. Asymmetry across Bucket B trigger functions would be a permanent cognitive tax.

Total Bucket B trigger declarations: three per-table functions + six trigger statements (three tables × two triggers — one BEFORE UPDATE calling the per-table function, one BEFORE DELETE that `RAISE EXCEPTION` unconditionally).

### §6.4 Application-layer relationship

The handler stack (per §3.1) does NOT pre-validate that an UPDATE would be permitted by the trigger. Handlers issue the SQL and let Postgres enforce; a failed trigger surfaces as a SQLSTATE error in the handler.

This is deliberate. Pre-validation in the handler would either (i) duplicate the trigger logic in TypeScript, creating two sources of truth that drift, or (ii) issue a `SELECT` to read the row's current state before the UPDATE, doubling the database round-trip cost. Neither is justified when the trigger is correctly enforcing.

The error path is well-defined: a trigger `RAISE EXCEPTION` returns a Postgres error; Drizzle propagates it to the handler as a `DatabaseError`; the handler converts to an HTTP 500 `internal_error` envelope per §15. The user-displayed message is generic ("Something went wrong, please try again"); the full trigger message rides into Sentry alarm 1 per §6.7. Trigger errors are operationally unexpected — they fire only on application bugs that violate the contract — so a 500 is the correct response class.

### §6.5 Service-role credentials cannot circumvent

Postgres triggers fire for all roles by default. Service-role credentials (Supabase's `service_role` key, which bypasses RLS) do NOT bypass triggers. (RLS itself is out of scope for the experiment per §18.5 / ADR-0019 — the database is server-only, so RLS would back-stop the trusted server rather than gate an exposed surface; the append-only triggers, by contrast, are load-bearing and apply to every role.) The only way to write to (or truncate) a Bucket A table without firing the trigger is to issue `ALTER TABLE <name> DISABLE TRIGGER <trigger>;` first. Per the INV-A20 probe (ADR-0030, 2026-07-04) the current runtime role is the table **owner** (`postgres`), so this bypass is runtime-reachable — the append-only guard is a defense-in-depth barrier (against accidents, blast-radius, and unsophisticated injection), **not** a hard boundary against an owner-level actor, and a `TRUNCATE` grant cannot be revoked from an owner. The durable closure is a dedicated non-owner runtime role (parked, pre-Sep-15 target); until it lands, DISABLE-TRIGGER remains an owner-reachable action rather than an accident-only footgun.

This means a future "I just need to fix this one row" production hotfix is structurally a deliberate, audit-visible event — not an accidental footgun. The `BREAK_GLASS.md` runbook (per ADR-0010 + §21) documents the procedure for the catastrophic-failure case.

### §6.6 Test contract floor

Test contract floor at SPEC.2 v1.0 lock: a per-table minimum across the **twelve protected tables**. The floor was 38+ for thirteen tables (33+ at 3-A, bumped to 38+ at SCAFFOLD.15 for the five `image_uploads` 0006 extension cases); it **re-baselines below 38** with the removal of `friendly_fire_events` — its Bucket-B trigger cases drop with the table (the two-independent-column `frozen_at` / `cleared_at` transitions, their re-fire rejections, the both-columns-at-once rejection, and DELETE rejection). The floor is sized at the per-table baseline ratified at 3-A: each Bucket A table requires at least UPDATE-rejected + DELETE-rejected coverage; each Bucket B table requires whitelisted-transition-accepted + non-whitelisted-column-rejected + re-firing-rejected + DELETE-rejected coverage; `image_uploads` additionally requires partial-transition-rejected coverage for both column orderings AND content_type / byte_size immutability + CHECK-bound coverage per SCAFFOLD.15 0006. The exact case count is set at SCAFFOLD.2 implementation time against the twelve-table protected set.

Test path naming: `tests/db/triggers/<table>-append-only.spec.ts`, one file per protected table. SCAFFOLD.2 implements the full suite as a same-commit deliverable with the trigger SQL migration. Test fixtures bypass any application-layer protection (going straight to the Drizzle client) so the trigger is the only enforcement under test.

### §6.7 Observability hook

Every trigger `RAISE EXCEPTION` event fires Sentry alarm 1 (Append-only-trigger violation) per §17 alarm catalogue. The Sentry payload carries the SQL error message (which includes the table, the OLD/NEW row diff for Bucket B, and the violating handler's request_id from `events.metadata`), the originating flow_id, and the user_id (or `'admin-singleton'` for admin actors). Threshold tuning is HARDEN.*-owned per §17.7; the alarm fires on any single occurrence — a trigger trip is operationally unexpected and warrants investigation.

Per §17.5's fail-open posture for observability, a Sentry outage does not affect the trigger enforcement; the trigger still fires, the handler still returns 500, only the alarm is silently dropped. The DB-level enforcement is independent of the observability surface.

### §6 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Trigger SQL (all bucket A + bucket B trigger functions + trigger declarations) | `drizzle/migrations/<NNNN>_append_only_triggers.sql` |
| Per-table append-only test suites | `tests/db/triggers/<table>-append-only.spec.ts` (twelve files) |
| Sentry alarm 1 catalogue row | §17.2 master table |
| `BREAK_GLASS.md` admin-bypass procedure (catastrophic-failure recovery only) | `docs/runbooks/BREAK_GLASS.md` (HARDEN.10-owned per ADR-0010) |
| Bucket classification of each table | §5.1 inventory + §5.2 summary |

ADRs consumed by §6: ADR-0005 (Bucket A/B/C classification + ground-truth-trigger discipline + same-migration-file convention), ADR-0008 (Drizzle migration set + raw-SQL migrations alongside drizzle-kit-generated `.sql` files), ADR-0010 (`BREAK_GLASS.md` procedure flag), ADR-0014 (`mod_actions` Bucket A — moderation audit-trail integrity rides on this). 3-B §12-R1 (`image_uploads` Bucket B with two-column atomic transition) and 3-E §20-1 (`system_state` Bucket B with `frozen_at` NULL → timestamp) absorbed in this commit; cross-reference renumber from "ADR-0007 catalogue entry #1" to "§17 alarm 1" applied per 3-D R2.

---

## §7 Event Model

§7 owns the *events table shape and read-model classification rule* for the experiment-phase build. The events log is the canonical audit ledger per ADR-0005's Pattern A — every state-mutating data flow emits at least one events row in the same transaction (per §3.7), and the public-dataset release on 2026-11-06 is structurally a `pg_dump` over a deterministic view across the events log + current-state tables (per §19). Per SPEC.1 G3, the dataset is the *only* surface from which K_eff(t) is derived — post-hoc, against the released archive — so the events log's column completeness is the architectural mechanism by which G3 is satisfied.

§7 names the eight-column shape, the partitioning strategy, the storage-layer idempotency primitive (distinct from §11's API-boundary idempotency surface), the synchronous-vs-asynchronous read-model classification rule (per ADR-0005), the per-event-type Zod schema boundary (per ADR-0008), and the events insertion helper. The seven-field `events.metadata` set lives at §3.7 and is canonical there per 3-A R2 — §7 references the set via §3.7 rather than restating it.

### §7.1 Events table column shape

Eight columns per ADR-0005 §5:

| Column | Type | Notes |
|---|---|---|
| `event_id` | `uuid` NOT NULL (composite PK with `created_at` per §7.2 partition constraint) | UUIDv7 per ADR-0016 D1; client-side-generated at handler entry; storage-layer dedupe primitive (see §7.3) |
| `event_type` | `text` NOT NULL | Discriminator; closed enum at the application layer; one Zod schema per value at `src/server/events/schemas.ts` |
| `aggregate_type` | `text` NOT NULL | Domain object the event concerns (`market`, `bet`, `comment`, `user`, `dharma_account`, `system`, `admin_session`, `image_upload`, `mod_action`) |
| `aggregate_id` | `uuid` NOT NULL | The primary key of the aggregate row this event belongs to |
| `payload` | `jsonb` NOT NULL | Per-event-type body; Zod-validated at insertion per §7.6 |
| `payload_version` | `smallint` NOT NULL | Migration cursor for payload-shape evolution within a stable `event_type` |
| `metadata` | `jsonb` NOT NULL | The seven-field set per §3.7 (`request_id`, `flow_id`, `user_id`, `actor_id`, `idempotency_key`, `ip`, `user_agent`) — the §17 observability tag set |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | Canonical chronological-sort column per ADR-0016 monotonicity caveat |

Drizzle declaration lives in `src/db/schema/events.ts` per ADR-0008 §4. The full DDL substance is owned by ADR-0005; §7.1 is the at-a-glance shape.

Postgres requires the partition column be part of any PK/UNIQUE constraint on a partitioned table. Per §7.2's `PARTITION BY RANGE (created_at)`, the storage-layer PRIMARY KEY is composite `(event_id, created_at)`. `event_id` remains the storage-idempotency dedupe primitive; `created_at` is supplied deterministically by the `insertEvent` helper per §7.3 (extracted from the UUIDv7 millisecond prefix so retries that reuse the same `event_id` also reuse the same `created_at`). This composite-PK shape is locked at SCAFFOLD.2 stratum 3.C apply-time; SPEC.2 v0.3-draft's earlier "PRIMARY KEY (event_id)" assertion in §7.1 + §7.3 is reconciled here.

### §7.2 Partitioning

`RANGE` partitioning on `created_at` per ADR-0005 §5. Twelve pre-created monthly partitions cover the full experiment window plus tail: `events_2026_05` through `events_2027_04`. Plus a DEFAULT partition that catches any row whose `created_at` falls outside the named partitions — an operational error condition by design.

**Sentry alarm on DEFAULT-partition writes** per §17 alarm 2. Any single insert into the DEFAULT partition fires the alarm; thresholds tune at HARDEN.* per §17.7. The DEFAULT partition exists as a backstop — without it, an out-of-range `created_at` would fail the insert with a partition routing error and break the originating transaction. With it, the insert succeeds and the operational alarm catches the misconfiguration.

Partition creation SQL ships as a hand-written raw migration: `drizzle/migrations/<NNNN>_events_partitioning.sql`. Adding a partition (e.g., extending past 2027-04) is a same-commit migration plus an updated DEFAULT partition rule; provisional file path under SCAFFOLD.2 per 3-A R4.

### §7.3 Storage-layer idempotency vs API-boundary idempotency

Two structurally distinct idempotency surfaces. Both consume the request's `idempotency_key` value but operate at different layers and on disjoint storage substrates.

**Storage-layer idempotency.** `(event_id, created_at)` is the composite primary key (per §7.1's partition-constraint note); insert uses `INSERT INTO events (...) VALUES (...) ON CONFLICT (event_id, created_at) DO NOTHING`. Re-inserting an event with the same `(event_id, created_at)` pair (e.g., a transaction retry that re-runs the events.insert) is a no-op — exactly-once event-row creation guaranteed by the composite PK constraint. The `event_id` is generated client-side via UUIDv7 at handler entry (per ADR-0016) and reused across retries within the same logical request. The `insertEvent` helper at `src/server/events/insert.ts` (ENGINE.6) supplies `created_at` deterministically from UUIDv7's millisecond prefix (the first 48 bits of the UUID, big-endian unix-ms) so retries that reuse the same `event_id` also reuse the same `created_at` — storage idempotency stands across retries.

**API-boundary idempotency.** §11 / ADR-0015's `Idempotency-Key` HTTP header (Route Handlers) and Server Action argument surface, with cache lookup against Upstash Redis on `idem:{user_id}:{key}` keys (user-scoped since ADR-0044, S-7 — was `idem:{key}` alone through S-7), body-fingerprint match, and 24-hour completed-response replay. Sits at handler entry, before any database work.

The two are orthogonal: a request that survives the API-boundary idempotency cache MAY still be retried at the database layer (e.g., the bet transaction wrapper retrying on SQLSTATE 40001 per ADR-0013); the storage-layer idempotency on `(event_id, created_at)` ensures the events row writes exactly once even across those retries. A reader who needs the API-boundary contract goes to §11; a reader who needs the storage-layer contract stays here.

**Durable receipt backstop — a third layer (AUDIT-FIX-B3 / ADR-0031).** AUDIT-FIX-B3 adds a **third, durable, per-request idempotency layer** beneath both of the above: the `bet_receipts` table (Bucket A; global UNIQUE on `idempotency_key`; written as the last write inside the W-1 bet/sell transaction). It is distinct from both — the events composite-PK storage idempotency (this section) dedupes an *events row* within a retry, and the Redis API-boundary cache (§11) dedupes a *request* across a 24-hour window — whereas the receipt is the durable backstop that makes the **comment-free sell** idempotent across a Redis-lost window, which the events `ON CONFLICT (event_id, created_at) DO NOTHING` cannot: DO NOTHING would silently skip the duplicate event row while the money-moving writes (proceeds credit, position decrement) still commit (a silent double-proceed). A receipt replay 23505s on the global UNIQUE and rolls the whole transaction back. See §11 + ADR-0031.

### §7.4 Synchronous vs asynchronous read-model classification rule

Per ADR-0005's read-model rule: a read-model updates synchronously inside the originating transaction iff the originating flow's correctness depends on the updated read-model state; asynchronously otherwise. Pattern A maintenance (synchronous current-state writes alongside the events row in the same transaction) is the v1 default for everything that satisfies the correctness condition.

**Synchronous targets — thirteen tables plus the events row itself:**

`pools`, `positions`, `bets`, `comments`, `dharma_ledger`, `payout_events`, `resolution_events`, `markets`, `mod_actions`, `admin_events`, `user_events`, `users`, `identity_pool` — each updated inside the originating transaction whenever an events-row write affects it. Plus the `events` row itself, which is the canonical write that the synchronous current-state writes ride alongside.

**Asynchronous targets — none in v1.**

Every state-mutating data flow updates its read-models synchronously inside the originating transaction. The K_eff dashboard async target named in earlier outlines is struck per PRECURSOR.2-B D4 (2026-05-08); there is no `k_eff_dashboard` materialised view, no async refresh, no `pg_cron` `REFRESH MATERIALIZED VIEW CONCURRENTLY` job. K_eff(t) is derived post-hoc from the 2026-11-06 public dataset only (per §5.4 + §19.5). No other async read-model surfaces in v1.

**Read-time-computed (no projection table at all):** the debate-view ranking. Per **ADR-0017** + `RANKING.md`, the multi-mode model (Top + filter modes; replies stake-descending within side) runs against live `comments` + `bets` rows on every debate-view render, aggregating each post's reply-bets into the six per-side signals (`support_count_total`, `counter_count_total`, `support_count`, `counter_count`, `support_dharma`, `counter_dharma`) per §5.4. No `friendly_fire_events`, no materialised view, no cached score column on `comments`, no `ranking_snapshots`. Lane-aggregation index requirements are flagged for SCAFFOLD.2.

### §7.5 Sync-target write composition

When a state-mutating transaction touches more than one synchronous target, all writes happen in the same transaction in the §3 lock-order spine of the originating flow:

- **W-1 (bet flow)** writes `pools` + `positions` + `dharma_ledger` + `events` per §3.2 (lock-order chain), and for a **comment-bearing bet** (every post-bet and reply-bet) additionally inserts the `bets` + `comments` rows in the same transaction (INV-1 atomic bet+comment). The comment-free sell omits the comment row. The lock-order chain is four tables (`pools → positions → dharma_ledger → events`); `bets` and `comments` are Bucket-A appends within it.
- **W-2** — retired under reply-as-bet (no comment-without-bet path); comment and reply writes run W-1. The v1.8.x `positions → comments → events` comment-only chain no longer exists.
- **W-3 (resolution flow)** writes `markets` + `bets` + `payout_events` + `resolution_events` + `dharma_ledger` + `events` per §3.6 — six write tables across the per-bet fan-out.
- **F-AUTH-3 + F-AUTH-4** signup writes per §3.5 hit `identity_pool` + `users` + `events` (F-AUTH-3) and `users` + `dharma_ledger` + `events` (F-AUTH-4).
- **F-MOD-* moderation actions** write `mod_actions` + (optionally) `comments`, `bets`, `users` (Track A side effects) + `events`.

The events row is always terminal in the lock-order chain per ADR-0005 convention. The CI-lint rule named in §3.7 (every state-mutating handler MUST contain at least one `insertEvent(...)` call inside its `db.transaction(...)` body) enforces the discipline at the codebase level.

### §7.5.1 V3 carve-out for `user.signed_out`

V3 (synchronous emission in the originating transaction) holds across all in-house mutation paths. One carve-out: when an upstream library (Better Auth `signOut`) owns the originating mutation and does not expose an after-hook for events emission, the events row may be emitted in a separate post-commit transaction. Audit-trail gap between the mutation and the emission (process-crash window) is accepted iff the upstream mutation is idempotent.

`user.signed_out` emits post-Better-Auth-mutation in a new transaction. Atomicity guarantee weaker than other event_types: a process crash between Better Auth's `signOut` and our `insertEvent` call leaves a session-deleted-with-no-event-row state. The orphan is undetectable. Operational tradeoff accepted because (a) session deletion is itself idempotent — the user can log in again — and (b) the audit-trail gap for a single crashed logout has no consequence beyond a missing log entry.

This carve-out class has two sub-cases. **Sub-case (a)** — the upstream mutation exposes *no* after-hook at all — is the `user.signed_out` case above (`src/server/auth/logout.ts`). **Sub-case (b)** — the upstream mutation exposes *only* a post-commit after-hook (no in-transaction seam) — applies to the three participant sign-in / signup emits below: Better Auth 1.6.11's `databaseHooks.session.create.after` and `databaseHooks.user.create.after` are drained post-commit via `queueAfterTransactionHook` (never inside the originating transaction), so an in-transaction emit is impossible for them. Both sub-cases emit in a separate post-commit transaction; adding a carve-out is a same-commit amendment to this subsection plus a corresponding code-level justification in the relevant handler docstring.

**Sub-case (b) — participant sign-in / pseudonym-assignment emits (`user.oauth_signed_in`, `user.otp_signed_in`, `user.pseudonym_assigned`).** Each emits in a post-commit micro-transaction: `user.oauth_signed_in` and `user.otp_signed_in` at the `databaseHooks.session.create.after` seam; `user.pseudonym_assigned` at the `databaseHooks.user.create.after` seam (the only seam where the created `users.id` is available). Encoding per §8.8: `metadata.user_id = metadata.actor_id = users.id` (self-actor).

*Fabrication guard (verify-then-emit) — mandatory, and stricter than `user.signed_out`.* Better Auth 1.6.11 drains a queued after-hook **even when the wrapped transaction threw and rolled back** (`@better-auth/core`'s `runWithTransaction` captures the error, runs the pending hooks, then rethrows). A naive emit at these seams would therefore write an `events` row for a `users` / `sessions` row that never committed — a *fabricated* entry on the canonical audit log. Each of these three emits MUST first verify the originating row committed: an indexed `SELECT` by id on the mutated entity (`sessions` for the sign-in emits, `users` for the pseudonym emit) inside the post-commit transaction, emitting only if the row is present. This is a stronger bar than `user.signed_out`, whose failure mode is a benign missing entry; here the failure mode is fabrication, which is unacceptable for the G3 dataset. The residual crash-window (a crash after the upstream commit but before the emit) is tolerated exactly as for `user.signed_out` — a benign missing entry, no fabrication.

### §7.6 drizzle-zod vs hand-written per-event-type Zod boundary

Per ADR-0008 §6.2, Drizzle's drizzle-zod helper auto-derives row-shape schemas from table definitions and serves API-boundary input validation for `users`, `markets`, `comments`, `bets`, etc. — *not* `events.payload`. The events payload is a typed union over all event types in the experiment, and its shape is per-event-type rather than per-table; drizzle-zod cannot auto-derive it.

The per-event-type Zod schemas live at `src/server/events/schemas.ts` as a hand-written `Map<EventType, ZodSchema>`. Every `event_type` value in the closed enum has exactly one schema entry. The events insertion helper at §7.7 looks up the schema by `event_type` and validates `payload` before issuing the INSERT; a payload that fails validation is a runtime error, not a silent insert.

This is the only place in the codebase where Drizzle's typegen and the runtime validator are deliberately separated. Every other DB row uses drizzle-zod throughout.

### §7.7 Events insertion helper

`src/server/events/insert.ts` exposes a single function:

```ts
async function insertEvent(tx: Transaction, eventInput: EventInput): Promise<void>
```

Three locked properties per ADR-0008 §6.2:

1. **Bound-transaction-only.** The function takes a `Transaction` (not the top-level `db` client) and runs INSERT against it. Calling `insertEvent(db, ...)` is a TypeScript compile error. This guarantees the events write is inside the originating transaction by construction.
2. **Zod-validates payload.** The function looks up the per-event-type schema (per §7.6), validates `eventInput.payload`, and throws on mismatch before issuing SQL. Validation runs synchronously and adds microsecond-scale overhead; mismatches are application bugs, not data hazards.
3. **`sql\`...\`` template.** The actual INSERT uses Drizzle's `sql\`INSERT INTO events (...) VALUES (...) ON CONFLICT (event_id, created_at) DO NOTHING\`` template per the events-insert pattern locked in ADR-0008 §6.2. Hand-written SQL beats query-builder composition here because the storage-idempotency `ON CONFLICT (event_id, created_at) DO NOTHING` clause (composite per §7.1 partition-constraint reconciliation) is the load-bearing primitive — a Drizzle-builder version would obscure it.

The `event_id` is supplied by the caller (handler entry generates it via `uuidv7()` from the npm `uuid` package per ADR-0016). The helper does not generate UUIDs internally — keeps the call site authoritative for retry-correlation.

### §7 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Events table schema declaration | `src/db/schema/events.ts` |
| Events monthly partitioning DDL | `drizzle/migrations/<NNNN>_events_partitioning.sql` |
| Per-event-type Zod schema map | `src/server/events/schemas.ts` |
| Events insertion helper | `src/server/events/insert.ts` |
| Events-emit CI lint rule | HARDEN.* (per §3.7's CI-lint enforcement clause) |
| Sentry alarm 2 catalogue row (DEFAULT-partition writes) | §17.2 master table |

ADRs consumed by §7: ADR-0005 (Pattern A + events table column shape + monthly partitioning + storage-layer idempotency on `event_id` + synchronous read-model rule), ADR-0008 (drizzle-zod-vs-events-payload-Zod boundary + `sql\`...\``-template events insert + per-domain schema-file split + raw-SQL migration discipline), ADR-0016 (UUIDv7 PK on `event_id` + monotonicity caveat). 3-A R2 absorbs the seven-field metadata alignment to §3.7 canonical lock; PRECURSOR.2-B D4 absorbs the K_eff async-target strike. Cross-reference renumber from "ADR-0007 §4 alarm 2" to "§17 alarm 2" applied per 3-D R2.

---

## §8 Authentication & Sessions

§8 owns the *authentication and session contract* for the experiment-phase build — two structurally separate session systems running in parallel on the same Next.js + Postgres + Drizzle stack, with cookie names + session tables + auth methods + identity FKs structurally disjoint, and with the load-bearing session-deferral hook that gates participant cookie issuance on pseudonym + ToS acceptance. SPEC.1 §13 owns the per-flow product behaviour for F-AUTH-1 / F-AUTH-2 / F-AUTH-3 / F-AUTH-4 / F-AUTH-5 / F-AUTH-ADMIN; ADR-0004 owns Better Auth participant-path substance; ADR-0010 owns hand-rolled admin-path substance; ADR-0011 owns pseudonym pool consumption at F-AUTH-3; ADR-0016 D6 owns the URL-exposure rule on auth surfaces. §8 sits above all of them at the contract layer, naming what is structurally enforced vs what is library-mediated.

### §8.1 Two parallel session systems

Eight contract dimensions. Every row is a structural disjointness invariant — a participant credential cannot authenticate any admin surface and an admin credential cannot authenticate any participant surface, by data-model construction (not by runtime check).

| Dimension | Participant | Admin |
|---|---|---|
| Library | Better Auth + Drizzle adapter | Hand-rolled |
| Session table | `sessions` (Bucket C, mutable) | `admin_sessions` (Bucket C, mutable) |
| Cookie name | `zugzwang_session` | `zugzwang_admin_session` |
| Cookie path | `/` (default) | `/admin` |
| Strategy | Database session (server-side row, server-side validation) | Database session (server-side row, server-side validation) |
| Identity FK | `sessions.userId` → `users.id` | `admin_sessions.session_id` PK only — NO FK to `users` |
| Session row id | UUIDv7 + Better Auth-issued `session.token` 32-char random | UUIDv7 PK only |
| Auth method | F-AUTH-1 (Google OAuth) or F-AUTH-2 (Email + OTP) | F-AUTH-ADMIN (`ADMIN_PASSWORD` env var via `crypto.timingSafeEqual`) |
| Session end | F-AUTH-5 logout deletes `sessions` row + clears cookie | Manual logout deletes `admin_sessions` row + clears cookie; suspected-compromise rotation per `BREAK_GLASS.md` |

The seven-pillar structural-separation rule (§8.7) compresses these dimensions into the load-bearing invariants downstream code must honor.

### §8.2 Better Auth wiring

Participant authentication runs on Better Auth pinned at version 1.6.x in `package.json`. The instance is the single source of truth at `src/server/auth/index.ts`; mounted route handlers at `src/app/api/auth/[...all]/route.ts` per ADR-0004.

**Provider configuration.** `socialProviders.google` carries Google OAuth scopes `openid email profile`; the F-AUTH-1 callback enforces `email_verified === true` per ADR-0004 §1 — accounts where the Google identity has not verified email are rejected at signup with `oauth_email_not_verified`. The Email-OTP plugin from `better-auth/plugins` is wired with a `sendVerificationOTP` callback to Resend; OTPs are 6-digit numeric (plugin default), persisted in the `verifications` table through the Drizzle adapter, single-use enforced by the plugin, TTL deferred to HARDEN.6 number-tuning.

**Cloudflare Turnstile.** Wired via `hooks.before` middleware on the `/email-otp/send-verification-otp` Better Auth path per ADR-0004 §4 + §18.2. The hook calls Cloudflare's siteverify endpoint with the client-submitted Turnstile token; failure rejects the OTP request with `turnstile_failed` (HTTP 400) and never invokes Resend. Turnstile fail-mode is fail-closed, mirroring §11 idempotency. It does **not** mirror §10 — moderation is advisory and fails neither way (ADR-0046). It is asymmetric to §17.5's observability fail-open, and the consent surface it protects is §18.2's.

**Session lifetime.** Session cookies are capped at 400 days — the hard maximum enforced by both the cookie-serialization layer (better-call) and modern browsers (Chrome 104+ clamp Max-Age/Expires to 400 days). The earlier `ONE_HUNDRED_YEARS_SEC` ("indefinite") value is removed: it was never achievable (browsers clamp client-side regardless) and exceeded better-call's serialization cap, throwing a 500 on cookie issuance for onboarded/returning users. For the experiment's ~51-day live window a 400-day session is sufficient; session refresh stays disabled (`disableSessionRefresh: true`). Truly indefinite sessions (long-lived `sessions` row + per-visit cookie re-issue) are out of scope for the experiment. Independently of the cap, expiry is enforced at read time: `auth.api.getSession` rejects a session whose `sessions.expires_at` is in the past (`expiresAt < now()` → treated as no session), so an expired cookie is never honored.

**UUIDv7 override across all four Better Auth tables.** Better Auth's default 32-character base62 random `id` format is overridden via `advanced.database.generateId: () => uuidv7()` in `src/server/auth/index.ts`. The Drizzle schemas at `src/db/schema/auth.ts` declare `id` as `uuid` with the standard `default(sql\`uuidv7()\`)` clause. Applies to all four Better Auth tables: `users`, `sessions`, `accounts`, `verifications` (per 3-A R1 — `accounts` is the fourth Better Auth table, in the §5.1 inventory at row 16). The `session.token` field — Better Auth's separate 32-char random session-cookie value used as the cookie payload — is **untouched** by this contract; only the row's `id` PK is affected.

### §8.3 Session-deferral hook

The load-bearing construction-layer protection of INV-3 (comments side-bound at post time) and INV-4 (append-only resolutions). Server-side `sessions`-row creation MUST be gated on pseudonym assignment AND ToS acceptance — the participant cookie cannot issue before both `users.pseudonym IS NOT NULL` AND `users.tos_accepted_at IS NOT NULL`.

The mechanism is `databaseHooks.session.create.before` in the Better Auth config per ADR-0004:

```ts
databaseHooks: {
  session: {
    create: {
      before: async (session) => {
        const u = await db.query.users.findFirst({
          where: eq(users.id, session.userId),
          columns: { pseudonym: true, tosAcceptedAt: true },
        });
        if (!u?.pseudonym || !u?.tosAcceptedAt) {
          throw new APIError("FORBIDDEN", { message: "ONBOARDING_REQUIRED" });
        }
        return { data: session };
      },
    },
  },
},
```

**Full-onboarding-loop semantics** per §3.5. F-AUTH-1 / F-AUTH-2 callback completes; the hook intercepts before the session row is written; the hook reads `users.pseudonym` and `users.tos_accepted_at` for the `session.userId`. If either is NULL, the hook throws `APIError("FORBIDDEN", { message: "ONBOARDING_REQUIRED" })` — the user record and OAuth-account row are preserved on rejection; no `sessions` row is written and no cookie is issued. The auth flow routes to F-AUTH-3 (pseudonym assignment: `identity_pool` consumption folded into Better Auth's `user.create.before` hook, with Better Auth owning the subsequent `users` insert — per §3.5) or F-AUTH-4 (ToS acceptance evidence write to mutable `users` columns) before the session-create re-attempts and succeeds.

**Cancellation safety.** F-AUTH-3 completes the `identity_pool.assigned_at` whitelisted Bucket-B transition (in the `user.create.before` hook) and Better Auth writes the `users` row with pseudonym set, tos_accepted_at NULL. If the user cancels at the F-AUTH-4 ToS step, the next sign-in attempt re-evaluates the hook against current column state — pseudonym is non-NULL, tos_accepted_at is still NULL, so the hook routes back to F-AUTH-4 only. Pseudonym is NOT re-consumed (no double pool consumption); the hook is idempotent with respect to retried sign-ins.

The hook is the construction-layer protection of B5 (admin not a participant), INV-3, and INV-4 because no participant cookie can grant authority to write to `bets` or `comments` tables before pseudonym + ToS are both set; a participant who tried to comment before completing onboarding has no session and is rejected at the auth gate (handler stack step 1 per §3.1), not at the comment-flow business logic.

### §8.4 Admin auth path

Hand-rolled per ADR-0010. Four-step Server Action sequence at `src/server/auth/admin/login.ts` (SCAFFOLD.3 Q1 amendment: Turnstile dropped per SPEC.1 §13 line 609 — "No CAPTCHA on F-AUTH-ADMIN (per-IP rate limit … is the brute-force guard for a single-user admin path)". Per-IP rate limit + identical-401 + transactional replace + indefinite cookie remain sufficient brute-force protection for a single-user admin path):

1. **HMAC-SHA256 digest comparison** via `crypto.timingSafeEqual` over equal-length 32-byte buffers. `createHmac(BETTER_AUTH_SECRET).update(input).digest()` on both submitted and env values so the comparison never throws `RangeError` on different-length inputs (which would itself leak password length).
2. **Run-and-discard timing parity** — on password mismatch, the action still issues a dummy database round-trip + a constant-time delay before returning. This prevents an information-leak side-channel where wrong-password responses are systematically faster than rate-limit-exceeded responses.
3. **Transactional `DELETE FROM admin_sessions; INSERT INTO admin_sessions (...) RETURNING session_id;`** in a single Postgres transaction. Maintains the single-row-at-any-moment invariant without a UNIQUE constraint — no concurrent admin login can produce two rows because the DELETE precedes the INSERT in the same transaction; wraparound is impossible.
4. **Issue cookie** with name `zugzwang_admin_session`, attributes `HttpOnly + Secure + SameSite=Lax + Path=/admin + indefinite Max-Age` per ADR-0010 + §8.5.

**Two-layer middleware-plus-validator pattern.** Admin trust is checked at TWO places per CVE-2025-29927 defense-in-depth + AGENTS.md §5:

- **Layer 1 (UX, bypassable).** Next.js middleware at `proxy.ts` redirects unauthenticated `/admin/*` requests to `/admin/login`. Layer 1 exists only for the redirect UX; it MUST NOT be the security boundary because middleware is bypassable in some deployment configurations (CVE-2025-29927 documented the bypass class).
- **Layer 2 (security boundary, non-bypassable).** Every admin Server Action and admin Route Handler validates `admin_sessions` independently at handler entry via `src/server/auth/admin/validate.ts`. A request that bypasses middleware reaches the handler and is rejected at Layer 2; a request that passes middleware but mutates an `admin_sessions` row mid-request is re-validated at the handler boundary.

**Identical-401 information-leak avoidance.** Both wrong-password (step 2) and rate-limit-exceeded responses return HTTP 401 with `error_code: admin_login_invalid` — no distinct codes, no distinguishable response time, no Retry-After header. This forecloses an enumeration attack that could probe whether `ADMIN_PASSWORD` is the failing predicate vs the rate limit. Per-IP rate limit `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR` per SPEC.1 §16.1 caps brute-force attempts.

**Three-column `admin_sessions` schema** per ADR-0010: `session_id UUID PK`, `issued_at TIMESTAMPTZ NOT NULL`, `last_seen_at TIMESTAMPTZ NOT NULL`. The prior `admin_email` column was dropped because static-password auth makes per-admin identity vacuous — there is no "which admin signed in" distinction, only "the admin signed in." `admin_sessions` is **Bucket C** (mutable; `last_seen_at` updates on each request); the immutable audit trail of admin actions lives in `admin_events` (Bucket A) per §5.1 row 8.

### §8.5 Cookie attribute table

Side-by-side per surface. All cookies are session cookies in the security sense; the "indefinite" lifetime refers to the absence of client-side expiry. ⚠ **This read "validated server-side every request" and ADR-0057 makes that false for the participant session.** Better Auth now serves the session payload from its signed session-data cookie for up to `SESSION_COOKIE_CACHE_MAX_AGE_SEC` (300 s) before returning to Postgres, because without it every `getSession()` — and therefore every page view by a signed-in reader — was a database round trip on surfaces the CDN work had just made free for everyone else. The cookie is still SIGNED and still server-verified; what is cached is the lookup, not the trust. **What the window costs is chrome, never action:** a session revoked server-side keeps RENDERING as signed-in until the cached copy expires, while every write re-reads the user row inside the request (next paragraph).

| Attribute | `zugzwang_session` (participant) | `zugzwang_admin_session` (admin) |
|---|---|---|
| `HttpOnly` | true | true |
| `Secure` | true | true |
| `SameSite` | `Lax` | `Lax` |
| `Path` | `/` (default) | `/admin` |
| `Max-Age` | indefinite (no client-side ceiling) | indefinite (no client-side ceiling) |
| `Domain` | not set (host-only) | not set (host-only) |
| Cookie value | Better Auth-issued `session.token` (32-char random) | UUIDv7 `session_id` |

The cookie naming asymmetry is the data-model construction backing B5: a single browser cannot present both cookies simultaneously *to the same path scope* — `/admin` requests carry only the admin cookie path-matched; non-`/admin` requests carry only the participant cookie path-matched. `/admin/*` Server Actions and Route Handlers therefore see only the admin cookie at the auth gate.

### §8.6 F-AUTH-5 logout

**Two endpoints, no cross-type logout.** F-AUTH-5 logout is per-cookie-type:

- **Participant logout.** Server Action `logout()` at `src/server/auth/logout.ts` calls `auth.api.signOut({ headers })` (Better Auth) which deletes the server-side `sessions` row and clears the `zugzwang_session` cookie. Returns the user to the public homepage.
- **Admin logout.** Server Action at `src/server/auth/admin/logout.ts` deletes the `admin_sessions` row (transactional `DELETE`; not paired with an INSERT this time) and clears the `zugzwang_admin_session` cookie. Returns to `/admin/login`.

A user holding both cookies (hypothetical — B5 forbids the admin from also being a participant; the case exists only during admin-rotation testing) presents two distinct sessions to two distinct subsystems. Logging out of one does NOT log out of the other; the two sessions are independent.

**Ban is request-time enforcement, not logout.** A banned participant's `sessions` row is NOT deleted at the moment of ban; the ban is enforced at the next request via `users.banned_at IS NOT NULL` check at the Server Action / Route Handler entry. This is deliberate — pre-ban audit trail is preserved. ⛔ **The check is a SEPARATE `users` read inside the handler, not a property of the session.** This sentence read *"the ban-enforcement check rides on the same `auth.api.getSession` call that already runs at every handler entry"*, which never described the built code — `runBetEndpoint` issues its own `db.query.users.findFirst` for `banned_at` (plus pseudonym/tos) before anything else — and ADR-0057 makes the distinction load-bearing rather than merely inaccurate: with the session served from a cookie for up to 300 s, a ban enforced *through the session* would lag by that window. It does not, because the read is its own. **There is exactly one ban gate in the tree and it is that read**; every other `banned_at` site is an admin display or the ban write itself. `tests/unit/auth/session-cookie-cache.test.ts` pins the pair together, so removing the re-read reddens beside the cache that depends on it. Track A automatic ban (per ADR-0014 (superseded by ADR-0046) + SPEC.1 §14 F-MOD-1) and Track B admin manual ban (per F-ADMIN-4) both write `users.banned_at`; neither deletes `sessions` rows.

### §8.7 Structural-separation rule (seven pillars)

The seven invariants by which admin authority and participant authority are structurally non-overlapping at the data-model layer. This is the load-bearing security control in v1 per §18.4 — sybil resistance via *construction*, not via runtime check.

1. **`users` table carries no `role` column.** Admin is not a privileged user account; admin is structurally outside the `users` graph. There is no row in `users` with `role = 'admin'`.
2. **Admin has no `users` row.** The admin actor is encoded at events-row write time (`metadata.user_id = NULL`, `metadata.actor_id = 'admin-singleton'` per §3.6 + §8.8) — there is no participant identity to map.
3. **Two distinct cookie names.** `zugzwang_session` and `zugzwang_admin_session` are non-overlapping on path scope (`/` vs `/admin`); no surface ever validates one cookie type when checking the other.
4. **Two distinct session tables.** `sessions` (participant, Better Auth-managed) and `admin_sessions` (admin, hand-rolled) share no FK relationship and no read path.
5. **`admin_sessions` has no FK to `users`.** Even at the schema level, admin sessions cannot reference participant identities; the orphaned-table-by-design property is enforced by absence of FK.
6. **Cross-cookie-type access is never authorized.** Admin Server Actions and admin Route Handlers validate `admin_sessions` only; participant Server Actions and participant Route Handlers validate `sessions` only. A request holding only the participant cookie that targets an admin Server Action is rejected with `admin_session_required` at handler entry; the reverse is rejected with `participant_session_required`.
7. **Inline admin affordances on public pages call the admin validator at the backend endpoint.** When admin-only UI elements appear inline on a page also viewed by participants (e.g., a "Resolve" button on a market detail page that the market creator sees), the *frontend rendering* may conditionally show the affordance based on a public flag, but the *backend Server Action* the affordance invokes ALWAYS validates `admin_sessions` independently — never relies on the rendering decision having been correct.

The seven pillars are the construction-layer protection of B5. §18.4 promotes this rule to a six-property summary in §18 prose; §8.7 carries the full enumeration here for the auth contract reader.

### §8.8 Events-row writes for auth flows

Auth-flow events emit to specific audit tables per SPEC.1 §15 lock. The encoding distinguishes participant-actor flows from admin-actor flows at the events-metadata level:

All auth-flow event_types route to the unified `events` table per ADR-0005 §4 + §7. The legacy `user_events` + `admin_events` Drizzle tables in `src/db/schema/audit.ts` are retained for future stratum use (mod-action audit subdivision per F-MOD-*, dedicated admin audit search per F-ADMIN-5) but are NOT written by ENGINE.6's auth-flow emit sites. Participant vs admin distinction is preserved entirely at the metadata level (`metadata.user_id` + `metadata.actor_id`) per §3.6 — the unified-table choice doesn't dilute the actor encoding.

**Participant auth flows (F-AUTH-1, F-AUTH-2, F-AUTH-3, F-AUTH-4, F-AUTH-5).** Events rows emit to `events` (Bucket A) with `metadata.user_id = users.id` and `metadata.actor_id = users.id` (self-actor). Event types: `user.oauth_signed_in`, `user.otp_signed_in`, `user.pseudonym_assigned`, `user.tos_accepted`, `user.signed_out`. The actor IS the user; the metadata encoding makes participant rows filterable at dataset-export time.

**Admin auth flow (F-AUTH-ADMIN + F-AUTH-5-ADMIN).** Events row emits to `events` (Bucket A) with `metadata.user_id = NULL` and `metadata.actor_id = 'admin-singleton'`. Event types: `admin.signed_in`, `admin.signed_out`. Both carry `aggregate_type = 'admin_session'` with `aggregate_id = admin_sessions.session_id` (the row created at login, deleted at logout — captured via `RETURNING session_id` at login and via the cookie value at logout). The metadata encoding signals to downstream consumers (dataset-export pipeline at §19, audit search at F-ADMIN-5, observability tag set at §17) that the row is admin-actor — there is no pseudonym to map for the public dataset; admin rows pass through without pseudonymization per §3.6.

**The session tables themselves are NOT append-only.** `sessions` and `admin_sessions` are Bucket C — they update (`last_seen_at`) and delete (logout) routinely. Only the auth-flow *outcomes* are events; the session-row lifecycle is mutable state.

### §8.9 URL-exposure rule on auth surfaces

Per ADR-0016 D6 + §16. Auth-surface routes follow the participant-vs-admin URL-exposure asymmetry:

- **Participant routes use pseudonym slugs.** `/profile/<pseudonym>` (not `/profile/<users.id>`). Comment permalinks reference natural ordering or server-rendered short IDs (not raw `comments.id`). The acceptance test `id::raw-uuid-not-in-participant-urls` at `tests/server/identity/no-raw-uuid-in-urls.test.ts` regex-asserts no participant-facing route file accepts a raw UUID as a path parameter.
- **Admin routes MAY carry raw UUIDs.** `/admin/users/<user_id>`, `/admin/markets/<market_id>` — operator ergonomics during moderation outweigh the URL-aesthetic concern, and admin surfaces are never indexed or shared. Raw UUIDs in admin URLs are explicitly permitted.
- **Dataset release uses raw UUIDs.** The 2026-11-06 public-dataset release carries raw `users.id`, `markets.id`, `comments.id` as join keys per SPEC.1 §12.2 — raw UUIDs are the correct join primitive for offline analysis. Pseudonymization happens at export-time JOIN per §19.3.

The asymmetry is enforced at the route-handler-file level, not the URL parser. SCAFFOLD.* implements `tests/server/identity/no-raw-uuid-in-urls.test.ts` at the implementation pass.

### §8 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Better Auth instance + plugins + databaseHooks + cookie config | `src/server/auth/index.ts` |
| Resend `sendVerificationOTP` callback body | `src/server/auth/email-otp.ts` |
| Session-deferral hook (pseudonym + ToS gate) | `src/server/auth/session-gate.ts` (re-exported into `index.ts`) |
| Better Auth catch-all route handlers | `src/app/api/auth/[...all]/route.ts` |
| Better Auth + plugin version pins | `package.json` |
| Drizzle schema for `users`, `sessions`, `accounts`, `verifications`, `admin_sessions` | `src/db/schema/auth.ts` (per ADR-0008 §4 — single auth-domain file spanning ADR-0004 + ADR-0010 ownerships) |
| Admin login Server Action | `src/server/auth/admin/login.ts` |
| Admin logout Server Action | `src/server/auth/admin/logout.ts` |
| Admin session validator (Layer 2 security boundary) | `src/server/auth/admin/validate.ts` |
| Participant logout Server Action | `src/server/auth/logout.ts` |
| Middleware (Layer 1 redirect UX, NOT security boundary) | `proxy.ts` (formerly `middleware.ts`) at repo root |
| Acceptance test for raw-UUID-not-in-participant-URLs | `tests/server/identity/no-raw-uuid-in-urls.test.ts` |
| `BREAK_GLASS.md` admin-rotation procedure (suspected-compromise + scheduled rotation) | `docs/runbooks/BREAK_GLASS.md` (HARDEN.10-owned per ADR-0010) |

ADRs consumed by §8: ADR-0004 (Better Auth library + Drizzle adapter + database session strategy + session-deferral hook + Email-OTP plugin + Cloudflare Turnstile via `hooks.before` + cookie naming + UUIDv7 generateId override), ADR-0010 (hand-rolled admin auth + static-password timing-safe comparison + transactional DELETE+INSERT + two-layer defense-in-depth per CVE-2025-29927 + identical-401 information-leak avoidance + three-column `admin_sessions` schema + `BREAK_GLASS.md` rotation), ADR-0011 (pseudonym pool consumption at F-AUTH-3 transaction within `identity_pool` Bucket-B `assigned_at` whitelisted transition), ADR-0014 (auth gate as first step of every state-mutating handler — handler-stack step 1 per §3.1), ADR-0016 D4 (UUIDv7 column-type override across all four Better Auth tables) + D6 (URL-exposure rule on participant vs admin vs dataset routes). 3-A R1 absorbs `accounts` as fourth Better Auth table in §5.1; 3-A R2 + §3.7 provides canonical seven-field `events.metadata` set consumed by §8.8 auth-flow writes.

---

## §9 Concurrency & Transactions (D2 ratified by ADR-0013)

The bet handler runs as a single Postgres SERIALIZABLE transaction. The pool row is locked pessimistically via `SELECT … FOR NO KEY UPDATE` — NOT `FOR UPDATE`. The distinction is operationally significant: `FOR UPDATE` conflicts with `FOR KEY SHARE` (the lock taken implicitly by Postgres on a parent row when a child INSERT validates its FK), which would block every concurrent `INSERT INTO positions / bets / comments` against the same market for the duration of every in-flight bet. `FOR NO KEY UPDATE` does not. The bet handler never modifies `pools.id` or any FK-target column, so the weaker lock is correct. Verified against the Postgres 17 row-level lock conflict matrix (https://www.postgresql.org/docs/17/explicit-locking.html, §13.3.2, Table 13.3).

**Canonical lock order**, applied uniformly across every bet — F-BET-1 / F-BET-2 / F-BET-3 / F-COMMENT-1 / F-COMMENT-2 / F-COMMENT-3 — never reordered, only subset-skipped:

```
pools → positions → dharma_ledger → events
```

`events` is terminal in the chain per ADR-0005's read-model classification convention, with all per-user writes (`positions`, `dharma_ledger`) co-located ahead of it. For a **comment-bearing bet** (every post-bet and reply-bet under reply-as-bet), the `bets` and `comments` rows are Bucket-A appends inserted **within** this transaction (INV-1 atomic bet+comment) — they are not additional lock points (no `SELECT … FOR …` is taken on them), so they do not change the lock-order spine. The comment-free sell (F-BET-3) omits the `comments` insert. AUDIT-FIX-B3 / ADR-0031 adds a further Bucket-A append inside this transaction — the `bet_receipts` row, written **last** (after the pools update) by both `place()` and `sell()`; like `bets`/`comments` it is an INSERT, not a lock point, so the lock-order spine is unchanged. Its global UNIQUE on `idempotency_key` provides once-only semantics across a Redis-lost + retry window: a replay that reaches execute 23505s and rolls the whole transaction back (no double proceeds), while the durable pre-check (§11) short-circuits the replay before execute in the common case.

**Retry policy**: full jitter on bases **[50, 100, 200, 400, 800] ms, 5-retry budget** for **W-1** (ADR-0056); **[50, 100, 200], 3-retry** for W-3 and W-4. Retry on SQLSTATE 40001 (`serialization_failure`) AND 40P01 (`deadlock_detected`). ⚠ W-1's budget was widened on a MEASUREMENT, never an estimate (ADR-0038 decision 2): a barrier-released storm onto one pool row refused ~10% of writers at 48–64 concurrent under three retries and **none** under five, which established that the refusal was the budget expiring rather than Postgres failing. The harness is committed at `tests/scale/write-ceiling-sweep.scale.test.ts`; re-run it before this number moves again. Wait formula `wait_ms = floor(random_uniform(0, base_ms[n]))` per Marc Brooker, *"Exponential Backoff And Jitter"*, AWS Architecture Blog, 4 Mar 2015 (https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/). Application errors (validation, slippage, FK violations not caused by 40P01) are NOT retried.

**Observability**: Sentry `addBreadcrumb` per retry attempt (O(1) wire cost, rides alongside any subsequent Sentry event in the same scope); Sentry `captureMessage` only on terminal exhaustion firing alarm 3 (per §17 alarm 3) tagged `bet_serialization_exhausted` with the SQLSTATE and the originating flow (F-BET-1 / F-BET-2 / F-BET-3).

**Idempotency-key cache lookup is the FIRST authenticated step in every bet handler** — before the SERIALIZABLE transaction opens, before the pool lock is acquired. Cache hit (completed entry) returns the cached `(status, body)` and exits the handler; no OpenAI call, no Postgres transaction. This protects against non-deterministic OpenAI moderation re-runs on completed-but-network-dropped bets and bounds OpenAI cost by unique requests, not retry count. Storage substrate, key envelope, body-hash discipline, lock-vs-result TTL split, and error-envelope shapes for in-flight and body-mismatch cases are ratified in ADR-0015 (SPEC.16) and substantively absorbed at §11 — Redis SETNX-with-pending-sentinel substrate, global key scoping, RFC 8785 canonical-JSON full-body SHA-256 fingerprint, 30-second pending TTL + 24-hour completed-response TTL, HTTP 409 with `error_idempotency_key_reused` for body-mismatch, HTTP 409 with `error_idempotency_in_flight + Retry-After: 2` for in-flight collision.

**OpenAI moderation runs after this transaction commits, never inside it** (per §10 + ADR-0014 — superseded by ADR-0046). The bet transaction wrapper is moderation-unaware; under reply-as-bet every comment-bearing bet (F-BET-1, F-BET-2, F-COMMENT-1/2/3) dispatches moderation after the wrapper commits, and the comment-free sell F-BET-3 skips it. Holding a Postgres transaction open across the 200–2000 ms moderation HTTP call is a `REFUSAL:`.

**Retry exhaustion response shape**: HTTP 503 with `error_code: bet_serialization_exhausted`, `error_type: temporary_unavailable`, `Retry-After: 1`. Distinct from F-BET-5 (HTTP 400 `market_closed_at`) and F-BET-6 (HTTP 400 `in_flight_timeout`). Lands in §15.4's catalogue.

**Single source of truth**: the bet transaction wrapper at `src/server/bets/transaction.ts` exposes a single helper that opens the SERIALIZABLE transaction, acquires the pool-row lock via Drizzle's `.for('no key update')` (per ADR-0008), runs the per-flow callback containing the lock-order chain, applies the retry policy (`BACKOFF_BASES_MS`, `RETRYABLE_SQLSTATES` co-located with the wrapper as decision parameters of ADR-0013, NOT tunables), and emits the alarm-3 custom event on terminal exhaustion. ENGINE.7 implements (Ultrathink mandatory).

---

## §10 Moderation Contract

> **[Rebuilt at 2.0.0 per D-30. ADR-0046 (2026-09-06) supersedes ADR-0014's pre-commit gate architecture: moderation is advisory. ADR-0021's reactive-review consequence stands. The vendor, the category routing, the multimodal call shape, the write-once binding and the `no-transaction-across-an-HTTP-call` refusal are unchanged. `src/server/moderation/` still implements the superseded gate; MOD-1 is the conformance task.]**

**Moderation is advisory. No post is ever blocked, no submission ever fails, no participant ever waits** (ADR-0046; D-20; SPEC.1 §14). The invariant, stated once and identically to SPEC.1 §14: *a post is never blocked by moderation, and an image is never served before it has been screened.* Both halves hold because the screening window is the composing window — an image is attached before the mandatory argument is written, so the check runs while the participant types and gates nothing.

Moderation runs on every comment-bearing bet: F-BET-1, F-BET-2, F-COMMENT-1, F-COMMENT-2, F-COMMENT-3. The comment-free sell (F-BET-3) carries no text and is not moderated. The flow is exposed as a single function in `src/server/moderation/precommit.ts` (name retained until MOD-1 renames it).

**Vendor selection.** OpenAI `omni-moderation-latest`, snapshot-pinned `omni-moderation-2024-09-26`, for text and multimodal classification — the **sole** moderation vendor for the experiment phase, free of charge per OpenAI's Help Center as of May 2026. No second image classifier ships in the experiment phase. The snapshot covers `violence` (including `violence/graphic`), `self-harm` (including `/intent` and `/instructions`) and `sexual` (non-minors) on image inputs natively. The `harassment`, `harassment/threatening`, `hate`, `hate/threatening`, `illicit`, `illicit/violent` and `sexual/minors` categories accept **text inputs only** on that snapshot. The six non-CSAM text-only categories are an accepted v1 image-input gap — a model limitation, not a design choice — mitigated by the admin's reactive removal on live content (SPEC.1 §15 F-ADMIN-4). `weapons` is not an OpenAI category at all; weapon-policy content relies on F-ADMIN-4 end to end. **PhotoDNA, Safer and Hive are parked** (`docs/parked.md`).

**Category routing.** SPEC.1 Appendix A is the per-category routing table and this section does not restate it. Two routings are load-bearing at the architecture layer because they are realised by predicate rather than by lookup:

- **LD-3 carve-out.** `sexual/minors === true` with no attached image routes to Track B: the text **publishes** and is flagged `sexual_minors_text_flagged` for the admin's reactive review, with no auto-ban. The category's false-positive rate on news, fiction and educational vectors is elevated, and the model scores it on text only. With an attached image the same flag routes to Track A.
- **A2 image-adult-sexual escalation.** Adult `sexual === true` on an **image-attached** submit routes to Track A. This is the live CSAM-image backstop while PhotoDNA is parked: the snapshot scores image-borne CSAM as adult `sexual`, because `sexual/minors` is text-only. Realised in `precommit.ts` via the omni `sexual` category plus `imageR2Key` presence. Adult-sexual **text** stays Track B. **This predicate is the only mechanism in the product that catches image-borne CSAM. It is not an optimisation and it is not removable while PhotoDNA is parked.**

**Server Action sequence (mandatory order).**

1. **Auth gate** at the Server Action boundary (ADR-0004).
2. **Idempotency cache lookup** as the first authenticated work (ADR-0013 §3; user-scoped per ADR-0044). On hit, return the cached `(status, body)` verbatim; no transaction, no moderation.
3. **Open the §9 W-1 bet transaction** (ADR-0013) and insert the paired `bets` + `comments` rows atomically. **No moderation input reaches this step.** INV-1 holds trivially: the transaction is never conditional on a verdict, so there is no partial state a verdict could leave behind.
4. **After commit, dispatch moderation off the request path.** The response to the participant does not wait for it. A verdict that lands later writes a `mod_actions` row and marks the item in the admin's review feed (SPEC.1 §15 F-ADMIN-4); it changes nothing the participant sees.

There is no intent reservation and no `409 moderation_in_flight`. Both existed to serialise concurrent submits against a blocking gate; with moderation downstream of the commit there is nothing to serialise, and duplicate submits are already handled by §11's user-scoped idempotency.

**Images — screened before first serve.** An attached image is uploaded to the private participant prefix (§12.2) and screening fires **at attach**, not at submit. The composer stays interactive throughout. At submit: a clean verdict publishes with the post; a verdict still pending publishes the post and attaches the image when it clears; a rejected or failed screening drops the image, publishes the post without it, and tells the participant which image and why. **No public read URL is minted for an object that has not been screened** — this is the §12.3 write-once binding doing its work, and it is the one place the request path is ordered by a verdict. Byte-identical re-uploads reuse the cached verdict (ADR-0028).

**OpenAI HTTP call shape.** `POST https://api.openai.com/v1/moderations`, model `omni-moderation-2024-09-26`. Multimodal input array on image-attached submits (text + `image_url` with a 60-second signed R2 read URL, §12.4). 3-second timeout per attempt. **One retry** on transient failure (network error, timeout, 5xx, 429). **No retry** on 4xx auth errors (401/403), which fire `openai_moderation_auth_failure` as a separate Sentry event (§17 alarm 4).

**Failure mode: it fails neither way.** A terminal failure of the OpenAI call — after retry, on timeout, on a non-200, or on a `flagged:true` verdict that maps to no known category (snapshot drift) — emits the Sentry event, writes an audit row recording the failure, and **changes nothing a participant sees**. There is no `503 moderation_unavailable` and no `error_moderation_unavailable` code. This is deliberately asymmetric to §11's idempotency-fails-closed and to §8's Turnstile-fails-closed: those decide whether a write is legitimate, and moderation does not. The image path is the exception and states its own rule above — a screening failure drops the image; it does not block the post.

**Moderated-object immutability (ADR-0028).** The bytes screening classifies are immutable between screening and render: the participant upload uses a write-once conditional PUT (`If-None-Match: *`, §12.3), so the object cannot be swapped after it clears. This is the precondition that makes the verdict binding on the bytes render later serves. A `HeadObject` verify runs before screening, outside any transaction, and fails the *attach* on oversize, missing object, or R2 unavailability (§12.2 step 5 / §12.3). It does not fail the post.

**No Postgres transaction is held across an HTTP call** (`REFUSAL:` per CLAUDE.md golden rules, §9, ADR-0013 §8). Under this contract the point is stronger than before: the OpenAI call is not merely outside the transaction, it is after it. The bet wrapper from ADR-0013 stays moderation-unaware.

**Events emit.** A verdict that flags writes one `mod_actions` row and emits exactly one `events` row of `event_type = 'moderation.flagged'` in the same standalone transaction — satisfying §3.7's ≥1-event-per-state-mutation rule and §7.5's F-MOD-* write set. `aggregate_type = 'mod_action'`, `aggregate_id = mod_actions.id`. Payload `{ userId, reason, uploadId }`; the raw `imageR2Key` is deliberately excluded because it embeds the userId. `metadata.flow_id = 'F-MOD-1'` for Track A, `'F-MOD-2'` for Track B. `metadata.user_id = actor_id = <submitting user>` per §3.7's binary actor convention; `mod_actions.actor_id` remains `'system'`, which is a different question and does not conflict. `metadata.request_id`/`ip`/`user_agent` are `'unknown'` and `idempotency_key` is `null` at this seam (the established `logout.ts` / `tos-accept.ts` placeholder pattern; `ip` and `user_agent` are STRIP_KEY at export per §19.4 regardless).

**Reason codes** are SPEC.1 §14's, and SPEC.1 is the source: `track_a_auto_ban` · `track_b_flagged` · `sexual_minors_text_flagged` · `image_rejected` · `image_screening_failed` · `content_removed` · `user_banned`. The shipped enum still carries the superseded `track_a_autoban` / `track_b_blocked` / `sexual_minors_text_blocked`; the rename lands at MOD-1 with the migration.

**No automated reporting.** The CSAM auto-report mechanism is scrapped (D-28 r7). Detection is unchanged and unweakened; the admin holds full manual control over removal, ban and any report they choose to make.

**Single source of truth.** `src/server/moderation/precommit.ts` owns the function, the verdict shape, the OpenAI call orchestration, the Sentry emission and the constants (`OPENAI_MODERATION_MODEL_SNAPSHOT`, `OPENAI_TIMEOUT_MS`, `OPENAI_MAX_RETRIES`). `src/server/moderation/openai.ts` holds the HTTP wrapper. `RESERVATION_KEY_PREFIX` and `RESERVATION_TTL_SECONDS` are retired with the reservation.

**Conformance.** ADR-0046 holds the ruling; SPEC.1 §14 holds the product contract; this section holds the architecture. **`src/` implements none of it yet** — it awaits the moderation call, throws on a flag, and fails closed on a provider failure. MOD-1 is the conformance task and until it lands this section leads the code, which is the correct interim state and is recorded here rather than left silent.

---

## §11 Rate-Limit & Idempotency Contract

> **[Substantively absorbed from ADR-0015 (SPEC.16) on 2026-05-07.]**

Every state-mutating endpoint runs through a five-step shared contract: auth gate → idempotency-key validation → idempotency cache lookup → rate-limit check → handler body. Two helper modules carry the contract: `src/server/middleware/rate-limit.ts` (rate-limit middleware) and `src/server/idempotency/cache.ts` (idempotency cache helper). Both run on Upstash Redis (per ADR-0006 §3); their failure modes are deliberately asymmetric (per ADR-0006 §"Failure-mode profile"). ADR-0015 is the source of truth for substance; SPEC.2 §11 names the load-bearing contract.

**Per-surface rate-limit table.** Each row is a sliding-window `Ratelimit` instance configured via `Ratelimit.slidingWindow(maxRequests, windowDuration)` from `@upstash/ratelimit` v2.0.8 against a per-identifier Redis key:

| Surface | Identifier | Window | Constant |
|---|---|---|---|
| OTP request (per email) | `otp-email:{email}` | 1h | `OTP_REQUESTS_PER_EMAIL_PER_HOUR` |
| OTP request (per-IP burst) | `otp-ip:{ip}` | 1m | `OTP_REQUESTS_PER_IP_BURST_PER_MIN` |
| Admin login (per-IP) | `admin-login-ip:{ip}` | 1h | `ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR` |
| Bet `place` / `sell` **and comment-bearing bets** (posts/replies) per-ACCOUNT write cap — **the fairness control** | `bet-user:{users.id}` | 1m | `BET_ATTEMPTS_PER_USER_PER_MIN` *(new — minted by ADR-0054)* |
| Bet `place` / `sell` **and comment-bearing bets** per-IP anti-abuse **backstop** — 10x the per-account cap, so it cannot fire first below ten accounts on one address | `bet-ip:{ip}` | 1m | `BET_ATTEMPTS_PER_IP_PER_MIN` *(minted by ADR-0015; re-scoped by ADR-0054)* |
| R2 signed-PUT URL mint per-IP | `image-put-ip:{ip}` | 1m | `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` *(new — minted by ADR-0015)* |
| Admin market-media signed-PUT URL mint (per-IP burst) | `admin-media-put-ip:{ip}` | 1m | `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` (reused — ADR-0026 / MEDIA.1; no new constant) |

Under the v1.9.0 reply-as-bet model there is **no standalone comment or vote rate-limit budget** — the v1.8.x `write-budget` (per-market 24h) + `write-burst` (per-user 1m) pair is removed, and friendly-fire is gone entirely. Posts and replies are bets, so their anti-abuse posture is the bet posture: **the per-ACCOUNT cap `bet-user` as the fairness control, with the per-IP `bet-ip` behind it as an abuse backstop (ADR-0054).** Both are consulted at step 4, concurrently, and a refusal from either returns the same `error_rate_limit_exceeded` envelope — deliberately indistinguishable, so a 429 never teaches a caller which cap to tune around. ⚠ **This paragraph asserted the opposite until ADR-0054** — *"Bet placement and image-PUT-URL surfaces use per-IP identifiers because the threat model is credential-stuffed bot traffic across many compromised accounts; per-user limits only fire after a successful login and are the wrong defense surface."* That reasoning still holds for **image-PUT-URL**, which is why `image-put-ip` is untouched; for BET surfaces it conflated a threat model with a budget. The endpoint is unreachable without a session, so the "only fire after a successful login" objection describes the endpoint's entire population, while the address key billed one participant's writes to every stranger sharing their NAT. The credential-stuffing ceiling survives as the backstop. **Open question (deferred):** whether reply-bets warrant an *additional* per-market productive cap distinct from top-level bets (which are exempt from a per-market productive cap by design) — to bound reply-flooding within a single market — is left to the HARDEN.6 number-tuning pass per SPEC.1 §8; if adopted it would mint a new per-market reply-bet constant, otherwise the per-IP cap is the sole control. Numeric values for every constant are deferred to HARDEN.6 per the project-wide deferral rule.

**Idempotency contract — header, key shape, storage.** Header: `Idempotency-Key: <opaque-string>` matching `^[A-Za-z0-9_-]{1,255}$`. Server validates format and rejects malformed with HTTP 400 `error_idempotency_key_invalid`. Required on the bet Route Handlers (`place`, `sell`) for every bet, including comment-bearing ones — a comment rides its bet through the same Route Handler and the same `Idempotency-Key` contract (mandatory commentary / reply-as-bet, ADR-0017); there is no separate comment-bearing-bet Server Action path (corrected 2026-08-27, ADR-0044 — this paragraph previously named `placeDirectComment`/`placeReply`/`placeImageComment` Server Actions and a `(user_id, market_id, body_hash, posted_at_minute)` natural key; neither exists in `src/`, which made this paragraph describe a protection that was never built). **Exempt** on file-storage PUT-URL mint (`POST /api/uploads/sign`) per SCAFFOLD.15 Q2 ratification — orphan-sweep handles duplicate-mint cleanup within `ORPHAN_WINDOW_MINUTES` per §12.6 (double-mint risk accepted; cleanup cost is one stale R2 object pruned within ≤2h). Scoping: **`(user_id, key)`** (ADR-0044; was global-by-key-alone through S-7) — matched on the key value scoped to the authenticated user; cross-endpoint reuse (the same user replaying one key across `place` and `sell`) with mismatched body still triggers the body-fingerprint mismatch path, and is a named, deliberately open gap (`docs/parked.md` D-8). Body fingerprint: SHA-256 of canonical-JSON-serialised request body (RFC 8785 — sorted keys, no insignificant whitespace, UTF-8), hex-encoded. Storage substrate: Redis SETNX-with-pending-sentinel on Upstash, two-tier TTL — 30-second pending sentinel for in-flight requests (sized for §9 / ADR-0013's bet-transaction worst case ~600ms upper + slack); 24-hour completed-response cache replay (matches Stripe's published contract).

**Single-key-encoding-both-states pattern.** One Redis key per `(user_id, idempotency-key)` pair (user-scoped since ADR-0044, S-7 — see the same-shape note in the paragraph above) encodes both lifecycle states. On cache miss, the handler executes `SET idem:{user_id}:{key} <pending-sentinel> NX EX 30`; the `NX` flag means "only set if key does not exist." If `NX` returns `0`, another in-flight request holds the sentinel and we return HTTP 409 `error_idempotency_in_flight` with `Retry-After: 2`. The pending-sentinel value is the constant string `"PENDING"` plus the body fingerprint (so the in-flight collision check can already detect body mismatch on a still-pending key). A body-fingerprint mismatch against a still-pending sentinel returns the in-flight collision shape (HTTP 409 `error_idempotency_in_flight + Retry-After: 2`), NOT the completed-mismatch shape (`error_idempotency_key_reused`) — surfacing two different errors mid-flight would confuse client retry policy, and the still-pending request may yet complete with a body that matches the eventual retry. On handler completion (success or terminal error), the handler executes `SET idem:{user_id}:{key} <completed-payload> EX 86400` where `<completed-payload>` is JSON-encoded `{ status, body, body_fingerprint }`. The atomic transition pending → completed is just a `SET` without `NX`, which Redis guarantees as atomic.

**Ownership-checked, never-throws release (AUDIT-FIX-B3 / ADR-0031; scopes ADR-0015 — see its Patch record).** Refining the plain-`SET` transition above: the pending sentinel value gains an **owner token** — `PENDING:{body-fingerprint}:{token}` (token = `randomUUID`) — and the pending → completed / pending → deleted transition becomes an **ownership-checked** `redis.eval` (a compare-and-SET / compare-and-DEL Lua that acts only when the stored value equals the caller's own sentinel — the `upstash/lock.ts` token-checked release pattern), so a >30s straggler can no longer clobber a successor's sentinel or completed response. The pending-arm parse recovers the fingerprint as the segment before the last colon (the fingerprint is hex and the token is a UUID — neither carries a colon). The release path **never throws**: any Upstash error at completion-write time is swallowed (fail-open on the response path) so a committed bet's response always reaches the client, and it emits **alarm 6b** (`upstash_unavailable_idempotency`) at the **completion-write site** with a `site` tag discriminating it from the cache-lookup site (`site: release` in `idempotency/cache.ts`; a belt `site: endpoint_finally` in `bets/endpoint.ts`) — implementing ADR-0015 §3's completion-write alarm half (§17.3).

**In-handler call sequence (consumed by every state-mutating endpoint).**

1. **Auth gate** at the Server Action / route-handler boundary (per ADR-0004 / SPEC.4).
2. **Idempotency-key validation.** Reject missing required header with HTTP 400 `error_idempotency_key_required`; reject malformed with HTTP 400 `error_idempotency_key_invalid`.
3. **Idempotency cache lookup** via `idempotencyLookupOrReserve(userId, key, bodyFingerprint)` (user-scoped since ADR-0044, S-7 — was `(key, bodyFingerprint)` through S-7). Branch on the tagged-union result: `hit` returns the cached response — see step 3b for a non-2xx cached response, which is checked before being trusted; `pending` returns HTTP 409 `error_idempotency_in_flight + Retry-After: 2`; `mismatch` returns HTTP 409 `error_idempotency_key_reused`; `unavailable` returns HTTP 503 `error_idempotency_unavailable + Retry-After: 5`; `miss` returns a `release` callback the handler MUST call in `finally` to either write the completed response (success / terminal error) or `DEL` the pending sentinel (handler crash).
3a. **Durable bet-receipt pre-check** (bet flow only, AUDIT-FIX-B3 / ADR-0031). After the cache lookup (step 3) and **before** rate-limit (step 4) and moderation (step 6), the two bet endpoints query `bet_receipts` by `(user_id, idempotency_key)` (user-scoped since ADR-0044, S-7 — was `idempotency_key` alone through S-7). **Three outcomes, corrected 2026-08-27 (ADR-0044 security-audit MEDIUM — the prior wording of this sentence gave the pre-check a fourth, false outcome that would 409 every fresh key on its first use):** a receipt hit with a **matching** body-fingerprint returns the original stored response (HTTP 200) and promotes the Redis sentinel; a **mismatched** fingerprint returns HTTP 409 `error_idempotency_key_reused` (poison guard; not cached); **no receipt at all for this user falls through to normal execution** — same as a receipt-read error (below) — because at this point in the request "no receipt yet" is the overwhelmingly common, correct case (most keys are used exactly once). Fails **open** to normal execution on a receipt-read error too, and both no-receipt and read-error are internally distinguished from a genuine mismatch so neither is ever reported as a key-reused refusal; correctness is backstopped by the tx-level unique (§9), whose **own** catch — a separate code path, not this pre-check — is where a receipt absent for this user (a genuine cross-user collision, or rarely a pre-migration-0022 legacy gap) does map to the 409, alarmed distinctly (ADR-0044).

3b. **`case "hit"` durable consult on a cached non-2xx** (step 3's Redis hit arm; reinstated at ADR-0044 as "DC-a" after a security-audit MEDIUM finding). A cached response whose status is **not exactly 200** is checked against the same durable receipt (by `(user_id, idempotency_key)`) before being trusted: if a receipt with a **matching** fingerprint exists, the original 200 is returned instead of the stale cached error. (`!== 200`, not a `≥ 300` range test — a malformed/unvalidated cached status must fail toward checking the receipt, not skipping the check; every status this system actually caches is one of `{200, 400, 403, 404, 409, 429}`, so the two tests are behaviorally identical on the reachable set.) This is the one place a receipt is consulted on the `hit` path rather than the `miss` path, and it exists because Redis losing an entry and the pre-check being blind (3a's fail-open) can coincide across two different requests under the same key, leaving a cached error beside an unrelated, already-committed receipt. A cached 200 never needs this. A recovery here (a matching receipt found) is alarmed — it means the two-failure state just described actually occurred.
4. **Rate-limit check** (per the surface table). On rate-limit-exceeded, write the HTTP 429 response into the idempotency cache (so subsequent retries with the same key return the cached 429), then return HTTP 429 `error_rate_limit_exceeded` with `Retry-After: <seconds>` derived from `Ratelimit.limit().reset`.
5. **Bet transaction wrapper** (per §9 / ADR-0013) or other handler body.
6. **Moderation dispatch** (per §10 — after the transaction commits, off the request path).
7. **Cache the completed response** under the 24h outer TTL via the `release` callback from step 3.

Steps 1–4 and step 7 are universal for every state-mutating endpoint; steps 3a/3b and steps 5–6 are bet-flow-specific.

**Failure-mode contract: three concerns, three postures.** **Rate-limit fails OPEN on Upstash unreachable** — middleware catches the error, emits a Sentry event tagged `upstash_unavailable_rate_limit` (per §17 alarm 6a), and admits the request. Brief abuse windows are accepted as the cost of not user-blocking on a vendor outage. **Idempotency fails CLOSED on Upstash unreachable** — cache helper catches the error, emits a Sentry event tagged `upstash_unavailable_idempotency` (per §17 alarm 6b), and returns HTTP 503 `error_idempotency_unavailable + Retry-After: 5` without executing the handler. The bet+comment is never persisted; the user retries. **Moderation fails neither way** (per §10). Idempotency fails closed and rate-limiting fails open because both decide whether a write is legitimate; moderation decides nothing about the write, so it has no failure posture on the request path at all. The asymmetry across the three concerns is deliberate per ADR-0006 §"Failure-mode profile": open / closed / neither. Upstash transport is bounded (ADR-0015 Patch, 2026-07-06): per-command abort ceiling `REDIS_COMMAND_TIMEOUT_MS` = 2000ms with a single flat in-window retry (`REDIS_MAX_RETRIES` = 1, `REDIS_RETRY_BACKOFF_MS` = 200ms); a timeout/abort surfaces as a thrown error into the existing fail-open (rate-limit) / fail-closed (idempotency) arm — never as fabricated success.

**Cached error responses include 429s.** A request that hits the rate-limit (HTTP 429) is cached under its idempotency-key; subsequent retries with the same key return the cached 429, NOT a fresh execution — the rate-limit was a deterministic property of the original request, and a client retrying after rate-limit recovery should generate a fresh idempotency-key. This matches Stripe and the IETF Idempotency-Key draft.

**No server-side retry on state-mutating endpoints.** A single Upstash failure surfaces directly to the client. The client owns retry policy.

**No §10 counterpart.** §10 holds no reservation: moderation is dispatched after the transaction commits, so there is nothing to reserve against. The idempotency sentinel below is the only Redis key on this path.

**Single source of truth.** `src/server/middleware/rate-limit.ts` owns the per-surface `Ratelimit` instances, the fail-open posture, the alarm-6 emission, and the identifier-extraction helpers. `src/server/idempotency/cache.ts` owns the `idempotencyLookupOrReserve` helper, the body-fingerprint computation, the fail-closed posture, and the alarm-6 emission. `src/server/idempotency/types.ts` owns the constants (`Idempotency-Key` header name, validation regex, `PENDING_TTL_SECONDS = 30`, `COMPLETED_TTL_SECONDS = 86400`) and the error-envelope codes. The Appendix B constants (`BET_ATTEMPTS_PER_USER_PER_MIN` — minted by ADR-0054 — plus `BET_ATTEMPTS_PER_IP_PER_MIN` and `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN`) live alongside the other §16.1 rate-limit constants in `src/server/config/limits.ts` per SCAFFOLD.4 (the v1.8.x comment-budget constants `RATE_LIMIT_PER_MARKET_PER_DAY` + `RATE_LIMIT_BURST_PER_MIN` are removed under reply-as-bet; the §16.1 constant set is SPEC.1-owned per ADR-0018). The full file map is absorbed into Appendix A on its drafting pass.

ADR-0015 holds the full decision body, seven dimensions of considered options with verdicts, and the closing italic summary. SPEC.2 §11 is the cross-reference; ADR-0015 is the canonical text.

---

## §12 File Storage Contract

§12 owns the *file-storage contract* for the experiment-phase build — Cloudflare R2 as the object-store vendor with two structurally distinct buckets, server-mediated signed-PUT URLs as the upload primitive, the F-COMMENT-3 image-attached-comment orchestration that integrates with §10 moderation + §11 idempotency + §3.5 orphan sweep, and the deferred-from-§5 `image_uploads` Bucket-B classification with two-column atomic transition. ADR-0006 owns vendor selection + jurisdiction + bucket inventory + failure-mode profile; ADR-0014 owns the multimodal moderation HTTP call shape including the signed-READ TTL; ADR-0015 owns the per-IP rate-limit class on the PUT-URL mint endpoint; ADR-0011 owns the static-bucket asset-pipeline source-of-truth for identity-pool PFPs. §12 sits above all of them at the contract layer, naming the two-bucket lifecycle distinction and the F-COMMENT-3 orchestration sequence. Operational specifics (CORS policy, signed URL TTL value, bucket-policy JSON, object-key literal pattern) are SCAFFOLD.15 territory per §12.9.

### §12.1 Two-bucket lifecycle pattern

Cloudflare R2, jurisdiction `APAC` (Mumbai region per ADR-0006 §4). Two buckets in v1, structurally distinct lifecycle patterns:

| Dimension | `zugzwang-uploads` (dynamic) | `zugzwang-pfp` (static) |
|---|---|---|
| Purpose | Image-attached comment uploads via F-COMMENT-3 | 50,000 pre-baked pseudonym profile pictures per ADR-0011 |
| Lifecycle | Per-upload signed-PUT mint, screened before first serve, orphan sweep eligible | Pre-baked once before launch by asset pipeline, no runtime mints |
| Read access | Private; signed-read URLs minted per moderation call (60s TTL) and per render (TTL deferred to SCAFFOLD.15) | Public-read on `v1/*`; long-lived public CDN URL composed at frontend render time |
| Object metadata | `x-amz-meta-user-id`, `x-amz-meta-image-uploads-id` for orphan-sweep correlation only | `Content-Type: image/webp`, `Cache-Control: public, max-age=31536000, immutable` |
| Orphan-sweep applicability | YES — Vercel Cron carve-out per §3.5 Pattern A-2 + §12.6 | NO — static bucket, no rows to reconcile |
| Bucket-policy detail owner | SCAFFOLD.15 | ADR-0011 + asset pipeline |

The two buckets share the same R2 jurisdiction but no other operational shape. A reader looking at upload-flow code goes to `zugzwang-uploads`; a reader looking at pseudonym-rendering code goes to `zugzwang-pfp`. They are referenced by name across the codebase and do not generalise into a "media bucket" abstraction.

**Third bucket — `market-media` (ADR-0026; lands at build).** A third R2 bucket `zugzwang-market-media` extends `type R2Bucket = "uploads" | "pfp" | "market-media"` to hold admin-set per-market media, with **its own isolated credentials** — preserving the per-bucket compromise-isolation property (`zugzwang-pfp` is the precedent for an admin-owned, non-participant asset class with its own bucket; a third arm preserves that property rather than diluting it into a shared abstraction). Its lifecycle mirrors the **static** pattern (admin-set pre-live, public-read CDN, no per-request mint, no orphan sweep), not the dynamic `zugzwang-uploads` pattern. Key namespace **`m/<marketId>/<mediaId>.<ext>`** — distinct from the participant `u/<userId>/` namespace and the participant moderation read-scope, so the two image sources stay on separate read-scopes (§5.1 `comments`, F-COMMENT-3). Bucket provisioning (Doppler `R2_*_MARKET_MEDIA` credentials across the `stg` / `prd` configs) is build/ops work; the admin-context signed-PUT mint lands in §4 at build — no moderation-at-upload (market-media is operator-curated, not moderated; ADR-0027).

### §12.2 Image-attached comment flow (F-COMMENT-3)

Orchestration consuming §10 + §11 + §12 jointly. The R2 object exists from step 3 onward regardless of the screening outcome; the `image_uploads` row tracks committed, orphaned, and blocked (the shipped enum value; renamed at MOD-1).

1. **Client requests PUT URL.** `POST /api/uploads/sign` per §4.3. Body declares the intended `Content-Type` and content-length range. The handler runs §11 steps 1–4 (auth, idempotency-validate, idempotency-lookup, rate-limit on `image-put-ip:{ip}`).
2. **Server mints UUIDv7 + R2 object key + signed PUT URL + `image_uploads` row.** Inside one Postgres transaction (Bucket-B insert): generate `image_uploads.id` UUIDv7 per ADR-0016 D1; build the structurally-required object key (per-user-namespaced, UUID-derived, file-extension-preserved — the literal pattern is SCAFFOLD.15 territory per §12-R2); request a presigned PUT URL from R2 scoped to that exact key + Content-Type + Content-Length-Range; INSERT `image_uploads` with `terminal_state = NULL`, `terminal_at = NULL`, `r2_object_key`, `user_id`, `created_at = now()`. Return the signed PUT URL + the `image_uploads.id` to the client.
3. **Client PUTs file bytes to R2 directly.** The signed URL bypasses the Vercel function per K3 (server doesn't proxy bytes — keeps function memory and CPU off the upload path). R2 stores the object; the user-metadata headers `x-amz-meta-user-id` + `x-amz-meta-image-uploads-id` ride along for orphan-sweep correlation only (§12-R3 — moderation linkage is DB-side, not R2-metadata-side).
4. **Client posts comment with `image_uploads_id`.** `placeImageComment(input)` Server Action per §4.2. Input carries the comment body + the `image_uploads_id` returned at step 2.
5. **Pre-serve object verify (ADR-0028):** before screening runs, `verifyUploadedObject` issues one `HeadObject` on the uploaded key — failing the *attach* on oversize (`error_image_oversize`), missing object (`error_storage_object_missing`) or R2 unavailability (`error_storage_unavailable`) — and captures the ETag and real byte size for the `image_upload.committed` event. A failed verify drops the image; it does not block the post. **Screening then calls the §10 moderation function with a multimodal input array** (text + `image_url` with a 60-second signed R2 read URL minted at §12.4), OpenAI `omni-moderation-2024-09-26`. The bet transaction is not conditional on either result.
6. **Branch on the image verdict** — the post is already live either way:
   - **`pass`** — the image publishes with the post; UPDATE `image_uploads` SET `terminal_state = 'committed'`, `terminal_at = now()` (the two-column Bucket-B transition, §12-R1).
   - **`track_a` / `track_b`** — write a `mod_actions` row in a standalone transaction; UPDATE `image_uploads` SET `terminal_state = 'blocked'`, `terminal_at = now()` (the shipped enum value; renamed at MOD-1). The bet+comment transaction has already committed; the post is live and the image is not served.

The R2 object exists from step 3 onward regardless of the screening outcome. On a Track A or Track B image verdict the object is preserved for the admin's review surface — the admin sees what was attempted before deciding to remove or ban — and **no public read URL is ever minted for it**. The orphan sweep at §12.6 reconciles the case where step 4 never fires: the client uploads to R2 and never submits the Server Action, through a crash, a network drop after step 3, or deliberate abandonment.

### §12.3 Signed-PUT URL mint endpoint

Server-mediated. Endpoint: `POST /api/uploads/sign` per §4.3 (F6 family — internal/external integrations). The client does NOT compute the signed URL; the server signs against its R2 credentials and returns the URL to the client.

**Per-IP rate limit.** `image-put-ip:{ip}` 1m sliding window per §11's per-surface rate-limit table + ADR-0015. The threat model is credential-stuffed bot traffic minting throwaway PUT URLs to fill the bucket; per-user limits don't fire until a successful login and are the wrong defense surface.

**Scoped per upload.** The signed URL is bound to (i) the exact R2 object key minted at §12.2 step 2, (ii) the declared `Content-Type`, (iii) a `Content-Length-Range` constraint. A client that PUTs a different content type or oversized body to the URL is rejected by R2 directly — the server doesn't need to validate at step 4. R2 does not enforce `Content-Length-Range` at signing time per its S3-compat contract; the byte-size cap is enforced **before screening** via a wired `HeadObject` verify (`verifyUploadedObject`, `src/server/storage/verify-object.ts`) — reject, fail-closed, if the real `ContentLength > IMAGE_UPLOADS_MAX_BYTES` (`error_image_oversize`, HTTP 400) before the image is attached (ADR-0028; closes AUDIT.1 A10) — backed by the R2 native lifecycle rule (90-day prefix `u/` expire per SCAFFOLD.15 operator substrate, bumped from 30d to span the experiment's 51-day live window + archive headroom — see SCAFFOLD.15 SURPRISE-7) as the outer safety net.

**TTL.** 60 seconds per SCAFFOLD.15 Q2 ratification — long enough for `pick file → review → submit` (~30s typical), short enough to bound exfiltrated-URL exposure. Constant lives at `src/server/config/limits.ts` `PUT_URL_TTL_SECONDS`.

**Write-once binding (ADR-0028).** The participant signed PUT is armed with `If-None-Match: "*"` — a conditional-create header the SigV4 presigner keeps in `X-Amz-SignedHeaders` (signed; the client cannot strip it). The first PUT creates the object; every subsequent PUT to the key returns **412 Precondition Failed**. The object is immutable from first write, so the bytes §10 screening reads are — by construction — the bytes render serves; this closes the AUDIT.1 A1 swap-after-screening CSAM window at the storage layer (SPEC.1 §14). The pre-serve `HeadObject` (`verifyUploadedObject`) additionally captures the real ETag + byte size into the append-only `image_upload.committed` event as a forensic fingerprint — the ETag is a paper trail, **never** a security control (security rests solely on write-once immutability; R2's ETag is MD5-based). A missing object at verify time → `error_storage_object_missing` (HTTP 400, fail-closed); R2 unavailable → `error_storage_unavailable` (HTTP 503, fail-closed). The **admin** market-media signed-PUT path passes no `ifNoneMatch` and is unchanged (operator-curated, unmoderated; ADR-0027).

### §12.4 Signed-READ URL for OpenAI multimodal moderation

Separate from the PUT URL. 60-second TTL per ADR-0014 §"Image URL format". Generated at `precommitModerate()` entry inside §10's Server Action sequence — the URL is constructed from the R2 client wrapper (`src/server/storage/r2.ts`), passed to OpenAI's `omni-moderation-2024-09-26` as the `image_url` field in the multimodal input array, and discarded after the API call returns.

The TTL is deliberately tight: a 60-second signed-read URL exfiltrated mid-moderation is useless 60 seconds later. The OpenAI call completes within the §10 3-second-timeout budget plus retries; 60 seconds is generous safety margin.

This is structurally distinct from any committed-comment rendering TTL — the rendering TTL is SCAFFOLD.15's call and applies to the read-side URL clients receive when viewing committed image-attached comments. The §12.4 60-second URL is for OpenAI only and never flows to a client browser.

### §12.5 `image_uploads` Bucket classification — Option B ratified

The deferred §5 row 20 ratification ask from 3-A is closed at 3-B. Two viable patterns were considered:

**Option A (rejected) — Bucket C with hard delete.** `image_uploads` mutable; UPDATE on commit, hard DELETE on orphan-sweep. Rejected on three grounds: (i) audit-trail integrity for admin investigations into rejected-upload patterns is lost (the `track_a` / `track_b` `terminal_state` row vanishes when its R2 object is swept); (ii) inconsistency with SPEC.1 §15's audit-log discipline, which mirrors `mod_actions` append-only discipline; (iii) H2-scrub correctness — hard-deleting `image_uploads` rows that reference users whose H2 erasure has fired creates a surface where erased-user evidence partially survives in `mod_actions.image_r2_key` without the corresponding `image_uploads` provenance.

**Option B (ratified) — Bucket B append-only with two-column atomic transition.** `image_uploads.terminal_state` + `image_uploads.terminal_at` set together once via a single UPDATE; the §6.3 trigger function rejects partial transitions, re-firing, and any non-whitelisted column changes. The three terminal states are `'committed'` (step 6 pass branch), `'blocked'` (step 6 track_a/track_b branch), `'orphan'` (orphan-sweep branch — see §12.6). Audit trail preserved; H2 erasure scrubs `r2_object_key` to NULL and PII columns, but the row itself remains as evidence; consistent with §6's broader Bucket-B discipline.

The §6.3 per-table trigger function for `image_uploads` is the only Bucket-B trigger in v1 with a multi-column transition shape. The trigger SQL is at `drizzle/migrations/<NNNN>_append_only_triggers.sql`; SCAFFOLD.2 implements alongside the other twelve protected-table trigger entries.

### §12.6 Orphan sweep

Restated from §3.4 Pattern A-2 for the §12 reader. The orphan sweep is one of the two Vercel Cron HTTP-fanout jobs in v1 per ADR-0006 (the other is `GET /api/cron/close-due-markets`, the W-4 close-due sweep — §3.4 + ENGINE.15 R-15.2):

- **Endpoint:** `GET /api/cron/r2-orphan-sweep` Route Handler at `src/app/api/cron/r2-orphan-sweep/route.ts` (Vercel Cron contract supports GET only — see SCAFFOLD.15 SURPRISE-1).
- **Auth:** `Authorization: Bearer ${CRON_SECRET}` header; Vercel Cron is the only legitimate caller. Constant-time compare per `crypto.timingSafeEqual`.
- **Cadence:** `0 */6 * * *` per SCAFFOLD.15 Q7 ratification (every 6 hours; Vercel Pro tier required for sub-daily cadences).
- **Logic:** Query `image_uploads` rows where `terminal_state IS NULL` AND `created_at < now() - ORPHAN_WINDOW_MINUTES`; for each row, DELETE the R2 object via the R2 client; UPDATE the row SET `terminal_state = 'orphan'`, `terminal_at = now()` (the whitelisted Bucket-B transition). The cron sweep is the **Layer 2** early-orphan reconciliation surface — it sweeps `terminal_state IS NULL` rows only. Bucket-B `'blocked'` rows are deleted from R2 by the **Layer 1** R2 native lifecycle rule (90-day prefix `u/` expire — bumped from 30d at SCAFFOLD.15 per SURPRISE-7); their DB rows stay in terminal `'blocked'` state for audit. The two layers are deliberately asymmetric — Layer 2 is precision (Vercel Cron deterministic cadence), Layer 1 is safety net (R2-native, 24-hour-fuzzy).
- **Failure mode:** Operational-only per ADR-0006 §"Failure-mode profile". A failed sweep does not affect any user-facing flow; storage cost grows (bounded by Layer 1 lifecycle); Sentry alarm 6e per §17.2 alarm-6 sub-table fires on Vercel Cron handler 5xx. Circuit breaker at 5 consecutive R2 failures aborts the sweep cleanly with `{status: 'r2_unavailable'}` HTTP 200 (NOT 5xx — Vercel cron should not treat a universal R2 outage as a cron failure; the next 6-hour fire retries).
- **Reconciliation invariant:** `image_uploads` rows with `terminal_state IS NULL` represent in-flight uploads (the user is still completing the F-COMMENT-3 client orchestration). Rows with `terminal_state = 'committed'` have a corresponding `comments.image_uploads_id` FK; rows with `'blocked'` have a `mod_actions.image_r2_key` linkage; rows with `'orphan'` have neither and the R2 object is deleted.

### §12.7 Identity-pool PFP bucket (`zugzwang-pfp`) static lifecycle

Per ADR-0011 + the asset pipeline at `experiment/asset-pipeline/`. 50,000 pseudonym profile pictures uploaded once before launch:

- **Pre-launch upload.** The asset pipeline (Flux sampler + Pillow compositor + ComfyUI workflow) generates 50,000 PNG-then-WebP-converted images locally on the DGX Spark, uploads each to `zugzwang-pfp/v1/<slug>` where `<slug>` is the deterministic `<colour>-<animal>-<number>` per ADR-0011 §1.
- **Object metadata.** `Content-Type: image/webp` + `Cache-Control: public, max-age=31536000, immutable`. The 1-year max-age + immutable flag tells Cloudflare's edge to cache aggressively forever; the `v1/` prefix is the version sentinel — a future re-bake bumps to `v2/` and the asset pipeline re-uploads.
- **Public-read on `v1/*`.** Bucket policy allows anonymous GET on `v1/*` only; no anonymous list, no anonymous write per ADR-0011 §"R2 storage" requirements (specific JSON owned by SCAFFOLD.15).
- **F-AUTH-3 does NOT mint signed PUT URLs into this bucket.** PFP selection happens via `identity_pool` Bucket-B `assigned_at` whitelisted transition (per §3.5 + ADR-0011) and writes `users.pfp_filename` to the slug. The frontend composes the public CDN URL at render time via a deterministic `${R2_PFP_BASE_URL}/v1/${pfp_filename}` template.
- **`R2_PFP_BASE_URL` substrate (experiment phase).** SCAFFOLD.15 sets `R2_PFP_BASE_URL` to the R2 public dev URL on `zugzwang-pfp` (e.g. `https://pub-<account-hash>.r2.dev`). The originally-planned custom domain `cdn.zugzwangworld.com` bind is **deferred to post-experiment** per SCAFFOLD.15 SURPRISE-8 — `zugzwangworld.com` DNS is hosted at Namecheap (not Cloudflare), and the partial-CNAME / nameserver-migration paths both carry unacceptable cost (Cloudflare Business plan ≥$200/mo) or risk (founder email continuity on `zugzwangworld@proton.me`) at experiment scale. Architectural impact: PFP reads have **no edge cache** during the experiment phase — every PFP fetch hits R2 directly (~50–100ms latency; R2 Class B Operations cost ≤$2 over the experiment window, well within the free tier). The custom-domain bind + DNS migration is a post-experiment tracker entry (testnet-phase scope).
- **H2 erasure** scrubs `users.pfp_filename` to NULL and PII columns, but does NOT delete the R2 object. The freed pseudonym tuple in `identity_pool` remains permanently retired (the `identity_pool.assigned_at` Bucket-B transition is one-shot per ADR-0011) — the R2 object becomes unreferenced but is preserved for any future audit need.

### §12.8 Failure-mode profile (R2 outage)

Restated from ADR-0006 §"Failure-mode profile" for the §12 reader. The blast radius of an R2 outage is partial degradation, not full-stop:

- **F-COMMENT-3 fails.** Step 1 (PUT URL mint) returns HTTP 503 from the R2 SDK; handler emits Sentry alarm 6c (R2-unreachable per §17.2 alarm-6 sub-table) and returns `error_storage_unavailable` to the client.
- **F-COMMENT-1, F-COMMENT-2, F-COMMENT-3 text-only succeed.** Comments without image attachments do not touch R2; only F-COMMENT-3 with an `image_uploads_id` is affected.
- **Existing edge-cached committed images render until cache expiry.** Cloudflare's edge caches successful GETs against `zugzwang-uploads` (read-side TTL per SCAFFOLD.15) and `zugzwang-pfp` (1-year immutable per §12.7); cached PFPs render indefinitely; cached committed-comment images render until their TTL elapses.
- **New signups blocked at F-AUTH-3 PFP-render step.** F-AUTH-3 does not touch R2 directly (no signed-PUT mint), but the welcome screen must render the user's freshly-assigned PFP — and the PFP image-fetch is a frontend GET against `zugzwang-pfp`. R2 outage breaks this fetch; no graceful degradation (the screen requires the PFP image — no fallback element). The signup completes successfully at the database layer; only the rendering of the welcome screen fails until R2 recovers.

### §12.9 SCAFFOLD.15 deferral boundary

Fourteen-row partition of concerns. §12 owns the structural and flow-contract surface; SCAFFOLD.15 owns operational and vendor-API substance; HARDEN.6 owns numeric values; HARDEN.* owns runbook content.

| Concern | Owner |
|---|---|
| R2 vendor selection (`Cloudflare R2`) | ADR-0006 |
| R2 jurisdiction (`APAC`) | ADR-0006 |
| Bucket inventory (`zugzwang-uploads` + `zugzwang-pfp`) | ADR-0006 + §12.1 |
| Two-bucket lifecycle pattern (dynamic vs static) | §12.1 |
| F-COMMENT-3 six-step orchestration | §12.2 |
| `image_uploads` Bucket-B classification (Option B) | §12.5 + §6.3 |
| Per-IP rate-limit class on PUT-URL mint | §11 + ADR-0015 |
| Multimodal signed-READ TTL (60s) | §12.4 + ADR-0014 |
| Object-key literal pattern — `u/{user_id}/{image_uploads_id}.{ext}` where `ext ∈ {jpg, png, webp, gif, avif}` lowercase canonical per MIME (locked at SCAFFOLD.15 Q9) | SCAFFOLD.15 ✓ |
| CORS policy on `zugzwang-uploads` | SCAFFOLD.15 |
| Bucket-policy JSON (anonymous-read `v1/*` rules, etc.) | SCAFFOLD.15 |
| Read-side signed URL TTL for committed images | SCAFFOLD.15 |
| PUT URL TTL value | SCAFFOLD.15 |
| Orphan window value (`<orphan_window>`) | HARDEN.6 |
| Cron cadence (literal cron syntax) | §21 + HARDEN.* |
| Vendor on-call procedure (`docs/runbooks/r2-unreachable.md`) | §21 + HARDEN.10 |

### §12.10 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| `POST /api/uploads/sign` Route Handler | `src/app/api/uploads/sign/route.ts` |
| `POST /admin/markets/media/sign` Route Handler (admin market-media signed-PUT mint, MEDIA.1) | `src/app/(admin)/admin/markets/media/sign/route.ts` |
| Server logic for sign-URL mint + `image_uploads` insert | `src/server/storage/sign-upload.ts` |
| Signed-READ URL helper (consumed by §10 moderation) | `src/server/storage/sign-read.ts` |
| Drizzle schema for `image_uploads` | `src/db/schema/image-uploads.ts` |
| R2 client wrapper (S3-compatible SDK + R2 endpoint config) | `src/server/storage/r2.ts` |
| Vercel Cron orphan-sweep Route Handler | `src/app/api/cron/r2-orphan-sweep/route.ts` |
| Vercel Cron job entry | `vercel.json` (`crons[]` array) |
| Identity-pool asset pipeline (Flux + Pillow + ComfyUI) | `experiment/asset-pipeline/` (per ADR-0011) |
| Frontend PFP URL composer | `src/lib/pfp-url.ts` |
| `image_uploads` append-only trigger function | `drizzle/migrations/<NNNN>_append_only_triggers.sql` (per §6.3) |

ADRs consumed by §12: ADR-0006 §4 (R2 vendor + jurisdiction `APAC` + two-bucket inventory + failure-mode profile), ADR-0014 §"Image URL format" + multimodal moderation HTTP call shape (§12.4 60-second signed-READ TTL), ADR-0015 §1 (image-PUT-URL surface rate-limit class `image-put-ip` per §11), ADR-0011 (identity-pool PFP static-bucket asset-pipeline source-of-truth + bucket-policy requirements). 3-B §12-R1 ratifies the Option B Bucket-B classification with two-column atomic transition; §12.5 + §6.3 absorb. 3-B §12-R2 confirms SCAFFOLD.15 ownership of literal object-key pattern. 3-B §12-R3 corrects-and-replaces R2 user-metadata framing — moderation linkage is DB-side (`mod_actions.image_r2_key`); R2 metadata is for orphan-sweep correlation only.

---

## §13 Flow Contract Template (six-field block)

§13 owns the *file-level per-flow contract template* for the experiment-phase build — the mandatory shape every `docs/specs/flows/F-*.md` file MUST conform to, the inventory of 37 F-* flow files across 7 prefix families, the cross-reference invariants every Errors and Acceptance block MUST satisfy, and the drafting cadence (per-file deferred to gating implementation task). SPEC.1 §7–§15 owns the *product-level* per-flow Pre / System / Response / Errors / Invariants / Acceptance substance; §3 owns the *architectural-pattern* layer (W-/R-/A- shapes that every flow reduces to); this §13 sits at the *file-level* template layer, naming the structure each per-flow file uses without authoring the per-file contracts themselves. A reader who needs a specific flow's contract goes to `docs/specs/flows/F-*.md`; a reader who needs the template shape stays here.

Three load-bearing constraints minted in §13 and consumed by every F-* file: (1) the six-field block is mandatory with one degenerate variant for read flows (§13.2); (2) every `error_code` in any Errors block must exist in §15.4's catalogue (§13.1's cross-reference invariant, CI-lint at HARDEN-phase); (3) every name in any Acceptance block must resolve to a real test path under `tests/` (§13.5).

### §13.1 The six-field block

Every per-flow file MUST contain exactly these six fields in this order:

**Pre** — preconditions the flow assumes hold before the System steps execute. Cross-references SPEC.1 §-numbers + ADR clauses + handler-stack steps that establish the precondition. Examples: "User holds participant session per §8.1," "Market status is `Open` per §3.6," "Idempotency-Key cache hit returns at handler step 3 per §11.3."

**System** — numbered imperative steps the handler executes. References §3.2 W-* / §3.3 R-* / §3.4 A-* pattern names where applicable. Each step is one verb-led action ("Acquire pool-row lock via `SELECT … FOR NO KEY UPDATE`," "Insert paired `bets` + `comments` rows inside the W-1 transaction per §3.2," "Insert `events` row with `event_type = 'comment.placed'` per §7.7"). Steps reference single-source-of-truth file paths from each consumed §; never restate logic.

**Response** — success-path response shape with exact field names. JSON shape for Route Handlers; discriminated-union shape for Server Actions per §4.4. Schema lives in the corresponding source-of-truth file (e.g., `src/server/bets/place.ts` exports the response type via `$inferSelect` per ADR-0008); §13's Response block names the field set, not the runtime validator.

**Errors** — table mapping every precondition violation and every system-step failure mode to a stable `error_code` from §15.4's catalogue. **Cross-reference invariant: every `error_code` listed here must exist in §15.4.** A flow file that cites an undefined code fails the HARDEN-phase CI lint. The Errors block is exhaustive — undocumented error paths are a contract violation, not a graceful-degradation surface.

**Invariants** — post-conditions that hold after the flow completes successfully. Each invariant cross-references its §14 row + the test file path that asserts it. Examples: "INV-1 (atomic bet+comment per §14.1) — verified by `tests/invariants/I-ATOMICITY-001.bet-comment-atomic.spec.ts`," "Bucket-A append-only on `bets` per §6.2 — verified by `tests/db/triggers/bets-append-only.spec.ts`."

**Acceptance** — named integration tests that verify end-to-end behaviour, each given as a path under `tests/`. **Cross-reference invariant: every name listed here must resolve to a real test.** A flow file that cites a non-existent test fails the HARDEN-phase CI lint.

The six-field structure is mandatory. A flow file missing any of the six is a contract violation.

### §13.2 Read-flow shape — degenerate Invariants block

Four flows are pure reads with no state mutation: **F-DEBATE-1** (debate view render), **F-DEBATE-2** (market detail render), **F-DEBATE-4** (debate view poll), **F-ADMIN-5** (audit-log search). These flows write nothing — no `events` row, no current-state row, no `mod_actions` row.

Read flows carry the same six-field block, but the Invariants block is **degenerate** — it contains the literal text:

> *No state mutation; INV-1 / INV-2 / INV-3 / INV-4 do not apply. Read-time correctness rides on §3.3 R-* pattern semantics.*

The Invariants field is NOT omitted (the template is mandatory), but its content is the standardised degenerate text above. The Acceptance block is NOT degenerate — read flows still carry named acceptance tests verifying cache-bypass behaviour, render-correctness, sort-order-correctness.

The four read flows are the only flows with the degenerate variant. Every other F-* (write or async) carries a substantive Invariants block.

### §13.3 The F-* file inventory

Thirty-seven per-flow contract files in v1 across seven prefix families. Each file lives at `docs/specs/flows/F-<family>-<n>.md` (provisional path under SCAFFOLD.2 per 3-A R4 — D5 patch discipline if SCAFFOLD.2 ratifies different).

| F-* ID | SPEC.1 § | Shape (Write / Read) | Gating tracker task |
|---|---|---|---|
| F-BET-1 (entry — bet + atomic comment) | §7 | W (W-1 per §3.2) | ENGINE.8 |
| F-BET-2 (subsequent buy) | §7 | W (W-1) | ENGINE.8 |
| F-BET-3 (sell) | §7 | W (W-1) | ENGINE.8 |
| F-BET-4 (bet detail render) | §7 | R | ENGINE.8 |
| F-BET-5 (market closed at) | §7 | W (W-1 sub-case) | ENGINE.8 |
| F-BET-6 (in-flight timeout) | §7 | W (W-1 sub-case) | ENGINE.8 |
| F-BET-7 (failed payment / Dharma underflow) | §7 | W (W-1 sub-case) | ENGINE.8 |
| F-BET-9 (post-resolution view) | §7 | R | ENGINE.8 |
| F-BET-10 (cross-market summary) | §7 | R | ENGINE.8 |
| F-COMMENT-1 (additional post-bet + comment) | §8 | W (W-1 — comment-bearing post-bet per §3.2) | DEBATE.2 |
| F-COMMENT-2 (reply-bet + comment) | §8 | W (W-1 — comment-bearing reply-bet per §3.2) | DEBATE.2 |
| F-COMMENT-3 (image-attached bet + comment) | §8 | W (W-1 — image-attached comment-bearing bet per §3.2) | DEBATE.2 + SCAFFOLD.15 |
| F-COMMENT-4 (comment edit — STRUCK from v1 per SPEC.1 §8) | §8 | — | (none — struck) |
| F-COMMENT-5 (comment delete — STRUCK from v1 per SPEC.1 §8) | §8 | — | (none — struck) |
| F-DEBATE-1 (debate view render) | §9 | R (degenerate Invariants per §13.2) | DEBATE.4 |
| F-DEBATE-2 (market detail render) | §9 | R (degenerate Invariants per §13.2) | DEBATE.5 |
| F-DEBATE-3 (post-resolution lock state) | §9 | W (W-3 read-side) | ENGINE.9 |
| F-DEBATE-4 (debate view poll) | §9 | R (degenerate Invariants per §13.2) | DEBATE.4 |
| F-RESOLVE-1 (resolve) | §10 | W (W-3) | ENGINE.9 |
| F-RESOLVE-2 (correction) | §10 | W (W-3 correction variant) | ENGINE.9 |
| F-RESOLVE-3 (void) | §10 | W (W-3 void variant) | ENGINE.9 |
| F-AUTH-1 (Google OAuth) | §13 | W (signup sequence per §3.5) | SCAFFOLD.3 |
| F-AUTH-2 (Email + OTP) | §13 | W (signup sequence per §3.5) | SCAFFOLD.3 |
| F-AUTH-3 (pseudonym assignment) | §13 | W (per §3.5) | SCAFFOLD.3 |
| F-AUTH-4 (ToS acceptance) | §13 | W (per §3.5) | SCAFFOLD.3 |
| F-AUTH-ADMIN (admin login) | §13 | W (per §3.5 disjoint admin path) | SCAFFOLD.3 |
| F-AUTH-5 (logout) | §13 | W (per §8.6) | SCAFFOLD.3 |
| F-MOD-1 (auto-ban on Track A) | §14 | W (Track A side-effect) | DEBATE.7 |
| F-MOD-2 (Track A flag-only mode degrade) | §14 | W | DEBATE.7 |
| F-MOD-4 (atomic bet+comment under moderation) | §14 | W (W-1 + §10) | DEBATE.7 |
| F-MOD-5 (user banned mid-session) | §14 | R | DEBATE.7 |
| F-ADMIN-1 (create market) | §15 | W (admin actor per §3.6) | UI.6 |
| F-ADMIN-2 (seed pool) | §15 | W | UI.6 |
| F-ADMIN-3 (trigger resolution) | §15 | W (per ADR-0010) | UI.6 |
| F-ADMIN-4 (moderation action) | §15 | W (per F-MOD-* dispatch) | UI.6 |
| F-ADMIN-5 (audit-log search) | §15 | R (degenerate Invariants per §13.2) | UI.6 |

**F-BET-8 was deleted** per SPEC.1 change-log 2026-05-03 — "structurally impossible under F-AUTH-ADMIN" (no participant identity exists for the admin actor that F-BET-8 would have needed). Inventory carries 9 F-BET-* IDs (1, 2, 3, 4, 5, 6, 7, 9, 10), not 10.

**F-COMMENT-4 + F-COMMENT-5 are struck** per SPEC.1 §8 — comment edit and comment delete are not v1 features (the append-only `comments` discipline per §6.2 forecloses both at the database layer). **F-COMMENT-6 / F-COMMENT-7 / F-COMMENT-8 (friendly-fire up/down/clear) are removed entirely** under the v1.9.0 reply-as-bet model (ADR-0017): there is no standalone friendly-fire vote, so there are no friendly-fire flows. The friendly-fire **toggle** (ADR-0058) lives inside F-COMMENT-2 as a field of the reply-bet and mints no flow file. Inventory carries 3 active F-COMMENT-* IDs (1, 2, 3 — all comment-bearing bets) plus the two struck rows (4, 5) retained as audit trace.

**Total: 37 active F-* files** across 7 prefix families: F-BET-* (9), F-COMMENT-* (3 active + 2 struck audit-trace), F-DEBATE-* (4), F-RESOLVE-* (3), F-AUTH-* (6), F-MOD-* (5), F-ADMIN-* (5). *(Drift note: the family breakdown and the "37" total carry a pre-existing internal inconsistency vs the literal active-row count in the table above — `F-MOD-3` absent from the table, `F-BET-8` deleted — predating the SYNC.7 fold. This residual prose↔table reconciliation, plus the `F-MOD-3` in/out and `F-DATASET-1` mint-or-strike calls, is **MAINT.15**. **DEBATE.9 physically deletes the three struck `F-COMMENT-6/7/8.md` skeletons** — on disk despite the inventory having written them off — so the `docs/specs/flows/` on-disk file count (previously 40) now matches the "37 active" prose; only the prose↔table gap remains for MAINT.15. This pass changed only the F-COMMENT family, 6 active → 3 active.)*

Multi-task gates use `+`: F-COMMENT-3 = DEBATE.2 + SCAFFOLD.15 (image upload integration spans both DEBATE.2's Server Action wiring and SCAFFOLD.15's R2 bucket policy authoring).

### §13.4 Drafting cadence — per-file deferred to gating implementation task

Per-flow contract files are NOT drafted at SPEC.2 v1.0 lock. The 37 F-*.md files are minted incrementally in the same commit as the gating implementation task: ENGINE.8's commit lands the 9 F-BET-*.md files; DEBATE.2's commit lands F-COMMENT-1/2/3.md; and so on per the §13.3 gating column.

The cadence is deliberate: each flow's Pre / System / Response / Errors / Invariants / Acceptance block authored against the actual implementation, not pre-implementation guesswork. The implementation task's pull request lands the F-*.md file alongside the production code; the six-field block reflects what the code actually does. This forecloses the drift class where flow files describe an aspirational behaviour the implementation never delivers.

**Exception: skeleton files at SCAFFOLD.2.** SCAFFOLD.2 mints empty F-*.md files (file path + heading + the six section markers, no substance) for all 37 flows so that downstream task-tracking has consistent file-path destinations from the start. Substance fills in per the gating-task cadence above. The empty-skeleton commit also lands `docs/specs/flows/README.md` naming the §13 contract as the authority. This is the state on disk: 36 of 37 files carry six `<placeholder>` markers and no content.

### §13.5 Acceptance-path alignment

**Acceptance alignment.** Every name in any Acceptance block must resolve to a real test under `tests/`. The HARDEN-phase CI lint walks every `F-*.md` file's Acceptance block and asserts each named path exists; a name that resolves to nothing is a build error. The former requirement bound these names to a catalogue in SPEC.1 §17, which D-29 removed on 2026-09-06; the flows keep their inline Acceptance lines and the tests themselves are now the referent.

### §13.6 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| The six-field block contract | §13.1 |
| Read-flow degenerate Invariants variant | §13.2 |
| F-* file inventory + gating-task table | §13.3 |
| Per-flow Pre / System / Response / Errors / Invariants / Acceptance content | `docs/specs/flows/F-*.md` (37 files; per gating task cadence). 36 of the 37 are SCAFFOLD.2 skeletons at this writing; only `F-DEBATE-4.md` carries content |
| Empty-skeleton-flow-files mint | SCAFFOLD.2 + `docs/specs/flows/README.md` |
| Error-code catalogue (consumed by every Errors block) | §15.4 |
| Acceptance test paths (cited by every Acceptance block) | `tests/` |
| Cross-reference CI lint (Errors → §15.4) | HARDEN.* |

ADRs consumed by §13: ADR-0003 (Server Actions vs Route Handlers cadence informs Response shape per §4.4), ADR-0004 (F-AUTH-1/2 mounted route handlers), ADR-0005 (W-1 / W-3 transaction shapes referenced by System blocks; the v1.8.x W-2 comment-only shape is retired), ADR-0008 (drizzle-zod typed-row response shapes), ADR-0010 (admin-actor encoding cited by F-RESOLVE-* + F-ADMIN-* System blocks), ADR-0011 (`identity_pool` consumption cited by F-AUTH-3 System block), ADR-0013 (bet transaction wrapper cited by F-BET-* + F-COMMENT-* System blocks), ADR-0014 (pre-commit moderation cited by every comment-bearing-bet System block — F-BET-1/F-BET-2 + F-COMMENT-1/2/3 — superseded by ADR-0046), ADR-0015 (Idempotency-Key header + rate-limit class cited by F-* Pre blocks), ADR-0016 (URL-exposure rule cited by F-* with raw-UUID-vs-pseudonym surfaces), ADR-0017 (reply-as-bet model + per-side reply-bet aggregates cited by F-COMMENT-1/2/3 + F-DEBATE-1/4 System blocks; supersedes ADR-0009), ADR-0018 (two-floor minimum-bet write-path check cited by F-BET-* + F-COMMENT-* Pre blocks). The 37-file inventory + gating-task table is the canonical SCAFFOLD.2 deliverable target.

---

## §14 Invariant Contract

§14 owns the *cross-cutting invariant enforcement contract* for the experiment-phase build — the four named invariants (INV-1, INV-2, INV-3, INV-4) that the system MUST preserve, the construction-layer mechanism that physically enforces each one (Postgres trigger, transaction shape, application gate, schema constraint), and the canonical test path that asserts each invariant holds end-to-end. SPEC.1 §5 owns the *product-level* invariant statements — what each invariant *means* in plain language and why it's load-bearing for thesis correctness. §6 owns the *append-only enforcement contract* (the trigger plumbing). §3 owns the *transaction shapes* (W-1 bet/comment · W-3 resolution; the v1.8.x W-2 comment-only shape is retired under reply-as-bet). §8 owns the *auth-layer construction* (session-deferral hook). §13 owns the *flow-file Invariants block discipline* (every flow file's Invariants block cross-references its §14 row). This §14 sits at the *invariant → mechanism → test* mapping layer, naming how each invariant is enforced and where to find the proof.

The four invariants are not pruned, renumbered, or deferred. INV-1 (atomic bet+comment), INV-2 (no Dharma overdraft), INV-3 (comments side-bound at post time), INV-4 (append-only resolutions) are the canonical four; new invariants would mint via ADR + same-commit SPEC.1 + SPEC.2 update, never silently. The mechanism column is normative; the test column is the verification surface.

### §14.1 The four invariants

| ID | Statement | Mechanism (construction layer) | Canonical integration test |
|---|---|---|---|
| **INV-1** | Atomic bet+comment: a comment-bearing bet and its mandatory commentary commit together or both abort together. Every post and reply is a bet+comment pair — no comment without a stake exists at all (the comment-free **sell** is the only bet that carries no comment). | (i) §3.2 W-1 lock-order chain runs the `bets` + `comments` inserts inside one Postgres SERIALIZABLE transaction at `src/server/bets/transaction.ts` per ADR-0013 — applies to every comment-bearing bet (entry, subsequent, additional post, reply, image); (ii) the structural binding is enforced by `bets.comment_id` NOT NULL (a bet cannot persist without its comment) plus the §3.2 W-1 atomic transaction (the comment and its bet commit or abort together); `comments.bet_id` is deliberately NULL (circular-pair / append-only — see §5.1) and is not the enforcement mechanism; (iii) §10 moderation is dispatched after the transaction commits and never gates it; (iv) §6.2 Bucket-A trigger on `bets` + `comments` rejects any UPDATE / DELETE that could orphan one without the other. | `tests/invariants/I-ATOMICITY-001.bet-comment-atomic.spec.ts` |
| **INV-2** | No Dharma overdraft: a participant's `dharma_ledger`-derived balance never goes negative; every bet is escrow-funded against the participant's available balance at write time. | (i) §3.2 W-1 dharma-ledger insert sits inside the SERIALIZABLE transaction with pool-row pessimistic lock per ADR-0013; (ii) `dharma_ledger` is Bucket-A append-only per §6.2 — rows are insert-only; the canonical balance is the latest row's `balance_after` (running total), and `SUM(amount)` equals it **excluding `uncollectable`** rows (the forgiveness record where `balance_after = previous_balance`, `amount ≤ 0`); (iii) handler-level pre-flight check at `src/server/bets/place.ts` rejects bets where `available_balance < stake` BEFORE opening the transaction (advisory layer); (iv) the trigger from (ii) is the ground truth — a bug bypassing the handler check fails at the database layer. | `tests/invariants/I-NO-OVERDRAFT-001.dharma-ledger-monotone.spec.ts` |
| **INV-3** | Comments side-bound at post time: every comment is structurally tied to the side (YES / NO) the participant held at the moment of posting; flipping sides later does NOT retroactively re-attribute prior comments. | (i) §8.3 session-deferral hook construction-layer protection — a participant cannot hold a session cookie before pseudonym + ToS exist, foreclosing pre-pseudonym writes; (ii) under reply-as-bet every comment rides a bet, which is itself a YES/NO stake — `comments.side_at_post_time` is populated from the side of that bet INSIDE the W-1 bet transaction (`src/server/bets/transaction.ts`), so the comment's side is the bet's side by construction, not a separate read that could drift; (iii) `comments` is Bucket-A append-only per §6.2 — once written, the side column cannot mutate; (iv) the §3.2 W-1 lock order `pools → positions → dharma_ledger → events` runs the position update and the comment insert in the same SERIALIZABLE transaction, so a concurrent flip cannot race the side binding. | `tests/invariants/I-SIDE-BIND-001.comment-side-frozen.spec.ts` |
| **INV-4** | Append-only resolutions: a market's resolution is recorded as one row in `resolution_events` (Bucket A) plus one row per affected bet in `payout_events` (Bucket A); corrections and voids are NEW rows referencing prior `resolution_events.id` via `corrects_event_id`, never updates of prior rows. | (i) §3.2 W-3 fan-out runs in one Postgres SERIALIZABLE transaction per `src/server/resolution/settle.ts` (and `correct.ts` / `void.ts`) per ADR-0013; (ii) `resolution_events` + `payout_events` are Bucket-A append-only per §6.2 — corrections cannot UPDATE prior rows; (iii) `markets.status` whitelisted Bucket-C transition (`Open` → `Resolved \| Voided`) per §3.6 is the only mutation on `markets` permitted at resolution; (iv) the §8.3 session-deferral hook protection is irrelevant for INV-4 (admin actor doesn't carry a session cookie of the participant type), but the parallel admin-side construction (§8.4 admin authentication path) is the equivalent — admin auth is required before any `resolve` / `correct` / `void` Server Action executes. | `tests/invariants/I-APPEND-ONLY-001.resolutions-append-only.spec.ts` |

The four-row mapping is exhaustive at v1. No fifth invariant currently anticipated; new invariants land via ADR + dual-spec same-commit update.

### §14.2 Two-test-layer split

The invariants are verified at two distinct test layers. Both layers are MUST; neither alone is sufficient.

**Unit-test layer.** Per-mechanism granular tests at `tests/db/triggers/<table>-append-only.spec.ts` (the §6.6 twelve-file suite covering Bucket-A + Bucket-B trigger discipline) and per-handler logic tests at `tests/server/<domain>/<handler>.spec.ts`. These verify that each mechanism in the §14.1 table fires correctly in isolation — the trigger rejects the bad UPDATE, the handler computes `side_at_post_time` correctly under the read lock, the `dharma_ledger` debit equals the bet stake exactly. Unit tests are fast, run on every PR, and are the first line of regression defense.

**Integration-test layer.** End-to-end tests at `tests/invariants/I-<INV>-NNN.<descriptive-slug>.spec.ts` per the §14.1 canonical-test column. These verify that the invariant holds across the full handler stack under realistic conditions — a real PostgreSQL test container, a real bet handler with real moderation mocks, real session cookies, real concurrent transactions where applicable. Integration tests are slow (test-container spin-up + per-test transaction setup), gated to nightly + pre-merge-to-main runs, and are the verification of record for invariant correctness.

The two-layer split is deliberate: a passing unit test demonstrates that *one* mechanism works as designed; a passing integration test demonstrates that *all* mechanisms compose correctly to enforce the invariant. INV-2 is the load-bearing example — the trigger (Bucket-A append-only on `dharma_ledger`) and the handler check (`available_balance < stake`) and the transaction wrapper (SERIALIZABLE + pool-row lock) all need to compose; a unit test for any one of them passes while the composition could still leak. The integration test runs concurrent bets against a single user with insufficient balance and asserts the user's final balance is non-negative across all observed outcomes.

**File-naming convention.** Integration tests at `tests/invariants/I-<INV-NAME>-NNN.<descriptive-slug>.spec.ts` where:
- `<INV-NAME>` is the canonical invariant slug: `ATOMICITY` (INV-1), `NO-OVERDRAFT` (INV-2), `SIDE-BIND` (INV-3), `APPEND-ONLY` (INV-4).
- `NNN` is a 3-digit zero-padded counter starting at 001 per invariant — multiple integration tests per invariant are expected as edge cases surface during HARDEN.* phases (concurrent posting, cross-market interaction, admin-actor edge cases).
- `<descriptive-slug>` is a short kebab-case description of the test scenario.

The four files named in the §14.1 canonical-test column are the seed integration tests; each is `001` of its respective invariant series. Subsequent edge-case tests increment the counter (`I-NO-OVERDRAFT-002.concurrent-bets-single-user.spec.ts`, etc.) as HARDEN.* uncovers new attack surfaces.

### §14.3 Cross-reference contract

Every flow file's Invariants block at `docs/specs/flows/F-*.md` MUST cross-reference its applicable §14 rows + the canonical test path. Per §13.1 + §13.6 the cross-reference invariant is HARDEN-phase CI-lint enforced — a flow file that cites an invariant ID not in §14.1 is a build error; a flow file that omits an applicable invariant from its block (where applicability is determined by §3.2 W-pattern membership) is a code-review flag, not a build error.

The four read flows from §13.2 (F-DEBATE-1, F-DEBATE-2, F-DEBATE-4, F-ADMIN-5) carry the standardised degenerate-Invariants text per §13.2 — they do NOT cross-reference §14 rows because no state mutation occurs.

Each invariant names its canonical test; an invariant without one is a coverage gap.

### §14.4 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Four invariants × mechanism × canonical-test mapping | §14.1 |
| Two-test-layer split + file-naming convention | §14.2 |
| INV-1 W-1 transaction wrapper | `src/server/bets/transaction.ts` (per §9 + ADR-0013) |
| INV-2 handler pre-flight balance check | `src/server/bets/place.ts` |
| INV-3 `side_at_post_time` population | within the W-1 bet transaction at `src/server/bets/transaction.ts` (comment-bearing bet construction; the v1.8.x `src/server/comments/place.ts` is folded into the bet path) |
| INV-4 W-3 resolution wrapper | `src/server/resolution/settle.ts` (per §3.6) |
| INV-3 + INV-4 auth-layer construction | `src/server/auth/session-gate.ts` (per §8.3 session-deferral hook) |
| Bucket-A trigger SQL covering `bets`, `comments`, `dharma_ledger`, `resolution_events`, `payout_events` | `drizzle/migrations/<NNNN>_append_only_triggers.sql` (per §6 + ADR-0005) |
| Per-mechanism unit-test suite | `tests/db/triggers/<table>-append-only.spec.ts` + `tests/server/<domain>/<handler>.spec.ts` |
| Canonical integration tests per invariant | `tests/invariants/I-<INV>-001.<slug>.spec.ts` (four files; ENGINE.7 / DEBATE.2 / ENGINE.9 / SCAFFOLD.2 land per implementation cadence) |
| §13 flow-file Invariants block discipline | §13.1 + §13.6 |

ADRs consumed by §14: ADR-0004 (Better Auth session-deferral hook backing INV-3), ADR-0005 (Bucket-A append-only classification backing INV-1 / INV-3 / INV-4), ADR-0008 (Drizzle migration set + per-domain schema-file split), ADR-0010 (admin auth construction backing INV-4 admin-actor surface), ADR-0013 (W-1 SERIALIZABLE transaction backing INV-1 / INV-2), ADR-0014 (pre-commit moderation outside the transaction backing INV-1 — moderation never opens partial state — superseded by ADR-0046; moderation is not in the transaction at all), ADR-0017 (reply-as-bet model backing INV-1's every-comment-is-a-bet pairing and INV-3's side-from-bet binding). 3-C absorbs the §8.3 session-deferral-hook auth-layer mechanism into INV-3's mechanism column alongside the existing Postgres-trigger mechanism; 3-A R3 confirms INV-1 / INV-2 / INV-3 / INV-4 set is canonical and not pruned.

---

## §15 Error Code Envelope Shape

§15 owns the *error-envelope contract* for the experiment-phase build — the six-field envelope shape every error response carries (HTTP layer for Route Handlers + discriminated-union layer for Server Actions per §4.4), the closed nine-value `error_type` enum that classifies every code, the three-value `retry_semantics` enum that signals client retry behaviour, §15.4, which mints every named code, and the cross-reference invariant that ties Errors blocks in flow files (§13) to catalogue rows. SPEC.1 §13 + §16.2 own the *per-flow* error-code references in product behaviour; ADR-0013 / ADR-0014 (superseded by ADR-0046) / ADR-0015 / ADR-0010 own the *operational* codes minted in their respective decisions; this §15 sits at the *envelope contract layer*, naming the shape every error code conforms to without enumerating the codes themselves (the catalogue does that).

The discipline is strict: §15 names the envelope, the enums, the catalogue file, and the cross-reference invariant; it does NOT enumerate codes (the catalogue file does), it does NOT pick HTTP status mappings per code (each code's catalogue row does), and it does NOT decide retry policy per code (the catalogue row's `retry_semantics` field does).

### §15.1 The six-field envelope

Every error response carries exactly six fields:

| Field | Type | Notes |
|---|---|---|
| `code` | `string` (snake_case) | Stable identifier from the catalogue at §15.4. Never includes HTTP status, version, or trailing identifiers — bare snake_case names. The prefix discipline (bare vs `error_`) is locked at PRECURSOR.4 per §15.6 carry-forward. |
| `message` | `string` | Display template, interpolated client-side. May contain `{placeholder}` substitution points populated from `field_errors` or contextual handler data. NEVER carries dynamic user-input or PII — templates are static at build time. |
| `error_type` | enum (closed 9-value, §15.2) | Classification axis: which response category does this code belong to (validation / auth / not_found / conflict / rate_limited / unavailable / gone / internal / forbidden). |
| `retry_semantics` | enum (closed 3-value, §15.3) | Client retry hint: `retry_safe` / `retry_after` / `do_not_retry`. |
| `retry_after` | `number` (seconds) \| `null` | Present iff `retry_semantics === "retry_after"`. NULL otherwise. Mirrors HTTP `Retry-After` header on Route Handler responses. |
| `field_errors` | `Record<string, string[]>` \| `null` | Server Action surfaces only — per-field validation error payload for the React 19.2 `useActionState` contract. NULL on Route Handler responses. |

The six-field envelope is mandatory. A response missing any field — including null-valued `retry_after` and `field_errors` where applicable — is a contract violation.

**Route Handler envelope** wraps the six fields in the `ok: false` discriminator per §4.4: `{ ok: false, error: { code, message, error_type, retry_semantics, retry_after, field_errors } }`. **Server Action return shape** wraps the same six in the `{ ok: false, error: ... }` discriminated-union form with `field_errors` populated.

### §15.2 `error_type` enum (closed 9-value)

Nine canonical error types. Every code in the catalogue MUST belong to exactly one. The enum is closed — adding a tenth requires an ADR + same-commit catalogue migration.

| `error_type` | HTTP status family | Semantic |
|---|---|---|
| `validation` | 400 | Client request malformed or fails business-rule validation (e.g., `error_idempotency_key_invalid`, `error_market_closed_at`). |
| `auth` | 401 | Authentication missing or invalid (e.g., `error_session_required`, `error_admin_login_invalid`). |
| `forbidden` | 403 | Authentication present but operation not authorized (e.g., `error_origin_not_allowed`, `error_admin_session_required` on participant Server Actions). |
| `not_found` | 404 | Resource does not exist or is not visible to the requester (e.g., `error_market_not_found`, `error_user_not_found`). |
| `conflict` | 409 | State conflict resolvable by client retry with different parameters (e.g., `error_idempotency_key_reused`, `error_idempotency_in_flight`). |
| `rate_limited` | 429 | Per-surface rate limit exceeded (e.g., `error_rate_limit_exceeded`). |
| `gone` | 410 | Resource permanently unavailable (e.g., `error_otp_expired`, `error_tos_version_changed`, `error_experiment_concluded`). |
| `unavailable` | 503 | Upstream vendor or transient resource exhaustion (e.g., `error_idempotency_unavailable`, `error_bet_serialization_exhausted`). |
| `internal` | 500 | Server-side bug or precondition violation (e.g., `error_internal`, trigger-fired-from-bug paths per §6.4). |

The mapping HTTP status ↔ `error_type` is normative for Route Handler responses; Server Action returns carry only the `error_type` field (no HTTP status to user code per §4.4).

**Client branching guidance.** Clients SHOULD branch on `error_type` first (categorical handling: show validation field hints on `validation`, redirect to login on `auth`, surface upstream-degraded banner on `unavailable`, etc.), then on `code` for code-specific UX (the exact copy + recovery affordance varies per code within a type).

### §15.3 `retry_semantics` enum (closed 3-value)

Three canonical retry modes. Every code in the catalogue MUST carry exactly one.

| `retry_semantics` | Semantic |
|---|---|
| `retry_safe` | Client MAY retry the request immediately with the same parameters and expect success on transient-cause resolution (e.g., a network blip during a `validation`-type response — extremely rare; most `retry_safe` codes are `unavailable`-type with brief recovery windows). |
| `retry_after` | Client MUST wait at least `retry_after` seconds before retrying. Codes: `error_rate_limit_exceeded`, `error_idempotency_in_flight`, `error_idempotency_unavailable`, `error_bet_serialization_exhausted`. |
| `do_not_retry` | Client MUST NOT retry the same request. Either the request is permanently invalid (most `validation` + `auth` + `forbidden` + `gone` codes), or retrying would corrupt state (most `conflict` codes — fix the parameters first), or retrying would cost a quota tick without changing the outcome (most `not_found` codes). |

The asymmetry between `retry_safe` (rare) and `do_not_retry` (default for most codes) is deliberate: SPEC.1 §13 + §16.2's product behaviour favours explicit user action on most error paths over silent client retry, on the principle that the user benefits from seeing the error and choosing whether to proceed (rather than the client silently retrying and the user not learning what went wrong).

### §15.4 The catalogue baseline — 39 codes (38 at SPEC.2 v1.0 lock + AUDIT-FIX-B3)

**§15.4 is the canonical 39-code catalogue** (38 at v1.0 lock + `error_position_conflict`, added by AUDIT-FIX-B3 / ADR-0031) — the source-breakdown table below is the authoritative enumeration. **§15.4 is the canonical catalogue and the only one.** The standalone `docs/specs/error-codes.md` was a named forward deliverable; the promise is withdrawn (D-28 r15) and the five `MUST` clauses that bound to it are removed. The §15.5 cross-reference CI lint checks flow files against §15.4. **Baseline: 39 codes** (38 verified at PRECURSOR.4 + `error_position_conflict` added by AUDIT-FIX-B3 / ADR-0031; the SPEC.2 §0 changelog reconciliation is sweep-deferred per `parked.md`). This catalogue is the baseline of cross-cutting and folded-ADR codes; additional per-flow product-validation codes defined in the flow contracts (the participant flows and the admin flows) — including `insufficient_shares` (HTTP 400 `error_type: validation`, `retry_semantics: do_not_retry` — the F-BET-3 oversell pre-check, AUDIT-FIX-B3 / ADR-0031, mirroring `insufficient_dharma`) — are aggregated into §15.4's catalogue, which the §15.5 lint verifies. Codes mint from the following sources — every code in the catalogue MUST originate from one:

| Source | Count | Examples |
|---|---|---|
| **SPEC.1 §13** (auth-flow business validation) | 11 | `error_oauth_callback_error`, `error_turnstile_failed`, `error_otp_invalid`, `error_otp_expired`, `error_otp_rate_limited`, `error_email_delivery_failed`, `error_tos_acceptance_required`, `error_tos_version_changed`, `error_admin_login_invalid`, `error_admin_session_persistence_failed`, `error_session_persistence_failed` |
| **SPEC.1 §15** (audit-log + reactive-removal codes) | 4 | `error_session_required`, `error_admin_session_required`, `error_user_not_found`, `error_market_not_found` |
| **ADR-0013** (bet concurrency model) | 4 | `error_bet_serialization_exhausted`, `error_market_closed_at`, `error_in_flight_timeout`, `error_internal` (catch-all for trigger-fired-from-bug paths per §6.4) |
| ADR-0046 (advisory moderation) | 0 | none — moderation produces no participant-facing error code |
| **ADR-0015** (rate-limit + idempotency) | 6 | `error_idempotency_key_required`, `error_idempotency_key_invalid`, `error_idempotency_key_reused`, `error_idempotency_in_flight`, `error_idempotency_unavailable`, `error_rate_limit_exceeded` |
| **ADR-0010** (admin auth) | 1 | `error_origin_not_allowed` (bet-endpoint Origin defense per §4.3 — minted alongside admin contract though not exclusive to admin path) |
| **SPEC.2 §3.5** (signup sequence) | 4 | `error_identity_pool_exhausted`, `error_pseudonym_assignment_failed`, `error_storage_unavailable` (R2-outage path per §12.8), `error_image_upload_invalid` |
| **SPEC.2 §17** (observability surface — alarm-1 trigger-violation surfacing) | 2 | `error_validation` (catch-all for handler-level Zod validation failures), `error_payload_too_large` (per ADR-0006 R2 PUT body-size violations) |
| **SPEC.2 §20** (conclusion-event freeze) | 1 | `error_experiment_concluded` (HTTP 410 `error_type: gone`, `retry_semantics: do_not_retry` — fired by middleware on any state-mutating endpoint after 2026-11-05 23:59 UTC per §20.2) |
| **ADR-0031 / AUDIT-FIX-B3** (durable bet receipts + terminal error mapping) | 1 | `error_position_conflict` (HTTP 503, `error_type: unavailable`, `retry_semantics: retry_after`, `retry_after: 1` — the single-side write-race loser per §9 / ADR-0031; prefixed despite its bare sibling `bet_serialization_exhausted`, a known bare-vs-`error_` drift PRECURSOR.4 sweeps) |
| **Total** | **39** | |

**Codes NOT yet in catalogue, deferred to PRECURSOR.4.** Two known gaps surfaced during 3-C absorption:

- The bare-vs-`error_`-prefix split deliberation: SPEC.1 + ADR-0013 + ADR-0014's (superseded by ADR-0046) prose currently uses bare snake_case names (e.g., `bet_serialization_exhausted`); ADR-0015's prose uses prefixed names (e.g., `error_idempotency_key_required`). PRECURSOR.4 ratifies one convention and applies a uniform sweep across SPEC.1 + ADRs + catalogue.
- Admin-only flow error-code completeness — F-ADMIN-1 / F-ADMIN-2 / F-ADMIN-3's product-validation error codes (e.g., "market title too long," "pool seed amount invalid") are not yet enumerated in §13.4-style tracker-task gates, and the catalogue's admin-flow coverage is sparse. PRECURSOR.4 reviews and either adds rows or accepts the sparseness as in-scope-but-unenumerated.

**§4.4 cross-reference invariant**: §4.4's three idempotency-code references (`error_idempotency_key_required`, `error_idempotency_key_invalid`, `error_idempotency_key_reused`) are mechanically aligned to the prefixed forms ADR-0015 mints; the bare-form references in v0.2-draft were stale and have been corrected at v0.3-draft (per §0.1 row's silent reconciliation).

### §15.5 Cross-reference invariant (HARDEN-phase CI lint)

Two-direction invariant between flow files and catalogue:

**Direction A: Flow file → catalogue.** Every `error_code` in any per-flow `docs/specs/flows/F-*.md` Errors block must exist in §15.4's catalogue. The HARDEN-phase CI lint walks every `F-*.md` file and asserts each cited code has a §15.4 row; a flow file that cites an undefined code is a build error.

**Direction B: Catalogue → flow file.** Every code in §15.4 SHOULD appear in at least one F-*.md file's Errors block (or be marked `internal_only: true` in the catalogue row for codes minted purely from infrastructure failure paths — e.g., `error_internal`, trigger-violation surfacing). A catalogue row not cited by any flow AND not marked `internal_only` is flagged at HARDEN-phase for review (not a build error — sometimes the gap is legitimate, e.g., a code that only fires under operational disaster conditions).

**Catalogue row shape.** Each row carries: `code`, `error_type`, `retry_semantics`, `retry_after_default` (NULL for non-retry-after codes), `http_status` (for Route Handler responses), `description`, `internal_only` flag, source citation (which §/ADR mints the code). The catalogue shape is a versioned markdown table; SCAFFOLD.* implements alongside the F-*.md skeleton mint.

**Catalogue row count cross-reference.** §15.4's 39-code baseline (38 at v1.0 lock + `error_position_conflict` from AUDIT-FIX-B3 / ADR-0031) is the canonical count. PRECURSOR.4 verifies the catalogue file has exactly 39 rows (modulo any codes that PRECURSOR.4 adds via the deferred items). A drift between §15.4's count and the catalogue file's row count is a PRECURSOR.4 review fail.

### §15.6 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Six-field envelope shape | §15.1 |
| Closed 9-value `error_type` enum | §15.2 |
| Closed 3-value `retry_semantics` enum | §15.3 |
| Canonical 39-code catalogue (38 at v1.0 lock + `error_position_conflict`, AUDIT-FIX-B3 / ADR-0031) | **§15.4 source-breakdown table** |
| Per-flow Errors blocks | `docs/specs/flows/F-*.md` (per §13) |
| Bare-vs-`error_`-prefix decision | PRECURSOR.4 carry-forward (per §0.1 row) |
| Admin-only flow code completeness | PRECURSOR.4 carry-forward (per §0.1 row) |
| Cross-reference CI lint (Direction A + Direction B) | HARDEN.* |
| Server Action `field_errors` runtime | React 19.2 `useActionState` per §4.4 |
| Route Handler `Retry-After` HTTP header sourcing | Mirror `error.retry_after` field per §15.1 |

ADRs consumed by §15: ADR-0010 (admin auth code mint), ADR-0013 (bet concurrency code mint), ADR-0014 (pre-commit moderation code mint — superseded by ADR-0046), ADR-0015 (rate-limit + idempotency code mint). 3-C absorbs the six-field envelope shape + 9-value error_type enum + 3-value retry_semantics enum as new authoring; 3-E A8 ratifies the 38-code baseline (shifted from 37) with new `error_experiment_concluded` row + new "SPEC.2 §20: 1 code" source-breakdown row.

---

## §16 Identifiers (shape)

> **[Substantively absorbed from ADR-0016 (SPEC.17) on 2026-05-08.]**

UUIDv7 (RFC 9562) is the universal primary-key type across the SPEC.2 §5 table inventory. Substrate, function name, default-expression form, Better Auth column-type strategy, `identity_pool` PK shape, and the URL-exposure rule are ratified in ADR-0016. SPEC.2 §16 names the load-bearing contract.

**Substrate.** Userspace `public.uuidv7()` PL/pgSQL function shipped as a hand-written raw SQL migration in the Drizzle migration set at `drizzle/migrations/<NNNN>_uuidv7_function.sql`, adapted from the kjmph gist's pure-SQL variant (RFC 9562 compliant; endorsed by Supabase staff in discussion #9500 as the recommended workaround on Postgres 17). Postgres 18's native `pg_catalog.uuidv7()` is the long-run target; cutover when Supabase ships PG 18 is a single DDL statement (`DROP FUNCTION public.uuidv7()`) with zero schema-wide rewrites — the function-name choice is the load-bearing forward-compatibility decision. The `pg_uuidv7` C extension is not used (not on Supabase's allowlist as of 2026-05-08; three open requests since March 2024 unactioned per ADR-0016 §Drivers).

**Drizzle column declaration.** Every primary-key column in the §5 inventory is declared as:

```ts
import { sql } from "drizzle-orm";
import { pgTable, uuid } from "drizzle-orm/pg-core";

id: uuid("id").primaryKey().default(sql`uuidv7()`),
```

The DB-side default expression emits `DEFAULT uuidv7()` in the generated DDL, so raw-SQL inserts (the events insert helper at `src/server/events/insert.ts` per ADR-0005, ETL during `HARDEN.*` operational runbooks, manual `psql` writes) get a correct PK without app-layer participation. App-layer code paths that need a UUIDv7 outside a database default (test fixtures, seed scripts, the Better Auth `generateId` callback) import `v7 as uuidv7` from the npm `uuid` package.

**Better Auth full override.** All four Better Auth tables (`user`, `session`, `account`, `verification`) carry the schema-uniform `uuid` PK — Better Auth's default 32-character base62 random string format is overridden via:

```ts
advanced: {
  database: {
    generateId: () => uuidv7(),
  },
},
```

in `src/server/auth/index.ts` (the single source of truth for the Better Auth instance per ADR-0004). The Drizzle schemas at `src/db/schema/auth.ts` declare `id` as `uuid` with the standard `default(sql\`uuidv7()\`)` clause. The `session.token` field — Better Auth's separate 32-char random session-cookie value used as the cookie payload — is **untouched** by this contract; only the row's `id` PK is affected. The hand-rolled `admin_sessions` table per ADR-0010 carries the same default as every other table (no carve-out, no special treatment).

**`identity_pool` PK shape.** Synthetic UUIDv7 `id` PK + `UNIQUE (colour, animal, number)` enforcing natural-triple uniqueness as a separate constraint. Schema uniformity wins over the natural-key compactness; the 16-byte × 50K-row = 800 kB synthetic-column overhead is negligible.

**URL-exposure rule.** Raw UUIDs are forbidden on participant-facing routes — pseudonyms (per ADR-0011) are the URL-exposed identifier on every user-routed page. Concretely: `/u/RedFox001` (not `/u/0193abcd-...`); `/m/<market-slug>` (not `/m/<market-uuid>`); comment permalinks reference the comment's natural ordering or a server-rendered short ID (not the raw `comments.id`). Raw UUIDs are **allowed** on admin-only routes under `/admin/*` (gated by F-AUTH-ADMIN per ADR-0010 — admin-operator ergonomics during moderation), and **allowed** in the 2026-11-06 dataset release (per SPEC.1 §12.2 — raw UUIDs are the correct join primitive for offline analysis). The rule is enforced at the route-handler level, not the URL parser; the acceptance test `id::raw-uuid-not-in-participant-urls` regex-asserts no participant-facing route file accepts a raw UUID as a path parameter.

**Per-backend monotonicity caveat.** Both PG 18's native `uuidv7()` and the userspace fallback produce UUIDs that are strictly monotonic per backend process only; **neither produces UUIDs that are strictly monotonic across the Supavisor connection pool** (per ADR-0006 transaction-pooling mode). Application code MUST NOT assume `id(request N+1) > id(request N)` even within a session. The canonical chronological-sort column for cross-row ordering is `created_at`; UUIDv7's time prefix is an implementation detail that informs single-row creation timestamp recovery (via `uuid_extract_timestamp()` per RFC 9562 §6.2), not cross-row ordering. SCAFFOLD.2 / ENGINE.* / DEBATE.* MUST sort by `created_at` (or by an explicit ranking-function score per ADR-0009) for any read path that needs cross-row chronological order. The acceptance test `id::uuidv7-monotonic-within-millisecond` verifies within-backend monotonicity only; cross-backend ordering is explicitly NOT tested.

**Single source of truth.** `drizzle/migrations/<NNNN>_uuidv7_function.sql` owns the PL/pgSQL function definition. `src/server/auth/index.ts` owns the Better Auth `generateId` override. `src/db/schema/auth.ts` owns the four Better Auth column-type overrides (`id` flipped from `text` to `uuid`). `tests/server/identity/no-raw-uuid-in-urls.test.ts` owns the URL-exposure-rule acceptance-test helper. App-layer UUIDv7 generation imports `v7 as uuidv7` from the npm `uuid` package directly at the call site (no project-internal helper module — the convention is one import line and abstracting it would just add indirection). The full file map is absorbed into Appendix A on its drafting pass.

ADR-0016 holds the full decision body, six dimensions of considered options with verdicts, and the closing italic summary. SPEC.2 §16 is the cross-reference; ADR-0016 is the canonical text.

---

## §17 Observability Contract

§17 owns the *observability contract* for the experiment-phase build — the two-vendor stack (Sentry for errors + PostHog for analytics + feature flags), the Vercel runtime logs as the third surface for structured request logging, the consolidated alarm catalogue spanning every alarm fired across the codebase, the PostHog `useFlag()` runtime contract with safe-`defaultValue` per-call-site discipline, the fail-open posture symmetric across all three observability surfaces, the no-body-logging discipline at the request log surface, and the cost ceiling. ADR-0007 owns the *vendor decision substance* — Sentry vs alternatives, PostHog vs alternatives, why Vercel runtime logs vs a third request-log vendor; this §17 sits at the *observability contract layer*, naming the alarm catalogue, the runtime contracts, and the cross-cutting failure-mode posture.

The discipline is strict: §17 names the six-row master alarm catalogue + five-row alarm-6 sub-table + `useFlag()` contract + fail-open posture; it does NOT decide threshold values per alarm (HARDEN.* number-tuning territory per §17.7), it does NOT enumerate v1 feature-flag inventory (SCAFFOLD.6 territory), and it does NOT design uptime monitoring of the hosting providers themselves (HARDEN.* territory — Sentry cannot observe its own host going down).

### §17.1 Vendor stack

Three observability surfaces, all with fail-open semantics per §17.5:

| Surface | Vendor | Purpose | Cost tier |
|---|---|---|---|
| **Errors + alarms** | Sentry | Server-side and client-side error capture, custom-event-fired alarms, source-map-resolved stack traces tagged with Vercel deploy releases | Free tier (5K events/month) — well within experiment scale |
| **Analytics + feature flags** | PostHog | Product analytics on participant funnel, leaderboard surfacing, feature-flag evaluation via `useFlag()` runtime contract per §17.4 | Free tier (1M events/month) — well within experiment scale |
| **Structured request log** | Vercel runtime logs | Per-request structured log entries (timestamp, user_id-or-anon, route, status_code, IP, user_agent, latency_ms — NO request body, NO response body per §17.6) | Bundled with Vercel hosting (no separate billing) |

The two-vendor-plus-Vercel split is deliberate. A third vendor for structured request logging (Datadog, Logflare, Axiom) would add monthly cost without unique value at experiment scale; Vercel's bundled runtime logs handle the H3 structured-request-log requirement from SPEC.1. Sentry session-replay is **disabled in v1** per ADR-0007 — privacy concerns + cost amplification + redundancy with the events log + Vercel runtime log + Postgres audit trail outweigh debugging benefit.

**Sentry deploy hook.** Vercel deploys fire a webhook to Sentry tagging the deploy SHA as a Sentry release; source maps upload alongside. Stack traces in Sentry events resolve to TypeScript source positions automatically. The webhook URL lives in Vercel project settings under `SENTRY_DEPLOY_HOOK_URL`; same lifecycle as `SENTRY_AUTH_TOKEN` per ADR-0007.

### §17.2 Master alarm catalogue (nine rows + alarm-6 sub-table)

The alarm catalogue consolidates every Sentry alarm fired across the codebase. Nine master rows; alarm 6 has a five-row sub-table per §17.3 because vendor-unavailability alarms have distinct sub-IDs per vendor that downstream code (per §11, per §10, per §17.6) cites directly.

| # | Alarm name | Trigger | Cited from |
|---|---|---|---|
| **1** | Append-only-trigger violation | Postgres `RAISE EXCEPTION` from BEFORE UPDATE / BEFORE DELETE on any of the 13 protected tables per §6 | §6.7, ADR-0005, ADR-0008, ADR-0014 |
| **2** | DEFAULT-partition insert (events table) | A row present in the `events_default` partition (any insert with `created_at` outside the 12 named monthly partitions per §7.2). Detected drain-side: the `alarms-drain` cron probes `SELECT count(*) FROM events_default` each `*/5` tick and fires the `events_default_nonempty` Sentry event (title-matched) when non-zero; re-fires under Sentry fingerprint dedup while the partition stays non-empty (AUDIT-FIX-B1 / OQ-c). Supersedes the prior `pg_cron` meta-query transport — `pg_cron` cannot emit to Sentry, which is why the drain exists. **AUDIT-FIX-B5 / A30** adds a *sibling tagged capture* at `src/server/events/insert.ts` — **not** a numbered master alarm (tag note beside the events-integrity alarm): `event_id_reuse_payload_mismatch` fires (fail-open, via `safeCaptureException`) when the `insertEvent` write yields an inserted-count of 0 (the `ON CONFLICT (event_id, created_at) DO NOTHING` skipped an existing row) AND the existing row's payload — read **in the same statement**, via a data-modifying CTE that fuses the payload sub-select into the insert (so no separate post-write statement exists that could abort an otherwise-committable transaction; a bare two-statement re-SELECT is a fail-open violation and MUST NOT be reintroduced) — differs from the incoming payload (canonicalized deep-compare per the `canonicalize` dependency — Postgres jsonb does not preserve key order, so a raw string compare would false-mismatch). Logs `event_id` + differing key **names** only, never payload values (PII). A same-`event_id`/same-payload retry dedups **silently** (no capture, no throw — the §7.3 storage-idempotency retry-purity path must still succeed). When the fused read returns no row (the conflicting row committed outside this snapshot; `ON CONFLICT` dedupes at index level regardless of snapshot visibility) the guard treats it as *cannot-compare → stay silent* (fail-open), never a mismatch. | §7.2, ADR-0005 |
| **3** | 40001-retry exhaustion (bet transaction wrapper) | Bet wrapper at `src/server/bets/transaction.ts` exhausts 3 retries on SQLSTATE 40001 / 40P01 per ADR-0013 + §9 | §9, ADR-0013 |
| **4** | OpenAI moderation upstream failure rate | Volume/rate threshold (HARDEN.* per §17.7) over OpenAI moderation vendor-boundary terminal-failure events, fired at `src/server/moderation/openai.ts`: `safeCaptureException(err, { tags: { kind: "openai_moderation_upstream_failure" } })` on the non-transient and retries-exhausted arms, plus `safeCaptureException(err, { tags: { kind: "openai_moderation_auth_failure" } })` on the 4xx auth-error sub-class (failed-closed without retry). Both are fail-open side-effects: a capture that cannot be written is logged and dropped. Moderation itself has no failure posture on the request path (§10), so there is no `ModerationUnavailableError` seam to fail at. | §10, ADR-0014 — superseded by ADR-0046 |
| **5** | Identity-pool low-watermark | `identity_pool` row count drops below 5% of initial 50,000 — fired by `pg_cron` meta-query per §3.4 Pattern A-1 | §3.5, SPEC.1 §15.2, ADR-0011 |
| **6** | Per-vendor unavailability + cron job failure | Five sub-IDs per §17.3 — Upstash rate-limit, Upstash idempotency, R2, pg_cron job-run failures, Vercel Cron R2-orphan-sweep handler 5xx | §10, §11, §12, §17.6 |
| **7** | 40001-retry exhaustion (resolution transaction wrapper) | W-3 wrapper at `src/server/resolution/transaction.ts` exhausts 3 retries on SQLSTATE 40001 / 40P01 — Sentry event `resolution_serialization_exhausted`, tags `{ sqlstate, flow }` (ENGINE.9, rider R-K) | §3.6, §9, ADR-0013 Patch record P2 |
| **8** | 40001-retry exhaustion (lifecycle transaction wrapper) | W-4 wrapper at `src/server/markets/transaction.ts` exhausts 3 retries on SQLSTATE 40001 / 40P01 — Sentry event `lifecycle_serialization_exhausted`, tags `{ sqlstate, flow }` (ENGINE.14, S5 disposition CR-1, gate-ratified 2026-06-12) | §3.8, §9, ADR-0013 Patch record P3 |
| **9** | Bet-handler internal error (caught 500) | Bet endpoint catch (`src/server/bets/endpoint.ts`) converts an unrecognized failure to a `500 error_internal` envelope — `safeCaptureException(err, { tags: { kind: "bet_handler_internal_error" } })` fires only on that fallthrough arm (the 503 paths are captured at their own sources). The original `err` is preserved, so a caught append-only `RAISE` reaches Sentry with its message intact (available to alarm-1 tuning at HARDEN.*). Covers `/api/bets/place` + `/api/bets/sell` (shared catch) (AUDIT-FIX-B1 / A5). **AUDIT-FIX-B3 / ADR-0031** adds two *sibling tagged captures* on the bet path — **not** numbered master alarms (tag notes, recorded here beside their shared catch): (a) `position_oversell_backstop` — fires in the same endpoint catch when a `PositionOversellError` storage-backstop reaches it *after* the `sell()` product pre-check should have caught it; it maps to `400 insufficient_shares` (not 500), so it is distinct from this alarm's fallthrough arm; (b) `durable_replay_precheck_failed` — the durable receipt pre-check fails **open** on a DB error in `src/server/bets/replay.ts` (correctness is backstopped by the tx-level unique per §9). | §9, ADR-0005, ADR-0013, ADR-0031 |

Alarm rows 1-5, 7, and 9 are consumed by single citation surfaces; alarm 6's sub-IDs are consumed across multiple citation surfaces (§10 cites 6c, §11 cites 6a + 6b, §12 cites 6c + 6e, §17.6 cites 6d), warranting the structuring elaboration.

### §17.3 Alarm-6 sub-table

Five sub-IDs. Each fires a distinct Sentry custom event with a distinct tag for downstream alarm-tuning at HARDEN.*. The sub-IDs are stable identifiers consumed across §10 / §11 / §12 prose at v0.3-draft:

| Sub-ID | Vendor | Trigger | Sentry tag |
|---|---|---|---|
| **6a** | Upstash (rate-limit) | Rate-limit middleware catches Upstash error per §11 fail-mode contract; admits the request (fail-open posture) | `upstash_unavailable_rate_limit` |
| **6b** | Upstash (idempotency) | Idempotency cache helper catches Upstash error. **Two site classes** (AUDIT-FIX-B1 / B3): (i) the cache-**lookup** path per §11 fail-mode contract rejects the request with HTTP 503 (fail-closed posture); (ii) the completion-**write / release** path (AUDIT-FIX-B3 / ADR-0031) swallows the error — fail-**open** on the response path, so a committed bet's response still reaches the client — and alarms. A `site` sub-tag discriminates them (implements ADR-0015 §3's completion-write alarm half). | `upstash_unavailable_idempotency` (`site` sub-tag: lookup — absent; release closure — `site: release`; endpoint finally belt — `site: endpoint_finally`) |
| **6c** | R2 (object storage) | R2 client wrapper at `src/server/storage/r2.ts` catches R2 outage per §12.8 — fires on signed-PUT mint failure, signed-READ mint failure, orphan-sweep DELETE failure, and `headObject` failure (the pre-serve verify-object HEAD per ADR-0028, non-404 R2-down arm) | `r2_unavailable` |
| **6d** | `pg_cron` job-run failures | `pg_cron` meta-query over `cron.job_run_details` per §3.4 Pattern A-1 catches any job's terminal failure (events partition monitor, `identity_pool` low-watermark check, `markets`-state drift detection) | `pg_cron_job_failure` |
| **6e** | Vercel Cron R2-orphan-sweep handler 5xx | Vercel Cron HTTP-fanout target at `src/app/api/cron/r2-orphan-sweep/route.ts` returns non-2xx; Vercel surfaces in cron run history | `vercel_cron_handler_5xx` |

Per-sub-ID threshold tuning is HARDEN.* territory per §17.7; v0.3-draft locks the sub-ID identifiers and the consumer-surface citations.

### §17.4 PostHog `useFlag()` runtime contract

Feature-flag evaluation runs through a single `useFlag()` runtime contract at `src/server/flags/use-flag.ts` (renamed from initial drafts; the path is the single source of truth per ADR-0007). The contract is:

```ts
function useFlag(name: string, defaultValue: boolean): boolean
```

Three locked properties:

1. **Local-evaluation only.** PostHog's local-evaluation mode runs in-process against the cached feature-flag config (refreshed on a periodic SDK-managed interval); no network round-trip on the call path. This bounds latency at zero and forecloses the case where a slow PostHog response stalls a request handler.
2. **Safe `defaultValue` per call site.** Every call site MUST pass a `defaultValue` that is operationally safe for the surface — typically `false` for "feature OFF" so the call site fails closed to the pre-feature behaviour. The discipline is per-call-site, not enforced at the function boundary; HARDEN.* code review catches `defaultValue` choices that would surface a half-baked feature on PostHog outage.
3. **Returns `defaultValue` on outage.** PostHog SDK errors (network failure, JSON parse error, config corruption) cause `useFlag()` to return `defaultValue`. No exceptions propagate. This is the fail-open posture for the flag surface — outage degrades to pre-flag behaviour, never to error.

The contract is consumed across the codebase: A/B tests on UI affordances, per-cohort experimental features (e.g., the Track A degrade mode flag from §10 + ADR-0014 — superseded by ADR-0046), per-environment debug surfaces. The v1 feature-flag inventory itself is SCAFFOLD.6 territory; §17 names only the runtime contract.

### §17.5 Fail-open posture (symmetric across observability surfaces)

All three observability surfaces fail open. Per ADR-0007 + §17.4:

- **Sentry.** SDK errors silently dropped; reports never propagate exceptions back to the request handler. A Sentry outage means errors that would normally page someone are lost — the user-facing flow continues to work (just unalarmed).
- **PostHog.** `useFlag()` returns `defaultValue` on outage per §17.4. Analytics events buffered locally and dropped on prolonged outage; never block the request path.
- **Vercel runtime logs.** Log-line emission is fire-and-forget at the runtime level; UI degradation does not affect log emission. Even total Vercel runtime-log UI outage means logs are written and queryable later.

The symmetric fail-open posture is asymmetric to §10 (moderation is advisory and never fails a request) and §11 (idempotency fails closed). Observability does NOT cross the legal-floor or correctness boundaries that moderation and idempotency cross — observability dropping events degrades visibility, not data integrity.

### §17.6 Structured request log + no-body-logging discipline

Per SPEC.1 H3 — structured request log served by Vercel runtime logs with the field set:

```
timestamp · user_id-or-anon · route · status_code · IP · user_agent · latency_ms · request_id
```

`request_id` is a **forward obligation**, not yet emitted: the shipped `logRequest` field set is locked at seven. Until it lands, cross-surface correlation flows Sentry-tag → `events.metadata.request_id` (§3.7); the runtime-log leg of the §17.6 walkthrough activates when the eighth field ships. (AUDIT.1 B8 item-5 reconciliation, 2026-07-07.)

**No request body, no response body.** This is a code-level discipline. Route handlers MUST NOT call `console.log(req.body)`, `console.log(await req.json())`, `console.log(response)`, or any equivalent that emits body content to the runtime log. The discipline is enforced at HARDEN.* CI lint (per §17.7's deferred items list) — a regex check over the codebase flagging body-emitting log calls before merge to `main`.

The rationale: request body and response body carry user content (comments, OTP codes, image upload metadata, ToS acceptance evidence) that must not surface in operational logs. Vercel runtime logs are accessible to Vercel staff during support escalation; the no-body-logging discipline is a privacy-and-confidentiality control.

The `request_id` field (per §3.7's seven-field events.metadata set) is the canonical correlation key between Vercel runtime logs and the events log. A support-escalation walkthrough flows: read Sentry alert → extract `request_id` from the Sentry tag → query Vercel runtime logs by `request_id` → query events log by `metadata.request_id` for the in-database trace. Three observability surfaces, one correlation key.

`pg_cron` failures don't surface in the per-request log — they surface in `cron.job_run_details` and fire alarm 6d per §17.3. This is correct: cron jobs aren't request-scoped, so they don't carry a `request_id`; their observability runs on a separate channel.

### §17.7 HARDEN.* deferral list

Operational specifics deferred from §17:

- **Specific alarm thresholds.** All six master alarms + five sub-IDs carry threshold values deferred to HARDEN.* number-tuning + alarm-tuning passes. v1.0 lock names the alarm identifiers and trigger conditions; the literal "fire after N events in M minutes" tuning is HARDEN.* territory.
- **CI lint for body-redaction logging.** §17.6's no-body-logging discipline is HARDEN.* CI-lint enforced. v1.0 lock names the discipline; the lint regex is HARDEN.* implementation.
- **External uptime monitoring of hosting providers.** Sentry cannot observe Sentry's own host going down; PostHog cannot observe PostHog's. An external uptime ping (e.g., a third-party uptime service polling production endpoints from outside the Vercel/Supabase stack) is HARDEN.* territory. v1.0 ships without it.
- **v1 feature-flag inventory.** The set of named flags consumed across the codebase is SCAFFOLD.6 territory. §17 names only the `useFlag()` runtime contract.

### §17.8 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Sentry SDK initialization (server + client) | `src/server/observability/sentry.server.ts` + `src/lib/observability/sentry.client.ts` |
| PostHog SDK initialization | `src/server/observability/posthog.server.ts` |
| `useFlag()` runtime contract | `src/server/flags/use-flag.ts` |
| Master alarm catalogue + alarm-6 sub-table | §17.2 + §17.3 |
| Sentry deploy-release tagging via Vercel webhook | Vercel project settings + `SENTRY_DEPLOY_HOOK_URL` env var |
| Vercel runtime log access (operational, not file-based) | Vercel dashboard + `vercel logs` CLI |
| `pg_cron` job-run-details meta-query for alarm 6d | `drizzle/migrations/<NNNN>_pg_cron_job_failure_alarm.sql` |
| Cost ceiling | $50/mo single-tier across both vendors per ADR-0007 |
| HARDEN.* CI lint for body-redaction logging | HARDEN.* (per §17.7) |
| Threshold tuning for all alarms | HARDEN.* (per §17.7) |

ADR-0007 holds the full decision body, dimensions of considered options with verdicts, and the closing italic summary. SPEC.2 §17 is the cross-reference and the alarm catalogue source. ADRs consumed by §17: ADR-0005 (Bucket-A trigger violations backing alarm 1; events DEFAULT-partition backing alarm 2), ADR-0006 (R2 outage backing alarm 6c; pg_cron architecture backing alarm 6d; Vercel Cron carve-out backing alarm 6e), ADR-0007 (Sentry + PostHog vendor selection + Vercel runtime log substrate + cost ceiling), ADR-0011 (`identity_pool` low-watermark backing alarm 5), ADR-0013 (40001-retry exhaustion backing alarm 3), ADR-0014 (OpenAI moderation upstream failure backing alarm 4 — superseded by ADR-0046), ADR-0015 (Upstash unavailability backing alarm 6a + 6b).

---

## §18 Sybil & Security Model

§18 owns the *threat model and sybil-defense contract* for the experiment-phase build — the set of attacks the v1 codebase explicitly defends against, the set of attacks deliberately out of scope (deferred to testnet phase or accepted as residual risk for the experiment's research-grade deployment), the layered sybil-defense surface across five distinct mechanisms (Cloudflare Turnstile + Google Identity Services + OTP rate-limit pair + per-IP anti-abuse caps + §8.7 structural-separation rule), the admin/participant six-property structural-separation-by-data-model construction backing B5, and the ToS acceptance enforcement at the legal-floor surface. SPEC.1 §16.1 owns the *product-level* rate-limit constants; SPEC.1 §14 owns the *safety-floor* constraints (CSAM detection + reporting compliance, ToS evidence retention; NCMEC auto-reporting scrapped (D-28 r7); the admin reports at their discretion); §8 owns the *auth contract* including the seven-pillar structural-separation rule; ADR-0004 owns the Cloudflare Turnstile vendor wiring; ADR-0010 owns the static-password admin auth; ADR-0014 (superseded by ADR-0046) owns the pre-commit moderation safety-floor coupling. §18 sits at the *threat model and defense layering* surface, naming what defends against what without re-mintage of substance the consumed sources already own.

The discipline is strict: §18 names the threat model + the defense-mechanism inventory + the structural-separation construction; it does NOT decide rate-limit numeric values (HARDEN.6 territory), it does NOT pick Turnstile site-key configuration (ADR-0004 owns), and it does NOT design admin-key rotation procedure (ADR-0010 + `BREAK_GLASS.md` own). v1 is a research-grade experiment with sole-MM operation, soulbound-Dharma-only consequences, and a hard 2026-11-05 23:59 UTC write-freeze; the threat model is calibrated to that scope.

### §18.1 Threat model

Six classes of threat. Three in-scope (defended); three out-of-scope (deferred or residual-accepted).

| # | Threat class | In/out of scope | Rationale |
|---|---|---|---|
| **1** | **Account creation abuse** (bot-driven sybil; mass auto-account creation to inflate pseudonym pool consumption or accumulate Dharma allowance) | **In scope** | Two-vendor anti-bot defense (Turnstile + Google Identity Services) + OTP rate-limit pair gates F-AUTH-2; pseudonym pool consumption is constrained per §3.5 + ADR-0011 (50K-row pool with 5% low-watermark alarm). |
| **2** | **Per-surface request abuse** (credential-stuffed traffic against bet endpoints, image-PUT-URL mint endpoints, OTP send endpoints, admin login endpoint) | **In scope** | Per-account, per-IP and per-identifier sliding-window rate limits across the §11 surfaces per ADR-0015 + ADR-0054 + SPEC.1 §16.1; `bet-user` 1m is the load-bearing cap on bet writes, with `bet-ip` 1m behind it as the cross-account backstop, and `image-put-ip` 1m + `admin-login-ip` 1h the load-bearing per-IP caps elsewhere. |
| **3** | **Admin compromise** (stolen `ADMIN_PASSWORD`, leaked admin cookie, admin-account takeover) | **In scope** | Static-password auth via `crypto.timingSafeEqual` + transactional `DELETE+INSERT` single-row-at-any-moment + two-layer middleware-plus-validator per CVE-2025-29927 + identical-401 information-leak avoidance + `BREAK_GLASS.md` rotation procedure per ADR-0010 + §8.4. The single-admin assumption per SPEC.1 §15 + E4 is structural. |
| **4** | **Coordinated-stake attacks** (one party operating multiple legitimate accounts to manipulate market price or inflate a post's Support/Counter via coordinated reply-bets) | **Out of scope** | Defense surface deferred to testnet phase (proof-of-personhood gating, on-chain identity binding). v1 sole-MM operation + soulbound-Dharma-only consequences + research-grade scope make the residual risk acceptable; the 2026-11-06 dataset release exposes coordinated-stake patterns post-hoc for research analysis. |
| **5** | **Insider threat** (admin-actor acting in bad faith — manipulating market resolution, suppressing comments, exfiltrating PII) | **Out of scope (residual-accepted)** | Single-admin assumption per E4; admin actions are append-only-audited via `admin_events` (Bucket A per §6.2) + `mod_actions` (Bucket A per §6.2) + INV-4 append-only resolutions. Detection runs post-hoc on the 2026-11-06 dataset; prevention via single-admin trust assumption. Multi-admin or admin-key-rotation-on-compromise is post-experiment scope. |
| **6** | **Network-layer / infrastructure attacks** (DDoS, BGP hijack, certificate-authority compromise, Vercel/Supabase/R2 supply-chain) | **Out of scope (vendor-mitigated)** | Vercel + Cloudflare + Supabase carry their own DDoS + WAF + cert-rotation defenses; v1 codebase does not re-implement at the application layer. Out-of-scope is acceptance of the vendor mitigation surface, not absence of defense. |

The threat model is calibrated to the experiment's research-grade deployment. Threats 4 + 5 + 6 are deliberately out-of-scope at v1; testnet phase and beyond redraw the model under proof-of-personhood + multi-admin + economic-stake conditions.

### §18.2 Sybil-defense layered surface

Five distinct mechanisms compose to defend against threats 1 + 2. Each has its own surface, its own failure mode, and its own consumer-section in this spec.

| # | Mechanism | Surface | Failure mode | Source |
|---|---|---|---|---|
| **(a)** | Cloudflare Turnstile | F-AUTH-2 OTP issuance via `hooks.before` middleware on the Better Auth `/email-otp/send-verification-otp` path | **Fail-closed** — siteverify failure rejects OTP request with HTTP 400 `error_turnstile_failed`; never invokes Resend. Legal-floor consent surface symmetric to §10 / §11 idempotency / moderation. | §8.2 + ADR-0004 |
| **(b)** | Google Identity Services abuse signals | F-AUTH-1 OAuth callback with `email_verified === true` enforcement | **Fail-closed at the predicate** — accounts where Google has not verified email are rejected with `error_oauth_email_not_verified`; the OAuth provider's own anti-bot signals (account age, behavior-pattern flags) ride upstream. | §8.2 + ADR-0004 |
| **(c)** | OTP rate-limit pair | F-AUTH-2 OTP send endpoint | **Fail-open per §17.5** — Upstash outage admits the request; Sentry alarm 6a fires per §11. Two parallel `Ratelimit.limit()` calls (`otp-email:{email}` 1h + `otp-ip:{ip}` 1m); both must succeed. | §11 + ADR-0015 + SPEC.1 §16.1 |
| **(d)** | Per-account + per-IP anti-abuse caps | Bet-flow + image-PUT-URL mint surfaces | **Fail-open per §17.5** — `bet-user:{users.id}` 1m (the fairness cap) + `bet-ip:{ip}` 1m (the 10x backstop) + `image-put-ip:{ip}` 1m sliding windows. Constants `BET_ATTEMPTS_PER_USER_PER_MIN` (ADR-0054), `BET_ATTEMPTS_PER_IP_PER_MIN` + `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` (ADR-0015); numeric values deferred to HARDEN.6. | §11 + ADR-0015 + ADR-0054 |
| **(e)** | §8.7 seven-pillar structural-separation rule | Admin / participant universe boundary | **Construction-layer, no failure mode** — admin is structurally outside the participant graph (no `users.role` column, no admin `users` row, two distinct cookie names + paths + tables, no FK between `admin_sessions` and `users`, never-cross-cookie-validation, inline-admin-affordances-validate-at-backend). Backs B5 via data-model construction. | §8.7 |

The layering is asymmetric: (a)+(b) defend account-creation per threat 1; (c) defends OTP abuse specifically; (d) defends per-surface request abuse per threat 2; (e) is the structural-separation construction backing admin / participant disjointness per threat 3 + §18.4. No mechanism is load-bearing alone — defense-in-depth means a single mechanism's bypass does not cascade to total compromise.

### §18.3 ToS acceptance enforcement (legal-floor surface)

Per SPEC.1 §14 + ADR-0004's session-deferral hook (§8.3). ToS acceptance is enforced server-side, not client-side. The construction-layer protection:

- **Session-cookie cannot issue before ToS acceptance.** §8.3's `databaseHooks.session.create.before` hook reads `users.tos_accepted_at` for the `session.userId` and throws `APIError("FORBIDDEN", { message: "ONBOARDING_REQUIRED" })` if NULL. No participant cookie reaches the client until F-AUTH-4 has written acceptance evidence.
- **Acceptance evidence is mandatory and persistent.** F-AUTH-4 writes `users.tos_accepted_at` (timestamp), `users.tos_version_hash`, `users.privacy_version_hash`, `users.tos_acceptance_ip`, `users.tos_acceptance_user_agent` in one Postgres transaction (default isolation) per §3.5. The `users` row is Bucket C (mutable) per §5.1 row 14, but the four ToS-evidence columns are write-once-then-immutable by application convention (no UPDATE path mutates them; H2 erasure null-s them per §19.4 along with PII columns).
- **ToS version change forces re-acceptance.** A change to the canonical ToS document MUST mint a new `tos_version_hash` and the next `databaseHooks.session.create.before` evaluation against an existing session compares stored hash to current hash; a mismatch routes back to F-AUTH-4 with `error_tos_version_changed` (HTTP 410 `error_type: gone`). Version-change cadence is procedural, not v1-tooling — the canonical ToS document lives outside the codebase.
- **Privacy policy parallel.** `privacy_version_hash` follows the same shape; a privacy-policy change forces re-acceptance via the same hook path.

The 2026-11-05 23:59 UTC write-freeze (per §20) preserves ToS evidence in `users` rows for the dataset release — `tos_acceptance_ip` and `tos_acceptance_user_agent` are PII-stripped at H2 export per §19.4, but the `tos_accepted_at` timestamp + version hashes are preserved as research-relevant metadata.

### §18.4 Admin / participant six-property structural separation

The §8.7 seven-pillar rule promotes to a six-property summary in §18 prose. The promotion is intentional — §8.7's seven pillars are the per-pillar enumeration each load-bearing on auth-contract correctness; §18.4 is the higher-order assertion that admin and participant universes are structurally non-overlapping at the data-model layer, which is the construction-layer protection of B5 and the defense surface for threat 3.

Six properties:

1. **No shared identity row.** Admin has no `users` row; participant identities cannot be admin. Verified by §5.1 row 14 (`users` schema carries no `role` column).
2. **No shared session table.** `sessions` (Better Auth-managed, FK to `users.id`) and `admin_sessions` (hand-rolled, no FK) are structurally disjoint.
3. **No shared cookie name.** `zugzwang_session` and `zugzwang_admin_session` are non-overlapping; per §8.5 the path scopes (`/` vs `/admin`) make a single browser unable to present both to the same path.
4. **No shared validator.** Participant Server Actions and Route Handlers validate `sessions` only; admin equivalents validate `admin_sessions` only. Cross-cookie-type access is rejected at handler entry per §8.7 pillar 6.
5. **No shared events surface.** Participant auth flows write to `user_events`; admin auth flows write to `admin_events` (per §8.8). Encoding: `metadata.user_id = NULL` + `metadata.actor_id = 'admin-singleton'` for admin-actor events; `metadata.user_id = users.id` + `metadata.actor_id = users.id` (self-actor) for participant events.
6. **No shared FK in audit tables.** `admin_events` and `mod_actions` reference admin-actor rows by string identifier `'admin-singleton'` (a sentinel value), not by FK. The participant audit surface (`user_events`) references `users.id` via FK. Cross-table joins between admin and participant audit surfaces are structurally impossible.

The six-property promotion makes the construction backing B5 visible in one place. A reviewer auditing the sybil-defense surface against threat 3 (admin compromise → cascading participant compromise) sees the six structural firewalls between universes and the absence of any shared surface.

### §18.5 Data-access architecture: server-only (RLS out of scope)

Per **ADR-0019**. Row-Level Security (RLS) is **deliberately out of scope** for the experiment phase, because the database is **server-only** (Architecture 2):

- **The access topology.** Every read and write goes through the Next.js server — mutations via Server Actions (the locked mutation contract per ADR-0003) + the bet/admin Route Handlers (§4.3), reads via server route handlers / server components (§3.1, §3.3) — using a single trusted (service-role) database credential. No browser, client component, or third party ever holds a database connection. Authorization lives entirely in the server's Server Action / handler layer (Better Auth-backed per ADR-0004 + §8). This holds under the public-read / auth-gated-act posture: logged-out reads are still served *by the server* from the trusted connection, not by a client-direct query.
- **Why RLS is not load-bearing here.** RLS enforces row rules inside Postgres against whatever credential connects. In a server-only topology, RLS would police Zugzwang's *own trusted server* — which has already authorized the request — making it a redundant backstop, not a control on an exposed surface. **Build skipped; decision recorded.** (§6.5 notes the related fact that the Supabase `service_role` key bypasses RLS but does **not** bypass the append-only triggers; those Postgres-level controls per §6 + ADR-0005, plus balance `CHECK`s and NOT-NULL FKs, are independent of this RLS decision and remain in force.)
- **Tripwire (a durable invariant, not a one-time call).** This posture is valid **only** while the database stays server-only. The day any client-direct database path is introduced — a Supabase/anon client in a browser component, a public PostgREST/data endpoint, any user-scoped DB credential reaching an untrusted client — **RLS becomes mandatory before that path ships.** Any PR introducing a client-side data-access path MUST trigger this clause; flagged for the engine/handler review checklist.
- **Accepted tension.** With no RLS, the server's authorization code is the *only* lock — there is no database-level safety net if a Server Action omits an ownership/eligibility check. This is an accepted trade for the experiment and a direct argument for the writer/reviewer discipline on the engine handlers (§13 + CLAUDE.md).
- **Revisit at testnet** (real value, onchain escrow, higher stakes, likely different access topology).
- **D4 note.** The SYNC recon flagged a `supabase/migrations/` directory referenced but absent. Per ADR-0019 this needs no RLS scaffolding for this phase; if the directory is later needed for non-RLS migrations that is a separate housekeeping item, **not a security gap** (and out of SPEC.2's scope to create).

### §18.6 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Threat model in/out-of-scope inventory | §18.1 |
| Five-mechanism layered sybil defense | §18.2 |
| ToS acceptance enforcement at session-deferral hook | `src/server/auth/session-gate.ts` (per §8.3) |
| ToS acceptance evidence write at F-AUTH-4 | `src/server/auth/tos/accept.ts` (per §4.2) |
| Cloudflare Turnstile siteverify wiring | `src/server/auth/turnstile.ts` (per ADR-0004 + §8.2) |
| Six-property structural-separation enumeration | §18.4 |
| Data-access architecture / RLS posture + tripwire | §18.5 (per ADR-0019) |
| Per-IP rate-limit constants | `src/server/config/limits.ts` (per §11 + SPEC.1 §16.1) |
| `BET_ATTEMPTS_PER_USER_PER_MIN` + `BET_ATTEMPTS_PER_IP_PER_MIN` + `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` numeric values | HARDEN.6 (per §11.6) |
| `BREAK_GLASS.md` admin-key rotation runbook | `docs/runbooks/BREAK_GLASS.md` (HARDEN.10-owned per ADR-0010) |
| Admin-actor encoding to `admin_events` | §8.8 + §3.6 |
| Append-only trigger SQL backing audit-trail integrity | `drizzle/migrations/<NNNN>_append_only_triggers.sql` (per §6 + ADR-0005) |

ADRs consumed by §18: ADR-0004 (Better Auth + Cloudflare Turnstile via `hooks.before` + Google Identity Services configuration + session-deferral hook), ADR-0010 (admin auth path + static-password timing-safe comparison + two-layer middleware-plus-validator per CVE-2025-29927 + `BREAK_GLASS.md` rotation), ADR-0014 (pre-commit moderation safety-floor coupling for CSAM detection + reporting compliance per SPEC.1 §14 — NCMEC auto-reporting scrapped (D-28 r7); the admin reports at their discretion; out-of-scope at the threat-model layer; in-scope at the §10 / §17 alarm surface — superseded by ADR-0046), ADR-0015 (rate-limit + idempotency contract backing per-surface caps; new `BET_ATTEMPTS_PER_IP_PER_MIN` + `IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN` constants minted by ADR-0015 §1), **ADR-0019** (RLS out of scope — server-only Architecture 2 + tripwire, recorded at §18.5). 3-D R1–R5 + A1–A5 + B1–B5 ratifications absorbed.

---

## §19 Public Dataset Export

§19 owns the *public-dataset release contract* for the experiment-phase build — the 2026-11-06 GitHub release artifact at `zugzwang-foundation/experiment` that ships the canonical research dataset; the 13-tables-shipped / 4-not-shipped policy that determines what enters the public archive vs what is operationally-only; the PII strip-not-hash treatment that drops the ten PII columns rather than pseudo-anonymizing them; the export-time JOIN pseudonymization that maps `users.id` to pseudonym slugs at build time so cross-table joins in the released archive work via pseudonym keys; the K_eff(t) trajectory as the *only* K_eff derivation surface in v1 per SPEC.1 G3; and the `/api/dataset/manifest` endpoint contract per §4.3. SPEC.1 §12.2 owns the *product-level* dataset commitment (the public release happens, ships under a permissive license, supports replication); §3.7 + §7 own the *event-row contract* that the dataset structurally is `pg_dump` over; this §19 sits at the *export pipeline + privacy + access* layer, naming what gets shipped, how it's pseudonymized, and where readers find it.

The discipline is strict: §19 names the table inventory + per-column treatment + the export-time JOIN mechanism + the K_eff derivation surface; it does NOT pick file format (Parquet vs CSV vs SQL dump — that's §19.6 deferred to HARDEN.* per the SCAFFOLD.* cadence-aligned implementation), it does NOT decide the manifest JSON schema's exact field set (deferred to HARDEN.* alongside the manifest endpoint implementation), and it does NOT design researcher-tooling integration (out of scope; researchers use whatever they want against the static archive).

### §19.1 Release boundary + GitHub artifact

**Release date.** 2026-11-06. The release lands as a GitHub release artifact at `zugzwang-foundation/experiment` (the codebase repo; release artifacts attach to the same repo per GitHub convention); the long-lived static URL is the GitHub-served release-asset URL plus a permanent redirect from a `zugzwangworld.com/dataset` short-link (operational; not v1 ENGINE territory).

**Source-of-truth state.** The release artifact is built from a Postgres state snapshot taken at the **dataset-build point**: after the 2026-11-05 23:59 UTC write-freeze fires (per §20) *and* after the post-freeze admin conclusion work (§20.3) completes, ahead of the 2026-11-06 build. The artifact contains every row committed up to the build point. Three row classes legitimately post-date the freeze instant and appear as ordinary rows: (i) admin conclusion-event rows — resolutions, payouts, moderation (§20.3; required content — the market outcomes fire post-freeze by design); (ii) auth-surface rows from the still-live login/signup posture (§20.3); (iii) freeze accepted-window commits (§20.2) — participant bet-path requests already past the pre-transaction freeze gate when `frozen_at` flipped, committing seconds after it. Window rows are not specially marked; the release does not claim that zero participant writes committed after `frozen_at` — the guarantees are that the participant write surface *gated* from the moment the flip was readable (410 for every subsequently arriving request) and that the build point post-dates every in-flight commit, so nothing is absent. The build pipeline runs once; subsequent re-builds for bug-fixes against the same source state are acceptable (e.g., a privacy-redaction bug discovered post-release triggers a v2 of the artifact). The build pipeline does NOT run continuously during the experiment — there is no streaming or near-real-time dataset surface in v1.

**Format.** Tabular (per-table CSVs or per-table Parquet — final pick deferred to HARDEN.*) compressed into a single tarball per release. The manifest JSON file (per §19.7) names the tarball's checksum, the included file inventory, the schema-version cursor, and the per-table row counts.

**License.** CC-BY-4.0 — locked at PRECURSOR.4 alongside SPEC.1 §12.2 license language. The dataset is research-grade public-good output; the soulbound-Dharma score makes it not commercially-replicable as the live experiment, so the license question is about academic citation requirements + zero-friction usage, not commercial use protection.

### §19.2 Dataset architecture

The dataset is structurally a `pg_dump` over a deterministic view across the events log + current-state tables (per SPEC.1 §12.2). Two architectural properties make this work:

**Events log + current-state tables together carry the full state.** Per §3.7 + §7, every state-mutating data flow emits at least one events-row in the same transaction as the current-state write; the events log is the canonical audit ledger; current-state tables are co-maintained inside the same transaction for read access. Replaying the events log against an empty database reproduces the current-state tables exactly — this is the property the dataset relies on, and the property §6's append-only enforcement contract structurally guarantees.

**The dataset preserves both the events log and the current-state tables.** A consumer can either (i) read the current-state tables directly for "what's the final state" questions, or (ii) reconstruct any historical instant by replaying events against an empty database and snapshotting at the target timestamp. The redundancy is deliberate — most researchers will use the current-state tables; researchers studying time-series K_eff(t) trajectories use the events log.

The build pipeline runs `pg_dump` against a build-point Postgres replica (Supabase point-in-time recovery to the §19.1 dataset-build point), then post-processes per §19.4 (PII strip) and §19.5 (export-time JOIN pseudonymization), then packages into the tarball. The replica is short-lived (built for the export run, dropped after); the pipeline is one-shot.

### §19.3 Tables shipped vs not shipped

Per §5.1's inventory; twenty-three are dataset-relevant. **Five** tables are excluded from the dataset inventory entirely: the three pg_cron operational tables `watermark_state` + `cron_alarms` + `liquidity_heartbeat` (ADR-0047 — the injector's liveness record; it says the sweep ran, which is an operations fact and carries no research signal), the AUDIT-FIX-B3 idempotency backstop `bet_receipts` (ADR-0031 — an operational per-request receipt whose `result` content is fully derivable from `events` + `pools` (`newPrice = getPrices(post-trade reserves)`), so it carries no independent research signal), and the UI-A6 convenience table `bookmarks` (ADR-0032 — private per-viewer saved pointers at other authors' comments; Bucket C, no thesis/research signal). **Of those twenty-three: seventeen ship; five do not (operational / privacy-sensitive); ONE — `lots` — is deliberately UNDECIDED (row 22).**

| # | Table | Bucket | Shipped? | Rationale |
|---|---|---|---|---|
| 1 | `events` | A | YES | Canonical audit log; foundational for K_eff(t) reconstruction |
| 2 | `dharma_ledger` | A | YES | Per-transaction Dharma flow; foundational for participant correctness analysis |
| 3 | `bets` | A | YES | Per-bet record |
| 4 | `comments` | A | YES | Per-comment record |
| 5 | `resolution_events` | A | YES | Per-market-resolution audit row |
| 6 | `payout_events` | A | YES | Per-bet settlement |
| 7 | `mod_actions` | A | YES | Moderation audit trail (admin actions on participant content; admin-actor encoded as `'admin-singleton'`) |
| 8 | `admin_events` | A | YES | Admin-action audit trail |
| 9 | `user_events` | A | YES | User lifecycle audit trail (ToS acceptance evidence, pseudonym assignment, daily-allowance accrual) |
| 10 | `identity_pool` | B | YES | Pseudonym pool (post-experiment all 50K rows are revealed; the pool is research-relevant) |
| 11 | `image_uploads` | B | YES | Image upload lifecycle (terminal-state audit; `r2_object_key` excluded per §19.4) |
| 12 | `markets` | C | YES | Market metadata |
| 13 | `pools` | C | YES | CPMM pool reserves at freeze |
| 14 | `positions` | C | YES | Per-user-per-market position cache (final positions at freeze) |
| 15 | `users` | C | **YES with PII strip per §19.4** | Pseudonym + ToS metadata + bet/comment join keys; ten PII columns dropped |
| 16 | `market_media` | C | YES | Admin-set per-market media pool (ADR-0026/ADR-0027) — operator-curated market context; no `user_id`, no PII; ships in full per Appendix B.16 |
| 17 | `system_state` | B | NO | Operational singleton; the freeze itself is observable from the events log without the row |
| 18 | `sessions` | C | NO | Operational; per ADR-0016 D6 + SPEC.1 §12.2 — privacy-sensitive (cookie tokens, last-seen timestamps) |
| 19 | `accounts` | C | NO | Provider-side identity proof (Google OAuth account linkage); no thesis-relevant signal; PII-adjacent |
| 20 | `verifications` | C | NO | Transient OTP rows (TTL-bounded; nothing persists past the OTP send window anyway) |
| 21 | `admin_sessions` | C | NO | Operational; admin-side privacy-sensitive |
| 23 | `liquidity_policy` | A | YES | The injector's parameter history (ADR-0047 §G — *"The history ships in the dataset"*). ⛔ **Without it a reader cannot reproduce a single injection.** The target is `max(floor, coefficient × count(*) FROM users)` and NEITHER operand appears in the events: a `pool.liquidity_added` row carries the target it used and the `policyVersion` that produced it, and this table is the other half of that join. Omitting it would ship a dataset in which every injection is an unexplained jump in a reserve column — the exact opacity the backing identity exists to prevent. No PII, no `user_id`, no FK to a participant table. Every column SHIPs (Appendix B.16b). |
| 22 | `lots` | C | **UNDECIDED — SPEC.1 G3 owns this** | Per-argument lot accounting (ADR-0039). Dataset-relevant on its face: it is the decomposition of Đa the dataset has never had, and `Σ surviving_basis` is exactly the figure a reader would otherwise have to re-derive by walking the bet stream. But ADR-0039 declines the call in terms — *"Whether lots are released alongside bets is a SPEC.1 G3 question, not this ADR's"* — and PHASE-0 is a mechanical registry rider, so it records the row and the open question rather than settling one it does not own. Note what the answer is NOT contingent on: nothing is lost by waiting, because `bets` stays Bucket-A append-only and every historical stake remains exactly where it is (ADR-0039, Neutral). The columns carry no PII; `user_id` / `market_id` / `bet_id` are join keys of the same class `positions` and `bets` already ship, so a YES needs the §19.5 export-time pseudonymization and nothing else. **Until G3 rules, this row is the record that the question exists — it is not a deferral of work, it is a refusal to invent a founder decision.** |

**Shipped: 17 tables; not shipped: 5; undecided: 1 (`lots`).** Shipped = the 9 Bucket-A audit tables (`events`, `dharma_ledger`, `bets`, `comments`, `resolution_events`, `payout_events`, `mod_actions`, `admin_events`, `user_events`) + `liquidity_policy` (ADR-0047 §G — the injector's parameter history; **the only way a reader reproduces an injection**, since the target rule `max(floor, coefficient × count(*) FROM users)` is not derivable from the events alone, and it carries no PII and no `user_id`) + 2 Bucket-B (`identity_pool`, `image_uploads`) + 4 current-state-context Bucket-C (`markets`, `pools`, `positions`, `market_media`) + `users` (PII-stripped per §19.4). Not shipped = `system_state`, `sessions`, `accounts`, `verifications`, `admin_sessions` (operational / privacy-sensitive). The three pg_cron operational tables (`watermark_state`, `cron_alarms`, `liquidity_heartbeat`), the `bet_receipts` idempotency backstop (ADR-0031), and the `bookmarks` convenience table (ADR-0032) are not part of the dataset inventory at all. `lots` (ADR-0039) IS part of the inventory and is the one row whose ship/not-ship answer is open; it is counted in neither the 17 nor the 5 until SPEC.1 G3 rules, precisely so that an unanswered question cannot be mistaken for a settled NO by arithmetic.

The earlier "13 shipped + 4 not shipped" 3-E baseline was an undercount (it omitted `markets` / `pools` / `positions` from the explicit enumeration); the v0.3-draft body corrected it to 16 + 5, and this SYNC.7 pass drops `friendly_fire_events` (removed entirely per ADR-0017 — the reply-as-bet model has no friendly-fire table) bringing the shipped count to **15 + 5**. PRECURSOR.4 verifies the count alongside §15.4's 39-code baseline. The 1.0.17 SYNC sweep enumerates `market_media` (ADR-0026, Bucket C, ships in full per Appendix B.16) — omitted from this table when the table was minted at 1.0.12 — bringing the count to **16 + 5**.

### §19.4 PII strip-not-hash policy

Per ADR-0016 D6 + 3-E A1: the ten PII columns are **dropped** (set to NULL or removed from the released schema) rather than pseudo-anonymized via hash. Strip-not-hash is the chosen treatment because:

(a) **Hash collisions across columns expose patterns.** A `hash(email)` column would let an attacker who knows a target email confirm membership in the dataset; strip-not-hash forecloses confirmation attacks entirely.

(b) **Rainbow-table attacks against weak inputs.** Email, IP, and user-agent are weak-entropy inputs; even SHA-256 hashed columns are reversible against pre-computed rainbow tables. Strip wins.

(c) **Research signal from PII columns is zero.** Email, IP, and user-agent carry no thesis-relevant signal; researchers studying market behavior + commentary correctness do not need them. The hash form would be tolerated only if the signal warranted; it doesn't, so strip is strictly better.

**The ten PII columns dropped at export:**

| Column | Source table | Treatment |
|---|---|---|
| `email` | `users` | Removed from released schema (column does not appear in dataset) |
| `google_id` | `users` | Removed |
| `name` | `users` | Removed (Google display name) |
| `image` | `users` | Removed (Google avatar URL) |
| `tos_acceptance_ip` | `users` | Removed |
| `tos_acceptance_user_agent` | `users` | Removed |
| `pfp_filename` (subset — only when null-ed by H2 erasure) | `users` | Released as-is; H2-erased rows release as NULL |
| `r2_object_key` | `image_uploads` | Removed |
| `metadata.ip` | All audit tables (`user_events`, `admin_events`, `mod_actions`, `events`) | Removed at the JSONB-key level (subset of the seven-field metadata set per §3.7) |
| `metadata.user_agent` | All audit tables | Removed at the JSONB-key level |

The remaining five `metadata` fields (`request_id`, `flow_id`, `user_id`, `actor_id`, `idempotency_key`) ship in the released audit tables. The `idempotency_key` field is included because it's client-generated and carries no PII (clients send opaque random strings); the field's research value is moderate (debugging duplicate-write patterns).

**H2 erasure interaction.** Per SPEC.1 + §12.7, H2 erasure scrubs `users` PII columns + null-s `pfp_filename` while preserving the `users` row (audit-trail integrity per Bucket-C convention). At dataset-export time, H2-erased rows ship in the same shape as not-erased rows — both have NULL email, NULL google_id, etc. The dataset consumer cannot distinguish "user erased pre-freeze" from "user never had data": this is the privacy-by-design property; not a bug.

### §19.4.1 Per-payload-key STRIP rules for `events.payload`

The `events.payload` JSONB column SHIPs verbatim per §19.3 row 1 + Appendix B.13, but the per-event-type payload shapes carry PII or sensitive substrate identifiers in some keys. The export pipeline applies per-event-type STRIP rules at the JSONB-key level (analogous to `metadata.ip` / `metadata.user_agent` STRIP_KEY per §19.4 table above).

Audit trails are exhaustive at the runtime emission layer by design (INV-4 + ADR-0005 sync-target rule); export-time strip handles the privacy boundary. Two separate concerns, two separate layers. Runtime emission MUST NOT pre-strip — full payload fidelity is required for in-database forensics + admin replay.

| event_type | STRIP_KEY targets | Rationale |
|---|---|---|
| `user.tos_accepted` | `payload.ip`, `payload.user_agent` | PII per §19.4 row 3-4; redundant with `users.tos_acceptance_ip` + `users.tos_acceptance_user_agent` (already STRIP) |
| `user.oauth_signed_in` | `payload.googleId` | PII per §19.4 row 2 (mirrors `users.google_id` STRIP) |
| `user.oauth_signed_in` | `payload.userId` | Defense-in-depth — mirrors the `user.pseudonym_assigned` row; `aggregate_id` is rewritten to pseudonym per §19.5, but the raw `payload.userId` would otherwise ship and re-identify via cross-join |
| `user.otp_signed_in` | `payload.email` | PII per §19.4 row 1 (mirrors `users.email` STRIP) |
| `user.otp_signed_in` | `payload.userId` | Defense-in-depth — mirrors the `user.pseudonym_assigned` row; `aggregate_id` is rewritten to pseudonym per §19.5, but the raw `payload.userId` would otherwise ship and re-identify via cross-join |
| `user.pseudonym_assigned` | `payload.userId` | Defense-in-depth — `aggregate_id` already PSEUDO per §19.5; explicit payload strip prevents re-identification via cross-join |
| `user.signed_out` | `payload.userId` | Same rationale as above |
| `image_upload.sign_requested` | `payload.userId`, `payload.key` | `userId` PSEUDO defense-in-depth; R2 key embeds userId per SCAFFOLD.15 §Q9 (`u/<userId>/<uploadId>.<ext>`) |
| `image_upload.committed` | `payload.userId`, `payload.key` | Same rationale (DEBATE.2 future emit site) |
| `image_upload.blocked` | `payload.userId`, `payload.key` | Same rationale (DEBATE.2 future emit site) |
| `image_upload.orphaned` | `payload.key` | R2 key strip; `uploadId` is the row id (SHIP — not PII) |
| `moderation.flagged` | `payload.userId` | Defense-in-depth — actor identity ships via `metadata.user_id` (PSEUDO per §19.5); explicit payload strip prevents re-identification via cross-join. Research keys SHIP: `reason` (block reason code), `banned` (track_a auto-ban boolean), `uploadId` (the `image_uploads` row id — join key, ships per §19.3 row 11; text-only branch emits `null`) (AUDIT-FIX-B5 emit site) |
| `admin.signed_in` | `payload.sessionId`, `payload.ip` | Cookie value + admin IP defense-in-depth (mitigation layer beyond `BREAK_GLASS.md` rotation pre-freeze) |
| `admin.signed_out` | `payload.sessionId` | Cookie value defense-in-depth |
| `dharma.credited` | `payload.userId` | PSEUDO defense-in-depth — `aggregate_id` carries the user id; same rationale as `user.signed_out` (ENGINE.12 emit site) |
| `dharma.granted` | `payload.userId` | PSEUDO defense-in-depth — `aggregate_id` carries the user id; same rationale as `dharma.credited` (ENGINE.13 emit site) |
| `bet.placed` | `payload.userId` | Defense-in-depth — actor identity ships via `metadata.user_id` (PSEUDO per §19.5); explicit payload strip prevents re-identification via cross-join. Research keys (stake, side, price, market/comment ids) SHIP — K_eff(t) derivation core per §19.6 (ENGINE.8 emit site) |
| `bet.sold` | `payload.userId` | Same rationale; sell-leg research keys (`sharesSold`, `proceeds`, `price`) SHIP (ENGINE.8 emit site) |
| `comment.placed` | `payload.userId` | Same rationale; payload research keys (`side`, `bodyLength`, market/bet/comment ids, `uploadId`, and `friendlyFire` — ADR-0058) SHIP — the comment `body` + `side_at_post_time` are not payload keys; they SHIP via the `comments` table per Appendix B.13, commentary being the dataset's thesis-core signal (ENGINE.8 emit site) |
| `market.created` | — (none) | marketId + resolutionDeadline + media[] + mediaVideoUrl all SHIP (ENGINE.14 emit site; media extended at MEDIA.1 OD-2) |
| `market.opened` | — (none) | Two payload variants, no PII-class key in either, ALL keys SHIP. Legacy (symmetric seed): `marketId` + `seedAmount`. Asymmetric (ADR-0047 §B, LIQ-1 Phase 1): `marketId` + `yesReserves` + `noReserves` + `openingPriceYes` + `backingMinted` + `discardedYes` + `discardedNo` — all public CPMM state, and they ARE the reserves the market opened at. The two discard keys are load-bearing for the reader rather than incidental: a discarded share is held by no one and sits in no position, so without them the dataset's per-side share counts do not close and the backing identity `Y + H_yes + D_yes == N + H_no + D_no` (cpmm.md §7.1) cannot be verified from the export at all (ENGINE.14 emit site; payload extended at LIQ-1 Phase 1 / ADR-0047) |
| `market.closed` | — (none) | marketId SHIPS (ENGINE.14 emit site) |
| `market.resolving` | — (none) | No PII-class payload keys; all research keys SHIP (settlement core for K_eff derivation); actor identity is `metadata.actor_id = 'admin-singleton'`, never pseudonymised (§19.5) (ENGINE.9 emit site) |
| `market.resolved` | — (none) | Same rationale — `winningSide`, `resolutionNote`, `poolUnwindAmount` (R-9.5e) all SHIP (ENGINE.9 emit site) |
| `market.corrected` | — (none) | Same rationale — `correctsEventId`, `correctedWinningSide`, `resolutionNote` SHIP; the corrections chain is thesis-core audit (ENGINE.9 emit site) |
| `market.voided` | — (none) | Same rationale — `voidReason`, `poolUnwindAmount` (R-9.5e) SHIP (ENGINE.9 emit site) |
| `pool.liquidity_added` | — (none) | **ADR-0047 §F / LIQ-1 Phase 2.** No PII-class key: the reserves, tank and target are public CPMM state, and there is no `userId` to strip because there is no user — the writer is `pg_cron` (`metadata.actor_id = 'system'`, `metadata.user_id = null`, `metadata.flow_id = 'F-CRON-LIQUIDITY-INJECT'`). **ALL keys SHIP**, and two of them are load-bearing rather than incidental, in exactly the way `market.opened`'s discards are one row above: `backingMinted` and `discardedShares` are what make the injection's Đ auditable, and without them the dataset's per-side share counts do not close and the backing identity `Y + H_yes + D_yes == N + H_no + D_no` cannot be verified from the export. `policyVersion` joins the `liquidity_policy` row that produced the injection (§19.3) — **the only way a reader reproduces the target at all**, since the rule is `max(floor, coefficient × count(*) FROM users)` and neither operand is derivable from the events. `reservesBefore`/`reservesAfter`, `tankBefore`/`tankAfter` and `priceYesBefore`/`priceYesAfter` are the before/after pairs that let a reader check price-neutrality per row rather than taking it on the ADR's word (migration `0027` emit site — plpgsql, not `insertEvent`) |

**Adding a new event_type or modifying a payload shape** is a same-commit amendment to this table plus the schema declaration at `src/server/events/schemas.ts` plus the per-site emit call. ⚠ **`pool.liquidity_added` is the first type whose emit site is NOT in `src/`** — it is written by migration `0027`'s plpgsql, which reproduces `insertEvent`'s contract by hand (uuidv7 id, `created_at` derived from its first 48 bits, `payload_version` 1, the seven-field metadata set). The rule is unchanged and the reason it holds is worth stating: the schema declaration is what every READER parses the payload with, so the declaration and the SQL writer are checkable against each other even though no TypeScript ever emits the row. The export pipeline reads this table to derive its per-payload-key strip lambdas (implementation deferred to HARDEN.* / DATASET.* stratum; runtime emission codifies the strip-key contract at the spec layer NOW so future emit sites cannot accidentally bypass).

### §19.5 Export-time JOIN pseudonymization

**Cross-table joins in the released archive use pseudonym slugs as join keys, not raw `users.id` UUIDs.** The build pipeline performs export-time JOINs that rewrite every FK reference from `users.id` (UUIDv7) to the corresponding `users.pseudonym` (the colour-animal-number slug per ADR-0011 + §3.5):

- `bets.user_id` (UUIDv7) → `bets.user_pseudonym` (string)
- `comments.user_id` → `comments.user_pseudonym`
- `dharma_ledger.user_id` → `dharma_ledger.user_pseudonym`
- `mod_actions.user_id` (target user) → `mod_actions.user_pseudonym`
- `events.metadata.user_id` (within JSONB) → `events.metadata.user_pseudonym`
- `image_uploads.user_id` → `image_uploads.user_pseudonym`

Per ADR-0016 D6, the live Postgres database uses raw UUIDs as join keys (correct for transactional workloads); the dataset uses pseudonym slugs (correct for offline analysis where readability matters and UUIDs add no value). The `users.id` raw UUID is preserved in the released `users` table as a join key for researchers who want to verify cross-table integrity, but downstream tables reference pseudonyms.

**Admin-actor rows preserve the `'admin-singleton'` sentinel.** Rows where `metadata.actor_id = 'admin-singleton'` ship with the sentinel intact (no pseudonymization applies — admin has no `users` row, no pseudonym to map). Researchers analyzing admin-actor patterns filter on the literal sentinel string.

### §19.6 K_eff(t) trajectory — derived from this dataset only

Per SPEC.1 G3 + §5.4 + PRECURSOR.2-B D4: K_eff(t) is **not** a live in-product surface. It is **derived post-hoc, out-of-band, against the 2026-11-06 dataset release**. There is no `k_eff_dashboard` materialized view in v1, no async refresh, no in-product K_eff component.

The derivation runs externally (researchers' own tooling against the released archive). The events log is the canonical input — every state mutation emits an events row, and the K_eff formula `K_eff(t) = K_0 · n(t) · σ(t)` is computable per-instant by replaying events through some `t`. The dataset release ships the events log + audit tables that supply `n(t)` (number of informed participants) and `σ(t)` (signal coherence — TBD by the researcher's own derivation choice).

The `users` and `bets` tables alone are insufficient — K_eff(t) depends on the *trajectory* of participation + commentary + stake-weighted information aggregation, which only the events log reconstructs. This is why the events log ships per §19.3 row 1 even though many researchers may default to the current-state tables.

### §19.7 Manifest endpoint contract

Per §4.3 row 8: `GET /api/dataset/manifest`. Public read (no auth). Active **post-2026-11-06 only** — pre-release the endpoint returns HTTP 503 `error_dataset_not_yet_released`; post-release it returns the manifest JSON.

**Manifest JSON shape (preliminary; final schema deferred to HARDEN.*):**

```json
{
  "schema_version": "1.0",
  "release_date": "2026-11-06",
  "tarball_url": "https://github.com/zugzwang-foundation/experiment/releases/download/dataset-v1/zugzwang-experiment-2026-11-06.tar.gz",
  "tarball_sha256": "<hex>",
  "tarball_size_bytes": 0,
  "license": "CC-BY-4.0",
  "tables": [
    {
      "name": "events",
      "row_count": 0,
      "column_set": ["event_id", "event_type", "aggregate_type", "aggregate_id", "payload", "payload_version", "metadata", "created_at"],
      "metadata_fields_included": ["request_id", "flow_id", "user_id", "actor_id", "idempotency_key"],
      "metadata_fields_excluded": ["ip", "user_agent"]
    }
  ],
  "pseudonymization": "export-time JOIN; users.id → users.pseudonym for downstream FKs"
}
```

The endpoint is a thin static-file pointer; it does not serve the tarball itself (GitHub release assets serve directly). The endpoint exists to make programmatic discovery possible (researcher tooling can fetch the manifest to verify checksums + schema version + table inventory before downloading the tarball).

### §19.8 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Release date + GitHub artifact location | §19.1 + SPEC.1 §12.2 |
| Build pipeline (one-shot Postgres point-in-time recovery + pg_dump + post-process + tarball) | HARDEN.10 (per ADR-0006) |
| Tables-shipped vs not-shipped policy | §19.3 |
| PII strip-not-hash policy + ten PII columns dropped | §19.4 |
| Export-time JOIN pseudonymization | §19.5 |
| K_eff(t) derivation surface (post-hoc, against this dataset only) | §19.6 + SPEC.1 G3 |
| `/api/dataset/manifest` Route Handler | `src/app/api/dataset/manifest/route.ts` (per §4.3 + §13 — F-DATASET-1 minted alongside; gating SCAFFOLD.18) |
| Manifest JSON schema | §19.7 (preliminary; final at HARDEN.*) |
| Final license selection (CC0 vs CC-BY-4.0) | ✅ Resolved at PRECURSOR.4 → **CC-BY-4.0** |

ADRs consumed by §19: ADR-0005 (events log + Pattern A backing dataset architecture), ADR-0006 (Supabase point-in-time recovery for freeze-snapshot replica), ADR-0011 (pseudonym slug formation backing export-time JOIN), ADR-0016 (raw UUIDs in live database vs pseudonym slugs in dataset, per D6). 3-E A1 absorbs strip-not-hash treatment; 3-E §19.3 source-row reconciliation (3-E baseline of "13 shipped" was an undercount; v0.3-draft corrects to 16 shipped + 5 not shipped per §19.3 inventory). PRECURSOR.2-B D4 absorbs K_eff(t) derivation as the only surface in v1 — no live in-product K_eff component.

---

## §20 Conclusion-Event Freeze

§20 owns the *write-freeze contract* for the experiment-phase build — the single moment at 2026-11-05 23:59 UTC when every state-mutating endpoint switches from accepting writes to rejecting them with HTTP 410 `error_experiment_concluded`, the `system_state` row + middleware mechanism that enforces the freeze, the asymmetric authentication-still-live posture (read paths remain operational; signup-and-login still functions; only state-mutation gates close), and the structural reversibility-none enforcement at the database layer via §6 Bucket-B trigger discipline. SPEC.1 §12 owns the *product-level* commitment that the experiment concludes; SPEC.1 §12.4 owns the *catastrophic-failure recovery* (BREAK_GLASS.md surgery as the only path to thaw the freeze, accepted as breaking the experiment deliverable); ADR-0010 owns the *operational rotation* surface for the admin path that survives the freeze. This §20 sits at the *freeze enforcement contract* layer, naming the row + the mechanism + the wire envelope + the structural reversibility floor.

The discipline is strict: §20 names the freeze instant + the trigger row + the middleware mechanism + the wire envelope + the reversibility-none property; it does NOT design the post-freeze read-only UX (out of scope for v1; the experiment ends, the product page degrades to "concluded" gracefully — UI.* territory), it does NOT decide cron-based vs manual-trigger freeze (the §20.2 mechanism is dual-path; HARDEN.* picks the operational primary), and it does NOT specify the post-2026-11-06 dataset publishing pipeline (§19 owns).

### §20.1 Freeze instant

**2026-11-05 23:59 UTC.** Single timestamp; single source of truth. The instant is exactly one minute before midnight UTC at the boundary between November 5 and November 6, chosen to give the build pipeline (per §19.1) a stable snapshot for the 2026-11-06 dataset release.

The instant is locked at SPEC.2 v1.0 — moving it forward or back requires an ADR + same-commit SPEC.1 + SPEC.2 + tracker update. Calendar drift between the SPEC.1 §12 timeline ("the experiment concludes November 5") and the §20.1 specific second is reconciled here: SPEC.1 names the calendar boundary; §20.1 names the specific UTC second.

### §20.2 Mechanism — `system_state.frozen_at` + middleware

**Trigger row.** A single-row table `system_state` keyed by `id = 'system'` (literal string sentinel; no UUIDv7 for this row because there's exactly one row and no FK references). The Bucket-B classification per §5.1 row 13 + 3-E §20-1 ratification specifies the whitelisted transition: `frozen_at` NULL → timestamp, set together with no other column changes. The §6.3 trigger function rejects re-firing (NULL → timestamp once, never timestamp → timestamp) and rejects un-freezing (timestamp → NULL forbidden) and rejects DELETE.

**Initialization.** Migration mints the row at SCAFFOLD.2 deploy: `INSERT INTO system_state (id, frozen_at) VALUES ('system', NULL);`. The row exists from day-1 of the experiment with `frozen_at = NULL`; the freeze is the single UPDATE that flips the column.

**Two trigger paths (HARDEN.* picks primary; both ratified at v1.0 lock):**

- **Path A — `pg_cron` scheduled.** A `pg_cron` job runs at 2026-11-05 23:59:00 UTC and executes `UPDATE system_state SET frozen_at = '2026-11-05 23:59:00+00:00' WHERE id = 'system' AND frozen_at IS NULL;`. The trigger function from §6.3 enforces the once-only transition; the WHERE clause is belt-and-braces so a re-firing would be a no-op anyway.
- **Path B — Manual SQL.** An admin connects to Supabase via `psql` at the freeze instant and executes the same UPDATE manually. Required-skill: someone with Supabase admin credentials online at 23:59 UTC; deferred to HARDEN.10 runbook.

The dual-path is deliberate. Path A's failure mode (cron job didn't run, e.g., Supabase maintenance window collision) requires Path B as backstop. HARDEN.* picks Path A as primary with Path B as runbook-documented fallback; v1.0 lock names both as ratified mechanisms.

**Middleware mechanism.** Every state-mutating endpoint (Server Action, Route Handler) checks `system_state.frozen_at IS NOT NULL` at handler-stack step 1 (per §3.1) — adjacent to the auth gate, before the idempotency cache lookup. If `frozen_at IS NOT NULL` the handler returns HTTP 410 `error_experiment_concluded` (per §15.4) without opening any transaction or invoking any business logic. The check is a single SELECT against the single-row `system_state` table; the row is heavily cached (per Postgres's small-table buffer-pool retention).

The middleware is not a Next.js middleware (per §3.1's note on `proxy.ts`'s narrow responsibility — the freeze check needs to know the handler class, which middleware can't see). Instead it's a helper function `await isFrozen()` invoked at the top of every handler-stack-step-1 sequence; CI lint at HARDEN.* enforces presence on every state-mutating handler. The asymmetric posture: read paths do NOT call `isFrozen()` (they remain available indefinitely post-freeze); only state-mutating paths gate.

**Freeze accepted-window (in-flight requests) — AUDIT.1 A26 ruling, founder-ratified 2026-07-06.** The `isFrozen()` gate is a single pre-transaction read; the W-1 bet transaction deliberately does not re-read `system_state` (the read is kept outside the W-1/W-3/W-4 lock order per `is-frozen.ts`; no freeze check enters the bet path — any change to that is founder-gated, mirroring the R-14.3 close-lag posture, §3.4). A request that passed the gate while `frozen_at` was `NULL` can therefore commit after the flip. **Accepted cost, eyes open:** the window is bounded by in-flight handler lifetime — seconds-class, dominated by the in-flight bet transaction plus the W-1 statement/retry budget; no single named value bounds it and none is minted (numeric characterization is HARDEN/runbook territory). Two backstops cap it in practice: a window *bet* must additionally find its market still `Open` in W-1, which for markets whose `resolution_deadline` coincides with the freeze instant adds the R-14.3 per-minute close-lag bound; and the §19.1 dataset-build point post-dates the drain by hours, so every window commit ships in the release artifact as an ordinary row. The one-shot `frozen_at` transition above is untouched — nothing frozen is mutated, no row is retroactively altered. Dataset interpretation: §19.1.

**Wire envelope.** HTTP 410 (Gone) per §15.4. `error_code: error_experiment_concluded`. `error_type: gone`. `retry_semantics: do_not_retry`. `retry_after: null`. Display message template: "The experiment concluded on November 5, 2026. The market is permanently closed. The public dataset is at <link>." (Final copy locked at HARDEN.*; the message-template field per §15.1 is the copy surface.)

### §20.3 Reversibility-none + auth-still-live + admin-mutation-still-live

**Reversibility is none.** The §6.3 trigger function on `system_state.frozen_at` rejects timestamp → NULL transitions (§5.1 row 13 + §6.3 spec). The only path to thaw the freeze is direct database surgery via `BREAK_GLASS.md`'s `ALTER TABLE system_state DISABLE TRIGGER ... ; UPDATE ...; ALTER TABLE ... ENABLE TRIGGER ... ;` sequence — which breaks the experiment deliverable per SPEC.1 §12.4 and is acceptable only as catastrophic-failure recovery. A reviewer of the post-experiment dataset can verify the freeze instant exactly because the trigger forecloses any post-write of `frozen_at`.

**Authentication remains live.** Per SPEC.1 §12.1 the read-only mode preserves user login. F-AUTH-1 (Google OAuth) + F-AUTH-2 (Email + OTP) + F-AUTH-3 (pseudonym assignment) + F-AUTH-4 (ToS acceptance) + F-AUTH-5 (logout) all continue to operate post-freeze. The session-deferral hook from §8.3 continues to enforce the pseudonym + ToS gate; new signups that complete the four-step onboarding land valid `users` rows + `sessions` rows post-freeze. The auth surface is **not state-frozen** — only bet/comment/vote/resolution surfaces are.

The reasoning: the dataset is published Nov 6; researchers reading the dataset want to see their friends' pseudonyms; reading requires login; new signups add users to `users` (Bucket C) + `identity_pool` (Bucket B with `assigned_at` whitelisted transition) + `sessions` (Bucket C) without affecting the frozen state of bets/comments/resolutions. The post-freeze new signup adds an `events.user.pseudonym_assigned` row and an `events.user.tos_accepted` row; both are observable in the audit trail; neither violates the freeze.

**Admin-side mutations remain live for the conclusion-event work.** F-ADMIN-3 (trigger resolution) + F-ADMIN-4 (moderation action) + F-ADMIN-5 (audit-log search) + F-RESOLVE-1 (resolve) + F-RESOLVE-2 (correction) + F-RESOLVE-3 (void) all continue to operate post-freeze. The admin path is **largely** outside the freeze gate — admin Server Actions do NOT call `isFrozen()`. ⛔ **ONE EXCEPTION AS OF LIQ-1 Phase 2 (`docs/parked.md` L-4, ADR-0047): `openMarket` (F-ADMIN-2) REFUSES post-freeze**, throwing `MarketFrozenError`. It does not call `isFrozen()` — it reads `system_state` on the W-4 `tx`, because that helper opens its own connection and must not enter the W-1/W-3/W-4 lock order — so the letter of the sentence above survives, and **that is exactly why it needed amending rather than leaving**: a later session reading it would conclude the gate is spurious and remove a CLAUDE.md §3 refusal-trigger guard. The distinction the exception rests on is *finishing* versus *starting*: a market already in flight must be able to resolve, and nothing NEW may open. `createMarket` and `closeMarket` were not ruled on and remain ungated. The admin can finalize resolutions, run audit exports, perform last-mile moderation cleanup post-freeze without contradicting the freeze. The admin-side audit trail (`admin_events` Bucket A) is append-only per §6.2; post-freeze admin actions append to the trail, do not retroactively alter prior rows, and the dataset release reflects the admin actions taken between freeze and Nov 6 dataset-build time.

The asymmetric live-vs-frozen posture across the three actor classes — participant (frozen), authenticated-user-but-read-only (live), admin (live) — is deliberate. Per §3.6 + §8.4 admin is structurally separate from participant; admin's post-freeze write authority is the conclusion-event work. The dataset built at 2026-11-06 reflects admin actions taken in the freeze-to-build-time window; researchers see admin resolutions in `resolution_events` regardless of when they fired.

### §20.4 Single source of truth

| Concern | Source-of-truth file |
|---|---|
| Freeze instant (2026-11-05 23:59 UTC) | §20.1 |
| `system_state` Drizzle schema | `src/db/schema/system.ts` |
| `system_state` Bucket-B trigger function | `drizzle/migrations/<NNNN>_append_only_triggers.sql` (per §6.3) |
| `system_state` row mint at deploy | `drizzle/migrations/<NNNN>_seed_system_state.sql` (provisional path under SCAFFOLD.2) |
| `pg_cron` Path-A scheduled freeze job | `drizzle/migrations/<NNNN>_freeze_cron.sql` (HARDEN.10 territory) |
| Path-B manual `psql` runbook | `docs/runbooks/conclusion-event-freeze.md` (HARDEN.10-owned) |
| `isFrozen()` middleware helper | `src/server/system/is-frozen.ts` |
| CI lint enforcing `isFrozen()` presence on state-mutating handlers | HARDEN.* (per §17.7's deferred items list pattern) |
| `error_experiment_concluded` catalogue row | §15.4 |
| Read-paths-still-live posture | §3.3 R-1 / R-2 / R-3 (none of these patterns calls `isFrozen()`) |
| Auth-paths-still-live posture | §8 (none of F-AUTH-* calls `isFrozen()`) |
| Admin-paths-still-live posture | §3.6 + §8.4 (none of F-RESOLVE-* / F-ADMIN-* calls `isFrozen()`). ⚠ **F-ADMIN-2 is freeze-GATED as of LIQ-1 Phase 2** — via a `system_state` read on the W-4 `tx`, not via `isFrozen()`, so the parenthetical is still literally true and no longer tells the whole story. See §20.3 |
| Non-handler state-mutating writer | ⚠ **NEW at LIQ-1 Phase 2.** `run_liquidity_injection()` (migration `0027`+) is a `pg_cron` writer of `pools` and `events` that is **not a handler at all**, so §20.2's *"CI lint at HARDEN.* enforces presence on every state-mutating handler"* does not reach it. Its freeze check is `EXISTS (SELECT 1 FROM system_state WHERE frozen_at IS NOT NULL)` — fail-closed, and safe on any row count, unlike a `LIMIT 1` read. Any future lint must cover non-handler writers or it will report a clean sweep over an incomplete set |
| Catastrophic-failure thaw procedure | `docs/runbooks/BREAK_GLASS.md` (HARDEN.10-owned per ADR-0010) |

ADRs consumed by §20: ADR-0005 (Bucket-B append-only-with-whitelisted-transition discipline backing `system_state.frozen_at`), ADR-0006 (Supabase + `pg_cron` substrate for Path A scheduled freeze), ADR-0010 (admin auth path remaining live post-freeze + `BREAK_GLASS.md` thaw procedure scope). 3-E A1 absorbs the 2026-11-05 23:59 UTC instant correction; 3-E §20-1 absorbs `system_state.frozen_at` Bucket B classification with NULL → timestamp transition; 3-E A8 mints the `error_experiment_concluded` HTTP 410 `error_type: gone` row in §15.4's 38-code baseline.

---

## §21 Operational Runbooks

§21 no longer carries an inventory. **`docs/runbooks/` is the inventory** — the directory is the source of truth and this section does not restate it. The twenty named slots that stood here are struck (D-28 r12): nineteen of them named files that did not exist, while four files that do exist were unnamed, including `deploy-pipeline.md`, which `CLAUDE.md` §5 treats as canonical for the deploy path.

A runbook is added by adding a file. Nothing in this document gates that.

---

## §22 ADR Index

§22 no longer carries an index. **`docs/adr/` is the index** — the directory is the source of truth and this section does not restate it, count it, or classify it. The 38-row index that stood here declared 38 ADRs against 44 on disk, a ceiling of `0039` against `0046`, and *"dense + gapless"* numbering against two documented gaps at `0002` and `0012`. A per-file index in a specification is a list that goes stale between the writing and the reading; removing it discharges D-28 r18 by removing the thing that kept breaking.

ADRs are named in this document where they bind a contract, at the point where they bind it. They are not counted here.

---

## Appendix A — Source-of-Truth Pointers

Appendix A no longer carries a file map. **The repository is the map.** The 140-row path→owner table that stood here was declared canonical *"at this v0.3-draft snapshot"* while the document was at 1.0.27, named `PSEUDONYM.md` and `design.md` as companion specs that have never existed on disk (promises deleted, D-28 r16 and r17), and counted 26 ADR files against 44.

The four pointers that are load-bearing, and are stated here because they are cited by contract rather than by convenience:

| Concern | Source of truth |
|---|---|
| Product contract | `docs/specs/SPEC.1.md` — outranks this document (D-22) |
| Decisions and rulings | `docs/decisions/` — outranks both (D-22) |
| Architecture decisions | `docs/adr/` |
| Error-code catalogue | §15.4 of this document |

Everything else is found where it lives.

---

## Appendix B — Per-Table Per-Column Dataset Classification

Per-column treatment for the 15 tables shipped in the 2026-11-06 public dataset release per §19.3. Each table's columns are classified into one of five treatments:

- **`SHIP`** — column ships verbatim from the Postgres source.
- **`PSEUDO`** — column carries `users.id` raw UUIDv7 in source; rewritten at export time to `users.pseudonym` slug per §19.5.
- **`STRIP`** — column dropped from released schema entirely (PII per §19.4).
- **`STRIP_KEY`** — JSONB sub-key dropped from a `metadata` or `payload` column (PII per §19.4).
- **`NULL_IF_ERASED`** — column ships verbatim except for rows where H2 erasure has fired; H2-erased rows release as NULL (per §19.4 + SPEC.1).

The 5 not-shipped tables (`system_state`, `sessions`, `accounts`, `verifications`, `admin_sessions`) have no per-column treatment because they don't ship; the rationale per §19.3 is operational + privacy-sensitive.

The discipline: this appendix is **derived** from §19.4 + §19.5 + §5.1. PRECURSOR.4 lock review walks every column row, verifies the treatment is consistent with the policy, and runs the column-name correctness sweep against the implemented Drizzle schemas at `src/db/schema/<domain>.ts` — any column in source that is not enumerated here is a coverage gap; any column enumerated here that does not exist in source is a drift fix. (This sweep was previously assigned to PRECURSOR.5; it is a verify-against-source check that belongs with the PRECURSOR.4 lock review, not the SYNC.8 CLAUDE/AGENTS rebuild.)

### B.1 `users` (Bucket C)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Raw UUIDv7 preserved as join key for cross-table integrity verification per §19.5 |
| `pseudonym` | text | SHIP | The colour-animal-number slug; load-bearing as the dataset's user-identification key |
| `email` | text | STRIP | PII per §19.4 — column removed from released schema |
| `google_id` | text | STRIP | PII per §19.4 — column removed |
| `name` | text | STRIP | PII per §19.4 — Google display name; column removed |
| `image` | text | STRIP | PII per §19.4 — Google avatar URL; column removed |
| `email_verified` | boolean | SHIP | Email-verification flag; no PII, research-relevant for auth-completion analysis |
| `pfp_filename` | text | NULL_IF_ERASED | Slug for `zugzwang-pfp/v1/<slug>` per §12.7; H2 erasure null-s; otherwise ships |
| `tos_accepted_at` | timestamptz | SHIP | Research-relevant (ToS evidence timestamp) |
| `tos_version_hash` | text | SHIP | Research-relevant (which ToS version was accepted) |
| `privacy_version_hash` | text | SHIP | Research-relevant (which privacy policy version was accepted) |
| `tos_acceptance_ip` | text | STRIP | PII per §19.4 — column removed |
| `tos_acceptance_user_agent` | text | STRIP | PII per §19.4 — column removed |
| `last_allowance_accrued_at` | timestamptz | SHIP | Daily-allowance idempotency cursor; research-relevant for allowance-flow analysis |
| `banned_at` | timestamptz \| null | SHIP | Track A automatic ban + Track B admin manual ban evidence per §8.6 |
| `created_at` | timestamptz | SHIP | Canonical chronological-sort column |
| `updated_at` | timestamptz | SHIP | Better Auth row-update timestamp; research-relevant for account-mutation analysis |

### B.2 `markets` (Bucket C)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Market PK; join key for `bets`, `comments`, `pools`, `positions`, `resolution_events`, `payout_events` |
| `slug` | text | SHIP | Participant-facing URL slug (per §16) |
| `title` | text | SHIP | Market question (e.g., "Will event X happen by Nov 5?") |
| `description` | text | SHIP | Market context |
| `status` | text | SHIP | `Draft` / `Open` / `Closed` / `Resolving` / `Resolved` / `Voided` / `Frozen` — the built 7-state `market_status` enum (SPEC.1 §6.1; whitelisted Bucket-C transitions per §3.6 + §3.8) |
| `resolution_deadline` | timestamptz | SHIP | When the market is scheduled to resolve |
| `resolved_at` | timestamptz \| null | SHIP | Actual resolution timestamp; NULL until F-RESOLVE-1 fires |
| `resolution_outcome` | text \| null | SHIP | `YES` / `NO` / `VOID`; NULL until F-RESOLVE-1 fires |
| `created_by` | text | SHIP | `'admin-singleton'` sentinel per §3.6 (admin-actor created markets) |
| `created_at` | timestamptz | SHIP | |
| `media_video_url` | text \| null | SHIP | ADR-0026 — outbound YouTube explainer URL; public, no PII; NULL when unset |

### B.3 `pools` (Bucket C)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Pool PK; one row per market (1:1 with `markets.id`) |
| `market_id` | uuid | SHIP | FK to `markets.id` |
| `yes_reserves` | numeric(38,18) | SHIP | CPMM YES-side reserves at freeze instant |
| `no_reserves` | numeric(38,18) | SHIP | CPMM NO-side reserves at freeze instant |
| `created_at` | timestamptz | SHIP | |

Reserves are initialised symmetrically to `seedAmount` at `Draft → Open` (W-4, §3.8; cpmm.md §7.1 — exactly once).

Inferred from CPMM math substrate per `cpmm.md`; PRECURSOR.4 verifies precision + column names.

### B.4 `positions` (Bucket C)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Position PK |
| `user_id` | uuid | PSEUDO | Rewritten to `user_pseudonym` per §19.5 |
| `market_id` | uuid | SHIP | FK preserved |
| `side` | text | SHIP | `YES` / `NO` |
| `quantity` | numeric(38,18) | SHIP | Per-user-per-market position cache |
| `created_at` | timestamptz | SHIP | |
| `updated_at` | timestamptz | SHIP | Last update inside W-1 transaction |

### B.5 `bets` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Bet PK |
| `user_id` | uuid | PSEUDO | Rewritten to `user_pseudonym` per §19.5 |
| `market_id` | uuid | SHIP | FK preserved |
| `side` | text | SHIP | `YES` / `NO` |
| `stake` | numeric(38,18) | SHIP | Dharma staked |
| `share_quantity` | numeric(38,18) | SHIP | Shares received from CPMM |
| `price_at_bet` | numeric(38,18) | SHIP | Implied probability at bet time |
| `comment_id` | uuid | SHIP | FK to `comments.id` (INV-1 atomic bet+comment binding) |
| `idempotency_key` | text \| null | SHIP | Client-generated opaque string; carries no PII |
| `created_at` | timestamptz | SHIP | |

### B.6 `comments` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Comment PK |
| `user_id` | uuid | PSEUDO | Rewritten to `user_pseudonym` per §19.5 |
| `market_id` | uuid | SHIP | FK preserved |
| `parent_comment_id` | uuid \| null | SHIP | NULL = top-level **post-bet** comment; non-NULL = **reply-bet** comment (F-COMMENT-2; FK to parent `comments.id`; `REPLY_DEPTH_MAX = 1`) |
| `body` | text | SHIP | Comment text content (post-moderation; only `pass`-verdict comments exist in this table per §10) |
| `image_uploads_id` | uuid \| null | SHIP | FK to `image_uploads.id` for F-COMMENT-3; NULL for text-only comments |
| `market_media_id` | uuid \| null | SHIP | ADR-0026 — FK to `market_media.id` for pick-from-pool (F-COMMENT-3); mutually exclusive with `image_uploads_id` (DB CHECK); a context FK revealing which admin image a comment used; no PII. **PENDING-BUILD** — column not in schema @ head `0023`; ships with the composer-pick stratum (D2) |
| `side_at_post_time` | text | SHIP | INV-3 binding: `YES` / `NO` frozen at insert — the side of the bet this comment rides (§14.1). The render-time ranking aggregates (§5.4) read this across reply-bets; there is no `stake_at_post_time` column |
| `friendly_fire` | boolean | SHIP | ADR-0058 — `true` on a Support reply-bet whose author contests the parent argument; set at insert, never updated; `false` on every top-level post (DB CHECK) and every Counter (write path). Research-core for the same-side-dissent metric; no PII |
| `bet_id` | uuid \| null | SHIP | Deliberately nullable — the comment is inserted before its paired bet in the same W-1 transaction (INV-1 is enforced the other direction, via `bets.comment_id NOT NULL`); every comment still rides a bet (post-bet or reply-bet), this column just can't carry the FK until the bet row exists |
| `created_at` | timestamptz | SHIP | |

### B.7 `dharma_ledger` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Ledger row PK |
| `user_id` | uuid | PSEUDO | Rewritten to `user_pseudonym` per §19.5 |
| `bet_id` | uuid \| null | SHIP | FK to `bets.id` for stake / payout / refund / correction rows; NULL for `daily_allowance` / `initial_grant` rows |
| `entry_type` | `dharma_entry_type` (pgEnum) | SHIP | `bet_stake` / `bet_payout` / `daily_allowance` / `pool_seed` / `pool_unwind` / `correction_reverse` / `correction_apply` / `void_refund` / `uncollectable` / `initial_grant` (built as a pgEnum, not `text`; `pool_seed`/`pool_unwind` dormant in v1, R-2) |
| `amount` | numeric(38,18) | SHIP | Signed; positive = credit, negative = debit |
| `balance_after` | numeric(38,18) | SHIP | Running balance; INV-2 (no overdraft) verifiable from this column |
| `created_at` | timestamptz | SHIP | |
| `seq` | bigint (identity) | SHIP | Per-user total-order key (ADR-0029); `GENERATED ALWAYS AS IDENTITY`, app-opaque (used only for `ORDER BY`). Global monotonic; consumers reconstruct per-user chronological order via `ORDER BY user_id, seq`. Whether the release ships the raw global `seq` or a per-user-derived rank (if the global insert-interleave is deemed sensitive) is a dataset-extraction decision deferred to the 2026-11-06 release task |

Inferred from §3.7 + INV-2 mechanism per §14.1; PRECURSOR.4 verifies entry-type enum against actual implementation.

### B.8 `payout_events` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Payout row PK |
| `bet_id` | uuid | SHIP | FK to `bets.id` |
| `user_id` | uuid | PSEUDO | Rewritten to `user_pseudonym` per §19.5 |
| `market_id` | uuid | SHIP | FK preserved |
| `resolution_event_id` | uuid | SHIP | FK to `resolution_events.id`; identifies which resolution this payout belongs to |
| `payout_type` | text | SHIP | `bet_payout` / `correction_reverse` / `correction_apply` / `void_refund` |
| `amount` | numeric(38,18) | SHIP | Settlement-record amount. Zero legs are LEGAL — the settlement is recorded even when nothing moves (R-9.2 losers; R-9.8 fully-sold f = 0). Per-type sign (0014 CHECK `payout_events_amount_sign_check`): `correction_reverse` ≤ 0, every other type ≥ 0. Winner `bet_payout` rows carry the GROSS shares-settle value at the R-9.8 pro-rata basis; `correction_reverse` rows carry −recorded (read from the corrected event's rows), never a recomputation |
| `created_at` | timestamptz | SHIP | |

### B.9 `resolution_events` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Resolution event PK |
| `market_id` | uuid | SHIP | FK to `markets.id` |
| `event_kind` | text | SHIP | `resolve` / `correct` / `void` |
| `outcome` | text | SHIP | `YES` / `NO` / `VOID` |
| `corrects_event_id` | uuid \| null | SHIP | FK to prior `resolution_events.id` for F-RESOLVE-2; NULL for initial resolutions |
| `reason` | text | SHIP | Admin free-text reason — NOT NULL, mandatory for all three kinds (R-9.1: the F-RESOLVE-1 criterion-met evidence note; the prior "NULL for F-RESOLVE-1" was drift, exactly backwards) |
| `created_at` | timestamptz | SHIP | |

Constraints (migration `0014_resolution_constraints.sql`, ENGINE.9): `resolution_events_kind_outcome_check` — `resolve`/`correct` carry `YES`/`NO`, `void` carries `VOID` (R-9.3: a correction can never flip a market to VOID); `resolution_events_correct_link_check` — `corrects_event_id` present iff `event_kind = 'correct'`; and the partial unique index `resolution_events_terminal_market_uq` on `(market_id) WHERE event_kind IN ('resolve','void')` — a market terminates exactly one way, once (OQ-7; belt-vs-bugs only — the W-3 markets lock + state gate are the primary serialization, a surfaced 23505 is a logic bug).

### B.10 `mod_actions` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Moderation action PK |
| `target_user_id` | uuid \| null | PSEUDO | The user being moderated; rewritten to `target_user_pseudonym`; NULL for admin-action-on-content paths |
| `target_comment_id` | uuid \| null | SHIP | FK to `comments.id` for F-COMMENT-* moderations; NULL for F-BET-* moderations |
| `target_bet_id` | uuid \| null | SHIP | FK to `bets.id` for F-BET-1 entry-comment moderations; NULL otherwise |
| `target_market_id` | uuid \| null | SHIP | FK to `markets.id` — the market the flagged submission targeted; powers F-ADMIN-5 market search + the dashboard market filter (DEBATE.7). NULL when a comment/bet target is present |
| `reason` | mod_reason | SHIP | The action reason (DEBATE.7 / ADR-0021): `track_a_auto_ban` / `track_b_flagged` / `sexual_minors_text_flagged` / `image_rejected` / `image_screening_failed` (classifier-written); `content_removed` / `user_banned` (admin-written). NOT NULL |
| `verdict` | text \| null | SHIP | `pass` / `track_a` / `track_b`; NULL for reactive admin-action rows (`content_removed` / `user_banned`) which carry no classifier verdict (DEBATE.7) |
| `categories` | jsonb | SHIP | Full OpenAI moderation response (category scores + applied-input-types) at decision time; the "source layer" is derivable from `category_applied_input_types` |
| `blocked_text` | text \| null | STRIP | Retained text of a submission the classifier flagged, where one exists. Under advisory moderation the comment row also exists; this column is a forensic copy, not the only record. Populated by the superseded gate until MOD-1. |
| `image_r2_key` | text \| null | STRIP | Operational; per §19.4 — column removed from released schema |
| `actor_id` | text | SHIP | `'system'` for every classifier-written row; `'admin-singleton'` for reactive Remove/Ban (dashboard stratum) |
| `created_at` | timestamptz | SHIP | |

### B.11 `admin_events` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Admin event PK |
| `event_type` | text | SHIP | `admin.signed_in` / `admin.market_resolved` / `admin.market_corrected` / `admin.market_voided` / `admin.moderation_acted` / etc. |
| `payload` | jsonb | SHIP | Per-event-type payload |
| `metadata` | jsonb | SHIP (with PII strip per below) | |
| `metadata.request_id` | text | SHIP_KEY | Correlation key |
| `metadata.flow_id` | text | SHIP_KEY | F-* identifier |
| `metadata.user_id` | uuid \| null | SHIP_KEY | NULL for admin actor |
| `metadata.actor_id` | text | SHIP_KEY | `'admin-singleton'` |
| `metadata.idempotency_key` | text \| null | SHIP_KEY | |
| `metadata.ip` | text | STRIP_KEY | PII per §19.4 |
| `metadata.user_agent` | text | STRIP_KEY | PII per §19.4 |
| `created_at` | timestamptz | SHIP | |

### B.12 `user_events` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | User event PK |
| `user_id` | uuid | PSEUDO | Rewritten to `user_pseudonym` per §19.5 |
| `event_type` | text | SHIP | `user.oauth_signed_in` / `user.otp_signed_in` / `user.pseudonym_assigned` / `user.tos_accepted` / `user.signed_out` (Daily Credit accrual rides `events` as `dharma.credited` per §5.5 — ENGINE.12 R1/R2; no `user_events` row) |
| `payload` | jsonb | SHIP (with per-event-type variations) | E.g., `user.tos_accepted` carries version hashes; `user.pseudonym_assigned` carries the pseudonym slug |
| `metadata` | jsonb | SHIP (with PII strip per below) | |
| `metadata.request_id` | text | SHIP_KEY | |
| `metadata.flow_id` | text | SHIP_KEY | |
| `metadata.user_id` | uuid | SHIP_KEY → PSEUDO | Self-actor; rewritten to `user_pseudonym` |
| `metadata.actor_id` | uuid | SHIP_KEY → PSEUDO | Self-actor (echoes user_id); rewritten to `actor_pseudonym` |
| `metadata.idempotency_key` | text \| null | SHIP_KEY | |
| `metadata.ip` | text | STRIP_KEY | PII per §19.4 |
| `metadata.user_agent` | text | STRIP_KEY | PII per §19.4 |
| `created_at` | timestamptz | SHIP | |

### B.13 `events` (Bucket A — canonical audit log)

The events table is the most heavily-consumed surface for K_eff(t) trajectory derivation per §19.6 + §7.

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `event_id` | uuid | SHIP | Storage-layer dedupe primitive per §7.3 |
| `event_type` | text | SHIP | Closed enum at application layer; one Zod schema per value at `src/server/events/schemas.ts` |
| `aggregate_type` | text | SHIP | `market` / `bet` / `comment` / `user` / `dharma_account` / `system` / `admin_session` / `image_upload` / `mod_action` |
| `aggregate_id` | uuid | SHIP_OR_PSEUDO | Per-aggregate-type: `users` aggregate_id rewrites to pseudonym; other aggregate types preserve raw UUID. `admin_session` aggregate_id (the admin cookie value) SHIPs raw — defense-in-depth covered by `BREAK_GLASS.md` rotation + payload STRIP rules per §19.4.1 |
| `payload` | jsonb | SHIP with per-event-type STRIP_KEY rules per §19.4.1 | `bet.placed` carries stake / side / price; `comment.placed` carries body / side_at_post_time; etc. Per-event-type PII keys (`ip`, `user_agent`, `email`, `googleId`, `userId`, `key`, `sessionId`) STRIP at export per §19.4.1 table |
| `payload_version` | smallint | SHIP | Migration cursor |
| `metadata` | jsonb | SHIP (with PII strip per below) | |
| `metadata.request_id` | text | SHIP_KEY | |
| `metadata.flow_id` | text | SHIP_KEY | |
| `metadata.user_id` | uuid \| null | SHIP_KEY → PSEUDO (when not NULL) | NULL for admin-actor events; PSEUDO otherwise |
| `metadata.actor_id` | text | SHIP_KEY (sentinel) or PSEUDO | `'admin-singleton'` sentinel preserved literally; participant-actor values rewrite to pseudonym |
| `metadata.idempotency_key` | text \| null | SHIP_KEY | |
| `metadata.ip` | text | STRIP_KEY | PII per §19.4 |
| `metadata.user_agent` | text | STRIP_KEY | PII per §19.4 |
| `created_at` | timestamptz | SHIP | Canonical chronological-sort column |

### B.14 `identity_pool` (Bucket B)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Synthetic UUIDv7 PK per ADR-0016 D5 |
| `colour` | text | SHIP | One of the canonical colour set per ADR-0011 |
| `animal` | text | SHIP | One of the canonical animal set per ADR-0011 |
| `number` | smallint | SHIP | 0-999 per ADR-0011 |
| `pseudonym` | text | SHIP | Materialised PascalCase concatenation `<Colour><Animal><NNN>` (e.g. `RedFox001`) per shipped `src/server/identity-pool/consume.ts:51`. NOT hyphen-kebab — that shape applies to `pfp_filename` only. |
| `pfp_filename` | text | SHIP | Slug for `zugzwang-pfp/v1/<slug>` (deterministic per ADR-0011) |
| `assigned_at` | timestamptz \| null | SHIP | Bucket-B whitelisted transition; NULL for unassigned tuples; populated at F-AUTH-3 |
| `created_at` | timestamptz | SHIP | |

Post-experiment, all 50K rows ship with `assigned_at` populated only for tuples consumed during the experiment; unassigned tuples ship with NULL.

### B.15 `image_uploads` (Bucket B)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Image upload PK |
| `user_id` | uuid | PSEUDO | Rewritten to `user_pseudonym` per §19.5 |
| `r2_object_key` | text | STRIP | Operational; per §19.4 — column removed |
| `content_type` | text | SHIP | Upload MIME as validated at sign time (allowlist); no PII; media-mix signal for researchers |
| `byte_size` | integer | SHIP | Validated size in bytes (DB CHECK `0 < byte_size ≤ 8388608`, migration `0006`); no PII |
| `terminal_state` | text \| null | SHIP | `committed` / `blocked` / `orphan`; NULL for in-flight at freeze (rare per §12.6) |
| `terminal_at` | timestamptz \| null | SHIP | Bucket-B whitelisted transition partner; matches `terminal_state` non-NULL |
| `created_at` | timestamptz | SHIP | |

### B.16 `market_media` (Bucket C)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Market-media PK |
| `market_id` | uuid | SHIP | FK to `markets.id` |
| `r2_object_key` | text | SHIP | Asset reference in the `m/<marketId>/` namespace (§12.1); admin-set, operator-curated public market context — the removed-media exclusion does not apply (operator-curated content, not user-generated; ADR-0027) |
| `display_order` | int | SHIP | Carousel order |
| `is_default` | boolean | SHIP | Exactly one `true` per market; backs the F-COMMENT-3 default-image render fallback |
| `created_by` | text | SHIP | `'admin-singleton'` sentinel per §3.6 (admin-owned context; **no `user_id`** column — not participant content) |
| `created_at` | timestamptz | SHIP | |

`market_media` ships in full as **market context** — admin-set, operator-curated, public, no PII (ADR-0027).

### B.16b `liquidity_policy` (Bucket A)

| Column | Type | Treatment | Notes |
|---|---|---|---|
| `id` | uuid | SHIP | Policy-row PK (UUIDv7) |
| `version` | integer | SHIP | **The join key.** `pool.liquidity_added.payload.policyVersion` points here; UNIQUE, so the join is exact |
| `coefficient` | numeric(38,18) | SHIP | Đ of depth per signup — the slope of the target rule |
| `floor` | numeric(38,18) | SHIP | Đ — the intercept; `target = max(floor, coefficient × signups)` |
| `trigger_ratio` | numeric(38,18) | SHIP | Inject only while `tank < trigger_ratio × target` |
| `guard_low` / `guard_high` | numeric(38,18) | SHIP | The `p_yes` band outside which a market is skipped. A reader checking why a market went un-topped-up needs both |
| `endgame_hours` | integer | SHIP | Hours before the resolution deadline in which no injection fires |
| `lock_timeout_ms` | integer | SHIP | Operational, and shipped anyway: a skipped injection may be a lock timeout rather than a guard, and this is the only figure that tells the two apart |
| `enabled` | boolean | SHIP | Whether the injector acts at all. The seeded row is `false` (ADR-0047 §G) and arming is a later INSERT, so the dataset records **when the injector was switched on**, not merely what it was configured to do |
| `effective_from` | timestamptz | SHIP | Newest `<= now()` wins; with `version` it gives the total order the newest-wins read needs |
| `created_at` | timestamptz | SHIP | |

`liquidity_policy` ships **in full**. It carries no PII, no `user_id` and no FK to any
participant table — it is a record of operator decisions about market depth, and every column
is load-bearing for reproducing an injection. ⚠ Note what shipping the *history* means as
opposed to shipping the current row: the table is append-only, so a reader sees every
parameter the experiment ever ran under and when each took force. A dataset carrying only the
final values would silently misattribute every earlier injection.

### B.17 Closing notes

**Tables not shipped (5):** `system_state`, `sessions`, `accounts`, `verifications`, `admin_sessions` per §19.3. Per-column treatment is undefined because the tables don't ship. Rationale per §19.3 row-by-row.

**Excluded entirely from the dataset inventory (5):** `watermark_state`, `cron_alarms`, `liquidity_heartbeat` (pg_cron operational — the last is ADR-0047's injector liveness record), `bet_receipts` (ADR-0031 idempotency backstop), and `bookmarks` (ADR-0032 — private per-viewer saved pointers at other authors' comments; Bucket C; no thesis/research signal, no PII). These carry no per-column treatment because they are not part of the dataset inventory at all (cross-ref §19.3) — distinct from the "not shipped (5)," which are dataset-relevant but withheld.

**Dataset-relevant with the answer still open (1): `lots`** (ADR-0039, §19.3 row 22). It has **no per-column section here, and that absence is the record rather than an omission.** Appendix B classifies columns for tables whose ship/not-ship is settled; `lots` is the first table in the inventory whose is not, because ADR-0039 declines the call in terms — *"Whether lots are released alongside bets is a SPEC.1 G3 question, not this ADR's."* Writing a per-column table would be indistinguishable from having decided, and the arithmetic above (16 × ~10 ≈ 157 decisions) would silently absorb it.

What a future G3 ruling needs is small and already known, so it is recorded here to save the re-derivation: the eleven columns are `id`, `bet_id`, `user_id`, `market_id`, `side`, `original_shares`, `original_basis`, `surviving_shares`, `surviving_basis`, `created_at`, `updated_at`. Exactly one — `user_id` — would be PSEUDO under §19.5, on the identical footing as `positions.user_id` (B.4); the rest are SHIP-shaped, carrying no PII and no free text. So a YES costs one line in the export-time JOIN pseudonymization and nothing else. This follows the `bet_receipts` / `bookmarks` precedent of a closing note rather than a section, but for the opposite reason: those have no per-column entry because nothing ships, this one because nobody has yet said whether it does.

**JSONB sub-key handling.** The `metadata` column on `events` / `admin_events` / `user_events` / `mod_actions` is a JSONB structured column where the seven-field set per §3.7 is consistent. The `STRIP_KEY` treatment removes specific JSONB keys from the released JSONB value while preserving the column structure — implementations use `jsonb_set(metadata, '{ip}', null)` then `metadata - 'ip'` (or equivalent jsonb-key removal) at export time.

**`actor_id` sentinel handling.** The `'admin-singleton'` literal string in `metadata.actor_id` is preserved verbatim across all audit tables — it's not a UUID to pseudonymize; it's a sentinel value the export pipeline must recognize per §3.6.

**H2 erasure interaction.** Per §19.4 + SPEC.1, H2 erasure scrubs `users` PII columns + null-s `pfp_filename`. At dataset-export time, H2-erased rows ship in the same shape as not-erased rows — both have NULL email, NULL google_id, etc. The dataset consumer cannot distinguish "user erased pre-freeze" from "user never had data."

**Coverage observation.** The 16 tables × ~10 columns each = ~157 column-level decisions. Of these:
- ~125 are SHIP (audit-trail integrity preserved; `market_media`'s 7 columns are all SHIP — admin-set public context, no PII)
- ~14 are PSEUDO (every `user_id` / `target_user_id` FK gets rewritten)
- 9 are STRIP / STRIP_KEY (the ten PII columns/keys per §19.4 minus one — `pfp_filename` is NULL_IF_ERASED instead of STRIP because it survives non-erasure)
- 1 is NULL_IF_ERASED (`users.pfp_filename`)
- ~12 are SHIP-with-policy-aware-treatment (e.g., `events.aggregate_id` resolves PSEUDO or SHIP per `aggregate_type`)

The asymmetric distribution reflects the privacy-by-design property: the dataset is **mostly preserved** (audit trail intact, K_eff(t) reconstructible from events log) with **narrow PII redaction** (only the ten columns/keys named in §19.4 actually leave the dataset).
