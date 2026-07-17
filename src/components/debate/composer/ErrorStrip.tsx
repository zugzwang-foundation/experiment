"use client";

import { C1_PROTECTIVE_LANDING, STATE_COPY } from "./copy";
import type { ComposerErrorState } from "./state-map";

/** The submit status shared by the composers + the sell module (§4). */
export type ComposerStatus =
	| { phase: "idle" }
	| { phase: "in_flight" }
	| { phase: "error"; state: ComposerErrorState; code: string };

/** The §4 inline state strips (kit-verbatim copy; SG-3: never echoes content). */
export function ErrorStrip({ status }: { status: ComposerStatus }) {
	if (status.phase !== "error") {
		return null;
	}
	const { state } = status.state;
	if (
		state === "p2_terminal_suspended" ||
		state === "p4_rate_limited" ||
		state === "auth_gate" ||
		state === "route_onboarding"
	) {
		return null; // rendered elsewhere (modal / banner / swap / route)
	}
	let title: string;
	let body: string;
	switch (state) {
		case "p3_revise_blocked":
			title = STATE_COPY.trackB.title;
			body = STATE_COPY.trackB.body;
			break;
		case "p3_gate_down":
			title = STATE_COPY.gateDown.title;
			body = STATE_COPY.gateDown.body;
			break;
		case "p3_wait_in_flight":
			title = STATE_COPY.waitInFlight;
			body = "";
			break;
		case "p3_transient_retry":
			title = STATE_COPY.transient.title;
			body = STATE_COPY.transient.body;
			break;
		case "p3_protective_landing":
			title = C1_PROTECTIVE_LANDING.title;
			body = C1_PROTECTIVE_LANDING.body;
			break;
		case "p3_market_race":
			if (status.code === "market_resolving") {
				title = STATE_COPY.resolving.title;
				body = STATE_COPY.resolving.body;
			} else {
				title = STATE_COPY.marketClosed.title;
				body = STATE_COPY.marketClosed.body;
			}
			break;
		case "p6_concluded":
			title = STATE_COPY.frozen.lead;
			body = STATE_COPY.frozen.body;
			break;
		default:
			title = STATE_COPY.generic.title;
			body = STATE_COPY.generic.body;
			break;
	}
	return (
		<div
			role="status"
			aria-live="polite"
			className="rounded-(--r-chip) bg-n1 px-3 py-2 text-xs"
		>
			<span className="block font-semibold text-ink">{title}</span>
			{body !== "" && <span className="text-n5">{body}</span>}
		</div>
	);
}
