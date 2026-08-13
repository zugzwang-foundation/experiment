// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DebateRouteError from "@/app/(public)/m/[slug]/error";

/**
 * POLISH.3 D4 / PD-3-11 — the `/m/[slug]` error boundary.
 *
 * Gate C read-1 Q1. The boundary shipped at `9468c30` with its no-leak property
 * asserted only by a docblock, while the precedent it copies verbatim
 * (`(auth)/error.tsx`, ruled at R-C) carries five tests. A comment is not a
 * guard: it is an unverified claim that reviewers read as findings-free. This
 * file makes the claim executable.
 *
 * ⚠ WHY THE ABSENCE ASSERTIONS ARE CONTAINER-WIDE AND THE PRESENCE ASSERTIONS
 * ARE NOT. Guard form is keyed to guard CLASS, not to surface (PF-7):
 *
 *   - An ABSENCE / LEAK guard must scope to the WHOLE rendered output. A
 *     targeted negative proves only that the secret is absent from the nodes
 *     you happened to query, which says nothing about a second render path —
 *     V-3 pointed at a DOM. `CLAUDE.md` §5.14 SC-1 mandates exactly this form
 *     ("assert the BODY's absence, not the row's"), and
 *     `auth-error-boundary.test.tsx` uses `container.innerHTML` for it.
 *   - A COPY / PRESENCE guard takes targeted queries, which is PF-3 and is
 *     UNCHANGED for `market-header.test.tsx`. ⚠ PF-3 is not overturned here.
 *     Its ground is that C5 removes the dev box from *that* component one
 *     commit later, so a container-wide assertion there would go RED on an
 *     unrelated deletion. That ground is simply false of this file: nothing
 *     removes content from this boundary, and `not.toContain(secret)` is
 *     insensitive to unrelated content movement in any case.
 *
 * ⛔ NO SNAPSHOT AND NO BYTE-PIN anywhere in this file. That, not query
 * breadth, is the fragility PF-3 exists to prevent.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

/**
 * An error carrying a distinctive planted string in each field a boundary could
 * leak. Distinctive so a match cannot be coincidental.
 *
 * ⚠ THE FIXTURE MUST MATCH PRODUCTION SHAPE, OR THE ABSENCE ASSERTION COVERS
 * ONLY THE LEAK SHAPES NOBODY WRITES (@security-auditor, POLISH.3 R6). Two
 * earlier shortcuts each let a realistic leak through:
 *
 *   - `cause` was a bare STRING. In production `cause` comes from
 *     `new Error(msg, { cause: err })` and is virtually always an Error, so the
 *     idiomatic unwrap `cause instanceof Error ? cause.message : null`
 *     evaluated to `null` and the guard stayed GREEN on a real leak. It is now
 *     a real Error, with its OWN planted markers in `message` and `stack`.
 *   - `stack` was ONE LINE with the marker at position 0. A real stack is
 *     `"Error: <msg>\n    at …"`, so the normal "frames only, drop the header"
 *     idiom `stack.split("\n").slice(1).join("\n")` rendered empty and the
 *     guard stayed GREEN. The marker now sits on a FRAME line, not the header.
 */
function thrown() {
	const cause = new Error("LEAK_CAUSE_MESSAGE_debate_view_load_failed");
	cause.stack =
		"Error: LEAK_CAUSE_MESSAGE_debate_view_load_failed\n" +
		"    at LEAK_CAUSE_FRAME (src/server/debate-view/load-debate-view.ts:88:11)";

	const err = new Error("LEAK_MESSAGE_pg_connection_refused_m3q7") as Error & {
		digest?: string;
	};
	err.digest = "LEAK_DIGEST_4b81ce";
	// Header line first, marker on a FRAME line — the production shape.
	err.stack =
		"Error: LEAK_MESSAGE_pg_connection_refused_m3q7\n" +
		"    at LEAK_STACK_FRAME (src/app/(public)/m/[slug]/page.tsx:99:7)";
	err.cause = cause;
	return err;
}

const SECRETS = [
	"LEAK_MESSAGE_pg_connection_refused_m3q7",
	"LEAK_DIGEST_4b81ce",
	"LEAK_STACK_FRAME",
	"LEAK_CAUSE_MESSAGE_debate_view_load_failed",
	"LEAK_CAUSE_FRAME",
];

afterEach(cleanup);

describe("POLISH.3 — /m/[slug] error boundary", () => {
	it("market-error::renders-the-state-family-copy", () => {
		render(<DebateRouteError error={thrown()} reset={() => {}} />);

		const root = screen.getByTestId("debate-error");
		expect(root.querySelector("h1")?.textContent).toBe("Something went wrong.");
		expect(root.querySelector("p")?.textContent).toBe(
			"An unexpected error stopped this page from loading.",
		);
		expect(root.querySelector("button")?.textContent).toBe("Try again");
	});

	it("market-error::wires-reset-to-the-only-affordance", () => {
		// `reset` is the sole interactive element on this surface. If it is not
		// wired the boundary is a dead end — the participant's only escape is a
		// manual reload, and nothing else on the page would reveal that.
		const reset = vi.fn();
		render(<DebateRouteError error={thrown()} reset={reset} />);

		fireEvent.click(screen.getByText("Try again"));
		expect(reset).toHaveBeenCalledTimes(1);
	});

	it("market-error::leaks-NOTHING-from-the-error-message-stack-digest-cause", () => {
		const { baseElement } = render(
			<DebateRouteError error={thrown()} reset={() => {}} />,
		);
		// ⚠ `baseElement` (document.body), NOT `container`. A `createPortal`
		// renders OUTSIDE `container`, so a container-scoped absence guard cannot
		// see it — measured: `{error.message}` rendered through a portal left this
		// assertion GREEN (@security-auditor, POLISH.3 R7). Not hypothetical:
		// `src/components/ui/dialog.tsx` wraps `DialogContent` in `DialogPortal`,
		// so a "Show details" modal built from the components already on disk
		// lands outside `container` by default. PF-7 says an absence guard scopes
		// to the WHOLE rendered output; `container` was not it.
		const html = baseElement.innerHTML;

		// ── POSITIVE CONTROL 1: the component actually rendered. Without this the
		//    absences below would pass just as happily against "".
		//    ⚠ The `toContain` is the whole control. A length floor was tried and
		//    dropped: an EMPTY `PageContainer` with this testid already
		//    serialises to 93 characters, so a `> 100` threshold had seven
		//    characters of headroom and contributed nothing it did not already
		//    imply (@security-auditor, POLISH.3 R6).
		expect(html).toContain("Something went wrong.");

		// ── POSITIVE CONTROL 2: the planted strings are really ON the error
		//    object. A typo in `thrown()` would otherwise make every absence
		//    below trivially true — V-2, a negative assertion needs a positive
		//    control, and the control has to cover the FIXTURE, not just the
		//    render.
		const err = thrown();
		expect(err.message).toContain(SECRETS[0]);
		expect(err.digest).toContain(SECRETS[1]);
		expect(err.stack).toContain(SECRETS[2]);
		expect((err.cause as Error).message).toContain(SECRETS[3]);
		expect((err.cause as Error).stack).toContain(SECRETS[4]);

		// ── THE ASSERTION. Container-wide: a leak anywhere in the subtree fails.
		for (const secret of SECRETS) {
			expect(html).not.toContain(secret);
		}

		// ── POSITIVE CONTROL 3 — REACHABILITY, for EVERY secret. Prove the
		//    matcher CAN find each string when present, through this same
		//    harness. Otherwise the absences are absences of unknown
		//    detectability. ⚠ An earlier version proved reachability for two of
		//    the five and read as if it covered all of them.
		const leaky = render(
			<p>
				{err.message} {err.digest} {err.stack} {(err.cause as Error).message}{" "}
				{(err.cause as Error).stack}
			</p>,
		);
		for (const secret of SECRETS) {
			expect(leaky.container.innerHTML).toContain(secret);
		}
	});

	it("market-error::the-error-prop-is-never-read-during-render-effects-or-handlers", async () => {
		// ⚠ THE ARM THAT PROTECTS IS THE CLIENT ONE. In a production build
		// React's Flight client already replaces a SERVER-side error with a fixed
		// placeholder, so a server throw has nothing left to leak; an error
		// thrown in the browser or during hydration arrives here as the REAL
		// unsanitized Error. This test renders the component directly, which IS
		// the client arm — the fixture above is a live `Error`, not a sanitized
		// placeholder, so the absences proven above are proven for the arm that
		// actually matters.
		//
		// The structural half, proven at RUNTIME rather than by reading the
		// source: every field is a getter that THROWS. The component
		// destructures `{ reset }` only, so it never touches one — if a future
		// edit reads `error.message` even to log it, this render throws and this
		// test fails. That is strictly stronger than asserting the four strings
		// are absent from the DOM: it forbids the READ, not just the render.
		const booby = {
			get message(): string {
				throw new Error("component read error.message");
			},
			get digest(): string {
				throw new Error("component read error.digest");
			},
			get stack(): string {
				throw new Error("component read error.stack");
			},
			get cause(): unknown {
				throw new Error("component read error.cause");
			},
		} as unknown as Error & { digest?: string };

		const untouched = render(
			<DebateRouteError error={booby} reset={() => {}} />,
		);
		expect(
			untouched.container.querySelector('[data-testid="debate-error"]'),
		).not.toBeNull();
		expect(untouched.container.innerHTML).toContain("Something went wrong.");

		// ⚠ RENDER AND EFFECTS ARE NOT THE WHOLE SURFACE. `act()` flushes passive
		// effects, so a `useEffect` touching `error` throws above — but it NEVER
		// invokes an event handler, and a handler closure over `error` is the
		// single likeliest future edit to an error boundary: a "Show details"
		// affordance is exactly what this component's own docblock warns the
		// next engineer against. Measured: a boundary carrying
		// `onClick={() => { document.title = error.message }}` passed every
		// other assertion in this file GREEN (@security-auditor, POLISH.3 R6).
		//
		// ⚠ AND A THROWING GETTER IS THE WRONG INSTRUMENT HERE. React catches a
		// handler throw, so Vitest reports it as an UNHANDLED ERROR — non-zero
		// exit, but the test itself still prints "passed", and Vitest's own
		// warning is that this "might cause false positive tests". Measured too.
		// So the handler sweep uses a RECORDING fixture instead: reads are
		// logged, never thrown, and the assertion is on the log. Deterministic
		// failure, no reliance on how a runner surfaces an uncaught throw.
		cleanup();
		const reads: string[] = [];
		const tattle = {
			get message() {
				reads.push("message");
				return "";
			},
			get digest() {
				reads.push("digest");
				return "";
			},
			get stack() {
				reads.push("stack");
				return "";
			},
			get cause() {
				reads.push("cause");
				return undefined;
			},
		} as unknown as Error & { digest?: string };

		const swept = render(<DebateRouteError error={tattle} reset={() => {}} />);
		expect(reads).toEqual([]); // nothing read during render or effects

		// ⚠ EVERY NODE, NOT A SELECTOR OF LIKELY ONES. `expect(reads).toEqual([])`
		// is an ABSENCE assertion, so PF-7 governs it and its scope must be the
		// whole rendered output. An earlier version swept
		// `"button, a, [role='button'], [tabindex]"` and claimed "no handler on
		// this surface" — four element kinds wide while reading as total. A bare
		// `<span onClick={…}>` escaped it, which is exactly how a discreet "Show
		// details" toggle gets written. That was PF-7 violated in the file that
		// minted PF-7. Measured both ways: widened → RED, old selector on the
		// same leak → GREEN (@security-auditor, POLISH.3 R7).
		//
		// ⚠ FIXPOINT, NOT ONE PASS. `querySelectorAll` returns a STATIC list, so
		// a node revealed BY an earlier click is never dispatched at — and a
		// state-toggled "Show details" is precisely that shape. Re-querying each
		// round also survives the inverse: a handler that UNMOUNTS part of the
		// subtree mid-loop, which left later nodes detached and their handlers
		// unreachable. Both were measured GREEN before this loop existed.
		//
		// ⚠ AND SCOPED TO `baseElement`, so a portalled affordance is swept too.
		const seen = new Set<Element>();
		for (let round = 0; round < 8; round++) {
			const batch = [...swept.baseElement.querySelectorAll("*")].filter(
				(el) => !seen.has(el),
			);
			if (batch.length === 0) break;
			if (round === 0) {
				// N1 non-vacuity floor, CALIBRATED. `> 0` passes with the wrapper
				// div alone — a sweep covering nothing that can carry an
				// affordance. The rendered subtree is div/h1/p/button, so four is
				// the measured floor, and the interactive element is pinned by
				// kind rather than by count so a benign addition cannot mask its
				// removal. A FLOOR, never an equality — an exact count is the
				// PF-3 fragility this file forbids.
				expect(batch.length).toBeGreaterThanOrEqual(4);
				expect(batch.some((el) => el.tagName === "BUTTON")).toBe(true);
			}
			for (const el of batch) {
				seen.add(el);
				if (!swept.baseElement.contains(el)) continue;
				fireEvent.click(el);
				fireEvent.doubleClick(el);
				fireEvent.mouseOver(el);
				fireEvent.mouseEnter(el);
				fireEvent.focus(el);
				fireEvent.blur(el);
				fireEvent.pointerDown(el);
				fireEvent.contextMenu(el);
				for (const key of ["Enter", " ", "Escape", "ArrowDown"]) {
					fireEvent.keyDown(el, { key });
					fireEvent.keyUp(el, { key });
				}
			}
		}
		// Let anything a handler deferred (queueMicrotask, an un-awaited promise)
		// settle before asserting — a synchronous check cannot see it, and
		// `void trackError(error.message)` is how a boundary usually touches the
		// error object.
		await Promise.resolve();
		await new Promise((r) => setTimeout(r, 0));

		// ⚠ WHAT THIS SWEEP DOES AND DOES NOT PROVE, stated so the residual is
		// visible rather than implied (O-3). It proves: no handler reachable from
		// `baseElement`, for the events fired above, on any node present in any
		// round, reads `error` synchronously or in a queued microtask/macrotask.
		// It does NOT enumerate every DOM event. That residual is why the
		// SOURCE-LEVEL assertion below exists — it is the structural claim, and
		// this sweep is the behavioural backstop for the day a binding
		// legitimately appears.
		expect(reads).toEqual([]);
	});

	/**
	 * THE STRUCTURAL CLAIM — and it is the one that actually closes the surface.
	 *
	 * Every gap the behavioural sweep above has to work around — portals, the
	 * event vocabulary, which key a handler guards on, nodes revealed by a later
	 * click, a read deferred into a microtask — exists because a sweep is
	 * PROCEDURAL: enumerate the surfaces, enumerate the events, hope the
	 * enumeration is complete. It never is.
	 *
	 * The component's real property is structural and its own docblock says so:
	 * the `error` prop is accepted because Next's contract passes it, and is
	 * deliberately NOT DESTRUCTURED. NO BINDING IMPLIES NO READ — of any kind, on
	 * any element, in any subtree or portal, for any event, at any time. One
	 * assertion covers what seven behavioural probes could not
	 * (@security-auditor, POLISH.3 R7).
	 *
	 * Source-reading is an established idiom here — `page-container.test.ts` and
	 * `side-badge.test.tsx` both assert over files read off disk.
	 */
	it("market-error::the-component-binds-no-reference-to-the-error-prop", () => {
		const source = readFileSync(
			join(process.cwd(), "src/app/(public)/m/[slug]/error.tsx"),
			"utf8",
		);
		// Strip comments: the docblock discusses `error.message` at length and a
		// naive scan would read that prose as a binding — the same false-positive
		// hazard `page-container.test.ts` records for `<PageContainer>` in prose.
		const code = source
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^[ \t]*\/\/.*$/gm, "");

		const sig = code.match(
			/export default function DebateRouteError\(([\s\S]*?)\)\s*:/,
		);
		expect(sig, "component signature is findable").not.toBeNull();
		const [pattern = "", types = ""] = (sig?.[1] ?? "").split(/\}\s*:\s*\{/);

		// The DESTRUCTURING PATTERN binds `reset`, and nothing else.
		expect(pattern.replace(/[{}\s,]/g, "")).toBe("reset");
		// POSITIVE CONTROL: the prop IS still declared in the type — Next's
		// contract passes it — so this test is not passing because the whole
		// signature vanished, and the matcher demonstrably finds `error` in this
		// file's own text when it is present.
		expect(types).toMatch(/\berror\b/);

		// And the BODY never names it. Two things are blanked first, because the
		// word legitimately appears in both and neither is an identifier:
		// STRING LITERALS (`data-testid="debate-error"`) and JSX TEXT (the copy
		// line "An unexpected error stopped this page from loading.").
		const body = code
			.slice(code.indexOf("React.JSX.Element {"))
			.replace(/"(?:[^"\\]|\\.)*"/g, '""')
			.replace(/'(?:[^'\\]|\\.)*'/g, "''")
			.replace(/`(?:[^`\\]|\\.)*`/g, "``")
			.replace(/>[^<>{}]*</g, "><");
		// POSITIVE CONTROL: the matcher still finds an identifier read after all
		// that blanking, so the absence below is an absence and not a scrubbed
		// haystack (V-2).
		expect(`${body} error.message`).toMatch(/\berror\b/);
		expect(body).not.toMatch(/\berror\b/);
	});
});
