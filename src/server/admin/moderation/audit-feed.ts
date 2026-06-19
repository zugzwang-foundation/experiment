import "server-only";

import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { markets, modActions, users } from "@/db/schema";
import {
	BLOCKED_REASONS,
	isBlockedReason,
	type ModerationAuditRowRaw,
	type ModerationAuditRowView,
	type ModVerdict,
	toAuditRowView,
} from "./audit-view";

// UI.6 slice A — read-only F-ADMIN-5 loader (ADR-0021). This module is
// `server-only` and pulls in NO R2 URL-minting helper, so it is structurally
// incapable of producing a viewable URL for a blocked image. ZERO writes — a
// pure read surface. (The audit-feed-leak guard greps this file for those
// helper tokens, so they must never appear here — not even in prose.)

/** Default cap on rows surfaced by the audit viewer (most recent first). */
export const AUDIT_FEED_DEFAULT_LIMIT = 200;

export interface LoadModerationAuditFeedOptions {
	limit?: number;
}

/** Narrow the DB verdict enum (`pass | track_a | track_b | null`) to the
 * blocked-row verdicts; a blocked row is never `pass`, so it maps to `null`. */
function blockedVerdict(
	verdict: "pass" | "track_a" | "track_b" | null,
): ModVerdict | null {
	return verdict === "track_a" || verdict === "track_b" ? verdict : null;
}

/**
 * Read the most recent BLOCKED `mod_actions` rows (the three gate-block
 * reasons; reactive-admin rows are excluded by the `reason` filter), each LEFT
 * JOINed to its author (for ban-state) and target market. Returns render-ready
 * view models — never the raw r2 key. Read-only.
 */
export async function loadModerationAuditFeed(
	options: LoadModerationAuditFeedOptions = {},
): Promise<ModerationAuditRowView[]> {
	const limit = options.limit ?? AUDIT_FEED_DEFAULT_LIMIT;

	const rows = await db
		.select({
			id: modActions.id,
			reason: modActions.reason,
			verdict: modActions.verdict,
			createdAt: modActions.createdAt,
			actorId: modActions.actorId,
			categories: modActions.categories,
			blockedText: modActions.blockedText,
			imageR2Key: modActions.imageR2Key,
			targetUserId: modActions.targetUserId,
			targetMarketId: modActions.targetMarketId,
			authorPseudonym: users.pseudonym,
			authorBannedAt: users.bannedAt,
			marketSlug: markets.slug,
			marketTitle: markets.title,
		})
		.from(modActions)
		.leftJoin(users, eq(modActions.targetUserId, users.id))
		.leftJoin(markets, eq(modActions.targetMarketId, markets.id))
		.where(inArray(modActions.reason, [...BLOCKED_REASONS]))
		.orderBy(desc(modActions.createdAt))
		.limit(limit);

	// flatMap with the type guard narrows `row.reason` to BlockedReason without an
	// `as` cast. The WHERE already restricts the set; the guard is the defensive
	// belt (a non-blocked row, impossible here, is dropped rather than mistyped).
	return rows.flatMap((row) => {
		if (!isBlockedReason(row.reason)) return [];
		const raw: ModerationAuditRowRaw = {
			id: row.id,
			reason: row.reason,
			verdict: blockedVerdict(row.verdict),
			createdAt: row.createdAt,
			actorId: row.actorId,
			categories: row.categories,
			blockedText: row.blockedText,
			imageR2Key: row.imageR2Key,
			targetUserId: row.targetUserId,
			targetMarketId: row.targetMarketId,
			authorPseudonym: row.authorPseudonym,
			authorBannedAt: row.authorBannedAt,
			marketSlug: row.marketSlug,
			marketTitle: row.marketTitle,
		};
		return [toAuditRowView(raw)];
	});
}
