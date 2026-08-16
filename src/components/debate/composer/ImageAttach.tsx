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
 * dark true-neutral system. Provenance, stated per class rather than as one
 * sweeping claim — an earlier draft of this block asserted "every class below
 * is byte-carried from this file's own shipped render", which was FALSE for
 * six of them and is the `V-3` shape: a pre-verification that reads as checked
 * and does not resolve (`@code-reviewer`, MEDIUM):
 *   · from THIS FILE at `8db535d` — `[border:var(--hairline)]`, `bg-n1`,
 *     `text-n5`, `text-n4`, `text-[10px]`, `rounded-(--r-chip)`, `truncate`,
 *     `min-w-0`, `font-mono text-ink`, `font-semibold text-ink`;
 *   · from the RATIFIED token set — `rounded-(--imgr)` (values-log §3 item 2);
 *   · from SHIPPED CODE TREE-WIDE, not from d5 — `p-3`, `h-full`, `flex-1`,
 *     `gap-2`, `text-center`, `max-w-full`, `min-h-0`, `w-full`, `max-h-full`;
 *   · PROPORTIONS, which are arrangement, not values — `aspect-[4/5]`,
 *     `max-h-full` (d5's `max-height:calc(100% - 22px)` MINUS its `22px`).
 * REFUSED, not ported: d5's `1px dashed var(--n3)` edge (the panel takes the
 * shipped hairline), its `minmax(210px, …)` track floor, its `22px` height
 * offset, and its literal `IMAGE` placeholder label — the state carries no
 * preview data, so that string would claim a preview that does not exist.
 * ⚠ `max-w-40` was ALSO refused after review: it exists in shipped code only
 * as this file's old FILENAME truncation cap, so re-roling it as a 160px
 * preview cap would be byte-carrying a string without its role, and it
 * silently swapped d5's height-based containment for a width-based one.
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
	// `.attach` — the panel chrome, one shape in every phase so the column does
	// not resize as the state moves through pick → busy → attached → error.
	// `min-w-0` is LOAD-BEARING: a fieldset's UA `min-inline-size:min-content`
	// would otherwise refuse to shrink inside the grid track.
	const panel =
		"flex h-full min-w-0 flex-col items-center justify-center gap-2 rounded-(--imgr) p-3 text-center text-xs [border:var(--hairline)]";
	// `.imgprev` — d5's `width:100%; aspect-ratio:4/5; max-height:calc(100% - 22px)`
	// ported as PROPORTIONS ONLY: the `- 22px` is a value and is refused, so the
	// clamp lands as `max-h-full`. Keeping d5's height clamp is what stops the
	// preview from driving the composer's height off the grid row.
	const preview =
		"aspect-[4/5] max-h-full min-h-0 w-full rounded-(--imgr) bg-n1";
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
			{/* ⛔ THE COLUMN IS A GROUP, NEVER THE BUTTON ITSELF, AND THE LIVE
			    REGION IS THE REASON. ARIA's presentational-children rule strips the
			    roles of a `button`'s descendants, so a `role="status"` nested inside
			    the pick control is NOT monitored — and the control's `aria-label`
			    excludes the message from its accessible name as well. Making the
			    whole panel one `<button>` therefore silences every attach failure
			    (`error_image_oversize`, gate-down, sign reject) for a screen-reader
			    user, which is the one channel those codes have. ⇒ `<fieldset>` is
			    the column (biome `useSemanticElements`), the pick control FILLS it
			    so the target stays panel-sized (d5 `.attach{cursor:pointer}`), and
			    the status region is the control's SIBLING inside the group.
			    Caught by `@code-reviewer` (HIGH) on the first draft of this file. */}
			<fieldset aria-label={ATTACH_LABEL} className={panel}>
				{state.phase === "attached" ? (
					<>
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
					</>
				) : (
					<button
						type="button"
						disabled={disabled || state.phase === "attaching"}
						onClick={() => inputRef.current?.click()}
						className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2 rounded-(--imgr) transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity)"
					>
						<span aria-hidden="true" className={preview} />
						<span className="text-n5">
							{state.phase === "attaching" ? `${state.name}…` : "Image"}
						</span>
						{caption}
					</button>
				)}
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
			</fieldset>
		</>
	);
}
