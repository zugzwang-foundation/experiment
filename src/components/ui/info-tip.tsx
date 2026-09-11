"use client";

import {
	Popover as PopoverPrimitive,
	Slot,
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
 *
 * ⚠⚠ THE TOUCH BRANCH DOES NOT USE `Popover.Trigger`, and that is a
 * measured correction, not a style choice. `Popover.Trigger` is a
 * `Primitive.button` wrapper — even through `asChild` it stamps
 * `type="button"`, `aria-haspopup="dialog"` and `aria-controls` onto
 * whatever it clones onto (`@radix-ui/react-popover` dist `:89-92`,
 * confirmed by reading the shipped source, not assumed). Roughly two thirds
 * of this task's ~29 wired sites are NOT buttons — a `<span>` glyph, a
 * `<th>` column header, an `<a>` — and `type` on an anchor means the MIME
 * type of the linked resource, not this. `Popover.Anchor` carries none of
 * that; it is pure position tracking. Open state is driven by hand and
 * merged onto the child via `Slot` — the same prop-merge `Trigger` uses
 * internally — without the button semantics that were never true of most
 * of these hosts.
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
 *
 * ⚠ Radix's OWN Popover/Tooltip internals ALSO call `useId()` for their own
 * `context.contentId` (used for `aria-controls` on Popover's — no longer
 * used — Trigger, and for Tooltip's always-present `VisuallyHidden`
 * description). That id is separate from this one and is not fought here on
 * the Tooltip branch (§ below); on the Popover branch this hash is the only
 * id in play, because `Popover.Anchor` replaces `Popover.Trigger` and never
 * establishes a competing `contentId` consumer.
 */
export function contentHashId(content: string): string {
	let hash = 5381;
	for (let i = 0; i < content.length; i++) {
		hash = (hash * 33) ^ content.charCodeAt(i);
	}
	return `info-tip-${(hash >>> 0).toString(36)}`;
}

/**
 * ⛔ A CHILD THAT CROSSED THE RSC BOUNDARY IS NOT RELIABLY AN ELEMENT, AND
 * `asChild` IS ENTIRELY BUILT ON THE ASSUMPTION THAT IT IS.
 *
 * React Flight serializes a Client Component's props inline — until the row it
 * is writing passes `MAX_ROW_SIZE` (3200 bytes,
 * `react-server-dom-turbopack-server`). The FIRST element it meets after that
 * is deferred to a row of its own and arrives here as
 * `{$$typeof: Symbol.for("react.lazy"), _payload, _init}` instead of an
 * element. Nothing about the call site causes this: it is whichever element
 * happens to straddle the boundary, so the victim moves with any byte written
 * earlier in the page. MEASURED by padding the payload — at +0 bytes it was
 * `DharmaCluster`'s Balance eyebrow, at +300 it was Portfolio, and either side
 * of those it was nobody.
 *
 * ⚠ AND THE TWO BRANCHES BELOW DISAGREED ABOUT WHAT TO DO WITH IT, which is
 * what made this visible rather than merely wrong. `React.isValidElement`
 * is false for a lazy, so the SERVER fell to the `<button>` fallback and
 * PAINTED the child; the client then switched to the Tooltip branch on the
 * `pointerFine` effect, where Radix's `Slot` runs the SAME check and returns
 * `null` for a child it cannot clone (`@radix-ui/react-slot` dist `:34-42`).
 * The label painted, then vanished about a second later, on one of two
 * byte-identical eyebrows, with no hydration warning and no console error —
 * because neither half is a mismatch. Each is a correct render of a different
 * branch.
 *
 * Resolving it here restores the element BEFORE anything inspects it, so
 * `asChild` keeps its contract and no fallback has to fire. `use()` is the
 * supported way to read a value the server has not finished handing over, and
 * a Flight chunk that has already arrived is a settled thenable, so this
 * returns synchronously rather than suspending (measured on the built app: the
 * eyebrow now serializes merged onto its own `<span>`, exactly as its sibling
 * always did).
 */
const REACT_LAZY = Symbol.for("react.lazy");

type DeferredChild = { readonly _payload: PromiseLike<React.ReactNode> };

function isDeferredChild(
	node: React.ReactNode,
): node is React.ReactNode & DeferredChild {
	if (typeof node !== "object" || node === null) {
		return false;
	}
	// Trust boundary (AGENTS.md §4): this is React's own wire shape, not ours,
	// so it is read defensively and both halves are checked. A lazy whose
	// payload is not a settled thenable is left exactly as it arrived — the
	// `canSlot` guard below is what catches that case.
	const candidate = node as {
		$$typeof?: unknown;
		_payload?: { then?: unknown };
	};
	return (
		candidate.$$typeof === REACT_LAZY &&
		typeof candidate._payload?.then === "function"
	);
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
	/** Merge onto `children` instead of wrapping it. Every call site in this
	 * task uses it, so wiring an info affordance onto an existing element
	 * never introduces a new DOM node and never touches `GlobalHeader`'s
	 * fixed, non-reflowing width (AGENTS.md §5.4). */
	asChild?: boolean;
}) {
	// Restore the element before ANYTHING inspects it — see `isDeferredChild`.
	// `use` is explicitly permitted inside a condition, and on the overwhelming
	// majority of renders this branch is not taken at all.
	const child = isDeferredChild(children)
		? React.use(children._payload)
		: children;
	// ONE predicate, read by BOTH branches. It used to be computed inline on
	// the Popover branch only, and the Tooltip branch handed `asChild` straight
	// to Radix — so for any child neither of them could clone, the server
	// rendered the `<button>` fallback and the client rendered `null`. The
	// resolver above means a deferred child no longer reaches here unclonable;
	// this is what stops the two branches from EVER disagreeing again, for a
	// plain string child as much as for a shape React has not invented yet.
	const canSlot = asChild === true && React.isValidElement(child);
	const pointerFine = usePointerFine();
	const contentId = React.useMemo(() => contentHashId(content), [content]);
	const [open, setOpen] = React.useState(false);
	// Popover-branch only, but declared unconditionally (hooks must run in
	// the same order every render) — see its use below. Typed `HTMLDivElement`
	// to match `Popover.Anchor`'s own ref type; the real host varies by call
	// site (`<span>`, `<th>`, `<a>`, `<button>`), but `.contains()` works on
	// any `Node` regardless of that type parameter.
	const anchorRef = React.useRef<HTMLDivElement>(null);

	if (pointerFine) {
		// No `id`/`aria-describedby` override here: `TooltipTrigger` already
		// sets `aria-describedby` to its own `context.contentId` whenever open
		// (`@radix-ui/react-tooltip` dist `:180`), pointing at an always-in-sync
		// `VisuallyHidden` copy of `content` Radix renders for exactly this
		// purpose (dist `:349-350`). Setting our own hash `id` on the VISIBLE
		// content here would have left that hidden copy correctly described
		// while adding a second, redundant description on the visible node —
		// a screen reader meeting both once open.
		return (
			<TooltipPrimitive.Provider delayDuration={200}>
				<TooltipPrimitive.Root>
					<TooltipPrimitive.Trigger asChild={canSlot}>
						{child}
					</TooltipPrimitive.Trigger>
					<TooltipPrimitive.Portal>
						<TooltipPrimitive.Content sideOffset={6} className={CONTENT_CLASS}>
							{content}
						</TooltipPrimitive.Content>
					</TooltipPrimitive.Portal>
				</TooltipPrimitive.Root>
			</TooltipPrimitive.Provider>
		);
	}

	// `onClick` here is ONLY the toggle. `Slot`'s own `mergeProps` composes it
	// with the child's own `onClick` (child's handler first, then this one —
	// `@radix-ui/react-slot`'s own order; the reverse of what `Trigger` used
	// to look like from the outside, but the same net effect since neither
	// handler here depends on the other's side effects). Composing it a
	// second time by hand would have called the child's original handler
	// twice per click — measured via `market-header.test.tsx`'s own
	// click-count assertion, which is walled (never edited) and is what
	// caught it.
	const triggerProps = {
		"aria-describedby": contentId,
		onClick: () => setOpen((o) => !o),
	};

	const trigger = canSlot ? (
		<Slot.Root {...triggerProps}>{child}</Slot.Root>
	) : (
		<button type="button" {...triggerProps}>
			{child}
		</button>
	);

	return (
		<PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
			{/* `ref` here is the one thing dropping `Popover.Trigger` cost that
			    isn't cosmetic: `PopoverContentImpl`'s own outside-interaction
			    check reads `context.triggerRef` to tell "the trigger was
			    clicked again" apart from "somewhere else was clicked" — and
			    only `Trigger` used to populate that ref. Left unset, a second
			    click on the trigger reads as an OUTSIDE click: the content
			    dismisses on `pointerdown`, then this component's own `onClick`
			    toggle re-opens it a moment later — closed-then-reopened, not
			    closed, on every second click from a mouse or a stylus (touch
			    is unaffected — its dismissal listener runs after React's).
			    Populating the same ref `Trigger` used to is the fix; verified
			    against the shipped Radix source, not inferred. */}
			<PopoverPrimitive.Anchor asChild ref={anchorRef}>
				{trigger}
			</PopoverPrimitive.Anchor>
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
					// The other half of the `triggerRef` fix above: without this,
					// `context.triggerRef` (now populated) still isn't consulted by
					// every dismissal path the same way `Trigger` had it wired.
					// Checking containment against OUR OWN ref, directly, is what
					// `Trigger` did internally and is what actually closes the loop.
					onInteractOutside={(event) => {
						if (anchorRef.current?.contains(event.target as Node)) {
							event.preventDefault();
						}
					}}
				>
					{content}
				</PopoverPrimitive.Content>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}
