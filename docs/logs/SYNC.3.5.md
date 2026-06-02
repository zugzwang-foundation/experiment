# SYNC.3.5 — Scope-update / refinement sort

> **Stage:** SYNC.3.5 — Scope Update / Refinement-Sorting (Bucket 2). **Status:** CLOSED.
> **Mode:** Web Claude + operator. No Claude Code, no repo writes.
> **Repo snapshot at sort time:** `92b7c47`.
> Refreshed for `docs/logs/` at SYNC.9 from the SYNC.3.5 close-out index (six fields per CLAUDE.md §5.9). Per-item reasoning lives in the eight `SYNC.3.5-refinement-0N` logs.

---

## What landed

Eight operator scope-refinements sorted against the thesis-locked floor using a three-type sort:

- **TYPE 1 — ledger-input:** re-classifies built/existing state → folds into SYNC.4 as a ruling.
- **TYPE 2 — forward-scope-clean:** new scope touching no invariant, no load-bearing ADR, no thesis floor → folds into prose at SYNC.7.
- **TYPE 3 — forward-scope-load-bearing:** new scope that *does* touch the above → resolves as an ADR-level decision at the top of SYNC.4, before any spec prose.

Final dispositions:

| # | Item | Disposition |
|---|------|-------------|
| 01 | Public-read access + visitor counter | 2× TYPE-2 (public-read posture; visitor counter) + 1 definitional ("users" — no bucket). RLS ruling → SYNC.4. |
| 02 | Reply-as-bet model | **TYPE 3 — LOAD-BEARING.** Rejected ADR-0009; 5 ADR-level decisions + a successor ranking ADR required. The gate. |
| 03 | Download-post button | TYPE 2 — single post → JPEG, client-side, frozen-at-download. Social-share Part 2 deferred. |
| 04 | Radio / music widget | TYPE 2. |
| 05 | Upload modes | Links → TYPE 2. **PDFs → REJECTED** (new user-submitted moderation surface; out of scope). |
| 06 | Historical-debate showcase | TYPE 2 — frozen showcase, static seed, zero engine contact; named-paraphrase + citations. |
| 07 | Download-debate-`.md` + daily report | Download-`.md` → TYPE 2 (whole debate, frozen-at-download). Daily NotebookLM/ElevenLabs report → NO BUCKET (operator content-ops). |
| 08 | Feature-guide page + "i" buttons | TYPE 2 — one canonical page, "i" buttons = anchor deep-links. Rename-pending (not "FAQ"). |

**Tally:** 1 TYPE-3 (load-bearing) · 1 rejection (PDFs) · 2 no-bucket (definitional "users"; daily-report workflow) · 1 deferred (social-share) · remainder TYPE-2.

## Decisions made

- **ADRs before prose.** The forward order is *not* "make 8 amendments → sync → docs." That is right for the TYPE-2s but wrong for item 02 (reply-as-bet), which is load-bearing — folding it into prose alongside the TYPE-2s would leave specs describing a reply/ranking model with no ADR behind it, the exact drift this exercise exists to prevent.
- **ADR-0009 treated as already rejected** for anything ranking-related; a successor ranking ADR is required.
- **Thesis floor held across all eight** (soulbound Dharma, mandatory commentary, CPMM, no-stake-no-voice). Only item 02 deliberately reshapes the reply/ranking model — which is precisely why it is routed through an ADR, not prose.

## Open questions

Routed to SYNC.4: the 5 reply-as-bet decisions + the successor ranking ADR; the four inherited open rulings; the RLS ruling (from item 01); any TYPE-1 ledger-inputs.

Lawyer flags (mid-July engagement — non-blocking): named-paraphrase + citation model for public/promotional historical content (06); ToS coverage for operator re-use of user commentary in the daily report (07); open-links ToS clause (05).

## Next session starts at

**SYNC.4 — ADRs & rulings**, before any spec prose is written.

## Context to preserve

The seven TYPE-2 features are free-flowing doc edits. Item 02 is a gate with an ADR behind it — open the gate (SYNC.4) before pushing TYPE-2 through (SYNC.7). Three explanatory artifacts (06 showcase, 07 daily report, 08 feature guide) must tell one consistent thesis story; visitor counter (01) and showcase (06) must read as visibly distinct from a live market / from `n`.

## Time

Single web + operator sort session (Bucket 2); no stopwatch recorded.
