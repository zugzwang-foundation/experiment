/**
 * DEBATE.8 live verification — proves the read-time ranking model works against
 * the STAGING database after migration 0017 (the `comments.stake_at_post_time`
 * drop). This is the stratum's "done" bar: the four per-side aggregates compute,
 * and `ranking.ts` produces a Top order + lane-dominance badges against real
 * staging rows — not merely CI green.
 *
 * Operator usage:
 *   doppler run --config stg -- pnpm tsx scripts/verify-ranking-staging.ts
 *
 * It runs an INLINE `postgres()` client (NOT the `@/db` → `server-only` chain,
 * per the staging-seed/smoke convention) and imports the PURE `ranking.ts`
 * (no IO, no `server-only`, importable from tsx). It refuses to run unless
 * `DATABASE_URL_STAGING` contains `STAGING_PROJECT_REF_FRAGMENT` (the same guard
 * `migrate-staging.ts` uses).
 *
 * Steps: (1) schema check — the column is gone, `comments_ranking_idx` survives;
 * (2) seed a fresh, clearly-labelled demo market with posts + two-sided
 * reply-bets engineered so one post dominates the contestation badge lane;
 * (3) run the SAME aggregate query as `src/server/debate-view/ranking-substrate.ts`;
 * (4) feed the substrate to `ranking.ts` and print the four aggregates + the Top
 * order + the per-post badge. Seeded rows are INSERT-only (Bucket-A append-only),
 * attributed to an existing staging user, under a `debate8-ranking-demo-*` slug.
 */

import { randomUUID } from "node:crypto";

import postgres from "postgres";

import { badgeFor, buildTopList, type PostSubstrate } from "../src/lib/ranking";

const DBURL = process.env.DATABASE_URL_STAGING;
const FRAG = process.env.STAGING_PROJECT_REF_FRAGMENT;

if (!DBURL) {
	console.error(
		"[verify-ranking] DATABASE_URL_STAGING not set. Run: doppler run --config stg -- pnpm tsx scripts/verify-ranking-staging.ts",
	);
	process.exit(1);
}
if (!FRAG || !DBURL.includes(FRAG)) {
	console.error(
		"[verify-ranking] STAGING_PROJECT_REF_FRAGMENT guard failed — refusing to run against a URL that is not the staging project.",
	);
	process.exit(1);
}

const sql = postgres(DBURL, { max: 2 });

// The demo fixture (placeholder constants n≥5, D≥200, n^b≥3, k_lane=3,
// floor_split=6): P1 is big-and-even → its n^b (=8) is the SOLE contestation
// floor-clearer → SENTINEL → P1 earns the **Contested** badge; P2/P3 are
// lopsided (n^b ≈ 1.43 < 3) and earn no badge.
const FIXTURE = [
	{
		key: "P1",
		side: "YES",
		authorStake: "300",
		support: 4,
		counter: 4,
		replyStake: "60",
	},
	{
		key: "P2",
		side: "YES",
		authorStake: "240",
		support: 1,
		counter: 5,
		replyStake: "50",
	},
	{
		key: "P3",
		side: "NO",
		authorStake: "180",
		support: 5,
		counter: 1,
		replyStake: "55",
	},
] as const;

async function main(): Promise<void> {
	// 1 — schema check.
	const col = await sql`
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'comments' AND column_name = 'stake_at_post_time'`;
	const idx = await sql`
		SELECT 1 FROM pg_indexes
		WHERE tablename = 'comments' AND indexname = 'comments_ranking_idx'`;
	const colGone = col.length === 0;
	const idxKept = idx.length > 0;
	console.log(
		`[schema] comments.stake_at_post_time dropped : ${colGone ? "yes ✓" : "NO ✗"}`,
	);
	console.log(
		`[schema] comments_ranking_idx survives        : ${idxKept ? "yes ✓" : "NO ✗"}`,
	);
	if (!colGone || !idxKept) throw new Error("staging schema check failed");

	// 2 — seed a fresh demo market (reuse an existing user as the FK target).
	const [user] = await sql`SELECT id FROM users LIMIT 1`;
	if (!user)
		throw new Error("no users on staging to attribute the demo fixture");
	const userId = user.id as string;

	const tag = randomUUID().slice(0, 8);
	const [market] = await sql`
		INSERT INTO markets (slug, title, resolution_deadline)
		VALUES (${`debate8-ranking-demo-${tag}`}, ${`DEBATE.8 ranking demo ${tag}`},
			now() + interval '30 days')
		RETURNING id`;
	const marketId = market?.id as string;

	const keyById = new Map<string, string>();
	for (const p of FIXTURE) {
		const [post] = await sql`
			INSERT INTO comments (user_id, market_id, side_at_post_time, body)
			VALUES (${userId}, ${marketId}, ${p.side}, ${`${p.key} post`})
			RETURNING id`;
		const postId = post?.id as string;
		keyById.set(postId, p.key);
		// The post's own entry bet → author stake `a`.
		await sql`
			INSERT INTO bets (user_id, market_id, side, stake, share_quantity, price_at_bet, comment_id)
			VALUES (${userId}, ${marketId}, ${p.side}, ${p.authorStake}, '0', '0.5', ${postId})`;
		const oppSide = p.side === "YES" ? "NO" : "YES";
		const replySides = [
			...Array(p.support).fill(p.side), // Support = same side as the post
			...Array(p.counter).fill(oppSide), // Counter = opposing side
		] as ("YES" | "NO")[];
		for (const side of replySides) {
			const [reply] = await sql`
				INSERT INTO comments (user_id, market_id, side_at_post_time, body, parent_comment_id)
				VALUES (${userId}, ${marketId}, ${side}, ${`${p.key} reply`}, ${postId})
				RETURNING id`;
			await sql`
				INSERT INTO bets (user_id, market_id, side, stake, share_quantity, price_at_bet, comment_id)
				VALUES (${userId}, ${marketId}, ${side}, ${p.replyStake}, '0', '0.5', ${reply?.id})`;
		}
	}

	// 3 — the SAME aggregate query as ranking-substrate.ts (join via bets.comment_id).
	const rows = await sql`
		SELECT
			p.id,
			p.side_at_post_time AS parent_side,
			p.created_at,
			pb.stake AS author_stake,
			pb.price_at_bet AS price_at_bet,
			COUNT(rb.id) FILTER (WHERE rc.side_at_post_time = p.side_at_post_time) AS support_count,
			COUNT(rb.id) FILTER (WHERE rc.side_at_post_time <> p.side_at_post_time) AS counter_count,
			COALESCE(SUM(rb.stake) FILTER (WHERE rc.side_at_post_time = p.side_at_post_time), 0) AS support_dharma,
			COALESCE(SUM(rb.stake) FILTER (WHERE rc.side_at_post_time <> p.side_at_post_time), 0) AS counter_dharma
		FROM comments p
		JOIN LATERAL (
			SELECT b.stake, b.price_at_bet FROM bets b
			WHERE b.comment_id = p.id
			ORDER BY b.created_at ASC, b.id ASC
			LIMIT 1
		) pb ON true
		LEFT JOIN comments rc ON rc.parent_comment_id = p.id
		LEFT JOIN bets rb ON rb.comment_id = rc.id
		WHERE p.market_id = ${marketId} AND p.parent_comment_id IS NULL
		GROUP BY p.id, p.side_at_post_time, p.created_at, pb.stake, pb.price_at_bet
		ORDER BY p.created_at ASC, p.id ASC`;

	const substrate: PostSubstrate[] = rows.map((r) => ({
		id: r.id as string,
		parentSide: r.parent_side as "YES" | "NO",
		supportCount: Number(r.support_count),
		counterCount: Number(r.counter_count),
		supportDharma: r.support_dharma as string,
		counterDharma: r.counter_dharma as string,
		createdAt: new Date(r.created_at as string),
		authorStake: r.author_stake as string,
		priceAtBet: r.price_at_bet as string,
	}));

	// 4 — compute + print.
	console.log(
		`\n[aggregates] market ${marketId} — ${substrate.length} posts (the four per-side signals):`,
	);
	for (const s of substrate) {
		console.log(
			`  ${keyById.get(s.id)} (${s.id.slice(0, 8)}) side=${s.parentSide}  ` +
				`support=${s.supportCount}/Đ${s.supportDharma}  counter=${s.counterCount}/Đ${s.counterDharma}  a=Đ${s.authorStake}`,
		);
	}

	console.log(`\n[Top order + latest interleave + lane-dominance badge]`);
	const ordered = buildTopList(substrate);
	ordered.forEach((p, i) => {
		const badge = badgeFor(p, substrate);
		console.log(
			`  ${i + 1}. ${keyById.get(p.id)} (${p.id.slice(0, 8)}) side=${p.parentSide}  badge=${badge ?? "—"}`,
		);
	});

	const badged = ordered.filter((p) => badgeFor(p, substrate) !== null).length;
	console.log(
		`\n✓ DEBATE.8 staging verification PASSED: ${substrate.length} posts' four aggregates computed live, ` +
			`Top order produced, ${badged} badge(s) fired.`,
	);
	await sql.end();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
