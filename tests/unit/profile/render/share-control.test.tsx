// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArgumentList } from "@/components/profile/ArgumentList";
import type { ProfileArgumentItem } from "@/server/profile/arguments";
import type { ProfileUser } from "@/server/profile/resolve";

/**
 * The profile's argument head carries the market card's working Share control
 * (it replaced a disabled download stub, 2026-10-04). Outside `/m/[slug]` the
 * control cannot read its market from the route, so the card passes it — and
 * a REPLY is addressed by its post's ordinal AND its own rank within that post,
 * the `?post=N&reply=M` the export route takes. The assertion is the request
 * the click makes, which is the only thing that proves the right image.
 */

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const AUTHOR: ProfileUser = {
	id: "0190c0de-1111-7000-8000-0000000000f1",
	pseudonym: "RedFox001",
	banned: false,
	pfpUrl: "/pfp-placeholder.svg",
};

const post: ProfileArgumentItem = {
	removed: false,
	kind: "post",
	id: "0190b3a0-9999-7000-8000-00000000000c",
	side: "YES",
	marketSlug: "will-x-happen",
	marketTitle: "Will X happen?",
	ordinal: 4,
	title: "A profile argument",
	teaser: "",
	body: "",
	marker: "none",
	authorStake: "50.000000000000000000",
	authorStakeOriginal: "50.000000000000000000",
	authorSold: false,
	priceAtBet: "0.270000000000000000",
	createdAt: "2026-07-01T00:00:00.000Z",
	aggregate: {
		supportCount: 0,
		counterCount: 0,
		supportDharma: "0",
		counterDharma: "0",
	},
};

const reply: ProfileArgumentItem = {
	removed: false,
	kind: "reply",
	id: "0190b3a0-9999-7000-8000-00000000000e",
	side: "YES",
	marketSlug: "will-x-happen",
	marketTitle: "Will X happen?",
	ordinal: 4,
	replyOrdinal: 2,
	title: "A profile reply",
	teaser: "",
	body: "",
	marker: "none",
	stake: "6.000000000000000000",
	stakeOriginal: "6.000000000000000000",
	sold: false,
	priceAtBet: "0.270000000000000000",
	repliedToTitle: "A parent argument",
	createdAt: "2026-07-01T00:00:00.000Z",
};

async function requestedBy(item: ProfileArgumentItem): Promise<string> {
	const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
	vi.stubGlobal("fetch", fetchMock);
	const { container } = render(
		<ArgumentList items={[item]} owner={false} author={AUTHOR} />,
	);
	const share = container.querySelector<HTMLButtonElement>(
		'button[aria-label="Share as image"]',
	);
	if (share === null) throw new Error("expected the Share control");
	expect(share.disabled).toBe(false);
	fireEvent.click(share);
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
	return String((fetchMock.mock.calls[0] as unknown[])[0]);
}

describe("profile argument head — Share", () => {
	it("a post exports its own image", async () => {
		expect(await requestedBy(post)).toBe(
			"/m/will-x-happen/export/image?post=4",
		);
	});

	it("a reply exports ITS image, not its post's", async () => {
		expect(await requestedBy(reply)).toBe(
			"/m/will-x-happen/export/image?post=4&reply=2",
		);
	});

	it("a REMOVED argument carries no Share control", () => {
		const removed: ProfileArgumentItem = {
			removed: true,
			kind: "post",
			id: post.id,
			side: "YES",
			marketSlug: "will-x-happen",
			marketTitle: "Will X happen?",
			ordinal: 4,
			createdAt: "2026-07-01T00:00:00.000Z",
			aggregate: {
				supportCount: 0,
				counterCount: 0,
				supportDharma: "0",
				counterDharma: "0",
			},
		};
		const { container } = render(
			<ArgumentList items={[removed]} owner={false} author={AUTHOR} />,
		);
		expect(
			container.querySelector('button[aria-label="Share as image"]'),
		).toBeNull();
	});

	it("a reply whose post was REMOVED carries no Share control — the export refuses it for good", () => {
		const orphan: ProfileArgumentItem = {
			...(reply as Extract<
				ProfileArgumentItem,
				{ kind: "reply"; removed: false }
			>),
			repliedToTitle: null,
		};
		const { container } = render(
			<ArgumentList items={[orphan, post]} owner={false} author={AUTHOR} />,
		);
		// Positive control: the post beside it still has one.
		expect(
			container.querySelectorAll('button[aria-label="Share as image"]'),
		).toHaveLength(1);
	});

	it("no disabled download stub is left beside it", () => {
		const { container } = render(
			<ArgumentList items={[post]} owner={false} author={AUTHOR} />,
		);
		expect(
			container.querySelector('[aria-label^="Download — no per-argument"]'),
		).toBeNull();
	});
});
