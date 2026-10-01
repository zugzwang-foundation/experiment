import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema/auth";
import { auth } from "@/server/auth";
import { recordTosAcceptance } from "@/server/auth/tos-record";

import { SEED_REQUEST_ID_PREFIX } from "./plan";

// SEED-STAGING-1 — one synthetic participant, created the way every real one
// is: Better Auth's OAuth create path runs `databaseHooks.user.create.before`,
// which draws the pseudonym and avatar from the identity pool (ADR-0011), and
// then the F-AUTH-4 evidence transaction records ToS acceptance and the
// initial Dharma grant. Nothing here writes a pseudonym or a ledger row
// itself — it is the same two calls the staging fixture generator makes
// (`tests/staging/generate.staging.test.ts` `createParticipant`).
//
// Idempotent by email: a participant that already exists is returned as-is,
// so re-uploading a sheet reaches the same people with the same names.

/**
 * Literal, obviously-synthetic acceptance evidence — never an address. The
 * values match the fixture generator's (manifest §1.7 B5) so every synthetic
 * participant on staging carries the same tell.
 */
export const SEED_TOS_IP = "SYNTHETIC-FIXTURE-NO-IP-WAS-RECORDED";
export const SEED_TOS_USER_AGENT =
	"SYNTHETIC-FIXTURE-NO-USER-AGENT-WAS-RECORDED (ZugzwangSeedStaging)";

/** The participant already created for this email, or null. Writes nothing. */
export async function findSeedParticipant(
	email: string,
): Promise<{ id: string; pseudonym: string; bannedAt: Date | null } | null> {
	const rows = await db
		.select({
			id: users.id,
			pseudonym: users.pseudonym,
			bannedAt: users.bannedAt,
		})
		.from(users)
		.where(eq(users.email, email))
		.limit(1);
	return rows[0] ?? null;
}

export async function getOrCreateSeedParticipant(args: {
	email: string;
	batchId: string;
}): Promise<{
	userId: string;
	pseudonym: string;
	created: boolean;
	banned: boolean;
}> {
	const existing = await findSeedParticipant(args.email);
	let userId: string;
	let created = false;
	if (existing) {
		userId = existing.id;
	} else {
		const ctx = await auth.$context;
		// A synthetic participant still needs a stable, unique Google `sub`;
		// deriving it from the email keeps a rebuild's accounts row identical.
		const accountId = `seed:${args.email}`;
		const userPayload = {
			email: args.email,
			name: args.email.split("@")[0],
			image: null,
			emailVerified: true,
			googleId: accountId,
		};
		const result = await ctx.internalAdapter.createOAuthUser(userPayload, {
			providerId: "google",
			accountId,
			accessToken: "seed-staging-access-token",
			refreshToken: "seed-staging-refresh-token",
			idToken: "seed-staging-id-token",
			scope: "openid email profile",
			accessTokenExpiresAt: null,
			refreshTokenExpiresAt: null,
		});
		const newId = (result as { user?: { id?: string } } | null)?.user?.id;
		if (!newId) {
			throw new Error(`createOAuthUser returned no user for ${args.email}`);
		}
		userId = newId;
		created = true;
	}

	// Always run it: a previous attempt may have created the user and then
	// died before acceptance. The function is a no-op once accepted, so a
	// re-run never grants twice (I-GRANT-ONCE-001).
	const metadata = {
		request_id: `${SEED_REQUEST_ID_PREFIX}${args.batchId.slice(0, 16)}`,
		flow_id: "F-AUTH-4",
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: SEED_TOS_IP,
		user_agent: SEED_TOS_USER_AGENT,
	};
	const accepted = await recordTosAcceptance({
		userId,
		ip: SEED_TOS_IP,
		userAgent: SEED_TOS_USER_AGENT,
		metadata,
	});
	if (!accepted) {
		throw new Error(`seed participant ${args.email} vanished before ToS`);
	}

	const row = await findSeedParticipant(args.email);
	if (!row) throw new Error(`seed participant ${args.email} not found`);
	return {
		userId,
		pseudonym: row.pseudonym,
		created,
		banned: row.bannedAt !== null,
	};
}
