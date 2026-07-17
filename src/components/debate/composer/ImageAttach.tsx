"use client";

import { useRef } from "react";

import { IMAGE_UPLOADS_ALLOWED_MIME } from "@/server/config/limits";
import { STATE_COPY } from "./copy";

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
	return (
		<div className="flex flex-col gap-1">
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
			<div className="flex items-center gap-2 text-xs">
				{state.phase === "attached" ? (
					<>
						<span className="max-w-40 truncate font-mono text-ink">
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
					</>
				) : state.phase === "attaching" ? (
					<span className="text-n4">{state.name}…</span>
				) : (
					<button
						type="button"
						disabled={disabled}
						aria-label="Attach an image"
						onClick={() => inputRef.current?.click()}
						className="rounded-(--r-chip) px-2 py-1 text-n5 transition-all [border:var(--hairline)] hover:text-ink focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity)"
					>
						Image
					</button>
				)}
				<span className="text-[10px] text-n4">
					Shown whole · any orientation
				</span>
			</div>
			{state.phase === "error" && (
				<div
					role="status"
					aria-live="polite"
					className="rounded-(--r-chip) bg-n1 px-2 py-1 text-[11px]"
				>
					{state.message !== "" && (
						<span className="font-semibold text-ink">{state.message} </span>
					)}
					<span className="text-n5">{STATE_COPY.gateDown.body}</span>
				</div>
			)}
		</div>
	);
}
