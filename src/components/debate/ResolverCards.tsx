import type { DebateMarketHeader } from "./types";

/**
 * HTML-FINISH · MARKET DETAIL row 3 — the resolver-card slot: `.rescards`
 * (`d5:986`), the last `vm` child of the market arm's `.hstack`, after the
 * resolution criterion. Two cards side by side: the RESOLVER and the
 * X-OFFICIAL account.
 *
 * ⚠⚠ ROUND 2 · R2 REVERSES `OD-2` AND THIS FILE'S OWN RULING. It used to
 * `return null` and said so at length: "⛔⛔ IT RENDERS `null`, AND THAT IS THE
 * ROW — not an unfinished implementation. OD-2, founder-ruled to the plan
 * default … ⛔ RENDERING THE TWO CARD SHELLS WITH EMPTY FIELDS WOULD REPRODUCE
 * `PD-3-09` / `OD-6` EXACTLY." The founder ruling of 2026-08-16 reverses that:
 * VISIBLE PLACEHOLDER CHROME IS REQUIRED, and the two shells ship today.
 *
 * ⛔ THE DATA FIELDS ARE EMPTY, AND THAT IS THE HONEST HALF OF THE REVERSAL.
 * `markets` carries `id · slug · title · description · status ·
 * resolution_deadline · resolved_at · resolution_outcome · media_video_url ·
 * created_by · created_at` and NOTHING ELSE — no resolver name, no logo, no
 * source, no X handle — and this task ships no migration. So the CHROME and the
 * LABELS land and the values do not. ⛔ d5's own `.resname` / `.ressrc` content
 * ("Brihanmumbai Municipal Corporation", "Monthly operational bulletins",
 * "BMC", "@mybmc") is DEMO COPY describing a market this build does not have;
 * shipping it would be inventing market content, which CLAUDE.md §3 refuses
 * outright. The kickoff says the same thing in one line: "empty data fields.
 * ⛔ Author no copy."
 *
 * ⛔ THE LABELS ARE BYTE-CARRIED, hexdumped from the mockup: `LOGO` (`d5:988`),
 * `Resolver` (`:990`), `X` (`:996`), and `X — official` (`:998`, em dash U+2014
 * at bytes `e2 80 94`). Nothing here is authored.
 *
 * ⚠⚠ REVIEW-SURFACE ONLY. Docketed at `docs/parked.md`
 * (`HTML-FINISH-MD-PLACEHOLDERS`): strip or gate all four placeholders before
 * the DP.2 production promote. The `PD-3-09` objection above was not WRONG about
 * what this is — a build-time note about unbuilt work — it is outranked for the
 * review surface and must not survive to a real participant.
 *
 * ⚠ TOKENS AND SHIPPED RECIPES ONLY. d5's `30px` glyph boxes, `6.5px` / `8px` /
 * `12px` / `10px` type, `.12em` / `.14em` tracking and `9px 11px` padding are
 * VALUES and none is taken. The glyph boxes reuse the `bg-n1` + hairline +
 * `--imgr` + `font-mono text-[8.5px] tracking-[0.16em] text-n4` recipe already
 * shipping in `MarketMediaPanel` (byte-carried from `discovery/MarketCard.tsx`),
 * and the overline reuses `MarketHeader`'s own RESOLUTION overline recipe —
 * shipped on this very surface, for the same role. No new type size, colour or
 * radius enters the build.
 */
export function ResolverCards({
	market,
}: {
	/**
	 * Accepted so the slot's data dependency is DECLARED at the boundary rather
	 * than discovered later. Nothing on `DebateMarketHeader` can populate a
	 * resolver card today — that is the point, and the type is what will make it
	 * a compile-time question the day a column exists.
	 */
	market: DebateMarketHeader;
}) {
	// Deliberately unread until the schema carries resolver data (F-6 / OD-2).
	void market;
	return (
		<div
			data-testid="resolver-cards"
			className="grid grid-cols-1 gap-2 sm:grid-cols-2"
		>
			<ResolverCard glyph="LOGO" label="Resolver" testid="resolver-card" />
			<ResolverCard glyph="X" label="X — official" testid="x-official-card" />
		</div>
	);
}

/**
 * One `.rescard` (`d5:987`, `:995`) — glyph box · overline · two empty value
 * rows.
 *
 * ⛔ THE EMPTY VALUE ROWS ARE RENDERED, NOT OMITTED, and they are the reason
 * this is a placeholder rather than a label. A card that drew only its overline
 * would be a different composition from the one the mockup shows; the two blank
 * lines are what make the shape read as "a resolver goes here". They carry
 * `aria-hidden` because an empty announced row is noise to a screen reader
 * while the overline beside it already names the slot.
 */
function ResolverCard({
	glyph,
	label,
	testid,
}: {
	glyph: string;
	label: string;
	testid: string;
}) {
	return (
		<div
			data-testid={testid}
			className="flex min-w-0 items-center gap-2.5 rounded-(--r) p-2.5 [border:var(--hairline)]"
		>
			{/* `.reslogo` / `.xmark` — one glyph box, two labels. d5 gives the X mark
			    an `--ink` border where the logo box gets a hairline; that is a VALUE
			    distinction on a light ramp and is not carried. */}
			<span
				aria-hidden="true"
				className="flex size-8 shrink-0 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[8.5px] tracking-[0.16em] text-n4 [border:var(--hairline)]"
			>
				{glyph}
			</span>
			<span className="flex min-w-0 flex-col gap-[3px]">
				{/* `.reslabel` — the same overline role as `MarketHeader`'s RESOLUTION
				    label, so the recipe is REUSED rather than re-derived from d5's own
				    third variant of the family. */}
				<span className="text-[9.5px] font-extrabold tracking-[.14em] text-n4 uppercase">
					{label}
				</span>
				{/* `.resname` + `.ressrc`, EMPTY. No column can fill them and no copy
				    is authored to stand in. `min-h` keeps the shape without content. */}
				<span
					aria-hidden="true"
					className="block min-h-[1em] w-full max-w-[12rem] rounded-(--r-dot) bg-n1"
				/>
				<span
					aria-hidden="true"
					className="block min-h-[0.85em] w-full max-w-[8rem] rounded-(--r-dot) bg-n1"
				/>
			</span>
		</div>
	);
}
