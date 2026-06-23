import { describe, expect, it } from "vitest";

import type { PostSubstrate, ReplySubstrate } from "@/lib/ranking";
import { profileOrder } from "@/lib/ranking";

// DEBATE.8 §5.6 tests-first (TDD RED) — profile ordering (RANKING.md §3.6, the
// simplest lens). The value import `profileOrder` WILL fail to resolve until
// `@/lib/ranking` lands — that RED state is the goal (plan scope item 7). One
// subject per file (AGENTS.md §9): this file = `profileOrder`.
//
// Asserts: §3.6 — (1) the user's posts ordered by value signal `D`
// (support_dharma + counter_dharma) descending; (2) the user's replies ordered
// by their own stake descending; (3) posts above replies in the combined list;
// the order is viewer-INDEPENDENT (no viewer param — the signature takes only
// posts + replies) and the latest interleave does NOT apply (§4.3).
//
// Decimal posture (CLAUDE.md §2): Dharma / stake inputs are decimal STRINGS.

function post(
	over: Partial<PostSubstrate> & Pick<PostSubstrate, "id">,
): PostSubstrate {
	return {
		parentSide: "YES",
		supportCount: 1,
		counterCount: 1,
		supportDharma: "0",
		counterDharma: "0",
		createdAt: new Date("2026-09-01T00:00:00.000Z"),
		authorStake: "100",
		...over,
	};
}

function reply(
	over: Partial<ReplySubstrate> & Pick<ReplySubstrate, "id">,
): ReplySubstrate {
	return {
		side: "YES",
		stake: "50",
		createdAt: new Date("2026-09-01T00:00:00.000Z"),
		...over,
	};
}

describe("ranking::profile-ordering-posts-above-replies (§3.6)", () => {
	// Posts: D = support_dharma + counter_dharma. PB has the most attracted
	// Dharma (700), PA next (500), PC least (100). Note PC's authorStake is the
	// HIGHEST (900) — proving the profile ranks posts by ATTRACTED D, not by `a`.
	const pa = post({ id: "post-a", supportDharma: "300", counterDharma: "200" });
	const pb = post({ id: "post-b", supportDharma: "400", counterDharma: "300" });
	const pc = post({
		id: "post-c",
		supportDharma: "50",
		counterDharma: "50",
		authorStake: "900",
	});
	// Replies: ranked by their OWN stake desc.
	const r1 = reply({ id: "reply-1", stake: "300" });
	const r2 = reply({ id: "reply-2", stake: "200" });
	const r3 = reply({ id: "reply-3", stake: "100" });

	it("orders posts by D desc, then replies by own stake desc", () => {
		const items = profileOrder([pc, pa, pb], [r3, r1, r2]);
		expect(
			items.map((item) =>
				item.kind === "post" ? item.post.id : item.reply.id,
			),
		).toEqual([
			"post-b", // D = 700
			"post-a", // D = 500
			"post-c", // D = 100
			"reply-1", // stake 300
			"reply-2", // stake 200
			"reply-3", // stake 100
		]);
	});

	it("places ALL posts above ALL replies (different rulers, §3.6)", () => {
		const items = profileOrder([pa, pb, pc], [r1, r2, r3]);
		const lastPostIdx = items.reduce(
			(acc, item, i) => (item.kind === "post" ? i : acc),
			-1,
		);
		const firstReplyIdx = items.findIndex((item) => item.kind === "reply");
		// Every post index precedes every reply index.
		expect(lastPostIdx).toBeLessThan(firstReplyIdx);
	});

	it("tags each item with its kind (post | reply)", () => {
		const items = profileOrder([pa, pb, pc], [r1, r2, r3]);
		expect(items.filter((item) => item.kind === "post")).toHaveLength(3);
		expect(items.filter((item) => item.kind === "reply")).toHaveLength(3);
	});

	it("is viewer-independent — the signature takes no viewer param (§3.6)", () => {
		// Two calls with identical inputs yield identical output; there is no
		// per-viewer branch (the order is the same for owner and visitor).
		const a = profileOrder([pa, pb, pc], [r1, r2, r3]);
		const b = profileOrder([pa, pb, pc], [r1, r2, r3]);
		expect(a.map((i) => (i.kind === "post" ? i.post.id : i.reply.id))).toEqual(
			b.map((i) => (i.kind === "post" ? i.post.id : i.reply.id)),
		);
	});

	it("posts-only profile (no replies) ⇒ posts by D desc, no reply items", () => {
		const items = profileOrder([pc, pa, pb], []);
		expect(items.every((item) => item.kind === "post")).toBe(true);
		expect(
			items.map((item) => (item.kind === "post" ? item.post.id : "")),
		).toEqual(["post-b", "post-a", "post-c"]);
	});
});
