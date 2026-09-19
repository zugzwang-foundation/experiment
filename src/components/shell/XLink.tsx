import { cn } from "@/lib/utils";

import { HEADER_PILL_BUTTON } from "./header-control";

/** The project's account. A literal, because there is exactly one and it is not configurable. */
const X_PROFILE_URL = "https://x.com/zugzwangworld";

/**
 * The header's `X` control (MKT-ROSTER-1-P3) — an off-site link to the
 * project's account, in the left zone's utility row, in the slot `RulesControl`
 * vacated when it moved to the identity side.
 *
 * ⛔⛔ THE MARK IS THE OFFICIAL ONE AND ITS GEOMETRY IS UNMODIFIED. Source:
 * X's own brand toolkit — `about.x.com/en/who-we-are/brand-toolkit` →
 * `x-logo.zip` → `logo.svg`, downloaded 2026-09-19, md5
 * `0c9462a79f736453eac5bf7cbb756875`, `viewBox="0 0 1200 1227"`, one path. The
 * `d` below is that file's byte-for-byte. TWO things changed and neither is
 * geometry: the wrapper's `fill="none"`/`width`/`height` are dropped so the
 * class controls the box, and the path's `fill="white"` is dropped so the mark
 * inherits `currentColor` from the pill — hard-coding white would break the one
 * rule this repo's token layer never bends, that a colour is named by role.
 *
 * ⚠ NOT `lucide-react`'s `Twitter`. That is the retired bird, and shipping it
 * would be the wrong brand rather than a stylistic near-miss. Lucide has no X
 * mark. ⚠ And not hand-drawn: a redrawn logo is a subtly wrong logo, which is
 * worse than an obviously wrong one because nobody catches it.
 *
 * ⚠ THE ACCESSIBLE NAME IS ON THE LINK, NOT THE MARK. The `<svg>` is
 * `aria-hidden` with `focusable="false"` — the second matters because IE/Edge
 * legacy and some AT still put an un-focusable-marked SVG in the tab order, and
 * a decorative glyph that takes a tab stop is a stop that announces nothing.
 * `aria-label` carries the destination and the new-tab warning, matching
 * `GitHubStarsView`'s own "(opens in a new tab)" phrasing so the two off-site
 * controls announce alike.
 *
 * ⚠ SQUARE, WHERE RULES IS A TEXT PILL. It keeps `HEADER_PILL_BUTTON` — same
 * height, same radius, same hairline, same fill and the same four interactive
 * states — and overrides only the box: `w-[34px] px-0 justify-center`, so a
 * 15px glyph sits centred in a 34×34 square rather than in 41px of pill built
 * for a five-letter word. 15px is the star register `GitHubStarsView` already
 * ships (`[&_svg]:size-[15px]`), so the two utility marks are one size.
 *
 * ⚠ SERVER COMPONENT, ZERO CLIENT JS — which is why it reads the pill register
 * from `header-control.ts` rather than from `RulesControl.tsx`. That file is
 * `"use client"`, and importing a VALUE out of a client module into a Server
 * Component makes it a client reference instead of inlining the string; the
 * register module exists precisely so neither half owns it.
 *
 * ⛔ IT HIDES BELOW 640px, MIRRORING GITHUB EXACTLY. This is a decorative
 * off-site destination, and ADR-0051 A13 D-1 already withdrew the phone's
 * GitHub control to buy room for the freeze countdown on the 360px row — a
 * third utility pill in that row would give the width straight back.
 *
 * ⚠ THE HIDE IS ON THIS ROOT AND GATED ON THE PROP, not written into
 * `GlobalHeader`'s `header-secondary-controls` wrapper. That wrapper's own guard
 * documents it as holding Radio and GitHub ONLY, and the ADR-0049 convention for
 * a control that hides at the tier is a token on its own root behind
 * `mobileResponsive` — which is what keeps a third `GlobalHeader` mount, one
 * that omits the prop, on the desktop render (AGENTS.md §8).
 */
export function XLink({
	mobileResponsive = false,
}: {
	mobileResponsive?: boolean;
}) {
	return (
		<a
			href={X_PROFILE_URL}
			target="_blank"
			rel="noopener noreferrer"
			data-testid="x-link"
			aria-label="Zugzwang on X (opens in a new tab)"
			className={cn(
				HEADER_PILL_BUTTON,
				"w-[34px] justify-center px-0",
				mobileResponsive && "max-mobile:hidden",
			)}
		>
			<svg
				viewBox="0 0 1200 1227"
				xmlns="http://www.w3.org/2000/svg"
				fill="currentColor"
				aria-hidden="true"
				focusable="false"
				className="size-[15px]"
			>
				<path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" />
			</svg>
			{/* ⛔ NOT DECORATION, AND NOT A SECOND LABEL. The mark is `aria-hidden`,
			    which makes this anchor's only child invisible to assistive tech —
			    biome's `useAnchorContent` catches exactly that, and it is right to:
			    an `aria-label` is a name, and a link with a name and no CONTENT is a
			    shape some older AT and every text-only renderer reads as empty.
			    `sr-only` is clipped, so it takes no layout and changes no pixel, and
			    the ANNOUNCED name is still the `aria-label` — that attribute wins the
			    accessible-name computation outright. What this buys is the floor: if
			    the label is ever dropped, the link degrades to "X" rather than to
			    nothing. Cheaper and truer than suppressing the rule. */}
			<span className="sr-only">X</span>
		</a>
	);
}
