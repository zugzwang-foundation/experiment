import { describe, expect, it } from "vitest";

import {
	composePostExport,
	EXPORT_HEIGHT,
	EXPORT_WIDTH,
	exportFilename,
	splitMarketTitle,
} from "@/server/debate-export/image/compose";
import type {
	DebatePost,
	DebateViewModel,
} from "@/server/debate-view/load-debate-view";

import { mumbaiMetroModel } from "./_fixtures/mumbai-metro.input";

/**
 * POST-IMAGE-EXPORT — the pure mapper behind the PNG export. Everything the
 * composition paints is derived here from the SAME view model the page
 * renders, through the SAME formatters, so these assertions are about parity
 * with what is on screen rather than about a second set of rules.
 */
const NOW = Date.parse("2026-06-29T12:00:00Z");

const REMOVED_BODY = "THIS BODY IS REMOVED AND MUST NEVER SERIALISE";

function withRemovedPost(model: DebateViewModel): DebateViewModel {
	const first = model.posts[0];
	if (first === undefined || first.removed) {
		throw new Error("fixture must open with a present post");
	}
	// A post that the read model has masked. The union variant carries no
	// body — the string below is what a LEAK would look like, planted on a
	// sibling present post so an accidental index slip would surface it.
	const removed: DebatePost = {
		removed: true,
		id: "cmt-removed",
		ordinal: 99,
		sideAtPostTime: "NO",
		createdAt: "2026-05-20T00:00:00.000Z",
		aggregate: first.aggregate,
		replies: { support: [], counter: [], twoSlot: [] },
	};
	const decoy: DebatePost = { ...first, id: "cmt-decoy", body: REMOVED_BODY };
	return { ...model, posts: [decoy, removed, ...model.posts.slice(1)] };
}

describe("composePostExport", () => {
	it("maps a present post through the page's own formatters", () => {
		const props = composePostExport(mumbaiMetroModel, "cmt-p1", NOW, null);
		expect(props).not.toBeNull();
		if (props === null) return;

		expect(props.width).toBe(EXPORT_WIDTH);
		expect(props.height).toBe(EXPORT_HEIGHT);
		expect(props.width / props.height).toBeCloseTo(1200 / 700, 6);
		// The verification band's timestamp — UTC, hand-formatted.
		expect(props.generatedAt).toBe("29 Jun 2026 · 12:00 UTC");
		// The Discovery thumbnail is the route's to supply; the mapper passes it.
		expect(props.market.thumbUrl).toBeNull();
		expect(
			composePostExport(mumbaiMetroModel, "cmt-p1", NOW, "https://x/t.webp")
				?.market.thumbUrl,
		).toBe("https://x/t.webp");

		// Market — `formatPricePercent` pairs: 0.54 → "54%" / "46%".
		expect(props.market.slug).toBe("mumbai-metro-line-3-1m-riders");
		expect(props.market.yesPct).toBe("54%");
		expect(props.market.noPct).toBe("46%");
		expect(props.market.yesBarPct).toBe(54);
		// Not one of the eight known slugs — no resolution blocks, no throw.
		expect(props.market.flavour).toBeNull();
		// This fixture's title carries NO topic prefix, so it passes through
		// whole and mints no chip — the split's negative branch, exercised by the
		// same fixture every other assertion here runs against.
		expect(props.market.category).toBeNull();
		expect(props.market.title).toBe(
			"Will Mumbai Metro Line 3 average over 1M daily riders before the freeze?",
		);

		// The band's countdown, from the SAME `formatCountdown` the global header
		// ticks with and the SAME built freeze pin: `NOW` is 2026-06-29T12:00Z and
		// the freeze is 2026-11-05T23:59Z — 129 days and 11h59m, digits only.
		expect(props.countdown).toBe("129:11:59");

		// Post — the author row as the card renders it.
		expect(props.post.ordinal).toBe(2);
		expect(props.post.pseudonym).toBe("MagentaWolf207");
		expect(props.post.initials).toBe("MA");
		expect(props.post.side).toBe("YES");
		expect(props.post.entryPct).toBe("47%");
		expect(props.post.stake).toBe("560");
		// Untouched stake → no struck-through original (the LotBreakdown rule).
		expect(props.post.stakeOriginal).toBeNull();
		expect(props.post.sold).toBe(false);
		expect(props.post.replyCount).toBe(3);
		expect(props.post.age).toBe("42d ago");
		expect(props.post.title).toBe("The corridor is built for this volume");

		// Support/Counter resolve to the SIDE the reply-bet lands on.
		expect(props.post.support).toEqual({ side: "YES", dharma: "255" });
		expect(props.post.counter).toEqual({ side: "NO", dharma: "210" });
		expect(props.post.splitTotal).toBe("465");
		// 255 / 465 → 54% (rounded DOWN, `computeSplitBar`).
		expect(props.post.supportBarPct).toBe(54);

		expect(props.chart).toBeNull();
	});

	it("inverts the poles on a NO post", () => {
		const noPost = mumbaiMetroModel.posts.find(
			(p) => !p.removed && p.sideAtPostTime === "NO",
		);
		expect(noPost).toBeDefined();
		if (noPost === undefined) return;
		const props = composePostExport(mumbaiMetroModel, noPost.id, NOW, null);
		expect(props?.post.side).toBe("NO");
		expect(props?.post.support.side).toBe("NO");
		expect(props?.post.counter.side).toBe("YES");
	});

	it("shows the struck-through original only when it differs AS RENDERED", () => {
		const first = mumbaiMetroModel.posts[0];
		if (first === undefined || first.removed) throw new Error("fixture");
		const moved: DebateViewModel = {
			...mumbaiMetroModel,
			posts: [
				{
					...first,
					authorStake: "300.000000000000000000",
					authorStakeOriginal: "560.000000000000000000",
				},
				// A movement too small to change the printed figure — no strike.
				{
					...first,
					id: "cmt-tiny",
					authorStake: "559.600000000000000000",
					authorStakeOriginal: "560.000000000000000000",
				},
				// Sold out — the tag, never the strike.
				{
					...first,
					id: "cmt-sold",
					authorStake: "0.000000000000000000",
					authorSold: true,
				},
			],
		};
		expect(
			composePostExport(moved, first.id, NOW, null)?.post.stakeOriginal,
		).toBe("560");
		expect(
			composePostExport(moved, "cmt-tiny", NOW, null)?.post.stakeOriginal,
		).toBeNull();
		const sold = composePostExport(moved, "cmt-sold", NOW, null);
		expect(sold?.post.sold).toBe(true);
		expect(sold?.post.stake).toBe("0");
		expect(sold?.post.stakeOriginal).toBeNull();
	});

	it("passes the price series through untouched, flagged open", () => {
		const series = [
			{ at: "2026-08-17T00:00:00.000Z", yes: "0.5" },
			{ at: "2026-08-20T00:00:00.000Z", yes: "0.54" },
		];
		const props = composePostExport(
			{ ...mumbaiMetroModel, priceChart: { series } },
			"cmt-p1",
			NOW,
			null,
		);
		expect(props?.chart).toEqual({ series, isOpen: true });
	});

	it("returns null for an unknown post id", () => {
		expect(
			composePostExport(mumbaiMetroModel, "cmt-nope", NOW, null),
		).toBeNull();
	});

	it("SC-1 — a removed post yields null and its body reaches no output", () => {
		const model = withRemovedPost(mumbaiMetroModel);
		expect(composePostExport(model, "cmt-removed", NOW, null)).toBeNull();
		// Every OTHER post's export must be free of the planted body too: the
		// assertion is on the serialised OUTPUT, not on which row was skipped.
		for (const p of model.posts) {
			if (p.id === "cmt-decoy") continue;
			const out = composePostExport(model, p.id, NOW, null);
			expect(JSON.stringify(out)).not.toContain(REMOVED_BODY);
		}
	});

	/**
	 * ⛔ THE ASSERTION ABOVE WENT VACUOUS WHEN THE BODY WAS DROPPED, AND THIS IS
	 * WHAT REPLACES ITS TEETH.
	 *
	 * Revision 5 removed the argument text from the export, so the composition
	 * carries no body at all and a planted string can no longer reach the
	 * serialised output by ANY route — which makes the stringify check above
	 * unable to fail. A guard that cannot fail is not a guard, and deleting it
	 * would leave the masking rule (SC-1, CLAUDE.md §5.14) with nothing watching
	 * it here.
	 *
	 * So the property being guarded MOVES: not "the removed body is absent" but
	 * "no body field exists". Re-add one — for a caption, a teaser, a snippet,
	 * anything — and this reddens, which is the moment the masking check has to
	 * be argued for again rather than assumed. The two assertions are kept side
	 * by side deliberately: the one above still describes the rule, this one is
	 * what currently enforces it.
	 */
	it("SC-1 — the export carries NO body field for any post", () => {
		for (const p of mumbaiMetroModel.posts) {
			// ⚠ PRESENT POSTS ONLY. A removed one composes to `null` — the case
			// the assertion above owns — and carries no body to look for.
			if (p.removed) continue;
			const out = composePostExport(mumbaiMetroModel, p.id, NOW, null);
			expect(out).not.toBeNull();
			if (out === null) continue;
			expect(Object.keys(out.post)).not.toContain("body");
			// ⚠ AND THE SERIALISED FORM, so a body tucked under some other key —
			// a teaser, a snippet, a caption — is caught as well as a renamed one.
			// The fixture's bodies are real prose, so this is not a vacuous match.
			expect(p.body.length).toBeGreaterThan(20);
			expect(JSON.stringify(out)).not.toContain(p.body);
		}
	});
});

describe("splitMarketTitle", () => {
	it("lifts the topic off a live title and leaves the question whole", () => {
		expect(
			splitMarketTitle(
				"Math · Will 3 Erdős problems be solved by 5th November?",
			),
		).toEqual({
			category: "Math",
			question: "Will 3 Erdős problems be solved by 5th November?",
		});
		// A one-word topic is not the only shape — this one is eleven characters
		// and is the longest of the eight.
		expect(
			splitMarketTitle("YCombinator · Will YC reply to Zugzwang's pitch?"),
		).toEqual({
			category: "YCombinator",
			question: "Will YC reply to Zugzwang's pitch?",
		});
	});

	it("splits on the FIRST separator, so a question keeps its own dots", () => {
		expect(
			splitMarketTitle("Bitcoin · Will BTC · the original · fall?"),
		).toEqual({
			category: "Bitcoin",
			question: "Will BTC · the original · fall?",
		});
	});

	it("passes a title through whole when there is nothing to lift", () => {
		// No separator at all.
		expect(splitMarketTitle("Will the repo reach 100,000 stars?")).toEqual({
			category: null,
			question: "Will the repo reach 100,000 stars?",
		});
		// A LEADING separator would otherwise mint an empty chip.
		expect(splitMarketTitle("· Will it?")).toEqual({
			category: null,
			question: "· Will it?",
		});
		// A bare middle dot with no spaces is not the separator.
		expect(splitMarketTitle("Math·Will it?")).toEqual({
			category: null,
			question: "Math·Will it?",
		});
	});
});

describe("exportFilename", () => {
	it("is the market slug plus the post ordinal", () => {
		expect(exportFilename("math-erdos-contribution-response", 3)).toBe(
			"math-erdos-contribution-response-post-3.jpg",
		);
	});

	it("names a reply by its post and its ordinal within that post", () => {
		expect(exportFilename("math-erdos-contribution-response", 3, 2)).toBe(
			"math-erdos-contribution-response-post-3-reply-2.jpg",
		);
	});
});

/**
 * REPLY-IMAGE-EXPORT — `?post=N&reply=M`. The reply is the subject of the
 * image (author, side, stake, title) and the split row is replaced by what it
 * answered: the parent's title and the relation, read off the list the read
 * model placed the reply in.
 */
describe("composePostExport — a reply", () => {
	// cmt-p1 (YES): support r1-1 (#1, YES), r1-2 (#3, YES); counter r1-3 (#2, NO).
	it("paints the REPLY as the subject and says it SUPPORTED the parent", () => {
		const props = composePostExport(mumbaiMetroModel, "cmt-p1", NOW, null, 1);
		expect(props).not.toBeNull();
		if (props === null) return;
		expect(props.post.pseudonym).toBe("TealOwl118");
		expect(props.post.side).toBe("YES");
		expect(props.post.stake).toBe("180");
		expect(props.post.title).toBe(
			"Agreed, and the monsoon multiplier is underrated.",
		);
		expect(props.post.badge).toBeNull();
		// The file still names the PARENT's ordinal; the route appends the reply's.
		expect(props.post.ordinal).toBe(2);
		expect(props.repliedTo).toEqual({
			relation: "SUPPORT",
			parentTitle: "The corridor is built for this volume",
		});
	});

	it("says COUNTER for a reply the read model placed on the counter list", () => {
		const props = composePostExport(mumbaiMetroModel, "cmt-p1", NOW, null, 2);
		expect(props?.post.pseudonym).toBe("IndigoWolf355");
		expect(props?.post.side).toBe("NO");
		expect(props?.repliedTo?.relation).toBe("COUNTER");
	});

	it("a post export carries no repliedTo", () => {
		expect(
			composePostExport(mumbaiMetroModel, "cmt-p1", NOW, null)?.repliedTo,
		).toBeNull();
	});

	it("returns null for a reply ordinal the post does not have", () => {
		expect(
			composePostExport(mumbaiMetroModel, "cmt-p1", NOW, null, 9),
		).toBeNull();
	});

	it("SC-1 — a REMOVED reply yields null", () => {
		const first = mumbaiMetroModel.posts[0];
		if (first === undefined || first.removed) throw new Error("fixture");
		const model: DebateViewModel = {
			...mumbaiMetroModel,
			posts: [
				{
					...first,
					replies: {
						...first.replies,
						support: [
							{
								removed: true,
								id: "cmt-r1-1",
								ordinal: 1,
								side: "YES",
								createdAt: "2026-05-19T10:12:00.000Z",
							},
						],
					},
				},
				...mumbaiMetroModel.posts.slice(1),
			],
		};
		expect(composePostExport(model, "cmt-p1", NOW, null, 1)).toBeNull();
	});

	it("SC-1 — a reply under a REMOVED post yields null, so no withheld title reaches an image", () => {
		const model = withRemovedPost(mumbaiMetroModel);
		const removed = model.posts.find((p) => p.id === "cmt-removed");
		if (removed === undefined) throw new Error("fixture");
		const reply = mumbaiMetroModel.posts[0]?.replies.support[0];
		if (reply === undefined) throw new Error("fixture");
		removed.replies = { support: [reply], counter: [], twoSlot: [] };
		expect(composePostExport(model, "cmt-removed", NOW, null, 1)).toBeNull();
	});

	it("SC-1 — the reply export carries the reply's TITLE and never its body", () => {
		const reply = mumbaiMetroModel.posts[0]?.replies.support[0];
		if (reply === undefined || reply.removed) throw new Error("fixture");
		const props = composePostExport(mumbaiMetroModel, "cmt-p1", NOW, null, 1);
		if (props === null) throw new Error("expected props");
		expect(Object.keys(props.post)).not.toContain("body");
		const out = JSON.stringify(props);
		expect(out).toContain(reply.title);
		expect(out).not.toContain(reply.body);
		// The text AFTER the title — the part a teaser or snippet would carry.
		const rest = reply.body.slice(reply.title.length).trim();
		expect(rest.length).toBeGreaterThan(0);
		expect(out).not.toContain(rest);
	});
});
