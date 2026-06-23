# DEBATE.9 — Drop the orphaned `friendly_fire_events` schema (migration 0018) + strip refs + delete F-COMMENT-6/7/8 + doc truth-up

**One atomic PR. Base: fetched `origin/main` @ `c70face` (verified 0 0 ahead/behind). Next migration head: idx 18 / `0018`.**

## Context

`friendly_fire_events` is the last pre-fold artifact on disk. ADR-0017 (P1) retired the standalone friendly-fire up/down vote — Support/Counter are now read-time aggregates over reply-bets. SPEC.2 already declares the table "removed entirely" (§0 status line 3; §5.5 line 624) — the spec is the target, the physical drop is the code catch-up. DEBATE.8 (PR #155) dropped its sibling `comments.stake_at_post_time` via migration 0017; this is the matching drop for the table. Recon (prior turn) confirmed **zero business-logic callers** in `src/` and `scripts/` — only schema decls + 6 test files + a few doc strings reference it.

**Exit criterion:** migration 0018 applied to STAGING; the 3 friendly-fire objects (table + trigger-function + enum) confirmed gone; the 12 remaining protected tables + the shared `enforce_bucket_a_no_delete()` still enforce; full `pnpm vitest run` green locally; staging page loads. CI-green alone is NOT done. All edits in ONE commit (same-commit doctrine).

---

## Item 1 — Migration `0018_drop_friendly_fire_events.sql` (generation proof + exact SQL)

### What `drizzle-kit generate` tracks vs. doesn't

`drizzle.config.ts:13` → `tablesFilter: ["!events"]`. Only `events` is excluded; `friendly_fire_events` **is** drizzle-tracked, and so is the `ff_direction` pgEnum (enums are not filtered by `tablesFilter`). The trigger **function** `enforce_friendly_fire_events_transitions()` was hand-written as raw SQL in `0003_append_only_triggers.sql:74` and is **NOT** drizzle-tracked.

Therefore, after the schema-decl removals (Item 2), `just db-generate drop_friendly_fire_events` will emit:
- **(a)** `DROP TABLE "friendly_fire_events";` — from removing the `friendlyFireEvents` pgTable object. ✓ (emitted)
- **(b)** `DROP TYPE "ff_direction";` — from removing the `ffDirectionEnum` pgEnum. ✓ (expected; **must be inspected** — see guarantee below)
- **(c)** `DROP FUNCTION enforce_friendly_fire_events_transitions();` — **NOT emitted** (function untracked) → **hand-add**.

### Approach: **generate + hand-edit** (NOT fully hand-written). Why:

1. **The snapshot must be regenerated.** `drizzle-kit generate` writes `meta/0018_snapshot.json` reflecting the post-drop schema and appends the idx-18 entry to `meta/_journal.json`. A fully hand-written migration would leave the snapshot stale (still containing `friendly_fire_events`/`ff_direction`), so the **next** `db-generate` would try to re-drop them or emit garbage. This is the decisive reason.
2. **Precedent:** DEBATE.8's `0017_drop_comments_stake_at_post_time.sql` was a clean generated drop (`ALTER TABLE "comments" DROP COLUMN "stake_at_post_time";`).
3. **Only the untracked DROP FUNCTION is hand-added** — a one-line append into the generated file, exactly analogous to how the repo hand-writes raw SQL drizzle can't express (events partitioning / pg_cron, AGENTS.md §6).

### Final reviewed body of `0018_drop_friendly_fire_events.sql`

```sql
DROP TABLE "friendly_fire_events";
--> statement-breakpoint
DROP FUNCTION enforce_friendly_fire_events_transitions();
--> statement-breakpoint
DROP TYPE "ff_direction";
```

- `DROP TABLE` and `DROP TYPE` come from generate (quoted identifiers, drizzle style). The `DROP FUNCTION` line + its `--> statement-breakpoint` is **hand-inserted between them** (unquoted, no `public.` qualifier, no args — matching `0003`'s style; trigger functions take no args).
- **Order matters:** `DROP TABLE` must precede both `DROP FUNCTION` (the table's `bucket_b_update_check` trigger at `0003:191` references the function — `DROP TABLE` removes that trigger first, so the function is then unreferenced and drops cleanly) and `DROP TYPE` (the table's `direction` column uses the type). If generate emits `DROP TYPE` *before* `DROP TABLE`, **reorder** so `DROP TABLE` is first. If generate omits `DROP TYPE` entirely (drizzle-kit edge case), **hand-add it last**.
- **No `CASCADE`** — recon confirmed nothing outside the table references it (no inbound FK, no view, no other-table trigger reads it, no `friendly_*` event_type). CASCADE is only needed when *other* objects depend on the target.

### What `DROP TABLE "friendly_fire_events";` auto-drops (confirmed, no CASCADE):
- **2 triggers** (both ON the table, `0003:191–192`): `bucket_b_update_check` → `enforce_friendly_fire_events_transitions()`; `bucket_b_no_delete` → `enforce_bucket_a_no_delete()`.
- **3 indexes** (`0001`, `comments.ts:103–109`): `friendly_fire_unique_idx`, `friendly_fire_ranking_idx`, `friendly_fire_voter_idx`.
- **2 outbound FK constraints** (`0001`): `→ users` (restrict), `→ comments` (restrict).

### MUST NOT drop — the shared function `enforce_bucket_a_no_delete()`
Defined `0003:30`; called by `bucket_b_no_delete` on friendly_fire_events (`0003:192`) **and** by 12 other protected tables' no-delete triggers (9 Bucket-A + 3 other Bucket-B). It is a standalone function the FF trigger merely *calls* — not owned by the table — so `DROP TABLE` does not touch it, and it must NOT appear in `0018`. Dropping it would break append-only DELETE-protection on all 12 survivors.

### Guarantee all three drops present + shared function untouched (pre-PR §5.10 self-audit grep on the final `0018`):
- `grep -c` → exactly **1** hit each for `DROP TABLE "friendly_fire_events"`, `DROP FUNCTION enforce_friendly_fire_events_transitions`, `DROP TYPE "ff_direction"`.
- `grep` → **0** hits for `enforce_bucket_a_no_delete`, `enforce_bucket_a_no_update`, and any other `DROP TABLE`/`DROP TYPE`/`DROP FUNCTION`.
- Plus the `@db-migration-reviewer` gate (Item 7).

---

## Item 2 — Schema decl removals (`src/db/schema/comments.ts` + `auth.ts`)

All line numbers verified against `c70face`.

**`src/db/schema/comments.ts`:**
| Lines | Action |
|---|---|
| `:20` | Delete `export const ffDirectionEnum = pgEnum("ff_direction", ["up", "down"]);` |
| `:77–111` | Delete the FF Bucket-B doc-comment block (`:77–84`) + the `friendlyFireEvents` pgTable object (`:85–111`). **Replace with a tombstone comment** (policy below). |
| `:130` | Delete `friendlyFireEvents: many(friendlyFireEvents),` from `commentsRelations`. |
| `:133–145` | Delete the entire `friendlyFireEventsRelations` block. |
| `:149–152` | Delete `insertFriendlyFireEventSchema` + `selectFriendlyFireEventSchema`. |
| `:5`, `:9` | **Import trim (orphan cleanup, §5.3 — NOT in the kickoff's enumerated list; see Surfaced Additions §A):** remove `pgEnum` (`:5`, only used by `ffDirectionEnum`) and `uniqueIndex` (`:9`, only used by `friendly_fire_unique_idx`). The `comments` table uses only `index(...)` + `sideEnum`. Leaving them unused fails `biome check` / `tsc` → `just verify`. Keep `AnyPgColumn`, `index`, `pgTable`, `text`, `timestamp`, `uuid`, `createInsertSchema`, `createSelectSchema` (all still used by `comments`). |

**Tombstone comment** (mirrors how DEBATE.8 tombstoned `stake_at_post_time` at `comments.ts:25–29`) — placed where the table decl was (`:77–111`):
```ts
// friendly_fire_events (+ the ff_direction enum) was dropped at DEBATE.9
// (migration 0018). ADR-0017's reply-as-bet model makes Support/Counter a
// read-time aggregate over reply-bets — there is no standalone friendly-fire
// up/down vote to store. SPEC.2 §5.5 records the removal; the comments↔bets
// circular pair is unaffected.
```

**`src/db/schema/auth.ts`:**
| Line | Action |
|---|---|
| `:14` | `import { comments, friendlyFireEvents } from "./comments";` → `import { comments } from "./comments";` (keep `comments` — used at `usersRelations:171`). |
| `:174` | Delete `friendlyFireEvents: many(friendlyFireEvents),` from `usersRelations`. |

**Leave untouched (correct-end-state):** `src/server/debate-view/ranking-substrate.ts:46` ("…is no friendly-fire vote, no stored Support/Counter tally") — affirms the post-removal model.

---

## Item 3 — The 6 test edits (verified line numbers @ `c70face`)

1. **`tests/db/triggers/friendly-fire-events-append-only.spec.ts` → DELETE FILE.** 224 lines, describe `"friendly_fire_events — append-only trigger (Bucket B)"`, all 11 `it()` titles are FF `frozen_at`/`cleared_at`/`direction`/no-delete transitions. Wholly FF-specific; once the table + trigger are gone it tests nothing. (Its `:22` `TRUNCATE friendly_fire_events, …` would also error post-drop.) → reduces `tests/db/triggers/` from **13 → 12** specs (consequent doc edit, Surfaced §B).

2. **`tests/server/bets/concurrency.test.ts` → strip FF, test SURVIVES.**
   - `:31` — remove `friendlyFireEvents,` from the `@/db/schema` import block.
   - `:147` — remove the `, friendly_fire_events` token from the `afterEach` `TRUNCATE … CASCADE` list. **(Required, not cosmetic — the TRUNCATE errors once the table is gone.)**
   - `:272–275` — trim the `friendly_fire_events`/"struck 5th table" clause from the `bets::canonical-lock-order` comment; keep the 4-table-spine description + the ADR-0017 P1 / SPEC.2 §9 4-table-order reference.
   - `:327–329` — delete the FF assertion: the comment `// The 4-table spine wrote; friendly_fire_events is NEVER touched.` + `const ffRows = await testDb.select().from(friendlyFireEvents);` + `expect(ffRows.length).toBe(0);`. (Meaningless once the table is gone; also won't compile — import removed.)
   - **MUST survive:** `:331–341` — the 4-table-spine sanity assertions (`positions` length 1 @ `:336`, `events` length 1 @ `:341`) and their `// Sanity: …` comment. The test still validates the spine wrote.

3. **`tests/server/markets/concurrency.test.ts` → `:100`** — remove the `, friendly_fire_events` token from the `afterEach` `TRUNCATE … CASCADE`. **(Required — errors post-drop.)** No assertion on the table; test valid.

4. **`tests/integration/rate-limit.integration.test.ts` → rename + comment rewrite (descriptive, CC-authored).** Pure mocked-middleware test (no DB); logic survives.
   - `:139` title `rate-limit::shared-budget-comments-and-friendly-fire` → e.g. `rate-limit::write-budget-and-burst-admit-independently`.
   - `:141–145` comment — drop the friendly-fire reference **and** the now-false "SPEC.2 §11 names comments + friendly-fire as the two write-budget consumers" sentence (SPEC.2 §11 lines 458/1139 already removed the standalone comment/vote budget under reply-as-bet — see Surfaced §C). Proposed replacement, describing only the mechanism the test verifies:
     ```ts
     // Two parallel checkRateLimit() calls on write-budget + write-burst; both
     // must allow for a write to admit. Asserts the substrate exposes BOTH
     // surfaces and they admit independently — no AND combinator in the
     // middleware; consumers compose the AND at their boundary.
     ```
   - Keep the `=== §7.3 row 1 ===` mapping at `:137`.

5. **`tests/scale/_harness/reconcile.ts` → `:267`** — strip the `friendly_fire_events` token from the docstring: `Tolerant of \`friendly_fire_events\` / \`image_uploads\` existing` → `Tolerant of \`image_uploads\` existing`. `gatherSnapshot()` queries only ledger/resolution/event rows — no behavior change.

6. **`tests/db/_fixtures/db.ts` → `:25–26`** — strip the `friendly_fire_events.frozen_at` token from the example: `(system_state.frozen_at, friendly_fire_events.frozen_at, etc.)` → `(system_state.frozen_at, etc.)`. Keep `system_state.frozen_at` as the surviving valid Bucket-B timestamp example. Two-client logic generic; no behavior change.

---

## Item 4 — Flow-doc deletions (MAINT.15 friendly-fire slice, per SPEC.2 §23.3 line 2346)

DELETE: `docs/specs/flows/F-COMMENT-6.md` (friendly-fire upvote), `F-COMMENT-7.md` (downvote), `F-COMMENT-8.md` (clear). All confirmed Status `skeleton` / `<placeholder>` body. Reduces on-disk F-* count **40 → 37** (feeds the §13.3 truth-up, Item 6).

---

## Item 5 — Descriptive doc edits (CC-authored from the repo)

**`AGENTS.md`:**
| Line | Edit |
|---|---|
| `:9` | **Surgical strip** of the "Specs-ahead-of-code (read once)." paragraph: remove the `friendly_fire_events` **and** `stake_at_post_time` clauses (NB: the stake half is *already* false on main — a #154 close-out miss, since 0017 dropped it). **KEEP** the `comments.bet_id` deliberately-nullable clause (correct-end-state). See Surfaced §D on the residual "Specs-ahead-of-code" header framing. |
| `:151` | `21 tables live across 11 files — e.g. \`bets.ts\` (bets + positions), \`comments.ts\` (comments + \`friendly_fire_events\`), \`events.ts\` (…)` → `20 tables …`, and drop the `comments.ts (…)` example entirely (post-drop `comments.ts` holds only `comments` — no longer a "several related tables" example); keep `bets.ts` + `events.ts`. **Park** the pre-existing 21-vs-22 (AGENTS↔SPEC.2 §5.1) and 11-vs-12-files base discrepancies — not friendly-fire-driven (flag as doc-sweep debt). |
| `:157` | **Whole bullet dies** — `\`friendly_fire_events\` … and \`comments.stake_at_post_time\` … are vestigial … removed in DEBATE.8/9.` Both halves stale post-.8/.9. Leaves the two correct-end-state bullets (`bets.comment_id` NOT NULL; `comments.bet_id` nullable). |
| `:162` | **Rewrite** the Bucket-B illustration off friendly_fire_events: post-drop Bucket B = `identity-pool`, `image-uploads`, `system-state`. Pick a surviving table for the `NULL→timestamp` transition illustration (e.g. `system_state.frozen_at`, or `image_uploads` terminal-state). Drop the FF two-transition sentence. |
| `:211` | **(Surfaced §B — consequent, not in kickoff list)** `triggers/ (13 append-only specs, one per protected table)` → `12 append-only specs, …` (one fewer after deleting the FF trigger spec; aligns AGENTS to SPEC.2's already-correct "twelve protected tables", §5 lines 533/753). |

**`src/server/config/limits.ts`:**
| Line | Edit |
|---|---|
| `:28` | Strip the friendly-fire token from the docstring: `(shared by comments / replies / image-comments / friendly-fire)` → `(shared by comments / replies / image-comments)`. Surgical; leaves real reply-bet-borne consumers. (Broader write-budget question is Surfaced §C — out of scope.) |

---

## Item 6 — Prescriptive doc edits — PLACEHOLDERS ONLY (web authors exact text)

- **SPEC.2 §13.3 (lines 1388–1390):** on-disk F-* count truth-up **40 → 37** once F-COMMENT-6/7/8 deleted (now disk == the "37" prose). Reconcile the prose/family-breakdown (`F-COMMENT-* (3 active + 2 struck …)`). NB the prose↔table 37↔36 gap is `F-MOD-3` (residual MAINT.15, NOT friendly-fire — leave).
- **SPEC.2 §23.3 (lines 2336, 2343, 2346):** clear the friendly_fire_events physical-drop carry-forward row (`:2343`); update the MAINT.15 row (`:2346`) to remove the completed "delete F-COMMENT-6/7/8.md" + "40 on disk" slice, leaving F-MOD-3 + F-DATASET-1 + the 37↔36 residual as the surviving MAINT.15 backlog.
- **CLAUDE.md:20 (the CC contract):** neutralize the "Specs-ahead-of-code … Do not reconcile the schema to the spec outside the DEBATE.8/9 task." pointer — its premise is gone once .9 lands the last artifact. **DO NOT touch** CLAUDE.md `:64` / `:206` (correct-end-state). Linked to AGENTS.md:9's header framing (Surfaced §D).

*(Doc-flow split per Part 2: SPEC.2 §13.3/§23.3 + CLAUDE.md:20 = web-authored, CC commits. AGENTS.md + limits.ts = CC-authored from repo, web reviews.)*

---

## Surfaced additions / flags (beyond the kickoff's enumerated set — for web ratification)

- **§A — Unused-import cleanup (in scope, must do):** dropping the FF table orphans `pgEnum` + `uniqueIndex` imports in `comments.ts` (`:5`, `:9`). Required or `just verify` fails. Not listed in the kickoff's Item 2; absorbing per §5.3 (orphans *this* change created).
- **§B — AGENTS.md:211 count (in scope, must do):** deleting the FF trigger spec makes "13 append-only specs" → 12. Consequent friendly-fire-driven edit; not in the kickoff's AGENTS list (which named :9/:151/:157/:162). Aligns to SPEC.2's already-correct "twelve protected tables."
- **§C — SPEC.2 §11 is ALREADY reconciled (no edit; flag the residual gap):** §11 (lines 458, 1139) already states there is *no standalone comment/vote rate-limit budget* under reply-as-bet. So (i) no §11 SPEC edit is needed, and (ii) the rate-limit-test comment + `limits.ts:28` still carry the *per-market write-cap substrate* — that broader write-budget specs-ahead gap is **NOT friendly-fire** and is **out of DEBATE.9 scope**. DEBATE.9 only strips the literal "friendly-fire" token from both. → note the residual to `claude-progress.md` for a separate task.
- **§D — "Specs-ahead-of-code" framing weakens (editorial judgment for web):** after stripping ff+stake, AGENTS.md:9's paragraph and the `:157` section header both describe only `comments.bet_id` nullability — a *permanent* design choice, not specs-ahead drift. The minimal surgical strip (per kickoff) leaves a faintly-stale "Specs-ahead-of-code (read once)" header. Linked to CLAUDE.md:20's neutralization. Recommend the minimal strip now; flag the header retitle for web (don't silently re-author the contract framing).
- **Immutable-by-design (no edit):** `0003`'s header comment ("13 protected tables") and the FK-chain comments in committed migrations stay stale-but-frozen — migrations are append-only historical record (§ AGENTS.md §6). Not edited.

---

## Item 7 — Ritual + Done

**Subagent gates (post-§5.10-self-audit, before `gh pr create`):**
- `@db-migration-reviewer` — **required.** Destructive migration on a Bucket-B table. Pass `@docs/plans/DEBATE.9.md`. Must certify: the 3 FF objects dropped; `enforce_bucket_a_no_delete()` survives untouched; `DROP TABLE` auto-drop coverage (2 triggers / 3 indexes / 2 FKs); append-only discipline on the other 12 tables not weakened; snapshot/journal regenerated correctly.
- `@code-reviewer` — **required.** Schema-decl removals + import trim + the 6 test edits (confirm the surviving `bets::canonical-lock-order` spine assertions stay intact) + the doc edits.
- `@security-auditor` — **NOT required.** No bet-path / auth / moderation / ledger-write edit. The one append-only-weakening concern (does removing a Bucket-B trigger weaken enforcement?) is covered by `@db-migration-reviewer`, since the shared enforcement function survives untouched. Reasoned down, not waved off.
- `@test-writer` — **NOT required.** Test work is removal/stripping, not authoring (no RED-first cycle).
- **Subagent-model caveat:** the 4 tracked subagents pin `claude-fable-5`. If the execute session runs on Opus, pass `model:"opus"` on the Agent call (a fable-pinned subagent spawned from an Opus session dies with 0 tool_uses). On a Fable session they run natively.

**Plan-mode:** this is the lightweight plan (destructive migration). No RED-first. Plan committed in-repo as `docs/plans/DEBATE.9.md` at the start of execution (§5.1), referenced by the reviewer prompts.

**"Done" (all required; CI-green alone is NOT done):**
1. `0018` applied to STAGING (`just db-migrate` against the staging pooler).
2. The 3 objects confirmed gone on staging: `friendly_fire_events` (table), `enforce_friendly_fire_events_transitions` (function), `ff_direction` (type) — and `enforce_bucket_a_no_delete` still present, 12 protected tables still reject UPDATE/DELETE.
3. Full `pnpm vitest run` green locally (whole-suite, not just the named gates — cross-suite floors).
4. `ZUGZWANG_ENV=preview just verify` green.
5. Staging page loads.
6. All edits in ONE commit (same-commit doctrine: migration + schema + tests + flow-doc deletions + docs).

---

## NOT doing (explicit out-of-scope)

- **No** `enforce_bucket_a_no_delete()` drop (shared — 12 tables).
- **No** F-MOD-3 / F-DATASET-1 mint-or-strike (residual MAINT.15, not friendly-fire).
- **No** SPEC.2 §11 edit (already reconciled) and **no** broader write-budget substrate rework (Surfaced §C — separate task).
- **No** reconciliation of the AGENTS↔SPEC.2 table-count base (21 vs 22 vs disk) or the 11-vs-12-files figure (parked doc-sweep debt).
- **No** edit to CLAUDE.md `:64`/`:206`, `ranking-substrate.ts:46` (all correct-end-state), or any committed migration (`0001`/`0003` stay frozen).
- **No** `castFriendlyFire`/`clearFriendlyFire` removal — they never existed in code (only named in the §23.3 carry-forward row, which is cleared as a doc edit).

---

## Verification recap (how to test end-to-end)

1. After schema removal: `just db-generate drop_friendly_fire_events` → inspect emitted `0018` → hand-add `DROP FUNCTION`, verify order/3-drops/no-shared-fn (§5.10 grep).
2. `ZUGZWANG_ENV=preview just verify` (typecheck → biome → build).
3. Local Postgres (`open -a Docker` + `supabase start`; pass the committed test-default `DATABASE_URL` inline to drizzle-kit): `just db-migrate` then `pnpm vitest run` (whole suite) — expect the deleted trigger spec gone, the 5 edited test files green, bet/market concurrency TRUNCATEs clean.
4. Staging: `just db-migrate` against the staging pooler; assert the 3 objects gone + the 12 survivors enforce; load a staging page.
5. Self-audit (§5.10) → `@db-migration-reviewer` → `@code-reviewer` → PR.
