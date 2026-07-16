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
	children,
}: {
	side: Side;
	pricing: { yes: string; no: string } | null;
	children: ReactNode;
}) {
	const pct = pricing
		? formatPercent(side === "YES" ? pricing.yes : pricing.no)
		: "—";
	return (
		<div className="flex flex-1 flex-col gap-3">
			<div className="flex items-center justify-between gap-2 rounded-md p-2 [border:var(--hairline)]">
				<div className="flex items-center gap-1.5">
					<SideBadge side={side} />
					<span className="font-mono text-xs text-muted-foreground">{pct}</span>
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
			{children}
		</div>
	);
}
