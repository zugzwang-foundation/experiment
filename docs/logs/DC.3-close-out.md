# Close-out — DC.3 (design-commit: DC.1-ratified canon set + per-surface mockups)

**Stratum:** DC.3 — commit the DC.1-ratified design canon set into `docs/design/`. **Outcome: shipped.** PR **#195**, squash-merge **`5b28c49`** on `main`. One anomaly mid-task (Biome a11y on the archival mockups) — stopped per the no-improvisation rule, ruled, resolved with a one-line `biome.json` exclusion riding in the same PR, which flipped the PR from doc-only to reviewed.

**Verification base:** `main` @ `7d2bd75` (incident log #194) at branch cut; squash landed as `5b28c49`.
**Work branch:** `chore/dc3-design-commit` (commit `fc992f2`; auto-deleted on merge).
**Log branch:** `chore/dc3-design-commit-log`, off `main` @ `5b28c49`.

---

## SHIPPED (What landed)

**PR #195 → squash `5b28c49`** — 19 paths, 7,417 insertions / 40 deletions. Every design file md5-verified pairwise against the ratified drop (`~/Downloads/dc3-commit/`) before commit; post-merge tree-proof `git diff fc992f2 origin/main -- docs/design/ biome.json` empty.

**Modified (2):**

- `docs/design/design-language.md` → **v0.5-draft** — the fork-merge: PK v0.4 lineage (the **axis correction**: black/white poles encode **side (YES/NO) only**; Support/Counter is a separate, post-relative relation, never a colour or column; §2.1 tokens renamed `color.side.support→.yes`, `.counter→.no`; DESIGN.8 → DESIGN.SPEC retired throughout) × disk v0.3 lineage (the SHELL/UI.0 token-value mint, provenance-linked to `src/app/globals.css`).
- `biome.json` — `"!docs/design/mockups"` appended to `files.includes` (see Decisions).

**New (17):**

- `docs/design/design-canon.md` — supersedes the phase record + the three by-type consolidations.
- `docs/design/design-token-contract.md` — freezes token **slot names**; values stay live until branding (B1→B3).
- `docs/design/mockups/` — 15 files, verbatim-frozen, no renames: `surface_d5_v1_0.html`, `surface_discovery_v1_0.html`, `surface_profile_v1_0.html` (the v1.0 stills); W2 mockups `DESIGN_W2_1_auth-modal_mockup-v0_3`, `DESIGN_W2_1_first-login-journey_mockup-v0_1`, `DESIGN_W2_2_onboarding-deck_mockup-v0_1`, `DESIGN_W2_4-5-14_global-header_mockup-v0_2`, `DESIGN_W2_8_entry_mockup-v0_1`, `DESIGN_W2_10_sell-and-clamp_mockup-v0_1`, `DESIGN_W2_11_state-kit_mockup-v0_1`, `DESIGN_W2_13_post-reply-share-card_mockup-v0_1` (all `.html`); records `DESIGN_W2_3_universal-back_CLOSE-OUT.md`, `DESIGN-W2_6-graph-prototype-record.md`, `DESIGN-W2_6-profile-graph-CLOSE-OUT.md`; `README.md`.

Untouched, as mandated: the 4 living guides (`design-workflow`, `design-handoff`, `Research_Report_v2`, `visual_precursor_planner`), CLAUDE.md/AGENTS.md, tests, src.

---

## DECISIONS MADE

**1. The mid-task STOP + ruling — archival-mockup Biome exclusion.** Biome 2.x parses `.html`, so the lint gate failed on 3 of the 15 mockups — **20 a11y errors** (`lint/a11y/useButtonType` ×15, `lint/a11y/noSvgWithoutTitle` ×5) in `DESIGN_W2_2_onboarding-deck` (12), `DESIGN_W2_13_post-reply-share-card` (5), `DESIGN_W2_10_sell-and-clamp` (3). All candidate fixes crossed a kickoff line (edit ratified artifacts / rename / touch a file outside `docs/design/`), so execution **stopped and reported** per the no-improvisation rule. **Ruling (web):** exclude via a `files.includes` negation — `"!docs/design/mockups"` — mirroring the existing `"!drizzle/migrations/meta"` precedent's exact shape (bare directory path, no glob suffix). **Full Biome exclusion (lint AND format) intended**: the mockups are verbatim-frozen DC.1 artifacts and must not be reformatted either. Rationale: frozen design records, not shipped UI; a11y lint on them is meaningless while `src/` stays fully linted; causally required by committing the mockups; BC closed, so the design-lane confinement's collision rationale no longer applied. One line, reversible.

**2. Gate flip — doc-only → reviewed.** Because the PR now touched `biome.json` (build config), the review-before-merge gate engaged: PR opened and **held un-merged** for web's diff review.

**3. Merge-before-review process note.** The operator merged #195 **before** web's diff review completed. Web then reviewed **post-hoc** — md5 chain to the ratified drop + exact 19-path census + gate results + the exclusion's behavioral proof — and **cleared it clean**. Recorded as a process deviation with a clean outcome, not a defect.

---

## GATES (all green)

- `ZUGZWANG_ENV=preview just verify` (typecheck → biome check → build): **green** — the build step's first pass on this tree.
- All **20 a11y errors cleared** by the exclusion, with the mockups present in the tree.
- Exclusion proven behavioral, not incidental: `pnpm biome check docs/design/mockups/` reports *"These paths were provided but ignored"* — lint **and** format will skip them.
- `src/` + `tests/` + the 3 new `.md` docs: **341 files lint clean** (pre-push hook re-checked 371 clean).
- Full unit suite **421/421**; `tests/unit/design/tokens-monochrome.test.ts` pin **5/5, file untouched** — its `NOT Support (design-language §1.3/§2.1)` string still resolves against v0.5 (`### §2.1` and the §1.3 side-binding section verified present in the new doc before copy).
- CI on the PR: required `ci` check **pass (3m1s)**; Vercel preview green.

---

## OPEN QUESTIONS / DEFERRED

- **W2.11 `state-ledger_reconciled.csv`** — deferred: audit artifact, **follow-up rider when located**. Not in the ratified drop; the state-kit mockup (`DESIGN_W2_11_state-kit_mockup-v0_1.html`) landed without it.

---

## CONTEXT TO PRESERVE

- The md5 chain is the DC.3 integrity spine: drop → repo verified pairwise per file at copy time; repo → `main` verified by the empty tree-proof diff post-merge; `main` → PK staged via `~/Desktop/zz-pk-refresh-DC.3/` (md5-verified from `origin/main`).
- PK's `design-token-contract` copy previously carried a versioned name (`design-token-contract_v0_2.md`); the repo name `design-token-contract.md` is canonical from DC.3 forward. PK's `design-language.md` was absent pre-refresh; the repo v0.5 restores it repo-authoritative.
- The Biome exclusion means **nothing under `docs/design/mockups/` is linted or formatted ever again** — intentional; any future *live* HTML surface must not live there.
- Canon sequencing (from `design-canon.md`): branding (B1→B3) fills the token contract; **DESIGN.SPEC** (the retired DESIGN.8 ref) derives the final value-filled `design.md`; DESIGN.HANDOVER consumes canon §8. B3 will need to amend the token-pin test's exact-string assertions (`tests/unit/design/tokens-monochrome.test.ts`) when the accent lands.

---

## PK-REFRESH

Staged into `~/Desktop/zz-pk-refresh-DC.3/`, md5-verified canonical copies from `origin/main` after this log merges: `design-language.md` (v0.5), `design-token-contract.md` (canonical name), `design-canon.md`, and this close-out. The 15 mockups are already byte-identical in PK under the same names — skipped.

---

## Next session starts at

The next web-sequenced design-lane row — branding **B1** (token-contract value fill) or the W2.11 `state-ledger_reconciled.csv` rider, whichever web opens — with a read-only premise-check against `main` first.

---

**Time:** 2026-07-02, one session: DC.1 grounding recon + two micro-recons (disk-copy verbatims, token blocks) → DC.3 execute (≈45 min, incl. the STOP/ruling round-trip) → post-hoc-review close-out.
