import Link from "next/link";

import { PositionMarker, SideBadge } from "@/components/debate/badges";
import {
	computeSplitBar,
	displaySplitTotal,
} from "@/components/debate/composer/split-bar";
import { formatDharma } from "@/components/debate/format";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyBlock } from "@/components/ui/empty-block";
import type {
	ProfileArgumentAggregate,
	ProfileArgumentItem,
} from "@/server/profile/arguments";
import type { ProfileUser } from "@/server/profile/resolve";

import { ArgumentBody } from "./ArgumentBody";
import { PROFILE_COPY } from "./copy";
import { DownloadStub } from "./DownloadStub";
import type { ProfileSelection } from "./selection";

/**
 * The `.vsep` upright separator between the head cluster's parts (mockup
 * `:324`, emitted at `:624-627`). Canon §3 item 11 writes the head with them:
 * "avatar · name | SIDE @ entry% | stake …".
 *
 * ⛔ THE GLYPH IS BYTE-CARRIED, NOT TYPED — `0x7C`, U+007C VERTICAL LINE, plain
 * ASCII, the same byte `HeroPanels.tsx:156-158` records for the identical role.
 *
 * ⚠ THE COLOUR COMES FROM SHIPPED CODE, NEVER FROM THE MOCKUP. `text-n3` is
 * `HeroPanels.tsx:173`'s and `StatLine.tsx`'s value for this exact separator;
 * the mockup's `.vsep{color:var(--n3)}` is NOT the source, because the ramps are
 * inverted between the light prototype and the shipped dark system.
 *
 * ⚠ ATTRIBUTED DUPLICATION, ROUTED NOT ABSORBED. `HeroPanels.tsx` has a private
 * `HeadSeparator` with this exact body. It is not exported, `discovery/**` is
 * read-only in this task, and `ui/**` mints no new primitive here — so the
 * third occurrence would be the moment to lift it. Filed as a widening rather
 * than done in passing (AGENTS.md §7 uses the same posture for the envelope
 * helpers' bets-private copies).
 */
function HeadSeparator() {
	return <span className="shrink-0 text-n3">|</span>;
}

/**
 * The profile argument list (SPEC.1 §23) — the user's posts and replies in
 * RANKING.md §3.6 order (server-provided; viewer-independent). Each card is the
 * D5-synced replica: side chip · title (the §9 deep-link target) · marker ·
 * Support/Counter footer (posts); a reply carries the "Replied to …" context. A
 * `content_removed` item renders the stub — the removed union variant carries
 * NO title/body/marker, so no content can leak here. Empty → the OQ-7 copy
 * (owner/visitor).
 */
export function ArgumentList({
	items,
	owner,
	author,
	selection = null,
}: {
	items: ProfileArgumentItem[];
	owner: boolean;
	/**
	 * HTML-FINISH row 4 — the head cluster's avatar + pseudonym. Every argument
	 * on this surface is authored by the PROFILE USER (that is what the list is),
	 * so the identity is the page's own `profileUser` prop-passed down, NOT a
	 * per-item field and NOT a new server read: `loadProfileArguments` is
	 * untouched by this row.
	 * ⚠ REQUIRED, deliberately (O-1 — structural beats procedural). An optional
	 * author would render the cluster on some call sites and silently omit it on
	 * others; a missing required prop is a compile error.
	 */
	author: ProfileUser;
	/**
	 * ROUND 4 item 7 — the picked positions row, or `null` for the full list.
	 * ⚠ THE LIST IS THE EMPTY STATE, which is why this defaults to `null` and
	 * why the filtered branch sits BELOW the list's own empty check: with nothing
	 * picked this component is byte-for-byte what it was.
	 */
	selection?: ProfileSelection | null;
}): React.JSX.Element {
	// Item 8 (P5-D11) — the empty adopts W2.11 P1 at ONE message tier (D3(a)).
	// The testid moves onto the leaf's MESSAGE NODE, so a `textContent` read
	// still returns exactly this string; no `sub` is passed on this surface.
	if (items.length === 0) {
		return (
			<ArgumentsPanel title="Arguments">
				<EmptyBlock
					message={
						owner
							? PROFILE_COPY.empty.argumentsOwner
							: PROFILE_COPY.empty.argumentsVisitor
					}
					messageTestId="arguments-empty"
				/>
			</ArgumentsPanel>
		);
	}

	// ⚠⚠ ROUND 4 item 7 — THE PANEL FILTERS, IT DOES NOT REPLACE. A picked
	// positions row narrows this panel to THAT argument, rendered as the mockup's
	// replica card, under the row's MARKET QUESTION as the header (mockup `:477`,
	// written by `renderReplica` at `:650`).
	// ⚠⚠ PROFILE REFINEMENT · R3 — "DESELECT RETURNS THE FULL LIST" NO LONGER
	// HOLDS, and the sentence is corrected here rather than left to mislead. The
	// positions table now always holds a selection (its first visible row by
	// default), so this panel's filtered arm is the DEFAULT arm and deselect has
	// been retired for want of a destination — see `PositionsTable`'s `pick`.
	// ⛔ THE FULL-LIST ARM IS NOT DEAD CODE. It still renders whenever there is no
	// selection to pass — a filter that yields zero rows, an empty positions set,
	// and every call site that passes no `selection` at all (which is what the
	// render suites do). It stopped being the DEFAULT; it did not stop existing.
	// ⇒ WHY A FILTER, one line: SPEC.1 §16.3 D8 and §17 name the §23 argument
	// list as where a complete record lives, and `positions.ts:151-158` drops
	// fully-exited markets from the table — so this list holds arguments the
	// table can never reach. A filter hides; a replacement would delete. It is
	// the same class of viewer-local narrowing as the market and Open/Closed
	// filters already on the table, so no spec change is owed.
	// ⛔ NO PERCENTAGE IN THE HEADER. The mockup's colhead carries a live side
	// price beside the title (`:652-653`); the founder ruled it out, and it is a
	// LIVE VALUE this page does not hold — `priceAtBet` is the FROZEN entry
	// price, a different quantity, and substituting it would print a number that
	// is wrong rather than missing.
	if (selection !== null) {
		const picked =
			selection.commentId === null
				? undefined
				: items.find((i) => i.id === selection.commentId);
		return (
			<ArgumentsPanel title={selection.marketTitle}>
				{picked === undefined || picked.removed ? (
					// TWO WAYS TO GET HERE, ONE ANSWER. Either the row's opener carries
					// no id to match (the removed CELL variant is `{removed: true,
					// marketSlug}` and nothing else), or the matched ITEM is itself
					// removed. Both mean there is no argument to read.
					// ⛔ SC-1 — the removed union variants carry NO body, teaser or
					// title field, so a leak here is a COMPILE error rather than a
					// discipline. The stub is the shipped constant; no copy is authored.
					// ⚠ THE HEAD CLUSTER RIDES ALONG ONLY WHEN THE ITEM IS IN HAND: a
					// matched removed item still carries avatar, pseudonym and the frozen
					// side (INV-3), and the identity of a removed argument's author is
					// not the thing that was removed. With no item there is nothing to
					// invent one from.
					<Card data-testid="argument-replica-removed" className="gap-2 p-3">
						{picked !== undefined && (
							<RemovedHead side={picked.side} author={author} />
						)}
						<p className="text-xs text-n5 italic">{REMOVED_STUB_TEXT}</p>
					</Card>
				) : (
					<ReplicaCard item={picked} author={author} />
				)}
			</ArgumentsPanel>
		);
	}

	return (
		<ArgumentsPanel title="Arguments">
			<div data-testid="argument-list" className="flex flex-col gap-3">
				{items.map((item) =>
					item.removed ? (
						<Card
							key={item.id}
							data-testid={`argument-removed-${item.id}`}
							className="gap-2 p-3"
						>
							<RemovedHead side={item.side} author={author} />
							<p className="text-xs text-n5 italic">{REMOVED_STUB_TEXT}</p>
						</Card>
					) : (
						<Card
							key={item.id}
							data-testid={`argument-${item.id}`}
							className="gap-2 p-3"
						>
							<PresentHead item={item} author={author} />
							<Link
								data-testid={`argument-title-${item.id}`}
								href={`/m/${item.marketSlug}?post=${item.ordinal}`}
								className="font-medium text-ink hover:underline"
							>
								{item.title}
							</Link>
							{/* Item 6 (P5-D08) — the teaser, clamped. ⛔ AM-1: the clamp is
						    CSS-ONLY. NO `title` attribute may carry this text: a native
						    tooltip revealing the whole paragraph is a SECOND read
						    affordance beside the title <Link>, which is what D13 rules
						    out, reached by a different mechanism. The compliant shape is
						    already in this file — the "Replied to …" context below clamps
						    with no `title`. The removed variant carries no `teaser` field
						    at all, so a leak here is a COMPILE error (SC-1). */}
							{/* ⚠⚠ PROFILE REFINEMENT · R4 — THE TEASER GAINS THE MOCKUP'S `+`.
							    The clamped paragraph is unchanged (same testid, same classes);
							    what is new is the control beside it that reveals the rest. The
							    AM-1 note above bans a `title` attribute and that ban still
							    holds — see `ArgumentBody` for why an explicit, labelled,
							    keyboard-reachable control is a different object from the
							    tooltip D13 ruled out, and for why it expands in place rather
							    than opening the mockup's modal. */}
							{item.teaser !== "" && (
								<ArgumentBody
									id={item.id}
									teaser={item.teaser}
									body={item.body}
								/>
							)}
							{item.kind === "reply" && item.repliedToTitle !== null && (
								<p
									data-testid={`argument-reply-context-${item.id}`}
									className="line-clamp-2 text-xs text-n5"
								>
									Replied to {item.repliedToTitle}
								</p>
							)}
							{item.kind === "post" && (
								<SplitBar id={item.id} aggregate={item.aggregate} />
							)}
						</Card>
					),
				)}
			</div>
		</ArgumentsPanel>
	);
}

/**
 * HTML-FINISH row 2 — THE RIGHT ARENA HALF IS A BORDERED PANEL WITH A HEADER
 * BAR, matching the left. Canon §2 rules the arena as two panels; the mockup's
 * `.deb` is the same bordered, rounded, overflow-hidden flex column on both
 * sides (`:224-228`, markup `:475-484`).
 *
 * ⛔ THE TITLE IS BYTE-CARRIED OR IT IS DATA — NEVER AUTHORED. Two values reach
 * it, and neither is written here:
 *   `Arguments`            byte-carried from the SHIPPED tile label
 *                          (`ProfileTiles.tsx`, `label="Arguments"`), canon §6
 *                          (Profile) verbatim — the same word this surface
 *                          already prints for the same set. The unfiltered
 *                          header, and the default.
 *   the market QUESTION    `markets.title` — DATA, not copy, carried through
 *                          `ProfileSelection` when a positions row is picked.
 *
 * ⚠⚠ THIS SUPERSEDES A RECORDED REFUSAL, AND THE REFUSAL'S REASONING STILL
 * HOLDS FOR ITS OWN CASE. Recon table A-1 STRUCK the mockup's colhead on tier 1
 * because it exists only inside the REPLICA-REPLACES-LIST reading: SPEC.1 §23
 * enumerates "the argument list" and rules its own §3.6 order, and a panel
 * BOUND to the positions selection has no such order. Round 4 does not adopt
 * that reading — the list survives as the default and the selection is a
 * viewer-local FILTER over it — so the §3.6 order is untouched and the market
 * question appears only while a row is picked.
 * ⛔ THE LIVE PRICE BESIDE IT (`:652-653`) IS STILL NOT BUILT: the founder ruled
 * it out, and it is a live value this page does not hold.
 *
 * ⚠ THE ACCESSIBLE NAME STAYS `Arguments` WHILE THE VISIBLE TITLE MOVES. The
 * landmark names the REGION — the argument panel, whichever argument it is
 * showing — so swapping `aria-label` to the market question would rename a
 * landmark under a screen-reader user on every row they picked, and the panel
 * would stop being findable by name.
 *
 * ⚠ THE `min-h-0` + `flex-col` PAIR ON THE `<section>` IS A HEIGHT-CHAIN LINK
 * (row 3 / §4), pinned BY NAME in `tests/unit/design/profile-height-chain.test.ts`
 * — the same reason and the same chain as the left panel. The two halves must
 * scroll independently: with the arena bounded, whichever list is longer would
 * otherwise set the band's height and drag the other with it. ⛔ That guard
 * reads the className within a fixed window of the `data-testid`, so KEEP
 * COMMENTARY OUT of the attribute list below and put it here instead — a
 * comment between the two reads as a restructure and the guard throws.
 *
 * Every value is the left panel's, byte-for-byte, because the two halves are
 * one composition — see `PositionsTable.tsx`'s `PositionsPanel` for the trace
 * of each token. ⚠ ATTRIBUTED DUPLICATION, ROUTED NOT ABSORBED: lifting the
 * shared shell into `ui/**` would mint a new primitive, which this task
 * forbids. Filed as a widening.
 */
function ArgumentsPanel({
	title,
	children,
}: {
	/** ⚠ REQUIRED (O-1). An optional title would let a call site silently drop
	 * the panel's header word, and the header is how the reader knows whether
	 * they are looking at the whole record or at one argument. */
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section
			data-testid="arguments-panel"
			aria-label="Arguments"
			className="flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0 [border:var(--hairline)]"
		>
			{/* ⚠⚠ THE `.colhead` FLOOR — the mockup's literal, and what makes the two
			    side-by-side panel bodies START ON THE SAME LINE.
			    `surface_profile_v1_0.html:227-228` gives `.colhead` a
			    `min-height:52px` and applies it to BOTH slots, so the left and right
			    `.colwrap`s begin level however much each head holds. §2: where the
			    mockup states a literal, copy the literal.

			    ⛔ MEASURED THIS ROUND, ON THIS BASE — not inherited. PR #346 shipped
			    this same floor and is NOT merged (`grep min-h-\[52px\]` on `b9d146b`
			    returns nothing), so it was re-measured from scratch at a pinned
			    1440×777 on live staging, and in BOTH auth states:

			      SIGNED OUT   positions head 51 · arguments head 41
			      SIGNED IN    positions head 51 · arguments head 41
			      /bookmarks   list head      51 · replica head    41
			      ⇒ bodies at y418 vs y408 — 10px out, on both surfaces, both states.

			    Both heads carry the SAME class string, so the split is pure CONTENT:
			    one head holds a market filter and a segmented control, the other a
			    bare title (`p-3` twice + a 16px line box = 40, +1 hairline). That is
			    exactly the drift a floor removes and a hand-tuned height would not.

			    ⛔ A FLOOR, NEVER A HEIGHT. `min-h-*` can only GROW the shorter head;
			    it can never clip the taller one, so a head that later gains a control
			    still wins. §1/§3c: a fixed height does not make content fit, it CLIPS.
			    ⚠ SIZED ONCE AGAINST BOTH SURFACES (§3). The identical string lands on
			    all FOUR heads in this one commit — Profile's two and Bookmarks' two —
			    because `/bookmarks` IS this mockup in its `sub:'bookmark'` arm
			    (`:765-771`). Sizing one surface and then the other is the drift §3
			    forbids by name. */}
			<div
				data-testid="arguments-panel-head"
				className="flex min-h-[52px] flex-wrap items-center gap-2 p-3 [border-bottom:var(--hairline)]"
			>
				{/* The market question can be long, so it wraps rather than
				    overflowing the bar — `min-w-0` is what lets it, and the bar is
				    already `flex-wrap`. The mockup 2-line-clamps it (`:231`); a clamp
				    is not ported, because a clamped market question is a market
				    question the reader cannot finish. */}
				{/* ⚠⚠ PROFILE-FULL — THE RIGHT HEAD IS `.chttl.mkt`, A DIFFERENT REGISTER
				    FROM THE LEFT ONE. The mockup gives this slot `font-size:13px;
				    font-weight:700; letter-spacing:.01em` with `text-transform:none`
				    (`:229-231`) — deliberately NOT the left head's uppercase overline, because
				    what lands here is a market QUESTION: a sentence, and setting a sentence in
				    an 11px tracked overline would make it unreadable. Two heads, two
				    registers, and that asymmetry is the mockup's point rather than an
				    inconsistency to tidy away.
				    ⛔ THE WRAP STAYS UNCLAMPED. The mockup 2-line-clamps this (`:231`); a
				    clamped market question is one the reader cannot finish, so `min-w-0` on a
				    `flex-wrap` bar is kept instead — the note above this records that call and
				    it is unchanged.
				    ⚠ WHAT THIS SLOT SHOWS IS ALREADY THE MOCKUP'S: the selected row's market
				    title (`selection.marketTitle`, whose own type comment names mockup
				    `:650`). Only its TYPE was still the left head's. */}
				<span
					data-testid="arguments-panel-title"
					className="min-w-0 text-[13px] leading-[1.3] font-bold tracking-[0.01em] text-ink"
				>
					{title}
				</span>
			</div>
			{/* The argument list scrolls inside its own panel — the mockup's
			    `.colwrap` on the right slot (`:478`), same topology as the left. */}
			<div
				data-testid="arguments-panel-body"
				className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
			>
				{children}
			</div>
		</section>
	);
}

/**
 * HTML-FINISH row 4, REMOVED variant — the head cluster ships the SUBSET the
 * union permits, and the union is what decides: the removed variants carry no
 * `marker`, no `priceAtBet`, no `authorStake` and (for a reply) no `aggregate`,
 * so reaching for any of them is a COMPILE error, not a judgement call. Avatar,
 * pseudonym and the frozen side are all present, so all three render — the
 * identity of a removed argument's author is not the thing that was removed
 * (SC-1 governs the BODY, and no body field exists on this variant to leak).
 *
 * ⚠⚠ EXTRACTED AT ROUND 4, AND A CENSUS GUARD IS WHY. Item 7's replica needed
 * the same cluster, and copying it took `SideBadge size="profile"` in this file
 * from two call sites to four — which reddened
 * `tests/unit/debate/render/side-badge.test.ts` (a file this task may not edit).
 * That guard was RIGHT: it exists to catch a duplicated primitive call site, and
 * the fix is to have one. The list card and the replica now share this head, so
 * the two renderings cannot drift in what they show, and the census is back at
 * two — one per variant.
 */
function RemovedHead({
	side,
	author,
}: {
	side: ProfileArgumentItem["side"];
	author: ProfileUser;
}) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<AuthorHead author={author} />
			<HeadSeparator />
			<SideBadge side={side} size="profile" />
		</div>
	);
}

/**
 * HTML-FINISH row 4 — THE SHIPPED CARD-HEAD CLUSTER. Canon §3 item 11: "head =
 * avatar · name | SIDE @ entry% | stake … `Replies · N` inline with enlarged
 * count (`.repn`)". The build carried only side chip, marker and stake — no
 * avatar, no pseudonym, no separators. The mockup's `.rchead` is
 * `[avatar][pseud] | [sidechip] | [argstake] | [Replies · N] [cardacts]`
 * (`:624-628`). Shared by the list card and item 7's replica — see `RemovedHead`
 * above for why sharing is a requirement rather than a tidy-up.
 *
 * UNWIRE-1 — the bookmark half of the cluster (PROFILE REFINEMENT · R4's
 * `CardActions`/`loadBookmarks`/own-suppression mechanism, once threaded
 * through here via `bookmarks: BookmarkAffordance`) is removed: the bookmark
 * module is unwired product-wide. Only the disabled download stub remains
 * (SUB-1, `DownloadStub.tsx`).
 *
 * ⚠ NO GAP IS INTRODUCED: `gap-2` is the class this row already carried AND the
 * mockup's `.rchead{gap:8px}` (`:321`) — the same number from both directions.
 */
function PresentHead({
	item,
	author,
}: {
	item: Extract<ProfileArgumentItem, { removed: false }>;
	author: ProfileUser;
}) {
	// RANK-1 — the two union variants name the same three quantities differently
	// (a post's `authorStake*`/`authorSold`, a reply's `stake*`/`sold`), so they
	// are resolved ONCE here rather than three times inside the JSX.
	const currentStake = item.kind === "post" ? item.authorStake : item.stake;
	const originalStake =
		item.kind === "post" ? item.authorStakeOriginal : item.stakeOriginal;
	const soldOut = item.kind === "post" ? item.authorSold : item.sold;
	return (
		<div className="flex flex-wrap items-center gap-2">
			<AuthorHead author={author} />
			<HeadSeparator />
			{/* Item 3 (P5-D04) — canon §3 item 11's `SIDE @ entry%`. A PROP PASS:
			    `SideBadge` already takes `price` and already renders it, so NO
			    formatting happens here. Formatting it in this component would need a
			    fourth allow-marker and redden `pct-round-render` (its count is exact,
			    deliberately), and routing through the PAIRED formatter would print
			    `NO @ 45%` for an author who entered NO at 55%. ⛔ NEVER on the removed
			    variant — it carries no price field, so that is a compile error, which
			    is the guarantee working. */}
			<SideBadge side={item.side} size="profile" price={item.priceAtBet} />
			{/* `PositionMarker` returns null for "none" itself, and supplies the
			    `aria-label="Author Flipped"` the hand-roll lacked (PD-0-10's root
			    cause: primitive duplication). */}
			<PositionMarker marker={item.marker} />
			{/* Item 4 (P5-D06a) — the author's own stake on THIS argument, canon §3
			    item 11's head. Routed through `formatDharma` — the stake is a MONEY_ID
			    and a bare `{item.authorStake}` reddens no-raw-dharma-render.

			    ⚠ LOTS-1 (RECON-1 R-01) — THIS NOW RENDERS FOR REPLIES TOO. It was
			    gated to posts on the reasoning that "a reply's `stake` is the §3.6
			    ranking ruler, a different figure". Measured consequence of that gate:
			    a participant whose basis is entirely reply-bets saw NO component of
			    it anywhere on their own profile — 12 of 39 held positions on staging
			    were majority-reply, and two were 100%. The number was already on the
			    DTO and already in the RSC payload; only the render was withheld.

			    That a figure also feeds ranking is not a reason to hide it from its
			    author. Both union variants carry a stake — a post's `authorStake`, a
			    reply's `stake` — so the only real difference was the field name.

			    ⚠ RANK-1 / ADR-0039 R6 — BOTH fields now carry the stake STILL HELD
			    (surviving lot basis), which is the same value the §3.6 order ranks
			    on. The original rides beside it struck through once the figure has
			    moved, and an argument with nothing left reads `Đ 0` with a `Sold`
			    tag. ⛔ "Lot" is never the word: on screen these are ARGUMENTS (R1).
			    Nothing here is erased — the commitment survives in the strikethrough
			    and in Bucket-A `bets.stake`; it just stops being what ranks. */}
			<HeadSeparator />
			<span
				data-testid={`argument-stake-${item.id}`}
				className="text-n6 text-xs"
			>
				Đ {formatDharma(currentStake)}
			</span>
			{soldOut ? (
				<span
					data-testid={`argument-sold-${item.id}`}
					className="rounded-[var(--r-chip)] bg-n1 px-1.5 py-0.5 font-bold text-[10px] text-n5 uppercase tracking-[0.08em]"
				>
					Sold
				</span>
			) : formatDharma(originalStake) !== formatDharma(currentStake) ? (
				/* Only when the figure has actually moved ON SCREEN. Compared through
				   `formatDharma`, not on the raw 18-dp strings: a sub-Đ1 reduction is a
				   real change to the basis and a non-change to what the reader sees, and
				   striking a number through beside an identical number is exactly the
				   "same number twice" this branch exists to prevent. */
				<span
					data-testid={`argument-stake-original-${item.id}`}
					className="text-n4 text-xs line-through"
				>
					Đ {formatDharma(originalStake)}
				</span>
			) : null}
			{/* `Replies · N` stays POST-ONLY — replies attract nothing by design
			    (§9), so a reply has no count to show. That gate was always correct;
			    it was only ever the STAKE that was wrongly bundled behind it. */}
			{item.kind === "post" && (
				<>
					<HeadSeparator />
					{/* HTML-FINISH row 12 — `Replies · N` MOVES INTO THE HEAD, beside the
					    stake. Canon §3 item 11 places it "inline with enlarged count
					    (`.repn`)", i.e. inline in the head cluster, and the mockup emits
					    it there (`:619-621`) between the stake and the action cluster. It
					    was in the footer's running text, which row 5 replaces with the
					    split bar — so this is a MOVE, not a duplication, and both halves
					    land in one commit precisely so no intermediate state renders it
					    twice or not at all. Both spans keep their class strings
					    byte-for-byte from the footer they left; N is still the sum of the
					    two pole counts (every reply IS a Support or Counter bet,
					    ADR-0017), so no passthrough field is needed. */}
					<span className="text-xs text-n5">
						Replies ·{" "}
						<span
							data-testid={`argument-replies-${item.id}`}
							className="font-[650] text-n6 text-sm"
						>
							{item.aggregate.supportCount + item.aggregate.counterCount}
						</span>
					</span>
				</>
			)}
			{/* UNWIRE-1 — the bookmark half of this cluster is gone (bookmark module
			    unwired product-wide, SUB-2/H-NEW-2); the download stub survives,
			    extracted to its own component (SUB-1). `ml-auto` on this wrapper is
			    the same one `CardActions` carried, kept so the lone remaining child
			    still sits at the row's end — the mockup's `.cardacts{margin-left:
			    auto}` (`:330`). */}
			<div className="ml-auto flex shrink-0 items-center gap-0.5">
				<DownloadStub />
			</div>
		</div>
	);
}

/**
 * ROUND 4 item 7 — THE REPLICA CARD, the panel's filtered rendering of ONE
 * argument. The mockup's `replicaHTML` (`:615-643`) is `.argbody` holding
 * `[.rchead][.rtitle][.rimg][.rfootwrap]`; the founder's part list for this item
 * is "head cluster · title · body · image slot · footer/split bar · the reply
 * 'Replied to …' line", and that order is what ships.
 *
 * ⚠ EVERY PART IS ALREADY LOADED — this issues NO new read. `body` is on
 * `ProfileArgumentItem` (`arguments.ts`) and has simply never been rendered on
 * this surface; the head cluster, title, split bar and reply line are the list
 * card's own, so the two renderings cannot drift in what they show.
 * ⛔ THE ONE PART THAT IS NOT BUILT IS THE IMAGE. `comments.imageUploadsId` is
 * never selected by `loadProfileArguments`, so a real image is a NEW SERVER READ
 * PER RENDER on a surface already served by a 15-slot pooler. The SLOT is built
 * — it is the mockup's `.rimg{flex:1 1 auto; min-height:0}`, the growth region
 * that pins the footer to the bottom — and it renders NOTHING: no background, no
 * border, no label. ⛔ Deliberately not a grey box: a permanent placeholder
 * states "an image is missing" on every argument, most of which have none.
 *
 * ⛔ NO `+` AFFORDANCE ON THE REPLICA'S TITLE, AND THAT SURVIVES PROFILE
 * REFINEMENT · R4 — for the reason this note already gave rather than for the old
 * one. The mockup's `.rtitle .plus` (`:346`, wired at `:630`) opens the
 * full-argument pop-up; A-6 struck its shape and it duplicated the known PD-0-01.
 * ⇒ R4 asks for the `+` and it IS built — on the argument-LIST card, where the
 * teaser is clamped to two lines and there is genuinely more to reveal (see
 * `ArgumentBody`). It is NOT built here, because this card renders the body IN FULL
 * already: a control whose whole job is to show the rest of the text would reveal
 * nothing, and a control that does nothing visible is worse than an absent one.
 * That is the same test R4 applies to the download affordance, one step removed.
 * ⚠ THE HEAD CLUSTER IS DIFFERENT AND DOES LAND HERE — the disabled download
 * stub (UNWIRE-1: the bookmark half is gone product-wide). Only the `+` is
 * surface-specific, because only the `+` depends on whether the text is clamped.
 *
 * ⚠ TITLE-THEN-WHOLE-BODY IS THE SHIPPED SHAPE, NOT A DUPLICATION BUG.
 * `deriveTitleTeaser` (`load-debate-view.ts:402-411`) takes the title FROM the
 * body's first line, so the title does appear twice — and that is exactly what
 * the shipped focused post does at `PostFocusHeader.tsx:84-90`, whose
 * `<p className="text-sm whitespace-pre-line">` this reuses byte-for-byte.
 * Diverging here would make the same comment read differently on two surfaces.
 */
function ReplicaCard({
	item,
	author,
}: {
	item: Extract<ProfileArgumentItem, { removed: false }>;
	author: ProfileUser;
}) {
	return (
		<Card
			data-testid={`argument-replica-${item.id}`}
			// `flex-1 min-h-0` is the mockup's `.argbody{flex:1 1 auto;
			// min-height:0}` (`:320`) — topology, and it is what lets the image slot
			// below take the leftover instead of the card growing past the panel.
			className="min-h-0 flex-1 gap-2 p-3"
		>
			<PresentHead item={item} author={author} />
			<Link
				data-testid={`argument-replica-title-${item.id}`}
				href={`/m/${item.marketSlug}?post=${item.ordinal}`}
				className="font-medium text-ink hover:underline"
			>
				{item.title}
			</Link>
			{/* ⛔ NO `line-clamp` HERE, and that is the point of the replica. The
			    list card clamps its teaser to two lines (item 6 / P5-D08) because it
			    is a list; this panel exists to READ the argument, so the body ships
			    whole and the panel's own `overflow-y-auto` carries it. */}
			<p
				data-testid={`argument-replica-body-${item.id}`}
				className="text-sm whitespace-pre-line"
			>
				{item.body}
			</p>
			{/* The image SLOT — see the ⛔ above. Empty by design; it contributes the
			    mockup's growth region and nothing else. */}
			<div
				data-testid={`argument-replica-image-slot-${item.id}`}
				className="min-h-0 flex-1"
			/>
			{/* The footer, pinned to the bottom by the slot above — the mockup's
			    `.rfootwrap{margin-top:auto}` (`:353`) reached by the growth region
			    rather than by declaring a margin. ⛔ Its `flex:0 0 50px` is NOT
			    ported: the sell module never slides into THIS footer on this build
			    (Sell lives in the positions row, F-PROF-3), so there is no second
			    occupant for the box to reserve room for. */}
			{item.kind === "post" ? (
				<SplitBar id={item.id} aggregate={item.aggregate} />
			) : (
				item.repliedToTitle !== null && (
					<p
						data-testid={`argument-replica-reply-context-${item.id}`}
						className="text-xs text-n5"
					>
						Replied to {item.repliedToTitle}
					</p>
				)
			)}
		</Card>
	);
}

/**
 * HTML-FINISH row 4 — the head cluster's `[avatar][pseudonym]` pair (mockup
 * `:624`, `.rchead .avatar` at `:322`).
 *
 * ⚠ EVERY VALUE HERE IS TRACED TO SHIPPED CODE, NOT TO THE MOCKUP.
 * `<Avatar size="sm">` is `ArgProfile.tsx:51` — the shipped component for this
 * exact "argprofile" head role (design-language §3.1). The mockup's 18px box
 * sits between the `xs` (16) and `sm` (24) presets and is a VALUE, so it is not
 * ported; the shipped preset for the role is. `truncate text-sm font-medium` is
 * `ArgProfile.tsx:59` verbatim, and the two-letter uppercase fallback is
 * `ArgProfile.tsx:54`.
 *
 * ⛔ NOT `ArgProfile` ITSELF — this surface needs only avatar + pseudonym, not
 * `ArgProfile`'s full side-chip/marker/stake/replies row, so composing the
 * same primitives at the same values is the honest subset rather than a
 * wider component with most of its fields unused. (UNWIRE-1: `ArgProfile` no
 * longer takes a `commentId`/`bookmarks` pair at all — the historical data
 * block this note cited is gone with the bookmark module — but the "which
 * subset of fields does this surface need" reasoning is unchanged.)
 */
function AuthorHead({ author }: { author: ProfileUser }) {
	return (
		<>
			<Avatar size="sm">
				<AvatarImage src={author.pfpUrl} alt="" />
				<AvatarFallback>
					{author.pseudonym.slice(0, 2).toUpperCase()}
				</AvatarFallback>
			</Avatar>
			<span
				data-testid="argument-author"
				className="truncate text-sm font-medium"
			>
				{author.pseudonym}
			</span>
		</>
	);
}

/**
 * HTML-FINISH row 5 — THE SUPPORT/COUNTER SPLIT BAR, replacing the post card's
 * running text line. design-language §3.2: "the shared two-pole bar: **label —
 * bar — label**, text never inside the bar"; canon §3 item 11: "split-bar staked
 * total enlarged + ink (`.stkn`)". The mockup emits it at `:609-613` as
 * `[Support chip + Đ] [bar + total] [Counter chip + Đ]`.
 *
 * ⚠ THE FILL MAPPING IS RATIFIED, NOT CHOSEN, and the governing clause is the
 * one the recon's own quote truncated. `design-language.md:180` ends: "*(The
 * reply stake bar's exact fill mapping follows the locked v1.0 surface.)*" The
 * locked surface is this mockup, whose `.bar{background:var(--n0)}` +
 * `.fill{background:var(--ink)}` (`:362-364`) is a FIXED bright-track /
 * dark-fill pair, not a side-keyed one. The shipped `ReplySplitBar.tsx:70,73`
 * already renders exactly that relationship in the dark system — `bg-no`
 * (#fafafa, bright) track under a `bg-yes` (#181818, dark) fill — so this reuses
 * the shipped idiom byte-for-byte rather than porting a light-theme colour.
 *
 * ⚠⚠ THE RESIDUAL IS RECORDED, NOT HIDDEN. Support inherits the POST's side, so
 * on a NO-side post the Support share paints in the YES pole — the "route 3"
 * exposure `HeroPanels.tsx:325-346` fixed for Discovery by making both segments
 * side-keyed. Correcting it here is NOT free: a side-keyed colour expression in
 * this file makes `side-pole-binding.test.ts` RED on its closed-inventory
 * assertion, and greening it means adding this file to that guard's
 * `PERMITTED_FILES` — which is that guard's own documented extension mechanism
 * ("POLISH.3/.5/.6 will add legitimate pole sites … each such addition must be
 * a DECISION") but sits OUTSIDE this task's write allow-list. So the bar ships
 * on the ratified fixed mapping and the correction is ROUTED to the founder as
 * a widening. ⛔ It is NOT worked around by hiding the binding from the guard.
 *
 * `displaySplitTotal`, not `computeSplitBar.totalDharma`: SPEC.1 §10.8 names
 * "the reply split bar's staked total" as one of the TWO displayed-space
 * aggregate identities, so the printed total sums the printed parts. The FILL
 * proportion stays on the exact basis — a proportion is not a Đ value.
 */
function SplitBar({
	id,
	aggregate,
}: {
	id: string;
	aggregate: ProfileArgumentAggregate;
}) {
	const { supportPct } = computeSplitBar({
		supportDharma: aggregate.supportDharma,
		counterDharma: aggregate.counterDharma,
	});
	const displayedTotal = displaySplitTotal(
		aggregate.supportDharma,
		aggregate.counterDharma,
	);
	// Every class below is byte-carried from `ReplySplitBar.tsx:52-79`, the
	// shipped split bar. The two label WORDS are byte-carried from this file's
	// own former footer line. Nothing is authored and nothing is measured off
	// the mockup.
	return (
		<div
			data-testid={`argument-split-bar-${id}`}
			className="flex items-center gap-3 text-xs"
			role="img"
			aria-label={`Support Đ ${formatDharma(aggregate.supportDharma)}, Counter Đ ${formatDharma(aggregate.counterDharma)}`}
		>
			<span className="flex items-center gap-1.5">
				<span className="text-n6">Support</span>
				<span className="text-n5">
					Đ {formatDharma(aggregate.supportDharma)}
				</span>
			</span>
			<span className="flex min-w-0 flex-1 flex-col items-center gap-1">
				<span
					className="h-1.5 w-full overflow-hidden rounded-(--r-dot) bg-no"
					aria-hidden="true"
				>
					<span className="block h-full bg-yes" style={{ width: supportPct }} />
				</span>
				{/* `.stkn` — canon §3 item 11's "split-bar staked total enlarged +
				    ink". `<b className="text-sm text-ink">` is ReplySplitBar.tsx:76. */}
				<span className="text-n5">
					<b className="text-sm text-ink">Đ {formatDharma(displayedTotal)}</b>{" "}
					staked
				</span>
			</span>
			<span className="flex items-center gap-1.5">
				<span className="text-n5">
					Đ {formatDharma(aggregate.counterDharma)}
				</span>
				<span className="text-n6">Counter</span>
			</span>
		</div>
	);
}
