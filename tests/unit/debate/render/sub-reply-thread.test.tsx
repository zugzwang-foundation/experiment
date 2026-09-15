// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneDebateView } from "@/components/debate/phone/PhoneDebateView";
import { ReplyCard } from "@/components/debate/ReplyCard";
import { ReplyScroller } from "@/components/debate/scrollers";
import type { DebateReply } from "@/components/debate/types";

import { modelWith, post, stubElementScroll, VIEWER } from "../phone/_fixtures";

/**
 * ⚠ TEST-BRANCH ONLY (`test/seed-depth2-load`, not for merge) — depth-2 replies
 * (a reply TO a reply, written only by the dummy seed) render NESTED under their
 * depth-1 parent on both tiers, labelled Support/Counter RELATIVE TO THAT
 * PARENT, with no reply affordance anywhere, and masked.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
	useParams: () => ({ slug: "bitcoin-price-50k" }),
}));

stubElementScroll();

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const noop = () => undefined;

function present(o: {
	id: string;
	side: "YES" | "NO";
	pseudonym: string;
	body: string;
	subReplies?: DebateReply[];
}): DebateReply {
	return {
		removed: false,
		id: o.id,
		ordinal: 1,
		title: o.body.split("\n", 1)[0] ?? "",
		side: o.side,
		createdAt: "2026-09-18T10:00:00.000Z",
		body: o.body,
		marker: "none",
		author: { pseudonym: o.pseudonym, pfpUrl: "/pfp-placeholder.svg" },
		stake: "20.000000000000000000",
		stakeOriginal: "20.000000000000000000",
		sold: false,
		entryPrice: "0.400000000000000000",
		imageUrl: null,
		...(o.subReplies ? { subReplies: o.subReplies } : {}),
	};
}

const AGREE = present({
	id: "c1",
	side: "NO",
	pseudonym: "TealPangolin001",
	body: "I agree with the counter.\n\nMore detail here.",
});
const DISAGREE = present({
	id: "c2",
	side: "YES",
	pseudonym: "RoseChinchilla002",
	body: "The counter is wrong.",
});
const REMOVED_CHILD: DebateReply = {
	removed: true,
	id: "c3",
	ordinal: 3,
	side: "NO",
	createdAt: "2026-09-18T11:00:00.000Z",
};
/** A NO depth-1 reply — so a NO child is Support and a YES child is Counter. */
const PARENT = present({
	id: "r1",
	side: "NO",
	pseudonym: "IndigoArmadillo000",
	body: "Depth one counter.",
	subReplies: [AGREE, DISAGREE, REMOVED_CHILD],
});

describe("SubReplyThread — depth-2 nested under ReplyCard", () => {
	it("renders children nested inside the parent card, in model order", () => {
		const { container } = render(
			<ReplyCard reply={PARENT} onOpenImage={noop} onOpenPopup={noop} />,
		);
		const thread = screen.getByTestId("sub-reply-thread");
		// Nested INSIDE the parent card, not a sibling of it.
		expect(container.firstElementChild?.contains(thread)).toBe(true);
		const items = within(thread).getAllByTestId("sub-reply");
		expect(items.length).toBe(3);
		expect(items[0]?.innerHTML).toContain("TealPangolin001");
		expect(items[1]?.innerHTML).toContain("RoseChinchilla002");
		// Visually subordinate: indented behind a rule.
		expect(thread.className).toContain("pl-3");
		expect(thread.getAttribute("aria-label")).toBe("3 replies to this reply");
	});

	it("labels stance RELATIVE TO THE PARENT REPLY, never the post", () => {
		render(<ReplyCard reply={PARENT} onOpenImage={noop} onOpenPopup={noop} />);
		const items = screen.getAllByTestId("sub-reply");
		expect(items.map((li) => li.dataset.relation)).toEqual([
			"support",
			"counter",
			"support",
		]);
		expect(items[0]?.innerHTML).toContain(">Support<");
		expect(items[1]?.innerHTML).toContain(">Counter<");

		// Same children under a YES parent flip their labels.
		cleanup();
		render(
			<ReplyCard
				reply={{ ...PARENT, side: "YES" }}
				onOpenImage={noop}
				onOpenPopup={noop}
			/>,
		);
		expect(
			screen.getAllByTestId("sub-reply").map((li) => li.dataset.relation),
		).toEqual(["counter", "support", "counter"]);
	});

	it("offers NO reply affordance on either level — only Know more", () => {
		const { container } = render(
			<ReplyCard reply={PARENT} onOpenImage={noop} onOpenPopup={noop} />,
		);
		// Every control on the card is the read-only `Know more` pop-up; nothing
		// composes a reply, supports or counters.
		const buttons = Array.from(container.querySelectorAll("button"));
		expect(buttons.length).toBeGreaterThan(0);
		for (const b of buttons) {
			const name = `${b.textContent ?? ""} ${b.getAttribute("aria-label") ?? ""}`;
			expect(name).toContain("Know more");
		}
		expect(container.innerHTML).not.toContain("card-trigger-");
		// No download mark on a depth-2 child (the export addresses depth-1 only).
		const thread = screen.getByTestId("sub-reply-thread");
		expect(thread.innerHTML.toLowerCase()).not.toContain("download");
	});

	it("SC-1 — a removed child renders only its side and the placeholder", () => {
		const { container } = render(
			<ReplyCard reply={PARENT} onOpenImage={noop} onOpenPopup={noop} />,
		);
		const removed = screen.getAllByTestId("sub-reply")[2] as HTMLElement;
		expect(removed.innerHTML).toContain("Removed by moderator");
		expect(removed.querySelector("button")).toBeNull();
		expect(removed.innerHTML).not.toContain("pfp-placeholder");
		expect(removed.querySelector("a")).toBeNull();
		// The present siblings still render their bodies.
		expect(container.innerHTML).toContain("The counter is wrong.");
	});

	it("a child's Know more opens the pop-up with THAT child", () => {
		const onOpenPopup = vi.fn();
		render(
			<ReplyCard reply={PARENT} onOpenImage={noop} onOpenPopup={onOpenPopup} />,
		);
		const first = screen.getAllByTestId("sub-reply")[0] as HTMLElement;
		const knowMore = within(first).getByRole("button", { name: /Know more/ });
		fireEvent.click(knowMore);
		expect(onOpenPopup).toHaveBeenCalledWith(AGREE);
	});

	it("a removed depth-1 parent still shows its children", () => {
		render(
			<ReplyCard
				reply={{
					removed: true,
					id: "r1",
					ordinal: 1,
					side: "NO",
					createdAt: "2026-09-18T10:00:00.000Z",
					subReplies: [AGREE],
				}}
				onOpenImage={noop}
				onOpenPopup={noop}
			/>,
		);
		expect(screen.getAllByTestId("sub-reply").length).toBe(1);
		expect(screen.getByTestId("sub-reply-thread").innerHTML).toContain(
			"I agree with the counter.",
		);
	});

	it("no children ⇒ no thread element (existing cards unchanged)", () => {
		render(
			<ReplyCard
				reply={{ ...PARENT, subReplies: [] }}
				onOpenImage={noop}
				onOpenPopup={noop}
			/>,
		);
		expect(screen.queryByTestId("sub-reply-thread")).toBeNull();
	});
});

describe("depth-2 on the desktop reply column and the phone thread pane", () => {
	it("desktop — ReplyScroller shows the nested thread under the paged reply", () => {
		render(
			<ReplyScroller
				replies={[PARENT]}
				side="NO"
				onOpenImage={noop}
				onOpenPopup={noop}
			/>,
		);
		const thread = screen.getByTestId("sub-reply-thread");
		expect(within(thread).getAllByTestId("sub-reply").length).toBe(3);
	});

	it("phone — the Counter pane nests depth-2 under its depth-1 reply", () => {
		// A YES post: the NO depth-1 reply is a Counter to the POST, while its NO
		// child is a Support to the REPLY — the two frames must not be confused.
		const parentPost = post({
			id: "p1",
			ordinal: 1,
			side: "YES",
			replies: { support: [], counter: [PARENT] },
		});
		render(
			<PhoneDebateView
				model={modelWith([parentPost])}
				viewer={VIEWER}
				initialPostId="p1"
				ownPseudonym={null}
				details={null}
			/>,
		);
		// Tab counts stay DIRECT children only.
		expect(screen.getByTestId("phone-tab-counter").textContent).toBe(
			"Counter1",
		);
		const pane = screen.getByTestId("phone-pane-counter");
		const thread = within(pane).getByTestId("sub-reply-thread");
		const items = within(thread).getAllByTestId("sub-reply");
		expect(items.map((li) => li.dataset.relation)).toEqual([
			"support",
			"counter",
			"support",
		]);
		expect(pane.innerHTML).toContain("TealPangolin001");
	});
});
