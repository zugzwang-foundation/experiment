"use client";

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
 * surface). The R4 post-run ruling (2026-07-18) made the action LIVE: this
 * file is the tiny `"use client"` leaf whose button reloads the page —
 * exactly what the OQ-6 action copy promises — so the whole-surface
 * fail-closed RSC catch can render it handler-less (an RSC cannot pass an
 * event handler; the former optional `onReload` prop had no consumer and is
 * gone). Fixed copy only — the page's catch binds no error object, so no
 * diagnostic can ever reach this render.
 */
export function ErrorState() {
	return (
		<div
			data-testid="discovery-error"
			className="flex flex-col items-center gap-2 rounded-[var(--r)] bg-n0 p-10 text-center [border:var(--hairline)]"
		>
			<h2 className="text-sm font-medium">{ERROR_COPY.title}</h2>
			<p className="text-xs text-muted-foreground">{ERROR_COPY.body}</p>
			<button
				type="button"
				onClick={() => window.location.reload()}
				className="mt-2 rounded-[var(--r-chip)] px-3 py-1 font-mono text-xs [border:var(--hairline)] hover:text-ink"
			>
				{ERROR_COPY.action}
			</button>
		</div>
	);
}
