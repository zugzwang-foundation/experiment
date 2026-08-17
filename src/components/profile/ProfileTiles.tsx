import {
	displayNetProfitLossSigned,
	formatDharma,
} from "@/components/debate/format";
import { Card } from "@/components/ui/card";
import type { ProfileTiles as ProfileTilesData } from "@/server/profile/tiles";

/**
 * The six §23 account tiles (canon §2/§6, 3×2). All values are server-computed
 * strings; every Đ figure renders at 0 dp via `formatDharma` (DROUND / SPEC.1
 * §10.8), and the Net P/L tile is derived in DISPLAYED space by
 * `displayNetProfitLossSigned` so the tile identity holds on screen AND the
 * figure carries its sign before the glyph — exact decimal, never a JS float
 * (CLAUDE.md §2). The Arguments tile renders the count as
 * `N (P Posts | R Replies)` (N-7). Labels are canon §6 verbatim.
 */
export function ProfileTiles({
	tiles,
}: {
	tiles: ProfileTilesData;
}): React.JSX.Element {
	// Item 1 — the sign is resolved ONCE, in decimal space, by the formatter. It
	// is bound here rather than called inline because the tile interpolates the
	// two halves either side of the Đ glyph.
	const netProfitLoss = displayNetProfitLossSigned(
		tiles.walletValue,
		tiles.positionsValue,
		tiles.netProfitLoss,
	);
	return (
		<div
			data-testid="profile-tiles"
			// HTML-FINISH row 18 — THE TWO TILE ROWS SHARE ONE HEIGHT. The mockup's
			// `.tiles` is `grid-auto-rows:1fr` (`:204`), i.e. every implicit row is
			// an equal fraction of the track, so a two-line value can never make its
			// row taller than the other five tiles' row. `auto-rows-fr` is that
			// declaration, not a number — no height is invented and none is read off
			// the mockup. Before this each row sized to its own tallest tile, so the
			// Arguments tile's breakdown (row 19 below) dragged the top row down.
			// ⚠⚠ PROFILE-FULL — `gap-[10px]`, the mockup's `.tiles{gap:10px}`
			// (`:204`), replacing `gap-3` (12px). Two gaps across two rows and two
			// columns, so it is 2px of band height and 4px of column width — small on
			// its own, and part of the arithmetic that brought the band to the
			// mockup's 188 (see `IdentityCard.tsx`'s D-1 block for the table).
			className="grid auto-rows-fr grid-cols-2 gap-[10px] sm:grid-cols-3"
		>
			{/* FOUNDER EYE PASS item 1 — Đ ON EVERY Đ VALUE. The mockup's tiles read
			    `Đ 2,430` / `Đ 2,668` / `Đ 8,640` / `Đ 5,210` (`:440-445`); the build
			    printed bare digits, so a wallet balance and a reply count looked
			    like the same kind of number.
			    ⛔ THE GLYPH IS BYTE-CARRIED, NOT TYPED — `c4 90`, U+0110 LATIN
			    CAPITAL LETTER D WITH STROKE. Hexdump of `ArgumentList.tsx`'s shipped
			    `Đ {formatDharma(…)}` and of mockup `:440` both give `c4 90 20`,
			    identical, and this reuses the shipped spacing too.
			    ⛔ NO FORMATTER IS AUTHORED: `formatDharma` is untouched and still
			    wraps every value, so `no-raw-dharma-render` holds unchanged.
			    ⚠ THE ARGUMENTS TILE TAKES NO Đ — it is a COUNT, the mockup gives it
			    none (`:443`), and SPEC.1 §23 pins its string as
			    `N (P Posts | R Replies)`. */}
			<Tile testid="tile-wallet" label="Wallet value">
				Đ {formatDharma(tiles.walletValue)}
			</Tile>
			<Tile testid="tile-positions" label="Positions value">
				Đ {formatDharma(tiles.positionsValue)}
			</Tile>
			{/* ⚠⚠ ROUND 4 item 1 — NET P/L JOINS THE OTHER FOUR, and the block that
			    stood here is DISCHARGED, not forgotten. Round 3 shipped Đ on four
			    tiles and left this one bare beside them; the cause was route (a) —
			    `debate/format.ts` was READ ONLY — and round 4's allow-list opens
			    that file for exactly one addition. `displayNetProfitLossSigned`
			    (`debate/format.ts`) is that addition: it returns the SAME
			    displayed-space figure as `displayNetProfitLoss`, split into sign +
			    magnitude, so the tile can render sign → glyph → number.
			    ⛔ ROUTE (b) IS STILL CLOSED AND STILL NOT TAKEN. The sign is
			    `Decimal.isNegative()` on the numeric identity INSIDE the formatter —
			    the displayed string is never read back (SPEC.1 §10.8: "a displayed
			    figure … is never read back into arithmetic, comparison, validation,
			    clamping, or CONDITIONAL RENDERING"). Nothing in this file inspects a
			    rendered figure; it interpolates two values the formatter handed it.
			    ⛔ THE GLYPH IS THE SAME BYTE-CARRY AS THE OTHER FOUR — `c4 90`,
			    U+0110 — and the SPACING is the shipped `Đ {…}` form, so the five Đ
			    tiles are byte-identical in their prefix. Only the sign is new, and
			    the MINUS is U+2212 (`e2 88 92`), byte-carried from the mockup's
			    `pl()` (`:672`), never the ASCII hyphen the plain variant emits. */}
			<Tile testid="tile-net-pl" label="Net profit / loss">
				{netProfitLoss.sign}Đ {netProfitLoss.magnitude}
			</Tile>
			{/* HTML-FINISH row 19 — THE BREAKDOWN GETS ITS OWN ELEMENT. The mockup's
			    value node is `<div class="tv">5<span class="tsub">(3 Posts | 2
			    Replies)</span></div>` (`:443`, rule at `:210`) — a count with the
			    parenthesised breakdown NESTED inside it, not one flat string.
			    ⛔ THE RENDERED STRING IS UNCHANGED, and that is load-bearing: SPEC.1
			    §23 pins `N (P Posts | R Replies)` and `surface.test.tsx:343` asserts
			    the testid node's textContent EXACTLY. The testid therefore stays on
			    the OUTER span, whose textContent still concatenates to the same
			    bytes; only the markup gains a seam. The separating space stays in
			    the TEXT (`{" "}`) rather than becoming a margin, because a margin is
			    a value and would also drop the space from every textContent read. */}
			{/* ⚠⚠ PROFILE-FULL — THE BREAKDOWN TAKES `.tsub`'s OWN TYPE, and it was
			    the tallest tile in the grid until it did. The mockup's `.tsub` is
			    `font-size:10px; font-weight:700; color:n4` (`:210-211`); this
			    inherited the value span's 14px, so `(6 Posts | 1 Replies)` wrapped
			    the VALUE line to two lines, and `auto-rows-fr` then handed that extra
			    height to all six tiles. MEASURED: with every other tile at 62 this
			    one was 70, and the grid was 70 — dropping it to 10px took the grid to
			    the 62 the other five wanted.
			    ⛔ THE RENDERED STRING IS UNCHANGED, which is load-bearing: SPEC.1 §23
			    pins `N (P Posts | R Replies)` and `surface.test.tsx:343` asserts this
			    subtree's textContent EXACTLY. Only classes are added.
			    ⛔ AND THE MOCKUP'S `margin-left:7px` IS DELIBERATELY NOT TAKEN. The
			    separator here is a real SPACE in the text (`{" "}`), kept because a
			    margin would drop it from every `textContent` read — so adding 7px on
			    top of it would double the gap, not match it. */}
			<Tile testid="tile-arguments" label="Arguments">
				<span data-testid="tile-arguments-value">
					{tiles.argumentsCount.total}{" "}
					<span
						data-testid="tile-arguments-breakdown"
						className="text-[10px] leading-normal font-bold text-n4"
					>
						({tiles.argumentsCount.posts} Posts | {tiles.argumentsCount.replies}{" "}
						Replies)
					</span>
				</span>
			</Tile>
			<Tile testid="tile-support" label="Total Support received">
				Đ {formatDharma(tiles.supportReceived)}
			</Tile>
			<Tile testid="tile-counter" label="Total Counter received">
				Đ {formatDharma(tiles.counterReceived)}
			</Tile>
		</div>
	);
}

function Tile({
	testid,
	label,
	children,
}: {
	testid: string;
	label: string;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		// HTML-FINISH row 15 — VALUE ABOVE LABEL. The mockup's `.tile` renders
		// `.tv` then `.tl` (`:440-445`, rules at `:207-209`); the build had the
		// label first. A pure sibling swap: both spans keep their own class
		// strings byte-for-byte, so no type size, weight or colour moves.
		// `justify-center` is the mockup's `.tile{justify-content:center}` (`:206`)
		// — composition, and it is what keeps a one-line tile optically centred now
		// that row 18 has given every tile the same (taller) row height.
		// ⚠⚠ PROFILE-FULL — THE TILE TAKES THE MOCKUP'S DENSITY, and this is the
		// row three earlier rounds could not take because TYPE SIZE was outside
		// their fence. §1 now puts it explicitly in scope, and it is the mechanism
		// D-1 turned on: at `text-xs` the label wrapped to a second line at every
		// tile width ≤158px, taking each tile 66→86 and the block 144→184.
		//
		//   .tile   padding:9px 13px            (`:205`)  →  px-[13px] py-[9px]
		//   .tv     font-size:14px; weight:800  (`:207`)  →  text-[14px] font-extrabold
		//   .tl     margin-top:3px              (`:209`)  →  gap-[3px] on the tile
		//   .tl     8px/800/.12em/uppercase/n4  (`:208`)  →  text-[8px] … tracking-[0.12em]
		//
		// ⛔ `leading-normal` ON BOTH SPANS IS LOAD-BEARING, NOT TIDINESS. Every
		// Tailwind `text-*` step ships a PAIRED line-height, and the arbitrary
		// `text-[Npx]` form does NOT reset it — so `text-[8px]` inherited
		// `text-xs`'s 16px leading and `text-[14px]` inherited `text-sm`'s 20px.
		// MEASURED: with the font sizes taken but the leading left alone the block
		// still needed 190 against the 188 box; setting both to the mockup's own
		// unset `normal` brought it to 174. The font sizes alone do not close it.
		// ⚠ `text-[8px]` is the mockup's literal for THIS label. The neighbouring
		// micro-label register in this repo is `text-[8.5px]` (`DharmaCluster.tsx`,
		// `MarketCard.tsx`, `HeroPanels.tsx`) and the mockup's own column headers
		// are 8.5px — both are the same arbitrary-value idiom, so no token is
		// minted and none is needed; the 0.5px split is the mockup's, kept.
		<Card
			data-testid={testid}
			className="justify-center gap-[3px] px-[13px] py-[9px]"
		>
			<span className="text-[14px] leading-normal font-extrabold text-ink tabular-nums">
				{children}
			</span>
			<span className="text-[8px] leading-normal font-extrabold tracking-[0.12em] text-n4 uppercase">
				{label}
			</span>
		</Card>
	);
}
