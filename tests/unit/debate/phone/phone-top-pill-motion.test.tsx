// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneTopPill } from "@/components/debate/phone/PhoneTopPill";

/**
 * MOBILE-2k · F-1 — THE PILL'S MOTION, AND THE THREE PLACES ITS TWO NUMBERS ARE
 * WRITTEN. Plan §3 row G11.
 *
 * ⛔⛔ 200 IS WRITTEN TWICE IN ONE FILE AND A THIRD TIME IN ANOTHER, AND NONE OF
 * THE THREE CAN BE DELETED. `EXIT_MS` is JavaScript — it is how long the element
 * is kept mounted so the exit can be seen. `duration-[200ms]` is a Tailwind
 * class, and Tailwind's scanner needs a LITERAL in the source to emit the
 * utility at all: interpolating the constant produces a class that silently does
 * not exist (AGENTS.md §9's stale-utility trap). And `PhoneSheet`'s `CLOSE_MS`
 * is the same 200 because the brief says the pill takes that sheet's motion
 * verbatim. So three copies, by necessity — which is exactly the shape where a
 * comment asking the next reader to keep numbers in step is not a mechanism.
 *
 * ⚠ THE FAILURE IS INVISIBLE RATHER THAN BROKEN. An element unmounted after
 * 200ms while its animation is declared at 260 is cut off mid-slide; declared at
 * 140 it sits still for 60ms before vanishing. Neither errors, neither is
 * reported, and both look like "the animation is a bit off" to whoever
 * eventually notices.
 *
 * ⚠ EVERY DURATION BELOW IS PARSED, NEVER TYPED. The only numbers written in
 * this file are the two the brief ruled (260 open, 200 close) and they appear in
 * ONE row, as the ruling. Everything else is read off the rendered class string
 * or the source and compared.
 */
const ROOT = process.cwd();
const PILL = "src/components/debate/phone/PhoneTopPill.tsx";
const SHEET = "src/components/debate/phone/PhoneSheet.tsx";
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** The brief's ruled pair (plan §1: enter 260 ease-out, exit 200 ease-in). */
const RULED_ENTER_MS = 260;
const RULED_EXIT_MS = 200;

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh }),
	useParams: () => ({ slug: "bitcoin-price-50k" }),
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	vi.useRealTimers();
});

/** A named `const <NAME> = <n>` read out of the file that declares it. */
function msConstant(file: string, name: string): number {
	const m = new RegExp(`const ${name} = (\\d+)`).exec(read(file));
	if (!m?.[1]) {
		throw new Error(
			`${file}: no \`const ${name} = <n>\` declaration — the constant this row ` +
				"pins has been renamed or removed, and the pin cannot be re-derived",
		);
	}
	return Number(m[1]);
}

/** The `duration-[Nms]` inside a class fragment, thrown on if absent. */
function durationOf(fragment: string, what: string): number {
	const m = /duration-\[(\d+)ms\]/.exec(fragment);
	if (!m?.[1]) {
		throw new Error(`${what}: no \`duration-[Nms]\` — ${fragment}`);
	}
	return Number(m[1]);
}

/**
 * `PhoneSheet`'s panel branch, located by the animation it carries rather than
 * by a line or a character window (`O-8`).
 */
function sheetPanelBranch(phase: "enter" | "leave"): string {
	const pattern =
		phase === "leave"
			? /animate-out slide-out-to-bottom-full[^"`]*/
			: /animate-in slide-in-from-bottom-full[^"`]*/;
	const m = pattern.exec(read(SHEET));
	if (!m) {
		throw new Error(
			`${SHEET}: no ${phase} branch on the panel — the sheet's own motion has ` +
				"been renamed, so the pill has nothing left to be verbatim with",
		);
	}
	return m[0];
}

function controllable(node: HTMLElement, viewport = 800): HTMLElement {
	let top = 0;
	Object.defineProperty(node, "scrollTop", {
		configurable: true,
		get: () => top,
		set: (value: number) => {
			top = value;
		},
	});
	Object.defineProperty(node, "clientHeight", {
		configurable: true,
		get: () => viewport,
	});
	return node;
}

const pill = () =>
	document.querySelector<HTMLButtonElement>('[data-testid="phone-top-pill"]');

function mountPill() {
	const region = controllable(document.createElement("div")) as HTMLDivElement;
	document.body.appendChild(region);
	render(
		<PhoneTopPill
			regionRef={{ current: region }}
			locked={false}
			busy={false}
		/>,
	);
	return region;
}

function scrollTo(region: HTMLElement, top: number): void {
	act(() => {
		region.scrollTop = top;
		region.dispatchEvent(new Event("scroll"));
	});
}

/** Deep in the feed, then rising — the one gesture that shows the pill. */
function driveShow(region: HTMLElement): void {
	scrollTo(region, 2000);
	scrollTo(region, 1500);
}

/** Moving down again — the reader is reading, so the pill leaves. */
function driveHide(region: HTMLElement): void {
	scrollTo(region, 1600);
}

function classOfPill(what: string): string {
	const el = pill();
	if (el === null) {
		throw new Error(`no pill on screen while reading its ${what} class`);
	}
	return el.getAttribute("class") ?? "";
}

describe("MOBILE-2k · F-1 — the two motion numbers agree across three sites (G11)", () => {
	it("phone-top-pill-motion::EXIT_MS-is-the-leaving-durations-number", () => {
		const region = mountPill();
		driveShow(region);
		const entering = classOfPill("entering");
		driveHide(region);
		const leaving = classOfPill("leaving");

		expect(
			pill()?.getAttribute("data-phase"),
			"precondition: the pill is in its leaving phase, so the class read " +
				"above is the exit branch and not the enter branch again",
		).toBe("leaving");

		expect(
			durationOf(leaving, "the pill's leaving branch"),
			`the pill animates out for ${durationOf(leaving, "exit")}ms and is ` +
				`unmounted after ${msConstant(PILL, "EXIT_MS")}ms — the gap is a ` +
				"slide cut short, or a still element waiting to disappear",
		).toBe(msConstant(PILL, "EXIT_MS"));

		// POSITIVE CONTROL — the two branches really are different numbers, so the
		// equality above is an agreement between two reads rather than a regex
		// matching whichever duration it found first.
		expect(durationOf(entering, "the pill's entering branch")).not.toBe(
			durationOf(leaving, "the pill's leaving branch"),
		);
	});

	it("phone-top-pill-motion::the-pair-is-PhoneSheets-pair-verbatim", () => {
		const region = mountPill();
		driveShow(region);
		const entering = classOfPill("entering");
		driveHide(region);
		const leaving = classOfPill("leaving");

		const pillEnter = durationOf(entering, "the pill's entering branch");
		const pillLeave = durationOf(leaving, "the pill's leaving branch");
		const sheetEnter = durationOf(
			sheetPanelBranch("enter"),
			"the sheet's entering panel",
		);
		const sheetLeave = durationOf(
			sheetPanelBranch("leave"),
			"the sheet's leaving panel",
		);

		expect(
			[pillEnter, pillLeave],
			"the brief takes `PhoneSheet`'s motion verbatim: 260 in, 200 out. A " +
				"floating control that moves at its own speed is a second motion " +
				"vocabulary on a surface that has one",
		).toEqual([RULED_ENTER_MS, RULED_EXIT_MS]);
		expect([sheetEnter, sheetLeave]).toEqual([pillEnter, pillLeave]);
		expect(
			msConstant(PILL, "EXIT_MS"),
			"the pill's JS constant and the sheet's JS constant are the same 200, " +
				"and neither imports the other — so nothing but this row keeps them " +
				"together",
		).toBe(msConstant(SHEET, "CLOSE_MS"));

		// The easings travel with the durations: settling down on the way in,
		// lifting away on the way out.
		expect(entering).toContain("ease-out");
		expect(leaving).toContain("ease-in");
		expect(sheetPanelBranch("enter")).toContain("ease-out");
		expect(sheetPanelBranch("leave")).toContain("ease-in");
	});

	/**
	 * ⛔ REDUCED MOTION IS A FADE WITH NO TRAVEL, and the reduced token is DERIVED
	 * from the travel token rather than named twice. The brief rules
	 * `motion-reduce:slide-*-top-0` against `slide-*-top-[6px]`: same direction,
	 * zero distance. Deriving it is what makes a direction change red — a build
	 * that moved the travel to `slide-in-from-bottom-[6px]` while leaving the
	 * reduced override pointing at `top` would be two rules about two different
	 * axes, and a hand-typed expectation would not notice.
	 */
	it("phone-top-pill-motion::reduced-motion-keeps-the-fade-and-drops-the-travel", () => {
		const region = mountPill();
		driveShow(region);
		const entering = classOfPill("entering");
		driveHide(region);
		const leaving = classOfPill("leaving");

		for (const [phase, cls] of [
			["entering", entering],
			["leaving", leaving],
		] as [string, string][]) {
			const travel = /slide-(?:in-from|out-to)-[a-z]+-\[(\d+)px\]/.exec(cls);
			if (!travel) {
				throw new Error(
					`the pill's ${phase} branch declares no \`slide-…-[Npx]\` travel — ` +
						"the 6px settle/lift is gone, and the reduced-motion override " +
						"below has nothing to be the zero of",
				);
			}
			expect(
				Number(travel[1]),
				"the brief rules a 6px settle in and a 6px lift out",
			).toBe(6);
			// The SAME token, at zero distance, under the reduced-motion variant.
			const zeroed = `motion-reduce${":"}${travel[0].replace(/-\[\d+px\]$/, "-0")}`;
			expect(
				cls.split(/\s+/),
				`the ${phase} branch travels ${travel[1]}px and its reduced-motion ` +
					`override is not the zero of that same movement (${zeroed}) — a ` +
					"reader who asked for no motion gets the travel anyway, or gets a " +
					"rule about an axis this branch does not move on",
			).toContain(zeroed);
			// ...and the fade survives, because that is the whole of what remains.
			expect(cls).toMatch(/fade-(?:in|out)-0/);
		}
	});
});

describe("MOBILE-2k · F-1 — the constant is what keeps the exit on screen", () => {
	/**
	 * ⛔⛔ THE BEHAVIOURAL HALF, AND IT IS WHAT MAKES `EXIT_MS` LOAD-BEARING
	 * RATHER THAN DECORATIVE. The rows above prove three numbers agree; a build
	 * that unmounted the pill on the frame `shown` went false would satisfy every
	 * one of them and still have no exit animation at all, because there would be
	 * no element left to animate.
	 *
	 * ⚠ THE WINDOW IS READ FROM THE SOURCE, not typed. If somebody changes
	 * `EXIT_MS` this row follows them; what it will not tolerate is the element
	 * leaving before the window or staying after it.
	 */
	it("phone-top-pill-motion::the-pill-is-kept-mounted-for-exactly-EXIT_MS", () => {
		vi.useFakeTimers();
		const exitMs = msConstant(PILL, "EXIT_MS");
		const region = mountPill();
		driveShow(region);
		expect(pill()?.getAttribute("data-phase")).toBe("open");

		driveHide(region);
		expect(
			pill(),
			"the pill was removed on the frame it stopped being wanted, so the 6px " +
				"lift is never seen — an exit animation on an unmounted element is " +
				"200ms of class strings nobody can look at",
		).not.toBeNull();
		expect(pill()?.getAttribute("data-phase")).toBe("leaving");

		act(() => {
			vi.advanceTimersByTime(exitMs - 1);
		});
		expect(
			pill(),
			`the pill left before its own ${exitMs}ms window elapsed`,
		).not.toBeNull();

		act(() => {
			vi.advanceTimersByTime(2);
		});
		expect(
			pill(),
			`the pill is still mounted past ${exitMs}ms — a finished animation ` +
				"holding a live button, and a tab stop, over the feed",
		).toBeNull();
	});
});
