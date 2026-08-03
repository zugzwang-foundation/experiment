"use client";

import { ArrowLeft, House } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Left-zone nav pair — Back (leftmost, the v0.2 swap) then Home. 34×34
 * header icon buttons per the values-log register (§3 item 3): rest
 * --btn-fill + hairline, hover border → --ring (fill unchanged), pressed
 * --state-pressed-fill, focus the 2px light ring, icon 15px ink.
 *
 * Back disables when there is no in-app history (fresh tab / deep-link) —
 * default-disabled until mount, then the `history.length` heuristic. The
 * heuristic counts cross-origin entries too, so an enabled Back can exit
 * the app: accepted-known at A1 (plan §5); the W2.3 history-stack contract
 * matures as more surfaces land (A4+).
 *
 * ROOT IS GATED UNCONDITIONALLY (POLISH-1a V5). When `/` is the entry point —
 * the common case, since `/` is where the app starts — every entry below it is
 * cross-origin, so an enabled Back walks OFF-SITE. The depth heuristic cannot
 * tell that apart from the `/` → market → Home loop, where the entry below IS
 * in-app; so gating `/` unconditionally does cost a usable Back in that second
 * flow. Accepted deliberately: leaving the app by accident is the worse
 * failure, and the W2.3 history-stack contract is where the two get told apart
 * properly.
 *
 * THE PROBE RE-RUNS ON EVERY ROUTE CHANGE (Gate C). It was mount-only, and
 * `HeaderNav` lives in `(public)/layout.tsx`, which SURVIVES soft navigation —
 * so `hasHistory` froze for the whole session. A viewer arriving DIRECTLY at
 * `/` (typed URL or bookmark — the staging-test and demo path) started at
 * `history.length === 1`, and Back then stayed dead on every subsequent route
 * however deep the stack got, which made V5's stated behaviour false in a
 * common case. `[pathname]` deps fix it: the depth is re-read wherever the
 * route lands.
 *
 * The two terms still answer different questions — "is there anywhere to go?"
 * (the probe) vs "is this the root?" (the pathname term, evaluated at RENDER,
 * so the root gate never waits on an effect).
 *
 * Home carries `aria-current` at `/` — live since UI.A4 put Discovery on `/`
 * inside this shell (it was moot at A1, when no header rendered there).
 */
const ICON_BUTTON =
	"inline-flex size-[34px] shrink-0 items-center justify-center rounded-(--r) bg-(--btn-fill) text-ink outline-none select-none [border:var(--hairline)] [transition:all_var(--dur-hover)] hover:[border:1px_solid_var(--ring)] active:bg-(--state-pressed-fill) focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity) [&_svg]:size-[15px]";

export function HeaderNav() {
	const router = useRouter();
	const pathname = usePathname();
	const [hasHistory, setHasHistory] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname is a re-run TRIGGER, not a read. HeaderNav survives soft nav, so [] freezes history.length at first mount — a user landing directly on / gets Back dead for the whole session. Do not remove.
	useEffect(() => {
		setHasHistory(window.history.length > 1);
	}, [pathname]);

	const canGoBack = pathname !== "/" && hasHistory;

	return (
		<>
			<button
				type="button"
				disabled={!canGoBack}
				aria-disabled={!canGoBack}
				aria-label="Back"
				title="Back"
				onClick={() => router.back()}
				className={ICON_BUTTON}
			>
				<ArrowLeft aria-hidden="true" />
			</button>
			<Link
				href="/"
				aria-label="Home"
				title="Home"
				aria-current={pathname === "/" ? "page" : undefined}
				className={ICON_BUTTON}
			>
				<House aria-hidden="true" />
			</Link>
		</>
	);
}
