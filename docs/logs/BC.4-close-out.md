# Close-out — BC.4 (`market.created` `.optional()` / stale-payload fix — NO-OP-WITH-WRITEUP)

**Stratum:** BC.4 — tracked as "the `market.created` `.optional()` / stale-payload fix + any non-critical code fix the ledger surfaces." **Outcome: no-op-with-writeup.** The premise — a stray `.optional()` in the `market.created` payload schema — was investigated against live `main` and found **not to hold**; the schema is correct as-is. No code, no schema, no migration, no ADR. This log closes a stale tracker row.

**Verification base:** `main` @ `096189c` (BC.3 close-out squash #192; BC.3 removal `b6e1aea`).
**Log branch:** `chore/bc4-log`, off `main` @ `096189c`.
**State:** read-only premise-check complete (recon), ratified by operator + web; this doc-only close-out is the deliverable.
**Verification:** no build/test run needed (no code change). The premise-check was a read-only recon against `main` (git / rg / cat); the findings below are re-verified against `096189c`, not carried over from a prior close-out.

---

## SHIPPED

**Nothing in code.** BC.4's premise — a stray `.optional()` in the `market.created` payload schema — was investigated and found **not to hold** on `main`; the schema is correct as-is. This is a no-op-with-writeup closing a stale tracker row. The only deliverable is this close-out.

---

## THE FINDING (verified against `main` @ `096189c`)

**1. No `.optional()` defect in the `market.created` payload schema** — `src/server/events/schemas.ts:183–196`:
- All four fields are **required (present)**: `marketId` (`.uuid()`), `resolutionDeadline` (`.datetime({ offset: true })`), `media` (`.array(...).min(1)` — at least one entry), `mediaVideoUrl` (`.string().nullable()`).
- `mediaVideoUrl` is `.nullable()` — **present-but-null by design** (null when the outbound YouTube link is unset), documented at the schema's "Required fields" note (lines 180–182: *"the sole emitter is `createMarket`, which always supplies them, and no read-side replay re-validates this schema — write-time only"*). `.nullable()` ≠ `.optional()`: the key is always present; only the value may be null. That is the correct encoding, not a defect.
- **Zero `.optional()`** anywhere in the events schema file (grep-confirmed).
- The emitter `createMarket` (`src/server/markets/create.ts:219`) always supplies all four fields (`mediaVideoUrl: normalizedVideoUrl`).

**2. The real drift was doc-only and already fixed at BC.2 Part C** (items 17 + 18): the `market.created` payload prose at **§3.8** (`SPEC.2.md:342`) and the **§19.4.1** dataset row (`SPEC.2.md:1981`) both carry `media[]` + `mediaVideoUrl` on `main` (verified verbatim). This was re-scoped from BC.4 → BC.2 as ledger item **7b**; the original ".optional() in code" framing is ledger-marked **"Superseded — no such code defect exists."**

**3. `market.created` test coverage present and green** — `tests/server/events/insert.test.ts`, `tests/server/admin/markets-media.test.ts`, `tests/server/admin/markets.test.ts` cover the payload incl. the MEDIA.1 `media[]` + `mediaVideoUrl` extension (create atomicity, exactly-one event, `mediaVideoUrl` null-when-omitted). From the BC.3 full-suite run (155 files / 1100 tests passed, 0 failed), the three skipped files were `identity/no-raw-uuid-in-urls`, `storage/_probe-r2-roundtrip`, `admin/moderation/act` — none `market.created`. Nothing red or skipped implies unfinished work.

---

## DISPOSITION

**BC.4 → done as no-op-with-writeup.** No code, no ADR, no schema change. Option-A review-before-merge does **not** engage (nothing to review); this doc-only close-out merges freely per the ratified posture.

---

## DEFERRED / LEDGERED (unchanged — NOT BC.4's to fix)

- **MEDIA.1 count-staleness residue — three instances** — the integration test's "recorded all 7" comment (~:329), the disjointness array's missing `adminMediaPutUrlPerIp` entry, and the "The 7 constructions" comment (~:247); plus `tests/unit/rate-limit-prefix.test.ts:13` "seven sites". All pre-existing (stale at 8 before BC.3), test-comment only. → **named doc-sync sweep.**
- **ADR-0015 §1 per-surface table + SPEC.1 §16.1 rows** still name the removed `RATE_LIMIT_PER_MARKET_PER_DAY` / `RATE_LIMIT_BURST_PER_MIN` constants. Doc-only. → **separate doc-reconciliation sweep** (SPEC.1 §16.1 is SPEC.1-owned per ADR-0018).

Neither is code-shaped; neither is BC.4's.

---

## PK-REFRESH

No code files changed — the PK-refresh set is **this close-out only.** Staged into `~/Desktop/zz-pk-refresh-BC.4/`, md5-verified from the `chore/bc4-log` committed blob (canonical from `main` once the PR merges).

| File | md5 on `main` | Source path | What changed |
|---|---|---|---|
| `BC.4-close-out.md` | _post-merge — self-referential; refresh from `main` after `chore/bc4-log` lands_ | `docs/logs/BC.4-close-out.md` | this log (no-op-with-writeup) |

---

## TRACKER

- **BC.4 → done** in `tracker_v15` (no-op-with-writeup).
- **Next backend task:** whatever `tracker_v15` sequences after BC.4. **`tracker_v15` is operator/web-maintained external HTML — not on disk**, so the repo cannot surface the next row; **web sequences the next BC/DC/DP row and opens it with a fresh premise-check.** The recurring BC-series lesson: verify the premise against live `main` before executing — BC.2 7b (doc-only, not code), BC.3 (blast-radius was four files, not three), and this BC.4 (no-op) all turned on premise-drift.

---

## Next session starts at

The next `tracker_v15`-sequenced row after BC.4 (web to name it) — opened with a read-only premise-check against `main` first.
