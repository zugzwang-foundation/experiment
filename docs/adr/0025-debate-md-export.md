# ADR-0025 — Debate `.md` Export (serving model, masking inheritance, serialization format)

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-06-29 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | Debate `.md` export — spec lane (this ADR + companion serialization schema + `zugzwang.md` asset + SPEC.1 §21.3 amendment). The route + button **build** is a separate task. Tracker IDs to be regularized by the operator. |
| **Frame document** | SPEC.1 §21.3 (Download debate → `.md` — amended by this ADR); SPEC.2 §3.3 (read-pattern R-1), §4 (API Surface — the export route lands here at build time); `docs/specs/debate-export.md` (companion serialization schema); `public/zugzwang.md` (shipped context asset); SPEC.2 §22 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

SPEC.1 §21.3 specifies a per-debate "download as `.md`" button whose intended consumer is the operator's
off-platform daily-report workflow. As written it exports text **and images** bundled as a **ZIP** via a
small read-only route, frozen at download time, and explicitly frames the downstream report as out of
product scope.

The feature is being **reframed and broadened**. Rather than building an in-product chatbot, Zugzwang
exports everything an LLM would need as context, so that **any user** can download a debate as a single
Markdown file and paste it into the LLM of their choice (refreshable, re-download anytime). The export
**still** feeds the operator report — one file, two consumers. The `.md` carries a static, embedded
**context block** (a `claude.md`-style preamble + glossary + metrics explainer) that tells the receiving
LLM how to read a Zugzwang debate and to represent both sides faithfully while declaring no winner.

This decomposes the artifact into two payloads concatenated into one file: a **context payload** (what an
in-product chatbot's system prompt would carry) and a **serialized-debate payload** (the conversation
context — market question, posts, replies, resolution, statistics).

The decisions requiring a record: how the file is **served** (freshness vs cost), how it **inherits the
moderation masking** that protects removed content (safety), what it **contains** and how it is
**structured** for LLM comprehension, whether to carry an embedded **instruction block**, and how this is
**classified** against §21.3.

This ADR does **not** decide:

- The route's exact path, handler signature, or the three gap-fill read-model additions — owned by the
  **build task** (it lands in SPEC.2 §4 at build time).
- The pre-commit moderation gate, vendor, or verdict mapping (ADR-0014 / ADR-0021, unchanged — the export
  is a read path and opens no new moderation surface).
- Number-tuned values (the export hard-pins none; `zugzwang.md` describes the economy conceptually).
- The operator's off-platform NotebookLM/ElevenLabs report (out of product scope, operator-owned).

## Decision Drivers

1. **Moderation safety (guardrail).** The export is a read path. Content a moderator removed must never be
   emitted. The export must **inherit** render-time masking, never reimplement it.
2. **Freshness over staleness.** The file is a "photograph of now" (frozen at download). Avoid any window
   in which removed content could still be served.
3. **Thesis neutrality.** The embedded context must represent both sides faithfully and **declare no
   winner** — the market surfaces truth; the preamble must not pre-empt it. The preamble is a *hint*, not
   control (it ships in a user-editable file and may be ignored), so neutrality is also enforced
   structurally.
4. **Zero engine/ledger/`n` contact.** A read-only TYPE-2 surface (per SPEC.1 §21). No transaction, no bet
   constraint, no write.
5. **Reuse over reimplement.** A single source of masking, ranking, markers, and pseudonymity
   (`loadDebateView`) — no parallel logic to drift.
6. **Simplicity for a ~45-day experiment.** Lowest moving-part count that satisfies the above.

## Considered Options

- **Serving model:** on-demand per-request render *(chosen)* vs hourly batch pre-generation.
- **Caching:** no cache *(chosen)* vs short-TTL cache on the route.
- **File topology:** single combined file + the same context standalone at `/zugzwang.md` *(chosen)* vs two
  separate files (needs ZIP or two downloads) vs combined-only (no standalone reference).
- **Media:** text-only *(chosen)* vs text + images bundled as ZIP (the original §21.3).
- **Domain glossary:** none — rely on LLM world knowledge + operator resolution criteria *(chosen)* vs
  auto-generated per-debate domain definitions.
- **Classification:** new ADR + companion serialization schema + §21.3 pointer-amendment *(chosen)* vs a
  §21.3 amendment alone.

## Decision Outcome

**Chosen across the forks above.** The following are ratified:

1. **On-demand serving, no cache.** A read-only `GET` route renders the `.md` per request (SPEC.2 §3.3
   **Pattern R-1** — uncached, per-request fresh — the same pattern the debate view itself uses).
   Frozen-at-download is inherent (the read *is* "now"). No pre-generation, no batch infrastructure, no
   baked files. **No cache by default**, specifically because a cache is a window in which a just-removed
   comment would keep serving until expiry; any future cache MUST invalidate on moderation actions against
   the debate, not on TTL alone. A stable public per-debate URL is satisfied by this route directly.

2. **Masking inheritance (safety-critical).** The export consumes the **same masked read-model the debate
   view consumes** (`loadDebateView(db, { market })` → `DebateViewModel`), serializing **only** the masked
   `DebatePost` / `DebateReply` variants — **never** the unmasked `DebateComment` intermediate (the sole
   `user_id` exposure path). A moderator-removed node serializes as a placeholder carrying **only** its
   structural fields (id, frozen side, timestamp, removed-status); its body, author, stake, aggregate, and
   image are **not emitted**. Replies under a removed node **survive** and serialize normally. The removed
   node's underlying stake still counts toward market totals (removal hides voice, not balance — the ledger
   is untouched) but is **never shown on the node**. **Masking is never reimplemented in the export.** (The
   reactive-removal *writer* is not yet built, so today nothing is removable and the export is safe by
   construction; it inherits masking automatically the moment that writer lands.)

3. **Text-only, single file, no ZIP.** Images and profile pictures are **dropped** (the comment text is the
   load-bearing "voice"); pseudonyms serialize. The ZIP — which existed in §21.3 *only* to carry image
   files — is **dropped**; a plain `.md` suffices. (Conscious cost: an argument whose substance lives in an
   image is lost; accepted for the LLM-upload use case.)

4. **Two-file topology from one source.** The button yields **one combined `.md`** =
   `YAML front matter → zugzwang.md context block → serialized debate`. The **same** `zugzwang.md` content
   is **also** served standalone at `/zugzwang.md`. Both draw the context from a **single source**
   (`public/zugzwang.md`) so the two can never drift.

5. **Embedded context block (`zugzwang.md`).** A **static, version-pinned** file explaining the protocol: a
   neutral reading preamble, a **protocol glossary** (Zugzwang's recurring terms only), a "what the metrics
   mean" explainer for the five load-bearing signals (stake, price/CPMM, Support/Counter, Flipped/Exited,
   ranking order), and reading instructions. It instructs the receiving LLM to give both sides their
   strongest case and to **declare no winner**. It is a **hint, not control** (user-editable, ignorable);
   neutrality is therefore **also enforced structurally** — a factual `outcome` field, balanced
   presentation, and a neutrality clause baked into each metric's definition. **No platform-authored domain
   glossary**: domain terms (places, organizations, abbreviations) are user-written; the LLM is told to use
   its own knowledge and flag genuine ambiguity rather than guess. The economy is described **conceptually
   with no hard-pinned tunable numbers** (e.g. "a higher minimum stake for replies than posts," never a
   figure), so the asset stays correct across the number-tuning pass.

6. **Serialization format.** A single Markdown file:
   `YAML front matter → zugzwang.md context → summary + contents → market header → post/reply tree (ranking
   order) → footer recap`. Per-node attributes are encoded as **bold-label key-value bullets, not tables**.
   The **ranking-vs-chronology** distinction is signalled four ways (a front-matter `ordering` declaration,
   a `chronological_index_posts` list, a per-node `Rank` field distinct from `Time`, and the reading
   instructions). The **full field-by-field contract** lives in the companion schema
   `docs/specs/debate-export.md`; the Mumbai-Metro worked example in that doc is the **conformance
   reference**.

7. **Gap-fills the export adds (data exists in the DB; no migration).** Three fields the current read-model
   does not surface: **resolution final-state** (`resolution_outcome` + `resolved_at` + chain-tip
   `resolution_events.reason`; final state only — no correction history); **per-node entry price**
   (`price_at_bet`, the market YES-probability at execution); **participant count `n`**
   (`COUNT(DISTINCT user_id)`). **Per-node entry price only** is in scope (Option A) — a full price-over-time
   **trajectory is deferred**: it sits near the §3 in-product-analytics foreclosure line and the in-product
   price-history deferral, and is out of scope for v1 absent an explicit re-decision.

8. **Consumer broadened; downstream report stays out of scope.** §21.3's "intended consumer = operator
   report" broadens to **any user**. The operator's off-platform NotebookLM/ElevenLabs report **remains out
   of product scope** — it becomes one of two consumers, not the only one. (This is amendment 1; the §21.3
   "out of product scope" clause for the downstream report is **retained**, not deleted.)

9. **Classification.** This is **a new ADR + a companion serialization-schema doc + a §21.3
   pointer-amendment**, not a §21.3 amendment alone — the feature spans a serving model, a serialization
   contract, a new shipped asset, and a safety property, which is more than §21.3 should carry inline. §21.3
   is reduced to a short pointer to this ADR. The §21.3 edit lands in the **same SPEC.1 §21 amendment pass**
   as the in-flight §21.6 descope (one coherent §21 commit).

10. **Build is a separate, ritual-gated task.** The route + button + the three gap-fill reads are built as
    their own task with the **full plan→execute ritual + `@security-auditor`** (it inherits the masking
    safety property and the serialize-from-masked-layer rule). It is gated on the existing debate-view
    read-model (already built).

### Single-source-of-truth file map

| Concern | Source-of-truth |
|---|---|
| The `.md` serialization format + field-by-field contract + conformance example | `docs/specs/debate-export.md` (companion schema — this ADR mints the requirement; the schema owns the exact fields) |
| The shipped context content (preamble, glossary, metrics, reading instructions) | `public/zugzwang.md` (static, version-pinned) |
| The export route (built later) | a read-only `GET` Route Handler under `src/app/(public)/m/[slug]/…` returning `text/markdown` — **owned by the build task**; lands in SPEC.2 §4 |
| The masked read-model the export reuses (incl. the three gap-fill field additions) | `src/server/debate-view/load-debate-view.ts` — existing; gap-fill additions **owned by the build task** |

## Consequences

**Positive.** No new engine/ledger/`n` surface. Masking is single-sourced — no drift, and safe by
construction today. On-demand rendering is always fresh and needs zero new infrastructure. One file means
zero upload friction and honors the no-ZIP amendment. Neutrality is enforced in the document *structure*,
not just in instruction text an LLM might ignore. The static context is one source, served two ways with no
drift.

**Negative / trade-offs.** Image-borne arguments are lost (text-only). Per-node entry price gives only a
sampled view of the price path; a full trajectory is deferred. The embedded preamble is a hint the LLM may
ignore (mitigated structurally). The three gap-fills require small, migration-free read-model additions at
build time.

**Follow-ups.** The build task (route + button + gap-fill reads, full ritual + `@security-auditor`); the
one-line "holding / flipped / exited" marker gloss folded into `zugzwang.md` at finalization; the SPEC.1
§21 amendment pass (this §21.3 amendment + the §21.6 descope); the SPEC.2 §22 ADR-Index row for
ADR-0025.
