import { LoadingBlock } from "@/components/ui/loading-block";

import { PROFILE_COPY } from "./copy";

/**
 * The tile band's block count. P7 requires a block count to come from "that
 * surface's own constant … never a literal" (`ui/loading-block.tsx:21-24`), and
 * the profile had none — the band mapped a six-element string literal, so the
 * count and the six tiles `ProfileTiles` renders could diverge silently. That
 * is the divergence the rule exists to stop, and adopting P7 while leaving the
 * literal would ship a known violation of the rule the adoption is under.
 */
const TILE_BLOCK_COUNT = 6;

/** Stable block keys, derived from the count above rather than enumerated. */
const TILE_BLOCK_KEYS = Array.from(
	{ length: TILE_BLOCK_COUNT },
	(_, i) => `tile-block-${i}`,
);

/**
 * The profile loading state (design-language §4.10 — ships WITH the surface):
 * **P7 `LoadingBlock`** placeholders shaped like the profile bands (identity +
 * tiles + graph + arena) — visual placeholders for the load gap only, NEVER
 * profile-shaped fake content. This is P7's SECOND consumer; Discovery's
 * `LoadingSkeleton` is the first and is untouched.
 *
 * Each block gains `data-loading-block` and KEEPS `data-slot="skeleton"` — the
 * coexistence `ui/loading-block.tsx:30-35` exists to preserve. `--r` rounding
 * lives inside the primitive, so the class lists shed it here; the remaining
 * token set is unchanged.
 */
export function ProfileLoading(): React.JSX.Element {
	return (
		<div data-testid="profile-loading" className="flex flex-col gap-5">
			<LoadingBlock className="h-24 w-full" />
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{TILE_BLOCK_KEYS.map((k) => (
					<LoadingBlock key={k} className="h-20" />
				))}
			</div>
			<LoadingBlock className="h-48 w-full" />
			<LoadingBlock className="h-64 w-full" />
		</div>
	);
}

/** The profile error state (W2.11 kit) — the OQ-7 load-error line. */
export function ProfileError(): React.JSX.Element {
	return (
		<p
			data-testid="profile-error"
			className="py-12 text-center text-sm text-n5"
		>
			{PROFILE_COPY.error.load}
		</p>
	);
}
