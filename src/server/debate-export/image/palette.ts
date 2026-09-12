/**
 * The design tokens the JPEG export paints with, as literal hex.
 *
 * Satori (the renderer behind `next/og`) has no stylesheet and no `var()`
 * resolution, so the export composition cannot bind to `globals.css` the way
 * every other surface does. This module is the ONE place the token values are
 * restated, and `tests/unit/debate-export/image-palette-parity.test.ts` reads
 * `globals.css` and asserts every entry here equals the token it names — so a
 * token change on the page reddens this file rather than silently leaving the
 * export on the old colour. Values are looked up by token NAME so the census
 * rules (`tokens-monochrome.test.ts`) keep governing the source; nothing here
 * is a second opinion on what a token should be.
 *
 * `yes` / `no` name the SIDE poles (YES = black, NO = white), exactly as
 * `--color-yes` / `--color-no` do — never the Support/Counter relation.
 */
export const PALETTE = {
	ground: "#181818",
	n0: "#212121",
	n1: "#2a2a2a",
	n2: "#404040",
	n3: "#545454",
	n4: "#747474",
	n5: "#989898",
	n6: "#bdbdbd",
	n7: "#e4e4e4",
	ink: "#fafafa",
	yes: "#181818",
	no: "#fafafa",
	graphYes: "#737373",
	graphNo: "#fafafa",
} as const;

/** `PALETTE` key → the `globals.css` custom property it must equal. */
export const PALETTE_TOKENS: Record<keyof typeof PALETTE, string> = {
	ground: "--color-ground",
	n0: "--color-n0",
	n1: "--color-n1",
	n2: "--color-n2",
	n3: "--color-n3",
	n4: "--color-n4",
	n5: "--color-n5",
	n6: "--color-n6",
	n7: "--color-n7",
	ink: "--color-ink",
	yes: "--color-yes",
	no: "--color-no",
	graphYes: "--graph-yes",
	graphNo: "--graph-no",
};

/**
 * ⛔⛔ EXPORT-ONLY COLOUR, DELIBERATELY OUTSIDE THE TOKEN SYSTEM — AND THE ONE
 * PLACE IN THIS REPOSITORY WHERE THAT IS TRUE.
 *
 * `globals.css` is true-neutral by ratification: there is no `--color-brand`,
 * `--destructive` is neutralised to `n6`, and `tokens-monochrome.test.ts`
 * enforces an eleven-token achromatic census (R == G == B) over the whole
 * source. Nothing here changes any of that — no page, no component and no
 * stylesheet reads this object, and `PALETTE` above is still the only thing
 * bound to a token.
 *
 * What these three are for is a surface the design system was never written
 * for: an image that leaves the site. An export is read once, at thumbnail
 * size, beside content nobody controls, by someone who has never seen the
 * product — and the two facts it has to carry (which way the market leans,
 * which way this argument leans) are exactly the two that a grey line and a
 * white line at 50/50 make indistinguishable. On the page the reader has the
 * chip, the label, the position and the whole surrounding surface to
 * disambiguate; in a shared JPEG they have the picture and nothing else.
 *
 * ⚠ THE POLE LAW BINDS WHEREVER THESE NAME A SIDE: `green` is YES and `red`
 * is NO on the price lines and on the market's YES / NO bar, which is the same
 * rule `--color-yes` / `--color-no` state.
 *
 * ⛔ AND THERE IS EXACTLY ONE RULED EXCEPTION — the post's Support / Counter
 * bar, which since revision 5 (operator ruling, 2026-09-11) is FIXED green on
 * the left and red on the right rather than coloured by `deriveReplySide`'s
 * SIDE. It is named here as well as at the call site because a reader who
 * arrives at this object first would otherwise carry away a rule the
 * composition no longer applies, and a paragraph that says "still binds"
 * beside code that does not is worse than no paragraph. The reasoning — that
 * two bars in one image must share one legend or teach the reader nothing —
 * lives with the consts in `MarketPostExport.tsx`; this is the pointer, not a
 * second copy of the argument.
 *
 * ⚠ Kept in a SEPARATE object from `PALETTE` rather than added to it, so the
 * parity guard's "every entry names a token" assertion stays exactly as
 * strong as it was. These have no token to name; the guard asserts instead
 * that this set is exactly these keys, so it cannot grow in silence — and it
 * did its job at revision 7, reddening the moment `category` was added rather
 * than letting a fourth off-system colour in unannounced.
 */
export const ACCENT = {
	/** The YES pole, in colour — the price line, the bar segment, the figure. */
	green: "#22c55e",
	/** The NO pole, in colour. */
	red: "#ef4444",
	/** The market's flavour chip. */
	flavour: "#7c3aed",
	/**
	 * The market's TOPIC chip — `MATH`, `CLAUDE`, `BITCOIN` — the first of the
	 * two that follow the question mark: a dark slate box with pale blue letters.
	 *
	 * ⛔ THE INK IS SAMPLED FROM THE OPERATOR'S REFERENCE IMAGE; THE FILL IS THE
	 * REFERENCE'S, LIFTED. Read off the supplied chip: a flat `#232c35` interior,
	 * a `#cbecff` glyph core, and — scanning down the top edge — the ground
	 * rising into the fill over four rows with no distinct border, so the chip
	 * has none here either.
	 *
	 * ⚠ `#232c35` SHIPPED FIRST AND DID NOT READ, and the reason is the GROUND,
	 * not the sample. The reference sits on its own darker page; against this
	 * card's `#212121` the same fill is two or three points of lightness away,
	 * so the chip's edge vanished and the topic read as loose blue letters rather
	 * than as a block beside the flavour's. `#2a3f57` is that colour carried
	 * further along its own axis — bluer and a step lighter — which keeps the
	 * reference's character and gives the box somewhere to be.
	 *
	 * ⚠ AN OUTER GLOW WAS TRIED FIRST AND REJECTED. It made the chip visible by
	 * putting light AROUND it, which reads as a halo — a different treatment from
	 * everything else in the image, and one the flavour chip beside it does not
	 * wear. The fix belonged in the fill.
	 *
	 * ⚠ IT WENT THROUGH `#6a5acd` FIRST — the CSS `slateblue` keyword — and that
	 * reading was wrong in a way worth recording, because the NAME invites it:
	 * `slateblue` is a purple, and beside the flavour's `#7c3aed` the two chips
	 * rendered as one continuous violet bar at export size. "Slate blue" as a
	 * designer means it is slate WITH blue in it, which is this: desaturated,
	 * dark, and carrying its colour in the TEXT rather than in the fill.
	 *
	 * ⚠ AND THAT INVERSION IS WHY THE PAIR NOW READS. The flavour is a light
	 * word on a saturated ground; the topic is a saturated word on a dark ground.
	 * They differ in STRUCTURE, not merely in hue — which is the margin the
	 * previous attempt did not have.
	 */
	category: "#2a3f57",
	/** The topic chip's lettering — the reference's own glyph colour. */
	categoryInk: "#cbecff",

	/**
	 * The position row's three blocks — the side chip, the stake and the age.
	 *
	 * ⛔ SAMPLED FROM THE OPERATOR'S REFERENCE, EXCEPT ONE. Read off the supplied
	 * image: the NO chip is `#952524`, the stake `#1a3850`, the age `#36393d`,
	 * all three lettered white. They read as one family — dark, desaturated,
	 * distinct by hue — which is what lets three blocks sit in a row without any
	 * of them shouting.
	 *
	 * ⚠ `chipYes` IS DERIVED, NOT SAMPLED, BECAUSE THE REFERENCE COULD NOT SHOW
	 * IT. The post in it is a NO, so only the red exists to copy; picking a green
	 * by eye would have put the two poles at different weights and made every YES
	 * post quietly louder or quieter than every NO one. It is the red's own
	 * saturation and lightness at a green hue — `hsl(0.5°, 61%, 36.3%)` measured
	 * off `#952524`, re-rendered at 142° — so the pair differ in hue and in
	 * nothing else.
	 *
	 * ⚠ THESE REPLACE THE BLACK/WHITE POLES the chips wore a revision ago.
	 * `--color-yes` / `--color-no` are the SIDE tokens and they still name the
	 * side everywhere it is a claim about the market — the split bars, the chart.
	 * Here the block is chrome around a figure, and chrome in the product's own
	 * two colours was reading as a second, louder statement of the side the chip
	 * already spells out in words.
	 */
	chipYes: "#24954e",
	chipNo: "#952524",
	chipStake: "#1a3850",
	chipAge: "#36393d",
} as const;
