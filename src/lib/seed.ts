// SEED-STAGING-1 — values the seeding page and its Route Handlers
// must agree on. Lives in src/lib because the browser half reads it too.

/** Rows per /admin/seed/run request: each finishes well inside the ALB's 60 s idle timeout. */
export const SEED_CHUNK_MAX = 25;
