# docs/scale/ — the load-testing programme's governing documents

Committed 2026-09-01 per `ZUGZWANG_DAY-1-EXECUTION-PACK_v1_0.md` RELAY A2 Part 1 Step 2, which named these documents as governing the S-5 load programme and observed they lived only in `~/Downloads` and project knowledge — never on `main`. This directory is that repair, done honestly rather than partially disguised as complete.

## What's actually here

| File | What it is |
|---|---|
| `ZUGZWANG_DAY-1-EXECUTION-PACK_v1_0.md` | The ratified execution pack itself — Hrishikesh, 2026-08-30, "go with best recoms" |
| `S-5-MASTER-REVIEW.md` | The read-only audit behind the load programme (2026-08-30) |
| `S-5-LOAD-PLAN.md` | The staged load-test programme derived from that audit |
| `S-5-BOTTLENECK-REGISTER.md` | Suspected bottlenecks with evidence, prioritized |
| `S-5-OBSERVABILITY-PLAN.md` | What must be measurable before a load run |
| `S-5-SCALE-ROADMAP.md` | Decision register, phases, order of work |
| `S-5-CACHE-PERFORMANCE-PLAN.md` | Cache-specific measurement plan |
| `S-5.md` | The superseded original draft, kept per this repo's amend-forward convention |
| `S5_BACKEND_LOAD_TEST_ROADMAP_TRACKER.md` | Backend-lane execution tracker |
| `S5_FRONTEND_LOAD_TEST_ROADMAP_TRACKER.md` | Frontend-lane execution tracker |

## What A2 actually asked for, and is still NOT here

RELAY A2's own text names a **different** six documents, plus this pack, as what should land in `docs/scale/`:

- `ZUGZWANG_SCALE-TRACKER_v1_1.md`
- `ZUGZWANG_SCALE_handover_part-1_ground-truth_v1_0.md`
- `ZUGZWANG_SCALE_HO-OPS_operating-ritual_v1_0.md`
- `ZUGZWANG_SCALE_HO-S1_transaction-pooler_v3_0.md`
- `ZUGZWANG_LOAD-PROGRAMME-TRACKER_v1_0.md`
- `ZUGZWANG_S-5_RULINGS_v1_0.md`

**None of these six exist on this machine.** Confirmed by direct listing, not inferred. What's committed above is the *audit set* that fed into the ratified pack — real, substantive, and worth having on `main` — but it is not a literal fulfillment of A2's own list. That gap is stated here so a future reader doesn't mistake "a `docs/scale/` directory exists" for "the six named documents are on `main`." If those six turn up (they likely exist in whichever session/machine wrote the original audit and the pack), they should be added here, not treated as recovered by this commit.
