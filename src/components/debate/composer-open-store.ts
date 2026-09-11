"use client";

import { useSyncExternalStore } from "react";

/**
 * RI-4 / O-n — one bit, shared between two sibling trees that cannot see each
 * other.
 *
 * `DebatePoll` re-invokes the page's server read on an interval and suspends
 * while a composer is open, so that a refresh cannot land under somebody's
 * fingers and take their draft with it. It learns that from a `composerOpen`
 * prop handed down by `DebateView` — which works exactly as long as the only
 * composer on the surface is `DebateView`'s own.
 *
 * Since ADR-0050 it is not. The phone tier is a SIBLING of `DebateView`, not a
 * child, so a phone sheet holding a half-typed argument is invisible to the
 * poll, and the reader's draft is one interval away from being discarded. Props
 * cannot cross between siblings; lifting the state into `DebateView` would make
 * the desktop tree own a piece of phone state it never reads.
 *
 * ⚠ ONE BIT, DELIBERATELY, AND NOT A CONTEXT. A provider would have to wrap
 * both roots, which means editing the page to insert a component between the
 * route and two trees that currently have no shared ancestor but the route
 * itself — a structural change for a boolean. A module-level store read through
 * `useSyncExternalStore` is the smaller answer and is SSR-safe by construction:
 * `getServerSnapshot` returns `false`, which is also the only honest server
 * answer, since no sheet can be open before hydration.
 *
 * ⛔ THE FAILURE MODE THIS IS SHAPED AGAINST IS A FLAG STUCK ON. A `true` that
 * is never cleared does not throw and does not render: it silently stops the
 * surface refreshing for the rest of the session, and the reader simply sees
 * stale prices with no indication anything is wrong. So the setter is never
 * called from an event handler — it is called from an effect whose CLEANUP
 * clears it, which means unmounting the sheet, navigating away, or React
 * discarding the tree all release it without anyone having remembered to.
 *
 * ⚠ WHAT IT CANNOT DO, stated because it is the question a reviewer should ask:
 * suppressing the poll suppresses a convenience re-read. It does not touch the
 * bet path, which posts to its own handler and revalidates on its own. A stuck
 * flag costs freshness; it cannot cost money or admit a write that should not
 * happen.
 */
let phoneSheetOpen = false;
const listeners = new Set<() => void>();

function emit(): void {
	for (const listener of listeners) {
		listener();
	}
}

/** Called from an effect's body and its cleanup — never from a handler. */
export function setPhoneSheetOpen(open: boolean): void {
	if (phoneSheetOpen === open) {
		return;
	}
	phoneSheetOpen = open;
	emit();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

const getSnapshot = (): boolean => phoneSheetOpen;
/** No sheet can be open before hydration, so `false` is not a placeholder. */
const getServerSnapshot = (): boolean => false;

export function usePhoneSheetOpen(): boolean {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
