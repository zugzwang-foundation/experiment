// UI.6 S1 — pure freeze-countdown derivation (§2.S1). No server-only, no IO:
// import-safe in a client component AND unit-testable without a DB. The target
// instant (`FREEZE_INSTANT_UTC`) is read server-side and passed down as a ms
// prop — this module only decomposes/labels a remaining span. `reached` is the
// conclusion-freeze boundary (msRemaining <= 0).

export interface CountdownParts {
	reached: boolean;
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
}

export function countdownParts(msRemaining: number): CountdownParts {
	if (msRemaining <= 0) {
		return { reached: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
	}
	const totalSeconds = Math.floor(msRemaining / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return { reached: false, days, hours, minutes, seconds };
}

function pad2(n: number): string {
	return n.toString().padStart(2, "0");
}

export function formatCountdown(msRemaining: number): string {
	const p = countdownParts(msRemaining);
	if (p.reached) return "freeze reached";
	return `${p.days}d ${pad2(p.hours)}h ${pad2(p.minutes)}m ${pad2(p.seconds)}s`;
}
