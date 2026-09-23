// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MIRROR-1 · S4 — the Mirror's REPLY variant (RF-2) and the reply half of G4.
 * The statement row carries today's relation header and the `×`; the author row
 * loses its `×`; the reserved friendly-fire slot sits, empty, immediately before
 * the `×`; the limits read the REPLY floor.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: () => undefined,
		push: () => undefined,
		replace: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	}),
}));

import { BetComposer } from "@/components/debate/composer/BetComposer";
import { floorFor } from "@/components/debate/composer/gating";
import type { MirrorContext } from "@/components/debate/composer/MirrorComposer";
import { formatDharma } from "@/components/debate/format";
import {
	BET_MAX_STAKE,
	BET_MIN_STAKE_POST,
	BET_MIN_STAKE_REPLY,
} from "@/server/config/limits";

import { composerProps } from "./_harness";

const MIRROR: MirrorContext = {
	author: { pseudonym: "OliveBeaver000", pfpUrl: null },
	pricing: { yes: "0.100000000000000000", no: "0.900000000000000000" },
};

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function reply(
	relation: "support" | "counter",
	side: "YES" | "NO",
	authorPseudonym: string | null = "BlueWolf472",
) {
	return render(
		<BetComposer
			{...composerProps()}
			kind="reply"
			side={side}
			parentCommentId="cmt-p1"
			replyContext={{ relation, authorPseudonym }}
			mirror={MIRROR}
		/>,
	);
}

function byTestId(root: ParentNode, id: string): HTMLElement {
	const el = root.querySelector(`[data-testid="${id}"]`);
	if (!(el instanceof HTMLElement)) {
		throw new Error(`no [data-testid="${id}"]`);
	}
	return el;
}

describe("MIRROR-1 RF-2 — the statement row", () => {
	it("mirror-reply::support-and-counter-read-todays-strings", () => {
		const s = reply("support", "YES");
		expect(byTestId(s.container, "mirror-statement-row").textContent).toContain(
			"Support BlueWolf472's argument",
		);
		cleanup();
		const c = reply("counter", "NO");
		expect(byTestId(c.container, "mirror-statement-row").textContent).toContain(
			"Counter BlueWolf472's argument",
		);
	});

	it("mirror-reply::a-removed-parent-falls-back-to-the-canon-header", () => {
		const { container } = reply("counter", "NO", null);
		const row = byTestId(container, "mirror-statement-row");
		expect(row.textContent).toContain("Place your Đ BET");
		expect(row.textContent).not.toContain("argument");
	});

	it("mirror-reply::the-close-moves-to-the-statement-row", () => {
		const { container, getAllByLabelText } = reply("support", "YES");
		const closes = getAllByLabelText("Close");
		expect(closes).toHaveLength(1);
		expect(
			byTestId(container, "mirror-statement-row").contains(closes[0]),
		).toBe(true);
		expect(byTestId(container, "mirror-author-row").contains(closes[0])).toBe(
			false,
		);
	});

	it("mirror-reply::the-friendly-fire-slot-is-empty-and-immediately-before-the-close", () => {
		const { container, getByLabelText } = reply("support", "YES");
		const slot = container.querySelector('[data-mirror-slot="friendly-fire"]');
		if (!(slot instanceof HTMLElement)) {
			throw new Error("the reserved slot is missing");
		}
		expect(slot.childNodes).toHaveLength(0);
		expect(slot.nextElementSibling).toBe(getByLabelText("Close"));
		// Built nothing in it: no switch, no label, anywhere in the composer.
		expect(container.textContent).not.toMatch(/friendly/i);
	});

	it("mirror-reply::a-post-has-no-statement-row", () => {
		const { container } = render(
			<BetComposer {...composerProps()} mirror={MIRROR} />,
		);
		expect(
			container.querySelector('[data-testid="mirror-statement-row"]'),
		).toBeNull();
		expect(
			container.querySelector('[data-mirror-slot="friendly-fire"]'),
		).toBeNull();
	});
});

describe("MIRROR-1 G4 — a reply reads the REPLY floor", () => {
	it("mirror-reply::limits-render-the-reply-floor-and-the-cap-constants", () => {
		const { container } = reply("support", "YES");
		const limits = byTestId(container, "mirror-limits");
		expect(floorFor("reply")).toBe(BET_MIN_STAKE_REPLY);
		expect(limits.textContent).toContain(
			`Min Đ ${formatDharma(BET_MIN_STAKE_REPLY)}`,
		);
		expect(limits.textContent).toContain(
			`Max Đ ${formatDharma(BET_MAX_STAKE)}`,
		);
		// The post floor is a different number, so this cannot pass by accident.
		expect(BET_MIN_STAKE_REPLY).not.toBe(BET_MIN_STAKE_POST);
		expect(limits.textContent).not.toContain(
			`Min Đ ${formatDharma(BET_MIN_STAKE_POST)}`,
		);
	});

	it("mirror-reply::the-reply-amount-seeds-at-the-reply-floor", () => {
		const { getByLabelText, container } = reply("counter", "NO");
		expect((getByLabelText("Stake amount") as HTMLInputElement).value).toBe(
			BET_MIN_STAKE_REPLY,
		);
		expect(byTestId(container, "mirror-amount-echo").textContent).toBe(
			`Đ ${formatDharma(BET_MIN_STAKE_REPLY)}`,
		);
	});

	it("mirror-reply::the-submit-wears-the-bet-side-pole-not-the-relation", () => {
		// Counter on a YES parent bets NO: the pole is the SIDE's (NO = white).
		const { getByRole } = reply("counter", "NO");
		const submit = getByRole("button", { name: "PLACE Đ BET" });
		expect(submit.className).toContain("bg-no");
		expect(submit.className).not.toContain("bg-yes");
	});
});
