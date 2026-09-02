import { describe, expect, it } from "vitest";

import { type Badge, badgeFor, type PostSubstrate } from "@/lib/ranking";
import { DEFAULT_RANKING_CONFIG } from "@/lib/ranking.config";
import {
	BET_MIN_STAKE_POST,
	BET_MIN_STAKE_REPLY,
	DAILY_CREDIT_DHARMA,
	INITIAL_USER_DHARMA,
	REPLY_DEPTH_MAX,
} from "@/server/config/limits";
import {
	MODERATION,
	PARTICIPANTS,
	type ParticipantRole,
	POSTS,
	REPLIES,
	SELLS,
} from "../../staging/fixtures";

// ═══════════════════════════════════════════════════════════════════════════
// THE FIXTURE TABLE'S OWN CONTROL — STAGING-PARITY Slice C
//
// A pure, database-free check on `tests/staging/fixtures.ts`. It exists because
// every property below is one a rebuild would otherwise discover EXPENSIVELY:
// a side collision aborts the run mid-way with `OppositeSideHeldError`, a
// budget overrun aborts it with `InsufficientDharmaError`, and a mis-calibrated
// stake produces a green run whose BADGES are silently wrong — the failure mode
// that costs a whole staging cycle to notice.
//
// ── THE LANE CALIBRATION IS ASSERTED HERE, NOT INFERRED ─────────────────────
// `ranking.ts` is PURE (no IO, no DB, no `server-only`), so the exact badge set
// M2 will render is computable from the fixture table alone. This block builds
// the same `PostSubstrate` the live aggregate query builds — support/counter
// counts and per-side Dharma sums over REPLIES, never the post's own stake —
// and runs the SHIPPED `badgeFor` against it.
//
// That makes C3 (one post dominating each lane) and C4 (most posts dominating
// none) CI-enforced rather than a measurement someone took once. The live
// instrument (`scripts/verify-ranking-staging.ts`) then confirms the same shape
// against real rows, which is the control this one cannot be: this test proves
// the table implies the badges, the instrument proves the engine produced the
// table.
// ═══════════════════════════════════════════════════════════════════════════

const M2_POSTS = POSTS.filter((p) => p.market === "M2");
const cfg = DEFAULT_RANKING_CONFIG;

/** Support iff the reply's side equals its parent's — RANKING.md §7. */
function substrateFor(marketKey: string): PostSubstrate[] {
	const posts = POSTS.filter((p) => p.market === marketKey);
	return posts.map((post, i) => {
		const replies = REPLIES.filter((r) => r.parent === post.key);
		const support = replies.filter((r) => r.side === post.side);
		const counter = replies.filter((r) => r.side !== post.side);
		const sum = (rows: typeof replies) =>
			rows.reduce((acc, r) => acc + Number(r.stake), 0).toString();
		return {
			id: post.key,
			parentSide: post.side,
			// ⚠ RANK-3 — THE RANKING COUNTS ARE DISTINCT PEOPLE, and in THIS table
			// that is not the same as the number of replies. `M2-P2` draws 5
			// replies from 3 people and `M2-P4` draws 4 from 3. Computing these as
			// `support.length` — as this file did until RANK-3 — would model a
			// substrate the shipped query no longer produces, and the badge
			// assertions below would keep passing against a shape that no longer
			// exists. That is the precise failure this file was minted to prevent,
			// so it is computed the way the SQL computes it.
			supportCount: new Set(support.map((r) => r.author)).size,
			counterCount: new Set(counter.map((r) => r.author)).size,
			// The DISPLAY totals: every reply, self-authored and removed included.
			// The fixture table contains no self-replies (verified), so these differ
			// from the counts above only where one person replied more than once.
			supportCountTotal: support.length,
			counterCountTotal: counter.length,
			supportDharma: sum(support),
			counterDharma: sum(counter),
			// Creation order is the fixture-table order; only the ORDERING matters
			// to the model (the §3.4 tie chain), never the absolute instant.
			createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
			// RANK-1 — the substrate's stake fields are SURVIVING basis. The
			// staging fixture table (`tests/staging/fixtures.ts`) states no sells
			// against a post's own entry bet, so surviving == frozen for every row
			// here and the badge lanes this file pins are unaffected. If a future
			// fixture DOES sell a post down, this is the line that has to state it.
			authorStake: post.stake,
			authorStakeOriginal: post.stake,
			authorSold: false,
			priceAtBet: "0.5",
		};
	});
}

describe("the fixture table is internally consistent", () => {
	it("gives every post and every reply a unique key", () => {
		const postKeys = POSTS.map((p) => p.key);
		expect(new Set(postKeys).size).toBe(postKeys.length);
		const replyKeys = REPLIES.map((r) => r.key);
		expect(new Set(replyKeys).size).toBe(replyKeys.length);
	});

	it("points every reply at a post that exists, and only at a post", () => {
		const postKeys = new Set(POSTS.map((p) => p.key));
		const replyKeys = new Set(REPLIES.map((r) => r.key));
		for (const reply of REPLIES) {
			// A reply whose parent is itself a reply would exceed REPLY_DEPTH_MAX.
			expect({
				key: reply.key,
				parentIsPost: postKeys.has(reply.parent),
			}).toEqual({ key: reply.key, parentIsPost: true });
			expect(replyKeys.has(reply.parent)).toBe(false);
		}
		expect(REPLY_DEPTH_MAX).toBe(1);
	});

	it("points every moderation row at a target that exists", () => {
		// UNWIRE-1 — this test covered bookmark rows too before the bookmark
		// module was unwired product-wide; "never lets a viewer bookmark their
		// own argument (B1)" (a dedicated BOOKMARKS-only test) is removed
		// whole for the same reason.
		const postKeys = new Set(POSTS.map((p) => p.key));
		const replyKeys = new Set(REPLIES.map((r) => r.key));
		const resolves = (target: string, kind: "post" | "reply") =>
			kind === "post" ? postKeys.has(target) : replyKeys.has(target);
		for (const m of MODERATION) {
			expect({ t: m.target, ok: resolves(m.target, m.targetKind) }).toEqual({
				t: m.target,
				ok: true,
			});
		}
		// Non-empty controls: a loop over an empty list asserts nothing.
		expect(MODERATION.length).toBeGreaterThan(0);
		expect(REPLIES.length).toBeGreaterThan(0);
	});

	it("respects both stake floors, read from the shipped constants", () => {
		for (const p of POSTS) {
			expect({
				key: p.key,
				ok: Number(p.stake) >= Number(BET_MIN_STAKE_POST),
			}).toEqual({ key: p.key, ok: true });
		}
		for (const r of REPLIES) {
			expect({
				key: r.key,
				ok: Number(r.stake) >= Number(BET_MIN_STAKE_REPLY),
			}).toEqual({ key: r.key, ok: true });
		}
	});

	it("holds ONE side per (user, market) — I-SINGLE-SIDE-001", () => {
		// P-flipped is the sole exception BY CONSTRUCTION: it sells its entire YES
		// holding before buying NO, which is what `SELLS` exists to do. Every other
		// two-sided pair would raise `OppositeSideHeldError` mid-run.
		const flipMarkets = new Set(
			SELLS.filter((s) => s.seller === "P-flipped").map((s) => s.market),
		);
		const sides = new Map<string, Set<string>>();
		const record = (
			author: ParticipantRole,
			market: string,
			side: string,
		): void => {
			const k = `${author}::${market}`;
			const set = sides.get(k) ?? new Set<string>();
			set.add(side);
			sides.set(k, set);
		};
		for (const p of POSTS) record(p.author, p.market, p.side);
		const marketOf = new Map(POSTS.map((p) => [p.key, p.market]));
		for (const r of REPLIES) {
			record(r.author, marketOf.get(r.parent) as string, r.side);
		}
		const violations = [...sides.entries()]
			.filter(([k, set]) => {
				if (set.size < 2) return false;
				const [author, market] = k.split("::");
				return !(author === "P-flipped" && flipMarkets.has(market as never));
			})
			.map(([k]) => k);
		expect(violations).toEqual([]);
		// Positive control: P-flipped really does hold both sides, so the exemption
		// above is exercised rather than vacuous.
		expect(sides.get("P-flipped::M2")?.size).toBe(2);
	});

	it("keeps every participant inside its balance, in DAG order", () => {
		// Each participant opens at INITIAL_USER_DHARMA and accrues DAILY_CREDIT
		// on its FIRST bet (inside `place()`), so a betting participant has
		// 1010 to spend across the whole run. The one participant that exceeds it
		// is P-owner, whose later spend is funded by the M7 settlement — modelled
		// explicitly rather than exempted.
		const budget = Number(INITIAL_USER_DHARMA) + Number(DAILY_CREDIT_DHARMA);
		const spend = new Map<ParticipantRole, number>();
		const add = (role: ParticipantRole, amount: number) =>
			spend.set(role, (spend.get(role) ?? 0) + amount);
		for (const p of POSTS) add(p.author, Number(p.stake));
		for (const r of REPLIES) {
			// The after-settlement reply is paid for by the M7 payout, which does
			// not exist during the main phase. It is checked separately below.
			if (r.phase === "after-settlement") continue;
			add(r.author, Number(r.stake));
		}
		const overspent = [...spend.entries()]
			.filter(([, total]) => total > budget)
			.map(([role, total]) => `${role}=${total}`);
		expect(overspent).toEqual([]);

		// P-owner's after-settlement reply must fit inside the M7 payout. The
		// payout is the engine's (shares bought = 1833.33… against a 5000 seed);
		// this asserts the fixture stays well under a conservative floor rather
		// than restating the CPMM identity, which is `place`'s job, not ours.
		const afterSettlement = REPLIES.filter(
			(r) => r.phase === "after-settlement",
		);
		expect(afterSettlement.length).toBeGreaterThan(0);
		for (const r of afterSettlement) {
			expect({
				key: r.key,
				role: r.author,
				fits: Number(r.stake) <= 1800,
			}).toEqual({ key: r.key, role: "P-owner", fits: true });
		}
	});

	it("never has P-empty bet, and never has admin author anything", () => {
		// Manifest §0 B7 — P-empty's balance IS the G5.1 carrier; one bet destroys
		// it. Manifest §1.6 — admin is not a participant, structurally.
		const authors = new Set<string>([
			...POSTS.map((p) => p.author),
			...REPLIES.map((r) => r.author),
		]);
		expect(authors.has("P-empty")).toBe(false);
		expect(SELLS.some((s) => s.seller === "P-empty")).toBe(false);
		// Every author is a declared participant role — no stray string.
		const roles = new Set(PARTICIPANTS.map((p) => p.role));
		expect(
			[...authors].filter((a) => !roles.has(a as ParticipantRole)),
		).toEqual([]);
	});
});

describe("C2 · M2 carries latestInterleaveInterval + 2 posts", () => {
	it("reads the interval from ranking.config.ts rather than restating it", () => {
		// The constant pins at the 2026-09-01 number-tuning pass. Reading it here
		// means a tuning change surfaces as a RED fixture test, not as an
		// interleave that silently stops firing twice on staging.
		expect(M2_POSTS.length).toBe(cfg.latestInterleaveInterval + 2);
	});
});

describe("C3 + C4 · the lane calibration, computed with the shipped model", () => {
	const substrate = substrateFor("M2");
	const badges = new Map<string, Badge | null>(
		substrate.map((p) => [p.id, badgeFor(p, substrate, cfg)]),
	);

	// ⚠⚠ THE C3 CALIBRATION IS STALE AND THIS IS WHERE THAT BECAME VISIBLE.
	// RANK-3's R-2 redefined traction as DISTINCT PEOPLE, and the M2 fixture
	// draws repeat repliers: M2-P2 has 5 replies from 3 people, M2-P4 has 4 from
	// 3. Neither clears `floor_lane(n) = 5`, and P4's contestation falls to
	// 3^0.5 = 1.73 < 3. So M2 now fires ONE badge, not three.
	//
	// ⛔ THE EXPECTATIONS ARE UPDATED TO THE MEASURED TRUTH, NOT RESTORED. The
	// old numbers described the old noun; preserving them would mean asserting a
	// substrate the shipped query no longer produces (RANK-1 R-C). Restoring a
	// three-badge M2 means re-shaping the fixture DATA so five distinct people
	// reply to M2-P2 — which only takes effect after a staging rebuild, and a
	// rebuild is out of scope here. **Flagged for the founder as RANK-3-D1.**
	it("fires ONE badge — the C3 three-badge calibration is stale (RANK-3 R-2)", () => {
		const fired = [...badges.values()].filter((b) => b !== null);
		expect(fired.slice().sort()).toEqual(["Highest Stakes"]);
	});

	it("puts each badge on its named carrier (C3)", () => {
		// Named, not counted: three badges landing on three posts proves nothing
		// about WHICH posts, and the `serves` field in the fixture table is a claim
		// this assertion is what makes true.
		expect({
			"M2-P2": badges.get("M2-P2"),
			"M2-P3": badges.get("M2-P3"),
			"M2-P4": badges.get("M2-P4"),
		}).toEqual({
			// Lost Most Debated: 5 replies, 3 people, and 3 < floor_lane(n) = 5.
			"M2-P2": null,
			// Unaffected — the stake lane does not count anything.
			"M2-P3": "Highest Stakes",
			// Lost Contested: 4 replies, 3 people ⇒ n^b = 3^0.5 = 1.73 < 3.
			"M2-P4": null,
		});
	});

	it("leaves the MAJORITY of M2's posts with no badge (C4)", () => {
		const unbadged = [...badges.values()].filter((b) => b === null).length;
		// Was `- 3`; one badge fires since RANK-3 R-2. C4's PROPERTY (the majority
		// carry none) is unharmed and is asserted below on its own terms.
		expect(unbadged).toBe(M2_POSTS.length - 1);
		// "Majority" stated as an assertion rather than left to arithmetic the
		// reader has to do.
		expect(unbadged).toBeGreaterThan(M2_POSTS.length / 2);
	});

	it("records WHY each carrier resolves as it does — the lane values", () => {
		// The calibration record, executable. If a stake edit moves any of these,
		// this is the assertion that says which lane moved and by how much, rather
		// than only that a badge vanished.
		const bySide = new Map(substrate.map((p) => [p.id, p]));
		const laneOf = (id: string) => {
			const p = bySide.get(id) as PostSubstrate;
			const n = p.supportCount + p.counterCount;
			const max = Math.max(p.supportCount, p.counterCount);
			const b = max === 0 ? 0 : Math.min(p.supportCount, p.counterCount) / max;
			return {
				n,
				D: Number(p.supportDharma) + Number(p.counterDharma),
				nPowB: n === 0 ? 0 : Number(n ** b).toFixed(3),
			};
		};
		expect({
			"M2-P2": laneOf("M2-P2"),
			"M2-P3": laneOf("M2-P3"),
			"M2-P4": laneOf("M2-P4"),
		}).toEqual({
			// ⚠ WAS `n: 5` when n counted REPLIES. Five replies, three people —
			// so since RANK-3 R-2 it is 3, below floor_lane(n) = 5, and the
			// Most Debated badge it used to carry is gone.
			"M2-P2": { n: 3, D: 280, nPowB: "1.732" },
			// Unaffected: D 2500 against a second place of 280 = 8.93x, over
			// kLane 3. The stake lane counts nothing, so R-2 does not reach it.
			"M2-P3": { n: 3, D: 2500, nPowB: "1.732" },
			// ⚠ WAS `n: 4, nPowB: "4.000"` — four replies from three people. At
			// n = 3 with a 1:2 split, n^b = 3^0.5 = 1.732 < 3, so Contested is
			// gone too. All three posts now sit at n = 3, which is why exactly
			// one badge fires and it is the one decided on stake.
			"M2-P4": { n: 3, D: 215, nPowB: "1.732" },
		});
		// And the floors those values are measured against, so a tuning change
		// that invalidates the calibration cannot pass silently.
		expect({
			n: cfg.floorLane.n,
			D: cfg.floorLane.D,
			nPowB: cfg.floorLane.nPowB,
			kLane: cfg.kLane,
		}).toEqual({ n: 5, D: 200, nPowB: 3, kLane: 3 });
	});
});

describe("M3 · the ceiling constraint — NO post may clear k_lane", () => {
	it("renders no badge at all, so Top falls back to closest-to-landslide", () => {
		const substrate = substrateFor("M3");
		// Non-vacuous: an empty market also produces zero badges.
		expect(substrate.length).toBeGreaterThan(1);
		expect(substrate.some((p) => p.supportCount + p.counterCount > 0)).toBe(
			true,
		);
		expect(substrate.map((p) => badgeFor(p, substrate, cfg))).toEqual(
			substrate.map(() => null),
		);
	});
});
