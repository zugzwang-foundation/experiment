/**
 * The friendly-fire share of a Support fill (founder ruling 2026-10-04):
 * dark diagonal hatching over the fill's own pole colour, starting at the
 * fill's LEFT edge — where the bar begins. Friendly fire is Support money
 * that contests the post (ADR-0058), so it is drawn as part OF the Support
 * fill. `pct` is a share of the fill (`friendlyFireOfSupport`), so it can
 * never spill into the Counter track. Nothing renders without it.
 *
 * ⚠ The fill that hosts it must be `relative`. Every Support/Counter bar a
 * post wears mounts it: the card footer and pop-up (`AggregateFooter`), the
 * opened post (`ReplySplitBar`) and the phone thread (`PhoneSideTabs`).
 */
export function FriendlyFireHatch({ pct }: { pct: string | null }) {
	if (pct === null) {
		return null;
	}
	return (
		<span
			data-testid="split-ff-hatch"
			aria-hidden="true"
			className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(135deg,transparent_0_3px,var(--color-ground)_3px_6px)]"
			style={{ width: pct }}
		/>
	);
}
