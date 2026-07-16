/**
 * Chessboard row 2 — the digits-only freeze countdown cells (values-log
 * R-2/§3 item 5). Presentational: `BrandCluster` owns the timer (the leg-2
 * a11y ruling put the ticking label on the link, so the one tick lives at
 * that boundary) and hands the display string down; this row just maps it
 * to cells.
 *
 * Cell count tracks the string (ratified OQ-8): 9 cells while days > 99,
 * 8 after (~Jul 29); chessboard parity continues row 1 (its col 0 is dark,
 * so row 2 col 0 is light) and alternation is preserved at either count.
 * These cells are header CHROME (ratified R-4) — the #FAFAFA fills carry no
 * side meaning (WI-1 pole law: nothing here binds bg-yes/bg-no).
 */
export function CountdownDigits({ display }: { display: string }) {
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
