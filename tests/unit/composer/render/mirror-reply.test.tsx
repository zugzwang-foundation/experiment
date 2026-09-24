// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MIRROR-1 · S4 — the Mirror's REPLY variant (RF-2) and the reply half of G4.
 * The statement row carries today's relation header and the `×`; the author row
 * loses its `×`; the slot RF-2 reserved immediately before the `×` carries FF-1's
 * switch on a Support reply (FF-1 shipped mid-run) and is empty on a Counter; the
 * limits read the REPLY floor.
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

	it("mirror-reply::support-carries-ff-1s-switch-in-the-slot-immediately-before-the-close", () => {
		const { container, getByLabelText, getByRole } = reply("support", "YES");
		const slot = container.querySelector('[data-mirror-slot="friendly-fire"]');
		if (!(slot instanceof HTMLElement)) {
			throw new Error("the reserved slot is missing");
		}
		// FF-1's own element — the same testids the classic header row carries.
		const row = slot.querySelector('[data-testid="ff-switch-row"]');
		expect(row).not.toBeNull();
		const ff = getByRole("switch", { name: "Friendly fire" });
		expect(slot.contains(ff)).toBe(true);
		expect(ff.getAttribute("aria-checked")).toBe("false");
		// Immediately before the ×, in the statement row's right-hand cluster.
		expect(slot.nextElementSibling).toBe(getByLabelText("Close"));
		expect(byTestId(container, "mirror-statement-row").contains(slot)).toBe(
			true,
		);
	});

	it("mirror-reply::counter-leaves-the-slot-empty", () => {
		const { container } = reply("counter", "NO");
		const slot = container.querySelector('[data-mirror-slot="friendly-fire"]');
		if (!(slot instanceof HTMLElement)) {
			throw new Error("the reserved slot is missing");
		}
		expect(slot.childNodes).toHaveLength(0);
		expect(container.querySelector('[role="switch"]')).toBeNull();
	});

	it("mirror-reply::the-switch-toggles-and-is-disabled-with-the-form-in-c2", () => {
		const on = reply("support", "YES");
		const ff = on.getByRole("switch", { name: "Friendly fire" });
		fireEvent.click(ff);
		expect(ff.getAttribute("aria-checked")).toBe("true");
		cleanup();
		// FF-1's own disabled rule: the floor above the balance disables it.
		const { getByRole } = render(
			<BetComposer
				{...composerProps()}
				viewer={{ position: null, balance: "5", spendableToday: "5" }}
				kind="reply"
				side="YES"
				parentCommentId="cmt-p1"
				replyContext={{ relation: "support", authorPseudonym: "BlueWolf472" }}
				mirror={MIRROR}
			/>,
		);
		expect(
			getByRole("switch", { name: "Friendly fire" }).hasAttribute("disabled"),
		).toBe(true);
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

	it("mirror-reply::counter-on-a-no-parent-bets-yes-and-wears-the-yes-pole", () => {
		// ⚠ The case above cannot tell a SIDE-keyed pole from a RELATION-keyed one:
		// Counter on a YES parent is NO either way. Counter on a NO parent bets YES,
		// so a pole keyed on "counter" would paint it white here and fail
		// (`@code-reviewer` L4).
		const { getByRole } = reply("counter", "YES");
		const submit = getByRole("button", { name: "PLACE Đ BET" });
		expect(submit.className).toContain("bg-yes");
		expect(submit.className).not.toContain("bg-no");
	});

	it("mirror-reply::assistive-tech-hears-ff-1s-helper-on-a-support-reply-only", () => {
		// No helper ROW is drawn (RF-1 lists none); the helper is present for
		// assistive tech, verbatim, and only where the switch is (`@code-reviewer`
		// M3).
		const s = reply("support", "YES");
		const slot = s.container.querySelector(
			'[data-mirror-slot="friendly-fire"]',
		);
		expect(slot?.textContent).toContain(
			"Contest this argument without leaving your side. Your stake still backs YES.",
		);
		expect(slot?.querySelector(".sr-only")).not.toBeNull();
		cleanup();
		const c = reply("counter", "NO");
		expect(c.container.textContent).not.toContain("Contest this argument");
	});
});
