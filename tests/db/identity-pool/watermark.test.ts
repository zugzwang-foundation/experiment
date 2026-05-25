// SCAFFOLD.17 plan §D — real-Postgres integration tests for the pg_cron
// low-watermark check function `check_identity_pool_watermark()` shipped
// in `drizzle/migrations/0007_pg_cron_jobs.sql`. Tests the function
// directly (NOT the scheduled tick) per research brief R5 — pg_cron
// background-worker timing inside `supabase start` is unreliable.
//
// Raw-SQL access pattern: `watermark_state` + `cron_alarms` ship as raw
// DDL only (no Drizzle declaration in SCAFFOLD.17); tests use
// `testDb.execute(sql\`...\`)` for reads and `testClient.unsafe(...)` for
// mutations. `identity_pool` continues with the typed Drizzle query
// builder (it ships at HEAD per `src/db/schema/identity.ts`).
//
// TODO(SCAFFOLD.17): tests-first per CLAUDE.md §5.6 — written by
// test-writer reviewer-call at Phase 2 START.

export {};
