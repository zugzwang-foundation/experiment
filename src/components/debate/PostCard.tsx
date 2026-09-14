"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { AggregateFooter } from "./AggregateFooter";
import { ArgProfile } from "./ArgProfile";
import { SideBadge } from "./badges";
import { CommentImage } from "./CommentImage";
import { hasExtendedText } from "./composer/payload";
import { KnowMore } from "./KnowMore";
import { RemovedPlaceholder } from "./placeholders";
import { QuoteWell } from "./quote-well/QuoteWell";
import type { DebatePost, PresentPost, Side } from "./types";

/**
 * One post in a side column's post-scroller (DEBATE.4 §4). A PRESENT post shows
 * the argprofile · lane badge · title (enters post-focus) · image · a
 * `+` glyph opening the full body in a pop-up · the aggregate footer. The
 * TITLE enters post-focus (row 23); the `+` reads in place (row 24).
 *
 * ⛔ THE TEASER AND THE TWO-SLOT REPLY PREVIEW LEFT THIS CARD at HTML-FINISH ·
 * MARKET DETAIL row 25, under the SPEC.1 1.0.31 amendment (§9 preamble,
 * F-DEBATE-1 System + Acceptance, and the two §17 rows). The card presents ONE
 * ARGUMENT; it does not present replies to it. Reply content surfaces on
 * entering post-focus, whose full stake-sorted per-side list IS the expansion §9
 * names — so the expansion is discharged by entering the post, not by an in-card
 * control. ⚠ THE SELECTION RULE IS UNTOUCHED: `ReplyGroups.twoSlot` is still on
 * the read model and `src/lib/ranking`'s `rankReplies`/`twoSlot` are unchanged.
 * Rendering replies at both zoom levels duplicated the same content twice.
 * ⛔ The disabled `Đ BET` and
 * `Support / Counter` write triggers were REMOVED at POLISH.3 PR 2 rows 1-2
 * (`PD-0-02`, R1) — redundancy plus the thesis ground that argument should be
 * deliberate, not reflexive. A REMOVED post
 * keeps only its structural slot — frozen side badge + the "removed by
 * moderator" placeholder + aggregate + its surviving replies (§6). The post's
 * body/author/marker/badge are absent at the type level on the removed variant,
 * so this component cannot render them.
 */
/**
 * MOBILE-2m · R-1 / ADR-0051 A9 D-1 — the three declarations that take the box
 * off the feed card below `--breakpoint-mobile`, in one place so the present and
 * the removed branch cannot drift into two answers.
 *
 * ⛔ `[border:none]` RATHER THAN `border-0`, for the reason `CommentImage.tsx`
 * already records on its own phone arm: `Card`'s edge is the SHORTHAND
 * `[border:var(--hairline)]`, and `border-0` sets `border-width` alone — the
 * shorthand's colour and style survive it. Only a shorthand overrides a
 * shorthand.
 *
 * ⛔⛔ AND THE ELEVATION GOES WITH THE BORDER, WHICH IS THE ORPHAN THIS CHANGE
 * CREATES RATHER THAN SCOPE CREEP. `--elev-1` is `inset 0 1px 0 rgb(255 255 255
 * / 0.04), 0 1px 2px rgb(0 0 0 / 0.4)` — an INSET top-light, i.e. a one-pixel
 * pale line drawn across the top of the card. On a boxed card that line reads as
 * the lit edge of a raised surface. On a full-bleed card it is a second
 * horizontal rule a pixel below the hairline that separates the posts, and A9
 * D-1 says posts are separated by ONE hairline. Leaving it would ship two.
 *
 * ⚠ "band" IN THAT SENTENCE MEANT THE CARD RUNNING EDGE TO EDGE, NOT THE FOOTER.
 * Worth saying because the word moved: A9 D-1 also gave the Support/Counter
 * footer a lighter ground, and ADR-0051 A10 D-3 has since taken it away. The
 * `band` prop passed below still exists and still means "this is the unboxed
 * feed card" — see `AggregateFooter`'s own note on it.
 *
 * ⚠ THE CARD KEEPS ITS `p-3`, AND THAT IS WHAT "the tier's horizontal padding
 * only" RESOLVES TO. The feed column drops its own `px-3` (see
 * `PhoneDebateView`'s `feedPane`), so 24px of doubled inset becomes 12px carried
 * by the card alone: the content box widens by exactly 24px and the card's own
 * edges reach the screen — which is what lets the hairline beneath it be full
 * width with no negative margin anywhere.
 */
const UNBOXED_CARD =
	"max-mobile:[border:none] max-mobile:rounded-none max-mobile:shadow-none";

export function PostCard({
	post,
	onEnter,
	onOpenPopup,
	onOpenImage,
	onReplyToPost,
	heldSide,
	marketOpen,
	suspended,
	unboxed = false,
}: {
	post: DebatePost;
	onEnter: (id: string) => void;
	onOpenPopup: (post: PresentPost) => void;
	onOpenImage: (url: string) => void;
	/**
	 * HTML-FINISH · MARKET DETAIL row 22 — the card's Support/Counter trigger
	 * pills. ⚠ It ENTERS THE POST and opens the relation there; it does NOT open
	 * a composer on the card. That is what honours `R1`'s thesis ground while
	 * restoring the mockup's affordance: the reader still lands on the argument
	 * before writing about it.
	 */
	onReplyToPost: (id: string, relation: "support" | "counter") => void;
	/** Viewer state the pills need to apply the F-3 gate. Never optional — a
	 * trigger without its gate invites a bet the viewer cannot place. */
	heldSide: Side | null;
	marketOpen: boolean;
	suspended: boolean;
	/**
	 * ⛔⛔ MOBILE-2m · R-1 / ADR-0051 A9 D-1 — THE CARD LOSES ITS BOX BELOW 640,
	 * AND IT IS A PROP RATHER THAN A `max-mobile:` TOKEN WRITTEN STRAIGHT ONTO
	 * THE CARD, BECAUSE THIS COMPONENT HAS TWO PHONE MOUNTS AND ONLY ONE OF THEM
	 * IS RULED. `PhoneDebateView` renders it in the FEED (`feedPane`) and again
	 * inside the PARENT-POST SHEET. A9 D-1 rules the feed: content to the screen
	 * edge, no border, no radius, posts separated by a hairline. A sheet is a box
	 * by definition — backdrop, handle, close control — so a card that unboxed
	 * itself there would dissolve into the sheet's own ground and lose the one
	 * edge that says where the argument stops.
	 *
	 * ⚠ THE `= false` DEFAULT IS THE POLARITY `GlobalHeader`'s `mobileResponsive`
	 * ALREADY SHIPS (AGENTS.md §8): a mount that says nothing keeps the box. Every
	 * desktop mount, the sheet, and any future third mount are safe by omission,
	 * and unboxing is something a caller has to ASK for.
	 *
	 * ⛔ IT REACHES NOTHING AT OR ABOVE 640px. Every token it switches on is
	 * `max-mobile:`-prefixed, so the desktop render is byte-identical whichever
	 * way this is passed — which makes B1-p's zero diff a property of the
	 * construction rather than a thing to re-measure each round.
	 */
	unboxed?: boolean;
}) {
	const triggers = {
		heldSide,
		marketOpen,
		suspended,
		onReply: (relation: "support" | "counter") =>
			onReplyToPost(post.id, relation),
	};
	const replyCount = post.aggregate.supportCount + post.aggregate.counterCount;
	// UI-OVERNIGHT entry 5 — `Know more` only where there IS more. On a
	// title-only argument the control opened a pop-up showing the reader the
	// same sentence back; see `hasExtendedText` for the rule and its reason.
	const knowMore = post.removed ? false : hasExtendedText(post.body);

	if (post.removed) {
		return (
			<Card className={cn("gap-2 p-3", unboxed && UNBOXED_CARD)}>
				<SideBadge side={post.sideAtPostTime} />
				<RemovedPlaceholder />
				{/* The removed variant keeps its frozen side (§6 — thread integrity),
				    so the split bar stays correctly poled on a removed post too. */}
				{/* ⚠ The removed branch gets the triggers too: replying to a removed
				    argument is LEGAL (§6 edge) and its surviving replies are live —
				    `ReplySplitBar` renders on the removed variant for the same
				    reason. Withholding them here would silently retire a legal
				    action. */}
				<AggregateFooter
					aggregate={post.aggregate}
					postSide={post.sideAtPostTime}
					triggers={triggers}
					band={unboxed}
				/>
				{/* ⚠ A removed POST STILL KEEPS ITS SURVIVING REPLIES (§6 — thread
				    integrity), and row 25 does not touch that: what changed is only
				    WHERE they surface. They are reached through `Open debate →`
				    below, which the removed branch KEEPS for exactly this reason
				    (plan F-3) — deleting it here would strand a removed post and its
				    live replies behind no path at all, since `page.tsx`'s `?post=`
				    falls back silently for a removed target. */}
				<Button
					variant="ghost"
					size="xs"
					className="self-start"
					onClick={() => onEnter(post.id)}
				>
					Open debate →
				</Button>
			</Card>
		);
	}

	return (
		/* `.panel{flex:1 1 auto;min-height:0}` (`d5:572`) — the card FILLS its
		   column, which is what gives `.argimg` below a height to take a share of.
		   Without it the card is content-sized, `.argimg`'s `flex-1` has nothing to
		   distribute, and the image falls back to its intrinsic size. */
		<Card className={cn("min-h-0 flex-1 gap-2.5 p-3", unboxed && UNBOXED_CARD)}>
			{/* ⚠⚠ UI-OVERNIGHT entry 1b — THE BADGE IS NO LONGER A CORNER SIBLING,
			    and the wrapper that positioned it goes with it. `ArgProfile` renders
			    the lane badge inside its own row now, beside the age, because that
			    is where it stopped costing the row a line: pinned to this corner it
			    took width off the identity line and pushed the timestamp under it.
			    ⛔ The `justify-between` row had exactly two children and one of them
			    has moved, so a one-child flex wrapper is left over. It is deleted
			    rather than kept — `ArgProfile` is already `w-full`, so the wrapper
			    was doing nothing the component does not do itself. */}
			<ArgProfile
				author={post.author}
				side={post.sideAtPostTime}
				marker={post.marker}
				entryPrice={post.entryPrice}
				authorStake={post.authorStake}
				originalStake={post.authorStakeOriginal}
				sold={post.authorSold}
				replyCount={replyCount}
				createdAt={post.createdAt}
				badge={post.badge}
				download={{ ordinal: post.ordinal }}
			/>

			{/* HTML-FINISH · MARKET DETAIL rows 23 + 24 — d5's `.rtitle.plust`
			    (`:1077`): the TITLE enters post-focus (`onclick="enterPost(…)"`) and
			    a `+` glyph beside it opens the pop-up (`onclick="openPostPop(…)"`).
			    One row, two destinations — read the whole argument in place, or go
			    to its debate. The title used to open the pop-up; that is now the
			    `+`'s job alone. */}
			{/* ⛔⛔ QUOTE-1 C — THE PLAIN TITLE ROW IS THE IMAGE ARM'S ROW NOW
			    (founder-ruled 2026-09-11, design-canon `C-QUOTE-1` clause 2, SPEC.1
			    2.0.2). On an imageless post the title is no longer text above an empty
			    cell — it IS the picture in the cell, so rendering both would put the
			    same sentence on the card twice.
			    ⚠ THE CONDITION IS `post.imageUrl`, THE SAME ONE THE CELL BELOW READS,
			    and deliberately not a second predicate: two tests for "does this post
			    have an attachment" is how a card ends up with a title row and a well at
			    once, or with neither.
			    ⚠⚠ AND IT COSTS AN IMAGELESS CARD ITS PRIMARY NAVIGATION, which is
			    recorded rather than hidden. This button is the only thing on the present
			    branch that calls `onEnter` — row 23 deleted `Open debate →` from this
			    arm BECAUSE the title carried that destination. What remains on an
			    imageless card is `AggregateFooter`'s Support/Counter pills, which enter
			    the post and are themselves gated on `marketOpen`/`suspended`. ⇒ THE WELL
			    INHERITS THE HANDLER rather than the row keeping it — see the button at the
			    cell below, which records why that is preservation and not a new
			    affordance. Flagged for the founder either way.
			    ⚠ THE REMOVED BRANCH IS UNTOUCHED — it returns above and has no title at
			    the type level. */}
			{post.imageUrl ? (
				<div className="relative">
					{/* HTML-FINISH · MARKET DETAIL round 2 · R6 — THE TITLE ANSWERS THE
				    POINTER. It is the card's primary navigation (it enters post-focus)
				    and it carried NO hover state at all, so the one control on the card
				    that takes you somewhere looked like static text.
				    ⛔ BOTH CLASSES ARE SHIPPED, NEITHER IS A MOCKUP VALUE.
				    · `hover:bg-n1` is the HIGHLIGHT, byte-carried from the Profile
				      surface — `profile/PositionsTable.tsx:672` (the selectable row)
				      and `:984` (the option button) both already use exactly it.
				    · `hover:underline` is the UNDERLINE, byte-carried from the Profile
				      argument title — `profile/ArgumentList.tsx:171` and `:473`, which
				      is the same thing this element is: a title that navigates.
				    · `rounded-(--r-chip)` is the build's own chip radius token, so the
				      highlight has the corner every other soft-cornered surface here
				      has.
				    ⚠ d5 AGREES ON THE HIGHLIGHT AND IS NOT THE SOURCE OF IT. `.rtt`
				    hovers to `background:var(--n1)` (`d5:839-840`) — the SAME token
				    index-wise: d5's `.rtt` sits on a white `--n0` and lifts one step to
				    a light `--n1`; this sits on `--color-n0` #212121 and lifts one step
				    to `--color-n1` #2a2a2a. Same relation, inverted ramp. ⛔ Its
				    `border-radius:4px`, `padding:0 3px` and `margin:0 -3px` are VALUES
				    and are NOT taken — which is also why no padding is added here: the
				    highlight hugs the text block and NOTHING in the card's layout
				    moves. d5 does not underline at all; that half is the founder's, via
				    the Profile pattern.
				    ⚠ NO `aria-label` IS ADDED. The visible text IS the accessible name,
				    and an override would have to contain it to satisfy WCAG 2.5.3. */}
					{/* ⚠⚠ THE TITLE IS A BLOCK SPANNING THE CARD — `.rtitle` (`d5:841`)
				    is a block, and `.plust{position:relative;padding-right:19px}`
				    (`:597`) reserves a gutter for the `+` OVERLAID on it rather than
				    a flex sibling that steals width. Measured at the pinned
				    1440×777: d5's title box is 628px (43.6% of viewport) and the
				    shrink-to-fit button was 104px (5.8%) — the widest single delta
				    in the phase-1 table, and it also made the card's primary
				    navigation a click target the width of its text rather than its
				    row. `pr-5` is d5's 19px gutter at the nearest scale step.
				    ⚠ `line-clamp-2` is `.rtitle`'s own `-webkit-line-clamp:2`
				    (`:842`). On a one-screen page an unclamped title is what pushes
				    the card past its column; the full argument stays one click away
				    on the `+`, and the column scrolls as the backstop. */}
					<button
						type="button"
						// ⚠ UI-OVERNIGHT entry 5 — THE GUTTER IS RESERVED ONLY WHEN THERE IS
						// SOMETHING TO RESERVE IT FOR. `pr-21` keeps the title clear of the
						// OVERLAID `Know more`; with no control there it was 84px taken off
						// every title-only card for a neighbour that never arrives. The title's
						// LEFT edge does not move either way, so a card with the control and a
						// card without differ by the control alone.
						className={`block w-full rounded-(--r-chip) text-left hover:bg-n1 hover:underline${
							knowMore ? " pr-21" : ""
						}`}
						onClick={() => onEnter(post.id)}
					>
						<h3 className="line-clamp-2 font-heading text-base leading-snug font-medium">
							{post.title}
						</h3>
					</button>
					{/* ⚠⚠ UI-QUICK change set 1 items 4 + 5 — THE `+` BECOMES `Know more`
				    AND GAINS A NEIGHBOUR. The two controls are one right-aligned row in
				    the gutter the title reserves, download on the LEFT.
				    ⚠ THE BEHAVIOUR IS UNCHANGED — this is a label swap. The `+` opened
				    the full body in a pop-up (`onOpenPopup`), and `Know more` opens the
				    same pop-up through the same handler. Nothing about what the control
				    DOES moved; only what it says it does.
				    ⚠⚠ AND THE WCAG ARGUMENT INVERTS BACK. The superseded block read:
				    "With a glyph there IS no visible label, so 2.5.3 does not apply and
				    an `aria-label` becomes REQUIRED rather than forbidden … the label is
				    BYTE-CARRIED from the mockup's own control (`d5:1077`,
				    `aria-label="Show more"`)." That was correct FOR A GLYPH. A control
				    with visible text `Know more` and an accessible name `Show more`
				    fails WCAG 2.5.3 (Label in Name) outright — the name must CONTAIN
				    the visible string. So `Show more` cannot survive the relabel, and
				    the name becomes one that extends `Know more`. See `KnowMore.tsx`,
				    which is where that rule now lives for both mounts.
				    ⛔ THE GUTTER WIDENS FROM `pr-5` TO `pr-28`, and it has to. `pr-5`
				    is d5's 19px reservation for a ONE-GLYPH control; a text button plus
				    an icon needs ~100px, and at 19px the title would run underneath
				    them. ⚠ The title stays a BLOCK with the cluster OVERLAID — making
				    it a flex sibling would reproduce the measured defect row 24 fixed
				    (title 628px → 104px, the widest delta in the phase-1 table). The
				    gutter grows; the mechanism does not change. */}
					{knowMore ? (
						<KnowMore
							label="Know more about this argument"
							onClick={() => onOpenPopup(post)}
							className="absolute right-0 bottom-0"
						/>
					) : null}{" "}
				</div>
			) : null}
			{/* ⛔⛔ QUOTE-1 C — THE EMPTY ARM DRAWS THE WELL (founder-ruled
			    2026-09-11, design-canon `C-QUOTE-1`, SPEC.1 2.0.2). ⚠ THIS COMMENT SAID
			    "THE EMPTY ARM DRAWS NOTHING AGAIN" and it is corrected here rather than
			    appended to, because a docblock that describes the superseded branch at
			    the site of the live one is read before any amendment note (`O-5`).
			    The history it recorded is still the reason this slot has a history: R2
			    substituted d5's `POST IMAGE` mockup box (`d5:1682`) onto every card with
			    no real attachment, and QUOTE-1 A (PR #513) stripped it back to `null`.
			    The docket's kind-2 row offered STRIP or GATE; this is neither — it is the
			    permanent exit, and what stands here is the post's own title rather than a
			    picture of the words "POST IMAGE".
			    ⚠ THE CELL STAYS, and now for two reasons rather than one. It is still the
			    card's absorber (`ReplyCard` copies it for exactly that) — deleting it on
			    the empty path would unpin `AggregateFooter` from the card's foot — and it
			    is now also what gives the well a definite height to scale against.
			    ⛔ THE REMOVED BRANCH STILL GETS NOTHING, and that is the load-bearing
			    half of this slot, not a leftover. A removed post's union variant carries
			    no `imageUrl` AND no `title`, so it cannot reach either arm — but it
			    returns early above, and an early return is exactly the shape that stops
			    the type system helping: nothing about an `else` requires a field. A well
			    beside a withheld argument would publish its title, which is the masked
			    content itself — a strictly worse leak than the placeholder Phase A reasoned
			    about, which only IMPLIED an attachment existed. So this is `SC-1` at the
			    render, and `quote-well.test.tsx` is where it is asserted, on the absence of
			    the TITLE STRING rather than of a testid. ⚠ NOT `comment-image.test.tsx`,
			    despite that file's docblock forecasting this phase: it names the
			    placeholder's testid and the string `POST IMAGE`, and a well carries
			    neither — mounting one here leaves every test in that file GREEN, which was
			    measured rather than assumed. */}
			{/* ⚠⚠ `.argimg` (`d5:648`) — THE CELL, and the founder's measured defect.
			    `flex:1 1 auto;min-height:0;display:flex;align-items:center;
			    justify-content:center`: the attachment takes the card's whole
			    leftover height and sits CENTRED in it. Measured in the mockup — the
			    image is 73% of the card's height and horizontally centred; measured
			    on staging at `5349ae9` — 160 × 90, flush left, because there was no
			    cell at all and the image carried a 160px cap.
			    ⛔ THE CELL IS WHERE THE HEIGHT LIVES, not the image. `max-h-full` on
			    an `<img>` is a percentage and resolves to `none` without a definite
			    height above it; this node is the flex item that has one, which is why
			    `Card` and the scroller wrapper gained `flex-1 min-h-0` in the same
			    commit. Break any of those three and the image silently reverts to
			    intrinsic size — the exact failure mode being fixed. */}
			<div className="flex min-h-0 flex-1 items-center justify-center">
				{post.imageUrl ? (
					<CommentImage url={post.imageUrl} onOpen={onOpenImage} fill />
				) : (
					/* ⚠⚠ `h-full`, NOT `max-h-full`, AND THE DIFFERENCE IS WHETHER THE WELL
					   SCALES AT ALL. The `<svg>`'s own `max-h-full` is a PERCENTAGE, and a
					   percentage max-height resolves to `none` unless an ancestor has a
					   DEFINITE height — the exact failure the cell's own docblock above
					   records for `<img>`. The cell has a definite height (it is `flex-1` in
					   a stretched column); this stack takes it with `h-full`, and the row
					   below takes a share of THAT with `flex-1 min-h-0`, and the button takes
					   that with `h-full`. ⚠ BREAK A LINK AND THE WELL STOPS SCALING — it does
					   NOT "render at its intrinsic 545 × 272 and overflow", which is what this
					   sentence claimed until `@code-reviewer` measured it: `w-auto` resolves to
					   100% of the parent, so a broken chain gives 532 × 265.5 and overflows
					   nothing. The real cost is that a SHORT cell stops shrinking it. It is the
					   attachment's own mechanism, one level deeper: `CommentImage`'s
					   `max-h-full` sits under the cell, the well's sits under cell → stack →
					   row → button.
					   ⚠ `items-end` RIGHT-ALIGNS `Know more` TO THE WELL'S EDGE (canon clause
					   2), which holds while the well is at its full 545 width. Under
					   VERTICAL compression the well scales down and its right edge moves in
					   while this stack's does not, so the control aligns to the stack rather
					   than to the picture. Measured in the QUOTE-1 C report §4; recorded
					   because a shrink-to-fit width cannot depend on a height-driven shrink,
					   so closing it is a composition decision and not an edit.
					   ⛔ `Know more` IS `shrink-0`: when the stack is too short for both, the
					   WELL yields (it is the flexible item) and the control never clips. That
					   is the priority the canon sets — a picture that scales beside a control
					   that does not. */
					<div className="qstack flex h-full w-full max-w-[545px] min-h-0 flex-col items-end">
						{/* ⚠⚠ THE WELL IS THE TITLE, SO IT CARRIES THE TITLE'S DESTINATION —
						    `onEnter`, the same handler on the same post, lifted off the row
						    above rather than invented here. Canon clause 2 says the well IS the
						    title "in the heading element the title row used"; the element and
						    its job are the same kind of preservation, and dropping the job
						    would leave an imageless card with NO path into its own debate:
						    row 23 deleted `Open debate →` from this branch precisely BECAUSE
						    the title carried that destination, and the only survivor is the
						    footer's Support/Counter pills, themselves gated on
						    `marketOpen`/`suspended`. ⛔ THE PRE-EXISTING SUITE IS WHAT ARBITRATES
						    THIS, not a preference: every test in `post-arm-headers`,
						    `history-ladder` and `posted-jump` that enters a post by clicking the
						    heading's enclosing button goes green on this reading and red on the
						    other — 22 failing tests, 15 / 6 / 1 by file, reproducible by
						    reverting this button. Flagged in the QUOTE-1 C report §7 as a
						    founder call.
						    ⚠ NO HOVER PAINT, deliberately. The row's `hover:bg-n1
						    hover:underline` (round 2 · R6) are a TEXT treatment — an underline
						    under a picture means nothing and a highlight behind a filled box is
						    invisible. Choosing a hover state for a picture is a design decision
						    and is not this phase's to take, so the button ships with the
						    pointer cursor it gets for free and the gap is recorded.
						    ⛔⛔ `aria-label={post.title}` IS REQUIRED HERE AND IS NOT REQUIRED ON
						    THE ROW ABOVE, AND THE DIFFERENCE IS THE SVG. This block first said the
						    `<h3>` inside is the accessible name "exactly as on the row above" —
						    measured false by `@code-reviewer` against Chrome's accessibility tree:
						    name-from-contents does NOT traverse `foreignObject`, so `button > svg >
						    foreignObject > h3` computes a name of `""` while the plain
						    `button > h3` computes `FIXTURE ARGUMENT TITLE.`. Controls in the same
						    run isolate the cause: dropping `role="presentation"` or setting
						    `role="img"` changes nothing, and an `aria-label` fixes it — it is the
						    SVG boundary, not the role and not the heading. ⇒ Unnamed `button`,
						    WCAG 4.1.2 (A), on what is the ONLY `onEnter` control an imageless card
						    has. ⚠ WCAG 2.5.3 is satisfied BECAUSE the label is the title verbatim:
						    the accessible name must CONTAIN the visible text, and here it IS the
						    visible text. The `<h3>` is still exposed as a heading, so heading
						    navigation was never broken — only the control was. The sibling arm
						    already does this: `CommentImage`'s button carries
						    `aria-label="Open attached image"`.
						    ⛔ AND THE BUTTON IS `CommentImage`'s CLASS SET, BYTE FOR BYTE, which
						    is why it sits in a row of its own. As `w-full flex-1` it was a
						    532 x 520 target around a 532 x 265 picture — half the navigating area
						    empty, and unlike the image arm, whose button shrink-fits its width.
						    `flex h-full max-w-full items-center justify-center` is the ratified
						    precedent and keeps the height chain intact: the ROW carries `flex-1
						    min-h-0`, the button takes that height with `h-full`, and the svg's
						    percentage `max-h-full` finally has something definite to resolve
						    against. Also found by `@code-reviewer`.
						    ⛔ IT IS ALSO THE FLEX LINK THE WELL SCALES AGAINST — `flex-1
						    min-h-0` is what gives the `<svg>`'s percentage `max-h-full` a
						    definite height to resolve against. Wrapping it in a plain `<div>`
						    and leaving the button outside would add a level with no height and
						    the well would silently stop scaling. */}
						<div className="flex min-h-0 w-full flex-1 items-center justify-center">
							<button
								type="button"
								aria-label={post.title}
								className="flex h-full max-w-full items-center justify-center"
								onClick={() => onEnter(post.id)}
							>
								<QuoteWell title={post.title} />
							</button>
						</div>
						{knowMore ? (
							<KnowMore
								label="Know more about this argument"
								onClick={() => onOpenPopup(post)}
								className="mt-2 shrink-0"
							/>
						) : null}
					</div>
				)}
			</div>

			{/* Row 23 — `Open debate` is GONE from the present branch: the title
			    above carries that destination now, and two controls for one
			    navigation is the redundancy this row removes. ⛔ The REMOVED branch
			    KEEPS it (plan F-3) — a removed post has no title to click, and
			    `page.tsx` falls back silently for a removed `?post=` target, so
			    deleting it there would leave a removed post and every surviving
			    reply under it reachable by no path at all. */}
			<AggregateFooter
				aggregate={post.aggregate}
				postSide={post.sideAtPostTime}
				triggers={triggers}
				band={unboxed}
			/>
		</Card>
	);
}
