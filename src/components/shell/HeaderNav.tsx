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
 * matures as more surfaces land (A4+). Home carries `aria-current` at `/`
 * — moot at A1 (no header renders on `/`), kept for A4.
 */
const ICON_BUTTON =
	"inline-flex size-[34px] shrink-0 items-center justify-center rounded-(--r) bg-(--btn-fill) text-ink transition-all outline-none select-none [border:var(--hairline)] hover:[border:1px_solid_var(--ring)] active:bg-(--state-pressed-fill) focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity) [&_svg]:size-[15px]";

export function HeaderNav() {
	const router = useRouter();
	const pathname = usePathname();
	const [canGoBack, setCanGoBack] = useState(false);

	useEffect(() => {
		setCanGoBack(window.history.length > 1);
	}, []);

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
