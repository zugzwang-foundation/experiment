"use client";

import { ChevronRight, Lock, Timer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

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
//
// ADMIN-UI — presentation only: two stat tiles, and the count tile takes the
// strongest border rung plus a filter link when there is work to do. The two
// timers, the refresh cadence and every prop are unchanged.

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

	const pending = needsResolutionCount > 0;

	return (
		<div className="mb-6 grid gap-3 sm:grid-cols-2">
			<div
				className={cn(
					"flex flex-col gap-1 rounded-(--r) border bg-n0 p-4 shadow-(--elev-1)",
					pending ? "border-n5" : "border-n2",
				)}
			>
				<span className="flex items-center gap-1.5 font-medium text-n5 text-xs uppercase tracking-wide">
					<Lock aria-hidden className="size-3.5" />
					Needs resolution
				</span>
				<span
					aria-live="polite"
					className={cn(
						"font-semibold text-3xl tabular-nums",
						pending ? "text-ink" : "text-n5",
					)}
				>
					{needsResolutionCount}
				</span>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<span className="text-n5 text-xs">
						Closed market{needsResolutionCount === 1 ? "" : "s"} awaiting
						Resolve / Void
					</span>
					{pending ? (
						<Link
							href="/admin/markets?status=Closed"
							className="inline-flex items-center gap-0.5 rounded-(--r-chip) font-medium text-ink text-xs underline-offset-2 outline-none hover:underline focus-visible:shadow-(--state-focus-ring)"
						>
							Show them
							<ChevronRight aria-hidden className="size-3.5" />
						</Link>
					) : null}
				</div>
			</div>
			<div className="flex flex-col gap-1 rounded-(--r) border border-n2 bg-n0 p-4 shadow-(--elev-1)">
				<span className="flex items-center gap-1.5 font-medium text-n5 text-xs uppercase tracking-wide">
					<Timer aria-hidden className="size-3.5" />
					Conclusion freeze
				</span>
				<span
					aria-live="polite"
					className="font-mono font-semibold text-2xl text-ink tabular-nums leading-9"
				>
					{countdown}
				</span>
				<span className="text-n5 text-xs">2026-11-05 23:59 UTC</span>
			</div>
		</div>
	);
}
