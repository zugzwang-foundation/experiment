/**
 * DEBATE.4 staging seed — produces the participant-write-shaped data the §9
 * staging-verify walk needs but which cannot be hand-created through the app
 * (there is no participant write path yet, and admins are not participants).
 * It seeds three markets covering every §9 case:
 *
 *   A (Open)  — two-sided posts + replies, Top order, a dominant post (a lane
 *               badge), two-slot + expand, the Đ aggregate, the none/Flipped/
 *               Exited markers, a `content_removed` post whose thread survives,
 *               and an image on both a present and the removed post.
 *   B (Resolved) — a terminal market: the read-only lifecycle marker.
 *   C (Open)  — posts on the YES side only: the empty NO-side CTA.
 *
 * Operator usage:
 *   doppler run --config stg -- pnpm tsx scripts/seed-debate-view-staging.ts
 *
 * It runs an INLINE `postgres()` client (NOT the `@/db` → `server-only` chain,
 * per the staging-seed/smoke convention) and refuses to run unless
 * `DATABASE_URL_STAGING` contains `STAGING_PROJECT_REF_FRAGMENT` (the guard
 * `migrate-staging.ts` / `verify-ranking-staging.ts` use). Every run uses a fresh
 * random tag, so re-runs append fresh markets/users (Bucket-A append-only) and
 * never collide on the `markets.slug` / `users.pseudonym` uniques.
 *
 * IMAGE CAVEAT (§9.7): the image rows point at `r2_object_key`s with no real R2
 * object behind them. The debate view will mint a presigned GET URL and render
 * an <img> (the URL-minting + DOM are verifiable), but the picture loads only if
 * the operator uploads a real object at that key. The §9.2 SAFETY check (a
 * removed post's image is withheld) holds regardless — its URL is never minted.
 */

import { randomUUID } from "node:crypto";

import postgres from "postgres";

const DBURL = process.env.DATABASE_URL_STAGING;
const FRAG = process.env.STAGING_PROJECT_REF_FRAGMENT;

if (!DBURL) {
	console.error(
		"[seed-debate-view] DATABASE_URL_STAGING not set. Run: doppler run --config stg -- pnpm tsx scripts/seed-debate-view-staging.ts",
	);
	process.exit(1);
}
if (!FRAG || !DBURL.includes(FRAG)) {
	console.error(
		"[seed-debate-view] STAGING_PROJECT_REF_FRAGMENT guard failed — refusing to run against a URL that is not the staging project.",
	);
	process.exit(1);
}

const sql = postgres(DBURL, { max: 2 });
const tag = randomUUID().slice(0, 8);

type Side = "YES" | "NO";

async function mkUser(label: string): Promise<string> {
	const [u] = await sql<{ id: string }[]>`
		INSERT INTO users (name, email, pseudonym)
		VALUES (${`Demo ${label}`}, ${`${label}-${tag}@stg.example`}, ${`${label}-${tag}`})
		RETURNING id`;
	return u?.id as string;
}

async function mkPosition(
	userId: string,
	marketId: string,
	side: Side,
	quantity: string,
): Promise<void> {
	await sql`
		INSERT INTO positions (user_id, market_id, side, quantity)
		VALUES (${userId}, ${marketId}, ${side}, ${quantity})`;
}

async function mkMarket(
	slug: string,
	title: string,
	status: string,
	opts: { resolved?: Side } = {},
): Promise<string> {
	const [m] = await sql<{ id: string }[]>`
		INSERT INTO markets (slug, title, description, status, resolution_deadline, resolved_at, resolution_outcome)
		VALUES (
			${slug}, ${title},
			${"Resolution criterion: settled by the documented evidence at the deadline."},
			${status}, now() + interval '30 days',
			${opts.resolved ? sql`now()` : null},
			${opts.resolved ?? null}
		)
		RETURNING id`;
	const marketId = m?.id as string;
	await sql`
		INSERT INTO pools (market_id, yes_reserves, no_reserves)
		VALUES (${marketId}, '120.000000000000000000', '80.000000000000000000')`;
	return marketId;
}

async function mkImage(userId: string): Promise<string> {
	const key = `uploads/debate4-${tag}-${randomUUID().slice(0, 6)}.webp`;
	const [img] = await sql<{ id: string }[]>`
		INSERT INTO image_uploads (user_id, r2_object_key, content_type, byte_size, terminal_state, terminal_at)
		VALUES (${userId}, ${key}, 'image/webp', 4096, 'committed', now())
		RETURNING id`;
	return img?.id as string;
}

async function mkComment(args: {
	marketId: string;
	userId: string;
	side: Side;
	stake: string;
	body: string;
	parentCommentId: string | null;
	imageUploadsId?: string | null;
	createdAt: string;
}): Promise<string> {
	const [c] = await sql<{ id: string }[]>`
		INSERT INTO comments (user_id, market_id, side_at_post_time, body, parent_comment_id, image_uploads_id, created_at)
		VALUES (${args.userId}, ${args.marketId}, ${args.side}, ${args.body},
			${args.parentCommentId}, ${args.imageUploadsId ?? null}, ${args.createdAt})
		RETURNING id`;
	const commentId = c?.id as string;
	await sql`
		INSERT INTO bets (user_id, market_id, side, stake, share_quantity, price_at_bet, comment_id, created_at)
		VALUES (${args.userId}, ${args.marketId}, ${args.side}, ${args.stake}, '0', '0.5', ${commentId}, ${args.createdAt})`;
	return commentId;
}

async function removeComment(commentId: string): Promise<void> {
	await sql`
		INSERT INTO mod_actions (target_comment_id, reason, verdict, categories, actor_id)
		VALUES (${commentId}, 'content_removed', NULL, '{}'::jsonb, 'admin-singleton')`;
}

const at = (h: number, m: number): string =>
	`2026-09-15T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;

async function main(): Promise<void> {
	console.log(
		`[seed-debate-view] tag=${tag} target=${new URL(DBURL as string).host}`,
	);

	// ── Market A — the full two-sided demo ─────────────────────────────────────
	const a = await mkMarket(
		`debate4-demo-${tag}`,
		`DEBATE.4 demo — two-sided debate (${tag})`,
		"Open",
	);

	const u1 = await mkUser("alice"); // P1 author — holds YES → none
	const u2 = await mkUser("bob"); // R1a (YES) author — holds NO → Flipped
	const u3 = await mkUser("carol"); // R1b (NO) author — sold to zero → Exited
	const u9 = await mkUser("dave"); // P1 filler replies — none
	const u10 = await mkUser("erin"); // P1 filler reply — none
	const u4 = await mkUser("frank"); // P2 (NO) author — holds YES → Flipped
	const u5 = await mkUser("gina"); // R2a author — none
	const u6 = await mkUser("removed"); // P3 author — content_removed
	const u7 = await mkUser("heidi"); // R3a author — survives under removed parent
	const u8 = await mkUser("ivan"); // P4 author — no position → Exited

	await mkPosition(u1, a, "YES", "200.000000000000000000");
	await mkPosition(u2, a, "NO", "50.000000000000000000"); // opposite of R1a's YES
	await mkPosition(u3, a, "YES", "0.000000000000000000"); // sold to zero → Exited
	await mkPosition(u9, a, "YES", "100.000000000000000000");
	await mkPosition(u10, a, "NO", "40.000000000000000000");
	await mkPosition(u4, a, "YES", "100.000000000000000000"); // opposite of P2's NO
	await mkPosition(u5, a, "NO", "40.000000000000000000");
	await mkPosition(u6, a, "YES", "50.000000000000000000"); // irrelevant (removed)
	await mkPosition(u7, a, "YES", "30.000000000000000000");
	// u8 — NO position row → Exited.

	const imgPresent = await mkImage(u1);
	const imgRemoved = await mkImage(u6);

	// P1 (YES) — the dominant post: 6 replies (4 YES support, 2 NO counter) → a
	// lane badge. Carries an image (§9.7).
	const p1 = await mkComment({
		marketId: a,
		userId: u1,
		side: "YES",
		stake: "200.000000000000000000",
		body: "YES will happen — the strongest case.\n\nThe evidence has been trending this way for weeks, and the base rate favours it.\n\nThis is the full argument shown in the pop-up.",
		parentCommentId: null,
		imageUploadsId: imgPresent,
		createdAt: at(0, 1),
	});
	await mkComment({
		marketId: a,
		userId: u2,
		side: "YES",
		stake: "80.000000000000000000",
		body: "Support: agreed, the momentum is real.",
		parentCommentId: p1,
		createdAt: at(1, 0),
	});
	await mkComment({
		marketId: a,
		userId: u3,
		side: "NO",
		stake: "70.000000000000000000",
		body: "Counter: the momentum is priced in already.",
		parentCommentId: p1,
		createdAt: at(1, 1),
	});
	await mkComment({
		marketId: a,
		userId: u9,
		side: "YES",
		stake: "70.000000000000000000",
		body: "Support: second the base-rate point.",
		parentCommentId: p1,
		createdAt: at(1, 2),
	});
	await mkComment({
		marketId: a,
		userId: u9,
		side: "YES",
		stake: "65.000000000000000000",
		body: "Support: and the latest data confirms it.",
		parentCommentId: p1,
		createdAt: at(1, 3),
	});
	await mkComment({
		marketId: a,
		userId: u9,
		side: "YES",
		stake: "60.000000000000000000",
		body: "Support: holding my YES.",
		parentCommentId: p1,
		createdAt: at(1, 4),
	});
	await mkComment({
		marketId: a,
		userId: u10,
		side: "NO",
		stake: "60.000000000000000000",
		body: "Counter: I think this reverses.",
		parentCommentId: p1,
		createdAt: at(1, 5),
	});

	// P2 (NO) — author Flipped; one support reply.
	const p2 = await mkComment({
		marketId: a,
		userId: u4,
		side: "NO",
		stake: "150.000000000000000000",
		body: "NO is the call.\n\nThe deadline is too close for the remaining steps.",
		parentCommentId: null,
		createdAt: at(0, 2),
	});
	await mkComment({
		marketId: a,
		userId: u5,
		side: "NO",
		stake: "60.000000000000000000",
		body: "Support: the timeline doesn't add up.",
		parentCommentId: p2,
		createdAt: at(2, 0),
	});

	// P3 (YES) — CONTENT_REMOVED; its one reply survives (thread intact, §9.2).
	const p3 = await mkComment({
		marketId: a,
		userId: u6,
		side: "YES",
		stake: "90.000000000000000000",
		body: "THIS BODY MUST NEVER RENDER — it is content_removed.",
		parentCommentId: null,
		imageUploadsId: imgRemoved,
		createdAt: at(0, 3),
	});
	await mkComment({
		marketId: a,
		userId: u7,
		side: "YES",
		stake: "50.000000000000000000",
		body: "Reply under a removed parent — this MUST still render.",
		parentCommentId: p3,
		createdAt: at(3, 0),
	});
	await removeComment(p3);

	// P4 (NO) — author Exited (no position); no replies.
	await mkComment({
		marketId: a,
		userId: u8,
		side: "NO",
		stake: "70.000000000000000000",
		body: "NO, and I've since exited my position.",
		parentCommentId: null,
		createdAt: at(0, 4),
	});

	// ── Market B — a terminal (Resolved) market: read-only lifecycle marker ─────
	const b = await mkMarket(
		`debate4-resolved-${tag}`,
		`DEBATE.4 demo — resolved/read-only (${tag})`,
		"Resolved",
		{ resolved: "YES" },
	);
	const ub1 = await mkUser("resolved-author");
	await mkPosition(ub1, b, "YES", "100.000000000000000000");
	await mkComment({
		marketId: b,
		userId: ub1,
		side: "YES",
		stake: "100.000000000000000000",
		body: "This market resolved YES; the view reads as locked.",
		parentCommentId: null,
		createdAt: at(0, 1),
	});

	// ── Market C — YES-only posts: the empty NO-side CTA (§9.4) ─────────────────
	const c = await mkMarket(
		`debate4-emptyside-${tag}`,
		`DEBATE.4 demo — empty NO side (${tag})`,
		"Open",
	);
	const uc1 = await mkUser("emptyside-author");
	await mkPosition(uc1, c, "YES", "100.000000000000000000");
	await mkComment({
		marketId: c,
		userId: uc1,
		side: "YES",
		stake: "100.000000000000000000",
		body: "Only YES posts here — the NO column should show the empty-side CTA.",
		parentCommentId: null,
		createdAt: at(0, 1),
	});

	console.log(`
[seed-debate-view] DONE. Walk these slugs (§9):
  A  /m/debate4-demo-${tag}        — two-sided render; Top order; the dominant
                                      post wears a lane badge; two-slot + expand;
                                      Đ aggregate; markers none/Flipped/Exited;
                                      P3 'removed by moderator' (body + author
                                      ABSENT from page source + network DTO),
                                      its reply still renders.
  B  /m/debate4-resolved-${tag}    — Resolved · read-only lifecycle marker.
  C  /m/debate4-emptyside-${tag}   — NO column shows 'Be the first to argue NO'.
Signed-out (public) render must work without auth. A Draft slug → 404.
Image caveat: §9.7 needs a real R2 object at the seeded key; the §9.2 removed-
image withholding holds regardless.`);

	await sql.end();
}

main().catch((e) => {
	console.error("[seed-debate-view] seed failed:", e);
	process.exit(1);
});
