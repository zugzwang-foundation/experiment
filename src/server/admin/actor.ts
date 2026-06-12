import "server-only";

/**
 * R-14.5: a lifecycle flow was entered without the admin actor form
 * (`actor_id !== 'admin-singleton'` or `user_id !== null`). Thrown at
 * service entry, before any transaction opens — zero writes on reject.
 */
export class AdminActorError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AdminActorError";
	}
}

/**
 * The shared admin-actor belt (R-14.5; ADR-0010 semantic home). Every
 * ENGINE.14 lifecycle flow (`createMarket` / `openMarket` / `closeMarket` +
 * the `closeDueMarkets` sweep) asserts this at service entry: admin writes
 * carry `metadata.actor_id = 'admin-singleton'` and `metadata.user_id =
 * null` — the admin has no `users` row, structurally (CLAUDE.md §3). The
 * sweep emits as `admin-singleton` per D-14.d: the deadline is the admin's
 * committed market parameter; the clock executes the admin's standing
 * instruction (no `'system'` actor identity this stratum — carry-forward 5).
 *
 * ENGINE.10 imports this same guard to retrofit the four resolution call
 * sites (trigger/settle/correct/void) — the ENGINE.9 register's security
 * handoff, sharpened to carry-forward 6. Structural typing keeps the
 * parameter minimal: any §3.7 metadata block satisfies it.
 */
export function assertAdminActor(metadata: {
	actor_id: string;
	user_id: string | null;
}): void {
	if (metadata.actor_id !== "admin-singleton" || metadata.user_id !== null) {
		throw new AdminActorError(
			`lifecycle flows require actor_id 'admin-singleton' with null user_id (got actor_id ${JSON.stringify(metadata.actor_id)}, user_id ${JSON.stringify(metadata.user_id)})`,
		);
	}
}
