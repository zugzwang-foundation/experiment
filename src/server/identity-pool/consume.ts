import { sql } from "drizzle-orm";
import type { DbClient } from "@/db";

// FIFO consumer for the pre-seeded `identity_pool` per SPEC.1 §13 F-AUTH-3 +
// SPEC.2 §13 + ADR-0011. Called from `databaseHooks.user.create.before` in
// `src/server/auth/index.ts` to atomically allocate a (colour, animal,
// number, pfp_filename) tuple to the new user row.
//
// Ordering: `created_at, id` — the `id` tiebreaker is load-bearing, not decoration. Seed order IS assignment order (PFP-1), so the anti-clustering rotation only holds if this ORDER BY is a total order. Both seeders insert row by row today, giving each row its own transaction timestamp; batching either into one multi-row INSERT would stamp every row with the same `now()` and silently collapse the rotation with no test going red. ⚠ The tiebreaker makes the order TOTAL and DETERMINISTIC; it does NOT recover insertion order. This repo's `uuidv7()` (migration 0000) is a millisecond-precision timestamp prefix over `gen_random_uuid()`, so ids sharing a millisecond sort randomly. That is fine — a random order does not cluster either — but the guarantee is determinism, not insertion order, and the batched-INSERT case above stays a thing to avoid rather than something `id ASC` repairs.
//
// Concurrency: `SELECT … FOR UPDATE SKIP LOCKED` lets parallel signups pick
// distinct tuples without serializing through the same row. The immediate
// `UPDATE assigned_at = now()` in the same transaction commits the
// allocation; subsequent reads with `WHERE assigned_at IS NULL` won't see
// the row. Bucket B trigger at `drizzle/migrations/0003_append_only_
// triggers.sql` enforces NULL → timestamp one-way at the storage layer.
//
// Stranded-tuple semantic (Q6 verified): Better Auth's OAuth + Email-OTP
// flows do NOT wrap user-create + session-create in one transaction.
// Pool consumption commits independently. If the session-create hook
// throws (ToS not yet accepted), the user row rolls back but the pool
// tuple's `assigned_at` UPDATE persists — stranded. Recovery: stale-30d
// sweep per SPEC.1 line 704.

export async function consumeIdentityPoolTuple(
	db: DbClient,
): Promise<{ pseudonym: string; pfpFilename: string } | null> {
	return db.transaction(async (tx) => {
		const result = (await tx.execute(
			sql`
				SELECT id, colour, animal, number, pfp_filename AS "pfpFilename"
				FROM identity_pool
				WHERE assigned_at IS NULL
				ORDER BY created_at ASC, id ASC
				LIMIT 1
				FOR UPDATE SKIP LOCKED
			`,
		)) as unknown as Array<{
			id: string;
			colour: string;
			animal: string;
			number: number;
			pfpFilename: string;
		}>;

		const row = result[0];
		if (!row) return null;

		await tx.execute(
			sql`UPDATE identity_pool SET assigned_at = now() WHERE id = ${row.id}`,
		);

		const pseudonym = `${row.colour}${row.animal}${String(row.number).padStart(3, "0")}`;
		return { pseudonym, pfpFilename: row.pfpFilename };
	});
}
