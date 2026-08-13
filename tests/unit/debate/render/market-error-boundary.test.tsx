// @vitest-environment jsdom

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

/** An error carrying a distinctive planted string in each of the four fields
 *  a boundary could leak. Distinctive so a match cannot be coincidental. */
function thrown() {
	const err = new Error("LEAK_MESSAGE_pg_connection_refused_m3q7") as Error & {
		digest?: string;
	};
	err.digest = "LEAK_DIGEST_4b81ce";
	err.stack = "LEAK_STACK_FRAME at m/[slug]/page.tsx:99";
	err.cause = "LEAK_CAUSE_debate_view_load_failed";
	return err;
}

const SECRETS = [
	"LEAK_MESSAGE_pg_connection_refused_m3q7",
	"LEAK_DIGEST_4b81ce",
	"LEAK_STACK_FRAME",
	"LEAK_CAUSE_debate_view_load_failed",
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
		const { container } = render(
			<DebateRouteError error={thrown()} reset={() => {}} />,
		);
		const html = container.innerHTML;

		// ── POSITIVE CONTROL 1: the component actually rendered. Without this the
		//    four absences below would pass just as happily against "".
		expect(html).toContain("Something went wrong.");
		expect(html.length).toBeGreaterThan(100);

		// ── POSITIVE CONTROL 2: the planted strings are really ON the error
		//    object. A typo in `thrown()` would otherwise make every absence
		//    below trivially true — V-2, a negative assertion needs a positive
		//    control, and the control has to cover the FIXTURE, not just the
		//    render.
		const err = thrown();
		expect(err.message).toContain(SECRETS[0]);
		expect(err.digest).toContain(SECRETS[1]);
		expect(err.stack).toContain(SECRETS[2]);
		expect(String(err.cause)).toContain(SECRETS[3]);

		// ── THE ASSERTION. Container-wide: a leak anywhere in the subtree fails.
		for (const secret of SECRETS) {
			expect(html).not.toContain(secret);
		}

		// ── POSITIVE CONTROL 3 — REACHABILITY. Prove the matcher CAN find these
		//    strings when they are present, through this same harness. Without
		//    it the four `not.toContain`s are absences of unknown detectability.
		const leaky = render(
			<p>
				{thrown().message} {String(thrown().cause)}
			</p>,
		);
		expect(leaky.container.innerHTML).toContain(SECRETS[0]);
		expect(leaky.container.innerHTML).toContain(SECRETS[3]);
	});

	it("market-error::the-error-prop-is-not-bound-so-a-leak-is-unconstructable", () => {
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
	});
});
