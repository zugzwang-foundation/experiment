// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PostCard } from "@/components/debate/PostCard";
import { ReplyCard } from "@/components/debate/ReplyCard";
import type {
	DebatePost,
	DebateReply,
	ReplyGroups,
} from "@/components/debate/types";

/**
 * FF-1 / ADR-0058 — G12, the TAG half and the CARD-UNTOUCHED half (D-51 R5).
 *
 * A flagged reply wears `Friendly fire` from the SAME marker primitive as
 * Flipped / Exited; an unflagged one does not; and the POST CARD carries no
 * friendly-fire element in ANY state — not when its aggregate carries a
 * friendly-fire figure, not when its reply groups hold flagged replies.
 *
 * ⚠ The card assertions read `innerHTML` (O-7 / OVN-V6), never `textContent`
 * alone: a `data-testid` is markup, and a `Friendly fire` string inside an
 * `aria-label` or a `title` would not be in `textContent` at all. The negative
 * has its positive control in the reply-row case: the same string the card is
 * asserted not to carry is the string the row is asserted to carry.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const noop = () => {};
const noopPopup = () => {};

function reply(overrides?: Partial<DebateReply>): DebateReply {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-00000000ef01",
		ordinal: 1,
		side: "YES",
		createdAt: "2026-07-30T00:00:00.000Z",
		title: "Fixture reply argument.",
		body: "Fixture reply argument.\n\nFixture reply extended text.",
		marker: "none",
		author: { pseudonym: "fixture-replier", pfpUrl: "" },
		stake: "1000.000000000000000000",
		stakeOriginal: "1000.000000000000000000",
		sold: false,
		entryPrice: "0.270000000000000000",
		imageUrl: null,
		...overrides,
	} as DebateReply;
}

const EMPTY: ReplyGroups = { support: [], counter: [], twoSlot: [] };

function post(overrides?: Partial<DebatePost>): DebatePost {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-00000000da01",
		ordinal: 1,
		sideAtPostTime: "YES",
		createdAt: "2026-07-30T00:00:00.000Z",
		title: "Fixture argument title.",
		teaser: "Fixture teaser.",
		body: "Fixture argument title.\n\nFixture teaser.",
		imageUrl: null,
		marker: "none",
		badge: null,
		author: { pseudonym: "fixture-author", pfpUrl: "" },
		authorStake: "10.000000000000000000",
		authorStakeOriginal: "10.000000000000000000",
		authorSold: false,
		entryPrice: "0.500000000000000000",
		aggregate: {
			supportCount: 2,
			counterCount: 1,
			supportDharma: "1000.000000000000000000",
			counterDharma: "2000.000000000000000000",
		},
		replies: EMPTY,
		...overrides,
	} as DebatePost;
}

describe("friendly-fire tag — the reply row (post-focus)", () => {
	it("ff-tag::a-flagged-reply-wears-the-tag-beside-the-position-marker", () => {
		const { container } = render(
			<ReplyCard
				reply={reply({ friendlyFire: true, marker: "Flipped" })}
				onOpenImage={noop}
				onOpenPopup={noopPopup}
			/>,
		);
		const tag = container.querySelector('[data-testid="ff-tag"]');
		expect(tag).not.toBeNull();
		expect(tag?.innerHTML).toContain("Friendly fire");
		expect(tag?.getAttribute("aria-label")).toBe("Friendly fire");
		// The SAME marker primitive: the tag carries the position marker's
		// chip classes (outline, weight, type ramp), so the two cannot drift.
		const marker = container.querySelector('[aria-label="Author Flipped"]');
		expect(marker).not.toBeNull();
		const markerClasses = (marker?.getAttribute("class") ?? "").split(/\s+/);
		const tagClasses = (tag?.getAttribute("class") ?? "").split(/\s+/);
		for (const c of ["rounded-sm", "px-1.5", "text-[10px]", "font-normal"]) {
			expect(markerClasses).toContain(c);
			expect(tagClasses).toContain(c);
		}
		// …and it sits in the same row as the marker (a sibling, not a new row).
		expect(tag?.parentElement).toBe(marker?.parentElement);
		// Never a count.
		expect(container.innerHTML).not.toMatch(/\d+\s*friendly/i);
	});

	it("ff-tag::an-unflagged-reply-wears-no-tag (absent AND explicit false)", () => {
		for (const r of [reply(), reply({ friendlyFire: false })]) {
			const { container, unmount } = render(
				<ReplyCard reply={r} onOpenImage={noop} onOpenPopup={noopPopup} />,
			);
			expect(container.querySelector('[data-testid="ff-tag"]')).toBeNull();
			expect(container.innerHTML).not.toContain("Friendly fire");
			unmount();
		}
	});
});

describe("friendly-fire — the post CARD is untouched in every state (D-51 R5)", () => {
	const flagged = reply({ id: "r-ff", friendlyFire: true });
	const plain = reply({ id: "r-plain", side: "YES" });
	const counter = reply({ id: "r-counter", side: "NO" });

	const STATES: Array<[string, DebatePost]> = [
		["no-replies", post()],
		[
			"aggregate-carries-friendly-fire-dharma",
			post({
				aggregate: {
					supportCount: 2,
					counterCount: 1,
					supportDharma: "1000.000000000000000000",
					counterDharma: "2000.000000000000000000",
					friendlyFireDharma: "400.000000000000000000",
				},
			}),
		],
		[
			"reply-groups-hold-a-flagged-reply",
			post({
				aggregate: {
					supportCount: 2,
					counterCount: 1,
					supportDharma: "1000.000000000000000000",
					counterDharma: "2000.000000000000000000",
					friendlyFireDharma: "1000.000000000000000000",
				},
				replies: {
					support: [flagged, plain],
					counter: [counter],
					twoSlot: [flagged, counter],
				},
			}),
		],
		["badged-contested", post({ badge: "Contested" })],
	];

	for (const [name, p] of STATES) {
		it(`ff-card::no-friendly-fire-element-on-the-card — ${name}`, () => {
			const { container } = render(
				<PostCard
					post={p}
					onEnter={noop}
					onOpenPopup={noop}
					onOpenImage={noop}
					onReplyToPost={noop}
					heldSide={null}
					marketOpen
					suspended={false}
				/>,
			);
			const html = container.innerHTML;
			// Markup, not text: a testid or an aria-label would be invisible to
			// textContent and both are what a "hidden" element would still leak.
			expect(html).not.toContain('data-testid="ff-');
			expect(html).not.toContain("Friendly fire");
			expect(html).not.toContain("friendly fire");
			expect(html).not.toContain("friendly-fire");
		});
	}

	it("ff-card::POSITIVE-CONTROL — the strings the card must not carry are real strings the row does carry", () => {
		const { container } = render(
			<ReplyCard reply={flagged} onOpenImage={noop} onOpenPopup={noopPopup} />,
		);
		expect(container.innerHTML).toContain('data-testid="ff-tag"');
		expect(container.innerHTML).toContain("Friendly fire");
	});
});
