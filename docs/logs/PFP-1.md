# PFP-1 — session log

**Date:** 2026-08-25 · **Branch:** `feat/pfp-1` · **Plan:** `docs/plans/PFP-1.md`

## What landed

Identity vocabulary, seed-order rotation, and the first real PFP on screen.

| Area | Files |
|---|---|
| Vocabulary + rotation + URL builder | `src/server/identity-pool/{vocabulary,rotation,pfp-url}.ts` (new) |
| FIFO tiebreaker | `src/server/identity-pool/consume.ts` |
| Seeds | `scripts/seed-identity-pool-dev.ts`, `scripts/seed-staging.ts` |
| Read models | `src/server/profile/resolve.ts`, `src/server/debate-view/resolve-authors.ts` |
| Placeholder dedup | `src/server/discovery/hero.ts`, `src/server/debate-view/load-debate-view.ts` |
| Render sites | `(public)/layout.tsx`, `(auth)/layout.tsx`, `(auth)/onboarding/page.tsx`, `IdentityCluster.tsx` |
| Tests | `tests/unit/identity-pool/` (3 files, 30 tests, new) |
| Docs | ADR-0011 Patch record, `.env.example`, `docs/specs/debate-export.md` |

PR: not yet opened.

## Decisions made

**The vocabulary is 13 colours × 67 animals, and Red is one of the 13.** `~/pfp_recolor/recolor_batch.py` on `spark-3100` recolours a red source render into twelve targets, so Red is the base rather than an absence. Its originals sit loose at each animal directory root instead of in a `Red/` folder; the converter normalises that. The pre-PFP-1 lists (20 × 10) named 13 colours and 5 animals with no render at all, and one entry — `Pine` — that is not an animal.

**Rotation happens at seed time, not consume time.** `consumeIdentityPoolTuple` allocates FIFO by `created_at`, so insertion order *is* assignment order. `generatePoolTuples` walks `colour = i mod 13`, `animal = i mod 67`; 13 and 67 are coprime, so CRT gives every one of the 871 pairs exactly once per pass and consecutive tuples can never share either axis. `consume.ts` itself needed no change beyond an `id` tiebreaker.

**`pfp_filename` is pair-keyed, and that is a deferral.** ADR-0011 requires the number composited onto each image by `composite_numbers.py`, which was never written. Deferred by operator decision; recorded as an ADR-0011 Patch record rather than left implicit, because the ADR otherwise reads as describing a pipeline that exists.

**All 1,079 objects uploaded, not a sample.** The covering set for a single-pass pool is 871 (variant 0 only); the extra 208 are Cat/Dog variants reachable only on later passes. Sending everything cost 1.0 MiB more and removed the need for any subsetting logic or a seed restricted to uploaded animals.

## Manifest provenance

**Neither the converter nor its manifest is in this repo.** The converter lives on `spark-3100` at `~/asset-pipeline/convert_and_upload_pfp.py`, beside the 486 MB of renders it reads and the only machine it can run on. Its manifest was committed briefly and then dropped: a 1,079-line data file is a large thing to carry for a check that only fires when someone edits `vocabulary.ts` without re-rendering, and the converter's own HEAD pass over every key already proves the bucket at the moment it matters.
 
**What this gives up, stated plainly:** nothing in CI now notices if the vocabulary and the rendered set drift apart. The next person to add an animal must re-run the converter, or that animal's users get 404 avatars — and staging is where they will find out.

The upload run, recorded here because nothing in the repo attests to it any more:

| | |
|---|---|
| Host | `spark-3100` (aarch64, tailscale `100.74.9.117`) |
| Source | `~/comfy/ComfyUI/output/pfp`, read-only, 1,079 PNGs / 486 MB / all 1280×720 |
| Script | `~/asset-pipeline/convert_and_upload_pfp.py` on the Spark, 256×256 centre-crop → webp q82 |
| Bucket | `zugzwang-staging-pfp`, prefix `v1/`, account `4ddce98b…` |
| Result | `1079 objects uploaded and confirmed, 1.0 MiB`, exit 0 |
| Independent check | `GET .../v1/cerulean-alpaca.webp` → 200, `image/webp`, `Cache-Control: public, max-age=31536000, immutable`, decodes to a 256×256 cerulean alpaca |

The upload ran in two parts — interrupted at 845, resumed with `--skip-existing` for the remaining 234. The HEAD verification covers all 1,079 regardless of which run sent them.

## Open questions

1. **Number compositing is still owed** — `composite_numbers.py`, and with it the `<colour>-<animal>-<number>` slug ADR-0011 specifies. Until then every `GoldZebra###` shares one image.
2. **The namespace is 871 pairs against ADR-0011's planned 5,000.** Reaching 50,000 needs either more numbers per pair or more Flux runs. Out of scope here; it is a namespace decision.
3. **The prod 50k manifest for `scripts/seed-identity-pool.ts` is unwritten.** Deliberately out of scope.
4. **`R2_PUBLIC_URL_PFP` vs the spec's `R2_PFP_BASE_URL`.** SPEC.2 §12.7 line 1308 writes the variable one way; `.env.example` and Doppler `stg` hold the other. Recorded in `pfp-url.ts` rather than resolved — renaming a live secret to match prose is the more expensive mistake.
5. **`prd` has no PFP bucket configured.** Only `stg` was set up this session.

## Next session starts at

Open the PR for `feat/pfp-1`, then run `pnpm db:seed:staging` against staging and sign up a fresh user to confirm the assigned identity renders its real avatar on profile, debate, discovery and the header.

## Context to preserve

- **`next/image` needs `unoptimized` for any R2 URL.** `next.config.ts` has no `images.remotePatterns`, and the r2.dev host differs staging↔prod. Caught by `@code-reviewer` as CRITICAL: it cannot fail locally or in CI, because with `R2_PUBLIC_URL_PFP` unset `pfpUrl` returns the local placeholder, which `next/image` accepts. It would have 500'd the onboarding page the moment staging had the env var.
- **The C12 duplication is discharged.** `seed-staging.ts` copied the word lists verbatim because it could not import the dev seed without pulling `@/db` → `server-only`. The new modules are pure; tsx resolves the `@/` alias for them (verified before relying on it).
- **`created_at` alone is not a total order.** Both seeders insert row by row today, so each row gets its own timestamp. Batching either into one multi-row INSERT would stamp every row identically and silently collapse the rotation with no test going red. `consume.ts` now orders by `created_at, id`.
- The two `tests/unit/comments/foreclosure.test.ts` failures are `ECONNREFUSED 127.0.0.1:54322` — no local Postgres, unrelated to this work.
- `tests/adversary/` and `tests/lifecycle-sim/` are unrelated untracked WIP that already fail typecheck; excluded from every gate run here and deliberately not committed.

## Time

~2h, including the render-library survey, the R2 bucket wiring, and two reviewer passes.
