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

function usePointerFine(): boolean {
	const [pointerFine, setPointerFine] = React.useState(false);

	React.useEffect(() => {
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
	const contentId = React.useId();

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
				>
					{content}
				</PopoverPrimitive.Content>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}
