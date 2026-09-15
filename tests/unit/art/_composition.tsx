import { FieldLayer } from "@/components/art/warli/field-layer";
import { WarliHero } from "@/components/art/warli/hero";

/**
 * The whole drawing as a visitor sees it: the hero, plus the static field it
 * loads from `public/art/warli-field.svg`.
 *
 * ⚠ SINCE WARLI-FIELD-ASSET THE HERO'S DOM IS NOT THE PICTURE. The field is an
 * `<image>` pointing at a generated file, which jsdom neither fetches nor
 * parses, so an assertion about the composition — every figure once, the
 * curves, the populations — has to render the field beside the hero or it
 * grades a drawing with 86% of its marks missing. The file is held equal to
 * `<FieldLayer />` by `field-asset.test.ts`, which is what makes rendering the
 * component here equivalent to reading the file.
 *
 * Assertions about the hero ITSELF — the rings, the root, where the field image
 * sits — keep rendering `<WarliHero />` alone.
 */
export function WarliComposition() {
	return (
		<>
			<WarliHero />
			<svg>
				<title>static field</title>
				<FieldLayer />
			</svg>
		</>
	);
}
