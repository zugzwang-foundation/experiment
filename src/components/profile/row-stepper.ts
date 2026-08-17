"use client";

import { type RefObject, useEffect } from "react";

/**
 * ⚠ TARGETS WHOSE OWN SEMANTICS OWN THE ARROW KEYS. R4 names the two that
 * matter — an input and a textarea, where Up/Down move a caret — and the rest
 * are here for the same reason rather than for completeness: in every one of
 * them an arrow key already means something to the person pressing it, and a
 * list that steals it is a list that broke a control it does not own. The sell
 * module's stake field is the concrete case on this surface: it is an `<input>`
 * living INSIDE the table, so nothing about position saves it.
 */
function ownsArrowKeys(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	const tag = target.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
		return true;
	}
	if (target.isContentEditable) {
		return true;
	}
	const role = target.getAttribute("role");
	return (
		role === "listbox" ||
		role === "combobox" ||
		role === "menu" ||
		role === "menuitem" ||
		role === "option"
	);
}

/**
 * PROFILE OVERLAP · R4 — ↑/↓ STEP THE ROWS FROM LOAD, WITH NO CLICK.
 *
 * ⚠⚠ THE DEFECT, AND IT WAS TWO DEFECTS WEARING ONE COAT. The first row is
 * selected on mount, but the keyboard could not reach the stepper at all: the
 * `onKeyDown` that drives it is bound to the `<table>`, so it fires only while
 * focus is already inside — and at load focus is on `<body>`. MEASURED on
 * staging: two ArrowDowns from a fresh load moved nothing. ⇒ THIS hook is the
 * half that makes the keys arrive. The other half was the stepper's ANCHOR,
 * which read the stored pick rather than the derived one and so re-selected the
 * row it was already on; it is fixed in the two tables, where the derivation
 * lives.
 *
 * ⛔⛔ THE OLD RULING IT REVERSES, AND WHY THE REVERSAL IS SAFE. Both tables
 * carry a docblock saying a document-level ArrowDown "would kill keyboard
 * scrolling of the whole route", which is true and is the reason the handler was
 * scoped to the table in the first place. It is answered rather than overruled:
 * this arm STANDS DOWN whenever there is page scrolling to steal. That is not a
 * heuristic about breakpoints — it is `scrollHeight > clientHeight`, the exact
 * predicate the row-third uses for "the region is definite", read at keypress
 * time. Where the page cannot scroll, an arrow key means nothing to the page and
 * everything to the list; where it can, the page keeps it.
 *
 * ⛔ AND IT STANDS DOWN WHENEVER ANYTHING ELSE COULD PLAUSIBLY WANT THE KEY:
 * a caret, a role with its own arrow grammar, focus inside the table (the
 * table's own handler owns that case, and firing both would step twice per
 * press), or focus on any other control the reader has deliberately tabbed to.
 * The arm is for exactly one state — nobody has taken focus yet — which is the
 * state a page is in when it has just loaded, and the state R4 is about.
 */
export function useDocumentRowStepper({
	tableRef,
	step,
	enabled,
}: {
	/** The table whose rows are stepped; also the fence for "focus is inside". */
	tableRef: RefObject<HTMLElement | null>;
	/** The surface's own stepper. Called with −1 for Up, 1 for Down. */
	step: (dir: 1 | -1) => void;
	/**
	 * `false` suspends the arm. Both tables pass "no filter popover is open" —
	 * canon §5 rules that Up/Down yield while one is, and the popover's options
	 * are a list of their own.
	 */
	enabled: boolean;
}): void {
	useEffect(() => {
		if (!enabled) {
			return;
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
				return;
			}
			// A modified arrow is a different gesture (word-jump, select-to, history)
			// and never ours.
			if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
				return;
			}
			if (ownsArrowKeys(e.target)) {
				return;
			}
			const table = tableRef.current;
			if (table === null) {
				return;
			}
			if (e.target instanceof Node && table.contains(e.target)) {
				// The table's own handler has this. ⛔ Not a redundant guard: without
				// it every press inside the table steps twice.
				return;
			}
			const active = document.activeElement;
			if (
				active !== null &&
				active !== document.body &&
				active !== document.documentElement
			) {
				return;
			}
			const doc = document.documentElement;
			if (doc.scrollHeight > doc.clientHeight + 1) {
				// The page can scroll, so the arrow belongs to the page.
				return;
			}
			e.preventDefault();
			step(e.key === "ArrowUp" ? -1 : 1);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
		// `step` closes over the visible rows and the current pick, so it changes
		// identity every render and the listener is re-bound with it. That is the
		// cheap half of the trade: a ref would bind once and then need its own
		// update path, and a stepper reading a stale row set is the exact class of
		// bug this row was filed for.
	}, [tableRef, step, enabled]);
}
