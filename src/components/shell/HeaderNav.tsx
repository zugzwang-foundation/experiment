"use client";

import { House } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { HEADER_ICON_BUTTON } from "./header-control";

/**
 * Left-zone nav — Home, the zone's first item. 34×34 header icon button per the
 * values-log register (§3 item 3): rest --btn-fill + hairline, hover border →
 * --ring (fill unchanged), pressed --state-pressed-fill, focus the 2px light
 * ring, icon 15px ink.
 *
 * ⛔ UIR-1 item 5 — BACK IS GONE AT EVERY WIDTH. It was the pair's first
 * control (`←`, `router.back()` behind a `history.length` probe); below 640px
 * ADR-0051 A9 D-3 had already stopped rendering it, and UIR-1 withdraws it at
 * 640px and up, so Home moves into its slot and the controls after Home close
 * up by its 34px and the zone's 8px gap. The probe, the root gate and the
 * cross-origin caveats this docblock carried existed only for Back and left
 * with it. The way to a page's parent is the page's own link now — the replies
 * page's `FocusMarketCard` (`Back to the market`), `/sign-in/otp`'s link to
 * `/sign-in` — and Home everywhere.
 *
 * Home carries `aria-current` at `/` — live since UI.A4 put Discovery on `/`
 * inside this shell (it was moot at A1, when no header rendered there).
 */
/**
 * ⚠ MOBILE-2n · R-5 — THE REGISTER MOVED OUT OF THIS FILE AND THE ALIAS STAYS.
 * `header-control.ts` now owns the string, because the phone's GitHub control
 * wore the same box and "the same box" has to be one literal to stay true. The
 * local name is kept so the call site below takes zero diff — the value is
 * byte-identical, which is what keeps Home unmoved at 1440.
 */
const ICON_BUTTON = HEADER_ICON_BUTTON;

export function HeaderNav(_props: {
	/**
	 * ⚠ INERT SINCE UIR-1 item 5. It gated Back's `max-mobile:hidden` (ADR-0051
	 * A9 D-3); with Back gone there is nothing left here to gate. It stays in the
	 * signature so `GlobalHeader`'s prop chain, and every caller, is unchanged.
	 */
	mobileResponsive?: boolean;
}) {
	const pathname = usePathname();

	return (
		<Link
			href="/"
			aria-label="Home"
			title="Home"
			aria-current={pathname === "/" ? "page" : undefined}
			className={ICON_BUTTON}
		>
			<House aria-hidden="true" />
		</Link>
	);
}
