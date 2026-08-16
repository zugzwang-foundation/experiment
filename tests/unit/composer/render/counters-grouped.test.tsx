// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";
import { COMPOSER_COPY } from "@/components/debate/composer/copy";
import {
	extendedMaxChars,
	TITLE_MAX_CHARS,
} from "@/components/debate/composer/payload";
import { COMMENT_MAX_LENGTH } from "@/server/config/limits";

import { composerProps, stubWireFetch } from "./_harness";

/**
 * POLISH.4 PR B · R3 — BOTH CHARACTER COUNTERS GROUP THOUSANDS.
 *
 * Baseline is TIER 2, not merely tier 4: `docs/design/design-canon.md` §6
 * Composer register — *"counters `58 / 125`, `158 / 2,200 · optional`"* — and
 * the tier-4 mockup agrees (`surface_d5_v1_0.html`, md5
 * 34619dacee472a245cb6e8678b509219, `<div class="counter">91 / 2,200 ·
 * optional</div>` at :1130).
 *
 * The built composer renders `{extended.length} / {extendedMax}` raw, so with
 * an empty title the body counter reads `0 / 4998`. RED at `8db535d`.
 *
 * Every number here is derived from the REAL constants — `COMMENT_MAX_LENGTH`
 * (limits.ts) through `extendedMaxChars` (payload.ts) and `TITLE_MAX_CHARS` —
 * never a hardcoded cap.
 *
 * `O-7` — `textContent` is used only to LOCATE the counter element; every
 * assertion reads `innerHTML`.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/**
 * SPEC.1 §10.8 grouping — the literal ASCII comma, in threes, over the integer
 * part. Identical to the mockup's own `fmt` regex (d5:1448) and to
 * `format.ts::groupInteger`; written out here so the EXPECTATION is
 * independent of whichever helper the fix reaches for.
 */
function group(n: number): string {
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** `N / M`, grouped or not — the counter shape. */
const COUNTER_SHAPE = /\d[\d,]*\s*\/\s*\d[\d,]*/;

/**
 * The counter elements, innermost only: an ancestor that merely CONTAINS a
 * counter is not the counter, and reading one would sweep in the textarea's
 * own `maxlength` attribute (which carries the ungrouped cap and would make
 * the negative assertion unfalsifiable).
 */
function counters(root: HTMLElement): HTMLElement[] {
	const hits = Array.from(root.querySelectorAll<HTMLElement>("*")).filter(
		(el) => COUNTER_SHAPE.test(el.textContent ?? ""),
	);
	return hits.filter(
		(el) => !hits.some((other) => other !== el && el.contains(other)),
	);
}

/** The body counter carries the ` · optional` suffix; the title counter does not. */
function bodyCounter(root: HTMLElement): HTMLElement {
	const suffix = COMPOSER_COPY.optionalSuffix.trim();
	const found = counters(root).filter((el) =>
		(el.textContent ?? "").includes(suffix),
	);
	expect(found).toHaveLength(1);
	return found[0];
}

function titleCounter(root: HTMLElement): HTMLElement {
	const suffix = COMPOSER_COPY.optionalSuffix.trim();
	const found = counters(root).filter(
		(el) => !(el.textContent ?? "").includes(suffix),
	);
	expect(found).toHaveLength(1);
	return found[0];
}

function renderComposer(): HTMLElement {
	stubWireFetch([]);
	const { container } = render(<BetComposer {...composerProps()} />);
	return container;
}

describe("BetComposer character counters group thousands (R3)", () => {
	it("render::body-counter-groups-the-cap-and-leaves-sub-thousand-alone", () => {
		const container = renderComposer();
		// The cap the counter must render: COMMENT_MAX_LENGTH − title(0) − 2.
		const cap = extendedMaxChars(0);
		expect(cap).toBe(COMMENT_MAX_LENGTH - 2);

		const body = bodyCounter(container).innerHTML;
		expect(body).toContain(group(cap)); // "4,998"
		expect(body).not.toContain(String(cap)); // "4998" must not survive

		// Belt: grouping must not touch a sub-thousand value — the title cap
		// renders intact, unseparated.
		const title = titleCounter(container).innerHTML;
		expect(title).toContain(String(TITLE_MAX_CHARS));
	});

	it("render::body-counter-groups-its-own-count", () => {
		const container = renderComposer();
		const typed = "a".repeat(1234);
		fireEvent.change(screen.getByLabelText("Argument body"), {
			target: { value: typed },
		});

		const body = bodyCounter(container).innerHTML;
		expect(body).toContain(group(typed.length)); // "1,234"
		expect(body).not.toContain(String(typed.length)); // "1234"
	});
});
