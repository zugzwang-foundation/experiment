// PFP-1 — the identity vocabulary must describe images that actually exist.
//
// The pre-PFP-1 lists were invented before any render existed: 20 colours x 10
// animals, of which 13 colours and 5 animals had no image, and one entry
// ("Pine") was not an animal. These tests pin the vocabulary to the render
// library as it was measured on 2026-08-25.
//
// The render machine and the local output path this note used to name are
// deliberately out: they describe a private operator environment, none of it is
// reachable from this repository, and what a reader of this file needs is which
// vocabulary is pinned — not where the images were made. Do not restore them.

import { describe, expect, it } from "vitest";

import {
	ANIMALS,
	COLOURS,
	PFP_VARIANTS,
} from "@/server/identity-pool/vocabulary";

describe("identity vocabulary", () => {
	it("carries the 13 colours the render library was built in", () => {
		expect(COLOURS).toEqual([
			"Red",
			"Orange",
			"Gold",
			"Olive",
			"Green",
			"Jade",
			"Teal",
			"Cerulean",
			"Indigo",
			"Violet",
			"Magenta",
			"Rose",
			"Silver",
		]);
	});

	it("carries 67 animals", () => {
		expect(ANIMALS).toHaveLength(67);
	});

	it("has no duplicate entries on either axis", () => {
		expect(new Set(COLOURS).size).toBe(COLOURS.length);
		expect(new Set(ANIMALS).size).toBe(ANIMALS.length);
	});

	it("is PascalCase single tokens throughout", () => {
		for (const word of [...COLOURS, ...ANIMALS]) {
			expect(word).toMatch(/^[A-Z][a-z]+$/);
		}
	});

	// The render tree has this one lowercase, which would produce a `capybara`
	// pseudonym among 66 PascalCase siblings.
	it("corrects the lowercase capybara on disk", () => {
		expect(ANIMALS).toContain("Capybara");
		expect(ANIMALS).not.toContain("capybara");
	});

	it("drops the invented entries that have no render", () => {
		for (const absent of ["Pine", "Stoat", "Hare", "Hawk", "Otter"]) {
			expect(ANIMALS).not.toContain(absent);
		}
		for (const absent of ["Crimson", "Saffron", "Azure", "Emerald", "Beige"]) {
			expect(COLOURS).not.toContain(absent);
		}
	});

	it("records 9 image variants for Cat and Dog and 1 for every other animal", () => {
		expect(PFP_VARIANTS.Cat).toBe(9);
		expect(PFP_VARIANTS.Dog).toBe(9);
		for (const animal of ANIMALS) {
			if (animal === "Cat" || animal === "Dog") continue;
			expect(PFP_VARIANTS[animal]).toBe(1);
		}
	});

	it("declares a variant count for every animal and no others", () => {
		expect(Object.keys(PFP_VARIANTS).sort()).toEqual([...ANIMALS].sort());
	});
});
