import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { systemState } from "@/db/schema";

/**
 * The §20.2 conclusion-freeze gate — a plain, NON-LOCKING read of the single
 * `system_state` sentinel (no row-lock builder; must NOT enter the W-1/W-3/W-4
 * lock order). Called at handler step 1, before idempotency, before any tx.
 * `frozen_at` flips NULL→timestamp once; HARDEN.10's pg_cron owns the flip.
 */
export async function isFrozen(): Promise<boolean> {
	const row = await db.query.systemState.findFirst({
		where: eq(systemState.id, "system"),
		columns: { frozenAt: true },
	});
	return row?.frozenAt != null;
}
