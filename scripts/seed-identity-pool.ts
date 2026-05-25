/**
 * Production seed for `identity_pool` per SCAFFOLD.17 plan §A + ADR-0011.
 * Ingests the external-dev image pipeline manifest (50K rows; CSV; 5 cols
 * `colour, animal, number, pseudonym, pfp_filename`) via chunked bulk-INSERT
 * with composite-key idempotency. Re-runs are safe — `ON CONFLICT (colour,
 * animal, number) DO NOTHING` makes the operation idempotent.
 *
 * Per-chunk transaction boundary (CHUNK_SIZE = 1000) per research brief R2:
 * 5 explicit columns × 1,000 = 5,000 binds, well under the 32,767 ceiling;
 * per-chunk isolation lets partial reruns degrade gracefully and avoids
 * long-running tx WAL bloat.
 *
 * Run via `pnpm seed:identity-pool:prod <manifest-path>` (see package.json).
 *
 * Exit codes:
 *   0 — success (manifest count = 50000 AND post-run table count >= 50000)
 *   1 — manifest parse error (file missing, malformed line, type coercion)
 *   2 — DB INSERT error (Drizzle / Postgres exception inside runSeed)
 *   3 — row-count mismatch (post-run table count not as expected)
 */

// TODO(SCAFFOLD.17): implement per plan §A.
export {};
