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
			{/* V47 — the interaction states name their ratified slots
			    (globals.css:187-210) in the house form, matching
			    `(auth)/onboarding/page.tsx:145`, the closest bordered-button
			    precedent. The button previously carried a bare `hover:text-ink`
			    and no fill, pressed or focus treatment, so the only keyboard-
			    reachable control on this surface had no focus ring at all.
			    `--dur-hover` is a COMPOUND value (`0.12s ease`), so it rides
			    `[transition:all_var(--dur-hover)]` — a `duration-*` utility would
			    emit an invalid `transition-duration`. */}
			<button
				type="button"
				onClick={() => window.location.reload()}
				className="mt-2 rounded-(--r-chip) px-3 py-1 font-mono text-xs outline-none [transition:all_var(--dur-hover)] [border:var(--hairline)] hover:bg-(--state-hover-fill) hover:text-ink focus-visible:shadow-(--state-focus-ring) active:bg-(--state-pressed-fill)"
			>
				{ERROR_COPY.action}
			</button>
		</div>
	);
}
