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
 *
 * ⛔ `scale` IS A CELL METRIC, NOT A THEME, AND THE PHONE SCALE EXISTS BECAUSE
 * THE ROW IT JOINS IS 312px WIDE (ADR-0051 A13 D-2/D-4). The `header` scale is
 * the shipped 20×20 cell at 13px, unchanged in every respect — it is what the
 * chessboard's row 1 (`Wordmark scale="header"`) is dimensioned against, so a
 * change here silently breaks the 2×8 rect that the `-mt-px` below exists to
 * close. The `phone` scale is a SEPARATE mount below 640 with no wordmark above
 * it, so its cells answer only to the ladder in A13 D-4 and to nothing this
 * component shares with the desktop.
 *
 * ⚠ THE PHONE SCALE'S TOKENS ARE DELIBERATELY UNPREFIXED, AND THAT IS NOT A
 * BREACH OF AGENTS.md §8. "Override, never replace" governs a class added
 * ALONGSIDE a desktop one on the same node; these land on a node that only ever
 * exists inside `BrandCluster`'s `hidden max-mobile:flex` wrapper, so above 640
 * they are attached to `display:none` and contribute no geometry and no paint.
 * The gate is the wrapper's, exactly as `GitHubIconControl` did it before A13
 * retired it.
 */
export function CountdownDigits({
	display,
	scale = "header",
}: {
	display: string;
	/**
	 * `header` — the 2×8 chessboard's row 2, dimensioned with `Wordmark`'s
	 * `header` scale above it. `phone` — the A13 D-2 standalone mount, digits
	 * only, sized by the A13 D-4 fit ladder.
	 */
	scale?: "header" | "phone";
}) {
	const cell =
		scale === "phone"
			? "flex h-[17px] w-[13px] items-center justify-center font-mono text-[9.5px] leading-none font-bold"
			: "flex size-5 items-center justify-center font-mono text-[13px] font-bold";
	return (
		// -mt-px collapses the two row borders into the single outer hairline
		// (the ratified 2×8 rect once the counts match at days < 100). The phone
		// mount has no row above it, so it takes the hairline alone.
		<span
			className={
				scale === "phone"
					? "flex [border:var(--hairline)]"
					: "-mt-px flex [border:var(--hairline)]"
			}
		>
			{display.split("").map((char, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: cells are positional by design — the chessboard slot, not the glyph, is the identity.
					key={i}
					className={
						i % 2 === 1 ? `${cell} bg-n0 text-ink` : `${cell} bg-ink text-n0`
					}
				>
					{char}
				</span>
			))}
		</span>
	);
}
