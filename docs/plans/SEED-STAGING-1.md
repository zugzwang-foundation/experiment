# SEED-STAGING-1: seed activity into staging markets from an uploaded sheet

| | |
|---|---|
| Status | **DRAFT, for approval.** No code written. |
| Environment | **Staging only.** Production must be structurally unable to run it. |
| Critical-path areas touched | 1 (bet placement), 4 (auth: user creation, ToS), 6 (identity pool). Full ritual: tests first, `@code-reviewer`, `@security-auditor`, same-commit ADR, pre-PR self-audit. |
| ADR | `docs/adr/0062-staging-seed-activity-tool.md` (next free number; re-read the ceiling before minting) |
| Estimate | 3–4 working days |

## 1. Goal

From the admin panel on **staging**, an operator uploads a CSV or Excel file of arguments. Each row becomes **one argument with its bet**, posted by a **test participant with an auto-assigned pseudonym**, into one of the 6 markets. It takes one upload and one or two clicks, and re-running the same file never duplicates anything.

## 2. Non-goals

- **No production use, ever.** This is not a launch tool for the live site.
- No direct SQL writes. Every row goes through the shipped engine.
- No custom usernames. Pseudonyms come from the identity pool, as for every account.
- No images in v1.
- No drip-over-time mode in v1 (section 11).
- No new database table or migration.

## 3. Guardrails (each one independently blocks production)

| # | Guard | Where |
|---|---|---|
| G1 | The page returns `notFound()` unless `ZUGZWANG_ENV === "staging"` | `src/app/(admin)/admin/seed/page.tsx` |
| G2 | Every server action calls `assertSeedToolsEnabled()` first. It throws unless `ZUGZWANG_ENV === "staging"`. | `src/server/seed/gate.ts` |
| G3 | Admin session required (`requireAdminSession`). Participants can never reach it. | the actions |
| G4 | Test accounts use the `.invalid` email domain (`seed-<label>@seed.staging.invalid`), so they can never belong to a real person and are easy to identify | `src/server/seed/participants.ts` |
| G5 | Unit test: with `ZUGZWANG_ENV=prod`, the gate throws and the page 404s | `tests/unit/seed/gate.test.ts` |

## 4. Sheet format

One sheet with a `market` column, **or** an `.xlsx` with one tab per market whose tab name is the slug.

| Column | Required | Rule |
|---|---|---|
| `market` | yes (single-sheet layout) | The slug of an **Open** market |
| `user` | no | Internal label. The same label means the same test participant across rows and markets; blank means a new participant for that row. Never shown on the site. |
| `side` | yes | `YES` or `NO` |
| `stake` | yes | ≥ `BET_MIN_STAKE_POST` (10) for a post, ≥ `BET_MIN_STAKE_REPLY` (50) for a reply, ≤ the maximum stake |
| `argument` | yes | Non-empty. Same length limits as the composer. |
| `reply_to` | no | The row number of an earlier argument **in the same market** (Support if same side, Counter if opposite) |

A downloadable template ships with the page.

## 5. Flow

```
Upload ─► previewSeedSheet (server action)
            parse → normalise → validate ALL rows → plan
            returns: per-market counts, participants needed, errors by row
            ANY error → nothing runs; the operator fixes the sheet
        ─► operator clicks "Seed"
        ─► browser loops: runSeedChunk(rows N..N+24) until done
            server RE-VALIDATES the chunk (never trusts the browser)
            for each row: get-or-create participant → place bet+argument
            returns per-row result: posted | skipped (already posted) | failed (reason)
        ─► final report: per market (posted / skipped / failed / final YES price)
                         + label → pseudonym mapping
```

There is **no stored job state.** The browser holds the parsed rows and sends them in chunks of 25. Resuming means uploading the same file again; idempotency (section 7) skips what already ran. Chunking keeps each request well under the ALB's 60-second idle timeout.

## 6. Separating the data across the 6 markets

1. **Read:** each row is tagged with its market (column or tab name).
2. **Validate per row and across rows:**
   - the market exists and is Open;
   - the side, stake bounds and body are valid;
   - `reply_to` points to an **earlier** row in the **same** market;
   - **one side per participant per market** (`I-SINGLE-SIDE`);
   - **no self-replies** (D-52);
   - reply depth is 1;
   - each participant's **total stake** fits their starting Dharma plus daily credit.
3. **Group by market:** 6 independent groups.
4. **Order:** sheet order, except that a reply is never posted before its parent.
5. **Execute:** market by market. A failure in one market stops that market's remaining rows and doesn't affect the others; the report shows exactly where it stopped.

## 7. Idempotency and re-runs

- `batchId` = SHA-256 of the normalised file content. The same file gives the same IDs.
- **Bets:** `idempotencyKey = seed-<batchId[0:16]>-r<row>`, which matches `IDEMPOTENCY_KEY_REGEX`. A replay hits the `bet_receipts` unique index (23505); the W-1 transaction rolls back and the row reports `skipped` (`I-IDEM-ONCE-001`).
- **Participants:** a label maps to the deterministic email `seed-<label>@seed.staging.invalid`, and a blank label to `seed-<batchId[0:12]>-r<row>@…`. The email is looked up before creating the account, so a re-run reuses the same participant and pseudonym.
- **Replies across runs:** the comment ID of a `reply_to` parent is resolved from that row's bet receipt, so a resumed run can still reply to a parent posted earlier.

## 8. How each row is executed (reusing the engine, no new write logic)

**Create a participant**, mirroring `tests/staging/generate.staging.test.ts` `createParticipant`:
1. `auth.$context` → `internalAdapter.createOAuthUser(...)`. This runs the real `databaseHooks.user.create.before` → `consumeIdentityPoolTuple`, which assigns the pseudonym and avatar.
2. Record ToS acceptance and `grantInitialDharma`. **This needs one refactor:** `acceptTosAction` reads `cookies()` and `headers()`, which aren't available for a synthetic user. Extract its transaction body into `recordTosAcceptance({ userId, ip, userAgent, metadata })`; `acceptTosAction` keeps calling it, unchanged in behaviour. Synthetic participants record the fixed non-address IP and user-agent literals the staging generator already uses (manifest §1.7 B5).
   - ⛔ **The extracted function must NOT live in `tos-accept.ts`.** That file is `"use server"`, and Next.js exposes every export of a `"use server"` module as a publicly callable Server Action. A `recordTosAcceptance(userId)` exported there would let anyone grant themselves (or any user ID) the initial Dharma. It goes in `src/server/auth/tos-record.ts`, which imports `server-only` and has no `"use server"` directive. A guard test asserts `tos-accept.ts` still exports exactly one function.

**Post the argument:** `runBetTransaction({ marketId, flow }, ctx => place(ctx, {...}))`. The `flow` is `F-COMMENT-2` for a reply and `F-BET-1` otherwise, with `assertStakeFloor` / `clampStakeToMax` checked first, exactly as the generator does.

**Post-commit steps:** none to mirror. Read from `api/bets/place/route.ts` at `64c2749b`: it calls `runBetTransaction(place)` and returns. Cache freshness is the shared-view window, not an invalidation call.

**Re-run detection:** the same two helpers the route uses. `isDurableIdempotencyConflict(err)` identifies the `bet_receipts` 23505; `loadDurableReplay(db, { userId, idempotencyKey, bodyFingerprint })` returns the stored result, including `commentId`. That `commentId` is how a resumed run finds a reply's parent. `bodyFingerprint` comes from `computeBodyFingerprint` (`src/server/idempotency/cache.ts`), over the same normalised row, so a replay matches.

**Pre-checks copied from the route, in its order:** body non-empty after trim; `body.length <= COMMENT_MAX_LENGTH` (5000); stake > 0; `validateReplyParent` with no self-reply; `clampStakeToMax` (250) then `assertStakeFloor`. Unlike the route, a stake above the maximum is **rejected** in preview rather than clamped, so the sheet's numbers are never silently changed.

**Provenance:** `metadata.request_id = "seed-staging:<batchId[0:16]>"` on every event this tool causes, so seeded activity is identifiable in the event log without any schema change.

**Moderation:** not called in v1. The content is operator-supplied and staging-only, and the generator also doesn't moderate. A checkbox to run `precommitModerate` per row can be added if wanted; it costs OpenAI usage.

## 9. Files

| File | Kind |
|---|---|
| `src/app/(admin)/admin/seed/page.tsx` | New page (G1) |
| `src/app/(admin)/admin/seed/_components/SeedUploader.tsx` | New client component: upload, preview, chunk loop, progress, report |
| `src/app/(admin)/admin/seed/actions.ts` | New server actions `previewSeedSheet` and `runSeedChunk` (G2, G3, zod-validated) |
| `src/server/seed/gate.ts` | New: `assertSeedToolsEnabled` |
| `src/server/seed/parse.ts` | New: CSV/XLSX → raw rows |
| `src/server/seed/validate.ts` | New, pure: row and cross-row rules (section 6) |
| `src/server/seed/plan.ts` | New, pure: grouping, ordering, labels → participants |
| `src/server/seed/participants.ts` | New: get-or-create a participant |
| `src/server/seed/post.ts` | New: one row → `runBetTransaction(place)` |
| `src/server/auth/tos-record.ts` | **New, `server-only`, NOT `"use server"`:** `recordTosAcceptance`, the transaction body extracted from `acceptTosAction` (area 4) |
| `src/server/auth/tos-accept.ts` | **Refactor:** calls `recordTosAcceptance`. Behaviour unchanged, and still exactly one export. |
| Admin nav | Link to "Seed activity", rendered on staging only |
| `docs/adr/0062-staging-seed-activity-tool.md` | New ADR, same commit |
| `package.json` | **Only if approved:** `exceljs` for `.xlsx` and robust CSV (arguments contain commas, quotes and newlines) |

## 10. Tests (written first by `@test-writer`)

| Test | Proves |
|---|---|
| `tests/unit/seed/gate.test.ts` | G1/G2/G5: `prod` and `preview` refuse, `staging` passes |
| `tests/unit/auth/tos-accept-exports.test.ts` | `tos-accept.ts` exports exactly `acceptTosAction`; `tos-record.ts` has no `"use server"` and imports `server-only` |
| `tests/unit/seed/validate.test.ts` | Every rule in section 6, including cross-market `reply_to`, a self-reply, a side flip and an over-budget participant |
| `tests/unit/seed/plan.test.ts` | Split into 6 groups; replies after parents; label reuse across markets |
| `tests/unit/seed/parse.test.ts` | CSV with quoted commas and newlines; XLSX tabs as markets; a bad header is rejected |
| `tests/integration/seed-run.integration.test.ts` | Against local test Postgres: participants created through the identity pool (pseudonym set, `initial_grant` once); bets and comments written by the engine; **running the same batch twice changes nothing**; the opposite side is rejected; the prices move |
| Existing auth tests (`tests/server/auth/`, `auth-dbl-1-first-login-session`, `signup-create-path`) | The `recordTosAcceptance` refactor preserves behaviour |
| `pnpm test:invariants` | All 13 invariants stay green |

## 11. Phase 2 (only if wanted)

- **Drip mode:** post rows spread over a chosen period, so charts look organic. It needs either the browser to stay open (simple), or a server-side queue drained by a new EventBridge rule (an infrastructure change, approved separately).
- **Price preview:** simulate each market's final YES price before seeding, using the pure CPMM functions.
- **Images per row.**
- **Grafana button:** a dashboard button that opens the upload page or triggers it.

## 12. Verification on staging (after merge, before handing to the client)

1. Upload a 6-row sheet (one row per market): all posted, pseudonyms assigned, prices moved.
2. Upload the same file again: 6 skipped, 0 posted.
3. Upload a sheet with a deliberate error: preview shows the row, and nothing runs.
4. Confirm `zugzwangworld.com/admin/seed` returns 404 and the action refuses.
5. Check the staging identity-pool headroom before the full ~600-row run.
6. Run the full client sheet.

## 13. Risks

| Risk | Handling |
|---|---|
| Accidentally enabled on production | Gates G1–G5 plus a test. Production builds set `ZUGZWANG_ENV=prod`. |
| Staging data is permanent until a staging reset | Test with a small sheet first. Only `pnpm staging:rebuild` wipes it (and it refuses while content markets exist, by design). |
| Staging stops mirroring production volumes | Accepted for demos. `pnpm staging:gates` coverage output may drift and needs re-pinning or a note. |
| The identity pool runs out | Check the headroom first; reuse labels; `db:seed:staging` can refill it. |
| The ToS refactor touches auth | Behaviour-preserving extraction, covered by the existing auth suites plus `@security-auditor`. |
| A new dependency (`exceljs`) | AGENTS.md §11 ask-first. Alternative: CSV only, parsed by a small tested parser. |

## 14. Decisions (operator, 2026-10-01: "ok start working", taken as the recommended defaults)

1. **File types:** CSV + XLSX via `exceljs` (one new dependency, visible in the PR for sign-off).
2. **Participants:** the `user` label column as designed; blank means one new participant per row.
3. **Moderation:** skipped in v1.
4. **Phase 2:** later.
5. **The `recordTosAcceptance` refactor:** approved, in `tos-record.ts` per section 8.

## 15. Process notes

- **Base:** `origin/staging` @ `64c2749b`. The PR targets `staging`. `staging` is 20+ commits ahead of `main`, and this tool is staging-only.
- ⚠ **`ci.yml` now carries `pull_request: branches-ignore: [staging]`, so a PR into `staging` runs NO CI.** The local gate is therefore the only gate: `ZUGZWANG_ENV=preview just verify` + `pnpm test:invariants` + `pnpm test:integration` against a local Postgres 17 with migrations applied as CI applies them. The push to `staging` still runs CI inside `deploy-aws.yml` before deploying.

## 16. Module contract (tests and implementation are both written against this)

All under `src/server/seed/`. The pure modules import nothing from `@/db`.

```ts
// gate.ts
export class SeedToolsDisabledError extends Error {}
export function isSeedToolsEnabled(env?: string | undefined): boolean; // default process.env.ZUGZWANG_ENV; true ONLY for exactly "staging"
export function assertSeedToolsEnabled(): void;                       // throws SeedToolsDisabledError otherwise

// types.ts
export type RawSeedRow = {
  rowNumber: number;   // 1-based data-row index (header excluded); continuous across tabs in tab order
  market: string; user: string; side: string; stake: string; argument: string; replyTo: string; // trimmed strings ("" when blank); argument is NOT trimmed
};
export type SeedRow = {
  rowNumber: number; marketSlug: string; userLabel: string | null;
  side: "YES" | "NO"; stake: string; body: string; replyToRow: number | null;
};
export type SeedRowError = { rowNumber: number; message: string }; // rowNumber 0 = file-level error
export type SeedRowStatus = "posted" | "skipped" | "failed" | "halted";
export type SeedRowResult = {
  rowNumber: number; marketSlug: string; status: SeedRowStatus;
  pseudonym: string | null; newPrice: string | null; message: string | null;
};

// parse.ts
export async function parseSeedFile(args: { fileName: string; bytes: Uint8Array }):
  Promise<{ rows: RawSeedRow[]; errors: SeedRowError[] }>;
// .csv → one sheet. .xlsx → if the FIRST sheet has a `market` header, rows come from that sheet;
// otherwise EVERY sheet is read and its tab name is the market slug.
// Headers are case-insensitive and trimmed; `reply_to` | `replyto` | `reply to` are equivalent.
// Required headers: side, stake, argument (+ market for single-sheet). Missing → file-level error.
// Fully blank rows are skipped and do not consume a rowNumber. Any other extension → file-level error.

// validate.ts (pure)
export const SEED_LABEL_RE: RegExp; // /^[A-Za-z0-9_-]{1,40}$/
export function validateSeedRows(rows: readonly RawSeedRow[], ctx: { openMarketSlugs: ReadonlySet<string> }):
  { rows: SeedRow[]; errors: SeedRowError[] };
// Rules (each violation → one error naming the row):
//  market ∈ openMarketSlugs · side ∈ {YES,NO} (case-insensitive input) · label blank or SEED_LABEL_RE
//  stake: plain positive decimal, ≤18 fraction digits; ≥ BET_MIN_STAKE_POST (post) / BET_MIN_STAKE_REPLY (reply);
//         > BET_MAX_STAKE is an ERROR (never clamped)
//  body: trim non-empty, length ≤ COMMENT_MAX_LENGTH (body is kept untrimmed in SeedRow)
//  replyTo: blank, or an integer naming an EARLIER rowNumber in the SAME market whose row is itself
//           a top-level post (depth 1) and is itself valid
//  self-reply: same non-null label as the parent → error
//  one side per (label, market): a labelled participant may not appear on both sides of one market
//  budget: Σ stake per non-null label ≤ INITIAL_USER_DHARMA
// `rows` contains ONLY rows with no error. Callers treat errors.length > 0 as "run nothing".

// plan.ts (pure)
export type SeedMarketGroup = { marketSlug: string; rows: SeedRow[] };
export function planSeedBatch(rows: readonly SeedRow[]): SeedMarketGroup[]; // groups in first-appearance order; sheet order within
export function computeBatchId(rows: readonly SeedRow[]): string;            // sha256 hex of canonical JSON; same rows → same id
export function seedIdempotencyKey(batchId: string, rowNumber: number): string; // `seed-${batchId.slice(0,16)}-r${rowNumber}`
export function seedParticipantEmail(batchId: string, row: SeedRow): string;
// label → `seed-${label.toLowerCase()}@seed.staging.invalid`; blank → `seed-${batchId.slice(0,12)}-r${rowNumber}@seed.staging.invalid`
export const SEED_REQUEST_ID_PREFIX = "seed-staging:";

// participants.ts (DB)
export async function getOrCreateSeedParticipant(args: { email: string; batchId: string }):
  Promise<{ userId: string; pseudonym: string; created: boolean }>;
// Existing user by email → reused (created:false). Else Better Auth createOAuthUser (identity pool assigns
// the pseudonym) then recordTosAcceptance (initial grant). Never writes a pseudonym itself.

// run.ts (DB)
export async function runSeedChunk(args: {
  rows: readonly RawSeedRow[];   // the WHOLE batch every call; re-validated server-side every call
  fromIndex: number; count: number; haltedMarkets: readonly string[];
}): Promise<{ batchId: string; results: SeedRowResult[]; nextIndex: number; done: boolean;
              haltedMarkets: string[]; errors: SeedRowError[] }>;
// assertSeedToolsEnabled() FIRST. Validation errors → no writes, results [], errors returned.
// Processes planned order (groups flattened) [fromIndex, fromIndex+count).
// A row in a halted market → "halted". A failed row halts its market for the rest of the batch.
// A replayed row (bet_receipts conflict) → "skipped"; its commentId still resolves later replies.
```

```ts
// src/server/auth/tos-record.ts — "server-only", NO "use server"
export async function recordTosAcceptance(args: {
  userId: string; ip: string; userAgent: string;
  metadata: { request_id: string; flow_id: string; user_id: string; actor_id: string;
              idempotency_key: null; ip: string; user_agent: string };
}): Promise<boolean>; // false = user row missing; true = accepted now OR already accepted (no second grant)
```
