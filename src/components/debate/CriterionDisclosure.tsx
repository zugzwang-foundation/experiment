/**
 * CRIT-1 — the resolution criterion, on the page it binds, collapsed.
 *
 * `markets.description` is the PRE-REGISTERED PUBLIC TEXT a participant stakes
 * against, and the field the 6 November dataset is derived from. RESO-1 removed
 * the clamped two-line excerpt from the header — correctly, because two clamped
 * lines of the terms of a bet are an advertisement for a document you cannot
 * open — and measurement then confirmed it had been the ONLY render of the field
 * on the route. The terms survived solely behind the ADR-0025 `.md` download.
 * This component is the founder's answer: the whole text, closed by default, one
 * click or one Ctrl-F away.
 *
 * ⛔⛔ IT IS A NATIVE `<details>`, AND THE `hidden="until-found"` THE BRIEF RULED
 * ONTO THE BODY IS DELIBERATELY ABSENT — MEASURED, NOT ASSUMED. CRIT-1's brief
 * (C-4) requires `hidden="until-found"` on the content container and calls it
 * "the deliverable's whole point". In Chrome 151 it prevents the disclosure from
 * EVER OPENING:
 *
 *              probe                                   closed → open
 *   plain <details>, its OWN box                        24px → 312px  ✓ reveals
 *   <details> + hidden="until-found" body, OWN box      24px →  24px  ✗ never
 *
 * The attribute is not cleared when a `<details>` opens, so the body stays
 * `content-visibility: hidden` after the click and the element's own box never
 * grows past its summary. A participant clicking `Resolution criteria` would see
 * NOTHING — a total failure of C-1/C-2/C-7 that looks perfectly correct in every
 * screenshot, because every screenshot shows the closed state.
 *
 * ✅ AND THE ATTRIBUTE IS UNNECESSARY, FOR AN EXACT REASON. A closed `<details>`
 * hides its content through the `::details-content` pseudo-element, whose
 * computed signature is BYTE-IDENTICAL to a bare `hidden="until-found"` element:
 *
 *   closed <details> ::details-content  →  content-visibility: hidden; display: block
 *   bare hidden="until-found" element   →  content-visibility: hidden; display: block
 *
 * `content-visibility: hidden` IS the find-in-page-traversable, auto-revealable
 * class — `display: none` is not. So the capability CRIT-1 exists to restore, a
 * find-on-page match inside a collapsed disclosure expanding it, is delivered by
 * the ELEMENT ITSELF, with no attribute and no JavaScript.
 * ⇒ Nothing needed adding here; something needed NOT adding.
 *
 * ⛔ AND DO NOT "FIX" IT BY APPLYING THE ATTRIBUTE ONLY WHILE CLOSED. Tracking
 * `open` in React state and dropping the attribute on toggle does work — after
 * hydration. Before it, the server-rendered markup carries the attribute and a
 * click opens the `<details>` onto a body that is still hidden. It would also
 * add JavaScript to replace a mechanism the element already has, which is the
 * opposite of the trade this component exists to make.
 *
 * ⚠ THE FEATURE-DETECT FALLBACK (C-5) IS MOOT AND IS NOT IMPLEMENTED. Its
 * failure mode is "hidden AND unfindable in a browser without support". With a
 * plain `<details>` the content is never unfindable: the summary is always
 * visible and always clickable, and `<details>` is universally supported. A
 * fallback that force-expanded the content where `onbeforematch` is missing
 * would violate C-3 — closed by default — in exactly those browsers.
 *
 * ⚠ SAFARI AND FIREFOX DO NOT RELIABLY SCROLL TO THE FOUND TEXT (§3 caveat).
 * Expansion still occurs; the viewport just may not travel to it. Recorded, not
 * worked around — a scroll-into-view patch would be JavaScript compensating for
 * a browser bug on a surface that currently needs none.
 */
export function CriterionDisclosure({
	description,
}: {
	/**
	 * `markets.description`, verbatim. `null` is the honest empty case and
	 * renders nothing at all — the same `{market.description ? … : null}`
	 * conditional the removed header block carried, kept rather than reinvented.
	 */
	description: string | null;
}) {
	if (!description) {
		return null;
	}
	return (
		<details
			data-testid="criterion-disclosure"
			// ⚠ `shrink-0` — this is a flex item of the one-screen `PageContainer`,
			// and the summary must never be crushed. The surface has a MEASURED
			// precedent for what happens otherwise: an `<h1>` carrying `truncate`
			// (`overflow:hidden`, which sets a flex item's automatic minimum size to
			// 0) rendered 698px wide and 0px TALL when flex-shrink squeezed it.
			// ⚠ NO `open` ATTRIBUTE — C-3, founder-ruled. Its absence IS the ruling,
			// so it is asserted by `criterion-disclosure.test.tsx` rather than left
			// to be re-added by someone who thinks the page looks empty.
			className="shrink-0 rounded-(--r) [border:var(--hairline)]"
		>
			{/* C-2 — sentence case, and NOT the `.overline` recipe. That recipe is
			    `uppercase`, which would render `RESOLUTION CRITERIA`; the register
			    says sentence case, so the family is deliberately not reused here.
			    ⛔ A `<summary>` AND NOT A STYLED BUTTON. It is natively focusable,
			    natively keyboard-operable, and announced as a disclosure with its
			    expanded state — none of which survives being replaced by a `<button>`
			    plus `aria-expanded` that has to be kept in sync by hand. The register
			    forbids overriding the role for exactly that reason.
			    ⚠ `list-style` IS LEFT ALONE. The native marker triangle is the
			    affordance telling a reader this opens; removing it would leave a line
			    of text that gives no sign it is a control. */}
			<summary
				data-testid="criterion-summary"
				className="cursor-pointer rounded-(--r) px-3 py-2 text-[11px] font-bold text-n6 select-none focus-visible:shadow-(--state-focus-ring)"
			>
				Resolution criteria
			</summary>
			{/* ⚠⚠ THE OPEN BODY IS BOUNDED, AND THAT IS NOT A STYLE CHOICE.
			    `PageContainer` is `h-[calc(100dvh-60px-2px)]` with `overflow-hidden`
			    — a FIXED single screen. Unbounded open content is not "tall", it is
			    CLIPPED, which is the exact failure `debate-height-chain.test.ts`
			    names in terms: "a fixed height does not make content fit — it CLIPS
			    it, and clipping to hit a number is a failure, not a pass."
			    ⇒ The body scrolls INSIDE itself instead, which is this surface's
			    ruled overflow posture everywhere else (the debate columns' own
			    `column-scroll`): the page never scrolls, regions do.
			    ⚠ `dvh`, NOT px — the band above it is `basis-[24.2dvh]`, so this
			    surface already sizes by viewport fraction. A pixel cap would be
			    correct at exactly one viewport height. */}
			<div
				data-testid="criterion-body"
				className="max-h-[30dvh] overflow-y-auto px-3 pb-3"
			>
				{/* ⚠ `whitespace-pre-wrap` IS APPLIED ON A MEASUREMENT, NOT A GUESS
				    (C-6 says only if warranted). All EIGHT seeded descriptions carry
				    structural newlines — 6 to 8 each, with 3 to 4 blank-line paragraph
				    breaks. The longest is four paragraphs: the question, the YES
				    condition, the NO condition, the deadline. Without this they
				    collapse into one undifferentiated block, which is the readability
				    defect a disclosure exists to avoid.
				    ⛔ NO CLAMP, NO TRUNCATION, NO TRANSFORM — the text is the binding
				    terms and is rendered byte-faithfully. A clamped criterion is what
				    RESO-1 removed; reintroducing one in a nicer wrapper is the one
				    thing this component must never do.
				    ⚠ THE TYPE RECIPE IS BYTE-REUSED from the block RESO-1 removed
				    (`text-[11px] leading-[1.5] text-muted-foreground`) MINUS its
				    `line-clamp-2`. The founder ratified that treatment; only the clamp
				    was the defect, so no new value enters the build. */}
				<p
					data-testid="criterion-text"
					className="text-[11px] leading-[1.5] whitespace-pre-wrap text-muted-foreground"
				>
					{description}
				</p>
			</div>
		</details>
	);
}
