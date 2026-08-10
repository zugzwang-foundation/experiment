"use client";

import type { ImgHTMLAttributes, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

/**
 * PRIMITIVES-2 D2 — the ONE owner of the `null · error · loaded` state machine
 * behind Discovery's three image sites (`MarketCard`'s 52×52 thumb,
 * `HeroPanels`' 54×54 thumb, and the hero POST image).
 *
 * **It owns the STATES. It does not own the geometry and it invents no visual.**
 * The three sites are not interchangeable — 52×52 `items-start`, 54×54
 * `items-center`, and a `flex-1 min-h-[40px]` post image with its own
 * `data-testid` pair and `bg-n1` on the `<img>` itself. A component owning
 * geometry as well would be three variants × three states = nine render paths,
 * each needing its own zero-delta proof. The defect being fixed — a presigned
 * R2 URL that 404s has no degradation path — is *identical* at all three, so
 * only that is lifted. Each consumer passes its own `className` and its own
 * `fallback`, which makes the null and loaded renders byte-identical to what
 * shipped **by construction, not by assertion**.
 *
 * **The error state renders the consumer's own placeholder (D3), never
 * something new.** Each site already has a design-ratified null placeholder;
 * the error path renders that same node, which is also the correct semantic —
 * *no image available*, for either reason. Nothing here goes to the founder for
 * approval because nothing here is designed.
 *
 * **`className`, `alt` and `fallback` are all REQUIRED** (CLAUDE.md §8 O-1 —
 * structural beats procedural). A defaulted `className` would let a consumer
 * silently render an unstyled image; a defaulted `fallback` would be this
 * component inventing a visual; a defaulted `alt` would let the a11y decision
 * be made by omission. Each is a compile error instead. This is the same call
 * `PriceBar` made with its required `size`.
 *
 * **The failure is remembered by URL, not by a boolean, and that is
 * load-bearing.** `DiscoveryCarousel.tsx:102` re-renders `<HeroPanels>` in place
 * with a *different* `card` every 10s and passes no `key`, so this component
 * instance survives the market change. A boolean `errored` would latch: market
 * A's missing object would blank market B's perfectly good thumb for the rest
 * of the session. Storing *which* `src` failed makes the comparison false again
 * the moment a new URL arrives — no effect, no `key`, no reset dance. It is ONE
 * slot, not a `Set`, deliberately, and the cost of that is narrower than it
 * first looks: the slot is only ever overwritten by *another* failure, so
 * A(fail) → B(ok) → A still renders the fallback with **no** re-request. Only a
 * second failure displaces A, and only then does returning to A re-request it
 * and degrade again. That is the cheap trade against remembering every failed
 * URL for the session.
 *
 * **D2-P1 — THE MOUNT-TIME TRANSITION, and why `onError` alone was not enough.**
 * `onError` is a React *synthetic* handler, and for `<img>` React binds `error`
 * as a NON-delegated listener at hydrate time (`case "img":` →
 * `listenToNonDelegatedEvent("error", didHydrate)`, at
 * `node_modules/react-dom/cjs/react-dom-client.development.js:5274-5278` — cite
 * the react-dom copy specifically; the Next-compiled copy under
 * `next/dist/compiled/react-dom/` has entirely different line numbering).
 * Discovery is `force-dynamic`
 * and server-renders these images, so the browser starts the R2 GET at
 * HTML-parse time. The DOM `error` event fires exactly ONCE — if it lands
 * before hydration attaches the listener it is lost permanently, and the broken
 * glyph persists forever. **PERF-1 made that the common case rather than the
 * edge:** Discovery went 35.07 s → 0.692 s p50 at the `bom1` flip
 * (`docs/parked.md:25`, closed 2026-08-10), and a faster response arrives
 * EARLIER relative to hydration, which widens the lost-event window.
 *
 * So the mount effect below re-asks the element directly:
 *
 *   - `complete === false` → the load is still in flight. Do nothing; falling
 *     back here would blank a good image mid-load.
 *   - `complete === true` alone is NOT failure — it is equally true of a
 *     **cached success**. It only means the browser has finished.
 *   - `naturalWidth === 0` is what separates a finished-and-FAILED decode from
 *     a finished-and-succeeded one.
 *
 * Both mechanisms are kept and both are needed: `onError` catches the
 * post-hydration failure (including every carousel `src` swap), the mount check
 * catches the pre-hydration one. The effect re-runs on `src` CHANGE, not only
 * on first mount, because `DiscoveryCarousel.tsx:102` swaps `card` on the same
 * mounted node every 10s — a mount-only check would cover the first market and
 * nothing after it.
 *
 * ⚠ An SVG with no intrinsic dimensions reports `naturalWidth === 0` on some
 * engines even when it decoded fine, which would false-positive into the
 * fallback. Market media and post attachments are raster objects in R2, so this
 * cannot fire today. Recorded, not built for.
 *
 * ⚠ It is `useEffect`, not `useLayoutEffect`: Next.js server-renders client
 * components and `useLayoutEffect` warns there. The cost is that a broken image
 * may paint for one frame after hydration before the fallback replaces it —
 * the defect reduced to a single frame rather than left permanent. ⚠ Both
 * mechanisms are client-side, so with JS disabled or a bundle that never loads,
 * the broken glyph is still permanent. No server-side check is possible: the
 * presign is a local HMAC and cannot see whether the object exists.
 *
 * **It carries its own `"use client"` (D2-P1).** It uses hooks, so the
 * directive states that requirement at the file that has it rather than
 * relying on every consumer to already be inside a boundary. A no-op for
 * today's graph — all three consumers already sit inside
 * `DiscoveryCarousel.tsx:1` — and it removes the future-server-consumer
 * footgun this docblock previously only warned about.
 *
 * The `biome-ignore` for `noImgElement` lives on this file's single `<img>` —
 * three suppressions across two files collapse to one. The reason is unchanged
 * and inherited from the sites: presigned R2 GET URLs are short-lived and
 * per-load, so `next/image` optimization would re-fetch through the loader and
 * break the signed query (the `CommentImage` precedent).
 */
type MarketThumbProps = Omit<
	ImgHTMLAttributes<HTMLImageElement>,
	// `children` is omitted for the same O-1 reason as the rest: `fallback` is
	// the prop a caller would reach `children` for, and `children` would land in
	// `passthrough` and be spread onto a void element, throwing at render. A
	// compile error is the better failure.
	"src" | "alt" | "className" | "onError" | "children"
> & {
	/** The presigned GET URL, or `null` when the market/post carries no image. */
	src: string | null;
	alt: string;
	className: string;
	/**
	 * The site's OWN placeholder node — rendered for BOTH null and error.
	 * ⚠ `passthrough` is NOT applied to this node, deliberately: the shipped
	 * null arms carry their own attributes (the post image's
	 * `hero-post-image-empty-${side}` testid) and forwarding the loaded arm's
	 * would break the byte-identity this whole PR is proving. So an attribute
	 * passed via `passthrough` is present in the loaded state and absent in the
	 * null and error states — put it on the `fallback` node if it must appear
	 * in all three.
	 */
	fallback: ReactNode;
};

export function MarketThumb({
	src,
	alt,
	className,
	fallback,
	...passthrough
}: MarketThumbProps) {
	const [failedSrc, setFailedSrc] = useState<string | null>(null);
	const imgRef = useRef<HTMLImageElement>(null);

	// D2-P1 — the pre-hydration catch. Runs after commit, and again whenever
	// `src` changes, because the carousel swaps markets on this same node.
	useEffect(() => {
		const img = imgRef.current;
		// null whenever the fallback arm is rendered — nothing to interrogate.
		if (img === null) {
			return;
		}
		if (img.complete && img.naturalWidth === 0) {
			setFailedSrc(src);
		}
	}, [src]);

	if (src === null || src === failedSrc) {
		return <>{fallback}</>;
	}

	return (
		// ⚠ `passthrough` is spread FIRST, and the ORDER is what makes the five
		// named props below authoritative — last write wins, so no spread key can
		// clobber `ref`/`src`/`alt`/`className`/`onError`. Moving the spread below
		// would silently disable this component's whole reason to exist, and no
		// test here would catch it because none passes an `onError`. The type's
		// `Omit` is a second belt, not the first: TypeScript does NOT excess-
		// property-check a JSX spread sourced from a variable, so it catches the
		// inline-literal case only. Spreading first is also what keeps the shipped
		// attribute order byte for byte — the hero post image's `data-testid` must
		// serialize ahead of `alt`/`class`.
		// biome-ignore lint/performance/noImgElement: presigned R2 GET URLs are short-lived and per-load — next/image optimization would re-fetch through the loader and break the signed query (the CommentImage precedent).
		<img
			{...passthrough}
			ref={imgRef}
			src={src}
			alt={alt}
			className={className}
			onError={() => setFailedSrc(src)}
		/>
	);
}
