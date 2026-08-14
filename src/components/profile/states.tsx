import { ErrorBlock } from "@/components/ui/error-block";
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

/**
 * The profile error state — the route-boundary family block, not a W2.11 kit
 * member (canon §10 `C-STATES-1`).
 *
 * ⚠ THIS IS A REPLACEMENT, NOT A WRAPPING. It was a bare `<p>`: no container,
 * no heading, no action, no panel. The retry already WORKED — `error.tsx`
 * wrapped the whole message in a `<button onClick={reset}>` styled `block
 * w-full text-left` — but it had no AFFORDANCE: no visible control, no focus
 * treatment, no accessible name. A working action that looks like nothing is
 * not a working affordance.
 *
 * THE PROP IS `onAction`, NOT `onRetry`, and the name is carried unchanged
 * through to the leaf on purpose. The action is a segment re-render (`reset()`),
 * not a "retry" of anything in particular; re-naming it here would reintroduce
 * at the adapter exactly the framing the leaf's own ⛔ was written against.
 *
 * `bodyTestId` keeps `profile-error` on the MESSAGE NODE, where it already was.
 * `OD-7` rules BESIDE, so the button is the body's SIBLING inside the block and
 * stays outside the marked subtree — which is what keeps the surface's
 * exact-equality assertion against `error.load` green.
 */
export function ProfileError({
	onAction,
}: {
	onAction: () => void;
}): React.JSX.Element {
	return (
		<ErrorBlock
			body={PROFILE_COPY.error.load}
			bodyTestId="profile-error"
			actionLabel={PROFILE_COPY.error.action}
			onAction={onAction}
		/>
	);
}
