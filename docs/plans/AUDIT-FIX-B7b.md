# PLAN — AUDIT-FIX-B7b (A29 + A31 + A32 + A33 + A35)

> **Status: RATIFIED — execute.** Drafted in the B7b plan-mode session (2026-07-06, off origin/main
> `8ef34d4` = #212); delivered for web review; ratified by the operator with the four open decisions
> ruled as follows (kickoff, 2026-07-07):
>
> - **OD-1 — INCLUDE**: wire the participant sign route's events `metadata.request_id` to the
>   resolved request id (1 line; replaces the `'unknown'` placeholder).
> - **OD-2 — presence-only guard**: A35 checks `RESEND_FROM_EMAIL` presence only; no
>   sandbox-literal rejection.
> - **OD-3 — DROP**: no fs-based route-gone test for A32 (a deleted route can only return by
>   deliberate commit).
> - **OD-4 — security-auditor ENGAGED** with directed scope: the two env guards (instrumentation +
>   email-otp) and the two sign routes' authz/origin behavior unchanged.
>
> No web-authored riders this task — B7b touches no spec files (gated at execute: grep SPEC.2 for
> any positions-index enumeration; STOP for a web rider if one exists).

## 0. Prereqs — all verified

| Prereq | Result |
|---|---|
| origin/main head | `8ef34d4` = **#212 merge** (b7a-log close-out) ✓ |
| Tree clean == main | On `chore/b7a-log` (merged, remote auto-deleted); `git status` clean; `git diff origin/main` **empty** ✓ |
| Migration head | `0022_bet_receipts` on disk + journal idx 22 → **0023 is the verified next number** ✓ |
| In-flight branches | All remote branches are stale pre-merge leftovers (engine/bc/scaffold era); none touch the five seams ✓ |
| DP.2 parked | DP.2 = the prod-promote lane; A22 log states "prod promote stays parked (DP.2)"; nothing since (#209–#212 are all doc/code PRs) moved it. No collision ✓ |
| Seams already fixed on main? | No — all five verified live in their audited state (details below) ✓ |

---

## (a) A31 — positions index: plain `(market_id)`, named `positions_market_id_idx`

**The W-3 settle query, quoted** (`src/server/resolution/settle.ts:82-89`; `correct.ts:156-163` and `void.ts:87-94` are byte-identical in the `where`):

```ts
const positionRows = await tx
    .select({
        userId: positions.userId,
        side: positions.side,
        quantity: positions.quantity,
    })
    .from(positions)
    .where(eq(positions.marketId, args.marketId));
```

**No side filter.** All three W-3 flows read *every* position row for the market; `side` is a selected column consumed by the pure basis functions (`applySideBasis` / `refundBasis`), not a predicate. → **Plain `(market_id)`**, not composite `(market_id, side)`. The only other market-leading read (`debate-view/list-comments.ts:95` — `market_id` + `user_id IN` + `quantity > 0`) is equally served by a market-leading plain index. All remaining positions reads pair `user_id` and are covered by the existing `(user_id, …)` indexes.

**Bonus closure:** `positions.market_id` is a declared FK to `markets.id` (`schema/bets.ts:80-82`) with no index leading on it — A31 also closes the AGENTS.md §6 "FKs indexed on the referencing side" convention gap (sibling precedent: `bets_market_id_idx`, `bet_receipts_market_id_idx` — which also fix the name convention: **`positions_market_id_idx`**).

**Mechanics:** one-line schema edit in `src/db/schema/bets.ts` (add `index("positions_market_id_idx").on(table.marketId)` beside `positions_user_id_idx`) → `just db-generate positions_market_id_idx` → one generate run emits `0023_positions_market_id_idx.sql` + snapshot + journal entry at idx 23, on the verified 0022 head. Expected SQL (0008 precedent form): `CREATE INDEX "positions_market_id_idx" ON "positions" USING btree ("market_id");` — **plain CREATE INDEX, not CONCURRENTLY** (drizzle default; CONCURRENTLY is incompatible with the per-migration-tx runner; tables are tiny pre-launch). Execute-gate: if the generate run emits *anything* beyond this one index, that's un-flushed schema drift → STOP and surface. No ADR (performance/convention index, not architectural). AGENTS.md §6 "Current head" line updates 0022 → 0023 in the same PR.

---

## (b) A29 — §4.4 envelope on the two sign routes

**SPEC.2 §4.4, quoted (line 439):** Success: `{ ok: true, data: <flow-specific-shape> }`. Error: `{ ok: false, error: { code: <stable-string>, message: <display-template>, retry_after?: <seconds> } }` — `retry_after` present iff HTTP 429/503. And (line 445): "Every Route Handler response carries an `X-Request-Id` response header…" — so **both success paths become `{ok:true, data:{…}}` and every response (success + rejection) carries `X-Request-Id`.**

**The shared helper the bets stack uses:** there isn't an importable one. The §4.4 machinery is **module-private in `src/server/bets/endpoint.ts`** — `envelope()` (:66-82), `jsonResponse()` with X-Request-Id + retry-after (:84-98), and the `REQUEST_ID_SAFE` echo-or-mint (:63, :148-152). `admin/wire.ts` holds only the Server-Action side (`ActionResult<T>` — no HTTP/header wrapper).

**Decision: new minimal shared module `src/server/middleware/envelope.ts`** (exports `envelope()`, `jsonResponse()`, `resolveRequestId()` — duplicated from the bets private helpers with attribution), consumed by the two sign routes only. Rejected alternatives: (i) exporting from `bets/endpoint.ts` — puts the bets critical path in the diff and couples upload surfaces to the bet stack; (ii) per-route local wrappers — duplicates it twice instead of once. The bets stack keeps its private copies; unification + §15.1 metadata (`error_type`, `retry_semantics`) + the `error_origin_rejected → error_origin_not_allowed` rename all ride the forward ENGINE error-envelope deliverable (ENGINE.8 Q4), per the ratified disposition. `middleware/` is the house home for cross-cutting HTTP concerns (logging, origin-allowlist, rate-limit).

**Note (spec↔build drift, noted once):** §4.4 says the id is "proxy.ts-generated," but `proxy.ts:15` marks request-id injection as `TODO(SCAFFOLD.5+)` — the built reality is the bets echo-or-mint pattern (`REQUEST_ID_SAFE` echo, else mint uuidv7), which A29 adopts. No proxy.ts touch.

**Full rejection-site inventory (all lines re-confirmed live).** Kickoff lists were subsets; the full inventory is a superset — flagged as a deviation-by-extension:

*Participant `api/uploads/sign/route.ts`* — local `jsonResponse` helper :68-76 (replaced by shared); origin :83 (`error_origin_rejected` 403 — **code kept as-is**); unauthenticated :89 (401); onboarding :96-99 (403); rate-limit :108-114 (429, gains body `retry_after` per §4.4); invalid JSON :128 (400); invalid body :133-136 (400); **plus the kickoff-unlisted catch sites** :191 (`ImageMimeRejectedError` 400), :195 (`ImageOversizeError` 400), :201-204 (`StorageUnavailableError` 503, gains body `retry_after: 5`); success :184-187 → `{ok:true, data:{uploadId, putUrl, key}}`.

*Admin `(admin)/admin/markets/media/sign/route.ts`* — local helper :86-94 (replaced); :137-140 invalid body; :146 invalid market id; :150-153 mime; :160-161 oversize; **plus unlisted** :101 origin, :106 `admin_session_required` 401, :113-116 rate-limit 429, :132 invalid JSON, :182-185 storage 503; success :178 → `{ok:true, data:{mediaId, putUrl, key}}`.

All **code strings kept verbatim** (shape-only fix); `message` display templates added per code in the bets terse style. The three/one `err.toEnvelope()` catch sites keep `toEnvelope()` as the code-string source — `envelope(err.toEnvelope().error, "<message>", …)` — so `lib/errors.ts` is untouched and `toEnvelope()` doesn't become an orphan.

**Caller reconciliation (same PR, contained):** exactly **one** live caller — `src/app/(admin)/admin/markets/new/create-market-form.tsx`. It breaks on both paths: error branch reads flat `body?.error` as a string (:63-67 → would render `[object Object]`), success destructures the bare shape via `SignResponse` (:24-28, :69). Fix: `SignResponse` → the `{ok:true; data:{mediaId, putUrl, key}}` form; error branch reads `body?.error?.code`. The participant route has **no client caller yet** (composer is future UI work) — not breaking beyond this PR's reach; STOP condition not tripped.

**OD-1 (RATIFIED: INCLUDE):** the participant route's events `metadata.request_id` is the `'unknown'` placeholder (:146, S-C deferral). Once the handler resolves a real `requestId` for the header, wiring it into metadata is 1 line and makes the echoed header actually correlate (the stated purpose of §4.4's echo). Execute-gate: confirm no event-payload contract pins the placeholder; STOP if one does.

---

## (c) A35 — RESEND_FROM_EMAIL prod guard

**Seam confirmed:** `src/server/auth/email-otp.ts:24` — `const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";`. In prod the sandbox sender delivers only to the operator inbox → every real participant OTP sign-in fails.

**Central env seam located:** `instrumentation.ts::register()` — the canonical boot-time gate (SCAFFOLD.8 LD-2: "a boot-time throw fails the deploy rather than surfacing later"), with the exact precedent at :36-43 (A18-DSN: throw when prod/staging and DSN unset; preview exempt). No Doppler-fed zod env schema exists; this is the house seam. **STOP condition not tripped** — the guard needs no spread.

**Mechanism — two lines of defense (the LD-10 house pattern):**
1. **Primary, boot-time in `instrumentation.ts`:** `if (env === "prod" && !process.env.RESEND_FROM_EMAIL) throw` — fails the staged deploy at cold boot; the pre-promote `/api/health` gate (ADR-0024 runbook §3) catches it before any traffic.
2. **Backstop, send-time at the audited line:** in `sendVerificationOTP`, resolve `from` via a guard — set → use it; unset + `ZUGZWANG_ENV === "prod"` → throw (mirrors the existing `RESEND_API_KEY` fail-fast at :19-21); unset otherwise → sandbox fallback. File-head comment (:3-8) updated to document the guard. This is the entire auth/ touch — surgical env guard only, no auth-logic change.

**Enforcement scope: `prod` only** — deliberately narrower than the DSN gate's prod+staging. Justification: staging's sandbox sender is the *documented deliberate state* until the parked SCAFFOLD.12 §10.b Resend domain-verification/sender flip (verified still parked, `docs/parked.md:12`) — including staging would hard-fail every staging deploy on a parked ops task. Preview/local/CI exempt: no delivery expectations, and `ZUGZWANG_ENV=preview just verify` + CI must stay green. **Confirmed NOT this task:** the ops-side sender flip stays parked at §10.b; this is code-side only.

**OD-2 (RATIFIED: presence-only)** — the finding is the *silent* fallback; an explicitly-set value is visible and deliberate in Doppler. No sandbox-literal rejection.

---

## A32 — delete the (dev) scaffold page (and the group)

Verified: `src/app/(dev)/scaffold-1-smoke/page.tsx` is the group's **only** file; its own body says "removed by DESIGN.7 close-out per plan Open Question #1"; **zero inbound refs** (grep across src/tests/docs/.github/scripts). **Decision: the emptied `(dev)/` route-group folder goes too.** Deletion pulls in exactly one page + one stale AGENTS.md §3 tree line (:69 `(dev)/ # scaffold smoke page`) — within the STOP threshold. Execute-time gotcha: `just clean` before pre-push (stale `.next/types/validator.ts` references a removed route; `.next/types` confirmed present locally).

**OD-3 (RATIFIED: DROP)** — no fs-based route-gone test; tsc/biome/build is the gate.

## A33 — comment-only rewrite in `schema/image-uploads.ts:35-38`

Verified false: the comment claims "Drizzle 0.45 pgTable doesn't surface CHECK natively" while `check("positions_quantity_non_negative", …)` sits in `schema/bets.ts:110` in the same directory. Constraint confirmed live in `0006_image_uploads_extension.sql` (inline on the `byte_size` ADD COLUMN: `CHECK (byte_size > 0 AND byte_size <= 8388608)`). Rewrite states: drizzle **can** express `check()`; the constraint lives in 0006; declaring it in `pgTable` now would make drizzle-kit diff it against the snapshot (which lacks it — 0006 is hand-written) and emit a duplicate-constraint migration; parity deliberately deferred. **No schema-object/snapshot/migration touch** — comment-only, so no migration can be emitted.

---

## (d) Tests — test-writer scope per finding

- **A29 (RED-first):** new `tests/server/storage/sign-route-envelope.test.ts` + `tests/server/admin/markets-media-sign-envelope.test.ts` — per route: success `{ok:true, data:{…}}` + `X-Request-Id` present; every rejection site `{ok:false, error:{code, message}}` with the verbatim code; 429/503 carry body `retry_after` + `retry-after` header; safe inbound `x-request-id` echoed, unsafe replaced by a minted UUIDv7. Existing updates: `markets-media-sign.test.ts` (flat `body.error` asserts at :132-133, :151-152, :182-183 → `body.error.code`), body-reads in `sign-route-write-once.test.ts` / the two log-request suites as hit. Service-level suites (`sign-upload.integration`, `sign-upload-event`) test the helper, not the wire — unaffected.
- **A31:** new `tests/db/indexes/positions-market-id.spec.ts` — pg_indexes assert: exists, non-unique, btree, leading `market_id` (no precedent exists; this mints one). Migration-apply is exercised by CI's `drizzle-kit migrate` + `db:check-drift` (journal-head vs DB) and the already-migrated local :54322. No TRUNCATE-guard interlock (no new Bucket-A table).
- **A32:** none (OD-3 ratified: DROP the fs route-gone test).
- **A35 (RED-first):** extend `tests/server/observability/instrumentation-register.test.ts` (its delete/restore pattern reused): prod+unset rejects; prod+set, staging+unset, preview+unset resolve. New auth test: `sendVerificationOTP` prod+unset throws *before* any Resend call; staging/preview+unset uses the sandbox `from`; set → used. Caution encoded: `tests/_setup/env.ts` defaults `ZUGZWANG_ENV??="prod"` **and** `RESEND_FROM_EMAIL??=<sandbox>` — tests must explicitly delete/restore both (`delete`, never `= undefined`).
- **A33:** none (comment-only; tsc/biome is the gate).

## (e) Ritual

**ONE PR**, branch `fix/audit-fix-b7b` (name-free check before `checkout -b`). Order: commit plan file → test-writer REDs (A29/A31/A35) → implement → **sequential, directed-scope cascade**: `code-reviewer` (routes + envelope module + instrumentation + email-otp, per-point verify-AND-STATE) → `db-migration-reviewer` (schema/bets.ts index, 0023 + snapshot/journal, image-uploads comment) → **`security-auditor` ENGAGED (OD-4 ratified)** with directed scope (the two guards + the two routes' authz/origin behavior unchanged). Gate-C applies regardless: `ZUGZWANG_ENV=preview just verify` + **full `pnpm vitest run` directly against local :54322** (not via `just`) + `pnpm test:invariants`/`test:integration` within it; `just clean` before push (A32). §5.10 self-audit before `gh pr create`. AGENTS.md drift fixes ride the PR: §3 tree (drop `(dev)/`), §6 migration head 0022→0023, §9 test-tree additions. Squash-merge; session log AFTER merge as `chore/b7b-log`; commit via `/tmp/commit-msg.txt -F`, no Co-authored-by.

**NOT doing (confirmed):** §15.1 catalogue / `error_origin_rejected` rename / bets-stack refit (ENGINE.8 Q4); A33 DDL parity; W-1/moderation/auth-logic changes; ops-side sender flip (§10.b); B8; DP.

**Divergences found (none blocking):** kickoff's rejection-site lists were subsets — full inventory above; §4.4's "proxy.ts-generated" request id is a SCAFFOLD.5+ TODO, bets echo-or-mint adopted instead; participant sign's `error_unauthenticated` vs bets' `error_session_required` code drift noted, not touched (rides the catalogue deliverable).
