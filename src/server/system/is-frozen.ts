import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { systemState } from "@/db/schema";

/**
 * The §20.2 conclusion-freeze gate — a plain, NON-LOCKING read of the single
 * `system_state` sentinel (no row-lock builder; must NOT enter the W-1/W-3/W-4
 * lock order). Called at handler step 1, before idempotency, before any tx.
 * `frozen_at` flips NULL→timestamp once. ⚠ No scheduled writer exists: this
 * line used to say "HARDEN.10's pg_cron owns the flip", and that job was never
 * built. Per D-55 the flag is DORMANT — the experiment ends when its markets
 * close and nothing sets it, so this reads `false` unless someone sets the
 * flag by hand. The gate itself is unchanged.
 */
export async function isFrozen(): Promise<boolean> {
	const row = await db.query.systemState.findFirst({
		where: eq(systemState.id, "system"),
		columns: { frozenAt: true },
	});
	return row?.frozenAt != null;
}
