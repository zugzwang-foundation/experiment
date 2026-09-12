import type { CSSProperties } from "react";

import type { PostExportProps } from "./compose";
import { CHART_Y_GUTTER, PriceHistorySvg } from "./PriceHistorySvg";
import { ACCENT, PALETTE } from "./palette";

/**
 * The JPEG composition — a VERIFICATION BAND across the top, then POST on the
 * left and MARKET on the right in two columns of EQUAL width. Painted by
 * Satori through `next/og`.
 *
 * It is deliberately NOT the page's components. Satori renders a fixed subset
 * of CSS from inline styles, so this file re-expresses the product's visual
 * language — the `n0` card on the `ground`, the hairline, the 8px / 4px / 6px
 * radii, the mono figures, the chessboard wordmark, the side-poled chips and
 * split bars — in that subset. Keeping it separate is what lets the normal UI
 * change without silently changing the export, and vice versa: nothing here is
 * imported by a page component and no page component is imported here.
 *
 * Satori rules that shape the markup below: every element with more than one
 * child declares `display: flex`; text lives in a `<span>` on its own; images
 * carry explicit width and height; `lineClamp` is the ellipsis — and it only
 * works on a `display: block` box, which is the one place this file departs
 * from "every element with more than one child declares `display: flex`" (see
 * the post title below).
 *
 * Every measurement is in BASE units (a 1200x700 card) multiplied by `s`, the
 * render scale — so the layout is authored once and rendered at 2x.
 *
 * ── Revision 4 (operator spec, 2026-09-11, against a supplied mockup) ───────
 *
 * ⛔ THE VERIFICATION BAND MOVED FROM THE FOOTER TO THE HEAD, AND ITS MARK IS
 * NOW THE PRODUCT'S OWN. It used to be the hourglass glyph beside the word
 * ZUGZWANG and a `VERIFIED` pill; it is now the CHESSBOARD WORDMARK — the same
 * two-row 8x2 cell block the global header wears, ZUGZWANG over VERIFIED,
 * alternating fills with the text inverting per cell. The header's second row
 * is the freeze countdown; here it is the word the band exists to say, and the
 * countdown moves to the band's right edge with DAYS / HOURS / MINUTES under
 * it. That is the whole point of the treatment: someone who has seen the site
 * header recognises this image as ours before they have read a word of it, and
 * a glyph-plus-pill they have never seen anywhere else buys none of that.
 *
 * ⚠ THE TILES ARE CENTRED ON THE FULL WIDTH, NOT PACKED LEFT — operator ruling
 * ("bich me"). That is why the band is a THREE-slot row whose outer two slots
 * both `flexGrow: 1`: the timestamp on the left and the countdown on the right
 * are equal-weight counterbalances, so the wordmark sits on the image's centre
 * line regardless of how long either string renders. A two-slot
 * `space-between` row would put the tiles wherever the timestamp's width left
 * them, which is a different position on every export.
 *
 * ⛔ THE COLUMNS ARE EXACTLY EQUAL — operator ruling. They were 552 / 576, a
 * 24px asymmetry inherited from an earlier revision where the right column
 * carried a four-cell info row the left had no counterpart for. That row is
 * gone (below), so the reason for the asymmetry is gone, and an image whose
 * two halves are ALMOST the same width reads as a mistake rather than as a
 * choice. `COL_W` is derived from the frame, not typed in, so the two cannot
 * drift apart again.
 *
 * ⛔ REMOVED, NOT RELOCATED — two things, both by operator ruling:
 *   the post's icon meta strip (Highest Stakes / Most Debated / N Replies /
 *   age) — the lane badge survives in the post header where it always was,
 *   what is gone is the second, redundant strip along the card's foot; and
 *   the market's four-cell info row (RESOLUTION / RESOLVER / CLOSES / STAKED),
 *   every value of which truncated to an ellipsis at this size. Four truncated
 *   strings are worse than none: they cost a fifth of the card's height to
 *   tell the reader that four facts exist without telling them what any of
 *   them is.
 *   ⚠ `staked` / `postCount` / `replyCount` went with that row, and that IS
 *   real information leaving the export. Recorded here rather than quietly
 *   dropped, so whoever wants it back knows it was a decision.
 *   The height both freed goes to the graph, which is the one element on this
 *   card that gets better with every pixel.
 *
 * ⛔ THE TWO SPLIT ROWS ARE ONE COMPONENT NOW (`SplitRow`), AND THAT IS THE
 * OPERATOR'S "same alignment" RULING MADE STRUCTURAL. The post's
 * Support/Counter row used to be three stacked mini-columns (pill over figure,
 * bar in the middle) while the market's YES/NO row was a single line of label,
 * bar, label — two different shapes saying the same kind of thing in the same
 * image. They are now the same shape: names on the upper line, figures
 * flanking the bar on the lower one. Sharing the component is what stops them
 * drifting apart the next time either is retuned.
 *
 * ⚠ COLOUR ENTERS HERE, AND ONLY HERE. `ACCENT.green` / `ACCENT.red` carry the
 * YES / NO poles on the market's split bar and on the price lines, where the
 * pole law is unchanged: green IS the YES side, red IS the NO side.
 * `palette.ts`'s `ACCENT` docblock carries why an export may do this when no
 * page may.
 *
 * ⛔ THE POST'S SUPPORT / COUNTER BAR IS THE ONE EXCEPTION, AND IT IS AN
 * OPERATOR RULING (revision 5, 2026-09-11). Its two colours are FIXED —
 * SUPPORT green, COUNTER red — and no longer follow `deriveReplySide`'s SIDE.
 * They used to: a Support reply under a NO post painted RED, which is the pole
 * law applied honestly, and which made the two split bars in one image
 * contradict each other on sight — the left bar's green sat on the right while
 * the market bar's green sat on the left. A reader who has never seen the
 * product reads the two rows as one visual grammar before they read either
 * label, so the ruling is that the grammar wins: the LEFT name is green and the
 * RIGHT name is red on both bars, and the image teaches its own legend in one
 * glance.
 * ⚠ WHAT IS LOST IS REAL AND IS RECORDED RATHER THAN QUIETLY DROPPED: the
 * export no longer says which SIDE a reply-bet lands on. The post's own side
 * chip (`NO @ 90%`) still carries the parent's side, and the page itself still
 * applies the pole law at its own bar (`ReplySplitBar`), so the rule is not
 * weakened anywhere a participant ACTS on it — only on an image they read.
 * `post.support.side` / `post.counter.side` therefore stay in the props and
 * stay tested; they are simply no longer consumed here.
 */
/**
 * The advance of Geist Bold's SPACE glyph, as a fraction of the font size —
 * the inter-word gap for the word-per-item title row below.
 *
 * ⚠ MEASURED, NOT CHOSEN, and the distinction is the whole reason this is a
 * named constant. Splitting the title into one flex item per word throws away
 * the spaces the font would have drawn, so the gap has to put them back at the
 * width the font would have used — and any nearby round number is visibly
 * wrong at 21px. Read off a four-point render sweep against the pre-split
 * render as the control: the line `Math · Will 3 Erdős problems be solved by`
 * ends at x=2283 in the 2400px frame, and gaps of 3/4/5/6 base units end it at
 * 2254/2270/2286/2302 — 16px per unit across its eight spaces, so 4.81 lands
 * on the control and 0.229em is that over a 21px size.
 * ⚠ IT IS AN EM RATHER THAN A PX SO IT SURVIVES A TYPE-SIZE CHANGE. The title
 * has been retuned twice already; a literal here would go silently wrong the
 * third time, and "silently" is the operative word — a too-wide word gap reads
 * as bad typography, never as a bug.
 */
const GEIST_BOLD_SPACE_EM = 0.229;

export function MarketPostExport(props: PostExportProps) {
	const s = props.width / 1200;
	const u = (n: number) => n * s;
	const { market, post, chart } = props;

	const hairline = `${u(1)}px solid ${PALETTE.n2}`;
	const card: CSSProperties = {
		display: "flex",
		flexDirection: "column",
		gap: u(12),
		backgroundColor: PALETTE.n0,
		border: hairline,
		borderRadius: u(8),
		padding: u(16),
	};
	/**
	 * ⚠ THE POSITION ROW'S FIVE STYLES ARE SIZED AS ONE SET — `meta`, `mono`,
	 * `chip`, `tag` and `outline` below. Operator ruling, revision 7: the row
	 * reads too small, up 1.3× across the board.
	 *
	 * ⛔ ALL FIVE MOVE TOGETHER OR NONE DO. They sit on one line and are told
	 * apart by SHAPE — a poled chip, an outlined badge, a filled tag, mono
	 * figures, grey meta — so the moment their type sizes drift the row stops
	 * reading as one row and starts reading as a large thing beside some small
	 * things. Padding moves with the type for the same reason: a chip whose box
	 * did not grow with its letters is a chip that got tighter, not bigger.
	 *
	 * ⚠ THEY ARE USED HERE AND NOWHERE ELSE. Every one of them served the post
	 * card's own header until revision 6 moved that row into the band, so a
	 * change that would once have rippled across two surfaces is now contained to
	 * this one. Checked before the bump rather than assumed.
	 */
	// ⚠ `meta` IS GONE, NOT UNUSED-AND-KEPT: the age was its only reader and the
	// age is a block now. `mono` survives for the struck-through original alone,
	// which is deliberately NOT a block — a superseded figure that wore the same
	// treatment as the live one would read as a second live one.
	const mono: CSSProperties = { fontFamily: "Geist Mono", fontSize: u(15.5) };
	/**
	 * The side chip. Poled, and deliberately NOT coloured: the side is already
	 * what black and white MEAN here, and a green `YES @ 47%` sitting beside a
	 * green price line would read as one statement rather than two.
	 */
	/**
	 * The row's BLOCK — the side chip, the stake and the age all wear it.
	 *
	 * ⛔ POLED, SO THE THREE ALWAYS MATCH EACH OTHER. Operator ruling, revision 7:
	 * the stake and the age were bare text beside a filled side chip, and should
	 * be blocks like it. The obvious implementation is a hard-coded white one —
	 * white is what the operator was looking at — but the side chip is white only
	 * because the post is NO; on a YES post it is BLACK, and three blocks that
	 * agreed on one side and disagreed on the other would be a bug that ships
	 * looking correct half the time.
	 *
	 * ⇒ All three take the same pole. The stake and the age have no side of their
	 * own, so this is not the pole law saying something about them — it is the
	 * ROW taking the post's side as its block colour, once, for everything in it.
	 *
	 * ⚠ THE HAIRLINE IS LOAD-BEARING ON THE YES POLE. `--color-yes` is `#181818`
	 * against a `#212121` card — about 1.1:1, i.e. invisible — so without the
	 * border a YES post's blocks would be three floating strings again, which is
	 * the state this change exists to leave.
	 */
	const chip: CSSProperties = {
		display: "flex",
		fontFamily: "Geist Mono",
		fontSize: u(13.5),
		letterSpacing: u(0.65),
		padding: `${u(4)}px ${u(9)}px`,
		borderRadius: u(4),
		color: PALETTE.ink,
	};
	/**
	 * ⚠ THE HAIRLINE IS GONE, AND IT WAS LOAD-BEARING UNTIL IT WASN'T. These
	 * blocks took the black/white SIDE poles a revision ago, and `--color-yes`
	 * `#181818` against a `#212121` card is about 1.1:1 — invisible without an
	 * edge. Every fill here is now a mid-dark colour that separates from the card
	 * on its own, so the border has nothing left to do. Removed rather than kept
	 * "just in case": 1px of edge is 2px of height, and these sit in a row.
	 */
	const chipSide: CSSProperties = {
		...chip,
		backgroundColor: post.side === "YES" ? ACCENT.chipYes : ACCENT.chipNo,
	};
	const chipStake: CSSProperties = {
		...chip,
		backgroundColor: ACCENT.chipStake,
	};
	const chipAge: CSSProperties = { ...chip, backgroundColor: ACCENT.chipAge };
	/** The muted tag — Flipped / Exited / SOLD. */
	const tag: CSSProperties = {
		display: "flex",
		fontSize: u(13),
		padding: `${u(3)}px ${u(8)}px`,
		borderRadius: u(4),
		backgroundColor: PALETTE.n1,
		color: PALETTE.n5,
	};
	/**
	 * The outline tag — the lane badge (Most Debated / Highest Stakes /
	 * Contested), which stays in the header now that the foot strip is gone.
	 */
	const outline: CSSProperties = {
		display: "flex",
		flexShrink: 0,
		fontSize: u(13),
		padding: `${u(3)}px ${u(10)}px`,
		borderRadius: u(4),
		border: hairline,
		color: PALETTE.n6,
	};
	/**
	 * The market's chips — TOPIC then FLAVOUR, one shape, two fills.
	 *
	 * ⛔ ONE STYLE OBJECT FOR BOTH, because the point of the pair is that they
	 * read as two items of the same kind. Two separately-written chips drift the
	 * first time either is retuned, and a topic chip two pixels taller than the
	 * flavour beside it reads as a mistake rather than as a difference.
	 */
	const marketChip: CSSProperties = {
		display: "flex",
		fontSize: u(12),
		fontWeight: 700,
		letterSpacing: u(1.3),
		padding: `${u(4)}px ${u(11)}px`,
		borderRadius: u(4),
	};
	const placeholderBox: CSSProperties = {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: PALETTE.n1,
		border: hairline,
		borderRadius: u(6),
		fontFamily: "Geist Mono",
		fontSize: u(8.5),
		letterSpacing: u(1.4),
		color: PALETTE.n4,
	};

	/** The market title's type size — the gap below is derived from it. */
	/**
	 * The market question's type size.
	 *
	 * ⛔ 27 IS A CEILING, NOT A PREFERENCE — measured, and the thing it is
	 * bounded by is the CHIPS rather than the card. The topic and flavour run on
	 * from the question mark in the same wrapping flow, so as the question grows
	 * it eventually takes the room they were sitting in: rendered against the
	 * longest live title, 26 and 27 both keep `MATH` and `INNOVATION` on the
	 * question's last line and 28 pushes `INNOVATION` onto a third line of its
	 * own, where it reads as a stray label rather than as part of the heading.
	 *
	 * ⚠ SO A BIGGER QUESTION COSTS THE CHIPS THEIR PLACE, and that trade is the
	 * one to weigh if this is ever raised again — not whether the type fits the
	 * card, which it does with room to spare.
	 */
	const TITLE_FS = 27;
	/**
	 * The frame's own margin, and the air between its three boxes.
	 *
	 * ⚠ 28 → 14 AND 16 → 12 — operator ruling, revision 7. `PAD` is the dark
	 * ground between the image's edge and the cards, on all four sides, and
	 * `GAP` is the same ground between the band and the two columns below it.
	 * At 28 that was 2.3% of the width given away on each flank, and on a card
	 * whose whole job is to be legible in somebody else's feed at thumbnail size,
	 * ground is the one thing that carries nothing.
	 *
	 * ⛔ NOT ZERO, AND THE REMAINING 14 IS DOING WORK. The cards are rounded and
	 * hairlined; run them to the edge and the border sits ON the image boundary,
	 * where a viewer reads it as a crop rather than as a card. The margin is what
	 * says the composition is complete.
	 *
	 * ⚠ EVERY OTHER MEASURE FOLLOWS THESE TWO. `COL_W`, `BODY_H` and `AUTHOR_W`
	 * are all derived below, so shrinking the margin widens the columns, lengthens
	 * the cards and widens the author's slot in one move — which is why
	 * `POST_IMAGE_H` had to be re-measured against the new `BODY_H` rather than
	 * left where it was.
	 */
	const PAD = 14;
	const GAP = 12;
	/**
	 * ⚠ 78 → 108, because the band carries the AUTHOR now and not just a
	 * timestamp: a name, the whole position row beneath it, and the generation
	 * date under that.
	 *
	 * ⛔ SIZED FOR THE POSITION ROW WRAPPING TO TWO LINES, which is not the
	 * common case and is exactly why it is the number. Every chip is optional —
	 * marker, lane badge, struck-through original, SOLD — and a post carrying
	 * all of them runs past this slot's width and wraps. The band's height is
	 * fixed (`BODY_H` is derived from it, so it cannot be content-driven), so a
	 * height tuned to the common case would clip the uncommon one, and clipping
	 * here loses a stake figure rather than a pixel.
	 */
	const BAND_H = 96;
	/**
	 * The author column's width, DERIVED — never typed in.
	 *
	 * ⛔⛔ IT HAS TO BE DECLARED, AND THAT IS THE BUG THIS FIXES. The column is a
	 * flex item whose own content is a WRAPPING row, and Yoga sizes such an item
	 * from its content before the wrap can know what width to wrap against — so
	 * the column came out wider than the slot it lives in, and the last chip on a
	 * crowded post (SOLD, on a post that also carries a marker, a lane badge and
	 * a struck-through original) overflowed sideways INTO THE WORDMARK instead of
	 * wrapping to the second line. It was off by about 25 units: small enough to
	 * look like a spacing choice, and squarely on top of the brand mark.
	 *
	 * ⚠ THE SUBTRACTION IS THE BAND'S OWN ARITHMETIC, not a measured constant:
	 * the frame less its padding, less the band's padding, less the brand cluster
	 * the band builds from `BRAND_MARK` / `BRAND_GAP` / `TILE_CELL`, halved
	 * between the two flanking slots, less the avatar and its gap. Change the
	 * mark's size or the wordmark's cell and this follows; write `334` here and
	 * it silently stops being true the next time either moves.
	 */
	const BAND_PAD_X = 20;
	const BRAND_W = BRAND_MARK + BRAND_GAP + TILE_CELL * 8;
	const AUTHOR_W =
		(1200 - PAD * 2 - BAND_PAD_X * 2 - BRAND_W) / 2 - AVATAR - AVATAR_GAP;
	/** Both columns, from the frame — never two numbers that can disagree. */
	const COL_W = (1200 - PAD * 2 - GAP) / 2;
	const BODY_H = 700 - PAD * 2 - GAP - BAND_H;
	const INNER_W = COL_W - 32;
	/**
	 * The quote's type size, FITTED TO THE QUOTE — operator ruling, revision 7:
	 * two lines, and the size adjusts to the text.
	 *
	 * ⛔ IT IS AN ESTIMATE, AND IT HAS TO BE. Satori measures text during layout
	 * and gives nothing back, so a size that depends on how the text wraps cannot
	 * be read off the render — it has to be predicted before it. The prediction
	 * is the oldest one in typesetting: a line holds about `width / (size × the
	 * font's average advance)` characters, so two lines hold twice that, and the
	 * largest size that still fits `n` characters is the inverse.
	 *
	 * ⚠ `AVG_ADVANCE` IS GEIST'S AT THIS WEIGHT, not a guess at type in general.
	 * Mixed-case prose in this family runs close to half its point size per
	 * character at regular weights and a little wider at BOLD, which is what the
	 * quote is set in — so the two move together: change the weight and this
	 * number is wrong until it is changed too.
	 *
	 * ⚠ `SAFETY` pays for the estimate being an average: words break at spaces,
	 * so a real line ends ragged rather than exactly at the margin, and a title
	 * of wide glyphs runs longer than the mean. 12% back covers both.
	 *
	 * ⚠ `QUOTE_LINES` IS THE BUDGET AND IT IS THE LEVER. Raising it from two to
	 * three is what let the ceiling go up: with a third line to spend, a
	 * full-length title no longer has to shrink as far, so the SHORT titles that
	 * sit at the ceiling could be set larger without the long ones falling off a
	 * cliff. The two numbers are not independent — they trade against each other
	 * through this formula.
	 *
	 * ⚠ CLAMPED AT BOTH ENDS, FOR DIFFERENT REASONS. The ceiling is the largest
	 * the title should ever be set; the floor is where the type stops being a
	 * headline. In between the formula decides, and the crossover now sits around
	 * a hundred characters.
	 *
	 * ⚠ THE TWO QUOTE MARKS COUNT. They are drawn from the same text node, so
	 * they occupy line width like any other character.
	 */
	const QUOTE_LINES = 3;
	const QUOTE_MAX_TYPE = 26;
	const QUOTE_MIN_TYPE = 13;
	const AVG_ADVANCE = 0.54;
	const SAFETY = 0.88;
	const quoteChars = post.title.length + 2;
	const quoteType = Math.max(
		QUOTE_MIN_TYPE,
		Math.min(
			QUOTE_MAX_TYPE,
			Math.floor((QUOTE_LINES * INNER_W * SAFETY) / (quoteChars * AVG_ADVANCE)),
		),
	);
	/**
	 * ⛔ THIS IS NO LONGER THE IMAGE'S HEIGHT — the box grows into the card's
	 * leftover space now (see the block below). All that survives here is the
	 * `height` ATTRIBUTE on the `<img>`, which Satori consults only if it cannot
	 * read intrinsic dimensions out of the decoded image.
	 *
	 * ⚠ KEPT AT THE LAST TUNED VALUE ON PURPOSE. It is a plausible height, so on
	 * the fallback path the picture degrades to something the card can hold
	 * rather than to something arbitrary. It is not a layout constant any more
	 * and nothing should be measured against it.
	 */
	const POST_IMAGE_FALLBACK_H = 370;
	const THUMB = 96;
	const PLOT_H = 320;

	// ⛔ FIXED, NOT SIDE-DERIVED — the revision-5 ruling in the docblock above.
	// Kept as two named consts rather than inlined at the call site so the pair
	// reads as ONE decision, and so restoring the pole law is one edit here
	// instead of two literals hunted through the markup.
	const supportColor = ACCENT.green;
	const counterColor = ACCENT.red;

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				width: props.width,
				height: props.height,
				backgroundColor: PALETTE.ground,
				color: PALETTE.ink,
				fontFamily: "Geist",
				padding: u(PAD),
				gap: u(GAP),
			}}
		>
			{/* ── BAND · the verification mark, and its only appearance ─────── */}
			<div
				style={{
					...card,
					flexDirection: "row",
					alignItems: "center",
					height: u(BAND_H),
					padding: `${u(8)}px ${u(BAND_PAD_X)}px`,
				}}
			>
				{/* ⛔ THE AUTHOR SITS IN THE BAND NOW, AND THE DATE SITS UNDER THEM —
				    operator ruling, revision 5. The band's left slot used to carry the
				    generation timestamp alone, and the avatar and pseudonym opened the
				    post card's own header row.

				    The move is worth more than a tidier card. A shared image is read
				    top-left first, and what a reader needs there is WHO IS SPEAKING —
				    the one fact the rest of the image is an argument by. The timestamp
				    is provenance: it matters when someone asks "when was this true",
				    which is a second question, so it is set under the name at two
				    thirds the size rather than beside it at equal weight. The band was
				    already the identity strip — wordmark, VERIFIED, countdown — and
				    the author belongs to that sentence, not to the argument's own card.

				    ⚠ THE THREE-SLOT BALANCE IS UNCHANGED and still load-bearing: this
				    slot and the countdown both `flexGrow: 1` from a zero basis, so the
				    wordmark stays on the image's centre line however long a pseudonym
				    or a countdown renders. A taller left slot does not move it either —
				    the row is `alignItems: center`. */}
				<div
					style={{
						display: "flex",
						flexGrow: 1,
						flexBasis: 0,
						minWidth: 0,
						/* ⛔ TOP-ALIGNED, NOT CENTRED — operator ruling, revision 6. The
						   two flanks of this band hold different KINDS of thing: the
						   wordmark and the countdown are fixed blocks and want the
						   band's middle, while this one is a stack that grows downward
						   when a post wears more chips. Centred, a crowded post pushed
						   the name down and a plain one floated it — the author moved
						   between exports for a reason no reader could see. Anchored to
						   the top, the name is in the same place every time and the
						   growth happens where growth belongs, at the bottom. */
						alignItems: "flex-start",
						gap: u(AVATAR_GAP),
					}}
				>
					{/* ⛔⛔ `flexShrink: 0` ON BOTH ARMS, AND IT IS A BUG FIX. The column
					    beside the avatar carries a WRAPPING row, so its natural width is
					    the sum of every chip a post might wear — well past this slot. A
					    flex item shrinks by default, and the avatar was the one item
					    with nothing to resist it: on a post carrying marker, badge,
					    struck-through original and SOLD it was crushed to a sliver with
					    the initials sliced in half, while the row that caused it
					    rendered perfectly. ⚠ The failure appears only on the crowded
					    post, which is exactly the one nobody renders while tuning. */}
					{post.pfpUrl ? (
						<img
							src={post.pfpUrl}
							alt=""
							width={u(AVATAR)}
							height={u(AVATAR)}
							style={{
								width: u(AVATAR),
								height: u(AVATAR),
								flexShrink: 0,
								borderRadius: u(AVATAR / 2),
								border: hairline,
								objectFit: "cover",
							}}
						/>
					) : (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								width: u(AVATAR),
								height: u(AVATAR),
								flexShrink: 0,
								borderRadius: u(AVATAR / 2),
								border: hairline,
								backgroundColor: PALETTE.n1,
								color: PALETTE.n6,
								fontSize: u(20),
								fontWeight: 700,
							}}
						>
							{post.initials}
						</div>
					)}
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							width: u(AUTHOR_W),
							gap: u(7),
						}}
					>
						<span style={{ fontSize: u(22), fontWeight: 500, lineHeight: 1 }}>
							{post.pseudonym}
						</span>
						{/* ⚠ NO `|` SEPARATORS — operator ruling. The pipes were doing the
				    work that spacing does here, and at export size they read as a
				    sixth kind of mark in a row that already carries five. */}
						<div
							style={{
								display: "flex",
								alignItems: "center",
								flexWrap: "wrap",
								gap: u(9),
								minWidth: 0,
							}}
						>
							{/* ⚠ NO AVATAR AND NO PSEUDONYM HERE — they are in the band
					    (above). This row is now the POSITION alone: which side, at
					    what price, for how much, answered how often, how long ago.
					    That is a cleaner division than the one it replaces, where
					    the author appeared once in each half of the image. */}
							<div style={chipSide}>{`${post.side} @ ${post.entryPct}`}</div>
							{post.marker !== "none" && <div style={tag}>{post.marker}</div>}
							{post.badge !== null && <div style={outline}>{post.badge}</div>}
							<div style={chipStake}>{`Đ ${post.stake}`}</div>
							{post.stakeOriginal !== null && (
								<span
									style={{
										...mono,
										color: PALETTE.n4,
										textDecoration: "line-through",
									}}
								>
									{`Đ ${post.stakeOriginal}`}
								</span>
							)}
							{post.sold && (
								<div style={{ ...tag, fontWeight: 700, letterSpacing: u(1) }}>
									SOLD
								</div>
							)}
							{/* ⛔ THE REPLY COUNT STOOD HERE AND IS GONE — operator ruling,
							    revision 7. It was the loudest thing in this row: ink-white
							    and bold where its neighbours are chips and grey, so a
							    number that describes the ROOM outranked the numbers that
							    describe the AUTHOR'S POSITION, which is what the row is
							    for. The count is not lost from the image either — the
							    split bar under the post says how the room answered, in
							    Dharma rather than in headcount, which is the measure this
							    product settles in.
							    ⚠ `post.replyCount` IS STILL COMPOSED AND STILL TESTED, it
							    is simply not painted. The mapper's job is to say what is
							    true of this post; a later revision wanting the count back
							    should not have to re-derive it from the aggregate. */}
							<div style={chipAge}>{post.age}</div>
						</div>
						{/* ⛔ THE GENERATION TIMESTAMP STOOD HERE AND IS GONE — operator
						    ruling, revision 6. It was provenance, and provenance was
						    losing an argument it should not have been in: it sat under
						    the author's own name, in the band a reader looks at first,
						    competing with the one fact that band exists to carry. The
						    post's OWN age (`2d ago`, in the row above) is the time a
						    reader of a shared image actually wants — when the argument
						    was made, not when the picture was generated.
						    ⚠ `props.generatedAt` IS STILL COMPOSED AND STILL TESTED; it
						    is simply not painted. That is deliberate: the mapper's job
						    is to say what is true of this post, and a later revision
						    wanting the stamp back should not have to re-derive it. */}
					</div>
				</div>

				{/* ⛔ THE MARK JOINS THE WORDMARK, AND THE PAIR IS WHAT IS CENTRED —
				    operator ruling, revision 6. The site's own header is exactly this
				    cluster (`BrandCluster.tsx`: the 48px mark, then the wordmark with
				    the countdown under it), so a reader who has seen the product
				    recognises the shape before they read a word — which was the whole
				    argument for the chessboard treatment in the first place, only
				    half-applied while the mark was missing.

				    ⚠ IT IS THE FILE, NOT A REDRAWING. `logo.ts` reads
				    `public/brand/zugzwang-mark.svg` and hands it over as a data URI;
				    the polygons are never restated here. Contrast the wordmark beside
				    it, which HAS to be re-expressed because it is Tailwind classes
				    Satori cannot resolve — a file has no such excuse.

				    ⚠ THE CENTRING STILL COMES FROM THE OUTER SLOTS, not from this one:
				    both flanks are `flexGrow: 1` on a zero basis, so widening the
				    middle takes the same bite out of each side and the cluster stays on
				    the image's centre line. That is why the mark could be added without
				    touching the band's balance at all.
				    ⚠ `null` DEGRADES TO THE WORDMARK ALONE rather than to a gap: a
				    missing brand file must cost the export a logo, never a layout. */}
				<div
					style={{
						display: "flex",
						flexShrink: 0,
						alignItems: "center",
						gap: u(BRAND_GAP),
					}}
				>
					{props.logoUrl !== null && (
						<img
							src={props.logoUrl}
							alt=""
							width={u(BRAND_MARK)}
							height={u(BRAND_MARK)}
							// The site's own ratio: a 48px mark beside a 40px two-row block
							// (BrandCluster). The block here is 52 tall, so the mark is 62.
							style={{ width: u(BRAND_MARK), height: u(BRAND_MARK) }}
						/>
					)}
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
						}}
					>
						<TileRow u={u} text="ZUGZWANG" lightFirst={false} />
						<TileRow u={u} text="VERIFIED" lightFirst={true} overlap={true} />
					</div>
				</div>

				<div
					style={{
						display: "flex",
						flexGrow: 1,
						flexBasis: 0,
						minWidth: 0,
						justifyContent: "flex-end",
					}}
				>
					<Countdown u={u} display={props.countdown} hairline={hairline} />
				</div>
			</div>

			<div style={{ display: "flex", gap: u(GAP), height: u(BODY_H) }}>
				{/* ── LEFT · the post ───────────────────────────────────────── */}
				<div style={{ ...card, width: u(COL_W), height: "100%" }}>
					{/* ⛔ THE WHOLE POSITION ROW IS IN THE BAND NOW — operator ruling,
					    revision 6. Side chip, markers, stake, replies and age all moved
					    up under the author's name, so this card opens on the argument
					    itself. Nothing was dropped and nothing was rewritten: the markup
					    that draws them is the same markup, one level shallower. */}

					{/* ⛔ THE QUOTE MARKS ARE PART OF THE TEXT, AND THAT IS THE WHOLE
					    CHANGE — operator ruling, revision 7. The argument is quoted now;
					    everything else about this block is what it was.

					    ⚠ A PANEL WAS BUILT FIRST AND IS REMOVED. The reference showed the
					    quote inside a lighter rounded box, centred, so the box was read
					    as part of the treatment — it was not. Putting the marks IN the
					    text node keeps the type, the weight, the leading, the clamp and
					    the left alignment exactly as they were, which is what was asked
					    for and is also the smaller change: nothing about the card's
					    geometry moves, so nothing below it needed re-measuring.

					    ⚠ TYPOGRAPHIC QUOTES, NOT `"`. The straight mark is a typewriter
					    compromise; these are the characters the glyphs exist for, and
					    Geist carries both.

					    ⚠ THE SIZE IS FITTED TO THE TEXT RATHER THAN THE TEXT TRUNCATED TO
					    THE SIZE. A fixed size forces the choice between clamping a
					    full-length title — `TITLE_MAX_CHARS = 125`, which is a
					    participant using the whole field they were given — and setting
					    every short title in small type to make room for a long one that
					    usually is not there. `quoteType` above removes the choice: long
					    quotes come down, short ones sit at the ceiling.
					    ⚠ THE CLAMP IS `QUOTE_LINES` AND IS A BACKSTOP rather than the
					    policy — the estimate that sizes the type is an average, and a
					    pathological title can still beat it. It is also what keeps this
					    block's height bounded, which is what lets the image below simply
					    take whatever is left.
					    ⚠ BOLD, AND `AVG_ADVANCE` ABOVE IS PAIRED TO IT: bold glyphs are
					    wider, so the weight is not a free change — move it and the fit
					    is wrong until the advance moves with it. */}
					<div
						style={{
							display: "block",
							fontSize: u(quoteType),
							fontWeight: 700,
							lineHeight: 1.25,
							lineClamp: QUOTE_LINES,
							overflow: "hidden",
						}}
					>
						{`“${post.title}”`}
					</div>

					{/* ⛔ THE ARGUMENT TEXT STOOD HERE AND IS GONE — operator ruling,
					    revision 5. It was clamped to three lines beside an image and
					    nine without, and a clamped argument is the one thing this card
					    must not show: it hands the reader a third of a case and the
					    impression they have read it. `compose.ts` no longer carries a
					    body at all, so this is not a hidden element — there is nothing
					    to render. The title, the side chip, the stake and the split bar
					    are what the image claims to say; the link is what says the rest.
					    ⚠ THE IMAGE MOVES UP BY EXACTLY THIS BLOCK and nothing else was
					    retuned: the split row still collects the card's slack under
					    `marginTop: auto`, so both cards keep seating their bars on one
					    baseline. */}
					{/* ⛔⛔ THE IMAGE TAKES WHATEVER THE CARD HAS LEFT — it is no longer a
					    fixed height, and that retires a whole class of tuning. Operator
					    ruling, revision 7: there was dead space under the picture.

					    There always was, and no single number could remove it. The title
					    is the card's one variable — one line to three — so a FIXED image
					    had to be sized for the three-line case and then left ~50 units of
					    hole on every one-line post. Every earlier revision of this
					    constant was that trade being re-made by hand: 248, 330, 340, 350,
					    370, each measured against a worst case and each wrong for the
					    common one.

					    ⇒ `flexGrow: 1` with `minHeight: 0`, and the split row still
					    seats itself on the card's floor. The box is now exactly the gap,
					    so a long title shrinks the picture and a short one enlarges it —
					    which is what a reader would expect and what nobody had to ask for
					    a number to get.

					    ⚠ `minHeight: 0` IS NOT DECORATION. A flex item's default minimum
					    is its content, so without it the image would refuse to shrink
					    below its own size and a three-line title would push the split bar
					    off the card instead of taking room from the picture.

					    ⚠ THE `width`/`height` ATTRIBUTES STAY and are deliberately not
					    the rendered size: Satori reads intrinsic dimensions from the
					    decoded image, and these are only its fallback if that ever fails.
					    CSS `height: "100%"` is what actually sizes the picture. */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							width: "100%",
							flexGrow: 1,
							minHeight: 0,
						}}
					>
						{post.imageUrl ? (
							<img
								src={post.imageUrl}
								alt=""
								width={u(INNER_W)}
								height={u(POST_IMAGE_FALLBACK_H)}
								style={{
									width: u(INNER_W),
									height: "100%",
									objectFit: "contain",
									borderRadius: u(6),
								}}
							/>
						) : (
							/* The placeholder fills the same box. It gives up the 640:586
							   shape the fixed version drew, and the LABEL is what carried
							   that information anyway. */
							<div style={{ ...placeholderBox, width: "100%", height: "100%" }}>
								POST IMAGE · 640:586
							</div>
						)}
					</div>

					<SplitRow
						u={u}
						hairline={hairline}
						leftLabel="SUPPORT"
						leftValue={`Đ ${post.support.dharma}`}
						leftColor={supportColor}
						centerLabel={`Đ ${post.splitTotal} STAKED`}
						rightLabel="COUNTER"
						rightValue={`Đ ${post.counter.dharma}`}
						rightColor={counterColor}
						barLeftPct={post.supportBarPct}
						neutral={!post.hasStake}
					/>
				</div>

				{/* ── RIGHT · the market ────────────────────────────────────── */}
				<div style={{ ...card, width: u(COL_W), height: "100%" }}>
					{/* ⚠ `flex-start`, NOT `center` — operator ruling, revision 8: the
					    question sits higher. Centred against the thumbnail, the heading
					    floated by however many lines it happened to take; anchored to the
					    top, the question's first line and the mark's top edge start
					    together, which is the alignment a reader expects of a heading and
					    its icon — and it no longer moves between markets. */}
					<div
						style={{ display: "flex", alignItems: "flex-start", gap: u(14) }}
					>
						{market.thumbUrl ? (
							<img
								src={market.thumbUrl}
								alt=""
								width={u(THUMB)}
								height={u(THUMB)}
								style={{
									width: u(THUMB),
									height: u(THUMB),
									borderRadius: u(8),
									border: hairline,
									objectFit: "cover",
								}}
							/>
						) : (
							<div
								style={{ ...placeholderBox, width: u(THUMB), height: u(THUMB) }}
							>
								IMG
							</div>
						)}
						{/* ⛔ THE CHIPS RUN ON FROM THE QUESTION MARK — operator ruling,
						    revision 5. The flavour used to sit on its own line under the
						    title, where it read as a second, lesser heading; the question
						    and its labels are one thing being said, so
						    `Will 3 Erdős problems be solved by 5th November? MATH
						    INNOVATION` is the line.

						    ⛔ AND THE TOPIC IS A CHIP NOW, NOT THE TITLE'S FIRST WORD.
						    Every live title is written `Math · <question>`, so the
						    heading spent its most prominent position on a word that is a
						    category rather than part of the question — and then repeated
						    the same kind of information in a chip two inches away.
						    `compose.ts`'s `splitMarketTitle` does the cutting; this file
						    only ever renders finished strings.
						    ⚠ THE TWO CHIPS ARE INVERSES OF EACH OTHER, and that is what
						    keeps them apart — operator ruling, revision 7, against a
						    supplied reference. The flavour is a LIGHT word on a saturated
						    violet ground; the topic is a SATURATED word on a dark slate
						    ground. An earlier pass gave the topic CSS `slateblue`
						    (`#6a5acd`) — a purple — and the pair rendered as one
						    continuous violet bar, because hue alone at identical size,
						    weight and fill is far too fine a margin at export scale.
						    ⇒ If either is ever retuned, keep the STRUCTURAL difference;
						    matching their hues apart is not enough on its own.

						    ⚠⚠ THE TITLE IS SPLIT INTO ONE FLEX ITEM PER WORD, AND THAT IS
						    FORCED RATHER THAN CLEVER. Satori has no inline formatting
						    context: a text node is measured and wrapped as a single atomic
						    item that claims the full container width the moment it needs a
						    second line, so a chip placed after it lands on the next FLEX
						    line — i.e. back under the title, which is the arrangement this
						    change exists to end. Words as items put the chip in the same
						    wrapping flow as the last word, so it follows the `?` wherever
						    the `?` happens to land. `columnGap` is the inter-word space
						    (Geist's own is ~0.26em at this weight) and `rowGap` the leading
						    between wrapped lines; `lineHeight` no longer has any run of two
						    lines to act on, so the row gap is what sets the leading.

						    ⚠ `lineClamp: 2` GOES WITH IT AND CANNOT BE KEPT. It clamps a
						    text node, and there is no longer a text node to clamp — the
						    title is n items. The eight live titles run to two lines at this
						    width and the card has ~30px of vertical slack (`BODY_H` less
						    the header, the chart and the split row), so a three-line title
						    fits; a fourth would squeeze the chart rather than truncate.
						    That is a real trade and it is the ruling's cost. */}
						<div
							style={{
								display: "flex",
								flexWrap: "wrap",
								alignItems: "center",
								columnGap: u(TITLE_FS * GEIST_BOLD_SPACE_EM),
								rowGap: u(3),
								width: u(INNER_W - THUMB - 14),
							}}
						>
							{market.title.split(" ").map((word, i) => (
								<span
									// biome-ignore lint/suspicious/noArrayIndexKey: positional word slots in a fixed string — the position IS the identity.
									key={i}
									style={{
										fontSize: u(TITLE_FS),
										// ⚠ 700 IS THE HEAVIEST THIS EXPORT HAS, AND THIS READ 800
										// WHILE RENDERING AT 700. `fonts.ts` vendors Geist 400 /
										// 500 / 700 only, so Satori resolved 800 to the nearest
										// face it was given and drew exactly what 700 draws. The
										// number is corrected rather than the font added: a
										// declared weight nobody ships is a lie the render cannot
										// contradict, and the next person asking for "bolder"
										// deserves to find out here that the answer is a new
										// `.ttf`, not a larger number.
										fontWeight: 700,
										lineHeight: 1.22,
									}}
								>
									{word}
								</span>
							))}
							{market.category !== null && (
								<div
									style={{
										...marketChip,
										backgroundColor: ACCENT.category,
										color: ACCENT.categoryInk,
									}}
								>
									{market.category.toUpperCase()}
								</div>
							)}
							{market.flavour !== null && (
								<div
									style={{
										...marketChip,
										backgroundColor: ACCENT.flavour,
										color: PALETTE.ink,
									}}
								>
									{market.flavour.toUpperCase()}
								</div>
							)}
						</div>
					</div>

					{/* ⚠ THE CHART SITS LOWER THAN THE CARD'S OWN GAP WOULD PUT IT —
					    operator ruling, revision 8. The right column has slack the left
					    one does not: its header and its plot are both fixed heights and
					    the split bar seats itself on the floor, so what is left collects
					    in ONE band. Left alone that band sat under the plot, which read
					    as a chart that had slid up against the question; spending it
					    above instead gives the heading room to be a heading.

					    ⛔ A MARGIN, NOT A BIGGER CARD GAP. The gap is the card's, shared
					    with the split row below — widening it would push the chart down
					    and pull the split bar up by the same amount, and the split bars
					    on the two cards would stop seating on one baseline. This moves
					    exactly one element.

					    ⚠ IT IS DELIBERATELY LESS THAN THE SLACK. Taking all of it would
					    seat the plot's date row hard against the split's labels; a little
					    left under the chart is what keeps those two rows readable as
					    separate things. */}
					<div style={{ display: "flex", marginTop: u(18) }}>
						{chart !== null && chart.series.length > 0 ? (
							<PriceHistorySvg
								series={chart.series}
								isOpen={chart.isOpen}
								u={u}
								width={u(INNER_W - CHART_Y_GUTTER)}
								height={u(PLOT_H)}
							/>
						) : (
							<div
								style={{
									...placeholderBox,
									width: u(INNER_W),
									height: u(PLOT_H),
								}}
							>
								PRICE HISTORY · NO TRADES YET
							</div>
						)}
					</div>

					<SplitRow
						u={u}
						hairline={hairline}
						leftLabel="YES"
						leftValue={market.yesPct}
						leftColor={ACCENT.green}
						/* ⛔ THE MARKET'S BAR SAYS WHAT IS ON IT NOW — operator ruling,
						   revision 6. The post's bar has printed its staked total in the
						   middle since the row was built, and the market's sat empty
						   there, so the image answered "how much is riding on this
						   argument" and never "how much is riding on this question" —
						   the larger of the two numbers, and the one that says whether
						   the market is worth a stranger's attention at all. */
						centerLabel={`Đ ${market.staked} STAKED`}
						rightLabel="NO"
						rightValue={market.noPct}
						rightColor={ACCENT.red}
						barLeftPct={market.yesBarPct}
					/>
				</div>
			</div>
		</div>
	);
}

/**
 * One row of the chessboard wordmark — the header's mark, re-expressed in
 * Satori's CSS subset.
 *
 * ⛔ RE-EXPRESSED, NOT IMPORTED, AND THE DUPLICATION IS FORCED. `Wordmark.tsx`
 * carries its fills as Tailwind classes (`bg-n0`, `text-ink`, `size-5`) and
 * Satori has no stylesheet to resolve them against — importing it would
 * rasterise eight unstyled letters. The parity that matters is the RULE
 * (alternating fills, text inverting per cell, one outer hairline, no internal
 * borders), which is restated here; the fills themselves come from `PALETTE`,
 * which `image-palette-parity.test.ts` already pins to the same tokens those
 * classes compile from.
 *
 * `lightFirst` continues the chessboard ACROSS the two rows: ZUGZWANG's first
 * cell is dark, so VERIFIED's must be light — the same rule
 * `CountdownDigits.tsx` follows for the header's own second row.
 *
 * `overlap` pulls the second row up by one hairline so the two borders collapse
 * into a single outer rectangle, exactly as the header's `-mt-px` does.
 */
function TileRow({
	u,
	text,
	lightFirst,
	overlap = false,
}: {
	u: (n: number) => number;
	text: string;
	lightFirst: boolean;
	overlap?: boolean;
}) {
	return (
		<div
			style={{
				display: "flex",
				border: `${u(1)}px solid ${PALETTE.n2}`,
				marginTop: overlap ? -u(1) : 0,
			}}
		>
			{text.split("").map((ch, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length row — the chessboard slot, not the glyph, is the identity.
					key={i}
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						width: u(TILE_CELL),
						height: u(TILE_CELL),
						backgroundColor:
							(i % 2 === 0) === lightFirst ? PALETTE.ink : PALETTE.n0,
						color: (i % 2 === 0) === lightFirst ? PALETTE.n0 : PALETTE.ink,
						fontSize: u(21),
						fontWeight: 800,
					}}
				>
					{ch}
				</div>
			))}
		</div>
	);
}

const COUNTDOWN_LABELS = ["DAYS", "HOURS", "MINUTES"] as const;

/**
 * ⚠ THE BAND'S THREE BLOCKS ARE SIZED AS ONE SET — operator ruling, revision 7:
 * the band was carrying too much empty space, above, below and on both flanks.
 *
 * ⛔ THE AIR WAS A SYMPTOM, NOT THE PROBLEM. `BAND_H` is fixed (`BODY_H` derives
 * from it) and sized for the worst case — an author whose position row wraps to
 * two lines — so on an ordinary post the band is simply taller than its
 * contents, and the answer is to make the contents worth the height rather than
 * to shrink a height the crowded post still needs.
 *
 * ⛔ AND FILLING THE HEIGHT FILLS THE WIDTH, which is why one change answers
 * both complaints. The wordmark's cells are square, so growing them vertically
 * widens the brand cluster by eight cells at once; `AUTHOR_W` is DERIVED from
 * what is left, so the flanks close in on the middle automatically and the two
 * horizontal gaps shrink without a second number being touched.
 *
 * ⚠ THE CEILING IS THE WORDMARK, NOT THE MARK. Two stacked rows of `TILE_CELL`
 * must fit `BAND_H` less its padding — 96 − 16 = 80 — so 34 is the largest
 * square that leaves any air at all (68), and the mark is sized against THAT
 * rather than against the band: 76 keeps roughly the site's own mark-to-block
 * ratio (`BrandCluster`: 48 against 40) without becoming the tallest thing in a
 * row it is supposed to introduce.
 */
const TILE_CELL = 34;

/** One countdown cell, square — the site's `size-5`, at this frame's scale. */
const CD_CELL = 32;

/**
 * The mark beside the wordmark, and the air between them.
 *
 * ⚠⚠ 80 IS THE BAND'S WHOLE INNER HEIGHT (`BAND_H` 96 less its 8px padding),
 * AND THE MARK STILL DOES NOT TOUCH TOP AND BOTTOM. Measured off
 * `zugzwang-mark.svg`: its polygons occupy y 82…942 of a 1024 viewBox, so
 * **84% of the declared size is ink and the rest is the file's own margin** —
 * and only 52% of the WIDTH is, which is why the mark reads narrow beside eight
 * square tiles.
 *
 * ⇒ A nominal size here is NOT the size anybody sees. At 80 the drawn glyph is
 * ~67 tall, which is what finally matches the wordmark's 68 — the two now read
 * as one cluster instead of a small mark apologising beside a big block. Sizing
 * it "the same as the wordmark" by writing 68 would have drawn it at 57.
 *
 * ⚠ SO DO NOT TREAT THIS AS SLACK TO RECLAIM. It looks like the mark overflows
 * its slot and it does not; shrink it to "fit" and the glyph gets smaller for
 * no visible reason.
 */
const BRAND_MARK = 80;
const BRAND_GAP = 16;

/** The author's avatar, and the air between it and their name. */
const AVATAR = 64;
const AVATAR_GAP = 12;

/**
 * The freeze countdown — THREE OUTLINED FIELDS, not the site's chessboard.
 *
 * ⛔⛔ THIS SUPERSEDES AN EARLIER RULING AND THE REVERSAL IS THE POINT. Revision
 * 6 asked for the site's own design and got it: `CountdownDigits.tsx` draws ONE
 * continuous bordered strip over `display.split("")` with every character —
 * separators included — in an alternating chessboard cell, and this file
 * reproduced that exactly. Revision 8 supplies a reference that is a different
 * object: each field is its own rounded outlined box with a hairline BETWEEN its
 * two digits, every cell is dark with white digits, and the colons sit OUTSIDE
 * the boxes. No alternation anywhere.
 *
 * ⇒ The chessboard now appears in this image once — on the wordmark — where it
 * is the brand mark rather than a way of drawing numbers. That is arguably the
 * better division: repeating it under the wordmark made the countdown look like
 * a third row of the logo.
 *
 * ⚠ SO THE EXPORT AND THE PAGE NOW DIVERGE HERE, DELIBERATELY, and this is the
 * note that says so — a later pass reading "make the countdown match the site"
 * in the revision-6 history would otherwise read it as drift and undo this.
 *
 * ⚠ THE CAPTIONS ARE STILL THIS SURFACE'S ADDITION. The site's header sits in
 * chrome that explains itself; a shared image gets one pass, so DAYS / HOURS /
 * MINUTES are load-bearing here even though the site has no such row.
 *
 * ⛔⛔ ONE CONTINUOUS STRIP, AND THE COLONS ARE CELLS. Operator ruling,
 * revision 6: the site's design is a SINGLE bordered row over `display.split("")`
 * — every character, separator included, gets its own chessboard square, and the
 * alternation runs unbroken across all eight. This file used to draw three
 * separately-bordered two-cell groups with a plain text `:` floating between
 * them, which is a different object: three little boards instead of one, and a
 * punctuation mark where the site has a square. That is exactly the recognition
 * the chessboard treatment exists to buy, spent on a shape the site never shows.
 *
 * ⚠ THE PARITY IS THE GLOBAL CHARACTER INDEX, which is what the site does and
 * what makes the strip read as one board. It also disposes of a subtlety the old
 * three-group version needed a paragraph for: it tracked a running offset because
 * `formatCountdown` grows the days field to three digits above 99 days, so the
 * groups are not all the same width and an assumed stride of two would flip the
 * parity of everything after the first colon. Splitting the whole string removes
 * the question rather than answering it.
 *
 * ⚠ THE CAPTIONS ARE THIS SURFACE'S ADDITION AND THEY STAY — operator ruling.
 * The site's header sits in chrome that explains itself; a shared image gets one
 * pass, so DAYS / HOURS / MINUTES are load-bearing here even though the site has
 * no such row.
 * ⛔ THEY ARE ALIGNED BY THE CELL GRID, NOT BY GUESSWORK: each caption sits in a
 * box exactly `group.length` cells wide, with an empty one-cell box standing in
 * for each colon. So a caption is centred under its own digits at any field
 * width, including the three-digit days field, with no absolute positioning and
 * nothing to re-measure.
 * ⛔ THE CAPTION SIZE IS CAPPED BY `MINUTES`, NOT CHOSEN FREELY. Its box is a
 * hard `group.length` cells wide — two, for every field but a days count past
 * 99 — and a caption wider than its box would push the grid out of step with the
 * strip above, which is the one thing this arrangement exists to prevent. So the
 * longest word decides: at 12px on 0.9 tracking `MINUTES` measures about 57 of
 * the 64 units it is given, and that margin is the whole headroom there is.
 * ⚠ THIS IS WHY IT DOES NOT MATCH THE SPLIT ROW'S 15px, which the same ruling
 * raised on the same day. The two look like one decision and are not: that row's
 * labels sit at the edges of a card with a card's width behind them, and these
 * sit in a two-cell box. Raise this to match and the grid breaks.
 */

/**
 * The freeze countdown — `DD:HH:MM` split into three labelled groups.
 *
 * The digits are the header's cells; the DAYS / HOURS / MINUTES captions are
 * this surface's addition, and they are why the split exists at all. In the
 * header the row sits under the wordmark on a page whose whole chrome explains
 * it; a shared image gets one chance to say what the number counts, so the
 * caption is load-bearing rather than decorative.
 *
 * ⚠ PARITY RUNS ACROSS THE GLOBAL DIGIT INDEX, NOT PER GROUP, so the six cells
 * read as one continuous board rather than three little ones — which is what
 * ties them back to the wordmark above. `offset` is that running index, and it
 * is computed from the groups before it rather than assumed to be `2 * g`:
 * `formatCountdown` grows the days field to three digits above 99 days, so the
 * groups are not all the same width and an assumed stride would flip the
 * parity of everything after the colon for the first six weeks of the window.
 */
function Countdown({
	u,
	display,
	hairline,
}: {
	u: (n: number) => number;
	display: string;
	hairline: string;
}) {
	const groups = display.split(":");
	/**
	 * The row, flattened into positional slots — a box, a colon, a box, a colon,
	 * a box — so the whole thing is ONE `map` over ONE array.
	 *
	 * ⚠ FLAT ON PURPOSE. The alternative is a nested map with the colon emitted
	 * conditionally inside it, which needs a fragment per group, and Satori's
	 * child walk is not something to hand fragments to when a flat list costs
	 * nothing.
	 *
	 * ⛔ AND IT IS WHAT ALIGNS THE CAPTIONS. Every slot is a COLUMN — box on top,
	 * caption underneath — and the colon's column simply has an empty caption. So
	 * `DAYS` sits under its own two digits and the colons sit between the boxes
	 * without a caption of their own, by construction rather than by a measured
	 * offset. The previous arrangement reproduced the cell grid by hand and had
	 * to be re-derived every time a size moved.
	 */
	const slots: { digits: string | null; caption: string }[] = [];
	groups.forEach((group, g) => {
		if (g > 0) {
			slots.push({ digits: null, caption: "" });
		}
		slots.push({ digits: group, caption: COUNTDOWN_LABELS[g] ?? "" });
	});

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "flex-end",
				gap: u(6),
			}}
		>
			<span
				style={{
					fontSize: u(13),
					fontWeight: 700,
					letterSpacing: u(1.8),
					lineHeight: 1,
					color: PALETTE.n7,
				}}
			>
				TIME REMAINING
			</span>

			<div style={{ display: "flex", alignItems: "flex-start", gap: u(7) }}>
				{slots.map((slot, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed positional slots — box, colon, box, colon, box.
						key={i}
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: u(5),
						}}
					>
						{slot.digits === null ? (
							<span
								style={{
									display: "flex",
									height: u(CD_CELL),
									alignItems: "center",
									fontFamily: "Geist Mono",
									fontSize: u(20),
									fontWeight: 700,
									color: PALETTE.ink,
								}}
							>
								:
							</span>
						) : (
							<div
								style={{
									display: "flex",
									border: hairline,
									borderRadius: u(6),
								}}
							>
								{slot.digits.split("").map((ch, j) => (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length field — the slot is the identity, not the glyph.
										key={j}
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											width: u(CD_CELL),
											height: u(CD_CELL),
											borderLeft: j === 0 ? "none" : hairline,
											fontFamily: "Geist Mono",
											fontSize: u(20),
											fontWeight: 700,
											color: PALETTE.ink,
										}}
									>
										{ch}
									</div>
								))}
							</div>
						)}
						<span
							style={{
								fontSize: u(12),
								fontWeight: 700,
								letterSpacing: u(0.9),
								lineHeight: 1,
								color: PALETTE.n6,
							}}
						>
							{slot.caption}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

/**
 * The shared two-line split: names on the upper line, figures flanking the bar
 * on the lower one.
 *
 * ONE component for BOTH the post's Support/Counter and the market's YES/NO —
 * the operator's "same alignment" ruling made structural rather than merely
 * matched by hand. `centerLabel` is the only difference between the two call
 * sites (the post prints its staked total there; the market has nothing to put
 * in the middle), which is a fair sign the shape genuinely is shared.
 *
 * ⚠ THE COLOURS ARE THE CALLER'S, AND DELIBERATELY SO. This component knows
 * nothing about YES / NO or Support / Counter; it is handed two colours and a
 * percentage. The pole law therefore lives in exactly one place — the caller,
 * where `compose.ts` has already resolved which SIDE each figure belongs to —
 * and cannot be half-applied by a component that guessed from a label string.
 */
function SplitRow({
	u,
	hairline,
	leftLabel,
	leftValue,
	leftColor,
	centerLabel,
	rightLabel,
	rightValue,
	rightColor,
	barLeftPct,
	neutral = false,
}: {
	u: (n: number) => number;
	hairline: string;
	leftLabel: string;
	leftValue: string;
	leftColor: string;
	centerLabel: string | null;
	rightLabel: string;
	rightValue: string;
	rightColor: string;
	/** The LEFT segment's share of the bar, 0–100 — a display width, never money. */
	barLeftPct: number;
	/**
	 * Nothing has been staked either way — draw an EMPTY track and neutral
	 * figures rather than a bar filled 100% in one side's colour. See
	 * `compose.ts`'s `hasStake`: the percentage alone cannot tell "unargued"
	 * from "wholly countered", and the colour makes guessing wrong expensive.
	 */
	neutral?: boolean;
}) {
	/**
	 * The split row's two flanking NAMES — `SUPPORT` / `COUNTER`, `YES` / `NO`.
	 *
	 * ⚠ 10.5 → 15 — operator ruling, revision 8. They had not moved since the row
	 * was built, while the figures beside them and the total between them were
	 * raised twice; a label two steps below everything it labels stops reading as
	 * part of the row and starts reading as a caption under it.
	 */
	const label: CSSProperties = {
		display: "flex",
		fontSize: u(15),
		fontWeight: 700,
		letterSpacing: u(1.5),
		color: PALETTE.n5,
	};
	/**
	 * The staked total, in the middle of the row — both cards.
	 *
	 * ⚠ ITS OWN SIZE, NOT `label`'s — operator ruling, revision 7. The flanks are
	 * NAMES (`SUPPORT` / `COUNTER`, `YES` / `NO`) and the middle is a FIGURE, and
	 * a row that sets all three identically asks the reader to work out which of
	 * the three is the number. It already parted company with them on colour when
	 * it went to ink; this is the same decision finished.
	 *
	 * ⚠ TRACKING SCALES WITH THE TYPE, and the two move together every time this
	 * is retuned — it has been raised twice already. Kept at `label`'s own ratio:
	 * leave the tracking where it was and the letters sit tighter relative to
	 * their size than the labels beside them, which reads as a different typeface
	 * rather than as a larger one.
	 */
	const centreLabel: CSSProperties = {
		...label,
		fontSize: u(18),
		letterSpacing: u(2),
		color: PALETTE.ink,
	};
	const figure: CSSProperties = {
		display: "flex",
		flexShrink: 0,
		fontSize: u(24),
		fontWeight: 700,
		lineHeight: 1,
	};
	const leftInk = neutral ? PALETTE.n4 : leftColor;
	const rightInk = neutral ? PALETTE.n4 : rightColor;
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: u(7),
				// The card's remaining slack collects ABOVE this row, so both cards
				// seat their split on the same baseline however tall their content is.
				marginTop: "auto",
			}}
		>
			{/* ⛔⛔ THREE SLOTS, NOT `space-between` — operator ruling, revision 8:
			    put the total in its PROPER position. `space-between` pushes the two
			    names to the edges and drops the middle item wherever the leftover
			    space happens to leave it, so the total's centre lands on the row's
			    centre only when the two names are exactly as wide as each other.
			    They never are: `SUPPORT`/`COUNTER` differ by a letter and `YES`/`NO`
			    by two, so `Đ 50 STAKED` sat off-centre on one card and
			    `Đ 48,200 STAKED` sat off-centre by a different amount on the other —
			    two cards, two different wrongnesses, which is why it read as a
			    mistake rather than as a choice.

			    ⇒ Both flanks `flexGrow: 1` from a zero basis and the total shrinks
			    for neither, so the total sits on the card's centre line whatever the
			    names or the figure happen to measure. This is the band's own
			    arrangement — the same reason the wordmark stays centred between a
			    pseudonym and a countdown of any length. */}
			<div style={{ display: "flex", alignItems: "baseline" }}>
				<div
					style={{
						display: "flex",
						flexGrow: 1,
						flexBasis: 0,
						minWidth: 0,
					}}
				>
					<span style={label}>{leftLabel}</span>
				</div>
				{/* ⚠ INK AND LARGER — revisions 6 and 7 of the same complaint. The
				    staked total was set two steps down the ramp from the names flanking
				    it, which made the one FIGURE in the row quieter than the two words
				    labelling it. It now differs from them in both colour and size,
				    which is what makes "this is the number" readable at a glance
				    instead of inferable from the Đ. */}
				{centerLabel !== null && (
					<span style={{ ...centreLabel, flexShrink: 0 }}>{centerLabel}</span>
				)}
				<div
					style={{
						display: "flex",
						flexGrow: 1,
						flexBasis: 0,
						minWidth: 0,
						justifyContent: "flex-end",
					}}
				>
					<span style={label}>{rightLabel}</span>
				</div>
			</div>
			<div style={{ display: "flex", alignItems: "center", gap: u(12) }}>
				<span style={{ ...figure, color: leftInk }}>{leftValue}</span>
				{/* ⛔⛔ `flexBasis: 0` AND `minWidth: 0` ARE THE BUG FIX, NOT TIDYING.
				    With the default `flexBasis: auto` this track's base size is its
				    CONTENT's size, and its content is a fill declared `width: <pct>%`.
				    A percentage against a parent that is still being measured resolves
				    in Yoga against the AVAILABLE width, so at 100% the track measured
				    as the whole row before it grew — and then grew again. The figure on
				    the right is `flexShrink: 0` (it must be: a clipped Đ amount is a
				    wrong number, not a short one), so it had nowhere to go and was
				    pushed off the card entirely.
				    ⚠ THE FAILURE IS DATA-DEPENDENT, WHICH IS WHY IT SHIPPED: it needs a
				    post whose reply-bets are ALL on one side — 0% or 100% — and every
				    fixture and every staged post until now sat somewhere in between or
				    at zero stake (the `neutral` branch, which draws no fill at all).
				    The first real one-sided post on staging is what surfaced it.
				    ⇒ Base the track at zero and let `flexGrow` alone size it, which is
				    what the row always meant. */}
				<div
					style={{
						display: "flex",
						flexGrow: 1,
						flexBasis: 0,
						minWidth: 0,
						height: u(16),
						borderRadius: u(8),
						border: hairline,
						overflow: "hidden",
						backgroundColor: neutral ? PALETTE.n1 : rightColor,
					}}
				>
					<div
						style={{
							display: "flex",
							width: neutral ? "0%" : `${barLeftPct}%`,
							height: "100%",
							backgroundColor: leftColor,
						}}
					/>
				</div>
				<span style={{ ...figure, color: rightInk }}>{rightValue}</span>
			</div>
		</div>
	);
}
