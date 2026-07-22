// UI.6 slice A — PURE view layer for the read-only moderation audit viewer
// (F-ADMIN-5, ADR-0021). Deliberately NO `import "server-only"` and NO `@/db`:
// this module holds zero secrets and performs no IO, so it is import-safe
// anywhere and unit-testable without a DB. The gated DB loader (audit-feed.ts)
// maps raw rows through these helpers; the admin page renders the result.

/**
 * The three GATE-BLOCK reasons the viewer surfaces (SPEC.1 §14 / ADR-0021). The
 * two reactive-admin reasons — `content_removed` / `user_banned` — are
 * deliberately EXCLUDED: they are actions taken on already-live content, not
 * blocked submissions, and the live reactive feed is a separate stratum.
 */
export const BLOCKED_REASONS = [
	"track_a_autoban",
	"track_b_blocked",
	"sexual_minors_text_blocked",
] as const;

export type BlockedReason = (typeof BLOCKED_REASONS)[number];

/** The gate verdict carried on a blocked row (`pass` never reaches the viewer). */
export type ModVerdict = "track_a" | "track_b";

export function isBlockedReason(reason: string): reason is BlockedReason {
	return (BLOCKED_REASONS as readonly string[]).includes(reason);
}

/**
 * The raw joined row as read by `loadModerationAuditFeed`. `categories` is the
 * OpenAI score jsonb — `unknown` at the type boundary (it is validated, not
 * trusted, by `topCategories`).
 */
export interface ModerationAuditRowRaw {
	id: string;
	reason: BlockedReason;
	verdict: ModVerdict | null;
	createdAt: Date;
	actorId: string;
	categories: unknown;
	blockedText: string | null;
	imageR2Key: string | null;
	targetUserId: string | null;
	targetMarketId: string | null;
	authorPseudonym: string | null;
	authorBannedAt: Date | null;
	marketSlug: string | null;
	marketTitle: string | null;
}

export interface CategoryScore {
	name: string;
	score: number;
}

/**
 * Render-ready view model. By construction it carries `hasBlockedImage` (a
 * boolean) and NEVER the r2 object key or any url/src field — so no viewable
 * URL for blocked content can be produced from it. `blockedText` is admin-only
 * and is rendered solely on the admin-gated audit page.
 */
export interface ModerationAuditRowView {
	id: string;
	reason: BlockedReason;
	verdict: ModVerdict | null;
	createdAt: Date;
	actorId: string;
	authorUserId: string | null;
	authorPseudonym: string | null;
	authorBanned: boolean;
	authorBannedAt: Date | null;
	marketId: string | null;
	marketSlug: string | null;
	marketTitle: string | null;
	categoryScores: CategoryScore[];
	blockedText: string | null;
	hasBlockedImage: boolean;
}

/**
 * The OpenAI category score map → the top `n` flagged categories, score
 * descending. Tolerates a malformed jsonb value (non-object / non-numeric
 * entries dropped) — it must never throw on untrusted stored data.
 */
export function topCategories(scores: unknown, n: number): CategoryScore[] {
	if (scores === null || typeof scores !== "object") return [];
	const entries: CategoryScore[] = [];
	for (const [name, value] of Object.entries(
		scores as Record<string, unknown>,
	)) {
		if (typeof value === "number" && Number.isFinite(value)) {
			entries.push({ name, score: value });
		}
	}
	entries.sort((a, b) => b.score - a.score);
	return entries.slice(0, n);
}

/** Max category chips surfaced per row. */
const CATEGORY_CHIP_LIMIT = 6;

// ── UI-6 S4 — F-ADMIN-5 audit-log SEARCH (over admin_events + mod_actions) ────

/** The five F-ADMIN-5 search predicates (A3). All optional; AND-combined. */
export interface AuditSearchFilters {
	from?: Date;
	to?: Date;
	/** Matches `mod_actions.reason` OR `admin_events.event_type`. */
	actionType?: string;
	marketId?: string;
	/** Selects mod_actions only — admin_events carry no participant user. */
	userId?: string;
	/** Selects mod_actions only — matched against the target user's pseudonym. */
	pseudonym?: string;
}

export type AuditLogSource = "mod_action" | "admin_event";

/**
 * The unified audit-log row spanning both sources. Source-specific fields
 * (categories / blockedText / author) are null/empty for `admin_event` rows.
 * Like `ModerationAuditRowView` it carries `hasBlockedImage` (a boolean) and
 * NEVER the r2 key — the F-ADMIN-5 leak rail holds across the union.
 */
export interface AuditLogRowView {
	id: string;
	source: AuditLogSource;
	createdAt: Date;
	/** `mod_actions.reason` | `admin_events.event_type`. */
	actionType: string;
	actorId: string;
	marketId: string | null;
	marketSlug: string | null;
	marketTitle: string | null;
	authorUserId: string | null;
	authorPseudonym: string | null;
	authorBanned: boolean;
	categoryScores: CategoryScore[];
	blockedText: string | null;
	hasBlockedImage: boolean;
}

export function toAuditRowView(
	raw: ModerationAuditRowRaw,
): ModerationAuditRowView {
	return {
		id: raw.id,
		reason: raw.reason,
		verdict: raw.verdict,
		createdAt: raw.createdAt,
		actorId: raw.actorId,
		authorUserId: raw.targetUserId,
		authorPseudonym: raw.authorPseudonym,
		authorBanned: raw.authorBannedAt !== null,
		authorBannedAt: raw.authorBannedAt,
		marketId: raw.targetMarketId,
		marketSlug: raw.marketSlug,
		marketTitle: raw.marketTitle,
		categoryScores: topCategories(raw.categories, CATEGORY_CHIP_LIMIT),
		blockedText: raw.blockedText,
		// Boolean ONLY — the r2 key is intentionally dropped here so a viewable
		// URL can never be produced from the view model (SAFETY rail).
		hasBlockedImage: raw.imageR2Key !== null,
	};
}
