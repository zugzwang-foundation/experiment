# SYNC.8.5 — Instructions + memory refresh

> **Stage:** SYNC.8.5 — reconcile account/project memory and the project-instructions block to the post-SYNC settled state. **Status:** CLOSED.
> **Mode:** Web Claude + operator. No Claude Code; nothing committed to the repo.
> **Deliverables:** memory edits applied via the memory tool; `zugzwang-project-instructions.md` (paste-in block); `SYNC.8.5-final-memory-17.md` (install source).
> Refreshed for `docs/logs/` at SYNC.9 from the SYNC.8.5 close-out (six fields per CLAUDE.md §5.9).

---

## What landed

**Memory — 30 steering edits → 17** (installed + read-back verified):
- Mechanism clarified: memory updates only via the `memory_user_edits` tool (the numbered steering list, 500-char/edit cap); the auto-generated *blob* regenerates nightly and lags — the source of the stale items still visible in the modal.
- Corrected: reply-depth = 1 flat (was "unlimited"); ranking = ADR-0017 (0009 rejected); friendly-fire removed (reply-as-bet); CC = Opus 4.8; **GitHub canonical / PK = synced mirror** (was "PK canonical").
- Added: two-floor economy + issuance (ADR-0018); WebC↔CC relay contract; plan-then-execute chat structure (≥2 chats); stale-doc gate in the closing ritual; founder-facing `## Summary` reframe; chat-split-to-avoid-compaction.
- Dropped: K_eff-out-of-scope edit; FOUND-era authoring history; Desktop-relocation detail; CLI/Biome/ADR-template/CC-gate duplications (now pointers to AGENTS.md / CLAUDE.md); the SOCIAL.WEDGE-MARKETS pointer (E17 scrapped); the stale SCAFFOLD.8 "current state" narrative (replaced by a tracker pointer).
- Net: 30 bloated/partly-stale edits → 17 lean, spec-accurate, non-duplicative (each ≤500 chars).

**Project instructions — full revamp** (~5,442 chars; delivered, pending paste):
- Four-layer no-duplication design: profile preferences (global style) · project instructions (guaranteed domain constitution) · memory (mutable facts) · CLAUDE.md/AGENTS.md (CC contract). Instructions carry only what must be guaranteed and doesn't live reliably elsewhere.
- Anti-staleness: no hard-coded dates (the old block's "15 Sep / Nov 8 / ETHGlobal conclusion" was exactly what broke); dates now memory/tracker-owned, instructions keep the directive + pointer.
- Updated: paper → `zugzwang_btc_style_v4`; tracker → `tracker_v11.html`; two-role → three-role model + CC Opus 4.8; refusals to the current invariant set (+ admin-structural-separation, + moderation/CSAM safety); GitHub-canonical + descriptive-vs-prescriptive doc-flow added.

## Decisions made

- **E15 = A** — the effort line names `max` / `ultracode` (the 4.8 `/effort` levels); `ultrathink` stays the prompt keyword, valid in max.
- **E17 scrapped** — SOCIAL.WEDGE-MARKETS pointer removed from memory; its docs/CSVs to be pulled from PK.
- **Instructions design** — guaranteed-constitution-only; profile preferences not re-listed; one intentional overlap (house reply style, because it governs every response).

## Open questions

None blocking. Note: `zugzwang-project-instructions.md` and `SYNC.8.5-final-memory-17.md` are **not** added to PK — they are a settings paste-in + an install source, not project docs.

## Next session starts at

**SYNC.BACKFILL** — CC commits ADRs 0003–0019 to `docs/adr/` content-untouched + flips ADR-0009 → rejected.

## Context to preserve

**Honest sync state: decision layer aligned, commit layer pending.** SPEC.1 / SPEC.2 / ADR-0017–0019 / CLAUDE.md / AGENTS.md / memory / instructions all describe the same reconciled state, but the canonical repo does not yet hold it — ADRs 0003–0019 are PK-only (repo has 0001), ADR-0009 not flipped, rebuilt CLAUDE.md/AGENTS.md + tracker_v11 uncommitted, `main` 1 commit ahead of origin (unpushed `27216fc`). "GitHub is canonical" is aspirational until SYNC.BACKFILL → SYNC.9 → SYNC.10 close it. **Do not start ENGINE before SYNC.10 + PRECURSOR.4 (v1.0 spec lock).** Operator carry-forwards: paste the revamped block into Project settings (replace wholesale); remove SOCIAL.WEDGE-MARKETS docs + `MKT*.csv` from PK; the memory blob sheds its stale sections at the next nightly regeneration (passive).

## Time

Single web + operator session; no stopwatch recorded.
