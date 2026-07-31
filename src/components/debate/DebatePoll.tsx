"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { POLL_INTERVAL_MS_DEBATE_VIEW } from "@/server/config/limits";

/**
 * F-DEBATE-4 — the debate view's polled-on-view refresh (SPEC.1 1.0.25 §9).
 *
 * A leaf that renders nothing and owns one `setInterval` calling
 * `router.refresh()`, which re-invokes the EXISTING `/m/[slug]` server read path
 * — `loadDebateView` composed with `loadViewerMarketContext` at the page RSC
 * (ADR-0034 D-2). It is deliberately **not** a fetch against a separate read
 * endpoint: SPEC.2 §4.3's handler catalogue is closed at eleven and F-DEBATE-4
 * adds no twelfth, because a dedicated read endpoint would fork removal-masking
 * — keyed solely on `loadRemovedSet` inside `loadDebateView` (ADR-0021;
 * ADR-0034 D-4) — into a second implementation, and two masking implementations
 * are two places for masking to diverge. Re-invoking the composed path instead
 * carries the price bar, the debate list and the F-DEBATE-5 price series on one
 * payload with masking and viewer-scoping intact by construction.
 *
 * Interval setup/teardown follows the `NeedsResolutionCount` precedent (one
 * effect, one interval, a `clearInterval` cleanup) — measured to yield the
 * correct NET fire rate under React's StrictMode double-mount. What it
 * deliberately does NOT copy: no `aria-live` on the polled region (the polled
 * value here is the whole debate view; marking it live would make a screen
 * reader announce the entire page every 15 s), no fusing of a display concern
 * into the poll, and no reliance on the route being dynamic by accident —
 * `/m/[slug]/page.tsx` now carries an explicit `force-dynamic`.
 *
 * There is no in-flight guard and no request queue, on purpose: overlapping
 * `router.refresh()` calls coalesce into one applied payload (measured — six
 * rapid calls, one payload), so a guard would be a server-load optimisation,
 * not a correctness requirement.
 *
 * SUSPENSION (the ratified rule) — polling suspends while the document is
 * hidden OR any bet composer is open on the surface, and resumes with an
 * IMMEDIATE refresh when the document becomes visible or the last composer
 * closes. The justification is not visual: a refresh does not disturb composer
 * state at all — text, controlled state, focus, caret and scroll all survive,
 * measured — but a refresh whose server render *throws* destroys the entire
 * client tree and the unsaved argument with it, arriving as an HTTP 200 with a
 * poisoned payload that `router.refresh()` gives no way to detect or back off
 * from. An open-but-empty composer sits in that blast radius identically to a
 * dirty one, so the reader's intent to compose is the correct gate — hence
 * composer-OPEN, never a `trim().length > 0` predicate.
 *
 * STOP — polling stops PERMANENTLY once the market leaves `Open`; not paused,
 * stopped. The poll carries NO notion of the global conclusion freeze:
 * `system_state.frozen_at` reaches no client component, and `FREEZE_INSTANT_UTC`
 * compared against a client clock is a guess about a database state flip, not a
 * signal. `market.status` is real, already on the view model, and free.
 */
export function DebatePoll({
	marketOpen,
	composerOpen,
}: {
	/** `model.market.status === "Open"` — the sole stop signal (SPEC.1 §9). */
	marketOpen: boolean;
	/** Any composer slot open on the surface — `openSide` or `openReply`. */
	composerOpen: boolean;
}): null {
	const router = useRouter();
	const [documentHidden, setDocumentHidden] = useState(false);

	// Mirror page visibility into state. The initial `false` matches the server
	// render; the mount call below adopts the real value post-hydration, which
	// also covers a tab opened in the background.
	useEffect(() => {
		const sync = () => setDocumentHidden(document.hidden);
		sync();
		document.addEventListener("visibilitychange", sync);
		return () => document.removeEventListener("visibilitychange", sync);
	}, []);

	// Armed only by a genuine suspension, so the resume-refresh below cannot fire
	// on the initial mount — the server render is already fresh, and a refresh on
	// every page load would be a defect, not a cost.
	const wasSuspended = useRef(false);
	// Latched once the market leaves `Open`: "stopped, never restarted" is
	// encoded here rather than resting on the market state machine never
	// returning to `Open`.
	const stopped = useRef(false);

	const suspended = documentHidden || composerOpen;

	useEffect(() => {
		if (!marketOpen) {
			stopped.current = true;
		}
		if (stopped.current) {
			return;
		}
		if (suspended) {
			wasSuspended.current = true;
			return;
		}
		if (wasSuspended.current) {
			wasSuspended.current = false;
			router.refresh();
		}
		const timer = setInterval(
			() => router.refresh(),
			POLL_INTERVAL_MS_DEBATE_VIEW,
		);
		return () => clearInterval(timer);
	}, [marketOpen, suspended, router]);

	return null;
}
