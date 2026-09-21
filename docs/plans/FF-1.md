# FF-1 — the friendly-fire toggle on same-side reply-bets

> **Status:** executing (overnight run, `docs/overnight-run.md` v1.2 extended by D-51 R9)
> **Date:** 2026-09-22
> **Author:** Claude Code (autonomous overnight session), from the web-authored brief `FF-1_overnight-brief.md` and the three prescriptive companion files
> **Critical-path?** **yes** — area 1 (bet placement: `src/server/bets/`, `src/server/comments/`) and area 7 (schema and migrations); the ranking/substrate work under `src/server/debate-view/` and `src/lib/` rides the same PR
> **Plan PR / commit:** this file is committed on `feat/ff-1` before slice 0; PR-A (`feat/ff-1 → main`) and PR-B (`feat/ff-1-ui → feat/ff-1`) are opened at S5/S8 and LEFT UNMERGED

> **Section map against the brief.** The brief calls for "the §2 locks table". In this template §1 is the invariants table, so the six-row locks table lives in **§1** here and §2 is the data model, as the template has always numbered them.

---

## Tracker context

Tracker entry (relayed in the brief; the tracker is operator-maintained and external): **FF-1 — the friendly-fire toggle on same-side reply-bets.** Ruled D-51 (RECORD-v2.10 amendment) on 2026-09-22, pre-launch; architecture in ADR-0058. Dependencies at plan time, measured on `origin/main` `22b39987`:

| Dependency | Status |
|---|---|
| Reply-as-bet, `REPLY_DEPTH_MAX = 1` (ADR-0017) | shipped — `src/server/comments/reply-validate.ts`, `place.ts` |
| Surviving-basis aggregates + self-exclusion + two count pairs (ADR-0039 R4/P2/P3) | shipped — `ranking-substrate.ts:136-173`; parity test pins the spellings |
| Durable receipts + whole-body fingerprint (ADR-0031) | shipped — `idempotency/cache.ts:66-74`, `endpoint.ts:246` |
| Phone tier (ADR-0051) | shipped — both tiers mount one `BetComposer` |
| Local Postgres `:54322` with migration head `0030` | up, healthy, 31 journal entries applied |

## Approach (one paragraph)

One boolean on `comments`, `friendly_fire`, set in the same INSERT as `side_at_post_time` and never updated; a DB CHECK rejects it on a top-level post and the write path rejects it on a Counter (the parent row is needed for that half). The bet is untouched — an ordinary own-side buy through the unchanged W-1 spine. What changes is what is recorded (the column, `comment.placed.friendlyFire`, the receipt's `result`), what is read (three new aggregates at the three duplicated substrate sites, a `friendlyFire` on every reply substrate row), how the balance term reads it (`b = min(endorse, contest) / max(endorse, contest)`; `n`, `D`, lanes, badges untouched), and what is shown (a switch in the reply composer, a tag on the reply row, a one-sided meter at the head of the post-focus Support lane — never on the card, never a count, never a badge). Every prescriptive sentence comes verbatim from the companion files; every descriptive doc I maintain myself.

---

## 1. Thesis invariants touched — the locks table

| Lock | Touched? | How the plan preserves it | Test that asserts it | Concrete failure mode if the test is missing or wrong |
|---|---|---|---|---|
| **Dharma soulbound / no transfer, no overdraft (INV-2)** | no | The flag never reaches the ledger. `appendLedgerRow` is called with the same `bet_stake` debit as today; no new ledger entry type; no new endpoint. | `tests/server/comments/friendly-fire.test.ts::support-with-flag-buys-held-side` asserts one `dharma_ledger` row for the reply-bet with the stake debit unchanged; G4/G5 assert **zero** new ledger rows on a rejection. | A flagged reply that debited a different amount, or a rejection that left a debit behind, would move Dharma without a bet — the exact "input without stake" ADR-0017 Driver 3 forbids. |
| **Bet ↔ comment atomicity (INV-1)** | yes — the comment INSERT gains a column | The flag is written in `place()`'s existing comment INSERT inside the W-1 SERIALIZABLE tx; the in-tx guard throws BEFORE any write, so a rejected flag rolls nothing back because nothing was written. `bets.comment_id NOT NULL` is untouched. | G4 (`flag-on-counter-rejected-no-rows`) and G5 (`flag-on-top-level-rejected`) assert zero rows in `comments`, `bets`, `dharma_ledger`, `events`; G3 asserts exactly one `comments` + one `bets` row, paired by `bets.comment_id`. `I-ATOMICITY-001` unchanged. | A pre-check-only design could let a comment with `friendly_fire = true` land while the bet's side disagreed with the parent — a stored stance the model says cannot exist, permanent under Bucket A. |
| **Side frozen at post time (INV-3)** | yes — same INSERT | `sideAtPostTime: side` and `friendlyFire` are set in the one INSERT; the flag never changes which side the comment binds to; `opposite_side_held` still runs first. | G3 asserts `bet.side === "YES"` and `position.side` unchanged for a YES holder flagging a YES post; G6 asserts an entry reply with the flag lands on the parent's side. G2 asserts an UPDATE of the flag is refused by `bucket_a_no_update` (`P0001 … UPDATE not permitted`). | The wall in the brief: a "friendly-fire" implementation that bought the opposite pool would break the single-side lock while looking like a stance feature. |
| **Append-only / frozen at resolution (INV-4 + Bucket A)** | no new invariant; the existing trigger covers the column | `comments` stays Bucket A; the migration adds a column + CHECK and touches no trigger SQL; `EXPECTED_GUARD_CATALOG_ROWS` unchanged (guard-list parity test). | G2 (trigger refuses `UPDATE comments SET friendly_fire = true`, with a positive control: the same UPDATE shape against Bucket-C `positions` succeeds); `tests/unit/staging/guard-list-parity.test.ts` unchanged and green. | A mutable flag would let a stance be re-labelled after resolution — the `cast`/`clear` shape ADR-0017 P1 removed, back by accident. |
| **Admin is not a participant** | no | No admin surface, no `users` role, no admin path touched. | `grep -rn friendly src/server/auth/admin src/app/\(admin\)` stays 0 (self-audit line). | — |
| **Moderation fails closed (ADR-0014 posture, MOD-1 pending)** | no | The flag is validated before moderation (a 400 on the flag never reaches OpenAI); moderation still runs outside the tx; a moderation block still aborts before the tx opens. | Existing `tests/server/bets/moderation-outside-transaction.test.ts` unchanged; G4/G5 assert `precommitModerate` is NOT called on a flag rejection (the pre-check is ahead of step 6). | A flag rejection placed AFTER moderation would spend a vendor call and a Redis reservation on a request that can never commit. |

## 2. Data model changes

**Drizzle:** `src/db/schema/comments.ts` gains `friendlyFire: boolean("friendly_fire").notNull().default(false)` and a table-level `check("comments_friendly_fire_requires_parent", sql\`${table.parentCommentId} IS NOT NULL OR ${table.friendlyFire} = false\`)`.

**Migration:** `drizzle/migrations/0031_comments_friendly_fire.sql` — generated by `just db-generate comments_friendly_fire`, then READ: it must contain exactly `ALTER TABLE "comments" ADD COLUMN "friendly_fire" boolean DEFAULT false NOT NULL;` and `ALTER TABLE "comments" ADD CONSTRAINT "comments_friendly_fire_requires_parent" CHECK (…);` — nothing else. Snapshot `0031_snapshot.json` and `_journal.json` as drizzle-kit writes them. **Expand-only, reversible** (`ALTER TABLE comments DROP COLUMN friendly_fire` suffices; the CHECK drops with the column). No backfill (the default is the backfill; the existing rows are all top-level posts or pre-ADR replies, both correctly `false`). No trigger SQL touched. Bucket-A classification unchanged. Filename must NOT match `*pg_cron*` (CI strips those).

## 3. API surface

`POST /api/bets/place` (existing; auth: participant session; rate-limit class unchanged):
- Request body: `placeBodySchema` gains `friendlyFire: z.boolean().optional()` (absent ⇒ `false`).
- Validation (pre-tx, in the route, before moderation): `friendlyFire === true && parentCommentId === null` → 400 `friendly_fire_requires_reply`; `friendlyFire === true && validatedParent.sideAtPostTime !== side` → 400 `friendly_fire_requires_support`. Both throw before any write and before `precommitModerate`.
- In-tx guard (`place.ts`, after the position/balance reads, before any write): when `friendlyFire === true`, read the parent's `side_at_post_time` inside the tx and re-apply both checks; throw the same two errors. Gated on the flag so the unflagged path issues no extra statement.
- Response: `PlaceResult` gains `friendlyFire: boolean` (stored verbatim in `bet_receipts.result`, so a replay echoes it).
- Idempotency: the fingerprint already covers the whole body (A1-d); a replay with the flag flipped is a fingerprint mismatch → 409 `error_idempotency_key_reused` (G7).
- Client: `PlaceBody` gains `friendlyFire?: boolean`; `buildPlaceRequest` emits the key only when `true` (key-by-key rebuild, the file's own law).

No new event type. `comment.placed` payload gains `friendlyFire: z.boolean()`; `payload_version` stays 1 (measured convention: no site ever bumps it).

## 4. UI / user flow

**PR-B only** (`feat/ff-1-ui`, base `feat/ff-1`). Three elements, same testids on both tiers:

- **Composer** (`composer/BetComposer.tsx`, both tiers mount it): when `props.replyContext?.relation === "support"`, render beneath the header a switch `data-testid="ff-switch"` labelled `Friendly fire`, default off, helper copy exactly `Contest this argument without leaving your side. Your stake still backs {side}.`; submit adds `friendlyFire: true` to the body only when on. Not rendered for `relation === "counter"` nor for `kind === "post"`. A relation flip remounts the composer on both hosts (existing `key=`), so the switch state resets structurally; G12 asserts it.
- **Reply row**: `ArgProfile` gains an optional `friendlyFire?: boolean`; when true it renders a `Friendly fire` chip `data-testid="ff-tag"` beside `PositionMarker`, built from the same `Badge variant="secondary"` classes. Only `ReplyCard` (both tiers) passes it; `PostCard` never does.
- **Post-focus Support lane header**: desktop `ReplySplitBar.tsx`'s Support flank becomes [ff Đ figure] · [Support pill] · [single-fill bar + label `Friendly fire · N % of Support Đ`] · [Support Đ figure], all inside `data-testid="ff-meter"` and rendered only when `supportDharma > 0`; fill = `friendlyFireDharma / supportDharma` (integer percent, decimal arithmetic). Phone: a row beneath the relation tabs when the Support tab is active, same testid, same rules.
- **Post card**: unchanged; G12 proves it on markup.

## 5. Failure modes

| Failure | Detection | Recovery |
|---|---|---|
| Pre-check passes, in-tx guard throws (only possible if the parent row were mutated — it cannot be, Bucket A) | The route maps the error to 400; the tx never wrote | None needed; the guard is a belt |
| Migration applied, old code serving (`friendly_fire` column exists, code ignores it) | Column default `false` means every insert is valid; reads ignore the column | None — expand-only |
| New code serving, migration not applied | Every `comments` INSERT names `friendly_fire` → 42703 → the bet 500s | `migrate-before-serve` (deploy pipeline); CI's migrate + drift check; the health gauge |
| A replay under the same key with the flag flipped | 409 `error_idempotency_key_reused`, never cached (existing poison guard) | Client mints a new key for a genuinely new request |
| Cached debate view served with the pre-deploy DTO shape | The `'use cache'` store is per build; the key is `market` only | None |
| `supportDharma = 0` with a non-zero `friendlyFireDharma` (impossible: ff Đ ⊆ support Đ) | The meter hides on `supportDharma === 0`; percent computation guards the zero divisor | — |

## 6. Edge cases

- Entry reply (no position) with the flag on the parent's side → legal, lands the entrant on that side (G6).
- Entry reply with the flag on the OPPOSITE side → 400 `friendly_fire_requires_support` (covered by G4's shape: the check is on `side`, not on the held position).
- A holder of the parent's side who both plain-supports and friendly-fires the same post → counted in both `endorse_count` and `contest_count` (ADR-0058 consequence; pinned in G9's arithmetic).
- The post author friendly-fires their own post → excluded from `friendly_fire_dharma`, `endorse_count`, `contest_count` (self-exclusion), but keeps the reply's lane position and its tag (G9).
- A flagged reply sold to zero → `friendly_fire_dharma` drops (surviving basis) while `contest_count` stays (counts never decay) (G9).
- Flag on a reply to a REMOVED parent → the parent row still exists; validation unchanged; legal.
- `friendlyFire: false` sent explicitly vs absent → different fingerprints; both are valid requests; a replay must match its own body.

## 7. Test plan

| Layer | Scenarios | Invariants asserted |
|---|---|---|
| DB (`tests/db/`) | G1 column exists, default false, CHECK refuses a top-level flagged INSERT (23514) · G2 trigger refuses `UPDATE … SET friendly_fire = true` (P0001 `UPDATE not permitted`) with a Bucket-C positive control | INV-4 / Bucket A; the CHECK half of R2 |
| Server route (`tests/server/comments/friendly-fire.test.ts`) | G3 support-with-flag-buys-held-side · G4 flag-on-counter-rejected-no-rows (+ identical request unflagged succeeds as Counter) · G5 flag-on-top-level-rejected · G6 entry-reply-support-with-flag · G7 replay-with-flag-flipped-409 (+ identical replay returns the receipt) · G8 `comment.placed` payload carries the key | INV-1, INV-2 (zero rows), INV-3 |
| Integration (`tests/server/debate-view/reply-substrate.integration.test.ts` + `ranking-substrate`) | G9 the four-reply fixture → `support_dharma=100`, `friendly_fire_dharma=50`, `counter_dharma=50`, `endorse_count=1`, `contest_count=2`, `support_count=2`, `counter_count=1`, `n=3`, `D=150`; then B sells to zero → `friendly_fire_dharma=0`, `support_dharma=50`, counts unchanged | the meter and `b` read the right buckets; self-exclusion |
| Unit ranking | G10 `contested.test.ts` 10 endorse + 10 flagged, 0 counter → `b=1`, `n^b=20`, Contested-eligible; revert-to-red shows the side formula gives `b=0` · `friendly-fire-purity.property.test.ts` (fast-check): flags never move `n`/`D`; all-false gives the pre-ADR `b` · G11 parity pins for the three aggregates at the three sites + a DTO-leak rejection for `endorseCount`/`contestCount` | purity of the extension (B-2) |
| Unit foreclosure | `friendlyFireEligible` four cells + the entry case | UI guidance only |
| Unit export | G13 flagged replies print the marker; unflagged do not | — |
| Render (jsdom, PR-B) | G12 composer/tag/meter/card markup (innerHTML, never textContent alone) · G14 the same against the phone components | card untouched (R5) |

## 8. Out of scope

- The mirror cell (parked, D-51 R8). The dataset exporter (docket row only; PR #435 untouched). Admin surfaces, the tracker, number tuning, ADR-0013's lock-order mention, the dataset README, `docs/overnight-run.md` v1.3.
- `docs/specs/debate-export.md` (prescriptive, not in the companion blocks) — the export gains a marker, so that contract is flagged OWED to the web lane, not edited.
- Mobile beyond the switch/tag/meter. Any friendly-fire count, badge, or card element (walls).

---

## Slices (ordered; exit conditions; reviewer-bearing marked ★)

| Slice | Work | Exit | Reviewer |
|---|---|---|---|
| **S0** | Fill slots (`0058`, `51`, `10`, `22b39987`, versions, `0031_comments_friendly_fire`, date); copy ADR + record; delete the slot-rule line; apply every amendment block with the exactly-once check (line-bounded); CARRY any block that does not match once. | `grep -c '«'` = 0 on both committed files; one docs commit | — |
| **S1** ★ | Schema + migration `0031`; G1, G2 | `pnpm vitest run tests/db/ tests/invariants/` green; `db:check-drift` clean against the migrated local DB; guard-list parity green; `@db-migration-reviewer` PASS | @db-migration-reviewer |
| **S2** ★ | `@test-writer` RED-first for G3–G11 (isolation: worktree); then RF-3 (route + place + errors + client body type), RF-4 (event payload), RF-5 (`friendlyFireEligible`) | G3–G8 green, each shown red-then-green | @test-writer (before) |
| **S3** | RF-6: three substrate sites + `PostSubstrate`/`ReplySubstrate` + `derive()`; G9–G11; B-1 and B-2 re-measured | Δ statements 0; `b2.json` byte-identical | — |
| **S4** | RF-7: `DebateReply.friendlyFire`, `ReplyAggregate.friendlyFireDharma`, export marker; G13 | green | — |
| **S5** ★ | Pre-PR self-audit (§5.10) → `@code-reviewer` → `@security-auditor` (narrow) → fixes → full suite → push → PR-A. LEAVE UNMERGED. | PR-A open | @code-reviewer, @security-auditor |
| **S6** | `feat/ff-1-ui`: RF-8 desktop; G12 | green; card-unchanged test green | — |
| **S7** | RF-9 phone; G14 | green | — |
| **S8** | RF-10 screenshots; RF-11 descriptive maintenance; full suite; push; PR-B (base `feat/ff-1`). LEAVE UNMERGED. Report. | PR-B open; report written | — |

Full suite (`ZUGZWANG_ENV=preview just verify` + `pnpm vitest run`, DB suites from S1 on) green at the end of every slice.

## File map

| File | Why |
|---|---|
| `docs/decisions/RECORD-v2.10-amendment.md`, `docs/adr/0058-friendly-fire-toggle.md` | S0, verbatim companions |
| `docs/specs/SPEC.1.md`, `SPEC.2.md`, `RANKING.md`, `docs/design/design-language.md`, `docs/adr/0017-ranking-modes-and-top-composite.md` | S0, amendment blocks |
| `src/db/schema/comments.ts`, `drizzle/migrations/0031_comments_friendly_fire.sql`, `meta/0031_snapshot.json`, `meta/_journal.json` | S1 |
| `tests/db/comments-friendly-fire.spec.ts` | G1, G2 |
| `src/server/bets/errors.ts` (two classes), `src/app/api/bets/place/route.ts`, `src/server/bets/place.ts`, `src/server/events/schemas.ts`, `src/server/comments/foreclosure.ts`, `src/components/debate/composer/requests.ts` (type + key) | S2 |
| `tests/server/comments/friendly-fire.test.ts`, `tests/unit/comments/foreclosure.test.ts` (extend) | G3–G8 |
| `src/server/debate-view/{ranking-substrate,reply-substrate}.ts`, `src/server/profile/arguments.ts`, `scripts/verify-ranking-staging.ts`, `src/lib/ranking.ts`, `src/server/debate-export/image/compose.ts` (literal) | S3 |
| `tests/server/debate-view/reply-substrate.integration.test.ts` (extend), `tests/unit/ranking/{contested,substrate-site-parity}.test.ts` (extend), `tests/unit/ranking/friendly-fire-purity.property.test.ts` (new), ranking fixtures needing the two new fields | G9–G11 |
| `src/server/debate-view/load-debate-view.ts`, `src/server/debate-export/serialize.ts`, `tests/unit/debate-export/*` fixtures | S4, G13 |
| `src/components/debate/composer/BetComposer.tsx`, `ArgProfile.tsx`, `ReplyCard.tsx`, `composer/ReplySplitBar.tsx`, phone `PhoneDebateView.tsx` (+ a meter component) | S6/S7 |
| `AGENTS.md` §6, `CLAUDE.md` §1, `docs/records/DEBATE-record.md` §2, `docs/parked.md` | RF-11 (S8, on `feat/ff-1-ui`; the two contract files are descriptive) |

## Ambiguity register (kept current; mirrored in the run report)

| # | Ambiguity | Chose | Rejected | Why |
|---|---|---|---|---|
| A-1 | "run UTC date" — the run started 2026-09-21T21:43 UTC; the ruling, ADR and amendment are all dated 2026-09-22 | 2026-09-22 everywhere | 2026-09-21 | a SPEC change-log row dated before the ruling it cites would read as a contradiction; the commits land on 2026-09-22 UTC regardless |
| A-2 | "anchor occurs exactly once, byte-for-byte" — bare substring or line-bounded? | line-bounded (the fenced text as complete lines) | bare substring | every anchor is written as whole lines; under bare-substring, `## Patch record` matches twice in ADR-0017 (`:15` and the `## Patch record — 2026-09-05 …` heading at `:471`) and B5.2 would be CARRIED, while the intended site is unambiguous |
| A-3 | `comment.placed` `payload_version` on a shape change | leave at 1 | bump to 2 | no call site in `src/` ever passes `payloadVersion`; `insert.ts:165` defaults it; the codebase has never bumped (measured) |
| A-4 | Where the in-tx guard reads the parent | only when `friendlyFire === true` | always for replies | the brief predicts Δ statements 0 on the render path and asks for minimal blast radius; the unflagged path stays byte-identical in statements |
| A-5 | `endorseCount` / `contestCount` on `PostSubstrate` | REQUIRED fields | optional with a fallback to support/counter | a forgotten constructor must be a compile error (O-1); a fallback would silently re-instate the side formula at that site |
| A-6 | `friendlyFire` on `ReplySubstrate` | REQUIRED, sourced from the reply substrate row (`rc.friendly_fire`) | on `DebateComment` via `list-comments.ts` | keeps the flag next to `side` on the object that becomes `DebateReply`; `list-comments.ts` untouched |
| A-7 | `friendly_fire_dharma` predicate set | `support_dharma`'s shape + `AND rc.friendly_fire AND rb.id IS NOT NULL` | omit the explicit null guard as `support_dharma` does | the brief names all three predicates explicitly; the guard is a no-op for a SUM and makes the parity pin uniform |
| A-8 | Export marker | one bullet `- **Friendly fire:** yes` after `Relation`, non-removed variant only; `debate-export.md` flagged OWED | a heading change; a bullet on the removed variant | the removed variant carries the minimum; the heading is what the golden fixtures and the image route key on |
| A-9 | Client wire key when the switch is off | omit the key | send `friendlyFire: false` | `requests.ts`'s rule: optional keys are OMITTED when absent |
| A-10 | Where the switch lives | inside `BetComposer` (one file, both tiers) | per-tier switch components | both hosts mount the same composer with `replyContext.relation`; the remount on flip resets it for free |
| A-11 | Where the tag lives | `ArgProfile` via an optional prop only `ReplyCard` passes | a new chip in `ReplyCard` beside `ArgProfile` | the marker primitive renders inside `ArgProfile`'s meta row; "beside the side badge where the position marker sits" is that row |

## Open questions

None that block. Founder-facing flags (not resolved by this run): `docs/specs/debate-export.md` needs a web-authored rider for the new marker; the doctrine v1.3 patch is the web lane's.

## ADRs needed

ADR-0058 (web-authored, committed verbatim at S0).

## Self-critique

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | medium | The brief's reply-entry-point premise named two files that do not exist; a plan built on it would have "carried" `friendlyFire` through paths that are not there. | Measured (recon premise 1); the plan targets the one route + one client builder. |
| 2 | medium | The in-tx guard needs a parent read `place()` does not do today; done unconditionally it would add a statement to every reply's tx. | Gated on the flag (A-4). |
| 3 | low | Making the two ranking counts required breaks three constructors and the ranking test fixtures. | Accepted: that is the compile error doing the job (A-5); the fixture builders gain the two fields with defaults equal to the side counts. |

## References

`CLAUDE.md` · `AGENTS.md` · `docs/overnight-run.md` v1.2 · `FF-1_overnight-brief.md` (operator's Downloads) · ADR-0058 · RECORD-v2.10 · SPEC.1 §8 F-COMMENT-2 / §9 · SPEC.2 §5.1 row 4 / §5.4 · RANKING.md §2 / §6.1 · design-language §3.1 / §6 · `~/Downloads/zz_FF-1_recon_2026-09-21T2143.md`
