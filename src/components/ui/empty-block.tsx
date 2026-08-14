/**
 * **P1 — the empty block.** Ratified by canon §10 **`C-STATES-1`**:
 * *"`ui/empty-block.tsx` is P1. `ui/loading-block.tsx` is P7. ⚠
 * `ui/error-block.tsx` is NEITHER."* That row landed at POLISH.5/.6 commit 0,
 * one commit ahead of this file, so CLAUDE.md §5.12's same-commit rule is
 * ALREADY SATISFIED and this mint writes no canon of its own.
 *
 * WHAT IT IS. R9's second clause reconciled Discovery's empty and error states
 * to ONE shape and ratified its geometry — *"148px floor, `--r`, `bg-n0`,
 * hairline, gap 10, pad 24; `.msg` 13.5/n6 ≤320px, `.sub` 12/n4"* (§10). The
 * panel and tier classes below are carried BYTE-FOR-BYTE from the shipped
 * implementation of that ruling, `discovery/EmptyState.tsx`, and are not
 * re-derived from the mockup.
 *
 * THE `<h2>` IS DELIBERATE, on `EmptyState.tsx`'s own recorded ground:
 * demoting a heading to a `div` would lose document semantics for no visual
 * gain. Only the type tiers moved when P1 landed; the elements did not.
 *
 * ⛔ NO ACTION PROP, for the current consumer set. `ProfileGraphCard` is itself
 * a `<button>` and its `graph-empty` state renders INSIDE that button, so an
 * interactive element here is not a styling preference but a structural
 * impossibility on one of the three sites — a `<button>` cannot nest in a
 * `<button>`. ⚠ Scoped to the current consumers, NOT "never": canon R9
 * contemplates P1's optional single CTA and Discovery's error panel ships one.
 *
 * ⛔ `sub` IS OPTIONAL AND UNPASSED ON THE PROFILE. It is declared because
 * `/bookmarks` carries a sub string and this surface's three sites do not — a
 * tier is REQUIRED when every consumer carries content for it, OPTIONAL when
 * only some do. ⛔ THE TESTID RIDES THE MESSAGE NODE, NEVER THE PANEL: a
 * testid on the panel would return message + sub through a `textContent` read
 * and break the consumer's exact-equality assertion the moment a `sub` is
 * passed.
 *
 * It marks itself `data-empty-block` — its OWN marker, never an override of
 * `data-slot` (`ui/loading-block.tsx` records the failure that minted that
 * rule) — and composes EXISTING tokens only, so the 11-token census in
 * `tests/unit/design/tokens-monochrome.test.ts` is untouched. No `"use
 * client"`: the leaf binds no handler.
 *
 * ⚠ POLISH.5 Gate C G-2 — `messageAs` exists for ONE measured reason.
 * `EmptyState.tsx`'s ground for the <h2> — "demoting a heading to a div
 * would lose document semantics" — is SITE-SPECIFIC and does not hold
 * inside `ProfileGraphCard`, whose root IS a <button>: there the heading
 * is announced as a heading inside a control, which is noise, not
 * semantics. ⚠ THIS DOES NOT FIX THE NESTING. The panel <div> is flow
 * content inside a <button> and remains invalid — pre-existing, unchanged
 * by POLISH.5, and NOT fixable by reshaping the panel for all three sites
 * to suit one. Routed to the close-out.
 */
export function EmptyBlock({
	message,
	messageTestId,
	sub,
	messageAs = "h2",
}: {
	message: string;
	messageTestId: string;
	sub?: string;
	messageAs?: "h2" | "p";
}) {
	const Message = messageAs;
	return (
		<div
			data-empty-block=""
			className="flex min-h-[148px] flex-col items-center justify-center gap-[10px] rounded-[var(--r)] bg-n0 p-6 text-center [border:var(--hairline)]"
		>
			<Message
				data-testid={messageTestId}
				className="max-w-[320px] text-[13.5px] text-n6"
			>
				{message}
			</Message>
			{sub !== undefined && <p className="text-[12px] text-n4">{sub}</p>}
		</div>
	);
}
