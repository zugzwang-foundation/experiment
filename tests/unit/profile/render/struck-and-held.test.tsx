// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArgumentList } from "@/components/profile/ArgumentList";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { PositionsTable } from "@/components/profile/PositionsTable";
import type { ProfileArgumentItem } from "@/server/profile/arguments";
import type { ProfilePositionRow } from "@/server/profile/positions";
import type { ProfileUser } from "@/server/profile/resolve";
import type { ProfileTiles as ProfileTilesData } from "@/server/profile/tiles";

/**
 * HTML-FINISH · PROFILE — THE HELD AND THE STRUCK, guarded as ABSENCES.
 *
 * ⚠ WHY NEGATIVE TESTS AT ALL. Rows 9 and 11 are HELD and recon tables A/B/C/D
 * ship NOTHING, but the mockup they were measured against is still on disk and
 * still shows every one of them. The next reader to open
 * `surface_profile_v1_0.html` beside this surface sees a replica panel, a
 * visitor "Open" button, a download icon, a `+` affordance and an inline P/L —
 * and none of the reasons they were struck. Good intentions are not a control;
 * these are.
 *
 * ⚠⚠ EVERY NEGATIVE ASSERTION HERE CARRIES A POSITIVE CONTROL, AND THAT IS THE
 * POINT OF THE FILE. An `expect(html).not.toContain(x)` that has never been run
 * against an `html` containing `x` proves only that the test agrees with
 * itself: it is indistinguishable from a detector that CANNOT fire. Each row
 * below therefore ships a `detect` predicate plus a `control` string that
 * DOES contain the struck thing, and the second `it.each` runs the SAME
 * predicate over the control and requires it to fire.
 *
 * ⛔ NO ROW HERE IS SOURCED FROM MOCKUP LINES 203, 690 OR 762-771 — bookmark
 * mode is POLISH.6's, a live parallel task. The D-table guard below asserts the
 * ABSENCE of that mode's markers on THIS surface, which is the opposite of
 * building it.
 *
 * Fixtures are INLINE plain objects on the shipped `src/server/profile/*` DTOs.
 * No market content is invented (CLAUDE.md §3).
 */

afterEach(cleanup);

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const M1 = "0190c0de-aaaa-7000-8000-000000000001";
const C_OPENER = "0190c0de-ffff-7000-8000-000000000044";

const USER: ProfileUser = {
	id: "0190c0de-1111-7000-8000-0000000000f1",
	pseudonym: "RedFox001",
	banned: false,
	pfpUrl: "/pfp-placeholder.svg",
};

const TILES: ProfileTilesData = {
	walletValue: "500.000000000000000000",
	positionsValue: "120.000000000000000000",
	netProfitLoss: "-30.000000000000000000",
	argumentsCount: { total: 5, posts: 3, replies: 2 },
	supportReceived: "40.000000000000000000",
	counterReceived: "12.000000000000000000",
};

const ROW_OPEN: ProfilePositionRow = {
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
		isReply: true,
		postOrdinal: 1,
		marketSlug: "fixture-alpha",
		repliedToTitle: "Parent argument gamma",
	},
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
	priceAtBet: "0.270000000000000000",
	createdAt: "2026-07-01T00:00:00.000Z",
	aggregate: {
		supportCount: 3,
		counterCount: 1,
		supportDharma: "300.000000000000000000",
		counterDharma: "100.000000000000000000",
	},
};

/**
 * The whole participant surface's markup, as ONE string — every component the
 * profile route renders, in both viewer arms.
 *
 * ⚠ `innerHTML`, NEVER `textContent` (O-7). Half of what is struck here is an
 * ELEMENT — an icon button, a placeholder panel, a selection outline — and
 * `textContent` flattens exactly the markup that carries it. A `textContent`
 * detector for the A-3 download icon would pass on a page that renders it,
 * because the icon has no text.
 */
function surfaceHtml(): string {
	const owner = render(
		<>
			<IdentityCard user={USER} owner={true} tiles={TILES} />
			<PositionsTable
				payload={{ owner: true, rows: [{ ...ROW_OPEN, sellEligible: true }] }}
			/>
			<ArgumentList items={[POST]} owner={true} author={USER} />
		</>,
	);
	const ownerHtml = owner.container.innerHTML;
	owner.unmount();

	const visitor = render(
		<>
			<IdentityCard user={USER} owner={false} tiles={TILES} />
			<PositionsTable payload={{ owner: false, rows: [ROW_OPEN] }} />
			<ArgumentList items={[POST]} owner={false} author={USER} />
		</>,
	);
	const visitorHtml = visitor.container.innerHTML;
	visitor.unmount();

	return `${ownerHtml}\n${visitorHtml}`;
}

/** The profile route's own source, for the rows whose creep would be a SOURCE
 * change rather than a rendered node (the harness bridge, the demo array). */
function surfaceSource(): string {
	return [
		"src/app/(public)/u/[pseudonym]/page.tsx",
		"src/components/profile/IdentityCard.tsx",
		"src/components/profile/PositionsTable.tsx",
		"src/components/profile/ArgumentList.tsx",
		"src/components/profile/ProfileTiles.tsx",
		"src/components/profile/states.tsx",
	]
		.map(read)
		.join("\n");
}

type StruckRow = {
	/** The recon id, so a failure names the ruling rather than the symptom. */
	id: string;
	/** One line: what is struck, and by what. */
	why: string;
	/** Fires when the struck thing is present. Runs over rendered HTML. */
	detect: (html: string) => boolean;
	/**
	 * A fragment that DOES contain the struck thing. The second `it.each` runs
	 * `detect` over this and requires `true` — the proof the detector can fire.
	 */
	control: string;
};

/**
 * ⚠⚠ PROFILE-FULL — ROW 9 HAS LEFT THIS REGISTRY, AND IT LEFT BY BEING BUILT.
 *
 * It read: "row 9 — inline per-holding P/L · HELD. POLISH-5.md:1429 `P5-D16` —
 * OUT (D24): row P/L needs a SPEC.1 §10.8 amendment first." That hold was
 * PRECISE, not bureaucratic: §10.8 admits displayed-space aggregate identities as
 * its "sole exception" and then CLOSED the list — "Two such identities exist" —
 * so a per-row delta derived from the two displayed figures beside it would have
 * been a third identity the spec did not name.
 *
 * ⇒ THE AMENDMENT LANDED IN THE SAME COMMIT AS THE ROW (SPEC.1 1.0.33, §10.8 now
 * reads **three**), which is what the hold was waiting for. So the row is no
 * longer held, and a registry entry asserting its ABSENCE would now be asserting
 * against the spec — the exact inversion this file exists to prevent in the other
 * direction. It is deleted rather than doctored, and the positive coverage moved
 * to `arrangement.test.tsx`'s `itemD` pins, which assert the rendered cell string
 * EXACTLY (`Đ 31(+Đ6)`, `Đ 3,226(−Đ11,034)`) including sign and grouping.
 *
 * ⛔ NOTHING ELSE IN THIS REGISTRY MOVED. Row 11 and every A/B/C/D row below are
 * untouched: they are struck on SPEC.1 §23 READINGS, not on a missing amendment,
 * and no ruling this round touched them.
 */
const STRUCK: StruckRow[] = [
	{
		id: "row 11 — a control that opens the full argument",
		why: "HELD. Duplicate-of-known PD-0-01; the mockup's `+` SHAPE is separately struck at A-6.",
		detect: (h) =>
			/aria-label="(Show full argument|Read more|Full)"/.test(h) ||
			/>\s*Read more\s*</.test(h),
		control: '<button aria-label="Show full argument">+</button>',
	},
	{
		id: "A-1 — the selection-bound argument REPLICA",
		why: "STRUCK on tier 1. SPEC.1 §23 enumerates 'the argument list' and rules its §3.6 viewer-independent order; a selection-bound panel has neither.",
		// The replica reading's tells: the empty-state placeholder copy and the
		// row-selection outline (`.prow.sel`, `:277`).
		detect: (h) =>
			/Select a position/i.test(h) || /class="[^"]*\bsel\b[^"]*"/.test(h),
		control:
			'<div class="rempty">Select a position to read its argument.</div>',
	},
	{
		id: "A-2 — a visitor-only 'Open' button in the Sell slot",
		why: "STRUCK on tier 1. SPEC.1 §23 payload law: the owner's ONLY deltas are Sell and Daily-Credit history; F-PROF-3 'Owner render = visitor render + Sell'. A visitor-only control is a third delta and inverts that.",
		// ⚠ THE SECOND DISJUNCT EXCLUDES THE STATUS SEGMENT BY TESTID, and that
		// exclusion is DISCRIMINATION, not a relaxation. Row 7b's segmented pair
		// ships a ratified button reading exactly `Open` (canon §6: filters
		// `Open`/`Closed`), so a bare `>Open</button>` detector fires on the
		// build's OWN correct control — and it DID. That is one of the two
		// detector bugs the positive controls below caught. The struck thing is a
		// per-ROW action in the Sell slot; the filter is a panel-header control.
		detect: (h) =>
			/\bopenrow\b/.test(h) ||
			/<button(?![^>]*data-testid="positions-status-)[^>]*>\s*Open\s*<\/button>/.test(
				h,
			),
		control: '<button class="openrow">Open</button>',
	},
	{
		id: "A-3 — the headzone 'Download profile card' icon",
		why: "STRUCK. W2.13 R2 (FINAL): remove it; R3 — the profile-card JPEG is permanently CUT, not deferred. KEEP the bookmark icon.",
		detect: (h) => /aria-label="Download profile card"/.test(h),
		control: '<button aria-label="Download profile card"></button>',
	},
	{
		id: "A-4 — `Đ staked → Đ current` on the argument card head",
		why: "STRUCK (the `→ current` half). POLISH-5.md:236 `D21` strikes it; Đb is a property of a holding, not of a comment. The stake half ships.",
		// The arrow BETWEEN two Đ figures — U+2192, the byte the mockup uses at
		// `:626`. ⛔ Not a bare `→` search: row 14's positions arrow is a
		// legitimate U+2192 on this same surface, and a naive detector would fire
		// on it and be silenced by weakening the rule.
		detect: (h) => /Đ[^<]*<[^>]*>\s*→\s*<\/[^>]*>\s*Đ/.test(h),
		control: 'Đ 240 <span class="arrow">→</span> Đ 310',
	},
	{
		id: "A-6 — a `+` icon button as the full-argument affordance",
		why: "STRUCK as to the control's SHAPE. PD-0-01: `<Plus /> Full` where CD-A ratified 'Read more'. The affordance itself is row 11, which is HELD.",
		detect: (h) => /<button[^>]*>\s*\+\s*<\/button>/.test(h),
		control: '<button class="plus">+</button>',
	},
	{
		id: "A-7 — removing the 'Replied to …' line from the positions cell",
		why: "STRUCK on tier 1. SPEC.1 §23: 'for reply-bets — the parent post reference'. The line is REQUIRED, so this row guards a PRESENCE.",
		// ⚠ INVERTED: the struck thing is the REMOVAL, so the detector fires when
		// the line is MISSING. Written this way rather than dropped, because "the
		// mockup does not show it" is exactly the argument that would delete it.
		detect: (h) => !/Replied to/.test(h),
		control: "<span>a positions cell with no parent reference</span>",
	},
	{
		id: "A-8 — dropping the per-row status token on open rows",
		why: "STRUCK on the sentence as written. SPEC.1 §23: 'status Open / Closed by market state'. Also a PRESENCE guard.",
		detect: (h) => !/data-testid="position-status-/.test(h),
		control: "<tr><td>a row with no status badge</td></tr>",
	},
	{
		id: "A-9 — the headzone bookmark icon shown to every viewer",
		why: "STRUCK. Founder ruling 2026-07-31: OWNER-ONLY — it is navigation to the viewer's OWN private saved set.",
		// The surface string carries the OWNER arm then the VISITOR arm, so
		// exactly ONE bookmark link may appear across the pair.
		detect: (h) => (h.match(/aria-label="Bookmarks"/g) ?? []).length !== 1,
		control: '<a aria-label="Bookmarks"></a><a aria-label="Bookmarks"></a>',
	},
	{
		id: "B-1 — entry % / live % under the Staked and Current figures",
		why: "NOT LAYOUT WORK. `ProfilePositionRow` carries neither an entry price nor a live price; no arrangement can render them.",
		// The mockup's `.pnum .sub` — a bare percentage directly under a Đ figure.
		// ⛔ Not a bare `%` search: the side chip legitimately renders `YES @ 27%`.
		detect: (h) => /<span class="sub">\d+%<\/span>/.test(h),
		control: '<span class="pnum">Đ 240<span class="sub">31%</span></span>',
	},
	{
		id: "B-3 — the parent AUTHOR's pseudonym in the reply footer",
		why: "NOT LAYOUT WORK. `ProfileArgumentItem`/`ProfileArgumentCell` carry `repliedToTitle` only; the parent's author is not on either DTO.",
		detect: (h) => /Replied to [^<]*'s argument/.test(h),
		control: "Replied to marble-crane-15's argument — “parent”",
	},
];

/** Harness and bookmark-mode markers — creep that would be a SOURCE change. */
const HARNESS: StruckRow[] = [
	{
		id: "C-2 — the `V` owner/visitor demo hotkey",
		why: "HARNESS. Canon §5 names it a DEMO hotkey; production owner detection is a session comparison in page.tsx.",
		detect: (s) => /key\s*===\s*["']v["']/i.test(s),
		control: 'if (e.key === "v") { toggleVisitor(); }',
	},
	{
		id: "C-3 — the `parent.postMessage` integration-shell bridge",
		why: "HARNESS. Iframe-host plumbing; canon §8 keeps the integration shell PK-only by rule.",
		detect: (s) => /parent\.postMessage/.test(s),
		control: "parent.postMessage({ zz: 1, type: 'nav' }, '*');",
	},
	{
		id: "C-4 — the `ROWS` demo array / the `ashen` stand-in",
		why: "HARNESS. The mockup says so itself at :716-717; in production each position carries its own post id.",
		detect: (s) => /\bashen\b/.test(s),
		control: "nav('market','reply','ashen');",
	},
	{
		id: "D — bookmark mode (mockup :203, :690, :762-771)",
		why: "POLISH.6 OWNS EVERY LINE. C-BOOKMARKS-1 forked /bookmarks away from mockup governance, and POLISH.6 is a LIVE PARALLEL TASK.",
		// The mode is delimited by a runtime `bookmarks` body class and a
		// `setsub:'bookmark'` postMessage arm. Neither may appear on this surface.
		// ⚠ THE FIRST DRAFT OF THIS DETECTOR COULD NOT FIRE AT ALL — it looked for
		// `classList.add("bookmarks")` while the mockup's own line reads
		// `classList.contains('bookmarks')`, and its positive control caught that.
		// It is the second of the two detector bugs this file's controls found,
		// and it is the more dangerous kind: an absence assertion that would have
		// stayed green through an actual bookmark-mode leak.
		// ⛔ It must NOT fire on `href="/bookmarks"` or `aria-label="Bookmarks"` —
		// the RATIFIED owner-only bookmark LINK (A-9), which is navigation, not a
		// mode. Anchoring on a classList CALL is what keeps the two apart.
		detect: (s) =>
			/setsub|classList\.(?:add|contains|toggle|remove)\(\s*["'`]bookmarks["'`]/.test(
				s,
			),
		control: "if (document.body.classList.contains('bookmarks')) return;",
	},
];

describe("HTML-FINISH profile — the HELD and STRUCK rows stay absent", () => {
	it.each(STRUCK)("$id is absent from the rendered surface", ({
		detect,
		why,
	}) => {
		expect(
			detect(surfaceHtml()),
			`${why}\nIt is present on the rendered profile. If a ruling has changed, ` +
				`change the RULING and this guard together — never this guard alone.`,
		).toBe(false);
	});

	it.each(HARNESS)("$id is absent from the profile source", ({
		detect,
		why,
	}) => {
		expect(
			detect(surfaceSource()),
			`${why}\nIt has appeared in the profile's own source.`,
		).toBe(false);
	});

	/**
	 * ⚠⚠ THE PROOF THE DETECTORS CAN FIRE. Without this, every assertion above
	 * is a claim about a predicate that has never been observed to be true, and a
	 * detector with a typo'd class name, a wrong Unicode escape or an
	 * over-anchored regex passes all of them while seeing nothing.
	 *
	 * ⚠ THEY CAUGHT TWO REAL DETECTOR BUGS ON THE FIRST RUN, one in each
	 * direction, and both are recorded at their rows rather than quietly fixed:
	 *
	 *   A-2 was OVER-BROAD — a bare `>Open</button>` fired on row 7b's ratified
	 *   status segment, i.e. the guard reported the build's own correct control
	 *   as a struck one. Narrowed to exclude that testid.
	 *
	 *   D was UNDER-BROAD TO THE POINT OF BEING INERT — it looked for
	 *   `classList.add("bookmarks")` while the mockup's line is
	 *   `classList.contains('bookmarks')`, so it could not fire on anything.
	 *   That is the dangerous kind: green through an actual leak. Broadened to
	 *   any classList call on the class, still excluding the ratified
	 *   `href="/bookmarks"` link.
	 */
	it.each([
		...STRUCK,
		...HARNESS,
	])("$id — POSITIVE CONTROL: the detector fires on a fragment that contains it", ({
		detect,
		control,
		id,
	}) => {
		expect(
			detect(control),
			`The detector for "${id}" did NOT fire on a fragment that contains ` +
				`the struck thing. The absence assertion above is therefore ` +
				`asserting nothing.`,
		).toBe(true);
	});
});
