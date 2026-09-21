// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";
import {
	COMPOSER_COPY,
	FRIENDLY_FIRE_COPY,
} from "@/components/debate/composer/copy";

import { composerProps, EXTENDED, stubWireFetch, TITLE } from "./_harness";

/**
 * FF-1 / ADR-0058 — G12, the COMPOSER half: the friendly-fire switch.
 *
 * The switch is offered exactly when the reply would be a Support (the host's
 * relation IS `friendlyFireEligible(parentSide, sideBeingBought)`, see the
 * component note), never on Counter, never in the top-level composer; toggling
 * it on is the ONLY thing that puts `friendlyFire: true` on the wire; and a
 * relation flip remounts the composer, which is what resets the switch.
 *
 * ⚠ THE WIRE ASSERTION READS THE REAL REQUEST BODY off a stubbed fetch, the
 * `side-identity.test.tsx` pattern — a prop passed to a mock would prove only
 * that the mock was called. Both directions are pinned (present when on, ABSENT
 * when off), so a builder that always sent the key, or never did, fails one of
 * the two. `O-7`: every markup assertion reads `innerHTML` or an attribute.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const PARENT_ID = "0199aa00-0000-7000-8000-000000004001";

function replyProps(relation: "support" | "counter", side: "YES" | "NO") {
	return {
		...composerProps(),
		side,
		kind: "reply" as const,
		parentCommentId: PARENT_ID,
		replyContext: { relation, authorPseudonym: "fixture-author" },
	};
}

function typeAndSubmit() {
	fireEvent.change(screen.getByLabelText<HTMLInputElement>("Argument title"), {
		target: { value: TITLE },
	});
	fireEvent.change(
		screen.getByLabelText<HTMLTextAreaElement>("Argument body"),
		{ target: { value: EXTENDED } },
	);
	fireEvent.click(screen.getByRole("button", { name: COMPOSER_COPY.submit }));
}

/** The parsed body of the ONE place request on the stubbed wire, or null. */
function placedBody(
	fetchStub: ReturnType<typeof vi.fn>,
): Record<string, unknown> | null {
	for (const call of fetchStub.mock.calls) {
		if (!String(call[0]).includes("/api/bets/place")) continue;
		const init = call[1] as RequestInit | undefined;
		if (typeof init?.body !== "string") continue;
		return JSON.parse(init.body) as Record<string, unknown>;
	}
	return null;
}

describe("friendly-fire switch — where it renders (D-51 R2 / R5)", () => {
	it("ff-switch::renders-under-Support-default-OFF-with-the-ruled-copy", () => {
		stubWireFetch([]);
		const { container } = render(
			<BetComposer {...replyProps("support", "YES")} />,
		);
		const sw = container.querySelector('[data-testid="ff-switch"]');
		expect(sw).not.toBeNull();
		expect(sw?.getAttribute("role")).toBe("switch");
		expect(sw?.getAttribute("aria-checked")).toBe("false");
		expect(sw?.getAttribute("aria-label")).toBe("Friendly fire");
		// The label and the helper line, verbatim (the side being bought is YES).
		const row = container.querySelector('[data-testid="ff-switch-row"]');
		expect(row?.innerHTML).toContain("Friendly fire");
		expect(row?.innerHTML).toContain(
			"Contest this argument without leaving your side. Your stake still backs YES.",
		);
		expect(FRIENDLY_FIRE_COPY.helper("NO")).toBe(
			"Contest this argument without leaving your side. Your stake still backs NO.",
		);
	});

	it("ff-switch::the-helper-names-the-side-being-BOUGHT", () => {
		stubWireFetch([]);
		const { container } = render(
			<BetComposer {...replyProps("support", "NO")} />,
		);
		const row = container.querySelector('[data-testid="ff-switch-row"]');
		expect(row?.innerHTML).toContain("Your stake still backs NO.");
		expect(row?.innerHTML).not.toContain("backs YES");
	});

	it("ff-switch::absent-under-Counter", () => {
		stubWireFetch([]);
		const { container } = render(
			<BetComposer {...replyProps("counter", "NO")} />,
		);
		expect(container.querySelector('[data-testid="ff-switch"]')).toBeNull();
		expect(container.innerHTML).not.toContain("Friendly fire");
	});

	it("ff-switch::absent-in-the-top-level-composer", () => {
		stubWireFetch([]);
		const { container } = render(<BetComposer {...composerProps()} />);
		expect(container.querySelector('[data-testid="ff-switch"]')).toBeNull();
		expect(container.innerHTML).not.toContain("ff-");
		expect(container.innerHTML).not.toContain("Friendly fire");
	});
});

describe("friendly-fire switch — what reaches the wire", () => {
	it("ff-switch::OFF-puts-NO-key-on-the-wire (byte-identical pre-ADR body)", async () => {
		const fetchStub = stubWireFetch([{ status: 200, body: { ok: true } }]);
		render(<BetComposer {...replyProps("support", "YES")} />);
		typeAndSubmit();
		await vi.waitFor(() => {
			expect(placedBody(fetchStub)).not.toBeNull();
		});
		const body = placedBody(fetchStub) as Record<string, unknown>;
		expect("friendlyFire" in body).toBe(false);
		expect(body.parentCommentId).toBe(PARENT_ID);
		expect(body.side).toBe("YES");
	});

	it("ff-switch::ON-puts-friendlyFire-true-on-the-wire", async () => {
		const fetchStub = stubWireFetch([{ status: 200, body: { ok: true } }]);
		const { container } = render(
			<BetComposer {...replyProps("support", "YES")} />,
		);
		const sw = container.querySelector('[data-testid="ff-switch"]');
		expect(sw).not.toBeNull();
		fireEvent.click(sw as Element);
		expect(sw?.getAttribute("aria-checked")).toBe("true");
		typeAndSubmit();
		await vi.waitFor(() => {
			expect(placedBody(fetchStub)).not.toBeNull();
		});
		const body = placedBody(fetchStub) as Record<string, unknown>;
		expect(body.friendlyFire).toBe(true);
		// The bet itself is unchanged by the flag: same side, same parent.
		expect(body.side).toBe("YES");
		expect(body.parentCommentId).toBe(PARENT_ID);
	});

	it("ff-switch::toggling-twice-returns-to-OFF-and-sends-no-key", async () => {
		const fetchStub = stubWireFetch([{ status: 200, body: { ok: true } }]);
		const { container } = render(
			<BetComposer {...replyProps("support", "NO")} />,
		);
		const sw = container.querySelector('[data-testid="ff-switch"]') as Element;
		fireEvent.click(sw);
		fireEvent.click(sw);
		expect(sw.getAttribute("aria-checked")).toBe("false");
		typeAndSubmit();
		await vi.waitFor(() => {
			expect(placedBody(fetchStub)).not.toBeNull();
		});
		expect("friendlyFire" in (placedBody(fetchStub) ?? {})).toBe(false);
	});
});

describe("friendly-fire switch — selecting Counter unmounts AND resets it", () => {
	it("ff-switch::relation-flip-remounts-the-composer-so-the-switch-comes-back-OFF", () => {
		// Both hosts key the composer on the relation (`DebateView.tsx`
		// `key={openReply}`, `PhoneDebateView.tsx` `key={…sheet.side}`), so a flip
		// is a REMOUNT — modelled here the way the hosts do it, with `key`.
		stubWireFetch([]);
		const { container, rerender } = render(
			<BetComposer key="support" {...replyProps("support", "YES")} />,
		);
		const sw = container.querySelector('[data-testid="ff-switch"]') as Element;
		fireEvent.click(sw);
		expect(sw.getAttribute("aria-checked")).toBe("true");

		// Counter: the switch is GONE, not merely off.
		rerender(<BetComposer key="counter" {...replyProps("counter", "NO")} />);
		expect(container.querySelector('[data-testid="ff-switch"]')).toBeNull();
		expect(container.innerHTML).not.toContain("Friendly fire");

		// Back to Support: a fresh instance, OFF — the earlier ON did not survive.
		rerender(<BetComposer key="support-2" {...replyProps("support", "YES")} />);
		const again = container.querySelector('[data-testid="ff-switch"]');
		expect(again).not.toBeNull();
		expect(again?.getAttribute("aria-checked")).toBe("false");
	});
});
