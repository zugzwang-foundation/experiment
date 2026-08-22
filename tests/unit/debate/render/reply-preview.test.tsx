// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReplyPreview } from "@/components/debate/ReplyPreview";
import type { DebateReply, ReplyGroups } from "@/components/debate/types";

/**
 * POLISH.3 PR 2 · C1 — the reply-expansion guard (plan §7; §6 row 13).
 *
 * Row 13 (`PD-3-10`, C7) — TIER 1, SPEC.1 §9 F-DEBATE-1: "a 'show all replies'
 * affordance expands EACH SIDE'S full stake-sorted list". The build concatenates
 * the two sides into one flat array AT THE SOURCE (`ReplyPreview.tsx:29`,
 * `all = [...support, ...counter]`), so every consumer downstream of that line
 * is side-blind.
 *
 * ⚠ A side-blind expansion on the reply-as-bet surface is a THESIS-ADJACENT
 * defect, not a layout one: Support and Counter are read-time aggregates over
 * SIDE, and a flat list erases the distinction the affordance exists to show.
 *
 * ⚠ The read model ALREADY carries them apart — `ReplyGroups` exposes
 * `support`, `counter` and `twoSlot` separately — so the fix partitions what is
 * already there and adds NO `DebateViewModel` field (ADR-0034 D-1 does not
 * fire).
 *
 * ⚠ SUPERSEDED AT HTML-FINISH · MARKET DETAIL row 25 (SPEC.1 1.0.31): `PostCard`
 * renders `ReplyPreview` at ZERO call sites. It used to render it at TWO (the
 * removed branch and the present branch), and that is why this guard renders the
 * component DIRECTLY — which is also why the guard survives the removal
 * unamended, still pinning the row-13 partition on the component itself.
 * ⚠ UNWIRE-1 — this suite is now the component's ONLY consumer
 * (`bookmark-toggle.test.tsx` is deleted along with the bookmark module); see
 * `ReplyPreview.tsx`'s own docblock for why the file is kept.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM only.
 */

afterEach(cleanup);

/** HTML-FINISH · MARKET DETAIL row 27 — the reply pop-up host. These suites
 * assert spacing / partitioning / images, never the pop-up, so a
 * no-op is the honest stand-in. `reply-card.test.tsx` is where the `+` is
 * pinned. */
const noopPopup = () => {};

/** HTML-FINISH · MARKET DETAIL row 26 — the reply-image lightbox host.
 * These suites assert spacing / partitioning, never the image, so
 * a no-op is the honest stand-in: it keeps the prop REQUIRED at the component
 * (O-1) without pretending this file tests the lightbox. */
const noopImage = () => {};

/** Neutral fixture prose — no invented market content (CLAUDE.md §3). */
function reply(id: string, side: "YES" | "NO", body: string): DebateReply {
	return {
		removed: false,
		id,
		side,
		createdAt: "2026-07-30T00:00:00.000Z",
		body,
		marker: "none",
		author: { pseudonym: "fixture-replier", pfpUrl: "" },
		stake: "5.000000000000000000",
		// RANK-1 — the substrate stake is SURVIVING basis; nothing is sold in this fixture.
		stakeOriginal: "5.000000000000000000",
		sold: false,
		entryPrice: "0.500000000000000000",
		imageUrl: null,
	};
}

const SUPPORT_TOP = reply(
	"0199a0c0-0000-7000-8000-0000000005a1",
	"YES",
	"Fixture support reply ALPHA.",
);
const SUPPORT_TAIL = reply(
	"0199a0c0-0000-7000-8000-0000000005a2",
	"YES",
	"Fixture support reply BETA.",
);
const COUNTER_TOP = reply(
	"0199a0c0-0000-7000-8000-0000000005b1",
	"NO",
	"Fixture counter reply GAMMA.",
);
const COUNTER_TAIL = reply(
	"0199a0c0-0000-7000-8000-0000000005b2",
	"NO",
	"Fixture counter reply DELTA.",
);

/** Two per side, two in the default slot — so the expansion has a tail on BOTH
 * sides. A fixture with a tail on only one side passes on a flat list. */
const GROUPS: ReplyGroups = {
	support: [SUPPORT_TOP, SUPPORT_TAIL],
	counter: [COUNTER_TOP, COUNTER_TAIL],
	twoSlot: [SUPPORT_TOP, COUNTER_TOP],
};

function renderPreview() {
	return render(
		<ReplyPreview
			replies={GROUPS}
			onOpenImage={noopImage}
			onOpenPopup={noopPopup}
		/>,
	);
}

function expand() {
	fireEvent.click(screen.getByRole("button", { name: /Show all/ }));
}

describe("POLISH.3 PR 2 — the side-aware 'show all replies' expansion", () => {
	it("reply-preview::collapsed-still-shows-the-two-slot-default", () => {
		// The two-slot default is SPEC-MANDATED (SPEC.1 §9 F-DEBATE-1) and the
		// plan explicitly does NOT remove it (§2). Pinned so the row-13 fix
		// cannot quietly take it out.
		const { container } = renderPreview();

		expect(container.innerHTML).toContain("Fixture support reply ALPHA.");
		expect(container.innerHTML).toContain("Fixture counter reply GAMMA.");
		expect(container.innerHTML).not.toContain("Fixture support reply BETA.");
		expect(container.innerHTML).not.toContain("Fixture counter reply DELTA.");
	});

	it("reply-preview::expansion-partitions-into-two-side-keyed-groups", () => {
		// The structural half: the expanded view is TWO lists, not one. A flat
		// concatenation renders every reply and would satisfy a naive
		// "all four are present" assertion — which is exactly the defect.
		const { container } = renderPreview();
		expand();

		expect(
			container.querySelector('[data-testid="reply-group-support"]'),
		).not.toBeNull();
		expect(
			container.querySelector('[data-testid="reply-group-counter"]'),
		).not.toBeNull();
	});

	it("reply-preview::each-side-group-holds-only-its-own-side", () => {
		// The semantic half, and the one a flat list cannot pass: each group
		// carries its OWN side's full list and NOTHING from the other side.
		// Asserted on each group element's innerHTML — the element that carries
		// the row's subject (O-7), never the composed root.
		const { container } = renderPreview();
		expand();

		const support = container.querySelector(
			'[data-testid="reply-group-support"]',
		);
		const counter = container.querySelector(
			'[data-testid="reply-group-counter"]',
		);

		expect(support?.innerHTML).toContain("Fixture support reply ALPHA.");
		expect(support?.innerHTML).toContain("Fixture support reply BETA.");
		expect(support?.innerHTML).not.toContain("Fixture counter reply GAMMA.");
		expect(support?.innerHTML).not.toContain("Fixture counter reply DELTA.");

		expect(counter?.innerHTML).toContain("Fixture counter reply GAMMA.");
		expect(counter?.innerHTML).toContain("Fixture counter reply DELTA.");
		expect(counter?.innerHTML).not.toContain("Fixture support reply ALPHA.");
		expect(counter?.innerHTML).not.toContain("Fixture support reply BETA.");
	});
});
