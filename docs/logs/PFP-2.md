# PFP-2 — session log

**Date:** 2026-08-31 · **Branch:** `feat/reach-1` (asset work only; no repo change landed) · **Plan:** `docs/plans/PFP-2.md`

## What landed

No commit yet beyond this log and the plan. The asset work landed in R2, not in the repo.

| Area | Result |
|---|---|
| `zugzwang-staging-pfp/v2/` | 1,079 objects uploaded and verified by ETag↔md5 — but this is the PRE-guard set; the guarded set is built locally and re-uploads once after operator review, so the prefix is written once more rather than three times |
| `zugzwang-staging-pfp/v1/` | untouched — not read, written or deleted |
| `docs/plans/PFP-2.md` | the builder change (`v1/` → `v2/`), awaiting sign-off |

## The defect, measured

All 1,079 objects are exactly 256×256, so this was never a dimension problem. The renders draw their *own* circle — a coloured disc, or a stroked ring, on a contrasting mat — and it does not coincide with the circle the app masks with (`AvatarImage`'s `rounded-full`, radius 128 about the frame centre). Over the 823 affected: the drawn circle has a median radius of 121.5 px and sits a median 6.2 px off centre, so the mask leaves a mat crescent of median 6.5 px, lopsided by twice the offset.

| Verdict | Count | Action |
|---|---|---|
| Drawn circle misses the mask | 823 | re-framed |
| Drawn circle already coincides | 47 | copied through |
| Full-bleed background, no drawn circle | 209 | copied through |

Cause: `~/asset-pipeline/convert_and_upload_pfp.py` on `spark-3100` took a fixed 256×256 centre-crop of 1280×720 renders (PFP-1 log). A centre-crop cannot know where the drawn disc sits.

## Decisions made

**The transform is a re-frame, not an edit.** One crop-and-scale per image: the square circumscribing the drawn badge, resized to 256x256 with Lanczos. The badge then has radius exactly 128 about the centre. Nothing is repainted.

**The crop is widened where the animal overflows its own badge.** Cropping to the badge pushes any overflow -- a paw, a tail, a pair of legs crossing the edge -- outside the mask, and cuts the animal. So the crop radius is the larger of the badge radius and the radius holding 99% of the subject's pixels, capped at 1.30x. 91 of the 823 widened, by a median 1.3%. What is left in those is a CONCENTRIC ring, and a uniform ring reads as a border where the lopsided crescent this pass exists to remove reads as a mistake. Without this guard the re-frame cut more of the animal than the original did in 204 images, up to 12.6% of `indigo-owl`.

**Corner-fill was built, measured and rejected.** Continuing the badge's edge colour outward past radius 128 would make the two rounded-*square* surfaces (profile 56 px, onboarding 128 px) full-bleed. Rendered side by side it visibly streaks: stretching a one-pixel anti-aliased rim outward by 30 px smears it radially. Crop-only leaves mat corners on those two surfaces, which reads as a sticker and looks correct. Crop-only shipped.

**Lanczos, not nearest-neighbour.** These are pixel art, so nearest was the obvious guess. Rendered at the sizes that actually ship (128 px and below, against a 256 px source) nearest produces uneven pixel-block widths at the ~1.05× median scale; Lanczos is cleaner and the encoded sizes are within 2%.

**The guards matter more than the transform.** The first detector mistook the *animal* for a badge on full-bleed images and would have zoomed into a cat's head. Every guard now rejects toward "leave it alone": a fitted circle must be ≥55 px, ≥92% filled by the badge region, circular to within 10 px, carry ≥22 step contrast across its boundary, and sit within 40 px of centre. A wrong crop is far worse than a ring that was already there.

**Published to `v2/`, not over `v1/`.** Objects carry `Cache-Control: public, max-age=31536000, immutable` on a public `r2.dev` host, so overwriting would leave stale avatars in browsers and at the edge for up to a year with no purge path. ADR-0011 and SPEC.2 §12.7:1310 both reserved `v2/` for exactly this. `v1/` staying in place is also the rollback.

Encoded at WebP q88/method 6: the 823 rewritten files go 3,909 KiB → 4,993 KiB (4,863 → 6,212 bytes average). Whole set 4,975 → 6,059 KiB. Lanczos turns flat pixel-art fills into slight gradients, which compress less well.

## How we know it works

Four checks, each closing a hole the one before it left open.

1. **Bytes.** Every one of the 1,079 keys HEAD'd back and its ETag compared against the md5 on disk. 1,079/1,079. Proves the upload, nothing about the pictures.
2. **Re-measure.** The detector re-run over its own output: 822 of 823 now read aligned, against 47 before. Weak on its own -- the fix used this code's numbers to choose the crop, so it is close to circular.
3. **An independent metric.** Sample the rim just inside the mask and ask how much of it disagrees with the rim's own dominant colour. This shares nothing with the fitting code; it only looks at pixels a viewer sees. Median off-colour rim 38.2% -> 3.1%, worst arc 119.5deg -> 2.5deg. **This is the check that caught the clipping**: it flagged 104 images the fit-based check had called aligned, which is what produced the guard above.
4. **A second independent metric, for the harm.** Share of the animal the mask cuts away, detected from pixels on both sets with one rule. Guarded result beats the ORIGINAL on both counts: images losing >5% of the animal 33 -> 0, losing >2% 115 -> 22, p95 4.82% -> 1.64%.

| | rim off-colour (med) | animal cut (p95) | losing >5% | losing >2% |
|---|---|---|---|---|
| original `v1/` | 38.19% | 4.82% | 33 | 115 |
| crop to badge | 3.06% | 2.67% | 8 | 68 |
| **crop + no-clip guard** | **3.06%** | **1.64%** | **0** | **22** |

None of the four is a human eye, which is the check that actually settles it. All 1,079 are published under the real mask at <https://claude.ai/code/artifact/fa445f4a-ffe7-4899-afbd-0d19c5457844> for the operator to scan and flag.


## Operator review, and a second defect the re-frame does not reach

The operator scanned all 1,079 under the real mask and flagged 89: 47 cat/dog variants to delete outright, 42 to study.

**The 42 are mostly not a framing fault.** 37 of them have the subject overflowing the mask, and 19 of those are cut *in the source file itself* — the animal runs into the edge of the 256x256 frame, because the 1280x720 render was centre-cropped to a square and the crop sliced it. Shrinking the picture cannot restore what is not in the file; it only moves the flat cut edge inward, which was measured and rejected on a prototype. Across the whole set, 129 of 1,079 carry that cut.

**So there are two defects, not one.** The first — the drawn circle missing the mask — is what this pass fixed, and it is fixed. The second — content sliced off by the upstream centre-crop — is untouched by anything done here and is not repairable from the WebP files. The repair for it is the 486 MB of original 1280x720 PNGs on `spark-3100`, re-cropped with the badge-fit this pass already computes. **That is a re-crop, not a re-render**, and it is worth being precise about: regeneration is only warranted where the render itself is poor, not where the crop lost pixels.

Failures cluster by ANIMAL, not by colour — butterfly 9 arms, starfish 4, zebra 4, seal 3, leopard 3 — because one source render is recoloured into thirteen. One bad render becomes thirteen bad avatars, and one good re-crop fixes thirteen.

**Corrections made in-session, recorded because each was asserted before it was checked.** Two attempts to prove statistically that the named colour lands on the background rather than the animal were both invalid — the first because the subject mask shifts between images, the second because it assumed the arms are pixel-aligned when the badge offset varies by ~6px. A third claimed 629 images had the animal cut, which was counting badges meeting the frame edge; the checked figure is 129. The visual comparison of six animals across all 13 arms does show butterfly, starfish, seal and leopard identical in every arm while zebra and giraffe recolour — but that is an observation over six animals, not a measured property of all 67.

## Deleting the flagged cat/dog variants

47 of the 234 Cat/Dog images. The obstacle is not R2, it is the variant map: `pfpFilenameFor` indexes variants densely as `pass % PFP_VARIANTS[animal]`, and `PFP_VARIANTS` is per-ANIMAL while the survivors are uneven per colour arm. `violet-cat` keeps 1 of 9; `orange-cat` keeps 7. Seven arms lose their `base` image, which is variant 0 -- the one the FIRST pass assigns. A single per-animal count would therefore have to fall to the minimum across arms: Cat 9 -> 1, discarding a hundred sound images.

Exposure on staging is small and was measured rather than assumed: of 1,070 `identity_pool` rows (220 assigned), 7 name a delete-list image and 1 is assigned; exactly 1 user holds one (`indigo-cat.webp`).


## Re-cropped from the source renders (spark-3100)

The Spark came online, and this is the repair the earlier passes could only approximate. `~/asset-pipeline/reframe_pfp.py` reads the same tree and writes the same filenames as the shipped converter, but replaces its `side = min(im.size)` centre-crop with a badge fit taken at full 1280x720 resolution. Two things follow from working on the source rather than the 256px WebP: the crop can sit where the artwork's circle actually is, and it can reach into the 280px down each side that the centre-crop discarded. 1,079 images in 110 seconds.

| | v1 on staging | webp-only re-frame | re-cropped from source |
|---|---|---|---|
| rim off-colour, median | 30.83% | 2.78% | **0.69%** |
| animal cut by the mask, median | 0.33% | 0.57% | **0.00%** |
| animal cut in the source frame | 129 | — | **72** |

867 fitted to the drawn badge, of which 220 take a square wider than the old 720 one -- those are the pictures getting pixels back. 212 keep the centre-crop unchanged. Of the operator's 42 non-cat/dog flags, images cut in source fell 19 -> 7 and the median off-colour rim 43.1% -> 11.1%; butterfly wingtips, koala ears, seal flippers, lobster claws, whale tail and hummingbird wings are whole for the first time.

**A branch was built, measured and deleted.** Where no badge is found, the obvious move is to frame the subject instead. It was written, and it helped nothing -- every picture rescued from a clipped subject came through the BADGE branch -- while damaging 64, because a vignetted background makes "not the mat" swallow the whole frame and the subject then shrinks into a mostly-invented padded square. Two rounds of guards (area fraction, reach cap, then a test for whether the old crop was cutting anything at all) each cut the damage without ever producing a gain, which is what settled it. Padding also changed from a flat mat fill to edge replication, because a flat fill seams visibly against any background that is not perfectly flat.

**Regeneration turned out not to be needed for the fit problem.** The renders were never wrong; the crop was. What still warrants a re-render is species legibility rather than framing -- the leopard reads as a tabby cat in all 13 arms, the macaw as a blue blob -- and that is a judgement about the artwork, not a measurement.

**Left on `spark-3100`:** `~/pfp-reframe-venv` (an isolated venv; the system Python is PEP-668 managed and was not touched), `~/asset-pipeline/reframe_pfp.py`, and `~/pfp_reframed/` holding the 1,079 outputs plus `report.jsonl`. The shipped `convert_and_upload_pfp.py` is unmodified.


## The strict pass, and a metric that was too blunt to see what it caught

The operator failed 21 images on a close look: "the border has hints of irregularity and white". Eight were silver arms and six violet, which was the clue -- a near-white mat leaves a near-white fringe, and a near-white fringe on a #181818 page is the loudest thing on the tile.

**The rim metric used up to this point could not see it.** It counted a rim pixel as off-colour only past a colour distance of 30; these fringes sit at 5-15. Re-measured at eye sensitivity -- worst deviation at the outermost visible ring, plus a separate term for how much BRIGHTER it is -- the set that was about to ship scored **worse than staging**: 151 clean rims against 187. The eye caught a regression the measurement had passed. Recorded plainly because the earlier "median rim 30.8% -> 0.7%" in this log is true only at the blunt threshold and is not the number that matters.

Three faults, each found by looking at the pixels rather than reasoning about them:

1. **The crop landed ON the badge edge, not inside it.** A badge's outermost pixels are anti-aliased against the mat, so stopping exactly at the fitted radius leaves that blend just inside the mask. Fixed by insetting -- and the amount is not one number: offered 2.5 / 6 / 10 / 14%, 545 of 1,079 chose deeper than 2.5%.
2. **Crops ran past the frame.** Radii of 387-416px in a frame only 720 tall meant `np.pad(mode="edge")` replicated a row containing the mat/badge boundary, smearing it outward as a notch at 12 o'clock. Fixed by never leaving the frame; nothing is padded, so every pixel shipped is one the render drew.
3. **196 faint badges were never detected.** The colour-match detector needs a flat mat; where the mat carries a gradient or the badge is a shade away from it, the tolerance swallows the badge (silver-toucan read as 93% badge, silver-raccoon as 8%). Added a detector that looks for the circular STEP instead, searching only the outer band -- the first attempt searched from the centre and found the animal's own silhouette every time, at half the right radius -- then fits a circle to the per-ray edge points. 141 rescued.

**The architecture changed as a result: the crop is chosen by measuring the outcome, not by guarding the inputs.** Each image renders every candidate -- four insets of the badge fit, plus the shipped centre-crop -- measures the rim on the rendered 256px result, and keeps the best. The centre-crop always being a candidate is what guarantees no image can ship worse framed than it is today. That replaced three rounds of threshold-guessing, each of which traded one set of images for another.

| | v1 on staging | final |
|---|---|---|
| rim deviation, median | 150.6 | **3.2** |
| brightness lift, median | 72.0 | **0.7** |
| clean rims | 187 / 1079 | **920 / 1079** |

Of the operator's 21, 16 are clean. Two of the rest are subject clipping rather than fringe (`silver-hummingbird`'s wing, `violet-koala`'s ears at the rim), two are faint rings the step detector still misses (`silver-raccoon`, `violet-dog-v2`), one is near-white throughout (`silver-flamingo`). One image regressed across the whole set: `rose-horse`.

## The cat/dog deletion, as shipped

The 47 flagged renders are gone. Every key still answers, because `pfpFilenameFor` indexes variants densely as `pass % PFP_VARIANTS[animal]` and a missing slot would 404: each deleted key now serves a surviving render from its own colour arm, cycling where an arm lost several. **The cost is stated rather than hidden** -- `violet-cat` kept 1 render of 9, so its nine slots are one image; `cerulean-cat`, `indigo-cat` and `magenta-cat` kept 3. Since number compositing was never built (PFP-1 open question 1), every `VioletCat###` already shares one image, so this widens an existing duplication rather than introducing a new kind.

**The alternative, not taken, is a per-arm variant map** in `vocabulary.ts` + `rotation.ts`, which would keep every surviving render distinct instead of cycling. It is a real change on a critical path and is worth doing if the duplication matters; it is not needed for correctness.


## Scale, which nothing had been scoring

A second strict pass named seven images as "overly zoomed in or out". They split into two causes, and only one of them was mine.

**Over-zoom (`cerulean-fox`, `green-fox`, `teal-fox`, `olive-owl`) was a defect I introduced.** All four were chosen by the step detector, which had found an edge at roughly half the badge radius -- the animal's own silhouette -- and cropped to it, filling the circle with an owl's face. The outer-band restriction added when that detector was written stopped it happening at 0.22 of the radius but not at 0.58, and nothing downstream could object, because the rim was immaculate.

**Under-zoom (`red-elephant`, `red-zebra`) was pre-existing and untouched.** Both kept the centre crop, so they are exactly what staging serves: a small animal adrift in a large badge. The selector had no reason to improve them, because it was scoring only the rim.

Both are the same omission: **a clean rim says nothing about how big the animal is.** Measured across the set, the animal's extent as a fraction of the mask radius runs from 0.58 to 1.35 with a median of 0.95 -- so avatars sitting side by side differed in apparent size by more than two to one. The score now carries a second term, `90 * |extent - 0.95|`, weighted so a 0.13 scale error costs about what the rim threshold does and neither goal can quietly overrule the other. Crops sized to the animal rather than to the badge were added as candidates, which is what lets an animal adrift in a large badge be brought up to scale -- the rim stays clean there because a crop inside the badge sees only its flat fill.

**The scoring loop also moved to the encoded result.** It had been measuring the in-memory image while what shipped was a re-encoded WebP; on a near-white gradient the encoder moves the metric by more than the margin some crops were winning by, which is how 18 images shipped worse than staging while the selector believed every one had improved. Candidates are now encoded, decoded and measured, and a new crop is adopted only if it beats the shipped centre-crop by a real margin.


## Where it landed, and two bugs the strict passes exposed

| | v1 on staging | final |
|---|---|---|
| mean combined rim+scale score | 338.3 | **35.4** |
| rim clean | 187 / 1079 | 923 / 1079 |
| rim deviation, median | 150.6 | 3.6 |
| animal extent, p05-p95 | 0.77 - 1.08 | 0.81 - 1.11 |
| off-scale by >0.15 | 133 | 98 |

888 images improve, 180 are unchanged, 11 differ only by the WebP re-encode (q88 against the original q82) on a crop that did not move. Nothing is worse framed than what staging serves.

**Bug 1: the "no worse than today" guarantee was not testing the same picture.** The claim rested on the shipped centre-crop always being a candidate. But that candidate was reconstructed from a half-pixel centre and a radius, giving a 719px box where `convert_and_upload_pfp.py` takes an integer 720px one -- a different resample phase, enough to move the rim on a near-white gradient. Four images that CHOSE `centre` still came out worse than what they replaced. Sound in principle, false in code.

**Bug 2, and it is the same shape twice.** A metric that returns *unmeasurable* for its worst cases, and scores that as zero, exempts precisely the images it exists to catch. The rim threshold of 30 could not see fringes at 5-15, and passed a set that was worse than staging. Then the scale metric could not separate the animal from the background on a crop zoomed in far enough to fill the frame -- so the over-zoomed crops were the ones paying no scale penalty. Both times the measurement was silent rather than wrong, and silence read as a pass. The scale penalty now takes the WORSE of two readings, measured and predicted, so neither can go quiet.

**A third correction, to this log's own reporting.** "Rim worse than staging: 14" was computed on rim deviation alone, ignoring the brightness term that is weighted 3x in the score and dominates on exactly those images. On the full score the figure is 11, and all 11 are re-encode noise on an unmoved crop. A summary statistic that drops a term of the thing it summarises is not a summary of it.

**What the operator's eye found that no measurement did:** the pale fringe (first pass) and the scale spread (second). Both were real, both were invisible to the checks in place at the time, and each was only caught because someone looked at 1,079 pictures. The metrics now cover both axes -- which is not the same as covering every axis.

## Open questions

1. **The upstream converter is unpatched.** `spark-3100` has been offline since 2026-08-30 (tailscale `100.74.9.117`, last seen 1 d). Re-running it reproduces the centre-crop. Extending the vocabulary needs either a re-frame pass after converting, or the badge-fit landed into that script.
2. **SPEC.2 §12.7:1311 claims anonymous GET is scoped to `v1/*`.** Measured 2026-08-31: `v2/` is anonymously readable, so public read is bucket-wide on the `pub-*.r2.dev` host. The other two requirements hold — anonymous list 404, anonymous write 401. The re-bake depends on the live behaviour, not the documented one.
3. **Two images are knowingly left unfixed.** `teal-zebra` and `silver-zebra` have a real but faint ring (edge contrast 21.2 and 20.1 against the 22 threshold). Lowering the threshold to catch them admits nothing else, but the defect is barely visible and the guard is worth more than the two.
4. **`prd` still has no PFP bucket** (PFP-1 open question 5, unchanged). This work is staging-only.

## Next session starts at

Get `docs/plans/PFP-2.md` signed off, then execute it: `v1/` → `v2/` in `pfp-url.ts`, the five assertions in `tests/unit/identity-pool/pfp-url.test.ts`, the key in `scripts/verify-identity-pool.ts`, the SPEC.2 §12.7 amendment and an ADR-0011 patch record — all one commit, per §5.12.

## Context to preserve

- **The subject rides with its badge.** Median 1.6 px residual between the subject's centre and its badge's centre across the 823. That is what makes a single geometric fix correct for both, and it is worth re-measuring before trusting the same transform on a future render batch.
- **`tests/unit/identity-pool/pfp-url.test.ts` pins the prefix in five places**, including a test *named* for `v1`. A prefix bump that only edits `pfp-url.ts` goes red there, which is the intended behaviour.
- **`scripts/verify-identity-pool.ts:94` HEADs `v1/${pfp_filename}`.** Left unchanged it would keep verifying the prefix nobody serves and pass while doing it.
- The analysis and re-framing scripts were deliberately not committed (operator call). The measurements above are the durable record.

## Time

~1h — bucket survey, two detector passes, the corner-fill and filter comparisons, upload and verification.
