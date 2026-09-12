"use client";

/**
 * RF-3 — the two side tabs above the feed track, and (RF-9) the two relation
 * tabs above the thread's reply track. One component, because the two are the
 * same control with different labels: a pair of equal-width segmented buttons
 * where exactly one is filled and the filled one names what is on screen.
 *
 * ⛔⛔ THE ACTIVE TAB IS A WHITE FILL ON BOTH SIDES, AND THE STYLE LIVES HERE —
 * founder ruling Q1-a of 2026-09-12, ADR-0050 A2 D-4(v). This is a TAB-CONTROL
 * exception to the pole binding; black = YES / white = NO remains in force on
 * side badges, split bars and the bottom bar, which is where it carries meaning.
 *
 * ⚠ THE HISTORY IS THE ARGUMENT, so it is kept rather than deleted. The active
 * fill used to be resolved at the call site and passed in as `activeClass` —
 * `AggregateFooter`'s ratified anti-inversion shape (`RR-3`), on the reasoning
 * that a component mapping a side string to a pole token internally is one edit
 * away from painting a NO tab in the YES pole. That reasoning was sound and it
 * is now moot: there is no pole in the answer, so there is nothing to derive and
 * nothing to get backwards. A prop that must forever carry one value is itself a
 * way for a later edit to make it carry two, so it is gone.
 *
 * ⚠ AND THE THREAD ARM IS WHY THE RULING IS COHERENT RATHER THAN ARBITRARY. On
 * the thread these tabs are SUPPORT and COUNTER — RELATIONS to a post, and a
 * relation has no pole (`AGENTS.md` §8; design-canon §3.2), so they have always
 * used the neutral emphasis step. The feed tabs now match what the thread tabs
 * already were; the two sets are one control again.
 *
 * ⛔ THE RING IS GONE, AND ITS WHOLE PURPOSE IS WHY. `--color-yes` is `#181818`
 * and the page ground is `#181818`, so an active YES tab painted in its own pole
 * was invisible and read as "no tab is selected". A ring was added to give it an
 * edge, then thickened to `2px` when MOBILE-2b measured 1.5px as too light at
 * arm's length — an affordance getting heavier to rescue a 1:1 contrast. A white
 * fill on the same ground is not 1:1, so the rescue has nothing left to rescue.
 * The active tab keeps a 2px border in the FILL'S OWN COLOUR: it draws no seam,
 * and it holds the box geometry the ring established so the label does not shift
 * by a pixel when a tab is selected.
 */
/**
 * ⛔⛔ THE TAB CONTRACT IS KEPT, NOT MERELY CLAIMED — and the first cut claimed
 * it. It declared `role="tablist"` / `role="tab"` / `aria-selected` with no
 * `aria-controls`, no `role="tabpanel"` on the panes, and no roving tabindex, so
 * AT announced a tab widget whose arrow-key contract did not exist. Caught by
 * `@code-reviewer`. A half-kept ARIA role is worse than none: it tells an
 * assistive technology how to drive a control and then does not answer.
 * ⇒ `aria-controls` points at the pane (`PhoneFeedTrack` gives each one the
 * matching `id` and `role="tabpanel"`), exactly one tab is in the tab order at a
 * time, and ArrowLeft/ArrowRight move between them the way a tablist is
 * supposed to.
 */
export function PhoneSideTabs({
	options,
	active,
	onSelect,
	panelIdFor,
}: {
	options: {
		key: string;
		label: string;
		trailing: string;
	}[];
	active: string;
	onSelect: (key: string) => void;
	/** The `id` of the pane this tab controls — see `PhoneFeedTrack`. */
	panelIdFor: (key: string) => string;
}) {
	const move = (from: string, delta: number) => {
		const at = options.findIndex((option) => option.key === from);
		const next = options[(at + delta + options.length) % options.length];
		if (next !== undefined) {
			onSelect(next.key);
		}
	};
	return (
		<div
			data-testid="phone-side-tabs"
			role="tablist"
			className="flex gap-2 px-3 pb-2"
		>
			{options.map((option) => {
				const on = option.key === active;
				return (
					<button
						key={option.key}
						type="button"
						role="tab"
						id={`phone-tab-${option.key}`}
						aria-selected={on}
						aria-controls={panelIdFor(option.key)}
						// ⚠ ROVING: exactly one tab is tabbable, so Tab enters and leaves
						// the widget once instead of stopping on every tab in it.
						tabIndex={on ? 0 : -1}
						data-testid={`phone-tab-${option.key}`}
						onKeyDown={(event) => {
							if (event.key === "ArrowRight") {
								event.preventDefault();
								move(option.key, 1);
							} else if (event.key === "ArrowLeft") {
								event.preventDefault();
								move(option.key, -1);
							}
						}}
						onClick={() => onSelect(option.key)}
						className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-(--r) text-xs font-bold tracking-[0.06em] uppercase transition-colors ${
							on
								? "bg-ink text-ground [border:2px_solid_var(--color-ink)]"
								: "text-n5 [border:var(--hairline)]"
						}`}
					>
						<span>{option.label}</span>
						<b className="font-extrabold tracking-normal">{option.trailing}</b>
					</button>
				);
			})}
		</div>
	);
}
