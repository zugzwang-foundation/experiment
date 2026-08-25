"use client";

import {
	Popover as PopoverPrimitive,
	Tooltip as TooltipPrimitive,
} from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * INFO-1 — the one info affordance that works on both pointer and touch.
 *
 * Native `title` doesn't open on tap (iOS Safari / Android Chrome surface it
 * on neither tap nor long-press), so on a phone it explains nothing. Radix's
 * `Tooltip` is pointer-only by design and has the same defect; Radix's
 * `Popover` opens on tap but carries no hover behaviour. Neither primitive
 * alone covers both devices, so this composes them and picks one per render.
 *
 * The branch is `(hover: hover) and (pointer: fine)`, read in an effect so
 * server and first-client render agree (a media query has no server-side
 * value). ⚠ Unknown defaults to the TOUCH branch: a phone stuck on the
 * pointer-only Tooltip before the effect settles would be unreachable, while
 * a desktop stuck on the Popover for one paint still opens correctly on
 * click. The two failure modes are not symmetric, so the default isn't
 * either.
 */

const CONTENT_CLASS = cn(
	"z-50 max-w-[260px] rounded-(--r) bg-(--popover) px-3 py-2 text-xs leading-snug text-(--popover-foreground) shadow-(--elev-2) [border:var(--hairline)]",
	"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
	"data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
	"data-[side=bottom]:slide-in-from-top-[14px] data-[side=top]:slide-in-from-bottom-[14px]",
	"data-[side=left]:slide-in-from-right-[14px] data-[side=right]:slide-in-from-left-[14px]",
	"duration-[260ms]",
);

/**
 * A deterministic id derived from `content`, not `React.useId()`.
 *
 * `useId()` prefixes by REACT ROOT, so two independently-mounted `render()`
 * calls of an otherwise-identical tree get DIFFERENT ids — and this repo's
 * established "does a 404 degrade to byte-identical markup" test idiom
 * (`tests/unit/discovery/render/market-thumb.test.tsx` and its siblings)
 * renders two separate roots and asserts their `innerHTML` are equal. A
 * per-root id would fail that comparison for every surface this task wires,
 * for a reason that has nothing to do with the behaviour under test.
 *
 * A hash of `content` is stable across roots and across hydration, at one
 * real cost: two SIMULTANEOUSLY OPEN `InfoTip`s sharing the same gloss text
 * share one DOM id. Accepted because their description text is, by
 * construction, identical either way — the vocabulary is the fixed,
 * closed GLOSSARY register, not per-instance data.
 */
function contentHashId(content: string): string {
	let hash = 5381;
	for (let i = 0; i < content.length; i++) {
		hash = (hash * 33) ^ content.charCodeAt(i);
	}
	return `info-tip-${(hash >>> 0).toString(36)}`;
}

function usePointerFine(): boolean {
	const [pointerFine, setPointerFine] = React.useState(false);

	React.useEffect(() => {
		// jsdom (this repo's render-test environment) does not implement
		// `matchMedia` at all — not "always false", genuinely `undefined`. Falling
		// through to the touch default here is the same unknown-defaults-to-touch
		// rule stated above, applied to a second kind of unknown: a device that
		// can't answer the query gets the same answer as one that hasn't answered
		// yet.
		if (typeof window.matchMedia !== "function") {
			return;
		}
		const mql = window.matchMedia("(hover: hover) and (pointer: fine)");
		setPointerFine(mql.matches);
		const onChange = (event: MediaQueryListEvent) =>
			setPointerFine(event.matches);
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, []);

	return pointerFine;
}

export function InfoTip({
	content,
	children,
	asChild,
}: {
	/** The gloss — a `GLOSSARY.*` string. A description, never a name. */
	content: string;
	children: React.ReactNode;
	/** Merge onto `children` instead of wrapping it (Radix `Slot`). Every
	 * call site in this task uses it, so wiring an info affordance onto an
	 * existing element never introduces a new DOM node and never touches
	 * `GlobalHeader`'s fixed, non-reflowing width (AGENTS.md §5.4). */
	asChild?: boolean;
}) {
	const pointerFine = usePointerFine();
	const contentId = React.useMemo(() => contentHashId(content), [content]);

	if (pointerFine) {
		return (
			<TooltipPrimitive.Provider delayDuration={200}>
				<TooltipPrimitive.Root>
					<TooltipPrimitive.Trigger
						asChild={asChild}
						aria-describedby={contentId}
					>
						{children}
					</TooltipPrimitive.Trigger>
					<TooltipPrimitive.Portal>
						<TooltipPrimitive.Content
							id={contentId}
							sideOffset={6}
							className={CONTENT_CLASS}
						>
							{content}
						</TooltipPrimitive.Content>
					</TooltipPrimitive.Portal>
				</TooltipPrimitive.Root>
			</TooltipPrimitive.Provider>
		);
	}

	return (
		<PopoverPrimitive.Root>
			<PopoverPrimitive.Trigger asChild={asChild} aria-describedby={contentId}>
				{children}
			</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Content
					id={contentId}
					sideOffset={6}
					className={CONTENT_CLASS}
					// The content is plain text with nothing to focus, and several
					// wired sites are ALREADY-interactive controls (a tab button, a
					// Support/Counter trigger) whose own click both performs their
					// action and opens this Popover. Radix's default auto-focus would
					// then move focus OFF the trigger and onto the content on every
					// such tap, which is what broke keyboard row-stepping on
					// PositionsTable's status tabs — focus left the table, so neither
					// the table's own key handler nor the document-level fallback
					// still owned the key. Declining the auto-focus keeps focus on
					// the trigger, so the click's PRIMARY action stays keyboard-safe;
					// the popover still opens and is still dismissible by Escape.
					onOpenAutoFocus={(event) => event.preventDefault()}
				>
					{content}
				</PopoverPrimitive.Content>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}
