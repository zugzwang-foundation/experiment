// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReplySplitBar } from "@/components/debate/composer/ReplySplitBar";
import type { Side } from "@/components/debate/types";

/**
 * POLISH.3 PR 2 · C1 — the `RR-3` pole-inversion guard (plan §7; §6 row 15).
 *
 * ⛔⛔ THIS GUARD'S COMMIT IS **C13, WHICH IS ATTENDED-ONLY AND DOES NOT RUN
 * UNATTENDED, AT ANY HOUR.** It is authored here because C1 authors §7's new
 * files, and it is EXPECTED TO REMAIN RED at the end of an unattended run. That
 * red is not a failure of the run — it is the standing proof that C13's work is
 * still outstanding. `composer/ReplySplitBar.tsx` is inside PR 2's own
 * ⛔ deny-listed directory (§10) and is reachable only as a named,
 * symbol-fenced exception, attended, with `@code-reviewer` AND
 * `@security-auditor` (§15).
 *
 * ⚠ THE `INV-3` LABEL IS STRUCK from this row. `RR-3`'s source
 * (`DISCOVERY-COMPLETE.md:280-292`) labelled it INV-3; that label is
 * SUPERSEDED. INV-3 is a STORAGE invariant (`comments.side_at_post_time`
 * immutable post-INSERT) and a Tailwind class in a client component cannot
 * violate it. The rule actually broken is the design-language AXIS correction:
 * "Support/Counter is a separate, post-relative relation, never a colour or
 * column" (`design-language.md:268`), and `CLAUDE.md` §8 — "the poles name the
 * SIDE (YES/NO), never the Support/Counter relation."
 *
 * ⚠ THE MOCKUP IS THIS ROW'S POSITIVE CONTROL **AT ITS TRIGGERS ONLY** (plan
 * §7, V-2 — whose closing sentence overreaches; surfaced to the founder). It
 * poles the split-bar TRIGGERS by RESULTING SIDE — right-column Support is
 * `.rbtn2 n`, Counter `.rbtn2 y` (`d5:1247,1249`), confirmed in JS at
 * `d5:1591-1592`, which set those two buttons' classNames and nothing else.
 * ⛔ ITS BAR IS NOT A CONTROL — IT IS A ROUTE-3 INSTANCE. `d5:1248` carries no
 * side class; `.barrow .bar` is a fixed `--n0` over a fixed `--ink` `.fill`
 * (`:510-512`); `.bar .fill.right` (`:513`) is never applied; `:1596` sets only
 * the fill's width. The annotated post is `side:'no'` with `sPct:69`, so d5
 * paints a NO post's SUPPORT share in the YES pole.
 * ⇒ C13 is a DELIBERATE DIVERGENCE from the artifact's bar on the
 * design-language rule, not a return to it. The component's own sibling
 * `(ReplySplitBar → TriggerPill → the pole const)` was always right; the track
 * and fill spans were the fixed pair, corrected at C13.
 *
 * ⛔ QUERIED STRUCTURALLY, ON PURPOSE — NO TESTID IS INTRODUCED. §10's safety
 * argument for the `composer/**` exception IS its narrowness: "the edit is TWO
 * CLASS STRINGS ON TWO ADJACENT SPANS ... It adds no prop, no branch, no data
 * path, and no write." Adding a `data-testid` would widen the ratified
 * exception, so this guard finds the track by its layout classes — which the
 * fix does not touch — and the fill as its child.
 *
 * ⚠ FOUR POLE ASSERTIONS, NOT TWO. Two of them pass today by accident (the
 * YES-post case is correct where the poles are fixed), which is exactly why a
 * YES-only test would have shipped the inversion. The NO-post pair is the
 * defect.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM only.
 */

afterEach(cleanup);

/** Asymmetric on purpose — a 50/50 split hides a swapped fill. */
const AGGREGATE = {
	supportCount: 2,
	counterCount: 1,
	supportDharma: "1000.000000000000000000",
	counterDharma: "2000.000000000000000000",
};

const noop = () => {};

/** The track is the only span carrying the bar's clip; the fill is its child.
 * Both survive the fix, which rewrites only the pole token in each class. */
function bar(postSide: Side) {
	const { container } = render(
		<ReplySplitBar
			postSide={postSide}
			aggregate={AGGREGATE}
			heldSide={null}
			marketOpen={true}
			suspended={false}
			activeRelation={null}
			onToggleRelation={noop}
		/>,
	);
	const track = Array.from(container.querySelectorAll("span")).find((s) =>
		(s.getAttribute("class") ?? "").includes("overflow-hidden"),
	);
	expect(track).toBeDefined();
	const fill = track?.firstElementChild;
	expect(fill).not.toBeNull();
	return {
		track: track?.getAttribute("class") ?? "",
		fill: fill?.getAttribute("class") ?? "",
	};
}

describe("POLISH.3 PR 2 — RR-3, the split bar's poles name the SIDE", () => {
	it("reply-split-bar::on-a-YES-post-the-support-fill-takes-the-YES-pole", () => {
		// Assertion 1 of 4. Support inherits the post's side: YES.
		expect(bar("YES").fill).toContain("bg-yes");
	});

	it("reply-split-bar::on-a-YES-post-the-track-takes-the-NO-pole", () => {
		// Assertion 2 of 4. The remainder is the counter share: NO.
		expect(bar("YES").track).toContain("bg-no");
	});

	it("reply-split-bar::on-a-NO-post-the-support-fill-takes-the-NO-pole", () => {
		// ⛔ Assertion 3 of 4 — THE LIVE INVERSION. Support on a NO post
		// resolves to NO, so this fill must be the NO pole. The build hard-codes
		// `bg-yes` at `:67`, rendering the NO-side share in the YES pole on
		// every NO post: a lie about which side an argument backs.
		expect(bar("NO").fill).toContain("bg-no");
	});

	it("reply-split-bar::on-a-NO-post-the-track-takes-the-YES-pole", () => {
		// ⛔ Assertion 4 of 4, the mirror. The build hard-coded the counter pole.
		expect(bar("NO").track).toContain("bg-yes");
	});

	it("reply-split-bar::the-track-keeps-a-visible-edge-on-BOTH-poles", () => {
		// ⛔ THE POLE FIX IS NOT SAFE WITHOUT THIS, and the first draft of C13
		// shipped without it (@security-auditor MEDIUM). Side-keying the track
		// means it takes `bg-yes` #181818 on a NO post against a `bg-card` →
		// `--color-n0` #212121 surface — ~1.10:1, invisible — so the fill has no
		// visible extent to be a proportion OF. Correcting the pole without the
		// edge trades an INVERSION for an ERASURE on the very post side this row
		// exists to fix.
		// ⚠ Asserted on BOTH poles, not just the failing one: the four pole
		// assertions above are positive-only `toContain`, so nothing else in this
		// file would notice the edge being deleted.
		expect(bar("YES").track).toContain("[border:var(--hairline)]");
		expect(bar("NO").track).toContain("[border:var(--hairline)]");
	});
});
