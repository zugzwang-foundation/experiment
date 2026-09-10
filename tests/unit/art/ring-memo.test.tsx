// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { INNER_FIGURES, OUTER_FIGURES } from "@/components/art/warli/figures";
import { Ring } from "@/components/art/warli/ring";

/**
 * P2.1 — `Ring`'s geometry cache is keyed on exactly the values the math
 * depends on (`centre`/`radius`/`phaseDeg`/`facing`/the derived `dense`
 * flag/the `figures` array reference), and deliberately never on `name`.
 * This scenario — two `<Ring>`s sharing a `name` but differing in every
 * geometry-relevant prop — doesn't occur anywhere in production or in the
 * rest of this suite (both call in `hero.tsx` use distinct `name`s), which
 * is exactly why it needs its own direct proof rather than resting on
 * inference: nothing else in the suite would catch a cache keyed on `name`
 * by mistake.
 *
 * Both transforms below are hand-computed at `phaseDeg=0` (straight up,
 * `sin 0 = 0`, `cos 0 = 1`) specifically so the arithmetic needs no lookup
 * table — the same reason `warli-render.test.tsx`'s exact-transform case
 * picks angles with known closed-form sin/cos.
 */
describe("Ring — geometry memo is never keyed on `name`", () => {
	it("two rings sharing a name but differing in every geometry input render their own, distinct, correct geometry", () => {
		// radius=100, outward, phaseDeg=0: foot = (0, -100), rotate 0.
		const a = render(
			<svg aria-hidden="true">
				<Ring
					name="dup"
					centre={{ x: 0, y: 0 }}
					radius={100}
					figures={INNER_FIGURES}
					density="solid"
					facing="outward"
					phaseDeg={0}
				/>
			</svg>,
		);
		expect(
			a.container
				.querySelector(
					'[data-warli-ring="dup"] [data-warli-id="warli-scholar"]',
				)
				?.getAttribute("transform"),
		).toBe("translate(0 -100) rotate(0)");

		// radius=200, inward, phaseDeg=0: foot = (0, -200), rotate 0+180=180.
		// Different figures array (a different reference — OUTER_FIGURES, not
		// INNER_FIGURES), different radius, different facing, different
		// density — everything the cache key can depend on differs, EXCEPT
		// `name`, which stays "dup" on purpose.
		const b = render(
			<svg aria-hidden="true">
				<Ring
					name="dup"
					centre={{ x: 0, y: 0 }}
					radius={200}
					figures={OUTER_FIGURES}
					density="spare"
					facing="inward"
					phaseDeg={0}
				/>
			</svg>,
		);
		expect(
			b.container
				.querySelector(
					'[data-warli-ring="dup"] [data-warli-id="warli-speaker"]',
				)
				?.getAttribute("transform"),
		).toBe("translate(0 -200) rotate(180)");
	});
});
