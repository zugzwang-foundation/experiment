import { formatDharma } from "@/components/debate/format";
import { Card } from "@/components/ui/card";
import type { ProfileTiles as ProfileTilesData } from "@/server/profile/tiles";

/**
 * The six §23 account tiles (canon §2/§6, 3×2). All values are server-computed
 * strings — `formatDharma` only trims trailing scale zeros for display, never
 * float arithmetic (CLAUDE.md §2). The Arguments tile renders the count as
 * `N (P Posts | R Replies)` (N-7). Labels are canon §6 verbatim.
 */
export function ProfileTiles({
	tiles,
}: {
	tiles: ProfileTilesData;
}): React.JSX.Element {
	const argumentsValue = `${tiles.argumentsCount.total} (${tiles.argumentsCount.posts} Posts | ${tiles.argumentsCount.replies} Replies)`;

	return (
		<div
			data-testid="profile-tiles"
			className="grid grid-cols-2 gap-3 sm:grid-cols-3"
		>
			<Tile testid="tile-wallet" label="Wallet value">
				{formatDharma(tiles.walletValue)}
			</Tile>
			<Tile testid="tile-positions" label="Positions value">
				{formatDharma(tiles.positionsValue)}
			</Tile>
			<Tile testid="tile-net-pl" label="Net profit / loss">
				{formatDharma(tiles.netProfitLoss)}
			</Tile>
			<Tile testid="tile-arguments" label="Arguments">
				<span data-testid="tile-arguments-value">{argumentsValue}</span>
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
		<Card data-testid={testid} className="gap-1 p-3">
			<span className="text-xs text-n5">{label}</span>
			<span className="font-medium text-ink tabular-nums">{children}</span>
		</Card>
	);
}
