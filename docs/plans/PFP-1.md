# PFP-1 — real identity vocabulary, variant rotation, and the first real PFP on screen

**Status:** drafted, awaiting sign-off · **Critical path:** yes (`src/server/identity-pool/`) · **Date:** 2026-08-25

---

## Context

A user who signs up today is assigned a name like `RedLynx001` and a blank
`/pfp-placeholder.svg`. Both halves are wrong.

The name comes from `scripts/seed-identity-pool-dev.ts`, which hardcodes 20 colours ×
10 animals invented before any image existed. The image library that now exists on
`spark-3100` at `~/comfy/ComfyUI/output/pfp` uses a different vocabulary: 13 colours ×
67 animals. Only 7 of the 20 colours and 5 of the 10 animals overlap, and one entry in
the animal list — `Pine` — is not an animal. `RedLynx001` is a name for which no image
can ever exist, because there is no Red arm in the seeded vocabulary and no `Lynx`
render in Red outside the source set.

The second half is that nothing renders a PFP at all. `users.pfp_filename` is written
at signup by `consumeIdentityPoolTuple` and then read by nothing; six surfaces
hardcode the placeholder SVG. The R2 URL builder that SPEC.2 §12.7 describes was left
as a seam.

Outcome: a new profile gets a name drawn from the vocabulary the images actually use,
and renders the matching image from a staging R2 bucket.

### What the image library actually is

Measured on `spark-3100`, 2026-08-25 — 1,079 PNGs, 486 MB, every file 1280×720.

`~/pfp_recolor/recolor_batch.py` takes a **red source render** per animal and recolours
it into 12 targets via the ComfyUI API. So the grid is **13 colours**, not 12: Red plus
Orange, Gold, Olive, Green, Jade, Teal, Cerulean, Indigo, Violet, Magenta, Rose, Silver.
The Red arm is filed differently — the red originals sit loose in each animal directory
rather than in a `Red/` subfolder. That accounts for every file: 65 animals × 13 × 1,
plus Cat and Dog at 13 × 9 (they had 9 source poses each).

67 animals, `capybara` lowercase where every other entry is PascalCase.

### Two things ADR-0011 asks for that are not being built here

1. **Number compositing.** ADR-0011 line 17 requires the number painted onto the image
   by `asset-pipeline/composite_numbers.py`. That script does not exist, in the repo or
   on the Spark, and the renders carry no digits. **Deferred by operator decision.**
   Until it lands, `pfp_filename` is `<colour>-<animal>.webp` and every `GoldZebra###`
   shares one image. An ADR-0011 Patch record ships in the same commit recording this.
2. **Namespace size.** ADR-0011 sized 50 colours × 100 animals × 10 numbers = 50,000.
   Actual is 13 × 67 = 871 pairs. The 50k prod manifest is **out of scope** — it is a
   namespace decision, not a coding task.

---

## Work

### A · Vocabulary — one source, replacing five copies

New `src/server/identity-pool/vocabulary.ts` exporting `COLOURS` (13) and `ANIMALS` (67)
as `readonly` tuples, plus `PFP_VARIANTS` (the per-animal image count: 9 for Cat and
Dog, 1 otherwise). `capybara` → `Capybara`.

The lists are currently duplicated across `scripts/seed-identity-pool-dev.ts`,
`scripts/seed-staging.ts`, `tests/db/identity-pool/watermark.test.ts`,
`tests/db/identity-pool/seed.test.ts` and `tests/adversary/_harness/fixtures.ts`. All
five import from the new module instead. Six further files carry the old names in
fixtures and expected output and are updated to match:
`tests/db/identity-pool/_fixtures/manifest-100.csv` (36 rows),
`tests/unit/debate-export/_fixtures/{mumbai-metro.input.ts,mumbai-metro.expected.md}`,
`tests/integration/debate-export.integration.test.ts`,
`tests/server/admin/moderation/audit-view.test.ts`,
`tests/lifecycle-sim/market-playthrough.sim.test.ts`.

`docs/specs/debate-export.md` also carries an old pseudonym in a worked example — a §
citation edit, so it rides this commit per O-9.

### B · Rotation

**Rotation happens at seed time, not consume time.** `consume.ts` is untouched: it
already hands out FIFO by `created_at`, so the insertion order *is* the assignment
order. Generating tuples in grid order would hand the first 13 signups the same animal.

New `generatePoolTuples(count)` in `src/server/identity-pool/rotation.ts`, pure and
exhaustively testable:

- Walk the 871 pairs on **coprime strides** over both axes — colour index advances by
  1, animal index by a stride coprime to 67 — so consecutive tuples share neither
  colour nor animal, and the walk visits every pair once before repeating.
- **Variant index cycles within a pair**: the Nth time a pair is emitted, it takes
  variant `N mod PFP_VARIANTS[animal]`. For the 65 single-image animals that is always
  variant 0; Cat and Dog cycle through 9.
- `pfp_filename` = `<colour>-<animal>.webp` lowercased, or `<colour>-<animal>-v<N>.webp`
  for variant > 0. The `v` prefix keeps this axis unambiguous against the future
  `-<number>` segment from ADR-0011.
- Number component stays as it is today — sequential per pair, zero-padded to 3.

`scripts/seed-identity-pool-dev.ts` becomes a thin caller of this function.

### C · pfpUrl, end to end

New `src/server/identity-pool/pfp-url.ts`:

```
pfpUrl(pfpFilename: string | null): string
```

Returns `${R2_PUBLIC_URL_PFP}/v1/${pfpFilename}` per SPEC.2 §12.7 line 1308, and the
placeholder when `pfpFilename` is NULL — which is the scrubbed-row case the
`profile/resolve.ts` scrub contract already documents. Missing env falls back to the
placeholder rather than throwing: a broken avatar must not take down a profile page.

Six call sites replace their hardcoded constant: `src/server/profile/resolve.ts:41,72`,
`src/server/debate-view/resolve-authors.ts:27`, `src/server/discovery/hero.ts:35`,
`src/server/debate-view/load-debate-view.ts:46`,
`src/app/(auth)/onboarding/page.tsx:77`, `src/components/shell/IdentityCluster.tsx:49`.

⚠ **None of these read models currently SELECT `pfp_filename`** — they were written
against the placeholder. Each needs the column added to its query and threaded to its
DTO. That is the bulk of the diff and the part most likely to surprise.

`.env.example:94` says the frontend composes `/v1/${pseudonym}.webp`. That contradicts
SPEC.2 §12.7 and is corrected in this commit.

### D · Conversion and the R2 staging bucket

**Convert on the Spark** (PIL 10.2.0 is there; no ImageMagick, no rclone). New
`asset-pipeline/convert_pfp.py`, run on `spark-3100`, reading
`~/comfy/ComfyUI/output/pfp` **read-only** and writing a flat output dir:

- Centre-crop 1280×720 → 720×720, resize to **256×256** (ADR-0011's stated render size),
  encode webp.
- Treat loose animal-level PNGs as the **Red** arm.
- Emit `<colour>-<animal>.webp` / `<colour>-<animal>-v<N>.webp`, matching §B exactly.

All **1,079** images convert, ≈6.5 MB at 256px — inside the 10 MB budget, and complete
coverage means no assigned pseudonym can 404. There is no subsetting logic to write,
which is why the whole set is cheaper than a sample.

**Upload from the Spark directly — boto3 1.34.46 is already installed there**, so the
converted files never touch this machine. The same script does convert → `PutObject`
under `v1/` (`Content-Type: image/webp`, `Cache-Control: public, max-age=31536000,
immutable` per SPEC.2 §12.7 line 1306) → a `HeadObject` pass over every key it wrote,
exiting non-zero on any miss. Credentials arrive as env vars for the one run and are
never written to disk on the Spark.

This replaces the planned rsync + `scripts/upload-pfp.ts` pair: one script on one
machine, no 6.5 MB round trip, no second S3 client to keep in sync with `r2.ts`.

**Bucket, as it exists:** `zugzwang-staging-pfp`, account
`4ddce98b4a4cbc9146d4269f36b03f68`. Doppler config **`stg`**:

```
R2_ENDPOINT_PFP=https://4ddce98b4a4cbc9146d4269f36b03f68.r2.cloudflarestorage.com
R2_BUCKET_PFP=zugzwang-staging-pfp
R2_PUBLIC_URL_PFP=<the r2.dev public dev URL, once enabled>
R2_ACCESS_KEY_ID_PFP / R2_SECRET_ACCESS_KEY_PFP=<bucket-scoped token>
```

**No CORS rule is needed.** Avatars load via `<img src>`, which is not CORS-governed;
the rules only apply to fetch/XHR, canvas pixel reads and webfonts. Public read on
`v1/*` is the requirement — via the r2.dev dev URL or a bound custom domain.

---

## Tests

Written **first**, per CLAUDE.md §5.6.

| Test | Asserts |
|---|---|
| `tests/unit/identity-pool/vocabulary.test.ts` | 13 colours, 67 animals, all PascalCase single tokens, no duplicates, `PFP_VARIANTS` keys ⊆ ANIMALS |
| `tests/unit/identity-pool/rotation.test.ts` | consecutive tuples share neither colour nor animal; all 871 pairs visited before any repeat; variant cycles 0..8 for Cat/Dog and stays 0 elsewhere; `pfp_filename` shape; determinism across two calls |
| `tests/unit/identity-pool/pfp-url.test.ts` | NULL → placeholder; missing env → placeholder, no throw; else exact `v1/` URL |
| `tests/db/identity-pool/seed.test.ts` (update) | seeded rows carry the new vocabulary; `(colour, animal, number)` uniqueness holds across a full rotation |

The asset-coverage check that was planned here — a committed manifest of
converted filenames, compared against the vocabulary — was built and then
dropped at review: 1,079 lines of data to catch a mistake that only happens if
someone edits `vocabulary.ts` without re-rendering, which staging surfaces
anyway. The converter's HEAD pass over every uploaded key remains the real
proof, and it runs where it can actually see the bucket.

## Verification

1. `ZUGZWANG_ENV=preview just verify`
2. `pnpm test:invariants` + `just test-db` (critical path, §5.7)
3. `pnpm seed:identity-pool:dev` against a local DB, then read back the first 20 rows
   and confirm by eye that consecutive names differ in both axes
4. On the Spark: `python3 ~/asset-pipeline/convert_and_upload_pfp.py` with the R2 env
   vars injected — expect 1,079 conversions, 1,079 PUTs, 1,079 HEAD confirmations,
   exit 0
5. Sign up on staging and confirm the profile, debate and discovery surfaces all render
   the same real image rather than the silhouette

## Ritual

- Same commit: ADR-0011 **Patch record** (numbering deferred, `pfp_filename` shape,
  actual-vs-planned namespace), `.env.example:94` correction, `docs/specs/debate-export.md`
  example refresh
- `@db-migration-reviewer` — **not needed**, no schema or migration change
- `@code-reviewer` then `@security-auditor` — `src/server/` + critical path
- §5.10 pre-PR self-audit before `gh pr create`
- Session log at `docs/logs/PFP-1.md` before `/clear`

## Open

1. **No migration is needed** — `identity_pool` and `users.pfp_filename` already exist
   and no column changes shape. Worth confirming that matches your expectation.
2. `main` was 40 commits behind at session start and is now level; this branches off
   the merged state.
3. Subagent reviews are CLAUDE.md §5.11 obligations, but this session is configured not
   to spawn agents unless you ask. Say the word at PR time and I will run them.
