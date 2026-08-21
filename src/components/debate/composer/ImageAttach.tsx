"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { IMAGE_UPLOADS_ALLOWED_MIME } from "@/server/config/limits";
import { EMPTY_SLOT_COPY, STATE_COPY } from "./copy";

/**
 * The GROUP's name — the column as a whole, held across every phase.
 *
 * ⛔ DISTINCT FROM `PICK_LABEL` BY CONSTRUCTION, and the two are different
 * objects: a `role=group` names the region, a `button` names the action. When
 * the a11y fix moved this label onto the `<fieldset>`, the pick control was
 * left deriving its name from its own contents — the label, the caption that
 * used to sit under it, and the FILENAME while attaching — so the control's
 * name changed under the user mid-interaction. Restoring an explicit one also
 * keeps `getByLabelText(ATTACH_LABEL)` resolving to exactly one node;
 * `attach-phases.test.tsx` asserts both the distinctness and the singleness,
 * so collapsing them back to one string reddens.
 *
 * ⚠ The derived-name hazard OUTLIVES the caption that first caused it, which is
 * why this label is not now redundant: the figure inside the box carries its
 * own text, and an `aria-hidden` on that SVG is what keeps it out of the
 * control's accessible name. Drop either guard and the name starts moving again.
 */
const ATTACH_LABEL = "Attach an image";
/** The pick CONTROL's own name — stable across idle / busy / error. */
const PICK_LABEL = "Choose an image file";

/**
 * THE EMPTY SLOT'S CONTENTS — the thesis figure, in the box that used to be
 * empty.
 *
 * ⛔ THE DRAWING IS REUSED, NOT AUTHORED. Every mark below is carried from the
 * O1 deck's Card-3 figure, `onboarding/figures.tsx` `GoalFigure` — the beam on
 * its triangular fulcrum tilted so the knowledge side sits LOWER, the seven
 * filled dots labelled `K · n`, the outlined circle holding `C` labelled
 * `capital`, the 2 / 1.5 stroke weights, and the hierarchy that renders the
 * knowledge side solid and the capital side hollow. Stated per element rather
 * than as one sweeping claim, because the one thing that is NOT carried is the
 * LAYOUT: `GoalFigure` is landscape (`viewBox 220×120`, 1.83:1) and this box is
 * 4:5 portrait. Dropping it in unchanged would letterbox it to roughly a third
 * of the available height — so the composition is re-laid for portrait while
 * the vocabulary is left alone. Nothing here is a new drawing.
 *
 * ⚠ THE WORDS ARE THE PAYLOAD; THE DRAWING IS SUPPORT. At the real rendered
 * width (~250px) the viewBox scales 1.25×, so the headline lands near 16px and
 * `Add Image` near 14px. The scale occupies the top ~43% and no more: when the
 * two competed for room the drawing was the one that gave way, because a
 * participant who cannot read the sentence has been shown nothing.
 *
 * ⚠ `Add Image` IS THE ONLY AFFORDANCE TEXT LEFT. Canon §6's caption
 * `Shown whole · any orientation` sat under this box and was deleted; the label
 * `Image` outside the box names the field, not the action. So this line is the
 * sole thing telling a participant the box can be clicked. It is given real
 * vertical separation from the headline (42 user units — more than twice the
 * headline's own line gap) so it reads as an instruction rather than a fourth
 * line of the sentence, and it takes the SAME fill as the headline, so nothing
 * about its priority is hedged. Title Case is part of that: it reads as a
 * control's label rather than as more of the sentence above it.
 *
 * ⚠ TOKENS ONLY — no hex literal appears here, and THE WHOLE FIGURE SITS ONE
 * RUNG DOWN THE RAMP FROM WHERE IT STARTED (`ink`→`n6`, `n6`→`n5`, `n5`→`n4`).
 * It is a PLACEHOLDER: it occupies the space a participant's own image will
 * take, so it must not carry the weight of real content. Drawn at `ink` it read
 * as the brightest thing in the composer — louder than the argument being typed
 * beside it — which is the wrong claim for something that exists to be replaced.
 *
 * ⛔ ONE UNIFORM STEP, NOT A RE-PICK PER ELEMENT, and that is what keeps this
 * safe: every internal relationship — structure over label, knowledge side solid
 * over capital side hollow, headline over eyebrow — is preserved exactly, so the
 * figure recedes without being redesigned. Computed against `bg-n1` (#2a2a2a),
 * not eyeballed: headline and `Add Image` at `n6` = **7.64:1**, `K · n` at `n5`
 * = **4.98:1** — both clear the 4.5:1 AA floor, so the step costs no legibility
 * where legibility is the point. `ink` was 13.75:1, which is the number that
 * made it read as foreground rather than as a placeholder. Only decoration
 * reaches `n4` (3.07:1) — the hangers, the capital circle and its two small
 * labels, and the eyebrow — none of which must be read to use the control.
 *
 * `aria-hidden` is on the `<svg>` per the a11y contract at the top of this
 * file: the pick control owns the accessible name, and text inside this figure
 * must not leak into it.
 */
function EmptySlotFigure({ className }: { className: string }) {
	const [headOne, headTwo] = EMPTY_SLOT_COPY.headlineLines;
	return (
		<svg viewBox="0 0 200 250" aria-hidden="true" className={className}>
			{/* ── the balance ──────────────────────────────────────────────── */}
			{/* Beam: left (knowledge) end LOWER — the thesis, drawn. */}
			<line
				x1="38"
				y1="53"
				x2="162"
				y2="31"
				stroke="var(--color-n6)"
				strokeWidth="2"
			/>
			<line
				x1="100"
				y1="42"
				x2="100"
				y2="86"
				stroke="var(--color-n6)"
				strokeWidth="2"
			/>
			<polygon points="90,96 110,96 100,86" fill="var(--color-n6)" />
			<circle cx="100" cy="42" r="3" fill="var(--color-n6)" />
			{/* Left pan — seven dots, solid: knowledge has mass. */}
			<line
				x1="38"
				y1="53"
				x2="38"
				y2="64"
				stroke="var(--color-n4)"
				strokeWidth="1.5"
			/>
			<g fill="var(--color-n6)">
				<circle cx="28" cy="70" r="4" />
				<circle cx="38" cy="70" r="4" />
				<circle cx="48" cy="70" r="4" />
				<circle cx="33" cy="79" r="4" />
				<circle cx="43" cy="79" r="4" />
				<circle cx="28" cy="88" r="4" />
				<circle cx="38" cy="88" r="4" />
			</g>
			<text
				x="38"
				y="104"
				textAnchor="middle"
				fontSize="11"
				fontWeight="800"
				fill="var(--color-n5)"
			>
				K · n
			</text>
			{/* Right pan — one hollow circle: capital is lighter here. */}
			<line
				x1="162"
				y1="31"
				x2="162"
				y2="43"
				stroke="var(--color-n4)"
				strokeWidth="1.5"
			/>
			<circle
				cx="162"
				cy="58"
				r="13"
				fill="none"
				stroke="var(--color-n4)"
				strokeWidth="2"
			/>
			<text
				x="162"
				y="63"
				textAnchor="middle"
				fontSize="13"
				fontWeight="800"
				fill="var(--color-n4)"
			>
				C
			</text>
			<text
				x="162"
				y="86"
				textAnchor="middle"
				fontSize="9.5"
				fontWeight="700"
				fill="var(--color-n4)"
			>
				capital
			</text>
			{/* ── the words ────────────────────────────────────────────────── */}
			<text
				x="100"
				y="136"
				textAnchor="middle"
				fontSize="8.5"
				fontWeight="700"
				letterSpacing="1.4"
				fill="var(--color-n4)"
			>
				{EMPTY_SLOT_COPY.eyebrow}
			</text>
			<text
				x="100"
				y="161"
				textAnchor="middle"
				fontSize="13"
				fontWeight="700"
				fill="var(--color-n6)"
			>
				{headOne}
			</text>
			<text
				x="100"
				y="179"
				textAnchor="middle"
				fontSize="13"
				fontWeight="700"
				fill="var(--color-n6)"
			>
				{headTwo}
			</text>
			{/* The instruction. Separated, not stacked — see the docblock. */}
			<text
				x="100"
				y="221"
				textAnchor="middle"
				fontSize="11"
				fontWeight="700"
				letterSpacing="0.6"
				fill="var(--color-n6)"
			>
				{EMPTY_SLOT_COPY.action}
			</text>
		</svg>
	);
}

/** The affordance's render state (owned by the composer). */
export type ImageAttachState =
	| { phase: "none" }
	| { phase: "attaching"; name: string }
	| { phase: "attached"; uploadId: string; name: string }
	| { phase: "error"; message: string };

/**
 * UI.A3 slice 5 — the composer's optional-image affordance (canon §6 label
 * `Image`). The composer owns the state + the attach orchestration
 * (image-attach.ts); this renders pick / busy / attached / error (the §4
 * image-codes P3 lands INLINE here — never a composer-level strip). Error
 * messages are the wire's own display strings.
 *
 * ⚠ CANON §6 ALSO CARRIES A CAPTION, `Shown whole · any orientation`, AND IT IS
 * NO LONGER SHIPPED HERE. It was deleted at POLISH-4-EMPTYSLOT so the empty box
 * could carry the thesis figure instead of a line describing how a picture that
 * is not there would be fitted. `design-canon.md:123` still lists it, so canon
 * and code now disagree on this one string by DECISION, not by drift — the
 * amendment is owed and is web-authored (prescriptive docs are not CC's to
 * edit). Do not "restore" it to close the gap.
 *
 * POLISH.4 PR B — THE PANEL IS THE COMPOSER GRID'S LEFT COLUMN, and the whole
 * panel is the pick target. Tier-4 `surface_d5_v1_0.html` (md5
 * 34619dacee472a245cb6e8678b509219): `.attach` is a full-height panel
 * (`height:100%`, `cursor:pointer`) holding a `4:5` `.imgprev` over the
 * `.acap` caption, sitting in the FIRST track of `.compgrid` (d5 `.attach` /
 * `.imgprev` / `.acap`; markup at the `.compgrid` block). Fenced by SYMBOL
 * per `O-8`. The `.acap` half of that composition is the caption above and is
 * now gone; the `.imgprev` box it names is unchanged.
 *
 * ⚠ RENDERS AS A FRAGMENT, DELIBERATELY. The panel must be a DIRECT child of
 * the grid or it is not a column — a wrapper `<div>` here would make the grid
 * one-column with everything nested inside it. The hidden `<input type=file>`
 * is `display:none` and so generates no grid track; it is the one sibling.
 *
 * ⛔ NO VALUE IS CARRIED OUT OF THE MOCKUP (`H-VALUE`). The mockup is a
 * light-mode pre-BRIDGE prototype and its ramp is INVERTED against the shipped
 * dark true-neutral system. Provenance, stated per class rather than as one
 * sweeping claim — an earlier draft of this block asserted "every class below
 * is byte-carried from this file's own shipped render", which was FALSE for
 * six of them and is the `V-3` shape: a pre-verification that reads as checked
 * and does not resolve (`@code-reviewer`, MEDIUM):
 *   · from THIS FILE at `8db535d` — `[border:var(--hairline)]`, `bg-n1`,
 *     `text-n5`, `text-n4`, `text-[10px]`, `rounded-(--r-chip)`, `truncate`,
 *     `min-w-0`, `font-mono text-ink`, `font-semibold text-ink`;
 *   · from the RATIFIED token set — `rounded-(--imgr)` (values-log §3 item 2);
 *   · from SHIPPED CODE TREE-WIDE, not from d5 — `p-3`, `h-full`, `flex-1`,
 *     `gap-2`, `text-center`, `max-w-full`, `min-h-0`, `w-full`, `max-h-full`;
 *   · PROPORTIONS, which are arrangement, not values — `aspect-[4/5]`,
 *     `max-h-full` (d5's `max-height:calc(100% - 22px)` MINUS its `22px`).
 * REFUSED, not ported: d5's `1px dashed var(--n3)` edge (the panel takes the
 * shipped hairline), its `minmax(210px, …)` track floor, its `22px` height
 * offset, and its literal `IMAGE` placeholder label — the state carries no
 * preview data, so that string would claim a preview that does not exist.
 * ⚠ `max-w-40` was ALSO refused after review: it exists in shipped code only
 * as this file's old FILENAME truncation cap, so re-roling it as a 160px
 * preview cap would be byte-carrying a string without its role, and it
 * silently swapped d5's height-based containment for a width-based one.
 */
export function ImageAttach({
	state,
	disabled,
	onPick,
	onRemove,
}: {
	state: ImageAttachState;
	disabled: boolean;
	onPick: (file: File) => void;
	onRemove: () => void;
}) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	// POLISH-4-PREVIEW — the LOCAL preview of the file the user just picked.
	//
	// ⛔ WHY THIS EXISTS AT ALL. The R2 object is immutable from first write
	// (ADR-0028 primitive 1) and the comment that carries it is append-only
	// (INV-4). A mis-picked image is therefore permanent AND public, and this
	// slot is the last place a human can catch it. Until now the slot proved
	// only that SOME file was picked — it showed a truncated filename over an
	// empty box, which confirms the act and not the content.
	//
	// It is deliberately NOT lifted into `ImageAttachState`. The composer owns
	// the ATTACH lifecycle (sign → PUT → uploadId); the preview is a property of
	// the local `File` and never leaves the browser, so widening the shared state
	// would push a client-only concern through a seam that exists for the wire.
	// Keeping it here is also what makes one edit serve both composers — post and
	// reply mount the same `BetComposer`, which imports this component once.
	//
	// `previewRef` shadows the state ON PURPOSE: the unmount cleanup below must
	// revoke whatever URL is live at teardown, and a cleanup closing over
	// `previewUrl` would capture a stale one.
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const previewRef = useRef<string | null>(null);
	// ONE mutator owns EVERY revoke. Because it always releases the outgoing URL
	// before adopting the next, replacement cannot leak — there is no ordering a
	// caller could get wrong, which is the whole reason the revoke does not live
	// at the call sites.
	const setPreview = useCallback((next: string | null) => {
		if (previewRef.current !== null) {
			URL.revokeObjectURL(previewRef.current);
		}
		previewRef.current = next;
		setPreviewUrl(next);
	}, []);
	// Teardown — and, with it, SUCCESSFUL SUBMIT. On success the composer calls
	// `props.onClose()`, and both mount sites render `BetComposer` conditionally
	// on the very state that closes (`DebateView` post: `openSide`; reply:
	// `openReply`), so a successful place unmounts this component. That makes the
	// submit-time release structural rather than a hook someone must remember to
	// add — the two paths are one path.
	useEffect(
		() => () => {
			if (previewRef.current !== null) {
				URL.revokeObjectURL(previewRef.current);
				previewRef.current = null;
			}
		},
		[],
	);
	// Any phase that is not holding a file drops the preview. This is both the
	// CLEAR path (Remove → `none`) and the FAILURE path (→ `error`) — a failed
	// attach must not leave an image on screen implying it succeeded.
	//
	// ⚠ THIS ENFORCES AN INVARIANT, IT DOES NOT WATCH A TRANSITION, and the
	// difference is load-bearing. Keyed on `state.phase` alone the effect fires
	// only when the phase CHANGES — so a preview minted while the phase happened
	// to stay put would survive indefinitely, and the component would be relying
	// on the parent to flip a value in order to clean up after itself.
	// `previewUrl` is in the deps so the rule "a preview exists only while
	// attaching or attached" is re-checked whenever EITHER side moves.
	//
	// The reachable case: `BetComposer.onPickImage` returns EARLY when `inFlight`
	// (`BetComposer.tsx:242-244`) and never moves the phase. The pick control is
	// disabled in flight, but the native file dialog is ASYNCHRONOUS — it can be
	// opened before the composer goes in flight and resolved after, so the change
	// event lands in a parent that drops it. Pinned by
	// `attach-preview.test.tsx::preview::a-pick-the-composer-drops-does-not-strand-an-image`,
	// which reddens if these deps are narrowed back.
	useEffect(() => {
		if (
			previewUrl !== null &&
			state.phase !== "attaching" &&
			state.phase !== "attached"
		) {
			setPreview(null);
		}
	}, [state.phase, previewUrl, setPreview]);
	// `.attach` — the panel chrome, one shape in every phase so the column does
	// not resize as the state moves through pick → busy → attached → error.
	// `min-w-0` is LOAD-BEARING: a fieldset's UA `min-inline-size:min-content`
	// would otherwise refuse to shrink inside the grid track.
	const panel =
		"flex h-full min-w-0 flex-col items-center justify-center gap-2 rounded-(--imgr) p-3 text-center text-xs [border:var(--hairline)]";
	// `.imgprev` — d5's `width:100%; aspect-ratio:4/5; max-height:calc(100% - 22px)`
	// ported as PROPORTIONS ONLY: the `- 22px` is a value and is refused, so the
	// clamp lands as `max-h-full`. Keeping d5's height clamp is what stops the
	// preview from driving the composer's height off the grid row.
	const preview =
		"aspect-[4/5] max-h-full min-h-0 w-full rounded-(--imgr) bg-n1";
	// The slot's CONTENT — the same node at both render sites below, so the
	// preview is present while `attaching` too and never waits on the PUT.
	//
	// ⚠ `object-contain` STANDS ON ITS OWN, and it has to now. It used to be
	// justified by the caption beneath the box — canon §6's "Shown whole · any
	// orientation" — which POLISH-4-EMPTYSLOT deletes. Deleting the words does
	// not change the obligation they described: a FIXED 4:5 box must either crop
	// the image or letterbox it, and cropping is not a neutral default here.
	// The bytes about to be written are immutable from first write (ADR-0028
	// primitive 1) inside a comment that is append-only (INV-4), so a crop the
	// participant did not choose becomes permanent and public along with them.
	// Letterboxing shows the whole of what they picked; a crop silently decides
	// which part of it they meant. That is the argument, and it survives the
	// caption. The `<img>` default (`fill`) would DISTORT and is wrong on both
	// counts. `bg-n1` is the box's own surface and becomes the letterbox ground,
	// so nothing new is coloured — no token added or referenced.
	//
	// ⛔ d5's `.imgprev` is an EMPTY box centring the literal string `IMAGE` at
	// all four occurrences, with no populated variant — so the BOX is carried
	// from d5 and the FIT is reasoned above. The empty arm no longer renders
	// nothing: it renders `EmptySlotFigure`, which is why the refusal recorded
	// in the header docblock (d5's `IMAGE` label, declined because "the state
	// carries no preview data") is now discharged rather than merely standing —
	// the box says what it is for, in words the participant has already read.
	//
	// ⚠ THREE ARMS, NOT TWO, AND THE MIDDLE ONE IS THE REACHABLE EDGE. "No
	// preview URL" and "no file picked" are DIFFERENT conditions, and they come
	// apart wherever the `onError` fallback below clears the URL because a picked
	// file will not decode. The figure ends in `Add Image`; rendering it on
	// `previewUrl === null` alone would print that invitation directly above the
	// filename sitting one line below — the slot contradicting the row underneath
	// it, offering an action already taken.
	//
	// ⛔ THE RULE, NOT A PHASE LIST: the figure appears only when NOTHING IS IN
	// HAND. `none` and `error` are the empty states — nothing picked, or a pick
	// that was rejected and must be retried — and there the invitation is exactly
	// right. `attaching` and `attached` both mean a file IS in hand, and there it
	// is wrong regardless of whether the preview survived. `fileInHand` states
	// that rule once so a fourth phase cannot be added without answering it.
	//
	// ⚠ `attaching` IS THE LIKELIER WINDOW OF THE TWO, and guarding only
	// `attached` (as the first cut did) missed it. Decode is attempted on FIRST
	// PAINT — the instant the `<img>` mounts, which is the instant the file is
	// picked — and the PUT is still in flight then, so the phase is `attaching`
	// for the whole upload. A file carrying a valid image MIME that nonetheless
	// will not decode passes the client MIME guard untouched and never reaches
	// `error`. The pick-button branch renders `${state.name}…` beneath the box in
	// that phase, so the contradiction is not only possible there, it is the
	// common case. Caught at Gate C; pinned by
	// `attach-preview.test.tsx::preview::a-decode-failure-while-attaching-does-not-invite-a-second-add`
	// and its `-attached-` twin.
	const emptyBox = <span aria-hidden="true" className={preview} />;
	const fileInHand = state.phase === "attaching" || state.phase === "attached";
	const previewBox =
		previewUrl === null ? (
			fileInHand ? (
				emptyBox
			) : (
				<EmptySlotFigure className={preview} />
			)
		) : (
			// A local `blob:` object URL for a file that exists only in this tab —
			// next/image would route a client-only source through the server
			// optimizer, which cannot resolve it (the `MarketThumb` / `CommentImage`
			// precedent for non-static sources).
			// biome-ignore lint/performance/noImgElement: client-only blob: URL — the optimizer cannot resolve it.
			<img
				alt=""
				aria-hidden="true"
				src={previewUrl}
				// Requirement 7 — a non-image or unreadable pick degrades to the empty
				// box rather than the browser's broken-image glyph. The client MIME
				// guard rejects most of these into `error` a moment later anyway, but
				// this covers the window before that and anything it does not catch.
				// Same shape as `MarketThumb`'s `onError` fallback.
				onError={() => setPreview(null)}
				className={`${preview} object-contain`}
			/>
		);
	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept={IMAGE_UPLOADS_ALLOWED_MIME.join(",")}
				className="hidden"
				aria-hidden="true"
				tabIndex={-1}
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) {
						// Drawn on SELECT, before `onPick` and therefore before the
						// sign/PUT round trip ever starts — the confirmation must not
						// wait on the network it exists to be checked ahead of.
						setPreview(URL.createObjectURL(file));
						onPick(file);
					}
					// Allow re-picking the same file after an error/remove.
					e.target.value = "";
				}}
			/>
			{/* ⛔ THE COLUMN IS A GROUP, NEVER THE BUTTON ITSELF, AND THE LIVE
			    REGION IS THE REASON. ARIA's presentational-children rule strips the
			    roles of a `button`'s descendants, so a `role="status"` nested inside
			    the pick control is NOT monitored — and the control's `aria-label`
			    excludes the message from its accessible name as well. Making the
			    whole panel one `<button>` therefore silences every attach failure
			    (`error_image_oversize`, gate-down, sign reject) for a screen-reader
			    user, which is the one channel those codes have. ⇒ `<fieldset>` is
			    the column (biome `useSemanticElements`), the pick control FILLS it
			    so the target stays panel-sized (d5 `.attach{cursor:pointer}`), and
			    the status region is the control's SIBLING inside the group.
			    Caught by `@code-reviewer` (HIGH) on the first draft of this file. */}
			<fieldset aria-label={ATTACH_LABEL} className={panel}>
				{state.phase === "attached" ? (
					<>
						{previewBox}
						<span className="flex max-w-full items-center gap-1">
							<span className="min-w-0 truncate font-mono text-ink">
								{state.name}
							</span>
							<button
								type="button"
								onClick={onRemove}
								disabled={disabled}
								aria-label="Remove image"
								className="rounded-(--r-chip) px-1 text-n4 transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring)"
							>
								×
							</button>
						</span>
					</>
				) : (
					<button
						type="button"
						disabled={disabled || state.phase === "attaching"}
						aria-label={PICK_LABEL}
						onClick={() => inputRef.current?.click()}
						className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2 rounded-(--imgr) transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity)"
					>
						{previewBox}
						<span className="text-n5">
							{state.phase === "attaching" ? `${state.name}…` : "Image"}
						</span>
					</button>
				)}
				{state.phase === "error" && (
					<span
						role="status"
						aria-live="polite"
						className="rounded-(--r-chip) bg-n1 px-2 py-1 text-[11px]"
					>
						{state.message !== "" && (
							<span className="font-semibold text-ink">{state.message} </span>
						)}
						<span className="text-n5">{STATE_COPY.gateDown.body}</span>
					</span>
				)}
			</fieldset>
		</>
	);
}
