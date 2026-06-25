import type { Side } from "./types";

/**
 * The "removed by moderator" placeholder (ADR-0020/0021 / DEBATE.4 §6) —
 * rendered where a `content_removed` comment's body/title/image/author were
 * withheld SERVER-SIDE. The structural slot (frozen side + reply aggregate +
 * replies) survives around it; only the argument and author are gone.
 */
export function RemovedPlaceholder() {
	return (
		<p className="text-xs text-muted-foreground italic">Removed by moderator</p>
	);
}

/**
 * The empty-side CTA (design-language §3.1) — `Be the first to argue [YES/NO]`,
 * rendered on a side with no posts (market-view) or no replies (post-view). A
 * present-but-disabled prompt: DEBATE.4 wires no composer (C1 read-only).
 */
export function EmptySideCTA({ side }: { side: Side }) {
	return (
		<p className="px-1 py-6 text-center text-sm text-muted-foreground">
			Be the first to argue {side}
		</p>
	);
}
