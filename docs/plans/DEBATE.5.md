# DEBATE.5 — Three-state Flipped / Exited marker (read-loader)

> **Status:** reviewed
> **Date:** 2026-06-22
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** yes — reads ledger-derived `positions`, feeds a public render (CLAUDE.md §1). Full plan→execute ritual + `@test-writer` RED → `@code-reviewer` → scoped read-only `@security-auditor` → §5.10 audit.
> **Plan PR / commit:** chore/debate-5-plan (reviewed; web-CP gate rulings Q1–Q4 applied 2026-06-22 — see Open Questions).

---

## Tracker context

**Verbatim:** *"Computed live on read (F-DEBATE-2) from positions (ENGINE.11). Frozen side badge never changes; marker freezes at resolution."*

**Tracker title drift (build to spec, not title):** the tracker title says *"In/Flipped/Exited"*. SPEC.1 §9 post-SYNC.7 **dropped the "In" badge** — the enum is `{Flipped, Exited, none}`, where same-side renders **no marker** (`none`, the default unnamed state). Confirmed: SPEC.1:435 (`Marker enum {Flipped, Exited, none}`), `src/server/positions/compute.ts:59`. Build `{Flipped, Exited, none}`.

**Dependency status at plan time (all verified on `main`):**
- **ENGINE.11** (`deb0c76` / PR #91) — **DONE.** `computeMarker` + `type Marker` exist and are unit-tested (`src/server/positions/compute.ts:59,70-78`; `tests/unit/positions/compute.test.ts:123`). The held-side reads exist (`src/server/positions/read.ts`). The single-side partial unique index `positions_one_held_side_idx` exists (`src/db/schema/bets.ts:103-105`, migration `0010`).
- **DEBATE.3** (`520c388` / PR #139) — **DONE.** `comments.side_at_post_time` captured at INSERT (`src/server/bets/place.ts:133`), immutable via whole-row Bucket-A `bucket_a_no_update` trigger (`drizzle/migrations/0003_append_only_triggers.sql:48`); I-SIDE-BIND-001 owns the column assertion.
- **DEBATE.2** (`#143`) — **DONE.** F-COMMENT-5 (no-position / exited re-entry); `tests/server/comments/no-position.test.ts:14` explicitly parks the Exited **marker render** for "DEBATE.5 (out of scope)" — i.e. this task.
- **Migration head = `0016`** (`0016_mod_actions_reason.sql`), **EVENT_TYPES = 23** — both unchanged by this task (zero-schema). *(Note: an earlier recon framing said "expect 0015"; the live head is 0016 — AGENTS.md §6 agrees. No drift to fix; DEBATE.5 adds no migration.)*

**This task is the remaining wiring**, not the marker primitive: a debate-view server **read-loader** that lists a market's comments and attaches each comment's `marker = computeMarker(comment.side_at_post_time, <that comment author's current held side>)`, plus the three spec-named acceptance tests. Nothing else.

## Approach (one paragraph)

Add a new `src/server/debate-view/` module with one read function, `listMarketComments(client, { marketId })`, that (1) reads the market's comments oldest-first, (2) issues **one** set-based read of all those authors' current held sides for the market, (3) computes each comment's marker by feeding the frozen `side_at_post_time` and the author's held-side-or-`null` into the **existing** `computeMarker`, and (4) returns a flat, oldest-first list of comment DTOs each carrying a `marker` enum — and **never** any author's raw held side or quantity. It writes nothing, adds no schema/event-type, and is viewer-independent (the marker is about the *author's* position, identical for every reader). Freeze-at-resolution is inherited by construction: `positions` has exactly one writer (`upsertPositionDelta`, called only from buy/sell, which require `market.state = Open`), and resolution never touches `positions` — so the recomputed marker is stable forever after a market leaves Open.

---

## 1. Thesis invariants touched

**This task WRITES NOTHING — it cannot violate a write invariant. It DEPENDS ON two.** The table is filled on that basis (a read task that relies on invariants, not one that enforces new ones).

| Invariant | Touched? | Relationship + how the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity (INV-1) | no | No writes; no bet/comment inserts. Reads comment rows that already exist atomically with their bets. | n/a |
| 2.2 Dharma non-transferable (INV-2) | no | No ledger writes; no transfer surface. | n/a |
| 2.3 Side frozen at comment-time (INV-3) | **no (DEPENDED ON)** | Loader **reads** `comments.side_at_post_time` as the immutable frozen badge and **never** moves it; the marker is a *separate live overlay* derived from the author's *current* held side. The badge and the marker are distinct fields in the DTO. | `tests/server/debate-view/marker.test.ts::same-side-renders-no-marker` + `::flipped-exited-from-current-position` |
| 2.4 Resolutions append-only (INV-4) | **no (DEPENDED ON)** | Freeze-at-resolution is emergent: `positions` is written only by `upsertPositionDelta` (buy/sell, Open-only); resolution writes `resolution_events`/`payout_events`, never `positions`. So the recomputed marker is frozen post-close. | `tests/server/debate-view/marker.test.ts::frozen-at-resolution` |

**Critical-path failure modes (CLAUDE.md §5.10) if the proving assertion is missing/wrong:**
- **INV-3 dependency.** If the loader sourced the rendered side from the author's *current* held side instead of the frozen `side_at_post_time`, a flipped author's historical comment would display the *new* side — silently erasing the record that they argued the other side. The marker (`Flipped`) is exactly what preserves that record while the badge stays frozen. Without `same-side-renders-no-marker` + `flipped-exited-from-current-position`, a refactor that conflates "frozen badge" with "current side" ships undetected.
- **INV-4 dependency.** If any future code path wrote `positions` during/after resolution, every author's marker would drift *after* the market resolved — a resolved debate's authorship overlay mutating post-hoc. Without `frozen-at-resolution`, that silent post-close drift ships undetected. The test pins "resolve the market → markers unchanged (and resolution touched no `positions` row)."

---

## 2. Data model changes

**None — read-only feature.** Zero migrations, zero columns, no snapshot table, no stored marker, no event type. The marker is computed-on-read (ENGINE.11 R-4, "emergent"). Migration head stays `0016`; `EVENT_TYPES` stays 23.

**Paired doc rider (same commit, per same-commit doctrine):** a small **SPEC.2 amendment** under the debate-view read section codifying the new loader's read-contract (the `DebateComment` shape, oldest-first ordering, viewer-independence of the marker, and the moderation-filter seam) so the first debate-view read-loader is load-bearing, not undocumented. Exact wording is web-Claude's to supply/approve (relay) — see Open Questions Q4. No `src/db/schema` change.

## 3. API surface

**None — server-layer loader only.** DEBATE.5 ships an importable server function (`listMarketComments`), **not** an HTTP endpoint. The public read endpoint + polling (F-DEBATE-1 render / F-DEBATE-4 poll) are **DEBATE.4**. Signature (mirrors the `read.ts` `PositionReader` pattern for tx/top-level testability):

```ts
// src/server/debate-view/list-comments.ts
import "server-only";
import type { DbClient, DbTransaction } from "@/db";
import { type Marker } from "@/server/positions/compute";

export type DebateComment = {
  id: string;
  parentCommentId: string | null;   // depth-1 thread linkage (DEBATE.4 threads on this)
  userId: string;                    // author → identity resolution downstream (public)
  body: string;
  sideAtPostTime: "YES" | "NO";      // the FROZEN badge (INV-3) — distinct from `marker`
  imageUploadsId: string | null;     // F-COMMENT-3 attachment (see Q2)
  createdAt: Date;                   // timestamptz; HTTP serialization is DEBATE.4's layer
  marker: Marker;                    // "Flipped" | "Exited" | "none" — the live overlay
};

export async function listMarketComments(
  client: DbClient | DbTransaction,
  args: { marketId: string },
): Promise<DebateComment[]>;
```

**Excluded from the DTO (deliberate):** `betId` (vestigial, stays null in v1, dropped DEBATE.8/9), `stakeAtPostTime` (vestigial ADR-0009 input, dropped DEBATE.8/9). Ranking signals (author stake `a`, Support/Counter counts) are **derived by DEBATE.4**, not here.

**Auth:** none required — the marker is viewer-independent (it reflects the *author's* current position, identical for every reader; F-DEBATE-1 serves anonymous + authenticated). No session param.

## 4. UI / user flow

**None — backend-only task.** The two-column YES/NO render, Top ordering, two-slot replies, Support/Counter footers, and the `Flipped`/`Exited` badge *rendering* are **DEBATE.4** (F-DEBATE-1). DEBATE.5 produces the data the render consumes.

## 5. Failure modes

| Failure | Detection | Recovery |
|---|---|---|
| **Single-side index absent / two `quantity>0` rows for one author** (would make held-side ambiguous) | The set-based held-sides read builds a `Map<userId, side>`; >1 row for a userId throws `PositionSingleSideError` (mirrors `read.ts:36-40` defense-in-depth + the nightly D3 belt). | Structural: `positions_one_held_side_idx` prevents it (migration 0010); the throw is the tripwire. |
| **N+1 regression** (per-comment `getHeldPosition`) | Code review + the loader's explicit single-batch query; a future test could count queries. | Design forbids it — one comments read + one held-sides read. |
| **Held-side leak** (a future edit spreads the raw position row into the DTO) | The `DebateComment` type has no `heldSide`/`quantity` field → leak is a TypeScript error. `@security-auditor` checks the exposure boundary. | The held side lives only in a local `Map`, consumed by `computeMarker`, never returned. |
| **Read-after-write / poll staleness** (DEBATE.4 polls) | Expected by design (F-DEBATE-4 named tradeoff). | Next poll reflects new state; not DEBATE.5's concern. |
| **DB read failure mid-loader** | The two reads are independent SELECTs; a failure propagates as a thrown error to the (future) endpoint. | No partial state — read-only. The caller (DEBATE.4) handles the HTTP error. |

## 6. Edge cases

- **Market with zero comments** → empty author set → **skip** the held-sides query entirely; return `[]`. (Guards against an empty `inArray(...)` degenerating to `WHERE false` or a driver error.)
- **Author exited (sold to zero)** → no `quantity>0` row → `Map.get(author)` is `undefined` → `?? null` → `computeMarker(... null)` → `Exited`. Every comment author *had* a position at post-time (INV-1: no comment without a bet), so `null` unambiguously means "exited," never "never participated."
- **Author still holds same side (incl. F-BET-2 add-on)** → held = frozen → `none` (no badge). The frozen `sideAtPostTime` badge is still returned, unchanged.
- **Author flipped** → held = ¬frozen → `Flipped`.
- **Author exited *then re-entered the opposite side*** → current held = opposite → `Flipped` (the live overlay tracks the *current* position, per F-DEBATE-2). Their old same-side comment correctly reads `Flipped`.
- **Author holds positions in *other* markets** → the held-sides read is scoped to `market_id = args.marketId`, so cross-market positions are ignored.
- **Same `created_at` on two comments** (same instant) → deterministic tiebreak by `id` (uuidv7, time-ordered + unique): order key is `(created_at ASC, id ASC)`.
- **Market state Resolved/Voided/Frozen** → loader is **state-agnostic**: it returns the comment list + markers regardless of market state (a resolved market's debate view still renders). Freeze is emergent, not a state branch.

## 7. Test plan

**RED-first** (CLAUDE.md §5.6): `@test-writer` authors `tests/server/debate-view/marker.test.ts` with the three spec-named tests **failing** (the loader does not yet exist) before any `src/` code. Harness mirrors `tests/server/comments/no-position.test.ts` + `tests/server/resolution/happy-path.test.ts`: `testDb`/`testClient` from `tests/db/_fixtures/db`, local `seedUser`/`seedOpenMarketWithPool` helpers, TRUNCATE in `afterEach`. **Tests 1–2 direct-seed** `comments` + `positions` rows (fixture-bypass of the bet spine — the loader is a pure read; bet↔comment atomicity is owned by I-ATOMICITY-001). **Test 3 (`frozen-at-resolution`) uses the real bet+resolution spine** per Q1 (no fixture shortcut). `computeMarker`'s truth table is *already* unit-tested (`compute.test.ts`) — these tests target the **loader**, not the primitive. The no-N+1 claim is asserted via a `.select()`-counting proxy over the client (exactly 2 selects — one comments, one held-sides — regardless of author count); the exposure boundary is asserted by `Object.keys` carrying no `heldSide`/`quantity`.

| Layer | Scenario | Asserts |
|---|---|---|
| Server (Vitest + test Postgres, `tests/server/debate-view/marker.test.ts`) | **`flipped-exited-from-current-position`** — one market, three authors: A holds same side (`none`), B flipped (`Flipped`), C sold to zero (`Exited`). One loader call returns all three comments oldest-first, each marker correct; assert it issued a single set-based held-sides read (no N+1) and exposed **no** `heldSide`/`quantity`. | INV-3 read-not-moved; batch correctness; exposure boundary |
| Server | **`same-side-renders-no-marker`** — author still holds the comment's side (incl. an F-BET-2 same-side add-on) → `marker === "none"`; the frozen `sideAtPostTime` badge is returned unchanged. | INV-3 (frozen badge ≠ marker) |
| Server | **`frozen-at-resolution`** (Q1 RESOLVED — real path, **no fallback**) — build a consistent market via the real spine (`seedUser`/`seedOpenMarketWithPool`/`placeBet` per `happy-path.test.ts`); make an author **non-trivial** (real `sell` to zero → comment's frozen side preserved, current held `∅` → `Exited`); loader → `Exited`. Snapshot `positions`; drive the **real** resolution write-path `settleMarket(...)` (`@/server/resolution/settle`; `Resolving`→`Resolved`); re-snapshot → assert `positions` **byte-identical** pre/post AND the marker unchanged (`Exited`). If the real path genuinely cannot be invoked from the server-test harness → STOP + escalate (do not weaken). | INV-4 / freeze-by-construction |

No new unit test (the pure function is covered). No integration/E2E layer (no endpoint, no UI this task).

## 8. Out of scope (state explicitly; do not absorb)

- Rebuilding `computeMarker` / `Marker` (exists — import & consume).
- Touching `comments.side_at_post_time` or its Bucket-A trigger (INV-3 / DEBATE.3 own it — read only).
- **Any** debate-view UI / render of the badge (DEBATE.4 / F-DEBATE-1).
- The HTTP read endpoint + polling (DEBATE.4 / F-DEBATE-1, F-DEBATE-4).
- Comment **ranking / ordering-by-rank** (Top, modes, gravity) — DEBATE.8 / RANKING.md. This loader is **oldest-first only**, it does not rank.
- Support/Counter **aggregate counts** and author stake `a` (DEBATE.4 / §9).
- Moderation / Track-B removed-content filtering (DEBATE.7 / DEBATE.4) — see the seam below.
- Any migration / schema / event-type change (zero-schema).
- A shared canonical `Side` type (logged separate maintenance) — and do **not** cross the lowercase cpmm `Side` ("yes"/"no") casing.
- Reply threading / two-slot reply selection (DEBATE.4) — the loader returns a flat list; `parentCommentId` rides along for DEBATE.4 to thread.

**Moderation seam (note, do not build) — RENDER-TIME MASKING, not row-exclusion (web-CP correction; ADR-0020 / ADR-0021):** reactive removal is *soft* — a Removed comment keeps its row **and its thread node**; the public view renders a `removed by moderator` placeholder over the body while the thread stays intact (replies under a removed parent are other participants' stake-backed arguments and must survive). The forward treatment is therefore **render-time body-masking that preserves thread structure** — a per-comment removed-state field + a viewer/role read param, consumed by the DEBATE.4 render paired with the DEBATE.7 moderation schema — explicitly **NOT** a `WHERE … AND NOT EXISTS` row exclusion, which would orphan the replies. The marker itself stays viewer-independent. **Hard precondition (recorded):** this loader returns the **unfiltered** list and therefore MUST NOT back any public surface until removal-masking is attached — public consumption of the unfiltered list is a moderation read-bypass. (Track A / Track B content never reaches `comments` — blocked at the gate per ADR-0021; this seam concerns reactive removal only.)

---

## Settled design decisions (the kickoff's a–f)

- **(a) Return shape** — `DebateComment` (§3): `id, parentCommentId, userId, body, sideAtPostTime, imageUploadsId, createdAt, marker`. Non-vestigial comment fields + marker; excludes `betId`/`stakeAtPostTime`. `sideAtPostTime` (frozen badge) is kept distinct from `marker` (live overlay).
- **(b) Batch strategy** — **one** set-based held-sides read, no per-comment call:
  ```ts
  // after reading comments oldest-first and collecting distinct authorIds:
  const held = await client
    .select({ userId: positions.userId, side: positions.side })
    .from(positions)
    .where(and(
      eq(positions.marketId, args.marketId),
      inArray(positions.userId, authorIds),
      sql`${positions.quantity} > 0`,            // matches the partial-index predicate exactly
    ));
  // build Map<userId, "YES"|"NO">; throw PositionSingleSideError if any userId appears twice;
  // marker = computeMarker({ sideAtPostTime: c.sideAtPostTime, heldSide: map.get(c.userId) ?? null })
  ```
  Chosen over a `LEFT JOIN comments→positions` because the `Map` (i) keeps held-side data in a local variable the DTO type structurally cannot expose, (ii) degrades safely if the single-side index were ever absent (wrong marker for one user, **not** a duplicated comment row), and (iii) lets us mirror `read.ts`'s `≤1`-row defense. (Scale caveat in self-critique #3.)
- **(c) Exposure boundary** — sits at the loader's `.map()` from `(comment row, Map lookup)` → `DebateComment`: the held side is consumed by `computeMarker` and dropped; `marker` is the only position-derived field returned. Enforced structurally by the `DebateComment` type (no `heldSide`/`quantity` member).
- **(d) Module home** — new `src/server/debate-view/` with `list-comments.ts` (spec test path `tests/server/debate-view/marker.test.ts` implies the dir). `server-only`, named exports, no barrel.
- **(e) Moderation seam** — noted above; not built.
- **(f) Side typing** — the whole path is uppercase DB-enum space: `comments.side_at_post_time` → `"YES"|"NO"`, `positions.side` → `"YES"|"NO"`, `computeMarker` takes `"YES"|"NO"`. Use inline `"YES" | "NO"` literals (matching `computeMarker`'s signature); introduce **no** shared `Side` type; never touch the lowercase cpmm `Side`.

---

## Open questions — RESOLVED at the web-CP gate (2026-06-22)

- **Q1 — `frozen-at-resolution` transition depth. → RESOLVED.** Drive the **REAL** resolution write-path (`settleMarket`, `@/server/resolution/settle`), reusing `happy-path.test.ts` seeding for a consistent market+pool+positions state; seed a non-trivial `Flipped`/`Exited` author; assert `positions` rows byte-identical pre/post AND marker unchanged. **No fallback** to a direct status set — if the real path genuinely cannot be invoked from the server-test harness, STOP and escalate. *(Verified achievable: `settleMarket(...)` is directly callable from a server test, `happy-path.test.ts:200`.)*
- **Q2 — Include `imageUploadsId` in the DTO? → RESOLVED: yes** (already in §3) — the comment's own non-vestigial content (F-COMMENT-3); spares DEBATE.4 a second query.
- **Q3 — `createdAt` as `Date` vs ISO string? → RESOLVED: `Date`** (already in §3) — server-layer loader, not the HTTP boundary; DEBATE.4's endpoint serializes.
- **Q4 — SPEC.2 rider wording. → RESOLVED:** apply the web-supplied **verbatim** §5.4 insertion (new subsection after *Read-time reply affordance (ReplyAffordance)*, before *§5.5*) + the §0 version bump (1.0.8 → 1.0.9, date 2026-06-22) + the supplied changelog row, **same commit as the code**. CC integrates the supplied text; does not author it.
- **Naming → CONFIRMED as-is:** `listMarketComments` / `DebateComment` / `list-comments.ts`.

## ADRs needed

**None.** This implements F-DEBATE-2 / F-DEBATE-3 entirely within the ENGINE.11 **R-4** "emergent marker" decision already recorded in SPEC.1 §9 + the ENGINE.11 plan. No CLAUDE.md §10 default changes, no new vendor/dependency, no new cross-cutting pattern beyond a thin read-loader. The loader contract is codified via the §2 SPEC.2 rider (Q4), not an ADR.

---

## Self-critique (after Phase 1 self-review)

Critiqued without politeness — where it's wrong, where it breaks at runtime, what's imprecise. Findings kept after addressing (record for Phase 2).

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **high** | **`frozen-at-resolution` risks being a vacuous test.** If the test merely resolves the market and re-reads without ever threatening the position, it passes even if freeze were *not* by-construction — because nothing mutated `positions` regardless. The assertion must bite. | Addressed in §7: seed a **non-trivial** marker (`Flipped`/`Exited`) so the frozen value is not the `none` default, drive the **real** resolution write-path (which writes `resolution_events`/`payout_events`), and assert the author's `positions` rows are **byte-identical pre/post** — i.e. resolution provably touched no position — *and* the marker is unchanged. That directly validates F-DEBATE-3's "resolution's write path never touches positions" rather than asserting a tautology. (Q1 pins the depth.) |
| 2 | **medium** | **Exposure boundary is a convention, not a guarantee, unless typed.** "Held side never leaves the loader" is easy to regress (someone spreads the position row). | Addressed in §3/§5/(c): the `DebateComment` type has **no** `heldSide`/`quantity` member, so a leak is a compile error; held side lives only in a local `Map`. `@security-auditor` verifies. The two-query Map (not LEFT JOIN) was chosen partly so held-side data never enters the comment-row projection at all. |
| 3 | **medium** | **`inArray(userId, authorIds)` has a latent bind-param cliff.** Drizzle expands `inArray` to a bound list; a market with tens of thousands of distinct comment authors could approach Postgres's 65535-bind ceiling. | Accepted for experiment scale (one market, 15 Sep–5 Nov 2026; author count bounded far below the ceiling) — §5.2 simplicity. Mitigation if ever needed: swap to `user_id = ANY($1::uuid[])` (single array bind) or the `LEFT JOIN`. Logged as a low-risk carry-forward, **not** built now. |
| 4 | **medium** | **Direct-seeding `comments` without a bet violates "every comment rides a bet" at the fixture level.** A reviewer could read the test as condoning standalone comments. | Accepted + documented in §7: this is a deliberate **fixture-bypass** to isolate the *read* (the loader never inspects bets); `comments.bet_id` is nullable in v1 and storage does not enforce the linkage. INV-1 atomicity is owned/asserted by I-ATOMICITY-001 — not re-litigated here. The test comment will say so. |
| 5 | **low** | **Function/file/DTO names (`listMarketComments`, `list-comments.ts`, `DebateComment`) are my choice; DEBATE.4 will copy this shape.** A poor name propagates. | Names are reasonable and kebab/Pascal-correct (AGENTS.md §4); flagged for web-CP to rename cheaply now (before DEBATE.4 copies it). Not a blocker. |
| 6 | **low** | **`createdAt: Date` couples the DTO to Drizzle's return type slightly** (AGENTS.md: "don't expose Drizzle row types in API responses"). | This is the *server-layer* loader, not an API response; the HTTP DTO mapping is DEBATE.4's. Q3 records the `Date`-vs-ISO call; defensible to keep `Date` here. |
| 7 | **low** | **Plan-file location.** Plan mode permits editing only the harness plan file; the kickoff + CLAUDE.md §5.1 want `docs/plans/DEBATE.5.md`. | Materialized at `docs/plans/DEBATE.5.md` (working tree, uncommitted per the kickoff's "commit nothing until I review"); committed before Phase 1 ends per §5.1, after web-CP sign-off. No content change — same plan. |

**Second pass (after addressing 1–7):** no further high/medium findings. Checked: invariant-dependency honesty (§1 reflects a read task, not a false "enforces"); scope discipline (§8 fences ranking/render/moderation/schema); every named test maps to a §1 dependency; edge-case enumeration covers exit / re-enter-opposite / cross-market / empty-market / same-instant ordering; no N+1; held-side non-exposure is type-enforced.

---

## References

- `CLAUDE.md` §1 (critical paths), §2 (INV-3/INV-4), §5.6/§5.10/§5.11 (ritual) — the contract.
- `AGENTS.md` §6 (Drizzle reads, `inArray`, no `SELECT *`, DTO mapping), §9 (test layout) — stack patterns.
- `docs/specs/SPEC.1.md` §9 — F-DEBATE-2 (427-436), F-DEBATE-3 (438-442); §8 F-COMMENT-5 (396-402).
- `src/server/positions/compute.ts:59,70-78` — `Marker` + `computeMarker` (import & consume).
- `src/server/positions/read.ts:21-63` — held-side reads; `PositionSingleSideError` defense pattern.
- `src/db/schema/comments.ts` — comment columns + `comments_market_created_idx`; `src/db/schema/bets.ts:103-105` — `positions_one_held_side_idx`.
- `tests/server/comments/no-position.test.ts` — the test-harness analog (seed helpers, TRUNCATE, `heldSideOrNull` exit→null).
- `docs/logs/ENGINE.11.md` — R-4 (emergent marker, frozen-by-construction), single-writer proof (line 97).
- `src/server/resolution/settle.ts` (`settleMarket`) + `tests/server/resolution/happy-path.test.ts` — the real resolution write-path for the Q1 frozen-at-resolution test (incl. `positions-untouched` precedent).
- `docs/adr/0020-decoupled-content-removal.md`, `docs/adr/0021-reactive-moderation-no-held-queue.md` — the moderation-seam render-time-masking treatment (§8).
- Tracker entry: DEBATE.5.
