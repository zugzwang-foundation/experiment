import { Skeleton } from "@/components/ui/skeleton";

/** The OQ-6 loading copy (web-authored, VERBATIM — tests import, never re-type). */
export const LOADING_COPY = "Loading markets…" as const;

/**
 * The Discovery loading state (design-language §4.10 — ships WITH the
 * surface): the OQ-6 line + shadcn `Skeleton` card placeholders shaped like
 * the grid (visual placeholders for the load gap only — NEVER market-shaped
 * fake content).
 */
export function LoadingSkeleton() {
	return (
		<div data-testid="discovery-loading" className="flex flex-col gap-5">
			<p className="text-center text-xs text-muted-foreground">
				{LOADING_COPY}
			</p>
			<Skeleton className="h-48 w-full rounded-[var(--r)]" />
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{["a", "b", "c", "d"].map((k) => (
					<Skeleton key={k} className="h-36 rounded-[var(--r)]" />
				))}
			</div>
		</div>
	);
}
