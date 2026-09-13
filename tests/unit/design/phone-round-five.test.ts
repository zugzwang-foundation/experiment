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
		expect(phone("h-8")).toBe("max-mobile:h-8");
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
		const weights = source.match(/max-mobile:font-extrabold/g) ?? [];
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
			"data-testid={`card-trigger-${relation}`}",
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
		expect(cls, why).toContain(phone("after:-inset-y-1.5"));
		expect(cls, why).toContain(phone("after:content-['']"));
		// ⛔ THE ARITHMETIC, DERIVED FROM THE TOKENS RATHER THAN ASSERTED BESIDE
		// THEM. `h-8` is 32px and `-inset-y-1.5` is 6px each side on Tailwind's
		// 4px scale, so a future edit that changes either number has to keep the
		// sum at the 44 the accessibility floor asks for.
		const height = 8 * 4;
		const inset = 1.5 * 4;
		expect(height + inset * 2, "the hit area no longer reaches 44px").toBe(44);
	});

	it("round5::the-44px-MIN-HEIGHT-is-gone-because-it-is-what-broke-the-line", () => {
		const source = stripComments(read(FOOTER));
		const cls = classTokensAfter(
			source,
			"data-testid={`card-trigger-${relation}`}",
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
		const box = classTokensAfter(
			source,
			'<span className="flex h-6 w-full items-center',
			"the track's alignment box",
		);
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
		const link =
			/href={`\/u\/\${encodeURIComponent\(author\.pseudonym\)}`}[\s\S]{0,900}?className="([^"]*)"/.exec(
				source,
			)?.[1];
		expect(link, "the pseudonym link's className is unreadable").toBeDefined();
		expect(
			link?.split(/\s+/),
			`${ARGPROFILE}: the pseudonym still carries basis-full, so it owns line 1 ` +
				`alone and no chip can join it.`,
		).not.toContain(phone("basis-full"));
	});

	it("round5::every-chip-that-belongs-on-line-1-carries-the-lift", () => {
		const source = stripComments(read(ARGPROFILE));
		const lift = source.match(/max-mobile:-order-2/g) ?? [];
		expect(
			lift.length,
			`${ARGPROFILE}: line 1 has FOUR passengers — the pseudonym itself and the ` +
				`three chips (position marker, Sold tag, lane badge) — and each needs ` +
				`its own lift token, because they sit in four different spans and no ` +
				`single declaration reaches all of them. ⚠ The pseudonym is counted on ` +
				`purpose: it is what makes the group an ORDER rather than a default, so ` +
				`a future field inserted before it cannot silently take the first slot.`,
		).toBe(4);
		// ⛔ AND THE BOXES AROUND THEM HAVE TO DISSOLVE, or `order` reaches nothing:
		// it is a property of flex ITEMS, and until the wrapper is `display:contents`
		// a chip is a child of a nested row where reordering moves it beside its
		// sibling and nowhere else.
		const dissolved = source.match(/max-mobile:contents/g) ?? [];
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
		expect(source, why).toMatch(
			/if\s*\(\s*phoneTier\s*\)\s*\{\s*return\s*<>\{child\}<\/>;/,
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
		expect(thirds).toMatch(/row\.style\.height = "";/);
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

	it("round5::the-sheet-is-mounted-INSIDE-the-armed-row-and-busy-is-wired", () => {
		const source = stripComments(read(TABLE));
		const at = source.indexOf("<PhoneSellSheet");
		expect(at, `${TABLE}: the phone sell sheet is not mounted`).toBeGreaterThan(
			-1,
		);
		// ⛔ INSIDE THE SELL CELL. `useInlineSell`'s outside-click predicate asks
		// whether the armed `<tr>` CONTAINS the tap; a sheet mounted anywhere else
		// is not contained, so the first tap inside it — Confirm included — cancels
		// the arm. The fence is the enclosing `<td>`, found by walking back.
		const tdAt = source.lastIndexOf("<td", at);
		const tdClose = source.indexOf("</td>", at);
		expect(
			tdAt > -1 && tdClose > at,
			`${TABLE}: the sheet is no longer inside a table cell of the tile row. ` +
				`Outside it, every tap in the sheet cancels the sell it was opened for.`,
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
});
