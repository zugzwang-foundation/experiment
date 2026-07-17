import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { SideBadge } from "./badges";
import { formatPercent } from "./format";
import type { Side } from "./types";

/**
 * One pole column of the two-column arena (DEBATE.4 §4 / D3) — LEFT=YES,
 * RIGHT=NO, the fixed side poles (never a Support/Counter label). The column
 * head carries the side's price tag, the DISABLED Đ BET trigger (C1 §7 —
 * present but unwired), and the static "No active position" stub (the viewer/auth-
 * dependent readout is OUT of DEBATE.4). The body hosts the post-scroller
 * (market-view) or reply-scroller (post-view).
 */
export function DebateColumn({
	side,
	pricing,
	header,
	engaged = false,
	children,
}: {
	side: Side;
	pricing: { yes: string; no: string } | null;
	/**
	 * UI.A3 — the rebuilt slot header (market view: `SlotHeader`; post view
	 * keeps the legacy head until the A3 slice-4 strip). When given it fully
	 * replaces the legacy C1 head below.
	 */
	header?: ReactNode;
	/**
	 * Engaged-slot backlight (values-log §1 item 4): glows on the side BEING
	 * BET ON while the composer is open in the opposite slot. rgb-alpha glow —
	 * interaction physics, not elevation (allowed by the no-raw-hex guard).
	 */
	engaged?: boolean;
	children: ReactNode;
}) {
	const pct = pricing
		? formatPercent(side === "YES" ? pricing.yes : pricing.no)
		: "—";
	return (
		<div
			className={`flex flex-1 flex-col gap-3 ${
				engaged
					? "rounded-(--r) shadow-[0_0_10px_1px_rgba(255,255,255,0.2)]"
					: ""
			}`}
		>
			{header ?? (
				<>
					<div className="flex items-center justify-between gap-2 rounded-md p-2 [border:var(--hairline)]">
						<div className="flex items-center gap-1.5">
							<SideBadge side={side} />
							<span className="font-mono text-xs text-muted-foreground">
								{pct}
							</span>
						</div>
						<Button
							variant="outline"
							size="xs"
							disabled
							aria-disabled="true"
							aria-label={`Đ BET ${side} — sign in to bet`}
						>
							Đ BET
						</Button>
					</div>
					<p className="text-xs text-muted-foreground">No active position</p>
				</>
			)}
			{children}
		</div>
	);
}
