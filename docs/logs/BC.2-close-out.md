# Close-out — BC.2 (prescriptive-spec drift reconciliation)

**Stratum:** BC.2 — prescriptive-text reconciliation of the canonical specs + contract docs to the backend-complete reality on `main`. Corrects version citations, a phantom route + its F-ADMIN-4 mislabel, INV-1 prose, the ADR index (ADR-0001 admitted), `market.created` payload prose, and the `tracker_v11 → tracker_v15` reference hygiene. **No code / schema / migration touched — docs only.** INV-1 was safety-verified as genuinely enforced *before* the prose was softened (see DECISIONS D1).

**Branch:** `chore/bc2-prescriptive-specs`, off `main` @ `9aed84b`.
**Canonical SHA (squash-merge on `main`):** _PR #TBD → SHA TBD_ (fill on merge).
**State:** applied + verified locally; PR open, awaiting review (no self-merge). Files: **3 changed** (CLAUDE.md, AGENTS.md, docs/specs/SPEC.2.md) + this log. **33 prescriptive loci** edited across Parts A–G.
**Verification:** `ZUGZWANG_ENV=preview just verify` → tsc + biome + next build **all green**; `pnpm vitest run` → **1102 passed / 0 failed** (155 files, 3 pre-existing skips, 5 todo).

---

## SHIPPED — 33 loci across 3 files

**Part A — SPEC.1 version citations (3)**
1. `CLAUDE.md:18` — source-of-truth line: `SPEC.1 (product, v1.9.0-draft)` → `1.0.13`; `tracker_v11.html` → `tracker_v15.html`.
2. `CLAUDE.md` footer — appended the BC.2 reconciliation clause (SPEC.1 1.0.13, SPEC.2 1.0.15).
3. `AGENTS.md:278` footer — same BC.2 clause appended.

**Part B — phantom `/api/admin/uploads/sign` + F-ADMIN-4 mislabel (6)**
4. `SPEC.2 §4.3` intro — route-handler count **Ten → Nine**.
5. `SPEC.2 §4.3` catalogue — deleted the phantom `POST /api/admin/uploads/sign` row (was tagged "F-ADMIN-4 image affordance prep").
6. `SPEC.2 §4.6` rate-limit table — deleted the phantom row.
7. `SPEC.2 §4` SSOT prose — repointed the admin signed-PUT mint from the phantom path to the real `src/app/(admin)/admin/markets/media/sign/route.ts` (MEDIA.1).
8. `SPEC.2 §12.10` SSOT — deleted the phantom row (was "admin moderation affordance").
9. `SPEC.2 Appendix A` — deleted the phantom file-map row (was "F-ADMIN-4 image affordance").
   *(The real `/admin/markets/media/sign` route, correctly documented since MEDIA.1 on the adjacent rows, was left untouched. Count correction: the recon estimated 6 mislabel loci; ground truth was **5** current-body loci — 4 deletions + 1 prose repoint.)*

**Part C — SPEC.2 status-prose + `market.created` payload (9)**
10. `§0` status line — `1.0.5` (ten patches stale) → `1.0.15`, rewritten to the backend-complete BC-sweep state; `consistent with SPEC.1 (v1.0.x)` → `(1.0.13)`.
11. `§0` companion-files — `cpmm.md`/`RANKING.md` now on disk; `PSEUDONYM.md`/`design.md` still pending; `17 ADRs / 0003–0019` → `25 ADRs / 0003–0027`.
12. `§0` Version — `1.0.14` → `1.0.15`.
13. `§0` Date — `2026-06-30` → `2026-07-01`.
14. `§0` Gates-downstream — `17 ADRs / ADR-0003–0019` → `25 ADRs / ADR-0003–0027`; `VISUAL.*` → `DESIGN.*`; `EXPORT.*`/`MEDIA.*` added.
15. `§0.1` change-log — inserted the `1.0.15` BC.2 row after `1.0.14`.
16. `§1.4` `cpmm.md` forward-reference — "not yet on disk" → "landed" (`docs/specs/cpmm.md`; `src/server/cpmm/` built ENGINE.2–12).
17. `§3.8` — `market.created` payload prose extended with `media[]` + `mediaVideoUrl` (MEDIA.1 OD-2).
18. `§19.4.1` — dataset table row for `market.created` extended with `media[]` + `mediaVideoUrl`.

**Part D — INV-1 prose (`comments.bet_id`), safety-verified (3)**
19. `§3.2` W-1 — `bets.comment_id + comments.bet_id both NOT NULL` → INV-1 via `bets.comment_id NOT NULL`; `comments.bet_id` deliberately nullable.
20. `Appendix A` comments.ts row — `bet_id NOT NULL` → `bet_id` deliberately nullable (INV-1 via `bets.comment_id NOT NULL`).
21. `Appendix B.6` comments `bet_id` row — Type `uuid` → `uuid | null`; note rewritten to the deliberately-nullable framing.
   *(DEBATE.8 had already corrected `§5.1` + `§14.1`; these three were the residual it missed.)*

**Part E — ADR-0001 → §22 index (7)**
22. `§22` intro — inventory `25 ADRs` → `26 ADRs`; corrected the section's own false claim that ADR-0001 "was never authored" (it is `0001-license-choice.md`, Accepted); only ADR-0002 remains genuinely unauthored.
23. `§22` accepted/superseded breakdown — `25 ADRs / 22 accepted` → `26 ADRs / 23 accepted` (ADR-0001 added to the accepted list).
24. `§22.1` header — "The 25-row index" → "The 26-row index".
25. `§22.1` table — inserted the ADR-0001 row (`FOUND.3` · `0001-license-choice.md` · Use AGPL-3.0-or-later · accepted · **2026-04-29**) before ADR-0003.
26. `§22.5` SSOT — `25 ADRs / 24 files / 22 accepted` → `26 ADRs / 25 files / 23 accepted`.
27. `§23.4` — ADR-0001 moved from "out of inventory / no ADR file" to in-inventory-but-outside-§23-phase-gates; ADR-0002 remains out of inventory.
28. `Appendix A` ADR-file-count row — `0003–0019 / 17 files` → `0001, 0003–0027 / 26 files`.

**Part G — `tracker_v11 → tracker_v15` live-pointer sweep (5)**
29. `CLAUDE.md:203` decision-log line — `tracker_v11` → `tracker_v15`.
30–33. `SPEC.2 §23` intro (`:2289`), §23.1 census (`:2315`), §23.4 SSOT rows (`:2376`, `:2377`) — `tracker_v11.html` → `tracker_v15.html`.
   *(The two point-in-time change-log rows — SPEC.2 1.0.0/1.0.1 — that mention v11 are historical record and were left as-is, per Part G's own note.)*

---

## DECISIONS

- **D1 — INV-1 softening was safety-gated, not assumed.** Before touching the §3.2 / Appendix A / Appendix B.6 prose, re-confirmed on the current schema: `bets.comment_id` is `.notNull()` (`src/db/schema/bets.ts:49–51`) and `comments.bet_id` is nullable (`src/db/schema/comments.ts:52–54`), with the atomic comment-before-bet insert in `src/server/bets/place.ts` (`:127` comments, `:151` bets with `commentId`) and the `I-ATOMICITY-001` invariant test present. INV-1 is genuinely enforced; the NOT-NULL prose was a mis-description only. **No code changed.** Documented mandatory-commentary being softened in language but *not* in mechanism.
- **D2 — ADR-0001 date sourced from git, not guessed.** `git log --follow --format=%ad --date=short -- docs/adr/0001-license-choice.md | tail -1` → **2026-04-29** (used in the §22.1 row).
- **D3 — historical change-log rows preserved.** Every point-in-time mention of `v1.9.0-draft`, `tracker_v11.html`, or the phantom route inside dated change-log rows (SPEC.1 §20 / SPEC.2 §0.1) was left verbatim as historical record; only *live pointers* were swept.
- **D4 — footers appended, not rewritten (BC.1 precedent).** The CLAUDE.md/AGENTS.md footer "SPEC.1 v1.9.0-draft" is a dated SYNC.8-rebuild statement; per BC.1 practice the version reconciliation was recorded as an appended BC.2 clause rather than an in-place edit of the historical rebuild line.

---

## Surprises caught + fixed in-session (§5.10)

- **S1 — table-row deletions concatenated adjacent rows (caught in diff review, fixed in-session).** The four phantom-row deletions (B2/B3/B5/B6) were authored as `\n| row |` matches; each removed the row *and* the separator between its two surviving neighbours, collapsing them onto one physical line joined by ` || ` and breaking 4 markdown tables (§4.3, §4.6, §12.10, Appendix A). Caught by eyeballing the full `git diff` (the `+` line showed `…prep || \`POST…`) and by a `grep -n " || "` sweep. Re-split all four (the only remaining ` || ` is legitimate JS at `SPEC.2.md:951`). Tables re-verified well-formed before `just verify`.
- **S2 — recon's "6 mislabel loci" was 5.** Ground truth was 5 current-body phantom-route loci (matching the MEDIA.1 close-out's own enumeration); the edit list correctly targeted 5 (4 deletions + 1 prose). Count reconciled in the ledger (item 4).
- **S3 — §22 intro itself misdescribed ADR-0001.** The section claimed ADR-0001 was "never authored as an ADR file" and was about "brand architecture"; in fact `0001-license-choice.md` exists and is Accepted (AGPL license choice). Corrected as part of Part E (E1), which grew the ADR-0001 fix from a single index row to 7 loci.

---

## DEFERRED

- **`SPEC.2 §22` intro sentence (`:2202`)** still reads "the ADRs at `docs/adr/0003-…md` through `docs/adr/0025-…md`" — stale (should be `0001, 0003-…md through 0027-…md`). **Not in the BC.2 edit list**, so left untouched to avoid guessing a merge; after Part E this is a visible residual (the very next sentences now say "26 ADRs … 0003–0027"). **→ flag for BC.3 or a §22 micro-fix.** *(Surfaced, not absorbed — per §5.4.)*
- **Rate-limit `writeBudgetPerMarket` / `writeBurstPerUser` code↔§11 tension** — code defines/exports them (`src/server/middleware/rate-limit.ts:61,68`); §11 says the pair is removed. Acknowledged in the SPEC.2 1.0.14 change-log as a known gap. **BC.3 rules; BC.2 makes no ruling.**

---

## Part F — Dispositioned drift ledger

| # | Item | Disposition |
|---|---|---|
| 1 | SPEC.1 version citations (CLAUDE.md:18, CLAUDE.md footer, AGENTS.md footer) | Fixed at BC.2 (Part A) — live doc confirmed 1.0.13; footers append-only per BC.1 precedent, not edited in place |
| 2 | SPEC.2 status-prose (§0 status line, companion-files, gates-downstream) | Fixed at BC.2 (Part C) — version bumped 1.0.14→1.0.15 |
| 3 | Phantom /api/admin/uploads/sign (5 loci) | Fixed at BC.2 (Part B) — 4 deletions, 1 prose edit; real route already documented separately since MEDIA.1 |
| 4 | F-ADMIN-4 mislabel | Fixed at BC.2 (Part B) — resolved by the phantom-route deletions; count corrected 6→5 |
| 5 | comments.bet_id NOT NULL prose (INV-1) | Fixed at BC.2 (Part D) — safety-verified: INV-1 genuinely enforced via bets.comment_id NOT NULL + atomic W-1 tx + invariant test; prose-only, no code touched |
| 6 | ADR-0001 → §22 index | Fixed at BC.2 (Part E) — scope grew beyond the single-locus estimate once §22's own intro also proved to misdescribe ADR-0001; 7 loci total |
| 7a | Rate-limit writeBudgetPerMarket/writeBurstPerUser (code vs §11 tension) | Recorded, → BC.3. Code has them; §11 says removed; already acknowledged in the 1.0.14 changelog as a known gap. BC.2 makes no ruling. |
| 7b | market.created payload prose | Fixed at BC.2 (Part C), re-scoped from BC.4 — the kickoff's premise (a stray .optional() in code) didn't hold; the actual drift was doc-only |
| new | tracker_v11.html → tracker_v15.html, 6 live-pointer loci (CLAUDE.md + SPEC.2.md) | Fixed at BC.2 (Part G) — found while fixing item 1's CLAUDE.md:18; grepped for completeness |
| new | §22 intro (2204) + §22.5 (2276) misdescribing ADR-0001 as unauthored / wrong topic | Fixed at BC.2 (Part E) — necessary consequence of correctly admitting ADR-0001 to the index |
| — | market.created .optional() (original 7b framing) | Superseded — no such code defect exists; see 7b for the real, now-fixed item |

---

## PK-REFRESH (canonical copies for operator drag-in)

md5-verified copies of every changed file staged into `~/Desktop/zz-pk-refresh-BC.2/`:

| File | Purpose |
|---|---|
| `CLAUDE.md` | contract — SPEC.1 version + tracker ref + BC.2 footer clause |
| `AGENTS.md` | stack patterns — BC.2 footer clause |
| `SPEC.2.md` | technical spec — Parts B–G (the bulk of BC.2) |
| `BC.2-close-out.md` | this log |

---

## Next session starts at

BC.3 — rate-limit `writeBudgetPerMarket`/`writeBurstPerUser` code↔§11 ruling (DEFERRED above), plus the `SPEC.2 §22:2202` "through 0025-…md" residual micro-fix. Both are recorded; neither is started.
