# tests/load/ — the k6 rig, per `docs/scale/ZUGZWANG_DAY-1-EXECUTION-PACK_v1_0.md`

**Nothing in this directory has been run against staging.** Every script here was written and syntax-checked in this session; none has generated real traffic against the application. `stage2` and `stage3` are the closest to run-ready; `stage5`/`stage6` contain deliberate placeholders, not real signup/bet entry points, because their real preconditions (identity_pool sizing, moderation cost cap, signup-path fidelity ruling) are not yet met — see each file's own docblock.

## Rules every script here follows (M-0, M-1)

- **`constant-arrival-rate` / `ramping-arrival-rate` only.** `constant-vus`/`ramping-vus` is prohibited outside `stage2-positive-control.js`, which is the one named exception (it needs exact held concurrency, not an offered rate).
- **Design target 450-500 req/s, ramp ceiling 1,500 req/s** (M-1) — every stage's arrival-rate stages are shaped around this, not an arbitrary number.
- **Source-IP variation** (`lib/source-ip.js`) — confirmed viable this session (`zz_S5-RECON_2026-09-01T1625.md` item 13): the app's rate limiters key on a client-suppliable `x-forwarded-for` header, not a socket address. Every script varies this per VU. **This is simultaneously the mechanism that lets the rig avoid tripping the app's own limiters, and an open go-live finding** — record `source_ip_posture` in every run's provenance block, per A2's own instruction, so this is never silently treated as "the limiters were tested and held."
- **Per-request record** (`lib/record.js`) — every request in every stage is recorded with the same shape (`run_id`, `scenario`, `endpoint`, `wall_clock_ms`, `limiter_decision`, canary, pooler mode) so runs are comparable and correlatable to the backend sampler's JSONL.

## Running any of these, once its own preconditions are met

```bash
RUN_ID=<something> \
TARGET_URL=https://staging.zugzwangworld.com \
EXPECTED_CANARY=<the staging canary from /api/health> \
POOLER_MODE=transaction \
SOURCE_IP_POSTURE="client-suppliable x-forwarded-for, per zz_S5-RECON item 13" \
/home/zugzwang/.local/bin/k6 run tests/load/stage3-read.js
```

Run `sample-backend-activity.ts` in parallel (separate process, separate connection — never through the pooler under test) for backend-side correlation, exactly as done for the rig ceiling proof and the earlier read-load baselines this session.

## Stage → file map

| Stage | File | Status |
|---|---|---|
| 1 — Noise floor | (no k6 script — this is `sample-backend-activity.ts` observing an idle system, already proven this session) | ready |
| 2 — Positive control | `stage2-positive-control.js` | placeholder signup endpoint, shape ready |
| 3 — Read load | `stage3-read.js` | closest to real, ready pending a real profile pseudonym for the user-page scenario |
| 4 — Mixed traffic | `stage4-mixed.js` | read half real, write half placeholder |
| 5 — Signup | `stage5-signup.js` | placeholder — blocked on C1 + D-11 |
| 6 — Write/transaction | `stage6-write.js` | placeholder — blocked on moderation cost cap + C1 + D-11; armed abort (B2 Deliverable 3) IS wired |
| 7 — Hotspot | `stage7-hotspot.js` | read half real, close to run-ready once C1 lands |
| 8 — Spike | `stage8-spike.js` | read half real |
| 9 — Soak | `stage9-soak.js` | load half real; the post-load ≥15min sampler window is separate, not in this script |
| 10 — Ceiling | `stage10-ceiling.js` | real, deliberately ramps past the design ceiling to find the actual break |

## What's still not here

- The real signup/bet-write entry points (Stages 5/6/4-write-half) — need D-11's ruling first, then real wiring.
- The moderation cost cap enforcement (R-6/A-5's $50/150,000-call ceiling) — this is orchestration-level, not something any one stage script can enforce alone; needs its own small piece of tooling before Stage 4/6 can run for real.
- Positive controls for `tests/scale/_harness/` itself (see `zz_S2-HARNESS_2026-09-01T2215.md`, finding H-1) — unrelated to this directory directly, but the same "prove the control can fail" discipline applies to this rig too, and Stage 2 is that proof for this rig specifically.
