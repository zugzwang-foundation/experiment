# PFP-2 — re-frame the PFPs and replace the `v1/` objects in place

**Status:** done, 2026-09-03 · **Branch:** `chore/pfp-2-plans-log` · **Critical path:** no code changed

## Result

`zugzwang-staging-pfp/v1/` now holds the re-framed images. 823 of the 1,079 objects were overwritten; the other 256 were already byte-identical and were left alone. All 1,079 keys under `v1/` now match their `v2/` twin by ETag, which for a single-part R2 object is the md5 of the bytes, so the two prefixes hold identical bytes under identical names. Six objects were then fetched over the public `pub-*.r2.dev` host with a cache-busting query string and their md5 compared against the same ETag — 6/6 matched, so the public host is serving the new bytes and not a cached copy.

No code changed. `pfp-url.ts` still composes `${R2_PUBLIC_URL_PFP}/v1/${pfp_filename}`, which is now correct rather than merely unchanged, so SPEC.2 §12.7 and ADR-0011 need no amendment either.

## Why

Most PFPs draw their own circle, and it did not coincide with the circle the app masks with. Measured over all 1,079 objects as they stood in `v1/`: 823 contained a coloured disc or a stroked ring whose radius was a median 121.5 px against the mask's 128, sitting a median 6.2 px off the frame centre. The mask therefore left a crescent of mat colour, thick on one side and thin on the other. That is what read as "the images are not lining up".

The cause is upstream of this repo. `~/asset-pipeline/convert_and_upload_pfp.py` on `spark-3100` took a fixed 256×256 centre-crop of each 1280×720 render (PFP-1 log, *Manifest provenance*). A centre-crop cannot know where the generated disc actually sits, so a disc drawn off-centre in the 16:9 frame stayed off-centre in the square.

## The transform

One crop-and-scale per image: take the square circumscribing the drawn badge and resize it to 256×256 with Lanczos, so the badge lands at radius exactly 128 about the frame centre. Nothing is repainted and the subject is never moved relative to its own badge — the picture is re-framed, not edited.

Worked through the median case: a badge of radius 121.5 px sitting 6.2 px off the frame centre in a 256×256 square. The square circumscribing it is 243 px on a side, so resizing that box back up to 256×256 scales by 256/243 = 1.053 and puts the badge at radius 121.5 × 1.053 = 128 about (128, 128) — which is the mask's circle. Concretely, `gold-lobster.webp` went from 7,392 B to 9,140 B across the swap (measured by fetching both prefixes over the public host); the growth is the resample enlarging the subject, not new content.

## How it was applied

A throwaway script ran four phases against the bucket, each one separately. Every copy is a server-side `CopyObject` inside the one bucket, so no image bytes crossed the operator's machine.

1. **Survey**, read-only. 1,079 objects under each prefix, name sets identical in both directions, 256 pairs already ETag-equal.
2. **Backup.** Every live `v1/` object copied to `v1-pre-pfp2/`; 1,079 written, 0 ETag mismatches. This is the rollback — an object swap has no commit to revert.
3. **Apply.** The 823 differing objects copied from `v2/` over `v1/`. The phase refuses to start unless every live `v1/` object has an ETag-matching backup.
4. **Verify.** The ETag and public-fetch comparison described under *Result*, plus `Content-Type: image/webp` and `Cache-Control: public, max-age=31536000, immutable` re-read off a sample of eight.

Both `v2/` and `v1-pre-pfp2/` are left in the bucket. Together they cost about 10 MiB and they are the only record of what was replaced.

## What this leaves open

1. **Anyone who already loaded a PFP keeps the old one for a year.** The objects carry `max-age=31536000, immutable` and `pub-*.r2.dev` offers no purge control, so a browser that has cached one will not revalidate. Only the team has loaded these; a hard reload fixes it. This is the reason the in-place route stops being available after the 15 Sep open.
2. **The upstream converter is unpatched.** Re-running `convert_and_upload_pfp.py` as it stands reproduces the centre-crop and the defect. Whoever next extends the vocabulary must re-frame after converting, or land the badge-fit into that script.
3. **SPEC.2 §12.7:1311 says the bucket policy allows anonymous GET on `v1/*` only.** Measured 2026-08-31: `v2/` is anonymously readable too, so public read is bucket-wide on the `pub-*.r2.dev` host rather than prefix-scoped. The other two requirements do hold — anonymous list returns 404, anonymous write returns 401. Recorded as spec-vs-live drift; it now also means `v1-pre-pfp2/` is publicly readable.
4. **Species legibility is untouched.** About 15 source renders read as the wrong animal — the leopard reads as a tabby cat across all 13 colour arms, the macaw as a blue blob. Re-framing cannot fix a render; that is a re-generation task.
