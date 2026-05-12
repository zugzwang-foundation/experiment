import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

// Tests bypass src/db/index.ts because it carries `import "server-only"`,
// which throws when evaluated in the Vitest/Node runtime (Vitest is not the
// Next.js server). Per SPEC.2 §6.6: "Test fixtures bypass any
// application-layer protection (going straight to the Drizzle client) so
// the trigger is the only enforcement under test."

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error(
		"DATABASE_URL not set; tests cannot connect. Run `supabase start` and source .env.local.",
	);
}

// Two-client split: `testClient` is the raw postgres-js handle used for
// trigger-rejection assertions (raw .unsafe() / template-tag SELECTs).
// `testDb` is a Drizzle wrapper on a SEPARATE postgres-js client. Why two
// clients: Drizzle 0.45's postgres-js driver MUTATES `client.options.parsers`
// for OIDs 1184/1082/1083/1114/1182/1185/1115/1231 (all date/time types)
// to identity-parsers, so any timestamptz column read through that client
// returns a raw text string instead of a Date. Tests that SELECT a Bucket-B
// whitelisted timestamp via testClient (system_state.frozen_at,
// friendly_fire_events.frozen_at, etc.) need Date semantics; routing those
// SELECTs through a non-Drizzle-wrapped client preserves the parser path.
//
// max: 1 ensures all queries in a file share one connection per client —
// keeps TRUNCATE in afterEach atomic w.r.t. subsequent reads in the next test.
export const testClient = postgres(connectionString, { max: 1 });
const drizzleClient = postgres(connectionString, { max: 1 });
export const testDb = drizzle(drizzleClient, { schema });
export type TestDb = typeof testDb;

/**
 * Extracts the first 48 bits of a UUIDv7's hex representation as
 * big-endian unix-ms and returns a Date. Used by the events replay-safety
 * test (and by ENGINE.6's insertEvent helper, when that lands) to supply
 * `created_at` deterministically from the same UUIDv7 across retries — so
 * the composite PK `(event_id, created_at)` reuses the same pair and
 * `ON CONFLICT DO NOTHING` is exactly-once.
 *
 * Per SPEC.2 §7.3 + RFC 9562 §5.7 (UUIDv7 layout: bits 0-47 = unix_ts_ms).
 */
export function createdAtFromUuidV7(id: string): Date {
	const hex = id.replace(/-/g, "").slice(0, 12);
	const ms = Number.parseInt(hex, 16);
	return new Date(ms);
}
