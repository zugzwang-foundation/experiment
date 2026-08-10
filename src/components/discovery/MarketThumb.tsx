import type { ImgHTMLAttributes, ReactNode } from "react";
import { useState } from "react";

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
 * the moment a new URL arrives — no effect, no `key`, no reset dance.
 *
 * **No `"use client"` of its own, deliberately.** All three consumers already
 * sit inside the single client boundary at `DiscoveryCarousel.tsx:1`, exactly
 * as `HeroPanels`, `DiscoveryGrid` and `MarketCard` do, so `useState` and
 * `onError` are available here with no new directive. ⚠ This component uses
 * state: a future **server** component importing it would need to add
 * `"use client"` here (or wrap it in a client leaf). Recorded, not built for.
 *
 * The `biome-ignore` for `noImgElement` lives on this file's single `<img>` —
 * three suppressions across two files collapse to one. The reason is unchanged
 * and inherited from the sites: presigned R2 GET URLs are short-lived and
 * per-load, so `next/image` optimization would re-fetch through the loader and
 * break the signed query (the `CommentImage` precedent).
 */
type MarketThumbProps = Omit<
	ImgHTMLAttributes<HTMLImageElement>,
	"src" | "alt" | "className" | "onError"
> & {
	/** The presigned GET URL, or `null` when the market/post carries no image. */
	src: string | null;
	alt: string;
	className: string;
	/** The site's OWN placeholder node — rendered for BOTH null and error. */
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

	if (src === null || src === failedSrc) {
		return <>{fallback}</>;
	}

	return (
		// `passthrough` is spread FIRST so the consumer's own attributes (the hero
		// post image's `data-testid`) serialize ahead of `alt`/`class`, preserving
		// the shipped attribute order byte for byte. It cannot clobber the four
		// props above — the type `Omit`s them, so an attempt is a compile error.
		// biome-ignore lint/performance/noImgElement: presigned R2 GET URLs are short-lived and per-load — next/image optimization would re-fetch through the loader and break the signed query (the CommentImage precedent).
		<img
			{...passthrough}
			src={src}
			alt={alt}
			className={className}
			onError={() => setFailedSrc(src)}
		/>
	);
}
