import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * MOBILE-2 / ADR-0050 — the source-scan half of the phone tier's guard family.
 *
 * ⛔⛔ WHAT THIS FILE IS FOR, STATED ONCE. Every rule below describes a property
 * of the phone tier that is TRUE TODAY and that nothing in the type system, the
 * build, or a render test can keep true tomorrow. "The phone tree contains no
 * write path" is a fact about which strings appear in which files; a component
 * that starts calling `fetch` compiles, renders, and looks right. So the checks
 * are textual, and each one names the wrong answer it exists to reject.
 *
 * ⚠⚠ THE VARIANT PREFIX IS ASSEMBLED AT RUNTIME AND THAT IS NOT STYLE. Tailwind
 * v4's source detection scans `tests/` as well as `src/` and `docs/`, so a
 * class-shaped literal in THIS file becomes a real emitted utility in the built
 * stylesheet — which would make any check that greps the built sheet for a
 * component's new utility self-fulfilling. `profile-mobile-reflow.test.ts:108-115`
 * is the precedent and carries the measurement (`max-mobile:opacity-0` present
 * in the built sheet, present in `tests/`, present in NO `src/` file).
 */
const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const VARIANT = "max-mobile";
const SEP = ":";
const PHONE = VARIANT + SEP;
/** `phone("hidden")` — the variant-prefixed class token, built at runtime. */
const phone = (utility: string) => PHONE + utility;

const PHONE_DIR = "src/components/debate/phone";
const VIEW = "src/components/debate/DebateView.tsx";
const PAGE = "src/app/(public)/m/[slug]/page.tsx";
const COMPOSER = "src/components/debate/composer/BetComposer.tsx";

/** Every `.tsx`/`.ts` under `phone/`, read once. */
function phoneFiles(): { file: string; src: string }[] {
	return readdirSync(join(ROOT, PHONE_DIR))
		.filter((name) => name.endsWith(".tsx") || name.endsWith(".ts"))
		.map((name) => ({
			file: `${PHONE_DIR}/${name}`,
			src: read(`${PHONE_DIR}/${name}`),
		}));
}

/**
 * ⛔ COMMENTS ARE STRIPPED BEFORE EVERY NEGATIVE SCAN, line count preserved.
 * Six recorded instances in this repository of a textual guard matching the
 * COMMENT that explains why the thing is absent — including, twice, a comment
 * this very kind of guard wrote. A rule that reddens on its own docblock is not
 * measuring the code.
 */
function code(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) =>
			"\n".repeat((m.match(/\n/g) ?? []).length),
		)
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("phone tier — the scans reach a non-empty file set", () => {
	/**
	 * ⛔ EVERY NEGATIVE SCAN BELOW IS `expect(offenders).toEqual([])`, AND AN
	 * EMPTY `phoneFiles()` SATISFIES ALL OF THEM AT ONCE. Measured: pointing the
	 * extension filter at `.jsxx` left guards 2, 3, 4 and 5 GREEN — only guard 8
	 * reddened, and only because its positive control happens to call
	 * `phoneFiles()` itself. `side-pole-binding.test.ts` in this directory
	 * carries the same check for the same reason ("a glob that silently matched
	 * nothing passes vacuously — the recorded POLISH.1 z-index failure"); this
	 * file shipped without it.
	 */
	it("phone-tier::guard-is-alive", () => {
		expect(phoneFiles().length).toBeGreaterThanOrEqual(8);
	});
});

describe("phone tier — the two roots hide together (guard 1)", () => {
	/**
	 * ⛔⛔ THE PAIR IS THE UNIT, AND ASSERTING ONE HALF IS WORSE THAN ASSERTING
	 * NEITHER. Remove the desktop token and a phone renders both trees stacked;
	 * remove the phone token and a phone renders neither. Both failures are
	 * invisible at the width the author is looking at, and both pass a guard that
	 * only checks the other half.
	 */
	it("phone-tier::BOTH-roots-declare-their-side-of-the-640px-gate", () => {
		const tag = /<PageContainer\b[^>]*>/.exec(code(read(VIEW)));
		if (!tag) {
			throw new Error(`${VIEW}: no PageContainer tag found.`);
		}
		const desktop = (/className="([^"]*)"/.exec(tag[0])?.[1] ?? "")
			.split(/\s+/)
			.filter(Boolean);
		expect(
			desktop,
			"DebateView's root must hide below 640px — without it the phone " +
				"renders BOTH trees",
		).toContain(phone("hidden"));

		const root =
			/data-testid="phone-debate-view"[\s\S]{0,600}?className=\{?"([^"]*)"/.exec(
				code(read(`${PHONE_DIR}/PhoneDebateView.tsx`)),
			);
		if (!root) {
			throw new Error("PhoneDebateView: no root className found.");
		}
		const mobile = (root[1] ?? "").split(/\s+/).filter(Boolean);
		expect(
			mobile,
			"the phone root must be hidden by DEFAULT — without it the desktop " +
				"renders BOTH trees",
		).toContain("hidden");
		expect(
			mobile.some((c) => c.startsWith(PHONE) && /:(flex|block|grid)$/.test(c)),
			"the phone root must declare a display token below 640px — without it " +
				"the phone renders NEITHER tree",
		).toBe(true);
	});
});

describe("phone tier — no second breakpoint system (guard 2)", () => {
	/**
	 * `--breakpoint-mobile` is `640px` and Tailwind's `sm` is `40rem` — equal at
	 * a 16px root font size and at no other (AGENTS.md §8). A `sm:` rule inside
	 * a tier already gated at 640px puts two boundaries in one subtree, and on a
	 * phone with enlarged text they separate.
	 */
	it("phone-tier::no-default-breakpoint-variant-under-phone", () => {
		const offenders: string[] = [];
		for (const { file, src } of phoneFiles()) {
			for (const m of code(src).matchAll(/(?<![\w-])(sm|md|lg|xl|2xl):/g)) {
				offenders.push(`${file}: ${m[0]}`);
			}
		}
		expect(offenders).toEqual([]);
		// POSITIVE CONTROL — the same pattern against a file that HAS one, so an
		// empty result above means "absent" rather than "my regex is wrong".
		expect(
			[
				...code(read("src/components/debate/MarketHeader.tsx")).matchAll(
					/(?<![\w-])(sm|md|lg|xl|2xl):/g,
				),
			].length,
		).toBeGreaterThan(0);
	});
});

describe("phone tier — no write path (guards 3 and 4)", () => {
	/**
	 * ⛔⛔ THE THESIS, AS A GREP. Every bet on this surface goes through the
	 * REUSED `BetComposer`; the phone tier opens it and reads the model, and that
	 * is the whole of its relationship with money. A second fetch here would not
	 * merely duplicate code — it would be a path to a stake that never passed
	 * through the argument field, the idempotency key, or the moderation hop.
	 */
	it("phone-tier::no-fetch-no-bet-endpoint-no-request-builder", () => {
		const offenders: string[] = [];
		for (const { file, src } of phoneFiles()) {
			const body = code(src);
			/**
			 * ⚠⚠ THE RULE IS "NO WRITE PATH"; THE FIRST NEEDLE LIST MEASURED "NO
			 * `fetch` AND NO DIRECT REQUESTS IMPORT", WHICH IS NARROWER.
			 * `@security-auditor` enumerated what walked through it: a Server
			 * Action (`"use server"`, or any `@/server/**` import), a
			 * `<form action={…}>`, `navigator.sendBeacon`, `XMLHttpRequest`. None
			 * is exotic — a Server Action in particular is the shape a future
			 * "just save the draft" convenience takes, and it would have passed a
			 * guard whose own docblock says no write path exists here.
			 */
			for (const needle of [
				"fetch(",
				"/api/bets/",
				"composer/requests",
				"composer/idempotency",
				"./requests",
				"./idempotency",
				'"use server"',
				"@/server/",
				"sendBeacon",
				"XMLHttpRequest",
				"<form",
				"formAction",
			]) {
				if (body.includes(needle)) {
					offenders.push(`${file}: ${needle}`);
				}
			}
		}
		expect(offenders).toEqual([]);
		// POSITIVE CONTROL — the composer really does carry these, so the empty
		// result above is a fact about `phone/` and not about the search.
		const composer = code(read(COMPOSER));
		expect(composer).toContain("./requests");
		expect(
			composer.includes("fetch(") || composer.includes("await fetch"),
		).toBe(true);
		// ⚠ AND A CONTROL FOR THE WIDENED HALF, on synthetic strings, so the four
		// new needles are proved to MATCH the shape each one names rather than
		// merely being absent from a directory that never contained them.
		for (const [needle, sample] of [
			['"use server"', 'const a = 1; "use server";'],
			["@/server/", 'import { x } from "@/server/bets/place";'],
			["sendBeacon", "navigator.sendBeacon(u, b);"],
			["<form", "<form action={save}>"],
		] as const) {
			expect(sample.includes(needle), `${needle} matches its own shape`).toBe(
				true,
			);
		}
	});

	it("phone-tier::the-sheet-mounts-only-BetComposer-or-AuthGateSlot", () => {
		const owner = code(read(`${PHONE_DIR}/PhoneDebateView.tsx`));
		expect(owner).toContain("<BetComposer");
		expect(owner).toContain("<AuthGateSlot");
		// No SECOND submit control anywhere in the tier. `PLACE` is the composer's
		// own submit label (`COMPOSER_COPY.submit`) — its presence in `phone/`
		// would mean a button had been rebuilt here rather than reused.
		const offenders: string[] = [];
		for (const { file, src } of phoneFiles()) {
			const body = code(src);
			if (body.includes('type="submit"')) {
				offenders.push(`${file}: type="submit"`);
			}
			if (body.includes("PLACE")) {
				offenders.push(`${file}: PLACE`);
			}
		}
		expect(offenders).toEqual([]);
		// POSITIVE CONTROL for the `PLACE` half — the string is real and lives
		// where it should.
		expect(code(read("src/components/debate/composer/copy.ts"))).toContain(
			"PLACE",
		);
	});
});

describe("phone tier — the order is the model's (guard 5)", () => {
	/**
	 * The desktop columns render `model.posts` in the server's ranked order. A
	 * `.sort(` here would be a SECOND ranking, free to disagree with the one the
	 * export and the desktop both use, and the disagreement would be invisible
	 * unless someone compared two screens side by side.
	 */
	it("phone-tier::no-sort-in-the-phone-tree", () => {
		const offenders = phoneFiles()
			.filter(({ src }) => code(src).includes(".sort("))
			.map(({ file }) => file);
		expect(offenders).toEqual([]);
		// POSITIVE CONTROL — `.sort(` is findable by this pattern in a file that
		// genuinely sorts.
		expect(code(read("src/lib/ranking.ts")).includes(".sort(")).toBe(true);
	});
});

describe("phone tier — the relation partition is the model's (guard 6)", () => {
	/**
	 * ⛔ SUPPORT AND COUNTER ARE ALREADY DECIDED SERVER-SIDE. `load-debate-view`
	 * groups a post's replies into `replies.support` / `replies.counter`, and the
	 * `.md` export states the same fact independently. Re-deriving it here from
	 * `reply.side === post.sideAtPostTime` would be a second implementation —
	 * and one that cannot even be written correctly against a REMOVED parent,
	 * whose union variant carries no side.
	 */
	it("phone-tier::thread-reads-replies-support-counter-and-derives-no-side-itself", () => {
		const owner = code(read(`${PHONE_DIR}/PhoneDebateView.tsx`));
		expect(owner).toContain("replies.support");
		expect(owner).toContain("replies.counter");
		// The only sanctioned side derivation is the shared pure helper.
		expect(owner).toContain("deriveReplySide");
		/**
		 * ⚠⚠ THE FORBIDDEN SHAPE IS AN EXPRESSION THAT **PRODUCES A SIDE**, not one
		 * that MENTIONS one, and the first draft of this assertion could not tell
		 * the two apart — it reddened on
		 * `side === "YES" ? "bg-yes text-no" : "bg-no text-yes"`, which is the
		 * RATIFIED anti-inversion shape (`AggregateFooter`'s docblock: "the side
		 * value is resolved to a pole token AT the call site, which is the shape
		 * that cannot invert silently"). Banning that would have pushed the pole
		 * mapping down into `PhoneSideTabs`, i.e. into the component that does NOT
		 * know which side it is holding — the exact defect `RR-3` fixed.
		 * ⇒ What is banned is the INVERSION IDIOM: a ternary whose two arms are
		 * the two sides. That is `deriveReplySide`'s job and nothing here may do
		 * it a second time.
		 */
		const INVERSION = /\?\s*"(?:YES|NO)"\s*:\s*"(?:YES|NO)"/g;
		const inversions = [...owner.matchAll(INVERSION)].map((m) => m[0]);
		expect(
			inversions,
			"a side-inversion ternary in the phone owner is new side arithmetic — " +
				"deriveReplySide already owns it",
		).toEqual([]);
		// POSITIVE CONTROL — the pattern finds the real inversion where it lives.
		expect(
			[
				...code(read("src/components/debate/composer/gating.ts")).matchAll(
					INVERSION,
				),
			].length,
		).toBeGreaterThan(0);
	});
});

describe("phone tier — the mount (guard 7)", () => {
	/**
	 * ⛔ NO WRAPPER. `DebateView`'s root is the first link of a height chain four
	 * `*-height-chain` tests read as source and `page-container.test.ts` pins by
	 * class set. An element between `<main>` and it adds a box with no height
	 * declaration in the middle of that chain — and would also break the 1440px
	 * DOM-identity measurement, whose anchor is `main.firstElementChild`.
	 */
	it("phone-tier::page-mounts-both-trees-as-siblings-with-the-same-four-props", () => {
		const page = code(read(PAGE));
		const mount = /<PhoneDebateView([\s\S]*?)\/>/.exec(page);
		if (!mount) {
			throw new Error(`${PAGE}: no <PhoneDebateView> mount found.`);
		}
		for (const prop of [
			"model={model}",
			"viewer={viewer}",
			"initialPostId={initialPostId}",
			"ownPseudonym={",
		]) {
			expect(mount[1]).toContain(prop);
		}
		// The desktop mount is UNWRAPPED: the only thing between the return and
		// `<DebateView` is the fragment.
		expect(page).toMatch(/return\s*\(\s*<>\s*<DebateView/);
	});
});

describe("phone tier — no viewport branch in JavaScript (guard 8)", () => {
	/**
	 * ⛔ THE TIER IS A MEDIA QUERY, NOT A RUNTIME TEST. A `matchMedia("(max-width:
	 * 640px)")` branch decides which tree to render on the CLIENT, where the
	 * server has already rendered the other one — a hydration mismatch, and one
	 * that only appears on the device class this tier exists for. `ssr: false` is
	 * the same mistake with a different spelling.
	 *
	 * ⚠ ONE `matchMedia` IS ALLOWED AND IT IS NOT A VIEWPORT TEST:
	 * `prefers-reduced-motion`, read at call time to choose a scroll `behavior`,
	 * exactly as `ComposerSlot.tsx` already does.
	 */
	it("phone-tier::no-ssr-false-and-no-matchMedia-but-reduced-motion", () => {
		const offenders: string[] = [];
		for (const { file, src } of phoneFiles()) {
			const body = code(src);
			if (body.includes("ssr: false") || body.includes("ssr:false")) {
				offenders.push(`${file}: ssr: false`);
			}
			for (const m of body.matchAll(/matchMedia\(\s*"([^"]*)"/g)) {
				if (m[1] !== "(prefers-reduced-motion: reduce)") {
					offenders.push(`${file}: matchMedia(${m[1]})`);
				}
			}
		}
		expect(offenders).toEqual([]);
		// POSITIVE CONTROL — the scan DOES see the one sanctioned call, so an
		// empty offender list is not an empty scan.
		expect(
			phoneFiles().some(({ src }) =>
				code(src).includes('matchMedia("(prefers-reduced-motion: reduce)")'),
			),
		).toBe(true);
	});
});

describe("phone tier — every host transition consults the busy flag (guard 16)", () => {
	/**
	 * ⛔⛔ THE MONEY RULE, AS A SOURCE FACT — because the behavioural version of
	 * this needs a composer with a request genuinely in flight, and the thing
	 * that actually goes wrong is a NEW `setSheet` call site written six months
	 * from now by someone who has not read `DebateView.tsx:155-159`.
	 *
	 * `BetComposer`'s `key` in the phone owner carries `kind`, `parentCommentId`
	 * and `side`, so ANY host transition that changes one remounts it. A fresh
	 * instance mints a fresh idempotency key; the in-flight `fetch` has no
	 * `AbortController`; the unmount reports `onBusyChange(false)`. The first
	 * request still commits and the resubmit carries a key `bet_receipts`' UNIQUE
	 * cannot dedupe (ADR-0031) — one intent, two charges.
	 *
	 * The first cut of this file guarded ONE of seven call sites and both
	 * reviewers found it. The rule is therefore stated structurally: a
	 * `setSheet(` that is not inside `guard(` must carry an explicit
	 * `composerBusy` early-return in the same function.
	 */
	it("phone-tier::no-unguarded-sheet-OPEN-in-the-phone-owner", () => {
		const owner = code(read(`${PHONE_DIR}/PhoneDebateView.tsx`));
		/**
		 * ⚠⚠ SCOPED TO THE OPENINGS, AND THE SCOPE IS THE RULE RATHER THAN A
		 * CONVENIENCE. `setSheet({…})` is what can change `kind`,
		 * `parentCommentId` or `side` — the three fields in `BetComposer`'s `key`
		 * — so it is the direction that REMOUNTS a composer mid-request.
		 * `setSheet(null)` is a CLOSE, and the two closes that are not routed
		 * through the guarded `closeSheet` are both provably safe: `onPosted`
		 * fires AFTER the bet has committed (guarding it would leave the sheet
		 * open on success), and the parent-post sheet's `onEnter` closes a
		 * read-only sheet that is mutually exclusive with the composer — the slot
		 * is one union, so a composer cannot be open behind it.
		 * ⇒ A blanket rule over every `setSheet(` would have had to admit those
		 * two as exceptions, and an exception list is the thing a later edit
		 * quietly joins. A rule with no exceptions does not have that failure mode.
		 */
		/**
		 * ⛔⛔ BY BRACE MATCHING, NEVER BY A LOOKBACK WINDOW — and this is the
		 * second version, because the first did not discriminate. It scanned the
		 * 400 characters before each call for either `guard((` or an
		 * `if (composerBusy) return`, which is a DISTANCE fence, i.e. `O-8`'s "a
		 * character window is a line number wearing a different unit". Measured:
		 * with `openDetails` and `openReply` each stripped of their guard in turn,
		 * the row stayed GREEN both times — the window had reached back into a
		 * NEIGHBOURING function that still carried the busy check.
		 * ⇒ The enclosing region is computed by matching `guard(`'s own
		 * parentheses, so a call is inside it or it is not, at any distance.
		 * ⚠ And the production code was reduced to ONE shape in the same edit:
		 * `openReply` and `enterPost` used to early-return on `composerBusy`
		 * directly. Two shapes meant two things for this guard to recognise, which
		 * is what made a sloppy recogniser tempting.
		 */
		const guardRegions: [number, number][] = [];
		for (const m of owner.matchAll(/guard\(/g)) {
			const start = m.index ?? 0;
			let depth = 0;
			let i = start + "guard".length;
			for (; i < owner.length; i++) {
				const ch = owner[i];
				if (ch === "(") depth++;
				else if (ch === ")") {
					depth--;
					if (depth === 0) break;
				}
			}
			guardRegions.push([start, i]);
		}
		expect(
			guardRegions.length,
			"the owner still routes transitions through `guard(`",
		).toBeGreaterThanOrEqual(3);

		const opens = [...owner.matchAll(/setSheet\(\{/g)].map((m) => m.index ?? 0);
		expect(
			opens.length,
			"the owner still opens sheets at all",
		).toBeGreaterThanOrEqual(3);
		const unguarded: string[] = [];
		for (const at of opens) {
			const inside = guardRegions.some(([lo, hi]) => at > lo && at < hi);
			if (!inside) {
				unguarded.push(owner.slice(Math.max(0, at - 70), at + 30));
			}
		}
		expect(
			unguarded,
			"a sheet OPEN outside `guard(` can remount BetComposer mid-request " +
				"and mint a second idempotency key",
		).toEqual([]);
		// And the close path keeps its own guard.
		expect(owner).toMatch(/closeSheet = useCallback\(\(\) => \{\s*guard\(/);
		// POSITIVE CONTROL — the `guard` helper itself really does consult the
		// flag, so "inside a guard region" means something.
		expect(owner).toMatch(
			/const guard = useCallback\(\s*\(fn: \(\) => void\) => \{\s*if \(composerBusy\) \{/,
		);
	});
});
