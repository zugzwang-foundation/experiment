import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { bets, comments, dharmaLedger } from "@/db/schema";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";

import type { ProfilePositionRow } from "./positions";

/** A bound read client — top-level `db` OR a caller's transaction. */
type ProfileReader = DbClient | DbTransaction;

const CANONICAL_ZERO = "0.000000000000000000";

/** The six §23 account tiles — all read-time, all money server-formatted strings. */
export type ProfileTiles = {
	/** Wallet value — free Dharma: latest `dharma_ledger.balance_after`. */
	walletValue: string;
	/** Positions value — Σ Đb over the OPEN holdings (structural inheritance). */
	positionsValue: string;
	/** Net P/L (lifetime) — net worth − Σ issuance; MAY be negative. */
	netProfitLoss: string;
	/** Arguments — authored posts + replies (removed comments counted). */
	argumentsCount: { total: number; posts: number; replies: number };
	/** Σ reply-bet stakes SAME-side as the user's top-level posts (removed counted). */
	supportReceived: string;
	/** Σ reply-bet stakes OPPOSITE-side to the user's top-level posts. */
	counterReceived: string;
};

/**
 * Derive the six §23 tiles for a profile user. `positionsValue` is a STRUCTURAL
 * Σ over the PASSED position rows where `settled === false` — the FI-2
 * inheritance law (§10.8): the tile never recomputes Đb, it sums the single
 * value each open row already carries, so one holding never shows two current
 * values. Read-only; no store.
 */
export async function loadProfileTiles(
	client: ProfileReader,
	args: { userId: string; positions: ProfilePositionRow[] },
): Promise<ProfileTiles> {
	const { userId, positions } = args;

	// Wallet — the latest ledger balance (ORDER BY seq DESC LIMIT 1, the
	// ADR-0029 total-order read; `readBalance` authority, replicated to stay a
	// pure non-transactional read here).
	const balanceRows = await client
		.select({ balanceAfter: dharmaLedger.balanceAfter })
		.from(dharmaLedger)
		.where(eq(dharmaLedger.userId, userId))
		.orderBy(desc(dharmaLedger.seq))
		.limit(1);
	// Re-normalize to the 18-dp canonical form (the column round-trips at 18 dp
	// already; this keeps every money field on the same discipline).
	const walletValue = toFixed18(
		new CpmmDecimal(balanceRows[0]?.balanceAfter ?? CANONICAL_ZERO),
	);

	// Positions value — Σ over the PASSED open rows (settled === false). Byte-
	// exact string sum via CpmmDecimal; never a JS float (CLAUDE.md §2).
	const positionsValue = positions
		.filter((p) => !p.settled)
		.reduce((acc, p) => acc.plus(p.current), new CpmmDecimal(0));

	// Net worth = Wallet + Positions value. Net P/L (lifetime) = net worth −
	// Σ issuance (initial_grant + daily_allowance ledger amounts).
	const issuanceRows = await client
		.select({
			total: sql<string>`COALESCE(SUM(${dharmaLedger.amount}), 0)`,
		})
		.from(dharmaLedger)
		.where(
			and(
				eq(dharmaLedger.userId, userId),
				inArray(dharmaLedger.entryType, ["initial_grant", "daily_allowance"]),
			),
		);
	const issuance = new CpmmDecimal(issuanceRows[0]?.total ?? "0");
	const netWorth = new CpmmDecimal(walletValue).plus(positionsValue);
	const netProfitLoss = netWorth.minus(issuance);

	// Arguments — authored posts (parent_comment_id IS NULL) + replies; removed
	// comments COUNT (history is append-only, §23).
	const countRows = await client
		.select({
			isReply: sql<boolean>`${comments.parentCommentId} IS NOT NULL`,
			count: sql<number>`COUNT(*)::int`,
		})
		.from(comments)
		.where(eq(comments.userId, userId))
		.groupBy(sql`${comments.parentCommentId} IS NOT NULL`);
	let posts = 0;
	let replies = 0;
	for (const r of countRows) {
		if (r.isReply) {
			replies = r.count;
		} else {
			posts = r.count;
		}
	}

	// Support / Counter received — Σ reply-bet stakes over the user's TOP-LEVEL
	// posts (removed posts' attracted Dharma counts; replies attract nothing —
	// only top-level posts aggregate, §9). A reply-bet is reached via the
	// circular pair `rb.comment_id = rc.id` (NEVER `comments.bet_id`, deliberately
	// NULL); it is Support when the reply's `side_at_post_time` equals the parent
	// post's, Counter otherwise (INV-3 read-time aggregate, ADR-0017). Raw `sql`
	// self-join — the `ranking-substrate.ts` pattern for a comments↔comments↔bets
	// walk.
	const supportCounterRows = await client.execute<{
		support: string;
		counter: string;
	}>(sql`
		SELECT
			COALESCE(SUM(rb.stake) FILTER (
				WHERE rc.side_at_post_time = pc.side_at_post_time
			), 0)::text AS support,
			COALESCE(SUM(rb.stake) FILTER (
				WHERE rc.side_at_post_time <> pc.side_at_post_time
			), 0)::text AS counter
		FROM ${comments} pc
		JOIN ${comments} rc ON rc.parent_comment_id = pc.id
		JOIN ${bets} rb ON rb.comment_id = rc.id
		WHERE pc.user_id = ${userId} AND pc.parent_comment_id IS NULL
	`);
	const supportCounter = supportCounterRows[0];
	const supportReceived = toFixed18(
		new CpmmDecimal(supportCounter?.support ?? "0"),
	);
	const counterReceived = toFixed18(
		new CpmmDecimal(supportCounter?.counter ?? "0"),
	);

	return {
		walletValue,
		positionsValue: toFixed18(positionsValue),
		netProfitLoss: toFixed18(netProfitLoss),
		argumentsCount: { total: posts + replies, posts, replies },
		supportReceived,
		counterReceived,
	};
}
