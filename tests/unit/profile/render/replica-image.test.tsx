// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArgumentList } from "@/components/profile/ArgumentList";
import type { ProfileSelection } from "@/components/profile/selection";
import type { ProfileArgumentItem } from "@/server/profile/arguments";
import type { ProfileUser } from "@/server/profile/resolve";

/**
 * PROFILE-IMAGE — the replica card (the panel's picked argument) shows the
 * argument's own attachment in its image slot, and shows NOTHING there when the
 * argument has none (no placeholder box). Asserted on element presence and
 * `src`, not flattened text (O-7). Fixtures are inline DTOs; no server code runs.
 */

afterEach(cleanup);

const USER: ProfileUser = {
	id: "0190c0de-1111-7000-8000-0000000000f1",
	pseudonym: "RedFox001",
	banned: false,
	pfpUrl: "/pfp-placeholder.svg",
};

const C_POST = "0190c0de-2222-7000-8000-0000000000b1";
const C_REPLY = "0190c0de-2222-7000-8000-0000000000b2";
const M_ID = "0190c0de-3333-7000-8000-0000000000b1";
const IMAGE_URL = "https://r2.example.test/u/fixture.webp?X-Amz-Signature=abc";

const post = (imageUrl: string | null): ProfileArgumentItem => ({
	removed: false,
	kind: "post",
	id: C_POST,
	side: "YES",
	marketSlug: "fixture-post",
	marketTitle: "Market question",
	ordinal: 1,
	title: "Post fixture title",
	teaser: "",
	body: "Post fixture title",
	marker: "none",
	authorStake: "12.000000000000000000",
	authorStakeOriginal: "12.000000000000000000",
	authorSold: false,
	priceAtBet: "0.310000000000000000",
	imageUrl,
	createdAt: "2026-07-01T00:00:00.000Z",
	aggregate: {
		supportCount: 0,
		counterCount: 0,
		supportDharma: "0.000000000000000000",
		counterDharma: "0.000000000000000000",
	},
});

const reply = (imageUrl: string | null): ProfileArgumentItem => ({
	removed: false,
	kind: "reply",
	id: C_REPLY,
	side: "NO",
	marketSlug: "fixture-post",
	marketTitle: "Market question",
	ordinal: 1,
	replyOrdinal: 1,
	title: "Reply fixture title",
	teaser: "",
	body: "Reply fixture title",
	marker: "none",
	stake: "6.000000000000000000",
	stakeOriginal: "6.000000000000000000",
	sold: false,
	priceAtBet: "0.270000000000000000",
	repliedToTitle: "A parent argument",
	imageUrl,
	createdAt: "2026-07-02T00:00:00.000Z",
});

const pick = (commentId: string): ProfileSelection => ({
	marketId: M_ID,
	marketTitle: "Market question",
	commentId,
});

const slot = (id: string) =>
	screen.getByTestId(`argument-replica-image-slot-${id}`);

describe("PROFILE-IMAGE — the replica card shows the attachment", () => {
	it("replica::a-post-with-an-image-renders-it-in-the-slot", () => {
		render(
			<ArgumentList
				items={[post(IMAGE_URL)]}
				owner={false}
				author={USER}
				selection={pick(C_POST)}
			/>,
		);
		const img = slot(C_POST).querySelector("img");
		expect(img).not.toBeNull();
		expect(img?.getAttribute("src")).toBe(IMAGE_URL);
	});

	it("replica::a-reply-with-an-image-renders-it-in-the-slot", () => {
		render(
			<ArgumentList
				items={[reply(IMAGE_URL)]}
				owner={false}
				author={USER}
				selection={pick(C_REPLY)}
			/>,
		);
		expect(slot(C_REPLY).querySelector("img")?.getAttribute("src")).toBe(
			IMAGE_URL,
		);
	});

	it("replica::no-image-means-an-EMPTY-slot-not-a-placeholder", () => {
		render(
			<ArgumentList
				items={[post(null)]}
				owner={false}
				author={USER}
				selection={pick(C_POST)}
			/>,
		);
		expect(slot(C_POST).innerHTML).toBe("");
	});

	it("replica::clicking-the-image-opens-the-lightbox", () => {
		render(
			<ArgumentList
				items={[post(IMAGE_URL)]}
				owner={false}
				author={USER}
				selection={pick(C_POST)}
			/>,
		);
		expect(screen.queryByRole("dialog")).toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: "Open attached image" }),
		);
		const dialog = screen.getByRole("dialog");
		expect(dialog.querySelector("img")?.getAttribute("src")).toBe(IMAGE_URL);
	});
});
