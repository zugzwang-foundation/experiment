// @vitest-environment jsdom

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PostCard } from "@/components/debate/PostCard";
import { PostFocusHeader } from "@/components/debate/PostFocusHeader";
import { ReplyCard } from "@/components/debate/ReplyCard";
import type {
	DebateMarketHeader,
	DebatePost,
	DebateReply,
	ReplyGroups,
} from "@/components/debate/types";
import { HeroPanels } from "@/components/discovery/HeroPanels";
import { ArgumentList } from "@/components/profile/ArgumentList";
import { formatRelativeTime } from "@/lib/relative-time";
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

/**
 * Every shape an absolute instant can take in markup.
 *
 * ⚠⚠ THE FIRST VERSION HAD TWO ENTRIES AND THREE HOLES. It required
 * `T\d{2}:\d{2}` — so a bare `2026-07-30` sailed through — and it only knew
 * WORD-SPELLED months, so `00:00` and `7/30/2026` did too. All three were
 * rendered into the identity row and the guard stayed green (`@test-writer`
 * H-2). R3 forbids "any ISO or calendar-formatted string", and a calendar date
 * with the time lopped off is still a calendar date.
 *
 * ⛔ THE YEAR IS ANCHORED TO `19xx|20xx` DELIBERATELY. A bare
 * `\d{4}-\d{2}-\d{2}` is close enough to a UUID's hyphenated hex runs to make
 * a false positive a question of luck; a real-looking year, a 01-12 month and
 * a 01-31 day is a date and essentially nothing else.
 */
/**
 * Applied to the WHOLE CARD. These three cannot collide with anything a card
 * legitimately renders — verified against the fixture UUIDs (a UUID's 4-char
 * hex segments can never satisfy `\d{4}-\d{2}-\d{2}`), Đ figures, `YES @ 27%`,
 * hrefs and Tailwind class strings including `aspect-[640/586]`.
 */
const ABSOLUTE_TIME_IN_MARKUP: [string, RegExp][] = [
	["a full ISO-8601 instant", /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/],
	[
		"an ISO calendar date",
		/\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/,
	],
	["a slash-formatted date", /\b\d{1,2}\/\d{1,2}\/(19|20)?\d{2}\b/],
];

/**
 * Applied to THE LEAF'S OWN OUTPUT ONLY, and the split is the whole point.
 *
 * ⚠⚠ THESE TWO FALSE-POSITIVE ON CORRECT MARKUP, DEMONSTRATED IN-REPO RATHER
 * THAN IMAGINED. Run over a whole card they red on content that has nothing to
 * do with this feature:
 *
 *   · `CommentImage.tsx`'s placeholder label is `POST IMAGE · 640:586`, which
 *     survives the wall-clock pattern ONLY by digit count — edit it to `16:10`
 *     and the guard goes red naming a time that is an aspect ratio.
 *   · A market question reading "Settles at 18:00 UTC" fires the same pattern.
 *   · The live window is 15 Sep – 5 Nov 2026, so a founder-authored question
 *     naming September, October or November fires the month pattern — and so
 *     does the ordinary English word **May**.
 *
 * A guard that reddens on a decision it was not written to govern gets
 * suppressed, and then it governs nothing — this file's own docblock says so,
 * and running these two over the whole card was that mistake. Scoped to the
 * leaf they are exact: the leaf's entire output is one of four known strings.
 *
 * ⛔ COVERAGE IS NOT LOST, it is relocated. A date rendered NEXT to the age by
 * a mount is caught by the source scan over all five feature files below —
 * which is where `@test-writer` H-2's original leak was closed — and by the
 * three whole-card patterns above, which see a real date in any position.
 * (`@test-writer` NEW-2.)
 */
const ABSOLUTE_TIME_IN_THE_LEAF: [string, RegExp][] = [
	["a wall-clock time", /\b([01]?\d|2[0-3]):[0-5]\d\b/],
	[
		"a calendar month name",
		/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/,
	],
];

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

/** The focused post's market context. Neutral fixture prose only — no invented
 * market content (CLAUDE.md §3); `Market fixture-alpha` is the string every
 * other suite in this tree uses. */
const MARKET_HEADER: DebateMarketHeader = {
	id: "0190b3a0-9999-7000-8000-0000000000c2",
	slug: "fixture-alpha",
	title: "Market fixture-alpha",
	description: null,
	status: "Open",
	mediaVideoUrl: null,
	mediaImageUrl: null,
	pricing: { yes: "0.500000000000000000", no: "0.500000000000000000" },
	unitToWin: { yes: "2.000000000000000000", no: "2.000000000000000000" },
	totals: {
		dharmaStaked: "14260.000000000000000000",
		postCount: 28,
		replyCount: 68,
	},
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

/**
 * `strictLast` — whether the age must be the row's LITERAL last element.
 *
 * ⚠⚠ MEASURED PER SURFACE, NOT ASSUMED, and the first version of this file got
 * it wrong in the other direction. It claimed TWO rows end with a text-free
 * trailing action cluster and exempted all four from the strict rule. Only ONE
 * does. `ArgProfile`'s download mark is a sibling of the META DIV, not of the
 * age — and the meta div is what `leaf.parentElement` binds to — so on the post
 * card, the reply card and the hero panel the age genuinely IS the last child
 * and the strict predicate is available for free. Giving it up on all four
 * surfaces to accommodate one was a guard weakened for a reason that held on a
 * quarter of its subject. (`@test-writer` M-1, this branch.)
 */
const SURFACES: {
	name: string;
	render: () => HTMLElement;
	strictLast: boolean;
}[] = [
	{
		strictLast: true,
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
		strictLast: true,
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
		strictLast: true,
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
		// The ONE exemption. This head is FLAT — the age and the `ml-auto`
		// download wrapper are siblings — so the row's literal last element is
		// that text-free action cluster, which is the row's trailing EDGE rather
		// than one of its tags. The `speaksAfter` predicate below is what covers
		// this case, and the exemption is asserted rather than assumed: the
		// element after the age must carry `ml-auto` and no text.
		strictLast: false,
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
			// ⚠ ONE PREDICATE, SHARED BY THE ASSERTION AND BY ITS CONTROL AT (d).
			// The control used to carry a SECOND, textually separate copy of this
			// expression — so weakening the one below to `() => false` would have
			// left the control passing with its own correct copy, certifying a
			// predicate it no longer shared. A control that does not share code
			// with what it certifies proves the wrong thing. (`@test-writer`
			// NEW-3.)
			const speaks = (el: Element) => (el.textContent ?? "").trim() !== "";
			const siblings = [...(row?.children ?? [])];
			const at = siblings.indexOf(leaf);
			expect(at).toBeGreaterThanOrEqual(0);
			const speaksAfter = siblings.slice(at + 1).filter(speaks);
			expect(
				speaksAfter.map((el) => el.textContent),
				`${surface.name}: something the row SAYS comes after the age`,
			).toEqual([]);

			// (c) POSITIVE CONTROL, INLINE, AND IT IS WHAT STOPS (b) PASSING
			// VACUOUSLY. If the row had no text-bearing tags at all, `speaksAfter`
			// would be empty wherever the leaf sat — including first. So assert
			// the tags exist and that they are all BEFORE it.
			const speaksBefore = siblings.slice(0, at).filter(speaks);
			expect(
				speaksBefore.length,
				`${surface.name}: no tags precede the age — the guard cannot tell first from last here`,
			).toBeGreaterThan(0);

			// (d) AND THE PREDICATE MUST BE ABLE TO FAIL, shown by making it.
			// ⚠ THE CONTROL THAT STOOD HERE COULD NOT. It asserted that something
			// text-bearing followed the FIRST tag — but (b) has already fixed the
			// leaf's index, (c) has already put a tag before it, and the leaf
			// itself carries text, so the count was `>= 1` unconditionally for
			// every possible arrangement of the row. It read as evidence and was
			// a tautology, which is worse than an absent control because it makes
			// the guard look better-controlled than it is. (`@test-writer` M-2.)
			// This runs the REAL predicate over a REAL mutation of the REAL row.
			const mutated = row?.cloneNode(true) as HTMLElement;
			const intruder = mutated.ownerDocument.createElement("span");
			intruder.textContent = "posted 30 July 2026";
			mutated.appendChild(intruder);
			const mutatedLeaf = mutated.querySelector("[data-relative-time]");
			const mutatedSiblings = [...mutated.children];
			const mutatedAt = mutatedSiblings.indexOf(mutatedLeaf as Element);
			expect(
				mutatedSiblings.slice(mutatedAt + 1).filter(speaks).length,
				`${surface.name}: the predicate cannot see a tag appended after the age`,
			).toBeGreaterThan(0);

			// (e) THE STRICT RULE WHERE IT IS AVAILABLE. Three of the four rows
			// end at the age outright; only the profile head has a trailing
			// action cluster. Giving the strict predicate up on all four to
			// accommodate one is how a text-free intruder — a pin, a badge, a
			// menu glyph — lands after the age unnoticed.
			if (surface.strictLast) {
				expect(
					row?.lastElementChild === leaf,
					`${surface.name}: the age is not the literal last element of the identity row`,
				).toBe(true);
			} else {
				// The exemption is ASSERTED, never assumed: whatever follows the
				// age here must be the text-free trailing action cluster and
				// nothing else.
				// ⚠ KEYED ON THE CLUSTER'S CONTENT, NEVER ON `ml-auto`. This
				// assertion used to read the class string — in the file whose own
				// docblock forbids selecting by presentation, and a purely
				// cosmetic `ml-auto` → `ms-auto` reddened it while nothing about
				// the age moved (`@test-writer` NEW-4). The exemption is for a
				// TEXT-FREE TRAILING ACTION CLUSTER; what makes it that is the
				// control inside it, not the utility that right-aligns it.
				const after = siblings.slice(at + 1);
				expect(
					after.length,
					`${surface.name}: the trailing cluster is no longer a single element — re-derive the exemption rather than widening it`,
				).toBe(1);
				expect(
					after[0]?.querySelector("button, a, [role='button']"),
					`${surface.name}: what follows the age is not an action cluster`,
				).not.toBeNull();
				expect(
					speaks(after[0] as Element),
					`${surface.name}: the element after the age carries text, so it is a tag and not the trailing edge`,
				).toBe(false);
			}
		});
	}

	it("relative-time::G6-the-wiring-carries-every-bucket-not-just-the-hour-one", () => {
		// ⚠ THE FIXTURES ABOVE ALL SIT 5 h OLD, so until this test the leaf's
		// WIRING was only ever exercised through the hour branch — a mount that
		// worked for `Nh ago` and broke for the other three would have shipped
		// (`@test-writer` L-5). The formatter's own suite covers the buckets;
		// this covers that the mount reaches all of them.
		for (const [ageMs, expected] of [
			[0, "just now"],
			[45 * 1000, "just now"],
			[7 * 60 * 1000, "7m ago"],
			[3 * 24 * 60 * 60 * 1000, "3d ago"],
		] as [number, string][]) {
			vi.spyOn(Date, "now").mockReturnValue(Date.parse(WRITTEN_AT) + ageMs);
			const { container } = render(
				<ReplyCard
					reply={presentReply()}
					onOpenImage={noop}
					onOpenPopup={noop}
				/>,
			);
			expect(
				container.querySelector("[data-relative-time]")?.textContent,
				`age ${ageMs}ms`,
			).toBe(expected);
			cleanup();
		}
	});

	it("relative-time::G6-every-card-surface-actually-rendered-one", () => {
		// Alive check. Four surfaces are enumerated above; if a `render` helper
		// silently produced an empty container, each individual assertion would
		// have failed — but a future edit that drops an entry from SURFACES would
		// shrink the guard in silence. This pins the count.
		//
		// ⚠ FOUR OF SEVEN MOUNTS ARE RENDERED HERE, DELIBERATELY
		// (`@code-reviewer` M-1). The focused post (`PostFocusHeader.tsx:145`)
		// and the two pop-ups (`dialogs.tsx:97`, `:208`) are covered
		// TRANSITIVELY: all three pass props to `ArgProfile`, which owns the row
		// JSX these assertions read, so none of them can produce a different
		// arrangement. Rendering them would buy a third and fourth copy of an
		// assertion about one component — and `Dialog` portals to
		// `document.body`, so the fixtures would need their own container
		// plumbing to say the same thing.
		// ⛔ THE ONE THING TRANSITIVITY DOES NOT CARRY is which entity's
		// `createdAt` each passes. Today that is not expressible: `PostPopup`
		// and `PostFocusHeader` hold only a post, `ReplyPopup` only a reply. If
		// a refactor ever brings both into one scope, `tsc` cannot tell
		// `post.createdAt` from `reply.createdAt` — both are `string` — and this
		// guard would not either. Add the surface then.
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

describe("TIME-1 :: A8 — a REMOVED card renders no age at all", () => {
	/**
	 * ⚠⚠ THIS SUITE EXISTS BECAUSE ITS ABSENCE WAS THE ONE REAL GAP THE SECURITY
	 * AUDIT FOUND. Every other guard here renders a PRESENT fixture, so nothing
	 * a removed branch produces was ever asserted on — and the mount inventory
	 * that was standing in for this rule keys on a NAME, not on a BRANCH.
	 * `@security-auditor` demonstrated two evasions on the real tree, both green:
	 *
	 *   · `import { RelativeTime as Age }` inside a file already on the ratified
	 *     list, mounted in `RemovedHead` — the specifier still matches, and
	 *     `<Age` is not `<RelativeTime`.
	 *   · No leaf at all: `<span className="text-xs text-n5">{createdAt}</span>`
	 *     in `RemovedHead` — a full ISO instant on a removed stub, with no
	 *     regex anywhere to harden.
	 *
	 * ⇒ The fix is a removed FIXTURE, not a tighter pattern. Asserting on what
	 * the removed branch actually renders converts the rule from "one mount per
	 * named file" (a naming convention) into "a removed card carries no age"
	 * (the ruling). The first evasion is caught by the marker count, the second
	 * by the ISO scan — neither needs to know how the mount was spelled.
	 *
	 * ⚠ A8 IS A PRODUCT DECISION, NOT A SECURITY CONTROL, and the audit was
	 * explicit that it should be labelled that way. `createdAt` is a declared
	 * structural field that SURVIVES masking (`load-debate-view.ts:52-54`,
	 * ADR-0020/0021 thread integrity), and the exact instant is already public
	 * at finer precision through the `.md` export (`debate-export/serialize.ts`
	 * emits `Time: YYYY-MM-DD HH:MM UTC` on the removed branch, via an
	 * unauthenticated route). So an age on a removed card would be SAFE; it is
	 * simply not what this task shipped, because market detail renders no
	 * identity row at all for a removed node and inventing one is a new
	 * decision. Recorded here so a future ruling that reverses it is not
	 * mistaken for a security regression.
	 *
	 * ⚠⚠ ONE PRECONDITION ATTACHES TO REVERSING IT, and it is not optional.
	 * Reversal is safe ONCE `src/server/debate-view/load-debate-view.ts:334`
	 * renders the substrate instant instead of `new Date(0)`. Before that, a
	 * reversed A8 prints roughly `20693d ago` on the `!comment` race path — a
	 * fabricated fact, and a visible tell that the node is a substrate stub
	 * rather than a moderated removal, which is a disclosure the UI does not
	 * have today. ⛔ Reversing first would CREATE the regression this
	 * relabelling exists to pre-empt. The full trace lives in
	 * `claude-progress.md`, which is GITIGNORED — which is exactly why the
	 * precondition is restated here, where a reverser will actually read it.
	 */
	const PROFILE_AUTHOR = {
		id: "0190b3a0-9999-7000-8000-0000000000f1",
		pseudonym: "fixture-user",
		banned: false,
		pfpUrl: "",
	};
	/**
	 * ⚠ `ProfileArgumentItem` has TWO removed variants — `kind: "post"` (this
	 * one) and `kind: "reply"` (`arguments.ts:49-57`, which carries no
	 * `aggregate`). `ArgumentList:173-181` renders both through the IDENTICAL
	 * branch, so the second exercises no distinct code and its absence here is a
	 * decision rather than an oversight (`@security-auditor`, §3 nuance).
	 */
	const REMOVED_PROFILE_ITEM: ProfileArgumentItem = {
		removed: true,
		kind: "post",
		id: "0190b3a0-9999-7000-8000-00000000000d",
		side: "NO",
		marketSlug: "fixture-alpha",
		marketTitle: "Market fixture-alpha",
		ordinal: 5,
		createdAt: WRITTEN_AT,
		aggregate: AGGREGATE,
	};

	const REMOVED_SURFACES: { name: string; render: () => HTMLElement }[] = [
		{
			name: "market detail · removed post card",
			render: () =>
				render(
					<PostCard
						post={{
							removed: true,
							id: "0199a0c0-0000-7000-8000-00000000000d",
							ordinal: 4,
							sideAtPostTime: "NO",
							createdAt: WRITTEN_AT,
							aggregate: AGGREGATE,
							replies: EMPTY_REPLIES,
						}}
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
			name: "market detail · removed reply card",
			render: () =>
				render(
					<ReplyCard
						reply={{
							removed: true,
							id: "0199a0c0-0000-7000-8000-00000000000e",
							side: "NO",
							createdAt: WRITTEN_AT,
						}}
						onOpenImage={noop}
						onOpenPopup={noop}
					/>,
				).container,
		},
		{
			name: "profile · removed argument",
			render: () =>
				render(
					<ArgumentList
						items={[REMOVED_PROFILE_ITEM]}
						owner={false}
						author={PROFILE_AUTHOR}
					/>,
				).container,
		},
		{
			// E-1 — THE FOCUSED POST'S REMOVED ARM. `PostFocusHeader` appeared in
			// this file only inside comments; it was never imported and never
			// rendered, so a raw instant written into its removed branch was
			// invisible to every assertion here (`@security-auditor` E-1).
			name: "market detail · removed focused post",
			render: () =>
				render(
					<PostFocusHeader
						post={{
							removed: true,
							id: "0199a0c0-0000-7000-8000-00000000000f",
							ordinal: 6,
							sideAtPostTime: "NO",
							createdAt: WRITTEN_AT,
							aggregate: AGGREGATE,
							replies: EMPTY_REPLIES,
						}}
						market={MARKET_HEADER}
						heldSide={null}
						marketOpen
						suspended={false}
						activeRelation={null}
						onToggleRelation={noop}
						onExit={noop}
						onOpenImage={noop}
						onOpenPopup={noop}
					/>,
				).container,
		},
		{
			// E-2 — THE PROFILE REPLICA'S REMOVED ARM. `ArgumentList` has TWO
			// removed rendering paths and the fixture above exercises only the
			// list one; passing a `selection` routes to the filtered branch
			// instead (`@security-auditor` E-2). Same file, same component, a
			// different `return` — which is exactly the distinction a
			// file-keyed inventory cannot make.
			name: "profile · removed argument, filtered panel",
			render: () =>
				render(
					<ArgumentList
						items={[REMOVED_PROFILE_ITEM]}
						owner={false}
						author={PROFILE_AUTHOR}
						selection={{
							marketId: "0190b3a0-9999-7000-8000-0000000000c2",
							marketTitle: "Market fixture-alpha",
							commentId: REMOVED_PROFILE_ITEM.id,
						}}
					/>,
				).container,
		},
	];

	for (const surface of REMOVED_SURFACES) {
		it(`relative-time::A8-no-age-on-a-removed-card — ${surface.name}`, () => {
			const container = surface.render();

			// (a) The stub really did render — otherwise every assertion below
			// passes against an empty container, which is the vacuous-green shape
			// this whole file keeps guarding against.
			expect(
				container.textContent ?? "",
				`${surface.name}: the removed stub did not render`,
			).toContain("Removed by moderator");

			// (b) NO LEAF. Catches an aliased-import mount, because the alias
			// changes the tag and not the marker it renders.
			expect(
				container.querySelectorAll("[data-relative-time]").length,
				`${surface.name}: a removed card rendered an age`,
			).toBe(0);

			// (c) AND NO INSTANT BY ANY OTHER SPELLING. Catches a raw
			// `{createdAt}` written straight into the stub, which has no leaf and
			// no marker for (b) to find.
			const html = container.innerHTML;
			expect(html).not.toContain(WRITTEN_AT);
			for (const [what, pattern] of ABSOLUTE_TIME_IN_MARKUP) {
				expect(
					html,
					`${surface.name}: ${what} reached a removed card`,
				).not.toMatch(pattern);
			}
			// (d) …AND NO AGE, IN ANY SPELLING.
			// ⚠⚠ THIS USED TO BE ONE HAND-COPIED REGEX OVER FOUR LITERAL SHAPES,
			// AND THAT REPRODUCED, ONE LAYER DOWN, THE DEFECT THIS WHOLE SUITE
			// WAS WRITTEN TO END: the old inventory was bound to a NAME; that
			// pattern was bound to a SPELLING. `@security-auditor` E-3 walked
			// past it with three lines of `Intl.RelativeTimeFormat`, which
			// renders `54 days ago` — no `<digits><m|h|d> ago`, so no match; no
			// leaf, so the marker count is 0; no date, so the ISO scan is silent;
			// and `RelativeTimeFormat` does not contain the banned substring
			// `DateTimeFormat`. Green on every assertion, with a full relative
			// age on a withheld argument.
			//
			// Two nets now, and neither is a copy of the implementation:
			// (i) every string the SHIPPED formatter can actually produce, swept
			//     across all four buckets — bound to the function, so it cannot
			//     drift from what ships;
			// (ii) a coarse "any relative-age phrasing at all" net, which is what
			//      catches a spelling the shipped formatter never emits.
			for (const ageMs of [0, 30_000, 90_000, 5 * 3_600_000, 3 * 86_400_000]) {
				const shipped = formatRelativeTime(
					Date.parse(WRITTEN_AT) + ageMs,
					Date.parse(WRITTEN_AT),
				);
				expect(
					html,
					`${surface.name}: the shipped age "${shipped}" reached a removed card`,
				).not.toContain(shipped);
			}
			expect(
				html,
				`${surface.name}: a relative age reached a removed card`,
			).not.toMatch(/\b\d+\s*\w* ago\b|just now|yesterday/i);
		});
	}

	it("relative-time::A8-the-removed-fixtures-are-alive", () => {
		// The present fixtures DO render an age; the removed ones do not. Without
		// this pair, (b) above could be passing because the render helper is
		// broken rather than because the branch is right.
		expect(REMOVED_SURFACES).toHaveLength(5);
		for (const surface of SURFACES) {
			const c = surface.render();
			expect(c.querySelectorAll("[data-relative-time]").length).toBe(1);
			cleanup();
		}
		for (const surface of REMOVED_SURFACES) {
			const c = surface.render();
			expect(c.querySelectorAll("[data-relative-time]").length).toBe(0);
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
			for (const [what, pattern] of ABSOLUTE_TIME_IN_MARKUP) {
				expect(html, `${surface.name}: ${what} reached the DOM`).not.toMatch(
					pattern,
				);
			}
		});
	}

	it("relative-time::G5-EVERY-detector-can-actually-fire", () => {
		// OVN-V1 positive control for the negative assertions above. ⚠ EVERY
		// PATTERN IS EXERCISED, not two of them — the first version proved the
		// full-ISO and month-name patterns could fire and said nothing about the
		// other three, which is how three holes sat behind a green control.
		const SAMPLES: [RegExp, string][] = [
			[ABSOLUTE_TIME_IN_MARKUP[0][1], `<span>${WRITTEN_AT}</span>`],
			[ABSOLUTE_TIME_IN_MARKUP[1][1], "<span>2026-07-30</span>"],
			[ABSOLUTE_TIME_IN_MARKUP[2][1], "<span>7/30/2026</span>"],
			[ABSOLUTE_TIME_IN_THE_LEAF[0][1], "<span>00:00</span>"],
			[ABSOLUTE_TIME_IN_THE_LEAF[1][1], "<span>30 July 2026</span>"],
		];
		expect(SAMPLES).toHaveLength(
			ABSOLUTE_TIME_IN_MARKUP.length + ABSOLUTE_TIME_IN_THE_LEAF.length,
		);
		for (const [pattern, sample] of SAMPLES) {
			expect(sample, `pattern ${pattern} cannot see ${sample}`).toMatch(
				pattern,
			);
		}
		// …and none fires on what this feature actually renders, so a RED is a
		// leak rather than the guard eating its own output.
		for (const [, pattern] of [
			...ABSOLUTE_TIME_IN_MARKUP,
			...ABSOLUTE_TIME_IN_THE_LEAF,
		]) {
			for (const ok of ["just now", "5h ago", "51d ago", "59m ago"]) {
				expect(ok, `pattern ${pattern} false-positives on "${ok}"`).not.toMatch(
					pattern,
				);
			}
		}
		// ⚠⚠ AND THE HALF THAT WAS MISSING: the whole-card patterns must not fire
		// on CARD CONTENT either. The control above only ever proved they do not
		// eat the timestamp — but the haystack is the whole card, and nothing
		// tested that half, which is how two patterns that red on the word "May"
		// shipped green (`@test-writer` NEW-2). Every string below is copy this
		// product plausibly renders: the live window is 15 Sep – 5 Nov 2026, and
		// market questions are founder-authored.
		const REAL_CARD_COPY = [
			"POST IMAGE · 640:586",
			"POST IMAGE · 16:10",
			"Settles at 18:00 UTC.",
			"Closes 09:30 in Mumbai.",
			"Before December, or after.",
			"May be the last word.",
			"YES @ 27%",
			"Đ 1,500",
			"Replies · 24",
			"/m/fixture-alpha?post=3",
			"0190b3a0-9999-7000-8000-00000000000a",
			"aspect-[640/586]",
		];
		for (const [what, pattern] of ABSOLUTE_TIME_IN_MARKUP) {
			for (const copy of REAL_CARD_COPY) {
				expect(
					copy,
					`whole-card pattern for ${what} false-positives on real copy: "${copy}"`,
				).not.toMatch(pattern);
			}
		}
		const leaked = `<span title="${WRITTEN_AT}"><time datetime="${WRITTEN_AT}">30 July 2026</time></span>`;
		const probe = document.createElement("div");
		probe.innerHTML = leaked;
		expect(probe.querySelectorAll("time").length).toBe(1);
		expect(probe.querySelectorAll("[datetime]").length).toBe(1);
		expect(probe.querySelectorAll("[title]").length).toBe(1);
	});

	it("relative-time::G5-no-FEATURE-file-can-spell-an-absolute-time", () => {
		// The DOM half only proves what these fixtures rendered. A formatter that
		// reached for a calendar on some other input would pass it, so the files
		// that own the string are scanned for the whole family too.
		//
		// ⚠⚠ THE MOUNTS ARE SCANNED NOW, AND THEY WERE NOT. The first version
		// iterated the leaf and the formatter only, so `createdAt.slice(0, 10)`
		// written into any of the three identity rows was invisible to BOTH
		// halves at once — the DOM patterns did not know a bare date and the
		// source scan did not read the file (`@test-writer` H-2).
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
			// A mount slicing the ISO apart is the cheapest way to print a date
			// without naming a single date API.
			// ⚠ THESE FOUR ARE A CONVENIENCE, NOT THE CONTROL. They are literal
			// strings, so `String(createdAt).slice(0, 10)` walks past them —
			// measured. What actually catches that is the DOM half: the rendered
			// output reddens on the ISO-date pattern regardless of how the slice
			// was spelled (`@test-writer` NEW-7). Recorded so nobody "hardens"
			// this list under the impression it is load-bearing. It is not.
			"createdAt.slice",
			"createdAt.split",
			"createdAt.substring",
			"createdAt.substr",
		];
		// ⛔ `title=` IS BANNED EVERYWHERE EXCEPT ONE FILE, and the exception is
		// sized to the measurement rather than to convenience. In a mount file
		// the string can be a REACT PROP rather than an HTML tooltip, and
		// `ArgumentList.tsx` passes `<ArgumentsPanel title="Arguments">` at three
		// sites — so banning it there would redden on a heading. Measured over
		// stripped source: `ArgumentList` 3, `ArgProfile` 0, `HeroPanels` 0,
		// leaf 0, formatter 0.
		// ⚠⚠ THE EXEMPTION USED TO COVER `ArgProfile` AND `HeroPanels` TOO, for
		// no reason either file supplied — and `ArgProfile` is the file that
		// renders the identity row on FOUR of the five mounts, i.e. the single
		// likeliest place a `title={createdAt}` would ever be written
		// (`@test-writer` NEW-5). An exception three times wider than its
		// evidence is a hole with a justification attached.
		const TITLE_PROP_EXEMPT = [ARGLIST];
		for (const rel of [LEAF, FORMATTER, ARGPROFILE, HERO, ARGLIST]) {
			const source = code(rel);
			const list = TITLE_PROP_EXEMPT.includes(rel)
				? BANNED
				: [...BANNED, "title="];
			for (const banned of list) {
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
		// ⚠ THE THREE MOUNT FILES ARE SCANNED NOW. The first version excluded
		// them on the ground that "the mount files carry the surface's own
		// pre-existing effects" — measured, they carry NONE, so the exclusion
		// bought nothing and left R6 unenforced on the three files a retrofit
		// would most naturally touch (`@test-writer` M-4). If one of them ever
		// needs a legitimate effect, removing it from this list is a decision
		// somebody makes on purpose, which is the point.
		// ⚠⚠ `@/lib/utils` IS IN THIS LIST AND IT IS THE POINT. The import
		// allowlist below is only as tight as the modules ON it, and one of them
		// is the repo's general-purpose helper bag — exactly where a "small
		// shared hook" would land. `@test-writer` NEW-1 demonstrated it: a
		// `useLiveClock()` (a `useState` plus a one-second `setInterval`) added
		// to `src/lib/utils.ts`, pulled in through the leaf's ALREADY-ALLOWED
		// `import { cn } from "@/lib/utils"`, shipped one timer per card and
		// left all 36 assertions green. The module specifier never changed, so
		// the allowlist saw nothing; the leaf spelled only `useLiveClock`, so
		// the denylist saw nothing. Scanning the allowlisted module closes the
		// seam between the two rather than tightening either one.
		// ⛔ `@/lib/relative-time` needs no entry — its OWN import list is
		// asserted empty below, so it can reach no timer to re-export.
		for (const rel of [
			LEAF,
			FORMATTER,
			ARGPROFILE,
			HERO,
			ARGLIST,
			"src/lib/utils.ts",
		]) {
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

	it("relative-time::the-leaf-and-the-formatter-import-from-a-CLOSED-set", () => {
		// ⛔⛔ THIS IS THE REAL TICKER WALL, AND THE NAME-DENYLIST ABOVE IS ONLY
		// ITS FIRST LINE. A denylist of identifiers falls to ONE level of
		// indirection: a `src/lib/live-clock.ts` exporting `useLiveClock()` —
		// a `useState` plus a one-second `setInterval` — imported into the leaf
		// and substituted for `Date.now()` spells not one banned token, ships one
		// interval timer per card, and left every assertion above green
		// (`@test-writer` H-3, demonstrated rather than argued).
		//
		// An import allowlist cannot be routed around that way: whatever the new
		// module is called, importing it reddens this. Structural beats
		// procedural (O-1), and the repo already does exactly this at
		// `tests/unit/staging/generator-no-direct-writes.test.ts`, whose
		// allowlist AGENTS.md §9 records as "a decision, not an edit".
		//
		// ⚠ IT ALSO SUBSUMES THE DEPENDENCY WALL. A date library cannot reach the
		// string without being imported by one of these two files, so this holds
		// even for a library nobody thought to name in the denylist below.
		const importsOf = (rel: string) =>
			[...code(rel).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).sort();

		expect(
			importsOf(LEAF),
			"the leaf imports outside its ratified set",
		).toEqual(["@/lib/relative-time", "@/lib/utils"]);
		expect(
			importsOf(FORMATTER),
			"the formatter imports anything at all — it is arithmetic on two integers",
		).toEqual([]);

		// ⚠ THIS IS A STATIC-NAMED-IMPORT ALLOWLIST, not a dependency allowlist:
		// `importsOf` matches `from "…"`, so a side-effect import or a dynamic
		// one is invisible to it (`@test-writer` NEW-6). Neither can hand a React
		// hook to a synchronous component body, so exploitability is low — but
		// "low" is not "none", and both spellings are two cheap assertions.
		for (const rel of [LEAF, FORMATTER]) {
			expect(code(rel), `${rel} carries a dynamic import`).not.toMatch(
				/\bimport\s*\(/,
			);
			expect(code(rel), `${rel} carries a side-effect import`).not.toMatch(
				/^\s*import\s+"[^"]+";/m,
			);
		}

		// POSITIVE CONTROL — the matcher must actually find imports somewhere, or
		// an empty result would satisfy the formatter assertion vacuously.
		expect(importsOf(ARGPROFILE).length).toBeGreaterThan(3);
		expect(importsOf(ARGPROFILE)).toContain("@/components/ui/relative-time");
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
			"humanize-duration",
			"@internationalized/date",
			"relative-time-format",
		]) {
			expect(pkg, `${lib} was added as a dependency`).not.toContain(`"${lib}`);
		}
		// Positive control — the file really is package.json and really is read.
		expect(pkg).toContain('"decimal.js"');
	});

	it("relative-time::no-feature-file-pins-itself-to-the-client-graph", () => {
		// ⛔⛔ RENAMED, AND THE OLD NAME WAS A CLAIM THAT IS NOT TRUE. This was
		// `the-cards-did-not-become-client-components`, justified as "marking
		// either card `use client` would convert a whole server-rendered card
		// tree". **Both cards are ALREADY client components** and were before
		// this branch existed — `HeroPanels` is imported only by
		// `discovery/DiscoveryCarousel.tsx` and `ArgumentList` only by
		// `profile/ProfileArena.tsx`, and both of those are `"use client"` on
		// line 1 (`@code-reviewer` C-1/H-2). A guard whose NAME asserts something
		// false teaches the wrong model to everyone who reads it, which is worse
		// than a guard that is merely redundant.
		//
		// ⚠ THE ASSERTION IS KEPT, because what it actually pins is still worth
		// pinning: these three files carry NO directive, so each compiles into
		// whichever graph imports it. That is what makes a `ui/` primitive
		// shareable — the shape `debate/badges.tsx` already has — and it is
		// cheap insurance for the day a host stops being a client entry point.
		// It pins a PROPERTY OF THESE FILES; it does not pin a bundle outcome.
		//
		// ⚠⚠ ASSERTED OVER THE WHOLE FILE, NOT LINE 1, AND THE FIRST VERSION READ
		// LINE 1. A directive preceded by a comment is still a valid directive,
		// and FOUR files in this repo already ship exactly that shape — SPDX on
		// line 1, `"use client"` on line 2 (`app/global-error.tsx`, and the three
		// route `error.tsx` boundaries, which Next.js REQUIRES to be client
		// components). So the shape is not hypothetical, it is the house style
		// one directory over, and CLAUDE.md O-8 already records a ratified SPDX
		// sweep that moves every directive to `:2`. A line-1 read would have gone
		// silently blind on the day that lands (`@test-writer` H-1).
		//
		// Comments are stripped first, so a docblock DISCUSSING the directive —
		// as the leaf's does at length — is not mistaken for one.
		for (const rel of [HERO, ARGLIST, LEAF]) {
			expect(
				code(rel),
				`${rel} pinned itself to the client graph — it is a shared module and should carry no directive`,
			).not.toContain("use client");
		}
		// POSITIVE CONTROLS: the same read against a file that IS one, and the
		// raw/stripped pair proving the stripping is not what makes it pass.
		expect(code("src/components/debate/PostCard.tsx")).toContain("use client");
		expect(read(LEAF)).toContain("use client");
	});

	it("relative-time::ONE-formatter-and-ONE-leaf-serve-every-surface", () => {
		// A formatter re-implemented per surface is four things that can disagree
		// about where a bucket edge falls.
		//
		// ⚠⚠ SCANNED OVER THE WHOLE TREE, NOT A HARD-CODED FIVE-FILE LIST. The
		// first version iterated a literal array, so a mount written into any
		// file NOT in that array was invisible — including one on `ReplyCard`'s
		// REMOVED branch, which compiles (every removed variant carries
		// `createdAt`) and which plan A5 forbids. A closed inventory that cannot
		// see outside itself is not an inventory (`@test-writer` M-3).
		const tree = readdirSync(join(ROOT, "src"), {
			recursive: true,
			withFileTypes: true,
		})
			.filter(
				(e) =>
					e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".tsx")),
			)
			.map((e) => join(e.parentPath, e.name).replace(`${ROOT}/`, ""));

		// Alive check — a scan that silently matched nothing passes every
		// assertion below vacuously.
		expect(tree.length).toBeGreaterThanOrEqual(200);
		expect(tree).toContain(LEAF);

		const importing = (needle: string) =>
			tree.filter((rel) => code(rel).includes(needle)).sort();

		expect(
			importing("@/lib/relative-time"),
			"the formatter is imported outside the leaf",
		).toEqual([LEAF]);
		expect(
			importing("@/components/ui/relative-time"),
			"the leaf is mounted outside the three ratified identity rows",
		).toEqual([ARGPROFILE, ARGLIST, HERO].sort());

		// EXACTLY ONE MOUNT PER FILE, counted over the whole tree rather than
		// over three names — this is what catches a second mount added to a
		// removed-variant branch in a file the list above happens to cover.
		const mountSites = tree.flatMap((rel) => {
			const mounts =
				code(rel).match(/<RelativeTime\b[\s\S]*?(?:\/>|<\/RelativeTime>)/g) ??
				[];
			return mounts.map((m) => ({ rel, m }));
		});
		expect(mountSites.map((s) => s.rel).sort()).toEqual(
			[ARGPROFILE, ARGLIST, HERO].sort(),
		);
		// …and no mount overrides the treatment. `className` on this leaf is for
		// SIZE; a colour passed there would silently defeat "one treatment".
		for (const { rel, m } of mountSites) {
			expect(m, `${rel}: a colour was passed to the leaf`).not.toMatch(
				/text-(n[0-7]|ink|muted|yes|no)\b/,
			);
		}
	});

	it("relative-time::the-hydration-suppression-is-not-silently-droppable", () => {
		// `suppressHydrationWarning` renders NO attribute, so nothing in the DOM
		// can see it and removing it is invisible to every other assertion here
		// (`@test-writer` L-2). Pinned in source so that dropping it is a
		// decision rather than an accident.
		//
		// ⛔ IT IS LOAD-BEARING ON EVERY SURFACE, not just market detail. All
		// three cards are client-by-import, so the leaf SSRs and then hydrates
		// on all three, and two clocks a second apart can land either side of a
		// bucket edge anywhere. This comment previously said "market detail" —
		// which would have told a later reader that Discovery and Profile could
		// safely drop it (`@code-reviewer` H-1).
		expect(code(LEAF)).toContain("suppressHydrationWarning");
	});
});
