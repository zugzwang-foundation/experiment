# dataset-release.md

> 2026-11-06 public dataset release checklist. ENGINE.6 stub; HARDEN.*
> / DATASET.* stratum owns the full procedure including the
> export-pipeline implementation.

The 2026-11-06 release is the canonical egress for the experiment per
SPEC.1 G3 + SPEC.2 §19.1. This file is the operator-facing checklist;
the technical export pipeline (which reads SPEC.2 §19.4 + §19.4.1
STRIP rules + §19.5 PSEUDO joins) is implemented separately at
DATASET.* / HARDEN.*.

## Pre-release (2026-11-05 17:00 UTC — 6h before write-freeze)

1. **Admin session rotation** per `BREAK_GLASS.md` §1. Invalidates any
   live admin `session_id` values that would otherwise be in
   `events.payload.sessionId` at export time (defense-in-depth on top
   of the SPEC.2 §19.4.1 STRIP_KEY rule).

2. **Verify SPEC.2 §19.4 + §19.4.1 strip-rules document is current.**
   Any event_type added between the last release cycle and now must
   have a corresponding entry in §19.4.1 + Appendix B.14. If an
   event_type exists in `src/server/events/schemas.ts` `EVENT_TYPES`
   array but has NO §19.4.1 entry → STOP and amend SPEC.2 +
   re-confirm payload PII review with the privacy reviewer (TBD per
   HARDEN.*).

3. **Spot-check `events` table volumes.** Per SPEC.2 §7.2, the
   `events_default` partition fires Sentry alarm 2 on any write.
   Confirm zero rows in `events_default` (a row there indicates a
   `created_at` outside the named partition range — operational error
   that must be triaged before release).

## At write-freeze (2026-11-05 23:59 UTC)

4. **Verify `system_state.frozen_at` is set.** Per SPEC.2 §3.7 the
   freeze is the system-level write boundary; CC cannot bypass per
   CLAUDE.md §3 refusal trigger. Manual operator UPDATE only.

5. **Disable participant-side write paths.** Per SPEC.2 §20.2 the
   handler-layer guard checks `frozen_at IS NOT NULL` and returns
   `error_experiment_concluded` for any state-mutating handler. Verify
   via curl spot-check of a bet endpoint → 410.

## Pre-export (2026-11-06 morning)

6. **Run the export pipeline** (DATASET.* / HARDEN.* implementation
   TBD). The pipeline reads:
   - SPEC.2 §19.3 row inventory (which tables ship).
   - SPEC.2 §19.4 the **nine** PII columns dropped (this read *"the 8
     PII columns"*; §19.4's table has never had eight rows, and note
     that `users.pfp_filename` is **not** one of them — it SHIPs, and
     dropping it destroys the identity-pool join).
   - SPEC.2 §19.4.1 per-event-type payload **SHIP** rules. ⚠ **The
     section inverted on 2026-09-01 (DATASET.3, ruling E).** It named
     the keys to REMOVE; it now names the keys that SHIP, with
     everything else dropped by default at any depth. Read it that way
     round, or a check for "the listed keys are absent" will be exactly
     backwards.
   - SPEC.2 §19.5 export-time JOIN pseudonymization (FK rewrites).
   - SPEC.2 Appendix B.* per-table column treatments.

7. **Spot-check exported `events.payload`:** sample 100 rows from each
   event_type. Verify:
   - `user.tos_accepted` rows: `payload` shows the two version hashes
     and **NOTHING ELSE** — no `userId`, no `ip`, no `user_agent`.
     ⚠ **This bullet said `payload` shows `userId`, and it was wrong.**
     `userId` is a raw `users.id`; shipping it into a CC-BY-4.0 artifact
     is the re-identification vector the whole strip-not-hash posture
     exists to close, and Appendix B.13 has always listed it in the
     general strip set for `events.payload`. The pipeline has never
     shipped it. An operator following the old bullet on the morning of
     6 November would have found no `userId`, concluded the export was
     broken, and had to decide under time pressure whether to trust the
     runbook or the artifact. Corrected 2026-09-01 (DATASET.3, F5).
   - `user.oauth_signed_in` rows: `payload` is **EMPTY** — `userId`,
     `googleId` and the `provider` literal all withheld (§19.4.1).
   - `image_upload.*` rows: NO `key` (R2 object key) key.
   - `admin.signed_in` / `admin.signed_out` rows: `payload` is **EMPTY**
     — no `sessionId`, no `ip`.
   - All `metadata.ip` / `metadata.user_agent` keys absent (already
     covered by §19.4 **rows 8–9**, cited by name because a row number
     moves: this read *"row 7-8"*, which named `tos_acceptance_ip` and
     `tos_acceptance_user_agent` — a different pair, one layer up. This
     step checks the strip actually ran).
   - `image_upload.committed` rows: NO `commentId` key (§19.4.1 —
     withheld unconditionally, so its absence is uniform and carries no
     signal about which comments were removed).
   - `comment.placed` rows: **NO `uploadId` key** (2026-09-01, ruling
     S5). It is the other half of the same recovery path: this payload
     carries `commentId` too, so shipping `uploadId` would rebuild the
     comment↔upload association Appendix B.6 withholds, in one row,
     with no join. `comments.image_uploads_id` still carries the link
     for every comment that is not withheld.
   - **NO `idempotency_key`** anywhere — not in `bets.csv`, and not in
     any `metadata` blob (2026-09-01, ruling S2). It is 255 bytes of
     participant-chosen header text that moderation never sees.
   - **Timestamps carry SIX fractional digits**
     (`2026-11-06T12:00:00.123456Z`), not three. ⚠ Three digits means
     the reader floored microseconds at the driver, and the archive has
     silently lost the ordering resolution of events less than a
     millisecond apart. Check one `created_at` in each of `users.csv`,
     `events.csv` and `bets.csv` (2026-09-01, ruling S6).
   - The four checks above are **key-absence at any depth**: §19.4.1's
     rules apply through nesting and arrays, so a spot-check that only
     reads top-level keys passes over the case the depth rule exists
     for.

8. **Spot-check pseudonymization** (per §19.5): cross-table joins
   should reference `user_pseudonym` columns, not raw `users.id`. The
   `users` table itself ships with `id` as a join key per §19.5 last
   paragraph — that's by design.

## Release

9. Publish the dataset tarball to the canonical GitHub artifact per
   SPEC.2 §19.1.

10. Announce per SPEC.1 §16 (TBD — venue + audience per HARDEN.*
    communications plan).

## Post-release

11. Monitor for re-identification attempts or external CVE reports.
    Per SPEC.1 §16 the privacy posture is "strip-not-hash"; an
    external researcher demonstrating re-identification would be a
    privacy incident requiring runbook update.

## Notes

This is a STUB. Operator should expand at HARDEN.* with:
- Specific operator names + handoffs at each step.
- Backup-export procedure if step 6 fails.
- Pre-publication legal review hold (per CLAUDE.md §5 deferred legal
  engagement mid-July 2026 HARDEN.7 per `docs/parked.md`).
- Press-engagement plan if applicable.

ENGINE.6 ships this stub to anchor the dataset-release process
around the §19.4.1 STRIP rules so future amendments to event payload
shapes don't accidentally bypass the strip step.
