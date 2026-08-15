import { displayNetProfitLoss, formatDharma } from "@/components/debate/format";
import { Card } from "@/components/ui/card";
import type { ProfileTiles as ProfileTilesData } from "@/server/profile/tiles";

/**
 * The six §23 account tiles (canon §2/§6, 3×2). All values are server-computed
 * strings; every Đ figure renders at 0 dp via `formatDharma` (DROUND / SPEC.1
 * §10.8), and the Net P/L tile is derived in DISPLAYED space by
 * `displayNetProfitLoss` so the tile identity holds on screen — exact decimal,
 * never a JS float (CLAUDE.md §2). The Arguments tile renders the count as
 * `N (P Posts | R Replies)` (N-7). Labels are canon §6 verbatim.
 */
export function ProfileTiles({
	tiles,
}: {
	tiles: ProfileTilesData;
}): React.JSX.Element {
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
			className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3"
		>
			<Tile testid="tile-wallet" label="Wallet value">
				{formatDharma(tiles.walletValue)}
			</Tile>
			<Tile testid="tile-positions" label="Positions value">
				{formatDharma(tiles.positionsValue)}
			</Tile>
			<Tile testid="tile-net-pl" label="Net profit / loss">
				{displayNetProfitLoss(
					tiles.walletValue,
					tiles.positionsValue,
					tiles.netProfitLoss,
				)}
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
			<Tile testid="tile-arguments" label="Arguments">
				<span data-testid="tile-arguments-value">
					{tiles.argumentsCount.total}{" "}
					<span data-testid="tile-arguments-breakdown">
						({tiles.argumentsCount.posts} Posts | {tiles.argumentsCount.replies}{" "}
						Replies)
					</span>
				</span>
			</Tile>
			<Tile testid="tile-support" label="Total Support received">
				{formatDharma(tiles.supportReceived)}
			</Tile>
			<Tile testid="tile-counter" label="Total Counter received">
				{formatDharma(tiles.counterReceived)}
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
		<Card data-testid={testid} className="justify-center gap-1 p-3">
			<span className="font-medium text-ink tabular-nums">{children}</span>
			<span className="text-xs text-n5">{label}</span>
		</Card>
	);
}
