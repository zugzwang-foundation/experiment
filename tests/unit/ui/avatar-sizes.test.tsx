// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/**
 * DISCOVERY-COMPLETE C2 — V50, the `xs` (16px) Avatar preset.
 *
 * The preset has to live on the PRIMITIVE, not at the call site. The size rules
 * are data-variants, so Tailwind compiles `data-[size=sm]:size-6` to
 * `&[data-size=sm]` — specificity (0,2,0) — against a consumer's bare `.size-4`
 * at (0,1,0). `size-6` wins REGARDLESS of twMerge ordering, which is why
 * register row PD-2-30 routes to the primitive (POLISH-1a item 4).
 *
 * The second `describe` is the load-bearing half: `sm` must be UNCHANGED. There
 * are exactly four `<Avatar>` mounts in src/ and three of them stay `sm` —
 * IdentityCluster.tsx:48, IdentityCluster.tsx:62 and ArgProfile.tsx:51. Only
 * HeroPanels.tsx:117 moves to `xs`.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const mount = (size?: "default" | "xs" | "sm" | "lg") => {
	const { container } = render(
		size === undefined ? (
			<Avatar>
				<AvatarFallback>AB</AvatarFallback>
			</Avatar>
		) : (
			<Avatar size={size}>
				<AvatarFallback>AB</AvatarFallback>
			</Avatar>
		),
	);
	return container.querySelector('[data-slot="avatar"]');
};

describe("Avatar xs — the new Discovery hero-head preset", () => {
	it("xs-stamps-the-attribute-and-reaches-size-4", () => {
		const avatar = mount("xs");
		expect(avatar?.getAttribute("data-size")).toBe("xs");
		// The 16px rule must be present on the primitive itself, where its
		// data-variant specificity can beat the other size rules.
		expect(avatar?.getAttribute("class")).toContain("data-[size=xs]:size-4");
	});

	it("xs-scales-the-fallback-glyph-down", () => {
		const { container } = render(
			<Avatar size="xs">
				<AvatarFallback>AB</AvatarFallback>
			</Avatar>,
		);
		const fallback = container.querySelector('[data-slot="avatar-fallback"]');
		expect(fallback?.getAttribute("class")).toContain(
			"group-data-[size=xs]/avatar:text-[9px]",
		);
	});
});

describe("Avatar sm/default/lg — the regression guard, three live mounts stay put", () => {
	it("sm-is-unchanged", () => {
		const avatar = mount("sm");
		expect(avatar?.getAttribute("data-size")).toBe("sm");
		const cls = avatar?.getAttribute("class") ?? "";
		// The 24px rule survives, and adding xs did not displace it.
		expect(cls).toContain("data-[size=sm]:size-6");
		expect(cls).toContain("size-8");
		expect(cls).toContain("data-[size=lg]:size-10");
	});

	it("default-is-unchanged-and-is-still-the-default", () => {
		expect(mount()?.getAttribute("data-size")).toBe("default");
		expect(mount("default")?.getAttribute("data-size")).toBe("default");
	});

	it("lg-is-unchanged", () => {
		expect(mount("lg")?.getAttribute("data-size")).toBe("lg");
	});

	it("the-avatar-ring-is-untouched-in-every-size", () => {
		for (const size of ["default", "xs", "sm", "lg"] as const) {
			expect(mount(size)?.getAttribute("class")).toContain(
				"after:[border:var(--avatar-ring)]",
			);
			cleanup();
		}
	});
});
