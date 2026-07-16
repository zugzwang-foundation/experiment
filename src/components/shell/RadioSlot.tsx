/**
 * The radio slot — INERT placeholder skin, ratified OQ-3: default OFF,
 * `aria-disabled`, STATIC bars (no fake "On Air" liveness — a named
 * deviation from the mockup's animated synth-wave). Server component, zero
 * client JS. The real YouTube-backed player + final look are W2.14 —
 * Session B, SPEC-FIRST (§21.5 amendment + ADR before ANY build). Title is
 * the mockup's verbatim string (flagged at the log for web review — it
 * describes the ON depiction this inert skin never shows).
 */
const BAR = "w-[3px] rounded-[1px] bg-ink";

export function RadioSlot() {
	return (
		<button
			type="button"
			disabled
			aria-disabled="true"
			aria-label="Radio"
			title="Radio — depicts live music when ON (placeholder skin; built in W2.14)"
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
	);
}
