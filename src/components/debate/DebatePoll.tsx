"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW,
	POLL_INTERVAL_MS_DEBATE_VIEW,
} from "@/server/config/limits";

import { usePhoneSheetOpen } from "./composer-open-store";
import { getInitialPollPhaseOffsetMs } from "./poll-phase";

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
 * deliberately does NOT copy: this flow ADDS no `aria-live` to the polled
 * region (the polled value here is the whole debate view; marking it live would
 * make a screen reader announce the entire page every 30 s), no fusing of a
 * display concern into the poll, and no reliance on the route being dynamic by
 * accident — `/m/[slug]/page.tsx` now carries an explicit `force-dynamic`.
 * Note the polled tree already contains one pre-existing live region — the
 * pager's `{index + 1} / {total}` counter at `scrollers.tsx:41` — so a poll can
 * now trigger an announcement without user action; its treatment is docketed,
 * not decided here (flow file, accepted-behaviour note 2).
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
 * IDLE (POLL-IDLE) — a THIRD suspender, and the only one about cost rather than
 * the composer. A tab left open and visible was never suspended by either rule
 * above, so it rendered the layout and page on the server every interval for a
 * reader who was not there. After `POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW` with no
 * pointer, touch, wheel, scroll or key input the poll suspends; the first input
 * afterwards resumes it through the SAME immediate-refresh path as the other
 * suspenders. The tab becoming visible counts as input, because a reader
 * switching back to it is present by definition. Listeners are passive and
 * window-level in the capture phase (so a scroll inside the phone feed's own
 * scroller is seen), and they only stamp a time: the idle check is one
 * `setTimeout`, re-armed for the remaining time when it fires early, never a
 * timer reset per mouse move.
 *
 * STOP — polling stops PERMANENTLY once the market leaves `Open`; not paused,
 * stopped. The poll carries NO notion of the global conclusion freeze:
 * `system_state.frozen_at` reaches no client component, and `FREEZE_INSTANT_UTC`
 * compared against a client clock is a guess about a database state flip, not a
 * signal. `market.status` is real, already on the view model, and free.
 *
 * PHASE JITTER (HO-FRONT v2.0 T2) — a one-time random offset from
 * `getInitialPollPhaseOffsetMs`, applied ONLY to the very first interval this
 * component instance ever arms, de-synchronising concurrently open tabs on the
 * same market. Steady-state cadence stays exactly
 * `POLL_INTERVAL_MS_DEBATE_VIEW`; the offset only delays when the recurring
 * timer is FIRST armed (`setTimeout(offset)` wrapping the `setInterval`), so
 * the first refresh lands at `offset + interval`, never at `offset` itself —
 * with `offset = 0` this collapses to byte-identical timing to the unjittered
 * version, which is what lets `poll.test.tsx` pin exact boundary assertions by
 * mocking `./poll-phase` to a constant 0 rather than loosening its contract.
 * `hasStartedOnce` gates this to that one first arm: a RESUME from suspension
 * re-enters this effect too (`suspended` is a dependency) and must keep firing
 * its immediate resume-refresh un-jittered, exactly as ratified above.
 *
 * That same flag is CONSUMED BY STRICTMODE'S FIRST MOUNT PASS — React
 * double-invokes mount effects in development only, so the first pass sets
 * `hasStartedOnce` and is then torn down, the surviving pass therefore takes the
 * un-jittered `setInterval` below, and the jitter is INERT under `next dev`
 * while remaining LIVE in production; that is expected rather than a defect, and
 * is left alone deliberately (HARDEN.6 owns any change — setting the flag inside
 * the `setTimeout` callback would restore dev jitter, but would also let a
 * composer opened during the offset window re-enter the jittered branch on
 * resume, changing the ratified resume semantics above).
 */
/** POLL-IDLE — the inputs that count as a reader being present. */
const ACTIVITY_EVENTS = [
	"pointerdown",
	"pointermove",
	"touchstart",
	"wheel",
	"scroll",
	"keydown",
] as const;

export function DebatePoll({
	marketOpen,
	composerOpen,
	slug,
}: {
	/** `model.market.status === "Open"` — the sole stop signal (SPEC.1 §9). */
	marketOpen: boolean;
	/** Any composer slot open on the surface — `openSide` or `openReply`. */
	composerOpen: boolean;
	/** Identifies the market whose version this poll asks about. */
	slug: string;
}): null {
	const router = useRouter();
	// The version this tab has already rendered. `null` until the first answer:
	// the page was server-rendered moments ago, so that first answer is a
	// BASELINE and must not trigger a refresh of its own.
	const lastVersion = useRef<string | null>(null);

	// ⚠ ASK, THEN REFRESH — the whole point of this component's rewrite. It used
	// to call `router.refresh()` on every tick, re-invoking the full
	// `/m/[slug]` read path (~5 uncached queries, ~250 ms CPU, one pooled
	// connection held throughout) whether or not anything had changed. Measured
	// on production 2026-09-16: the market page broke at 50 req/s offered with
	// the connection pool pinned at 53 of 60 while Postgres itself ran only 1-3
	// queries — so the site ran out of CONNECTIONS, and idle viewers were what
	// consumed them. At 3,000 viewers this poll alone was ~100 renders/s.
	//
	// `/m/[slug]/version` is edge-cached for 5 s, so most of these never reach a
	// server, and a tab that sees no change does no work anywhere.
	//
	// ⛔ NEVER REFRESH ON A FAILED CHECK. A transient error leaves `lastVersion`
	// untouched and the next tick asks again. Refreshing on failure would
	// restore the behaviour this replaces at exactly the moment the site is
	// least able to serve it.
	// One read of the market's version token, or `null` if the answer did not
	// arrive. Never throws: a transient failure is a non-answer, not an event.
	const readVersion = useCallback(async (): Promise<string | null> => {
		try {
			const res = await fetch(`/m/${slug}/version`);
			if (!res.ok) {
				return null;
			}
			const body: unknown = await res.json();
			const value =
				typeof body === "object" && body !== null
					? (body as { v?: unknown }).v
					: undefined;
			return typeof value === "string" ? value : null;
		} catch {
			return null;
		}
	}, [slug]);

	// ⛔ RECORDS, NEVER REFRESHES — and that is what makes it safe to run twice.
	// React re-runs mount effects in development's StrictMode, and an
	// implementation that compared on the second run would see its own first
	// answer as a change and refresh for no reason.
	const captureBaseline = useCallback(async () => {
		const version = await readVersion();
		if (version !== null) {
			lastVersion.current = version;
		}
	}, [readVersion]);

	const checkForChange = useCallback(async () => {
		const version = await readVersion();
		if (version === null) {
			return;
		}
		if (lastVersion.current === null) {
			lastVersion.current = version;
			return;
		}
		if (version !== lastVersion.current) {
			lastVersion.current = version;
			router.refresh();
		}
	}, [router, readVersion]);
	const [documentHidden, setDocumentHidden] = useState(false);

	// Computed once per component instance — "one-time... per client mount".
	const phaseOffsetMs = useRef<number | undefined>(undefined);
	if (phaseOffsetMs.current === undefined) {
		phaseOffsetMs.current = getInitialPollPhaseOffsetMs(
			POLL_INTERVAL_MS_DEBATE_VIEW,
		);
	}
	const hasStartedOnce = useRef(false);

	// ⚠ ESTABLISH THE BASELINE AT MOUNT, NOT AT THE FIRST TICK. The page was
	// server-rendered a moment ago; without a baseline taken now, the first tick
	// would have nothing to compare against, would record whatever it saw as the
	// baseline, and would therefore MISS any bet, post or removal that landed
	// between the render and that tick — a freshness hole the unconditional
	// refresh never had. One extra request per page view buys it back, and it is
	// answered by the edge cache rather than the database.
	useEffect(() => {
		void captureBaseline();
	}, [captureBaseline]);

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

	// ⛔ RI-4 / O-n — THE PHONE COMPOSER IS A SIBLING, NOT A CHILD, so it cannot
	// reach this through a prop, and before this read the poll would refresh the
	// page out from under a half-typed argument on a phone. The store's own
	// docblock carries the reasoning and the stuck-flag posture; what matters
	// here is that this is an OR over the same signal, not a second mechanism:
	// "a composer is open on this surface" simply now includes the one the
	// desktop tree cannot see.
	const phoneSheetOpen = usePhoneSheetOpen();

	// POLL-IDLE — see the docblock. Only armed while the market is Open: a
	// stopped poll has nothing to resume, so it needs no listeners or timer.
	const [idle, setIdle] = useState(false);
	useEffect(() => {
		if (!marketOpen) {
			return;
		}
		let lastActivityAt = Date.now();
		let isIdle = false;
		let timer: ReturnType<typeof setTimeout> | undefined;

		const check = () => {
			const quietFor = Date.now() - lastActivityAt;
			if (quietFor >= POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW) {
				isIdle = true;
				timer = undefined;
				setIdle(true);
				return;
			}
			timer = setTimeout(check, POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW - quietFor);
		};
		const onActivity = () => {
			lastActivityAt = Date.now();
			if (isIdle) {
				isIdle = false;
				setIdle(false);
			}
			if (timer === undefined) {
				timer = setTimeout(check, POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW);
			}
		};
		const onVisibility = () => {
			if (!document.hidden) {
				onActivity();
			}
		};

		const options = { capture: true, passive: true } as const;
		for (const type of ACTIVITY_EVENTS) {
			window.addEventListener(type, onActivity, options);
		}
		document.addEventListener("visibilitychange", onVisibility);
		timer = setTimeout(check, POLL_IDLE_TIMEOUT_MS_DEBATE_VIEW);

		return () => {
			for (const type of ACTIVITY_EVENTS) {
				window.removeEventListener(type, onActivity, options);
			}
			document.removeEventListener("visibilitychange", onVisibility);
			if (timer !== undefined) {
				clearTimeout(timer);
			}
		};
	}, [marketOpen]);

	const suspended = documentHidden || composerOpen || phoneSheetOpen || idle;

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
			// Back from idle or a hidden tab: ask first, like every other tick.
			// The market may well be unchanged.
			void checkForChange();
		}

		if (!hasStartedOnce.current) {
			hasStartedOnce.current = true;
			let interval: ReturnType<typeof setInterval> | undefined;
			const arm = setTimeout(() => {
				interval = setInterval(() => {
					void checkForChange();
				}, POLL_INTERVAL_MS_DEBATE_VIEW);
			}, phaseOffsetMs.current);
			return () => {
				clearTimeout(arm);
				if (interval) {
					clearInterval(interval);
				}
			};
		}

		const timer = setInterval(() => {
			void checkForChange();
		}, POLL_INTERVAL_MS_DEBATE_VIEW);
		return () => clearInterval(timer);
	}, [marketOpen, suspended, checkForChange]);

	return null;
}
