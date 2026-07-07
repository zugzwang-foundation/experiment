# AUDIT-FIX-B8 — Web-Authored Riders (D1–D4 + the §16.3⇄§17.6/A17 reconciliation)

**For CC:** doc-only PR, branch `docs/audit-fix-b8`. Commit **this file** as `docs/plans/AUDIT-FIX-B8.md` alongside all riders, same commit. **Anchoring mode: BOUNDARY-ANCHORED** — several relay quotes reached web truncated, so instead of byte-matching full "current" blocks, each rider names unambiguous START/END boundary lines (or a unique insert-after line). CC must (1) verify each boundary is unique on live main, (2) apply the replacement/insertion, and (3) **reproduce every REPLACED block verbatim in the PR body** so web's gate read can diff old-vs-new precisely. Any non-unique or missing boundary → STOP and report. Do NOT touch SPEC.1/SPEC.2 §0 or §22 (sweep-owned); cpmm.md's own header/§15 ARE touched here (R1/R4 — cpmm has no sweep target and its own semver rule governs). Gates: tsc/biome + lefthook only (doc-only). Operator merges after the web **gate read** (canonical math spec — not a skim).

Ratified values encoded: cpmm.md 1.0.0 → **2.0.0** in-PR; void-residual truth-correction per R-9.8; item-5 ruling = built 7-field set canonical now, `request_id` a forward obligation, admin `user_id: null` stands.

---

## Part A — D1: cpmm.md void model → R-9.8 (the substantive fix)

### R1 — header version + date

In the §0 metadata table: `| **Version** | 1.0.0 (semver; …` → `| **Version** | 2.0.0 (semver; MAJOR on any change to a formula or invariant, MINOR on clarifications) |` and `| **Date** | 2026-06-04 |` → `| **Date** | 2026-07-07 |`.

### R2 — §8.2 full replacement

**Boundaries:** START = the heading line `### 8.2 Voided`; END = the line ending `` comments lock `voided`. `` (exclusive of the `### 8.3 Correction` heading). Replace everything between, heading included, with:

> ### 8.2 Voided
>
> Void (SPEC.1 §6 `Open|Closed → Voided`, §10.7 per B3) runs **no curve math**. Reversal is ledger arithmetic on the founder-ratified **R-9.8 basis** (SPEC.1 §10.3 + §10.7, v1.0.3 ENGINE.9 riders; shipped `src/server/resolution/void.ts`): every bet is refunded **`void_refund` = f × stake**, where f is the surviving fraction of the user's held-side position (f = position quantity ÷ Σ same-side `share_quantity`; per-bet exact-sum rounding — floors with a deterministic last-row remainder ordered by bet id — is owned by SPEC.1 §10.3). **Sale proceeds stand** — the sale was a real trade at a real price. Proceeds are never reversed, no negative compensating entries exist, and a fully-sold side has f = 0 and refunds 0 (zero legs are legal — SPEC.2 Appendix B.8, R-9.2/R-9.8). Refunds are therefore always ≥ 0: the floor-at-zero / `uncollectable` discipline (SPEC.1 §10.7 per B4) belongs to the **correction** path (§8.3) and has **no void leg**.
>
> **Residual.** The pool's remaining Đ after refunds — D − Σ `void_refund`, with D = seed + Σ stakes − Σ proceeds (§8.1) — is **not in general the seed**: it differs from the seed by exactly the users' net realized sale P&L (a seller's gain stayed with the seller, so the pool carries the mirror; a seller's loss likewise stayed in the pool). The residual exits circulation as `poolUnwindAmount` on the terminal `market.voided` events row (R-9.5/R-9.5e) via `pool_unwind`; there is no admin balance. Shares are extinguished without payout; comments lock `voided`. **Audit path:** void reproduction is **ledger-based** — recompute f per user-side from the shipped `positions`/`bets`, apply f × stake per bet, compare Σ against the `void_refund` rows and the event's `poolUnwindAmount` — not a frozen-reserve identity (contrast §8.1's Resolved case; see INV-C4).

### R3 — §11 INV-C4 replacement

**Boundaries:** START = the bullet line beginning `- **INV-C4 — Solvency / residual identity.**`; END = the last line of that bullet (exclusive of the next `- **INV-C5` bullet). Replace with:

> - **INV-C4 — Solvency / residual identity.** User-held shares of side X equal D − x_reserve (D = pool Đ balance). **Resolved:** payout = D − w, unwind = w (the winning reserve) — auditable from the frozen reserves alone (§8.1). **Voided:** unwind (`poolUnwindAmount`) = D − Σ `void_refund` on the R-9.8 f × stake basis (§8.2); it equals the seed **only** when no realized sale P&L exists across users, and it audits from the shipped ledger (`bets`, `positions`, `dharma_ledger`) plus the terminal `market.voided` row (R-9.5e) — **not** from reserves alone.

### R4 — §15 change-log: append row

Append to the §15 table:

> | 2.0.0 | 2026-07-07 | HMH | **§8.2 + INV-C4 rewritten to the founder-ratified R-9.8 void basis** (AUDIT.1 finding D1; canonical sources: SPEC.1/SPEC.2 v1.0.3 ENGINE.9 riders + shipped `resolution/void.ts`): refund = f × stake per bet, sale proceeds stand, no negative compensating entries, no void-leg `uncollectable`; residual (`poolUnwindAmount`, R-9.5e) = D − Σ `void_refund`, equal to seed only absent realized sale P&L; void auditing is ledger-based, not reserve-alone. §13 contract comment verified current (void stays ledger arithmetic, no curve function — unchanged). MAJOR per §0 semver (formula/invariant change). Also records the previously-unlogged ENGINE.14 amendment (`a29ef7e`, pool-seed payload recording form — no version bump was made at the time). |

### R5 — CONDITIONAL: §8.4 + INV-C5 qualifier

The recon flagged §8.4 (~:423) and INV-C5 (~:549) as implicit dependents of §8.2's old residual identity but did not quote them. CC: **quote both verbatim in the PR body.** If either asserts that *every* §8 quantity / the void residual is auditable **from frozen reserves alone**, append this sentence to that clause: `(Exception per §8.2/INV-C4: the Voided residual audits from the ledger, not from reserves alone.)` If neither makes a reserve-alone claim covering void → no edit, state so. Ambiguous → STOP with the quotes.

### Verified-no-edit (record in PR body)

- §13 module-contract comment (~:638): "Void residual is a ledger identity (§8.2), not a curve computation — no function exists for it" — **remains true under R-9.8**; pointer stays valid post-R2. No edit.
- cpmm.md :39 and :421 — state-machine/freeze mentions, model-agnostic. No edit.

---

## Part B — D2: pending-build annotations (SPEC.2)

### R6 — §5.1 comments row

Insert-after anchor: the sentence ending `does not change the Bucket-A append-only classification` inside the §5.1 comments row (~:508). Append within the same cell:

> **Build-deferred (AUDIT.1 D2):** the `market_media_id` column + not-both-set CHECK are **not in schema** as of migration head `0023` — they ship in one migration with the composer-pick stratum, per the §0 v1.0.12 deferral note. The row above describes the ratified target shape, not current DDL.

### R7 — Appendix B.6 `market_media_id` row

In the row's Notes cell (unique anchor: the cell containing `FK to market_media.id for pick-from-pool (F-COMMENT-3)`), append:

> **PENDING-BUILD** — column not in schema @ head `0023`; ships with the composer-pick stratum (D2).

---

## Part C — D3: Appendix B.15 export classification (SPEC.2)

### R8 — two new rows

Insert-after anchor: the B.15 row whose first cell is `` | `r2_object_key` | ``. Insert:

> | `content_type` | text | SHIP | Upload MIME as validated at sign time (allowlist); no PII; media-mix signal for researchers |
> | `byte_size` | integer | SHIP | Validated size in bytes (DB CHECK `0 < byte_size ≤ 8388608`, migration `0006`); no PII |

---

## Part D — D4: §4.3 route catalogue + §4 closer (SPEC.2)

### R9 — catalogue completion

1. Intro sentence: `Nine Route Handlers in v1.` → `Eleven Route Handlers in v1 (ten built; GET /api/dataset/manifest is pending-build per §4.7).` (Preserve the rest of the intro sentence about the Node.js runtime verbatim.)
2. Insert-after anchor: the row whose first cell is `` | `GET /api/cron/r2-orphan-sweep` | ``. Insert:

> | `GET /api/cron/close-due-markets` | F6 | `src/app/api/cron/close-due-markets/route.ts` | Bearer `CRON_SECRET` (constant-time compare) | N/A — exempt (caller is Vercel Cron; distributed lock + `closeDueMarkets` sweep own the at-least-once / may-fire-twice semantics) | W-4 close-due sweep (ENGINE.15 R-15.2; §3.4 Pattern A-2; freeze-gated per §20.2) |

3. Insert-after anchor: the row whose first cell is `` | `GET /api/health` | ``. Insert:

> | `GET /api/_smoke-error` | F6 | `src/app/api/_smoke-error/route.ts` | None — env-behavioral gate (404 on `prod`; throws on `staging`/`preview`; SCAFFOLD.8 EC9/LD-5) | N/A | Observability smoke — Sentry routing verification; throw-only, no state reachable; not a SPEC.1 flow |

4. In the `GET /api/dataset/manifest` row's last cell, append: ` **PENDING-BUILD** (thin build-pipeline pointer per §4.7; not on disk — D4).`

### R10 — §4 closer

In the §4 single-source-of-truth closer (~:485): `owns the single Vercel Cron target` → `own the two Vercel Cron targets`, with the file reference widened to `src/app/api/cron/{r2-orphan-sweep,close-due-markets}/route.ts`. CC anchors on the unique phrase `single Vercel Cron target`.

---

## Part E — Item 5: §16.3⇄§17.6 reconciliation + A17 (ruling)

**Ruling (encoded here, founder-gated at ratification):** the **built seven-field** request-log set is canonical for now. SPEC.2 §17.6's eighth field (`request_id`) is re-labeled a **forward obligation**, honoring `logging.ts`'s lock comment (additions require a SPEC.1 §16.3 amendment + same-commit field-set code change — which is code, and B8 is doc-only). A17: **admin rows keep `user_id: null`** — the admin has no `users` row by structural design (admin-is-not-a-participant guardrail); minting a synthetic marker string would blur that line; the `route` field disambiguates.

### R11 — SPEC.2 §17.6

Anchor: the §17.6 field-set line ending `· request_id` (~:1770s). Append immediately after that line (new paragraph):

> `request_id` is a **forward obligation**, not yet emitted: the shipped `logRequest` field set is locked at the SPEC.1 §16.3 seven (its lock comment requires a SPEC.1 amendment + a same-commit field-set change to extend — HARDEN.\* candidate). Until it lands, cross-surface correlation flows Sentry-tag → `events.metadata.request_id` (§3.7); the runtime-log leg of the §17.6 walkthrough activates when the eighth field ships. (AUDIT.1 B8 item-5 reconciliation, 2026-07-07.)

### R12 — SPEC.1 §16.3 H3 clarifier

Anchor: the H3 bullet containing `user_id (or anon marker)` (~:1012). Append to the bullet:

> Admin-surface rows log `user_id` = JSON `null` — the admin has no `users` row by design (§2 structural separation); no synthetic admin marker is minted, and the `route` field disambiguates the admin surface (AUDIT.1 A17/B8 ruling, 2026-07-07).

---

## Part F — R13: parked.md SYNC-sweep extension (B8 = seventh originating task)

Extend the sweep entry (same pattern as B7-A26/B7a): heading + originating-task line gain `AUDIT-FIX-B8 (D1–D4 + §16.3⇄§17.6/A17 reconciliation, doc-only riders on docs/audit-fix-b8; PR# in docs/logs/AUDIT-FIX-B8.md)`; target 1 gains a B8 sub-bullet (SPEC.2 §5.1 D2 annotation · B.6 pending-build · B.15 +2 rows · §4.3 catalogue 9→11 + closer two-cron fix + manifest pending-build · §17.6 request_id forward-obligation); target 2 gains `B8's §16.3 H3 admin-null clarifier`. Note in the B8 sub-bullet: **cpmm.md 2.0.0 bumped in-PR with its own §15 row — no cpmm sweep debt.** Date-stamp the extension.

---

## STOP conditions

Any boundary non-unique or missing; §8.4/INV-C5 ambiguity (R5); any anchor content materially different from the recon's quoted state (main moved); anything requiring a code or migration touch; scope beyond the six parts.
