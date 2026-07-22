"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatCountdown } from "./countdown";

// UI.6 S1 — the "live" Markets-tab header (§2.S1). NO websocket (plan D-1): the
// page is `force-dynamic` (fresh-on-view) and this client island (a) ticks the
// freeze countdown locally every second off the passed-in instant, and (b)
// calls `router.refresh()` every 60s to re-read the needs-resolution count
// server-side. The count itself arrives as a server-rendered prop; the 60s
// refresh swaps it for a fresh value without a full navigation.
//
// `initialCountdown` is the server-computed label for the first paint — the
// live client tick only takes over after mount, so SSR and the first client
// render agree (no hydration mismatch).

const REFRESH_INTERVAL_MS = 60_000;

export function NeedsResolutionCount({
	needsResolutionCount,
	freezeInstantMs,
	initialCountdown,
}: {
	needsResolutionCount: number;
	freezeInstantMs: number;
	initialCountdown: string;
}): React.ReactElement {
	const router = useRouter();
	const [countdown, setCountdown] = useState(initialCountdown);

	useEffect(() => {
		const tick = () =>
			setCountdown(formatCountdown(freezeInstantMs - Date.now()));
		tick();
		const timer = setInterval(tick, 1000);
		return () => clearInterval(timer);
	}, [freezeInstantMs]);

	useEffect(() => {
		const timer = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
		return () => clearInterval(timer);
	}, [router]);

	return (
		<div className="mb-6 flex flex-wrap items-center gap-6 rounded-lg border border-border bg-card p-5">
			<div className="flex flex-col gap-1">
				<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Needs resolution
				</span>
				<span
					aria-live="polite"
					className="text-3xl font-semibold tabular-nums text-foreground"
				>
					{needsResolutionCount}
				</span>
				<span className="text-xs text-muted-foreground">
					Closed market{needsResolutionCount === 1 ? "" : "s"} awaiting Resolve
					/ Void
				</span>
			</div>
			<div className="flex flex-col gap-1">
				<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Conclusion freeze
				</span>
				<span
					aria-live="polite"
					className="font-mono text-2xl font-semibold tabular-nums text-foreground"
				>
					{countdown}
				</span>
				<span className="text-xs text-muted-foreground">
					2026-11-05 23:59 UTC
				</span>
			</div>
		</div>
	);
}
