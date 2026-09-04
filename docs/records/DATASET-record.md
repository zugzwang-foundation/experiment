# DATASET — record

**Generated** 2026-09-03 from `origin/main` @ `ead741577b89849560ab3d3222a48b2a69bf18b7` · **Regenerate** per `docs/records/README.md`
**Covers** the two exports — the per-debate `.md` file a reader can take away today, and the public dataset the whole experiment exists to publish.

## 1 · What this lane is

Zugzwang is an experiment, and an experiment's output is its data. On **2026-11-06**, the day
after the write-freeze, the full archive — markets, bets, comments, the Dharma ledger — is
released as a public dataset. That release is the deliverable; everything else in this
repository exists to produce something worth releasing.

There are two exports and they are not the same thing. The **debate export** ships today: any
market's argument tree can be downloaded as a single Markdown file, with a version-pinned
explainer prepended so a reader — or a language model — can interpret it without further
context. It is the AI-mode button on `/m/[slug]`.

The **dataset export** is the archive. It pseudonymises, strips, packages and ships a tarball
with a manifest, behind a guard layer whose job is to make it impossible for anything that
should not leave to leave. ⛔ **It is not on `main`.** It exists as an open pull request, and
the distinction matters more here than anywhere else in this repository: the single artifact
the experiment is for is, today, unmerged.

## 2 · Feature table

### 2.1 · On `main` — the debate export

| Feature | Status | Code | Spec | ADR | Proved by | Open |
|---|---|---|---|---|---|---|
| `GET /m/[slug]/export` — read-only, uncached | SHIPPED | `src/app/(public)/m/[slug]/export/route.ts` | SPEC.1 §21.3 | 0025 | `tests/integration/debate-export.integration.test.ts` | — |
| Markdown serializer | SHIPPED | `src/server/debate-export/serialize.ts` (399 lines) | `docs/specs/debate-export.md` | 0025 | `tests/unit/debate-export/serialize.test.ts` + `_fixtures/` | — |
| Market metadata block | SHIPPED | `src/server/debate-export/market-meta.ts` (90 lines) | `docs/specs/debate-export.md` | 0025 | `tests/unit/debate-export/serialize.test.ts` | — |
| Version-pinned context preamble | SHIPPED | `src/server/debate-export/context.ts` (19 lines) → `public/zugzwang.md` (139 lines) | SPEC.1 §21.3 | 0025 | `tests/integration/debate-export.integration.test.ts` | — |
| Masking inherited, never re-implemented | SHIPPED | export reads through `loadDebateView` | SPEC.1 §15 | 0025 | `tests/integration/debate-export.integration.test.ts` | — |
| Build-trace inclusion for the route | SHIPPED | `next.config.ts` `outputFileTracingIncludes` (`public/zugzwang.md`) | — | — | none | — |
| **AI-mode button** | SHIPPED | `src/components/debate/MarketHeader.tsx` | SPEC.1 §21.3 | 0025 | `tests/unit/debate/render/` | — |

### 2.2 · NOT on `main` — the dataset pipeline (open PR **#435**)

⛔ **Every row below is in `feat/dataset-1-export-pipeline`, not in the tree this record was
generated from.** Verified: `ls -d src/server/export` → **ABSENT**, against the positive
control `ls -d src/server/debate-export` → **present**. And `grep -rilE '\begress\b' src/` →
**empty**, against `grep -rlE '\bexport\b' src/server/` → **132 files**.

⚠ **The unbounded form of that second grep is a false positive and is recorded so nobody
repeats it:** `grep -ril egress src/` returns **17 files**, every one of them matching the
substring inside **"regression"**. Word-bound it.

| Feature | Status | Code (on the branch) | Proved by (on the branch) |
|---|---|---|---|
| Dataset build orchestration | NOT ON `main` | `src/server/export/dataset/build.ts` | `tests/unit/export/dataset/build.test.ts` |
| Pseudonymisation | NOT ON `main` | `src/server/export/dataset/pseudonymize.ts` | ⚠ **none by name** — no `pseudonymize.test.ts` in the PR's file list |
| Field stripping | NOT ON `main` | `src/server/export/dataset/strip.ts` | — |
| Removed-content handling | NOT ON `main` | `src/server/export/dataset/removed.ts` | — |
| CSV writer | NOT ON `main` | `src/server/export/dataset/csv.ts` | — |
| Debate bundle | NOT ON `main` | `src/server/export/dataset/debates.ts` | — |
| Tarball | NOT ON `main` | `src/server/export/dataset/tar.ts` | — |
| Inventory + manifest | NOT ON `main` | `src/server/export/dataset/inventory.ts`, `src/app/api/dataset/manifest/route.ts` | `tests/server/dataset/manifest-route.test.ts` |
| Source readers | NOT ON `main` | `src/server/export/dataset/{source,drizzle-source}.ts` | `tests/integration/dataset-paging-reconciliation.integration.test.ts` |
| Treatments | NOT ON `main` | `src/server/export/dataset/treatments.ts` | — |
| **Egress guard layer** | NOT ON `main` | `src/server/export/egress/{index,scan,assertions,completeness,forbidden-keys,errors}.ts` | **five on the branch** — `tests/unit/export/egress/{assertions,completeness,contract-gap-strip-rules,payload-ship-schema-parity,registry-parity}.test.ts` |
| CLI entry point | NOT ON `main` | `scripts/build-dataset.ts` | `tests/integration/dataset-build-script.integration.test.ts` |
| **Round-trip proof** | NOT ON `main` | — | `tests/integration/dataset-roundtrip.integration.test.ts` |

**PR #435 — measured:** `state=OPEN`, base `main`, **57 files**, `ci=SUCCESS`, Vercel
`SUCCESS`. Its title carries the retired `⛔ LEAVE UNMERGED` marker.

## 3 · Coverage, stated honestly

The brief for this record asks for coverage *"what has a test, what has a round-trip proof,
what has neither"*. Answered per surface, and the columns are not the same claim:

| Surface | On `main` | Has a test | Has a **round-trip** proof | Reading |
|---|:-:|:-:|:-:|---|
| Debate `.md` export | ✅ | ✅ `serialize.test.ts` + `debate-export.integration.test.ts` | ⚠ **no** | The integration test exercises the route and the masking. **Nothing parses the emitted Markdown back into a structure and compares it to the source** — the serializer is proved to produce *a* document, not a *lossless* one |
| Context preamble | ✅ | ✅ | n/a | it is a static file prepended verbatim; correctness is byte-identity |
| Dataset build | ⛔ | ✅ on the branch | ✅ `dataset-roundtrip.integration.test.ts` on the branch | **the round-trip exists and is not merged** |
| Paging reconciliation | ⛔ | ✅ on the branch | ✅ | a paged read reconciles against the source |
| Manifest route | ⛔ | ✅ on the branch | n/a | |
| **Pseudonymisation** | ⛔ | ⚠ **no test file bears its name** | ⛔ no | the PR adds no `pseudonymize.test.ts`. Its correctness rides on `build.test.ts`, the round-trip, and the egress suite |
| **Egress guard (6 files)** | ⛔ | ✅ **five tests** — `assertions`, `completeness`, `contract-gap-strip-rules`, `payload-ship-schema-parity`, `registry-parity` | ⛔ no | **two are name-matched to their modules.** The PR carries **18** `tests/unit/export/**` files in all, including `removed-masking.test.ts` and `needle-provenance.test.ts` |
| Release runbook | ✅ (126 lines) | n/a | n/a | never exercised |

⚠ **One row deserves to be read twice, and it is narrower than it first looks.** The
**pseudonymiser** has no test file bearing its name — `gh pr view 435 --json files` lists no
`pseudonymize.test.ts`. That is a statement about the file list; it is **not** a claim that the
behaviour is unexercised, since `build.test.ts`, the round-trip and the egress suite may cover
it transitively.

⛔ **The egress guard is NOT in that position, and an earlier draft of this record said it
was.** The PR carries **five** `tests/unit/export/egress/*.test.ts` files, two of them
name-matched to the modules the draft called untested, inside **18** `tests/unit/export/**`
tests in total. That draft finding was wrong and would have sent a reader to close a gap that
does not exist — recorded here rather than silently corrected, because a false blocker in a
blocker list costs more than a missing one.

### 3.1 · What the debate export actually emits

The format is normative in `docs/specs/debate-export.md` (324 lines) and is **pointed at, not
restated**. Its shape, for a reader deciding whether the artifact answers their question:

| Block | Spec § | Contents |
|---|---|---|
| 1 | §4 | YAML front matter |
| 2 | §5 | the context block — `public/zugzwang.md`, prepended **verbatim** |
| 3 | §6 | summary + contents |
| 4 | §7 | the debate: market header (§7a), **normative ordering** (§7b), post nodes (§7c), depth-1 reply nodes (§7d) |

⚠ **§7b's ordering is normative**, which is what makes the artifact reproducible: two exports
of the same market at the same moment are byte-comparable, and a diff between exports at
different moments is a diff in the debate rather than in the serializer.

## 4 · Invariants and guards this lane carries

| Guard | Where | What it protects |
|---|---|---|
| **Removed content is never exported** | the export reads through `loadDebateView`, so masking is inherited rather than re-implemented (ADR-0025) | a moderator's removal survives into the artifact |
| **The export is never cached** | ADR-0025. `src/app/(public)/m/[slug]/export/route.ts:7` imports `loadDebateView` **directly** — not `getCachedDebateView` — and `:20`/`:26` state why: the cached view *"must"* be absent from this route's call path, because *"each request re-runs `loadDebateView`, which re-reads the `content_removed` set"*. The sibling page route records the same rule at `page.tsx:91` | a viewer-scoped, masked document cannot be served to the wrong viewer |
| Context block is **version-pinned and static** | `public/zugzwang.md`, prepended verbatim | the explainer cannot drift from the format it explains |
| Text-only, single file | ADR-0025 | no images, no attachments, nothing that could carry a payload out |
| Build-trace inclusion | `next.config.ts` `outputFileTracingIncludes` | the preamble file exists at runtime on the serverless function |
| **Freeze before export** | `system_state.frozen_at`, `src/server/system/is-frozen.ts` | the archive is taken from a database nobody is still writing to |

⚠ **`K_eff` has no in-product surface, by refusal** (CLAUDE.md §3). It is derived **post hoc**
from the released dataset. That is why this lane is the only place the experiment's headline
result can come from, and why the dataset's completeness is the thing that matters most.

## 5 · Work history

| Unit | PR | Merge SHA | Date | What landed |
|---|---|---|---|---|
| EXPORT.1 | #180 | — | 2026-06-29 | the debate `.md` export (ADR-0025) |
| EXPORT.1 log | #181 | `af4a909` | 2026-06-29 | `docs/logs/EXPORT.1.md` |
| **AIMODE-1** | **#466** | `e193cfb` | **2026-09-03** | the export becomes the AI-mode button; SPEC.1 §21.3 amended |
| **DATASET.1 / .2 / .3** | **#435 — OPEN** | — | — | the pipeline, the egress layer, the runbook, three logs and two plans. **57 files, `ci=SUCCESS`, unmerged** |

⛔ **The dataset lane's logs are inside the unmerged PR.** `docs/logs/DATASET-{1,2,3}.md` and
`docs/plans/DATASET-{1,3}.md` are in #435's file list and are **not** on `main`. Until it
merges, the lane has no repository record at all — no plan, no log, no code.

⚠ **`docs/runbooks/dataset-release.md` on `main` is 126 lines (md5 `a9335aa5d311030ca3cfad1b82b7281e`)
and PR #435 modifies it.** The version a reader finds today is not the version the pipeline
will ship against.

## 6 · The release, as the runbook schedules it

`docs/runbooks/dataset-release.md` is the operative document and is **pointed at, not
restated**. Its five phases and their clock:

| Phase | When |
|---|---|
| Pre-release | **2026-11-05 17:00 UTC** — six hours before the write-freeze |
| At write-freeze | **2026-11-05 23:59 UTC** |
| Pre-export | **2026-11-06 morning** |
| Release | 2026-11-06 |
| Post-release | after |

⛔ **This runbook has never been exercised.** No dry run is recorded anywhere in `docs/logs/`,
and the pipeline it drives is not merged.

## 7 · Known-open

| Pointer | What |
|---|---|
| `docs/STATE.md` §4 · `F-15` | **the dataset pipeline is unmerged** — PR #435, 57 files, `ci=SUCCESS`, base `main`, carrying the retired `⛔ LEAVE UNMERGED` marker |
| `docs/STATE.md` §4 · `F-16` | the pseudonymiser has no test file bearing its name in #435's list — **the egress guard does, five of them** |
| `docs/STATE.md` §4 · `F-17` | the debate `.md` export has no round-trip proof — nothing parses the emitted Markdown back |
| `docs/STATE.md` §4 · `F-2` | the production database is empty; an archive taken from it today would be empty too |
| `docs/runbooks/dataset-release.md` | never exercised; #435 modifies it |
| CLAUDE.md §3 | `K_eff` has no in-product surface — derived post hoc from this dataset only |
