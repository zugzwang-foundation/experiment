"use client";

import { ImageIcon, Pencil, Plus } from "lucide-react";
import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FieldSeparator } from "@/components/ui/field-separator";
import { BET_MAX_STAKE } from "@/server/config/limits";

import { SideBadge } from "../badges";
import { formatDharma, formatPricePercent } from "../format";
import type { Side } from "../types";
import { COMPOSER_COPY, FRIENDLY_FIRE_COPY, MIRROR_COPY } from "./copy";
import { type ComposerStatus, ErrorStrip } from "./ErrorStrip";
import { type ComposerKind, floorFor } from "./gating";
import { ImageAttach, type ImageAttachState } from "./ImageAttach";
import {
	fitTitle,
	TITLE_FIT_AT_REST,
	type TitleFit,
	titleCharsLeft,
	titleLineHeightPx,
	titlePaddingTopPx,
} from "./mirror-sizing";
import { TITLE_MAX_CHARS } from "./payload";

/**
 * MIRROR-1 — the two facts the Mirror needs that the composer does not already
 * hold. Passing this object is what selects the Mirror layout (`BetComposer`'s
 * `mirror` prop), so a mount cannot ask for the layout without supplying them.
 */
export type MirrorContext = {
	/** The viewer — the author of the card this draft becomes (RF-3). */
	author: { pseudonym: string | null; pfpUrl: string | null };
	/** The market's live price pair, for the RF-3 chip. `null` → the bare side. */
	pricing: { yes: string; no: string } | null;
};

/**
 * RF-3 — the chip's live price, in the form `SideBadge` renders.
 *
 * ⛔ `SideBadge` FORMATS ITS `price` UNPAIRED, because every caller before this
 * one hands it a single historical entry price. A LIVE price is half of a pair,
 * and SPEC.1 §10.8 renders the pair with YES canonical and NO derived as
 * `100 − YES` — rounding NO on its own can print a value that disagrees with the
 * PriceBar a few pixels away (both sides round up at an exact `.xx5` tie). So the
 * paired whole percent is computed here with the sanctioned formatter and handed
 * to the chip as the decimal whose unpaired rendering IS that percent. The chip
 * component is reused unmodified (RF-3: "do not restyle them").
 *
 * String-built, never divided: `87` → `"0.87"`, `5` → `"0.05"`, `100` → `"1"`.
 */
export function pairedChipPrice(
	pricing: { yes: string; no: string },
	side: Side,
): string {
	const whole = Number.parseInt(formatPricePercent(pricing, side), 10);
	return whole >= 100 ? "1" : `0.${String(whole).padStart(2, "0")}`;
}

/**
 * The Mirror composer — MIRROR-1, `docs/design/composer-mirror.md` (RF-1…RF-7).
 * One component for both variants: a reply adds RF-2's statement row and moves
 * the `×` onto it.
 *
 * ⛔ PRESENTATION ONLY. Every value and handler arrives from `BetComposer`, which
 * owns all state, the idempotency-key lifecycle, the quote, the gating
 * predicates and the submit. Nothing here computes what is sent, whether it may
 * be sent, or when; this file decides only where things are drawn. The phone
 * mount never reaches it (RF-8) — `BetComposer` renders its own layout unless a
 * `mirror` context is passed.
 */
export function MirrorComposer(props: {
	side: Side;
	kind: ComposerKind;
	mirror: MirrorContext;
	/**
	 * RF-2 — a reply's statement line, `Support|Counter <author>'s argument` (or,
	 * for a removed parent, today's `Place your Đ BET` fallback), computed by the
	 * controller with the classic header's own expression. `null` on a post, which
	 * has no statement row and keeps its `×` on the author row (RF-3).
	 */
	replyStatement: string | null;
	/**
	 * FF-1's friendly-fire switch — the controller's own element, `null` except on
	 * a Support reply — drawn in the statement row's reserved slot (RF-2).
	 */
	statementControl: ReactNode;
	title: string;
	extended: string;
	/** Today's detail budget (`extendedMaxChars`) — the detail field's `maxLength`. */
	extendedMax: number;
	/** Today's detail counter, `{n} / {limit} · optional`, formatted by the controller. */
	detailCounter: string;
	amount: string;
	/** The field's width, in `ch` — today's tracking rule, computed by the controller. */
	amountFieldWidth: string;
	/** The stake that would be placed — what the card will show once posted. */
	clampedAmount: string;
	amountIsPositive: boolean;
	overCap: boolean;
	image: ImageAttachState;
	imageAttachEnabled: boolean;
	status: ComposerStatus;
	inFlight: boolean;
	floorAbove: boolean;
	submitDisabled: boolean;
	notice: string | null;
	toWin: string | null;
	onTitleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
	onTitleInput: (value: string) => void;
	onExtendedInput: (value: string) => void;
	onAmountInput: (value: string) => void;
	onAmountBlur: () => void;
	onPickImage: (file: File) => void;
	onRemoveImage: () => void;
	onSubmit: () => void;
	onClose: () => void;
	/** The P2 suspended modal — the controller's own element, rendered here unchanged. */
	suspendedDialog: ReactNode;
}) {
	const fieldsDisabled = props.floorAbove || props.inFlight;
	// Today's C2 dimming (`BetComposer`'s `dimmed`) applied to the same region: the
	// argument — here, the title row and the media frame.
	const dim = props.floorAbove ? " opacity-(--state-disabled-opacity)" : "";
	const { pseudonym, pfpUrl } = props.mirror.author;
	const chipPrice =
		props.mirror.pricing === null
			? undefined
			: pairedChipPrice(props.mirror.pricing, props.side);

	// RF-5 / RF-6 — which view the frame shows. With the image-attach brake on
	// (ADR-0052) there is no image view to return to, so the frame IS the detail
	// view and the toggle is not drawn.
	const [view, setView] = useState<MirrorView>("image");
	const shown: MirrorView = props.imageAttachEnabled ? view : "detail";
	const slide = useViewSlide(shown);
	const detailRef = useRef<HTMLTextAreaElement | null>(null);
	const toggleRef = useRef<HTMLButtonElement | null>(null);
	// Moving to the detail view is asking to write detail: focus follows. Moving
	// back puts focus on the toggle IF it was in the detail field — which it still
	// is after a click in Safari, where pressing a button does not focus it, and
	// the field is about to be hidden (`@code-reviewer` L6: focus fell to <body>).
	const focusDetail = useRef(false);
	const focusToggle = useRef(false);
	useEffect(() => {
		if (shown === "detail" && focusDetail.current) {
			focusDetail.current = false;
			detailRef.current?.focus();
		}
		if (shown === "image" && focusToggle.current) {
			focusToggle.current = false;
			// `focusVisible: false` — this move only ever follows a POINTER press (a
			// keyboard press is already on the toggle), and a script focus that
			// follows a focused text field would otherwise match `:focus-visible`
			// and ring after a mouse click (RF-6). Engines that do not know the
			// option ignore it.
			const opts: FocusOptions & { focusVisible?: boolean } = {
				focusVisible: false,
			};
			toggleRef.current?.focus(opts);
		}
	}, [shown]);
	const toggleView = () => {
		const next: MirrorView = view === "image" ? "detail" : "image";
		focusDetail.current = next === "detail";
		focusToggle.current =
			next === "image" &&
			(detailRef.current?.contains(document.activeElement) ?? false);
		slide.leave(view);
		setView(next);
	};

	return (
		<section
			// design-canon §3 rule 5, as MIRROR-1 amended it: the post composer no
			// longer SHOWS `Place your Đ BET`; it stays the section's accessible
			// name, exactly as today.
			aria-label={`${COMPOSER_COPY.header} — ${props.side}`}
			data-testid="mirror-composer"
			// RF-1 — fills the slot (`ComposerSlot` is a flex column), n0 surface, n2
			// hairline, 10px radius (`--radius`), 16px padding, 14px between rows.
			// `@container/mirror` is what the stake bar's narrow-width fallback reads.
			className="@container/mirror flex min-h-0 flex-1 flex-col gap-3.5 rounded-lg border border-n2 bg-n0 p-4"
		>
			{/* THE BODY — every row above the stake bar. It is the one thing that
			    scrolls: RF-6's frame stops shrinking at 160px, and below that the
			    body scrolls while the stake bar, its sibling, stays pinned.
			    ⚠ ITS PADDING IS ROOM, NOT SPACING — every value is cancelled by an
			    equal negative margin, so no row moves. The `×` keeps the classic's
			    44px target by overhanging its row (`-my-3`) and sits flush right
			    (`-mr-3`); a scroll container clips whatever reaches past its
			    padding box, so 12px of top and right padding is what keeps that
			    target — and its focus ring — whole, and keeps the body from
			    scrolling sideways (`@code-reviewer` M1 measured 10px of x-scroll and
			    a 6–9px clip before this). 2px elsewhere is the focus-ring room. */}
			<div
				data-testid="mirror-body"
				className="-mt-3 -mr-3 -mb-0.5 -ml-0.5 flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto pt-3 pr-3 pb-0.5 pl-0.5"
			>
				{props.replyStatement !== null ? (
					<StatementRow
						statement={props.replyStatement}
						control={
							props.statementControl ? (
								<>
									{props.statementControl}
									{/* FF-1's helper line, verbatim, for assistive tech. The
									    Mirror draws no helper ROW (RF-1 lists none, and the
									    founder's reply render shows none); on the desktop the
									    label's hover gloss carries the meaning — which a
									    keyboard or screen-reader user never reaches
									    (`@code-reviewer` M3). Visible treatment is flagged for
									    Gate C. */}
									<span className="sr-only">
										{FRIENDLY_FIRE_COPY.helper(props.side)}
									</span>
								</>
							) : null
						}
						close={
							<CloseButton onClose={props.onClose} disabled={props.inFlight} />
						}
					/>
				) : null}
				<AuthorRow
					side={props.side}
					pseudonym={pseudonym}
					pfpUrl={pfpUrl}
					chipPrice={chipPrice}
					amountEcho={
						props.amountIsPositive ? formatDharma(props.clampedAmount) : "—"
					}
					close={
						props.replyStatement === null ? (
							<CloseButton
								onClose={props.onClose}
								disabled={props.inFlight}
								className="ml-auto"
							/>
						) : null
					}
				/>
				<div className={`flex shrink-0 items-start gap-3.5${dim}`}>
					<TitleField
						title={props.title}
						disabled={fieldsDisabled}
						onKeyDown={props.onTitleKeyDown}
						onInput={props.onTitleInput}
					/>
					{props.imageAttachEnabled ? (
						<DetailToggle
							buttonRef={toggleRef}
							shown={shown}
							hasDetail={props.extended.trim().length > 0}
							onToggle={toggleView}
						/>
					) : null}
				</div>
				<div
					data-testid="mirror-media-host"
					// RF-6 — the frame takes the height left over, never less than 160px;
					// below that the BODY scrolls. `container-type: size` is what lets the
					// frame size itself against this box in both axes.
					className={`flex min-h-[160px] flex-1 flex-col [container-type:size]${dim}`}
				>
					<div
						data-testid="mirror-media-frame"
						// RF-6 — width = min(available width, available height × 16/9),
						// exact 16:9, centred, top-aligned, clipped. Stated as CSS rather than
						// measured in script: this IS the rule, it is right on the first
						// paint, and it follows every resize without a frame of lag.
						className={`relative mx-auto aspect-video w-[min(100cqw,calc(100cqh*16/9))] shrink-0 overflow-hidden rounded-(--r) border bg-ground ${frameBorder(shown, props.image)}`}
					>
						{/* ⛔ BOTH VIEWS STAY MOUNTED, AND THAT IS RF-6's ⚠ RATHER THAN A
						    CONVENIENCE. The image view owns the local preview; unmounting
						    it would revoke the blob and bring the reader back to a blank
						    frame over an image that is still attached. The attach itself
						    lives in the controller and never pauses. The view the reader
						    is not looking at is `hidden` and `inert` — out of the tab
						    order and the accessibility tree, still holding its state. */}
						{props.imageAttachEnabled ? (
							<div {...slide.attrs("image")}>
								<ImageAttach
									variant="mirror"
									state={props.image}
									disabled={fieldsDisabled}
									onPick={props.onPickImage}
									onRemove={props.onRemoveImage}
								/>
							</div>
						) : null}
						<div {...slide.attrs("detail")}>
							<textarea
								ref={detailRef}
								value={props.extended}
								maxLength={props.extendedMax}
								disabled={fieldsDisabled}
								aria-label="Argument body"
								placeholder={MIRROR_COPY.detailPlaceholder}
								onChange={(e) => props.onExtendedInput(e.target.value)}
								data-testid="mirror-detail"
								// RF-6 — today's detail field, filling the same frame so
								// nothing jumps: 14px / 21px, n6, 14px 16px padding.
								// ⚠ NO RING, NO OUTLINE, NO GLOW (MIRROR-2). A text field
								// matches `:focus-visible` on every focus, mouse included, so
								// a ring here glowed each time someone clicked in to write.
								// Focus is shown by the FRAME instead — its edge lifts n2 →
								// n3 (`frameBorder`) — and by the caret.
								className="min-h-0 w-full flex-1 resize-none bg-transparent px-4 py-3.5 text-[14px] leading-[21px] text-n6 outline-none placeholder:text-n5 disabled:cursor-not-allowed disabled:opacity-(--state-disabled-opacity)"
							/>
							<span
								data-testid="mirror-detail-counter"
								className="shrink-0 px-4 pb-2.5 text-right text-[11px] leading-none text-n5"
							>
								{props.detailCounter}
							</span>
						</div>
					</div>
				</div>
				<ErrorStrip status={props.status} />
			</div>
			<StakeBar
				side={props.side}
				kind={props.kind}
				amount={props.amount}
				amountFieldWidth={props.amountFieldWidth}
				overCap={props.overCap}
				fieldsDisabled={fieldsDisabled}
				submitDisabled={props.submitDisabled}
				notice={props.notice}
				toWin={props.toWin}
				onAmountInput={props.onAmountInput}
				onAmountBlur={props.onAmountBlur}
				onSubmit={props.onSubmit}
			/>
			{props.suspendedDialog}
		</section>
	);
}

/**
 * RF-6 — the frame's edge, for the view it is showing. In the detail view it is
 * n2 at rest and LIFTS to n3 while the detail field has focus — that lift is the
 * field's whole focus treatment (MIRROR-2; the field itself draws no ring).
 * Around an image, solid n2; DASHED n3 while the image view is an invitation
 * (nothing picked, or a pick that was rejected and must be retried —
 * `ImageAttach`'s own "nothing in hand" rule). The edge never moves: on a switch
 * it changes in place while the content slides inside it.
 *
 * ⚠ `focus-within` IS ONLY EVER ADDED IN THE DETAIL VIEW. In the image view the
 * frame holds buttons (`Replace`, `Remove image`, the pick layer) that draw their
 * own keyboard rings; lifting the edge for them too would give one focus two
 * indicators. The hidden view is `inert`, so nothing in it can hold focus.
 */
function frameBorder(shown: MirrorView, image: ImageAttachState): string {
	if (shown === "detail") {
		return "border-n2 focus-within:border-n3";
	}
	return image.phase === "none" || image.phase === "error"
		? "border-dashed border-n3"
		: "border-n2";
}

/** The frame's two views (RF-5 / RF-6). */
type MirrorView = "image" | "detail";

/**
 * The composer's own slide duration (`ComposerSlot`'s `EXIT_MS`, canon §5's
 * `.26 s`), reused for the view switch.
 */
const SLIDE_MS = 260;

function prefersReducedMotion(): boolean {
	return (
		typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
	);
}

/**
 * RF-6 — THE VIEW SWITCH'S SLIDE: translateX ±36px + fade, at the composer slot's
 * duration and easing (260ms, tw-animate's `ease`). The image view lives on the
 * left and the detail view on the right, so going to detail slides image out to
 * the left and detail in from the right, and coming back is the mirror of it.
 *
 * ⚠ THE OUTGOING VIEW IS HELD FOR ONE DURATION, then hidden. React would hide it
 * on the same render that shows its successor, leaving nothing to animate out;
 * `leaving` keeps it drawn (non-interactive, `fill-mode-forwards` so it rests at
 * its exit frame) until the timer drops it.
 * ⚠ `prefers-reduced-motion` IS HONOURED IN JS as well as CSS, for
 * `ComposerSlot`'s reason: CSS alone would stop the motion but keep the hold, and
 * a view sitting motionless for a quarter-second is a stall, not an instant swap.
 * ⚠ The first render animates nothing: the composer's own slot slide is already
 * running as it opens, and a second motion inside it would read as a stutter.
 */
function useViewSlide(shown: MirrorView) {
	const [leaving, setLeaving] = useState<MirrorView | null>(null);
	const [moved, setMoved] = useState(false);
	useEffect(() => {
		if (leaving === null) {
			return;
		}
		const t = setTimeout(() => setLeaving(null), SLIDE_MS);
		return () => clearTimeout(t);
	}, [leaving]);
	const enter: Record<MirrorView, string> = {
		image: "animate-in fade-in-0 slide-in-from-left-[36px]",
		detail: "animate-in fade-in-0 slide-in-from-right-[36px]",
	};
	const exit: Record<MirrorView, string> = {
		image: "animate-out fade-out-0 slide-out-to-left-[36px] fill-mode-forwards",
		detail:
			"animate-out fade-out-0 slide-out-to-right-[36px] fill-mode-forwards",
	};
	const base =
		"absolute inset-0 flex flex-col duration-[260ms] motion-reduce:animate-none";
	return {
		leave(outgoing: MirrorView) {
			setMoved(true);
			setLeaving(prefersReducedMotion() ? null : outgoing);
		},
		attrs(which: MirrorView) {
			if (which === shown) {
				return {
					"data-mirror-view": which,
					"data-view-state": "shown",
					className: `${base}${moved ? ` ${enter[which]}` : ""}`,
				};
			}
			if (which === leaving) {
				return {
					"data-mirror-view": which,
					"data-view-state": "leaving",
					inert: true,
					"aria-hidden": true,
					className: `${base} pointer-events-none ${exit[which]}`,
				};
			}
			return {
				"data-mirror-view": which,
				"data-view-state": "hidden",
				hidden: true,
				inert: true,
				className: base,
			};
		},
	};
}

/**
 * RF-5 — the detail toggle: 118px wide, exactly the title block's 54px, beside it.
 * It changes the VIEW and nothing else — the image stays attached and the detail
 * stays typed whichever is showing, and both are sent.
 *
 * ⚠ `aria-pressed` is true only on the detail view (`Show image`), per RF-5.
 */
function DetailToggle({
	buttonRef,
	shown,
	hasDetail,
	onToggle,
}: {
	buttonRef: React.Ref<HTMLButtonElement>;
	shown: MirrorView;
	hasDetail: boolean;
	onToggle: () => void;
}) {
	const pressed = shown === "detail";
	const Icon = pressed ? ImageIcon : hasDetail ? Pencil : Plus;
	const label = pressed
		? MIRROR_COPY.showImage
		: hasDetail
			? MIRROR_COPY.editDetail
			: MIRROR_COPY.addDetail;
	return (
		<button
			ref={buttonRef}
			type="button"
			aria-pressed={pressed}
			onClick={onToggle}
			data-testid="mirror-detail-toggle"
			className="flex h-[54px] w-[118px] shrink-0 items-center justify-center gap-2 rounded-(--r) border border-n2 text-[14px] leading-5 text-n6 transition-colors outline-none hover:border-n3 hover:text-ink focus-visible:shadow-(--state-focus-ring) aria-pressed:border-n3 aria-pressed:bg-n1 aria-pressed:text-ink"
		>
			<Icon aria-hidden="true" className="size-4 shrink-0" />
			{label}
		</button>
	);
}

/**
 * RF-2 — a reply's statement: `Support|Counter <author>'s argument`, 16px/600, with
 * the `×` at the row's right end.
 *
 * ⛔ THE SLOT BEFORE `×` IS FF-1's, AND WHAT FILLS IT IS NOT BUILT HERE. RF-2
 * reserved `data-mirror-slot="friendly-fire"` while FF-1 was held; FF-1 then
 * shipped during MIRROR-1 (#568/#569, 2026-09-23), so the slot carries FF-1's own
 * switch element — passed down from the controller unchanged, the same node the
 * classic layout puts in its header row. On a Counter reply it is empty. It is
 * `display: contents`, so empty it has no box and adds no gap, and filled its
 * content lays out as part of the right-hand cluster, immediately before `×`.
 */
function StatementRow({
	statement,
	control,
	close,
}: {
	statement: string;
	control: ReactNode;
	close: ReactNode;
}) {
	return (
		<div
			data-testid="mirror-statement-row"
			className="flex shrink-0 items-center gap-2"
		>
			<span className="min-w-0 text-[16px] leading-[22px] font-semibold text-ink">
				{statement}
			</span>
			<div className="ml-auto flex shrink-0 items-center gap-2">
				<span data-mirror-slot="friendly-fire" className="contents">
					{control}
				</span>
				{close}
			</div>
		</div>
	);
}

/** Today's close control, unchanged in size and name — `aria-label="Close"`, a 44px target. */
function CloseButton({
	onClose,
	disabled,
	className,
}: {
	onClose: () => void;
	disabled: boolean;
	/** Placement only — `ml-auto` where the button itself must reach the row's end. */
	className?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClose}
			disabled={disabled}
			aria-label="Close"
			// The classic's own class string (`BetComposer`), plus `-mr-3` so the
			// glyph — not the 44px box around it — sits against the padding edge,
			// and `outline-none` so keyboard focus draws the ONE ring, the shadow,
			// rather than the UA's outline beside it (RF-6, MIRROR-2).
			className={`-my-3 -mr-3 flex size-11 shrink-0 items-center justify-center rounded-(--r-chip) text-xl text-n4 transition-all outline-none hover:text-ink focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity)${className ? ` ${className}` : ""}`}
		>
			{COMPOSER_COPY.close}
		</button>
	);
}

/**
 * RF-3 — the card header this draft will become: avatar · pseudonym | side chip |
 * `Đ {amount}` | `Draft`. The avatar, the chip and the separator are the card's own
 * components, not restyled; the avatar is only sized to RF-3's 28px.
 *
 * ⚠ THE PSEUDONYM IS TEXT HERE, NOT THE CARD'S PROFILE LINK. On the card the name
 * navigates to `/u/<name>`; in a composer that would throw away the argument being
 * typed.
 */
function AuthorRow(props: {
	side: Side;
	pseudonym: string | null;
	pfpUrl: string | null;
	chipPrice: string | undefined;
	amountEcho: string;
	close: ReactNode;
}) {
	return (
		<div
			data-testid="mirror-author-row"
			className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1"
		>
			<Avatar className="size-7">
				<AvatarImage src={props.pfpUrl ?? undefined} alt="" />
				<AvatarFallback>
					{(props.pseudonym ?? "").slice(0, 2).toUpperCase()}
				</AvatarFallback>
			</Avatar>
			{props.pseudonym !== null ? (
				<span className="text-[16px] leading-[22px] font-medium text-ink">
					{props.pseudonym}
				</span>
			) : null}
			<FieldSeparator />
			<SideBadge side={props.side} price={props.chipPrice} />
			<FieldSeparator />
			{/* `Đ {amount}` — the stake that would be placed, rounded and grouped by the
			    one display formatter (SPEC.1 §10.8), which is exactly the figure the
			    card will print once this posts. */}
			<span
				data-testid="mirror-amount-echo"
				className="font-mono text-[14px] leading-5 text-ink"
			>
				Đ {props.amountEcho}
			</span>
			<FieldSeparator />
			<span className="text-[14px] leading-5 text-n5">{MIRROR_COPY.draft}</span>
			{props.close}
		</div>
	);
}

/**
 * RF-4 (MIRROR-2) — the title field. A fixed 54px block with the n3 underline at
 * its foot. The type takes the largest size from 28px down to 13px at which the
 * text (or the placeholder) fits the block in at most two lines, centred in it;
 * the block never changes height while someone types (`mirror-sizing.ts`).
 *
 * ⚠ THE FIELD'S RULES ARE TODAY'S: the same accessible name, `maxLength`, Enter
 * block and newline strip (the controller's handlers, shared with the classic
 * layout), with the retired label `Your argument — required` as the placeholder.
 *
 * ⚠ WHY IT MEASURES A HIDDEN COPY, NOT THE FIELD. How many lines a title needs
 * is a fact about this font, this width and this browser's wrapping, so it is
 * measured, and it is measured on a second `textarea` with the same classes, the
 * same width and no transition. The field itself now EASES its size, and a
 * transitioned `font-size` read mid-flight reports the old value (RF-4 ⚠); the
 * field is also where the caret and the author's scroll position live, and
 * zeroing its height to read `scrollHeight` (what MIRROR-1 did) disturbs both.
 * The copy is the same element type in the same box, so it wraps the same way,
 * and it can hold the placeholder's words, which an empty field cannot report.
 *
 * ⚠ NO FOCUS RING, AND THE COMPOSER OPENS WITH THE CARET HERE. RF-4 puts the
 * cursor in the title on open; a text field matches `:focus-visible` whenever it
 * is focused, so the old ring would have glowed on every open without the author
 * doing anything. The caret marks the place — RF-6's rule for the composer's
 * other text field.
 */
function TitleField(props: {
	title: string;
	disabled: boolean;
	onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
	onInput: (value: string) => void;
}) {
	const ref = useRef<HTMLTextAreaElement | null>(null);
	const probeRef = useRef<HTMLTextAreaElement | null>(null);
	const [fit, setFit] = useState<TitleFit>(TITLE_FIT_AT_REST);
	const [widthPx, setWidthPx] = useState(0);
	// Size changes EASE once the author is typing. The first fit is not a change
	// they made — at a narrow slot it would otherwise animate from the at-rest
	// 28px while the composer is still sliding in.
	const [typed, setTyped] = useState(false);

	// RF-4 — the composer opens with the cursor in the title. A disabled field
	// (the C2 state) ignores `focus()`, which is right: there is nothing to type.
	// ⚠ ON THE PAGE THIS IS NOT WHAT PUTS IT THERE. The desktop host wraps the
	// composer in `ComposerSlot`, which moves focus into the slot AFTER this runs
	// (a parent's effects follow its children's) and would land on the first
	// focusable control, the `×`. `data-autofocus` on the field is what the slot
	// honours; this effect covers a host that moves no focus of its own.
	useEffect(() => {
		ref.current?.focus();
	}, []);

	// A width change re-wraps the same text, so it re-fits too. jsdom has no
	// ResizeObserver; the effect below reads the width directly on every run.
	useLayoutEffect(() => {
		const el = ref.current;
		if (el === null || typeof ResizeObserver === "undefined") {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width ?? 0;
			setWidthPx((prev) => (prev === w ? prev : w));
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	// Re-fit whenever the title or the field's width changes, before paint.
	// Until the observer has reported, the width is read off the field itself,
	// so the very first fit is already right rather than one frame late (and, at
	// a narrow slot, visibly wrong). Fractional on purpose: the copy must wrap
	// against exactly the field's width, and `clientWidth` rounds. With no layout
	// (jsdom, a hidden field) the width is 0 and the field rests at full size.
	useLayoutEffect(() => {
		const el = ref.current;
		const probe = probeRef.current;
		if (el === null || probe === null) {
			return;
		}
		const width = widthPx > 0 ? widthPx : el.getBoundingClientRect().width;
		if (width === 0) {
			setFit(TITLE_FIT_AT_REST);
			return;
		}
		probe.style.width = `${width}px`;
		probe.value =
			props.title.length > 0 ? props.title : COMPOSER_COPY.argumentLabel;
		const next = fitTitle((size) => {
			const lh = titleLineHeightPx(size);
			probe.style.fontSize = `${size}px`;
			probe.style.lineHeight = `${lh}px`;
			return Math.round(probe.scrollHeight / lh);
		});
		setFit((prev) =>
			prev.sizePx === next.sizePx && prev.lines === next.lines ? prev : next,
		);
	}, [props.title, widthPx]);

	const left = titleCharsLeft(props.title.length, TITLE_MAX_CHARS);
	return (
		<div className="relative min-w-0 flex-1">
			<textarea
				ref={ref}
				value={props.title}
				maxLength={TITLE_MAX_CHARS}
				disabled={props.disabled}
				aria-label="Argument title"
				placeholder={COMPOSER_COPY.argumentLabel}
				enterKeyHint="next"
				rows={2}
				onKeyDown={props.onKeyDown}
				onChange={(e) => {
					setTyped(true);
					props.onInput(e.target.value);
				}}
				style={{
					fontSize: `${fit.sizePx}px`,
					lineHeight: `${titleLineHeightPx(fit.sizePx)}px`,
					paddingTop: `${titlePaddingTopPx(fit)}px`,
				}}
				data-testid="mirror-title"
				// RF-4 — the slot's first focus (`ComposerSlot` honours it; without
				// it the slot's own focus move, which runs after this component's,
				// lands on the author row's `×`).
				data-autofocus=""
				// RF-4 — size, line height and the centring padding ease TOGETHER
				// (150ms), so the lines stay centred while they shrink; instant under
				// reduced motion.
				className={`block h-[54px] w-full resize-none rounded-none border-0 border-b border-n3 bg-transparent p-0 font-medium tracking-[-0.01em] text-ink outline-none placeholder:text-n5 disabled:cursor-not-allowed disabled:opacity-(--state-disabled-opacity)${
					typed
						? " transition-[font-size,line-height,padding-top] duration-150 ease-[ease] motion-reduce:transition-none"
						: ""
				}`}
			/>
			{/* The measuring copy. `invisible` keeps it laid out (so it can be
			    measured) and out of the accessibility tree and the tab order;
			    `h-0` + `overflow-hidden` + no padding make `scrollHeight` the height
			    of its lines alone. Same type classes as the field; no transition. */}
			<textarea
				ref={probeRef}
				aria-hidden="true"
				tabIndex={-1}
				readOnly
				rows={1}
				data-testid="mirror-title-probe"
				className="pointer-events-none invisible absolute top-0 left-0 block h-0 resize-none overflow-hidden rounded-none border-0 p-0 font-medium tracking-[-0.01em]"
			/>
			{left !== null ? (
				<span
					data-testid="mirror-title-left"
					// Absolutely positioned under the underline, so arriving and leaving
					// never moves the row (RF-4 ⚠).
					className="pointer-events-none absolute top-full right-0 mt-1 text-[11px] leading-none text-n5"
				>
					{MIRROR_COPY.left(left)}
				</span>
			) : null}
		</div>
	);
}

/**
 * RF-7 — the stake bar, pinned under the body. AMOUNT | TO WIN | Min/Max | submit.
 *
 * ⚠ SPACING (MIRROR-2): no group grows. The free space is shared equally between
 * every pair of neighbours, hairlines included (`justify-between`), which is the
 * founder's render: every drawn thing an equal step from the next. MIRROR-1 let
 * the limits column grow, so the three figures bunched left and the only wide gap
 * was the one before the submit.
 *
 * ⛔ EVERY PREDICATE HERE IS THE CONTROLLER'S. The submit's `disabled`, the
 * notice, the to-win figure and the amount field's handlers all arrive computed;
 * this bar lays them out.
 *
 * ⚠ RF-7's NARROW-WIDTH RULE — "shrink the submit first (floor 140px), then the TO
 * WIN column". Flex shrink is proportional, not sequential, so the order is built
 * from weights: the submit's shrink factor dwarfs every other item's, so it takes
 * the whole deficit until its 140px floor freezes it, and only then does the TO
 * WIN column — the one other shrinkable item — give (its figure ellipsizes only at
 * extremes). The limit lines never wrap: `Min Đ 10` broken over three lines in a
 * 24px column was what the first measurement actually found.
 * ⚠ MEASURED, NOT GUESSED: with the limits held on one line each, the row holds
 * down to roughly 400px of section content with the submit at its floor; below
 * that (the 640–770px band of the desktop tier) the submit takes a full-width
 * line of its own rather than cutting a money figure further. The bar's content
 * is 44px (the submit) inside 4px padding and its border, so its RF-7 height is
 * the 56px floor itself.
 */
function StakeBar(props: {
	side: Side;
	kind: ComposerKind;
	amount: string;
	amountFieldWidth: string;
	overCap: boolean;
	fieldsDisabled: boolean;
	submitDisabled: boolean;
	notice: string | null;
	toWin: string | null;
	onAmountInput: (value: string) => void;
	onAmountBlur: () => void;
	onSubmit: () => void;
}) {
	return (
		<div
			data-testid="mirror-stake-bar"
			// RF-7 (MIRROR-2) — `justify-between`: the free space is shared out
			// EQUALLY between every pair of neighbours — AMOUNT, hairline, TO WIN,
			// hairline, limits, submit — so the figures no longer bunch on the left
			// with one wide hole before the submit, and each hairline sits at the
			// centre of the gap it divides. `gap-3` is the floor under every gap.
			className="flex min-h-14 shrink-0 items-center justify-between gap-3 rounded-(--r) border border-n2 px-3 py-1 @max-[400px]/mirror:flex-wrap @max-[400px]/mirror:py-1.5"
		>
			<div className="flex shrink-0 flex-col justify-center gap-0.5">
				<span className="text-[11px] leading-3 font-medium tracking-[0.12em] text-n5 uppercase">
					{COMPOSER_COPY.amountLabel}
				</span>
				<span className="flex items-baseline gap-1 border-b border-n3">
					<span className="text-[15px] text-n5">Đ</span>
					<input
						value={props.amount}
						inputMode="decimal"
						enterKeyHint="done"
						disabled={props.fieldsDisabled}
						aria-label="Stake amount"
						style={{ width: props.amountFieldWidth }}
						onChange={(e) => props.onAmountInput(e.target.value)}
						onBlur={props.onAmountBlur}
						className={`bg-transparent p-0 font-mono text-[22px] leading-7 font-semibold tabular-nums outline-none focus-visible:shadow-(--state-focus-ring) disabled:cursor-not-allowed disabled:opacity-(--state-disabled-opacity) ${
							props.overCap ? "text-n4" : "text-ink"
						}`}
					/>
				</span>
			</div>
			<Hairline />
			<div
				data-testid="mirror-to-win"
				className="flex min-w-0 shrink flex-col justify-center gap-0.5"
			>
				<span className="truncate text-[11px] leading-3 font-medium tracking-[0.12em] text-n5 uppercase">
					{COMPOSER_COPY.toWinLabel}
				</span>
				{/* RF-7 (MIRROR-2) — styled like AMOUNT: a small n5 `Đ`, then the
				    figure in mono 22px/600, with no underline (TO WIN is read, not
				    typed). No figure yet → today's `—`, alone. The space between the
				    two spans takes no room in the flex row; it keeps the announced
				    and copied text `Đ 2,445` rather than `Đ2,445`. */}
				<span aria-live="polite" className="flex min-w-0 items-baseline gap-1">
					{props.toWin !== null ? (
						<>
							<span className="shrink-0 text-[15px] text-n5">Đ</span>{" "}
							<span className="truncate font-mono text-[22px] leading-7 font-semibold text-ink">
								{props.toWin}
							</span>
						</>
					) : (
						<span className="font-mono text-[22px] leading-7 font-semibold text-ink">
							—
						</span>
					)}
				</span>
			</div>
			<Hairline />
			<div
				data-testid="mirror-limits"
				// Min/Max take their own width, so the bar's free space goes to the
				// gaps (RF-7). A validation notice is different: it is a sentence
				// that must WRAP into the room left, so while one shows this column
				// takes the free space as it did before MIRROR-2.
				className={`flex flex-col justify-center text-[12px] leading-4 text-n5${
					props.notice !== null ? " min-w-0 flex-1" : ""
				}`}
			>
				{props.notice !== null ? (
					// Today's three validation notices (C2 · 429 · over-cap), same
					// precedence and same words, in the place RF-7 gives them.
					<p role="status" className="text-ink">
						{props.notice}
					</p>
				) : (
					<>
						<span className="whitespace-nowrap">
							{MIRROR_COPY.minLabel}{" "}
							<span className="font-medium text-n6">
								Đ {formatDharma(floorFor(props.kind))}
							</span>
						</span>
						<span className="whitespace-nowrap">
							{MIRROR_COPY.maxLabel}{" "}
							<span className="font-medium text-n6">
								Đ {formatDharma(BET_MAX_STAKE)}
							</span>
						</span>
					</>
				)}
			</div>
			<button
				type="button"
				disabled={props.submitDisabled}
				aria-disabled={props.submitDisabled}
				aria-label={COMPOSER_COPY.submit}
				onClick={props.onSubmit}
				data-testid="mirror-submit"
				// RF-7 — 170 × 44, 15px/700, .08em; the POLE of the side being bet,
				// through the pole tokens only (`side-pole-binding.test.ts`): YES is the
				// #181818 fill with an ink edge and ink text, NO the ink fill with #181818
				// text. `--color-no` IS #fafafa, so `text-no`/`border-no` are RF-7's "ink"
				// spelled as the pole it is; the NO edge matches its fill, so both poles
				// are the same box.
				// ⚠ A PLAIN BUTTON, NOT `ui/button`: the primitive's default variant paints
				// its own fill and a `--hairline` border shorthand, and swaps the fill on
				// hover and press — every one of which would repaint a pole. The disabled
				// treatment and the transition are the primitive's, copied; the focus ring
				// is the minted `--state-focus-ring-pole`, whose n0 gap keeps it visible
				// against a white NO fill.
				className={`inline-flex h-11 min-w-[140px] shrink-[1000] basis-[170px] items-center justify-center rounded-(--r) border px-3 text-[15px] leading-none font-bold tracking-[0.08em] whitespace-nowrap transition-all outline-none select-none focus-visible:shadow-(--state-focus-ring-pole) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity) @max-[400px]/mirror:basis-full ${
					props.side === "YES"
						? "border-no bg-yes text-no"
						: "border-no bg-no text-yes"
				}`}
			>
				{COMPOSER_COPY.submit}
			</button>
		</div>
	);
}

/**
 * The stake bar's column separator. Hidden once the bar wraps (below ~400px of
 * section content): a separator that ends a line separates nothing, and it is
 * what the 640px measurement found stranded after TO WIN.
 */
function Hairline() {
	return (
		<span
			aria-hidden="true"
			className="h-9 w-px shrink-0 bg-n2 @max-[400px]/mirror:hidden"
		/>
	);
}
