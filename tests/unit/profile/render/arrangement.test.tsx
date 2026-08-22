// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// POSREV-1 — `PositionsTable` now owns the inline sell, which calls `useRouter`
// for its post-sale `refresh()`. Nothing here submits; the stub only has to exist.
vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { ArgumentList } from "@/components/profile/ArgumentList";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { PositionsTable } from "@/components/profile/PositionsTable";
import { ProfileTiles } from "@/components/profile/ProfileTiles";
import type { ProfileArgumentItem } from "@/server/profile/arguments";
import type {
	ProfilePositionLot,
	ProfilePositionRow,
} from "@/server/profile/positions";
import type { ProfileUser } from "@/server/profile/resolve";
import type { ProfileTiles as ProfileTilesData } from "@/server/profile/tiles";

/**
 * HTML-FINISH · PROFILE — the arrangement guards, one per shipped row.
 *
 * ⚠ THESE ASSERT ON `innerHTML` / element ORDER, NEVER ON `textContent`
 * (CLAUDE.md §8 O-7). Every row here is a COMPOSITION delta — which element
 * wraps which, and in what order — and `textContent` flattens exactly the
 * markup that carries the meaning. A `textContent` assertion on row 15 or
 * row 19 passes on the pre-change build it was written to reject.
 *
 * ⚠ NO VALUE IS ASSERTED. These guards pin topology (`auto-rows-fr`, sibling
 * order, nesting) and never a colour, radius, px or type size — the mockups
 * are light-mode prototypes (DESIGN.B1) and the shipped system owns the
 * values, so a guard that pinned one would pin the wrong thing.
 *
 * Fixtures are INLINE plain objects on the shipped `src/server/profile/*` DTOs
 * (type-only imports — no server code executes; NO DB), matching the posture of
 * `surface.test.tsx`. No market content is invented (CLAUDE.md §3).
 */

afterEach(cleanup);

const TILES: ProfileTilesData = {
	walletValue: "500.000000000000000000",
	positionsValue: "120.000000000000000000",
	netProfitLoss: "-30.000000000000000000",
	argumentsCount: { total: 5, posts: 3, replies: 2 },
	supportReceived: "40.000000000000000000",
	counterReceived: "12.000000000000000000",
};

const USER: ProfileUser = {
	id: "0190c0de-1111-7000-8000-0000000000f1",
	pseudonym: "RedFox001",
	banned: false,
	pfpUrl: "/pfp-placeholder.svg",
};

const M1 = "0190c0de-aaaa-7000-8000-000000000001"; // Open market
const M2 = "0190c0de-bbbb-7000-8000-000000000002"; // settled market
const C_OPENER = "0190c0de-ffff-7000-8000-000000000044";

const L1 = "0190c0de-2222-7000-8000-000000000001";
const L2 = "0190c0de-2222-7000-8000-000000000002";
const L3 = "0190c0de-2222-7000-8000-000000000003";

const OPENER_CELL = {
	removed: false as const,
	commentId: C_OPENER,
	title: "Opener argument alpha",
	isReply: false,
	postOrdinal: 1,
	marketSlug: "fixture-alpha",
	repliedToTitle: null,
};

const OPENER_CELL_2 = {
	...OPENER_CELL,
	commentId: "0190c0de-ffff-7000-8000-000000000045",
	title: "Second argument alpha",
	postOrdinal: 2,
};

/**
 * ⚠⚠ POSREV-1 — THE ROWS CARRY REAL LOTS. The table's unit is the ARGUMENT, so a
 * row with no lots renders through the whole-holding FALLBACK — the drift path,
 * not the ordinary one. `ROW_SETTLED`'s lot is fully EXITED, which is what puts
 * it in the CLOSED tab: under RF-13 a Resolved MARKET no longer does that.
 */
function LOT(
	lotId: string,
	side: "YES" | "NO",
	held: boolean,
	argument: ProfilePositionLot["argument"],
): ProfilePositionLot {
	return {
		lotId,
		betId: `bet-${lotId}`,
		side,
		originalBasis: held ? "25.000000000000000000" : "8.000000000000000000",
		survivingBasis: held ? "25.000000000000000000" : "0.000000000000000000",
		survivingShares: held ? "10.000000000000000000" : "0.000000000000000000",
		sold: !held,
		placedAt: "2026-09-10T10:00:00.000Z",
		argument,
	};
}

const ROW_OPEN: ProfilePositionRow = {
	lots: [LOT(L1, "YES", true, OPENER_CELL)],
	marketId: M1,
	marketSlug: "fixture-alpha",
	marketTitle: "Market fixture-alpha",
	marketStatus: "Open",
	statusLabel: "Open",
	settled: false,
	side: "YES",
	quantity: "10.000000000000000000",
	staked: "25.000000000000000000",
	current: "31.000000000000000000",
	argument: {
		removed: false,
		commentId: C_OPENER,
		title: "Opener argument alpha",
		isReply: false,
		postOrdinal: 1,
		marketSlug: "fixture-alpha",
		repliedToTitle: null,
	},
};

/** Settled row whose episode-opening argument is content_removed (N-1a). */
const ROW_SETTLED: ProfilePositionRow = {
	lots: [LOT(L2, "NO", false, { removed: true, marketSlug: "fixture-beta" })],
	marketId: M2,
	marketSlug: "fixture-beta",
	marketTitle: "Market fixture-beta",
	marketStatus: "Resolved",
	statusLabel: "Closed",
	settled: true,
	side: "NO",
	quantity: "4.000000000000000000",
	staked: "8.000000000000000000",
	current: "12.000000000000000000",
	argument: { removed: true, marketSlug: "fixture-beta" },
};

/** The index of `child` among its parent's element children. */
function indexOf(child: Element): number {
	const parent = child.parentElement;
	if (parent === null) {
		throw new Error("indexOf: element has no parent");
	}
	return [...parent.children].indexOf(child);
}

/** The `<td>` list of one rendered position row. */
function cellsOf(marketId: string): HTMLTableCellElement[] {
	const row = screen.getByTestId(`position-tile-${marketId}`);
	return [...row.querySelectorAll("td")];
}

describe("HTML-FINISH profile rows 4 · 5 · 12 — the argument card", () => {
	const AGGREGATE = {
		supportCount: 3,
		counterCount: 1,
		supportDharma: "300.000000000000000000",
		counterDharma: "100.000000000000000000",
	};

	const POST: ProfileArgumentItem = {
		removed: false,
		kind: "post",
		id: "0190b3a0-9999-7000-8000-00000000000c",
		side: "YES",
		marketSlug: "fixture-alpha",
		marketTitle: "Market fixture-alpha",
		ordinal: 4,
		title: "A profile argument",
		teaser: "Neutral fixture teaser.",
		body: "A profile argument\n\nNeutral fixture body.",
		marker: "none",
		authorStake: "50.000000000000000000",
		// RANK-1 — the substrate stake is SURVIVING basis; nothing is sold in this fixture.
		authorStakeOriginal: "50.000000000000000000",
		authorSold: false,
		priceAtBet: "0.270000000000000000",
		createdAt: "2026-07-01T00:00:00.000Z",
		aggregate: AGGREGATE,
	};

	/**
	 * The card's head row — the first element child of the first card.
	 *
	 * ⚠ NOT `querySelector('[data-testid^="argument-"]')`. That prefix ALSO
	 * matches the LIST wrapper (`data-testid="argument-list"`), so it returned
	 * the list, and `firstElementChild` returned the CARD rather than the head
	 * row. The order guard below still passed on that — `head.querySelector` is
	 * a descendant search and `indexOf` compares against the real parent — while
	 * the separator guard, which reads the head's OWN children, correctly went
	 * RED. Recorded because a prefix selector silently widening its match is
	 * exactly the class of defect these guards exist to catch, and this one was
	 * in the guard.
	 */
	function headOf(container: HTMLElement): Element {
		const card = container.querySelector(
			'[data-testid="argument-list"]',
		)?.firstElementChild;
		const head = card?.firstElementChild;
		if (head == null) {
			throw new Error("the argument card rendered no head row");
		}
		return head;
	}

	it("row4::the-head-carries-avatar-pseudonym-chip-marker-and-stake-IN-ORDER", () => {
		const { container } = render(
			<ArgumentList items={[POST]} owner={false} author={USER} />,
		);
		const head = headOf(container);
		// Canon §3 item 11: "head = avatar · name | SIDE @ entry% | stake …".
		// ORDER, not mere presence — the pre-change head already contained the
		// chip and the stake, so a presence-only guard passes on it.
		const avatar = head.querySelector('[data-slot="avatar"]');
		const pseudonym = head.querySelector('[data-testid="argument-author"]');
		const chip = head.querySelector('[data-slot="badge"]');
		const stake = head.querySelector('[data-testid^="argument-stake-"]');
		if (avatar === null || pseudonym === null || chip === null) {
			throw new Error("row4: the head cluster is missing a part");
		}
		expect(pseudonym.textContent).toBe(USER.pseudonym);
		expect(indexOf(avatar)).toBeLessThan(indexOf(pseudonym));
		expect(indexOf(pseudonym)).toBeLessThan(indexOf(chip));
		expect(stake).not.toBeNull();
		if (stake !== null) {
			expect(indexOf(chip)).toBeLessThan(indexOf(stake));
		}
	});

	it("row4::the-vsep-separators-are-present-and-byte-exact", () => {
		const { container } = render(
			<ArgumentList items={[POST]} owner={false} author={USER} />,
		);
		const head = headOf(container);
		const seps = [...head.children].filter((c) => c.textContent === "|");
		// Canon §3 item 11 writes THREE seam points on a post head:
		// `avatar · name | SIDE @ entry% | stake | Replies · N`.
		expect(seps.length).toBe(3);
		// ⛔ The glyph is U+007C, plain ASCII — not U+2502 or any box-drawing
		// lookalike. Asserted by CODE POINT so a visually identical substitute
		// reddens.
		for (const sep of seps) {
			expect(sep.textContent?.codePointAt(0)).toBe(0x7c);
		}
	});

	it("row4::the-removed-variant-carries-the-permitted-SUBSET-and-no-body", () => {
		const removed: ProfileArgumentItem = {
			removed: true,
			kind: "post",
			id: "0190b3a0-9999-7000-8000-00000000000d",
			side: "NO",
			marketSlug: "fixture-alpha",
			marketTitle: "Market fixture-alpha",
			ordinal: 5,
			createdAt: "2026-07-01T00:00:00.000Z",
			aggregate: AGGREGATE,
		};
		const { container } = render(
			<ArgumentList items={[removed]} owner={false} author={USER} />,
		);
		const head = headOf(container);
		expect(head.querySelector('[data-slot="avatar"]')).not.toBeNull();
		expect(head.querySelector('[data-slot="badge"]')).not.toBeNull();
		// SC-1 — assert the BODY's absence, not the row's. The removed union
		// variant carries no body/teaser/title field at all, so this is the
		// compile-level guarantee restated at the render.
		expect(container.innerHTML).not.toContain("Neutral fixture body");
		expect(container.innerHTML).not.toContain("A profile argument");
	});

	it("row12::Replies-N-is-in-the-HEAD-not-in-a-footer", () => {
		const { container } = render(
			<ArgumentList items={[POST]} owner={false} author={USER} />,
		);
		const head = headOf(container);
		const replies = container.querySelector(
			'[data-testid^="argument-replies-"]',
		);
		if (replies === null) {
			throw new Error("row12: no reply count rendered");
		}
		expect(
			head.contains(replies),
			`row 12: \`Replies · N\` is not inside the head cluster — it is still ` +
				`in the footer text line.`,
		).toBe(true);
		// The count is still the sum of both poles (every reply IS a Support or
		// Counter bet — ADR-0017), so the MOVE changed no number.
		expect(replies.textContent).toBe("4");
	});

	it("row5::the-footer-running-text-is-GONE-and-a-split-bar-replaces-it", () => {
		const { container } = render(
			<ArgumentList items={[POST]} owner={false} author={USER} />,
		);
		expect(
			container.querySelector('[data-testid^="argument-split-bar-"]'),
		).not.toBeNull();
		// The pre-change footer read `· Support 3 : Đ … · Counter 1 : Đ …`. Its
		// distinctive `N : Đ` grammar must be gone, or the bar was ADDED beside
		// the text rather than replacing it.
		expect(container.textContent ?? "").not.toMatch(/Support \d+ : Đ/);
		expect(container.textContent ?? "").not.toMatch(/Counter \d+ : Đ/);
	});

	it("row5::text-is-never-inside-the-bar-and-the-bar-is-display-only", () => {
		const { container } = render(
			<ArgumentList items={[POST]} owner={false} author={USER} />,
		);
		const bar = container.querySelector('[data-testid^="argument-split-bar-"]');
		if (bar === null) {
			throw new Error("row5: no split bar rendered");
		}
		// design-language §3.2: "label — bar — label, text never inside the bar."
		const track = bar.querySelector('[aria-hidden="true"]');
		expect(track?.textContent).toBe("");
		// ⚠ DISPLAY-ONLY IS AN INVARIANT, not a style choice: Support and Counter
		// are read-time AGGREGATES over reply-bets (ADR-0017/0018); there is no
		// standalone friendly-fire vote and `friendly_fire_events` was dropped at
		// DEBATE.9. A control here would imply one exists.
		expect(bar.querySelectorAll("button").length).toBe(0);
		expect(bar.querySelectorAll("a").length).toBe(0);
		expect(bar.querySelectorAll("input").length).toBe(0);
	});

	it("row5::the-staked-total-is-the-DISPLAYED-sum-of-the-DISPLAYED-parts", () => {
		// SPEC.1 §10.8 names "the reply split bar's staked total" as one of the
		// TWO displayed-space aggregate identities: displayed total = displayed
		// Support + displayed Counter, so the visible arithmetic is always true.
		const { container } = render(
			<ArgumentList items={[POST]} owner={false} author={USER} />,
		);
		const bar = container.querySelector('[data-testid^="argument-split-bar-"]');
		const total = bar?.querySelector("b");
		expect(total?.textContent).toBe("Đ 400");
		// And `.stkn` — canon §3 item 11's "enlarged + ink".
		const classes = (total?.className ?? "").split(/\s+/);
		expect(classes).toContain("text-ink");
	});

	it("row5::the-reply-variant-gets-NO-split-bar", () => {
		// A reply has no Support/Counter aggregate of its own — the union carries
		// none, so this is structural. Asserted because a bar rendered on a reply
		// would be inventing an aggregate.
		const reply: ProfileArgumentItem = {
			removed: false,
			kind: "reply",
			id: "0190b3a0-9999-7000-8000-00000000000e",
			side: "NO",
			marketSlug: "fixture-alpha",
			marketTitle: "Market fixture-alpha",
			ordinal: 4,
			title: "A profile reply",
			teaser: "Neutral fixture teaser.",
			body: "A profile reply\n\nNeutral fixture body.",
			marker: "none",
			stake: "6.000000000000000000",
			// RANK-1 — the substrate stake is SURVIVING basis; nothing is sold in this fixture.
			stakeOriginal: "6.000000000000000000",
			sold: false,
			priceAtBet: "0.270000000000000000",
			repliedToTitle: "A parent argument",
			createdAt: "2026-07-01T00:00:00.000Z",
		};
		const { container } = render(
			<ArgumentList items={[reply]} owner={false} author={USER} />,
		);
		expect(
			container.querySelector('[data-testid^="argument-split-bar-"]'),
		).toBeNull();
	});
});

describe("FOUNDER EYE PASS item 1 — Đ on every Đ tile", () => {
	/** The four tiles whose value is a Đ quantity. */
	const DHARMA_TILES = [
		"tile-wallet",
		"tile-positions",
		"tile-support",
		"tile-counter",
	];

	it("item1::every-dharma-tile-prefixes-the-byte-carried-glyph", () => {
		render(<ProfileTiles tiles={TILES} />);
		for (const testid of DHARMA_TILES) {
			const value = screen.getByTestId(testid).children[0];
			const text = (value?.textContent ?? "").trim();
			// ⛔ ASSERTED BY CODE POINT, not by pasting the character. U+0110 has
			// lookalikes (Ð U+00D0 ETH, Đ U+0110) that are visually identical in
			// many faces; a paste-comparison would accept the wrong one.
			expect(
				text.codePointAt(0),
				`item 1: ${testid}'s value must start with Đ (U+0110). Got "${text}".`,
			).toBe(0x110);
			// …and the glyph is followed by a space and then the formatted number,
			// i.e. the shipped `Đ {formatDharma(…)}` spacing, not `Đ1,234`.
			expect(text.slice(0, 2)).toBe("Đ ");
			expect(text.length).toBeGreaterThan(2);
		}
	});

	it("item1::the-ARGUMENTS-tile-takes-no-Đ-it-is-a-count", () => {
		// The mockup gives it none (`:443`) and SPEC.1 §23 pins the string as
		// `N (P Posts | R Replies)`. A Đ here would be a category error AND a
		// spec violation.
		render(<ProfileTiles tiles={TILES} />);
		const value = screen.getByTestId("tile-arguments-value");
		expect(value.textContent).toBe("5 (3 Posts | 2 Replies)");
		expect(value.textContent).not.toContain("Đ");
	});

	it("item1::NET-P/L-CARRIES-SIGN-THEN-GLYPH-THEN-NUMBER", () => {
		// ⚠⚠ RE-INVERTED AT ROUND 4. This assertion used to PIN THE BLOCK — the
		// tile read a bare `-30` because `debate/format.ts` was read-only. Round
		// 4's allow-list opened that file for one addition
		// (`displayNetProfitLossSigned`), so the block is DISCHARGED and the
		// assertion now states the founder's form instead of the refusal.
		// ⛔ The order is SIGN → Đ → number. `Đ -30` is the shape round 3 refused
		// to ship as a consolation, so it is asserted against by name below.
		render(<ProfileTiles tiles={TILES} />);
		const tile = screen.getByTestId("tile-net-pl");
		const value = (tile.children[0]?.textContent ?? "").trim();
		// TILES.netProfitLoss is negative in this fixture (see TILES above).
		expect(value).toBe("−Đ 30");
		// …by code point, because U+2212 MINUS SIGN and the ASCII hyphen `-` are
		// near-identical on screen and `groupInteger` emits the ASCII one.
		expect(value.codePointAt(0)).toBe(0x2212);
		expect(value.codePointAt(1)).toBe(0x110);
		expect(value).not.toContain("Đ -");
	});

	it("item1::the-POSITIVE-form-is-+Đ-and-ZERO-carries-no-sign", () => {
		// The two other arms of the same tile, asserted through the REAL
		// component rather than the formatter alone — a formatter that is right
		// and a tile that drops `sign` would pass a formatter-only test.
		const gain = { ...TILES, walletValue: "500", positionsValue: "120" };
		const { unmount } = render(
			<ProfileTiles tiles={{ ...gain, netProfitLoss: "238" }} />,
		);
		expect(
			(screen.getByTestId("tile-net-pl").children[0]?.textContent ?? "").trim(),
		).toBe("+Đ 238");
		unmount();
		render(<ProfileTiles tiles={{ ...gain, netProfitLoss: "0" }} />);
		expect(
			(screen.getByTestId("tile-net-pl").children[0]?.textContent ?? "").trim(),
		).toBe("Đ 0");
	});
});

describe("ROUND 4 item 3 — the equal split is restored; the height is REFUSED", () => {
	const PAGE = "src/app/(public)/u/[pseudonym]/page.tsx";
	const page = () => readFileSync(join(process.cwd(), PAGE), "utf8");
	const headzoneClasses = () =>
		(
			/"profile-headzone"[\s\S]{0,120}?className="([^"]*)"/.exec(page())?.[1] ??
			""
		)
			.split(/\s+/)
			.filter(Boolean);

	it("item3::the-headzone-is-back-to-the-mockup's-EQUAL-split", () => {
		// ⚠⚠ RE-INVERTED AT ROUND 4, ON FOUNDER ORDER. This assertion used to pin
		// `lg:grid-cols-[3fr_2fr]` and to REJECT `lg:grid-cols-2` by name. The
		// founder ruled the narrowing the wrong lever: the mockup's `.headzone` is
		// `grid-template-columns:1fr 1fr` (`:189`) and the task is to match the
		// mockup's composition. The height was to be declared instead — see the
		// next assertion for why that half is refused.
		const token = headzoneClasses().find((c) => /^lg:grid-cols-/.test(c));
		expect(
			token,
			"item 3: the headzone declares no lg grid template",
		).toBeDefined();
		expect(
			token,
			`item 3: the headzone is not on the mockup's equal split. ` +
				`\`3fr 2fr\` was round 3's lever and the founder reverted it.`,
		).toBe("lg:grid-cols-2");
	});

	it("item3::the-ARENA-keeps-its-EQUAL-split", () => {
		// Both bands are `1fr 1fr` in the mockup (`:189`, `:221`), and they must
		// share one breakpoint or the identity band would go two-column while the
		// arena below it was still stacked.
		const cls =
			/"profile-arena"[\s\S]{0,200}?className="([^"]*)"/.exec(page())?.[1] ??
			"";
		expect(cls.split(/\s+/)).toContain("lg:grid-cols-2");
	});

	it("item3::THE-BAND-HEIGHT-IS-DECLARED—the-round-4-refusal-is-DISCHARGED", () => {
		// ⚠⚠ RE-INVERTED AT ROUND 5. This assertion used to pin a REFUSAL: it
		// rejected every `h-*` on the headzone, prefixed or not, because declaring
		// a height while `ProfileGraphCard` still carried `aspect-[2/1] w-full`
		// spilled 140px of chart over the arena at 1440 (measured at round 4).
		// The founder opened that file under a sizing-only fence, the aspect is
		// gone, and the height is now DECLARED — so the guard states the number
		// instead of forbidding it.
		//
		// ⛔ 256 IS DERIVED, NOT COPIED. The mockup's band is a fixed 188px and is
		// NOT the source. Measured live, `1fr 1fr`, identity height taken with the
		// grid stretch removed, sweeping for the smallest band that fits:
		//   1024 → 256 (the binding case) · 1280 → 256 · 1440 → 216 · 1920 → 216
		// One number for all of `lg`+, so it is the worst case. Swept 1024→2560 in
		// 16px steps: zero breaks. Re-measured with `Đ 999,999` in every tile:
		// still 255 at 1024 — the tile grid's height is driven by its fixed LABEL
		// copy, not by value widths.
		// ⚠⚠ PROFILE-FULL — THE FIGURE IS THE MOCKUP'S 188. D-1 was reopened
		// ("change whichever of the three the mockup requires") and answered: the
		// identity block lost its `<Card>` frame — the mockup's `.idcard` is a BARE
		// flex row (`:190`) — and the tiles took the mockup's density. That 32px of
		// `p-4` was the whole obstacle: it left a 156px content box holding 166px of
		// content, which no type size could close. The column now needs 174 at 1440
		// inside a 188 box. ⛔ The predicate is UNCHANGED: still an exact-value
		// `toEqual` on the band's `lg:h-*` set.
		const declared = headzoneClasses().filter((c) => /^lg:h-\[/.test(c));
		expect(
			declared,
			`item B: the headzone declares no lg height. The band must be DECLARED ` +
				`so the arena gets the remaining space — that is the founder's hard ` +
				`command, and it is what makes the square PFP's feedback loop ` +
				`impossible to close.`,
		).toEqual(["lg:h-[188px]"]);
		// ⛔ AND THE ROW TRACK — the half that is invisible when dropped. A single
		// IMPLICIT row is content-sized, so `align-content:stretch` can grow it to
		// the container height but never shrink it below content; the graph's
		// `<svg viewBox … preserveAspectRatio="none">` then floors it. MEASURED with
		// the height alone: band 188, row 256, PFP 256.
		expect(headzoneClasses()).toContain("lg:grid-rows-[188px]");
	});

	it("item3::the-height-is-lg-SCOPED-so-the-stacked-layout-is-not-crushed", () => {
		// ⛔ Below `lg` the two bands stack to one column and the identity card
		// sits above a full-width graph; a 256px cap there would crush both. The
		// page grows and scrolls below `lg` (item A), so no height is declared.
		for (const c of headzoneClasses()) {
			expect(
				/^(h-|min-h-(?!0$)|max-h-)/.test(c),
				`item B: the headzone declares \`${c}\` UNPREFIXED — that caps the ` +
					`stacked layout below \`lg\` too, where the identity card and a ` +
					`full-width graph need far more than 256px.`,
			).toBe(false);
		}
	});

	// UNWIRE-1 — `item3::the-graph-card-no-longer-derives-its-HEIGHT-from-its-WIDTH`
	// removed whole. It read `profile/graph/ProfileGraphCard.tsx` directly, which
	// is deleted along with the rest of the Profile Dharma graph. The four tests
	// above it assert on the SURVIVING `profile-headzone` div's own className
	// string (source-scanned from `page.tsx`, untouched by the graph's removal)
	// and remain meaningful and green.
});

describe("FOUNDER EYE PASS item 2 — the selected filter half is unmistakable", () => {
	const PAYLOAD = { owner: false as const, rows: [ROW_OPEN, ROW_SETTLED] };

	it("item2::the-selected-half-FILLS-and-the-other-does-not", () => {
		// ⚠⚠ THE MECHANISM MOVED AT POSREV-1 RF-9 AND THE LAW DID NOT. Item 2's
		// ring made the selected half unmistakable by EDGE; the founder ruled that
		// the selected option must fill the BLOCK, not just its text. So the
		// assertion moves from `--ring-active` to the fill — and the crude
		// they-must-differ check below, which is the one that would have caught the
		// original defect, is untouched.
		// ⛔ THE FILL IS `n7`, NOT `#fafafa`. `--color-no` IS #fafafa: it encodes
		// the NO SIDE under INV-3, and this toggle sits inches from tiles reading
		// `Yes`. `n7` is the brightest NEUTRAL rung and carries no side meaning.
		render(<PositionsTable payload={PAYLOAD} />);
		const open = screen.getByTestId("positions-status-open");
		const closed = screen.getByTestId("positions-status-closed");
		expect(open.getAttribute("aria-pressed")).toBe("true");
		expect(open.className).toContain("bg-n7");
		expect(closed.className).not.toContain("bg-n7");
		// ⛔ AND NEVER THE NO POLE — asserted by name, because "it looks white" and
		// "it IS the NO pole" are the same pixel and different bugs.
		expect(open.className).not.toContain("bg-no");
		expect(open.className).not.toContain("bg-ink");
		// …and the label INVERTS with the fill, so the pair reads as one block
		// rather than as bright text on a bright ground.
		expect(open.className).toContain("text-ground");
		expect(closed.className).toContain("text-n5");
		// ⚠⚠ THE ASSERTION THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT, and it is
		// deliberately the crudest one here: the two halves must not RENDER THE
		// SAME. Round 2 shipped `variant={selected ? "default" : "outline"}`,
		// whose guard asserted `aria-pressed` flipped — true, passing, and
		// invisible on screen, because those two variants are byte-identical.
		// Every guard written for a VISUAL difference must compare the two
		// states against each other, not assert a flag on one of them.
		expect(
			open.className,
			`item 2: the selected and unselected halves render the SAME class ` +
				`string. Whatever mechanism is in use expresses no visible ` +
				`difference — which is exactly the defect the founder found.`,
		).not.toBe(closed.className);
	});

	it("item2::the-FILL-FOLLOWS-the-selection", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(screen.getByTestId("positions-status-closed"));
		expect(screen.getByTestId("positions-status-closed").className).toContain(
			"bg-n7",
		);
		expect(screen.getByTestId("positions-status-open").className).not.toContain(
			"bg-n7",
		);
	});

	it("item2::the-toggle-is-a-PLAIN-button-so-the-fill-cannot-be-overruled", () => {
		// ⛔⛔ THE REASON RF-9 COULD NOT JUST ADD `bg-n7` TO THE `Button` PRIMITIVE.
		// `buttonVariants` puts `bg-(--btn-fill)` on the element for EVERY variant
		// — the one-button system — so a `bg-n7` in `className` would be a SECOND
		// background utility on one element, and two utilities for one property
		// resolve by STYLESHEET EMISSION ORDER rather than by the order written.
		// This file's own neighbours record three instances of exactly that trap
		// (an inert `line-clamp` under a stray `block`; `size="xs"` fighting
		// explicit padding; two `[outline:…]` on one row). The control below reads
		// the SHIPPED primitive and proves the conflict is real rather than feared.
		const src = readFileSync(
			join(process.cwd(), "src/components/ui/button.tsx"),
			"utf8",
		);
		expect(src).toContain("bg-(--btn-fill)");
		// ⇒ so the toggle renders a bare `<button>`, carrying exactly ONE
		// background declaration and the focus token applied by name.
		render(<PositionsTable payload={PAYLOAD} />);
		const open = screen.getByTestId("positions-status-open");
		expect(open.className).not.toContain("bg-(--btn-fill)");
		expect(open.className).toContain(
			"focus-visible:shadow-(--state-focus-ring)",
		);
	});

	it("item2::POSITIVE-CONTROL-a-variant-swap-CANNOT-express-selection-here", () => {
		// ⚠⚠ THE REASON THE BUG WAS INVISIBLE, PINNED SO IT CANNOT BE REINTRODUCED.
		// The pair was `variant={selected ? "default" : "outline"}`. Read the two
		// variant strings off the SHIPPED primitive: they are IDENTICAL, by
		// design ("One-button system … primary and outline render identically",
		// `ui/button.tsx:13-15`). Anyone "simplifying" item 2 back to a variant
		// swap ships a toggle with correct ARIA and zero pixels of difference.
		const src = readFileSync(
			join(process.cwd(), "src/components/ui/button.tsx"),
			"utf8",
		);
		const grab = (name: string) =>
			new RegExp(`\\b${name}:\\s*\\n?\\s*"([^"]*)"`).exec(src)?.[1] ?? null;
		const def = grab("default");
		const outline = grab("outline");
		expect(def, "could not read the `default` variant string").toBeTruthy();
		expect(outline, "could not read the `outline` variant string").toBeTruthy();
		expect(
			def,
			`ui/button.tsx's \`default\` and \`outline\` are no longer identical. ` +
				`If the one-button system changed, item 2's ring may no longer be ` +
				`the right mechanism — re-derive it rather than reverting.`,
		).toBe(outline);
	});
});

describe("HTML-FINISH profile row 15 — the tile value sits ABOVE its label", () => {
	it("row15::value-node-precedes-label-node-in-every-tile", () => {
		render(<ProfileTiles tiles={TILES} />);
		const grid = screen.getByTestId("profile-tiles");
		// Every tile, not just one: the swap lives in the shared `Tile` leaf, so a
		// guard over a single tile would pass on a per-tile regression.
		const tiles = [...grid.children];
		expect(tiles.length).toBe(6);
		for (const tile of tiles) {
			const [first, second] = [...tile.children];
			if (first === undefined || second === undefined) {
				throw new Error("row15: a tile has fewer than two element children");
			}
			// The LABEL is the muted span; the VALUE is the emphasised `text-ink`
			// one. Asserted by CLASS ROLE rather than by reading the strings, so the
			// guard cannot be greened by re-typing a label.
			// ⚠ PROFILE-FULL — THE MUTED TOKEN IS `text-n4` NOW, not `text-n5`. The
			// mockup's `.tl` is `color:var(--n4)` (`:209`) and the label took its
			// whole register (8px/800/.12em/uppercase/n4) in the same change. Still a
			// ramp token, so the monochrome census is untouched; still the LABEL's
			// role, so this guard's predicate is unchanged.
			expect(
				second.className,
				`row 15: the second child of a tile must be the LABEL span. Got ` +
					`"${second.className}" — the label/value order has flipped back.`,
			).toContain("text-n4");
			expect(first.className).toContain("text-ink");
		}
	});

	it("row15::POSITIVE-CONTROL-the-order-check-detects-the-pre-change-order", () => {
		// ⚠ PROOF BY REVERSAL. The assertion above is a claim about ORDER, and an
		// order claim that has never been run against the other order is
		// indistinguishable from one that cannot fail. This runs the same
		// predicate over a deliberately label-first fragment.
		const { container } = render(
			<div data-testid="control-tile">
				<span className="text-[8px] text-n4">Wallet value</span>
				<span className="font-medium text-ink tabular-nums">Đ 500</span>
			</div>,
		);
		const tile = container.querySelector('[data-testid="control-tile"]');
		if (tile === null) {
			throw new Error("row15 control: fixture did not render");
		}
		const [first, second] = [...tile.children];
		// The real guard demands the muted label SECOND; the pre-change order has it
		// first, so the same predicate is false here.
		expect(second?.className).not.toContain("text-n4");
		expect(first?.className).toContain("text-n4");
	});
});

describe("POSREV-1 rows 6 · 14 · 17 — the positions grid, re-cut per ARGUMENT", () => {
	/**
	 * ⚠⚠ THIS BLOCK REPLACES THE HTML-FINISH rows 6 · 14 · 17 SUITE, AND EVERY
	 * ROW IT DROPPED WAS DROPPED BY A FOUNDER RULING RATHER THAN BY CONVENIENCE.
	 * The four it asserted are recorded here so a later reader can tell a deletion
	 * from an omission:
	 *
	 *   row6::status-and-sell-live-INSIDE-the-position-cell — RF-12 DELETES the
	 *     status token outright and RF-5 gives Sell its own column, so the cell
	 *     that held both now holds only the side.
	 *   row6::the-status-badge-survives-on-EVERY-row (A-8) — INVERTED. It rested
	 *     on SPEC.1 §23's "status Open / Closed by market state"; RF-12 rules that
	 *     market status renders NOWHERE. ⛔ THE SPEC STILL SAYS OTHERWISE and the
	 *     conflict is REPORTED, not papered over — `struck-and-held.test.tsx`
	 *     carries the inverted guard and the note.
	 *   row6::there-is-no-trailing-action-column — REVERSED: there is one, and it
	 *     is `Sell`.
	 *   row14::the-empty-arrow-track-is-FOURTH-of-five — the track went with the
	 *     `Staked` column it separated. One value column needs no relation glyph.
	 */
	const OWNER_PAYLOAD = {
		owner: true as const,
		rows: [
			{ ...ROW_OPEN, sellEligible: true },
			{ ...ROW_SETTLED, sellEligible: false },
		],
	};

	it("grid::the-OPEN-tab-is-Position-Argument-Current-Sell", () => {
		render(<PositionsTable payload={OWNER_PAYLOAD} />);
		const heads = [
			...screen.getByTestId("positions-table").querySelectorAll("thead th"),
		].map((th) => (th.textContent ?? "").trim());
		expect(heads).toEqual(["Position", "Argument", "Current", "Sell"]);
	});

	it("grid::the-CLOSED-tab-is-Position-Argument-Staked-Opened", () => {
		// ⛔ NO `Current` — it would read `Đ 0` on every single row, which is a
		// column that costs a read and answers nothing. ⛔ NO `Sell` — there is
		// nothing left to sell.
		render(<PositionsTable payload={OWNER_PAYLOAD} />);
		fireEvent.click(screen.getByTestId("positions-status-closed"));
		const heads = [
			...screen.getByTestId("positions-table").querySelectorAll("thead th"),
		].map((th) => (th.textContent ?? "").trim());
		expect(heads).toEqual(["Position", "Argument", "Staked", "Opened"]);
	});

	it("grid::every-tile-has-FOUR-cells-and-no-arrow-track", () => {
		render(<PositionsTable payload={OWNER_PAYLOAD} />);
		const cells = cellsOf(L1);
		expect(cells.length).toBe(4);
		// The `→` survives on the GROUP HEADER, where it still relates two figures.
		// Asserting its absence from the tile AND its presence on the header is what
		// distinguishes "moved" from "deleted".
		expect(cells.map((c) => (c.textContent ?? "").trim())).not.toContain("→");
		expect(
			screen.getByTestId(`positions-group-figures-${M1}`).textContent ?? "",
		).toContain("→");
	});

	it("grid::the-position-cell-carries-the-side-and-NOTHING-else", () => {
		// ⛔ RF-12: no status chip, no Exited/Flipped/Voided/Sold marker, nothing
		// that adds read cost. The side word and its glyph, and that is all.
		render(<PositionsTable payload={OWNER_PAYLOAD} />);
		const positionCell = cellsOf(L1)[0];
		if (positionCell === undefined) {
			throw new Error("grid: the tile rendered no cells");
		}
		expect((positionCell.textContent ?? "").trim()).toBe("Yes");
		expect(
			positionCell.querySelector('[data-testid^="position-status-"]'),
		).toBeNull();
		// ⚠ THE POSITIVE CONTROL for the negative above: the cell IS being read,
		// and it does contain the glyph — so "no status node" is a real absence
		// rather than an empty selector.
		expect(positionCell.querySelector("svg")).not.toBeNull();
	});

	it("grid::SELL-sits-in-its-own-trailing-column-on-a-sellable-tile", () => {
		// ⛔ REVERSED FROM `row6::there-is-no-trailing-action-column`. RF-4 gives
		// Sell the far-right slot, because RF-5 makes it a per-ARGUMENT control and
		// the Position cell no longer has room for a button under one word.
		render(<PositionsTable payload={OWNER_PAYLOAD} />);
		const cells = cellsOf(L1);
		const sellCell = cells[3];
		expect(
			sellCell?.querySelector(`[data-testid="tile-sell-${L1}"]`),
		).not.toBeNull();
	});

	it("grid::the-headers-and-the-value-cell-centre-over-their-columns", () => {
		render(<PositionsTable payload={OWNER_PAYLOAD} />);
		for (const th of screen
			.getByTestId("positions-table")
			.querySelectorAll("thead th")) {
			expect(th.className).toContain("text-center");
		}
		expect(cellsOf(L1)[2]?.className).toContain("text-center");
	});

	it("grid::the-CURRENT-cell-stacks-value-over-delta-over-from", () => {
		// RF-4's three lines, in order. ⚠ ASSERTED AS AN ORDERED LIST OF NODES, not
		// as a flattened string: `textContent` cannot see a column, and the whole
		// point of the cell is that the three figures sit one above another.
		render(<PositionsTable payload={OWNER_PAYLOAD} />);
		const stack = cellsOf(L1)[2]?.firstElementChild;
		expect(stack?.className).toContain("flex-col");
		expect([...(stack?.children ?? [])].map((c) => c.textContent)).toEqual([
			"Đ 31",
			"(+Đ 6)",
			"from Đ 25",
		]);
	});
});

describe("HTML-FINISH profile rows 2 · 7 — the arena panels and their bars", () => {
	const PAYLOAD = { owner: false as const, rows: [ROW_OPEN, ROW_SETTLED] };

	const ARG_POST: ProfileArgumentItem = {
		removed: false,
		kind: "post",
		id: "0190b3a0-9999-7000-8000-00000000000c",
		side: "YES",
		marketSlug: "fixture-alpha",
		marketTitle: "Market fixture-alpha",
		ordinal: 4,
		title: "A profile argument",
		teaser: "Neutral fixture teaser.",
		body: "A profile argument\n\nNeutral fixture body.",
		marker: "none",
		authorStake: "50.000000000000000000",
		// RANK-1 — the substrate stake is SURVIVING basis; nothing is sold in this fixture.
		authorStakeOriginal: "50.000000000000000000",
		authorSold: false,
		priceAtBet: "0.270000000000000000",
		createdAt: "2026-07-01T00:00:00.000Z",
		aggregate: {
			supportCount: 3,
			counterCount: 1,
			supportDharma: "300.000000000000000000",
			counterDharma: "100.000000000000000000",
		},
	};

	it("row2::both-arena-halves-are-bordered-panels-with-a-header-bar", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		cleanup();
		// Rendered separately because each half is its own component; the BAND
		// that puts them side by side is row 1's, guarded above.
		const left = render(<PositionsTable payload={PAYLOAD} />);
		const leftPanel = screen.getByTestId("positions-panel");
		const leftHead = screen.getByTestId("positions-panel-head");
		expect(leftPanel.contains(leftHead)).toBe(true);
		// The bar is the panel's FIRST child — a header bar below the body is not
		// a header bar.
		expect(indexOf(leftHead)).toBe(0);
		// Canon §6 (Profile): "list `Positions`". Ratified copy, not authored.
		expect(leftHead.textContent).toContain("Positions");
		// The border and the bar's rule both ride the shipped hairline token, so
		// the panel reads as a panel rather than as a bare column.
		expect(leftPanel.className).toContain("[border:var(--hairline)]");
		expect(leftHead.className).toContain("[border-bottom:var(--hairline)]");
		left.unmount();

		render(<ArgumentList items={[ARG_POST]} owner={false} author={USER} />);
		const rightPanel = screen.getByTestId("arguments-panel");
		const rightHead = screen.getByTestId("arguments-panel-head");
		expect(rightPanel.contains(rightHead)).toBe(true);
		expect(indexOf(rightHead)).toBe(0);
		// Byte-carried from the shipped tile label (canon §6 verbatim).
		// ⚠⚠ AMENDED AT ROUND 4 — the half of this note that said the mockup's
		// colhead "cannot be used" is SUPERSEDED and is corrected here rather than
		// left to an appendix (O-5). Item 7 makes the header the SELECTED market's
		// question while a positions row is picked; recon A-1's strike stands for
		// what it actually struck — the REPLICA-REPLACES-LIST reading, which would
		// have cost the §23 §3.6 order — and round 4 does not adopt that reading.
		// This render passes no selection, so `Arguments` is still what shows, and
		// that default is asserted here. ⛔ The colhead's LIVE PRICE is still not
		// built (founder-ruled, and a live value).
		expect(rightHead.textContent).toContain("Arguments");
		expect(rightPanel.className).toContain("[border:var(--hairline)]");
	});

	it("row2::the-panel-survives-the-EMPTY-state-on-both-halves", () => {
		// A panel that vanishes when its list is empty is not a panel — and the
		// empty state is exactly when a reader most needs the frame to say WHAT
		// is empty.
		const a = render(<PositionsTable payload={{ owner: false, rows: [] }} />);
		expect(screen.getByTestId("positions-panel")).toBeTruthy();
		expect(screen.getByTestId("positions-empty")).toBeTruthy();
		a.unmount();

		render(<ArgumentList items={[]} owner={false} author={USER} />);
		expect(screen.getByTestId("arguments-panel")).toBeTruthy();
		expect(screen.getByTestId("arguments-empty")).toBeTruthy();
	});

	it("row7::both-filters-live-ON-the-header-bar", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		const head = screen.getByTestId("positions-panel-head");
		expect(
			head.contains(screen.getByTestId("positions-market-filter")),
			`row 7: the market filter is not on the panel header bar.`,
		).toBe(true);
		expect(head.contains(screen.getByTestId("positions-status-filter"))).toBe(
			true,
		);
	});

	it("row7a::the-market-filter-is-a-BUTTON-that-opens-a-popover-list", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		const trigger = screen.getByTestId("positions-market-filter");
		// Not a <select>. The element TYPE is the row.
		expect(trigger.tagName).toBe("BUTTON");
		expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		// ⚠⚠ THE LABEL IS STATE, NOT A PROMPT — POSREV-1 RF-1. It read
		// `Select market ▾` permanently, so after choosing a market the control
		// still asked the reader to choose one and the only way to find out which
		// was selected was to open it. With none chosen it now reads `All markets`
		// — which is also the exact string of the option that produces that state,
		// so the label and the list agree by construction rather than by copy.
		// ⛔ THE CARET IS UNCHANGED and still BYTE-CARRIED — U+25BE, asserted by
		// CODE POINT so a lookalike reddens.
		const label = trigger.textContent ?? "";
		expect(label).toBe("All markets ▾");
		expect(label.codePointAt(label.length - 1)).toBe(0x25be);

		expect(screen.queryByTestId("positions-market-popover")).toBeNull();
		fireEvent.click(trigger);
		const popover = screen.getByTestId("positions-market-popover");
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		// `All markets` + one per distinct market. The inventory is UNCHANGED
		// from the `<select>` this replaced — only the control shape moved.
		expect(popover.querySelectorAll('[role="option"]').length).toBe(3);
		expect(
			popover
				.querySelector('[data-testid="positions-market-option-all"]')
				?.getAttribute("aria-selected"),
		).toBe("true");
	});

	it("row7a::the-label-BECOMES-the-chosen-market (RF-1)", () => {
		// ⛔ THE HALF THAT MAKES IT STATE RATHER THAN A PROMPT, and it is a separate
		// row because "it says All markets at rest" passes on a control whose label
		// never moves at all.
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(screen.getByTestId("positions-market-filter"));
		fireEvent.click(screen.getByTestId(`positions-market-option-${M1}`));
		expect(screen.getByTestId("positions-market-filter").textContent).toBe(
			`${ROW_OPEN.marketTitle} ▾`,
		);
	});

	it("row7a::ESC-closes-the-popover-canon-§5", () => {
		// Canon §5 (Profile) rules the dismissal grammar: "ESC / click-out
		// closes". A popover dismissible only by CHOOSING traps the reader.
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(screen.getByTestId("positions-market-filter"));
		expect(screen.getByTestId("positions-market-popover")).toBeTruthy();
		fireEvent.keyDown(document, { key: "Escape" });
		expect(screen.queryByTestId("positions-market-popover")).toBeNull();
	});

	it("row7a::click-OUT-closes-the-popover-canon-§5", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(screen.getByTestId("positions-market-filter"));
		expect(screen.getByTestId("positions-market-popover")).toBeTruthy();
		fireEvent.pointerDown(document.body);
		expect(screen.queryByTestId("positions-market-popover")).toBeNull();
	});

	it("row7b::the-status-filter-is-a-two-button-SEGMENTED-PAIR", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		const seg = screen.getByTestId("positions-status-filter");
		const buttons = [...seg.querySelectorAll("button")];
		// Two, and only two — item 11 (P5-D17a) removed `All` and this row must
		// not reintroduce it by widening the control.
		expect(buttons.length).toBe(2);
		// ⚠ `Closed` CARRIES A COUNT (RF-7), so its label is the word plus a
		// number. The WORDS are unchanged — RF-13 is explicit that they stay
		// exactly `Open` and `Closed` — so the count is read off its own node and
		// the word is what is compared here.
		expect(buttons.map((b) => b.firstChild?.textContent)).toEqual([
			"Open",
			"Closed",
		]);
		expect(screen.getByTestId("positions-closed-count").textContent).toBe("1");
		// `aria-pressed` carries the selection — the state a `<select>` supplied
		// in `.value` and a hand-rolled pair must declare.
		expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");
		expect(buttons[1]?.getAttribute("aria-pressed")).toBe("false");
	});

	it("row7b::the-segments-still-DRIVE-the-filter-not-just-paint-it", () => {
		// ⚠ NON-VACUITY. Every assertion above is about SHAPE; this one is about
		// behaviour, because a control that looks right and filters nothing is
		// precisely the defect a shape-only guard ships.
		render(<PositionsTable payload={PAYLOAD} />);
		expect(screen.getByTestId(`position-tile-${L1}`)).toBeTruthy();
		expect(screen.queryByTestId(`position-tile-${L2}`)).toBeNull();
		fireEvent.click(screen.getByTestId("positions-status-closed"));
		expect(screen.getByTestId(`position-tile-${L2}`)).toBeTruthy();
		expect(screen.queryByTestId(`position-tile-${L1}`)).toBeNull();
	});

	it("row7a::the-popover-still-DRIVES-the-market-filter", () => {
		render(<PositionsTable payload={PAYLOAD} />);
		fireEvent.click(screen.getByTestId("positions-market-filter"));
		fireEvent.click(screen.getByTestId(`positions-market-option-${M2}`));
		// M2 is Closed and the status filter is Open, so choosing it empties the
		// table — the filter-scoped empty, not the "you hold nothing" one.
		expect(screen.getByTestId("positions-empty-tab")).toBeTruthy();
		// …and choosing closes the popover.
		expect(screen.queryByTestId("positions-market-popover")).toBeNull();
	});
});

describe("POSREV-1 RF-3 — the market question moved to the GROUP HEADER", () => {
	/**
	 * ⚠⚠ THIS BLOCK REPLACES HTML-FINISH row 10 + row 13, AND IT IS AN INVERSION
	 * RATHER THAN A DELETION. Those rows asserted the market question sits in the
	 * ARGUMENT cell as a sub-line under the title, and that it links to the market
	 * as a SIBLING of the title link. Both were right for a table whose unit was
	 * the market. RF-3 changes the unit to the ARGUMENT and groups tiles under a
	 * market header — at which point the sub-line prints the same question once
	 * per argument held in that market, which is the duplication the whole revamp
	 * exists to remove.
	 *
	 * ⇒ Every property those rows protected is preserved ON THE HEADER: the
	 * question renders, it links to the market (not to a thread), and it survives
	 * a REMOVED argument — which was row 13's sharpest case, because the market
	 * has to stay reachable exactly when its argument cannot be read.
	 */
	const VISITOR_PAYLOAD = {
		owner: false as const,
		rows: [ROW_OPEN, ROW_SETTLED],
	};

	it("rf3::the-question-is-NOT-in-the-argument-cell-any-more", () => {
		render(<PositionsTable payload={VISITOR_PAYLOAD} />);
		const argCell = cellsOf(L1)[1];
		expect(argCell?.textContent ?? "").not.toContain(ROW_OPEN.marketTitle);
	});

	it("rf3::it-is-on-the-group-header-exactly-ONCE-per-market", () => {
		// ⚠ THE COUNT IS THE ASSERTION. Two arguments in one market must produce
		// ONE question on screen — "it renders" would pass on the very duplication
		// this row removes.
		const twoArgs = {
			owner: false as const,
			rows: [
				{
					...ROW_OPEN,
					lots: [
						LOT(L1, "YES", true, OPENER_CELL),
						LOT(L3, "YES", true, OPENER_CELL_2),
					],
					quantity: "20.000000000000000000",
				},
			],
		};
		const { container } = render(<PositionsTable payload={twoArgs} />);
		expect(screen.getAllByTestId(`position-tile-${L1}`).length).toBe(1);
		expect(screen.getByTestId(`position-tile-${L3}`)).toBeTruthy();
		const occurrences =
			(container.textContent ?? "").split(ROW_OPEN.marketTitle).length - 1;
		expect(occurrences).toBe(1);
	});

	it("rf3::the-header-question-links-to-the-MARKET-not-to-a-thread", () => {
		// Canon §7 item 6: "market title → overview". ⛔ NOT `?post=` — that is a
		// thread deep link and is the ARGUMENT title's target, which is the
		// distinction row 13 minted and this preserves.
		render(<PositionsTable payload={VISITOR_PAYLOAD} />);
		const link = screen.getByTestId(`positions-group-title-${M1}`);
		expect(link.tagName).toBe("A");
		expect(link.getAttribute("href")).toBe(`/m/${ROW_OPEN.marketSlug}`);
		expect(link.getAttribute("href")).not.toContain("?post=");
	});

	it("rf3::the-market-stays-reachable-on-a-REMOVED-argument", () => {
		// ⚠⚠ ROW 13'S SHARPEST CASE, KEPT. `marketTitle` is market METADATA, not
		// user argument text, so no masking obligation attaches (SC-1 governs
		// `comments.body` and its derivations). Suppressing it on a removed
		// argument would drop the market question from exactly the tiles whose
		// argument the reader cannot see — where the context matters most.
		render(<PositionsTable payload={VISITOR_PAYLOAD} />);
		fireEvent.click(screen.getByTestId("positions-status-closed"));
		expect(screen.getByTestId(`tile-arg-removed-${L2}`)).toBeTruthy();
		const link = screen.getByTestId(`positions-group-title-${M2}`);
		expect(link.getAttribute("href")).toBe(`/m/${ROW_SETTLED.marketSlug}`);
	});
});

describe("HTML-FINISH profile row 16 — the band-height square, BUILT at `xl`+", () => {
	/**
	 * ⚠⚠⚠ PROFILE-FULL — THIS BLOCK IS INVERTED, AND ITS OWN PREDECESSOR ASKED FOR
	 * THAT. The version that stood here asserted the REFUSAL — that the PFP kept a
	 * fixed 56px box — and closed with: "When the height chain lands, DELETE this
	 * block and build the row — that is the intended end state, not this one." The
	 * band is now the mockup's 188 and the row is built, so these assertions follow
	 * the ruling instead of the refusal. ⛔ This is not a guard relaxed to fit the
	 * code: it is the SAME property (where a percentage height may resolve) pinned
	 * on the other side of a founder ruling, and the unprefixed forms it forbade
	 * are still forbidden below.
	 *
	 * WHY FIVE ROUNDS COULD NOT, AND WHAT ACTUALLY CHANGED. Rounds 1–4 refused
	 * because the band had no declared height, so `height:100%` fed a loop — taller
	 * card → wider square → narrower column → taller tiles → taller card — which
	 * settled at PFP 324×578 with the tile grid clipped to zero width. Round 5
	 * declared the band at 256 and refused again, on WIDTH: a square filling 256 is
	 * 224 wide, the 1024 half is 476, so the tiles got 204, wrapped to five label
	 * lines, and the card needed 303 against a 256 box. Both refusals were measured
	 * and both were correct at the time.
	 *
	 * ⇒ AND THE UNBLOCK WAS NOT A TYPE SIZE EITHER. The identity block shipped as a
	 * `<Card>` with `p-4`; the mockup's `.idcard` is a BARE flex row with no border,
	 * background or padding (`:190`). Removing the frame returns 32px and the
	 * mockup's tile density returns the rest. MEASURED live against real compiled
	 * CSS at a viewport pinned to 1440×777 by a fixed-size same-origin iframe, on
	 * the shipped surface with real data:
	 *
	 *   vw     idcol needs (with square)   box   overflow   square applied?
	 *   1024            231                188      +22     NO  ← this is why `xl:`
	 *   1280            189                188       +1     yes
	 *   1440            174                188        0     yes
	 *   1920            153                188        0     yes
	 *
	 * ⛔ SO THE SCOPE IS THE MEASUREMENT, NOT A PREFERENCE. Below `xl` the avatar
	 * keeps its shipped 56px box — at 1024 the square costs the tile column the
	 * 132px the small avatar left it, the labels wrap to four lines, and the +22
	 * would collide with the arena. Below `lg` the band declares no height at all,
	 * so an unprefixed form would re-enter the round-1 loop outright.
	 * ⛔ `xl` IS STOCK TAILWIND, NOT AN INVENTED BREAKPOINT. The round-5 route-back
	 * named it as the legitimate option and rejected it only because it "misses by
	 * 21px" — against the 256px band. Against 188 it misses by the 1px sub-pixel
	 * rounding floor. `min-[1312px]:` remains forbidden and is not used.
	 *
	 * ⚠ THE REMAINING COST IS NAMED, NOT HIDDEN: between `lg` and `xl` the avatar
	 * is 56×56 against the mockup's 188×188. That is the last open piece of D-1.
	 */
	it("row16::the-square-is-declared-and-is-xl-SCOPED", () => {
		render(<IdentityCard user={USER} owner={false} tiles={TILES} />);
		const pfp = screen.getByTestId("identity-card").querySelector("img");
		if (pfp === null) {
			throw new Error("row16: the identity card renders no <img>");
		}
		const classes = pfp.className.split(/\s+/);
		// The square itself, at `xl`+ — the three utilities that together make
		// `.pfp`'s `height:100%; aspect-ratio:1/1; flex:0 0 auto` (`:191-193`).
		for (const c of ["xl:h-full", "xl:w-auto", "xl:aspect-square"]) {
			expect(
				classes,
				`row 16: the band-height square needs \`${c}\`. The band is declared at ` +
					`188 and its ROW TRACK with it, so a percentage height here resolves ` +
					`against a definite box instead of feeding the round-1 loop.`,
			).toContain(c);
		}
		// …and the FALLBACK box below `xl`, which is what keeps 1024–1279 from
		// overflowing the band by +22.
		expect(classes).toContain("h-14");
		expect(classes).toContain("w-14");
		// ⛔ NEVER UNPREFIXED — the half of the old refusal that survives verbatim.
		// An unprefixed `h-full`/`aspect-square` applies below `lg` too, where the
		// band has NO declared height; that is exactly the measured defect of
		// rounds 1–4.
		for (const c of ["h-full", "w-auto", "aspect-square", "min-h-14"]) {
			expect(
				classes,
				`row 16: \`${c}\` is UNPREFIXED. Below \`lg\` the band declares no ` +
					`height, so it resolves against a content-driven block and re-enters ` +
					`the feedback loop measured at PFP 324×578 with the tile grid ` +
					`clipped to zero width.`,
			).not.toContain(c);
		}
		// ⛔ `size-14` IS GONE DELIBERATELY, not incidentally: it sets width AND
		// height in ONE utility, so pairing it with `xl:h-full xl:w-auto` would leave
		// two same-property overrides to emission order. `h-14 w-14` states both.
		expect(classes).not.toContain("size-14");
	});

	it("row16::the-BAND-precondition-this-row-waited-for-is-now-MET", () => {
		// ⚠ THE HALF THAT DID CHANGE, PINNED SO THE NEXT READER DOES NOT RE-REFUSE
		// ON THE OLD GROUND. Four rounds recorded "this becomes correct once the
		// headzone has a height of its own". It now has one. Anyone retrying item
		// C must start from the WIDTH measurement above, not from the band.
		const page = readFileSync(
			join(process.cwd(), "src/app/(public)/u/[pseudonym]/page.tsx"),
			"utf8",
		);
		const cls =
			/"profile-headzone"[\s\S]{0,160}?className="([^"]*)"/.exec(page)?.[1] ??
			"";
		expect(cls.split(/\s+/)).toContain("lg:h-[188px]");
	});

	it("row16::the-intrinsic-ratio-hint-attributes-survive", () => {
		// The pre-load ratio hint that keeps the identity band from shifting.
		render(<IdentityCard user={USER} owner={false} tiles={TILES} />);
		const pfp = screen.getByTestId("identity-card").querySelector("img");
		expect(pfp?.getAttribute("width")).toBe("56");
		expect(pfp?.getAttribute("height")).toBe("56");
	});

	it("row16::POSITIVE-CONTROL-the-unprefixed-check-still-detects-the-measured-defect", () => {
		// ⚠ PROOF BY REVERSAL, and it is the part of this block that did NOT change
		// when the row was built. The class string below is the REAL one measured at
		// PFP 324×578 with the tile column at zero width; the unprefixed check must
		// be false against it, or it asserts nothing.
		const measuredDefect =
			"aspect-square h-full min-h-14 w-auto shrink-0 rounded-[var(--imgr)] bg-n1 object-cover".split(
				/\s+/,
			);
		const unprefixed = ["h-full", "aspect-square", "w-auto", "min-h-14"];
		expect(unprefixed.every((c) => measuredDefect.includes(c))).toBe(true);
		// …and the SHIPPED list does not trip it, so the check discriminates. This
		// is the discriminating case that matters now: the shipped list contains
		// `xl:h-full` and `xl:aspect-square`, and the guard must NOT read those as
		// the unprefixed forms — a substring test would, an exact class-token test
		// does not.
		const shipped =
			"h-14 w-14 shrink-0 rounded-[var(--imgr)] bg-n1 object-cover xl:aspect-square xl:h-full xl:w-auto".split(
				/\s+/,
			);
		expect(unprefixed.some((c) => shipped.includes(c))).toBe(false);
		// …while the `xl:` forms ARE present in it, so the two halves of the guard
		// above cannot both be vacuous.
		for (const c of ["xl:h-full", "xl:w-auto", "xl:aspect-square"]) {
			expect(shipped).toContain(c);
		}
		expect(shipped).not.toContain("size-14");
	});
});

describe("HTML-FINISH profile rows 1 · 8 — the two-band frame", () => {
	const ROOT = process.cwd();
	const PAGE = "src/app/(public)/u/[pseudonym]/page.tsx";
	const page = () => readFileSync(join(ROOT, PAGE), "utf8");

	/**
	 * ⚠ A SOURCE SCAN, AND THE LIMIT IS STATED. The page is an ASYNC RSC that
	 * awaits `resolveProfileUser`, `auth.api.getSession` and four read models,
	 * so it cannot be rendered under jsdom without mocking the whole server
	 * layer — and a render whose every input is mocked proves the mock's shape,
	 * not the page's. `discovery-height-chain.test.ts` reads its two shipped
	 * files the same way for the same reason. What the scan CANNOT see is
	 * resolved geometry; that is measured in a browser (§7).
	 */
	it("row1::the-page-composes-TWO-BANDS-not-five-stacked-siblings", () => {
		const src = page();
		expect(src).toContain('data-testid="profile-headzone"');
		expect(src).toContain('data-testid="profile-arena"');
		// Each band is a two-column grid above the `md` breakpoint. Canon §2:
		// "Two bands. Top: identity card … + the graph slot. Bottom 'arena':
		// Positions table … + the argument [list]".
		const headzone = /profile-headzone"\s+className="([^"]*)"/.exec(src)?.[1];
		const arena = /profile-arena"\s+className="([^"]*)"/.exec(src)?.[1];
		for (const [name, cls] of [
			["headzone", headzone],
			["arena", arena],
		] as const) {
			if (cls === undefined) {
				throw new Error(`row1: the ${name} band has no literal className`);
			}
			expect(cls.split(/\s+/), `row 1: ${name} is not a grid`).toContain(
				"grid",
			);
			// ⚠ `lg`, NOT `md` — RULED FROM MEASUREMENT. The arena is two columns
			// only where each half clears the positions table's fixed track
			// (measured 214px) PLUS the Argument column's min-content (115px). At
			// `md` each half measured 356px and Argument rendered at 117px against
			// that 115px min-content — pinned, which is the eight-character
			// symptom. `lg` gives it ~244px. The BREAKPOINT is pinned and `md` is
			// pinned ABSENT, so "make it responsive sooner" reddens instead of
			// quietly re-shipping the cramped column.
			//
			// ⚠ MATCHED BY PREFIX, NOT BY WHOLE TOKEN, because the two bands
			// legitimately carry DIFFERENT templates: founder eye-pass item 3 gave
			// the headzone `lg:grid-cols-[3fr_2fr]` (the graph column shrunk so its
			// 2:1 aspect stops driving the band height) while the arena keeps
			// `lg:grid-cols-2` (equal halves). What must hold across both is the
			// BREAKPOINT; the TEMPLATE is each band's own business.
			expect(
				cls.split(/\s+/).some((c) => /^lg:grid-cols-/.test(c)),
				`row 1: ${name} must go two-column at \`lg\`, not sooner — at \`md\` ` +
					`the Argument column is pinned at its 115px min-content.`,
			).toBe(true);
			expect(
				cls.split(/\s+/).some((c) => /^md:grid-cols-/.test(c)),
				`row 1: ${name} still carries an \`md:\` grid template.`,
			).toBe(false);
		}
	});

	it("row1::both-bands-share-ONE-breakpoint", () => {
		// If the headzone went two-column while the arena below it was still
		// stacked, the page would read as three bands, not two. Asserted as an
		// EQUALITY between the two rather than as two independent pins, so
		// changing one and forgetting the other reddens.
		const src = page();
		// ⚠ THE BREAKPOINT PREFIX ONLY. The two bands carry different templates
		// after item 3 (`[3fr_2fr]` vs `2`), so comparing whole tokens would
		// redden on a difference that is deliberate and correct. The invariant
		// this guard exists for — both bands turn two-column at the SAME width —
		// is exactly the prefix.
		const bp = (testid: string) => {
			const cls = new RegExp(
				`"${testid}"[\\s\\S]{0,120}?className="([^"]*)"`,
			).exec(src)?.[1];
			const token = (cls ?? "")
				.split(/\s+/)
				.find((x) => /^[a-z]+:grid-cols-/.test(x));
			return token ? (token.split(":")[0] ?? null) : null;
		};
		expect(bp("profile-headzone")).not.toBeNull();
		expect(bp("profile-headzone")).toBe(bp("profile-arena"));
	});

	it("row1::the-five-siblings-are-GONE-from-the-container", () => {
		// The pre-change page mounted IdentityCard · ProfileTiles · ProfileGraph ·
		// PositionsTable · ArgumentList as five direct children of one container.
		// Two of those mounts must no longer exist at all: `ProfileTiles` moved
		// INSIDE IdentityCard (row 8), so the page must not import or mount it.
		const src = page();
		expect(
			src,
			`row 8: the page still mounts <ProfileTiles> directly — the tiles were ` +
				`COPIED into the identity card rather than MOVED.`,
		).not.toContain("<ProfileTiles");
		expect(src).not.toContain('from "@/components/profile/ProfileTiles"');
	});

	it("row8::the-tile-band-renders-INSIDE-the-identity-card", () => {
		render(<IdentityCard user={USER} owner={false} tiles={TILES} />);
		const card = screen.getByTestId("identity-card");
		const tiles = screen.getByTestId("profile-tiles");
		expect(
			card.contains(tiles),
			`row 8: the tiles are not inside the identity card.`,
		).toBe(true);
		// …and specifically UNDER the pseudonym row, in the identity COLUMN — the
		// mockup's `.idcol` is `[.unamerow][.tiles]` (`:437`), so the tiles are a
		// SIBLING of the name block, not a child of it and not a sibling of the
		// PFP.
		const pseudonym = screen.getByTestId("identity-pseudonym");
		const nameBlock = tiles.previousElementSibling;
		expect(nameBlock).not.toBeNull();
		expect(nameBlock?.contains(pseudonym)).toBe(true);
	});

	it("row8::the-PFP-is-not-a-sibling-of-the-tiles", () => {
		// The PFP stays the identity BAND's first child; the column beside it
		// holds the name block and the tiles. If the tiles landed beside the PFP
		// the band would be three columns, not two.
		render(<IdentityCard user={USER} owner={false} tiles={TILES} />);
		const card = screen.getByTestId("identity-card");
		const img = card.querySelector("img");
		const tiles = screen.getByTestId("profile-tiles");
		expect(img?.parentElement).toBe(card);
		expect(tiles.parentElement).not.toBe(card);
	});
});

describe("HTML-FINISH profile row 18 — the two tile rows share one height", () => {
	it("row18::grid-declares-equal-implicit-rows", () => {
		render(<ProfileTiles tiles={TILES} />);
		const grid = screen.getByTestId("profile-tiles");
		// The mockup's `grid-auto-rows:1fr` (`:204`). A RULE, not a number — the
		// class is pinned by name because that is the whole declaration.
		expect(
			grid.className.split(/\s+/),
			`row 18: the tile grid must declare \`auto-rows-fr\` so both rows share ` +
				`one height. Without it each row sizes to its own tallest tile.`,
		).toContain("auto-rows-fr");
	});
});

describe("HTML-FINISH profile row 19 — the Arguments breakdown is its own element", () => {
	it("row19::breakdown-is-a-nested-element-inside-the-value-node", () => {
		render(<ProfileTiles tiles={TILES} />);
		const value = screen.getByTestId("tile-arguments-value");
		const breakdown = screen.getByTestId("tile-arguments-breakdown");
		// O-7: the seam is only visible in the MARKUP. `textContent` on the value
		// node is byte-identical before and after this row, by design.
		expect(value.innerHTML).toContain("tile-arguments-breakdown");
		expect(breakdown.parentElement).toBe(value);
		expect(indexOf(breakdown)).toBeGreaterThanOrEqual(0);
	});

	it("row19::the-SPEC-pinned-string-is-unchanged-by-the-nesting", () => {
		// SPEC.1 §23 pins `N (P Posts | R Replies)`. The nesting must add markup
		// and NOTHING else — this is the clause that makes row 19 shippable
		// without a spec amendment.
		render(<ProfileTiles tiles={TILES} />);
		expect(screen.getByTestId("tile-arguments-value").textContent).toBe(
			"5 (3 Posts | 2 Replies)",
		);
	});

	it("row19::POSITIVE-CONTROL-a-flat-string-fails-the-nesting-check", () => {
		// The pre-change build rendered one flat string. Same predicate, and it
		// must be false — otherwise the guard above is asserting nothing.
		const { container } = render(
			<span data-testid="control-flat">5 (3 Posts | 2 Replies)</span>,
		);
		const flat = container.querySelector('[data-testid="control-flat"]');
		if (flat === null) {
			throw new Error("row19 control: fixture did not render");
		}
		expect(flat.innerHTML).not.toContain("tile-arguments-breakdown");
		// ⚠ AND the textContent read — the assertion a careless guard would have
		// used — passes on the flat form. That is the point of O-7, demonstrated.
		expect(flat.textContent).toBe("5 (3 Posts | 2 Replies)");
	});
});

describe("POSREV-1 item D — Đ on the positions table's value figures", () => {
	/**
	 * ⚠⚠ THIS BLOCK REPLACES ROUND 5 ITEM D, AND THE LAW IT PROTECTS IS INTACT.
	 * Item D closed a real defect: the two value cells printed bare digits beside
	 * five tiles and four argument-head figures that all carried Đ, so the one
	 * place on the surface where two Đ quantities sat side by side was the one
	 * place that did not say so.
	 *
	 * What moved is WHERE those two quantities live. RF-4 deletes the `Staked`
	 * column — Đa belongs to the MARKET, so it went to the group header — and the
	 * arrow track went with it, because one value column has no relation to state.
	 * So item D's "both value CELLS" becomes "both value FIGURES": one on the
	 * header, one on the tile. ⛔ The all-of-them-or-none discipline is kept in one
	 * test rather than split, for the reason item D gave: a pair of separate tests
	 * can go half-green and read as "mostly passing".
	 */
	const VISITOR_PAYLOAD = { owner: false as const, rows: [ROW_OPEN] };

	it("itemD::BOTH-value-figures-carry-the-glyph", () => {
		render(<PositionsTable payload={VISITOR_PAYLOAD} />);
		const header = screen.getByTestId(`positions-group-figures-${M1}`);
		const current = cellsOf(L1)[2];
		for (const [name, node] of [
			["group header", header],
			["tile Current", current],
		] as const) {
			const t = (node?.textContent ?? "").trim();
			expect(
				t.codePointAt(0),
				`item D: the ${name} figure must start with Đ (U+0110). Got "${t}".`,
			).toBe(0x110);
		}
	});

	it("itemD::the-rendered-strings-are-exactly-the-expected-shape", () => {
		// The header states the market's move; the tile states this argument's.
		// ⚠ NO SPACE BEFORE THE `(` — the gap there is the wrapper's flex `gap`,
		// not a text node, so `textContent` has never carried one (POSREV-1 S2
		// established this after encoding it wrongly once).
		render(<PositionsTable payload={VISITOR_PAYLOAD} />);
		expect(
			(
				screen.getByTestId(`positions-group-figures-${M1}`).textContent ?? ""
			).trim(),
		).toBe("Đ 25 → Đ 31");
		expect((cellsOf(L1)[2]?.textContent ?? "").trim()).toBe(
			"Đ 31(+Đ 6)from Đ 25",
		);
	});

	it("itemD::the-ARROW-survives-on-the-HEADER-where-it-still-relates-two-figures", () => {
		// ⛔ IT IS GONE FROM THE TILE and that is the point: a relation glyph
		// between one value and nothing states nothing. Asserting its presence on
		// the header AND its absence from the tile is what distinguishes "moved"
		// from "deleted", which are different outcomes with the same green.
		// The glyph is BYTE-CARRIED — U+2192, asserted by code point.
		render(<PositionsTable payload={VISITOR_PAYLOAD} />);
		const header =
			screen.getByTestId(`positions-group-figures-${M1}`).textContent ?? "";
		expect(header).toContain("→");
		expect(header.codePointAt(header.indexOf("→"))).toBe(0x2192);
		for (const cell of cellsOf(L1)) {
			expect(cell.textContent ?? "").not.toContain("→");
		}
	});

	it("itemD::formatDharma-still-wraps-the-value-so-DROUND-holds", () => {
		// The glyph is a sibling TEXT NODE, not a change to the formatter, so
		// `no-raw-dharma-render` sees the same wrapped call. Proven by the GROUPING
		// surviving: a bare `{row.staked}` would print the raw NUMERIC(38,18).
		render(
			<PositionsTable
				payload={{
					owner: false,
					rows: [
						{
							...ROW_OPEN,
							staked: "14260.000000000000000000",
							current: "3225.500000000000000000",
						},
					],
				}}
			/>,
		);
		expect(
			(
				screen.getByTestId(`positions-group-figures-${M1}`).textContent ?? ""
			).trim(),
		).toBe("Đ 14,260 → Đ 3,226");
		// ⛔ THE MINUS IS U+2212, not an ASCII hyphen — byte-carried by the
		// formatter. The tile's own delta is against its SURVIVING basis (25), not
		// against the market's Đa, which is the RF-4 distinction.
		expect((cellsOf(L1)[2]?.textContent ?? "").trim()).toBe(
			"Đ 3,226(+Đ 3,201)from Đ 25",
		);
	});

	it("itemD::POSITIVE-CONTROL-the-check-reddens-on-the-pre-change-form", () => {
		// ⚠ PROOF BY REVERSAL. The bare form is what shipped through round 4, and
		// the assertion above must reject it — otherwise this guard cannot fail.
		const { container } = render(<span data-testid="control-bare">25</span>);
		const bare = container.querySelector('[data-testid="control-bare"]');
		expect((bare?.textContent ?? "").codePointAt(0)).not.toBe(0x110);
	});
});
