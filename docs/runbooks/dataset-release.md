# dataset-release.md

> Public dataset release checklist. ENGINE.6 stub; HARDEN.*
> / DATASET.* stratum owns the full procedure including the
> export-pipeline implementation.

The public dataset release is the canonical egress for the experiment per
SPEC.1 G3 + SPEC.2 §19.1. This file is the operator-facing checklist;
the technical export pipeline (which reads SPEC.2 §19.4 + §19.4.1
STRIP rules + §19.5 PSEUDO joins) is implemented separately at
DATASET.* / HARDEN.*.

⚠ **The release is UNTIMED, and the date is deliberately gone from this
header (D-21 as narrowed by D-26; D-55).** The experiment ends when its
markets close, on `2026-12-31` at `23:45 UTC`; this repository describes
nothing after that except this release. The checklist is a sequence
keyed on the markets' close, and a sequence does not need a calendar to
run in order. Do not re-date this header; the release runs when the
founder runs it.

⛔ **No freeze is scheduled (D-55). Do not set `system_state.frozen_at`.**
Until D-55 this checklist was keyed on a `2026-11-05 23:59 UTC`
write-freeze and told the operator to verify that the flag was set and,
failing a scheduled job, to set it by hand. That instruction is
withdrawn. Nothing sets the flag and no step below needs it. Setting it
while any market is `Open` also stops the `close-due-markets` sweep,
which is itself freeze-gated, and once set it is never unset except
through `BREAK_GLASS.md`.

## Before the markets close (2026-12-31, ahead of 23:45 UTC)

1. **Admin session rotation** per `BREAK_GLASS.md` §1. Invalidates any
   live admin `session_id` values that would otherwise be in
   `events.payload.sessionId` at export time (defense-in-depth on top
   of the SPEC.2 §19.4.1 STRIP_KEY rule). The admin signs in again for
   the resolution work after the close, so this is repeated at step 7.

2. **Verify SPEC.2 §19.4 + §19.4.1 strip-rules document is current.**
   Any event_type added between the last release cycle and now must
   have a corresponding entry in §19.4.1 + Appendix B.13. If an
   event_type exists in `src/server/events/schemas.ts` `EVENT_TYPES`
   array but has NO §19.4.1 entry → STOP and amend SPEC.2 +
   re-confirm payload PII review with the privacy reviewer (TBD per
   HARDEN.*). `market.deadline_moved` (EXT-1) has its row.

3. **Spot-check `events` table volumes.** Per SPEC.2 §7.2, the
   `events_default` partition fires Sentry alarm 2 on any write.
   Confirm zero rows in `events_default` (a row there indicates a
   `created_at` outside the named partition range — operational error
   that must be triaged before release).

4. **Check the closer.** The `close-due-markets` sweep is the only
   thing that ends trading: the bet path reads a market's status, never
   the clock (SPEC.2 §20.3). Confirm the sweep is running before the
   instant, and that the write-pause is off —
   `ZUGZWANG_WRITES_PAUSED=paused` also pauses the closer and the
   manual Close.

## At the close (2026-12-31 23:45 UTC — 05:15 IST on 2027-01-01)

5. **Verify all six markets are `Closed`.** Each carries one
   `market.closed` event. A market still `Open` after the sweep has had
   time to run is closed with the admin **Close** action (SPEC.1
   F-ADMIN-3), which works at or after the market's deadline.
   ⚠ There is no 410 to check. With no freeze, a bet on a closed market
   is refused by the market's state (SPEC.1 F-BET-5), not by
   `error_experiment_concluded`.

6. **Resolve or void each market** on its published criteria (SPEC.1
   §11, F-ADMIN-3). Founder only. Resolution follows the close; nothing
   resolves a market automatically.

## Pre-export (after the resolution work is complete)

7. **Confirm the dataset-build point** (SPEC.2 §19.1): every market is
   `Resolved` or `Voided`, and no market is `Open` (ADR-0044, D-55
   patch record). Rotate admin sessions again per `BREAK_GLASS.md` §1.
   Record the instant the snapshot is taken.
   ⚠ **Not ruled: where the release draws its line.** With no freeze,
   rows keep arriving after the close — signups, each with its initial
   grant; image-upload signing; moderation rows (EXT-1
   `@security-auditor` SA-M-1). Ask the founder whether the release is
   cut at the last `market.closed` instant or at the snapshot, before
   step 8.

8. **Run the export pipeline** (DATASET.* / HARDEN.* implementation
   TBD). The pipeline reads:
   - SPEC.2 §19.3 row inventory (which tables ship).
   - SPEC.2 §19.4 the **ten** PII columns dropped. *(This said 8; the
     §19.4 table has ten rows and §19.1 and §19.3 both restate ten.)*
   - SPEC.2 §19.4.1 per-event-type payload STRIP_KEY rules.
   - SPEC.2 §19.5 export-time JOIN pseudonymization (FK rewrites).
   - SPEC.2 Appendix B.* per-table column treatments.

9. **Spot-check exported `events.payload`:** sample 100 rows from each
   event_type. Verify:
   - `user.tos_accepted` rows: `payload` shows `userId` + version
     hashes + NO `ip` / NO `user_agent` keys.
   - `user.oauth_signed_in` rows: NO `googleId` key.
   - `image_upload.*` rows: NO `key` (R2 object key) key.
   - `admin.signed_in` rows: NO `sessionId` / NO `ip` keys.
   - All `metadata.ip` / `metadata.user_agent` keys absent (already
     covered by §19.4 rows **9-10**; rows 7-8 are `pfp_filename` and
     `r2_object_key`. This checks the strip actually ran).

10. **Spot-check pseudonymization** (per §19.5): cross-table joins
    should reference `user_pseudonym` columns, not raw `users.id`. The
    `users` table itself ships with `id` as a join key per §19.5 last
    paragraph — that's by design.

## Release

11. Publish the dataset tarball to the canonical GitHub artifact per
    SPEC.2 §19.1.

12. Announce per SPEC.1 **§12.2** — the GitHub release at
    `zugzwang-foundation/experiment` plus the long-lived static URL,
    CC-BY-4.0. Venue + audience TBD per the HARDEN.* communications
    plan. *(This cited §16, the Operational Floor, whose five
    subsections carry no announcement commitment.)*

## Post-release

13. Monitor for re-identification attempts or external CVE reports.
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
- Backup-export procedure if step 8 fails.
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

*Steps renumbered at EXT-1 (D-55): the two freeze steps (formerly 4 and
5) became the close and resolution steps, a closer check and a
build-point step were added, and the export steps moved from 6–11 to
8–13.*
