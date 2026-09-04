import { COMMENT_MAX_LENGTH } from "@/server/config/limits";

/**
 * UI.A3 slice 1 — composer payload composition (plan §3.2 "Body composition",
 * ratified OQ-6 + the two F-5 pins). PURE client logic: the two composer
 * fields (title + optional extended text) compose into the single wire `body`
 * so the write round-trips through the server's `deriveTitleTeaser` card
 * derivation (load-debate-view.ts — title = first line ≤125; teaser = the
 * next paragraph of the /\n\s*\n/ split).
 *
 * `@/server/config/limits` is a zero-import pure-data module (no
 * `server-only`, no secrets) — binding the REAL constant here is the SG-6
 * law: counters and caps trace to limits.ts, never to hardcoded literals.
 */

/**
 * Mirrors the UNEXPORTED server bound `slice(0, 125)` in `deriveTitleTeaser`
 * (a private fn of load-debate-view.ts) — deliberately literal; the payload
 * unit's file-text drift pin breaks if the server bound ever moves.
 */
export const TITLE_MAX_CHARS = 125;

/**
 * The INV-1 submit gate (plan §1 row 1): an empty/whitespace-only argument
 * makes the gate FALSE, so the composer never fires a comment-free buy at the
 * server's `comment_requires_bet` frontstop. Newline-bearing (F-5 ii) and
 * overlong (trimmed > TITLE_MAX_CHARS) titles also gate false.
 */
export function isArgumentSubmittable(title: string): boolean {
	const trimmed = title.trim();
	return (
		trimmed.length > 0 &&
		!/[\n\r]/.test(trimmed) &&
		trimmed.length <= TITLE_MAX_CHARS
	);
}

/**
 * Compose the wire `body`: trimmedTitle + "\n\n" + extended when the extended
 * text is non-empty; the trimmed title ALONE otherwise — F-5 pin (i): never a
 * trailing "\n\n" (it would corrupt the deriveTitleTeaser paragraph split).
 * Throws on caller-bug states the composer UI gates before submit: a
 * newline-bearing title (F-5 ii), an empty title (INV-1 gate belt), a title
 * over TITLE_MAX_CHARS, or a composed total over COMMENT_MAX_LENGTH.
 */
export function composeWireBody(args: {
	title: string;
	extended: string;
}): string {
	const title = args.title.trim();
	if (title.length === 0) {
		throw new Error("composeWireBody: empty argument title (INV-1 gate)");
	}
	if (/[\n\r]/.test(title)) {
		throw new Error("composeWireBody: title must be newline-free (F-5)");
	}
	if (title.length > TITLE_MAX_CHARS) {
		throw new Error(
			`composeWireBody: title exceeds TITLE_MAX_CHARS (${TITLE_MAX_CHARS})`,
		);
	}
	const composed =
		args.extended.trim().length === 0 ? title : `${title}\n\n${args.extended}`;
	if (composed.length > COMMENT_MAX_LENGTH) {
		throw new Error(
			`composeWireBody: composed body exceeds COMMENT_MAX_LENGTH (${COMMENT_MAX_LENGTH})`,
		);
	}
	return composed;
}

/**
 * The extended-text counter budget (OQ-6): total ≤ COMMENT_MAX_LENGTH with
 * the title and the "\n\n" separator accounted for.
 */
export function extendedMaxChars(titleLength: number): number {
	return COMMENT_MAX_LENGTH - titleLength - 2;
}

/**
 * UI-OVERNIGHT entry 5 — DOES THIS ARGUMENT HAVE A DESCRIPTION? The exact
 * inverse of `composeWireBody`'s optional half, read back off the wire.
 *
 * The composer writes two fields into one `body`: a title line, and — only when
 * the author typed one — an extended text after a blank line. The server's
 * `deriveTitleTeaser` splits them apart again, taking the SECOND paragraph as
 * the teaser. This asks the question those two halves imply: is there anything
 * here beyond the title?
 *
 * ⛔ WHY IT EXISTS AT ALL. `Know more` opens the full argument in a pop-up. On
 * an argument that is a title and nothing else, it opens a dialog showing the
 * title again — a control that promises more and delivers the same sentence.
 * Every card carried one unconditionally, so the promise was broken more often
 * than it was kept. Gating on this predicate is what makes the control mean
 * what it says.
 *
 * ⚠ IT MIRRORS `deriveTitleTeaser`'s SPLIT, deliberately and to the character —
 * the same `/\n\s*\n/` and the same second paragraph. Two definitions of "the
 * description" would let a card show `Know more` for a teaser the server does
 * not derive, or hide it for one it does.
 * ⚠ TRIMMED, so a body ending in whitespace after its title does not count as
 * carrying a description.
 * ⛔ IT IS NOT A LENGTH TEST. A long single-paragraph argument has no
 * description and gets no control — correct, because the surfaces that clamp a
 * title clamp it at two lines of a 125-character string, and the pop-up would
 * add nothing the card is not already showing.
 */
export function hasExtendedText(body: string): boolean {
	return (body.split(/\n\s*\n/)[1] ?? "").trim().length > 0;
}
