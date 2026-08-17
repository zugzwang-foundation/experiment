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
 * ⛔⛔ THE OLD RULING IT REVERSES, AND HOW FAR THE REVERSAL GOES. Both tables
 * carry a docblock saying a document-level ArrowDown "would kill keyboard
 * scrolling of the whole route", which is true and is why the handler was scoped
 * to the table in the first place. It is NARROWED rather than fully answered, and
 * the honest statement of the trade is: while the rows are on screen and nobody
 * has taken focus, ↑/↓ step the list instead of scrolling the page. Every other
 * scroll affordance is untouched — wheel, trackpad, PageUp/PageDown, Home/End,
 * space, the scrollbar — and the surface's primary control is the list, which is
 * what the mockup binds these keys to unconditionally. Once the list is scrolled
 * out of view the page takes the keys back.
 * ⚠ THE FIRST ATTEMPT TRIED TO GIVE UP NOTHING AND GAVE UP THE ROW INSTEAD: it
 * stood down whenever the page could scroll at all, which made ↑/↓ a function of
 * window height. Measured at a pinned 1440×777 the profile page is 886 tall, so
 * it stood down on the very surface R4 is about. A condition that disables the
 * feature in its own acceptance case is not a safeguard.
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
			// ⛔⛔ THE STAND-DOWN IS "THE LIST IS NOT ON SCREEN", AND THE FIRST
			// ATTEMPT AT IT WAS WRONG IN A WAY ONLY STAGING COULD SHOW. It read
			// `scrollHeight > clientHeight` — the page cannot scroll, so nothing is
			// taken — which is a clean answer to the old ruling's objection and made
			// the feature CONDITIONAL ON WINDOW HEIGHT. Measured at the pinned
			// 1440×777 the profile page is **886** tall against a 777 viewport, so the
			// arm stood down and ↑/↓ did nothing from a fresh load: R4's own
			// acceptance, failed by its own guard.
			// ⇒ The question that actually matters is not whether the page could
			// scroll but whether the thing being steered is IN FRONT OF THE READER.
			// While the rows are on screen the arrows belong to them; once the list
			// has been scrolled away, the page takes them back. That holds at load on
			// every width — which is the state R4 is about — and it still hands the
			// keys back in the case where keeping them would be most confusing.
			// ⚠ AN UNMEASURED RECT IS NOT AN ABSENT ONE. jsdom performs no layout and
			// returns zeros for everything, and a naive `bottom <= 0` reads that as
			// "off screen" and disables the arm in every render test. So the rect has
			// to be KNOWN before it can disqualify anything.
			const rect = table.getBoundingClientRect();
			const viewportH =
				window.innerHeight || document.documentElement.clientHeight;
			const measured = rect.height > 0 || rect.width > 0;
			if (
				measured &&
				viewportH > 0 &&
				(rect.bottom <= 0 || rect.top >= viewportH)
			) {
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
