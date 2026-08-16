"use client";

import { useRef } from "react";

import { IMAGE_UPLOADS_ALLOWED_MIME } from "@/server/config/limits";
import { STATE_COPY } from "./copy";

/** The affordance's ONE accessible name, held across every phase. */
const ATTACH_LABEL = "Attach an image";
/** Canon §6 composer register, verbatim. */
const CAPTION = "Shown whole · any orientation";

/** The affordance's render state (owned by the composer). */
export type ImageAttachState =
	| { phase: "none" }
	| { phase: "attaching"; name: string }
	| { phase: "attached"; uploadId: string; name: string }
	| { phase: "error"; message: string };

/**
 * UI.A3 slice 5 — the composer's optional-image affordance (canon §6:
 * `Image` · `Shown whole · any orientation`). The composer owns the state +
 * the attach orchestration (image-attach.ts); this renders pick / busy /
 * attached / error (the §4 image-codes P3 lands INLINE here — never a
 * composer-level strip). Error messages are the wire's own display strings.
 *
 * POLISH.4 PR B — THE PANEL IS THE COMPOSER GRID'S LEFT COLUMN, and the whole
 * panel is the pick target. Tier-4 `surface_d5_v1_0.html` (md5
 * 34619dacee472a245cb6e8678b509219): `.attach` is a full-height panel
 * (`height:100%`, `cursor:pointer`) holding a `4:5` `.imgprev` over the
 * `.acap` caption, sitting in the FIRST track of `.compgrid` (d5 `.attach` /
 * `.imgprev` / `.acap`; markup at the `.compgrid` block). Fenced by SYMBOL
 * per `O-8`.
 *
 * ⚠ RENDERS AS A FRAGMENT, DELIBERATELY. The panel must be a DIRECT child of
 * the grid or it is not a column — a wrapper `<div>` here would make the grid
 * one-column with everything nested inside it. The hidden `<input type=file>`
 * is `display:none` and so generates no grid track; it is the one sibling.
 *
 * ⛔ NO VALUE IS CARRIED OUT OF THE MOCKUP (`H-VALUE`). The mockup is a
 * light-mode pre-BRIDGE prototype and its ramp is INVERTED against the shipped
 * dark true-neutral system. Every class below is byte-carried from this file's
 * own shipped render (`[border:var(--hairline)]`, `bg-n1`, `text-n5`,
 * `text-n4`, `text-[10px]`, `rounded-(--r-chip)`) or from the ratified
 * `--imgr` image radius. The mockup's `1px dashed var(--n3)` edge and its
 * `minmax(210px, …)` track floor are REFUSED, not ported.
 */
export function ImageAttach({
	state,
	disabled,
	onPick,
	onRemove,
}: {
	state: ImageAttachState;
	disabled: boolean;
	onPick: (file: File) => void;
	onRemove: () => void;
}) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	// `.attach` — the panel chrome, identical in every phase so the column does
	// not resize as the state moves through pick → busy → attached.
	const panel =
		"flex h-full min-w-0 flex-col items-center justify-center gap-2 rounded-(--imgr) p-3 text-center text-xs [border:var(--hairline)]";
	// `.imgprev` — the 4:5 preview box (d5). A PROPORTION, which is arrangement;
	// its surface + radius are byte-carried from this file's shipped render.
	const preview =
		"flex aspect-[4/5] w-full max-w-40 items-center justify-center rounded-(--imgr) bg-n1 text-[10px] text-n4";
	// `.acap` — the caption, INSIDE the panel (d5), not a sibling of it.
	const caption = <span className="text-[10px] text-n4">{CAPTION}</span>;
	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept={IMAGE_UPLOADS_ALLOWED_MIME.join(",")}
				className="hidden"
				aria-hidden="true"
				tabIndex={-1}
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) {
						onPick(file);
					}
					// Allow re-picking the same file after an error/remove.
					e.target.value = "";
				}}
			/>
			{state.phase === "attached" ? (
				// A GROUPING element, not a <button>: the Remove control lives in this
				// panel and a nested button is invalid markup. `<fieldset>` is the
				// semantic group (biome `useSemanticElements`); its `aria-label` still
				// names the column, so the affordance keeps ONE accessible name across
				// every phase. `panel` carries `min-w-0`, which is load-bearing here —
				// a fieldset's UA `min-inline-size:min-content` would otherwise refuse
				// to shrink inside the grid track.
				<fieldset aria-label={ATTACH_LABEL} className={panel}>
					<span aria-hidden="true" className={preview} />
					<span className="flex max-w-full items-center gap-1">
						<span className="min-w-0 truncate font-mono text-ink">
							{state.name}
						</span>
						<button
							type="button"
							onClick={onRemove}
							disabled={disabled}
							aria-label="Remove image"
							className="rounded-(--r-chip) px-1 text-n4 transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring)"
						>
							×
						</button>
					</span>
					{caption}
				</fieldset>
			) : (
				// Pick / busy / error — the WHOLE panel is the target (d5
				// `.attach{cursor:pointer}`), not a small button beside a caption.
				<button
					type="button"
					disabled={disabled || state.phase === "attaching"}
					aria-label={ATTACH_LABEL}
					onClick={() => inputRef.current?.click()}
					className={`${panel} transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity)`}
				>
					<span aria-hidden="true" className={preview} />
					<span className="text-n5">
						{state.phase === "attaching" ? `${state.name}…` : "Image"}
					</span>
					{caption}
					{state.phase === "error" && (
						<span
							role="status"
							aria-live="polite"
							className="rounded-(--r-chip) bg-n1 px-2 py-1 text-[11px]"
						>
							{state.message !== "" && (
								<span className="font-semibold text-ink">{state.message} </span>
							)}
							<span className="text-n5">{STATE_COPY.gateDown.body}</span>
						</span>
					)}
				</button>
			)}
		</>
	);
}
