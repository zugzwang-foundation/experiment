"use client";

import { useState } from "react";

import type { ProfileGraphSeries } from "@/server/profile/graph-series";

import { ProfileGraphCard } from "./ProfileGraphCard";
import { ProfileGraphOverlay } from "./ProfileGraphOverlay";

/** The Dharma-graph host — the collapsed placeholder card with a STATE-TOGGLE
 * fullscreen overlay (not a route, §1d/W2.6). The overlay is absent from the
 * DOM until the card is clicked. */
export function ProfileGraph({
	series,
}: {
	series: ProfileGraphSeries;
}): React.JSX.Element {
	const [open, setOpen] = useState(false);

	return (
		<>
			<ProfileGraphCard series={series} onExpand={() => setOpen(true)} />
			{open && (
				<ProfileGraphOverlay series={series} onClose={() => setOpen(false)} />
			)}
		</>
	);
}
