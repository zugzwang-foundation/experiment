"use client";

import { useEffect, useState } from "react";

import { formatCountdown } from "./countdown-format";

/**
 * Chessboard row 2 — the digits-only freeze countdown (values-log R-2/§3
 * item 5). Client leaf of the brand cluster: the RSC seeds `initialDisplay`
 * (computed at request time from the same formatter + target), so server and
 * client markup are identical — no placeholder flash, no hydration mismatch
 * (plan §4.8 v2 mechanism). The post-mount tick recomputes immediately (to
 * correct any request→hydrate minute drift), then every second — the string,
 * and so the re-render, changes only at minute boundaries.
 *
 * Cell count tracks the string (ratified OQ-8): 9 cells while days > 99,
 * 8 after (~Jul 29); chessboard parity continues row 1 (its col 0 is dark,
 * so row 2 col 0 is light) and alternation is preserved at either count.
 * These cells are header CHROME (ratified R-4) — the #FAFAFA fills carry no
 * side meaning (WI-1 pole law: nothing here binds bg-yes/bg-no).
 */
export function CountdownDigits({
	targetMs,
	initialDisplay,
}: {
	targetMs: number;
	initialDisplay: string;
}) {
	const [display, setDisplay] = useState(initialDisplay);

	useEffect(() => {
		const tick = () => setDisplay(formatCountdown(Date.now(), targetMs));
		tick();
		const id = setInterval(tick, 1_000);
		return () => clearInterval(id);
	}, [targetMs]);

	return (
		// -mt-px collapses the two row borders into the single outer hairline
		// (the ratified 2×8 rect once the counts match at days < 100).
		<span className="-mt-px flex [border:var(--hairline)]">
			{display.split("").map((char, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: cells are positional by design — the chessboard slot, not the glyph, is the identity.
					key={i}
					className={
						i % 2 === 1
							? "flex size-5 items-center justify-center bg-n0 font-mono text-[13px] font-bold text-ink"
							: "flex size-5 items-center justify-center bg-ink font-mono text-[13px] font-bold text-n0"
					}
				>
					{char}
				</span>
			))}
		</span>
	);
}
