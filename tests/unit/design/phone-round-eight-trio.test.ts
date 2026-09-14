import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * MOBILE-2l · R-1, R-5, R-6 — the three one-line guards the round's brief leaves
 * to the execute surface (`@test-writer` owns R-2, R-3 and R-4).
 *
 * ⛔⛔ EVERY `max-mobile:` TOKEN IN THIS FILE IS ASSEMBLED AT RUNTIME, and that
 * is mandatory rather than stylistic. Tailwind v4's source detection scans
 * `tests/` as well as `src/` and `docs/`, so a class-shaped LITERAL written here
 * becomes a real emitted utility in the built stylesheet — at which point a
 * guard that greps the built CSS to prove a component compiled is proving its
 * own literal instead (AGENTS.md §8, measured: `max-mobile:opacity-0` is in the
 * built sheet with no `src/` origin). Splitting the prefix from the utility
 * leaves nothing for the scanner to match.
 *
 * ⚠ THESE ARE SOURCE SCANS, and they say so because the alternative is worse.
 * jsdom performs no layout, so "the caret is visible at 360" and "the avatar is
 * a circle" are not assertable by rendering — they are browser measurements and
 * were taken as such this round. What a scan CAN hold is that the token is on
 * the right node, which is the half that a later edit silently removes.
 */

const ROOT = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const POSITIONS_TABLE = "src/components/profile/PositionsTable.tsx";
const IDENTITY_CLUSTER = "src/components/shell/IdentityCluster.tsx";
const DIALOGS = "src/components/debate/dialogs.tsx";
const PHONE_VIEW = "src/components/debate/phone/PhoneDebateView.tsx";

/** The phone variant, never written as one literal. See the docblock. */
const V = "max-mobile";
const S = ":";
const phone = (utility: string) => `${V}${S}${utility}`;

/**
 * ⚠ COMMENTS ARE STRIPPED BEFORE EVERY SCAN. This repo has shipped the same
 * defect six times: a negative assertion matches the COMMENT that explains why
 * the thing is absent, and passes for the wrong reason. A positive assertion has
 * the mirror problem — it can match prose describing the token rather than the
 * token itself, and this file's own docblocks name several.
 */
function code(path: string): string {
	return read(path)
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/^\s*\/\/.*$/gm, " ");
}

describe("MOBILE-2l · R-1 — the filter pill keeps its caret", () => {
	it("phone-r1::the-label-is-SPLIT-so-the-caret-sits-outside-the-truncating-box", () => {
		const src = code(POSITIONS_TABLE);

		// The tag half and the hidden remainder are two elements, so the phone can
		// drop one without touching the text the DOM carries.
		expect(src).toContain("selectedMarketLabel.tag");

		// ⛔ THE `hidden` MUST BE ON THE REMAINDER'S OWN SPAN, not merely present
		// in the file. Asserting `toContain(phone("hidden"))` passed a mutation
		// that stripped the token off this exact element, because the same class
		// appears elsewhere in this component — a guard matching a token anywhere
		// is a guard that cannot see the node it is about. Match the PAIR.
		const remainder =
			/<span className="([^"]*)">\s*\{selectedMarketLabel\.rest\}/.exec(src);
		expect(
			remainder,
			"the remainder span must wrap selectedMarketLabel.rest",
		).not.toBeNull();
		expect((remainder?.[1] ?? "").split(/\s+/)).toContain(phone("hidden"));

		// ⛔ THE DEFECT ITSELF: the caret must NOT be inside the element that
		// truncates. Before this round one span carried the label AND the `▾` and
		// wore the truncate, so the ellipsis ate the caret. Assert the caret's own
		// span is a non-shrinking sibling.
		expect(src).toContain(`${phone("shrink-0")}">▾</span>`);
	});

	it("phone-r1::the-tag-split-preserves-the-title-EXACTLY", () => {
		// `tag + rest === title` is the whole contract — it is what keeps the
		// trigger's `textContent` byte-identical and `arrangement.test.tsx`'s
		// equality assertion true. Re-derived here from the shipped source rather
		// than reimplemented, so a change to the separator cannot pass this.
		const src = read(POSITIONS_TABLE);
		const sep = /const TAG_SEPARATOR = "([^"]+)"/.exec(src)?.[1];
		expect(sep, "TAG_SEPARATOR must be declared").toBeTruthy();
		const split = (title: string) => {
			const at = title.indexOf(sep as string);
			return at === -1
				? { tag: title, rest: "" }
				: { tag: title.slice(0, at), rest: title.slice(at) };
		};
		for (const title of [
			"Claude · Will Anthropic reply to Zugzwang's Bundle feature on X?",
			"YCombinator · Will YC reply to Zugzwang's pitch by 5 Nov 2026?",
			"Staging fixture M12 — placeholder filler question",
			"All markets",
			"",
		]) {
			const { tag, rest } = split(title);
			expect(tag + rest, `round-trip: ${title}`).toBe(title);
		}
		// The tag is the leading segment where there is one...
		expect(split("Math · Will 3 Erdős problems be solved?").tag).toBe("Math");
		// ...and the whole title where there is not, which is every local fixture.
		expect(split("Staging fixture M12 — placeholder").tag).toBe(
			"Staging fixture M12 — placeholder",
		);
	});
});

describe("MOBILE-2l · R-5 — the header avatar is a circle below 640", () => {
	it("phone-r5::the-chip-sheds-its-frame-and-the-avatar-fills-a-square-box", () => {
		const src = code(IDENTITY_CLUSTER);
		// Square box + the wrapper's ground and border gone from view.
		for (const u of [
			"size-11",
			"justify-center",
			"p-0",
			"[border:none]",
			"bg-transparent",
		]) {
			expect(src, `chip token ${u}`).toContain(phone(u));
		}
		// ⛔ THE SPECIFICITY TRAP, PINNED. `ui/avatar.tsx` ships
		// `data-[size=sm]:size-6` at (0,2,0); a bare phone `size-11` is (0,1,0) and
		// LOSES silently, leaving a 24px image in a 44px box. The override must
		// repeat the data-attribute to match. Measured in a browser this round
		// (the phone rule is emitted later, so it wins) — this holds the SHAPE that
		// makes that measurement true.
		expect(src).toContain(phone("data-[size=sm]:size-11"));
	});

	it("phone-r5::every-token-is-gated-on-the-prop-so-a-third-mount-is-safe", () => {
		const src = code(IDENTITY_CLUSTER);
		// `GlobalHeader` is mounted by BOTH route groups; the prop defaults false so
		// a mount that forgets it inherits the desktop render (AGENTS.md §8). The
		// reflow tokens must therefore sit behind the flag, not beside it.
		const gated = /mobileResponsive &&\s*\n?\s*"([^"]*)"/g;
		const behindTheFlag = [...src.matchAll(gated)].map((m) => m[1]).join(" ");
		for (const u of ["size-11", "[border:none]", "bg-transparent"]) {
			expect(behindTheFlag, `${u} must be behind mobileResponsive`).toContain(
				phone(u),
			);
		}
	});
});

describe("MOBILE-2l · R-6 — the post sheet's header is the market question", () => {
	it("phone-r6::the-phone-branch-renders-the-question-and-the-desktop-does-not", () => {
		const src = code(DIALOGS);
		// The branch is gated on BOTH the tier and the prop, so the desktop pop-up
		// — which passes neither — cannot reach it even by omission.
		expect(src).toContain('tier === "phone" && marketQuestion !== undefined');
		// The desktop branch is still the post's own title, unchanged.
		expect(src).toContain("<DialogTitle>{post.title}</DialogTitle>");
		// The market-question register, borrowed from `PhoneTitleStrip`: grey,
		// small, one line.
		// ⚠ ASSERTED AS TOKENS, NOT AS A CONTIGUOUS SPELLING (`O-8` again, in this
		// file). This read `"truncate text-[13px] leading-[17px]"` and reddened the
		// moment two constraint tokens were inserted between them — a guard fenced
		// by adjacency is fenced by distance.
		const title =
			/data-testid="post-popup-market-question"[\s\S]{0,400}?className="([^"]*)"/.exec(
				src,
			);
		expect(
			title,
			"the phone title's className must be findable",
		).not.toBeNull();
		const titleTokens = (title?.[1] ?? "").split(/\s+/);
		for (const t of ["truncate", "text-[13px]", "leading-[17px]", "text-n5"]) {
			expect(titleTokens, `market-question register: ${t}`).toContain(t);
		}
		// ⛔ THE TWO THAT KEEP IT INSIDE THE DIALOG. `truncate` brings
		// `white-space: nowrap`, which makes the header's min-content width the
		// whole question; `DialogContent` is a grid and the header is a grid item,
		// so without `min-w-0` on the HEADER it grew to 367px against a 304px
		// content box and ran under the `×`. Measured, and only the screenshot
		// showed it — the element reported nothing clipped the whole time.
		expect(
			titleTokens,
			"the title needs its own end padding to clear the ×",
		).toContain("pe-7");
		expect(
			src,
			"the HEADER is the box that must be allowed to shrink",
		).toContain(phone("min-w-0"));
	});

	it("phone-r6::the-phone-mount-actually-passes-the-question", () => {
		// ⚠ THE PAIR IS THE POINT. A gated branch nobody feeds renders nothing and
		// the guard above would still pass — this is the half that proves the phone
		// pop-up reaches it.
		const src = code(PHONE_VIEW);
		expect(src).toContain("marketQuestion={market.title}");
	});
});
