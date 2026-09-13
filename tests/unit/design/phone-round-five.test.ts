import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOBILE-2e — the round-five refinements, pinned where jsdom cannot see them.
 *
 * ⚠ SOURCE SCANS, and the reason is the usual one: every claim below is about a
 * `max-mobile:` declaration, jsdom performs no layout and never resolves a media
 * query, so the only thing a render test could observe here is the desktop
 * branch. The behavioural half of each item is a browser measurement and lives
 * in the run log; what is pinned here is the set of declarations that produces
 * it. ⛔ FENCE BY SYMBOL, NEVER BY LINE — and never by a character window
 * either, which is the same fence in a different unit (O-8). Everything below
 * anchors on a `data-testid`, a prop name or a class literal.
 *
 * ⛔⛔ THE VARIANT IS ASSEMBLED AT RUNTIME AND NEVER WRITTEN AS A LITERAL.
 * Tailwind v4's source detection scans `tests/` as well as `src/` and `docs/`,
 * so a class-shaped string in a guard EMITS that utility into the built
 * stylesheet — which makes any later "did my class compile?" check on the built
 * sheet self-fulfilling, and leaves utilities in production whose only origin is
 * a test file. `profile-mobile-reflow.test.ts:112-115` is the precedent and
 * carries the measurement.
 */

const ROOT = process.cwd();
const V = "max-mobile";
const S = ":";
/** `phone("h-8")` → the phone-tier spelling of `h-8`, never a scannable token. */
const phone = (utility: string) => `${V}${S}${utility}`;

/**
 * The pill's anchor, as a PREFIX of its `data-testid` expression.
 *
 * ⚠ The full expression is `data-testid={\`card-trigger-$\{relation}\`}`, and
 * writing that literally makes Biome's `noTemplateCurlyInString` fire on a
 * string that is CORRECTLY a placeholder — it is source text being searched
 * for, not a template that forgot its backticks. The prefix is unique in the
 * file and carries no `$\{`, so the anchor is exact and the lint has nothing
 * to object to.
 */
const PILL_ANCHOR = "data-testid={`card-trigger-";

const COMPOSER = "src/components/debate/composer/BetComposer.tsx";
const FOOTER = "src/components/debate/AggregateFooter.tsx";
const ARGPROFILE = "src/components/debate/ArgProfile.tsx";
const INFOTIP = "src/components/ui/info-tip.tsx";
const SHEET = "src/components/profile/phone/PhoneSellSheet.tsx";
const TABLE = "src/components/profile/PositionsTable.tsx";
const ARGLIST = "src/components/profile/ArgumentList.tsx";
const TILES = "src/components/profile/ProfileTiles.tsx";
const IDCARD = "src/components/profile/IdentityCard.tsx";
const THIRDS = "src/components/profile/row-thirds.ts";

const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/**
 * Comments stripped, LINE COUNT PRESERVED, before every negative scan.
 *
 * ⛔ Six previous negative source scans in this repository matched the COMMENT
 * explaining the absence rather than the code, and this run added a seventh: a
 * docblock here said "jsdom has no `matchMedia`" and reddened a guard whose
 * whole subject was that the file must not reach for one.
 */
function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat(m.split("\n").length - 1))
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** The class tokens of the element carrying `anchor`, walking to its className. */
function classTokensAfter(source: string, anchor: string, what: string) {
	const at = source.indexOf(anchor);
	if (at === -1) {
		throw new Error(
			`${what}: anchor ${anchor} not found — re-derive the fence`,
		);
	}
	const m =
		/className=(?:"([^"]*)"|\{`([^`]*)`|\{cn\(\s*(?:\/\/[^\n]*\n\s*)*"([^"]*)")/.exec(
			source.slice(at),
		);
	const cls = m?.[1] ?? m?.[2] ?? m?.[3];
	if (cls === undefined) {
		throw new Error(`${what}: no className found after ${anchor}`);
	}
	return cls.split(/\s+/).filter(Boolean);
}

describe("MOBILE-2e — the guards fire at all (positive controls first)", () => {
	it("round5::guard-is-alive", () => {
		// ⛔ Every rule below is a `toContain` or a `not.toContain` over a file
		// read from disk. A missing file throws, but a RENAMED one would leave an
		// empty corpus that satisfies half of them silently. Read them all first.
		for (const f of [
			COMPOSER,
			FOOTER,
			ARGPROFILE,
			INFOTIP,
			SHEET,
			TABLE,
			ARGLIST,
			TILES,
			IDCARD,
			THIRDS,
		]) {
			expect(read(f).length, `${f} is empty or missing`).toBeGreaterThan(500);
		}
	});

	it("round5::the-recognisers-fire", () => {
		// The variant assembler, the comment stripper and the class reader, each
		// proven on a shape it must accept and a shape it must reject.
		expect(phone("h-8")).toBe(`${V}${S}h-8`);
		const withComment = `a\n// ${phone("h-8")} in prose\nb`;
		expect(stripComments(withComment)).not.toContain(phone("h-8"));
		expect(stripComments(withComment).split("\n")).toHaveLength(3);
		const markup = `<div data-testid="x" className="a b c">`;
		expect(classTokensAfter(markup, 'data-testid="x"', "control")).toEqual([
			"a",
			"b",
			"c",
		]);
		expect(() => classTokensAfter(markup, "nope", "control")).toThrow();
	});
});

describe("R-M1 — the composer's submit is the phone's primary, and its disabled state is SOLID", () => {
	it("round5::the-submit-wears-the-bottom-bar-s-primary-below-640", () => {
		const source = stripComments(read(COMPOSER));
		const cls = classTokensAfter(
			source,
			"aria-label={COMPOSER_COPY.submit}",
			"the composer's submit",
		);
		const why =
			`${COMPOSER}: the submit no longer matches the phone's primary. It is ` +
			`the same action as the bottom bar's BET button one layer in, so it ` +
			`takes the same fill, the same text colour and the same 52px the ruling ` +
			`names — and it drops the hairline, because on a filled button the fill ` +
			`IS the edge.`;
		expect(cls, why).toContain(phone("h-[52px]"));
		expect(cls, why).toContain(phone("bg-ink"));
		expect(cls, why).toContain(phone("text-ground"));
		expect(cls, why).toContain(phone("[border:none]"));
		expect(cls, why).toContain(phone("uppercase"));
		expect(cls, why).toContain(phone("tracking-[0.06em]"));
		// ⛔ The desktop floor the shipped guard reads must survive underneath it.
		expect(cls, "the base h-auto / min-h floor is gone").toContain("h-auto");
		expect(cls.some((c) => /^min-h-\[\d+px\]$/.test(c))).toBe(true);
	});

	it("round5::the-DISABLED-submit-is-a-solid-dim-fill-and-not-a-ghost", () => {
		const source = stripComments(read(COMPOSER));
		const cls = classTokensAfter(
			source,
			"aria-label={COMPOSER_COPY.submit}",
			"the composer's submit",
		);
		const why =
			`${COMPOSER}: the disabled submit is back to the canon's 50% opacity. ` +
			`On a phone that dims a WHITE fill over a near-black ground to mid-grey ` +
			`with mid-grey text — the hollow reading the enabled fix removed, ` +
			`arriving from the other end. The ruling is a SOLID dim fill from the ` +
			`neutral ramp with muted text.`;
		expect(cls, why).toContain(phone("disabled:bg-n2"));
		expect(cls, why).toContain(phone("disabled:text-n6"));
		expect(cls, why).toContain(phone("disabled:opacity-100"));
		// ⛔ And the opacity cancel is PHONE-SCOPED. Unprefixed it would change the
		// desktop's disabled treatment, which is canon and not this task's.
		expect(
			cls,
			"the opacity cancel escaped its variant and now reaches the desktop",
		).not.toContain("disabled:opacity-100");
	});

	it("round5::the-label-is-ONE-LINE-on-a-phone-and-both-halves-carry-the-bar-s-weight", () => {
		const source = stripComments(read(COMPOSER));
		const why =
			`${COMPOSER}: the phone label is no longer one line at the bar's weight. ` +
			`The button is a column on the desktop (a narrow control beside the ` +
			`amount card) and a row on the phone, where it is full width; both spans ` +
			`take the bar's 800 so the two halves read as one string.`;
		expect(source, why).toContain(phone("flex-row"));
		expect(source, why).toContain(phone("items-center"));
		// Both label spans carry the phone weight — two occurrences, not one.
		const weights =
			source.match(new RegExp(phone("font-extrabold"), "g")) ?? [];
		expect(weights.length, why).toBeGreaterThanOrEqual(2);
		// ⛔ The accessible name is the whole phrase and a dozen tests bind it.
		expect(source).toContain("aria-label={COMPOSER_COPY.submit}");
	});
});

describe("R-M2 — the split bar is 32/6 on a phone, and the tap area is a pseudo-element", () => {
	it("round5::the-pill-is-32px-and-buys-44-back-with-an-inset-after", () => {
		const source = stripComments(read(FOOTER));
		const cls = classTokensAfter(
			source,
			PILL_ANCHOR,
			"the Support/Counter pill",
		);
		const why =
			`${FOOTER}: the phone pill is not the ruled 32px with a transparent 44px ` +
			`hit area. The painted box is 32 and the ::after is inset 6px above and ` +
			`below — 32 + 6 + 6 = 44 exactly — which is why the extension is a ` +
			`pseudo-element and not a handler: it widens the element's own hit ` +
			`region at the hit-testing layer, so nothing listens and nothing is ` +
			`prevented.`;
		expect(cls, why).toContain(phone("h-8"));
		expect(cls, why).toContain(phone("relative"));
		expect(cls, why).toContain(phone("after:absolute"));
		expect(cls, why).toContain(phone("after:inset-x-0"));
		expect(cls, why).toContain(phone("after:-top-2"));
		expect(cls, why).toContain(phone("after:-bottom-1"));
		expect(cls, why).toContain(phone("after:content-['']"));
		// ⛔ THE ARITHMETIC, DERIVED FROM THE TOKENS RATHER THAN ASSERTED BESIDE
		// THEM. On Tailwind's 4px scale `h-8` is 32px, `-top-2` is 8 and
		// `-bottom-1` is 4 — so a future edit to any of the three has to keep the
		// sum at the 44 a finger needs.
		// ⚠ THE ASYMMETRY IS PART OF THE ASSERTION, not a detail: a symmetric 6/6
		// sums to 44 too and reaches 2px past the `Đ n` figure 4px below, so a tap
		// on that figure opens a reply composer on a side nobody chose.
		// ⛔⛔ THESE THREE NUMBERS ARE READ OFF THE TOKENS. They used to be typed
		// here as `8 * 4`, `2 * 4`, `1 * 4` — constants folded from literals in the
		// test, which makes the sum a tautology that cannot fail whatever the
		// source says. `@test-writer` named it: changing `h-8` to `h-10` reds the
		// `toContain` above and never this. A derived number is only derived if it
		// comes from the thing it is about.
		const step = (token: string | undefined): number => {
			const m = /-(\d+(?:\.\d+)?)$/.exec(token ?? "");
			if (m === null) {
				throw new Error(`no Tailwind step in ${token} — re-derive the fence`);
			}
			return Number(m[1]) * 4;
		};
		const height = step(cls.find((t) => t.startsWith(phone("h-"))));
		const up = step(cls.find((t) => t.startsWith(phone("after:-top-"))));
		const down = step(cls.find((t) => t.startsWith(phone("after:-bottom-"))));
		expect(
			height + up + down,
			`the hit area no longer reaches 44px: ${height} + ${up} + ${down}`,
		).toBe(44);
		expect(
			down,
			"the downward extension reaches past the figure below it",
		).toBeLessThanOrEqual(4);
		// ⛔ AND THE EXTENSION MUST STAY HIT-TESTABLE. Adding
		// `after:pointer-events-none` paints the same rectangle and takes no taps —
		// the target silently collapses back to the 32px box with all six token
		// assertions above still passing. Measured GREEN across the unit suite
		// before this line existed. ⚠ Assembled, never written: a literal here is a
		// real utility in the built sheet.
		const INERT = `after:${["pointer", "events", "none"].join("-")}`;
		expect(
			cls.filter((t) => t.includes(INERT)),
			"the 44px extension paints but cannot be tapped",
		).toEqual([]);
	});

	it("round5::the-44px-MIN-HEIGHT-is-gone-because-it-is-what-broke-the-line", () => {
		const source = stripComments(read(FOOTER));
		const cls = classTokensAfter(
			source,
			PILL_ANCHOR,
			"the Support/Counter pill",
		);
		expect(
			cls,
			`${FOOTER}: the pill is back to a 44px PAINTED height. That is what put ` +
				`the two flank figures 20px below the centre one — each is the second ` +
				`child of its own column, and the track's alignment box stayed at 24. ` +
				`The tap target comes from the ::after now.`,
		).not.toContain(phone("min-h-11"));
	});

	it("round5::the-track-and-its-alignment-box-move-TOGETHER", () => {
		const source = stripComments(read(FOOTER));
		// ⛔ OVN-V5 — THE BOX IS FOUND BY WALKING BACK FROM THE TRACK'S OWN TESTID,
		// never by its class string. This row first anchored on
		// `'<span className="flex h-6 w-full items-center'`, which is selecting the
		// thing under test BY THE VERY DECLARATION it asserts: change `h-6` and the
		// anchor stops matching, the reader throws, and the failure reads as "the
		// bar was restructured" rather than "the box moved". Worse, any sibling
		// that grew the same three tokens would silently re-point it.
		const trackAt = source.indexOf('data-testid="aggregate-split-track"');
		expect(trackAt, "the split track is gone").toBeGreaterThan(-1);
		const ownTag = source.lastIndexOf("<span", trackAt);
		const wrapperTag = source.lastIndexOf("<span", ownTag - 1);
		const boxCls =
			/className="([^"]*)"/.exec(source.slice(wrapperTag, ownTag))?.[1] ?? "";
		expect(
			boxCls,
			"no readable className on the element wrapping the track",
		).not.toBe("");
		const box = boxCls.split(/\s+/).filter(Boolean);
		const track = classTokensAfter(
			source,
			'data-testid="aggregate-split-track"',
			"the split track",
		);
		const why =
			`${FOOTER}: the track's alignment box and the pill have come apart at ` +
			`phone width. The box exists to put the track's CENTRE on the pill's ` +
			`centre; a box frozen at 24 beside a 32px pill puts the bar 4px high — ` +
			`the same class of defect CS6 measured at 9.5px, one third the size and ` +
			`just as invisible in a source scan.`;
		expect(box, why).toContain(phone("h-8"));
		expect(box, "the desktop box is gone").toContain("h-6");
		expect(track, `${FOOTER}: the phone track is not 6px`).toContain(
			phone("h-[6px]"),
		);
		// The desktop literal the three-way parity guard re-derives must survive.
		expect(track, "the desktop track thickness was replaced").toContain(
			"h-[18px]",
		);
	});
});

describe("R-Q1 — the chips ride line 1, and they get there by ORDER", () => {
	it("round5::the-line-break-is-an-ELEMENT-and-the-pseudonym-stopped-being-one", () => {
		const source = stripComments(read(ARGPROFILE));
		const brk = classTokensAfter(
			source,
			'data-testid="argprofile-line-break"',
			"the explicit line break",
		);
		const why =
			`${ARGPROFILE}: the phone line break is gone or no longer claims a line. ` +
			`Flexbox has no "break before this item"; the only way to end a line in ` +
			`a wrapping row is an item that fills it. It must be display:none at ` +
			`≥640px so the desktop does not merely ignore it — it must not have it.`;
		expect(brk, why).toContain("hidden");
		expect(brk, why).toContain(phone("block"));
		expect(brk, why).toContain(phone("basis-full"));
		expect(brk, why).toContain(phone("h-0"));

		const pseudo = classTokensAfter(
			source,
			"{author.pseudonym}",
			"the pseudonym link",
		);
		void pseudo;
		// ⛔ The pseudonym must NOT still claim the whole line, or the chips have
		// nowhere to sit and the break element is decoration.
		// ⛔ ANCHORED ON THE SYMBOL, NOT ON A DISTANCE. This read `{0,900}` — a
		// character window, which is a line number in a different unit (O-8), in
		// the file whose own docblock says never to use one. Measured headroom at
		// the time: 296 of 900, i.e. one added comment from a false red.
		const link = classTokensAfter(source, "href={`/u/$", "the pseudonym link");
		expect(
			link,
			`${ARGPROFILE}: the pseudonym still carries basis-full, so it owns line 1 ` +
				`alone and no chip can join it.`,
		).not.toContain(phone("basis-full"));
	});

	it("round5::every-chip-that-belongs-on-line-1-carries-the-lift", () => {
		const source = stripComments(read(ARGPROFILE));
		// ⛔⛔ LOCATED, NOT COUNTED — AND THE COUNT ALONE WAS DEMONSTRABLY EMPTY.
		// This row used to assert `=== 4` occurrences of the lift anywhere in the
		// file. `@test-writer` gave `LaneBadge` the POSITIVE `order-2` — the badge
		// then stays on line 2, which is the exact defect R-Q1 exists to fix — and
		// put the freed fourth token on a `display:contents` wrapper where it is
		// inert. **Count still four. Still green.** A tally is not a location, and
		// four somethings is not four right things.
		//
		// ⚠ Each anchor is the element's OWN identity (its component name or its
		// testid), never a class it also declares — selecting a subject by the
		// declaration under test is how a guard comes to assert itself (OVN-V5).
		const carriers: [string, string][] = [
			["the pseudonym link", "href={`/u/$"],
			["the position marker", "<PositionMarker marker="],
			["the Sold chip", 'data-testid="argstake-sold"'],
			["the lane badge", "<LaneBadge badge="],
		];
		for (const [what, anchor] of carriers) {
			expect(
				classTokensAfter(source, anchor, what),
				`${ARGPROFILE}: ${what} does not carry the lift, so it stays on line 2 ` +
					`— which is the arrangement R-Q1 exists to end. ⚠ The lift is a ` +
					`NEGATIVE order: a positive one sorts it AFTER the default items, ` +
					`which looks like a token and behaves like the defect.`,
			).toContain(phone("-order-2"));
		}
		const lift = source.match(new RegExp(phone("-order-2"), "g")) ?? [];
		expect(
			lift.length,
			`${ARGPROFILE}: line 1 has FOUR passengers — the pseudonym itself and the ` +
				`three chips (position marker, Sold tag, lane badge) — and each needs ` +
				`its own lift token, because they sit in four different spans and no ` +
				`single declaration reaches all of them. ⚠ The pseudonym is counted on ` +
				`purpose: it is what makes the group an ORDER rather than a default, so ` +
				`a future field inserted before it cannot silently take the first slot. ` +
				`⚠ The count is kept BESIDE the four locations above, not instead of ` +
				`them: it is what catches a FIFTH lift appearing somewhere nobody named.`,
		).toBe(4);
		// ⛔ AND THE BOXES AROUND THEM HAVE TO DISSOLVE, or `order` reaches nothing:
		// it is a property of flex ITEMS, and until the wrapper is `display:contents`
		// a chip is a child of a nested row where reordering moves it beside its
		// sibling and nowhere else.
		const dissolved = source.match(new RegExp(phone("contents"), "g")) ?? [];
		expect(
			dissolved.length,
			`${ARGPROFILE}: three wrappers must dissolve at phone width — group A, ` +
				`the side-badge span and the stake span — plus group B for the lane ` +
				`badge. Without the dissolution the order tokens are inert.`,
		).toBeGreaterThanOrEqual(4);
	});

	it("round5::line-2-opens-with-a-field-and-not-with-a-seam", () => {
		const source = stripComments(read(ARGPROFILE));
		const why =
			`${ARGPROFILE}: line 2 still opens with a separator. The ruled spelling ` +
			`is four fields and THREE seams; on a phone the pseudonym is on the line ` +
			`above, so the leading pipe divides nothing — and it cost the 9px that ` +
			`made the widest row break at 360px.`;
		expect(source, why).toContain(
			`<FieldSeparator className="${phone("hidden")}" />`,
		);
	});
});

describe("R-M3 — no info affordance mounts below 640px", () => {
	it("round5::the-tier-gate-lives-in-the-primitive-and-returns-the-child-bare", () => {
		const source = stripComments(read(INFOTIP));
		const why =
			`${INFOTIP}: the tier gate is gone. It has to live HERE rather than at ` +
			`the call sites: all eight phone-reachable affordances are in components ` +
			`the desktop also renders, and five of the six carriers are server ` +
			`components that cannot take a hook without a boundary change.`;
		expect(source, why).toContain("useIsPhoneTier");
		// ⚠ BRACES OPTIONAL. This required them, so the functionally identical
		// `if (phoneTier) return <>{child}</>;` reddened a guard about behaviour on
		// a question of style. It still catches the one that matters — a `<span>`
		// wrapper instead of a fragment — which the render tests do NOT: a wrapper
		// passes every behavioural row in `info-tip.test.tsx`, so this regex is the
		// only thing holding "bare".
		expect(source, why).toMatch(
			/if\s*\(\s*phoneTier\s*\)\s*\{?\s*return\s*<>\{child\}<\/>;/,
		);
	});

	it("round5::the-gate-is-a-VIEWPORT-question-and-not-the-pointer-one", () => {
		const source = stripComments(read(INFOTIP));
		// ⛔ The two queries are orthogonal and conflating them would change a
		// narrow desktop WINDOW and a wide touch TABLET in opposite directions.
		expect(source).toContain("(hover: hover) and (pointer: fine)");
		expect(
			source,
			`${INFOTIP}: the tier answer is being taken from the pointer query. A ` +
				`pointer is not a viewport.`,
		).not.toMatch(/phoneTier\s*=\s*!?\s*pointerFine/);
	});
});

describe("R-P — the profile's phone view", () => {
	it("round5::the-argument-viewer-panel-is-not-rendered-below-640", () => {
		const cls = classTokensAfter(
			read(ARGLIST),
			'data-testid="arguments-panel"',
			"the arguments panel",
		);
		expect(
			cls,
			`${ARGLIST}: the desktop's right column still renders on a phone, where ` +
				`it is a duplicate of a row the reader has just scrolled past and it ` +
				`is the LAST block on the page.`,
		).toContain(phone("hidden"));
	});

	it("round5::the-positions-head-is-one-row-and-the-filter-is-what-gives", () => {
		const source = read(TABLE);
		const head = classTokensAfter(
			source,
			'data-testid="positions-panel-head"',
			"the positions panel head",
		);
		expect(
			head,
			`${TABLE}: the head still wraps at phone width, which drops the ` +
				`Open/Closed pills to a second line and makes their ml-auto mean ` +
				`nothing.`,
		).toContain(phone("flex-nowrap"));
		expect(head, "the shared 52px floor was changed").toContain("min-h-[52px]");
		const trigger = classTokensAfter(
			source,
			'data-testid="positions-market-filter"',
			"the market filter trigger",
		);
		const why =
			`${TABLE}: the market filter cannot shrink, so flex-nowrap turns the ` +
			`head's wrap into an overflow. A flex item's default min-width:auto ` +
			`refuses to go below its content, and buttonVariants adds ` +
			`whitespace-nowrap and shrink-0 on top.`;
		expect(trigger, why).toContain(phone("min-w-0"));
		expect(trigger, why).toContain(phone("shrink"));
	});

	it("round5::the-tile-row-is-a-ROW-with-a-hairline-and-no-gap", () => {
		const source = stripComments(read(TABLE));
		const tr =
			/data-testid={`position-tile-\${tile\.key}`}[\s\S]*?className={`([^`]*)`/.exec(
				source,
			)?.[1];
		expect(tr, "the tile row's class template is unreadable").toBeDefined();
		const cls = (tr ?? "").split(/\s+/).filter(Boolean);
		const why =
			`${TABLE}: the phone tile is not the desktop row. Job B's flex-col let ` +
			`every cell keep its inherited text-center, which is the centred tile ` +
			`this refinement replaces.`;
		expect(cls, why).toContain(phone("flex"));
		expect(cls, why).not.toContain(phone("flex-col"));
		expect(cls, why).toContain(phone("items-center"));
		const sep =
			`${TABLE}: the phone row separator is half-built. The outline must stand ` +
			`down and a hairline must take over on the row's own top edge — half of ` +
			`this pair is worse than neither.`;
		expect(cls, sep).toContain(phone("[outline:none]"));
		expect(cls, sep).toContain(phone("[border-top:var(--hairline)]"));
	});

	it("round5::the-row-equaliser-stands-down-on-a-phone-EXPLICITLY", () => {
		const source = stripComments(read(TABLE));
		expect(
			source,
			`${TABLE}: the equal-row-thirds hook is no longer gated on the tier. Its ` +
				`own gate is "can the document scroll", which was an exact proxy for ` +
				`"below lg" until R-P2 hid the arguments panel — after which the phone ` +
				`page fits its viewport and rows are equalised to a THIRD of the ` +
				`screen: 76px at 360 against 178px at 430, a row growing taller as the ` +
				`phone gets bigger.`,
		).toMatch(/enabled:\s*!isPhoneTable/);
		const thirds = stripComments(read(THIRDS));
		expect(
			thirds,
			`${THIRDS}: the hook takes an enabled flag but does not CLEAR on the way ` +
				`out. An equaliser that stops equalising has to give the rows back, or ` +
				`whatever height it last wrote survives the stand-down.`,
		).toMatch(/if\s*\(!enabled\)/);
		// ⛔⛔ SCOPED TO THE BRANCH, because the string it looks for already occurs
		// in the unrelated `rowCount === 0` path — so the file-wide match was
		// satisfied by a line the stand-down never runs. `@test-writer` deleted the
		// whole clearing loop from this branch and the guard stayed GREEN, which is
		// the one thing its own message says it exists to prevent.
		const gate = thirds.indexOf("if (!enabled)");
		const branch = thirds.slice(gate, thirds.indexOf("return;", gate));
		expect(
			branch,
			`${THIRDS}: the !enabled branch returns without giving the rows back, so ` +
				`whatever height the equaliser last wrote outlives the stand-down.`,
		).toMatch(/row\.style\.height = "";/);
	});

	it("round5::the-header-wraps-so-the-tiles-get-the-whole-width", () => {
		const idcard = classTokensAfter(
			read(IDCARD),
			'data-testid="identity-card"',
			"the identity card",
		);
		expect(
			idcard,
			`${IDCARD}: the header cannot wrap, so the tiles stay in the 230px ` +
				`column beside a 56px avatar instead of taking the line the ruling ` +
				`gives them.`,
		).toContain(phone("flex-wrap"));
		const tiles = classTokensAfter(
			read(TILES),
			'data-testid="profile-tiles"',
			"the tile grid",
		);
		const why =
			`${TILES}: the six tiles are not three across on their own line. ` +
			`basis-full is what claims the line once the identity column dissolves; ` +
			`grid-cols-3 is what makes it three.`;
		expect(tiles, why).toContain(phone("basis-full"));
		expect(tiles, why).toContain(phone("grid-cols-3"));
		// ⛔ `sm:grid-cols-3` is NOT the same rule and is kept: `sm` is 40rem and
		// the mobile token is 640px, equal only at a 16px root font size.
		expect(
			tiles,
			"the sm rule was deleted as a duplicate — it is not one",
		).toContain("sm:grid-cols-3");
	});
});

describe("R-P3 — the phone's sell sheet carries no write path of its own", () => {
	it("round5::the-sell-leaf-is-presentation-only", () => {
		const source = stripComments(read(SHEET));
		// ADR-0051 A4 D-2: a phone-only leaf consumes the read model and existing
		// callbacks and contains no write path. The fetch, the idempotency key and
		// the unsettled-key law all stay in `useInlineSell`.
		for (const needle of [
			"fetch(",
			"/api/",
			'"use server"',
			"@/server/",
			"XMLHttpRequest",
			"sendBeacon",
			"<form",
			"formAction",
			"randomUUID",
			"Idempotency",
		]) {
			expect(
				source.includes(needle),
				`${SHEET}: contains ${needle} — the leaf must render controls and call ` +
					`the callbacks it is handed, never reach the wire itself.`,
			).toBe(false);
		}
		// POSITIVE CONTROL — the same scan against a term that IS present, so an
		// empty read cannot pass every row above.
		expect(source).toContain("InlineSellAmount");
	});

	it("round5::the-sell-leaf-uses-no-default-breakpoint-variant", () => {
		// ADR-0051 D-2 condition (d), carried into A4 unchanged. The phone tier
		// declares its gate ONCE, on the root of the subtree; an `sm:`/`md:`/`lg:`
		// rule inside it is a SECOND breakpoint system in a tier that already has
		// one, and the two disagree for any reader who has enlarged their text
		// (`sm` is 40rem, the mobile token is 640px — equal only at a 16px root).
		const variant = /\b(sm|md|lg|xl|2xl):[a-z0-9[-]/g;
		expect(stripComments(read(SHEET)).match(variant) ?? []).toEqual([]);
		// ⛔ POSITIVE CONTROL: the same regex over a file that DOES carry one, so
		// the empty match above is a verdict rather than a broken pattern.
		expect(
			(stripComments(read(TILES)).match(variant) ?? []).length,
			"the control file no longer carries a default-breakpoint variant — " +
				"re-point this control rather than deleting it",
		).toBeGreaterThan(0);
	});

	it("round5::the-sheet-is-mounted-INSIDE-the-armed-row-and-busy-is-wired", () => {
		const source = stripComments(read(TABLE));
		const at = source.indexOf("<PhoneSellSheet");
		expect(at, `${TABLE}: the phone sell sheet is not mounted`).toBeGreaterThan(
			-1,
		);
		// ⛔⛔ THIS CHECK IS DIRECTIONAL NOW, AND THE VERSION IT REPLACES DID NOT
		// ESTABLISH WHAT ITS OWN DOCBLOCK CLAIMED. It was
		// `lastIndexOf("<td", at) > -1 && indexOf("</td>", at) > at` — two searches
		// over the whole file, which hold for a mount almost anywhere inside a
		// table component. `@test-writer` hoisted the sheet clean out of the `<tr>`
		// into a fragment sibling, added one unrelated `<td>` later in the file,
		// and it stayed GREEN. That is O-8 arriving as a DISTANCE check wearing the
		// costume of a structural one.
		// ⇒ Walking FORWARD from the mount, the first tag that closes anything in
		// the row chain must be `</td>`. If a `</tr>` comes first, the sheet is
		// outside the cell and outside the row.
		// ⚠ The proof that actually matters is now a RUNTIME one —
		// `tests/unit/profile/render/phone-sell-host.test.tsx` asks the row whether
		// it `contains` the sheet. This row is kept because it names the defect at
		// the site a reader is editing, and because a source scan reds without a
		// browser; it is no longer the only thing standing between the mount and
		// the arm.
		const nextClose = ["</td>", "</tr>", "</tbody>", "</table>"]
			.map((tag) => [tag, source.indexOf(tag, at)] as const)
			.filter(([, i]) => i > -1)
			.sort((a, b) => a[1] - b[1])[0]?.[0];
		expect(
			nextClose,
			`${TABLE}: the sheet is no longer inside a table CELL of the tile row — ` +
				`the first closing tag after it is ${nextClose}. Outside the row, ` +
				`every tap in the sheet cancels the sell it was opened for.`,
		).toBe("</td>");
		const openTd = source.lastIndexOf("<td", at);
		const openTr = source.lastIndexOf("<tr", at);
		expect(
			openTd > openTr,
			`${TABLE}: the nearest enclosing tag is a row, not a cell.`,
		).toBe(true);
		const slice = source.slice(at, source.indexOf("/>", at));
		expect(
			slice,
			"the sheet does not take the controller's busy flag",
		).toContain("busy={sell.busy}");
		expect(slice, "closing the sheet does not cancel the arm").toContain(
			"onClose={sell.cancel}",
		);
		expect(
			slice,
			"the sheet submits something other than the tile's own sell",
		).toContain("sell.confirm(tile.key, sellArgs)");
		// ⛔ ONE SET OF CONTROLS AT A TIME. Both arms share `data-testid`s, and a
		// duplicated testid is a guard reading the wrong node.
		expect(source).toMatch(/const armedInRow = armed && !isPhone;/);
		expect(source).toMatch(/const armedInSheet = armed && isPhone;/);
	});

	it("round5::the-OPEN-tab-s-four-cells-and-the-title-declare-their-shares", () => {
		// ⛔⛔ ALL FOUR OF THESE WERE UNGUARDED AND ALL FOUR SURVIVED A MUTATION
		// ACROSS THE WHOLE UNIT SUITE. `profile-mobile-reflow`'s cell-share row
		// reads the SIDE cell only, so the three that carry the row's arithmetic
		// were held by nothing. Each is here with the consequence of losing it,
		// because a share without a consequence is a style opinion.
		const source = stripComments(read(TABLE));
		expect(
			source,
			`${TABLE}: the argument cell lost min-w-0/flex-1. A flex item will not ` +
				`shrink below its content without min-w-0, and the argument is the ` +
				`only cell whose content is unbounded — so the ROW overflows instead ` +
				`of the title clamping. The source comment calls this "the one that ` +
				`matters"; nothing was checking it.`,
		).toMatch(
			new RegExp(
				`<td className="[^"]*${phone("min-w-0")} ${phone("flex-1")}[^"]*">\\s*<TileArgumentCell`,
			),
		);
		expect(
			source,
			`${TABLE}: the Current cell lost its 64px share or its right alignment. ` +
				`Centred in 64px beside a flexible argument, the figures stop forming ` +
				`a column an eye can run down.`,
		).toMatch(
			new RegExp(
				`<td className="[^"]*${phone("w-16")} ${phone("shrink-0")}[^"]*${phone("text-right")}"`,
			),
		);
		expect(
			classTokensAfter(source, "data-testid={`tile-sell-", "the SELL trigger"),
			`${TABLE}: the SELL trigger lost its 44px floor or its touch-action. It ` +
				`is the entry to the one comment-free money action in the product, in ` +
				`a row 44px tall.`,
		).toEqual(
			expect.arrayContaining([
				phone("min-h-11"),
				phone("w-full"),
				phone("[touch-action:manipulation]"),
			]),
		);
		expect(
			source,
			`${TABLE}: the title's phone clamp is gone. Four lines of a 15px title ` +
				`in ~90px of flexible column is most of a screen for one row — and the ` +
				`thirds hook has stood down, so nothing else bounds it.`,
		).toMatch(
			new RegExp(
				`className="[^"]*${phone("line-clamp-2")}"\\s*>\\s*\\{cell\\.title\\}`,
			),
		);
	});

	it("round5::the-CLOSED-tab-s-cells-declare-a-share-TOO", () => {
		// ⛔⛔ THE ROW IS A FLEX ROW ON BOTH TABS, AND THE FIRST PASS GAVE ONLY THE
		// OPEN TAB'S FOUR CELLS A WIDTH. The Closed tab's `Staked` and `Opened`
		// kept `whitespace-nowrap` with `min-width: auto`, so their automatic
		// minimum was the full unbreakable string — while the Argument cell beside
		// them is `flex-1`, i.e. `flex: 1 1 0%`, whose shrink CONTRIBUTION is
		// `1 × 0 = 0`. It absorbs none of the negative free space, resolves to
		// **0px**, and the row overflows: verbatim the condition this refinement
		// was ruled to remove, one tab across.
		// ⚠ Nothing measured it — B13 reads the Open tab and the cell-share row
		// above asserts on the side cell alone. Found by `@code-reviewer`.
		const source = stripComments(read(TABLE));
		for (const [testid, want] of [
			["tile-staked-", phone("w-16")],
			["tile-opened-", phone("w-20")],
		] as const) {
			const at = source.indexOf(`data-testid={\`${testid}`);
			expect(at, `${TABLE}: the ${testid} cell was not found`).toBeGreaterThan(
				-1,
			);
			const tokens = (/className="([^"]*)"/.exec(source.slice(at))?.[1] ?? "")
				.split(/\s+/)
				.filter(Boolean);
			const why =
				`${TABLE}: the Closed tab's ${testid} cell claims no width at phone ` +
				`width, so the Argument cell beside it resolves to 0px and the row ` +
				`overflows — the defect R-P3 exists to remove, on the other tab.`;
			expect(tokens, why).toContain(want);
			expect(tokens, why).toContain(phone("shrink-0"));
			expect(tokens, why).toContain(phone("p-0"));
		}
	});

	it("round5::the-row-s-key-activation-stands-down-for-anything-activatable", () => {
		// ⛔⛔ THE SHEET IS MOUNTED INSIDE THE `<tr>` — which is what the
		// outside-click predicate needs — so the row's own Enter/Space handler sits
		// ABOVE the sheet's `Confirm` and the frame's `×`. Its bail used to name
		// `input` alone; for a `<button>`, activation IS the keydown's default
		// action, so `preventDefault()` there means Enter and Space produce no
		// click and the money control is unreachable by keyboard — on a modal that
		// spends twenty lines on focus containment precisely so it would be.
		// ⚠ jsdom synthesises no click from key activation, and the leaf's own
		// render test mounts it OUTSIDE any row, so the one context in which this
		// fires is the one no shipped test can reproduce. Found INDEPENDENTLY by
		// `@code-reviewer` and `@security-auditor`.
		const source = stripComments(read(TABLE));
		// ⚠ ANCHORED ON THE ROW, NOT ON THE FIRST `onKeyDown` IN THE FILE. There
		// are several, and the first belongs to the table-level stepper — reading
		// that one returned `['input']` and reported the row's widened bail as
		// missing, which is a guard measuring a neighbour (OVN-V5's shape, one
		// element over).
		const rowAt = source.indexOf("data-testid={`position-tile-");
		expect(rowAt, `${TABLE}: the tile row is gone`).toBeGreaterThan(-1);
		const at = source.indexOf("onKeyDown={(e) => {", rowAt);
		expect(at, `${TABLE}: the row's keydown handler is gone`).toBeGreaterThan(
			-1,
		);
		const sel =
			/closest\(\s*\n?\s*"([^"]*)"\s*,?\s*\n?\s*\)/.exec(
				source.slice(at, at + 900),
			)?.[1] ?? "";
		const why =
			`${TABLE}: the row's Enter/Space handler does not stand down for every ` +
			`activatable descendant, so it cancels the activation of the sell ` +
			`sheet's own controls.`;
		const named = sel.split(",").map((x) => x.trim());
		for (const tag of ["a", "button", "input", "textarea", "select"]) {
			expect(named, why).toContain(tag);
		}
	});
});
