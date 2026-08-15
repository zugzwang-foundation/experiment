// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HERO_SIDE_EMPTY, HeroPanels } from "@/components/discovery/HeroPanels";
import type { HeroPost, HeroTopPosts } from "@/server/discovery/hero";
import type { DiscoveryCard } from "@/server/discovery/list";
import type { PricePoint } from "@/server/discovery/price-series";

import {
	EXTENDED,
	MARKET_ID,
	SLUG,
	TITLE,
} from "../../composer/render/_harness";

/**
 * UI.A4 Slice 4 (plan §2 row 4 / §4) — the design-language §3.2 hero: three
 * panels in DOM order `top-YES post | market | top-NO post`. The market panel
 * is the card composition at hero size; a post panel deep-links its title +
 * teaser to `/m/[slug]?post=N` (the built A2 deep-link, OQ-4 A) while the
 * author pseudonym links to its profile (`/u/[pseudonym]`, activated at UI.A5
 * — the A4 follow-up #2; a SIBLING of the card-body deep-link). A null side
 * renders the OQ-6 empty copy VERBATIM via the exported `HERO_SIDE_EMPTY`
 * const (imported here, never re-typed) — identical whatever the reason the
 * side is empty, so it can never hint hidden content exists. Fixture prose
 * reuses the shipped composer-harness strings + the server-suite scaffold
 * labels — never invented market content (CLAUDE.md §3).
 */

afterEach(cleanup);

const MARKET_TITLE = "Discovery Market";

const SERIES: PricePoint[] = [
	{ at: "2026-07-01T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-07-01T00:01:00.000Z", yes: "0.700000000000000000" },
	{ at: "2026-07-01T00:02:00.000Z", yes: "0.400000000000000000" },
];

const CARD: DiscoveryCard = {
	id: MARKET_ID,
	slug: SLUG,
	title: MARKET_TITLE,
	pricing: { yes: "0.380000000000000000", no: "0.620000000000000000" },
	totals: {
		dharmaStaked: "14260.000000000000000000",
		postCount: 28,
		replyCount: 68,
	},
	imageUrl: "https://signed.test/market-media/m/x/card.webp",
};

function heroPost(side: HeroPost["side"]): HeroPost {
	return {
		id:
			side === "YES"
				? "0190b3a0-9999-7000-8000-00000000000a"
				: "0190b3a0-9999-7000-8000-00000000000b",
		ordinal: side === "YES" ? 3 : 1,
		side,
		title: TITLE,
		teaser: EXTENDED,
		author: {
			pseudonym: side === "YES" ? "hero-yes-author" : "hero-no-author",
			pfpUrl: "/pfp-placeholder.svg",
		},
		authorStake: "40.000000000000000000",
		// DISTINCT per side, deliberately. `price_at_bet` is already the price of
		// the side BOUGHT (bets/place.ts:162 -> cpmm/calculate.ts:97), so a shared
		// value would make the NO expectation purely a function of whatever
		// transform the component applies — which is precisely how a complement
		// bug hides. The d5 fixtures use the same shape: a YES post at 27, a NO
		// post at 55 (surface_d5_v1_0.html:1496, :1512).
		entryPrice:
			side === "YES" ? "0.270000000000000000" : "0.550000000000000000",
		replyCount: 24,
		replyDharma: "10000.000000000000000000",
		supportDharma: "3800.000000000000000000",
		counterDharma: "6200.000000000000000000",
		imageUrl: null,
		currentValue: null,
		createdAt: "2026-07-01T00:00:00.000Z",
	};
}

function renderHero(topPosts: HeroTopPosts) {
	return render(<HeroPanels card={CARD} series={SERIES} topPosts={topPosts} />);
}

/** DOM-order assertion: `a` precedes `b` in the rendered tree. */
function precedes(a: Element, b: Element): boolean {
	return (
		(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
	);
}

describe("UI.A4 §4 — HeroPanels (top-YES | market | top-NO)", () => {
	it("render::three-panels-in-order", () => {
		const { container } = renderHero({
			yes: heroPost("YES"),
			no: heroPost("NO"),
		});
		expect(screen.getByTestId("hero-panels")).toBeTruthy();
		// Two post panels, YES first, NO last (document order).
		const posts = screen.getAllByTestId("hero-post");
		expect(posts).toHaveLength(2);
		const [yesPanel, noPanel] = posts;
		expect(yesPanel.getAttribute("data-side")).toBe("YES");
		expect(noPanel.getAttribute("data-side")).toBe("NO");
		// The market panel sits BETWEEN them (§3.2 hero order).
		const sparkline = screen.getByTestId("price-sparkline");
		expect(sparkline.getAttribute("data-size")).toBe("hero");
		expect(precedes(yesPanel, sparkline)).toBe(true);
		expect(precedes(sparkline, noPanel)).toBe(true);
		// Market panel carries question + stat line + the reused PriceBar.
		expect(screen.getByText(MARKET_TITLE).textContent).toBe(MARKET_TITLE);
		const statText = screen.getByTestId("stat-line").textContent ?? "";
		// The SAME shared `StatLine` the card renders, so it GROUPS here too:
		// every Đ value rendered to a user groups its integer part in threes with
		// a literal ASCII comma (SPEC.1 §10.8, 1.0.29 — the same-commit rider).
		// The pre-ruling `Đ 14260` this line used to pin was a docket, not a
		// baseline: discovery staked totals rendered ungrouped beside composers
		// that grouped. Inverted with market-card.test.tsx:65 (ruling R-K).
		expect(statText).toContain("Đ 14,260 staked");
		expect(screen.getByRole("img", { name: "YES 38%, NO 62%" })).toBeTruthy();

		// HTML-FINISH row 2 — THE WHOLE MARKET PANEL IS THE LINK. The mockup
		// binds its handler to `.mktpanel` itself (`:399-401`) and marks the whole
		// panel `cursor:pointer` (`:395`). Asserted as containment, not as a
		// title anchor: the panel's OWN element is the `<a>`, so the thumb, the
		// heading, the stat line, the graph and the bar are all inside it.
		const marketLink = container.querySelector(`a[href="/m/${SLUG}"]`);
		if (!marketLink) {
			throw new Error("expected the hero market panel to be a link");
		}
		expect(marketLink.contains(screen.getByText(MARKET_TITLE))).toBe(true);
		expect(marketLink.contains(sparkline)).toBe(true);
		expect(marketLink.contains(screen.getByTestId("stat-line"))).toBe(true);
		// It is the market link, never a post deep-link.
		expect(marketLink.getAttribute("href")).not.toContain("?post=");
		// …and it does NOT swallow the post panels: anchors cannot nest, and a
		// panel wrapped around the wrong subtree would show up here.
		expect(marketLink.contains(yesPanel)).toBe(false);
		expect(marketLink.contains(noPanel)).toBe(false);
	});

	it("render::html-finish-post-head-separators-and-quoted-argument", () => {
		// HTML-FINISH rows 6 and 7, pinned at BOTH poles — a YES-only assertion
		// passes against a NO panel that never received the change.
		const { container } = renderHero({
			yes: heroPost("YES"),
			no: heroPost("NO"),
		});

		for (const side of ["YES", "NO"] as const) {
			const panel = container.querySelector(
				`[data-testid="hero-post"][data-side="${side}"]`,
			);
			if (!panel) {
				throw new Error(`expected the ${side} hero post panel`);
			}

			// Row 6 — TWO separators per panel (mockup markup `:187`, `:189`),
			// between the author name and the side chip, and between the chip and
			// the stake figure. The head row is the panel's first child.
			const head = panel.children[0];
			const kids = Array.from(head.children);
			const seps = kids.filter((el) => el.textContent === "|");
			expect(seps).toHaveLength(2);
			// Sibling ORDER is the point, so assert positions rather than a count
			// alone: avatar · author · SEP · chip · SEP · stake.
			const authorLink = head.querySelector(
				`[data-testid="hero-author-link-${side}"]`,
			);
			if (!authorLink) {
				throw new Error(`expected the ${side} author link`);
			}
			expect(kids.indexOf(seps[0])).toBe(kids.indexOf(authorLink) + 1);
			expect(kids.indexOf(seps[1])).toBe(kids.indexOf(seps[0]) + 2);
			// The glyph is the BYTE the mockup carries — U+007C, not U+2502 and
			// not any box-drawing look-alike.
			for (const sep of seps) {
				expect(sep.textContent).toBe("|");
			}

			// Row 7 — the ARGUMENT TEXT is wrapped in the mockup's own straight
			// ASCII quotes (U+0022, byte-carried from `:192`; the mockup's JS at
			// `:455` builds the same pair).
			const teaser = panel.querySelector("p");
			if (!teaser) {
				throw new Error(`expected the ${side} teaser paragraph`);
			}
			expect(teaser.textContent).toBe(`"${EXTENDED}"`);

			// ⛔ AND THE HEADLINE IS NOT WRAPPED — row 3 is STRUCK, so the title
			// keeps its shipped, unquoted form. This is the assertion that would
			// catch row 7 being over-applied to the headline as well.
			const headline = panel.querySelector("h3");
			expect(headline?.textContent).toBe(TITLE);
			expect(headline?.textContent?.startsWith('"')).toBe(false);
		}
	});

	it("render::hero-post-deep-links-to-ordinal", () => {
		const { container } = renderHero({ yes: heroPost("YES"), no: null });
		// The A2 deep-link (OQ-4 A): /m/[slug]?post=N, N = the substrate ordinal.
		const link = container.querySelector(`a[href="/m/${SLUG}?post=3"]`);
		if (!link) {
			throw new Error("expected the hero-post deep-link anchor");
		}
		// Title + teaser render inside the deep-link.
		expect(link.textContent).toContain(TITLE);
		expect(link.textContent).toContain(EXTENDED);
		// The author's stake, Đ-formatted via the reused formatDharma.
		const post = screen.getByTestId("hero-post");
		expect(post.textContent ?? "").toContain("Đ 40");
	});

	it("render::whole-panel-is-the-post-click-target", () => {
		// POLISH.2 V18 — the mockup's handler is bound to the WHOLE
		// `.argbody[data-post]`, excluding `.pseud`
		// (surface_discovery_v1_0.html:402-407). The build reaches that with a
		// stretched link rather than by wrapping the panel, because the author
		// link must stay a separate target and anchors cannot nest.
		//
		// Both halves are asserted. Without the `after:inset-0` half the click
		// target silently shrinks back to the title+teaser box and NOTHING else
		// on disk would notice; without `relative` on the panel the ::after
		// escapes to the nearest positioned ancestor and covers the wrong box.
		const { container } = renderHero({ yes: heroPost("YES"), no: null });

		const panel = screen.getByTestId("hero-post");
		expect(panel.className).toContain("relative");

		const link = container.querySelector(`a[href="/m/${SLUG}?post=3"]`);
		expect(link?.className ?? "").toContain("after:absolute");
		expect(link?.className ?? "").toContain("after:inset-0");

		// The author link sits ABOVE that overlay, or it becomes unclickable.
		const authorLink = screen.getByTestId("hero-author-link-YES");
		expect(authorLink.className).toContain("relative");
		expect(authorLink.className).toContain("z-10");
	});

	it("render::author-links-to-own-profile", () => {
		// UI.A5 A4-follow-up #2: the author pseudonym now links to its profile
		// (`/u/[pseudonym]`) — a SIBLING of the card-body deep-link, not the same
		// anchor (supersedes the OQ-4-A "plain text in v1" behaviour).
		renderHero({ yes: heroPost("YES"), no: null });
		const pseudonym = screen.getByText(/hero-yes-author/);
		const authorLink = pseudonym.closest("a");
		expect(authorLink).not.toBeNull();
		expect(authorLink?.getAttribute("href")).toMatch(/^\/u\//);
		// It is the PROFILE link, never the `?post=` card-body deep-link.
		expect(authorLink?.getAttribute("href") ?? "").not.toContain("?post=");
	});

	it("render::side-empty-copy-verbatim", () => {
		// yes: null → exactly one empty panel carrying the exported YES copy.
		const yesEmpty = renderHero({ yes: null, no: heroPost("NO") });
		expect(yesEmpty.getAllByTestId("hero-side-empty")).toHaveLength(1);
		expect(yesEmpty.getByText(HERO_SIDE_EMPTY.YES).textContent).toBe(
			HERO_SIDE_EMPTY.YES,
		);
		expect(yesEmpty.queryByText(HERO_SIDE_EMPTY.NO)).toBeNull();
		expect(yesEmpty.getByTestId("hero-post").getAttribute("data-side")).toBe(
			"NO",
		);
		yesEmpty.unmount();

		// …and the inverse for no: null.
		const noEmpty = renderHero({ yes: heroPost("YES"), no: null });
		expect(noEmpty.getAllByTestId("hero-side-empty")).toHaveLength(1);
		expect(noEmpty.getByText(HERO_SIDE_EMPTY.NO).textContent).toBe(
			HERO_SIDE_EMPTY.NO,
		);
		expect(noEmpty.queryByText(HERO_SIDE_EMPTY.YES)).toBeNull();
		noEmpty.unmount();

		// Both null → two empties, and STILL the market panel.
		const bothEmpty = renderHero({ yes: null, no: null });
		expect(bothEmpty.getAllByTestId("hero-side-empty")).toHaveLength(2);
		expect(bothEmpty.getByText(HERO_SIDE_EMPTY.YES)).toBeTruthy();
		expect(bothEmpty.getByText(HERO_SIDE_EMPTY.NO)).toBeTruthy();
		expect(bothEmpty.getByText(MARKET_TITLE).textContent).toBe(MARKET_TITLE);
		expect(
			bothEmpty.getByTestId("price-sparkline").getAttribute("data-size"),
		).toBe("hero");
	});

	// DISCOVERY-COMPLETE C1/C3 — the hero wiring for the shared-primitive
	// presets. The presets themselves are proven in
	// tests/unit/debate/render/side-badge.test.tsx and
	// tests/unit/discovery/render/price-bar-presets.test.tsx; these assert that
	// the hero is the surface actually asking for them.
	it("render::hero-asks-for-the-hero-presets", () => {
		const { container } = renderHero({
			yes: heroPost("YES"),
			no: heroPost("NO"),
		});

		// V29 — the 22px bar, labels outside. Scoped to the BAR: `PriceSparkline`
		// also stamps `data-size="hero"`, so a bare `[data-size="hero"]` selector
		// passes without PriceBar having received the preset at all.
		const bar = container.querySelector('[data-size="hero"] [role="img"]');
		expect(bar).not.toBeNull();
		expect(bar?.getAttribute("class")).toContain("h-[22px]");

		// V50 — the 16px hero-head avatar.
		const avatars = container.querySelectorAll('[data-slot="avatar"]');
		expect(avatars.length).toBe(2);
		for (const avatar of avatars) {
			expect(avatar.getAttribute("data-size")).toBe("xs");
		}

		// V10/V11 — the chip carries the author's own entry price at the hero
		// geometry, rendered RAW. The fixtures store 0.27 on the YES post and 0.55
		// on the NO post, because `price_at_bet` is already the price of the side
		// bought. Each panel reads back its OWN stored value; neither is derived.
		const yesPanel = container.querySelector(
			'[data-testid="hero-post"][data-side="YES"]',
		);
		expect(yesPanel?.textContent).toContain("YES @ 27%");
		const noPanel = container.querySelector(
			'[data-testid="hero-post"][data-side="NO"]',
		);
		expect(noPanel?.textContent).toContain("NO @ 55%");
		// Neither panel shows the other's complement — the bug this pins.
		expect(noPanel?.textContent).not.toContain("45%");
		expect(yesPanel?.textContent).not.toContain("73%");
	});

	// DISCOVERY-COMPLETE C5 — V16, the reply head.
	it("render::v16-reply-head-carries-count-and-total-staked", () => {
		renderHero({ yes: heroPost("YES"), no: null });
		const head = screen.getByTestId("hero-reply-head-YES");
		expect(head.textContent).toContain("Replies · 24");
		// Grouped by the SHARED formatter — every Đ value rendered to a user
		// groups its integer part in threes (SPEC.1 §10.8).
		expect(head.textContent).toContain("Đ 10,000 staked");
	});

	it("render::v16-count-and-noun-agree-v48", () => {
		const one = { ...heroPost("YES"), replyCount: 1 };
		renderHero({ yes: one, no: null });
		const head = screen.getByTestId("hero-reply-head-YES");
		// `Reply · 1`, never `Replies · 1`.
		expect(head.textContent).toContain("Reply · 1");
		expect(head.textContent).not.toContain("Replies · 1");
	});

	it("render::v16-zero-replies-renders-zero-never-hides", () => {
		// `Đ 0` is data AVAILABLE, not data missing — the canon's ratified Đ-cluster
		// rule (design-canon.md:186). Never hidden.
		const none = {
			...heroPost("YES"),
			replyCount: 0,
			replyDharma: "0.000000000000000000",
		};
		renderHero({ yes: none, no: null });
		const head = screen.getByTestId("hero-reply-head-YES");
		expect(head.textContent).toContain("Replies · 0");
		expect(head.textContent).toContain("Đ 0 staked");
	});

	// PRIMITIVES-2 D8 — the replyhead tier extracted to a named constant.
	it("render::replyhead-class-attribute-is-byte-identical-after-the-extraction", () => {
		// The BASELINE is the literal class attribute as it stood at f12d844,
		// immediately before REPLYHEAD_TIER was extracted — captured from the
		// component, not hand-written. Full-string equality, not `.toContain`:
		// the extraction composes a template literal, so token ORDER and the
		// SPACING around the interpolation are exactly what could move, and a
		// containment assertion would not see either.
		const BASELINE =
			"mt-[9px] flex justify-between pt-[8px] text-[9.5px] font-bold tracking-[0.12em] text-n4 uppercase [border-top:var(--hairline)]";
		// BOTH POLES: the replyhead renders per side, and a YES-only assertion
		// passes on an inverted NO panel.
		renderHero({ yes: heroPost("YES"), no: heroPost("NO") });
		for (const side of ["YES", "NO"] as const) {
			expect(
				screen.getByTestId(`hero-reply-head-${side}`).getAttribute("class"),
			).toBe(BASELINE);
		}
	});

	// DISCOVERY-COMPLETE C6 — V17, the Support/Counter split bar.
	it("render::v17-split-bar-geometry-and-figures", () => {
		renderHero({ yes: heroPost("YES"), no: null });
		const bar = screen.getByTestId("hero-split-bar-YES");

		// `.barrow.r` — one flex row, gap 9px, 16px bar.
		expect(bar.getAttribute("class")).toContain("flex items-center gap-[9px]");
		const track = bar.querySelector(".bg-no");
		expect(track?.getAttribute("class")).toContain("h-[16px]");

		// Both figures render, grouped by the shared formatter.
		expect(bar.textContent).toContain("SUPPORT");
		expect(bar.textContent).toContain("Đ 3,800");
		expect(bar.textContent).toContain("COUNTER");
		expect(bar.textContent).toContain("Đ 6,200");

		// Fill = support / (support + counter) = 3800/10000 = 38%, integer-
		// truncated by the shipped `computeSplitBar`.
		const fill = bar.querySelector<HTMLElement>(".bg-yes");
		expect(fill?.style.width).toBe("38%");

		// No text inside the bar itself — the mockup puts the labels outside.
		expect(track?.textContent).toBe("");
	});

	it("render::v17-bar-is-DISPLAY-ONLY-never-an-affordance", () => {
		// §3c, and it is an INVARIANT not a style choice. Support/Counter are
		// read-time aggregates over reply-bets (ADR-0017/0018) — there is no
		// standalone friendly-fire vote, and `friendly_fire_events` was dropped at
		// DEBATE.9. The mockup has no <button>, no <a>, no handler, no
		// cursor:pointer here.
		renderHero({ yes: heroPost("YES"), no: null });
		const bar = screen.getByTestId("hero-split-bar-YES");

		expect(
			bar.querySelectorAll("button, a, input, [role='button']").length,
		).toBe(0);
		expect(bar.getAttribute("onclick")).toBeNull();
		expect(bar.getAttribute("class")).not.toContain("cursor-pointer");
		expect(bar.getAttribute("class")).not.toContain("hover:");

		// It announces itself as an image, carrying BOTH figures in one utterance
		// (the PriceBar precedent).
		expect(bar.getAttribute("role")).toBe("img");
		expect(bar.getAttribute("aria-label")).toBe(
			"Support Đ 3,800, Counter Đ 6,200",
		);
	});

	it("render::v17-both-zero-renders-an-even-bar", () => {
		// The mockup's `tot ? … : 50` (:458). `computeSplitBar` returns "0%" for an
		// empty total — right inside a composer, wrong on a resting hero panel.
		const empty = {
			...heroPost("YES"),
			replyCount: 0,
			replyDharma: "0.000000000000000000",
			supportDharma: "0.000000000000000000",
			counterDharma: "0.000000000000000000",
		};
		renderHero({ yes: empty, no: null });
		const bar = screen.getByTestId("hero-split-bar-YES");
		expect(bar.querySelector<HTMLElement>(".bg-yes")?.style.width).toBe("50%");
		// Đ 0 is data AVAILABLE — both figures still render.
		expect(bar.getAttribute("aria-label")).toBe("Support Đ 0, Counter Đ 0");
	});

	// DISCOVERY-COMPLETE C7 — V15, the post image attachment.
	it("render::v15-image-renders-when-present", () => {
		const withImage = {
			...heroPost("YES"),
			imageUrl: "https://signed.test/uploads/u/x/arg.webp",
		};
		renderHero({ yes: withImage, no: null });
		const img = screen.getByTestId("hero-post-image-YES");
		expect(img.getAttribute("src")).toBe(
			"https://signed.test/uploads/u/x/arg.webp",
		);
		// Decorative: the argument text carries the meaning and the title is
		// adjacent (WCAG 1.1.1).
		expect(img.getAttribute("alt")).toBe("");
		const cls = img.getAttribute("class") ?? "";
		expect(cls).toContain("object-cover");
		expect(cls).toContain("rounded-[var(--imgr)]");
		expect(cls).toContain("min-h-[40px]");
		// No placeholder alongside it.
		expect(screen.queryByTestId("hero-post-image-empty-YES")).toBeNull();
	});

	it("render::v15-null-image-renders-the-placeholder-not-a-broken-img", () => {
		// `null` covers BOTH "no attachment" and "R2 was momentarily unavailable"
		// — the read degrades rather than throwing, so the panel always serves.
		renderHero({ yes: heroPost("YES"), no: null });
		const placeholder = screen.getByTestId("hero-post-image-empty-YES");
		expect(placeholder.textContent).toBe("IMG");
		expect(placeholder.getAttribute("aria-hidden")).toBe("true");
		expect(screen.queryByTestId("hero-post-image-YES")).toBeNull();
	});

	// DISCOVERY-COMPLETE C8 — V13, the argstake progression (OD-1 = Option B).
	it("render::v13-progression-renders-both-figures-with-an-arrow", () => {
		const held = {
			...heroPost("YES"),
			currentValue: "1407.000000000000000000",
			authorStake: "1000.000000000000000000",
		};
		renderHero({ yes: held, no: null });
		const panel = screen.getByTestId("hero-post");
		expect(panel.textContent).toContain("Đ 1,000");
		expect(panel.textContent).toContain("→");
		expect(panel.textContent).toContain("Đ 1,407");
	});

	it("render::v13-null-current-value-renders-ONE-figure-and-no-arrow", () => {
		// The honest degradation, and the COMMON case for an older post: the
		// author exited, flipped, or the market has no pool row. There is no such
		// state in the mockup, so this is a build decision — never a fabricated
		// second number.
		renderHero({ yes: heroPost("YES"), no: null });
		const panel = screen.getByTestId("hero-post");
		expect(panel.textContent).toContain("Đ 40");
		expect(panel.textContent).not.toContain("→");
	});

	it("render::v17-fill-is-SIDE-KEYED-both-poles-asserted", () => {
		// THE TEST WHOSE ABSENCE LET THE DEFECT SHIP. Every other V17 case renders
		// `no: null`, so the NO panel's bar was asserted nowhere and a fixed
		// `bg-yes` fill passed for the length of the PR.
		//
		// Canon (values-log v0_3 §3): "left = Support share in the SUPPORT SIDE'S
		// POLE COLOUR, right = Counter's"; "Support inherits the post's side,
		// Counter the opposite." So the fill's pole must DIFFER between panels.
		renderHero({ yes: heroPost("YES"), no: heroPost("NO") });

		const yesBar = screen.getByTestId("hero-split-bar-YES");
		const noBar = screen.getByTestId("hero-split-bar-NO");
		// The bar is LABEL — BAR — LABEL (mockup :195-199, asserted as three
		// children elsewhere in this file), so the track is child 1 and the fill is
		// its only child. Positional rather than class-matching: a class selector
		// for `h-[16px]` needs bracket escaping and would silently match nothing.
		const trackOf = (bar: HTMLElement) => bar.children[1] as HTMLElement;
		const fillOf = (bar: HTMLElement) =>
			trackOf(bar).firstElementChild?.getAttribute("class") ?? "";
		const trackClassOf = (bar: HTMLElement) =>
			trackOf(bar).getAttribute("class") ?? "";

		// YES post: Support = YES = black fill, Counter = NO = white track.
		expect(fillOf(yesBar)).toContain("bg-yes");
		expect(trackClassOf(yesBar)).toContain("bg-no");

		// NO post: the poles SWAP. Support = NO = white fill, Counter = YES.
		expect(fillOf(noBar)).toContain("bg-no");
		expect(trackClassOf(noBar)).toContain("bg-yes");

		// The load-bearing assertion, stated as a difference rather than as two
		// independent facts: a fixed-pole regression makes these equal, and any
		// test that checked only one panel would not notice.
		expect(fillOf(yesBar)).not.toBe(fillOf(noBar));
		expect(trackClassOf(yesBar)).not.toBe(trackClassOf(noBar));
	});

	it("render::v17-poles-are-never-ported-by-neutral-token-name", () => {
		// The fill is the mockup's `background:var(--ink)` and the track its
		// `background:var(--n0)` — both light-theme tokens that would invert here.
		renderHero({ yes: heroPost("YES"), no: null });
		const bar = screen.getByTestId("hero-split-bar-YES");
		expect(bar.querySelector(".bg-yes")).not.toBeNull();
		expect(bar.querySelector(".bg-no")).not.toBeNull();
		expect(bar.innerHTML).not.toContain("bg-ink");
		expect(bar.innerHTML).not.toContain("bg-n0");
	});
});
