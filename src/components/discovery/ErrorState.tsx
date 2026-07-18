/**
 * The OQ-6 error copy (web-authored, VERBATIM — tests import, never
 * re-type).
 */
export const ERROR_COPY = {
	title: "Couldn't load markets",
	body: "Something went wrong on our side. Reload to try again.",
	action: "Reload",
} as const;

/**
 * The Discovery error state (design-language §4.10 — ships WITH the
 * surface). No directive — the Slice-6 client error boundary imports it and
 * wires `onReload` to its `reset()`; rendered standalone (no handler) the
 * button is inert but present.
 */
export function ErrorState({ onReload }: { onReload?: () => void }) {
	return (
		<div
			data-testid="discovery-error"
			className="flex flex-col items-center gap-2 rounded-[var(--r)] bg-n0 p-10 text-center [border:var(--hairline)]"
		>
			<h2 className="text-sm font-medium">{ERROR_COPY.title}</h2>
			<p className="text-xs text-muted-foreground">{ERROR_COPY.body}</p>
			<button
				type="button"
				onClick={onReload}
				className="mt-2 rounded-[var(--r-chip)] px-3 py-1 font-mono text-xs [border:var(--hairline)] hover:text-ink"
			>
				{ERROR_COPY.action}
			</button>
		</div>
	);
}
