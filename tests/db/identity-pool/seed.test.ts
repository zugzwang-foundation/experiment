// SCAFFOLD.17 plan §D — real-Postgres integration tests for the
// production seed-script `runSeed(manifestPath, testDb)`. Follows the
// canonical pattern at `tests/db/triggers/identity-pool-append-only
// .spec.ts:1–120` (dual `testClient` + `testDb`; afterEach TRUNCATE
// CASCADE to bypass Bucket B trigger).
//
// TODO(SCAFFOLD.17): tests-first per CLAUDE.md §5.6 — written by
// test-writer reviewer-call at Phase 2 START.

export {};
