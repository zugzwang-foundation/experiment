# ADR-0011 — Pseudonym Pool Design (`PSEUDONYM.md`)

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-05-07 |
| **Deciders** | Hrishikesh Manoj Hundekari |
| **Tracker task** | SPEC.12 |
| **Frame document** | SPEC.2 §1.4 #5 (delegation: pseudonym pool word lists + asset pipeline owned here, not duplicated in SPEC.2), §5 (Data Model — `identity_pool` named in inventory), §23 (ADR Index) |
| **Supersedes** | — |
| **Superseded-by** | — |

---

## Context and Problem Statement

Every Zugzwang user is auto-assigned an identity pair at signup: a permanent pseudonym of the form `<Colour><Animal><Number>` (e.g., `RedFox001`) and a matching profile picture (PFP) depicting that animal in that colour with that number visibly composited onto the image. Per SPEC.1 §13 F-AUTH-3, the identity is auto-assigned, permanent, and consumed FIFO from a pre-populated `identity_pool` Postgres table; the user has no input, no preview-and-refresh, no choice. The product surface (asset shape, FIFO consumption, exhaustion handling, H2-scrub permanence) is locked. The *asset pipeline that pre-populates the pool* — word lists, prompt template, sampler configuration, compositing parameters, R2 layout, runbook — is not.

The forces at play:

- **Open-source publishing constraint.** The pipeline ships under AGPL-3.0 alongside the rest of the experiment repo. Word lists and pipeline scripts are public artefacts. Anyone can read them; anyone can audit what tuples exist and how PFPs are derived.
- **45-day-window scale.** Realistic experiment-scale signup volume is 1K–10K participants. The namespace must be sized with comfortable headroom, but extreme over-provisioning is wasted curation effort and Flux time.
- **Visual-identity payoff vs cost.** PFPs are the visual surface that distinguishes Zugzwang's debate view from text-only username walls (Manifold, Polymarket). The single biggest visual differentiator the experiment has. Investment in a coherent name-IS-the-image pipeline is justified; over-investment in unbounded namespace expansion is not.
- **Reproducibility constraint.** The pipeline must be re-runnable end-to-end. Pool extension, model-checkpoint upgrade, or aesthetic override must produce deterministic outputs. Re-running with the same inputs yields bit-exact same PFPs.
- **No runtime image generation (locked by SPEC.1 §13 F-AUTH-3 step 4).** PFPs are pre-generated and served from CDN; signup never invokes Flux at request-time. The pipeline runs once before launch; runtime consumes from a populated pool.
- **Pre-launch operational tunes are not architectural.** Compositing font, contrast rule, prompt template, and sampler parameters are operational/cosmetic decisions resolved during the pipeline build. They do not earn architectural ratification — but the *mechanisms* that govern them (deterministic seed derivation, reproducibility discipline, override procedure) are architectural and lock here.

This ADR resolves the asset pipeline architecture, namespace shape, word-list curation rules, seed-derivation discipline, R2 storage layout, pool-extension procedure, and the supporting acceptance-test surface for v1. Specific operational parameters (font, contrast rule, locked prompt template, locked sampler params) are deferred to the SCAFFOLD.17 pipeline-build pass and the UI/UX design pass per `PSEUDONYM.md` §13.

This ADR does **not** decide:

- Bucket B classification of `identity_pool` (`assigned_at` whitelisted `NULL → timestamp` transition) and the trigger SQL that enforces it — locked by ADR-0005.
- Cloudflare R2 as the object-store vendor + jurisdiction `APAC` — locked by ADR-0006.
- `pg_cron` as the cadence engine for the identity-pool low-watermark check — locked by ADR-0006 §7 cron inventory.
- Sentry alarm wiring for the identity-pool low-watermark threshold breach — locked by ADR-0007 §4 alarm catalogue (alarm 5).
- Drizzle ORM as the migration tool + per-domain schema split convention (`src/db/schema/<domain>.ts`) — locked by ADR-0008. Specific domain-file boundary for `identity_pool` is owned by SCAFFOLD.2.
- F-AUTH-3 product flow body (FIFO consumption, single transaction with `assigned_at = now()`, 503 `identity_pool_exhausted` error code, permanence rule) — locked by SPEC.1 §13 F-AUTH-3.
- F-AUTH-4 stale-unaccepted-user 30-day daily admin sweep that returns the linked tuple to the pool — locked by SPEC.1 §13 F-AUTH-4 edge cases.
- H2-scrub mechanism that retires tuples permanently (does NOT return them to the unassigned pool) — locked by SPEC.1 §13 F-AUTH-3 *Permanence and H2 scrub interaction* + §16.3 transparency-by-design model.
- Specific R2 bucket-policy JSON (CORS rules, signed-URL TTL values for the `zugzwang-uploads` bucket, IAM role configuration) — owned by SCAFFOLD.15. This ADR mints the *requirements* the policy must satisfy; SCAFFOLD.15 authors the JSON.
- Number-tuning of the 5%-unassigned alarm threshold — already locked at 5% by SPEC.1 §13 F-AUTH-3 + §15.2 widget #2; not a tunable.
- Localisation of word lists (multi-script, locale-specific pseudonym variants) — not in v1 scope; deferred operationally per `PSEUDONYM.md` §1.

## Decision Drivers

1. **Visual-identity coherence.** The pseudonym is the description of the image. The pipeline must produce images where the colour and animal in the name match what the viewer sees. A `RedFox001` user must get a fox that reads as red.
2. **Reproducibility.** Re-running the pipeline (for pool extension, model upgrade, or aesthetic override) must produce deterministic outputs. Every input — prompt, sampler, seed, model checkpoint — is pinned and version-controlled.
3. **Build-time efficiency.** The pipeline must run end-to-end on a single DGX Spark workstation in a working day, not a working week. Flux generation is the dominant cost; the design must minimise unnecessary Flux work.
4. **Cheap scaling headroom.** Extending the namespace beyond 50K must be operationally simple — no new word-list curation, no new model-load, no architectural change. The pipeline must support pool extension without revisiting word-list curation.
5. **Curation feasibility for a solo operator.** Word-list curation is a manual judgement task. 50 colours + 100 animals is the curation surface a solo operator can audit thoroughly in hours; 100 + 500 (the alternative considered) is a weekend.
6. **Visual distinguishability at 256×256.** PFPs render at small sizes throughout the product. Word lists must be curated against Flux's actual rendering capability at the target resolution — closely-related shades and obscure species fail legibility.
7. **No runtime generation invariant.** SPEC.1 §13 F-AUTH-3 step 4 locks "PFP is served from an object store via CDN at a stable URL... No runtime image generation." The pipeline must produce a finite pre-baked asset set; the `identity_pool` table contains every legal `(colour, animal, number)` tuple that will ever exist at v1.
8. **Operational tune deferral.** Pre-launch tunes (font, contrast, locked prompt phrasing) are properly resolved when the operator runs the pipeline and inspects outputs — not at architectural design time. The ADR locks the mechanisms; the pipeline build locks the parameters.

## Considered Options

1. **Curated word lists (50 colours × 100 animals × 10 numbers per pair = 50K), Flux-generated base images + deterministic number compositing, R2-served immutable PFPs** ← chosen
2. Curated word lists (100 colours × 500 animals × 1 number per pair = 50K), Flux-generated per-pseudonym images
3. Procedural SVG mascots (geometric shapes + open-licensed icon library), no AI generation
4. Single-icon-per-animal + colour overlay rendered at runtime, no pre-baked PFPs
5. Drop PFPs entirely, name-only pseudonyms
6. Random number selection per pair (no deterministic derivation)
7. Sequential numbers per pair (00–09 for every pair)

## Decision Outcome

**Chosen: Option 1 — Curated word lists (50 × 100 × 10 = 50K), Flux-generated base images + deterministic number compositing, R2-served immutable PFPs.**

### Namespace shape

50 colours × 100 animals = 5,000 unique `(colour, animal)` pairs. Each pair is the subject of one Flux generation. Each generated base image is composited with 10 deterministically-selected number variants from the 000–999 range, yielding 50,000 unique pseudonyms. Total Flux GPU time: ~3.5h on DGX Spark at the SPEC.1-named 2.6 sec/image rate. Total compositing wall-clock: minutes. Total namespace: 50,000 with comfortable headroom over the realistic 1K–10K experiment-scale signup volume.

### Three-digit zero-padded numbers

Pseudonym shape is `<Colour><Animal>NNN` with `NNN` in the range 000–999. Resolves the SPEC.1 internal contradiction between F-AUTH-3 examples (`RedFox072`, `BlueWolf008` — three-digit) and the asset pipeline subsection ("Numbers: `00`–`99` zero-padded" — two-digit). SPEC.1 v1.4.0-draft fixes the contradiction in line with this ADR.

### Word-list curation

Word lists ship as plain `.txt` files at `experiment/asset-pipeline/colours.txt` and `experiment/asset-pipeline/animals.txt`, one entry per line, alphabetically-sorted at build time for deterministic bulk-INSERT order. Curation rules per `PSEUDONYM.md` §1.1 (colours) and §1.2 (animals): single PascalCase tokens; no slurs or violent/sexual connotations; no mythological creatures; light-touch brand-collision sweep (drop obvious matches, no gating loop); recognisability + Flux-render-legibility bias for animals; visual-distinguishability bias for colours.

### Deterministic number selection per pair

10 numbers per `(colour, animal)` pair are derived deterministically from `hash(colour + ":" + animal + ":" + version_tag + ":" + model_checkpoint_hash)` via a deterministic PRNG over the 000–999 range. Properties: reproducible (re-running produces same numbers), visually varied (numbers spread across the range, not clustered), pool-extension collision-free (extending to 20 numbers per pair draws the *next* 10 PRNG outputs after the first 10).

### Per-pair seed derivation for Flux

Same seed-derivation function applied at the Flux sampler level. Each `(colour, animal)` pair produces a bit-exact reproducible Flux output. Re-running the pipeline yields identical PFPs unless `version_tag` or `model_checkpoint_hash` changes. Aesthetic override is a `version_tag` bump for the affected pairs only, recorded in `experiment/asset-pipeline/seed_overrides.json` (operational state, not committed at v1.0-draft).

### ComfyUI workflow as version-controlled artefact

The exact ComfyUI node graph is committed at `experiment/asset-pipeline/comfyui-workflow.json`. Pinned model checkpoint hash + sampler parameters + prompt template substitution all live in the workflow file. Any change to the workflow is a commit; any commit to the workflow file requires a corresponding `version_tag` bump in `PSEUDONYM.md` §3.

### Number compositing — deterministic post-processing, no AI

Numbers are painted onto Flux outputs by a Pillow-based Python script at `experiment/asset-pipeline/composite_numbers.py`. Pixel-deterministic; no randomness, no anti-aliasing variation, no font-rendering drift. Numbers are never generated by Flux (per `PSEUDONYM.md` §7). This guarantees legibility (Flux often produces malformed digits), consistency (font + size + position locked across the namespace), and reproducibility (re-compositing with same inputs is bit-exact).

### Pre-flight gating discipline

Two gates separate iteration from production:

- **20-pair sample-render gate (cheap iteration).** Before the production Flux run, the operator generates a 5-colour × 4-animal sample to evaluate prompt phrasing, sampler choice, species legibility at 256×256, and colour faithfulness. Iterations on the sample are cheap (~minutes); the operator iterates until the sample passes acceptance.
- **100-image pre-flight test (full pipeline verification).** Before bulk-INSERT into the production `identity_pool` table, the operator runs a 10-colour × 10-animal × 1-number sample end-to-end (Flux + composite + R2 upload to staging prefix + Postgres bulk INSERT to staging table). Verifies the entire pipeline plumbing works under realistic conditions.

Production run only proceeds on a clean pre-flight.

### R2 storage layout

PFPs land in the `zugzwang-pfp` R2 bucket (per ADR-0006 §4) under the `v1/` prefix. Object metadata set explicitly: `Content-Type: image/webp` and `Cache-Control: public, max-age=31536000, immutable`. The `v1/` prefix lets future regenerations land at `v2/` without overwriting. Bucket-policy *requirements* minted here: public-read on `v1/*`, no anonymous list permission, no anonymous write permission. SCAFFOLD.15 authors the JSON policy that meets these requirements.

### Pool extension via numbers, not word lists

Capacity-driven pool extension widens the per-pair number-variant count (10 → 20, etc.), drawing the next deterministic-PRNG outputs without overlap. Skips the Flux phase entirely. ~1.5h total wall-clock for 50K → 100K extension. Word-list extension is reserved for diversity-driven changes only; it does not retroactively rename existing users (per SPEC.1 §13 F-AUTH-3 word-list-changes-mid-experiment clause).

### Hardware

DGX Spark only for v1. Pipeline portability is not committed; operationally runnable on any CUDA host capable of Flux.1 12B FP4, but the v1 build runs on DGX Spark exclusively.

### Acceptance test additions to SPEC.1 §17

Three new rows added to the `auth::pseudonym-` family:

| Test ID | Verifies |
|---|---|
| `auth::pseudonym-pool-extension-deterministic-no-collision` | Re-running the deterministic-PRNG with widened per-pair count produces no overlap with already-assigned numbers. |
| `auth::pseudonym-scrubbed-tuple-not-returned-to-pool` | H2-scrubbed tuples are permanently retired (not re-added to the unassigned pool). |
| `auth::pseudonym-pfp-served-from-r2-not-runtime-generated` | PFPs are served from CDN-cached R2 URLs at request-time; signup does not invoke runtime image generation. |

The five existing pseudonym tests (`auth::pseudonym-auto-assigned-permanent`, `pfp-coherent-with-name`, `pool-fifo-selection`, `pool-no-double-assignment-under-concurrency`, `pool-exhaustion-503`) remain unchanged.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Pipeline architecture, word-list curation rules, seed-derivation, runbook, pool-extension procedure | `experiment/docs/specs/PSEUDONYM.md` |
| Architectural rationale | `experiment/docs/adr/0011-pseudonym-pool-design.md` (this ADR) |
| Colour list | `experiment/asset-pipeline/colours.txt` |
| Animal list | `experiment/asset-pipeline/animals.txt` |
| ComfyUI node graph | `experiment/asset-pipeline/comfyui-workflow.json` |
| Number-compositing script | `experiment/asset-pipeline/composite_numbers.py` |
| Compositing font (when locked) | `experiment/asset-pipeline/fonts/<font>.ttf` |
| Aesthetic override map (operational state) | `experiment/asset-pipeline/seed_overrides.json` (uncommitted at v1.0-draft) |
| R2 bucket-policy JSON | SCAFFOLD.15 territory (this ADR mints requirements only) |
| `identity_pool` Drizzle schema | `src/db/schema/<domain>.ts` per ADR-0008 (specific domain file owned by SCAFFOLD.2) |
| `identity_pool` Bucket B append-only trigger SQL | `drizzle/migrations/<NNNN>_append_only_triggers.sql` per ADR-0005 |
| Identity-pool low-watermark `pg_cron` job | `drizzle/migrations/<NNNN>_pg_cron_jobs.sql` per ADR-0006 |
| Identity-pool low-watermark Sentry alarm | Per ADR-0007 §4 alarm 5 |

## Consequences

### Positive

- **Visual identity is the differentiator.** Coherent name-IS-the-image PFPs across the namespace make the debate view scannable in a way text-only walls (Manifold, Polymarket) cannot match. The Devcon Mumbai conclusion-event presentation surface gains meaningfully from the visual quality.
- **Reproducibility is total.** Every PFP is a deterministic function of `(colour, animal, number, version_tag, model_checkpoint_hash)`. Anyone with the repo can re-run the pipeline and verify outputs. Aesthetic overrides are version-tracked, not magic.
- **Cheap scaling headroom is preserved.** 50K namespace with realistic ceiling at 1K–10K signups is comfortable; doubling-via-numbers takes ~1.5h. Word-list curation cost is paid once.
- **Curation surface stays solo-operable.** 50 colours + 100 animals = ~150 entries to audit. A solo operator can run this curation thoroughly in hours, not weekends.
- **Pre-flight gating cuts iteration cost.** The 20-pair sample-render lets prompt + sampler iteration run at minutes-per-cycle, not hours. Production-run failure modes are caught before the 3.5h Flux job commits.
- **No runtime generation invariant holds end-to-end.** Pipeline runs once pre-launch; runtime consumes from a populated pool. Vendor outage of any AI dependency (Flux, Hugging Face) cannot impact signup.
- **Operational alarms are wired.** Low-watermark Sentry alarm + pg_cron job + admin hub widget #2 give the operator three independent signals for pool exhaustion, with hours of lead time before 503s start firing.

### Negative

- **DGX Spark hardware dependency for the build.** Pipeline is not portable-tested. *Mitigated by:* the dependency is build-time only, not runtime; PFPs are R2-served once generated. *Acceptable because:* the build runs once pre-launch on Hrishikesh's existing hardware.
- **Word-list curation requires manual judgement.** Brand-collision filter, slur filter, recognisability filter, Flux-legibility filter — each is a human call. *Mitigated by:* light-touch brand-collision sweep (no gating loop), defined acceptance criteria for each filter, sample-render gate catches Flux-legibility failures. *Acceptable because:* the curation is one-time; the lists ship with the repo and don't require ongoing review.
- **Scrubbed tuples shrink the effective pool over time.** H2 scrubs permanently retire `(colour, animal, number)` tuples; effective namespace decreases. *Mitigated by:* sized into the 50K headroom (per SPEC.1 F-AUTH-3 *Permanence and H2 scrub interaction*); pool-extension procedure recovers any capacity loss. *Acceptable because:* avoids the worse failure mode of a future user inheriting a scrubbed user's name.
- **Pre-launch operational tunes are TBD at v1.0-draft.** Font, contrast rule, locked prompt template, locked sampler params are placeholders. *Mitigated by:* `PSEUDONYM.md` §13 tracks the deferral; SCAFFOLD.17 is the resolution venue; the ADR mechanism for change is a v1.x.0-draft change-log row + version bump (not a new ADR). *Acceptable because:* these are operational/cosmetic, not architectural — they cannot affect any ratified invariant or cross-table contract.
- **Flux output quality varies across pairs.** Some `(colour, animal)` pairs render with weak colour signal (Flux drifts toward species-natural colour) or marginal species legibility. *Mitigated by:* sample-render iteration on prompt phrasing during SCAFFOLD.17; aesthetic override mechanism via `version_tag` bump for outliers. *Acceptable because:* pseudonyms are not required to be biologically accurate.
- **Pipeline re-run cost is real.** A model-checkpoint upgrade or major aesthetic override regenerates ~5,000 Flux images at ~3.5h GPU. Not free. *Mitigated by:* override-by-pair limits regeneration scope to affected pairs only; full re-run is reserved for major changes.

### Neutral

- **AGPL-3.0 applies to word lists.** `colours.txt` and `animals.txt` ship under the repo's default license. No carve-out, no separate licensing concern.
- **Latin-script-only at v1.** Localisation deferred operationally; not a §19 open question. Re-engaged when (and if) multi-locale support enters scope, which it does not in the experiment phase.
- **No fallback-vendor commitment for Flux.** If Flux availability changes, the override mechanism + version_tag give the operator a path to a successor model, but no ADR commits to one in v1.

## Pros and Cons of the Options

### Option 1 — 50 × 100 × 10 = 50K, Flux base + deterministic compositing (chosen)

**Pros**
- Number-multiplier reuses each Flux generation 10×; minimal Flux work for the namespace size.
- Word lists stay curatable (~150 entries) for a solo operator.
- Cheap doubling path preserved (10 → 20 numbers per pair = 100K, no new Flux).
- Curation filters favour recognisability and visual distinguishability; namespace is legible end-to-end.
- Compositing-after-Flux guarantees number legibility and consistency across all 50K.

**Cons**
- DGX Spark dependency for the ~3.5h build. (Mitigated as above.)
- Some Flux pairs render with weak colour signal. (Mitigated by override mechanism.)

### Option 2 — 100 × 500 × 1 = 50K, per-pseudonym Flux generation

**Pros**
- Higher absolute namespace via word-list breadth.

**Cons**
- 50,000 Flux generations vs 5,000 — ~36h GPU vs ~3.5h. 10× build cost.
- 600-entry curation surface — weekend-grade for a solo operator vs hours-grade.
- 500 animals exhausts the well-known-species set (~150 mammals + birds avg readers recognise) and runs into obscure species (`Tarsier`, `Pangolin`, `Numbat`) that evoke no mental image.
- 100 colours hits visual-distinguishability ceiling — `Vermillion` vs `Crimson` vs `Cardinal` vs `Scarlet` indistinguishable at 256×256.
- No cheap-doubling path — extending capacity requires more Flux work, more curation.
- 5% Flux failure rate at 50K = 2,500 regenerations vs 250 — ops burden 10×.

**Verdict:** Rejected. Pays 10× the build cost for a *worse* user experience (obscure species, indistinguishable colour shades) and forecloses the cheap-doubling path.

### Option 3 — Procedural SVG mascots (no AI)

**Pros**
- ~1–2 day build cost vs ~6–8 days for the Flux pipeline.
- No GPU dependency, no model-checkpoint pinning, no sample-render gate.
- Trivially scales to arbitrary namespace sizes; no Flux-failure regenerations.

**Cons**
- Visual quality meaningfully lower than Flux-generated bespoke imagery. Procedural SVGs read as iconography, not as illustrated mascots.
- Loses the brand differentiator. "The prediction market with hand-illustrated coloured-animal mascots" is a defensible position; "the prediction market with geometric SVG icons" is not.
- Devcon Mumbai conclusion-event presentation surface degrades — debate-view screenshots lose their primary visual hook.

**Verdict:** Rejected. The build-cost saving (~5 days) is small relative to the visual-quality loss; the brand differentiator is worth the investment.

### Option 4 — Single-icon-per-animal + colour overlay at runtime

**Pros**
- Lowest build cost (~0.5d).
- No pre-baked asset pipeline at all.

**Cons**
- Violates SPEC.1 §13 F-AUTH-3 step 4 ("No runtime image generation") — would require a SPEC.1 amendment.
- Lowest visual quality of the SVG options — single-shape-per-animal with colour as a CSS fill reads as functional iconography only.
- No reuse of brand differentiator argument (already worse than Option 3).

**Verdict:** Rejected. The SPEC.1 amendment alone is reason enough; the visual-quality cost compounds it.

### Option 5 — Drop PFPs entirely, name-only

**Pros**
- Zero asset-pipeline build cost.
- One fewer ADR, one fewer SCAFFOLD task (SCAFFOLD.17 deletable).

**Cons**
- Loses the visual differentiator entirely. Debate view becomes a wall of text-pseudonyms — visually worse than Manifold (which has Google profile photos).
- Devcon Mumbai conclusion-event presentation surface degrades meaningfully.
- Requires SPEC.1 §13 F-AUTH-3 amendment to remove the PFP-half of the identity pair.

**Verdict:** Rejected. Build-cost saving is real but not worth the brand-positioning + presentation-surface loss for a 7-week experiment whose conclusion event drives the headline.

### Option 6 — Random number selection per pair (no deterministic derivation)

**Pros**
- Looks varied across the namespace.

**Cons**
- Re-running the pipeline produces different numbers each run — pool extension creates collisions with already-assigned tuples.
- Aesthetic override requires re-deriving the entire mapping; can't be scoped per-pair.
- Auditability fails — third parties cannot reproduce the pipeline outputs from the public repo.

**Verdict:** Rejected. Reproducibility is a hard requirement (Decision Driver 2); randomness fails it categorically.

### Option 7 — Sequential numbers per pair (00–09 for every pair)

**Pros**
- Trivially simple to implement.
- Reproducible.

**Cons**
- Visually monotonous — every animal reads as `RedFox001`, `RedFox002`, …, `RedFox010`. Aggregate distribution clusters at the low end of 000–999.
- No room for visual variety within a pair; pseudonyms feel mechanical.

**Verdict:** Rejected. Reproducibility solved, but visual variety lost — and the deterministic-PRNG approach gives both.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| SPEC.1 §13 F-AUTH-3 | Pseudonym + PFP product flow | Consumes: FIFO pool consumption, single-transaction `assigned_at = now()`, 503 `identity_pool_exhausted` error code, permanence + non-editability rules, "no runtime image generation" invariant. |
| SPEC.1 §13 F-AUTH-3 *Asset pipeline subsection* | Pre-launch pipeline shape | Mints: word-list curation rules, deterministic seed-derivation algorithm, ComfyUI workflow location, compositing-after-Flux discipline, R2 layout, pre-flight gating, pool-extension procedure. Resolves SPEC.1 internal contradiction (two-digit vs three-digit numbers) in favour of three-digit. |
| SPEC.1 §13 F-AUTH-3 *Namespace sizing* | 50,000 v1 namespace | Consumes: namespace lock at 50K. Mints: cheap-doubling-via-numbers path to 100K. |
| SPEC.1 §13 F-AUTH-3 *Asset pool exhaustion* | 5%-unassigned alarm + admin pool extension | Consumes: 5% threshold (not a tunable). Mints: pool-extension procedure (numbers-first; word-list-extension reserved for diversity-driven changes only). |
| SPEC.1 §13 F-AUTH-3 *Permanence and H2 scrub interaction* | Scrubbed tuples permanently retired | Consumes: scrubbed-tuple-not-returned-to-pool rule. Mints: corresponding acceptance test row. |
| SPEC.1 §13 F-AUTH-4 edge cases | Stale-unaccepted-user 30-day sweep | Consumes: stale-sweep returns linked tuple to pool (no architectural change here). |
| SPEC.1 §16.4 | `identity_pool` row schema + operational visibility | Consumes: schema columns (`colour, animal, number, pfp_filename, assigned_at`), admin-only operational view classification. |
| SPEC.1 §17 | Acceptance test catalogue | Mints: three new test rows (`auth::pseudonym-pool-extension-deterministic-no-collision`, `auth::pseudonym-scrubbed-tuple-not-returned-to-pool`, `auth::pseudonym-pfp-served-from-r2-not-runtime-generated`). |
| SPEC.1 §19 Q15 | ADR-PSEUDONYM open question | Closes: Q15 flips to ✅ Closed 2026-05-07 with locked word-list shape, pipeline parameters, and seed-derivation algorithm. |
| SPEC.2 §1.4 #5 | Delegation: pseudonym pool word lists + asset pipeline → ADR-0011 | Consumes: delegation. |
| SPEC.2 §5 | Table inventory — `identity_pool` named | Consumes: inventory entry. Shapes: row classification per ADR-0005 Bucket B (consumed from ADR-0005, not minted here). |
| SPEC.2 §23 | ADR Index entry for ADR-0011 | Mints: status flip from outline-stub to `accepted` with date 2026-05-07. |
| ADR-0005 | Bucket B classification of `identity_pool` (whitelisted `assigned_at` transition) | Consumes: classification + trigger SQL location. |
| ADR-0006 §4 | Cloudflare R2 jurisdiction APAC; `zugzwang-pfp` bucket | Consumes: vendor + bucket. |
| ADR-0006 §7 | `pg_cron` for identity-pool low-watermark check | Consumes: cadence engine + job location. |
| ADR-0007 §4 | Sentry alarm 5 (identity-pool low-watermark) | Consumes: alarm wiring. |
| ADR-0008 | Drizzle per-domain schema split convention | Consumes: convention. Specific domain-file boundary deferred to SCAFFOLD.2. |
| Tracker | SCAFFOLD.17 (Identity-pool generation pipeline), SCAFFOLD.15 (R2 storage + signed-URL endpoint) | All depend on this ADR being `accepted` before pipeline build proceeds. |

## More Information

- SPEC.1 §13 F-AUTH-3 (full body, asset pipeline subsection, namespace sizing, pool exhaustion, permanence + scrub interaction).
- SPEC.1 §16.4 `identity_pool` row schema.
- SPEC.1 §17 acceptance test catalogue.
- ADR-0009 + `RANKING.md` (precedent for ADR + companion-spec pairing under AGPL-3.0).
- ComfyUI documentation for workflow JSON shape.
- Flux.1 12B FP4 model card on HuggingFace (commit-hash pinning).

---

*ADR-0011 ratifies the pseudonym + PFP asset pipeline as 50 colours × 100 animals × 10 deterministically-selected number variants per pair = 50,000 namespace, with three-digit zero-padded numbers, Flux.1 12B FP4 base-image generation + Pillow-based deterministic number compositing, R2-served immutable PFPs at the `v1/` prefix, deterministic seed-derivation including `version_tag` and `model_checkpoint_hash` for reproducibility and override, and a pre-flight-gated runbook with cheap-doubling-via-numbers as the preferred pool-extension path. The decision body and the file-map subsection are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
