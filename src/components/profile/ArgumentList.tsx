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

import { PROFILE_COPY } from "./copy";

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
}): React.JSX.Element {
	// Item 8 (P5-D11) — the empty adopts W2.11 P1 at ONE message tier (D3(a)).
	// The testid moves onto the leaf's MESSAGE NODE, so a `textContent` read
	// still returns exactly this string; no `sub` is passed on this surface.
	if (items.length === 0) {
		return (
			<ArgumentsPanel>
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

	return (
		<ArgumentsPanel>
			<div data-testid="argument-list" className="flex flex-col gap-3">
				{items.map((item) =>
					item.removed ? (
						<Card
							key={item.id}
							data-testid={`argument-removed-${item.id}`}
							className="gap-2 p-3"
						>
							{/* HTML-FINISH row 4, removed variant — the head cluster ships
						    the SUBSET the union permits, and the union is what decides:
						    the removed variants carry no `marker`, no `priceAtBet`, no
						    `authorStake` and (for a reply) no `aggregate`, so reaching
						    for any of them here is a COMPILE error, not a judgement
						    call. Avatar, pseudonym and the frozen side are all present,
						    so all three render — the identity of a removed argument's
						    author is not the thing that was removed (SC-1 governs the
						    BODY, and no body field exists on this variant to leak). */}
							<div className="flex flex-wrap items-center gap-2">
								<AuthorHead author={author} />
								<HeadSeparator />
								<SideBadge side={item.side} size="profile" />
							</div>
							<p className="text-xs text-n5 italic">{REMOVED_STUB_TEXT}</p>
						</Card>
					) : (
						<Card
							key={item.id}
							data-testid={`argument-${item.id}`}
							className="gap-2 p-3"
						>
							{/* HTML-FINISH row 4 — THE SHIPPED CARD-HEAD CLUSTER. Canon §3
						    item 11: "head = avatar · name | SIDE @ entry% | stake …
						    `Replies · N` inline with enlarged count (`.repn`)". The build
						    carried only side chip, marker and stake — no avatar, no
						    pseudonym, no separators. The mockup's `.rchead` is
						    `[avatar][pseud] | [sidechip] | [argstake] | [Replies · N]
						    [cardacts]` (`:624-628`).
						    ⛔ THE CARD-ACTIONS CLUSTER IS DATA-BLOCKED AND SHIPS NOTHING.
						    `CardActions` (BookmarkToggle.tsx:135) requires a
						    `BookmarkAffordance`; `ProfileArgumentItem` carries none, and
						    the only reader that produces one — `loadViewerMarketContext`
						    — is MARKET-scoped while this list is cross-market. The three
						    reachable substitutes are all defects: `null` prints "sign in
						    to use" to a signed-in viewer; an empty `saved` set prints an
						    UNSAVED icon on an argument the viewer has saved; and both
						    lie. `src/server/**` is out of bounds for this task, so the
						    cluster is RECORDED as data-blocked and NOT approximated.
						    ⚠ NO GAP IS INTRODUCED: `gap-2` is the class this row already
						    carried AND the mockup's `.rchead{gap:8px}` (`:321`) — the
						    same number from both directions, so nothing moves. */}
							<div className="flex flex-wrap items-center gap-2">
								<AuthorHead author={author} />
								<HeadSeparator />
								{/* Item 3 (P5-D04) — canon §3 item 11's `SIDE @ entry%`. A PROP
							    PASS: `SideBadge` already takes `price` and already renders
							    it, so NO formatting happens here. Formatting it in this
							    component would need a fourth allow-marker and redden
							    `pct-round-render` (its count is exact, deliberately), and
							    routing through the PAIRED formatter would print `NO @ 45%`
							    for an author who entered NO at 55%. ⛔ NEVER on the
							    removed variant at `:49` — it carries no price field, so
							    that is a compile error, which is the guarantee working. */}
								<SideBadge
									side={item.side}
									size="profile"
									price={item.priceAtBet}
								/>
								{/* `PositionMarker` returns null for "none" itself, and
							    supplies the `aria-label="Author Flipped"` the hand-roll
							    lacked (PD-0-10's root cause: primitive duplication). */}
								<PositionMarker marker={item.marker} />
								{/* Item 4 (P5-D06a) — the author's own opening stake, canon §3
							    item 11's head. POST VARIANT ONLY: a reply's `stake` is the
							    §3.6 ranking ruler, a different figure (§0.5). D21 struck
							    the `→ current` half, so the stake ships alone. Routed
							    through `formatDharma` — `authorStake` is a MONEY_ID and a
							    bare `{item.authorStake}` reddens no-raw-dharma-render. */}
								{item.kind === "post" && (
									<>
										<HeadSeparator />
										<span
											data-testid={`argument-stake-${item.id}`}
											className="text-n6 text-xs"
										>
											Đ {formatDharma(item.authorStake)}
										</span>
										<HeadSeparator />
										{/* HTML-FINISH row 12 — `Replies · N` MOVES INTO THE HEAD,
									    beside the stake. Canon §3 item 11 places it "inline
									    with enlarged count (`.repn`)", i.e. inline in the head
									    cluster, and the mockup emits it there (`:619-621`)
									    between the stake and the action cluster. It was in the
									    footer's running text, which row 5 replaces with the
									    split bar — so this is a MOVE, not a duplication, and
									    both halves land in one commit precisely so no
									    intermediate state renders it twice or not at all.
									    Both spans keep their class strings byte-for-byte from
									    the footer they left; N is still the sum of the two
									    pole counts (every reply IS a Support or Counter bet,
									    ADR-0017), so no passthrough field is needed. */}
										<span className="text-xs text-n5">
											Replies ·{" "}
											<span
												data-testid={`argument-replies-${item.id}`}
												className="font-[650] text-n6 text-sm"
											>
												{item.aggregate.supportCount +
													item.aggregate.counterCount}
											</span>
										</span>
									</>
								)}
							</div>
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
							{item.teaser !== "" && (
								<p
									data-testid={`argument-teaser-${item.id}`}
									className="line-clamp-2 text-xs text-n5"
								>
									{item.teaser}
								</p>
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
 * ⛔ THE TITLE IS BYTE-CARRIED, NOT AUTHORED, AND THE MOCKUP'S CANNOT BE USED.
 * The mockup's right `.colhead` carries the SELECTED MARKET'S TITLE and a live
 * price (`:477`, written by `renderReplica` at `:650-653`) — but that header
 * exists only inside the REPLICA reading, which recon table A-1 STRUCK on tier
 * 1: SPEC.1 §23 enumerates "the **argument list**" and rules its own §3.6
 * order, and a panel bound to the positions selection has no such order. With
 * the list reading there is no selected market, so there is no market title to
 * put here. `Arguments` is byte-carried from the SHIPPED tile label
 * (`ProfileTiles.tsx`, `label="Arguments"`), canon §6 (Profile) verbatim — the
 * same word this surface already prints for the same set.
 *
 * Every value is the left panel's, byte-for-byte, because the two halves are
 * one composition — see `PositionsTable.tsx`'s `PositionsPanel` for the trace
 * of each token. ⚠ ATTRIBUTED DUPLICATION, ROUTED NOT ABSORBED: lifting the
 * shared shell into `ui/**` would mint a new primitive, which this task
 * forbids. Filed as a widening.
 */
function ArgumentsPanel({ children }: { children: React.ReactNode }) {
	return (
		<section
			data-testid="arguments-panel"
			aria-label="Arguments"
			// HTML-FINISH row 3 / §4 — the same `min-h-0` as the left panel, for
			// the same reason and by the same chain. The two halves must scroll
			// independently: with the arena bounded, whichever list is longer
			// would otherwise set the band's height and drag the other with it.
			className="flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0 [border:var(--hairline)]"
		>
			<div
				data-testid="arguments-panel-head"
				className="flex flex-wrap items-center gap-2 p-3 [border-bottom:var(--hairline)]"
			>
				<span className="text-xs font-medium text-ink">Arguments</span>
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
 * ⛔ NOT `ArgProfile` ITSELF, and the reason is a data block, not a preference:
 * `ArgProfile` requires `commentId` AND `bookmarks: BookmarkAffordance`, and no
 * reader on this surface produces the second. Composing the same primitives at
 * the same values is the honest subset; the action cluster is recorded
 * data-blocked at the call site above.
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
