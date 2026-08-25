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
 * ⚠ INFO-1: `disabled` native buttons suppress pointer events in Chrome/
 * Safari, so the hover path may never reach this trigger in a real browser —
 * carried forward unchanged from the native `title` this replaces, which had
 * the identical limitation. Not a regression introduced here; flagged as
 * OWED in the run report rather than worked around, since fixing it would
 * mean restructuring a disabled control beyond what this task's wiring asks.
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
