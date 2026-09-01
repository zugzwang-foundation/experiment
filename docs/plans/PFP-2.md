# PFP-2 — point the PFP URL builder at the re-framed `v2/` asset set

**Status:** awaiting sign-off · **Branch:** TBD · **Critical path:** yes — `src/server/identity-pool/` (CLAUDE.md §1)

## Why

Most PFPs draw their own circle, and it does not coincide with the circle the app masks with. Measured over all 1,079 objects in `zugzwang-staging-pfp/v1/`: 823 of them contain a coloured disc or a stroked ring whose radius is a median 121.5 px against the mask's 128, sitting a median 6.2 px off the frame centre. The mask therefore leaves a crescent of mat colour, thick on one side and thin on the other. That is what reads as "the images are not lining up".

The cause is upstream of this repo. `~/asset-pipeline/convert_and_upload_pfp.py` on `spark-3100` took a fixed 256×256 centre-crop of each 1280×720 render (PFP-1 log, *Manifest provenance*). A centre-crop cannot know where the generated disc actually sits, so a disc drawn off-centre in the 16:9 frame stays off-centre in the square.

## What is already done, outside this plan

The asset work is complete and needs no sign-off, because it is additive and inert. All 1,079 re-framed images are uploaded to `zugzwang-staging-pfp/v2/` and verified — every key HEAD'd back with its ETag compared against the md5 of the bytes on disk, 1,079/1,079 matching, `Content-Type: image/webp` and `Cache-Control: public, max-age=31536000, immutable` on every one. Nothing under `v1/` was read, written or deleted. Until the builder below changes, the product still serves `v1/` and nothing a participant sees has moved.

The transform is one crop-and-scale per image: take the square circumscribing the drawn badge and resize it to 256×256 with Lanczos, so the badge lands at radius exactly 128 about the frame centre. Nothing is repainted and the subject is never moved relative to its own badge — the picture is re-framed, not edited. 823 images were rewritten; the other 256 were copied through byte-for-byte and are byte-identical under `v2/`.

## Scope of the change

| File | Change |
|---|---|
| `src/server/identity-pool/pfp-url.ts` | `v1/` → `v2/` in the returned template, and the docblock sentence that names the prefix |
| `tests/unit/identity-pool/pfp-url.test.ts` | five assertions pinning `/v1/`, plus the test name "composes the v1-prefixed public URL" |
| `scripts/verify-identity-pool.ts` | `const key = ` v1/${pfpFilename}` ` → `v2/`, so the sampler HEADs the prefix actually served |
| `docs/specs/SPEC.2.md` §12.7 | lines 1309–1312 name `v1/` as the live prefix; amend in the same commit (§5.10 grep-verified) |
| `docs/adr/0011-pseudonym-pool-design.md` | add `## Patch record — PFP-2`, beside the existing PFP-1 record |

No schema, no migration, no handler, no transaction. The four invariants are untouched — a PFP URL is not a bet, a comment, a ledger row or a resolution.

## Verification

- `just verify` (with `ZUGZWANG_ENV=preview`, per AGENTS.md §2).
- `pnpm vitest run tests/unit/identity-pool/` — 30 tests, must stay green.
- `pnpm verify:identity-pool` against staging, which HEADs a deterministic sample of `v2/` keys.
- Sign up a fresh staging user and read the avatar on the four surfaces that render one: header (`IdentityCluster`, 24 px circle), debate (`ArgProfile`, 24 px circle), profile (`IdentityCard`, 56 px rounded square) and onboarding (128 px rounded square).

## Open risks

1. **The upstream converter is unpatched and unreachable.** `spark-3100` has been offline since 2026-08-30. Re-running `convert_and_upload_pfp.py` as it stands reproduces the centre-crop and the defect. Whoever next extends the vocabulary must re-frame after converting, or land the badge-fit into that script.
2. **SPEC.2 §12.7:1311 says the bucket policy allows anonymous GET on `v1/*` only.** Measured 2026-08-31: `v2/` is anonymously readable, so public read is bucket-wide on the `pub-*.r2.dev` host, not prefix-scoped. The other two requirements do hold — anonymous list returns 404, anonymous write returns 401. This is a spec-vs-live drift to record, and the re-bake depends on the live behaviour rather than the documented one.
3. **`v1/` is left in place.** It is the rollback: revert the builder and the old set is still served. Deleting it is a separate decision and is not proposed here.
