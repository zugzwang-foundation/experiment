"use client";

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
 * **301–302px** with the lock removed — so the body lock used to be
 * load-bearing and is not any more, which is what a bounded shell does to it.
 *
 * ⇒ So this module is a BELT. It is worth having for one reason: the measured
 * mechanism is a property of the sheet's GEOMETRY, and a sheet that stopped
 * covering the viewport would lose it silently. A lock that names the container
 * keeps working when the geometry changes.
 *
 * ⛔⛔ IT IS SCOPED TO THE PHONE TIER AND EXCLUDES THE CALLER'S OWN LAYER, AND
 * BOTH HALVES ARE DEFECTS THIS MODULE ALREADY SHIPPED ONCE.
 *
 *   · **The caller's own layer.** The first version walked the whole document.
 *     `PhoneSheet` calls this from its own effect, AFTER the sheet has painted —
 *     so the walk reached the sheet's own body, which is `overflow-y-auto` and
 *     which overflows exactly when the reader needs it to scroll. It locked it.
 *     On the details sheet that hides the price chart and the export link below
 *     the fold with no way down; on the composer it hides `PLACE Đ BET` with a
 *     keyboard up, which is the money path. Found by `@code-reviewer`.
 *     ⚠ AND THE MEASUREMENT THAT SHOULD HAVE CAUGHT IT COULD NOT: a reachability
 *     probe that does `body.scrollTop = body.scrollHeight` succeeds on an
 *     `overflow: hidden` box, because programmatic scrolling is not what
 *     `hidden` forbids. Only a finger is.
 *   · **The tier scope.** Unscoped, this also reached the DESKTOP tree —
 *     `DebateColumn`, `headzone-stack`, `BetComposer`'s own scroller — because
 *     `MarketPriceChartOverlay` uses it at 1440 too. Locking those is a desktop
 *     behaviour change, and writing their `scrollTop` back on close fights the
 *     browser's scroll anchoring after a poll tick inserts a post. At >= 640px
 *     the phone tier is `display: none`, so scoping the walk to it makes the
 *     desktop path reduce to exactly the body lock it always was.
 *
 * ⚠ `document.body` IS STILL LOCKED, UNSCOPED AND FIRST. Above 640px that is
 * the whole of what this does, and it is unchanged from what it replaced.
 *
 * ⚠ THE SCROLL POSITION IS CAPTURED AND RESTORED EXPLICITLY. `overflow: hidden`
 * preserves `scrollTop` in every engine this project targets — but "every engine
 * I checked" is not a contract, and a reader who loses their place in a long
 * feed because they opened the market details would never report it as a bug.
 *
 * ⛔⛔ NESTING IS REFCOUNTED, NOT LIFO — AND THIS DOCBLOCK CLAIMED THE OPPOSITE
 * UNTIL `@test-writer` MEASURED IT.
 *
 * The first version captured per lock and restored per lock, and said it was
 * "nest-safe by construction (each lock captures whatever it found)". That holds
 * under LIFO release and **fails under the other order, which React produces**.
 * Measured in this repo on React 19:
 *
 *   · a parent that stays mounted and renders `null` → `inner unlock, outer
 *     unlock` — LIFO, and the naive version is correct;
 *   · a parent that is itself DELETED → `outer unlock, inner unlock` — and the
 *     naive version then restores the original, and the inner lock immediately
 *     re-applies the `hidden` it had captured from the outer. **Everything is
 *     left locked, `document.body` included.**
 *
 * It is reachable: the price chart opens INSIDE the phone details sheet, the
 * details host is never unmounted once mounted, so the sheet is deleted only
 * when the tier is — i.e. a browser Back or an iOS left-edge swipe with the
 * chart open, on a surface whose whole idiom is swiping. `document.body`
 * survives a soft navigation, so the reader lands on Discovery — which IS
 * document-scrolled — unable to scroll for the rest of the session, with nothing
 * logged.
 *
 * ⇒ So the state is module-level and refcounted: the FIRST lock captures and
 * applies, every later lock only increments, and whichever release happens to
 * run last restores. Order cannot matter because only one capture exists.
 * ⚠ The consequence to know: a nested lock does NOT add its own containers. In
 * this tree the inner layer is always inside the outer one, so there is nothing
 * for it to add — and a nested lock whose subtree is NOT inside its parent's
 * would need a different shape. Said here rather than discovered later.
 */

/**
 * ⛔ MODULE-LEVEL, AND THAT IS THE FIX FOR THE NESTING DEFECT ABOVE. One capture
 * exists at a time; the refcount decides when it is taken and when it is put
 * back, so no release order can leave the page locked.
 */
let depth = 0;
let held: {
	bodyOverflow: string;
	containers: { el: HTMLElement; overflow: string; top: number }[];
} | null = null;

/** Vertical scroll containers inside `root`, excluding anything in `except`. */
function liveScrollContainers(
	root: Element,
	except: Element | null,
): HTMLElement[] {
	const out: HTMLElement[] = [];
	for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
		// ⚠ The cheap geometry test runs FIRST, so `getComputedStyle` — the
		// expensive read — is reached only by the handful of boxes that genuinely
		// overflow. On a 2 587px feed that is a few, not the ~1 200 nodes walked.
		if (el.scrollHeight <= el.clientHeight + 1) {
			continue;
		}
		if (except !== null && except.contains(el)) {
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
 * Lock the page, and the phone tier's scroll containers. Returns the restore.
 *
 * @param except - the caller's own layer. Everything inside it is left alone,
 *   because a modal's own body is the one scroller that must keep working.
 *
 * ⛔ THE RESTORE IS THE RETURN VALUE, NOT A SECOND EXPORTED FUNCTION. A
 * `lock()`/`unlock()` pair has to re-derive what it locked, and the set it finds
 * on the way out is not guaranteed to be the set it found on the way in — a
 * sheet can change the layout underneath it. A closure over the captured list
 * cannot get that wrong, and it makes nesting correct for free.
 */
export function lockPageScroll(except: Element | null = null): () => void {
	if (depth === 0) {
		const tier = document.querySelector('[data-testid="phone-debate-view"]');
		held = {
			bodyOverflow: document.body.style.overflow,
			containers:
				tier === null
					? []
					: liveScrollContainers(tier, except).map((el) => ({
							el,
							overflow: el.style.overflowY,
							// ⚠ CAPTURED BEFORE ANYTHING IS HIDDEN. Reading the position
							// after the overflow is hidden reads whatever the engine
							// clamped it to, and the restore then puts the reader
							// somewhere they never were.
							top: el.scrollTop,
						})),
		};
		document.body.style.overflow = "hidden";
		for (const c of held.containers) {
			c.el.style.overflowY = "hidden";
		}
	}
	depth += 1;

	let released = false;
	return () => {
		// ⚠ IDEMPOTENT. React can run a cleanup twice under StrictMode, and a
		// double decrement would restore while a lock is still held.
		if (released) {
			return;
		}
		released = true;
		depth -= 1;
		if (depth > 0 || held === null) {
			return;
		}
		document.body.style.overflow = held.bodyOverflow;
		for (const c of held.containers) {
			c.el.style.overflowY = c.overflow;
			// ⚠ ASSIGNED BACK UNCONDITIONALLY, not only when it differs. Reading
			// `scrollTop` to decide whether to write it is a read of the value the
			// write exists to guarantee.
			c.el.scrollTop = c.top;
		}
		held = null;
	};
}
