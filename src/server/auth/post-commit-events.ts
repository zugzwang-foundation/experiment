import "server-only";

import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db";
import { sessions, users } from "@/db/schema/auth";
import { insertEvent } from "@/server/events/insert";

// AUDIT-FIX-A22 — the three §8.8 participant emits that ride Better Auth's
// databaseHooks: `user.oauth_signed_in` / `user.otp_signed_in` at
// `session.create.after`, `user.pseudonym_assigned` at `user.create.after`
// (the only seam where the created `users.id` exists — the `create.before`
// pool-consumption hook runs before any userId).
//
// §7.5.1 sub-case-(b) carve-out (SPEC.2 amendment in this commit): Better
// Auth 1.6.11 exposes ONLY post-commit after-hooks — every `create.after`
// is queued via `queueAfterTransactionHook` and drained after the wrapping
// transaction/handler completes (`better-auth/dist/db/with-hooks.mjs`;
// `@better-auth/core` `context/transaction.mjs`). V3's in-transaction
// emission CANNOT hold at these seams, so each event lands in a separate
// post-commit micro-tx, like `user.signed_out` (`logout.ts`).
//
// Fabrication guard (verify-then-emit) — MANDATORY per §7.5.1, and the
// reason this is stricter than `user.signed_out`: Better Auth drains a
// queued after-hook EVEN WHEN the wrapped transaction threw and rolled
// back (`runWithTransaction` captures the error, runs pending hooks, then
// rethrows). A naive emit here would write an `events` row for a
// `sessions` / `users` row that never committed — a FABRICATED entry on
// the canonical audit log. Each emit therefore first SELECTs the
// originating row by PK on OUR `db` client (never Better Auth's adapter,
// so at default isolation it sees only committed state: a committed row
// is visible, a rolled-back row is absent) and silently skips when the
// row is missing. The residual crash-window (crash after the upstream
// commit, before the emit) is the accepted §7.5.1 tradeoff — a benign
// missing entry, never fabrication.
//
// Error posture: unexpected errors (DB, zod) PROPAGATE — the
// `user.signed_out` precedent; loud via Sentry, and the interrupted
// sign-in is retryable. The only silent-skip branches are the logged
// benign-missing-entry ones below: originating row absent (the guard),
// unclassifiable endpoint path (never emit a mislabeled event type), and
// a NULL `users.google_id` / `users.pfp_filename` (the payload schemas
// require strings; skipping beats fabricating a value).

// `ctx.path` is the better-call route TEMPLATE (`internalContext.path =
// endpoint.path` in `to-auth-endpoints.mjs`) — `/callback/:id` for the
// OAuth redirect callback, `/sign-in/email-otp` for the email-OTP plugin's
// sign-in endpoint. The `startsWith("/callback/")` belt also covers a
// concrete path if a future Better Auth version stores it resolved.
function classifySignInPath(path: string | undefined): "oauth" | "otp" | null {
	if (!path) return null;
	if (path === "/callback/:id" || path.startsWith("/callback/")) {
		return "oauth";
	}
	if (path === "/sign-in/email-otp") return "otp";
	return null;
}

/**
 * `databaseHooks.session.create.after` — emits `user.oauth_signed_in`
 * (flow F-AUTH-1) or `user.otp_signed_in` (F-AUTH-2) per the endpoint
 * path, in a post-commit micro-tx behind the verify-then-emit guard.
 * `metadata.ip`/`user_agent` come from the VERIFIED sessions row (Better
 * Auth populates them at session create; `"unknown"` when empty — the
 * S-C deferral placeholder convention).
 */
export async function emitSignedInEvent(
	// `userId` is accepted (Better Auth passes the full session row) but
	// deliberately unread — the guard re-reads it from the COMMITTED
	// sessions row, the audit ground truth.
	session: { id: string; userId?: string },
	ctx: { path?: string } | null | undefined,
): Promise<void> {
	const flow = classifySignInPath(ctx?.path);
	if (!flow) {
		console.error("signin_event_skipped", {
			reason: "unclassifiable_path",
			path: ctx?.path ?? null,
			sessionId: session.id,
		});
		return;
	}

	// Minted before the tx per ADR-0016 D1 (retry purity — never
	// regenerated per attempt; the logout.ts precedent).
	const eventId = uuidv7();

	await db.transaction(async (tx) => {
		const sessionRow = await tx.query.sessions.findFirst({
			where: eq(sessions.id, session.id),
			columns: { id: true, userId: true, ipAddress: true, userAgent: true },
		});
		if (!sessionRow) {
			// Fabrication guard: the session-create rolled back but Better
			// Auth drained the after-hook anyway. No event.
			console.error("signin_event_skipped", {
				reason: "session_row_absent",
				sessionId: session.id,
			});
			return;
		}

		const userRow = await tx.query.users.findFirst({
			where: eq(users.id, sessionRow.userId),
			columns: { id: true, email: true, googleId: true },
		});
		if (!userRow) {
			// Unreachable while sessions.user_id has its FK, kept as a belt.
			console.error("signin_event_skipped", {
				reason: "user_row_absent",
				sessionId: session.id,
			});
			return;
		}

		const metadata = {
			request_id: "unknown",
			flow_id: flow === "oauth" ? "F-AUTH-1" : "F-AUTH-2",
			user_id: userRow.id,
			actor_id: userRow.id,
			idempotency_key: null,
			ip: sessionRow.ipAddress || "unknown",
			user_agent: sessionRow.userAgent || "unknown",
		};

		if (flow === "oauth") {
			if (!userRow.googleId) {
				// OTP-created user account-linked to Google: google_id was
				// never back-filled. Payload requires a string — skip, never
				// fabricate.
				console.error("signin_event_skipped", {
					reason: "google_id_null",
					userId: userRow.id,
				});
				return;
			}
			await insertEvent(tx, {
				eventId,
				eventType: "user.oauth_signed_in",
				aggregateType: "user",
				aggregateId: userRow.id,
				payload: {
					userId: userRow.id,
					provider: "google",
					googleId: userRow.googleId,
				},
				metadata,
			});
			return;
		}

		await insertEvent(tx, {
			eventId,
			eventType: "user.otp_signed_in",
			aggregateType: "user",
			aggregateId: userRow.id,
			payload: { userId: userRow.id, email: userRow.email },
			metadata,
		});
	});
}

/**
 * `databaseHooks.user.create.after` — emits `user.pseudonym_assigned`
 * (flow F-AUTH-3) in a post-commit micro-tx behind the verify-then-emit
 * guard. The payload reads the VERIFIED users row, not the hook argument
 * — the committed row is the audit ground truth. No request scope at
 * this seam → `"unknown"` metadata placeholders (S-C deferral).
 */
export async function emitPseudonymAssignedEvent(user: {
	id: string;
}): Promise<void> {
	const eventId = uuidv7();

	await db.transaction(async (tx) => {
		const userRow = await tx.query.users.findFirst({
			where: eq(users.id, user.id),
			columns: { id: true, pseudonym: true, pfpFilename: true },
		});
		if (!userRow) {
			// Fabrication guard: the user-create rolled back but Better Auth
			// drained the after-hook anyway. No event.
			console.error("pseudonym_event_skipped", {
				reason: "user_row_absent",
				userId: user.id,
			});
			return;
		}
		if (!userRow.pfpFilename) {
			// Column is nullable; the payload schema requires a string. The
			// create.before hook always injects it, so this is a belt — skip,
			// never fabricate.
			console.error("pseudonym_event_skipped", {
				reason: "pfp_filename_null",
				userId: user.id,
			});
			return;
		}

		await insertEvent(tx, {
			eventId,
			eventType: "user.pseudonym_assigned",
			aggregateType: "user",
			aggregateId: userRow.id,
			payload: {
				userId: userRow.id,
				pseudonym: userRow.pseudonym,
				pfpFilename: userRow.pfpFilename,
			},
			metadata: {
				request_id: "unknown",
				flow_id: "F-AUTH-3",
				user_id: userRow.id,
				actor_id: userRow.id,
				idempotency_key: null,
				ip: "unknown",
				user_agent: "unknown",
			},
		});
	});
}
