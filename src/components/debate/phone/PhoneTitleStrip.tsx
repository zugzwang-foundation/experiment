"use client";

import Link from "next/link";

import { MarketThumb } from "@/components/discovery/MarketThumb";

/**
 * RF-2 / RF-9 — the phone page's identity row, in both arms: the market's
 * Discovery thumb and the full question on the feed; a back arrow, the post's
 * own title and the market title beneath it as a subscript, on the thread.
 *
 * ⛔⛔ THE WHOLE ROW IS THE TAP TARGET, AND NO PIXEL SAYS SO. R1 drew a `↗`
 * beside the question and the founder struck it at R2: a separate control for
 * "open the details" implies the rest of the row does something else, and on a
 * phone the row IS the affordance. So the title is one `<button>` spanning the
 * row — which also buys the three things RF-2 asks for and a `div
 * role="button"` would have had to reimplement by hand: it is focusable, it
 * fires on Enter AND Space, and it is announced as a button.
 *
 * ⚠ THE BACK LINK IS A SIBLING OF THAT BUTTON, NEVER INSIDE IT. Interactive
 * content may not nest, and a `<a>` inside a `<button>` is the shape that both
 * violates it and still looks fine on a desktop mouse.
 *
 * ⚠ THE QUESTION IS NEVER TRUNCATED, and that is the defect this surface exists
 * to fix. MOBILE-2 RECON measured the desktop `<h1>` at 375px rendering 550px of
 * text inside a 319px box behind `truncate` — 231px of the market's own question
 * cut off, on the page whose subject it is. `min-w-0` on the text cell is what
 * lets it wrap instead of pushing the row wide; there is no `truncate` here and
 * there must never be one.
 */
export function PhoneTitleStrip({
	title,
	subtitle,
	thumbUrl,
	backHref,
	expanded,
	onOpen,
}: {
	title: string;
	/** RF-9 — the market title, beneath a post's own title, on the thread arm. */
	subtitle?: string;
	/**
	 * `model.market.thumbImageUrl` — the market's `is_default` `market_media`
	 * row, i.e. THE SAME OBJECT Discovery's card renders, not a crop of the 16:9
	 * header media. It is already on the read model (UI-OVERNIGHT entry 4) and
	 * costs no second read, so the phone strip and the Discovery card a reader
	 * arrived from cannot show the same market two different faces.
	 * Absent on the thread arm, where the back arrow takes the slot.
	 */
	thumbUrl?: string | null;
	backHref?: string;
	expanded: boolean;
	onOpen: () => void;
}) {
	return (
		// ⚠ `items-start` ONCE THERE IS A SUBTITLE. The thread strip is a
		// three-line block (post title over the market title) and a centred back
		// arrow lands beside line 2, pointing at the middle of a sentence. R2's
		// own still carries the same rule (`.strip.thread{align-items:flex-start}`);
		// measured on the preview before it was applied.
		<div
			className={`flex gap-2.5 px-3 py-2.5 ${
				subtitle === undefined ? "items-center" : "items-start"
			}`}
		>
			{backHref !== undefined ? (
				<Link
					href={backHref}
					data-testid="phone-strip-back"
					aria-label="Back to the market"
					className="flex size-11 shrink-0 items-center justify-center text-[15px] text-ink"
				>
					<span aria-hidden="true">←</span>
				</Link>
			) : null}
			{thumbUrl !== undefined ? (
				<MarketThumb
					src={thumbUrl}
					alt=""
					className="size-10 shrink-0 rounded-(--imgr) object-cover [border:var(--avatar-ring)]"
					fallback={
						<div
							aria-hidden="true"
							className="flex size-10 shrink-0 items-center justify-center rounded-(--imgr) bg-n1 font-mono text-[8.5px] tracking-[0.16em] text-n5 [border:var(--avatar-ring)]"
						>
							ZZ
						</div>
					}
				/>
			) : null}
			<button
				type="button"
				data-testid="phone-title-strip"
				aria-expanded={expanded}
				// ⚠ BOTH, not one instead of the other. `aria-expanded` is the
				// disclosure attribute and it is what guard 15 pins; what this control
				// actually opens is a MODAL DIALOG, and `aria-haspopup="dialog"` is the
				// attribute that says so. Adding it costs nothing and removes the half
				// of the announcement that was missing (`@code-reviewer`).
				aria-haspopup="dialog"
				onClick={onOpen}
				className="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center gap-0.5 text-left"
			>
				<span className="w-full text-[13px] leading-[17px] font-bold tracking-tight text-ink">
					{title}
				</span>
				{subtitle !== undefined ? (
					<span
						data-testid="phone-strip-subtitle"
						className="w-full text-[13px] leading-[17px] font-normal text-n5"
					>
						{subtitle}
					</span>
				) : null}
			</button>
		</div>
	);
}
