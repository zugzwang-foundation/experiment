"use client";

import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import {
	cardTitle,
	ONBOARDING_CARDS,
	type OnboardingCard,
	reshowCards,
} from "./cards";
import { CardFigure } from "./figures";

/**
 * The onboarding deck — SPEC.1 §21.9. TWO CONTEXTS, ONE COMPONENT, ONE CARD
 * ARRAY, which is what the spec asks for in as many words.
 *
 * | Context | Cards | Dismissible | Final label |
 * |---|---|---|---|
 * | `first-login` | all seven | **no** — no close control, no Escape, no backdrop | `Enter Zugzwang` |
 * | `reshow` | six, WELCOME dropped | **yes**, at every card | `Done` |
 *
 * ⛔ NON-DISMISSIBILITY IS EXPRESSED BY REFUSING RADIX'S EVENTS, NOT BY
 * HAND-ROLLING AN OVERLAY. `showCloseButton={false}` removes the close node
 * from the DOM entirely, and `onEscapeKeyDown` / `onInteractOutside` keep their
 * handlers BOUND and call `preventDefault()`. That is the same shape the locked
 * W2.1 shell already uses — a guard, not a removal — and it is why
 * `src/components/ui/dialog.tsx` is untouched: the primitive keeps its default
 * for every other dialog in the app, and a bespoke overlay would have
 * duplicated focus-trap, scroll-lock, portal and `aria-modal`, all of which the
 * deck needs and Radix already ships.
 *
 * ⛔ THE CLIENT OWNS `open`. THE SERVER PROP IS AN INITIAL VALUE, NEVER A LIVE
 * BINDING. `DebatePoll` calls `router.refresh()` every 15 s on `/m/[slug]` and
 * a refresh re-executes the LAYOUT as well as the page, so the gate is
 * re-evaluated on every tick. Were `open` derived from that prop each render, a
 * tick landing in the window between the optimistic close and the cookie being
 * written would RE-OPEN a deck the participant had just finished, and a tick
 * landing after would close it mid-animation. Both are 15-second-periodic, both
 * look like haunting, and neither reproduces on a route without the poll.
 *
 * ⛔ THE RE-SHOW NEVER WRITES THE MARKER (D-4), and not because of a check
 * here. `onComplete` is supplied by `(public)/layout.tsx` alone; `RulesControl`
 * does not pass it and does not import the action. The re-show is reachable
 * SIGNED-OUT on `/sign-in`, and a visitor who could write the marker there
 * would suppress the very first-login showing §21.9 makes non-dismissible —
 * so the guarantee is a compile-time fact about the import graph rather than a
 * runtime branch a later edit can flip. The `context` check below is the second
 * lock, not the first.
 */

export type OnboardingDeckContext = "first-login" | "reshow";

/**
 * The dialog's ACCESSIBLE name — stable per context, unlike the visible card
 * title which changes on every step. The first-login string is the locked W2.1
 * shell's own `aria-label`; the re-show's is the header control that opens it.
 * Neither is authored copy.
 */
const DIALOG_LABEL: Record<OnboardingDeckContext, string> = {
	"first-login": "Welcome to Zugzwang",
	reshow: "Rules",
};

/** `Enter Zugzwang` on first login, `Done` on a re-visit — W2.1 shell `:384`. */
const FINAL_LABEL: Record<OnboardingDeckContext, string> = {
	"first-login": "Enter Zugzwang",
	reshow: "Done",
};

export function OnboardingDeck({
	context,
	initialOpen = false,
	pseudonym = null,
	open: controlledOpen,
	onOpenChange,
	onComplete,
}: {
	context: OnboardingDeckContext;
	/** Seeds the deck's own state ONCE. Ignored when `open` is supplied. */
	initialOpen?: boolean;
	pseudonym?: string | null;
	/** Controlled mode — `RulesControl` drives the re-show this way. */
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** Supplied by the first-login mount only. See the D-4 note above. */
	onComplete?: () => void;
}) {
	const cards: readonly OnboardingCard[] =
		context === "first-login" ? ONBOARDING_CARDS : reshowCards();
	const total = cards.length;

	const [uncontrolledOpen, setUncontrolledOpen] = useState(initialOpen);
	const isControlled = controlledOpen !== undefined;
	const open = isControlled ? controlledOpen : uncontrolledOpen;

	const [index, setIndex] = useState(0);

	// Every opening starts at card one. Without this the re-show reopens
	// wherever the reader left off, which reads as a bug rather than as memory
	// — they asked for the rules, not for their place in them.
	useEffect(() => {
		if (open) setIndex(0);
	}, [open]);

	function setOpen(next: boolean): void {
		if (!isControlled) setUncontrolledOpen(next);
		onOpenChange?.(next);
	}

	const dismissible = context === "reshow";
	const isFinalCard = index === total - 1;

	function handleNext(): void {
		if (!isFinalCard) {
			setIndex(index + 1);
			return;
		}
		// CLOSE FIRST, THEN PERSIST. The close is optimistic and local, so no
		// `router.refresh()` is involved and the poll tick cannot flicker it. If
		// the action throws, the deck is already closed for this session and the
		// cookie is absent, so it returns on the next full navigation — the
		// failure falls toward showing the rules again, never toward hiding them.
		setOpen(false);
		if (context === "first-login") onComplete?.();
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				// Radix asks to close; on first login the answer is no. The
				// handlers below already refuse Escape and outside-interaction, so
				// this is the backstop for any dismissal path added to the
				// primitive later.
				if (!next && !dismissible) return;
				setOpen(next);
			}}
		>
			<DialogContent
				showCloseButton={dismissible}
				onEscapeKeyDown={(event) => {
					if (!dismissible) event.preventDefault();
				}}
				onInteractOutside={(event) => {
					if (!dismissible) event.preventDefault();
				}}
				// Radix warns when a dialog has no description. The deck's body IS
				// its content and inventing a second summary of it would put a
				// string on screen readers that no sighted reader gets; this is the
				// documented opt-out.
				aria-describedby={undefined}
				// 432px on the W2.2 register, sized by the INSTANCE — `ui/dialog.tsx`
				// ships `max-w-lg` and merges via `cn`, so the override lands here
				// and the primitive keeps its default for every other dialog.
				// `max-h-[90vh] overflow-y-auto` because the deck at its tallest is
				// ~665px and a shorter viewport must scroll it rather than clip it.
				// `motion-reduce:animate-none!` is important-flagged for the same
				// reason the mockup's own reduced-motion rule is: the primitive's
				// `data-[state=open]:animate-in` is an attribute selector, and a
				// media query adds no specificity to outrank it with.
				className="grid max-h-[90vh] w-[432px] max-w-[calc(100vw-88px)] gap-0 overflow-y-auto rounded-(--r) border border-ink bg-n0 p-[30px] ring-0 motion-reduce:animate-none!"
			>
				<DialogTitle className="sr-only">{DIALOG_LABEL[context]}</DialogTitle>

				{/* Progress — dots left, step count right. BOTH derive from the
				    array; a literal count here is a defect the copy register names
				    explicitly. */}
				<div className="mb-[20px] flex items-center gap-[10px]">
					<div className="flex gap-[6px]">
						{cards.map((card, i) => (
							<span
								key={card.figure}
								aria-hidden="true"
								className={`size-[7px] rounded-full [border:1px_solid_var(--color-ink)] ${
									i <= index ? "bg-ink" : "bg-n0"
								}`}
							/>
						))}
					</div>
					<div
						data-slot="onboarding-step"
						className="ml-auto text-[10px] leading-[1.2] font-bold tracking-[0.1em] text-n5 uppercase"
					>
						Step {index + 1} of {total}
					</div>
				</div>

				{/* THE CARD REGION IS A GRID STACK, AND ITS HEIGHT IS THE NATURAL
				    TALLEST CARD. All cards render into one cell (`col-start-1
				    row-start-1`), so the region measures the maximum of its
				    children with NO LITERAL ANYWHERE — it self-corrects the moment
				    a word changes. A measured `min-h-[503px]` would have been a
				    measurement of today's strings in today's font, and the copy
				    register is the source of record: a pinned height would go stale
				    silently on the first copy edit while the register stayed right.

				    The active card is CENTRED on the block axis inside the region
				    rather than top-aligned — a founder-ruled and deliberate
				    departure from the mockup's `.card` anatomy. The tallest card
				    runs ~205px longer than the next, and pooling that whitespace
				    under the shortest card is a hole; split above and below it is
				    breathing room.

				    All of them mount at once. They are static strings with no data
				    dependency, so the cost is DOM nodes and nothing else — no
				    query, no fetch, no per-card state — which is what makes "size
				    to the natural tallest" reachable without measuring at runtime. */}
				<div className="grid">
					{cards.map((card, i) => (
						<div
							key={card.figure}
							data-slot="onboarding-card"
							data-active={i === index ? "true" : "false"}
							aria-hidden={i === index ? undefined : "true"}
							className={`col-start-1 row-start-1 flex flex-col items-center justify-center text-center ${
								i === index ? "" : "invisible pointer-events-none"
							}`}
						>
							<CardFigure figure={card.figure} pseudonym={pseudonym} />
							<div className="mb-[10px] text-[9px] leading-[1.2] font-extrabold tracking-[0.14em] text-n4 uppercase">
								{card.eyebrow}
							</div>
							<div className="mb-[12px] text-[21px] leading-[1.18] font-extrabold tracking-[-0.012em] text-ink">
								{cardTitle(card, pseudonym)}
							</div>
							{/* `whitespace-pre-line` preserves the real line breaks the
							    first card's ratified subtext carries and collapses runs
							    of spaces, so the six single-paragraph cards render
							    exactly as they would without it. One code path, one
							    shape, no union type for one card's benefit. */}
							<div className="max-w-[332px] text-[13px] leading-[1.58] font-medium whitespace-pre-line text-n5">
								{card.sub}
							</div>
						</div>
					))}
				</div>

				<div className="mt-[24px] flex items-center gap-[12px]">
					<button
						type="button"
						data-slot="onboarding-back"
						disabled={index === 0}
						onClick={() => setIndex(index - 1)}
						className="shrink-0 px-1 text-[13px] leading-[1.2] font-semibold text-n5 outline-none hover:text-ink focus-visible:shadow-(--state-focus-ring) disabled:cursor-default disabled:text-n3"
					>
						Back
					</button>
					<button
						type="button"
						data-slot="onboarding-next"
						onClick={handleNext}
						className="flex-1 rounded-(--r) border border-ink bg-ink p-[13px] text-center text-[14px] leading-[1.2] font-bold tracking-[0.01em] text-n0 outline-none [transition:all_var(--dur-hover)] hover:border-n7 hover:bg-n7 focus-visible:shadow-(--state-focus-ring) active:border-n6 active:bg-n6"
					>
						{isFinalCard ? FINAL_LABEL[context] : "Next"}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
