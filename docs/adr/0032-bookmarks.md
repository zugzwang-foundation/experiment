# ADR-0032 — Bookmarks (storage, toggle write, cross-author list read, bookmark-mode read semantics)

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-07-20 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | UI-lane Session A · A6 (Bookmarks) — spec-lane precursor (the A6 gate) |
| **Frame document** | SPEC.1 §23 Profile — *Forward (A6)* delegation sentence ("specified by A6's own ADR, not here"); design-canon §4 ruling 1 + §2 *Bookmark* (semantics); `docs/plans/UI-LANE.md` §2 row A6 (the slot). SPEC.2 §22 (ADR Index — row added at A6 execute, not here). |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

Bookmarks are the last core-surface capability in UI-lane Session A (UI-LANE §2, slot A6). No prescriptive spec covers them: SPEC.1 §23 defers them entirely to this ADR (the *Forward (A6)* sentence — "This surface hosts a bookmark mode at A6 (design-canon ruling 1) — specified by A6's own ADR, not here"), and design-canon fixes only the **semantics** (ruling 1 / W2.7 / §2 *Bookmark*), not the build. Because §23 delegates here and no SPEC.1 section carries bookmark storage, write, or read behaviour, **this ADR must serve as the A6 build spec, not a thin storage-choice record.** It ratifies the storage model, the toggle write path, the cross-author list read, and the bookmark-mode read semantics — enough that A6's plan-then-execute chat opens with zero spec gaps.

The forces:

- **What a bookmark *is*.** Saving another participant's argument is **private convenience state** — the equivalent of a browser bookmark. It creates no bet, no comment, no position; it moves no CPMM price; it appends nothing to the event-sourced ledger; and un-bookmarking must genuinely *remove* the entry. This is categorically unlike the thesis substrate (stakes and arguments) the append-only architecture exists to preserve.
- **The read is cross-author, and that is the hard part.** Per design-canon ruling 1, a bookmarked card shows **the bookmarked author's** Staked/Current and marker — never the viewer's. The A5 Profile read model (`src/server/profile/*`) is single-user (`{ userId }`-scoped); the bookmark list is a **new** read that resolves each saved item's author and computes *that author's* Đa/Đb and marker via the same episode/positions/marker machinery.
- **Greenfield, verified.** Recon at `c13e3e6` (this ADR's ground): zero bookmark storage, endpoint, event type, or logic in `src/`, `drizzle/`, or `docs/adr/`. The only pre-existing artefact is the DEBATE.4 **disabled** bookmark icon in `src/components/debate/ArgProfile.tsx` — canon-§3.11 card furniture (`avatar · name | SIDE @ entry% | stake → current + right-edge bookmark/download cluster`), rendered `disabled` with no handler and no write path. A6 wires that already-present affordance; it does not build it from scratch. (This makes UI-LANE §1's "No Bookmarks anything" imprecise as of `c13e3e6` — non-blocking; corrected in the tracker's next re-ground.)

This ADR does **not** decide:

- The A6 **build itself** — the migration, the Server Action code, the read-model loader, and the surface wiring land at A6's gated plan-then-execute (ADR gate; migration = DDL ⇒ NEVER ultracode; `@db-migration-reviewer` in the cascade; Gate C on the execute PR).
- The **Profile surface** it reuses (ADR-0016 D6 route, ADR-0023 shell, SPEC.1 §23 read model) — consumed here, not re-decided.
- **Moderation / masking mechanics** (ADR-0014 pre-commit gate; ADR-0021 reactive removal / content-removed decoupling) — bookmarks *inherit* `content_removed` masking; they do not extend it.
- **Pseudonym / scrub behaviour** (ADR-0011; SPEC.1 §23 H2 path) — a bookmarked author who is later H2-scrubbed renders under the placeholder per §23; inherited, not re-decided.
- **The §23 *Forward* sentence's precision** — making "A6's own ADR" read "ADR-0032" is a one-word precision edit owned by the docketed §23 micro-amendment (UI.A5 Gate C docket 1), carried here only as a forward sequencing flag; this ADR does not touch §23 text.

## Decision Drivers

1. **Architectural honesty (Bucket taxonomy, ADR-0005).** Private, mutable, deletable convenience state must live in **Bucket C** (mutable), where `positions`, `users`, and `market_media` already sit — not in the strictly-append-only Bucket A ledger reserved for thesis substrate.
2. **The invariant spine is not implicated, and must stay that way (SPEC.1 §5).** Bookmarking is comment-free but creates no stake and no position — it is **not** a "comment-free buy" (INV-1); it moves no Dharma (INV-2); it only *reads* the frozen side and marker, never writes them (INV-3); it touches no resolution/payout row (INV-4). The design must preserve all four by construction.
3. **Read fidelity to design-canon ruling 1.** The list read must render **the bookmarked author's** figures per item, viewer-independently — the core semantic, and the reason this is a read-model spec and not a storage footnote.
4. **Reversibility.** Un-bookmark must be a true removal, not an append of a "forget that" record. This rules out any encoding where the toggle-off case grows the log.
5. **Privacy posture for the public dataset (SPEC.1 G3 / SPEC.2 §19).** Bookmarks are private reading behaviour tied to identity, not a market-mechanism signal ("who said what under what stake"). The conservative posture is dataset exclusion.
6. **Same-commit-with-DDL doctrine (ADR-0026 precedent).** SPEC.2's table-registry bookkeeping describes tables that *exist*; those rows must land atomically with the migration that materialises the table, at A6 execute — not in this doc-only chat (which would also trip the parked SPEC.2 bundle's one-bump rule).

## Considered Options

1. **Dedicated `bookmarks` table, Bucket C (mutable); un-bookmark = row DELETE.** ← chosen
2. **Event-sourced projection** — resurrect the dormant `user_events` table (or mint new `events` types like `bookmark.added` / `bookmark.removed`) and fold state at read time.
3. **New append-only `bookmarks` table (Bucket A)** with a `removed_at` tombstone column for the un-bookmark case.

## Decision Outcome

**Chosen: Option 1 — a dedicated `bookmarks` table in Bucket C, with two Server Actions and a cross-author list read.** The full build spec follows.

### D-1 · Storage — the `bookmarks` table (Bucket C, mutable)

A new table in a new schema domain file `src/db/schema/bookmarks.ts` (domain-per-file per ADR-0008):

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK `default sql\`uuidv7()\`` | ADR-0016 convention |
| `user_id` | `uuid` NOT NULL → `users.id` (`onDelete: restrict`) | the viewer who saved it |
| `comment_id` | `uuid` NOT NULL → `comments.id` (`onDelete: restrict`) | the saved post/reply |
| `created_at` | `timestamptz` NOT NULL `defaultNow()` | drives list order (D-8) |

- **Constraint:** `UNIQUE (user_id, comment_id)` — a comment is bookmarked at most once per user; the storage backstop behind the idempotent write (D-5).
- **Index:** on `user_id` (`bookmarks_user_id_idx`) — the list read is a `WHERE user_id = $viewer` scan; the FK-on-referencing-side index convention (per `market_media`).
- **Bucket C (mutable) — NO append-only trigger and NO TRUNCATE guard** (following `market_media`; contrast Bucket A's `0003` row-level + `0021` statement-level guards). Un-bookmark is a legitimate `DELETE`; this is the whole point of Bucket C for this table.
- **`onDelete: restrict`** matches the house convention and is safe: neither referent is ever hard-deleted (`comments` is Bucket A append-only; a scrubbed `users` row *persists* under placeholder per §23). The referenced comment therefore always exists, and a bookmark of a later-removed comment renders the removed stub (D-6, inherited masking).

### D-2 · Write path — two idempotent Server Actions

Server Actions (not Route Handlers): no custom-HTTP-header contract is needed, so the SPEC.2 §4 default applies. Home: `src/server/bookmarks/`.

- **`addBookmarkAction(commentId)`** — auth-gated (anonymous → the standard auth error). Reads the target comment's author; **rejects if `session.user.id === comment.user_id`** (the others-only guard, D-3). On pass: `INSERT INTO bookmarks (user_id, comment_id) … ON CONFLICT (user_id, comment_id) DO NOTHING`. Idempotent: a double-tap is a no-op, not a duplicate or an error.
- **`removeBookmarkAction(commentId)`** — auth-gated. `DELETE FROM bookmarks WHERE user_id = $session AND comment_id = $target`. Idempotent: deleting an absent bookmark is a successful no-op.

The client always knows the current icon state (bookmarked / not), so it calls the correct action; a single `toggle` is deliberately **not** used (two rapid taps could both read "absent" and net to bookmarked). No invariant is at stake either way; unambiguity is the tie-breaker.

### D-3 · Others-only guard (self-bookmark prohibition)

Per design-canon ruling 1, **only someone else's** posts/replies are bookmarkable. Enforced at the **application layer** (no DB trigger — a cross-row author≠bookmarker comparison is not a simple CHECK, and a trigger is disproportionate for private non-ledger state):

1. **UI (primary):** the bookmark affordance is hidden/disabled on the viewer's own cards (canon).
2. **Write path (defense-in-depth):** `addBookmarkAction` rejects `viewer === author` before the insert.

### D-4 · Read model — the cross-author list read

The bookmark list read is the substance. It is **not** a Profile load: Profile is `{ userId }`-scoped and computes one user's whole record; the bookmark list spans many authors, one saved item each, and must show **each item's author's** figures.

**`loadBookmarks({ viewerId })`** (proposed name; A6's plan confirms) produces, in **bookmark-recency order** (D-8, `bookmarks.created_at` DESC):

For each bookmarked comment (author `A` = `comments.user_id`, market `M`, frozen side `S = side_at_post_time`):

- **Argument content** — title/teaser/body (or the removed stub), side chip, `createdAt`, post-vs-reply kind, and for replies the parent reference — sourced by the same content shape the A5 argument list uses (the `ProfileArgumentItem` union family).
- **The author's figures for that holding** — `A`'s **Đa** (episode-scoped staked basis, §23 / SPEC.1 §10.8) and **Đb** (current value: `computeSell` against the live pool for open holdings, or net Σ `payout_events` for settled — §10.8) on `(M, S)`, computed via the **same machinery** A5 exposes (`src/server/profile/episodes.ts` episode walk, `positions.ts` Đa/Đb derivation, `computeSell`) but keyed on **`A`'s** `userId`, not the viewer's.
- **The author's marker** — Flipped / Exited / none via `computeMarker` on **`A`'s** currently-held side for `M` (the §23 rule, author-scoped; identical call site semantics to `arguments.ts` `buildPostItem` / `buildReplyItem`, sourced from `A`'s held-side read, not the viewer's).

**Build-time efficiency note (for A6's plan, not decided here):** the A5 Profile loaders over-fetch for this shape (they compute *all* of one user's holdings to surface one). The bookmark loader should compute figures at **per-`(author, market, side)`** granularity, reusing the profile modules as *machinery* rather than calling `loadProfilePositions({ userId: author })` per item. A6's plan sizes the exact query/batch shape; this ADR fixes the *semantics* (whose figures, which order, viewer-independence), not the query plan.

**Proposed item DTO** (A6's plan confirms the exact field layout, mirroring §23's "CC confirms at build"): the A5 `ProfileArgumentItem` content variants, **extended per item** with the author's pseudonym (card-head name), the author's `staked` (Đa) and `current` (Đb) strings, and the author's `marker`. The removed-variant carries no title/teaser/body/marker/figures (masking; D-6).

### D-5 · Bookmark-mode read semantics (design-canon ruling 1 / §2 *Bookmark*)

The bookmark page **reuses the Profile surface in forced-visitor mode** (canon §2 *Bookmark*): the list is retitled **"Bookmarks,"** every card renders **without owner affordances** (there is never a Sell mount — every item is *someone else's* content, by the D-3 guard), and the **Staked/Current shown are the bookmarked author's** figures on their argument, never the viewer's (ruling 1). "Forced visitor" describes the *card render mode* (no owner deltas), not page visibility — the page is the viewer's own private saved set (D-7).

### D-6 · Route

**`/bookmarks`** inside the ADR-0023 `(public)/` shell, **auth-gated** (anonymous → sign-in; there is no anonymous bookmark set). It renders the **session user's** saved items — the viewer's private set, not a pseudonym-keyed public page. Each item renders in the forced-visitor card mode of D-5.

### D-7 · Inherited behaviours (stated so no future reader special-cases them)

- **Content removal (safety-critical, viewer-independent).** A bookmarked comment later carrying a `content_removed` mod-action renders the **removed stub** — identically for every viewer — via the existing removed-variant of the argument DTO. The bookmark **row persists** (the underlying comment persists, Bucket A). This is inherited §23 / ADR-0021 masking, not a new mechanism.
- **Author scrub (H2).** A bookmarked author later H2-scrubbed renders under the **placeholder pseudonym** with the scrubbed silhouette and full persisted history, per §23. The bookmark still resolves; the author's figures compute over the persisted rows. Inherited.
- **Frozen-at-resolution (INV-4).** A bookmarked argument on a resolved market shows the author's **frozen** figures (Đb via net Σ `payout_events`, §10.8) and frozen marker (§23) — read-time, no special path.

### D-8 · Dataset posture (public 2026-11-06 release)

The `bookmarks` table is **excluded entirely** from the dataset — it joins SPEC.2 §19.3's excluded-entirely set (`watermark_state`, `cron_alarms`, `bet_receipts` → four). Rationale: bookmarks are private reading behaviour tied to identity, not the "who said what under what stake" market signal the dataset exists to publish. (This is the conservative posture; it is a **product** call, ratified here, not a technical necessity — reversible to SHIP-with-PSEUDO by a future amendment if saved-argument data is later wanted as research signal.)

### Single-source-of-truth file map

| Concern | Source-of-truth file (created at A6 execute) |
|---|---|
| `bookmarks` table schema | `src/db/schema/bookmarks.ts` |
| Bookmark write path (both actions + others-only guard) | `src/server/bookmarks/` (e.g. `add.ts` / `remove.ts`; A6 plan names files) |
| Cross-author list read model | `src/server/bookmarks/list.ts` (proposed; A6 plan confirms) |
| `/bookmarks` route | `src/app/(public)/bookmarks/` |
| The migration | `drizzle/migrations/0024_bookmarks.sql` (proposed number; head is `0023` — CC verifies the next free number at execute) |

### Minted obligation — SPEC.2 amendments land at A6 execute (same-commit with the migration)

This ADR is doc-class and touches **no** SPEC.2 now (the registry describes a table that does not yet exist; touching SPEC.2 here would also trip the parked SPEC.2 bundle's one-bump rule). The following ride the A6 **execute** commit that ships the migration, per the ADR-0026 same-commit-with-DDL precedent. A6's plan STEP 0 re-verifies each locus's then-current count on the live tree (verify-don't-trust):

- **§5.1 Table Inventory** — new `bookmarks` row (Bucket C, new `bookmarks` domain, **carries `user_id`**); table total **22 → 23**; Bucket C **11 → 12**; protected set unchanged; domain count **10 → 11**.
- **§5.2** Bucket-C summary **11 → 12** (+ `bookmarks`).
- **§4.2 Server Actions catalogue** — two rows: `addBookmarkAction`, `removeBookmarkAction` (paths + F-BM mapping + invocation surfaces).
- **§19.3** — add `bookmarks` to the excluded-entirely set (trio → four); update the closing recap.
- **§22 ADR Index** — the ADR-0032 row (status accepted, 2026-07-20); ADR count **+1**; upper bound `0003–0031` → `0003–0032`; heading/§22.5 SSOT counts reconciled (A6 execute computes the exact totals against the then-current index).
- **Appendix A** — file-map rows: `src/db/schema/bookmarks.ts` + `src/server/bookmarks/*` + the `(public)/bookmarks/` route.
- **Appendix B** — new `bookmarks` treatment entry (excluded-entirely; cross-ref §19.3; no PII shipped because nothing ships).
- **§0** — version bump + change-log row + gates-downstream ADR-range cite.

**SPEC.1 back-pressure: none** (D-2 above — §23 already delegates here; a §24 would contradict the ratified delegation). The §23 *Forward* sentence's optional "A6's own ADR" → "ADR-0032" precision rides the docketed §23 micro-amendment, not A6.

### Acceptance behaviours (F-BM-1/2/3 — proposed paths; CC confirms at build)

- **F-BM-1 — Toggle write.** `addBookmarkAction` inserts once, is idempotent on repeat, rejects self-bookmark, rejects anonymous; `removeBookmarkAction` deletes, is idempotent on absent, rejects anonymous. *(`tests/server/bookmarks/write.test.ts::adds-once`, `::add-idempotent-on-conflict`, `::rejects-self-bookmark`, `::remove-idempotent`, `::rejects-anonymous`.)*
- **F-BM-2 — List read (cross-author, author's figures, recency order).** Each item shows **the author's** Đa/Đb and marker (not the viewer's); order is `bookmarks.created_at` DESC; viewer-independent per item. *(`tests/server/bookmarks/list.test.ts::renders-authors-figures-not-viewers`, `::recency-order`, `::marker-on-authors-held-side`.)*
- **F-BM-3 — Masking + mode.** A bookmarked removed comment renders the removed stub for the viewer (safety-critical); a scrubbed author renders under placeholder; the surface is forced-visitor (no Sell mount, ever). *(`tests/server/bookmarks/masking.test.ts::removed-stub`, `::scrubbed-author-placeholder`, `::no-sell-mount`.)*

## Consequences

### Positive

- **Correct categorisation.** Private convenience state lives in Bucket C, where deletion is legal and cheap; the append-only ledger stays reserved for thesis substrate.
- **Reversibility is native.** Un-bookmark is a `DELETE`; the toggle-off case does not grow the log — the failure mode of any event-sourced encoding.
- **Trivial write and read cost.** `INSERT … ON CONFLICT` / `DELETE WHERE`; the list read is a single indexed `user_id` scan feeding a per-item author-figure computation.
- **Zero invariant surface.** No `dharma_ledger` row, no `events` type, no `comments`/`bets` write — INV-1…INV-4 are untouched by construction; nothing new to guard.
- **Reuses A5 machinery.** The episode/positions/marker modules are consumed, not duplicated; the surface reuses the Profile card render in forced-visitor mode (canon §2).
- **Conservative privacy default.** Dataset exclusion keeps private reading behaviour out of the public release.

### Negative

- **A new read shape.** The cross-author, per-item author-figure computation has no exact A5 precedent; naive reuse of the `{userId}`-scoped Profile loaders would over-fetch. *Mitigated by:* the D-4 build-time note directing A6's plan to per-`(author, market, side)` granularity; the semantics (not the query plan) are fixed here so the plan has a firm target.
- **The others-only guard is app-layer, not DB-enforced.** A future non-UI write path must remember the `viewer ≠ author` reject. *Acceptable because:* a trigger is disproportionate for private non-ledger state; the guard is defense-in-depth behind a UI that already hides the affordance, and F-BM-1 test-locks the reject.
- **SPEC.2 registry bookkeeping is deferred, not done.** The table exists in the ADR before it exists in SPEC.2's inventory. *Mitigated by:* the explicitly minted A6-execute obligation (same-commit-with-DDL, ADR-0026 shape) with per-locus counts and a plan-STEP-0 re-verify.

### Neutral

- A6 introduces migration `0024` (head `0023` → `0024`) and gains one Bucket-C table; EVENT_TYPES stays **24** (no new event type — the point of Option 1).
- The DEBATE.4 disabled bookmark icon becomes wired at A6; UI-LANE §1's absence claim is superseded at the tracker's next re-ground.

## Pros and Cons of the Options

### Option 1 — dedicated Bucket-C table (chosen)

**Pros**
- Deletion is legal and cheap; reversibility is native.
- No append-only surface, no event type, no ledger row — zero invariant entanglement.
- Bucket C is the sanctioned home (`positions`, `users`, `market_media` precedent).
- Trivial write/read; a single indexed list scan.

**Cons**
- A new read shape (cross-author figures) with no exact A5 precedent — mitigated by the D-4 note.

### Option 2 — event-sourced projection (`user_events` or new `events` types)

**Pros**
- Superficially "consistent" with the event-sourced house style.

**Cons**
- Miscategorises private convenience state as thesis substrate.
- The toggle-off case must append a "removed" record — the log grows on un-bookmark, forever.
- Recon fact: `user_events` is **defined but has zero write path** — this would hand a dormant append-only table its first writer purely for bookmark churn, *or* flood the generic `events` log with `bookmark.added`/`removed` pairs for zero net state.
- Still needs a state table (or a fold-on-every-read) for the list — more surface, not less.
- Would drag `events`/`user_events` into the dataset-strip pipeline (SPEC.2 §19.4.1's STOP rule fires on any new event type), pushing private reading behaviour toward the public export path.

**Verdict:** Rejected. Event-sourcing is for thesis substrate; a bookmark is not one, and the encoding fails the reversibility driver.

### Option 3 — append-only `bookmarks` table (Bucket A) with `removed_at` tombstone

**Pros**
- Keeps the "all our tables are append-only" symmetry.

**Cons**
- The un-bookmark path is a soft-delete tombstone, not a removal — the same reversibility failure as Option 2, one layer down.
- Every list read must filter `removed_at IS NULL`; re-bookmarking needs a new row or a resurrect-transition (Bucket-B-style whitelist) — machinery for no benefit.
- Bucket A's guarantee (this row is permanent thesis evidence) is *false* for a bookmark; asserting it misleads every future reader.

**Verdict:** Rejected. Append-only semantics claim a permanence that bookmarks neither have nor need.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 §23 | Profile *Forward (A6)* delegation | **Consumes** — this ADR is the bookmark spec §23 delegates to; §23's read model + surface are reused, not re-decided. |
| design-canon §4 ruling 1 · §2 *Bookmark* · W2.7 | bookmark semantics | **Consumes** — others-only (D-3); the **author's** Staked/Current per item (D-4/D-5); Profile-surface-in-forced-visitor-mode (D-5). |
| ADR-0005 | Bucket taxonomy | **Consumes** — `bookmarks` is **Bucket C** (mutable, no append-only/TRUNCATE trigger); `DELETE` on un-bookmark is legal. |
| SPEC.1 INV-1 | mandatory commentary / bet↔comment atomicity | **Shapes (preserves)** — bookmarking is comment-free but creates **no** stake and **no** position: it is **not** a comment-free buy; selling remains the only comment-free *market* action, and bookmarking is not a market action at all (no price move, no ledger row). |
| SPEC.1 INV-2 | Dharma non-transferable | **Shapes (preserves)** — no `dharma_ledger` row; no Dharma moves. |
| SPEC.1 INV-3 | side frozen at comment-time | **Shapes (preserves)** — the read consumes the frozen `side_at_post_time` + marker; it never writes them. |
| SPEC.1 INV-4 | resolutions append-only | **Shapes (preserves)** — touches no `resolution_events`/`payout_events`; a bookmarked resolved-market argument reads frozen figures. |
| ADR-0021 / ADR-0014 | content-removed masking | **Consumes** — a bookmarked removed comment renders the removed stub, viewer-independent (D-7). |
| ADR-0016 | UUIDv7 PK + D6 URL rule | **Consumes** — `bookmarks.id default uuidv7()`; `/bookmarks` exposes no raw UUID (session-keyed, not id-routed). |
| ADR-0023 | `(public)/` shell | **Consumes** — `/bookmarks` mounts in the participant shell, auth-gated. |
| SPEC.2 §19.3 | dataset exclusion | **Mints** — `bookmarks` is excluded entirely from the 2026-11-06 dataset (recorded in SPEC.2 at A6 execute). |
| SPEC.2 §5.1/§5.2/§4.2/§22/App. A/App. B | table registry + action catalogue + ADR index | **Mints (deferred)** — the enumerated rows land same-commit with the A6 migration, per the ADR-0026 precedent. |
| Tracker | UI-lane A6 (Bookmarks) | A6's plan-then-execute depends on this ADR being `accepted`. |

## More Information

- **Ground:** `main` @ `c13e3e6` (PR #251, UI.A5 Profile). Recon confirmed greenfield (no bookmark storage/endpoint/event-type/logic) and ceilings (ADR 0031 → 0032 candidate; migration head 0023; EVENT_TYPES 24; SPEC.1/SPEC.2 1.0.18).
- **Precedents:** ADR-0026 (SPEC.2 registry rows deferred to the migration commit that materialises the table); SPEC.1 §22/§23 (append-don't-renumber; "CC confirms at build" acceptance paths); ADR-0005 (Bucket A/B/C classification); the A5 `src/server/profile/*` read model (the machinery this list read reuses cross-author).
- **Design records:** design-canon §2 *Bookmark* / §3.11 card anatomy / §4 ruling 1; `mockups/surface_profile_v1_0.html` (the Profile surface the bookmark mode reuses).

---

*ADR-0032 ratifies bookmarks as private Bucket-C state — a dedicated `bookmarks` table, two idempotent Server Actions with an app-layer others-only guard, and a cross-author list read that renders each bookmarked author's Staked/Current and marker in the Profile surface's forced-visitor mode. The decision body and the constraints minted in §Decision Outcome are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
