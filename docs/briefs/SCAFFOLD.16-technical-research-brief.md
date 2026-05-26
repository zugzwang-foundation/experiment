# SCAFFOLD.16 Technical Brief: Production OpenAI Omni‑Moderation Patterns

**Scope:** Practical implementation guidance for a pre‑commit, multimodal moderation pipeline using `omni-moderation-2024-09-26` in a Next.js / Node.js / TypeScript stack, with a caller‑side auto‑ban contract and a Track A (auto‑ban) / Track B (review queue) verdict shape. Five topics: (1) modality carve‑outs, (2) omni‑moderation operational gotchas, (3) caller‑side verdict contract design, (4) test fixture patterns, (5) Track A false‑positive mitigation inside a single‑call architecture.

> **Operator decision at brief-drafting close (2026-05-25):** SCAFFOLD.16 scope held to the plan-mode brief — Track A gate on `imageR2Key` presence (boolean check, no score floor), no verdict-shape additions, no retry-policy expansion. Research-backed Stage 1 recommendations (R-1/R-2/R-3 below) parked in `docs/parked.md` as post-experiment hardening candidates. See §"Operator scope decision" at end of brief.

## TL;DR

- SCAFFOLD.16's decision to gate Track A (auto‑ban) on `imageR2Key` presence is correct and structurally inevitable: per OpenAI's own docs, **`sexual/minors` is a text‑only category on `omni-moderation-2024-09-26`**, so a `sexual/minors === true` verdict can only have come from the comment text. Routing text-only signals to Track B mirrors Bluesky (1,154 manually-reviewed NCMEC reports in 2024), Roblox Sentinel (recall-over-precision, all flags route to ex-FBI/CIA reviewers), and Reddit (CSAM removal is hash-driven with human verification before NCMEC).
- The single biggest correctness improvement to the existing implementation is **expanding retry semantics from 1 retry / 3s timeout to 2 retries / 5s timeout with explicit handling of OpenAI's `invalid_image_url` error**, which surfaces R2→OpenAI transient image-fetch failures that the current 3s budget will see as terminal. **(R-3 — deferred per operator scope decision.)**
- The verdict contract should grow three audit-defensibility fields — `triggeringModalities`, `rawScores`, and `modelSnapshot` — but should **not** add a `shouldAutoBan` boolean; `outcome === 'track_a'` already encodes that, and a parallel boolean creates drift risk. **(R-2 — deferred per operator scope decision.)**

---

## Key Findings

1. **The model's modality asymmetry validates the carve-out at the API level.** `sexual/minors` cannot be triggered by an image; only by text. SCAFFOLD.16's `imageR2Key` gate is not a policy nuance, it's policy aligned to a hard model capability boundary.
2. **The existing retry budget (1 retry, 3s/attempt) is empirically thin** given OpenAI's server-side `image_url` fetch already consumes 2–3s in the failure case. (Recommendation deferred to post-experiment per operator scope decision.)
3. **`omni-moderation-2024-09-26` is rate-limit-bound earlier than developers expect.** Free/Tier 1 caps at 250 RPM / 10,000 RPD / 10,000 TPM; the 10,000 RPD limit effectively throttles a Tier 1 deployment to ~6.94 RPM, far below the 250 RPM headline. Tier 2 raises this to 500 RPM and 20,000 TPM with no daily cap.
4. **Industry consensus across DTSP, Bluesky, Roblox, and Reddit is: text-only CSAM-adjacent signals route to specialized human review regardless of score.** Probabilistic text classifiers are explicitly distinguished from hash-match (PhotoDNA/Safer) in the DTSP best-practices framework.
5. **The dominant moderation-client contract pattern is "scores out, action up to caller."** Hive, OpenAI, and (effectively) Bluesky's Labeler model all decline to return a `should_block` field. Sightengine's Workflows is the only common counter-example, and it does so only by pre-registering policy server-side.
6. **`vi.mock` at the module boundary with `vi.hoisted`** is the idiomatic Vitest pattern (and SCAFFOLD.16's existing approach); the production-grade upgrade is a typed fixture factory plus one MSW-based HTTP-shape integration test. (Production-grade upgrade deferred to post-experiment per operator scope decision.)
7. **Defense-in-depth inside the verdict mapper** = combining the boolean category flag with a calibrated score floor, a category-combination AND requirement, modality attribution from `category_applied_input_types`, and (staged) an account-age signal. (All deferred to post-experiment per operator scope decision — SCAFFOLD.16 ships boolean-only Track A gate.)

---

## Details

### 1. Text-vs-image modality carve-out in moderation pipelines

#### Empirical findings

- **`omni-moderation-2024-09-26` is structurally asymmetric across modalities.** Per OpenAI's documentation, image inputs are supported only for `violence`, `violence/graphic`, `sexual`, `self-harm` (including `intent`/`instructions`), and `hate`. Critically, **`sexual/minors` is text-only** at the model level. The docs state: *"Categories marked as 'Text only' do not support image inputs. If you send only images (without accompanying text) to the omni-moderation-latest model, it will return a score of 0 for these unsupported categories."* (https://platform.openai.com/docs/guides/moderation). A `sexual/minors === true` verdict can therefore *only* be derived from the text. SCAFFOLD.16's `imageR2Key`-gated carve-out is in direct alignment with what the classifier can actually attribute.

- **Bluesky's pipeline is the closest public analog to SCAFFOLD.16's two-track model.** Bluesky's head of Trust & Safety, Aaron Rodericks, on the well-publicized "9,000-year-old dragon" case, told Platformer: *"I still have to throw humans at a huge chunk of the problems because there's all the gray-area content that we have to deal with. We're trying to go above what the legal requirements are… And that requires a huge amount of humans, automation, and tooling."* (https://www.platformer.news/bluesky-growth-content-moderation-trust-safety-interview/). Bluesky's 2024 Moderation Report quantifies the workload: *"In 2024, Bluesky submitted 1,154 reports for confirmed CSAM to the National Centre for Missing and Exploited Children (NCMEC). Reports consist of the account details, along with manually reviewed media by one of our specialized child safety moderators."* (https://bsky.social/about/blog/01-17-2025-moderation-2024).

- **Roblox's Sentinel system explicitly prefers recall over precision and routes everything to human specialists.** From Roblox's open-source release authored by Naren Koneru (VP Engineering, Safety) and Eleonore Vonck (Aug 7, 2025): *"Trained analysts, typically former CIA or FBI agents and other experts, review cases that Sentinel flags as potentially violative."* The release adds operational scale figures: *"In the first half of 2025, 35% of the cases we've detected are due to this proactive approach, in many cases catching them before an abuse report could be filed,"* and *"Sentinel helped our team to submit approximately 1,200 reports of potential attempts at child exploitation to the National Center for Missing and Exploited Children,"* across a platform of *"more than 111 million users"* sending *"an average of 6.1 billion chat messages"* daily (https://about.roblox.com/newsroom/2025/08/open-sourcing-roblox-sentinel-preemptive-risk-detection).

- **DTSP's industry best-practices paper** (Discord, Google, Meta, Reddit, TikTok, Microsoft co-authors; https://dtspartnership.org/wp-content/uploads/2024/09/DTSP_Best-Practices-for-AI-Automation-in-Trust-Safety.pdf) is explicit: *"For complex abuse types, content that is not clearly illegal or violative of a product or service's policies, or instances where a model has a lower confidence level, AI and automation may be utilized to route and prioritize the content for human review."* Text-only CSAM signals are squarely "complex abuse" because of the news/fiction/education false-positive vectors SCAFFOLD.16 calls out.

#### Recommended pattern for SCAFFOLD.16 (experiment-phase scope)

- **Keep the single-call multimodal request.** Splitting into separate text and image calls doubles latency, doubles rate-limit exposure, and loses the joint caption+image signal.
- **Use a boolean `imageR2Key` presence gate.** Per operator decision, no score floor, no category combination requirement, no `category_applied_input_types` inspection. The simplest possible carve-out: `if (categories['sexual/minors'] === true && imageR2Key) → track_a, else if (categories['sexual/minors'] === true) → track_b, else if (any other flagged) → track_b, else → pass`.
- **For the post-experiment hardening pass (parked in `docs/parked.md`):** consider strengthening the predicate to require `categories['sexual'] === true AND scores['sexual/minors'] >= 0.5 AND category_applied_input_types['sexual/minors'].length > 0` for Track A. Three concurrent signals reduce the false-positive base rate. **Not in SCAFFOLD.16 scope.**

#### Anti-patterns

- **Auto-banning on text-only signal for CSAM-adjacent categories.** No public production pipeline does this. Bluesky, Roblox, and Reddit all route to specialized human moderators even for the CSAM verdict before suspension; Roblox explicitly prioritizes recall.
- **Hardcoding the modality carve-out in policy comments only.** The "Track A requires image presence" rule should be a unit-tested branch with assertion, not an implicit convention. (Implemented in SCAFFOLD.16 via `precommit-moderate::text-only-sexual-minors-routes-track-b`.)

---

### 2. OpenAI omni-moderation operational gotchas in production

#### Empirical findings

- **Score calibration is real but recalibration is on the roadmap.** OpenAI's documentation states: *"We plan to continuously upgrade the moderation endpoint's underlying model. Therefore, custom policies that rely on category_scores may need recalibration over time."* (https://platform.openai.com/docs/guides/moderation). Pinning to the dated snapshot `omni-moderation-2024-09-26` (which SCAFFOLD.16 does) is the only way to get score stability across deploys.

- **The `image_url` payload is fetched server-side by OpenAI.** Multiple production reports in the OpenAI Developer Community describe identical fetch-error semantics for the vision and moderation endpoints. The canonical error from the same fetcher is *"Timeout while downloading {{s3_signed_url}}"* with `code: "invalid_image_url"` and HTTP 400 (https://community.openai.com/t/timeout-error-while-accessing-image-url-hosted-on-aws-s3-via-signed-url/997762). The user reports the failure returns within ~2 seconds — implying OpenAI's internal fetch timeout is tight. Implications for a 60s signed R2 URL:
  - 60s expiry is fine in absolute terms; OpenAI's fetch fails within seconds, not minutes.
  - The dominant failure mode is *transient connectivity*, not URL expiry.

- **Rate limits scale by tier and are surprisingly tight at Tier 1.** Per OpenAI's documented limits and corroborated in OpenAI Developer Community discussions, the free / Tier 1 caps are **250 RPM, 10,000 RPD, 10,000 TPM** for omni-moderation (https://community.openai.com/t/rate-limits-for-omni-moderation-based-on-tier/1377984). One developer in that thread observed: *"I appear to be running into a specific rate limit for 10,000 requests per day which is only about 6.94 requests per minute. I need about 10x that amount."* That puts the effective Tier 1 ceiling at ~6.94 RPM, an order of magnitude under the 250 RPM headline. Tier 2 removes the daily cap and offers **500 RPM and 20,000 TPM**.

- **Image moderation has known asymmetric category coverage.** GitHub issue openai/openai-node#1497 reports an image with hateful symbols + porn imagery returning `hate: 0` and not flagging sexual content. Maintainer Robert Craigie acknowledged this is server-side, not SDK: *"This sounds like an issue with the underlying OpenAI API and not the SDK."* (https://github.com/openai/openai-node/issues/1497). Pragmatic interpretation: do not rely on image classification to catch text-in-image hate. Track A's image gate is conservative *for* this reason; image false negatives are common, image false positives for `sexual` (the primary image-capable category relevant to minors) are rarer.

#### Recommended pattern for SCAFFOLD.16 (experiment-phase scope)

- **Retain existing retry policy (1 retry, 3s timeout).** Operator decision: keep simple, ship fast. The Tier 1 rate-limit ceiling (~6.94 RPM effective) is well above expected experiment-phase load (50K images / 7 weeks ≈ 0.5/min average); rate-limit pressure is not a concern.
- **Snapshot pin and category-score drift.** Pinning to `omni-moderation-2024-09-26` (already done) is correct.
- **For the post-experiment hardening pass:** consider expanding retry to 2 retries / 5s timeout with explicit `invalid_image_url` handling. **R-3, parked.**

#### Anti-patterns

- **Trusting the `flagged` boolean for routing.** It is a union of many categories with OpenAI-internal thresholds you do not control. SCAFFOLD.16 reads `categories[X] === true` per-category, not `flagged`.

---

### 3. Caller-side auto-ban contract patterns

#### Empirical findings

- **The dominant industry pattern is "scores out, action up to caller."** Hive's documentation is unusually blunt: *"Hive APIs do not remove your content or ban users itself. Rather, the Hive API will return classification metrics from our models… You can then decide what actions to take based on your sensitivity and content policies."* (https://docs.thehive.ai/docs/visual-moderation-api).

- **OpenAI's moderation response is itself shaped this way.** `{ flagged, categories, category_scores, category_applied_input_types }` — no action field. The caller owns policy.

#### Recommended pattern for SCAFFOLD.16 (experiment-phase scope)

- **Retain existing verdict shape `{ outcome, categories }`.** Operator decision: no shape additions. The caller (future F-COMMENT-3 in DEBATE.2 etc.) discriminates on `outcome === 'track_a'` for auto-ban; the `categories` array provides reason context for the `mod_actions` audit row.
- **Do not add `shouldAutoBan` boolean.** It is already encoded in `outcome === 'track_a'`. A parallel boolean creates drift risk.
- **For the post-experiment hardening pass:** consider additive expansion to include `triggeringModalities`, `rawScores`, `modelSnapshot`, `moderationCallMs` for audit defensibility. **R-2, parked.**

#### Anti-patterns

- **Returning the raw OpenAI response object.** Leaks vendor coupling into every caller. The verdict type is your seam. SCAFFOLD.16 retains the existing typed verdict.

---

### 4. Test fixture patterns for moderation classifiers

#### Empirical findings

- **Vitest's `vi.mock` + `vi.hoisted` at the module boundary is the idiomatic pattern.** SCAFFOLD.16's current pattern (`vi.mock("@/server/moderation/openai", ...)` with `vi.hoisted` for the mock function) is on the well-trodden path.

- **Per-test response scripting via `mockResolvedValueOnce` is canonical** for stubbing a classifier's response shape.

#### Recommended pattern for SCAFFOLD.16 (experiment-phase scope)

- **Follow existing test pattern.** New test `precommit-moderate::text-only-sexual-minors-routes-track-b` uses `vi.hoisted` + `vi.mock` at module boundary, scripts response inline via `mockResolvedValueOnce(modResult({categories: {...}}))`. Matches the 12 existing tests' shape.
- **For the post-experiment hardening pass:** introduce a typed `modResult()` fixture factory + one MSW-based HTTP-shape integration test. **Parked.**

#### Anti-patterns

- **Snapshot tests on the moderation client output.** They rot whenever OpenAI adds a field. Test invariants of the mapping, not the literal shape of the response.

---

### 5. Track A false-positive mitigation within a single-call architecture

The constraint: one OpenAI call, no second vendor, no second classifier pass. The question: what defense-in-depth is implementable in the verdict-mapping function?

#### Empirical findings (research only — NOT IN SCOPE per operator decision)

- **Combining a score threshold with the boolean flag is the most cited single-call defense.** Production guides recommend `score > 0.9` as a hard-block threshold (https://bennyprompt.com/posts/openai-moderation-endpoint/, https://docs.thehive.ai/docs/visual-content-moderation).
- **Category combination requirements (logical AND) work.** A `sexual/minors === true` alone has a non-negligible false-positive rate; `sexual/minors === true AND sexual === true` is much rarer in legitimate content.
- **Account-age / velocity / IP heuristics are standard auxiliary signals** in trust & safety pipelines.
- **No platform publishes the numeric score threshold for `sexual/minors`.** This is likely deliberate (gameable).

#### Operator decision for SCAFFOLD.16

**No defense-in-depth predicate in experiment phase.** Track A predicate stays simple: `imageR2Key !== undefined && categories['sexual/minors'] === true`. No score floor, no category combination, no account-age signal.

Rationale: experiment phase is 7 weeks, expected volume is low, false-positive cost is bounded (admin unban via existing F-ADMIN-* surfaces). Simplicity over defense-in-depth for this phase. Defense-in-depth recommended for post-experiment hardening if false-positive rates surface as a real concern.

**R-1 (Track A predicate hardening with score floor + category combination) — parked.**

#### Anti-patterns (still relevant in experiment phase)

- **Conflating Track A with NCMEC reporting obligations.** Banning a user is a product decision; reporting to NCMEC is a legal one and almost always requires human verification of the image. SCAFFOLD.16 ships Track A auto-ban only; NCMEC reporting is separately deferred per LD-7 in plan-mode brief and `docs/parked.md`.

---

## Operator scope decision (2026-05-25)

At brief-drafting close, operator chose **Option (A) "Hold scope"** from three options:

- **(A)** ✅ CHOSEN — Plan-mode kickoff says exactly what the plan-mode brief says. R-1/R-2/R-3 parked. Simplest possible Track A predicate.
- (B) Expand scope. Plan-mode brief + research-brief Stage 1 recommendations all ship in SCAFFOLD.16.
- (C) Expand scope partially. R-2 + R-3 ship; R-1 deferred.

**Rationale (operator):** "keep it simple and easy to implement but fully operational — its just the experiment phase — I want no scoring — just a simple detect + block + ban."

SCAFFOLD.16 final scope:
- Boolean Track A gate on `imageR2Key` presence (no score floor)
- One additive acceptance test (`precommit-moderate::text-only-sexual-minors-routes-track-b`)
- Two comment cleanups (`precommit.ts:24-25` + `limits.ts:88`)
- `docs/parked.md` entries: (1) second-vendor deferral, (2) NCMEC reporting deferral, (3) Track A text/image asymmetry, (4) **R-1/R-2/R-3 research-backed improvements deferred to post-experiment hardening**
- Same-commit SPEC amendments: SPEC.1 §16.5, SPEC.1 §17, SPEC.2 §10, SPEC.2 §22.2 line 2175, SPEC.2 §17.2 row 4 (optional)

Research-backed Stage 1 recommendations deferred (parked) for post-experiment hardening stratum:
- **R-1:** Strengthen Track A predicate to combine `imageR2Key + categories['sexual/minors'] + categories['sexual'] + scores['sexual/minors'] >= 0.5 + category_applied_input_types['sexual/minors'] non-empty`.
- **R-2:** Expand `ModerationVerdict` to include `triggeringModalities`, `rawScores`, `modelSnapshot`, `moderationCallMs`.
- **R-3:** Expand retry policy from 1 retry / 3s to 2 retries / 5s with explicit `invalid_image_url` handling.

---

## Caveats

- **OpenAI's image-fetch error semantics for the moderation endpoint are inferred from vision-endpoint reports.** OpenAI does not publish moderation-specific image-fetch error documentation. The `image_url` schema is identical, and the `invalid_image_url` error code is documented broadly, so the inference is strong, but it is not OpenAI-confirmed for `/v1/moderations` specifically.
- **No platform publishes the numeric score threshold for `sexual/minors`.** The 0.5 floor recommended in §5 (R-1, parked) is a sanity check, not a published industry value.
- **Score calibration may drift across OpenAI snapshots.** Pinning to `omni-moderation-2024-09-26` is correct for stability, but means missing accuracy improvements from later snapshots.
- **Roblox Sentinel and Bluesky figures are 2024-25 transparency-report numbers**, not commitments to maintain the same approach forever.
- **The DTSP best-practices framework is co-authored by competitors of OpenAI**, but its CSAM-specific guidance is industry-neutral and corroborated by Bluesky/Roblox primary sources.
- **Experiment-phase scope is deliberately narrow.** False-positive rates will surface from real usage data. If text-only `sexual/minors` Track B routing creates admin-queue burden disproportionate to legitimate-content volume, the R-1/R-2/R-3 hardening pass becomes pre-launch instead of post-launch.

---

*Brief drafted: Web Claude, SCAFFOLD.16 brief-drafting chat, 2026-05-25. Companion to `SCAFFOLD.16-plan-mode-brief.md`. Empirical research conducted via deep-research tool against 2024-2026 production sources.*

---

## ERRATA (appended 2026-05-26 at SCAFFOLD.16 execute-phase commit-2)

> Brief body above is frozen at v1 (drafted Web Claude 2026-05-25; pre-execute-phase MD5 `4698d41100695ffa58040de001063823`). The errata note below records known factual errors discovered during SCAFFOLD.16 execute-phase Item E verification + Item F surface 2026-05-26. Brief body is **not** retroactively edited per plan-provenance convention. Readers should consult SCAFFOLD.16 plan body (`docs/plans/SCAFFOLD.16.md`) + close-out log (`docs/logs/SCAFFOLD.16.md`) for canonical post-correction state.

### ERRATA 2026-05-26 (added at SCAFFOLD.16 execute-phase Item E verification + Item F surface)

**Error 1 — §1 line 33: claim that `hate` is image-supported on `omni-moderation-2024-09-26` is incorrect.**

Brief body §1 line 33 reads: *"Per OpenAI's documentation, image inputs are supported only for `violence`, `violence/graphic`, `sexual`, `self-harm` (including `intent`/`instructions`), and `hate`."*

Authoritative source (OpenAI Moderation Guide, `developers.openai.com/api/docs/guides/moderation`, fetched 2026-05-26) lists the following 7 categories as **text only** (NOT image-supported): `harassment`, `harassment/threatening`, `hate`, `hate/threatening`, `illicit`, `illicit/violent`, `sexual/minors`. The 6 image-supported categories are: `sexual`, `violence`, `violence/graphic`, `self-harm`, `self-harm/intent`, `self-harm/instructions`.

The brief is correct that `sexual/minors` is text-only (§1 line 33). The brief is **wrong** that `hate` is image-supported. Cross-check secondary source (evolink.ai blog citing OpenAI's announcement at launch) confirms the authoritative table.

Error originally propagated into plan body `docs/plans/SCAFFOLD.16.md` §F Edit 4a "After" text via /plan opening drafting 2026-05-26 (claimed "three image categories `omni-moderation` does NOT classify (`hate`, `harassment`, `weapons` on image inputs)" — three compounding errors: wrong count, wrong list, wrong taxonomy claim re. `weapons`). Corrected in SCAFFOLD.16 commit-2 per Option 6α (in-place "After" text correction tracked as amendment-note within existing plan §F Edit 4a entry; not a separate §F locus). See plan §3.7 SURPRISE 7b + §I "Brief drift caught at execute-phase Phase 1 verify-don't-trust" provenance subsection.

**Error 2 — implied F-ADMIN-4 mitigation: brief's v1-gap framing implies SPEC.1 §15 F-ADMIN-4 reactive removal covers image-borne harm content.**

Brief body cites *"SPEC.1 §15 F-ADMIN-4 reactive removal"* (indirectly, via plan body §F Edit 4a "After" text and the re-narrowed Items B/C/D/E + Item E weapons row Notes column, all of which inherit the brief's v1-gap framing) as the mitigation for image-borne harm content (text-only categories on image inputs; weapons-imagery) that `omni-moderation-2024-09-26` cannot classify.

SPEC.1 §15 F-ADMIN-4 contract pre-SCAFFOLD.16 (lines 882–892) requires upstream Track A/B classification (`Pre: Track B comment exists with review_status = pending`; inline scope is approve Track B / remove Track A/B). For `pass`-verdict content (i.e., content omni-moderation does not classify), F-ADMIN-4 has no surface to act on it. The cited mitigation mechanism does **not** exist in §15 pre-SCAFFOLD.16; structural citation chain broke at execute-phase Phase 1 Item F surface 2026-05-26.

Mitigation implemented in SCAFFOLD.16 commit-2 via Option F-γ-thin amendment to SPEC.1 §15 F-ADMIN-4 (sub-edits 15a–15e per plan §F Edit 15): extends F-ADMIN-4 with one narrow new capability — inline admin removal of pass-verdict comments — plus cascade extensions to SPEC.1 §14 F-MOD-3 (G2 per plan §F Edit 16) and SPEC.2 §4 Server Action map line 371 description column (Item G per plan §F Edit 17). New §17 acceptance-test row `f-admin-4::pass-verdict-removal` added. See plan §3.7 SURPRISE 7c + §I provenance subsection.

### Provenance

Brief frozen at v1 per plan-provenance convention (plan §I "Brief is frozen at v1" framing; future updates would invalidate plan §1 LD reproductions). This errata note records propagation chain but does **not** modify brief body content. Plan-provenance convention preserves brief immutability for audit trail; errata appendix is the accepted mechanism for known factual errors.

Process learning recorded in plan §I "Brief drift caught at execute-phase Phase 1 verify-don't-trust" 7b paragraph: research brief factual claims (especially per-category capability tables for external vendors) should be verified against primary docs at /plan opening, not assumed correct. Plan-mode CC's verify-before-claiming-done discipline (CLAUDE.md §5.7) should extend to all empirical claims absorbed from briefs into plan bodies.
