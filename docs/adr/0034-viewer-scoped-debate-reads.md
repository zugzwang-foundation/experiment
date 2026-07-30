# ADR-0034 — Viewer-Scoped Debate Reads Live Outside the Export-Bound View Model

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-07-30 |
| **Deciders** | Hrishikesh (founder) |
| **Tracker task** | `BOOKMARK-ADD-WIRE` (B1) — spec-lane precursor (the B1 execute gate) |
| **Frame document** | ADR-0025 §2 (the export's binding to `loadDebateView`'s DTO) · ADR-0032 D-8 (bookmarks excluded entirely from the public dataset) · SPEC.2 §4.1 `:381` (participant session optional on public read pages) · `docs/plans/UI-A6.md` §11 `:251` (the forward note this ADR overrides) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

`loadDebateView` is the read model behind `/m/[slug]`. It takes a market and returns a `DebateViewModel`; it takes no session and knows nothing about who is looking. That property is not incidental — it is what makes content-removal masking **structurally** viewer-independent rather than merely tested to be. Every viewer of a moderated debate page receives an object built from the same inputs, so "two people saw different versions of a moderated page" is not a class of bug that can exist.

Two facts turn that local property into a project-level constraint:

- **ADR-0025 binds the public debate `.md` export to this exact type.** The export *"reuses `loadDebateView(db, { market })` → `DebateViewModel` and serializes only the masked `DebatePost` / `DebateReply` variants — never the unmasked `DebateComment` intermediate (the sole `user_id` exposure path)"* (`docs/specs/debate-export.md:21`), on the stated discipline of *"Reuse over reimplement. A single source of masking, ranking, markers, and pseudonymity — no parallel logic to drift"* (`docs/adr/0025-debate-md-export.md:59-60`, `:86-87`). **`DebateViewModel` is therefore not a private detail of one page. It is the input type of a published artifact.**
- **ADR-0032 D-8 excludes `bookmarks` entirely from the 2026-11-06 public dataset**, on the reasoning that bookmarks are private reading behaviour tied to identity rather than the market signal the dataset exists to publish (SPEC.2 §19.3).

`docs/plans/UI-A6.md` §11 `:251` — a ratified forward note, not a spec — pre-registered the opposite: that `BOOKMARK-ADD-WIRE` would make `loadDebateView` return the viewer's bookmarked-comment set, keyed `comment_id IN (rendered)`. Under that placement, per-viewer private state enters the type that feeds a public export. The export would not serialize it today, but the type would permit it, and the cheapness of ADR-0025's masking guarantee depends precisely on the export never needing a special case.

**The decision is needed now, and needed as an ADR rather than a plan note, because the property currently has no durable encoding.** The B1 spec gate established that **no SPEC.1, SPEC.2 or ADR clause binds where a viewer-scoped debate read lives**; `loadViewerMarketContext` returns zero hits across `docs/specs/` and `docs/adr/`; and the only text asserting `loadDebateView`'s viewer-independence is **SG-3**, defined at `docs/plans/UI-A2.md:64` under a landed task's *"Binding scope guards (plan law)"* and echoed into five `src/` comments. Its `SG-N` numbering is plan-local and overloaded — `docs/plans/UI-A3.md:66` defines a different SG-3 entirely. A constraint that lives in a completed task's scope list, under a number that means two things, is not findable by the next person who needs it. **B1 is the first task to test that encoding, and it failed the test:** the ratified plan for B1's own predecessor instructed the opposite of what the codebase asserts.

This ADR does **not** decide:

- **The masking mechanism itself** — pre-commit gating (ADR-0014), reactive removal and `content_removed` decoupling (ADR-0021). Masking behaviour is *consumed* here, never extended.
- **The export's content or format** (ADR-0025). This ADR protects the export's input type; it changes nothing the export does.
- **Bookmark storage, write path, or list-read semantics** (ADR-0032). Bookmarks are the occasion for this rule, not its subject.
- **The dataset posture for any table** (ADR-0032 D-8, SPEC.2 §19.3).
- **Pseudonym / H2-scrub behaviour** (ADR-0011; SPEC.1 §23) — inherited.
- **B1's build** — slices, prop threading, component structure and test plan live in `docs/plans/BOOKMARK-ADD-WIRE.md`.
- **Rate limiting, ban gating, or freeze gating of the bookmark actions** — raised at B1 as open questions, dispositioned there, out of scope here.

## Decision Drivers

1. **The export-bound type must stay narrow (ADR-0025).** `DebateViewModel` feeds a published artifact under a *reimplement-nothing* discipline. Any field added to it is a field the export must either publish or specially exclude; the second option erodes the guarantee that makes the first unnecessary.
2. **Moderation is safety-critical, and structural beats tested.** A masking gate that *cannot* know the viewer is a stronger guarantee than one that knows and is verified not to care. Trading a structural property for a tested one is a bad trade at any price on a safety-critical path.
3. **Private state must not leak toward the dataset by type.** ADR-0032 D-8 excluded `bookmarks` deliberately; routing that data through the export's input type runs at the decision that excluded it.
4. **A purpose-built home already exists.** `loadViewerMarketContext` (`src/server/debate-view/viewer-context.ts:83`) is documented as existing *beside* `loadDebateView` for exactly this class of data, and is already invoked at `src/app/(public)/m/[slug]/page.tsx:46-52` on `{ userId, marketId }` — the precise keys required.
5. **Spec text already sanctions the shape.** SPEC.2 §4.1 `:381` classifies public read pages as *"None (participant session optional for write affordances)"* — session at the **page**, serving **write affordances**. That is composition at the RSC, not a session parameter inside the masking loader.
6. **The current encoding is the weakest tier available and demonstrably unfindable.** Plan-law from a landed task, under an overloaded number, propagated by comment copying. The remedy is promotion to a citable tier, not a better comment.
7. **Cost favours the chosen option.** Market-scoped keying needs no rendered-ID list, so the two loaders stop depending on each other's output; the driving predicate is served by an existing index; and the query joins an already-open read-only transaction rather than opening a new one.

## Considered Options

1. **Viewer-scoped debate reads live in `loadViewerMarketContext`, market-scoped and ID-only; `DebateViewModel` never carries viewer state** ← chosen
2. Extend `loadDebateView` with an optional session parameter and a bookmarked set, per `UI-A6.md` §11 as written
3. A third, separate loader dedicated to bookmarks
4. Client-side fetch after hydration
5. No ADR — record the reasoning in the B1 plan only

## Decision Outcome

**Chosen: Option 1 — viewer-scoped debate reads live outside the export-bound view model.**

### D-1 · The rule (the durable, generalisable part)

**No viewer-scoped state may enter `DebateViewModel` or any type it transitively contains** — not bookmark state, not ownership flags, not per-viewer permissions, not read receipts, not any future per-viewer affordance. `loadDebateView` keeps its signature `(client, { market })`, takes no session parameter, and remains viewer-independent by construction.

This is the load-bearing clause. It generalises past bookmarks and is the clause future tasks cite.

### D-2 · The home

Viewer-scoped reads on the debate surface live in **`src/server/debate-view/viewer-context.ts`**, in `loadViewerMarketContext`, composed at the page RSC *beside* `loadDebateView` — never inside it. The module's own docstring already states this role (`:15-18`); this ADR ratifies it as a rule rather than a local convention.

### D-3 · Keying — market-scoped, never rendered-ID-scoped

Viewer-scoped debate queries key on `(viewer, market)`, not on the set of ids a render happened to produce:

```sql
SELECT b.comment_id FROM bookmarks b
  JOIN comments c ON c.id = b.comment_id
 WHERE b.user_id = $viewer AND c.market_id = $market
```

Rendered-ID keying would reintroduce the coupling this ADR removes — the viewer read would depend on the masking loader's output and could not be composed independently. Market-scoped keying also bounds cost by the viewer's own row count rather than the market's, and the driving predicate is served by the leading column of `bookmarks_user_id_comment_id_uq` with the join resolving on `comments_pkey`.

**Corollary:** the returned set is deliberately **not congruent** with what was rendered. It may contain ids of comments that are removed, or not rendered at all. Consumers must not assume congruence.

### D-4 · ID-only, and never a masking input

Viewer-scoped debate reads return **identifiers only**. They read no `body`, no author column, no `side_at_post_time`, no image reference. They are **never** consulted as an input to a masking decision; masking stays keyed solely on `loadRemovedSet` inside `loadDebateView`.

This is what makes the rule cheap to audit: an ID-only set carries no content, so it cannot leak content, and a reviewer can confirm the property by reading the `select` clause.

### D-5 · Relationship to SG-3

This ADR **supersedes SG-3 as the encoding** of `loadDebateView`'s viewer-independence and **preserves the property it named**. `docs/plans/UI-A2.md:64` remains the historical record of a landed task's scope guard; it is no longer the place the constraint lives. The existing `src/` docstrings asserting viewer-independence are correct and stay, and should cite ADR-0034 when next touched. No plan-local `SG-N` label is load-bearing for this property from this ADR forward.

### D-6 · What this overrides

`docs/plans/UI-A6.md:251` — the forward note instructing that `loadDebateView` return the viewer's bookmarked-comment set — **is overridden.** The surrounding §11 text stands: the follow-on task's name, its both-surfaces intent, and its status as a hard pre-`TESTING.0` gate (`:254`) are unaffected. Only the placement clause is superseded. `UI-A6.md:242`, which lists `loadDebateView` among files A6 must not touch, is consistent with this ADR and was never in tension with `:251` — the two lines scope different tasks.

### D-7 · Scope boundary

The rule governs **the debate surface's read models**. It does not constrain the Profile read model (`src/server/profile/*`), the bookmarks list read (`src/server/bookmarks/list.ts`, which is inherently viewer-keyed and feeds no export), or any admin read. Those surfaces are outside `DebateViewModel` and outside ADR-0025's export binding. A future ADR may generalise further; this one does not.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| The viewer-independent debate read model | `src/server/debate-view/load-debate-view.ts` |
| Viewer-scoped debate reads (all of them) | `src/server/debate-view/viewer-context.ts` |
| Composition of the two at the page | `src/app/(public)/m/[slug]/page.tsx` |
| The export that consumes the debate DTO | `src/server/debate-export/serialize.ts` (ADR-0025) |

### Minted obligation — SPEC.2 amendments land at B1 execute (same-commit)

This ADR is doc-class and touches **no** SPEC.2 now, per the ADR-0032 precedent (registry rows ride the commit that materialises the thing they describe). The following ride the `BOOKMARK-ADD-WIRE` **execute** commit; B1's STEP 0 re-verifies each locus's then-current text and counts on the live tree:

- **§22 ADR Index** — the ADR-0034 row, plus count reconciliation (ADR total, accepted total, the `0003–00NN` upper bound, and the §22 heading / §22.5 SSOT counts). *(Noted, not chased: ADR-0033 is folded into neither SPEC.1 nor SPEC.2 at the time of writing. B1 reconciles for 0034 only.)*
- **§4.2 `:412`** — the `addBookmarkAction` invocation-surface cell, which currently reads *"No A6 surface"* and becomes false the moment the wiring lands. The broken `(§11)` cite in the same cell — which resolves inside SPEC.2 to §11 *Rate-Limit & Idempotency Contract* rather than to `docs/plans/UI-A6.md` §11 — is corrected in the same edit.
- **Appendix A** — a row for `src/server/debate-view/viewer-context.ts`, which has none today.
- **§0** — version bump, change-log row, and banner reconciliation.

**SPEC.1 back-pressure: none.** No SPEC.1 section carries debate read-model composition, and §23 delegates bookmark behaviour to ADR-0032.

## Consequences

### Positive

- **The export's guarantee stays cheap.** ADR-0025's *reimplement-nothing* discipline holds without a viewer-state exclusion rule, because there is no viewer state to exclude.
- **The property becomes findable.** A constraint that was plan-law under an overloaded number is now a numbered, indexed, citable ADR — the direct remedy for the failure mode that produced the conflicting instruction in `UI-A6.md` §11.
- **Audit surface shrinks.** Reviewing "is this query safe" becomes reading a `select` clause for identifiers, rather than reasoning about a new field's interaction with a masking gate.
- **The two loaders decouple.** Market-scoped keying removes the viewer read's dependency on the masking loader's output, so they can be composed — or parallelised — independently.
- **Future per-viewer affordances have a settled home.** Read receipts, per-viewer flags, personalised ordering: the next such request has an answer instead of a re-derivation.
- **Zero invariant surface.** No INV is touched; no write path, event type, or ledger row is added.

### Negative

- **Two loaders instead of one, and a reader must know which is which.** *Mitigated by:* the D-2 file map, both modules' docstrings, and the page composing them adjacently at `:38` and `:46-52`.
- **The returned set is not congruent with the render, which is unintuitive.** A consumer may wrongly assume every returned id is on screen. *Mitigated by:* D-3's explicit corollary, and by the set being consumed only as an icon-state lookup.
- **`loadViewerMarketContext`'s statement count grows** (3–4 → 5–6 for the bookmark case). *Acceptable because:* the statements are SELECTs inside an already-open read-only transaction, bounded by one viewer's rows in one market, and no new round-trip is introduced.
- **This ADR overrides a ratified plan's forward note**, which is a governance cost regardless of correctness. *Mitigated by:* the override resting on higher-precedence sources (ADR-0025, ADR-0032 D-8) rather than on the weak encoding it replaces, and by being recorded in three places — here, in the B1 plan's D1, and in the §4.2 amendment.
- **Rule-fatigue risk.** A rule stated once and never enforced decays. *Mitigated by:* B1's `@security-auditor` scope, which requires stating that `load-debate-view.ts` has a zero-line diff and that no viewer state reaches `DebateViewModel`, as separately-answered points rather than a bare PASS.

### Neutral

- `loadViewerMarketContext` returns `null` for signed-out visitors, which is already the correct semantics for viewer-scoped state — anonymous viewers have no bookmark set (ADR-0032 D-6). No new null-handling is introduced.
- The transport shape is unaffected by this ADR but constrained by the environment: values crossing the RSC → client boundary must be serializable, so viewer-scoped sets are returned as arrays and converted client-side.

## Pros and Cons of the Options

### Option 1 — Viewer-scoped reads in `loadViewerMarketContext`, market-scoped, ID-only (chosen)

**Pros**

- `DebateViewModel` — and therefore the export's input type — is unchanged.
- Uses a module that already exists, is already invoked with the right keys, and already documents this role.
- Needs no rendered-ID list, so the loaders decouple.
- Consistent with SPEC.2 §4.1 `:381`'s treatment of session on public read pages.
- ID-only reads are trivially auditable.

**Cons**

- Two loaders to understand instead of one.
- Overrides a ratified plan note.

### Option 2 — Extend `loadDebateView` (`UI-A6.md` §11 as written)

**Pros**

- One loader; the rendered-ID list is already in hand there.
- Was already ratified, so no governance cost.

**Cons**

- Puts per-viewer private state into the input type of a public export (ADR-0025), against a table ADR-0032 D-8 excluded from the dataset entirely.
- Forces the export to either publish viewer state or carry a special case, against its own *reimplement-nothing* discipline.
- Converts a structural masking guarantee into a tested one on a safety-critical path.
- Requires threading a session parameter into a function that deliberately has none.

**Verdict:** Rejected. It trades a structural guarantee on a safety-critical path for a convenience the chosen option provides at lower cost.

### Option 3 — A third, dedicated loader

**Pros**

- Also keeps `DebateViewModel` clean.
- Maximum separation of concerns.

**Cons**

- A third round-trip and a third module for one array.
- `loadViewerMarketContext` already exists for precisely this class of data; adding a sibling fragments the concern the D-2 file map is trying to pin.

**Verdict:** Rejected. Correct on the invariant, worse on cost and cohesion.

### Option 4 — Client-side fetch after hydration

**Pros**

- Zero server-side change; nothing enters any DTO.

**Cons**

- A new API endpoint, a new auth surface and a new rate-limit surface, for data already available server-side.
- Icons flicker into their correct state after paint.
- Adds a client-side data-fetching pattern the codebase does not otherwise use.

**Verdict:** Rejected. Highest cost, worst experience, largest new attack surface.

### Option 5 — No ADR; reasoning stays in the B1 plan

**Pros**

- Fastest; zero governance overhead.

**Cons**

- Recreates the exact failure this ADR exists to fix — a constraint encoded in a plan, invisible to the next task, which is how `UI-A6.md` §11 came to instruct the opposite of what the code asserts.
- Leaves no citable reason, so the ADR-0025 → ADR-0032 chain must be re-derived by whoever asks next.

**Verdict:** Rejected. The weak encoding is the problem, not the wording.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| ADR-0025 §2 | export binds to `loadDebateView`'s DTO | **Consumes** — the export reuses `DebateViewModel` and reimplements nothing; this ADR protects that type from viewer-scoped fields so the guarantee needs no exclusion rule. |
| ADR-0032 D-8 | `bookmarks` excluded entirely from the dataset | **Consumes** — private reading behaviour must not reach the export-bound type by any route. |
| ADR-0021 / ADR-0014 | `content_removed` masking | **Consumes** — masking stays keyed solely on `loadRemovedSet`; D-4 forbids any viewer-scoped set being used as a masking input. |
| ADR-0023 | `(public)/` shell | **Consumes** — composition happens at the page RSC inside the participant shell. |
| SPEC.2 §4.1 `:381` | public read pages, session optional for write affordances | **Consumes** — sanctions session at the page for write affordances; this ADR pins that it stays there and does not descend into the masking loader. |
| SPEC.2 §4.2 `:394`, `:415`, `:417` | Server Actions catalogue governs writes only | **Shapes** — read-only loaders sit outside the catalogue by design, which is why no §4.2 clause governed this placement and why an ADR was required. |
| SPEC.1 INV-1 | mandatory commentary / bet↔comment atomicity | **Shapes (preserves)** — no bet, comment or position is created; nothing here is a market action. |
| SPEC.1 INV-2 | Dharma non-transferable | **Shapes (preserves)** — no `dharma_ledger` row. |
| SPEC.1 INV-3 | side frozen at post-time | **Shapes (preserves)** — the reads select identifiers only; `side_at_post_time` is never read or written. |
| SPEC.1 INV-4 | resolutions append-only | **Shapes (preserves)** — no `resolution_events` / `payout_events` contact. |
| `docs/plans/UI-A2.md:64` | SG-3 (plan-law) | **Supersedes as encoding** — the property is preserved and promoted; the plan-local label is no longer load-bearing (D-5). |
| `docs/plans/UI-A6.md:251` | the forward-note placement clause | **Overrides** — placement only; `:242`, `:248` and `:254` stand (D-6). |
| SPEC.2 §22 / §4.2 / Appendix A / §0 | ADR index · action catalogue · file map · versioning | **Mints (deferred)** — the enumerated rows land same-commit with the B1 execute commit, per the ADR-0026 / ADR-0032 precedent. |
| Tracker | `BOOKMARK-ADD-WIRE` (B1) → `POLISH.3` · `POLISH.5` · `POLISH.6` · `TESTING.0` | B1's execute depends on this ADR being `accepted`. |

## More Information

- **Ground:** `origin/main` @ `9d289b33fac1a731836ccbac935612e51e0b9a0b` (`9d289b3`, PR #271, UI.19 slice 2). ADR ceiling verified at mint: highest file `0033`; `0002` never used; `0012` has no file but is reserved by the SPEC.2 §22 index row (*in flight*); next free is **0034**.
- **Spec-gate record (B1 recon, read-only):** no SPEC.1 / SPEC.2 / ADR clause binds where a viewer-scoped bookmark read lives. `loadViewerMarketContext` and `viewer-context` return **zero** hits across `docs/specs/` and `docs/adr/`. `SG-3` returns zero hits in both. The five `loadDebateView` hits in specs and ADRs are all in the ADR-0025 export lineage and concern masking inheritance only.
- **Precedents:** ADR-0032 (web-authored build spec, committed doc-class, SPEC.2 registry rows deferred to the build commit) · ADR-0026 (same-commit-with-DDL registry amendments) · DROUND (a web-authored spec rider riding the governing commit).
- **Code at ground:** `src/server/debate-view/load-debate-view.ts:150-172` (the viewer-independence docstring) · `src/server/debate-view/viewer-context.ts:15-18`, `:32-49`, `:83-143` · `src/app/(public)/m/[slug]/page.tsx:38`, `:46-52`, `:79` · `src/server/debate-export/serialize.ts`.
- **Related plans:** `docs/plans/BOOKMARK-ADD-WIRE.md` (the build, D1) · `docs/plans/UI-A6.md:238-262` (§11, partially overridden) · `docs/plans/UI-A2.md:60-70` (SG-1…SG-7).

---

*ADR-0034 ratifies that viewer-scoped state never enters `DebateViewModel` — because ADR-0025 binds the public debate export to that type and ADR-0032 D-8 excludes private bookmark data from the dataset entirely — and pins `loadViewerMarketContext` as the home for viewer-scoped debate reads, market-scoped and identifier-only, never consulted as a masking input. The decision body and the constraints minted in D-1 … D-7 are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
