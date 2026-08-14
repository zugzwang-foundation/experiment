"use client";

/**
 * **The route-boundary family block.** ⚠ NEITHER P1 NOR P7 — canon §10
 * **`C-STATES-1`** rules it by name: *"⚠ `ui/error-block.tsx` is NEITHER — it
 * renders the route-boundary family"*, and it sits in `ui/` beside two kit
 * members without being one. That row landed at POLISH.5/.6 commit 0, one
 * commit ahead of this file, so CLAUDE.md §5.12's same-commit rule is ALREADY
 * SATISFIED and this mint writes no canon of its own.
 *
 * ⛔ IT RENDERS NO P1 PANEL — no hairline border, no `bg-n0`, no
 * `min-h-[148px]`, no `rounded-[var(--r)]`. The family is a bare centred
 * column; the panel is P1's, and P1 is `empty-block`'s. The three class strings
 * below are carried BYTE-FOR-BYTE from the family and were verified identical
 * across `(auth)/error.tsx`, `(public)/not-found.tsx` and `m/[slug]/error.tsx`.
 * ⚠ `C-STATES-1`'s rider is the governing reading: that row ratifies a shared
 * TREATMENT, never a shared FILE SHAPE.
 *
 * THE HEADING IS A MODULE CONST, NOT A PROP. `"Something went wrong."` is
 * byte-identical at `(auth)/error.tsx` and `m/[slug]/error.tsx` — the family's
 * generic title, in W2.11's generic-error vocabulary. It is CARRIED, never
 * authored: CC does not write product copy (CLAUDE.md §3). No consumer
 * overrides it, and the family's whole point is a generic heading above a
 * surface-specific body.
 *
 * THE LEAF CENTRES ITSELF, and that is a constraint rather than a choice. The
 * family puts `text-center` on the container; a consumer here cannot, because
 * `tests/unit/shell/page-container.test.ts` asserts class-set EQUALITY against
 * its `SITES` array and the profile boundary is entry 7 at the bare `reading`
 * preset with no `className`. Centring therefore lives INSIDE this leaf.
 *
 * ⛔ `onAction`, NOT `onRetry`, AND NEVER `window.location.reload()`. Both
 * consumers mount from `"use client"` `error.tsx` boundaries with `reset()` in
 * scope, so ONE action serves both. `discovery/ErrorState.tsx` is the tempting
 * model and copying it would silently downgrade both surfaces from a segment
 * re-render to a full document reload — invisible to every test either surface
 * has.
 *
 * ⛔ THE TESTID RIDES THE `<p>` ALONE, never the container.
 * `m/[slug]/error.tsx` marks its CONTAINER instead; copying that placement puts
 * the button's label inside the marked subtree and reddens the consumer's
 * exact-equality assertion against its own body string. The button is the
 * body's SIBLING, not its child.
 *
 * ⛔ IT RENDERS NOTHING FROM AN `error` OBJECT — it never receives one. Both
 * family boundaries type `error` and deliberately leave it undestructured, "so
 * no binding exists to render by accident": structural, not a rule someone has
 * to remember (CLAUDE.md §8 `O-1`).
 *
 * `"use client"` is carried even though both current consumers are already
 * client boundaries, which makes the directive redundant TODAY. The reason it
 * stays: the leaf is unusable from an RSC BY CONSTRUCTION — an RSC cannot pass
 * an event handler — and the directive makes that self-describing at the top of
 * the file rather than discoverable at a build error. `ErrorState.tsx` carries
 * it for the same class of reason. It marks itself `data-error-block`, its OWN
 * marker, and adds no token: the focus recipe reuses `--state-focus-ring`,
 * already shipped, so the 11-token census is untouched.
 */

const HEADING = "Something went wrong.";

export function ErrorBlock({
	body,
	bodyTestId,
	actionLabel,
	onAction,
}: {
	body: string;
	bodyTestId: string;
	actionLabel: string;
	onAction: () => void;
}) {
	return (
		<div data-error-block="" className="text-center">
			<h1 className="font-medium text-ink text-lg">{HEADING}</h1>
			<p data-testid={bodyTestId} className="mt-2 text-n5 text-sm">
				{body}
			</p>
			<button
				type="button"
				onClick={onAction}
				className="mt-6 inline-block font-medium text-ink text-sm underline-offset-4 outline-none hover:underline focus-visible:shadow-(--state-focus-ring)"
			>
				{actionLabel}
			</button>
		</div>
	);
}
