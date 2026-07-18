/**
 * The OQ-6 zero-markets copy (web-authored, VERBATIM — tests import, never
 * re-type). Rendered by the page when `listOpenMarkets` returns `[]` (SPEC.1
 * §22: zero open markets → a plain empty state, no hero, no grid).
 */
export const EMPTY_COPY = {
	title: "No open markets",
	body: "New markets appear here as they open.",
} as const;

/** The §22 zero-markets empty state (design-language §4.10 — ships WITH the surface). */
export function EmptyState() {
	return (
		<div
			data-testid="discovery-empty"
			className="flex flex-col items-center gap-2 rounded-[var(--r)] bg-n0 p-10 text-center [border:var(--hairline)]"
		>
			<h2 className="text-sm font-medium">{EMPTY_COPY.title}</h2>
			<p className="text-xs text-muted-foreground">{EMPTY_COPY.body}</p>
		</div>
	);
}
