// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PositionMarker } from "@/components/debate/badges";
import { BetComposer } from "@/components/debate/composer/BetComposer";
import {
	COMPOSER_COPY,
	FRIENDLY_FIRE_COPY,
} from "@/components/debate/composer/copy";
import { GLOSSARY } from "@/lib/copy/glossary";

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
 * FF-1 CLOSE-1 (R-A12 / R-A15) adds the WHERE and the GLOSS: the switch is a
 * descendant of the composer's header row (`data-testid="composer-header"`,
 * fenced by symbol — O-8), after the statement and before the close control,
 * never inside the argument region; the helper line sits directly beneath the
 * header row only while the switch renders; and at/above 640px the label
 * carries the markers' hover gloss (verbatim copy, pinned as the WHOLE
 * sentence), while below 640px nothing mounts — with a Flipped marker under the
 * same harness as the positive control, so an empty render cannot pass as a
 * working gate. Placement is asserted by DOM containment and document order,
 * never by class (OVN-V5) and never by `textContent` alone (O-7 / OVN-V6).
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const ORIGINAL_MATCH_MEDIA = window.matchMedia;

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	// jsdom has no native `matchMedia` — restore that exact absence, as
	// `tests/unit/ui/info-tip.test.tsx` does, so a later row is not handed a
	// leftover tier from an earlier one.
	window.matchMedia = ORIGINAL_MATCH_MEDIA;
});

/**
 * Per-query `matchMedia` stub, the `info-tip.test.tsx` shape: `InfoTip` asks
 * the POINTER question and, through `useIsPhoneTier`, the TIER question, and a
 * blanket answer would make "fine pointer" also mean "phone" — the one
 * combination that suppresses the component entirely.
 */
const POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const TIER_QUERY = "not all and (min-width: 640px)";

function mockMatchMedia(pointerFine: boolean, phone: boolean): void {
	window.matchMedia = ((query: string) => ({
		matches:
			query === POINTER_QUERY
				? pointerFine
				: query === TIER_QUERY
					? phone
					: false,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	})) as typeof window.matchMedia;
}

const SWITCH_GLOSS_YES =
	"Friendly fire: a Support reply that backs the side but contests this argument. The bet itself is unchanged — your stake still backs YES.";
const SWITCH_GLOSS_NO =
	"Friendly fire: a Support reply that backs the side but contests this argument. The bet itself is unchanged — your stake still backs NO.";

/** The element the gloss content lands in (a Radix portal on `document.body`). */
function glossContent(trigger: Element): HTMLElement | null {
	const id = trigger.getAttribute("aria-describedby");
	return id === null ? null : document.getElementById(id);
}

/** Direct child of the composer `<section>` that holds `el`, or null. */
function sectionChildHolding(
	container: HTMLElement,
	el: Element | null,
): Element | null {
	const section = container.querySelector("section");
	let cur: Element | null = el;
	while (cur !== null && cur.parentElement !== section) {
		cur = cur.parentElement;
	}
	return cur;
}

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
		// The label (in the switch row) and the helper line (beneath the header
		// row, CLOSE-1 R-A12), verbatim — the side being bought is YES.
		const row = container.querySelector('[data-testid="ff-switch-row"]');
		expect(row?.innerHTML).toContain("Friendly fire");
		const helper = container.querySelector('[data-testid="ff-helper"]');
		expect(helper?.innerHTML).toContain(
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
		const helper = container.querySelector('[data-testid="ff-helper"]');
		expect(helper?.innerHTML).toContain("Your stake still backs NO.");
		expect(helper?.innerHTML).not.toContain("backs YES");
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

describe("friendly-fire switch — WHERE it sits (CLOSE-1 R-A12)", () => {
	it("ff-switch::is-a-DESCENDANT-of-the-header-row-and-NOT-of-the-argument-region", () => {
		stubWireFetch([]);
		const { container } = render(
			<BetComposer {...replyProps("support", "YES")} />,
		);
		const header = container.querySelector('[data-testid="composer-header"]');
		const sw = container.querySelector('[data-testid="ff-switch"]');
		expect(header, "the header row is fenced by symbol").not.toBeNull();
		expect(sw).not.toBeNull();
		expect(header?.contains(sw), "the switch is inside the header row").toBe(
			true,
		);
		// The header row is a direct child of the composer section; so is the
		// argument region (the direct child holding the body textarea). The
		// switch resolves to the FORMER and not the LATTER — asserted through the
		// section's children rather than a class, so a restyle cannot move the
		// meaning of this test (OVN-V5).
		const body = screen.getByLabelText<HTMLTextAreaElement>("Argument body");
		const argumentRegion = sectionChildHolding(container, body);
		expect(argumentRegion).not.toBeNull();
		expect(argumentRegion).not.toBe(header);
		expect(argumentRegion?.contains(sw)).toBe(false);
		expect(sectionChildHolding(container, sw)).toBe(header);
	});

	it("ff-switch::follows-the-statement-and-PRECEDES-the-close-control-in-DOM-order", () => {
		stubWireFetch([]);
		const { container } = render(
			<BetComposer {...replyProps("support", "YES")} />,
		);
		const header = container.querySelector(
			'[data-testid="composer-header"]',
		) as Element;
		const sw = container.querySelector('[data-testid="ff-switch"]') as Element;
		const close = header.querySelector('button[aria-label="Close"]');
		expect(close, "the close control lives in the header row").not.toBeNull();
		const statement = Array.from(header.querySelectorAll("span")).find((s) =>
			(s.textContent ?? "").includes("'s argument"),
		);
		expect(statement).not.toBeNull();
		const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
		expect(
			(statement as Element).compareDocumentPosition(sw) & FOLLOWING,
			"the switch comes AFTER the statement",
		).toBeTruthy();
		expect(
			sw.compareDocumentPosition(close as Element) & FOLLOWING,
			"the close control comes AFTER the switch",
		).toBeTruthy();
		// The label is beside the switch, in the same group, and unchanged.
		const label = container.querySelector('[data-testid="ff-switch-label"]');
		expect(label?.innerHTML).toContain("Friendly fire");
		expect(sw.getAttribute("aria-label")).toBe("Friendly fire");
	});

	it("ff-switch::the-helper-line-sits-DIRECTLY-BENEATH-the-header-row-and-only-while-the-switch-renders", () => {
		stubWireFetch([]);
		const { container } = render(
			<BetComposer {...replyProps("support", "NO")} />,
		);
		const header = container.querySelector(
			'[data-testid="composer-header"]',
		) as Element;
		const helper = container.querySelector('[data-testid="ff-helper"]');
		expect(helper).not.toBeNull();
		expect(header.contains(helper), "not inside the header row").toBe(false);
		expect(
			helper?.previousElementSibling,
			"the header row's next sibling",
		).toBe(header);
		expect(helper?.innerHTML).toContain(
			"Contest this argument without leaving your side. Your stake still backs NO.",
		);
		// Absent exactly when the switch is absent: Counter and top-level.
		cleanup();
		stubWireFetch([]);
		const counter = render(<BetComposer {...replyProps("counter", "NO")} />);
		expect(
			counter.container.querySelector('[data-testid="ff-switch"]'),
		).toBeNull();
		expect(
			counter.container.querySelector('[data-testid="ff-helper"]'),
		).toBeNull();
		expect(counter.container.innerHTML).not.toContain(
			"Contest this argument without leaving your side.",
		);
		cleanup();
		stubWireFetch([]);
		const top = render(<BetComposer {...composerProps()} />);
		expect(top.container.querySelector('[data-testid="ff-helper"]')).toBeNull();
		expect(top.container.innerHTML).not.toContain("ff-");
	});
});

describe("friendly-fire switch — the label's gloss (CLOSE-1 R-A15)", () => {
	it("ff-switch-gloss::at-and-above-640px-the-label-carries-the-VERBATIM-gloss-naming-the-side-bought", async () => {
		// Touch branch (Popover) at the desktop tier — jsdom's notional viewport.
		mockMatchMedia(false, false);
		stubWireFetch([]);
		const { container } = render(
			<BetComposer {...replyProps("support", "YES")} />,
		);
		const label = container.querySelector(
			'[data-testid="ff-switch-label"]',
		) as Element;
		expect(label).not.toBeNull();
		expect(
			label.getAttribute("aria-describedby"),
			"the gloss is wired onto the label",
		).toBeTruthy();
		fireEvent.click(label);
		await waitFor(() => {
			expect(glossContent(label)).not.toBeNull();
		});
		// The WHOLE sentence, exactly — not a fragment that a re-worded gloss
		// could still contain.
		expect(glossContent(label)?.textContent).toBe(SWITCH_GLOSS_YES);
		expect(FRIENDLY_FIRE_COPY.gloss("NO")).toBe(SWITCH_GLOSS_NO);
		// Opening the gloss did NOT toggle the switch: the label is not the
		// switch, and the switch's contract is unchanged.
		expect(
			container
				.querySelector('[data-testid="ff-switch"]')
				?.getAttribute("aria-checked"),
		).toBe("false");
	});

	it("ff-switch-gloss::pointer-branch-at-and-above-640px-opens-the-same-sentence-on-hover", async () => {
		mockMatchMedia(true, false);
		stubWireFetch([]);
		const { container } = render(
			<BetComposer {...replyProps("support", "NO")} />,
		);
		const label = container.querySelector(
			'[data-testid="ff-switch-label"]',
		) as Element;
		fireEvent.pointerMove(label, { pointerType: "mouse" });
		fireEvent.pointerEnter(label, { pointerType: "mouse" });
		fireEvent.mouseEnter(label);
		fireEvent.focus(label);
		await waitFor(() => {
			expect(
				Array.from(document.querySelectorAll('[role="tooltip"]')).some(
					(el) => el.textContent === SWITCH_GLOSS_NO,
				),
			).toBe(true);
		});
	});

	it("ff-switch-gloss::below-640px-NOTHING-mounts-on-the-label-and-the-helper-line-carries-the-meaning (Flipped-marker positive control)", async () => {
		// Both branches, because the tier gate is a viewport question and the
		// pointer question is orthogonal to it (info-tip.test.tsx's own row).
		for (const pointerFine of [true, false]) {
			mockMatchMedia(pointerFine, true);
			stubWireFetch([]);
			const { container } = render(
				<BetComposer {...replyProps("support", "YES")} />,
			);
			const label = container.querySelector(
				'[data-testid="ff-switch-label"]',
			) as Element;
			expect(
				label,
				`pointerFine=${pointerFine}: the label renders`,
			).not.toBeNull();
			expect(label.innerHTML).toContain("Friendly fire");
			expect(label.getAttribute("aria-describedby")).toBeNull();
			fireEvent.click(label);
			fireEvent.pointerEnter(label, { pointerType: "mouse" });
			fireEvent.focus(label);
			await new Promise((r) => setTimeout(r, 0));
			expect(document.body.textContent).not.toContain(SWITCH_GLOSS_YES);
			expect(
				document.querySelectorAll("[data-radix-popper-content-wrapper]").length,
			).toBe(0);
			// The helper line is what carries the meaning on the phone.
			expect(
				container.querySelector('[data-testid="ff-helper"]')?.innerHTML,
			).toContain(
				"Contest this argument without leaving your side. Your stake still backs YES.",
			);
			// A Flipped marker under the SAME phone-tier harness mounts nothing
			// either — the gate is the tier, shared with the markers, not a switch
			// that lost its gloss.
			const marker = render(<PositionMarker marker="Flipped" />);
			const chip = marker.container.querySelector(
				'[aria-label="Author Flipped"]',
			);
			expect(chip).not.toBeNull();
			expect(chip?.getAttribute("aria-describedby")).toBeNull();
			cleanup();
		}
		// POSITIVE CONTROL — the same marker, same harness, at/above 640px DOES
		// mount its gloss and opens with `GLOSSARY.flipped`; without this the
		// row above passes against a harness in which no gloss can be seen at all.
		mockMatchMedia(false, false);
		const { container } = render(<PositionMarker marker="Flipped" />);
		const chip = container.querySelector(
			'[aria-label="Author Flipped"]',
		) as Element;
		expect(chip.getAttribute("aria-describedby")).toBeTruthy();
		fireEvent.click(chip);
		await waitFor(() => {
			expect(glossContent(chip)?.textContent).toBe(GLOSSARY.flipped);
		});
	});
});
