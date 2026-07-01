# Close-out — BC.1 (descriptive-doc reconciliation)

**Stratum:** BC.1 — pure descriptive-text reconciliation of `CLAUDE.md` + `AGENTS.md` to `main`, catching up the canon docs to the modules MEDIA.1 / DEBATE / EXPORT / ENGINE landed (`src/server/comments/`, `src/server/debate-view/`, `src/server/debate-export/`, `src/server/cpmm/`, the `market_media` table + migration `0019`). **No code / spec / migration touched.**
**Canonical SHA (squash-merge on `main`):** **PR #187 → `3979ccb`**. Branch `chore/bc1-descriptive-docs`.
**State:** merged; both files verified on `main`. Diff: **2 files, +7 / −8** (the −1 net = the removed empty "Greenfield (not built)" bullet).

## SHIPPED — 7 descriptive edits

**CLAUDE.md (3)**
1. **§1 critical paths** — removed the now-empty `- Greenfield (not built): src/server/comments/` bullet; folded `src/server/comments/` into the "Built, sensitive" list (built on disk: `foreclosure.ts` / `image-attach.ts` / `reply-validate.ts`). No greenfield critical path remains; the list collapsed 3 bullets → 2.
2. **§1 vocabulary (CPMM)** — dropped the stale trailing `(greenfield)` marker (`src/server/cpmm/` landed ENGINE.2–12, already in the Built-sensitive list).
3. **Footer** — appended the BC.1 reconciliation clause (see **D1**).

**AGENTS.md (4)**
4. **§3 greenfield sentence** — five-edit surgical repair: removed `src/server/comments/` from "NOT yet on disk" (built); removed `debate-view` from "still to come" (built **and wired** — `(public)/m/[slug]/page.tsx` → `loadDebateView` → `<DebateView>`); singular-agreement repair (**D3**); dropped the `DEBATE.4` token (**D2**). **Kept** `src/server/identity/` (genuinely absent) and "market-list … still to come" (no list page on disk); ENGINE-landed tail carried verbatim.
5. **§6 table line** — `20 tables live across 11 files` → `21 tables live across 10 files`; added `markets.ts` (markets + pools + market_media) as a third multi-table example (**D4**).
6. **§6 migration head** — `0018_drop_friendly_fire_events` → `0019_market_media`; enumeration gains `0019 = market_media (MEDIA.1)` (**D5**).
7. **Footer** — same BC.1 clause (**D1**).

## DECISIONS

- **D1 — Footer treatment.** Keep the SYNC.8 rebuild provenance verbatim (`Rebuilt at SYNC.8 (Jun 2, 2026)` / `27216fc` / the full `+ SPEC.1 v1.9.0-draft + SPEC.2 + ADRs 0003–0027` list). Append `; descriptive drift reconciled at BC.1 (Jul 1, 2026) against 248e02f.` **AFTER** that SPEC/ADR list — BC.1 reconciled against **disk**, not against the specs, so the SPEC/ADR provenance stays attached to the SYNC.8 stamp. SYNC.8's fold-list stays attributed to SYNC.8; nothing relabeled to BC.1. (This after-the-list placement superseded the manifest's earlier split-the-list draft.)
- **D2 — Drop `DEBATE.4` token.** `debate-view` was the DEBATE.4 surface and it landed, so DEBATE.4 no longer belongs in a "still to come" phase list → `(DEBATE.4 / DESIGN.* / UI.*)` → `(DESIGN.* / UI.*)`. Left `DESIGN.* / UI.*` as-is; did not re-derive market-list's full phase attribution.
- **D3 — Singular-agreement repair.** The `comments/` removal left `identity/` as the sole subject, forcing the minimal grammar fixes `These arrive` → `It arrives` and `surfaces … are` → `surface … is`. Did **not** re-attribute `identity/`'s phase words ("DEBATE / later phases" — unconfirmed, left as-is).
- **D4 — `markets.ts` third example.** Added `markets.ts` (markets + pools + market_media) alongside the existing `bets.ts` / `events.ts` examples — it is now the 3-table file that drove the +1.
- **D5 — `(MEDIA.1)` marker style.** `0019` enumerated with the `(MEDIA.1)` task-label marker, matching the DEBATE.8 / DEBATE.9 style (not the `0016` PR-cite style).

## DEVIATIONS

- **(a) Table/file count — carried the recon correction, not the first hypothesis.** The recon-confirm's initial hypothesis was `21 tables / 12 files`. Corrected during recon to **`21 / 10`**: `market_media` lives **inside** `markets.ts` (no new schema file), and the pre-MEDIA.1 `11 files` was **already off-by-one** (20 tables sat across the same 10 `pgTable`-bearing files). The ratified manifest + the shipped edit carried the corrected **`10`**, never the hypothesised `12`. (§3's separate "12 files" is a *different* measure — all `.ts` incl. `_enums` + `index` — see Accepted residuals.)
- **(b) PROCESS — merged before web diff review.** PR #187 was operator-squash-merged **before** the web diff review; web reviewed **post-hoc** and confirmed **CLEAN**. BC.1 is docs-only (markdown; Biome skips it, the required `ci` check is trivially green), so the exposure was minimal — but noting it explicitly so **BC.4** (a code task on the critical path) keeps **review-BEFORE-merge** strict; the docs-only exception does not generalize.

## ACCEPTED RESIDUALS

- **`AGENTS.md:76` "12 files" ≠ §6's "10 files" — divergent by design.** The §3 tree comment (`12 files: _enums, audit, auth, bets, comments, dharma, events, identity, image-uploads, index, markets, system`) counts **all** schema `.ts` files, including the `_enums` enum module and the `index` barrel — neither declares a table. §6's "10 files" counts only `pgTable`-bearing files. The two are intentionally different measures; **left divergent, not reconciled.**

## DEFERRED (NOT BC.1)

- **SPEC.1 version string → BC.2.** `CLAUDE.md:18` and both footers cite `SPEC.1 … v1.9.0-draft`; SPEC.1 §0 is actually at **`1.0.13`** (`docs/specs/SPEC.1.md:15`; promoted to `v1.0` at PRECURSOR.4 on 2026-06-03, since bumped to 1.0.13). BC.1's footers preserved `v1.9.0-draft` **verbatim** per the operator's ratified footer text; reconciling the version string is **deferred to BC.2** (not ruled here).
- **`CLAUDE.md:206` ADR-0026 decision-log staleness → left historical.** The entry reads slightly stale ("display + admin-upload + composer-pick are three ritual-gated build tasks … 0018→0019 at execute" — admin-upload + migration `0019` now landed at MEDIA.1). Left as a **point-in-time historical record** per standing convention (decision-log entries are not retroactively rewritten).

## PK-REFRESH (project-knowledge restage)

Canonical copies staged to `~/Desktop/zz-pk-refresh-BC.1/` for the web-Claude project-knowledge refresh; md5 is the transport-integrity check.

| File | md5 (`main` `3979ccb`) | Source path | What changed |
|---|---|---|---|
| CLAUDE.md | `e53a530e0cd067ce513e38176a945040` | `/CLAUDE.md` | §1 comments greenfield→Built-sensitive; CPMM `(greenfield)` dropped; footer BC.1 clause |
| AGENTS.md | `45c167ba7da47b2ed78112d3b527a7c0` | `/AGENTS.md` | §3 five-edit sentence; §6 `21/10` + `markets.ts` example; §6 head `0019`; footer BC.1 clause |
| docs/logs/BC.1-close-out.md | *self-referential — reported at staging (§4); byte-stable across the squash-merge* | `/docs/logs/BC.1-close-out.md` | new close-out (this file) |

## TRACKER

- **BC.1 → done** in `tracker_v15`. Next backend task: **BC.2** (SPEC-version reconciliation, per Deferred above). *(Tracker is operator-maintained external HTML — this is the note for the operator's tracker edit.)*

## Time

2026-07-01 (close-out session). Execute + PR #187 open→squash-merge: 2026-07-01.
