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
import { COMPOSER_COPY, MIRROR_COPY } from "./copy";
import { type ComposerStatus, ErrorStrip } from "./ErrorStrip";
import { type ComposerKind, floorFor } from "./gating";
import { ImageAttach, type ImageAttachState } from "./ImageAttach";
import {
	fitTitleSize,
	TITLE_SIZE_MAX_PX,
	titleCharsLeft,
	titleLineHeightPx,
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
	// Moving to the detail view is asking to write detail: focus follows. Moving
	// back leaves focus on the toggle, where the reader pressed it.
	const focusDetail = useRef(false);
	useEffect(() => {
		if (shown === "detail" && focusDetail.current) {
			focusDetail.current = false;
			detailRef.current?.focus();
		}
	}, [shown]);
	const toggleView = () => {
		const next: MirrorView = view === "image" ? "detail" : "image";
		focusDetail.current = next === "detail";
		slide.leave(view);
		setView(next);
	};

	return (
		<section
			// RF-9 — the post composer no longer SHOWS `Place your Đ BET`; it stays the
			// section's accessible name, exactly as today.
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
			    `-m-0.5 p-0.5` gives a 2px focus ring room inside the scroll clip. */}
			<div
				data-testid="mirror-body"
				className="-m-0.5 flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-0.5"
			>
				{props.replyStatement !== null ? (
					<StatementRow
						statement={props.replyStatement}
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
								// nothing jumps: 14px / 21px, n6, 14px 16px padding. The n3
								// edge is the frame's own while this view shows.
								className="min-h-0 w-full flex-1 resize-none bg-transparent px-4 py-3.5 text-[14px] leading-[21px] text-n6 outline-none placeholder:text-n5 focus-visible:shadow-[inset_var(--state-focus-ring)] disabled:cursor-not-allowed"
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
 * RF-6 — the frame's edge, for the view it is showing. The detail view's n3 edge;
 * solid n2 around an image; DASHED n3 while the image view is an invitation
 * (nothing picked, or a pick that was rejected and must be retried —
 * `ImageAttach`'s own "nothing in hand" rule). The edge never moves: on a switch
 * it changes in place while the content slides inside it.
 */
function frameBorder(shown: MirrorView, image: ImageAttachState): string {
	if (shown === "detail") {
		return "border-n3";
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
	shown,
	hasDetail,
	onToggle,
}: {
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
 * ⛔ THE EMPTY SLOT BEFORE `×` IS RESERVED, NOT FORGOTTEN. FF-1's friendly-fire
 * switch lands in `data-mirror-slot="friendly-fire"`; nothing is built in it here.
 * It is `display: contents`, so while empty it has no box and adds no gap, and
 * whatever is later put inside it lays out as part of the right-hand cluster,
 * immediately before the `×`.
 */
function StatementRow({
	statement,
	close,
}: {
	statement: string;
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
				<span data-mirror-slot="friendly-fire" className="contents" />
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
			// glyph — not the 44px box around it — sits against the padding edge.
			className={`-my-3 -mr-3 flex size-11 shrink-0 items-center justify-center rounded-(--r-chip) text-xl text-n4 transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity)${className ? ` ${className}` : ""}`}
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
 * RF-4 — the title field. A fixed 54px block (two 22px lines at 16px, the n3
 * underline at its foot); when the text would need a third line the TYPE steps
 * down half a pixel at a time to 13px, and the block never changes height.
 *
 * ⚠ THE FIELD'S RULES ARE TODAY'S: the same accessible name, `maxLength`, Enter
 * block and newline strip (the controller's handlers, shared with the classic
 * layout), with the retired label `Your argument — required` as the placeholder.
 *
 * ⚠ WHY IT MEASURES THE REAL FIELD. How many lines a title needs is a fact about
 * this font, this width and this browser's wrapping. At each candidate size the
 * field's height is set to 0 so `scrollHeight` reports the content alone, then
 * restored — all inside one layout effect, before paint, so no intermediate size
 * is ever seen. A hidden copy was rejected: it is a second wrapping model that can
 * disagree with the textarea it stands in for.
 */
function TitleField(props: {
	title: string;
	disabled: boolean;
	onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
	onInput: (value: string) => void;
}) {
	const ref = useRef<HTMLTextAreaElement | null>(null);
	const [sizePx, setSizePx] = useState(TITLE_SIZE_MAX_PX);
	const [widthPx, setWidthPx] = useState(0);

	// A width change re-wraps the same text, so it re-fits too. jsdom has no
	// ResizeObserver and performs no layout; the field simply stays at 16px there.
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

	// Re-fit whenever the title or the field's width changes. Two cases need no
	// measurement and take the full size: an EMPTY field is its placeholder, one
	// line at 16px; and before the field has a measured width there is nothing to
	// wrap against (jsdom, and the one layout pass before the observer reports).
	useLayoutEffect(() => {
		const el = ref.current;
		if (el === null) {
			return;
		}
		if (props.title.length === 0 || widthPx === 0) {
			setSizePx(TITLE_SIZE_MAX_PX);
			return;
		}
		const saved = {
			height: el.style.height,
			fontSize: el.style.fontSize,
			lineHeight: el.style.lineHeight,
		};
		const next = fitTitleSize((size) => {
			const lh = titleLineHeightPx(size);
			el.style.fontSize = `${size}px`;
			el.style.lineHeight = `${lh}px`;
			el.style.height = "0px";
			return Math.round(el.scrollHeight / lh);
		});
		el.style.height = saved.height;
		el.style.fontSize = saved.fontSize;
		el.style.lineHeight = saved.lineHeight;
		setSizePx(next);
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
				onChange={(e) => props.onInput(e.target.value)}
				style={{
					fontSize: `${sizePx}px`,
					lineHeight: `${titleLineHeightPx(sizePx)}px`,
				}}
				data-testid="mirror-title"
				className="block h-[54px] w-full resize-none rounded-none border-0 border-b border-n3 bg-transparent p-0 font-medium tracking-[-0.01em] text-ink outline-none placeholder:text-n5 focus-visible:shadow-(--state-focus-ring) disabled:cursor-not-allowed"
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
 * ⛔ EVERY PREDICATE HERE IS THE CONTROLLER'S. The submit's `disabled`, the
 * notice, the to-win figure and the amount field's handlers all arrive computed;
 * this bar lays them out.
 *
 * ⚠ RF-7's NARROW-WIDTH RULE — "shrink the submit first (floor 140px), then the TO
 * WIN column". Flex shrink is proportional, not sequential, so the order is built
 * from weights: the submit's shrink factor dwarfs every other item's, so it takes
 * the whole deficit until its 140px floor freezes it, and only then does the TO
 * WIN column — the one other shrinkable item — give. Below the width where even
 * that cannot hold the row, the submit wraps to a full-width line of its own
 * (container query on the section) rather than cutting a money figure.
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
			className="flex min-h-14 shrink-0 items-center gap-3 rounded-(--r) border border-n2 px-3 py-1.5 @max-[460px]/mirror:flex-wrap"
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
						className={`bg-transparent p-0 font-mono text-[22px] leading-7 font-semibold tabular-nums outline-none focus-visible:shadow-(--state-focus-ring) disabled:cursor-not-allowed ${
							props.overCap ? "text-n4" : "text-ink"
						}`}
					/>
				</span>
			</div>
			<Hairline />
			<div className="flex min-w-0 shrink flex-col justify-center gap-0.5">
				<span className="text-[11px] leading-3 font-medium tracking-[0.12em] text-n5 uppercase">
					{COMPOSER_COPY.toWinLabel}
				</span>
				<span
					aria-live="polite"
					className="font-mono text-[20px] leading-7 font-semibold whitespace-nowrap text-ink"
				>
					{props.toWin !== null ? `Đ ${props.toWin}` : "—"}
				</span>
			</div>
			<Hairline />
			<div
				data-testid="mirror-limits"
				className="flex flex-1 flex-col justify-center text-[12px] leading-4 text-n5"
			>
				{props.notice !== null ? (
					// Today's three validation notices (C2 · 429 · over-cap), same
					// precedence and same words, in the place RF-7 gives them.
					<p role="status" className="text-ink">
						{props.notice}
					</p>
				) : (
					<>
						<span>
							{MIRROR_COPY.minLabel}{" "}
							<span className="font-medium text-n6">
								Đ {formatDharma(floorFor(props.kind))}
							</span>
						</span>
						<span>
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
				className={`inline-flex h-11 min-w-[140px] shrink-[1000] basis-[170px] items-center justify-center rounded-(--r) border px-3 text-[15px] leading-none font-bold tracking-[0.08em] whitespace-nowrap transition-all outline-none select-none focus-visible:shadow-(--state-focus-ring-pole) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity) @max-[460px]/mirror:basis-full ${
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

function Hairline() {
	return <span aria-hidden="true" className="h-9 w-px shrink-0 bg-n2" />;
}
