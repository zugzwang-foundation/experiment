import "server-only";

import { inArray } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { users } from "@/db/schema";

/** A bound read client — top-level `db` OR a caller's transaction. */
type DebateViewReader = DbClient | DbTransaction;

/**
 * A comment author's PUBLIC identity for the debate view: the pseudonym + a
 * PFP URL. Never the email / Google id / TOS columns — only the public face
 * (`identity` per CLAUDE.md vocabulary).
 */
export type AuthorIdentity = {
	pseudonym: string;
	pfpUrl: string;
};

/**
 * The static onboarding PFP placeholder (D8). `pfp_filename → URL` is not built
 * yet — onboarding assigns a static `/pfp-placeholder.svg`; the real PFP (R2
 * "pfp" bucket / static asset) is deferred. Until then every author renders the
 * placeholder, so `pfp_filename` is intentionally not read here.
 */
const PFP_PLACEHOLDER = "/pfp-placeholder.svg";

/**
 * Resolve a batch of comment authors to their public identity (DEBATE.4 §5).
 * ONE set-based read for every listed author — no per-comment lookup, no N+1.
 * Returns a Map keyed by `users.id`; an empty input short-circuits to an empty
 * Map (an empty `inArray` would degenerate to `WHERE false`).
 *
 * Read-only; reads only the public `pseudonym` column. PFP resolves to the
 * static placeholder (D8) — `pfp_filename` is not surfaced.
 */
export async function resolveAuthors(
	client: DebateViewReader,
	userIds: string[],
): Promise<Map<string, AuthorIdentity>> {
	const ids = [...new Set(userIds)];
	if (ids.length === 0) {
		return new Map();
	}

	const rows = await client
		.select({ id: users.id, pseudonym: users.pseudonym })
		.from(users)
		.where(inArray(users.id, ids));

	const byId = new Map<string, AuthorIdentity>();
	for (const r of rows) {
		byId.set(r.id, { pseudonym: r.pseudonym, pfpUrl: PFP_PLACEHOLDER });
	}
	return byId;
}
