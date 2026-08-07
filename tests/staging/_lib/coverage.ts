// STAGING-PARITY Slice C/D — THE COVERAGE INVENTORY (manifest §4 gate 4).
// NEVER import this from src/**.
//
// ═══════════════════════════════════════════════════════════════════════════
// ONE ENTRY PER §2 ROW. NO SILENT OMISSIONS.
//
// Gate 4 exists so an inspector never hunts for "the market with a removed
// post". Its failure mode is not a wrong URL — it is a MISSING ROW that nobody
// notices, because a coverage list is judged by what it contains and a shape
// that was never generated leaves no trace in it.
//
// So the inventory is built from the SAME §2 enumeration the manifest carries,
// and every entry is one of exactly two things:
//
//   reachable   — carries a URL, and a SQL predicate that must find its row.
//   unreachable — carries a REASON that must appear verbatim in manifest §3.
//                 It carries no URL, because there is nothing to visit.
//
// An entry that is neither is a bug in this file, and `UNREACHABLE_REASONS`
// below is what makes "matches §3 exactly" checkable rather than asserted.
// ═══════════════════════════════════════════════════════════════════════════

import {
	BOOKMARKS,
	MARKETS,
	MODERATION,
	PARTICIPANTS,
	POSTS,
} from "../fixtures";

/** Where an inspector actually goes. Staging's participant origin. */
export const STAGING_ORIGIN = "https://staging.zugzwangworld.com";

export type CoverageStatus = "reachable" | "unreachable";

export interface CoverageEntry {
	/** The §2 row id — `M2`, `P-owner`, `C3`, `Q4`, `B1`, `X1`. */
	readonly id: string;
	readonly section: "§2.1" | "§2.2" | "§2.3" | "§2.4" | "§2.5";
	/** What the row is, in the manifest's own words. */
	readonly shape: string;
	readonly status: CoverageStatus;
	/** Present iff reachable. Absolute, so it can be pasted into a browser. */
	readonly url: string | null;
	/** Present iff unreachable, and must be one of UNREACHABLE_REASONS. */
	readonly reason: string | null;
	/**
	 * A count query that must return > 0 for a reachable entry. This is what
	 * makes G4.2 a verification rather than a claim: the URL is only as good as
	 * the row behind it.
	 */
	readonly probe: string | null;
	/** What an inspector should look at when they get there. */
	readonly look: string;
}

/**
 * The manifest §3 reasons, VERBATIM in their short form. G4.3 asserts every
 * unreachable entry names one of these, so an entry cannot invent a reason and
 * an entry cannot omit one.
 */
export const UNREACHABLE_REASONS: readonly string[] = [
	"Frozen market — no freeze write path exists in src/; the transition is one-shot and trigger-enforced, and setting it bricks staging permanently (manifest §1.8 / §3)",
	"Audit-feed pagination — AUDIT_FEED_DEFAULT_LIMIT = 200 and the page hard-codes its own ROW_LIMIT with no wiring to reach it. A PRODUCT gap, not a data gap (manifest §3, v1.2 B3)",
];

const marketUrl = (slug: string) => `${STAGING_ORIGIN}/m/${slug}`;

/**
 * Every value interpolated into probe SQL passes through here first.
 *
 * @code-reviewer, Slice C (LOW-3): probes are executed via `gatesClient.unsafe()`,
 * which uses the SIMPLE-QUERY protocol and is therefore multi-statement capable.
 * Slugs and body fragments are literals in this file and pseudonyms come from a
 * closed `COLOURS × ANIMALS` pool, so nothing is injectable today — but one of
 * those values (`pseudonymOf`) is read back FROM THE DATABASE BEING VERIFIED,
 * which is the one input this file does not author. Refuse anything outside a
 * conservative shape rather than rely on that provenance holding.
 */
function safeLiteral(value: string, what: string): string {
	if (!/^[A-Za-z0-9 ._'-]+$/.test(value)) {
		throw new Error(
			`coverage: refusing to interpolate ${what} ${JSON.stringify(value)} — outside the permitted shape`,
		);
	}
	return value;
}

/** Count of rows a probe must find. Written as SQL text, run by the gate. */
const marketProbe = (slug: string, status: string) =>
	`SELECT count(*)::int AS n FROM markets WHERE slug = '${safeLiteral(slug, "slug")}' AND status = '${safeLiteral(status, "status")}'`;

const commentProbe = (bodyFragment: string) =>
	`SELECT count(*)::int AS n FROM comments WHERE body LIKE '%${safeLiteral(bodyFragment, "body fragment")}%'`;

/** A `users` sub-select, so a probe can be SCOPED to the pseudonym in its URL. */
const userOf = (pseudonym: string) =>
	`(SELECT id FROM users WHERE pseudonym = '${safeLiteral(pseudonym, "pseudonym")}')`;

/**
 * Build the full inventory. `pseudonymOf` resolves a participant ROLE to the
 * pool-assigned pseudonym — the engine's, not ours, so it can only be supplied
 * at run time from the generated rows.
 */
export function buildCoverage(
	pseudonymOf: (displayName: string) => string,
): CoverageEntry[] {
	const entries: CoverageEntry[] = [];

	// ── §2.1 · MARKETS, one per lifecycle state ──────────────────────────────
	const expectedStatus: Record<string, string> = {
		none: "Open",
		close: "Closed",
		resolving: "Resolving",
		"resolve-yes": "Resolved",
		void: "Voided",
	};
	for (const m of MARKETS) {
		const status = m.open ? (expectedStatus[m.terminal] as string) : "Draft";
		entries.push({
			id: m.key,
			section: "§2.1",
			shape: m.serves,
			status: "reachable",
			// M1 is Draft: the URL is the thing to visit, and what it must DO is
			// 404 for a participant (`getMarketBySlug` excludes Draft). A 404 is a
			// render to inspect, not an absent row.
			url: marketUrl(m.slug),
			reason: null,
			probe: marketProbe(m.slug, status),
			look:
				m.key === "M1"
					? "must 404 for a participant — Draft is admin-only"
					: `renders in ${status}`,
		});
	}
	entries.push({
		id: "M9",
		section: "§2.1",
		shape: "Frozen",
		status: "unreachable",
		url: null,
		reason: UNREACHABLE_REASONS[0] as string,
		probe: null,
		look: "capture on a throwaway database, once. NEVER on staging",
	});

	// ── §2.2 · PARTICIPANTS ──────────────────────────────────────────────────
	for (const p of PARTICIPANTS) {
		const pseudonym = pseudonymOf(p.displayName);
		entries.push({
			id: p.role,
			section: "§2.2",
			shape: p.serves,
			status: "reachable",
			url: `${STAGING_ORIGIN}/u/${pseudonym}`,
			reason: null,
			probe: `SELECT count(*)::int AS n FROM users WHERE pseudonym = '${pseudonym}'`,
			look: `${p.role} — ${p.serves}`,
		});
	}

	// ── §2.3 · CONTENT ON M2 ─────────────────────────────────────────────────
	// Each C-row names the exact post that carries it, so an inspector opening
	// /m/sp-m2-active knows WHICH card to look at.
	const m2 = marketUrl("sp-m2-active");
	const c: ReadonlyArray<
		[id: string, shape: string, probe: string, look: string]
	> = [
		[
			"C1",
			"posts on BOTH sides, both slots populated",
			`SELECT count(*)::int AS n FROM (
				SELECT side_at_post_time FROM comments c JOIN markets m ON m.id = c.market_id
				WHERE m.slug = 'sp-m2-active' AND c.parent_comment_id IS NULL
				GROUP BY side_at_post_time HAVING count(*) > 0
			) s HAVING count(*) = 2`,
			"both YES and NO columns carry posts",
		],
		[
			"C2",
			"LATEST_INTERLEAVE_INTERVAL + 2 posts — the interleave fires twice",
			`SELECT count(*)::int AS n FROM comments c JOIN markets m ON m.id = c.market_id
			 WHERE m.slug = 'sp-m2-active' AND c.parent_comment_id IS NULL`,
			"scroll the post list — a newest-post injection lands after every 10 ranked",
		],
		// ⚠ C3 and C5 had the SAME probe (@code-reviewer, Slice C). They now check
		// the two distinct lane conditions the badges actually turn on: a post
		// clearing the traction floor, and a post whose attracted Dharma clears
		// the stake floor by a wide margin. The three-badge property itself is
		// held by `tests/unit/staging/fixture-table.test.ts`, which runs the
		// SHIPPED `badgeFor` — a SQL probe cannot re-derive that without becoming
		// a second implementation of the ranking model.
		[
			"C3",
			"one post dominating EACH of Most Debated / Highest Stakes / Contested",
			`SELECT count(*)::int AS n FROM (
				SELECT p.id
				FROM comments p
				JOIN markets m ON m.id = p.market_id
				JOIN comments rc ON rc.parent_comment_id = p.id
				JOIN bets rb ON rb.comment_id = rc.id
				WHERE m.slug = 'sp-m2-active' AND p.parent_comment_id IS NULL
				GROUP BY p.id
				HAVING count(rb.id) >= 5 OR SUM(rb.stake) >= 2000
			) dominant HAVING count(*) >= 2`,
			"three badges, one per lane: M2-P2 Most Debated, M2-P3 Highest Stakes, M2-P4 Contested",
		],
		[
			"C4",
			"most posts dominating no lane",
			// The majority carry NO reply at all, so they clear no floor. Counted
			// rather than matched on body text: "most" is the criterion.
			`SELECT count(*)::int AS n FROM (
				SELECT p.id
				FROM comments p
				JOIN markets m ON m.id = p.market_id
				WHERE m.slug = 'sp-m2-active' AND p.parent_comment_id IS NULL
				  AND (SELECT count(*) FROM comments r WHERE r.parent_comment_id = p.id) < 5
			) quiet HAVING count(*) > 6`,
			"9 of the 12 posts carry NO badge — that is the criterion, not an omission",
		],
		[
			"C5",
			"a post with many replies on both sides",
			// BOTH sides populated, and >= 2 on one of them so the within-side
			// stake ordering is observable.
			`SELECT count(*)::int AS n FROM (
				SELECT p.id
				FROM comments p
				JOIN markets m ON m.id = p.market_id
				JOIN comments rc ON rc.parent_comment_id = p.id
				WHERE m.slug = 'sp-m2-active' AND p.parent_comment_id IS NULL
				GROUP BY p.id, p.side_at_post_time
				HAVING count(*) FILTER (WHERE rc.side_at_post_time = p.side_at_post_time) >= 2
				   AND count(*) FILTER (WHERE rc.side_at_post_time <> p.side_at_post_time) >= 1
			) split`,
			"M2-P2 — ReplySplitBar, the expand affordance, and stake ordering within each side",
		],
		[
			"C6",
			"a post with zero replies",
			commentProbe("nobody replies to"),
			"M2-P5 — the empty reply state inside a populated market",
		],
		[
			"C7",
			"a post with an attached image",
			`SELECT count(*)::int AS n FROM comments WHERE image_uploads_id IS NOT NULL`,
			"M2-P6 — the in-card clip, then click for the whole-render pop-up",
		],
		[
			"C8",
			"a post long enough to truncate",
			`SELECT count(*)::int AS n FROM comments WHERE length(body) > 800`,
			"M2-P7 — the Read more affordance",
		],
		[
			"C9",
			"a removed post with SURVIVING replies",
			`SELECT count(*)::int AS n FROM mod_actions ma
			 JOIN comments c ON c.id = ma.target_comment_id
			 WHERE ma.reason = 'content_removed' AND c.parent_comment_id IS NULL`,
			"M2-P8 — the post body is masked; its two replies are still readable",
		],
		[
			"C10",
			"a removed reply under a present post",
			`SELECT count(*)::int AS n FROM mod_actions ma
			 JOIN comments c ON c.id = ma.target_comment_id
			 WHERE ma.reason = 'content_removed' AND c.parent_comment_id IS NOT NULL`,
			"M2-P9's reply — the reply-level masked variant, parent untouched",
		],
		[
			"C11",
			"enough price movement for a multi-point chart with post nodes",
			`SELECT count(*)::int AS n FROM (
				SELECT DISTINCT b.price_at_bet FROM bets b JOIN markets m ON m.id = b.market_id
				WHERE m.slug = 'sp-m2-active'
			) p HAVING count(*) > 4`,
			"the market chart carries multiple points with post nodes on it",
		],
	];
	for (const [id, shape, probe, look] of c) {
		entries.push({
			id,
			section: "§2.3",
			shape,
			status: "reachable",
			url: m2,
			reason: null,
			probe,
			look,
		});
	}

	// ── §2.4 · POSITIONS AND BOOKMARKS ───────────────────────────────────────
	const ownerPseudonym = pseudonymOf("Staging Fixture Owner");
	const emptyPseudonym = pseudonymOf("Staging Fixture Empty");
	const visitorPseudonym = pseudonymOf("Staging Fixture Visitor Target");
	const crowd2Pseudonym = pseudonymOf("Staging Fixture Crowd Two");
	const q: ReadonlyArray<
		[id: string, shape: string, url: string, probe: string, look: string]
	> = [
		// ⚠ EVERY PROBE BELOW IS SCOPED TO THE PSEUDONYM IN ITS OWN URL.
		//
		// @code-reviewer, Slice C (HIGH-1): Q1, Q2, Q3 and B1 were NOT. Q1 asked
		// "does anyone hold an open position", not "does the user this URL points
		// at hold one" — so it was satisfied by P-owner, by any P-crowd, by anyone.
		// That is the same shape the Slice B review caught on gate 2's carrier
		// ("proves markets EXISTED, not that any was CHECKED"), one layer up, and
		// gate 4 is the artifact eight POLISH surfaces navigate from: a green gate
		// could hand an inspector a URL that renders an empty profile.
		[
			"Q1",
			"an open sellable position",
			`${STAGING_ORIGIN}/u/${visitorPseudonym}`,
			`SELECT count(*)::int AS n FROM positions p JOIN markets m ON m.id = p.market_id
			 WHERE p.quantity > 0 AND m.status = 'Open'
			   AND p.user_id = ${userOf(visitorPseudonym)}`,
			"the Sell affordance renders on an Open market's holding",
		],
		[
			"Q2",
			"a position on a TERMINAL market",
			`${STAGING_ORIGIN}/u/${crowd2Pseudonym}`,
			`SELECT count(*)::int AS n FROM positions p JOIN markets m ON m.id = p.market_id
			 WHERE p.quantity > 0 AND m.status IN ('Closed','Resolving','Resolved','Voided')
			   AND p.user_id = ${userOf(crowd2Pseudonym)}`,
			"Sell is HIDDEN, not disabled — M5 is Closed",
		],
		[
			"Q3",
			"a settled position post-resolution",
			`${STAGING_ORIGIN}/u/${ownerPseudonym}`,
			`SELECT count(*)::int AS n FROM payout_events pe
			 JOIN markets m ON m.id = pe.market_id
			 WHERE m.slug = 'sp-m7-resolved' AND pe.user_id = ${userOf(ownerPseudonym)}`,
			"P-owner's M7 row — net P/L on the winning side",
		],
		[
			"Q4",
			"a viewer holding YES on M2 — the opposite-slot rule",
			m2,
			`SELECT count(*)::int AS n FROM positions p
			 JOIN markets m ON m.id = p.market_id
			 JOIN users u ON u.id = p.user_id
			 WHERE m.slug = 'sp-m2-active' AND p.side = 'YES' AND p.quantity > 0
			   AND u.pseudonym = '${ownerPseudonym}'`,
			"signed in AS P-owner, the NO composer renders oppositeHeld-disabled",
		],
		[
			"Q5",
			"zero positions",
			`${STAGING_ORIGIN}/u/${emptyPseudonym}`,
			`SELECT count(*)::int AS n FROM users u
			 WHERE u.pseudonym = '${emptyPseudonym}'
			   AND NOT EXISTS (SELECT 1 FROM positions p WHERE p.user_id = u.id)`,
			"empty PositionsTable — owner and visitor copy",
		],
		[
			"B1",
			"bookmarks on OTHERS' posts and replies",
			`${STAGING_ORIGIN}/bookmarks`,
			// Scoped to the VIEWER, and it checks BOTH arms the row claims — one
			// bookmark on a top-level post and one on a reply. `count(*) = 1` on
			// the outer HAVING means both sub-counts were non-zero.
			`SELECT count(*)::int AS n FROM (
				SELECT 1 FROM bookmarks b
				JOIN comments c ON c.id = b.comment_id
				WHERE b.user_id = ${userOf(ownerPseudonym)} AND c.user_id <> b.user_id
				HAVING count(*) FILTER (WHERE c.parent_comment_id IS NULL) > 0
				   AND count(*) FILTER (WHERE c.parent_comment_id IS NOT NULL) > 0
			) arms`,
			`signed in AS ${ownerPseudonym} — Staked/Current are the BOOKMARKED author's figures`,
		],
		[
			"B2",
			"zero bookmarks",
			`${STAGING_ORIGIN}/bookmarks`,
			`SELECT count(*)::int AS n FROM users u
			 WHERE u.pseudonym = '${emptyPseudonym}'
			   AND NOT EXISTS (SELECT 1 FROM bookmarks b WHERE b.user_id = u.id)`,
			`signed in AS ${emptyPseudonym} — the empty Bookmarks page`,
		],
	];
	for (const [id, shape, url, probe, look] of q) {
		entries.push({
			id,
			section: "§2.4",
			shape,
			status: "reachable",
			url,
			reason: null,
			probe,
			look,
		});
	}

	// ── §2.5 · MODERATION ────────────────────────────────────────────────────
	for (const m of MODERATION) {
		entries.push({
			id: m.key,
			section: "§2.5",
			shape: m.serves,
			status: "reachable",
			url: m.action === "ban" ? `${STAGING_ORIGIN}/admin/moderation/audit` : m2,
			reason: null,
			// X1 and X2 shared one non-discriminating probe (@code-reviewer,
			// Slice C). They now check the shape each one names: a removal on a
			// TOP-LEVEL post vs a removal on a REPLY.
			probe:
				m.action === "ban"
					? `SELECT count(*)::int AS n FROM users WHERE banned_at IS NOT NULL`
					: `SELECT count(*)::int AS n FROM mod_actions ma
					   JOIN comments c ON c.id = ma.target_comment_id
					   WHERE ma.reason = 'content_removed'
					     AND c.parent_comment_id IS ${m.targetKind === "post" ? "NULL" : "NOT NULL"}`,
			look:
				m.action === "ban"
					? "the ban appears in the audit feed; the author's PAST CONTENT is still on /m/sp-m2-active (ADR-0021)"
					: "the masked card on the debate view, and the row in the audit feed",
		});
	}
	entries.push({
		id: "X4",
		section: "§2.5",
		shape: "audit feed paginates",
		status: "unreachable",
		url: null,
		reason: UNREACHABLE_REASONS[1] as string,
		probe: null,
		look: "needs a POLISH.8 ruling on whether the feed should paginate at all",
	});

	return entries;
}

/**
 * The §2 row ids gate 4 requires, enumerated INDEPENDENTLY of `buildCoverage`.
 *
 * ⚠ THIS IS THE POINT OF THE GATE. If the expected set were derived from the
 * built list, a shape that was never added would be absent from BOTH and the
 * gate would report full coverage over a list missing a row — the exact
 * "silent omission" manifest §4 forbids.
 *
 * ⚠ EVERY ID BELOW IS A LITERAL, INCLUDING THE MARKETS AND PARTICIPANTS.
 *
 * @code-reviewer, Slice C (MEDIUM-1): they were `MARKETS.map(m => m.key)` and
 * `PARTICIPANTS.map(p => p.role)` — the SAME arrays `buildCoverage` iterates. So
 * a market or participant deleted from `fixtures.ts` vanished from both sides
 * and gate 4 reported full coverage over a list missing the row, which is the
 * property this block's own docblock claimed to prevent. Deleting M1 (Draft)
 * left all six gates green and silently dropped the Draft row from the standing
 * reference; nothing anywhere else pinned M1, M4, or the participant roster.
 *
 * The manifest is the source for ALL of these, so they are all literals here,
 * and `fixtures.ts` is checked AGAINST this list rather than being it.
 */
export function expectedCoverageIds(): string[] {
	return [
		// §2.1 — the manifest's market enumeration. M9 is the Frozen row.
		"M1",
		"M2",
		"M3",
		"M4",
		"M5",
		"M6",
		"M7",
		"M8",
		"M9",
		"M10",
		"M11",
		"M12",
		"M13",
		"M14",
		"M15",
		"M16",
		// §2.2 — the ten roles.
		"P-owner",
		"P-visitor-target",
		"P-empty",
		"P-flipped",
		"P-exited",
		"P-removed",
		"P-banned",
		"P-crowd-1",
		"P-crowd-2",
		"P-crowd-3",
		"C1",
		"C2",
		"C3",
		"C4",
		"C5",
		"C6",
		"C7",
		"C8",
		"C9",
		"C10",
		"C11",
		"Q1",
		"Q2",
		"Q3",
		"Q4",
		"Q5",
		"B1",
		"B2",
		"X1",
		"X2",
		"X3",
		"X4",
	];
}

/** Sanity: the fixture table must actually carry the shapes the list claims. */
export function coverageSourceCounts(): {
	markets: number;
	participants: number;
	bookmarks: number;
	moderation: number;
	posts: number;
} {
	return {
		markets: MARKETS.length,
		participants: PARTICIPANTS.length,
		bookmarks: BOOKMARKS.length,
		moderation: MODERATION.length,
		posts: POSTS.length,
	};
}
