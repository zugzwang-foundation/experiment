import { cn } from "@/lib/utils";

import { HEADER_PILL_BUTTON } from "./header-control";

/** The project's account. A literal, because there is exactly one and it is not configurable. */
const X_PROFILE_URL = "https://x.com/zugzwangworld";

/**
 * The header's `X` control (MKT-ROSTER-1-P3) — an off-site link to the
 * project's account, in the left zone's utility row, in the slot `RulesControl`
 * vacated when it moved to the identity side.
 *
 * ⛔ A TEXT LABEL AND NO GLYPH, FOUNDER-RULED. The obvious implementation
 * reaches for an icon, and there is no honest one to reach for: `lucide-react`
 * ships `Twitter` (the retired bird) and nothing named X, so an icon here would
 * either be the wrong brand or a hand-drawn path — a second art asset in a
 * header whose every other control is a lucide glyph or a word. The word `X` at
 * the RULES pill's own type register is the smaller and the truer answer, and
 * it needs no new dependency.
 *
 * ⚠ THE ACCESSIBLE NAME CANNOT BE THE LABEL. A one-character link announces as
 * "X, link" — indistinguishable from a close affordance, which is what a lone X
 * means nearly everywhere else in a UI. `aria-label` carries the destination and
 * the new-tab warning, matching `GitHubStarsView`'s own "(opens in a new tab)"
 * phrasing so the two off-site controls announce alike.
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
				mobileResponsive && "max-mobile:hidden",
			)}
		>
			X
		</a>
	);
}
