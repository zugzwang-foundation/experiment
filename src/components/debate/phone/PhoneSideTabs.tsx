"use client";

/**
 * RF-3 — the two side tabs above the feed track, and (RF-9) the two relation
 * tabs above the thread's reply track. One component, because the two are the
 * same control with different labels: a pair of equal-width segmented buttons
 * where exactly one is filled and the filled one names what is on screen.
 *
 * ⛔⛔ THE ACTIVE FILL IS RESOLVED AT THE CALL SITE AND PASSED IN, NEVER DERIVED
 * FROM THE KEY HERE. That is `AggregateFooter`'s ratified anti-inversion shape
 * (`RR-3`): a component that maps a side string to a pole token internally is
 * one edit away from painting a NO tab in the YES pole, and nothing about the
 * expression would look wrong. Passing the resolved token means the caller that
 * KNOWS which side it is holding is the one that says so.
 *
 * ⚠ IT IS ALSO WHAT KEEPS THE THREAD ARM HONEST. On the feed the tabs ARE sides,
 * so the active one is pole-filled. On the thread they are SUPPORT and COUNTER,
 * which are RELATIONS to a post — a relation has no pole, and painting one would
 * assert that Support is a colour (`AGENTS.md` §8; design-canon §3.2). The
 * thread passes the neutral emphasis step instead, and this component never has
 * to know the difference.
 *
 * ⚠ THE RING ON THE ACTIVE TAB IS LOAD-BEARING, NOT DECORATION.
 * `--color-yes` is `#181818` and the page ground is `#181818`: an active YES tab
 * painted in its own pole is invisible against the surface behind it and reads
 * as "no tab is selected". The ring is what gives it an edge, and it is applied
 * to every active tab so the selected state is ONE shape rather than two — a NO
 * tab that gained an edge only because YES needed one is the kind of asymmetry
 * nobody can read as deliberate.
 *
 * ⚠ MOBILE-2b measured it on a phone and the 1.5px `--ring-active` was not
 * enough: 1:1 against the ground is not a contrast the ring can rescue at that
 * weight, in daylight, at arm's length. It is now `2px solid var(--ring)` — the
 * same live token at a weight that reads. RI-11 rules out inventing a colour
 * and this does not; it is the affordance getting heavier, not the palette
 * gaining a member. (This paragraph named `--ring-active` after the code had
 * stopped using it — corrected by `@code-reviewer` rather than left to rot.)
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
		/** The resolved fill for THIS option when active — see the docblock. */
		activeClass: string;
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
								? `${option.activeClass} [border:2px_solid_var(--ring)]`
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
