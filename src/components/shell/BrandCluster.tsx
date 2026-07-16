"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CountdownDigits } from "./CountdownDigits";
import { formatCountdown } from "./countdown-format";

/**
 * The centre brand cluster (values-log §3 item 5, superseding the mockup's
 * wordmark + `45d : 06h : 15m` format — R-2/R-3): the 48×48 mark, a 10px
 * gap, then the 2×8 chessboard — row 1 `Z U G Z W A N G` (Geist 13/800,
 * always 8 cells), row 2 the digits-only countdown (row cell count per the
 * ratified OQ-8 rule — 9 cells until days < 100, ~Jul 29; centre-aligned
 * lockup, transient width mismatch accepted and screenshotted for review).
 * Fills alternate n0/ink in chessboard parity, top-left dark, text inverts
 * per cell; outer hairline, no internal borders. The whole cluster is ONE
 * link target → `/`. The #FAFAFA cells are ratified header-only CHROME
 * (R-4) — they carry no side meaning and bind no pole token (WI-1 law).
 *
 * Client boundary (leg-2 a11y ruling): the link carries the RULED
 * remaining-time label — `Zugzwang — home. ${D} days ${H} hours ${M}
 * minutes until market freeze.` — with values from the SAME formatter as
 * the visible digits, updating silently with the minute tick (a ticking
 * attribute cannot live on server markup, so this component owns the one
 * timer and hands the display string to the presentational cell row). The
 * grid itself stays aria-hidden; NO aria-live anywhere. The RSC-seeded
 * `initialDisplay` keeps server and client markup identical (no hydration
 * mismatch); the post-mount tick recomputes immediately, then every second
 * — the string (and so the re-render) changes only at minute boundaries.
 */
const LETTERS = ["Z", "U", "G", "Z", "W", "A", "N", "G"] as const;

function freezeLabel(display: string): string {
	const [days, hours, minutes] = display.split(":");
	return `Zugzwang — home. ${days} days ${hours} hours ${minutes} minutes until market freeze.`;
}

export function BrandCluster({
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
		<Link
			href="/"
			aria-label={freezeLabel(display)}
			className="flex items-center gap-2.5 outline-none focus-visible:shadow-(--state-focus-ring)"
		>
			{/* biome-ignore lint/performance/noImgElement: static 48px brand svg — next/image's optimizer refuses svg by default and buys nothing here. */}
			<img
				src="/brand/zugzwang-mark.svg"
				alt=""
				width={48}
				height={48}
				className="size-12"
			/>
			<span aria-hidden="true" className="flex flex-col items-center">
				<span className="flex [border:var(--hairline)]">
					{LETTERS.map((letter, i) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed 8-letter row — positional cells.
							key={i}
							className={
								i % 2 === 0
									? "flex size-5 items-center justify-center bg-n0 font-sans text-[13px] font-extrabold text-ink"
									: "flex size-5 items-center justify-center bg-ink font-sans text-[13px] font-extrabold text-n0"
							}
						>
							{letter}
						</span>
					))}
				</span>
				<CountdownDigits display={display} />
			</span>
		</Link>
	);
}
