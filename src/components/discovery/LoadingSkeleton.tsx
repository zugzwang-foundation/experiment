import { LoadingBlock } from "@/components/ui/loading-block";
import { DISCOVERY_GRID_SIZE } from "@/server/config/limits";

/** The OQ-6 loading copy (web-authored, VERBATIM — tests import, never re-type). */
export const LOADING_COPY = "Loading markets…" as const;

/**
 * One stable key per grid slot, derived from the SAME constant that caps the
 * grid. Precomputed as values rather than mapped by index — the predecessor's
 * `["a","b","c","d"]` idiom, generalised — so the keys are real values and the
 * list never reorders.
 */
const CARD_SLOTS = Array.from(
	{ length: DISCOVERY_GRID_SIZE },
	(_, i) => `card-${i + 1}`,
);

/**
 * The Discovery loading state (design-language §4.10 — ships WITH the
 * surface): the OQ-6 line + **P7** loading blocks shaped like the grid (visual
 * placeholders for the load gap only — NEVER market-shaped fake content).
 *
 * DISCOVERY-COMPLETE C10 / founder ruling R8. Two changes:
 *
 *  1. The blocks are the minted **P7** primitive rather than a bare `Skeleton`
 *     (`@/components/ui/loading-block`), so the placeholder shape is one thing
 *     with one definition across every `Suspense` surface.
 *  2. The card count comes from `DISCOVERY_GRID_SIZE`, the SAME constant that
 *     caps the grid this stands in for. It was hard-coded to FOUR
 *     (`["a","b","c","d"]`) while the grid renders up to EIGHT, so the skeleton
 *     was structurally lying about the layout it was reserving space for.
 *     Sourcing the count from the surface's own constant makes them impossible
 *     to diverge.
 *
 * `data-testid="discovery-loading"` and the `[data-slot="skeleton"]` marker are
 * preserved — `LoadingBlock` wraps `Skeleton` and marks itself with a SEPARATE
 * `data-loading-block` attribute rather than overriding `data-slot`, so the
 * shadcn marker still lands on every block and the existing assertions pass.
 */
export function LoadingSkeleton() {
	return (
		<div data-testid="discovery-loading" className="flex flex-col gap-5">
			<p className="text-center text-xs text-muted-foreground">
				{LOADING_COPY}
			</p>
			{/* The hero band, then one block per grid slot. */}
			<LoadingBlock className="h-48 w-full" />
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{CARD_SLOTS.map((slot) => (
					<LoadingBlock key={slot} className="h-36" />
				))}
			</div>
		</div>
	);
}
