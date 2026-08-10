import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DISCOVERY-COMPLETE C0 — the POLE-BINDING guard (plan §4 GROUP 1 C0, §7 test
 * plan row 3). Static: no DB, no render, no jsdom.
 *
 * TWO INDEPENDENT ROUTES have produced YES = near-white on live participant
 * surfaces:
 *
 *   Route 1 — SEMANTIC INDIRECTION. `side === "YES" ? "default" : "secondary"`
 *   → `bg-primary` → `--primary: var(--color-n7)` = #e4e4e4. The call site names
 *   no colour, so the inversion is invisible where it is written.
 *
 *   Route 2 — NAME-PORTING from a LIGHT-theme mockup. `.sidechip.yes{background:
 *   var(--ink)}` is BLACK there; `bg-ink` in this build is `--color-ink:
 *   #fafafa` — WHITE. Porting by token name inverts the pole.
 *
 * ROOT CAUSE, stated once: a side value resolved to a colour through ANYTHING
 * OTHER THAN A POLE TOKEN. The pole families are `--color-yes`/`--color-no`
 * (Tailwind `bg-yes`/`bg-no`/`text-yes`/`text-no`/`fill-no`/…) and the
 * deliberately-separate graph family `--graph-yes`/`--graph-no`. A pole token
 * names the pole AT the call site and cannot invert silently. Semantic variants
 * and neutral-ramp tokens can, and did — twice.
 *
 * THE GUARD. In the participant view layer, any expression keyed on a side value
 * (`=== "YES"` / `=== "NO"` on a `side` / `parentSide` / `resultingSide` /
 * `seg.side` / `node.side` discriminant) that resolves to a colour MUST resolve
 * to a pole-family token. An OFFENDER is a side-keyed expression whose branches
 * contain a shadcn variant name or a semantic/neutral colour — the two lists are
 * transcribed verbatim from the plan and are not widened here.
 *
 * WHY NOT THE LITERAL BAN the kickoff first phrased ("no file outside
 * `badges.tsx` maps a side value to a colour class"): it would redden six
 * legitimate files on the day it lands — the same precision problem the footer
 * ban's own comment names in tests/unit/shell/not-found.test.tsx. A guard that
 * reddens on correct code gets suppressed within a week.
 *
 * ⚠⚠ KNOWN GAP — ROUTE 3, WHICH THIS GUARD CANNOT CATCH. A GREEN RUN HERE IS
 * NOT A CLAIM OF COMPLETENESS.
 *
 * The two routes above both put a side value INSIDE the colour expression, so a
 * matcher can find them. There is a third:
 *
 *   Route 3 — A FIXED pole colour on a PER-SIDE element. No side value appears
 *   in the expression at all; the pole is hard-coded while the QUANTITY it
 *   measures flips meaning with the side. Nothing here can match it, because
 *   there is no side-keyed expression to match.
 *
 * V17's Support/Counter split bar lived in exactly this hole for the length of
 * this PR: a fixed `bg-yes` fill over a fixed `bg-no` track, rendering a share
 * whose side depends on the post. It rendered the NO-side share in the YES pole
 * on every NO hero panel, and this file stayed green throughout. The component's
 * own docstring even cited the "no side value → cannot invert" reasoning as its
 * defence, which was the mechanism stated backwards.
 *
 * A REJECTED candidate check, recorded so it is not re-proposed as new: "flag a
 * component that RECEIVES a side prop, renders a pole-family colour, and never
 * keys on it." It fails on the single most important instance —
 * `composer/ReplySplitBar.tsx` has BOTH a correct side-keyed pole (`:118-122`,
 * why it is in the inventory above) AND a separate fixed pair (`:64`, `:67`)
 * carrying the same defect on `/m/[slug]`. A component-level check sees the
 * correct expression and clears the file, so the rule would FALSE-NEGATIVE on
 * the exact case that most needs catching. A segment-level version would need to
 * decide which DOM node a quantity belongs to, which is not a static property.
 *
 * Route 3 therefore stays a KNOWN GAP, closed by review and by per-pole render
 * tests (assert BOTH a YES and a NO instance — a YES-only test passes on an
 * inverted NO panel), not by this file.
 *
 * NOTE — THERE IS NO ALLOWLIST, SUPPRESSION LIST OR DATED EXCEPTION FOR
 * `bookmarks/BookmarkCard.tsx` OR `profile/ArgumentList.tsx`. Both carry the
 * live inversion today; this guard reddens on them BY CONSTRUCTION and C4 / C4b
 * green it by FIXING THE CODE (each ternary is deleted outright when the file
 * adopts `SideBadge`). A guard whose allowlist contains a known live inversion
 * is the exact antipattern the guard exists to prevent.
 */

const ROOT = process.cwd();

/**
 * DECLARED EXCLUSION — `src/app/(admin)/**`.
 *
 * `(admin)/admin/moderation/_components/ReviewFeed.tsx:102-104` hand-rolls a
 * side chip whose mapping is CURRENTLY CORRECT (`bg-yes` for YES, `bg-no` for
 * NO). It is DUPLICATION, NOT INVERSION. Importing a participant debate
 * primitive into admin chrome is an admin-surface decision — admin is a
 * structurally separate path (CLAUDE.md §3: no `users` row, no `role`, its own
 * auth) — and is not this task's to make.
 *
 * RECORDED, NOT HIDDEN: `ReviewFeed` is the THIRD surviving side-chip
 * implementation after this PR (PD-0-10 goes three → one participant primitive
 * plus this admin hand-roll). The exclusion is load-bearing, not cosmetic —
 * without it the file enters the closed inventory below as a seventh entry.
 */
const ADMIN_EXCLUSION = "src/app/(admin)/";

/**
 * Prose ABOUT a pole is not a pole. Reused VERBATIM from
 * tests/unit/shell/not-found.test.tsx:46-50 (itself the shape from
 * tests/unit/design/no-raw-hex-view-layer.test.ts:56-61).
 *
 * Load-bearing forward, not merely today: `PriceBar.tsx:5-6`,
 * `PositionStrip.tsx:90`, `SlotHeader.tsx:31` and `CountdownDigits.tsx:12` all
 * DISCUSS `--color-yes` / `bg-yes` / `bg-no` in prose, and POLISH.3/.5/.6 will
 * port more mockup prose in. (Measured at C0: stripping does not change today's
 * found set — recorded honestly rather than claimed.)
 */
const stripComments = (source: string) =>
	source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/\/\/[^"'`\n]*$/gm, "");

/**
 * The SAME three regexes as `stripComments`, but each match is replaced by its
 * own newlines instead of "" — the identical STRIPPING DECISION with LINE
 * NUMBERS PRESERVED.
 *
 * Why this exists: `stripComments` deletes the newlines inside a block comment,
 * so every line after one shifts. Measured on this tree, the two offenders would
 * be reported at `BookmarkCard.tsx:81` (really 91) and `ArgumentList.tsx:88`
 * (really 96) — a RED going into a commit body with WRONG line numbers. O-3: a
 * true finding reported with a misleading cause is a defect. The equivalence of
 * the two strippers is ASSERTED below, so the "verbatim reuse" claim stays
 * load-bearing rather than decorative.
 */
const blankLine = (match: string) => match.replace(/[^\n]/g, " ");
const blankComments = (source: string) =>
	source
		.replace(/\/\*[\s\S]*?\*\//g, blankLine)
		.replace(/^\s*\/\/.*$/gm, blankLine)
		.replace(/\/\/[^"'`\n]*$/gm, blankLine);

/**
 * A comparison of a SIDE discriminant against a side literal. The discriminant
 * may be a bare identifier (`side`, `resultingSide`) or a property access
 * (`node.side`, `seg.side`, `args.parentSide`) — a line-by-line regex would miss
 * neither, but would miss the MULTI-LINE ternaries at `ReplySplitBar.tsx:119`
 * and `ProfileChart.tsx:181`, so the whole file is matched as one string.
 */
const SIDE_COMPARISON =
	/([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*[!=]==\s*["'](?:YES|NO)["']/g;

/** The permitted destinations — the two pole families, custom-property and
 * Tailwind spellings alike (`--color-yes`, `--graph-no`, `bg-yes`, `text-no`,
 * `fill-no`, `stroke-[var(--graph-yes)]`). */
const POLE_TOKEN =
	/--(?:color|graph)-(?:yes|no)\b|\b(?:bg|text|border|stroke|fill|ring|from|to|via)-(?:yes|no)\b/;

/** Route 1 — a shadcn variant NAME, matched only as a string literal so the
 * `default` keyword is never mistaken for one. Verbatim from the plan. */
const SHADCN_VARIANT =
	/["'](?:default|secondary|destructive|outline|ghost|link)["']/;

/** Route 2 — a semantic or neutral-ramp colour. Verbatim from the plan. */
const NEUTRAL_COLOUR =
	/\b(?:bg-(?:primary|secondary|muted|accent|foreground|background|ink|n[0-7])|border-ink|text-ink)\b/;

/**
 * The ternary body from just after `?` to the end of the expression, aware of
 * brackets and of string / template literals — so a `:` inside
 * `"[border:var(--hairline)]"` does not terminate it and a `,` inside
 * `{ className: "fill-no", stroke: "none" }` does not either. Terminates on the
 * first UNBALANCED closer (the `}` of a JSX expression container, the `)` of a
 * `cn(…)` call) or on a `;` / `,` at depth 0.
 */
function readTernaryBody(source: string, start: number): string {
	let i = start;
	let depth = 0;
	while (i < source.length) {
		const ch = source[i];
		if (ch === '"' || ch === "'" || ch === "`") {
			i++;
			while (i < source.length && source[i] !== ch) {
				i += source[i] === "\\" ? 2 : 1;
			}
			i++;
			continue;
		}
		if (ch === "(" || ch === "[" || ch === "{") {
			depth++;
		} else if (ch === ")" || ch === "]" || ch === "}") {
			if (depth === 0) {
				return source.slice(start, i);
			}
			depth--;
		} else if (depth === 0 && (ch === ";" || ch === ",")) {
			return source.slice(start, i);
		}
		i++;
	}
	return source.slice(start);
}

type SideKeyedColourExpression = {
	/** Repo-relative. */
	file: string;
	/** The line the side-keyed expression STARTS on, in the real file. */
	line: number;
	/** True when a branch names a shadcn variant or a semantic/neutral colour. */
	offends: boolean;
};

const sourceFiles = readdirSync(join(ROOT, "src"), {
	recursive: true,
	withFileTypes: true,
})
	.filter(
		(entry) =>
			entry.isFile() &&
			(entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")),
	)
	.map((entry) => join(entry.parentPath, entry.name).replace(`${ROOT}/`, ""))
	.filter((rel) => !rel.startsWith(ADMIN_EXCLUSION));

/** Every side-keyed expression that RESOLVES TO A COLOUR — pole-bound ones and
 * offenders alike. A side-keyed ternary that resolves to something else
 * (`side === "YES" ? "yes" : "no"` for a DB literal, `? yesPosts : noPosts`) is
 * not this guard's subject and is not collected. */
const sideKeyedColour: SideKeyedColourExpression[] = sourceFiles.flatMap(
	(file) => {
		const source = blankComments(readFileSync(join(ROOT, file), "utf8"));
		const hits: SideKeyedColourExpression[] = [];
		for (const match of source.matchAll(SIDE_COMPARISON)) {
			const discriminant = match[1];
			const leaf = discriminant.split(".").pop() ?? discriminant;
			if (!/side$/i.test(leaf)) {
				continue;
			}
			// The condition must be the ternary's own test. Whitespace and a
			// closing paren (`(side === "YES") ? …`) are skipped; `?.` and `??`
			// are not ternaries.
			let i = (match.index ?? 0) + match[0].length;
			while (i < source.length && (/\s/.test(source[i]) || source[i] === ")")) {
				i++;
			}
			if (source[i] !== "?" || source[i + 1] === "?" || source[i + 1] === ".") {
				continue;
			}
			const body = readTernaryBody(source, i + 1);
			const offends = SHADCN_VARIANT.test(body) || NEUTRAL_COLOUR.test(body);
			if (!offends && !POLE_TOKEN.test(body)) {
				continue;
			}
			hits.push({
				file,
				line: source.slice(0, match.index).split("\n").length,
				offends,
			});
		}
		return hits;
	},
);

/**
 * CLOSED INVENTORY — the files permitted to hold a side-keyed colour
 * expression, asserted by EXACT SET EQUALITY rather than a count, so a seventh
 * cannot appear silently and a sixth cannot be quietly added.
 *
 * This is the PR-HEAD set. It is RED at C0 (eight files today) and goes GREEN
 * when C4 and C4b delete the two offender ternaries outright — each file becomes
 * `<SideBadge side={…} />` and stops containing a side-keyed colour expression
 * at all. `BookmarkCard.tsx` and `ArgumentList.tsx` are DELIBERATELY ABSENT: see
 * the header — listing them here would be the allowlist antipattern.
 *
 * DELIBERATELY BRITTLE. POLISH.3 / .5 / .6 will add legitimate pole sites (the
 * d5 and Profile chip presets). Each such addition must be a DECISION, made by
 * adding the file here explicitly — never by relaxing the predicate.
 *
 * SURVEY DELTA, recorded not absorbed: the C0 survey handed to this file
 * enumerated FIVE legitimate expressions across FOUR files. Two more exist and
 * are collected here — `composer/PositionStrip.tsx:102` and
 * `composer/SlotHeader.tsx:43`, the `{...(side === "YES" ? {stroke} : {className:
 * "fill-no"})}` thumb-glyph spread. Both are POLE-BOUND and therefore NOT
 * offenders (halt item 14 does not fire — it fires on a third INVERTED site, and
 * there is none). They are in the inventory because they are genuinely
 * side-keyed colour, and narrowing the predicate to exclude the property-object
 * form to match the survey would weaken the guard to fit a count.
 */
const PERMITTED_FILES = [
	"src/components/debate/badges.tsx",
	"src/components/debate/chart/MarketPriceChart.tsx",
	"src/components/debate/composer/PositionStrip.tsx",
	"src/components/debate/composer/ReplySplitBar.tsx",
	"src/components/debate/composer/SlotHeader.tsx",
	// SEVENTH ENTRY, added deliberately at the V17 fix — the guard's own
	// documented mechanism, exercised rather than worked around. V17's
	// Support/Counter split bar originally used a FIXED `bg-yes` fill over a
	// FIXED `bg-no` track, which inverted the pole on the NO hero panel (route 3
	// below). The fix made the segments side-keyed:
	//   supportPole = side === "YES" ? "bg-yes" : "bg-no"
	//   counterPole = side === "YES" ? "bg-no"  : "bg-yes"
	// which is correct AND newly visible to this guard, so the file enters the
	// inventory. The predicate was NOT relaxed to avoid the churn — relaxing it
	// is the one thing this file must never do to stay green.
	"src/components/discovery/HeroPanels.tsx",
	"src/components/profile/graph/ProfileChart.tsx",
];

describe("side-pole-binding — a side value may resolve only to a pole token", () => {
	it("side-pole-binding::guard-is-alive", () => {
		// A glob that silently matched nothing passes vacuously — the recorded
		// POLISH.1 z-index failure. TWO alive checks, both non-negotiable.

		// 262 `.ts`/`.tsx` under `src/` after the `(admin)` exclusion (277 before
		// it), measured at C0. This PR only ADDS source files, so the floor
		// cannot be tripped by its own diff.
		expect(sourceFiles.length).toBeGreaterThanOrEqual(262);

		// 9 side-keyed colour expressions at C0. C4 and C4b DELETE both offender
		// ternaries outright (`BookmarkCard.tsx:91`, `ArgumentList.tsx:96` each
		// become `<SideBadge side={…} />`), leaving 7 at PR head. The floor is the
		// plan's ratified 6 — deliberately BELOW the PR-head count, because a floor
		// set at the C0 count would redden the guard at PR head for the wrong
		// reason, and a guard that reddens on its own fix is worse than no guard.
		expect(sideKeyedColour.length).toBeGreaterThanOrEqual(6);
	});

	it("side-pole-binding::comment-stripping-is-line-preserving-and-equivalent", () => {
		// The offender's line number is what goes into the C0 commit body, so the
		// line-preserving stripper must make BYTE-FOR-BYTE the same stripping
		// decision as the verbatim `stripComments` it mirrors. Whitespace is
		// squeezed out of both because that is exactly and only where they differ.
		const squeeze = (s: string) => s.replace(/\s+/g, "");
		const divergent = sourceFiles.filter((file) => {
			const source = readFileSync(join(ROOT, file), "utf8");
			return squeeze(stripComments(source)) !== squeeze(blankComments(source));
		});
		expect(divergent).toEqual([]);
	});

	it("side-pole-binding::no-side-keyed-expression-resolves-to-a-non-pole-colour", () => {
		// RED AT C0 BY CONSTRUCTION. Expected offenders, both Route 1:
		//   src/components/bookmarks/BookmarkCard.tsx:91  → fixed by C4
		//   src/components/profile/ArgumentList.tsx:96    → fixed by C4b
		// A THIRD offender means the survey was incomplete: HALT ITEM 14 — stop
		// and report it, never widen an allowlist to make the suite green.
		const offenders = sideKeyedColour
			.filter((hit) => hit.offends)
			.map((hit) => `${hit.file}:${hit.line}`);
		expect(offenders).toEqual([]);
	});

	it("side-pole-binding::closed-inventory-of-side-keyed-colour-sites", () => {
		const inventory = [
			...new Set(sideKeyedColour.map((hit) => hit.file)),
		].sort();
		expect(inventory).toEqual(PERMITTED_FILES);
	});
});
