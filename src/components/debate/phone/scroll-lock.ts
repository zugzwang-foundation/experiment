/**
 * MOBILE-2d · D-5 — locking the phone tier's scroll while a sheet is up.
 *
 * ⛔⛔ WHAT ACTUALLY HOLDS THE FEED STILL IS THE FULL-VIEWPORT LAYER, NOT THIS
 * MODULE, AND SAYING SO IS THE POINT RATHER THAN A DISCLAIMER.
 *
 * `PhoneSheet` renders a `fixed inset-0` root with an `inset-0` backdrop under
 * it, so while a sheet is open the feed is not hit-testable and no gesture can
 * reach it. Measured on the bounded build, M3, both sheets, four heights each,
 * with the body lock in place AND with `document.body.style.overflow` cleared
 * live while the sheet was up: **every cell moved 0px in both arms**, and
 * `elementFromPoint` down the centre line returned the sheet's own subtree at
 * every height. On the UNBOUNDED build the same experiment moved the document
 * **302px** with the lock removed — so the body lock used to be load-bearing and
 * is not any more, which is exactly what a bounded shell does to it.
 *
 * ⇒ So this module is a BELT, and it is worth having for one reason: the
 * measured mechanism is a property of the sheet's geometry, and a sheet that
 * stops covering the viewport would lose it silently. A lock that names the
 * scroll container keeps working when the geometry changes. It is not a fix for
 * a defect that exists today; it is the thing that makes tomorrow's change safe.
 *
 * ⚠ `document.body` IS STILL LOCKED, AND DELIBERATELY. Below 640px the body no
 * longer scrolls so that half is inert, but this component's own tree is not the
 * only thing on the page and the desktop tier's rules are not this file's to
 * change. Locking both costs one assignment.
 *
 * ⚠ THE SCROLL POSITION IS CAPTURED AND RESTORED EXPLICITLY. `overflow: hidden`
 * preserves `scrollTop` in every engine this project targets — but "every engine
 * I checked" is not a contract, and a reader who loses their place in a long
 * feed because they opened the market details would never report it as a bug.
 * The restore costs one number per container.
 */

/** Every element that is genuinely scrolling right now, in DOM order. */
function liveScrollContainers(): HTMLElement[] {
	const out: HTMLElement[] = [];
	for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
		if (el.scrollHeight <= el.clientHeight + 1) {
			continue;
		}
		const overflowY = getComputedStyle(el).overflowY;
		if (overflowY === "visible" || overflowY === "clip") {
			continue;
		}
		out.push(el);
	}
	return out;
}

/**
 * Lock the page and every live scroll container. Returns the restore function.
 *
 * ⛔ THE RESTORE IS THE RETURN VALUE, NOT A SECOND EXPORTED FUNCTION. A
 * `lock()`/`unlock()` pair has to re-derive what it locked, and the set it finds
 * on the way out is not guaranteed to be the set it found on the way in — a
 * sheet can change the layout underneath it. A closure over the captured list
 * cannot get that wrong, and it makes nesting correct for free: an inner lock
 * captures whatever the outer one left, and unwinds to it.
 */
export function lockPhoneScroll(): () => void {
	const body = document.body;
	const previousBodyOverflow = body.style.overflow;
	const captured = liveScrollContainers().map((el) => ({
		el,
		overflow: el.style.overflowY,
		top: el.scrollTop,
	}));

	body.style.overflow = "hidden";
	for (const c of captured) {
		c.el.style.overflowY = "hidden";
	}

	return () => {
		body.style.overflow = previousBodyOverflow;
		for (const c of captured) {
			c.el.style.overflowY = c.overflow;
			// ⚠ ASSIGNED BACK UNCONDITIONALLY, not only when it differs. Reading
			// `scrollTop` to decide whether to write it is a read of the value the
			// write exists to guarantee.
			c.el.scrollTop = c.top;
		}
	};
}
