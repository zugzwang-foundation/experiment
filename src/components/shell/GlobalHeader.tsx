import { FREEZE_INSTANT_UTC } from "@/server/markets/create";

import { BrandCluster } from "./BrandCluster";
import { formatCountdown } from "./countdown-format";
import { HeaderNav } from "./HeaderNav";
import { type HeaderViewer, IdentityCluster } from "./IdentityCluster";
import { RadioSlot } from "./RadioSlot";
import { VisitorCounter } from "./VisitorCounter";

/**
 * The branded global header (UI.A1 — W2.4/.5/.14 mockup v0_2 structure on
 * the BRIDGE token layer; values-log v0_3 supersessions applied: brand
 * chessboard cluster, digits-only countdown, 34px control register). Server
 * component; mounted by the shell layouts (the `(public)` swap + the
 * ratified-additive `(auth)` layout land at §9 slice 5), which pass the
 * server-decided viewer — no client auth state.
 *
 * 60px band on the values-log `--bar-block` register (a design register,
 * not a repo token — component-local literal by design; zero globals.css
 * edits): bg-n0, top+bottom hairline, tier-1 elevation ("the top bar" is
 * tier 1), 3-zone `1fr auto 1fr` grid — equal side tracks keep the brand
 * cluster absolutely centred — fixed desktop max-width 1440 / 24px side
 * padding, no responsive breakpoints (design-language §1.7).
 *
 * Left zone order Back · Home · Radio (mockup v0_2); Social/Research/RULES/
 * Đ-info are ratified omissions (OQ-3/OQ-4 zero-supplied), each a named
 * deviation in the plan. Right zone = JOIN or the identity chip, then a
 * hairline divider + the visitor counter at the far right (UI.13; SPEC.1
 * §21.1); OQ-2 defers the Đ cluster.
 *
 * Countdown (F2): the target is the BUILT `FREEZE_INSTANT_UTC` pin —
 * imported read-only from the markets service (never a duplicate constant)
 * — with the initial display computed here at request time so the client
 * leaf hydrates onto identical markup.
 */
export function GlobalHeader({ viewer }: { viewer: HeaderViewer | null }) {
	const targetMs = FREEZE_INSTANT_UTC.getTime();
	const initialDisplay = formatCountdown(Date.now(), targetMs);

	return (
		<header className="border-y bg-n0 shadow-(--elev-1)">
			<div className="mx-auto grid h-[60px] w-full max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center gap-[18px] px-6">
				<div className="flex items-center gap-2 justify-self-start">
					<HeaderNav />
					<RadioSlot />
				</div>
				<div className="justify-self-center">
					<BrandCluster targetMs={targetMs} initialDisplay={initialDisplay} />
				</div>
				<div className="flex items-center justify-self-end">
					<IdentityCluster viewer={viewer} />
					<span aria-hidden="true" className="mx-3 h-5 w-px bg-n2" />
					<VisitorCounter />
				</div>
			</div>
		</header>
	);
}
