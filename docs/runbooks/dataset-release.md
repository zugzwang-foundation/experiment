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
   have a corresponding entry in §19.4.1 + Appendix B.13. If an
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

4. **Verify `system_state.frozen_at` is set.** Per SPEC.2 **§20.2** the
   freeze is the system-level write boundary; CC cannot bypass per
   CLAUDE.md §3 refusal trigger. *(This cited §3.7, which is the
   events-row contract and says nothing about the freeze.)*
   ⚠ **§20.2 ratifies TWO paths, not one.** Path A is a `pg_cron`
   scheduled flip (the intended primary); Path B is a manual operator
   `psql` UPDATE (the fallback). **No Path-A job is registered by any
   migration** — the only two `cron.schedule(...)` calls in
   `drizzle/migrations/` are `identity-pool-watermark` (0007) and
   `nightly-drift` (0011). So check the live database for a freeze job
   **before** the instant, not after:
   `SELECT jobname, schedule FROM cron.job;`
   If none is registered, Path B is the live path and a human must be
   at the keyboard at 2026-11-05 23:59 UTC.

5. **Disable participant-side write paths.** Per SPEC.2 §20.2 the
   handler-layer guard checks `frozen_at IS NOT NULL` and returns
   `error_experiment_concluded` for any state-mutating handler. Verify
   via curl spot-check of a bet endpoint → 410.

## Pre-export (2026-11-06 morning)

6. **Run the export pipeline** (DATASET.* / HARDEN.* implementation
   TBD). The pipeline reads:
   - SPEC.2 §19.3 row inventory (which tables ship).
   - SPEC.2 §19.4 the **ten** PII columns dropped. *(This said 8; the
     §19.4 table has ten rows and §19.1 and §19.3 both restate ten.)*
   - SPEC.2 §19.4.1 per-event-type payload STRIP_KEY rules.
   - SPEC.2 §19.5 export-time JOIN pseudonymization (FK rewrites).
   - SPEC.2 Appendix B.* per-table column treatments.

7. **Spot-check exported `events.payload`:** sample 100 rows from each
   event_type. Verify:
   - `user.tos_accepted` rows: `payload` shows `userId` + version
     hashes + NO `ip` / NO `user_agent` keys.
   - `user.oauth_signed_in` rows: NO `googleId` key.
   - `image_upload.*` rows: NO `key` (R2 object key) key.
   - `admin.signed_in` rows: NO `sessionId` / NO `ip` keys.
   - All `metadata.ip` / `metadata.user_agent` keys absent (already
     covered by §19.4 rows **9-10**; rows 7-8 are `pfp_filename` and
     `r2_object_key`. This checks the strip actually ran).

8. **Spot-check pseudonymization** (per §19.5): cross-table joins
   should reference `user_pseudonym` columns, not raw `users.id`. The
   `users` table itself ships with `id` as a join key per §19.5 last
   paragraph — that's by design.

## Release

9. Publish the dataset tarball to the canonical GitHub artifact per
   SPEC.2 §19.1.

10. Announce per SPEC.1 **§12.2** — the GitHub release at
    `zugzwang-foundation/experiment` plus the long-lived static URL,
    CC-BY-4.0. Venue + audience TBD per the HARDEN.* communications
    plan. *(This cited §16, the Operational Floor, whose five
    subsections carry no announcement commitment.)*

## Post-release

11. Monitor for re-identification attempts or external CVE reports.
    ⚠ **Two postures, and only one failing is an incident.** Per
    **SPEC.2 §19.4** the *export* posture is "strip-not-hash" — the ten
    PII columns are dropped rather than hashed, which forecloses
    confirmation attacks against a known email. Per **SPEC.1 §16.3** the
    *product* posture is transparency-by-design, and `H4` rules
    re-identification over the public pseudonymous surface a design
    property rather than a bug. So: a researcher demonstrating
    re-identification from **residual PII in the released archive** means
    the §19.4 strip did not run, and that is an incident. A correlation
    attack over data the product publishes on purpose is not.
    *("strip-not-hash" does not appear in SPEC.1 at all — it is SPEC.2
    §19.4's term.)*

## Notes

This is a STUB. Operator should expand at HARDEN.* with:
- Specific operator names + handoffs at each step.
- Backup-export procedure if step 6 fails.
- Pre-publication legal review hold — the deferred legal engagement,
  parked as **`LEGAL.1`** in `docs/parked.md`. *(This line pointed at
  "CLAUDE.md §5", which is the Workflow-rules section and carries no
  legal item, and used the alias `HARDEN.7`; `docs/parked.md` rules
  `LEGAL.1` canonical and records `HARDEN.6`/`HARDEN.7` as aliases of
  the same row. The "mid-July 2026" target has passed — treat the row
  as open until `docs/parked.md` says otherwise.)*
- Press-engagement plan if applicable.

ENGINE.6 ships this stub to anchor the dataset-release process
around the §19.4.1 STRIP rules so future amendments to event payload
shapes don't accidentally bypass the strip step.
