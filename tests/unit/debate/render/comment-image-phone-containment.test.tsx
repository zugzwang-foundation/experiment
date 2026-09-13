// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CommentImage } from "@/components/debate/CommentImage";

/**
 * MOBILE-2k · F-2 — THE ATTACHMENT IS BOUNDED BELOW 640px. Plan §3 rows G7 (the
 * cap is on the `fill` arm and on no other), G8 (the border goes and the card's
 * radius arrives) and G9 (the composer's attached preview is untouched).
 *
 * ⛔⛔ WHAT WAS WRONG, BECAUSE IT IS THE OPPOSITE OF WHAT THE CLASS STRING LOOKS
 * LIKE. The `fill` arm has always declared `max-h-full`, and `max-h-full` is a
 * PERCENTAGE — a percentage `max-height` resolves to `none` unless an ancestor
 * carries a DEFINITE height. The desktop grid supplies one (the founder's
 * 2026-08-17 parity ruling), so the bound has bitten at 1440 the whole time. The
 * phone feed is a column of content-sized cards inside a scroller and supplies
 * none, so the same token is INERT there and a portrait attachment renders at its
 * intrinsic height, pushing the argument and the footer a screen down. A bound
 * that exists and does not bind, which is why nothing ever errored.
 *
 * ⚠ jsdom COMPUTES NO STYLE AND PERFORMS NO LAYOUT, so this file cannot see 60%
 * of anything, cannot see that the border is gone, and cannot see the image
 * centred in the card. **It proves that four tokens reach the right node of the
 * right arm and that no token reaches the wrong arm, and nothing else.** The
 * 60dvh cap, the centring and the computed border are the plan's B2/B7 browser
 * measurements.
 *
 * ⛔⛔⛔ NO PHONE-VARIANT CLASS LITERAL APPEARS ANYWHERE IN THIS FILE, AND THAT
 * IS LOAD-BEARING RATHER THAN FASTIDIOUS. Tailwind v4's source detection scans
 * `tests/` as well as `docs/` — measured in this repo: a variant utility present
 * in exactly one test file, in no `src/` file, and in the built stylesheet. Two
 * of the four tokens this round ships (`max-h-[60dvh]` and `[border:none]` under
 * the phone variant) exist NOWHERE else, so a clean literal here would put them
 * in the compiled sheet regardless of what `CommentImage.tsx` carries — and the
 * plan's own verification greps that sheet. The guard would then pass on a class
 * the code does not have.
 *
 * ⇒ Every variant token below is ASSEMBLED AT RUNTIME (`phone(…)`), and the
 * 60dvh figure is PARSED OUT OF THE RENDERED CLASS rather than typed. Check it
 * before editing — and note that the command below splices its own separator in
 * with `printf`, because the FIRST run of the self-check row at the foot of the
 * first describe block went red on an earlier draft of THIS PARAGRAPH, which had
 * the pattern written out. Tailwind scans bytes and does not care that they are
 * in a comment; the check does not either, and it was right not to:
 *
 *   grep -nE "max-mobile$(printf ':')[a-z[]" tests/unit/debate/render/comment-image-phone-containment.test.tsx
 *
 * ⛔ DO NOT "TIDY" THE CONCATENATION BACK INTO LITERALS. It looks like
 * indirection for its own sake and it is not.
 *
 * ⚠ The UNPREFIXED literals (`max-w-full`, `object-contain`,
 * `rounded-[var(--imgr)]`, `[border:var(--hairline)]`, `max-h-full`,
 * `max-h-[var(--imgmax)]`, and G9's pinned string) are safe by a different
 * argument: each is already authored byte-identically in `src/`, so scanning this
 * file re-emits a rule that already exists.
 */
const ROOT = process.cwd();
const ATTACH = "src/components/debate/composer/ImageAttach.tsx";
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** The phone variant, assembled — see the ⛔⛔⛔ paragraph above. */
const VARIANT = "max-mobile";
const SEP = ":";
const phone = (utility: string) => VARIANT + SEP + utility;
/** An arbitrary-PROPERTY utility: `[<prop>:<value>]`. */
const arb = (prop: string, value: string) => `[${prop}${SEP}${value}]`;

/**
 * The ruled cap. ⚠ The UNIT is the substance, not the number: `vh` is the LARGE
 * viewport, so with a browser toolbar showing a `60vh` box exceeds 60% of what
 * the reader can actually see — the same reason the tier root is sized in `dvh`.
 */
const RULED_CAP = "60dvh";

/**
 * `ImageAttach`'s attached-preview class set AT THE GROUND TIP (`f3345c81`), read
 * out of that commit and pinned here.
 *
 * ⛔ THE COMPOSER'S PREVIEW IS NOT PART OF THIS ROUND, and pinning the whole
 * string rather than asserting "no phone token" is deliberate: F-2 is a change
 * to how an attachment is bounded, and the obvious way to over-apply it is to
 * "fix" the preview next door to match. The preview is a blob: URL in a
 * composer that is already inside a bounded sheet; it has its own 40dvh cap and
 * its own reasons.
 */
const GROUND_TIP_ATTACHED_PREVIEW =
	"h-auto max-h-[40dvh] w-auto max-w-full rounded-(--imgr) object-contain";

afterEach(() => {
	cleanup();
});

/** The two arms, rendered. `fill` is the post/reply card attachment. */
function arm(fill: boolean): { box: Element; img: Element } {
	const { container } = render(
		<CommentImage
			url="https://example.invalid/fixture-attachment"
			onOpen={() => undefined}
			fill={fill}
		/>,
	);
	const box = container.querySelector("button");
	const img = container.querySelector("img");
	if (box === null || img === null) {
		throw new Error(
			`the ${fill ? "fill" : "non-fill"} arm rendered no button/img pair — ` +
				"this file is measuring nothing",
		);
	}
	return { box, img };
}

const tokensOf = (el: Element) =>
	(el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

/** Every phone-variant token on an element, whatever it is. */
const phoneTokensOf = (el: Element) =>
	tokensOf(el).filter((t) => t.startsWith(VARIANT + SEP));

describe("MOBILE-2k · F-2 — the guard reads both arms (controls first)", () => {
	it("comment-image-phone::both-arms-render-and-share-their-unprefixed-tokens", () => {
		const fill = arm(true);
		const plain = arm(false);

		// The shared, unchanged half — the T2 recipe, on both arms. Without this
		// the arm comparisons below could be comparing one rendered element
		// against one empty string.
		for (const { img } of [fill, plain]) {
			const tokens = tokensOf(img);
			expect(tokens).toContain("max-w-full");
			expect(tokens).toContain("object-contain");
			expect(tokens).toContain("rounded-[var(--imgr)]");
			expect(tokens).toContain("[border:var(--hairline)]");
		}

		// ...and the arms are genuinely different elements with different boxes.
		expect(tokensOf(plain.box)).toEqual(["block", "w-fit"]);
		expect(tokensOf(fill.box)).toContain("flex");
	});

	/**
	 * ⚠ THE SELF-CHECK. This file must not emit the utilities it asserts — see the
	 * ⛔⛔⛔ paragraph. The regex is assembled so that the check itself does not
	 * plant a token.
	 */
	it("comment-image-phone::this-guard-plants-no-utility-in-the-stylesheet", () => {
		const own = read(
			"tests/unit/debate/render/comment-image-phone-containment.test.tsx",
		);
		expect(
			new RegExp(`${VARIANT + SEP}[a-z[]`).test(own),
			"a class-shaped variant literal in this file becomes a REAL emitted " +
				"rule in the production stylesheet, and the plan verifies this round " +
				"by grepping that stylesheet — the guard would then pass on a class " +
				"the component does not carry",
		).toBe(false);
	});
});

describe("MOBILE-2k · F-2 — the cap is on the fill arm and nowhere else (G7)", () => {
	it("comment-image-phone::the-fill-arm-is-capped-below-640-in-dvh", () => {
		const { img } = arm(true);
		const pattern = new RegExp(`^${VARIANT}${SEP}max-h-\\[(.+)\\]$`);
		const token = tokensOf(img).find((t) => pattern.test(t));
		const value = token === undefined ? null : pattern.exec(token)?.[1];
		if (value === undefined || value === null) {
			throw new Error(
				"the `fill` arm declares no phone-width max-height. `max-h-full` is a " +
					"percentage and resolves to `none` here, so without this token the " +
					"attachment has NO height bound below 640px at all",
			);
		}
		expect(value, "the ruled cap is 60% of the VISUAL viewport").toBe(
			RULED_CAP,
		);
		expect(
			value.endsWith("dvh"),
			`the cap is expressed in \`${value}\`. \`vh\` is the LARGE viewport, so ` +
				"with a browser toolbar showing it exceeds the fraction it names — " +
				"the same reason the tier root is sized in `dvh`",
		).toBe(true);
	});

	/**
	 * ⛔ AND THE OTHER ARM IS UNTOUCHED — the whole of it, not just the cap. The
	 * non-`fill` arm is `PostFocusHeader`'s fixed side slot, which renders only in
	 * the desktop tree; a phone-variant token there would be a rule about a
	 * breakpoint that arm never reaches, and the next reader would have to work
	 * out which of the two arms it was for.
	 */
	it("comment-image-phone::the-non-fill-arm-carries-no-phone-token-at-all", () => {
		const plain = arm(false);
		expect(
			[...phoneTokensOf(plain.img), ...phoneTokensOf(plain.box)],
			"F-2 is gated on `fill`, which is the post/reply card attachment. The " +
				"other arm is a fixed desktop-only slot",
		).toEqual([]);

		// POSITIVE CONTROL — the `fill` arm DOES carry them, so the empty list
		// above is a fact about the arm and not about the extractor.
		const fill = arm(true);
		expect(
			[...phoneTokensOf(fill.img), ...phoneTokensOf(fill.box)].length,
		).toBeGreaterThanOrEqual(4);
	});

	it("comment-image-phone::the-desktop-bound-is-left-exactly-where-it-was", () => {
		expect(
			tokensOf(arm(true).img),
			"`max-h-full` is the desktop's bound and it bites there (the fixed-height " +
				"grid supplies the definite height it needs). Replacing it rather than " +
				"adding beside it would move the desktop, which F-2 does not do",
		).toContain("max-h-full");
		expect(tokensOf(arm(false).img)).toContain("max-h-[var(--imgmax)]");
	});
});

describe("MOBILE-2k · F-2 — the edge goes and the card's radius arrives (G8)", () => {
	/**
	 * ⛔ THE SPELLING IS THE MECHANISM. The base token is the arbitrary property
	 * `[border:var(--hairline)]`, and Tailwind orders a variant AFTER its
	 * unprefixed peer within the same utility KIND — so an arbitrary property is
	 * what reliably overrides an arbitrary property. `border-none` sets
	 * `border-style`, a different declaration whose position against a `border`
	 * shorthand is not a thing to assume. This row asserts the form, not just the
	 * effect, because the effect is invisible here.
	 */
	it("comment-image-phone::the-fill-arm-drops-the-edge-as-an-arbitrary-property", () => {
		const tokens = tokensOf(arm(true).img);
		expect(tokens).toContain(phone(arb("border", "none")));
		expect(
			tokens,
			"`border-none` sets `border-style` and is NOT interchangeable with an " +
				"arbitrary-property override of an arbitrary property",
		).not.toContain(phone("border-none"));
		// ...and the unprefixed hairline stays, because the override is ADDITIVE.
		// A replacement would take the border off the desktop too.
		expect(tokens).toContain("[border:var(--hairline)]");
	});

	/**
	 * ⚠ A DIVERGENCE FROM A RATIFIED TOKEN, RECORDED AS ONE. `--imgr` (6px) is
	 * ratified for images and still governs everywhere else, desktop included. The
	 * phone feed is the one place the picture is edge-to-edge inside its card with
	 * no border between them, so a 6px corner inside the card's 8px corner reads
	 * as a misregistration rather than as two radii — founder-ruled for this round.
	 */
	it("comment-image-phone::the-fill-arm-takes-the-cards-radius-below-640", () => {
		const tokens = tokensOf(arm(true).img);
		expect(tokens).toContain(phone("rounded-(--r)"));
		expect(
			tokens,
			"the ratified `--imgr` must survive as the unprefixed rule — the " +
				"divergence is scoped to below 640px and to this arm",
		).toContain("rounded-[var(--imgr)]");
	});

	/**
	 * The box becomes the card's content width so the image is centred IN the
	 * card, rather than the box shrink-wrapping the image. Visually identical
	 * while the box is transparent and borderless — which it is — but the box is
	 * what a later aspect-ratio reservation would have to size, and a
	 * shrink-to-fit box cannot be reserved.
	 */
	it("comment-image-phone::the-box-becomes-the-cards-width-below-640", () => {
		expect(tokensOf(arm(true).box)).toContain(phone("w-full"));
		expect(
			tokensOf(arm(true).box),
			"an UNPREFIXED `w-full` would change the desktop box as well",
		).not.toContain("w-full");
	});
});

describe("MOBILE-2k · F-2 — the composer's preview is not part of this (G9)", () => {
	/**
	 * ⛔ CLASS EQUALITY AGAINST THE GROUND TIP'S STRING. The obvious over-apply of
	 * this round is to make the composer's attached preview match the feed's
	 * attachment; it must not, and the cheapest way to prove that is to compare
	 * the whole set rather than to enumerate what must not be there.
	 */
	it("comment-image-phone::the-attached-preview-is-byte-identical-to-the-ground-tip", () => {
		const src = read(ATTACH);
		const m = /const attachedPreview =\s*\n?\s*"([^"]*)"/.exec(src);
		if (!m?.[1]) {
			throw new Error(
				`${ATTACH}: no \`const attachedPreview = "<classes>"\` — the constant ` +
					"this row pins has moved, and the pin cannot be re-derived",
			);
		}
		expect(
			m[1],
			"the composer's attached preview changed. It is a blob: URL inside a " +
				"bounded sheet with its own 40dvh cap and its own reasons; F-2 is " +
				"about a card attachment in a content-sized feed",
		).toBe(GROUND_TIP_ATTACHED_PREVIEW);
		expect(
			m[1].includes(VARIANT + SEP),
			"a phone-variant token arrived on the composer's preview",
		).toBe(false);
	});
});
