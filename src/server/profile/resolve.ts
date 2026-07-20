import "server-only";

import { eq } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { users } from "@/db/schema";

/** A bound read client — top-level `db` OR a caller's transaction. */
type ProfileReader = DbClient | DbTransaction;

/**
 * The identity DTO the profile surface renders — carries ZERO PII (SPEC.1
 * §23): no email / name / googleId / tos* / ip ever crosses this boundary. A
 * scrubbed row (`pseudonym` = the placeholder, `pfp_filename` NULL) resolves
 * normally under the placeholder name — scrub is DATA to this surface (plan
 * §1a).
 *
 * SCRUB CONTRACT (for the future H2 scrub writer): a scrubbed pseudonym is a
 * BRACKETED placeholder — `[scrubbed_user_N]` / `[removed_user_N]` (SPEC.1 §23
 * L700/L1024) — never a pool `<Colour><Animal><Number>` name (L658). The
 * profile identity card detects scrub by the leading `[`; if the H2 writer ever
 * picks an unbracketed placeholder, add a `scrubbed` flag here and reconcile
 * that one site (the failure mode is cosmetic — the scrubbed badge only).
 */
export type ProfileUser = {
	id: string;
	/** The CURRENT `users.pseudonym` (UNIQUE), verbatim. */
	pseudonym: string;
	/** `users.banned_at IS NOT NULL` — the D8 `Banned` label (visible to all). */
	banned: boolean;
	/**
	 * The identity PFP. The R2 URL builder is not wired yet (SCAFFOLD.15
	 * seam), so every identity renders the shared placeholder — the same
	 * `resolve-authors.ts` posture; a scrubbed `pfp_filename` NULL renders the
	 * identical silhouette path.
	 */
	pfpUrl: string;
};

/** Mirrors `resolve-authors.ts` (not exported there) — the shared placeholder. */
const PFP_PLACEHOLDER = "/pfp-placeholder.svg";

/**
 * Resolve a profile by the CURRENT value of `users.pseudonym` (UNIQUE, extends
 * ADR-0016 D6). Raw UUIDs never reach here — the route accepts a pseudonym
 * only. Returns `null` when no row carries the name (unknown → the route 404s;
 * a retired pre-scrub pseudonym 404s the same way — the identity is
 * permanently retired, ADR-0011). Reads only the four non-PII columns.
 */
export async function resolveProfileUser(
	client: ProfileReader,
	pseudonym: string,
): Promise<ProfileUser | null> {
	const rows = await client
		.select({
			id: users.id,
			pseudonym: users.pseudonym,
			bannedAt: users.bannedAt,
		})
		.from(users)
		.where(eq(users.pseudonym, pseudonym))
		.limit(1);

	const row = rows[0];
	if (row === undefined) {
		return null;
	}
	return {
		id: row.id,
		pseudonym: row.pseudonym,
		banned: row.bannedAt !== null,
		pfpUrl: PFP_PLACEHOLDER,
	};
}
