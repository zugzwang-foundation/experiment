import { InfoTip } from "@/components/ui/info-tip";
import { HEADER_GLOSSARY } from "@/lib/copy/glossary";

/**
 * The radio slot — INERT placeholder skin, ratified OQ-3: default OFF,
 * `aria-disabled`, STATIC bars (no fake "On Air" liveness — a named
 * deviation from the mockup's animated synth-wave). Server component, zero
 * client JS (the `InfoTip` wrapper below is a client leaf; this component
 * itself gains no directive). The real YouTube-backed player + final look
 * are W2.14 — Session B, SPEC-FIRST (§21.5 amendment + ADR before ANY
 * build). The gloss states the slot's actual condition (POLISH-1a V1): the
 * mockup's verbatim string described the ON depiction this inert skin never
 * shows, so it promised liveness the build cannot deliver.
 *
 * ⚠ INFO-1: `disabled` native buttons suppress pointer/mouse events in
 * Chrome/Safari at the browser's hit-testing layer, independent of CSS — this
 * button carries no `pointer-events-none` class, and the suppression still
 * applies. So the hover path may never reach this trigger's `InfoTip` in a
 * real browser. ⛔ Whether the native `title` this replaces had the SAME
 * limitation is NOT measured and is NOT asserted here (O-3: a stated cause
 * that turns out wrong is itself a defect) — `title` is a browser-native
 * hover affordance, not a JS event listener, and may not be gated by
 * `disabled` the same way. Flagged as OWED in the run report for a real-
 * browser check rather than guessed at; not worked around here, since fixing
 * it would mean restructuring a disabled control beyond what this task's
 * wiring asks.
 */
const BAR = "w-[3px] rounded-[1px] bg-ink";

export function RadioSlot() {
	return (
		<InfoTip content={HEADER_GLOSSARY.radio} asChild>
			<button
				type="button"
				disabled
				aria-disabled="true"
				aria-label="Radio"
				className="flex h-[34px] shrink-0 items-center gap-2 rounded-(--r) bg-(--btn-fill) px-3 opacity-(--state-disabled-opacity) select-none [border:var(--hairline)]"
			>
				<span aria-hidden="true" className="flex h-4 items-end gap-[2.5px]">
					<span className={`h-[30%] ${BAR}`} />
					<span className={`h-[30%] ${BAR}`} />
					<span className={`h-[30%] ${BAR}`} />
					<span className={`h-[30%] ${BAR}`} />
					<span className={`h-[30%] ${BAR}`} />
				</span>
				<span className="text-[10px] font-bold tracking-[0.11em] text-n5 uppercase">
					Radio
				</span>
			</button>
		</InfoTip>
	);
}
