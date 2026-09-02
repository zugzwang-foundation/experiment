# BREAK_GLASS.md

> Suspected-compromise admin rotation + dataset-release-prep procedures
> per ADR-0010 + SPEC.2 §8.4 + §20.3 + §19.4.1. Authoring stub; HARDEN.10
> owns the full procedure per §21.3. *(This header cited §8.6, which is
> F-AUTH-5 logout; §8.4 is the Admin auth path this runbook operates on,
> and §21.3 slot 1 names §8.4 + §20.3 as the owners.)*

This file is a placeholder for the full admin-rotation runbook owned by
HARDEN.10. Current content covers:

1. The ENGINE.6 same-commit codification of admin-session-rotation as a
   dataset-release-prep step.

## 1. Pre-dataset-release admin rotation (2026-11-05 freeze)

**Trigger:** the 2026-11-05 23:59 UTC write-freeze before the 2026-11-06
public dataset release per SPEC.1 G3 + SPEC.2 §19.1.

**Why required:** ENGINE.6 emits `admin.signed_in` + `admin.signed_out`
events with `aggregate_id = admin_sessions.session_id` (the UUIDv7 that
IS the admin cookie value per SPEC.2 §8.5). The same value is also
written into `events.payload.sessionId`. Per SPEC.2 §19.4.1 the payload
keys are STRIP at export, and Appendix **B.13**'s `aggregate_id` note
flags admin_session aggregate_id as **SHIP-raw**, with defense-in-depth
covered by this runbook's rotation step. *(This said B.14; B.14 is
`identity_pool`, which has no `aggregate_id` column at all.)*

Without rotation, a session_id that was created weeks before the freeze
and is still live (no logout in the interim) is present in the released
dataset (even after STRIP, partial export-pipeline failure or B.14
relaxation could re-expose it). Rotation invalidates any live session_id
before release.

**Procedure:**

1. Confirm `BETTER_AUTH_SECRET` + `ADMIN_PASSWORD` Vercel env vars are
   accessible to the operator (NOT to CC; per CLAUDE.md `.env*` read
   prohibition).

2. From a trusted admin workstation, run:
   ```bash
   psql $DATABASE_URL -c "DELETE FROM admin_sessions;"
   ```
   This invalidates every live admin session. The next admin login
   re-creates a single fresh `admin_sessions` row via the F-AUTH-ADMIN
   transactional DELETE+INSERT per SPEC.2 §8.4.

3. Log in to `/admin/login` with the current `ADMIN_PASSWORD`. Verify
   the dashboard loads. The fresh `admin_sessions.session_id` from
   step 2's empty-table re-INSERT is the new cookie value.

4. (Optional) Rotate `ADMIN_PASSWORD` itself if the prior value is
   suspected-compromised. See §2 below.

5. Verify the released dataset's `events.payload` columns for
   `admin.signed_in` + `admin.signed_out` rows show STRIPPED
   `sessionId` field per §19.4.1. Sample check:
   ```sql
   SELECT payload FROM events
     WHERE event_type LIKE 'admin.signed%' AND created_at > '2026-11-01'
     LIMIT 5;
   ```
   Pre-release: should show actual UUIDs. Post-export: should show
   `payload` without `sessionId` key.

## 2. Suspected-compromise rotation (any time)

**Trigger:** indication that `ADMIN_PASSWORD` may be compromised
(operator suspicion, observed unauthorized admin access in `events`
where `metadata.actor_id = 'admin-singleton'` and the IP doesn't match
known admin workstations).

**Procedure:**

1. Generate a new `ADMIN_PASSWORD` (long random alphanumeric;
   `pwgen 64 1` or `openssl rand -base64 48`).

2. ⚠ **Rotate it in DOPPLER, not in Vercel.** Doppler is the source of
   truth and syncs INTO Vercel:
   `doppler secrets set ADMIN_PASSWORD="<new>" --config prd`
   (operator-only; CC cannot read or write env vars). **Do NOT edit the
   Vercel entry directly** — it is a Doppler-integration-managed copy and
   the next sync overwrites a hand-edit, silently: `env-audit.yml` /
   `pnpm ci-env-parity` is a KEYS-ONLY parity check and never compares
   values, so an overwritten rotation looks identical to a successful one.
   *(This step said `vercel env rm` / `vercel env add`, which is the
   pre-Doppler procedure and would have been undone by the next sync.)*

3. Redeploy **and promote** production per
   `docs/runbooks/deploy-pipeline.md` §3. ⚠ `autoAssignCustomDomains` is
   **OFF** (ADR-0024 item 5), so neither a `main` merge nor a bare
   `vercel --prod` serves the new build — `zugzwangworld.com` keeps
   serving the old deployment, **with the old password**, until the
   staged build is manually promoted
   (`vercel promote <staged-url> --scope <team-slug>`; `--scope` is not
   optional). The new env value reaches users only on the promoted
   build, never on the staged one. *(This step said `vercel --prod` or
   push to main was enough. Under a gated promote it is not, and the
   failure mode is the worst possible one for a rotation: you believe
   the old password is dead while it is still the one serving.)*

4. Invalidate all live admin sessions as in §1 step 2.

5. Re-issue sealed-envelope credentials to backup-admin recipient per
   the HARDEN.10 procedure (TBD in the full BREAK_GLASS.md authoring
   pass).

## 3. Future HARDEN.10 scope

This stub will be replaced by the full ADR-0010 + SPEC.2 §21.3
runbook covering:

- Sealed-envelope credentials handoff procedure.
- Quarterly scheduled rotation cadence.
- Audit-trail review (what to look for in `events` /
  `admin_events` per F-ADMIN-5).
- Incident-response coordination (who to notify, in what order).
- Re-issuance after a rotation (verifying every authorized admin can
  still log in).

ENGINE.6 ships this stub to codify the dataset-release-prep rotation
step + defense-in-depth posture for admin session_id leakage via
events.payload. The fuller procedure lands at HARDEN.10.
