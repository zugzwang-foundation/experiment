import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * **P7 — the loading block.** Minted by founder ruling R8
 * (DISCOVERY-COMPLETE C10); the W2.11 state kit becomes P1–P7 and **T1 is
 * SUPERSEDED**. The canon amendment lands in the SAME commit as this file
 * (CLAUDE.md §5.12) — see `docs/design/design-canon.md` §10.
 *
 * WHY T1 DOES NOT GOVERN. W2.11 ruled *"no first-load skeletons; pages are
 * server-rendered (populated HTML)"*. That premise does not hold on a streamed
 * surface: Discovery mounts a React `Suspense` boundary around an async server
 * read, so the FIRST PAINT is the fallback, not populated HTML. A ruling that
 * assumed populated HTML cannot govern a surface that has none at first paint.
 *
 * WHAT IT IS. A `Skeleton`-based placeholder shaped like the content it
 * replaces — never market-shaped fake content, and never a spinner. It composes
 * EXISTING tokens only: no new colour token, no new custom property, so the
 * 11-token census in `tests/unit/design/tokens-monochrome.test.ts` is untouched.
 *
 * HOST: any surface with a `Suspense` boundary over a server read. Its COUNT
 * must come from that surface's own constant (Discovery: `DISCOVERY_GRID_SIZE`),
 * never a literal — a hard-coded count silently diverges from the grid it is
 * standing in for, which is exactly what this commit fixes.
 */
export function LoadingBlock({
	className,
	...props
}: React.ComponentProps<"div">) {
	// ⚠ P7 marks itself with `data-loading-block`, NOT by overriding
	// `data-slot`. `Skeleton` sets `data-slot="skeleton"` — the shadcn primitive
	// marker (AGENTS.md §8) that existing assertions and any future
	// skeleton-wide styling key on. Passing `data-slot="loading-block"` here
	// silently REPLACED it and reddened surface-states.test.tsx; both markers
	// now coexist.
	return (
		<Skeleton
			data-loading-block=""
			className={cn("rounded-[var(--r)]", className)}
			{...props}
		/>
	);
}
