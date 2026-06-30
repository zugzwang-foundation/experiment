# ADR-0027 — Admin Market-Media Direct Upload (No Moderation)

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-06-30 |
| **Deciders** | Hrishikesh |
| **Tracker task** | MEDIA.1 (admin market-media build) / ADR-0026 supersession |
| **Frame document** | SPEC.2 §22 (ADR Index), §4.3 (admin-upload forward-note), §12.1 (R2 third arm) |
| **Supersedes** | ADR-0026 (partial — §D4 admin-upload moderation) |
| **Superseded-by** | — |

---

## Context and Problem Statement

ADR-0026 §D4 specified that admin-uploaded market-media images run through an admin-context caller of the participant image-moderation pipeline (CSAM hash + general classifier) at upload, rejecting any flagged image before it enters the pool. That pipeline exists to gate **untrusted, user-generated content**: anonymous participants uploading arbitrary images alongside bets. The admin market-media path has no such input. The admin is structurally not a participant (F-AUTH-ADMIN — no `users` row, cannot bet or comment), and the sole uploader on this path is the trusted operator setting a market's curated media pool pre-live. Running an untrusted-content moderation pipeline against the operator's own curated uploads is ceremony against a threat that does not exist on this path, and it forces an admin-context moderation caller that touches `precommit.ts` (a critical-path moderation file) plus a shared verdict-helper extraction — added surface on a safety-critical file for no safety gain. This ADR removes moderation from the admin market-media upload path: the operator's curation is editorial control, not a moderation surface.

This ADR does **not** decide:

- Participant image/comment moderation — the CSAM hash + general classifier pipeline for user-generated content is **unchanged and fully intact** (ADR-0014, SPEC.1 §8 F-COMMENT-3 / §10).
- The admin boundary / auth model (ADR-0010, F-AUTH-ADMIN).
- The `market_media` table, the third R2 bucket arm, the outbound-video model, or the at-create "markets always have media" invariant — these ADR-0026 decisions all stand.

## Decision Drivers

1. **Threat model.** The image-moderation pipeline gates untrusted user-generated uploads. The admin market-media path has a single trusted uploader and no untrusted input; the pipeline mitigates no threat present here.
2. **Critical-path surface.** An admin-context moderation caller requires touching `precommit.ts` and extracting a shared verdict helper — added complexity on a safety-critical file. Removing it shrinks the critical surface this build touches.
3. **Guardrail integrity.** The moderation guardrail forbids weakening UGC/CSAM moderation. Scoping the operator's own curation out of the UGC pipeline does not weaken UGC moderation, which remains fully intact for participants.
4. **Operator-curation model.** Admin pre-publication curation of a market's media pool is editorial control by a trusted operator, categorically distinct from a moderation surface for untrusted content.

## Considered Options

1. **Direct admin upload, no moderation (operator-curated trusted content)** ← chosen
2. Keep ADR-0026 §D4 — admin-context moderation caller at upload
3. CSAM-hash-only on admin uploads (drop the general classifier, retain a legal-floor hash check)
4. Eager per-image moderation at upload-time (full pipeline, moved earlier)

## Decision Outcome

**Chosen: Option 1 — direct admin upload, no moderation.**

After the admin signed-PUT mints and the browser uploads the bytes out-of-band to the `market-media` bucket, the create flow writes the `market_media` row **directly**, with **no** moderation call. The admin-context moderation caller from ADR-0026 §D4 is **not** built; `src/server/moderation/precommit.ts` is **not** called by the market-media path and is left unchanged by it. The participant image-moderation pipeline (SPEC.1 §8 F-COMMENT-3 / §10, ADR-0014) is **fully preserved and unaffected**.

Consequences for adjacent spec:
- **SPEC.1 §15 F-ADMIN-1:** the moderation clause is removed; the error `media_moderation_blocked` is removed.
- **SPEC.1 §8 F-COMMENT-3:** a picked pool image attaches without a participant-side moderation round-trip because it is **operator-curated trusted content** (admin-set, outside the UGC moderation model) — **not** because it was "pre-moderated." The behaviour (picking is the fast image path) is unchanged; only the justification changes.

Upload hygiene that is **retained** (not moderation): file-type and size validation on the signed-PUT remain, as basic upload validation.

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Admin market-media upload (no moderation) | `src/server/admin/markets/` (create action) + the admin signed-PUT Route Handler |
| Participant moderation (unchanged) | `src/server/moderation/precommit.ts` |

## Consequences

### Positive

- Removes the admin-context moderation caller, the shared verdict-helper extraction, and all `precommit.ts` churn from the build — less surface on a critical-path file.
- Removes the `media_moderation_blocked` error, the moderation read-back, and the reject-delete/audit-on-scan branch from the admin path — a leaner, lower-risk create flow.
- Eliminates the false "pre-moderated" justification in F-COMMENT-3 that the pick slice would otherwise inherit.
- Faster admin create flow (no moderation HTTP round-trip per image).

### Negative

- An admin image uploaded but never submitted is never scanned. *Acceptable because:* the participant out-of-band upload path already has this property pre-submit, and it is near-moot under a single trusted operator; the `market-media` bucket holds operator-curated content only.
- If a future compliance regime required scanning **all** hosted images regardless of uploader, this decision would need revisiting. *Acceptable because:* no such scan-all-hosted-images obligation was identified for the experiment phase, and the bucket is operator-curated content, not user-generated.

### Neutral

- The `market_media` schema, the third R2 arm, the outbound-video model, and the at-create media invariant (ADR-0026) are untouched by this ADR.

## Pros and Cons of the Options

### Option 1 — Direct admin upload, no moderation (chosen)

**Pros**

- Matches the threat model: no untrusted input on this path.
- Smallest critical-path surface; no `precommit.ts` involvement.
- Removes a false downstream justification.

**Cons**

- Operator-uploaded content is unscanned. *Mitigated by:* single trusted uploader; operator-curated bucket; the same pre-submit property already exists on the participant path.

### Option 2 — Keep ADR-0026 §D4 admin-context moderation

**Pros**

- Uniform "all uploads moderated" mental model.

**Cons**

- Runs an untrusted-content pipeline against trusted operator content — ceremony with no threat mitigated. Forces a moderation caller + verdict-helper extraction on a critical-path file. **Verdict:** Rejected — cost on a safety-critical file with no corresponding safety gain.

### Option 3 — CSAM-hash-only on admin uploads

**Pros**

- Retains a legal-floor CSAM check on hosted images.

**Cons**

- Still couples the admin path to the moderation substrate; still needs an admin-context caller and a reject path. **Verdict:** Rejected — the operator weighed the CSAM-compliance angle and chose direct upload given the trusted-sole-uploader model; no scan-all-hosted-images obligation was identified for the experiment phase.

### Option 4 — Eager per-image moderation at upload-time

**Pros**

- Closes the abandoned-upload gap.

**Cons**

- Heaviest option; the most moderation surface, against the least-threatened path. **Verdict:** Rejected — solves a near-moot gap at the highest cost.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| ADR-0026 | §D4 admin-upload moderation | **Supersedes** — admin market-media uploads are no longer moderated |
| SPEC.1 §15 | F-ADMIN-1 | Shapes — removes the moderation clause + `media_moderation_blocked` |
| SPEC.1 §8 | F-COMMENT-3 | Shapes — re-justifies the pick fast-path as operator-curated, not pre-moderated |
| SPEC.2 §4.3, §12.1 | admin-upload + R2 arm | Shapes — removes moderation-at-upload from the build forward-notes |
| CLAUDE.md | moderation guardrail | Consumes/respects — UGC/CSAM moderation for participants is unweakened |
| Tracker | MEDIA.1 | Unblocked against the corrected spec |

---

*ADR-0027 ratifies that admin market-media uploads are operator-curated trusted content written directly without moderation, scoping the operator's own curation out of the user-generated-content moderation pipeline (which remains fully intact for participants). It supersedes ADR-0026 §D4. The decision body is immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*
