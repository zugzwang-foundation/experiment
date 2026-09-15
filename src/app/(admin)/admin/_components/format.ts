// ADMIN-UI — pure, presentational date helpers for the admin console. No IO,
// no server-only, no money: import-safe from Server AND Client Components.
// Every admin surface states times in UTC (SPEC.1 §15 F-ADMIN-1 parses the
// deadline as UTC), so nothing here reads the viewer's local zone.

function pad2(n: number): string {
	return n.toString().padStart(2, "0");
}

/** `2026-10-01 23:59 UTC` — minute precision, always UTC. */
export function formatUtcMinute(date: Date): string {
	return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
		date.getUTCDate(),
	)} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())} UTC`;
}

/**
 * A coarse signed span label between two instants: `in 3d 4h`, `in 12m`,
 * `2h 5m ago`, `now`. Two most-significant units only — an operator scanning a
 * table needs the order of magnitude, not the second.
 */
export function relativeSpan(targetMs: number, nowMs: number): string {
	const delta = targetMs - nowMs;
	const abs = Math.abs(delta);
	const minutes = Math.floor(abs / 60_000);
	if (minutes < 1) return "now";
	const days = Math.floor(minutes / 1440);
	const hours = Math.floor((minutes % 1440) / 60);
	const mins = minutes % 60;
	let label: string;
	if (days > 0) label = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
	else if (hours > 0) label = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	else label = `${mins}m`;
	return delta > 0 ? `in ${label}` : `${label} ago`;
}
