// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PostCard } from "@/components/debate/PostCard";
import { ReplyCard } from "@/components/debate/ReplyCard";
import type {
	DebatePost,
	DebateReply,
	ReplyGroups,
} from "@/components/debate/types";
import { HeroPanels } from "@/components/discovery/HeroPanels";
import { ArgumentList } from "@/components/profile/ArgumentList";
import type { HeroPost } from "@/server/discovery/hero";
import type { DiscoveryCard } from "@/server/discovery/list";
import type { ProfileArgumentItem } from "@/server/profile/arguments";

/**
 * TIME-1 · G5 + G6 — where the age is allowed to sit, and what it is forbidden
 * to say.
 *
 * **G5 — NO ABSOLUTE TIME REACHES THE DOM FROM THIS FEATURE.** The
 * exact-instant-on-hover affordance was offered and ruled OUT by name, so a
 * `title`, a `<time dateTime=…>`, an ISO string or a formatted calendar date is
 * an unratified feature rather than a free semantic improvement. The strongest
 * form of that is asserted first: the leaf carries **exactly two attributes**,
 * so `title` and `dateTime` are not merely absent, they are unreachable without
 * reddening this.
 *
 * ⚠ **THE DOM HALF IS NOT ENOUGH ON ITS OWN.** A fixture only proves what that
 * fixture rendered; a formatter that reaches for `toLocaleDateString` on some
 * other input would sail past it. So the source of the leaf and the formatter
 * is scanned for the whole family of absolute-time spellings too, with a
 * positive control proving the scanner can see its own subject.
 *
 * ⚠ **SCOPED TO THIS FEATURE, DELIBERATELY.** A tree-wide "no calendar date
 * anywhere" assertion would redden on `profile/PositionsTable.tsx`'s `OPENED`
 * column, which renders `fmtUtcDay` — a *shipped, pre-existing* absolute date
 * on a different surface, and somebody else's decision. A guard that reddens on
 * a decision it was not written to govern gets suppressed, and then it governs
 * nothing.
 *
 * **G6 — THE AGE IS THE LAST THING ON THE IDENTITY ROW**, on all four surfaces
 * that render a card. Asserted as `lastElementChild` identity against the leaf
 * ITSELF, and paired with a check that the row is the right row (it holds the
 * author's name) — a "last child of something" assertion is true of any leaf in
 * any wrapper, and would pass against a version mounted in the footer.
 *
 * ⚠ **SELECTED BY `data-relative-time`, NEVER BY A CLASS.** A selector keyed on
 * presentation changes meaning the moment a neighbour is restyled and does so
 * in silence — the measured `:scope > span.flex-col` failure that matched three
 * nodes instead of two.
 *
 * ⚠ THE CLOCK IS PINNED with `vi.spyOn(Date, "now")` rather than fake timers:
 * the leaf reads `Date.now()` and binds no timer at all, so faking the whole
 * timer system would be faking machinery this feature deliberately does not
 * have. No jest-dom in this repo (AGENTS.md §9) — plain DOM only.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/**
 * ⚠⚠ COMMENTS ARE STRIPPED BEFORE ANY SOURCE SCAN, AND THIS FILE LEARNED IT THE
 * HARD WAY. The first draft scanned raw source and went RED on the leaf — for
 * the words `dateTime` and `requestAnimationFrame` inside the very docblock
 * that forbids them, and for `subscribe` inside the word "subscription". A
 * guard that cannot tell a ban from its own statement of the ban punishes the
 * one thing that makes the rule survive a reader: writing it down.
 *
 * Byte-carried from `tests/unit/design/no-raw-hex-view-layer.test.ts:81-86`,
 * which solved this first and whose docblock records the same reasoning for
 * prose citing contract hex. Trailing `//` comments are stripped only when no
 * quote follows, so a `//` inside a string (an https:// URL) is never eaten.
 */
const stripComments = (source: string): string =>
	source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/\/\/[^"'`\n]*$/gm, "");

/** The scanned text: what the file actually DOES, never what it says about it. */
const code = (rel: string) => stripComments(read(rel));

const LEAF = "src/components/ui/relative-time.tsx";
const FORMATTER = "src/lib/relative-time.ts";
const ARGPROFILE = "src/components/debate/ArgProfile.tsx";
const HERO = "src/components/discovery/HeroPanels.tsx";
const ARGLIST = "src/components/profile/ArgumentList.tsx";

/** A fixed reading clock. Every fixture below is written 5 h before it, so
 * every surface must render `5h ago` — one expected string, four surfaces. */
const NOW = Date.parse("2026-07-30T05:00:00.000Z");
const WRITTEN_AT = "2026-07-30T00:00:00.000Z";
const EXPECTED = "5h ago";

beforeEach(() => {
	vi.spyOn(Date, "now").mockReturnValue(NOW);
});
afterEach(() => {
	vi.restoreAllMocks();
	cleanup();
});

// ── Fixtures. Neutral prose only — no invented market content (CLAUDE.md §3).

const EMPTY_REPLIES: ReplyGroups = { support: [], counter: [], twoSlot: [] };
const AGGREGATE = {
	supportCount: 2,
	counterCount: 1,
	supportDharma: "1000.000000000000000000",
	counterDharma: "2000.000000000000000000",
};
const noop = () => {};

function presentPost(): DebatePost {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-0000000009b1",
		ordinal: 1,
		sideAtPostTime: "YES",
		createdAt: WRITTEN_AT,
		title: "Fixture argument title.",
		teaser: "Fixture teaser.",
		body: "Fixture body.",
		imageUrl: null,
		marker: "none",
		badge: null,
		author: { pseudonym: "fixture-author", pfpUrl: "" },
		authorStake: "10.000000000000000000",
		authorStakeOriginal: "10.000000000000000000",
		authorSold: false,
		entryPrice: "0.500000000000000000",
		aggregate: AGGREGATE,
		replies: EMPTY_REPLIES,
	};
}

function presentReply(): DebateReply {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-0000000009a1",
		side: "YES",
		createdAt: WRITTEN_AT,
		body: "Fixture reply body.",
		marker: "none",
		author: { pseudonym: "fixture-replier", pfpUrl: "" },
		stake: "5000.000000000000000000",
		stakeOriginal: "5000.000000000000000000",
		sold: false,
		entryPrice: "0.500000000000000000",
		imageUrl: null,
	};
}

function heroPost(): HeroPost {
	return {
		id: "0190b3a0-9999-7000-8000-00000000000a",
		ordinal: 3,
		side: "YES",
		title: "Fixture argument title.",
		teaser: "Fixture teaser.",
		author: { pseudonym: "hero-yes-author", pfpUrl: "/pfp-placeholder.svg" },
		authorStake: "40.000000000000000000",
		entryPrice: "0.270000000000000000",
		replyCount: 24,
		replyDharma: "10000.000000000000000000",
		supportDharma: "3800.000000000000000000",
		counterDharma: "6200.000000000000000000",
		imageUrl: null,
		currentValue: null,
		createdAt: WRITTEN_AT,
	};
}

const CARD: DiscoveryCard = {
	id: "0190b3a0-9999-7000-8000-0000000000c1",
	slug: "fixture-alpha",
	title: "Market fixture-alpha",
	pricing: { yes: "0.380000000000000000", no: "0.620000000000000000" },
	totals: {
		dharmaStaked: "14260.000000000000000000",
		postCount: 28,
		replyCount: 68,
	},
	imageUrl: null,
};

function profilePost(): ProfileArgumentItem {
	return {
		removed: false,
		kind: "post",
		id: "0190b3a0-9999-7000-8000-00000000000a",
		side: "YES",
		marketSlug: "fixture-alpha",
		marketTitle: "Market fixture-alpha",
		ordinal: 2,
		title: "Fixture argument title.",
		teaser: "Fixture teaser.",
		body: "Fixture body.",
		marker: "none",
		authorStake: "1500.000000000000000000",
		authorStakeOriginal: "1500.000000000000000000",
		authorSold: false,
		priceAtBet: "0.500000000000000000",
		createdAt: WRITTEN_AT,
		aggregate: AGGREGATE,
	};
}

// ── The four surfaces, rendered the way their own suites render them.

const SURFACES: { name: string; render: () => HTMLElement }[] = [
	{
		name: "market detail · post card",
		render: () =>
			render(
				<PostCard
					post={presentPost()}
					onEnter={noop}
					onOpenPopup={noop}
					onOpenImage={noop}
					onReplyToPost={noop}
					heldSide={null}
					marketOpen
					suspended={false}
				/>,
			).container,
	},
	{
		name: "market detail · reply card",
		render: () =>
			render(
				<ReplyCard
					reply={presentReply()}
					onOpenImage={noop}
					onOpenPopup={noop}
				/>,
			).container,
	},
	{
		name: "discovery · hero post",
		render: () =>
			render(
				<HeroPanels
					card={CARD}
					series={[]}
					topPosts={{ yes: heroPost(), no: null }}
				/>,
			).container,
	},
	{
		name: "profile · argument list",
		render: () =>
			render(
				<ArgumentList
					items={[profilePost()]}
					owner={false}
					author={{
						id: "0190b3a0-9999-7000-8000-0000000000f1",
						pseudonym: "fixture-user",
						banned: false,
						pfpUrl: "",
					}}
				/>,
			).container,
	},
];

describe("TIME-1 :: G6 — the age is the LAST element of the identity row", () => {
	for (const surface of SURFACES) {
		it(`relative-time::G6-last-on-the-identity-row — ${surface.name}`, () => {
			const container = surface.render();
			const leaf = container.querySelector("[data-relative-time]");
			expect(
				leaf,
				`${surface.name}: no timestamp rendered at all`,
			).not.toBeNull();
			if (leaf === null) return;

			// It rendered the age, not something else that happens to be last.
			expect(leaf.textContent).toBe(EXPECTED);

			const row = leaf.parentElement;
			expect(row).not.toBeNull();

			// (a) THE ROW IS THE IDENTITY ROW. Without this, "last child of its
			// parent" is trivially true of a leaf in a footer wrapper, and G6
			// would pass against the exact placement it exists to reject.
			const rowText = row?.textContent ?? "";
			expect(
				rowText,
				`${surface.name}: the leaf's parent is not the identity row — it does not carry the author`,
			).toMatch(/fixture-author|fixture-replier|hero-yes-author|fixture-user/);

			// (b) …AND IT IS AFTER EVERY TAG. ⚠ THIS WAS FIRST WRITTEN AS
			// `row.lastElementChild === leaf` AND THAT WAS WRONG — it went red on
			// the profile head, correctly. Two of these rows end with a
			// TEXT-FREE trailing action cluster (`ArgProfile`'s download mark,
			// `ArgumentList`'s `ml-auto` wrapper around `DownloadStub`), which is
			// the row's trailing EDGE rather than one of its tags. The ruling is
			// "after every existing tag", so the honest predicate is that the age
			// is the last thing the row SAYS: nothing carrying text may follow it.
			// A strict last-child assertion would have forced the age past a
			// control on two surfaces to stay green — the guard bending the build.
			const siblings = [...(row?.children ?? [])];
			const at = siblings.indexOf(leaf);
			expect(at).toBeGreaterThanOrEqual(0);
			const speaksAfter = siblings
				.slice(at + 1)
				.filter((el) => (el.textContent ?? "").trim() !== "");
			expect(
				speaksAfter.map((el) => el.textContent),
				`${surface.name}: something the row SAYS comes after the age`,
			).toEqual([]);

			// (c) POSITIVE CONTROL, INLINE, AND IT IS WHAT STOPS (b) PASSING
			// VACUOUSLY. If the row had no text-bearing tags at all, `speaksAfter`
			// would be empty wherever the leaf sat — including first. So assert
			// the tags exist and that they are all BEFORE it.
			const speaksBefore = siblings
				.slice(0, at)
				.filter((el) => (el.textContent ?? "").trim() !== "");
			expect(
				speaksBefore.length,
				`${surface.name}: no tags precede the age — the guard cannot tell first from last here`,
			).toBeGreaterThan(0);
			// …and the same predicate applied to the FIRST tag must fail, proving
			// it can distinguish a position rather than being true of any node.
			const firstTag = speaksBefore[0];
			const firstAt = siblings.indexOf(firstTag);
			expect(
				siblings
					.slice(firstAt + 1)
					.filter((el) => (el.textContent ?? "").trim() !== "").length,
			).toBeGreaterThan(0);
		});
	}

	it("relative-time::G6-every-card-surface-actually-rendered-one", () => {
		// Alive check. Four surfaces are enumerated above; if a `render` helper
		// silently produced an empty container, each individual assertion would
		// have failed — but a future edit that drops an entry from SURFACES would
		// shrink the guard in silence. This pins the count.
		expect(SURFACES).toHaveLength(4);
		for (const surface of SURFACES) {
			const container = surface.render();
			expect(
				container.querySelectorAll("[data-relative-time]").length,
				`${surface.name}: expected exactly one timestamp on the card`,
			).toBe(1);
			cleanup();
		}
	});
});

describe("TIME-1 :: G5 — no absolute time reaches the DOM", () => {
	for (const surface of SURFACES) {
		it(`relative-time::G5-the-leaf-carries-only-its-marker-and-its-class — ${surface.name}`, () => {
			const container = surface.render();
			const leaf = container.querySelector("[data-relative-time]");
			expect(leaf).not.toBeNull();
			if (leaf === null) return;

			// ⛔ THE STRONGEST FORM. `title` and `dateTime` are not asserted absent
			// one by one — the attribute SET is closed, so any third attribute
			// reddens this, including ones nobody has thought of yet.
			const attrs = [...leaf.attributes].map((a) => a.name).sort();
			expect(
				attrs,
				`${surface.name}: unexpected attribute on the timestamp`,
			).toEqual(["class", "data-relative-time"]);
			// It is a plain text node in a span — never a <time> element.
			expect(leaf.tagName).toBe("SPAN");
			expect(leaf.children.length).toBe(0);
			// R5 — one treatment, and it is the meta rung. `text-n5` is
			// `--muted-foreground` / `--text-meta` resolved (globals.css:64, :189).
			expect(leaf.getAttribute("class") ?? "").toContain("text-n5");
		});

		it(`relative-time::G5-no-time-element-or-date-attribute-anywhere-on-the-card — ${surface.name}`, () => {
			const container = surface.render();
			expect(container.querySelectorAll("time").length).toBe(0);
			expect(container.querySelectorAll("[datetime]").length).toBe(0);
			expect(container.querySelectorAll("[title]").length).toBe(0);

			// The written instant must not appear anywhere in the markup — not as
			// text, not in an attribute, not in a data-*. innerHTML, never
			// textContent (O-7): textContent cannot see an attribute.
			const html = container.innerHTML;
			expect(html).not.toContain(WRITTEN_AT);
			expect(
				html,
				`${surface.name}: an ISO-8601 date reached the DOM`,
			).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
			expect(
				html,
				`${surface.name}: a calendar month name reached the DOM`,
			).not.toMatch(
				/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/,
			);
		});
	}

	it("relative-time::G5-the-ISO-detector-can-actually-fire", () => {
		// OVN-V1 positive control for the two negative assertions above. Run the
		// SAME patterns against markup that does carry the thing, so a green run
		// cannot be a green run of a pattern that matches nothing.
		const leaked = `<span title="${WRITTEN_AT}"><time datetime="${WRITTEN_AT}">30 July 2026</time></span>`;
		expect(leaked).toContain(WRITTEN_AT);
		expect(leaked).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
		expect(leaked).toMatch(/\b(July|Jul)\b/);
		const probe = document.createElement("div");
		probe.innerHTML = leaked;
		expect(probe.querySelectorAll("time").length).toBe(1);
		expect(probe.querySelectorAll("[datetime]").length).toBe(1);
		expect(probe.querySelectorAll("[title]").length).toBe(1);
	});

	it("relative-time::G5-neither-source-file-can-spell-an-absolute-time", () => {
		// The DOM half only proves what these fixtures rendered. A formatter that
		// reached for a calendar on some other input would pass it, so the two
		// files that own the string are scanned for the whole family.
		const BANNED = [
			"toLocaleDateString",
			"toLocaleTimeString",
			"toLocaleString",
			"toISOString",
			"toDateString",
			"toUTCString",
			"DateTimeFormat",
			"dateTime",
			"<time",
			"title=",
		];
		for (const rel of [LEAF, FORMATTER]) {
			const source = code(rel);
			for (const banned of BANNED) {
				expect(
					source,
					`${rel} spells absolute time via ${banned}`,
				).not.toContain(banned);
			}
		}
		// POSITIVE CONTROLS, over the STRIPPED text. A control run against the raw
		// file would prove the file was read, not that the scanned string was.
		expect(code(FORMATTER)).toContain("formatRelativeTime");
		expect(code(LEAF)).toContain("data-relative-time");
		// The stripper must not have eaten the whole file — an empty string
		// satisfies every `not.toContain` above vacuously.
		expect(code(LEAF).length).toBeGreaterThan(200);
		expect(code(FORMATTER).length).toBeGreaterThan(200);
		// …and it really does remove prose: the leaf's docblock NAMES this ban, so
		// the raw text must contain what the stripped text must not. That pair is
		// what proves the stripping is doing work rather than being a no-op.
		expect(read(LEAF)).toContain("dateTime");
		expect(code(LEAF)).not.toContain("dateTime");
	});
});

describe("TIME-1 :: the three walls, as structure rather than as review notes", () => {
	it("relative-time::nothing-makes-the-string-tick", () => {
		// R6. A per-card ticker is N tickers on a page with N cards. Scanned on
		// the two files this feature owns — the mount files carry the surface's
		// own pre-existing effects and are not this guard's subject.
		const TICKERS = [
			"setInterval",
			"setTimeout",
			"requestAnimationFrame",
			"useEffect",
			"useState",
			"addEventListener",
			"subscribe",
		];
		for (const rel of [LEAF, FORMATTER]) {
			const source = code(rel);
			for (const ticker of TICKERS) {
				expect(source, `${rel} introduces ${ticker}`).not.toContain(ticker);
			}
		}
		// POSITIVE CONTROL — the prose in both files names several of these while
		// forbidding them, so the raw source contains what the stripped source
		// must not. Without this pair the assertion above could be passing because
		// `code()` returned nothing.
		expect(read(LEAF)).toContain("requestAnimationFrame");
		expect(code(LEAF)).not.toContain("requestAnimationFrame");
		expect(code(LEAF)).toContain("formatRelativeTime");
	});

	it("relative-time::no-date-library-was-added", () => {
		const pkg = read("package.json");
		for (const lib of [
			"date-fns",
			"dayjs",
			"luxon",
			"moment",
			"timeago",
			"pretty-ms",
			"@formatjs",
			"react-time-ago",
		]) {
			expect(pkg, `${lib} was added as a dependency`).not.toContain(`"${lib}`);
		}
		// Positive control — the file really is package.json and really is read.
		expect(pkg).toContain('"decimal.js"');
	});

	it("relative-time::the-cards-did-not-become-client-components", () => {
		// THE WALL'S ACTUAL OUTCOME. Marking either of these `"use client"` would
		// convert a whole server-rendered card tree per surface for one text node.
		// Asserted on the FIRST LINE, because that is the only position where the
		// directive has any effect.
		for (const rel of [HERO, ARGLIST, LEAF]) {
			const firstLine = read(rel).split("\n")[0] ?? "";
			expect(firstLine, `${rel} became a client component`).not.toContain(
				"use client",
			);
		}
		// Positive control: the same read against a file that IS one.
		expect(read("src/components/debate/PostCard.tsx").split("\n")[0]).toContain(
			"use client",
		);
	});

	it("relative-time::ONE-formatter-and-ONE-leaf-serve-every-surface", () => {
		// A formatter re-implemented per surface is four things that can disagree
		// about where a bucket edge falls. Exactly one file imports the formatter
		// (the leaf), and exactly the three identity rows import the leaf.
		const importers = (needle: string) =>
			[LEAF, FORMATTER, ARGPROFILE, HERO, ARGLIST].filter((rel) =>
				read(rel).includes(needle),
			);
		expect(importers("@/lib/relative-time")).toEqual([LEAF]);
		expect(importers("@/components/ui/relative-time")).toEqual([
			ARGPROFILE,
			HERO,
			ARGLIST,
		]);
		// …and no mount overrides the treatment. `className` on this leaf is for
		// SIZE; a colour passed there would silently defeat "one treatment".
		for (const rel of [ARGPROFILE, HERO, ARGLIST]) {
			const mounts = read(rel).match(/<RelativeTime[^/]*\/>/g) ?? [];
			expect(mounts.length, `${rel}: expected one mount`).toBe(1);
			expect(mounts[0], `${rel}: a colour was passed to the leaf`).not.toMatch(
				/text-(n[0-7]|ink|muted|yes|no)\b/,
			);
		}
	});
});
