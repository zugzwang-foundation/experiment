// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
	C1_PROTECTIVE_LANDING,
	STATE_COPY,
} from "@/components/debate/composer/copy";
import {
	type ComposerStatus,
	ErrorStrip,
} from "@/components/debate/composer/ErrorStrip";
import type { ComposerStateName } from "@/components/debate/composer/state-map";

/**
 * OQ-7c R-1 — the inline error strip renders the mapped copy.ts string
 * EXACTLY per strip-class state (one representative render per DISTINCT
 * rendered state; the wire-code → state map itself is exhaustively pinned at
 * state-map.test.ts — not re-walked here), and every elsewhere-rendered
 * class (modal · banner · auth-gate swap · onboarding route · image
 * affordance) renders NO strip. All copy asserted via copy.ts imports —
 * never re-typed literals.
 */

afterEach(cleanup);

function errorStatus(state: ComposerStateName, code: string): ComposerStatus {
	return { phase: "error", state: { state }, code };
}

describe("ErrorStrip strip-class states (R-1)", () => {
	it("render::idle-and-in-flight-render-null", () => {
		const idle = render(<ErrorStrip status={{ phase: "idle" }} />);
		expect(idle.container.firstChild).toBeNull();
		const busy = render(<ErrorStrip status={{ phase: "in_flight" }} />);
		expect(busy.container.firstChild).toBeNull();
	});

	it("render::p3_revise_blocked-renders-the-trackB-copy", () => {
		render(
			<ErrorStrip
				status={errorStatus("p3_revise_blocked", "comment_track_b_blocked")}
			/>,
		);
		expect(screen.getByText(STATE_COPY.trackB.title).textContent).toBe(
			STATE_COPY.trackB.title,
		);
		expect(screen.getByText(STATE_COPY.trackB.body).textContent).toBe(
			STATE_COPY.trackB.body,
		);
	});

	it("render::p3_gate_down-renders-the-gateDown-copy", () => {
		render(
			<ErrorStrip
				status={errorStatus("p3_gate_down", "error_moderation_unavailable")}
			/>,
		);
		expect(screen.getByText(STATE_COPY.gateDown.title).textContent).toBe(
			STATE_COPY.gateDown.title,
		);
		expect(screen.getByText(STATE_COPY.gateDown.body).textContent).toBe(
			STATE_COPY.gateDown.body,
		);
	});

	it("render::p3_wait_in_flight-renders-the-title-alone", () => {
		const { container } = render(
			<ErrorStrip
				status={errorStatus("p3_wait_in_flight", "error_moderation_in_flight")}
			/>,
		);
		// Title-only strip: the whole rendered text IS the waitInFlight line.
		expect(container.textContent).toBe(STATE_COPY.waitInFlight);
	});

	it("render::p3_transient_retry-renders-the-transient-composition", () => {
		const { container } = render(
			<ErrorStrip
				status={errorStatus(
					"p3_transient_retry",
					"error_bet_serialization_exhausted",
				)}
			/>,
		);
		expect(container.textContent).toBe(
			`${STATE_COPY.transient.title}${STATE_COPY.transient.body}`,
		);
	});

	it("render::p3_protective_landing-renders-the-C1-copy", () => {
		render(
			<ErrorStrip
				status={errorStatus(
					"p3_protective_landing",
					"error_idempotency_key_reused",
				)}
			/>,
		);
		expect(screen.getByText(C1_PROTECTIVE_LANDING.title).textContent).toBe(
			C1_PROTECTIVE_LANDING.title,
		);
		expect(screen.getByText(C1_PROTECTIVE_LANDING.body).textContent).toBe(
			C1_PROTECTIVE_LANDING.body,
		);
	});

	it("render::p3_market_race-resolving-code-renders-the-kit-race-strip", () => {
		render(
			<ErrorStrip status={errorStatus("p3_market_race", "market_resolving")} />,
		);
		expect(screen.getByText(STATE_COPY.resolving.title).textContent).toBe(
			STATE_COPY.resolving.title,
		);
		expect(screen.getByText(STATE_COPY.resolving.body).textContent).toBe(
			STATE_COPY.resolving.body,
		);
	});

	it("render::p3_market_race-closed-code-renders-the-marketClosed-strip", () => {
		render(
			<ErrorStrip
				status={errorStatus("p3_market_race", "error_market_closed_at")}
			/>,
		);
		expect(screen.getByText(STATE_COPY.marketClosed.title).textContent).toBe(
			STATE_COPY.marketClosed.title,
		);
		expect(screen.getByText(STATE_COPY.marketClosed.body).textContent).toBe(
			STATE_COPY.marketClosed.body,
		);
	});

	it("render::p6_concluded-renders-the-frozen-copy", () => {
		render(
			<ErrorStrip
				status={errorStatus("p6_concluded", "error_experiment_concluded")}
			/>,
		);
		expect(screen.getByText(STATE_COPY.frozen.lead).textContent).toBe(
			STATE_COPY.frozen.lead,
		);
		expect(screen.getByText(STATE_COPY.frozen.body).textContent).toBe(
			STATE_COPY.frozen.body,
		);
	});

	it("render::p3_generic-renders-the-generic-copy", () => {
		render(<ErrorStrip status={errorStatus("p3_generic", "error_internal")} />);
		expect(screen.getByText(STATE_COPY.generic.title).textContent).toBe(
			STATE_COPY.generic.title,
		);
		expect(screen.getByText(STATE_COPY.generic.body).textContent).toBe(
			STATE_COPY.generic.body,
		);
	});
});

describe("ErrorStrip elsewhere-rendered classes (R-1)", () => {
	it("render::every-elsewhere-rendered-class-renders-no-strip", () => {
		// §4: these five land in the modal / banner / auth-gate swap /
		// onboarding route / image affordance — NEVER the inline strip.
		const cases: Array<[ComposerStateName, string]> = [
			["p2_terminal_suspended", "comment_track_a_blocked"],
			["p4_rate_limited", "error_rate_limit_exceeded"],
			["auth_gate", "error_session_required"],
			["route_onboarding", "error_onboarding_required"],
			["p3_image", "error_image_oversize"],
		];
		for (const [state, code] of cases) {
			const { container, unmount } = render(
				<ErrorStrip status={errorStatus(state, code)} />,
			);
			expect(container.firstChild).toBeNull();
			unmount();
		}
	});
});
