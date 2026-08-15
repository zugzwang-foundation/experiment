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
			{/* ⛔⛔ NET P/L TAKES NO Đ AND NO `+` — BLOCKED, NOT OVERLOOKED, and it
			    is the one tile the founder named explicitly ("Net P/L carries its
			    sign, `+Đ 238` / `−Đ n`").
			    THE SHIPPED FORMATTER EMITS NEITHER. `displayNetProfitLoss`
			    (`debate/format.ts:142-165`) returns `groupInteger(...)` — digits with
			    a leading ASCII `-` for negatives (`format.ts:72`) and NO sign for
			    positives. Reaching the founder's form needs the sign BEFORE the Đ,
			    and there are exactly two routes to it:
			      (a) teach `format.ts` a signed variant — but
			          `src/components/debate/**` is READ ONLY this round; or
			      (b) inspect the returned string (`startsWith("-")`, or test for a
			          leading `+`) and re-assemble around it — which is reading a
			          DISPLAYED figure back into conditional rendering, and SPEC.1
			          §10.8 forbids exactly that by name: "Rounded values are
			          terminal: a displayed figure is a string, and is never read
			          back into arithmetic, comparison, validation, clamping, or
			          CONDITIONAL RENDERING."
			    ⛔ A BARE `Đ ` PREFIX IS NOT SHIPPED AS A CONSOLATION: it would print
			    `Đ -30`, which is worse than today's `-30` — the sign lands on the
			    wrong side of the glyph and the tile stops matching the other four.
			    ⇒ The tile is LEFT EXACTLY AS IT SHIPPED and the block is reported.
			    Route (a) is one line the moment `format.ts` is writable. */}
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
		<Card data-testid={testid} className="justify-center gap-1 p-3">
			<span className="font-medium text-ink tabular-nums">{children}</span>
			<span className="text-xs text-n5">{label}</span>
		</Card>
	);
}
