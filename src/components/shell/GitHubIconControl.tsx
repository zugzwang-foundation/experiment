import { cn } from "@/lib/utils";
import { GITHUB_REPO_URL } from "@/server/github/star-count";

import { HEADER_ICON_BUTTON } from "./header-control";

/**
 * The phone header's GitHub control (MOBILE-2n · R-5 / ADR-0051 A10 D-5) — the
 * repo link as an icon, between the logo and the identity cluster, below
 * `--breakpoint-mobile` only.
 *
 * ⛔⛔ IT IS THE SECOND CONTROL POINTING AT THE SAME PLACE, NOT A SECOND
 * DESTINATION. `GitHubStarsView` is the desktop control — a labelled tab
 * carrying the live star count — and it lives in the LEFT zone inside
 * `header-secondary-controls`, which hides below 640px. So a phone reader had no
 * route to the repository at all; this restores one in the space a phone has.
 * ⚠ `GITHUB_REPO_URL` IS IMPORTED, NEVER RESTATED. Two controls that agree about
 * a URL because both were typed correctly is one edit away from two controls
 * that disagree. The desktop control reads the same constant, so the two cannot
 * drift, and R-5's instruction to reuse the href is enforced by the import
 * rather than by checking.
 *
 * ⚠ WHY THIS IS NOT THE DESKTOP CONTROL RE-SHOWN. `GitHubStarsView` is 34px tall
 * and roughly 120px wide with its label and count, and the right zone at 360px
 * has about 86px of room beside the avatar. The count is also the part a phone
 * can most afford to lose: it is a vanity figure, and the aria-label on the
 * desktop control is where the exact number lives anyway.
 *
 * ⛔ THE MARK IS AN INLINE PATH BECAUSE LUCIDE NO LONGER SHIPS ONE. Icons in
 * this app are Lucide (values-log, ratified FINAL), and `lucide-react` at the
 * pinned version exports no `Github` — brand marks were removed from the set
 * (measured: `typeof Github === "undefined"` on the installed package). So the
 * one icon in this header that is a COMPANY'S MARK rather than a UI glyph is
 * drawn here. It is sized by the register's own `[&_svg]:size-[15px]`, so it
 * matches the Home glyph beside it without stating a number.
 *
 * ⚠ THE LINK IS EXPECTED TO 404 FOR A SIGNED-OUT VISITOR TODAY, and that is not
 * a defect in this control: the repository is private until launch. The server's
 * own star fetch logs `github star count: HTTP 404` against the same URL for the
 * same reason.
 */
export function GitHubIconControl() {
	return (
		<a
			href={GITHUB_REPO_URL}
			target="_blank"
			rel="noopener noreferrer"
			data-testid="github-icon"
			aria-label="GitHub"
			/*
			 * ⛔⛔ `cn(...)` IS LOAD-BEARING HERE AND A TEMPLATE LITERAL SHIPPED THE
			 * DEFECT. The register string opens with its own `inline-flex`. Written as
			 * `${HEADER_ICON_BUTTON} hidden ...` the element carries BOTH `inline-flex`
			 * and `hidden` unprefixed — two single-class selectors at equal specificity,
			 * so the cascade decides on stylesheet emission order, and Tailwind emits
			 * `inline-flex` after `hidden`. MEASURED at the tip before this fix: the
			 * control PAINTED at 1440 and at 640 (33.99x33.99 at x 1216.72, signed out),
			 * and it widened the right zone from 165.29px to 199.29px — so JOIN and
			 * everything beside it moved 34px left on the DESKTOP. The B1-p wall is what
			 * found it; no guard in this repo would have.
			 * ⇒ `cn()` runs `twMerge`, which resolves `inline-flex` against `hidden` as
			 * one display group and keeps the LAST — so the base really is
			 * `display:none`. `max-mobile:inline-flex` carries a modifier and lands in a
			 * different group, so it survives the merge and restores the register's own
			 * display below 640px.
			 * ⚠ THE VARIANT MUST STILL NAME `inline-flex` RATHER THAN JUST UN-HIDING:
			 * there is no "un-hide", only another `display`, and it has to be the one
			 * the register wants.
			 *
			 * ⛔⛔ THE 44px TARGET IS BOUGHT BY A PSEUDO-ELEMENT, NOT BY THE BOX.
			 * R-5 rules BOTH "the same box as the home control" (34×34) and a ≥44px
			 * target, which a single element cannot be. `TriggerPill` already
			 * answered this exact pair on this tier: a transparent `::after` extends
			 * the element's hit region at the hit-testing layer, so the painted box
			 * stays 34px, the three centres stay collinear, and nothing listens for a
			 * pointer or prevents a default. 34 + 5 + 5 = 44 on BOTH axes, which is
			 * why the inset is symmetric here where the pill's is 8/4.
			 * ⛔⛔ AND THE INSET IS 6px, NOT 5px, BECAUSE `inset` POSITIONS AGAINST THE
			 * PADDING BOX AND THIS CONTROL HAS A BORDER. The arithmetic that looks
			 * right — 34 + 5 + 5 = 44 — is wrong by exactly the two hairlines: the
			 * register's `[border:var(--hairline)]` computes 0.625px a side at this
			 * device pixel ratio, so the padding box is 32.74px and a 5px inset bought
			 * a 42.74px region. MEASURED with `elementFromPoint` walking outward from
			 * each edge: 42.99 x 42.99, one pixel short of the ruled floor, with the
			 * class compiled and present and the element's own rect still reading
			 * 33.99 — i.e. nothing about the source or the box says it failed.
			 * ⇒ `-inset-1.5` is 6px, which clears the floor at 44.74px whatever the
			 * border rounds to, and it is a SPACING-SCALE step rather than an
			 * arbitrary pixel, so it tracks the same `--spacing` the gap does.
			 * ⚠ THE 6px STILL FITS: the gap to the avatar is 8px, so the two hit
			 * regions stay 2px apart and no tap is ambiguous.
			 * ⚠ HOW TO RE-MEASURE IT, because the obvious probe reads the wrong
			 * number: an element's `getBoundingClientRect()` CANNOT see a
			 * pseudo-element's hit region, and on this surface a modal deck may be
			 * open — a Radix modal sets `pointer-events:none` on everything behind it
			 * by design, so a hit-test under it measures the modal. Remove the z-50
			 * layers first, then walk `elementFromPoint` outward.
			 * ⚠⚠ THE EXTENSION'S THREE TOKENS ARE UNPREFIXED AND ARE INERT ONLY
			 * BECAUSE `hidden` WINS ABOVE 640. If a later round ever shows this
			 * control at desktop width, a 44px hit region comes with it into a zone
			 * whose neighbour gap is 8px — so un-hiding it is a geometry decision and
			 * not a visibility one. Named here rather than prefixed, because
			 * prefixing would imply the desktop case is handled when it is merely
			 * absent. `@code-reviewer`, LOW.
			 * ⚠ IT MUST NOT BE CLIPPED. A clipped region is not hit-testable — the
			 * rule `AggregateFooter` records — and the header's row has no
			 * `overflow:hidden`, so the 5px reaches. The 5px it takes on the right is
			 * inside the 8px gap to the avatar, so the two targets do not overlap.
			 *
			 * ⚠ `max-mobile:me-2` IS THE GAP, AND IT IS A MARGIN RATHER THAN A `gap`
			 * ON THE ZONE. The right zone declares no `gap` — its spacing is carried
			 * by the divider's own `mx-3` — so adding one would move `DharmaCluster`,
			 * `IdentityCluster` and `VisitorCounter` apart at 1440. A margin on this
			 * control alone is the additive form. The value is the left zone's own
			 * `gap-2`, which is what R-5 asks for: the gap from this icon to the
			 * avatar equals the gap from Home to RULES.
			 */
			className={cn(
				HEADER_ICON_BUTTON,
				"relative hidden after:absolute after:-inset-1.5 after:content-['']",
				"max-mobile:me-2 max-mobile:inline-flex",
			)}
		>
			{/*
			 * The GitHub mark, 16×16 viewBox so the register's 15px sizing lands on a
			 * whole-pixel scale. `aria-hidden` — the accessible name is the anchor's
			 * `aria-label`, and a titled mark would give the control two names.
			 */}
			<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
				<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
			</svg>
		</a>
	);
}
