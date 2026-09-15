// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	usePathname: () => "/",
	useRouter: () => ({ back: () => {}, push: () => {} }),
}));

/**
 * The render counters. Each wrapper IS the component React renders, so the
 * count is a real invocation count rather than a proxy for one — which is the
 * whole reason this is a mock and not a DOM snapshot: an unchanged `outerHTML`
 * is satisfied by a component that re-rendered to the same markup, and "the
 * tick re-renders only the digits" is a claim about the render, not the markup.
 */
const renders = { digits: 0, identity: 0, rules: 0 };

vi.mock("@/components/shell/CountdownDigits", async (importOriginal) => {
	const mod =
		await importOriginal<typeof import("@/components/shell/CountdownDigits")>();
	return {
		CountdownDigits: (props: Parameters<typeof mod.CountdownDigits>[0]) => {
			renders.digits++;
			return mod.CountdownDigits(props);
		},
	};
});
vi.mock("@/components/shell/IdentityCluster", async (importOriginal) => {
	const mod =
		await importOriginal<typeof import("@/components/shell/IdentityCluster")>();
	return {
		IdentityCluster: (props: Parameters<typeof mod.IdentityCluster>[0]) => {
			renders.identity++;
			return mod.IdentityCluster(props);
		},
	};
});
vi.mock("@/components/shell/RulesControl", async (importOriginal) => {
	const mod =
		await importOriginal<typeof import("@/components/shell/RulesControl")>();
	return {
		RulesControl: (props: Parameters<typeof mod.RulesControl>[0]) => {
			renders.rules++;
			return mod.RulesControl(props);
		},
	};
});

import { GlobalHeader } from "@/components/shell/GlobalHeader";

/**
 * ADR-0051 A13 — THE COUNTDOWN ON THE PHONE HEADER.
 *
 * A13 D-1 rules the row `home · rules · logo · countdown · identity` below
 * `--breakpoint-mobile`, withdraws the GitHub control from that tier, and D-3
 * withdraws A9 D-3's centred logo there. D-2 rules the countdown onto the tick
 * `BrandCluster` already owns.
 *
 * ⛔⛔ THIS FILE REPLACES `phone-round-ten-header.test.tsx`, WHICH GUARDED THE
 * CONTROL A13 D-1 WITHDRAWS. That file's nine rows were about
 * `GitHubIconControl` — its href, its register, its `::after` hit region, its
 * position as the right zone's first child. The component is deleted, so eight
 * of the nine have no subject left and cannot be inverted into anything. The
 * ninth CAN be, and is: *the control is absent below 640, and the desktop's own
 * GitHub control still renders*. That row is the first describe block here, and
 * it is what keeps the withdrawal asserted in both directions rather than
 * merely unguarded (the WARLI-MOUNT precedent, ADR-0048 `:82`).
 *
 * ⚠ WHAT THIS CANNOT CLAIM. jsdom performs no layout and resolves no media
 * query, so nothing here proves the row FITS at 360, that adjacent gaps are
 * equal to the eye, or that the mark renders at 48px. Those are browser
 * measurements and live in the round's report (AGENTS.md §9). What is held
 * here: the right nodes exist, in the right order, carrying the right tokens
 * after `cn()` composition — and, behaviourally, that one interval drives the
 * countdown and that a tick reaches nothing but the digits.
 *
 * ⛔ NO PHONE-VARIANT LITERAL APPEARS IN THIS FILE. Tailwind v4's source
 * detection scans `tests/`, so a class-shaped literal here becomes a real
 * emitted utility (AGENTS.md §8). The prefix is ASSEMBLED AT RUNTIME.
 *
 * No jest-dom in this repo — plain DOM assertions only.
 */

const V = "max-mobile";
const S = ":";
const phone = (utility: string) => V + S + utility;

const VIEWER = { pseudonym: "RedFox001", pfpUrl: "/pfp-placeholder.svg" };

afterEach(cleanup);

beforeEach(() => {
	renders.digits = 0;
	renders.identity = 0;
	renders.rules = 0;
	// VisitorCounter POSTs /api/visits on mount.
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({ json: async () => ({ total: 1 }) })),
	);
});

function header(opts?: {
	viewer?: typeof VIEWER | null;
	responsive?: boolean;
}) {
	return render(
		<GlobalHeader
			viewer={opts?.viewer === undefined ? VIEWER : opts.viewer}
			portfolio={opts?.viewer === null ? null : "2480.000000000000000000"}
			spendable={opts?.viewer === null ? null : "610.000000000000000000"}
			stars={1234}
			mobileResponsive={opts?.responsive ?? true}
		/>,
	).container;
}

const tokens = (el: Element | null | undefined) =>
	(el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

describe("A13 D-1 — GitHub leaves the phone, and the desktop keeps it", () => {
	it("phone-a13::NO-github-control-renders-below-640-in-either-arm", () => {
		for (const viewer of [VIEWER, null]) {
			const root = header({ viewer });
			// The withdrawn control's own testid, and the href it pointed at: a
			// re-mount under a new name is the substitution this row has to catch.
			expect(
				root.querySelector('[data-testid="github-icon"]'),
				"a GitHub icon control is mounted in the header again. A13 D-1 " +
					"withdraws it below 640 and A12 D-1's `one off-site control` with " +
					"it — the phone row has no width for a repository link.",
			).toBeNull();
			cleanup();
		}
	});

	it("phone-a13::the-DESKTOP-github-control-still-renders-and-still-hides-below-640", () => {
		// ⛔ THE OTHER HALF, AND WITHOUT IT THE ROW ABOVE IS SATISFIED BY A HEADER
		// THAT HAS NO GITHUB CONTROL AT ALL. A13 D-1 says the desktop KEEPS it:
		// the left zone's star control, inside the wrapper that hides at phone
		// width. So the repository is reachable at 1440 and from nowhere at 360,
		// which is the ruling rather than an omission.
		const root = header();
		const secondary = root.querySelector(
			'[data-testid="header-secondary-controls"]',
		);
		expect(secondary, "the secondary-controls wrapper is gone").not.toBeNull();
		expect(
			secondary?.querySelector('a[href*="github.com"]'),
			"the desktop GitHub control is gone from the left zone. A13 withdraws " +
				"the PHONE control; removing this one leaves the repository " +
				"unreachable at every width.",
		).not.toBeNull();
		expect(
			tokens(secondary),
			"the secondary wrapper stopped hiding below 640, so the desktop's " +
				"GitHub control now renders on the phone row it was withdrawn from.",
		).toContain(phone("hidden"));
	});
});

describe("A13 D-2 — the countdown is mounted alone below 640", () => {
	it("phone-a13::the-digits-render-below-640-and-carry-no-wordmark", () => {
		const root = header();
		const cd = root.querySelector('[data-testid="phone-countdown"]');
		expect(cd, "no phone countdown in the header").not.toBeNull();
		// DIGITS ONLY. The desktop lockup is wordmark-over-digits; A13 D-2 mounts
		// the digit row alone, so a wordmark inside this node means the phone got
		// the whole cluster rather than the countdown.
		expect(
			cd?.querySelector('[data-testid="brand-cluster-text"]'),
			"the phone countdown contains the desktop brand block.",
		).toBeNull();
		// ⚠ THE CELL COUNT IS NOT A CONSTANT AND MUST NOT BE WRITTEN AS ONE. The
		// ratified OQ-8 rule keys it off the string — 9 cells while days > 99, 8
		// after — so a literal `8` here is a guard that reddens on a date rather
		// than on a defect. What A13 D-2 rules is that the string ships AS-IS:
		// one cell per character, no pair dropped.
		// ⚠ AND THE SELECTOR IS THE ROW'S CHILDREN, NOT `span > span`. This node
		// is itself a span wrapping the row span, so a descendant selector counts
		// the row as one of its own cells and reads one too many.
		const row = cd?.firstElementChild;
		const cells = row?.children ?? [];
		const display = (cd?.textContent ?? "").trim();
		expect(
			cells.length,
			"the phone countdown does not render one cell per character of the " +
				"DD:HH:MM string. A13 D-2 ships the string as-is; dropping a pair is " +
				"vetoed.",
		).toBe(display.length);
		expect(display.replace(/\d/g, "#")).toMatch(/^#{2,3}:##:##$/);
	});

	it("phone-a13::the-BASE-display-is-none-and-only-the-phone-arm-restores-it", () => {
		// ⛔⛔ THE ROW THE A10 DEFECT WOULD HAVE FAILED, kept from the file this
		// one replaces because the trap is the same: two DISPLAY tokens on one
		// node, one prefixed and one not. Written as a single literal the pair
		// would be `hidden` beside an unprefixed `flex`, equal specificity, and
		// the cascade would decide by emission order — the countdown would paint
		// at 1440 and widen the desktop brand cell.
		const t = tokens(header().querySelector('[data-testid="phone-countdown"]'));
		expect(t, "the countdown is not hidden at the desktop tier").toContain(
			"hidden",
		);
		expect(
			t,
			"an unprefixed `flex` survived beside `hidden`, so the countdown's " +
				"display is decided by stylesheet emission order rather than by tier.",
		).not.toContain("flex");
		expect(t).toContain(phone("flex"));
	});

	it("phone-a13::a-mount-that-says-nothing-gets-NO-countdown-at-all", () => {
		// The polarity, again: a third mount inherits the header it has today.
		expect(
			header({ responsive: false }).querySelector(
				'[data-testid="phone-countdown"]',
			),
		).toBeNull();
	});

	it("phone-a13::it-is-aria-hidden-because-the-link-already-speaks-the-time", () => {
		const root = header();
		expect(
			root
				.querySelector('[data-testid="phone-countdown"]')
				?.getAttribute("aria-hidden"),
			"the phone countdown is exposed to assistive tech. The brand link's " +
				"`aria-label` already carries the remaining time in words and is the " +
				"ruled carrier (leg-2); a second copy reads the freeze twice.",
		).toBe("true");
		// ⛔ ANCHORED THROUGH THE BRAND BLOCK, NOT THROUGH `a[href="/"]`. There are
		// TWO home links in this header — BrandCluster's and HeaderNav's Home icon
		// — and the icon comes FIRST in DOM order, so the obvious selector returns
		// the wrong one and this assertion silently becomes a claim about Home's
		// label. `phone-round-nine-header.test.tsx` records the same trap.
		const brandLink = root
			.querySelector('[data-testid="brand-cluster-text"]')
			?.closest("a");
		expect(brandLink?.getAttribute("aria-label")).toMatch(
			/until market freeze\.$/,
		);
	});
});

describe("A13 D-1 — the row reads home · rules · logo · countdown · identity", () => {
	it("phone-a13::all-five-render-in-that-DOM-order-in-both-arms", () => {
		for (const viewer of [VIEWER, null]) {
			const root = header({ viewer });
			const row = root.querySelector("header > div");
			if (!row) throw new Error("the header row is unreachable.");
			// Located by what each control IS, never by index: an index-ordered
			// assertion passes on a row whose members have been swapped for
			// lookalikes, and this is the one claim A13 D-1 makes in one sentence.
			const nodes = [
				row.querySelector('[aria-label="Home"]'),
				[...row.querySelectorAll("button")].find(
					(b) => (b.textContent ?? "").trim().toLowerCase() === "rules",
				),
				row.querySelector('img[src*="zugzwang-mark"]'),
				row.querySelector('[data-testid="phone-countdown"]'),
				viewer === null
					? row.querySelector('a[href="/sign-in"]')
					: row.querySelector('[data-testid="identity-chip-link"]'),
			];
			const names = ["home", "rules", "logo", "countdown", "identity"];
			nodes.forEach((n, i) => {
				expect(n, `${names[i]} does not render below 640`).toBeTruthy();
			});
			for (let i = 1; i < nodes.length; i++) {
				expect(
					// biome-ignore lint/style/noNonNullAssertion: asserted truthy above.
					nodes[i - 1]!.compareDocumentPosition(nodes[i] as Node) &
						Node.DOCUMENT_POSITION_FOLLOWING,
					`${names[i]} does not follow ${names[i - 1]} in the row. A13 D-1 ` +
						`rules the order left to right, and DOM order is what a flex ` +
						`line renders — nothing here re-orders visually.`,
				).toBeTruthy();
			}
			cleanup();
		}
	});

	it("phone-a13::the-row-flattens-so-every-gap-comes-from-ONE-declaration", () => {
		// ⛔ `contents` ON BOTH ZONE WRAPPERS IS WHAT MAKES "all gaps equal" A
		// STRUCTURAL PROPERTY. Leave either as a box and the row has a second gap
		// declaration that agrees with the first only while somebody maintains it
		// — and the A13 D-4 ladder moves the row gap twice.
		const root = header();
		const row = root.querySelector("header > div");
		const rowTokens = tokens(row);
		expect(rowTokens, "the row is not a flex line below 640").toContain(
			phone("flex"),
		);
		expect(
			rowTokens.some((t) => t.startsWith(phone("gap-"))),
			"the row declares no phone gap, so it keeps the 18px desktop one.",
		).toBe(true);
		const left = row?.firstElementChild;
		expect(
			tokens(left),
			"the left zone is still a box below 640, so home→rules takes its gap " +
				"and rules→logo takes the row's — two numbers, equal by hand.",
		).toContain(phone("contents"));
	});

	it("phone-a13::the-desktop-row-keeps-its-grid-and-its-18px-gap", () => {
		// ADR-0045's first rule: the phone tokens are ADDITIVE. The unprefixed
		// grid is the ≥640 default and takes zero diff.
		const rowTokens = tokens(header().querySelector("header > div"));
		for (const t of [
			"grid",
			"grid-cols-[1fr_auto_1fr]",
			"gap-[18px]",
			"px-6",
		]) {
			expect(rowTokens, `the desktop row lost \`${t}\``).toContain(t);
		}
		expect(
			tokens(header({ responsive: false }).querySelector("header > div")).some(
				(t) => t.startsWith(V + S),
			),
			"a mount that omits the prop gets phone tokens on the row.",
		).toBe(false);
	});
});

describe("A13 D-2 — one tick, and it reaches nothing but the digits", () => {
	it("phone-a13::five-minute-ticks-re-render-the-digits-FIVE-times-and-the-siblings-ZERO", () => {
		vi.useFakeTimers();
		try {
			header();
			const base = { ...renders };
			expect(base.digits, "the digits did not render at mount").toBeGreaterThan(
				0,
			);
			// ⛔⛔ THE ADVANCE MUST BE WRAPPED IN `act`, AND WITHOUT IT THIS ROW
			// READS ZERO AND LOOKS LIKE A BROKEN TICK. The interval fires and
			// `setDisplay` runs, but React 19 schedules the re-render through its
			// own scheduler — outside `act` the fake clock advances and nothing is
			// flushed, so the counters never move. A guard that reports 0 renders
			// for a countdown that works is the same class of wrong answer as a
			// probe that mutates what it measures: precise, plausible, and about
			// the harness rather than the code.
			for (let i = 0; i < 5; i++) {
				act(() => {
					vi.advanceTimersByTime(60_000);
				});
			}
			const ticked = {
				digits: renders.digits - base.digits,
				identity: renders.identity - base.identity,
				rules: renders.rules - base.rules,
			};
			// TWO digit rows are mounted below 640 — the desktop block's (hidden)
			// and the phone one — and both re-render, so the count is per tick
			// times two. What is asserted is that it moves once per MINUTE
			// boundary, not once per second: the display string is minute-granular
			// and React bails out on an unchanged one.
			expect(
				ticked.digits,
				"the digits did not re-render once per mounted row per minute. " +
					"Either the tick stopped reaching them or the formatter is no " +
					"longer minute-granular.",
			).toBe(5 * base.digits);
			expect(
				[ticked.identity, ticked.rules],
				"a header sibling re-rendered on the countdown's tick. The tick is " +
					"state inside `BrandCluster`; anything else re-rendering means it " +
					"has been lifted into a parent both share, which puts a 1Hz " +
					"interval through the whole header.",
			).toEqual([0, 0]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("phone-a13::the-header-arms-exactly-ONE-interval", () => {
		vi.useFakeTimers();
		const spy = vi.spyOn(globalThis, "setInterval");
		try {
			header();
			expect(
				spy.mock.calls.length,
				`the header armed ${spy.mock.calls.length} intervals. A13 D-2 rules ` +
					`the phone countdown onto the tick BrandCluster already owns — a ` +
					`second timer against the same target drifts from the first the ` +
					`moment either is throttled, and the two digit rows then disagree.`,
			).toBe(1);
			expect(spy.mock.calls[0]?.[1]).toBe(1_000);
		} finally {
			spy.mockRestore();
			vi.useRealTimers();
		}
	});
});
