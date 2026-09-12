import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ARRIVING AT A MARKET SHOWS THE MARKET, NEVER A COMPOSER LEFT OPEN ELSEWHERE.
 *
 * WHAT THIS GUARD IS FOR. Reported from staging: enter focus, open Buy, press
 * Home in the header, then open the same market again — and it opens straight
 * into the staking form rather than the reading view. `DebateView` answers it
 * with one effect keyed on `usePathname()` that closes every composer it owns,
 * so a route change can never leave one behind.
 *
 * ⚠⚠ THE EFFECT IT PINS IS DELIBERATELY BELT-AND-BRACES, and this guard is what
 * keeps it from being read as dead code and deleted. Every path in the file
 * predicts the state dies on its own: `openSide` / `focusMode` / `openReply` are
 * `useState` with no initializer, nothing outside a click handler sets them, no
 * storage is written anywhere in `src/components/`, only `?post=` is mirrored
 * into the URL, and `instant = false` on the route rules out Next preserving the
 * tree. On a genuine remount the effect is a no-op React bails out of. It exists
 * because the behaviour was REPORTED and the reading could not account for it,
 * and it removes the class rather than a mechanism.
 *
 * ⛔ THE DEPENDENCY IS THE WHOLE POINT, WHICH IS WHY IT HAS ITS OWN CASE.
 * `[pathname]` is a re-run TRIGGER, not a read, so Biome's
 * `useExhaustiveDependencies` calls it unnecessary and offers to remove it —
 * and taking that offer silently converts the effect to mount-only, which is
 * exactly the case that was already covered and not the one being fixed. The
 * defect would come back with a green lint run and a green suite. `HeaderNav`
 * carries the same shape and the same suppression.
 *
 * ⚠⚠ WHY A SOURCE SCAN AND NOT A RENDER TEST. Mounting `DebateView` drags in
 * `BetComposer`, the bet server actions, the quote reader and the R2 upload
 * chain; a mock deep enough to host that stack proves the mock rather than the
 * component. `debate-view-freeze.test.ts` states the same limit for the same
 * reason and is the technique this file follows. What is asserted here IS a
 * claim about the source.
 *
 * ⛔ FENCE BY SYMBOL, NEVER BY LINE (O-8). Every anchor below names an
 * identifier — `usePathname`, `setOpenSide`, `setFocusMode`, `setOpenReply` —
 * and no line number is load-bearing.
 *
 * ⚠⚠ WATCHED FAILING BEFORE IT WAS TRUSTED (V-2). With `[pathname]` narrowed to
 * `[]` the dependency case goes RED; with the effect deleted outright, all four
 * go RED. A guard nobody has seen fail is a guard nobody has tested.
 */

const ROOT = process.cwd();
const VIEW = "src/components/debate/DebateView.tsx";
const source = readFileSync(join(ROOT, VIEW), "utf8");

/**
 * The reset effect's whole text, from its `useEffect(` through the `[pathname]`
 * dependency array that closes it. Anchored on the setter it exists to call
 * rather than on a line range, so the body may grow or be reformatted without
 * this guard needing to be re-derived.
 */
function resetEffect(): string {
	const marker = source.indexOf("setOpenSide(null);\n\t\tsetFocusMode(false);");
	if (marker === -1) {
		throw new Error(
			`${VIEW}: no route-change reset effect clearing \`setOpenSide\` and ` +
				`\`setFocusMode\` together. If the reset was restructured, re-derive ` +
				`this guard rather than deleting it — the staging defect it answers ` +
				`is a composer surviving a navigation.`,
		);
	}
	const start = source.lastIndexOf("useEffect(", marker);
	// ⚠ THE CLOSING DEPENDENCY ARRAY, NOT THE FIRST `);`. An earlier draft of
	// this helper searched for `");"` and matched inside `setOpenSide(null);` —
	// truncating the slice two lines into the body, so the dependency assertion
	// failed against a fix that was present and correct. A guard that reports a
	// defect in working code is worse than no guard, and this one did it on its
	// first run, which is the whole argument for watching a guard fail.
	const end = source.indexOf("]);", marker);
	if (start === -1 || end === -1) {
		throw new Error(`${VIEW}: the reset effect never terminates.`);
	}
	return source.slice(start, end + "]);".length);
}

describe("the route-change reset — a navigation leaves no composer behind", () => {
	it("route-reset::the-effect-is-keyed-on-pathname", () => {
		// ⛔ THE ASSERTION THIS FILE EXISTS FOR. Narrow the dependency array to
		// `[]` — which is exactly what Biome's autofix offers — and this goes red.
		// Without it the effect runs only on mount, where the state is already
		// clear, and the reported defect returns with everything green.
		expect(resetEffect()).toContain("[pathname]");
	});

	it("route-reset::pathname-comes-from-the-router", () => {
		// The trigger has to be the ROUTE, not a prop or a local. A `pathname`
		// that is not `usePathname()`'s does not change when the reader navigates.
		expect(source).toContain("usePathname");
		expect(source).toMatch(/const\s+pathname\s*=\s*usePathname\(\)/);
	});

	it("route-reset::every-composer-this-view-owns-is-closed", () => {
		const effect = resetEffect();

		// All three, because all three survive together or not at all: the market
		// arm's Đ BET composer, the focus posture that compacts the header, and
		// the post arm's reply composer. Closing two of three leaves the surface
		// in a state no click can produce.
		expect(effect).toContain("setOpenSide(null)");
		expect(effect).toContain("setFocusMode(false)");
		expect(effect).toContain("setOpenReply(null)");
	});

	it("route-reset::the-reset-only-ever-closes", () => {
		const effect = resetEffect();

		// ⛔ It must never OPEN anything. An effect that set a side would be a
		// composer nobody asked for on every navigation — the defect inverted,
		// and harder to see because it would look like the fix.
		expect(effect).not.toMatch(/setOpenSide\(\s*["']/);
		expect(effect).not.toContain("setFocusMode(true)");
	});
});
