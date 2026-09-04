"use client";

import { useState } from "react";

import { KnowMore } from "@/components/debate/KnowMore";

/**
 * UI-OVERNIGHT entry 3 — THE ARGUMENT PANEL'S BODY, BEHIND `Know more`.
 *
 * ⛔ WHAT THIS REPLACES, AND WHY THE REPLACED REASONING WAS RIGHT AT THE TIME.
 * The replica card rendered the argument's body IN FULL, and its own note gave
 * the reason: the card exists to READ the argument, so nothing should be hidden
 * behind a control. That holds while the panel is the only place the body
 * appears. It stopped holding once the same panel had to sit beside a positions
 * table in a fixed band — the full body pushed the split bar and the image slot
 * down, and a long argument turned the panel into a scroller with its footer
 * off-screen. The founder ruled the description out of the preview; the body is
 * one click away rather than gone.
 *
 * ⚠ THE CONTROL IS THE SHIPPED `KnowMore`, NOT A COPY. The brief asks for the
 * discovery card's control specifically, and reusing it is what keeps one
 * affordance meaning one thing across the product — a reader who learns it on a
 * post card has learnt it here.
 *
 * ⚠⚠ IT ANNOUNCES `aria-expanded`, NOT `aria-haspopup`, and that distinction is
 * the reason `KnowMore` regained the prop. This mount opens NO dialog: the
 * debate pop-up takes a `PresentPost` and this surface holds none of its fields
 * (`ArgumentBody` records the same finding), so reusing it would mean inventing
 * data to satisfy a type. An in-place disclosure announced as a dialog trigger
 * is a lie to a screen reader; the visible control is identical either way.
 *
 * ⚠ THE BODY'S TESTID AND CLASSES ARE UNCHANGED from the paragraph this wraps —
 * `argument-replica-body-*`, `text-sm whitespace-pre-line`, no clamp — so when
 * it IS open, every existing reader still finds exactly what it found before.
 */
export function ReplicaBody({ id, body }: { id: string; body: string }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			{/* `self-start` — the control hugs the left edge under the title rather
			    than stretching the width of the card, which is what a full-width
			    ghost button would do inside this flex column. */}
			<KnowMore
				label="Know more about this argument"
				onClick={() => setOpen((v) => !v)}
				expanded={open}
				className="self-start"
			/>
			{open ? (
				<p
					data-testid={`argument-replica-body-${id}`}
					className="text-sm whitespace-pre-line"
				>
					{body}
				</p>
			) : null}
		</>
	);
}
