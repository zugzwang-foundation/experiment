import "server-only";

import { eq, sql } from "drizzle-orm";

import type { DbClient } from "@/db";
import { pools, users } from "@/db/schema";
import { DAILY_CREDIT_DHARMA } from "@/server/config/limits";
import { computeSell } from "@/server/cpmm/calculate";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { utcDayOf } from "@/server/dharma/accrual";
import { readBalance } from "@/server/dharma/persist";
import { getHeldPosition } from "@/server/positions/read";

/**
 * UI.A2 §3.3 — the viewer-session context: a composed server read, NOT an
 * endpoint (ADR-0019 Architecture 2). Invoked by the `/m/[slug]` page RSC
 * BESIDE `loadDebateView` — the masking gate stays viewer-independent
 * (SG-3); this module is the separate, session-scoped read. The DTO field
 * set is RATIFIED (OQ-3): NO `staked` field — the Đa staked-basis is a
 * founder ruling owed before A3 renders it.
 *
 * READ-ONLY BY LAW (the plan-§1 INV-2 "read-that-writes" narrative): no
 * ledger append, no accrual write, no cursor write, no events row — ever.
 * `spendableToday` is arithmetic over the cursor, NEVER a call into
 * `accrueDailyCredit` (the tempting reuse would turn every page load by an
 * unpaid-today user into a Daily-Credit mint without a commented bet —
 * attendance becoming issuance, ADR-0018's rejected Option 4). The parity
 * integration test (`viewer-context.integration.test.ts`) binds this
 * preview to `accrueDailyCredit`'s own paid/unpaid behavior via the SHARED
 * `utcDayOf` import, so the two cannot drift apart silently.
 */
export type ViewerMarketContext = {
	position: {
		side: "YES" | "NO";
		quantity: string;
		/**
		 * Đb — the sell-all execution value NOW: `computeSell(quantity).proceeds`,
		 * impact-inclusive per cpmm §6.3 (what a seller actually receives). RULED
		 * (FI-2): a CHOICE vs the rejected mark-to-p1 spot mark. Inheritance law:
		 * A5 Profile's "Current" column + "Positions value" tile INHERIT this
		 * basis — one holding never shows two different current values.
		 */
		currentValue: string;
	} | null;
	/** `readBalance` — the latest ledger `balance_after` (seq-ordered, ADR-0029). */
	balance: string;
	/** balance + (unpaid-today ? DAILY_CREDIT_DHARMA : 0) — READ-ONLY preview. */
	spendableToday: string;
	/**
	 * D-52 R1 — the ids of the viewer's OWN top-level posts in this market. The
	 * client (the UI half, PR #569) derives `isOwnPost` per post from it: on the
	 * viewer's own post both reply controls render disabled, because nobody
	 * replies to their own post.
	 * POST ids only, never a user id, so no author identity crosses to the client.
	 * Optional at the type level because this DTO is built as a literal in the
	 * render fixtures and an absent value reads as "none" — the
	 * `ReplyAggregate.friendlyFireDharma` precedent (A-13);
	 * `loadViewerMarketContext` ALWAYS sets it. UI guidance only: the write path's
	 * `self_reply_forbidden` is the guard.
	 */
	ownPostIds?: string[];
};

/**
 * The pure Daily-Credit preview. Unpaid ⇔ `cursor === null ||
 * utcDayOf(cursor) !== utcDayOf(now)` — the SHARED `utcDayOf` from
 * `accrual.ts`, never re-derived day math. Exists because the place path
 * pays the day's credit BEFORE the F-BET-4 balance check (`place.ts` R4) —
 * a composer gating affordability on raw `balance` would wrongly block a
 * stake the endpoint accepts. Unpaid → exact 18-dp decimal add (CLAUDE.md
 * §2 — never a JS float); paid → the balance string passes through
 * byte-identical.
 */
export function computeSpendableToday(args: {
	balance: string;
	cursor: Date | null;
	now: Date;
}): string {
	const unpaid =
		args.cursor === null || utcDayOf(args.cursor) !== utcDayOf(args.now);
	return unpaid
		? new CpmmDecimal(args.balance).plus(DAILY_CREDIT_DHARMA).toFixed(18)
		: args.balance;
}

/**
 * Compose the viewer's market context in ONE transaction issuing SELECTs
 * only — zero writes (default READ COMMITTED; display-grade reads, no
 * snapshot-consistency claim). Reads: `getHeldPosition` (inherits the ≤1-held single-side
 * assert), `readBalance`, the `users` cursor + the tx clock + (D-52) the
 * viewer's own post ids in one statement (the `accrual.ts` single-clock
 * pattern — `.mapWith` is load-bearing, a bare sql fragment has no runtime
 * Date decoder), and the
 * pool row ONLY when a position is held (a null position needs no pool
 * read beyond the header's).
 *
 * UNWIRE-1 — the two BOOKMARK-ADD-WIRE SELECTs (Q-A/Q-B, `bookmarkedCommentIds`/
 * `ownCommentIds`) that used to sit in this same transaction are removed: the
 * bookmark module is unwired product-wide (founder ruling, SPEC.2 §4.2/ADR-0034's
 * field-level description of those two fields is now a documented divergence —
 * see the Gate C packet, not amended here). `held`/`balance` stay: they back
 * `position`/`balance` independent of bookmarks and always needed this
 * transaction open. This module, NOT `loadDebateView`, is where viewer-scoped
 * debate state lives: ADR-0025 binds the public `.md` export to
 * `loadDebateView`'s `DebateViewModel`, so putting per-viewer state on that
 * model would put private state into a public export's input type.
 * `loadDebateView`'s signature and DTO are untouched.
 */
export async function loadViewerMarketContext(
	client: DbClient,
	args: { userId: string; marketId: string },
): Promise<ViewerMarketContext> {
	return client.transaction(async (tx) => {
		const held = await getHeldPosition(tx, args);
		const balance = await readBalance(tx, args.userId);

		const rows = await tx
			.select({
				cursor: users.lastAllowanceAccruedAt,
				txNow: sql`now()`.mapWith(users.lastAllowanceAccruedAt),
				// D-52 R1 — the viewer's own top-level posts here, folded into THIS
				// statement as a scalar subquery rather than read by a fourth:
				// `round-trip-budget.test.ts` pins this module at three statements with
				// no held position, and the polled page pays every statement twice a
				// minute per open tab. `json_agg` rather than an `array(...)` because
				// postgres-js decodes `json` out of the box, where `uuid[]` needs its
				// fetched type table. Ids only — no body, so SC-1 has nothing to mask;
				// removed posts stay IN, since a reply to one is still a self-reply.
				// ⚠ RAW, ALIASED NAMES and the ids as PARAMETERS, the
				// `market-totals.ts` shape — not `${comments.userId} = ${users.id}`.
				// In a single-table select Drizzle renders every column inside an
				// `sql` field UNQUALIFIED, so that correlation became `"user_id" =
				// "id"`, resolved inside the subquery to `comments.id`, and matched
				// nothing: an always-empty set that every statement count and every
				// existing shape assertion passed.
				ownPostIds: sql<
					string[]
				>`coalesce((select json_agg(c.id order by c.id) from comments c where c.user_id = ${args.userId} and c.market_id = ${args.marketId} and c.parent_comment_id is null), '[]'::json)`,
			})
			.from(users)
			.where(eq(users.id, args.userId));
		const row = rows[0];
		if (row === undefined) {
			// Caller bug — the page only calls this with a session-vouched user id.
			throw new Error(
				`loadViewerMarketContext: no users row for ${args.userId}`,
			);
		}
		const spendableToday = computeSpendableToday({
			balance,
			cursor: row.cursor,
			now: row.txNow,
		});

		let position: ViewerMarketContext["position"] = null;
		if (held !== null) {
			const poolRows = await tx
				.select({
					yesReserves: pools.yesReserves,
					noReserves: pools.noReserves,
				})
				.from(pools)
				.where(eq(pools.marketId, args.marketId))
				.limit(1);
			const pool = poolRows[0];
			if (pool === undefined) {
				// Structurally impossible: positions only mint inside the pool-locked
				// W-1 tx (markets seed at open, ENGINE.14) — an internal-invariant
				// guard, mirroring place()'s RETURNING-empty guards. No new wire code.
				throw new Error(
					`loadViewerMarketContext: no pool row for market ${args.marketId} with a held position`,
				);
			}
			const sell = computeSell({
				reserves: { yes: pool.yesReserves, no: pool.noReserves },
				side: held.side === "YES" ? "yes" : "no",
				shares: held.quantity,
			});
			position = {
				side: held.side,
				quantity: held.quantity,
				currentValue: sell.proceeds,
			};
		}

		return {
			position,
			balance,
			spendableToday,
			ownPostIds: row.ownPostIds,
		};
	});
}
