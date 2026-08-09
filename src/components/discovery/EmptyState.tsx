/**
 * The OQ-6 zero-markets copy (web-authored, VERBATIM — tests import, never
 * re-type). Rendered by the page when `listOpenMarkets` returns `[]` (SPEC.1
 * §22: zero open markets → a plain empty state, no hero, no grid).
 */
export const EMPTY_COPY = {
	title: "No open markets",
	body: "New markets appear here as they open.",
} as const;

/**
 * The §22 zero-markets empty state (design-language §4.10 — ships WITH the
 * surface).
 *
 * DISCOVERY-COMPLETE C9 / founder ruling R9 — reconciled to the W2.11 **P1**
 * block, the ONE shape Empty and Error now share
 * (`DESIGN_W2_11_state-kit_mockup-v0_1.html:80-84`): hairline panel, `--r`,
 * `bg-n0`, 148px floor, centred column, gap 10, pad 24. `.msg` is the 13.5px
 * n6 tier and `.sub` the 12px n4 tier.
 *
 * The copy consts are carried VERBATIM and unchanged — `EMPTY_COPY.title` maps
 * to `.msg` and `.body` to `.sub`. Inventing or re-wording either would cross
 * CLAUDE.md §3 (social-content invention); the tests assert THROUGH these
 * consts and never re-type a string.
 *
 * The `<h2>`/`<p>` elements are kept rather than the mockup's two `<div>`s:
 * the mockup is a visual prototype, and demoting a heading to a div would lose
 * document semantics for no visual gain. Only the type tiers moved.
 */
export function EmptyState() {
	return (
		<div
			data-testid="discovery-empty"
			className="flex min-h-[148px] flex-col items-center justify-center gap-[10px] rounded-[var(--r)] bg-n0 p-6 text-center [border:var(--hairline)]"
		>
			<h2 className="max-w-[320px] text-[13.5px] text-n6">
				{EMPTY_COPY.title}
			</h2>
			<p className="text-[12px] text-n4">{EMPTY_COPY.body}</p>
		</div>
	);
}
