import "server-only";

import { and, desc, eq, gte, inArray, lte, type SQL, sql } from "drizzle-orm";

import { db } from "@/db";
import { adminEvents, markets, modActions, users } from "@/db/schema";
import {
	type AuditLogRowView,
	type AuditSearchFilters,
	BLOCKED_REASONS,
	isBlockedReason,
	type ModerationAuditRowRaw,
	type ModerationAuditRowView,
	type ModVerdict,
	toAuditRowView,
	topCategories,
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

/** Max category chips surfaced per searched mod_action row. */
const AUDIT_CATEGORY_LIMIT = 6;

/**
 * UI-6 S4 — F-ADMIN-5 audit-log SEARCH (A3). Unions `mod_actions` (ALL reasons,
 * incl. the reactive `content_removed` / `user_banned` rows) with `admin_events`
 * into one newest-first result list, narrowed by the five predicates. The user +
 * pseudonym predicates skip `admin_events` entirely — admin-actor rows carry no
 * participant user. Each source contributes at most `limit` rows, so the union's
 * newest `limit` is guaranteed within (top-limit mod ∪ top-limit admin).
 *
 * Read-only; STILL imports NO r2 URL-minter (the leak rail holds — blocked
 * images surface only as `hasBlockedImage`, never a viewable URL / raw key).
 * The no-filter default of the audit PAGE stays `loadModerationAuditFeed`
 * (blocked submissions); this loader is the search surface.
 */
export async function searchAuditLog(
	options: { limit?: number; filters?: AuditSearchFilters } = {},
): Promise<AuditLogRowView[]> {
	const limit = options.limit ?? AUDIT_FEED_DEFAULT_LIMIT;
	const f = options.filters ?? {};

	// mod_actions — every reason, filtered by all five predicates.
	const modConds: SQL[] = [];
	if (f.from) modConds.push(gte(modActions.createdAt, f.from));
	if (f.to) modConds.push(lte(modActions.createdAt, f.to));
	// reason is a pgEnum — compare as text so a non-reason actionType (an
	// admin_events event_type) simply matches nothing here.
	if (f.actionType) {
		modConds.push(sql`${modActions.reason}::text = ${f.actionType}`);
	}
	if (f.marketId) modConds.push(eq(modActions.targetMarketId, f.marketId));
	if (f.userId) modConds.push(eq(modActions.targetUserId, f.userId));
	if (f.pseudonym) modConds.push(eq(users.pseudonym, f.pseudonym));

	const modRows = await db
		.select({
			id: modActions.id,
			reason: modActions.reason,
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
		.where(modConds.length > 0 ? and(...modConds) : undefined)
		.orderBy(desc(modActions.createdAt))
		.limit(limit);

	const modViews: AuditLogRowView[] = modRows.map(
		(r): AuditLogRowView => ({
			id: r.id,
			source: "mod_action",
			createdAt: r.createdAt,
			actionType: r.reason,
			actorId: r.actorId,
			marketId: r.targetMarketId,
			marketSlug: r.marketSlug,
			marketTitle: r.marketTitle,
			authorUserId: r.targetUserId,
			authorPseudonym: r.authorPseudonym,
			authorBanned: r.authorBannedAt !== null,
			categoryScores: topCategories(r.categories, AUDIT_CATEGORY_LIMIT),
			blockedText: r.blockedText,
			hasBlockedImage: r.imageR2Key !== null,
		}),
	);

	// admin_events — admin-actor rows carry no participant user, so a user /
	// pseudonym predicate excludes them entirely.
	let adminViews: AuditLogRowView[] = [];
	if (!f.userId && !f.pseudonym) {
		const aeConds: SQL[] = [];
		if (f.from) aeConds.push(gte(adminEvents.createdAt, f.from));
		if (f.to) aeConds.push(lte(adminEvents.createdAt, f.to));
		if (f.actionType) aeConds.push(eq(adminEvents.eventType, f.actionType));
		if (f.marketId) {
			aeConds.push(sql`${adminEvents.payload}->>'marketId' = ${f.marketId}`);
		}

		const aeRows = await db
			.select({
				id: adminEvents.id,
				eventType: adminEvents.eventType,
				createdAt: adminEvents.createdAt,
				payload: adminEvents.payload,
				metadata: adminEvents.metadata,
			})
			.from(adminEvents)
			.where(aeConds.length > 0 ? and(...aeConds) : undefined)
			.orderBy(desc(adminEvents.createdAt))
			.limit(limit);

		adminViews = aeRows.map((r): AuditLogRowView => {
			const payload = (r.payload ?? {}) as { marketId?: unknown };
			const metadata = (r.metadata ?? {}) as { actor_id?: unknown };
			return {
				id: r.id,
				source: "admin_event",
				createdAt: r.createdAt,
				actionType: r.eventType,
				actorId:
					typeof metadata.actor_id === "string"
						? metadata.actor_id
						: "admin-singleton",
				marketId:
					typeof payload.marketId === "string" ? payload.marketId : null,
				marketSlug: null,
				marketTitle: null,
				authorUserId: null,
				authorPseudonym: null,
				authorBanned: false,
				categoryScores: [],
				blockedText: null,
				hasBlockedImage: false,
			};
		});
	}

	return [...modViews, ...adminViews]
		.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
		.slice(0, limit);
}
